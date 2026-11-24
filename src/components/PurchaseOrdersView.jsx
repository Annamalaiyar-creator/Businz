import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Check, Hourglass, Edit3, Trash2, Eye, FileText, X, XCircle, UploadCloud, CheckCircle, Search, AlertTriangle, ArrowLeft, ArrowRight, MoreVertical, Edit, Truck, Info, Mail, Calendar, Filter, ChevronLeft, ChevronRight, RotateCcw, ChevronDown, AlertCircle, Copy, Tag, MoreHorizontal, CreditCard, Send, Image, Boxes, Clock, FileCode, Loader2, FileCheck, ExternalLink, ShoppingCart, Building2, MapPin, Ban, Package, Download, Maximize2, MessageSquare, Phone, ShieldCheck, Printer, Layers } from 'lucide-react';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { getPurchaseOrders, getVendors, getItems, savePurchaseOrder } from '../services/businzDataService';
import StatusBadge from './StatusBadge';
import NotificationToast from './NotificationToast';
import ModernDateRangePicker from './ModernDateRangePicker';
import { getNextSequence } from '../utils/sequenceGenerator';
import { notifyPoSentForApproval } from '../services/notificationService';
import { parseAddressString, formatAddressObj, getVendorLocations } from '../utils/otherViewsShared';
import { centralInventoryStore } from '../utils/centralInventoryStore';
import CreateProductModal from './views/CreateProductModal';
import TypeableProductSelect from './TypeableProductSelect';
import TypeableVendorSelect from './TypeableVendorSelect';
import VRMPurchaseOrderPrintTemplate from './VRMPurchaseOrderPrintTemplate';
import { getHsnCode } from '../utils/hsnCodeService';
import { extractGstRate } from '../utils/gstHelper';
import { CODE_TO_SALES_NAME } from './pi/piHelpers';

import { COMPANY_LOCATIONS, getCompanyProfile, PRESET_MATERIALS, TERMS_PRESETS } from './purchaseOrders/poConstants';
import PoReadOnlyDocument from './purchaseOrders/PoReadOnlyDocument';
import PoTableSection from './purchaseOrders/PoTableSection';
import CeoPoDetailModal from './purchaseOrders/CeoPoDetailModal';
import PoBulkItemModal from './purchaseOrders/PoBulkItemModal';
import PoWorkflowModals from './purchaseOrders/PoWorkflowModals';
import PoFormHeaderBar from './purchaseOrders/PoFormHeaderBar';
import { getMissingPoFields as getMissingPoFieldsHelper, renderPoStatusBadge, executeDeletePoRecord } from './purchaseOrders/poHelpers';
import { uploadAndParsePoPdf } from './purchaseOrders/poPdfService';
import { usePoDataSync } from './purchaseOrders/usePoDataSync';
import PoItemsTableSection from './purchaseOrders/PoItemsTableSection';
import PoConfirmationModals from './purchaseOrders/PoConfirmationModals';
import PoStageActionButtons from './purchaseOrders/PoStageActionButtons';

