from google import genai
from google.genai import errors as genai_errors
from config import settings
import json, re, logging, time

logger = logging.getLogger(__name__)

_client = None

def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client

# Primary model, fallback if 503
MODEL          = "gemini-2.0-flash"
MODEL_FALLBACK = "gemini-1.5-flash"

def _generate(prompt: str) -> str:
    for model in (MODEL, MODEL_FALLBACK):
        try:
            return _get_client().models.generate_content(model=model, contents=prompt).text.strip()
        except genai_errors.ServerError as e:
            logger.warning("Gemini %s unavailable (%s), trying fallback…", model, e)
            time.sleep(1)
        except Exception as e:
            logger.error("Gemini %s error: %s", model, e)
            raise
    raise RuntimeError("All Gemini models unavailable. Please try again in a moment.")

def _parse_json_array(raw: str) -> list:
    match = re.search(r'\[.*\]', raw, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return []


async def extract_medicine_details(ocr_text: str) -> list:
    """
    Extract medicines from OCR text.
    Tries Gemini first; falls back to offline DDInter-matching extractor on any failure.
    """
    from agents.medicine_extractor import extract_medicines_offline

    prompt = (
        "From the prescription text below, extract all medicines as a JSON array.\n"
        "Each item MUST have these exact fields:\n"
        "  name        - medicine name (string)\n"
        "  dosage      - dosage strength e.g. '500mg' (string)\n"
        "  morning     - true/false whether to take in morning (boolean)\n"
        "  afternoon   - true/false whether to take in afternoon (boolean)\n"
        "  night       - true/false whether to take at night (boolean)\n"
        "  before_food - true/false (boolean)\n"
        "  after_food  - true/false (boolean)\n"
        "  duration    - e.g. '7 days', 'ongoing' (string)\n"
        "  instructions - any other instructions (string or null)\n"
        "Return ONLY a valid JSON array. No explanation.\n\n"
        f"Prescription text:\n{ocr_text}"
    )
    try:
        result = _parse_json_array(_generate(prompt))
        if result:
            return result
    except Exception as e:
        logger.warning("Gemini extraction failed, using offline extractor: %s", e)

    return extract_medicines_offline(ocr_text)


async def generate_risk_explanation(medicines: list, interactions: list, risk_level: str) -> str:
    prompt = (
        f"Patient medicines: {json.dumps(medicines)}\n"
        f"Drug interactions: {json.dumps(interactions)}\n"
        f"Risk level: {risk_level}\n\n"
        "Write a clear 3-4 sentence clinical explanation for the doctor about these interactions and what to watch for."
    )
    try:
        return _generate(prompt)
    except Exception as e:
        logger.warning("Gemini risk explanation failed: %s", e)
        if not interactions:
            return f"Risk level: {risk_level}. No drug interactions detected."
        names = ", ".join(f"{i.get('drug_a')} + {i.get('drug_b')}" for i in interactions[:3])
        return f"Risk level: {risk_level}. Interactions detected: {names}. Please review carefully before dispensing."


async def generate_prescription_safety_summary(
    current_medicines: list,
    new_medicines: list,
    interactions: list,
    timing_conflicts: list,
    duplicates: list,
    allergy_conflicts: list,
    patient_allergies: list,
) -> str:
    current_lines = "\n".join(
        f"- {m.get('name')} {m.get('dosage','')}"
        for m in current_medicines
    ) or "None on record"

    new_lines = "\n".join(
        f"- {m.get('name')} {m.get('dosage','')}"
        for m in new_medicines
    ) or "None"

    prompt = (
        "You are a clinical pharmacist AI. Write a structured doctor safety report.\n\n"
        f"PATIENT CURRENT MEDICINES:\n{current_lines}\n\n"
        f"NEW PRESCRIPTION MEDICINES:\n{new_lines}\n\n"
        f"ALLERGIES: {', '.join(patient_allergies) if patient_allergies else 'None known'}\n\n"
        f"DRUG-DRUG INTERACTIONS: {json.dumps(interactions)}\n"
        f"TIMING CONFLICTS: {json.dumps(timing_conflicts)}\n"
        f"DUPLICATE MEDICINES: {json.dumps(duplicates)}\n"
        f"ALLERGY CONFLICTS: {json.dumps(allergy_conflicts)}\n\n"
        "Write a professional report with these sections:\n"
        "1. Current Medicines Summary\n"
        "2. New Prescription Summary\n"
        "3. Risk Findings\n"
        "4. Doctor Recommendation\n"
        "Be concise and clinical. 6-10 sentences total."
    )
    try:
        return _generate(prompt)
    except Exception as e:
        logger.warning("Gemini safety summary failed: %s", e)
        issues = []
        if allergy_conflicts:  issues.append(f"{len(allergy_conflicts)} allergy conflict(s)")
        if interactions:       issues.append(f"{len(interactions)} drug interaction(s)")
        if duplicates:         issues.append(f"{len(duplicates)} duplicate(s)")
        summary = ", ".join(issues) if issues else "No major issues detected"
        return f"Safety summary (offline): {summary}. New medicines: {new_lines}. Please review all interactions before prescribing."


async def generate_emergency_summary(profile: dict) -> str:
    prompt = (
        "Create a brief emergency medical summary for paramedics:\n"
        f"Blood Group: {profile.get('blood_group')}\n"
        f"Allergies: {', '.join(profile.get('allergies', []))}\n"
        f"Current Medicines: {', '.join(profile.get('current_medicines', []))}\n"
        f"Chronic Diseases: {', '.join(profile.get('chronic_diseases', []))}\n\n"
        "Write 2-3 sentences only."
    )
    return _generate(prompt)
