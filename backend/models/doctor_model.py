from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class DoctorProfile(BaseModel):
    user_id: str
    specialization: Optional[str] = None
    license_number: str
    hospital_id: Optional[str] = None
    department: Optional[str] = None
    is_verified: bool = False
    verified_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DoctorVerify(BaseModel):
    doctor_id: str
    is_verified: bool
