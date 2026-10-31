from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://civicpulse:civicpulse@localhost:5432/civicpulse"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma3:4b"
    geocoder_base_url: str = "https://nominatim.openstreetmap.org/reverse"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
