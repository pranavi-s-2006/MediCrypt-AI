# Complete Workflow

## 1. Patient Registration
- Patient registers → role assigned → JWT issued
- Profile setup: blood group, allergies, chronic diseases, emergency contact
- Optional: Add caregiver

## 2. Prescription Upload
- Patient uploads handwritten prescription image
- TrOCR reads text from image
- DeBERTa classifies document type (prescription/lab/etc.)
- Gemini 2.5 Flash extracts structured medicine data
- BioBERT extracts medical keywords
- DDInter API checks all medicine combinations for interactions
- Risk Agent maps interaction severity → alert level

## 3. Doctor Access Flow
- Doctor searches patient by ID
- Sends access request with reason
- Patient or linked Caregiver approves/rejects
- On approval, doctor sees patient's full medical history
- Doctor receives drug interaction alerts on dashboard

## 4. Emergency QR Generation
- Patient clicks "Generate QR"
- System pulls latest profile + active medicines
- Gemini generates a brief emergency summary
- QR code encodes: blood group, allergies, medicines, diseases, contact
- QR is downloadable as PNG

## 5. Tamil Voice Support
- Caregiver/Patient clicks "Tamil Voice"
- Browser captures microphone audio
- Whisper transcribes Tamil/English speech to text
- IndicBERT processes Tamil medical text
- MMS-TTS converts text back to Tamil speech
- Audio plays back via browser

## 6. Hospital Admin Flow
- Admin registers hospital with departments
- Adds/verifies doctors by license number
- Views system-wide audit logs
- Manages doctor access and department structure
