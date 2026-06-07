import { PricingRecord, ImportErrorDetail } from '../types';

/**
 * Parses a single CSV line, handling quotes, escaped double quotes, and commas.
 */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      // Handle escaped quotes (double double-quotes: "")
      if (inQuotes && line[i + 1] === '"') {
        currentField += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }
  result.push(currentField.trim());
  return result;
}

/**
 * Splitting a CSV text into lines, handling both \r\n and \n.
 */
export function splitCSVIntoLines(csvText: string): string[] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];

    if (char === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        currentLine += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        currentLine += '"';
      }
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csvText[i + 1] === '\n') {
        i++; // Skip the \n in \r\n
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }
  return lines;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  record?: Omit<PricingRecord, 'id' | 'updatedAt' | 'version'>;
}

/**
 * Validates a parsed row and maps it to record fields based on column headers.
 */
export function validateAndMapRow(
  row: string[],
  headerIndices: {
    storeId: number;
    sku: number;
    productName: number;
    price: number;
    date: number;
    country?: number;
  },
  lineNumber: number
): ValidationResult {
  const maxIdx = Math.max(
    headerIndices.storeId,
    headerIndices.sku,
    headerIndices.productName,
    headerIndices.price,
    headerIndices.date,
    headerIndices.country !== undefined ? headerIndices.country : -1
  );

  if (row.length <= maxIdx) {
    return {
      valid: false,
      error: `Row has incomplete columns (expected at least ${maxIdx + 1} fields, got ${row.length})`,
    };
  }

  const rawStoreId = row[headerIndices.storeId];
  const rawSku = row[headerIndices.sku];
  const rawProductName = row[headerIndices.productName];
  const rawPrice = row[headerIndices.price];
  const rawDate = row[headerIndices.date];
  const rawCountry = headerIndices.country !== undefined && headerIndices.country !== -1 ? row[headerIndices.country] : undefined;

  // 1. Store ID validation
  if (!rawStoreId) {
    return { valid: false, error: 'Store ID is missing' };
  }
  const storeId = rawStoreId.toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(storeId)) {
    return { valid: false, error: `Store ID '${rawStoreId}' must be alphanumeric` };
  }

  // 2. SKU validation
  if (!rawSku) {
    return { valid: false, error: 'SKU is missing' };
  }
  const sku = rawSku.toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(sku)) {
    return { valid: false, error: `SKU '${rawSku}' must be alphanumeric` };
  }

  // 3. Product Name validation
  if (!rawProductName) {
    return { valid: false, error: 'Product Name is missing' };
  }
  const productName = rawProductName;

  // 4. Price validation
  if (!rawPrice) {
    return { valid: false, error: 'Price is missing' };
  }
  const cleanPrice = rawPrice.replace(/[^\d.-]/g, ''); // strip out currency symbols like $
  const price = parseFloat(cleanPrice);
  if (isNaN(price)) {
    return { valid: false, error: `Invalid numeric price value '${rawPrice}'` };
  }
  if (price < 0) {
    return { valid: false, error: `Price cannot be negative (${price})` };
  }

  // 5. Date validation
  if (!rawDate) {
    return { valid: false, error: 'Date is missing' };
  }
  const dateObj = new Date(rawDate);
  if (isNaN(dateObj.getTime())) {
    return { valid: false, error: `Invalid date format '${rawDate}'` };
  }
  // Standardize to YYYY-MM-DD
  const dateStr = dateObj.toISOString().split('T')[0];

  return {
    valid: true,
    record: {
      storeId,
      sku,
      productName,
      price,
      date: dateStr,
      country: rawCountry ? rawCountry.trim() : undefined,
    },
  };
}

/**
 * Parses a CSV string asynchronously in chunks to prevent blocking the JS single thread.
 */
export function parseCSVAsync(
  csvText: string,
  onProgress: (percent: number, importedCount: number, errorCount: number) => void,
  onComplete: (records: Omit<PricingRecord, 'id' | 'updatedAt' | 'version'>[], errors: ImportErrorDetail[], durationMs: number) => void
) {
  const startTime = Date.now();
  const lines = splitCSVIntoLines(csvText);

  if (lines.length === 0) {
    onComplete([], [], 0);
    return;
  }

  // 1. Analyze header line
  const headerRow = parseCSVLine(lines[0]);
  const headerIndices = {
    storeId: -1,
    sku: -1,
    productName: -1,
    price: -1,
    date: -1,
    country: -1,
  };

  // Find column indexes based on headers
  for (let i = 0; i < headerRow.length; i++) {
    const colName = headerRow[i].toLowerCase().trim().replace(/[\s_-]/g, '');
    if (colName === 'storeid' || colName === 'store' || colName === 'storecode') {
      headerIndices.storeId = i;
    } else if (colName === 'sku' || colName === 'itemcode' || colName === 'partnumber') {
      headerIndices.sku = i;
    } else if (colName === 'productname' || colName === 'product' || colName === 'name' || colName === 'itemdescription') {
      headerIndices.productName = i;
    } else if (colName === 'price' || colName === 'cost' || colName === 'retailprice') {
      headerIndices.price = i;
    } else if (colName === 'date' || colName === 'pricingdate' || colName === 'effectiveat') {
      headerIndices.date = i;
    } else if (colName === 'country' || colName === 'countrycode' || colName === 'nation') {
      headerIndices.country = i;
    }
  }

  // Check if standard headers are found, otherwise fallback to defaults (0: StoreID, 1: SKU, 2: Name, 3: Price, 4: Date)
  if (headerIndices.storeId === -1) headerIndices.storeId = 0;
  if (headerIndices.sku === -1) headerIndices.sku = 1;
  if (headerIndices.productName === -1) headerIndices.productName = 2;
  if (headerIndices.price === -1) headerIndices.price = 3;
  if (headerIndices.date === -1) headerIndices.date = 4;

  const validRecords: Omit<PricingRecord, 'id' | 'updatedAt' | 'version'>[] = [];
  const errors: ImportErrorDetail[] = [];

  const chunkSize = 200; // Batch size per animation frame
  let currentIdx = 1; // Start after headers

  function processChunk() {
    const endIdx = Math.min(currentIdx + chunkSize, lines.length);

    for (let i = currentIdx; i < endIdx; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      try {
        const row = parseCSVLine(line);
        const res = validateAndMapRow(row, headerIndices, i + 1);

        if (res.valid && res.record) {
          validRecords.push(res.record);
        } else {
          errors.push({
            line: i + 1,
            error: res.error || 'Unknown validation error',
            rowData: line,
          });
        }
      } catch (err) {
        errors.push({
          line: i + 1,
          error: `Parsing crash: ${(err as Error).message}`,
          rowData: line,
        });
      }
    }

    currentIdx = endIdx;
    const progress = Math.round((currentIdx / lines.length) * 100);
    onProgress(progress, validRecords.length, errors.length);

    if (currentIdx < lines.length) {
      // Defer to next turn in event loop
      setTimeout(processChunk, 10);
    } else {
      const durationMs = Date.now() - startTime;
      onComplete(validRecords, errors, durationMs);
    }
  }

  // Kick off chunk processing
  processChunk();
}
