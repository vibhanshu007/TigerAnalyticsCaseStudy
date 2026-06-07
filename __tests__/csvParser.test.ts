import { parseCSVLine, splitCSVIntoLines, validateAndMapRow } from '../src/utils/csvParser';

describe('CSV Parser', () => {
  describe('splitCSVIntoLines', () => {
    it('splits rows by line breaks correctly', () => {
      const csv = 'A,B,C\n1,2,3\r\n4,5,6';
      const lines = splitCSVIntoLines(csv);
      expect(lines).toEqual(['A,B,C', '1,2,3', '4,5,6']);
    });

    it('ignores line breaks inside quotes', () => {
      const csv = 'A,"B\nWithBreak",C\n1,2,3';
      const lines = splitCSVIntoLines(csv);
      expect(lines).toEqual(['A,"B\nWithBreak",C', '1,2,3']);
    });
  });

  describe('parseCSVLine', () => {
    it('parses basic fields', () => {
      const line = 'STORE_US,SKU_100,Laptop,999.00,2026-06-01';
      expect(parseCSVLine(line)).toEqual(['STORE_US', 'SKU_100', 'Laptop', '999.00', '2026-06-01']);
    });

    it('handles quoted values containing commas', () => {
      const line = 'STORE_US,SKU_100,"Laptop, Super Pro",999.00,2026-06-01';
      expect(parseCSVLine(line)).toEqual(['STORE_US', 'SKU_100', 'Laptop, Super Pro', '999.00', '2026-06-01']);
    });

    it('handles double-double quotes inside quotes as escaped quotes', () => {
      const line = 'STORE_US,SKU_100,"Laptop ""Air""",999.00,2026-06-01';
      expect(parseCSVLine(line)).toEqual(['STORE_US', 'SKU_100', 'Laptop "Air"', '999.00', '2026-06-01']);
    });
  });

  describe('validateAndMapRow', () => {
    const indices = {
      storeId: 0,
      sku: 1,
      productName: 2,
      price: 3,
      date: 4,
    };

    it('validates a correct row successfully', () => {
      const row = ['STORE_US', 'SKU_123', 'Tablet', '299.99', '2026-06-01'];
      const result = validateAndMapRow(row, indices, 1);
      expect(result.valid).toBe(true);
      expect(result.record).toEqual({
        storeId: 'STORE_US',
        sku: 'SKU_123',
        productName: 'Tablet',
        price: 299.99,
        date: '2026-06-01',
      });
    });

    it('validates and maps row with country column successfully', () => {
      const countryIndices = {
        storeId: 0,
        sku: 2,
        productName: 3,
        price: 4,
        date: 5,
        country: 1,
      };
      const row = ['1001', 'US', 'SKU_123', 'Tablet', '299.99', '2026-06-01'];
      const result = validateAndMapRow(row, countryIndices, 1);
      expect(result.valid).toBe(true);
      expect(result.record?.country).toBe('US');
      expect(result.record?.storeId).toBe('1001');
    });

    it('flags missing Store ID', () => {
      const row = ['', 'SKU_123', 'Tablet', '299.99', '2026-06-01'];
      const result = validateAndMapRow(row, indices, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Store ID is missing');
    });

    it('flags non-alphanumeric Store ID', () => {
      const row = ['STORE@US', 'SKU_123', 'Tablet', '299.99', '2026-06-01'];
      const result = validateAndMapRow(row, indices, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Store ID \'STORE@US\' must be alphanumeric');
    });

    it('flags negative prices', () => {
      const row = ['STORE_US', 'SKU_123', 'Tablet', '-299.99', '2026-06-01'];
      const result = validateAndMapRow(row, indices, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Price cannot be negative');
    });

    it('flags invalid dates', () => {
      const row = ['STORE_US', 'SKU_123', 'Tablet', '299.99', '2026-15-40'];
      const result = validateAndMapRow(row, indices, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid date format');
    });
  });
});
