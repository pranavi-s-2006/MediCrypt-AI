from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Body, Form
from routes.auth_routes import get_current_user
from agents import ocr_agent, gemini_agent, ddinter_agent, risk_agent
from services.audit_service import log_action
from config.database import get_db
from bson import ObjectId
import asyncio, aiofiles, logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])

MAX_FILE_SIZE    = 5 * 1024 * 1024
OCR_TIMEOUT_SECS = 120


def _check_file_size(content: bytes, filename: str = ""):
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File '{filename}' is {len(content)/1024/1024:.1f} MB. Maximum allowed is 5 MB."
        )


@router.post("/ocr")
async def run_ocr(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    content = await file.read()
    _check_file_size(content, file.filename)
    try:
        text = await asyncio.wait_for(
            ocr_agent.extract_text_from_image(content),
            timeout=OCR_TIMEOUT_SECS
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="OCR timed out. Try a smaller or clearer file.")
    await log_action(current_user["sub"], "ocr", "ai")
    return {"ocr_text": text}


@router.post("/extract-medicine")
async def extract_medicine(payload: dict = Body(...), current_user: dict = Depends(get_current_user)):
    ocr_text = payload.get("ocr_text", "")
    if not ocr_text:
        raise HTTPException(status_code=400, detail="ocr_text is required")
    medicines = await gemini_agent.extract_medicine_details(ocr_text)
    return {"medicines": medicines}


@router.post("/check-drug-interaction")
async def check_drug_interaction(payload: dict = Body(...), current_user: dict = Depends(get_current_user)):
    medicines = payload.get("medicines", [])
    interactions = await ddinter_agent.check_interactions(medicines)
    risk = risk_agent.assess_risk(interactions)
    return {"interactions": interactions, "risk": risk}


@router.post("/risk-alert")
async def get_risk_alert(payload: dict = Body(...), current_user: dict = Depends(get_current_user)):
    return risk_agent.assess_risk(payload.get("interactions", []))


@router.post("/emergency-summary")
async def emergency_summary(payload: dict = Body(...), current_user: dict = Depends(get_current_user)):
    summary = await gemini_agent.generate_emergency_summary(payload)
    return {"summary": summary}


@router.post("/process-prescription")
async def process_prescription(
    file: UploadFile = File(...),
    record_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    content = await file.read()
    _check_file_size(content, file.filename)
    is_pdf = content[:4] == b'%PDF'

    try:
        ocr_text = await asyncio.wait_for(
            ocr_agent.extract_text_from_image(content),
            timeout=OCR_TIMEOUT_SECS
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="OCR timed out. " + ("PDF may have too many pages." if is_pdf else "Try a clearer image.")
        )

    if not ocr_text or not ocr_text.strip():
        raise HTTPException(status_code=422, detail="OCR returned no text. Ensure the image is clear.")

    medicines    = await gemini_agent.extract_medicine_details(ocr_text)
    interactions = await ddinter_agent.check_interactions(medicines)
    risk         = risk_agent.assess_risk(interactions)
    explanation  = await gemini_agent.generate_risk_explanation(medicines, interactions, risk["risk"])

    result = {
        "ocr_text": ocr_text, "medicines": medicines,
        "interactions": interactions, "risk": risk,
        "explanation": explanation, "source_type": "pdf" if is_pdf else "image",
    }

    if record_id:
        db = get_db()
        try:
            await db.medical_records.update_one(
                {"_id": ObjectId(record_id)},
                {"$set": {
                    "ocr_text": ocr_text, "extracted_medicines": medicines,
                    "drug_interactions": interactions, "risk_level": risk["risk"],
                    "risk_alert": risk["alert"], "ai_summary": explanation,
                }}
            )
        except Exception as e:
            logger.warning("Failed to update record %s: %s", record_id, e)

    await log_action(current_user["sub"], "process_prescription", "ai")
    return result


@router.post("/retry-ocr/{record_id}")
async def retry_ocr(record_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        doc = await db.medical_records.find_one({"_id": ObjectId(record_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid record ID.")
    if not doc:
        raise HTTPException(status_code=404, detail="Record not found.")
    if doc.get("patient_id") != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    file_path = doc.get("file_path")
    if not file_path:
        raise HTTPException(status_code=422, detail="No file path stored for this record.")

    try:
        async with aiofiles.open(file_path, "rb") as f:
            content = await f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Uploaded file not found on disk: {file_path}")

    is_pdf   = content[:4] == b'%PDF'
    steps    = {"upload": {"status": "done", "message": "File already saved"}}
    response = {
        "record_id": record_id, "source_type": "pdf" if is_pdf else "image",
        "steps": steps, "ocr_text": None, "medicines": [], "interactions": [],
        "risk": {"risk": "Pending", "alert": "Pending", "message": "Retry in progress"},
        "explanation": None, "error": None,
    }

    async def _persist(fields: dict):
        try:
            await db.medical_records.update_one(
                {"_id": ObjectId(record_id)}, {"$set": fields}
            )
        except Exception as e:
            logger.warning("DB update failed for %s: %s", record_id, e)

    ocr_text = ""
    try:
        ocr_text = await asyncio.wait_for(
            ocr_agent.extract_text_from_image(content), timeout=OCR_TIMEOUT_SECS
        )
        if not ocr_text or not ocr_text.strip():
            raise ValueError("OCR returned empty text.")
        response["ocr_text"] = ocr_text
        steps["ocr"] = {"status": "done", "message": f"Extracted {len(ocr_text)} characters"}
        await _persist({"ocr_text": ocr_text, "status": "ocr_done"})
    except asyncio.TimeoutError:
        msg = "OCR timed out. Try a smaller or clearer file."
        steps["ocr"] = {"status": "error", "message": msg}
        response["error"] = msg
        await _persist({"status": "OCR_FAILED", "ai_summary": msg})
        return response
    except Exception as e:
        msg = f"OCR failed: {e}"
        steps["ocr"] = {"status": "error", "message": msg}
        response["error"] = msg
        await _persist({"status": "OCR_FAILED", "ai_summary": msg})
        return response

    medicines = []
    try:
        medicines = await gemini_agent.extract_medicine_details(ocr_text)
        response["medicines"] = medicines
        steps["gemini"] = {"status": "done", "message": f"{len(medicines)} medicines extracted"}
        await _persist({"extracted_medicines": medicines, "status": "gemini_done"})
    except Exception as e:
        steps["gemini"] = {"status": "error", "message": f"Gemini failed: {e}"}
        logger.warning("Gemini failed on retry for %s: %s", record_id, e)

    interactions = []
    try:
        interactions = await ddinter_agent.check_interactions(medicines)
        response["interactions"] = interactions
        steps["ddinter"] = {"status": "done", "message": f"{len(interactions)} interaction(s) found"}
        await _persist({"drug_interactions": interactions, "status": "ddinter_done"})
    except Exception as e:
        steps["ddinter"] = {"status": "error", "message": f"DDInter failed: {e}"}
        logger.warning("DDInter failed on retry for %s: %s", record_id, e)

    risk = {"risk": "Pending", "alert": "Pending", "message": "Risk analysis could not be completed."}
    try:
        risk_raw = risk_agent.assess_risk(interactions)
        risk = {**risk_raw, "message": None}
        response["risk"] = risk
        steps["risk"] = {"status": "done", "message": f"Risk level: {risk.get('risk')}"}
        await _persist({"risk_level": risk.get("risk"), "risk_alert": risk.get("alert"), "status": "ai_complete"})
    except Exception as e:
        steps["risk"] = {"status": "error", "message": f"Risk Engine failed: {e}"}
        logger.warning("Risk Engine failed on retry for %s: %s", record_id, e)
        await _persist({"risk_level": "Pending", "risk_alert": "Pending", "status": "risk_error"})

    try:
        if medicines and risk.get("risk") not in ("Pending", None):
            explanation = await gemini_agent.generate_risk_explanation(medicines, interactions, risk["risk"])
            response["explanation"] = explanation
            await _persist({"ai_summary": explanation, "status": "complete"})
    except Exception as e:
        logger.warning("Explanation failed on retry for %s: %s", record_id, e)

    await log_action(current_user["sub"], "retry_ocr", "medical_records", record_id)
    return response


# ── POST /ai/compare-prescriptions ───────────────────────
@router.post("/compare-prescriptions")
async def compare_prescriptions(
    old_prescription: UploadFile = File(...),
    new_prescription: UploadFile = File(...),
    patient_id: str = Form(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Full automatic dual-prescription comparison pipeline:
    1. OCR both files simultaneously
    2. Gemini extracts medicines from both (name, dosage, timing, duration, before/after food)
    3. Fetch patient allergies + chronic diseases from MongoDB
    4. DDInter checks all old+new drug combinations
    5. Detect allergy conflicts and duplicate medicines
    6. Risk Engine calculates risk level + percentage
    7. Gemini generates structured doctor safety report
    """
    old_bytes = await old_prescription.read()
    new_bytes = await new_prescription.read()
    _check_file_size(old_bytes, old_prescription.filename)
    _check_file_size(new_bytes, new_prescription.filename)

    # Step 1: OCR both files in parallel
    try:
        old_ocr, new_ocr = await asyncio.gather(
            asyncio.wait_for(ocr_agent.extract_text_from_image(old_bytes), timeout=OCR_TIMEOUT_SECS),
            asyncio.wait_for(ocr_agent.extract_text_from_image(new_bytes), timeout=OCR_TIMEOUT_SECS),
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="OCR timed out. Try smaller or clearer files.")

    if not old_ocr.strip() and not new_ocr.strip():
        raise HTTPException(status_code=422, detail="OCR returned no text from either file.")

    # Step 2: Extract medicines from both in parallel
    old_medicines, new_medicines = await asyncio.gather(
        gemini_agent.extract_medicine_details(old_ocr),
        gemini_agent.extract_medicine_details(new_ocr),
    )

    # Step 3: Fetch patient allergies and chronic diseases
    pid     = patient_id or current_user["sub"]
    db      = get_db()
    ep      = await db.emergency_profiles.find_one({"patient_id": pid}) or {}
    patient = await db.patients.find_one({"user_id": pid}) or {}
    allergies = ep.get("allergies") or patient.get("allergies") or []
    diseases  = ep.get("chronic_diseases") or patient.get("chronic_diseases") or []

    # Step 4: DDInter — check all combined medicines
    all_medicines = old_medicines + new_medicines
    interactions  = await ddinter_agent.check_interactions(all_medicines)

    # Tag each interaction: old_vs_new / new_vs_new / old_vs_old
    old_names = {m.get("name", "").lower() for m in old_medicines}
    new_names = {m.get("name", "").lower() for m in new_medicines}
    for ix in interactions:
        a = ix.get("drug_a", "").lower()
        b = ix.get("drug_b", "").lower()
        if (a in old_names and b in new_names) or (b in old_names and a in new_names):
            ix["source"] = "old_vs_new"
        elif a in new_names and b in new_names:
            ix["source"] = "new_vs_new"
        else:
            ix["source"] = "old_vs_old"

    # Step 5: Allergy conflict detection
    allergy_conflicts = []
    allergy_lower     = [a.lower() for a in allergies]
    for med in all_medicines:
        name = med.get("name", "").lower()
        for allergen in allergy_lower:
            if allergen in name or name in allergen:
                allergy_conflicts.append({
                    "medicine": med.get("name"),
                    "allergen": allergen,
                    "source":   "new" if med in new_medicines else "old",
                })

    # Duplicate detection
    duplicates = []
    for om in old_medicines:
        for nm in new_medicines:
            if om.get("name", "").lower() == nm.get("name", "").lower():
                duplicates.append(om.get("name"))
    duplicates = list(set(duplicates))

    # Step 6: Risk Engine — boost if allergy conflicts exist
    boosted = list(interactions)
    if allergy_conflicts:
        boosted.append({"level": "Critical", "drug_a": "allergy", "drug_b": "conflict",
                        "description": "Patient allergy conflict detected"})
    risk = risk_agent.assess_risk(boosted)

    # Step 7: Gemini safety report
    ai_report = None
    try:
        ai_report = await gemini_agent.generate_prescription_safety_summary(
            current_medicines=old_medicines,
            new_medicines=new_medicines,
            interactions=interactions,
            timing_conflicts=[],
            duplicates=duplicates,
            allergy_conflicts=allergy_conflicts,
            patient_allergies=allergies,
        )
    except Exception as e:
        logger.warning("Gemini safety report failed: %s", e)

    await log_action(
        current_user["sub"], "compare_prescriptions", "ai",
        details={"patient_id": pid, "interaction_count": len(interactions),
                 "risk": risk.get("risk"), "risk_pct": risk.get("risk_percentage")},
    )

    return {
        "old_medicines":     old_medicines,
        "new_medicines":     new_medicines,
        "patient_allergies": allergies,
        "chronic_diseases":  diseases,
        "interactions":      interactions,
        "allergy_conflicts": allergy_conflicts,
        "duplicates":        duplicates,
        "risk":              risk,
        "ai_report":         ai_report,
        "old_ocr_text":      old_ocr,
        "new_ocr_text":      new_ocr,
    }
