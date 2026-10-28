import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    port: int = Field(default=8000, alias="PORT")
    env: str = Field(default="development", alias="ENV")
    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/linkup?sslmode=disable",
        alias="DATABASE_URL"
    )
    backend_url: str = Field(default="http://localhost:5000", alias="BACKEND_URL")
    model_name: str = Field(default="all-MiniLM-L6-v2", alias="MODEL_NAME")
    model_device: str = Field(default="cpu", alias="MODEL_DEVICE")
    llm_api_key: str = Field(default="", alias="LLM_API_KEY")
    embedding_dimension: int = 384

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
