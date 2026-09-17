import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Plus, Check, Trash2, Eye, FileText, Search, PlusCircle, AlertCircle, AlertTriangle, X,
  TrendingUp, Users, CheckCircle, Clock, ShieldAlert, Award,
  MapPin, Phone, Mail, FileCheck, CheckSquare, XCircle, ArrowRight, ArrowLeft,
  TrendingDown, DollarSign, Calendar, Edit3, SlidersHorizontal, Filter,
  ChevronLeft, ChevronRight, MoreVertical, RotateCcw, UploadCloud, ChevronDown, ChevronUp, ExternalLink,
  Truck, Shield, Package, Star, Download, HelpCircle, Info, ShoppingCart, Upload, Printer, Maximize2,
  ShieldCheck, Layers, Factory, Cpu, Receipt, IndianRupee, Smartphone, Camera, Image, RefreshCw,
  CreditCard, Bell, Video, Play, Pause, Film, Sparkles, MoreHorizontal, Copy, Hourglass, Boxes, Send
} from 'lucide-react';
import TopSpendingCategories from '../TopSpendingCategories';
import POTrendChart from '../POTrendChart';
import { getSafeZohoVendors, getSafeZohoItems } from '../../services/zohoSafeSync';
import { fetchCloudStore, saveCloudStore, subscribeToCloudStore } from '../../utils/supabaseDataSync';
import { saveMediaToCache, getMediaFromCache, stripDataUrlsFromRecord, readCompressedImage, compressAndSaveFile } from '../../utils/otherViewsShared';


