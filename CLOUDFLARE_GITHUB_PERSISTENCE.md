# Cloudflare Worker + GitHub persistence

This project now supports syncing scheduler data to a Cloudflare Worker endpoint. The worker reads/writes a JSON file in a GitHub repository using the GitHub Contents API.

## 1) Deploy the Worker

1. Copy `cloudflare-worker/worker.ts` into a Worker project (`wrangler init`).
2. Add Worker secrets/vars:
   - `GITHUB_TOKEN`: GitHub fine-grained token with **Contents: Read and write** permission.
   - `GITHUB_OWNER`: GitHub username/org.
   - `GITHUB_REPO`: Repository name.
   - `GITHUB_BRANCH`: Branch to store data (optional, defaults to `main`).
   - `GITHUB_FILE_PATH`: File path like `data/booking-state.json`.
   - `API_KEY`: Optional shared secret used by frontend `Authorization: Bearer <key>`.
3. Deploy using Wrangler.

## 2) Configure frontend

Create `.env` (or set in deployment environment):

```bash
VITE_WORKER_API_URL="https://<your-worker>.workers.dev"
VITE_WORKER_API_KEY="<same API_KEY if enabled>"
```

## 3) Runtime behavior

- App requires `VITE_WORKER_API_URL`; without it, the UI shows a configuration error.
- On startup, app loads state from the worker `GET` endpoint.
- If remote load fails or returns invalid payload, app shows an error screen.
- Every state update is synced to worker with `PUT` (localStorage persistence is disabled).
