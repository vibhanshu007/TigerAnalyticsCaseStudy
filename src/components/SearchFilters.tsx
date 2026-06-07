import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { SearchCriteria } from '../types';

interface SearchFiltersProps {
  onFilterChange: (filters: SearchCriteria) => void;
}

const STORES = [
  { id: '', label: '🌐 All Countries' },
  { id: 'US', label: '🇺🇸 US' },
  { id: 'UK', label: '🇬🇧 UK' },
  { id: 'EU', label: '🇪🇺 EU' },
  { id: 'IN', label: '🇮🇳 IN' },
  { id: 'JP', label: '🇯🇵 JP' },
];

export function SearchFilters({ onFilterChange }: SearchFiltersProps) {
  const [query, setQuery] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Advanced filters state
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'price' | 'sku' | 'productName'>('sku');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const updateFilters = (updatedFields: Partial<SearchCriteria>) => {
    const filters: SearchCriteria = {
      query: updatedFields.query !== undefined ? updatedFields.query : query,
      storeId: updatedFields.storeId !== undefined ? updatedFields.storeId : selectedStore,
      minPrice: updatedFields.minPrice !== undefined ? updatedFields.minPrice : (minPrice ? parseFloat(minPrice) : undefined),
      maxPrice: updatedFields.maxPrice !== undefined ? updatedFields.maxPrice : (maxPrice ? parseFloat(maxPrice) : undefined),
      startDate: updatedFields.startDate !== undefined ? updatedFields.startDate : (startDate || undefined),
      endDate: updatedFields.endDate !== undefined ? updatedFields.endDate : (endDate || undefined),
      sortBy: updatedFields.sortBy !== undefined ? updatedFields.sortBy : sortBy,
      sortOrder: updatedFields.sortOrder !== undefined ? updatedFields.sortOrder : sortOrder,
    };
    onFilterChange(filters);
  };

  const handleQueryChange = (text: string) => {
    setQuery(text);
    updateFilters({ query: text });
  };

  const handleStoreSelect = (storeId: string) => {
    setSelectedStore(storeId);
    updateFilters({ storeId });
  };

  const handleApplyAdvanced = () => {
    updateFilters({});
    setShowAdvanced(false);
  };

  const handleResetFilters = () => {
    setQuery('');
    setSelectedStore('');
    setMinPrice('');
    maxPrice && setMaxPrice('');
    setStartDate('');
    setEndDate('');
    setSortBy('sku');
    setSortOrder('asc');
    
    onFilterChange({
      query: query, // Keep query text
      storeId: '',
      minPrice: undefined,
      maxPrice: undefined,
      startDate: undefined,
      endDate: undefined,
      sortBy: 'sku',
      sortOrder: 'asc',
    });
    setShowAdvanced(false);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedStore) count++;
    if (minPrice) count++;
    if (maxPrice) count++;
    if (startDate) count++;
    if (endDate) count++;
    if (sortBy !== 'date' || sortOrder !== 'desc') count++;
    return count;
  };

  const activeCount = getActiveFilterCount();

  return (
    <View style={styles.container}>
      {/* Primary search input */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search SKU or Product Name..."
          placeholderTextColor="#64748B"
          value={query}
          onChangeText={handleQueryChange}
        />
        <TouchableOpacity
          style={[styles.advancedBtn, activeCount > 0 && styles.advancedBtnActive]}
          onPress={() => setShowAdvanced(true)}
        >
          <Text style={[styles.advancedBtnText, activeCount > 0 && styles.advancedBtnTextActive]}>
            ⚡ Filters {activeCount > 0 ? `(${activeCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Advanced Filter Modal Popup */}
      <Modal
        visible={showAdvanced}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAdvanced(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Filter Pricing Records</Text>
                <Text style={styles.modalSub}>Narrow network stores and inventory ranges</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowAdvanced(false)}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled">
              {/* Store locations selector */}
              <Text style={styles.inputLabel}>Country Network Location</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.storeList}
                style={styles.horizontalScroll}
              >
                {STORES.map((st) => (
                  <TouchableOpacity
                    key={st.id}
                    style={[
                      styles.storeBadge,
                      selectedStore === st.id && styles.storeBadgeActive,
                    ]}
                    onPress={() => handleStoreSelect(st.id)}
                  >
                    <Text
                      style={[
                        styles.storeBadgeText,
                        selectedStore === st.id && styles.storeBadgeTextActive,
                      ]}
                    >
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Pricing range row */}
              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={styles.inputLabel}>Min Price ($)</Text>
                  <TextInput
                    style={styles.advancedInput}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#475569"
                    value={minPrice}
                    onChangeText={(val) => { setMinPrice(val); updateFilters({ minPrice: val ? parseFloat(val) : undefined }); }}
                  />
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.inputLabel}>Max Price ($)</Text>
                  <TextInput
                    style={styles.advancedInput}
                    keyboardType="numeric"
                    placeholder="9999"
                    placeholderTextColor="#475569"
                    value={maxPrice}
                    onChangeText={(val) => { setMaxPrice(val); updateFilters({ maxPrice: val ? parseFloat(val) : undefined }); }}
                  />
                </View>
              </View>

              {/* Date range row */}
              <View style={styles.gridRow}>
                <View style={styles.gridCol}>
                  <Text style={styles.inputLabel}>Start Date</Text>
                  <TextInput
                    style={styles.advancedInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#475569"
                    value={startDate}
                    onChangeText={(val) => { setStartDate(val); updateFilters({ startDate: val || undefined }); }}
                  />
                </View>
                <View style={styles.gridCol}>
                  <Text style={styles.inputLabel}>End Date</Text>
                  <TextInput
                    style={styles.advancedInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#475569"
                    value={endDate}
                    onChangeText={(val) => { setEndDate(val); updateFilters({ endDate: val || undefined }); }}
                  />
                </View>
              </View>

              {/* Sorting configurations */}
              <View style={styles.sortSection}>
                <Text style={styles.inputLabel}>Sort Records By</Text>
                <View style={styles.sortRow}>
                  {(['date', 'price', 'sku', 'productName'] as const).map((field) => (
                    <TouchableOpacity
                      key={field}
                      style={[styles.sortBadge, sortBy === field && styles.sortBadgeActive]}
                      onPress={() => { setSortBy(field); updateFilters({ sortBy: field }); }}
                    >
                      <Text style={[styles.sortBadgeText, sortBy === field && styles.sortBadgeTextActive]}>
                        {field === 'productName' ? 'name' : field}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.orderRow}>
                  <TouchableOpacity
                    style={[styles.orderBtn, sortOrder === 'asc' && styles.orderBtnActive]}
                    onPress={() => { setSortOrder('asc'); updateFilters({ sortOrder: 'asc' }); }}
                  >
                    <Text style={styles.orderBtnText}>Ascending 📈</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.orderBtn, sortOrder === 'desc' && styles.orderBtnActive]}
                    onPress={() => { setSortOrder('desc'); updateFilters({ sortOrder: 'desc' }); }}
                  >
                    <Text style={styles.orderBtnText}>Descending 📉</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.resetBtn} onPress={handleResetFilters}>
                <Text style={styles.resetBtnText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={handleApplyAdvanced}>
                <Text style={styles.applyBtnText}>Apply Constraints</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 42,
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  advancedBtn: {
    backgroundColor: '#1E293B',
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  advancedBtnActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3B82F6',
  },
  advancedBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  advancedBtnTextActive: {
    color: '#3B82F6',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)', // Slate 900 translucent
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B', // Slate 800
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  modalSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContainer: {
    marginBottom: 16,
  },
  horizontalScroll: {
    marginVertical: 8,
  },
  storeList: {
    paddingRight: 16,
  },
  storeBadge: {
    backgroundColor: '#0F172A', // Slate 900
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  storeBadgeActive: {
    backgroundColor: '#3B82F6',
  },
  storeBadgeText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  storeBadgeTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  gridCol: {
    width: '48%',
  },
  inputLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  advancedInput: {
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  sortSection: {
    marginTop: 10,
    marginBottom: 16,
  },
  sortRow: {
    flexDirection: 'row',
    marginVertical: 6,
  },
  sortBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  sortBadgeActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3B82F6',
  },
  sortBadgeText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sortBadgeTextActive: {
    color: '#3B82F6',
  },
  orderRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  orderBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  orderBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10B981',
  },
  orderBtnText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 14,
  },
  resetBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#334155', // Slate 700
  },
  resetBtnText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '700',
  },
  applyBtn: {
    flex: 2,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3B82F6', // Blue
  },
  applyBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
export default SearchFilters;
