# Team Development Rules & Workflow Guidelines

These rules govern the development of the **Brightloop Software Subscription Management System (SMS)**. Three developers work concurrently using separate Git branches and AI coding agents. Adherence to these guidelines ensures minimal merge conflicts, consistent code quality, and reliable releases.

---

## The Ten Commandments

### Rule 1: Developer Folder Ownership
Each developer is the designated primary owner of a top-level component:
- **Developer 1 (Frontend Lead)**: `frontend/`
- **Developer 2 (Backend Lead)**: `backend/`
- **Developer 3 (AI & Platform Lead)**: `ai-service/`

Work should be confined to your designated module unless cross-cutting adjustments are explicitly agreed upon.

### Rule 2: No Uncoordinated Cross-Folder Modifications
Do not modify files in another developer's folder without explicit prior agreement.
- If the Frontend developer needs a new backend field, file a request or propose a change in `shared/API_CONTRACT.md` through discussion or a PR review.
- Shared directory files (`shared/`, `docker-compose.yml`, root configs) require team consensus.

### Rule 3: Do Not Change Shared API Contracts Independently
`shared/API_CONTRACT.md` and `shared/DATABASE_SCHEMA.md` are the single source of truth:
- Never alter endpoint request/response signatures, field names, or types in code without first updating and obtaining approval on `shared/API_CONTRACT.md`.
- Breaking changes must be versioned (e.g. `/api/v2`) or planned cooperatively.

### Rule 4: Use Meaningful Git Commit Messages
Follow the **Conventional Commits** specification:
- `feat(backend/invoices): implement recurring billing calculation`
- `fix(frontend/auth): resolve token refresh loop on expired session`
- `chore(ai-service): update Gemini SDK model parameters`
- `test(backend): add unit tests for discount basis point validation`
- `docs(shared): document payment refund error codes in API contract`

Avoid vague commits like "update files", "fix bug", or "wip".

### Rule 5: Never Commit `.env` Files or Secrets
- Never commit `.env`, `.env.local`, `.env.production`, private keys, API tokens, or database credentials.
- Always add placeholders and sample dummy values to `.env.example` in your respective service.
- If a secret is accidentally committed, immediately notify the team, rotate the secret, and purge it from Git history.

### Rule 6: All API Responses Must Follow the Agreed Envelope
Every backend and AI service endpoint must strictly return:
```json
// Success
{
  "success": true,
  "message": "Human-readable summary",
  "data": {}
}

// Error
{
  "success": false,
  "message": "Error summary",
  "errors": []
}
```
Never return raw un-enveloped arrays or strings from public routes.

### Rule 7: Write Readable, Modular Code
- Maintain clean separation of concerns:
  - Controllers handle HTTP routing and response formatting.
  - Services contain business logic.
  - Repositories/Prisma queries handle data access.
- Avoid 500-line monolithic files; split helpers, types, and middleware into dedicated modules.
- Use explicit variable and function naming (`calculateOverdueDays()` over `calcDays()`).

### Rule 8: Comment Non-Obvious Business Logic
- Self-documenting code is required, but financial logic requires explanatory context:
  - Explain why specific prorations are calculated the way they are.
  - Document timezone handling, leap year billing cycles, and rounding methodologies.
  - Document why certain status transitions are disallowed (e.g. transitioning `VOID` invoices).

### Rule 9: Test Before Pushing Changes
Before opening a Pull Request or pushing to a shared branch:
- Run the local linter/type-check: `npm run build` or `npm run type-check`.
- Execute automated tests: `npm test`.
- Verify your service boots and passes health checks.
- Verify zero regression on existing endpoints.

### Rule 10: Do Not Claim Feature Completion Without Verification
A task or user story is **only** complete when:
1. The code is tested with automated tests (unit/integration).
2. It has been verified against the actual running service or mock server.
3. Edge cases and error states (e.g. 400, 401, 404, 500) have been handled gracefully.
4. Relevant documentation in `shared/` or README has been updated.

---

## Git Branching Strategy

1. `main` is protected and represents production-ready code.
2. Developers create feature branches off `main`:
   - `feature/fe-<feature-name>` (Frontend)
   - `feature/be-<feature-name>` (Backend)
   - `feature/ai-<feature-name>` (AI Service)
3. Submit a Pull Request targeting `main`. At least one team member review is required before merging.

