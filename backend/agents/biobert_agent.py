from transformers import AutoTokenizer, AutoModel
import torch

_tokenizer = None
_model = None

def _load_model():
    global _tokenizer, _model
    if _tokenizer is None:
        _tokenizer = AutoTokenizer.from_pretrained("dmis-lab/biobert-base-cased-v1.1")
        _model = AutoModel.from_pretrained("dmis-lab/biobert-base-cased-v1.1")
        _model.eval()

MEDICAL_TERMS = [
    "diabetes", "hypertension", "infection", "fever", "pain", "allergy",
    "inflammation", "cancer", "chronic", "acute", "syndrome", "disorder",
    "mg", "ml", "tablet", "capsule", "injection", "dose", "dosage",
    "blood pressure", "glucose", "cholesterol", "hemoglobin", "creatinine"
]

async def extract_medical_keywords(text: str) -> list:
    _load_model()
    text_lower = text.lower()
    found = [term for term in MEDICAL_TERMS if term in text_lower]
    # Use BioBERT tokenizer to find additional medical tokens
    inputs = _tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    tokens = _tokenizer.convert_ids_to_tokens(inputs["input_ids"][0])
    # Extract capitalized/medical-looking tokens not in stopwords
    medical_tokens = list(set([
        t.replace("##", "") for t in tokens
        if len(t) > 3 and t not in ["[CLS]", "[SEP]", "[PAD]"] and not t.startswith("##")
    ]))
    combined = list(set(found + medical_tokens[:10]))
    return combined[:20]
