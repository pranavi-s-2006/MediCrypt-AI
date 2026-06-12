from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models.user_model import UserCreate, UserLogin
from services.auth_service import register_user, login_user, create_access_token, decode_token
from services.audit_service import log_action
from config.database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload

@router.post("/register")
async def register(user: UserCreate):
    result = await register_user(user.model_dump())
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    await log_action(result["_id"], "register", "users", result["_id"])

    # Auto-create a blank emergency profile for patients so the QR page
    # never hits a hard "not found" error — patient fills details later.
    if result.get("role") == "patient":
        from datetime import datetime
        db = get_db()
        await db.emergency_profiles.insert_one({
            "patient_id":             result["_id"],
            "patient_name":           result["name"],
            "blood_group":            "",
            "allergies":              [],
            "chronic_diseases":       [],
            "current_medicines":      [],
            "emergency_contact_name": "",
            "emergency_contact_number": "",
            "qr_code_path":           None,
            "summary":                None,
            "last_updated":           datetime.utcnow(),
        })

    token = create_access_token({"sub": result["_id"], "role": result["role"], "email": result["email"]})
    return {"access_token": token, "token_type": "bearer", "user": {
        "id": result["_id"], "name": result["name"], "email": result["email"], "role": result["role"]
    }}

@router.post("/login")
async def login(data: UserLogin):
    user = await login_user(data.email, data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await log_action(user["_id"], "login", "users", user["_id"])
    token = create_access_token({"sub": user["_id"], "role": user["role"], "email": user["email"]})
    return {"access_token": token, "token_type": "bearer", "user": {
        "id": user["_id"], "name": user["name"], "email": user["email"], "role": user["role"]
    }}

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    db = get_db()
    from bson import ObjectId
    user = await db.users.find_one({"_id": ObjectId(current_user["sub"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["_id"] = str(user["_id"])
    user.pop("password", None)
    return user
