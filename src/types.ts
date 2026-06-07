export interface PricingRecord {
  id: string; // Unique primary key (usually storeId_sku or UUID)
  storeId: string; // Identifier for the store (e.g., "STORE001")
  sku: string; // Stock Keeping Unit code (e.g., "SKU1002")
  productName: string; // Descriptive product name
  price: number; // Float representation of price (e.g. 19.99)
  date: string; // ISO date format (YYYY-MM-DD) representing feed date
  updatedAt: string; // ISO date format of last modification
  version: number; // Incrementing counter for conflict resolution / sync
  country?: string; // Optional country code parsed from CSV
}

export interface AuditLogEntry {
  id: string;
  recordId: string;
  fieldChanged: 'price' | 'productName' | 'date' | 'sku' | 'storeId' | 'creation' | 'import';
  oldValue: string;
  newValue: string;
  changedBy: string; // Role/User who initiated the change (e.g. "Store Manager", "System Import")
  changedAt: string; // Timestamp of modification
}

export interface SearchCriteria {
  query?: string; // Query matching SKU or Product Name
  storeId?: string; // Exact match store ID
  startDate?: string; // Filter dates >= startDate
  endDate?: string; // Filter dates <= endDate
  minPrice?: number; // Filter price >= minPrice
  maxPrice?: number; // Filter price <= maxPrice
  sortBy?: 'date' | 'price' | 'sku' | 'productName';
  sortOrder?: 'asc' | 'desc';
}

export interface ImportErrorDetail {
  line: number;
  error: string;
  rowData?: string;
}

export interface ImportSummary {
  totalProcessed: number;
  totalSuccess: number;
  totalFailed: number;
  errors: ImportErrorDetail[];
  durationMs: number;
}

export interface StoreMetadata {
  id: string;
  name: string;
  city: string;
  country: string;
  currency: string;
  currencySymbol: string;
}
