# DDInter Database

Place your `ddinter.csv` file in this folder.

## Expected CSV columns

| Column | Description |
|--------|-------------|
| `drug_a` | First drug name (lowercase) |
| `drug_b` | Second drug name (lowercase) |
| `level` | Interaction severity: `Low`, `Medium`, `High`, `Critical` |
| `description` | Plain-text description of the interaction |

## Example rows

```csv
drug_a,drug_b,level,description
warfarin,aspirin,High,Increased bleeding risk due to pharmacodynamic synergy
metformin,alcohol,Medium,Risk of lactic acidosis — avoid alcohol
simvastatin,amiodarone,High,CYP3A4 inhibition increases myopathy risk
digoxin,amiodarone,High,Amiodarone raises digoxin levels — risk of toxicity
ciprofloxacin,theophylline,Medium,CYP1A2 inhibition raises theophylline levels
lithium,ibuprofen,Medium,NSAIDs reduce renal lithium clearance
sildenafil,nitrates,Critical,Severe hypotension — contraindicated combination
```

## Source
Download from https://ddinter.scbdd.com or build your own from public interaction databases.

## .env reference
```
DDINTER_DATA_PATH=database/ddinter.csv
```
