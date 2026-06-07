# System Architecture & Design Documentation

This document describes the architectural layout, design choices, and non-functional requirements (NFRs) for the React Native Store Pricing Feed management system. 

---

## 1. System Context Diagram

The following diagram illustrates how the React Native App interacts with store operators, local store systems, and the central retail ERP backend.

```mermaid
graph TD
    StoreManager[Store Manager / User] -- Imports CSV & Edits Prices --> App[React Native Client App]
    LocalFiles[Local Device Files] -- Read CSV Feed --> App
    
    subgraph Client Boundary (Offline-First)
        App --> Storage[Storage Service Interface]
        Storage --> IndexEngine[In-Memory Index Manager]
        Storage --> LocalDB[Local Persistence Engine JSON/SQLite]
    end
    
    subgraph Corporate Network (Online Sync)
        App -- Sync / Conflicts Reconciled --> SyncAPI[Central Sync API Gateway]
        SyncAPI --> ERP[Central Retail ERP Database]
        ERP --> Analytics[Business Intelligence & Analytics]
    end
    
    classDef boundary fill:#1e293b,stroke:#3b82f6,stroke-width:2px;
    class Client,Corporate boundary;
```

---

## 2. Solution Architecture

The application is structured as a single-page dashboard divided into three main service layers, designed for loose coupling and high testability.

### Client-Side Module Layers

1. **User Interface (Presentation Layer)**:
   - **Main View (`App.tsx`)**: Integrates the state variables, safe-area layout, and coordinates event transitions.
   - **Metrics Dashboard (`StatsDashboard.tsx`)**: Consolidates statistics (stores count, SKU counts, average price, modifications log).
   - **CSV Importer (`CSVImporter.tsx`)**: Provides file simulation profiles (Standard, Fault Injection, High-Scale) and copy-paste inputs.
   - **Fuzzy Search Engine (`SearchFilters.tsx`)**: Offers SKU prefix indexing, store filters, and advanced pricing/date ranges.
   - **Modal Form Editor (`EditModal.tsx`)**: Handles validation rules and exposes detailed histories of record revisions.

2. **Core Logic Layer**:
   - **CSV Processing (`csvParser.ts`)**: Splitting, mapping, sanitizing, and validating text feeds. It uses an **Asynchronous Batch Processor** that handles parsing in chunks of 200 lines, yielding execution back to the UI thread (via `setTimeout`) to prevent animation stutters.

3. **Storage & Data Access Layer**:
   - **Index Manager (`IndexManager.ts`)**: Rebuilds lookups on Store IDs, SKUs, and Product Name tokens. Allows intersections for complex criteria to achieve $O(1)$ search lookups.
   - **Storage Service (`StorageService.ts`)**: Standardizes operations. Persists data to the device local disk, handles conflict de-duplication (newer feeds overwrite older ones based on `Date`), and maintains transactional audit logging.

---

## 3. Design Decisions

| Decision | Selected Approach | Rationale / Benefits |
| :--- | :--- | :--- |
| **Local Database Engine** | JSON-based storage + In-Memory Index Maps | Prevents native compile dependencies (e.g. SQLite linkage stutters) when testing across different Android/iOS SDKs, while simulating database index behavior. Easily maps to SQLite for production. |
| **CSV Parser** | Custom, zero-dependency parser | Ensures 100% compliance with React Native bundlers. Handles nested quotes, escaped tokens, and Unix/DOS carriage returns immediately. |
| **Import Processing** | Asynchronous batch chunking | Processing large files blocks the single JavaScript thread. Chunking by 200 rows ensures frame rates remain at 60 FPS. |
| **Conflict Management** | Feed Date + Incremental Versioning | When duplicate Store+SKU records are imported, the system inspects the incoming file date. Only equal or newer dates overwrite values, avoiding stale data updates. |
| **Stable Audit Sort** | Double-key index sorting | If multiple pricing adjustments are recorded within the same millisecond, the system sorts by timestamp and falls back to array index position, ensuring deterministic history. |

---

## 4. Non-Functional Requirements (NFR) Analysis

Operating a retail chain with **3,000 stores across multiple countries** introduces unique constraints. The design addresses these as follows:

### A. Performance & High Data Volume
* **The Challenge**: A single store has thousands of SKUs. Globally, pricing feeds contain millions of rows. Rendering these on mobile devices causes memory leaks and lags.
* **The Solution**: 
  - **Indexed Lookups**: Search runs queries against the `IndexManager` token maps instead of scanning the full table array ($O(1)$ instead of $O(N)$).
  - **Virtualized Rendering**: The records list uses `FlatList` with optimized props (`windowSize={5}`, `removeClippedSubviews=true`, `initialNumToRender={10}`) to ensure off-screen cards are unmounted, saving RAM.
  - **Pagination**: Splitting query outputs into 10-row pages reduces rendering overhead.

### B. Offline-First Operations
* **The Challenge**: Physical retail outlets (warehouses, basements) often suffer from unstable network connections. The app must run offline.
* **The Solution**: All imports and updates occur directly in the local storage engine. When the network is down, the system queues audit log operations. When online, the sync protocol pushes changes back to the ERP gateway.

### C. Data Integrity & Validation
* **The Challenge**: Feed files are often corrupted, contain text in numeric fields, or have missing values.
* **The Solution**: The custom parser enforces strict schema boundaries:
  - Alphanumeric Store ID (`/^[A-Z0-9_-]+$/`).
  - Alphanumeric SKU.
  - Positive, parsed float price.
  - Valid YYYY-MM-DD calendar date.
  - Generates detailed row line reports showing validation failures without aborting the entire batch.

### D. Multi-Currency & Localization
* **The Challenge**: Stores in different countries use different currencies (USD, GBP, EUR, INR, JPY) and formatting standards.
* **The Solution**:
  - The `StorageService` matches Store IDs to country profiles, dynamically formatting price labels (e.g. `STORE_UK` formats as `£X.XX`, `STORE_JP` as `¥X`).

### E. Compliance & Auditability
* **The Challenge**: Retail pricing is subject to compliance rules. Arbitrary modifications must be auditable.
* **The Solution**: Every manual edit or bulk import change creates an immutable `AuditLogEntry`, recording what field changed, old vs. new values, the user role, and exact timestamps.

---

## 5. System Assumptions

1. **Store ID Mapping**: It is assumed Store IDs contain country indicators (e.g., `STORE_US`) or are matched to metadata records containing currency types.
2. **Device Capacity**: The local device has sufficient flash storage (typically $< 50\text{MB}$ for standard store databases) to persist records.
3. **Roles**: Standard application users are partitioned into Roles (e.g. "Store Manager") who have permission to edit records, whereas normal staff have read-only access.
