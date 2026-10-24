# Inkloom AI — Production Deployment & Operations Runbook

This runbook provides the complete configuration, verification, migration, and operational procedure for deploying Inkloom AI to a secure production environment.

---

## 1. Architecture Summary

```
                      ┌────────────────────────────────────────┐
                      │            Firebase Auth               │
                      │  (Identity Provider & Email Dispatch)  │
                      └──────────────┬─────────────────────────┘
                                     │ ID Token (JWT)
                                     ▼
┌────────────────────────┐      ┌─────────────────────────────┐      ┌────────────────────────┐
│     Inkloom Web SPA    │ ───► │     FastAPI Backend API     │ ───► │   Managed PostgreSQL   │
│  (React 19 + Tailwind) │ CORS │  (Token Verification, LLM   │ Pool │ (Tenancy Isolation on  │
│      Nginx / CDN       │      │ Auditor, Evidence Retrieval)│      │  "inkloom_ai" database)│
└────────────────────────┘      └──────────────┬──────────────┘      └────────────────────────┘
                                               │
                                               ▼
                                ┌─────────────────────────────┐
                                │      Google Gemini API      │
                                │   (Factual Brand Auditing)  │
                                └─────────────────────────────┘
```

---

## 2. Production Environment Variables Checklist

### A. Frontend Environment Variables (`.env`)
These variables are bundled by Vite into the client application. They contain **public identifiers only**.
*Do NOT place database passwords, Gemini secret keys, or service-account credentials in this file.*

| Variable Name | Description | Example / Source |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Public Firebase API Key | Firebase Console > Project Settings > General > Web Apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | `[project-id].firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | `[project-id]` |
| `VITE_FIREBASE_STORAGE_BUCKET`| Firebase Storage Bucket | `[project-id].appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Cloud Messaging Sender ID | Numeric ID (e.g. `123456789012`) |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID | `1:[sender-id]:web:[app-hash]` |
| `VITE_API_BASE_URL` | Production FastAPI Base URL | `https://api.yourdomain.com/api` |

### B. Backend Environment Variables (`backend/.env`)
These variables are loaded strictly on the server and must **NEVER** be committed to Git or exposed to clients.

| Variable Name | Description | Production Value / Example |
| :--- | :--- | :--- |
| `ENVIRONMENT` | Runtime environment | `production` |
| `HOST` | Binding interface | `0.0.0.0` |
| `PORT` | Listening port | `8000` |
| `CORS_ORIGINS` | Permitted frontend origins | `https://yourdomain.com,https://app.yourdomain.com` |
| `ALLOW_DEV_SIMULATION_TOKENS` | Reject mock tokens | `false` *(Critical: must be false in production)* |
| `REQUIRE_EMAIL_VERIFIED` | Enforce verification | `true` |
| `AUTH_RATE_LIMIT_PER_MINUTE` | Rate limiting | `60` |
| `LLM_PROVIDER` | Fact-checking engine | `gemini` |
| `GEMINI_API_KEY` | Server-side Gemini API key | Rotated secret from Google AI Studio |
| `GEMINI_MODEL` | Auditor model | `gemini-3.5-flash-lite` |
| `LLM_TIMEOUT_SECONDS` | Request timeout | `45.0` |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql+psycopg://user:pass@host:5432/inkloom_ai` |
| `DB_POOL_SIZE` | SQLAlchemy connection pool | `10` |
| `DB_MAX_OVERFLOW` | Overflow pool connections | `20` |
| `FIREBASE_PROJECT_ID` | Server verification project | `[project-id]` |
| `FIREBASE_CREDENTIALS_PATH` | Service account JSON path | `backend/service-account.json` |

---

## 3. Firebase Console Configuration Guide

