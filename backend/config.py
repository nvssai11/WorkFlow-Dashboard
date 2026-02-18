import os
from dotenv import load_dotenv

load_dotenv()

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    GITHUB_API_BASE: str = "https://api.github.com"
    GITHUB_CLIENT_ID: str
    GITHUB_CLIENT_SECRET: str
    GITHUB_REDIRECT_URI: str

    class Config:
        env_file = ".env"

settings = Settings()