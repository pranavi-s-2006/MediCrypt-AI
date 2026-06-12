"""
agents/drug_safety_agent.py
----------------------------
Checks new prescription medicines against a patient's current medicines for:
  1. Drug-drug interactions (via DDInter)
  2. Timing conflicts (same time-slot medicines that may interfere)
  3. Duplicate medicines (same active ingredient in both lists)
  4. Allergy conflicts (medicine name matches a known patient allergy)
  5. High-risk combinations flagged by DDInter as High/Critical

All checks are isolated — a failure in one does not crash the others.
"""

import logging
from agents import ddinter_agent

logger = logging.getLogger(__name__)

# Time-slot keys used in the medicine dicts returned by Gemini
TIME_SLOTS = ["morning", "afternoon", "night"]


async def full_safety_check(
    current_medicines: list,
    new_medicines: list,
    patient_allergies: list,
) -> dict:
    """
    Run all safety checks and return a structured report.

    Parameters
    ----------
    current_medicines : list of medicine dicts from MongoDB (patient's active meds)
    new_medicines     : list of medicine dicts extracted by Gemini from the new prescription
    patient_allergies : list of allergy strings from patient profile

    Returns
    -------
    {
      "interactions":      [...],   DDInter results across all medicines combined
      "timing_conflicts":  [...],   same time-slot conflicts between current + new
      "duplicates":        [...],   medicines appearing in both lists (by name)
      "allergy_conflicts": [...],   new medicines matching known allergies
      "overall_risk":      str,     High / Medium / Low / Safe
    }
    """
    all_medicines  = current_medicines + new_medicines
    interactions   = await _check_interactions(all_medicines)
    timing_conflicts = _check_timing_conflicts(current_medicines, new_medicines)
    duplicates       = _check_duplicates(current_medicines, new_medicines)
    allergy_conflicts = _check_allergies(new_medicines, patient_allergies)

    overall_risk = _compute_overall_risk(interactions, timing_conflicts, duplicates, allergy_conflicts)

    return {
        "interactions":      interactions,
        "timing_conflicts":  timing_conflicts,
        "duplicates":        duplicates,
        "allergy_conflicts": allergy_conflicts,
        "overall_risk":      overall_risk,
    }


# ── Private helpers ────────────────────────────────────────

async def _check_interactions(all_medicines: list) -> list:
    try:
        return await ddinter_agent.check_interactions(all_medicines)
    except Exception as e:
        logger.warning("DDInter check failed: %s", e)
        return []


def _check_timing_conflicts(current: list, new_meds: list) -> list:
    """Flag pairs where current + new medicine share the same time slot."""
    conflicts = []
    try:
        for cur in current:
            for new in new_meds:
                shared_slots = [
                    slot for slot in TIME_SLOTS
                    if cur.get(slot) and new.get(slot)
                ]
                if shared_slots:
                    conflicts.append({
                        "medicine_a": cur.get("name", "Unknown"),
                        "medicine_b": new.get("name", "Unknown"),
                        "shared_slots": shared_slots,
                        "message": (
                            f"{cur.get('name')} and {new.get('name')} are both scheduled "
                            f"at {', '.join(shared_slots)}. Verify timing with prescribing doctor."
                        ),
                    })
    except Exception as e:
        logger.warning("Timing conflict check failed: %s", e)
    return conflicts


def _check_duplicates(current: list, new_meds: list) -> list:
    """Flag medicines with the same name in both current and new lists."""
    duplicates = []
    try:
        current_names = {m.get("name", "").lower().strip() for m in current if m.get("name")}
        for med in new_meds:
            name = med.get("name", "").lower().strip()
            if name and name in current_names:
                duplicates.append({
                    "medicine": med.get("name"),
                    "message": f"{med.get('name')} is already in the patient's active medication list. Possible duplicate.",
                })
    except Exception as e:
        logger.warning("Duplicate check failed: %s", e)
    return duplicates


def _check_allergies(new_meds: list, allergies: list) -> list:
    """Flag new medicines whose name matches a known patient allergy."""
    conflicts = []
    try:
        allergy_set = {a.lower().strip() for a in allergies if a}
        for med in new_meds:
            name = med.get("name", "").lower().strip()
            for allergy in allergy_set:
                if allergy in name or name in allergy:
                    conflicts.append({
                        "medicine": med.get("name"),
                        "allergy":  allergy,
                        "message":  f"ALLERGY ALERT: Patient is allergic to '{allergy}'. New medicine '{med.get('name')}' may be contraindicated.",
                        "severity": "Critical",
                    })
    except Exception as e:
        logger.warning("Allergy check failed: %s", e)
    return conflicts


def _compute_overall_risk(interactions, timing_conflicts, duplicates, allergy_conflicts) -> str:
    if allergy_conflicts:
        return "Critical"
    high_interactions = [i for i in interactions if i.get("level") in ("High", "Critical")]
    if high_interactions:
        return "High"
    if interactions or timing_conflicts or duplicates:
        return "Medium"
    return "Safe"
