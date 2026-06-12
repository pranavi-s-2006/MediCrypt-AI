from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from routes.auth_routes import get_current_user
from services.audit_service import log_action
from models.hospital_model import HospitalCreate
from models.doctor_model import DoctorVerify
from config.database import get_db
from config import settings
from agents import ocr_agent, gemini_agent, ddinter_agent, risk_agent
from bson import ObjectId
from datetime import datetime
import os, aiofiles, asyncio, logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/hospital", tags=["hospital"])

@router.post("/create")
async def create_hospital(data: HospitalCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "hospital_admin":
        raise HTTPException(status_code=403, detail="Only hospital admins can create hospitals")
    db = get_db()
    hospital = {**data.model_dump(), "admin_user_id": current_user["sub"], "created_at": datetime.utcnow()}
    result = await db.hospitals.insert_one(hospital)
    hospital["_id"] = str(result.inserted_id)
    await log_action(current_user["sub"], "create_hospital", "hospitals", hospital["_id"])
    return hospital

@router.get("/doctors")
async def get_hospital_doctors(current_user: dict = Depends(get_current_user)):
    db = get_db()
    hospital = await db.hospitals.find_one({"admin_user_id": current_user["sub"]})
    if not hospital:
        # Auto-create a default hospital record for this admin on first access
        result = await db.hospitals.insert_one({
            "name": "My Hospital",
            "admin_user_id": current_user["sub"],
            "created_at": datetime.utcnow()
        })
        hospital = await db.hospitals.find_one({"_id": result.inserted_id})
    hospital_id = str(hospital["_id"])
    cursor = db.doctors.find({"hospital_id": hospital_id})
    doctors = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        doctors.append(doc)
    return {"doctors": doctors, "hospital_id": hospital_id}

@router.put("/verify-doctor")
async def verify_doctor(data: DoctorVerify, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "hospital_admin":
        raise HTTPException(status_code=403, detail="Only hospital admins can verify doctors")
    db = get_db()
    await db.doctors.update_one(
        {"user_id": data.doctor_id},
        {"$set": {"is_verified": data.is_verified, "verified_by": current_user["sub"]}}
    )
    await log_action(current_user["sub"], "verify_doctor", "doctors", data.doctor_id)
    return {"message": f"Doctor {'verified' if data.is_verified else 'unverified'} successfully"}

@router.get("/departments")
async def get_departments(current_user: dict = Depends(get_current_user)):
    db = get_db()
    hospital = await db.hospitals.find_one({"admin_user_id": current_user["sub"]})
    if not hospital:
        return {"departments": []}
    return {"departments": hospital.get("departments", [])}

@router.get("/access-status/{patient_id}")
async def get_access_status(patient_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = await db.hospital_access.find_one(
        {"hospital_user_id": current_user["sub"], "patient_id": patient_id},
        sort=[("created_at", -1)]
    )
    if not doc:
        return {"status": "none"}
    return {"status": doc["status"], "request_id": str(doc["_id"])}

@router.get("/patient-records/{patient_id}")
async def get_hospital_patient_records(patient_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    # Resolve patient_id in case an ObjectId was passed
    query = {"user_id": patient_id}
    if ObjectId.is_valid(patient_id):
        query = {"$or": [{"user_id": patient_id}, {"_id": ObjectId(patient_id)}]}
    patient = await db.patients.find_one(query)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    resolved_id = patient["user_id"]
    access = await db.hospital_access.find_one(
        {"hospital_user_id": current_user["sub"], "patient_id": resolved_id, "status": "approved"}
    )
    if not access:
        raise HTTPException(status_code=403, detail="Patient has not approved access yet")
    records = []
    async for doc in db.medical_records.find({"patient_id": resolved_id}).sort("created_at", -1):
        doc["_id"] = str(doc["_id"])
        records.append(doc)
    await log_action(current_user["sub"], "hospital_view_records", "medical_records", resolved_id)
    return {"records": records}

@router.post("/request-patient-access")
async def request_patient_access(
    patient_id: str,
    reason: str = "",
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "hospital_admin":
        raise HTTPException(status_code=403, detail="Only hospital admins can request access")
    db = get_db()
    # Resolve patient user_id from ObjectId if needed
    query = {"user_id": patient_id}
    if ObjectId.is_valid(patient_id):
        query = {"$or": [{"user_id": patient_id}, {"_id": ObjectId(patient_id)}]}
    patient = await db.patients.find_one(query)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    resolved_patient_id = patient["user_id"]
    existing = await db.hospital_access.find_one({
        "hospital_user_id": current_user["sub"],
        "patient_id": resolved_patient_id,
        "status": "pending"
    })
    if existing:
        return {"message": "Access request already pending", "status": "pending"}
    await db.hospital_access.insert_one({
        "hospital_user_id": current_user["sub"],
        "patient_id": resolved_patient_id,
        "reason": reason,
        "status": "pending",
        "created_at": datetime.utcnow()
    })
    await log_action(current_user["sub"], "request_patient_access", "patients", resolved_patient_id)
    return {"message": "Access request sent. Patient will be notified to approve.", "status": "pending"}

@router.post("/forward-to-doctor")
async def forward_to_doctor(data: dict, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "hospital_admin":
        raise HTTPException(status_code=403, detail="Only hospital admins can forward records")
    db = get_db()
    patient_id = data.get("patient_id")
    doctor_id  = data.get("doctor_id")
    note       = data.get("note", "")
    if not patient_id or not doctor_id:
        raise HTTPException(status_code=422, detail="patient_id and doctor_id are required")
    await db.doctor_assignments.update_one(
        {"patient_id": patient_id, "doctor_id": doctor_id, "hospital_user_id": current_user["sub"]},
        {"$set": {"note": note, "assigned_at": datetime.utcnow(), "is_active": True}},
        upsert=True
    )
    await log_action(current_user["sub"], "forward_to_doctor", "patients", patient_id)
    return {"message": "Patient records forwarded to doctor successfully"}

@router.get("/active-appointments")
async def get_active_appointments(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.hospital_access.find({
        "hospital_user_id": current_user["sub"],
        "status": {"$in": ["pending", "approved"]}
    })
    sessions = []
    async for s in cursor:
        s["_id"] = str(s["_id"])
        sessions.append(s)
    return {"appointments": sessions}

@router.post("/revoke-access")
async def revoke_access(patient_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.hospital_access.update_many(
        {"hospital_user_id": current_user["sub"], "patient_id": patient_id},
        {"$set": {"status": "revoked", "revoked_at": datetime.utcnow()}}
    )
    await log_action(current_user["sub"], "revoke_hospital_access", "patients", patient_id)
    return {"message": "Access revoked successfully"}

@router.post("/upload-prescription")
async def hospital_upload_prescription(
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    doctor_id: str = Form(""),
    notes: str = Form(""),
    file_type: str = Form("prescription"),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "hospital_admin":
        raise HTTPException(status_code=403, detail="Only hospital admins can upload prescriptions")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 5 MB limit")
    upload_dir = os.path.join(settings.UPLOAD_DIR, f"{file_type}s")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{patient_id}_{file.filename}")
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)
    db = get_db()
    record = {
        "patient_id": patient_id, "uploaded_by": current_user["sub"],
        "doctor_id": doctor_id, "notes": notes,
        "file_path": file_path, "original_filename": file.filename,
        "document_type": file_type, "status": "uploaded",
        "extracted_medicines": [], "drug_interactions": [],
        "risk_level": "Pending", "risk_alert": "Pending",
        "created_at": datetime.utcnow()
    }
    result = await db.medical_records.insert_one(record)
    record_id = str(result.inserted_id)
    await log_action(current_user["sub"], "hospital_upload_prescription", "medical_records", record_id)
    # Run AI pipeline
    medicines, interactions, risk, explanation = [], [], {"risk": "Pending", "alert": "Pending"}, None
    try:
        ocr_text = await asyncio.wait_for(ocr_agent.extract_text_from_image(content), timeout=120)
        medicines = await gemini_agent.extract_medicine_details(ocr_text)
        interactions = await ddinter_agent.check_interactions(medicines)
        risk = risk_agent.assess_risk(interactions)
        explanation = await gemini_agent.generate_risk_explanation(medicines, interactions, risk.get("risk"))
        await db.medical_records.update_one(
            {"_id": ObjectId(record_id)},
            {"$set": {"extracted_medicines": medicines, "drug_interactions": interactions,
                      "risk_level": risk.get("risk"), "risk_alert": risk.get("alert"),
                      "ai_summary": explanation, "status": "complete"}}
        )
    except Exception as e:
        logger.warning("AI pipeline failed for hospital upload %s: %s", record_id, e)
    return {
        "record_id": record_id, "status": "complete",
        "medicines": medicines, "interactions": interactions,
        "risk": risk, "explanation": explanation
    }
