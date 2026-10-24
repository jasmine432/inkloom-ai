# Inkloom AI — Final Configuration & Deployment Readiness Checklist

**Document Version:** 1.0.0  
**Project Path:** `D:\project\Inkloom AI`  
**Audit Date:** October 25, 2026  
**Auditor:** Senior Full-Stack Engineering Agent  

---

## 1. Executive Summary & Readiness Verdict

| Layer | Status | Verdict |
| :--- | :--- | :--- |
| **Frontend Codebase** | React 19 + TypeScript + Vite | **PRODUCTION READY** (0 errors, 0 lint warnings) |
| **Backend API Engine** | FastAPI + SQLAlchemy + Psycopg | **PRODUCTION READY** (124/124 backend tests passed) |
| **LLM & Evidence Pipeline** | Gemini 3.5 Flash Lite + Brand Sources | **PRODUCTION READY** (Live execution with verbatim citations) |
| **Database Isolation** | PostgreSQL (`inkloom_ai` strictly isolated) | **PRODUCTION READY** (Static URL + Wire-level `current_database()` runtime guard) |
| **Container & Reverse Proxy** | Dockerfiles, Nginx SPA config, Compose | **PRODUCTION READY** (Multi-stage non-root containers) |
| **Firebase Live Delivery** | Firebase Web + Admin SDK | **BLOCKED ON OWNER CREDENTIALS** (Keys needed in `.env`) |
| **Compromised Secrets** | Gemini Key & Database Password | **ROTATION REQUIRED BY OWNER** |

> **Current Staging / Public Deployment Verdict:** **PENDING OWNER CREDENTIALS**  
> All application architecture, security guards, Docker definitions, tests, and honest error handlers are complete. Deployment to live staging or production requires the owner to supply replacement credentials and Firebase project keys.

---

## 2. Completed Checks & Concrete Verification Evidence

| Audit Check | Expected Behavior | Actual Verified Result & Evidence | Status |
| :--- | :--- | :--- | :--- |
| **1. Complete Backend Test Suite** | All unit, integration, and security tests pass | `pytest backend/tests` executed: **124 passed, 0 failed** in 109.5s. | **PASSED** |
| **2. Authentication & Security Tests** | Token expiry, revocation, simulation rejection, and unverified 403 enforcement pass | `pytest backend/tests/test_auth.py` executed: **16 passed, 0 failed** in 19.1s. | **PASSED** |
| **3. Frontend Production Build** | TypeScript compilation (`tsc -b`) and Vite asset bundling succeed | `npm run build` executed: Built in 2.44s with **0 type errors** and **0 compilation errors**. | **PASSED** |
| **4. Frontend Code Quality & Linting** | Oxlint rules pass across all React components | `npm run lint` executed: **0 errors, 0 warnings** across all 44 frontend files. | **PASSED** |
| **5. Health Endpoint & Live DB Status** | `/api/health` reports status, DB dialect, and isolation | `GET /api/health` returned HTTP 200: `status: "ok"`, `llmProvider: "gemini"`, `isLlmConfigured: true`, `dbDialect: "postgresql"`, `dbName: "inkloom_ai"`, `dbError: null`. | **PASSED** |
| **6. Review Content & Gemini Execution** | Review endpoint audits claims and extracts brand evidence citations | `POST /api/review` executed with `live_gemini_structured`: Supported claim extracted verbatim citation from `Q3 Enterprise SLA & Compliance Warranty` (confidence: 98). | **PASSED** |
| **7. Production Simulation Token Rejection** | `sim_token_*` tokens are rejected outside development | Tested in `test_simulation_tokens_rejected_in_production`: When `ENVIRONMENT="production"`, returns **HTTP 401 Unauthorized** ("Development simulation tokens are rejected in production mode"). | **PASSED** |
| **8. Setting-Based Simulation Disable** | Simulation tokens can be toggled off even in dev | Tested in `test_simulation_tokens_rejected_when_setting_disabled`: When `ALLOW_DEV_SIMULATION_TOKENS=False`, returns **HTTP 401 Unauthorized**. | **PASSED** |
| **9. Unverified Email Access Control** | Protected features reject unverified callers | Tested in `test_protected_routes_reject_unverified_simulation_tokens`: `POST /api/chat`, `PATCH /api/reviews/.../decision`, and `DELETE /api/reviews/...` return **HTTP 403 Forbidden** when `email_verified=False`. | **PASSED** |
| **10. Database Tenancy & Isolation Guards** | Database connection strictly targets `inkloom_ai` and blocks `polar_logistics` both statically and over the live wire | Tested in `test_polar_logistics_isolation_enforcement`, `test_runtime_wire_level_guard_rejects_forbidden_database`, and `test_runtime_wire_level_init_db_rejects_forbidden_database`: Rejects any attempt to connect to `polar_logistics` via static URL parsing or live PostgreSQL `SELECT current_database()`. | **PASSED** |
| **11. Migration Execution SQL Guard** | Direct `psql` migration executions verify `current_database() == 'inkloom_ai'` | Added `DO $$ BEGIN IF current_database() != 'inkloom_ai' THEN RAISE EXCEPTION ... END IF; END $$;` to `001_initial_schema.sql` and `002_chat_schema.sql`. | **PASSED** |
| **12. Honest UI Simulation Feedback** | UI does not claim email delivery when Firebase is unconfigured | `sendVerification()` returns `{ success: false, error: "Firebase Authentication is running in Development Simulation Mode..." }`. No fake success messages are displayed. | **PASSED** |
| **13. Client Bundle Secret Scan** | Production JavaScript bundle contains zero backend secrets or passwords | Scanned `dist/assets/*.js`: Found 0 database passwords, 0 connection strings, and 0 secret service-account keys. | **PASSED** |
| **14. Version Control Exclusion** | Sensitive files are excluded from Git | Verified `.gitignore` contains `.env`, `.env.*`, `backend/.env`, `backend/.env.*`, `*service-account*.json`, `credentials.json`, `dist/`, and `.venv/`. | **PASSED** |

