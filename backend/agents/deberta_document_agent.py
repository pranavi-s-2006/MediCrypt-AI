from transformers import pipeline

_classifier = None
LABELS = ["prescription", "lab_report", "discharge_summary", "scan_report", "other"]

def _load_model():
    global _classifier
    if _classifier is None:
        _classifier = pipeline(
            "zero-shot-classification",
            model="microsoft/deberta-v3-base",
            device=-1
        )

async def classify_document(text: str) -> dict:
    _load_model()
    candidate_labels = [
        "medical prescription with medicines and dosage",
        "laboratory test report with blood or urine results",
        "hospital discharge summary",
        "radiology or scan report like MRI CT or X-ray",
        "other medical document"
    ]
    result = _classifier(text[:512], candidate_labels=candidate_labels)
    label_map = {
        "medical prescription with medicines and dosage": "prescription",
        "laboratory test report with blood or urine results": "lab_report",
        "hospital discharge summary": "discharge_summary",
        "radiology or scan report like MRI CT or X-ray": "scan_report",
        "other medical document": "other"
    }
    top_label = result["labels"][0]
    return {
        "document_type": label_map.get(top_label, "other"),
        "confidence": round(result["scores"][0], 3)
    }