export { COMPANY_LOCATIONS, getCompanyProfile, PRESET_MATERIALS, TERMS_PRESETS };
export default function PurchaseOrdersView({ userRole = 'Procurement Head', targetPoNo, clearTargetPo, targetPoTab, clearTargetPoTab, onNavigateTab }) {
  const activeRole = userRole || localStorage.getItem('controlroom_user_role') || 'Procurement Head';
  const isProcurementRole = activeRole === 'Procurement Head' || activeRole === 'Procurement Admin' || activeRole.includes('Procurement');
  const isAccounts = activeRole.includes('Accounts');
  const isAdminOrTech = activeRole === 'Admin' || activeRole === 'Technical Administrator';
  const isExecutiveOrMD = (activeRole === 'CEO' || activeRole === 'Managing Director' || activeRole === 'MD') && !isProcurementRole && !isAdminOrTech;
  const canApproveAsMD = isExecutiveOrMD || isAdminOrTech;
  const isProcurementHead = isProcurementRole || isAdminOrTech;
  const isCeoLogin = Boolean(isExecutiveOrMD || activeRole === 'CEO' || activeRole === 'Managing Director' || activeRole === 'MD');
  
  const getLoggedInUserName = () => {
    const storedName = typeof window !== 'undefined' ? (localStorage.getItem('controlroom_logged_user_name') || '').trim() : '';
    if (storedName && storedName !== 'undefined' && storedName !== 'null' && storedName.toLowerCase() !== 'vijay') return storedName;
    const curEmp = (typeof window !== 'undefined' ? localStorage.getItem('controlroom_logged_emp_id') : '')?.trim()?.toUpperCase();
    if (curEmp && CODE_TO_SALES_NAME[curEmp]) return CODE_TO_SALES_NAME[curEmp];
    try {
      const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
      const allEmps = [...(Array.isArray(storedEmps) ? storedEmps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];
      if (curEmp) {
        const match = allEmps.find(e => e && (
          String(e.employee_code || '').toUpperCase() === curEmp || 
          String(e.code || '').toUpperCase() === curEmp ||
          (Array.isArray(e.alias_codes) && e.alias_codes.some(a => String(a).toUpperCase() === curEmp))
        ));
        if (match && (match.employee_name || match.name)) return match.employee_name || match.name;
      }
    } catch(e) {}
    if (storedName && storedName !== 'undefined' && storedName !== 'null') return storedName;
    if (userRole === 'Production Head') return 'Senthil Kumar';
    if (userRole === 'Technical Administrator' || userRole === 'CEO') return 'Annamalaiyar';
    if (userRole === 'Dispatch Head') return 'Kalpana';
    if (userRole === 'Floor Supervisor') return 'Floor Supervisor';
    if (userRole === 'Floor Employee') return 'Floor Employee';
    if (userRole === 'Accounts Head') return 'Venkatesh';
    if (userRole === 'Accounts Executive') return 'Priya';
    if (userRole === 'Sales Head') return 'Sales Head';
    if (userRole === 'Sales Executive') return localStorage.getItem('controlroom_logged_user_name') || 'Sales Executive';
    if (userRole === 'Procurement Head' || userRole === 'Procurement Admin') return 'ARUN BOOPATHI M';
    return storedName || userRole || 'User';
  };

  const loggedInUserName = getLoggedInUserName();
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'create' | 'edit' | 'view'
  const [showCeoPoModal, setShowCeoPoModal] = useState(false);
  const [printPoModal, setPrintPoModal] = useState(null);
  const [poDetailLoading, setPoDetailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handlePushToGrn = (poTarget) => {
    if (!poTarget) return;
    const poNo = poTarget.poNo || poTarget.id;
    try {
      window.__businzPendingPushToGrn = { poNo, poTarget };
    } catch (_) {}
    try {
      sessionStorage.setItem('controlroom_push_to_grn_po', poNo);
      sessionStorage.setItem('controlroom_push_to_grn_po_data', JSON.stringify(poTarget));
    } catch (_) {}
    try {
      localStorage.setItem('controlroom_push_to_grn_po', poNo);
      localStorage.setItem('controlroom_push_to_grn_po_data', JSON.stringify(poTarget));
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('controlroom_push_to_grn', { detail: poTarget }));
    } catch (_) {}
    if (typeof onNavigateTab === 'function') {
      onNavigateTab('Goods Receipt Note');
    } else {
      try { localStorage.setItem('controlroom_active_tab', 'Goods Receipt Note'); } catch (_) {}
      window.location.reload();
    }
  };

  // Confirmation and edit states
  const [deleteIdx, setDeleteIdx] = useState(null); // Row index to delete
  const [showSaveConfirm, setShowSaveConfirm] = useState(false); // Save confirmation
  const [isSubmittingPO, setIsSubmittingPO] = useState(false); // Guard against rapid multi-clicks
  const [showCancelConfirm, setShowCancelConfirm] = useState(false); // Cancel confirmation
  const [editIdx, setEditIdx] = useState(null); // Row index to edit
  const [activeDropdownIdx, setActiveDropdownIdx] = useState(null); // Active 3-dot dropdown index
  const [openPresetIdx, setOpenPresetIdx] = useState(null); // Selected item row index opening preset materials dropdown

  const [selectedPOs, setSelectedPOs] = useState([]);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSelectAll = (e, items) => {
    if (e.target.checked) {
      setSelectedPOs(items.map(po => po.poNo));
    } else {
      setSelectedPOs([]);
    }
  };

  const handleSelectRow = (poNo) => {
    if (selectedPOs.includes(poNo)) {
      setSelectedPOs(selectedPOs.filter(item => item !== poNo));
    } else {
      setSelectedPOs([...selectedPOs, poNo]);
    }
  };

  const getPoStage = (po) => {
    if (!po) return 'Draft';
    const s = String(po.status || '').trim();
    const st = String(po.statusType || '').toLowerCase();
    const ost = String(po.order_status || '').toLowerCase();
    if (s === 'REJECTED' || st === 'rejected') return 'REJECTED';
    if (s === 'CANCELLED' || s === 'Cancelled' || st === 'cancelled') return 'CANCELLED';

    const totOrd = Number(po.totalOrderedQty || (Array.isArray(po.items) ? po.items.reduce((sum, it) => sum + Number(it.qty || it.quantity || 0), 0) : 0));
    const totRec = Number(po.totalReceivedQty || po.totalReceived || (Array.isArray(po.items) ? po.items.reduce((sum, it) => sum + Number(it.previouslyReceived || 0), 0) : 0));
    if (totOrd > 0 && totRec > 0 && totRec < totOrd) {
      return 'PARTIALLY_RECEIVED';
    }
    if ((s.toUpperCase().includes('PARTIAL') || st.includes('partial')) && totRec > 0) {
      return 'PARTIALLY_RECEIVED';
    }

    if (s.includes('CLOSED') || st === 'closed' || s.includes('FULLY RECEIVED') || (totOrd > 0 && totRec >= totOrd)) return 'CLOSED';
    if (s.toLowerCase().includes('proceed') || st.includes('proceed') || ost.includes('proceed') || Boolean(po.proceedDetails)) return 'PROCEED_PO';
    if (s.toLowerCase().includes('payment') || st.includes('payment') || ost.includes('payment') || Boolean(po.paymentDetails)) return 'PAYMENT_PROCESSED';
    if (s === 'MD Approved' || st === 'md_approved' || ost.includes('approved') || Boolean(po.approvedBy)) return 'MD_APPROVED';
    if (s.toUpperCase() === 'DRAFT' || (!s && st === 'draft')) return 'PURE_DRAFT';
    return 'Draft';
  };

  const [statusFilter, setStatusFilter] = useState('All');
  const [kpiFilterMeta, setKpiFilterMeta] = useState(() => {
    try {
      const saved = sessionStorage.getItem('controlroom_po_initial_date_filter');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.targetKeys && Array.isArray(parsed.targetKeys)) {
          return {
            targetKeys: new Set(parsed.targetKeys.map(k => String(k || '').trim().toLowerCase())),
            periodLabel: parsed.periodLabel || 'Overview',
            sourceLabel: parsed.sourceLabel || '',
            count: parsed.count ?? parsed.targetKeys.length
          };
        }
      }
    } catch (_) {}
    return null;
  });

  const [filterDate, setFilterDate] = useState(() => {
    try {
      const saved = sessionStorage.getItem('controlroom_po_initial_date_filter');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.start || '';
      }
    } catch (_) {}
    return '';
  });

  const [filterEndDate, setFilterEndDate] = useState(() => {
    try {
      const saved = sessionStorage.getItem('controlroom_po_initial_date_filter');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.end || '';
      }
    } catch (_) {}
    return '';
  });

  const [poTab, setPoTab] = useState('All');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortDirection, setSortDirection] = useState('desc'); // 'desc' (latest PO first) or 'asc'

  useEffect(() => {
    const handleFilterDate = (e) => {
      if (e?.detail) {
        if (e.detail.startDate !== undefined) setFilterDate(e.detail.startDate || '');
        if (e.detail.endDate !== undefined) setFilterEndDate(e.detail.endDate || '');
        if (e.detail.targetKeys && Array.isArray(e.detail.targetKeys)) {
          setKpiFilterMeta({
            targetKeys: new Set(e.detail.targetKeys.map(k => String(k || '').trim().toLowerCase())),
            periodLabel: e.detail.periodLabel || 'Overview',
            sourceLabel: e.detail.sourceLabel || '',
            count: e.detail.count ?? e.detail.targetKeys.length
          });
          setPoTab('All');
        }
        setCurrentPage(1);
      }
    };
    window.addEventListener('controlroom_po_filter_date', handleFilterDate);
    return () => window.removeEventListener('controlroom_po_filter_date', handleFilterDate);
  }, []);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setFilterDate('');
    setFilterEndDate('');
    setPoTab('All');
    setCurrentPage(1);
    setSortDirection('desc');
    setKpiFilterMeta(null);
    try {
      sessionStorage.removeItem('controlroom_po_initial_date_filter');
    } catch (_) {}
  };

  const {
    poList,
    setPoList,
    tableLoading,
    setTableLoading,
    isRefreshing,
    setIsRefreshing,
    zohoVendors,
    setZohoVendors,
    zohoItems,
    setZohoItems,
    fetchZohoPOs,
    handleManualRefresh
  } = usePoDataSync({ getPoStage });

  useEffect(() => {
    if (targetPoNo && poList.length > 0) {
      const normalize = (str) => String(str || '').replace(/[/_\-\s]/g, '').toLowerCase();
      const targetClean = normalize(targetPoNo);

      // Exact match after normalization
      const found = poList.find(p => {
        const pNoClean = normalize(p.poNo);
        const pIdClean = normalize(p.id);
        return pNoClean === targetClean || pIdClean === targetClean;
      });

      if (found) {
        handleStartView(found);
      } else {
        setSearchQuery(targetPoNo);
      }

      if (clearTargetPo) clearTargetPo();
    }
  }, [targetPoNo, poList, clearTargetPo]);

  // Handle targetPoTab (e.g. from header "Approve PO" button to immediately show Draft / Pending Approval tab)
  useEffect(() => {
    if (targetPoTab) {
      setViewMode('list');
      setPoTab(targetPoTab);
      setCurrentPage(1);
      if (clearTargetPoTab) clearTargetPoTab();
    }
  }, [targetPoTab, clearTargetPoTab]);

  // Handle pending reorder PO items payload automatically transferred from Material Reorder
  useEffect(() => {
    try {
      const savedPending = localStorage.getItem('controlroom_pending_reorder_po');
      if (savedPending) {
        const parsed = JSON.parse(savedPending);
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          setEditIdx(null);
          setItems(parsed.items);
          setViewMode('create');
          const todayStr = new Date().toISOString().split('T')[0];
          setPoDate(todayStr);
          
          fetch('/api/next-po-number')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data && data.nextPoNumber) {
                setPoNumber(data.nextPoNumber);
              }
            })
            .catch(err => console.error("Error fetching next PO number for reorder:", err));

          localStorage.removeItem('controlroom_pending_reorder_po');
        }
      }
    } catch (e) {
      console.error('Error parsing controlroom_pending_reorder_po payload:', e);
    }
  }, []);

  // Form Fields State (Start Fresh / Empty)
  const [vendorName, setVendorName] = useState('');
  const [branch, setBranch] = useState('VRM Structures India Pvt Ltd');
  const [companyLocation, setCompanyLocation] = useState('VRM Structures India Pvt Ltd');
  const [contactPerson, setContactPerson] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [email, setEmail] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [deliveryType, setDeliveryType] = useState('Organization'); // 'Organization' | 'Customer'
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCompanyName, setDeliveryCompanyName] = useState('VRM Structures India Pvt Ltd');
  const [deliveryAddress1, setDeliveryAddress1] = useState('');
  const [deliveryAddress2, setDeliveryAddress2] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [deliveryPincode, setDeliveryPincode] = useState('');

  const [billingAddress, setBillingAddress] = useState('');
  const [billingAddress1, setBillingAddress1] = useState('');
  const [billingAddress2, setBillingAddress2] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingPincode, setBillingPincode] = useState('');
  const [sameAsDelivery, setSameAsDelivery] = useState(false);
  const [deliveryLocationId, setDeliveryLocationId] = useState('registered_office');
  const [billingLocationId, setBillingLocationId] = useState('registered_office');

  const currentVendorObj = useMemo(() => {
    return zohoVendors.find(v => v.name === vendorName) || null;
  }, [zohoVendors, vendorName]);

  const vendorLocations = useMemo(() => {
    return getVendorLocations(currentVendorObj);
  }, [currentVendorObj]);

  // PO details
  const [poNumber, setPoNumber] = useState('');
  const [poDate, setPoDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [advancePaidPct, setAdvancePaidPct] = useState('40');
  const [purchaser, setPurchaser] = useState(loggedInUserName);
  const [purchaserMode, setPurchaserMode] = useState('dropdown'); // 'dropdown' or 'type'
  const [shipmentPref, setShipmentPref] = useState('Transport');
  const [currency, setCurrency] = useState('INR - Indian Rupee');
  const [project, setProject] = useState('');
  const [priority, setPriority] = useState('High');
  const [scope, setScope] = useState('Vendor Scope');
  const [transportName, setTransportName] = useState('');
  const [viewingPoStatus, setViewingPoStatus] = useState('');

  // Items State (Dynamic array - start fresh empty)
  const [items, setItems] = useState([]);

  // Bulk Items Modal State (Zoho Books Style)
  const [showBulkItemModal, setShowBulkItemModal] = useState(false);
  const [showCreateProductModal, setShowCreateProductModal] = useState(false);
  const [bulkItemSearch, setBulkItemSearch] = useState('');
  const [selectedBulkItems, setSelectedBulkItems] = useState({}); // { [itemKey]: { item, qty: 1 } }
  const [bulkCategoryFilter, setBulkCategoryFilter] = useState('All');

  const handleProductCreatedFromModal = (newProduct) => {
    if (!newProduct) return;
    setZohoItems(prev => [newProduct, ...(prev || []).filter(i => (i.code || i.sku || i.name) !== (newProduct.code || newProduct.sku || newProduct.name))]);
    setItems(prev => {
      const row = {
        name: newProduct.name,
        description: newProduct.description || '',
        account: newProduct.category === 'Raw Material' ? 'Raw Material' : 'Finished Goods',
        qty: 1,
        unit: (newProduct.unit || 'NOS').toUpperCase(),
        rate: Number(newProduct.purchaseRate || newProduct.rate) || 0,
        tax: Number(newProduct.tax !== undefined ? newProduct.tax : 18)
      };
      if (prev.length > 0 && !prev[prev.length - 1].name) {
        const copy = [...prev];
        copy[copy.length - 1] = row;
        return copy;
      }
      return [...prev, row];
    });
  };

  const availableCatalogItems = useMemo(() => {
    const map = new Map();
    const addItem = (it) => {
      if (!it || !it.name) return;
      const name = String(it.name || '').trim();
      if (!name || /^\d{10,}$/.test(name)) return;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: it.id || it.itemId || name,
          name: it.name,
          sku: it.sku || it.code || it.itemCode || '',
          description: it.description || '',
          account: it.account || 'Raw Material',
          unit: (it.unit || it.uom || 'NOS').toUpperCase(),
          rate: Number(it.rate || it.purchaseRate || it.salesRate) || 0,
          tax: it.tax !== undefined && it.tax !== '' ? Number(it.tax) : 18
        });
      }
    };

    // 1. Items from Zoho Books / Backend Items Directory (/api/items)
    (zohoItems || []).forEach(addItem);

    // 2. Fallback to localStorage controlroom_item_store
    try {
      const raw = localStorage.getItem('controlroom_item_store') || localStorage.getItem('item_store');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) parsed.forEach(addItem);
      }
    } catch (_) {}

    // 3. Fallback to centralInventoryStore
    try {
      const centralItems = centralInventoryStore.getItems();
      if (Array.isArray(centralItems)) centralItems.forEach(addItem);
    } catch (_) {}

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [zohoItems]);

  const filteredBulkCatalog = useMemo(() => {
    const q = bulkItemSearch.trim().toLowerCase();
    return availableCatalogItems.filter(it => {
      const matchesSearch = !q ||
        it.name.toLowerCase().includes(q) ||
        (it.sku && it.sku.toLowerCase().includes(q)) ||
        (it.description && it.description.toLowerCase().includes(q)) ||
        (it.account && it.account.toLowerCase().includes(q));
      const matchesCat = bulkCategoryFilter === 'All' || it.account === bulkCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [availableCatalogItems, bulkItemSearch, bulkCategoryFilter]);

  // Pricing Charges
  const [shippingCharges, setShippingCharges] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);

  // Set / Pack Kit Groups State
  const [presetGroups, setPresetGroups] = useState({});
  const [showCreateSetModal, setShowCreateSetModal] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetUnit, setNewSetUnit] = useState('MT');
  const [newSetCount, setNewSetCount] = useState(1);
  const [newSetPrice, setNewSetPrice] = useState('');
  const [newSetGstRate, setNewSetGstRate] = useState('18%');

  // Attachments files list
  const [attachedFiles, setAttachedFiles] = useState([]);

  // Notes & T&C
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [useDefaultTerms, setUseDefaultTerms] = useState(false);
  const [selectedTermsPreset, setSelectedTermsPreset] = useState('');

  // Approval
  const [approvalRequired, setApprovalRequired] = useState('Yes');
  const [approver, setApprover] = useState('Velmurugan Rathinam (CEO)');
  const [approvalPriority, setApprovalPriority] = useState('High');

  // PDF Uploader State (Mock)
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const uploadTimerRef = useRef(null);
  const [isParsingPoPdf, setIsParsingPoPdf] = useState(false);
  const poPdfInputRef = useRef(null);
  const [validationErrorModal, setValidationErrorModal] = useState(null);
  const [customAlert, setCustomAlert] = useState(null);

  const handleUploadPoPdfFile = async (e) => {
    return uploadAndParsePoPdf(e, {
      showCustomAlert,
      setIsParsingPoPdf,
      zohoVendors,
      handleVendorChange,
      setVendorName,
      setGstNo,
      setContactPerson,
      setContactNo,
      setEmail,
      setPoDate,
      setDeliveryDate,
      setPaymentTerms,
      setAdvancePaidPct,
      setDeliveryAddress,
      setDeliveryAddress1,
      setDeliveryAddress2,
      setDeliveryCity,
      setDeliveryState,
      setDeliveryPincode,
      setBillingAddress,
      setBillingAddress1,
      setBillingAddress2,
      setBillingCity,
      setBillingState,
      setBillingPincode,
      setNotes,
      setTerms,
      setShippingCharges,
      setItems,
      availableCatalogItems,
      setDiscountPct,
      poNumber
    });
  };

  useEffect(() => {
    if (customAlert) {
      const timer = setTimeout(() => {
        setCustomAlert(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [customAlert]);

  const showCustomAlert = (msg, title = null, type = null) => {
    let detectedType = type;
    let detectedTitle = title;
    const strMsg = String(msg || '');

    if (!detectedType) {
      if (strMsg.includes('⚠️') || strMsg.toLowerCase().includes('mandatory') || strMsg.toLowerCase().includes('warning') || strMsg.toLowerCase().includes('reason')) {
        detectedType = 'warning';
        if (!detectedTitle) detectedTitle = 'Attention Required';
      } else if (strMsg.includes('✅') || strMsg.toLowerCase().includes('success') || strMsg.toLowerCase().includes('approved')) {
        detectedType = 'success';
        if (!detectedTitle) detectedTitle = 'Action Successful';
      } else {
        detectedType = 'info';
        if (!detectedTitle) detectedTitle = 'Purchase Order Notice';
      }
    }

    const cleanMsg = strMsg.replace(/^[✅⚠️]\s*/, '');
    setCustomAlert({
      title: detectedTitle || 'Notification',
      message: cleanMsg,
      type: detectedType || 'info'
    });
  };

  const alert = (msg, title, type) => showCustomAlert(msg, title, type);

  const startMockUpload = (file) => {
    setIsUploading(true);
    setUploadProgress(0);
    let prog = 0;
    uploadTimerRef.current = setInterval(() => {
      prog += 20;
      if (prog >= 100) {
        prog = 100;
        clearInterval(uploadTimerRef.current);
        setIsUploading(false);
        setAttachedFiles([...attachedFiles, { name: file.name, size: (file.size / 1024).toFixed(0) + ' KB' }]);
      }
      setUploadProgress(prog);
    }, 150);
  };

  // Recalculations
  const getSubTotal = () => {
    const standaloneSum = items.reduce((sum, item) => {
      if (item.isPresetItem && item.presetGroupId) return sum;
      return sum + (Number(item.qty || 0) * Number(item.rate || 0));
    }, 0);
    const activeGroupIds = new Set(items.filter(it => it.isPresetItem && it.presetGroupId).map(it => it.presetGroupId));
    let setsSum = 0;
    activeGroupIds.forEach((gid) => {
      const grp = presetGroups[gid];
      if (grp) {
        setsSum += Number(grp.kitPrice || 0) * (Number(grp.setCount) || 1);
      }
    });
    return standaloneSum + setsSum;
  };
  const getDiscount = () => {
    return getSubTotal() * (Number(discountPct || 0) / 100);
  };
  const getTaxableAmount = () => {
    return getSubTotal() - getDiscount();
  };
  const getCGST = () => {
    const factor = (100 - Number(discountPct || 0)) / 100;
    const standaloneTax = items.reduce((sum, item) => {
      if (item.isPresetItem && item.presetGroupId) return sum;
      const itemTaxable = (Number(item.qty || 0) * Number(item.rate || 0)) * factor;
      const itemTaxPct = Number(item.tax !== undefined && item.tax !== '' ? item.tax : 18);
      return sum + (itemTaxable * (itemTaxPct / 100));
    }, 0);
    const activeGroupIds = new Set(items.filter(it => it.isPresetItem && it.presetGroupId).map(it => it.presetGroupId));
    let setsTax = 0;
    activeGroupIds.forEach((gid) => {
      const grp = presetGroups[gid];
      if (grp) {
        const grpTaxable = (Number(grp.kitPrice || 0) * (Number(grp.setCount) || 1)) * factor;
        const grpTaxPct = extractGstRate(grp.gstRate, 18);
        setsTax += grpTaxable * (grpTaxPct / 100);
      }
    });
    return Math.round(((standaloneTax + setsTax) / 2) * 100) / 100;
  };
  const getSGST = () => {
    return getCGST();
  };
  const getGrandTotal = () => {
    return getTaxableAmount() + getCGST() + getSGST() + Number(shippingCharges || 0) + Number(otherCharges || 0);
  };
  const getEffectiveCGSTPct = () => {
    const taxable = getTaxableAmount();
    if (taxable <= 0) return 2.5;
    const pct = (getCGST() / taxable) * 100;
    return Number(pct.toFixed(2));
  };
  const getEffectiveSGSTPct = () => {
    const taxable = getTaxableAmount();
    if (taxable <= 0) return 2.5;
    const pct = (getSGST() / taxable) * 100;
    return Number(pct.toFixed(2));
  };

  const handleAddItem = () => {
    setItems([...items, { name: '', hsn: '', account: 'Raw Materials', qty: 1, unit: 'MT', rate: 0, tax: 18 }]);
  };

  const handleRemoveItem = (idx) => {
    setItems(prev => {
      const target = (prev || [])[idx];
      const remaining = (prev || []).filter((_, i) => i !== idx);
      if (target && target.presetGroupId) {
        const stillHas = remaining.some(it => it.presetGroupId === target.presetGroupId);
        if (!stillHas) {
          setPresetGroups(pg => {
            const copy = { ...pg };
            delete copy[target.presetGroupId];
            return copy;
          });
        }
      }
      return remaining;
    });
  };

  const handleCreateCustomSet = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanName = (newSetName || '').trim() || `Custom Set ${Object.keys(presetGroups || {}).length + 1}`;
    const unit = newSetUnit || 'MT';
    const count = unit === 'kW' ? Math.max(0.01, parseFloat(newSetCount) || 1) : Math.max(1, parseInt(newSetCount, 10) || 1);
    const groupId = 'po_set_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const setGst = newSetGstRate || '18%';
    const taxNum = extractGstRate(setGst, 18);

    setPresetGroups(prev => ({
      ...prev,
      [groupId]: {
        groupId,
        presetName: cleanName,
        setCount: count,
        unit,
        kitPrice: newSetPrice ? String(newSetPrice) : '',
        gstRate: setGst,
        isCustomSet: true
      }
    }));

    setItems(prev => ([
      ...(prev || []),
      {
        name: '',
        description: '',
        hsn: '',
        account: 'Raw Materials',
        qty: 1,
        unit: unit === 'kW' ? 'kW' : 'NOS',
        rate: 0,
        tax: taxNum,
        isPresetItem: true,
        presetGroupId: groupId,
        presetName: cleanName
      }
    ]));

    setNewSetName('');
    setNewSetCount(1);
    setNewSetUnit('MT');
    setNewSetPrice('');
    setNewSetGstRate('18%');
    setShowCreateSetModal(false);
  };

  const handleAddSetItem = (groupId) => {
    const grp = presetGroups[groupId];
    if (!grp) return;
    const taxNum = extractGstRate(grp.gstRate, 18);
    const newRow = {
      name: '',
      description: '',
      hsn: '',
      account: 'Raw Materials',
      qty: 1,
      unit: grp.unit === 'kW' ? 'kW' : 'NOS',
      rate: 0,
      tax: taxNum,
      isPresetItem: true,
      presetGroupId: groupId,
      presetName: grp.presetName
    };
    setItems(prev => {
      const arr = [...(prev || [])];
      let lastIdx = -1;
      arr.forEach((it, idx) => {
        if (it.presetGroupId === groupId) lastIdx = idx;
      });
      if (lastIdx >= 0) {
        arr.splice(lastIdx + 1, 0, newRow);
        return arr;
      }
      return [...arr, newRow];
    });
  };

  const handleRemovePresetGroup = (groupId) => {
    setItems(prev => (prev || []).filter(it => it.presetGroupId !== groupId));
    setPresetGroups(prev => {
      const copy = { ...prev };
      delete copy[groupId];
      return copy;
    });
  };

  const handleUpdateGroupKitPrice = (groupId, val) => {
    setPresetGroups(prev => {
      const grp = prev[groupId];
      if (!grp) return prev;
      return { ...prev, [groupId]: { ...grp, kitPrice: val } };
    });
  };

  const handleItemChange = (idx, field, val) => {
    setItems(prev => (prev || []).map((it, i) => i === idx ? { ...it, [field]: val } : it));
  };

  const handleVendorChange = (val, vendorObj) => {
    setVendorName(val);
    const found = vendorObj || (zohoVendors || []).find(v => (v.name || '').trim().toLowerCase() === (val || '').trim().toLowerCase());
    if (found) {
      setContactPerson(found.contact || found.contactPerson || '');
      setContactNo(found.phone || found.mobile || '');
      setEmail(found.email || '');
      setGstNo(found.gstin || found.gstNo || '33ABCDE1234F1Z5');
      const vLocs = getVendorLocations(found);
      if (vLocs.length > 0) {
        const reg = vLocs.find(l => l.id === 'registered_office') || vLocs[0];
        setBillingLocationId(reg.id);
        setBillingAddress1(reg.address1 || '');
        setBillingAddress2(reg.address2 || '');
        setBillingCity(reg.city || '');
        setBillingState(reg.state || '');
        setBillingPincode(reg.pincode || '');
        setBillingAddress(formatAddressObj(reg));
      } else {
        const vAddr = found.billingAddress || found.address || found.registeredAddress || `${val}, Main Road, Industrial Estate, Tamil Nadu - 600028`;
        setBillingAddress(vAddr);
        const parsedV = parseAddressString(vAddr);
        setBillingAddress1(found.billingAddress1 || found.address1 || parsedV.address1 || '');
        setBillingAddress2(found.billingAddress2 || found.address2 || parsedV.address2 || '');
        setBillingCity(found.billingCity || found.city || parsedV.city || '');
        setBillingState(found.billingState || found.state || parsedV.state || '');
        setBillingPincode(found.billingPincode || found.pincode || parsedV.pincode || '');
      }
    }
  };

  const [formErrors, setFormErrors] = useState({});
  const [rejectingPo, setRejectingPo] = useState(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [cancellingPo, setCancellingPo] = useState(null);
  const [cancellationRemarkInput, setCancellationRemarkInput] = useState('');
  const [approvingPo, setApprovingPo] = useState(null);
  const [approvalRemarksInput, setApprovalRemarksInput] = useState('');

  // Payment Processing & Credit Verification Modal states (supports up to 4 payment proof images)
  const [paymentProcessingPo, setPaymentProcessingPo] = useState(null);
  const [payModeInput, setPayModeInput] = useState('Bank Transfer');
  const [payRefInput, setPayRefInput] = useState('');
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payRemarksInput, setPayRemarksInput] = useState('');
  const [payCreditTermsInput, setPayCreditTermsInput] = useState('Net 30 Days');
  const [payImagesInput, setPayImagesInput] = useState([]);
  const [payImageInput, setPayImageInput] = useState(null);
  const [payImageMeta, setPayImageMeta] = useState(null);
  const [creditAlertPopup, setCreditAlertPopup] = useState(null);
  const [previewZoomImage, setPreviewZoomImage] = useState(null);

  // Proceed PO Confirmation Modal state (with pre-formatted WhatsApp & Email message preview)
  const [proceedingPo, setProceedingPo] = useState(null);
  const [proceedRemarksInput, setProceedRemarksInput] = useState('');
  const [proceedEmailInput, setProceedEmailInput] = useState('');
  const [proceedPhoneInput, setProceedPhoneInput] = useState('');
  const [proceedMessageContent, setProceedMessageContent] = useState('');

  const getMissingPoFields = (isDraft = false) => {
    return getMissingPoFieldsHelper(isDraft, {
      vendorName, deliveryAddress1, deliveryAddress2, deliveryCity,
      deliveryState, deliveryPincode, deliveryAddress, poDate, deliveryDate,
      paymentTerms, purchaser, shipmentPref, currency, priority, items
    });
  };

  const triggerSaveConfirm = (e) => {
    if (e) e.preventDefault();
    if (isSubmittingPO) return;
    const missingFields = getMissingPoFields(false);
    if (missingFields.length > 0) {
      setValidationErrorModal({ fields: missingFields });
      return;
    }
    setShowSaveConfirm(true);
  };

  const executeCreatePO = (e, targetStatus = 'Draft / Pending Approval') => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmittingPO) return;
    setIsSubmittingPO(true);

    const statusToSave = typeof targetStatus === 'string' ? targetStatus : 'Draft / Pending Approval';
    const isDraft = statusToSave === 'Draft' || statusToSave === 'DRAFT';

    // Validate mandatory fields marked with red asterisk *
    const missingFields = getMissingPoFields(isDraft);
    const effDelAddress = formatAddressObj({ address1: deliveryAddress1, address2: deliveryAddress2, city: deliveryCity, state: deliveryState, pincode: deliveryPincode }) || (deliveryAddress || '').trim();
    const effBillAddress = formatAddressObj({ address1: billingAddress1, address2: billingAddress2, city: billingCity, state: billingState, pincode: billingPincode }) || (billingAddress || '').trim();
    const validItems = (items || []).filter(it => it && String(it.name || '').trim() !== '' && Number(it.qty) > 0);

    if (missingFields.length > 0) {
      setIsSubmittingPO(false);
      setValidationErrorModal({ fields: missingFields });
      return;
    }

    let effectiveItems = validItems.map(it => ({
      name: String(it.name || it.itemName || '').trim(),
      description: String(it.description || it.desc || '').trim(),
      hsn: String(it.hsn || it.hsn_or_sac || it.hsnCode || (it.name ? getHsnCode(it) : '') || '').trim(),
      account: it.account || 'Cost of Goods Sold',
      qty: Number(it.qty || 1),
      unit: it.unit || 'NOS',
      rate: Number(it.rate) > 0 ? Number(it.rate) : 0,
      tax: (it.tax !== undefined && it.tax !== '' && !isNaN(Number(it.tax))) ? Number(it.tax) : 18,
      sku: it.sku || '',
      ...(it.isPresetItem ? { isPresetItem: true, presetGroupId: it.presetGroupId || '', presetName: it.presetName || '' } : {})
    }));

    setFormErrors({});
    const statusTypeToSave = isDraft ? 'draft' : (statusToSave === 'WAITING FOR APPROVAL' ? 'pending' : 'approved');

    const today = new Date();
    const formatPoDate = (rawDate) => {
      if (!rawDate) return '';
      try {
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return rawDate;
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch (_) {
        return rawDate;
      }
    };
    const formattedDate = formatPoDate(poDate) || today.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const formatDelivery = deliveryDate ? new Date(deliveryDate).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }) : 'Immediate';

    const safePoNo = poNumber ? String(poNumber).toUpperCase() : '';
    const safeGstNo = gstNo ? String(gstNo).toUpperCase() : 'N/A';

    const existingSelectedPo = (editIdx !== null && poList[editIdx]) ? poList[editIdx] : null;
    const assignedId = existingSelectedPo ? (existingSelectedPo.id || existingSelectedPo.zohoId || safePoNo) : (safePoNo || ('PO-' + String(poList.length + 1).padStart(5, '0')));
    const assignedZohoId = existingSelectedPo ? (existingSelectedPo.zohoId || existingSelectedPo.id) : undefined;

    const compProfile = getCompanyProfile(companyLocation || branch);

    const newPO = {
      id: assignedId,
      zohoId: assignedZohoId,
      poNo: safePoNo || ('PO-' + String(poList.length + 1).padStart(5, '0')),
      vendor: vendorName || 'Fresh Vendor',
      branch: branch || companyLocation || 'VRM Structures India Pvt Ltd',
      companyLocation: companyLocation || branch || 'VRM Structures India Pvt Ltd',
      companyName: compProfile.name,
      companyAddress: compProfile.address,
      companyGst: compProfile.gst,
      contactPerson: contactPerson || '',
      contactNo: contactNo || '',
      email: email || '',
      gstNo: safeGstNo,
      deliveryType: deliveryType,
      deliveryAddress: (effDelAddress || '').trim(),
      deliveryAddress1: (deliveryAddress1 || '').trim(),
      deliveryAddress2: (deliveryAddress2 || '').trim(),
      deliveryCity: (deliveryCity || '').trim(),
      deliveryState: (deliveryState || '').trim(),
      deliveryPincode: (deliveryPincode || '').trim(),
      deliveryAddressObj: {
        address1: (deliveryAddress1 || '').trim(),
        address2: (deliveryAddress2 || '').trim(),
        city: (deliveryCity || '').trim(),
        state: (deliveryState || '').trim(),
        pincode: (deliveryPincode || '').trim()
      },
      deliveryCompanyName: (deliveryCompanyName || '').trim(),
      billingAddress: (effBillAddress || '').trim(),
      billingAddress1: (billingAddress1 || '').trim(),
      billingAddress2: (billingAddress2 || '').trim(),
      billingCity: (billingCity || '').trim(),
      billingState: (billingState || '').trim(),
      billingPincode: (billingPincode || '').trim(),
      billingAddressObj: {
        address1: (billingAddress1 || '').trim(),
        address2: (billingAddress2 || '').trim(),
        city: (billingCity || '').trim(),
        state: (billingState || '').trim(),
        pincode: (billingPincode || '').trim()
      },
      poDate: formattedDate,
      date: formattedDate,
      rawPoDate: poDate || (editIdx !== null && poList[editIdx]?.rawPoDate) || new Date().toISOString().split('T')[0],
      createdAt: (editIdx !== null && (poList[editIdx]?.createdAt || poList[editIdx]?.created_at)) || new Date().toISOString(),
      deliveryDate: formatDelivery,
      paymentTerms: paymentTerms || 'Due on Receipt',
      advancePaidPct: paymentTerms === 'Advance' ? Math.min(100, Math.max(0, Number(advancePaidPct || 0))) : null,
      advancePendingPct: paymentTerms === 'Advance' ? Math.max(0, 100 - Math.min(100, Math.max(0, Number(advancePaidPct || 0)))) : null,
      purchaser: purchaser || loggedInUserName,
      shipmentPref: shipmentPref,
      currency: currency,
      project: project,
      priority: priority,
      scope: scope,
      transportName: shipmentPref === 'Transport' ? transportName : '',
      items: effectiveItems,
      presetGroups: presetGroups,
      shippingCharges: shippingCharges,
      otherCharges: otherCharges,
      discountPct: discountPct,
      notes: notes,
      terms: terms,
      approvalRequired: approvalRequired,
      approver: approver,
      approvalPriority: approvalPriority,
      amount: '₹' + getGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      status: statusToSave,
      statusType: statusTypeToSave,
      pdfName: attachedFiles[0] ? attachedFiles[0].name : 'purchase_order.pdf'
    };

    // Save immediately to local & Supabase cloud store so PO is preserved permanently
    savePurchaseOrder(newPO);

    const syncPOToServer = async (isEdit) => {
      try {
        const actorEmp = (typeof localStorage !== 'undefined' ? localStorage.getItem('controlroom_logged_emp_id') : '') || '';
        const actorName = (typeof localStorage !== 'undefined' ? localStorage.getItem('controlroom_logged_user_name') : '') || loggedInUserName || 'Procurement';
        const actorRole = (typeof localStorage !== 'undefined' ? localStorage.getItem('controlroom_user_role') : '') || 'Procurement';

        const res = await fetch('/api/purchaseorders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-employee-code': actorEmp,
            'x-user-name': actorName,
            'x-user-role': actorRole
          },
          body: JSON.stringify({
            ...newPO,
            actorEmpCode: actorEmp,
            actorName,
            actorRole
          })
        });

        // Trigger real-time notification to CEO for review & approval (never for Drafts)
        if (!isDraft && (newPO.status === 'Draft / Pending Approval' || newPO.statusType === 'pending' || String(newPO.approvalRequired).toUpperCase() === 'YES')) {
          notifyPoSentForApproval({
            poNo: newPO.poNo,
            vendor: newPO.vendor,
            amount: newPO.amount,
            purchaser: newPO.purchaser || loggedInUserName
          });
        }

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.success && data.po) {
            const mergedSavedPO = {
              ...newPO,
              ...data.po,
              id: newPO.id || data.po.id,
              zohoId: data.po.zohoId || data.po.id || newPO.zohoId,
              vendor: newPO.vendor,
              deliveryAddress: newPO.deliveryAddress,
              billingAddress: newPO.billingAddress,
              paymentTerms: newPO.paymentTerms,
              notes: newPO.notes,
              terms: newPO.terms,
              priority: newPO.priority,
              scope: newPO.scope,
              transportName: newPO.transportName,
              shippingCharges: newPO.shippingCharges,
              otherCharges: newPO.otherCharges,
              discountPct: newPO.discountPct,
              purchaser: newPO.purchaser,
              items: (newPO.items && newPO.items.length > 0) ? newPO.items : (data.po.items || [])
            };
            setPoList(prev => prev.map(p => (p.poNo === newPO.poNo || p.id === newPO.id) ? { ...p, ...mergedSavedPO } : p));
            savePurchaseOrder(mergedSavedPO);
            showCustomAlert(data.message || 'Purchase Order created successfully in BUSINZ!', 'PO Created', 'success');
          } else if (data.message) {
            showCustomAlert(data.message, 'Notice', 'warning');
          }
        } else {
          // Live web server returned HTML (static SPA or 404/502). PO is safely stored in local & cloud.
          showCustomAlert('Purchase Order saved securely in Businz! (Server sync pending)', 'PO Saved', 'success');
        }
      } catch (err) {
        console.warn('Backend sync warning (saved locally):', err);
        showCustomAlert('Purchase Order saved securely in Businz! (Server sync pending)', 'PO Saved', 'success');
      } finally {
        setIsSubmittingPO(false);
      }
    };

    if (editIdx !== null) {
      const updated = [...poList];
      updated[editIdx] = newPO;
      setPoList(updated);
      setEditIdx(null);
      syncPOToServer(true);
    } else {
      setPoList(prev => [newPO, ...prev]);
      syncPOToServer(false);
    }

    setShowSaveConfirm(false);
    resetForm();
    setPoTab('All');
    setStatusFilter('All');
    setCurrentPage(1);
    setViewMode('list');
  };

  const handleApprovePoSubmit = (poTarget) => {
    if (!poTarget) return;
    const poId = poTarget.poNo || poTarget.id;

    // Immediately reflect MD Approved state in the currently active view
    const approveNow = new Date();
    setViewingPoStatus('MD Approved');
    const updatedApprovedPo = { 
      ...poTarget, 
      status: 'MD Approved', 
      statusType: 'md_approved',
      approvedBy: 'Velmurugan Rathinam (MD)',
      approvedAt: approveNow.toISOString(),
      approvedDate: approveNow.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }),
      approvedTime: approveNow.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
      approvalRemarks: approvalRemarksInput || 'Approved by MD'
    };
    setPoList(prev => prev.map(p => {
      if (p.poNo === poId || p.id === poId) {
        return { ...p, ...updatedApprovedPo };
      }
      return p;
    }));
    savePurchaseOrder(updatedApprovedPo);

    fetch(`/api/purchaseorders/${encodeURIComponent(poId)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        remarks: approvalRemarksInput || 'Approved by MD',
        approver: 'Velmurugan Rathinam (MD)'
      })
    })
      .then(res => (res.ok && res.headers.get('content-type')?.includes('application/json')) ? res.json() : null)
      .then(() => {
        setApprovingPo(null);
        setApprovalRemarksInput('');
        setSelectedPOs([]);
        // If executive was on the "Pending MD Approval" filter, transition tab to "Approved by MD"
        // so the PO doesn't vanish from their view!
        if (poTab === 'Draft') {
          setPoTab('MD_APPROVED');
        }
        fetchZohoPOs(true);
        showCustomAlert(`PO ${poId} approved by MD successfully! Moved to 'Approved by MD' tab and ready for Payment Process.`, 'MD Approval Completed', 'success');
      })
      .catch(() => {
        setApprovingPo(null);
        fetchZohoPOs(true);
      });
  };

  const handleOpenPaymentProcessModal = (poTarget) => {
    if (!poTarget) return;
    setPaymentProcessingPo(poTarget);
    setPayModeInput(poTarget.paymentTerms?.toLowerCase().includes('credit') || poTarget.paymentTerms?.toLowerCase().includes('net') ? 'Credit / Net Terms' : 'Bank Transfer');
    setPayRefInput('');
    setPayAmountInput(poTarget.amount ? String(poTarget.amount).replace(/[^0-9.]/g, '') : '');
    setPayRemarksInput('');
    setPayCreditTermsInput(poTarget.paymentTerms || 'Net 30 Days');

    // Multi-image initialization (supports up to 4 images)
    const existingImages = Array.isArray(poTarget.paymentDetails?.paymentImages) && poTarget.paymentDetails.paymentImages.length > 0
      ? poTarget.paymentDetails.paymentImages
      : (poTarget.paymentDetails?.paymentImage ? [{
          dataUrl: poTarget.paymentDetails.paymentImage,
          name: poTarget.paymentDetails.paymentImageMeta?.name || 'Payment_Proof.jpg',
          size: poTarget.paymentDetails.paymentImageMeta?.size || 'Attached',
          type: 'image/jpeg',
          uploadedAt: new Date().toISOString()
        }] : []);

    setPayImagesInput(existingImages);
    setPayImageInput(existingImages[0]?.dataUrl || null);
    setPayImageMeta(existingImages[0] ? { name: existingImages[0].name, size: existingImages[0].size } : null);
  };

  const handlePaymentImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 4 - payImagesInput.length;
    if (remainingSlots <= 0) {
      alert('You can upload a maximum of 4 payment proof images.');
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);

    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scaleSize = Math.min(1, MAX_WIDTH / img.width);
          canvas.width = Math.round(img.width * scaleSize);
          canvas.height = Math.round(img.height * scaleSize);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          const sizeKb = Math.round(dataUrl.length * 0.75 / 1024);

          const newImgObj = {
            name: file.name,
            size: `${sizeKb} KB`,
            type: file.type || 'image/jpeg',
            dataUrl,
            uploadedAt: new Date().toISOString()
          };

          setPayImagesInput(prev => {
            if (prev.length >= 4) return prev;
            const updated = [...prev, newImgObj];
            setPayImageInput(updated[0]?.dataUrl || null);
            setPayImageMeta(updated[0] ? { name: updated[0].name, size: updated[0].size } : null);
            return updated;
          });
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleRemovePaymentImage = (idxToRemove) => {
    setPayImagesInput(prev => {
      const updated = prev.filter((_, idx) => idx !== idxToRemove);
      setPayImageInput(updated[0]?.dataUrl || null);
      setPayImageMeta(updated[0] ? { name: updated[0].name, size: updated[0].size } : null);
      return updated;
    });
  };

  const handleProcessPaymentSubmit = async (poTarget) => {
    if (!poTarget) return;
    const poId = poTarget.poNo || poTarget.id;
    const isCredit = payModeInput === 'Credit / Net Terms';

    // Image of the payment is mandatory for all non-credit payment modes (Bank Transfer, UPI, Cheque, Advance, etc.)
    if (!isCredit && payImagesInput.length === 0 && !payImageInput) {
      alert('Payment Proof Image is mandatory. Please attach at least 1 image of the payment to complete verification.');
      return;
    }

    const clean = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const targetKey = clean(poId);

    const safeImages = payImagesInput.length > 0 
      ? payImagesInput 
      : (payImageInput ? [{ dataUrl: payImageInput, name: payImageMeta?.name || 'Payment_Proof.jpg', size: payImageMeta?.size || '' }] : []);

    const payNow = new Date();
    const updatedPaymentPo = {
      ...poTarget,
      status: 'Payment Processed',
      statusType: 'payment_processed',
      order_status: 'payment_processed',
      paymentDetails: {
        mode: payModeInput,
        refNo: payRefInput || (isCredit ? 'CREDIT-CONFIRMED' : ''),
        amount: payAmountInput ? `₹ ${Number(payAmountInput).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : poTarget.amount,
        date: payNow.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }),
        time: payNow.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }),
        paidAt: payNow.toISOString(),
        remarks: payRemarksInput || (isCredit ? 'Credit terms verified by Accounts team' : 'Payment recorded by Accounts'),
        isCredit,
        creditTerms: payCreditTermsInput,
        paymentImage: safeImages[0]?.dataUrl || null,
        paymentImageMeta: safeImages[0] ? { name: safeImages[0].name, size: safeImages[0].size } : null,
        paymentImages: safeImages,
        verifiedBy: 'Accounts Team'
      }
    };

    setPaymentProcessingPo(null);
    setPayImagesInput([]);
    setPayImageInput(null);
    setPayImageMeta(null);
    setViewingPoStatus('Payment Processed');

    // Update local state immediately with normalized matching
    setPoList(prev => prev.map(p => {
      const k1 = clean(p.poNo);
      const k2 = clean(p.id);
      const k3 = clean(p.zohoId);
      return (targetKey && (k1 === targetKey || k2 === targetKey || k3 === targetKey)) ? { ...p, ...updatedPaymentPo } : p;
    }));

    if (poTab === 'MD_APPROVED') {
      setPoTab('PAYMENT_PROCESSED');
    }

    // Persist immediately to cloud & disk
    try {
      await savePurchaseOrder(updatedPaymentPo);
    } catch (saveErr) {
      console.warn('savePurchaseOrder notice:', saveErr);
    }

    // Broadcast update to other tabs (Procurement team, etc.)
    try {
      window.dispatchEvent(new CustomEvent('controlroom_po_updated', { detail: updatedPaymentPo }));
      window.dispatchEvent(new Event('controlroom_storage_update'));
    } catch (_) {}

    // Call backend endpoint to ensure server memory & disk are updated synchronously
    try {
      await fetch(`/api/purchaseorders/${encodeURIComponent(poId)}/process-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMode: payModeInput,
          paymentRef: payRefInput || (isCredit ? 'CREDIT-CONFIRMED' : ''),
          amountPaid: payAmountInput ? `₹ ${Number(payAmountInput).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : poTarget.amount,
          remarks: payRemarksInput || (isCredit ? 'Credit terms verified by Accounts team' : 'Payment recorded by Accounts'),
          isCredit: isCredit,
          creditTerms: payCreditTermsInput,
          paymentImage: safeImages[0]?.dataUrl || null,
          paymentImageMeta: safeImages[0] ? { name: safeImages[0].name, size: safeImages[0].size } : null,
          paymentImages: safeImages
        })
      });
    } catch (e) {
      console.warn('Backend process-payment notice:', e);
    }

    if (isCredit) {
      setCreditAlertPopup({
        poNo: poId,
        vendor: poTarget.vendor,
        amount: poTarget.amount,
        terms: payCreditTermsInput
      });
    } else {
      showCustomAlert(`Payment verified and processed by Accounts for PO ${poId}. Now ready for Proceed PO.`, 'Payment Verified', 'success');
    }

    await fetchZohoPOs(true);
  };

  const handleOpenProceedPoModal = (poTarget) => {
    if (!poTarget) return;
    const cleanEmail = (poTarget.email && poTarget.email !== '—' && poTarget.email.includes('@')) 
      ? poTarget.email.trim() 
      : (email && email.includes('@') ? email.trim() : (poTarget.vendor ? `contact@${poTarget.vendor.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : ''));
    const cleanPhone = (poTarget.phone || poTarget.mobile || poTarget.vendorPhone || poTarget.contactPhone || '').trim();
    const pd = poTarget.paymentDetails;
    const allImages = Array.isArray(pd?.paymentImages) && pd.paymentImages.length > 0
      ? pd.paymentImages
      : (pd?.paymentImage ? [{ dataUrl: pd.paymentImage, name: pd.paymentImageMeta?.name || 'Payment_Proof.jpg' }] : []);

    const allAttachments = [
      ...allImages,
      ...(Array.isArray(poTarget.attachments) ? poTarget.attachments : []),
      ...(Array.isArray(poTarget.documents) ? poTarget.documents : [])
    ].filter(Boolean);
    const attachmentNamesText = allAttachments.length > 0
      ? `\n\nAttachments (${allAttachments.length}):\n${allAttachments.map((a, idx) => `- ${a?.name || a?.fileName || a?.title || `Attachment ${idx + 1}`}`).join('\n')}`
      : '';

    const senderName = loggedInUserName || poTarget.purchaser || poTarget.issuedBy || poTarget.createdBy || 'Procurement Team';

    const defaultMsg = `Dear ${poTarget.vendor || 'Vendor'},

Greetings from VRM Structures India Private Limited.

Please find the official Purchase Order ${poTarget.poNo || poTarget.id} details below:

Purchase Order Details:
- PO Number: ${poTarget.poNo || poTarget.id}
- Total Amount: ${poTarget.amount || '—'}
- Date: ${poTarget.date || new Date().toLocaleDateString('en-GB')}
- Delivery Terms: ${poTarget.deliveryTerms || 'Immediate / Standard'}${attachmentNamesText}

Please acknowledge receipt of this Purchase Order and confirm your delivery schedule.

Thank you,
${senderName} | VRM Structures India Private Limited`;

    setSelectedPOs([]);
    setProceedEmailInput(cleanEmail);
    setProceedPhoneInput(cleanPhone);
    setProceedRemarksInput('');
    setProceedMessageContent(defaultMsg);
    setProceedingPo(poTarget);
  };

  const handleSendViaWhatsApp = (poTarget) => {
    if (!poTarget) return;
    const phone = (proceedPhoneInput || '').replace(/[^0-9]/g, '');
    const cleanPhone = phone.startsWith('91') && phone.length === 12 
      ? phone 
      : (phone.length === 10 ? `91${phone}` : phone);

    const encodedText = encodeURIComponent(proceedMessageContent);
    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodedText}` 
      : `https://wa.me/?text=${encodedText}`;
    
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleProceedPoSubmit = async (poTarget) => {
    if (!poTarget) return;
    const poId = poTarget.poNo || poTarget.id;

    const now = new Date();
    const proceedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const proceedTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
    const remarks = proceedRemarksInput || 'Authorized for dispatch and GRN creation';
    const targetVendorEmail = (proceedEmailInput || poTarget.email || email || '').trim();
    const targetVendorPhone = (proceedPhoneInput || poTarget.phone || '').trim();

    const proceedDetails = {
      date: proceedDate,
      time: proceedTime,
      proceededAt: now.toISOString(),
      remarks,
      authorizedBy: 'Procurement Head',
      vendorEmail: targetVendorEmail,
      vendorPhone: targetVendorPhone,
      emailDispatched: Boolean(targetVendorEmail),
      deliveryStatus: targetVendorEmail ? `Dispatched to ${targetVendorEmail}` : 'Authorized (Ready for GRN)',
      messageContent: proceedMessageContent
    };

    const updatedProceedPo = {
      ...poTarget,
      status: 'Proceed PO',
      statusType: 'proceed_po',
      email: targetVendorEmail || poTarget.email,
      phone: targetVendorPhone || poTarget.phone,
      proceedDetails
    };

    const clean = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const targetKey = clean(poId);

    // 1. Immediately reflect 'Proceed PO' in currently active view and poList with normalized matching
    setViewingPoStatus('Proceed PO');
    setPoList(prev => prev.map(p => {
      const k1 = clean(p.poNo);
      const k2 = clean(p.id);
      const k3 = clean(p.zohoId);
      return (targetKey && (k1 === targetKey || k2 === targetKey || k3 === targetKey)) ? { ...p, ...updatedProceedPo } : p;
    }));

    if (poTab === 'PAYMENT_PROCESSED') {
      setPoTab('PROCEED_PO');
    }

    setProceedingPo(null);
    setProceedRemarksInput('');
    setProceedEmailInput('');
    setProceedPhoneInput('');
    setProceedMessageContent('');

    // 2. Persist immediately to cloud & disk
    try {
      await savePurchaseOrder(updatedProceedPo);
    } catch (saveErr) {
      console.warn('savePurchaseOrder notice:', saveErr);
    }

    try {
      window.dispatchEvent(new CustomEvent('controlroom_po_updated', { detail: updatedProceedPo }));
      window.dispatchEvent(new Event('controlroom_storage_update'));
    } catch (_) {}

    // 3. Call backend endpoint to update server memory and disk store synchronously
    try {
      await fetch(`/api/purchaseorders/${encodeURIComponent(poId)}/proceed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remarks,
          authorizedBy: 'Procurement Head',
          vendorEmail: targetVendorEmail,
          vendorPhone: targetVendorPhone
        })
      });
    } catch (e) {
      console.warn('Backend proceed notice:', e);
    }

    const alertMsg = targetVendorEmail
      ? `PO ${poId} marked as Proceed PO! An official Purchase Order copy has been dispatched to vendor (${targetVendorEmail}). Ready for GRN receiving.`
      : `PO ${poId} marked as Proceed PO! Ready for GRN receiving.`;
    showCustomAlert(alertMsg, 'Proceed PO Completed & Dispatched', 'success');

    // 4. Refetch to ensure all tabs and UI are fully synced
    await fetchZohoPOs(true);
  };

  const handleRejectPoSubmit = (poTarget) => {
    if (!poTarget) return;
    if (!rejectionReasonInput || String(rejectionReasonInput).trim() === '') {
      alert('Rejection reason is mandatory when rejecting a Purchase Order.');
      return;
    }
    const poId = poTarget.poNo || poTarget.id;

    // Immediately reflect REJECTED state in the currently active view
    setViewingPoStatus('REJECTED');
    setPoList(prev => prev.map(p => {
      if (p.poNo === poId || p.id === poId) {
        return { ...p, status: 'REJECTED', statusType: 'rejected', rejectionReason: rejectionReasonInput };
      }
      return p;
    }));

    fetch(`/api/purchaseorders/${encodeURIComponent(poId)}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: rejectionReasonInput,
        rejectedBy: 'CEO / Operations Manager'
      })
    })
      .then(res => (res.ok && res.headers.get('content-type')?.includes('application/json')) ? res.json() : null)
      .then(() => {
        setRejectingPo(null);
        setRejectionReasonInput('');
        fetchZohoPOs(true);
      })
      .catch(() => {
        setRejectingPo(null);
        fetchZohoPOs(true);
      });
  };

  const handleCancelPoSubmit = (poTarget) => {
    if (!poTarget) return;
    if (!cancellationRemarkInput || String(cancellationRemarkInput).trim() === '') {
      alert('Cancellation remark is mandatory when cancelling a Purchase Order.');
      return;
    }
    const poId = poTarget.poNo || poTarget.id;

    // Immediately reflect CANCELLED state in currently active view and list
    setViewingPoStatus('CANCELLED');
    setPoList(prev => prev.map(p => {
      if (p.poNo === poId || p.id === poId) {
        return {
          ...p,
          status: 'CANCELLED',
          statusType: 'cancelled',
          cancelReason: cancellationRemarkInput,
          cancellationRemark: cancellationRemarkInput,
          cancelledBy: userRole || 'Procurement Head'
        };
      }
      return p;
    }));

    fetch(`/api/purchaseorders/${encodeURIComponent(poId)}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: cancellationRemarkInput,
        cancelledBy: userRole || 'Procurement Head'
      })
    })
      .then(res => (res.ok && res.headers.get('content-type')?.includes('application/json')) ? res.json() : null)
      .then(() => {
        setCancellingPo(null);
        setCancellationRemarkInput('');
        setSelectedPOs([]);
        fetchZohoPOs(true);
        showCustomAlert(`Purchase Order ${poId} has been cancelled successfully.`, 'PO Cancelled', 'warning');
      })
      .catch(() => {
        setCancellingPo(null);
        setCancellationRemarkInput('');
        setSelectedPOs([]);
        fetchZohoPOs(true);
        showCustomAlert(`Purchase Order ${poId} has been cancelled successfully.`, 'PO Cancelled', 'warning');
      });
  };

  const resetForm = () => {
    try {
      sessionStorage.removeItem('controlroom_po_view_mode');
      sessionStorage.removeItem('controlroom_viewing_po');
    } catch (_) {}
    setPoTab('All');
    setSearchQuery('');
    setStatusFilter('All');
    setCurrentPage(1);
    setViewMode('list');
  };

  const populateFormStates = (po) => {
    if (!po) return;
    const formatAddress = (addr) => {
      if (!addr) return '';
      if (typeof addr === 'string') return addr;
      if (typeof addr === 'object') {
        const parts = [
          addr.address,
          addr.address1,
          addr.street2,
          addr.city,
          addr.state,
          addr.zip,
          addr.country
        ].filter(p => p && String(p).trim().length > 0);
        return parts.join(', ');
      }
      return String(addr);
    };

    let effVendor = po.vendor || po.vendor_name || '';
    let effBranch = po.branch || po.branch_name || '';
    let effContact = po.contactPerson || po.contact_person_name || '';
    let effContactNo = po.contactNo || po.phone || po.mobile || '';
    let effEmail = po.email || '';
    let effGst = po.gstNo || po.gstin || po.tax_registration_number || '';
    let effDelAddr = formatAddress(po.deliveryAddress || po.delivery_address || '');
    let effBillAddr = formatAddress(po.billingAddress || po.billing_address || '');
    let effTerms = po.terms || po.terms_and_conditions || '';
    let effPaymentTerms = po.paymentTerms || po.payment_terms_label || '';

    // Check cached PO in sessionStorage or poList to fill in any gaps if current object is a partial summary
    try {
      const cachedPo = JSON.parse(sessionStorage.getItem('controlroom_viewing_po') || '{}');
      const cNo = String(cachedPo.poNo || cachedPo.id || '').toLowerCase().replace(/[/_\-\s]/g, '');
      const targetRef = String(po.poNo || po.id || '').toLowerCase().replace(/[/_\-\s]/g, '');
      if (targetRef && (cNo === targetRef || cNo.includes(targetRef) || targetRef.includes(cNo))) {
        if ((!effVendor || effVendor === 'Vendor' || effVendor === 'Annamalaiyar' || effVendor === 'Fresh Vendor') && cachedPo.vendor && cachedPo.vendor !== 'Vendor' && cachedPo.vendor !== 'Annamalaiyar') {
          effVendor = cachedPo.vendor;
        }
        if (!effBranch && cachedPo.branch) effBranch = cachedPo.branch;
        if (!effContact && cachedPo.contactPerson) effContact = cachedPo.contactPerson;
        if (!effContactNo && cachedPo.contactNo) effContactNo = cachedPo.contactNo;
        if (!effEmail && cachedPo.email) effEmail = cachedPo.email;
        if ((!effGst || effGst === '—') && cachedPo.gstNo && cachedPo.gstNo !== '—') effGst = cachedPo.gstNo;
        if ((!effDelAddr || effDelAddr === '—' || effDelAddr === 'Tamil Nadu, India') && cachedPo.deliveryAddress && cachedPo.deliveryAddress !== '—') {
          effDelAddr = cachedPo.deliveryAddress;
        }
        if ((!effBillAddr || effBillAddr === '—') && cachedPo.billingAddress && cachedPo.billingAddress !== '—') {
          effBillAddr = cachedPo.billingAddress;
        }
        if ((!effTerms || effTerms.length < 50) && cachedPo.terms && cachedPo.terms.length > 50) {
          effTerms = cachedPo.terms;
        }
        if ((!effPaymentTerms || effPaymentTerms === 'Due on Receipt') && cachedPo.paymentTerms && cachedPo.paymentTerms !== 'Due on Receipt') {
          effPaymentTerms = cachedPo.paymentTerms;
        }
      }
    } catch (_) {}

    setPoNumber(po.poNo || po.purchaseorder_number || '');
    setVendorName(effVendor);
    const resolvedLoc = po.companyLocation || effBranch || 'VRM Structures India Pvt Ltd';
    setBranch(resolvedLoc);
    setCompanyLocation(resolvedLoc);
    setContactPerson(effContact);
    setContactNo(effContactNo);
    setEmail(effEmail);
    setGstNo(effGst);
    setDeliveryType(po.deliveryType || 'Organization');
    setDeliveryAddress(effDelAddr);
    setDeliveryCompanyName(po.deliveryCompanyName || po.deliveryName || getCompanyProfile(effBranch).name);
    const parsedDel = (po.deliveryAddressObj && typeof po.deliveryAddressObj === 'object')
      ? po.deliveryAddressObj
      : parseAddressString(effDelAddr);
    setDeliveryAddress1(po.deliveryAddress1 || parsedDel.address1 || '');
    setDeliveryAddress2(po.deliveryAddress2 || parsedDel.address2 || '');
    setDeliveryCity(po.deliveryCity || parsedDel.city || '');
    setDeliveryState(po.deliveryState || parsedDel.state || '');
    setDeliveryPincode(po.deliveryPincode || parsedDel.pincode || '');

    setBillingAddress(effBillAddr);
    const parsedBill = (po.billingAddressObj && typeof po.billingAddressObj === 'object')
      ? po.billingAddressObj
      : parseAddressString(effBillAddr);
    setBillingAddress1(po.billingAddress1 || parsedBill.address1 || '');
    setBillingAddress2(po.billingAddress2 || parsedBill.address2 || '');
    setBillingCity(po.billingCity || parsedBill.city || '');
    setBillingState(po.billingState || parsedBill.state || '');
    setBillingPincode(po.billingPincode || parsedBill.pincode || '');
    setSameAsDelivery(effDelAddr === effBillAddr && effDelAddr !== '');

    const parseDateToInputFormat = (dateStr) => {
      if (!dateStr || dateStr === 'Draft' || dateStr === 'Immediate') return '';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
      } catch (err) {
        return '';
      }
    };

    setPoDate(parseDateToInputFormat(po.poDate || po.date));
    setDeliveryDate(parseDateToInputFormat(po.deliveryDate || po.delivery_date));
    setPaymentTerms(effPaymentTerms || 'Net 30 Days');
    setAdvancePaidPct(po.advancePaidPct !== undefined && po.advancePaidPct !== null ? String(po.advancePaidPct) : '40');
    setPurchaser(po.purchaser || po.purchaser_name || loggedInUserName);
    setShipmentPref(po.shipmentPref || po.shipment_preference || 'Transport');
    setCurrency(po.currency || po.currency_code || 'INR - Indian Rupee');
    setProject(po.project || po.project_name || '');
    setPriority(po.priority || 'High');
    setScope(po.scope || 'Vendor Scope');
    setTransportName(po.transportName || '');
    setViewingPoStatus(po.status || 'OPEN');

    const incomingItems = (po.items && Array.isArray(po.items) && po.items.length > 0)
      ? po.items
      : (po.line_items && Array.isArray(po.line_items) && po.line_items.length > 0 ? po.line_items : []);

    let finalItems = incomingItems;
    if (finalItems.length === 0 && (po.poNo || po.id)) {
      const targetRef = String(po.poNo || po.id || '').toLowerCase().replace(/[/_\-\s]/g, '');
      const listMatch = poList.find(p => {
        const pNo = String(p.poNo || '').toLowerCase().replace(/[/_\-\s]/g, '');
        const pId = String(p.id || '').toLowerCase().replace(/[/_\-\s]/g, '');
        return targetRef && (pNo === targetRef || pId === targetRef);
      });
      if (listMatch && listMatch.items && Array.isArray(listMatch.items) && listMatch.items.length > 0) {
        finalItems = listMatch.items;
      }
    }

    if (finalItems.length === 0 && (po.poNo || po.id)) {
      try {
        const cachedPo = JSON.parse(sessionStorage.getItem('controlroom_viewing_po') || '{}');
        const cNo = String(cachedPo.poNo || cachedPo.id || '').toLowerCase().replace(/[/_\-\s]/g, '');
        const targetRef = String(po.poNo || po.id || '').toLowerCase().replace(/[/_\-\s]/g, '');
        if (targetRef && (cNo === targetRef || cNo.includes(targetRef) || targetRef.includes(cNo))) {
          if (Array.isArray(cachedPo.items) && cachedPo.items.length > 0) {
            finalItems = cachedPo.items;
          }
        }
      } catch (_) {}
    }

    if (finalItems.length > 0) {
      const sanitizedItems = finalItems.map(it => ({
        ...it,
        name: it.name || it.item_name || 'Material Item',
        description: it.description || it.desc || '',
        hsn: it.hsn || it.hsn_or_sac || '',
        account: it.account || it.account_name || 'Cost of Goods Sold',
        qty: Number(it.qty !== undefined ? it.qty : (it.quantity || 1)),
        unit: it.unit || 'NOS',
        rate: Number(it.rate !== undefined ? it.rate : (it.unitPrice || 0)),
        tax: (it.tax !== undefined && it.tax !== '' && !isNaN(Number(it.tax))) ? Number(it.tax) : (it.tax_percentage > 0 ? Number(it.tax_percentage) : 18)
      }));
      setItems(sanitizedItems);
    } else {
      setItems([]);
    }
    setPresetGroups((po.presetGroups && typeof po.presetGroups === 'object') ? po.presetGroups : {});

    setShippingCharges(po.shippingCharges !== undefined ? po.shippingCharges : (po.shipping_charge || 0));
    setOtherCharges(po.otherCharges !== undefined ? po.otherCharges : (po.adjustment || 0));
    setDiscountPct(po.discountPct !== undefined ? po.discountPct : (po.discount_percent || 0));
    setNotes(po.notes || po.remarks || '');
    const defaultTerms = `1. Material should be as per the agreed specification and quality.
2. Delivery should be made on or before the delivery date.
3. Payment will be released as per the agreed payment terms.
4. Any delay in delivery may attract penalty as per company policy.
5. All disputes are subject to the jurisdiction of Nellore courts.`;
    setTerms((effTerms && effTerms.trim().length > 0) ? effTerms : (po.terms || po.terms_and_conditions || defaultTerms));
    setAttachedFiles(po.pdfName ? [{ name: po.pdfName, size: 'Original Attachment' }] : []);
  };

  // Always land on the main PO table view on mount, and purge any stale detail view session
  useEffect(() => {
    try {
      sessionStorage.removeItem('controlroom_po_view_mode');
      sessionStorage.removeItem('controlroom_viewing_po');
    } catch (_) {}
    setViewMode('list');
  }, []);

  const handleStartEdit = async (po, idx) => {
    setEditIdx(idx);
    const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const poTargetNo = normalize(po.poNo || po.id);
    const enrichedPo = poList.find(p => {
      const pNo = normalize(p.poNo);
      const pId = normalize(p.id);
      return (poTargetNo && (pNo === poTargetNo || pId === poTargetNo)) && ((p.items && p.items.length > 0) || (p.deliveryAddress && p.deliveryAddress !== '—'));
    }) || po;

    populateFormStates(enrichedPo);
    setViewMode('edit');
    try {
      sessionStorage.setItem('controlroom_po_view_mode', 'edit');
      sessionStorage.setItem('controlroom_viewing_po', JSON.stringify(enrichedPo));
    } catch (_) {}
    setActiveDropdownIdx(null);
    const targetId = po.poNo || po.id;
    if (targetId) {
      if (!enrichedPo.items || enrichedPo.items.length === 0) {
        setPoDetailLoading(true);
      }
      try {
        const res = await fetch(`/api/purchaseorders/${encodeURIComponent(targetId)}`);
        if (res.ok) {
          const detail = await res.json();
          if (detail && detail.poNo) {
            const merged = {
              ...enrichedPo,
              ...detail,
              vendor: (enrichedPo.vendor && enrichedPo.vendor !== 'Vendor' && enrichedPo.vendor !== 'Annamalaiyar' && enrichedPo.vendor !== 'Fresh Vendor') 
                ? enrichedPo.vendor 
                : ((detail.vendor && detail.vendor !== 'Vendor' && detail.vendor !== 'Annamalaiyar') ? detail.vendor : (enrichedPo.vendor || detail.vendor || 'Vendor')),
              branch: enrichedPo.branch || detail.branch || '',
              contactPerson: enrichedPo.contactPerson || detail.contactPerson || '',
              gstNo: (enrichedPo.gstNo && enrichedPo.gstNo !== '—') ? enrichedPo.gstNo : (detail.gstNo || '—'),
              deliveryAddress: (enrichedPo.deliveryAddress && enrichedPo.deliveryAddress !== '—' && enrichedPo.deliveryAddress !== 'Tamil Nadu, India') ? enrichedPo.deliveryAddress : (detail.deliveryAddress || '—'),
              billingAddress: (enrichedPo.billingAddress && enrichedPo.billingAddress !== '—') ? enrichedPo.billingAddress : (detail.billingAddress || '—'),
              paymentTerms: (enrichedPo.paymentTerms && enrichedPo.paymentTerms !== 'Net 30 Days' && enrichedPo.paymentTerms !== 'Due on Receipt') ? enrichedPo.paymentTerms : (detail.paymentTerms || 'Net 30 Days'),
              notes: (detail.notes && detail.notes !== '') ? detail.notes : (enrichedPo.notes || ''),
              terms: (detail.terms && detail.terms.length > 50) ? detail.terms : (enrichedPo.terms || detail.terms || ''),
              scope: detail.scope || enrichedPo.scope || 'Vendor Scope',
              priority: detail.priority || enrichedPo.priority || 'High',
              transportName: detail.transportName || enrichedPo.transportName || '',
              shippingCharges: detail.shippingCharges !== undefined ? detail.shippingCharges : (enrichedPo.shippingCharges || 0),
              otherCharges: detail.otherCharges !== undefined ? detail.otherCharges : (enrichedPo.otherCharges || 0),
              discountPct: detail.discountPct !== undefined ? detail.discountPct : (enrichedPo.discountPct || 0),
              purchaser: (detail.purchaser && detail.purchaser !== '—') ? detail.purchaser : (enrichedPo.purchaser || '—'),
              items: (detail.items && Array.isArray(detail.items) && detail.items.length > 0) ? detail.items : (enrichedPo.items || []),
              amount: (enrichedPo.amount && enrichedPo.amount !== '₹0.00' && enrichedPo.amount !== '₹ 0.00') ? enrichedPo.amount : (detail.amount || enrichedPo.amount)
            };
            populateFormStates(merged);
            setPoList(prev => prev.map(p => (p.poNo === (merged.poNo || po.poNo) || p.id === (merged.id || po.id)) ? { ...p, ...merged } : p));
            savePurchaseOrder(merged);
            try {
              sessionStorage.setItem('controlroom_viewing_po', JSON.stringify(merged));
            } catch (_) {}
          }
        }
      } catch (err) {
        console.error("Failed to load PO details", err);
      } finally {
        setPoDetailLoading(false);
      }
    }
  };

  const handleStartView = async (po) => {
    const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const poTargetNo = normalize(po.poNo || po.id);
    const enrichedPo = poList.find(p => {
      const pNo = normalize(p.poNo);
      const pId = normalize(p.id);
      return (poTargetNo && (pNo === poTargetNo || pId === poTargetNo)) && ((p.items && p.items.length > 0) || (p.deliveryAddress && p.deliveryAddress !== '—'));
    }) || po;

    populateFormStates(enrichedPo);
    if (isCeoLogin) {
      setShowCeoPoModal(true);
    } else {
      setViewMode('view');
      try {
        sessionStorage.setItem('controlroom_po_view_mode', 'view');
        sessionStorage.setItem('controlroom_viewing_po', JSON.stringify(enrichedPo));
      } catch (_) {}
    }
    setActiveDropdownIdx(null);
    const targetId = po.poNo || po.id;
    if (targetId) {
      if (!enrichedPo.items || enrichedPo.items.length === 0) {
        setPoDetailLoading(true);
      }
      try {
        const res = await fetch(`/api/purchaseorders/${encodeURIComponent(targetId)}`);
        if (res.ok) {
          const detail = await res.json();
            const isAdv = (p) => {
              const s = String(p?.status || '').toLowerCase();
              const st = String(p?.statusType || '').toLowerCase();
              return s.includes('md approved') || st.includes('md_approved') ||
                     s.includes('payment') || st.includes('payment') ||
                     s.includes('proceed') || st.includes('proceed') ||
                     s.includes('closed') || st.includes('closed') ||
                     s.includes('rejected') || st.includes('rejected') ||
                     Boolean(p?.approvedBy);
            };
            const effStatus = isAdv(enrichedPo) ? enrichedPo.status : (isAdv(detail) ? detail.status : (detail.status || enrichedPo.status));
            const effStatusType = isAdv(enrichedPo) ? enrichedPo.statusType : (isAdv(detail) ? detail.statusType : (detail.statusType || enrichedPo.statusType));
            const effApprovedBy = enrichedPo.approvedBy || detail.approvedBy;
            const effApprovalDate = enrichedPo.approvalDate || detail.approvalDate;
            const effApprovalTime = enrichedPo.approvalTime || detail.approvalTime;
            const effApprovalRemarks = enrichedPo.approvalRemarks || detail.approvalRemarks;

            const merged = {
              ...enrichedPo,
              ...detail,
              status: effStatus,
              statusType: effStatusType,
              approvedBy: effApprovedBy,
              approvalDate: effApprovalDate,
              approvalTime: effApprovalTime,
              approvalRemarks: effApprovalRemarks,
              vendor: (enrichedPo.vendor && enrichedPo.vendor !== 'Vendor' && enrichedPo.vendor !== 'Annamalaiyar' && enrichedPo.vendor !== 'Fresh Vendor') 
                ? enrichedPo.vendor 
                : ((detail.vendor && detail.vendor !== 'Vendor' && detail.vendor !== 'Annamalaiyar') ? detail.vendor : (enrichedPo.vendor || detail.vendor || 'Vendor')),
              branch: enrichedPo.branch || detail.branch || '',
              contactPerson: enrichedPo.contactPerson || detail.contactPerson || '',
              gstNo: (enrichedPo.gstNo && enrichedPo.gstNo !== '—') ? enrichedPo.gstNo : (detail.gstNo || '—'),
              deliveryAddress: (enrichedPo.deliveryAddress && enrichedPo.deliveryAddress !== '—' && enrichedPo.deliveryAddress !== 'Tamil Nadu, India') ? enrichedPo.deliveryAddress : (detail.deliveryAddress || '—'),
              billingAddress: (enrichedPo.billingAddress && enrichedPo.billingAddress !== '—') ? enrichedPo.billingAddress : (detail.billingAddress || '—'),
              paymentTerms: (enrichedPo.paymentTerms && enrichedPo.paymentTerms !== 'Net 30 Days' && enrichedPo.paymentTerms !== 'Due on Receipt') ? enrichedPo.paymentTerms : (detail.paymentTerms || 'Net 30 Days'),
              notes: (detail.notes && detail.notes !== '') ? detail.notes : (enrichedPo.notes || ''),
              terms: (detail.terms && detail.terms.length > 50) ? detail.terms : (enrichedPo.terms || detail.terms || ''),
              scope: detail.scope || enrichedPo.scope || 'Vendor Scope',
              priority: detail.priority || enrichedPo.priority || 'High',
              transportName: detail.transportName || enrichedPo.transportName || '',
              shippingCharges: detail.shippingCharges !== undefined ? detail.shippingCharges : (enrichedPo.shippingCharges || 0),
              otherCharges: detail.otherCharges !== undefined ? detail.otherCharges : (enrichedPo.otherCharges || 0),
              discountPct: detail.discountPct !== undefined ? detail.discountPct : (enrichedPo.discountPct || 0),
              purchaser: (detail.purchaser && detail.purchaser !== '—') ? detail.purchaser : (enrichedPo.purchaser || '—'),
              items: (detail.items && Array.isArray(detail.items) && detail.items.length > 0) ? detail.items : (enrichedPo.items || []),
              amount: (enrichedPo.amount && enrichedPo.amount !== '₹0.00' && enrichedPo.amount !== '₹ 0.00') ? enrichedPo.amount : (detail.amount || enrichedPo.amount)
            };
            populateFormStates(merged);
            setPoList(prev => prev.map(p => (p.poNo === (merged.poNo || po.poNo) || p.id === (merged.id || po.id)) ? { ...p, ...merged } : p));
            savePurchaseOrder(merged);
            try {
              sessionStorage.setItem('controlroom_viewing_po', JSON.stringify(merged));
            } catch (_) {}
          }
      } catch (err) {
        console.error("Failed to load PO details", err);
      } finally {
        setPoDetailLoading(false);
      }
    }
  };

  const handleStartClone = async (po) => {
    setActiveDropdownIdx(null);
    setEditIdx(null);
    const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const poTargetNo = normalize(po.poNo || po.id);
    const enrichedPo = poList.find(p => {
      const pNo = normalize(p.poNo);
      const pId = normalize(p.id);
      return (poTargetNo && (pNo === poTargetNo || pId === poTargetNo)) && ((p.items && p.items.length > 0) || (p.deliveryAddress && p.deliveryAddress !== '—'));
    }) || po;

    populateFormStates(enrichedPo);

    const todayStr = new Date().toISOString().split('T')[0];
    setPoDate(todayStr);

    try {
      const res = await fetch('/api/next-po-number');
      if (res.ok) {
        const data = await res.json();
        if (data.nextPoNumber || data.nextPoNo) {
          setPoNumber(data.nextPoNumber || data.nextPoNo);
        }
      }
    } catch (e) {
      setPoNumber(getNextPoNumber(poList));
    }

    setViewMode('create');

    const targetId = po.poNo || po.id;
    if (targetId) {
      if (!enrichedPo.items || enrichedPo.items.length === 0) {
        setPoDetailLoading(true);
      }
      try {
        const res = await fetch(`/api/purchaseorders/${encodeURIComponent(targetId)}`);
        if (res.ok) {
          const detail = await res.json();
          if (detail && detail.poNo) {
            const merged = {
              ...enrichedPo,
              ...detail,
              vendor: (enrichedPo.vendor && enrichedPo.vendor !== 'Vendor' && enrichedPo.vendor !== 'Annamalaiyar') ? enrichedPo.vendor : (detail.vendor || enrichedPo.vendor),
              deliveryAddress: (enrichedPo.deliveryAddress && enrichedPo.deliveryAddress !== '—' && enrichedPo.deliveryAddress !== '') ? enrichedPo.deliveryAddress : (detail.deliveryAddress || '—'),
              billingAddress: (enrichedPo.billingAddress && enrichedPo.billingAddress !== '—' && enrichedPo.billingAddress !== '') ? enrichedPo.billingAddress : (detail.billingAddress || '—'),
              paymentTerms: (enrichedPo.paymentTerms && enrichedPo.paymentTerms !== 'Net 30 Days') ? enrichedPo.paymentTerms : (detail.paymentTerms || 'Net 30 Days'),
              items: (detail.items && Array.isArray(detail.items) && detail.items.length > 0) ? detail.items : (enrichedPo.items || [])
            };
            populateFormStates(merged);
          }
          setPoDate(todayStr);
          const nextRes = await fetch('/api/next-po-number');
          if (nextRes.ok) {
            const nextData = await nextRes.json();
            if (nextData.nextPoNumber || nextData.nextPoNo) {
              setPoNumber(nextData.nextPoNumber || nextData.nextPoNo);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load PO details for cloning", err);
      } finally {
        setPoDetailLoading(false);
      }
    }
  };

  // Helper to calculate next PO number matching standard sequential format (VRM-PO-[YYYY]-[SEQ])
  const getNextPoNumber = (list) => {
    return getNextSequence('PO', list || []).code;
  };

  // Triggers fresh form initialization
  const handleStartFreshPO = () => {
    setEditIdx(null);
    setPoNumber(getNextPoNumber(poList));
    fetch('/api/next-po-number')
      .then(res => res.json())
      .then(data => {
        if (data && (data.nextPoNo || data.nextPoNumber)) {
          setPoNumber(data.nextPoNo || data.nextPoNumber);
        }
      })
      .catch(() => { });
    const applyCompanyDeliveryAddress = (locKey) => {
      const prof = getCompanyProfile(locKey);
      const parsed = parseAddressString(prof.address || '');
      const a1 = prof.address1 || parsed.address1 || '';
      const a2 = prof.address2 || parsed.address2 || '';
      const c = prof.city || parsed.city || '';
      const s = prof.state || parsed.state || '';
      const p = prof.pincode || parsed.pincode || '';
      setDeliveryLocationId(prof.locationLabel || locKey || 'VRM Structures India Pvt Ltd');
      setDeliveryCompanyName(prof.name || 'VRM Structures India Pvt Ltd');
      setDeliveryAddress1(a1);
      setDeliveryAddress2(a2);
      setDeliveryCity(c);
      setDeliveryState(s);
      setDeliveryPincode(p);
      setDeliveryAddress(prof.address || formatAddressObj({ address1: a1, address2: a2, city: c, state: s, pincode: p }));
    };

    setVendorName('');
    setBranch('VRM Structures India Pvt Ltd');
    setCompanyLocation('VRM Structures India Pvt Ltd');
    setContactPerson('');
    setContactNo('');
    setEmail('');
    setGstNo('');
    setDeliveryType('Organization');
    applyCompanyDeliveryAddress('VRM Structures India Pvt Ltd');
    setBillingAddress('');
    setBillingAddress1('');
    setBillingAddress2('');
    setBillingCity('');
    setBillingState('');
    setBillingPincode('');
    setSameAsDelivery(false);
    setPoDate(new Date().toISOString().split('T')[0]);
    setDeliveryDate('');
    setPaymentTerms('');
    setAdvancePaidPct('40');
    setPurchaser(loggedInUserName);
    setShipmentPref('Transport');
    setCurrency('INR - Indian Rupee');
    setProject('');
    setPriority('High');
    setScope('Vendor Scope');
    setTransportName('');
    setItems([]);
    setPresetGroups({});
    setShippingCharges(0);
    setOtherCharges(0);
    setDiscountPct(0);
    setAttachedFiles([]);
    setNotes('');
    setTerms('');
    setSelectedTermsPreset('');
    setUseDefaultTerms(false);
    setApprovalRequired('Yes');
    setApprover('Velmurugan Rathinam (CEO)');
    setApprovalPriority('High');
    setViewMode('create');
  };

  const executeDeletePO = () => executeDeletePoRecord({ deleteIdx, setDeleteIdx, poList, setPoList, fetchZohoPOs });

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdownIdx(null);
      setOpenPresetIdx(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      if (uploadTimerRef.current) clearInterval(uploadTimerRef.current);
    };
  }, []);

  const renderStatusBadge = (type, label) => renderPoStatusBadge(type, label, isAccounts);

  const renderPoReadOnlyDocument = () => (
    <PoReadOnlyDocument
      poNumber={poNumber}
      poList={poList}
      viewingPoStatus={viewingPoStatus}
      poDate={poDate}
      billingAddress={billingAddress}
      deliveryAddress={deliveryAddress}
      items={items}
      terms={terms}
      notes={notes}
      vendorName={vendorName}
      paymentTerms={paymentTerms}
      otherCharges={otherCharges}
      scope={scope}
      shippingCharges={shippingCharges}
      contactNo={contactNo}
      email={email}
      setPreviewZoomImage={setPreviewZoomImage}
      handlePushToGrn={handlePushToGrn}
      onNavigateTab={onNavigateTab}
      gstNo={gstNo}
      deliveryLocation={deliveryLocationId}
      shipmentPref={shipmentPref}
      transportName={transportName}
      priority={priority}
      advancePaidPct={advancePaidPct}
      getSubTotal={getSubTotal}
      getDiscountAmount={getDiscount}
      getEffectiveCGSTPct={getEffectiveCGSTPct}
      getCGST={getCGST}
      getEffectiveSGSTPct={getEffectiveSGSTPct}
      getSGST={getSGST}
      getGrandTotal={getGrandTotal}
      deliveryCompanyName={deliveryCompanyName}
      companyLocation={companyLocation}
      branch={branch}
      contactPerson={contactPerson}
      discountPct={discountPct}
      deliveryDate={deliveryDate}
      purchaser={purchaser}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-24)' }}>
      {/* Official PO Document Dedicated Print Isolation Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          html, body {
            background: #FFFFFF !important;
            color: #000000 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Hide all application navigation, headers, sidebars, toolbars, timelines, and footers */
          aside, nav, header, footer,
          [class*="sidebar"],
          [class*="Sidebar"],
          .floating-action-bar,
          .po-lifecycle-timeline,
          .po-view-footer-actions,
          .po-no-print,
          .no-print {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          /* Isolated Official Purchase Order Printable Card */
          #businz-po-official-document {
            display: block !important;
            visibility: visible !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 12px !important;
            border: 1px solid #CBD5E1 !important;
            box-shadow: none !important;
            background: #FFFFFF !important;
            page-break-inside: auto !important;
          }
          #businz-po-official-document * {
            visibility: visible !important;
          }
        }
      `}</style>

      {/* ==================== VIEW 1: MAIN PO LIST SCREEN ==================== */}
      {viewMode === 'list' && (
        <PoTableSection
          isExecutiveOrMD={isExecutiveOrMD}
          isAccounts={isAccounts}
          poList={poList}
          getPoStage={getPoStage}
          kpiFilterMeta={kpiFilterMeta}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          poTab={poTab}
          setPoTab={setPoTab}
          filterDate={filterDate}
          setFilterDate={setFilterDate}
          filterEndDate={filterEndDate}
          setFilterEndDate={setFilterEndDate}
          sortDirection={sortDirection}
          setSortDirection={setSortDirection}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          rowsPerPage={rowsPerPage}
          setRowsPerPage={setRowsPerPage}
          selectedPOs={selectedPOs}
          setSelectedPOs={setSelectedPOs}
          handleSelectAll={handleSelectAll}
          handleSelectRow={handleSelectRow}
          handleStartFreshPO={handleStartFreshPO}
          canApproveAsMD={canApproveAsMD}
          setApprovingPo={setApprovingPo}
          handleOpenPaymentProcessModal={handleOpenPaymentProcessModal}
          handleOpenProceedPoModal={handleOpenProceedPoModal}
          setPrintPoModal={setPrintPoModal}
          handleStartEdit={handleStartEdit}
          handleStartView={handleStartView}
          setCancellingPo={setCancellingPo}
          renderStatusBadge={renderStatusBadge}
          showCeoPoModal={showCeoPoModal}
          setCancellationRemarkInput={setCancellationRemarkInput}
          tableLoading={tableLoading}
          isMobile={isMobile}
          handlePushToGrn={handlePushToGrn}
          clearFilters={clearFilters}
        />
      )}
      {/* ==================== VIEW 2: DEDICATED FULL-PAGE CREATOR/EDITOR/VIEW SCREEN ==================== */}
      {(viewMode === 'create' || viewMode === 'edit' || viewMode === 'view') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#1e293b' }}>

          {/* Title Bar */}
          <PoFormHeaderBar
            viewMode={viewMode}
            viewingPoStatus={viewingPoStatus}
            renderStatusBadge={renderStatusBadge}
            setViewMode={setViewMode}
            poNumber={poNumber}
            isParsingPoPdf={isParsingPoPdf}
            poPdfInputRef={poPdfInputRef}
            handleUploadPoPdfFile={handleUploadPoPdfFile}
          />
          {/* Title Bar */}
          <div
            className="po-no-print"
            style={{
              background: 'linear-gradient(135deg, #075985 0%, #0E7490 50%, #0891B2 100%)',
              borderRadius: '18px',
              padding: '24px 28px',
              color: '#FFFFFF',
              boxShadow: '0 10px 25px -5px rgba(14, 116, 144, 0.4)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.18)',
                  backdropFilter: 'blur(6px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <FileCheck style={{ width: '24px', height: '24px', color: '#FFFFFF' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
                    {viewMode === 'view' ? 'View Purchase Order' : viewMode === 'edit' ? 'Edit Purchase Order' : 'Create Purchase Order'}
                  </h2>
                  {viewMode === 'view' && viewingPoStatus && (
                    renderStatusBadge(
                      (viewingPoStatus.includes('CLOSED') || viewingPoStatus.includes('FULLY RECEIVED')) ? 'closed' :
                      (viewingPoStatus.includes('PARTIALLY')) ? 'partially_received' :
                      (viewingPoStatus === 'Proceed PO') ? 'proceed_po' :
                      (viewingPoStatus === 'Payment Processed') ? 'payment_processed' :
                      (viewingPoStatus === 'MD Approved' || viewingPoStatus === 'OPEN' || viewingPoStatus === 'Approved') ? 'approved' :
                      (viewingPoStatus === 'REJECTED') ? 'rejected' : 'pending',
                      viewingPoStatus
                    )
                  )}
                </div>
                <span style={{ fontSize: '13px', color: '#CFFAFE', marginTop: '4px' }}>
                  {viewMode === 'view' ? `Details of purchase order ${poNumber}.` : 'Fill in the details below to create a new purchase order.'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {viewMode === 'view' ? (
                <PoStageActionButtons
                  poList={poList}
                  poNumber={poNumber}
                  vendorName={vendorName}
                  getGrandTotal={getGrandTotal}
                  paymentTerms={paymentTerms}
                  viewingPoStatus={viewingPoStatus}
                  isAccounts={isAccounts}
                  isProcurementHead={isProcurementHead}
                  canApproveAsMD={canApproveAsMD}
                  handlePushToGrn={handlePushToGrn}
                  handleOpenProceedPoModal={handleOpenProceedPoModal}
                  handleOpenPaymentProcessModal={handleOpenPaymentProcessModal}
                  setApprovingPo={setApprovingPo}
                  setRejectingPo={setRejectingPo}
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    ref={poPdfInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleUploadPoPdfFile}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    disabled={isParsingPoPdf}
                    onClick={() => poPdfInputRef.current?.click()}
                    title="Upload a digital PO PDF to auto-fill Date, Vendor, Line Items, and other details (keeps BUSINZ PO Number untouched)"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 18px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.45)',
                      backgroundColor: isParsingPoPdf ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(6px)',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: isParsingPoPdf ? 'wait' : 'pointer',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isParsingPoPdf ? (
                      <>
                        <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                        Reading PO PDF...
                      </>
                    ) : (
                      <>
                        <UploadCloud style={{ width: '16px', height: '16px' }} />
                        Upload PO PDF (Auto-Fill)
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Form Content Cards */}

          {/* Skeleton loader — shown while PO detail is fetching */}
          {poDetailLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="section-card" style={{ padding: '30px', borderRadius: '16px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '40%' }}>
                    <div className="skeleton-shimmer" style={{ height: '22px', width: '70%', borderRadius: '6px' }} />
                    <div className="skeleton-shimmer skeleton-text" style={{ height: '13px', width: '90%' }} />
                    <div className="skeleton-shimmer skeleton-text" style={{ height: '13px', width: '75%' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end', width: '30%' }}>
                    <div className="skeleton-shimmer" style={{ height: '20px', width: '80%', borderRadius: '6px' }} />
                    <div className="skeleton-shimmer skeleton-text" style={{ height: '14px', width: '60%' }} />
                    <div className="skeleton-shimmer skeleton-text" style={{ height: '14px', width: '50%' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div className="skeleton-shimmer skeleton-text" style={{ height: '11px', width: '40%' }} />
                      <div className="skeleton-shimmer skeleton-text" style={{ height: '14px', width: '70%' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="section-card" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="skeleton-shimmer" style={{ height: '18px', width: '180px', borderRadius: '6px' }} />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                    <div className="skeleton-shimmer skeleton-text" style={{ height: '13px', width: '80%' }} />
                    <div className="skeleton-shimmer skeleton-text" style={{ height: '13px', width: '60%' }} />
                    <div className="skeleton-shimmer skeleton-text" style={{ height: '13px', width: '50%' }} />
                    <div className="skeleton-shimmer skeleton-text" style={{ height: '13px', width: '60%' }} />
                    <div className="skeleton-shimmer skeleton-text" style={{ height: '13px', width: '70%' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '12px', backgroundColor: '#EFF6FF', borderRadius: '10px', border: '1px solid #BFDBFE' }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', flexShrink: 0, color: '#2563EB' }} />
                <span style={{ fontSize: '13px', color: '#1D4ED8', fontWeight: '600' }}>Loading PO details…</span>
              </div>
            </div>
          )}

          {viewMode === 'view' && !poDetailLoading ? (
            renderPoReadOnlyDocument()
          ) : (
            /* ==================== CREATOR & EDITOR ACTIVE FIELDS LAYOUT ==================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Top Banner: Company Issuing Location & Entity Details */}
              {(() => {
                const currentCompany = getCompanyProfile(companyLocation);
                return (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    backgroundColor: '#FFFFFF',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    boxShadow: 'none'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          backgroundColor: '#ECFEFF',
                          color: '#0E7490',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Building2 size={20} style={{ color: '#0E7490' }} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '14px', color: '#0F172A', fontWeight: '800' }}>
                              PO Issuing Location (Our Company)
                            </strong>
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: '700',
                              backgroundColor: '#ECFEFF',
                              color: '#0E7490',
                              padding: '2px 8px',
                              borderRadius: '12px'
                            }}>
                              Buyer Entity
                            </span>
                          </div>
                          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                            Choose the company location. Its official address and GST number are applied to this Purchase Order & printout.
                          </p>
                        </div>
                      </div>

                      {/* Location Dropdown */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <label htmlFor="po-company-location-select" style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                          Location:
                        </label>
                        <select
                          id="po-company-location-select"
                          name="companyLocation"
                          aria-label="PO Issuing Location"
                          value={companyLocation}
                          onChange={(e) => {
                            const loc = e.target.value;
                            setCompanyLocation(loc);
                            setBranch(loc);
                            const prof = getCompanyProfile(loc);
                            const parsed = parseAddressString(prof.address || '');
                            const a1 = prof.address1 || parsed.address1 || '';
                            const a2 = prof.address2 || parsed.address2 || '';
                            const c = prof.city || parsed.city || '';
                            const s = prof.state || parsed.state || '';
                            const p = prof.pincode || parsed.pincode || '';
                            setDeliveryLocationId(prof.locationLabel || loc);
                            setDeliveryCompanyName(prof.name || 'VRM Structures India Pvt Ltd');
                            setDeliveryAddress1(a1);
                            setDeliveryAddress2(a2);
                            setDeliveryCity(c);
                            setDeliveryState(s);
                            setDeliveryPincode(p);
                            setDeliveryAddress(prof.address || formatAddressObj({ address1: a1, address2: a2, city: c, state: s, pincode: p }));
                          }}
                          style={{
                            height: '38px',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            padding: '0 14px',
                            fontSize: '13px',
                            fontWeight: '700',
                            color: '#0E7490',
                            backgroundColor: '#F8FAFC',
                            cursor: 'pointer',
                            outline: 'none',
                            minWidth: '240px'
                          }}
                        >
                          <option value="VRM Structures India Pvt Ltd">VRM Structures India Pvt Ltd</option>
                          <option value="VRM Structures (AP)">VRM Structures (AP)</option>
                        </select>
                      </div>
                    </div>

                    {/* Live Company Details Preview */}
                    <div style={{
                      backgroundColor: '#F8FAFC',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '12px',
                      alignItems: 'start',
                      fontSize: '12px'
                    }}>
                      <div>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>Company Name</span>
                        <strong style={{ fontSize: '13px', color: '#0F172A' }}>{currentCompany.name}</strong>
                        <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '600', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} style={{ color: '#0E7490' }} />
                          <span>{currentCompany.locationLabel}</span>
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>GST Number</span>
                        <strong style={{ fontSize: '13px', color: '#059669', letterSpacing: '0.5px' }}>{currentCompany.gst}</strong>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>State: {currentCompany.state}</div>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>Registered Address (Printout View)</span>
                        <span style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>{currentCompany.address}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 1. Vendor Information */}
              <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                    1
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    VENDOR INFORMATION
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-company-name" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Company Name <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <TypeableVendorSelect
                      id="purchase-orders-company-name"
                      name="companyName"
                      value={vendorName}
                      vendors={zohoVendors}
                      placeholder="Type or select Vendor..."
                      required
                      accentColor="#2563EB"
                      onChange={handleVendorChange}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-branch" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Branch / Location</label>
                    <select
                      id="purchase-orders-branch"
                      name="branch"
                      aria-label="Branch"
                      value={companyLocation}
                      onChange={(e) => {
                        const loc = e.target.value;
                        setCompanyLocation(loc);
                        setBranch(loc);
                      }}
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155', cursor: 'pointer' }}
                    >
                      <option value="VRM Structures India Pvt Ltd">VRM Structures India Pvt Ltd</option>
                      <option value="VRM Structures (AP)">VRM Structures (AP)</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-vendor-name" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Vendor Name</label>
                    <input id="purchase-orders-vendor-name" name="vendorName" aria-label="Vendor Name" type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }}  />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-contact-number" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Contact Number</label>
                    <input id="purchase-orders-contact-number" name="contactNumber" aria-label="Contact Number" type="text" value={contactNo} onChange={(e) => setContactNo(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }}  />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-email-id" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Email ID</label>
                    <input id="purchase-orders-email-id" name="emailID" aria-label="Email ID" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }}  />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-gst-number" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>GST Number</label>
                    <input id="purchase-orders-gst-number" name="gSTNumber" aria-label="GST Number" type="text" value={gstNo} onChange={(e) => setGstNo(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', textTransform: 'uppercase' }}  />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {/* Delivery / Shipping Address Card */}
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#0E7490', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={13} /> Delivery / Shipping Address <span style={{ color: '#EF4444' }}>*</span>
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Consignee Destination</span>
                    </div>

                    {/* Multi-Location / Company Receiving Site Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '6px 10px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                        <Building2 size={13} color="#0E7490" />
                        <span>Receiving Site / Location:</span>
                      </div>
                      <select
                        value={deliveryLocationId || companyLocation}
                        onChange={(e) => {
                          const selId = e.target.value;
                          setDeliveryLocationId(selId);
                          if (selId === 'custom') return;
                          const prof = getCompanyProfile(selId);
                          const parsed = parseAddressString(prof.address || '');
                          const a1 = prof.address1 || parsed.address1 || '';
                          const a2 = prof.address2 || parsed.address2 || '';
                          const c = prof.city || parsed.city || '';
                          const s = prof.state || parsed.state || '';
                          const p = prof.pincode || parsed.pincode || '';
                          setDeliveryCompanyName(prof.name || 'VRM Structures India Pvt Ltd');
                          setDeliveryAddress1(a1);
                          setDeliveryAddress2(a2);
                          setDeliveryCity(c);
                          setDeliveryState(s);
                          setDeliveryPincode(p);
                          const combined = prof.address || formatAddressObj({ address1: a1, address2: a2, city: c, state: s, pincode: p });
                          setDeliveryAddress(combined);
                        }}
                        style={{
                          height: '28px',
                          padding: '0 8px',
                          fontSize: '11px',
                          fontWeight: '700',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#F8FAFC',
                          color: '#0E7490',
                          cursor: 'pointer',
                          maxWidth: '220px',
                          outline: 'none'
                        }}
                      >
                        <option value="VRM Structures India Pvt Ltd">VRM Structures India Pvt Ltd</option>
                        <option value="VRM Structures (AP)">VRM Structures (AP)</option>
                        <option value="custom">Custom / Other Site</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#475569' }}>
                        Delivery To / Site Name <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={deliveryCompanyName}
                        onChange={(e) => setDeliveryCompanyName(e.target.value)}
                        placeholder="VRM Structures India Pvt Ltd or Other Site Name..."
                        style={{ height: '36px', borderRadius: '7px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', fontWeight: '600', color: '#0F172A', backgroundColor: '#FFFFFF' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#475569' }}>
                        Address Line 1 <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={deliveryAddress1}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDeliveryAddress1(val);
                          const combined = formatAddressObj({ address1: val, address2: deliveryAddress2, city: deliveryCity, state: deliveryState, pincode: deliveryPincode });
                          setDeliveryAddress(combined);
                          if (sameAsDelivery) {
                            setBillingAddress1(val);
                            setBillingAddress(combined);
                          }
                        }}
                        placeholder="Flat / Building / Door No, Street..."
                        style={{ height: '36px', borderRadius: '7px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#475569' }}>
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        value={deliveryAddress2}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDeliveryAddress2(val);
                          const combined = formatAddressObj({ address1: deliveryAddress1, address2: val, city: deliveryCity, state: deliveryState, pincode: deliveryPincode });
                          setDeliveryAddress(combined);
                          if (sameAsDelivery) {
                            setBillingAddress2(val);
                            setBillingAddress(combined);
                          }
                        }}
                        placeholder="Area, Landmark, Industrial Estate..."
                        style={{ height: '36px', borderRadius: '7px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.9fr', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#475569' }}>
                          City <span style={{ color: '#EF4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={deliveryCity}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDeliveryCity(val);
                            const combined = formatAddressObj({ address1: deliveryAddress1, address2: deliveryAddress2, city: val, state: deliveryState, pincode: deliveryPincode });
                            setDeliveryAddress(combined);
                            if (sameAsDelivery) {
                              setBillingCity(val);
                              setBillingAddress(combined);
                            }
                          }}
                          placeholder="e.g. Chennai"
                          style={{ height: '36px', borderRadius: '7px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                          required
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#475569' }}>
                          State
                        </label>
                        <input
                          type="text"
                          value={deliveryState}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDeliveryState(val);
                            const combined = formatAddressObj({ address1: deliveryAddress1, address2: deliveryAddress2, city: deliveryCity, state: val, pincode: deliveryPincode });
                            setDeliveryAddress(combined);
                            if (sameAsDelivery) {
                              setBillingState(val);
                              setBillingAddress(combined);
                            }
                          }}
                          placeholder="e.g. Tamil Nadu"
                          style={{ height: '36px', borderRadius: '7px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#475569' }}>
                          Pin Code
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={deliveryPincode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setDeliveryPincode(val);
                            const combined = formatAddressObj({ address1: deliveryAddress1, address2: deliveryAddress2, city: deliveryCity, state: deliveryState, pincode: val });
                            setDeliveryAddress(combined);
                            if (sameAsDelivery) {
                              setBillingPincode(val);
                              setBillingAddress(combined);
                            }
                          }}
                          placeholder="600028"
                          style={{ height: '36px', borderRadius: '7px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Billing Address Card */}
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#2563EB', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building2 size={13} /> Billing Address
                      </span>
                    </div>

                    {/* Multi-Location / Branch Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '6px 10px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                        <Building2 size={13} color="#2563EB" />
                        <span>Billing Location:</span>
                      </div>
                      <select
                        value={billingLocationId}
                        onChange={(e) => {
                          const selId = e.target.value;
                          setBillingLocationId(selId);
                          if (sameAsDelivery) setSameAsDelivery(false);
                          if (selId === 'custom') return;
                          const chosen = vendorLocations.find(l => l.id === selId);
                          if (chosen) {
                            setBillingAddress1(chosen.address1 || '');
                            setBillingAddress2(chosen.address2 || '');
                            setBillingCity(chosen.city || '');
                            setBillingState(chosen.state || '');
                            setBillingPincode(chosen.pincode || '');
                            setBillingAddress(formatAddressObj(chosen));
                          }
                        }}
                        style={{
                          height: '28px',
                          padding: '0 8px',
                          fontSize: '11px',
                          fontWeight: '700',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#F8FAFC',
                          color: '#2563EB',
                          cursor: 'pointer',
                          maxWidth: '220px',
                          outline: 'none'
                        }}
                      >
                        {vendorLocations.length > 0 ? (
                          vendorLocations.map((loc) => (
                            <option key={loc.id} value={loc.id}>{loc.label}</option>
                          ))
                        ) : (
                          <>
                            <option value="registered_office">Registered / Head Office</option>
                            <option value="factory_plant">Factory / Plant Site</option>
                            <option value="warehouse_yard">Warehouse / Stockyard</option>
                          </>
                        )}
                        <option value="custom">Custom / Other Site</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#475569' }}>
                        Address Line 1
                      </label>
                      <input
                        type="text"
                        value={billingAddress1}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBillingAddress1(val);
                          setBillingAddress(formatAddressObj({ address1: val, address2: billingAddress2, city: billingCity, state: billingState, pincode: billingPincode }));
                          if (sameAsDelivery) setSameAsDelivery(false);
                        }}
                        placeholder="Vendor billing street / building..."
                        style={{ height: '36px', borderRadius: '7px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#475569' }}>
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        value={billingAddress2}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBillingAddress2(val);
                          setBillingAddress(formatAddressObj({ address1: billingAddress1, address2: val, city: billingCity, state: billingState, pincode: billingPincode }));
                          if (sameAsDelivery) setSameAsDelivery(false);
                        }}
                        placeholder="Area, Landmark..."
                        style={{ height: '36px', borderRadius: '7px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.9fr', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#475569' }}>
                          City
                        </label>
                        <input
                          type="text"
                          value={billingCity}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBillingCity(val);
                            setBillingAddress(formatAddressObj({ address1: billingAddress1, address2: billingAddress2, city: val, state: billingState, pincode: billingPincode }));
                            if (sameAsDelivery) setSameAsDelivery(false);
                          }}
                          placeholder="City"
                          style={{ height: '36px', borderRadius: '7px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#475569' }}>
                          State
                        </label>
                        <input
                          type="text"
                          value={billingState}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBillingState(val);
                            setBillingAddress(formatAddressObj({ address1: billingAddress1, address2: billingAddress2, city: billingCity, state: val, pincode: billingPincode }));
                            if (sameAsDelivery) setSameAsDelivery(false);
                          }}
                          placeholder="State"
                          style={{ height: '36px', borderRadius: '7px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10.5px', fontWeight: '700', color: '#475569' }}>
                          Pin Code
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={billingPincode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            setBillingPincode(val);
                            setBillingAddress(formatAddressObj({ address1: billingAddress1, address2: billingAddress2, city: billingCity, state: billingState, pincode: val }));
                            if (sameAsDelivery) setSameAsDelivery(false);
                          }}
                          placeholder="Pincode"
                          style={{ height: '36px', borderRadius: '7px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', backgroundColor: '#FFFFFF' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* 2. Purchase Order Information */}
              <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                    2
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    PURCHASE ORDER INFORMATION
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-po-number" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>PO Number</label>
                    <input id="purchase-orders-po-number" name="pONumber" aria-label="PO Number" type="text" value={poNumber} disabled style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: '#f8fafc', color: '#64748b' }}  />
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>(Auto Generated)</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-po-date" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      PO Date <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <input id="purchase-orders-po-date" name="pODate" aria-label="PO Date" 
                      type="date" 
                      value={poDate} 
                      onChange={(e) => setPoDate(e.target.value)}
                      required
                      style={{ 
                        height: '38px', 
                        borderRadius: '8px', 
                        border: '1px solid #cbd5e1', 
                        padding: '0 12px', 
                        fontSize: '13px', 
                        backgroundColor: '#ffffff', 
                        color: '#0f172a'
                      }} 
                     />
                    <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '500' }}>(Editable • Past or Present Date)</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-expected-delivery-date" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Expected Delivery Date <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <input id="purchase-orders-expected-delivery-date" name="expectedDeliveryDate" aria-label="Expected Delivery Date" type="date" min={poDate || undefined} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} required style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }}  />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-payment-terms" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Payment Terms <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <select id="purchase-orders-payment-terms" name="paymentTerms" aria-label="Payment Terms" value={paymentTerms} onChange={(e) => {
                      const val = e.target.value;
                      setPaymentTerms(val);
                      if (val === 'Advance' && (advancePaidPct === '' || advancePaidPct === undefined || advancePaidPct === null)) {
                        setAdvancePaidPct('40');
                      }
                    }} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white' }}>
                      <option value="" disabled>Select Payment Terms</option>
                      <option value="Advance">Advance</option>
                      <option value="7 Days">7 Days</option>
                      <option value="15 Days Net">15 Days Net</option>
                      <option value="Net 30 Days">Net 30 Days</option>
                      <option value="Net 45 Days">Net 45 Days</option>
                      <option value="Net 60 Days">Net 60 Days</option>
                      <option value="Immediate">Immediate</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-po-issued-by" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      PO Issued By <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <input id="purchase-orders-po-issued-by" name="pOIssuedBy" aria-label="PO Issued By"
                      type="text"
                      readOnly
                      value={purchaser || loggedInUserName}
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: '#F8FAFC', color: '#334155', fontWeight: '600' }}
                     />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-shipment-preference" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Shipment Preference <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <select id="purchase-orders-shipment-preference" name="shipmentPreference" aria-label="Shipment Preference" value={shipmentPref} onChange={(e) => setShipmentPref(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155' }}>
                      <option value="" disabled>Select Shipment Preference</option>
                      <option value="Transport">Transport</option>
                      <option value="Dedicated Vehicle">Dedicated Vehicle</option>
                      <option value="Own Vehicle">Own Vehicle</option>
                    </select>
                  </div>
                </div>

                {paymentTerms === 'Advance' && (() => {
                  const paidPctNum = Math.min(100, Math.max(0, Number(advancePaidPct === '' ? 0 : advancePaidPct) || 0));
                  const pendingPctNum = Math.max(0, 100 - paidPctNum);
                  const grandTotalVal = Number(getGrandTotal() || 0);
                  const paidAmt = (grandTotalVal * paidPctNum) / 100;
                  const pendingAmt = (grandTotalVal * pendingPctNum) / 100;
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label htmlFor="purchase-orders-advance-paid" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                            Paid (%)
                          </label>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>
                            ₹{paidAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <input
                          id="purchase-orders-advance-paid"
                          name="advancePaidPct"
                          aria-label="Advance Paid Percentage"
                          type="number"
                          min="0"
                          max="100"
                          value={advancePaidPct}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '') {
                              setAdvancePaidPct('');
                              return;
                            }
                            const clamped = Math.min(100, Math.max(0, Number(raw) || 0));
                            setAdvancePaidPct(String(clamped));
                          }}
                          style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155', width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label htmlFor="purchase-orders-advance-pending" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                            Pending (%)
                          </label>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>
                            ₹{pendingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <input
                          id="purchase-orders-advance-pending"
                          name="advancePendingPct"
                          aria-label="Advance Pending Percentage"
                          type="number"
                          min="0"
                          max="100"
                          value={pendingPctNum}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const pendingVal = raw === '' ? 0 : Math.min(100, Math.max(0, Number(raw) || 0));
                            setAdvancePaidPct(String(100 - pendingVal));
                          }}
                          style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155', width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  );
                })()}

                <div style={{ display: 'grid', gridTemplateColumns: shipmentPref === 'Transport' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-scope" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Scope <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <select id="purchase-orders-scope" name="scope" aria-label="Scope" value={scope} onChange={(e) => setScope(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155' }}>
                      <option value="Vendor Scope">Vendor Scope</option>
                      <option value="VRM Structure Scope">VRM Structure Scope</option>
                    </select>
                  </div>

                  {shipmentPref === 'Transport' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label htmlFor="purchase-orders-transport-name-carrier" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                        Transport Name / Carrier <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                      </label>
                      <input id="purchase-orders-transport-name-carrier" name="transportNameCarrier" aria-label="Transport Name / Carrier"
                        type="text"
                        value={transportName}
                        onChange={(e) => setTransportName(e.target.value)}
                        placeholder="e.g. A2B transport, Blackbird..."
                        style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155' }}
                       />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-priority" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Priority <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <select id="purchase-orders-priority" name="priority" aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155' }}>
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

              </div>

              {/* 3. Items Table */}
              <PoItemsTableSection
                items={items}
                setItems={setItems}
                presetGroups={presetGroups}
                setPresetGroups={setPresetGroups}
                deleteIdx={deleteIdx}
                setDeleteIdx={setDeleteIdx}
                availableCatalogItems={availableCatalogItems}
                handleAddItem={handleAddItem}
                handleRemoveItem={handleRemoveItem}
                handleItemChange={handleItemChange}
                handleAddSetItem={handleAddSetItem}
                handleRemovePresetGroup={handleRemovePresetGroup}
                handleUpdateGroupKitPrice={handleUpdateGroupKitPrice}
                setShowCreateSetModal={setShowCreateSetModal}
                setShowBulkItemModal={setShowBulkItemModal}
                viewMode={viewMode}
                isProcurementRole={isProcurementRole}
                setNewSetName={setNewSetName}
                setNewSetCount={setNewSetCount}
                setNewSetUnit={setNewSetUnit}
                setNewSetPrice={setNewSetPrice}
                setNewSetGstRate={setNewSetGstRate}
                setShowCreateProductModal={setShowCreateProductModal}
                setSelectedBulkItems={setSelectedBulkItems}
                setBulkCategoryFilter={setBulkCategoryFilter}
                setBulkItemSearch={setBulkItemSearch}
              />
              {/* 4. Calculations Summary & Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>

                {/* Notes & Terms */}
                <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                      4
                    </div>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      NOTES &amp; TERMS
                    </h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label htmlFor="purchase-orders-notes-remarks" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Notes & Remarks</label>
                    <textarea id="purchase-orders-notes-remarks" name="notesRemarks" aria-label="Notes & Remarks" value={notes} onChange={(e) => setNotes(e.target.value)} rows="3" placeholder="Add remarks for internal reference..." style={{ borderRadius: '8px', border: '1px solid #cbd5e1', padding: '10px 12px', fontSize: '13px', fontFamily: 'inherit', resize: 'none' }}  />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Terms & Conditions</label>
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>Select a preset to auto-fill</span>
                    </div>

                    {/* Clean Preset Pill Buttons */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTermsPreset('');
                          setTerms('');
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: selectedTermsPreset === '' ? '1px dashed #64748B' : '1px solid #CBD5E1',
                          backgroundColor: selectedTermsPreset === '' ? '#F1F5F9' : '#FFFFFF',
                          color: selectedTermsPreset === '' ? '#0F172A' : '#64748B',
                          fontSize: '11px',
                          fontWeight: selectedTermsPreset === '' ? '600' : '500',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Clear / Custom
                      </button>
                      {TERMS_PRESETS.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => {
                            setSelectedTermsPreset(p.key);
                            setTerms(p.text);
                          }}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: selectedTermsPreset === p.key ? '1px solid #2563EB' : '1px solid #CBD5E1',
                            backgroundColor: selectedTermsPreset === p.key ? '#2563EB' : '#FFFFFF',
                            color: selectedTermsPreset === p.key ? '#FFFFFF' : '#475569',
                            fontSize: '11px',
                            fontWeight: selectedTermsPreset === p.key ? '600' : '500',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <textarea id="purchase-orders-terms" name="terms" aria-label="Select a preset above or type custom Terms & Conditions"
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      rows="6"
                      placeholder="Select a preset above or type custom Terms & Conditions..."
                      style={{ borderRadius: '8px', border: '1px solid #cbd5e1', padding: '10px 12px', fontSize: '12px', fontFamily: 'inherit', resize: 'vertical', minHeight: '130px', backgroundColor: '#FFFFFF' }}
                     />
                  </div>
                </div>

                {/* Calculations Summary */}
                <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                      5
                    </div>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      SUMMARY DETAILS
                    </h3>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>Subtotal</span>
                    <strong style={{ color: '#334155' }}>₹ {getSubTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>Discount (%)</span>
                    <input id="purchase-orders-discount-pct" name="discountPct" aria-label="DiscountPct" type="number" value={discountPct} onChange={(e) => setDiscountPct(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '60px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', textAlign: 'right', fontSize: '12px' }}  />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>CGST ({getEffectiveCGSTPct()}%)</span>
                    <strong style={{ color: '#334155' }}>₹ {getCGST().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>SGST ({getEffectiveSGSTPct()}%)</span>
                    <strong style={{ color: '#334155' }}>₹ {getSGST().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>Shipping Charges (₹)</span>
                    <input id="purchase-orders-shipping-charges" name="shippingCharges" aria-label="ShippingCharges" type="number" value={shippingCharges} onChange={(e) => setShippingCharges(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', textAlign: 'right', fontSize: '12px' }}  />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>Other Charges (₹)</span>
                    <input id="purchase-orders-other-charges" name="otherCharges" aria-label="OtherCharges" type="number" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', textAlign: 'right', fontSize: '12px' }}  />
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>Grand Total</strong>
                    <strong style={{ fontSize: '15px', color: '#2563eb' }}>
                      ₹{getGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>

                </div>

              </div>


            </div>
          )}

          {/* Sticky Bottom Action Bar Following with Scroll for Create / Edit Purchase Order */}
          {(viewMode === 'create' || viewMode === 'edit') && (
            <div
              style={{
                position: 'sticky',
                bottom: 0,
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderTop: '1.5px solid #CBD5E1',
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                zIndex: 50,
                boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.08)',
                borderRadius: '12px',
                marginTop: '12px',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Save as Draft */}
                <button
                  type="button"
                  onClick={(e) => executeCreatePO(e, 'Draft')}
                  disabled={isSubmittingPO}
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#334155',
                    padding: '0 20px',
                    fontWeight: '600',
                    cursor: isSubmittingPO ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease',
                    opacity: isSubmittingPO ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => { if (!isSubmittingPO) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                  onMouseLeave={(e) => { if (!isSubmittingPO) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                >
                  {isSubmittingPO ? 'Saving...' : 'Save as Draft'}
                </button>

                {/* Cancel */}
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(true)}
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#334155',
                    padding: '0 20px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                >
                  Cancel
                </button>

                {/* Submit for Review Button */}
                <button
                  type="button"
                  onClick={triggerSaveConfirm}
                  disabled={isSubmittingPO}
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    padding: '0 22px',
                    fontWeight: '600',
                    cursor: isSubmittingPO ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                    opacity: isSubmittingPO ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => { if (!isSubmittingPO) e.currentTarget.style.backgroundColor = '#1D4ED8'; }}
                  onMouseLeave={(e) => { if (!isSubmittingPO) e.currentTarget.style.backgroundColor = '#2563EB'; }}
                >
                  {isSubmittingPO ? 'Processing...' : (viewMode === 'edit' ? 'Save Changes' : 'Submit for Review')}
                </button>
              </div>

              {/* Grand Total Display */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Grand Total:</span>
                <strong style={{ fontSize: '15px', color: '#2563EB', fontWeight: '800' }}>
                  ₹{getGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          )}

          {/* Sticky Bottom Action Bar Following with Scroll for View Purchase Order */}
          {viewMode === 'view' && (
            <div
              className="po-no-print"
              style={{
                position: 'sticky',
                bottom: 0,
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderTop: '1.5px solid #CBD5E1',
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                zIndex: 50,
                boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.08)',
                borderRadius: '12px',
                marginTop: '12px',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#334155',
                    padding: '0 18px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                >
                  <ArrowLeft size={15} /> Back to PO List
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber) || {};
                    setPrintPoModal({
                      ...currentPoObj,
                      poNo: poNumber,
                      poDate,
                      deliveryDate,
                      paymentTerms,
                      purchaser,
                      vendorName,
                      branch,
                      contactPerson,
                      contactNo,
                      email,
                      gstNo,
                      deliveryAddress,
                      deliveryCompanyName,
                      billingAddress,
                      items,
                      presetGroups,
                      notes,
                      terms,
                      discountPct,
                      shippingCharges,
                      otherCharges
                    });
                  }}
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    border: '1.5px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#334155',
                    padding: '0 18px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                >
                  <FileText size={15} style={{ color: '#059669' }} /> Export / Print PDF
                </button>

                {!isExecutiveOrMD && !isAccounts && (
                  <button
                    type="button"
                    onClick={() => {
                      const matchedPo = poList.find(p => p.poNo === poNumber || p.id === poNumber) || {
                        poNo: poNumber, vendor: vendorName, branch, contactPerson, contactNo, email, gstNo,
                        deliveryType, deliveryAddress, billingAddress, poDate, deliveryDate, paymentTerms,
                        purchaser, shipmentPref, currency, project, priority, items, shippingCharges, otherCharges,
                        discountPct, notes, terms, approvalRequired, approver
                      };
                      handleStartClone(matchedPo);
                    }}
                    style={{
                      height: '40px',
                      borderRadius: '8px',
                      border: '1px solid #C7D2FE',
                      backgroundColor: '#EEF2FF',
                      color: '#4338CA',
                      padding: '0 18px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '13.5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Copy size={14} style={{ color: '#4338CA' }} /> Clone PO
                  </button>
                )}

                {(() => {
                  const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber) || {
                    poNo: poNumber,
                    vendor: vendorName,
                    amount: `₹ ${Number(getGrandTotal() || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    paymentTerms
                  };
                  const stUpper = String(viewingPoStatus || currentPoObj?.status || '').toUpperCase();
                  const isPoClosedOrCancelled = stUpper.includes('CLOSED') || stUpper.includes('FULLY RECEIVED') || stUpper === 'CANCELLED';
                  if (isPoClosedOrCancelled) {
                    const reasonText = currentPoObj?.cancelReason || currentPoObj?.cancellationRemark || currentPoObj?.rejectReason || '';
                    if (stUpper === 'CANCELLED' && reasonText) {
                      return (
                        <div style={{ padding: '6px 12px', borderRadius: '8px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: '12px', fontWeight: '700' }}>
                          Cancelled Reason: {reasonText}
                        </div>
                      );
                    }
                    return null;
                  }
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setCancellingPo(currentPoObj);
                        setCancellationRemarkInput('');
                      }}
                      style={{
                        height: '40px',
                        borderRadius: '8px',
                        border: '1px solid #FECACA',
                        backgroundColor: '#FEF2F2',
                        color: '#DC2626',
                        padding: '0 18px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontSize: '13.5px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Ban size={15} style={{ color: '#DC2626' }} /> Cancel PO
                    </button>
                  );
                })()}
              </div>

              {/* Grand Total Display */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Grand Total:</span>
                <strong style={{ fontSize: '15px', color: '#2563EB', fontWeight: '800' }}>
                  ₹{getGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== CEO LOGIN PURCHASE ORDER DETAILS MODAL POPUP ==================== */}
      <CeoPoDetailModal
        showCeoPoModal={showCeoPoModal}
        setShowCeoPoModal={setShowCeoPoModal}
        poNumber={poNumber}
        poDate={poDate}
        deliveryDate={deliveryDate}
        vendorName={vendorName}
        gstNo={gstNo}
        contactPerson={contactPerson}
        contactNo={contactNo}
        email={email}
        branch={branch}
        purchaser={purchaser}
        deliveryAddress={deliveryAddress}
        billingAddress={billingAddress}
        items={items}
        notes={notes}
        terms={terms}
        paymentTerms={paymentTerms}
        canApproveAsMD={canApproveAsMD}
        handleApprovePoSubmit={handleApprovePoSubmit}
        setRejectingPo={setRejectingPo}
      />

      {/* ==================== ZOHO BOOKS STYLE "ADD ITEMS IN BULK" MODAL ==================== */}
      <PoBulkItemModal
        showBulkItemModal={showBulkItemModal}
        setShowBulkItemModal={setShowBulkItemModal}
        bulkItemSearch={bulkItemSearch}
        setBulkItemSearch={setBulkItemSearch}
        bulkCategoryFilter={bulkCategoryFilter}
        setBulkCategoryFilter={setBulkCategoryFilter}
        filteredBulkCatalog={filteredBulkCatalog}
        selectedBulkItems={selectedBulkItems}
        setSelectedBulkItems={setSelectedBulkItems}
        setItems={setItems}
        setShowCreateProductModal={setShowCreateProductModal}
      />
      {/* ==================== CREATE NEW PRODUCT MODAL ==================== */}
      <CreateProductModal
        isOpen={showCreateProductModal}
        onClose={() => setShowCreateProductModal(false)}
        onProductCreated={handleProductCreatedFromModal}
        defaultCategory="Raw Material"
      />

      {/* ==================== CONFIRMATION & DISCARD MODALS ==================== */}
      <PoConfirmationModals
        deleteIdx={deleteIdx}
        setDeleteIdx={setDeleteIdx}
        poList={poList}
        executeDeletePO={executeDeletePO}
        items={items}
        showSaveConfirm={showSaveConfirm}
        setShowSaveConfirm={setShowSaveConfirm}
        deliveryAddress1={deliveryAddress1}
        deliveryAddress2={deliveryAddress2}
        deliveryCity={deliveryCity}
        deliveryState={deliveryState}
        deliveryPincode={deliveryPincode}
        deliveryAddress={deliveryAddress}
        getTaxableAmount={getTaxableAmount}
        getCGST={getCGST}
        getSGST={getSGST}
        getGrandTotal={getGrandTotal}
        viewMode={viewMode}
        poNumber={poNumber}
        vendorName={vendorName}
        purchaser={purchaser}
        poDate={poDate}
        deliveryDate={deliveryDate}
        paymentTerms={paymentTerms}
        priority={priority}
        isSubmittingPO={isSubmittingPO}
        executeCreatePO={executeCreatePO}
        showCancelConfirm={showCancelConfirm}
        setShowCancelConfirm={setShowCancelConfirm}
        setViewMode={setViewMode}
        cancellingPo={cancellingPo}
        setCancellingPo={setCancellingPo}
        cancellationRemarkInput={cancellationRemarkInput}
        setCancellationRemarkInput={setCancellationRemarkInput}
        handleCancelPoSubmit={handleCancelPoSubmit}
      />
      {/* ==================== WORKFLOW & AUDIT MODALS ==================== */}
      <PoWorkflowModals
        rejectingPo={rejectingPo}
        setRejectingPo={setRejectingPo}
        rejectionReasonInput={rejectionReasonInput}
        setRejectionReasonInput={setRejectionReasonInput}
        handleRejectPoSubmit={handleRejectPoSubmit}
        approvingPo={approvingPo}
        setApprovingPo={setApprovingPo}
        approvalRemarksInput={approvalRemarksInput}
        setApprovalRemarksInput={setApprovalRemarksInput}
        handleApprovePoSubmit={handleApprovePoSubmit}
        paymentProcessingPo={paymentProcessingPo}
        setPaymentProcessingPo={setPaymentProcessingPo}
        payAmountInput={payAmountInput}
        setPayAmountInput={setPayAmountInput}
        payModeInput={payModeInput}
        setPayModeInput={setPayModeInput}
        payRefInput={payRefInput}
        setPayRefInput={setPayRefInput}
        payRemarksInput={payRemarksInput}
        setPayRemarksInput={setPayRemarksInput}
        payCreditTermsInput={payCreditTermsInput}
        setPayCreditTermsInput={setPayCreditTermsInput}
        payImagesInput={payImagesInput}
        handlePaymentImageUpload={handlePaymentImageUpload}
        handleRemovePaymentImage={handleRemovePaymentImage}
        setPreviewZoomImage={setPreviewZoomImage}
        handleProcessPaymentSubmit={handleProcessPaymentSubmit}
        proceedingPo={proceedingPo}
        setProceedingPo={setProceedingPo}
        proceedPhoneInput={proceedPhoneInput}
        setProceedPhoneInput={setProceedPhoneInput}
        proceedEmailInput={proceedEmailInput}
        setProceedEmailInput={setProceedEmailInput}
        proceedRemarksInput={proceedRemarksInput}
        setProceedRemarksInput={setProceedRemarksInput}
        proceedMessageContent={proceedMessageContent}
        setProceedMessageContent={setProceedMessageContent}
        handleSendViaWhatsApp={handleSendViaWhatsApp}
        handleProceedPoSubmit={handleProceedPoSubmit}
        previewZoomImage={previewZoomImage}
        creditAlertPopup={creditAlertPopup}
        setCreditAlertPopup={setCreditAlertPopup}
        poList={poList}
        handleOpenProceedPoModal={handleOpenProceedPoModal}
        validationErrorModal={validationErrorModal}
        setValidationErrorModal={setValidationErrorModal}
        showCreateSetModal={showCreateSetModal}
        setShowCreateSetModal={setShowCreateSetModal}
        isProcurementRole={isProcurementRole}
        isProcurementHead={isProcurementHead}
        newSetName={newSetName}
        setNewSetName={setNewSetName}
        newSetUnit={newSetUnit}
        setNewSetUnit={setNewSetUnit}
        newSetCount={newSetCount}
        setNewSetCount={setNewSetCount}
        newSetPrice={newSetPrice}
        setNewSetPrice={setNewSetPrice}
        newSetGstRate={newSetGstRate}
        setNewSetGstRate={setNewSetGstRate}
        handleCreateCustomSet={handleCreateCustomSet}
        customAlert={customAlert}
        setCustomAlert={setCustomAlert}
      />
      {/* ─── OFFICIAL PO PRINTOUT / EXPORT PDF TEMPLATE ─── */}
      {printPoModal && (
        <VRMPurchaseOrderPrintTemplate
          po={printPoModal}
          onClose={() => setPrintPoModal(null)}
        />
      )}

      {/* ─── CUSTOM TOAST NOTIFICATION POPUP (MATCHES DESIGN SYSTEM) ─── */}
      {customAlert && (
        <NotificationToast
          alert={customAlert}
          onClose={() => setCustomAlert(null)}
        />
      )}
    </div>
  );
}
