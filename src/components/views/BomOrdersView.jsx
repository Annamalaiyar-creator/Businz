import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus, Check, Trash2, Eye, FileText, Search, AlertCircle, AlertTriangle, X, XCircle,
  CheckCircle, Clock, Calendar, Edit3, RotateCcw, UploadCloud, ChevronDown, ChevronUp,
  Truck, ShoppingCart, Upload, Printer, Download, Layers, CreditCard, Bell, MoreHorizontal, FileCheck, CheckSquare,
  Camera, Video, LayoutGrid, List, Layout, Sparkles, PackageCheck, Image, Image as ImageIcon, FileSpreadsheet, Loader, Lock, Save, Boxes, User
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { fetchCloudStore, saveCloudStore, saveCloudStoreImmediate, subscribeToCloudStore, getAndReserveNextBomCode, resolveBomCollisions, deleteCloudBomRow, saveCloudBomRow } from '../../utils/supabaseDataSync';
import { VRM_HDG_PRESETS, getAllActivePresets, isFixedQuantityPreset } from '../../vrmHdgProposalPresets';
import { VRM_PRODUCTS } from '../../utils/vrmProductsData';
import { saveMediaToCache, getMediaFromCache, stripDataUrlsFromRecord, compressAndSaveFile, cleanNum, formatCurrency, normalizePaymentTerm, STANDARD_PAYMENT_TERMS } from '../../utils/otherViewsShared';
import { uploadBomDocumentFile, validateClientFile } from '../../utils/bomStorageClient';
import { resolveDocumentUrl, resolveDocumentUrlAsync } from '../../utils/documentResolver';
import { getFullProductsCatalogWithStock } from '../../utils/productCatalogService';
import { centralInventoryStore } from '../../utils/centralInventoryStore';
import SearchablePresetSelector from '../SearchablePresetSelector';
import TypeableProductSelect from '../TypeableProductSelect';
import ModernDateRangePicker from '../ModernDateRangePicker';
import { fetchCustomersDeduplicated, searchCustomers, getCustomerDetails } from '../../services/customerService';
import { is5PctSolarProduct } from '../PerformaInvoiceView';
import VRMBomPrintTemplate, { VRMBomPrintSheet } from '../VRMBomPrintTemplate';
import LrUploadPopupModal from './LrUploadPopupModal';
import { notifyBomSentToDispatch, notifyBomCancelledByDispatch } from '../../services/notificationService';
import { getNextSequence } from '../../utils/sequenceGenerator';

