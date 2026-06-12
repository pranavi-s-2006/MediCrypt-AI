"""
Emergency face routes — insightface ArcFace ONNX (prototype/demo).
No TensorFlow. No dlib. Works on Python 3.14.

POST   /emergency/face-register  — patient uploads photo → 512-d embedding stored in MongoDB
GET    /emergency/face-status    — patient checks registration status
DELETE /emergency/face-revoke    — patient deletes their embedding
POST   /emergency/face-scan      — hospital sends webcam frame → returns emergency profile if matched
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Request
from routes.auth_routes import get_current_user
from agents.face_agent import register_face, verify_face
from services.audit_service import log_action
from config.database import get_db
from datetime import datetime

router = APIRouter(prefix="/emergency", tags=["emergency-face"])

MAX_BYTES = 5 * 1024 * 1024   # 5 MB


# ── POST /emergency/face-register ────────────────────────
@router.post("/face-register")
async def face_register(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Patient uploads a clear front-facing photo.
    ArcFace 512-d embedding is extracted and stored in MongoDB.
    Raw photo is never saved to disk.
    """
    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Photo too large. Maximum 5 MB.")

    try:
        embedding = register_face(content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db = get_db()
    await db.face_profiles.update_one(
        {"patient_id": current_user["sub"]},
        {
            "$set": {
                "patient_id":    current_user["sub"],
                "embedding":     embedding,      # 512-d list of floats
                "consented":     True,
                "registered_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )
    await log_action(
        current_user["sub"], "face_register", "face_profiles",
        details={"note": "ArcFace embedding stored for emergency identification"},
    )
    return {"message": "Face registered successfully. You can now be identified in emergencies."}


# ── GET /emergency/face-status ────────────────────────────
@router.get("/face-status")
async def face_status(current_user: dict = Depends(get_current_user)):
    db  = get_db()
    doc = await db.face_profiles.find_one({"patient_id": current_user["sub"]})
    if not doc:
        return {"registered": False, "consented": False}
    return {
        "registered":    True,
        "consented":     doc.get("consented", False),
        "registered_at": doc.get("registered_at"),
    }


# ── DELETE /emergency/face-revoke ─────────────────────────
@router.delete("/face-revoke")
async def face_revoke(current_user: dict = Depends(get_current_user)):
    db = get_db()
    await db.face_profiles.delete_one({"patient_id": current_user["sub"]})
    await log_action(current_user["sub"], "face_revoke", "face_profiles")
    return {"message": "Face data deleted. You will no longer be identifiable by face scan."}


# ── POST /emergency/face-scan — PUBLIC ────────────────────
@router.post("/face-scan")
async def face_scan(
    request: Request,
    file: UploadFile = File(...),
):
    """
    Hospital / emergency responder uploads a webcam frame (JPEG/PNG).
    Probe embedding is extracted, then cosine-compared against every
    consented embedding in face_profiles.
    Returns emergency-only data (no full history) on first match.
    No authentication required — emergency backup path.
    Every attempt is audit-logged with IP address.
    """
    content   = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image too large. Max 5 MB.")

    client_ip = request.client.host if request.client else "unknown"
    db        = get_db()

    # Extract probe embedding once outside the loop
    try:
        from agents.face_agent import _decode, _extract_embedding
        import numpy as np
        probe_img = _decode(content)
        probe_emb = _extract_embedding(probe_img)
    except ValueError as e:
        await log_action(
            "anonymous_responder", "face_scan_no_face", "face_profiles",
            details={"ip": client_ip, "reason": str(e)},
        )
        raise HTTPException(status_code=400, detail=f"No face detected in the uploaded image: {e}")

    from agents.face_agent import COSINE_THRESHOLD
    matched_id = None
    best_dist  = 1.0

    async for doc in db.face_profiles.find({"consented": True}):
        stored = doc.get("embedding")
        if not stored:
            continue
        try:
            stored_arr = np.array(stored, dtype=np.float32)
            probe_n  = probe_emb  / (np.linalg.norm(probe_emb)  + 1e-10)
            stored_n = stored_arr / (np.linalg.norm(stored_arr) + 1e-10)
            dist     = float(1.0 - np.dot(probe_n, stored_n))
            if dist <= COSINE_THRESHOLD and dist < best_dist:
                best_dist  = dist
                matched_id = doc["patient_id"]
        except Exception:
            continue

    if not matched_id:
        await log_action(
            "anonymous_responder", "face_scan_failed", "face_profiles",
            details={"ip": client_ip},
        )
        raise HTTPException(
            status_code=404,
            detail="No matching patient found. Please use the Emergency QR code instead.",
        )

    profile = await db.emergency_profiles.find_one({"patient_id": matched_id})
    if not profile or not profile.get("blood_group"):
        raise HTTPException(
            status_code=404,
            detail="Patient identified but emergency profile is incomplete.",
        )

    confidence = round(max(0.0, (1.0 - best_dist / COSINE_THRESHOLD)) * 100, 1)

    await log_action(
        "anonymous_responder", "face_scan_success", "face_profiles",
        resource_id=matched_id,
        details={"distance": round(best_dist, 4), "confidence": confidence, "ip": client_ip},
    )

    return {
        "identified":               True,
        "confidence":               confidence,
        "patient_name":             profile.get("patient_name", "Unknown"),
        "blood_group":              profile.get("blood_group", "Unknown"),
        "allergies":                profile.get("allergies", []),
        "current_medicines":        profile.get("current_medicines", []),
        "chronic_diseases":         profile.get("chronic_diseases", []),
        "emergency_contact_name":   profile.get("emergency_contact_name", ""),
        "emergency_contact_number": profile.get("emergency_contact_number", ""),
        "last_updated":             profile["last_updated"].isoformat() if profile.get("last_updated") else None,
    }
