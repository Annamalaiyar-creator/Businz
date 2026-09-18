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
