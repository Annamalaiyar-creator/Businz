import GrnInwardingFormCards from "../inventory/GrnInwardingFormCards";
import GrnTableSection from '../inventory/GrnTableSection';
import GrnPoDetailModal from '../inventory/GrnPoDetailModal';
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
import ModernDateRangePicker from '../ModernDateRangePicker';
import { getPurchaseOrders, getVendors, getItems, savePurchaseOrder } from '../../services/businzDataService';
import { getCompanyProfile } from '../PurchaseOrdersView';
import { notifyGrnCompletedToAccounts } from '../../services/notificationService';
import { fetchCloudStore, saveCloudStore, saveCloudStoreImmediate, subscribeToCloudStore } from '../../utils/supabaseDataSync';
import { saveMediaToCache, getMediaFromCache, stripDataUrlsFromRecord, readCompressedImage, compressAndSaveFile } from '../../utils/otherViewsShared';
import { getNextSequence } from '../../utils/sequenceGenerator';
import { CODE_TO_SALES_NAME } from '../pi/piHelpers';



export const computeGrnValue = (g, livePOs = []) => {
  if (!g) return '—';

  // 1. If GRN already has items with rates, calculate exact accepted items value + tax
  if (Array.isArray(g.items) && g.items.length > 0) {
    let itemsVal = 0;
    let hasItemRates = false;
    g.items.forEach(it => {
      if (it.isPoReference) return;
      const qty = Number(it.accepted !== undefined && it.accepted !== '' ? it.accepted : (it.now !== undefined && it.now !== '' ? it.now : (it.receivedQty || 0)));
      const rate = Number(it.rate || it.price || it.unitPrice || 0);
      const taxPct = Number(it.tax !== undefined && it.tax !== '' ? it.tax : (it.gstRate || it.taxRate || 18));
      if (rate > 0) hasItemRates = true;
      const taxable = qty * rate;
      const tax = taxable * (taxPct / 100);
      itemsVal += (taxable + tax);
    });

    if (hasItemRates && itemsVal > 0) {
      return `₹ ${itemsVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  // 2. If PO reference exists, find the matching PO from livePOs or local storage cache
  const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
  const pRef = normalize(g.poRef || g.poNo || g.poId);

  let matchedPO = null;
  if (pRef) {
    matchedPO = (Array.isArray(livePOs) ? livePOs : []).find(p => {
      const pNo = normalize(p.poNo);
      const pId = normalize(p.id);
      const pZohoId = normalize(p.zohoId);
      return (pNo && pNo === pRef) || (pId && pId === pRef) || (pZohoId && pZohoId === pRef);
    });

    if (!matchedPO && typeof window !== 'undefined') {
      try {
        const rawSaved = localStorage.getItem('controlroom_po_store') || localStorage.getItem('purchase_orders_store');
        if (rawSaved) {
          const parsed = JSON.parse(rawSaved);
          if (Array.isArray(parsed)) {
            matchedPO = parsed.find(p => {
              const pNo = normalize(p.poNo);
              const pId = normalize(p.id);
              const pZohoId = normalize(p.zohoId);
              return (pNo && pNo === pRef) || (pId && pId === pRef) || (pZohoId && pZohoId === pRef);
            });
          }
        }
      } catch (_) {}
    }
  }

  if (matchedPO) {
    const poGrandTotal = Number(String(matchedPO.grandTotal || matchedPO.total || matchedPO.val || 0).replace(/[^0-9.]/g, ''));
    const isClosed = String(g.status || '').toUpperCase().includes('CLOSED') ||
                     String(g.status || '').toUpperCase().includes('FULLY') ||
                     String(matchedPO.status || '').toUpperCase().includes('CLOSED') ||
                     String(matchedPO.status || '').toUpperCase().includes('FULLY');

    // If fully received and PO grand total is known, GRN value strictly equals the PO grand total
    if (isClosed && poGrandTotal > 0) {
      return `₹ ${poGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Try calculating from matched PO line item rates
    if (Array.isArray(matchedPO.items) && matchedPO.items.length > 0) {
      let calcVal = 0;
      let matchedAnyRate = false;

      // Check if g.items can be matched with PO items
      if (Array.isArray(g.items) && g.items.length > 0) {
        g.items.forEach(git => {
          if (git.isPoReference) return;
          const gName = normalize(git.name || git.item);
          const poItem = matchedPO.items.find(pit => normalize(pit.name || pit.item_name || pit.item) === gName || normalize(pit.sku) === normalize(git.sku)) || matchedPO.items[0];
          if (poItem) {
            const rate = Number(poItem.rate || poItem.price || poItem.unitPrice || 0);
            const taxPct = Number(poItem.tax !== undefined && poItem.tax !== '' ? poItem.tax : (poItem.gstRate || poItem.taxRate || 18));
            const recQty = Number(git.accepted !== undefined && git.accepted !== '' ? git.accepted : (git.now || git.receivedQty || 0));
            if (rate > 0) matchedAnyRate = true;
            const taxable = recQty * rate;
            const tax = taxable * (taxPct / 100);
            calcVal += (taxable + tax);
          }
        });
      }

      if (matchedAnyRate && calcVal > 0) {
        return `₹ ${calcVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    }

    // If partial receipt but individual item rates are not mapped, proportionally calculate from PO Grand Total
    const totalOrd = Number(matchedPO.totalOrderedQty || matchedPO.totalOrdered || (Array.isArray(matchedPO.items) ? matchedPO.items.reduce((s, it) => s + Number(it.qty || it.quantity || 0), 0) : 0));
    const recCount = g.receivedQty !== undefined ? Number(g.receivedQty) : (Array.isArray(g.items) ? g.items.reduce((s, it) => s + Number(it.accepted !== undefined ? it.accepted : (it.now || 0)), 0) : 0);

    if (poGrandTotal > 0 && totalOrd > 0 && recCount > 0) {
      const proportional = (Math.min(recCount, totalOrd) / totalOrd) * poGrandTotal;
      return `₹ ${proportional.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    if (poGrandTotal > 0) {
      return `₹ ${poGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }

  // 3. Fallback: If g.val is already explicitly set and NOT the old dummy multiplier (receivedCount * 1250)
  const receivedCount = g.receivedQty !== undefined && g.receivedQty !== null
    ? Number(g.receivedQty)
    : (Array.isArray(g.items) ? g.items.reduce((s, it) => s + Number(it.accepted !== undefined ? it.accepted : (it.now || 0)), 0) : 0);

  const dummyVal1 = `₹ ${(receivedCount * 1250).toLocaleString('en-IN')}`;
  const dummyVal2 = `₹ ${receivedCount * 1250}`;

  if (g.val && typeof g.val === 'string' && g.val.startsWith('₹') && !g.val.includes('NaN')) {
    if (g.val !== dummyVal1 && g.val !== dummyVal2) {
      return g.val;
    }
  }

  return '—';
};

const formatGrnItem = (g, livePOs = []) => {
  if (!g) return null;
  const receivedCount = g.receivedQty !== undefined && g.receivedQty !== null
    ? Number(g.receivedQty)
    : (Array.isArray(g.items) ? g.items.reduce((s, it) => s + Number(it.accepted !== undefined ? it.accepted : (it.now || 0)), 0) : 0);

  const resolvedVal = computeGrnValue(g, livePOs);

  return {
    id: g.grnNo || g.id || '—',
    grnNo: g.grnNo || g.id || '—',
    poRef: g.poRef || g.poNo || '—',
    vendor: g.vendor || '—',
    date: g.date || '—',
    received: typeof g.received === 'string' && g.received.includes('Units') ? g.received : `${receivedCount} Units`,
    receivedQty: receivedCount,
    status: g.status || 'OPEN / PARTIALLY RECEIVED',
    val: resolvedVal,
    totalVal: resolvedVal,
    challanNo: g.challanNo || '',
    createdBy: g.createdBy || g.created_by || g.creator || '',
    receivedBy: g.receivedBy || '',
    inspectorName: g.inspectorName || '',
    inspectionRemarks: g.inspectionRemarks || '',
    documents: Array.isArray(g.documents) ? g.documents : [],
    items: Array.isArray(g.items) ? g.items : []
  };
};

export default function GoodsReceiptNoteView(props) {
  const {
    activeTab,
    onChangeTab,
    userRole = 'Sales Executive',
    convertingPiData = null,
    onClearConvertingPiData
  } = props;

  const effectiveRole = userRole || (typeof window !== 'undefined' ? localStorage.getItem('controlroom_user_role') : '') || '';
  const isAccountsUser = Boolean(
    effectiveRole === 'Accounts Head' ||
    effectiveRole === 'Accounts Executive' ||
    effectiveRole === 'Finance & Accounts' ||
    effectiveRole.toLowerCase().includes('account') ||
    effectiveRole.toLowerCase().includes('finance')
  );
  const isCeoLogin = Boolean(
    effectiveRole === 'CEO' ||
    effectiveRole === 'Managing Director' ||
    effectiveRole === 'MD' ||
    userRole === 'CEO' ||
    userRole === 'Managing Director' ||
    userRole === 'MD'
  );

  const getLoggedInUserName = () => {
    const curEmp = (typeof window !== 'undefined' ? localStorage.getItem('controlroom_logged_emp_id') : '')?.trim()?.toUpperCase();
    if (curEmp && CODE_TO_SALES_NAME[curEmp]) return CODE_TO_SALES_NAME[curEmp];
    const storedName = typeof window !== 'undefined' ? localStorage.getItem('controlroom_logged_user_name') : '';
    if (storedName && storedName !== 'undefined' && storedName !== 'null' && storedName.toLowerCase() !== 'vijay') return storedName;
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
    if (userRole === 'Production Head') return 'Senthil Kumar';
    if (userRole === 'Technical Administrator' || userRole === 'CEO' || userRole === 'Managing Director' || userRole === 'MD') return 'Annamalaiyar';
    if (userRole === 'Procurement Head' || userRole === 'Procurement Admin') return 'ARUN BOOPATHI M';
    if (userRole === 'Dispatch Head') return 'Kalpana';
    if (userRole === 'Floor Supervisor') return 'Floor Supervisor';
    if (userRole === 'Floor Employee') return 'Floor Employee';
    if (userRole === 'Accounts Head') return 'Venkatesh';
    return storedName || userRole || 'User';
  };

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
          return parsed.map(g => formatGrnItem(g, [])).filter(Boolean);
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

  const [showCeoGrnModal, setShowCeoGrnModal] = useState(false);
  const [selectedGrnForModal, setSelectedGrnForModal] = useState(null);
  const [showPoModal, setShowPoModal] = useState(false);
  const [selectedPoData, setSelectedPoData] = useState(null);
  const [previousGrnForBack, setPreviousGrnForBack] = useState(null);
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [challanDate, setChallanDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [grnCreatedBy, setGrnCreatedBy] = useState(() => getLoggedInUserName());
  const [grnReceivedBy, setGrnReceivedBy] = useState('');
  const [grnInspectorName, setGrnInspectorName] = useState('');
  const [grnInspectionRemarks, setGrnInspectionRemarks] = useState('');

  const [grnPage, setGrnPage] = useState(1);
  const [grnRowsPerPage, setGrnRowsPerPage] = useState(10);
  const [selectedGrnRows, setSelectedGrnRows] = useState([]);
  const [filterDate, setFilterDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [grnListStatusFilter, setGrnListStatusFilter] = useState('All');
  const [grnListActiveTab, setGrnListActiveTab] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reliable, multi-tiered fetch for GRNs: Supabase Cloud -> Local Express API -> LocalStorage
  const fetchAndSetGRNs = useCallback(async () => {
    try {
      // 1. Primary Source: Supabase Cloud Database (Leaves table 'GRN_STORE')
      const cloudGRNs = await fetchCloudStore('grn_store', []).catch(() => []);

      // 2. Auxiliary Source: Local Express API endpoint (/api/grns)
      let apiGRNs = [];
      try {
        const res = await fetch('/api/grns');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) apiGRNs = data;
        }
      } catch (_) {}

      // 3. Fallback Source: LocalStorage Cache
      let localGRNs = [];
      try {
        const saved = localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) localGRNs = parsed;
        }
      } catch (_) {}

      // 4. Merge and deduplicate across all sources
      const map = new Map();
      const addList = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach(item => {
          if (!item) return;
          const key = String(item.grnNo || item.id || '').trim().toUpperCase();
          if (key) {
            const existing = map.get(key) || {};
            map.set(key, { ...existing, ...item });
          }
        });
      };

      addList(localGRNs);
      addList(apiGRNs);
      addList(cloudGRNs);

      const allMerged = Array.from(map.values());
      if (allMerged.length > 0) {
        const formatted = allMerged.map(g => formatGrnItem(g, livePOs)).filter(Boolean);
        setGrnList(formatted);
        try {
          localStorage.setItem('controlroom_central_grns_v2', JSON.stringify(allMerged));
          localStorage.setItem('goods_receipt_notes', JSON.stringify(allMerged));
        } catch (_) {}
      }
    } catch (err) {
      console.error('Error fetching GRNs:', err);
    }
  }, [livePOs]);

  // Keep GRN values synchronized with live PO totals and line item rates
  useEffect(() => {
    if (Array.isArray(livePOs) && livePOs.length > 0) {
      setGrnList(prev => prev.map(g => formatGrnItem(g, livePOs)));
    }
  }, [livePOs]);

  const getEffectiveGrnStatus = useCallback((grn) => {
    if (!grn) return 'OPEN / PARTIALLY RECEIVED';
    const rawStatus = String(grn.status || '').trim();
    if (rawStatus.toUpperCase().includes('CLOSED') || rawStatus.toUpperCase().includes('FULLY') || grn.forceClosePO === true) {
      return 'CLOSED / FULLY RECEIVED';
    }
    const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const pRef = normalize(grn.poRef || grn.poNo || grn.poId);
    if (pRef) {
      const matchedPO = (livePOs || []).find(p => {
        const pNo = normalize(p.poNo);
        const pId = normalize(p.id);
        const pZohoId = normalize(p.zohoId);
        return pNo === pRef || pId === pRef || pZohoId === pRef;
      });
      if (matchedPO) {
        const isPoClosed = String(matchedPO.status || '').toUpperCase().includes('CLOSED') ||
                           String(matchedPO.status || '').toUpperCase().includes('FULLY') ||
                           matchedPO.statusType === 'closed' ||
                           matchedPO.order_status === 'closed' ||
                           (Number(matchedPO.totalOrderedQty) > 0 && Number(matchedPO.totalReceivedQty || matchedPO.totalReceived) >= Number(matchedPO.totalOrderedQty));
        if (isPoClosed) {
          return 'CLOSED / FULLY RECEIVED';
        }
      }
    }
    return rawStatus || 'OPEN / PARTIALLY RECEIVED';
  }, [livePOs]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchAndSetGRNs();
    await fetchLivePOs();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const handleOpenViewGrn = (row) => {
    resetCreateGRNForm();
    if (row.id || row.grnNo) setEditingGrnId(row.id || row.grnNo);
    setSelectedGrnForModal(row);
    if (row.date) setReceiptDate(row.date);
    if (row.challanDate) setChallanDate(row.challanDate);
    if (row.poRef) setSelectedGRNPo(row.poRef);
    if (row.vendor) setSelectedGRNVendor(row.vendor);
    if (row.challanNo) setGrnChallanNo(row.challanNo);
    setGrnCreatedBy(row.createdBy || row.created_by || row.creator || row.receivedBy || '—');
    if (row.receivedBy) setGrnReceivedBy(row.receivedBy);
    if (row.inspectorName) setGrnInspectorName(row.inspectorName);
    if (row.inspectionRemarks) setGrnInspectionRemarks(row.inspectionRemarks);
    if (row.items && Array.isArray(row.items) && row.items.length > 0) {
      setGrnItems(row.items);
    } else {
      const pMatch = (livePOs || []).find(p => p.poNo === row.poRef || p.id === row.poRef);
      if (pMatch && Array.isArray(pMatch.items) && pMatch.items.length > 0) {
        const recQty = Number(row.receivedQty || 0);
        const mapped = pMatch.items.map((it, idx) => {
          const ord = Number(it.qty !== undefined ? it.qty : (it.quantity || 0));
          const effectiveRec = recQty > 0 ? recQty : ord;
          return {
            id: it.id || `ITEM-${idx}`,
            name: it.name || it.item_name || 'Material Item',
            sku: it.sku || `SKU-${101 + idx}`,
            desc: it.description || it.desc || '',
            uom: it.unit || it.uom || 'NOS',
            ordered: ord,
            prev: 0,
            remaining: Math.max(0, ord - effectiveRec),
            now: effectiveRec,
            accepted: effectiveRec,
            rejected: 0,
            reason: '—',
            batch: it.batch || `LOT-2026-${idx + 1}`
          };
        });
        setGrnItems(mapped);
      } else {
        loadPOItems(row.poRef);
      }
    }
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
    if (isCeoLogin) {
      setSelectedGrnForModal(row);
      setShowCeoGrnModal(true);
    } else {
      setShowCreateGRN(true);
    }
  };

  const handleOpenEditGrn = (row) => {
    if (isAccountsUser) {
      handleOpenViewGrn(row);
      return;
    }
    resetCreateGRNForm();
    if (row.date) setReceiptDate(row.date);
    if (row.challanDate) setChallanDate(row.challanDate);
    if (row.poRef) setSelectedGRNPo(row.poRef);
    if (row.vendor) setSelectedGRNVendor(row.vendor);
    if (row.challanNo) setGrnChallanNo(row.challanNo);
    setGrnCreatedBy(row.createdBy || row.created_by || row.creator || row.receivedBy || '—');
    if (row.receivedBy) setGrnReceivedBy(row.receivedBy);
    if (row.inspectorName) setGrnInspectorName(row.inspectorName);
    if (row.inspectionRemarks) setGrnInspectionRemarks(row.inspectionRemarks);
    if (row.items && Array.isArray(row.items) && row.items.length > 0) {
      setGrnItems(row.items);
    } else {
      const pMatch = (livePOs || []).find(p => p.poNo === row.poRef || p.id === row.poRef);
      if (pMatch && Array.isArray(pMatch.items) && pMatch.items.length > 0) {
        const recQty = Number(row.receivedQty || 0);
        const mapped = pMatch.items.map((it, idx) => {
          const ord = Number(it.qty !== undefined ? it.qty : (it.quantity || 0));
          const effectiveRec = recQty > 0 ? recQty : ord;
          return {
            id: it.id || `ITEM-${idx}`,
            name: it.name || it.item_name || 'Material Item',
            sku: it.sku || `SKU-${101 + idx}`,
            desc: it.description || it.desc || '',
            uom: it.unit || it.uom || 'NOS',
            ordered: ord,
            prev: 0,
            remaining: Math.max(0, ord - effectiveRec),
            now: effectiveRec,
            accepted: effectiveRec,
            rejected: 0,
            reason: '—',
            batch: it.batch || `LOT-2026-${idx + 1}`
          };
        });
        setGrnItems(mapped);
      } else {
        loadPOItems(row.poRef);
      }
    }
    setEditingGrnId(row.id);
    setIsViewOnlyMode(false);
    setShowCreateGRN(true);
  };

  const handleOpenPoModal = (poNoOrId) => {
    const poRef = poNoOrId || selectedGRNPo;
    if (!poRef) return;

    if (selectedGrnForModal) {
      setPreviousGrnForBack(selectedGrnForModal);
    }

    setShowCeoGrnModal(false);
    setShowCreateGRN(false);

    const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const cleanRef = normalize(poRef);
    const matched = (livePOs || []).find(p => {
      const pNo = normalize(p.poNo);
      const pId = normalize(p.id);
      return cleanRef && (pNo === cleanRef || pId === cleanRef || (pNo && cleanRef.includes(pNo)) || (pId && cleanRef.includes(pId)));
    });

    const fallbackItems = (grnItems && grnItems.length > 0)
      ? grnItems.map(it => ({
          name: it.name,
          desc: it.desc,
          uom: it.uom,
          quantity: it.ordered || it.quantity || 1,
          rate: it.rate || 0,
          amount: (it.ordered || 1) * (it.rate || 0)
        }))
      : [];

    const initialPo = matched || {
      poNo: poRef,
      vendor: selectedGRNVendor || 'Vendor',
      date: new Date().toISOString().split('T')[0],
      items: fallbackItems
    };

    setSelectedPoData(initialPo);
    setShowPoModal(true);

    const targetId = matched?.id || matched?.poNo || poRef;
    fetch(`/api/purchaseorders/${encodeURIComponent(targetId)}`)
      .then(res => res.ok ? res.json() : null)
      .then(detail => {
        if (detail) {
          setSelectedPoData(prev => ({
            ...prev,
            ...detail,
            items: (detail.items && Array.isArray(detail.items) && detail.items.length > 0) ? detail.items : (prev?.items || fallbackItems)
          }));
        }
      })
      .catch(err => console.error('Error loading PO details for modal:', err));
  };

  const handleBackToGrn = () => {
    setShowPoModal(false);
    if (previousGrnForBack) {
      handleOpenViewGrn(previousGrnForBack);
    }
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
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setChallanDate(new Date().toISOString().split('T')[0]);
    setGrnCreatedBy(getLoggedInUserName());
    setGrnReceivedBy('');
    setGrnInspectorName('');
    setGrnInspectionRemarks('');
    setGrnItems([]);
    setPoReceivingHistory([]);
    setIsViewOnlyMode(isAccountsUser ? true : false);
    setEditingGrnId(null);
    setSelectedGrnForModal(null);
  };

  const inferInventoryType = (item = {}) => {
    const explicit = String(item.inventoryType || item.category || item.cat || '').trim().toLowerCase();
    if (explicit === 'finished goods' || explicit === 'finished good' || explicit === 'fg') return 'Finished Goods';
    if (explicit === 'raw material' || explicit === 'raw materials' || explicit === 'rm') return 'Raw Material';
    const matched = (itemsList || []).find(it => (it.name || '').toLowerCase() === String(item.name || '').toLowerCase());
    const mCat = String(matched?.category || matched?.cat || '').toLowerCase();
    if (mCat.includes('finished')) return 'Finished Goods';
    if (mCat.includes('raw')) return 'Raw Material';
    const n = String(item.name || '').toLowerCase();
    if (n.includes('coil') || n.includes('ingot') || n.includes('billet') || n.includes('mother length') || n.includes('raw')) {
      return 'Raw Material';
    }
    return 'Raw Material';
  };

  const mergePoReceivingHistory = (poRef, serverHistory = []) => {
    const norm = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const target = norm(poRef);
    let localGrns = [];
    try {
      const raw = localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes') || '[]';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localGrns = parsed;
    } catch (_) {}
    const combined = [...(Array.isArray(serverHistory) ? serverHistory : []), ...localGrns, ...(Array.isArray(grnList) ? grnList : [])];
    const seen = new Set();
    const matched = [];
    combined.forEach(g => {
      if (!g) return;
      const gPo = norm(g.poRef || g.poNo || g.poId);
      if (!target || !gPo || (gPo !== target && !gPo.includes(target) && !target.includes(gPo))) return;
      const key = String(g.grnNo || g.id || '').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      matched.push(g);
    });
    return matched;
  };

  // Helper to handle push to GRN transition
  const handlePendingPushToGrn = (currentPOs = livePOs) => {
    try {
      const memPush = window.__businzPendingPushToGrn || null;
      const pushPo = (memPush && memPush.poNo) || sessionStorage.getItem('controlroom_push_to_grn_po') || localStorage.getItem('controlroom_push_to_grn_po');
      const pushDataStr = sessionStorage.getItem('controlroom_push_to_grn_po_data') || localStorage.getItem('controlroom_push_to_grn_po_data');
      if (memPush || pushPo || pushDataStr) {
        try { delete window.__businzPendingPushToGrn; } catch (_) { window.__businzPendingPushToGrn = null; }
        try {
          sessionStorage.removeItem('controlroom_push_to_grn_po');
          sessionStorage.removeItem('controlroom_push_to_grn_po_data');
        } catch (_) {}
        try {
          localStorage.removeItem('controlroom_push_to_grn_po');
          localStorage.removeItem('controlroom_push_to_grn_po_data');
        } catch (_) {}
        resetCreateGRNForm();

        let poTarget = (memPush && memPush.poTarget) ? memPush.poTarget : null;
        if (!poTarget && pushDataStr) {
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
                rate: Number(it.rate !== undefined ? it.rate : (it.price !== undefined ? it.price : (it.unitPrice || it.unit_price || 0))),
                tax: Number(it.tax !== undefined ? it.tax : (it.taxRate || it.tax_rate || it.gstRate || it.gst_rate || 18)),
                ordered: ordered,
                prev: prev,
                remaining: remaining,
                now: remaining,
                accepted: remaining,
                rejected: 0,
                reason: '—',
                inventoryType: inferInventoryType(it),
                batch: it.batch || `LOT-2026-${idx + 1}`
              };
            });
            setGrnItems(initialItems);
          }
        }

        loadPOItems(poRef, currentPOs, true, poTarget);
        setIsViewOnlyMode(isAccountsUser ? true : false);
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
            rate: Number(it.rate !== undefined ? it.rate : (it.price !== undefined ? it.price : (it.unitPrice || it.unit_price || 0))),
            tax: Number(it.tax !== undefined ? it.tax : (it.taxRate || it.tax_rate || it.gstRate || it.gst_rate || 18)),
            ordered: ordered,
            prev: prev,
            remaining: remaining,
            now: remaining,
            accepted: remaining,
            rejected: 0,
            reason: '—',
            inventoryType: inferInventoryType(it),
            batch: it.batch || `LOT-2026-${idx + 1}`
          };
        });
        setGrnItems(initialItems);
      }
      loadPOItems(poRef, livePOs, true, poTarget);
      setIsViewOnlyMode(isAccountsUser ? true : false);
      setShowCreateGRN(true);
    };

    window.addEventListener('controlroom_push_to_grn', handlePushEvent);
    return () => window.removeEventListener('controlroom_push_to_grn', handlePushEvent);
  }, [livePOs]);

  // Fetch live Purchase Orders & stored GRNs for GRN selection and list display
  const fetchLivePOs = useCallback(async () => {
    try {
      const safePOs = await getPurchaseOrders();
      if (Array.isArray(safePOs) && safePOs.length > 0) {
        setLivePOs(safePOs);
        handlePendingPushToGrn(safePOs);
        return;
      }
    } catch (_) {}

    fetch('/api/purchaseorders')
      .then(res => (res && res.ok ? res.text() : ''))
      .then(txt => (txt ? JSON.parse(txt) : []))
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
      fetchAndSetGRNs();
    }
  }, [activeTab, fetchLivePOs, fetchAndSetGRNs]);

  useEffect(() => {
    fetchAndSetGRNs();

    const handlePoUpdate = () => {
      fetchLivePOs();
      fetchAndSetGRNs();
    };
    window.addEventListener('controlroom_po_updated', handlePoUpdate);
    window.addEventListener('controlroom_storage_update', handlePoUpdate);

    // Subscribe to cloud updates for real-time multi-device sync
    const unsubscribe = subscribeToCloudStore('grn_store', (updatedCloudData) => {
      if (Array.isArray(updatedCloudData) && updatedCloudData.length > 0) {
        const formatted = updatedCloudData.map(g => formatGrnItem(g, livePOs)).filter(Boolean);
        setGrnList(formatted);
        try {
          localStorage.setItem('controlroom_central_grns_v2', JSON.stringify(updatedCloudData));
          localStorage.setItem('goods_receipt_notes', JSON.stringify(updatedCloudData));
        } catch (_) {}
      }
    });

    return () => {
      window.removeEventListener('controlroom_po_updated', handlePoUpdate);
      window.removeEventListener('controlroom_storage_update', handlePoUpdate);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [fetchAndSetGRNs, fetchLivePOs]);

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
          rate: Number(it.rate !== undefined ? it.rate : (it.price !== undefined ? it.price : (it.unitPrice || it.unit_price || 0))),
          tax: Number(it.tax !== undefined ? it.tax : (it.taxRate || it.tax_rate || it.gstRate || it.gst_rate || 18)),
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
      fetch(`/api/purchaseorders/${encodeURIComponent(targetId)}`).then(res => res.ok ? res.json().catch(() => null) : null),
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
        const historyList = mergePoReceivingHistory(poRef, (historyData && historyData.grnHistory) ? historyData.grnHistory : []);

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
            rate: Number(it.rate !== undefined ? it.rate : (it.price !== undefined ? it.price : (it.unitPrice || it.unit_price || 0))),
            tax: Number(it.tax !== undefined ? it.tax : (it.taxRate || it.tax_rate || it.gstRate || it.gst_rate || 18)),
            ordered: ordered,
            prev: prev,
            remaining: remaining,
            now: nowVal,
            accepted: acceptedVal,
            rejected: 0,
            reason: '—',
            inventoryType: inferInventoryType(it),
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

      fetch(`/api/purchaseorders/${targetId}`)
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

  const inwardGrnItemsToInventory = async (itemsToProcess, grnGeneratedId) => {
    const inwardable = (Array.isArray(itemsToProcess) ? itemsToProcess : []).filter(
      pi => !pi.isPoReference && Number(pi.accepted !== undefined && pi.accepted !== '' ? pi.accepted : (pi.now || 0)) > 0
    );
    if (inwardable.length === 0) return;

    try {
      let rawMats = [];
      try {
        const rawStored = localStorage.getItem('controlroom_raw_materials_store');
        if (rawStored) rawMats = JSON.parse(rawStored);
      } catch (_) {}
      if (!Array.isArray(rawMats) || rawMats.length === 0) {
        rawMats = await fetchCloudStore('RAW_MATERIALS_STORE', []).catch(() => []);
      }
      if (!Array.isArray(rawMats)) rawMats = [];

      let anyUpdated = false;
      const matchedItemIds = new Set();

      const updatedRaw = rawMats.map(rm => {
        const rmNameClean = String(rm.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const rmCodeClean = String(rm.code || rm.sku || rm.itemId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        let added = 0;
        let matchedCategory = null;
        inwardable.forEach((pi, pIdx) => {
          const piNameClean = String(pi.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const piCodeClean = String(pi.code || pi.sku || pi.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const isMatch =
            (rmNameClean && piNameClean && (rmNameClean === piNameClean || rmNameClean.includes(piNameClean) || piNameClean.includes(rmNameClean))) ||
            (rmCodeClean && piCodeClean && (rmCodeClean === piCodeClean || rmCodeClean.includes(piCodeClean) || piCodeClean.includes(rmCodeClean)));
          if (isMatch) {
            const q = Number(pi.accepted !== undefined && pi.accepted !== '' ? pi.accepted : (pi.now || 0));
            if (q > 0) {
              added += q;
              matchedCategory = pi.inventoryType === 'Finished Goods' ? 'Finished Goods' : 'Raw Material';
              matchedItemIds.add(pi.id || `${piNameClean}-${pIdx}`);
            }
          }
        });
        if (added > 0) {
          anyUpdated = true;
          const newStock = Number(rm.stock || 0) + added;
          return {
            ...rm,
            category: matchedCategory || rm.category || 'Raw Material',
            cat: matchedCategory || rm.cat || 'Raw Material',
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

      // Append any newly received/split items not yet in the inventory store
      inwardable.forEach((pi, pIdx) => {
        const piNameClean = String(pi.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const key = pi.id || `${piNameClean}-${pIdx}`;
        if (matchedItemIds.has(key)) return;
        const q = Number(pi.accepted !== undefined && pi.accepted !== '' ? pi.accepted : (pi.now || 0));
        if (q <= 0 || !String(pi.name || '').trim()) return;
        anyUpdated = true;
        const targetCategory = pi.inventoryType === 'Finished Goods' ? 'Finished Goods' : 'Raw Material';
        const genCode = pi.sku && !String(pi.sku).startsWith('SKU-') ? pi.sku : `GRN-${Date.now().toString().slice(-5)}-${pIdx + 1}`;
        updatedRaw.push({
          id: `MAT-${Date.now()}-${pIdx}`,
          code: genCode,
          sku: genCode,
          name: String(pi.name).trim(),
          desc: pi.desc || '',
          description: pi.desc || '',
          category: targetCategory,
          cat: targetCategory,
          unit: pi.uom || 'NOS',
          stock: q,
          availableStock: q,
          physicalStock: q,
          goodsReceived: q,
          minLevel: 50,
          status: q > 50 ? 'In Stock' : 'Low Stock',
          lastUpdated: `Inwarded from GRN ${grnGeneratedId}`
        });
      });

      if (anyUpdated) {
        try {
          localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(updatedRaw));
        } catch (_) {}
        saveCloudStoreImmediate('raw_materials_store', updatedRaw).catch(() => {});
        window.dispatchEvent(new Event('central_inventory_updated'));
        window.dispatchEvent(new Event('controlroom_raw_materials_update'));
      }
    } catch (_) {}
  };

  const handleSaveAndReceive = async () => {
    if (isAccountsUser) {
      alert('Accounts team has read-only access to Goods Receipt Notes.');
      return;
    }
    const missing = [];
    if (!selectedGRNPo) missing.push('Purchase Order');
    if (!selectedGRNVendor) missing.push('Vendor');
    if (!grnChallanNo || String(grnChallanNo).trim() === '') missing.push('DC NO / Invoice No.');
    if (!grnReceivedBy || String(grnReceivedBy).trim() === '') missing.push('Received By');

    if (missing.length > 0) {
      setGrnValidationModal({ title: 'Mandatory Fields Required', fields: missing, message: 'Please complete all required fields to proceed.' });
      return;
    }

    // Validate split child names
    const unnamedSplit = grnItems.find(it => it.isSplitChild && (!it.name || String(it.name).trim() === ''));
    if (unnamedSplit) {
      setGrnValidationModal({
        title: 'Received Product Name Required',
        message: `Please enter a product name for all split received items under "${unnamedSplit.orderedItemName || 'PO Item'}".`
      });
      return;
    }

    // Prepare item list with defaults if user didn't type explicit numbers into inputs
    const processedItems = grnItems.map(it => {
      if (it.isPoReference) {
        return {
          ...it,
          rate: Number(it.rate || it.price || it.unitPrice || 0),
          tax: Number(it.tax !== undefined ? it.tax : (it.gstRate || it.taxRate || 18)),
          now: 0,
          accepted: 0,
          rejected: 0,
          inventoryType: it.inventoryType || inferInventoryType(it)
        };
      }
      const remaining = it.isSplitChild ? 0 : Math.max(0, (it.ordered || 0) - (it.prev || 0));
      const nowVal = (it.now !== '' && it.now !== undefined && it.now !== null) ? Number(it.now) : (remaining > 0 ? remaining : (it.ordered || 0));
      const acceptedVal = (it.accepted !== '' && it.accepted !== undefined && it.accepted !== null) ? Number(it.accepted) : nowVal;
      return {
        ...it,
        rate: Number(it.rate || it.price || it.unitPrice || 0),
        tax: Number(it.tax !== undefined ? it.tax : (it.gstRate || it.taxRate || 18)),
        now: nowVal,
        accepted: acceptedVal,
        rejected: Number(it.rejected || 0),
        inventoryType: it.inventoryType || inferInventoryType(it)
      };
    });

    const invalidItem = processedItems.find(it => {
      if (it.isPoReference || it.isSplitChild) return false;
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
    const totalNow = processedItems.reduce((acc, it) => acc + (it.isPoReference ? 0 : Number(it.now || 0)), 0);
    const totalAccepted = processedItems.reduce((acc, it) => acc + (it.isPoReference ? 0 : Number(it.accepted || 0)), 0);
    const totalRejected = processedItems.reduce((acc, it) => acc + (it.isPoReference ? 0 : Number(it.rejected || 0)), 0);
    const totalOrdered = processedItems.reduce((acc, it) => acc + (it.isSplitChild ? 0 : Number(it.ordered || 0)), 0);

    const prevPO = livePOs.find(p => p.poNo === selectedGRNPo || p.id === selectedGRNPo || p.zohoId === selectedGRNPo) || {};
    const curOrd = totalOrdered > 0 ? totalOrdered : Number(prevPO.totalOrderedQty || 0);
    const pastRec = Number(prevPO.totalReceivedQty || prevPO.totalReceived || 0);
    const curRec = pastRec + totalAccepted;
    const curRem = Math.max(0, curOrd - curRec);
    const isFull = (curOrd > 0 && curRec >= curOrd);

    // Calculate accurate GRN value from PO line items & accepted quantities
    const poRawTotal = Number(String(prevPO.grandTotal || prevPO.total || prevPO.val || 0).replace(/[^0-9.]/g, ''));
    let calculatedGrnValue = processedItems.reduce((acc, it) => {
      if (it.isPoReference) return acc;
      const recQty = Number(it.accepted !== undefined && it.accepted !== '' ? it.accepted : (it.now || 0));
      const rate = Number(it.rate || it.price || it.unitPrice || 0);
      const taxPct = Number(it.tax !== undefined && it.tax !== '' ? it.tax : (it.gstRate || it.taxRate || 18));
      const lineTaxable = recQty * rate;
      const lineTax = lineTaxable * (taxPct / 100);
      return acc + lineTaxable + lineTax;
    }, 0);

    // If fully received and PO total is known, GRN value strictly equals the PO grand total
    let finalGrnValFormatted = '—';
    if (isFull && poRawTotal > 0) {
      finalGrnValFormatted = `₹ ${poRawTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (calculatedGrnValue > 0) {
      finalGrnValFormatted = `₹ ${calculatedGrnValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (poRawTotal > 0 && curOrd > 0) {
      // Proportional to received quantity if item rate wasn't individually specified
      const proportionalVal = (curRec / curOrd) * poRawTotal;
      finalGrnValFormatted = `₹ ${proportionalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (poRawTotal > 0) {
      finalGrnValFormatted = `₹ ${poRawTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    const grnGeneratedId = getNextSequence('GRN', poReceivingHistory || []).code;
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
      createdBy: grnCreatedBy || getLoggedInUserName(),
      created_by: grnCreatedBy || getLoggedInUserName(),
      receivedBy: grnReceivedBy ? grnReceivedBy.trim() : '',
      inspectorName: grnInspectorName || 'Quality Inspector',
      inspectionRemarks: grnInspectionRemarks || '',
      items: processedItems,
      documents: docsToAttach,
      status: isFull ? 'CLOSED / FULLY RECEIVED' : 'OPEN / PARTIALLY RECEIVED',
      val: finalGrnValFormatted,
      totalVal: finalGrnValFormatted
    };

    const formattedGRN = {
      id: newGRNRecord.id,
      grnNo: newGRNRecord.grnNo,
      poRef: newGRNRecord.poRef,
      vendor: newGRNRecord.vendor,
      date: newGRNRecord.date,
      received: `${totalNow} Units`,
      status: newGRNRecord.status,
      val: finalGrnValFormatted,
      totalVal: finalGrnValFormatted,
      challanNo: newGRNRecord.challanNo,
      createdBy: newGRNRecord.createdBy,
      receivedBy: newGRNRecord.receivedBy,
      documents: newGRNRecord.documents
    };

    // 2. IMMEDIATE PERSISTENCE: GRN Store (React State + LocalStorage + Supabase Cloud)
    setGrnList(prev => [formattedGRN, ...prev.filter(g => g.id !== formattedGRN.id)]);
    try {
      const rawStored = localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes') || '[]';
      const parsed = JSON.parse(rawStored);
      const updatedGrns = [newGRNRecord, ...(Array.isArray(parsed) ? parsed.filter(g => (g.grnNo || g.id) !== newGRNRecord.id) : [])];
      try {
        localStorage.setItem('controlroom_central_grns_v2', JSON.stringify(updatedGrns));
        localStorage.setItem('goods_receipt_notes', JSON.stringify(updatedGrns));
      } catch (_) {}
      const sanitizedGrns = updatedGrns.map(stripDataUrlsFromRecord);
      saveCloudStoreImmediate('grn_store', sanitizedGrns).catch(() => {});
    } catch (_) {}

    // 3. IMMEDIATE PERSISTENCE: PO Store (Supabase Cloud + LocalStorage)
    const poTargetId = selectedGRNPo;
    if (poTargetId && poTargetId !== '—') {
      savePurchaseOrder({
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
        items: processedItems
          .filter(it => !it.isSplitChild)
          .map(it => {
            const ord = Number(it.ordered || 0);
            const acc = it.isPoReference
              ? processedItems
                  .filter(c => c.isSplitChild && c.parentPoItemId === it.id)
                  .reduce((sum, c) => sum + Number(c.accepted !== undefined ? c.accepted : (c.now || 0)), 0)
              : Number(it.accepted !== undefined ? it.accepted : (it.now || 0));
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

    // 4. IMMEDIATE PERSISTENCE: Inward Inventory Stock (routes Raw Material vs Finished Goods, skips PO Reference rows)
    await inwardGrnItemsToInventory(processedItems, grnGeneratedId);

    window.dispatchEvent(new CustomEvent('controlroom_grn_completed', { detail: newGRNRecord }));
    window.dispatchEvent(new Event('central_inventory_updated'));
    window.dispatchEvent(new Event('controlroom_raw_materials_update'));
    window.dispatchEvent(new Event('controlroom_storage_update'));
    window.dispatchEvent(new CustomEvent('storage'));

    // Trigger real-time melodic notification to Accounts team for bill verification
    notifyGrnCompletedToAccounts({
      grnNo: newGRNRecord.grnNo,
      poNo: newGRNRecord.poRef,
      vendor: newGRNRecord.vendor,
      receivedQty: totalNow,
      totalOrderedQty: curOrd,
      isPartial: !isFull,
      challanNo: newGRNRecord.challanNo,
      receivedBy: newGRNRecord.receivedBy
    });

    // 5. Notify server backend asynchronously
    fetch('/api/grns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newGRNRecord)
    })
      .then(res => (res && res.ok ? res.text() : ''))
      .catch(() => {});

    setShowCreateGRN(false);
    resetCreateGRNForm();
  };

  const handleFullyReceived = async () => {
    if (isAccountsUser) {
      alert('Accounts team has read-only access to Goods Receipt Notes.');
      return;
    }
    if (!selectedGRNPo) {
      setGrnValidationModal({ title: 'Purchase Order Required', message: 'Please select a Purchase Order to mark as Fully Received.' });
      return;
    }

    const completedItems = grnItems.map(it => {
      if (it.isPoReference) {
        return {
          ...it,
          rate: Number(it.rate || it.price || it.unitPrice || 0),
          tax: Number(it.tax !== undefined ? it.tax : (it.gstRate || it.taxRate || 18)),
          now: 0,
          accepted: 0,
          rejected: 0,
          reason: '—',
          inventoryType: it.inventoryType || inferInventoryType(it)
        };
      }
      const ord = it.isSplitChild ? 0 : (it.ordered || (it.prev ? it.prev + (it.now || 1) : (it.now || 1)));
      const nowQty = it.isSplitChild ? Number(it.now || it.accepted || 0) : Math.max(1, (it.now && it.now > 0) ? it.now : (ord - (it.prev || 0)));
      const acceptedQty = it.isSplitChild ? Number(it.accepted !== undefined ? it.accepted : nowQty) : Math.max(1, (it.accepted && it.accepted > 0) ? it.accepted : nowQty);
      return {
        ...it,
        rate: Number(it.rate || it.price || it.unitPrice || 0),
        tax: Number(it.tax !== undefined ? it.tax : (it.gstRate || it.taxRate || 18)),
        ordered: ord,
        now: nowQty,
        accepted: acceptedQty,
        rejected: 0,
        reason: '—',
        inventoryType: it.inventoryType || inferInventoryType(it)
      };
    });

    const totalAccepted = completedItems.reduce((acc, it) => acc + (it.isPoReference ? 0 : Number(it.accepted || 0)), 0);
    const docsToAttach = grnDocs || [];

    const prevPO = livePOs.find(p => p.poNo === selectedGRNPo || p.id === selectedGRNPo || p.zohoId === selectedGRNPo) || {};
    const poRawTotal = Number(String(prevPO.grandTotal || prevPO.total || prevPO.val || 0).replace(/[^0-9.]/g, ''));
    let calculatedGrnValue = completedItems.reduce((acc, it) => {
      if (it.isPoReference) return acc;
      const recQty = Number(it.accepted !== undefined && it.accepted !== '' ? it.accepted : (it.now || 0));
      const rate = Number(it.rate || it.price || it.unitPrice || 0);
      const taxPct = Number(it.tax !== undefined && it.tax !== '' ? it.tax : (it.gstRate || it.taxRate || 18));
      const lineTaxable = recQty * rate;
      const lineTax = lineTaxable * (taxPct / 100);
      return acc + lineTaxable + lineTax;
    }, 0);

    const fullValFormatted = (poRawTotal > 0)
      ? `₹ ${poRawTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : (calculatedGrnValue > 0
        ? `₹ ${calculatedGrnValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '—');

    const payload = {
      poRef: selectedGRNPo,
      poNo: selectedGRNPo,
      vendor: selectedGRNVendor || 'Vendor',
      challanNo: grnChallanNo || 'DC-FINAL',
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      receivedQty: totalAccepted,
      acceptedQty: totalAccepted,
      rejectedQty: 0,
      createdBy: grnCreatedBy || getLoggedInUserName(),
      created_by: grnCreatedBy || getLoggedInUserName(),
      receivedBy: grnReceivedBy ? grnReceivedBy.trim() : '',
      inspectorName: grnInspectorName || 'Quality Inspector',
      inspectionRemarks: grnInspectionRemarks || 'PO Marked as Fully Received & Closed',
      items: completedItems,
      documents: docsToAttach,
      status: 'CLOSED / FULLY RECEIVED',
      forceClosePO: true
    };

    const grnGeneratedId = getNextSequence('GRN', poReceivingHistory || []).code;
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
      createdBy: grnCreatedBy || getLoggedInUserName(),
      created_by: grnCreatedBy || getLoggedInUserName(),
      receivedBy: grnReceivedBy ? grnReceivedBy.trim() : '',
      inspectorName: grnInspectorName || 'Quality Inspector',
      inspectionRemarks: grnInspectionRemarks || 'PO Marked as Fully Received & Closed',
      items: completedItems,
      documents: docsToAttach,
      status: 'CLOSED / FULLY RECEIVED',
      val: fullValFormatted,
      totalVal: fullValFormatted
    };

    const formattedGRN = {
      id: newGRNRecord.id,
      grnNo: newGRNRecord.grnNo,
      poRef: newGRNRecord.poRef,
      vendor: newGRNRecord.vendor,
      date: newGRNRecord.date,
      received: `${totalAccepted} Units`,
      status: 'CLOSED / FULLY RECEIVED',
      val: fullValFormatted,
      totalVal: fullValFormatted,
      challanNo: newGRNRecord.challanNo,
      createdBy: newGRNRecord.createdBy,
      receivedBy: newGRNRecord.receivedBy,
      documents: newGRNRecord.documents
    };

    // 1. IMMEDIATE PERSISTENCE: GRN Store
    setGrnList(prev => [formattedGRN, ...prev.filter(g => g.id !== formattedGRN.id)]);
    try {
      const rawStored = localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes') || '[]';
      const parsed = JSON.parse(rawStored);
      const updatedGrns = [newGRNRecord, ...(Array.isArray(parsed) ? parsed.filter(g => (g.grnNo || g.id) !== newGRNRecord.id) : [])];
      try {
        localStorage.setItem('controlroom_central_grns_v2', JSON.stringify(updatedGrns));
        localStorage.setItem('goods_receipt_notes', JSON.stringify(updatedGrns));
      } catch (_) {}
      const sanitizedGrns = updatedGrns.map(stripDataUrlsFromRecord);
      saveCloudStoreImmediate('grn_store', sanitizedGrns).catch(() => {});
    } catch (_) {}

    // 2. IMMEDIATE PERSISTENCE: PO Store
    const poTargetId = selectedGRNPo;
    if (poTargetId && poTargetId !== '—') {
      const prevPO = livePOs.find(p => p.poNo === poTargetId || p.id === poTargetId || p.zohoId === poTargetId) || {};
      const curOrd = totalAccepted > 0 ? totalAccepted : Number(prevPO.totalOrderedQty || 0);
      savePurchaseOrder({
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

    // 3. IMMEDIATE PERSISTENCE: Inward Inventory Stock (routes Raw Material vs Finished Goods, skips PO Reference rows)
    await inwardGrnItemsToInventory(completedItems, grnGeneratedId);

    window.dispatchEvent(new CustomEvent('controlroom_grn_completed', { detail: newGRNRecord }));
    window.dispatchEvent(new Event('central_inventory_updated'));
    window.dispatchEvent(new Event('controlroom_raw_materials_update'));
    window.dispatchEvent(new Event('controlroom_storage_update'));
    window.dispatchEvent(new CustomEvent('storage'));

    // Trigger real-time melodic notification to Accounts team for bill verification
    notifyGrnCompletedToAccounts({
      grnNo: newGRNRecord.grnNo,
      poNo: newGRNRecord.poRef,
      vendor: newGRNRecord.vendor,
      receivedQty: totalAccepted,
      totalOrderedQty: totalAccepted,
      isPartial: false,
      challanNo: newGRNRecord.challanNo,
      receivedBy: newGRNRecord.receivedBy
    });

    // 4. Notify server backend asynchronously
    fetch('/api/grns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, id: grnGeneratedId, grnNo: grnGeneratedId })
    })
      .then(res => (res && res.ok ? res.text() : ''))
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

    const remaining = grnList.filter(g => g.id !== targetId && g.grnNo !== targetId);
    setGrnList(remaining);
    setGrnToDelete(null);

    try {
      localStorage.setItem('controlroom_central_grns_v2', JSON.stringify(remaining));
      localStorage.setItem('goods_receipt_notes', JSON.stringify(remaining));
    } catch (_) {}
    saveCloudStoreImmediate('grn_store', remaining).catch(() => {});

    fetch(`/api/grns/${encodeURIComponent(targetId)}`, { method: 'DELETE' })
      .then(res => res.json())
      .catch(err => console.error('Error deleting GRN on server:', err));

    fetchLivePOs();
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
        <select id="goods-receipt-note-value" name="value" aria-label="Value"
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

  const loadVendorsFromBackend = async () => {
    setVendorLoading(true);
    try {
      const backendVendors = await getVendors();
      if (Array.isArray(backendVendors) && backendVendors.length > 0) {
        setVendorList(backendVendors);
      } else {
        const res = await fetch('/api/vendors').catch(() => null);
        if (res && res.ok) {
          const vData = await res.json().catch(() => []);
          setVendorList(Array.isArray(vData) ? vData : []);
        }
      }
    } catch (e) {
      console.error("Failed to load vendors", e);
    } finally {
      setVendorLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'Vendor Management') {
      loadVendorsFromBackend();
    }
  }, [activeTab]);

  const [invoicesList, setInvoicesList] = useState([]);
  const [printTaxInvoiceModal, setPrintTaxInvoiceModal] = useState(null);

  useEffect(() => {
    if (activeTab === 'Invoice Management') {
      const fetchInvoicesFromBackend = async () => {
        try {
          const response = await fetch('/api/invoices');
          if (response.ok) {
            const backendInvoices = await response.json();
            if (Array.isArray(backendInvoices)) {
              setInvoicesList(backendInvoices);
            }
          }
        } catch (err) {
          console.error("Error fetching Invoices:", err);
        }
      };
      fetchInvoicesFromBackend();
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
        const res = await fetch(`/api/vendors/${vendorId}`);
        if (res.ok) {
          const detail = await res.json();
          setViewingVendor(detail);
        }
      } catch (e) {
        console.error("Failed to load detailed vendor info from database", e);
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
  const [isSyncingItems, setIsSyncingItems] = useState(false);
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
    const fetchItemsFromBackend = async () => {
      try {
        setItemsLoading(true);
        const backendItems = await getItems();
        if (isMounted && Array.isArray(backendItems) && backendItems.length > 0) {
          setItemsList(prev => {
            const itemMap = new Map();
            (prev || []).forEach(it => itemMap.set(it.code || it.sku || it.itemId || it.id || it.name, it));
            backendItems.forEach(it => {
              const key = it.code || it.sku || it.itemId || it.id || it.name;
              if (key) itemMap.set(key, { ...itemMap.get(key), ...it });
            });
            return Array.from(itemMap.values());
          });
        } else {
          const response = await fetch('/api/items').catch(() => null);
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
        console.error("Error fetching Catalog Items:", err);
      } finally {
        if (isMounted) setItemsLoading(false);
      }
    };
    fetchItemsFromBackend();
    return () => { isMounted = false; };
  }, []);

  const handleCreateProduct = async () => {
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

      const res = await fetch('/api/items', {
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

      setCreateStatus({ type: 'success', text: result.message || 'Product created successfully!' });

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

  const handleSaveItem = async () => {
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

      const res = await fetch(`/api/items/${editingItem.itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setItemSaveStatus({ type: 'success', text: 'Item updated successfully!' });
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
      const res = await fetch(`/api/gst-lookup?gstin=${g}`);
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

  // quotationsList auto-save removed to prevent cloud feedback loop


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

  // Keep local convenience cache updated without cloud egress
  useEffect(() => {
    if (invoiceList && invoiceList.length > 0) {
      try {
        localStorage.setItem('controlroom_invoice_store', JSON.stringify(invoiceList));
      } catch (_) {}
    }
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

  // paymentList auto-save removed to prevent cloud feedback loop


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

    // Save new vendor and refresh live list
    fetch('/api/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newVendorPayload)
    }).then(res => res.json()).then(data => {
      if (data.success) {
        console.log('Vendor created successfully in BUSINZ!', data);
      } else {
        console.warn('Vendor creation notice:', data);
      }
      loadVendorsFromBackend();
    }).catch(err => {
      console.error('Failed to save vendor:', err);
      loadVendorsFromBackend();
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


  const renderGrnFormCards = () => {
    return (
      <GrnInwardingFormCards
        grnItems={grnItems}
        setGrnItems={setGrnItems}
        selectedGrnForModal={selectedGrnForModal}
        editingGrnId={editingGrnId}
        receiptDate={receiptDate}
        setReceiptDate={setReceiptDate}
        isViewOnlyMode={isViewOnlyMode}
        livePOs={livePOs}
        selectedGRNPo={selectedGRNPo}
        selectedGRNVendor={selectedGRNVendor}
        grnChallanNo={grnChallanNo}
        setGrnChallanNo={setGrnChallanNo}
        challanDate={challanDate}
        setChallanDate={setChallanDate}
        handleOpenPoModal={handleOpenPoModal}
        itemsList={itemsList}
        poReceivingHistory={poReceivingHistory}
        grnDocs={grnDocs}
        setGrnDocs={setGrnDocs}
        deleteDocConfirmIdx={deleteDocConfirmIdx}
        setDeleteDocConfirmIdx={setDeleteDocConfirmIdx}
        activeDocPreviewModal={activeDocPreviewModal}
        setActiveDocPreviewModal={setActiveDocPreviewModal}
        grnCreatedBy={grnCreatedBy}
        getLoggedInUserName={getLoggedInUserName}
        grnReceivedBy={grnReceivedBy}
        setGrnReceivedBy={setGrnReceivedBy}
        mergePoReceivingHistory={mergePoReceivingHistory}
        inferInventoryType={inferInventoryType}
        loadPOItems={loadPOItems}
      />
    );
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
                  {!isAccountsUser && (
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
                  )}
                </div>
              </div>

              {/* 1. FILTERS & SEARCH ROW CARD */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '12px 16px', backgroundColor: '#fafbfc', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center', width: '100%', boxSizing: 'border-box', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#f8fafc', width: '320px', maxWidth: '100%', boxSizing: 'border-box' }}>
                  <Search style={{ width: '15px', height: '15px', color: '#64748b', flexShrink: 0 }} />
                  <input id="goods-receipt-note-search-query" name="searchQuery" aria-label="Search GRNs (GRN No, PO No, Vendor)"
                    type="text"
                    placeholder="Search GRNs (GRN No, PO No, Vendor)..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setGrnPage(1); }}
                    style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
                   />
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                  <ModernDateRangePicker
                    startDate={filterDate}
                    endDate={filterEndDate}
                    onChange={({ startDate, endDate }) => {
                      setFilterDate(startDate);
                      setFilterEndDate(endDate);
                      setGrnPage(1);
                    }}
                  />

                  <select id="goods-receipt-note-grn-list-status-filter" name="grnListStatusFilter" aria-label="GrnListStatusFilter"
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
                      setFilterEndDate('');
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
                  { id: 'CLOSED', label: 'Closed / Fully Received', count: grnList.filter(g => getEffectiveGrnStatus(g) === 'CLOSED / FULLY RECEIVED').length, bg: '#dcfce7', fg: '#15803d' },
                  { id: 'PARTIALLY_RECEIVED', label: 'Open / Partially Received', count: grnList.filter(g => getEffectiveGrnStatus(g) === 'OPEN / PARTIALLY RECEIVED').length, bg: '#fef3c7', fg: '#b45309' },
                  { id: 'Approved', label: 'Approved', count: grnList.filter(g => getEffectiveGrnStatus(g).toLowerCase() === 'approved').length, bg: '#dcfce7', fg: '#166534' },
                  { id: 'Draft', label: 'Draft', count: grnList.filter(g => getEffectiveGrnStatus(g).toLowerCase().includes('draft')).length, bg: '#fff7ed', fg: '#c2410c' }
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
              <GrnTableSection
                grnList={grnList}
                setGrnList={setGrnList}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                getEffectiveGrnStatus={getEffectiveGrnStatus}
                grnListStatusFilter={grnListStatusFilter}
                setGrnListStatusFilter={setGrnListStatusFilter}
                grnListActiveTab={grnListActiveTab}
                setGrnListActiveTab={setGrnListActiveTab}
                filterDate={filterDate}
                setFilterDate={setFilterDate}
                filterEndDate={filterEndDate}
                setFilterEndDate={setFilterEndDate}
                selectedGrnRows={selectedGrnRows}
                setSelectedGrnRows={setSelectedGrnRows}
                grnPage={grnPage}
                setGrnPage={setGrnPage}
                grnRowsPerPage={grnRowsPerPage}
                setGrnRowsPerPage={setGrnRowsPerPage}
                grnTab={grnTab}
                setGrnTab={setGrnTab}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                handleOpenViewGrn={handleOpenViewGrn}
                handleOpenEditGrn={handleOpenEditGrn}
                handleDeleteGRN={handleDeleteGRN}
                handleOpenPoModal={handleOpenPoModal}
                showCeoGrnModal={showCeoGrnModal}
                isMobile={isMobile}
                isCeoLogin={isCeoLogin}
                isAccountsUser={isAccountsUser}
              />
            </>
          ) : (() => {
            // Calculation of Totals
            const totalOrdered = grnItems.reduce((acc, it) => acc + (it.isSplitChild ? 0 : (Number(it.ordered) || 0)), 0);
            const totalPrev = grnItems.reduce((acc, it) => acc + (it.isSplitChild ? 0 : (Number(it.prev) || 0)), 0);
            const totalNow = grnItems.reduce((acc, it) => acc + (it.isPoReference ? 0 : Number(it.now || 0)), 0);
            const totalAccepted = grnItems.reduce((acc, it) => acc + (it.isPoReference ? 0 : Number(it.accepted || 0)), 0);
            const totalRejected = grnItems.reduce((acc, it) => acc + (it.isPoReference ? 0 : Number(it.rejected || 0)), 0);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Form Header (Matching PO Teal Banner Design) */}
                <div
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
                      <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
                        {isViewOnlyMode ? 'View Goods Receipt Note (GRN)' : (editingGrnId ? `Edit Draft (${editingGrnId})` : 'New Goods Receipt Note (GRN)')}
                      </h2>
                      <span style={{ fontSize: '13px', color: '#CFFAFE', marginTop: '4px' }}>
                        {isViewOnlyMode ? 'Viewing recorded goods receipt details (Read Only)' : 'Record goods received against a Purchase Order'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form Body layout */}
                {renderGrnFormCards()}

                {/* Sticky Bottom Action Bar (Matching PO Design) */}
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
                    boxSizing: 'border-box',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateGRN(false);
                        resetCreateGRNForm();
                      }}
                      style={{
                        height: '40px',
                        padding: '0 20px',
                        borderRadius: '8px',
                        border: '1.5px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#334155',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {isViewOnlyMode ? 'Back to List' : 'Cancel'}
                    </button>
                    {!isViewOnlyMode && (
                      <>
                        <button
                          type="button"
                          onClick={handleSaveAndReceive}
                          style={{
                            height: '40px',
                            padding: '0 20px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#0E7490',
                            color: '#FFFFFF',
                            fontSize: '14px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(14, 116, 144, 0.25)'
                          }}
                        >
                          Save &amp; Receive
                        </button>
                        <button
                          type="button"
                          onClick={handleFullyReceived}
                          title="Mark all items as received, close GRN, and close PO in BUSINZ Native Catalog"
                          style={{
                            height: '40px',
                            padding: '0 20px',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: '#16a34a',
                            color: '#FFFFFF',
                            fontSize: '14px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)'
                          }}
                        >
                          <CheckCircle style={{ width: '16px', height: '16px' }} />
                          Fully Received
                        </button>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', fontWeight: '700', color: '#475569' }}>
                    <span>Receiving Now: <strong style={{ color: '#0E7490' }}>{totalNow}</strong></span>
                    <span>Accepted: <strong style={{ color: '#16A34A' }}>{totalAccepted}</strong></span>
                  </div>
                </div>

              </div>
            );
          })()}
        </div>
      )}

      {/* ==================== CEO LOGIN GOODS RECEIPT NOTE (GRN) POPUP MODAL ==================== */}
      {showCeoGrnModal && (
        <div
          className="ceo-grn-modal-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '20px',
            boxSizing: 'border-box'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCeoGrnModal(false);
              resetCreateGRNForm();
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              width: '100%',
              maxWidth: '1200px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 24px',
                borderBottom: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  backgroundColor: '#E0F2FE',
                  color: '#0369A1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Package size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                      Goods Receipt Note: {selectedGrnForModal?.id || selectedGrnForModal?.grnNo || grnChallanNo || 'GRN Details'}
                    </h3>
                    <StatusBadge status={getEffectiveGrnStatus(selectedGrnForModal)} size="sm" />
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    PO Ref: <strong
                      onClick={() => handleOpenPoModal(selectedGrnForModal?.poRef || selectedGRNPo)}
                      title="Click to view Purchase Order in popup"
                      style={{ color: '#0E7490', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {selectedGrnForModal?.poRef || selectedGRNPo || '—'}
                    </strong> • Vendor: <strong style={{ color: '#0F172A' }}>{selectedGrnForModal?.vendor || selectedGRNVendor || '—'}</strong> • Date: {selectedGrnForModal?.date || '—'}
                  </span>
                </div>
              </div>

              {/* Action Buttons in Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Print / Export PDF"
                >
                  <FileText size={13} /> Print
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCeoGrnModal(false);
                    resetCreateGRNForm();
                  }}
                  style={{
                    backgroundColor: '#F1F5F9',
                    border: 'none',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748B',
                    marginLeft: '4px'
                  }}
                  title="Close popup"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable) */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: '#F8FAFC' }}>
              {renderGrnFormCards()}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 24px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Total Value:</span>
                  <strong style={{ fontSize: '15px', color: '#0E7490', fontWeight: '800' }}>
                    {selectedGrnForModal?.val || '—'}
                  </strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Received:</span>
                  <strong style={{ fontSize: '14px', color: '#16A34A', fontWeight: '700' }}>
                    {selectedGrnForModal?.received || (grnItems.reduce((acc, it) => acc + Number(it.accepted || it.now || 0), 0) + ' Units')}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCeoGrnModal(false);
                    resetCreateGRNForm();
                  }}
                  style={{
                    backgroundColor: '#0E7490',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 22px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: 'white',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PURCHASE ORDER DETAILS POPUP MODAL ==================== */}
      <GrnPoDetailModal
        showPoModal={showPoModal}
        setShowPoModal={setShowPoModal}
        selectedPoData={selectedPoData}
        selectedGRNPo={selectedGRNPo}
        selectedGRNVendor={selectedGRNVendor}
        previousGrnForBack={previousGrnForBack}
        setPreviousGrnForBack={setPreviousGrnForBack}
        setShowCeoGrnModal={setShowCeoGrnModal}
        grnItems={grnItems}
        vendorList={vendorList}
        handleBackToGrn={handleBackToGrn}
      />
    </div>
  );
}
