from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import credentials, verify
from database import init_db

app = FastAPI(
    title="CertChain API",
    description="Blockchain-anchored credential verification - issue, verify, and revoke credentials on Ethereum Sepolia.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(credentials.router, prefix="/api")
app.include_router(verify.router, prefix="/api")


@app.on_event("startup")
def on_startup():
    """Create DB tables on first run."""
    init_db()


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "service": "CertChain API", "version": "1.0.0"}
