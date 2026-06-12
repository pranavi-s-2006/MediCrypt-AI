from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import FileResponse
from routes.auth_routes import get_current_user
from agents.qr_agent import generate_emergency_qr
from agents.gemini_agent import generate_emergency_summary
from services.audit_service import log_action
from models.emergency_profile_model import EmergencyProfileCreate, EmergencyProfileUpdate
from config.database import get_db
from config import settings
from datetime import datetime
import os

router = APIRouter(prefix="/emergency", tags=["emergency"])


def _serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


async def _build_qr(patient_id: str, request: Request) -> str:
    """Generate QR PNG and return file path. QR encodes only the scan URL."""
    base = str(request.base_url).rstrip("/")
    return generate_emergency_qr(patient_id, base)


# ── POST /emergency/create-profile ───────────────────────
@router.post("/create-profile")
async def create_profile(
    data: EmergencyProfileCreate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    existing = await db.emergency_profiles.find_one({"patient_id": current_user["sub"]})

    qr_path  = await _build_qr(current_user["sub"], request)
    summary  = await generate_emergency_summary({
        "blood_group":      data.blood_group,
        "allergies":        data.allergies,
        "current_medicines": data.current_medicines,
        "chronic_diseases": data.chronic_diseases,
    })

    doc = {
        "patient_id":             current_user["sub"],
        "patient_name":           data.patient_name,
        "blood_group":            data.blood_group,
        "allergies":              data.allergies,
        "chronic_diseases":       data.chronic_diseases,
        "current_medicines":      data.current_medicines,
        "emergency_contact_name": data.emergency_contact_name,
        "emergency_contact_number": data.emergency_contact_number,
        "qr_code_path":           qr_path,
        "summary":                summary,
        "last_updated":           datetime.utcnow(),
    }

    if existing:
        # Auto-created blank shell on registration — just fill it in
        await db.emergency_profiles.update_one(
            {"patient_id": current_user["sub"]},
            {"$set": doc}
        )
        updated = await db.emergency_profiles.find_one({"patient_id": current_user["sub"]})
        updated["_id"] = str(updated["_id"])
        await log_action(current_user["sub"], "create_emergency_profile", "emergency_profiles", updated["_id"])
        return updated

    result = await db.emergency_profiles.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    await log_action(current_user["sub"], "create_emergency_profile", "emergency_profiles", doc["_id"])
    return doc


# ── GET /emergency/profile ────────────────────────────────
# Returns null when no profile exists — frontend shows "Create Profile" form.
# Returns the doc (even if fields are blank) when auto-created on registration.
@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    db  = get_db()
    doc = await db.emergency_profiles.find_one({"patient_id": current_user["sub"]})
    if not doc:
        return None
    serialized = _serialize(doc)
    # If this is a blank auto-created shell (no blood group filled yet),
    # still return it so the frontend shows the edit/fill form, not an error.
    return serialized


# ── PUT /emergency/update-profile ────────────────────────
@router.put("/update-profile")
async def update_profile(
    data: EmergencyProfileUpdate,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    db  = get_db()
    doc = await db.emergency_profiles.find_one({"patient_id": current_user["sub"]})
    if not doc:
        raise HTTPException(status_code=404, detail="No emergency profile found. Create one first.")

    updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
    updates["last_updated"] = datetime.utcnow()

    # Regenerate QR and summary if any clinical field changed
    clinical = {"blood_group", "allergies", "current_medicines", "chronic_diseases",
                "emergency_contact_name", "emergency_contact_number"}
    if updates.keys() & clinical:
        updates["qr_code_path"] = await _build_qr(current_user["sub"], request)
        merged = {**doc, **updates}
        updates["summary"] = await generate_emergency_summary({
            "blood_group":       merged.get("blood_group"),
            "allergies":         merged.get("allergies", []),
            "current_medicines": merged.get("current_medicines", []),
            "chronic_diseases":  merged.get("chronic_diseases", []),
        })

    await db.emergency_profiles.update_one(
        {"patient_id": current_user["sub"]},
        {"$set": updates}
    )
    updated = await db.emergency_profiles.find_one({"patient_id": current_user["sub"]})
    await log_action(current_user["sub"], "update_emergency_profile", "emergency_profiles")
    return _serialize(updated)


# ── POST /emergency/generate-qr ──────────────────────────
@router.post("/generate-qr")
async def generate_qr(request: Request, current_user: dict = Depends(get_current_user)):
    db  = get_db()
    doc = await db.emergency_profiles.find_one({"patient_id": current_user["sub"]})
    if not doc:
        raise HTTPException(status_code=404, detail="No emergency profile. Create one first.")
    if not doc.get("blood_group"):
        raise HTTPException(status_code=400, detail="Please complete your emergency profile before generating a QR code.")

    qr_path = await _build_qr(current_user["sub"], request)
    await db.emergency_profiles.update_one(
        {"patient_id": current_user["sub"]},
        {"$set": {"qr_code_path": qr_path, "last_updated": datetime.utcnow()}}
    )
    updated = await db.emergency_profiles.find_one({"patient_id": current_user["sub"]})
    await log_action(current_user["sub"], "generate_qr", "emergency_profiles")
    return _serialize(updated)


# ── GET /emergency/qr-image ──────────────────────────────
@router.get("/qr-image")
async def get_qr_image(current_user: dict = Depends(get_current_user)):
    db  = get_db()
    doc = await db.emergency_profiles.find_one({"patient_id": current_user["sub"]})
    if not doc or not doc.get("qr_code_path"):
        raise HTTPException(status_code=404, detail="QR not generated yet.")
    if not os.path.exists(doc["qr_code_path"]):
        raise HTTPException(status_code=404, detail="QR image file missing — regenerate.")
    return FileResponse(doc["qr_code_path"], media_type="image/png",
                        headers={"Content-Disposition": "attachment; filename=emergency-qr.png"})


# ── GET /emergency/scan/{patient_id} — PUBLIC (no auth) ──
# Called when a first responder scans the QR code.
# Returns ONLY minimum life-saving data. No prescriptions, records, or notes.
@router.get("/scan/{patient_id}")
async def scan_emergency(patient_id: str):
    db  = get_db()
    doc = await db.emergency_profiles.find_one({"patient_id": patient_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No emergency profile found for this patient.")

    # Log the scan (no user — anonymous responder)
    try:
        await log_action("anonymous_responder", "emergency_scan", "emergency_profiles", patient_id)
    except Exception:
        pass

    return {
        "patient_name":             doc.get("patient_name", "Unknown"),
        "blood_group":              doc.get("blood_group", "Unknown"),
        "allergies":                doc.get("allergies", []),
        "current_medicines":        doc.get("current_medicines", []),
        "chronic_diseases":         doc.get("chronic_diseases", []),
        "emergency_contact_name":   doc.get("emergency_contact_name", ""),
        "emergency_contact_number": doc.get("emergency_contact_number", ""),
        "last_updated":             doc.get("last_updated", "").isoformat() if doc.get("last_updated") else None,
    }


# ── Internal helper — called by patient_routes after upload ──
async def auto_update_medicines(patient_id: str, medicines: list):
    """
    Called automatically when a new prescription is processed.
    Updates current_medicines in the emergency profile if it exists.
    """
    db  = get_db()
    doc = await db.emergency_profiles.find_one({"patient_id": patient_id})
    if not doc:
        return  # no profile yet — nothing to update
    med_names = list({
        m.get("name", str(m)) if isinstance(m, dict) else str(m)
        for m in medicines if m
    })
    await db.emergency_profiles.update_one(
        {"patient_id": patient_id},
        {"$set": {"current_medicines": med_names, "last_updated": datetime.utcnow()}}
    )
