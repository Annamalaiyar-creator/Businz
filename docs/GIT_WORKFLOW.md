# BUSINZ Git Workflow & Deployment Guidelines

## 1. Overview & Branch Architecture

BUSINZ uses a safe, structured, 4-tier Git workflow designed to protect production stability, prevent accidental data loss, and enforce rigorous quality gates for ERP and CRM operations.

```text
feature/*  (Isolated feature work & bug fixes)
    │
    ▼
 develop   (Active integration & local automated testing)
    │
    ▼
 staging   (Pre-production / QA validation)
    │
    ▼
  main     (Production-only stable baseline)
    │
    ▼
production (Plesk IISNode live environment)
```

---

## 2. Branch Responsibilities

### `main` (Production Only)
- **Purpose**: Stable production code running live on the server.
- **Rules**:
  - **Production server deploys strictly from `main`**.
  - **Never develop directly on `main`**.
  - **Never test experimental code on `main`**.
  - Direct commits and direct pushes to `main` are strictly prohibited.
  - Only tested and approved releases from `staging` may be merged into `main`.

### `staging` (Pre-production / QA)
- **Purpose**: Staging and final user acceptance testing (UAT).
- **Rules**:
  - Receives tested changes promoted from `develop`.
  - Used for end-to-end QA verification before promoting to production.
  - No experimental code directly on `staging`.
  - Any bug found during staging QA must be fixed in a feature branch, merged into `develop`, and re-promoted to `staging`.

### `develop` (Integration / Active Development)
- **Purpose**: Central integration branch for ongoing engineering work.
- **Rules**:
  - All completed and locally tested feature branches merge into `develop`.
  - Integration tests, regression tests, and team reviews take place here.
  - Significant features must never start directly inside `develop` without a dedicated feature branch.

### `feature/*` & `fix/*` (Isolated Work)
- **Purpose**: Isolated branches for specific tasks, migrations, or fixes.
- **Branch Naming Conventions**:
  - Features: `feature/<module>-<description>`
    - `feature/presets-migration`
    - `feature/bom-migration`
    - `feature/inventory-migration`
    - `feature/po-migration`
    - `feature/whatsapp-integration`
    - `feature/sales-dashboard`
  - Bug Fixes: `fix/<issue-description>`
    - `fix/customer-duplicate`
    - `fix/opportunity-stage-update`
    - `fix/session-heartbeat`

---

## 3. End-to-End Development Lifecycle

```text
main ──> develop ──> feature/xxxx ──> develop ──> staging ──> main ──> production
```

1. **Checkout & Update `develop`**:
   ```bash
   git checkout develop
   git pull origin develop
   ```

2. **Create Feature Branch**:
   ```bash
   git checkout -b feature/<feature-name>
   ```

3. **Develop & Test Locally**:
   - Implement changes isolated strictly to the target module.
   - Run automated tests and local Vite dev server:
     ```bash
     npm run build
     node scripts/test_<module>.js
     ```

4. **Commit Locally**:
   ```bash
   git add <modified-files>
   git commit -m "feat(<module>): <descriptive message>"
   ```

5. **Merge into `develop`**:
   ```bash
   git checkout develop
   git pull origin develop
   git merge --no-ff feature/<feature-name>
   ```
   *Do NOT delete the feature branch immediately; retain it until integration testing passes.*

6. **Promote to `staging`**:
   ```bash
   git checkout staging
   git pull origin staging
   git merge --no-ff develop
   npm run build
   ```
   *Resolve any merge conflicts manually with extreme care. Inspect every line.*

7. **Promote to `main` (Production Release)**:
   - Only after QA approval on `staging`:
     ```bash
     git checkout main
     git pull origin main
     git merge --no-ff staging
     npm run build
     ```
   - Verify working tree and git log before triggering server deployment:
     ```bash
     git status
     git log --oneline --decorate -10
     ```

---

## 4. Production Deployment Rules

Production server deploys **strictly from `main`**:
```bash
git checkout main
git pull origin main
npm install --omit=dev
npm run build
```

### Critical Production Safety Rules
- **Application Code Only**: Git deployment updates application source code (`src/`, `server/`, `dist/`).
- **Zero Production Overwrites**: Git deployment MUST NEVER:
  - Overwrite or replace Supabase database records.
  - Upload local database dumps into production.
  - Overwrite production customer data or customer codes.
  - Overwrite BOM orders, PO numbers, or PI sequences.
  - Overwrite production opportunity records.
  - Upload local `.env` files or overwrite server environment variables.

---

## 5. Database Migration Rules

Database changes and Git code deployments are **strictly decoupled**:

1. **Controlled SQL Migrations**: Database schema modifications must use versioned, sequential SQL migration scripts (e.g. `supabase_migration_phase2.sql`).
2. **Non-Destructive Operations**: Never drop tables, truncate records, or recreate production schemas.
3. **Data Preservation**: Existing customer, quotation, BOM, PO, and opportunity rows must always be preserved.
4. **Tested in Staging First**: Execute and verify migration scripts on staging before executing in production.
5. **Single Execution**: Production migrations run once and are verified through explicit validation queries.

> **Golden Rule**:
> - Git updates application code.
> - Database migrations update database schemas and data.
> - Neither operation should ever replace or overwrite live customer data.

---

## 6. Environment Variables & Secrets Management

- The `.env` file MUST NEVER be tracked by Git.
- Verify that `.env` is ignored:
  ```bash
  git ls-files .env
  ```
- `.gitignore` must enforce exclusion of:
  ```gitignore
  .env
  .env.local
  .env.production
  .env.development
  .env.staging
  ```
- `.env.example` provides template keys only, with NO real secrets or tokens.
- Never commit:
  - Supabase URL / API Keys
  - Zoho Client IDs, Client Secrets, or Refresh Tokens
  - WhatsApp Business API Access Tokens
  - Database Passwords or Admin Service Role Keys

---

## 7. Next Phase Example: Phase 3 Presets Migration

When starting Phase 3 (Presets Migration):

```bash
# 1. Start from latest develop
git checkout develop
git pull origin develop

# 2. Branch off into isolated feature branch
git checkout -b feature/presets-migration

# 3. Work ONLY on presets migration
# (Do NOT touch Customer, Opportunities, BOM, PO, PI, or Inventory)

# 4. Local verification
npm run build
node scripts/test_presets_migration.js

# 5. Commit
git add .
git commit -m "feat(presets): migrate presets to normalized Supabase storage"

# 6. Integration into develop
git checkout develop
git merge --no-ff feature/presets-migration

# 7. Promote to staging for QA
git checkout staging
git merge --no-ff develop

# 8. Promote to main only after QA signoff
git checkout main
git merge --no-ff staging
```