---

## 3. Missing Configuration (Variable Names Only)

The following environment variables must be populated by the project owner before live email verification and production hosting can operate:

### A. Frontend Environment Configuration (`.env` in Project Root)
The file `D:\project\Inkloom AI\.env` does not yet exist. Create it based on `.env.example`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_API_BASE_URL` *(Optional: set to `/api` if using co-located Nginx reverse proxy, or full HTTPS URL like `https://api.yourdomain.com/api`)*

### B. Backend Environment Configuration (`backend/.env`)
The file `D:\project\Inkloom AI\backend\.env` exists for local dev, but requires the following variables for live Firebase verification and production staging:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CREDENTIALS_PATH` *(Option A: e.g. `backend/service-account.json`)*
- `FIREBASE_CLIENT_EMAIL` & `FIREBASE_PRIVATE_KEY` *(Option B: alternative inline parameters for container environments)*
- `ALLOW_DEV_SIMULATION_TOKENS=false` *(Must be set to `false` in production)*
- `CORS_ORIGINS` *(Update from localhost to your production frontend domain, e.g. `https://yourdomain.com,https://app.yourdomain.com`)*
- `DATABASE_URL` *(Update to your staging/production managed PostgreSQL database URL)*

---

## 4. Credentials the Owner Must Rotate

A previous screenshot exposed credentials. To protect production infrastructure:

