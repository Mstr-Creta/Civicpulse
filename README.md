# CivicPulse

**See what needs attention.** CivicPulse is a mobile-friendly civic issue board for reporting neighborhood problems, following community activity, and organizing follow-up.

> **Demo notice:** Sample Bhubaneswar reports and images are illustrative, not verified evidence. Campaign contributions are pledge intents only; no money is collected. Names are self-reported.
## Vercel - https://civicpulse-ashy.vercel.app

## Features

- Browse sample civic issues on a map and board; view status updates and copy an escalation draft.
- Submit reports with optional browser geolocation. Reports use the API when available and otherwise stay in the current browser.
- Create campaigns and view supporters and thank-you notes. Pledges do not process payments.
- Look up an area and possible civic authority using OpenStreetMap and linked official sources.
- Optional Gemma summaries of retrieved civic information.

## Tech stack

- Frontend: Next.js 15, React 19, TypeScript, Leaflet
- API: Python, FastAPI, Pydantic, HTTPX
- Data: PostgreSQL with PostGIS, SQLAlchemy
- Local AI: Ollama with `gemma3:4b` by default
- Local services: Docker Compose

## Run locally (Windows)

Prerequisites: Node.js 22, Docker Desktop, and Ollama. Pull the model if needed:

```powershell
ollama pull gemma3:4b
```

In the project folder, start the API and database:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

In a second terminal, start the web app:

```powershell
npm install
npm run dev
```

Open <http://localhost:3000>. API health: <http://localhost:8000/health>. API docs: <http://localhost:8000/docs>.

To use a different Ollama model, set `OLLAMA_MODEL` in `.env` and restart the API. Keep `.env` private; it is ignored by Git.

## How Gemma is used

The FastAPI backend has two AI-related endpoints:

- `POST /api/v1/triage` sends a report description to Ollama and asks Gemma for a suggested title, cleaned description, category, and severity. The result is validated and marked for human review. **The browser report form does not currently call this endpoint.**
- `POST /api/v1/area-lookup` reverse-geocodes coordinates with OpenStreetMap, fetches allowlisted official pages, and can ask Gemma to summarize the retrieved text. The source links are shown to users; Gemma does not independently search the internet or identify a specific worker.

The area lookup is user-triggered and rate-limited/cached. It offers Bhubaneswar civic contacts only when the location matches the supported area. Users should verify responsibility with the linked official portals. If Ollama or a source page is unavailable, the lookup may return without an AI summary.

In Docker Compose, the API connects to Ollama on the host at `host.docker.internal:11434`. Do not expose Ollama's unauthenticated port to the public internet.

## Demo limitations

- Sample reports, map pins, and photos are illustrative, not verified reports or evidence.
- AI triage is an API feature and is not yet integrated into report submission. Photos are not uploaded or analyzed.
- Confirmations are stored on the device. User identities are not verified.
- Campaign pledges do not transfer money.
- The app is independent of municipal agencies and does not submit reports to them.

See [PRODUCT.md](PRODUCT.md) for product goals and [DESIGN.md](DESIGN.md) for design notes.
