from config.database import get_db
from datetime import datetime, timedelta
from bson import ObjectId

async def create_access_request(doctor_id: str, patient_id: str, reason: str, extra: dict = None) -> dict:
    db = get_db()
    existing = await db.access_requests.find_one({
        "doctor_id": doctor_id, "patient_id": patient_id, "status": "pending"
    })
    if existing:
        existing["_id"] = str(existing["_id"])
        return existing
    req = {
        "doctor_id": doctor_id,
        "patient_id": patient_id,
        "reason": reason,
        "status": "pending",
        "requested_at": datetime.utcnow(),
        **(extra or {})
    }
    result = await db.access_requests.insert_one(req)
    req["_id"] = str(result.inserted_id)
    return req

async def respond_to_request(request_id: str, status: str, responder_id: str) -> dict:
    db = get_db()
    update = {"status": status, "responded_at": datetime.utcnow(), "responded_by": responder_id}
    if status == "approved":
        req = await db.access_requests.find_one({"_id": ObjectId(request_id)})
        hours = (req or {}).get("access_duration_hours", 24)
        update["expires_at"] = datetime.utcnow() + timedelta(hours=hours)
    await db.access_requests.update_one({"_id": ObjectId(request_id)}, {"$set": update})
    doc = await db.access_requests.find_one({"_id": ObjectId(request_id)})
    doc["_id"] = str(doc["_id"])
    return doc

async def get_all_requests_for_patient(patient_id: str) -> list:
    db = get_db()
    cursor = db.access_requests.find({"patient_id": patient_id}).sort("requested_at", -1)
    reqs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        reqs.append(doc)
    return reqs

async def get_pending_requests(patient_id: str) -> list:
    db = get_db()
    cursor = db.access_requests.find({"patient_id": patient_id, "status": "pending"})
    reqs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        reqs.append(doc)
    return reqs

async def check_access(doctor_id: str, patient_id: str) -> bool:
    db = get_db()
    doc = await db.access_requests.find_one({
        "doctor_id": doctor_id, "patient_id": patient_id, "status": "approved"
    })
    if not doc:
        return False
    if doc.get("expires_at") and doc["expires_at"] < datetime.utcnow():
        await db.access_requests.update_one({"_id": doc["_id"]}, {"$set": {"status": "revoked"}})
        return False
    return True
