"""
agents/medicine_extractor.py
-----------------------------
Offline medicine extractor — no API needed.
Extracts medicine names from OCR text by matching against the DDInter drug list.
Falls back to regex patterns for common prescription formats.
"""

import re
import pandas as pd
import os
import logging
from config import settings

logger = logging.getLogger(__name__)

_drug_names: set[str] = set()
_drug_names_lower: dict[str, str] = {}   # lower -> canonical


def _load_drugs():
    global _drug_names, _drug_names_lower
    if _drug_names:
        return
    path = settings.DDINTER_DATA_PATH
    if not os.path.exists(path):
        logger.warning("DDInter CSV not found at %s", path)
        return
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]
    names = set(df["drug_a"].dropna().tolist()) | set(df["drug_b"].dropna().tolist())
    _drug_names = names
    _drug_names_lower = {n.lower(): n for n in names}
    logger.info("Loaded %d drug names from DDInter", len(_drug_names_lower))


# Common dosage pattern: 500mg, 10ml, 2.5mg, etc.
_DOSAGE_RE = re.compile(r'\b(\d+(?:\.\d+)?)\s*(mg|ml|mcg|g|iu|units?)\b', re.IGNORECASE)
# Frequency patterns
_FREQ_RE   = re.compile(r'\b(once|twice|thrice|1[-\s]?0[-\s]?1|1[-\s]?1[-\s]?1|0[-\s]?0[-\s]?1|od|bd|tds|qid|sid|bid|tid|prn|sos|morning|night|afternoon|daily|weekly)\b', re.IGNORECASE)


def _find_dosage(text: str) -> str:
    m = _DOSAGE_RE.search(text)
    return m.group(0) if m else ""


def _find_frequency(text: str) -> str:
    m = _FREQ_RE.search(text)
    return m.group(0) if m else ""


def extract_medicines_offline(ocr_text: str) -> list[dict]:
    """
    Extract medicines from OCR text without any external API.

    Strategy:
    1. Split text into lines / tokens
    2. Match multi-word and single-word tokens against DDInter drug list (case-insensitive)
    3. For each matched drug, try to find a nearby dosage and frequency
    4. Deduplicate

    Returns list of dicts with: name, dosage, frequency, duration, instructions
    """
    _load_drugs()

    found: dict[str, dict] = {}   # lower_name -> medicine dict
    lines = ocr_text.splitlines()

    for line in lines:
        line_lower = line.lower()

        # Try matching 1, 2, and 3-word sequences against known drug names
        words = re.findall(r"[a-zA-Z]+(?:\s[a-zA-Z]+){0,2}", line)
        for phrase in words:
            key = phrase.lower().strip()
            if key in _drug_names_lower and key not in found:
                canonical = _drug_names_lower[key]
                dosage    = _find_dosage(line)
                freq      = _find_frequency(line)
                found[key] = {
                    "name":         canonical,
                    "dosage":       dosage,
                    "frequency":    freq,
                    "duration":     "",
                    "instructions": line.strip(),
                }

    # Also try a simpler token-by-token scan for single-word drugs
    all_tokens = re.findall(r"[a-zA-Z]{4,}", ocr_text)
    for token in all_tokens:
        key = token.lower()
        if key in _drug_names_lower and key not in found:
            canonical = _drug_names_lower[key]
            found[key] = {
                "name":         canonical,
                "dosage":       "",
                "frequency":    "",
                "duration":     "",
                "instructions": "",
            }

    medicines = list(found.values())
    logger.info("Offline extractor found %d medicines", len(medicines))
    return medicines
