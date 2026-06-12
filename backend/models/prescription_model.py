from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class Medicine(BaseModel):
    name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None

class Prescription(BaseModel):
    patient_id: str
    doctor_id: str
    record_id: Optional[str] = None
    medicines: List[Medicine] = []
    diagnosis: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PrescriptionCreate(BaseModel):
    patient_id: str
    medicines: List[Medicine]
    diagnosis: Optional[str] = None
    notes: Optional[str] = None
