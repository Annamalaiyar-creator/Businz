import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Plus, Check, Trash2, Eye, FileText, Search, PlusCircle, AlertCircle, AlertTriangle, X,
  TrendingUp, Users, CheckCircle, Clock, ShieldAlert, Award,
  MapPin, Phone, Mail, FileCheck, CheckSquare, XCircle, ArrowRight, ArrowLeft,
  TrendingDown, DollarSign, Calendar, Edit3, SlidersHorizontal, Filter,
  ChevronLeft, ChevronRight, MoreVertical, RotateCcw, UploadCloud, ChevronDown, ChevronUp, ExternalLink,
  Truck, Shield, Package, Star, Download, HelpCircle, Info, ShoppingCart, Upload, Printer, Maximize2,
  ShieldCheck, Layers, Factory, Cpu, Receipt, IndianRupee, Smartphone, Camera, Image, RefreshCw,
  CreditCard, Bell, Video, Play, Pause, Film, Sparkles, MoreHorizontal, Copy, Hourglass, Boxes, Send,
  Wrench
} from 'lucide-react';
import TopSpendingCategories from '../TopSpendingCategories';
import POTrendChart from '../POTrendChart';
import { getSafeZohoVendors, getSafeZohoItems } from '../../services/zohoSafeSync';
import { fetchCloudStore, saveCloudStore, subscribeToCloudStore } from '../../utils/supabaseDataSync';
import { saveMediaToCache, getMediaFromCache, stripDataUrlsFromRecord, readCompressedImage, compressAndSaveFile } from '../../utils/otherViewsShared';
import { getFullProductsCatalogWithStock } from '../../utils/productCatalogService';
import { VRM_PRODUCTS, resolveProductCode, wordFingerprint, normalizeProductName, CANONICAL_PRODUCT_ALIASES } from '../../utils/vrmProductsData';


