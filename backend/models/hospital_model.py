from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class Hospital(BaseModel):
    name: str
    address: str
    registration_number: str
    departments: List[str] = []
    admin_user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class HospitalCreate(BaseModel):
    name: str
    address: str
    registration_number: str
    departments: List[str] = []