export default function VendorManagementView(props) {
  const {
    activeTab,
    onChangeTab,
    userRole = 'Sales Executive',
    convertingPiData = null,
    onClearConvertingPiData
  } = props;

  // Common states
  const [searchQuery, setSearchQuery] = useState('');
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

  const [bomStore, setBomStore] = useState([]);

  // bomStore saving removed from secondary view

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
                // Merge parsed with localCurrent
                const currentMap = new Map();
                localCurrent.forEach(i => i && currentMap.set(i.bomCode || i.code, i));
                parsed.forEach(i => i && currentMap.set(i.bomCode || i.code, i));
                localCurrent = Array.from(currentMap.values());
              }
            }
          } catch (e) { }

          // Insert cloud data first, then overlay local state so fresh local BOMs ALWAYS overwrite remote data
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
    };

    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('controlroom_storage_update', syncFromStorage);

    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('controlroom_storage_update', syncFromStorage);
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
    });
    setStockRegistry(updatedRegistry);
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
  const [itemsList, setItemsList] = useState([]);
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

  useEffect(() => {
    let isMounted = true;
    const fetchZohoItems = async () => {
      try {
        setItemsLoading(true);
        const zohoItems = await getSafeZohoItems();
        if (isMounted && Array.isArray(zohoItems) && zohoItems.length > 0) {
          setItemsList(prev => {
            const itemMap = new Map();
            (prev || []).forEach(it => itemMap.set(it.code || it.sku || it.itemId || it.id || it.name, it));
            zohoItems.forEach(it => {
              const key = it.code || it.sku || it.itemId || it.id || it.name;
              if (key) itemMap.set(key, { ...itemMap.get(key), ...it });
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
                (prev || []).forEach(it => itemMap.set(it.code || it.sku || it.itemId || it.id || it.name, it));
                zItems.forEach(it => {
                  const key = it.code || it.sku || it.itemId || it.id || it.name;
                  if (key) itemMap.set(key, { ...itemMap.get(key), ...it });
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
    { id: 3, name: 'End Clamp', sku: 'EC-01', category: 'Clamps', warehouse: 'Regional Warehouse', stock: '300', percent: '20%', minLevel: '1,500', uom: 'Nos', leadTime: '5 Days', reorderQty: '1,200', val: '2,40,000', status: 'Critical', coverage: '3 Days', level: 20 },
    { id: 4, name: 'GI Nut Bolt M8x25', sku: 'NB-M8-25', category: 'Fasteners', warehouse: 'Main Warehouse', stock: '2,450', percent: '25%', minLevel: '10,000', uom: 'Nos', leadTime: '4 Days', reorderQty: '7,550', val: '1,51,000', status: 'Low Stock', coverage: '4 Days', level: 25 },
    { id: 5, name: 'GI Nut Bolt M10x30', sku: 'NB-M10-30', category: 'Fasteners', warehouse: 'Regional Warehouse', stock: '1,800', percent: '30%', minLevel: '6,000', uom: 'Nos', leadTime: '4 Days', reorderQty: '4,200', val: '1,68,000', status: 'Low Stock', coverage: '4 Days', level: 30 },
    { id: 6, name: 'Spring Washer M8', sku: 'SW-M8', category: 'Fasteners', warehouse: 'Main Warehouse', stock: '950', percent: '32%', minLevel: '3,000', uom: 'Nos', leadTime: '3 Days', reorderQty: '2,050', val: '41,000', status: 'Low Stock', coverage: '5 Days', level: 32 },
    { id: 7, name: 'L-Foot', sku: 'LF-01', category: 'Accessories', warehouse: 'Main Warehouse', stock: '160', percent: '33%', minLevel: '480', uom: 'Nos', leadTime: '7 Days', reorderQty: '320', val: '64,000', status: 'Low Stock', coverage: '6 Days', level: 33 },
    { id: 8, name: 'Cable Clip', sku: 'CC-01', category: 'Accessories', warehouse: 'Regional Warehouse', stock: '3,200', percent: '35%', minLevel: '9,000', uom: 'Nos', leadTime: '3 Days', reorderQty: '5,800', val: '58,000', status: 'Low Stock', coverage: '6 Days', level: 35 },
    { id: 9, name: 'Earthing Lug', sku: 'EL-01', category: 'Electrical', warehouse: 'Main Warehouse', stock: '220', percent: '37%', minLevel: '600', uom: 'Nos', leadTime: '6 Days', reorderQty: '380', val: '45,600', status: 'Low Stock', coverage: '7 Days', level: 37 },
    { id: 10, name: 'UV Cable Tie 300mm', sku: 'CT-300', category: 'Accessories', warehouse: 'Regional Warehouse', stock: '1,400', percent: '38%', minLevel: '3,600', uom: 'Nos', leadTime: '3 Days', reorderQty: '2,200', val: '26,400', status: 'Low Stock', coverage: '8 Days', level: 38 }
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
    { code: 'EC-001', item: 'End Clamp', category: 'Clamps', location: 'Regional Warehouse', stock: '2,400', allocated: '200', incoming: '-', minLevel: '1,000', val: '2,40,000', status: 'In Stock' },
    { code: 'NB-025', item: 'GI Nut Bolt M8 x 25', category: 'Fasteners', location: 'Main Warehouse', stock: '0', allocated: '0', incoming: '500', minLevel: '500', val: '1,51,000', status: 'Out of Stock' },
    { code: 'NB-030', item: 'GI Nut Bolt M10 x 30', category: 'Fasteners', location: 'Regional Warehouse', stock: '1,800', allocated: '150', incoming: '-', minLevel: '2,000', val: '1,68,000', status: 'Low Stock' },
    { code: 'WS-008', item: 'Spring Washer M8', category: 'Fasteners', location: 'Main Warehouse', stock: '950', allocated: '50', incoming: '-', minLevel: '500', val: '41,000', status: 'In Stock' },
    { code: 'LF-001', item: 'L-Foot', category: 'Accessories', location: 'Main Warehouse', stock: '160', allocated: '20', incoming: '-', minLevel: '200', val: '64,000', status: 'Low Stock' },
    { code: 'CC-001', item: 'Cable Clip', category: 'Accessories', location: 'Regional Warehouse', stock: '3,200', allocated: '100', incoming: '-', minLevel: '1,000', val: '58,000', status: 'In Stock' }
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
      {activeTab === 'Vendor Management' && (() => {
        // Calculate dynamic tab counts
        const countActive = vendorList.filter(v => v.status === 'Active').length;
        const countPreferred = vendorList.filter(v => v.status === 'Preferred').length;
        const countInactive = vendorList.filter(v => v.status === 'Inactive').length;
        const countBlacklisted = vendorList.filter(v => v.status === 'Blacklisted').length;

        // Apply filters
        const filteredVendors = vendorList.filter(vendor => {
          const query = vSearchQuery.toLowerCase();
          const matchesSearch = !query ||
            vendor.name.toLowerCase().includes(query) ||
            vendor.code.toLowerCase().includes(query) ||
            vendor.contact.toLowerCase().includes(query) ||
            vendor.phone.includes(query) ||
            vendor.cat.toLowerCase().includes(query);

          const matchesType = vTypeFilter === 'All' || vendor.type === vTypeFilter;
          const matchesStatus = vStatusFilter === 'All' || vendor.status === vStatusFilter;
          const matchesCat = vCatFilter === 'All' || vendor.cat === vCatFilter || vendor.cat === 'General Vendor' || !vendor.cat;

          let matchesRating = true;
          if (vRatingFilter !== 'All') {
            const num = parseFloat(vendor.rating);
            if (vRatingFilter === '4.0 & above') matchesRating = num >= 4.0;
            else if (vRatingFilter === '3.0 & above') matchesRating = num >= 3.0;
            else if (vRatingFilter === '2.0 & above') matchesRating = num >= 2.0;
          }

          const matchesTerms = vTermsFilter === 'All' || vendor.terms === vTermsFilter;

          let matchesTab = true;
          if (vActiveTab !== 'All Vendors') {
            matchesTab = vendor.status === vActiveTab;
          }

          return matchesSearch && matchesType && matchesStatus && matchesCat && matchesRating && matchesTerms && matchesTab;
        });

        // Pagination
        const totalVendorPages = Math.ceil(filteredVendors.length / vRowsPerPage) || 1;
        const currentVendorRows = filteredVendors.slice(
          (vCurrentPage - 1) * vRowsPerPage,
          vCurrentPage * vRowsPerPage
        );

        const handleSelectAllVendors = (e) => {
          if (e.target.checked) {
            const allCodes = currentVendorRows.map(v => v.code);
            setSelectedVendors(allCodes);
          } else {
            setSelectedVendors([]);
          }
        };

        const handleSelectVendorRow = (code) => {
          if (selectedVendors.includes(code)) {
            setSelectedVendors(selectedVendors.filter(item => item !== code));
          } else {
            setSelectedVendors([...selectedVendors, code]);
          }
        };

        const clearVendorFilters = () => {
          setVSearchQuery('');
          setVTypeFilter('All');
          setVStatusFilter('All');
          setVCatFilter('All');
          setVRatingFilter('All');
          setVTermsFilter('All');
          setVActiveTab('All Vendors');
          setVCurrentPage(1);
        };

        const renderStars = (rating) => {
          const fullStars = Math.floor(rating);
          const stars = [];
          for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
              stars.push(<span key={i} style={{ color: '#eab308', marginRight: '1px' }}>★</span>);
            } else {
              stars.push(<span key={i} style={{ color: '#cbd5e1', marginRight: '1px' }}>★</span>);
            }
          }
          return (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: '12px' }}>{stars}</div>
              <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px', fontWeight: 'bold' }}>{rating.toFixed(1)}</span>
            </div>
          );
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            {!viewingVendor && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Vendor Directory</h2>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Manage procurement suppliers and contact ledgers</span>
                </div>
                {showForm ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setVendorConfirmModal({
                        show: true,
                        action: 'draft',
                        title: 'Save Vendor as Draft?',
                        message: 'Are you sure you want to save this vendor information as a Draft?',
                        confirmLabel: 'Save Draft',
                        confirmBtnColor: '#475569'
                      })}
                      style={{ height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', padding: '0 16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Save as Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => setVendorConfirmModal({
                        show: true,
                        action: 'cancel',
                        title: 'Cancel Vendor Onboarding?',
                        message: 'Are you sure you want to cancel? Any entered vendor information will be cleared.',
                        confirmLabel: 'Discard Changes',
                        confirmBtnColor: '#EF4444'
                      })}
                      style={{ height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', padding: '0 16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Cancel
                    </button>
                    <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden' }}>
                      <button
                        type="button"
                        onClick={() => setVendorConfirmModal({
                          show: true,
                          action: 'submit',
                          title: 'Submit Vendor for Review?',
                          message: 'Are you sure you want to submit this vendor for onboarding approval & review?',
                          confirmLabel: 'Submit Vendor',
                          confirmBtnColor: '#2563eb'
                        })}
                        style={{ height: '36px', border: 'none', backgroundColor: '#2563eb', color: 'white', padding: '0 16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', borderRight: '1px solid rgba(255,255,255,0.2)' }}
                      >
                        Submit for Review
                      </button>
                      <button type="button" style={{ height: '36px', border: 'none', backgroundColor: '#2563eb', color: 'white', padding: '0 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                        ▼
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowForm(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', backgroundColor: '#2563eb', color: 'white', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                  >
                    <PlusCircle style={{ width: '16px', height: '16px' }} />
                    Onboard Vendor
                  </button>
                )}
              </div>
            )}

            {showForm ? (
              <form onSubmit={handleCreateVendor} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '24px', alignItems: 'start', width: '100%', boxSizing: 'border-box' }}>
                {/* Left Column (Forms) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* 1. Basic Information */}
                  <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>1. Basic Information</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                          Vendor Name <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input type="text" value={vName} onChange={(e) => setVName(e.target.value)} required placeholder="Enter vendor name" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                          Vendor Type <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        {renderSelect(vType, (e) => setVType(e.target.value), ['Manufacturer', 'Supplier', 'Trader'], { height: '38px' })}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Vendor Code (Auto Generated)</label>
                        <input type="text" readOnly value="Will be generated" style={{ height: '38px', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '0 12px', fontSize: '13px', backgroundColor: '#f8fafc', color: '#94a3b8', outline: 'none' }} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                          Company Registration Number <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input type="text" value={vCompanyReg} onChange={(e) => setVCompanyReg(e.target.value)} placeholder="Enter registration number" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                            GST Number <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleGstFetch(vGST)}
                            disabled={isGstFetching || !vGST || vGST.trim().length < 2}
                            style={{ border: 'none', background: 'none', color: (isGstFetching || !vGST || vGST.trim().length < 2) ? '#94a3b8' : '#2563eb', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
                          >
                            {isGstFetching ? '⏳ Fetching GST...' : '🔍 Auto-Fetch Details'}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={vGST}
                          onChange={(e) => {
                            const target = e.target;
                            const start = target.selectionStart;
                            const end = target.selectionEnd;
                            const val = target.value.toUpperCase();
                            setVGST(val);
                            requestAnimationFrame(() => {
                              if (target && target.setSelectionRange) {
                                target.setSelectionRange(start, end);
                              }
                            });
                            if (val.replace(/[^A-Z0-9]/gi, '').length >= 10) {
                              handleGstFetch(val);
                            }
                          }}
                          maxLength={15}
                          placeholder="Enter 15-digit GSTIN (e.g. 37AAACT2727Q1ZS)"
                          style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px' }}
                        />
                        {gstLookupStatus && (
                          <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 'bold' }}>{gstLookupStatus.msg}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                          PAN Number <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input type="text" value={vPAN} onChange={(e) => setVPAN(e.target.value)} placeholder="Enter PAN number" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none' }} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Website</label>
                        <input type="text" value={vWebsite} onChange={(e) => setVWebsite(e.target.value)} placeholder="Enter website" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                          Email <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input type="email" value={vEmail} onChange={(e) => setVEmail(e.target.value)} placeholder="Enter email address" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                          Mobile Number <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select style={{ width: '80px', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '13px', backgroundColor: 'white', color: '#334155', outline: 'none' }}>
                            <option>+91</option>
                            <option>+1</option>
                            <option>option</option>
                          </select>
                          <input type="text" value={vPhone} onChange={(e) => setVPhone(e.target.value)} placeholder="Enter mobile number" style={{ flex: 1, height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none' }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Address Details */}
                  <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>2. Address Details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                      {/* Registered Address */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <strong style={{ fontSize: '12px', color: '#334155' }}>
                          Registered Address <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <textarea value={vRegAddress} onChange={(e) => setVRegAddress(e.target.value)} placeholder="Enter registered address" style={{ height: '70px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px', outline: 'none', resize: 'none' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                              City <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                            </label>
                            <input type="text" value={vCity} onChange={(e) => setVCity(e.target.value)} placeholder="Enter city" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none' }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                              State <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                            </label>
                            {renderSelect(vState, (e) => setVState(e.target.value), ['Andhra Pradesh', 'Telangana', 'Tamil Nadu', 'Karnataka', 'Maharashtra'], { height: '38px' })}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                              Country <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                            </label>
                            {renderSelect(vCountry, (e) => setVCountry(e.target.value), ['India', 'United States', 'Singapore'], { height: '38px' })}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                              PIN Code <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                            </label>
                            <input type="text" value={vPinCode} onChange={(e) => setVPinCode(e.target.value)} placeholder="Enter PIN code" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none' }} />
                          </div>
                        </div>
                      </div>

                      {/* Billing Address */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '12px', color: '#334155' }}>
                            Billing Address (If Different) <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                          </strong>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569', cursor: 'pointer' }}>
                            <input type="checkbox" checked={vSameAsRegistered} onChange={(e) => {
                              setVSameAsRegistered(e.target.checked);
                              if (e.target.checked) {
                                setVBillingAddress(vRegAddress);
                                setVBillingCity(vCity);
                                setVBillingState(vState);
                                setVBillingCountry(vCountry);
                                setVBillingPinCode(vPinCode);
                              }
                            }} style={{ cursor: 'pointer' }} />
                            Same as Registered Address
                          </label>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <textarea disabled={vSameAsRegistered} value={vSameAsRegistered ? vRegAddress : vBillingAddress} onChange={(e) => setVBillingAddress(e.target.value)} placeholder="Enter billing address" style={{ height: '70px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px', outline: 'none', resize: 'none', backgroundColor: vSameAsRegistered ? '#f8fafc' : 'white', color: vSameAsRegistered ? '#64748b' : '#334155' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                              City <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                            </label>
                            <input disabled={vSameAsRegistered} type="text" value={vSameAsRegistered ? vCity : vBillingCity} onChange={(e) => setVBillingCity(e.target.value)} placeholder="Enter city" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none', backgroundColor: vSameAsRegistered ? '#f8fafc' : 'white' }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                              State <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                            </label>
                            {renderSelect(vSameAsRegistered ? vState : vBillingState, (e) => setVBillingState(e.target.value), ['Andhra Pradesh', 'Telangana', 'Tamil Nadu', 'Karnataka', 'Maharashtra'], { height: '38px', backgroundColor: vSameAsRegistered ? '#f8fafc' : 'white', disabled: vSameAsRegistered })}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                              Country <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                            </label>
                            {renderSelect(vSameAsRegistered ? vCountry : vBillingCountry, (e) => setVBillingCountry(e.target.value), ['India', 'United States', 'Singapore'], { height: '38px', backgroundColor: vSameAsRegistered ? '#f8fafc' : 'white', disabled: vSameAsRegistered })}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                              PIN Code <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                            </label>
                            <input disabled={vSameAsRegistered} type="text" value={vSameAsRegistered ? vPinCode : vBillingPinCode} onChange={(e) => setVBillingPinCode(e.target.value)} placeholder="Enter PIN code" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none', backgroundColor: vSameAsRegistered ? '#f8fafc' : 'white' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Contact Details */}
                  <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>3. Contact Details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                          Primary Contact Person <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input type="text" value={vContact} onChange={(e) => setVContact(e.target.value)} placeholder="Enter contact person" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Designation</label>
                        <input type="text" value={vDesignation} onChange={(e) => setVDesignation(e.target.value)} placeholder="Enter designation" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                          Phone <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input type="text" value={vPhone} onChange={(e) => setVPhone(e.target.value)} placeholder="Enter phone number" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none' }} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                          Email <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input type="email" value={vEmail} onChange={(e) => setVEmail(e.target.value)} placeholder="Enter email address" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Alternate Phone</label>
                        <input type="text" value={vAltPhone} onChange={(e) => setVAltPhone(e.target.value)} placeholder="Enter alternate phone" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Preferred Communication</label>
                        {renderSelect(vPrefComm, (e) => setVPrefComm(e.target.value), ['Email', 'Phone', 'WhatsApp', 'SMS'], { height: '38px' })}
                      </div>
                    </div>
                  </div>

                  {/* 4. Other Details */}
                  <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>4. Other Details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                          Payment Terms <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        {renderSelect(vPaymentTerms, (e) => setVPaymentTerms(e.target.value), ['Net 15 Days', 'Net 30 Days', 'Net 45 Days', 'Net 60 Days'], { height: '38px' })}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                          Currency <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        {renderSelect(vCurrency, (e) => setVCurrency(e.target.value), ['INR - Indian Rupee', 'USD - US Dollar', 'EUR - Euro'], { height: '38px' })}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                          Vendor Category <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        {renderSelect(vCat, (e) => setVCat(e.target.value), ['Steel & Metals', 'Aluminium', 'Electrical', 'Fasteners', 'Packaging', 'Raw Materials', 'Components'], { height: '38px' })}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: 'span 3' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Notes</label>
                        <input type="text" value={vTags} onChange={(e) => setVTags(e.target.value)} placeholder="Enter any additional notes" style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', outline: 'none' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column (Sidebar cards) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* 5. Documents */}
                  <div className="section-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>5. Documents</h3>
                    <div style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center', backgroundColor: '#fafbfc' }}>
                      <UploadCloud style={{ width: '28px', height: '28px', color: '#2563eb' }} />
                      <span style={{ fontSize: '12px', color: '#475569', fontWeight: '500' }}>Drag and drop files here or</span>
                      <button type="button" style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Browse Files</button>
                      <span style={{ fontSize: '9px', color: '#94a3b8', lineHeight: '1.4' }}>Supported formats: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG (Max 10MB)</span>
                    </div>
                  </div>

                  {/* 6. Compliance & Settings */}
                  <div className="section-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>6. Compliance & Settings</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                        <input type="checkbox" checked={vActiveVendor} onChange={(e) => setVActiveVendor(e.target.checked)} style={{ cursor: 'pointer' }} />
                        Active Vendor
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                        <input type="checkbox" checked={vPreferredVendor} onChange={(e) => setVPreferredVendor(e.target.checked)} style={{ cursor: 'pointer' }} />
                        Preferred Vendor
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                        <input type="checkbox" checked={vBlacklistedVendor} onChange={(e) => setVBlacklistedVendor(e.target.checked)} style={{ cursor: 'pointer' }} />
                        Blacklisted Vendor
                      </label>
                    </div>
                  </div>

                  {/* 7. Tags */}
                  <div className="section-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>7. Tags</h3>
                    <select style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '13px', backgroundColor: 'white', color: '#334155', outline: 'none' }}>
                      <option>Select or type to add tags</option>
                      <option>Reliable</option>
                      <option>Fast Delivery</option>
                      <option>Bulk Supplier</option>
                    </select>
                  </div>

                  {/* 8. Notes (Internal) */}
                  <div className="section-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>8. Notes (Internal)</h3>
                    <textarea value={vInternalNotes} onChange={(e) => setVInternalNotes(e.target.value)} placeholder="Add internal notes about this vendor" style={{ width: '100%', height: '90px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '13px', outline: 'none', resize: 'none' }} />
                    <span style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'right' }}>{vInternalNotes.length} / 500</span>
                  </div>

                  {/* 9. Quick Summary */}
                  <div className="section-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#fafbfc' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#2563eb', margin: 0 }}>9. Quick Summary</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Vendor Type</span>
                        <strong style={{ color: '#334155' }}>{vType === 'Select vendor type' ? '--' : vType}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#64748b' }}>Status</span>
                        <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', backgroundColor: vBlacklistedVendor ? '#fee2e2' : '#dcfce7', color: vBlacklistedVendor ? '#991b1b' : '#166534' }}>
                          {vBlacklistedVendor ? 'Blacklisted' : vActiveVendor ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Created By</span>
                        <strong style={{ color: '#334155' }}>Arun</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Created Date</span>
                        <strong style={{ color: '#334155' }}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            ) : viewingVendor ? (
              /* Vendor Management View Mode: Full-Page Detail */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                {/* Header Action Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '16px 24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0 }}>{viewingVendor.companyName || viewingVendor.name}</h2>
                        {renderStatusBadge(viewingVendor.status)}
                      </div>
                      <span style={{ fontSize: '12px', color: '#64748B', display: 'block', marginTop: '2px' }}>
                        Zoho Contact ID: <strong style={{ color: '#2563EB' }}>{viewingVendor.code || viewingVendor.id}</strong> | Currency: <strong>{viewingVendor.currency || 'INR'}</strong>
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => setViewingVendor(null)}
                      style={{ border: 'none', backgroundColor: '#2563EB', color: 'white', fontWeight: 'bold', padding: '8px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
                    >
                      Close View
                    </button>
                  </div>
                </div>

                {vendorModalLoading ? (
                  <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '60px 0', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <span style={{ fontSize: '14px', color: '#2563EB', fontWeight: '600' }}>Fetching live contact details & addresses from Zoho Books…</span>
                  </div>
                ) : (
                  <>
                    {/* Top Key Metrics Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                      <div className="section-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '4px solid #DC2626' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Outstanding Payable</span>
                        <strong style={{ fontSize: '20px', color: '#DC2626', fontWeight: '800' }}>{viewingVendor.payable || viewingVendor.spend || '₹0.00'}</strong>
                      </div>
                      <div className="section-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '4px solid #16A34A' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Unused Credits</span>
                        <strong style={{ fontSize: '20px', color: '#16A34A', fontWeight: '800' }}>{viewingVendor.unusedCredits || '₹0.00'}</strong>
                      </div>
                      <div className="section-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '4px solid #2563EB' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Payment Terms</span>
                        <strong style={{ fontSize: '18px', color: '#1E293B', fontWeight: '700' }}>{viewingVendor.terms || 'Net 30 Days'}</strong>
                      </div>
                      <div className="section-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '4px solid #9333EA' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>GSTIN / Tax ID</span>
                        <strong style={{ fontSize: '16px', color: '#1E293B', fontWeight: '700' }}>{viewingVendor.gstin || viewingVendor.gstTreatment || '—'}</strong>
                      </div>
                    </div>

                    {/* Section 1: Overview & Primary Contact Info */}
                    <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E3A8A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>1. General & Contact Profile</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px 20px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Vendor Legal Name</span>
                          <strong style={{ fontSize: '14px', color: '#1E293B' }}>{viewingVendor.companyName || viewingVendor.name}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Primary Contact Person</span>
                          <strong style={{ fontSize: '14px', color: '#1E293B' }}>{viewingVendor.contact || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Vendor Type</span>
                          <strong style={{ fontSize: '14px', color: '#1E293B' }}>{viewingVendor.type || 'Supplier'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Email Address</span>
                          <strong style={{ fontSize: '14px', color: '#2563EB' }}>{viewingVendor.email || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Phone Number</span>
                          <strong style={{ fontSize: '14px', color: '#1E293B' }}>{viewingVendor.phone || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Mobile Phone</span>
                          <strong style={{ fontSize: '14px', color: '#1E293B' }}>{viewingVendor.mobile || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Website</span>
                          <strong style={{ fontSize: '14px', color: '#2563EB' }}>{viewingVendor.website || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>PAN Number</span>
                          <strong style={{ fontSize: '14px', color: '#1E293B' }}>{viewingVendor.pan || '—'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Addresses (Billing & Shipping) */}
                    <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E3A8A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>Address</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <strong style={{ fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Billing Address</strong>
                          {(() => {
                            const b = viewingVendor.billingAddressObj || {};
                            const street = b.address || b.street || b.address_1;
                            const street2 = b.street2 || b.address_2;
                            const cityStatePin = [b.city, b.state || b.province, b.zip || b.zipcode || b.postal_code || b.pincode].filter(Boolean).join(', ');
                            const hasStructured = street || street2 || cityStatePin || b.country;

                            if (hasStructured) {
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
                                  {b.attention && <div><strong>Attention:</strong> {b.attention}</div>}
                                  {street && <div>{street}</div>}
                                  {street2 && <div>{street2}</div>}
                                  {cityStatePin && <div>{cityStatePin}</div>}
                                  {b.country && <div>{b.country || b.country_name}</div>}
                                  {b.phone && <div style={{ marginTop: '4px', color: '#64748B', fontSize: '12px' }}>Phone: {b.phone}</div>}
                                </div>
                              );
                            }
                            return <span style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6' }}>{viewingVendor.billingAddress && viewingVendor.billingAddress !== '—' ? viewingVendor.billingAddress : '—'}</span>;
                          })()}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <strong style={{ fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Shipping Address</strong>
                          {(() => {
                            const s = viewingVendor.shippingAddressObj || {};
                            const street = s.address || s.street || s.address_1;
                            const street2 = s.street2 || s.address_2;
                            const cityStatePin = [s.city, s.state || s.province, s.zip || s.zipcode || s.postal_code || s.pincode].filter(Boolean).join(', ');
                            const hasStructured = street || street2 || cityStatePin || s.country;

                            if (hasStructured) {
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
                                  {s.attention && <div><strong>Attention:</strong> {s.attention}</div>}
                                  {street && <div>{street}</div>}
                                  {street2 && <div>{street2}</div>}
                                  {cityStatePin && <div>{cityStatePin}</div>}
                                  {s.country && <div>{s.country || s.country_name}</div>}
                                  {s.phone && <div style={{ marginTop: '4px', color: '#64748B', fontSize: '12px' }}>Phone: {s.phone}</div>}
                                </div>
                              );
                            }
                            return <span style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6' }}>{viewingVendor.shippingAddress && viewingVendor.shippingAddress !== '—' ? viewingVendor.shippingAddress : '—'}</span>;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Other Details (Tax & GST Information from Zoho) */}
                    <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E3A8A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>Other Details</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px 20px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Default Currency</span>
                          <strong style={{ fontSize: '14px', color: '#1E293B' }}>{viewingVendor.currency || 'INR'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>GST Treatment</span>
                          <strong style={{ fontSize: '13px', color: '#1E293B', backgroundColor: '#F1F5F9', padding: '2px 8px', borderRadius: '4px', display: 'inline-block' }}>
                            {viewingVendor.gstTreatment && viewingVendor.gstTreatment !== '—' ? viewingVendor.gstTreatment : 'Registered Business - Regular'}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>GSTIN</span>
                          <strong style={{ fontSize: '14px', color: '#1E293B', letterSpacing: '0.5px' }}>{viewingVendor.gstin || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>Source of Supply</span>
                          <strong style={{ fontSize: '14px', color: '#1E293B' }}>{viewingVendor.sourceOfSupply || '—'}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '2px' }}>PAN</span>
                          <strong style={{ fontSize: '14px', color: '#1E293B', letterSpacing: '0.5px' }}>{viewingVendor.pan || '—'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Associated Contact Persons */}
                    {Array.isArray(viewingVendor.contactPersons) && viewingVendor.contactPersons.length > 0 && (
                      <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E3A8A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                          Associated Contact Persons ({viewingVendor.contactPersons.length})
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                          {viewingVendor.contactPersons.map((cp, cIdx) => (
                            <div key={cIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: '#F8FAFC', padding: '12px 16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                              <strong style={{ fontSize: '13px', color: '#0F172A' }}>{cp.name || 'Contact Person'}</strong>
                              {cp.designation && cp.designation !== '—' && <span style={{ fontSize: '11px', color: '#64748B' }}>{cp.designation}</span>}
                              <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                <span>📧 {cp.email || '—'}</span>
                                <span>📞 {cp.phone || '—'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <>
                {/* 1. FILTERS & SEARCH ROW CARD */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '12px 16px', backgroundColor: '#fafbfc', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center', width: '100%', boxSizing: 'border-box', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#f8fafc', width: '380px' }}>
                    <Search style={{ width: '15px', height: '15px', color: '#64748b' }} />
                    <input
                      type="text"
                      placeholder="Search vendors (Vendor Name, Contact Person, Mobile, Email)..."
                      value={vSearchQuery}
                      onChange={(e) => { setVSearchQuery(e.target.value); setVCurrentPage(1); }}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0 }}>
                    <select
                      value={vStatusFilter}
                      onChange={(e) => { setVStatusFilter(e.target.value); setVCurrentPage(1); }}
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155', outline: 'none' }}
                    >
                      <option value="All">Status: All</option>
                      <option value="Active">Active</option>
                      <option value="Preferred">Preferred</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Blacklisted">Blacklisted</option>
                    </select>

                    <button
                      onClick={clearVendorFilters}
                      title="Clear Filters"
                      style={{
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        color: '#475569',
                        cursor: 'pointer',
                        padding: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '8px',
                        height: '38px',
                        width: '38px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <RotateCcw style={{ width: '15px', height: '15px' }} />
                    </button>
                  </div>
                </div>

                {/* 2. STATUS TABS ROW */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '20px', padding: '4px 0', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {[
                    { id: 'All Vendors', label: 'All Vendors', count: vendorList.length, bg: '#e2e8f0', fg: '#475569' },
                    { id: 'Active', label: 'Active', count: countActive, bg: '#dcfce7', fg: '#166534' },
                    { id: 'Preferred', label: 'Preferred', count: countPreferred, bg: '#ffedd5', fg: '#c2410c' },
                    { id: 'Inactive', label: 'Inactive', count: countInactive, bg: '#f1f5f9', fg: '#475569' },
                    { id: 'Blacklisted', label: 'Blacklisted', count: countBlacklisted, bg: '#fee2e2', fg: '#991b1b' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setVActiveTab(tab.id); setVCurrentPage(1); }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: '10px 4px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        color: vActiveTab === tab.id ? '#2563eb' : '#64748b',
                        borderBottom: vActiveTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>{tab.label}</span>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', backgroundColor: tab.bg, color: tab.fg, padding: '1px 6px', borderRadius: '10px' }}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* 3. TABLE CARD */}
                <div className="section-card" style={{ padding: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px' }}>
                  <table className="custom-table" style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#fafbfc', borderBottom: '1px solid #e2e8f0', height: '48px' }}>
                        <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '12px 0', textAlign: 'center', boxSizing: 'border-box' }}>
                          <input
                            type="checkbox"
                            onChange={handleSelectAllVendors}
                            checked={currentVendorRows.length > 0 && currentVendorRows.every(row => selectedVendors.includes(row.code))}
                            style={{ cursor: 'pointer', accentColor: '#0E7490' }}
                          />
                        </th>
                        <th style={{ minWidth: '220px', padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 'bold', boxSizing: 'border-box' }}>Company Name</th>
                        <th style={{ width: '180px', minWidth: '180px', padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 'bold', boxSizing: 'border-box' }}>Contact Person</th>
                        <th style={{ width: '220px', minWidth: '220px', padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 'bold', boxSizing: 'border-box' }}>Mobile / Email</th>
                        <th style={{ width: '130px', minWidth: '130px', padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 'bold', boxSizing: 'border-box' }}>Status</th>
                        <th style={{ width: '150px', minWidth: '150px', padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 'bold', boxSizing: 'border-box' }}>Payment Terms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorLoading ? (
                        Array.from({ length: 6 }).map((_, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 0', textAlign: 'center', width: '48px' }}>
                              <input type="checkbox" defaultChecked={false} disabled />
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div className="skeleton-shimmer skeleton-text" style={{ width: '70%', height: '13px' }} />
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div className="skeleton-shimmer skeleton-text" style={{ width: '110px', height: '13px' }} />
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div className="skeleton-shimmer skeleton-text" style={{ width: '130px', height: '13px' }} />
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div className="skeleton-shimmer" style={{ width: '75px', height: '22px', borderRadius: '12px' }} />
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div className="skeleton-shimmer skeleton-text" style={{ width: '90px', height: '13px' }} />
                            </td>
                          </tr>
                        ))
                      ) : currentVendorRows.length > 0 ? (
                        currentVendorRows.map((vendor, idx) => {
                          const isChecked = selectedVendors.includes(vendor.code);
                          let statusBg = '#f1f5f9';
                          let statusColor = '#475569';
                          if (vendor.status === 'Active') {
                            statusBg = '#dcfce7';
                            statusColor = '#166534';
                          } else if (vendor.status === 'Preferred') {
                            statusBg = '#ffedd5';
                            statusColor = '#c2410c';
                          } else if (vendor.status === 'Blacklisted') {
                            statusBg = '#fee2e2';
                            statusColor = '#991b1b';
                          }

                          return (
                            <tr
                              key={vendor.code}
                              style={{
                                borderBottom: idx === currentVendorRows.length - 1 ? 'none' : '1px solid #f1f5f9',
                                backgroundColor: isChecked ? '#f8fafc' : 'transparent',
                                transition: 'background-color 0.2s'
                              }}
                            >
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleSelectVendorRow(vendor.code)}
                                  style={{ cursor: 'pointer' }}
                                />
                              </td>
                              <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e293b' }}>{vendor.name}</td>
                              <td style={{ padding: '12px 16px', color: '#475569' }}>{vendor.contact}</td>
                              <td style={{ padding: '12px 16px', color: '#475569' }}>{vendor.phone}</td>
                              <td style={{ padding: '12px 16px' }}>
                                {renderStatusBadge(vendor.status)}
                              </td>
                              <td style={{ padding: '12px 16px', color: '#475569' }}>{vendor.terms}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                            No vendors match the active filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* 4. PAGINATION FOOTER */}
                  {totalVendorPages > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', fontSize: '13px', color: '#64748b', borderTop: '1px solid #f1f5f9' }}>
                      <span>
                        Showing {(vCurrentPage - 1) * vRowsPerPage + 1} to {Math.min(vCurrentPage * vRowsPerPage, filteredVendors.length)} of {filteredVendors.length} entries
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '13px', color: '#64748b' }}>Rows per page:</span>
                          {renderSelect(vRowsPerPage, (e) => { setVRowsPerPage(parseInt(e.target.value)); setVCurrentPage(1); }, [5, 10, 15, 20, 25, 50], { height: '32px', width: '70px' })}
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            disabled={vCurrentPage === 1}
                            onClick={() => setVCurrentPage(prev => Math.max(prev - 1, 1))}
                            style={{ border: '1px solid #cbd5e1', background: vCurrentPage === 1 ? '#f1f5f9' : 'white', cursor: vCurrentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                          >
                            <ChevronLeft style={{ width: '14px', height: '14px' }} />
                          </button>

                          {(() => {
                            let start = Math.max(1, vCurrentPage - 1);
                            let end = start + 3;
                            if (end > totalVendorPages) {
                              end = totalVendorPages;
                              start = Math.max(1, end - 3);
                            }
                            return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(page => (
                              <button
                                key={page}
                                onClick={() => setVCurrentPage(page)}
                                style={{
                                  border: '1px solid #cbd5e1',
                                  background: page === vCurrentPage ? '#2563eb' : 'white',
                                  color: page === vCurrentPage ? 'white' : '#475569',
                                  cursor: 'pointer',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontWeight: page === vCurrentPage ? 'bold' : 'normal'
                                }}
                              >
                                {page}
                              </button>
                            ));
                          })()}

                          <button
                            disabled={vCurrentPage === totalVendorPages}
                            onClick={() => setVCurrentPage(prev => Math.min(prev + 1, totalVendorPages))}
                            style={{ border: '1px solid #cbd5e1', background: vCurrentPage === totalVendorPages ? '#f1f5f9' : 'white', cursor: vCurrentPage === totalVendorPages ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                          >
                            <ChevronRight style={{ width: '14px', height: '14px' }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Floating Selection Toolbar for Vendor Management (Single line, direct action buttons, no 3-dot menu) */}
            {selectedVendors.length > 0 && (
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
                  <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedVendors.length}</strong> Selected
                </span>

                {/* View Details */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (selectedVendors && selectedVendors.length > 1) {
                      alert("You can't open details for multiple files at once. Please select a single item to view details.");
                      return;
                    }
                    const codeVal = (selectedVendors && selectedVendors.length > 0) ? selectedVendors[0] : null;
                    const targetRow = codeVal
                      ? ((vendorList || []).find(r => r.code === codeVal || r.id === codeVal) || { code: codeVal, name: `Record #${codeVal}` })
                      : (vendorList && vendorList[0] ? vendorList[0] : { code: 'VEND-001', name: 'Sample Vendor' });
                    setQuickPreviewRecord(targetRow);
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

                {/* Edit Info */}
                <button
                  onClick={() => {
                    if (selectedVendors.length > 1) {
                      alert('You cannot edit multiple items at once.');
                    } else if (selectedVendors.length === 1) {
                      const codeVal = selectedVendors[0];
                      const targetRow = (vendorList || []).find(r => r.code === codeVal || r.id === codeVal) || { code: codeVal };
                      setEditingVendor(targetRow);
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
                  <Edit3 size={14} style={{ color: '#64748B' }} /> Edit Info
                </button>

                {/* Clone / Duplicate */}
                <button
                  onClick={() => {
                    if (selectedVendors.length === 1) {
                      alert(`Cloned #${selectedVendors[0]} as a new duplicate draft.`);
                    } else {
                      alert(`Cloned ${selectedVendors.length} selected items.`);
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
                  <Copy size={14} style={{ color: '#2563EB' }} /> Clone / Duplicate
                </button>

                {/* Export / Print PDF */}
                <button
                  onClick={() => {
                    window.print();
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
                  <Download size={14} style={{ color: '#059669' }} /> Export / Print PDF
                </button>

                {/* Delete */}
                <button
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete ${selectedVendors.length} selected vendor(s)?`)) {
                      setVendorList(prev => prev.filter(v => !selectedVendors.includes(v.code) && !selectedVendors.includes(v.id)));
                      setSelectedVendors([]);
                      setSelectedRows([]);
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
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                >
                  <Trash2 size={14} style={{ color: '#DC2626' }} /> Delete
                </button>

                {/* Deselect All */}
                <button
                  onClick={() => {
                    setSelectedVendors([]);
                    setSelectedRows([]);
                    setShowFloatingMoreMenu(false);
                  }}
                  title="Deselect all"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#0F172A'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Edit Vendor Modal */}
            {editingVendor && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '450px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0F172A' }}>Edit Vendor Profile</h3>
                    <button onClick={() => setEditingVendor(null)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Vendor Name</label>
                      <input
                        type="text"
                        value={editingVendor.name}
                        onChange={(e) => setEditingVendor({ ...editingVendor, name: e.target.value })}
                        style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Primary Contact</label>
                      <input
                        type="text"
                        value={editingVendor.contact}
                        onChange={(e) => setEditingVendor({ ...editingVendor, contact: e.target.value })}
                        style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Phone Number</label>
                      <input
                        type="text"
                        value={editingVendor.phone}
                        onChange={(e) => setEditingVendor({ ...editingVendor, phone: e.target.value })}
                        style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>GST Number</label>
                      <input
                        type="text"
                        value={editingVendor.gst || ''}
                        onChange={(e) => {
                          const target = e.target;
                          const start = target.selectionStart;
                          const end = target.selectionEnd;
                          const val = target.value.toUpperCase();
                          setEditingVendor({ ...editingVendor, gst: val });
                          requestAnimationFrame(() => {
                            if (target && target.setSelectionRange) {
                              target.setSelectionRange(start, end);
                            }
                          });
                        }}
                        maxLength={15}
                        placeholder="15-digit GSTIN"
                        style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', textTransform: 'uppercase' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Payment Terms</label>
                      <input
                        type="text"
                        value={editingVendor.terms}
                        onChange={(e) => setEditingVendor({ ...editingVendor, terms: e.target.value })}
                        style={{ height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      onClick={() => setEditingVendor(null)}
                      style={{ border: '1px solid #cbd5e1', background: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setVendorList(prev => prev.map(v => v.code === editingVendor.code ? editingVendor : v));
                        setEditingVendor(null);
                      }}
                      style={{ border: 'none', background: '#2563eb', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmVendor && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#0F172A' }}>Delete Vendor</h3>
                  <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>
                    Are you sure you want to delete vendor <strong>{deleteConfirmVendor.name}</strong> ({deleteConfirmVendor.code})? This action cannot be undone.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      onClick={() => setDeleteConfirmVendor(null)}
                      style={{ border: '1px solid #cbd5e1', background: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const targetId = deleteConfirmVendor.id || deleteConfirmVendor.code || deleteConfirmVendor.name;
                        setVendorList(prev => prev.filter(v => v.code !== deleteConfirmVendor.code && v.id !== deleteConfirmVendor.id));
                        setDeleteConfirmVendor(null);

                        if (targetId) {
                          fetch(`/api/zoho/vendors/${encodeURIComponent(targetId)}`, { method: 'DELETE' })
                            .then(res => res.json())
                            .then(data => {
                              console.log('Vendor deleted from Zoho & Control Room:', data);
                              fetchVendors();
                            })
                            .catch(err => console.error('Failed to delete vendor in backend:', err));
                        }
                      }}
                      style={{ border: 'none', background: '#EF4444', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Confirmation Modal matching standard Control Room popups */}
            {vendorConfirmModal.show && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#0F172A' }}>{vendorConfirmModal.title}</h3>
                  <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#475569', lineHeight: '1.5' }}>
                    {vendorConfirmModal.message}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setVendorConfirmModal({ ...vendorConfirmModal, show: false })}
                      style={{ border: '1px solid #cbd5e1', background: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const act = vendorConfirmModal.action;
                        setVendorConfirmModal({ ...vendorConfirmModal, show: false });
                        if (act === 'cancel') {
                          setShowForm(false);
                        } else if (act === 'draft' || act === 'submit') {
                          handleCreateVendor();
                        }
                      }}
                      style={{ border: 'none', background: vendorConfirmModal.confirmBtnColor || '#2563eb', color: 'white', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                    >
                      {vendorConfirmModal.confirmLabel}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ==================== 3. QUOTATIONS SCREEN ==================== */}
    </div>
  );
}