export default function StockStatusView(props) {
  const {
    activeTab,
    onChangeTab,
    userRole = 'Sales Executive',
    convertingPiData = null,
    onClearConvertingPiData
  } = props;

  const isSalesUser = userRole === 'Sales Executive' || userRole === 'Sales Head' || String(userRole || '').toLowerCase().includes('sales');

  // Common states
  const [searchQuery, setSearchQuery] = useState('');
  const [stockRefreshTrigger, setStockRefreshTrigger] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [showCreateGRN, setShowCreateGRN] = useState(false);
  const [grnItems, setGrnItems] = useState([]);
  const [selectedGRNPo, setSelectedGRNPo] = useState('');
  const [selectedGRNVendor, setSelectedGRNVendor] = useState('');
  const [grnChallanNo, setGrnChallanNo] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);
  const [grnDocs, setGrnDocs] = useState([]);
  const [livePOs, setLivePOs] = useState([]);
  const [poReceivingHistory, setPoReceivingHistory] = useState([]);
  const [selectedPOForDetail, setSelectedPOForDetail] = useState(null);
  const [poDetailData, setPoDetailData] = useState(null);

  const [grnToDelete, setGrnToDelete] = useState(null);
  const [isViewOnlyMode, setIsViewOnlyMode] = useState(false);
  const [editingGrnId, setEditingGrnId] = useState(null);
  const [deleteDocConfirmIdx, setDeleteDocConfirmIdx] = useState(null);
  const [activeDocPreviewModal, setActiveDocPreviewModal] = useState(null);

  const [grnReceivedBy, setGrnReceivedBy] = useState('');
  const [grnInspectorName, setGrnInspectorName] = useState('');
  const [grnInspectionRemarks, setGrnInspectionRemarks] = useState('');

  // Top-level state for Production Admin views to obey React Hook rules
  const [prodActiveSubTab, setProdActiveSubTab] = useState('All');
  const [prodSearchQueryText, setProdSearchQueryText] = useState('');
  const [prodFilterDateVal, setProdFilterDateVal] = useState('');
  const [prodFilterStatusSelect, setProdFilterStatusSelect] = useState('All');
  const [prodStatusFilterText, setProdStatusFilterText] = useState('All');

  useEffect(() => {
    setProdActiveSubTab('All');
    setProdSearchQueryText('');
    setProdFilterStatusSelect('All');
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

  const [customerList, setCustomerList] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_customer_store') || localStorage.getItem('controlroom_customer_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [
      { code: 'Vikram Solar Pvt Ltd', c2: 'Vikram Solar Pvt Ltd', gstNo: '33AABCU9603R1ZM', c3: 'Rajesh Kumar', c4: '+91 98765 43210', c5: 'rajesh@vikramsolar.com', status: 'ACTIVE', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Active' },
      { code: 'Tata Power Renewable', c2: 'Tata Power Ltd', gstNo: '29AAACT2727Q1ZW', c3: 'Anish Sharma', c4: '+91 98123 45678', c5: 'anish.s@tatapower.com', status: 'ACTIVE', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Active' },
      { code: 'Apex Infra Systems', c2: 'Apex Infra Ltd', gstNo: '33AABCA1234F1Z5', c3: 'Priya Sundaram', c4: '+91 99400 11223', c5: 'priya@apexinfra.com', status: 'ACTIVE', stBg: '#dcfce7', stFg: '#166534', stBorder: '1px solid #bbf7d0', tabGroup: 'Active' }
    ];
  });

  // Sync customerList with Supabase cloud database
  const isInitialCustMount = useRef(true);
  useEffect(() => {
    if (isInitialCustMount.current) {
      isInitialCustMount.current = false;
      return;
    }
    saveCloudStore('customer_store', customerList);
  }, [customerList]);

  const [customerActionMenuIdx, setCustomerActionMenuIdx] = useState(null);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [previewAddressProofModal, setPreviewAddressProofModal] = useState(null);
  const [bomActionMenuPos, setBomActionMenuPos] = useState({ top: 0, left: 0 });

  const [bomStore, setBomStore] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_bom_store');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  });

  // bomStore sync on mount and from cloud / storage
  useEffect(() => {
    fetchCloudStore('bom_store', bomStore).then(data => {
      if (data && Array.isArray(data) && data.length > 0) {
        setBomStore(prev => {
          const map = new Map();
          let localCurrent = Array.isArray(prev) ? prev : [];
          try {
            const savedStr = localStorage.getItem('controlroom_bom_store');
            if (savedStr) {
              const parsed = JSON.parse(savedStr);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const currentMap = new Map();
                localCurrent.forEach(i => i && currentMap.set(i.bomCode || i.code, i));
                parsed.forEach(i => i && currentMap.set(i.bomCode || i.code, i));
                localCurrent = Array.from(currentMap.values());
              }
            }
          } catch (e) { }

          data.forEach(item => {
            if (item) {
              const k = item.bomCode || item.code;
              if (k) map.set(k, item);
            }
          });
          localCurrent.forEach(item => {
            if (item) {
              const k = item.bomCode || item.code;
              if (k) {
                if (map.has(k)) {
                  map.set(k, { ...map.get(k), ...item });
                } else {
                  map.set(k, item);
                }
              }
            }
          });
          const merged = Array.from(map.values());
          const sanitizedMerged = merged.map(stripDataUrlsFromRecord);
          return sanitizedMerged;
        });
      }
    });

    const syncFromStorage = () => {
      try {
        const saved = localStorage.getItem('controlroom_bom_store');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBomStore(parsed);
          }
        }
      } catch (e) { }
      setStockRefreshTrigger(t => t + 1);
    };

    // Run sync immediately on mount
    syncFromStorage();

    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('controlroom_storage_update', syncFromStorage);
    window.addEventListener('central_inventory_updated', syncFromStorage);
    window.addEventListener('controlroom_raw_materials_update', syncFromStorage);

    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('controlroom_storage_update', syncFromStorage);
      window.removeEventListener('central_inventory_updated', syncFromStorage);
      window.removeEventListener('controlroom_raw_materials_update', syncFromStorage);
    };
  }, []);

  const [bomActionMenuIdx, setBomActionMenuIdx] = useState(null);
  const [showFloatingMoreMenu, setShowFloatingMoreMenu] = useState(false);
  const [quickPreviewRecord, setQuickPreviewRecord] = useState(null);
  const [confirmingBomModal, setConfirmingBomModal] = useState(null); // Full BOM object being confirmed by Salesperson
  const [uploadPaymentModal, setUploadPaymentModal] = useState(null); // Full BOM object uploading payment proof
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [paymentStageType, setPaymentStageType] = useState('100% Advance'); // '100% Advance' | '50% Advance' | '50% Dispatch' | 'Net 30 Days'
  const [dispatchPackingModal, setDispatchPackingModal] = useState(null); // Full BOM object being packed by Dispatch Head
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

  const [newBomCode, setNewBomCode] = useState('');
  const [newBomProductName, setNewBomProductName] = useState('');
  const [newBomSku, setNewBomSku] = useState('');
  const [newBomRevision, setNewBomRevision] = useState('');
  const [newBomTargetQty, setNewBomTargetQty] = useState('');
  const [newBomStatus, setNewBomStatus] = useState('ACTIVE');
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
  const [selectedPreset, setSelectedPreset] = useState('');
  const [presetSetCount, setPresetSetCount] = useState(1);
  const [selectedBomItemIndexes, setSelectedBomItemIndexes] = useState([]);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [bomConfirmModal, setBomConfirmModal] = useState(null); // { type: 'cancel' | 'draft' | 'create' }
  const [reuploadAddressProofModal, setReuploadAddressProofModal] = useState(null); // BOM object requiring address proof re-upload
  const [reuploadProofFile, setReuploadProofFile] = useState(null);
  const [updatePaymentModal, setUpdatePaymentModal] = useState(null); // BOM object for updating payment (Partial/Credit)
  const [updatePaymentFile, setUpdatePaymentFile] = useState(null);
  const [updatePaymentNotes, setUpdatePaymentNotes] = useState('');



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
  const [completedBomSummaryModal, setCompletedBomSummaryModal] = useState(null); // Completed BOM object

  const [customAlert, setCustomAlert] = useState(null);

  const showCustomAlert = (msg, title = null, type = null) => {
    let detectedType = type;
    let detectedTitle = title;
    const strMsg = String(msg || '');

    if (!detectedType) {
      if (strMsg.includes('❌') || strMsg.toLowerCase().includes('wrong') || strMsg.toLowerCase().includes('error') || strMsg.toLowerCase().includes('fail') || strMsg.toLowerCase().includes('invalid') || strMsg.toLowerCase().includes('unable') || strMsg.toLowerCase().includes('cannot')) {
        detectedType = 'error';
        if (!detectedTitle) detectedTitle = 'Uh oh! Something went wrong';
      } else if (strMsg.includes('⚠️') || strMsg.toLowerCase().includes('warning') || strMsg.toLowerCase().includes('mandatory') || strMsg.toLowerCase().includes('differs') || strMsg.toLowerCase().includes('please')) {
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
      type: detectedType || 'info'
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

  // Reset GRN modal state to clean initial state
  const resetCreateGRNForm = () => {
    setSelectedGRNPo('');
    setSelectedGRNVendor('');
    setGrnChallanNo('');
    setGrnReceivedBy('');
    setGrnInspectorName('');
    setGrnInspectionRemarks('');
    setGrnItems([]);
    setPoReceivingHistory([]);
    setIsViewOnlyMode(false);
    setEditingGrnId(null);
  };

  // Fetch live Zoho Purchase Orders & stored GRNs for GRN selection and list display
  useEffect(() => {
    fetch('/api/zoho/purchaseorders')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLivePOs(data);
        }
      })
      .catch(err => console.error('Error fetching live POs:', err));
  }, []);

  useEffect(() => {
    if (activeTab === 'Goods Receipt Note' || activeTab === 'Goods Receipt Note (GRN)') {
      fetch('/api/grns')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const formattedList = data.map(g => ({
              id: g.grnNo || g.id,
              poRef: g.poRef || g.poNo || '—',
              vendor: g.vendor || '—',
              date: g.date || '—',
              received: `${g.receivedQty || 0} Units`,
              status: g.status || 'Approved',
              val: `₹ ${(g.receivedQty || 0) * 1250}`,
              challanNo: g.challanNo || '',
              receivedBy: g.receivedBy || '',
              inspectorName: g.inspectorName || '',
              inspectionRemarks: g.inspectionRemarks || '',
              documents: g.documents || []
            }));
            setGrnList(formattedList);
          }
        })
        .catch(err => console.error('Error fetching stored GRNs:', err));
    }
  }, [activeTab]);

  // Function to load PO details and line items when a PO is selected
  const loadPOItems = (selectedId, currentLivePOs = livePOs) => {
    if (!selectedId) {
      setSelectedGRNPo('');
      setGrnItems([]);
      setSelectedGRNVendor('');
      setPoReceivingHistory([]);
      return;
    }

    const found = currentLivePOs.find(p => p.poNo === selectedId || p.id === selectedId);
    const vendorName = found ? found.vendor : 'Vendor';
    const targetId = found ? (found.id || selectedId) : selectedId;
    const poRef = found ? (found.poNo || selectedId) : selectedId;

    setSelectedGRNPo(poRef);
    setSelectedGRNVendor(vendorName);

    Promise.all([
      fetch(`/api/zoho/purchaseorders/${encodeURIComponent(targetId)}`).then(res => res.ok ? res.json().catch(() => null) : null),
      fetch(`/api/po-receiving-history/${encodeURIComponent(poRef)}`).then(res => res.ok ? res.json().catch(() => null) : null)
    ])
      .then(([detail, historyData]) => {
        let rawItems = (detail && Array.isArray(detail.items) && detail.items.length > 0)
          ? detail.items
          : [
            { name: 'Solar Mounting Structure', description: 'HDG Aluminium Profile Rail 40x40mm', qty: 3000, unit: 'NOS' },
            { name: 'Fasteners M8*50 SS304', description: 'SS304 Allen Bolt with Washer', qty: 1000, unit: 'Set' }
          ];

        const historyTotals = (historyData && historyData.itemReceivedTotals) ? historyData.itemReceivedTotals : {};
        const historyList = (historyData && historyData.grnHistory) ? historyData.grnHistory : [];

        const items = rawItems.map((it, idx) => {
          const itemId = it.id || it.itemId || it.lineItemId || `PO-ITEM-${idx}`;
          const itemName = (it.name || '').trim().toLowerCase();

          let prev = 0;
          if (historyTotals[itemId] !== undefined) {
            prev = Number(historyTotals[itemId]);
          } else if (historyTotals[itemName] !== undefined) {
            prev = Number(historyTotals[itemName]);
          } else if (historyTotals[idx] !== undefined) {
            prev = Number(historyTotals[idx]);
          } else if (it.previouslyReceived !== undefined) {
            prev = Number(it.previouslyReceived);
          }

          const ordered = it.qty || 0;
          const remaining = (it.remainingQty !== undefined) ? Number(it.remainingQty) : Math.max(0, ordered - prev);

          return {
            id: itemId,
            name: it.name,
            sku: it.sku || `SKU-${101 + idx}`,
            desc: it.description || '',
            uom: it.unit || 'NOS',
            ordered: ordered,
            prev: prev,
            remaining: remaining,
            now: '',
            accepted: '',
            rejected: 0,
            reason: '—',
            batch: `LOT-2026-${idx + 1}`
          };
        });

        setGrnItems(items);
        setPoReceivingHistory(historyList);
      })
      .catch(err => console.error('Error fetching PO receiving history:', err));
  };

  // Fetch detailed PO summary and GRN receiving history when viewing PO detail
  useEffect(() => {
    if (selectedPOForDetail) {
      const found = livePOs.find(p => p.poNo === selectedPOForDetail || p.id === selectedPOForDetail);
      const targetId = found ? found.id : selectedPOForDetail;

      fetch(`/api/zoho/purchaseorders/${targetId}`)
        .then(res => res.json())
        .then(data => setPoDetailData(data))
        .catch(err => console.error('Error fetching PO detail:', err));
    } else {
      setPoDetailData(null);
    }
  }, [selectedPOForDetail, livePOs]);

  // Add Stock Form States
  const [showAddStockForm, setShowAddStockForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState('INV-1042');
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('PAY-0087');
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [stockEntry, setStockEntry] = useState({
    entryType: 'Stock Addition',
    warehouse: 'Main Warehouse',
    entryDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    reason: 'Opening Stock',
    refNo: '',
    addedBy: 'Admin User'
  });
  const [addStockItems, setAddStockItems] = useState([]);
  const [stockDetails, setStockDetails] = useState({
    batchNo: '',
    supplier: '',
    mfgDate: '',
    expiryDate: '',
    storageLocation: 'Rack A-04',
    remarks: ''
  });
  const [stockDocs, setStockDocs] = useState([]);

  useEffect(() => {
    setSelectedRows([]);
    setShowAddStockForm(false);
  }, [activeTab]);

  const [grnValidationModal, setGrnValidationModal] = useState(null);

  const handleSaveAndReceive = () => {
    const missing = [];
    if (!selectedGRNPo) missing.push('Purchase Order');
    if (!selectedGRNVendor) missing.push('Vendor');
    if (!grnChallanNo || String(grnChallanNo).trim() === '') missing.push('DC NO / Invoice No.');
    if (!grnReceivedBy || String(grnReceivedBy).trim() === '') missing.push('Received By');

    if (missing.length > 0) {
      setGrnValidationModal({ title: 'Mandatory Fields Required', fields: missing, message: 'Please complete all required fields to proceed.' });
      return;
    }

    // Prepare item list with defaults if user didn't type explicit numbers into inputs
    const processedItems = grnItems.map(it => {
      const remaining = Math.max(0, (it.ordered || 0) - (it.prev || 0));
      const nowVal = (it.now !== '' && it.now !== undefined && it.now !== null) ? Number(it.now) : (remaining > 0 ? remaining : (it.ordered || 1));
      const acceptedVal = (it.accepted !== '' && it.accepted !== undefined && it.accepted !== null) ? Number(it.accepted) : nowVal;
      return {
        ...it,
        now: nowVal,
        accepted: acceptedVal,
        rejected: Number(it.rejected || 0)
      };
    });

    const invalidItem = processedItems.find(it => {
      const remaining = Math.max(0, (it.ordered || 0) - (it.prev || 0));
      return (it.now || 0) > remaining && remaining > 0;
    });

    if (invalidItem) {
      const remaining = Math.max(0, (invalidItem.ordered || 0) - (invalidItem.prev || 0));
      setGrnValidationModal({
        title: 'Validation Error',
        message: `Received quantity (${invalidItem.now}) for "${invalidItem.name}" cannot exceed the pending quantity of ${remaining}.`
      });
      return;
    }

    const totalNow = processedItems.reduce((acc, it) => acc + Number(it.now || 0), 0);
    const totalAccepted = processedItems.reduce((acc, it) => acc + Number(it.accepted || 0), 0);
    const totalRejected = processedItems.reduce((acc, it) => acc + Number(it.rejected || 0), 0);

    const docsToAttach = grnDocs || [];

    const payload = {
      poRef: selectedGRNPo,
      poNo: selectedGRNPo,
      vendor: selectedGRNVendor || 'Vendor',
      challanNo: grnChallanNo || 'DC-NEW',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      receivedQty: totalNow,
      acceptedQty: totalAccepted,
      rejectedQty: totalRejected,
      receivedBy: grnReceivedBy || '',
      inspectorName: grnInspectorName || '',
      inspectionRemarks: grnInspectionRemarks || '',
      items: processedItems,
      documents: docsToAttach
    };

    fetch('/api/grns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.grn) {
          const formattedGRN = {
            id: data.grn.grnNo || data.grn.id,
            poRef: data.grn.poRef || data.grn.poNo || '—',
            vendor: data.grn.vendor || '—',
            date: data.grn.date || '—',
            received: `${totalNow} Units`,
            status: data.grn.status || 'OPEN / PARTIALLY RECEIVED',
            val: `₹ ${totalNow * 1250}`,
            challanNo: data.grn.challanNo || grnChallanNo,
            receivedBy: data.grn.receivedBy || grnReceivedBy,
            documents: data.grn.documents || docsToAttach
          };

          setGrnList(prev => [formattedGRN, ...prev.filter(g => g.id !== formattedGRN.id)]);

          fetch('/api/grns')
            .then(res => res.json())
            .then(grns => {
              if (Array.isArray(grns)) {
                setGrnList(grns.map(g => ({
                  id: g.grnNo || g.id,
                  poRef: g.poRef || g.poNo || '—',
                  vendor: g.vendor || '—',
                  date: g.date || '—',
                  received: `${g.receivedQty || 0} Units`,
                  status: g.status || 'Approved',
                  val: `₹ ${(g.receivedQty || 0) * 1250}`,
                  challanNo: g.challanNo || '',
                  receivedBy: g.receivedBy || '',
                  inspectorName: g.inspectorName || '',
                  inspectionRemarks: g.inspectionRemarks || '',
                  documents: g.documents || []
                })));
              }
            });

          fetch('/api/zoho/purchaseorders')
            .then(res => res.json())
            .then(d => { if (Array.isArray(d)) setLivePOs(d); });

          fetch('/api/zoho/items')
            .then(res => res.json())
            .then(items => { if (Array.isArray(items)) setItemsList(items); });
        }
        setShowCreateGRN(false);
        resetCreateGRNForm();
      })
      .catch(err => {
        console.error('Failed to post GRN to API, saving to local state fallback:', err);
        const fallbackGRN = {
          id: `GRN-2026-${String(grnList.length + 101).padStart(5, '0')}`,
          poRef: selectedGRNPo || 'PO-00001',
          vendor: selectedGRNVendor || 'Vendor',
          date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          received: `${totalNow} Units`,
          status: 'OPEN / PARTIALLY RECEIVED',
          val: `₹ ${totalNow * 1250}`,
          challanNo: grnChallanNo,
          receivedBy: grnReceivedBy,
          documents: docsToAttach
        };
        setGrnList(prev => [fallbackGRN, ...prev]);
        setShowCreateGRN(false);
        resetCreateGRNForm();
      });
  };

  const handleFullyReceived = () => {
    if (!selectedGRNPo) {
      setGrnValidationModal({ title: 'Purchase Order Required', message: 'Please select a Purchase Order to mark as Fully Received.' });
      return;
    }

    const completedItems = grnItems.map(it => {
      const ord = it.ordered || (it.prev ? it.prev + (it.now || 1) : (it.now || 1));
      const nowQty = Math.max(1, (it.now && it.now > 0) ? it.now : (ord - (it.prev || 0)));
      const acceptedQty = Math.max(1, (it.accepted && it.accepted > 0) ? it.accepted : nowQty);
      return {
        ...it,
        ordered: ord,
        now: nowQty,
        accepted: acceptedQty,
        rejected: 0,
        reason: '—'
      };
    });

    const totalAccepted = completedItems.reduce((acc, it) => acc + Number(it.accepted || 0), 0);
    const docsToAttach = grnDocs || [];

    const payload = {
      poRef: selectedGRNPo,
      poNo: selectedGRNPo,
      vendor: selectedGRNVendor || 'Vendor',
      challanNo: grnChallanNo || 'DC-FINAL',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      receivedQty: totalAccepted,
      acceptedQty: totalAccepted,
      rejectedQty: 0,
      receivedBy: grnReceivedBy || 'Store Manager',
      inspectorName: grnInspectorName || 'Quality Inspector',
      inspectionRemarks: grnInspectionRemarks || 'PO Marked as Fully Received & Closed',
      items: completedItems,
      documents: docsToAttach,
      status: 'CLOSED / FULLY RECEIVED',
      forceClosePO: true
    };

    fetch('/api/grns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        if (data.grn) {
          const formattedGRN = {
            id: data.grn.grnNo || data.grn.id,
            poRef: data.grn.poRef || data.grn.poNo || '—',
            vendor: data.grn.vendor || '—',
            date: data.grn.date || '—',
            received: `${totalAccepted} Units`,
            status: 'CLOSED / FULLY RECEIVED',
            val: `₹ ${totalAccepted * 1250}`,
            challanNo: data.grn.challanNo || grnChallanNo,
            receivedBy: data.grn.receivedBy || grnReceivedBy,
            documents: data.grn.documents || docsToAttach
          };

          setGrnList(prev => [formattedGRN, ...prev.filter(g => g.id !== formattedGRN.id)]);
        }

        fetch('/api/grns')
          .then(res => res.json())
          .then(grns => {
            if (Array.isArray(grns)) {
              setGrnList(grns.map(g => ({
                id: g.grnNo || g.id,
                poRef: g.poRef || g.poNo || '—',
                vendor: g.vendor || '—',
                date: g.date || '—',
                received: `${g.receivedQty || 0} Units`,
                status: g.status || 'CLOSED / FULLY RECEIVED',
                val: `₹ ${(g.receivedQty || 0) * 1250}`,
                challanNo: g.challanNo || '',
                receivedBy: g.receivedBy || '',
                inspectorName: g.inspectorName || '',
                inspectionRemarks: g.inspectionRemarks || '',
                documents: g.documents || []
              })));
            }
          });

        fetch('/api/zoho/purchaseorders')
          .then(res => res.json())
          .then(d => { if (Array.isArray(d)) setLivePOs(d); });

        fetch('/api/zoho/items')
          .then(res => res.json())
          .then(items => { if (Array.isArray(items)) setItemsList(items); });

        setShowCreateGRN(false);
        resetCreateGRNForm();
      })
      .catch(err => {
        console.error('Failed to mark as Fully Received on API, saving to local state fallback:', err);
        const fallbackGRN = {
          id: `GRN-2026-${String(grnList.length + 101).padStart(5, '0')}`,
          poRef: selectedGRNPo || 'PO-00001',
          vendor: selectedGRNVendor || 'Vendor',
          date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          received: `${totalAccepted} Units`,
          status: 'CLOSED / FULLY RECEIVED',
          val: `₹ ${totalAccepted * 1250}`,
          challanNo: grnChallanNo || 'DC-FULL',
          receivedBy: grnReceivedBy || 'Store Manager',
          documents: docsToAttach
        };
        setGrnList(prev => [fallbackGRN, ...prev]);
        setShowCreateGRN(false);
        resetCreateGRNForm();
      });
  };

  const handleDeleteGRN = (targetId) => {
    const targetItem = grnList.find(g => g.id === targetId || g.grnNo === targetId);
    if (targetItem && (
      targetItem.status === 'CLOSED / FULLY RECEIVED' ||
      targetItem.status === 'Approved' ||
      targetItem.status === 'Fully Accepted' ||
      targetItem.status === 'Closed' ||
      targetItem.status === 'CLOSED'
    )) {
      alert('Fully received or approved GRNs cannot be deleted.');
      return;
    }
    setGrnToDelete(targetId);
  };

  const confirmDeleteGRN = () => {
    if (!grnToDelete) return;
    const targetId = grnToDelete;

    fetch(`/api/grns/${encodeURIComponent(targetId)}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(() => {
        setGrnList(prev => prev.filter(g => g.id !== targetId && g.grnNo !== targetId));
        setGrnToDelete(null);
        // Refresh live POs list
        fetch('/api/zoho/purchaseorders')
          .then(res => res.json())
          .then(d => { if (Array.isArray(d)) setLivePOs(d); });
      })
      .catch(err => {
        console.error('Error deleting GRN:', err);
        setGrnToDelete(null);
      });
  };

  const handleAddStockSubmit = () => {
    let updatedRegistry = [...stockRegistry];
    let currentRaw = [];
    try {
      const rawStr = localStorage.getItem('controlroom_raw_materials_store');
      if (rawStr) currentRaw = JSON.parse(rawStr) || [];
    } catch (_) {}

    addStockItems.forEach(item => {
      const existIdx = updatedRegistry.findIndex(r => r.code === item.sku);
      if (existIdx > -1) {
        const currentQty = Number(updatedRegistry[existIdx].stock.replace(/,/g, ''));
        const newQty = currentQty + Number(item.qty || 0);
        updatedRegistry[existIdx] = {
          ...updatedRegistry[existIdx],
          stock: String(newQty),
          val: String(Math.round(newQty * item.rate)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        };
      } else {
        updatedRegistry.push({
          code: item.sku,
          item: item.name,
          category: item.category,
          location: stockEntry.warehouse,
          stock: String(item.qty),
          allocated: '0',
          incoming: '-',
          minLevel: '500',
          val: String(Math.round(item.qty * item.rate)).replace(/\B(?=(\d{3})+(?!\d))/g, ","),
          status: 'In Stock'
        });
      }

      // Also update authoritative raw_materials_store
      const qtyNum = Number(item.qty || 0);
      if (qtyNum > 0) {
        const targetCode = String(item.sku || '').toUpperCase().trim();
        const canonicalCode = CANONICAL_PRODUCT_ALIASES[targetCode] || targetCode;
        let rawMatched = false;
        currentRaw = currentRaw.map(m => {
          const mCode = String(m.code || '').toUpperCase().trim();
          const mCanonical = CANONICAL_PRODUCT_ALIASES[mCode] || mCode;
          if (mCanonical === canonicalCode || (m.name && m.name.toLowerCase() === String(item.name || '').toLowerCase())) {
            rawMatched = true;
            const currentPhys = Number(m.physicalStock !== undefined ? m.physicalStock : (m.stock || 0));
            const currentOpen = Number(m.openingStock !== undefined ? m.openingStock : currentPhys);
            const newOpen = currentOpen + qtyNum;
            const newPhys = currentPhys + qtyNum;
            const currentRes = Number(m.reserved || 0);
            const newStock = Math.max(0, newPhys - currentRes);
            return {
              ...m,
              openingStock: newOpen,
              physicalStock: newPhys,
              stock: newStock,
              availableStock: newStock,
              available: newStock,
              status: newStock === 0 ? 'Out of Stock' : (newStock <= (m.minLevel || 50) ? 'Low Stock' : 'In Stock'),
              lastUpdated: 'Stock Added'
            };
          }
          return m;
        });

        if (!rawMatched) {
          currentRaw.unshift({
            code: canonicalCode || `ITEM-${Date.now()}`,
            name: item.name,
            category: item.category || 'Finished Goods',
            unit: 'Nos',
            openingStock: qtyNum,
            physicalStock: qtyNum,
            stock: qtyNum,
            availableStock: qtyNum,
            available: qtyNum,
            reserved: 0,
            blockedForBom: 0,
            minLevel: 50,
            status: 'In Stock',
            store: stockEntry.warehouse || 'Main Warehouse',
            lastUpdated: 'Stock Added'
          });
        }
      }
    });

    setStockRegistry(updatedRegistry);
    try {
      localStorage.setItem('controlroom_stock_registry_store', JSON.stringify(updatedRegistry));
      localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(currentRaw));
    } catch (_) {}

    try {
      fetch('/api/raw-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentRaw)
      }).catch(() => {});
      fetch('/api/store/raw_materials_store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentRaw)
      }).catch(() => {});
      fetch('/api/store/item_store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentRaw)
      }).catch(() => {});
      fetch('/api/store/stock_registry_store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRegistry)
      }).catch(() => {});
    } catch (_) {}

    try {
      saveCloudStore('raw_materials_store', currentRaw);
      saveCloudStore('item_store', currentRaw);
      saveCloudStore('stock_registry_store', updatedRegistry);
    } catch (_) {}

    try {
      window.dispatchEvent(new CustomEvent('controlroom_raw_materials_update', {
        detail: { rawMaterials: currentRaw, storeData: currentRaw }
      }));
      window.dispatchEvent(new Event('controlroom_raw_materials_update'));
      window.dispatchEvent(new Event('central_inventory_updated'));
      window.dispatchEvent(new Event('controlroom_storage_update'));
    } catch (_) {}

    setShowAddStockForm(false);
  };

  const renderStatusBadge = (status) => {
    let colors = { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }; // default
    switch (status) {
      case 'Pending Approval':
        colors = { bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
        break;
      case 'Pending Review':
        colors = { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
        break;
      case 'Approved':
      case 'Active':
      case 'Fully Accepted':
      case '3-Way Match OK':
      case 'Paid':
      case 'Completed':
      case 'Preferred':
      case 'Ready for Payment':
        colors = { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
        break;
      case 'In Procurement':
        colors = { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
        break;
      case 'Partially Fulfilled':
        colors = { bg: '#fef9c3', color: '#a16207', border: '#fef08a' };
        break;
      case 'Rejected':
      case 'Inactive':
      case 'Blacklisted':
      case 'Shortage Detected':
      case 'Discrepancy (Qty)':
      case 'On Hold':
      case 'Failed':
        colors = { bg: '#fff5f5', color: '#e53e3e', border: '#fed7d7' };
        break;
      case 'Draft':
        colors = { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
        break;
      case 'Sent':
        colors = { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
        break;
      case 'Viewed':
        colors = { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' };
        break;
      case 'Expired':
        colors = { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
        break;
      case 'Scheduled':
        colors = { bg: '#f0fdfa', color: '#0f766e', border: '#99f6e4' };
        break;
      default:
        colors = { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 'bold',
        backgroundColor: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
        whiteSpace: 'nowrap'
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: colors.color, display: 'inline-block' }} />
        {status}
      </span>
    );
  };

  const renderPriorityBadge = (priority) => {
    let colors = { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
    switch (priority) {
      case 'High':
        colors = { bg: '#fff5f5', color: '#e53e3e', border: '#fed7d7' };
        break;
      case 'Normal':
      case 'Medium':
        colors = { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
        break;
      case 'Low':
        colors = { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
        break;
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 10px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 'bold',
        backgroundColor: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
        whiteSpace: 'nowrap'
      }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: colors.color, display: 'inline-block' }} />
        {priority}
      </span>
    );
  };

  const handleSelectAllGeneric = (e, items, keyField) => {
    if (e.target.checked) {
      setSelectedRows(items.map(item => item[keyField]));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRowGeneric = (val) => {
    if (selectedRows.includes(val)) {
      setSelectedRows(selectedRows.filter(item => item !== val));
    } else {
      setSelectedRows([...selectedRows, val]);
    }
  };

  // RFP Data State (Expanded to match user screenshot)
  const [rfpList, setRfpList] = useState([
    { id: 'PR-2026-189', requester: 'Ravi Kumar', dept: 'Production', req: 'GI Steel Coil 2mm', qty: '10.00 MT', requiredBy: '15 Jun 2026', priority: 'High', status: 'Pending Approval', date: '29 May 2026, 09:15 AM' },
    { id: 'PR-2026-190', requester: 'Arun Prasad', dept: 'Design', req: 'Aluminium Rail 120mm', qty: '100 Nos', requiredBy: '18 Jun 2026', priority: 'Normal', status: 'Approved', date: '29 May 2026, 11:30 AM' },
    { id: 'PR-2026-191', requester: 'Priya Sharma', dept: 'HR', req: 'Office Chair - Executive', qty: '20 Nos', requiredBy: '20 Jun 2026', priority: 'Normal', status: 'In Procurement', date: '28 May 2026, 04:45 PM' },
    { id: 'PR-2026-192', requester: 'Manoj Kumar', dept: 'Production', req: 'CRC Sheet 1.2mm', qty: '5.00 MT', requiredBy: '16 Jun 2026', priority: 'High', status: 'Pending Review', date: '28 May 2026, 02:20 PM' },
    { id: 'PR-2026-193', requester: 'Suresh Patel', dept: 'Maintenance', req: 'Bearing SKF 6204', qty: '30 Nos', requiredBy: '17 Jun 2026', priority: 'Low', status: 'Approved', date: '27 May 2026, 10:10 AM' },
    { id: 'PR-2026-194', requester: 'Karthik R', dept: 'Projects', req: 'MS Channel 75x40', qty: '50.00 MT', requiredBy: '22 Jun 2026', priority: 'High', status: 'In Procurement', date: '27 May 2026, 09:05 AM' },
    { id: 'PR-2026-195', requester: 'Anitha Devi', dept: 'Admin', req: 'Printer - HP LaserJet', qty: '2 Nos', requiredBy: '25 Jun 2026', priority: 'Normal', status: 'Partially Fulfilled', date: '26 May 2026, 03:30 PM' },
    { id: 'PR-2026-196', requester: 'Vijay Kumar', dept: 'Stores', req: 'Welding Electrode 6013', qty: '25.00 KG', requiredBy: '19 Jun 2026', priority: 'Low', status: 'Completed', date: '26 May 2026, 11:45 AM' }
  ]);
  const [prNumber, setPrNumber] = useState('PR-2026-198');
  const [prDate, setPrDate] = useState(new Date().toISOString().split('T')[0]);
  const [prRequestedBy, setPrRequestedBy] = useState('Ravi Kumar');
  const [prDept, setPrDept] = useState('Production');
  const [prRequiredDate, setPrRequiredDate] = useState('');
  const [prPriority, setPrPriority] = useState('Normal');
  const [prProject, setPrProject] = useState('N/A');
  const [prCostCenter, setPrCostCenter] = useState('PROD-1001 - Production');
  const [prPurpose, setPrPurpose] = useState('');

  // Requisition items list state
  const [prItems, setPrItems] = useState([
    { name: 'GI Steel Coil 2mm', desc: '', unit: 'MT', qty: '', date: '', vendor: 'N/A' }
  ]);

  // Additional details state
  const [prBudget, setPrBudget] = useState('');
  const [prBrand, setPrBrand] = useState('');
  const [prNotes, setPrNotes] = useState('');
  const [prUseDefaultTerms, setPrUseDefaultTerms] = useState(true);

  // Approval flow state
  const [prReviewBy, setPrReviewBy] = useState('Department Head');
  const [prApproveBy, setPrApproveBy] = useState('Procurement Head');

  const handleAddItem = () => {
    setPrItems([...prItems, { name: 'GI Steel Coil 2mm', desc: '', unit: 'MT', qty: '1.00', date: '2026-06-15', vendor: 'N/A' }]);
  };

  const handleRemoveItem = (index) => {
    if (prItems.length > 1) {
      setPrItems(prItems.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...prItems];
    updated[index][field] = value;
    setPrItems(updated);
  };

  const renderSelect = (value, onChange, options, style = {}) => {
    return (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: style.width || (style.minWidth ? 'auto' : '100%'), minWidth: style.minWidth || 'auto', flexShrink: 0 }}>
        <select
          value={value}
          onChange={onChange}
          style={{
            width: '100%',
            height: '38px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            padding: '0 12px',
            fontSize: '13px',
            backgroundColor: 'white',
            color: '#334155',
            outline: 'none',
            cursor: 'pointer',
            ...style
          }}
        >
          {options.map((opt, i) => (
            typeof opt === 'object'
              ? <option key={i} value={opt.value}>{opt.label}</option>
              : <option key={i} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  };

  const renderTableSelect = (value, onChange, options, style = {}) => {
    return renderSelect(value, onChange, options, { height: '36px', borderRadius: '6px', ...style });
  };

  // Filters State
  const [deptFilter, setDeptFilter] = useState('All');
  const [requestedByFilter, setRequestedByFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [activeStatusTab, setActiveStatusTab] = useState('All');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPRs, setSelectedPRs] = useState([]);

  // Vendor Data State
  const [vendorList, setVendorList] = useState([]);
  const [vendorLoading, setVendorLoading] = useState(false);

  const loadVendorsFromZoho = async () => {
    setVendorLoading(true);
    try {
      const zohoVendors = await getSafeZohoVendors();
      if (Array.isArray(zohoVendors) && zohoVendors.length > 0) {
        setVendorList(zohoVendors);
      } else {
        const res = await fetch('/api/zoho/vendors').catch(() => null);
        if (res && res.ok) {
          const vData = await res.json().catch(() => []);
          setVendorList(Array.isArray(vData) ? vData : []);
        }
      }
    } catch (e) {
      console.error("Failed to load Zoho vendors", e);
    } finally {
      setVendorLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'Vendor Management') {
      loadVendorsFromZoho();
    }
  }, [activeTab]);

  const [invoicesList, setInvoicesList] = useState([]);
  const [printTaxInvoiceModal, setPrintTaxInvoiceModal] = useState(null);

  useEffect(() => {
    if (activeTab === 'Invoice Management') {
      const fetchZohoInvoices = async () => {
        try {
          const response = await fetch('/api/zoho/invoices');
          if (response.ok) {
            const zohoInvoices = await response.json();
            if (Array.isArray(zohoInvoices)) {
              setInvoicesList(zohoInvoices);
            }
          }
        } catch (err) {
          console.error("Error fetching Zoho Invoices:", err);
        }
      };
      fetchZohoInvoices();

      const pollInterval = setInterval(() => {
        fetchZohoInvoices();
      }, 15000);

      return () => clearInterval(pollInterval);
    }
  }, [activeTab]);

  const [activeVendorActionMenu, setActiveVendorActionMenu] = useState(null);
  const [deleteConfirmVendor, setDeleteConfirmVendor] = useState(null);
  const [viewingVendor, setViewingVendor] = useState(null);
  const [vendorModalLoading, setVendorModalLoading] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);

  const handleOpenVendorDetails = async (vendor) => {
    setViewingVendor(vendor);
    setActiveVendorActionMenu(null);
    if (vendor.id || vendor.code) {
      setVendorModalLoading(true);
      try {
        const vendorId = vendor.id || vendor.code;
        const res = await fetch(`/api/zoho/vendors/${vendorId}`);
        if (res.ok) {
          const detail = await res.json();
          setViewingVendor(detail);
        }
      } catch (e) {
        console.error("Failed to load detailed vendor info from Zoho", e);
      } finally {
        setVendorModalLoading(false);
      }
    }
  };

  // Quotations Action States
  const [activeQuotationActionMenu, setActiveQuotationActionMenu] = useState(null);
  const [deleteConfirmQuotation, setDeleteConfirmQuotation] = useState(null);
  const [viewingQuotation, setViewingQuotation] = useState(null);
  const [editingQuotation, setEditingQuotation] = useState(null);

  // GRN Action States
  const [activeGrnActionMenu, setActiveGrnActionMenu] = useState(null);
  const [deleteConfirmGrn, setDeleteConfirmGrn] = useState(null);
  const [viewingGrn, setViewingGrn] = useState(null);
  const [editingGrn, setEditingGrn] = useState(null);

  // Invoice Action States
  const [activeInvoiceActionMenu, setActiveInvoiceActionMenu] = useState(null);
  const [deleteConfirmInvoice, setDeleteConfirmInvoice] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);

  // Payment Action States
  const [activePaymentActionMenu, setActivePaymentActionMenu] = useState(null);
  const [deleteConfirmPayment, setDeleteConfirmPayment] = useState(null);
  const [viewingPayment, setViewingPayment] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);

  // Proforma Invoice Action States
  const [activeProformaActionMenu, setActiveProformaActionMenu] = useState(null);
  const [deleteConfirmProforma, setDeleteConfirmProforma] = useState(null);
  const [viewingProforma, setViewingProforma] = useState(null);
  const [editingProforma, setEditingProforma] = useState(null);

  // RFP Action States
  const [activeRfpActionMenu, setActiveRfpActionMenu] = useState(null);
  const [deleteConfirmRfp, setDeleteConfirmRfp] = useState(null);
  const [viewingRfp, setViewingRfp] = useState(null);
  const [editingRfp, setEditingRfp] = useState(null);

  // Items Action States
  const [itemsList, setItemsList] = useState(() => {
    try {
      const full = getFullProductsCatalogWithStock();
      if (Array.isArray(full) && full.length > 0) return full;
    } catch (_) {}
    return [];
  });
  const [activeItemActionMenu, setActiveItemActionMenu] = useState(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isSyncingZohoItems, setIsSyncingZohoItems] = useState(false);
  const [itemSaveStatus, setItemSaveStatus] = useState(null);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [createStatus, setCreateStatus] = useState(null);
  const [newItemData, setNewItemData] = useState({
    name: '',
    sku: '',
    rate: '',
    purchaseRate: '',
    unit: 'NOS',
    status: 'Active',
    warehouse: 'Main Warehouse',
    description: '',
    purchaseDescription: '',
    productType: 'goods'
  });
  const [itemsCurrentPage, setItemsCurrentPage] = useState(1);
  const [itemsRowsPerPage, setItemsRowsPerPage] = useState(10);
  const [itemsGoToPageInput, setItemsGoToPageInput] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [selectedItemWarehouse, setSelectedItemWarehouse] = useState('All Warehouses');
  const [selectedItemCategory, setSelectedItemCategory] = useState('All Categories');
  const [selectedItemStatus, setSelectedItemStatus] = useState('All Status');
  const [itemsLoading, setItemsLoading] = useState(true);

  // Dedicated states for Stock Status list table view
  const [stockStatusSearchQuery, setStockStatusSearchQuery] = useState('');
  const [stockStatusWarehouse, setStockStatusWarehouse] = useState('All Warehouses');
  const [stockStatusCategory, setStockStatusCategory] = useState('All Categories');
  const [stockStatusStatus, setStockStatusStatus] = useState('All Status');
  const [stockStatusActiveSubTab, setStockStatusActiveSubTab] = useState('All');
  const [stockProductTypeTab, setStockProductTypeTab] = useState('All'); // 'All' | 'Finished Goods' | 'Accessories'
  const [stockStatusPage, setStockStatusPage] = useState(1);
  const [stockStatusRowsPerPage, setStockStatusRowsPerPage] = useState(10);
  const [stockStatusGoToInput, setStockStatusGoToInput] = useState('');
  const [stockStatusStorageTrigger, setStockStatusStorageTrigger] = useState(0);
  const [selectedStockRows, setSelectedStockRows] = useState([]);
  const [viewingStockItem, setViewingStockItem] = useState(null);

  const handleExportStockCSV = (rowsToExport = []) => {
    if (!rowsToExport || rowsToExport.length === 0) {
      alert('No stock records to export.');
      return;
    }
    const headers = isSalesUser
      ? ['Material / SKU', 'Code', 'Product Type', 'Category', 'Warehouse', 'Available Qty', 'Reserved Qty', 'Status']
      : ['Material / SKU', 'Code', 'Product Type', 'Category', 'Warehouse', 'Available Qty', 'Reserved Qty', 'Incoming Qty', 'Reorder Level', 'Stock Value', 'Status'];

    const rows = rowsToExport.map(r => {
      if (isSalesUser) {
        return [
          `"${String(r.item || '').replace(/"/g, '""')}"`,
          `"${String(r.code || '').replace(/"/g, '""')}"`,
          `"${String(r.productType || 'Finished Goods').replace(/"/g, '""')}"`,
          `"${String(r.category || '').replace(/"/g, '""')}"`,
          `"${String(r.location || '').replace(/"/g, '""')}"`,
          `"${String(r.stock || '0').replace(/"/g, '""')}"`,
          `"${String(r.allocated || '0').replace(/"/g, '""')}"`,
          `"${String(r.status || '').replace(/"/g, '""')}"`
        ];
      }
      return [
        `"${String(r.item || '').replace(/"/g, '""')}"`,
        `"${String(r.code || '').replace(/"/g, '""')}"`,
        `"${String(r.productType || 'Finished Goods').replace(/"/g, '""')}"`,
        `"${String(r.category || '').replace(/"/g, '""')}"`,
        `"${String(r.location || '').replace(/"/g, '""')}"`,
        `"${String(r.stock || '0').replace(/"/g, '""')}"`,
        `"${String(r.allocated || '0').replace(/"/g, '""')}"`,
        `"${String(r.incoming || '0').replace(/"/g, '""')}"`,
        `"${String(r.minLevel || '0').replace(/"/g, '""')}"`,
        `"${String(r.val || '0').replace(/"/g, '""')}"`,
        `"${String(r.status || '').replace(/"/g, '""')}"`
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Status_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreatePoFromSelectedStock = (selectedRowIds = [], allRows = []) => {
    const isSales = userRole === 'Sales Executive' || userRole === 'Sales Head' || String(userRole || '').toLowerCase().includes('sales');
    if (isSales) {
      alert('Sales Executives and Sales Heads do not have permissions to create Purchase Orders.');
      return;
    }
    const ids = selectedRowIds && selectedRowIds.length > 0 ? selectedRowIds : selectedStockRows;
    if (!ids || ids.length === 0) {
      alert('Please select at least one item to reorder.');
      return;
    }
    const selectedRowsData = (allRows || []).filter(r => ids.includes(r.code || r.item));
    if (selectedRowsData.length === 0) return;

    const poItemsPayload = selectedRowsData.map(item => {
      const avail = parseFloat(String(item.stock || '0').replace(/,/g, '')) || 0;
      const minLvl = parseFloat(String(item.minLevel || '50').replace(/,/g, '')) || 50;
      const neededQty = Math.max(minLvl - avail, 100);
      const cleanVal = parseFloat(String(item.val || '0').replace(/[^0-9.]/g, '')) || 0;
      const calcRate = avail > 0 && cleanVal > 0 ? Math.round(cleanVal / avail) : 250;

      return {
        name: item.item,
        sku: item.code,
        code: item.code,
        account: item.category || 'Raw Material',
        qty: neededQty,
        unit: 'NOS',
        rate: calcRate,
        tax: 18
      };
    });

    try {
      localStorage.setItem('controlroom_pending_reorder_po', JSON.stringify({
        items: poItemsPayload,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Failed to store pending reorder PO payload', e);
    }

    if (typeof onChangeTab === 'function') {
      onChangeTab('Purchase Orders');
    } else {
      alert(`Prepared PO payload with ${poItemsPayload.length} item(s). Please navigate to Purchase Orders to finalize.`);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchZohoItems = async () => {
      try {
        setItemsLoading(true);
        const zohoItems = await getSafeZohoItems();
        if (isMounted && Array.isArray(zohoItems) && zohoItems.length > 0) {
          setItemsList(prev => {
            const itemMap = new Map();
            (prev || []).forEach(it => {
              const key = it.code || it.sku || it.itemId || it.id || it.name;
              if (key) itemMap.set(String(key).toLowerCase().trim(), it);
            });
            zohoItems.forEach(it => {
              const key = it.code || it.sku || it.itemId || it.id || it.name;
              if (key) {
                const k = String(key).toLowerCase().trim();
                itemMap.set(k, { ...itemMap.get(k), ...it });
              }
            });
            return Array.from(itemMap.values());
          });
        } else {
          const response = await fetch('/api/zoho/items').catch(() => null);
          if (response && response.ok) {
            const zItems = await response.json().catch(() => []);
            if (isMounted && Array.isArray(zItems) && zItems.length > 0) {
              setItemsList(prev => {
                const itemMap = new Map();
                (prev || []).forEach(it => {
                  const key = it.code || it.sku || it.itemId || it.id || it.name;
                  if (key) itemMap.set(String(key).toLowerCase().trim(), it);
                });
                zItems.forEach(it => {
                  const key = it.code || it.sku || it.itemId || it.id || it.name;
                  if (key) {
                    const k = String(key).toLowerCase().trim();
                    itemMap.set(k, { ...itemMap.get(k), ...it });
                  }
                });
                return Array.from(itemMap.values());
              });
            }
          }
        }
      } catch (err) {
        console.error("Error fetching Zoho Items:", err);
      } finally {
        if (isMounted) setItemsLoading(false);
      }
    };
    fetchZohoItems();
    return () => { isMounted = false; };
  }, []);

  // Listen to live inventory changes and storage events so stock reductions reflect immediately
  useEffect(() => {
    const handleStorageUpdate = () => {
      setStockStatusStorageTrigger(prev => prev + 1);
      try {
        const rawStoreStr = localStorage.getItem('controlroom_items_list') || localStorage.getItem('controlroom_item_store');
        if (rawStoreStr) {
          const parsed = JSON.parse(rawStoreStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItemsList(prev => {
              const itemMap = new Map();
              (prev || []).forEach(it => itemMap.set(String(it.code || it.sku || it.itemId || it.id || it.name).toLowerCase(), it));
              parsed.forEach(it => {
                const key = String(it.code || it.sku || it.itemId || it.id || it.name).toLowerCase();
                if (key) {
                  itemMap.set(key, { ...itemMap.get(key), ...it });
                }
              });
              return Array.from(itemMap.values());
            });
          }
        }
      } catch (_) {}
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('controlroom_storage_update', handleStorageUpdate);
    window.addEventListener('controlroom_raw_materials_update', handleStorageUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('controlroom_storage_update', handleStorageUpdate);
      window.removeEventListener('controlroom_raw_materials_update', handleStorageUpdate);
    };
  }, []);

  const handleCreateProductInZoho = async () => {
    if (!newItemData.name || !newItemData.name.trim()) {
      setCreateStatus({ type: 'warning', text: 'Item Name is required.' });
      return;
    }
    try {
      setIsCreatingProduct(true);
      setCreateStatus(null);

      const payload = {
        name: newItemData.name.trim(),
        rate: Number(newItemData.rate) || 0,
        sku: newItemData.sku ? newItemData.sku.trim() : '',
        description: newItemData.description ? newItemData.description.trim() : '',
        unit: newItemData.unit || 'NOS',
        purchaseRate: Number(newItemData.purchaseRate) || 0,
        purchaseDescription: newItemData.purchaseDescription ? newItemData.purchaseDescription.trim() : '',
        productType: newItemData.productType || 'goods',
        status: newItemData.status || 'Active'
      };

      const res = await fetch('/api/zoho/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json().catch(() => ({}));
      const createdItem = result.item || {
        itemId: 'ITEM-' + Date.now(),
        ...payload
      };

      // 1. Immediately update React state
      setItemsList(prev => {
        const filtered = (prev || []).filter(i => (i.itemId || i.id || i.sku) !== (createdItem.itemId || createdItem.sku));
        const updated = [createdItem, ...filtered];
        // 2. Persist to localStorage immediately
        try {
          saveCloudStore('item_store', updated);
        } catch (e) {}
        // 3. Persist directly to Supabase leaves cloud store (ITEM_STORE)
        try {
          saveCloudStore('item_store', updated);
        } catch (e) {}
        return updated;
      });

      setCreateStatus({ type: 'success', text: result.message || 'Product created successfully and added to Zoho Books!' });

      setTimeout(() => {
        setIsCreatingItem(false);
        setCreateStatus(null);
        setNewItemData({
          name: '',
          sku: '',
          rate: '',
          purchaseRate: '',
          unit: 'NOS',
          status: 'Active',
          description: '',
          purchaseDescription: '',
          productType: 'goods'
        });
      }, 1000);
    } catch (err) {
      console.error("Error creating product:", err);
      const fallback = {
        itemId: 'ITEM-' + Date.now(),
        name: newItemData.name,
        rate: Number(newItemData.rate) || 0,
        sku: newItemData.sku || '—',
        unit: newItemData.unit || 'NOS',
        description: newItemData.description || '—',
        status: (newItemData.status && String(newItemData.status).toLowerCase() === 'inactive') ? 'Inactive' : 'Active'
      };
      setItemsList(prev => {
        const filtered = (prev || []).filter(i => (i.itemId || i.id || i.sku) !== (fallback.itemId || fallback.sku));
        const updated = [fallback, ...filtered];
        try {
          saveCloudStore('item_store', updated);
        } catch (e) {}
        try {
          saveCloudStore('item_store', updated);
        } catch (e) {}
        return updated;
      });
      setCreateStatus({ type: 'success', text: 'Product created locally in Control Room.' });
      setTimeout(() => {
        setIsCreatingItem(false);
        setCreateStatus(null);
      }, 1000);
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const handleSaveItemToZoho = async () => {
    if (!editingItem) return;
    try {
      setIsSavingItem(true);
      setItemSaveStatus(null);

      const targetStatus = (editingItem.status && String(editingItem.status).toLowerCase() === 'inactive') ? 'Inactive' : 'Active';
      const payload = {
        name: editingItem.name,
        rate: Number(editingItem.rate) || 0,
        sku: editingItem.sku || '',
        description: editingItem.description || '',
        unit: editingItem.unit || 'NOS',
        purchaseRate: Number(editingItem.purchaseRate) || 0,
        purchaseDescription: editingItem.purchaseDescription || '',
        status: targetStatus
      };

      const res = await fetch(`/api/zoho/items/${editingItem.itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setItemSaveStatus({ type: 'success', text: 'Item updated successfully and synced with Zoho Books!' });
      } else {
        setItemSaveStatus({ type: 'warning', text: 'Saved locally in Control Room.' });
      }

      setItemsList(prev => {
        const updated = (prev || []).map(it => (it.itemId === editingItem.itemId || it.id === editingItem.itemId) ? { ...it, ...editingItem, ...payload } : it);
        try {
          saveCloudStore('item_store', updated);
        } catch (e) {}
        try {
          saveCloudStore('item_store', updated);
        } catch (e) {}
        return updated;
      });

      setTimeout(() => {
        setEditingItem(null);
        setItemSaveStatus(null);
      }, 900);
    } catch (err) {
      console.error("Error updating item:", err);
      setItemsList(prev => {
        const updated = (prev || []).map(it => (it.itemId === editingItem.itemId || it.id === editingItem.itemId) ? editingItem : it);
        try {
          saveCloudStore('item_store', updated);
        } catch (e) {}
        try {
          saveCloudStore('item_store', updated);
        } catch (e) {}
        return updated;
      });
      setItemSaveStatus({ type: 'success', text: 'Item saved locally.' });
      setTimeout(() => {
        setEditingItem(null);
        setItemSaveStatus(null);
      }, 900);
    } finally {
      setIsSavingItem(false);
    }
  };

  const [vName, setVName] = useState('');
  const [vCat, setVCat] = useState('Select category');
  const [vContact, setVContact] = useState('');
  const [vEmail, setVEmail] = useState('');
  const [vPhone, setVPhone] = useState('');
  const [vType, setVType] = useState('Select vendor type');
  const [vCompanyReg, setVCompanyReg] = useState('');
  const [vGST, setVGST] = useState('');
  const [vPAN, setVPAN] = useState('');
  const [vWebsite, setVWebsite] = useState('');
  const [vRegAddress, setVRegAddress] = useState('');
  const [vCity, setVCity] = useState('');
  const [vState, setVState] = useState('Select state');
  const [vCountry, setVCountry] = useState('India');
  const [vPinCode, setVPinCode] = useState('');
  const [vBillingAddress, setVBillingAddress] = useState('');
  const [vBillingCity, setVBillingCity] = useState('');
  const [vBillingState, setVBillingState] = useState('Select state');
  const [vBillingCountry, setVBillingCountry] = useState('India');
  const [vBillingPinCode, setVBillingPinCode] = useState('');
  const [vSameAsRegistered, setVSameAsRegistered] = useState(true);
  const [vDesignation, setVDesignation] = useState('');
  const [vAltPhone, setVAltPhone] = useState('');
  const [vPrefComm, setVPrefComm] = useState('Select option');
  const [vPaymentTerms, setVPaymentTerms] = useState('Select payment terms');
  const [vCurrency, setVCurrency] = useState('INR - Indian Rupee');
  const [vActiveVendor, setVActiveVendor] = useState(true);
  const [vPreferredVendor, setVPreferredVendor] = useState(false);
  const [vBlacklistedVendor, setVBlacklistedVendor] = useState(false);
  const [vTags, setVTags] = useState('');
  const [vInternalNotes, setVInternalNotes] = useState('');
  const [vendorConfirmModal, setVendorConfirmModal] = useState({
    show: false,
    action: null,
    title: '',
    message: '',
    confirmLabel: '',
    confirmBtnColor: '#2563eb'
  });

  const [isGstFetching, setIsGstFetching] = useState(false);
  const [gstLookupStatus, setGstLookupStatus] = useState(null);

  const handleGstFetch = async (valToFetch) => {
    const g = (valToFetch || vGST || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (g.length < 2) return;

    setIsGstFetching(true);
    setGstLookupStatus(null);

    const stateMap = {
      '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
      '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
      '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
      '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
      '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
      '24': 'Gujarat', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
      '32': 'Kerala', '33': 'Tamil Nadu', '36': 'Telangana', '37': 'Andhra Pradesh'
    };

    const stateCode = g.substring(0, 2);
    const resolvedState = stateMap[stateCode] || 'Andhra Pradesh';
    setVState(resolvedState);
    setVBillingState(resolvedState);

    if (g.length >= 12) {
      const extractedPan = g.substring(2, 12);
      setVPAN(extractedPan);
    }

    try {
      const res = await fetch(`/api/zoho/gst-lookup?gstin=${g}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.legalName && data.legalName !== '—') setVName(data.legalName);
          if (data.pan) setVPAN(data.pan);
          if (data.state) {
            setVState(data.state);
            setVBillingState(data.state);
          }
          if (data.address) {
            setVRegAddress(data.address);
            setVBillingAddress(data.address);
          }
          if (data.city) {
            setVCity(data.city);
            setVBillingCity(data.city);
          }
          if (data.pincode) {
            setVPinCode(data.pincode);
            setVBillingPinCode(data.pincode);
          }
          if (data.companyReg) setVCompanyReg(data.companyReg);
          if (data.email) setVEmail(data.email);
          if (data.phone) setVPhone(data.phone);

          setGstLookupStatus({ type: 'success', msg: `Verified: Official Details Loaded for ${data.legalName}` });
        }
      }
    } catch (err) {
      console.error('GST Lookup failed', err);
    } finally {
      setIsGstFetching(false);
    }
  };

  // Vendor Filter State
  const [vSearchQuery, setVSearchQuery] = useState('');
  const [vTypeFilter, setVTypeFilter] = useState('All');
  const [vStatusFilter, setVStatusFilter] = useState('All');
  const [vCatFilter, setVCatFilter] = useState('All');
  const [vRatingFilter, setVRatingFilter] = useState('All');
  const [vTermsFilter, setVTermsFilter] = useState('All');
  const [vActiveTab, setVActiveTab] = useState('All Vendors');
  const [vCurrentPage, setVCurrentPage] = useState(1);
  const [vRowsPerPage, setVRowsPerPage] = useState(10);
  const [selectedVendors, setSelectedVendors] = useState([]);

  // Quotation comparison state
  const [selectedRfpQuote, setSelectedRfpQuote] = useState('RFP-2026-101');
  const quotesComparison = {
    'RFP-2026-101': [
      { vendor: 'Tata Steel Ltd.', rate: '₹45,000 / MT', delivery: '5 Days', payment: 'Net 30 Days', ranking: '1st (Recommended)', rankClass: '#15803d', rankBg: '#f0fdf4' },
      { vendor: 'JSW Steel Ltd.', rate: '₹46,500 / MT', delivery: '3 Days', payment: 'Net 15 Days', ranking: '2nd', rankClass: '#475569', rankBg: '#f1f5f9' },
      { vendor: 'Essar Steel Ltd.', rate: '₹45,800 / MT', delivery: '7 Days', payment: 'Net 45 Days', ranking: '3rd', rankClass: '#475569', rankBg: '#f1f5f9' }
    ]
  };

  // Quotations List State
  const [quotationSearchQuery, setQuotationSearchQuery] = useState('');
  const [quotationStatusFilter, setQuotationStatusFilter] = useState('All');
  const [quotationCustomerFilter, setQuotationCustomerFilter] = useState('All');
  const [quotationProjectFilter, setQuotationProjectFilter] = useState('All');
  const [quotationSalesPersonFilter, setQuotationSalesPersonFilter] = useState('All');
  const [quotationActiveTab, setQuotationActiveTab] = useState('All');
  const [quotationCurrentPage, setQuotationCurrentPage] = useState(1);
  const [quotationRowsPerPage, setQuotationRowsPerPage] = useState(10);
  const [selectedQuotations, setSelectedQuotations] = useState([]);

  const INITIAL_QUOTATIONS = [
    { id: 'QT-2024-0126', customer: 'Tata Power Solar Systems Ltd.', project: '50 MW Solar Plant - Rajasthan', date: '29 May 2024', validUntil: '28 Jun 2024', amount: '₹ 18,75,000.00', status: 'Sent', salesPerson: 'Ravi Kumar' },
    { id: 'QT-2024-0125', customer: 'Adani Green Energy Ltd.', project: '100 MW Solar Plant - Gujarat', date: '28 May 2024', validUntil: '27 Jun 2024', amount: '₹ 32,40,000.00', status: 'Viewed', salesPerson: 'Pooja Sharma' },
    { id: 'QT-2024-0124', customer: 'Waaree Energies Ltd.', project: '25 MW Solar Plant - Maharashtra', date: '27 May 2024', validUntil: '26 Jun 2024', amount: '₹ 9,85,000.00', status: 'Accepted', salesPerson: 'Ravi Kumar' },
    { id: 'QT-2024-0123', customer: 'Sterling and Wilson Pvt. Ltd.', project: '75 MW Solar Plant - Karnataka', date: '25 May 2024', validUntil: '24 Jun 2024', amount: '₹ 21,60,000.00', status: 'Draft', salesPerson: 'Amit Verma' },
    { id: 'QT-2024-0122', customer: 'Mahindra Susten Pvt. Ltd.', project: '10 MW Solar Plant - MP', date: '24 May 2024', validUntil: '23 Jun 2024', amount: '₹ 4,30,000.00', status: 'Sent', salesPerson: 'Pooja Sharma' },
    { id: 'QT-2024-0121', customer: 'NTPC Renewable Energy Ltd.', project: '200 MW Solar Plant - AP', date: '23 May 2024', validUntil: '22 Jun 2024', amount: '₹ 58,20,000.00', status: 'Viewed', salesPerson: 'Ravi Kumar' },
    { id: 'QT-2024-0120', customer: 'Hero Future Energies Pvt. Ltd.', project: '5 MW Rooftop Project', date: '22 May 2024', validUntil: '21 Jun 2024', amount: '₹ 2,15,000.00', status: 'Expired', salesPerson: 'Amit Verma' },
    { id: 'QT-2024-0119', customer: 'ReNew Power Pvt. Ltd.', project: '150 MW Solar Plant - Tamil Nadu', date: '21 May 2024', validUntil: '20 Jun 2024', amount: '₹ 41,75,000.00', status: 'Accepted', salesPerson: 'Pooja Sharma' },
    { id: 'QT-2024-0118', customer: 'Jakson Engineers Ltd.', project: '33 MW Solar Plant - Odisha', date: '20 May 2024', validUntil: '19 Jun 2024', amount: '₹ 11,90,000.00', status: 'Rejected', salesPerson: 'Ravi Kumar' },
    { id: 'QT-2024-0117', customer: 'Larsen & Toubro Ltd.', project: '80 MW Solar Plant - Gujarat', date: '19 May 2024', validUntil: '18 Jun 2024', amount: '₹ 27,50,000.00', status: 'Sent', salesPerson: 'Amit Verma' }
  ];

  const [quotationsList, setQuotationsList] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_quotations_store');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { }
    return INITIAL_QUOTATIONS;
  });

  useEffect(() => {
    saveCloudStore('quotations_store', quotationsList);
  }, [quotationsList]);

  useEffect(() => {
    fetchCloudStore('quotations_store', quotationsList).then(data => {
      if (data && Array.isArray(data) && data.length > 0) setQuotationsList(data);
    });
    const sub = subscribeToCloudStore('quotations_store', (latest) => {
      if (latest && Array.isArray(latest)) setQuotationsList(latest);
    });
    return () => {
      if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
    };
  }, []);

  // GRN State
  const [grnList, setGrnList] = useState([]);
  const [grnPo, setGrnPo] = useState('');
  const [grnVendor, setGrnVendor] = useState('');
  const [grnQty, setGrnQty] = useState('');
  const [grnTab, setGrnTab] = useState('All');
  const [invoiceTab, setInvoiceTab] = useState('All');
  const [paymentTab, setPaymentTab] = useState('All');
  const [stockTab, setStockTab] = useState('All');

  const [grnSearchQuery, setGrnSearchQuery] = useState('');
  const [grnStatusFilter, setGrnStatusFilter] = useState('All');
  const [invSearchQuery, setInvSearchQuery] = useState('');
  const [invStatusFilter, setInvStatusFilter] = useState('All');
  const [paySearchQuery, setPaySearchQuery] = useState('');
  const [payStatusFilter, setPayStatusFilter] = useState('All');
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockLocationFilter, setStockLocationFilter] = useState('All');

  // Invoice State
  const [viewingInvoiceModal, setViewingInvoiceModal] = useState(null);
  const [invoiceModalActiveTab, setInvoiceModalActiveTab] = useState('Invoice Items');
  const [closeInvoiceReasonModal, setCloseInvoiceReasonModal] = useState(null);
  const [closeReasonText, setCloseReasonText] = useState('');
  const [pendingDcModal, setPendingDcModal] = useState(null);
  const [confirmInvoiceSuccessModal, setConfirmInvoiceSuccessModal] = useState(null);
  const INITIAL_INVOICES = [
    {
      invNo: 'INV-2026-102',
      date: '12 Jul 2026',
      vendor: 'Tata Power Renewable',
      poNo: 'BOM-102',
      grnNo: 'GRN-VERIFIED',
      invAmt: '₹ 17,400.00',
      poVal: '₹ 17,400.00',
      grnVal: '₹ 17,400.00',
      diff: '0.00',
      match: 'Matched',
      pay: 'Ready',
      status: 'Ready for Payment',
      items: [
        { code: 'PRD-001', name: 'Long Rail 3000 mm', category: '3 Meter Heavy Duty Rail', qty: 8, rate: 1800, selected: true },
        { code: 'PRD-002', name: 'Mini Rail 100 mm', category: 'Aluminum Mounting Rail', qty: 12, rate: 250, selected: false }
      ]
    },
    {
      invNo: 'INV-2026-088',
      date: '02 Jul 2026',
      vendor: 'Apex Infra Systems',
      poNo: 'BOM-098',
      grnNo: 'GRN-1824',
      invAmt: '₹ 45,000.00',
      poVal: '₹ 45,000.00',
      grnVal: '₹ 45,000.00',
      diff: '0.00',
      match: 'Matched',
      pay: 'Ready',
      status: 'Ready for Payment',
      items: [
        { code: 'PRD-101', name: 'Steel Pipe', category: '2 inch GI Pipe', qty: 100, rate: 400, selected: true },
        { code: 'PRD-102', name: 'Flange', category: '2 inch MS Flange', qty: 50, rate: 100, selected: false }
      ]
    },
    {
      invNo: 'INV-2026-075',
      date: '25 Jun 2026',
      vendor: 'Vikram Solar Pvt Ltd',
      poNo: 'BOM-092',
      grnNo: 'GRN-1811',
      invAmt: '₹ 28,500.00',
      poVal: '₹ 28,500.00',
      grnVal: '₹ 28,500.00',
      diff: '0.00',
      match: 'Matched',
      pay: 'Ready',
      status: 'Ready for Payment',
      items: [
        { code: 'PRD-201', name: 'Solar Cable 4sqmm', category: 'DC Solar Cable', qty: 500, rate: 50, selected: true },
        { code: 'PRD-202', name: 'MC4 Connector Pair', category: 'Connectors', qty: 70, rate: 50, selected: true }
      ]
    }
  ];

  const [invoiceList, setInvoiceList] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_invoice_store');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing stored invoice list', e);
    }
    return INITIAL_INVOICES;
  });

  // Sync invoiceList with Supabase cloud database
  useEffect(() => {
    saveCloudStore('invoice_store', invoiceList);
  }, [invoiceList]);

  // Initial cloud fetch for invoices
  useEffect(() => {
    fetchCloudStore('invoice_store', invoiceList).then(data => {
      if (data && Array.isArray(data) && data.length > 0) setInvoiceList(data);
    });
    const sub = subscribeToCloudStore('invoice_store', (latest) => {
      if (latest && Array.isArray(latest)) setInvoiceList(latest);
    });
    return () => {
      if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
    };
  }, []);

  // Payments State
  const INITIAL_PAYMENTS = [
    { id: 'PAY-48901', vendor: 'Tata Steel Ltd.', amount: '₹12,74,908.00', mode: 'RTGS', ref: 'RTGS-N887410B', date: '31 Jul 2026', status: 'Completed' },
    { id: 'PAY-48902', vendor: 'UltraTech Cement', amount: '₹9,00,000.00', mode: 'NEFT', ref: 'NEFT-T5420108', date: '28 Jul 2026', status: 'Scheduled' }
  ];

  const [paymentList, setPaymentList] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_payment_store');
      if (saved) return JSON.parse(saved);
    } catch (e) { }
    return INITIAL_PAYMENTS;
  });

  useEffect(() => {
    saveCloudStore('payment_store', paymentList);
  }, [paymentList]);

  // Vendor Performance scorecard
  const vendorPerformance = [
    { name: 'Tata Steel Ltd.', cat: 'Raw Material', ot: '98%', quality: '99.5%', lead: '4.2 Days', rating: 'A+' },
    { name: 'Havells India Ltd.', cat: 'Electrical', ot: '95%', quality: '98%', lead: '5.0 Days', rating: 'A' },
    { name: 'UltraTech Cement', cat: 'Construction', ot: '91%', quality: '96%', lead: '6.5 Days', rating: 'B+' },
    { name: 'Nellore Logistics', cat: 'Logistics', ot: '85%', quality: '92%', lead: '2.5 Days', rating: 'B' }
  ];

  // Spend analytics summary cards
  const spendCategories = [
    { cat: 'Raw Materials', value: '₹45,50,000.00', count: 18, color: '#3b82f6' },
    { cat: 'Electrical Goods', value: '₹12,20,000.00', count: 6, color: '#10b981' },
    { cat: 'Logistics / Transport', value: '₹4,50,000.00', count: 12, color: '#f59e0b' },
    { cat: 'Consumables & Fasteners', value: '₹2,10,000.00', count: 4, color: '#6366f1' }
  ];

  // Low Stock / Reorder Alerts
  const INITIAL_REORDER_ALERTS = [
    { id: 1, name: 'Aluminium Rail 4.2m', sku: 'AL-RAIL-4.2', category: 'Rails', warehouse: 'Main Warehouse', stock: '120', percent: '12%', minLevel: '500', uom: 'Nos', leadTime: '7 Days', reorderQty: '880', val: '8,80,000', status: 'Critical', coverage: '2 Days', level: 12 },
    { id: 2, name: 'Mid Clamp', sku: 'MC-01', category: 'Clamps', warehouse: 'Main Warehouse', stock: '926', percent: '17%', minLevel: '1,500', uom: 'Nos', leadTime: '5 Days', reorderQty: '1,250', val: '3,12,500', status: 'Critical', coverage: '3 Days', level: 17 },
    { id: 3, name: 'End Clamp', sku: 'EC-01', category: 'Clamps', warehouse: 'Main Warehouse', stock: '300', percent: '20%', minLevel: '1,500', uom: 'Nos', leadTime: '5 Days', reorderQty: '1,200', val: '2,40,000', status: 'Critical', coverage: '3 Days', level: 20 },
    { id: 4, name: 'GI Nut Bolt M8x25', sku: 'NB-M8-25', category: 'Fasteners', warehouse: 'Main Warehouse', stock: '2,450', percent: '25%', minLevel: '10,000', uom: 'Nos', leadTime: '4 Days', reorderQty: '7,550', val: '1,51,000', status: 'Low Stock', coverage: '4 Days', level: 25 },
    { id: 5, name: 'GI Nut Bolt M10x30', sku: 'NB-M10-30', category: 'Fasteners', warehouse: 'Main Warehouse', stock: '1,800', percent: '30%', minLevel: '6,000', uom: 'Nos', leadTime: '4 Days', reorderQty: '4,200', val: '1,68,000', status: 'Low Stock', coverage: '4 Days', level: 30 },
    { id: 6, name: 'Spring Washer M8', sku: 'SW-M8', category: 'Fasteners', warehouse: 'Main Warehouse', stock: '950', percent: '32%', minLevel: '3,000', uom: 'Nos', leadTime: '3 Days', reorderQty: '2,050', val: '41,000', status: 'Low Stock', coverage: '5 Days', level: 32 },
    { id: 7, name: 'L-Foot', sku: 'LF-01', category: 'Accessories', warehouse: 'Main Warehouse', stock: '160', percent: '33%', minLevel: '480', uom: 'Nos', leadTime: '7 Days', reorderQty: '320', val: '64,000', status: 'Low Stock', coverage: '6 Days', level: 33 },
    { id: 8, name: 'Cable Clip', sku: 'CC-01', category: 'Accessories', warehouse: 'Main Warehouse', stock: '3,200', percent: '35%', minLevel: '9,000', uom: 'Nos', leadTime: '3 Days', reorderQty: '5,800', val: '58,000', status: 'Low Stock', coverage: '6 Days', level: 35 },
    { id: 9, name: 'Earthing Lug', sku: 'EL-01', category: 'Electrical', warehouse: 'Main Warehouse', stock: '220', percent: '37%', minLevel: '600', uom: 'Nos', leadTime: '6 Days', reorderQty: '380', val: '45,600', status: 'Low Stock', coverage: '7 Days', level: 37 },
    { id: 10, name: 'Solar Panel Adani 540wp', sku: 'MOD-AD-540', category: 'Solar Panels', warehouse: 'Stock Area', stock: '400', percent: '40%', minLevel: '1,000', uom: 'Nos', leadTime: '5 Days', reorderQty: '600', val: '32,00,000', status: 'Low Stock', coverage: '8 Days', level: 40 }
  ];

  const [reorderAlerts, setReorderAlerts] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_reorder_alerts_store');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading reorderAlerts', e);
    }
    return INITIAL_REORDER_ALERTS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('controlroom_reorder_alerts_store', JSON.stringify(reorderAlerts));
    } catch (e) {
      console.error('Error saving reorderAlerts', e);
    }
  }, [reorderAlerts]);
  const [reorderPage, setReorderPage] = useState(1);
  const [reorderRowsPerPage, setReorderRowsPerPage] = useState(10);
  const [selectedReorders, setSelectedReorders] = useState([]);

  const [editingReorderItem, setEditingReorderItem] = useState(null);
  const [reorder3DotMenuId, setReorder3DotMenuId] = useState(null);

  const currentReorderRows = useMemo(() => {
    return reorderAlerts.slice(
      (reorderPage - 1) * reorderRowsPerPage,
      reorderPage * reorderRowsPerPage
    );
  }, [reorderAlerts, reorderPage, reorderRowsPerPage]);

  const handleCreatePoFromReorder = (selectedIds) => {
    const selectedItems = reorderAlerts.filter(r => selectedIds.includes(r.id));
    if (selectedItems.length === 0) return;
    const poItemsPayload = selectedItems.map(item => ({
      name: item.name,
      account: 'Raw Material',
      qty: parseFloat(String(item.reorderQty || '1').replace(/,/g, '')) || 1,
      unit: item.uom || 'NOS',
      rate: Math.round((parseFloat(String(item.val || '0').replace(/,/g, '')) || 0) / (parseFloat(String(item.reorderQty || '1').replace(/,/g, '')) || 1)) || 1000,
      tax: 18
    }));
    try {
      localStorage.setItem('controlroom_pending_reorder_po', JSON.stringify({
        items: poItemsPayload,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Failed to store pending reorder PO payload', e);
    }
    if (typeof onChangeTab === 'function') {
      onChangeTab('Purchase Orders');
    }
  };

  // Stock status registry
  const INITIAL_STOCK_REGISTRY = [
    { code: 'AL-001', item: 'Aluminium Rail 4.2m', category: 'Rails', location: 'Main Warehouse', stock: '120', allocated: '30', incoming: '500', minLevel: '500', val: '8,80,000', status: 'Low Stock' },
    { code: 'MC-001', item: 'Mid Clamp', category: 'Clamps', location: 'Main Warehouse', stock: '926', allocated: '100', incoming: '1,000', minLevel: '1,500', val: '3,12,500', status: 'Low Stock' },
    { code: 'EC-001', item: 'End Clamp', category: 'Clamps', location: 'Main Warehouse', stock: '2,400', allocated: '200', incoming: '-', minLevel: '1,000', val: '2,40,000', status: 'In Stock' },
    { code: 'NB-025', item: 'GI Nut Bolt M8 x 25', category: 'Fasteners', location: 'Main Warehouse', stock: '0', allocated: '0', incoming: '500', minLevel: '500', val: '1,51,000', status: 'Out of Stock' },
    { code: 'NB-030', item: 'GI Nut Bolt M10 x 30', category: 'Fasteners', location: 'Main Warehouse', stock: '1,800', allocated: '150', incoming: '-', minLevel: '2,000', val: '1,68,000', status: 'Low Stock' },
    { code: 'WS-008', item: 'Spring Washer M8', category: 'Fasteners', location: 'Main Warehouse', stock: '950', allocated: '50', incoming: '-', minLevel: '500', val: '41,000', status: 'In Stock' },
    { code: 'LF-001', item: 'L-Foot', category: 'Accessories', location: 'Main Warehouse', stock: '160', allocated: '20', incoming: '-', minLevel: '200', val: '64,000', status: 'Low Stock' },
    { code: 'CC-001', item: 'Cable Clip', category: 'Accessories', location: 'Main Warehouse', stock: '3,200', allocated: '100', incoming: '-', minLevel: '1,000', val: '58,000', status: 'In Stock' },
    { code: 'MOD-001', item: 'MODULE - ADANI BIFACIAL DCR 540wp', category: 'Solar Panels', location: 'Stock Area', stock: '850', allocated: '50', incoming: '500', minLevel: '200', val: '76,50,000', status: 'In Stock' }
  ];

  const [stockRegistry, setStockRegistry] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_stock_registry_store');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading stockRegistry', e);
    }
    return INITIAL_STOCK_REGISTRY;
  });

  useEffect(() => {
    try {
      localStorage.setItem('controlroom_stock_registry_store', JSON.stringify(stockRegistry));
    } catch (e) {
      console.error('Error saving stockRegistry', e);
    }
  }, [stockRegistry]);

  // Price comparison ledger
  const priceComparison = [
    { item: 'GI Steel Coil (MT)', lastPoPrice: '₹45,000.00', avgMarketPrice: '₹45,800.00', bestQuotePrice: '₹44,500.00', bestVendor: 'Tata Steel Ltd.' },
    { item: 'CRC Sheet (MT)', lastPoPrice: '₹52,000.00', avgMarketPrice: '₹53,200.00', bestQuotePrice: '₹51,800.00', bestVendor: 'JSW Steel Ltd.' },
    { item: 'Cement Bag (50kg)', lastPoPrice: '₹410.00', avgMarketPrice: '₹415.00', bestQuotePrice: '₹405.00', bestVendor: 'UltraTech Cement' }
  ];

  // Form Submission Handlers
  const handleCreateRFP = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (prItems.length === 0) return;

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      `, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

    const firstItem = prItems[0];
    const itemSummary = prItems.length > 1
      ? `${firstItem.name} (+ ${prItems.length - 1} items)`
      : firstItem.name;
    const qtySummary = `${firstItem.qty} ${firstItem.unit}`;

    const newRFP = {
      id: prNumber || `PR-2026-${198 + rfpList.length}`,
      requester: prRequestedBy,
      dept: prDept,
      req: itemSummary,
      qty: qtySummary,
      requiredBy: prRequiredDate ? new Date(prRequiredDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '15 Jun 2026',
      priority: prPriority,
      status: 'Pending Approval',
      date: formattedDate
    };
    setRfpList([newRFP, ...rfpList]);

    // Auto-increment PR number
    try {
      const parts = prNumber.split('-');
      const nextNum = parseInt(parts[2]) + 1;
      setPrNumber(`${parts[0]}-${parts[1]}-${nextNum}`);
    } catch (err) {
      setPrNumber(`PR-2026-${198 + rfpList.length + 1}`);
    }

    // Reset form to fresh default
    setPrPurpose('');
    setPrBudget('');
    setPrBrand('');
    setPrNotes('');
    setPrRequiredDate('');
    setPrPriority('Normal');
    setPrProject('N/A');
    setPrItems([
      { name: 'GI Steel Coil 2mm', desc: '', unit: 'MT', qty: '', date: '', vendor: 'N/A' }
    ]);
    setShowForm(false);
  };

  const handleCreateVendor = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!vName) return;

    let vStatus = 'Active';
    if (vBlacklistedVendor) vStatus = 'Blacklisted';
    else if (!vActiveVendor) vStatus = 'Inactive';
    else if (vPreferredVendor) vStatus = 'Preferred';

    const newVendorPayload = {
      name: vName,
      companyName: vName,
      type: vType === 'Select vendor type' ? 'Supplier' : vType,
      contact: vContact || '',
      phone: vPhone || '',
      email: vEmail || '',
      cat: vCat === 'Select category' ? 'Steel & Metals' : vCat,
      status: vStatus,
      rating: 5.0,
      spend: '₹ 0.00',
      terms: vPaymentTerms === 'Select payment terms' ? 'Net 30 Days' : vPaymentTerms,
      gstin: vGST || '',
      pan: vPAN || ''
    };

    // Push new vendor to Zoho Books API & refresh live list so official Zoho Contact ID is assigned as Vendor Code
    fetch('/api/zoho/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newVendorPayload)
    }).then(res => res.json()).then(data => {
      if (data.success) {
        console.log('Vendor created in Zoho Books successfully!', data);
      } else {
        console.warn('Zoho Vendor creation notice:', data);
      }
      loadVendorsFromZoho();
    }).catch(err => {
      console.error('Failed to sync vendor to Zoho:', err);
      loadVendorsFromZoho();
    });

    // Reset states
    setVName('');
    setVContact('');
    setVEmail('');
    setVPhone('');
    setVType('Select vendor type');
    setVCat('Select category');
    setVCompanyReg('');
    setVGST('');
    setVPAN('');
    setVWebsite('');
    setVRegAddress('');
    setVCity('');
    setVState('Select state');
    setVPinCode('');
    setVBillingAddress('');
    setVBillingCity('');
    setVBillingState('Select state');
    setVBillingPinCode('');
    setVSameAsRegistered(true);
    setVDesignation('');
    setVAltPhone('');
    setVPrefComm('Select option');
    setVPaymentTerms('Select payment terms');
    setVCurrency('INR - Indian Rupee');
    setVActiveVendor(true);
    setVPreferredVendor(false);
    setVBlacklistedVendor(false);
    setVTags('');
    setVInternalNotes('');
    setShowForm(false);
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {activeTab === 'Stock Status' && !showAddStockForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Stock Status Inventory</h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Real-time stock valuation ledger and warehouse storage registry</span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleExportStockCSV()}
                style={{
                  height: '38px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  color: '#1E293B',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <Download style={{ width: '16px', height: '16px', color: '#475569' }} />
                Export
              </button>
              {!isSalesUser && (
                <button
                  onClick={() => setShowAddStockForm(true)}
                  style={{
                    height: '38px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <Plus style={{ width: '16px', height: '16px' }} />
                  New Stock
                </button>
              )}
            </div>
          </div>

          {/* Top Widget Row (Stock Health, Top Low Stock Items) */}
          {(() => {
            // Calculate dynamic health metrics from computed stock items
            let inStockCount = 0;
            let lowStockCount = 0;
            let outOfStockCount = 0;

            // 1. Calculate reserved quantities ONLY from completed BOMs sent to dispatch (PIs never reserve stock)
            const bomReservedMap = new Map();
            if (Array.isArray(bomStore)) {
              bomStore.forEach(b => {
                const bStatus = String(b.status || '').toLowerCase();
                const isSentToDispatch = Boolean(b.salesConfirmed) || [
                  'sales confirmed - sent to dispatch',
                  'sent to production',
                  'confirmed',
                  'packed & ready for dispatch',
                  'partially packed',
                  'closed'
                ].some(s => bStatus.includes(s));
                if (isSentToDispatch && !bStatus.includes('cancelled') && !bStatus.includes('stock restored')) {
                  (b.items || []).forEach(pItem => {
                    const qty = parseFloat(pItem.qty || pItem.bomQty || 0) || 0;
                    if (qty > 0) {
                      const resCode = resolveProductCode(pItem).toLowerCase().trim();
                      const pCode = String(resCode || pItem.code || '').toLowerCase().trim();
                      const pName = String(pItem.name || pItem.description || '').toLowerCase().trim();
                      const norm = normalizeProductName(pName);
                      const pFp = wordFingerprint(pName);
                      if (pCode) bomReservedMap.set(pCode, (bomReservedMap.get(pCode) || 0) + qty);
                      if (pName) bomReservedMap.set(pName, (bomReservedMap.get(pName) || 0) + qty);
                      if (norm) bomReservedMap.set(norm, (bomReservedMap.get(norm) || 0) + qty);
                      if (pFp) bomReservedMap.set(pFp, (bomReservedMap.get(pFp) || 0) + qty);
                    }
                  });
                }
              });
            }

            let localRawMats = [];
            try {
              const rawStr = localStorage.getItem('controlroom_raw_materials_store');
              if (rawStr) {
                const parsed = JSON.parse(rawStr);
                if (Array.isArray(parsed)) localRawMats = parsed;
              }
            } catch (_) {}

            const rawMatMap = new Map();
            localRawMats.forEach(m => {
              const mRes = resolveProductCode(m).toLowerCase().trim();
              const mCode = String(mRes || m.code || '').toLowerCase().trim();
              const mName = String(m.name || '').toLowerCase().trim();
              const mNorm = normalizeProductName(m.name);
              const mFp = wordFingerprint(mName);
              if (mCode) rawMatMap.set(mCode, m);
              if (mName) rawMatMap.set(mName, m);
              if (mNorm) rawMatMap.set(mNorm, m);
              if (mFp) rawMatMap.set(mFp, m);
            });

            const stockDataset = (itemsList && itemsList.length > 0) ? itemsList.map(it => {
              const itRes = resolveProductCode(it).toLowerCase().trim();
              const codeKey = String(itRes || it.code || it.sku || it.itemId || '').toLowerCase().trim();
              const nameKey = String(it.name || '').toLowerCase().trim();
              const itNorm = normalizeProductName(it.name);
              const itFp = wordFingerprint(nameKey);
              const matchedMat = (codeKey && rawMatMap.get(codeKey)) || (itNorm && rawMatMap.get(itNorm)) || (nameKey && rawMatMap.get(nameKey)) || (itFp && rawMatMap.get(itFp));

              const physicalBase = Math.max(0, Number(matchedMat?.physicalStock ?? matchedMat?.openingStock ?? it.physicalStock ?? it.openingStock ?? 0));
              const activeBlocked = Math.max(
                (codeKey && bomReservedMap.get(codeKey)) || 0,
                (itNorm && bomReservedMap.get(itNorm)) || 0,
                (nameKey && bomReservedMap.get(nameKey)) || 0,
                (itFp && bomReservedMap.get(itFp)) || 0,
                Number(matchedMat?.reserved || it.reserved || 0)
              );
              let availableQty = Math.max(0, physicalBase - activeBlocked);
              if (matchedMat && matchedMat.stock !== undefined && !isNaN(matchedMat.stock) && Number(matchedMat.stock) > 0) {
                availableQty = Math.max(availableQty, Number(matchedMat.stock));
              } else if (it.stock !== undefined && !isNaN(it.stock) && Number(it.stock) > 0) {
                availableQty = Math.max(availableQty, Number(it.stock));
              }
              const minLvl = Number(it.reorderLevel || it.minLevel || 50);

              let statusText = 'In Stock';
              if (availableQty === 0) statusText = 'Out of Stock';
              else if (availableQty <= minLvl) statusText = 'Low Stock';

              return {
                name: it.name,
                stock: availableQty,
                minLevel: minLvl,
                status: statusText
              };
            }) : stockRegistry.map(it => {
              const rawNum = Math.max(0, parseFloat(String(it.stock).replace(/,/g, '')) || 0);
              const allocNum = parseFloat(String(it.allocated).replace(/,/g, '')) || 0;
              const avail = Math.max(0, rawNum - allocNum);
              return {
                name: it.item,
                stock: avail,
                minLevel: Number(it.minLevel || 50),
                status: it.status
              };
            });

            stockDataset.forEach(s => {
              if (s.status === 'Out of Stock' || s.stock === 0) outOfStockCount++;
              else if (s.status === 'Low Stock' || s.stock <= s.minLevel) lowStockCount++;
              else inStockCount++;
            });

            const total = stockDataset.length || 1;
            const inStockPct = ((inStockCount / total) * 100).toFixed(1);
            const lowStockPct = ((lowStockCount / total) * 100).toFixed(1);
            const outOfStockPct = ((outOfStockCount / total) * 100).toFixed(1);

            // Sort ascending to get lowest stock items
            const lowestItems = [...stockDataset].sort((a, b) => a.stock - b.stock).slice(0, 8);

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                {/* Stock Health Card */}
                <div className="section-card" style={{ padding: 0, overflow: 'hidden', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '16px 24px 0 24px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#0F172A' }}>Stock Health</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 24px', position: 'relative' }}>
                    {/* SVG Donut */}
                    <div style={{ position: 'relative', width: '150px', height: '150px' }}>
                      <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#F1F5F9" strokeWidth="4"></circle>
                        {/* In Stock segment */}
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#10B981" strokeWidth="4" strokeDasharray={`${inStockPct} ${100 - inStockPct}`} strokeDashoffset="0"></circle>
                        {/* Low Stock segment */}
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#F59E0B" strokeWidth="4" strokeDasharray={`${lowStockPct} ${100 - lowStockPct}`} strokeDashoffset={`-${inStockPct}`}></circle>
                        {/* Out of Stock segment */}
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#EF4444" strokeWidth="4" strokeDasharray={`${outOfStockPct} ${100 - outOfStockPct}`} strokeDashoffset={`-${parseFloat(inStockPct) + parseFloat(lowStockPct)}`}></circle>
                      </svg>
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none'
                      }}>
                        <span style={{ fontSize: '26px', fontWeight: 'bold', color: '#0F172A', fontFamily: 'Inter, system-ui' }}>{inStockPct}%</span>
                        <span style={{ fontSize: '13px', color: '#10B981', fontWeight: '500', marginTop: '2px' }}>Healthy</span>
                      </div>
                    </div>
                  </div>

                  {/* Divided Bottom section: Stock Health Breakdown */}
                  <div style={{ borderTop: '1px solid #E2E8F0', padding: '16px 24px', backgroundColor: '#fafbfc' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E293B', display: 'block', marginBottom: '12px' }}>
                      Stock Health Breakdown
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {[
                        { name: 'In Stock', count: `${inStockCount.toLocaleString('en-IN')} Items`, percentage: `${inStockPct}%`, color: '#10B981' },
                        { name: 'Low Stock', count: `${lowStockCount.toLocaleString('en-IN')} Items`, percentage: `${lowStockPct}%`, color: '#F59E0B' },
                        { name: 'Out of Stock', count: `${outOfStockCount.toLocaleString('en-IN')} Items`, percentage: `${outOfStockPct}%`, color: '#EF4444' }
                      ].map((legend, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: '#334155' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: legend.color, borderRadius: '50%', flexShrink: 0 }}></span>
                            <span style={{ fontWeight: '500' }}>{legend.name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span style={{ color: '#64748b' }}>{legend.count}</span>
                            <strong style={{ color: '#1e293b', minWidth: '40px', textAlign: 'right' }}>{legend.percentage}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Top Low Stock Items Card */}
                <div className="section-card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <strong style={{ fontSize: '14px', color: '#0F172A' }}>Top Low Stock Items</strong>
                      <span style={{ fontSize: '11px', color: '#2563EB', fontWeight: 'bold' }}>Live Data</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {lowestItems.map((item, idx) => {
                        let color = '#10B981';
                        if (item.stock === 0) color = '#EF4444';
                        else if (item.stock <= item.minLevel) color = '#F59E0B';

                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: idx === lowestItems.length - 1 ? 'none' : '1px solid #F8FAFC', paddingBottom: idx === lowestItems.length - 1 ? 0 : '8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '500', color: '#475569' }}>{item.name}</span>
                            <strong style={{ fontSize: '12px', color }}>{item.stock.toLocaleString('en-IN')}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Bottom Row: Stock Status List Table (Full Width) */}
          {(() => {
            const isSalesUser = userRole === 'Sales Executive' || userRole === 'Sales Head' || String(userRole || '').toLowerCase().includes('sales');

            // 1. Calculate reserved quantities ONLY from completed BOMs sent to dispatch (PIs never reserve stock)
            const bomReservedMap = new Map();
            if (Array.isArray(bomStore)) {
              bomStore.forEach(b => {
                const bStatus = String(b.status || '').toLowerCase();
                const isSentToDispatch = Boolean(b.salesConfirmed) || [
                  'sales confirmed - sent to dispatch',
                  'sent to production',
                  'confirmed',
                  'packed & ready for dispatch',
                  'partially packed',
                  'closed'
                ].some(s => bStatus.includes(s));
                if (isSentToDispatch && !bStatus.includes('cancelled') && !bStatus.includes('stock restored') && bStatus !== 'delivered') {
                  (b.items || []).forEach(pItem => {
                    const qty = parseFloat(pItem.qty || pItem.bomQty || 0) || 0;
                    if (qty > 0) {
                      const resCode = resolveProductCode(pItem).toLowerCase().trim();
                      const pCode = String(resCode || pItem.code || '').toLowerCase().trim();
                      const pName = String(pItem.name || pItem.description || '').toLowerCase().trim();
                      const pFp = wordFingerprint(pName);
                      if (pCode) bomReservedMap.set(pCode, (bomReservedMap.get(pCode) || 0) + qty);
                      if (pName) bomReservedMap.set(pName, (bomReservedMap.get(pName) || 0) + qty);
                      if (pFp) bomReservedMap.set(pFp, (bomReservedMap.get(pFp) || 0) + qty);
                    }
                  });
                }
              });
            }

            // 2. Read latest raw materials store for overrides
            let localRawMats = [];
            try {
              const rawStr = localStorage.getItem('controlroom_raw_materials_store');
              if (rawStr) {
                const parsed = JSON.parse(rawStr);
                if (Array.isArray(parsed)) localRawMats = parsed;
              }
            } catch (_) {}

            const rawMatMap = new Map();
            localRawMats.forEach(m => {
              const mRes = resolveProductCode(m).toLowerCase().trim();
              const mCode = String(mRes || m.code || '').toLowerCase().trim();
              const mName = String(m.name || '').toLowerCase().trim();
              const mNorm = normalizeProductName(m.name);
              const mFp = wordFingerprint(mName);
              if (mCode) rawMatMap.set(mCode, m);
              if (mName) rawMatMap.set(mName, m);
              if (mNorm) rawMatMap.set(mNorm, m);
              if (mFp) rawMatMap.set(mFp, m);
            });

            // 3. Helper to classify inventory items and filter out pure raw materials
            const classifyStockItem = (nameStr = '', catStr = '', matStr = '') => {
              const n = String(nameStr || '').toLowerCase().trim();
              const c = String(catStr || '').toLowerCase().trim();
              const m = String(matStr || '').toLowerCase().trim();

              const isPureRaw = (
                c.includes('raw') || n.includes('raw coil') || n.includes('steel coil') ||
                n.includes('zinc ingot') || n.includes('billet') || n.includes('sheet metal coil')
              ) && !n.includes('clamp') && !n.includes('leg') && !n.includes('rafter') && !n.includes('purlin') && !n.includes('rail');

              if (isPureRaw) return { isRaw: true, productType: 'Raw Material', category: 'Raw Material' };

              const accKeywords = [
                'clamp', 'fastener', 'nut', 'bolt', 'washer', 'clip', 'screw', 't nut',
                'connector', 'lug', 'gland', 'earthing', 'cable', 'wire', 'fuse',
                'mcb', 'spd', 'accessory', 'accessories', 'hardware', 'bracket'
              ];
              if (accKeywords.some(k => n.includes(k) || c.includes(k) || m.includes(k))) {
                let cleanCat = 'Accessories';
                if (n.includes('clamp')) cleanCat = 'Clamps';
                else if (n.includes('bolt') || n.includes('nut') || n.includes('washer') || n.includes('screw') || n.includes('fastener')) cleanCat = 'Fasteners & Hardware';
                else if (n.includes('cable') || n.includes('wire') || n.includes('earthing') || n.includes('acdb') || n.includes('dcdb')) cleanCat = 'Electrical';
                return { isRaw: false, productType: 'Accessories', category: cleanCat };
              }

              let cleanCat = 'Structures & Rails';
              if (n.includes('leg')) cleanCat = 'Legs & Columns';
              else if (n.includes('rafter')) cleanCat = 'Rafters';
              else if (n.includes('purlin')) cleanCat = 'Purlins';
              else if (n.includes('rail')) cleanCat = 'Rails';
              else if (n.includes('bracing')) cleanCat = 'Bracing';
              else if (n.includes('panel') || n.includes('module')) cleanCat = 'Solar Panels';
              else if (n.includes('inverter')) cleanCat = 'Inverters';

              return { isRaw: false, productType: 'Finished Goods', category: cleanCat };
            };

            // Build comprehensive item list - strictly excluding pure raw materials
            const rawCombinedList = (itemsList && itemsList.length > 0) ? itemsList.map(it => {
              const itRes = resolveProductCode(it).toLowerCase().trim();
              const codeKey = String(itRes || it.code || it.sku || it.itemId || '').toLowerCase().trim();
              const nameKey = String(it.name || '').toLowerCase().trim();
              const itNorm = normalizeProductName(it.name);
              const itFp = wordFingerprint(nameKey);
              const matchedMat = (codeKey && rawMatMap.get(codeKey)) || (itNorm && rawMatMap.get(itNorm)) || (nameKey && rawMatMap.get(nameKey)) || (itFp && rawMatMap.get(itFp));

              const physicalBase = Math.max(0, Number(matchedMat?.physicalStock ?? matchedMat?.openingStock ?? it.physicalStock ?? it.openingStock ?? 0));
              const activeBlocked = Math.max(
                (codeKey && bomReservedMap.get(codeKey)) || 0,
                (itNorm && bomReservedMap.get(itNorm)) || 0,
                (nameKey && bomReservedMap.get(nameKey)) || 0,
                (itFp && bomReservedMap.get(itFp)) || 0,
                Number(matchedMat?.reserved || it.reserved || 0)
              );
              let availableQty = Math.max(0, physicalBase - activeBlocked);
              if (matchedMat && matchedMat.stock !== undefined && !isNaN(matchedMat.stock) && Number(matchedMat.stock) > 0) {
                availableQty = Math.max(availableQty, Number(matchedMat.stock));
              } else if (it.stock !== undefined && !isNaN(it.stock) && Number(it.stock) > 0) {
                availableQty = Math.max(availableQty, Number(it.stock));
              }

              const rateVal = Number(it.rate || it.price || 250);
              const totalVal = availableQty * rateVal;
              const minLvl = Number(it.reorderLevel || it.minLevel || 50);

              let statusText = 'In Stock';
              if (availableQty === 0) statusText = 'Out of Stock';
              else if (availableQty <= minLvl) statusText = 'Low Stock';

              const classification = classifyStockItem(it.name, it.category, it.material);

              // Warehouse rule: Solar panels are stored strictly in Stock Area; all other items in Main Warehouse
              const isSolarPanelItem = (
                classification.category === 'Solar Panels' ||
                classification.category === 'Solar Modules' ||
                String(it.name || '').toLowerCase().includes('panel') ||
                String(it.name || '').toLowerCase().includes('module') ||
                String(it.category || '').toLowerCase().includes('panel') ||
                String(it.category || '').toLowerCase().includes('module')
              );
              const assignedLocation = isSolarPanelItem ? 'Stock Area' : 'Main Warehouse';

              return {
                code: it.code || it.sku || it.itemId || (itRes ? itRes.toUpperCase() : 'VRM-ITEM'),
                item: it.name,
                productType: classification.productType,
                isRaw: classification.isRaw,
                category: classification.category,
                location: assignedLocation,
                stock: availableQty.toLocaleString('en-IN'),
                allocated: activeBlocked.toLocaleString('en-IN'),
                incoming: it.incoming ? String(it.incoming) : '0',
                minLevel: minLvl.toLocaleString('en-IN'),
                val: `₹ ${totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                status: statusText,
                rawStockNum: availableQty
              };
            }) : stockRegistry.map(it => {
              const rawNum = Math.max(0, parseFloat(String(it.stock).replace(/,/g, '')) || 0);
              const allocNum = parseFloat(String(it.allocated).replace(/,/g, '')) || 0;
              const avail = Math.max(0, rawNum - allocNum);
              const classification = classifyStockItem(it.item, it.category, '');
              const isSolarPanelItem = (
                classification.category === 'Solar Panels' ||
                classification.category === 'Solar Modules' ||
                String(it.item || '').toLowerCase().includes('panel') ||
                String(it.item || '').toLowerCase().includes('module') ||
                String(it.category || '').toLowerCase().includes('panel') ||
                String(it.category || '').toLowerCase().includes('module')
              );
              const assignedLocation = isSolarPanelItem ? 'Stock Area' : 'Main Warehouse';
              return {
                ...it,
                location: assignedLocation,
                productType: classification.productType,
                isRaw: classification.isRaw,
                category: classification.category,
                stock: avail.toLocaleString('en-IN'),
                rawStockNum: avail
              };
            });

            // Exclude pure raw materials so only Finished Goods and Accessories are shown
            const combinedList = rawCombinedList.filter(row => !row.isRaw);

            // 4. Calculate primary Product Type counts
            const totalAllProducts = combinedList.length;
            const totalFinishedGoods = combinedList.filter(r => r.productType === 'Finished Goods').length;
            const totalAccessories = combinedList.filter(r => r.productType === 'Accessories').length;

            const productTypeTabs = [
              { id: 'All', label: 'All Products', count: totalAllProducts, icon: Package },
              { id: 'Finished Goods', label: 'Finished Goods / Structures', count: totalFinishedGoods, icon: Layers },
              { id: 'Accessories', label: 'Accessories & Fasteners', count: totalAccessories, icon: Boxes }
            ];

            // Dynamic categories for selected product type (never showing Raw Material)
            const dynamicCategories = Array.from(new Set(
              combinedList
                .filter(r => stockProductTypeTab === 'All' || r.productType === stockProductTypeTab)
                .map(r => r.category)
                .filter(Boolean)
            )).sort();

            // Calculate status sub-tab counts based on active product type
            const activeTypePool = stockProductTypeTab === 'All'
              ? combinedList
              : combinedList.filter(r => r.productType === stockProductTypeTab);

            const totalInStock = activeTypePool.filter(r => r.status === 'In Stock').length;
            const totalLowStock = activeTypePool.filter(r => r.status === 'Low Stock').length;
            const totalOutOfStock = activeTypePool.filter(r => r.status === 'Out of Stock').length;

            const stockTabs = [
              { id: 'All', label: 'All Items', count: activeTypePool.length, bg: '#F1F5F9', fg: '#475569' },
              { id: 'In Stock', label: 'In Stock', count: totalInStock, bg: '#DCFCE7', fg: '#15803D' },
              { id: 'Low Stock', label: 'Low Stock', count: totalLowStock, bg: '#FEF3C7', fg: '#D97706' },
              { id: 'Out of Stock', label: 'Out of Stock', count: totalOutOfStock, bg: '#FEE2E2', fg: '#DC2626' }
            ];

            // 5. Apply product type, status sub-tab, search & dropdown filters
            const filteredList = combinedList.filter(row => {
              if (stockProductTypeTab !== 'All' && row.productType !== stockProductTypeTab) {
                return false;
              }
              if (stockStatusActiveSubTab !== 'All' && row.status !== stockStatusActiveSubTab) {
                return false;
              }
              if (stockStatusSearchQuery.trim()) {
                const q = stockStatusSearchQuery.toLowerCase().trim();
                const matchItem = String(row.item || '').toLowerCase().includes(q);
                const matchCode = String(row.code || '').toLowerCase().includes(q);
                const matchType = String(row.productType || '').toLowerCase().includes(q);
                const matchCat = String(row.category || '').toLowerCase().includes(q);
                const matchLoc = String(row.location || '').toLowerCase().includes(q);
                if (!matchItem && !matchCode && !matchType && !matchCat && !matchLoc) return false;
              }
              if (stockStatusWarehouse !== 'All Warehouses' && row.location !== stockStatusWarehouse) {
                return false;
              }
              if (stockStatusCategory !== 'All Categories' && row.category !== stockStatusCategory) {
                return false;
              }
              if (stockStatusStatus !== 'All Status' && row.status !== stockStatusStatus) {
                return false;
              }
              return true;
            });

            // 6. Paginate
            const totalItems = filteredList.length;
            const totalPages = Math.ceil(totalItems / stockStatusRowsPerPage) || 1;
            const safePage = Math.min(stockStatusPage, totalPages);
            const startIndex = (safePage - 1) * stockStatusRowsPerPage;
            const displayedRows = filteredList.slice(startIndex, startIndex + stockStatusRowsPerPage);

            const isAllDisplayedSelected = displayedRows.length > 0 && displayedRows.every(r => selectedStockRows.includes(r.code || r.item));

            return (
              <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
                {/* Header & Quick Action Row */}
                <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <strong style={{ fontSize: '16px', color: '#0F172A', fontWeight: '700' }}>
                      Stock Status List ({filteredList.length.toLocaleString('en-IN')} Items)
                    </strong>
                    {filteredList.length !== combinedList.length && (
                      <span style={{ fontSize: '12px', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', borderRadius: '20px', padding: '2px 10px', fontWeight: '600' }}>
                        Filtered from {combinedList.length.toLocaleString('en-IN')} total
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleExportStockCSV(filteredList)}
                      style={{
                        height: '36px',
                        padding: '0 14px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        backgroundColor: '#FFFFFF',
                        color: '#334155',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Download style={{ width: '14px', height: '14px', color: '#64748B' }} />
                      Export CSV
                    </button>

                    <button
                      onClick={() => {
                        setStockStatusSearchQuery('');
                        setStockStatusWarehouse('All Warehouses');
                        setStockStatusCategory('All Categories');
                        setStockStatusStatus('All Status');
                        setStockStatusActiveSubTab('All');
                        setStockProductTypeTab('All');
                        setStockStatusPage(1);
                        setSelectedStockRows([]);
                      }}
                      title="Reset All Filters"
                      style={{
                        height: '36px',
                        padding: '0 12px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        backgroundColor: '#F8FAFC',
                        color: '#64748B',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <RotateCcw style={{ width: '13px', height: '13px' }} />
                      Reset
                    </button>
                  </div>
                </div>

                {/* Primary Product Type Tabs: All Products | Finished Goods / Structures | Accessories & Fasteners */}
                <div style={{ padding: '12px 24px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginRight: '4px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={14} style={{ color: '#0E7490' }} /> Product View:
                  </span>
                  {productTypeTabs.map(tab => {
                    const isActive = stockProductTypeTab === tab.id;
                    const TabIcon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setStockProductTypeTab(tab.id);
                          setStockStatusCategory('All Categories');
                          setStockStatusPage(1);
                          setSelectedStockRows([]);
                        }}
                        style={{
                          padding: '7px 16px',
                          borderRadius: '8px',
                          border: isActive ? '1px solid #0E7490' : '1px solid #CBD5E1',
                          backgroundColor: isActive ? '#0E7490' : '#FFFFFF',
                          color: isActive ? '#FFFFFF' : '#334155',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.15s ease',
                          boxShadow: isActive ? '0 2px 4px rgba(14, 116, 144, 0.2)' : 'none'
                        }}
                      >
                        <TabIcon size={14} style={{ color: isActive ? '#FFFFFF' : '#64748B' }} />
                        <span>{tab.label}</span>
                        <span style={{
                          fontSize: '11px',
                          padding: '1px 7px',
                          borderRadius: '10px',
                          backgroundColor: isActive ? 'rgba(255, 255, 255, 0.25)' : '#F1F5F9',
                          color: isActive ? '#FFFFFF' : '#475569',
                          fontWeight: '700'
                        }}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Integrated Search & Dropdown Filters Strip */}
                <div style={{ padding: '14px 24px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
                    <input
                      type="text"
                      value={stockStatusSearchQuery}
                      onChange={(e) => {
                        setStockStatusSearchQuery(e.target.value);
                        setStockStatusPage(1);
                      }}
                      placeholder="Search by Material / SKU / Code / Type..."
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px 0 36px', fontSize: '13px', width: '100%', boxSizing: 'border-box', backgroundColor: '#FFFFFF' }}
                    />
                    <Search style={{ width: '14px', height: '14px', color: '#94A3B8', position: 'absolute', left: '12px', top: '12px' }} />
                  </div>

                  <div style={{ minWidth: '160px' }}>
                    <select
                      value={stockStatusWarehouse}
                      onChange={(e) => {
                        setStockStatusWarehouse(e.target.value);
                        setStockStatusPage(1);
                      }}
                      style={{ height: '38px', width: '100%', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#FFFFFF', color: '#334155', fontWeight: '500' }}
                    >
                      <option value="All Warehouses">All Warehouses</option>
                      <option value="Main Warehouse">Main Warehouse</option>
                      <option value="Stock Area">Stock Area</option>
                    </select>
                  </div>

                  <div style={{ minWidth: '170px' }}>
                    <select
                      value={stockStatusCategory}
                      onChange={(e) => {
                        setStockStatusCategory(e.target.value);
                        setStockStatusPage(1);
                      }}
                      style={{ height: '38px', width: '100%', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#FFFFFF', color: '#334155', fontWeight: '500' }}
                    >
                      <option value="All Categories">All Categories ({dynamicCategories.length})</option>
                      {dynamicCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Status Sub-Tabs Row */}
                <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', padding: '0 24px', gap: '20px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: '#FFFFFF' }}>
                  {stockTabs.map(tab => {
                    const isActive = stockStatusActiveSubTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setStockStatusActiveSubTab(tab.id);
                          setStockStatusPage(1);
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          padding: '12px 4px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          color: isActive ? '#0E7490' : '#64748B',
                          borderBottom: isActive ? '2px solid #0E7490' : '2px solid transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        {tab.label}
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: tab.bg,
                          color: tab.fg,
                          fontWeight: 'bold'
                        }}>
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Main Data Table with Checkboxes & Interactive Row Selection */}
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table className="custom-table" style={{ width: '100%', minWidth: '1180px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                        <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                          <input
                            type="checkbox"
                            style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                            checked={isAllDisplayedSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const idsToAdd = displayedRows.map(r => r.code || r.item);
                                setSelectedStockRows(prev => Array.from(new Set([...prev, ...idsToAdd])));
                              } else {
                                const idsToRemove = displayedRows.map(r => r.code || r.item);
                                setSelectedStockRows(prev => prev.filter(id => !idsToRemove.includes(id)));
                              }
                            }}
                          />
                        </th>
                        <th style={{ padding: '12px 14px', width: '50px', minWidth: '50px' }}>#</th>
                        <th style={{ padding: '12px 14px', minWidth: '220px' }}>Material / SKU</th>
                        <th style={{ padding: '12px 14px', width: '135px', minWidth: '135px' }}>Type</th>
                        <th style={{ padding: '12px 14px', width: '135px', minWidth: '135px' }}>Category</th>
                        <th style={{ padding: '12px 14px', width: '140px', minWidth: '140px' }}>Warehouse</th>
                        <th style={{ padding: '12px 14px', width: '110px', minWidth: '110px', textAlign: 'center' }}>Available Qty</th>
                        <th style={{ padding: '12px 14px', width: '110px', minWidth: '110px', textAlign: 'center' }}>Reserved Qty</th>
                        {!isSalesUser && (
                          <th style={{ padding: '12px 14px', width: '100px', minWidth: '100px', textAlign: 'center' }}>Incoming Qty</th>
                        )}
                        {!isSalesUser && (
                          <th style={{ padding: '12px 14px', width: '110px', minWidth: '110px', textAlign: 'center' }}>Reorder Level</th>
                        )}
                        {!isSalesUser && (
                          <th style={{ padding: '12px 14px', width: '130px', minWidth: '130px', textAlign: 'right' }}>Stock Value (₹)</th>
                        )}
                        <th style={{ padding: '12px 14px', width: '125px', minWidth: '125px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRows.length === 0 ? (
                        <tr>
                          <td colSpan={isSalesUser ? 9 : 12} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748B' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <Package style={{ width: '32px', height: '32px', color: '#94A3B8' }} />
                              <strong style={{ color: '#334155' }}>No stock items match the selected criteria</strong>
                              <span style={{ fontSize: '12px', color: '#94A3B8' }}>Try adjusting your search query or product type filters above.</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        displayedRows.map((row, idx) => {
                          const rowKey = row.code || row.item;
                          const isChecked = selectedStockRows.includes(rowKey);

                          let qtyColor = '#10B981'; // Green
                          if (row.rawStockNum === 0 || row.status === 'Out of Stock') {
                            qtyColor = '#EF4444'; // Red
                          } else if (row.status === 'Low Stock') {
                            qtyColor = '#F59E0B'; // Orange
                          }

                          let badgeColors = { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
                          if (row.status === 'Low Stock') {
                            badgeColors = { bg: '#fffbeb', color: '#d97706', border: '#fef3c7' };
                          } else if (row.status === 'Out of Stock') {
                            badgeColors = { bg: '#fff5f5', color: '#e53e3e', border: '#fed7d7' };
                          }

                          return (
                            <tr
                              key={rowKey || idx}
                              onClick={() => setViewingStockItem(row)}
                              style={{
                                borderBottom: '1px solid #F1F5F9',
                                transition: 'all 0.15s ease',
                                backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                                cursor: 'pointer'
                              }}
                              className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                            >
                              <td
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: '48px',
                                  minWidth: '48px',
                                  padding: '12px 0',
                                  textAlign: 'center',
                                  verticalAlign: 'middle',
                                  borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent',
                                  boxSizing: 'border-box'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedStockRows(prev =>
                                      prev.includes(rowKey) ? prev.filter(k => k !== rowKey) : [...prev, rowKey]
                                    );
                                  }}
                                />
                              </td>
                              <td style={{ padding: '12px 14px', color: '#94A3B8', fontSize: '12px' }}>
                                {startIndex + idx + 1}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ fontWeight: '700', color: '#0F172A', cursor: 'pointer' }}>{row.item}</div>
                                <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '600' }}>{row.code}</div>
                              </td>
                              <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                {row.productType === 'Finished Goods' ? (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    backgroundColor: '#EFF6FF',
                                    color: '#1D4ED8',
                                    border: '1px solid #BFDBFE'
                                  }}>
                                    <Layers size={11} style={{ color: '#2563EB' }} />
                                    Finished Good
                                  </span>
                                ) : (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    backgroundColor: '#FAF5FF',
                                    color: '#7E22CE',
                                    border: '1px solid #E9D5FF'
                                  }}>
                                    <Boxes size={11} style={{ color: '#9333EA' }} />
                                    Accessory
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '12px 14px', color: '#475569' }}>
                                <span style={{ backgroundColor: '#F1F5F9', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>
                                  {row.category}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px', color: '#475569' }}>{row.location}</td>
                              <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700', color: qtyColor, fontSize: '13px' }}>
                                {row.stock}
                              </td>
                              <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748B' }}>
                                {row.allocated}
                              </td>
                              {!isSalesUser && (
                                <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748B' }}>
                                  {row.incoming}
                                </td>
                              )}
                              {!isSalesUser && (
                                <td style={{ padding: '12px 14px', textAlign: 'center', color: '#475569', fontWeight: '600' }}>
                                  {row.minLevel}
                                </td>
                              )}
                              {!isSalesUser && (
                                <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                                  {row.val}
                                </td>
                              )}
                              <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  backgroundColor: badgeColors.bg,
                                  color: badgeColors.color,
                                  border: `1px solid ${badgeColors.border}`,
                                  whiteSpace: 'nowrap'
                                }}>
                                  <span style={{ width: '6px', height: '6px', minWidth: '6px', minHeight: '6px', borderRadius: '50%', backgroundColor: badgeColors.color, display: 'inline-block', flexShrink: 0 }} />
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Standard Pagination Footer Layout */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
                  {/* Left Side: Rows per page selector restricted strictly to 5, 10 + Showing X to Y of Z entries */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>Showing per page</span>
                      <select
                        value={stockStatusRowsPerPage}
                        onChange={(e) => {
                          setStockStatusRowsPerPage(Number(e.target.value));
                          setStockStatusPage(1);
                        }}
                        style={{ height: '32px', borderRadius: '6px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '12px', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: '600' }}
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                      </select>
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      Showing {totalItems === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + stockStatusRowsPerPage, totalItems)} of {totalItems} entries
                    </span>
                  </div>

                  {/* Right Side: Page buttons adjacent to Go to page */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        disabled={safePage <= 1}
                        onClick={() => setStockStatusPage(1)}
                        style={{ border: '1px solid #E2E8F0', background: safePage <= 1 ? '#F8FAFC' : '#FFFFFF', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
                      >
                        &laquo;
                      </button>
                      <button
                        disabled={safePage <= 1}
                        onClick={() => setStockStatusPage(prev => Math.max(prev - 1, 1))}
                        style={{ border: '1px solid #E2E8F0', background: safePage <= 1 ? '#F8FAFC' : '#FFFFFF', cursor: safePage <= 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                      >
                        &lt;
                      </button>

                      {(() => {
                        let start = Math.max(1, safePage - 1);
                        let end = start + 2;
                        if (end > totalPages) {
                          end = totalPages;
                          start = Math.max(1, end - 2);
                        }
                        return Array.from({ length: Math.max(1, end - start + 1) }, (_, i) => start + i).map(page => (
                          <button
                            key={page}
                            onClick={() => setStockStatusPage(page)}
                            style={{
                              border: '1px solid #E2E8F0',
                              background: page === safePage ? '#0E7490' : '#FFFFFF',
                              color: page === safePage ? '#FFFFFF' : '#475569',
                              cursor: 'pointer',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontWeight: page === safePage ? 'bold' : '500'
                            }}
                          >
                            {page}
                          </button>
                        ));
                      })()}

                      <button
                        disabled={safePage >= totalPages}
                        onClick={() => setStockStatusPage(prev => Math.min(prev + 1, totalPages))}
                        style={{ border: '1px solid #E2E8F0', background: safePage >= totalPages ? '#F8FAFC' : '#FFFFFF', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                      >
                        &gt;
                      </button>
                      <button
                        disabled={safePage >= totalPages}
                        onClick={() => setStockStatusPage(totalPages)}
                        style={{ border: '1px solid #E2E8F0', background: safePage >= totalPages ? '#F8FAFC' : '#FFFFFF', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
                      >
                        &raquo;
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>Go to page</span>
                      <input
                        type="number"
                        min="1"
                        max={totalPages || 1}
                        value={stockStatusGoToInput}
                        onChange={(e) => setStockStatusGoToInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt(stockStatusGoToInput, 10);
                            if (val >= 1 && val <= totalPages) {
                              setStockStatusPage(val);
                              setStockStatusGoToInput('');
                            }
                          }
                        }}
                        placeholder={String(safePage)}
                        style={{ width: '44px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}
                      />
                      <button
                        onClick={() => {
                          const val = parseInt(stockStatusGoToInput, 10);
                          if (val >= 1 && val <= totalPages) {
                            setStockStatusPage(val);
                            setStockStatusGoToInput('');
                          }
                        }}
                        style={{ height: '32px', padding: '0 10px', borderRadius: '6px', border: '1px solid #0E7490', backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        Go &rsaquo;
                      </button>
                    </div>
                  </div>
                </div>

                {/* Floating Selection Toolbar for Stock Status List Table */}
                {selectedStockRows.length > 0 && (
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
                      <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedStockRows.length}</strong> Selected
                    </span>

                    <button
                      onClick={() => {
                        const firstKey = selectedStockRows[0];
                        const targetRow = combinedList.find(r => (r.code || r.item) === firstKey);
                        if (targetRow) setViewingStockItem(targetRow);
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
                      <Eye size={14} style={{ color: '#0E7490' }} /> View Details
                    </button>

                    {!isSalesUser && (
                      <button
                        onClick={() => handleCreatePoFromSelectedStock(selectedStockRows, combinedList)}
                        style={{
                          backgroundColor: '#0E7490',
                          border: 'none',
                          color: '#FFFFFF',
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
                          boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)'
                        }}
                      >
                        <ShoppingCart size={14} style={{ color: '#FFFFFF' }} /> Create PO / Reorder
                      </button>
                    )}

                    <button
                      onClick={() => {
                        const selectedData = combinedList.filter(r => selectedStockRows.includes(r.code || r.item));
                        handleExportStockCSV(selectedData);
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
                      <Download size={14} style={{ color: '#059669' }} /> Export Selected
                    </button>

                    <button
                      onClick={() => setSelectedStockRows([])}
                      title="Deselect all"
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        flexShrink: 0
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Stock Item Details Modal */}
                {viewingStockItem && (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10001,
                    padding: '20px'
                  }}>
                    <div style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '16px',
                      width: '100%',
                      maxWidth: '640px',
                      maxHeight: '90vh',
                      overflowY: 'auto',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                      fontFamily: "'Plus Jakarta Sans', sans-serif"
                    }}>
                      <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>{viewingStockItem.item}</h3>
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#ECFEFF', color: '#0E7490', fontWeight: '700' }}>
                              {viewingStockItem.code}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontWeight: '700',
                              backgroundColor: viewingStockItem.productType === 'Finished Goods' ? '#EFF6FF' : '#FAF5FF',
                              color: viewingStockItem.productType === 'Finished Goods' ? '#1D4ED8' : '#7E22CE',
                              border: `1px solid ${viewingStockItem.productType === 'Finished Goods' ? '#BFDBFE' : '#E9D5FF'}`
                            }}>
                              {viewingStockItem.productType === 'Finished Goods' ? 'Finished Good' : 'Accessory'}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748B' }}>
                              Category: <strong style={{ color: '#334155' }}>{viewingStockItem.category}</strong> &bull; Warehouse: <strong style={{ color: '#334155' }}>{viewingStockItem.location}</strong>
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setViewingStockItem(null)}
                          style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{
                          padding: '12px 16px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          backgroundColor: viewingStockItem.status === 'In Stock' ? '#F0FDF4' : viewingStockItem.status === 'Low Stock' ? '#FFFBEB' : '#FEF2F2',
                          border: `1px solid ${viewingStockItem.status === 'In Stock' ? '#BBF7D0' : viewingStockItem.status === 'Low Stock' ? '#FEF3C7' : '#FECACA'}`
                        }}>
                          {viewingStockItem.status === 'In Stock' ? (
                            <CheckCircle size={18} style={{ color: '#15803D' }} />
                          ) : (
                            <AlertTriangle size={18} style={{ color: viewingStockItem.status === 'Low Stock' ? '#D97706' : '#DC2626' }} />
                          )}
                          <div>
                            <strong style={{ fontSize: '13px', color: viewingStockItem.status === 'In Stock' ? '#15803D' : viewingStockItem.status === 'Low Stock' ? '#D97706' : '#DC2626' }}>
                              Status: {viewingStockItem.status}
                            </strong>
                            <div style={{ fontSize: '12px', color: '#475569' }}>
                              {viewingStockItem.status === 'In Stock'
                                ? 'Stock is currently healthy and above minimum safety buffer.'
                                : viewingStockItem.status === 'Low Stock'
                                ? 'Inventory is below the minimum reorder threshold. Replenishment recommended.'
                                : 'Inventory is completely exhausted. Immediate procurement order required.'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isSalesUser ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '12px' }}>
                          <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Available Stock</span>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: viewingStockItem.status === 'In Stock' ? '#10B981' : viewingStockItem.status === 'Low Stock' ? '#F59E0B' : '#EF4444', marginTop: '4px' }}>
                              {viewingStockItem.stock}
                            </div>
                          </div>
                          <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Reserved (BOM/PI)</span>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#475569', marginTop: '4px' }}>
                              {viewingStockItem.allocated}
                            </div>
                          </div>
                          {!isSalesUser && (
                            <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Incoming (PO)</span>
                              <div style={{ fontSize: '20px', fontWeight: '800', color: '#2563EB', marginTop: '4px' }}>
                                {viewingStockItem.incoming}
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
                          {!isSalesUser && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                              <span style={{ fontSize: '13px', color: '#64748B' }}>Reorder Level (Min Buffer)</span>
                              <strong style={{ fontSize: '13px', color: '#0F172A' }}>{viewingStockItem.minLevel} NOS</strong>
                            </div>
                          )}
                          {!isSalesUser && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                              <span style={{ fontSize: '13px', color: '#64748B' }}>Total Stock Valuation</span>
                              <strong style={{ fontSize: '13px', color: '#0F172A' }}>{viewingStockItem.val}</strong>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
                            <span style={{ fontSize: '13px', color: '#64748B' }}>Warehouse Storage Location</span>
                            <strong style={{ fontSize: '13px', color: '#0F172A' }}>{viewingStockItem.location}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                          onClick={() => setViewingStockItem(null)}
                          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Close
                        </button>
                        {!isSalesUser && (
                          <button
                            onClick={() => {
                              const itemKey = viewingStockItem.code || viewingStockItem.item;
                              setViewingStockItem(null);
                              handleCreatePoFromSelectedStock([itemKey], combinedList);
                            }}
                            style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <ShoppingCart size={15} />
                            Create PO / Reorder Item
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Bottom Info bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#EFF6FF', borderRadius: '12px', padding: '14px 20px', border: '1px solid #DBEAFE' }}>
            <Info style={{ width: '16px', height: '16px', color: '#2563EB', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#1E40AF', fontWeight: '600' }}>
              Stock status is updated in real-time. Last updated on 31 May 2025, 10:30 AM
            </span>
          </div>
        </div>
      )}

      {/* Add Stock Form View */}
      {activeTab === 'Stock Status' && showAddStockForm && !isSalesUser && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>New Stock</h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Manually add inventory into a selected warehouse</span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowAddStockForm(false)}
                style={{
                  height: '38px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  color: '#1E293B',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddStockSubmit}
                style={{
                  height: '38px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  color: '#2563EB',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Save Draft
              </button>
              <button
                onClick={handleAddStockSubmit}
                style={{
                  height: '38px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <Plus style={{ width: '16px', height: '16px' }} />
                New Stock
              </button>
            </div>
          </div>

          {/* Form Columns */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
            {/* Left Column (70%) */}
            <div style={{ flex: '1 1 70%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* 1. STOCK ENTRY DETAILS */}
              <div className="section-card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <PlusCircle style={{ width: '16px', height: '16px', color: '#2563EB' }} />
                  <strong style={{ fontSize: '13px', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>1. Stock Entry Details</strong>
                  <Info style={{ width: '14px', height: '14px', color: '#94A3B8', cursor: 'pointer' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>Entry Type <span style={{ color: '#EF4444' }}>*</span></label>
                    <select
                      value={stockEntry.entryType}
                      onChange={(e) => setStockEntry({ ...stockEntry, entryType: e.target.value })}
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                    >
                      <option>Stock Addition</option>
                      <option>Stock Adjustment</option>
                      <option>Manual Correction</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>Warehouse <span style={{ color: '#EF4444' }}>*</span></label>
                    <select
                      value={stockEntry.warehouse}
                      onChange={(e) => setStockEntry({ ...stockEntry, warehouse: e.target.value })}
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                    >
                      <option>Main Warehouse</option>
                      <option>Stock Area</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>Entry Date <span style={{ color: '#EF4444' }}>*</span></label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={stockEntry.entryDate}
                        onChange={(e) => setStockEntry({ ...stockEntry, entryDate: e.target.value })}
                        style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px 0 12px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                      />
                      <Calendar style={{ width: '14px', height: '14px', color: '#64748B', position: 'absolute', right: '12px' }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>Reason <span style={{ color: '#EF4444' }}>*</span></label>
                    <select
                      value={stockEntry.reason}
                      onChange={(e) => setStockEntry({ ...stockEntry, reason: e.target.value })}
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                    >
                      <option>Opening Stock</option>
                      <option>Discrepancy Correction</option>
                      <option>Found Stock</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>Reference No.</label>
                    <input
                      type="text"
                      value={stockEntry.refNo}
                      onChange={(e) => setStockEntry({ ...stockEntry, refNo: e.target.value })}
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>Added By</label>
                    <input
                      type="text"
                      value={stockEntry.addedBy}
                      disabled
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#F8FAFC', color: '#64748B', width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. MATERIAL DETAILS */}
              <div className="section-card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText style={{ width: '16px', height: '16px', color: '#2563EB' }} />
                  <strong style={{ fontSize: '13px', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>2. Material Details</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                    <input
                      type="text"
                      placeholder="Search Material / SKU / Barcode"
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px 0 36px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                    />
                    <Search style={{ width: '14px', height: '14px', color: '#64748B', position: 'absolute', left: '12px' }} />
                  </div>
                  <button style={{
                    height: '38px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    color: '#2563EB',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}>
                    <Plus style={{ width: '14px', height: '14px' }} />
                    Add Material
                  </button>
                </div>

                {/* Items Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '700px !important' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ width: '40px', padding: '10px', textAlign: 'center' }}>#</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Material / SKU</th>
                        <th style={{ padding: '10px', textAlign: 'left' }}>Category</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Current Stock</th>
                        <th style={{ padding: '10px', textAlign: 'center', width: '100px' }}>Add Quantity</th>
                        <th style={{ padding: '10px', textAlign: 'center' }}>Unit</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Rate (₹)</th>
                        <th style={{ padding: '10px', textAlign: 'right' }}>Amount (₹)</th>
                        <th style={{ padding: '10px', textAlign: 'center', width: '60px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addStockItems.map((item, idx) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ textAlign: 'center', padding: '12px 10px' }}>{idx + 1}</td>
                          <td style={{ padding: '12px 10px' }}>
                            <div style={{ fontWeight: '600', color: '#1E293B' }}>{item.name}</div>
                            <div style={{ fontSize: '10px', color: '#64748B' }}>{item.sku}</div>
                          </td>
                          <td style={{ padding: '12px 10px', color: '#475569' }}>{item.category}</td>
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            <div style={{ fontWeight: '600', color: '#475569' }}>{item.currentStock.split(' ')[0]}</div>
                            <div style={{ fontSize: '10px', color: '#64748B' }}>{item.currentStock.split(' ')[1]}</div>
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            <input
                              type="number"
                              value={item.qty}
                              onChange={(e) => {
                                const newItems = [...addStockItems];
                                newItems[idx].qty = Number(e.target.value);
                                setAddStockItems(newItems);
                              }}
                              style={{ width: '80px', height: '32px', textAlign: 'center', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '13px' }}
                            />
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center', color: '#64748B' }}>{item.uom}</td>
                          <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '500', color: '#475569' }}>{item.rate.toFixed(2)}</td>
                          <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 'bold', color: '#0F172A' }}>
                            {(item.qty * item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                const newItems = addStockItems.filter(it => it.id !== item.id);
                                setAddStockItems(newItems);
                              }}
                              style={{ border: 'none', backgroundColor: 'transparent', color: '#EF4444', cursor: 'pointer' }}
                            >
                              <Trash2 style={{ width: '16px', height: '16px' }} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={() => {
                    const nextId = addStockItems.length > 0 ? Math.max(...addStockItems.map(i => i.id)) + 1 : 1;
                    setAddStockItems([...addStockItems, { id: nextId, name: 'New Material Item', sku: `SKU-${nextId}`, category: 'General', currentStock: '0 Nos', qty: 100, uom: 'Nos', rate: 10.00 }]);
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    height: '34px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Plus style={{ width: '14px', height: '14px' }} />
                  Add Another Item
                </button>
              </div>

              {/* 3. STOCK DETAILS (Optional) */}
              <div className="section-card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText style={{ width: '16px', height: '16px', color: '#2563EB' }} />
                  <strong style={{ fontSize: '13px', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>3. Stock Details (Optional)</strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>Batch / Lot No.</label>
                    <input
                      type="text"
                      value={stockDetails.batchNo}
                      onChange={(e) => setStockDetails({ ...stockDetails, batchNo: e.target.value })}
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>Supplier</label>
                    <input
                      type="text"
                      value={stockDetails.supplier}
                      onChange={(e) => setStockDetails({ ...stockDetails, supplier: e.target.value })}
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>Manufacturing Date</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={stockDetails.mfgDate}
                        onChange={(e) => setStockDetails({ ...stockDetails, mfgDate: e.target.value })}
                        style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                      />
                      <Calendar style={{ width: '14px', height: '14px', color: '#64748B', position: 'absolute', right: '12px' }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>Expiry Date</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Select date"
                        value={stockDetails.expiryDate}
                        onChange={(e) => setStockDetails({ ...stockDetails, expiryDate: e.target.value })}
                        style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                      />
                      <Calendar style={{ width: '14px', height: '14px', color: '#64748B', position: 'absolute', right: '12px' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>Storage Location</label>
                    <select
                      value={stockDetails.storageLocation}
                      onChange={(e) => setStockDetails({ ...stockDetails, storageLocation: e.target.value })}
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                    >
                      <option>Rack A-04</option>
                      <option>Rack B-12</option>
                      <option>Pallet Area 2</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>Remarks / Notes</label>
                    <input
                      type="text"
                      value={stockDetails.remarks}
                      onChange={(e) => setStockDetails({ ...stockDetails, remarks: e.target.value })}
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              {/* 4. DOCUMENTS */}
              <div className="section-card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <strong style={{ fontSize: '13px', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>4. Documents</strong>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '8px' }}>Upload Document</label>
                    <div style={{
                      border: '2px dashed #CBD5E1',
                      borderRadius: '8px',
                      height: '80px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: '4px',
                      cursor: 'pointer',
                      backgroundColor: '#F8FAFC'
                    }}>
                      <Upload style={{ width: '20px', height: '20px', color: '#2563EB' }} />
                      <span style={{ fontSize: '11px', color: '#475569' }}>
                        <strong style={{ color: '#2563EB' }}>Click to upload</strong> or drag and drop
                      </span>
                      <span style={{ fontSize: '9px', color: '#94A3B8' }}>PDF, JPG, PNG (Max. 10MB)</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B', display: 'block', marginBottom: '8px' }}>Uploaded Documents</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {stockDocs.map((doc, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #E2E8F0',
                          backgroundColor: '#FFFFFF'
                        }}>
                          <FileText style={{ width: '24px', height: '24px', color: '#EF4444' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {doc.name}
                            </div>
                            <div style={{ fontSize: '9px', color: '#94A3B8' }}>{doc.size}</div>
                          </div>
                          <Download style={{ width: '14px', height: '14px', color: '#64748B', cursor: 'pointer' }} />
                          <Trash2
                            onClick={() => setStockDocs(stockDocs.filter(d => d.name !== doc.name))}
                            style={{ width: '14px', height: '14px', color: '#EF4444', cursor: 'pointer' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column (30%) */}
            <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px', flexShrink: 0 }}>

              {/* STOCK ENTRY SUMMARY */}
              <div className="section-card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText style={{ width: '16px', height: '16px', color: '#2563EB' }} />
                  <strong style={{ fontSize: '13px', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stock Entry Summary</strong>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                  {[
                    { label: 'Entry Type', value: stockEntry.entryType },
                    { label: 'Reason', value: stockEntry.reason },
                    { label: 'Warehouse', value: stockEntry.warehouse },
                    { label: 'Entry Date', value: stockEntry.entryDate },
                    { label: 'Reference No.', value: stockEntry.refNo },
                    { label: 'Added By', value: stockEntry.addedBy }
                  ].map((row, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F8FAFC', paddingBottom: '8px' }}>
                      <span style={{ color: '#64748B' }}>{row.label}</span>
                      <strong style={{ color: '#0F172A' }}>{row.value || '—'}</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* AMOUNT SUMMARY */}
              <div className="section-card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <strong style={{ fontSize: '13px', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount Summary</strong>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Total Items</span>
                    <strong style={{ color: '#0F172A' }}>{addStockItems.length}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748B' }}>Total Quantity</span>
                    <strong style={{ color: '#0F172A' }}>
                      {addStockItems.reduce((acc, it) => acc + Number(it.qty || 0), 0)} Nos
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                    <span style={{ color: '#64748B' }}>Total Stock Value</span>
                    <strong style={{ color: '#0F172A' }}>
                      ₹ {addStockItems.reduce((acc, it) => acc + (it.qty * it.rate), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>

                  <div style={{ backgroundColor: '#F8FAFC', borderRadius: '8px', padding: '12px', border: '1px solid #F1F5F9', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '4px' }}>Total Amount (₹)</span>
                    <strong style={{ fontSize: '20px', color: '#16A34A' }}>
                      {addStockItems.reduce((acc, it) => acc + (it.qty * it.rate), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div style={{ display: 'flex', gap: '10px', backgroundColor: '#EFF6FF', borderRadius: '12px', padding: '16px', border: '1px solid #DBEAFE' }}>
                <Info style={{ width: '16px', height: '16px', color: '#2563EB', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <strong style={{ fontSize: '12px', color: '#1E40AF' }}>Note</strong>
                  <span style={{ fontSize: '11px', color: '#1E40AF', lineHeight: '1.4' }}>
                    Use Add Stock for opening stock, stock adjustment, found stock or manual corrections only. For purchased goods, use GRN.
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ==================== 11. PRICE COMPARISON SCREEN ==================== */}
    </div>
  );
}
