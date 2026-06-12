from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class CaregiverLink(BaseModel):
    caregiver_user_id: str
    patient_user_id: str
    relationship: Optional[str] = None
    language_preference: str = "tamil"
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CaregiverLinkRequest(BaseModel):
    patient_user_id: str
    relationship: Optional[str] = None
    language_preference: str = "tamil"
