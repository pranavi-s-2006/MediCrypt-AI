import google.generativeai as genai
from config.settings import settings
import json, re, logging, time

logger = logging.getLogger(__name__)

genai.configure(api_key=settings.GEMINI_API_KEY)

_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"]
_model_instances = {}

def _get_model(name: str):
    if name not in _model_instances:
        _model_instances[name] = genai.GenerativeModel(name)
    return _model_instances[name]

def _generate(prompt: str) -> str:
    for name in _MODELS:
        try:
            return _get_model(name).generate_content(prompt).text.strip()
        except Exception as e:
            if "503" in str(e) or "UNAVAILABLE" in str(e):
                logger.warning("gemini_extraction %s unavailable, trying fallback…", name)
                time.sleep(1)
                continue
            raise
    raise RuntimeError("All Gemini models unavailable. Please try again in a moment.")

async def extract_medicine_details(ocr_text: str) -> list:
    prompt = f"""From this prescription text, extract all medicines as JSON array.
Each medicine object must have: name, dosage, frequency, duration, instructions.
Return ONLY valid JSON array, no explanation.

Text: {ocr_text}"""
    raw = _generate(prompt)
    match = re.search(r'\[.*\]', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return []

async def generate_risk_explanation(medicines: list, interactions: list, risk_level: str) -> str:
    prompt = f"""Patient medicines: {medicines}
Drug interactions found: {interactions}
Risk level: {risk_level}

Write a clear, simple medical explanation (3-4 sentences) for the doctor about these interactions and what to watch for."""
    return _generate(prompt)

async def generate_emergency_summary(profile: dict) -> str:
    prompt = f"""Create a brief emergency medical summary for paramedics:
Blood Group: {profile.get('blood_group')}
Allergies: {', '.join(profile.get('allergies', []))}
Current Medicines: {', '.join(profile.get('current_medicines', []))}
Chronic Diseases: {', '.join(profile.get('chronic_diseases', []))}

Write 2-3 sentences only."""
    return _generate(prompt)
