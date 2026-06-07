import { StoreMetadata } from '../types';

// Store profile dictionary mapping store IDs to their metadata (currencies, countries)
export const STORES_METADATA: Record<string, StoreMetadata> = {
  STORE_US: { id: 'STORE_US', name: 'New York Flagship', city: 'New York', country: 'United States', currency: 'USD', currencySymbol: '$' },
  STORE_UK: { id: 'STORE_UK', name: 'London Central', city: 'London', country: 'United Kingdom', currency: 'GBP', currencySymbol: '£' },
  STORE_EU: { id: 'STORE_EU', name: 'Berlin Square', city: 'Berlin', country: 'Germany', currency: 'EUR', currencySymbol: '€' },
  STORE_IN: { id: 'STORE_IN', name: 'Mumbai Retail', city: 'Mumbai', country: 'India', currency: 'INR', currencySymbol: '₹' },
  STORE_JP: { id: 'STORE_JP', name: 'Tokyo Shinjuku', city: 'Tokyo', country: 'Japan', currency: 'JPY', currencySymbol: '¥' },
};

// Fallback metadata helper for dynamic/unknown stores
export function getStoreMetadata(storeId: string): StoreMetadata {
  const cleanId = storeId.toUpperCase().trim();
  
  // Try exact match
  if (STORES_METADATA[cleanId]) {
    return STORES_METADATA[cleanId];
  }
  
  // Try pattern matching based on store suffix/prefix (e.g. STORE_US_01 -> US)
  for (const key of Object.keys(STORES_METADATA)) {
    if (cleanId.includes(key) || key.includes(cleanId)) {
      return STORES_METADATA[key];
    }
  }

  // Generic fallback based on country code in store ID (e.g., US01 -> US)
  if (cleanId.includes('US')) return STORES_METADATA.STORE_US;
  if (cleanId.includes('UK') || cleanId.includes('GB')) return STORES_METADATA.STORE_UK;
  if (cleanId.includes('EU') || cleanId.includes('DE') || cleanId.includes('FR')) return STORES_METADATA.STORE_EU;
  if (cleanId.includes('IN')) return STORES_METADATA.STORE_IN;
  if (cleanId.includes('JP')) return STORES_METADATA.STORE_JP;

  // Global default
  return {
    id: cleanId,
    name: `Store ${cleanId}`,
    city: 'Global',
    country: 'International',
    currency: 'USD',
    currencySymbol: '$',
  };
}

/**
 * Checks if a store ID matches a search filter term by store ID, country, name, city, currency, or abbreviation.
 */
export function matchesStoreFilter(storeId: string, filterText: string): boolean {
  const filterKey = filterText.toUpperCase().trim();
  if (!filterKey) return true;

  const cleanStoreId = storeId.toUpperCase().trim();

  // Direct store ID substring check
  if (cleanStoreId.includes(filterKey) || filterKey.includes(cleanStoreId)) {
    return true;
  }

  // Resolve metadata to inspect country and other fields
  const meta = getStoreMetadata(storeId);
  const country = meta.country.toUpperCase();
  const name = meta.name.toUpperCase();
  const city = meta.city.toUpperCase();
  const currency = meta.currency.toUpperCase();

  if (
    country.includes(filterKey) ||
    name.includes(filterKey) ||
    city.includes(filterKey) ||
    currency.includes(filterKey)
  ) {
    return true;
  }

  // Specific country code / abbreviation mappings
  if (filterKey === 'US' && (country.includes('UNITED STATES') || cleanStoreId.includes('US'))) return true;
  if ((filterKey === 'UK' || filterKey === 'GB') && (country.includes('UNITED KINGDOM') || cleanStoreId.includes('UK') || cleanStoreId.includes('GB'))) return true;
  if ((filterKey === 'EU' || filterKey === 'DE' || filterKey === 'FR') && (country.includes('GERMANY') || country.includes('EUROPE') || cleanStoreId.includes('EU'))) return true;
  if (filterKey === 'IN' && (country.includes('INDIA') || cleanStoreId.includes('IN'))) return true;
  if (filterKey === 'JP' && (country.includes('JAPAN') || cleanStoreId.includes('JP'))) return true;

  return false;
}
