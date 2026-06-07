import storageService from '../src/database/StorageService';

describe('StorageService & IndexManager', () => {
  beforeEach(async () => {
    // Clear storage database before each test run
    await storageService.clearAll();
  });

  it('initially returns empty datasets', async () => {
    const res = await storageService.getRecords({});
    expect(res.records).toEqual([]);
    expect(res.totalCount).toBe(0);

    const stats = await storageService.getDashboardStats();
    expect(stats.totalRecords).toBe(0);
    expect(stats.uniqueStores).toBe(0);
  });

  it('performs bulk import, inserts new items, and builds search index', async () => {
    const newItems = [
      { storeId: 'STORE_US', sku: 'SKU1001', productName: 'Bluetooth Speaker', price: 99.99, date: '2026-06-01' },
      { storeId: 'STORE_UK', sku: 'SKU1002', productName: 'Smart Thermostat', price: 149.00, date: '2026-06-02' },
    ];

    const result = await storageService.importRecords(newItems);
    expect(result.importedCount).toBe(2);
    expect(result.updatedCount).toBe(0);

    // Retrieve active records
    const res = await storageService.getRecords({});
    expect(res.totalCount).toBe(2);
    expect(res.records[0].productName).toBe('Bluetooth Speaker'); // Sort default is SKU asc
  });

  it('applies de-duplication and feed date constraints correctly on import', async () => {
    // 1. Initial Import (Version 1)
    await storageService.importRecords([
      { storeId: 'STORE_US', sku: 'SKU1001', productName: 'Soundbar v1', price: 100.00, date: '2026-06-01' }
    ]);

    // 2. Import same SKU/Store with OLDER date -> should NOT overwrite
    const olderImport = await storageService.importRecords([
      { storeId: 'STORE_US', sku: 'SKU1001', productName: 'Soundbar v0', price: 80.00, date: '2025-06-01' }
    ]);
    expect(olderImport.importedCount).toBe(0);
    expect(olderImport.updatedCount).toBe(0);

    let records = (await storageService.getRecords({})).records;
    expect(records[0].price).toBe(100.00);
    expect(records[0].version).toBe(1);

    // 3. Import same SKU/Store with NEWER date -> should overwrite and increment version
    const newerImport = await storageService.importRecords([
      { storeId: 'STORE_US', sku: 'SKU1001', productName: 'Soundbar v2', price: 120.00, date: '2026-06-02' }
    ]);
    expect(newerImport.importedCount).toBe(0);
    expect(newerImport.updatedCount).toBe(1);

    records = (await storageService.getRecords({})).records;
    expect(records[0].price).toBe(120.00);
    expect(records[0].productName).toBe('Soundbar v2');
    expect(records[0].version).toBe(2);

    // Inspect audit history
    const logs = await storageService.getAuditLogs(records[0].id);
    expect(logs.length).toBe(2); // Creation log + Import log
    expect(logs[0].fieldChanged).toBe('import');
  });

  it('runs query filter indexing and fuzzy search lookups', async () => {
    await storageService.importRecords([
      { storeId: 'STORE_US', sku: 'SKU_ABC', productName: 'Ultra Wireless Headset', price: 150.00, date: '2026-06-01' },
      { storeId: 'STORE_UK', sku: 'SKU_XYZ', productName: 'Office Ergonomic Chair', price: 250.00, date: '2026-06-01' },
      { storeId: 'STORE_US', sku: 'SKU_INV', productName: 'Office Desk Lamp', price: 40.00, date: '2026-06-02' },
    ]);

    // Query 1: Search by SKU prefix
    let res = await storageService.getRecords({ query: 'sku_a' });
    expect(res.totalCount).toBe(1);
    expect(res.records[0].sku).toBe('SKU_ABC');

    // Query 2: Search by Product Name token
    res = await storageService.getRecords({ query: 'office' });
    expect(res.totalCount).toBe(2);

    // Query 3: Combined SKU query + Store Location filter
    res = await storageService.getRecords({ query: 'office', storeId: 'STORE_US' });
    expect(res.totalCount).toBe(1);
    expect(res.records[0].productName).toBe('Office Desk Lamp');
  });

  it('manually updates records and records detailed field-level audit logs', async () => {
    await storageService.importRecords([
      { storeId: 'STORE_IN', sku: 'SKU909', productName: 'Smart Ring', price: 15.00, date: '2026-06-01' }
    ]);

    const record = (await storageService.getRecords({})).records[0];

    // Modify price and name
    await storageService.updateRecord(record.id, {
      price: 18.50,
      productName: 'Smart Ring Gen 2',
    }, 'Store Manager');

    const updated = (await storageService.getRecords({})).records[0];
    expect(updated.price).toBe(18.50);
    expect(updated.productName).toBe('Smart Ring Gen 2');
    expect(updated.version).toBe(2);

    // Verify audit log has two new changes (creation + two manual edits)
    const logs = await storageService.getAuditLogs(record.id);
    expect(logs.length).toBe(3); // Creation + Price edit + Name edit
    expect(logs.find(l => l.fieldChanged === 'price')?.newValue).toBe('18.5');
    expect(logs.find(l => l.fieldChanged === 'productName')?.newValue).toBe('Smart Ring Gen 2');
  });

  it('compiles dashboard network analytics metrics correctly', async () => {
    await storageService.importRecords([
      { storeId: 'STORE_US', sku: 'SKU1', productName: 'A', price: 10.00, date: '2026-06-01' },
      { storeId: 'STORE_US', sku: 'SKU2', productName: 'B', price: 20.00, date: '2026-06-01' },
      { storeId: 'STORE_UK', sku: 'SKU1', productName: 'A', price: 30.00, date: '2026-06-01' },
    ]);

    const stats = await storageService.getDashboardStats();
    expect(stats.totalRecords).toBe(3);
    expect(stats.uniqueStores).toBe(2); // US, UK
    expect(stats.uniqueSkus).toBe(2); // SKU1, SKU2
    expect(stats.avgPriceUSD).toBe(20.00); // (10 + 20 + 30) / 3 = 20
  });

  it('filters country specifically by name, city, currency, or abbreviation code', async () => {
    await storageService.importRecords([
      { storeId: 'STORE_US', sku: 'SKU1', productName: 'Item A', price: 10.00, date: '2026-06-01' },
      { storeId: 'STORE_UK', sku: 'SKU2', productName: 'Item B', price: 20.00, date: '2026-06-01' },
      { storeId: 'STORE_IN', sku: 'SKU3', productName: 'Item C', price: 30.00, date: '2026-06-01' },
    ]);

    // Test search by resolved country name "United Kingdom"
    let res = await storageService.getRecords({ storeId: 'United Kingdom' });
    expect(res.totalCount).toBe(1);
    expect(res.records[0].storeId).toBe('STORE_UK');

    // Test search by currency code "INR"
    res = await storageService.getRecords({ storeId: 'INR' });
    expect(res.totalCount).toBe(1);
    expect(res.records[0].storeId).toBe('STORE_IN');

    // Test search by abbreviation prefix "US"
    res = await storageService.getRecords({ storeId: 'US' });
    expect(res.totalCount).toBe(1);
    expect(res.records[0].storeId).toBe('STORE_US');
  });
});
