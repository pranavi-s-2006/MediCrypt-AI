from fastapi import APIRouter, HTTPException, Depends
from routes.auth_routes import get_current_user
from services.consent_service import respond_to_request, get_all_requests_for_patient
from services.audit_service import log_action, get_audit_logs
from models.access_request_model import AccessResponse
from config.database import get_db

router = APIRouter(prefix="/caregiver", tags=["caregiver"])

@router.get("/pending-requests")
async def get_requests(current_user: dict = Depends(get_current_user)):
    db = get_db()
    caregiver_links = db.caregivers.find({"caregiver_user_id": current_user["sub"], "is_active": True})
    patient_ids = [link["patient_user_id"] async for link in caregiver_links]
    all_requests = []
    for pid in patient_ids:
        reqs = await get_all_requests_for_patient(pid)
        all_requests.extend(reqs)
    return {"requests": all_requests}

@router.post("/respond")
async def respond(data: AccessResponse, current_user: dict = Depends(get_current_user)):
    result = await respond_to_request(data.request_id, data.status, current_user["sub"])
    await log_action(
        current_user["sub"],
        f"access_{data.status}",
        "access_requests",
        data.request_id,
        details={
            "hospital": result.get("hospital"),
            "doctor_name": result.get("doctor_name"),
            "department": result.get("department"),
            "patient_id": result.get("patient_id"),
            "expires_at": str(result.get("expires_at", "")),
        }
    )
    return result

@router.get("/patients")
async def get_my_patients(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.caregivers.find({"caregiver_user_id": current_user["sub"], "is_active": True})
    patients = []
    async for link in cursor:
        link["_id"] = str(link["_id"])
        patients.append(link)
    return {"patients": patients}

@router.get("/audit-logs")
async def get_caregiver_audit_logs(current_user: dict = Depends(get_current_user)):
    logs = await get_audit_logs(limit=100)
    my_logs = [l for l in logs if l.get("user_id") == current_user["sub"]]
    return {"logs": my_logs}
