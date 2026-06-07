import React, { useState, useEffect, useCallback } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import storageService from './src/database/StorageService';
import { PricingRecord, SearchCriteria } from './src/types';

// Components
import StatsDashboard from './src/components/StatsDashboard';
import CSVImporter from './src/components/CSVImporter';
import SearchFilters from './src/components/SearchFilters';
import RecordCard from './src/components/RecordCard';
import EditModal from './src/components/EditModal';

function AppContent() {
  const [records, setRecords] = useState<PricingRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SearchCriteria>({
    sortBy: 'sku',
    sortOrder: 'asc',
  });

  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState({
    totalRecords: 0,
    uniqueStores: 0,
    uniqueSkus: 0,
    avgPriceUSD: 0,
    recentAdjustmentsCount: 0,
  });

  // Editor Modal State
  const [selectedRecord, setSelectedRecord] = useState<PricingRecord | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Panel expandable states
  const [showImporter, setShowImporter] = useState(false);

  const fetchRecords = useCallback(async (activeFilters: SearchCriteria, activePage: number) => {
    setLoading(true);
    try {
      const result = await storageService.getRecords(activeFilters, activePage, 10); // 10 items per page
      setRecords(result.records);
      setTotalCount(result.totalCount);
      setPage(result.page);
      setTotalPages(result.totalPages);

      const stats = await storageService.getDashboardStats();
      setDashboardStats(stats);
    } catch (err) {
      console.error('Fetch pricing records failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize DB and load data
  useEffect(() => {
    const initialize = async () => {
      await storageService.init();
      fetchRecords(filters, 1);
    };
    initialize();
  }, [fetchRecords]);

  const handleFilterChange = (newFilters: SearchCriteria) => {
    setFilters(newFilters);
    setPage(1);
    fetchRecords(newFilters, 1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    fetchRecords(filters, newPage);
  };

  const handleImportComplete = () => {
    setPage(1);
    fetchRecords(filters, 1);
  };

  const handleEditPress = (record: PricingRecord) => {
    setSelectedRecord(record);
    setModalVisible(true);
  };

  const handleSaveRecord = async (updated: PricingRecord) => {
    setModalVisible(false);
    setSelectedRecord(null);
    fetchRecords(filters, page); // Reload the current page to preserve page state
  };

  const getRecordSummaryText = () => {
    if (totalCount === 0) return '0 records found';
    const start = (page - 1) * 10 + 1;
    const end = Math.min(page * 10, totalCount);
    return `Showing ${start}-${end} of ${totalCount.toLocaleString()} pricing records`;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

        {/* Global Hub Navigation Header */}
        <View style={styles.navbar}>
          <Text style={styles.navLogo}>🌐 PriceFeed Portal</Text>
          <TouchableOpacity
            style={[styles.importToggleBtn, showImporter && styles.importToggleBtnActive]}
            onPress={() => setShowImporter(!showImporter)}
          >
            <Text style={styles.importToggleText}>
              {showImporter ? '✕ Close Import' : '📥 Import CSV'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Metrics Grid (Restored to 2x2 grid outside ScrollView) */}
        <StatsDashboard stats={dashboardStats} />

        {/* CSV Importer Modal (Displays as a slide-up popup) */}
        <CSVImporter
          visible={showImporter}
          onClose={() => setShowImporter(false)}
          onImportComplete={handleImportComplete}
        />

        {/* Query Engine Controls */}
        <SearchFilters onFilterChange={handleFilterChange} />

        {/* Virtualized Inventory feed */}
        <View style={styles.listContainer}>
          <View style={styles.summaryBar}>
            <Text style={styles.summaryText}>{getRecordSummaryText()}</Text>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Running Query Index...</Text>
            </View>
          ) : records.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>No pricing records matched criteria</Text>
              <Text style={styles.emptySub}>Import a CSV feed or reset search filters</Text>
            </View>
          ) : (
            <FlatList
              data={records}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <RecordCard record={item} onEditPress={handleEditPress} />
              )}
              contentContainerStyle={styles.listContent}
              removeClippedSubviews={true}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={5}
            />
          )}
        </View>

        {/* Pagination Toolbar (Restored to Footer) */}
        {totalPages > 1 && !loading && (
          <View style={styles.paginationBar}>
            <TouchableOpacity
              style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
              onPress={() => handlePageChange(page - 1)}
              disabled={page === 1}
            >
              <Text style={styles.pageBtnText}>◀ Prev</Text>
            </TouchableOpacity>

            <View style={styles.pageInfo}>
              <Text style={styles.pageText}>
                Page <Text style={styles.boldText}>{page}</Text> of{' '}
                <Text style={styles.boldText}>{totalPages}</Text>
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
              onPress={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
            >
              <Text style={styles.pageBtnText}>Next ▶</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Edit Popup Modal */}
        <EditModal
          visible={modalVisible}
          record={selectedRecord}
          onClose={() => {
            setModalVisible(false);
            setSelectedRecord(null);
          }}
          onSave={handleSaveRecord}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  navLogo: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  importToggleBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  importToggleBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  importToggleText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  summaryBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#0F172A',
  },
  summaryText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 10,
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  emptySub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  paginationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  pageBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  pageBtnDisabled: {
    opacity: 0.3,
  },
  pageBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  pageInfo: {
    alignItems: 'center',
  },
  pageText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  boldText: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
});
