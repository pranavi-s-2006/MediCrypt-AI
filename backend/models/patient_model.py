from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class PatientProfile(BaseModel):
    user_id: str
    blood_group: Optional[str] = None
    allergies: List[str] = []
    chronic_diseases: List[str] = []
    emergency_contact: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    caregivers: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PatientProfileUpdate(BaseModel):
    blood_group: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_diseases: Optional[List[str]] = None
    emergency_contact: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None
