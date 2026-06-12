from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from config import settings
from config.database import get_db
from bson import ObjectId

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None

async def register_user(user_data: dict) -> dict:
    db = get_db()
    existing = await db.users.find_one({"email": user_data["email"]})
    if existing:
        return {"error": "Email already registered"}
    user_data["password"] = hash_password(user_data["password"])
    user_data["created_at"] = datetime.utcnow()
    result = await db.users.insert_one(user_data)
    user_data["_id"] = str(result.inserted_id)
    return user_data

async def login_user(email: str, password: str) -> Optional[dict]:
    db = get_db()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(password, user["password"]):
        return None
    user["_id"] = str(user["_id"])
    return user