export default function BomOrdersView(props) {
  const {
    activeTab = 'BOM Orders',
    userRole = 'Sales Executive',
    convertingPiData,
    onClearConvertingPiData
  } = props;

  // Search & Filter states
  const [searchQueryText, setSearchQueryText] = useState('');
  const [filterDateVal, setFilterDateVal] = useState('');
  const [filterEndDateVal, setFilterEndDateVal] = useState('');
  const [filterStatusSelect, setFilterStatusSelect] = useState('All');
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

  // Safe localStorage saver that catches QuotaExceededError and trims cache to top 50 recent records per Rule 5
  const safeSaveBomStoreToLocal = (list) => {
    try {
      const sanitized = (Array.isArray(list) ? list : []).map(stripDataUrlsFromRecord);
      try {
        localStorage.setItem('controlroom_bom_store', JSON.stringify(sanitized));
      } catch (quotaErr) {
        console.warn('[LocalStorage Quota Exceeded] Trimming local BOM cache to recent 50 records.');
        const trimmed = sanitized.slice(0, 50);
        try {
          localStorage.setItem('controlroom_bom_store', JSON.stringify(trimmed));
        } catch (_) {}
      }
    } catch (err) {
      console.warn('[safeSaveBomStoreToLocal error]:', err);
    }
  };

  // Cache-First Instant Hydration: load immediately from localStorage with 0ms delay
  const [bomStore, setBomStore] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_bom_store');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const { list: resolvedList } = resolveBomCollisions(parsed, 662);
          if (resolvedList.length !== parsed.length) {
            localStorage.setItem('controlroom_bom_store', JSON.stringify(resolvedList.map(stripDataUrlsFromRecord)));
          }
          return resolvedList.map(stripDataUrlsFromRecord);
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
            const parseBomSeq = (code) => {
              const m = String(code || '').match(/BOM-(\d+)/i);
              return m ? parseInt(m[1], 10) : 0;
            };
            const sorted = resolvedList.sort((a, b) => {
              const seqA = parseBomSeq(a?.bomCode || a?.code || a?.id);
              const seqB = parseBomSeq(b?.bomCode || b?.code || b?.id);
              if (seqA !== seqB) return seqB - seqA;
              const dateA = new Date(a?.salesConfirmedAt || a?.date || a?.createdAt || 0).getTime() || 0;
              const dateB = new Date(b?.salesConfirmedAt || b?.date || b?.createdAt || 0).getTime() || 0;
              return dateB - dateA;
            });
            const cleaned = sorted.map(stripDataUrlsFromRecord);
            setBomStore(prev => {
              let mergedCleaned = [...cleaned];
              if (Array.isArray(prev) && prev.length > 0) {
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
  const isCeo = userRole === 'CEO' || userRole === 'MD' || userRole === 'Managing Director';

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
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentStageType, setPaymentStageType] = useState('100% Advance');
  const [quickPreviewRecord, setQuickPreviewRecord] = useState(null);
  const [previewDocModal, setPreviewDocModal] = useState(null); // { title: string, doc: object }
  const [customAlert, setCustomAlert] = useState(null);
  const [bomActionMenuIdx, setBomActionMenuIdx] = useState(null);

  // Create BOM Form Specific State
  const [newBomCode, setNewBomCode] = useState('');
  const [newBomDeliveryDate, setNewBomDeliveryDate] = useState('');
  const [newBomProductName, setNewBomProductName] = useState('');
  const [newBomCompanyName, setNewBomCompanyName] = useState('');
  const [newBomContactPerson, setNewBomContactPerson] = useState('');
  const [newBomPhone, setNewBomPhone] = useState('');
  const [newBomEmail, setNewBomEmail] = useState('');
  const [newBomGstNo, setNewBomGstNo] = useState('');
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

    // 5. Payment Proof for 100% Paid / Partial Paid Orders (Mandatory per policy)
    const isPaidOrder = newBomPaymentType === '100% Paid' || newBomPaymentType === '100% Advance';
    const isPartialOrder = newBomPaymentType === 'Partial Paid' || newBomPaymentType === 'Partial Payment';
    const currentPaymentDocs = Array.isArray(newBomPaymentProofDoc)
      ? newBomPaymentProofDoc
      : (newBomPaymentProofDoc ? [newBomPaymentProofDoc] : []);
    if (!isDraft && (isPaidOrder || isPartialOrder)) {
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

  // Role check: Only individual Sales personnel are isolated to their own BOMs.
  // Management & Fulfillment roles (Dispatch Head, Dispatch, Production Head, Floor Supervisor, Sales Head, CEO, Managing Director, Technical Administrator, Accounts Head, Accounts Executive, Procurement Head, Billing) see all BOMs.
  const isRestrictedSalesUser = Boolean(
    userRole &&
    ['Sales Executive', 'Sales', 'Salesperson', 'Sales Rep', 'Sales Representative'].some(r => r.toLowerCase() === userRole.toLowerCase().trim()) &&
    !['Sales Head', 'CEO', 'MD', 'Managing Director', 'Technical Administrator', 'Dispatch Head', 'Dispatch', 'Dispatch Team', 'Production Head', 'Accounts Head', 'Accounts Executive', 'Billing', 'Floor Supervisor', 'Procurement Head'].some(r => r.toLowerCase() === userRole.toLowerCase().trim())
  );

  const visibleBomStore = React.useMemo(() => {
    const rawList = (bomStore || []).filter(b => {
      if (!b) return false;
      const code = String(b.bomCode || b.code || b.id || '').trim();
      if (/^BOM-(STAGING|USER|POST|DEV-TEST)/i.test(code)) return false;
      return true;
    });
    if (!isRestrictedSalesUser) return rawList;

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

    // Code matching helper: exact match or normalized matching (e.g. SE-004 vs SE-VRM004 vs EMP-SE-004)
    const isCodeMatch = (testCode) => {
      if (!testCode) return false;
      const tc = String(testCode).trim().toUpperCase();
      if (!tc) return false;
      if (userAliases.has(tc)) return true;
      if (curCode && (tc === curCode || tc.includes(curCode) || curCode.includes(tc))) return true;

      // Extract numeric ID and dept prefix (e.g., 'SE' and '4')
      if (curCode && curCode.includes('SE')) {
        const curDigits = curCode.replace(/\D/g, '').replace(/^0+/, '');
        const testDigits = tc.replace(/\D/g, '').replace(/^0+/, '');
        if (tc.includes('SE') && curDigits && curDigits === testDigits) return true;
      }
      return false;
    };

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

      // 1. Check all possible salesperson / creator / converter codes on the BOM
      const bomCodes = [
        b.salesPersonCode,
        b.createdById,
        b.convertedById,
        b.sales_person_code,
        b.created_by_id,
        b.converted_by_id,
        b._extra_data?.salesPersonCode,
        b._extra_data?.createdById,
        b._extra_data?.convertedById
      ].filter(Boolean);

      if (bomCodes.some(isCodeMatch)) {
        return true;
      }

      // 2. Exact or normalized email match
      const bomEmails = [b.salesPersonEmail, b.email, b.creatorEmail].filter(Boolean).map(e => String(e).trim().toLowerCase());
      if (curEmail && bomEmails.some(e => e === curEmail || userAliases.has(e))) {
        return true;
      }

      // 3. Name matching across salesperson / creator / converter
      const bomNames = [
        b.salesPerson,
        b.createdBy,
        b.convertedBy,
        b.sales_person,
        b.created_by,
        b.converted_by
      ].filter(Boolean).map(n => String(n).replace(/\s*\([^)]*\)/g, '').trim().toLowerCase());

      if (bomNames.some(n => {
        if (userAliases.has(n)) return true;
        if (cleanCurNorm) {
          const normN = normA(n);
          if (normN === cleanCurNorm || normN.includes(cleanCurNorm) || cleanCurNorm.includes(normN)) return true;
        }
        return false;
      })) {
        return true;
      }

      return false;
    });
  }, [bomStore, isRestrictedSalesUser, currentEmpId, currentEmpName, defaultSalesPersonName, currentLoggedEmail, props.targetBomCode, props.targetPiNo]);

  const [selectedPreset, setSelectedPreset] = useState('');
  const [presetSetCount, setPresetSetCount] = useState(1);
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

  // Export BOM sheet as high-resolution PDF document using jsPDF + html2canvas
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
      await new Promise((res) => setTimeout(res, 350));
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, '', 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight, '', 'FAST');
        heightLeft -= pageHeight;
      }

      const bomCode = record.bomCode || record.code || 'BOM_Order';
      pdf.save(`${bomCode}_document.pdf`);
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

  // Permission Check for Cancel BOM (Strictly Dispatch, Production, and Billing Logins — Excludes CEO View-Only)
  const canCancelBom = !isCeo && [
    'Dispatch Head', 'Dispatch Executive',
    'Production Head', 'Technical Administrator', 'Floor Supervisor',
    'Billing', 'Invoice Executive', 'Accounts Head', 'Accounts Executive'
  ].includes(userRole);

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
    if (!canCancelBom) {
      alert('⛔ Access Restricted!\nOnly Dispatch, Production, or Billing logins are authorized to cancel a BOM and release reserved inventory.');
      return;
    }
    setCancellationReasonInput('');
    setBomCancelPromptModal(bomToCancel);
  };

  const executeCancelBom = (bomToCancel, reason) => {
    if (!bomToCancel) return;
    const bCode = bomToCancel.bomCode || bomToCancel.code;
    const reasonText = reason || 'Order cancelled by Dispatch';

    const resolveCancellerIdentity = () => {
      const storedName = (localStorage.getItem('controlroom_logged_user_name') || '').replace(/\s*\([^)]*\)/g, '').trim();
      const storedRole = (localStorage.getItem('controlroom_user_role') || userRole || '').trim();
      
      let team = 'Dispatch Team';
      let position = storedRole || 'Dispatch Head';

      if (storedRole.toLowerCase().includes('account')) {
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

    // 2. Update BOM status with cancellation details
    setBomStore(prev => {
      const updated = prev.map(b => (b.bomCode === bCode || b.code === bCode) ? {
        ...b,
        status: 'Cancelled & Stock Restored',
        cancelled: true,
        stockBlocked: false,
        cancellationReason: reasonText,
        cancelledBy: personName,
        cancelledByRole: position,
        cancelledByTeam: team,
        cancelledByNameAndRole: fullAttribution,
        cancelledAt: new Date().toISOString()
      } : b);
      const sanitized = updated.map(stripDataUrlsFromRecord);
      return sanitized;
    });

    if (confirmingBomModal && (confirmingBomModal.bomCode === bCode || confirmingBomModal.code === bCode)) {
      setConfirmingBomModal(prev => prev ? {
        ...prev,
        status: 'Cancelled & Stock Restored',
        cancelled: true,
        stockBlocked: false,
        cancellationReason: reasonText,
        cancelledBy: personName,
        cancelledByRole: position,
        cancelledByTeam: team,
        cancelledByNameAndRole: fullAttribution,
        cancelledAt: new Date().toISOString(),
        isEditMode: false
      } : null);
    }

    // 3. Notify Sales Person immediately
    notifyBomCancelledByDispatch({
      bomCode: bCode,
      customerName: bomToCancel.customerName || bomToCancel.clientName || 'Customer',
      salesPerson: bomToCancel.salesPerson || bomToCancel.createdBy || 'Sales Executive',
      reason: reasonText,
      cancelledBy: fullAttribution,
      cancelledByRole: position,
      cancelledByTeam: team
    });

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
          setConfirmingBomModal(existingBom);
          return;
        }
      }

      // 1. Calculate synchronous fallback BOM code immediately from local store
      const initialCode = getNextSequence(bomStore, 'BOM');
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
      setNewBomDeliveryDate(pendingPi.deliveryDate || '');
      if (pendingPi.creditDays) setNewBomCreditDays(pendingPi.creditDays);
      if (pendingPi.partialAmount) setNewBomPartialAmount(String(pendingPi.partialAmount));
      if (pendingPi.paymentProofDoc || pendingPi.proofDoc) setNewBomPaymentProofDoc(pendingPi.paymentProofDoc || pendingPi.proofDoc);
      if (pendingPi.deliveryProofDoc || pendingPi.deliveryAddressProofDoc) setNewBomDeliveryProofDoc(pendingPi.deliveryProofDoc || pendingPi.deliveryAddressProofDoc);
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
              restoredPresetGroups[gid] = {
                groupId: gid,
                presetId: g.presetId || gid,
                presetName: g.presetName || 'Preset Kit',
                setCount: parseInt(g.setCount) || 1,
                kitPrice: g.kitPrice != null ? String(g.kitPrice) : '',
                gstRate: g.gstRate || '18%'
              };
            }
          });
        } else if (typeof pendingPi.presetGroups === 'object') {
          Object.keys(pendingPi.presetGroups).forEach(gid => {
            const g = pendingPi.presetGroups[gid];
            if (g) {
              restoredPresetGroups[gid] = {
                groupId: gid,
                presetId: g.presetId || gid,
                presetName: g.presetName || 'Preset Kit',
                setCount: parseInt(g.setCount) || 1,
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
              restoredPresetGroups[gid] = {
                groupId: gid,
                presetId: gid,
                presetName: it.presetName || pendingPi.presetName || 'Preset Kit',
                setCount: parseInt(pendingPi.presetSetCount) || 1,
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
      } else if (pendingPi.presetName || (cleanGrand > 0 && Array.isArray(pendingPi.items) && pendingPi.items.some(it => it.isPresetItem))) {
        setSelectedPreset(pendingPi.presetName || 'Pre-Engineered Structure Kit Package');
        const pPrice = pendingPi.presetKitPrice != null ? pendingPi.presetKitPrice : (cleanGrand > 0 ? Math.round(cleanGrand / 1.18) : '');
        setPresetKitPrice(String(pPrice));
        setPresetSetCount(pendingPi.presetSetCount || 1);
      } else {
        setSelectedPreset('');
        setPresetKitPrice('');
        setPresetSetCount(1);
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
            uom: it.uom || 'NOS',
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
        if (reservedCode && (reservedCode.startsWith('VRM-BOM-') || /^BOM-\d+$/i.test(reservedCode))) {
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
        setSearchQueryText(target.bomCode || target.code || props.targetBomCode);
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
    tabs: [
      { id: 'All', label: 'All BOMs', count: (visibleBomStore || []).length, bg: '#e2e8f0', fg: '#475569' },
      { id: 'Draft', label: 'Draft', count: (visibleBomStore || []).filter(b => b.status === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
      { id: 'Pending', label: 'Pending Sales Confirmation', count: (visibleBomStore || []).filter(b => !b.status || b.status === 'Pending Sales Confirmation' || b.status.includes('Pending Confirmation') || b.status === 'Draft').length, bg: '#fef3c7', fg: '#b45309' },
      { id: 'AddressAction', label: 'Address Proof Requested', count: (visibleBomStore || []).filter(b => b.addressProofReuploadRequested || b.status === 'Address Proof Requested from Sales').length, bg: '#fee2e2', fg: '#b91c1c' },
      { id: 'Sent', label: 'Sales Confirmed / Forwarded', count: (visibleBomStore || []).filter(b => (b.status === 'Sales Confirmed - Sent to Dispatch' || b.status === 'Sent to Production' || b.status === 'Confirmed' || b.salesConfirmed) && !b.fullyCompleted && b.status !== 'Completed' && b.status !== 'Closed').length, bg: '#dcfce7', fg: '#166534' },
      { id: 'PendingPrint', label: 'Pending Print', count: (visibleBomStore || []).filter(b => (!b.dispatchPrinted && !b.isPrinted) && !(b.status === 'Completed' || b.status === 'Closed' || b.status === 'CLOSED' || b.fullyCompleted || b.status === 'Fully Dispatched & Delivered' || (b.status || '').toLowerCase().includes('completed') || (b.status || '').toLowerCase().includes('closed')) && !(b.status === 'Cancelled & Stock Restored' || b.cancelled)).length, bg: '#fef3c7', fg: '#b45309' },
      { id: 'Printed', label: 'Print Taken', count: (visibleBomStore || []).filter(b => (b.dispatchPrinted || b.isPrinted) && !(b.status === 'Completed' || b.status === 'Closed' || b.status === 'CLOSED' || b.fullyCompleted || b.status === 'Fully Dispatched & Delivered' || (b.status || '').toLowerCase().includes('completed') || (b.status || '').toLowerCase().includes('closed')) && !(b.status === 'Cancelled & Stock Restored' || b.cancelled)).length, bg: '#dcfce7', fg: '#166534' },
      { id: 'Closed', label: 'Closed / Completed', count: (visibleBomStore || []).filter(b => b && (b.status === 'Completed' || b.status === 'Closed' || b.status === 'CLOSED' || b.fullyCompleted || b.status === 'Fully Dispatched & Delivered' || (b.status || '').toLowerCase().includes('completed') || (b.status || '').toLowerCase().includes('closed'))).length, bg: '#ecfdf5', fg: '#047857' },
      { id: 'Cancelled', label: 'Cancelled & Restored', count: (visibleBomStore || []).filter(b => b.status === 'Cancelled & Stock Restored' || b.cancelled).length, bg: '#f1f5f9', fg: '#64748b' }
    ],
    headers: ['BOM Code', 'Date & Time', 'Customer Name', 'Sales Person', 'Payment Type', 'Total (₹)', 'Printout Status', 'Status'],
    rows: (visibleBomStore || []).filter(Boolean).map(b => {
      const isDraft = b.status === 'Draft';
      const isCancelled = b.status === 'Cancelled & Stock Restored' || b.cancelled;
      const isAddressRequested = b.addressProofReuploadRequested || b.status === 'Address Proof Requested from Sales';
      const isClosedOrCompleted = b.status === 'Completed' || b.status === 'Closed' || b.status === 'CLOSED' || b.fullyCompleted || b.status === 'Fully Dispatched & Delivered' || (b.status || '').toLowerCase().includes('completed') || (b.status || '').toLowerCase().includes('closed');
      const isPending = !b.status || b.status === 'Pending Sales Confirmation' || b.status === 'Pending Confirmation' || b.status === 'Pending';
      const isPackedOrDispatch = (b.status || '').toLowerCase().includes('dispatch') || (b.status || '').toLowerCase().includes('packed') || (b.status || '').toLowerCase().includes('loading');
      const isConfirmed = b.status === 'Sales Confirmed - Sent to Dispatch' || b.status === 'Sent to Production' || b.status === 'Confirmed' || b.salesConfirmed || isPackedOrDispatch;

      let stBg = '#dcfce7';
      let stFg = '#166534';
      let stBorder = '1px solid #bbf7d0';
      let tabGroup = 'Sent';

      if (isCancelled) {
        stBg = '#f1f5f9';
        stFg = '#64748b';
        stBorder = '1px solid #cbd5e1';
        tabGroup = 'Cancelled';
      } else if (isClosedOrCompleted) {
        stBg = '#ecfdf5';
        stFg = '#047857';
        stBorder = '1px solid #a7f3d0';
        tabGroup = 'Closed';
      } else if (isDraft) {
        stBg = '#fff7ed';
        stFg = '#c2410c';
        stBorder = '1px solid #fed7aa';
        tabGroup = 'Draft';
      } else if (isAddressRequested) {
        stBg = '#fee2e2';
        stFg = '#b91c1c';
        stBorder = '1px solid #fca5a5';
        tabGroup = 'AddressAction';
      } else if (isPending) {
        stBg = '#fef3c7';
        stFg = '#b45309';
        stBorder = '1px solid #fde68a';
        tabGroup = 'Pending';
      } else if (isPackedOrDispatch) {
        stBg = '#e0e7ff';
        stFg = '#3730a3';
        stBorder = '1px solid #c7d2fe';
        tabGroup = 'Sent';
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

      const resolveDateTime = (order) => {
        let rawTs = order?.salesConfirmedAt || order?.createdAt || order?.timestamp;
        let s = rawTs ? String(rawTs).trim() : '';

        const isDateOnlySeed = !s || /^\d{4}-\d{2}-\d{2}$/.test(s) || /T00:00:00(?:\.000)?Z?$/i.test(s) || /T05:30:00(?:\.\d+)?Z?$/i.test(s);

        if (isDateOnlySeed) {
          const candidate = order?.updatedAt || order?.updated_at;
          if (candidate) {
            const candStr = String(candidate).trim();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(candStr) && !/T00:00:00(?:\.000)?Z?$/i.test(candStr) && !/T05:30:00(?:\.\d+)?Z?$/i.test(candStr)) {
              rawTs = candidate;
              s = candStr;
            }
          }
        }

        if (!rawTs) {
          rawTs = order?.date;
          s = rawTs ? String(rawTs).trim() : '';
        }

        if (!rawTs) {
          return { date: '—', time: '', combined: '—' };
        }

        const explicitDateStr = order?.date;
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
          return { date: dStr, time: '', combined: dStr };
        }

        const d = new Date(rawTs);
        if (isNaN(d.getTime())) {
          return { date: s, time: '', combined: s };
        }

        const dStr = (explicitDateObj && !isNaN(explicitDateObj.getTime()))
          ? explicitDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        const tStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        return { date: dStr, time: tStr, combined: `${dStr}, ${tStr}` };
      };

      const dt = resolveDateTime(b);
      const isPrinted = Boolean(b.dispatchPrinted || b.isPrinted);
      const printTime = b.dispatchPrintTimeStr || (b.dispatchPrintedAt ? new Date(b.dispatchPrintedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '');
      const printDate = b.dispatchPrintedDateStr || (b.dispatchPrintedAt ? new Date(b.dispatchPrintedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
      const printedBy = b.dispatchPrintedBy || 'Dispatch Team';

      return {
        ...b,
        code: b.bomCode || b.code || 'BOM-101',
        c2: formattedDate,
        dateTimeObj: dt,
        c3: displayName,
        salesPerson: (() => {
          const sp = (b.salesPerson || b.createdBy || '').replace(/\s*\([^)]*\)/g, '').trim();
          if (!sp || sp === 'Sales Department') return (defaultSalesPersonName && !['Sales Executive', 'Sales'].includes(defaultSalesPersonName) ? defaultSalesPersonName : (sp || 'Sales Department'));
          return sp;
        })(),
        sourcePiNo: b.sourcePiNo || b.piNo || null,
        dispatchPrinted: isPrinted,
        dispatchPrintTimeStr: printTime,
        dispatchPrintedDateStr: printDate,
        dispatchPrintedBy: printedBy,
        c4: normalizePaymentTerm(b.paymentType || b.paymentTerms || b.piPaymentTerms),
        c5: gVal > 0 ? formatCurrency(gVal) : (b.grandTotal != null ? formatCurrency(b.grandTotal) : '—'),
        status: isAddressRequested ? 'Address Proof Requested from Sales' : (isClosedOrCompleted ? (b.status || 'Completed') : (b.status || 'Pending Sales Confirmation')),
        stBg,
        stFg,
        stBorder,
        tabGroup
      };
    })
  };

  const filteredRows = (pageConfig.rows || []).filter(r => {
    const matchesSearch = !searchQueryText ||
      (r.code && r.code.toLowerCase().includes(searchQueryText.toLowerCase())) ||
      (r.sourcePiNo && String(r.sourcePiNo).toLowerCase().includes(searchQueryText.toLowerCase())) ||
      (r.c2 && r.c2.toLowerCase().includes(searchQueryText.toLowerCase())) ||
      (r.c3 && r.c3.toLowerCase().includes(searchQueryText.toLowerCase())) ||
      (r.customerName && r.customerName.toLowerCase().includes(searchQueryText.toLowerCase()));

    const subTab = (activeSubTab || 'All').toLowerCase();
    const rStatus = (r.status || '').toLowerCase();
    const rTabGroup = (r.tabGroup || '').toLowerCase();
    const isPrinted = Boolean(r.dispatchPrinted || r.isPrinted);
    const isClosedOrDone = rTabGroup === 'closed' || rStatus.includes('closed') || rStatus.includes('complete') || r.fullyCompleted || (r.status || '').toLowerCase().includes('completed') || (r.status || '').toLowerCase().includes('closed');

    let matchesTab = false;
    if (subTab === 'all' || subTab === 'all boms') {
      matchesTab = true;
    } else if (subTab === 'pendingprint') {
      matchesTab = !isPrinted && !r.cancelled && !isClosedOrDone;
    } else if (subTab === 'printed') {
      matchesTab = isPrinted && !r.cancelled && !isClosedOrDone;
    } else if (subTab === 'addressaction') {
      matchesTab = Boolean(r.addressProofReuploadRequested || rStatus.includes('address proof'));
    } else if (subTab.includes('closed') || subTab.includes('complete')) {
      matchesTab = Boolean(isClosedOrDone);
    } else if (subTab.includes('cancel')) {
      matchesTab = Boolean(rStatus.includes('cancel') || r.cancelled);
    } else if (subTab === 'draft' || (subTab.includes('draft') && !subTab.includes('pending'))) {
      matchesTab = Boolean(rStatus.includes('draft') && !r.cancelled);
    } else if (subTab.includes('pending')) {
      matchesTab = Boolean((rStatus.includes('pending') || rStatus.includes('draft')) && !r.cancelled);
    } else if (subTab.includes('sent')) {
      matchesTab = Boolean((rTabGroup === 'sent' || rStatus.includes('sent') || rStatus.includes('confirm') || rStatus.includes('production')) && !r.cancelled);
    } else {
      matchesTab = rTabGroup === subTab;
    }

    // Date range filter matching
    let matchesDate = true;
    const rDateStr = r.c2 || r.date || r.createdAt || r.bomDate;
    if (rDateStr && (filterDateVal || filterEndDateVal)) {
      const rIso = String(rDateStr).substring(0, 10);
      if (filterDateVal && rIso < filterDateVal) matchesDate = false;
      if (filterEndDateVal && rIso > filterEndDateVal) matchesDate = false;
    }

    return matchesSearch && matchesTab && matchesDate;
  });

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
        const multiplier = parseInt(String(grp.setCount).replace(/[^0-9]/g, ''), 10) || 1;
        kitSubtotal += (unitPrice * multiplier);
      } else if (grpId === 'legacy_default') {
        const unitPrice = (selectedPreset && presetKitPrice !== '') ? cleanNum(presetKitPrice, 0) : 0;
        const multiplier = parseInt(String(presetSetCount).replace(/[^0-9]/g, ''), 10) || 1;
        kitSubtotal += (unitPrice * multiplier);
      }
    });

    // 2. Individual items subtotal (exclude preset items because their cost is in kitSubtotal)
    const itemsSub = (bomMaterialsList || []).reduce((acc, item) => {
      if (item.isPresetItem) return acc;
      const q = cleanNum(item.qty, 0);
      const r = cleanNum(item.rate, 0);
      return acc + (q * r);
    }, 0);

    const sub = itemsSub + kitSubtotal;
    const disc = 0;

    // 3. GST: Custom item GSTs + Preset kits GST (dynamically from each preset's selected gstRate)
    const itemsGst = (bomMaterialsList || []).reduce((acc, item) => {
      if (item.isPresetItem) return acc;
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
        const multiplier = parseInt(String(grp.setCount).replace(/[^0-9]/g, ''), 10) || 1;
        groupTotal = unitPrice * multiplier;
      } else if (grpId === 'legacy_default') {
        const unitPrice = (selectedPreset && presetKitPrice !== '') ? cleanNum(presetKitPrice, 0) : 0;
        const multiplier = parseInt(String(presetSetCount).replace(/[^0-9]/g, ''), 10) || 1;
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

  // Helper to render Document Preview Modal consistently across all views & forms
  const renderDocPreviewModal = () => {
    if (!previewDocModal) return null;
    const rawDoc = previewDocModal.doc;
    const docTitle = previewDocModal.title || 'Document Preview';
    const docName = typeof rawDoc === 'string' ? rawDoc : (rawDoc?.name || 'Uploaded File');

    let resolvedData = null;
    const isCleanStr = (s) => typeof s === 'string' && s && !s.startsWith('blob:');
    if (typeof rawDoc === 'string') {
      if (rawDoc.startsWith('blob:')) {
        resolvedData = null;
      } else if (rawDoc.startsWith('data:') || rawDoc.startsWith('http://') || rawDoc.startsWith('https://') || rawDoc.startsWith('/uploads/') || rawDoc.startsWith('/api/uploads/')) {
        resolvedData = rawDoc;
      } else {
        const cached = getMediaFromCache(rawDoc);
        resolvedData = cached || null;
      }
    } else if (rawDoc && typeof rawDoc === 'object') {
      const u = isCleanStr(rawDoc.url) ? rawDoc.url : null;
      const d = isCleanStr(rawDoc.dataUrl) ? rawDoc.dataUrl : null;
      const prevUrl = (isCleanStr(rawDoc.previewUrl) || (rawDoc._rawFile && rawDoc.previewUrl)) ? rawDoc.previewUrl : null;
      const f = isCleanStr(rawDoc.fileData) ? rawDoc.fileData : null;
      const p = isCleanStr(rawDoc.proofDocData) ? rawDoc.proofDocData : null;
      const c1 = rawDoc.name ? getMediaFromCache(rawDoc.name) : null;
      const c2 = rawDoc.id ? getMediaFromCache(rawDoc.id) : null;
      const cacheVal = c1 || c2 || null;
      const directResolved = rawDoc ? resolveDocumentUrl(rawDoc) : null;

      resolvedData = d || u || prevUrl || f || p || cacheVal || directResolved;
      if (resolvedData && typeof resolvedData === 'string' && resolvedData.startsWith('/uploads/')) {
        resolvedData = `/api${resolvedData}`;
      }
      if (!resolvedData && rawDoc._rawFile && (rawDoc._rawFile instanceof Blob || rawDoc._rawFile instanceof File)) {
        try {
          resolvedData = URL.createObjectURL(rawDoc._rawFile);
        } catch (e) { }
      }
      if (!resolvedData && (rawDoc instanceof Blob || rawDoc instanceof File)) {
        try {
          resolvedData = URL.createObjectURL(rawDoc);
        } catch (e) { }
      }
    }

    // Resolve private Supabase Storage documents via secure signed URLs
    if (!resolvedData && rawDoc && typeof rawDoc === 'object' && (rawDoc.storageBucket || rawDoc.storagePath) && !rawDoc._fetchingStorage) {
      if (typeof rawDoc === 'object') rawDoc._fetchingStorage = true;
      const bCode = previewDocModal.bomCode || rawDoc.bomCode || (rawDoc.storagePath ? rawDoc.storagePath.split('/')[0] : null);
      resolveDocumentUrlAsync(rawDoc, bCode)
        .then(url => {
          if (url) {
            const cleanUrl = url.startsWith('/uploads/') ? `/api${url}` : url;
            setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, url: cleanUrl, dataUrl: cleanUrl, _fetchingStorage: false } } : null);
          } else {
            if (typeof rawDoc === 'object') rawDoc._fetchingStorageDone = true;
            setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, _fetchingStorage: false, _fetchingStorageDone: true } } : null);
          }
        })
        .catch(() => {
          if (typeof rawDoc === 'object') rawDoc._fetchingStorageDone = true;
          setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, _fetchingStorage: false, _fetchingStorageDone: true } } : null);
        });
    }

    // Auto-fetch from server if not found in local memory/IndexedDB
    if (!resolvedData && docName && typeof window !== 'undefined') {
      const isMediaFile = /\.(mp4|webm|mov|mkv|avi|jpg|jpeg|png|webp|gif|pdf)($|\?)/i.test(docName);
      if (isMediaFile && !rawDoc?._fetchingServer && !rawDoc?._fetchingServerDone) {
        if (typeof rawDoc === 'object' && rawDoc) rawDoc._fetchingServer = true;
        fetch(`/api/media/find/${encodeURIComponent(docName)}`)
          .then(r => r.json())
          .then(data => {
            if (data?.found && data?.url) {
              const cleanUrl = data.url.startsWith('/uploads/') ? `/api${data.url}` : data.url;
              saveMediaToCache(docName, cleanUrl);
              setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, url: cleanUrl, dataUrl: cleanUrl, _fetchingServer: false } } : null);
            } else {
              const fallbackUrl = `/api/uploads/${encodeURIComponent(docName)}`;
              setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, url: fallbackUrl, dataUrl: fallbackUrl, _fetchingServer: false, _fetchingServerDone: true } } : null);
            }
          })
          .catch(() => {
            const fallbackUrl = `/api/uploads/${encodeURIComponent(docName)}`;
            setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, url: fallbackUrl, dataUrl: fallbackUrl, _fetchingServer: false, _fetchingServerDone: true } } : null);
          });
      }
    }

    const isImg = Boolean(
      resolvedData && (
        resolvedData.startsWith('data:image/') ||
        rawDoc?.type?.startsWith('image/') ||
        /\.(jpg|jpeg|png|webp|gif|bmp|svg)($|\?)/i.test(docName) ||
        /\.(jpg|jpeg|png|webp|gif|bmp|svg)($|\?)/i.test(resolvedData)
      )
    );

    const isVid = Boolean(
      (resolvedData && (
        resolvedData.startsWith('data:video/') ||
        rawDoc?.type?.startsWith('video/') ||
        /\.(mp4|webm|mov|mkv|avi)($|\?)/i.test(docName) ||
        /\.(mp4|webm|mov|mkv|avi)($|\?)/i.test(resolvedData)
      )) ||
      rawDoc?.type?.startsWith('video/') ||
      /\.(mp4|webm|mov|mkv|avi)($|\?)/i.test(docName)
    );

    return (
      <div
        onClick={() => setPreviewDocModal(null)}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15,23,42,0.75)',
          backdropFilter: 'blur(3px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
            border: '1px solid #E2E8F0'
          }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>{docTitle}</h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B', wordBreak: 'break-all' }}>{docName}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {resolvedData && (
                <a
                  href={resolvedData}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={docName || 'document'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#0E7490',
                    backgroundColor: '#ECFEFF',
                    border: '1px solid #A5F3FC',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={13} /> Open / Download
                </a>
              )}
              <button
                onClick={() => setPreviewDocModal(null)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '8px' }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '340px', backgroundColor: '#0F172A' }}>
            {!resolvedData ? (
              rawDoc?._fetchingServer && !rawDoc?._fetchingServerDone ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
                  <div style={{ width: '36px', height: '36px', border: '3px solid #0E7490', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 14px', animation: 'spin 0.8s linear infinite' }} />
                  <p style={{ fontSize: '14px', fontWeight: '800', margin: 0, color: '#F1F5F9' }}>Loading visual preview from server...</p>
                  <p style={{ fontSize: '12px', marginTop: '6px', color: '#94A3B8' }}>{docName}</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '36px 20px', color: '#94A3B8', maxWidth: '480px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: 'rgba(14,116,144,0.15)', color: '#38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    {isVid ? <Video size={28} /> : <FileText size={28} />}
                  </div>
                  <h4 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: '#F1F5F9' }}>Dispatch Packing Proof Attached</h4>
                  <p style={{ fontSize: '12px', marginTop: '8px', color: '#CBD5E1', lineHeight: '1.5' }}>
                    This {isVid ? 'video' : 'photo'} was registered by Dispatch Fulfillment Team during packing verification.
                  </p>
                  <div style={{ marginTop: '16px', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '10px', fontSize: '11px', color: '#94A3B8', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div><strong style={{ color: '#E2E8F0' }}>File:</strong> {docName}</div>
                    {rawDoc?.size && <div><strong style={{ color: '#E2E8F0' }}>Size:</strong> {rawDoc.size}</div>}
                    {rawDoc?.uploadedAt && <div><strong style={{ color: '#E2E8F0' }}>Time:</strong> {rawDoc.uploadedAt}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      fetch(`/api/media/find/${encodeURIComponent(docName)}`)
                        .then(r => r.json())
                        .then(data => {
                          if (data?.found && data?.url) {
                            saveMediaToCache(docName, data.url);
                            setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, url: data.url, dataUrl: data.url } } : null);
                          } else {
                            alert(`File "${docName}" is attached to the BOM packing record. For visual playback, please ensure the dispatch device has synced with the server.`);
                          }
                        }).catch(() => {});
                    }}
                    style={{
                      marginTop: '16px', backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none',
                      padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer'
                    }}
                  >
                    Retry Server Lookup
                  </button>
                </div>
              )
            ) : isImg ? (
              <img
                src={resolvedData}
                alt={docName}
                onError={(e) => {
                  if (!e.currentTarget.dataset.retried && docName) {
                    e.currentTarget.dataset.retried = 'true';
                    fetch(`/api/media/find/${encodeURIComponent(docName)}`)
                      .then(r => r.json())
                      .then(data => {
                        if (data?.found && data?.url) {
                          const cleanUrl = data.url.startsWith('/uploads/') ? `/api${data.url}` : data.url;
                          saveMediaToCache(docName, cleanUrl);
                          setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, url: cleanUrl, dataUrl: cleanUrl } } : null);
                        } else if (!e.currentTarget.src.includes('/api/uploads/')) {
                          e.currentTarget.src = `/api/uploads/${encodeURIComponent(docName)}`;
                        }
                      }).catch(() => {
                        if (!e.currentTarget.src.includes('/api/uploads/')) {
                          e.currentTarget.src = `/api/uploads/${encodeURIComponent(docName)}`;
                        }
                      });
                  }
                }}
                style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.5)' }}
              />
            ) : isVid ? (
              <video
                controls
                autoPlay
                playsInline
                src={resolvedData}
                onError={(e) => {
                  if (!e.currentTarget.dataset.retried && docName) {
                    e.currentTarget.dataset.retried = 'true';
                    fetch(`/api/media/find/${encodeURIComponent(docName)}`)
                      .then(r => r.json())
                      .then(data => {
                        if (data?.found && data?.url) {
                          const cleanUrl = data.url.startsWith('/uploads/') ? `/api${data.url}` : data.url;
                          saveMediaToCache(docName, cleanUrl);
                          setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, url: cleanUrl, dataUrl: cleanUrl } } : null);
                        } else if (!e.currentTarget.src.includes('/api/uploads/')) {
                          e.currentTarget.src = `/api/uploads/${encodeURIComponent(docName)}`;
                        }
                      }).catch(() => {
                        if (!e.currentTarget.src.includes('/api/uploads/')) {
                          e.currentTarget.src = `/api/uploads/${encodeURIComponent(docName)}`;
                        }
                      });
                  }
                }}
                style={{ maxWidth: '100%', maxHeight: '68vh', borderRadius: '8px', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.5)' }}
              >
                Your browser does not support playing this video.
              </video>
            ) : (
              <iframe
                src={resolvedData}
                title={docName}
                style={{ width: '100%', height: '580px', border: 'none', borderRadius: '8px', backgroundColor: '#FFFFFF' }}
              />
            )}
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              {rawDoc?.size ? `Size: ${rawDoc.size}` : ''}
            </span>
            <button
              onClick={() => setPreviewDocModal(null)}
              style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', color: '#334155', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Helper to render Validation Error Modal consistently
  const renderValidationErrorModal = () => {
    if (!validationErrorModal) return null;
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
        <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', width: '460px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', flexShrink: 0 }}>
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>Mandatory Fields Required</h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>Please complete all required fields to move forward.</p>
            </div>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>You did not fill out the following mandatory box(es):</span>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#DC2626', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(validationErrorModal.fields || []).map((field, idx) => (
                <li key={idx}><strong>{field}</strong></li>
              ))}
            </ul>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              onClick={() => {
                const targetId = validationErrorModal.firstTargetId;
                setValidationErrorModal(null);
                if (targetId) {
                  setTimeout(() => {
                    const el = document.getElementById(targetId);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.focus?.();
                    }
                  }, 100);
                }
              }}
              style={{ backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)' }}
            >
              OK, I'll fill it
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Helper to render Export Format Selector Modal (PDF / JPG / CSV) + hidden canvas
  const renderExportFormatModal = () => {
    if (!exportFormatRecord) return null;
    return (
      <>
        {/* EXPORT FORMAT SELECTOR MODAL (PDF / JPG / CSV) */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => !isExportingFormat && setExportFormatRecord(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden',
              border: '1px solid #E2E8F0'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(to right, #F8FAFC, #FFFFFF)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: '#ECFEFF',
                    border: '1px solid #CFFAFE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Download size={20} style={{ color: '#0E7490' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0F172A' }}>
                    Select Export Format
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                    {exportFormatRecord.bomCode || exportFormatRecord.code || 'BOM Order'} • Choose your required format
                  </p>
                </div>
              </div>
              <button
                disabled={Boolean(isExportingFormat)}
                onClick={() => setExportFormatRecord(null)}
                style={{
                  border: 'none',
                  backgroundColor: '#F1F5F9',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isExportingFormat ? 'not-allowed' : 'pointer',
                  color: '#64748B'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Format Options */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* PDF Option */}
              <div
                onClick={() => !isExportingFormat && handleExportAsPdf(exportFormatRecord)}
                style={{
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  cursor: isExportingFormat ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isExportingFormat === 'pdf' ? '#EFF6FF' : '#FFFFFF',
                  borderColor: isExportingFormat === 'pdf' ? '#3B82F6' : '#E2E8F0',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FEE2E2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <FileText size={24} style={{ color: '#DC2626' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>PDF Document</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#FEE2E2', color: '#B91C1C' }}>.pdf</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B', lineHeight: '1.4' }}>
                      Official printable A4 document with complete specifications, items, and authorized signature.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(isExportingFormat)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: isExportingFormat ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isExportingFormat === 'pdf' ? (
                    <>
                      <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    'Export PDF'
                  )}
                </button>
              </div>

              {/* JPG Option */}
              <div
                onClick={() => !isExportingFormat && handleExportAsJpg(exportFormatRecord)}
                style={{
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  cursor: isExportingFormat ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isExportingFormat === 'jpg' ? '#EFF6FF' : '#FFFFFF',
                  borderColor: isExportingFormat === 'jpg' ? '#3B82F6' : '#E2E8F0',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      backgroundColor: '#EEF2FF',
                      border: '1px solid #E0E7FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <ImageIcon size={24} style={{ color: '#4F46E5' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>JPG Image</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#E0E7FF', color: '#4338CA' }}>.jpg</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B', lineHeight: '1.4' }}>
                      High-resolution graphic image formatted for instant mobile viewing, WhatsApp, and chat.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(isExportingFormat)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: isExportingFormat ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isExportingFormat === 'jpg' ? (
                    <>
                      <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    'Export JPG'
                  )}
                </button>
              </div>

              {/* CSV Option */}
              <div
                onClick={() => {
                  if (isExportingFormat) return;
                  handleExportBomCsv(exportFormatRecord);
                  setExportFormatRecord(null);
                }}
                style={{
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  cursor: isExportingFormat ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#FFFFFF',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      backgroundColor: '#ECFDF5',
                      border: '1px solid #D1FAE5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <FileSpreadsheet size={24} style={{ color: '#059669' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>CSV Spreadsheet</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#D1FAE5', color: '#047857' }}>.csv</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B', lineHeight: '1.4' }}>
                      Structured tabular spreadsheet with item breakdown, GST, pricing, and customer metadata.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(isExportingFormat)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: isExportingFormat ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  Export CSV
                </button>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #F1F5F9',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center'
              }}
            >
              <button
                type="button"
                disabled={Boolean(isExportingFormat)}
                onClick={() => setExportFormatRecord(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: isExportingFormat ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Hidden offscreen sheet for high-res PDF / JPG rasterization */}
        <div
          id="bom-export-hidden-target"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '880px',
            backgroundColor: '#FFFFFF',
            pointerEvents: 'none',
            zIndex: -9999
          }}
        >
          <VRMBomPrintSheet bomData={exportFormatRecord} id="export-sheet-hidden-canvas" />
        </div>
      </>
    );
  };

  // Helper to render Full-Screen Loading Animation during BOM creation to prevent duplicate clicks
  const renderBomSubmittingOverlay = () => {
    if (!isSubmittingBom) return null;

    const isDraft = bomConfirmModal === 'draft';
    const currentStepIndex =
      bomSubmitStage === 'completed' ? 4 :
      bomSubmitStage === 'saving' ? 3 :
      bomSubmitStage === 'reserving' ? 2 : 1;

    const progressPct =
      bomSubmitStage === 'completed' ? 100 :
      bomSubmitStage === 'saving' ? 88 :
      bomSubmitStage === 'reserving' ? 60 : 25;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.78)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '20px'
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '36px 32px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Top Accent Animated Gradient Line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '5px',
              background: 'linear-gradient(90deg, #0E7490, #06B6D4, #3B82F6, #10B981, #0E7490)',
              backgroundSize: '200% 100%',
              animation: 'shimmerSweep 2s linear infinite'
            }}
          />

          {/* 3D Isometric Animation Styles */}
          <style>{`
            @keyframes isoFloatBottom {
              0%, 100% { transform: translateY(0px) translateZ(0px); }
              50% { transform: translateY(-4px) translateZ(4px); }
            }
            @keyframes isoFloatMiddle {
              0%, 100% { transform: translateY(0px) translateZ(24px); }
              50% { transform: translateY(-7px) translateZ(32px); }
            }
            @keyframes isoFloatTop {
              0%, 100% { transform: translateY(0px) translateZ(48px); }
              50% { transform: translateY(-11px) translateZ(60px); }
            }
            @keyframes isoPulseRing {
              0% { transform: scale(0.65); opacity: 0.85; }
              100% { transform: scale(1.6); opacity: 0; }
            }
            @keyframes isoScanBeam {
              0% { transform: translateX(-100%) rotate(45deg); opacity: 0; }
              30% { opacity: 0.55; }
              70% { opacity: 0.55; }
              100% { transform: translateX(200%) rotate(45deg); opacity: 0; }
            }
          `}</style>

          {/* Smallcase-Inspired 3D Isometric Progress Indicator */}
          <div style={{
            perspective: '750px',
            perspectiveOrigin: '50% 35%',
            width: '160px',
            height: '135px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            marginBottom: '10px'
          }}>
            {/* Ground Shadow */}
            <div style={{
              position: 'absolute',
              bottom: '12px',
              width: '110px',
              height: '52px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(14, 116, 144, 0.35) 0%, rgba(6, 182, 212, 0.08) 55%, transparent 75%)',
              filter: 'blur(7px)',
              transform: 'rotateX(58deg)',
              animation: 'pulseGlow 2.5s ease-in-out infinite'
            }} />

            {/* 3D Isometric Stack Container */}
            <div style={{
              position: 'relative',
              width: '90px',
              height: '90px',
              transformStyle: 'preserve-3d',
              transform: 'rotateX(58deg) rotateZ(-38deg)'
            }}>
              {/* Base Layer Plate */}
              <div style={{
                position: 'absolute',
                width: '90px',
                height: '90px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.25) 0%, rgba(6, 182, 212, 0.1) 100%)',
                border: '1.5px solid rgba(14, 116, 144, 0.45)',
                boxShadow: '0 8px 24px rgba(14, 116, 144, 0.25), inset 0 0 14px rgba(6, 182, 212, 0.15)',
                backdropFilter: 'blur(4px)',
                transformStyle: 'preserve-3d',
                animation: 'isoFloatBottom 3s ease-in-out infinite'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: '7px',
                  borderRadius: '12px',
                  border: '1px dashed rgba(14, 116, 144, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: '1.5px solid rgba(6, 182, 212, 0.6)',
                    animation: 'isoPulseRing 2s ease-out infinite'
                  }} />
                </div>
              </div>

              {/* Middle Floating Plate */}
              <div style={{
                position: 'absolute',
                top: '9px',
                left: '9px',
                width: '72px',
                height: '72px',
                borderRadius: '15px',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.38) 0%, rgba(59, 130, 246, 0.18) 100%)',
                border: '1.5px solid rgba(6, 182, 212, 0.65)',
                boxShadow: '0 10px 24px rgba(6, 182, 212, 0.28), inset 0 0 12px rgba(255, 255, 255, 0.25)',
                transformStyle: 'preserve-3d',
                animation: 'isoFloatMiddle 3s ease-in-out infinite',
                animationDelay: '0.2s',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent)',
                  animation: 'isoScanBeam 2.4s ease-in-out infinite'
                }} />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '7px',
                    border: '1.5px solid rgba(255,255,255,0.65)',
                    transform: 'rotate(45deg)'
                  }} />
                </div>
              </div>

              {/* Top Apex Plate with Glowing Symbol */}
              <div style={{
                position: 'absolute',
                top: '18px',
                left: '18px',
                width: '54px',
                height: '54px',
                borderRadius: '13px',
                background: bomSubmitStage === 'completed'
                  ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #0E7490 0%, #06B6D4 100%)',
                border: '2px solid #FFFFFF',
                boxShadow: '0 14px 30px rgba(14, 116, 144, 0.45), 0 0 18px rgba(6, 182, 212, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                transformStyle: 'preserve-3d',
                animation: 'isoFloatTop 3s ease-in-out infinite',
                animationDelay: '0.4s'
              }}>
                {bomSubmitStage === 'completed' ? (
                  <CheckCircle size={26} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }} />
                ) : (
                  <Layers size={22} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }} />
                )}
              </div>
            </div>
          </div>

          {/* Header Badge */}
          <div style={{
            fontSize: '11px',
            fontWeight: '800',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: '#0E7490',
            backgroundColor: '#ECFEFF',
            padding: '4px 12px',
            borderRadius: '20px',
            marginBottom: '10px'
          }}>
            {bomSubmitStage === 'completed' ? 'Success • Complete' : 'Processing BOM Order'}
          </div>

          {/* Title */}
          <h3 style={{
            fontSize: '20px',
            fontWeight: '800',
            color: '#0F172A',
            margin: '0 0 6px 0',
            letterSpacing: '-0.3px'
          }}>
            {bomSubmitStage === 'completed'
              ? 'BOM Created Successfully!'
              : (isDraft ? 'Saving Draft BOM...' : 'Creating Bill of Materials...')}
          </h3>

          {/* Description */}
          <p style={{
            fontSize: '13px',
            color: '#64748B',
            margin: '0 0 20px 0',
            lineHeight: '1.5',
            maxWidth: '360px'
          }}>
            {bomSubmitStage === 'completed'
              ? `Official BOM (${bomSubmitAssignedCode || 'Saved'}) registered and dispatched.`
              : 'Please wait while we assign sequential code, reserve inventory, and sync records.'}
          </p>

          {/* Real-time Checklist Cards */}
          <div
            style={{
              width: '100%',
              backgroundColor: '#F8FAFC',
              borderRadius: '14px',
              border: '1px solid #E2E8F0',
              padding: '14px 16px',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              textAlign: 'left'
            }}
          >
            {/* Step 1 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px' }}>
              {currentStepIndex === 1 ? (
                <Loader size={16} style={{ color: '#0E7490', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              ) : currentStepIndex > 1 ? (
                <CheckCircle size={16} style={{ color: '#10B981', flexShrink: 0 }} />
              ) : (
                <Clock size={16} style={{ color: '#94A3B8', flexShrink: 0 }} />
              )}
              <span style={{
                fontWeight: currentStepIndex === 1 ? '700' : '500',
                color: currentStepIndex === 1 ? '#0E7490' : (currentStepIndex > 1 ? '#0F172A' : '#64748B')
              }}>
                {bomSubmitAssignedCode ? `Sequential Code Assigned: ${bomSubmitAssignedCode}` : 'Assigning Sequential BOM Code...'}
              </span>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px' }}>
              {currentStepIndex === 2 ? (
                <Loader size={16} style={{ color: '#0E7490', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              ) : currentStepIndex > 2 ? (
                <CheckCircle size={16} style={{ color: '#10B981', flexShrink: 0 }} />
              ) : (
                <Clock size={16} style={{ color: '#94A3B8', flexShrink: 0 }} />
              )}
              <span style={{
                fontWeight: currentStepIndex === 2 ? '700' : '500',
                color: currentStepIndex === 2 ? '#0E7490' : (currentStepIndex > 2 ? '#0F172A' : '#64748B')
              }}>
                Reserving Inventory Items & Raw Materials...
              </span>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px' }}>
              {currentStepIndex === 3 ? (
                <Loader size={16} style={{ color: '#0E7490', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              ) : currentStepIndex > 3 ? (
                <CheckCircle size={16} style={{ color: '#10B981', flexShrink: 0 }} />
              ) : (
                <Clock size={16} style={{ color: '#94A3B8', flexShrink: 0 }} />
              )}
              <span style={{
                fontWeight: currentStepIndex === 3 ? '700' : '500',
                color: currentStepIndex === 3 ? '#0E7490' : (currentStepIndex > 3 ? '#0F172A' : '#64748B')
              }}>
                Syncing with Cloud Database & Dispatch System...
              </span>
            </div>
          </div>

          {/* Smooth Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#E2E8F0',
              borderRadius: '10px',
              overflow: 'hidden',
              position: 'relative',
              marginBottom: '16px'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPct}%`,
                backgroundColor: currentStepIndex >= 4 ? '#10B981' : '#0E7490',
                borderRadius: '10px',
                transition: 'width 0.4s ease-in-out, background-color 0.3s ease'
              }}
            />
          </div>

          {/* Warning Banner Against Multiple Clicks */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11.5px',
              color: '#B45309',
              backgroundColor: '#FEF3C7',
              border: '1px solid #FDE68A',
              padding: '8px 14px',
              borderRadius: '10px',
              lineHeight: '1.4'
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, color: '#D97706' }} />
            <span><strong>Please do not click again or refresh.</strong> Your order is being safely saved to prevent duplicates.</span>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // RENDER 1: FULL CREATE BOM FORM
  // ==========================================
  if (showBOMForm) {
    const handleAddMaterialRow = () => {
      setBomMaterialsList(prev => [...(prev || []), { name: '', category: '', uom: 'NOS', qty: '1', wastage: '0%', rate: '', gstRate: '18%' }]);
    };

    const handleAddPresetToOrder = (presetId, targetPreset, setsCount) => {
      if (!targetPreset || !targetPreset.items || targetPreset.items.length === 0) return;
      const groupId = 'preset_grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const multiplier = Math.max(1, parseInt(setsCount) || 1);

      let defaultPrice = '';
      if (targetPreset.price || targetPreset.rate) {
        defaultPrice = String(targetPreset.price || targetPreset.rate);
      } else {
        const origSum = targetPreset.items.reduce((acc, it) => acc + (parseFloat(it.qty || 1) * parseFloat(it.rate || 0)), 0);
        defaultPrice = origSum > 0 ? String(origSum) : '';
      }

      const presetName = targetPreset.label || presetId;
      const isDcrBosKit = targetPreset.category === 'DCR BOS Solar Kits' || targetPreset.category === 'BOS Solar Kits' || (targetPreset.label && targetPreset.label.includes('BOS KITS'));
      const initialGstRate = isDcrBosKit ? '5%' : (targetPreset.gstRate || targetPreset.gst || '18%');

      setPresetGroups(prev => ({
        ...prev,
        [groupId]: {
          groupId,
          presetId,
          presetName,
          setCount: multiplier,
          kitPrice: defaultPrice,
          gstRate: initialGstRate
        }
      }));

      const isFixedKit = isFixedQuantityPreset(presetId, targetPreset.label || presetName);
      const newItems = targetPreset.items.map(it => {
        const baseQ = parseFloat(it.qty) || 1;
        const matchedCatalog = (itemsList || []).find(ci => ci.name && ci.name.toLowerCase().trim() === String(it.name || '').toLowerCase().trim()) || (VRM_PRODUCTS || []).find(vp => vp.name && vp.name.toLowerCase().trim() === String(it.name || '').toLowerCase().trim());
        const resolvedCode = it.code || (matchedCatalog ? matchedCatalog.code : '');
        return {
          ...it,
          code: resolvedCode,
          presetGroupId: groupId,
          presetName,
          baseQty: baseQ,
          qty: isFixedKit ? String(baseQ) : String(Math.round(baseQ * multiplier)),
          rate: '0',
          gstRate: isDcrBosKit ? '5%' : (it.gstRate || initialGstRate),
          isPresetItem: true
        };
      });

      setBomMaterialsList(prev => [...(prev || []), ...newItems]);
      setSelectedPreset('');
      setPresetSetCount(1);
    };

    const handleRemovePresetGroup = (groupId) => {
      setBomMaterialsList(prev => (prev || []).filter(item => (item.presetGroupId || 'legacy_default') !== groupId));
      setPresetGroups(prev => {
        const updated = { ...prev };
        delete updated[groupId];
        return updated;
      });
    };

    const handleRemoveMaterialRow = (idx) => {
      const itemToRemove = bomMaterialsList[idx];
      setBomMaterialsList(prev => {
        const updated = (prev || []).filter((_, i) => i !== idx);
        if (itemToRemove && itemToRemove.presetGroupId) {
          const remainingInGroup = updated.filter(it => it.presetGroupId === itemToRemove.presetGroupId);
          if (remainingInGroup.length === 0) {
            setPresetGroups(pgPrev => {
              const c = { ...pgPrev };
              delete c[itemToRemove.presetGroupId];
              return c;
            });
          }
        }
        return updated;
      });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>
        {/* Top Page Title Bar with Action Buttons */}
        <div style={{
          background: 'linear-gradient(135deg, #075985 0%, #0E7490 50%, #0891B2 100%)',
          borderRadius: '18px',
          padding: '24px 28px',
          color: '#FFFFFF',
          boxShadow: '0 10px 25px -5px rgba(14, 116, 144, 0.4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart style={{ width: '24px', height: '24px', color: '#FFFFFF' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
                  Create Sales Bill of Materials (BOM)
                </h1>
                {newBomSourcePiNo && (
                  <span style={{
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.4)',
                    padding: '3px 12px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: '800',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}>
                    <FileText size={12} /> Converted from PI: {newBomSourcePiNo}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '13px', color: '#CFFAFE', margin: '4px 0 0 0' }}>
                {newBomSourcePiNo
                  ? `Imported from Proforma Invoice (${newBomSourcePiNo}). Verify order details & forward to Dispatch.`
                  : 'Configure customer order, specify delivery destination, upload document proofs, & compile BOM preset items'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              disabled={isSubmittingBom}
              onClick={() => setBomConfirmModal('cancel')}
              style={{ border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', color: '#FFFFFF', cursor: isSubmittingBom ? 'not-allowed' : 'pointer', opacity: isSubmittingBom ? 0.6 : 1, backdropFilter: 'blur(4px)' }}
            >
              Cancel
            </button>
            <button
              disabled={isSubmittingBom}
              onClick={() => {
                if (isSubmittingBom) return;
                const validation = validateBomForm(true);
                if (!validation.isValid) {
                  setValidationErrorModal({
                    fields: validation.missingList.map(m => typeof m === 'object' ? m.field : m),
                    firstTargetId: validation.missingList[0]?.targetId
                  });
                  return;
                }
                setBomConfirmModal('draft');
              }}
              style={{ border: 'none', background: '#FFFFFF', color: '#0E7490', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: isSubmittingBom ? 'not-allowed' : 'pointer', opacity: isSubmittingBom ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            >
              <FileText style={{ width: '15px', height: '15px' }} />
              Save as Draft
            </button>
            <button
              disabled={isSubmittingBom}
              onClick={() => {
                if (isSubmittingBom) return;
                const validation = validateBomForm(false);
                if (!validation.isValid) {
                  setValidationErrorModal({
                    fields: validation.missingList.map(m => typeof m === 'object' ? m.field : m),
                    firstTargetId: validation.missingList[0]?.targetId
                  });
                  return;
                }
                setBomConfirmModal('create');
              }}
              style={{ border: 'none', background: '#10B981', color: 'white', padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: '900', cursor: isSubmittingBom ? 'not-allowed' : 'pointer', opacity: isSubmittingBom ? 0.6 : 1, boxShadow: '0 4px 14px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <CheckCircle style={{ width: '16px', height: '16px' }} />
              Create Order →
            </button>
          </div>
        </div>

        {/* SECTION 1: ORDER INFORMATION */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              1
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ORDER INFORMATION
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div>
              <label htmlFor="bom-orders-order-date" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Order Date</label>
              <input id="bom-orders-order-date" name="orderDate" aria-label="Order Date"
                type="date"
                value={new Date().toISOString().split('T')[0]}
                disabled
                readOnly
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#64748B', backgroundColor: '#F1F5F9', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="field-newBomDeliveryDate" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Delivery Date <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input name="deliveryDate" aria-label="Delivery Date"
                id="field-newBomDeliveryDate"
                type="date"
                min={new Date().toISOString().split('T')[0]}
                placeholder="Select date"
                value={newBomDeliveryDate}
                onChange={(e) => {
                  setNewBomDeliveryDate(e.target.value);
                  setFormErrors(prev => ({ ...prev, deliveryDate: null }));
                }}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: formErrors.deliveryDate ? '2px solid #EF4444' : '1px solid #E2E8F0',
                  backgroundColor: formErrors.deliveryDate ? '#FEF2F2' : 'white',
                  boxShadow: formErrors.deliveryDate ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none',
                  padding: '0 14px',
                  fontSize: '13px',
                  color: '#0F172A',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
               />
              {formErrors.deliveryDate && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#DC2626', fontSize: '11px', fontWeight: '700', marginTop: '4px' }}>
                  <AlertCircle size={12} /> {formErrors.deliveryDate}
                </span>
              )}
            </div>
            <div>
              <label htmlFor="bom-orders-order-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Order Number</label>
              <input id="bom-orders-order-number" name="orderNumber" aria-label="Order Number"
                type="text"
                value="Auto-Assigned"
                readOnly
                disabled
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CFFAFE', padding: '0 14px', fontSize: '13px', fontWeight: '700', color: '#0E7490', backgroundColor: '#F0FDFA', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="bom-orders-sales-person-creator" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '6px' }}>
                Sales Person / Creator <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input id="bom-orders-sales-person-creator" name="salesPersonCreator" aria-label="Sales Person / Creator"
                type="text"
                readOnly
                disabled
                value={newBomSalesPerson || defaultSalesPersonName}
                title="Creator name is tied to the logged-in account and cannot be modified"
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  padding: '0 14px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#475569',
                  backgroundColor: '#F1F5F9',
                  cursor: 'not-allowed',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
               />
            </div>
          </div>
        </div>

        {/* SECTION 2: CUSTOMER INFORMATION & ADDRESSES */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              2
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              CUSTOMER INFORMATION
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="field-newBomProductName" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Customer Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input name="customerName" aria-label="Customer Name"
                id="field-newBomProductName"
                type="text"
                list="bom-customer-name-suggestions"
                placeholder="Type or select customer from list..."
                value={newBomProductName}
                onChange={(e) => {
                  const val = e.target.value;
                  setNewBomProductName(val);
                  setFormErrors(prev => ({ ...prev, customerName: null }));
                  const target = (val || '').toLowerCase().trim();
                  if (!target) return;

                  // Phase B4: Debounced server search as user types
                  if (target.length >= 2) {
                    if (bomCustSearchTimerRef.current) clearTimeout(bomCustSearchTimerRef.current);
                    bomCustSearchTimerRef.current = setTimeout(async () => {
                      try {
                        const matches = await searchCustomers({ query: val, limit: 50 });
                        if (Array.isArray(matches) && matches.length > 0) {
                          setCustomerList(prev => {
                            const map = new Map();
                            (prev || []).forEach(p => {
                              const k = (p.customerCode || p.id || p.code || p.companyName || '').toLowerCase().trim();
                              if (k) map.set(k, p);
                            });
                            matches.forEach(m => {
                              const k = (m.customerCode || m.id || m.code || m.companyName || '').toLowerCase().trim();
                              if (k && !map.has(k)) map.set(k, m);
                            });
                            return Array.from(map.values());
                          });
                        }
                      } catch (_) {}
                    }, 250);
                  }

                  const chosen = customerList.find(c => {
                    const code = (c.code || c.customerCode || '').toLowerCase().trim();
                    const c2 = (c.c2 || c.companyName || '').toLowerCase().trim();
                    const cName = (c.customerName || '').toLowerCase().trim();
                    const comp = (c.companyName || '').toLowerCase().trim();
                    return code === target || c2 === target || cName === target || comp === target ||
                           (code && code.startsWith(target)) || (c2 && c2.startsWith(target)) ||
                           (cName && cName.startsWith(target)) || (comp && comp.startsWith(target)) ||
                           (c2 && c2.includes(target)) || (comp && comp.includes(target));
                  });

                  if (chosen) {
                    setNewBomCompanyName(chosen.c2 || chosen.companyName || chosen.customerName || chosen.code || val);
                    if (chosen.contact || chosen.contactPerson || chosen.primaryContact?.name) {
                      setNewBomContactPerson(chosen.contact || chosen.contactPerson || chosen.primaryContact?.name);
                    }
                    if (chosen.c4 || chosen.phone || chosen.mobile || chosen.primaryContact?.phone || chosen.primaryContact?.whatsapp) {
                      setNewBomPhone(chosen.c4 || chosen.phone || chosen.mobile || chosen.primaryContact?.phone || chosen.primaryContact?.whatsapp);
                    }
                    if (chosen.c5 || chosen.email || chosen.primaryContact?.email) {
                      setNewBomEmail(chosen.c5 || chosen.email || chosen.primaryContact?.email);
                    }
                    if (chosen.gst || chosen.gstNo) {
                      setNewBomGstNo(chosen.gst || chosen.gstNo);
                    }

                    const bObj = chosen.billingAddressObj || {};
                    const bAddr = bObj.address || chosen.c6 || chosen.billingAddress || chosen.address || '';
                    const dObj = chosen.deliveryAddressObj || {};
                    const dAddr = dObj.address || chosen.c7 || chosen.deliveryAddress || chosen.dispatchAddress || '';

                    const clean = (s) => String(s || '').trim().toLowerCase();
                    const isSame = !dAddr || (
                      clean(dAddr) === clean(bAddr) &&
                      clean(dObj.city || chosen.city || '') === clean(bObj.city || chosen.city || '') &&
                      clean(dObj.state || chosen.state || '') === clean(bObj.state || chosen.state || '') &&
                      clean(dObj.pincode || chosen.pincode || '') === clean(bObj.pincode || chosen.pincode || '')
                    );

                    setSameAsBilling(isSame);
                    setNewBomDeliveryProofDoc(null);
                    if (dAddr && !isSame) {
                      setNewBomDeliveryStreet(dObj.address || chosen.c7 || chosen.deliveryAddress || chosen.dispatchAddress || '');
                      setNewBomDeliveryCity(dObj.city || chosen.dispatchCity || chosen.city || '');
                      setNewBomDeliveryState(dObj.state || chosen.dispatchState || chosen.state || '');
                      setNewBomDeliveryPincode(dObj.pincode || chosen.dispatchPincode || chosen.pincode || '');
                    } else {
                      setNewBomDeliveryStreet(bObj.address || chosen.c6 || chosen.billingAddress || chosen.address || '');
                      setNewBomDeliveryCity(bObj.city || chosen.city || '');
                      setNewBomDeliveryState(bObj.state || chosen.state || '');
                      setNewBomDeliveryPincode(bObj.pincode || chosen.pincode || '');
                    }
                  }
                }}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: formErrors.customerName ? '2px solid #EF4444' : '1px solid #E2E8F0',
                  backgroundColor: formErrors.customerName ? '#FEF2F2' : 'white',
                  boxShadow: formErrors.customerName ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none',
                  padding: '0 14px',
                  fontSize: '13px',
                  color: '#0F172A',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
               />
              {formErrors.customerName && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#DC2626', fontSize: '11px', fontWeight: '700', marginTop: '4px' }}>
                  <AlertCircle size={12} /> {formErrors.customerName}
                </span>
              )}
              <datalist id="bom-customer-name-suggestions">
                {(customerList || []).slice(0, 60).map((c, idx) => {
                  const val = c.code || c.customerName || c.companyName;
                  const label = c.c2 || c.companyName;
                  return (
                    <option key={idx} value={val}>
                      {label && label !== val ? `${val} (${label})` : val}
                    </option>
                  );
                })}
              </datalist>
            </div>
          </div>

          <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div>
                    <label htmlFor="bom-orders-company-name" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Company Name</label>
                    <input id="bom-orders-company-name" name="companyName" aria-label="Company Name"
                      type="text"
                      placeholder="Company Name..."
                      value={newBomCompanyName}
                      onChange={(e) => setNewBomCompanyName(e.target.value)}
                      style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                     />
                  </div>
                  <div>
                    <label htmlFor="bom-orders-contact-person" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Contact Person</label>
                    <input id="bom-orders-contact-person" name="contactPerson" aria-label="Contact Person"
                      type="text"
                      placeholder="Contact Person..."
                      value={newBomContactPerson}
                      onChange={(e) => setNewBomContactPerson(e.target.value)}
                      style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                     />
                  </div>
                  <div>
                    <label htmlFor="bom-orders-gst-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>GST Number</label>
                    <input id="bom-orders-gst-number" name="gSTNumber" aria-label="GST Number"
                      type="text"
                      placeholder="GSTIN (e.g. 33AAAAA0000A1Z5)..."
                      value={newBomGstNo}
                      onChange={(e) => setNewBomGstNo(e.target.value.toUpperCase())}
                      style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                     />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div>
                    <label htmlFor="bom-orders-mobile-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Mobile Number</label>
                    <input id="bom-orders-mobile-number" name="mobileNumber" aria-label="Mobile Number"
                      type="text"
                      placeholder="Mobile / Phone..."
                      value={newBomPhone}
                      onChange={(e) => setNewBomPhone(e.target.value)}
                      style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                     />
                  </div>
                  <div>
                    <label htmlFor="bom-orders-email" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Email</label>
                    <input id="bom-orders-email" name="email" aria-label="Email"
                      type="email"
                      placeholder="Email Address..."
                      value={newBomEmail}
                      onChange={(e) => setNewBomEmail(e.target.value)}
                      style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                     />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {/* Billing Address Card */}
                  <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                        <FileText style={{ width: '14px', height: '14px' }} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Billing Address</h4>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>Primary address for invoices & tax records</span>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="bom-orders-address" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Address</label>
                      <input id="bom-orders-address" name="address" aria-label="Address"
                        type="text"
                        value={newBomBillingStreet}
                        placeholder="e.g. Plot No 42, SIDCO Industrial Estate"
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewBomBillingStreet(val);
                          if (sameAsBilling) setNewBomDeliveryStreet(val);
                        }}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                       />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <label htmlFor="bom-orders-city" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                        <input id="bom-orders-city" name="city" aria-label="City"
                          type="text"
                          value={newBomBillingCity}
                          placeholder="e.g. Chennai"
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewBomBillingCity(val);
                            if (sameAsBilling) setNewBomDeliveryCity(val);
                          }}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="bom-orders-state" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                        <input id="bom-orders-state" name="state" aria-label="State"
                          type="text"
                          value={newBomBillingState}
                          placeholder="e.g. Tamil Nadu"
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewBomBillingState(val);
                            if (sameAsBilling) setNewBomDeliveryState(val);
                          }}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="bom-orders-pincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                        <input id="bom-orders-pincode" name="pincode" aria-label="Pincode"
                          type="text"
                          value={newBomBillingPincode}
                          placeholder="e.g. 600058"
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewBomBillingPincode(val);
                            if (sameAsBilling) setNewBomDeliveryPincode(val);
                          }}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                         />
                      </div>
                    </div>
                  </div>

                  {/* Delivery Address Card */}
                  <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#ECFEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490' }}>
                          <Truck style={{ width: '14px', height: '14px' }} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Delivery Address</h4>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>Destination for physical dispatch</span>
                        </div>
                      </div>

                      <label htmlFor="bom-orders-same-as-billing" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#0E7490', cursor: 'pointer', backgroundColor: '#ECFEFF', padding: '4px 10px', borderRadius: '8px', border: '1px solid #A5F3FC' }}>
                        <input id="bom-orders-same-as-billing" name="sameAsBilling" aria-label="SameAsBilling"
                          type="checkbox"
                          checked={sameAsBilling}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSameAsBilling(checked);
                            if (checked) {
                              setNewBomDeliveryStreet(newBomBillingStreet);
                              setNewBomDeliveryCity(newBomBillingCity);
                              setNewBomDeliveryState(newBomBillingState);
                              setNewBomDeliveryPincode(newBomBillingPincode);
                              setNewBomDeliveryProofDoc(null);
                            } else {
                              setNewBomDeliveryStreet('');
                              setNewBomDeliveryCity('');
                              setNewBomDeliveryState('');
                              setNewBomDeliveryPincode('');
                            }
                          }}
                          style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                         />
                        Same as Billing
                      </label>
                    </div>

                    <div>
                      <label htmlFor="field-newBomDeliveryStreet" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Address</label>
                      <input name="address" aria-label="Address"
                        id="field-newBomDeliveryStreet"
                        type="text"
                        placeholder="e.g. Plot No 42, SIDCO Industrial Estate, Ambattur"
                        value={sameAsBilling ? newBomBillingStreet : newBomDeliveryStreet}
                        disabled={sameAsBilling}
                        onChange={(e) => {
                          setNewBomDeliveryStreet(e.target.value);
                          setFormErrors(prev => ({ ...prev, deliveryAddress: null }));
                        }}
                        style={{
                          width: '100%',
                          height: '38px',
                          borderRadius: '8px',
                          border: formErrors.deliveryAddress ? '2px solid #EF4444' : '1px solid #CBD5E1',
                          padding: '0 12px',
                          fontSize: '12px',
                          color: sameAsBilling ? '#64748B' : '#0F172A',
                          backgroundColor: formErrors.deliveryAddress ? '#FEF2F2' : (sameAsBilling ? '#F1F5F9' : '#FFFFFF'),
                          boxShadow: formErrors.deliveryAddress ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none',
                          boxSizing: 'border-box',
                          outline: 'none',
                          cursor: sameAsBilling ? 'not-allowed' : 'text'
                        }}
                       />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div>
                        <label htmlFor="bom-orders-city" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                        <input id="bom-orders-city" name="city" aria-label="City"
                          type="text"
                          placeholder="e.g. Chennai"
                          value={sameAsBilling ? newBomBillingCity : newBomDeliveryCity}
                          disabled={sameAsBilling}
                          onChange={(e) => {
                            setNewBomDeliveryCity(e.target.value);
                            setFormErrors(prev => ({ ...prev, deliveryAddress: null }));
                          }}
                          style={{
                            width: '100%',
                            height: '38px',
                            borderRadius: '8px',
                            border: formErrors.deliveryAddress && !newBomDeliveryCity ? '2px solid #EF4444' : '1px solid #CBD5E1',
                            padding: '0 12px',
                            fontSize: '12px',
                            color: sameAsBilling ? '#64748B' : '#0F172A',
                            backgroundColor: formErrors.deliveryAddress && !newBomDeliveryCity ? '#FEF2F2' : (sameAsBilling ? '#F1F5F9' : '#FFFFFF'),
                            boxSizing: 'border-box',
                            outline: 'none',
                            cursor: sameAsBilling ? 'not-allowed' : 'text'
                          }}
                         />
                      </div>
                      <div>
                        <label htmlFor="bom-orders-state" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                        <input id="bom-orders-state" name="state" aria-label="State"
                          type="text"
                          placeholder="e.g. Tamil Nadu"
                          value={sameAsBilling ? newBomBillingState : newBomDeliveryState}
                          disabled={sameAsBilling}
                          onChange={(e) => setNewBomDeliveryState(e.target.value)}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="bom-orders-pincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                        <input id="bom-orders-pincode" name="pincode" aria-label="Pincode"
                          type="text"
                          placeholder="e.g. 600058"
                          value={sameAsBilling ? newBomBillingPincode : newBomDeliveryPincode}
                          disabled={sameAsBilling}
                          onChange={(e) => setNewBomDeliveryPincode(e.target.value)}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                         />
                      </div>
                    </div>
                    {formErrors.deliveryAddress && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#DC2626', fontSize: '11px', fontWeight: '700', marginTop: '-4px' }}>
                        <AlertCircle size={12} /> {formErrors.deliveryAddress}
                      </span>
                    )}
                    {(() => {
                      const effectiveDeliveryStreet = sameAsBilling ? newBomBillingStreet : newBomDeliveryStreet;
                      const effectiveDeliveryCity = sameAsBilling ? newBomBillingCity : newBomDeliveryCity;
                      const effectiveDeliveryState = sameAsBilling ? newBomBillingState : newBomDeliveryState;
                      const effectiveDeliveryPincode = sameAsBilling ? newBomBillingPincode : newBomDeliveryPincode;

                      const clean = (str) => String(str || '').trim().toLowerCase();
                      const hasEnteredDeliveryAddress = Boolean(clean(effectiveDeliveryStreet) || clean(effectiveDeliveryCity) || clean(effectiveDeliveryPincode));

                      // Check if delivery matches billing
                      const isMatchingBilling = Boolean(sameAsBilling) || (
                        hasEnteredDeliveryAddress &&
                        clean(effectiveDeliveryStreet) === clean(newBomBillingStreet) &&
                        clean(effectiveDeliveryCity) === clean(newBomBillingCity) &&
                        clean(effectiveDeliveryState) === clean(newBomBillingState) &&
                        clean(effectiveDeliveryPincode) === clean(newBomBillingPincode)
                      );

                      // ONLY render proof uploader if addresses do NOT match AND user has specified a different delivery destination
                      if (isMatchingBilling || !hasEnteredDeliveryAddress) {
                        return null;
                      }

                      return (
                        <div style={{ marginTop: '6px', padding: '14px 16px', backgroundColor: '#FEF2F2', border: '1px dashed #F87171', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <AlertCircle style={{ width: '14px', height: '14px' }} />
                              </div>
                              <div>
                                <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>
                                  Delivery Address Proof Document <span style={{ color: '#64748B', fontWeight: '600' }}>(Optional)</span>
                                </h5>
                                <span style={{ fontSize: '11px', color: '#64748B' }}>
                                  Delivery address differs from billing address. Upload proof (GST / Electricity Bill / Consignee Lease) if available.
                                </span>
                              </div>
                            </div>
                            {deliveryDocs.length >= 4 ? (
                              <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle style={{ width: '12px', height: '12px' }} /> {deliveryDocs.length} Images Attached (Target 4+ Met)
                              </span>
                            ) : deliveryDocs.length > 0 ? (
                              <span style={{ fontSize: '11px', fontWeight: '800', color: '#B45309', backgroundColor: '#FEF3C7', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                📷 {deliveryDocs.length} / 4 Images Attached (Add {4 - deliveryDocs.length} more)
                              </span>
                            ) : null}
                          </div>

                          {/* Attached Delivery Address Proof Images List */}
                          {deliveryDocs.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                              {deliveryDocs.map((doc, idx) => (
                                <div key={idx} style={{ border: '1px solid #FECACA', borderRadius: '10px', padding: '8px', backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                  <div style={{ position: 'relative', height: '100px', backgroundColor: '#FEF2F2', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {(doc.previewUrl || doc.dataUrl) ? (
                                      <img src={doc.previewUrl || doc.dataUrl} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <FileText style={{ width: '32px', height: '32px', color: '#DC2626' }} />
                                    )}
                                    <span style={{ position: 'absolute', top: '4px', left: '4px', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#FFFFFF', fontSize: '10px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px' }}>
                                      Image #{idx + 1}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.name}>
                                    {doc.name}
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{doc.size || 'Attached'}</span>
                                    <span style={{ color: '#166534', fontWeight: '700' }}>✓ Attached</span>
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                                    <button
                                      type="button"
                                      onClick={() => setPreviewDocModal({ title: `Delivery Address Proof #${idx + 1}: ${doc.name}`, doc })}
                                      style={{ flex: 1, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '5px', borderRadius: '6px' }}
                                    >
                                      <Eye style={{ width: '12px', height: '12px' }} /> View
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveDeliveryDoc(idx)}
                                      style={{ border: 'none', background: '#FEE2E2', color: '#EF4444', cursor: 'pointer', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px', borderRadius: '6px' }}
                                      title="Remove this image"
                                    >
                                      <Trash2 style={{ width: '12px', height: '12px' }} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Dropzone to Add / Upload Images (Multiple allowed) */}
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                handleUploadDeliveryProofFiles(e.dataTransfer.files);
                              }
                            }}
                            style={{ border: '2px dashed #CBD5E1', borderRadius: '12px', padding: deliveryDocs.length > 0 ? '12px 16px' : '16px 20px', textAlign: 'center', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
                          >
                            <UploadCloud style={{ width: deliveryDocs.length > 0 ? '22px' : '28px', height: deliveryDocs.length > 0 ? '22px' : '28px', color: '#DC2626' }} />
                            <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                              {deliveryDocs.length > 0
                                ? `Attach more delivery address images (Select multiple files to reach 4+ images)`
                                : `Drag & drop delivery address images here (Upload at least 4 images e.g. Site front, Entrance, Access road, Premises proof)`}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #DC2626', color: '#DC2626', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                                <Upload style={{ width: '13px', height: '13px' }} />
                                {deliveryDocs.length > 0 ? '+ Add More Images' : 'Browse / Select Files (Multi-Select)'}
                                <input id="bom-orders-input-1" name="input1" aria-label="Input 1"
                                  type="file"
                                  multiple
                                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                  style={{ display: 'none' }}
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                      handleUploadDeliveryProofFiles(e.target.files);
                                      e.target.value = '';
                                    }
                                  }}
                                />
                              </label>
                            </div>
                            <span style={{ fontSize: '10px', color: '#94A3B8' }}>Supported formats: JPG, PNG, PDF, DOC (Multi-select enabled • At least 4 images recommended)</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
        </div>

        {/* SECTION 3: ORDER ITEMS & BILL OF MATERIALS */}
        <div id="field-bomMaterialsList" style={{ backgroundColor: 'white', borderRadius: '16px', border: formErrors.items ? '2px solid #EF4444' : '1px solid #E2E8F0', boxShadow: formErrors.items ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none', display: 'flex', flexDirection: 'column' }}>
          {formErrors.items && (
            <div style={{ backgroundColor: '#FEF2F2', borderBottom: '1px solid #FECACA', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', fontSize: '12px', fontWeight: '700' }}>
              <AlertCircle size={16} />
              <span>{formErrors.items}</span>
            </div>
          )}
          {/* Section 3 Header — Clean Single Row */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px', gap: '20px', flexWrap: 'wrap', borderBottom: '1px solid #F1F5F9' }}>
            {/* Left: Badge + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: 'auto' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>3</div>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ORDER ITEMS & BILL OF MATERIALS</span>
            </div>

            {newBomSourcePiNo && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '0 14px', borderRadius: '20px', height: '38px', color: '#0E7490', fontSize: '12px', fontWeight: '700' }}>
                <FileText style={{ width: '14px', height: '14px', color: '#0E7490' }} />
                <span>Source PI: {newBomSourcePiNo}</span>
              </div>
            )}

            {!newBomSourcePiNo && (
              <>
                {/* Preset Pill */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: '#ECFEFF', padding: '0 16px', borderRadius: '20px', height: '40px', border: '1px solid #CFFAFE' }}>
                  <Layers style={{ width: '15px', height: '15px', color: '#0E7490' }} />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0E7490' }}>Preset:</span>
                </div>

                {/* Searchable Preset Selector */}
                <SearchablePresetSelector
                  value={selectedPreset}
                  activePresetsMap={activePresetsMap}
                  accentColor="#0E7490"
                  width="380px"
                  placeholder="Pick a Preset to add..."
                  style={{ height: '40px' }}
                  onChange={(val, targetPreset) => {
                    if (val && targetPreset && targetPreset.items) {
                      handleAddPresetToOrder(val, targetPreset, 1);
                    } else if (!val) {
                      setSelectedPreset('');
                    }
                  }}
                />

                {/* Clear Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedBomItemIndexes.length > 0) {
                      setBomMaterialsList(prev => prev.filter((_, idx) => !selectedBomItemIndexes.includes(idx)));
                      setSelectedBomItemIndexes([]);
                    } else {
                      if (bomMaterialsList.length > 0) setShowClearConfirmModal(true);
                    }
                  }}
                  title={selectedBomItemIndexes.length > 0 ? `Remove ${selectedBomItemIndexes.length} selected item(s)` : 'Clear all order items'}
                  style={{ border: 'none', backgroundColor: selectedBomItemIndexes.length > 0 ? '#EF4444' : '#FFE4E6', color: selectedBomItemIndexes.length > 0 ? 'white' : '#E11D48', width: '40px', height: '40px', borderRadius: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
                >
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </>
            )}
          </div>

          {/* Active Preset Badges / Pills */}
          {Object.values(presetGroups).length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '12px 24px 0 24px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>Active Presets in Order:</span>
              {Object.values(presetGroups).map(grp => (
                <span
                  key={grp.groupId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#ECFEFF',
                    color: '#0E7490',
                    border: '1px solid #A5F3FC',
                    borderRadius: '16px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: '700'
                  }}
                >
                  <Layers size={13} style={{ color: '#0E7490' }} />
                  {grp.presetName} (Total Quantity: {grp.setCount || 1} Set{(grp.setCount || 1) > 1 ? 's' : ''})
                  {!newBomSourcePiNo && (
                    <button
                      type="button"
                      onClick={() => handleRemovePresetGroup(grp.groupId)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 0 0 2px', display: 'flex', alignItems: 'center', color: '#0891B2' }}
                      title={`Remove ${grp.presetName}`}
                    >
                      <X size={13} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Section 3 Content */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {Boolean(newBomSourcePiNo) && (
            <div style={{ padding: '12px 18px', backgroundColor: '#FEF3C7', border: '1.5px solid #F59E0B', borderRadius: '10px', color: '#92400E', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Lock style={{ width: '18px', height: '18px', flexShrink: 0, color: '#D97706' }} />
              <span>Line Items & Pricing locked from Source Proforma Invoice ({newBomSourcePiNo}). Line items, quantities, and prices imported from PI cannot be modified.</span>
            </div>
          )}

          {/* Clear confirm modal */}
          {showClearConfirmModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle style={{ width: '20px', height: '20px' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Clear All Order Items?</h3>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>Are you sure you want to delete all items from this BOM list?</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button onClick={() => setShowClearConfirmModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => { setBomMaterialsList([]); setSelectedPreset(''); setPresetGroups({}); setPresetKitPrice(''); setPresetSetCount(1); setSelectedBomItemIndexes([]); setShowClearConfirmModal(false); }} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#DC2626', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Clear All Items</button>
                </div>
              </div>
            </div>
          )}

          {/* Clean Modern Items Table */}
          <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ color: '#475569', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '12px 14px', width: '30px', textAlign: 'center' }}>
                    {newBomSourcePiNo ? (
                      <span style={{ color: '#64748B', fontWeight: '700' }}>#</span>
                    ) : (
                      <input id="bom-orders-checkbox" name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
                        type="checkbox"
                        checked={bomMaterialsList.length > 0 && selectedBomItemIndexes.length === bomMaterialsList.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBomItemIndexes(bomMaterialsList.map((_, idx) => idx));
                          } else {
                            setSelectedBomItemIndexes([]);
                          }
                        }}
                        style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                       />
                    )}
                  </th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '30%' }}>Product / Item <span style={{ color: '#EF4444' }}>*</span></th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%' }}>UOM</th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '8%', textAlign: 'center' }}>Qty <span style={{ color: '#EF4444' }}>*</span></th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%' }}>Price (₹) <span style={{ color: '#EF4444' }}>*</span></th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%', textAlign: 'center' }}>GST Rate</th>
                  {bomMaterialsList.some(it => it.isPresetItem) && (
                    <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%', color: '#0E7490', backgroundColor: '#ECFEFF' }}>
                      Preset Amt (₹) <span style={{ color: '#EF4444' }}>*</span>
                    </th>
                  )}
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%', textAlign: 'right' }}>Taxable (₹)</th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%', textAlign: 'right' }}>Total (₹)</th>
                  <th style={{ padding: '12px 10px', fontWeight: '700', width: '4%', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {bomMaterialsList.length === 0 ? (
                  <tr>
                    <td colSpan={bomMaterialsList.some(it => it.isPresetItem) ? 10 : 9} style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                      No items added yet. Pick a preset above or click <strong>Add Product / Item</strong> below.
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const hasAnyPreset = bomMaterialsList.some(it => it.isPresetItem);
                    return bomMaterialsList.map((item, i) => {
                    const isPiLocked = Boolean(newBomSourcePiNo);
                    const q = parseFloat(item.qty) || 0;
                    const r = parseFloat(item.rate) || 0;
                    const taxable = q * r;
                    const gstPct = parseFloat(String(item.gstRate || '18%').replace('%', '')) || 18;
                    const gstAmt = taxable * (gstPct / 100);
                    const rowTot = taxable + gstAmt;
                    const isChecked = selectedBomItemIndexes.includes(i);

                    const isPresetItem = Boolean(item.isPresetItem);
                    const groupId = item.presetGroupId || (isPresetItem ? 'legacy_default' : null);
                    const groupItems = isPresetItem ? bomMaterialsList.filter(it => (it.presetGroupId || 'legacy_default') === groupId) : [];
                    const isFirstInGroup = isPresetItem && bomMaterialsList.findIndex(it => (it.presetGroupId || 'legacy_default') === groupId) === i;
                    const groupCount = groupItems.length;
                    const currentGroup = (groupId && presetGroups[groupId]) || {
                      groupId: groupId || 'legacy_default',
                      presetName: item.presetName || selectedPreset || 'Preset Kit',
                      setCount: presetSetCount || 1,
                      kitPrice: presetKitPrice || ''
                    };

                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: isChecked ? '#ECFEFF' : (i % 2 === 1 ? '#FAFBFC' : 'white') }}>
                        <td style={{ padding: '12px 10px', textAlign: 'center', borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent' }}>
                          {isPiLocked ? (
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>{i + 1}</span>
                          ) : (
                            <input id="bom-orders-checkbox" name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedBomItemIndexes(prev => [...prev, i]);
                                else setSelectedBomItemIndexes(prev => prev.filter(idx => idx !== i));
                              }}
                              style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                             />
                          )}
                        </td>
                        <td style={{ padding: '10px 10px' }}>
                          {isPiLocked ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{item.name || '—'}</span>
                              {item.category && <span style={{ fontSize: '11px', color: '#64748B' }}>{item.category}</span>}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {/* Line 1: Product / Item Name (Typeable & Dropdown) */}
                              <TypeableProductSelect
                                value={item.name || ''}
                                itemsList={itemsList}
                                placeholder="Type or select product / item..."
                                accentColor="#0E7490"
                                onChange={(val, matched) => {
                                  if (!matched) {
                                    setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, name: val } : mat));
                                    return;
                                  }
                                  const pName = matched.name;
                                  const pCat = matched.category || matched.description || item.category;
                                  const isSolar5 = is5PctSolarProduct(pName, pCat);
                                  setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? {
                                    ...mat,
                                    name: pName,
                                    code: matched.code || mat.code || '',
                                    rate: matched.price || matched.rate ? String(matched.price || matched.rate) : mat.rate,
                                    uom: matched.uom || matched.unit || mat.uom,
                                    category: pCat,
                                    gstRate: isSolar5 ? '5%' : (mat.gstRate || '18%')
                                  } : mat));
                                }}
                              />
                              {/* Line 2: Description */}
                              <input id={`bom-orders-description-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`description_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Description"
                                type="text"
                                placeholder="Description..."
                                value={item.category || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, category: val } : mat));
                                }}
                                style={{ width: '100%', height: '28px', borderRadius: '6px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '11px', color: '#64748B', outline: 'none', boxSizing: 'border-box', backgroundColor: '#F8FAFC' }}
                               />
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          {isPiLocked ? (
                            <div style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                              {item.uom || 'NOS'}
                            </div>
                          ) : (
                            <>
                              <input id={`bom-orders-uom-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`uOM_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="UOM"
                                type="text"
                                list={`uom-list-${i}`}
                                placeholder="UOM"
                                value={item.uom || 'NOS'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, uom: val } : mat));
                                }}
                                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '12px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF', fontWeight: '600' }}
                               />
                              <datalist id={`uom-list-${i}`}>
                                <option value="NOS" />
                                <option value="SET" />
                                <option value="KW" />
                                <option value="KG" />
                                <option value="MTR" />
                                <option value="PCS" />
                                <option value="BOX" />
                                <option value="PKT" />
                                <option value="PAIR" />
                              </datalist>
                            </>
                          )}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          {isPiLocked ? (
                            <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                              {item.qty || 0}
                            </div>
                          ) : (
                            <input id={`bom-orders-0-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`0_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="0"
                              type="number"
                              value={item.qty}
                              placeholder="0"
                              onChange={(e) => {
                                const val = e.target.value;
                                setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, qty: val } : mat));
                              }}
                              style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '13px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                             />
                          )}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          {isPresetItem ? (
                            <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                          ) : isPiLocked ? (
                            <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                              ₹{parseFloat(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          ) : (
                            <input id={`bom-orders-0-00-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`000_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="0.00"
                              type="number"
                              value={item.rate}
                              placeholder="0.00"
                              onChange={(e) => {
                                const val = e.target.value;
                                setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, rate: val } : mat));
                              }}
                              style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '13px', textAlign: 'right', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                             />
                          )}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          {isPiLocked ? (
                            <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', color: '#4338CA', backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE' }}>
                              {item.gstRate || (currentGroup && currentGroup.gstRate) || '18%'} GST
                            </span>
                          ) : (
                            <select id={`bom-orders-gst-rate-18-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`gstRate18_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="GstRate 18"
                              value={item.gstRate || (currentGroup && currentGroup.gstRate) || '18%'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBomMaterialsList(prev => prev.map((mat, idx) => idx === i ? { ...mat, gstRate: val } : mat));
                              }}
                              style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #C7D2FE', padding: '0 6px', fontSize: '12px', fontWeight: '700', color: '#4338CA', backgroundColor: '#EEF2FF', outline: 'none', cursor: 'pointer', textAlign: 'center' }}
                            >
                              <option value="18%">18%</option>
                              <option value="12%">12%</option>
                              <option value="5%">5%</option>
                              <option value="0%">0%</option>
                            </select>
                          )}
                        </td>
                        {hasAnyPreset && (() => {
                          if (isPresetItem) {
                            if (isFirstInGroup) {
                              return (
                                <td
                                  rowSpan={groupCount}
                                  style={{
                                    padding: '12px 10px',
                                    verticalAlign: 'middle',
                                    backgroundColor: '#EEF2FF',
                                    borderLeft: '2px solid #C7D2FE',
                                    borderRight: '2px solid #C7D2FE'
                                  }}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        color: '#4338CA',
                                        textAlign: 'center',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        maxWidth: '120px',
                                        display: 'block'
                                      }}
                                      title={currentGroup.presetName}
                                    >
                                      {currentGroup.presetName}
                                    </span>

                                    {isPiLocked ? (
                                      <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#312E81' }}>
                                          ₹{parseFloat(currentGroup.kitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#6366F1', fontWeight: '600', marginTop: '2px' }}>
                                          {groupCount} items × Total Quantity: {currentGroup.setCount || 1} Set{(parseInt(currentGroup.setCount) || 1) !== 1 ? 's' : ''}
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#6366F1', fontWeight: '700', marginTop: '3px' }}>
                                          GST: {currentGroup.gstRate || '18%'}
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <div style={{ position: 'relative', width: '100%' }}>
                                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', fontWeight: '700', color: '#6366F1', pointerEvents: 'none' }}>₹</span>
                                          <input id="bom-orders-0-00" name="000" aria-label="0.00"
                                            type="number"
                                            value={currentGroup.kitPrice}
                                            placeholder="0.00"
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (groupId) {
                                                setPresetGroups(prev => ({
                                                  ...prev,
                                                  [groupId]: { ...(prev[groupId] || currentGroup), kitPrice: val }
                                                }));
                                              }
                                              setPresetKitPrice(val);
                                            }}
                                            style={{
                                              width: '100%', height: '42px', borderRadius: '8px',
                                              border: '2px solid #818CF8', padding: '0 10px 0 26px',
                                              fontSize: '15px', fontWeight: '800', color: '#312E81',
                                              textAlign: 'right', outline: 'none', boxSizing: 'border-box',
                                              backgroundColor: 'white', cursor: 'text'
                                            }}
                                           />
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                          <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: '600' }}>
                                            {groupCount} items ×
                                          </span>
                                          <input id="bom-orders-set-count" name="setCount" aria-label="SetCount"
                                            type="number"
                                            min="0"
                                            max="999"
                                            value={currentGroup.setCount !== undefined && currentGroup.setCount !== null ? currentGroup.setCount : ''}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                              const rawVal = e.target.value;
                                              if (rawVal === '') {
                                                if (groupId) {
                                                  setPresetGroups(prev => ({
                                                    ...prev,
                                                    [groupId]: { ...(prev[groupId] || currentGroup), setCount: '' }
                                                  }));
                                                }
                                                return;
                                              }
                                              const parsed = parseInt(rawVal);
                                              const valToSave = isNaN(parsed) ? '' : Math.max(0, parsed);
                                              if (groupId) {
                                                setPresetGroups(prev => ({
                                                  ...prev,
                                                  [groupId]: { ...(prev[groupId] || currentGroup), setCount: valToSave }
                                                }));
                                              }
                                              const isFixedKit = isFixedQuantityPreset(currentGroup?.presetId, currentGroup?.presetName || item.presetName);
                                              const multiplier = isFixedKit ? 1 : (isNaN(parsed) ? 0 : Math.max(0, parsed));
                                              setBomMaterialsList(prev => prev.map(mat => {
                                                if ((mat.presetGroupId || 'legacy_default') === groupId && mat.baseQty) {
                                                  return { ...mat, qty: String(Math.round(mat.baseQty * multiplier)) };
                                                }
                                                return mat;
                                              }));
                                            }}
                                            onBlur={() => {
                                              const current = currentGroup.setCount;
                                              const finalCount = (current === '' || isNaN(parseInt(current)) || parseInt(current) < 0) ? 1 : Math.max(0, parseInt(current));
                                              if (groupId) {
                                                setPresetGroups(prev => ({
                                                  ...prev,
                                                  [groupId]: { ...(prev[groupId] || currentGroup), setCount: finalCount }
                                                }));
                                              }
                                              const isFixedKit = isFixedQuantityPreset(currentGroup?.presetId, currentGroup?.presetName || item.presetName);
                                              const multiplier = isFixedKit ? 1 : finalCount;
                                              setBomMaterialsList(prev => prev.map(mat => {
                                                if ((mat.presetGroupId || 'legacy_default') === groupId && mat.baseQty) {
                                                  return { ...mat, qty: String(Math.round(mat.baseQty * multiplier)) };
                                                }
                                                return mat;
                                              }));
                                            }}
                                            style={{
                                              width: '42px', height: '26px', borderRadius: '6px',
                                              border: '1.5px solid #818CF8', fontSize: '13px',
                                              fontWeight: '800', color: '#312E81', textAlign: 'center',
                                              padding: '0 2px', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box', cursor: 'text'
                                            }}
                                            title="Sets multiplier for this preset"
                                           />
                                          <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: '600' }}>
                                            set{(parseInt(currentGroup.setCount) || 1) !== 1 ? 's' : ''}
                                          </span>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                          <span style={{ fontSize: '10px', color: '#6366F1', fontWeight: '700' }}>GST:</span>
                                          <select id={`bom-orders-gst-rate-18-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`gstRate18_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="GstRate 18"
                                            value={currentGroup.gstRate || item.gstRate || '18%'}
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              if (groupId) {
                                                setPresetGroups(prev => ({
                                                  ...prev,
                                                  [groupId]: { ...(prev[groupId] || currentGroup), gstRate: val }
                                                }));
                                              }
                                              setBomMaterialsList(prev => prev.map((mat, idx) =>
                                                ((mat.presetGroupId || 'legacy_default') === groupId || idx === i)
                                                  ? { ...mat, gstRate: val }
                                                  : mat
                                              ));
                                            }}
                                            style={{
                                              height: '24px', borderRadius: '6px',
                                              border: '1.5px solid #818CF8', padding: '0 4px',
                                              fontSize: '11px', fontWeight: '800',
                                              color: '#312E81', backgroundColor: '#FFFFFF',
                                              outline: 'none', cursor: 'pointer'
                                            }}
                                            title="Change GST Rate for this preset"
                                          >
                                            <option value="18%">18%</option>
                                            <option value="12%">12%</option>
                                            <option value="5%">5%</option>
                                            <option value="0%">0%</option>
                                          </select>
                                        </div>

                                        {groupId && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemovePresetGroup(groupId)}
                                            style={{
                                              border: 'none',
                                              backgroundColor: 'transparent',
                                              color: '#EF4444',
                                              fontSize: '10px',
                                              fontWeight: '700',
                                              cursor: 'pointer',
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              marginTop: '2px'
                                            }}
                                            title={`Remove entire ${currentGroup.presetName} preset`}
                                          >
                                            Remove Kit
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              );
                            } else {
                              return null;
                            }
                          } else {
                            return <td style={{ padding: '12px 10px', textAlign: 'center' }}><span style={{ fontSize: '11px', color: '#CBD5E1' }}>—</span></td>;
                          }
                        })()}
                        <td style={{ padding: '12px 10px', color: '#475569', textAlign: 'right', fontWeight: '600' }}>
                          {isPresetItem ? (
                            <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                          ) : (
                            `₹${taxable.toFixed(2)}`
                          )}
                        </td>
                        <td style={{ padding: '12px 10px', fontWeight: 'bold', color: '#0F172A', textAlign: 'right' }}>
                          {isPresetItem ? (
                            <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                          ) : (
                            `₹${rowTot.toFixed(2)}`
                          )}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          {isPiLocked ? (
                            <span title="Locked from Source Proforma Invoice" style={{ color: '#0E7490', backgroundColor: '#ECFEFF', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Lock style={{ width: '13px', height: '13px' }} />
                              <span>Locked</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterialRow(i)}
                              style={{ border: 'none', background: '#FEF2F2', color: '#EF4444', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Delete Item"
                            >
                              <Trash2 style={{ width: '15px', height: '15px' }} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  });
                  })()
                )}

              </tbody>
            </table>
          </div>

          {!newBomSourcePiNo && (
            <div>
              <button
                type="button"
                onClick={handleAddMaterialRow}
                style={{ border: '1px solid #A5F3FC', background: '#ECFEFF', color: '#0E7490', padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                Add Product / Item
              </button>
            </div>
          )}
          </div>
        </div>

        {/* SECTION 4: TRANSPORT & LOGISTICS */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              4
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TRANSPORT & LOGISTICS DETAILS
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div>
              <label htmlFor="bom-orders-mode-of-transport" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Mode of Transport <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select id="bom-orders-mode-of-transport" name="modeOfTransport" aria-label="Mode of Transport"
                value={newBomTransportMode}
                onChange={(e) => setNewBomTransportMode(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none', cursor: 'pointer' }}
              >
                <option value="Transport">Transport</option>
                <option value="Own Vehicle">Own Vehicle</option>
                <option value="Porter">Porter</option>
              </select>
            </div>
            <div>
              <label htmlFor="bom-orders-transport-name" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Transport Name</label>
              <input id="bom-orders-transport-name" name="transportName" aria-label="Transport Name"
                type="text"
                value={newBomTransporterName}
                onChange={(e) => setNewBomTransporterName(e.target.value)}
                placeholder="e.g. VRL Logistics / TCI Freight / Local Transport"
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="bom-orders-destination" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Destination <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input id="bom-orders-destination" name="destination" aria-label="Destination"
                type="text"
                value={newBomDestination}
                onChange={(e) => setNewBomDestination(e.target.value)}
                placeholder="e.g. Chennai / Coimbatore / Site Location"
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: (!newBomDestination?.trim() && (formErrors?.destination || false)) ? '1.5px solid #EF4444' : '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="bom-orders-vehicle-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Vehicle Number</label>
              <input id="bom-orders-vehicle-number" name="vehicleNumber" aria-label="Vehicle Number"
                type="text"
                value={newBomVehicleNo}
                onChange={(e) => setNewBomVehicleNo(e.target.value)}
                placeholder="e.g. TN 01 AB 1234 / KA 04 C 5678"
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="bom-orders-scope" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Scope</label>
              <select id="bom-orders-scope" name="scope" aria-label="Scope"
                value={newBomTransportScope}
                onChange={(e) => setNewBomTransportScope(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none', cursor: 'pointer' }}
              >
                <option value="VRM Structures">VRM Structures</option>
                <option value="Customer Scope">Customer Scope</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 5: PAYMENT TERMS & FINANCIAL SUMMARY */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              5
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              PAYMENT TERMS & ORDER SUMMARY
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="bom-orders-payment-terms" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Payment Terms</label>
                <select id="bom-orders-payment-terms" name="paymentTerms" aria-label="Payment Terms"
                  value={newBomPaymentType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewBomPaymentType(val);
                    if (val === 'Credit Payment' || val === 'Payment While Dispatch') {
                      setNewBomPaymentProofDoc(null);
                    }
                  }}
                  style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'pointer' }}
                >
                  <option value="100% Paid">100% Paid</option>
                  <option value="Partial Paid">Partial Paid</option>
                  <option value="Payment While Dispatch">Payment While Dispatch</option>
                  <option value="Credit Payment">Credit Payment</option>
                </select>
              </div>

              {(newBomPaymentType === 'Partial Paid' || newBomPaymentType === 'Partial Payment') && (
                <div style={{ backgroundColor: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#0F766E' }}>
                      Partial Advance Amount (₹) <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <span style={{ fontSize: '11px', color: '#0D9488', fontWeight: '700' }}>
                      Total: ₹{Number(totals.grand || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <input name="advanceAmountPaid" aria-label="Enter advance amount paid"
                    id="field-newBomPartialAmount"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Enter advance amount paid..."
                    value={newBomPartialAmount}
                    onChange={(e) => setNewBomPartialAmount(e.target.value)}
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: formErrors.partialAmount ? '1.5px solid #EF4444' : '1px solid #5EEAD4', padding: '0 12px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none', fontWeight: '700' }}
                   />
                  {formErrors.partialAmount && (
                    <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: '600' }}>{formErrors.partialAmount}</span>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#CCFBF1', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: '#115E59' }}>
                    <span>Remaining Balance:</span>
                    <strong style={{ fontSize: '13px', color: '#0F766E' }}>
                      ₹{Math.max(0, (totals.grand || 0) - (parseFloat(newBomPartialAmount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <span style={{ fontSize: '11px', color: '#0F766E', lineHeight: '1.4' }}>
                    ℹ️ Attach the advance payment slip below. The remaining balance slip can be uploaded after BOM completion / before dispatch.
                  </span>
                </div>
              )}

              {newBomPaymentType === 'Credit Payment' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label htmlFor="bom-orders-new-bom-credit-days" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155' }}>Credit Timeline (Days)</label>
                    <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700' }}>Default: 7 Days</span>
                  </div>
                  <input id="bom-orders-new-bom-credit-days" name="newBomCreditDays" aria-label="Credit Timeline (Days)
                    Default 7 Days"
                    type="number"
                    min="1"
                    max="365"
                    value={newBomCreditDays}
                    onChange={(e) => setNewBomCreditDays(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #A5F3FC', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: '#F0FDFA', boxSizing: 'border-box', outline: 'none', fontWeight: '700' }}
                   />
                </div>
              )}

              <div>
                <label htmlFor="bom-orders-remarks-notes" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Remarks / Notes</label>
                <textarea id="bom-orders-remarks-notes" name="remarksNotes" aria-label="Remarks / Notes"
                  rows={3}
                  value={newBomRemarks}
                  onChange={(e) => setNewBomRemarks(e.target.value)}
                  placeholder="Enter remarks, consignee references, or invoice notes..."
                  style={{ width: '100%', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '12px 14px', fontSize: '13px', color: '#0F172A', outline: 'none', resize: 'vertical' }}
                 />
              </div>
            </div>

            <div>
              {newBomPaymentType === 'Credit Payment' ? (
                <div style={{ border: '1px solid #C7D2FE', borderRadius: '14px', padding: '20px', backgroundColor: '#F5F3FF', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', boxSizing: 'border-box', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#EDE9FE', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#5B21B6' }}>Credit Payment Terms Active</h4>
                      <span style={{ fontSize: '11px', color: '#6D28D9' }}>{newBomCreditDays} Days Credit Window</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: '#4C1D95', margin: 0, lineHeight: '1.5' }}>
                    Payment slip is not required upfront. Salesperson will receive continuous notification reminders.
                  </p>
                </div>
              ) : newBomPaymentType === 'Payment While Dispatch' ? (
                <div style={{ border: '1px solid #C7D2FE', borderRadius: '14px', padding: '20px', backgroundColor: '#EEF2FF', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', boxSizing: 'border-box', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#DBEAFE', color: '#1E40AF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Truck style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#1E3A8A' }}>Payment While Dispatch Active</h4>
                      <span style={{ fontSize: '11px', color: '#2563EB' }}>Payment slip due when goods are packed</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '12px', color: '#1E3A8A', margin: 0, lineHeight: '1.5' }}>
                    BOM will proceed with production immediately. Payment receipt will be attached prior to final release.
                  </p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                      Payment Attachment / Slip <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    {paymentDocs.length >= 4 ? (
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle style={{ width: '12px', height: '12px' }} /> {paymentDocs.length} Images Attached (Target 4+ Met)
                      </span>
                    ) : paymentDocs.length > 0 ? (
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#B45309', backgroundColor: '#FEF3C7', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        📷 {paymentDocs.length} / 4 Images Attached (Add {4 - paymentDocs.length} more)
                      </span>
                    ) : null}
                  </div>

                  {/* Attached Payment Proof Images List */}
                  {paymentDocs.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                      {paymentDocs.map((doc, idx) => (
                        <div key={idx} style={{ border: '1px solid #86EFAC', borderRadius: '10px', padding: '8px', backgroundColor: '#F0FDF4', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                          <div style={{ position: 'relative', height: '100px', backgroundColor: '#DCFCE7', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {(doc.previewUrl || doc.dataUrl) ? (
                              <img src={doc.previewUrl || doc.dataUrl} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <FileCheck style={{ width: '32px', height: '32px', color: '#166534' }} />
                            )}
                            <span style={{ position: 'absolute', top: '4px', left: '4px', backgroundColor: 'rgba(15, 23, 42, 0.75)', color: '#FFFFFF', fontSize: '10px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px' }}>
                              Image #{idx + 1}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.name}>
                            {doc.name}
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{doc.size || 'Attached'}</span>
                            <span style={{ color: '#166534', fontWeight: '700' }}>✓ Verified</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
                            <button
                              type="button"
                              onClick={() => setPreviewDocModal({ title: `Payment Proof #${idx + 1}: ${doc.name}`, doc })}
                              style={{ flex: 1, border: '1px solid #BBF7D0', background: '#DCFCE7', color: '#166534', cursor: 'pointer', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '5px', borderRadius: '6px' }}
                            >
                              <Eye style={{ width: '12px', height: '12px' }} /> View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemovePaymentDoc(idx)}
                              style={{ border: 'none', background: '#FEE2E2', color: '#DC2626', cursor: 'pointer', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 8px', borderRadius: '6px' }}
                              title="Remove this image"
                            >
                              <Trash2 style={{ width: '12px', height: '12px' }} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Dropzone to Add / Upload Payment Slips (Multiple allowed) */}
                  <div
                    id="field-newBomPaymentProofDoc"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleUploadPaymentProofFiles(e.dataTransfer.files);
                      }
                    }}
                    style={{
                      border: (formErrors.paymentProof && paymentDocs.length === 0) ? '2px dashed #EF4444' : '2px dashed #CBD5E1',
                      borderRadius: '12px',
                      padding: paymentDocs.length > 0 ? '14px 16px' : '24px 16px',
                      textAlign: 'center',
                      backgroundColor: (formErrors.paymentProof && paymentDocs.length === 0) ? '#FEF2F2' : '#FAFAFA',
                      boxShadow: (formErrors.paymentProof && paymentDocs.length === 0) ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <UploadCloud style={{ width: paymentDocs.length > 0 ? '24px' : '34px', height: paymentDocs.length > 0 ? '24px' : '34px', color: (formErrors.paymentProof && paymentDocs.length === 0) ? '#EF4444' : '#6366F1' }} />
                    <span style={{ fontSize: '13px', color: (formErrors.paymentProof && paymentDocs.length === 0) ? '#B91C1C' : '#475569', fontWeight: '700' }}>
                      {paymentDocs.length > 0
                        ? `Attach more payment slips / receipts (Select multiple files to reach 4+ images)`
                        : `Drag & drop payment slip / bank advice here (Upload at least 4 images e.g. Transfer receipt, Bank statement, RTGS voucher)`}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', color: '#0E7490', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                        <Upload style={{ width: '13px', height: '13px' }} />
                        {paymentDocs.length > 0 ? '+ Add More Payment Slips' : 'Browse / Select Files (Multi-Select)'}
                        <input id="bom-orders-input-2" name="input2" aria-label="Input 2"
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleUploadPaymentProofFiles(e.target.files);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    </div>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>Supported formats: PDF, JPG, PNG (Multi-select enabled • Upload at least 4 images recommended)</span>
                  </div>
                  {formErrors.paymentProof && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#DC2626', fontSize: '11px', fontWeight: '700', marginTop: '6px' }}>
                      <AlertCircle size={12} /> {formErrors.paymentProof}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Subtotals & GST Tax Calculation Breakdown */}
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', fontSize: '13px' }}>
            {selectedPreset && totals.kitSubtotal > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '6px 10px', borderRadius: '6px' }}>
                <span style={{ fontWeight: '700' }}>Preset ({presetSetCount} Set{presetSetCount > 1 ? 's' : ''})</span>
                <strong style={{ color: '#0E7490' }}>₹{totals.kitSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#64748B' }}>
              <span>Taxable Subtotal (Before GST)</span>
              <strong style={{ color: '#0F172A' }}>₹{totals.sub.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#64748B', fontSize: '12px' }}>
              <span>CGST (9%)</span>
              <span style={{ color: '#475569', fontWeight: '600' }}>₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#64748B', fontSize: '12px' }}>
              <span>SGST (9%)</span>
              <span style={{ color: '#475569', fontWeight: '600' }}>₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '6px 10px', borderRadius: '6px' }}>
              <span>Total Applicable GST (18%)</span>
              <span>₹{totals.gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '320px', color: '#0F172A', fontSize: '17px', fontWeight: '800', borderTop: '1px solid #E2E8F0', paddingTop: '10px', marginTop: '4px' }}>
              <span>Grand Total (Incl. GST)</span>
              <span style={{ color: '#0E7490' }}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '20px', marginTop: '10px' }}>
            <button
              disabled={isSubmittingBom}
              onClick={() => setBomConfirmModal('cancel')}
              style={{ border: '1px solid #CBD5E1', background: 'white', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', color: '#475569', cursor: isSubmittingBom ? 'not-allowed' : 'pointer', opacity: isSubmittingBom ? 0.6 : 1 }}
            >
              Cancel
            </button>
            <button
              disabled={isSubmittingBom}
              onClick={() => {
                if (isSubmittingBom) return;
                const validation = validateBomForm(true);
                if (!validation.isValid) {
                  setValidationErrorModal({
                    fields: validation.missingList.map(m => typeof m === 'object' ? m.field : m),
                    firstTargetId: validation.missingList[0]?.targetId
                  });
                  return;
                }
                setBomConfirmModal('draft');
              }}
              style={{ border: '1px solid #A5F3FC', background: '#ECFEFF', color: '#0E7490', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: isSubmittingBom ? 'not-allowed' : 'pointer', opacity: isSubmittingBom ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText style={{ width: '15px', height: '15px' }} /> Save as Draft
            </button>
            <button
              disabled={isSubmittingBom}
              onClick={() => {
                if (isSubmittingBom) return;
                const validation = validateBomForm(false);
                if (!validation.isValid) {
                  setValidationErrorModal({
                    fields: validation.missingList.map(m => typeof m === 'object' ? m.field : m),
                    firstTargetId: validation.missingList[0]?.targetId
                  });
                  return;
                }
                setBomConfirmModal('create');
              }}
              style={{ border: 'none', background: '#0E7490', color: 'white', padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: '900', cursor: isSubmittingBom ? 'not-allowed' : 'pointer', opacity: isSubmittingBom ? 0.6 : 1, boxShadow: '0 4px 14px rgba(14,116,144,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Check style={{ width: '16px', height: '16px' }} /> Create & Send to Dispatch
            </button>
          </div>
        </div>

        {/* CONFIRMATION / SUBMISSION MODAL */}
        {bomConfirmModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', maxWidth: '440px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: bomConfirmModal === 'cancel' ? '#FEE2E2' : '#ECFEFF', color: bomConfirmModal === 'cancel' ? '#DC2626' : '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {bomConfirmModal === 'cancel' ? <AlertTriangle style={{ width: '20px', height: '20px' }} /> : <Layers style={{ width: '20px', height: '20px' }} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                    {bomConfirmModal === 'cancel' && 'Discard BOM Form?'}
                    {bomConfirmModal === 'draft' && 'Save BOM as Draft?'}
                    {bomConfirmModal === 'create' && 'Confirm & Send to Dispatch?'}
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>
                    {bomConfirmModal === 'cancel' && 'Are you sure you want to cancel? Any unsaved changes entered in this BOM form will be lost.'}
                    {bomConfirmModal === 'draft' && 'Save this Bill of Materials as a draft order so you can review and update it later?'}
                    {bomConfirmModal === 'create' && `Are you sure you want to create this BOM order and forward it directly to Dispatch for packing?`}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                <button
                  disabled={isSubmittingBom}
                  onClick={() => setBomConfirmModal(null)}
                  style={{
                    border: '1px solid #CBD5E1',
                    backgroundColor: 'white',
                    color: isSubmittingBom ? '#94A3B8' : '#475569',
                    padding: '9px 18px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSubmittingBom ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingBom ? 0.6 : 1
                  }}
                >
                  Go Back
                </button>
                <button
                  disabled={isSubmittingBom}
                  onClick={async () => {
                    if (bomConfirmModal === 'cancel') {
                      setShowBOMForm(false);
                      setBomConfirmModal(null);
                      setSelectedPreset('');
                      setPresetKitPrice('');
                      setPresetSetCount(1);
                      setPresetGroups({});
                      setNewBomTransportMode('Transport');
                      setNewBomTransporterName('');
                      setNewBomDestination('');
                      setNewBomVehicleNo('');
                      setNewBomTransportScope('VRM Structures');
                      setNewBomSourcePiNo('');
                      setNewBomBillingStreet('');
                      setNewBomBillingCity('');
                      setNewBomBillingState('');
                      setNewBomBillingPincode('');
                      setNewBomDeliveryStreet('');
                      setNewBomDeliveryCity('');
                      setNewBomDeliveryState('');
                      setNewBomDeliveryPincode('');
                      setNewBomCompanyName('');
                      setNewBomContactPerson('');
                      setNewBomPhone('');
                      setNewBomEmail('');
                      setNewBomGstNo('');
                      setSameAsBilling(true);
                    } else if (bomConfirmModal === 'draft' || bomConfirmModal === 'create') {
                      // MULTI-CLICK MUTEX GUARD: Drop any secondary clicks while submitting
                      if (isSubmittingBomRef.current) {
                        console.warn('BOM creation already in progress. Ignoring duplicate click.');
                        return;
                      }
                      isSubmittingBomRef.current = true;
                      setIsSubmittingBom(true);
                      setBomSubmitStage('validating');
                      setBomSubmitAssignedCode('');

                      try {
                        const isDraft = bomConfirmModal === 'draft';
                        const target = (newBomProductName || '').toLowerCase().trim();
                        const selCust = target ? customerList.find(c => {
                          const code = (c.code || '').toLowerCase().trim();
                          const c2 = (c.c2 || '').toLowerCase().trim();
                          const cName = (c.customerName || '').toLowerCase().trim();
                          const comp = (c.companyName || '').toLowerCase().trim();
                          return code === target || c2 === target || cName === target || comp === target ||
                                 (code && code.startsWith(target)) || (c2 && c2.startsWith(target)) ||
                                 (cName && cName.startsWith(target)) || (comp && comp.startsWith(target)) ||
                                 (c2 && c2.includes(target)) || (comp && comp.includes(target));
                        }) : null;

                        const bObj = selCust?.billingAddressObj || {};
                        const bStreet = newBomBillingStreet || bObj.address || selCust?.c6 || selCust?.billingAddress || '';
                        const bCity = newBomBillingCity || bObj.city || '';
                        const bState = newBomBillingState || bObj.state || '';
                        const bPin = newBomBillingPincode || bObj.pincode || '';

                        const formatAddr = (st, ct, sta, pin) => {
                          const parts = [st, ct, sta, pin ? `Pincode: ${pin}` : ''].filter(Boolean);
                          return parts.join(', ');
                        };

                        const billingObj = { address: bStreet, city: bCity, state: bState, pincode: bPin };
                        const billingFull = formatAddr(bStreet, bCity, bState, bPin) || selCust?.c6 || selCust?.billingAddress || '-';
                        const deliveryFull = sameAsBilling
                          ? billingFull
                          : (formatAddr(newBomDeliveryStreet, newBomDeliveryCity, newBomDeliveryState, newBomDeliveryPincode) || newBomDeliveryAddress || '-');

                        const deliveryObj = sameAsBilling
                          ? { address: bStreet, city: bCity, state: bState, pincode: bPin }
                          : { address: newBomDeliveryStreet, city: newBomDeliveryCity, state: newBomDeliveryState, pincode: newBomDeliveryPincode };

                        const existingNumsRec = (bomStore || []).map(b => {
                          const match = String(b.bomCode || b.code || b.id || '').match(/BOM-(\d+)/i);
                          return match ? parseInt(match[1], 10) : 0;
                        }).filter(n => Number.isFinite(n) && n > 0);
                        // BOM code is strictly assigned atomically upon submission
                        const finalCode = 'BOM-PENDING';

                        const loggedInOperatorName = (localStorage.getItem('controlroom_logged_user_name') || '').trim() || defaultSalesPersonName;
                        const loggedInOperatorId = (localStorage.getItem('controlroom_logged_emp_id') || '').trim();

                        // PRESERVE ORIGINAL PI SALESPERSON: Prioritize PI salesperson over converting operator
                        const effectiveSalesPersonName = (newBomSalesPerson && newBomSalesPerson.trim()) ? newBomSalesPerson.trim() : (newBomCreatedBy || loggedInOperatorName);
                        const effectiveSalesPersonCode = (newBomSalesPersonCode && newBomSalesPersonCode.trim()) ? newBomSalesPersonCode.trim() : (newBomCreatedById || loggedInOperatorId);
                        const effectiveCreatorName = loggedInOperatorName;
                        const effectiveCreatedById = loggedInOperatorId || effectiveSalesPersonCode;

                        const hasPaymentProof = Boolean(newBomPaymentProofDoc);
                        const newBomRecord = {
                          id: finalCode,
                          bomCode: finalCode,
                          code: finalCode,
                          sourcePiNo: newBomSourcePiNo || null,
                          date: new Date().toISOString().split('T')[0],
                          createdAt: new Date().toISOString(),
                          deliveryDate: newBomDeliveryDate || null,
                          customerName: (newBomCompanyName && newBomCompanyName !== '-') ? newBomCompanyName : (newBomProductName || selCust?.c2 || selCust?.companyName || selCust?.code || 'Customer Order'),
                          companyName: (newBomCompanyName && newBomCompanyName !== '-') ? newBomCompanyName : (newBomProductName || selCust?.c2 || selCust?.companyName || selCust?.code || '-'),
                          contactPerson: newBomContactPerson || selCust?.contact || selCust?.contactPerson || '-',
                          mobile: newBomPhone || selCust?.c4 || selCust?.phone || '-',
                          email: newBomEmail || selCust?.c5 || selCust?.email || '-',
                          gstNo: newBomGstNo || selCust?.gst || selCust?.gstNo || '-',
                          billingAddress: billingFull,
                          billingAddressObj: billingObj,
                          deliveryAddress: deliveryFull,
                          deliveryAddressObj: deliveryObj,
                          deliveryAddressProofDoc: sameAsBilling ? null : (deliveryDocs[0] || null),
                          deliveryAddressProofDocs: sameAsBilling ? [] : deliveryDocs,
                          transportMode: newBomTransportMode || 'Transport',
                          transportScope: newBomTransportScope || 'VRM Structures',
                          transporterName: newBomTransporterName || '',
                          destination: (newBomDestination || '').trim(),
                          vehicleNo: newBomVehicleNo || '',
                          lrNo: newBomLrNo || '',
                          paymentType: normalizePaymentTerm(newBomPaymentType),
                          partialAmount: (newBomPaymentType === 'Partial Paid' || newBomPaymentType === 'Partial Payment') ? (parseFloat(newBomPartialAmount) || 0) : null,
                          balanceAmount: (newBomPaymentType === 'Partial Paid' || newBomPaymentType === 'Partial Payment') ? Math.max(0, cleanNum(totals.grand, 0) - (parseFloat(newBomPartialAmount) || 0)) : null,
                          creditDays: newBomPaymentType === 'Credit Payment' ? (parseInt(newBomCreditDays) || 7) : null,
                          creditDueDate: newBomPaymentType === 'Credit Payment' ? new Date(Date.now() + (parseInt(newBomCreditDays) || 7) * 86400000).toISOString().split('T')[0] : null,
                          paymentProofDoc: paymentDocs[0] || null,
                          paymentProofDocs: paymentDocs,
                          paymentUpdated: (newBomPaymentType === '100% Paid' || newBomPaymentType === 'Partial Paid' || newBomPaymentType === 'Partial Payment') && paymentDocs.length > 0,
                          remarks: newBomRemarks || '',
                          status: isDraft ? 'Draft' : 'Sales Confirmed - Sent to Dispatch',
                          salesConfirmed: !isDraft,
                          salesConfirmedAt: !isDraft ? new Date().toISOString() : null,
                          salesPerson: effectiveSalesPersonName,
                          salesPersonCode: effectiveSalesPersonCode,
                          createdBy: effectiveCreatorName,
                          createdById: effectiveCreatedById,
                          convertedBy: loggedInOperatorName,
                          convertedById: loggedInOperatorId,
                          items: (bomMaterialsList || []).map(item => ({
                            code: item.code || '',
                            name: item.name || 'Custom Item',
                            category: item.category || (item.isPresetItem ? 'Preset Component' : ''),
                            uom: item.uom || 'NOS',
                            qty: cleanNum(item.qty, 1),
                            rate: item.isPresetItem ? 0 : cleanNum(item.rate, 0),
                            gstRate: item.gstRate || '18%',
                            confirmed: !isDraft,
                            isPresetItem: Boolean(item.isPresetItem),
                            presetGroupId: item.presetGroupId || null,
                            presetName: item.presetName || null,
                            baseQty: item.baseQty != null ? cleanNum(item.baseQty, 1) : null
                          })),
                          payments: {
                            advance50Uploaded: false,
                            dispatch50Uploaded: false,
                            advance100Uploaded: newBomPaymentType === '100% Paid' && hasPaymentProof,
                            net30Uploaded: false,
                            proofDoc: paymentDocs[0] ? paymentDocs[0].name : null,
                            proofDocObj: paymentDocs[0] || null,
                            proofDocs: paymentDocs.map(d => d.name),
                            proofDocObjs: paymentDocs,
                            paymentUpdated: newBomPaymentType === '100% Paid' && paymentDocs.length > 0
                          },
                          dispatchPacking: (bomMaterialsList || []).map(item => ({
                            code: item.code || '',
                            name: item.name || 'Custom Item',
                            bomQty: cleanNum(item.qty, 1),
                            packed: false
                          })),
                          accountsVerification: {
                            paymentStatus: null,
                            hardCopyReceived: false,
                            softCopyReceived: false
                          },
                          invoiceConfirmed: false,
                          invoiceDeducted: false,
                          stockBlocked: !isDraft,
                          stockBlockedAt: !isDraft ? new Date().toISOString() : null,
                          presetName: Object.values(presetGroups).map(g => `${g.presetName} (${g.setCount} Set${g.setCount > 1 ? 's' : ''})`).join(' + ') || selectedPreset || null,
                          presetKitPrice: (Object.values(presetGroups).length === 1 && Object.values(presetGroups)[0]?.kitPrice)
                            ? cleanNum(Object.values(presetGroups)[0].kitPrice, null)
                            : (totals.kitSubtotal || ((selectedPreset && presetKitPrice !== '') ? cleanNum(presetKitPrice, null) : null)),
                          presetSetCount: Object.values(presetGroups).reduce((s, g) => s + (parseInt(g.setCount) || 1), 0) || (selectedPreset ? (parseInt(presetSetCount) || 1) : null),
                          presetGroups: Object.values(presetGroups).map(g => ({
                            ...g,
                            kitPrice: cleanNum(g.kitPrice, 0),
                            setCount: parseInt(g.setCount) || 1
                          })),
                          subTotal: cleanNum(totals.sub, 0),
                          gstAmount: cleanNum(totals.gst, 0),
                          cgstAmount: cleanNum(totals.cgst, 0),
                          sgstAmount: cleanNum(totals.sgst, 0),
                          grandTotal: cleanNum(totals.grand, 0)
                        };

                        const sanitizedNewBom = stripDataUrlsFromRecord(newBomRecord);

                        // Stage: Assigning sequential code
                        setBomSubmitStage('assigning');

                        // 1. Synchronize with server backend & assign atomic sequential BOM code
                        let finalAssignedCode = null;
                        let sResOk = false;
                        const postPayload = JSON.stringify({ bom: sanitizedNewBom, isNew: true });
                        const endpoints = ['/api/boms'];
                        for (const url of endpoints) {
                          try {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), 1500);
                            const sRes = await fetch(url, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: postPayload,
                              signal: controller.signal
                            }).catch(() => null);
                            clearTimeout(timeoutId);
                            if (sRes && sRes.ok) {
                              const sData = await sRes.json().catch(() => null);
                              if (sData && (sData.bomCode || sData.bom?.bomCode) && sData.success) {
                                sResOk = true;
                                finalAssignedCode = sData.bomCode || sData.bom?.bomCode;
                                break;
                              }
                            }
                          } catch (err) {
                            console.warn(`Sync attempt to ${url} failed, trying next:`, err);
                          }
                        }

                        // 2. Offline / Direct fallback to atomic Supabase Sequence
                        if (!finalAssignedCode || (!finalAssignedCode.startsWith('VRM-BOM-') && !/^BOM-\d+$/i.test(finalAssignedCode))) {
                          try {
                            const reservedCode = await getAndReserveNextBomCode(true);
                            if (reservedCode && (reservedCode.startsWith('VRM-BOM-') || /^BOM-\d+$/i.test(reservedCode))) {
                              finalAssignedCode = reservedCode;
                            }
                          } catch (err) {
                            console.error('Error reserving atomic BOM code from Supabase:', err);
                            finalAssignedCode = getNextSequence(bomStore, 'BOM');
                          }
                        }

                        setBomSubmitAssignedCode(finalAssignedCode);
                        sanitizedNewBom.bomCode = finalAssignedCode;
                        sanitizedNewBom.code = finalAssignedCode;
                        sanitizedNewBom.id = finalAssignedCode;

                        // Upload attached delivery proof files to private Supabase Storage under the final BOM code
                        if (deliveryDocs.length > 0 && !sameAsBilling) {
                          try {
                            const uploadedDeliveryDocs = await Promise.all(deliveryDocs.map(async (doc, idx) => {
                              if (doc && doc._rawFile) {
                                try {
                                  const meta = await uploadBomDocumentFile({
                                    file: doc._rawFile,
                                    bomCode: finalAssignedCode,
                                    category: `delivery-proof-${idx + 1}`
                                  });
                                  return meta;
                                } catch (upErr) {
                                  console.warn('Storage upload fallback, keeping local delivery proof:', upErr);
                                }
                              }
                              return {
                                name: doc.name || `Delivery_Address_Proof_${idx + 1}`,
                                size: doc.size || 'Attached',
                                mimeType: doc.mimeType || 'image/jpeg',
                                uploadedAt: new Date().toISOString(),
                                dataUrl: doc.dataUrl || null,
                                previewUrl: doc.previewUrl || null
                              };
                            }));
                            sanitizedNewBom.deliveryAddressProofDocs = uploadedDeliveryDocs;
                            sanitizedNewBom.deliveryAddressProofDoc = uploadedDeliveryDocs[0] || null;
                          } catch (err) {
                            console.warn('Error uploading delivery proof docs:', err);
                          }
                        }

                        // Upload attached payment proof files to private Supabase Storage
                        if (paymentDocs.length > 0) {
                          try {
                            const uploadedPaymentDocs = await Promise.all(paymentDocs.map(async (doc, idx) => {
                              if (doc && doc._rawFile) {
                                try {
                                  const meta = await uploadBomDocumentFile({
                                    file: doc._rawFile,
                                    bomCode: finalAssignedCode,
                                    category: `payment-proof-${idx + 1}`
                                  });
                                  return meta;
                                } catch (upErr) {
                                  console.warn('Storage upload fallback, keeping local payment proof:', upErr);
                                }
                              }
                              return {
                                name: doc.name || `Payment_Slip_${idx + 1}`,
                                size: doc.size || 'Attached',
                                mimeType: doc.mimeType || 'image/jpeg',
                                uploadedAt: new Date().toISOString(),
                                dataUrl: doc.dataUrl || null,
                                previewUrl: doc.previewUrl || null
                              };
                            }));
                            sanitizedNewBom.paymentProofDocs = uploadedPaymentDocs;
                            sanitizedNewBom.paymentProofDoc = uploadedPaymentDocs[0] || null;
                            if (sanitizedNewBom.payments) {
                              sanitizedNewBom.payments.proofDocObjs = uploadedPaymentDocs;
                              sanitizedNewBom.payments.proofDocObj = uploadedPaymentDocs[0] || null;
                              sanitizedNewBom.payments.proofDocs = uploadedPaymentDocs.map(d => d.originalName || d.name);
                              sanitizedNewBom.payments.proofDoc = uploadedPaymentDocs[0]?.originalName || uploadedPaymentDocs[0]?.name || null;
                            }
                          } catch (err) {
                            console.warn('Error uploading payment proof docs:', err);
                          }
                        }

                        // Stage: Reserving inventory & stock allocation
                        setBomSubmitStage('reserving');
                        if (!isDraft && Array.isArray(sanitizedNewBom.items) && sanitizedNewBom.items.length > 0) {
                          blockInventoryForBom(sanitizedNewBom.items, finalAssignedCode);
                          sanitizedNewBom.stockBlocked = true;
                          sanitizedNewBom.stockBlockedAt = new Date().toISOString();
                          sanitizedNewBom.stockDeducted = true;
                        }

                        // Stage: Saving to cloud & local storage
                        setBomSubmitStage('saving');
                        const current = Array.isArray(bomStore) ? bomStore : [];
                        const filtered = current.filter(item => {
                          if (!item) return false;
                          if (item.bomCode === finalAssignedCode || item.code === finalAssignedCode || item.id === finalAssignedCode) return false;
                          if (sanitizedNewBom.sourcePiNo && String(item.sourcePiNo || item.piNo || '').trim().toLowerCase() === String(sanitizedNewBom.sourcePiNo).trim().toLowerCase()) {
                            return false;
                          }
                          return true;
                        });
                        const combined = [sanitizedNewBom, ...filtered];
                        const { list: updatedList } = resolveBomCollisions(combined, 662);
                        setBomStore(updatedList);

                        // Safe browser localStorage backup per Rule 5 (local UI convenience only)
                        safeSaveBomStoreToLocal(updatedList);

                        // Atomically push created BOM order to Supabase and Node server API
                        saveCloudBomRow(sanitizedNewBom);
                        try {
                          fetch('/api/boms', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ bom: stripDataUrlsFromRecord(sanitizedNewBom), isUpdate: false })
                          }).catch(err => console.error('Error syncing created BOM to server:', err));
                        } catch (_) {}

                        // If converted from a Proforma Invoice, update the PI stores so PI knows its BOM number
                        if (sanitizedNewBom.sourcePiNo) {
                          try {
                            const piNum = String(sanitizedNewBom.sourcePiNo).trim();
                            const updatePiRecords = (storeKey) => {
                              try {
                                const raw = localStorage.getItem(storeKey);
                                if (raw) {
                                  const list = JSON.parse(raw);
                                  if (Array.isArray(list)) {
                                    const updated = list.map(item => {
                                      const iNum = String(item.piNo || item.estimate_number || item.id || '').trim();
                                      if (iNum.toLowerCase() === piNum.toLowerCase()) {
                                        return {
                                          ...item,
                                          status: 'Converted to BOM',
                                          statusType: 'converted',
                                          convertedToBom: true,
                                          convertedBomNo: finalAssignedCode,
                                          convertedBomCode: finalAssignedCode,
                                          convertedAt: new Date().toISOString()
                                        };
                                      }
                                      return item;
                                    });
                                    localStorage.setItem(storeKey, JSON.stringify(updated));
                                    const piCtrl = new AbortController();
                                    const piTId = setTimeout(() => piCtrl.abort(), 1200);
                                    fetch(`/api/store/${storeKey.replace('controlroom_', '')}`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify(updated),
                                      signal: piCtrl.signal
                                    }).catch(() => {}).finally(() => clearTimeout(piTId));
                                    saveCloudStore(storeKey.replace('controlroom_', ''), updated);
                                  }
                                }
                              } catch (_) {}
                            };
                            updatePiRecords('controlroom_sales_pi_store');
                            updatePiRecords('controlroom_procurement_pi_store');
                            window.dispatchEvent(new CustomEvent('controlroom_pi_store_updated', { 
                              detail: { piNo: piNum, bomCode: finalAssignedCode } 
                            }));
                          } catch (e) {
                            console.error('Error updating PI records with BOM code:', e);
                          }
                        }

                        try {
                          window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: sanitizedNewBom } }));
                          window.dispatchEvent(new Event('controlroom_storage_update'));
                        } catch (e) { }

                        // Stage: Completed!
                        setBomSubmitStage('completed');
                        await new Promise(res => setTimeout(res, 650));

                        setShowBOMForm(false);
                        setBomConfirmModal(null);
                        setCurrentPage(1);

                        // 3. If sent to dispatch, trigger live notifications and synthesized sound
                        if (!isDraft) {
                          notifyBomSentToDispatch({
                            bomCode: finalAssignedCode,
                            customerName: sanitizedNewBom.companyName || sanitizedNewBom.customerName,
                            salesPerson: sanitizedNewBom.salesPerson
                          });
                          alert(sanitizedNewBom.sourcePiNo
                            ? `✅ BOM (${finalAssignedCode}) successfully created from Proforma Invoice (${sanitizedNewBom.sourcePiNo}) and sent to Dispatch for packing!`
                            : `✅ BOM (${finalAssignedCode}) successfully created and sent to Dispatch for packing!`);
                        } else {
                          alert(sanitizedNewBom.sourcePiNo
                            ? `📝 BOM (${finalAssignedCode}) saved as Draft from Proforma Invoice (${sanitizedNewBom.sourcePiNo}).`
                            : `📝 BOM (${finalAssignedCode}) saved as Draft.`);
                        }

                        setNewBomPaymentProofDoc(null);
                        setNewBomDeliveryProofDoc(null);
                        setNewBomRemarks('');
                        setNewBomTransportMode('Transport');
                        setNewBomTransporterName('');
                        setNewBomDestination('');
                        setNewBomVehicleNo('');
                        setNewBomTransportScope('VRM Structures');
                        setNewBomLrNo('');
                        setNewBomCreditDays(7);
                        setNewBomPaymentType('100% Paid');
                        setNewBomProductName('');
                        setBomMaterialsList([]);
                        setSelectedPreset('');
                        setPresetKitPrice('');
                        setPresetSetCount(1);
                        setPresetGroups({});
                        setNewBomCode('');
                        setNewBomSourcePiNo('');
                        setNewBomCompanyName('');
                        setNewBomContactPerson('');
                        setNewBomPhone('');
                        setNewBomEmail('');
                        setNewBomGstNo('');
                        setNewBomBillingStreet('');
                        setNewBomBillingCity('');
                        setNewBomBillingState('');
                        setNewBomBillingPincode('');
                        setNewBomDeliveryStreet('');
                        setNewBomDeliveryCity('');
                        setNewBomDeliveryState('');
                        setNewBomDeliveryPincode('');
                        setSameAsBilling(true);
                      } catch (err) {
                        console.error('BOM creation error:', err);
                        alert('Error creating BOM: ' + (err.message || 'Please check your connection and try again.'));
                      } finally {
                        isSubmittingBomRef.current = false;
                        setIsSubmittingBom(false);
                        setBomSubmitStage('');
                        setBomSubmitAssignedCode('');
                      }
                    }
                  }}
                  style={{
                    border: 'none',
                    backgroundColor: bomConfirmModal === 'cancel' ? '#DC2626' : bomConfirmModal === 'draft' ? '#0E7490' : '#166534',
                    color: 'white',
                    padding: '9px 20px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: isSubmittingBom ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingBom ? 0.7 : 1,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {isSubmittingBom ? (
                    <>
                      <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>{bomConfirmModal === 'draft' ? 'Saving Draft...' : 'Creating BOM Order...'}</span>
                    </>
                  ) : (
                    <>
                      {bomConfirmModal === 'cancel' && 'Yes, Discard'}
                      {bomConfirmModal === 'draft' && 'Yes, Save Draft'}
                      {bomConfirmModal === 'create' && 'Yes, Confirm & Create'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FULL-SCREEN BOM CREATION LOADING OVERLAY */}
        {renderBomSubmittingOverlay()}

        {/* DOCUMENT PREVIEW MODAL */}
        {renderDocPreviewModal()}

        {/* CUSTOM MANDATORY VALIDATION MODAL */}
        {renderValidationErrorModal()}
      </div>
    );
  }

  // ==========================================
  // RENDER 2: CONFIRMING / EDITING BOM MODAL
  // ==========================================
  if (confirmingBomModal) {
    const isCancelled = Boolean(
      confirmingBomModal.cancelled ||
      confirmingBomModal.status === 'Cancelled' ||
      confirmingBomModal.status === 'Cancelled & Stock Restored' ||
      (typeof confirmingBomModal.status === 'string' && confirmingBomModal.status.toLowerCase().includes('cancel'))
    );
    const isEditMode = Boolean(
      !isCeo &&
      !isCancelled &&
      confirmingBomModal.isEditMode !== false &&
      ['Draft', 'Pending Confirmation', 'Pending Sales Confirmation', 'Edited / Pending Confirmation', 'Cancelled & Reissued to Dispatch', 'ACTIVE', 'Active', 'Pending Verification', 'Pending'].includes(confirmingBomModal.status || 'Pending Sales Confirmation')
    );
    const isAlreadyForwarded = !isEditMode;
    const isSourcePiLocked = Boolean(confirmingBomModal.sourcePiNo);

    const modalPresetGroups = (Array.isArray(confirmingBomModal.presetGroups) && confirmingBomModal.presetGroups.length > 0)
      ? confirmingBomModal.presetGroups.map(g => ({ ...g }))
      : (confirmingBomModal.presetName || (cleanNum(confirmingBomModal.presetKitPrice) > 0))
        ? [{
            presetName: confirmingBomModal.presetName || 'Pre-Engineered Structure Kit Package',
            setCount: parseInt(confirmingBomModal.presetSetCount) || 1,
            kitPrice: cleanNum(confirmingBomModal.presetKitPrice) || 0
          }]
        : [];

    let presetKitsTotal = modalPresetGroups.reduce((acc, g) => acc + ((cleanNum(g.kitPrice) || 0) * (parseInt(g.setCount) || 1)), 0) || (cleanNum(confirmingBomModal.presetKitPrice) || 0);
    const customItemsTotal = (confirmingBomModal.items || []).reduce((acc, it) => acc + ((cleanNum(it.qty) || 0) * (cleanNum(it.rate) || 0)), 0);

    // Fallback: If presetKitsTotal is 0, but the BOM has items with rate 0 and grandTotal > customItemsTotal, compute preset package price
    if (presetKitsTotal === 0 && (confirmingBomModal.items || []).some(it => it.isPresetItem || cleanNum(it.rate || 0) === 0)) {
      const gTotal = cleanNum(confirmingBomModal.grandTotal) || 0;
      const sTotal = cleanNum(confirmingBomModal.subTotal) || (gTotal > 0 ? (gTotal / 1.18) : 0);
      if (sTotal > customItemsTotal) {
        presetKitsTotal = Math.max(0, Math.round((sTotal - customItemsTotal) * 100) / 100);
        if (modalPresetGroups.length === 0) {
          modalPresetGroups.push({
            presetName: confirmingBomModal.presetName || 'Pre-Engineered Structure Kit Package',
            setCount: parseInt(confirmingBomModal.presetSetCount) || 1,
            kitPrice: presetKitsTotal
          });
        } else if (modalPresetGroups.length === 1 && (cleanNum(modalPresetGroups[0].kitPrice) || 0) === 0) {
          modalPresetGroups[0].kitPrice = presetKitsTotal / (parseInt(modalPresetGroups[0].setCount) || 1);
        }
      }
    }

    const calculatedSubtotal = presetKitsTotal + customItemsTotal;
    const orderSubTotal = cleanNum(confirmingBomModal.subTotal) || calculatedSubtotal;
    const orderGrandTotal = cleanNum(confirmingBomModal.grandTotal) || (calculatedSubtotal > 0 ? Math.round(calculatedSubtotal * 1.18 * 100) / 100 : 0);
    const orderGstAmount = cleanNum(confirmingBomModal.gstAmount) || (orderGrandTotal > orderSubTotal ? Math.round((orderGrandTotal - orderSubTotal) * 100) / 100 : Math.round(orderSubTotal * 0.18 * 100) / 100);
    const grandTotalCalc = orderGrandTotal;

    let sourcePi = null;
    const piNum = confirmingBomModal.sourcePiNo || confirmingBomModal.piNo;
    if (piNum) {
      try {
        const rawPis = localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('controlroom_proforma_invoice_store');
        if (rawPis) {
          const parsedPis = JSON.parse(rawPis);
          if (Array.isArray(parsedPis)) {
            sourcePi = parsedPis.find(p => {
              const pNo = String(p.piNo || p.estimate_number || p.id || '').trim().toLowerCase();
              return pNo === String(piNum).trim().toLowerCase();
            });
          }
        }
      } catch (e) {}
    }

    const rawBObj = (confirmingBomModal.billingAddressObj && typeof confirmingBomModal.billingAddressObj === 'object' && Object.keys(confirmingBomModal.billingAddressObj).length > 0)
      ? confirmingBomModal.billingAddressObj
      : (confirmingBomModal.billingAddress && typeof confirmingBomModal.billingAddress === 'object'
          ? confirmingBomModal.billingAddress
          : (sourcePi?.billingAddressObj && typeof sourcePi.billingAddressObj === 'object' && Object.keys(sourcePi.billingAddressObj).length > 0
              ? sourcePi.billingAddressObj
              : (sourcePi?.billingAddress && typeof sourcePi.billingAddress === 'object' ? sourcePi.billingAddress : {})));

    const rawDObj = (confirmingBomModal.deliveryAddressObj && typeof confirmingBomModal.deliveryAddressObj === 'object' && Object.keys(confirmingBomModal.deliveryAddressObj).length > 0)
      ? confirmingBomModal.deliveryAddressObj
      : (confirmingBomModal.deliveryAddress && typeof confirmingBomModal.deliveryAddress === 'object'
          ? confirmingBomModal.deliveryAddress
          : (sourcePi?.deliveryAddressObj && typeof sourcePi.deliveryAddressObj === 'object' && Object.keys(sourcePi.deliveryAddressObj).length > 0
              ? sourcePi.deliveryAddressObj
              : (sourcePi?.deliveryAddress && typeof sourcePi.deliveryAddress === 'object' ? sourcePi.deliveryAddress : {})));

    const resolvedBStreet = confirmingBomModal.billingStreet || rawBObj.street || rawBObj.address || sourcePi?.billingStreet || (typeof confirmingBomModal.billingAddress === 'string' && !confirmingBomModal.billingAddress.includes('on file') ? confirmingBomModal.billingAddress : '') || (typeof sourcePi?.billingAddress === 'string' ? sourcePi.billingAddress : '') || '';
    const resolvedBCity = confirmingBomModal.billingCity || rawBObj.city || sourcePi?.billingCity || '';
    const resolvedBState = confirmingBomModal.billingState || rawBObj.state || sourcePi?.billingState || '';
    const resolvedBPincode = confirmingBomModal.billingPincode || rawBObj.pincode || rawBObj.pin || sourcePi?.billingPincode || '';

    const bObj = {
      address: resolvedBStreet,
      street: resolvedBStreet,
      city: resolvedBCity,
      state: resolvedBState,
      pincode: resolvedBPincode
    };

    const isSameAddr = confirmingBomModal.sameAsBilling !== false && (!rawDObj.address && !rawDObj.street || (rawDObj.address || rawDObj.street) === (rawBObj.address || rawBObj.street));

    const resolvedDStreet = isSameAddr && resolvedBStreet
      ? resolvedBStreet
      : (confirmingBomModal.deliveryStreet || rawDObj.street || rawDObj.address || sourcePi?.deliveryStreet || (typeof confirmingBomModal.deliveryAddress === 'string' && !confirmingBomModal.deliveryAddress.includes('on file') ? confirmingBomModal.deliveryAddress : '') || resolvedBStreet);
    const resolvedDCity = isSameAddr && resolvedBCity ? resolvedBCity : (confirmingBomModal.deliveryCity || rawDObj.city || sourcePi?.deliveryCity || resolvedBCity);
    const resolvedDState = isSameAddr && resolvedBState ? resolvedBState : (confirmingBomModal.deliveryState || rawDObj.state || sourcePi?.deliveryState || resolvedBState);
    const resolvedDPincode = isSameAddr && resolvedBPincode ? resolvedBPincode : (confirmingBomModal.deliveryPincode || rawDObj.pincode || rawDObj.pin || sourcePi?.deliveryPincode || resolvedBPincode);

    const dObj = {
      address: resolvedDStreet,
      street: resolvedDStreet,
      city: resolvedDCity,
      state: resolvedDState,
      pincode: resolvedDPincode
    };

    const formatAddr = (obj, fallbackStr) => {
      if (!obj) return fallbackStr || '—';
      const { address, street, city, state, pincode } = obj;
      const addrLine = address || street || '';
      const parts = [];
      if (addrLine && addrLine.trim() && addrLine.trim() !== '—') parts.push(addrLine.trim());
      if (city && city.trim() && city.trim() !== '—') parts.push(city.trim());
      if (state && state.trim() && state.trim() !== '—' && pincode && pincode.trim() && pincode.trim() !== '—') {
        parts.push(`${state.trim()} - ${pincode.trim()}`);
      } else {
        if (state && state.trim() && state.trim() !== '—') parts.push(state.trim());
        if (pincode && pincode.trim() && pincode.trim() !== '—') parts.push(pincode.trim());
      }
      return parts.length > 0 ? parts.join(', ') : (fallbackStr || '—');
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                {isCancelled
                  ? `BOM Order (Cancelled) — ${confirmingBomModal.bomCode}`
                  : (isAlreadyForwarded ? `BOM Details & Order Summary — ${confirmingBomModal.bomCode}` : `BOM Verification & Order Editing — ${confirmingBomModal.bomCode}`)}
              </h1>
              {isCancelled && (
                <span style={{
                  backgroundColor: '#FEE2E2', color: '#DC2626',
                  fontSize: '11px', fontWeight: '800', padding: '3px 10px',
                  borderRadius: '12px', border: '1px solid #FECACA'
                }}>
                  CANCELLED • VIEW ONLY
                </span>
              )}
              {isCeo && (
                <span style={{
                  backgroundColor: '#ECFEFF', color: '#0E7490',
                  fontSize: '11px', fontWeight: '800', padding: '3px 10px',
                  borderRadius: '12px', border: '1px solid #A5F3FC',
                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  👁️ EXECUTIVE VIEW ONLY
                </span>
              )}
            </div>
            <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', display: 'block' }}>
              {isCancelled
                ? 'This BOM was cancelled and reserved stock was released back into inventory.'
                : (isAlreadyForwarded
                  ? 'Review verified bill of materials, product breakdown, and order specifications.'
                  : 'Review & modify company details, billing/delivery addresses, payment terms, or product specifications before final dispatch.')}
            </span>
            {confirmingBomModal.sourcePiNo && (
              <div style={{
                marginTop: '10px',
                backgroundColor: '#ECFEFF',
                border: '1px solid #A5F3FC',
                borderRadius: '8px',
                padding: '6px 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '12px', color: '#0E7490', fontWeight: '700' }}>
                  🔗 Converted from Proforma Invoice: <strong>{confirmingBomModal.sourcePiNo}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const piTarget = confirmingBomModal.sourcePiNo;
                    setConfirmingBomModal(null);
                    window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', { 
                      detail: { tab: 'Proforma Invoice', targetPi: piTarget } 
                    }));
                    if (typeof props.onChangeTab === 'function') {
                      props.onChangeTab('Proforma Invoice');
                    }
                  }}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '6px',
                    border: '1px solid #0E7490',
                    backgroundColor: '#FFFFFF',
                    color: '#0E7490',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  View PI ({confirmingBomModal.sourcePiNo}) ↗
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => setExportFormatRecord(confirmingBomModal)}
              title="Export BOM (PDF, JPG, or CSV)"
              style={{
                border: '1px solid #0E7490',
                backgroundColor: '#ECFEFF',
                color: '#0E7490',
                height: '40px',
                padding: '0 18px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <Download size={15} style={{ color: '#0E7490' }} /> Export
            </button>
            <button
              onClick={() => setConfirmingBomModal(null)}
              style={{ border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', height: '40px', padding: '0 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
            >
              Back to BOM Dashboard
            </button>

            {canCancelBom && !isCancelled && confirmingBomModal.status !== 'Cancelled & Stock Restored' && (
              <button
                onClick={() => handleCancelBomOrder(confirmingBomModal)}
                style={{
                  border: '1px solid #FECACA',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  height: '40px',
                  padding: '0 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <XCircle style={{ width: '16px', height: '16px' }} />
                Cancel BOM & Restore Stock
              </button>
            )}


            {isAlreadyForwarded && !isCeo && ['Partial Paid', 'Partial Payment', 'Payment While Dispatch', 'Credit Payment'].includes(confirmingBomModal.paymentType) && (
              <button
                type="button"
                onClick={() => {
                  const target = confirmingBomModal;
                  setConfirmingBomModal(null);
                  setUploadPaymentModal(target);
                }}
                style={{
                  border: 'none',
                  backgroundColor: '#0E7490',
                  color: 'white',
                  height: '40px',
                  padding: '0 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(14,116,144,0.3)'
                }}
              >
                <CreditCard style={{ width: '15px', height: '15px' }} /> Update Payment Details
              </button>
            )}

            {!isAlreadyForwarded && (
              <button
                onClick={() => {
                  const isDeliveryMatching = Boolean(confirmingBomModal.sameAsBilling) || (
                    ((dObj.address || '').trim() === (bObj.address || '').trim()) &&
                    ((dObj.city || '').trim() === (bObj.city || '').trim()) &&
                    ((dObj.state || '').trim() === (bObj.state || '').trim()) &&
                    ((dObj.pincode || '').trim() === (bObj.pincode || '').trim())
                  );



                  const currentItemsList = confirmingBomModal.items || [];
                  const unconfirmedItems = currentItemsList.filter(it => !it.confirmed);
                  if (unconfirmedItems.length > 0) {
                    alert(`⚠️ Please confirm all products first!\n\n${unconfirmedItems.length} product(s) still need to be verified with the tick mark (✓) or click "Confirm All Products" below before sending BOM to Dispatch.`);
                    return;
                  }

                  const currentPayType = confirmingBomModal.paymentType;
                  const is100OrPartial = currentPayType === '100% Paid' || currentPayType === '100% Advance' || currentPayType === 'Partial Paid' || currentPayType === 'Partial Payment';
                  const hasProof = Boolean(
                    confirmingBomModal.paymentProofDoc ||
                    confirmingBomModal.payments?.proofDocObj ||
                    confirmingBomModal.payments?.proofDoc ||
                    confirmingBomModal.proofDoc ||
                    confirmingBomModal.proofDocData
                  );
                  if (is100OrPartial && !hasProof) {
                    alert(`⚠️ Payment Attachment / Slip is strictly mandatory for "${currentPayType}"!\n\nPlease attach the bank slip/advice before sending this BOM to Dispatch.`);
                    return;
                  }

                  setIsConfirmingForward(true);
                  try {
                    const bStr = formatAddr(bObj, confirmingBomModal.billingAddress);
                    const dStr = confirmingBomModal.sameAsBilling ? bStr : formatAddr(dObj, confirmingBomModal.deliveryAddress);
                    const finalDObj = confirmingBomModal.sameAsBilling ? { ...bObj } : { ...dObj };

                    const finalizedItems = currentItemsList.map(i => ({ ...i, confirmed: true }));
                  const packingItems = (confirmingBomModal.dispatchPacking && confirmingBomModal.dispatchPacking.length > 0)
                    ? confirmingBomModal.dispatchPacking
                    : finalizedItems.map(it => ({
                      name: it.name || it.c2 || 'Item',
                      bomQty: it.qty || 1,
                      packed: false
                    }));

                  // Ensure inventory is blocked upon verification if not already blocked
                  if (!confirmingBomModal.stockBlocked && !confirmingBomModal.stockDeducted) {
                    blockInventoryForBom(finalizedItems, confirmingBomModal.bomCode);
                  }

                  const updatedBomData = {
                    ...confirmingBomModal,
                    companyName: confirmingBomModal.companyName,
                    paymentType: confirmingBomModal.paymentType,
                    billingAddress: bStr,
                    billingAddressObj: bObj,
                    deliveryAddress: dStr,
                    deliveryAddressObj: finalDObj,
                    deliveryAddressProofDoc: confirmingBomModal.sameAsBilling ? null : (confirmingBomModal.deliveryAddressProofDoc || null),
                    items: finalizedItems,
                    dispatchPacking: packingItems,
                    salesPerson: (confirmingBomModal.salesPerson || confirmingBomModal.createdBy || 'Sales Department').replace(/\s*\([^)]*\)/g, '').trim(),
                    status: 'Sales Confirmed - Sent to Dispatch',
                    salesConfirmed: true,
                    salesConfirmedAt: new Date().toISOString(),
                    stockBlocked: true,
                    stockBlockedAt: confirmingBomModal.stockBlockedAt || new Date().toISOString(),
                    stockDeducted: true,
                    addressProofReuploadRequested: false,
                    subTotal: cleanNum(confirmingBomModal.subTotal, orderSubTotal),
                    gstAmount: cleanNum(confirmingBomModal.gstAmount, orderGstAmount),
                    grandTotal: cleanNum(confirmingBomModal.grandTotal, orderGrandTotal)
                  };

                  const updatedList = (bomStore || []).map(b => b.bomCode === confirmingBomModal.bomCode ? {
                    ...b,
                    ...updatedBomData
                  } : b);
                  setBomStore(updatedList);
                  safeSaveBomStoreToLocal(updatedList);

                  // Push to Supabase and server immediately so Dispatch sees it in real time
                  saveCloudBomRow(updatedBomData);
                  try {
                    fetch('/api/boms', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ bom: stripDataUrlsFromRecord(updatedBomData), isUpdate: true })
                    }).catch(err => console.error('Error updating BOM to Dispatch:', err));
                  } catch (_) {}

                  try {
                    window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: updatedBomData } }));
                    window.dispatchEvent(new Event('controlroom_storage_update'));
                  } catch (_) {}

                  // Trigger Real-time Workflow Notification with synthesized sound & deep-link to Dispatch Orders
                  notifyBomSentToDispatch({
                    bomCode: confirmingBomModal.bomCode,
                    customerName: confirmingBomModal.companyName || confirmingBomModal.customerName,
                    salesPerson: confirmingBomModal.salesPerson
                  });

                  setConfirmingBomModal(null);
                  alert(`✅ BOM (${confirmingBomModal.bomCode}) successfully verified by Sales and forwarded to Dispatch!`);
                } finally {
                  setIsConfirmingForward(false);
                }
              }}
              disabled={isConfirmingForward}
              style={{
                border: 'none',
                backgroundColor: '#0E7490',
                color: 'white',
                height: '40px',
                padding: '0 24px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: '800',
                cursor: isConfirmingForward ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(14,116,144,0.3)',
                opacity: isConfirmingForward ? 0.7 : 1
              }}
            >
              {isConfirmingForward ? (
                <>
                  <RotateCcw style={{ width: '16px', height: '16px', animation: 'spin 0.75s linear infinite' }} />
                  Forwarding to Dispatch...
                </>
              ) : (
                <>
                  <CheckCircle style={{ width: '16px', height: '16px' }} />
                  Confirm BOM & Send to Dispatch
                </>
              )}
            </button>
            )}
          </div>
        </div>

        {/* CANCELLATION ALERT BANNER */}
        {isCancelled && (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1.5px solid #FCA5A5',
            borderRadius: '14px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px',
            boxShadow: '0 4px 12px rgba(220, 38, 38, 0.08)'
          }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              backgroundColor: '#DC2626', color: '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <XCircle style={{ width: '22px', height: '22px' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15px', fontWeight: '900', color: '#991B1B' }}>
                  This BOM was Cancelled
                </span>
                <span style={{
                  backgroundColor: '#FFFFFF', color: '#DC2626',
                  fontSize: '11px', fontWeight: '800', padding: '2px 8px',
                  borderRadius: '6px', border: '1px solid #FECACA'
                }}>
                  Non-Editable • Stock Restored
                </span>
              </div>
              <div style={{ marginTop: '6px', fontSize: '13px', color: '#7F1D1D', lineHeight: 1.5 }}>
                <strong>Reason:</strong> {confirmingBomModal.cancellationReason || 'Order cancelled by Dispatch'}
              </div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '16px', fontSize: '11px', color: '#991B1B', flexWrap: 'wrap', alignItems: 'center' }}>
                <span>
                  <strong>Cancelled By:</strong>{' '}
                  <strong style={{ color: '#7F1D1D' }}>
                    {confirmingBomModal.cancelledBy || 'Authorized Personnel'}
                  </strong>
                  {(confirmingBomModal.cancelledByRole || confirmingBomModal.cancelledByTeam) && (
                    <span style={{
                      marginLeft: '6px',
                      backgroundColor: '#FFFFFF',
                      color: '#991B1B',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid #FECACA',
                      fontWeight: '800'
                    }}>
                      {confirmingBomModal.cancelledByRole || ''}
                      {confirmingBomModal.cancelledByRole && confirmingBomModal.cancelledByTeam ? ` • ${confirmingBomModal.cancelledByTeam}` : (confirmingBomModal.cancelledByTeam || '')}
                    </span>
                  )}
                </span>
                <span>•</span>
                <span><strong>Cancelled At:</strong> {confirmingBomModal.cancelledAt ? new Date(confirmingBomModal.cancelledAt).toLocaleString('en-IN') : 'Recently'}</span>
                <span>•</span>
                <span><strong>Sales Person Notified:</strong> {(confirmingBomModal.salesPerson || 'Sales Executive').replace(/\s*\([^)]*\)/g, '').trim()}</span>
              </div>
            </div>
          </div>
        )}

        {/* ORDER DETAILS & ADDRESSES */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isAlreadyForwarded ? 'BILL OF MATERIALS SUMMARY' : 'ORDER DETAILS & ADDRESSES'}
            </span>
            <span style={{
              backgroundColor: isAlreadyForwarded ? '#DCFCE7' : '#FEF3C7',
              color: isAlreadyForwarded ? '#166534' : '#B45309',
              padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '800', display: 'inline-block'
            }}>
              {confirmingBomModal.status}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div>
              <label htmlFor="bom-orders-customer-name" style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '6px' }}>
                CUSTOMER NAME
              </label>
              <input id="bom-orders-customer-name" name="cUSTOMERNAME" aria-label="CUSTOMER NAME"
                type="text"
                value={confirmingBomModal.customerName}
                readOnly
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#475569', backgroundColor: '#F8FAFC', outline: 'none', cursor: 'not-allowed', boxSizing: 'border-box' }}
               />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                COMPANY NAME {!isAlreadyForwarded && <span style={{ color: '#2563EB', fontSize: '10px' }}>(Editable)</span>}
              </label>
              {isAlreadyForwarded ? (
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', height: '40px', display: 'flex', alignItems: 'center' }}>
                  {confirmingBomModal.companyName || confirmingBomModal.customerName || '—'}
                </div>
              ) : (
                <input id="bom-orders-company-name" name="companyName" aria-label="Company Name"
                  type="text"
                  placeholder="Company Name..."
                  value={confirmingBomModal.companyName || ''}
                  onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, companyName: e.target.value })}
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: '#0F172A', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }}
                 />
              )}
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                PAYMENT TYPE {(!isAlreadyForwarded || confirmingBomModal.isEditMode) && <span style={{ color: '#2563EB', fontSize: '10px' }}>(Editable)</span>}
              </label>
              {isAlreadyForwarded && !confirmingBomModal.isEditMode ? (
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#2563EB', height: '40px', display: 'flex', alignItems: 'center' }}>
                  {confirmingBomModal.paymentType || '100% Paid'}
                </div>
              ) : (
                <select id="bom-orders-payment-type-50-advance" name="paymentType50Advance" aria-label="PaymentType 50 Advance"
                  value={confirmingBomModal.paymentType || '50% Advance + 50% Dispatch'}
                  onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, paymentType: e.target.value })}
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#2563EB', backgroundColor: '#FFFFFF', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                >
                  <option value="100% Paid">100% Paid</option>
                  <option value="Partial Paid">Partial Paid</option>
                  <option value="Payment While Dispatch">Payment While Dispatch</option>
                  <option value="Credit Payment">Credit Payment</option>
                </select>
              )}
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490', display: 'block', marginBottom: '6px' }}>
                SALES PERSON / CREATOR
              </label>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0E7490', height: '40px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F0FDFA', padding: '0 12px', borderRadius: '8px', border: '1px solid #CCFBF1' }}>
                <User size={14} style={{ color: '#0E7490', flexShrink: 0 }} /> {(confirmingBomModal.salesPerson || confirmingBomModal.createdBy || defaultSalesPersonName).replace(/\s*\([^)]*\)/g, '').trim()}
              </div>
            </div>
          </div>

          {/* Contact Details & GSTIN */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', backgroundColor: '#F8FAFC', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>CONTACT PERSON</span>
              <strong style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: '700' }}>{confirmingBomModal.contactPerson || '—'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>PHONE</span>
              <strong style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: '700' }}>{confirmingBomModal.mobile || confirmingBomModal.phone || '—'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>EMAIL</span>
              <strong style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: '700', wordBreak: 'break-all' }}>{confirmingBomModal.email || '—'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>GSTIN</span>
              <strong style={{ fontSize: '12.5px', color: '#0E7490', fontWeight: '800' }}>{confirmingBomModal.gstNo || confirmingBomModal.gstin || '—'}</strong>
            </div>
          </div>

          {(confirmingBomModal.paymentType === 'Partial Paid' || confirmingBomModal.paymentType === 'Partial Payment') && (
            <div style={{ backgroundColor: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <label htmlFor="bom-orders-partial-amount" style={{ fontSize: '12px', fontWeight: '800', color: '#0F766E', whiteSpace: 'nowrap' }}>
                  Advance Amount (₹):
                </label>
                {confirmingBomModal.isEditMode ? (
                  <input id="bom-orders-partial-amount" name="partialAmount" aria-label="Advance Amount (₹)
                
                {confirmingBomModal.isEditMode ? ("
                    type="number"
                    min="0"
                    step="any"
                    value={confirmingBomModal.partialAmount != null ? confirmingBomModal.partialAmount : ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      const gTot = Number(confirmingBomModal.grandTotal || confirmingBomModal.subTotal || 0);
                      setConfirmingBomModal({
                        ...confirmingBomModal,
                        partialAmount: val,
                        balanceAmount: Math.max(0, gTot - val)
                      });
                    }}
                    style={{ height: '36px', width: '160px', borderRadius: '6px', border: '1px solid #5EEAD4', padding: '0 10px', fontSize: '13px', fontWeight: '700', color: '#0F172A', outline: 'none' }}
                   />
                ) : (
                  <strong style={{ fontSize: '13px', color: '#0F766E' }}>
                    ₹{Number(confirmingBomModal.partialAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#115E59' }}>
                <span>Balance Due:</span>
                <strong style={{ fontSize: '13px', color: '#0F766E' }}>
                  ₹{Number(confirmingBomModal.balanceAmount != null ? confirmingBomModal.balanceAmount : Math.max(0, (confirmingBomModal.grandTotal || 0) - (confirmingBomModal.partialAmount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          )}

          {/* Structured Address Cards */}
          {(() => {
            const bStreet = bObj.address || bObj.street || (typeof confirmingBomModal.billingAddress === 'string' ? confirmingBomModal.billingAddress : '') || '—';
            const bCity = bObj.city || '—';
            const bState = bObj.state || '—';
            const bPin = bObj.pincode || '—';

            const dStreet = dObj.address || dObj.street || (typeof confirmingBomModal.deliveryAddress === 'string' ? confirmingBomModal.deliveryAddress : '') || bStreet;
            const dCity = dObj.city || bCity;
            const dState = dObj.state || bState;
            const dPin = dObj.pincode || bPin;

            const isDeliveryMatching = Boolean(confirmingBomModal.sameAsBilling) || (
              ((dObj.address || '').trim() === (bObj.address || '').trim()) &&
              ((dObj.city || '').trim() === (bObj.city || '').trim()) &&
              ((dObj.state || '').trim() === (bObj.state || '').trim()) &&
              ((dObj.pincode || '').trim() === (bObj.pincode || '').trim())
            );

            if (isAlreadyForwarded) {
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px' }}>
                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800', color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px' }}>
                      <FileText style={{ width: '13px', height: '13px', color: '#2563EB' }} /> Billing Address
                    </div>
                    <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                      <div><strong>Address:</strong> {bStreet}</div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px', color: '#64748B', fontSize: '11px' }}>
                        <span>City: <strong style={{ color: '#334155' }}>{bCity}</strong></span>
                        <span>State: <strong style={{ color: '#334155' }}>{bState}</strong></span>
                        <span>Pincode: <strong style={{ color: '#334155' }}>{bPin}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '800', color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px' }}>
                      <Truck style={{ width: '13px', height: '13px', color: '#0E7490' }} /> Delivery Address
                    </div>
                    <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                      <div><strong>Address:</strong> {dStreet}</div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px', color: '#64748B', fontSize: '11px' }}>
                        <span>City: <strong style={{ color: '#334155' }}>{dCity}</strong></span>
                        <span>State: <strong style={{ color: '#334155' }}>{dState}</strong></span>
                        <span>Pincode: <strong style={{ color: '#334155' }}>{dPin}</strong></span>
                      </div>
                      {confirmingBomModal.deliveryAddressProofDoc ? (
                        <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', color: '#166534' }}>
                            <FileText style={{ width: '13px', height: '13px' }} />
                            Address Proof: {confirmingBomModal.deliveryAddressProofDoc.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setPreviewDocModal({ title: 'Delivery Address Proof Document', doc: confirmingBomModal.deliveryAddressProofDoc })}
                              style={{ border: '1px solid #BBF7D0', background: '#FFFFFF', color: '#166534', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye style={{ width: '12px', height: '12px' }} /> View Image
                            </button>
                            <span style={{ fontSize: '10px', color: '#15803D', fontWeight: '800' }}>Verified</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '4px' }}>
                {/* Editable Billing */}
                <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                      <FileText style={{ width: '14px', height: '14px' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Billing Address</h4>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Editable for order invoice billing</span>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="bom-orders-address" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Address</label>
                    <input id="bom-orders-address" name="address" aria-label="Address"
                      type="text"
                      placeholder="Street Address..."
                      value={bObj.address || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfirmingBomModal({
                          ...confirmingBomModal,
                          billingAddressObj: { ...bObj, address: val },
                          deliveryAddressObj: confirmingBomModal.sameAsBilling ? { ...dObj, address: val } : dObj
                        });
                      }}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                     />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label htmlFor="bom-orders-city" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                      <input id="bom-orders-city" name="city" aria-label="City" type="text" placeholder="City..." value={bObj.city || ''} onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, billingAddressObj: { ...bObj, city: e.target.value } })} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}  />
                    </div>
                    <div>
                      <label htmlFor="bom-orders-state" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                      <input id="bom-orders-state" name="state" aria-label="State" type="text" placeholder="State..." value={bObj.state || ''} onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, billingAddressObj: { ...bObj, state: e.target.value } })} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}  />
                    </div>
                    <div>
                      <label htmlFor="bom-orders-pincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                      <input id="bom-orders-pincode" name="pincode" aria-label="Pincode" type="text" placeholder="Pincode..." value={bObj.pincode || ''} onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, billingAddressObj: { ...bObj, pincode: e.target.value } })} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', backgroundColor: '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}  />
                    </div>
                  </div>
                </div>

                {/* Editable Delivery */}
                <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#ECFEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490' }}>
                        <Truck style={{ width: '14px', height: '14px' }} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Delivery Address</h4>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>Destination for physical dispatch</span>
                      </div>
                    </div>
                    <label htmlFor="bom-orders-same-as-billing" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#0E7490', cursor: 'pointer', backgroundColor: '#ECFEFF', padding: '4px 10px', borderRadius: '8px', border: '1px solid #A5F3FC' }}>
                      <input id="bom-orders-same-as-billing" name="sameAsBilling" aria-label="SameAsBilling"
                        type="checkbox"
                        checked={Boolean(confirmingBomModal.sameAsBilling)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setConfirmingBomModal({
                            ...confirmingBomModal,
                            sameAsBilling: checked,
                            deliveryAddressObj: checked ? { ...bObj } : dObj
                          });
                        }}
                        style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                       />
                      Same as Billing
                    </label>
                  </div>

                  <div>
                    <label htmlFor="bom-orders-address" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Address</label>
                    <input id="bom-orders-address" name="address" aria-label="Address"
                      type="text"
                      placeholder="e.g. Plot No 42, SIDCO Industrial Estate"
                      value={confirmingBomModal.sameAsBilling ? (bObj.address || '') : (dObj.address || '')}
                      disabled={confirmingBomModal.sameAsBilling}
                      onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, deliveryAddressObj: { ...dObj, address: e.target.value } })}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: confirmingBomModal.sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: confirmingBomModal.sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: confirmingBomModal.sameAsBilling ? 'not-allowed' : 'text' }}
                     />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label htmlFor="bom-orders-city" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                      <input id="bom-orders-city" name="city" aria-label="City" type="text" placeholder="e.g. Chennai" value={confirmingBomModal.sameAsBilling ? (bObj.city || '') : (dObj.city || '')} disabled={confirmingBomModal.sameAsBilling} onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, deliveryAddressObj: { ...dObj, city: e.target.value } })} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: confirmingBomModal.sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: confirmingBomModal.sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}  />
                    </div>
                    <div>
                      <label htmlFor="bom-orders-state" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                      <input id="bom-orders-state" name="state" aria-label="State" type="text" placeholder="e.g. Tamil Nadu" value={confirmingBomModal.sameAsBilling ? (bObj.state || '') : (dObj.state || '')} disabled={confirmingBomModal.sameAsBilling} onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, deliveryAddressObj: { ...dObj, state: e.target.value } })} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: confirmingBomModal.sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: confirmingBomModal.sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}  />
                    </div>
                    <div>
                      <label htmlFor="bom-orders-pincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                      <input id="bom-orders-pincode" name="pincode" aria-label="Pincode" type="text" placeholder="e.g. 600058" value={confirmingBomModal.sameAsBilling ? (bObj.pincode || '') : (dObj.pincode || '')} disabled={confirmingBomModal.sameAsBilling} onChange={(e) => setConfirmingBomModal({ ...confirmingBomModal, deliveryAddressObj: { ...dObj, pincode: e.target.value } })} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: confirmingBomModal.sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: confirmingBomModal.sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}  />
                    </div>
                  </div>

                  {!isDeliveryMatching ? (
                    <div style={{ marginTop: '6px', padding: '14px 16px', backgroundColor: '#FEF2F2', border: '1px dashed #F87171', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AlertCircle style={{ width: '14px', height: '14px' }} />
                          </div>
                          <div>
                            <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>
                              Delivery Address Proof Document <span style={{ color: '#64748B', fontWeight: '600' }}>(Optional)</span>
                            </h5>
                            <span style={{ fontSize: '11px', color: '#64748B' }}>Upload proof (GST / Electricity Bill / Lease Agreement) if available.</span>
                          </div>
                        </div>
                        {confirmingBomModal.deliveryAddressProofDoc && (
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle style={{ width: '12px', height: '12px' }} /> Attached
                          </span>
                        )}
                        {confirmingBomModal.addressProofReuploadRequested && (() => {
                          const reqAt = confirmingBomModal.addressProofReuploadRequestedAt || confirmingBomModal.reuploadRequestedAt || confirmingBomModal.reissueRequestedAt;
                          let mLeft = null;
                          if (reqAt) {
                            const ONE_HOUR_MS = 60 * 60 * 1000;
                            mLeft = Math.max(0, Math.ceil((ONE_HOUR_MS - (Date.now() - new Date(reqAt).getTime())) / 60000));
                          }
                          return (
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#991B1B', backgroundColor: '#FEE2E2', padding: '3px 8px', borderRadius: '12px', border: '1px solid #FCA5A5', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              ⏱️ 1-Hr SLA: {mLeft !== null ? `${mLeft}m remaining` : 'Active'}
                            </span>
                          );
                        })()}
                      </div>

                      {confirmingBomModal.deliveryAddressProofDoc && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FECACA' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FileText style={{ width: '16px', height: '16px', color: '#DC2626' }} />
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>{confirmingBomModal.deliveryAddressProofDoc.name}</div>
                                <div style={{ fontSize: '10px', color: '#64748B' }}>{confirmingBomModal.deliveryAddressProofDoc.size || '1.2 MB'} • Current Version</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => setPreviewDocModal({ title: 'Delivery Address Proof Document', doc: confirmingBomModal.deliveryAddressProofDoc })}
                                style={{ border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Eye style={{ width: '13px', height: '13px' }} /> View Image
                              </button>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                <Upload style={{ width: '11px', height: '11px' }} /> Upload New Version
                                <input id="bom-orders-input-3" name="input3" aria-label="Input 3"
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                  style={{ display: 'none' }}
                                  onChange={async (e) => {
                                    const file = e.target.files && e.target.files[0];
                                    if (file) {
                                      try {
                                        validateClientFile(file);
                                        const bCode = confirmingBomModal.bomCode || confirmingBomModal.code || confirmingBomModal.id;
                                        const metadata = await uploadBomDocumentFile({
                                          file,
                                          bomCode: bCode,
                                          category: 'delivery-proof'
                                        });
                                        const prevDoc = confirmingBomModal.deliveryAddressProofDoc || {};
                                        const existingHistory = Array.isArray(prevDoc.history) ? prevDoc.history : [];
                                        const updatedHistory = [...existingHistory, {
                                          name: prevDoc.name || prevDoc.originalName,
                                          size: prevDoc.size,
                                          storageBucket: prevDoc.storageBucket,
                                          storagePath: prevDoc.storagePath,
                                          uploadedAt: prevDoc.uploadedAt || new Date().toISOString()
                                        }];
                                        setConfirmingBomModal(prev => ({
                                          ...prev,
                                          addressProofReuploadRequested: false,
                                          deliveryAddressProofDoc: {
                                            ...metadata,
                                            uploadedAt: new Date().toISOString(),
                                            history: updatedHistory
                                          }
                                        }));
                                      } catch (err) {
                                        e.target.value = '';
                                        alert(`⚠️ Cannot Proceed: ${err.message}`);
                                      }
                                    }
                                  }}
                                 />
                              </label>
                            </div>
                          </div>

                          {/* Render Previous Preserved Versions If Any */}
                          {confirmingBomModal.deliveryAddressProofDoc.history && confirmingBomModal.deliveryAddressProofDoc.history.length > 0 && (
                            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
                                📁 Previous Address Proof Uploads Preserved ({confirmingBomModal.deliveryAddressProofDoc.history.length}):
                              </span>
                              {confirmingBomModal.deliveryAddressProofDoc.history.map((histItem, hIdx) => (
                                <div key={hIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#475569' }}>
                                  <span>• {histItem.name} ({histItem.size || 'Saved'})</span>
                                  <span style={{ fontSize: '10px', color: '#94A3B8' }}>{new Date(histItem.uploadedAt || Date.now()).toLocaleDateString('en-IN')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {!confirmingBomModal.deliveryAddressProofDoc && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #DC2626', color: '#DC2626', padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                            <Upload style={{ width: '13px', height: '13px' }} />
                            Upload Address Proof Document
                            <input id="bom-orders-input-4" name="input4" aria-label="Input 4"
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const file = e.target.files && e.target.files[0];
                                if (file) {
                                  try {
                                    validateClientFile(file);
                                    const bCode = confirmingBomModal.bomCode || confirmingBomModal.code || confirmingBomModal.id;
                                    const metadata = await uploadBomDocumentFile({
                                      file,
                                      bomCode: bCode,
                                      category: 'delivery-proof'
                                    });
                                    setConfirmingBomModal(prev => ({
                                      ...prev,
                                      addressProofReuploadRequested: false,
                                      deliveryAddressProofDoc: {
                                        ...metadata,
                                        uploadedAt: new Date().toISOString(),
                                        history: []
                                      }
                                    }));
                                  } catch (err) {
                                    e.target.value = '';
                                    alert(`⚠️ Cannot Proceed: ${err.message}`);
                                  }
                                }
                              }}
                             />
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#166534', backgroundColor: '#DCFCE7', border: '1px solid #BBF7D0', padding: '8px 12px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle style={{ width: '13px', height: '13px' }} /> Delivery address matches registered billing address. No additional address proof required.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* DISPATCH PACKED ITEMS MEDIA VIEWER FOR SALES */}
          {(() => {
            const packMedia = confirmingBomModal.dispatchPackingMedia || {};
            const packPhotos = packMedia.photos || [];
            const packVideos = packMedia.videos || [];
            const hasMedia = packPhotos.length > 0 || packVideos.length > 0;

            if (!hasMedia && !confirmingBomModal.status?.includes('Dispatch') && !confirmingBomModal.status?.includes('Packed') && !confirmingBomModal.dispatchPacking) {
              return null;
            }

            return (
              <div style={{
                marginTop: '16px',
                backgroundColor: 'white',
                padding: '18px 22px',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Camera size={16} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#0F172A' }}>
                        Dispatch Packed Items Media ({packPhotos.length} Photos, {packVideos.length} Videos)
                      </h4>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>
                        Photos and videos captured by Dispatch Fulfillment Team during packing
                      </span>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    backgroundColor: hasMedia ? '#DCFCE7' : '#F1F5F9',
                    color: hasMedia ? '#166534' : '#64748B',
                    border: `1px solid ${hasMedia ? '#BBF7D0' : '#E2E8F0'}`
                  }}>
                    {hasMedia ? '✓ Media Attached' : 'Awaiting Dispatch Media'}
                  </span>
                </div>

                {hasMedia ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', marginTop: '4px' }}>
                    {packPhotos.map((ph, pIdx) => {
                      const photoUrl = (ph.url && !ph.url.startsWith('blob:'))
                        ? ph.url
                        : ((ph.dataUrl && !ph.dataUrl.startsWith('blob:')) ? ph.dataUrl : (getMediaFromCache(ph.name) || getMediaFromCache(ph.id) || (ph.name ? `/api/uploads/${ph.name}` : '')));
                      return (
                        <div
                          key={pIdx}
                          onClick={() => setPreviewDocModal({ title: ph.name || `Packed Item Photo ${pIdx + 1}`, doc: { ...ph, name: ph.name || `Photo ${pIdx + 1}`, dataUrl: photoUrl, url: ph.url || photoUrl } })}
                          style={{
                            height: '84px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: '1.5px solid #CBD5E1',
                            backgroundColor: '#0F172A',
                            position: 'relative',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                            transition: 'transform 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <img
                            src={photoUrl || ph.dataUrl}
                            alt={ph.name}
                            onError={(e) => {
                              if (!e.currentTarget.dataset.retried && ph.name) {
                                e.currentTarget.dataset.retried = 'true';
                                fetch(`/api/media/find/${encodeURIComponent(ph.name)}`)
                                  .then(r => r.json())
                                  .then(data => {
                                    if (data?.found && data?.url) {
                                      e.currentTarget.src = data.url;
                                      saveMediaToCache(ph.name, data.url);
                                    }
                                  }).catch(() => {});
                              }
                            }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            backgroundColor: 'rgba(15,23,42,0.75)', color: '#FFFFFF',
                            padding: '2px 6px', fontSize: '10px', fontWeight: '700',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                          }}>
                            <span>📷 View Photo</span>
                            <span>›</span>
                          </div>
                        </div>
                      );
                    })}
                    {packVideos.map((vd, vIdx) => {
                      const videoUrl = (vd.url && !vd.url.startsWith('blob:'))
                        ? vd.url
                        : ((vd.dataUrl && !vd.dataUrl.startsWith('blob:')) ? vd.dataUrl : (getMediaFromCache(vd.name) || getMediaFromCache(vd.id) || (vd.name ? `/api/uploads/${vd.name}` : '')));
                      return (
                        <div
                          key={vIdx}
                          onClick={() => setPreviewDocModal({ title: vd.name || `Packed Item Video ${vIdx + 1}`, doc: { ...vd, name: vd.name || `Video ${vIdx + 1}`, dataUrl: videoUrl, url: vd.url || videoUrl } })}
                          style={{
                            height: '84px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: '1.5px solid #CBD5E1',
                            backgroundColor: '#0F172A',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            position: 'relative',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                            transition: 'transform 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                        <Video size={22} style={{ color: '#38BDF8' }} />
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          backgroundColor: 'rgba(15,23,42,0.75)', color: '#FFFFFF',
                          padding: '2px 6px', fontSize: '10px', fontWeight: '700',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                          <span>🎥 Watch Video</span>
                          <span>›</span>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#94A3B8', fontStyle: 'italic', padding: '6px 0' }}>
                    No dispatch packing photos or videos attached yet for this order.
                  </div>
                )}
              </div>
            );
          })()}

          {/* VEHICLE LOADING, LR COPY & FINAL DISPATCH PROOF FOR SALES */}
          {(() => {
            const vLoading = confirmingBomModal.vehicleLoading || {};
            const finalPhotos = (Array.isArray(vLoading.photos) && vLoading.photos.length > 0)
              ? vLoading.photos
              : (Array.isArray(confirmingBomModal.loadingPhotos) && confirmingBomModal.loadingPhotos.length > 0)
                ? confirmingBomModal.loadingPhotos
                : (Array.isArray(confirmingBomModal.photos) && confirmingBomModal.photos.length > 0)
                  ? confirmingBomModal.photos : [];
            const lrDoc = confirmingBomModal.lrCopyDoc || vLoading.lrCopyDoc || null;
            const vehicleNo = confirmingBomModal.vehicleNo || vLoading.vehicleNo || '—';
            const lrNo = confirmingBomModal.lrNo || vLoading.lrNo || '—';
            const transporter = confirmingBomModal.transporterName || confirmingBomModal.transporter || vLoading.transporter || vLoading.transporterName || '—';
            const destination = confirmingBomModal.destination || vLoading.destination || confirmingBomModal.deliveryCity || '—';
            const driverName = confirmingBomModal.driverName || vLoading.driverName || '';
            const driverPhone = confirmingBomModal.driverPhone || vLoading.driverPhone || '';

            const hasLoadingData = finalPhotos.length > 0 || Boolean(lrDoc) || vehicleNo !== '—' || lrNo !== '—' || transporter !== '—';

            if (!hasLoadingData) return null;

            return (
              <div style={{
                marginTop: '16px',
                backgroundColor: 'white',
                padding: '18px 22px',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Truck size={16} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#0F172A' }}>
                        Vehicle Loading & Final Dispatch Proof ({finalPhotos.length} Loading Photo{finalPhotos.length === 1 ? '' : 's'}{lrDoc ? ', LR Copy Attached' : ''})
                      </h4>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>
                        Vehicle loading photos and transporter Lorry Receipt (LR) uploaded by Dispatch Team
                      </span>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    backgroundColor: '#DCFCE7',
                    color: '#166534',
                    border: '1px solid #BBF7D0'
                  }}>
                    ✓ Dispatch Proof Recorded
                  </span>
                </div>

                {/* Logistics Key Details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', backgroundColor: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '11.5px' }}>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Transporter</span>
                    <strong style={{ color: '#0E7490' }}>{transporter}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Destination</span>
                    <strong style={{ color: '#0F172A' }}>{destination}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Vehicle Number</span>
                    <strong style={{ color: '#0F172A' }}>{vehicleNo}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>LR / Docket No</span>
                    <strong style={{ color: '#0F172A' }}>{lrNo}</strong>
                  </div>
                  {(driverName || driverPhone) && (
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Driver Details</span>
                      <strong style={{ color: '#0F172A' }}>{[driverName, driverPhone].filter(Boolean).join(' • ')}</strong>
                    </div>
                  )}
                </div>

                {/* LR Document & Loading Photos Row */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {lrDoc && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '10px 14px', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={18} style={{ color: '#16A34A' }} />
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: '#166534' }}>
                            Transporter Lorry Receipt (LR) Document
                          </div>
                          <span style={{ fontSize: '11px', color: '#15803D' }}>
                            {lrDoc.name || 'LR_Document.pdf'} {lrDoc.size ? `(${Math.round(lrDoc.size / 1024)} KB)` : ''}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const docUrl = (lrDoc.url && !lrDoc.url.startsWith('blob:')) ? lrDoc.url : ((lrDoc.dataUrl && !lrDoc.dataUrl.startsWith('blob:')) ? lrDoc.dataUrl : (getMediaFromCache(lrDoc.name) || (lrDoc.name ? `/api/uploads/${lrDoc.name}` : '')));
                          setPreviewDocModal({
                            title: `Lorry Receipt (LR) — ${lrNo !== '—' ? lrNo : confirmingBomModal.bomCode}`,
                            doc: { ...lrDoc, url: docUrl, dataUrl: docUrl }
                          });
                        }}
                        style={{ border: 'none', backgroundColor: '#16A34A', color: 'white', padding: '6px 14px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Eye size={12} /> View LR Document
                      </button>
                    </div>
                  )}

                  {finalPhotos.length > 0 && (
                    <div>
                      <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>
                        Final Vehicle Loading Proof Photos ({finalPhotos.length})
                      </span>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                        {finalPhotos.map((ph, pIdx) => {
                          const photoUrl = (ph.url && !ph.url.startsWith('blob:'))
                            ? ph.url
                            : ((ph.dataUrl && !ph.dataUrl.startsWith('blob:')) ? ph.dataUrl : (getMediaFromCache(ph.name) || getMediaFromCache(ph.id) || (ph.name ? `/api/uploads/${ph.name}` : '')));
                          return (
                            <div
                              key={pIdx}
                              onClick={() => setPreviewDocModal({ title: ph.name || `Vehicle Loading Photo ${pIdx + 1}`, doc: { ...ph, name: ph.name || `Vehicle Loading Photo ${pIdx + 1}`, dataUrl: photoUrl, url: ph.url || photoUrl } })}
                              style={{
                                height: '84px',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                border: '1.5px solid #CBD5E1',
                                backgroundColor: '#0F172A',
                                position: 'relative',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                transition: 'transform 0.15s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                              <img
                                src={photoUrl || ph.dataUrl}
                                alt={ph.name || `Loading photo ${pIdx + 1}`}
                                onError={(e) => {
                                  if (!e.currentTarget.dataset.retried && ph.name) {
                                    e.currentTarget.dataset.retried = 'true';
                                    fetch(`/api/media/find/${encodeURIComponent(ph.name)}`)
                                      .then(r => r.json())
                                      .then(data => {
                                        if (data?.found && data?.url) {
                                          e.currentTarget.src = data.url;
                                          saveMediaToCache(ph.name, data.url);
                                        }
                                      }).catch(() => {});
                                  }
                                }}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                backgroundColor: 'rgba(15,23,42,0.75)', color: '#FFFFFF',
                                padding: '2px 6px', fontSize: '10px', fontWeight: '700',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                              }}>
                                <span>📷 View Photo</span>
                                <span>›</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* PRODUCT ITEMS TABLE */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                {isAlreadyForwarded ? 'Itemized Product & Material Breakdown' : 'Product Verification List'}
              </h3>
              <span style={{ fontSize: '12px', color: '#64748B' }}>
                {isAlreadyForwarded
                  ? 'Itemized specifications and rate breakdown passed to Production & Dispatch teams.'
                  : 'Check every product box after verifying item details. Modify or add products if incorrect.'}
              </span>
            </div>

            {!isAlreadyForwarded && !isSourcePiLocked && (
              <button
                onClick={() => {
                  const currentItems = confirmingBomModal.items || [];
                  const updatedItems = [...currentItems, { name: '', category: '', qty: 1, rate: 0, confirmed: false }];
                  setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                }}
                style={{ border: '1px solid #A5F3FC', backgroundColor: '#ECFEFF', color: '#0E7490', height: '36px', padding: '0 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus style={{ width: '14px', height: '14px' }} /> Add New Product
              </button>
            )}
          </div>

          {isSourcePiLocked && (
            <div style={{ padding: '10px 16px', backgroundColor: '#FEF3C7', border: '1.5px solid #F59E0B', borderRadius: '10px', color: '#92400E', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock style={{ width: '16px', height: '16px', flexShrink: 0, color: '#D97706' }} />
              <span>Line Items & Pricing locked from Source Proforma Invoice ({confirmingBomModal.sourcePiNo}). Quantities, items, and prices imported from PI cannot be modified.</span>
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                  {!isAlreadyForwarded && (
                    <th style={{ padding: '12px 10px', width: '40px', textAlign: 'center' }}>
                      <input id="bom-orders-select-all" name="selectAll" aria-label="SelectAll"
                        type="checkbox"
                        title="Select and confirm all products"
                        checked={(confirmingBomModal.items || []).length > 0 && (confirmingBomModal.items || []).every(it => it.confirmed)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const updated = (confirmingBomModal.items || []).map(it => ({ ...it, confirmed: checked }));
                          setConfirmingBomModal({ ...confirmingBomModal, items: updated });
                        }}
                        style={{ width: '16px', height: '16px', accentColor: '#166534', cursor: 'pointer' }}
                       />
                    </th>
                  )}
                  <th style={{ padding: '12px 10px', width: '40px', textAlign: 'center' }}>#</th>
                  <th style={{ padding: '12px 10px', width: '25%' }}>Product / Component Name</th>
                  <th style={{ padding: '12px 10px', width: '18%' }}>Description</th>
                  <th style={{ padding: '12px 10px', width: '9%', textAlign: 'center' }}>UOM</th>
                  <th style={{ padding: '12px 10px', width: '9%', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '12px 10px', width: '12%', textAlign: 'right' }}>Rate (₹)</th>
                  <th style={{ padding: '12px 10px', width: '13%', textAlign: 'right' }}>Total (₹)</th>
                  {!isAlreadyForwarded && <th style={{ padding: '12px 10px', width: '50px', textAlign: 'center' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {/* Build mapping for Preset Kit grouping to show consolidated amount in the middle of items (like PI) */}
                {(() => {
                  const presetGroupMap = {};
                  (confirmingBomModal.items || []).forEach((item, idx) => {
                    const itemRate = cleanNum(item.rate) || 0;
                    const isPartBundle = Boolean(item.isPresetItem || (modalPresetGroups.length > 0 && itemRate === 0));
                    if (isPartBundle) {
                      const gid = item.presetGroupId || item.groupId || item.presetId || modalPresetGroups[0]?.groupId || modalPresetGroups[0]?.presetGroupId || 'default_kit';
                      if (!presetGroupMap[gid]) {
                        const matchedGrp = modalPresetGroups.find(g => (g.groupId === gid || g.presetGroupId === gid || g.presetId === gid || (g.groupId || 'default_kit') === gid)) || modalPresetGroups[0] || {};
                        const sets = parseInt(matchedGrp.setCount) || 1;
                        const price = cleanNum(matchedGrp.kitPrice) || (presetKitsTotal / sets) || 0;
                        presetGroupMap[gid] = {
                          firstIdx: idx,
                          count: 0,
                          presetName: matchedGrp.presetName || confirmingBomModal.presetName || 'Preset MMS Kit',
                          setCount: sets,
                          kitPrice: price,
                          totalAmount: price * sets
                        };
                      }
                      presetGroupMap[gid].count += 1;
                    }
                  });

                  return (confirmingBomModal.items || []).map((item, idx) => {
                    const itemQty = cleanNum(item.qty) || 0;
                    const itemRate = cleanNum(item.rate) || 0;
                    const itemTotal = itemQty * itemRate;
                    const isPartBundle = Boolean(item.isPresetItem || (modalPresetGroups.length > 0 && itemRate === 0));
                    const gid = isPartBundle ? (item.presetGroupId || item.groupId || item.presetId || modalPresetGroups[0]?.groupId || modalPresetGroups[0]?.presetGroupId || 'default_kit') : null;
                    const pInfo = gid ? presetGroupMap[gid] : null;
                    const isFirstInKit = pInfo && pInfo.firstIdx === idx;

                    if (isAlreadyForwarded) {
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: isPartBundle ? '#FAFEFF' : '#FFFFFF' }}>
                          <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '700', color: '#64748B' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 10px', fontWeight: '700', color: '#0F172A' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {isPartBundle && (
                                <span style={{ backgroundColor: '#ECFEFF', color: '#0E7490', border: '1px solid #A5F3FC', fontSize: '10px', fontWeight: '800', padding: '2px 7px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                  KIT COMPONENT
                                </span>
                              )}
                              <span>{item.name || '—'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 10px', color: '#64748B' }}>{item.category || item.specs || '—'}</td>
                          <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>{item.uom || item.unit || 'NOS'}</td>
                          <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '800', color: '#2563EB' }}>{itemQty}</td>
                          
                          {/* Rate Column: Consolidated & Centered in Middle for Presets (Like PI) */}
                          {isPartBundle ? (
                            isFirstInKit ? (
                              <td
                                rowSpan={pInfo.count}
                                style={{
                                  padding: '12px 10px',
                                  textAlign: 'right',
                                  verticalAlign: 'middle',
                                  backgroundColor: '#F0FDFA',
                                  borderLeft: '1.5px solid #CCFBF1',
                                  borderRight: '1px solid #CCFBF1'
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                  <span style={{ fontSize: '10px', fontWeight: '800', color: '#0E7490', backgroundColor: '#CCFBF1', padding: '2px 7px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                    {pInfo.setCount} Set{pInfo.setCount > 1 ? 's' : ''} Kit
                                  </span>
                                  <span style={{ fontWeight: '800', color: '#0E7490', fontSize: '13.5px' }}>
                                    ₹ {pInfo.kitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </td>
                            ) : null
                          ) : (
                            <td style={{ padding: '12px 10px', textAlign: 'right', color: '#334155' }}>
                              ₹ {itemRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          )}

                          {/* Total Column: Consolidated & Centered in Middle for Presets (Like PI) */}
                          {isPartBundle ? (
                            isFirstInKit ? (
                              <td
                                rowSpan={pInfo.count}
                                style={{
                                  padding: '12px 10px',
                                  textAlign: 'right',
                                  verticalAlign: 'middle',
                                  fontWeight: '900',
                                  color: '#0E7490',
                                  fontSize: '14px',
                                  backgroundColor: '#F0FDFA'
                                }}
                              >
                                ₹ {pInfo.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                            ) : null
                          ) : (
                            <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                              ₹ {itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          )}
                        </tr>
                      );
                    }

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: item.confirmed ? '#F0FDF4' : 'transparent' }}>
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        <input id={`bom-orders-checkbox-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
                          type="checkbox"
                          checked={Boolean(item.confirmed)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, confirmed: checked } : it);
                            setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                          }}
                          style={{ width: '16px', height: '16px', accentColor: '#166534', cursor: 'pointer' }}
                         />
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '700', color: '#64748B' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 10px' }}>
                        {isSourcePiLocked ? (
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                            {item.name || '—'}
                          </div>
                        ) : (
                          <TypeableProductSelect
                            value={item.name || ''}
                            itemsList={itemsList}
                            placeholder="Type or select product / item..."
                            accentColor="#0E7490"
                            onChange={(val, matched) => {
                              if (!matched) {
                                const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, name: val } : it);
                                setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                return;
                              }
                              const pName = matched.name;
                              const pCat = matched.category || matched.description || item.category;
                              const isSolar5 = is5PctSolarProduct(pName, pCat);
                              const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? {
                                ...it,
                                name: pName,
                                code: matched.code || it.code || '',
                                rate: matched.price || matched.rate ? Number(matched.price || matched.rate) : it.rate,
                                uom: matched.uom || matched.unit || it.uom,
                                category: pCat,
                                gstRate: isSolar5 ? '5%' : (it.gstRate || '18%')
                              } : it);
                              setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                            }}
                          />
                        )}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        {isSourcePiLocked ? (
                          <div style={{ fontSize: '12px', color: '#64748B' }}>
                            {item.category || item.specs || '—'}
                          </div>
                        ) : (
                          <input id={`bom-orders-description-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`description_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Description"
                            type="text"
                            placeholder="Description..."
                            value={item.category || item.specs || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, category: val, specs: val } : it);
                              setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                            }}
                            style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'text' }}
                           />
                        )}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        {isSourcePiLocked ? (
                          <div style={{ fontSize: '12px', textAlign: 'center', fontWeight: '700', color: '#475569' }}>
                            {item.uom || item.unit || 'NOS'}
                          </div>
                        ) : (
                          <input id={`bom-orders-uom-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`uOM_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="UOM"
                            type="text"
                            placeholder="UOM"
                            value={item.uom || item.unit || 'NOS'}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, uom: val, unit: val } : it);
                              setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                            }}
                            style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 6px', fontSize: '12px', textAlign: 'center', fontWeight: '700', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'text' }}
                           />
                        )}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        {isSourcePiLocked ? (
                          <div style={{ fontSize: '13px', textAlign: 'center', fontWeight: '800', color: '#2563EB' }}>
                            {item.qty || 0}
                          </div>
                        ) : (
                          <input id={`bom-orders-qty-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`qty_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Qty"
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, qty: val } : it);
                              setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                            }}
                            style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 6px', fontSize: '12px', textAlign: 'center', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'text' }}
                           />
                        )}
                      </td>
                        {/* Rate Column for Editing / Verification */}
                        {isSourcePiLocked && isPartBundle ? (
                          isFirstInKit ? (
                            <td
                              rowSpan={pInfo.count}
                              style={{
                                padding: '12px 10px',
                                textAlign: 'right',
                                verticalAlign: 'middle',
                                backgroundColor: '#F0FDFA',
                                borderLeft: '1.5px solid #CCFBF1',
                                borderRight: '1px solid #CCFBF1'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                <span style={{ fontSize: '10px', fontWeight: '800', color: '#0E7490', backgroundColor: '#CCFBF1', padding: '2px 7px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                  {pInfo.setCount} Set{pInfo.setCount > 1 ? 's' : ''} Kit
                                </span>
                                <span style={{ fontWeight: '800', color: '#0E7490', fontSize: '13px' }}>
                                  ₹ {pInfo.kitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </td>
                          ) : null
                        ) : (
                          <td style={{ padding: '12px 10px' }}>
                            {isSourcePiLocked ? (
                              <div style={{ fontSize: '13px', textAlign: 'right', fontWeight: '600', color: '#334155' }}>
                                ₹ {parseFloat(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                            ) : (
                              <input id={`bom-orders-rate-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`rate_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Rate"
                                type="number"
                                min="0"
                                value={item.rate}
                                placeholder={isPartBundle ? '0 (Bundled)' : '0'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updatedItems = (confirmingBomModal.items || []).map((it, i) => i === idx ? { ...it, rate: val } : it);
                                  setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                                }}
                                style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '12px', textAlign: 'right', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'text' }}
                               />
                            )}
                          </td>
                        )}

                        {/* Total Column for Editing / Verification */}
                        {isSourcePiLocked && isPartBundle ? (
                          isFirstInKit ? (
                            <td
                              rowSpan={pInfo.count}
                              style={{
                                padding: '12px 10px',
                                textAlign: 'right',
                                verticalAlign: 'middle',
                                fontWeight: '900',
                                color: '#0E7490',
                                fontSize: '14px',
                                backgroundColor: '#F0FDFA'
                              }}
                            >
                              ₹ {pInfo.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          ) : null
                        ) : (
                          <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                            ₹ {itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        )}

                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          {isSourcePiLocked ? (
                            <span title="Locked from Source Proforma Invoice" style={{ color: '#94A3B8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Lock style={{ width: '14px', height: '14px' }} />
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                const updatedItems = (confirmingBomModal.items || []).filter((_, i) => i !== idx);
                                setConfirmingBomModal({ ...confirmingBomModal, items: updatedItems });
                              }}
                              style={{ border: 'none', background: '#FEE2E2', color: '#DC2626', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Trash2 style={{ width: '14px', height: '14px' }} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* Summary Math & Action Block */}
          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '13px', color: '#64748B', display: 'block' }}>
                Showing {confirmingBomModal.items?.length || 0} itemized BOM components{modalPresetGroups.length > 0 ? ` + ${modalPresetGroups.length} Preset Kit Package` : ''}
              </span>
              {modalPresetGroups.length > 0 && (
                <span style={{ fontSize: '12px', color: '#0E7490', fontWeight: '600', marginTop: '4px', display: 'block' }}>
                  ℹ️ Hardware components with ₹0.00 rate are physical items included inside the Preset Kit package above.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: '#64748B', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {presetKitsTotal > 0 && (
                    <span>Preset Kit(s): <strong style={{ color: '#0E7490', fontWeight: '800' }}>₹ {presetKitsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                  )}
                  {customItemsTotal > 0 && (
                    <span>Additional Items: <strong style={{ color: '#0F172A', fontWeight: '800' }}>₹ {customItemsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                  )}
                  <span>Taxable Subtotal: <strong style={{ color: '#0F172A', fontWeight: '800' }}>₹ {orderSubTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                  <span>GST: <strong style={{ color: '#64748B', fontWeight: '700' }}>₹ {orderGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                </div>
                <div style={{ fontSize: '14px', color: '#334155' }}>
                  Total Order Value: <strong style={{ color: '#0E7490', fontSize: '17px', fontWeight: '900' }}>₹ {orderGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>

              {!isAlreadyForwarded && (
                <button
                  onClick={() => {
                    const isDeliveryMatching = Boolean(confirmingBomModal.sameAsBilling) || (
                      ((dObj.address || '').trim() === (bObj.address || '').trim()) &&
                      ((dObj.city || '').trim() === (bObj.city || '').trim()) &&
                      ((dObj.state || '').trim() === (bObj.state || '').trim()) &&
                      ((dObj.pincode || '').trim() === (bObj.pincode || '').trim())
                    );

                    const currentItems = confirmingBomModal.items || [];
                    const allCheckedItems = currentItems.map(it => ({ ...it, confirmed: true }));
                    const bStr = formatAddr(bObj, confirmingBomModal.billingAddress);
                    const dStr = confirmingBomModal.sameAsBilling ? bStr : formatAddr(dObj, confirmingBomModal.deliveryAddress);
                    const finalDObj = confirmingBomModal.sameAsBilling ? { ...bObj } : { ...dObj };

                    setConfirmingBomModal({ ...confirmingBomModal, items: allCheckedItems });
                    setBomStore(prev => prev.map(b => b.bomCode === confirmingBomModal.bomCode ? {
                      ...b,
                      companyName: confirmingBomModal.companyName || b.companyName,
                      paymentType: confirmingBomModal.paymentType || b.paymentType,
                      billingAddress: bStr,
                      billingAddressObj: bObj,
                      deliveryAddress: dStr,
                      deliveryAddressObj: finalDObj,
                      deliveryAddressProofDoc: confirmingBomModal.sameAsBilling ? null : (confirmingBomModal.deliveryAddressProofDoc || null),
                      items: allCheckedItems,
                      status: 'Pending Confirmation',
                      subTotal: orderSubTotal,
                      gstAmount: orderGstAmount,
                      grandTotal: orderGrandTotal
                    } : b));
                    alert('All product specifications confirmed! You can now click Send BOM.');
                  }}
                  style={{ border: 'none', backgroundColor: '#1E40AF', color: 'white', height: '38px', padding: '0 20px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <CheckSquare style={{ width: '14px', height: '14px' }} /> Confirm All Products
                </button>
              )}
            </div>
          </div>
        </div>

        {/* EXPORT FORMAT SELECTOR MODAL (PDF / JPG / CSV) */}
        {renderExportFormatModal()}

        {/* PRINTABLE BOM ORDER SHEET TEMPLATE */}
        {printingBomRecord && (
          <VRMBomPrintTemplate
            bomData={printingBomRecord}
            onClose={() => setPrintingBomRecord(null)}
            userRole={props.userRole || userRole || 'Sales Executive'}
            isSales={true}
          />
        )}

        {/* DOCUMENT PREVIEW MODAL */}
        {renderDocPreviewModal()}
      </div>
    );
  }

  // ==========================================
  // RENDER 3: DEFAULT BOM TABLE & PAGINATION
  // ==========================================
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredRows.slice(indexOfFirstRow, indexOfLastRow);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
      {/* 1. TOP HEADER WITH CREATE BOM BUTTON */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            {pageConfig.title}
          </h2>
          <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
            {pageConfig.subtitle}
          </span>
        </div>
      </div>

      {/* ADDRESS PROOF RE-UPLOAD REQUEST NOTIFICATION BANNER */}
      {(bomStore || []).some(b => b.addressProofReuploadRequested || b.status === 'Address Proof Requested from Sales') && (() => {
        const pendingBoms = (bomStore || []).filter(b => b.addressProofReuploadRequested || b.status === 'Address Proof Requested from Sales');
        const earliestReq = pendingBoms.reduce((acc, b) => {
          const t = b.addressProofReuploadRequestedAt || b.reuploadRequestedAt || b.reissueRequestedAt;
          if (!t) return acc;
          const time = new Date(t).getTime();
          return acc ? Math.min(acc, time) : time;
        }, null);

        let minsLeft = null;
        if (earliestReq) {
          const ONE_HOUR_MS = 60 * 60 * 1000;
          minsLeft = Math.max(0, Math.ceil((ONE_HOUR_MS - (Date.now() - earliestReq)) / 60000));
        }

        return (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 6px rgba(220, 38, 38, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={20} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Action Required: Address Proof Re-upload Requested by Accounts ({pendingBoms.length} Order{pendingBoms.length > 1 ? 's' : ''})</span>
                  {minsLeft !== null && (
                    <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: '#DC2626', color: '#FFFFFF', padding: '2px 8px', borderRadius: '12px' }}>
                      ⏱️ {minsLeft}m SLA Remaining
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>
                  Accounts team requested verified address proof document. Sales has 1 hour from reissue request to upload verified proof, otherwise the invoice will be automatically cancelled.
                </div>
              </div>
            </div>
            <button
              onClick={() => { setActiveSubTab('AddressAction'); setCurrentPage(1); }}
              style={{
                border: 'none',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Review Requested Orders ({pendingBoms.length})
            </button>
          </div>
        );
      })()}

      {/* 2. FILTERS & SEARCH ROW */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '12px 16px', backgroundColor: '#fafbfc', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center', width: '100%', boxSizing: 'border-box', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#f8fafc', width: '340px' }}>
          <Search style={{ width: '15px', height: '15px', color: '#64748b' }} />
          <input id="bom-orders-page-config-search-placeholder" name="pageConfigSearchPlaceholder" aria-label="PageConfig searchPlaceholder"
            type="text"
            placeholder={pageConfig.searchPlaceholder}
            value={searchQueryText}
            onChange={(e) => setSearchQueryText(e.target.value)}
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
           />
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0 }}>
          <ModernDateRangePicker
            startDate={filterDateVal}
            endDate={filterEndDateVal}
            onChange={({ startDate, endDate }) => {
              setFilterDateVal(startDate);
              setFilterEndDateVal(endDate);
              setCurrentPage(1);
            }}
          />

          <button
            onClick={() => { setSearchQueryText(''); setFilterDateVal(''); setFilterEndDateVal(''); setFilterStatusSelect('All'); }}
            title="Clear Filters"
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              height: '38px',
              width: '38px'
            }}
          >
            <RotateCcw style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </div>

      {/* 3. STATUS SUB-TABS ROW */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '20px', padding: '4px 0', alignItems: 'center', flexWrap: 'wrap' }}>
        {pageConfig.tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveSubTab(tab.id); setCurrentPage(1); }}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '10px 4px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: activeSubTab === tab.id ? '#2563eb' : '#64748b',
              borderBottom: activeSubTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {tab.label}
            <span style={{
              fontSize: '10px',
              padding: '2px 7px',
              borderRadius: '12px',
              backgroundColor: tab.bg,
              color: tab.fg,
              fontWeight: 'bold'
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 4. MAIN DATA TABLE WITH INTERACTIVE ROW SELECTION */}
      <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="custom-table" style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                  <input id="bom-orders-select-all" name="selectAll" aria-label="SelectAll"
                    type="checkbox"
                    style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                    checked={filteredRows.length > 0 && filteredRows.every(r => selectedRows.includes(r.code))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows(filteredRows.map(r => r.code));
                      } else {
                        setSelectedRows([]);
                      }
                    }}
                   />
                </th>
                {pageConfig.headers.filter(h => h !== 'Action' && h !== 'Actions').map((h, i) => {
                  const isRight = h.includes('Total') || h.includes('Value') || h.includes('Rate');
                  let colWidth = 'auto';
                  let minColWidth = '140px';
                  if (i === 0) { colWidth = '150px'; minColWidth = '150px'; }
                  else if (h.includes('Customer')) { minColWidth = '220px'; }
                  else if (h === 'Status') { colWidth = '160px'; minColWidth = '160px'; }
                  else if (h === 'Printout Status' || h === 'Print Status') { colWidth = '160px'; minColWidth = '160px'; }
                  else if (isRight) { colWidth = '150px'; minColWidth = '150px'; }
                  else if (h.includes('Date')) { colWidth = '130px'; minColWidth = '130px'; }
                  else if (h.includes('Payment')) { colWidth = '150px'; minColWidth = '150px'; }

                  return (
                    <th key={i} style={{
                      width: colWidth,
                      minWidth: minColWidth,
                      padding: '12px 14px',
                      fontWeight: 'bold',
                      textAlign: isRight ? 'right' : 'left',
                      boxSizing: 'border-box',
                      whiteSpace: 'nowrap'
                    }}>
                      {h}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {tableLoading ? (
                <>
                  <tr style={{ backgroundColor: '#F0FDFA' }}>
                    <td
                      colSpan={pageConfig.headers.filter(h => h !== 'Action' && h !== 'Actions').length + 1}
                      style={{ padding: '24px 16px', textAlign: 'center', borderBottom: '1px solid #CCFBF1' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="businz-spin-ring" />
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490' }}>
                                Loading BOM Orders...
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#ECFDF5', color: '#059669', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', border: '1px solid #A7F3D0' }}>
                                <span className="businz-pulse-dot" /> Live Central Database Sync
                              </span>
                            </div>
                            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                              Retrieving Bill of Materials & verifying live inventory from Businz Cloud...
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {Array.from({ length: 6 }).map((_, sIdx) => {
                    const totalHeaders = pageConfig.headers.filter(h => h !== 'Action' && h !== 'Actions');
                    return (
                      <tr key={`bom-skel-${sIdx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ textAlign: 'center', padding: '12px 0', width: '48px' }}>
                          <input id="bom-orders-input-5" name="input5" aria-label="Input 5" type="checkbox" defaultChecked={false} disabled style={{ opacity: 0.3 }}  />
                        </td>
                        {totalHeaders.map((_, hIdx) => (
                          <td key={`bom-skel-cell-${hIdx}`} style={{ padding: '12px 14px' }}>
                            <div
                              className="skeleton-shimmer skeleton-text"
                              style={{
                                width: hIdx === 0 ? '90px' : (hIdx === 1 ? '65%' : (hIdx === totalHeaders.length - 1 ? '85px' : '95px')),
                                height: '14px',
                                marginLeft: hIdx >= totalHeaders.length - 2 ? 'auto' : '0'
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </>
              ) : currentRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={pageConfig.headers.filter(h => h !== 'Action' && h !== 'Actions').length + 1}
                    style={{ padding: '48px 16px', textAlign: 'center', color: '#64748B' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Boxes size={32} style={{ color: '#CBD5E1' }} />
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>No BOM orders found</span>
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                        No records match your active search or filter criteria. Try adjusting your query or clear filters.
                      </span>
                      {(searchQueryText || filterDateVal || filterEndDateVal || filterStatusSelect !== 'All' || activeSubTab !== 'All') && (
                        <button
                          type="button"
                          onClick={() => { setSearchQueryText(''); setFilterDateVal(''); setFilterEndDateVal(''); setFilterStatusSelect('All'); setActiveSubTab('All'); }}
                          style={{
                            marginTop: '6px',
                            padding: '6px 14px',
                            backgroundColor: '#F1F5F9',
                            color: '#0E7490',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                currentRows.map((row, idx) => {
                  const isChecked = selectedRows.includes(row.code);
                  return (
                    <tr key={idx} style={{
                      borderBottom: '1px solid #F1F5F9',
                      transition: 'all 0.15s ease',
                      backgroundColor: isChecked ? '#ECFEFF' : 'transparent'
                    }} className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}>
                      <td style={{
                        width: '48px',
                        minWidth: '48px',
                        padding: '12px 0',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        boxSizing: 'border-box',
                        borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                      }}>
                        <input id="bom-orders-checkbox" name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
                          type="checkbox"
                          style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                          checked={isChecked}
                          onChange={() => handleSelectRowGeneric(row.code)}
                         />
                      </td>
                      <td
                        onClick={() => {
                          const isSentToDispatch = row.salesConfirmed || ['Sales Confirmed - Sent to Dispatch', 'Sent to Production', 'Confirmed', 'Packed & Ready for Dispatch', 'Partially Packed', 'Closed', 'CLOSED', 'Dispatch Packing Verified - Sent to Accounts', 'Awaiting Vehicle Loading & Dispatch'].includes(row.status);
                          const isDraftOrPending = !isCeo && !isSentToDispatch && ['Draft', 'Pending Confirmation', 'Edited / Pending Confirmation', 'Cancelled & Reissued to Dispatch', 'Pending Verification', 'Pending'].includes(row.status);
                          setConfirmingBomModal({ ...row, isEditMode: isDraftOrPending });
                        }}
                        style={{ padding: '12px 14px', fontWeight: 'bold', color: '#2563EB', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span>{row.code}</span>
                          {row.sourcePiNo && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', { 
                                  detail: { tab: 'Proforma Invoice', targetPi: row.sourcePiNo } 
                                }));
                                if (typeof props.onChangeTab === 'function') {
                                  props.onChangeTab('Proforma Invoice');
                                }
                              }}
                              title={`Converted from Proforma Invoice ${row.sourcePiNo} - Click to view PI`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11px',
                                color: '#0E7490',
                                backgroundColor: '#ECFEFF',
                                border: '1px solid #A5F3FC',
                                borderRadius: '4px',
                                padding: '1px 6px',
                                width: 'fit-content',
                                cursor: 'pointer',
                                fontWeight: '700'
                              }}
                            >
                              🔗 PI: {row.sourcePiNo} ↗
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        onClick={() => {
                          const isSentToDispatch = row.salesConfirmed || ['Sales Confirmed - Sent to Dispatch', 'Sent to Production', 'Confirmed', 'Packed & Ready for Dispatch', 'Partially Packed', 'Closed', 'CLOSED', 'Dispatch Packing Verified - Sent to Accounts', 'Awaiting Vehicle Loading & Dispatch'].includes(row.status);
                          const isDraftOrPending = !isCeo && !isSentToDispatch && ['Draft', 'Pending Confirmation', 'Edited / Pending Confirmation', 'Cancelled & Reissued to Dispatch', 'Pending Verification', 'Pending'].includes(row.status);
                          setConfirmingBomModal({ ...row, isEditMode: isDraftOrPending });
                        }}
                        style={{ padding: '12px 14px', color: '#475569', fontWeight: '500', whiteSpace: 'nowrap', cursor: 'pointer' }}
                      >
                        {row.dateTimeObj ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '2px', lineHeight: '1.2' }}>
                            <span style={{ fontWeight: '600', color: '#1E293B', fontSize: '12.5px' }}>{row.dateTimeObj.date}</span>
                            {row.dateTimeObj.time && (
                              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>{row.dateTimeObj.time}</span>
                            )}
                          </div>
                        ) : (
                          row.c2
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: '#1E293B' }}>{row.c3}</td>
                      <td style={{ padding: '12px 14px', color: '#0E7490', fontWeight: '700', fontSize: '12px' }}>
                        <span style={{ backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <User size={13} style={{ color: '#0E7490', flexShrink: 0 }} /> {(row.salesPerson || row.createdBy || 'Sales Department').replace(/\s*\([^)]*\)/g, '').trim()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748B' }}>{row.c4}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#0F172A', textAlign: 'right' }}>{row.c5}</td>
                      {/* 7. DEDICATED PRINT STATUS COLUMN */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {row.dispatchPrinted ? (
                          <span
                            title={`BOM physical sheet printed on ${row.dispatchPrintedDateStr || ''} at ${row.dispatchPrintTimeStr || ''} by ${row.dispatchPrintedBy || 'Dispatch Team'}`}
                            style={{
                              backgroundColor: '#F0FDF4',
                              color: '#15803D',
                              border: '1px solid #BBF7D0',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontWeight: '700',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4.5px',
                              width: 'fit-content',
                              lineHeight: 1
                            }}
                          >
                            <Printer size={11} strokeWidth={2.5} />
                            <span>Printed</span>
                            {row.dispatchPrintTimeStr && (
                              <span style={{ opacity: 0.85, fontWeight: '600' }}>({row.dispatchPrintTimeStr})</span>
                            )}
                          </span>
                        ) : (
                          <span
                            title="BOM physical sheet has not been printed yet"
                            style={{
                              backgroundColor: '#FFFBEB',
                              color: '#B45309',
                              border: '1px solid #FDE68A',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontWeight: '700',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4.5px',
                              width: 'fit-content',
                              lineHeight: 1
                            }}
                          >
                            <Clock size={11} strokeWidth={2.5} />
                            <span>Pending Print</span>
                          </span>
                        )}
                      </td>
                      {/* 8. STATUS COLUMN */}
                      <td style={{ padding: '12px 14px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          <span style={{ backgroundColor: row.stBg, color: row.stFg, padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px', border: row.stBorder }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: row.stFg }}></span>
                            {row.status}
                          </span>
                          {/* Quick access badges for LR photo & Final Loading photos if present */}
                          {(() => {
                            const vl = row.vehicleLoading || {};
                            const hasLr = Boolean(row.lrCopyDoc || vl.lrCopyDoc);
                            const photos = (Array.isArray(vl.photos) && vl.photos.length > 0) ? vl.photos : (Array.isArray(row.loadingPhotos) && row.loadingPhotos.length > 0 ? row.loadingPhotos : (Array.isArray(row.photos) && row.photos.length > 0 ? row.photos : []));
                            if (!hasLr && photos.length === 0) return null;
                            return (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                                {photos.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const p0 = photos[0];
                                      const photoUrl = (p0.url && !p0.url.startsWith('blob:')) ? p0.url : ((p0.dataUrl && !p0.dataUrl.startsWith('blob:')) ? p0.dataUrl : (getMediaFromCache(p0.name) || getMediaFromCache(p0.id) || (p0.name ? `/api/uploads/${p0.name}` : '')));
                                      setPreviewDocModal({
                                        title: `Loading Photos (${photos.length}) — ${row.c1}`,
                                        doc: { ...p0, dataUrl: photoUrl, url: photoUrl }
                                      });
                                    }}
                                    style={{ border: '1px solid #BAE6FD', background: '#F0F9FF', color: '#0369A1', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                    title="View Vehicle Loading Photos"
                                  >
                                    📷 {photos.length} Photo{photos.length > 1 ? 's' : ''}
                                  </button>
                                )}
                                {hasLr && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const lr = row.lrCopyDoc || vl.lrCopyDoc;
                                      const lrUrl = (lr.url && !lr.url.startsWith('blob:')) ? lr.url : ((lr.dataUrl && !lr.dataUrl.startsWith('blob:')) ? lr.dataUrl : (getMediaFromCache(lr.name) || (lr.name ? `/api/uploads/${lr.name}` : '')));
                                      setPreviewDocModal({
                                        title: `LR Copy — ${row.c1} (${row.lrNo || vl.lrNo || 'Document'})`,
                                        doc: { ...lr, dataUrl: lrUrl, url: lrUrl }
                                      });
                                    }}
                                    style={{ border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#15803D', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                    title="View Transporter LR Copy"
                                  >
                                    📄 LR Copy
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER - STRICT RULES MATCH */}
        {!tableLoading && filteredRows.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', fontSize: '13px', color: '#64748B', borderTop: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
            {/* Left Side: Rows per page selector + Showing X to Y entries */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Showing per page</span>
                <select id="bom-orders-rows-per-page" name="rowsPerPage" aria-label="RowsPerPage"
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  style={{ height: '32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', padding: '0 8px', backgroundColor: 'white', fontWeight: 'bold' }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </div>
              <span>Showing {filteredRows.length === 0 ? 0 : indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredRows.length)} of {filteredRows.length} entries</span>
            </div>

            {/* Right Side: Page navigation controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  style={{ border: '1px solid #E2E8F0', background: currentPage === 1 ? '#F8FAFC' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
                >
                  &laquo;
                </button>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  style={{ border: '1px solid #E2E8F0', background: currentPage === 1 ? '#F8FAFC' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                >
                  &lt;
                </button>

                {(() => {
                  let start = Math.max(1, currentPage - 1);
                  let end = start + 2;
                  if (end > totalPages) {
                    end = totalPages;
                    start = Math.max(1, end - 2);
                  }
                  return Array.from({ length: Math.max(1, end - start + 1) }, (_, i) => start + i).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      style={{
                        border: '1px solid #E2E8F0',
                        background: page === currentPage ? '#0E7490' : 'white',
                        color: page === currentPage ? 'white' : '#475569',
                        cursor: 'pointer',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: page === currentPage ? 'bold' : '500'
                      }}
                    >
                      {page}
                    </button>
                  ));
                })()}

                <button
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  style={{ border: '1px solid #E2E8F0', background: (currentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                >
                  &gt;
                </button>
                <button
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(totalPages)}
                  style={{ border: '1px solid #E2E8F0', background: (currentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
                >
                  &raquo;
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>Go to page</span>
                <input name="pageJump" aria-label="PageJump"
                  type="number"
                  min="1"
                  max={totalPages || 1}
                  defaultValue={currentPage}
                  id="bom-orders-goto-page-input"
                  style={{ width: '42px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}
                 />
                <button
                  onClick={() => {
                    const val = parseInt(document.getElementById('bom-orders-goto-page-input')?.value || '1', 10);
                    if (val >= 1 && val <= totalPages) setCurrentPage(val);
                  }}
                  style={{ height: '32px', padding: '0 10px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF', color: '#0E7490', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                >
                  Go &rsaquo;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FLOATING ACTION BAR FOR SELECTED ROWS */}
      {selectedRows.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '50px',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          padding: '8px 16px',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          gap: '8px',
          zIndex: 10000,
          width: 'max-content',
          maxWidth: 'calc(100vw - 32px)',
          overflowX: 'auto',
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px', paddingRight: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedRows.length}</strong> Selected
          </span>

          {/* View Details - Always accessible across all logins (Sales, Admin, etc.) and statuses */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (selectedRows.length > 1) {
                alert("You can't open details for multiple BOM orders at once. Please select a single item to view details.");
                return;
              }
              const codeVal = (selectedRows && selectedRows.length > 0) ? selectedRows[0] : null;
              const targetRow = codeVal
                ? ((filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || (bomStore || []).find(b => (b.bomCode || b.code) === codeVal) || { code: codeVal, name: `Record #${codeVal}` })
                : (filteredRows && filteredRows[0] ? filteredRows[0] : null);
              setSelectedRows([]);
              if (targetRow) {
                setQuickPreviewRecord(targetRow);
              }
            }}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#1E293B',
              borderRadius: '10px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
          >
            <Eye size={14} style={{ color: '#0E7490' }} /> View Details
          </button>

          {userRole !== 'CEO' && userRole !== 'MD' && userRole !== 'Managing Director' && (() => {
            const isOnlyDraft = (selectedRows || []).every(codeVal => {
              const r = (filteredRows || []).find(it => it.code === codeVal || it.id === codeVal || it.bomCode === codeVal) || (bomStore || []).find(b => (b.bomCode || b.code) === codeVal);
              return r && r.status === 'Draft';
            });
            if (!isOnlyDraft) return null;

            return (
              <button
                onClick={() => {
                  if (selectedRows.length > 1) {
                    alert('You cannot edit multiple items at once.');
                  } else if (selectedRows.length === 1) {
                    const codeVal = selectedRows[0];
                    const targetRow = (filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || { code: codeVal };
                    setSelectedRows([]);
                    setConfirmingBomModal({ ...targetRow, isEditMode: true });
                  }
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  color: '#1E293B',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <Edit3 size={14} style={{ color: '#64748B' }} /> Edit Info
              </button>
            );
          })()}

          <button
            onClick={() => {
              const codeVal = (selectedRows && selectedRows.length > 0) ? selectedRows[0] : null;
              const targetRow = codeVal
                ? ((filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || (bomStore || []).find(b => b.bomCode === codeVal))
                : ((bomStore || [])[0] || (filteredRows || [])[0]);

              setSelectedRows([]);
              if (targetRow) {
                setUploadPaymentModal(targetRow);
              }
            }}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#1E293B',
              borderRadius: '10px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <CreditCard size={14} style={{ color: '#2563EB' }} /> Payment Details
          </button>

          {(() => {
            const codeVal = (selectedRows && selectedRows.length > 0) ? selectedRows[0] : null;
            if (!codeVal) return null;
            const targetRow = (filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || (bomStore || []).find(b => (b.bomCode || b.code) === codeVal);
            const isAwaitingLr = targetRow && (
              targetRow.status === 'Dispatched - Awaiting LR Copy' ||
              targetRow.status === 'Awaiting LR Copy' ||
              targetRow.status === 'AWAITING LR COPY' ||
              targetRow.tabGroup === 'AwaitingLrCopy'
            );
            if (!isAwaitingLr || isCeo) return null;
            return (
              <button
                onClick={() => {
                  setSelectedRows([]);
                  setLrUploadModal(targetRow);
                }}
                style={{
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  color: '#92400E',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(245, 158, 11, 0.15)'
                }}
              >
                <FileText size={14} style={{ color: '#D97706' }} /> Upload LR Copy
              </button>
            );
          })()}

          {canCancelBom && (() => {
            const hasCancellable = (selectedRows || []).some(codeVal => {
              const row = (filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || (bomStore || []).find(b => (b.bomCode || b.code) === codeVal);
              return row && row.status !== 'Cancelled & Stock Restored' && row.status !== 'Completed' && row.status !== 'Closed' && !row.fullyCompleted;
            });
            if (!hasCancellable) return null;

            return (
              <button
                onClick={() => {
                  const targetCode = selectedRows[0];
                  const targetBom = (filteredRows || []).find(r => r.code === targetCode || r.id === targetCode || r.bomCode === targetCode) || (bomStore || []).find(b => (b.bomCode || b.code) === targetCode);
                  setSelectedRows([]);
                  if (targetBom) handleCancelBomOrder(targetBom);
                }}
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(220, 38, 38, 0.1)'
                }}
              >
                <XCircle size={14} style={{ color: '#DC2626' }} /> Cancel BOM
              </button>
            );
          })()}

          <button
            onClick={() => {
              const codeVal = (selectedRows && selectedRows.length > 0) ? selectedRows[0] : null;
              const targetRow = codeVal
                ? ((filteredRows || []).find(r => r.code === codeVal || r.id === codeVal || r.bomCode === codeVal) || (bomStore || []).find(b => (b.bomCode || b.code) === codeVal))
                : ((bomStore || [])[0] || (filteredRows || [])[0]);

              setSelectedRows([]);
              if (targetRow) {
                setPrintingBomRecord(targetRow);
              } else {
                alert('Please select a BOM record to print.');
              }
            }}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#1E293B',
              borderRadius: '10px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <Printer size={14} style={{ color: '#059669' }} /> Print
          </button>

          <button
            onClick={() => {
              setSelectedRows([]);
            }}
            title="Deselect all"
            style={{ backgroundColor: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* QUICK PREVIEW DRAWER */}
      {quickPreviewRecord && (
        <div
          onClick={() => setQuickPreviewRecord(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end', zIndex: 20000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#FFFFFF', width: '580px', maxWidth: '92vw', height: '100vh', overflowY: 'auto', boxShadow: '-12px 0 40px rgba(15, 23, 42, 0.2)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', boxSizing: 'border-box' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>BOM Order Preview</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setExportFormatRecord(quickPreviewRecord)}
                  title="Export BOM (PDF, JPG, or CSV)"
                  style={{
                    border: '1px solid #0E7490',
                    backgroundColor: '#ECFEFF',
                    color: '#0E7490',
                    padding: '6px 14px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <Download size={14} style={{ color: '#0E7490' }} /> Export
                </button>
                {canCancelBom && quickPreviewRecord.status !== 'Cancelled & Stock Restored' && (
                  <button
                    onClick={() => {
                      const rec = quickPreviewRecord;
                      handleCancelBomOrder(rec);
                      setQuickPreviewRecord(null);
                    }}
                    style={{
                      border: '1px solid #FECACA',
                      backgroundColor: '#FEF2F2',
                      color: '#DC2626',
                      padding: '6px 14px',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px rgba(220,38,38,0.08)'
                    }}
                    title="Cancel BOM and restore blocked stock back into inventory"
                  >
                    <XCircle size={14} style={{ color: '#DC2626' }} /> Cancel BOM
                  </button>
                )}
                <button
                  onClick={() => {
                    const rec = quickPreviewRecord;
                    setQuickPreviewRecord(null);
                    const isSentToDispatch = rec.salesConfirmed || ['Sales Confirmed - Sent to Dispatch', 'Sent to Production', 'Confirmed', 'Packed & Ready for Dispatch', 'Partially Packed', 'Closed', 'CLOSED', 'Dispatch Packing Verified - Sent to Accounts', 'Awaiting Vehicle Loading & Dispatch'].includes(rec.status);
                    const isDraftOrPending = !isCeo && !isSentToDispatch && ['Draft', 'Pending Confirmation', 'Edited / Pending Confirmation', 'Cancelled & Reissued to Dispatch', 'Pending Verification', 'Pending'].includes(rec.status);
                    setConfirmingBomModal({ ...rec, isEditMode: isDraftOrPending });
                  }}
                  style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#1E293B', padding: '6px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  View Full Details
                </button>
                <button onClick={() => setQuickPreviewRecord(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B', padding: '4px', display: 'inline-flex', alignItems: 'center' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {(() => {
              // 1. Resolve source PI if available for full fidelity fallback
              let sourcePi = null;
              try {
                const piNum = quickPreviewRecord.sourcePiNo || quickPreviewRecord.piNo;
                const rawPi = localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('sales_pi_store') || localStorage.getItem('proforma_invoices');
                if (rawPi) {
                  const parsedPis = JSON.parse(rawPi);
                  if (Array.isArray(parsedPis)) {
                    sourcePi = parsedPis.find(p => 
                      (piNum && (p.piNo === piNum || p.id === piNum)) ||
                      (p.convertedBomCode === quickPreviewRecord.bomCode) ||
                      (p.convertedBomNo === quickPreviewRecord.bomCode) ||
                      (Array.isArray(p.assignedBoms) && p.assignedBoms.includes(quickPreviewRecord.bomCode))
                    );
                  }
                }
              } catch (_) {}

              // 2. Company Name & Customer Name resolution
              const cleanVal = (v) => (v && typeof v === 'string' && v.trim() && !['—', '-', 'Customer', 'Customer Order'].includes(v.trim())) ? v.trim() : '';
              
              const resolvedCompany = [
                cleanVal(quickPreviewRecord.companyName),
                cleanVal(sourcePi?.vendor),
                cleanVal(sourcePi?.companyName),
                cleanVal(sourcePi?.customerName && !/^\d+$/.test(sourcePi.customerName) ? sourcePi.customerName : ''),
                cleanVal(quickPreviewRecord.customerName && !/^\d+$/.test(quickPreviewRecord.customerName) ? quickPreviewRecord.customerName : ''),
                cleanVal(quickPreviewRecord.c2),
                cleanVal(quickPreviewRecord.c3 && !/^\d+$/.test(quickPreviewRecord.c3) ? quickPreviewRecord.c3 : '')
              ].find(Boolean) || cleanVal(quickPreviewRecord.customerName) || 'Teorainn Solar Pvt Ltd';

              const resolvedContact = [
                cleanVal(quickPreviewRecord.contactPerson),
                cleanVal(sourcePi?.contactPerson),
                cleanVal(sourcePi?.customerName),
                cleanVal(quickPreviewRecord.customerName)
              ].find(s => s && s !== resolvedCompany) || quickPreviewRecord.contactPerson || '—';

              const phone = quickPreviewRecord.mobile || quickPreviewRecord.phone || sourcePi?.phone || sourcePi?.mobile || '—';
              const email = quickPreviewRecord.email || sourcePi?.email || '';
              const gstNo = quickPreviewRecord.gstNo || quickPreviewRecord.gstin || sourcePi?.gstNo || sourcePi?.gst || '—';

              // Payment Terms
              const paymentType = normalizePaymentTerm(
                sourcePi?.paymentTerms || sourcePi?.paymentType || quickPreviewRecord.paymentType || quickPreviewRecord.paymentTerms || '100% Paid'
              );

              // Grand Total / Order Value
              const numVal = (v) => {
                const n = parseFloat(String(v || '').replace(/[^0-9.]/g, ''));
                return Number.isFinite(n) && n > 0 ? n : 0;
              };
              const calculatedItemTotal = (quickPreviewRecord.items || []).reduce((sum, it) => sum + ((cleanNum(it.qty) || 0) * (cleanNum(it.rate) || 0)), 0);
              const grandVal = numVal(quickPreviewRecord.grandTotal) 
                || numVal(quickPreviewRecord.c5)
                || numVal(sourcePi?.grandTotal)
                || numVal(sourcePi?.amount)
                || numVal(calculatedItemTotal)
                || numVal(quickPreviewRecord.subTotal);
              const subVal = numVal(quickPreviewRecord.subTotal) || numVal(sourcePi?.subTotal) || (grandVal > 0 ? Math.round((grandVal / 1.18) * 100) / 100 : 0);
              const gstVal = numVal(quickPreviewRecord.gstAmount) || numVal(sourcePi?.gstAmount) || Math.max(0, Math.round((grandVal - subVal) * 100) / 100);

              // Transporter & Logistics
              const existingLoading = quickPreviewRecord.vehicleLoading || {};
              const transporter = [
                cleanVal(quickPreviewRecord.transporterName),
                cleanVal(quickPreviewRecord.transporter),
                cleanVal(existingLoading.transporter),
                cleanVal(existingLoading.transporterName),
                cleanVal(sourcePi?.transporterName),
                cleanVal(sourcePi?.transporter)
              ].find(Boolean) || '—';

              const destination = [
                cleanVal(quickPreviewRecord.destination),
                cleanVal(existingLoading.destination),
                cleanVal(sourcePi?.destination),
                cleanVal(quickPreviewRecord.deliveryCity),
                cleanVal(sourcePi?.deliveryCity)
              ].find(Boolean) || '—';

              const transportMode = quickPreviewRecord.transportMode || existingLoading.deliveryMode || sourcePi?.transportMode || 'Transport';
              const transportScope = quickPreviewRecord.transportScope || sourcePi?.transportScope || 'VRM Structures';
              const vehicleNo = quickPreviewRecord.vehicleNo || existingLoading.vehicleNo || sourcePi?.vehicleNo || '—';
              const lrNo = quickPreviewRecord.lrNo || existingLoading.lrNo || sourcePi?.lrNo || '—';
              const driverName = quickPreviewRecord.driverName || existingLoading.driverName || '';
              const driverPhone = quickPreviewRecord.driverPhone || existingLoading.driverPhone || '';
              const lrDoc = quickPreviewRecord.lrCopyDoc || existingLoading.lrCopyDoc || null;
              const loadingPhotos = (Array.isArray(existingLoading.photos) && existingLoading.photos.length > 0)
                ? existingLoading.photos
                : (Array.isArray(quickPreviewRecord.loadingPhotos) && quickPreviewRecord.loadingPhotos.length > 0)
                  ? quickPreviewRecord.loadingPhotos
                  : (Array.isArray(quickPreviewRecord.photos) && quickPreviewRecord.photos.length > 0)
                    ? quickPreviewRecord.photos : [];

              // Addresses
              const bObj = quickPreviewRecord.billingAddressObj || sourcePi?.billingAddressObj || {};
              const dObj = quickPreviewRecord.deliveryAddressObj || sourcePi?.deliveryAddressObj || {};

              const bStreet = quickPreviewRecord.billingStreet || bObj.street || bObj.address || sourcePi?.billingStreet || (typeof quickPreviewRecord.billingAddress === 'string' && !quickPreviewRecord.billingAddress.includes('on file') ? quickPreviewRecord.billingAddress : '') || (typeof sourcePi?.billingAddress === 'string' ? sourcePi.billingAddress : '');
              const bCity = quickPreviewRecord.billingCity || bObj.city || sourcePi?.billingCity || '';
              const bState = quickPreviewRecord.billingState || bObj.state || sourcePi?.billingState || '';
              const bPin = quickPreviewRecord.billingPincode || bObj.pincode || bObj.pin || sourcePi?.billingPincode || '';

              const isSameAddr = quickPreviewRecord.sameAsBilling !== false && (!dObj.address || dObj.address === bObj.address);
              const dStreet = isSameAddr ? bStreet : (quickPreviewRecord.deliveryStreet || dObj.street || dObj.address || sourcePi?.deliveryStreet || (typeof quickPreviewRecord.deliveryAddress === 'string' && !quickPreviewRecord.deliveryAddress.includes('on file') ? quickPreviewRecord.deliveryAddress : '') || bStreet);
              const dCity = isSameAddr ? bCity : (quickPreviewRecord.deliveryCity || dObj.city || sourcePi?.deliveryCity || bCity);
              const dState = isSameAddr ? bState : (quickPreviewRecord.deliveryState || dObj.state || sourcePi?.deliveryState || bState);
              const dPin = isSameAddr ? bPin : (quickPreviewRecord.deliveryPincode || dObj.pincode || dObj.pin || sourcePi?.deliveryPincode || bPin);

              const addrDoc = quickPreviewRecord.deliveryAddressProofDoc || sourcePi?.deliveryAddressProofDoc || sourcePi?.deliveryProofDoc;

              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '4px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#ECFEFF', color: '#0E7490', border: '2px solid #0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800', flexShrink: 0 }}>
                      {resolvedCompany.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                        {resolvedCompany}
                      </h3>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>
                        Ref Code: <strong style={{ color: '#0E7490' }}>{quickPreviewRecord.bomCode || quickPreviewRecord.code}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Order Meta Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>REF CODE</span>
                      <strong style={{ fontSize: '14px', color: '#0F172A', fontWeight: '800' }}>{quickPreviewRecord.bomCode || quickPreviewRecord.code}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>STATUS</span>
                      <strong style={{ fontSize: '13px', color: '#0E7490', fontWeight: '800' }}>{quickPreviewRecord.status}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>TOTAL ITEMS</span>
                      <strong style={{ fontSize: '15px', color: '#0F172A', fontWeight: '800' }}>{(quickPreviewRecord.items || []).length || (sourcePi?.items || []).length || 1}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>ORDER VALUE</span>
                      <strong style={{ fontSize: '15px', color: '#0F172A', fontWeight: '800' }}>
                        {grandVal > 0 ? formatCurrency(grandVal) : (quickPreviewRecord.c5 || '—')}
                      </strong>
                    </div>
                  </div>

                  {/* Sales & Payment Terms Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block' }}>Sales Creator</span>
                      <strong style={{ fontSize: '13px', color: '#0E7490', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <User size={13} style={{ color: '#0E7490', flexShrink: 0 }} /> {(quickPreviewRecord.salesPerson || quickPreviewRecord.createdBy || sourcePi?.salesPerson || 'Sales Department').replace(/\s*\([^)]*\)/g, '').trim()}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block' }}>Payment Terms</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <strong style={{ fontSize: '13px', color: '#0F172A', fontWeight: '800' }}>
                          {paymentType}
                        </strong>
                        {(() => {
                          const pDocs = Array.isArray(quickPreviewRecord.paymentProofDocs) && quickPreviewRecord.paymentProofDocs.length > 0
                            ? quickPreviewRecord.paymentProofDocs
                            : (Array.isArray(quickPreviewRecord.payments?.proofDocObjs) && quickPreviewRecord.payments.proofDocObjs.length > 0)
                              ? quickPreviewRecord.payments.proofDocObjs
                              : (quickPreviewRecord.paymentProofDoc || quickPreviewRecord.payments?.proofDoc || sourcePi?.paymentProofDoc)
                                ? [quickPreviewRecord.paymentProofDoc || { name: quickPreviewRecord.payments?.proofDoc, dataUrl: quickPreviewRecord.payments?.proofDocData } || sourcePi?.paymentProofDoc]
                                : [];
                          if (pDocs.length === 0) return null;
                          return (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                              {pDocs.map((pDoc, pIdx) => (
                                <button
                                  key={pIdx}
                                  type="button"
                                  onClick={() => setPreviewDocModal({ title: `Payment Proof #${pIdx + 1}: ${pDoc.name || pDoc.originalName || 'Slip'}`, doc: pDoc })}
                                  style={{ border: '1px solid #BBF7D0', backgroundColor: '#F0FDF4', color: '#166534', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                >
                                  <Eye size={10} /> Proof {pDocs.length > 1 ? `#${pIdx + 1}` : ''}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Contact Details & GST */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', backgroundColor: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>COMPANY NAME</span>
                      <strong style={{ fontSize: '12px', color: '#0F172A', fontWeight: '700' }}>{resolvedCompany}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>CONTACT PERSON</span>
                      <strong style={{ fontSize: '12px', color: '#0F172A', fontWeight: '700' }}>{resolvedContact}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>PHONE / EMAIL</span>
                      <strong style={{ fontSize: '12px', color: '#0F172A', fontWeight: '700', display: 'block' }}>{phone}</strong>
                      {email && <span style={{ fontSize: '11px', color: '#64748B', wordBreak: 'break-all' }}>{email}</span>}
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase' }}>GSTIN</span>
                      <strong style={{ fontSize: '12px', color: '#0E7490', fontWeight: '800' }}>{gstNo}</strong>
                    </div>
                  </div>

                  {/* Structured Billing & Delivery Addresses */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', color: '#2563EB', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px' }}>
                        <FileText size={12} /> Billing Address
                      </div>
                      <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
                        <div>{bStreet || 'Billing address on file'}</div>
                        {(bCity || bState) && <div>{[bCity, bState].filter(Boolean).join(', ')}</div>}
                        {bPin && <div>PIN: <strong>{bPin}</strong></div>}
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', color: '#0E7490' }}>
                          <Truck size={12} /> Delivery Address
                        </span>
                        {isSameAddr && (
                          <span style={{ fontSize: '10px', color: '#166534', fontWeight: '700' }}>Same as Billing</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.5' }}>
                        <div>{dStreet || 'Delivery address on file'}</div>
                        {(dCity || dState) && <div>{[dCity, dState].filter(Boolean).join(', ')}</div>}
                        {dPin && <div>PIN: <strong>{dPin}</strong></div>}
                      </div>
                      {(() => {
                        const aDocs = Array.isArray(quickPreviewRecord.deliveryAddressProofDocs) && quickPreviewRecord.deliveryAddressProofDocs.length > 0
                          ? quickPreviewRecord.deliveryAddressProofDocs
                          : addrDoc ? [addrDoc] : [];
                        if (aDocs.length === 0) return null;
                        return (
                          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {aDocs.map((aDoc, aIdx) => (
                              <div key={aIdx} style={{ padding: '5px 8px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '10.5px', color: '#166534', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '170px' }} title={aDoc.name}>
                                  📄 {aDoc.name || `Address Proof #${aIdx + 1}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setPreviewDocModal({ title: `Delivery Address Proof #${aIdx + 1}: ${aDoc.name || 'Document'}`, doc: aDoc })}
                                  style={{ border: 'none', background: 'transparent', color: '#0E7490', cursor: 'pointer', fontSize: '10.5px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}
                                >
                                  <Eye size={11} /> View {aDocs.length > 1 ? `#${aIdx + 1}` : ''}
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Logistics & Dispatch Information */}
                  <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>Logistics & Dispatch Information</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', fontSize: '11.5px' }}>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Mode</span>
                        <strong>{transportMode}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Scope</span>
                        <strong style={{ color: transportScope === 'Customer Scope' ? '#0284C7' : '#0F172A' }}>{transportScope}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Transporter</span>
                        <strong style={{ color: transporter !== '—' ? '#0E7490' : '#0F172A' }}>{transporter}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Destination</span>
                        <strong style={{ color: destination !== '—' ? '#0E7490' : '#0F172A' }}>{destination}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Vehicle No</span>
                        <strong>{vehicleNo}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>LR / Docket</span>
                        <strong>{lrNo}</strong>
                      </div>
                      {(driverName || driverPhone) && (
                        <div>
                          <span style={{ color: '#64748B', display: 'block', fontSize: '10px' }}>Driver</span>
                          <strong>{[driverName, driverPhone].filter(Boolean).join(' • ')}</strong>
                        </div>
                      )}
                    </div>
                    {lrDoc && (
                      <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: '#166534', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          📄 LR Document Attached ({lrDoc.name || 'Lorry Receipt'})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const docUrl = (lrDoc.url && !lrDoc.url.startsWith('blob:')) ? lrDoc.url : ((lrDoc.dataUrl && !lrDoc.dataUrl.startsWith('blob:')) ? lrDoc.dataUrl : (getMediaFromCache(lrDoc.name) || (lrDoc.name ? `/api/uploads/${lrDoc.name}` : '')));
                            setPreviewDocModal({
                              title: `Lorry Receipt (LR) — ${lrNo !== '—' ? lrNo : quickPreviewRecord.bomCode}`,
                              doc: { ...lrDoc, url: docUrl, dataUrl: docUrl }
                            });
                          }}
                          style={{ border: 'none', backgroundColor: '#16A34A', color: 'white', padding: '3px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <Eye size={10} /> View LR Photo
                        </button>
                      </div>
                    )}
                  </div>

            {/* Itemized List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Itemized Products & Materials</h4>
                <span style={{ fontSize: '11px', color: '#64748B' }}>{(quickPreviewRecord.items || []).length} items</span>
              </div>
              <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '12px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                      <th style={{ padding: '8px 10px' }}>#</th>
                      <th style={{ padding: '8px 10px' }}>Product Description</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Rate (₹)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Preset Kit Package Rows */}
                    {(() => {
                      const pGroups = (Array.isArray(quickPreviewRecord.presetGroups) && quickPreviewRecord.presetGroups.length > 0)
                        ? quickPreviewRecord.presetGroups
                        : (quickPreviewRecord.presetName || (cleanNum(quickPreviewRecord.presetKitPrice) > 0))
                          ? [{
                              presetName: quickPreviewRecord.presetName || 'Pre-Engineered Structure Kit Package',
                              setCount: parseInt(quickPreviewRecord.presetSetCount) || 1,
                              kitPrice: cleanNum(quickPreviewRecord.presetKitPrice) || 0
                            }]
                          : [];

                      return pGroups.map((grp, gIdx) => {
                        const sCount = parseInt(grp.setCount) || 1;
                        const kPrice = cleanNum(grp.kitPrice) || 0;
                        const kTotal = sCount * kPrice;
                        return (
                          <tr key={`preset-pkg-${gIdx}`} style={{ backgroundColor: '#F0FDFA', borderBottom: '1.5px solid #CCFBF1' }}>
                            <td style={{ padding: '8px 10px', color: '#0E7490', fontWeight: '800', textAlign: 'center' }}>★</td>
                            <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0E7490' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                  PRESET KIT PACKAGE
                                </span>
                                <span>{grp.presetName || 'Preset Structure Kit'}</span>
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#0E7490' }}>
                              {sCount} Set{sCount > 1 ? 's' : ''}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#0E7490' }}>
                              ₹ {kPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '900', color: '#0E7490' }}>
                              ₹ {kTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      });
                    })()}

                    {/* Component Items */}
                    {(quickPreviewRecord.items || []).map((it, idx) => {
                      const q = cleanNum(it.qty, 1);
                      const r = cleanNum(it.rate, 0);
                      const lineTotal = q * r;
                      const hasPresets = (Array.isArray(quickPreviewRecord.presetGroups) && quickPreviewRecord.presetGroups.length > 0) || quickPreviewRecord.presetName || (cleanNum(quickPreviewRecord.presetKitPrice) > 0);
                      const isKitPart = Boolean(it.isPresetItem || (hasPresets && r === 0));
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: isKitPart ? '#FAFEFF' : '#FFFFFF' }}>
                          <td style={{ padding: '8px 10px', color: '#94A3B8', fontWeight: '700', textAlign: 'center' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0F172A' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {isKitPart && (
                                <span style={{ backgroundColor: '#ECFEFF', color: '#0E7490', border: '1px solid #A5F3FC', fontSize: '9px', fontWeight: '800', padding: '1px 5px', borderRadius: '3px' }}>
                                  KIT COMPONENT
                                </span>
                              )}
                              <span>{it.name || '—'}</span>
                            </div>
                            {it.category && <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '500' }}>{it.category}</span>}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#0E7490' }}>{q} {it.uom || ''}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600', color: isKitPart ? '#0E7490' : '#475569' }}>
                            {isKitPart ? (
                              <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 5px', borderRadius: '3px' }}>Included</span>
                            ) : (
                              `₹ ${r.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: isKitPart ? '#0E7490' : '#0F172A' }}>
                            {isKitPart ? (
                              <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 5px', borderRadius: '3px' }}>Included</span>
                            ) : (
                              `₹ ${lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #E2E8F0', fontWeight: '700', color: '#475569' }}>
                      <td colSpan={4} style={{ padding: '8px 10px', textAlign: 'right' }}>Taxable Subtotal:</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                        ₹ {subVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    {gstVal > 0 && (
                      <tr style={{ backgroundColor: '#F8FAFC', color: '#64748B', fontSize: '11.5px' }}>
                        <td colSpan={4} style={{ padding: '4px 10px', textAlign: 'right' }}>GST:</td>
                        <td style={{ padding: '4px 10px', textAlign: 'right', fontWeight: '700', color: '#64748B' }}>
                          ₹ {gstVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                    <tr style={{ backgroundColor: '#ECFEFF', borderTop: '1px solid #A5F3FC', fontWeight: '900', color: '#0E7490', fontSize: '13px' }}>
                      <td colSpan={4} style={{ padding: '10px', textAlign: 'right', textTransform: 'uppercase' }}>Total Order Value:</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontSize: '14px', color: '#0E7490' }}>
                        ₹ {grandVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        );
      })()}

            {/* Dispatch Packed Items Media Section in Quick Preview */}
            {(() => {
              const packMedia = quickPreviewRecord.dispatchPackingMedia || {};
              const packPhotos = packMedia.photos || [];
              const packVideos = packMedia.videos || [];
              const hasMedia = packPhotos.length > 0 || packVideos.length > 0;

              if (!hasMedia && !quickPreviewRecord.status?.includes('Dispatch') && !quickPreviewRecord.status?.includes('Packed') && !quickPreviewRecord.dispatchPacking) {
                return null;
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Camera size={16} style={{ color: '#0E7490' }} />
                      <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                        Dispatch Packed Items Media ({packPhotos.length} Photos, {packVideos.length} Videos)
                      </h4>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Captured by Dispatch</span>
                  </div>

                  {hasMedia ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                      {packPhotos.map((ph, pIdx) => {
                        const photoUrl = (ph.url && !ph.url.startsWith('blob:'))
                          ? ph.url
                          : ((ph.dataUrl && !ph.dataUrl.startsWith('blob:')) ? ph.dataUrl : (getMediaFromCache(ph.name) || getMediaFromCache(ph.id) || (ph.name ? `/api/uploads/${ph.name}` : '')));
                        return (
                          <div
                            key={pIdx}
                            onClick={() => setPreviewDocModal({ title: ph.name || `Photo ${pIdx + 1}`, doc: { ...ph, name: ph.name || `Photo ${pIdx + 1}`, dataUrl: photoUrl, url: ph.url || photoUrl } })}
                            style={{ height: '76px', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #CBD5E1', backgroundColor: '#0F172A', position: 'relative' }}
                          >
                            <img
                              src={photoUrl || ph.dataUrl}
                              alt={ph.name}
                              onError={(e) => {
                                if (!e.currentTarget.dataset.retried && ph.name) {
                                  e.currentTarget.dataset.retried = 'true';
                                  fetch(`/api/media/find/${encodeURIComponent(ph.name)}`)
                                    .then(r => r.json())
                                    .then(data => {
                                      if (data?.found && data?.url) {
                                        e.currentTarget.src = data.url;
                                        saveMediaToCache(ph.name, data.url);
                                      }
                                    }).catch(() => {});
                                }
                              }}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 6px', fontSize: '9px', fontWeight: '700', display: 'flex', justifyContent: 'space-between' }}>
                              <span>📷 Photo</span>
                              <span>›</span>
                            </div>
                          </div>
                        );
                      })}
                      {packVideos.map((vd, vIdx) => {
                        const videoUrl = (vd.url && !vd.url.startsWith('blob:'))
                          ? vd.url
                          : ((vd.dataUrl && !vd.dataUrl.startsWith('blob:')) ? vd.dataUrl : (getMediaFromCache(vd.name) || getMediaFromCache(vd.id) || (vd.name ? `/api/uploads/${vd.name}` : '')));
                        return (
                          <div
                            key={vIdx}
                            onClick={() => setPreviewDocModal({ title: vd.name || `Video ${vIdx + 1}`, doc: { ...vd, name: vd.name || `Video ${vIdx + 1}`, dataUrl: videoUrl, url: vd.url || videoUrl } })}
                            style={{ height: '76px', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #CBD5E1', backgroundColor: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', position: 'relative' }}
                          >
                            <Video size={20} style={{ color: '#38BDF8' }} />
                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 6px', fontSize: '9px', fontWeight: '700', display: 'flex', justifyContent: 'space-between' }}>
                              <span>🎥 Video</span>
                              <span>›</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic', backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '10px', border: '1px dashed #E2E8F0' }}>
                      No packing photos or videos attached yet for this order.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* VEHICLE LOADING PROOF PHOTOS IN QUICK PREVIEW */}
            {(() => {
              const existingLoading = quickPreviewRecord.vehicleLoading || {};
              const loadingPhotos = (Array.isArray(existingLoading.photos) && existingLoading.photos.length > 0)
                ? existingLoading.photos
                : (Array.isArray(quickPreviewRecord.loadingPhotos) && quickPreviewRecord.loadingPhotos.length > 0)
                  ? quickPreviewRecord.loadingPhotos
                  : (Array.isArray(quickPreviewRecord.photos) && quickPreviewRecord.photos.length > 0)
                    ? quickPreviewRecord.photos : [];

              if (loadingPhotos.length === 0) return null;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Truck size={15} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                          Vehicle Loading Proof Photos ({loadingPhotos.length})
                        </h4>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>Captured by Dispatch Team during final lorry loading</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0' }}>
                      ✓ {loadingPhotos.length} Photo{loadingPhotos.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px' }}>
                    {loadingPhotos.map((ph, pIdx) => {
                      const photoUrl = (ph.url && !ph.url.startsWith('blob:'))
                        ? ph.url
                        : ((ph.dataUrl && !ph.dataUrl.startsWith('blob:')) ? ph.dataUrl : (getMediaFromCache(ph.name) || getMediaFromCache(ph.id) || (ph.name ? `/api/uploads/${ph.name}` : '')));
                      return (
                        <div
                          key={pIdx}
                          onClick={() => setPreviewDocModal({ title: ph.name || `Vehicle Loading Photo ${pIdx + 1}`, doc: { ...ph, name: ph.name || `Vehicle Loading Photo ${pIdx + 1}`, dataUrl: photoUrl, url: photoUrl } })}
                          style={{
                            height: '76px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#0F172A',
                            position: 'relative'
                          }}
                        >
                          <img
                            src={photoUrl || ph.dataUrl}
                            alt={ph.name || `Loading photo ${pIdx + 1}`}
                            onError={(e) => {
                              if (!e.currentTarget.dataset.retried && ph.name) {
                                e.currentTarget.dataset.retried = 'true';
                                fetch(`/api/media/find/${encodeURIComponent(ph.name)}`)
                                  .then(r => r.json())
                                  .then(data => {
                                    if (data?.found && data?.url) {
                                      e.currentTarget.src = data.url;
                                      saveMediaToCache(ph.name, data.url);
                                    }
                                  }).catch(() => {});
                              }
                            }}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 6px', fontSize: '9px', fontWeight: '700', display: 'flex', justifyContent: 'space-between' }}>
                            <span>📷 View</span>
                            <span>›</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* VIEW / UPLOAD PAYMENT DETAILS MODAL */}
      {uploadPaymentModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', maxWidth: '520px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard style={{ width: '18px', height: '18px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Payment Details & Proof</h3>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>{uploadPaymentModal.bomCode} — {uploadPaymentModal.paymentType || '100% Full Advance'}</span>
                </div>
              </div>
              <button onClick={() => setUploadPaymentModal(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}><X style={{ width: '18px', height: '18px' }} /></button>
            </div>

            {(() => {
              const proofObj = uploadPaymentModal.paymentProofDoc || uploadPaymentModal.payments?.proofDocObj;
              const hasProof = Boolean(proofObj || uploadPaymentModal.payments?.proofDoc);
              const proofName = typeof proofObj === 'object' ? proofObj?.name : (uploadPaymentModal.payments?.proofDoc || proofObj);
              const proofData = (typeof proofObj === 'object' ? proofObj?.dataUrl : uploadPaymentModal.payments?.proofDocData) || getMediaFromCache(proofName);
              const isImage = proofData && (proofData.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(proofName || ''));

              return (
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Payment Status</span>
                    <span style={{ backgroundColor: hasProof ? '#DCFCE7' : '#FEF3C7', color: hasProof ? '#166534' : '#B45309', fontSize: '11px', fontWeight: '800', padding: '4px 12px', borderRadius: '12px', border: hasProof ? '1px solid #BBF7D0' : '1px solid #FDE68A' }}>
                      {hasProof ? '✓ Payment Proof Uploaded' : '• Pending Payment Upload'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Customer Name</span>
                      <strong style={{ color: '#0F172A' }}>{uploadPaymentModal.customerName || uploadPaymentModal.companyName || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Payment Terms</span>
                      <strong style={{ color: '#0F172A' }}>{uploadPaymentModal.paymentType || '100% Full Advance'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Grand Total Amount</span>
                      <strong style={{ color: '#059669', fontSize: '14px', fontWeight: '800' }}>
                        ₹ {Number(uploadPaymentModal.grandTotal || uploadPaymentModal.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '11px', marginBottom: '2px' }}>Order Ref Code</span>
                      <strong style={{ color: '#0E7490' }}>{uploadPaymentModal.bomCode || '—'}</strong>
                    </div>
                  </div>

                  {hasProof && (
                    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '8px' }}>
                        {uploadPaymentModal.paymentType === 'Partial Payment' ? 'Initial / Advance Payment Proof:' : 'Attached Payment Proof Document:'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '10px', padding: '12px 14px' }}>
                        {isImage && proofData ? (
                          <img src={proofData} alt="Proof" style={{ width: '46px', height: '46px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #E2E8F0' }} />
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={20} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0F172A', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {proofName || 'Payment_Proof_Document.pdf'}
                          </div>
                          <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>✓ Verified on File</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const bCode = uploadPaymentModal.bomCode || uploadPaymentModal.code;
                            const dUrl = proofData || (typeof proofObj === 'object' ? proofObj?.dataUrl : null) || (proofObj ? resolveDocumentUrl(proofObj) : null);
                            setPreviewDocModal({
                              title: 'Payment Proof Document',
                              bomCode: bCode,
                              doc: typeof proofObj === 'object' && proofObj !== null
                                ? { ...proofObj, bomCode: bCode, dataUrl: dUrl || proofObj.dataUrl }
                                : { name: proofName, dataUrl: dUrl, bomCode: bCode }
                            });
                          }}
                          style={{ fontSize: '12px', fontWeight: '800', color: '#2563EB', backgroundColor: '#EFF6FF', padding: '6px 12px', borderRadius: '8px', border: '1px solid #BFDBFE', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                          <Eye size={13} /> View
                        </button>
                      </div>
                    </div>
                  )}

                  {uploadPaymentModal.paymentType === 'Partial Payment' && (
                    <div style={{ backgroundColor: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#0D9488', display: 'block', fontWeight: '700' }}>Advance Paid:</span>
                        <strong style={{ fontSize: '13px', color: '#0F766E' }}>₹{Number(uploadPaymentModal.partialAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: '#0D9488', display: 'block', fontWeight: '700' }}>Remaining Balance Due:</span>
                        <strong style={{ fontSize: '14px', color: '#0F766E' }}>
                          ₹{Number(uploadPaymentModal.balanceAmount != null ? uploadPaymentModal.balanceAmount : Math.max(0, (uploadPaymentModal.grandTotal || 0) - (uploadPaymentModal.partialAmount || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>
                  )}

                  {!isCeo && (!hasProof || ['Partial Paid', 'Partial Payment', 'Payment While Dispatch', 'Credit Payment'].includes(uploadPaymentModal.paymentType)) && (
                    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F766E' }}>
                        {(uploadPaymentModal.paymentType === 'Partial Paid' || uploadPaymentModal.paymentType === 'Partial Payment')
                          ? (hasProof ? 'Upload Remaining Balance Payment Proof:' : 'Upload Advance / Balance Payment Proof:')
                          : uploadPaymentModal.paymentType === 'Payment While Dispatch'
                            ? 'Upload Dispatch Payment Proof / Receipt:'
                            : uploadPaymentModal.paymentType === 'Credit Payment'
                              ? 'Upload Credit Settlement / Credit Note / Receipt:'
                              : 'Upload Payment Proof Document / Slip:'}
                      </span>

                      {(uploadPaymentModal.paymentType === 'Partial Paid' || uploadPaymentModal.paymentType === 'Partial Payment') && (
                        <div>
                          <label htmlFor="bom-orders-balance-amount-paid" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                            Balance Amount Paid (₹)
                          </label>
                          <input id="bom-orders-balance-amount-paid" name="balanceAmountPaid" aria-label="Balance Amount Paid (₹)"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Enter balance amount paid..."
                            value={modalBalanceAmount}
                            onChange={(e) => setModalBalanceAmount(e.target.value)}
                            style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                           />
                        </div>
                      )}

                      <div>
                        <label htmlFor="bom-orders-input-6" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                          Select Payment Proof Attachment (PDF, JPG, PNG)
                        </label>
                        <input id="bom-orders-input-6" name="input6" aria-label="Select Payment Proof Attachment (PDF, JPG, PNG)"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={(e) => {
                            const f = e.target.files && e.target.files[0];
                            if (f) {
                              try {
                                validateClientFile(f);
                                setPaymentProofFile(f);
                              } catch (err) {
                                e.target.value = '';
                                alert(`⚠️ Cannot Proceed: ${err.message}`);
                                setPaymentProofFile(null);
                              }
                            }
                          }}
                          style={{ width: '100%', padding: '10px', border: '1px dashed #0E7490', backgroundColor: '#F8FAFC', borderRadius: '8px', fontSize: '12px', boxSizing: 'border-box' }}
                         />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button
                onClick={() => setUploadPaymentModal(null)}
                style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Close
              </button>
              {isCeo && (
                <span style={{ fontSize: '12px', color: '#0E7490', fontWeight: '700', alignSelf: 'center', marginRight: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  ℹ️ Executive View Only — Payment records managed by Accounts & Sales
                </span>
              )}
              {!isCeo && (!uploadPaymentModal.paymentProofDoc || ['Partial Paid', 'Partial Payment', 'Payment While Dispatch', 'Credit Payment'].includes(uploadPaymentModal.paymentType)) && (
                <button
                  disabled={uploadingPayment}
                  onClick={async () => {
                    if (!paymentProofFile) {
                      alert('Please attach or select payment proof file!');
                      return;
                    }
                    setUploadingPayment(true);
                    try {
                      let pDocObj;
                      if (paymentProofFile instanceof File) {
                        pDocObj = await uploadBomDocumentFile({
                          file: paymentProofFile,
                          bomCode: uploadPaymentModal.bomCode,
                          category: 'payment-proof'
                        });
                      } else {
                        pDocObj = typeof paymentProofFile === 'object' ? paymentProofFile : { name: paymentProofFile };
                      }
                      const isPartial = uploadPaymentModal.paymentType === 'Partial Paid' || uploadPaymentModal.paymentType === 'Partial Payment';
                      const balPaid = parseFloat(modalBalanceAmount) || 0;
                      const prevBal = uploadPaymentModal.balanceAmount != null ? uploadPaymentModal.balanceAmount : Math.max(0, (uploadPaymentModal.grandTotal || 0) - (uploadPaymentModal.partialAmount || 0));
                      const newBal = isPartial && balPaid > 0 ? Math.max(0, prevBal - balPaid) : prevBal;

                      const updatedList = (bomStore || []).map(b => b.bomCode === uploadPaymentModal.bomCode ? {
                        ...b,
                        status: isPartial ? (newBal <= 0 ? 'Payment Uploaded & Verified' : b.status) : 'Payment Uploaded & Verified',
                        paymentProofDoc: b.paymentProofDoc || pDocObj,
                        balanceProofDoc: pDocObj,
                        balanceAmount: newBal,
                        paymentUpdated: true,
                        payments: {
                          ...b.payments,
                          proofDoc: b.payments?.proofDoc || pDocObj.originalName || pDocObj.name,
                          proofDocObj: b.payments?.proofDocObj || pDocObj,
                          balanceProofDoc: pDocObj.originalName || pDocObj.name,
                          balanceProofDocObj: pDocObj,
                          balanceUploaded: true,
                          paymentUpdated: true
                        }
                      } : b);
                      setBomStore(updatedList);
                      safeSaveBomStoreToLocal(updatedList);

                      const targetBom = updatedList.find(b => b.bomCode === uploadPaymentModal.bomCode);
                      if (targetBom) {
                        saveCloudBomRow(targetBom);
                        fetch('/api/boms', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ bom: stripDataUrlsFromRecord(targetBom), isUpdate: true })
                        }).catch(() => {});
                      }
                      setUploadPaymentModal(null);
                      setPaymentProofFile(null);
                      setModalBalanceAmount('');
                      alert('✅ Payment proof uploaded and saved successfully!');
                    } catch (err) {
                      alert(`Payment upload failed: ${err.message}`);
                    } finally {
                      setUploadingPayment(false);
                    }
                  }}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: uploadingPayment ? '#94A3B8' : '#0E7490', color: 'white', fontSize: '13px', fontWeight: '800', cursor: uploadingPayment ? 'not-allowed' : 'pointer' }}
                >
                  {uploadingPayment ? 'Uploading...' : 'Save & Update Payment Proof'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM ALERT POPUP WITH MISSING FIELDS SUPPORT */}
      {customAlert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '16px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '18px', padding: '24px', maxWidth: '480px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
                backgroundColor: customAlert.type === 'error' ? '#FEE2E2' : customAlert.type === 'warning' ? '#FEF3C7' : '#DCFCE7',
                color: customAlert.type === 'error' ? '#DC2626' : customAlert.type === 'warning' ? '#D97706' : '#166534',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {customAlert.type === 'error' ? <AlertCircle size={24} /> : customAlert.type === 'warning' ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' }}>{customAlert.title}</h3>
                <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.4', whiteSpace: 'pre-line' }}>{customAlert.message}</p>
              </div>
            </div>

            {/* Render Missing Fields Card List if provided */}
            {Array.isArray(customAlert.details) && customAlert.details.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                {customAlert.details.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      if (item.targetId) {
                        const el = document.getElementById(item.targetId);
                        if (el) {
                          setCustomAlert(null);
                          setTimeout(() => {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el.focus();
                          }, 100);
                        }
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '10px',
                      padding: '10px 14px', backgroundColor: '#FEF2F2',
                      border: '1px solid #FECACA', borderRadius: '10px',
                      cursor: item.targetId ? 'pointer' : 'default'
                    }}
                  >
                    <AlertCircle size={16} style={{ color: '#EF4444', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#991B1B' }}>{item.field}</div>
                      <div style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>{item.message}</div>
                    </div>
                    {item.targetId && (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '2px 8px', borderRadius: '6px', alignSelf: 'center', whiteSpace: 'nowrap' }}>
                        Fill Field →
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                onClick={() => {
                  const targetId = customAlert.targetFieldId || (customAlert.details?.[0]?.targetId);
                  setCustomAlert(null);
                  if (targetId) {
                    setTimeout(() => {
                      const el = document.getElementById(targetId);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.focus();
                      }
                    }, 100);
                  }
                }}
                style={{
                  padding: '9px 22px', borderRadius: '10px', border: 'none',
                  backgroundColor: customAlert.type === 'error' ? '#DC2626' : '#0E7490',
                  color: 'white', fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(14,116,144,0.3)'
                }}
              >
                {customAlert.details?.length > 0 ? 'Review & Fill Details →' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {renderDocPreviewModal()}

      {/* EXPORT FORMAT SELECTOR MODAL (PDF / JPG / CSV) */}
      {renderExportFormatModal()}

      {/* PRINTABLE BOM ORDER SHEET TEMPLATE */}
      {printingBomRecord && (
        <VRMBomPrintTemplate
          bomData={printingBomRecord}
          onClose={() => setPrintingBomRecord(null)}
          userRole={props.userRole || userRole || 'Sales Executive'}
          isSales={true}
        />
      )}

      {/* BOM CANCELLATION REASON PROMPT MODAL */}
      {bomCancelPromptModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100000, padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#FFFFFF'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <AlertTriangle style={{ width: '22px', height: '22px', color: '#FFFFFF' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                    Cancel BOM & Restore Stock
                  </h3>
                  <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                    BOM: <strong>{bomCancelPromptModal.bomCode || bomCancelPromptModal.code}</strong> • Customer: {bomCancelPromptModal.customerName || bomCancelPromptModal.clientName || 'Customer'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setBomCancelPromptModal(null);
                  setCancellationReasonInput('');
                }}
                style={{
                  background: 'none', border: 'none', color: '#FFFFFF',
                  cursor: 'pointer', padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '10px',
                padding: '12px 16px',
                fontSize: '12px',
                color: '#991B1B',
                lineHeight: 1.5
              }}>
                <strong>⚠️ Why are you cancelling this BOM?</strong>
                <br />
                The Sales Person (<strong>{(bomCancelPromptModal.salesPerson || bomCancelPromptModal.createdBy || 'Sales Department').replace(/\s*\([^)]*\)/g, '').trim()}</strong>) who raised this order will be immediately notified with your reason, and reserved stock will be returned to raw inventory.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Quick Select Reason
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    'Customer requested order cancellation',
                    'Specification / Drawing changed by client',
                    'Payment term non-compliance',
                    'Wrong profile / cut length selected in BOM',
                    'Duplicate BOM entry created',
                    'Material grade / thickness unavailable'
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCancellationReasonInput(preset)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: cancellationReasonInput === preset ? '1.5px solid #DC2626' : '1px solid #CBD5E1',
                        backgroundColor: cancellationReasonInput === preset ? '#FEF2F2' : '#F8FAFC',
                        color: cancellationReasonInput === preset ? '#DC2626' : '#475569',
                        fontSize: '11px',
                        fontWeight: cancellationReasonInput === preset ? '700' : '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="bom-orders-cancellation-reason-input" style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Cancellation Reason <span style={{ color: '#DC2626' }}>* (Required)</span>
                </label>
                <textarea id="bom-orders-cancellation-reason-input" name="cancellationReasonInput" aria-label="Cancellation Reason  (Required)"
                  value={cancellationReasonInput}
                  onChange={(e) => setCancellationReasonInput(e.target.value)}
                  placeholder="Explain why this BOM is being cancelled (e.g. Customer cancelled the project, drawing mismatch...)"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    fontSize: '13px',
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: '1.5'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#DC2626'}
                  onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
                 />
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                type="button"
                onClick={() => {
                  setBomCancelPromptModal(null);
                  setCancellationReasonInput('');
                }}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Keep BOM Active
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!cancellationReasonInput.trim()) {
                    alert('Please enter or select a reason for cancelling this BOM.');
                    return;
                  }
                  executeCancelBom(bomCancelPromptModal, cancellationReasonInput.trim());
                }}
                disabled={!cancellationReasonInput.trim()}
                style={{
                  padding: '9px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: cancellationReasonInput.trim() ? '#DC2626' : '#FCA5A5',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: cancellationReasonInput.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: cancellationReasonInput.trim() ? '0 4px 12px rgba(220, 38, 38, 0.3)' : 'none'
                }}
              >
                <XCircle size={15} /> Confirm & Cancel BOM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MANDATORY VALIDATION MODAL */}
      {renderValidationErrorModal()}

      {/* FULL-SCREEN BOM CREATION LOADING OVERLAY */}
      {renderBomSubmittingOverlay()}

      {/* ─── DEDICATED LR COPY UPLOAD POPUP MODAL ─── */}
      {lrUploadModal && (
        <LrUploadPopupModal
          bom={lrUploadModal}
          onClose={() => setLrUploadModal(null)}
          setBomStore={setBomStore}
        />
      )}
    </div>
  );
}

