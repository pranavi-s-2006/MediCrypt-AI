from transformers import pipeline
import torch

_generator = None

def _load_model():
    global _generator
    if _generator is None:
        _generator = pipeline(
            "text-generation",
            model="microsoft/biogpt",
            torch_dtype=torch.float32,
            device=-1
        )

async def generate_medical_explanation(medicines: list, interactions: list, risk: str) -> str:
    _load_model()
    med_names = ", ".join([m.get("name", "") for m in medicines])
    inter_desc = "; ".join([f"{i['drug_a']} + {i['drug_b']}: {i['description']}" for i in interactions])

    prompt = f"The patient is taking {med_names}. Drug interactions: {inter_desc}. Risk level: {risk}. Medical explanation:"
    result = _generator(prompt, max_new_tokens=100, do_sample=False)
    generated = result[0]["generated_text"]
    # Return only the new text after the prompt
    return generated[len(prompt):].strip()
