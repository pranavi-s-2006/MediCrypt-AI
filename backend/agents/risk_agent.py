from config import settings
import random

ENGINE = settings.RISK_AGENT  # "rule_engine"

# Risk percentage bands:
#   Low      0 – 30%
#   Medium  31 – 60%
#   High    61 – 85%
#   Critical 86 – 100%
_BAND = {
    "Critical": (86, 100),
    "High":     (61,  85),
    "Medium":   (31,  60),
    "Low":      ( 0,  30),
}

def _risk_percentage(level: str, interactions: list) -> int:
    """Deterministic-ish percentage inside the band based on interaction count."""
    lo, hi = _BAND.get(level, (0, 30))
    count  = len(interactions)
    # Weight toward upper end as count grows, capped at hi
    pct = lo + min(count * 8, hi - lo)
    return max(lo, min(pct, hi))


def assess_risk(interactions: list) -> dict:
    if ENGINE != "rule_engine":
        raise ValueError(f"Unknown RISK_AGENT: {ENGINE}")

    if not interactions:
        return {"risk": "Low", "alert": "Low", "color": "green",
                "risk_percentage": 0, "interaction_count": 0}

    levels = [str(i.get("level", "")).strip() for i in interactions]

    if any(l == "Critical" for l in levels):
        risk = "Critical"
    elif any(l == "High" for l in levels):
        risk = "High"
    elif any(l == "Medium" for l in levels):
        risk = "Medium"
    else:
        risk = "Low"

    alert_map = {"Critical": "Critical", "High": "Critical", "Medium": "High", "Low": "Low"}
    color_map = {"Critical": "red", "High": "red", "Medium": "orange", "Low": "green"}

    return {
        "risk":             risk,
        "alert":            alert_map[risk],
        "color":            color_map[risk],
        "risk_percentage":  _risk_percentage(risk, interactions),
        "interaction_count": len(interactions),
    }
