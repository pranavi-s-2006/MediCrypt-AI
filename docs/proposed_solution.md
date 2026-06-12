# Proposed Solution

## Core Architecture
MediCrypt Guardian AI is a consent-driven, AI-powered medical record platform with the following key design decisions:

### 1. Lifelong Medical Identity
Each patient gets a persistent profile in MongoDB storing blood group, allergies, chronic diseases, and emergency contacts. This profile is the root of all medical operations.

### 2. Agentic AI Pipeline
Every uploaded prescription triggers a 7-step agentic pipeline:
- OCR (TrOCR) → Classify (DeBERTa) → Extract (Gemini) → Keywords (BioBERT) → Interactions (DDInter) → Risk (Rule Engine) → Explain (BioGPT/Gemini)

### 3. Consent-Based Access Control
Doctors request access per patient. Patients or their caregivers approve/reject. All access is logged in audit trail. Doctor sees only approved patient records.

### 4. Emergency-First Design
Emergency QR encodes only life-critical data (blood group, allergies, active medicines, emergency contact). No login required to scan — designed for first responders.

### 5. Tamil Voice Accessibility
Whisper STT + MMS-TTS Tamil enables elderly/rural patients to interact fully in spoken Tamil without needing to read or type. Caregivers can manage everything by voice.

### 6. Role-Based Dashboards
Four distinct UIs (Patient, Doctor, Hospital Admin, Caregiver) with RBAC enforced both in FastAPI routes and React route guards.

## Technology Choices
- **FastAPI** — async, auto-docs, type-safe, ideal for ML model serving
- **Motor (async MongoDB)** — non-blocking DB for high-concurrency AI workloads
- **HuggingFace Transformers** — unified interface for all 8 local AI models
- **Gemini 2.5 Flash** — fast, cost-effective for extraction and summarization
- **React + Tailwind** — rapid UI development with utility-first CSS
- **Vite** — fast frontend dev server with HMR
