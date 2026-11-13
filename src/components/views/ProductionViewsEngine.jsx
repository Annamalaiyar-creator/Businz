import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense, lazy } from 'react';
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
const CreateWorkOrderPage = lazy(() => import('../CreateWorkOrderPage'));
const RawMaterialInventoryView = lazy(() => import('./RawMaterialInventoryView'));
const WorkOrdersView = lazy(() => import('./WorkOrdersView'));
const InvoiceDetailModal = lazy(() => import('./InvoiceDetailModal'));
const ConfirmingBomModal = lazy(() => import('./ConfirmingBomModal'));
const DispatchPackingModal = lazy(() => import('./DispatchPackingModal'));
const AccountsVerificationModal = lazy(() => import('./AccountsVerificationModal'));
import DocPreviewModal from './DocPreviewModal';
const CustomerProfileView = lazy(() => import('./CustomerProfileView'));
const CustomerFormView = lazy(() => import('./CustomerFormView'));
const CreateBomFormPage = lazy(() => import('./CreateBomFormPage'));
const VehicleLoadingModal = lazy(() => import('./VehicleLoadingModal'));
import LrUploadPopupModal from './LrUploadPopupModal';
const DeliveryChallanModal = lazy(() => import('./DeliveryChallanModal'));
import QuickPreviewDrawer from './QuickPreviewDrawer';
import ProductionTableView from './ProductionTableView';
import { UploadPaymentModal, UpdatePaymentModal, ReuploadAddressProofModal } from './PaymentAndProofModals';
import { CompletedBomSummaryModal, ActiveMediaPreviewModal, PreviewAddressProofModal, DispatchChecklistPreviewModal, ViewingProofDocModal, BomCancelPromptModal } from './DispatchAndPreviewModals';
import { buildProductionConfigs } from './productionConfigs';
import { CloseInvoiceReasonModal, ConfirmInvoiceSuccessModal } from './InvoiceModals';
import { fetchCloudStore, fetchBomsCached, saveCloudStore, saveCloudStoreImmediate, subscribeToCloudStore, getAndReserveNextBomCode, resolveBomCollisions, getWorkflowRank, patchBomPrintInMemoryCache } from '../../utils/supabaseDataSync';
import { getItems, getVendors } from '../../services/businzDataService';
import { VRM_HDG_PRESETS, getAllActivePresets } from '../../vrmHdgProposalPresets';
import { VRM_PRODUCTS } from '../../utils/vrmProductsData';
import { getFullProductsCatalogWithStock } from '../../utils/productCatalogService';
import { prodModuleEngine } from '../../utils/productionModuleEngine';
import NotificationToast from '../NotificationToast';
import { addLiveNotification } from '../Header';
const VRMTaxInvoicePrintTemplate = lazy(() => import('../VRMTaxInvoicePrintTemplate'));
const VRMBomPrintTemplate = lazy(() => import('../VRMBomPrintTemplate'));
import { saveMediaToCache, getMediaFromCache, stripDataUrlsFromRecord, readCompressedImage, compressAndSaveFile, cleanNum, formatCurrency } from '../../utils/otherViewsShared';
import { compareBomDescending, parseBomSequenceNumber, getNumericSearchMatchRank } from '../../utils/sequenceGenerator';
import StatusBadge from '../StatusBadge';
import SearchablePresetSelector from '../SearchablePresetSelector';
import TypeableProductSelect from '../TypeableProductSelect';
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

  useEffect(() => {
    setCurrentPage(1);
  }, [prodSearchQueryText, prodActiveSubTab]);

  const [showBOMForm, setShowBOMForm] = useState(false);
  const [showWorkOrderForm, setShowWorkOrderForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [custFormName, setCustFormName] = useState('');
  const [custFormCompany, setCustFormCompany] = useState('');
  const [custFormGstNo, setCustFormGstNo] = useState('');
  const [custFormMobile, setCustFormMobile] = useState('');
  const [custFormAltPhone, setCustFormAltPhone] = useState('');
  const [custFormEmail, setCustFormEmail] = useState('');

  // Structured Billing Address
  const [custFormBillingAddress1, setCustFormBillingAddress1] = useState('');
  const [custFormBillingAddress2, setCustFormBillingAddress2] = useState('');
  const [custFormBillingAddress, setCustFormBillingAddress] = useState('');
  const [custFormBillingCity, setCustFormBillingCity] = useState('');
  const [custFormBillingState, setCustFormBillingState] = useState('');
  const [custFormBillingPincode, setCustFormBillingPincode] = useState('');

  // Structured Delivery Address
  const [custFormSameAsBilling, setCustFormSameAsBilling] = useState(false);
  const [custFormDeliveryAddress1, setCustFormDeliveryAddress1] = useState('');
  const [custFormDeliveryAddress2, setCustFormDeliveryAddress2] = useState('');
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
    const rawList = (bomStore || []).filter(b => {
      if (!b) return false;
      const code = String(b.bomCode || b.code || b.id || '').trim();
      if (/^BOM-(STAGING|USER|POST|DEV-TEST)/i.test(code)) return false;
      return true;
    });
    if (!isRestrictedSalesUser) return rawList;

    const curCode = (currentEmpId || '').trim().toUpperCase();
    const curName = (currentEmpName || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
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

    const isCodeMatch = (testCode) => {
      if (!testCode) return false;
      const tc = String(testCode).trim().toUpperCase();
      if (!tc) return false;
      if (userAliases.has(tc)) return true;
      if (curCode && (tc === curCode || tc.includes(curCode) || curCode.includes(tc))) return true;

      if (curCode && curCode.includes('SE')) {
        const curDigits = curCode.replace(/\D/g, '').replace(/^0+/, '');
        const testDigits = tc.replace(/\D/g, '').replace(/^0+/, '');
        if (tc.includes('SE') && curDigits && curDigits === testDigits) return true;
      }
      return false;
    };

    return rawList.filter(b => {
      if (!b) return false;

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

      const bomEmails = [b.salesPersonEmail, b.email, b.creatorEmail].filter(Boolean).map(e => String(e).trim().toLowerCase());
      if (curEmail && bomEmails.some(e => e === curEmail || userAliases.has(e))) {
        return true;
      }

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
  }, [bomStore, isRestrictedSalesUser, currentEmpId, currentEmpName, currentLoggedEmail]);

  const hasInitialSyncedRef = useRef(false);
  const isSyncingCloudRef = useRef(false);
  const hasFetchedCustomersRef = useRef(false);
  const lastCloudSyncAtRef = useRef(0);

  // Fast O(N) equivalence check to avoid multi-MB JSON.stringify on main thread during cloud sync
  const areBomListsEquivalent = (prev, next) => {
    if (!Array.isArray(prev) || !Array.isArray(next) || prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i++) {
      const a = prev[i];
      const b = next[i];
      if (a === b) continue;
      if (!a || !b) return false;
      if ((a.bomCode || a.code || a.id) !== (b.bomCode || b.code || b.id)) return false;
      if (a.status !== b.status || a.packingStatus !== b.packingStatus) return false;
      if ((a.updated_at || a.updatedAt) !== (b.updated_at || b.updatedAt)) return false;
      if (Boolean(a.dispatchPrinted) !== Boolean(b.dispatchPrinted)) return false;
      if ((a.dispatchPrintCount || 0) !== (b.dispatchPrintCount || 0)) return false;
      if (Boolean(a.accountsVerification?.verified) !== Boolean(b.accountsVerification?.verified)) return false;
      if (Boolean(a.invoiceConfirmed) !== Boolean(b.invoiceConfirmed) || a.invoiceNo !== b.invoiceNo) return false;
      if (Boolean(a.fullyCompleted) !== Boolean(b.fullyCompleted)) return false;
      if ((a.dispatchPacking?.length || 0) !== (b.dispatchPacking?.length || 0)) return false;
      if ((a.lrNo || '') !== (b.lrNo || '') || (a.lrCopyDoc?.name || '') !== (b.lrCopyDoc?.name || '')) return false;
      if ((a.dispatchPackingMedia?.photos?.length || 0) !== (b.dispatchPackingMedia?.photos?.length || 0)) return false;
      if ((a.dispatchPackingMedia?.videos?.length || 0) !== (b.dispatchPackingMedia?.videos?.length || 0)) return false;
    }
    return true;
  };

  // Debounced background convenience cache write (never blocks UI frames)
  useEffect(() => {
    if (!bomStore || !Array.isArray(bomStore) || bomStore.length === 0) return;
    let idleId = null;
    const timerId = setTimeout(() => {
      const persistCache = () => {
        try {
          const sanitized = bomStore.map(stripDataUrlsFromRecord);
          localStorage.setItem('controlroom_bom_store', JSON.stringify(sanitized));
        } catch (_) {}
      };
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(persistCache, { timeout: 2000 });
      } else {
        persistCache();
      }
    }, 1500);
    return () => {
      clearTimeout(timerId);
      if (idleId !== null && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [bomStore]);

  useEffect(() => {
    const syncFromCloud = async () => {
      if (isSyncingCloudRef.current) return;
      isSyncingCloudRef.current = true;
      try {
        let data = await fetchBomsCached();
        if (data === null || !Array.isArray(data)) {
          data = await fetchCloudStore('bom_store', []);
        }
        lastCloudSyncAtRef.current = Date.now();

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
                const prevCust = String(prevItem.customerName || prevItem.companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const itemCust = String(item.customerName || item.companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                if (prevCust && itemCust && prevCust !== itemCust && !prevCust.includes(itemCust) && !itemCust.includes(prevCust)) {
                  return item;
                }
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
                  salesPersonCode: prevItem.salesPersonCode || item.salesPersonCode,
                  dispatchPrinted: Boolean(item.dispatchPrinted || prevItem.dispatchPrinted),
                  dispatchPrintedAt: item.dispatchPrintedAt || prevItem.dispatchPrintedAt || null,
                  dispatchPrintTimeStr: item.dispatchPrintTimeStr || prevItem.dispatchPrintTimeStr || null,
                  dispatchPrintedDateStr: item.dispatchPrintedDateStr || prevItem.dispatchPrintedDateStr || null,
                  dispatchPrintCount: Math.max(item.dispatchPrintCount || 0, prevItem.dispatchPrintCount || 0),
                  dispatchPrintedBy: item.dispatchPrintedBy || prevItem.dispatchPrintedBy || null
                };
              });

              const sorted = mergedList.sort(compareBomDescending);
              const nextList = sorted.map(stripDataUrlsFromRecord);
              if (areBomListsEquivalent(prev, nextList)) {
                return prev;
              }
              return nextList;
            });
          }
        }

        // Sync Customers directly from Supabase & backend (loaded once and re-fetched only on customer updates)
        // Skip heavy customer directory sync for operations logins (Dispatch, Accounts, Billing, Logistics) to optimize network performance
        const roleLower = String(userRole || (typeof window !== 'undefined' ? localStorage.getItem('controlroom_user_role') : '') || '').toLowerCase();
        const isOperationsRole = roleLower.includes('dispatch') || roleLower.includes('account') || roleLower.includes('billing') || roleLower.includes('logistics') || roleLower.includes('production');
        if (!hasFetchedCustomersRef.current && !isOperationsRole) {
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
              hasFetchedCustomersRef.current = true;
              setCustomerList(prev => {
                if (Array.isArray(prev) && prev.length === custs.length) {
                  const idPrev0 = prev[0]?.customerCode || prev[0]?.id;
                  const idCust0 = custs[0]?.customerCode || custs[0]?.id;
                  const idPrevEnd = prev[prev.length - 1]?.customerCode || prev[prev.length - 1]?.id;
                  const idCustEnd = custs[custs.length - 1]?.customerCode || custs[custs.length - 1]?.id;
                  if (idPrev0 === idCust0 && idPrevEnd === idCustEnd) return prev;
                }
                return custs;
              });
            }
          } catch (_) {}
        }

        // Ensure source PI store is available in localStorage for BOM print fallback & enrichment (one-time fetch if absent)
        if (!localStorage.getItem('controlroom_sales_pi_store')) {
          try {
            const piData = await fetchCloudStore('sales_pi_store', []);
            if (Array.isArray(piData) && piData.length > 0) {
              localStorage.setItem('controlroom_sales_pi_store', JSON.stringify(piData.map(stripDataUrlsFromRecord)));
            }
          } catch (_) {}
        }
      } catch (err) {
        console.error('Error syncing BOMs in ProductionViewsEngine:', err);
      } finally {
        hasInitialSyncedRef.current = true;
        isSyncingCloudRef.current = false;
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
        if (Date.now() - lastCloudSyncAtRef.current > 60000) {
          syncFromCloud();
        }
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

    let debounceCloudTimer = null;
    const debouncedSyncFromCloud = () => {
      if (debounceCloudTimer) clearTimeout(debounceCloudTimer);
      debounceCloudTimer = setTimeout(() => {
        syncFromCloud();
      }, 800);
    };

    const handleCustomerUpdate = () => {
      hasFetchedCustomersRef.current = false;
      debouncedSyncFromCloud();
    };

    const handleBomPrinted = (e) => {
      const { bomCode, ...printPayload } = e.detail || {};
      if (!bomCode) return;
      patchBomPrintInMemoryCache(bomCode, printPayload);
      setBomStore(prev => (prev || []).map(b => {
        if (String(b.bomCode || b.code || b.id || '').trim().toLowerCase() === String(bomCode).trim().toLowerCase()) {
          return { ...b, ...printPayload };
        }
        return b;
      }));
    };

    window.addEventListener('controlroom_bom_store_updated', handleBomUpdated);
    window.addEventListener('controlroom_customer_update', handleCustomerUpdate);
    window.addEventListener('controlroom_storage_update', debouncedSyncFromCloud);
    window.addEventListener('vrm_bom_printed', handleBomPrinted);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(fallbackInterval);
      if (debounceCloudTimer) clearTimeout(debounceCloudTimer);
      window.removeEventListener('controlroom_bom_store_updated', handleBomUpdated);
      window.removeEventListener('controlroom_customer_update', handleCustomerUpdate);
      window.removeEventListener('controlroom_storage_update', debouncedSyncFromCloud);
      window.removeEventListener('vrm_bom_printed', handleBomPrinted);
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
  const [newBomCustomer, setNewBomCustomer] = useState('');
  const [newBomDeliveryDate, setNewBomDeliveryDate] = useState('');
  const [newBomProductName, setNewBomProductName] = useState('');
  const [newBomSku, setNewBomSku] = useState('');
  const [newBomRevision, setNewBomRevision] = useState('');
  const [newBomTargetQty, setNewBomTargetQty] = useState('');
  const [newBomStatus, setNewBomStatus] = useState('ACTIVE');
  const [bomFormErrors, setBomFormErrors] = useState({});

  // Permission Check for Cancel BOM (Strictly Dispatch, Accounts, Production, Billing, and Admin)
  const userRoleNormalized = String(userRole || localStorage.getItem('controlroom_user_role') || '').toLowerCase().trim();
  const canCancelBom = (
    userRoleNormalized.includes('dispatch') ||
    userRoleNormalized.includes('account') ||
    userRoleNormalized.includes('production') ||
    userRoleNormalized.includes('billing') ||
    userRoleNormalized.includes('invoice') ||
    userRoleNormalized.includes('technical administrator') ||
    userRoleNormalized.includes('administrator') ||
    userRoleNormalized.includes('floor supervisor') ||
    userRoleNormalized.includes('md') ||
    userRoleNormalized.includes('ceo')
  );

  // Helper to Restore / Unblock Inventory when a BOM is Cancelled
  const restoreInventoryForBom = (bomItems = [], bomCode = '') => {
    if (!Array.isArray(bomItems) || bomItems.length === 0) return;
    try {
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
          const currStock = parseFloat(String(itemMatch.stock || itemMatch.availableStock || 0).replace(/,/g, '')) || 0;
          const newStock = currStock + qtyToRestore;
          itemMatch.stock = newStock;
          itemMatch.availableStock = newStock;
          itemMatch.reserved = Math.max(0, (parseFloat(itemMatch.reserved) || 0) - qtyToRestore);
          itemMatch.status = newStock === 0 ? 'Out of Stock' : (newStock <= (itemMatch.minLevel || 20) ? 'Low Stock' : 'In Stock');
        }
      });

      if (currentItems.length > 0) {
        localStorage.setItem('controlroom_items_list', JSON.stringify(currentItems));
      }
      window.dispatchEvent(new Event('controlroom_items_update'));
      window.dispatchEvent(new Event('controlroom_storage_update'));
      window.dispatchEvent(new Event('central_inventory_updated'));
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
    const salesPerson = (bomToCancel.salesPerson || bomToCancel.salesExecutive || bomToCancel.createdBy || 'Sales Executive').replace(/\s*\([^)]*\)/g, '').trim();
    const authenticEmpCode = bomToCancel.salesPersonCode || bomToCancel.createdById || bomToCancel.sales_person_code || bomToCancel.created_by_id || bomToCancel.salesPersonId || bomToCancel.salesPersonEmpCode || bomToCancel.creatorEmpCode || null;
    notifyBomCancelledByDispatch({
      bomCode: bCode,
      customerName: bomToCancel.customerName,
      salesPerson: salesPerson,
      salesPersonEmpCode: authenticEmpCode,
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

    alert(`BOM (${bCode}) has been CANCELLED.\nReason: "${cleanReason}"\nSales person (${salesPerson.replace(/\\s*\\([^)]*\\)/g, '').trim()}) has been notified and all items have been restored to live inventory.`);
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

    if (!isDraft && (!newBomDocType || !newBomDocType.trim())) {
      errors.docType = 'Document Type (DC or Invoice) is mandatory';
      missingList.push({
        field: 'Document Type (DC or Invoice) *',
        message: 'Document Type is mandatory. Please select whether this order is for an Invoice or DC (Delivery Challan).',
        targetId: 'prod-field-newBomDocType'
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

    const isDcDocType = Boolean(
      newBomDocType === 'DC' ||
      newBomDocType === 'Delivery Challan' ||
      String(newBomDocType || '').toUpperCase().includes('DC') ||
      String(newBomDocType || '').toUpperCase().includes('CHALLAN')
    );

    if (!isDraft && !isDcDocType && isPaymentProofRequired) {
      const hasPaymentProof = Array.isArray(newBomPaymentProofDoc)
        ? newBomPaymentProofDoc.length > 0
        : Boolean(newBomPaymentProofDoc);
      if (!hasPaymentProof) {
        errors.paymentProof = `Payment Attachment / Slip * is strictly mandatory for ${newBomPaymentType}`;
        missingList.push({
          field: 'Payment Attachment / Slip *',
          message: `Payment Attachment / Slip * is strictly mandatory for "${newBomPaymentType}". Please attach the bank transfer slip/receipt to proceed.`,
          targetId: 'prod-field-newBomPaymentProofDoc'
        });
      }
    }

    if (!isDraft && (!newBomDestination || !newBomDestination.trim())) {
      errors.destination = 'Destination is required';
      missingList.push({
        field: 'Destination *',
        message: 'Destination is mandatory. Please enter delivery destination.',
        targetId: 'create-bom-form-destination'
      });
    }

    setBomFormErrors(errors);
    return { isValid: missingList.length === 0, missingList, errors };
  };
  const [newBomDocType, setNewBomDocType] = useState('Invoice');
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
  const [newBomDestination, setNewBomDestination] = useState('');
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
  const [lrUploadModal, setLrUploadModal] = useState(null); // BOM object awaiting LR Copy upload
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
  const [printBomModal, setPrintBomModal] = useState(null);

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

  // Debounced background convenience cache update for invoices (never blocks UI frames)
  useEffect(() => {
    if (!invoiceList || invoiceList.length === 0) return;
    const timerId = setTimeout(() => {
      try {
        localStorage.setItem('controlroom_invoice_store', JSON.stringify(invoiceList.map(stripDataUrlsFromRecord)));
      } catch (_) {}
    }, 1000);
    return () => clearTimeout(timerId);
  }, [invoiceList]);

  // Initial cloud fetch for invoices & listen for local update events (single deduplicated call via fetchCloudStore)
  useEffect(() => {
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

  // Memoized per-active-tab config builder & row filter (eliminates multi-MB main-thread re-computation on every render/click)
  const memoizedConfigs = useMemo(() => {
    return buildProductionConfigs({ bomStore, visibleBomStore, invoiceList, customerList, activeTab });
  }, [bomStore, visibleBomStore, invoiceList, customerList, activeTab]);

  const memoizedPageConfig = useMemo(() => {
    if (memoizedConfigs[activeTab]) return memoizedConfigs[activeTab];
    return {
      title: activeTab,
      subtitle: `Management and control for ${activeTab}`,
      actionText: `+ Create ${String(activeTab || '').replace(/s$/, '')}`,
      searchPlaceholder: `Search ${activeTab}...`,
      tabs: [
        { id: 'All', label: 'All Entries', count: (bomStore || []).length, bg: '#e2e8f0', fg: '#475569' }
      ],
      headers: ['Reference Code', 'Customer / Item', 'Details', 'Date', 'Value', 'Status'],
      rows: (bomStore || []).filter(b => {
        if (activeTab === 'Dispatch Orders') {
          if (!b) return false;
          const s = String(b?.status || '').toLowerCase().trim();
          const isDraftOrPending = Boolean(
            (b.status === 'Draft' || s === 'draft' ||
             b.status === 'Pending Confirmation' || s.includes('pending confirmation') ||
             s === 'pending sales confirmation') &&
            !b.isSentToDispatch &&
            !s.includes('sent to dispatch') &&
            !s.includes('packed') &&
            !s.includes('completed')
          );
          if (isDraftOrPending) return false;
          return Boolean(
            b.salesConfirmed ||
            b.isSentToDispatch ||
            s.includes('dispatch') ||
            s.includes('production') ||
            s.includes('confirmed') ||
            s.includes('packed') ||
            s.includes('accounts') ||
            s.includes('invoice') ||
            s.includes('loading') ||
            s.includes('completed') ||
            s.includes('closed')
          );
        }
        return true;
      }).map(b => {
        let dispStatus = b.status || 'ACTIVE';
        if (activeTab === 'Dispatch Orders') {
          if (['Sent to Production', 'Confirmed', 'In Production'].includes(b.status) || !b.status) {
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
  }, [memoizedConfigs, activeTab, bomStore]);

  const memoizedFilteredRows = useMemo(() => {
    const qTrim = String(prodSearchQueryText || '').trim();
    const qLower = qTrim.toLowerCase();
    const isPureDigits = /^\d+$/.test(qTrim);
    const subTab = String(prodActiveSubTab || 'All').toLowerCase();
    const cleanSub = subTab.replace(/[^a-z0-9]/g, '');

    const filteredByTabAndDate = (memoizedPageConfig.rows || []).filter(r => {
      let matchesDate = true;
      const rDateStr = r.salesConfirmedAt || r.date || r.createdAt || r.bomDate || (r.dateTimeObj ? r.dateTimeObj.date : null) || (r.c4 && /^\d{4}-\d{2}-\d{2}/.test(r.c4) ? r.c4 : null);
      if (rDateStr && (prodFilterDateVal || prodFilterEndDateVal)) {
        const rIso = String(rDateStr).substring(0, 10);
        if (prodFilterDateVal && rIso < prodFilterDateVal) matchesDate = false;
        if (prodFilterEndDateVal && rIso > prodFilterEndDateVal) matchesDate = false;
      }

      const rStatus = (typeof r.status === 'string' ? r.status : (r.status?.name || r.status?.label || '')).toLowerCase();
      const rTabGroup = (typeof r.tabGroup === 'string' ? r.tabGroup : '').toLowerCase();

      const cleanStatus = rStatus.replace(/[^a-z0-9]/g, '');
      const cleanGroup = rTabGroup.replace(/[^a-z0-9]/g, '');

      const isCancelledRecord = Boolean(
        r.cancelled ||
        r.status === 'CANCELLED' ||
        r.status === 'Cancelled' ||
        r.status === 'Cancelled & Stock Restored' ||
        cleanStatus.includes('cancel') ||
        cleanGroup.includes('cancel')
      );

      if (isCancelledRecord) {
        return matchesDate && cleanSub.includes('cancel');
      }

      const matchesTab = cleanSub === 'all' ||
        cleanSub === 'allboms' ||
        cleanSub === 'allorders' ||
        cleanSub === 'allaccountsorders' ||
        (cleanSub === 'pendingprint' && (!r.dispatchPrinted && !r.isPrinted)) ||
        (cleanSub === 'printed' && Boolean(r.dispatchPrinted || r.isPrinted)) ||
        cleanGroup === cleanSub ||
        rTabGroup === subTab ||
        (cleanSub.includes('pending') && cleanSub !== 'pendingprint' && (cleanStatus.includes('pending') || cleanGroup.includes('pending') || cleanStatus.includes('draft'))) ||
        (cleanSub.includes('partially') && (cleanStatus.includes('partial') || cleanGroup.includes('partial'))) ||
        (cleanSub.includes('packed') && (cleanStatus.includes('packed') || cleanGroup.includes('packed') || cleanStatus.includes('verified'))) ||
        (cleanSub.includes('loading') && (cleanStatus.includes('loading') || cleanGroup.includes('loading'))) ||
        (cleanSub.includes('lr') && (cleanStatus.includes('lr') || cleanGroup.includes('lr'))) ||
        ((cleanSub.includes('closed') || cleanSub.includes('dispatched')) && (cleanStatus.includes('closed') || cleanStatus.includes('dispatched') || cleanStatus.includes('completed') || cleanGroup.includes('closed') || r.fullyCompleted)) ||
        (cleanSub.includes('draft') && cleanStatus.includes('draft')) ||
        (cleanSub.includes('sent') && (cleanStatus.includes('sent') || cleanStatus.includes('confirm') || cleanStatus.includes('production')));

      return matchesDate && matchesTab;
    });

    if (!qTrim) {
      return filteredByTabAndDate;
    }

    if (isPureDigits) {
      const rankedMatches = [];
      for (let i = 0; i < filteredByTabAndDate.length; i++) {
        const r = filteredByTabAndDate[i];
        const rank = getNumericSearchMatchRank(
          qTrim,
          [r.code, r.bomCode, r.id, r.sourcePiNo, r.invNo, r.invoiceNo, r.dcNo, activeTab === 'Invoice Management' ? r.c3 : null],
          [r.customerName, activeTab === 'Delivery Challans' ? r.c3 : r.c2, activeTab === 'Delivery Challans' ? r.c5 : null, r.mobile, r.phone]
        );
        if (rank > 0) {
          rankedMatches.push({ row: r, rank, idx: i });
        }
      }
      rankedMatches.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.idx - b.idx));
      return rankedMatches.map(entry => entry.row);
    }

    return filteredByTabAndDate.filter(r =>
      (r.code && String(r.code).toLowerCase().includes(qLower)) ||
      (r.bomCode && String(r.bomCode).toLowerCase().includes(qLower)) ||
      (r.id && String(r.id).toLowerCase().includes(qLower)) ||
      (r.sourcePiNo && String(r.sourcePiNo).toLowerCase().includes(qLower)) ||
      (r.customerName && String(r.customerName).toLowerCase().includes(qLower)) ||
      (r.salesPerson && String(r.salesPerson).toLowerCase().includes(qLower)) ||
      (r.c2 && String(r.c2).toLowerCase().includes(qLower)) ||
      (r.c3 && String(r.c3).toLowerCase().includes(qLower)) ||
      (r.c4 && String(r.c4).toLowerCase().includes(qLower)) ||
      ((qTrim.startsWith('₹') || activeTab === 'Delivery Challans') && r.c5 && String(r.c5).toLowerCase().includes(qLower))
    );
  }, [memoizedPageConfig, prodSearchQueryText, prodFilterDateVal, prodFilterEndDateVal, prodActiveSubTab, activeTab]);


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
              <Suspense fallback={null}>
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
                  setDispatchChecklistPreviewModal={setDispatchChecklistPreviewModal}
                  showCustomAlert={showCustomAlert}
                  newBomDocType={newBomDocType}
                  setNewBomDocType={setNewBomDocType}
                  validateProductionBomForm={validateProductionBomForm}
                />
              </Suspense>
            );
          }

          // RawMaterialInventoryView extracted to ./RawMaterialInventoryView.jsx

          // Dedicated Custom Renderer for Inventory & Raw Material Directory matching User UI Design
          if (activeTab === 'Raw Material Directory' || activeTab === 'Inventory (Raw Material)' || activeTab === 'Inventory' || (activeTab && activeTab.toLowerCase().includes('inventory')) || (activeTab && activeTab.toLowerCase().includes('raw material'))) {
            return (
              <Suspense fallback={null}>
                <RawMaterialInventoryView
                  showAddStockForm={showAddStockForm}
                  setShowAddStockForm={setShowAddStockForm}
                  userRole={userRole}
                  activeTab={activeTab}
                  itemsLoading={itemsLoading}
                  showCustomAlert={showCustomAlert}
                  itemsList={props.itemsList || []}
                />
              </Suspense>
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
                <Suspense fallback={null}>
                  <CreateWorkOrderPage
                    onBack={() => setShowWorkOrderForm(false)}
                    onWorkOrderCreated={(newWO) => {
                      setShowWorkOrderForm(false);
                      showCustomAlert(`Work Order ${newWO?.id || ''} created & issued successfully! Raw Material Required: ${newWO?.rawMaterialPhysicalToIssue || ''} ${newWO?.rawMaterialUnit || ''}`, `Work Order ${newWO?.id || ''} Issued Successfully!`, 'success');
                    }}
                  />
                </Suspense>
              );
            }

            return (
              <Suspense fallback={null}>
                <WorkOrdersView
                  userRole={userRole}
                  setShowWorkOrderForm={setShowWorkOrderForm}
                  prodSearchQueryText={prodSearchQueryText}
                  setProdSearchQueryText={setProdSearchQueryText}
                  prodStatusFilterText={prodStatusFilterText}
                  setProdStatusFilterText={setProdStatusFilterText}
                />
              </Suspense>
            );
          }

          // Render Send Confirm (Editable Mode) or View BOM Details (100% Read-Only Mode)
          if (confirmingBomModal) {
            return (
              <Suspense fallback={null}>
                <ConfirmingBomModal
                  confirmingBomModal={confirmingBomModal}
                  setConfirmingBomModal={setConfirmingBomModal}
                  setBomStore={setBomStore}
                  setActiveMediaPreviewModal={setActiveMediaPreviewModal}
                />
              </Suspense>
            );
          }

          // Render Dispatch Head Packing Verification Screen (Full Size Page)
          if (dispatchPackingModal) {
            return (
              <>
                <Suspense fallback={null}>
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
                    userRole={userRole}
                  />
                </Suspense>
                {bomCancelPromptModal && (
                  <BomCancelPromptModal
                    bomCancelPromptModal={bomCancelPromptModal}
                    onClose={() => setBomCancelPromptModal(null)}
                    onConfirmCancel={(bom, reason) => executeCancelBom(bom, reason)}
                  />
                )}
              </>
            );
          }

          // Render Vehicle Loading Verification Screen (Full Size Page like DispatchPackingModal)
          if (vehicleLoadingModal) {
            return (
              <Suspense fallback={null}>
                <VehicleLoadingModal
                  vehicleLoadingModal={vehicleLoadingModal}
                  onClose={() => setVehicleLoadingModal(null)}
                  setBomStore={setBomStore}
                  setCompletedBomSummaryModal={setCompletedBomSummaryModal}
                  setActiveMediaPreviewModal={setActiveMediaPreviewModal}
                  setInvoiceList={setInvoiceList}
                />
              </Suspense>
            );
          }

          // Render Accounts Team Payment & Document Verification Screen (Full Size Page)
          if (accountsVerificationModal) {
            return (
              <>
                <Suspense fallback={null}>
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
                </Suspense>
                {bomCancelPromptModal && (
                  <BomCancelPromptModal
                    bomCancelPromptModal={bomCancelPromptModal}
                    onClose={() => setBomCancelPromptModal(null)}
                    onConfirmCancel={(bom, reason) => executeCancelBom(bom, reason)}
                  />
                )}
              </>
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
              <Suspense fallback={null}>
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
              </Suspense>
            );
          }

          // Render Create/Edit Customer Form if active or open
          if (showCustomerForm || editingCustomer) {
            return (
              <Suspense fallback={null}>
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
                  custFormAltPhone={custFormAltPhone}
                  setCustFormAltPhone={setCustFormAltPhone}
                  custFormEmail={custFormEmail}
                  setCustFormEmail={setCustFormEmail}
                  custFormBillingAddress1={custFormBillingAddress1}
                  setCustFormBillingAddress1={setCustFormBillingAddress1}
                  custFormBillingAddress2={custFormBillingAddress2}
                  setCustFormBillingAddress2={setCustFormBillingAddress2}
                  custFormBillingAddress={custFormBillingAddress}
                  setCustFormBillingAddress={setCustFormBillingAddress}
                  custFormBillingCity={custFormBillingCity}
                  setCustFormBillingCity={setCustFormBillingCity}
                  custFormBillingState={custFormBillingState}
                  setCustFormBillingState={setCustFormBillingState}
                  custFormBillingPincode={custFormBillingPincode}
                  setCustFormBillingPincode={setCustFormBillingPincode}
                  custFormDeliveryAddress1={custFormDeliveryAddress1}
                  setCustFormDeliveryAddress1={setCustFormDeliveryAddress1}
                  custFormDeliveryAddress2={custFormDeliveryAddress2}
                  setCustFormDeliveryAddress2={setCustFormDeliveryAddress2}
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
              </Suspense>
            );
          }

          // Render Create BOM Form matching exact user reference screenshot design system
          if (showBOMForm) {
            return (
              <Suspense fallback={null}>
                <CreateBomFormPage
                  showBOMForm={showBOMForm}
                  setShowBOMForm={setShowBOMForm}
                  setShowCustomerForm={setShowCustomerForm}
                  customerList={customerList}
                  itemsList={props.itemsList || []}
                  sourcePiNo={props.sourcePiNo || props.newBomSourcePiNo || null}
                  newBomSourcePiNo={props.newBomSourcePiNo || props.sourcePiNo || null}
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
                  newBomDestination={newBomDestination}
                  setNewBomDestination={setNewBomDestination}
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
                  newBomDocType={newBomDocType}
                  setNewBomDocType={setNewBomDocType}
                  validateProductionBomForm={validateProductionBomForm}
                />
              </Suspense>
            );
          }

          // Render Create / View Delivery Challan Page matching PO & PI design inline (sidebar visible)
          if (pendingDcModal) {
            return (
              <Suspense fallback={null}>
                <DeliveryChallanModal
                  pendingDcModal={pendingDcModal}
                  onClose={() => setPendingDcModal(null)}
                  bomStore={bomStore}
                  setBomStore={setBomStore}
                  invoiceList={invoiceList}
                  setInvoiceList={setInvoiceList}
                  userRole={userRole}
                />
              </Suspense>
            );
          }

          const pageConfig = memoizedPageConfig;
          const filteredRows = memoizedFilteredRows;

          return (
            <ProductionTableView
              pageConfig={pageConfig}
              activeTab={activeTab}
              userRole={userRole}
              onPrintTaxInvoice={(row) => setPrintTaxInvoiceModal(row)}
              onPrintBom={(row) => setPrintBomModal(row)}
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
                  setCustFormMobile(targetRow.c4 || targetRow.primaryContact?.phone || '');
                  setCustFormAltPhone(targetRow.altPhone || targetRow.altNumber || targetRow.primaryContact?.altPhone || '');
                  setCustFormEmail(targetRow.c5 || targetRow.primaryContact?.email || '');

                  const bObj = targetRow.billingAddressObj || {};
                  const dObj = targetRow.deliveryAddressObj || {};
                  const b1 = targetRow.address1 || targetRow.billingAddress1 || bObj.address1 || '';
                  const b2 = targetRow.address2 || targetRow.billingAddress2 || bObj.address2 || '';
                  const d1 = targetRow.dispatchAddress1 || targetRow.shippingAddress1 || dObj.address1 || '';
                  const d2 = targetRow.dispatchAddress2 || targetRow.shippingAddress2 || dObj.address2 || '';

                  setCustFormBillingAddress1(b1);
                  setCustFormBillingAddress2(b2);
                  setCustFormBillingAddress([b1, b2].filter(Boolean).join(', ') || bObj.address || targetRow.c6 || targetRow.billingAddress || '');
                  setCustFormBillingCity(bObj.city || '');
                  setCustFormBillingState(bObj.state || '');
                  setCustFormBillingPincode(bObj.pincode || '');

                  const isSame = (targetRow.deliveryAddress === targetRow.billingAddress && Boolean(targetRow.billingAddress)) || (!targetRow.c7 && !targetRow.deliveryAddress) || (b1 === d1 && b2 === d2 && Boolean(b1));
                  setCustFormSameAsBilling(isSame);
                  setCustFormDeliveryAddress1(d1 || (isSame ? b1 : ''));
                  setCustFormDeliveryAddress2(d2 || (isSame ? b2 : ''));
                  setCustFormDeliveryAddress([d1, d2].filter(Boolean).join(', ') || dObj.address || targetRow.c7 || targetRow.deliveryAddress || '');
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
                  const combinedPhotos = [
                    ...(Array.isArray(originalBom?.dispatchPackingMedia?.photos) ? originalBom.dispatchPackingMedia.photos : []),
                    ...(Array.isArray(targetRow?.dispatchPackingMedia?.photos) ? targetRow.dispatchPackingMedia.photos : [])
                  ];
                  const seenPh = new Set();
                  const mergedPhotos = combinedPhotos.filter(p => {
                    if (!p) return false;
                    const k = p.id || p.name;
                    if (!k || seenPh.has(k)) return false;
                    seenPh.add(k);
                    return true;
                  });
                  const combinedVideos = [
                    ...(Array.isArray(originalBom?.dispatchPackingMedia?.videos) ? originalBom.dispatchPackingMedia.videos : []),
                    ...(Array.isArray(targetRow?.dispatchPackingMedia?.videos) ? targetRow.dispatchPackingMedia.videos : [])
                  ];
                  const seenVd = new Set();
                  const mergedVideos = combinedVideos.filter(v => {
                    if (!v) return false;
                    const k = v.id || v.name;
                    if (!k || seenVd.has(k)) return false;
                    seenVd.add(k);
                    return true;
                  });
                  const resolvedMedia = (mergedPhotos.length > 0 || mergedVideos.length > 0)
                    ? { photos: mergedPhotos, videos: mergedVideos, photosCount: mergedPhotos.length, videosCount: mergedVideos.length }
                    : (originalBom?.dispatchPackingMedia || targetRow?.dispatchPackingMedia || { photos: [], videos: [] });

                  const fullBomToLoad = originalBom ? {
                    ...targetRow,
                    ...originalBom,
                    customerName: (originalBom.customerName && originalBom.customerName !== 'Teorainn Solar Pvt Ltd') ? originalBom.customerName : (targetRow.customerName || originalBom.customerName),
                    companyName: (originalBom.companyName && originalBom.companyName !== 'Teorainn Solar Pvt Ltd') ? originalBom.companyName : (targetRow.companyName || originalBom.companyName || originalBom.customerName),
                    dispatchPacking: (Array.isArray(originalBom.dispatchPacking) && originalBom.dispatchPacking.length > 0) ? originalBom.dispatchPacking : (targetRow.dispatchPacking || []),
                    dispatchPackingMedia: resolvedMedia,
                    status: (originalBom.status || targetRow.rawStatus || targetRow.status),
                    salesPerson: (originalBom.salesPerson || targetRow.salesPerson),
                    salesPersonCode: (originalBom.salesPersonCode || targetRow.salesPersonCode)
                  } : {
                    ...targetRow,
                    dispatchPackingMedia: resolvedMedia
                  };

                  const isAccountsDone = Boolean(targetRow.isAccountsDone || targetRow.accountsVerification?.verified);
                  const isInvoiceDone = Boolean(targetRow.invoiceConfirmed || targetRow.status === 'Invoice Confirmed');
                  const isFullyPacked = Boolean(
                    targetRow.packingStatus === 'PACKING_VERIFIED' ||
                    targetRow.tabGroup === 'Packed' ||
                    (targetRow.status && !targetRow.status.toLowerCase().includes('partially') && targetRow.status.toLowerCase().includes('packed'))
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
                    setLrUploadModal(fullBomToLoad);
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
              const recCombinedPhotos = [
                ...(Array.isArray(origRec?.dispatchPackingMedia?.photos) ? origRec.dispatchPackingMedia.photos : []),
                ...(Array.isArray(rec?.dispatchPackingMedia?.photos) ? rec.dispatchPackingMedia.photos : [])
              ];
              const seenRecPh = new Set();
              const mergedRecPhotos = recCombinedPhotos.filter(p => {
                if (!p) return false;
                const k = p.id || p.name;
                if (!k || seenRecPh.has(k)) return false;
                seenRecPh.add(k);
                return true;
              });
              const recCombinedVideos = [
                ...(Array.isArray(origRec?.dispatchPackingMedia?.videos) ? origRec.dispatchPackingMedia.videos : []),
                ...(Array.isArray(rec?.dispatchPackingMedia?.videos) ? rec.dispatchPackingMedia.videos : [])
              ];
              const seenRecVd = new Set();
              const mergedRecVideos = recCombinedVideos.filter(v => {
                if (!v) return false;
                const k = v.id || v.name;
                if (!k || seenRecVd.has(k)) return false;
                seenRecVd.add(k);
                return true;
              });
              const resolvedRecMedia = (mergedRecPhotos.length > 0 || mergedRecVideos.length > 0)
                ? { photos: mergedRecPhotos, videos: mergedRecVideos, photosCount: mergedRecPhotos.length, videosCount: mergedRecVideos.length }
                : (origRec?.dispatchPackingMedia || rec?.dispatchPackingMedia || { photos: [], videos: [] });

              const fullRec = origRec ? {
                ...rec,
                ...origRec,
                customerName: (origRec.customerName && origRec.customerName !== 'Teorainn Solar Pvt Ltd') ? origRec.customerName : (rec.customerName || origRec.customerName),
                companyName: (origRec.companyName && origRec.companyName !== 'Teorainn Solar Pvt Ltd') ? origRec.companyName : (rec.companyName || origRec.companyName || origRec.customerName),
                dispatchPacking: (Array.isArray(origRec.dispatchPacking) && origRec.dispatchPacking.length > 0) ? origRec.dispatchPacking : (rec.dispatchPacking || []),
                dispatchPackingMedia: resolvedRecMedia,
                status: (origRec.status || rec.rawStatus || rec.status),
                salesPerson: (origRec.salesPerson || rec.salesPerson),
                salesPersonCode: (origRec.salesPersonCode || rec.salesPersonCode)
              } : {
                ...rec,
                dispatchPackingMedia: resolvedRecMedia
              };

              const isRecCancelled = Boolean(rec.cancelled || rec.status === 'CANCELLED' || rec.status === 'Cancelled' || rec.status === 'Cancelled & Stock Restored' || (typeof rec.status === 'string' && rec.status.toLowerCase().includes('cancel')));
              const isRecAccountsDone = Boolean(rec.isAccountsDone || rec.accountsVerification?.verified || fullRec.isAccountsDone || fullRec.accountsVerification?.verified);
              const isRecInvoiceDone = Boolean(rec.invoiceConfirmed || rec.status === 'Invoice Confirmed' || fullRec.invoiceConfirmed || fullRec.status === 'Invoice Confirmed');
              const isRecFullyPacked = Boolean(
                rec.packingStatus === 'PACKING_VERIFIED' ||
                fullRec.packingStatus === 'PACKING_VERIFIED' ||
                rec.tabGroup === 'Packed' ||
                (rec.status && !rec.status.toLowerCase().includes('partially') && rec.status.toLowerCase().includes('packed'))
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
                setLrUploadModal(fullRec);
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

      {/* ─── DEDICATED LR COPY UPLOAD POPUP MODAL (ACCESSED VIA FLOATING ACTION BAR) ─── */}
      {lrUploadModal && (
        <LrUploadPopupModal
          bom={lrUploadModal}
          onClose={() => setLrUploadModal(null)}
          setBomStore={setBomStore}
          setInvoiceList={setInvoiceList}
          setActiveMediaPreviewModal={setActiveMediaPreviewModal}
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
        <Suspense fallback={null}>
          <VRMTaxInvoicePrintTemplate
            invoiceData={printTaxInvoiceModal}
            onClose={() => setPrintTaxInvoiceModal(null)}
          />
        </Suspense>
      )}

      {/* VRM BOM PRINT MODAL TEMPLATE */}
      {printBomModal && (
        <Suspense fallback={null}>
          <VRMBomPrintTemplate
            bomData={printBomModal}
            onClose={() => setPrintBomModal(null)}
            userRole={props.userRole || userRole || 'Dispatch Head'}
            isSales={false}
          />
        </Suspense>
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
