# BUSINZ - CRM & Operations Platform

Enterprise-grade CRM, Sales, Bill of Materials (BOM), Procurement, and Operations Management Platform built for agile enterprise manufacturing and trading operations.

## Tech Stack
- **Frontend**: React 19, Vite, Lucide React, Custom Responsive UI Design System
- **Backend**: Node.js, Express, Local JSON Zero-Data-Loss Store Engine, Supabase PostgreSQL Sync Engine
- **Mobile**: Capacitor (Android / iOS)
- **Integrations**: Zoho Books API, Tally ERP / Prime Sync Engine

## Project Structure
- `src/` - React frontend application and components
  - `components/` - Module views (BOM, PI, PO, Inventory, CRM, Accounting, Dispatch)
  - `utils/` - Synchronization engines, XML generators, formatters
- `server/` - Backend Express API and persistence services
  - `index.js` - API server endpoints
  - `tallyService.js` - Tally integration service
  - `backupEngine.js` - Automated snapshot and backup engine
  - `*.json` - Local persistent data stores (Zero-data-loss system)
- `scripts/` - Administrative and maintenance utilities

## Getting Started

### 1. Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Running Locally
Start backend proxy server:
```bash
npm run server
```
Start frontend development server:
```bash
npm run dev
```

### 5. Production Build
```bash
npm run build
```
