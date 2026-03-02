from fastapi import FastAPI

from backend.routes import oauth_routes, workflow_routes, github_routes, pipeline_routes, azure_routes
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings

app = FastAPI(
    title="GitHub Workflow Automator",
    version="1.0.0",
)
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()] or ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(oauth_routes.router, prefix="/oauth", tags=["OAuth"])
app.include_router(workflow_routes.router, prefix="/workflow", tags=["Workflow"])
app.include_router(github_routes.router, prefix="/github", tags=["GitHub"])
app.include_router(pipeline_routes.router, prefix="/pipeline", tags=["Pipeline"])
app.include_router(azure_routes.router, prefix="/azure", tags=["Azure"])
