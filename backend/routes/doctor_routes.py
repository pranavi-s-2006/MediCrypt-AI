from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Body
from routes.auth_routes import get_current_user
from services.doctor_service import get_doctor_profile, get_approved_patients, add_prescription
from services.consent_service import create_access_request, check_access
from services.audit_service import log_action
from models.prescription_model import PrescriptionCreate
from config.database import get_db
from agents import ocr_agent, gemini_agent, drug_safety_agent
from bson import ObjectId
import asyncio, aiofiles, logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/doctor", tags=["doctor"])

OCR_TIMEOUT = 120
MAX_FILE_SIZE = 5 * 1024 * 1024


@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return await get_doctor_profile(current_user["sub"]) or {}


@router.post("/profile")
async def save_profile(data: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    db = get_db()
    from datetime import datetime
    fields = {
        "user_id":        current_user["sub"],
        "name":           data.get("name", ""),
        "specialization": data.get("specialization", ""),
        "qualification":  data.get("qualification", ""),
        "license_number": data.get("license_number", ""),
        "hospital_id":    data.get("hospital_id", ""),
        "department":     data.get("department", ""),
        "experience":     data.get("experience", ""),
        "hospital":       data.get("hospital", ""),
        "is_verified":    False,
        "updated_at":     datetime.utcnow(),
    }
    await db.doctors.update_one(
        {"user_id": current_user["sub"]},
        {"$set": fields, "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True
    )
    await log_action(current_user["sub"], "update_doctor_profile", "doctors", current_user["sub"])
    return await get_doctor_profile(current_user["sub"])


@router.post("/request-access")
async def request_access(
    patient_id: str,
    reason: str = "",
    hospital: str = "",
    doctor_name: str = "",
    department: str = "",
    requested_records: str = "",
    access_duration_hours: int = 24,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can request access")
    extra = {
        "hospital": hospital or None,
        "doctor_name": doctor_name or None,
        "department": department or None,
        "requested_records": [r.strip() for r in requested_records.split(",") if r.strip()] if requested_records else [],
        "access_duration_hours": access_duration_hours,
    }
    req = await create_access_request(current_user["sub"], patient_id, reason, extra)
    await log_action(current_user["sub"], "request_access", "access_requests", req["_id"])
    return req


@router.get("/approved-patients")
async def approved_patients(current_user: dict = Depends(get_current_user)):
    return await get_approved_patients(current_user["sub"])


@router.get("/patient-records/{patient_id}")
async def get_patient_records(patient_id: str, current_user: dict = Depends(get_current_user)):
    if not await check_access(current_user["sub"], patient_id):
        raise HTTPException(status_code=403, detail="Access not approved for this patient")
    db = get_db()
    records = []
    async for doc in db.medical_records.find({"patient_id": patient_id}).sort("created_at", -1):
        doc["_id"] = str(doc["_id"])
        records.append(doc)
    await log_action(current_user["sub"], "view_patient_records", "medical_records", patient_id)
    return {"records": records}


@router.post("/add-prescription")
async def add_prescription_route(data: PrescriptionCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can add prescriptions")
    if not await check_access(current_user["sub"], data.patient_id):
        raise HTTPException(status_code=403, detail="No approved access for this patient")
    prescription = await add_prescription({**data.model_dump(), "doctor_id": current_user["sub"]})
    await log_action(current_user["sub"], "add_prescription", "prescriptions", prescription["_id"])
    return prescription


@router.get("/drug-alerts")
async def get_drug_alerts(current_user: dict = Depends(get_current_user)):
    db = get_db()
    patients = await get_approved_patients(current_user["sub"])
    patient_ids = [p["patient_id"] for p in patients]
    alerts = []
    async for record in db.medical_records.find(
        {"patient_id": {"$in": patient_ids}, "risk_alert": {"$in": ["Critical", "High"]}}
    ).sort("created_at", -1).limit(50):
        record["_id"] = str(record["_id"])
        alerts.append(record)
    return {"alerts": alerts}


@router.post("/analyze-prescription")
async def analyze_prescription(
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Full drug safety analysis pipeline for doctor prescription upload.

    Flow:
      1. Validate access + file
      2. Save file to disk
      3. OCR → extract text
      4. Gemini → extract new medicines (with timing/food/dosage)
      5. Fetch patient's current medicines + allergies from MongoDB
      6. Drug safety check: DDInter + timing + duplicates + allergies
      7. Gemini → generate doctor safety summary
      8. Save draft prescription record to MongoDB (status=pending_review)
      9. Return full safety report for doctor review
    """
    if not await check_access(current_user["sub"], patient_id):
        raise HTTPException(status_code=403, detail="No approved access for this patient")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File exceeds 5 MB limit.")

    is_pdf = content[:4] == b'%PDF'

    # ── Step 1: OCR ───────────────────────────────────────
    try:
        ocr_text = await asyncio.wait_for(
            ocr_agent.extract_text_from_image(content),
            timeout=OCR_TIMEOUT
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="OCR timed out. Try a clearer file.")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"OCR failed: {e}")

    if not ocr_text or not ocr_text.strip():
        raise HTTPException(status_code=422, detail="OCR returned no text. Ensure the image is clear.")

    # ── Step 2: Gemini medicine extraction ────────────────
    try:
        new_medicines = await gemini_agent.extract_medicine_details(ocr_text)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Medicine extraction failed: {e}")

    if not new_medicines:
        raise HTTPException(status_code=422, detail="No medicines found in the prescription. Please check the image.")

    # ── Step 3: Fetch patient profile (current meds + allergies) ──
    db = get_db()
    patient_profile = await db.patients.find_one({"user_id": patient_id}) or {}
    patient_allergies = patient_profile.get("allergies", [])

    # Get current active medicines from prescriptions + medical records
    current_medicines: list = []

    # From prescriptions collection
    async for rx in db.prescriptions.find({"patient_id": patient_id, "status": {"$ne": "inactive"}}):
        for med in rx.get("medicines", []):
            current_medicines.append(med if isinstance(med, dict) else {"name": str(med)})

    # Also from patient profile medicines field
    for med in patient_profile.get("medicines", []):
        if isinstance(med, dict) and med.get("status") == "active":
            current_medicines.append(med)

    # ── Step 4: Drug safety check ─────────────────────────
    safety = await drug_safety_agent.full_safety_check(
        current_medicines=current_medicines,
        new_medicines=new_medicines,
        patient_allergies=patient_allergies,
    )

    # ── Step 5: AI safety summary ─────────────────────────
    try:
        ai_summary = await gemini_agent.generate_prescription_safety_summary(
            current_medicines=current_medicines,
            new_medicines=new_medicines,
            interactions=safety["interactions"],
            timing_conflicts=safety["timing_conflicts"],
            duplicates=safety["duplicates"],
            allergy_conflicts=safety["allergy_conflicts"],
            patient_allergies=patient_allergies,
        )
    except Exception as e:
        logger.warning("Safety summary generation failed: %s", e)
        ai_summary = "AI summary could not be generated. Please review the alerts manually."

    # ── Step 6: Save draft prescription to MongoDB ────────
    draft = await db.prescriptions.insert_one({
        "patient_id":        patient_id,
        "doctor_id":         current_user["sub"],
        "status":            "pending_review",
        "source_type":       "pdf" if is_pdf else "image",
        "ocr_text":          ocr_text,
        "new_medicines":     new_medicines,
        "current_medicines": current_medicines,
        "safety":            safety,
        "ai_summary":        ai_summary,
    })
    draft_id = str(draft.inserted_id)

    await log_action(current_user["sub"], "analyze_prescription", "prescriptions", draft_id)

    return {
        "draft_id":          draft_id,
        "patient_id":        patient_id,
        "ocr_text":          ocr_text,
        "new_medicines":     new_medicines,
        "current_medicines": current_medicines,
        "patient_allergies": patient_allergies,
        "safety":            safety,
        "ai_summary":        ai_summary,
        "source_type":       "pdf" if is_pdf else "image",
    }


@router.post("/accept-prescription/{draft_id}")
async def accept_prescription(draft_id: str, current_user: dict = Depends(get_current_user)):
    """Doctor accepts the analyzed prescription — promotes draft to active."""
    db = get_db()
    try:
        doc = await db.prescriptions.find_one({"_id": ObjectId(draft_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Draft not found")
    if doc.get("doctor_id") != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.prescriptions.update_one(
        {"_id": ObjectId(draft_id)},
        {"$set": {"status": "active", "accepted_by": current_user["sub"]}}
    )
    # Also save medicines to the medical_records collection for patient history
    await db.medical_records.insert_one({
        "patient_id":          doc["patient_id"],
        "doctor_id":           current_user["sub"],
        "document_type":       "prescription",
        "extracted_medicines": doc.get("new_medicines", []),
        "drug_interactions":   doc.get("safety", {}).get("interactions", []),
        "risk_level":          doc.get("safety", {}).get("overall_risk", "Unknown"),
        "risk_alert":          doc.get("safety", {}).get("overall_risk", "Unknown"),
        "ai_summary":          doc.get("ai_summary"),
        "status":              "complete",
    })
    await log_action(current_user["sub"], "accept_prescription", "prescriptions", draft_id)
    return {"message": "Prescription accepted and saved to patient record", "draft_id": draft_id}


@router.post("/override-prescription/{draft_id}")
async def override_prescription(
    draft_id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Doctor overrides safety alerts with a documented reason and accepts."""
    reason = payload.get("reason", "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Override reason is required")

    db = get_db()
    try:
        doc = await db.prescriptions.find_one({"_id": ObjectId(draft_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid draft ID")
    if not doc:
        raise HTTPException(status_code=404, detail="Draft not found")
    if doc.get("doctor_id") != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.prescriptions.update_one(
        {"_id": ObjectId(draft_id)},
        {"$set": {"status": "overridden", "override_reason": reason, "accepted_by": current_user["sub"]}}
    )
    await db.medical_records.insert_one({
        "patient_id":          doc["patient_id"],
        "doctor_id":           current_user["sub"],
        "document_type":       "prescription",
        "extracted_medicines": doc.get("new_medicines", []),
        "drug_interactions":   doc.get("safety", {}).get("interactions", []),
        "risk_level":          doc.get("safety", {}).get("overall_risk", "Unknown"),
        "risk_alert":          doc.get("safety", {}).get("overall_risk", "Unknown"),
        "ai_summary":          doc.get("ai_summary"),
        "override_reason":     reason,
        "status":              "complete",
    })
    await log_action(current_user["sub"], "override_prescription", "prescriptions", draft_id)
    return {"message": "Prescription overridden and saved with documented reason", "draft_id": draft_id}
