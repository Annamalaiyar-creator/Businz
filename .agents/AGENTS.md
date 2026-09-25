# Project Guidelines & Rules

## Application Identity & Branding
- This application is **BUSINZ** (not Control Room). All user-facing references, communications, and documentation MUST strictly use the name **BUSINZ**.

## Strict Frozen Workflows (LOCKED BY USER)
The following core workflows and modules have been thoroughly tested, verified, and are **STRICTLY LOCKED & FROZEN**. Do NOT alter, refactor, or modify these flows without explicit written user instruction:
1. **PI Flow (Proforma Invoices)**:
   - File references: `SalesProformaInvoicesView.jsx`, `CreateProformaInvoiceModal.jsx`, and associated PI store routines.
   - Status: **LOCKED & FROZEN**.
2. **BOM Flow (Bill of Materials)**:
   - File references: `BomOrdersView.jsx`, `CreateBomFormPage.jsx`, BOM order synchronization, document upload & compression, and sales confirmation.
   - Status: **LOCKED & FROZEN**.
3. **PO Flow (Purchase Orders & Zoho Books Integration)**:
   - File references: `PurchaseOrdersView.jsx`, `CreatePurchaseOrderModal.jsx`, Zoho sequence numbering (`PO-000XX`), disk persistence (`po_store.json`), and payload formatting.
   - Status: **LOCKED & FROZEN**.
4. **Inventory Flow**:
   - File references: `RawMaterialInventoryView.jsx`, `GoodsReceiptNoteView.jsx`, `centralInventoryStore.js`, GRN inwarding, stock deduction reconciliation, and live item audit log tracking.
   - Status: **LOCKED & FROZEN**.

## Purchase Order (PO) & Zoho Books Integration Rules

1. **PO Numbering Sequence**:
   - PO numbers generated in BUSINZ MUST strictly match Zoho Books' sequential format (`PO-000XX`).
   - Use `GET /api/zoho/next-po-number` to fetch the next sequential PO number.

2. **PO State Persistence**:
   - In `POST /api/zoho/purchaseorders`, save the PO to disk storage (`po_store.json`) immediately before initiating the HTTPS request to Zoho Books.
   - In `fetchZohoPOs()`, merge fetched server records with local React state so local POs are never overwritten or cleared during table reloads.

3. **Zoho Payload Constraints**:
   - `delivery_address` and `billing_address` strings sent to Zoho Books MUST be truncated to <= 80 characters to prevent Zoho API error code 15.
   - `notes` field in Zoho payload MUST ONLY contain user-entered notes (no prepended metadata or formatted addresses).

4. **Line Items Form Default**:
   - Opening the "Create PO" form MUST initialize line items to an empty array (`[]`) without forcing pre-populated items.

5. **BOM State Persistence & Document Upload Quota Protection**:
   - Document upload fields (Payment Proof & Address Proof) MUST auto-compress images (`compressAndSaveFile`) to lightweight payloads (< 25 KB).
   - In `setBomStore`, if browser `localStorage` storage limits are exceeded during `JSON.stringify(updatedList)`, the application MUST use `stripDataUrlsFromRecord` to safely strip raw data URLs while preserving all official metadata (file name, size, type, upload timestamp, payment terms, and BOM order details).
   - BOM items with uploaded documents MUST NEVER be lost or deleted upon page refresh, browser tab reload, or logout.

6. **Standard Table Design & Pagination System Rules**:
   - **Interactive Row Selection**:
     - Standard tables MUST include row selection checkboxes (`accent-color: #0E7490`).
     - Selected rows MUST highlight in soft teal tint (`#ECFEFF`) with a `4px solid #0E7490` vertical left border accent line on the first cell.
   - **Floating Bottom Action Bar**:
     - When 1 or more rows are selected, a floating pill action bar MUST appear fixed at bottom center (`position: fixed`, `bottom: 24px`, `left: 50%`, `transform: translateX(-50%)`, `borderRadius: 50px`, `flexDirection: row`, `flexWrap: nowrap`, `whiteSpace: nowrap`) showing ALL actions in a **SINGLE LINE**.
     - Do NOT use a 3-dot (•••) menu. All secondary actions (View Details, Print/Export PDF, etc.) MUST be displayed as direct, visible buttons in the floating toolbar row (e.g. `X Selected | 👁️ View Details | ✏️ Edit Info | 🖨️ Export / Print PDF | 🗑️ Delete | ✕`). Note: Duplicate / Clone is NOT needed in BOM, PI, or Quotations.
   - **Pagination Footer Layout**:
     - **Left Side**: `Showing per page [5, 10]` rows-per-page selector (restricted strictly to 5 and 10) + `Showing X to Y of Z entries` text.
     - **Right Side**: Page number buttons (`<< < 1 2 3 > >>`) with active page highlighted in `#0E7490`, placed on the right side directly adjacent to **`Go to page [ ]`** input and **`Go ›`** button.
   - **Dashboard Exception**:
     - Simple overview cards/dashboard preview tables (`ProductionAdminView.jsx`, `RecentPurchaseOrders.jsx`) MUST remain clean without checkboxes.

