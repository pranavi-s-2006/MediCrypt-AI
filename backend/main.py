from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from config.database import connect_db, close_db
from config import settings
from routes import (
    auth_routes, patient_routes, doctor_routes,
    hospital_routes, caregiver_routes, ai_routes,
    emergency_routes, audit_routes
)
from routes import face_routes, queue_routes
import asyncio
import os


# ── Request timeout middleware ────────────────────────────
REQUEST_TIMEOUT_SECS = 180

class TimeoutMiddleware:
    def __init__(self, app, timeout: int = REQUEST_TIMEOUT_SECS):
        self.app = app
        self.timeout = timeout

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        response_started = False

        async def send_wrapper(message):
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await asyncio.wait_for(
                self.app(scope, receive, send_wrapper),
                timeout=self.timeout
            )
        except asyncio.TimeoutError:
            if not response_started:
                response = JSONResponse(
                    status_code=504,
                    content={"detail": "Request timed out after 3 minutes. Try a smaller or clearer file."}
                )
                await response(scope, receive, send)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    for path in [
        os.path.join(settings.UPLOAD_DIR, "prescriptions"),
        os.path.join(settings.UPLOAD_DIR, "reports"),
        settings.QR_OUTPUT_DIR,
    ]:
        os.makedirs(path, exist_ok=True)
    yield
    await close_db()


app = FastAPI(
    title="MediCrypt Guardian AI",
    description="Agentic Healthcare Memory and Drug Safety Network",
    version="1.0.0",
    lifespan=lifespan,
)

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    import traceback
    logger = __import__("logging").getLogger("uvicorn.error")
    logger.error("Unhandled 500 on %s %s:\n%s", request.method, request.url.path, traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {exc}"},
    )

# CORS must be outermost so its headers are always present — even on timeout
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Timeout middleware sits inside CORS so CORS headers are already applied
app.add_middleware(TimeoutMiddleware, timeout=REQUEST_TIMEOUT_SECS)

app.include_router(auth_routes.router)
app.include_router(patient_routes.router)
app.include_router(doctor_routes.router)
app.include_router(hospital_routes.router)
app.include_router(caregiver_routes.router)
app.include_router(ai_routes.router)
app.include_router(emergency_routes.router)
app.include_router(audit_routes.router)
app.include_router(face_routes.router)
app.include_router(queue_routes.router)


@app.get("/")
async def root():
    return {"message": "MediCrypt Guardian AI API", "version": "1.0.0", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