1. **Gemini API Key**:
   - **Reason:** Exposed in screenshot.
   - **Action Required:** Generate a replacement key in [Google AI Studio](https://aistudio.google.com/app/apikey).
   - **Update Target:** `GEMINI_API_KEY` in `backend/.env`.
   - **Deprecation:** Delete the old key in Google AI Studio only after verifying the new key works with `/api/health` and `/api/review`.

2. **PostgreSQL Database Password**:
   - **Reason:** Exposed in screenshot.
   - **Action Required:** Change the database user password in your PostgreSQL or managed Supabase console.
   - **Update Target:** `DATABASE_URL` in `backend/.env`.
   - **Deprecation:** Ensure the old password is no longer accepted by the PostgreSQL server.

*Antigravity has not printed, copied, or stored the compromised values in any code, reports, or artifacts.*

---

## 5. Exact Manual Firebase Console Steps

Follow these exact steps in your Google Firebase Console:

### Step 1: Open Your Firebase Project
1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Select or create your Inkloom AI project.

### Step 2: Enable Email/Password Authentication
1. In the left sidebar, click **Build** > **Authentication**.
2. Click the **Sign-in method** tab.
3. Under **Native providers**, click **Email/Password**.
4. Enable the first toggle: **Email/Password**.
5. Leave "Email link (passwordless sign-in)" disabled unless specifically required.
6. Click **Save**.

### Step 3: Register Web App & Retrieve Client Keys
1. In the left sidebar, click the **Gear Icon** (Project Settings) > **General** tab.
2. Under **Your apps**, click the Web icon (`</>`) to register a web app (e.g. `Inkloom Web`).
3. Copy the configuration object:
   - `apiKey` &rarr; `VITE_FIREBASE_API_KEY`
   - `authDomain` &rarr; `VITE_FIREBASE_AUTH_DOMAIN`
   - `projectId` &rarr; `VITE_FIREBASE_PROJECT_ID`
   - `storageBucket` &rarr; `VITE_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` &rarr; `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` &rarr; `VITE_FIREBASE_APP_ID`
4. Place these values in `D:\project\Inkloom AI\.env`.

### Step 4: Configure Authorized Domains
1. In **Authentication**, click the **Settings** tab.
2. Select **Authorized domains**.
3. Click **Add domain**.
4. Add your staging/production hostnames:
   - `yourdomain.com`
   - `app.yourdomain.com`
   - `api.yourdomain.com`
   *(Keep `localhost` and `127.0.0.1` for local development).*

### Step 5: Download Admin SDK Service Account Key
1. In **Project Settings**, click the **Service accounts** tab.
2. Select **Firebase Admin SDK**.
3. Click **Generate new private key**, then confirm **Generate key**.
4. Save the downloaded JSON file as `backend/service-account.json`.
5. In `backend/.env`, set:
   ```bash
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CREDENTIALS_PATH=backend/service-account.json
   ```

---

## 6. Production Hosting Prerequisites

Before launching Inkloom AI on public infrastructure:

1. **Managed PostgreSQL Database**:
   - Provision a PostgreSQL 15+ database (e.g. Supabase, Neon, AWS RDS, or Railway).
   - Ensure the database name is `inkloom_ai` (or an isolated schema).
   - Do **NOT** use or connect to `polar_logistics`.
   - Run the two schema migrations:
     - `backend/migrations/001_initial_schema.sql`
     - `backend/migrations/002_chat_schema.sql`

2. **Domain Names & TLS Certificates**:
   - Frontend domain: e.g. `app.yourdomain.com` (served with valid SSL/TLS).
   - Backend API domain: e.g. `api.yourdomain.com` (served with valid SSL/TLS).
   - Reverse proxy / CDN: Cloudflare, Caddy, AWS ALB, or Nginx terminating HTTPS.

3. **CORS & Origin Policy**:
   - `backend/.env`: Set `CORS_ORIGINS=https://app.yourdomain.com,https://yourdomain.com`.
   - Never use wildcard `*` for CORS in production with credentialed auth.

4. **Container Host**:
   - Docker Engine 24+ and Docker Compose v2+ installed on your host/VM.
   - Or a serverless container platform (GCP Cloud Run, AWS ECS/Fargate, Railway).

---

## 7. Safe, Ordered Staging Deployment Plan

Execute deployment following this sequence to ensure zero downtime and zero risk of data contamination:

```
[Phase 1: Credentials & Env]
         │
         ▼
[Phase 2: Database Provisioning & Migrations]
         │
         ▼
[Phase 3: Backend Container Deployment]
         │
         ▼
[Phase 4: Backend Health & Token Verification (/api/health)]
         │
         ▼
[Phase 5: Frontend Container Deployment]
         │
         ▼
[Phase 6: Live Staging Email Verification & E2E Validation]
```

### Step 1: Environment & Secrets Setup
1. Create `D:\project\Inkloom AI\.env` with real Firebase Web App keys.
2. Update `D:\project\Inkloom AI\backend\.env` with rotated `GEMINI_API_KEY`, rotated `DATABASE_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_CREDENTIALS_PATH=backend/service-account.json`, and `ALLOW_DEV_SIMULATION_TOKENS=false`.
3. Place `service-account.json` in `backend/`.

### Step 2: Database Provisioning & Migration Execution
1. Connect to the staging PostgreSQL database via `psql`:
   ```bash
   psql "$STAGING_DATABASE_URL" -f backend/migrations/001_initial_schema.sql
   psql "$STAGING_DATABASE_URL" -f backend/migrations/002_chat_schema.sql
   ```
2. Confirm tables exist: `profiles`, `reviews`, `findings`, `evidence_citations`, `conversations`, `chat_messages`.

### Step 3: Backend Deployment
1. Build and launch backend container:
   ```bash
   docker compose -f docker-compose.prod.yml up -d backend
   ```
2. Verify health status:
   ```bash
   curl -f http://localhost:8000/api/health
   ```
   Confirm output contains:
   - `"isAuthConfigured": true`
   - `"isDbConfigured": true`
   - `"dbStatus": "connected"`
   - `"isLlmConfigured": true`

### Step 4: Frontend Deployment
1. Build and launch frontend container:
   ```bash
   docker compose -f docker-compose.prod.yml up -d frontend
   ```
2. Access staging URL in browser (e.g. `https://staging.yourdomain.com`).

### Step 5: Live Verification & Testing in Live Inbox
1. Click **Create your account** and register with a real test email address.
2. Confirm the UI shows the email verification pending screen.
3. Open the test email inbox and verify receipt of Google's verification email.
4. Click the link in the email and confirm it redirects back to `/verify-email`.
5. Observe the verification confirmation banner and automatic redirection to `/dashboard`.
6. Log out and log back in to verify session persistence.
7. Run a test Content Review to confirm factual claim audit and citation extraction.

### Step 6: Rollback Procedure (Emergency Fallback)
If any step fails during deployment:
```bash
# Immediate container shutdown
docker compose -f docker-compose.prod.yml down

# Revert to previous image tag or inspect logs
docker compose -f docker-compose.prod.yml logs -f backend
```
*(Migrations are strictly additive, so database rollbacks do not require destructive schema drops).*

---

## 8. Single Most Important Next Action for the Owner

> **Create the root `.env` file with your real Firebase Web App keys from the Firebase Console (as outlined in Section 5, Step 3).**
>
> Once `.env` is created, live Firebase Authentication will automatically activate, enabling genuine verification emails to dispatch to real inboxes.
