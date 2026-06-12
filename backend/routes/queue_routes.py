from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from routes.auth_routes import get_current_user
from services.audit_service import log_action
from config.database import get_db
from config import settings
from bson import ObjectId
from datetime import datetime
import os, aiofiles, logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/queue", tags=["queue"])


def _sid(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


# ── Hospital: add patient to a doctor's queue ────────────
@router.post("/add")
async def add_to_queue(data: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "hospital_admin":
        raise HTTPException(status_code=403, detail="Hospital admins only")
    db = get_db()

    patient_id = data.get("patient_id", "").strip()
    doctor_id  = data.get("doctor_id",  "").strip()
    reason     = data.get("reason",     "General consultation")
    department = data.get("department", "")

    if not patient_id or not doctor_id:
        raise HTTPException(status_code=422, detail="patient_id and doctor_id are required")

    # Verify patient approval exists
    access = await db.hospital_access.find_one({
        "hospital_user_id": current_user["sub"],
        "patient_id": patient_id,
        "status": "approved"
    })
    if not access:
        raise HTTPException(status_code=403, detail="Patient has not approved access yet")

    # Prevent duplicate active queue entry
    existing = await db.doctor_queues.find_one({
        "doctor_id": doctor_id,
        "patient_id": patient_id,
        "status": {"$in": ["waiting", "in_consultation"]}
    })
    if existing:
        return _sid(existing)

    # Get next queue number for this doctor today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    count = await db.doctor_queues.count_documents({
        "doctor_id": doctor_id,
        "created_at": {"$gte": today_start}
    })

    # Fetch patient info for display
    patient  = await db.patients.find_one({"user_id": patient_id}) or {}
    user_doc = await db.users.find_one({"_id": ObjectId(patient_id)}) if ObjectId.is_valid(patient_id) else None
    patient_name = (user_doc.get("name") if user_doc else None) or patient.get("name") or patient_id

    entry = {
        "doctor_id":    doctor_id,
        "patient_id":   patient_id,
        "patient_name": patient_name,
        "blood_group":  patient.get("blood_group", ""),
        "age":          patient.get("age", ""),
        "reason":       reason,
        "department":   department,
        "queue_no":     count + 1,
        "status":       "waiting",        # waiting | in_consultation | completed
        "file_sent":    False,            # hospital sent file to doctor
        "created_at":   datetime.utcnow(),
        "hospital_user_id": current_user["sub"],
    }
    result = await db.doctor_queues.insert_one(entry)
    entry["_id"] = str(result.inserted_id)
    await log_action(current_user["sub"], "add_to_queue", "doctor_queues", entry["_id"])
    return entry


# ── Hospital: send patient file to doctor (start consultation) ──
@router.post("/send-file")
async def send_file_to_doctor(data: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "hospital_admin":
        raise HTTPException(status_code=403, detail="Hospital admins only")
    db = get_db()

    queue_id = data.get("queue_id", "").strip()
    if not queue_id:
        raise HTTPException(status_code=422, detail="queue_id is required")

    entry = await db.doctor_queues.find_one({"_id": ObjectId(queue_id)})
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found")

    await db.doctor_queues.update_one(
        {"_id": ObjectId(queue_id)},
        {"$set": {"status": "in_consultation", "file_sent": True, "file_sent_at": datetime.utcnow()}}
    )
    await log_action(current_user["sub"], "send_file_to_doctor", "doctor_queues", queue_id)
    return {"message": "File sent to doctor. Consultation started."}


# ── Hospital: upload report/prescription/payment for a queue entry ──
@router.post("/upload-report")
async def upload_report(
    queue_id:   str        = Form(...),
    doc_type:   str        = Form("report"),
    notes:      str        = Form(""),
    amount:     str        = Form(""),
    patient_id: str        = Form(""),
    file:       UploadFile = File(None),
    current_user: dict     = Depends(get_current_user)
):
    if current_user.get("role") != "hospital_admin":
        raise HTTPException(status_code=403, detail="Hospital admins only")
    db = get_db()

    # Direct upload (no queue) — patient_id passed directly
    if queue_id == "direct":
        if not patient_id:
            raise HTTPException(status_code=422, detail="patient_id required for direct upload")
        resolved_patient_id = patient_id
        doctor_id = None
    else:
        entry = await db.doctor_queues.find_one({"_id": ObjectId(queue_id)})
        if not entry:
            raise HTTPException(status_code=404, detail="Queue entry not found")
        resolved_patient_id = entry["patient_id"]
        doctor_id = entry.get("doctor_id")

    file_path = None
    if file and file.filename:
        content = await file.read()
        upload_dir = os.path.join(settings.UPLOAD_DIR, f"{doc_type}s")
        os.makedirs(upload_dir, exist_ok=True)
        file_path = os.path.join(upload_dir, f"{resolved_patient_id}_{queue_id}_{file.filename}")
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)

    record = {
        "patient_id":        resolved_patient_id,
        "queue_id":          queue_id,
        "doctor_id":         doctor_id,
        "uploaded_by":       current_user["sub"],
        "document_type":     doc_type,
        "original_filename": file.filename if file else None,
        "file_path":         file_path,
        "notes":             notes,
        "amount":            amount,
        "status":            "complete",
        "created_at":        datetime.utcnow(),
    }
    result = await db.medical_records.insert_one(record)
    record["_id"] = str(result.inserted_id)
    await log_action(current_user["sub"], f"upload_{doc_type}", "medical_records", record["_id"])
    return record


