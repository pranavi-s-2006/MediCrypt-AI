from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from routes.auth_routes import get_current_user
from services.patient_service import get_patient_profile, update_patient_profile, get_medical_history, save_medical_record
from services.audit_service import log_action
from models.patient_model import PatientProfileUpdate
from config import settings
from config.database import get_db
from agents import ocr_agent, gemini_agent, ddinter_agent, risk_agent
from bson import ObjectId
from datetime import datetime
import os, aiofiles, asyncio, logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/patient", tags=["patient"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024   # 5 MB
ALLOWED_TYPES    = {"image/jpeg", "image/png", "image/jpg", "application/pdf"}
OCR_TIMEOUT      = 120               # seconds


@router.get("/access-requests")
async def get_patient_access_requests(current_user: dict = Depends(get_current_user)):
    db = get_db()
    # Resolve the patient's user_id (in case stored as ObjectId string)
    patient = await db.patients.find_one({"user_id": current_user["sub"]})
    patient_id = patient["user_id"] if patient else current_user["sub"]
    cursor = db.hospital_access.find({"patient_id": patient_id})
    requests = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        requests.append(doc)
    return {"requests": requests}

@router.post("/respond-access")
async def respond_to_access_request(
    request_id: str,
    status: str,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    doc = await db.hospital_access.find_one({"_id": ObjectId(request_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Access request not found")
    patient = await db.patients.find_one({"user_id": current_user["sub"]})
    patient_id = patient["user_id"] if patient else current_user["sub"]
    if doc["patient_id"] != patient_id:
        raise HTTPException(status_code=403, detail="Not your access request")
    if status not in ("approved", "rejected"):
        raise HTTPException(status_code=422, detail="status must be approved or rejected")
    await db.hospital_access.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": status, "responded_at": datetime.utcnow()}}
    )
    await log_action(current_user["sub"], f"hospital_access_{status}", "hospital_access", request_id)
    return {"message": f"Access {status}"}

@router.get("/lookup/{patient_id}")
async def lookup_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    query = {"user_id": patient_id}
    if ObjectId.is_valid(patient_id):
        query = {"$or": [{"user_id": patient_id}, {"_id": ObjectId(patient_id)}]}
    patient = await db.patients.find_one(query)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient["_id"] = str(patient["_id"])
    return patient


@router.get("/file/{record_id}")
async def download_record_file(record_id: str, current_user: dict = Depends(get_current_user)):
    from fastapi.responses import FileResponse
    import mimetypes
    db = get_db()
    record = await db.medical_records.find_one({"_id": ObjectId(record_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    file_path = record.get("file_path")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on server")
    mime, _ = mimetypes.guess_type(file_path)
    mime = mime or "application/octet-stream"
    await log_action(current_user["sub"], "view_record", "medical_records", record_id)
    return FileResponse(
        path=file_path,
        filename=record.get("original_filename", os.path.basename(file_path)),
        media_type=mime,
        headers={"Content-Disposition": "inline"}
    )

@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    profile = await get_patient_profile(current_user["sub"])
    return profile or {"user_id": current_user["sub"], "message": "Profile not set up yet"}


@router.put("/profile")
async def update_profile(data: PatientProfileUpdate, current_user: dict = Depends(get_current_user)):
    updated = await update_patient_profile(current_user["sub"], data.model_dump(exclude_none=True))
    await log_action(current_user["sub"], "update_profile", "patients")
    return updated


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    file_type: str = Form("prescription"),
    current_user: dict = Depends(get_current_user)
):
    """Simple file upload — no AI processing."""
    upload_dir = os.path.join(settings.UPLOAD_DIR, f"{file_type}s")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{current_user['sub']}_{file.filename}")
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    record = await save_medical_record({
        "patient_id":        current_user["sub"],
        "uploaded_by":       current_user["sub"],
        "file_path":         file_path,
        "original_filename": file.filename,
        "document_type":     file_type,
        "status":            "uploaded",
    })
    await log_action(current_user["sub"], "upload_file", "medical_records", record["_id"])
    return {"record_id": record["_id"], "file_path": file_path, "message": "File uploaded successfully"}


@router.post("/upload-prescription")
async def upload_prescription(
    file: UploadFile = File(...),
    file_type: str = Form("prescription"),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload + full AI pipeline, safe against partial failures.

    Order of operations (each step isolated with try/except):
      1. Validate file type and size
      2. Save file to disk
      3. Save MongoDB record with status="uploaded"  ← guaranteed
      4. OCR  (TrOCR / PyMuPDF for PDF)
      5. Gemini medicine extraction
      6. DDInter drug interaction check
      7. Risk Engine assessment
      8. Persist AI results back to MongoDB record
      9. Return full or partial result — never crashes on AI failure
    """
    # ── Step 1: Validate ──────────────────────────────────
    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        # Also allow by extension for clients that send generic content-type
        ext = (file.filename or "").lower().rsplit(".", 1)[-1]
        if ext not in {"jpg", "jpeg", "png", "pdf"}:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported file type '{content_type}'. Allowed: JPG, PNG, PDF."
            )

    content = await file.read()

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is {len(content) / 1024 / 1024:.1f} MB. Maximum allowed size is 5 MB."
        )

    is_pdf = content[:4] == b'%PDF'
    source_type = "pdf" if is_pdf else "image"

    # ── Step 2: Save file to disk ─────────────────────────
    upload_dir = os.path.join(settings.UPLOAD_DIR, f"{file_type}s")
    os.makedirs(upload_dir, exist_ok=True)
    safe_name = f"{current_user['sub']}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_name)

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    logger.info("File saved: %s (%d bytes, %s)", file_path, len(content), source_type)

    # ── Step 3: Save MongoDB record (always succeeds) ─────
    record = await save_medical_record({
        "patient_id":        current_user["sub"],
        "uploaded_by":       current_user["sub"],
        "file_path":         file_path,
        "original_filename": file.filename,
        "document_type":     file_type,
        "source_type":       source_type,
        "status":            "uploaded",
        "ocr_text":          None,
        "extracted_medicines": [],
        "drug_interactions": [],
        "risk_level":        "Pending",
        "risk_alert":        "Pending",
        "ai_summary":        None,
    })
    record_id = record["_id"]
    await log_action(current_user["sub"], "upload_file", "medical_records", record_id)

    # Response object — populated step by step
    result = {
        "record_id":   record_id,
        "source_type": source_type,
        "status":      "uploaded",
        "steps": {
            "upload":   {"status": "done",    "message": "File saved and record created"},
            "ocr":      {"status": "pending", "message": ""},
            "gemini":   {"status": "pending", "message": ""},
            "ddinter":  {"status": "pending", "message": ""},
            "risk":     {"status": "pending", "message": ""},
        },
        "ocr_text":     None,
        "medicines":    [],
        "interactions": [],
        "risk":         {"risk": "Pending", "alert": "Pending", "message": "Risk analysis not yet run"},
        "explanation":  None,
        "error":        None,
    }

    db = get_db()

    async def _persist(fields: dict):
        """Helper: update the MongoDB record non-blocking."""
        try:
            await db.medical_records.update_one(
                {"_id": ObjectId(record_id)},
                {"$set": fields}
            )
        except Exception as e:
            logger.warning("DB update failed for %s: %s", record_id, e)

    # ── Step 4: OCR ───────────────────────────────────────
    # On any OCR failure we mark OCR_FAILED but CONTINUE so the record
    # is always fully persisted and downstream steps can be retried later.
    ocr_text = ""
    try:
        ocr_text = await asyncio.wait_for(
            ocr_agent.extract_text_from_image(content),
            timeout=OCR_TIMEOUT
        )
        if not ocr_text or not ocr_text.strip():
            raise ValueError("OCR returned empty text — image may be unclear or blank.")
        result["ocr_text"] = ocr_text
        result["steps"]["ocr"] = {"status": "done", "message": f"Extracted {len(ocr_text)} characters"}
        await _persist({"ocr_text": ocr_text, "status": "ocr_done"})
    except asyncio.TimeoutError:
        msg = "OCR timed out after 2 minutes. Try a smaller or clearer image."
        result["steps"]["ocr"] = {"status": "error", "message": msg}
        result["error"] = msg
        await _persist({"status": "OCR_FAILED", "ai_summary": msg})
        # Do NOT return — record stays saved, Gemini/DDInter/Risk skipped gracefully below
    except Exception as e:
        msg = f"OCR failed: {str(e)}"
        result["steps"]["ocr"] = {"status": "error", "message": msg}
        result["error"] = msg
        await _persist({"status": "OCR_FAILED", "ai_summary": msg})

    # ── Step 5: Gemini medicine extraction ────────────────
    medicines = []
    if ocr_text.strip():
        try:
            medicines = await gemini_agent.extract_medicine_details(ocr_text)
            result["medicines"] = medicines
            result["steps"]["gemini"] = {"status": "done", "message": f"{len(medicines)} medicines extracted"}
            await _persist({"extracted_medicines": medicines, "status": "gemini_done"})
        except Exception as e:
            msg = f"Gemini extraction failed: {str(e)}"
            result["steps"]["gemini"] = {"status": "error", "message": msg}
            logger.warning("Gemini step failed for record %s: %s", record_id, e)
    else:
        result["steps"]["gemini"] = {"status": "skipped", "message": "Skipped — OCR produced no text"}

    # ── Step 6: DDInter interaction check ─────────────────
    interactions = []
    try:
        interactions = await ddinter_agent.check_interactions(medicines)
        result["interactions"] = interactions
        result["steps"]["ddinter"] = {
            "status": "done",
            "message": f"{len(interactions)} interaction(s) found"
        }
        await _persist({"drug_interactions": interactions, "status": "ddinter_done"})
    except Exception as e:
        msg = f"DDInter check failed: {str(e)}"
        result["steps"]["ddinter"] = {"status": "error", "message": msg}
        logger.warning("DDInter step failed for record %s: %s", record_id, e)

    # ── Step 7: Risk Engine ───────────────────────────────
    risk = {"risk": "Pending", "alert": "Pending", "message": "Risk analysis could not be completed. Record uploaded successfully."}
    try:
        risk_raw = risk_agent.assess_risk(interactions)
        risk = {**risk_raw, "message": None}
        result["risk"] = risk
        result["steps"]["risk"] = {
            "status": "done",
            "message": f"Risk level: {risk.get('risk', 'Unknown')}"
        }
        await _persist({
            "risk_level": risk.get("risk"),
            "risk_alert": risk.get("alert"),
            "status":     "ai_complete",
        })
    except Exception as e:
        msg = f"Risk Engine failed: {str(e)}"
        result["steps"]["risk"] = {"status": "error", "message": msg}
        result["risk"] = {"risk": "Pending", "alert": "Pending", "message": "Risk analysis could not be completed. Record uploaded successfully."}
        logger.warning("Risk Engine failed for record %s: %s", record_id, e)
        await _persist({"risk_level": "Pending", "risk_alert": "Pending", "status": "risk_error"})

    # ── Step 8: Gemini risk explanation ──────────────────
    explanation = None
    try:
        if medicines and risk.get("risk") not in ("Pending", None):
            explanation = await gemini_agent.generate_risk_explanation(
                medicines, interactions, risk["risk"]
            )
        result["explanation"] = explanation
        await _persist({"ai_summary": explanation, "status": "complete"})
    except Exception as e:
        logger.warning("Explanation generation failed for record %s: %s", record_id, e)

    result["status"] = "complete"
    await log_action(current_user["sub"], "process_prescription", "medical_records", record_id)
    return result


@router.get("/history")
async def get_history(current_user: dict = Depends(get_current_user)):
    records = await get_medical_history(current_user["sub"])
    return {"records": records, "total": len(records)}


@router.post("/add-caregiver")
async def add_caregiver(caregiver_user_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.patients.update_one(
        {"user_id": current_user["sub"]},
        {"$addToSet": {"caregivers": caregiver_user_id}},
        upsert=True
    )
    await db.caregivers.update_one(
        {"caregiver_user_id": caregiver_user_id, "patient_user_id": current_user["sub"]},
        {"$set": {"caregiver_user_id": caregiver_user_id, "patient_user_id": current_user["sub"], "is_active": True}},
        upsert=True
    )
    await log_action(current_user["sub"], "add_caregiver", "caregivers", caregiver_user_id)
    return {"message": "Caregiver added successfully"}
