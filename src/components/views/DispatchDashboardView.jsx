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


export default function DispatchDashboardView(props) {
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



  useEffect(() => {
    const syncBoms = async () => {
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

        if (data && Array.isArray(data) && data.length > 0) {
          setBomStore(data.map(stripDataUrlsFromRecord));
        }
      } catch (err) {
        console.error('Error syncing BOMs in DispatchDashboardView:', err);
      }
    };

    syncBoms();
    const pollInterval = setInterval(syncBoms, 5000);

    const handleBomUpdate = (e) => {
      if (e?.detail?.bom) {
        const item = stripDataUrlsFromRecord(e.detail.bom);
        setBomStore(prev => {
          const map = new Map();
          (prev || []).forEach(b => b && map.set(b.bomCode || b.code || b.id, b));
          map.set(item.bomCode || item.code || item.id, item);
          return Array.from(map.values());
        });
      } else {
        syncBoms();
      }
    };

    window.addEventListener('controlroom_bom_store_updated', handleBomUpdate);
    window.addEventListener('controlroom_storage_update', handleBomUpdate);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('controlroom_bom_store_updated', handleBomUpdate);
      window.removeEventListener('controlroom_storage_update', handleBomUpdate);
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
  const INITIAL_INVOICES = [];

  const [invoiceList, setInvoiceList] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_invoice_store');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing stored invoice list', e);
    }
    return INITIAL_INVOICES;
  });



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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {(activeTab === 'Dispatch Dashboard' || (userRole === 'Dispatch Head' && activeTab === 'Dashboard')) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', boxSizing: 'border-box' }}>

          {/* Top 7 KPI Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px', width: '100%' }}>

            {/* KPI 1 */}
            <div className="section-card" style={{ padding: '14px', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#15803D', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={16} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', letterSpacing: '0.4px', textTransform: 'uppercase' }}>TOTAL ORDERS READY</span>
              </div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#0F172A', lineHeight: '1' }}>64</div>
              <div style={{ fontSize: '10px', color: '#64748B' }}>This Month</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '700', color: '#16A34A' }}>
                <TrendingUp size={12} /> 15.9% vs Last Month
              </div>
            </div>

            {/* KPI 2 */}
            <div className="section-card" style={{ padding: '14px', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0284C7', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={16} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', letterSpacing: '0.4px', textTransform: 'uppercase' }}>DISPATCHED TODAY</span>
              </div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#0F172A', lineHeight: '1' }}>28</div>
              <div style={{ fontSize: '10px', color: '#64748B' }}>Till 09:30 AM</div>
              <div style={{ fontSize: '10px', color: '#94A3B8' }}>--</div>
            </div>

            {/* KPI 3 */}
            <div className="section-card" style={{ padding: '14px', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#6B21A8', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={16} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', letterSpacing: '0.4px', textTransform: 'uppercase' }}>DISPATCHED (MTD)</span>
              </div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#0F172A', lineHeight: '1' }}>352</div>
              <div style={{ fontSize: '10px', color: '#64748B' }}>This Month</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '700', color: '#16A34A' }}>
                <TrendingUp size={12} /> 12.6% vs Last Month
              </div>
            </div>

            {/* KPI 4 */}
            <div className="section-card" style={{ padding: '14px', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0D9488', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={16} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', letterSpacing: '0.4px', textTransform: 'uppercase' }}>ON TIME DISPATCH %</span>
              </div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#0F172A', lineHeight: '1' }}>96.4%</div>
              <div style={{ fontSize: '10px', color: '#64748B' }}>This Month</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '700', color: '#16A34A' }}>
                <TrendingUp size={12} /> 4.2% vs Last Month
              </div>
            </div>

            {/* KPI 5 */}
            <div className="section-card" style={{ padding: '14px', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#EA580C', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={16} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', letterSpacing: '0.4px', textTransform: 'uppercase' }}>DISPATCH PENDING</span>
              </div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#0F172A', lineHeight: '1' }}>14</div>
              <div style={{ fontSize: '10px', color: '#64748B' }}>This Month</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '700', color: '#DC2626' }}>
                <TrendingDown size={12} /> 2 vs Last Month
              </div>
            </div>

            {/* KPI 6 */}
            <div className="section-card" style={{ padding: '14px', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0E7490', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={16} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', letterSpacing: '0.4px', textTransform: 'uppercase' }}>INVOICES PENDING</span>
              </div>
              <div style={{ fontSize: '22px', fontWeight: '900', color: '#0F172A', lineHeight: '1' }}>11</div>
              <div style={{ fontSize: '10px', color: '#64748B' }}>This Month</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '700', color: '#DC2626' }}>
                <TrendingDown size={12} /> 3 vs Last Month
              </div>
            </div>

            {/* KPI 7 */}
            <div className="section-card" style={{ padding: '14px', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#A21CAF', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IndianRupee size={16} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', letterSpacing: '0.4px', textTransform: 'uppercase' }}>DISPATCH VALUE (MTD)</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A', lineHeight: '1' }}>₹ 3.26 Cr</div>
              <div style={{ fontSize: '10px', color: '#64748B' }}>This Month</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: '700', color: '#16A34A' }}>
                <TrendingUp size={12} /> 14.8% vs Last Month
              </div>
            </div>

          </div>

          {/* ROW 1: Dispatch Status | Daily Trend | Top 5 Delayed */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '16px', width: '100%' }}>

            {/* Card 1: Dispatch Status (This Month) */}
            <div className="section-card" style={{ padding: '0', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#0B2545', padding: '10px 16px', color: '#FFFFFF', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                DISPATCH STATUS (This Month)
              </div>
              <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                {/* Donut Simulation */}
                <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '50%', background: 'conic-gradient(#15803D 0% 68.8%, #0284C7 68.8% 96.9%, #EAB308 96.9% 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A' }}>64</span>
                    <span style={{ fontSize: '8px', color: '#64748B', fontWeight: '700' }}>Total Orders</span>
                  </div>
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: '600' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#15803D' }} /> Dispatched</span>
                    <strong style={{ color: '#0F172A' }}>44 <span style={{ color: '#64748B', fontWeight: '400' }}>(68.8%)</span></strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: '600' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284C7' }} /> In Transit</span>
                    <strong style={{ color: '#0F172A' }}>18 <span style={{ color: '#64748B', fontWeight: '400' }}>(28.1%)</span></strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: '600' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EAB308' }} /> Ready for Dispatch</span>
                    <strong style={{ color: '#0F172A' }}>6 <span style={{ color: '#64748B', fontWeight: '400' }}>(9.4%)</span></strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: '600' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EC4899' }} /> Pending (Not Ready)</span>
                    <strong style={{ color: '#0F172A' }}>8 <span style={{ color: '#64748B', fontWeight: '400' }}>(12.5%)</span></strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: '600' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} /> Cancelled</span>
                    <strong style={{ color: '#0F172A' }}>0 <span style={{ color: '#64748B', fontWeight: '400' }}>(0.0%)</span></strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Daily Dispatch Trend (Orders) */}
            <div className="section-card" style={{ padding: '0', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#0B2545', padding: '10px 16px', color: '#FFFFFF', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>DAILY DISPATCH TREND (Orders)</span>
                <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '500' }}>• Dispatched Orders  — On Time %</span>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '110px', paddingTop: '10px', borderBottom: '1px solid #E2E8F0' }}>
                  {[
                    { day: '18-Jul', count: 26, pct: '96%' },
                    { day: '19-Jul', count: 24, pct: '92%' },
                    { day: '20-Jul', count: 31, pct: '97%' },
                    { day: '21-Jul', count: 32, pct: '94%' },
                    { day: '22-Jul', count: 30, pct: '93%' },
                    { day: '23-Jul', count: 29, pct: '95%' },
                    { day: '24-Jul', count: 28, pct: '98%' }
                  ].map((bar, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1 }}>
                      <span style={{ fontSize: '9px', fontWeight: '800', color: '#16A34A' }}>{bar.pct}</span>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#0F172A' }}>{bar.count}</span>
                      <div style={{ width: '22px', height: `${(bar.count / 35) * 65}px`, backgroundColor: '#0B2545', borderRadius: '4px 4px 0 0' }} />
                      <span style={{ fontSize: '10px', color: '#64748B', marginTop: '4px' }}>{bar.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 3: Top 5 Delayed Dispatch Orders */}
            <div className="section-card" style={{ padding: '0', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#0B2545', padding: '10px 16px', color: '#FFFFFF', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                TOP 5 DELAYED DISPATCH ORDERS
              </div>
              <div style={{ padding: '0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Order No.</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Customer</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Delay Days</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Reason</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(((bomStore && bomStore.length > 0) ? bomStore : (props.bomStore || [])).filter(b => b && b.status && b.status !== 'Draft')).length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '24px 10px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                          No delayed dispatch orders. All orders are up to date.
                        </td>
                      </tr>
                    ) : (
                      ((bomStore && bomStore.length > 0) ? bomStore : (props.bomStore || [])).filter(b => b && b.status && b.status !== 'Draft').slice(0, 5).map((b, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#0F172A' }}>{b.bomCode || b.code}</td>
                          <td style={{ padding: '8px 10px', color: '#334155' }}>{b.customerName || b.customer}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 'bold', color: '#DC2626' }}>1</td>
                          <td style={{ padding: '8px 10px', color: '#64748B' }}>Packing Pending</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#FEF3C7', color: '#B45309' }}>
                              Pending
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* ROW 2: Dispatch by Product | Vehicle Utilization | Dispatch Performance */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: '16px', width: '100%' }}>

            {/* Table 1: Dispatch By Product / Profile (MTD) */}
            <div className="section-card" style={{ padding: '0', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#0B2545', padding: '10px 16px', color: '#FFFFFF', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                DISPATCH BY PRODUCT / PROFILE (MTD)
              </div>
              <div style={{ padding: '0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Product / Profile</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Orders</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qty (Nos)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Weight (MT)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Value (₹)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>On Time %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { prod: 'Mini Rail 100 mm', orders: 18, qty: '12,450', wt: '18.25', val: '72.45 L', pct: '97.2%' },
                      { prod: 'Mini Rail 60 mm', orders: 12, qty: '8,300', wt: '12.15', val: '48.10 L', pct: '96.1%' },
                      { prod: 'Long Rail 3000 mm', orders: 8, qty: '5,200', wt: '9.80', val: '33.28 L', pct: '95.0%' },
                      { prod: 'Mid Clamp 35 mm', orders: 11, qty: '22,600', wt: '6.25', val: '41.76 L', pct: '94.5%' },
                      { prod: 'End Clamp 35 mm', orders: 6, qty: '8,900', wt: '2.10', val: '16.75 L', pct: '100%' },
                      { prod: 'Others', orders: 9, qty: '6,420', wt: '3.60', val: '20.40 L', pct: '96.0%' }
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#0F172A' }}>{row.prod}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{row.orders}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.qty}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.wt}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>{row.val}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#16A34A', fontWeight: 'bold' }}>{row.pct}</td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: '#F8FAFC', fontWeight: 'bold', borderTop: '2px solid #CBD5E1' }}>
                      <td style={{ padding: '8px 10px' }}>Total</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>64</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>63,870</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}>52.15</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0E7490' }}>2.32 Cr</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: '#16A34A' }}>96.4%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vehicle Utilization (Today) */}
            <div className="section-card" style={{ padding: '0', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#0B2545', padding: '10px 16px', color: '#FFFFFF', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                VEHICLE UTILIZATION (Today)
              </div>
              <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div style={{ position: 'relative', width: '110px', height: '110px', borderRadius: '50%', background: 'conic-gradient(#15803D 0% 56.3%, #0284C7 56.3% 84.4%, #EAB308 84.4% 96.9%, #EF4444 96.9% 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: '900', color: '#0F172A' }}>32</span>
                    <span style={{ fontSize: '7px', color: '#64748B', fontWeight: '700' }}>Vehicles</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, fontSize: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#334155' }}><span style={{ color: '#15803D' }}>•</span> Loaded & Dispatched</span>
                    <strong>18 <span style={{ color: '#64748B' }}>(56.3%)</span></strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#334155' }}><span style={{ color: '#0284C7' }}>•</span> In Transit</span>
                    <strong>18 <span style={{ color: '#64748B' }}>(56.3%)</span></strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#334155' }}><span style={{ color: '#EAB308' }}>•</span> Loading</span>
                    <strong>4 <span style={{ color: '#64748B' }}>(12.5%)</span></strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#334155' }}><span style={{ color: '#EC4899' }}>•</span> Waiting (For Loading)</span>
                    <strong>5 <span style={{ color: '#64748B' }}>(15.6%)</span></strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#334155' }}><span style={{ color: '#EF4444' }}>•</span> Cancelled / Rescheduled</span>
                    <strong>1 <span style={{ color: '#64748B' }}>(3.1%)</span></strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Dispatch Performance Metrics */}
            <div className="section-card" style={{ padding: '0', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#0B2545', padding: '10px 16px', color: '#FFFFFF', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                DISPATCH PERFORMANCE (This Month)
              </div>
              <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '700' }}>Avg Loading</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#EFF6FF', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock size={14} /></div>
                  <strong style={{ fontSize: '16px', color: '#0F172A' }}>52 Mins</strong>
                  <span style={{ fontSize: '8px', color: '#16A34A', fontWeight: 'bold' }}>↓ 8 Mins vs Last Month</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '700' }}>Avg Waiting</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#FFF7ED', color: '#EA580C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Hourglass size={14} /></div>
                  <strong style={{ fontSize: '16px', color: '#0F172A' }}>41 Mins</strong>
                  <span style={{ fontSize: '8px', color: '#16A34A', fontWeight: 'bold' }}>↑ 10 Mins vs Last Month</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '700' }}>Right First Time</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle size={14} /></div>
                  <strong style={{ fontSize: '16px', color: '#0F172A' }}>99.0%</strong>
                  <span style={{ fontSize: '8px', color: '#16A34A', fontWeight: 'bold' }}>↑ 1.2% vs Last Month</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '700' }}>Documentation</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileCheck size={14} /></div>
                  <strong style={{ fontSize: '16px', color: '#0F172A' }}>98.5%</strong>
                  <span style={{ fontSize: '8px', color: '#16A34A', fontWeight: 'bold' }}>↑ 1.0% vs Last Month</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '9px', color: '#64748B', fontWeight: '700' }}>Complaints</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AlertCircle size={14} /></div>
                  <strong style={{ fontSize: '16px', color: '#0F172A' }}>2</strong>
                  <span style={{ fontSize: '8px', color: '#16A34A', fontWeight: 'bold' }}>↓ 1 vs Last Month</span>
                </div>
              </div>
            </div>

          </div>

          {/* ROW 3: Today's Dispatch Plan | Vehicles in Transit | Dispatch Value Trend */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '16px', width: '100%' }}>

            {/* Table: Today's Dispatch Plan */}
            <div className="section-card" style={{ padding: '0', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#0B2545', padding: '10px 16px', color: '#FFFFFF', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                TODAY'S DISPATCH PLAN
              </div>
              <div style={{ padding: '0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Order No.</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Customer</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Weight</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Planned</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { order: 'VRM/26/07/128', cust: 'ABC Solar', item: 'Mini Rail 100 mm', qty: 500, wt: '0.90', date: '24 Jul 2026', st: 'Dispatched', bg: '#DCFCE7', fg: '#166534' },
                      { order: 'VRM/26/07/129', cust: 'Sun Power', item: 'Long Rail 3000 mm', qty: 200, wt: '1.20', date: '24 Jul 2026', st: 'In Transit', bg: '#E0F2FE', fg: '#0369A1' },
                      { order: 'VRM/26/07/130', cust: 'Green Infra', item: 'Mid Clamp 35 mm', qty: 1500, wt: '0.45', date: '24 Jul 2026', st: 'Dispatched', bg: '#DCFCE7', fg: '#166534' },
                      { order: 'VRM/26/07/131', cust: 'Bright Energy', item: 'Alu. Bracket', qty: 400, wt: '0.60', date: '24 Jul 2026', st: 'Loading', bg: '#FEF3C7', fg: '#B45309' },
                      { order: 'VRM/26/07/132', cust: 'Voltix', item: 'End Clamp 35 mm', qty: 300, wt: '0.25', date: '24 Jul 2026', st: 'Ready', bg: '#ECFEFF', fg: '#0E7490' }
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#0F172A' }}>{row.order}</td>
                        <td style={{ padding: '8px 10px' }}>{row.cust}</td>
                        <td style={{ padding: '8px 10px' }}>{row.item}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.qty}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.wt}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B' }}>{row.date}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', backgroundColor: row.bg, color: row.fg }}>{row.st}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table: Vehicles in Transit */}
            <div className="section-card" style={{ padding: '0', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#0B2545', padding: '10px 16px', color: '#FFFFFF', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                VEHICLES IN TRANSIT
              </div>
              <div style={{ padding: '0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Vehicle No.</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Transporter</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Order No.</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Customer</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Dispatched</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>ETA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { vNo: 'TN 09 AB 1234', trans: 'SRS Logistics', order: 'WO-2', cust: 'Sun Power', disp: '23-Jul-2026', eta: '24-Jul-2026' },
                      { vNo: 'TN 37 CD 5678', trans: 'VRM Transport', order: 'WO-3', cust: 'Green Infra', disp: '23-Jul-2026', eta: '24-Jul-2026' },
                      { vNo: 'KA 01 EF 9012', trans: 'Safe Way', order: 'WO-4', cust: 'Bright Energy', disp: '23-Jul-2026', eta: '24-Jul-2026' },
                      { vNo: 'TN 88 U 7890', trans: 'Speed Cargo', order: 'WO-5', cust: 'KPR Mill', disp: '23-Jul-2026', eta: '25-Jul-2026' }
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#0E7490' }}>{row.vNo}</td>
                        <td style={{ padding: '8px 10px' }}>{row.trans}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 'bold' }}>{row.order}</td>
                        <td style={{ padding: '8px 10px' }}>{row.cust}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B' }}>{row.disp}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', backgroundColor: '#E0F2FE', color: '#0369A1' }}>{row.eta}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Dispatch Value Trend Bar Chart */}
            <div className="section-card" style={{ padding: '0', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#0B2545', padding: '10px 16px', color: '#FFFFFF', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                DISPATCH VALUE TREND (₹ Cr)
              </div>
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '110px', borderBottom: '1px solid #E2E8F0' }}>
                  {[
                    { m: 'Jan-26', v: '2.15', count: 210 },
                    { m: 'Feb-26', v: '2.34', count: 228 },
                    { m: 'Mar-26', v: '2.48', count: 240 },
                    { m: 'Apr-26', v: '2.62', count: 246 },
                    { m: 'May-26', v: '2.71', count: 262 },
                    { m: 'Jun-26', v: '2.84', count: 270 },
                    { m: 'Jul-26', v: '3.26', count: 352 }
                  ].map((bar, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1 }}>
                      <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#0E7490' }}>₹{bar.v}</span>
                      <div style={{ width: '18px', height: `${(parseFloat(bar.v) / 4) * 70}px`, backgroundColor: '#0B2545', borderRadius: '4px 4px 0 0' }} />
                      <span style={{ fontSize: '9px', color: '#64748B' }}>{bar.m}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* ROW 4: Document Checklist | Invoices Pending | Key Alerts | Today's Snapshot */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', width: '100%' }}>

            {/* Card 1: Document Checklist */}
            <div className="section-card" style={{ padding: '0', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#0B2545', padding: '10px 16px', color: '#FFFFFF', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                DOCUMENT CHECKLIST (Today)
              </div>
              <div style={{ padding: '0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Documents</th>
                      <th style={{ padding: '6px 10px', textAlign: 'center' }}>Required</th>
                      <th style={{ padding: '6px 10px', textAlign: 'center' }}>Completed</th>
                      <th style={{ padding: '6px 10px', textAlign: 'center' }}>Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { doc: 'Invoice', req: 28, comp: 27, pend: 1 },
                      { doc: 'E-Way Bill', req: 28, comp: 28, pend: 0 },
                      { doc: 'LR / Delivery Challan', req: 28, comp: 28, pend: 0 },
                      { doc: 'Packing List', req: 28, comp: 27, pend: 1 },
                      { doc: 'Test Certificate', req: 12, comp: 10, pend: 2 }
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '6px 10px', fontWeight: '600' }}>{row.doc}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>{row.req}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: '#16A34A', fontWeight: 'bold' }}>{row.comp}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: row.pend > 0 ? '#DC2626' : '#64748B', fontWeight: row.pend > 0 ? 'bold' : 'normal' }}>{row.pend}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Card 2: Invoices Pending Dispatch */}
            <div className="section-card" style={{ padding: '0', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#0B2545', padding: '10px 16px', color: '#FFFFFF', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                INVOICES PENDING DISPATCH (This Month)
              </div>
              <div style={{ padding: '0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Order No.</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Customer</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>Invoice Value</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { order: 'WO-3', cust: 'Green Infra', val: '12,48,000', reason: 'Payment Pending' },
                      { order: 'WO-4', cust: 'Bright Energy', val: '8,36,000', reason: 'Document Pending' }
                    ].map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 'bold' }}>{row.order}</td>
                        <td style={{ padding: '6px 10px' }}>{row.cust}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 'bold' }}>₹ {row.val}</td>
                        <td style={{ padding: '6px 10px', color: '#EA580C', fontWeight: '600' }}>{row.reason}</td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: '#F8FAFC', fontWeight: 'bold' }}>
                      <td colSpan="2" style={{ padding: '6px 10px' }}>Total</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', color: '#0E7490' }}>28,12,000</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Card 3: Key Alerts */}
            <div className="section-card" style={{ padding: '0', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#0B2545', padding: '10px 16px', color: '#FFFFFF', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                KEY ALERTS
              </div>
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '11px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444', flexShrink: 0 }} />
                  <span style={{ color: '#334155' }}><strong>14 dispatches</strong> are overdue.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B', flexShrink: 0 }} />
                  <span style={{ color: '#334155' }}>Material shortage for <strong>Mini Rail 60 mm</strong> - Follow up with Purchase.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B', flexShrink: 0 }} />
                  <span style={{ color: '#334155' }}><strong>2 invoices</strong> are pending - Expedite documentation.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3B82F6', flexShrink: 0 }} />
                  <span style={{ color: '#334155' }}><strong>2 vehicles</strong> are waiting for loading.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981', flexShrink: 0 }} />
                  <span style={{ color: '#334155' }}>All <strong>E-Way Bills</strong> generated on time.</span>
                </div>
              </div>
            </div>

            {/* Card 4: Today's Snapshot */}
            <div className="section-card" style={{ padding: '0', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#0B2545', padding: '10px 16px', color: '#FFFFFF', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                TODAY'S SNAPSHOT
              </div>
              <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
                <div style={{ backgroundColor: '#F8FAFC', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '9px', color: '#64748B', fontWeight: '700' }}>Dispatch Plan</div>
                  <strong style={{ fontSize: '14px', color: '#0F172A' }}>28</strong>
                </div>
                <div style={{ backgroundColor: '#F0FDF4', padding: '8px', borderRadius: '8px', border: '1px solid #DCFCE7' }}>
                  <div style={{ fontSize: '9px', color: '#166534', fontWeight: '700' }}>Dispatched</div>
                  <strong style={{ fontSize: '14px', color: '#15803D' }}>28</strong>
                </div>
                <div style={{ backgroundColor: '#F0F9FF', padding: '8px', borderRadius: '8px', border: '1px solid #E0F2FE' }}>
                  <div style={{ fontSize: '9px', color: '#0369A1', fontWeight: '700' }}>In Transit</div>
                  <strong style={{ fontSize: '14px', color: '#0284C7' }}>18</strong>
                </div>
                <div style={{ backgroundColor: '#ECFEFF', padding: '8px', borderRadius: '8px', border: '1px solid #CFFAFE' }}>
                  <div style={{ fontSize: '9px', color: '#0E7490', fontWeight: '700' }}>Ready</div>
                  <strong style={{ fontSize: '14px', color: '#085D75' }}>6</strong>
                </div>
                <div style={{ backgroundColor: '#FFF7ED', padding: '8px', borderRadius: '8px', border: '1px solid #FFEDD5' }}>
                  <div style={{ fontSize: '9px', color: '#C2410C', fontWeight: '700' }}>Pending</div>
                  <strong style={{ fontSize: '14px', color: '#EA580C' }}>14</strong>
                </div>
                <div style={{ backgroundColor: '#FAF5FF', padding: '8px', borderRadius: '8px', border: '1px solid #F3E8FF' }}>
                  <div style={{ fontSize: '9px', color: '#7E22CE', fontWeight: '700' }}>Value</div>
                  <strong style={{ fontSize: '12px', color: '#6B21A8' }}>₹ 28.45 L</strong>
                </div>
              </div>
            </div>

          </div>

          <div style={{ fontSize: '10px', color: '#94A3B8', fontStyle: 'italic', textAlign: 'left', marginTop: '-4px' }}>
            Note: All numbers are based on system data as of last updated time.
          </div>

        </div>
      )}

      {/* ==================== 14. PRODUCTION ADMIN DEDICATED PAGES (EXACT PURCHASE ORDERS SCREENSHOT TEMPLATE) ==================== */}
    </div>
  );
}
