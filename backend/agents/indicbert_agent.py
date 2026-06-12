from transformers import AutoTokenizer, AutoModel
import torch

_tokenizer = None
_model = None

def _load_model():
    global _tokenizer, _model
    if _tokenizer is None:
        _tokenizer = AutoTokenizer.from_pretrained("ai4bharat/IndicBERTv2-MLM-only")
        _model = AutoModel.from_pretrained("ai4bharat/IndicBERTv2-MLM-only")
        _model.eval()

async def process_tamil_text(text: str) -> dict:
    _load_model()
    inputs = _tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        outputs = _model(**inputs)
    # Return embedding summary (mean of last hidden state)
    embedding = outputs.last_hidden_state.mean(dim=1).squeeze().tolist()
    return {
        "processed": True,
        "text": text,
        "language": "tamil",
        "embedding_dim": len(embedding)
    }

async def translate_medical_term_tamil(english_text: str) -> str:
    # Placeholder: In production integrate with translation API
    tamil_map = {
        "take medicine": "மருந்து சாப்பிடுங்கள்",
        "high risk": "அதிக ஆபத்து",
        "drug interaction": "மருந்து தொடர்பு",
        "emergency": "அவசரநிலை",
        "blood group": "இரத்த வகை",
        "allergy": "ஒவ்வாமை",
    }
    for key, val in tamil_map.items():
        if key in english_text.lower():
            return val
    return english_text
