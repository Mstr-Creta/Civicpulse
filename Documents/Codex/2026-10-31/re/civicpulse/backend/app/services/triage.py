import json

import httpx

from ..schemas import TriageRequest, TriageSuggestion
from ..settings import settings


class OllamaUnavailable(Exception):
    pass


class TriageOutputInvalid(Exception):
    pass


async def suggest_triage(payload: TriageRequest) -> TriageSuggestion:
    prompt = (
        "Classify this civic issue. Return only JSON with title, cleaned_description, category, "
        "severity (Low, Medium, High), confidence (0 to 1). Use neutral factual language. "
        "Do not infer who is responsible or make accusations. Set uncertain values conservatively.\n\n"
        f"Location context: {payload.location_context or 'not provided'}\n"
        f"Report: {payload.description}"
    )
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.post(
                f"{settings.ollama_base_url.rstrip('/')}/api/chat",
                json={
                    "model": settings.ollama_model,
                    "stream": False,
                    "format": "json",
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            response.raise_for_status()
    except httpx.HTTPError as error:
        raise OllamaUnavailable from error

    try:
        content = response.json()["message"]["content"]
        return TriageSuggestion(**json.loads(content))
    except (KeyError, ValueError, TypeError) as error:
        raise TriageOutputInvalid from error
