from config.database import get_db
from datetime import datetime
from bson import ObjectId

async def get_patient_profile(user_id: str) -> dict:
    db = get_db()
    profile = await db.patients.find_one({"user_id": user_id})
    if profile:
        profile["_id"] = str(profile["_id"])
    return profile

async def update_patient_profile(user_id: str, update_data: dict) -> dict:
    db = get_db()
    update_data["updated_at"] = datetime.utcnow()
    result = await db.patients.update_one(
        {"user_id": user_id},
        {"$set": update_data},
        upsert=True
    )
    return await get_patient_profile(user_id)

async def get_medical_history(patient_id: str) -> list:
    db = get_db()
    cursor = db.medical_records.find({"patient_id": patient_id}).sort("created_at", -1)
    records = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        records.append(doc)
    return records

async def save_medical_record(record_data: dict) -> dict:
    db = get_db()
    record_data["created_at"] = datetime.utcnow()
    result = await db.medical_records.insert_one(record_data)
    record_data["_id"] = str(result.inserted_id)
    return record_data
