from config.database import get_db
from datetime import datetime

async def log_action(user_id: str, action: str, resource: str, resource_id: str = None, details: dict = None, ip: str = None):
    db = get_db()
    await db.audit_logs.insert_one({
        "user_id": user_id,
        "action": action,
        "resource": resource,
        "resource_id": resource_id,
        "details": details or {},
        "ip_address": ip,
        "timestamp": datetime.utcnow()
    })

async def get_audit_logs(limit: int = 100) -> list:
    db = get_db()
    cursor = db.audit_logs.find().sort("timestamp", -1).limit(limit)
    logs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        logs.append(doc)
    return logs
