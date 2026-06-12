# System Architecture

## Overview
MediCrypt Guardian AI is a three-tier full-stack application.

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                        │
│   Patient | Doctor | Admin | Caregiver Dashboards       │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS REST API
┌──────────────────────▼──────────────────────────────────┐
│                  FastAPI Backend                         │
│  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌────────────┐  │
│  │   Auth   │ │ Patient  │ │ Doctor  │ │   AI/Voice │  │
│  │  Routes  │ │  Routes  │ │ Routes  │ │   Routes   │  │
│  └──────────┘ └──────────┘ └─────────┘ └────────────┘  │
│                                                          │
│  ┌─────────────────── AI Agents ───────────────────┐    │
│  │ TrOCR | DeBERTa | Gemini | BioBERT | DDInter   │    │
│  │ Risk Agent | BioGPT | Whisper | MMS-TTS | QR   │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                    MongoDB                               │
│  users | patients | doctors | medical_records |         │
│  prescriptions | access_requests | emergency_profiles   │
└─────────────────────────────────────────────────────────┘
```

## Security Model
- JWT-based authentication (HS256)
- Role-based access control (RBAC)
- Consent-based doctor access (approved/rejected by patient/caregiver)
- Audit logging for all sensitive operations
- Emergency QR exposes minimal necessary data only

## AI Pipeline Flow
```
Image/PDF Upload
      ↓
  TrOCR OCR
      ↓
  DeBERTa Classification (prescription/lab/discharge/scan/other)
      ↓
  Gemini Medicine Extraction (name, dosage, frequency, duration)
      ↓
  BioBERT Medical Keywords
      ↓
  DDInter Drug Interaction Check
      ↓
  Risk Agent (High→Critical, Medium→High, Low→Low)
      ↓
  BioGPT/Gemini Explanation
      ↓
  Saved to MongoDB + Doctor Alert
```