# ── Hospital: mark consultation completed ────────────────
@router.post("/complete")
async def complete_consultation(data: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "hospital_admin":
        raise HTTPException(status_code=403, detail="Hospital admins only")
    db = get_db()
    queue_id = data.get("queue_id", "").strip()
    entry = await db.doctor_queues.find_one({"_id": ObjectId(queue_id)})
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found")
    await db.doctor_queues.update_one(
        {"_id": ObjectId(queue_id)},
        {"$set": {"status": "completed", "completed_at": datetime.utcnow()}}
    )
    # Revoke doctor's active consultation access
    await db.hospital_access.update_one(
        {"hospital_user_id": current_user["sub"], "patient_id": entry["patient_id"], "status": "approved"},
        {"$set": {"status": "revoked", "revoked_at": datetime.utcnow()}}
    )
    await log_action(current_user["sub"], "complete_consultation", "doctor_queues", queue_id)
    return {"message": "Consultation completed"}


# ── Hospital: get full queue for a doctor ────────────────
@router.get("/hospital/{doctor_id}")
async def get_queue_for_hospital(doctor_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "hospital_admin":
        raise HTTPException(status_code=403, detail="Hospital admins only")
    db = get_db()
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    cursor = db.doctor_queues.find({
        "doctor_id": doctor_id,
        "created_at": {"$gte": today_start}
    }).sort("queue_no", 1)
    entries = [_sid(e) async for e in cursor]
    return {"queue": entries}


# ── Doctor: get own queue ─────────────────────────────────
@router.get("/doctor")
async def get_doctor_queue(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    db = get_db()
    # Show waiting + in_consultation from any date, completed only today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    cursor = db.doctor_queues.find({
        "doctor_id": current_user["sub"],
        "$or": [
            {"status": {"$in": ["waiting", "in_consultation"]}},
            {"status": "completed", "created_at": {"$gte": today_start}}
        ]
    }).sort("queue_no", 1)
    entries = [_sid(e) async for e in cursor]

    waiting       = [e for e in entries if e["status"] == "waiting"]
    in_consult    = next((e for e in entries if e["status"] == "in_consultation"), None)
    completed     = [e for e in entries if e["status"] == "completed"]

    return {
        "queue":        entries,
        "waiting":      waiting,
        "current":      in_consult,
        "next":         waiting[0] if waiting else None,
        "completed_count": len(completed),
        "total":        len(entries),
    }


# ── Doctor: get patient records for active consultation only ──
@router.get("/patient-records/{queue_id}")
async def get_consultation_records(queue_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    db = get_db()
    entry = await db.doctor_queues.find_one({"_id": ObjectId(queue_id)})
    if not entry:
        raise HTTPException(status_code=404, detail="Queue entry not found")
    if entry["doctor_id"] != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not your patient")
    if entry["status"] == "waiting" and not entry.get("file_sent"):
        raise HTTPException(status_code=403, detail="Hospital has not confirmed this patient's turn yet")

    patient_id = entry["patient_id"]
    patient    = await db.patients.find_one({"user_id": patient_id}) or {}
    user_doc   = await db.users.find_one({"_id": ObjectId(patient_id)}) if ObjectId.is_valid(patient_id) else None
    if patient:
        patient["_id"] = str(patient["_id"])
    if user_doc:
        patient["name"]  = user_doc.get("name", "")
        patient["email"] = user_doc.get("email", "")

    records = []
    async for doc in db.medical_records.find({"patient_id": patient_id}).sort("created_at", -1):
        doc["_id"] = str(doc["_id"])
        records.append(doc)

    prescriptions = []
    async for doc in db.prescriptions.find({"patient_id": patient_id}).sort("created_at", -1).limit(10):
        doc["_id"] = str(doc["_id"])
        prescriptions.append(doc)

    await log_action(current_user["sub"], "view_consultation_records", "medical_records", patient_id)
    return {
        "patient":       patient,
        "records":       records,
        "prescriptions": prescriptions,
        "queue_entry":   _sid(entry),
    }


# ── Doctor: save prescription from consultation ───────────
@router.post("/save-prescription")
async def save_prescription(data: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    db = get_db()

    queue_id  = data.get("queue_id", "").strip()
    medicines = data.get("medicines", [])
    notes     = data.get("notes", "")

    entry = await db.doctor_queues.find_one({"_id": ObjectId(queue_id)})
    if not entry or entry["doctor_id"] != current_user["sub"]:
        raise HTTPException(status_code=403, detail="Not your consultation")
    if entry["status"] != "in_consultation":
        raise HTTPException(status_code=403, detail="No active consultation")

    patient_id = entry["patient_id"]
    result = await db.prescriptions.insert_one({
        "patient_id":    patient_id,
        "doctor_id":     current_user["sub"],
        "queue_id":      queue_id,
        "medicines":     medicines,
        "notes":         notes,
        "status":        "active",
        "created_at":    datetime.utcnow(),
    })
    rx_id = str(result.inserted_id)

    await db.medical_records.insert_one({
        "patient_id":          patient_id,
        "doctor_id":           current_user["sub"],
        "queue_id":            queue_id,
        "document_type":       "prescription",
        "extracted_medicines": medicines,
        "notes":               notes,
        "status":              "complete",
        "created_at":          datetime.utcnow(),
    })
    await log_action(current_user["sub"], "save_prescription", "prescriptions", rx_id)
    return {"message": "Prescription saved", "prescription_id": rx_id}
