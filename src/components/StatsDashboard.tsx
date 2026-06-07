import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatsDashboardProps {
  stats: {
    totalRecords: number;
    uniqueStores: number;
    uniqueSkus: number;
    avgPriceUSD: number;
    recentAdjustmentsCount: number;
  };
}

export function StatsDashboard({ stats }: StatsDashboardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        <View style={[styles.card, styles.gradientCard1]}>
          <Text style={styles.icon}>📊</Text>
          <Text style={styles.val} numberOfLines={1}>{stats.totalRecords.toLocaleString()}</Text>
          <Text style={styles.label} numberOfLines={1}>Records</Text>
        </View>

        <View style={[styles.card, styles.gradientCard2]}>
          <Text style={styles.icon}>🏬</Text>
          <Text style={styles.val} numberOfLines={1}>{stats.uniqueStores.toLocaleString()}/3k</Text>
          <Text style={styles.label} numberOfLines={1}>Stores</Text>
        </View>

        <View style={[styles.card, styles.gradientCard3]}>
          <Text style={styles.icon}>🏷️</Text>
          <Text style={styles.val} numberOfLines={1}>{stats.uniqueSkus.toLocaleString()}</Text>
          <Text style={styles.label} numberOfLines={1}>SKUs</Text>
        </View>

        <View style={[styles.card, styles.gradientCard4]}>
          <Text style={styles.icon}>🔄</Text>
          <Text style={styles.val} numberOfLines={1}>{stats.recentAdjustmentsCount}</Text>
          <Text style={styles.label} numberOfLines={1}>24h Edits</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0F172A', // Slate 900
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  card: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  gradientCard1: {
    backgroundColor: '#1E293B', // Slate 800
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6', // Blue
  },
  gradientCard2: {
    backgroundColor: '#1E293B',
    borderLeftWidth: 3,
    borderLeftColor: '#10B981', // Green
  },
  gradientCard3: {
    backgroundColor: '#1E293B',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B', // Amber
  },
  gradientCard4: {
    backgroundColor: '#1E293B',
    borderLeftWidth: 3,
    borderLeftColor: '#EC4899', // Pink
  },
  icon: {
    fontSize: 15,
    marginBottom: 2,
  },
  val: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  label: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default StatsDashboard;
