from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes import oauth_routes, workflow_routes, github_routes

app = FastAPI(
    title="GitHub Workflow Automator",
    version="1.0.0",
)
origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(oauth_routes.router, prefix="/oauth", tags=["OAuth"])
app.include_router(workflow_routes.router, prefix="/workflow", tags=["Workflow"])
app.include_router(github_routes.router, prefix="/github", tags=["GitHub"])
