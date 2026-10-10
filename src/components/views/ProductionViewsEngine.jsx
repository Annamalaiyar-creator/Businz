import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Plus, Check, Trash2, Eye, FileText, Search, PlusCircle, AlertCircle, AlertTriangle, X,
  TrendingUp, Users, CheckCircle, Clock, ShieldAlert, Award,
  MapPin, Phone, Mail, FileCheck, CheckSquare, XCircle, ArrowRight, ArrowLeft,
  TrendingDown, DollarSign, Calendar, Edit3, SlidersHorizontal, Filter,
  ChevronLeft, ChevronRight, MoreVertical, RotateCcw, UploadCloud, ChevronDown, ChevronUp, ExternalLink,
  Truck, Shield, Package, Star, Download, HelpCircle, Info, ShoppingCart, Upload, Printer, Maximize2,
  ShieldCheck, Layers, Factory, Cpu, Receipt, IndianRupee, Smartphone, Camera, Image, RefreshCw,
  CreditCard, Bell, Video, Play, Pause, Film, Sparkles, MoreHorizontal, Copy, Hourglass, Boxes, Save
} from 'lucide-react';
import CreateWorkOrderPage from '../CreateWorkOrderPage';
import RawMaterialInventoryView from './RawMaterialInventoryView';
import WorkOrdersView from './WorkOrdersView';
import InvoiceDetailModal from './InvoiceDetailModal';
import ConfirmingBomModal from './ConfirmingBomModal';
import DispatchPackingModal from './DispatchPackingModal';
import AccountsVerificationModal from './AccountsVerificationModal';
import DocPreviewModal from './DocPreviewModal';
import CustomerProfileView from './CustomerProfileView';
import CustomerFormView from './CustomerFormView';
import CreateBomFormPage from './CreateBomFormPage';
import VehicleLoadingModal from './VehicleLoadingModal';
import DeliveryChallanModal from './DeliveryChallanModal';
import QuickPreviewDrawer from './QuickPreviewDrawer';
import ProductionTableView from './ProductionTableView';
import { UploadPaymentModal, UpdatePaymentModal, ReuploadAddressProofModal } from './PaymentAndProofModals';
import { CompletedBomSummaryModal, ActiveMediaPreviewModal, PreviewAddressProofModal, DispatchChecklistPreviewModal, ViewingProofDocModal, BomCancelPromptModal } from './DispatchAndPreviewModals';
import { buildProductionConfigs } from './productionConfigs';
import { CloseInvoiceReasonModal, ConfirmInvoiceSuccessModal } from './InvoiceModals';
import { fetchCloudStore, saveCloudStore, saveCloudStoreImmediate, subscribeToCloudStore, getAndReserveNextBomCode, resolveBomCollisions, getWorkflowRank } from '../../utils/supabaseDataSync';
import { getItems, getVendors } from '../../services/businzDataService';
import { VRM_HDG_PRESETS, getAllActivePresets } from '../../vrmHdgProposalPresets';
import { VRM_PRODUCTS } from '../../utils/vrmProductsData';
import { getFullProductsCatalogWithStock } from '../../utils/productCatalogService';
import { prodModuleEngine } from '../../utils/productionModuleEngine';
import NotificationToast from '../NotificationToast';
import { addLiveNotification } from '../Header';
import VRMTaxInvoicePrintTemplate from '../VRMTaxInvoicePrintTemplate';
import VRMBomPrintTemplate, { VRMBomPrintSheet } from '../VRMBomPrintTemplate';
import * as XLSX from 'xlsx';
import { saveMediaToCache, getMediaFromCache, stripDataUrlsFromRecord, readCompressedImage, compressAndSaveFile, cleanNum, formatCurrency } from '../../utils/otherViewsShared';
import StatusBadge from '../StatusBadge';
import SearchablePresetSelector from '../SearchablePresetSelector';
import TypeableProductSelect from '../TypeableProductSelect';
import { is5PctSolarProduct } from '../PerformaInvoiceView';
import {
  notifyBomSentToDispatch,
  notifyBomPackedAndSentToAccounts,
  notifyAccountsVerificationCompleted,
  notifyInvoiceCompletedReadyForDispatch,
  notifyBomCancelledByDispatch
} from '../../services/notificationService';


