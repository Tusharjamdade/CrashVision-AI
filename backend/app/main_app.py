from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import FRONTEND_ORIGINS
from app.database import seed_demo_data_if_empty, close_db_connection
from app.routes.health_routes import router as health_router
from app.routes.auth_routes import router as auth_router
from app.routes.records_routes import router as records_router
from app.routes.monitor_routes import router as monitor_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    print("Initializing CrashVision AI Backend...")
    seed_demo_data_if_empty()
    yield
    # Shutdown tasks
    print("Shutting down CrashVision AI Backend...")
    close_db_connection()


app = FastAPI(
    title="CrashVision AI API",
    version="2.0.0",
    description="Accident detection, S3 evidence storage, reports, auth and chat.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(records_router)
app.include_router(monitor_router)
