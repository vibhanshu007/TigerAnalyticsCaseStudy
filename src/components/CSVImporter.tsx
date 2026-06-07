import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { pick, keepLocalCopy } from '@react-native-documents/picker';
import { parseCSVAsync } from '../utils/csvParser';
import storageService from '../database/StorageService';
import { ImportSummary } from '../types';

interface CSVImporterProps {
  visible: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface AttachedFile {
  name: string;
  uri: string;
  size: string;
}

export function CSVImporter({ visible, onClose, onImportComplete }: CSVImporterProps) {
  const [selectedFile, setSelectedFile] = useState<AttachedFile | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStats, setProgressStats] = useState({ success: 0, failed: 0 });
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAttachFile = async () => {
    setErrorMsg('');
    setSummary(null);
    try {
      const results = await pick({
        allowMultiSelection: false,
        mode: 'import',
      });

      if (results && results.length > 0) {
        const file = results[0];
        let finalUri = file.uri;

        // Copy content URI to a local sandbox file path to ensure reliable reading
        if (file.uri.startsWith('content://')) {
          try {
            const copies = await keepLocalCopy({
              destination: 'cachesDirectory',
              files: [
                {
                  uri: file.uri,
                  fileName: file.name || 'pricing_feed.csv',
                },
              ],
            });

            const copy = copies[0];
            if (copy && copy.status === 'success' && copy.localUri) {
              finalUri = copy.localUri;
            } else {
              const errDetails = copy && 'error' in copy ? (copy as any).error : 'Unknown copy error';
              console.warn('keepLocalCopy failed. Trying direct content URI fallback:', errDetails);
            }
          } catch (copyErr) {
            console.warn('keepLocalCopy threw error. Trying direct content URI fallback:', copyErr);
          }
        }

        setSelectedFile({
          name: file.name || 'pricing_feed.csv',
          uri: finalUri,
          size: file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Unknown size',
        });
      }
    } catch (err) {
      const msg = (err as Error).message || '';
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('user aborted')) {
        // User cancelled picker, do nothing
      } else {
        console.error(err);
        setErrorMsg(`File selection failed: ${(err as Error).message}`);
      }
    }
  };

  const handleProcessFeed = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setProgress(0);
    setProgressStats({ success: 0, failed: 0 });
    setSummary(null);
    setErrorMsg('');

    try {
      // Fetch local file content as text
      const response = await fetch(selectedFile.uri);
      const csvText = await response.text();

      if (!csvText.trim()) {
        throw new Error('Selected file is empty');
      }

      parseCSVAsync(
        csvText,
        (percent, success, failed) => {
          setProgress(percent);
          setProgressStats({ success, failed });
        },
        async (parsedRecords, errors, durationMs) => {
          try {
            const { importedCount, updatedCount } = await storageService.importRecords(
              parsedRecords,
              'Device CSV Import'
            );

            setSummary({
              totalProcessed: parsedRecords.length + errors.length,
              totalSuccess: parsedRecords.length,
              totalFailed: errors.length,
              errors,
              durationMs,
            });
            setImporting(false);
            setSelectedFile(null); // Reset selection after process
            onImportComplete();
          } catch (dbErr) {
            setErrorMsg(`DB save failure: ${(dbErr as Error).message}`);
            setImporting(false);
          }
        }
      );
    } catch (err) {
      console.error(err);
      setErrorMsg(`Failed to read file: ${(err as Error).message}`);
      setImporting(false);
    }
  };

  const clearDatabase = async () => {
    await storageService.clearAll();
    setSummary(null);
    onImportComplete();
    Alert.alert('Database Reset', 'Local pricing database cleared successfully.');
  };

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
              <Text style={styles.modalTitle}>Import CSV Pricing Feed</Text>
              <Text style={styles.modalSub}>Attach and upload store pricing sheets</Text>
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
            {/* Attachment Card */}
            {!selectedFile && !importing && (
              <TouchableOpacity style={styles.attachCard} onPress={handleAttachFile}>
                <Text style={styles.attachIcon}>📎</Text>
                <Text style={styles.attachTitle}>Attach CSV File</Text>
                <Text style={styles.attachSub}>Select file from your phone storage</Text>
              </TouchableOpacity>
            )}

            {selectedFile && !importing && (
              <View style={styles.fileSelectedCard}>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileIcon}>📄</Text>
                  <View style={styles.fileDetails}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {selectedFile.name}
                    </Text>
                    <Text style={styles.fileSize}>{selectedFile.size}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => setSelectedFile(null)}
                  >
                    <Text style={styles.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.submitBtn} onPress={handleProcessFeed}>
                  <Text style={styles.submitBtnText}>Start Feed Processing</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Processing State */}
            {importing && (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.progressText}>Processing Pricing Feed... {progress}%</Text>
                <View style={styles.progressRow}>
                  <Text style={styles.successBadge}>{progressStats.success} Validated</Text>
                  <Text style={styles.errorBadge}>{progressStats.failed} Skipped</Text>
                </View>
              </View>
            )}

            {/* Analysis Output Results */}
            {!importing && summary && (
              <View style={styles.resultContainer}>
                <Text style={styles.reportTitle}>Import Analysis Report</Text>
                
                <View style={styles.statRow}>
                  <View style={styles.statCell}>
                    <Text style={styles.statNum}>{summary.totalProcessed}</Text>
                    <Text style={styles.statLbl}>Processed</Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={[styles.statNum, { color: '#10B981' }]}>{summary.totalSuccess}</Text>
                    <Text style={styles.statLbl}>Success</Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={[styles.statNum, { color: '#EF4444' }]}>{summary.totalFailed}</Text>
                    <Text style={styles.statLbl}>Skipped</Text>
                  </View>
                  <View style={styles.statCell}>
                    <Text style={styles.statNum}>{summary.durationMs}ms</Text>
                    <Text style={styles.statLbl}>Duration</Text>
                  </View>
                </View>

                {summary.errors.length > 0 ? (
                  <View style={styles.errorSection}>
                    <Text style={styles.errorTitle}>Validation Fault Log ({summary.errors.length})</Text>
                    {summary.errors.map((err, idx) => (
                      <View key={idx} style={styles.errorCard}>
                        <View style={styles.errorHeader}>
                          <Text style={styles.errorLine}>Row Line: {err.line}</Text>
                          <Text style={styles.errorMsg}>{err.error}</Text>
                        </View>
                        {err.rowData && (
                          <Text style={styles.errorRowData} numberOfLines={1}>
                            Source: {err.rowData}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.successSection}>
                    <Text style={styles.successText}>✨ Feed parsed successfully! 0 validation errors.</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.modalFooter}>
            {!importing && (
              <TouchableOpacity style={styles.clearBtn} onPress={clearDatabase}>
                <Text style={styles.clearBtnText}>Reset Local Database</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Close Portal</Text>
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
    backgroundColor: '#1E293B', // Slate 800
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
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
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
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
  attachCard: {
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderStyle: 'dashed',
    backgroundColor: '#0F172A', // Slate 900
    borderRadius: 14,
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  attachIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  attachTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
  },
  attachSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  fileSelectedCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  fileIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  fileSize: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  removeBtnText: {
    fontSize: 11,
    color: '#EF4444',
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  center: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    marginBottom: 12,
  },
  progressText: {
    color: '#F8FAFC',
    marginTop: 12,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  successBadge: {
    fontSize: 11,
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
    fontWeight: '600',
  },
  errorBadge: {
    fontSize: 11,
    color: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontWeight: '600',
  },
  resultContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  statLbl: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  errorSection: {
    marginTop: 6,
  },
  errorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 6,
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.04)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  errorLine: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  errorMsg: {
    fontSize: 10,
    color: '#F8FAFC',
    flex: 1,
    marginLeft: 8,
  },
  errorRowData: {
    fontSize: 9,
    color: '#64748B',
    marginTop: 4,
    fontFamily: 'Courier',
  },
  successSection: {
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderRadius: 6,
  },
  successText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 12,
  },
  clearBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#334155', // Slate 700
  },
  clearBtnText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '700',
  },
  doneBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3B82F6', // Blue
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
export default CSVImporter;
