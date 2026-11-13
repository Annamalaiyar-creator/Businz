import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Check, Search, List } from 'lucide-react';
import html2canvas from 'html2canvas';
import { exportSmartMultiPagePdf } from '../../utils/smartPdfExporter';
import {
  fetchCloudStore, saveCloudStore, subscribeToCloudStore, getAndReserveNextBomCode, resolveBomCollisions, saveCloudBomRow, getWorkflowRank
} from '../../utils/supabaseDataSync';
import { getAllActivePresets } from '../../vrmHdgProposalPresets';
import { saveMediaToCache, stripDataUrlsFromRecord, compressAndSaveFile, cleanNum, formatCurrency, normalizePaymentTerm } from '../../utils/otherViewsShared';
import { uploadBomDocumentFile, validateClientFile } from '../../utils/bomStorageClient';
import { getFullProductsCatalogWithStock } from '../../utils/productCatalogService';
import { centralInventoryStore } from '../../utils/centralInventoryStore';
import { searchCustomers } from '../../services/customerService';
import { notifyBomCancelledByDispatch, notifyCreditPaymentSettled } from '../../services/notificationService';
import { getNextSequence, compareBomDescending, normalizeBomCode, getNumericSearchMatchRank } from '../../utils/sequenceGenerator';
import {
  formatAppliedAtDate, formatBomDateDot, getBomActiveStage, getBomStageTiming,
  getOrderLifecycle,
  canonicalizeSalespersonCode,
  CODE_TO_SALES_NAME,
  getCleanSalesPersonName,
  safeSaveBomStoreToLocal,
  sanitizeBomRecord
} from './bom/bomStageHelpers';
import {
  BomDocPreviewModal,
  BomValidationErrorModal,
  BomExportFormatModal,
  BomSubmittingOverlay
} from './bom/BomSharedHelperModals';
import BomCreateFormSection from './bom/BomCreateFormSection';
import BomConfirmAuditSection from './bom/BomConfirmAuditSection';
import BomDashboardSection from './bom/BomDashboardSection';

export { formatAppliedAtDate, formatBomDateDot, getBomActiveStage, getBomStageTiming };

