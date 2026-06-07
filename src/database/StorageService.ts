import { PricingRecord, AuditLogEntry, SearchCriteria } from '../types';
import { IndexManager } from './IndexManager';
import { STORES_METADATA, getStoreMetadata } from './StoreMetadata';

export { getStoreMetadata };

class StorageService {
  private records = new Map<string, PricingRecord>();
  private auditLogs: AuditLogEntry[] = [];
  private indexManager = new IndexManager();
  private storageKey = '@pricing_feeds_records';
  private logsKey = '@pricing_feeds_logs';
  private initialized = false;

  private getAsyncStorage() {
    try {
      // Safely check if module exists to prevent crash on environments where AsyncStorage isn't installed
      return require('@react-native-async-storage/async-storage').default;
    } catch {
      return null;
    }
  }

  /**
   * Initializes the storage engine, loading records from persistent storage if available.
   */
  public async init(): Promise<void> {
    if (this.initialized) return;

    const storage = this.getAsyncStorage();
    if (storage) {
      try {
        const storedRecs = await storage.getItem(this.storageKey);
        const storedLogs = await storage.getItem(this.logsKey);

        if (storedRecs) {
          const parsed = JSON.parse(storedRecs) as PricingRecord[];
          for (const rec of parsed) {
            this.records.set(rec.id, rec);
          }
        }
        if (storedLogs) {
          this.auditLogs = JSON.parse(storedLogs) as AuditLogEntry[];
        }
      } catch (err) {
        console.error('StorageService init failure, falling back to memory:', err);
      }
    }

    this.indexManager.rebuild(Array.from(this.records.values()));
    this.initialized = true;
  }

  /**
   * Persists database state.
   */
  private async persist(): Promise<void> {
    const storage = this.getAsyncStorage();
    if (!storage) return;

    try {
      const recordsArray = Array.from(this.records.values());
      await storage.setItem(this.storageKey, JSON.stringify(recordsArray));
      await storage.setItem(this.logsKey, JSON.stringify(this.auditLogs));
    } catch (err) {
      console.error('StorageService persist failure:', err);
    }
  }

  /**
   * Clears the entire database (useful for testing or resetting).
   */
  public async clearAll(): Promise<void> {
    this.records.clear();
    this.auditLogs = [];
    this.indexManager.rebuild([]);
    await this.persist();
  }

  /**
   * Bulk imports pricing records.
   * Performs de-duplication: matching StoreID & SKU. If date is newer, overwrites.
   */
  public async importRecords(
    newRecords: Omit<PricingRecord, 'id' | 'updatedAt' | 'version'>[],
    author = 'System CSV Import'
  ): Promise<{ importedCount: number; updatedCount: number }> {
    await this.init();

    let importedCount = 0;
    let updatedCount = 0;
    const nowStr = new Date().toISOString();

    for (const rec of newRecords) {
      const id = `${rec.storeId.toUpperCase()}_${rec.sku.toUpperCase()}`;
      const existing = this.records.get(id);

      if (existing) {
        // Feed Date check: Only update if the new pricing feed has a newer or same date
        const existingDate = new Date(existing.date);
        const newDate = new Date(rec.date);

        if (newDate >= existingDate) {
          // Detect changes to log them
          const changes: string[] = [];
          if (existing.price !== rec.price) changes.push(`price: ${existing.price} -> ${rec.price}`);
          if (existing.productName !== rec.productName) changes.push(`name: '${existing.productName}' -> '${rec.productName}'`);
          if (existing.date !== rec.date) changes.push(`date: ${existing.date} -> ${rec.date}`);

          if (changes.length > 0) {
            const updatedRec: PricingRecord = {
              ...existing,
              productName: rec.productName,
              price: rec.price,
              date: rec.date,
              updatedAt: nowStr,
              version: existing.version + 1,
            };

            this.records.set(id, updatedRec);
            this.indexManager.update(existing, updatedRec);
            updatedCount++;

            // Create audit log for bulk update
            this.auditLogs.push({
              id: Math.random().toString(36).substring(2, 9),
              recordId: id,
              fieldChanged: 'import',
              oldValue: `Ver ${existing.version} (${existing.price}, ${existing.date})`,
              newValue: `Ver ${updatedRec.version} (${rec.price}, ${rec.date}) - Changes: ${changes.join(', ')}`,
              changedBy: author,
              changedAt: nowStr,
            });
          }
        }
      } else {
        // New record insertion
        const newRec: PricingRecord = {
          ...rec,
          id,
          updatedAt: nowStr,
          version: 1,
        };

        this.records.set(id, newRec);
        this.indexManager.add(newRec);
        importedCount++;

        this.auditLogs.push({
          id: Math.random().toString(36).substring(2, 9),
          recordId: id,
          fieldChanged: 'creation',
          oldValue: 'None',
          newValue: `SKU: ${rec.sku}, Price: ${rec.price}, Date: ${rec.date}`,
          changedBy: author,
          changedAt: nowStr,
        });
      }
    }

    if (importedCount > 0 || updatedCount > 0) {
      await this.persist();
    }

    return { importedCount, updatedCount };
  }

