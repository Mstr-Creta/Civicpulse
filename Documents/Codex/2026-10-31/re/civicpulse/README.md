# CivicPulse

**See what needs attention.** CivicPulse is an independent, mobile-first civic issue board for reporting neighborhood problems, following community activity, and organizing transparent follow-up.

> **Preview status:** This is an MVP/demo. The Bhubaneswar reports and photos are illustrative examples, not verified reports. The displayed pledge flow records intent only; it does not move money. User names are self-reported. AI output is not currently connected to the report form.

## Why CivicPulse

Residents often see potholes, blocked drains, waterlogging, waste, or broken streetlights but have no shared place to record evidence, see whether neighbors have observed the same problem, or track a next step. CivicPulse is designed to connect that journey:

**Report → AI suggestion → community verification → source-backed follow-up → status tracking → optional community pledge**

The MVP focuses on one sample city, Bhubaneswar, Odisha. It is independent of municipal agencies.

## What works in this preview

- Responsive map and issue board with three clearly labeled Bhubaneswar sample reports, each with an illustrative image.
- Issue detail, a sample status timeline, device-local confirmations, and a factual escalation draft users can copy.
- Report form with optional browser geolocation; issues are saved to the API when available, otherwise to that browser.
- Campaign creation for the sample community-verified issue, public supporter ledger, and automatic thank-you notes. These are pledge intents, not donations.
- Location-based authority lookup: user-triggered OpenStreetMap reverse geocoding, sourced Bhubaneswar civic contacts, and an optional Gemma source summary.
- FastAPI routes for issues, campaigns, pledge intents, text triage, and area/authority lookup.

## Technology

| Area | Stack |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, CSS, Leaflet / React Leaflet |
| API | Python, FastAPI, Pydantic, HTTPX |
| Data | PostgreSQL with PostGIS, SQLAlchemy |
| Local AI | Ollama with `gemma3:4b` (configurable) |
| Local services | Docker Compose |

## Run locally on Windows

Prerequisites: Node.js 22, Docker Desktop, and Ollama. Install Gemma in Ollama if you have not already:

```powershell
ollama pull gemma3:4b
```

From this project folder, start the database and API:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

In a second PowerShell window, start the frontend:

```powershell
npm install
npm run dev
```

Open <http://localhost:3000>. The API health check is at <http://localhost:8000/health> and interactive API docs are at <http://localhost:8000/docs>.

If area lookup says the API is unreachable, leave `docker compose up --build` running and confirm `http://localhost:8000/health` returns `{"status":"ok"}`. If you open the frontend as `http://127.0.0.1:3000`, include that exact origin in `CORS_ORIGINS` in `.env`, then restart Compose. If the result loads but its Gemma note is missing, the official source links can still be used; start Ollama and check `OLLAMA_MODEL` if you want the AI summary.

To use a different Ollama model, set `OLLAMA_MODEL` in `.env` to a model you have pulled, then restart the API. For a private local deployment, replace the example database password in `.env` with a unique password.

## Gemma: what is implemented

The FastAPI backend exposes `POST /api/v1/triage`. It accepts a report description and optional location context. The triage service sends a prompt to Ollama's `/api/chat` endpoint with `OLLAMA_MODEL` (default `gemma3:4b`), non-streaming output, and JSON mode. It requests a neutral title, cleaned description, category, severity, and confidence, then validates the response against a Pydantic schema. Results are explicitly labelled `AI-suggested` and default to requiring human review. If Ollama is unavailable, the API returns a service error; if the model's response cannot be validated, it returns a bad-gateway error.

**Important implementation gap:** The browser report form does not call `/api/v1/triage`; it saves a user-authored report directly. The new, user-triggered `/api/v1/area-lookup` reverse-geocodes the point, fetches allowlisted official pages, and asks Gemma to summarize retrieved page text plus reviewed fallback facts. Gemma does not search the web itself, choose an employee, or establish responsibility. Although Gemma 3 can accept image input through Ollama, current requests contain no images. Report photos are not uploaded or analyzed. The three bundled demo photos are generated illustrative images, not evidence.

The area lookup reverse-geocodes a supplied coordinate through OpenStreetMap Nominatim, then offers BMC as a *possible starting point* only if the result resolves to Bhubaneswar. It fetches allowlisted Sahar Sathi and BMC citizen-services pages, caches the page text for six hours, and gives the retrieved source text to Gemma for a constrained summary. The actual linked sources remain visible as the evidence; if a page cannot be fetched, the UI says so and falls back to reviewed contact facts. Nominatim lookups are user-triggered and cached for 24 hours, with a one-request-per-second process limit and visible attribution/policy link. No ward or individual worker is inferred; users are told to verify jurisdiction on the linked official portals.

The same lookup is available directly through `POST /api/v1/area-lookup` with `description`, `category`, `latitude`, and `longitude`. For example:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/v1/area-lookup `
  -ContentType 'application/json' `
  -Body '{"description":"Water pooling along the road after rain","category":"Drainage","latitude":20.2915,"longitude":85.8317}'
