# BUSINZ — BOM Legacy Rollback Documentation

## Overview & Architecture Notice

This document details the operational status and retention guidelines for `server/bom_store.json`.

### Key Policies

1. **`server/bom_store.json` is LEGACY ROLLBACK ONLY.**
   - It exists solely as a passive offline fallback and emergency disaster-recovery reference.
2. **`public.bom_orders` is the current active BOM source of truth.**
   - All active reads, writes, searches, and updates for Bill of Materials orders execute exclusively against the PostgreSQL database table `public.bom_orders`.
   - Associated document binaries are stored securely in the private Supabase Storage bucket `bom-documents`.
3. **`server/bom_store.json` must not be used for normal runtime operations.**
   - Zero active runtime operations read from or write to `server/bom_store.json`.
   - All client and server workflows must remain fully decoupled from this file.
4. **Do not delete `server/bom_store.json` until rollback retention is explicitly approved.**
   - The file must remain on disk in its current state as a historical rollback layer until explicit user sign-off is given.
