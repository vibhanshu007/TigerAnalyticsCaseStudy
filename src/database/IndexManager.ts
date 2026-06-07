import { PricingRecord } from '../types';
import { matchesStoreFilter } from './StoreMetadata';

export class IndexManager {
  private storeIndex = new Map<string, Set<string>>();
  private skuIndex = new Map<string, Set<string>>();
  private wordIndex = new Map<string, Set<string>>();
  private recordIds = new Set<string>();

  /**
   * Rebuilds indices completely from an array of records.
   */
  public rebuild(records: PricingRecord[]) {
    this.storeIndex.clear();
    this.skuIndex.clear();
    this.wordIndex.clear();
    this.recordIds.clear();

    for (const record of records) {
      this.add(record);
    }
  }

  /**
   * Adds a single record to the indices.
   */
  public add(record: PricingRecord) {
    const id = record.id;
    this.recordIds.add(id);

    // 1. Store Index
    const storeKey = record.storeId.toUpperCase();
    if (!this.storeIndex.has(storeKey)) {
      this.storeIndex.set(storeKey, new Set());
    }
    this.storeIndex.get(storeKey)!.add(id);

    // 2. SKU Index
    const skuKey = record.sku.toUpperCase();
    if (!this.skuIndex.has(skuKey)) {
      this.skuIndex.set(skuKey, new Set());
    }
    this.skuIndex.get(skuKey)!.add(id);

    // 3. Product Word Token Index
    const tokens = this.tokenize(record.productName);
    for (const token of tokens) {
      if (!this.wordIndex.has(token)) {
        this.wordIndex.set(token, new Set());
      }
      this.wordIndex.get(token)!.add(id);
    }
  }

  /**
   * Removes a record ID from the indices.
   */
  public remove(record: PricingRecord) {
    const id = record.id;
    this.recordIds.delete(id);

    const storeKey = record.storeId.toUpperCase();
    this.storeIndex.get(storeKey)?.delete(id);

    const skuKey = record.sku.toUpperCase();
    this.skuIndex.get(skuKey)?.delete(id);

    const tokens = this.tokenize(record.productName);
    for (const token of tokens) {
      this.wordIndex.get(token)?.delete(id);
    }
  }

  /**
   * Updates indices for a modified record.
   */
  public update(oldRecord: PricingRecord, newRecord: PricingRecord) {
    this.remove(oldRecord);
    this.add(newRecord);
  }

  /**
   * Tokenizes a product name into lowercase searchable terms.
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((token) => token.length > 0);
  }

  /**
   * Searches the indices based on query, storeId, SKU criteria and returns matching record IDs.
   */
  public query(query?: string, storeId?: string): Set<string> {
    let result = new Set(this.recordIds);

    // 1. Filter by Store ID or Country Code Prefix
    if (storeId) {
      const storeMatches = new Set<string>();

      // Scan the storeIndex map keys for substring match
      for (const [key, ids] of this.storeIndex.entries()) {
        if (matchesStoreFilter(key, storeId)) {
          for (const id of ids) {
            storeMatches.add(id);
          }
        }
      }

      if (storeMatches.size === 0) {
        return new Set(); // No records match this store/country code
      }
      result = this.intersect(result, storeMatches);
      if (result.size === 0) return result;
    }

    // 2. Search query (Fuzzy Product Name tokens OR SKU prefix match)
    if (query) {
      const cleanQuery = query.trim().toLowerCase();
      if (cleanQuery) {
        const queryTokens = this.tokenize(cleanQuery);
        let queryMatches = new Set<string>();

        // Check SKU index for exact/prefix matches
        const upperQuery = cleanQuery.toUpperCase();
        for (const [sku, ids] of this.skuIndex.entries()) {
          if (sku.startsWith(upperQuery)) {
            for (const id of ids) queryMatches.add(id);
          }
        }

        // Token matches on product names
        if (queryTokens.length > 0) {
          // Find records matching ANY token or ALL tokens.
          // For a good search UX, let's look for records matching ALL tokens first,
          // falling back to ANY if no matches are found, or combining them.
          let tokenMatchSet: Set<string> | null = null;
          for (const token of queryTokens) {
            // Find keys starting with token to support prefix matches (e.g. "appl" matches "apple")
            const tokenSet = new Set<string>();
            for (const [word, ids] of this.wordIndex.entries()) {
              if (word.startsWith(token)) {
                for (const id of ids) tokenSet.add(id);
              }
            }

            if (tokenMatchSet === null) {
              tokenMatchSet = tokenSet;
            } else {
              tokenMatchSet = this.intersect(tokenMatchSet, tokenSet);
            }
          }
          if (tokenMatchSet) {
            for (const id of tokenMatchSet) queryMatches.add(id);
          }
        }

        result = this.intersect(result, queryMatches);
      }
    }

    return result;
  }

  /**
   * Helper to perform set intersection.
   */
  private intersect(setA: Set<string>, setB: Set<string>): Set<string> {
    const intersection = new Set<string>();
    const [smaller, larger] = setA.size < setB.size ? [setA, setB] : [setB, setA];
    for (const elem of smaller) {
      if (larger.has(elem)) {
        intersection.add(elem);
      }
    }
    return intersection;
  }
}
