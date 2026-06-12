from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class AccessStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    revoked = "revoked"

class AccessRequest(BaseModel):
    doctor_id: str
    patient_id: str
    reason: Optional[str] = None
    hospital: Optional[str] = None
    doctor_name: Optional[str] = None
    department: Optional[str] = None
    requested_records: Optional[List[str]] = None
    access_duration_hours: Optional[int] = 24
    status: AccessStatus = AccessStatus.pending
    requested_at: datetime = Field(default_factory=datetime.utcnow)
    responded_at: Optional[datetime] = None
    responded_by: Optional[str] = None
    expires_at: Optional[datetime] = None

class AccessRequestCreate(BaseModel):
    patient_id: str
    reason: Optional[str] = None
    hospital: Optional[str] = None
    doctor_name: Optional[str] = None
    department: Optional[str] = None
    requested_records: Optional[List[str]] = None
    access_duration_hours: Optional[int] = 24

class AccessResponse(BaseModel):
    request_id: str
    status: AccessStatus
