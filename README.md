# MediCrypt Guardian AI

A full-stack agentic healthcare platform that creates a secure lifelong medical identity for patients. It handles prescription OCR, AI-powered drug interaction detection, doctor-patient consent workflows, emergency QR access, and biometric face identification for first responders.

---

## Features

- **Prescription OCR** — TrOCR extracts text from handwritten/printed prescriptions (JPG, PNG, PDF)
- **AI Medicine Extraction** — Gemini AI extracts medicine name, dosage, timing, duration, food instructions
- **Drug Interaction Detection** — DDInter database checks all drug-drug combinations with severity levels
- **Risk Engine** — Rule-based engine classifies risk as Low / Medium / High / Critical with a percentage score
- **Prescription Comparison** — Compare old vs new prescriptions, detect conflicts, allergy clashes, duplicates
- **Emergency QR Code** — Patient generates a QR code; first responders scan it with no login required
- **Emergency Face ID** — ArcFace ONNX biometric identification for unconscious patients
- **Doctor Queue System** — Hospital check-in → consent → queue → consultation → prescription → complete
- **Role-based Access** — Patient, Doctor, Hospital Admin, Caregiver — each with scoped dashboards
- **Consent & Audit** — Every record access is logged with user, timestamp, IP; patients approve all access
- **Caregiver Support** — Caregivers can monitor patient records and respond to access requests

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Python 3.14 + FastAPI + Uvicorn |
| Database | MongoDB (Motor async driver) |
| OCR | Microsoft TrOCR (`trocr-base-handwritten`) + PyMuPDF (PDF→PNG) |
| AI Extraction | Google Gemini 2.0 Flash (with offline DDInter fallback) |
| Drug Interactions | DDInter CSV database (local, no API needed) |
| Face Recognition | InsightFace ArcFace ONNX (`buffalo_sc`) via OpenCV |
| QR Code | `qrcode` library |
| Auth | JWT (python-jose) + bcrypt |

---

## Project Structure

```
medicrypt-guardian-ai/
├── backend/
│   ├── agents/
│   │   ├── ocr_agent.py              # TrOCR OCR (image + PDF)
│   │   ├── gemini_agent.py           # Gemini medicine extraction + summaries
│   │   ├── medicine_extractor.py     # Offline DDInter-based fallback extractor
│   │   ├── ddinter_agent.py          # Drug interaction checker (local CSV)
│   │   ├── risk_agent.py             # Risk level + percentage calculator
│   │   ├── drug_safety_agent.py      # Full safety check (interactions + timing + allergies)
│   │   ├── face_agent.py             # ArcFace biometric registration + verification
│   │   ├── qr_agent.py               # Emergency QR code generator
│   │   ├── biobert_agent.py          # Medical keyword extraction
│   │   ├── biogpt_agent.py           # Medical explanation generator
│   │   ├── deberta_document_agent.py # Document type classifier
│   │   └── indicbert_agent.py        # Indian language processing
│   ├── routes/
│   │   ├── auth_routes.py            # Register, login, /me
│   │   ├── patient_routes.py         # Profile, upload, history, access requests
│   │   ├── doctor_routes.py          # Profile, access, prescriptions, drug alerts
│   │   ├── hospital_routes.py        # Hospital admin, doctor verification
│   │   ├── caregiver_routes.py       # Caregiver dashboard
│   │   ├── ai_routes.py              # OCR, compare prescriptions, drug check
│   │   ├── emergency_routes.py       # QR profile, scan endpoint (public)
│   │   ├── face_routes.py            # Face register, scan, revoke
│   │   ├── queue_routes.py           # Doctor queue management
│   │   └── audit_routes.py           # Audit log retrieval
│   ├── models/                       # Pydantic data models
│   ├── services/                     # Auth, audit, consent, patient, doctor services
│   ├── config/                       # Settings, MongoDB connection
│   ├── utils/
│   │   └── pdf_converter.py          # PyMuPDF PDF → PIL images
│   ├── database/
│   │   └── ddinter.csv               # Drug interaction database
│   ├── main.py                       # FastAPI app + CORS + timeout middleware
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/                    # All role dashboards and feature pages
│       ├── components/               # Reusable UI components
│       ├── services/api.js           # Axios API client
│       └── routes/AppRoutes.jsx      # Role-based routing + guards
└── README.md
```