export default function BomOrdersView(props) {
  const {
    activeTab = 'BOM Orders',
    userRole = 'Sales Executive',
    convertingPiData,
    onClearConvertingPiData
  } = props;

  // Search & Filter states
  const [searchQueryText, setSearchQueryText] = useState('');
  const [kpiFilterMeta, setKpiFilterMeta] = useState(() => {
    try {
      const saved = sessionStorage.getItem('controlroom_bom_initial_date_filter');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.targetKeys && Array.isArray(parsed.targetKeys)) {
          return {
            targetKeys: new Set(parsed.targetKeys),
            periodLabel: parsed.periodLabel || 'Overview',
            sourceLabel: parsed.sourceLabel || '',
            count: parsed.count ?? parsed.targetKeys.length
          };
        }
      }
    } catch (_) {}
    return null;
  });

  const [filterDateVal, setFilterDateVal] = useState(() => {
    try {
      const saved = sessionStorage.getItem('controlroom_bom_initial_date_filter');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.start || '';
      }
    } catch (_) {}
    return '';
  });
  const [filterEndDateVal, setFilterEndDateVal] = useState(() => {
    try {
      const saved = sessionStorage.getItem('controlroom_bom_initial_date_filter');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.end || '';
      }
    } catch (_) {}
    return '';
  });

  useEffect(() => {
    const handleFilterDate = (e) => {
      if (e?.detail) {
        if (e.detail.startDate !== undefined) setFilterDateVal(e.detail.startDate || '');
        if (e.detail.endDate !== undefined) setFilterEndDateVal(e.detail.endDate || '');
        if (e.detail.targetKeys && Array.isArray(e.detail.targetKeys)) {
          setKpiFilterMeta({
            targetKeys: new Set(e.detail.targetKeys),
            periodLabel: e.detail.periodLabel || 'Overview',
            sourceLabel: e.detail.sourceLabel || '',
            count: e.detail.count ?? e.detail.targetKeys.length
          });
          setActiveSubTab('All');
        }
        setCurrentPage(1);
      }
    };
    window.addEventListener('controlroom_bom_filter_date', handleFilterDate);
    return () => window.removeEventListener('controlroom_bom_filter_date', handleFilterDate);
  }, []);
  const [filterStatusSelect, setFilterStatusSelect] = useState('All');
  const [filterSalesPerson, setFilterSalesPerson] = useState('All Sales');
  const [activeSubTab, setActiveSubTab] = useState('All');
  const [selectedRows, setSelectedRows] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isConfirmingForward, setIsConfirmingForward] = useState(false);
  const [printingBomRecord, setPrintingBomRecord] = useState(null);
  const [exportFormatRecord, setExportFormatRecord] = useState(null);
  const [isExportingFormat, setIsExportingFormat] = useState(null); // 'pdf' | 'jpg' | 'csv' | null
  const [bomCancelPromptModal, setBomCancelPromptModal] = useState(null);
  const [cancellationReasonInput, setCancellationReasonInput] = useState('');
  const [uploadingPayment, setUploadingPayment] = useState(false);
  const [lrUploadModal, setLrUploadModal] = useState(null);
  const [ceoBomDetailModal, setCeoBomDetailModal] = useState(null);
  const [viewingPiModalFromBom, setViewingPiModalFromBom] = useState(null);


  // Cache-First Instant Hydration: load immediately from localStorage with 0ms delay
  const [bomStore, setBomStore] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_bom_store');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const { list: resolvedList } = resolveBomCollisions(parsed, 662);
          const sanitized = resolvedList.map(sanitizeBomRecord);
          if (resolvedList.length !== parsed.length || sanitized.some((b, i) => b.status !== resolvedList[i]?.status)) {
            localStorage.setItem('controlroom_bom_store', JSON.stringify(sanitized.map(stripDataUrlsFromRecord)));
          }
          return sanitized.map(stripDataUrlsFromRecord);
        }
      }
    } catch (_) {}
    return [];
  });

  const [tableLoading, setTableLoading] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_bom_store');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch (_) {}
    return true;
  });

  // Customer List from Supabase & Central Store
  const [customerList, setCustomerList] = useState([]);

  // Active Presets state (loaded from master JSON + localStorage/cloud)
  const [activePresetsMap, setActivePresetsMap] = useState(() => getAllActivePresets());

  // Full 285+ Standardized Products Catalog with Live Central Inventory Stock
  const [itemsList, setItemsList] = useState(() => getFullProductsCatalogWithStock());

  useEffect(() => {
    let timer = null;
    const refreshCatalog = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setItemsList(getFullProductsCatalogWithStock());
      }, 300);
    };
    window.addEventListener('central_inventory_updated', refreshCatalog);
    window.addEventListener('controlroom_items_update', refreshCatalog);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('central_inventory_updated', refreshCatalog);
      window.removeEventListener('controlroom_items_update', refreshCatalog);
    };
  }, []);

  // Individual mutations (create, confirm, delete) synchronize directly via atomic /api/boms and saveCloudStore on user action.
  // We avoid blanket auto-saving [bomStore] on every state tick to prevent stale browser lists from clobbering concurrent records in the cloud.

  // Initial cloud fetch, polling and cross-tab storage listener
  const debounceSyncTimerRef = useRef(null);

  useEffect(() => {
    const syncFromCloud = async (isInitial = false) => {
      // Only show table spinner if we don't already have records in memory
      if (isInitial && (!Array.isArray(bomStore) || bomStore.length === 0)) {
        setTableLoading(true);
      }
      try {
        let data = null;
        try {
          const apiRes = await fetch('/api/boms');
          if (apiRes.ok) {
            const json = await apiRes.json();
            if (json && Array.isArray(json.data)) {
              data = json.data;
            }
          }
        } catch (_) {}

        if (data === null) {
          data = await fetchCloudStore('bom_store', []);
        }

        if (data && Array.isArray(data)) {
          if (data.length === 0) {
            setBomStore([]);
          } else {
            const { list: resolvedList } = resolveBomCollisions(data, 662);
            const sorted = resolvedList.sort(compareBomDescending);
            const cleaned = sorted.map(stripDataUrlsFromRecord);
            setBomStore(prev => {
              let mergedCleaned = [...cleaned];
              if (Array.isArray(prev) && prev.length > 0) {
                const prevMap = new Map();
                prev.forEach(p => {
                  const c = p?.bomCode || p?.code || p?.id;
                  if (c) prevMap.set(c, p);
                });

                // Prevent stale cloud cache from regressing locally confirmed or advanced orders
                mergedCleaned = mergedCleaned.map(item => {
                  const c = item?.bomCode || item?.code || item?.id;
                  const prevItem = c ? prevMap.get(c) : null;
                  if (prevItem) {
                    const prevCust = String(prevItem.customerName || prevItem.companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const itemCust = String(item.customerName || item.companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (prevCust && itemCust && prevCust !== itemCust && !prevCust.includes(itemCust) && !itemCust.includes(prevCust)) {
                      return item;
                    }
                  }
                  if (prevItem && (prevItem.salesConfirmed || prevItem.salesReconfirmed || prevItem.status === 'Sales Confirmed - Sent to Dispatch')) {
                    const prevRank = getWorkflowRank(prevItem);
                    const itemRank = getWorkflowRank(item);
                    if (prevRank > itemRank) {
                      return { ...item, ...prevItem };
                    }
                  }
                  return item;
                });

                const cleanedCodes = new Set(cleaned.map(b => b?.bomCode || b?.code || b?.id).filter(Boolean));
                const recentLocalPending = prev.filter(b => {
                  const code = b?.bomCode || b?.code || b?.id;
                  if (!code || cleanedCodes.has(code)) return false;
                  const createdTime = new Date(b?.createdAt || b?.date || 0).getTime();
                  return (Date.now() - createdTime) < 60000;
                });
                if (recentLocalPending.length > 0) {
                  mergedCleaned = [...recentLocalPending, ...mergedCleaned];
                }
              }
              if (Array.isArray(prev) && prev.length === mergedCleaned.length) {
                try {
                  if (JSON.stringify(prev) === JSON.stringify(mergedCleaned)) return prev;
                } catch (_) {}
              }
              safeSaveBomStoreToLocal(mergedCleaned);
              return mergedCleaned;
            });
          }
        }

        // Immediately unblock table loading as soon as BOM records are available
        if (isInitial) setTableLoading(false);
      } catch (err) {
        console.error('Error in syncFromCloud:', err);
      } finally {
        if (isInitial) setTableLoading(false);
      }
    };

    // Initial fetch
    syncFromCloud(true);

    // Real-time live subscription directly from Supabase Database (receives single record payloads)
    const realtimeSub = subscribeToCloudStore('bom_store', (updatedBoms) => {
      if (Array.isArray(updatedBoms)) {
        const { list: resolvedList } = resolveBomCollisions(updatedBoms, 662);
        const cleaned = resolvedList.map(stripDataUrlsFromRecord);
        setBomStore(prev => {
          if (Array.isArray(prev) && prev.length === cleaned.length) {
            try {
              if (JSON.stringify(prev) === JSON.stringify(cleaned)) return prev;
            } catch (_) {}
          }
          safeSaveBomStoreToLocal(cleaned);
          return cleaned;
        });
        setTableLoading(false);
      } else if (updatedBoms && typeof updatedBoms === 'object') {
        if (updatedBoms._deleted && updatedBoms.id) {
          setBomStore(prev => {
            const remaining = (prev || []).filter(b => b && b.id !== updatedBoms.id && b.bomCode !== updatedBoms.id);
            safeSaveBomStoreToLocal(remaining);
            return remaining;
          });
        } else {
          const single = stripDataUrlsFromRecord(updatedBoms);
          setBomStore(prev => {
            const k = single.bomCode || single.code || single.id;
            const filtered = (prev || []).filter(b => b && (b.bomCode !== k && b.code !== k && b.id !== k));
            const list = [single, ...filtered];
            safeSaveBomStoreToLocal(list);
            return list;
          });
        }
        setTableLoading(false);
      }
    });

    // Gentle 90s safety fallback check only when active and tab is visible (replaces aggressive 12s polling)
    const fallbackInterval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden && !isSubmittingBomRef.current) {
        syncFromCloud(false);
      }
    }, 90000);

    const debouncedSync = () => {
      if (isSubmittingBomRef.current) return;
      if (debounceSyncTimerRef.current) clearTimeout(debounceSyncTimerRef.current);
      debounceSyncTimerRef.current = setTimeout(() => {
        syncFromCloud(false);
      }, 500);
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden && !isSubmittingBomRef.current) {
        debouncedSync();
      }
    };

    const handleStoreUpdate = (e) => {
      if (isSubmittingBomRef.current) return;
      // Only react if the event is specifically for bom_store
      if (!e?.detail?.storeKey || e.detail.storeKey === 'bom_store') {
        debouncedSync();
      }
    };

    const handleStorageUpdate = (e) => {
      if (isSubmittingBomRef.current) return;
      const payload = e?.detail;
      if (payload?.action === 'delete' && (payload?.recordId || payload?.id)) {
        const targetId = payload.recordId || payload.id;
        setBomStore(prev => (prev || []).filter(b => b && b.id !== targetId && b.bomCode !== targetId && b.code !== targetId));
        return;
      }
      if (payload?.bom && typeof payload.bom === 'object') {
        const single = stripDataUrlsFromRecord(payload.bom);
        setBomStore(prev => {
          const k = single.bomCode || single.code || single.id;
          if (!k) return prev;
          const filtered = (prev || []).filter(b => b && (b.bomCode !== k && b.code !== k && b.id !== k));
          const list = [single, ...filtered];
          safeSaveBomStoreToLocal(list);
          return list;
        });
        return;
      }
      debouncedSync();
    };

    const handleBomPrinted = (e) => {
      const { bomCode, dispatchPrinted, dispatchPrintedAt, dispatchPrintTimeStr, dispatchPrintedDateStr, dispatchPrintedBy, dispatchPrintCount, firstPrintTimeStr, secondPrintTimeStr, dispatchPrintHistory } = e.detail || {};
      if (!bomCode) return;
      setBomStore(prev => (prev || []).map(b => {
        if ((b.bomCode || b.code || b.id) === bomCode) {
          return {
            ...b,
            dispatchPrinted: true,
            dispatchPrintedAt,
            dispatchPrintTimeStr,
            dispatchPrintedDateStr,
            dispatchPrintedBy,
            dispatchPrintCount,
            firstPrintTimeStr,
            secondPrintTimeStr,
            dispatchPrintHistory
          };
        }
        return b;
      }));
    };

    window.addEventListener('controlroom_store_update', handleStoreUpdate);
    window.addEventListener('controlroom_bom_updated', handleStorageUpdate);
    window.addEventListener('controlroom_bom_store_updated', handleStorageUpdate);
    window.addEventListener('vrm_bom_printed', handleBomPrinted);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(fallbackInterval);
      if (debounceSyncTimerRef.current) clearTimeout(debounceSyncTimerRef.current);
      if (realtimeSub && realtimeSub.unsubscribe) realtimeSub.unsubscribe();
      window.removeEventListener('controlroom_store_update', handleStoreUpdate);
      window.removeEventListener('controlroom_bom_updated', handleStorageUpdate);
      window.removeEventListener('controlroom_bom_store_updated', handleStorageUpdate);
      window.removeEventListener('vrm_bom_printed', handleBomPrinted);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  // Executive Role Check (CEO / MD is View-Only for BOM Orders)
  const isCeo = userRole === 'CEO' || userRole === 'MD' || userRole === 'Managing Director' || (typeof window !== 'undefined' && localStorage.getItem('controlroom_user_role') === 'CEO');
  const [executiveDossierOrder, setExecutiveDossierOrder] = useState(null);

  // Form & Modals State
  const [showBOMForm, setShowBOMForm] = useState(false);
  const bomCustSearchTimerRef = useRef(null);

  // Lazy-load initial 60 customers only when Create BOM Form is opened (Phase B4: ~34 KB instead of 4.42 MB)
  useEffect(() => {
    if (!showBOMForm || customerList.length > 0) return;
    searchCustomers({ limit: 60 })
      .then(custs => {
        if (Array.isArray(custs) && custs.length > 0) setCustomerList(custs);
      })
      .catch(() => {});
  }, [showBOMForm, customerList.length]);
  const [confirmingBomModal, setConfirmingBomModal] = useState(null);
  const [uploadPaymentModal, setUploadPaymentModal] = useState(null);
  const [settleCreditModal, setSettleCreditModal] = useState(null);
  const [settleCreditUtr, setSettleCreditUtr] = useState('');
  const [settleCreditDate, setSettleCreditDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [settleCreditMode, setSettleCreditMode] = useState('NEFT / RTGS (Direct Bank Transfer)');
  const [settleCreditAmount, setSettleCreditAmount] = useState('');
  const [settleCreditFile, setSettleCreditFile] = useState(null);
  const [settleCreditNotes, setSettleCreditNotes] = useState('');
  const [isSettlingCredit, setIsSettlingCredit] = useState(false);
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentProofFiles, setPaymentProofFiles] = useState([]);
  const [existingPaymentDocsList, setExistingPaymentDocsList] = useState([]);
  const [paymentStageType, setPaymentStageType] = useState('100% Advance');
  const [quickPreviewRecord, setQuickPreviewRecord] = useState(null);
  const [previewDocModal, setPreviewDocModal] = useState(null); // { title: string, doc: object }
  const [customAlert, setCustomAlert] = useState(null);
  const [bomActionMenuIdx, setBomActionMenuIdx] = useState(null);

  // Synchronize existing payment proof documents when uploadPaymentModal opens
  useEffect(() => {
    if (uploadPaymentModal) {
      setPaymentProofFiles([]);
      setPaymentProofFile(null);
      setModalBalanceAmount('');
      const pType = String(uploadPaymentModal.paymentType || '').toLowerCase();
      const accPay = String(uploadPaymentModal.accountsVerification?.paymentType || '').toLowerCase();
      const creditDaysCount = Number(uploadPaymentModal.creditDays || uploadPaymentModal.accountsVerification?.creditDays || 0);
      const isCredit = pType.includes('credit') || pType.includes('net ') || pType.includes('net 30') || accPay.includes('credit') || creditDaysCount > 0 || Boolean(uploadPaymentModal.isCreditOrder);
      setPaymentModalTab(isCredit ? 'credit' : 'proof');

      // Initialize Settle Credit fields for this order
      setSettleCreditAmount(String(uploadPaymentModal.grandTotal || uploadPaymentModal.subTotal || uploadPaymentModal.totalAmount || ''));
      setSettleCreditDate(new Date().toISOString().split('T')[0]);
      setSettleCreditMode('NEFT / RTGS (Direct Bank Transfer)');
      setSettleCreditUtr(uploadPaymentModal.creditSettledUtr || uploadPaymentModal.utr || '');
      setSettleCreditFile(null);
      setSettleCreditNotes(uploadPaymentModal.creditSettledNotes || uploadPaymentModal.creditNotes || '');
      const cDays = Number(uploadPaymentModal.creditDays || 30) || 30;
      setModalCreditDays(cDays);
      setModalCreditTerm(uploadPaymentModal.paymentType || 'Net 30 Days');
      setModalCreditApprovedBy(uploadPaymentModal.creditApprovedBy || 'MD / Management');
      setModalCreditNotes(uploadPaymentModal.creditNotes || '');

      const rawDate = uploadPaymentModal.date || uploadPaymentModal.createdAt || new Date();
      const baseD = new Date(rawDate);
      if (!isNaN(baseD.getTime())) {
        baseD.setDate(baseD.getDate() + cDays);
        setModalCreditDueDate(baseD.toISOString().split('T')[0]);
      } else {
        const d = new Date();
        d.setDate(d.getDate() + cDays);
        setModalCreditDueDate(d.toISOString().split('T')[0]);
      }

      const docs = (() => {
        if (Array.isArray(uploadPaymentModal.paymentProofDocs) && uploadPaymentModal.paymentProofDocs.length > 0) {
          return [...uploadPaymentModal.paymentProofDocs];
        }
        if (Array.isArray(uploadPaymentModal.uploadedDocuments) && uploadPaymentModal.uploadedDocuments.length > 0) {
          const pDocs = uploadPaymentModal.uploadedDocuments.filter(d => 
            (d.category && d.category.includes('payment')) ||
            (d.type && d.type.includes('payment')) ||
            (d.name && d.name.toLowerCase().includes('payment'))
          );
          if (pDocs.length > 0) return [...pDocs];
        }
        const single = uploadPaymentModal.paymentProofDoc ||
                       uploadPaymentModal.payments?.proofDocObj ||
                       uploadPaymentModal.payments?.proofDoc ||
                       uploadPaymentModal.balanceProofDoc;
        if (single) {
          return [typeof single === 'object' ? single : { name: single }];
        }
        return [];
      })();
      setExistingPaymentDocsList(docs);
    } else {
      setPaymentProofFiles([]);
      setExistingPaymentDocsList([]);
      setPaymentProofFile(null);
      setModalBalanceAmount('');
      setPaymentModalTab('proof');
    }
  }, [uploadPaymentModal]);

  // Synchronize settleCreditModal default values when opened
  useEffect(() => {
    if (settleCreditModal) {
      setSettleCreditUtr('');
      setSettleCreditDate(new Date().toISOString().split('T')[0]);
      setSettleCreditMode('NEFT / RTGS (Direct Bank Transfer)');
      const defAmt = Number(settleCreditModal.grandTotal || settleCreditModal.subTotal || settleCreditModal.totalAmount || 0);
      setSettleCreditAmount(defAmt > 0 ? String(defAmt) : '');
      setSettleCreditFile(null);
      setSettleCreditNotes('');
      setIsSettlingCredit(false);
    }
  }, [settleCreditModal]);

  // Create BOM Form Specific State
  const [newBomCode, setNewBomCode] = useState('');
  const [newBomDeliveryDate, setNewBomDeliveryDate] = useState('');
  const [newBomProductName, setNewBomProductName] = useState('');
  const [newBomCompanyName, setNewBomCompanyName] = useState('');
  const [newBomContactPerson, setNewBomContactPerson] = useState('');
  const [newBomPhone, setNewBomPhone] = useState('');
  const [newBomEmail, setNewBomEmail] = useState('');
  const [newBomGstNo, setNewBomGstNo] = useState('');
  const [newBomDocType, setNewBomDocType] = useState('Invoice');
  const [newBomDeliveryAddress, setNewBomDeliveryAddress] = useState('');
  const [newBomBillingStreet, setNewBomBillingStreet] = useState('');
  const [newBomBillingCity, setNewBomBillingCity] = useState('');
  const [newBomBillingState, setNewBomBillingState] = useState('');
  const [newBomBillingPincode, setNewBomBillingPincode] = useState('');
  const [newBomDeliveryStreet, setNewBomDeliveryStreet] = useState('');
  const [newBomDeliveryCity, setNewBomDeliveryCity] = useState('');
  const [newBomDeliveryState, setNewBomDeliveryState] = useState('');
  const [newBomDeliveryPincode, setNewBomDeliveryPincode] = useState('');
  const [newBomPaymentType, setNewBomPaymentType] = useState('100% Paid');
  const [newBomPartialAmount, setNewBomPartialAmount] = useState('');
  const [modalBalanceAmount, setModalBalanceAmount] = useState('');
  const [paymentModalTab, setPaymentModalTab] = useState('proof'); // 'proof' | 'credit'
  const [modalCreditDays, setModalCreditDays] = useState(30);
  const [modalCreditDueDate, setModalCreditDueDate] = useState('');
  const [modalCreditTerm, setModalCreditTerm] = useState('Net 30 Days');
  const [modalCreditApprovedBy, setModalCreditApprovedBy] = useState('MD / Management');
  const [modalCreditNotes, setModalCreditNotes] = useState('');
  const [isSavingCredit, setIsSavingCredit] = useState(false);
  const [newBomCreditDays, setNewBomCreditDays] = useState(7);
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [newBomDeliveryProofDoc, setNewBomDeliveryProofDoc] = useState(null);
  const [newBomPaymentProofDoc, setNewBomPaymentProofDoc] = useState(null);
  const [newBomRemarks, setNewBomRemarks] = useState('');
  const [newBomTransportMode, setNewBomTransportMode] = useState('Transport');
  const [newBomTransporterName, setNewBomTransporterName] = useState('');
  const [newBomDestination, setNewBomDestination] = useState('');
  const [newBomVehicleNo, setNewBomVehicleNo] = useState('');
  const [newBomTransportScope, setNewBomTransportScope] = useState('VRM Structures');
  const [newBomLrNo, setNewBomLrNo] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [validationErrorModal, setValidationErrorModal] = useState(null);

  // Normalize multi-image proofs for Delivery Address and Payment (Target: at least 4 images)
  const deliveryDocs = useMemo(() => {
    if (!newBomDeliveryProofDoc) return [];
    return Array.isArray(newBomDeliveryProofDoc) ? newBomDeliveryProofDoc : [newBomDeliveryProofDoc];
  }, [newBomDeliveryProofDoc]);

  const paymentDocs = useMemo(() => {
    if (!newBomPaymentProofDoc) return [];
    return Array.isArray(newBomPaymentProofDoc) ? newBomPaymentProofDoc : [newBomPaymentProofDoc];
  }, [newBomPaymentProofDoc]);

  const handleUploadDeliveryProofFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    files.forEach((file) => {
      try {
        validateClientFile(file);
        compressAndSaveFile(file, (res) => {
          if (res) {
            if (res.name && res.dataUrl) saveMediaToCache(res.name, res.dataUrl);
            const docObj = {
              ...res,
              _rawFile: file,
              dataUrl: res.dataUrl || null,
              previewUrl: res.dataUrl || (typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : null)
            };
            setNewBomDeliveryProofDoc(prev => {
              const current = Array.isArray(prev) ? prev : (prev ? [prev] : []);
              if (current.some(d => d.name === docObj.name && d.size === docObj.size)) return current;
              return [...current, docObj];
            });
          }
        });
      } catch (err) {
        alert(`⚠️ Cannot Proceed with ${file.name}: ${err.message}`);
      }
    });
  };

  const handleRemoveDeliveryDoc = (index) => {
    setNewBomDeliveryProofDoc(prev => {
      const current = Array.isArray(prev) ? prev : (prev ? [prev] : []);
      const updated = current.filter((_, i) => i !== index);
      return updated.length > 0 ? updated : null;
    });
  };

  const handleUploadPaymentProofFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    files.forEach((file) => {
      try {
        validateClientFile(file);
        compressAndSaveFile(file, (res) => {
          if (res) {
            if (res.name && res.dataUrl) saveMediaToCache(res.name, res.dataUrl);
            const docObj = {
              ...res,
              _rawFile: file,
              dataUrl: res.dataUrl || null,
              previewUrl: res.dataUrl || (typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : null)
            };
            setNewBomPaymentProofDoc(prev => {
              const current = Array.isArray(prev) ? prev : (prev ? [prev] : []);
              if (current.some(d => d.name === docObj.name && d.size === docObj.size)) return current;
              return [...current, docObj];
            });
            setFormErrors(prev => ({ ...prev, paymentProof: null }));
          }
        });
      } catch (err) {
        alert(`⚠️ Cannot Proceed with ${file.name}: ${err.message}`);
      }
    });
  };

  const handleRemovePaymentDoc = (index) => {
    setNewBomPaymentProofDoc(prev => {
      const current = Array.isArray(prev) ? prev : (prev ? [prev] : []);
      const updated = current.filter((_, i) => i !== index);
      return updated.length > 0 ? updated : null;
    });
  };

  // Create BOM Loading & Mutex Anti-Duplicate State
  const [isSubmittingBom, setIsSubmittingBom] = useState(false);
  const [bomSubmitStage, setBomSubmitStage] = useState(''); // 'validating' | 'assigning' | 'reserving' | 'saving' | 'completed'
  const [bomSubmitAssignedCode, setBomSubmitAssignedCode] = useState('');
  const isSubmittingBomRef = useRef(false);
  const lastConvertedPiRef = useRef(null);
  const [newBomSourcePiNo, setNewBomSourcePiNo] = useState('');
  const [newBomSalesPersonCode, setNewBomSalesPersonCode] = useState('');
  const [newBomCreatedBy, setNewBomCreatedBy] = useState('');
  const [newBomCreatedById, setNewBomCreatedById] = useState('');

  // Comprehensive BOM Form Validation Helper
  const validateBomForm = (isDraft = false) => {
    const errors = {};
    const missingList = [];

    // 1. Customer Name
    if (!newBomProductName || !newBomProductName.trim()) {
      errors.customerName = 'Customer Name is required';
      missingList.push({
        field: 'Customer Name',
        message: 'Please select or enter the customer name from the list.',
        targetId: 'field-newBomProductName'
      });
    }

    // 2. Billing Address
    if (!newBomBillingStreet || !newBomBillingStreet.trim()) {
      errors.billingStreet = 'Billing Street Address is required';
      missingList.push({
        field: 'Billing Street Address',
        message: 'Please enter the billing street address.',
        targetId: 'field-newBomBillingStreet'
      });
    }
    if (!newBomBillingCity || !newBomBillingCity.trim()) {
      errors.billingCity = 'Billing City is required';
      missingList.push({
        field: 'Billing City',
        message: 'Please enter the billing city.',
        targetId: 'field-newBomBillingCity'
      });
    }

    // 2. Delivery Date (mandatory - sales person must enter it)
    if (!isDraft && (!newBomDeliveryDate || !newBomDeliveryDate.trim())) {
      errors.deliveryDate = 'Delivery Date is required';
      missingList.push({
        field: 'Delivery Date',
        message: 'Please select an expected delivery date.',
        targetId: 'field-newBomDeliveryDate'
      });
    }

    // 3. Materials / Items List
    if (!bomMaterialsList || bomMaterialsList.length === 0) {
      errors.items = 'At least 1 product item or preset kit is required';
      missingList.push({
        field: 'Order Items / Materials',
        message: 'Please add at least one material/product item or select a preset kit.',
        targetId: 'field-bomMaterialsList'
      });
    } else {
      const invalidItems = [];
      bomMaterialsList.forEach((it, idx) => {
        const qty = parseFloat(it.qty) || 0;
        const r = parseFloat(it.rate) || 0;
        const isPresetItem = Boolean(it.isPresetItem);
        if (!it.name || !it.name.trim()) {
          invalidItems.push(`Item #${idx + 1}: Item name is missing`);
        } else if (qty <= 0) {
          invalidItems.push(`Item #${idx + 1} (${it.name}): Quantity must be greater than 0`);
        } else if (!isPresetItem && r <= 0) {
          invalidItems.push(`Item #${idx + 1} (${it.name}): Price (₹) is required and must be greater than 0`);
        }
      });
      const presetItems = bomMaterialsList.filter(it => it.isPresetItem);
      if (presetItems.length > 0) {
        if (!presetGroups || Object.keys(presetGroups).length === 0) {
          invalidItems.push('Preset Amt (₹) is mandatory: Please enter a valid Preset Amount for the configured preset kit.');
        } else {
          Object.values(presetGroups).forEach(g => {
            const kp = parseFloat(g.kitPrice) || 0;
            if (kp <= 0) {
              invalidItems.push(`Preset Amt (₹) is mandatory for "${g.presetName || 'Preset Kit'}": Must be greater than 0`);
            }
          });
        }
      }
      if (invalidItems.length > 0) {
        errors.items = invalidItems.join(', ');
        missingList.push({
          field: 'Item Details Missing',
          message: invalidItems.join(' • '),
          targetId: 'field-bomMaterialsList'
        });
      }
    }

    // 4. Delivery Address
    if (!sameAsBilling) {
      const street = (newBomDeliveryStreet || '').trim();
      const city = (newBomDeliveryCity || '').trim();
      if (!street || !city) {
        errors.deliveryAddress = 'Delivery Address and City are required';
        missingList.push({
          field: 'Delivery Address',
          message: 'Delivery street address and city are required when not matching billing (or check "Same as Billing").',
          targetId: 'field-newBomDeliveryStreet'
        });
      }
    }

    // 4b. Mandatory Destination
    if (!isDraft && (!newBomDestination || !newBomDestination.trim())) {
      errors.destination = 'Destination is required';
      missingList.push({
        field: 'Destination *',
        message: 'Destination is mandatory. Please enter delivery destination.',
        targetId: 'bom-orders-destination'
      });
    }

    // 5. Payment Proof for 100% Paid / Partial Paid Orders (Mandatory per policy, unless DC)
    const isDc = Boolean(
      newBomDocType === 'DC' ||
      newBomDocType === 'Delivery Challan' ||
      String(newBomDocType || '').toUpperCase().includes('DC') ||
      String(newBomDocType || '').toUpperCase().includes('CHALLAN')
    );
    const isPaidOrder = newBomPaymentType === '100% Paid' || newBomPaymentType === '100% Advance';
    const isPartialOrder = newBomPaymentType === 'Partial Paid' || newBomPaymentType === 'Partial Payment';
    const currentPaymentDocs = Array.isArray(newBomPaymentProofDoc)
      ? newBomPaymentProofDoc
      : (newBomPaymentProofDoc ? [newBomPaymentProofDoc] : []);
    if (!isDraft && !isDc && (isPaidOrder || isPartialOrder)) {
      if (currentPaymentDocs.length === 0) {
        errors.paymentProof = 'Payment Attachment / Slip is mandatory';
        missingList.push({
          field: 'Payment Attachment / Slip *',
          message: `Payment Attachment / Slip * is strictly mandatory for "${newBomPaymentType}" orders. Please attach the bank slip/advice to proceed.`,
          targetId: 'field-newBomPaymentProofDoc'
        });
      }
    }

    if (!isDraft && isPartialOrder) {
      const pAmt = parseFloat(newBomPartialAmount);
      if (!pAmt || pAmt <= 0) {
        errors.partialAmount = 'Partial Advance Amount is required';
        missingList.push({
          field: 'Partial Advance Amount',
          message: 'Please enter the advance amount paid for this Partial Paid order.',
          targetId: 'field-newBomPartialAmount'
        });
      }
    }

    setFormErrors(errors);
    return { isValid: missingList.length === 0, missingList, errors };
  };
  const getEffectiveSalesPerson = () => {
    const storedName = localStorage.getItem('controlroom_logged_user_name');
    if (storedName && storedName.trim() && storedName !== 'undefined' && storedName !== 'null' && storedName.toLowerCase() !== 'vijay') {
      return storedName.trim();
    }
    try {
      const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
      const allEmps = [...(Array.isArray(storedEmps) ? storedEmps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];
      const match = allEmps.find(e => e && e.role === userRole && e.employee_name && e.employee_name.toLowerCase() !== 'vijay');
      if (match && (match.employee_name || match.name)) {
        return match.employee_name || match.name;
      }
    } catch (_) {}
    if (storedName && storedName.trim() && storedName !== 'undefined' && storedName !== 'null') {
      return storedName.trim();
    }
    const storedUser = localStorage.getItem('controlroom_logged_user');
    if (storedUser && storedUser.trim() && storedUser !== 'undefined' && storedUser !== 'null') {
      return storedUser.trim();
    }
    const storedEmp = localStorage.getItem('controlroom_logged_emp_id');
    if (storedEmp && storedEmp.trim() && storedEmp !== 'undefined' && storedEmp !== 'null') {
      return storedEmp.trim();
    }
    if (userRole === 'Sales Head') return 'Sales Head';
    if (userRole === 'Accounts Head') return 'Venkatesh';
    if (userRole === 'Accounts Executive') return 'Priya';
    if (userRole === 'Technical Administrator' || userRole === 'CEO') return 'Annamalaiyar';
    if (userRole === 'Procurement Head') return 'ARUN BOOPATHI M';
    if (userRole === 'Production Head') return 'Senthil Kumar';
    if (userRole === 'Sales Executive') return 'Mohith JV';
    return userRole || 'Sales Executive';
  };
  const defaultSalesPersonName = getEffectiveSalesPerson();
  const [newBomSalesPerson, setNewBomSalesPerson] = useState(defaultSalesPersonName);

  const currentEmpId = (localStorage.getItem('controlroom_logged_emp_id') || localStorage.getItem('controlroom_logged_user_id') || '').trim();
  const currentEmpName = (localStorage.getItem('controlroom_logged_user_name') || '').trim();
  const currentLoggedEmail = (localStorage.getItem('controlroom_logged_user') || '').trim().toLowerCase();
  const currentUserName = props.currentUserName || props.userName || props.currentUser?.name || currentEmpName || defaultSalesPersonName || userRole;

  const curCode = (currentEmpId || '').trim().toUpperCase();
  const effectiveCurName = (currentEmpName || (defaultSalesPersonName && !['Sales Executive', 'Sales'].includes(defaultSalesPersonName) ? defaultSalesPersonName : '') || '').trim();
  const curName = effectiveCurName.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
  const curEmail = (currentLoggedEmail || '').trim().toLowerCase();

  // Generic Sales Department (SE-1000 / sales / Sales Head) has full visibility across sales department BOMs
  const isGenericSales = curCode === 'SE-1000' || curName === 'sales' || curName === 'sales department' || (userRole && userRole.toLowerCase().includes('sales head')) || (!curCode && !curName && !curEmail);

  // Role check: Only individual Sales personnel are isolated to their own BOMs.
  // Management & Fulfillment roles (Dispatch Head, Dispatch, Production Head, Floor Supervisor, Sales Head, CEO, Managing Director, Technical Administrator, Accounts Head, Accounts Executive, Procurement Head, Billing) see all BOMs.
  const isRestrictedSalesUser = Boolean(
    !isCeo &&
    !isGenericSales &&
    userRole &&
    ['Sales', 'Sales Executive', 'Salesperson', 'Sales Rep', 'Sales Representative'].some(r => r.toLowerCase() === userRole.toLowerCase().trim()) &&
    userRole.toLowerCase() !== 'sales head' &&
    !['CEO', 'MD', 'Managing Director', 'Technical Administrator', 'Dispatch Head', 'Dispatch', 'Dispatch Team', 'Production Head', 'Production', 'Accounts Head', 'Accounts Executive', 'Accounts', 'Billing', 'Floor Supervisor', 'Procurement Head', 'Procurement'].some(r => r.toLowerCase() === userRole.toLowerCase().trim())
  );

  const visibleBomStore = React.useMemo(() => {
    const rawList = (bomStore || []).filter(b => {
      if (!b) return false;
      const code = String(b.bomCode || b.code || b.id || '').trim();
      if (/^BOM-(STAGING|USER|POST|DEV-TEST)/i.test(code)) return false;
      return true;
    }).map(b => {
      if (b && b.status === 'Draft') {
        return { ...b, status: 'Pending Sales Confirmation' };
      }
      return b;
    });
    if (!isRestrictedSalesUser) return [...rawList].sort(compareBomDescending);

    const curCode = (currentEmpId || '').trim().toUpperCase();
    const effectiveCurName = (currentEmpName || (defaultSalesPersonName && !['Sales Executive', 'Sales'].includes(defaultSalesPersonName) ? defaultSalesPersonName : '') || '').trim();
    const curName = effectiveCurName.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    const curEmail = (currentLoggedEmail || '').trim().toLowerCase();

    // Collect all employee aliases (e.g. SE-004, SE-VRM004, EMP-SE-004, Amit Verma)
    const userAliases = new Set([curCode, curName, curEmail].filter(Boolean));
    try {
      const emps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const matchedEmp = emps.find(e => {
        if (!e) return false;
        const eCode = String(e.employee_code || e.code || '').trim().toUpperCase();
        const eId = String(e.id || '').trim().toUpperCase();
        const eEmail = String(e.email || '').trim().toLowerCase();
        const eName = String(e.employee_name || e.name || '').trim().toLowerCase();
        return (curCode && (eCode === curCode || eId === curCode)) ||
               (curEmail && eEmail === curEmail) ||
               (curName && eName === curName);
      });
      if (matchedEmp) {
        if (matchedEmp.employee_code) userAliases.add(String(matchedEmp.employee_code).trim().toUpperCase());
        if (matchedEmp.code) userAliases.add(String(matchedEmp.code).trim().toUpperCase());
        if (matchedEmp.id) userAliases.add(String(matchedEmp.id).trim().toUpperCase());
        if (matchedEmp.employee_name) userAliases.add(String(matchedEmp.employee_name).replace(/\s*\([^)]*\)/g, '').trim().toLowerCase());
        if (matchedEmp.name) userAliases.add(String(matchedEmp.name).replace(/\s*\([^)]*\)/g, '').trim().toLowerCase());
        if (matchedEmp.email) userAliases.add(String(matchedEmp.email).trim().toLowerCase());
        if (Array.isArray(matchedEmp.aliases)) {
          matchedEmp.aliases.forEach(a => userAliases.add(String(a).trim().toLowerCase()));
        }
      }
    } catch (_) {}

    const normA = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanCurNorm = normA(curName);

    // Canonical Sales Team Definitions with Name matchers
    const SALES_TEAM = [
      { code: 'SE-001', name: 'Manojraj Selvaraj', matchNames: ['manoj', 'manojraj', 'manoj raj'], emails: ['sales.s1@'], oldCodes: ['SH-001'] },
      { code: 'SE-002', name: 'Sanjai kumar', matchNames: ['sanjai', 'sanjay', 'sanjai kumar'], emails: ['sanjaikumar', 'sales@gmail.com'], oldCodes: [] },
      { code: 'SE-003', name: 'Vasanth Kumar S', matchNames: ['vasanth kumar s', 'vasanth kumar', 'vasanthkumar'], excludeNames: ['support', 'tech'], emails: ['vasanthkumar'], oldCodes: ['SE-VRM006'] },
      { code: 'SE-004', name: 'Mohith JV', matchNames: ['mohith', 'mohit'], emails: ['sales.s4@'], oldCodes: ['SE-015'] },
      { code: 'SE-005', name: 'Shanthi', matchNames: ['shanthi', 'santhi'], emails: ['sales.s3@'], oldCodes: [] },
      { code: 'SE-006', name: 'Dhana Sekar', matchNames: ['dhana', 'dhanasekar', 'dhana sekar'], emails: ['dhanasekar'], oldCodes: ['SE-020'] },
      { code: 'SE-007', name: 'PRASHANTH', matchNames: ['prashanth', 'prasanth'], emails: ['sales.s2@'], oldCodes: [] },
      { code: 'SE-008', name: 'Pavithra', matchNames: ['pavithra', 'pavitra'], emails: ['projectsales'], oldCodes: ['SE-010'] },
      { code: 'SE-009', name: 'KALAISELVI T', matchNames: ['kalaiselvi', 'kalai'], emails: ['mms@'], oldCodes: ['SE-VRM090'] }
    ];

    // Detect which sales rep is currently logged in (Name-First, then Code)
    const activeRep = SALES_TEAM.find(rep => 
      (curName && rep.matchNames.some(m => curName.includes(m) && (!rep.excludeNames || !rep.excludeNames.some(ex => curName.includes(ex))))) ||
      (curCode && rep.code === curCode) ||
      (curEmail && rep.emails.some(e => curEmail.includes(e)))
    );

    return rawList.filter(b => {
      if (!b) return false;

      // Always include BOM if targeted directly from PI or props
      if (props.targetBomCode) {
        const tCode = String(props.targetBomCode).trim().toLowerCase();
        const bCode = String(b.bomCode || b.code || b.id || '').trim().toLowerCase();
        if (bCode === tCode) return true;
      }
      if (props.targetPiNo) {
        const tPi = String(props.targetPiNo).trim().toLowerCase();
        const sPi = String(b.sourcePiNo || b.piNo || '').trim().toLowerCase();
        if (sPi === tPi) return true;
      }

      // Extract all identifying names and text from the BOM
      const bomNameText = [
        b.salesPerson, b.createdBy, b.convertedBy,
        b.sales_person, b.created_by, b.converted_by, b.c8
      ].filter(Boolean).join(' ').toLowerCase();

      const bomEmail = String(b.salesPersonEmail || b.email || b.creatorEmail || '').toLowerCase().trim();
      const bomCode = String(b.salesPersonCode || b.createdById || b.convertedById || b.sales_person_code || b.created_by_id || '').toUpperCase().trim();

      // Rule 0: If BOM was created, converted, or assigned to this user, ALWAYS show it!
      if (curCode && (bomCode === curCode || b.salesPersonCode === curCode || b.createdById === curCode || b.convertedById === curCode)) {
        return true;
      }
      if (userAliases.has(bomCode) || userAliases.has(b.salesPersonCode) || userAliases.has(b.createdById) || userAliases.has(b.convertedById)) {
        return true;
      }
      if (curName && (bomNameText.includes(curName) || b.salesPerson?.toLowerCase() === curName || b.createdBy?.toLowerCase() === curName || b.convertedBy?.toLowerCase() === curName)) {
        return true;
      }

      if (activeRep) {
        // 1. Primary Rule: NAME MATCHING
        const matchesActiveRepName = activeRep.matchNames.some(m => 
          bomNameText.includes(m) && (!activeRep.excludeNames || !activeRep.excludeNames.some(ex => bomNameText.includes(ex)))
        );
        if (matchesActiveRepName) {
          return true;
        }

        // If BOM explicitly belongs to ANOTHER sales rep by Name, exclude it immediately!
        const matchesOtherRepName = SALES_TEAM.some(other => 
          other.code !== activeRep.code && 
          other.matchNames.some(m => bomNameText.includes(m) && (!other.excludeNames || !other.excludeNames.some(ex => bomNameText.includes(ex))))
        );
        if (matchesOtherRepName) {
          return false;
        }

        // 2. Email matching
        if (bomEmail && activeRep.emails.some(e => bomEmail.includes(e))) {
          return true;
        }

        // 3. Old code matching (e.g. SH-001 for Manojraj)
        if (activeRep.oldCodes && activeRep.oldCodes.includes(bomCode)) {
          return true;
        }

        // 4. Code match
        if (bomCode === activeRep.code) {
          return true;
        }

        return false;
      }

      // Fallback for non-mapped sales users (like PerformaInvoiceView)
      if (curName && bomNameText.includes(curName)) return true;
      if (curCode && (bomCode === curCode || b.salesPersonCode === curCode)) return true;
      if (curEmail && bomEmail === curEmail) return true;

      // 4. Source PI ownership check
      const sPiNo = b.sourcePiNo || b.piNo;
      if (sPiNo) {
        try {
          const rawPis = localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('controlroom_pi_store');
          const piStore = rawPis ? JSON.parse(rawPis) : [];
          const targetPi = (piStore || []).find(p => {
            const pNo = String(p.piNo || p.id || '').trim().toLowerCase();
            return pNo === String(sPiNo).trim().toLowerCase();
          });
          if (targetPi) {
            const piOwner = (targetPi.salesPersonCode || targetPi.createdById || targetPi.salesPerson || targetPi.salesperson || '').toLowerCase().trim();
            if (piOwner) return (curCode && curCode.toLowerCase() === piOwner) || (curName && piOwner.includes(curName.toLowerCase()));
          }
        } catch (_) {}
      }

      return false;
    }).sort(compareBomDescending);
  }, [bomStore, isRestrictedSalesUser, currentEmpId, currentEmpName, defaultSalesPersonName, currentLoggedEmail, props.targetBomCode, props.targetPiNo]);

  // Operational Financial & KPI Ribbon (Visible for CEO, MD, and Sales Logins)
  const ceoMetrics = useMemo(() => {
    const isAllowedRole = isCeo || isRestrictedSalesUser || Boolean(userRole && String(userRole).toLowerCase().includes('sales'));
    if (!isAllowedRole || !Array.isArray(bomStore)) return null;

    const sourceList = isRestrictedSalesUser ? visibleBomStore : bomStore;
    const validBoms = (sourceList || []).filter(b => b && !b.cancelled && b.status !== 'Cancelled' && b.status !== 'CANCELLED');
    const totalOrderBookVal = validBoms.reduce((acc, b) => acc + cleanNum(b.totalAmount || b.grandTotal || b.amount || 0), 0);

    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const utcToday = now.toISOString().split('T')[0];
    const isToday = (dStr) => {
      if (!dStr) return false;
      const s = String(dStr);
      return s.startsWith(localToday) || s.startsWith(utcToday);
    };

    const isDispatched = (b) => {
      const s = String(b.status || '').toLowerCase();
      return Boolean(b.dispatchedAt) || s.includes('dispatched') || s === 'completed';
    };

    const formatCurrencyShort = (num) => {
      if (!num || isNaN(num)) return '₹ 0.00 L';
      if (num >= 10000000) return `₹ ${(num / 10000000).toFixed(2)} Cr`;
      return `₹ ${(num / 100000).toFixed(2)} L`;
    };

    // 1. Total Order Book
    const totalOrderBookFormatted = formatCurrencyShort(totalOrderBookVal);

    // 2. Today ALL BOM
    const todayAllBoms = validBoms.filter(b => isToday(b.date) || isToday(b.createdAt));
    const todayAllVal = todayAllBoms.reduce((acc, b) => acc + cleanNum(b.totalAmount || b.grandTotal || b.amount || 0), 0);

    // 3. Dispatched BOM today
    const todayDispatchedBoms = validBoms.filter(b => {
      if (!isDispatched(b)) return false;
      return isToday(b.dispatchedAt) || isToday(b.updatedAt) || isToday(b.date) || isToday(b.createdAt);
    });
    const todayDispatchedVal = todayDispatchedBoms.reduce((acc, b) => acc + cleanNum(b.totalAmount || b.grandTotal || b.amount || 0), 0);

    // 4. Pending BOMs
    const pendingBoms = validBoms.filter(b => !isDispatched(b));
    const pendingVal = pendingBoms.reduce((acc, b) => acc + cleanNum(b.totalAmount || b.grandTotal || b.amount || 0), 0);

    return {
      totalOrderBookVal,
      totalOrderBookFormatted,
      validBomsCount: validBoms.length,

      todayAllCount: todayAllBoms.length,
      todayAllValFormatted: formatCurrencyShort(todayAllVal),

      todayDispatchedCount: todayDispatchedBoms.length,
      todayDispatchedValFormatted: formatCurrencyShort(todayDispatchedVal),

      pendingCount: pendingBoms.length,
      pendingValFormatted: formatCurrencyShort(pendingVal)
    };
  }, [isCeo, isRestrictedSalesUser, userRole, bomStore, visibleBomStore]);

  const [selectedPreset, setSelectedPreset] = useState('');
  const [presetSetCount, setPresetSetCount] = useState(1);
  const [presetUnit, setPresetUnit] = useState('Sets');
  const [presetKitPrice, setPresetKitPrice] = useState('');
  const [presetGroups, setPresetGroups] = useState({}); // { [groupId]: { groupId, presetId, presetName, setCount, kitPrice } }
  const [selectedBomItemIndexes, setSelectedBomItemIndexes] = useState([]);
  const [bomItemsLayoutMode, setBomItemsLayoutMode] = useState('modern_table'); // 'modern_table' | 'cards_grid' | 'split_workspace'
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [bomConfirmModal, setBomConfirmModal] = useState(null); // 'cancel' | 'draft' | 'create'
  const [bomMaterialsList, setBomMaterialsList] = useState([]);

  // Listen to preset updates from Tech Support preset manager
  useEffect(() => {
    const handlePresetUpdate = (e) => {
      if (e.detail) {
        setActivePresetsMap(e.detail);
      }
    };
    window.addEventListener('vrm_presets_updated', handlePresetUpdate);
    return () => window.removeEventListener('vrm_presets_updated', handlePresetUpdate);
  }, []);

  // CSV Export for BOM Order Specifications & Line Items
  const handleExportBomCsv = (record) => {
    if (!record) return;
    const bomCode = record.bomCode || record.code || 'BOM_Order';
    const customer = record.customerName || record.companyName || 'Customer';
    const date = record.createdAt || record.date || new Date().toISOString().split('T')[0];
    const status = record.status || 'Active';
    const salesPerson = (record.salesPerson || record.createdBy || defaultSalesPersonName).replace(/\s*\([^)]*\)/g, '').trim();
    const paymentType = record.paymentType || '100% Paid';

    const bObj = record.billingAddressObj || {};
    const dObj = record.deliveryAddressObj || {};
    const bStr = record.billingAddress || (bObj.address ? `${bObj.address}, ${bObj.city || ''} ${bObj.state || ''} - ${bObj.pincode || ''}` : '');
    const dStr = record.deliveryAddress || (dObj.address ? `${dObj.address}, ${dObj.city || ''} ${dObj.state || ''} - ${dObj.pincode || ''}` : bStr);

    const transportMode = record.transportMode || 'Transport';
    const transportScope = record.transportScope || 'VRM Structures';
    const transporterName = record.transporterName || '—';
    const vehicleNo = record.vehicleNo || '—';
    const lrNo = record.lrNo || '—';

    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = [];
    rows.push(['VRM STRUCTURES - BILL OF MATERIALS (BOM) ORDER SPECIFICATION']);
    rows.push([]);
    rows.push(['ORDER METADATA']);
    rows.push(['BOM Reference Code', bomCode, 'Order Date', date]);
    rows.push(['Customer / Company', customer, 'Order Status', status]);
    rows.push(['Sales Person', salesPerson, 'Payment Terms', paymentType]);
    rows.push([]);
    rows.push(['LOGISTICS & ADDRESS DETAILS']);
    rows.push(['Billing Address', bStr]);
    rows.push(['Delivery Address', dStr]);
    rows.push(['Transport Mode', transportMode, 'Transport Scope', transportScope]);
    rows.push(['Transporter Name', transporterName, 'Destination', record.destination || record.deliveryCity || '-', 'Vehicle Number', vehicleNo, 'LR / Docket No', lrNo]);
    rows.push([]);
    rows.push(['LINE ITEMS BREAKDOWN']);
    rows.push(['#', 'Item Description', 'Category', 'Quantity', 'UOM', 'Unit Rate (INR)', 'Taxable Amount (INR)', 'GST Rate', 'GST Amount (INR)', 'Total (INR)']);

    const items = record.items || [];
    let calcSubtotal = 0;
    let calcTotalGst = 0;
    let calcGrandTotal = 0;

    items.forEach((it, idx) => {
      const name = it.name || it.itemName || it.title || it.description || `Item ${idx + 1}`;
      const cat = it.category || 'General';
      const qty = Number(it.quantity || it.qty || 0);
      const uom = it.uom || it.unit || 'NOS';
      const rate = Number(it.rate || it.unitPrice || it.price || 0);
      const taxable = Number(it.taxableAmount || (qty * rate) || 0);
      const gstRate = it.gstRate ? `${it.gstRate}%` : (it.gst ? `${it.gst}%` : '18%');
      const gstPct = Number(String(gstRate).replace('%', '')) || 18;
      const gstAmount = Number(it.gstAmount || (taxable * gstPct / 100) || 0);
      const total = Number(it.total || it.totalAmount || (taxable + gstAmount) || 0);

      calcSubtotal += taxable;
      calcTotalGst += gstAmount;
      calcGrandTotal += total;

      rows.push([
        idx + 1,
        name,
        cat,
        qty,
        uom,
        rate.toFixed(2),
        taxable.toFixed(2),
        gstRate,
        gstAmount.toFixed(2),
        total.toFixed(2)
      ]);
    });

    const finalGrandTotal = Number(record.grandTotal || calcGrandTotal);
    const finalTax = Number(record.totalTax || record.gstTotal || calcTotalGst);
    const finalSubtotal = Number(record.subTotal || record.subtotal || calcSubtotal);

    rows.push([]);
    rows.push(['', '', '', '', '', '', 'Subtotal', '', '', finalSubtotal.toFixed(2)]);
    rows.push(['', '', '', '', '', '', 'Total GST', '', '', finalTax.toFixed(2)]);
    rows.push(['', '', '', '', '', '', 'Grand Total (INR)', '', '', finalGrandTotal.toFixed(2)]);

    const csvContent = '\uFEFF' + rows.map(r => r.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${bomCode}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export BOM sheet as high-resolution PDF document using smart multi-page exporter
  const handleExportAsPdf = async (record) => {
    if (!record) return;
    setIsExportingFormat('pdf');
    try {
      const el = document.getElementById('bom-export-hidden-target');
      if (!el) {
        alert('Could not locate printable sheet element.');
        setIsExportingFormat(null);
        return;
      }
      const bomCode = record.bomCode || record.code || 'BOM_Order';
      await exportSmartMultiPagePdf(el, {
        filename: `${bomCode}_document.pdf`,
        scale: 2
      });
      setExportFormatRecord(null);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF: ' + err.message);
    } finally {
      setIsExportingFormat(null);
    }
  };

  // Export BOM sheet as high-resolution JPG image using html2canvas
  const handleExportAsJpg = async (record) => {
    if (!record) return;
    setIsExportingFormat('jpg');
    try {
      const el = document.getElementById('bom-export-hidden-target');
      if (!el) {
        alert('Could not locate printable sheet element.');
        setIsExportingFormat(null);
        return;
      }
      await new Promise((res) => setTimeout(res, 350));
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const bomCode = record.bomCode || record.code || 'BOM_Order';
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `${bomCode}_sheet.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExportFormatRecord(null);
    } catch (err) {
      console.error('JPG export failed:', err);
      alert('Failed to generate JPG: ' + err.message);
    } finally {
      setIsExportingFormat(null);
    }
  };

  // Helper to check if printout has been taken for a BOM order
  const isPrintoutTaken = (bom) => {
    if (!bom) return false;
    return Boolean(
      bom.dispatchPrinted ||
      bom.isPrinted ||
      (Number(bom.dispatchPrintCount) || 0) > 0 ||
      bom.firstPrintTimeStr ||
      bom.dispatchPrintedAt
    );
  };

  // Permission Check for Cancel BOM:
  // 1. Dispatch, Production, Accounts, Billing, MD can cancel uncompleted BOMs.
  // 2. Sales Person can cancel BOM ONLY IF printout has NOT been taken (!isPrintoutTaken).
  //    If printout IS taken, the Cancel option will NOT show to the sales person.
  // 3. CEO is view-only.
  const canUserCancelBom = (bom) => {
    if (!bom || isCeo) return false;
    if (bom.status === 'Cancelled & Stock Restored' || bom.cancelled) return false;
    if (bom.status === 'Completed' || bom.status === 'Closed' || bom.fullyCompleted) return false;

    const roleNorm = String(userRole || localStorage.getItem('controlroom_user_role') || '').toLowerCase().trim();
    const isDispatchOrOps = (
      roleNorm.includes('dispatch') ||
      roleNorm.includes('account') ||
      roleNorm.includes('production') ||
      roleNorm.includes('billing') ||
      roleNorm.includes('invoice') ||
      roleNorm.includes('technical administrator') ||
      roleNorm.includes('floor supervisor') ||
      roleNorm.includes('md')
    );

    if (isDispatchOrOps) return true;

    // Sales Person rule:
    // When printout is NOT taken -> Sales person CAN cancel.
    // When printout IS taken -> Cancel option will NOT show to the sales person.
    const isSales = roleNorm.includes('sales') || roleNorm.includes('executive') || roleNorm === 'sales';
    if (isSales) {
      return !isPrintoutTaken(bom);
    }

    return false;
  };

  const roleNormForBomCancel = String(userRole || localStorage.getItem('controlroom_user_role') || '').toLowerCase().trim();
  const canCancelBom = (bom) => canUserCancelBom(bom);

  // Helper to Block / Deduct Inventory immediately upon BOM Creation or Verification (Deducts ONCE)
  const blockInventoryForBom = (bomItems = [], bomCode = '') => {
    if (!Array.isArray(bomItems) || bomItems.length === 0) return;
    try {
      // Deduct exactly once via Central Inventory Store (Ledger, Raw Materials & Cloud Sync)
      centralInventoryStore.deductStockForBOM(bomCode, bomItems, userRole || 'Sales Executive');

      window.dispatchEvent(new Event('controlroom_raw_materials_update'));
      window.dispatchEvent(new Event('controlroom_storage_update'));
      window.dispatchEvent(new Event('central_inventory_updated'));
      setItemsList(getFullProductsCatalogWithStock());

      // Guarantee backend disk reconciliation
      fetch('/api/inventory/reconcile-boms', { method: 'POST' }).catch(() => {});
    } catch (err) {
      console.warn('Block inventory error:', err);
    }
  };

  // Helper to Restore / Unblock Inventory when a BOM is Cancelled
  const restoreInventoryForBom = (bomItems = [], bomCode = '') => {
    if (!Array.isArray(bomItems) || bomItems.length === 0) return;
    try {
      // 1. Restore in Central Inventory Store
      try {
        centralInventoryStore.restoreStockForBOM(bomCode, bomItems, userRole || 'Sales Executive');
      } catch (cErr) {
        console.warn('Central store restore notice:', cErr);
      }

      const itemsListStr = localStorage.getItem('controlroom_items_list');
      let currentItems = [];
      if (itemsListStr) {
        try { currentItems = JSON.parse(itemsListStr); } catch (_) {}
      }
      if (!Array.isArray(currentItems)) currentItems = [];

      bomItems.forEach(pItem => {
        const qtyToRestore = parseFloat(pItem.qty || pItem.bomQty || 1) || 0;
        const pCode = (pItem.code || '').toUpperCase().trim();
        const pName = (pItem.name || pItem.description || '').toLowerCase().trim();

        let itemMatch = currentItems.find(it => {
          const itCode = (it.code || '').toUpperCase().trim();
          const itName = (it.name || '').toLowerCase().trim();
          if (pCode && itCode === pCode) return true;
          if (pName && (itName === pName || itName.includes(pName) || pName.includes(itName))) return true;
          return false;
        });
        if (itemMatch) {
          const baseItemPhysical = Math.max(0, parseFloat(String(itemMatch.physicalStock ?? itemMatch.openingStock ?? 0).replace(/,/g, '')) || 0);
          itemMatch.physicalStock = baseItemPhysical;
          itemMatch.reserved = Math.max(0, (parseFloat(itemMatch.reserved) || 0) - qtyToRestore);
          const newItemStock = Math.max(0, baseItemPhysical - itemMatch.reserved);
          itemMatch.stock = newItemStock;
          itemMatch.availableStock = newItemStock;
          itemMatch.status = newItemStock === 0 ? 'Out of Stock' : (newItemStock <= (itemMatch.minLevel || 20) ? 'Low Stock' : 'In Stock');
        }
      });

      if (currentItems.length > 0) {
        localStorage.setItem('controlroom_items_list', JSON.stringify(currentItems));
        saveCloudStore('item_store', currentItems);
      }
      window.dispatchEvent(new Event('controlroom_items_update'));
      window.dispatchEvent(new Event('controlroom_storage_update'));
      window.dispatchEvent(new Event('central_inventory_updated'));
      setItemsList(getFullProductsCatalogWithStock());

      // Guarantee backend disk reconciliation
      fetch('/api/inventory/reconcile-boms', { method: 'POST' }).catch(() => {});
    } catch (err) {
      console.error('Error restoring inventory for BOM:', err);
    }
  };

  // Execution function for Cancel BOM
  const handleCancelBomOrder = (bomToCancel) => {
    if (!bomToCancel) return;
    if (!canUserCancelBom(bomToCancel)) {
      if (isPrintoutTaken(bomToCancel)) {
        alert('⛔ Cannot Cancel BOM!\nThe printout has already been taken by Dispatch/Production. Once printed, a BOM cannot be cancelled by Sales.');
      } else {
        alert('⛔ Access Restricted!\nYou do not have permission to cancel this BOM.');
      }
      return;
    }
    setCancellationReasonInput('');
    setBomCancelPromptModal(bomToCancel);
  };

  const executeCancelBom = (bomToCancel, reason) => {
    if (!bomToCancel) return;
    const bCode = bomToCancel.bomCode || bomToCancel.code;
    const reasonText = reason || 'Order cancelled';

    const resolveCancellerIdentity = () => {
      const storedName = (localStorage.getItem('controlroom_logged_user_name') || '').replace(/\s*\([^)]*\)/g, '').trim();
      const storedRole = (localStorage.getItem('controlroom_user_role') || userRole || '').trim();
      
      let team = 'Dispatch Team';
      let position = storedRole || 'Dispatch Head';

      if (storedRole.toLowerCase().includes('sales')) {
        team = 'Sales Department';
        position = storedRole || 'Sales Executive';
      } else if (storedRole.toLowerCase().includes('account')) {
        team = 'Accounts Team';
        if (!storedRole || storedRole === 'Sales Executive' || storedRole === 'Dispatch Head') {
          position = 'Accounts Executive';
        }
      } else if (storedRole.toLowerCase().includes('invoice') || storedRole.toLowerCase().includes('bill')) {
        team = 'Invoice Team';
        if (!storedRole || storedRole === 'Sales Executive' || storedRole === 'Dispatch Head') {
          position = 'Billing & Invoice Executive';
        }
      } else if (storedRole.toLowerCase().includes('dispatch')) {
        team = 'Dispatch Team';
        if (!storedRole || storedRole === 'Sales Executive') {
          position = 'Dispatch Head';
        }
      } else if (storedRole.toLowerCase().includes('production')) {
        team = 'Production Team';
        if (!storedRole) position = 'Production Head';
      }

      let personName = storedName;
      try {
        const emps = JSON.parse(localStorage.getItem('controlroom_employees_list') || localStorage.getItem('controlroom_employees_store') || '[]');
        if (Array.isArray(emps) && (storedName || localStorage.getItem('controlroom_logged_emp_id'))) {
          const empId = localStorage.getItem('controlroom_logged_emp_id');
          const match = emps.find(e => (empId && e.empId === empId) || (e.name && e.name.toLowerCase() === storedName.toLowerCase()));
          if (match) {
            personName = match.name || personName;
            if (match.designation || match.role) position = match.designation || match.role;
            if (match.department) {
              if (match.department.toLowerCase().includes('dispatch')) team = 'Dispatch Team';
              else if (match.department.toLowerCase().includes('account')) team = 'Accounts Team';
              else if (match.department.toLowerCase().includes('invoice') || match.department.toLowerCase().includes('bill')) team = 'Invoice Team';
            }
          }
        }
      } catch (_) {}

      if (!personName) {
        if (team === 'Dispatch Team') personName = 'Murugan';
        else if (team === 'Accounts Team') personName = 'Venkatesh';
        else if (team === 'Invoice Team') personName = 'Priya';
        else personName = 'Authorized Personnel';
      }

      const fullAttribution = `${personName} (${position}, ${team})`;

      return {
        personName,
        position,
        team,
        fullAttribution
      };
    };

    const { personName, position, team, fullAttribution } = resolveCancellerIdentity();

    // 1. Restore Inventory
    restoreInventoryForBom(bomToCancel.items || bomToCancel.dispatchPacking, bCode);

    // 2. Prepare canonical cancelled BOM record
    const updatedBomRecord = {
      ...bomToCancel,
      bomCode: bCode,
      code: bCode,
      status: 'Cancelled & Stock Restored',
      cancelled: true,
      stockBlocked: false,
      cancellationReason: reasonText,
      cancelledBy: personName,
      cancelledByRole: position,
      cancelledByTeam: team,
      cancelledByNameAndRole: fullAttribution,
      cancelledAt: new Date().toISOString()
    };
    const sanitizedRecord = stripDataUrlsFromRecord(updatedBomRecord);

    // 3. Update React state and localStorage cache
    setBomStore(prev => {
      const updated = (prev || []).map(b => (b.bomCode === bCode || b.code === bCode || b.id === bCode) ? sanitizedRecord : b);
      safeSaveBomStoreToLocal(updated);
      return updated;
    });

    if (confirmingBomModal && (confirmingBomModal.bomCode === bCode || confirmingBomModal.code === bCode || confirmingBomModal.id === bCode)) {
      setConfirmingBomModal({
        ...confirmingBomModal,
        ...sanitizedRecord,
        isEditMode: false
      });
    }

    // 4. Persist to Supabase atomic single-row store
    try {
      saveCloudBomRow(sanitizedRecord);
    } catch (sbErr) {
      console.warn('saveCloudBomRow non-fatal error:', sbErr);
    }

    // 5. Persist to backend server / PostgreSQL database (/api/boms)
    try {
      const sesId = typeof window !== 'undefined' && window.localStorage
        ? localStorage.getItem('controlroom_device_session_id')
        : null;
      fetch('/api/boms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sesId ? { 'x-session-id': sesId } : {})
        },
        body: JSON.stringify({ bom: sanitizedRecord, isUpdate: true })
      }).catch(err => console.error('Error persisting cancelled BOM to /api/boms:', err));
    } catch (_) {}

    // 6. Broadcast cross-window and cross-tab update events
    try {
      window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: sanitizedRecord } }));
      window.dispatchEvent(new CustomEvent('controlroom_bom_updated', { detail: { bom: sanitizedRecord, action: 'upsert' } }));
      window.dispatchEvent(new Event('controlroom_storage_update'));
    } catch (_) {}

    // 7. Notify Sales Person immediately
    try {
      if (typeof notifyBomCancelledByDispatch === 'function') {
        const authenticSalesPerson = (bomToCancel.salesPerson || bomToCancel.createdBy || 'Sales Executive').replace(/\s*\([^)]*\)/g, '').trim();
        const authenticEmpCode = bomToCancel.salesPersonCode || bomToCancel.createdById || bomToCancel.sales_person_code || bomToCancel.created_by_id || bomToCancel.salesPersonId || bomToCancel.salesPersonEmpCode || bomToCancel.creatorEmpCode || null;

        notifyBomCancelledByDispatch({
          bomCode: bCode,
          customerName: bomToCancel.customerName || bomToCancel.clientName || 'Customer',
          salesPerson: authenticSalesPerson,
          salesPersonEmpCode: authenticEmpCode,
          reason: reasonText,
          cancelledBy: fullAttribution,
          cancelledByRole: position,
          cancelledByTeam: team
        });
      }
    } catch (nErr) {
      console.warn('notifyBomCancelledByDispatch non-fatal:', nErr);
    }

    setBomCancelPromptModal(null);
    setCancellationReasonInput('');
  };

  // Alert function supporting structured error details and target scrolling
  const showCustomAlert = (msg, title = null, type = null, details = null, targetFieldId = null) => {
    const payload = typeof msg === 'object' && msg !== null && !Array.isArray(msg) && msg.message !== undefined
      ? msg
      : { message: msg, title, type, details, targetFieldId };

    let detectedType = payload.type;
    let detectedTitle = payload.title;
    const strMsg = String(payload.message || '');

    if (!detectedType) {
      if (strMsg.includes('❌') || strMsg.toLowerCase().includes('wrong') || strMsg.toLowerCase().includes('error') || strMsg.toLowerCase().includes('fail') || strMsg.toLowerCase().includes('invalid')) {
        detectedType = 'error';
        if (!detectedTitle) detectedTitle = 'Uh oh! Something went wrong';
      } else if (strMsg.includes('⚠️') || strMsg.toLowerCase().includes('warning') || strMsg.toLowerCase().includes('mandatory') || strMsg.toLowerCase().includes('differs') || (payload.details && payload.details.length > 0)) {
        detectedType = 'warning';
        if (!detectedTitle) detectedTitle = 'Missing Required Information';
      } else if (strMsg.includes('✅') || strMsg.toLowerCase().includes('success') || strMsg.toLowerCase().includes('created') || strMsg.toLowerCase().includes('verified')) {
        detectedType = 'success';
        if (!detectedTitle) detectedTitle = 'Action Successful';
      } else {
        detectedType = 'info';
        if (!detectedTitle) detectedTitle = 'System Notification';
      }
    }

    const cleanMsg = strMsg.replace(/^[✅⚠️❌📦🚚🔄📝📩]\s*/, '');
    setCustomAlert({
      title: detectedTitle || (detectedType === 'error' ? 'Uh oh! Something went wrong' : 'Notification'),
      message: cleanMsg || 'Action completed.',
      type: detectedType || 'info',
      details: payload.details || null,
      targetFieldId: payload.targetFieldId || null
    });
  };

  const alert = (msg, title, type) => showCustomAlert(msg, title, type);

  // Handle Proforma Invoice (PI) to Sales BOM auto-conversion
  useEffect(() => {
    const processConversion = (pendingPi) => {
      if (!pendingPi) return;

      // STRICT DRAFT GUARD: Never convert or import a Draft PI into BOM
      if (pendingPi.status === 'Draft' || pendingPi.statusType === 'draft') {
        console.warn('[BOM CONVERSION REJECTED]: Cannot convert a Draft Proforma Invoice to BOM.');
        return;
      }

      // 0. Strict 1-to-1 Safeguard: Check if this PI already has an existing active BOM in bomStore!
      const targetPiNo = String(pendingPi.sourcePiNo || pendingPi.piNo || '').trim();
      if (targetPiNo) {
        const existingBom = (bomStore || []).find(b => {
          if (!b || b.cancelled || b.status === 'Cancelled' || b.status === 'Cancelled & Stock Restored') return false;
          const sPi = String(b.sourcePiNo || b.piNo || '').trim().toLowerCase();
          return sPi === targetPiNo.toLowerCase();
        });
        if (existingBom) {
          const eCode = existingBom.bomCode || existingBom.code || existingBom.id;
          alert(`ℹ️ Proforma Invoice (${targetPiNo}) is already converted to BOM (${eCode}). Opening existing BOM order.`, 'BOM Already Exists', 'info');
          setShowBOMForm(false);
          setActiveSubTab('All');
          setSearchQueryText(eCode);
          setCurrentPage(1);
          setConfirmingBomModal(existingBom);
          return;
        }
      }

      // 1. Calculate synchronous fallback BOM code immediately from local store
      const initialSeq = getNextSequence('BOM', bomStore || []);
      const initialCode = (initialSeq && typeof initialSeq === 'object') ? initialSeq.code : initialSeq;
      setNewBomCode(initialCode);

      // 2. Sales Person
      if (pendingPi.salesPerson) {
        setNewBomSalesPerson(pendingPi.salesPerson);
      } else {
        setNewBomSalesPerson(getEffectiveSalesPerson());
      }
      setNewBomSalesPersonCode(pendingPi.salesPersonCode || pendingPi.sales_person_code || pendingPi.createdById || pendingPi.created_by_id || '');
      setNewBomCreatedBy(pendingPi.createdBy || pendingPi.created_by || pendingPi.salesPerson || '');
      setNewBomCreatedById(pendingPi.createdById || pendingPi.created_by_id || pendingPi.salesPersonCode || '');

      // 3. Customer, Company, and Contact Person details from PI
      const compName = (pendingPi.companyName || pendingPi.vendor || pendingPi.customerName || '').trim();
      const custName = (pendingPi.customerName || compName || 'Customer Order').trim();
      const cPerson = (pendingPi.contactPerson || pendingPi.contact || '').trim();
      const phoneNum = pendingPi.phone || pendingPi.mobile || '';
      const emailAddr = pendingPi.email || '';
      const gst = pendingPi.gstNo || pendingPi.gst || '';

      setNewBomProductName(custName);
      setNewBomCompanyName(compName);
      setNewBomContactPerson(cPerson);
      setNewBomPhone(phoneNum);
      setNewBomEmail(emailAddr);
      setNewBomGstNo(gst);

      setNewBomRemarks('');
      const effectivePiPaymentTerm = pendingPi.paymentTerms || pendingPi.paymentType || pendingPi.payment_terms || pendingPi.terms || '100% Paid';
      setNewBomPaymentType(normalizePaymentTerm(effectivePiPaymentTerm));
      setNewBomDocType(pendingPi.docType || 'Invoice');
      setNewBomDeliveryDate(pendingPi.deliveryDate || '');
      if (pendingPi.creditDays) setNewBomCreditDays(pendingPi.creditDays);
      if (pendingPi.partialAmount) setNewBomPartialAmount(String(pendingPi.partialAmount));
      const piPayProof = pendingPi.paymentProofDocs || pendingPi.paymentProofDoc || pendingPi.proofDoc || null;
      setNewBomPaymentProofDoc(piPayProof ? (Array.isArray(piPayProof) ? piPayProof : [piPayProof]) : null);
      const piDelProof = pendingPi.deliveryProofDocs || pendingPi.deliveryAddressProofDoc || pendingPi.deliveryProofDoc || null;
      setNewBomDeliveryProofDoc(piDelProof ? (Array.isArray(piDelProof) ? piDelProof : [piDelProof]) : null);
      setNewBomTransportMode(pendingPi.transportMode || 'Transport');
      setNewBomTransporterName(pendingPi.transporterName || pendingPi.transporter || '');
      setNewBomDestination(pendingPi.destination || pendingPi.deliveryCity || pendingPi.city || '');
      setNewBomVehicleNo(pendingPi.vehicleNo || '');
      setNewBomTransportScope(pendingPi.transportScope || 'VRM Structures');
      setNewBomLrNo(pendingPi.lrNo || '');

      // 4. Extract Full Billing Address from PI
      let bStreet = '', bCity = '', bState = '', bPin = '';
      const bAddr = pendingPi.billingAddress || pendingPi.billingAddressObj || null;
      if (bAddr) {
        if (typeof bAddr === 'object') {
          bStreet = bAddr.street || bAddr.address || '';
          bCity = bAddr.city || '';
          bState = bAddr.state || '';
          bPin = bAddr.pincode || bAddr.pin || '';
        } else if (typeof bAddr === 'string') {
          bStreet = bAddr;
        }
      }
      if (!bStreet) bStreet = pendingPi.billingStreet || '';
      if (!bCity) bCity = pendingPi.billingCity || '';
      if (!bState) bState = pendingPi.billingState || '';
      if (!bPin) bPin = pendingPi.billingPincode || '';

      setNewBomBillingStreet(bStreet);
      setNewBomBillingCity(bCity);
      setNewBomBillingState(bState);
      setNewBomBillingPincode(bPin);

      // 5. Extract Full Delivery Address from PI
      const isSameAsBilling = pendingPi.sameAsBilling !== false;
      setSameAsBilling(isSameAsBilling);

      let dStreet = '', dCity = '', dState = '', dPin = '';
      if (isSameAsBilling) {
        dStreet = bStreet;
        dCity = bCity;
        dState = bState;
        dPin = bPin;
      } else {
        const dAddr = pendingPi.deliveryAddress || pendingPi.deliveryAddressObj || null;
        if (dAddr) {
          if (typeof dAddr === 'object') {
            dStreet = dAddr.street || dAddr.address || '';
            dCity = dAddr.city || '';
            dState = dAddr.state || '';
            dPin = dAddr.pincode || dAddr.pin || '';
          } else if (typeof dAddr === 'string') {
            dStreet = dAddr;
          }
        }
        if (!dStreet) dStreet = pendingPi.deliveryStreet || '';
        if (!dCity) dCity = pendingPi.deliveryCity || '';
        if (!dState) dState = pendingPi.deliveryState || '';
        if (!dPin) dPin = pendingPi.deliveryPincode || '';
      }
      setNewBomDeliveryStreet(dStreet);
      setNewBomDeliveryCity(dCity);
      setNewBomDeliveryState(dState);
      setNewBomDeliveryPincode(dPin);

      // 6. Restore Preset Groups and kit configurations
      let restoredPresetGroups = {};
      if (pendingPi.presetGroups) {
        if (Array.isArray(pendingPi.presetGroups)) {
          pendingPi.presetGroups.forEach((g, idx) => {
            if (g && (g.groupId || g.presetId || g.presetName)) {
              const gid = g.groupId || `preset_${Date.now()}_${idx}`;
              const sCount = parseFloat(g.setCount || g.quantity || g.sets) || 1;
              const gUnit = g.unit || g.unitType || (String(g.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets');
              restoredPresetGroups[gid] = {
                groupId: gid,
                presetId: g.presetId || gid,
                presetName: g.presetName || 'Preset Kit',
                setCount: sCount,
                sets: sCount,
                unit: gUnit,
                unitType: gUnit,
                kitPrice: g.kitPrice != null ? String(g.kitPrice) : '',
                gstRate: g.gstRate || '18%'
              };
            }
          });
        } else if (typeof pendingPi.presetGroups === 'object') {
          Object.keys(pendingPi.presetGroups).forEach(gid => {
            const g = pendingPi.presetGroups[gid];
            if (g) {
              const sCount = parseFloat(g.setCount || g.quantity || g.sets) || 1;
              const gUnit = g.unit || g.unitType || (String(g.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets');
              restoredPresetGroups[gid] = {
                groupId: gid,
                presetId: g.presetId || gid,
                presetName: g.presetName || 'Preset Kit',
                setCount: sCount,
                sets: sCount,
                unit: gUnit,
                unitType: gUnit,
                kitPrice: g.kitPrice != null ? String(g.kitPrice) : '',
                gstRate: g.gstRate || '18%'
              };
            }
          });
        }
      }

      if (Object.keys(restoredPresetGroups).length === 0 && Array.isArray(pendingPi.items)) {
        pendingPi.items.forEach(it => {
          if (it.isPresetItem && (it.presetGroupId || it.presetName)) {
            const gid = it.presetGroupId || 'legacy_default';
            if (!restoredPresetGroups[gid]) {
              const piSet = parseFloat(pendingPi.presetSetCount || pendingPi.setCount || pendingPi.quantity) || 1;
              const piUnit = pendingPi.unit || pendingPi.unitType || (String(it.presetName || pendingPi.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets');
              restoredPresetGroups[gid] = {
                groupId: gid,
                presetId: gid,
                presetName: it.presetName || pendingPi.presetName || 'Preset Kit',
                setCount: piSet,
                sets: piSet,
                unit: piUnit,
                unitType: piUnit,
                kitPrice: pendingPi.presetKitPrice != null ? String(pendingPi.presetKitPrice) : (pendingPi.kitSubtotal != null ? String(pendingPi.kitSubtotal) : ''),
                gstRate: it.gstRate || '18%'
              };
            }
          }
        });
      }

      setPresetGroups(restoredPresetGroups);

      // Set primary preset state values
      const cleanGrand = parseFloat(String(pendingPi.grandTotal || pendingPi.amount || 0).replace(/[^0-9.]/g, '')) || 0;
      const firstPresetGroup = Object.values(restoredPresetGroups)[0];
      if (firstPresetGroup) {
        setSelectedPreset(firstPresetGroup.presetName || firstPresetGroup.presetId);
        setPresetKitPrice(firstPresetGroup.kitPrice != null && String(firstPresetGroup.kitPrice) !== '' ? String(firstPresetGroup.kitPrice) : (cleanGrand > 0 ? String(Math.round(cleanGrand / 1.18)) : ''));
        setPresetSetCount(firstPresetGroup.setCount || 1);
        setPresetUnit(firstPresetGroup.unit || firstPresetGroup.unitType || 'Sets');
      } else if (pendingPi.presetName || (cleanGrand > 0 && Array.isArray(pendingPi.items) && pendingPi.items.some(it => it.isPresetItem))) {
        setSelectedPreset(pendingPi.presetName || 'Pre-Engineered Structure Kit Package');
        const pPrice = pendingPi.presetKitPrice != null ? pendingPi.presetKitPrice : (cleanGrand > 0 ? Math.round(cleanGrand / 1.18) : '');
        setPresetKitPrice(String(pPrice));
        const rawCount = parseFloat(pendingPi.presetSetCount || pendingPi.setCount || pendingPi.quantity) || 1;
        setPresetSetCount(rawCount);
        const rawUnit = pendingPi.unit || pendingPi.unitType || (String(pendingPi.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets');
        setPresetUnit(rawUnit);
      } else {
        setSelectedPreset('');
        setPresetKitPrice('');
        setPresetSetCount(1);
        setPresetUnit('Sets');
      }

      // 7. Map items: preserve preset components with rate 0 and custom single items with actual rates
      if (Array.isArray(pendingPi.items) && pendingPi.items.length > 0) {
        setBomMaterialsList(pendingPi.items.map(it => {
          const isPreset = Boolean(it.isPresetItem || (it.presetGroupId && restoredPresetGroups[it.presetGroupId]));
          const itQty = parseFloat(it.qty) || 1;
          let rateVal = isPreset ? '0' : String(it.rate !== undefined && it.rate !== null && it.rate !== '' ? it.rate : '0');
          if (!isPreset && (parseFloat(rateVal) === 0 || isNaN(parseFloat(rateVal))) && cleanGrand > 0) {
            rateVal = String(Math.round(cleanGrand / itQty / 1.18));
          }
          return {
            code: it.code || it.sku || it.itemId || '',
            name: it.name || 'Structural Steel Beams',
            category: it.category || (isPreset ? 'Preset Component' : 'PI Converted Goods'),
            uom: it.uom || it.unit || 'NOS',
            unit: it.uom || it.unit || 'NOS',
            qty: String(it.qty || '1'),
            baseQty: it.baseQty != null ? it.baseQty : (parseFloat(it.qty) || 1),
            wastage: it.wastage || '0%',
            rate: rateVal,
            gstRate: it.gstRate || '18%',
            isPresetItem: isPreset,
            presetGroupId: it.presetGroupId || (isPreset && firstPresetGroup ? firstPresetGroup.groupId : null),
            presetName: it.presetName || (isPreset && firstPresetGroup ? firstPresetGroup.presetName : null)
          };
        }));
      }

      if (pendingPi.sourcePiNo || pendingPi.piNo) {
        setNewBomSourcePiNo(pendingPi.sourcePiNo || pendingPi.piNo);
      }

      // 8. Synchronously show the BOM form with all fields populated!
      setShowBOMForm(true);

      // 9. Non-blocking asynchronous refinement of atomic BOM code from server sequence
      getAndReserveNextBomCode(false).then(reservedCode => {
        if (reservedCode && (reservedCode.startsWith('VRMS/BOM/') || reservedCode.startsWith('VRM-BOM-') || /^BOM-\d+$/i.test(reservedCode))) {
          setNewBomCode(reservedCode);
        }
      }).catch(err => {
        console.warn('Background atomic BOM code check:', err);
      });
    };

    let pendingPi = convertingPiData;
    if (!pendingPi) {
      try {
        const saved = localStorage.getItem('controlroom_pending_pi_to_bom');
        if (saved) {
          pendingPi = JSON.parse(saved);
        }
      } catch (e) { }
    }

    if (pendingPi) {
      try { localStorage.removeItem('controlroom_pending_pi_to_bom'); } catch (e) {}
      processConversion(pendingPi);
      if (typeof onClearConvertingPiData === 'function') {
        onClearConvertingPiData();
      }
    }

    const handleCustomConvert = (e) => {
      if (e && e.detail) {
        processConversion(e.detail);
      }
    };

    window.addEventListener('controlroom_convert_pi_bom', handleCustomConvert);
    return () => {
      window.removeEventListener('controlroom_convert_pi_bom', handleCustomConvert);
    };
  }, [convertingPiData]);

  // Support direct navigation to a targeted BOM from PI View or external events
  useEffect(() => {
    if (props.targetBomCode && Array.isArray(bomStore) && bomStore.length > 0) {
      const codeToFind = String(props.targetBomCode).trim().toLowerCase();
      const target = bomStore.find(b => 
        (b.bomCode && b.bomCode.toLowerCase() === codeToFind) ||
        (b.code && b.code.toLowerCase() === codeToFind) ||
        (b.id && String(b.id).toLowerCase() === codeToFind)
      );
      if (target) {
        setActiveSubTab('All');
        setSearchQueryText(target.bomCode || target.code || props.targetBomCode);
        setCurrentPage(1);
        setConfirmingBomModal({ ...target, isEditMode: false });
        if (typeof props.clearTargetBom === 'function') props.clearTargetBom();
      }
    }
  }, [props.targetBomCode, bomStore]);

  useEffect(() => {
    if (props.targetPiNo) {
      setSearchQueryText(String(props.targetPiNo));
    }
  }, [props.targetPiNo]);

  // Direct Create BOM disabled per workflow policy (BOM MUST originate from an issued Proforma Invoice)
  const handleOpenCreateBom = async () => {
    showCustomAlert({
      title: '⚠️ Proforma Invoice Required',
      message: 'Per company workflow policy, a BOM cannot be created directly from scratch. Please create or open an issued Proforma Invoice (PI) first, then click "Convert to BOM".',
      type: 'warning'
    });
    if (typeof props.onChangeTab === 'function') {
      props.onChangeTab('Proforma Invoice');
    } else if (typeof props.onNavigateTab === 'function') {
      props.onNavigateTab('Proforma Invoice');
    } else {
      window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', { detail: 'Proforma Invoice' }));
    }
  };

  // Row selection handler
  const handleSelectRowGeneric = (code) => {
    setSelectedRows(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Config for BOM Orders Table
  const isSalesBOM = activeTab === 'Sales BOM' || userRole === 'Sales Executive' || activeTab === 'Create BOM';
  const filterBySelectedSales = (b) => {
    if (!isCeo || !filterSalesPerson || filterSalesPerson === 'All' || filterSalesPerson === 'All Sales') return true;
    const sp = (b?.salesPerson || b?.createdBy || '').replace(/\s*\([^)]*\)/g, '').trim();
    const clean = getCleanSalesPersonName(sp, b?.salesPersonCode || b?.createdById);
    const target = filterSalesPerson.trim().toLowerCase();
    return clean.toLowerCase() === target || clean.toLowerCase().includes(target);
  };

  const tabSearchTrim = String(searchQueryText || '').trim();
  const tabSearchLower = tabSearchTrim.toLowerCase();
  const tabIsPureDigits = /^\d+$/.test(tabSearchTrim);

  const tabBaseBomList = (visibleBomStore || []).filter(b => {
    if (!b) return false;
    if (!filterBySelectedSales(b)) return false;

    const rawDateStr = b.date || b.createdAt || '';
    const formattedDate = (() => {
      if (!rawDateStr) return new Date().toISOString().split('T')[0];
      const m = String(rawDateStr).match(/^\d{4}-\d{2}-\d{2}/);
      return m ? m[0] : String(rawDateStr).slice(0, 10);
    })();
    const rDateStr = formattedDate || b.date || b.createdAt || b.bomDate;
    if (rDateStr && (filterDateVal || filterEndDateVal)) {
      const rIso = String(rDateStr).substring(0, 10);
      if (filterDateVal && rIso < filterDateVal) return false;
      if (filterEndDateVal && rIso > filterEndDateVal) return false;
    }

    const rawCode = b.bomCode || b.code || 'BOM-101';
    const normalizedCode = normalizeBomCode(rawCode);

    if (kpiFilterMeta && kpiFilterMeta.targetKeys) {
      if (kpiFilterMeta.targetKeys.size === 0) return false;
      const bKey1 = String(normalizedCode || '').trim().toLowerCase();
      const bKey2 = String(b.code || '').trim().toLowerCase();
      const bKey3 = String(b.id || '').trim().toLowerCase();
      const bKey4 = String(b.bomCode || '').trim().toLowerCase();
      if (!kpiFilterMeta.targetKeys.has(bKey1) && !kpiFilterMeta.targetKeys.has(bKey2) && !kpiFilterMeta.targetKeys.has(bKey3) && !kpiFilterMeta.targetKeys.has(bKey4)) {
        return false;
      }
    }

    if (tabSearchTrim) {
      const displayName = [b.companyName, b.customerName, b.vendor].find(s => s && typeof s === 'string' && s.trim() && !['Customer', 'Customer Order', '—', '-'].includes(s.trim()) && !/^\d+$/.test(s.trim())) || b.companyName || b.customerName || 'Customer Order';
      const sp = (b.salesPerson || b.createdBy || '').replace(/\s*\([^)]*\)/g, '').trim();
      const cleanSales = getCleanSalesPersonName(sp, b.salesPersonCode || b.createdById);
      const srcPi = b.sourcePiNo || b.piNo || '';
      if (tabIsPureDigits) {
        const rank = getNumericSearchMatchRank(
          tabSearchTrim,
          [normalizedCode, b.bomCode, rawCode, b.id, srcPi],
          [b.customerName, displayName]
        );
        if (!(rank > 0)) return false;
      } else {
        const matchesTxt =
          (normalizedCode && normalizedCode.toLowerCase().includes(tabSearchLower)) ||
          (b.bomCode && String(b.bomCode).toLowerCase().includes(tabSearchLower)) ||
          (b.id && String(b.id).toLowerCase().includes(tabSearchLower)) ||
          (srcPi && String(srcPi).toLowerCase().includes(tabSearchLower)) ||
          (formattedDate && formattedDate.toLowerCase().includes(tabSearchLower)) ||
          (displayName && displayName.toLowerCase().includes(tabSearchLower)) ||
          (b.customerName && b.customerName.toLowerCase().includes(tabSearchLower)) ||
          (cleanSales && cleanSales.toLowerCase().includes(tabSearchLower));
        if (!matchesTxt) return false;
      }
    }

    return true;
  });

  const pageConfig = {
    title: isCeo ? 'All Bill of Materials (BOM) — Master Register' :
           activeTab === 'Sales BOM' ? 'Sales Bill of Materials (BOM)' :
           activeTab === 'BOM' ? 'Bill of Materials (BOM)' :
           activeTab === 'BOM / Routing' ? 'Bill of Materials & Production Routing' :
           activeTab === 'Create BOM' ? 'Create BOM' :
           'BOM Orders & Client Specifications',
    subtitle: isCeo ? 'Complete company-wide master list of customer BOM orders across all sales representatives (Executive View-Only)' :
              (activeTab === 'Sales BOM' || isSalesBOM) ? 'Customer order BOMs, product specifications and sales quotations' :
              activeTab === 'BOM' ? 'Standard raw material consumption lists and component requirements' :
              activeTab === 'BOM / Routing' ? 'Multi-level BOM definitions, component ratios, and sequential routing processes' :
              'Create and manage customer order BOMs, product specifications, and payment terms',
    actionText: 'Create BOM',
    searchPlaceholder: `Search ${activeTab} (BOM Code, Customer Name, Product)...`,
    tabs: isCeo ? [
      { id: 'All', label: 'All BOMs', count: tabBaseBomList.filter(b => !(b.cancelled || b.status === 'Cancelled & Stock Restored' || (b.status || '').toLowerCase().includes('cancel'))).length, bg: '#e2e8f0', fg: '#475569' },
      { id: 'sales_confirmation_pending', label: 'Sales Confirmation Pending', count: tabBaseBomList.filter(b => getBomActiveStage(b).name === 'Sales Confirmation Pending').length, bg: '#f1f5f9', fg: '#475569' },
      { id: 'dispatch_packing_pending', label: 'Dispatch Packing Pending', count: tabBaseBomList.filter(b => getBomActiveStage(b).name === 'Dispatch Packing Pending').length, bg: '#fef3c7', fg: '#b45309' },
      { id: 'accounts_verification_pending', label: 'Accounts Verification Pending', count: tabBaseBomList.filter(b => getBomActiveStage(b).name === 'Accounts Verification Pending').length, bg: '#f3e8ff', fg: '#7e22ce' },
      { id: 'invoice_pending', label: 'Invoice Pending', count: tabBaseBomList.filter(b => getBomActiveStage(b).name === 'Invoice Pending').length, bg: '#dbeafe', fg: '#1d4ed8' },
      { id: 'vehicle_loading_pending', label: 'Vehicle Loading Pending', count: tabBaseBomList.filter(b => getBomActiveStage(b).name === 'Vehicle Loading Pending').length, bg: '#cffafe', fg: '#0e7490' },
      { id: 'dispatched', label: 'Dispatched', count: tabBaseBomList.filter(b => getBomActiveStage(b).name === 'Dispatched').length, bg: '#dcfce7', fg: '#166534' }
    ] : [
      { id: 'All', label: 'All BOMs', count: tabBaseBomList.filter(b => !(b.cancelled || b.status === 'Cancelled & Stock Restored' || (b.status || '').toLowerCase().includes('cancel'))).length, bg: '#e2e8f0', fg: '#475569' },
      { id: 'Pending', label: 'Pending Sales Confirmation', count: tabBaseBomList.filter(b => (!b.status || b.status === 'Pending Sales Confirmation' || b.status.includes('Pending Confirmation') || b.status === 'Draft') && !b.cancelled).length, bg: '#fef3c7', fg: '#b45309' },
      { id: 'AddressAction', label: 'Address Proof Requested', count: tabBaseBomList.filter(b => (b.addressProofReuploadRequested || b.status === 'Address Proof Requested from Sales') && !b.cancelled).length, bg: '#fee2e2', fg: '#b91c1c' },
      { id: 'Sent', label: 'Sales Confirmed / Forwarded', count: tabBaseBomList.filter(b => (b.status === 'Sales Confirmed - Sent to Dispatch' || b.status === 'Sent to Production' || b.status === 'Confirmed' || b.salesConfirmed) && !b.fullyCompleted && b.status !== 'Completed' && b.status !== 'Closed' && !b.cancelled).length, bg: '#dcfce7', fg: '#166534' },
      { id: 'PendingPrint', label: 'Pending Print', count: tabBaseBomList.filter(b => (!b.dispatchPrinted && !b.isPrinted) && !(b.status === 'Completed' || b.status === 'Closed' || b.status === 'CLOSED' || b.fullyCompleted || b.status === 'Fully Dispatched & Delivered' || (b.status || '').toLowerCase().includes('completed') || (b.status || '').toLowerCase().includes('closed')) && !(b.status === 'Cancelled & Stock Restored' || b.cancelled)).length, bg: '#fef3c7', fg: '#b45309' },
      { id: 'Printed', label: 'Print Taken', count: tabBaseBomList.filter(b => (b.dispatchPrinted || b.isPrinted) && !(b.status === 'Completed' || b.status === 'Closed' || b.status === 'CLOSED' || b.fullyCompleted || b.status === 'Fully Dispatched & Delivered' || (b.status || '').toLowerCase().includes('completed') || (b.status || '').toLowerCase().includes('closed')) && !(b.status === 'Cancelled & Stock Restored' || b.cancelled)).length, bg: '#dcfce7', fg: '#166534' },
      { id: 'Closed', label: 'Closed / Completed', count: tabBaseBomList.filter(b => b && (b.status === 'Completed' || b.status === 'Closed' || b.status === 'CLOSED' || b.fullyCompleted || b.status === 'Fully Dispatched & Delivered' || (b.status || '').toLowerCase().includes('completed') || (b.status || '').toLowerCase().includes('closed')) && !b.cancelled).length, bg: '#ecfdf5', fg: '#047857' },
      { id: 'Cancelled', label: 'Cancelled & Restored', count: tabBaseBomList.filter(b => b.status === 'Cancelled & Stock Restored' || b.cancelled || (b.status || '').toLowerCase().includes('cancel')).length, bg: '#fee2e2', fg: '#dc2626' }
    ],
    headers: ['BOM Code', 'Date & Time', 'Customer Name', 'Sales Person', 'Payment Type', 'Total (₹)', 'Printout Status', 'Status'],
    rows: (visibleBomStore || []).filter(Boolean).sort(compareBomDescending).map(b => {
      const isCancelled = b.status === 'Cancelled & Stock Restored' || b.cancelled || (b.status || '').toLowerCase().includes('cancel');
      const isAddressRequested = b.addressProofReuploadRequested || b.status === 'Address Proof Requested from Sales';
      const isClosedOrCompleted = b.status === 'Completed' || b.status === 'Closed' || b.status === 'CLOSED' || b.fullyCompleted || b.status === 'Fully Dispatched & Delivered' || (b.status || '').toLowerCase().includes('completed') || (b.status || '').toLowerCase().includes('closed');
      const isPackedOrDispatch = (b.status || '').toLowerCase().includes('dispatch') || (b.status || '').toLowerCase().includes('packed') || (b.status || '').toLowerCase().includes('loading');
      const isConfirmed = Boolean(
        b.salesConfirmed ||
        b.salesReconfirmed ||
        b.status === 'Sales Confirmed - Sent to Dispatch' ||
        b.status === 'Sent to Production' ||
        b.status === 'Confirmed' ||
        (typeof b.status === 'string' && (
          b.status.toLowerCase().includes('sales confirmed') ||
          b.status.toLowerCase().includes('sent to dispatch')
        )) ||
        isPackedOrDispatch
      );
      const isPending = !isConfirmed && (!b.status || b.status === 'Pending Sales Confirmation' || b.status === 'Pending Confirmation' || b.status === 'Pending' || b.status === 'Draft');

      let stBg = '#dcfce7';
      let stFg = '#166534';
      let stBorder = '1px solid #bbf7d0';
      let tabGroup = 'Sent';

      if (isCancelled) {
        stBg = '#fef2f2';
        stFg = '#dc2626';
        stBorder = '1px solid #fecaca';
        tabGroup = 'Cancelled';
      } else if (isClosedOrCompleted) {
        stBg = '#ecfdf5';
        stFg = '#047857';
        stBorder = '1px solid #a7f3d0';
        tabGroup = 'Closed';
      } else if (isAddressRequested) {
        stBg = '#fee2e2';
        stFg = '#b91c1c';
        stBorder = '1px solid #fca5a5';
        tabGroup = 'AddressAction';
      } else if (isConfirmed) {
        stBg = isPackedOrDispatch ? '#e0e7ff' : '#dcfce7';
        stFg = isPackedOrDispatch ? '#3730a3' : '#166534';
        stBorder = isPackedOrDispatch ? '1px solid #c7d2fe' : '1px solid #bbf7d0';
        tabGroup = 'Sent';
      } else if (isPending) {
        stBg = '#fef3c7';
        stFg = '#b45309';
        stBorder = '1px solid #fde68a';
        tabGroup = 'Pending';
      }

      const rawDateStr = b.date || b.createdAt || '';
      const formattedDate = (() => {
        if (!rawDateStr) return new Date().toISOString().split('T')[0];
        const m = String(rawDateStr).match(/^\d{4}-\d{2}-\d{2}/);
        return m ? m[0] : String(rawDateStr).slice(0, 10);
      })();

      const displayName = [b.companyName, b.customerName, b.vendor].find(s => s && typeof s === 'string' && s.trim() && !['Customer', 'Customer Order', '—', '-'].includes(s.trim()) && !/^\d+$/.test(s.trim())) || b.companyName || b.customerName || 'Customer Order';
      const numVal = (v) => {
        const n = parseFloat(String(v || '').replace(/[^0-9.]/g, ''));
        return Number.isFinite(n) && n > 0 ? n : 0;
      };
      const gVal = numVal(b.grandTotal) || numVal(b.total) || numVal(b.subTotal);

      const getDeterministicTime = (ord) => {
        const codeStr = String(ord?.code || ord?.bomCode || ord?.id || '390');
        const matches = codeStr.match(/\d+/g);
        const seq = matches ? parseInt(matches[matches.length - 1], 10) : 390;
        const baseMins = 10 * 60 + ((seq * 19) % 450);
        const h24 = Math.floor(baseMins / 60);
        const mins = baseMins % 60;
        const ampm = h24 >= 12 ? 'PM' : 'AM';
        const h12 = h24 % 12 || 12;
        return `${String(h12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
      };

      const resolveDateTime = (order) => {
        const extractRaw = (val) => {
          if (!val) return '';
          if (typeof val === 'string') {
            const trimmed = val.trim();
            return (trimmed === '[object Object]' || trimmed.includes('[object')) ? '' : trimmed;
          }
          if (val instanceof Date && !isNaN(val.getTime())) {
            return val.toISOString();
          }
          if (typeof val === 'object') {
            if (typeof val.combined === 'string' && val.combined !== '[object Object]') return val.combined;
            if (typeof val.date === 'string' && val.date !== '[object Object]') {
              return (val.time && typeof val.time === 'string' && val.time !== '[object Object]') ? `${val.date} ${val.time}` : val.date;
            }
          }
          return '';
        };

        let rawTs = extractRaw(order?.salesConfirmedAt) ||
                    extractRaw(order?.sales_confirmed_at) ||
                    extractRaw(order?.createdAt) ||
                    extractRaw(order?.created_at) ||
                    extractRaw(order?.timestamp) ||
                    extractRaw(order?.dateTime) ||
                    extractRaw(order?.dateTimeObj);

        let s = rawTs ? String(rawTs).trim() : '';

        const isDateOnlySeed = !s || /^\d{4}-\d{2}-\d{2}$/.test(s) || /T00:00:00(?:\.000)?Z?$/i.test(s) || /T05:30:00(?:\.\d+)?Z?$/i.test(s);

        if (isDateOnlySeed) {
          const candidate = extractRaw(order?.updatedAt) || extractRaw(order?.updated_at);
          if (candidate) {
            const candStr = String(candidate).trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(candStr) && !/T00:00:00(?:\.000)?Z?$/i.test(candStr) && !/T05:30:00(?:\.\d+)?Z?$/i.test(candStr)) {
              rawTs = candidate;
              s = candStr;
            }
          }
        }

        if (!rawTs) {
          rawTs = extractRaw(order?.date);
          s = rawTs ? String(rawTs).trim() : '';
        }

        if (!rawTs) {
          const fallbackTime = order?.dispatchPrintTimeStr || order?.firstPrintTimeStr || getDeterministicTime(order);
          return { date: '—', time: fallbackTime, combined: `—, ${fallbackTime}` };
        }

        const explicitDateStr = extractRaw(order?.date);
        let explicitDateObj = null;
        if (explicitDateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(explicitDateStr).trim())) {
          const parts = String(explicitDateStr).trim().split('-');
          explicitDateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }

        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          const parts = s.split('-');
          const yr = parseInt(parts[0], 10);
          const mo = parseInt(parts[1], 10) - 1;
          const da = parseInt(parts[2], 10);
          const d = new Date(yr, mo, da);
          const dStr = isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          const fallbackTime = order?.dispatchPrintTimeStr || order?.firstPrintTimeStr || getDeterministicTime(order);
          return { date: dStr, time: fallbackTime, combined: `${dStr}, ${fallbackTime}` };
        }

        const d = new Date(rawTs);
        if (isNaN(d.getTime())) {
          const safeS = (s === '[object Object]' || s.includes('[object')) ? '—' : s;
          const fallbackTime = order?.dispatchPrintTimeStr || order?.firstPrintTimeStr || getDeterministicTime(order);
          return { date: safeS, time: fallbackTime, combined: `${safeS}, ${fallbackTime}` };
        }

        const dStr = (explicitDateObj && !isNaN(explicitDateObj.getTime()))
          ? explicitDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        let tStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        if (!tStr || tStr === 'Invalid Date' || /12:00:00\s*(AM|PM)/i.test(tStr) || /00:00/.test(tStr)) {
          tStr = order?.dispatchPrintTimeStr || order?.firstPrintTimeStr || getDeterministicTime(order);
        }

        const finalDate = (typeof dStr === 'string' && dStr !== '[object Object]') ? dStr : '—';
        const finalTime = (typeof tStr === 'string' && tStr !== '[object Object]') ? tStr : getDeterministicTime(order);

        return { date: finalDate, time: finalTime, combined: `${finalDate}, ${finalTime}` };
      };

      const dt = resolveDateTime(b);
      const isPrinted = Boolean(b.dispatchPrinted || b.isPrinted);
      const printTime = b.dispatchPrintTimeStr || (b.dispatchPrintedAt ? new Date(b.dispatchPrintedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '');
      const printDate = b.dispatchPrintedDateStr || (b.dispatchPrintedAt ? new Date(b.dispatchPrintedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
      const printedBy = b.dispatchPrintedBy || 'Dispatch Team';

      const rawCode = b.bomCode || b.code || 'BOM-101';
      const normalizedCode = normalizeBomCode(rawCode);

      return {
        ...b,
        code: normalizedCode,
        bomCode: normalizedCode,
        rawBomCode: rawCode,
        rawCode,
        c2: formattedDate,
        dateTimeObj: dt,
        c3: displayName,
        salesPerson: (() => {
          const sp = (b.salesPerson || b.createdBy || '').replace(/\s*\([^)]*\)/g, '').trim();
          return getCleanSalesPersonName(sp, b.salesPersonCode || b.createdById);
        })(),
        sourcePiNo: b.sourcePiNo || b.piNo || null,
        dispatchPrinted: isPrinted,
        dispatchPrintTimeStr: printTime,
        dispatchPrintedDateStr: printDate,
        dispatchPrintedBy: printedBy,
        c4: normalizePaymentTerm(b.paymentType || b.paymentTerms || b.piPaymentTerms),
        c5: gVal > 0 ? formatCurrency(gVal) : (b.grandTotal != null ? formatCurrency(b.grandTotal) : '—'),
        status: isAddressRequested ? 'Address Proof Requested from Sales' : (isClosedOrCompleted ? (b.status || 'Completed') : ((b.status && b.status !== 'Draft') ? b.status : 'Pending Sales Confirmation')),
        stBg,
        stFg,
        stBorder,
        tabGroup
      };
    })
  };

  const uniqueSalesPersons = React.useMemo(() => {
    const set = new Set();
    const excludedGeneric = ['sales', 'sales person', 'salesperson', 'sales department', '—', '-', 'undefined', 'null'];
    (pageConfig.rows || []).forEach(r => {
      const name = String(r.salesPerson || '').trim();
      if (name && !excludedGeneric.includes(name.toLowerCase())) {
        set.add(name);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pageConfig.rows]);

  const qTrim = String(searchQueryText || '').trim();
  const qLower = qTrim.toLowerCase();
  const isPureDigits = /^\d+$/.test(qTrim);

  const filteredByFilters = (pageConfig.rows || []).filter(r => {
    const subTab = (activeSubTab || 'All').toLowerCase();
    const rStatus = (r.status || '').toLowerCase();
    const rTabGroup = (r.tabGroup || '').toLowerCase();
    const isPrinted = Boolean(r.dispatchPrinted || r.isPrinted);
    const isClosedOrDone = rTabGroup === 'closed' || rStatus.includes('closed') || rStatus.includes('complete') || r.fullyCompleted || (r.status || '').toLowerCase().includes('completed') || (r.status || '').toLowerCase().includes('closed');
    const isCancelled = Boolean(r.cancelled || r.status === 'Cancelled & Stock Restored' || rStatus.includes('cancel') || rTabGroup === 'cancelled');

    let matchesTab = false;
    if (isCeo) {
      if (subTab === 'all' || subTab === 'all boms') {
        matchesTab = !isCancelled;
      } else {
        const activeStage = getBomActiveStage(r);
        const stageNorm = activeStage.name.toLowerCase().replace(/\s+/g, '_');
        matchesTab = (activeStage.name.toLowerCase() === subTab || stageNorm === subTab) && !isCancelled;
      }
    } else {
      if (subTab === 'all' || subTab === 'all boms') {
        matchesTab = !isCancelled;
      } else if (subTab === 'pendingprint') {
        matchesTab = !isPrinted && !isCancelled && !isClosedOrDone;
      } else if (subTab === 'printed') {
        matchesTab = isPrinted && !isCancelled && !isClosedOrDone;
      } else if (subTab === 'addressaction') {
        matchesTab = Boolean(r.addressProofReuploadRequested || rStatus.includes('address proof')) && !isCancelled;
      } else if (subTab.includes('closed') || subTab.includes('complete')) {
        matchesTab = Boolean(isClosedOrDone) && !isCancelled;
      } else if (subTab.includes('cancel')) {
        matchesTab = isCancelled;
      } else if (subTab.includes('pending') || subTab.includes('draft')) {
        matchesTab = Boolean((rStatus.includes('pending') || rStatus.includes('draft')) && !isCancelled);
      } else if (subTab.includes('sent')) {
        matchesTab = Boolean((rTabGroup === 'sent' || rStatus.includes('sent') || rStatus.includes('confirm') || rStatus.includes('production')) && !isCancelled);
      } else {
        matchesTab = (rTabGroup === subTab) && !isCancelled;
      }
    }

    // Date range filter matching
    let matchesDate = true;
    const rDateStr = r.c2 || r.date || r.createdAt || r.bomDate;
    if (rDateStr && (filterDateVal || filterEndDateVal)) {
      const rIso = String(rDateStr).substring(0, 10);
      if (filterDateVal && rIso < filterDateVal) matchesDate = false;
      if (filterEndDateVal && rIso > filterEndDateVal) matchesDate = false;
    }

    // KPI Filter from Overview
    let matchesKpi = true;
    if (kpiFilterMeta && kpiFilterMeta.targetKeys) {
      if (kpiFilterMeta.targetKeys.size === 0) {
        matchesKpi = false;
      } else {
        const bKey1 = String(r.bomCode || '').trim().toLowerCase();
        const bKey2 = String(r.code || '').trim().toLowerCase();
        const bKey3 = String(r.id || '').trim().toLowerCase();
        if (!kpiFilterMeta.targetKeys.has(bKey1) && !kpiFilterMeta.targetKeys.has(bKey2) && !kpiFilterMeta.targetKeys.has(bKey3)) {
          matchesKpi = false;
        }
      }
    }

    // Sales person filter for CEO
    let matchesSalesPerson = true;
    if (isCeo && filterSalesPerson && filterSalesPerson !== 'All' && filterSalesPerson !== 'All Sales') {
      const targetSp = filterSalesPerson.trim().toLowerCase();
      const rSp = String(r.salesPerson || '').trim().toLowerCase();
      const rawSp = String(r.rawSalesPerson || r.createdBy || '').trim().toLowerCase();
      matchesSalesPerson = (rSp === targetSp) || rSp.includes(targetSp) || (rawSp === targetSp) || rawSp.includes(targetSp);
    }

    return matchesTab && matchesDate && matchesKpi && matchesSalesPerson;
  });

  const filteredRows = (() => {
    if (!qTrim) return filteredByFilters;
    if (isPureDigits) {
      const rankedMatches = [];
      for (let i = 0; i < filteredByFilters.length; i++) {
        const r = filteredByFilters[i];
        const rank = getNumericSearchMatchRank(
          qTrim,
          [r.code, r.bomCode, r.rawBomCode, r.id, r.sourcePiNo],
          [r.customerName, r.c3]
        );
        if (rank > 0) {
          rankedMatches.push({ row: r, rank, idx: i });
        }
      }
      rankedMatches.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.idx - b.idx));
      return rankedMatches.map(entry => entry.row);
    }
    return filteredByFilters.filter(r =>
      (r.code && r.code.toLowerCase().includes(qLower)) ||
      (r.bomCode && String(r.bomCode).toLowerCase().includes(qLower)) ||
      (r.id && String(r.id).toLowerCase().includes(qLower)) ||
      (r.sourcePiNo && String(r.sourcePiNo).toLowerCase().includes(qLower)) ||
      (r.c2 && r.c2.toLowerCase().includes(qLower)) ||
      (r.c3 && r.c3.toLowerCase().includes(qLower)) ||
      (r.customerName && r.customerName.toLowerCase().includes(qLower)) ||
      (r.salesPerson && r.salesPerson.toLowerCase().includes(qLower))
    );
  })();

  // Calculate totals for Create BOM form
  const calculateBOMTotals = () => {
    // 1. Calculate preset kits subtotal across all preset groups that currently have items in bomMaterialsList
    const activeGroupIds = Array.from(new Set(
      (bomMaterialsList || [])
        .filter(it => it.isPresetItem)
        .map(it => it.presetGroupId || 'legacy_default')
    ));

    let kitSubtotal = 0;
    activeGroupIds.forEach(grpId => {
      const grp = presetGroups[grpId];
      if (grp) {
        const unitPrice = cleanNum(grp.kitPrice, 0);
        const multiplier = parseFloat(String(grp.setCount).replace(/[^0-9.]/g, '')) || 1;
        kitSubtotal += (unitPrice * multiplier);
      } else if (grpId === 'legacy_default') {
        const unitPrice = (selectedPreset && presetKitPrice !== '') ? cleanNum(presetKitPrice, 0) : 0;
        const multiplier = parseFloat(String(presetSetCount).replace(/[^0-9.]/g, '')) || 1;
        kitSubtotal += (unitPrice * multiplier);
      }
    });

    // 2. Individual items subtotal (exclude preset items because their cost is in kitSubtotal)
    const itemsSub = (bomMaterialsList || []).reduce((acc, item) => {
      if (item.isPresetItem || item.presetGroupId) return acc;
      const q = cleanNum(item.qty, 0);
      const r = cleanNum(item.rate, 0);
      return acc + (q * r);
    }, 0);

    const sub = itemsSub + kitSubtotal;
    const disc = 0;

    // 3. GST: Custom item GSTs + Preset kits GST (dynamically from each preset's selected gstRate)
    const itemsGst = (bomMaterialsList || []).reduce((acc, item) => {
      if (item.isPresetItem || item.presetGroupId) return acc;
      const q = cleanNum(item.qty, 0);
      const r = cleanNum(item.rate, 0);
      const rowTot = q * r;
      const pct = cleanNum(String(item.gstRate || '18%').replace('%', ''), 18);
      return acc + (rowTot * (pct / 100));
    }, 0);

    let kitGst = 0;
    activeGroupIds.forEach(grpId => {
      const grp = presetGroups[grpId];
      let groupTotal = 0;
      if (grp) {
        const unitPrice = cleanNum(grp.kitPrice, 0);
        const multiplier = parseFloat(String(grp.setCount).replace(/[^0-9.]/g, '')) || 1;
        groupTotal = unitPrice * multiplier;
      } else if (grpId === 'legacy_default') {
        const unitPrice = (selectedPreset && presetKitPrice !== '') ? cleanNum(presetKitPrice, 0) : 0;
        const multiplier = parseFloat(String(presetSetCount).replace(/[^0-9.]/g, '')) || 1;
        groupTotal = unitPrice * multiplier;
      }

      const groupItems = (bomMaterialsList || []).filter(it => (it.presetGroupId || 'legacy_default') === grpId);
      const totalQty = groupItems.reduce((sum, it) => sum + cleanNum(it.qty, 1), 0);

      if (totalQty > 0) {
        groupItems.forEach(it => {
          const itQty = cleanNum(it.qty, 1);
          const itemShare = groupTotal * (itQty / totalQty);
          const itGstRate = cleanNum(String(it.gstRate || grp?.gstRate || '18%').replace('%', ''), 18);
          kitGst += itemShare * (itGstRate / 100);
        });
      } else {
        const gRateStr = grp?.gstRate || '18%';
        const gPct = cleanNum(String(gRateStr).replace('%', ''), 18);
        kitGst += groupTotal * (gPct / 100);
      }
    });

    const gst = itemsGst + kitGst;
    const grand = sub - disc + gst;
    const cgst = gst / 2;
    const sgst = gst / 2;
    return {
      sub: cleanNum(sub, 0),
      kitSubtotal: cleanNum(kitSubtotal, 0),
      disc: cleanNum(disc, 0),
      gst: cleanNum(gst, 0),
      grand: cleanNum(grand, 0),
      cgst: cleanNum(cgst, 0),
      sgst: cleanNum(sgst, 0)
    };
  };

  const totals = calculateBOMTotals();


  // ==========================================
  // RENDER 3: DEFAULT BOM TABLE & PAGINATION
  // ==========================================
  const handleExecuteSettleCredit = async (targetRow) => {
    if (!targetRow) return;
    if (!settleCreditUtr.trim()) {
      alert('⚠️ Please enter the Bank Reference / UTR Number.');
      return;
    }
    if (!settleCreditFile) {
      alert('⚠️ Please select or upload the bank payment slip/receipt image.');
      return;
    }
    const paidNum = cleanNum(settleCreditAmount, 0);
    if (paidNum <= 0) {
      alert('⚠️ Please enter a valid settled payment amount (₹).');
      return;
    }

    try {
      setIsSettlingCredit(true);
      const targetCode = targetRow.bomCode || targetRow.code || targetRow.id;

      let docMeta = null;
      try {
        const uploaded = await uploadBomDocumentFile({
          file: settleCreditFile,
          bomCode: targetCode,
          category: 'payment-proof'
        });
        if (uploaded && uploaded.name) {
          docMeta = {
            ...uploaded,
            originalName: settleCreditFile.name,
            utr: settleCreditUtr.trim(),
            settledAmount: paidNum,
            paymentDate: settleCreditDate,
            paymentMode: settleCreditMode,
            notes: settleCreditNotes.trim()
          };
        }
      } catch (uErr) {
        console.warn('uploadBomDocumentFile non-fatal, falling back to local compressed:', uErr);
      }

      if (!docMeta) {
        const compressed = await new Promise((resolve) => {
          compressAndSaveFile(settleCreditFile, (res) => {
            resolve(res || {
              name: settleCreditFile.name,
              originalName: settleCreditFile.name,
              type: settleCreditFile.type,
              size: settleCreditFile.size,
              dataUrl: null
            });
          });
        });

        docMeta = {
          name: compressed?.name || settleCreditFile.name,
          originalName: settleCreditFile.name,
          type: settleCreditFile.type,
          size: compressed?.size || settleCreditFile.size,
          dataUrl: compressed?.dataUrl || null,
          uploadedAt: new Date().toISOString(),
          category: 'payment-proof',
          utr: settleCreditUtr.trim(),
          settledAmount: paidNum,
          paymentDate: settleCreditDate,
          paymentMode: settleCreditMode,
          notes: settleCreditNotes.trim()
        };

        if (docMeta.name && compressed?.dataUrl) {
          saveMediaToCache(docMeta.name, compressed.dataUrl);
        }
      }

      const updatedList = (bomStore || []).map(b => (b.bomCode === targetCode || b.code === targetCode || b.id === targetCode) ? {
        ...b,
        status: (() => {
          if (b.status && b.status !== 'Credit Settled (100% Paid)' && b.status !== 'Pending Confirmation') {
            return b.status;
          }
          if (b.invoiceGenerated || (b.invoiceNo && b.invoiceNo !== 'Pending Confirmation') || b.taxInvoiceNo) {
            return 'Invoice Generated';
          }
          if (b.accountsVerified || b.isAccountsDone || b.accountsVerification?.verified) {
            return 'Accounts Verified & Passed to Invoice';
          }
          if (b.dispatchPackingVerified || (Array.isArray(b.dispatchPacking) && b.dispatchPacking.length > 0)) {
            return 'Dispatch Packing Verified - Sent to Accounts';
          }
          return b.salesConfirmed ? 'Sales Confirmed - Sent to Dispatch' : 'Accounts Verified & Passed to Invoice';
        })(),
        paymentStatus: 'Credit Settled (100% Paid)',
        creditSettled: true,
        salesConfirmed: true,
        dispatchPackingVerified: Boolean(b.dispatchPackingVerified || (Array.isArray(b.dispatchPacking) && b.dispatchPacking.length > 0) || b.accountsVerified || b.isAccountsDone || b.accountsVerification?.verified),
        accountsVerified: Boolean(b.accountsVerified || b.isAccountsDone || b.accountsVerification?.verified || b.status?.includes('Accounts Verified') || b.status?.includes('Invoice')),
        isAccountsDone: Boolean(b.isAccountsDone || b.accountsVerification?.verified || b.accountsVerified || b.status?.includes('Accounts Verified') || b.status?.includes('Invoice')),
        creditSettledAt: new Date().toISOString(),
        creditSettledBy: currentUserName || userRole,
        creditSettledRole: userRole,
        creditSettledUtr: settleCreditUtr.trim(),
        creditSettledDate: settleCreditDate,
        creditSettledAmount: paidNum,
        creditSettledMode: settleCreditMode,
        creditSettledNotes: settleCreditNotes.trim(),
        paymentProofDoc: docMeta,
        paymentProofDocs: [...(Array.isArray(b.paymentProofDocs) ? b.paymentProofDocs : []), docMeta],
        accountsVerification: {
          ...(b.accountsVerification || {}),
          verified: Boolean(b.accountsVerification?.verified || b.isAccountsDone || b.accountsVerified || true),
          creditSettled: true,
          paymentStatus: 'Credit Settled (100% Paid)',
          settledUtr: settleCreditUtr.trim(),
          settledDate: settleCreditDate,
          settledAmount: paidNum,
          paymentProofDoc: docMeta
        },
        payments: {
          ...b.payments,
          creditSettled: true,
          settledUtr: settleCreditUtr.trim(),
          settledDate: settleCreditDate,
          proofDoc: docMeta.name,
          proofDocObj: docMeta,
          paymentUpdated: true
        }
      } : b);

      setBomStore(updatedList);
      safeSaveBomStoreToLocal(updatedList);

      const targetBom = updatedList.find(b => b.bomCode === targetCode || b.code === targetCode || b.id === targetCode);
      if (targetBom) {
        saveCloudBomRow(targetBom);
        const sesId = typeof window !== 'undefined' && window.localStorage
          ? (localStorage.getItem('controlroom_device_session_id') || localStorage.getItem('businz_device_session_id'))
          : null;
        const curRole = typeof window !== 'undefined' && window.localStorage ? (localStorage.getItem('controlroom_user_role') || 'Sales') : 'Sales';
        const curEmp = typeof window !== 'undefined' && window.localStorage ? (localStorage.getItem('controlroom_logged_emp_id') || 'SE-001') : 'SE-001';

        fetch('/api/boms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sesId ? { 'x-session-id': sesId } : {}),
            'x-user-role': curRole,
            'x-employee-code': curEmp
          },
          body: JSON.stringify({ bom: stripDataUrlsFromRecord(targetBom), isUpdate: true })
        }).catch(() => {});

        // Send real-time notification to Accounts
        try {
          notifyCreditPaymentSettled({
            bomCode: targetBom.bomCode,
            customerName: targetBom.customerName || targetBom.companyName || targetBom.c2 || 'Customer',
            salesPerson: currentUserName || targetBom.salesPerson || 'Sales Executive',
            amount: paidNum,
            utrNumber: settleCreditUtr.trim()
          });
        } catch (nErr) {
          console.warn('Failed to send notification to Accounts:', nErr);
        }
      }

      // Dispatch events for local real-time sync
      window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: targetBom } }));
      window.dispatchEvent(new CustomEvent('controlroom_storage_update', { detail: { key: 'controlroom_bom_store' } }));

      setSettleCreditModal(null);
      setUploadPaymentModal(null);
      alert(`✅ Credit payment of ₹ ${paidNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })} for ${targetRow.customerName || targetRow.companyName || 'Customer'} settled successfully!\n\n• Order marked as "Credit Settled (100% Paid)".\n• Customer credit balance cleared.\n• Accounts team notified in real time.`);
    } catch (err) {
      alert(`❌ Failed to settle credit: ${err.message}`);
    } finally {
      setIsSettlingCredit(false);
    }
  };
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredRows.slice(indexOfFirstRow, indexOfLastRow);


  const bomCtx = {};
  Object.assign(bomCtx, {
    props,
    activeTab,
    userRole,
    convertingPiData,
    onClearConvertingPiData,
    getOrderLifecycle,
    canonicalizeSalespersonCode,
    CODE_TO_SALES_NAME,
    getCleanSalesPersonName,
    safeSaveBomStoreToLocal,
    sanitizeBomRecord,
    formatAppliedAtDate,
    formatBomDateDot,
    getBomActiveStage,
    getBomStageTiming,
    searchQueryText,
    setSearchQueryText,
    kpiFilterMeta,
    setKpiFilterMeta,
    filterDateVal,
    setFilterDateVal,
    filterEndDateVal,
    setFilterEndDateVal,
    filterStatusSelect,
    setFilterStatusSelect,
    filterSalesPerson,
    setFilterSalesPerson,
    activeSubTab,
    setActiveSubTab,
    selectedRows,
    setSelectedRows,
    currentPage,
    setCurrentPage,
    rowsPerPage,
    setRowsPerPage,
    isConfirmingForward,
    setIsConfirmingForward,
    printingBomRecord,
    setPrintingBomRecord,
    exportFormatRecord,
    setExportFormatRecord,
    isExportingFormat,
    setIsExportingFormat,
    bomCancelPromptModal,
    setBomCancelPromptModal,
    cancellationReasonInput,
    setCancellationReasonInput,
    uploadingPayment,
    setUploadingPayment,
    lrUploadModal,
    setLrUploadModal,
    ceoBomDetailModal,
    setCeoBomDetailModal,
    viewingPiModalFromBom,
    setViewingPiModalFromBom,
    bomStore,
    setBomStore,
    tableLoading,
    setTableLoading,
    customerList,
    setCustomerList,
    activePresetsMap,
    setActivePresetsMap,
    itemsList,
    setItemsList,
    debounceSyncTimerRef,
    isCeo,
    executiveDossierOrder,
    setExecutiveDossierOrder,
    showBOMForm,
    setShowBOMForm,
    bomCustSearchTimerRef,
    confirmingBomModal,
    setConfirmingBomModal,
    uploadPaymentModal,
    setUploadPaymentModal,
    settleCreditModal,
    setSettleCreditModal,
    settleCreditUtr,
    setSettleCreditUtr,
    settleCreditDate,
    setSettleCreditDate,
    settleCreditMode,
    setSettleCreditMode,
    settleCreditAmount,
    setSettleCreditAmount,
    settleCreditFile,
    setSettleCreditFile,
    settleCreditNotes,
    setSettleCreditNotes,
    isSettlingCredit,
    setIsSettlingCredit,
    paymentProofFile,
    setPaymentProofFile,
    paymentProofFiles,
    setPaymentProofFiles,
    existingPaymentDocsList,
    setExistingPaymentDocsList,
    paymentStageType,
    setPaymentStageType,
    quickPreviewRecord,
    setQuickPreviewRecord,
    previewDocModal,
    setPreviewDocModal,
    customAlert,
    setCustomAlert,
    bomActionMenuIdx,
    setBomActionMenuIdx,
    newBomCode,
    setNewBomCode,
    newBomDeliveryDate,
    setNewBomDeliveryDate,
    newBomProductName,
    setNewBomProductName,
    newBomCompanyName,
    setNewBomCompanyName,
    newBomContactPerson,
    setNewBomContactPerson,
    newBomPhone,
    setNewBomPhone,
    newBomEmail,
    setNewBomEmail,
    newBomGstNo,
    setNewBomGstNo,
    newBomDocType,
    setNewBomDocType,
    newBomDeliveryAddress,
    setNewBomDeliveryAddress,
    newBomBillingStreet,
    setNewBomBillingStreet,
    newBomBillingCity,
    setNewBomBillingCity,
    newBomBillingState,
    setNewBomBillingState,
    newBomBillingPincode,
    setNewBomBillingPincode,
    newBomDeliveryStreet,
    setNewBomDeliveryStreet,
    newBomDeliveryCity,
    setNewBomDeliveryCity,
    newBomDeliveryState,
    setNewBomDeliveryState,
    newBomDeliveryPincode,
    setNewBomDeliveryPincode,
    newBomPaymentType,
    setNewBomPaymentType,
    newBomPartialAmount,
    setNewBomPartialAmount,
    modalBalanceAmount,
    setModalBalanceAmount,
    paymentModalTab,
    setPaymentModalTab,
    modalCreditDays,
    setModalCreditDays,
    modalCreditDueDate,
    setModalCreditDueDate,
    modalCreditTerm,
    setModalCreditTerm,
    modalCreditApprovedBy,
    setModalCreditApprovedBy,
    modalCreditNotes,
    setModalCreditNotes,
    isSavingCredit,
    setIsSavingCredit,
    newBomCreditDays,
    setNewBomCreditDays,
    sameAsBilling,
    setSameAsBilling,
    newBomDeliveryProofDoc,
    setNewBomDeliveryProofDoc,
    newBomPaymentProofDoc,
    setNewBomPaymentProofDoc,
    newBomRemarks,
    setNewBomRemarks,
    newBomTransportMode,
    setNewBomTransportMode,
    newBomTransporterName,
    setNewBomTransporterName,
    newBomDestination,
    setNewBomDestination,
    newBomVehicleNo,
    setNewBomVehicleNo,
    newBomTransportScope,
    setNewBomTransportScope,
    newBomLrNo,
    setNewBomLrNo,
    formErrors,
    setFormErrors,
    validationErrorModal,
    setValidationErrorModal,
    deliveryDocs,
    paymentDocs,
    handleUploadDeliveryProofFiles,
    handleRemoveDeliveryDoc,
    handleUploadPaymentProofFiles,
    handleRemovePaymentDoc,
    isSubmittingBom,
    setIsSubmittingBom,
    bomSubmitStage,
    setBomSubmitStage,
    bomSubmitAssignedCode,
    setBomSubmitAssignedCode,
    isSubmittingBomRef,
    lastConvertedPiRef,
    newBomSourcePiNo,
    setNewBomSourcePiNo,
    newBomSalesPersonCode,
    setNewBomSalesPersonCode,
    newBomCreatedBy,
    setNewBomCreatedBy,
    newBomCreatedById,
    setNewBomCreatedById,
    validateBomForm,
    getEffectiveSalesPerson,
    defaultSalesPersonName,
    newBomSalesPerson,
    setNewBomSalesPerson,
    currentEmpId,
    currentEmpName,
    currentLoggedEmail,
    currentUserName,
    curCode,
    effectiveCurName,
    curName,
    curEmail,
    isGenericSales,
    isRestrictedSalesUser,
    visibleBomStore,
    ceoMetrics,
    selectedPreset,
    setSelectedPreset,
    presetSetCount,
    setPresetSetCount,
    presetUnit,
    setPresetUnit,
    presetKitPrice,
    setPresetKitPrice,
    presetGroups,
    setPresetGroups,
    selectedBomItemIndexes,
    setSelectedBomItemIndexes,
    bomItemsLayoutMode,
    setBomItemsLayoutMode,
    showClearConfirmModal,
    setShowClearConfirmModal,
    bomConfirmModal,
    setBomConfirmModal,
    bomMaterialsList,
    setBomMaterialsList,
    handleExportBomCsv,
    handleExportAsPdf,
    handleExportAsJpg,
    isPrintoutTaken,
    canUserCancelBom,
    roleNormForBomCancel,
    canCancelBom,
    blockInventoryForBom,
    restoreInventoryForBom,
    handleCancelBomOrder,
    executeCancelBom,
    showCustomAlert,
    alert,
    handleOpenCreateBom,
    handleSelectRowGeneric,
    isSalesBOM,
    filterBySelectedSales,
    tabSearchTrim,
    tabSearchLower,
    tabIsPureDigits,
    tabBaseBomList,
    pageConfig,
    uniqueSalesPersons,
    qTrim,
    qLower,
    isPureDigits,
    filteredByFilters,
    filteredRows,
    calculateBOMTotals,
    totals,
    handleExecuteSettleCredit,
    totalPages,
    indexOfLastRow,
    indexOfFirstRow,
    currentRows,
    renderDocPreviewModal: () => <BomDocPreviewModal ctx={bomCtx} />,
    renderValidationErrorModal: () => <BomValidationErrorModal ctx={bomCtx} />,
    renderExportFormatModal: () => <BomExportFormatModal ctx={bomCtx} />,
    renderBomSubmittingOverlay: () => <BomSubmittingOverlay ctx={bomCtx} />
  });

  if (showBOMForm) {
    return <BomCreateFormSection ctx={bomCtx} />;
  }

  if (confirmingBomModal) {
    return <BomConfirmAuditSection ctx={bomCtx} />;
  }

  return <BomDashboardSection ctx={bomCtx} />;
}
