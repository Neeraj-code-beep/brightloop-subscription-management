# SUBPILOT AI — STANDALONE READINESS & INTEGRATION GUIDE

This document serves as the authoritative developer and operations guide for the **SubPilot AI Service** (`ai-service/`) in the Brightloop Software Subscription Management System.

---

## 1. Architecture Overview

SubPilot AI is an enterprise-grade AI Billing Assistant and MCP service providing grounded, real-time responses to customer and staff billing queries:
- **Primary LLM**: Google Gemini (`gemini-3.8-flash`) via the modern `@google/genai` SDK.
- **RAG Subsystem**: Semantic retrieval powered by `gemini-embedding-001` with 768-dimensional normalized vectors and an in-memory cosine similarity store.
- **MCP Server & Client**: Model Context Protocol client exposing 9 authoritative billing tools connected via HTTP to the core backend.
- **Fallback Provider**: Hugging Face router (`meta-llama/Llama-3.1-8B-Instruct`) triggered on Gemini 429/503/timeout, grounded solely on verified MCP context.
- **Zero Financial Hallucination**: Verbatim preservation of exact INR decimal strings (e.g. `"35000.00 INR"`, `"4999.00 INR"`); never divides by 100 and never invents financial figures.
- **Cryptographic RBAC**: Authorization is derived strictly from backend `/api/v1/auth/me` verification. Prompt-level role claims are ignored.

---

## 2. Environment Configuration

The AI service reads configuration from `ai-service/.env` or system environment variables:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5001` | HTTP port for the AI service |
| `NODE_ENV` | `development` | Node environment (`development`, `test`, `production`) |
| `GEMINI_API_KEY` | *(required for live Gemini)* | Google Gemini API Key |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Configurable primary Gemini model |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-001` | 768-dimensional embedding model |
| `HUGGINGFACE_API_KEY` | *(optional fallback)* | Hugging Face user access token (alias: `HF_TOKEN`) |
| `HUGGINGFACE_MODEL` | `meta-llama/Llama-3.1-8B-Instruct` | Fallback chat completion model |
| `HUGGINGFACE_BASE_URL` | `https://router.huggingface.co/v1/chat/completions` | Hugging Face router endpoint |
| `BACKEND_API_URL` | `http://localhost:5000/api/v1` | Core backend endpoint (alias: `BACKEND_URL`) |

> **Security Note**: Never commit actual secrets into Git. `.env` is ignored by `.gitignore`.

---

## 3. Windows PowerShell Developer Commands

Because development is conducted on Windows, use the following PowerShell commands:

### A. Environment Setup in PowerShell
```powershell
# Set environment variables for the current PowerShell session
$env:PORT = "5001"
$env:NODE_ENV = "development"
$env:GEMINI_API_KEY = "your-real-gemini-key"
$env:GEMINI_MODEL = "gemini-3.8-flash"
$env:GEMINI_EMBEDDING_MODEL = "gemini-embedding-001"
$env:HUGGINGFACE_API_KEY = "your-hf-token"
$env:HUGGINGFACE_MODEL = "meta-llama/Llama-3.1-8B-Instruct"
$env:BACKEND_API_URL = "http://localhost:5000/api/v1"
```

### B. Core Development & Testing Scripts
Navigate into `ai-service/`:
```powershell
cd "d:\odoo hack\brightloop-subscription-management\ai-service"
```

| Task | PowerShell Command | Purpose |
| :--- | :--- | :--- |
| **Install Dependencies** | `npm install` | Installs runtime and dev dependencies |
| **TypeScript Check** | `npm run typecheck` | Validates TypeScript types across the service (`tsc --noEmit`) |
| **Run Unit & Offline Tests** | `npm test` | Runs the full Vitest suite (94 tests across 11 files) without paid API calls |
| **Run Mock Integration Tests** | `npm run test:mock` | Runs isolated MCP, chat pipeline, and fallback tests with mock backend |
| **Start Development Server** | `npm run dev` | Starts server on `http://localhost:5001` with hot reload (`tsx watch`) |
| **Build for Production** | `npm run build` | Compiles TypeScript files into `dist/` |
| **Start Production Server** | `npm start` | Runs compiled server from `dist/index.js` on port 5001 |

---

## 4. Standalone Live Diagnostics

SubPilot AI includes standalone, opt-in diagnostic scripts to verify external provider health without running paid requests during normal unit testing:

### A. Live Gemini Diagnostic
Tests connectivity, ping response, and synthetic function calling (`get_system_time`):
```powershell
npm run diag:gemini
```
*Output distinguishes: `SUCCESS`, `SKIPPED_NOT_CONFIGURED`, `AUTHENTICATION_ERROR`, `RATE_LIMIT_ERROR`, `SERVICE_OUTAGE_ERROR`.*

### B. Live Hugging Face Diagnostic
Tests chat completion against the Hugging Face router:
```powershell
npm run diag:hf
```
*Output distinguishes: `SUCCESS`, `SKIPPED_NOT_CONFIGURED`, `AUTHENTICATION_ERROR`, `RATE_LIMIT_ERROR` (HTTP 402/429 credits/quota), `AVAILABILITY_ERROR`.*

### C. Live Gemini Embedding Diagnostic
Tests real 768-dimensional vector generation and cosine self-similarity with `gemini-embedding-001`:
```powershell
npm run diag:embedding
```

### D. All Diagnostics Suite
Runs all three diagnostics concurrently and outputs a unified health table:
```powershell
npm run diag:all
```

---

## 5. API Endpoints on Port 5001

When running, the AI service exposes:

### `GET /api/v1/ai/health`
Public health status and provider configuration metadata:
```json
{
  "success": true,
  "data": {
    "status": "UP",
    "service": "sms-ai-service",
    "timestamp": "2026-10-31T09:50:00.000Z",
    "geminiConfigured": true,
    "huggingFaceConfigured": true
  }
}
```

### `POST /api/v1/ai/chat`
Authenticated chat endpoint for customer and staff queries:
- **Headers**: `Authorization: Bearer <JWT>`, `Content-Type: application/json`
- **Body**: `{"prompt": "What is my current subscription plan?"}`
- **Response**: Dual-key contract (`reply` and `answer` identical) for frontend compatibility:
```json
{
  "success": true,
  "data": {
    "reply": "You have 1 active subscription: Pro Monthly Tier at 4999.00 INR.",
    "answer": "You have 1 active subscription: Pro Monthly Tier at 4999.00 INR.",
    "toolsUsed": ["get_customer_subscriptions"],
    "provider": "gemini"
  }
}
```

### `POST /api/v1/ai/rag/query`
Authenticated RAG document retrieval endpoint:
- **Headers**: `Authorization: Bearer <JWT>`, `Content-Type: application/json`
- **Body**: `{"query": "What is the refund policy?"}`
- **Security**: Only returns documents permitted for the caller's verified role (`CUSTOMER`, `STAFF`, `ADMIN`).

---

## 6. External Team Integration Checkpoints

### Neeraj's Backend (`backend/`):
- Must expose `GET /api/v1/auth/me` returning `{ success: true, data: { id, role, customerId, email } }`.
- Must expose `/api/v1/customers/:id/*` and `/api/v1/analytics/*` adhering to agreed contract.
- If backend is offline, AI service safely returns 401/503 for unverified requests without breaking security.

### Lovish's Frontend (`frontend/`):
- Call `POST /api/v1/ai/chat` forwarding the user's Bearer JWT.
- Consume either `data.reply` or `data.answer` (both fields are populated identically).
- Display `data.toolsUsed` in debug/transparency view if desired.
