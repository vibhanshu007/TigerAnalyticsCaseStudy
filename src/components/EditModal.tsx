import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { PricingRecord, AuditLogEntry } from '../types';
import storageService, { getStoreMetadata } from '../database/StorageService';

interface EditModalProps {
  visible: boolean;
  record: PricingRecord | null;
  onClose: () => void;
  onSave: (updatedRecord: PricingRecord) => void;
}

export function EditModal({ visible, record, onClose, onSave }: EditModalProps) {
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (record) {
      setProductName(record.productName);
      setPrice(record.price.toString());
      setDate(record.date);
      setErrorMsg('');
      loadAuditHistory(record.id);
    }
  }, [record, visible]);

  const loadAuditHistory = async (recordId: string) => {
    setLoadingLogs(true);
    try {
      const logs = await storageService.getAuditLogs(recordId);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to load audit history:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSave = async () => {
    if (!record) return;

    // 1. Validation checks
    if (!productName.trim()) {
      setErrorMsg('Product name cannot be empty');
      return;
    }

    const numericPrice = parseFloat(price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      setErrorMsg('Price must be a valid, positive decimal number');
      return;
    }

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(date)) {
      setErrorMsg('Date must be in YYYY-MM-DD format');
      return;
    }

    const checkDate = new Date(date);
    if (isNaN(checkDate.getTime())) {
      setErrorMsg('Invalid calendar date entered');
      return;
    }

    try {
      const updated = await storageService.updateRecord(
        record.id,
        {
          productName: productName.trim(),
          price: numericPrice,
          date,
        },
        'Store Manager' // Author
      );

      if (updated) {
        onSave(updated);
      }
    } catch (err) {
      setErrorMsg(`Save failed: ${(err as Error).message}`);
    }
  };

  if (!record) return null;
  const storeMeta = getStoreMetadata(record.storeId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Edit Pricing Entry</Text>
              <Text style={styles.modalSub}>{record.sku} — {storeMeta.name}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {errorMsg ? (
            <View style={styles.errorAlert}>
              <Text style={styles.errorAlertText}>⚠️ {errorMsg}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
            {/* Form Fields */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Product Name</Text>
              <TextInput
                style={styles.textInput}
                value={productName}
                onChangeText={setProductName}
                placeholder="Product Name"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.rowFields}>
              <View style={[styles.fieldContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Retail Price ({storeMeta.currency})</Text>
                <TextInput
                  style={styles.textInput}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor="#64748B"
                />
              </View>
              <View style={[styles.fieldContainer, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Pricing Date</Text>
                <TextInput
                  style={styles.textInput}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#64748B"
                />
              </View>
            </View>

            {/* Audit Log Timeline */}
            <View style={styles.auditContainer}>
              <Text style={styles.auditTitle}>📜 Pricing Audit History</Text>
              
              {loadingLogs ? (
                <ActivityIndicator size="small" color="#3B82F6" style={{ margin: 12 }} />
              ) : auditLogs.length === 0 ? (
                <Text style={styles.emptyLogs}>No modification history available.</Text>
              ) : (
                <View style={styles.timeline}>
                  {auditLogs.map((log) => (
                    <View key={log.id} style={styles.timelineItem}>
                      <View style={styles.timelineDot} />
                      <View style={styles.timelineContent}>
                        <View style={styles.timelineHeader}>
                          <Text style={styles.auditAuthor}>{log.changedBy}</Text>
                          <Text style={styles.auditTime}>
                            {new Date(log.changedAt).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                        <Text style={styles.auditChange}>
                          {log.fieldChanged === 'creation'
                            ? '✨ Entry Created'
                            : log.fieldChanged === 'import'
                            ? '🔄 Multi-Store Import Update'
                            : `✏️ Changed ${log.fieldChanged}: ${log.oldValue} ➔ ${log.newValue}`}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)', // Slate 900 translucent
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
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
    fontSize: 18,
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
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorAlertText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  formScroll: {
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  rowFields: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  auditContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  auditTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyLogs: {
    color: '#475569',
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  timeline: {
    paddingLeft: 8,
    marginTop: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  timelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
    marginTop: 5,
    marginRight: 10,
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  auditAuthor: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
  },
  auditTime: {
    fontSize: 8,
    color: '#475569',
  },
  auditChange: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 14,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#334155', // Slate 700
  },
  cancelBtnText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#10B981', // Emerald 500
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
export default EditModal;