## Permanent Engineering Rules for All New Features (STRICT MANDATE)

These rules apply to every new feature, module, screen, database change, API change, realtime listener, sync mechanism, and cloud integration. DO NOT violate these rules unless explicitly approved by the user.

### 1. Database Source of Truth
- The database is the authoritative source of truth.
- `localStorage`, `sessionStorage`, browser cache, and local JSON files must NEVER automatically repopulate or overwrite cloud database data.
- They may be used only for:
  - temporary cache
  - UI preferences
  - offline convenience

### 2. One Record Change = One Database Operation
- Create 1 record → INSERT / UPSERT 1 row
- Edit 1 record → UPDATE 1 row
- Delete 1 record → DELETE 1 row
- Status change → UPDATE only that row
- Never save an entire array/collection when only one record changed.

### 3. No Whole-Array Cloud Writes
- Do NOT use patterns like `saveCloudStore(storeName, fullArray)` for normalized business tables.
- Do NOT batch-upload hundreds/thousands of rows during normal UI use.
- Bulk writes are allowed only in explicit migration/admin scripts.

### 4. No Unbounded SELECT *
- Do not use unrestricted `SELECT *` for list screens.
- List screens must:
  - Select only required summary columns
  - Use pagination / range / limit
  - Avoid heavy JSON/document/blob fields
- Full detail should be fetched only when the user opens a specific record.

### 5. Realtime Must Update Only the Changed Row
- For realtime events:
  - INSERT → append `payload.new`
  - UPDATE → merge `payload.new` into the matching row
  - DELETE → remove `payload.old` / affected row
- Do NOT respond to one realtime event by re-fetching the entire table.

### 6. No React Feedback Loops
- Never create patterns like `useEffect(() => { saveCloudStore(fullArray) }, [fullArray])` where state change → cloud write → realtime → state change → cloud write.
- If such a loop is found, stop and redesign it immediately.

### 7. Local Storage Safety
- Never allow: `localStorage array` → automatic cloud restore → database overwrite.
- Database must always win over local cache.

### 8. Pagination
- Every potentially large table must use pagination or reasonable limits.
- If UI displays 10 or 20 rows, do not download thousands of heavy rows.

### 9. Heavy Files / Documents
- Do not embed large files or base64 documents in list responses.
- Use object storage and metadata references.
- Heavy document content should load only when needed.

### 10. Business Logic Protection
- When optimizing data access, DO NOT change:
  - Business workflow
  - Status transitions
  - Calculations
  - Stock logic
  - Payment logic
  - Dispatch logic
  - Billing logic
  - Zoho integration
  - Permissions
  - Numbering logic
  - Approval logic
- If any optimization requires changing business behavior: STOP and report first.

### 11. Request Count Check
- Before declaring a feature complete, test:
  - Idle 10 minutes → near 0 unnecessary reads/writes
  - Create 1 record → 1 targeted write
  - Edit 1 record → 1 targeted update
  - Delete/cancel → 1 targeted operation
  - Realtime update → 0 full-table reloads
  - Refresh → must not re-upload cache data

### 12. Egress Safety
- For every feature, report:
  - Request count
  - Rows transferred
  - Whether full-table reads occur
  - Whether whole-array writes occur
  - Whether realtime causes reloads
  - Estimated egress impact
- If one user action causes many unnecessary requests: STOP and optimize before promotion.

### 13. Dev / Test / Prod Isolation
- Development: DEV database only
- Test/Staging: TEST/DEV database only
- Production: PROD database only
- Never copy test data into production.
- Never hardcode production database fallbacks.
- If required environment variables are missing: FAIL FAST.

### 14. Git Workflow
- Use: `feature/*` → `develop` → `staging` → `main` → `production`
- Do not push directly to main.
- Do not deploy without approval.

### 15. Security
- Never commit: `.env`, service-role keys, API secrets, production credentials, customer documents, test database dumps.
- Service-role/admin keys must remain server-side only.

### 16. Final Check Before Any Push
Always report the standard audit checklist:
1. Files changed
2. Business logic changed? YES/NO
3. Full-array writes remaining?
4. Full-table reads remaining?
5. Realtime full reloads remaining?
6. Idle request count (10 min test)
7. Create request count
8. Edit request count
9. Delete request count
10. Egress impact
11. Cloud cost / usage regression checked? YES/NO
12. Tests passed?
13. Build passed?
14. Secrets exposed?
15. Production modified?
16. SAFE TO PUSH = YES/NO
- STOP before Git push unless explicitly approved by the user.

### 17. Cloud Cost / Usage Regression Protection
Before completing any feature involving database, storage, realtime, authentication, API, or cloud services:
- Check for unexpected network loops.
- Check for repeated failed requests/retries.
- Check for unnecessary polling.
- Check for excessive logging.
- Check for duplicate realtime subscriptions.
- Check for full-table downloads.
- Check for large response payloads.
- Estimate impact on Supabase/AWS data transfer and logging.

A feature must not be marked SAFE TO PUSH if it introduces unexpected continuous cloud traffic while the application is idle.

Idle application should generate near-zero database/API traffic, except required realtime heartbeat/session infrastructure.


