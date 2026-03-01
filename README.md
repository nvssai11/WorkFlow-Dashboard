# WorkFlow-Dashboard

A web dashboard that automates CI/CD for your GitHub repositories: connect a repo, create Azure (AKS + ACR) resources from the UI, and one-click enable a full pipeline. The app generates and commits workflow YAML, Dockerfiles, and Kubernetes manifests into **your** repo—it does not deploy this dashboard itself to Azure.

---

## Features

- **Repo analysis** – Detects stack (language, frontend/backend layout, root vs `frontend/` layout) from the repo
- **Workflow generation** – Template-based or **AI-generated** (optional) GitHub Actions CI/CD YAML
- **One-click Enable CI/CD** – Single commit that adds:
  - `.github/workflows/ci.yml` (or simple CD only)
  - `Dockerfile.backend` / `Dockerfile.frontend` (chosen by layout)
  - `k8s/` manifests (namespace, deployments, LoadBalancer services)
- **Secrets sync** – Push Azure and ACR credentials to the repo’s GitHub Actions secrets
- **Deployment config** – Create AKS + ACR from the UI; optional SQLite-backed cache per repo
- **View workflow runs** – Link to GitHub Actions runs for the connected repo

---

## Tech stack

- **Frontend:** Next.js, React, Tailwind
- **Backend:** FastAPI (Python)
- **Integrations:** GitHub API (repo contents, Git Data API, Actions secrets), Azure (AKS, ACR) via Azure CLI/API

---

## Prerequisites

- Python 3.11+
- Node.js 18+ (for frontend)
- GitHub account (OAuth or token for API access)
- For **creating AKS/ACR from the dashboard:** Azure CLI logged in (`az login`) and a subscription
- For **AI-generated pipelines:** Azure OpenAI–compatible API key (set in `.env`)

---

## Setup and run

1. **Clone and install**
   ```bash
   cd WorkFlow-Dashboard
   pip install -r backend/requirements.txt
   cd frontend && npm install
   ```

2. **Environment**
   - Create `backend/.env` (or root `.env`) with at least:
     - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI` for OAuth, or use a GitHub token for API access as required by your auth setup.
   - Optional (AI-generated workflows): `AZURE_OPENAI_API_KEY` and optionally `AZURE_OPENAI_CHAT_URL`.

3. **Run backend**
   ```bash
   python3.11 -m uvicorn backend.main:app --reload
   ```

4. **Run frontend**
   ```bash
   cd frontend && npm run dev
   ```

5. Open the dashboard (e.g. `http://localhost:3000`), connect GitHub, select a repository, and use the workflow page to create Azure resources and enable CI/CD.

---

## What the dashboard does (for your repos)

- You pick a **GitHub repo** (e.g. `marine-radar`, `GrowthGear`).
- Optionally **create AKS + ACR** from the UI (resource group, cluster name, node size, etc.); credentials can be stored and reused.
- **Enable CI/CD** writes into **that repo** (not this one):
  - A single commit adds the workflow file, Dockerfiles, and `k8s/` manifests.
  - Only one workflow file is active (full CI/CD or simple CD), so one run per push.
- The **target repo** then builds images, pushes to your ACR, and deploys to your AKS when you push to `main` (or on manual trigger). This project does not deploy itself; it only automates the setup for other repos.

---

## Optional: AI-generated pipelines

If `AZURE_OPENAI_API_KEY` is set, the dashboard can use an Azure OpenAI–compatible chat API to generate CI/CD YAML from the repo structure and your deployment config. Otherwise, a built-in template is used. AI generation is optional; the app works without it.

---

## License

See repository license file.
