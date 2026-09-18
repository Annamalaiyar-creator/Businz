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
import StatusBadge from '../StatusBadge';
import { getSafeZohoPOs, getSafeZohoVendors, getSafeZohoItems, saveSafeZohoPO } from '../../services/zohoSafeSync';
import { fetchCloudStore, saveCloudStore, saveCloudStoreImmediate, subscribeToCloudStore } from '../../utils/supabaseDataSync';
import { saveMediaToCache, getMediaFromCache, stripDataUrlsFromRecord, readCompressedImage, compressAndSaveFile } from '../../utils/otherViewsShared';


export default function GoodsReceiptNoteView(props) {
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
  const [grnList, setGrnList] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(g => ({
            id: g.grnNo || g.id,
            poRef: g.poRef || g.poNo || '—',
            vendor: g.vendor || '—',
            date: g.date || '—',
            received: `${g.receivedQty || (g.items ? g.items.reduce((s, it) => s + Number(it.accepted || it.now || 0), 0) : 0)} Units`,
            status: g.status || 'OPEN / PARTIALLY RECEIVED',
            val: `₹ ${(g.receivedQty || (g.items ? g.items.reduce((s, it) => s + Number(it.accepted || it.now || 0), 0) : 0)) * 1250}`,
            challanNo: g.challanNo || '',
            receivedBy: g.receivedBy || '',
            inspectorName: g.inspectorName || '',
            inspectionRemarks: g.inspectionRemarks || '',
            documents: g.documents || []
          }));
        }
      }
    } catch (_) {}
    return [];
  });
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

  const [grnPage, setGrnPage] = useState(1);
  const [grnRowsPerPage, setGrnRowsPerPage] = useState(10);
  const [selectedGrnRows, setSelectedGrnRows] = useState([]);
  const [filterDate, setFilterDate] = useState('');
  const [grnListStatusFilter, setGrnListStatusFilter] = useState('All');
  const [grnListActiveTab, setGrnListActiveTab] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetch('/api/grns')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const formattedList = data.map(g => ({
            id: g.grnNo || g.id,
            poRef: g.poRef || g.poNo || '—',
            vendor: g.vendor || '—',
            date: g.date || '—',
            received: `${g.receivedQty || (g.items ? g.items.reduce((s, it) => s + Number(it.accepted || it.now || 0), 0) : 0)} Units`,
            status: g.status || 'OPEN / PARTIALLY RECEIVED',
            val: `₹ ${(g.receivedQty || (g.items ? g.items.reduce((s, it) => s + Number(it.accepted || it.now || 0), 0) : 0)) * 1250}`,
            challanNo: g.challanNo || '',
            receivedBy: g.receivedBy || '',
            inspectorName: g.inspectorName || '',
            inspectionRemarks: g.inspectionRemarks || '',
            documents: g.documents || []
          }));
          setGrnList(formattedList);
          try {
            localStorage.setItem('controlroom_central_grns_v2', JSON.stringify(data));
            localStorage.setItem('goods_receipt_notes', JSON.stringify(data));
          } catch (_) {}
        }
      })
      .catch(err => console.error('Error refreshing GRNs:', err))
      .finally(() => {
        setTimeout(() => setIsRefreshing(false), 400);
      });
  };

  const handleOpenViewGrn = (row) => {
    resetCreateGRNForm();
    loadPOItems(row.poRef);
    if (row.challanNo) setGrnChallanNo(row.challanNo);
    if (row.receivedBy) setGrnReceivedBy(row.receivedBy);
    if (row.inspectorName) setGrnInspectorName(row.inspectorName);
    if (row.inspectionRemarks) setGrnInspectionRemarks(row.inspectionRemarks);
    if (row.documents && Array.isArray(row.documents) && row.documents.length > 0) {
      setGrnDocs(row.documents);
    } else {
      setGrnDocs([{
        title: 'Delivery Challan *',
        filename: `Challan_${row.challanNo || 'Doc'}.pdf`,
        size: '1.2 MB',
        url: `data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsOfCjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+CnN0cmVhbQp4nE3NPQ7CMAwG4D1T5Awhdtz8iZ0BiQEZqBslFiQkxPn9tJW6vOD3fV92120bhhF4R6mFNBp0FspbUQo7V4m0y2a3b0/b7fg87uPz/DzsT/txfF7v4/7m72m7nve7bZ7Xz+Pj/v2/L74BQ44l6gplbmRzdHJlYW0KZW5kb2JqCjMgMCBvYmoKOTYKZW5kb2JqCjEgMCBvYmoKPDwvVHlwZS9QYWdlL1BhcmludCA0IDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNSAwIFI+Pj4+L0NvbnRlbnRzIDIgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9QYWdlcy9Db3VudCAxL0tpZHNbMSAwIFJdPj4KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj4KZW5kb2JqCjYgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDQgMCBSPj4KZXhyZWYKMCA3CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDE2MSAwMDAwMCBuIAowMDAwMDAwMDE5IDAwMDAwIG4gCjAwMDAwMDAxNDIgMDAwMDAgbiAKMDAwMDAwMDI1NSAwMDAwMCBuIAowMDAwMDAwMzAyIDAwMDAwIG4gCjAwMDAwMDAzNjkgMDAwMDAgbiAKdHJhaWxlcgo8PC9TaXplIDcvUm9vdCA2IDAgUj4+CnN0YXJ0eHJlZgo0MTgKJSVFT0YK`
      }]);
    }
    setIsViewOnlyMode(true);
    setShowCreateGRN(true);
  };

  const handleOpenEditGrn = (row) => {
    resetCreateGRNForm();
    loadPOItems(row.poRef);
    if (row.challanNo) setGrnChallanNo(row.challanNo);
    if (row.receivedBy) setGrnReceivedBy(row.receivedBy);
    if (row.inspectorName) setGrnInspectorName(row.inspectorName);
    if (row.inspectionRemarks) setGrnInspectionRemarks(row.inspectionRemarks);
    setEditingGrnId(row.id);
    setIsViewOnlyMode(false);
    setShowCreateGRN(true);
  };

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

  // Helper to handle push to GRN transition
  const handlePendingPushToGrn = (currentPOs = livePOs) => {
    try {
      const pushPo = localStorage.getItem('controlroom_push_to_grn_po');
      const pushDataStr = localStorage.getItem('controlroom_push_to_grn_po_data');
      if (pushPo || pushDataStr) {
        localStorage.removeItem('controlroom_push_to_grn_po');
        localStorage.removeItem('controlroom_push_to_grn_po_data');
        resetCreateGRNForm();

        let poTarget = null;
        if (pushDataStr) {
          try { poTarget = JSON.parse(pushDataStr); } catch (_) {}
        }
        const poRef = (poTarget && (poTarget.poNo || poTarget.id)) || pushPo;

        // Instant pre-population from poTarget if available
        if (poTarget) {
          setSelectedGRNPo(poRef);
          if (poTarget.vendor && poTarget.vendor !== 'Vendor') setSelectedGRNVendor(poTarget.vendor);
          if (Array.isArray(poTarget.items) && poTarget.items.length > 0) {
            const initialItems = poTarget.items.map((it, idx) => {
              const ordered = Number(it.qty !== undefined ? it.qty : (it.quantity || 0));
              const prev = Number(it.previouslyReceived || 0);
              const remaining = (it.remainingQty !== undefined) ? Number(it.remainingQty) : Math.max(0, ordered - prev);
              return {
                id: it.id || it.itemId || it.lineItemId || `PO-ITEM-${idx}`,
                name: it.name || it.item_name || 'Material Item',
                sku: it.sku || `SKU-${101 + idx}`,
                desc: it.description || it.desc || '',
                uom: it.unit || it.uom || 'NOS',
                ordered: ordered,
                prev: prev,
                remaining: remaining,
                now: remaining,
                accepted: remaining,
                rejected: 0,
                reason: '—',
                batch: it.batch || `LOT-2026-${idx + 1}`
              };
            });
            setGrnItems(initialItems);
          }
        }

        loadPOItems(poRef, currentPOs, true, poTarget);
        setIsViewOnlyMode(false);
        setShowCreateGRN(true);
      }
    } catch (_) {}
  };

  // Listen for instant push-to-grn event across components
  useEffect(() => {
    const handlePushEvent = (e) => {
      const poTarget = e.detail;
      if (!poTarget) return;
      resetCreateGRNForm();
      const poRef = poTarget.poNo || poTarget.id;
      setSelectedGRNPo(poRef);
      if (poTarget.vendor && poTarget.vendor !== 'Vendor') setSelectedGRNVendor(poTarget.vendor);
      if (Array.isArray(poTarget.items) && poTarget.items.length > 0) {
        const initialItems = poTarget.items.map((it, idx) => {
          const ordered = Number(it.qty !== undefined ? it.qty : (it.quantity || 0));
          const prev = Number(it.previouslyReceived || 0);
          const remaining = (it.remainingQty !== undefined) ? Number(it.remainingQty) : Math.max(0, ordered - prev);
          return {
            id: it.id || it.itemId || it.lineItemId || `PO-ITEM-${idx}`,
            name: it.name || it.item_name || 'Material Item',
            sku: it.sku || `SKU-${101 + idx}`,
            desc: it.description || it.desc || '',
            uom: it.unit || it.uom || 'NOS',
            ordered: ordered,
            prev: prev,
            remaining: remaining,
            now: remaining,
            accepted: remaining,
            rejected: 0,
            reason: '—',
            batch: it.batch || `LOT-2026-${idx + 1}`
          };
        });
        setGrnItems(initialItems);
      }
      loadPOItems(poRef, livePOs, true, poTarget);
      setIsViewOnlyMode(false);
      setShowCreateGRN(true);
    };

    window.addEventListener('controlroom_push_to_grn', handlePushEvent);
    return () => window.removeEventListener('controlroom_push_to_grn', handlePushEvent);
  }, [livePOs]);

  // Fetch live Zoho Purchase Orders & stored GRNs for GRN selection and list display
  const fetchLivePOs = useCallback(async () => {
    try {
      const safePOs = await getSafeZohoPOs();
      if (Array.isArray(safePOs) && safePOs.length > 0) {
        setLivePOs(safePOs);
        handlePendingPushToGrn(safePOs);
        return;
      }
    } catch (_) {}

    fetch('/api/zoho/purchaseorders')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLivePOs(data);
          handlePendingPushToGrn(data);
        }
      })
      .catch(err => {
        console.error('Error fetching live POs:', err);
        handlePendingPushToGrn(livePOs);
      });
  }, []);

  useEffect(() => {
    handlePendingPushToGrn(livePOs);
    fetchLivePOs();
  }, [fetchLivePOs]);

  // Also check whenever activeTab switches to Goods Receipt Note
  useEffect(() => {
    if (activeTab === 'Goods Receipt Note' || activeTab === 'Goods Receipt Note (GRN)') {
      handlePendingPushToGrn(livePOs);
      fetchLivePOs();
    }
  }, [activeTab, fetchLivePOs]);

  useEffect(() => {
    fetch('/api/grns')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const formattedList = data.map(g => ({
            id: g.grnNo || g.id,
            poRef: g.poRef || g.poNo || '—',
            vendor: g.vendor || '—',
            date: g.date || '—',
            received: `${g.receivedQty || (g.items ? g.items.reduce((s, it) => s + Number(it.accepted || it.now || 0), 0) : 0)} Units`,
            status: g.status || 'OPEN / PARTIALLY RECEIVED',
            val: `₹ ${(g.receivedQty || (g.items ? g.items.reduce((s, it) => s + Number(it.accepted || it.now || 0), 0) : 0)) * 1250}`,
            challanNo: g.challanNo || '',
            receivedBy: g.receivedBy || '',
            inspectorName: g.inspectorName || '',
            inspectionRemarks: g.inspectionRemarks || '',
            documents: g.documents || []
          }));
          setGrnList(formattedList);
          try {
            localStorage.setItem('controlroom_central_grns_v2', JSON.stringify(data));
            localStorage.setItem('goods_receipt_notes', JSON.stringify(data));
          } catch (_) {}
        }
      })
      .catch(err => console.error('Error fetching stored GRNs:', err));
  }, [activeTab]);

  // Function to load PO details and line items when a PO is selected
  const loadPOItems = (selectedId, currentLivePOs = livePOs, autoFillNow = false, pushedPoTarget = null) => {
    if (!selectedId) {
      setSelectedGRNPo('');
      setGrnItems([]);
      setSelectedGRNVendor('');
      setPoReceivingHistory([]);
      return;
    }

    const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const cleanSelected = normalize(selectedId);

    // Read any pending pushed data from local/session storage as an additional source
    let storedPushData = null;
    try {
      const rawStored = localStorage.getItem('controlroom_push_to_grn_po_data') || sessionStorage.getItem('controlroom_viewing_po');
      if (rawStored) storedPushData = JSON.parse(rawStored);
    } catch (_) {}

    const pool = [
      pushedPoTarget,
      storedPushData,
      ...(Array.isArray(currentLivePOs) ? currentLivePOs : []),
      ...(Array.isArray(livePOs) ? livePOs : [])
    ].filter(Boolean);

    const targetPO = pool.find(p => {
      const pNo = normalize(p.poNo);
      const pId = normalize(p.id);
      const pZohoId = normalize(p.zohoId);
      return cleanSelected && (pNo === cleanSelected || pId === cleanSelected || pZohoId === cleanSelected || (pNo && cleanSelected.includes(pNo)) || (pNo && pNo.includes(cleanSelected)));
    }) || pushedPoTarget || (storedPushData && (normalize(storedPushData.poNo) === cleanSelected || normalize(storedPushData.id) === cleanSelected) ? storedPushData : null);

    const vendorName = (targetPO && targetPO.vendor && targetPO.vendor !== 'Vendor' && targetPO.vendor !== 'Fresh Vendor')
      ? targetPO.vendor
      : (selectedGRNVendor && selectedGRNVendor !== 'Vendor' ? selectedGRNVendor : 'Vendor');

    const targetId = (targetPO && targetPO.id) ? targetPO.id : selectedId;
    const poRef = (targetPO && targetPO.poNo) ? targetPO.poNo : selectedId;

    setSelectedGRNPo(poRef);
    if (vendorName && vendorName !== 'Vendor') {
      setSelectedGRNVendor(vendorName);
    }

    // Immediately pre-seed items from targetPO so UI reflects real items instantly without waiting for network
    if (targetPO && Array.isArray(targetPO.items) && targetPO.items.length > 0) {
      const seededItems = targetPO.items.map((it, idx) => {
        const ordered = Number(it.qty !== undefined ? it.qty : (it.quantity || 0));
        const prev = Number(it.previouslyReceived || 0);
        const remaining = (it.remainingQty !== undefined) ? Number(it.remainingQty) : Math.max(0, ordered - prev);
        const nowVal = autoFillNow ? remaining : (it.now !== undefined ? it.now : remaining);
        const acceptedVal = autoFillNow ? remaining : (it.accepted !== undefined ? it.accepted : remaining);
        return {
          id: it.id || it.itemId || it.lineItemId || `PO-ITEM-${idx}`,
          name: it.name || it.item_name || 'Material Item',
          sku: it.sku || `SKU-${101 + idx}`,
          desc: it.description || it.desc || '',
          uom: it.unit || it.uom || 'NOS',
          ordered: ordered,
          prev: prev,
          remaining: remaining,
          now: nowVal,
          accepted: acceptedVal,
          rejected: 0,
          reason: '—',
          batch: it.batch || `LOT-2026-${idx + 1}`
        };
      });
      setGrnItems(seededItems);
    }

    Promise.all([
      fetch(`/api/zoho/purchaseorders/${encodeURIComponent(targetId)}`).then(res => res.ok ? res.json().catch(() => null) : null),
      fetch(`/api/po-receiving-history/${encodeURIComponent(poRef)}`).then(res => res.ok ? res.json().catch(() => null) : null)
    ])
      .then(([detail, historyData]) => {
        let rawItems = (detail && Array.isArray(detail.items) && detail.items.length > 0)
          ? detail.items
          : (targetPO && Array.isArray(targetPO.items) && targetPO.items.length > 0)
            ? targetPO.items
            : null;

        if (!rawItems || rawItems.length === 0) {
          if (grnItems && grnItems.length > 0) {
            rawItems = grnItems;
          } else {
            rawItems = [];
          }
        }

        // Also if vendor was not resolved earlier, resolve from detail or targetPO
        if (detail && detail.vendor && detail.vendor !== 'Vendor' && detail.vendor !== 'Fresh Vendor') {
          setSelectedGRNVendor(detail.vendor);
        } else if (targetPO && targetPO.vendor && targetPO.vendor !== 'Vendor') {
          setSelectedGRNVendor(targetPO.vendor);
        }

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

          const ordered = Number(it.qty !== undefined ? it.qty : (it.quantity || it.ordered || 0));
          const remaining = (it.remainingQty !== undefined) ? Number(it.remainingQty) : Math.max(0, ordered - prev);

          // If autoFillNow is true (e.g. pushed from PO), pre-populate receiving now and accepted with remaining quantity!
          const nowVal = autoFillNow ? remaining : (it.now !== undefined ? it.now : remaining);
          const acceptedVal = autoFillNow ? remaining : (it.accepted !== undefined ? it.accepted : remaining);

          return {
            id: itemId,
            name: it.name || it.item_name || 'Material Item',
            sku: it.sku || `SKU-${101 + idx}`,
            desc: it.description || it.desc || '',
            uom: it.unit || it.uom || 'NOS',
            ordered: ordered,
            prev: prev,
            remaining: remaining,
            now: nowVal,
            accepted: acceptedVal,
            rejected: 0,
            reason: '—',
            batch: it.batch || `LOT-2026-${idx + 1}`
          };
        });

        if (items.length > 0) {
          setGrnItems(items);
        }
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

    // 1. Compute totals and statuses immediately
    const totalNow = processedItems.reduce((acc, it) => acc + Number(it.now || 0), 0);
    const totalAccepted = processedItems.reduce((acc, it) => acc + Number(it.accepted || 0), 0);
    const totalRejected = processedItems.reduce((acc, it) => acc + Number(it.rejected || 0), 0);
    const totalOrdered = processedItems.reduce((acc, it) => acc + Number(it.ordered || 0), 0);

    const prevPO = livePOs.find(p => p.poNo === selectedGRNPo || p.id === selectedGRNPo || p.zohoId === selectedGRNPo) || {};
    const curOrd = totalOrdered > 0 ? totalOrdered : Number(prevPO.totalOrderedQty || 0);
    const pastRec = Number(prevPO.totalReceivedQty || prevPO.totalReceived || 0);
    const curRec = pastRec + totalAccepted;
    const curRem = Math.max(0, curOrd - curRec);
    const isFull = (curOrd > 0 && curRec >= curOrd);

    const grnGeneratedId = `GRN-2026-${String(Date.now()).slice(-5)}`;
    const docsToAttach = grnDocs || [];

    const newGRNRecord = {
      id: grnGeneratedId,
      grnNo: grnGeneratedId,
      poRef: selectedGRNPo,
      poNo: selectedGRNPo,
      vendor: selectedGRNVendor || prevPO.vendor || 'Vendor',
      challanNo: grnChallanNo || 'DC-NEW',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      totalOrderedQty: curOrd,
      receivedQty: totalNow,
      acceptedQty: totalAccepted,
      rejectedQty: totalRejected,
      receivedBy: grnReceivedBy || 'Store Manager',
      inspectorName: grnInspectorName || 'Quality Inspector',
      inspectionRemarks: grnInspectionRemarks || '',
      items: processedItems,
      documents: docsToAttach,
      status: isFull ? 'CLOSED / FULLY RECEIVED' : 'OPEN / PARTIALLY RECEIVED'
    };

    const formattedGRN = {
      id: newGRNRecord.id,
      poRef: newGRNRecord.poRef,
      vendor: newGRNRecord.vendor,
      date: newGRNRecord.date,
      received: `${totalNow} Units`,
      status: newGRNRecord.status,
      val: `₹ ${totalNow * 1250}`,
      challanNo: newGRNRecord.challanNo,
      receivedBy: newGRNRecord.receivedBy,
      documents: newGRNRecord.documents
    };

    // 2. IMMEDIATE PERSISTENCE: GRN Store (React State + LocalStorage + Supabase Cloud)
    setGrnList(prev => [formattedGRN, ...prev.filter(g => g.id !== formattedGRN.id)]);
    try {
      const rawStored = localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes') || '[]';
      const parsed = JSON.parse(rawStored);
      const updatedGrns = [newGRNRecord, ...(Array.isArray(parsed) ? parsed.filter(g => (g.grnNo || g.id) !== newGRNRecord.id) : [])];
      localStorage.setItem('controlroom_central_grns_v2', JSON.stringify(updatedGrns));
      localStorage.setItem('goods_receipt_notes', JSON.stringify(updatedGrns));
      saveCloudStoreImmediate('grn_store', updatedGrns).catch(() => {});
    } catch (_) {}

    // 3. IMMEDIATE PERSISTENCE: PO Store (Supabase Cloud + LocalStorage)
    const poTargetId = selectedGRNPo;
    if (poTargetId && poTargetId !== '—') {
      saveSafeZohoPO({
        poNo: poTargetId,
        id: poTargetId,
        status: isFull ? 'CLOSED / FULLY RECEIVED' : 'OPEN / PARTIALLY RECEIVED',
        statusType: isFull ? 'closed' : 'partially_received',
        order_status: isFull ? 'closed' : 'received',
        totalOrderedQty: curOrd,
        totalReceivedQty: curRec,
        totalRemainingQty: curRem,
        totalReceived: curRec,
        receivingProgressPct: curOrd > 0 ? ((curRec / curOrd) * 100).toFixed(1) : '0.0',
        grnCount: (Number(prevPO.grnCount) || 0) + 1,
        items: processedItems.map(it => {
          const ord = Number(it.ordered || 0);
          const acc = Number(it.accepted !== undefined ? it.accepted : (it.now || 0));
          const prevIt = Number(it.prev || 0);
          const totIt = prevIt + acc;
          return {
            ...it,
            qty: ord,
            previouslyReceived: totIt,
            remainingQty: Math.max(0, ord - totIt)
          };
        })
      }).catch(() => {});
    }

    // 4. IMMEDIATE PERSISTENCE: Inward Inventory Stock
    try {
      const rawStored = localStorage.getItem('controlroom_raw_materials_store') || '[]';
      const rawMats = JSON.parse(rawStored);
      if (Array.isArray(rawMats) && rawMats.length > 0) {
        let anyUpdated = false;
        const updatedRaw = rawMats.map(rm => {
          const rmNameClean = String(rm.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const rmCodeClean = String(rm.code || rm.sku || rm.itemId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          let added = 0;
          processedItems.forEach(pi => {
            const piNameClean = String(pi.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const piCodeClean = String(pi.code || pi.sku || pi.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if ((rmNameClean && piNameClean && (rmNameClean === piNameClean || rmNameClean.includes(piNameClean) || piNameClean.includes(rmNameClean))) ||
                (rmCodeClean && piCodeClean && (rmCodeClean === piCodeClean || rmCodeClean.includes(piCodeClean) || piCodeClean.includes(rmCodeClean)))) {
              const q = Number(pi.accepted !== undefined && pi.accepted !== '' ? pi.accepted : (pi.now || 0));
              if (q > 0) added += q;
            }
          });
          if (added > 0) {
            anyUpdated = true;
            const newStock = Number(rm.stock || 0) + added;
            return {
              ...rm,
              stock: newStock,
              availableStock: newStock,
              physicalStock: (Number(rm.physicalStock) || Number(rm.stock || 0)) + added,
              goodsReceived: (Number(rm.goodsReceived) || 0) + added,
              status: newStock > (rm.minLevel || 50) ? 'In Stock' : 'Low Stock',
              lastUpdated: `Inwarded from GRN ${grnGeneratedId}`
            };
          }
          return rm;
        });
        if (anyUpdated) {
          localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(updatedRaw));
          saveCloudStoreImmediate('raw_materials_store', updatedRaw).catch(() => {});
          window.dispatchEvent(new Event('central_inventory_updated'));
          window.dispatchEvent(new Event('controlroom_raw_materials_update'));
        }
      }
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('controlroom_grn_completed', { detail: newGRNRecord }));
    window.dispatchEvent(new Event('central_inventory_updated'));
    window.dispatchEvent(new Event('controlroom_raw_materials_update'));
    window.dispatchEvent(new Event('controlroom_storage_update'));
    window.dispatchEvent(new CustomEvent('storage'));

    // 5. Notify server & Zoho backend asynchronously
    fetch('/api/grns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGRNRecord)
    })
      .then(res => res.json())
      .catch(() => {});

    setShowCreateGRN(false);
    resetCreateGRNForm();
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

    const grnGeneratedId = `GRN-2026-${String(Date.now()).slice(-5)}`;
    const newGRNRecord = {
      id: grnGeneratedId,
      grnNo: grnGeneratedId,
      poRef: selectedGRNPo,
      poNo: selectedGRNPo,
      vendor: selectedGRNVendor || 'Vendor',
      challanNo: grnChallanNo || 'DC-FINAL',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      totalOrderedQty: totalAccepted,
      receivedQty: totalAccepted,
      acceptedQty: totalAccepted,
      rejectedQty: 0,
      receivedBy: grnReceivedBy || 'Store Manager',
      inspectorName: grnInspectorName || 'Quality Inspector',
      inspectionRemarks: grnInspectionRemarks || 'PO Marked as Fully Received & Closed',
      items: completedItems,
      documents: docsToAttach,
      status: 'CLOSED / FULLY RECEIVED'
    };

    const formattedGRN = {
      id: newGRNRecord.id,
      poRef: newGRNRecord.poRef,
      vendor: newGRNRecord.vendor,
      date: newGRNRecord.date,
      received: `${totalAccepted} Units`,
      status: 'CLOSED / FULLY RECEIVED',
      val: `₹ ${totalAccepted * 1250}`,
      challanNo: newGRNRecord.challanNo,
      receivedBy: newGRNRecord.receivedBy,
      documents: newGRNRecord.documents
    };

    // 1. IMMEDIATE PERSISTENCE: GRN Store
    setGrnList(prev => [formattedGRN, ...prev.filter(g => g.id !== formattedGRN.id)]);
    try {
      const rawStored = localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes') || '[]';
      const parsed = JSON.parse(rawStored);
      const updatedGrns = [newGRNRecord, ...(Array.isArray(parsed) ? parsed.filter(g => (g.grnNo || g.id) !== newGRNRecord.id) : [])];
      localStorage.setItem('controlroom_central_grns_v2', JSON.stringify(updatedGrns));
      localStorage.setItem('goods_receipt_notes', JSON.stringify(updatedGrns));
      saveCloudStoreImmediate('grn_store', updatedGrns).catch(() => {});
    } catch (_) {}

    // 2. IMMEDIATE PERSISTENCE: PO Store
    const poTargetId = selectedGRNPo;
    if (poTargetId && poTargetId !== '—') {
      const prevPO = livePOs.find(p => p.poNo === poTargetId || p.id === poTargetId || p.zohoId === poTargetId) || {};
      const curOrd = totalAccepted > 0 ? totalAccepted : Number(prevPO.totalOrderedQty || 0);
      saveSafeZohoPO({
        poNo: poTargetId,
        id: poTargetId,
        status: 'CLOSED / FULLY RECEIVED',
        statusType: 'closed',
        order_status: 'closed',
        totalOrderedQty: curOrd,
        totalReceivedQty: curOrd,
        totalRemainingQty: 0,
        totalReceived: curOrd,
        receivingProgressPct: '100.0',
        grnCount: (Number(prevPO.grnCount) || 0) + 1
      }).catch(() => {});
    }

    // 3. IMMEDIATE PERSISTENCE: Inward Inventory Stock
    try {
      const rawStored = localStorage.getItem('controlroom_raw_materials_store') || '[]';
      const rawMats = JSON.parse(rawStored);
      if (Array.isArray(rawMats) && rawMats.length > 0) {
        let anyUpdated = false;
        const updatedRaw = rawMats.map(rm => {
          const rmNameClean = String(rm.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const rmCodeClean = String(rm.code || rm.sku || rm.itemId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          let added = 0;
          completedItems.forEach(pi => {
            const piNameClean = String(pi.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const piCodeClean = String(pi.code || pi.sku || pi.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if ((rmNameClean && piNameClean && (rmNameClean === piNameClean || rmNameClean.includes(piNameClean) || piNameClean.includes(rmNameClean))) ||
                (rmCodeClean && piCodeClean && (rmCodeClean === piCodeClean || rmCodeClean.includes(piCodeClean) || piCodeClean.includes(rmCodeClean)))) {
              const q = Number(pi.accepted !== undefined && pi.accepted !== '' ? pi.accepted : (pi.now || 0));
              if (q > 0) added += q;
            }
          });
          if (added > 0) {
            anyUpdated = true;
            const newStock = Number(rm.stock || 0) + added;
            return {
              ...rm,
              stock: newStock,
              availableStock: newStock,
              physicalStock: (Number(rm.physicalStock) || Number(rm.stock || 0)) + added,
              goodsReceived: (Number(rm.goodsReceived) || 0) + added,
              status: newStock > (rm.minLevel || 50) ? 'In Stock' : 'Low Stock',
              lastUpdated: `Inwarded from GRN ${grnGeneratedId}`
            };
          }
          return rm;
        });
        if (anyUpdated) {
          localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(updatedRaw));
          saveCloudStoreImmediate('raw_materials_store', updatedRaw).catch(() => {});
          window.dispatchEvent(new Event('central_inventory_updated'));
          window.dispatchEvent(new Event('controlroom_raw_materials_update'));
        }
      }
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('controlroom_grn_completed', { detail: newGRNRecord }));
    window.dispatchEvent(new Event('central_inventory_updated'));
    window.dispatchEvent(new Event('controlroom_raw_materials_update'));
    window.dispatchEvent(new Event('controlroom_storage_update'));
    window.dispatchEvent(new CustomEvent('storage'));

    // 4. Notify server & Zoho backend asynchronously
    fetch('/api/grns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id: grnGeneratedId, grnNo: grnGeneratedId })
    })
      .then(res => res.json())
      .catch(() => {});
    setShowCreateGRN(false);
    resetCreateGRNForm();
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
      setCreateStatus({ type: 'success', text: 'Product created locally in Businz.' });
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
        setItemSaveStatus({ type: 'warning', text: 'Saved locally in Businz.' });
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
      {(activeTab === 'Goods Receipt Note' || activeTab === 'Goods Receipt Note (GRN)') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {!showCreateGRN ? (
            <>
              {/* Header section with Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#0F172A' }}>
                    Goods Receipt Note (GRN)
                  </h2>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Record, inspect and reconcile incoming material shipments against Purchase Orders
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    title="Refresh GRNs"
                    style={{
                      height: '40px',
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
                      cursor: isRefreshing ? 'not-allowed' : 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { if (!isRefreshing) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                    onMouseLeave={(e) => { if (!isRefreshing) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                  >
                    <RotateCcw
                      style={{
                        width: '15px',
                        height: '15px',
                        color: '#0E7490',
                        animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none'
                      }}
                    />
                    <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedGRNPo('');
                      setSelectedGRNVendor('');
                      setGrnChallanNo('');
                      setGrnItems([]);
                      setShowCreateGRN(true);
                    }}
                    style={{
                      backgroundColor: '#0E7490',
                      border: 'none',
                      color: 'white',
                      height: '40px',
                      fontSize: '13px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '0 6px 0 20px',
                      borderRadius: '50px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      boxShadow: '0 4px 14px rgba(14, 116, 144, 0.35)',
                      transition: 'all 0.2s ease',
                      letterSpacing: '0.2px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#085D75'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
                  >
                    <span>Create GRN</span>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0E7490',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      <ArrowRight size={16} strokeWidth={2.5} />
                    </div>
                  </button>
                </div>
              </div>

              {/* 1. FILTERS & SEARCH ROW CARD */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '12px 16px', backgroundColor: '#fafbfc', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center', width: '100%', boxSizing: 'border-box', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#f8fafc', width: '320px', maxWidth: '100%', boxSizing: 'border-box' }}>
                  <Search style={{ width: '15px', height: '15px', color: '#64748b', flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Search GRNs (GRN No, PO No, Vendor)..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setGrnPage(1); }}
                    style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: 'white' }}>
                    <Calendar style={{ width: '14px', height: '14px', color: '#64748b', flexShrink: 0 }} />
                    <input
                      type="date"
                      value={filterDate}
                      title="Filter by Date"
                      onChange={(e) => { setFilterDate(e.target.value); setGrnPage(1); }}
                      style={{ border: 'none', outline: 'none', fontSize: '12px', color: '#334155', backgroundColor: 'transparent' }}
                    />
                  </div>

                  <select
                    value={grnListStatusFilter}
                    onChange={(e) => { setGrnListStatusFilter(e.target.value); setGrnPage(1); }}
                    style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '12px', backgroundColor: 'white', color: '#334155', outline: 'none' }}
                  >
                    <option value="All">Status: All</option>
                    <option value="Approved">Approved</option>
                    <option value="CLOSED / FULLY RECEIVED">Closed / Fully Received</option>
                    <option value="OPEN / PARTIALLY RECEIVED">Open / Partially Received</option>
                    <option value="Draft">Draft</option>
                  </select>

                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setFilterDate('');
                      setGrnListStatusFilter('All');
                      setGrnListActiveTab('All');
                      setGrnPage(1);
                    }}
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
                      flexShrink: 0,
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
                  { id: 'All', label: 'All Receipts', count: grnList.length, bg: '#e2e8f0', fg: '#475569' },
                  { id: 'CLOSED', label: 'Closed / Fully Received', count: grnList.filter(g => String(g.status || '').toUpperCase().includes('CLOSED') || String(g.status || '').toUpperCase().includes('FULLY')).length, bg: '#dcfce7', fg: '#15803d' },
                  { id: 'PARTIALLY_RECEIVED', label: 'Open / Partially Received', count: grnList.filter(g => String(g.status || '').toUpperCase().includes('PARTIAL')).length, bg: '#fef3c7', fg: '#b45309' },
                  { id: 'Approved', label: 'Approved', count: grnList.filter(g => String(g.status || '').toLowerCase() === 'approved').length, bg: '#dcfce7', fg: '#166534' },
                  { id: 'Draft', label: 'Draft', count: grnList.filter(g => String(g.status || '').toLowerCase().includes('draft')).length, bg: '#fff7ed', fg: '#c2410c' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setGrnListActiveTab(tab.id); setGrnPage(1); }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: '10px 4px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      color: grnListActiveTab === tab.id ? '#2563eb' : '#64748b',
                      borderBottom: grnListActiveTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
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

              {/* 3. MAIN GRN TABLE CARD */}
              {(() => {
                const filteredGrns = grnList.filter(g => {
                  if (!g) return false;
                  const gId = String(g.id || '').toLowerCase();
                  const pRef = String(g.poRef || '').toLowerCase();
                  const vend = String(g.vendor || '').toLowerCase();
                  const q = searchQuery.toLowerCase().trim();
                  const matchesSearch = !q || gId.includes(q) || pRef.includes(q) || vend.includes(q);

                  const st = String(g.status || '').trim();
                  const stUpper = st.toUpperCase();

                  const matchesStatus = grnListStatusFilter === 'All' ||
                    (grnListStatusFilter === 'CLOSED / FULLY RECEIVED' && (stUpper.includes('CLOSED') || stUpper.includes('FULLY'))) ||
                    (grnListStatusFilter === 'OPEN / PARTIALLY RECEIVED' && stUpper.includes('PARTIAL')) ||
                    (grnListStatusFilter === 'Approved' && st.toLowerCase() === 'approved') ||
                    (grnListStatusFilter === 'Draft' && st.toLowerCase().includes('draft')) ||
                    st === grnListStatusFilter;

                  const matchesTab = grnListActiveTab === 'All' ||
                    (grnListActiveTab === 'CLOSED' && (stUpper.includes('CLOSED') || stUpper.includes('FULLY'))) ||
                    (grnListActiveTab === 'PARTIALLY_RECEIVED' && stUpper.includes('PARTIAL')) ||
                    (grnListActiveTab === 'Approved' && st.toLowerCase() === 'approved') ||
                    (grnListActiveTab === 'Draft' && st.toLowerCase().includes('draft')) ||
                    st === grnListActiveTab;

                  let matchesDate = true;
                  if (filterDate) {
                    if (g.date) {
                      const d = new Date(g.date);
                      const fd = new Date(filterDate);
                      if (!isNaN(d.getTime()) && !isNaN(fd.getTime())) {
                        matchesDate = d.toISOString().split('T')[0] === fd.toISOString().split('T')[0];
                      } else {
                        matchesDate = String(g.date).includes(filterDate);
                      }
                    } else {
                      matchesDate = false;
                    }
                  }

                  return matchesSearch && matchesStatus && matchesTab && matchesDate;
                });

                const sortedGrns = [...filteredGrns].sort((a, b) => {
                  const numA = parseInt(String(a.id || '').replace(/\D/g, ''), 10) || 0;
                  const numB = parseInt(String(b.id || '').replace(/\D/g, ''), 10) || 0;
                  return numB - numA;
                });

                const totalPages = Math.ceil(sortedGrns.length / grnRowsPerPage) || 1;
                const safeCurrentPage = Math.min(grnPage, totalPages);
                const indexOfLastRow = safeCurrentPage * grnRowsPerPage;
                const indexOfFirstRow = (safeCurrentPage - 1) * grnRowsPerPage;
                const currentRows = sortedGrns.slice(indexOfFirstRow, indexOfLastRow);

                let startPage = Math.max(1, safeCurrentPage - 1);
                let endPage = startPage + 2;
                if (endPage > totalPages) {
                  endPage = totalPages;
                  startPage = Math.max(1, endPage - 2);
                }
                const pageNumbers = [];
                for (let i = startPage; i <= endPage; i++) {
                  pageNumbers.push(i);
                }

                return (
                  <div className="section-card" style={{ padding: 0, overflowX: 'auto', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
                    {/* Header Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <strong style={{ fontSize: '15px', color: '#0F172A', fontWeight: '700' }}>Goods Receipt Notes</strong>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '2px 8px', borderRadius: '10px' }}>
                          {sortedGrns.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setFilterDate('');
                          setStatusFilter('All');
                          setGrnTab('All');
                          setGrnPage(1);
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          color: '#475569',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                      >
                        View All
                      </button>
                    </div>

                    {/* Table Responsive Wrapper */}
                    <div className="table-responsive" style={{ border: 'none', borderRadius: '0', margin: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
                      <table className="custom-table" style={{ fontSize: '13px', width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#475569', height: '48px' }}>
                            <th style={{ width: '48px', minWidth: '48px', textAlign: 'center', padding: '12px 0' }}>
                              <input
                                type="checkbox"
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const allPageIds = currentRows.map(g => g.id);
                                    setSelectedGrnRows(prev => Array.from(new Set([...prev, ...allPageIds])));
                                  } else {
                                    const pageIdsSet = new Set(currentRows.map(g => g.id));
                                    setSelectedGrnRows(prev => prev.filter(id => !pageIdsSet.has(id)));
                                  }
                                }}
                                checked={currentRows.length > 0 && currentRows.every(g => selectedGrnRows.includes(g.id))}
                                style={{ cursor: 'pointer', borderRadius: '4px', accentColor: '#0E7490' }}
                              />
                            </th>
                            <th style={{ width: '16%', minWidth: '130px', fontWeight: '700', padding: '12px 16px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>GRN No.</th>
                            <th style={{ width: '16%', minWidth: '130px', fontWeight: '700', padding: '12px 16px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>PO No.</th>
                            <th style={{ width: '28%', minWidth: '200px', fontWeight: '700', padding: '12px 16px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Vendor Name</th>
                            <th style={{ width: '14%', minWidth: '120px', fontWeight: '700', padding: '12px 16px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>GRN Date</th>
                            <th style={{ width: '14%', minWidth: '130px', fontWeight: '700', padding: '12px 16px', color: '#334155', textAlign: 'right', boxSizing: 'border-box' }}>Total Value</th>
                            <th style={{ width: '12%', minWidth: '130px', fontWeight: '700', padding: '12px 16px', color: '#334155', textAlign: 'center', boxSizing: 'border-box' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedGrns.length === 0 ? (
                            <tr>
                              <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                                No Goods Receipt Notes found matching the criteria. Click "Create GRN" to record a receipt.
                              </td>
                            </tr>
                          ) : (
                            currentRows.map((row, idx) => {
                              const isChecked = selectedGrnRows.includes(row.id);
                              return (
                                <tr
                                  key={row.id || idx}
                                  style={{
                                    borderBottom: idx === currentRows.length - 1 ? 'none' : '1px solid #f1f5f9',
                                    transition: 'all 0.15s ease',
                                    backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                                    borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                                  }}
                                  className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                                >
                                  <td style={{ textAlign: 'center', width: '48px' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setSelectedGrnRows(prev =>
                                          prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id]
                                        );
                                      }}
                                      style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                                    />
                                  </td>
                                  <td style={{ fontWeight: '600', color: '#2563eb', textAlign: 'left', padding: '12px 16px' }}>
                                    <a
                                      href="#"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleOpenViewGrn(row);
                                      }}
                                      style={{ fontWeight: '600', color: '#2563eb', textDecoration: 'none' }}
                                    >
                                      {row.id}
                                    </a>
                                  </td>
                                  <td style={{ padding: '12px 16px', color: '#475569', textAlign: 'left', fontWeight: '500' }}>
                                    {row.poRef}
                                  </td>
                                  <td style={{ padding: '12px 16px', fontWeight: '500', color: '#1e293b', textAlign: 'left' }}>
                                    {row.vendor}
                                  </td>
                                  <td style={{ padding: '12px 16px', color: '#64748b', textAlign: 'left' }}>
                                    {row.date}
                                  </td>
                                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e293b', textAlign: 'right' }}>
                                    {row.val || '—'}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                                    <StatusBadge status={row.status} size="sm" />
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Standard Pagination Footer Layout (Rule 6 compliant) */}
                    {sortedGrns.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', fontSize: '13px', color: '#64748B', borderTop: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
                        {/* Left Side: Rows per page selector + Showing X to Y entries */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>Showing per page</span>
                            <select
                              value={grnRowsPerPage}
                              onChange={(e) => { setGrnRowsPerPage(Number(e.target.value)); setGrnPage(1); }}
                              style={{ height: '32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', padding: '0 8px', backgroundColor: 'white', fontWeight: 'bold' }}
                            >
                              <option value={5}>5</option>
                              <option value={10}>10</option>
                            </select>
                          </div>
                          <span>Showing {sortedGrns.length === 0 ? 0 : indexOfFirstRow + 1} to {Math.min(indexOfLastRow, sortedGrns.length)} of {sortedGrns.length} entries</span>
                        </div>

                        {/* Right Side: Page navigation controls adjacent to Go to page */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <button
                              disabled={safeCurrentPage === 1}
                              onClick={() => setGrnPage(1)}
                              style={{ border: '1px solid #E2E8F0', background: safeCurrentPage === 1 ? '#F8FAFC' : 'white', cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
                            >
                              &laquo;
                            </button>
                            <button
                              disabled={safeCurrentPage === 1}
                              onClick={() => setGrnPage(prev => Math.max(prev - 1, 1))}
                              style={{ border: '1px solid #E2E8F0', background: safeCurrentPage === 1 ? '#F8FAFC' : 'white', cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                            >
                              &lt;
                            </button>

                            {pageNumbers.map(page => (
                              <button
                                key={page}
                                onClick={() => setGrnPage(page)}
                                style={{
                                  border: '1px solid #E2E8F0',
                                  background: page === safeCurrentPage ? '#0E7490' : 'white',
                                  color: page === safeCurrentPage ? 'white' : '#475569',
                                  cursor: 'pointer',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontWeight: page === safeCurrentPage ? 'bold' : '500'
                                }}
                              >
                                {page}
                              </button>
                            ))}

                            <button
                              disabled={safeCurrentPage === totalPages || totalPages === 0}
                              onClick={() => setGrnPage(prev => Math.min(prev + 1, totalPages))}
                              style={{ border: '1px solid #E2E8F0', background: (safeCurrentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (safeCurrentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                            >
                              &gt;
                            </button>
                            <button
                              disabled={safeCurrentPage === totalPages || totalPages === 0}
                              onClick={() => setGrnPage(totalPages)}
                              style={{ border: '1px solid #E2E8F0', background: (safeCurrentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (safeCurrentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
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
                              defaultValue={safeCurrentPage}
                              id="grn-goto-page-input"
                              style={{ width: '42px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}
                            />
                            <button
                              onClick={() => {
                                const val = parseInt(document.getElementById('grn-goto-page-input')?.value || '1', 10);
                                if (val >= 1 && val <= totalPages) setGrnPage(val);
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
                );
              })()}

              {/* Floating Selection Toolbar - Single line (Rule 6) */}
              {selectedGrnRows.length > 0 && (
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
                    <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedGrnRows.length}</strong> Selected
                  </span>

                  <button
                    onClick={() => {
                      if (selectedGrnRows.length > 1) {
                        alert("Please select a single GRN to view details.");
                        return;
                      }
                      const target = grnList.find(g => g.id === selectedGrnRows[0]);
                      if (target) handleOpenViewGrn(target);
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
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                  >
                    <Eye size={14} style={{ color: '#0E7490' }} /> View Details
                  </button>

                  {selectedGrnRows.length === 1 && (() => {
                    const target = grnList.find(g => g.id === selectedGrnRows[0]);
                    if (!target) return null;
                    const isClosed = String(target.status || '').toUpperCase().includes('CLOSED') || String(target.status || '').toUpperCase().includes('APPROVED') || target.status === 'Fully Accepted';
                    if (isClosed) return null;
                    return (
                      <button
                        onClick={() => handleOpenEditGrn(target)}
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
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                      >
                        <Edit3 size={14} style={{ color: '#D97706' }} /> Edit Info
                      </button>
                    );
                  })()}

                  <button
                    onClick={() => window.print()}
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
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                  >
                    <Printer size={14} style={{ color: '#64748B' }} /> Export / Print PDF
                  </button>

                  <button
                    onClick={() => {
                      const eligibleToDelete = selectedGrnRows.filter(id => {
                        const t = grnList.find(g => g.id === id);
                        return t && !(String(t.status || '').toUpperCase().includes('CLOSED') || String(t.status || '').toUpperCase().includes('APPROVED') || t.status === 'Fully Accepted');
                      });
                      if (eligibleToDelete.length === 0) {
                        alert('Selected GRN(s) are approved or fully received and cannot be deleted.');
                        return;
                      }
                      if (window.confirm(`Are you sure you want to delete ${eligibleToDelete.length} draft GRN(s)?`)) {
                        eligibleToDelete.forEach(id => {
                          fetch(`/api/grns/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
                        });
                        setGrnList(prev => prev.filter(g => !eligibleToDelete.includes(g.id)));
                        setSelectedGrnRows([]);
                      }
                    }}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      color: '#DC2626',
                      borderRadius: '10px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                  >
                    <Trash2 size={14} style={{ color: '#DC2626' }} /> Delete
                  </button>

                  <button
                    onClick={() => setSelectedGrnRows([])}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Deselect all"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (() => {
            // Calculation of Totals
            const totalOrdered = grnItems.reduce((acc, it) => acc + it.ordered, 0);
            const totalPrev = grnItems.reduce((acc, it) => acc + it.prev, 0);
            const totalNow = grnItems.reduce((acc, it) => acc + Number(it.now || 0), 0);
            const totalAccepted = grnItems.reduce((acc, it) => acc + Number(it.accepted || 0), 0);
            const totalRejected = grnItems.reduce((acc, it) => acc + Number(it.rejected || 0), 0);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Form Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#0F172A' }}>
                      {isViewOnlyMode ? 'View Goods Receipt Note (GRN)' : (editingGrnId ? `Edit Draft (${editingGrnId})` : 'New Goods Receipt Note (GRN)')}
                    </h2>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {isViewOnlyMode ? 'Viewing recorded goods receipt details (Read Only)' : 'Record goods received against a Purchase Order'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => {
                        setShowCreateGRN(false);
                        resetCreateGRNForm();
                      }}
                      style={{
                        height: '38px',
                        padding: '0 20px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#334155',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {isViewOnlyMode ? 'Back to List' : 'Cancel'}
                    </button>
                    {!isViewOnlyMode && (
                      <>
                        <button
                          onClick={handleSaveAndReceive}
                          style={{
                            height: '38px',
                            padding: '0 16px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#2563EB',
                            color: '#FFFFFF',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Save & Receive
                        </button>
                        <button
                          onClick={handleFullyReceived}
                          title="Mark all items as received, close GRN, and close PO in Zoho Books"
                          style={{
                            height: '38px',
                            padding: '0 18px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#16a34a',
                            color: '#FFFFFF',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
                          }}
                        >
                          <CheckCircle style={{ width: '16px', height: '16px' }} />
                          Fully Received
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Form Body layout */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px' }}>

                  {/* Card 1: 1. GRN Information (Span 6) */}
                  <div className="section-card" style={{ gridColumn: 'span 6', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '14px', color: '#2563EB' }}>1. GRN Information</strong>
                      <HelpCircle style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                    </div>

                    {/* Row 1: GRN No, Receipt Date, Purchase Order */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>GRN No.</label>
                        <input type="text" value="GRN-2026-000124" disabled style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#F8FAFC', color: '#64748B' }} />
                        <span style={{ fontSize: '10px', color: '#94A3B8' }}>Auto-generated</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>
                          Receipt Date <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input type="date" defaultValue={new Date().toISOString().split('T')[0]} style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#FFFFFF', color: '#334155' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>
                          Purchase Order <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <select
                          value={selectedGRNPo}
                          disabled={isViewOnlyMode}
                          onChange={(e) => {
                            const poNo = e.target.value;
                            loadPOItems(poNo);
                          }}
                          style={{ height: '38px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '12px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF', color: '#334155', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                        >
                          {(() => {
                            const eligiblePOs = livePOs.filter(po => {
                              const isSelected = po.poNo === selectedGRNPo || po.id === selectedGRNPo;
                              const s = String(po.status || '').toUpperCase();
                              const sType = String(po.statusType || '').toLowerCase();

                              const isClosed = s.includes('CLOSED') || s.includes('FULLY RECEIVED') || sType === 'closed';
                              if (isClosed && !isSelected) return false;

                              // Strictly only POs that reached "Proceed PO" or are already partially received in GRN
                              const isProceedPo = s === 'PROCEED PO' || sType === 'proceed_po';
                              const isPartiallyReceived = s.includes('PARTIALLY') || sType === 'partially_received';

                              return isSelected || isProceedPo || isPartiallyReceived;
                            });

                            const hasSelected = eligiblePOs.some(p => p.poNo === selectedGRNPo || p.id === selectedGRNPo);
                            const displayList = (!hasSelected && selectedGRNPo)
                              ? [{ poNo: selectedGRNPo, id: selectedGRNPo, vendor: selectedGRNVendor || 'Vendor', status: 'Proceed PO' }, ...eligiblePOs]
                              : eligiblePOs;

                            return (
                              <>
                                <option value="" disabled>Select Purchase Order ({displayList.length} Proceeded / Partial POs)</option>
                                {displayList.map((po) => (
                                  <option key={po.id || po.poNo} value={po.poNo || po.id}>
                                    {po.poNo} — {po.vendor && po.vendor.length > 20 ? po.vendor.substring(0, 20) + '...' : (po.vendor || 'Vendor')} ({po.status})
                                  </option>
                                ))}
                              </>
                            );
                          })()}
                        </select>
                      </div>
                    </div>

                    {/* Row 2: Vendor, Warehouse / Location */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>
                          Vendor <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={selectedGRNVendor || ''}
                          placeholder="Auto-populated from PO"
                          style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#F8FAFC', color: '#334155', fontWeight: '600' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>
                          Warehouse / Location <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <select disabled={isViewOnlyMode} defaultValue="VRM Structures" style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF', color: '#334155' }}>
                          <option value="" disabled>Select Warehouse / Location</option>
                          <option value="VRM Structures">VRM Structures</option>
                          <option value="Stock Area">Stock Area</option>
                        </select>
                      </div>
                    </div>

                    {/* Row 3: Delivery Challan No, Challan Date, Received By */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>
                          DC NO / Invoice No. <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Enter DC NO / Invoice No."
                          value={grnChallanNo}
                          disabled={isViewOnlyMode}
                          onChange={(e) => setGrnChallanNo(e.target.value)}
                          style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF', color: '#334155' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>Challan Date</label>
                        <input type="date" disabled={isViewOnlyMode} defaultValue={new Date().toISOString().split('T')[0]} style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF', color: '#334155' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B' }}>
                          Received By <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={grnReceivedBy}
                          disabled={isViewOnlyMode}
                          placeholder="Enter receiver name"
                          onChange={(e) => setGrnReceivedBy(e.target.value)}
                          style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF', color: '#334155' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: 2. Purchase Order Summary & Receiving History (Span 6) */}
                  <div className="section-card" style={{ gridColumn: 'span 6', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px', color: '#2563EB' }}>2. Purchase Order Summary</strong>
                      {selectedGRNPo && (
                        <button
                          type="button"
                          onClick={() => onChangeTab('Purchase Orders', selectedGRNPo)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid #E2E8F0',
                            backgroundColor: '#FFFFFF',
                            color: '#2563EB',
                            fontSize: '11px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          View PO
                          <ExternalLink style={{ width: '10px', height: '10px' }} />
                        </button>
                      )}
                    </div>

                    {!selectedGRNPo ? (
                      <div style={{ padding: '24px 12px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                        Select a Purchase Order to load order details and line items.
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const totOrd = grnItems.reduce((acc, curr) => acc + (curr.ordered || 0), 0);
                          const totPrev = grnItems.reduce((acc, curr) => acc + (curr.prev || 0), 0);
                          const totNow = grnItems.reduce((acc, curr) => acc + (curr.now || 0), 0);
                          const totRemaining = Math.max(0, totOrd - totPrev - totNow);
                          const pct = totOrd > 0 ? (((totPrev + totNow) / totOrd) * 100).toFixed(1) : 0;

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <strong style={{ fontSize: '16px', color: '#0F172A' }}>{selectedGRNPo}</strong>
                                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{selectedGRNVendor || 'Vendor'}</div>
                                </div>
                                <span style={{
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  fontSize: '10px',
                                  fontWeight: '800',
                                  backgroundColor: totPrev + totNow >= totOrd && totOrd > 0 ? '#E6F7ED' : '#FEF3C7',
                                  color: totPrev + totNow >= totOrd && totOrd > 0 ? '#137333' : '#D97706'
                                }}>
                                  {totPrev + totNow >= totOrd && totOrd > 0 ? 'CLOSED / FULLY RECEIVED' : (totPrev > 0 ? 'OPEN / PARTIALLY RECEIVED' : 'OPEN')}
                                </span>
                              </div>

                              {/* Receiving Progress Bar */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '700' }}>
                                  <span style={{ color: '#475569' }}>Receiving Progress</span>
                                  <span style={{ color: '#2563EB' }}>{totPrev + totNow} / {totOrd} Received ({pct}%)</span>
                                </div>
                                <div style={{ height: '6px', width: '100%', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, backgroundColor: '#2563EB', transition: 'width 0.3s' }}></div>
                                </div>
                              </div>

                              {/* Quantitative Summary */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
                                <div style={{ backgroundColor: '#F1F5F9', padding: '6px 4px', borderRadius: '6px' }}>
                                  <span style={{ fontSize: '9px', color: '#64748B', display: 'block', fontWeight: 'bold' }}>Ordered</span>
                                  <strong style={{ fontSize: '12px', color: '#0F172A' }}>{totOrd}</strong>
                                </div>
                                <div style={{ backgroundColor: '#F1F5F9', padding: '6px 4px', borderRadius: '6px' }}>
                                  <span style={{ fontSize: '9px', color: '#64748B', display: 'block', fontWeight: 'bold' }}>Previous</span>
                                  <strong style={{ fontSize: '12px', color: '#64748B' }}>{totPrev}</strong>
                                </div>
                                <div style={{ backgroundColor: '#EFF6FF', padding: '6px 4px', borderRadius: '6px', border: '1px solid #DBEAFE' }}>
                                  <span style={{ fontSize: '9px', color: '#2563EB', display: 'block', fontWeight: 'bold' }}>This GRN</span>
                                  <strong style={{ fontSize: '12px', color: '#2563EB' }}>+{totNow}</strong>
                                </div>
                                <div style={{ backgroundColor: totRemaining === 0 ? '#E6F7ED' : '#FEF2F2', padding: '6px 4px', borderRadius: '6px' }}>
                                  <span style={{ fontSize: '9px', color: totRemaining === 0 ? '#137333' : '#DC2626', display: 'block', fontWeight: 'bold' }}>Remaining</span>
                                  <strong style={{ fontSize: '12px', color: totRemaining === 0 ? '#137333' : '#DC2626' }}>{totRemaining}</strong>
                                </div>
                              </div>

                              {/* Previous GRN History List */}
                              {poReceivingHistory.length > 0 && (
                                <div style={{ marginTop: '4px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '6px' }}>
                                    Previous GRN History ({poReceivingHistory.length})
                                  </span>
                                  <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {poReceivingHistory.map((g, idx) => (
                                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', padding: '4px 8px', backgroundColor: '#F8FAFC', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                                        <span style={{ fontWeight: 'bold', color: '#2563EB' }}>{g.grnNo}</span>
                                        <span style={{ color: '#64748B' }}>{g.date}</span>
                                        <span style={{ fontWeight: 'bold', color: '#137333' }}>+{g.receivedQty || 0} Qty</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>

                  {/* Card 3: 3. GRN Summary & Received Items (Span 12 Full Width Below) */}
                  <div className="section-card" style={{ gridColumn: 'span 12', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '14px', color: '#2563EB' }}>3. GRN Summary & Received Items</strong>
                      <HelpCircle style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                    </div>

                    <div style={{ overflowX: 'auto', flex: 1 }}>
                      <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid #F1F5F9' }}>
                            <th style={{ padding: '8px 2px', color: '#64748B' }}>#</th>
                            <th style={{ padding: '8px 4px', color: '#64748B', width: '320px' }}>Item / Material & Description</th>
                            <th style={{ padding: '8px 4px', color: '#64748B', textAlign: 'center' }}>UOM</th>
                            <th style={{ padding: '8px 4px', color: '#64748B', textAlign: 'center' }}>Ordered Qty</th>
                            <th style={{ padding: '8px 4px', color: '#64748B', textAlign: 'center' }}>Previously Received</th>
                            <th style={{ padding: '8px 4px', color: '#64748B', textAlign: 'center' }}>Receiving Now *</th>
                            <th style={{ padding: '8px 4px', color: '#64748B', textAlign: 'center' }}>Accepted Qty</th>
                            <th style={{ padding: '8px 4px', color: '#64748B', textAlign: 'center' }}>Rejected Qty</th>
                            <th style={{ padding: '8px 4px', color: '#64748B' }}>Reason for Rejection</th>
                            <th style={{ padding: '8px 2px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {grnItems.length === 0 ? (
                            <tr>
                              <td colSpan="11" style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                                No items loaded. Select a Purchase Order to display its line items for receipt entry.
                              </td>
                            </tr>
                          ) : (
                            grnItems.map((item, idx) => (
                              <tr key={item.id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                                <td style={{ padding: '10px 4px', color: '#94A3B8', verticalAlign: 'top', paddingTop: '16px' }}>{idx + 1}</td>
                                <td style={{ padding: '10px 4px', fontWeight: '600', color: '#0F172A', minWidth: '280px', verticalAlign: 'top' }}>
                                  <input
                                    type="text"
                                    list={`grn-item-datalist-${item.id}`}
                                    value={item.name}
                                    disabled={isViewOnlyMode}
                                    placeholder="Type or select Item Name..."
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const matched = (itemsList || []).find(it => (it.name || '').toLowerCase() === val.toLowerCase());
                                      const updated = grnItems.map(it => it.id === item.id ? {
                                        ...it,
                                        name: val,
                                        uom: matched ? (matched.unit || matched.uom || it.uom) : it.uom,
                                        desc: matched ? (matched.description || it.desc) : it.desc
                                      } : it);
                                      setGrnItems(updated);
                                    }}
                                    style={{ width: '100%', height: '34px', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '0 10px', fontSize: '12px', fontWeight: '700', color: '#0F172A', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF' }}
                                  />
                                  <datalist id={`grn-item-datalist-${item.id}`}>
                                    {(itemsList || []).map((prod, pidx) => (
                                      <option key={pidx} value={prod.name}>
                                        {prod.code ? `[${prod.code}] ${prod.name}` : prod.name}
                                      </option>
                                    ))}
                                  </datalist>
                                  <div style={{ marginTop: '6px' }}>
                                    <textarea
                                      value={item.desc || ''}
                                      disabled={isViewOnlyMode}
                                      placeholder="Enter Item / Material Description..."
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const updated = grnItems.map(it => it.id === item.id ? { ...it, desc: val } : it);
                                        setGrnItems(updated);
                                      }}
                                      style={{
                                        width: '100%',
                                        minHeight: '54px',
                                        border: '1px solid #CBD5E1',
                                        borderRadius: '6px',
                                        padding: '6px 10px',
                                        fontSize: '11px',
                                        color: '#334155',
                                        resize: 'vertical',
                                        boxSizing: 'border-box',
                                        backgroundColor: '#F8FAFC',
                                        lineHeight: '1.4'
                                      }}
                                    />
                                  </div>
                                </td>
                                <td style={{ padding: '10px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                                  <input
                                    type="text"
                                    value={item.uom}
                                    disabled={isViewOnlyMode}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updated = grnItems.map(it => it.id === item.id ? { ...it, uom: val } : it);
                                      setGrnItems(updated);
                                    }}
                                    style={{ width: '50px', height: '34px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '11px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF' }}
                                  />
                                </td>
                                <td style={{ padding: '10px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                                  <input
                                    type="number"
                                    value={item.ordered}
                                    disabled={isViewOnlyMode}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      const updated = grnItems.map(it => it.id === item.id ? { ...it, ordered: val } : it);
                                      setGrnItems(updated);
                                    }}
                                    style={{ width: '55px', height: '34px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '11px', fontWeight: '600', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF' }}
                                  />
                                </td>
                                <td style={{ padding: '10px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                                  <input
                                    type="number"
                                    value={item.prev}
                                    disabled={isViewOnlyMode}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      const updated = grnItems.map(it => it.id === item.id ? { ...it, prev: val } : it);
                                      setGrnItems(updated);
                                    }}
                                    style={{ width: '55px', height: '34px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '11px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF' }}
                                  />
                                </td>
                                <td style={{ padding: '10px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <input
                                      type="number"
                                      value={item.now}
                                      disabled={isViewOnlyMode}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        const maxAllowed = Math.max(0, item.ordered - item.prev);
                                        const hasErr = val > maxAllowed;
                                        const updated = grnItems.map(it => it.id === item.id ? {
                                          ...it,
                                          now: val,
                                          accepted: val - (it.rejected || 0),
                                          error: hasErr ? `Exceeds remaining PO quantity of ${maxAllowed}` : null
                                        } : it);
                                        setGrnItems(updated);
                                      }}
                                      style={{
                                        width: '65px',
                                        height: '34px',
                                        border: item.error ? '1.5px solid #DC2626' : '1px solid #CBD5E1',
                                        borderRadius: '6px',
                                        textAlign: 'center',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        backgroundColor: item.error ? '#FEF2F2' : (isViewOnlyMode ? '#F8FAFC' : '#FFFFFF'),
                                        color: item.error ? '#DC2626' : '#0F172A'
                                      }}
                                    />
                                    {item.error && (
                                      <span style={{ fontSize: '8px', color: '#DC2626', fontWeight: 'bold', marginTop: '2px', lineHeight: '1' }}>
                                        Max {item.ordered - item.prev}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '10px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                                  <input
                                    type="number"
                                    value={item.accepted}
                                    disabled={isViewOnlyMode}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      const updated = grnItems.map(it => it.id === item.id ? { ...it, accepted: val, rejected: it.now - val } : it);
                                      setGrnItems(updated);
                                    }}
                                    style={{ width: '55px', height: '34px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '11px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF' }}
                                  />
                                </td>
                                <td style={{ padding: '10px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                                  <input
                                    type="number"
                                    value={item.rejected}
                                    disabled={isViewOnlyMode}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      const updated = grnItems.map(it => it.id === item.id ? { ...it, rejected: val, accepted: it.now - val } : it);
                                      setGrnItems(updated);
                                    }}
                                    style={{ width: '55px', height: '34px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '11px', color: item.rejected > 0 ? '#C5221F' : '#334155', fontWeight: item.rejected > 0 ? 'bold' : 'normal', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF' }}
                                  />
                                </td>
                                <td style={{ padding: '10px 4px', verticalAlign: 'top' }}>
                                  <select
                                    value={item.reason}
                                    disabled={isViewOnlyMode}
                                    onChange={(e) => {
                                      const updated = grnItems.map(it => it.id === item.id ? { ...it, reason: e.target.value } : it);
                                      setGrnItems(updated);
                                    }}
                                    style={{ height: '34px', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '11px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF', padding: '0 6px' }}
                                  >
                                    <option>—</option>
                                    <option>Damaged</option>
                                    <option>Thread Issue</option>
                                    <option>Wrong Specs</option>
                                  </select>
                                </td>
                                <td style={{ padding: '10px 4px', verticalAlign: 'top' }}>
                                  <input
                                    type="text"
                                    value={item.batch}
                                    disabled={isViewOnlyMode}
                                    onChange={(e) => {
                                      const updated = grnItems.map(it => it.id === item.id ? { ...it, batch: e.target.value } : it);
                                      setGrnItems(updated);
                                    }}
                                    style={{ width: '90px', height: '34px', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '0 8px', fontSize: '11px', backgroundColor: isViewOnlyMode ? '#F8FAFC' : '#FFFFFF' }}
                                  />
                                </td>
                                <td style={{ padding: '10px 2px', textAlign: 'center', verticalAlign: 'top', paddingTop: '14px' }}>
                                  {!isViewOnlyMode && (
                                    <button
                                      type="button"
                                      title="Delete Item"
                                      onClick={() => {
                                        setGrnItems(grnItems.filter(it => it.id !== item.id));
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#EF4444',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: '4px'
                                      }}
                                    >
                                      <Trash2 style={{ width: '15px', height: '15px' }} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )))}

                        </tbody>
                      </table>
                    </div>

                    {/* Anchored Footer Section with Total Row & Add Button */}
                    <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <tbody>
                            <tr style={{ backgroundColor: '#F8FAFC', fontWeight: 'bold' }}>
                              <td colSpan="3" style={{ padding: '10px 4px', fontSize: '12px' }}>Total</td>
                              <td style={{ padding: '10px 4px', textAlign: 'center' }}>{totalOrdered}</td>
                              <td style={{ padding: '10px 4px', textAlign: 'center', color: '#64748B' }}>{totalPrev}</td>
                              <td style={{ padding: '10px 4px', textAlign: 'center' }}>{totalNow}</td>
                              <td style={{ padding: '10px 4px', textAlign: 'center', color: '#137333' }}>{totalAccepted}</td>
                              <td style={{ padding: '10px 4px', textAlign: 'center', color: '#C5221F' }}>{totalRejected}</td>
                              <td colSpan="3"></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {!isViewOnlyMode && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const newItem = {
                                id: `NEW-ITEM-${Date.now()}`,
                                name: 'Additional Material / Item',
                                desc: 'Custom ad-hoc line item',
                                sku: 'SKU-NEW',
                                uom: 'NOS',
                                ordered: 0,
                                prev: 0,
                                now: 1,
                                accepted: 1,
                                rejected: 0,
                                reason: '—',
                                batch: 'LOT-NEW'
                              };
                              setGrnItems([...grnItems, newItem]);
                            }}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFFFFF',
                              color: '#2563EB',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            + Add Additional Item
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 4: 4. Documents (Span 6) */}
                  <div className="section-card" style={{ gridColumn: 'span 6', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '14px', color: '#2563EB' }}>
                        4. Documents <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                      </strong>
                      <HelpCircle style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                      {grnDocs.map((doc, idx) => (
                        <div key={idx} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: '#FFFFFF' }}>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748B' }}>{doc.title}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText style={{ width: '24px', height: '24px', color: '#10B981' }} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span
                                onClick={() => setActiveDocPreviewModal({
                                  title: doc.title || 'Document Preview',
                                  filename: doc.filename,
                                  url: doc.url
                                })}
                                style={{ fontSize: '11px', fontWeight: '600', color: '#2563EB', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', textDecoration: 'underline' }}
                                title="Click to view document"
                              >
                                {doc.filename}
                              </span>
                              <span style={{ fontSize: '9px', color: '#94A3B8' }}>{doc.size}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', marginTop: '4px', borderTop: '1px solid #F1F5F9', paddingTop: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <span
                              onClick={() => setActiveDocPreviewModal({
                                title: doc.title || 'Document Preview',
                                filename: doc.filename,
                                url: doc.url
                              })}
                              style={{ fontSize: '11px', color: '#2563EB', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye style={{ width: '14px', height: '14px', color: '#2563EB' }} /> View
                            </span>
                            {!isViewOnlyMode && (
                              <Trash2
                                onClick={() => setDeleteDocConfirmIdx(idx)}
                                style={{ width: '14px', height: '14px', color: '#EF4444', cursor: 'pointer' }}
                              />
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Document Delete Confirmation Modal */}
                      {deleteDocConfirmIdx !== null && (
                        <div style={{
                          position: 'fixed',
                          top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          backdropFilter: 'blur(4px)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 99999
                        }}>
                          <div style={{
                            backgroundColor: '#FFFFFF',
                            borderRadius: '16px',
                            padding: '24px',
                            width: '420px',
                            maxWidth: '90%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <AlertTriangle style={{ width: '22px', height: '22px', color: '#EF4444' }} />
                              </div>
                              <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#0F172A' }}>Confirm Document Deletion</h3>
                                <span style={{ fontSize: '12px', color: '#64748B' }}>Action cannot be undone</span>
                              </div>
                            </div>

                            <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                              Are you sure you want to delete the uploaded document <strong>"{grnDocs[deleteDocConfirmIdx]?.filename || 'Attachment'}"</strong>?
                            </p>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                              <button
                                onClick={() => setDeleteDocConfirmIdx(null)}
                                style={{ height: '36px', padding: '0 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  setGrnDocs(grnDocs.filter((_, i) => i !== deleteDocConfirmIdx));
                                  setDeleteDocConfirmIdx(null);
                                }}
                                style={{ height: '36px', padding: '0 18px', borderRadius: '8px', border: 'none', backgroundColor: '#EF4444', color: '#FFFFFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                              >
                                Yes, Delete Document
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Upload Box (Only available in Edit / Create mode) */}
                      {!isViewOnlyMode && (
                        <label
                          style={{ border: '2px dashed #CBD5E1', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', backgroundColor: '#F8FAFC', cursor: 'pointer', transition: 'border-color 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563EB'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = '#CBD5E1'}
                        >
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              if (files.length > 0) {
                                const names = ['Delivery Challan *', 'Invoice', 'Inspection Report', 'Additional Document'];
                                const newDocs = files.map((file, i) => {
                                  const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
                                  const title = names[grnDocs.length + i] || `Attachment ${grnDocs.length + i + 1}`;
                                  let blobUrl = '';
                                  try {
                                    blobUrl = URL.createObjectURL(file);
                                  } catch (err) { }
                                  return {
                                    title,
                                    filename: file.name,
                                    size: `${sizeMB} MB`,
                                    url: blobUrl,
                                    fileObj: file
                                  };
                                });
                                setGrnDocs(prev => [...prev, ...newDocs]);
                              }
                              e.target.value = '';
                            }}
                          />
                          <UploadCloud style={{ width: '20px', height: '20px', color: '#2563EB' }} />
                          <span style={{ fontSize: '11px', color: '#2563EB', fontWeight: 'bold' }}>+ Upload File</span>
                          <span style={{ fontSize: '8px', color: '#94A3B8', textAlign: 'center' }}>PDF, JPG, PNG (Max 10MB)</span>
                        </label>
                      )}
                    </div>

                    {/* Section: Previously Uploaded Documents for this PO */}
                    {!isViewOnlyMode && !editingGrnId && poReceivingHistory && poReceivingHistory.length > 0 && (
                      <div style={{ marginTop: '16px', borderTop: '1px dashed #CBD5E1', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FileText style={{ width: '15px', height: '15px', color: '#2563EB' }} />
                          Previously Uploaded Documents for PO ({selectedGRNPo})
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '10px' }}>
                          {poReceivingHistory.map((prevGrn, pIdx) => {
                            const firstDoc = (prevGrn.documents && prevGrn.documents.length > 0) ? prevGrn.documents[0] : null;
                            const docUrl = firstDoc ? firstDoc.url : prevGrn.docUrl;

                            return (
                              <div key={pIdx} style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#334155' }}>{prevGrn.grnNo} — DC: {prevGrn.challanNo || 'N/A'}</div>
                                  <div style={{ fontSize: '9px', color: '#64748B' }}>Received Date: {prevGrn.date || '—'} | Qty Accepted: {prevGrn.acceptedQty || 0}</div>
                                </div>
                                <span
                                  onClick={() => setActiveDocPreviewModal({
                                    title: `Previous Receipt: ${prevGrn.grnNo}`,
                                    filename: `Delivery Challan: ${prevGrn.challanNo || 'N/A'}`,
                                    url: docUrl,
                                    details: prevGrn
                                  })}
                                  style={{ fontSize: '11px', color: '#2563EB', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <Eye style={{ width: '14px', height: '14px', color: '#2563EB' }} /> View
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card 5: 5. GRN Summary (Span 6 - Same line beside Documents) */}
                  <div className="section-card" style={{ gridColumn: 'span 6', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ fontSize: '14px', color: '#2563EB' }}>5. GRN Summary</strong>
                      <HelpCircle style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                    </div>

                    {(() => {
                      const totOrd = grnItems.reduce((acc, curr) => acc + (curr.ordered || 0), 0);
                      const totNow = grnItems.reduce((acc, curr) => acc + (curr.now || 0), 0);
                      const totAccepted = grnItems.reduce((acc, curr) => acc + (curr.accepted || 0), 0);
                      const totRejected = grnItems.reduce((acc, curr) => acc + (curr.rejected || 0), 0);

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ color: '#64748B', fontWeight: '600' }}>GRN Status:</span>
                              <strong style={{ color: '#2563EB' }}>{totNow > 0 ? 'DRAFT / READY TO SUBMIT' : 'PENDING ITEM ENTRY'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ color: '#64748B', fontWeight: '600' }}>Receiving PO Reference:</span>
                              <strong style={{ color: '#0F172A' }}>{selectedGRNPo || '—'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ color: '#64748B', fontWeight: '600' }}>Vendor Name:</span>
                              <strong style={{ color: '#0F172A' }}>{selectedGRNVendor || '—'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                              <span style={{ color: '#64748B', fontWeight: '600' }}>Delivery Challan / Invoice:</span>
                              <strong style={{ color: '#0F172A' }}>{grnChallanNo || '—'}</strong>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
                            <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #DBEAFE', padding: '10px 6px', borderRadius: '8px' }}>
                              <span style={{ fontSize: '10px', color: '#2563EB', display: 'block', fontWeight: 'bold' }}>Total Receiving Now</span>
                              <strong style={{ fontSize: '15px', color: '#2563EB' }}>{totNow}</strong>
                            </div>
                            <div style={{ backgroundColor: '#E6F7ED', border: '1px solid #BBF7D0', padding: '10px 6px', borderRadius: '8px' }}>
                              <span style={{ fontSize: '10px', color: '#137333', display: 'block', fontWeight: 'bold' }}>Total Accepted</span>
                              <strong style={{ fontSize: '15px', color: '#137333' }}>{totAccepted}</strong>
                            </div>
                            <div style={{ backgroundColor: totRejected > 0 ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${totRejected > 0 ? '#FECACA' : '#E2E8F0'}`, padding: '10px 6px', borderRadius: '8px' }}>
                              <span style={{ fontSize: '10px', color: totRejected > 0 ? '#C5221F' : '#64748B', display: 'block', fontWeight: 'bold' }}>Total Rejected</span>
                              <strong style={{ fontSize: '15px', color: totRejected > 0 ? '#C5221F' : '#64748B' }}>{totRejected}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>



                  {/* Inline Document Preview Modal */}
                  {activeDocPreviewModal && (
                    <div style={{
                      position: 'fixed',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: 'rgba(15, 23, 42, 0.75)',
                      backdropFilter: 'blur(6px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 999999
                    }}>
                      <div style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '16px',
                        width: '900px',
                        maxWidth: '94%',
                        height: '85vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        overflow: 'hidden'
                      }}>
                        {/* Header */}
                        <div style={{ padding: '16px 24px', backgroundColor: '#0F172A', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <FileText style={{ width: '20px', height: '20px', color: '#38BDF8' }} />
                            <div>
                              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>{activeDocPreviewModal.title || 'Document Viewer'}</h3>
                              <span style={{ fontSize: '11px', color: '#94A3B8' }}>{activeDocPreviewModal.filename || 'Uploaded Document'}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => setActiveDocPreviewModal(null)}
                            style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '22px', cursor: 'pointer', padding: '4px', lineHeight: 1 }}
                          >
                            ✕
                          </button>
                        </div>

                        {/* Body */}
                        <div style={{ flex: 1, backgroundColor: '#F8FAFC', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
                          {activeDocPreviewModal.url ? (
                            activeDocPreviewModal.url.startsWith('data:image') ? (
                              <img src={activeDocPreviewModal.url} alt="Document Preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                            ) : (
                              <iframe src={activeDocPreviewModal.url} title="Document Preview" style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }} />
                            )
                          ) : (
                            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', maxWidth: '480px' }}>
                              <FileText style={{ width: '48px', height: '48px', color: '#2563EB', margin: '0 auto 12px' }} />
                              <h4 style={{ margin: '0 0 6px', color: '#0F172A', fontSize: '16px' }}>Receipt Record</h4>
                              <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 12px' }}>
                                Reference: <strong>{activeDocPreviewModal.details?.grnNo}</strong> | Delivery Challan: <strong>{activeDocPreviewModal.details?.challanNo || 'N/A'}</strong>
                              </p>
                              <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', justifyContent: 'center', gap: '16px', borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
                                <span>Date: <strong>{activeDocPreviewModal.details?.date || '—'}</strong></span>
                                <span>Accepted Qty: <strong>{activeDocPreviewModal.details?.acceptedQty || 0}</strong></span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}



                </div>

              </div>
            );
          })()}
        </div>
      )}

      {/* ==================== 6. PAYMENTS SCREEN ==================== */}
    </div>
  );
}