```

### Local AI request path

```text
Browser report form ── currently does not call AI

User-triggered area lookup
       ↓ POST /api/v1/area-lookup
OpenStreetMap Nominatim reverse lookup + allowlisted official source pages
       ↓
Gemma summarizes supplied facts (optional; links remain the evidence)
       ↓
Area + possible authority + official citations + AI-suggested summary

API client / future UI integration
       ↓ POST /api/v1/triage
FastAPI validates request
       ↓ HTTP POST /api/chat (JSON response mode)
Ollama running on your machine
       ↓ Gemma 3 response
Pydantic validates fields → AI-suggested response, human review required
```

In Docker Compose, the API reaches Ollama at `host.docker.internal:11434`. Keep Ollama local for development; do not expose its unauthenticated port to the public internet.

## Deployment choices

### Free and convenient demo: Vercel frontend only

Vercel Hobby is free for personal, non-commercial projects and offers a simple Git-based Next.js deployment. This option publishes the frontend and sample content; it does **not** host the FastAPI/PostGIS/Ollama stack. With no reachable API configured, report and campaign changes use browser-local storage, and Gemma is not available to remote visitors. Vercel describes Hobby as personal/non-commercial use and may pause projects after included free usage is exceeded ([plans](https://vercel.com/docs/plans), [pricing](https://vercel.com/pricing)).

1. Push this project to a GitHub repository.
2. In Vercel, import the repository and choose the folder containing this `package.json` as the project root.
3. Let Vercel detect Next.js and deploy. For the sample-only demo, leave `NEXT_PUBLIC_API_URL` unset.
4. Open the generated `*.vercel.app` URL and confirm the sample issue board loads.

This is the recommended first public demo if a zero-cost, low-setup share link is the priority. It is not a shared-data deployment; the area lookup and Gemma summary require the API to be reachable.

### Full interactive version: DigitalOcean Droplet + Vercel

To make reports/campaigns shared and use Gemma remotely, the API, PostGIS database, and Ollama model need a reachable server. DigitalOcean App Platform's free tier is for static sites; container services are paid. Basic Droplets currently start at $4/month, while the 8 GiB / 4 vCPU Basic plan is listed at $48/month ([App Platform pricing](https://docs.digitalocean.com/products/app-platform/details/pricing/), [Droplet pricing](https://www.digitalocean.com/pricing/droplets)). For this stack, 8 GiB is a practical starting point for `gemma3:4b` plus the OS, API, and database; CPU-only inference may be slower than your local machine. Prices can change.

1. Push the project to GitHub. Create an Ubuntu Droplet with at least 8 GiB RAM, attach a domain, and allow only SSH plus HTTP/HTTPS at the cloud firewall.
2. Install Docker Engine and the Docker Compose plugin using DigitalOcean's current Ubuntu instructions.
3. Install Ollama on the Droplet and pull `gemma3:4b`:

   ```bash
   ollama pull gemma3:4b
   ```

4. Configure Ollama to listen on the Docker host gateway (`OLLAMA_HOST=0.0.0.0:11434`) and restart its service. Keep port `11434` blocked from public ingress in both the host and cloud firewalls; the Compose API uses the host gateway internally.
5. Clone the repository on the Droplet. Create a production `.env` file (do not commit it):

   ```dotenv
   POSTGRES_PASSWORD=replace-with-a-long-random-secret
   OLLAMA_MODEL=gemma3:4b
   CORS_ORIGINS=https://your-project.vercel.app
   ```

6. Run `docker compose up -d --build`. Put a TLS reverse proxy such as Caddy in front of the API, and publish the API at an HTTPS URL. Do not expose PostgreSQL or Ollama publicly.
7. Import the Next.js frontend to Vercel. Add `NEXT_PUBLIC_API_URL=https://api.your-domain.example` to its Production environment and redeploy. The API's `CORS_ORIGINS` must exactly include the deployed frontend origin.
8. Check `https://api.your-domain.example/health`, then submit a report and campaign from the frontend. Gemma will only be exercised once the report UI is wired to `/api/v1/triage`.

This is **not a free deployment**. It also needs basic Linux administration, TLS, backups for the Docker database volume, monitoring, and careful firewall configuration. Do not use the example database credentials in production.

## Current boundaries and next steps

- No login, verified identities, real media uploads, push/email notifications, municipal integrations, or official source ingestion yet.
- The report form does not invoke AI triage yet; the backend endpoint is API-only.
- Community confirmations are device-local in this preview, and campaign eligibility is demonstrated with sample data.
- Pledge amounts are intents. No funds are collected or held, and contributor identities are not verified.
- The map uses OpenStreetMap tiles and illustrative pins; sample image captions explicitly say they are not evidence.

See the separate submission guide for the product story, use case, demo flow, honest claims, and future scope.
