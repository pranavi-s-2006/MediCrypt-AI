from fastapi import APIRouter, Depends, Query
from routes.auth_routes import get_current_user
from services.audit_service import get_audit_logs

router = APIRouter(prefix="/audit", tags=["audit"])

@router.get("/logs")
async def audit_logs(limit: int = Query(100, le=500), current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["hospital_admin"]:
        # Patients/doctors see only their own logs
        from config.database import get_db
        db = get_db()
        cursor = db.audit_logs.find({"user_id": current_user["sub"]}).sort("timestamp", -1).limit(limit)
        logs = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            logs.append(doc)
        return {"logs": logs}
    logs = await get_audit_logs(limit)
    return {"logs": logs}
