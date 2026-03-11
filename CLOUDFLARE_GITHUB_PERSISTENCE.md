# Cloudflare Worker + MongoDB persistence

This project supports syncing scheduler data to a Cloudflare Worker endpoint. The worker reads/writes booking state in MongoDB through the MongoDB Atlas Data API.

## 1) Prepare MongoDB Atlas Data API

1. In Atlas, create (or choose) a cluster/database/collection for scheduler state.
2. Enable the **Data API** for your project.
3. Create a Data API key.
4. Record the following values:
   - Data API base URL (example: `https://data.mongodb-api.com/app/<app-id>/endpoint/data/v1`)
   - Data source name (usually `Cluster0`)
   - Database name
   - Collection name

## 2) Deploy the Worker

1. Copy `cloudflare-worker/worker.js` into a Worker project (`wrangler init`).
2. Add Worker secrets/vars:
   - `MONGODB_DATA_API_URL`
   - `MONGODB_DATA_API_KEY`
   - `MONGODB_DATA_SOURCE`
   - `MONGODB_DATABASE`
   - `MONGODB_COLLECTION`
   - `MONGODB_DOCUMENT_ID` (optional, defaults to `booking-scheduler-state`)
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
- Worker stores all state inside one MongoDB document under the `state` field.
