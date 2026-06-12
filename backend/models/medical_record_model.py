from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class DocumentType(str, Enum):
    prescription = "prescription"
    lab_report = "lab_report"
    discharge_summary = "discharge_summary"
    scan_report = "scan_report"
    other = "other"

class MedicalRecord(BaseModel):
    patient_id: str
    uploaded_by: str
    document_type: DocumentType = DocumentType.other
    file_path: str
    original_filename: str
    ocr_text: Optional[str] = None
    extracted_medicines: Optional[List[Dict[str, Any]]] = []
    medical_keywords: Optional[List[str]] = []
    risk_level: Optional[str] = None
    risk_alert: Optional[str] = None
    drug_interactions: Optional[List[Dict[str, Any]]] = []
    ai_summary: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
