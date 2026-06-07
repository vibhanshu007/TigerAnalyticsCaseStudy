import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PricingRecord } from '../types';
import { getStoreMetadata } from '../database/StorageService';

interface RecordCardProps {
  record: PricingRecord;
  onEditPress: (record: PricingRecord) => void;
}

export function RecordCard({ record, onEditPress }: RecordCardProps) {
  const meta = getStoreMetadata(record.storeId);

  // Dynamic localization of currency prices
  const formatPrice = (price: number, currency: string, symbol: string) => {
    if (currency === 'JPY') {
      return `${symbol}${Math.round(price).toLocaleString()}`;
    }
    return `${symbol}${price.toFixed(2)}`;
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.productBlock}>
          <Text style={styles.productName} numberOfLines={1}>
            {record.productName}
          </Text>
          <Text style={styles.skuText}>{record.sku}</Text>
        </View>
        <Text style={styles.priceText}>
          {formatPrice(record.price, meta.currency, meta.currencySymbol)}
        </Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardFooter}>
        <View style={styles.storeBlock}>
          <Text style={styles.storeFlag}>{meta.id === 'STORE_US' ? '🇺🇸' : meta.id === 'STORE_UK' ? '🇬🇧' : meta.id === 'STORE_EU' ? '🇪🇺' : meta.id === 'STORE_IN' ? '🇮🇳' : meta.id === 'STORE_JP' ? '🇯🇵' : '🌐'}</Text>
          <View>
            <Text style={styles.storeName}>{meta.name}</Text>
            <Text style={styles.storeLocation}>{meta.city}, {meta.country}</Text>
          </View>
        </View>

        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Feed Date:</Text>
            <Text style={styles.metaValue}>{record.date}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Version:</Text>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>v{record.version}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Text style={styles.timestamp}>
          Updated {new Date(record.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => onEditPress(record)}
        >
          <Text style={styles.editBtnText}>✏️ Edit Record</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productBlock: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  skuText: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#10B981', // Emerald 500
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  storeFlag: {
    fontSize: 20,
    marginRight: 8,
  },
  storeName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  storeLocation: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 1,
  },
  metaBlock: {
    alignItems: 'flex-end',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 9,
    color: '#64748B',
    marginRight: 4,
  },
  metaValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  versionBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  versionText: {
    fontSize: 9,
    color: '#3B82F6',
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.03)',
  },
  timestamp: {
    fontSize: 9,
    color: '#475569',
  },
  editButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  editBtnText: {
    fontSize: 10,
    color: '#F8FAFC',
    fontWeight: '700',
  },
});
export default RecordCard;
