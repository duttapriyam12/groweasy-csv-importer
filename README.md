# GrowEasy AI CSV Lead Importer

An AI-powered importer that takes a CSV in **any layout** (Facebook lead export, Google Ads export, a manually made spreadsheet, a real-estate CRM export...) and intelligently maps it to the fixed GrowEasy CRM schema, using an LLM (Groq's Llama 3.3 70B by default, via an OpenAI-compatible API) rather than hardcoded column-name matching.

## Features

- AI-powered CSV mapping using Groq Llama 3.3
- Supports CSVs with arbitrary column layouts
- Client-side CSV preview
- Real-time upload progress
- AI batch processing progress
- Parallel batch processing
- Retry with exponential backoff
- Server-side validation
- Responsive UI
- Dark mode support
- Sticky table headers with horizontal & vertical scrolling

## Architecture

```text
groweasy-csv-importer/
├── backend/     Node.js + Express + TypeScript API
│   └── src/
│       ├── index.ts                        Express app entry point
│       ├── routes/upload.route.ts           POST /api/upload
│       ├── services/csvParser.service.ts    CSV -> raw row objects
│       ├── services/aiExtractor.service.ts  Prompt engineering + Groq calls + batching + validation
│       ├── utils/batch.util.ts              Chunking helper
│       ├── utils/date.util.ts               Deterministic date normalization safety net
│       └── types/crm.types.ts               Shared CRM types & allowed enum values
├── frontend/    Next.js (App Router) + TypeScript + Tailwind
│   └── app/page.tsx                         4-step flow: Upload -> Preview -> Confirm -> Result
└── sample-csvs/ Three differently-shaped test files (Facebook-style, Google Ads-style, messy manual sheet)
```

### Frontend Workflow

```
Upload CSV
    ↓
Preview Raw CSV
    ↓
Confirm & Import
    ↓
AI Mapping
    ↓
Result (Imported + Skipped)
```

### How the AI mapping works

1. Frontend parses the CSV client-side (Papaparse) purely for **preview** — no AI call yet.
2. On "Confirm & Import", the raw file is sent to the backend.
3. Backend re-parses the CSV, splits rows into batches (default 25 rows/batch, configurable via `BATCH_SIZE`), and sends each batch to Groq (Llama 3.3 70B) with a detailed prompt that:
   - Lists every CRM field with its meaning
   - Gives the exact allowed enum values for `crm_status` and `data_source`
   - Encodes every rule from the assignment (multi-email/mobile handling, date format, skip condition, etc.)
   - Forces strict JSON output (`response_format: { type: "json_object" }`)
4. All AI-generated output is validated and sanitized on the server before being returned to the client (enum values, required email/mobile check, deterministic date normalization).
5. Frontend shows imported vs skipped records with counts.

## Setup

### Prerequisites
- Node.js 18+
- A free Groq API key from https://console.groq.com/keys

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# open .env and paste your GROQ_API_KEY
npm run dev
```
Backend runs at `http://localhost:5000`. Health check: `GET /api/health`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```
Frontend runs at `http://localhost:3000`.

### 3. Run the Application

Open `http://localhost:3000`, upload any CSV from the `sample-csvs` directory (or your own CSV), preview the data, click **Confirm & Import with AI**, and review the extracted CRM records.

## Environment Variables

**Backend (`backend/.env`)**
```
GROQ_API_KEY=your_groq_api_key
OPENAI_MODEL=llama-3.3-70b-versatile
PORT=5000
FRONTEND_ORIGIN=http://localhost:3000
BATCH_SIZE=25
MAX_FILE_SIZE_BYTES=5242880
```

**Frontend (`frontend/.env.local`)**
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

## API Endpoints

### Health Check
`GET /api/health`

Returns server health status.

### Start Import
`POST /api/upload/start`

Accepts a multipart/form-data request with a CSV file.

Response

```json
{
  "jobId": "...",
  "totalBatches": 5
}
```

### Job Status
`GET /api/upload/status/:jobId`

Returns processing status and final import result.

## Deployment (suggested, free-tier friendly)
- **Backend** → Render or Railway (Node service). Set `GROQ_API_KEY`, `OPENAI_MODEL`, `BATCH_SIZE`, `FRONTEND_ORIGIN` (your deployed frontend URL) as env vars.
- **Frontend** → Vercel. Set `NEXT_PUBLIC_API_BASE_URL` to your deployed backend URL.

> Note: the backend is hosted on a free-tier instance and may take 30-60 seconds to respond on the first request after a period of inactivity, while it spins back up.

## Switching AI providers
Only `backend/src/services/aiExtractor.service.ts` needs to change — swap the `baseURL` and model name in `getClient()`/`getModel()` for OpenAI/Gemini/Claude's equivalent; the prompt, batching, and validation logic stay the same.

## Notes on design choices
- **Batching + Promise.all**: batches are sent in parallel for speed; each batch fails independently (a failed batch is marked fully skipped with a reason, rather than crashing the whole import).
- **Retry**: each Groq call retries up to 2 times with backoff before giving up on a batch.
- **Server-side validation**: even though the prompt is strict, the backend re-validates every `crm_status` and `data_source`, enforces the "must have email or mobile" rule, and deterministically normalizes `created_at` (defaulting ambiguous DD-MM vs MM-DD dates to DD-MM-YYYY).

-Testing Purpose