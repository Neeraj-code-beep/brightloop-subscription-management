# Brightloop Subscription Management System (SMS)

Enterprise Subscription Management System built for Brightloop Software to manage customer lifecycles, recurring billing plans, quotations, automated invoice generation, payment reconciliations, and an AI-powered billing assistant.

---

## 1. Architecture & Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS, shadcn/ui, Lucide React, React Router 7, Axios |
| **Backend** | Node.js, Express 5 (ESM), PostgreSQL (Neon Database), Prisma ORM, JWT, Zod, bcryptjs |
| **Background Processing** | Redis, BullMQ, Dedicated Worker Process, node-cron |
| **AI Service** | Node.js, TypeScript, Google Gemini API, Model Context Protocol (MCP) SDK, pgvector |
| **Testing** | Vitest, Supertest, Playwright |
| **Infrastructure** | Docker Compose (Local Redis & Queues), Neon Database (Managed Cloud Postgres) |

---

## 2. Repository Structure

```
subscription-management-system/
│
├── frontend/                     # React 19 + Vite SPA (Lead: Frontend Developer)
│   ├── public/                   # Static public assets
│   ├── src/
│   │   ├── assets/               # Local icons and media
│   │   ├── components/           # UI and Shared components (shadcn/ui compatible)
│   │   │   ├── ui/
│   │   │   └── shared/
│   │   ├── layouts/              # App root and navigation layouts
│   │   ├── pages/                # Route pages (auth, admin, staff, customer)
│   │   ├── features/             # Feature-specific modules
│   │   ├── hooks/                # Custom React hooks
│   │   ├── services/             # Axios API client and data services
│   │   ├── context/              # React Context (AuthContext)
│   │   ├── routes/               # AppRoutes and route definitions
│   │   ├── utils/                # Utility helpers (cn, formatters)
│   │   ├── constants/            # Application constants
│   │   ├── App.jsx               # Application root component
│   │   └── main.jsx              # React DOM entry point
│   ├── .env.example              # Frontend environment template
│   └── package.json
│
├── backend/                      # Express 5 REST API & Queues (Lead: Backend Developer)
│   ├── prisma/
│   │   └── schema.prisma         # Prisma schema for Neon PostgreSQL
│   ├── src/
│   │   ├── config/               # Environment & app configuration
│   │   ├── middleware/           # Auth, error handling, Zod validation
│   │   ├── modules/              # Modular domain controllers and routes
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── customers/
│   │   │   ├── products/
│   │   │   ├── plans/
│   │   │   ├── quotations/
│   │   │   ├── subscriptions/
│   │   │   ├── invoices/
│   │   │   ├── taxes/
│   │   │   ├── discounts/
│   │   │   ├── payments/
│   │   │   └── analytics/
│   │   ├── queues/               # BullMQ queue definitions
│   │   ├── workers/              # Dedicated background billing workers
│   │   ├── schedulers/           # node-cron recurring schedules
│   │   ├── utils/                # Standardized response envelopes
│   │   ├── app.js                # Express app setup
│   │   └── server.js             # HTTP server entry point
│   ├── tests/                    # Vitest & Supertest suite
│   ├── .env.example              # Backend environment template
│   └── package.json
│
├── ai-service/                   # Gemini & MCP Service (Lead: AI & Platform Developer)
│   ├── src/
│   │   ├── config/               # AI service configuration
│   │   ├── gemini/               # Google Gemini client integration
│   │   ├── mcp/                  # Model Context Protocol server & tool registry
│   │   │   └── tools/
│   │   ├── rag/                  # pgvector document retriever
│   │   ├── embeddings/           # Vector embeddings generator
│   │   ├── services/             # Billing assistant business logic
│   │   ├── utils/                # Response helpers
│   │   └── index.ts              # Express HTTP & MCP entry point
│   ├── tests/                    # Vitest suite
│   ├── .env.example              # AI Service environment template
│   └── package.json
│
├── shared/                       # Shared Team Documentation & Contracts
│   ├── API_CONTRACT.md           # Unified REST API specifications & status codes
│   ├── DATABASE_SCHEMA.md        # Entity definitions & relationships
│   └── PROJECT_RULES.md          # Multi-developer collaboration rules
│
├── .gitignore                    # Git ignore file for secrets and dependencies
├── .editorconfig                 # Consistent indentation & formatting across editors
├── docker-compose.yml            # Local Redis container for queue development
├── package.json                  # Root npm workspace scripts
└── README.md                     # Project documentation
```

---

## 3. Getting Started

### 3.1 Prerequisites
- **Node.js**: v20 or higher (v22 LTS recommended)
- **npm**: v10 or higher
- **Docker Desktop**: for running local Redis
- **Neon PostgreSQL**: an active connection string from Neon

### 3.2 Quick Setup (Root Workspace)
Install all dependencies across the entire project at once:

```bash
# Install dependencies for all workspaces
npm run install:all
```

Alternatively, install each subproject independently:
```bash
cd backend && npm install
cd ../frontend && npm install
cd ../ai-service && npm install
```

---

## 4. Environment Configuration

Copy each `.env.example` to `.env` in its respective directory:

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env

# AI Service
cp ai-service/.env.example ai-service/.env
```

Configure your secrets:
- `backend/.env`: Fill in `DATABASE_URL` (Neon PostgreSQL) and `JWT_SECRET`.
- `frontend/.env`: Verify `VITE_API_BASE_URL=http://localhost:5000/api/v1`.
- `ai-service/.env`: Add `GEMINI_API_KEY`.

---

## 5. Running the Application

### 5.1 Start Local Redis
BullMQ and background queues require Redis. Start the container:
```bash
docker compose up -d
```

### 5.2 Start Backend API
```bash
cd backend
npm run dev
# Server running at http://localhost:5000
# Health check: http://localhost:5000/health
```

### 5.3 Start Background Worker Process
The background worker executes billing queues independently from the web server:
```bash
cd backend
npm run worker
```

### 5.4 Start Frontend SPA
```bash
cd frontend
npm run dev
# SPA running at http://localhost:5173
```

### 5.5 Start AI Service
```bash
cd ai-service
npm run dev
# AI Service running at http://localhost:5001
# Health check: http://localhost:5001/health
```

---

## 6. Testing & Quality Verification

Run tests independently or via root workspace:

```bash
# Run backend tests
npm --workspace=backend run test

# Run frontend tests
npm --workspace=frontend run test

# Run AI service tests
npm --workspace=ai-service run test
```

---

## 7. Health Check Endpoints

| Service | Endpoint | Description |
|---|---|---|
| **Backend** | `GET http://localhost:5000/health` | Basic service status |
| **Backend API v1** | `GET http://localhost:5000/api/v1/health` | API version 1 health |
| **AI Service** | `GET http://localhost:5001/health` | AI service & Gemini connectivity |
| **AI Service v1** | `GET http://localhost:5001/api/v1/ai/health` | AI API version 1 health |

---

## 8. Team Collaboration & Git Guidelines

Three developers work concurrently using dedicated feature branches off `main`:

- **Developer 1 (Frontend)**: works within `frontend/` on `feature/fe-<name>`
- **Developer 2 (Backend)**: works within `backend/` on `feature/be-<name>`
- **Developer 3 (AI Service)**: works within `ai-service/` on `feature/ai-<name>`

> [!IMPORTANT]
> Always consult `shared/PROJECT_RULES.md` and `shared/API_CONTRACT.md` before making architectural or API adjustments. Never commit `.env` files.

