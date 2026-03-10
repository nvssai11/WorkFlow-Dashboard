# AutoFlow — Workflow Dashboard

A dashboard to connect GitHub repos, provision Azure (AKS + ACR), and enable CI/CD in one place. Optionally monitor AKS workloads and get AI-backed root cause and fix suggestions on failures. **Slack webhooks** send immediate alerts when failures are detected.

---

## What it does

Pick a repo, optionally create AKS + ACR from the UI, then enable CI/CD. The app commits workflow files, Dockerfiles, and k8s manifests into your repo; your pipeline builds, pushes to ACR, and deploys to AKS. You can start an AKS log monitor from **Agents** to detect failures, get LLM-suggested fixes, and receive **Slack alerts** on new failures.

---

## Features

- **Dashboard** — Workflow stats (totals, success/fail, images pushed) and recent GitHub Actions runs.
- **Workflows** — Repo list with search; per-repo: stack detection, pipeline suggest/preview, AI or template CI/CD generation, commit workflow, sync secrets to GitHub, one-click Enable CI/CD (Dockerfiles + k8s + workflow in one commit).
- **Azure** — Connect once (store service principal JSON in Settings); create resource group, ACR, AKS from the workflow page; deployment cache per repo.
- **Agents** — Start/Stop AKS log monitor from UI; poll once; failures table (workflow, repo, error line, root cause, suggested fix from LLM, view logs drawer, resolved checkbox). **Slack webhooks** for immediate alerts when failures are detected.
- **Settings** — Azure connect/disconnect.

---

## Tech stack

| Layer     | Choice |
|----------|--------|
| Frontend | Next.js, React, Tailwind |
| Backend  | FastAPI (Python) |
| Auth     | GitHub OAuth |
| External | GitHub API; Azure API; Azure OpenAI–compatible (e.g. DeepSeek) for pipelines and failure analysis; **Slack webhooks** for failure alerts |
| Data     | SQLite (credentials, deployment cache, workflow runs, agent failures) |
| Agents   | kubectl log polling, keyword detection, optional LLM analysis |

---

## Prerequisites

Python 3.11+, Node.js 18+, GitHub account. Optional: Azure (`az login`) for AKS/ACR creation; `AZURE_OPENAI_API_KEY` for AI pipelines and failure analysis.

---

## Setup and run

1. Clone, then: `pip install -r backend/requirements.txt` and `cd frontend && npm install`.
2. Add `.env` with `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`. Optional: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_CHAT_URL`; `AKS_MONITOR_SOURCES` for Agents.
3. Run backend: `python -m uvicorn backend.main:app --reload`.
4. Run frontend: `cd frontend && npm run dev`.
5. Open `http://localhost:3000`, sign in with GitHub, pick a repo, and enable CI/CD.

---

## Configuration

Key env vars: OAuth credentials; `AZURE_OPENAI_*` for AI; `AKS_MONITOR_SOURCES` (e.g. `workflow|namespace|label_selector|...`); `AGENT_DEFAULT_GITHUB_LOGIN`. One kubeconfig per cluster via `az aks get-credentials`. On Agents page click **Start** to begin monitoring; failures match `AKS_MONITOR_SOURCES` namespace and labels.