---

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- Google Gemini API key ([get one free](https://aistudio.google.com/app/apikey))

### Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

Create `backend/.env`:
```
MONGO_URI=mongodb://localhost:27017
DATABASE_NAME=medicrypt_guardian_ai
SECRET_KEY=your_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
GEMINI_API_KEY=your_gemini_api_key_here
OCR_MODEL=microsoft/trocr-base-handwritten
DDINTER_DATA_PATH=database/ddinter.csv
RISK_AGENT=rule_engine
UPLOAD_DIR=uploads
QR_OUTPUT_DIR=generated/qr_codes
```

Start the server:
```bash
uvicorn main:app --reload --port 8000
```

> **Note:** TrOCR and InsightFace models download automatically on first run (~500 MB total). Subsequent starts are instant.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`, API at `http://localhost:8000`.

---

## AI Pipeline

```
Patient uploads prescription (JPG / PNG / PDF)
        │
        ▼
  PyMuPDF (PDF → PNG pages)
        │
        ▼
  TrOCR  ──────────────────────────► Extracted text
        │
        ▼
  Gemini 2.0 Flash ─── (503 fallback) ──► Offline DDInter matcher
  extracts: name, dosage, timing,          matches drug names from
  duration, before/after food              OCR text against CSV
        │
        ▼
  DDInter CSV lookup (local, no API)
  checks all drug-drug pairs
        │
        ▼
  Risk Engine (rule-based)
  Low 0–30% / Medium 31–60% / High 61–85% / Critical 86–100%
        │
        ▼
  Gemini generates doctor safety report
        │
        ▼
  Results saved to MongoDB medical_records
  Doctor dashboard shows risk alert
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register (patient/doctor/hospital_admin/caregiver) |
| POST | `/auth/login` | Login → JWT token |
| GET | `/auth/me` | Current user info |

### Patient
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patient/profile` | Get patient profile |
| PUT | `/patient/profile` | Update profile |
| POST | `/patient/upload-prescription` | Upload + full AI pipeline |
| GET | `/patient/history` | Medical record history |
| GET | `/patient/access-requests` | View hospital/doctor access requests |
| POST | `/patient/respond-access` | Approve or reject access |

### Doctor
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/doctor/profile` | Get or save doctor profile |
| POST | `/doctor/request-access` | Request patient record access |
| GET | `/doctor/approved-patients` | List approved patients |
| GET | `/doctor/patient-records/{id}` | View patient records |
| POST | `/doctor/analyze-prescription` | Full safety analysis pipeline |
| POST | `/doctor/accept-prescription/{id}` | Accept analyzed prescription |
| POST | `/doctor/override-prescription/{id}` | Override with documented reason |
| GET | `/doctor/drug-alerts` | High/Critical risk alerts |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ai/ocr` | TrOCR OCR only |
| POST | `/ai/compare-prescriptions` | Compare old vs new prescriptions |
| POST | `/ai/check-drug-interaction` | DDInter + risk check |
| POST | `/ai/retry-ocr/{id}` | Retry failed OCR pipeline |

### Emergency
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/emergency/create-profile` | Create emergency profile |
| GET | `/emergency/profile` | Get own emergency profile |
| PUT | `/emergency/update-profile` | Update emergency profile |
| POST | `/emergency/generate-qr` | Generate emergency QR |
| GET | `/emergency/qr-image` | Download QR image |
| GET | `/emergency/scan/{patient_id}` | **Public** — scan QR, returns critical data |
| POST | `/emergency/face-register` | Register face embedding |
| GET | `/emergency/face-status` | Check face registration status |
| DELETE | `/emergency/face-revoke` | Delete face data |
| POST | `/emergency/face-scan` | **Public** — identify patient by face |

### Queue
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/queue/add` | Add patient to doctor queue |
| POST | `/queue/send-file` | Send patient file to doctor |
| POST | `/queue/upload-report` | Upload lab report / prescription / payment |
| POST | `/queue/complete` | End consultation, revoke access |
| GET | `/queue/doctor` | Doctor's current queue |
| GET | `/queue/patient-records/{queue_id}` | Records for active consultation |
| POST | `/queue/save-prescription` | Save consultation prescription |

### Audit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/audit/logs` | Retrieve audit logs |

---

## Roles & Permissions

| Role | Can Do |
|------|--------|
| **Patient** | View own records, manage emergency profile, approve/reject access, add caregivers |
| **Doctor** | Request patient access, analyze prescriptions, write prescriptions, view drug alerts |
| **Hospital Admin** | Verify doctors, manage appointment flow, upload reports, view audit logs |
| **Caregiver** | View linked patient records, respond to access requests on patient's behalf |

---

## MongoDB Collections

| Collection | Purpose |
|------------|---------|
| `users` | All users with hashed passwords |
| `patients` | Patient profiles, allergies, medicines |
| `doctors` | Doctor profiles, verification status |
| `hospitals` | Hospital records |
| `caregivers` | Patient-caregiver links |
| `medical_records` | Uploaded files + AI analysis results |
| `prescriptions` | Doctor-written prescriptions |
| `hospital_access` | Consent records for hospital/doctor access |
| `doctor_queues` | Appointment queue entries |
| `emergency_profiles` | Emergency QR data (blood group, allergies, etc.) |
| `face_profiles` | ArcFace 512-d embeddings (no photos stored) |
| `audit_logs` | Immutable access trail |

---

## Security

- All endpoints (except `/emergency/scan` and `/emergency/face-scan`) require JWT authentication
- Passwords hashed with bcrypt
- Patient record access requires explicit consent approval
- Every access logged with user ID, action, timestamp, IP address
- Face embeddings stored as 512-d mathematical vectors — raw photos never saved
- CORS restricted to `localhost:5173` and `localhost:3000`
