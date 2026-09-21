# BUSINZ — BOM Architecture & Storage Specification
**System Version:** 2026 Production Baseline  
**Active Branch:** `feature/bom-migration`  
**Security Classification:** Confidential / Internal Engineering Specification

---

## 1. Executive Summary & Source of Truth

The BUSINZ Bill of Materials (BOM) system has been fully migrated from a monolithic JSON-blob pattern to a normalized relational architecture with private cloud object storage.

| Component | Architecture Role | Storage Layer | Access Pattern |
| :--- | :--- | :--- | :--- |
| **BOM Orders** | Primary Source of Truth | PostgreSQL `public.bom_orders` | Direct row-level CRUD & real-time events |
| **Document Binaries** | File/Media Binary Store | Private Supabase Storage (`bom-documents`) | Backend-brokered expiring signed URLs |
| **Document Metadata** | Document References | `public.bom_orders` JSON/JSONB fields | Canonical metadata JSON shape |
| **Legacy `BOM_STORE`** | Rollback / Cold Backup | `public.leaves` (Row ID: 2) | **PASSIVE READ-ONLY ROLLBACK ONLY** |
| **Disk `bom_store.json`** | Emergency Offline Fallback | `server/bom_store.json` | **PASSIVE EMERGENCY FALLBACK ONLY** |

---

## 2. BOM Data Model & Database Schema

All active operations query and persist directly to `public.bom_orders`.

### Database Table: `public.bom_orders`
- **Primary Key:** `id` (Text / VARCHAR), matching sequential code format `BOM-XXX`
- **Unique Identifier:** `bom_code` (Text / VARCHAR), indexed
- **Typed Columns:**
  - `date`, `delivery_date` (DATE)
  - `customer_name`, `company_name`, `mobile`, `email` (TEXT)
  - `billing_address`, `delivery_address` (TEXT)
  - `billing_address_obj`, `delivery_address_obj` (JSONB)
  - `delivery_address_proof_doc` (JSONB / Canonical metadata)
  - `payment_proof_doc` (JSONB / Canonical metadata)
  - `proof_doc` (JSONB / Canonical metadata)
  - `payments` (JSONB, containing `proofDocObj`)
  - `items` (JSONB, array of line items with rate, quantity, specs)
  - `dispatch_packing` (JSONB, packing checklist status)
  - `accounts_verification` (JSONB, verification status + `_extra_data`)
  - `sub_total`, `gst_amount`, `grand_total` (NUMERIC)
  - `status`, `sales_confirmed`, `sales_confirmed_at`
  - `created_at`, `updated_at` (TIMESTAMPTZ)

### Canonical Document Metadata Schema
No raw Base64 data URLs (`data:...;base64,...`) or file buffers are stored in the database. All document fields store strictly lightweight metadata:

```json
{
  "storageBucket": "bom-documents",
  "storagePath": "BOM-713/payment-proof/1789982654435-payment_receipt.pdf",
  "originalName": "payment_receipt.pdf",
  "fileName": "payment_receipt.pdf",
  "mimeType": "application/pdf",
  "size": 65536,
  "uploadedAt": "2026-09-21T10:45:00.000Z"
}
```

---

## 3. Storage Hierarchy & Scoping Rules

The Supabase Storage bucket `bom-documents` is **STRICTLY PRIVATE** (`public: false`).

### Path Convention
Every object uploaded to `bom-documents` must follow the BOM-scoped hierarchy:
```
bom-documents/
  └── <BOM-CODE>/
      ├── payment-proof/
      │   └── <timestamp>-<sanitized_filename>
      ├── delivery-proof/
      │   └── <timestamp>-<sanitized_filename>
      └── dispatch/
          ├── images/
          │   └── <timestamp>-<sanitized_filename>
          └── videos/
              └── <timestamp>-<sanitized_filename>
```