export default function ProductionViewsEngine(props) {
  const {
    activeTab,
    onChangeTab,
    userRole = 'Sales Executive',
    convertingPiData,
    onClearConvertingPiData
  } = props;

  // Common states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);

  // Top-level state for Production Admin views to obey React Hook rules
  const [prodActiveSubTab, setProdActiveSubTab] = useState('All');
  const [prodSearchQueryText, setProdSearchQueryText] = useState('');
  const [prodFilterDateVal, setProdFilterDateVal] = useState('');
  const [prodFilterEndDateVal, setProdFilterEndDateVal] = useState('');
  const [prodFilterStatusSelect, setProdFilterStatusSelect] = useState('All');
  const [prodStatusFilterText, setProdStatusFilterText] = useState('All');

  useEffect(() => {
    setProdActiveSubTab('All');
    setProdSearchQueryText('');
    setProdFilterDateVal('');
    setProdFilterEndDateVal('');
    setProdFilterStatusSelect('All');
    setSelectedRows([]);
    setCurrentPage(1);
  }, [activeTab]);

  const [showBOMForm, setShowBOMForm] = useState(false);
  const [showWorkOrderForm, setShowWorkOrderForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [custFormName, setCustFormName] = useState('');
  const [custFormCompany, setCustFormCompany] = useState('');
  const [custFormGstNo, setCustFormGstNo] = useState('');
  const [custFormMobile, setCustFormMobile] = useState('');
  const [custFormEmail, setCustFormEmail] = useState('');

  // Structured Billing Address
  const [custFormBillingAddress, setCustFormBillingAddress] = useState('');
  const [custFormBillingCity, setCustFormBillingCity] = useState('');
  const [custFormBillingState, setCustFormBillingState] = useState('');
  const [custFormBillingPincode, setCustFormBillingPincode] = useState('');

  // Structured Delivery Address
  const [custFormSameAsBilling, setCustFormSameAsBilling] = useState(false);
  const [custFormDeliveryAddress, setCustFormDeliveryAddress] = useState('');
  const [custFormDeliveryCity, setCustFormDeliveryCity] = useState('');
  const [custFormDeliveryState, setCustFormDeliveryState] = useState('');
  const [custFormDeliveryPincode, setCustFormDeliveryPincode] = useState('');

  const [customerList, setCustomerList] = useState([]);

  // Local customerList state (authoritative source is Supabase public.customers)
  const isInitialCustMount = useRef(true);
  useEffect(() => {
    if (isInitialCustMount.current) {
      isInitialCustMount.current = false;
      return;
    }
  }, [customerList]);

  const [customerActionMenuIdx, setCustomerActionMenuIdx] = useState(null);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [previewAddressProofModal, setPreviewAddressProofModal] = useState(null);
  const [bomStore, setBomStore] = useState(() => {
    try {
      const local = JSON.parse(localStorage.getItem('controlroom_bom_store') || '[]');
      if (Array.isArray(local) && local.length > 0) {
        return local;
      }
    } catch (_) {}
    return [];
  });

  const currentEmpId = (localStorage.getItem('controlroom_logged_emp_id') || '').trim();
  const currentEmpName = (localStorage.getItem('controlroom_logged_user_name') || '').trim();
  const currentLoggedEmail = (localStorage.getItem('controlroom_logged_user') || '').trim().toLowerCase();

  const isRestrictedSalesUser = Boolean(
    userRole &&
    ['Sales Executive', 'Sales', 'Salesperson', 'Sales Rep', 'Sales Representative'].some(r => r.toLowerCase() === userRole.toLowerCase().trim()) &&
    !['Sales Head', 'CEO', 'MD', 'Managing Director', 'Technical Administrator', 'Dispatch Head', 'Dispatch', 'Dispatch Team', 'Production Head', 'Accounts Head', 'Accounts Executive', 'Billing', 'Floor Supervisor', 'Procurement Head'].some(r => r.toLowerCase() === userRole.toLowerCase().trim())
  );

  const visibleBomStore = useMemo(() => {
    const rawList = (bomStore || []).filter(Boolean);
    if (!isRestrictedSalesUser) return rawList;

    const curCode = currentEmpId.toUpperCase();
    const curName = currentEmpName.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    const curEmail = currentLoggedEmail;

    return rawList.filter(b => {
      if (!b) return false;
      const spCode = (b.salesPersonCode || b.createdById || '').trim().toUpperCase();
      if (curCode && spCode && spCode === curCode) return true;

      const spName = (b.salesPerson || b.createdBy || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      const creatorName = (b.createdBy || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      if (curName) {
        if (spName && (spName === curName || spName.includes(curName) || curName.includes(spName))) return true;
        if (creatorName && (creatorName === curName || creatorName.includes(curName) || curName.includes(creatorName))) return true;
        const cleanCur = curName.replace(/\s+/g, '');
        if (spName && spName.replace(/\s+/g, '').includes(cleanCur)) return true;
        if (creatorName && creatorName.replace(/\s+/g, '').includes(cleanCur)) return true;
      }

      if (curEmail && (b.salesPersonEmail || b.email || '').toLowerCase() === curEmail) {
        return true;
      }

      return false;
    });
  }, [bomStore, isRestrictedSalesUser, currentEmpId, currentEmpName, currentLoggedEmail]);

  const hasInitialSyncedRef = useRef(false);

  // Keep local convenience cache updated without cloud egress
  useEffect(() => {
    if (bomStore && Array.isArray(bomStore) && bomStore.length > 0) {
      try {
        const sanitized = bomStore.map(stripDataUrlsFromRecord);
        localStorage.setItem('controlroom_bom_store', JSON.stringify(sanitized));
      } catch (_) {}
    }
  }, [bomStore]);

  useEffect(() => {
    const syncFromCloud = async () => {
      try {
        let data = null;
        try {
          const apiRes = await fetch('/api/boms?refresh=true');
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
            setBomStore(prev => (Array.isArray(prev) && prev.length > 0 ? prev : []));
          } else {
            setBomStore(prev => {
              const { list: resolvedList } = resolveBomCollisions(data, 662);
              // Protect workflow progression: never let a stale server record revert a completed/dispatched status
              const prevMap = new Map((prev || []).map(b => [b.bomCode || b.code || b.id, b]));
              const mergedList = resolvedList.map(item => {
                const k = item.bomCode || item.code || item.id;
                const prevItem = prevMap.get(k);
                if (!prevItem) return item;
                const prevRank = getWorkflowRank(prevItem);
                const newRank = getWorkflowRank(item);

                const prevPacking = Array.isArray(prevItem.dispatchPacking) ? prevItem.dispatchPacking : [];
                const itemPacking = Array.isArray(item.dispatchPacking) ? item.dispatchPacking : [];
                const prevPackedCount = prevPacking.filter(p => p && p.packed).length;
                const itemPackedCount = itemPacking.filter(p => p && p.packed).length;
                const resolvedPacking = (prevPackedCount > 0 && prevPackedCount >= itemPackedCount) 
                  ? prevPacking 
                  : (itemPackedCount > 0 ? itemPacking : (prevPacking.length > 0 ? prevPacking : itemPacking));

                const resolvedPackingStatus = (prevItem.packingStatus === 'PACKING_VERIFIED' || item.packingStatus === 'PACKING_VERIFIED') 
                  ? 'PACKING_VERIFIED' 
                  : (prevItem.packingStatus === 'PARTIALLY_PACKED' || item.packingStatus === 'PARTIALLY_PACKED')
                    ? 'PARTIALLY_PACKED'
                    : (item.packingStatus || prevItem.packingStatus || null);

                const effectiveStatus = (prevRank > newRank) ? prevItem.status : item.status;

                return {
                  ...item,
                  ...((prevRank > newRank) ? prevItem : {}),
                  status: effectiveStatus,
                  dispatchPacking: resolvedPacking,
                  packingStatus: resolvedPackingStatus,
                  accountsVerification: {
                    ...(item.accountsVerification || {}),
                    ...(prevItem.accountsVerification || {}),
                    verified: Boolean(item.accountsVerification?.verified || prevItem.accountsVerification?.verified),
                    readyForAccounts: Boolean(item.accountsVerification?.readyForAccounts || prevItem.accountsVerification?.readyForAccounts),
                    packedAt: item.accountsVerification?.packedAt || prevItem.accountsVerification?.packedAt || prevItem.packedAt || item.packedAt || null,
                    packedBy: item.accountsVerification?.packedBy || prevItem.accountsVerification?.packedBy || prevItem.packedBy || item.packedBy || null
                  },
                  dispatchPackingMedia: (item.dispatchPackingMedia?.photos?.length > 0 || item.dispatchPackingMedia?.videos?.length > 0)
                    ? item.dispatchPackingMedia
                    : (prevItem.dispatchPackingMedia || { photos: [], videos: [] }),
                  vehicleLoading: item.vehicleLoading || prevItem.vehicleLoading || null,
                  lrCopyDoc: item.lrCopyDoc || prevItem.lrCopyDoc || null,
                  packedAt: prevItem.packedAt || item.packedAt || null,
                  packedBy: prevItem.packedBy || item.packedBy || null,
                  packedById: prevItem.packedById || item.packedById || null,
                  packingCompletedAt: prevItem.packingCompletedAt || item.packingCompletedAt || null,
                  fullyCompleted: (prevItem.fullyCompleted !== undefined && prevRank >= newRank) ? prevItem.fullyCompleted : (item.fullyCompleted !== undefined ? item.fullyCompleted : prevItem.fullyCompleted),
                  salesPerson: prevItem.salesPerson || item.salesPerson,
                  salesPersonCode: prevItem.salesPersonCode || item.salesPersonCode
                };
              });

              const parseBomSeq = (code) => {
                const vrm = String(code || '').match(/VRM-BOM-\d{4}-(\d+)/i);
                if (vrm) return parseInt(vrm[1], 10);
                const m = String(code || '').match(/BOM-(\d+)/i);
                return m ? parseInt(m[1], 10) : 0;
              };
              const sorted = mergedList.sort((a, b) => {
                const seqA = parseBomSeq(a?.bomCode || a?.code || a?.id);
                const seqB = parseBomSeq(b?.bomCode || b?.code || b?.id);
                if (seqA !== seqB) return seqB - seqA;
                const dateA = new Date(a?.salesConfirmedAt || a?.date || a?.createdAt || 0).getTime() || 0;
                const dateB = new Date(b?.salesConfirmedAt || b?.date || b?.createdAt || 0).getTime() || 0;
                return dateB - dateA;
              });
              const nextList = sorted.map(stripDataUrlsFromRecord);
              if (Array.isArray(prev) && prev.length === nextList.length) {
                try {
                  if (JSON.stringify(prev) === JSON.stringify(nextList)) {
                    return prev;
                  }
                } catch (_) {}
              }
              return nextList;
            });
          }
        }

        // Sync Customers directly from Supabase & backend
        try {
          let custs = await fetchCloudStore('customer_store', []);
          if (!Array.isArray(custs) || custs.length === 0) {
            const custRes = await fetch('/api/customers');
            if (custRes.ok) {
              const fetchedCusts = await custRes.json();
              if (Array.isArray(fetchedCusts) && fetchedCusts.length > 0) custs = fetchedCusts;
            }
          }
          if (Array.isArray(custs) && custs.length > 0) {
            setCustomerList(prev => {
              if (Array.isArray(prev) && prev.length === custs.length) {
                try {
                  if (JSON.stringify(prev) === JSON.stringify(custs)) return prev;
                } catch (_) {}
              }
              return custs;
            });
          }
        } catch (_) {}
      } catch (err) {
        console.error('Error syncing BOMs in ProductionViewsEngine:', err);
      } finally {
        hasInitialSyncedRef.current = true;
      }
    };

    syncFromCloud();
    // Gentle 90s safety fallback check only when active and tab is visible (replaces aggressive 4s polling)
    const fallbackInterval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        syncFromCloud();
      }
    }, 90000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        syncFromCloud();
      }
    };

    const handleBomUpdated = (e) => {
      if (e?.detail?.bom) {
        const newBom = e.detail.bom;
        setBomStore(prev => {
          const k = newBom.bomCode || newBom.code || newBom.id;
          const filtered = (prev || []).filter(b => b && (b.bomCode !== k && b.code !== k && b.id !== k));
          const list = [newBom, ...filtered];
          return list.map(stripDataUrlsFromRecord);
        });
      }
    };

    window.addEventListener('controlroom_bom_store_updated', handleBomUpdated);
    window.addEventListener('controlroom_storage_update', syncFromCloud);
    window.addEventListener('storage', syncFromCloud);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(fallbackInterval);
      window.removeEventListener('controlroom_bom_store_updated', handleBomUpdated);
      window.removeEventListener('controlroom_storage_update', syncFromCloud);
      window.removeEventListener('storage', syncFromCloud);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [activeTab]);

  const [showFloatingMoreMenu, setShowFloatingMoreMenu] = useState(false);
  const [quickPreviewRecord, setQuickPreviewRecord] = useState(null);
  const [confirmingBomModal, setConfirmingBomModal] = useState(null); // Full BOM object being confirmed by Salesperson
  const [uploadPaymentModal, setUploadPaymentModal] = useState(null); // Full BOM object uploading payment proof
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentStageType, setPaymentStageType] = useState('100% Advance'); // '100% Advance' | '50% Advance' | '50% Dispatch' | 'Net 30 Days'
  const [dispatchPackingModal, setDispatchPackingModal] = useState(null); // Full BOM object being packed by Dispatch Head
  const [bomCancelPromptModal, setBomCancelPromptModal] = useState(null); // Full BOM object awaiting cancellation reason
  const [cancellationReasonInput, setCancellationReasonInput] = useState('');
  const [accountsVerificationModal, setAccountsVerificationModal] = useState(null); // Full BOM object being verified by Accounts Team
  const [isAccountsViewOnly, setIsAccountsViewOnly] = useState(false); // Controls View mode vs Verification mode
  const [accountsBomViewMode, setAccountsBomViewMode] = useState('paper'); // 'paper' | 'table'
  const [viewingProofDocModal, setViewingProofDocModal] = useState(null); // BOM object or proof doc being viewed in detail
  const [showSoftCopyModal, setShowSoftCopyModal] = useState(false);
  const [softCopyMode, setSoftCopyMode] = useState('upload'); // 'upload' | 'camera'
  const [selectedSoftCopyFile, setSelectedSoftCopyFile] = useState(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraErrorMsg, setCameraErrorMsg] = useState('');
  const cameraVideoRef = useRef(null);
  const cameraCanvasRef = useRef(null);
  const mediaStreamRef = useRef(null);

  const [showDispatchCameraModal, setShowDispatchCameraModal] = useState(false);
  const [dispatchCameraError, setDispatchCameraError] = useState('');
  const dispatchCameraVideoRef = useRef(null);
  const dispatchCameraCanvasRef = useRef(null);
  const dispatchCameraStreamRef = useRef(null);

  const [newBomCode, setNewBomCode] = useState('');
  const [newBomDeliveryDate, setNewBomDeliveryDate] = useState('');
  const [newBomProductName, setNewBomProductName] = useState('');
  const [newBomSku, setNewBomSku] = useState('');
  const [newBomRevision, setNewBomRevision] = useState('');
  const [newBomTargetQty, setNewBomTargetQty] = useState('');
  const [newBomStatus, setNewBomStatus] = useState('ACTIVE');
  const [bomFormErrors, setBomFormErrors] = useState({});

  // Permission Check for Cancel BOM (Strictly Dispatch, Accounts, Production, Billing, and Admin)
  const canCancelBom = [
    'Dispatch Head', 'Dispatch Executive',
    'Accounts Head', 'Accounts Executive', 'Accounts Lead', 'Finance & Accounts', 'Accounts',
    'Production Head', 'Technical Administrator', 'CEO', 'MD', 'Managing Director',
    'Floor Supervisor', 'Billing', 'Invoice Executive', 'Billing & Invoice Executive'
  ].includes(userRole);

  // Helper to Restore / Unblock Inventory when a BOM is Cancelled
  const restoreInventoryForBom = (bomItems = [], bomCode = '') => {
    if (!Array.isArray(bomItems) || bomItems.length === 0) return;
    try {
      const rawStoreStr = localStorage.getItem('controlroom_raw_materials_store');
      let currentMats = [];
      if (rawStoreStr) {
        try { currentMats = JSON.parse(rawStoreStr); } catch (_) {}
      }
      if (!Array.isArray(currentMats)) currentMats = [];

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

        let match = currentMats.find(m => {
          const mCode = (m.code || '').toUpperCase().trim();
          const mName = (m.name || '').toLowerCase().trim();
          if (pCode && mCode === pCode) return true;
          if (pName && (mName === pName || mName.includes(pName) || pName.includes(mName))) return true;
          return false;
        });

        if (match) {
          const currStock = parseFloat(String(match.stock).replace(/,/g, '')) || 0;
          const newStock = currStock + qtyToRestore;
          match.stock = newStock;
          match.reserved = Math.max(0, (parseFloat(match.reserved) || 0) - qtyToRestore);
          match.blockedForBom = Math.max(0, (match.blockedForBom || 0) - qtyToRestore);
          const minL = parseFloat(String(match.minLevel || '100').replace(/,/g, '')) || 100;
          match.status = newStock === 0 ? 'Out of Stock' : (newStock <= minL ? 'Low Stock' : 'In Stock');
          match.lastUpdated = `Restored from Cancelled BOM ${bomCode}`;
        }

        let itemMatch = currentItems.find(it => {
          const itCode = (it.code || '').toUpperCase().trim();
          const itName = (it.name || '').toLowerCase().trim();
          if (pCode && itCode === pCode) return true;
          if (pName && (itName === pName || itName.includes(pName) || pName.includes(itName))) return true;
          return false;
        });
        if (itemMatch) {
          const currStock = parseFloat(String(itemMatch.stock || itemMatch.availableStock || 0).replace(/,/g, '')) || 0;
          const newStock = currStock + qtyToRestore;
          itemMatch.stock = newStock;
          itemMatch.availableStock = newStock;
          itemMatch.reserved = Math.max(0, (parseFloat(itemMatch.reserved) || 0) - qtyToRestore);
          itemMatch.status = newStock === 0 ? 'Out of Stock' : (newStock <= (itemMatch.minLevel || 20) ? 'Low Stock' : 'In Stock');
        }
      });

      localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(currentMats));
      if (currentItems.length > 0) localStorage.setItem('controlroom_items_list', JSON.stringify(currentItems));
      saveCloudStore('raw_materials_store', currentMats);
      window.dispatchEvent(new Event('controlroom_raw_materials_update'));
      window.dispatchEvent(new Event('controlroom_storage_update'));
    } catch (err) {
      console.error('Error restoring inventory for BOM:', err);
    }
  };

  // Execution function to initiate Cancel BOM - prompts for mandatory reason
  const handleCancelBomOrder = (bomToCancel) => {
    if (!bomToCancel) return;
    if (!canCancelBom) {
      alert('⛔ Access Restricted!\nOnly Dispatch, Accounts, Production, or Billing logins are authorized to cancel a BOM and release reserved inventory.');
      return;
    }

    const isAlreadySentToAccounts = Boolean(
      bomToCancel.status === 'Packed & Awaiting Accounts Verification' ||
      bomToCancel.status === 'PACKING VERIFIED - SENT TO ACCOUNTS' ||
      bomToCancel.status === 'Packing Verified - Sent to Accounts' ||
      bomToCancel.status === 'Accounts Verified & Passed to Invoice' ||
      bomToCancel.status === 'ACCOUNTS VERIFIED' ||
      bomToCancel.status === 'Invoice Confirmed' ||
      bomToCancel.status === 'Awaiting Vehicle Loading & Dispatch' ||
      bomToCancel.status === 'AWAITING VEHICLE LOADING' ||
      bomToCancel.status === 'Closed' ||
      bomToCancel.status === 'CLOSED' ||
      bomToCancel.status === 'COMPLETED & DISPATCHED' ||
      bomToCancel.status === 'Completed' ||
      bomToCancel.tabGroup === 'Packed' ||
      bomToCancel.tabGroup === 'AwaitingLoading' ||
      bomToCancel.tabGroup === 'Closed' ||
      bomToCancel.accountsVerification?.readyForAccounts ||
      bomToCancel.accountsVerification?.verified
    );

    const isDispatchContext = Boolean(
      activeTab === 'Dispatch Orders' ||
      activeTab === 'Dispatch Dashboard' ||
      ['Dispatch Head', 'Dispatch Executive', 'Dispatch Team', 'Dispatch'].some(r => r.toLowerCase() === (userRole || '').toLowerCase().trim())
    );

    if (isDispatchContext && isAlreadySentToAccounts) {
      alert('⛔ Cancellation Restricted!\nThis BOM order has already been verified and forwarded to Accounts. Dispatch can only cancel orders before sending to Accounts.');
      return;
    }

    setBomCancelPromptModal(bomToCancel);
    setCancellationReasonInput('');
  };

  // Execution function to finalize Cancel BOM with mandatory reason and notify Sales Person
  const executeCancelBom = async (bomToCancel, reason) => {
    if (!bomToCancel) return;
    const cleanReason = (reason || '').trim();
    if (!cleanReason) {
      alert('⚠️ Cancellation Reason is mandatory.\nPlease specify why this BOM is being cancelled so the sales team is notified.');
      return;
    }

    const bCode = bomToCancel.bomCode || bomToCancel.code || bomToCancel.id;

    // 1. Restore Inventory
    const itemsToRestore = (bomToCancel.items && bomToCancel.items.length > 0)
      ? bomToCancel.items
      : (bomToCancel.dispatchPacking && bomToCancel.dispatchPacking.length > 0)
        ? bomToCancel.dispatchPacking
        : [];
    restoreInventoryForBom(itemsToRestore, bCode);

    // 2. Resolve Canceller's exact Name, Position/Role, and Department/Team for the Sales Person
    const resolveCancellerIdentity = () => {
      const storedName = (localStorage.getItem('controlroom_logged_user_name') || '').replace(/\s*\([^)]*\)/g, '').trim();
      const storedRole = (localStorage.getItem('controlroom_user_role') || userRole || '').trim();
      
      let team = 'Dispatch Team';
      let position = storedRole || 'Dispatch Head';

      if (activeTab === 'Accounts Verification' || storedRole.toLowerCase().includes('account')) {
        team = 'Accounts Team';
        if (!storedRole || storedRole === 'Sales Executive' || storedRole === 'Dispatch Head') {
          position = 'Accounts Executive';
        }
      } else if (activeTab === 'Invoice Management' || storedRole.toLowerCase().includes('invoice') || storedRole.toLowerCase().includes('bill')) {
        team = 'Invoice Team';
        if (!storedRole || storedRole === 'Sales Executive' || storedRole === 'Dispatch Head') {
          position = 'Billing & Invoice Executive';
        }
      } else if (activeTab === 'Dispatch Orders' || activeTab === 'Dispatch Dashboard' || storedRole.toLowerCase().includes('dispatch')) {
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

    // 3. Prepare updated cancelled BOM record with full attribution
    const updatedBomRecord = {
      ...bomToCancel,
      status: 'Cancelled & Stock Restored',
      cancelled: true,
      cancellationReason: cleanReason,
      stockBlocked: false,
      cancelledBy: personName,
      cancelledByRole: position,
      cancelledByTeam: team,
      cancelledByNameAndRole: fullAttribution,
      cancelledAt: new Date().toISOString()
    };

    // 4. Update local bomStore and storage
    setBomStore(prev => {
      const updated = prev.map(b => (b.bomCode === bCode || b.code === bCode || b.id === bCode) ? updatedBomRecord : b);
      const sanitized = updated.map(stripDataUrlsFromRecord);
      try {
        localStorage.setItem('controlroom_bom_store', JSON.stringify(sanitized));
      } catch (_) {}
      return sanitized;
    });

    try {
      await fetch('/api/boms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bom: stripDataUrlsFromRecord(updatedBomRecord), isUpdate: true })
      });
    } catch (apiErr) {
      console.error('Error updating cancelled BOM to /api/boms:', apiErr);
    }

    window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: updatedBomRecord } }));

    // 5. Notify Sales Person who raised this BOM with canceller's name, role & team
    const salesPerson = bomToCancel.salesPerson || bomToCancel.salesExecutive || bomToCancel.createdBy || 'Sales Executive';
    notifyBomCancelledByDispatch({
      bomCode: bCode,
      customerName: bomToCancel.customerName,
      salesPerson: salesPerson,
      reason: cleanReason,
      cancelledBy: fullAttribution,
      cancelledByRole: position,
      cancelledByTeam: team
    });

    // 6. Close open modals if target BOM matches
    if (dispatchPackingModal && (dispatchPackingModal.bomCode === bCode || dispatchPackingModal.code === bCode || dispatchPackingModal.id === bCode)) {
      setDispatchPackingModal(null);
    }
    if (accountsVerificationModal && (accountsVerificationModal.bomCode === bCode || accountsVerificationModal.code === bCode || accountsVerificationModal.id === bCode)) {
      setAccountsVerificationModal(null);
    }
    if (confirmingBomModal && (confirmingBomModal.bomCode === bCode || confirmingBomModal.code === bCode || confirmingBomModal.id === bCode)) {
      setConfirmingBomModal(null);
    }
    if (quickPreviewRecord && (quickPreviewRecord.bomCode === bCode || quickPreviewRecord.code === bCode || quickPreviewRecord.id === bCode)) {
      setQuickPreviewRecord(null);
    }
    setBomCancelPromptModal(null);
    setCancellationReasonInput('');

    alert(`✅ BOM (${bCode}) has been CANCELLED.\nReason: "${cleanReason}"\nSales person (${salesPerson.replace(/\\s*\\([^)]*\\)/g, '').trim()}) has been notified and all items have been restored to live inventory.`);
  };

  // Validation for Production BOM creation
  const validateProductionBomForm = (isDraft = false) => {
    const errors = {};
    const missingList = [];

    if (!newBomProductName || !newBomProductName.trim()) {
      errors.customerName = 'Customer Name is required';
      missingList.push({
        field: 'Customer Name',
        message: 'Please select or enter the customer name.',
        targetId: 'prod-field-newBomProductName'
      });
    }

    if (!isDraft && (!newBomDeliveryDate || !newBomDeliveryDate.trim())) {
      errors.deliveryDate = 'Delivery Date is required';
      missingList.push({
        field: 'Delivery Date',
        message: 'Please select expected Delivery Date for Dispatch.',
        targetId: 'prod-field-newBomDeliveryDate'
      });
    }

    if (!bomMaterialsList || bomMaterialsList.length === 0) {
      errors.items = 'At least 1 product item or preset kit is required';
      missingList.push({
        field: 'Order Items / Materials',
        message: 'Please add at least one material/product item or select a preset kit.',
        targetId: 'prod-field-bomMaterialsList'
      });
    } else {
      const invalidItems = [];
      bomMaterialsList.forEach((it, idx) => {
        const qty = parseFloat(it.qty) || 0;
        if (!it.name || !it.name.trim()) {
          invalidItems.push(`Item #${idx + 1}: Name is missing`);
        } else if (qty <= 0) {
          invalidItems.push(`Item #${idx + 1} (${it.name}): Quantity must be > 0`);
        }
      });
      if (invalidItems.length > 0) {
        errors.items = invalidItems.join(', ');
        missingList.push({
          field: 'Item Details Missing',
          message: invalidItems.join(' • '),
          targetId: 'prod-field-bomMaterialsList'
        });
      }
    }

    if (!sameAsBilling) {
      const street = (newBomDeliveryStreet || '').trim();
      const city = (newBomDeliveryCity || '').trim();
      if (!street || !city) {
        errors.deliveryAddress = 'Delivery Address and City are required';
        missingList.push({
          field: 'Delivery Address',
          message: 'Delivery street and city are required when different from billing.',
          targetId: 'prod-field-newBomDeliveryStreet'
        });
      }
    }

    const isPaymentProofRequired = (
      newBomPaymentType === '100% Paid' ||
      newBomPaymentType === '100% Advance' ||
      newBomPaymentType === 'Partial Paid' ||
      newBomPaymentType === 'Partial Payment' ||
      String(newBomPaymentType || '').toLowerCase().includes('advance') ||
      String(newBomPaymentType || '').toLowerCase().includes('partial')
    );

    if (!isDraft && isPaymentProofRequired) {
      if (!newBomPaymentProofDoc) {
        errors.paymentProof = `Payment Attachment / Slip * is strictly mandatory for ${newBomPaymentType}`;
        missingList.push({
          field: 'Payment Attachment / Slip *',
          message: `Payment Attachment / Slip * is strictly mandatory for "${newBomPaymentType}". Please attach the bank transfer slip/receipt to proceed.`,
          targetId: 'prod-field-newBomPaymentProofDoc'
        });
      }
    }

    setBomFormErrors(errors);
    return { isValid: missingList.length === 0, missingList, errors };
  };
  const [newBomBillingStreet, setNewBomBillingStreet] = useState('');
  const [newBomBillingCity, setNewBomBillingCity] = useState('');
  const [newBomBillingState, setNewBomBillingState] = useState('');
  const [newBomBillingPincode, setNewBomBillingPincode] = useState('');
  const [newBomDeliveryAddress, setNewBomDeliveryAddress] = useState('');
  const [newBomDeliveryStreet, setNewBomDeliveryStreet] = useState('');
  const [newBomDeliveryCity, setNewBomDeliveryCity] = useState('');
  const [newBomDeliveryState, setNewBomDeliveryState] = useState('');
  const [newBomDeliveryPincode, setNewBomDeliveryPincode] = useState('');
  const [newBomPaymentType, setNewBomPaymentType] = useState('100% Paid');
  const [newBomCreditDays, setNewBomCreditDays] = useState(7);
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [newBomDeliveryProofDoc, setNewBomDeliveryProofDoc] = useState(null);
  const [newBomPaymentProofDoc, setNewBomPaymentProofDoc] = useState(null);
  const [newBomRemarks, setNewBomRemarks] = useState('');
  const [newBomTransportMode, setNewBomTransportMode] = useState('Transport');
  const [newBomTransporterName, setNewBomTransporterName] = useState('');
  const [newBomVehicleNo, setNewBomVehicleNo] = useState('');
  const [newBomLrNo, setNewBomLrNo] = useState('');
  const [newBomGstRate, setNewBomGstRate] = useState('18%');
  const [activePresetsMap, setActivePresetsMap] = useState(() => getAllActivePresets());
  const [selectedPreset, setSelectedPreset] = useState('');
  const [presetSetCount, setPresetSetCount] = useState(1);
  const [presetKitPrice, setPresetKitPrice] = useState('');
  const [previewDocModal, setPreviewDocModal] = useState(null); // { title, doc }

  // DocPreviewModal extracted to ./DocPreviewModal.jsx
  const [selectedBomItemIndexes, setSelectedBomItemIndexes] = useState([]);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [bomConfirmModal, setBomConfirmModal] = useState(null); // { type: 'cancel' | 'draft' | 'create' }
  const [reuploadAddressProofModal, setReuploadAddressProofModal] = useState(null); // BOM object requiring address proof re-upload
  const [reuploadProofFile, setReuploadProofFile] = useState(null);
  const [updatePaymentModal, setUpdatePaymentModal] = useState(null); // BOM object for updating payment (Partial/Credit)
  const [updatePaymentFile, setUpdatePaymentFile] = useState(null);
  const [updatePaymentNotes, setUpdatePaymentNotes] = useState('');

  // Real-time synchronization for custom presets created by Tech Support
  useEffect(() => {
    const handlePresetUpdate = (e) => {
      if (e.detail) {
        setActivePresetsMap(e.detail);
      }
    };
    window.addEventListener('vrm_presets_updated', handlePresetUpdate);
    return () => window.removeEventListener('vrm_presets_updated', handlePresetUpdate);
  }, []);



  // Vehicle Loading & Final Dispatch State
  const [vehicleLoadingModal, setVehicleLoadingModal] = useState(null); // BOM object undergoing vehicle loading
  const [vehicleLoadingData, setVehicleLoadingData] = useState({
    vehicleNo: '',
    driverName: '',
    driverPhone: '',
    transporter: '',
    lrNo: '',
    sealNo: '',
    ewayBillNo: '',
    loadingNotes: ''
  });
  const [loadingPhotos, setLoadingPhotos] = useState([]); // [{ id, name, size, dataUrl, capturedAt }]
  const [loadingVideos, setLoadingVideos] = useState([]); // [{ id, name, size, dataUrl, recordedAt }]
  const [loadingMediaMode, setLoadingMediaMode] = useState('photo'); // 'photo' | 'video' | 'camera'
  const [isRecordingLoadingVideo, setIsRecordingLoadingVideo] = useState(false);
  const [loadingCameraActive, setLoadingCameraActive] = useState(false);
  const [activeMediaPreviewModal, setActiveMediaPreviewModal] = useState(null); // { type: 'image' | 'video', url, name }
  const [dispatchChecklistPreviewModal, setDispatchChecklistPreviewModal] = useState(null); // { bomCode, customerName, packedBy, packedItems, allCount, packedCount }
  const [completedBomSummaryModal, setCompletedBomSummaryModal] = useState(null); // Completed BOM object

  const [customAlert, setCustomAlert] = useState(null);

  const showCustomAlert = (msg, title = null, type = null, details = null, targetFieldId = null) => {
    const payload = typeof msg === 'object' && msg !== null && !Array.isArray(msg) && msg.message !== undefined
      ? msg
      : { message: msg, title, type, details, targetFieldId };

    let detectedType = payload.type;
    let detectedTitle = payload.title;
    const strMsg = String(payload.message || '');

    if (!detectedType) {
      if (strMsg.includes('❌') || strMsg.toLowerCase().includes('wrong') || strMsg.toLowerCase().includes('error') || strMsg.toLowerCase().includes('fail') || strMsg.toLowerCase().includes('invalid') || strMsg.toLowerCase().includes('unable') || strMsg.toLowerCase().includes('cannot')) {
        detectedType = 'error';
        if (!detectedTitle) detectedTitle = 'Uh oh! Something went wrong';
      } else if (strMsg.includes('⚠️') || strMsg.toLowerCase().includes('warning') || strMsg.toLowerCase().includes('mandatory') || strMsg.toLowerCase().includes('differs') || strMsg.toLowerCase().includes('please') || (payload.details && payload.details.length > 0)) {
        detectedType = 'warning';
        if (!detectedTitle) detectedTitle = 'Attention Required';
      } else if (strMsg.includes('✅') || strMsg.toLowerCase().includes('success') || strMsg.toLowerCase().includes('approved') || strMsg.toLowerCase().includes('verified') || strMsg.toLowerCase().includes('completed')) {
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
      message: cleanMsg || (detectedType === 'error' ? 'We apologize for the inconvenience you experienced.' : 'Action completed.'),
      type: detectedType || 'info',
      details: payload.details || null,
      targetFieldId: payload.targetFieldId || null
    });
  };

  // Shadow window.alert within OtherViews to always render the custom branded popup
  const alert = (msg, title, type) => showCustomAlert(msg, title, type);

  const [bomMaterialsList, setBomMaterialsList] = useState([]);

  const [bomRoutingSteps, setBomRoutingSteps] = useState([
    { stepNo: 1, opName: 'Uncoiling & Cut to Length', machine: 'CNC Cutting Machine', cycleTime: '3.5 sec', setupTime: '10 mins', skill: 'Skilled Operator' },
    { stepNo: 2, opName: 'Precision Slot Punching', machine: 'Punching Machine #1', cycleTime: '4.0 sec', setupTime: '15 mins', skill: 'Skilled Operator' },
    { stepNo: 3, opName: 'Quality Inspection & Deburring', machine: 'QC Station #1', cycleTime: '2.0 sec', setupTime: '5 mins', skill: 'QC Inspector' },
    { stepNo: 4, opName: 'Final Stacking & Packing', machine: 'Packing Bench', cycleTime: '5.0 sec', setupTime: '5 mins', skill: 'Assembly Worker' }
  ]);

  // Reset sub-form view state whenever switching main tabs/side menu items
  useEffect(() => {
    setShowBOMForm(false);
    setShowWorkOrderForm(false);
    setShowCustomerForm(false);
    setViewingCustomer(null);
    setEditingCustomer(null);
  }, [activeTab]);

  // Add Stock & Table Support States
  const [showAddStockForm, setShowAddStockForm] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Table Selection & Pagination System
  const handleSelectAllGeneric = (e, items, keyField) => {
    if (e.target.checked) {
      setSelectedRows(items.map(item => item[keyField]));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRowGeneric = (val) => {
    setSelectedRows(prev =>
      prev.includes(val) ? prev.filter(item => item !== val) : [...prev, val]
    );
  };

  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [printTaxInvoiceModal, setPrintTaxInvoiceModal] = useState(null);

    // Invoice State
  const [viewingInvoiceModal, setViewingInvoiceModal] = useState(null);
  const [invoiceModalActiveTab, setInvoiceModalActiveTab] = useState('Invoice Items');
  const [isEditingInvoice, setIsEditingInvoice] = useState(false);
  const [invoiceEditForm, setInvoiceEditForm] = useState({
    invNo: '',
    date: '',
    vendor: '',
    billingAddress: '',
    deliveryAddress: '',
    paymentType: '',
    items: []
  });
  const [closeInvoiceReasonModal, setCloseInvoiceReasonModal] = useState(null);
  const [closeReasonText, setCloseReasonText] = useState('');
  const [pendingDcModal, setPendingDcModal] = useState(null);
  const [confirmInvoiceSuccessModal, setConfirmInvoiceSuccessModal] = useState(null);
  const deduplicateInvoices = (list) => {
    if (!Array.isArray(list) || list.length === 0) return [];

    const isMatch = (a, b) => {
      if (!a || !b) return false;
      if (a.id && b.id && a.id === b.id) return true;
      const aInv = (a.invNo || a.invoiceNo || a.code || '').toUpperCase().trim();
      const bInv = (b.invNo || b.invoiceNo || b.code || '').toUpperCase().trim();
      const aHasReal = aInv && aInv !== 'PENDING CONFIRMATION' && !aInv.includes('PENDING');
      const bHasReal = bInv && bInv !== 'PENDING CONFIRMATION' && !bInv.includes('PENDING');
      if (aHasReal && bHasReal && (aInv === bInv || aInv.replace(/[^A-Z0-9]/g, '') === bInv.replace(/[^A-Z0-9]/g, ''))) return true;

      const aBom = (a.bomCode || a.poNo || '').toUpperCase().trim();
      const bBom = (b.bomCode || b.poNo || '').toUpperCase().trim();
      if (aBom && bBom && (aBom === bBom || aBom.replace(/[^A-Z0-9]/g, '') === bBom.replace(/[^A-Z0-9]/g, ''))) return true;

      return false;
    };

    const result = [];
    list.forEach(item => {
      if (!item) return;
      const existingIdx = result.findIndex(ex => isMatch(ex, item));
      if (existingIdx === -1) {
        result.push(item);
      } else {
        const existing = result[existingIdx];
        const isCurrConf = item.status === 'Invoice Confirmed' || item.pay === 'Completed & Locked';
        const isExistConf = existing.status === 'Invoice Confirmed' || existing.pay === 'Completed & Locked';
        const itemInv = (item.invNo || item.invoiceNo || item.code || '').trim();
        const existInv = (existing.invNo || existing.invoiceNo || existing.code || '').trim();
        const itemHasReal = itemInv && itemInv !== 'Pending Confirmation' && !itemInv.toLowerCase().includes('pending');
        const existHasReal = existInv && existInv !== 'Pending Confirmation' && !existInv.toLowerCase().includes('pending');

        let master, secondary;
        if (isCurrConf && !isExistConf) {
          master = item; secondary = existing;
        } else if (!isCurrConf && isExistConf) {
          master = existing; secondary = item;
        } else if (itemHasReal && !existHasReal) {
          master = item; secondary = existing;
        } else {
          master = existing; secondary = item;
        }

        result[existingIdx] = {
          ...secondary,
          ...master,
          invNo: (master.invNo && master.invNo !== 'Pending Confirmation') ? master.invNo : (secondary.invNo || master.invNo),
          code: (master.code && master.code !== 'Pending Confirmation') ? master.code : (secondary.code || master.code),
          bomCode: master.bomCode || secondary.bomCode,
          poNo: master.poNo || secondary.poNo,
          items: (master.items && master.items.length > 0) ? master.items : (secondary.items || [])
        };
      }
    });

    const knownRefs = new Set();
    result.forEach(i => {
      const invNo = (i.invNo || i.invoiceNo || i.code || '').trim();
      const bRef = (i.bomCode || i.poNo || '').toUpperCase().trim();
      if (invNo && invNo !== 'Pending Confirmation' && !invNo.toLowerCase().includes('pending')) {
        if (bRef) knownRefs.add(bRef);
      }
    });

    return result.filter(i => {
      const invNo = (i.invNo || i.invoiceNo || i.code || '').trim();
      const isPending = !invNo || invNo === 'Pending Confirmation' || invNo.toLowerCase().includes('pending');
      const bRef = (i.bomCode || i.poNo || '').toUpperCase().trim();
      if (isPending && bRef && knownRefs.has(bRef)) {
        return false;
      }
      return true;
    });
  };

  const [invoiceList, setInvoiceList] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_invoice_store');
      const list = saved ? JSON.parse(saved) : [];
      return deduplicateInvoices(list);
    } catch (_) {
      return [];
    }
  });

  // Keep local convenience cache updated without cloud egress
  useEffect(() => {
    if (invoiceList && invoiceList.length > 0) {
      try {
        localStorage.setItem('controlroom_invoice_store', JSON.stringify(invoiceList.map(stripDataUrlsFromRecord)));
      } catch (_) {}
    }
  }, [invoiceList]);

  // Initial cloud fetch for invoices & listen for local update events
  useEffect(() => {
    // Fetch live invoices from backend
    fetch('/api/invoices')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          setInvoiceList(prev => deduplicateInvoices([...data, ...(prev || [])]));
        }
      })
      .catch(() => {});

    fetchCloudStore('invoice_store', []).then(data => {
      if (data && Array.isArray(data) && data.length > 0) {
        setInvoiceList(prev => deduplicateInvoices([...data, ...(prev || [])]));
      }
    });
    const sub = subscribeToCloudStore('invoice_store', (latest) => {
      if (latest && Array.isArray(latest)) {
        if (latest.length > 0) setInvoiceList(prev => deduplicateInvoices([...latest, ...(prev || [])]));
      } else if (latest && typeof latest === 'object' && !Array.isArray(latest)) {
        if (latest._deleted && latest.id) {
          setInvoiceList(prev => (prev || []).filter(i => i.id !== latest.id && i.invNo !== latest.id));
        } else {
          setInvoiceList(prev => {
            const id = latest.id || latest.invNo;
            const idx = (prev || []).findIndex(i => (i.id && i.id === id) || (i.invNo && i.invNo === id));
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...latest };
              return deduplicateInvoices(copy);
            }
            return deduplicateInvoices([latest, ...(prev || [])]);
          });
        }
      }
    });

    const handleInvoiceSync = (e) => {
      const newInv = e.detail?.invoice;
      if (newInv) {
        setInvoiceList(prev => {
          const filtered = (prev || []).filter(i => i.invNo !== newInv.invNo && i.poNo !== newInv.poNo);
          return [newInv, ...filtered];
        });
      }
    };
    window.addEventListener('controlroom_invoice_store_updated', handleInvoiceSync);

    return () => {
      if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
      window.removeEventListener('controlroom_invoice_store_updated', handleInvoiceSync);
    };
  }, []);

  // 1-Hour SLA Auto-Cancellation Monitor for Invoices awaiting Address Proof Reissue
  useEffect(() => {
    const checkExpiredInvoiceReissues = () => {
      const ONE_HOUR_MS = 60 * 60 * 1000;
      const now = Date.now();
      const cancelMsg = 'Invoice Cancelled because of the Address Proof is missing are Mismatch';
      let hasCancellations = false;

      setInvoiceList(prev => {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        let modified = false;
        const updated = prev.map(inv => {
          if (['Invoice Confirmed', 'CLOSED', 'Completed', 'Confirmed', 'Fully Dispatched & Delivered', 'Cancelled'].includes(inv.status)) {
            return inv;
          }
          const isPending = Boolean(
            inv.addressProofReuploadRequested ||
            inv.status === 'Address Proof Reissue Requested'
          );
          const reqAt = inv.addressProofReuploadRequestedAt || inv.reissueRequestedAt;
          if (isPending && reqAt && (now - new Date(reqAt).getTime() >= ONE_HOUR_MS)) {
            hasCancellations = true;
            modified = true;
            return {
              ...inv,
              status: 'Cancelled',
              pay: 'Cancelled',
              cancellationReason: cancelMsg,
              cancelledAt: new Date().toISOString(),
              addressProofReuploadRequested: false
            };
          }
          return inv;
        });
        return modified ? updated : prev;
      });

      if (hasCancellations) {
        try {
          addLiveNotification({
            title: 'Invoice Cancelled',
            message: cancelMsg,
            type: 'alert'
          });
          window.dispatchEvent(new Event('controlroom_storage_update'));
        } catch (_) {}
      }
    };

    const interval = setInterval(checkExpiredInvoiceReissues, 30000);
    checkExpiredInvoiceReissues();
    return () => clearInterval(interval);
  }, []);


    return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {(![
        'Goods Receipt Note', 'Goods Receipt Note (GRN)', 'Vendor Management', 'Vendor Performance', 'Material Reorder',
        'Stock Status', 'Price Comparison', 'Items Directory', 'Payments',
        'Spend Analytics', 'Procurement Reports', 'Spend Reports', 'Supplier Reports',
        'Procurement Settings', 'Approval Workflows', 'Dispatch Dashboard'
      ].includes(activeTab) || ['Work Orders', 'Planning & Scheduling', 'Production Monitoring',
        'Quality Control', 'Machine Maintenance', 'Inventory', 'BOM / Routing', 'BOM', 'Customer Management',
        'Production Reports', 'Efficiency Reports', 'Downtime Analytics',
        'Add Work Order', 'Record Production', 'Report Downtime', 'Dispatch Orders', 'Accounts Verification', 'Invoice Management', 'Delivery Challans'
      ].includes(activeTab)) && activeTab !== 'Dispatch Dashboard' && (() => {
        try {
          // If viewing an individual Invoice in full screen
          if (activeTab === 'Invoice Management' && viewingInvoiceModal) {
            return (
              <InvoiceDetailModal
                viewingInvoiceModal={viewingInvoiceModal}
                setViewingInvoiceModal={setViewingInvoiceModal}
                isEditingInvoice={isEditingInvoice}
                setIsEditingInvoice={setIsEditingInvoice}
                invoiceEditForm={invoiceEditForm}
                setInvoiceEditForm={setInvoiceEditForm}
                invoiceModalActiveTab={invoiceModalActiveTab}
                setInvoiceModalActiveTab={setInvoiceModalActiveTab}
                bomStore={bomStore}
                setBomStore={setBomStore}
                invoices={invoiceList}
                setInvoices={setInvoiceList}
                invoiceList={invoiceList}
                setInvoiceList={setInvoiceList}
                setPrintTaxInvoiceModal={setPrintTaxInvoiceModal}
                setPreviewDocModal={setPreviewDocModal}
                setActiveMediaPreviewModal={setActiveMediaPreviewModal}
                setPendingDcModal={setPendingDcModal}
                showCustomAlert={showCustomAlert}
              />
            );
          }

          const configs = buildProductionConfigs({ bomStore, visibleBomStore, invoiceList, customerList });

          // RawMaterialInventoryView extracted to ./RawMaterialInventoryView.jsx

          // Dedicated Custom Renderer for Inventory & Raw Material Directory matching User UI Design
          if (activeTab === 'Raw Material Directory' || activeTab === 'Inventory (Raw Material)' || activeTab === 'Inventory' || (activeTab && activeTab.toLowerCase().includes('inventory')) || (activeTab && activeTab.toLowerCase().includes('raw material'))) {
            return (
              <RawMaterialInventoryView
                showAddStockForm={showAddStockForm}
                setShowAddStockForm={setShowAddStockForm}
                userRole={userRole}
                activeTab={activeTab}
                itemsLoading={itemsLoading}
                showCustomAlert={showCustomAlert}
                itemsList={props.itemsList || []}
              />
            );
          }

          // Restrict Delivery Challans for Accounts and Dispatch roles
          const isDispatchRole = userRole === 'Dispatch Head' || userRole === 'Dispatch' || userRole === 'Dispatch Executive' || String(userRole || '').toLowerCase().includes('dispatch');
          if (activeTab === 'Delivery Challans' && (userRole === 'Accounts Head' || userRole === 'Accounts Executive' || userRole === 'Finance & Accounts' || isDispatchRole)) {
            return (
              <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', marginTop: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '8px' }}>Access Restricted</h3>
                <p style={{ fontSize: '13px', color: '#64748B' }}>Delivery Challans are not available for your role.</p>
              </div>
            );
          }

          // Dedicated Custom Renderer for Work Orders matching User Reference Screenshot
          if (activeTab === 'Work Orders') {
            if (showWorkOrderForm) {
              return (
                <CreateWorkOrderPage
                  onBack={() => setShowWorkOrderForm(false)}
                  onWorkOrderCreated={(newWO) => {
                    setShowWorkOrderForm(false);
                    showCustomAlert(`Work Order ${newWO?.id || ''} created & issued successfully! Raw Material Required: ${newWO?.rawMaterialPhysicalToIssue || ''} ${newWO?.rawMaterialUnit || ''}`, `Work Order ${newWO?.id || ''} Issued Successfully!`, 'success');
                  }}
                />
              );
            }

            return (
              <WorkOrdersView
                userRole={userRole}
                setShowWorkOrderForm={setShowWorkOrderForm}
                prodSearchQueryText={prodSearchQueryText}
                setProdSearchQueryText={setProdSearchQueryText}
                prodStatusFilterText={prodStatusFilterText}
                setProdStatusFilterText={setProdStatusFilterText}
              />
            );
          }

          // Render Send Confirm (Editable Mode) or View BOM Details (100% Read-Only Mode)
          if (confirmingBomModal) {
            return (
              <ConfirmingBomModal
                confirmingBomModal={confirmingBomModal}
                setConfirmingBomModal={setConfirmingBomModal}
                setBomStore={setBomStore}
                setActiveMediaPreviewModal={setActiveMediaPreviewModal}
              />
            );
          }

          // Render Dispatch Head Packing Verification Screen (Full Size Page)
          if (dispatchPackingModal) {
            return (
              <DispatchPackingModal
                dispatchPackingModal={dispatchPackingModal}
                setDispatchPackingModal={setDispatchPackingModal}
                bomStore={bomStore}
                setBomStore={setBomStore}
                setInvoiceList={setInvoiceList}
                canCancelBom={canCancelBom}
                handleCancelBomOrder={handleCancelBomOrder}
                setActiveMediaPreviewModal={setActiveMediaPreviewModal}
                setVehicleLoadingModal={setVehicleLoadingModal}
              />
            );
          }

          // Render Vehicle Loading Verification Screen (Full Size Page like DispatchPackingModal)
          if (vehicleLoadingModal) {
            return (
              <VehicleLoadingModal
                vehicleLoadingModal={vehicleLoadingModal}
                onClose={() => setVehicleLoadingModal(null)}
                setBomStore={setBomStore}
                setCompletedBomSummaryModal={setCompletedBomSummaryModal}
                setActiveMediaPreviewModal={setActiveMediaPreviewModal}
                setInvoiceList={setInvoiceList}
              />
            );
          }

          // Render Accounts Team Payment & Document Verification Screen (Full Size Page)
          if (accountsVerificationModal) {
            return (
              <AccountsVerificationModal
                accountsVerificationModal={accountsVerificationModal}
                setAccountsVerificationModal={setAccountsVerificationModal}
                isAccountsViewOnly={isAccountsViewOnly}
                setIsAccountsViewOnly={setIsAccountsViewOnly}
                bomStore={bomStore}
                setBomStore={setBomStore}
                userRole={userRole}
                setPreviewDocModal={setPreviewDocModal}
                canCancelBom={canCancelBom}
                handleCancelBomOrder={handleCancelBomOrder}
                invoiceList={invoiceList}
                setInvoiceList={setInvoiceList}
                showCustomAlert={showCustomAlert}
              />
            );
          }

          // Render Delete Confirmation Modal for Customer
          if (customerToDelete) {
            return (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, fontFamily: "'DM Sans', sans-serif" }}>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '28px', maxWidth: '440px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 style={{ width: '20px', height: '20px' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Delete Customer</h3>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>This action cannot be undone.</span>
                    </div>
                  </div>

                  <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.5', margin: '0 0 24px 0' }}>
                    Are you sure you want to delete customer <strong>"{customerToDelete.code}"</strong> from Customer Management directory?
                  </p>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setCustomerToDelete(null)}
                      style={{ border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', height: '38px', padding: '0 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setCustomerList(prev => prev.filter(c => c.code !== customerToDelete.code));
                        setCustomerToDelete(null);
                      }}
                      style={{ border: 'none', backgroundColor: '#DC2626', color: 'white', height: '38px', padding: '0 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Yes, Delete Customer
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // Render Customer Profile View (when viewingCustomer is set)
          if (viewingCustomer) {
            return (
              <CustomerProfileView
                viewingCustomer={viewingCustomer}
                setViewingCustomer={setViewingCustomer}
                setEditingCustomer={setEditingCustomer}
                setShowCustomerForm={setShowCustomerForm}
                setCustFormName={setCustFormName}
                setCustFormCompany={setCustFormCompany}
                setCustFormGstNo={setCustFormGstNo}
                setCustFormMobile={setCustFormMobile}
                setCustFormEmail={setCustFormEmail}
                setCustFormBillingAddress={setCustFormBillingAddress}
                setCustFormBillingCity={setCustFormBillingCity}
                setCustFormBillingState={setCustFormBillingState}
                setCustFormBillingPincode={setCustFormBillingPincode}
                setCustFormDeliveryAddress={setCustFormDeliveryAddress}
                setCustFormDeliveryCity={setCustFormDeliveryCity}
                setCustFormDeliveryState={setCustFormDeliveryState}
                setCustFormDeliveryPincode={setCustFormDeliveryPincode}
                setCustFormSameAsBilling={setCustFormSameAsBilling}
              />
            );
          }

          // Render Create/Edit Customer Form if active or open
          if (showCustomerForm || editingCustomer) {
            return (
              <CustomerFormView
                showCustomerForm={showCustomerForm}
                setShowCustomerForm={setShowCustomerForm}
                editingCustomer={editingCustomer}
                setEditingCustomer={setEditingCustomer}
                custFormName={custFormName}
                setCustFormName={setCustFormName}
                custFormCompany={custFormCompany}
                setCustFormCompany={setCustFormCompany}
                custFormGstNo={custFormGstNo}
                setCustFormGstNo={setCustFormGstNo}
                custFormMobile={custFormMobile}
                setCustFormMobile={setCustFormMobile}
                custFormEmail={custFormEmail}
                setCustFormEmail={setCustFormEmail}
                custFormBillingAddress={custFormBillingAddress}
                setCustFormBillingAddress={setCustFormBillingAddress}
                custFormBillingCity={custFormBillingCity}
                setCustFormBillingCity={setCustFormBillingCity}
                custFormBillingState={custFormBillingState}
                setCustFormBillingState={setCustFormBillingState}
                custFormBillingPincode={custFormBillingPincode}
                setCustFormBillingPincode={setCustFormBillingPincode}
                custFormDeliveryAddress={custFormDeliveryAddress}
                setCustFormDeliveryAddress={setCustFormDeliveryAddress}
                custFormDeliveryCity={custFormDeliveryCity}
                setCustFormDeliveryCity={setCustFormDeliveryCity}
                custFormDeliveryState={custFormDeliveryState}
                setCustFormDeliveryState={setCustFormDeliveryState}
                custFormDeliveryPincode={custFormDeliveryPincode}
                setCustFormDeliveryPincode={setCustFormDeliveryPincode}
                custFormSameAsBilling={custFormSameAsBilling}
                setCustFormSameAsBilling={setCustFormSameAsBilling}
                customerList={customerList}
                setCustomerList={setCustomerList}
                setNewBomCustomer={setNewBomCustomer}
                setNewBomProductName={setNewBomProductName}
                setNewBomDeliveryAddress={setNewBomDeliveryAddress}
                setSameAsBilling={setSameAsBilling}
              />
            );
          }

          // Render Create BOM Form matching exact user reference screenshot design system
          if (showBOMForm) {
            return (
              <CreateBomFormPage
                showBOMForm={showBOMForm}
                setShowBOMForm={setShowBOMForm}
                setShowCustomerForm={setShowCustomerForm}
                customerList={customerList}
                itemsList={props.itemsList || []}
                setBomStore={setBomStore}
                newBomCode={newBomCode}
                setNewBomCode={setNewBomCode}
                newBomDeliveryDate={newBomDeliveryDate}
                setNewBomDeliveryDate={setNewBomDeliveryDate}
                newBomProductName={newBomProductName}
                setNewBomProductName={setNewBomProductName}
                bomFormErrors={bomFormErrors}
                setBomFormErrors={setBomFormErrors}
                newBomBillingStreet={newBomBillingStreet}
                setNewBomBillingStreet={setNewBomBillingStreet}
                newBomBillingCity={newBomBillingCity}
                setNewBomBillingCity={setNewBomBillingCity}
                newBomBillingState={newBomBillingState}
                setNewBomBillingState={setNewBomBillingState}
                newBomBillingPincode={newBomBillingPincode}
                setNewBomBillingPincode={setNewBomBillingPincode}
                newBomDeliveryAddress={newBomDeliveryAddress}
                newBomDeliveryStreet={newBomDeliveryStreet}
                setNewBomDeliveryStreet={setNewBomDeliveryStreet}
                newBomDeliveryCity={newBomDeliveryCity}
                setNewBomDeliveryCity={setNewBomDeliveryCity}
                newBomDeliveryState={newBomDeliveryState}
                setNewBomDeliveryState={setNewBomDeliveryState}
                newBomDeliveryPincode={newBomDeliveryPincode}
                setNewBomDeliveryPincode={setNewBomDeliveryPincode}
                newBomPaymentType={newBomPaymentType}
                setNewBomPaymentType={setNewBomPaymentType}
                newBomCreditDays={newBomCreditDays}
                setNewBomCreditDays={setNewBomCreditDays}
                sameAsBilling={sameAsBilling}
                setSameAsBilling={setSameAsBilling}
                newBomDeliveryProofDoc={newBomDeliveryProofDoc}
                setNewBomDeliveryProofDoc={setNewBomDeliveryProofDoc}
                newBomPaymentProofDoc={newBomPaymentProofDoc}
                setNewBomPaymentProofDoc={setNewBomPaymentProofDoc}
                newBomRemarks={newBomRemarks}
                setNewBomRemarks={setNewBomRemarks}
                newBomTransportMode={newBomTransportMode}
                setNewBomTransportMode={setNewBomTransportMode}
                newBomTransporterName={newBomTransporterName}
                setNewBomTransporterName={setNewBomTransporterName}
                newBomVehicleNo={newBomVehicleNo}
                setNewBomVehicleNo={setNewBomVehicleNo}
                newBomLrNo={newBomLrNo}
                setNewBomLrNo={setNewBomLrNo}
                newBomGstRate={newBomGstRate}
                setNewBomGstRate={setNewBomGstRate}
                activePresetsMap={activePresetsMap}
                selectedPreset={selectedPreset}
                setSelectedPreset={setSelectedPreset}
                presetSetCount={presetSetCount}
                setPresetSetCount={setPresetSetCount}
                presetKitPrice={presetKitPrice}
                setPresetKitPrice={setPresetKitPrice}
                setPreviewDocModal={setPreviewDocModal}
                selectedBomItemIndexes={selectedBomItemIndexes}
                setSelectedBomItemIndexes={setSelectedBomItemIndexes}
                showClearConfirmModal={showClearConfirmModal}
                setShowClearConfirmModal={setShowClearConfirmModal}
                bomConfirmModal={bomConfirmModal}
                setBomConfirmModal={setBomConfirmModal}
                showCustomAlert={showCustomAlert}
              />
            );
          }

          // Render Create / View Delivery Challan Page matching PO & PI design inline (sidebar visible)
          if (pendingDcModal) {
            return (
              <DeliveryChallanModal
                pendingDcModal={pendingDcModal}
                onClose={() => setPendingDcModal(null)}
                bomStore={bomStore}
                setBomStore={setBomStore}
                invoiceList={invoiceList}
                setInvoiceList={setInvoiceList}
                userRole={userRole}
              />
            );
          }

          // Generic Renderer for other Production views
          const defaultConfig = {
            title: activeTab,
            subtitle: `Management and control for ${activeTab}`,
            actionText: `+ Create ${activeTab.replace(/s$/, '')}`,
            searchPlaceholder: `Search ${activeTab}...`,
            tabs: [
              { id: 'All', label: 'All Entries', count: (bomStore || []).length, bg: '#e2e8f0', fg: '#475569' }
            ],
            headers: ['Reference Code', 'Customer / Item', 'Details', 'Date', 'Value', 'Status', 'Action'],
            rows: (bomStore || []).map(b => {
              let dispStatus = b.status || 'ACTIVE';
              if (activeTab === 'Dispatch Orders') {
                if (['Sent to Production', 'Confirmed', 'In Production', 'Pending Confirmation', 'Draft', 'Pending', 'Edited / Pending Confirmation'].includes(b.status) || !b.status) {
                  dispStatus = 'Pending Packing';
                }
              }
              const rowObj = {
                ...b,
                code: b.bomCode || 'REF-001',
                c2: b.customerName || 'Customer',
                c3: b.paymentType || '-',
                c4: b.date || '2026-08-17',
                c5: `₹ ${parseFloat(b.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                status: dispStatus,
                stBg: dispStatus === 'Pending Packing' ? '#fff7ed' : '#eff6ff',
                stFg: dispStatus === 'Pending Packing' ? '#c2410c' : '#2563eb',
                stBorder: dispStatus === 'Pending Packing' ? '1px solid #fed7aa' : '1px solid #bfdbfe',
                tabGroup: 'All'
              };
              delete rowObj.c6;
              return rowObj;
            })
          };

          const pageConfig = configs[activeTab] || defaultConfig;

          const filteredRows = (pageConfig.rows || []).filter(r => {
            const matchesSearch = !prodSearchQueryText ||
              (r.code && r.code.toLowerCase().includes(prodSearchQueryText.toLowerCase())) ||
              (r.c2 && r.c2.toLowerCase().includes(prodSearchQueryText.toLowerCase())) ||
              (r.c3 && r.c3.toLowerCase().includes(prodSearchQueryText.toLowerCase())) ||
              (r.customerName && r.customerName.toLowerCase().includes(prodSearchQueryText.toLowerCase()));

            // Date range filter matching
            let matchesDate = true;
            const rDateStr = r.date || r.createdAt || r.bomDate || (r.c4 && /^\d{4}-\d{2}-\d{2}/.test(r.c4) ? r.c4 : null);
            if (rDateStr && (prodFilterDateVal || prodFilterEndDateVal)) {
              const rIso = String(rDateStr).substring(0, 10);
              if (prodFilterDateVal && rIso < prodFilterDateVal) matchesDate = false;
              if (prodFilterEndDateVal && rIso > prodFilterEndDateVal) matchesDate = false;
            }

            const subTab = (prodActiveSubTab || 'All').toLowerCase();
            const rStatus = (r.status || '').toLowerCase();
            const rTabGroup = (r.tabGroup || '').toLowerCase();

            const cleanSub = subTab.replace(/[^a-z0-9]/g, '');
            const cleanStatus = rStatus.replace(/[^a-z0-9]/g, '');
            const cleanGroup = rTabGroup.replace(/[^a-z0-9]/g, '');

            const matchesTab = cleanSub === 'all' ||
              cleanSub === 'allboms' ||
              cleanSub === 'allorders' ||
              cleanSub === 'allaccountsorders' ||
              cleanGroup === cleanSub ||
              rTabGroup === subTab ||
              (cleanSub.includes('pending') && (cleanStatus.includes('pending') || cleanGroup.includes('pending') || cleanStatus.includes('draft'))) ||
              (cleanSub.includes('partially') && (cleanStatus.includes('partial') || cleanGroup.includes('partial'))) ||
              (cleanSub.includes('packed') && (cleanStatus.includes('packed') || cleanGroup.includes('packed') || cleanStatus.includes('verified'))) ||
              (cleanSub.includes('loading') && (cleanStatus.includes('loading') || cleanGroup.includes('loading'))) ||
              (cleanSub.includes('lr') && (cleanStatus.includes('lr') || cleanGroup.includes('lr'))) ||
              ((cleanSub.includes('closed') || cleanSub.includes('dispatched')) && (cleanStatus.includes('closed') || cleanStatus.includes('dispatched') || cleanStatus.includes('completed') || cleanGroup.includes('closed') || r.fullyCompleted)) ||
              (cleanSub.includes('cancel') && (cleanStatus.includes('cancel') || cleanGroup.includes('cancel') || r.cancelled)) ||
              (cleanSub.includes('draft') && cleanStatus.includes('draft')) ||
              (cleanSub.includes('sent') && (cleanStatus.includes('sent') || cleanStatus.includes('confirm') || cleanStatus.includes('production')));

            return matchesSearch && matchesDate && matchesTab;
          });

          return (
            <ProductionTableView
              pageConfig={pageConfig}
              activeTab={activeTab}
              userRole={userRole}
              onPrintTaxInvoice={(row) => setPrintTaxInvoiceModal(row)}
              filteredRows={filteredRows}
              selectedRows={selectedRows}
              setSelectedRows={setSelectedRows}
              handleSelectAllGeneric={handleSelectAllGeneric}
              handleSelectRowGeneric={handleSelectRowGeneric}
              prodSearchQueryText={prodSearchQueryText}
              setProdSearchQueryText={setProdSearchQueryText}
              prodFilterDateVal={prodFilterDateVal}
              setProdFilterDateVal={setProdFilterDateVal}
              prodFilterEndDateVal={prodFilterEndDateVal}
              setProdFilterEndDateVal={setProdFilterEndDateVal}
              prodFilterStatusSelect={prodFilterStatusSelect}
              setProdFilterStatusSelect={setProdFilterStatusSelect}
              prodActiveSubTab={prodActiveSubTab}
              setProdActiveSubTab={setProdActiveSubTab}
              rowsPerPage={rowsPerPage}
              setRowsPerPage={setRowsPerPage}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              bomStore={bomStore}
              canCancelBom={canCancelBom}
              handleCancelBomOrder={handleCancelBomOrder}
              showAlert={(msg) => alert(msg)}
              onHeaderAction={() => {
                if (activeTab === 'BOM / Routing' || activeTab === 'BOM' || activeTab === 'BOM Orders' || pageConfig.title.includes('BOM')) {
                  setNewBomProductName('');
                  setNewBomSku('');
                  setNewBomRevision('');
                  setNewBomTargetQty('');
                  setBomMaterialsList([]);
                  setNewBomPaymentProofDoc(null);
                  setNewBomDeliveryProofDoc(null);
                  setNewBomRemarks('');
                  setSameAsBilling(false);
                  setNewBomDeliveryStreet('');
                  setNewBomDeliveryCity('');
                  setNewBomDeliveryState('');
                  setNewBomDeliveryPincode('');
                  setNewBomCode('');
                  setShowBOMForm(true);
                } else if (activeTab === 'Work Orders' || pageConfig.actionText.includes('Create Work Order')) {
                  setShowWorkOrderForm(true);
                } else if (activeTab === 'Customer Management' || pageConfig.title.includes('Customer')) {
                  setShowCustomerForm(true);
                } else if (activeTab === 'Delivery Challans' || pageConfig.title?.includes('Delivery Challan')) {
                  setPendingDcModal({ isNew: true });
                } else {
                  alert(`Action: ${pageConfig.actionText}`);
                }
              }}
              onRowClick={(row) => {
                if (activeTab === 'Invoice Management') {
                  setViewingInvoiceModal(row);
                  setIsEditingInvoice(false);
                } else if (activeTab === 'Delivery Challans') {
                  setPendingDcModal(row);
                } else if (activeTab === 'Dispatch Orders') {
                  setQuickPreviewRecord(row);
                } else if (activeTab === 'BOM' || activeTab === 'BOM Orders' || activeTab === 'BOM / Routing') {
                  const isDraftOrPending = ['Draft', 'Pending Confirmation', 'Edited / Pending Confirmation', 'Cancelled & Reissued to Dispatch', 'ACTIVE', 'Active', 'Pending Verification', 'Pending'].includes(row.status);
                  setConfirmingBomModal({ ...row, isEditMode: isDraftOrPending });
                } else {
                  setQuickPreviewRecord(row);
                }
              }}
              onEditRecord={(targetRow, isCancelledRow) => {
                if (activeTab === 'BOM' || activeTab === 'BOM Orders' || activeTab === 'BOM / Routing') {
                  setConfirmingBomModal(isCancelledRow ? { ...targetRow, isEditMode: false } : { ...targetRow, isEditMode: true });
                } else if (activeTab === 'Customer Management') {
                  setEditingCustomer({ ...targetRow, originalCode: targetRow.code });
                  setCustFormName(targetRow.code);
                  setCustFormCompany(targetRow.c2 || targetRow.code);
                  setCustFormGstNo(targetRow.gstNo || '33AABCU9603R1ZM');
                  setCustFormMobile(targetRow.c4 || '');
                  setCustFormEmail(targetRow.c5 || '');

                  const bObj = targetRow.billingAddressObj || {};
                  const dObj = targetRow.deliveryAddressObj || {};
                  setCustFormBillingAddress(bObj.address || targetRow.c6 || targetRow.billingAddress || '');
                  setCustFormBillingCity(bObj.city || '');
                  setCustFormBillingState(bObj.state || '');
                  setCustFormBillingPincode(bObj.pincode || '');

                  const isSame = (targetRow.deliveryAddress === targetRow.billingAddress && Boolean(targetRow.billingAddress)) || (!targetRow.c7 && !targetRow.deliveryAddress);
                  setCustFormSameAsBilling(isSame);
                  setCustFormDeliveryAddress(dObj.address || targetRow.c7 || targetRow.deliveryAddress || '');
                  setCustFormDeliveryCity(dObj.city || '');
                  setCustFormDeliveryState(dObj.state || '');
                  setCustFormDeliveryPincode(dObj.pincode || '');
                } else if (activeTab === 'Invoice Management') {
                  setViewingInvoiceModal(targetRow);
                  setInvoiceModalActiveTab('Invoice Items');
                  setIsEditingInvoice(false);
                  setInvoiceEditForm({
                    invNo: targetRow.invNo || targetRow.code || '',
                    customerName: targetRow.customerName || targetRow.vendor || 'Customer',
                    date: targetRow.date || new Date().toLocaleDateString('en-GB'),
                    paymentType: targetRow.paymentType || '100% Advance',
                    billingAddress: targetRow.billingAddress || 'Plot No 42, SIDCO Industrial Estate, Ambattur, Chennai, Tamil Nadu - 600058',
                    deliveryAddress: targetRow.deliveryAddress || targetRow.billingAddress || 'Plot No 42, SIDCO Industrial Estate, Ambattur, Chennai, Tamil Nadu - 600058',
                    items: (targetRow.items && targetRow.items.length > 0)
                      ? targetRow.items.map(it => ({ ...it }))
                      : [{ code: 'PRD-001', name: 'Standard Component', qty: 1, bomQty: 1, invQty: 1, rate: 1000, tax: 18, amt: 1180, selected: true }]
                  });
                } else if (activeTab === 'Dispatch Orders') {
                  const targetCode = targetRow.bomCode || targetRow.code || targetRow.id;
                  const originalBom = (bomStore || []).find(b => b && (b.bomCode === targetCode || b.code === targetCode || b.id === targetCode));
                  const fullBomToLoad = originalBom ? {
                    ...targetRow,
                    ...originalBom,
                    customerName: (originalBom.customerName && originalBom.customerName !== 'Teorainn Solar Pvt Ltd') ? originalBom.customerName : (targetRow.customerName || originalBom.customerName),
                    companyName: (originalBom.companyName && originalBom.companyName !== 'Teorainn Solar Pvt Ltd') ? originalBom.companyName : (targetRow.companyName || originalBom.companyName || originalBom.customerName),
                    dispatchPacking: (Array.isArray(originalBom.dispatchPacking) && originalBom.dispatchPacking.length > 0) ? originalBom.dispatchPacking : (targetRow.dispatchPacking || []),
                    status: (originalBom.status || targetRow.rawStatus || targetRow.status),
                    salesPerson: (originalBom.salesPerson || targetRow.salesPerson),
                    salesPersonCode: (originalBom.salesPersonCode || targetRow.salesPersonCode)
                  } : targetRow;

                  const isAccountsDone = Boolean(targetRow.isAccountsDone || targetRow.accountsVerification?.verified);
                  const isInvoiceDone = Boolean(targetRow.invoiceConfirmed || targetRow.status === 'Invoice Confirmed');
                  const isFullyPacked = Boolean(
                    targetRow.packingStatus === 'PACKING_VERIFIED' ||
                    targetRow.tabGroup === 'Packed' ||
                    (targetRow.status && targetRow.status.toLowerCase().includes('packed'))
                  );
                  const isAwaitingLoad = Boolean(
                    targetRow.tabGroup === 'AwaitingLoading' ||
                    ((targetRow.status === 'Awaiting Vehicle Loading & Dispatch' || targetRow.status === 'AWAITING VEHICLE LOADING') && isAccountsDone && isInvoiceDone) ||
                    (isFullyPacked && isAccountsDone && isInvoiceDone)
                  );
                  if (isCancelledRow) {
                    setDispatchPackingModal({ ...fullBomToLoad, isViewOnly: true, isReadOnly: true });
                  } else if (targetRow.tabGroup === 'Closed' || targetRow.status === 'Completed' || targetRow.status === 'COMPLETED & DISPATCHED') {
                    setVehicleLoadingModal({ ...fullBomToLoad, isReadOnly: true });
                  } else if (targetRow.tabGroup === 'AwaitingLrCopy' || targetRow.status === 'Dispatched - Awaiting LR Copy' || targetRow.status === 'AWAITING LR COPY' || targetRow.status === 'Awaiting LR Copy') {
                    setVehicleLoadingModal(fullBomToLoad);
                  } else if (isAwaitingLoad) {
                    setVehicleLoadingModal(fullBomToLoad);
                  } else {
                    setDispatchPackingModal(fullBomToLoad);
                  }
                } else if (activeTab === 'Delivery Challans') {
                  setPendingDcModal(targetRow);
                } else if (activeTab === 'Accounts Verification') {
                  setAccountsVerificationModal(targetRow);
                  setIsAccountsViewOnly(isCancelledRow ? true : false);
                } else {
                  setConfirmingBomModal(isCancelledRow ? { ...targetRow, isEditMode: false } : { ...targetRow, isEditMode: true });
                }
              }}
              onQuickPreview={(targetRow) => setQuickPreviewRecord(targetRow)}
              onUploadPayment={(targetRow) => setUploadPaymentModal(targetRow)}
            />
          );
        } catch (err) {
          console.error('Render error in section 14:', err);
          return (
            <div style={{ padding: '24px', backgroundColor: '#FEF2F2', borderRadius: '12px', border: '1px solid #FCA5A5', color: '#991B1B' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Error rendering view: {activeTab}</h3>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px' }}>{err?.message || 'An unexpected rendering error occurred.'}</p>
            </div>
          );
        }
      })()}



      {/* ─── QUICK PREVIEW DRAWER ─── */}
      {quickPreviewRecord && (
        <QuickPreviewDrawer
          quickPreviewRecord={quickPreviewRecord}
          onClose={() => setQuickPreviewRecord(null)}
          activeTab={activeTab}
          canCancelBom={canCancelBom}
          handleCancelBomOrder={handleCancelBomOrder}
          setActiveMediaPreviewModal={setActiveMediaPreviewModal}
          onViewFullDetails={(rec) => {
            if (activeTab === 'BOM' || activeTab === 'BOM Orders' || activeTab === 'BOM / Routing') {
              setConfirmingBomModal({ ...rec, isEditMode: true });
            } else if (activeTab === 'Customer Management') {
              setViewingCustomer(rec);
            } else if (activeTab === 'Invoice Management') {
              setViewingInvoiceModal(rec);
              setInvoiceModalActiveTab('Invoice Items');
            } else if (activeTab === 'Dispatch Orders') {
              const recCode = rec.bomCode || rec.code || rec.id;
              const origRec = (bomStore || []).find(b => b && (b.bomCode === recCode || b.code === recCode || b.id === recCode));
              const fullRec = origRec ? {
                ...rec,
                ...origRec,
                customerName: (origRec.customerName && origRec.customerName !== 'Teorainn Solar Pvt Ltd') ? origRec.customerName : (rec.customerName || origRec.customerName),
                companyName: (origRec.companyName && origRec.companyName !== 'Teorainn Solar Pvt Ltd') ? origRec.companyName : (rec.companyName || origRec.companyName || origRec.customerName),
                dispatchPacking: (Array.isArray(origRec.dispatchPacking) && origRec.dispatchPacking.length > 0) ? origRec.dispatchPacking : (rec.dispatchPacking || []),
                status: (origRec.status || rec.rawStatus || rec.status),
                salesPerson: (origRec.salesPerson || rec.salesPerson),
                salesPersonCode: (origRec.salesPersonCode || rec.salesPersonCode)
              } : rec;

              const isRecCancelled = Boolean(rec.cancelled || rec.status === 'CANCELLED' || rec.status === 'Cancelled' || rec.status === 'Cancelled & Stock Restored' || (typeof rec.status === 'string' && rec.status.toLowerCase().includes('cancel')));
              const isRecAccountsDone = Boolean(rec.isAccountsDone || rec.accountsVerification?.verified || fullRec.isAccountsDone || fullRec.accountsVerification?.verified);
              const isRecInvoiceDone = Boolean(rec.invoiceConfirmed || rec.status === 'Invoice Confirmed' || fullRec.invoiceConfirmed || fullRec.status === 'Invoice Confirmed');
              const isRecFullyPacked = Boolean(
                rec.packingStatus === 'PACKING_VERIFIED' ||
                fullRec.packingStatus === 'PACKING_VERIFIED' ||
                rec.tabGroup === 'Packed' ||
                (rec.status && rec.status.toLowerCase().includes('packed'))
              );
              const isRecAwaitingLoad = Boolean(
                rec.tabGroup === 'AwaitingLoading' ||
                ((rec.status === 'Awaiting Vehicle Loading & Dispatch' || rec.status === 'AWAITING VEHICLE LOADING') && isRecAccountsDone && isRecInvoiceDone) ||
                (isRecFullyPacked && isRecAccountsDone && isRecInvoiceDone)
              );
              if (isRecCancelled) {
                setDispatchPackingModal({ ...fullRec, isViewOnly: true, isReadOnly: true });
              } else if (rec.tabGroup === 'Closed' || rec.status === 'Completed' || rec.status === 'COMPLETED & DISPATCHED') {
                setVehicleLoadingModal({ ...fullRec, isReadOnly: true });
              } else if (rec.tabGroup === 'AwaitingLrCopy' || rec.status === 'Awaiting LR Copy' || rec.status === 'Dispatched - Awaiting LR Copy' || rec.status === 'AWAITING LR COPY') {
                setVehicleLoadingModal(fullRec);
              } else if (isRecAwaitingLoad) {
                setVehicleLoadingModal(fullRec);
              } else {
                setDispatchPackingModal(fullRec);
              }
            } else if (activeTab === 'Accounts Verification') {
              setAccountsVerificationModal(rec);
              setIsAccountsViewOnly(true);
            } else {
              setConfirmingBomModal({ ...rec, isEditMode: true });
            }
          }}
        />
      )}

      {/* ─── UPLOAD PAYMENT MODAL ─── */}
      {uploadPaymentModal && (
        <UploadPaymentModal
          uploadPaymentModal={uploadPaymentModal}
          onClose={() => setUploadPaymentModal(null)}
          setBomStore={setBomStore}
        />
      )}

      {/* ─── UPDATE PAYMENT MODAL ─── */}
      {updatePaymentModal && (
        <UpdatePaymentModal
          updatePaymentModal={updatePaymentModal}
          onClose={() => setUpdatePaymentModal(null)}
          setBomStore={setBomStore}
        />
      )}

      {/* ─── RE-UPLOAD ADDRESS PROOF MODAL ─── */}
      {reuploadAddressProofModal && (
        <ReuploadAddressProofModal
          reuploadAddressProofModal={reuploadAddressProofModal}
          onClose={() => setReuploadAddressProofModal(null)}
          setBomStore={setBomStore}
          setInvoiceList={setInvoiceList}
        />
      )}

      {/* MANDATORY CLOSE INVOICE REASON MODAL */}
      {/* ─── CLOSE INVOICE REASON MODAL ─── */}
      {closeInvoiceReasonModal && (
        <CloseInvoiceReasonModal
          closeInvoiceReasonModal={closeInvoiceReasonModal}
          onClose={() => setCloseInvoiceReasonModal(null)}
          setInvoiceList={setInvoiceList}
        />
      )}



      {/* ─── CONFIRM INVOICE SUCCESS MODAL WITH STOCK DEDUCTION NOTICE ─── */}
      {/* ─── CONFIRM INVOICE SUCCESS MODAL WITH STOCK DEDUCTION NOTICE ─── */}
      {confirmInvoiceSuccessModal && (
        <ConfirmInvoiceSuccessModal
          confirmInvoiceSuccessModal={confirmInvoiceSuccessModal}
          onClose={() => setConfirmInvoiceSuccessModal(null)}
        />
      )}


      {/* ─── FULL BOM LIFECYCLE COMPLETION SUMMARY MODAL ─── */}
      {/* ─── FULL BOM LIFECYCLE COMPLETION SUMMARY MODAL ─── */}
      {completedBomSummaryModal && (
        <CompletedBomSummaryModal
          completedBomSummaryModal={completedBomSummaryModal}
          onClose={() => setCompletedBomSummaryModal(null)}
        />
      )}

      {/* ─── FULL MEDIA LIGHTBOX PREVIEW MODAL ─── */}
      {activeMediaPreviewModal && (
        <ActiveMediaPreviewModal
          activeMediaPreviewModal={activeMediaPreviewModal}
          onClose={() => setActiveMediaPreviewModal(null)}
        />
      )}

      {/* DELIVERY ADDRESS PROOF DOCUMENT VIEWER MODAL */}
      {previewAddressProofModal && (
        <PreviewAddressProofModal
          previewAddressProofModal={previewAddressProofModal}
          onClose={() => setPreviewAddressProofModal(null)}
        />
      )}

      {/* ─── DISPATCH PACKING CHECKLIST PREVIEW MODAL ─── */}
      {dispatchChecklistPreviewModal && (
        <DispatchChecklistPreviewModal
          dispatchChecklistPreviewModal={dispatchChecklistPreviewModal}
          onClose={() => setDispatchChecklistPreviewModal(null)}
        />
      )}

      {/* ─── RECORDED PAYMENT PROOF DOCUMENT VIEWER MODAL (ROOT LEVEL) ─── */}
      {viewingProofDocModal && (
        <ViewingProofDocModal
          viewingProofDocModal={viewingProofDocModal}
          onClose={() => setViewingProofDocModal(null)}
          bomStore={bomStore}
        />
      )}

      {/* ─── CUSTOM TOAST NOTIFICATION POPUP (MATCHES DESIGN SYSTEM) ─── */}
      {customAlert && (
        <NotificationToast
          alert={customAlert}
          onClose={() => setCustomAlert(null)}
        />
      )}

      {/* VRM TAX INVOICE PRINT MODAL TEMPLATE */}
      {printTaxInvoiceModal && (
        <VRMTaxInvoicePrintTemplate
          invoiceData={printTaxInvoiceModal}
          onClose={() => setPrintTaxInvoiceModal(null)}
        />
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDocModal && <DocPreviewModal previewDocModal={previewDocModal} onClose={() => setPreviewDocModal(null)} />}

      {/* BOM CANCELLATION REASON PROMPT MODAL */}
      {/* BOM CANCELLATION REASON PROMPT MODAL */}
      {bomCancelPromptModal && (
        <BomCancelPromptModal
          bomCancelPromptModal={bomCancelPromptModal}
          onClose={() => setBomCancelPromptModal(null)}
          onConfirmCancel={(bom, reason) => executeCancelBom(bom, reason)}
        />
      )}

    </div>
  );
}