  /**
   * Updates a pricing record, generating precise audit logs for every changed field.
   */
  public async updateRecord(
    id: string,
    updates: Partial<Pick<PricingRecord, 'price' | 'productName' | 'date'>>,
    author: string
  ): Promise<PricingRecord | null> {
    await this.init();

    const existing = this.records.get(id);
    if (!existing) return null;

    const nowStr = new Date().toISOString();
    const updatedRec: PricingRecord = {
      ...existing,
      version: existing.version + 1,
      updatedAt: nowStr,
    };

    let changed = false;

    if (updates.price !== undefined && updates.price !== existing.price) {
      this.auditLogs.push({
        id: Math.random().toString(36).substring(2, 9),
        recordId: id,
        fieldChanged: 'price',
        oldValue: existing.price.toString(),
        newValue: updates.price.toString(),
        changedBy: author,
        changedAt: nowStr,
      });
      updatedRec.price = updates.price;
      changed = true;
    }

    if (updates.productName !== undefined && updates.productName !== existing.productName) {
      this.auditLogs.push({
        id: Math.random().toString(36).substring(2, 9),
        recordId: id,
        fieldChanged: 'productName',
        oldValue: existing.productName,
        newValue: updates.productName,
        changedBy: author,
        changedAt: nowStr,
      });
      updatedRec.productName = updates.productName;
      changed = true;
    }

    if (updates.date !== undefined && updates.date !== existing.date) {
      this.auditLogs.push({
        id: Math.random().toString(36).substring(2, 9),
        recordId: id,
        fieldChanged: 'date',
        oldValue: existing.date,
        newValue: updates.date,
        changedBy: author,
        changedAt: nowStr,
      });
      updatedRec.date = updates.date;
      changed = true;
    }

    if (changed) {
      this.records.set(id, updatedRec);
      this.indexManager.update(existing, updatedRec);
      await this.persist();
      return updatedRec;
    }

    return existing;
  }

  /**
   * Queries records by search criteria using indexing, custom filtering, and sorting.
   */
  public async getRecords(
    criteria: SearchCriteria,
    page = 1,
    pageSize = 20
  ): Promise<{
    records: PricingRecord[];
    totalCount: number;
    page: number;
    totalPages: number;
  }> {
    await this.init();

    // 1. Fetch matching record IDs via fast Index Lookup
    const matchingIds = this.indexManager.query(criteria.query, criteria.storeId);
    let matchedRecords: PricingRecord[] = [];

    // 2. Fetch records and apply additional range filters
    for (const id of matchingIds) {
      const rec = this.records.get(id);
      if (rec) {
        // Range validation
        if (criteria.startDate && rec.date < criteria.startDate) continue;
        if (criteria.endDate && rec.date > criteria.endDate) continue;
        if (criteria.minPrice !== undefined && rec.price < criteria.minPrice) continue;
        if (criteria.maxPrice !== undefined && rec.price > criteria.maxPrice) continue;

        matchedRecords.push(rec);
      }
    }

    const totalCount = matchedRecords.length;

    // 3. Sorting
    const sortBy = criteria.sortBy || 'sku';
    const sortOrder = criteria.sortOrder || 'asc';

    matchedRecords.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (sortBy === 'price') {
        valA = a.price;
        valB = b.price;
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // 4. Pagination
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const activePage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (activePage - 1) * pageSize;
    const paginatedRecords = matchedRecords.slice(startIndex, startIndex + pageSize);

    return {
      records: paginatedRecords,
      totalCount,
      page: activePage,
      totalPages,
    };
  }

  /**
   * Retrieves full audit log for a specific record.
   */
  public async getAuditLogs(recordId: string): Promise<AuditLogEntry[]> {
    await this.init();
    return this.auditLogs
      .map((log, index) => ({ log, index }))
      .filter(({ log }) => log.recordId === recordId)
      .sort((a, b) => {
        const timeA = new Date(a.log.changedAt).getTime();
        const timeB = new Date(b.log.changedAt).getTime();
        if (timeA !== timeB) {
          return timeB - timeA;
        }
        return b.index - a.index; // Fallback to array index descending
      })
      .map(({ log }) => log);
  }

  /**
   * Aggregates key metrics for the global store network dashboard.
   */
  public async getDashboardStats(): Promise<{
    totalRecords: number;
    uniqueStores: number;
    uniqueSkus: number;
    avgPriceUSD: number; // For aggregate, convert roughly or show base USD average
    recentAdjustmentsCount: number;
  }> {
    await this.init();

    const allRecords = Array.from(this.records.values());
    const storesSet = new Set<string>();
    const skusSet = new Set<string>();
    let priceSum = 0;

    for (const rec of allRecords) {
      storesSet.add(rec.storeId);
      skusSet.add(rec.sku);

      // Average price calculations (in real system, normalized using exchange rates.
      // Here, we take the raw numerical values for display purposes).
      priceSum += rec.price;
    }

    const recentLogs = this.auditLogs.filter((log) => {
      const changeDate = new Date(log.changedAt);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return changeDate >= oneDayAgo && (log.fieldChanged === 'price' || log.fieldChanged === 'import');
    });

    return {
      totalRecords: allRecords.length,
      uniqueStores: storesSet.size,
      uniqueSkus: skusSet.size,
      avgPriceUSD: allRecords.length > 0 ? parseFloat((priceSum / allRecords.length).toFixed(2)) : 0,
      recentAdjustmentsCount: recentLogs.length,
    };
  }
}

export const storageService = new StorageService();
export default storageService;
