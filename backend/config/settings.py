from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME: str = os.getenv("DATABASE_NAME", "medicrypt_guardian_ai")

SECRET_KEY: str = os.getenv("SECRET_KEY", "medicrypt_secret")
ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

OCR_MODEL: str = os.getenv("OCR_MODEL", "microsoft/trocr-base-handwritten")

DDINTER_DATA_PATH: str = os.getenv("DDINTER_DATA_PATH", "database/ddinter.csv")
RISK_AGENT: str = os.getenv("RISK_AGENT", "rule_engine")

UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
QR_OUTPUT_DIR: str = os.getenv("QR_OUTPUT_DIR", "generated/qr_codes")
