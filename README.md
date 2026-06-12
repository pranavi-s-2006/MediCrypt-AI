# MediCrypt Guardian AI

An agentic healthcare memory and drug safety network. Creates a secure lifelong medical identity for patients, stores medical records, supports doctor access with consent, detects drug-drug interactions, supports Tamil voice for elderly users, and generates emergency QR access.

## Stack
- **Frontend**: React.js + Tailwind CSS (Vite)
- **Backend**: Python FastAPI
- **Database**: MongoDB (Motor async driver)

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB (local or Atlas)

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
cp .env .env.local  # Edit with your API keys
uvicorn main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables (backend/.env)
```
MONGO_URI=mongodb://localhost:27017
GEMINI_API_KEY=your_key_here
DDINTER_API_KEY=your_key_here (optional)
AI4BHARAT_API_KEY=your_key_here (optional)
```

## AI Models Used

| Model | Function |
|-------|----------|
| microsoft/trocr-base-handwritten | Handwritten prescription OCR |
| dmis-lab/biobert-base-cased-v1.1 | Medical keyword extraction |
| Gemini 2.5 Flash | Medicine extraction + summaries |
| DDInter API | Drug-drug interaction checking |
| Risk Agent (rule engine) | Risk level classification |
| microsoft/biogpt | Medical explanations for doctors |
| microsoft/deberta-v3-base | Document type classification |
| ai4bharat/IndicBERTv2-MLM-only | Tamil/Indian language processing |
| openai/whisper-base | Speech-to-text (Tamil/English) |
| facebook/mms-tts-tam | Tamil text-to-speech |
| AI4Bharat Indic-TTS | Alternative Indian TTS |
| qrcode | Emergency QR generation |

## API Endpoints

### Auth
- `POST /auth/register` — Register user
- `POST /auth/login` — Login
- `GET /auth/me` — Current user

### Patient
- `GET /patient/profile` — Get profile
- `PUT /patient/profile` — Update profile
- `POST /patient/upload` — Upload file
- `GET /patient/history` — Medical history
- `POST /patient/add-caregiver` — Add caregiver

### Doctor
- `GET /doctor/profile` — Doctor profile
- `POST /doctor/request-access` — Request patient access
- `GET /doctor/approved-patients` — List approved patients
- `GET /doctor/patient-records/{id}` — View patient records
- `POST /doctor/add-prescription` — Add prescription
- `GET /doctor/drug-alerts` — Drug interaction alerts

### AI Pipeline
- `POST /ai/ocr` — TrOCR image OCR
- `POST /ai/process-prescription` — Full AI pipeline
- `POST /ai/extract-medicine` — Gemini medicine extraction
- `POST /ai/classify-document` — DeBERTa classification
- `POST /ai/check-drug-interaction` — DDInter + risk
- `POST /ai/risk-alert` — Risk level assessment
- `POST /ai/emergency-summary` — Emergency summary
- `POST /ai/extract-keywords` — BioBERT keywords

### Voice
- `POST /voice/speech-to-text` — Whisper STT
- `POST /voice/text-to-speech` — MMS-TTS Tamil

### Emergency
- `POST /emergency/generate-qr` — Generate QR
- `GET /emergency/qr-image` — Get QR image
- `GET /emergency/profile` — Emergency profile

### Audit
- `GET /audit/logs` — System audit logs

## MongoDB Collections
- `users` — All users (patients, doctors, admins, caregivers)
- `patients` — Patient profiles
- `doctors` — Doctor profiles
- `hospitals` — Hospital records
- `caregivers` — Caregiver links
- `medical_records` — Uploaded medical records with AI analysis
- `prescriptions` — Doctor-added prescriptions
- `access_requests` — Doctor access requests
- `emergency_profiles` — Emergency QR data
- `audit_logs` — System audit trail
- `notifications` — User notifications

## Workflow
```
Patient uploads prescription
→ TrOCR extracts text
→ DeBERTa classifies document type
→ Gemini extracts medicine details
→ BioBERT extracts medical keywords
→ DDInter checks drug interactions
→ Risk Agent assigns alert level
→ BioGPT/Gemini explains risk
→ Doctor dashboard shows alert
→ Patient/caregiver approves access
→ Emergency QR generated
→ Whisper + Tamil TTS for elderly users
```
