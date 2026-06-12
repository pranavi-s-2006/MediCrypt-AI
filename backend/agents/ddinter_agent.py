import pandas as pd
import os
from config import settings

_df: pd.DataFrame = None


def _load():
    global _df
    if _df is not None:
        return
    path = settings.DDINTER_DATA_PATH
    if os.path.exists(path):
        _df = pd.read_csv(path)
        _df.columns = [c.strip().lower().replace(" ", "_") for c in _df.columns]
        # Ensure description column exists (merged file has none)
        if "description" not in _df.columns:
            _df["description"] = ""
        # Pre-lowercase drug names for faster matching
        _df["drug_a_lower"] = _df["drug_a"].str.lower().str.strip()
        _df["drug_b_lower"] = _df["drug_b"].str.lower().str.strip()
    else:
        _df = pd.DataFrame(columns=["drug_a", "drug_b", "level", "description",
                                     "drug_a_lower", "drug_b_lower"])


async def check_interactions(medicines: list) -> list:
    _load()
    drug_names = [m.get("name", "").lower().strip() for m in medicines if m.get("name")]
    interactions = []

    for i in range(len(drug_names)):
        for j in range(i + 1, len(drug_names)):
            a, b = drug_names[i], drug_names[j]
            mask = (
                (_df["drug_a_lower"] == a) & (_df["drug_b_lower"] == b)
            ) | (
                (_df["drug_a_lower"] == b) & (_df["drug_b_lower"] == a)
            )
            rows = _df[mask]
            for _, row in rows.iterrows():
                desc = str(row.get("description", "") or "")
                interactions.append({
                    "drug_a":      row.get("drug_a", a),
                    "drug_b":      row.get("drug_b", b),
                    "level":       str(row.get("level", "Low")),
                    "description": desc if desc not in ("", "nan", "NaN") else
                                   f"Interaction between {row.get('drug_a', a)} and {row.get('drug_b', b)} — level: {row.get('level', 'Low')}",
                })

    return interactions
