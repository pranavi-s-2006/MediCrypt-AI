# AI Model Details

## 1. microsoft/trocr-base-handwritten
- **Task**: Handwritten prescription OCR
- **Input**: Prescription image (PIL Image)
- **Output**: Extracted text string
- **Pipeline**: TrOCRProcessor + VisionEncoderDecoderModel

## 2. dmis-lab/biobert-base-cased-v1.1
- **Task**: Medical term keyword extraction
- **Input**: Medical report text
- **Output**: List of medical keywords
- **Pipeline**: AutoTokenizer + AutoModel (embeddings + term matching)

## 3. Gemini 2.5 Flash (google/generativeai)
- **Task**: Medicine extraction + risk explanation + emergency summary
- **Input**: OCR text / interaction data
- **Output**: JSON medicine list / natural language explanation
- **API**: google.generativeai SDK

## 4. DDInter API + Local Fallback
- **Task**: Drug-drug interaction detection
- **Input**: List of medicine names
- **Output**: Interaction pairs with severity level and description
- **Fallback**: Local JSON knowledge base

## 5. Risk Agent (Rule Engine)
- **Task**: Risk level classification
- **Logic**:
  - High interaction → alert: "Critical"
  - Medium interaction → alert: "High"
  - Low/No interaction → alert: "Low"

## 6. microsoft/biogpt
- **Task**: Medical explanation generation for doctors
- **Input**: Medicine list + interactions + risk level
- **Output**: Natural language medical explanation
- **Pipeline**: text-generation pipeline

## 7. microsoft/deberta-v3-base
- **Task**: Document type classification
- **Input**: Document text
- **Output**: prescription / lab_report / discharge_summary / scan_report / other
- **Pipeline**: zero-shot-classification

## 8. ai4bharat/IndicBERTv2-MLM-only
- **Task**: Tamil/Indian language text processing
- **Input**: Tamil text
- **Output**: Processed result + embeddings

## 9. openai/whisper-base
- **Task**: Speech-to-text (Tamil + English)
- **Input**: Audio file (WAV)
- **Output**: Transcribed text + detected language

## 10. facebook/mms-tts-tam
- **Task**: Tamil text-to-speech
- **Input**: Tamil text
- **Output**: WAV audio bytes
- **Pipeline**: VitsModel + AutoTokenizer

## 11. AI4Bharat Indic-TTS
- **Task**: Alternative Indian language TTS
- **Input**: Text + language code
- **Output**: Audio bytes (via API)
- **Fallback**: Used when MMS-TTS fails

## 12. qrcode (Python package)
- **Task**: Emergency QR code generation
- **Input**: Patient emergency profile dict
- **Output**: PNG QR code image
- **Data**: Blood group, allergies, medicines, diseases, emergency contact
