# Brightloop AI Service — SubPilot AI

SubPilot is the autonomous billing assistant and Model Context Protocol (MCP) service for Brightloop Software Subscription Management System (SMS).

## Quick Start (Windows PowerShell)

```powershell
# 1. Install dependencies
cd "d:\odoo hack\brightloop-subscription-management\ai-service"
npm install

# 2. Typecheck
npm run typecheck

# 3. Run automated tests (offline, zero paid API usage)
npm test

# 4. Run mock backend MCP integration tests
npm run test:mock

# 5. Run live provider diagnostics (opt-in)
npm run diag:all

# 6. Start development server
npm run dev
```

For complete documentation, environment variable specifications, and integration checklists, please refer to:
- [READINESS_GUIDE.md](./READINESS_GUIDE.md)
- [INTEGRATION_REQUIREMENTS.md](./INTEGRATION_REQUIREMENTS.md)
