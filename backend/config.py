import os
from dotenv import load_dotenv

load_dotenv()

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GITHUB_API_BASE: str = "https://api.github.com"
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = ""
    CORS_ORIGINS: str = "http://localhost:3000"  # Comma-separated for AKS/frontend URL
    # Azure OpenAI–compatible endpoint for CI/CD pipeline generation (e.g. DeepSeek on Azure)
    AZURE_OPENAI_CHAT_URL: str = "https://dskit-mm7qk81m-eastus2.cognitiveservices.azure.com/openai/v1/chat/completions"
    AZURE_OPENAI_API_KEY: str = ""  # Set in .env for AI-generated pipelines
    AKS_MONITOR_ENABLED: bool = False
    AKS_MONITOR_POLL_SECONDS: int = 20
    AKS_MONITOR_SOURCES: str = "workflow-frontend"
    AKS_MONITOR_DEDUP_SECONDS: int = 300
    AGENT_DEFAULT_GITHUB_LOGIN: str = "system"

    class Config:
        env_file = ".env"

settings = Settings()
