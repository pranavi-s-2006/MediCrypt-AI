from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class EmergencyProfileCreate(BaseModel):
    patient_name:             str
    blood_group:              str
    allergies:                List[str] = []
    chronic_diseases:         List[str] = []
    current_medicines:        List[str] = []
    emergency_contact_name:   str
    emergency_contact_number: str


class EmergencyProfileUpdate(BaseModel):
    patient_name:             Optional[str]       = None
    blood_group:              Optional[str]       = None
    allergies:                Optional[List[str]] = None
    chronic_diseases:         Optional[List[str]] = None
    current_medicines:        Optional[List[str]] = None
    emergency_contact_name:   Optional[str]       = None
    emergency_contact_number: Optional[str]       = None