### 1. Enable Email/Password Provider
1. Log in to [Firebase Console](https://console.firebase.google.com/).
2. Select your Inkloom AI project.
3. In the left navigation, go to **Build** > **Authentication**.
4. Select the **Sign-in method** tab.
5. Under **Native providers**, click **Email/Password**.
6. Switch the **Enable** toggle to ON. Leave "Email link (passwordless sign-in)" OFF.
7. Click **Save**.

### 2. Configure Authorized Domains
1. In the **Authentication** section, click the **Settings** tab.
2. Select **Authorized domains**.
3. Ensure your production domains are listed:
   - `yourdomain.com`
   - `app.yourdomain.com`
   - `api.yourdomain.com`
   - *(Keep `localhost` and `127.0.0.1` for local staging/development only).*

### 3. Generate Backend Service Account Key
1. Click the gear icon (Project Settings) > **Service accounts** tab.
2. Ensure **Firebase Admin SDK** is selected.
3. Click **Generate new private key**, then confirm **Generate key**.
4. Save the downloaded JSON file as `backend/service-account.json` on your server.
5. Ensure file permissions are restricted: `chmod 600 backend/service-account.json`.

---

## 4. Managed PostgreSQL Database Setup & Isolation

Inkloom AI requires its own isolated database named `inkloom_ai`. It must never share schemas or tables with other applications (such as `polar_logistics`).

### 1. Database Creation
Connect to your PostgreSQL 16+ or Supabase instance as administrator:
```sql
CREATE DATABASE inkloom_ai
    WITH 
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    CONNECTION LIMIT = -1;
```

### 2. Migration Execution
Run the versioned migration scripts in numerical sequence:
```bash
# Migration 001: Core tables (profiles, reviews, findings, evidence citations)
psql "$DATABASE_URL" -f backend/migrations/001_initial_schema.sql

# Migration 002: Assistant chat tables (conversations, chat messages)
psql "$DATABASE_URL" -f backend/migrations/002_chat_schema.sql
```

### 3. Database Backup Procedure
Execute scheduled or pre-deployment backups:
```bash
pg_dump -Fc --no-owner --no-privileges "$DATABASE_URL" > "inkloom_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### 4. Database Restore Procedure (Disaster Recovery)
```bash
pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" inkloom_backup_YYYYMMDD_HHMMSS.dump
```

---

## 5. Credential Rotation Runbook

When rotating external credentials that were previously exposed:

### A. Rotating the Gemini API Key
1. Visit [Google AI Studio > API Keys](https://aistudio.google.com/app/apikey).
2. Click **Create API key** to create a replacement key.
3. Edit `backend/.env`:
   ```bash
   GEMINI_API_KEY=AIzaSy...new_replacement_key...
   ```
4. Restart the FastAPI backend.
5. Verify health:
   ```bash
   curl -s http://127.0.0.1:8000/api/health | grep '"isLlmConfigured":true'
   ```
6. Run a test review via `POST /api/review`.
7. Once verified, return to Google AI Studio and delete the old compromised key.

### B. Rotating the PostgreSQL Database Password
1. In your managed database console (e.g. Supabase Settings > Database > Database Password, or AWS RDS):
   Change the user password for the `inkloom_ai` user.
2. Update `backend/.env`:
   ```bash
   DATABASE_URL=postgresql+psycopg://username:NEW_PASSWORD@host:port/inkloom_ai
   ```
3. Restart the FastAPI backend.
4. Verify connectivity:
   ```bash
   curl -s http://127.0.0.1:8000/api/health | grep '"dbStatus":"connected"'
   ```

---

## 6. Docker Deployment Commands

### Option 1: Docker Compose (All-in-One)
Ensure root `.env` and `backend/.env` are populated.
```bash
# Build and start services in detached mode
docker compose -f docker-compose.prod.yml up --build -d

# Check container status
docker compose -f docker-compose.prod.yml ps

# View backend logs
docker compose -f docker-compose.prod.yml logs -f backend
```

### Option 2: Standalone Container / Cloud Run / Kubernetes

#### Backend Container:
```bash
docker build -f Dockerfile.backend -t inkloom-backend:v1.0.0 .
docker run -d \
  --name inkloom-backend \
  --restart always \
  -p 8000:8000 \
  --env-file backend/.env \
  inkloom-backend:v1.0.0
```

#### Frontend Container:
```bash
docker build -f Dockerfile.frontend \
  --build-arg VITE_FIREBASE_API_KEY="your-api-key" \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com" \
  --build-arg VITE_FIREBASE_PROJECT_ID="your-project-id" \
  --build-arg VITE_FIREBASE_STORAGE_BUCKET="your-app.appspot.com" \
  --build-arg VITE_FIREBASE_MESSAGING_SENDER_ID="1234567890" \
  --build-arg VITE_FIREBASE_APP_ID="1:1234567890:web:abcdef" \
  --build-arg VITE_API_BASE_URL="https://api.yourdomain.com/api" \
  -t inkloom-frontend:v1.0.0 .

docker run -d \
  --name inkloom-frontend \
  --restart always \
  -p 80:80 \
  inkloom-frontend:v1.0.0
```

---

## 7. Zero-Downtime Deployment & Rollback Strategy

1. **Pre-Deployment Check**:
   - Run automated test suite: `pytest backend/tests`.
   - Run frontend build & lint: `npm run build && npm run lint`.
   - Verify database migrations are backward-compatible.
2. **Deploy Backend**:
   - Launch new container instances with updated tag.
   - Verify `/api/health` returns HTTP 200 with `status: ok` and `dbStatus: connected`.
   - Switch reverse proxy traffic to new backend instances.
3. **Deploy Frontend**:
   - Deploy new frontend bundle to CDN or web containers.
4. **Rollback Procedure**:
   - If backend fails health check, immediately route reverse proxy traffic back to previous container tag.
   - If frontend assets fail, revert CDN pointer or redeploy previous container tag.
   - Database changes: migrations are strictly additive (no destructive drops or alters).
