from config.database import get_db
from datetime import datetime

async def send_notification(user_id: str, title: str, message: str, notif_type: str = "info"):
    db = get_db()
    await db.notifications.insert_one({
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notif_type,
        "read": False,
        "created_at": datetime.utcnow()
    })

async def get_notifications(user_id: str) -> list:
    db = get_db()
    cursor = db.notifications.find({"user_id": user_id, "read": False}).sort("created_at", -1)
    notifs = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        notifs.append(doc)
    return notifs
