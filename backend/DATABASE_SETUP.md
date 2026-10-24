# Inkloom AI — PostgreSQL Database Setup Guide (Supabase)

This document provides setup instructions, schema architecture details, and security policies for connecting Inkloom AI to a persistent PostgreSQL database using Supabase.

---

## 1. Architectural Principles

1. **Firebase Authentication as Identity Provider**:
   - PostgreSQL **never** stores passwords, password hashes, or salt strings.
   - User identity is verified on every request using Firebase ID Tokens via FastAPI's `verify_firebase_token` dependency.
   - The `profiles` table stores only user identifiers (`user_id`, `email`, `display_name`, `email_verified`, timestamps).

2. **Strict Multi-Tenancy & User Isolation**:
   - Every private audit record (`reviews`, `findings`, and `evidence_citations`) has a mandatory `user_id` column referencing `profiles.user_id`.
   - Foreign key constraints with `ON DELETE CASCADE` ensure data integrity: deleting a user review cleanly cascades across all its findings and citations.
   - FastAPI enforces authorization on every read and write: all repository queries filter explicitly by `user_id == current_user.uid`. Attempting to access another user's review yields a `404 Not Found` or `403 Forbidden`.

3. **Separation of Concerns with Trusted Sources**:
   - Inkloom AI's ground-truth approved brand guidelines and SLA benchmark documents remain in `backend/data/sources/` managed by `source_store.py`.
   - PostgreSQL only stores user content and audit results (`profiles`, `reviews`, `findings`, `evidence_citations`), eliminating redundant source duplication while allowing source quotes to be cited with confidence scores.

4. **Zero Frontend Secret Leakage**:
   - Database credentials (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) are kept **strictly server-side** in `backend/.env`.
   - The frontend Vite bundle only receives public client configurations (`VITE_FIREBASE_API_KEY`, etc.) and communicates exclusively through authenticated FastAPI REST endpoints (`/api/reviews`, `/api/review`, etc.).

---

## 2. Database Schema Summary