### Security Boundaries
- **Zero Browser Direct Storage Access:** The browser client receives NO Supabase Storage write credentials, API keys, or direct bucket endpoints.
- **Service-Role Isolation:** `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to the backend Node.js server (`server/`).
- **Path Tampering & Traversal Protection:** Cross-BOM path requests (e.g. BOM-714 attempting to access a file in BOM-713) or paths containing `..` or null characters are strictly rejected with `HTTP 403 Forbidden` / `HTTP 400 Bad Request`.
- **MIME & Size Enforcement:**
  - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `video/mp4`, `video/quicktime`.
  - Executables, scripts, and unknown types are blocked.
  - File size cap: 50 MB per object.

---

## 4. Document Access Flow

```
+------------------+         +--------------------+         +------------------------+
|  BUSINZ Browser  |         |   BUSINZ Backend   |         |    Supabase Storage    |
|   (Client UI)    |         |  (server/index.js) |         |     (bom-documents)    |
+------------------+         +--------------------+         +------------------------+
         |                             |                                 |
         |  1. GET /api/boms/:id/      |                                 |
         |     documents/signed-url    |                                 |
         |     x-session-id: <SES-...> |                                 |
         |---------------------------->|                                 |
         |                             |  2. Validate BUSINZ Session     |
         |                             |     & Path Ownership (Scoping)  |
         |                             |---------------------------------|
         |                             |                                 |
         |                             |  3. createSignedUrl(path, 900)  |
         |                             |     using Service-Role Client   |
         |                             |-------------------------------->|
         |                             |<--------------------------------|
         |                             |  4. Returns signedUrl           |
         |  5. HTTP 200 OK             |                                 |
         |     { signedUrl: "..." }    |                                 |
         |<----------------------------|                                 |
         |                                                               |
         |  6. Direct GET to signedUrl (valid 15 minutes)                |
         |-------------------------------------------------------------->|
         |<--------------------------------------------------------------|
         |  7. Binary Stream (Image / PDF / Video)                       |
         |                                                               |
```

---

## 5. Zero-Base64 Write Enforcement

Both client and backend enforce zero-Base64 defense in depth:
1. **Client Guard (`src/utils/bomStorageClient.js`):** `scrubBomForPersistence(bomRecord)` recursively strips `dataUrl`, `fileData`, and `proofDocData` before sending payloads to `/api/boms`.
2. **Server Sanitizer (`server/index.js`):** `sanitizeBomDocForStorage(doc)` scans every document field and strips Base64 payloads prior to PostgreSQL upsert.
3. **Database Assertion:** Any accidental attempt to insert a string matching `^data:` or unencoded binary in a document field is rejected/nullified.

---

## 6. Legacy Rollback Safeguards & Instructions

### Rollback Artifacts Preserved
1. **Database Baseline:** `public.leaves` table, row ID `2` (`employee = 'BOM_STORE'`).
   - Contains complete historical snapshot of all 53 BOM orders in monolithic format with original data URLs.
   - **DO NOT DELETE OR MODIFY THIS ROW.**
2. **Disk Fallback:** `server/bom_store.json`.
   - Contains offline disk snapshot.
   - **DO NOT DELETE THIS FILE.**
3. **Phase D3 Pre-Migration Backup:** `server/backups/bom_orders_pre_d3_backup_1789982654435.json`.
   - Stored locally, gitignored, contains exact pre-migration database state.

### Emergency Rollback Procedure (If Required)
If catastrophic database failure occurs in `public.bom_orders`, execute the emergency rollback script:
```bash
node scripts/rollback_phase_d3_bom_documents.js
```
This restores all original document references from `server/backups/bom_orders_pre_d3_backup_1789982654435.json` into `public.bom_orders`.

To restore from the legacy `leaves` table:
```bash
node scripts/rollback_bom_store_from_leaves.js
```

---

## 7. Normal Operations Compliance Checklist

For all ongoing development, engineering must strictly maintain:
- [x] All BOM queries use `public.bom_orders`.
- [x] Zero writes to `public.leaves` for employee `BOM_STORE`.
- [x] Zero Base64 strings persisted in `public.bom_orders`.
- [x] All document uploads route through `uploadBomDocument` in `src/utils/bomStorageClient.js`.
- [x] Service role key must never be imported into any file under `src/` or `dist/`.
