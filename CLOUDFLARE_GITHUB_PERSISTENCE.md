# Cloudflare Worker + GitHub JSON persistence

This project supports syncing scheduler data to a Cloudflare Worker endpoint. The worker reads/writes booking state to a JSON file in a GitHub repository using the GitHub Contents API.

## 1) Prepare GitHub repository access

1. Choose a repository that will store the scheduler JSON file.
2. Create a personal access token (classic or fine-grained) with **repo contents read/write** permission for that repository.
3. Record these values:
   - GitHub owner/org name
   - Repository name
   - Branch name (for example `main`)
   - File path (for example `data/booking-state.json`)
   - GitHub token

## 2) Deploy the Worker

1. Copy `cloudflare-worker/worker.js` into a Worker project (`wrangler init`).
2. Add Worker secrets/vars:
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_TOKEN`
   - `GITHUB_BRANCH` (optional, defaults to `main`)
   - `GITHUB_FILE_PATH` (optional, defaults to `data/booking-state.json`)
   - `API_KEY` (optional shared secret used by frontend `Authorization: Bearer <key>`)
3. Deploy using Wrangler.

## 3) Configure frontend

Create `.env` (or set in deployment environment):

```bash
VITE_WORKER_API_URL="https://<your-worker>.workers.dev"
VITE_WORKER_API_KEY="<same API_KEY if enabled>"
```

## 4) Runtime behavior

- App requires `VITE_WORKER_API_URL`; without it, the UI shows a configuration error.
- On startup, app loads state from the worker `GET` endpoint.
- If remote load fails or returns invalid payload, app shows an error screen.
- Every state update is synced to worker with `PUT` (localStorage persistence is disabled).
- Worker stores all state in the configured GitHub JSON file.

## Troubleshooting

- `GitHub read failed (401/403)`: verify `GITHUB_TOKEN` permissions and repo access.
- `GitHub write failed (409/422)`: check branch protection rules and token write scope.
- If the file does not exist yet, the worker creates it automatically on first `PUT`.
