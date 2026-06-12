from config.database import get_db
from datetime import datetime
from bson import ObjectId

async def get_doctor_profile(user_id: str) -> dict:
    db = get_db()
    doc = await db.doctors.find_one({"user_id": user_id})
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc

async def create_doctor_profile(profile_data: dict) -> dict:
    db = get_db()
    profile_data["created_at"] = datetime.utcnow()
    result = await db.doctors.insert_one(profile_data)
    profile_data["_id"] = str(result.inserted_id)
    return profile_data

async def get_approved_patients(doctor_id: str) -> list:
    db = get_db()
    cursor = db.access_requests.find({"doctor_id": doctor_id, "status": "approved"})
    patients = []
    async for req in cursor:
        req["_id"] = str(req["_id"])
        patients.append(req)
    return patients

async def add_prescription(prescription_data: dict) -> dict:
    db = get_db()
    prescription_data["created_at"] = datetime.utcnow()
    result = await db.prescriptions.insert_one(prescription_data)
    prescription_data["_id"] = str(result.inserted_id)
    return prescription_data