The database consists of 4 relational tables defined in [migrations/001_initial_schema.sql](file:///D:/project/Inkloom%20AI/backend/migrations/001_initial_schema.sql):

### 1. `profiles`
Tracks user accounts synchronized from verified Firebase Auth tokens.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | `VARCHAR(128)` | `PRIMARY KEY` | Firebase UID |
| `email` | `VARCHAR(255)` | `INDEX` | Verified user email |
| `display_name` | `VARCHAR(255)` | | Full user display name |
| `email_verified` | `BOOLEAN` | `DEFAULT FALSE` | Email verification status |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Account creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Last profile update |

### 2. `reviews`
Stores marketing copy audits and compliance reviews created by users.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | Unique review identifier (`rev_...`) |
| `user_id` | `VARCHAR(128)` | `REFERENCES profiles(user_id) ON DELETE CASCADE`, `INDEX` | Owning Firebase user ID |
| `title` | `TEXT` | `NOT NULL` | Marketing campaign / draft title |
| `content` | `TEXT` | `NOT NULL` | Full draft text analyzed |
| `channel` | `VARCHAR(100)` | | Channel (e.g. Press Release, Social) |
| `target_audience` | `VARCHAR(100)` | | Target audience |
| `is_demo` | `BOOLEAN` | `DEFAULT FALSE` | Whether rule engine demo was used |
| `execution_mode` | `VARCHAR(64)` | | Audit engine mode |
| `overall_trust_score` | `INT` | `DEFAULT 100` | Composite trust score (0-100) |
| `total_findings` | `INT` | `DEFAULT 0` | Total claims evaluated |
| `supported_count` | `INT` | `DEFAULT 0` | Verified claim count |
| `contradicted_count` | `INT` | `DEFAULT 0` | Contradicted claim count |
| `insufficient_count` | `INT` | `DEFAULT 0` | Insufficient evidence count |
| `conflicting_count` | `INT` | `DEFAULT 0` | Conflicting sources count |
| `needs_review_count` | `INT` | `DEFAULT 0` | Needs human review count |
| `created_at` | `TIMESTAMPTZ` | `INDEX` | Audit creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | | Last update timestamp |

### 3. `findings`
Stores individual claims evaluated against ground-truth guidelines.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | Finding ID (`find_...`) |
| `review_id` | `VARCHAR(64)` | `REFERENCES reviews(id) ON DELETE CASCADE`, `INDEX` | Parent review |
| `user_id` | `VARCHAR(128)` | `REFERENCES profiles(user_id) ON DELETE CASCADE`, `INDEX` | Owning Firebase user ID |
| `claim` | `TEXT` | `NOT NULL` | Extracted claim statement |
| `status` | `VARCHAR(64)` | `NOT NULL`, `INDEX` | `SUPPORTED`, `CONTRADICTED`, etc. |
| `explanation` | `TEXT` | `NOT NULL` | Reasoning for finding |
| `suggested_action` | `TEXT` | `NOT NULL` | Recommended compliance remediation |
| `paragraph_index` | `INT` | | 0-based paragraph index in draft |
| `reviewer_decision` | `VARCHAR(32)` | `DEFAULT 'PENDING'` | Human decision: `ACCEPTED`, `REJECTED`, etc. |
| `reviewer_notes` | `TEXT` | | Human reviewer notes |
| `category` | `VARCHAR(64)` | `NOT NULL` | Finding category |
| `created_at` | `TIMESTAMPTZ` | | Creation timestamp |

### 4. `evidence_citations`
Stores precise source quotations and confidence scores supporting each finding.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | Citation ID (`cite_...`) |
| `finding_id` | `VARCHAR(64)` | `REFERENCES findings(id) ON DELETE CASCADE`, `INDEX` | Parent finding |
| `user_id` | `VARCHAR(128)` | `REFERENCES profiles(user_id) ON DELETE CASCADE`, `INDEX` | Owning Firebase user ID |
| `source_id` | `VARCHAR(128)` | `INDEX` | Source reference |
| `source_title` | `TEXT` | `NOT NULL` | Name of verified source doc |
| `source_type` | `VARCHAR(64)` | `NOT NULL` | Source type |
| `document_version` | `VARCHAR(64)` | | Version of source doc |
| `last_updated` | `VARCHAR(64)` | `NOT NULL` | Source doc date |
| `quote` | `TEXT` | `NOT NULL` | Exact ground-truth quote |
| `section` | `TEXT` | `NOT NULL` | Section in document |
| `confidence_score` | `INT` | `CHECK (0 <= score <= 100)` | Retrieval & match confidence |
| `url` | `TEXT` | | Optional source URL |
| `created_at` | `TIMESTAMPTZ` | | Creation timestamp |

### 5. `conversations`
Stores multi-turn chat sessions for Inkloom AI Assistant, scoped to the authenticated user.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | Conversation ID (`conv_...`) |
| `user_id` | `VARCHAR(128)` | `REFERENCES profiles(user_id) ON DELETE CASCADE`, `INDEX` | Owning Firebase user ID |
| `audit_id` | `VARCHAR(64)` | `REFERENCES reviews(id) ON DELETE SET NULL`, `INDEX` | Optional linked audit context |
| `title` | `VARCHAR(255)` | `NOT NULL` | Conversation subject / preview title |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP`, `INDEX` | Session start time |
| `updated_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP` | Last interaction timestamp |

### 6. `chat_messages`
Stores individual conversation messages, grounded citations, and suggested follow-ups.
| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `VARCHAR(64)` | `PRIMARY KEY` | Message ID (`msg_...`) |
| `conversation_id` | `VARCHAR(64)` | `REFERENCES conversations(id) ON DELETE CASCADE`, `INDEX` | Parent conversation |
| `role` | `VARCHAR(32)` | `NOT NULL` | `user` or `assistant` |
| `content` | `TEXT` | `NOT NULL` | Message body (Markdown supported) |
| `evidence` | `JSONB` | | Grounded source citations & excerpts |
| `related_findings` | `JSONB` | | Linked audit finding IDs & statuses |
| `suggested_prompts` | `JSONB` | | Contextual follow-up suggestions |
| `created_at` | `TIMESTAMPTZ` | `DEFAULT CURRENT_TIMESTAMP`, `INDEX` | Creation timestamp |

---

## 3. Step-by-Step Supabase Setup Instructions

### Step 1: Create a Supabase Project
1. Log in to [Supabase Console](https://supabase.com/dashboard).
2. Click **New Project**.
3. Choose your organization, set a project name (e.g. `inkloom-ai-db`), and generate a strong database password.
4. Select your preferred region (e.g. `us-east-1` or `eu-west-1`).

### Step 2: Apply the Migration Schemas
1. In the Supabase Dashboard, navigate to the **SQL Editor** in the left sidebar.
2. Click **New Query**.
3. Paste the contents of `backend/migrations/001_initial_schema.sql` and click **Run** (or press Ctrl + Enter).
4. Create a second query, paste `backend/migrations/002_chat_schema.sql`, and click **Run**.
5. Verify that all 6 tables (`profiles`, `reviews`, `findings`, `evidence_citations`, `conversations`, `chat_messages`) appear in the **Table Editor**.

### Step 3: Retrieve Database Connection String
1. In the Supabase Dashboard, navigate to **Project Settings** -> **Database**.
2. Scroll to the **Connection string** section.
3. Select **URI** and choose **Transaction Pooler** (recommended for serverless/IPv4 compatibility) or **Direct connection**:
   - **Transaction Pooler (Port 6543)**:
     ```
     postgresql+psycopg://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
     ```
   - **Direct Connection (Port 5432)**:
     ```
     postgresql+psycopg://postgres:[YOUR_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
     ```
   *Note*: Ensure the URI scheme starts with `postgresql+psycopg://` so SQLAlchemy uses the modern `psycopg` (v3) driver installed in `.venv`.

### Step 4: Configure Backend Environment
Edit `backend/.env` (never commit this file to Git):
```bash
# Supabase PostgreSQL Configuration
DATABASE_URL=postgresql+psycopg://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SECRET_SERVICE_ROLE_KEY]
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_ECHO=false
```

---

## 4. Connectivity and Persistence Verification

Inkloom AI includes automated connectivity verification.

### Option A: Check via Health Endpoint
Run `curl http://127.0.0.1:8000/api/health` or open it in a browser:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "llmProvider": "none",
  "isLlmConfigured": false,
  "sourcesCount": 4,
  "isAuthConfigured": true,
  "isDbConfigured": true,
  "dbStatus": "postgresql_connected"
}
```

### Option B: Run Automated Backend Pytest Suite
Execute:
```powershell
.venv\Scripts\pytest backend\tests\test_database.py -v
```
This test suite verifies:
1. `test_schema_tables_and_columns`: Verifies table definitions, primary keys, and foreign keys.
2. `test_unauthorized_access_rejected`: Verifies unauthenticated users cannot list, view, or delete reviews.
3. `test_user_isolation`: Verifies that User A's audits are completely isolated and invisible to User B.
4. `test_cascade_delete`: Verifies that deleting a review cascades cleanly to findings and citations.
