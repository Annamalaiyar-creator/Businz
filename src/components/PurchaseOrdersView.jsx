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

export const COMPANY_LOCATIONS = {
  'VRM Structures India Pvt Ltd': {
    name: 'VRM Structures India Pvt Ltd',
    locationLabel: 'VRM Structures India Pvt Ltd',
    address: '1427, GNT Road, Nagappa Industrial Estate, Madhavaram, Chennai, Tamil Nadu - 600066',
    gst: '33AAGCV4262N1ZZ',
    email: 'contact@vrmstructures.com',
    phone: '+91 98847 20789',
    state: 'Tamil Nadu'
  },
  'VRM Structures (AP)': {
    name: 'VRM Structures India Pvt Ltd',
    locationLabel: 'VRM Structures (AP)',
    address: 'NO 150B, PERUMAL KOVIL STREET, Padi. Tada, District - Thirupati, TADA, Andhra Pradesh - 524401, India',
    gst: '37AAGCV4262N1ZR',
    email: 'ap@vrmstructures.com',
    phone: '+91 98847 20789',
    state: 'Andhra Pradesh'
  },
  'Jashsun': {
    name: 'Jash Sun Power Dynamics Private Limited',
    locationLabel: 'Jashsun',
    address: '2nd, 1/135A, JASH SUN, 2nd Street, Elavanthangal, Kelambakkam, Chengalpattu, Tamil Nadu - 603103, India',
    gst: '33AAGCJ6197G1ZC',
    email: 'contact@jashsun.com',
    phone: '+91 98847 20789',
    state: 'Tamil Nadu'
  }
};
// Alias legacy keys for backward compatibility
COMPANY_LOCATIONS['VRM Structures (Madhavaram)'] = COMPANY_LOCATIONS['VRM Structures India Pvt Ltd'];

export const getCompanyProfile = (locationKey) => {
  if (!locationKey) return COMPANY_LOCATIONS['VRM Structures India Pvt Ltd'];
  const norm = String(locationKey).trim().toLowerCase();
  if (norm.includes('ap') || norm.includes('andhra') || norm.includes('tada') || norm.includes('nellore')) {
    return COMPANY_LOCATIONS['VRM Structures (AP)'];
  }
  if (norm.includes('jash') || norm.includes('sun')) {
    return COMPANY_LOCATIONS['Jashsun'];
  }
  return COMPANY_LOCATIONS['VRM Structures India Pvt Ltd'];
};

const PRESET_MATERIALS = [
  { name: 'GI Steel Coil 2mm', account: 'Raw Material', unit: 'MT', rate: 45000, tax: 18 },
  { name: 'GI Steel Coil 1.6mm', account: 'Raw Material', unit: 'MT', rate: 43000, tax: 18 },
  { name: 'CRC Sheet 1.2mm', account: 'Raw Material', unit: 'MT', rate: 52000, tax: 18 },
  { name: 'Self Drilling Screw', account: 'Consumables', unit: 'NOS', rate: 3.5, tax: 18 },
  { name: 'Hex Bolt M10', account: 'Fasteners', unit: 'NOS', rate: 6.2, tax: 18 },
  { name: 'Structural Steel I-Beam', account: 'Raw Material', unit: 'MT', rate: 48000, tax: 18 },
  { name: 'Electrical Copper Cable 4sqmm', account: 'Consumables', unit: 'MTR', rate: 120, tax: 18 },
  { name: 'Cement Bag 50kg', account: 'Raw Material', unit: 'NOS', rate: 410, tax: 18 },
  { name: 'Industrial Fan 5KW', account: 'Raw Material', unit: 'KW', rate: 18500, tax: 18 }
];

const TERMS_PRESETS = [
  {
    key: 'inverter',
    label: 'Solar Inverter',
    text: `1. Inverter shall be supplied as per approved technical specifications and make/model mentioned in the PO.
2. Material should be new, unused, and supplied with original manufacturer warranty certificate.
3. Supplier shall provide required documents including test certificates, datasheets, manuals, and warranty details along with material.
4. Delivery shall be completed within the agreed timeline from the date of PO.
5. Any damage/defect found during inspection shall be replaced by the supplier at no additional cost.
6. Payment will be released before dispatch of the material.
7. Warranty support and service shall be provided by the supplier/manufacturer as per warranty conditions.
8. Material shall be properly packed to avoid any transit damage.
9. GST and other applicable taxes shall be as per agreed quotation.
10. Supplier shall ensure the inverter is compatible with the required solar system specifications.`
  },
  {
    key: 'solar_panels',
    label: 'Solar Panels',
    text: `1. Supply of solar panels shall be as per the approved specifications and PO requirements.
2. Panels shall be new, unused, and free from any manufacturing defects.
3. Manufacturer's warranty documents shall be provided along with the material.
4. Material shall be supplied with all relevant test certificates and compliance documents.
5. Any damaged, defective, or short-supplied material shall be replaced by the supplier at no additional cost.
6. Delivery shall be made as per the agreed schedule mentioned in the PO.
7. Packing and transportation shall be in the supplier's scope to ensure safe delivery.
8. GST and other applicable taxes shall be clearly mentioned in the invoice.
9. Payment shall be made as per the mutually agreed payment terms mentioned in the PO.
10. Final acceptance of the material is subject to inspection at the delivery site.`
  },
  {
    key: 'general_material',
    label: 'General Material',
    text: `1. Material shall be supplied as per the specifications and quantity mentioned in the Purchase Order.
2. Material must be free from rust, defects, and physical damage.
3. Delivery shall be made as per the committed schedule.
4. Supplier shall provide a tax invoice along with the material.
5. Any rejected material due to quality issues shall be replaced by the supplier at no additional cost.
6. Material shall be properly packed to avoid damage during transit.
7. Any deviation from the PO specifications must be approved before dispatch.
8. Payment Terms: 100% payment shall be made before dispatch of the material.`
  },
  {
    key: 'aluminium_profile',
    label: 'Aluminium Profile',
    text: `1. Material: Aluminium Profile as per approved drawing/specification.
2. Quantity: As per Purchase Order.
3. Quality: Material should be free from dents, scratches, bends, and manufacturing defects.
4. Test Certificate: Material Test Certificate (MTC) to be provided along with the material.
5. Delivery: Material to be supplied as per the delivery schedule mentioned in the PO.
6. Packing: Proper packing to be ensured to avoid transit damage.
7. Inspection: Material is subject to inspection and acceptance at our site.
8. Payment Terms: 30 days credit from the date of material receipt and invoice submission.
9. Taxes: GST shall be applicable as per government norms.
10. Rejected or damaged material, if any, shall be replaced by the supplier at no additional cost.`
  },
  {
    key: 'cables',
    label: 'Cables (AC, DC & Earthing)',
    text: `1. Material shall be supplied as per approved specification, make, size, and quantity mentioned in the Purchase Order.
2. Cable shall be new, unused, and supplied with proper packing.
3. Material should be free from defects and damage; any defective material found will be replaced by the supplier at their cost.
4. Cable length, size, and quality shall be as per PO requirement and manufacturer standards.
5. Test certificates / quality certificates shall be provided along with the material, if required.
6. Delivery shall be completed within the agreed timeline mentioned in the PO.
7. Material should be supplied with proper invoice and required documents.
8. Payment will be released before dispatch of the material.
9. Any shortage in quantity or transit damage shall be informed and resolved by the supplier.
10. Warranty shall be as per manufacturer’s standard terms.`
  }
];

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
    const storedName = localStorage.getItem('controlroom_logged_user_name');
    if (storedName && storedName !== 'undefined' && storedName !== 'null' && storedName.toLowerCase() !== 'vijay') return storedName;
    try {
      const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
      const allEmps = [...(Array.isArray(storedEmps) ? storedEmps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];
      const match = allEmps.find(e => e && e.role === userRole && e.employee_name && e.employee_name.toLowerCase() !== 'vijay');
      if (match && (match.employee_name || match.name)) return match.employee_name || match.name;
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
    if (userRole === 'Design Engineer') return 'Dinesh';
    if (userRole === 'Design Executive') return 'Kavitha';
    if (userRole === 'Invoice Executive' || userRole === 'Billing') return 'Anand';
    if (userRole === 'BOM Executive') return 'Balaji';
    if (userRole === 'Procurement Head' || userRole === 'Procurement Admin') return 'Annamalaiyar';
    return 'Annamalaiyar';
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
      localStorage.setItem('controlroom_push_to_grn_po', poNo);
      localStorage.setItem('controlroom_push_to_grn_po_data', JSON.stringify(poTarget));
      window.dispatchEvent(new CustomEvent('controlroom_push_to_grn', { detail: poTarget }));
    } catch (_) {}
    if (typeof onNavigateTab === 'function') {
      onNavigateTab('Goods Receipt Note');
    } else {
      localStorage.setItem('controlroom_active_tab', 'Goods Receipt Note');
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

  const [poList, setPoList] = useState([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [zohoVendors, setZohoVendors] = useState([]);
  const [zohoItems, setZohoItems] = useState([]);

  const fetchZohoPOs = async (isBackground = false) => {
    if (!isBackground) {
      setTableLoading(true);
    }
    try {
      const safePOs = await getPurchaseOrders();
      const normalize = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();

      const mergeWithPrev = (incomingList, currentPrev) => {
        const prevMap = new Map();
        currentPrev.forEach(p => {
          const pNo = normalize(p.poNo);
          const pId = normalize(p.id);
          const pZohoId = normalize(p.zohoId);
          if (pNo) prevMap.set(pNo, p);
          if (pId) prevMap.set(pId, p);
          if (pZohoId) prevMap.set(pZohoId, p);
        });

        const mergedIncoming = incomingList.map(p => {
          const pNo = normalize(p.poNo);
          const pId = normalize(p.id);
          const pZohoId = normalize(p.zohoId);
          const existing = prevMap.get(pNo) || prevMap.get(pId) || prevMap.get(pZohoId);
          if (existing) {
            const stageRank = {
              'Draft': 1,
              'MD_APPROVED': 2,
              'PAYMENT_PROCESSED': 3,
              'PROCEED_PO': 4,
              'PARTIALLY_RECEIVED': 5,
              'CLOSED': 6,
              'REJECTED': 7
            };
            const existingRank = stageRank[getPoStage(existing)] || 1;
            const incomingRank = stageRank[getPoStage(p)] || 1;
            const keepIncoming = incomingRank >= existingRank;
            const incomingItems = Array.isArray(p.items) && p.items.length > 0 
              ? p.items 
              : (Array.isArray(p.line_items) && p.line_items.length > 0 ? p.line_items : []);
            const existingItems = Array.isArray(existing.items) && existing.items.length > 0 
              ? existing.items 
              : (Array.isArray(existing.line_items) && existing.line_items.length > 0 ? existing.line_items : []);

            const effStatus = keepIncoming ? (p.status || existing.status) : existing.status;
            const effStatusType = keepIncoming ? (p.statusType || existing.statusType) : existing.statusType;
            const effTotalOrd = (p.totalOrderedQty !== undefined && Number(p.totalOrderedQty) > 0) ? p.totalOrderedQty : (existing.totalOrderedQty !== undefined ? existing.totalOrderedQty : (incomingItems.length > 0 ? incomingItems.reduce((s, it) => s + Number(it.qty || 0), 0) : existingItems.reduce((s, it) => s + Number(it.qty || 0), 0)));
            const effTotalRec = (p.totalReceivedQty !== undefined && Number(p.totalReceivedQty) >= 0) ? p.totalReceivedQty : (existing.totalReceivedQty !== undefined ? existing.totalReceivedQty : (p.totalReceived !== undefined ? p.totalReceived : existing.totalReceived));
            const effRemaining = effTotalOrd !== undefined && effTotalRec !== undefined ? Math.max(0, Number(effTotalOrd) - Number(effTotalRec)) : (p.totalRemainingQty !== undefined ? p.totalRemainingQty : existing.totalRemainingQty);

            return {
              ...existing,
              ...p,
              status: effStatus,
              statusType: effStatusType,
              totalOrderedQty: effTotalOrd,
              totalReceivedQty: effTotalRec,
              totalRemainingQty: effRemaining,
              totalReceived: effTotalRec,
              receivingProgressPct: (Number(effTotalOrd) > 0 && Number(effTotalRec) >= 0) ? ((Number(effTotalRec) / Number(effTotalOrd)) * 100).toFixed(1) : (p.receivingProgressPct || existing.receivingProgressPct || '0.0'),
              grnCount: p.grnCount !== undefined ? p.grnCount : existing.grnCount,
              approvedBy: existing.approvedBy || p.approvedBy,
              approvalRemarks: existing.approvalRemarks || p.approvalRemarks,
              paymentDetails: p.paymentDetails || existing.paymentDetails,
              proceedDetails: p.proceedDetails || existing.proceedDetails,
              items: incomingItems.length > 0 ? incomingItems : existingItems,
              vendor: (existing.vendor && existing.vendor !== 'Vendor' && existing.vendor !== 'Annamalaiyar') ? existing.vendor : (p.vendor || existing.vendor || 'Vendor'),
              deliveryAddress: (p.deliveryAddress && p.deliveryAddress !== '—' && p.deliveryAddress !== '') ? p.deliveryAddress : (existing.deliveryAddress || '—'),
              billingAddress: (p.billingAddress && p.billingAddress !== '—' && p.billingAddress !== '') ? p.billingAddress : (existing.billingAddress || '—'),
              paymentTerms: (p.paymentTerms && p.paymentTerms !== 'Net 30 Days') ? p.paymentTerms : (existing.paymentTerms || p.paymentTerms || 'Due on Receipt'),
              notes: (p.notes && p.notes !== '') ? p.notes : (existing.notes || ''),
              terms: (p.terms && p.terms !== '') ? p.terms : (existing.terms || ''),
              scope: p.scope || existing.scope || 'Vendor Scope',
              priority: p.priority || existing.priority || 'High',
              transportName: p.transportName || existing.transportName || '',
              shippingCharges: p.shippingCharges !== undefined ? p.shippingCharges : (existing.shippingCharges || 0),
              otherCharges: p.otherCharges !== undefined ? p.otherCharges : (existing.otherCharges || 0),
              discountPct: p.discountPct !== undefined ? p.discountPct : (existing.discountPct || 0),
              purchaser: (p.purchaser && p.purchaser !== '—') ? p.purchaser : (existing.purchaser || '—'),
              amount: (p.amount && p.amount !== '₹0.00' && p.amount !== '₹ 0.00') ? p.amount : (existing.amount || p.amount)
            };
          }
          return p;
        });

        if (Array.isArray(incomingList) && incomingList.length === 0) {
          return [];
        }

        const existingKeys = new Set(mergedIncoming.map(p => normalize(p?.poNo || p?.id)));
        const safePrev = Array.isArray(currentPrev) ? currentPrev : [];
        const localOnly = safePrev.filter(p => {
          if (!p) return false;
          const k1 = normalize(p.poNo);
          const k2 = normalize(p.id);
          return (k1 && !existingKeys.has(k1)) && (k2 && !existingKeys.has(k2));
        });

        return [...mergedIncoming, ...localOnly];
      };

      const updateIfChanged = (incoming) => {
        setPoList(prev => {
          const merged = mergeWithPrev(incoming, prev);
          if (Array.isArray(prev) && prev.length === merged.length) {
            try {
              if (JSON.stringify(prev) === JSON.stringify(merged)) {
                return prev;
              }
            } catch (_) {}
          }
          return merged;
        });
      };

      if (Array.isArray(safePOs)) {
        updateIfChanged(safePOs);
      } else {
        const response = await fetchWithTimeout('/api/purchaseorders', { timeout: 25000 }).catch(() => null);
        if (response && response.ok) {
          const zohoPOs = await response.json().catch(() => []);
          if (Array.isArray(zohoPOs)) {
            updateIfChanged(zohoPOs);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching POs:", err);
    } finally {
      if (!isBackground) {
        setTableLoading(false);
      }
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchZohoPOs(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const fetchZohoDropdowns = async () => {
      try {
        const [safeVendors, safeItems] = await Promise.all([
          getVendors(),
          getItems()
        ]);
        if (Array.isArray(safeVendors) && safeVendors.length > 0) {
          setZohoVendors(safeVendors);
        } else {
          const vRes = await fetchWithTimeout('/api/vendors', { timeout: 25000 }).catch(() => null);
          if (vRes && vRes.ok) {
            const vData = await vRes.json().catch(() => []);
            setZohoVendors(vData || []);
          }
        }

        if (Array.isArray(safeItems) && safeItems.length > 0) {
          setZohoItems(safeItems);
        } else {
          const iRes = await fetchWithTimeout('/api/items', { timeout: 25000 }).catch(() => null);
          if (iRes && iRes.ok) {
            const iData = await iRes.json().catch(() => []);
            setZohoItems(iData || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch dropdown resources:", err);
      }
    };
    fetchZohoPOs();
    fetchZohoDropdowns();

    // Instant Real-Time Push Listener: Refetches POs the millisecond another user creates, approves, or modifies a PO
    const handlePoPush = () => {
      fetchZohoPOs(true);
    };

    const handleGrnCompleted = (e) => {
      const grn = e?.detail;
      if (grn) {
        const clean = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
        const poRef = clean(grn.poRef || grn.poNo);
        setPoList(prev => prev.map(p => {
          const pNo = clean(p.poNo);
          const pId = clean(p.id);
          const pZohoId = clean(p.zohoId);
          if (poRef && (pNo === poRef || pId === poRef || pZohoId === poRef)) {
            const isClosed = String(grn.status || '').toUpperCase().includes('CLOSED') || 
                             String(grn.status || '').toUpperCase().includes('FULLY') || 
                             grn.forceClosePO === true;
            const newStatus = isClosed ? 'CLOSED / FULLY RECEIVED' : 'OPEN / PARTIALLY RECEIVED';
            const accepted = Number(grn.acceptedQty !== undefined ? grn.acceptedQty : (grn.receivedQty || 0));
            const newRec = Number(p.totalReceivedQty || p.totalReceived || 0) + accepted;
            const newOrd = Number(p.totalOrderedQty || 0);
            return {
              ...p,
              status: newStatus,
              statusType: isClosed ? 'closed' : 'partially_received',
              order_status: isClosed ? 'closed' : 'received',
              totalReceivedQty: newRec,
              totalReceived: newRec,
              totalRemainingQty: Math.max(0, newOrd - newRec),
              receivingProgressPct: newOrd > 0 ? ((newRec / newOrd) * 100).toFixed(1) : (isClosed ? '100.0' : '0.0'),
              grnCount: (Number(p.grnCount) || 0) + 1
            };
          }
          return p;
        }));
      }
      fetchZohoPOs(true);
    };

    window.addEventListener('controlroom_po_updated', handlePoPush);
    window.addEventListener('controlroom_storage_update', handlePoPush);
    window.addEventListener('controlroom_grn_completed', handleGrnCompleted);

    return () => {
      window.removeEventListener('controlroom_po_updated', handlePoPush);
      window.removeEventListener('controlroom_storage_update', handlePoPush);
      window.removeEventListener('controlroom_grn_completed', handleGrnCompleted);
    };
  }, []);

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
  const [newSetUnit, setNewSetUnit] = useState('Sets');
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
  const [validationErrorModal, setValidationErrorModal] = useState(null);
  const [customAlert, setCustomAlert] = useState(null);

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
        const grpTaxPct = parseFloat(String(grp.gstRate || '18').replace('%', '')) || 18;
        setsTax += grpTaxable * (grpTaxPct / 100);
      }
    });
    return (standaloneTax + setsTax) / 2;
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
    const unit = newSetUnit || 'Sets';
    const count = unit === 'kW' ? Math.max(0.01, parseFloat(newSetCount) || 1) : Math.max(1, parseInt(newSetCount, 10) || 1);
    const groupId = 'po_set_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const setGst = newSetGstRate || '18%';
    const taxNum = parseFloat(String(setGst).replace('%', '')) || 18;

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
    setNewSetUnit('Sets');
    setNewSetPrice('');
    setNewSetGstRate('18%');
    setShowCreateSetModal(false);
  };

  const handleAddSetItem = (groupId) => {
    const grp = presetGroups[groupId];
    if (!grp) return;
    const taxNum = parseFloat(String(grp.gstRate || '18').replace('%', '')) || 18;
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
        const ship = vLocs.find(l => l.id === 'factory_plant') || vLocs[1] || reg;
        setBillingLocationId(reg.id);
        setBillingAddress1(reg.address1 || '');
        setBillingAddress2(reg.address2 || '');
        setBillingCity(reg.city || '');
        setBillingState(reg.state || '');
        setBillingPincode(reg.pincode || '');
        setBillingAddress(formatAddressObj(reg));

        setDeliveryLocationId(ship.id);
        setDeliveryAddress1(ship.address1 || '');
        setDeliveryAddress2(ship.address2 || '');
        setDeliveryCity(ship.city || '');
        setDeliveryState(ship.state || '');
        setDeliveryPincode(ship.pincode || '');
        setDeliveryAddress(formatAddressObj(ship));
      } else {
        const vAddr = found.billingAddress || found.address || found.registeredAddress || `${val}, Main Road, Industrial Estate, Tamil Nadu - 600028`;
        setBillingAddress(vAddr);
        const parsedV = parseAddressString(vAddr);
        setBillingAddress1(found.billingAddress1 || found.address1 || parsedV.address1 || '');
        setBillingAddress2(found.billingAddress2 || found.address2 || parsedV.address2 || '');
        setBillingCity(found.billingCity || found.city || parsedV.city || '');
        setBillingState(found.billingState || found.state || parsedV.state || '');
        setBillingPincode(found.billingPincode || found.pincode || parsedV.pincode || '');

        setDeliveryAddress1(found.billingAddress1 || found.address1 || parsedV.address1 || '');
        setDeliveryAddress2(found.billingAddress2 || found.address2 || parsedV.address2 || '');
        setDeliveryCity(found.billingCity || found.city || parsedV.city || '');
        setDeliveryState(found.billingState || found.state || parsedV.state || '');
        setDeliveryPincode(found.billingPincode || found.pincode || parsedV.pincode || '');
        setDeliveryAddress(vAddr);
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

  const triggerSaveConfirm = (e) => {
    if (e) e.preventDefault();
    executeCreatePO(e, 'Draft / Pending Approval');
  };

  const executeCreatePO = (e, targetStatus = 'Draft / Pending Approval') => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmittingPO) return;
    setIsSubmittingPO(true);

    const statusToSave = typeof targetStatus === 'string' ? targetStatus : 'Draft / Pending Approval';
    const isDraft = statusToSave === 'Draft' || statusToSave === 'DRAFT';

    // Validate mandatory fields marked with red asterisk *
    const missingFields = [];
    if (!vendorName || String(vendorName).trim() === '') missingFields.push('Vendor Name');
    const effDelAddress = formatAddressObj({ address1: deliveryAddress1, address2: deliveryAddress2, city: deliveryCity, state: deliveryState, pincode: deliveryPincode }) || (deliveryAddress || '').trim();
    const effBillAddress = formatAddressObj({ address1: billingAddress1, address2: billingAddress2, city: billingCity, state: billingState, pincode: billingPincode }) || (billingAddress || '').trim();
    if (!effDelAddress || (!deliveryAddress1.trim() && !deliveryCity.trim() && !deliveryAddress.trim())) missingFields.push('Delivery Address');
    if (!poDate || String(poDate).trim() === '') missingFields.push('PO Date');
    if (!deliveryDate || String(deliveryDate).trim() === '') missingFields.push('Expected Delivery Date');
    if (!paymentTerms || String(paymentTerms).trim() === '') missingFields.push('Payment Terms');
    if (!purchaser || String(purchaser).trim() === '') missingFields.push('PO Issued By');
    if (!shipmentPref || String(shipmentPref).trim() === '') missingFields.push('Shipment Preference');
    if (!currency || String(currency).trim() === '') missingFields.push('Currency');
    if (!priority || String(priority).trim() === '') missingFields.push('Priority');

    const validItems = (items || []).filter(it => it && String(it.name || '').trim() !== '' && Number(it.qty) > 0);
    if (validItems.length === 0) {
      missingFields.push('Line Items (Must add at least 1 valid item with Name and Quantity)');
    }

    if (missingFields.length > 0) {
      setIsSubmittingPO(false);
      setValidationErrorModal({ fields: missingFields });
      return;
    }

    let effectiveItems = validItems.map(it => ({
      name: String(it.name || it.itemName || '').trim(),
      description: String(it.description || it.desc || '').trim(),
      hsn: it.hsn || it.hsn_or_sac || '',
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
      deliveryDate: formatDelivery,
      paymentTerms: paymentTerms || 'Due on Receipt',
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

        // Trigger real-time notification to CEO for review & approval
        if (newPO.status === 'Draft / Pending Approval' || newPO.statusType === 'pending' || String(newPO.approvalRequired).toUpperCase() === 'YES') {
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
    setViewingPoStatus('MD Approved');
    const updatedApprovedPo = { 
      ...poTarget, 
      status: 'MD Approved', 
      statusType: 'md_approved',
      approvedBy: 'Velmurugan Rathinam (MD)',
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

    const updatedPaymentPo = {
      ...poTarget,
      status: 'Payment Processed',
      statusType: 'payment_processed',
      order_status: 'payment_processed',
      paymentDetails: {
        mode: payModeInput,
        refNo: payRefInput || (isCredit ? 'CREDIT-CONFIRMED' : ''),
        amount: payAmountInput ? `₹ ${Number(payAmountInput).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : poTarget.amount,
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
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

    const defaultMsg = `Dear ${poTarget.vendor || 'Vendor'},

Greetings from BUSINZ.

Please find the official Purchase Order ${poTarget.poNo || poTarget.id} details below:

📦 Purchase Order Details:
• PO Number: ${poTarget.poNo || poTarget.id}
• Total Amount: ${poTarget.amount || '—'}
• Date: ${poTarget.date || new Date().toLocaleDateString('en-GB')}
• Delivery Terms: ${poTarget.deliveryTerms || 'Immediate / Standard'}

💳 Payment Clearance & Settlement:
• Status: Verified & Approved by Accounts Team
• Payment Mode: ${pd?.mode || 'Bank Transfer'}
• Reference / UTR No: ${pd?.refNo || 'TXN-CONFIRMED'}
• Amount Verified: ${pd?.amount || poTarget.amount || '—'}
• Payment Proof Receipts: ${allImages.length > 0 ? `${allImages.length} verified payment receipt(s) attached` : 'Credit Mode / Net Terms Authorized'}

Please acknowledge receipt of this Purchase Order and confirm your delivery schedule.

Thank you,
Procurement Team | BUSINZ`;

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
    const proceedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const proceedTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const remarks = proceedRemarksInput || 'Authorized for dispatch and GRN creation';
    const targetVendorEmail = (proceedEmailInput || poTarget.email || email || '').trim();
    const targetVendorPhone = (proceedPhoneInput || poTarget.phone || '').trim();

    const proceedDetails = {
      date: proceedDate,
      time: proceedTime,
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
    setVendorName('');
    setBranch('VRM Structures India Pvt Ltd');
    setCompanyLocation('VRM Structures India Pvt Ltd');
    setContactPerson('');
    setContactNo('');
    setEmail('');
    setGstNo('');
    setDeliveryType('Organization');
    setDeliveryAddress('');
    setDeliveryAddress1('');
    setDeliveryAddress2('');
    setDeliveryCity('');
    setDeliveryState('');
    setDeliveryPincode('');
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

  const executeDeletePO = () => {
    if (deleteIdx !== null && poList[deleteIdx]) {
      const targetPO = poList[deleteIdx];
      const targetId = targetPO.poNo || targetPO.id;

      setPoList(prev => prev.filter((_, i) => i !== deleteIdx));
      setDeleteIdx(null);

      if (targetId) {
        fetch(`/api/purchaseorders/${encodeURIComponent(targetId)}`, {
          method: 'DELETE'
        }).then(res => res.json()).then(data => {
          console.log('PO deleted:', data);
          fetchZohoPOs();
        }).catch(err => {
          console.error('Failed to delete PO in backend:', err);
          fetchZohoPOs();
        });
      }
    }
  };

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

  const renderStatusBadge = (type, label) => {
    const raw = String(label || type || '').trim();
    if (isAccounts && (raw === 'MD Approved' || raw === 'md_approved')) {
      return <StatusBadge status="Awaiting Accounts Verification" size="sm" />;
    }
    if (raw === 'Draft' || raw === 'Draft / Pending Approval' || raw === 'Pending MD Approval' || raw === 'Pending Approval' || raw === 'pending') {
      return <StatusBadge status="Pending Approval" customLabel="Pending Approval" size="sm" />;
    }
    if (raw === 'CLOSED / FULLY RECEIVED' || raw === 'Closed / Fully Received' || raw.toLowerCase().includes('fully received') || raw.toLowerCase() === 'closed') {
      return <StatusBadge status="Fully Received" customLabel="Fully Received" size="sm" />;
    }
    if (raw === 'OPEN / PARTIALLY RECEIVED' || raw === 'Partially Received' || raw.toLowerCase().includes('partially')) {
      return <StatusBadge status="Partially Received" customLabel="Partially Received" size="sm" />;
    }
    if (raw === 'Payment Processed / Credit Verified' || raw === 'Payment Processed') {
      return <StatusBadge status="Payment Processed" customLabel="Payment Processed" size="sm" />;
    }
    if (raw === 'Proceed PO (GRN Ready)' || raw === 'Proceed PO') {
      return <StatusBadge status="Proceed PO" customLabel="Proceed PO" size="sm" />;
    }
    if (raw === 'CANCELLED' || raw === 'Cancelled') {
      return <StatusBadge status="Cancelled" customLabel="Cancelled" size="sm" />;
    }
    return <StatusBadge status={label || type} size="sm" />;
  };

  const renderPoReadOnlyDocument = () => (
            /* ==================== PREMIUM READ-ONLY PO DOCUMENT LAYOUT ==================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

              {/* Visual PO Workflow History Timeline */}
              <div className="section-card po-lifecycle-timeline po-no-print" style={{ padding: '20px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px', color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PO Lifecycle & Workflow History</strong>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>PO Ref: {poNumber}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '10px 0' }}>
                  {(() => {
                    const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber);

                    let hasLocalGrn = false;
                    let isLocalGrnClosed = false;
                    try {
                      const localGrns = JSON.parse(localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes') || '[]');
                      if (Array.isArray(localGrns)) {
                        const matched = localGrns.filter(g => {
                          const gRef = String(g.poRef || g.poNo || g.poId || '').toLowerCase().trim();
                          const pRef = String(poNumber || '').toLowerCase().trim();
                          return gRef && pRef && (gRef === pRef || gRef.includes(pRef) || pRef.includes(gRef));
                        });
                        if (matched.length > 0) {
                          hasLocalGrn = true;
                          isLocalGrnClosed = matched.some(g => {
                            const gst = String(g.status || '').toUpperCase();
                            return gst.includes('CLOSED') || gst.includes('FULLY RECEIVED') || gst.includes('FULLY ACCEPTED');
                          });
                        }
                      }
                    } catch (_) {}

                    const st = String(viewingPoStatus || currentPoObj?.status || 'Draft / Pending Approval').trim();
                    const objStatus = String(currentPoObj?.status || '').trim();
                    const objStatusType = String(currentPoObj?.statusType || '').toLowerCase();
                    const totalRec = Number(currentPoObj?.totalReceived || currentPoObj?.totalReceivedQty || 0);
                    const grnCount = Number(currentPoObj?.grnCount || (currentPoObj?.grnHistory ? currentPoObj.grnHistory.length : 0));

                    const isClosed = st.includes('CLOSED') || st.includes('FULLY RECEIVED') || objStatus.includes('CLOSED') || objStatusType === 'closed' || isLocalGrnClosed;
                    const isPartial = st.includes('PARTIALLY') || objStatus.includes('PARTIALLY') || objStatusType === 'partially_received' || totalRec > 0 || hasLocalGrn || grnCount > 0;
                    const isProceed = st === 'Proceed PO' || st === 'PROCEED PO' || objStatus === 'Proceed PO' || objStatusType === 'proceed_po' || !!currentPoObj?.proceedDetails || isPartial || isClosed;
                    const isPaymentDone = st === 'Payment Processed' || objStatus === 'Payment Processed' || objStatusType === 'payment_processed' || !!currentPoObj?.paymentDetails || isProceed;
                    const isMdApproved = st === 'MD Approved' || st === 'OPEN' || st === 'Approved' || objStatus === 'MD Approved' || objStatusType === 'approved' || objStatusType === 'md_approved' || isPaymentDone;
                    const isDraft = (st === 'Draft' || st === 'DRAFT' || objStatus === 'Draft') && !isMdApproved;
                    const isPending = (st === 'Draft / Pending Approval' || st.includes('Pending') || st.includes('WAITING') || objStatusType === 'pending') && !isMdApproved;

                    // 6-STAGE WORKFLOW HIERARCHY:
                    // Stage 0: 1. PO Created
                    // Stage 1: 2. MD Approval
                    // Stage 2: 3. Payment Process
                    // Stage 3: 4. Proceed PO
                    // Stage 4: 5. GRN Process
                    // Stage 5: 6. GRN Completed

                    let currentStepIndex = 1;
                    if (isClosed) {
                      currentStepIndex = 5;
                    } else if (isPartial || isProceed || hasLocalGrn || grnCount > 0) {
                      currentStepIndex = 4;
                    } else if (isPaymentDone) {
                      currentStepIndex = 3;
                    } else if (isMdApproved) {
                      currentStepIndex = 2;
                    } else if (isPending) {
                      currentStepIndex = 1;
                    } else if (isDraft) {
                      currentStepIndex = 0;
                    }

                    const steps = [
                      { label: '1. PO Created' },
                      { label: '2. MD Approval' },
                      { label: '3. Payment Process' },
                      { label: '4. Proceed PO' },
                      { label: '5. GRN Process' },
                      { label: '6. GRN Completed' }
                    ];

                    return steps.map((step, idx) => {
                      const isDone = idx < currentStepIndex || (currentStepIndex === 5 && idx === 5);
                      const isCurrent = idx === currentStepIndex && currentStepIndex !== 5;
                      const isFinalDone = currentStepIndex === 5 && idx === 5;

                      return {
                        ...step,
                        done: isDone,
                        current: isCurrent,
                        finalDone: isFinalDone
                      };
                    });
                  })().map((step, idx, arr) => (
                    <React.Fragment key={idx}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 2, flex: 1 }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: step.current ? '#2563EB' : (step.done || step.finalDone ? '#16A34A' : '#E2E8F0'),
                          color: (step.current || step.done || step.finalDone) ? '#FFFFFF' : '#64748B',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          boxShadow: step.current ? '0 0 0 4px #DBEAFE' : 'none'
                        }}>
                          {(step.done || step.finalDone) ? '✓' : (idx + 1)}
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: step.current ? 'bold' : '600', color: step.current ? '#2563EB' : ((step.done || step.finalDone) ? '#16A34A' : '#64748B'), textAlign: 'center' }}>
                          {step.label}
                        </span>
                      </div>
                      {idx < arr.length - 1 && (
                        <div style={{ height: '2px', backgroundColor: step.done ? '#16A34A' : '#E2E8F0', flex: 1, marginTop: '-16px' }} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Official Purchase Order Header Card */}
              <div id="businz-po-official-document" className="section-card businz-po-document" style={{ padding: '30px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative', borderTop: '4px solid #0E7490', backgroundColor: '#FFFFFF', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  {(() => {
                    const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber);
                    const effLocation = currentPoObj?.companyLocation || currentPoObj?.branch || companyLocation || 'VRM Structures India Pvt Ltd';
                    const comp = getCompanyProfile(effLocation);
                    return (
                      <div>
                        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#1E293B', margin: 0, letterSpacing: '-0.5px' }}>
                          {comp.name}
                        </h1>
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>{comp.address}</span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '2px' }}>
                          GSTIN: <strong>{comp.gst}</strong> | {comp.email} | {comp.phone}
                        </span>
                      </div>
                    );
                  })()}
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                    <div style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A', letterSpacing: '1px' }}>PURCHASE ORDER</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px', color: '#0E7490' }}>{poNumber}</strong>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        backgroundColor: (priority === 'Critical' || priority === 'High') ? '#FEE2E2' : (priority === 'Medium' ? '#FEF3C7' : '#ECFEFF'),
                        color: (priority === 'Critical' || priority === 'High') ? '#EF4444' : (priority === 'Medium' ? '#D97706' : '#0E7490')
                      }}>{priority} Priority</span>
                    </div>
                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: 0 }} />

                {/* Info Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', fontSize: '11px' }}>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>PO Date</span>
                    <strong style={{ color: '#1E293B', display: 'block', marginTop: '2px' }}>{poDate}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>Expected Delivery Date</span>
                    <strong style={{ color: '#1E293B', display: 'block', marginTop: '2px' }}>{deliveryDate || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>Payment Terms</span>
                    <strong style={{ color: '#1E293B', display: 'block', marginTop: '2px' }}>{paymentTerms}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B', display: 'block', textTransform: 'uppercase', fontSize: '9px', fontWeight: 'bold' }}>PO Issued By</span>
                    <strong style={{ color: '#1E293B', display: 'block', marginTop: '2px' }}>{purchaser}</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', fontSize: '11px' }}>

                  {/* Vendor Details Card */}
                  <div style={{ border: '1px solid #F1F5F9', borderRadius: '8px', padding: '16px', backgroundColor: '#F8FAFC' }}>
                    <strong style={{ fontSize: '11px', color: '#2563EB', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Vendor Details</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <strong style={{ fontSize: '13px', color: '#0F172A' }}>{vendorName}</strong>
                      {branch && <span style={{ color: '#475569' }}>Branch: {branch}</span>}
                      {contactPerson && <span style={{ color: '#475569' }}>Attn: {contactPerson}</span>}
                      {contactNo && <span style={{ color: '#475569' }}>Phone: {contactNo}</span>}
                      {email && <span style={{ color: '#475569' }}>Email: {email}</span>}
                      {gstNo && <span style={{ color: '#475569', fontWeight: 'bold' }}>GSTIN: {gstNo}</span>}
                    </div>
                  </div>

                  {/* Address Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ border: '1px solid #F1F5F9', borderRadius: '8px', padding: '12px', backgroundColor: '#FFFFFF' }}>
                      <strong style={{ fontSize: '9px', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Delivery Address</strong>
                      <span style={{ color: '#334155', lineHeight: '1.4' }}>{deliveryAddress || '—'}</span>
                    </div>
                    <div style={{ border: '1px solid #F1F5F9', borderRadius: '8px', padding: '12px', backgroundColor: '#FFFFFF' }}>
                      <strong style={{ fontSize: '9px', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Billing Address</strong>
                      <span style={{ color: '#334155', lineHeight: '1.4' }}>{billingAddress || '—'}</span>
                    </div>
                  </div>

                </div>

                {/* Line Items Table */}
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table className="custom-table detail-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ padding: '8px', textAlign: 'center', width: '40px' }}>#</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Item & Description</th>
                        <th style={{ padding: '8px', textAlign: 'left' }}>Account</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Unit</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Rate (₹)</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>GST (%)</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => {
                        const itemTax = (item.tax !== undefined && item.tax !== '' && !isNaN(Number(item.tax))) ? Number(item.tax) : 18;
                        const qtyNum = Number(item.qty) || 0;
                        const rateNum = Number(item.rate) || 0;
                        const total = qtyNum * rateNum;
                        const taxAmt = total * (itemTax / 100);
                        const finalAmt = total + taxAmt;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748B' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 8px', color: '#1E293B' }}>
                              <div style={{ fontWeight: '600' }}>{item.name}</div>
                              {item.description && (
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', fontWeight: '400', lineHeight: '1.3', whiteSpace: 'pre-wrap' }}>
                                  {item.description}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 8px', color: '#475569' }}>{item.account}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>{qtyNum}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748B' }}>{item.unit}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right' }}>{rateNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748B' }}>{itemTax}%</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold', color: '#0F172A' }}>{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan="8" style={{ padding: '20px', textAlign: 'center', color: '#94A3B8' }}>No items added.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Notes and Calculations */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', marginTop: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '11px' }}>
                    {notes && (
                      <div>
                        <strong style={{ color: '#475569', display: 'block', marginBottom: '4px' }}>Notes & Remarks</strong>
                        <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', color: '#334155', whiteSpace: 'pre-wrap' }}>{notes}</div>
                      </div>
                    )}
                    {terms && (
                      <div>
                        <strong style={{ color: '#475569', display: 'block', marginBottom: '4px' }}>Terms & Conditions</strong>
                        <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', color: '#334155', whiteSpace: 'pre-wrap' }}>{terms}</div>
                      </div>
                    )}
                  </div>

                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', backgroundColor: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Subtotal</span>
                      <strong style={{ color: '#1E293B' }}>₹ {items.reduce((acc, curr) => acc + (curr.qty * curr.rate), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    {discountPct > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444' }}>
                        <span>Discount ({discountPct}%)</span>
                        <strong>- ₹ {(items.reduce((acc, curr) => acc + (curr.qty * curr.rate), 0) * (discountPct / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>CGST ({getEffectiveCGSTPct()}%)</span>
                      <strong style={{ color: '#1E293B' }}>₹ {getCGST().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>SGST ({getEffectiveSGSTPct()}%)</span>
                      <strong style={{ color: '#1E293B' }}>₹ {getSGST().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    {shippingCharges > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Shipping Charges</span>
                        <strong style={{ color: '#1E293B' }}>₹ {shippingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    )}
                    {otherCharges > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748B' }}>Other Charges</span>
                        <strong style={{ color: '#1E293B' }}>₹ {otherCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    )}
                    <hr style={{ border: 'none', borderTop: '1px solid #E2E8F0', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <strong style={{ color: '#0F172A' }}>Grand Total</strong>
                      <strong style={{ color: '#2563EB', fontSize: '14px' }}>₹ {getGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                </div>

                {/* Priority & Project information */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid #E2E8F0', paddingTop: '16px', fontSize: '11px', color: '#475569' }}>
                  {approvalRequired === 'Yes' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                      <span>Approval required from <strong>{approver}</strong></span>
                    </div>
                  )}
                  {scope && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                      <span>Scope: <strong>{scope}</strong></span>
                    </div>
                  )}
                  {shipmentPref && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3B82F6' }} />
                      <span>Shipment Preference: <strong>{shipmentPref}</strong></span>
                    </div>
                  )}
                  {shipmentPref === 'Transport' && transportName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#06B6D4' }} />
                      <span>Transport Name: <strong>{transportName}</strong></span>
                    </div>
                  )}
                  {project && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#8B5CF6' }} />
                      <span>Project: <strong>{project}</strong></span>
                    </div>
                  )}
                </div>

                {/* Accounts Payment Verification & Proof Card (if verified) */}
                {(() => {
                  const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber);
                  const pd = currentPoObj?.paymentDetails;
                  if (!pd) return null;

                  return (
                    <div style={{
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle size={16} style={{ color: '#059669' }} />
                          <strong style={{ fontSize: '13px', color: '#0F172A' }}>Accounts Payment Verification Details</strong>
                        </div>
                        <span style={{ fontSize: '11px', color: '#059669', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>
                          Verified on {pd.date} {pd.time}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '12px' }}>
                        <div>
                          <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Payment Mode</span>
                          <strong style={{ color: '#1E293B' }}>{pd.mode || 'Bank Transfer'}</strong>
                        </div>
                        {pd.refNo && pd.refNo !== 'CREDIT-CONFIRMED' && (
                          <div>
                            <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Transaction / UTR Ref</span>
                            <strong style={{ color: '#0E7490' }}>{pd.refNo}</strong>
                          </div>
                        )}
                        <div>
                          <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Amount Recorded</span>
                          <strong style={{ color: '#1E293B' }}>{pd.amount || '—'}</strong>
                        </div>
                        {pd.remarks && (
                          <div>
                            <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Accounts Notes</span>
                            <span style={{ color: '#334155' }}>{pd.remarks}</span>
                          </div>
                        )}
                      </div>

                      {(() => {
                        const proofImages = Array.isArray(pd.paymentImages) && pd.paymentImages.length > 0
                          ? pd.paymentImages
                          : (pd.paymentImage ? [{ dataUrl: pd.paymentImage, name: pd.paymentImageMeta?.name || 'Payment_Proof.jpg', size: pd.paymentImageMeta?.size || '' }] : []);

                        if (proofImages.length === 0) return null;

                        return (
                          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Image size={13} style={{ color: '#0E7490' }} /> Attached Payment Proof Receipts ({proofImages.length} image{proofImages.length > 1 ? 's' : ''}):
                              </span>
                              <span style={{ fontSize: '10.5px', color: '#64748B' }}>Click any receipt to zoom preview</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                              {proofImages.map((imgObj, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => setPreviewZoomImage(imgObj)}
                                  style={{
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '8px',
                                    padding: '6px',
                                    backgroundColor: '#FFFFFF',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    transition: 'all 0.15s ease',
                                    position: 'relative'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.transform = 'none'; }}
                                >
                                  <div style={{ position: 'relative', width: '100%', height: '70px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#F1F5F9' }}>
                                    <img
                                      src={imgObj.dataUrl || imgObj}
                                      alt={imgObj.name || `Proof ${idx + 1}`}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <div style={{ position: 'absolute', bottom: '4px', right: '4px', backgroundColor: 'rgba(15, 23, 42, 0.7)', borderRadius: '4px', padding: '2px 4px', display: 'flex', alignItems: 'center', color: '#FFFFFF' }}>
                                      <Maximize2 size={11} />
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {imgObj.name || `Receipt #${idx + 1}`}
                                    </span>
                                    {imgObj.size && (
                                      <span style={{ fontSize: '9.5px', color: '#64748B' }}>{imgObj.size}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* Proceed PO (Ready for GRN) Authorization Details Card (if proceeded) */}
                {(() => {
                  const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber);
                  const prd = currentPoObj?.proceedDetails;
                  if (!prd && viewingPoStatus !== 'Proceed PO' && currentPoObj?.status !== 'Proceed PO') return null;

                  return (
                    <div style={{
                      backgroundColor: '#ECFEFF',
                      border: '1px solid #A5F3FC',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle size={16} style={{ color: '#0E7490' }} />
                          <strong style={{ fontSize: '13px', color: '#0F172A' }}>Proceed PO Authorization (Ready for GRN)</strong>
                        </div>
                        {prd?.date && (
                          <span style={{ fontSize: '11px', color: '#0E7490', backgroundColor: '#CFFAFE', border: '1px solid #A5F3FC', padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>
                            Authorized on {prd.date} {prd.time}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '12px' }}>
                        <div>
                          <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Status</span>
                          <strong style={{ color: '#0E7490' }}>Eligible & Ready for GRN Receiving</strong>
                        </div>
                        <div>
                          <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Authorized By</span>
                          <strong style={{ color: '#1E293B' }}>{prd?.authorizedBy || 'Procurement Head'}</strong>
                        </div>
                        {(prd?.vendorEmail || currentPoObj?.email) && (
                          <div>
                            <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Vendor PO Dispatch</span>
                            <span style={{ color: '#0E7490', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Mail size={12} /> Dispatched to {prd?.vendorEmail || currentPoObj?.email}
                            </span>
                          </div>
                        )}
                        {prd?.remarks && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <span style={{ color: '#64748B', display: 'block', fontSize: '11px' }}>Proceed Remarks</span>
                            <span style={{ color: '#334155' }}>{prd.remarks}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* GRN Inwarding & Receipt History Card for Accounts & Procurement (Partial & Full) */}
                {(() => {
                  let matchedGrns = [];
                  try {
                    const localGrns = JSON.parse(localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes') || '[]');
                    if (Array.isArray(localGrns)) {
                      matchedGrns = localGrns.filter(g => {
                        const gRef = String(g.poRef || g.poNo || g.poId || '').toLowerCase().trim();
                        const pRef = String(poNumber || '').toLowerCase().trim();
                        return gRef && pRef && (gRef === pRef || gRef.includes(pRef) || pRef.includes(gRef));
                      });
                    }
                  } catch (_) {}

                  if (matchedGrns.length === 0) return null;

                  return (
                    <div style={{
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileCheck size={18} style={{ color: '#0E7490' }} />
                          <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                            GRN Inwarding & Delivery Receipts ({matchedGrns.length})
                          </strong>
                          <span style={{ fontSize: '11px', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                            Sent to Accounts for Bill Verification
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            if (typeof onNavigateTab === 'function') {
                              onNavigateTab('Goods Receipt Note');
                            } else {
                              localStorage.setItem('controlroom_active_tab', 'Goods Receipt Note');
                              window.location.reload();
                            }
                          }}
                          style={{
                            border: '1px solid #0E7490',
                            backgroundColor: '#FFFFFF',
                            color: '#0E7490',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <ExternalLink size={12} /> Open Full GRN Ledger
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {matchedGrns.map((g, gIdx) => {
                          const isFullyRec = String(g.status || '').toUpperCase().includes('FULLY') || String(g.status || '').toUpperCase().includes('CLOSED');
                          const recQty = g.receivedQty || (Array.isArray(g.items) ? g.items.reduce((s, it) => s + Number(it.accepted || it.now || 0), 0) : '—');
                          const accQty = g.acceptedQty !== undefined ? g.acceptedQty : recQty;
                          const rejQty = Number(g.rejectedQty || 0);

                          return (
                            <div key={gIdx} style={{
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #E2E8F0',
                              borderRadius: '8px',
                              padding: '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '10px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{
                                  width: '28px', height: '28px', borderRadius: '6px',
                                  backgroundColor: isFullyRec ? '#DCFCE7' : '#FEF3C7',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                  <Boxes size={14} style={{ color: isFullyRec ? '#166534' : '#B45309' }} />
                                </div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <strong style={{ fontSize: '12.5px', color: '#0F172A' }}>{g.grnNo || g.id}</strong>
                                    <span style={{
                                      fontSize: '10px',
                                      fontWeight: '700',
                                      padding: '1px 6px',
                                      borderRadius: '6px',
                                      backgroundColor: isFullyRec ? '#DCFCE7' : '#FEF3C7',
                                      color: isFullyRec ? '#166534' : '#B45309',
                                      border: isFullyRec ? '1px solid #86EFAC' : '1px solid #FDE68A'
                                    }}>
                                      {isFullyRec ? 'Fully Received' : 'Partially Received'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                                    Date: {g.date || '—'} • DC / Inv No: <strong>{g.challanNo || '—'}</strong> • Received by: {g.receivedBy || 'Store Inwarder'}
                                  </div>
                                </div>
                              </div>

                              <div style={{ textAlign: 'right', fontSize: '11.5px' }}>
                                <div>
                                  <strong style={{ color: '#0E7490' }}>{recQty} Units</strong> Received
                                  {rejQty > 0 && <span style={{ color: '#DC2626', marginLeft: '4px' }}>({rejQty} rejected)</span>}
                                </div>
                                <div style={{ fontSize: '10.5px', color: '#166534', fontWeight: '600', marginTop: '2px' }}>
                                  ✓ Inwarded into Live Inventory
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Bottom Review & Approval Action Card for Executive / Approver */}
                {(() => {
                  const st = String(viewingPoStatus || '').trim();
                  const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber) || {
                    poNo: poNumber,
                    vendor: vendorName,
                    amount: `₹ ${Number(getGrandTotal() || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    paymentTerms
                  };
                  const objStatus = String(currentPoObj?.status || '').trim();
                  const objStatusType = String(currentPoObj?.statusType || '').toLowerCase();
                  
                  let hasLocalGrn = false;
                  let isLocalGrnClosed = false;
                  try {
                    const localGrns = JSON.parse(localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes') || '[]');
                    if (Array.isArray(localGrns)) {
                      const matched = localGrns.filter(g => {
                        const gRef = String(g.poRef || g.poNo || g.poId || '').toLowerCase().trim();
                        const pRef = String(poNumber || '').toLowerCase().trim();
                        return gRef && pRef && (gRef === pRef || gRef.includes(pRef) || pRef.includes(gRef));
                      });
                      if (matched.length > 0) {
                        hasLocalGrn = true;
                        isLocalGrnClosed = matched.some(g => {
                          const gst = String(g.status || '').toUpperCase();
                          return gst.includes('CLOSED') || gst.includes('FULLY RECEIVED') || gst.includes('FULLY ACCEPTED');
                        });
                      }
                    }
                  } catch (_) {}

                  const totalRec = Number(currentPoObj?.totalReceived || currentPoObj?.totalReceivedQty || 0);
                  const grnCount = Number(currentPoObj?.grnCount || (currentPoObj?.grnHistory ? currentPoObj.grnHistory.length : 0));
                  const isClosed = st.includes('CLOSED') || st.includes('FULLY RECEIVED') || objStatus.includes('CLOSED') || objStatusType === 'closed' || isLocalGrnClosed;
                  const isAlreadyInGrnProcessOrPartial = !isClosed && (
                    st.toUpperCase().includes('PARTIAL') ||
                    objStatus.toUpperCase().includes('PARTIAL') ||
                    objStatusType.includes('partial') ||
                    st.toUpperCase().includes('PACKED') ||
                    objStatus.toUpperCase().includes('PACKED') ||
                    objStatusType.includes('packed') ||
                    st.toUpperCase().includes('GRN PROCESS') ||
                    objStatus.toUpperCase().includes('GRN PROCESS') ||
                    totalRec > 0 ||
                    hasLocalGrn ||
                    grnCount > 0
                  );
                  const isProceedPoOnly = !isClosed && !isAlreadyInGrnProcessOrPartial && (st === 'Proceed PO' || st === 'PROCEED PO' || objStatus === 'Proceed PO' || objStatusType === 'proceed_po');
                  const isGrnProcess = isAlreadyInGrnProcessOrPartial || isProceedPoOnly;
                  const isPaymentProcessed = !isClosed && !isGrnProcess && (st === 'Payment Processed' || objStatus === 'Payment Processed' || objStatusType === 'payment_processed');
                  const isAlreadyApproved = isClosed || isGrnProcess || isPaymentProcessed || st === 'MD Approved' || objStatus === 'MD Approved' || objStatusType === 'md_approved' || Boolean(currentPoObj?.approvedBy);

                  const isDraftOrPending = !isAlreadyApproved && st !== 'REJECTED' && objStatus !== 'REJECTED';

                  return (
                    <div className="po-view-footer-actions po-no-print" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '16px 24px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      marginTop: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              sessionStorage.removeItem('controlroom_po_view_mode');
                              sessionStorage.removeItem('controlroom_viewing_po');
                            } catch (_) {}
                            setViewMode('list');
                          }}
                          style={{
                            backgroundColor: 'white',
                            border: '1px solid #CBD5E1',
                            borderRadius: '8px',
                            padding: '8px 18px',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#475569',
                            cursor: 'pointer'
                          }}
                        >
                          ← Back to PO List
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintPoModal({
                            ...(currentPoObj || {}),
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
                            billingAddress,
                            items,
                            notes,
                            terms,
                            discountPct,
                            shippingCharges,
                            otherCharges
                          })}
                          style={{
                            backgroundColor: 'white',
                            border: '1px solid #CBD5E1',
                            borderRadius: '8px',
                            padding: '8px 18px',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#475569',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <FileText size={14} style={{ color: '#059669' }} /> Export / Print PDF
                        </button>

                        {/* Cancel PO action */}
                        {!isClosed && String(viewingPoStatus || currentPoObj?.status || '').toUpperCase() !== 'CANCELLED' && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancellingPo(currentPoObj);
                              setCancellationRemarkInput('');
                            }}
                            style={{
                              backgroundColor: '#FEF2F2',
                              border: '1px solid #FECACA',
                              borderRadius: '8px',
                              padding: '8px 18px',
                              fontSize: '13px',
                              fontWeight: '700',
                              color: '#DC2626',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Ban size={15} style={{ color: '#DC2626' }} /> Cancel PO
                          </button>
                        )}
                        {String(viewingPoStatus || currentPoObj?.status || '').toUpperCase() === 'CANCELLED' && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#FEF2F2',
                            border: '1px solid #FECACA',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#DC2626'
                          }}>
                            <Ban size={14} style={{ color: '#DC2626' }} /> Cancelled: {currentPoObj?.cancelReason || currentPoObj?.cancellationRemark || 'Order Cancelled'}
                          </div>
                        )}
                      </div>

                      {isDraftOrPending ? (
                        canApproveAsMD ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                              Decision for PO <strong>{poNumber}</strong>:
                            </span>
                            <button
                              type="button"
                              onClick={() => setRejectingPo(currentPoObj)}
                              style={{
                                backgroundColor: '#FEF2F2',
                                border: '1px solid #FECACA',
                                borderRadius: '8px',
                                padding: '8px 18px',
                                fontSize: '13px',
                                fontWeight: '700',
                                color: '#DC2626',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <XCircle size={15} style={{ color: '#DC2626' }} /> Reject PO
                            </button>
                            <button
                              type="button"
                              onClick={() => setApprovingPo(currentPoObj)}
                              style={{
                                backgroundColor: '#16A34A',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 22px',
                                fontSize: '13px',
                                fontWeight: '700',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                              }}
                            >
                              <CheckCircle size={15} /> Approve as MD
                            </button>
                          </div>
                        ) : (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#FFFBEB',
                            border: '1px solid #FDE68A',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#B45309'
                          }}>
                            <Clock size={14} style={{ color: '#D97706' }} /> Awaiting MD / CEO Approval
                          </div>
                        )
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isClosed ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '700', color: '#166534' }}>
                              <CheckCircle size={14} style={{ color: '#16A34A' }} /> GRN Completed
                            </div>
                          ) : isAlreadyInGrnProcessOrPartial ? (
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#ECFEFF',
                              border: '1px solid #0E7490',
                              borderRadius: '8px',
                              padding: '6px 14px',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: '#0E7490'
                            }}>
                              <CheckCircle size={14} style={{ color: '#0E7490' }} /> In GRN Process
                            </div>
                          ) : isProceedPoOnly ? (
                            isAccounts ? (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: '#ECFEFF',
                                border: '1px solid #0E7490',
                                borderRadius: '8px',
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: '700',
                                color: '#0E7490'
                              }}>
                                <CheckCircle size={14} style={{ color: '#0E7490' }} /> Proceed PO (GRN Ready)
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePushToGrn(currentPoObj)}
                                style={{
                                  backgroundColor: '#0E7490',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '7px 18px',
                                  fontSize: '13px',
                                  fontWeight: '700',
                                  color: 'white',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)'
                                }}
                              >
                                <Boxes size={15} /> Push to GRN
                              </button>
                            )
                          ) : isPaymentProcessed ? (
                            <>
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: '#F0FDF4',
                                border: '1px solid #BBF7D0',
                                borderRadius: '8px',
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: '700',
                                color: '#166534'
                              }}>
                                <CheckCircle size={14} style={{ color: '#16A34A' }} /> Payment Processed / Credit Verified
                              </div>
                              {isProcurementHead && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenProceedPoModal(currentPoObj)}
                                  style={{
                                    backgroundColor: '#0E7490',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '7px 18px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)'
                                  }}
                                >
                                  <Send size={15} /> Proceed PO (Ready for GRN)
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: isAccounts ? '#EEF2FF' : '#F0FDF4',
                                border: isAccounts ? '1px solid #C7D2FE' : '1px solid #BBF7D0',
                                borderRadius: '8px',
                                padding: '6px 14px',
                                fontSize: '12px',
                                fontWeight: '700',
                                color: isAccounts ? '#3730A3' : '#166534'
                              }}>
                                <CheckCircle size={14} style={{ color: isAccounts ? '#4F46E5' : '#16A34A' }} /> {isAccounts ? 'Awaiting Accounts Verification' : 'MD Approved'}
                              </div>

                              {isAccounts && (st === 'MD Approved' || currentPoObj?.status === 'MD Approved') && !Boolean(currentPoObj?.paymentDetails) && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPaymentProcessModal(currentPoObj)}
                                  style={{
                                    backgroundColor: '#0E7490',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '7px 18px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)'
                                  }}
                                >
                                  <CreditCard size={15} /> Process Payment / Verify Credit
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>
            </div>
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
            border-top: 4px solid #0E7490 !important;
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
      {viewMode === 'list' && (() => {
        const allStatusOptions = [
          'All orders',
          'Pending Approval',
          'MD Approved',
          'Payment Processed',
          'Proceed PO',
          'Partially Received',
          'Fully Received',
          'Cancelled'
        ];

        const kpiBaseList = (!kpiFilterMeta || !kpiFilterMeta.targetKeys)
          ? poList
          : (kpiFilterMeta.targetKeys.size === 0
            ? []
            : poList.filter(po => {
                if (!po) return false;
                const k1 = String(po.poNo || '').trim().toLowerCase();
                const k2 = String(po.id || '').trim().toLowerCase();
                const k3 = String(po.purchaseorder_number || '').trim().toLowerCase();
                const k4 = String(po.poNumber || '').trim().toLowerCase();
                const k5 = String(po._id || '').trim().toLowerCase();
                return (k1 && kpiFilterMeta.targetKeys.has(k1)) ||
                       (k2 && kpiFilterMeta.targetKeys.has(k2)) ||
                       (k3 && kpiFilterMeta.targetKeys.has(k3)) ||
                       (k4 && kpiFilterMeta.targetKeys.has(k4)) ||
                       (k5 && kpiFilterMeta.targetKeys.has(k5));
              })
            );

        const filteredPOList = kpiBaseList.filter(po => {
          if (!po) return false;
          const pNo = String(po.poNo || po.id || '');
          const pVend = String(po.vendor || po.companyName || '');
          const matchesSearch = pNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            pVend.toLowerCase().includes(searchQuery.toLowerCase());

          const statusStr = String(po.status || '');
          const currentStage = getPoStage(po);

          const matchesStatus = statusFilter === 'All' || statusFilter === 'All orders' ||
            ((statusFilter === 'Pending Approval' || statusFilter === 'Draft' || statusFilter === 'Draft / Pending Approval') && currentStage === 'Draft') ||
            (statusFilter === 'MD Approved' && currentStage === 'MD_APPROVED') ||
            ((statusFilter === 'Payment Processed' || statusFilter === 'Payment Processed / Credit Verified') && currentStage === 'PAYMENT_PROCESSED') ||
            ((statusFilter === 'Proceed PO' || statusFilter === 'Proceed PO (GRN Ready)') && currentStage === 'PROCEED_PO') ||
            ((statusFilter === 'Partially Received' || statusFilter === 'Partially Recived' || statusFilter === 'OPEN / PARTIALLY RECEIVED') && currentStage === 'PARTIALLY_RECEIVED') ||
            ((statusFilter === 'Fully Received' || statusFilter === 'Fully Recived' || statusFilter === 'CLOSED / FULLY RECEIVED' || statusFilter === 'Closed') && currentStage === 'CLOSED') ||
            (statusFilter === 'Cancelled' && currentStage === 'CANCELLED') ||
            statusStr === statusFilter;

          const matchesTab = poTab === 'All' || currentStage === poTab;

          let matchesDate = true;
          if (!kpiFilterMeta && (filterDate || filterEndDate)) {
            const rawDate = po.poDate || po.date || po.createdAt;
            if (rawDate) {
              const dStr = String(rawDate).substring(0, 10);
              if (filterDate && dStr < filterDate) matchesDate = false;
              if (filterEndDate && dStr > filterEndDate) matchesDate = false;
            } else {
              matchesDate = false;
            }
          }

          return matchesSearch && matchesStatus && matchesTab && matchesDate;
        });

        const sortedPOList = [...filteredPOList].sort((a, b) => {
          const parsePoSequenceNumber = (item) => {
            if (!item) return 0;
            const str = String(item.poNo || item.id || item.purchaseorder_number || item.poNumber || '').trim();
            if (!str) return 0;
            const terminalMatch = str.match(/[-/_](\d+)$/);
            if (terminalMatch) return parseInt(terminalMatch[1], 10);
            const allNums = str.match(/\d+/g);
            if (allNums && allNums.length > 0) {
              return parseInt(allNums[allNums.length - 1], 10);
            }
            return 0;
          };

          const numA = parsePoSequenceNumber(a);
          const numB = parsePoSequenceNumber(b);
          if (numB !== numA) {
            return sortDirection === 'asc' ? (numA - numB) : (numB - numA);
          }

          const dateA = new Date(a.createdAt || a.poDate || a.date || 0).getTime() || 0;
          const dateB = new Date(b.createdAt || b.poDate || b.date || 0).getTime() || 0;
          if (dateB !== dateA) {
            return sortDirection === 'asc' ? (dateA - dateB) : (dateB - dateA);
          }

          const strA = String(a.poNo || a.id || '');
          const strB = String(b.poNo || b.id || '');
          return sortDirection === 'asc'
            ? strA.localeCompare(strB, undefined, { numeric: true })
            : strB.localeCompare(strA, undefined, { numeric: true });
        });

        const indexOfLastRow = currentPage * rowsPerPage;
        const indexOfFirstRow = indexOfLastRow - rowsPerPage;
        const currentRows = sortedPOList.slice(indexOfFirstRow, indexOfLastRow);
        const totalPages = Math.ceil(sortedPOList.length / rowsPerPage);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>

            {/* Header section with Action Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#0F172A' }}>
                  {isExecutiveOrMD ? 'Purchase Order Approvals (PO)' : isAccounts ? 'Purchase Order Verification (PO)' : 'Purchase Orders (PO)'}
                </h2>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {isExecutiveOrMD 
                    ? 'Review, verify and grant MD approval for corporate Purchase Orders awaiting authorization'
                    : isAccounts
                    ? 'Verify payment process, credit terms, and accounts clearance for MD-approved Purchase Orders'
                    : 'Generate, tracking and dispatch management of corporate Purchase Orders'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {!isExecutiveOrMD && !isAccounts && (
                  <button
                    onClick={() => handleStartFreshPO()}
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
                    <span>Create PO</span>
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
                <input id="purchase-orders-search-query" name="searchQuery" aria-label="Search Purchase Orders (PO No, Company Name)"
                  type="text"
                  placeholder="Search Purchase Orders (PO No, Company Name)..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
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
                    setCurrentPage(1);
                  }}
                />

                <select id="purchase-orders-status-filter" name="statusFilter" aria-label="StatusFilter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '12px', backgroundColor: 'white', color: '#334155', outline: 'none' }}>
                  {allStatusOptions.map(s => (
                    <option key={s} value={s === 'All orders' ? 'All' : s}>
                      {s === 'All orders' ? 'Status: All orders' : s}
                    </option>
                  ))}
                </select>

                <button
                  onClick={clearFilters}
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

            {/* KPI Filter Notification Banner */}
            {kpiFilterMeta && (
              <div style={{
                backgroundColor: '#F0F9FF',
                border: '1px solid #BAE6FD',
                borderRadius: '10px',
                padding: '10px 16px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#0369A1', fontWeight: '800' }}>
                  <span>Showing <strong>{filteredPOList.length}</strong> Purchase Orders filtered from {kpiFilterMeta.sourceLabel ? `${kpiFilterMeta.sourceLabel} KPI` : "Today's POs KPI"} ({kpiFilterMeta.periodLabel})</span>
                </div>
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    border: 'none',
                    backgroundColor: '#0284C7',
                    color: '#FFFFFF',
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  Clear Filter ✕
                </button>
              </div>
            )}

            {/* 2. STATUS TABS ROW */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '20px', padding: '4px 0', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
              {(isExecutiveOrMD ? [
                { id: 'All', label: 'All orders', count: kpiBaseList.length, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Draft', label: 'Pending Approval', count: kpiBaseList.filter(po => getPoStage(po) === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'MD_APPROVED', label: 'MD Approved', count: kpiBaseList.filter(po => getPoStage(po) === 'MD_APPROVED').length, bg: '#e0e7ff', fg: '#3730a3' }
              ] : isAccounts ? [
                { id: 'All', label: 'All orders', count: kpiBaseList.length, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Draft', label: 'Pending Approval', count: kpiBaseList.filter(po => getPoStage(po) === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'MD_APPROVED', label: 'MD Approved', count: kpiBaseList.filter(po => getPoStage(po) === 'MD_APPROVED').length, bg: '#e0e7ff', fg: '#3730a3' },
                { id: 'PAYMENT_PROCESSED', label: 'Payment Processed', count: kpiBaseList.filter(po => getPoStage(po) === 'PAYMENT_PROCESSED').length, bg: '#fef3c7', fg: '#92400e' }
              ] : [
                { id: 'All', label: 'All orders', count: kpiBaseList.length, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Draft', label: 'Pending Approval', count: kpiBaseList.filter(po => getPoStage(po) === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'MD_APPROVED', label: 'MD Approved', count: kpiBaseList.filter(po => getPoStage(po) === 'MD_APPROVED').length, bg: '#e0e7ff', fg: '#3730a3' },
                { id: 'PAYMENT_PROCESSED', label: 'Payment Processed', count: kpiBaseList.filter(po => getPoStage(po) === 'PAYMENT_PROCESSED').length, bg: '#fef3c7', fg: '#92400e' },
                { id: 'PROCEED_PO', label: 'Proceed PO', count: kpiBaseList.filter(po => getPoStage(po) === 'PROCEED_PO').length, bg: '#ecfeff', fg: '#0e7490' },
                { id: 'PARTIALLY_RECEIVED', label: 'Partially Received', count: kpiBaseList.filter(po => getPoStage(po) === 'PARTIALLY_RECEIVED').length, bg: '#fef3c7', fg: '#b45309' },
                { id: 'CLOSED', label: 'Fully Received', count: kpiBaseList.filter(po => getPoStage(po) === 'CLOSED').length, bg: '#dcfce7', fg: '#15803d' },
                { id: 'CANCELLED', label: 'Cancelled', count: kpiBaseList.filter(po => getPoStage(po) === 'CANCELLED').length, bg: '#fee2e2', fg: '#b91c1c' }
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setPoTab(tab.id); setCurrentPage(1); }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: '10px 4px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    color: poTab === tab.id ? '#2563eb' : '#64748b',
                    borderBottom: poTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
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

            {/* PO Table or Mobile Cards */}
            <div className="section-card" style={{ padding: 0, overflowX: 'auto', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px' }}>
              {isMobile ? (
                /* Mobile Cards View */
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Mobile Select All Header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                    color: '#475569'
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700' }}>
                      <input
                        type="checkbox"
                        onChange={(e) => handleSelectAll(e, filteredPOList)}
                        checked={filteredPOList.length > 0 && filteredPOList.every(po => selectedPOs.includes(po.poNo))}
                        style={{ accentColor: '#0E7490', cursor: 'pointer', width: '16px', height: '16px', margin: 0 }}
                      />
                      <span>Select All ({filteredPOList.length})</span>
                    </label>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      {selectedPOs.length > 0 ? `${selectedPOs.length} selected` : `Showing ${filteredPOList.length === 0 ? 0 : indexOfFirstRow + 1}-${Math.min(indexOfLastRow, filteredPOList.length)}`}
                    </span>
                  </div>

                  {filteredPOList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 20px', color: '#94A3B8' }}>
                      <ShoppingCart size={38} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#475569' }}>No Purchase Orders found</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Try adjusting your search or filters.</p>
                    </div>
                  ) : (
                    currentRows.map((po, idx) => {
                      const isChecked = selectedPOs.includes(po.poNo);
                      return (
                        <div
                          key={po.poNo || idx}
                          onClick={() => handleStartView(po)}
                          style={{
                            backgroundColor: isChecked ? '#ECFEFF' : '#FFFFFF',
                            border: isChecked ? '1.5px solid #0E7490' : '1px solid #E2E8F0',
                            borderLeft: isChecked ? '4px solid #0E7490' : '1px solid #CBD5E1',
                            borderRadius: '12px',
                            padding: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            cursor: 'pointer',
                            boxShadow: isChecked ? '0 4px 12px rgba(14,116,144,0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {/* Top row: Checkbox + PO No + Status */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => handleSelectRow(po.poNo)}
                                style={{ accentColor: '#0E7490', cursor: 'pointer', width: '16px', height: '16px', margin: 0 }}
                              />
                              <span style={{ fontSize: '14px', fontWeight: '800', color: '#2563EB', letterSpacing: '0.2px' }}>
                                {po.poNo}
                              </span>
                            </div>
                            {renderStatusBadge(po.statusType, po.status)}
                          </div>

                          {/* Middle row: Company / Vendor Name */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', lineHeight: '1.3' }}>
                              {po.vendor || '—'}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748B', flexWrap: 'wrap' }}>
                              <span>PO Date: <strong>{po.poDate || '—'}</strong></span>
                              <span>•</span>
                              <span>Issued By: <strong style={{ color: '#0369A1' }}>{po.purchaser || po.issuedBy || po.createdBy || po.created_by || '—'}</strong></span>
                              {po.deliveryDate && <span>• Due: <strong>{po.deliveryDate}</strong></span>}
                            </div>
                          </div>

                          {/* Bottom row: Total Value */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                            paddingTop: '8px',
                            borderTop: '1px dashed #E2E8F0'
                          }}>
                            <span style={{ color: '#64748B' }}>Total Value:</span>
                            <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                              {po.amount || '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
              <div className="table-responsive" style={{ border: 'none', borderRadius: '16px', margin: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
                <table className="custom-table" style={{ fontSize: '13px', width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#475569', height: '48px' }}>
                      <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', textAlign: 'center', padding: '12px 0', boxSizing: 'border-box' }}>
                        <input id="purchase-orders-select-all" name="selectAll" aria-label="SelectAll"
                          type="checkbox"
                          onChange={(e) => handleSelectAll(e, filteredPOList)}
                          checked={filteredPOList.length > 0 && filteredPOList.every(po => selectedPOs.includes(po.poNo))}
                          style={{ cursor: 'pointer', borderRadius: '4px', accentColor: '#0E7490' }}
                         />
                      </th>
                      <th
                        onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                        style={{
                          width: '16%',
                          minWidth: '130px',
                          fontWeight: '700',
                          padding: '12px 14px',
                          color: '#0E7490',
                          textAlign: 'left',
                          boxSizing: 'border-box',
                          cursor: 'pointer',
                          userSelect: 'none'
                        }}
                        title="Click to toggle PO No. sort order (Descending / Ascending)"
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span>PO No.</span>
                          <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '800' }}>
                            {sortDirection === 'desc' ? '▼' : '▲'}
                          </span>
                        </div>
                      </th>
                      <th style={{ width: '22%', minWidth: '180px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Company Name</th>
                      <th style={{ width: '14%', minWidth: '120px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Issued By</th>
                      <th style={{ width: '13%', minWidth: '110px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>PO Date</th>
                      <th style={{ width: '14%', minWidth: '120px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Expected Delivery</th>
                      <th style={{ width: '12%', minWidth: '110px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'right', boxSizing: 'border-box' }}>Total Value</th>
                      <th style={{ width: '11%', minWidth: '110px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'center', boxSizing: 'border-box' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableLoading ? (
                      Array.from({ length: 6 }).map((_, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ textAlign: 'center', padding: '12px 0', width: '48px' }}>
                            <input id="purchase-orders-input-1" name="input1" aria-label="Input 1" type="checkbox" defaultChecked={false} disabled  />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div className="skeleton-shimmer skeleton-text" style={{ width: '90px', height: '14px' }} />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div className="skeleton-shimmer skeleton-text" style={{ width: '70%', height: '14px' }} />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div className="skeleton-shimmer skeleton-text" style={{ width: '80px', height: '14px' }} />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div className="skeleton-shimmer skeleton-text" style={{ width: '80px', height: '14px' }} />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div className="skeleton-shimmer skeleton-text" style={{ width: '80px', height: '14px' }} />
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div className="skeleton-shimmer skeleton-text" style={{ width: '85px', height: '14px', marginLeft: 'auto' }} />
                          </td>
                          <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                            <div className="skeleton-shimmer" style={{ width: '80px', height: '22px', borderRadius: '12px', margin: '0 auto' }} />
                          </td>
                        </tr>
                      ))
                    ) : (() => {
                      return currentRows.map((po, idx) => {
                        const isChecked = selectedPOs.includes(po.poNo);
                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: idx === currentRows.length - 1 ? 'none' : '1px solid #f1f5f9',
                              transition: 'all 0.15s ease',
                              backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                              borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                            }}
                            className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                          >
                            <td style={{ textAlign: 'center' }}>
                              <input id="purchase-orders-checkbox" name="checkbox" aria-label="Checkbox"
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleSelectRow(po.poNo)}
                                style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                               />
                            </td>
                            <td style={{ fontWeight: '600', color: '#2563eb', textAlign: 'left' }}>
                              <a
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleStartView(po);
                                }}
                                style={{ fontWeight: '600', color: '#2563eb', textDecoration: 'none' }}
                              >
                                {po.poNo}
                              </a>
                            </td>
                            <td style={{ fontWeight: '500', color: '#1e293b', textAlign: 'left' }}>{po.vendor}</td>
                            <td style={{ color: '#334155', fontWeight: '500', textAlign: 'left' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '50%',
                                  backgroundColor: '#E0F2FE',
                                  color: '#0369A1',
                                  fontSize: '10px',
                                  fontWeight: '700',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  {String(po.purchaser || po.issuedBy || po.createdBy || po.created_by || 'U').trim().charAt(0).toUpperCase()}
                                </span>
                                <span style={{ fontSize: '12.5px', color: '#1E293B', fontWeight: '600' }}>
                                  {po.purchaser || po.issuedBy || po.createdBy || po.created_by || '—'}
                                </span>
                              </div>
                            </td>
                            <td style={{ color: '#64748b', textAlign: 'left' }}>{po.poDate}</td>
                            <td style={{ color: '#64748b', textAlign: 'left' }}>{po.deliveryDate}</td>
                            <td style={{ fontWeight: '600', color: '#1e293b', textAlign: 'right' }}>{po.amount}</td>
                            <td style={{ textAlign: 'center' }}>
                              {renderStatusBadge(po.statusType, po.status)}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
              )}
                {/* 4. PAGINATION FOOTER */}
                {filteredPOList.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: isMobile ? 'center' : 'space-between',
                    alignItems: isMobile ? 'stretch' : 'center',
                    gap: isMobile ? '12px' : '16px',
                    padding: isMobile ? '12px 14px' : '16px 24px',
                    fontSize: '13px',
                    color: '#64748b',
                    borderTop: '1px solid #f1f5f9'
                  }}>
                    <div style={{ textAlign: isMobile ? 'center' : 'left' }}>
                      Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredPOList.length)} of {filteredPOList.length} entries
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isMobile ? 'space-between' : 'flex-end',
                      gap: '16px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Rows per page:</span>
                        <select id="purchase-orders-rows-per-page" name="rowsPerPage" aria-label="RowsPerPage"
                          value={rowsPerPage}
                          onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                          style={{ height: '30px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', padding: '0 4px', backgroundColor: 'white' }}
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={15}>15</option>
                          <option value={20}>20</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          style={{ border: '1px solid #cbd5e1', background: currentPage === 1 ? '#f1f5f9' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                        >
                          <ChevronLeft style={{ width: '14px', height: '14px' }} />
                        </button>

                        {(() => {
                          let start = Math.max(1, currentPage - 1);
                          let end = start + 3;
                          if (end > totalPages) {
                            end = totalPages;
                            start = Math.max(1, end - 3);
                          }
                          const pages = [];
                          for (let i = start; i <= end; i++) {
                            pages.push(i);
                          }
                          return pages;
                        })().map(page => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            style={{
                              border: page === currentPage ? 'none' : '1px solid #cbd5e1',
                              background: page === currentPage ? '#0E7490' : 'white',
                              color: page === currentPage ? 'white' : '#475569',
                              cursor: 'pointer',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              fontWeight: page === currentPage ? 'bold' : 'normal'
                            }}
                          >
                            {page}
                          </button>
                        ))}

                        <button
                          disabled={currentPage === totalPages || totalPages === 0}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          style={{ border: '1px solid #cbd5e1', background: (currentPage === totalPages || totalPages === 0) ? '#f1f5f9' : 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
                        >
                          <ChevronRight style={{ width: '14px', height: '14px' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            {/* Floating Selection Toolbar (exact reference design) */}
            {selectedPOs.length > 0 && !showCeoPoModal && (
              <div className="floating-action-bar po-no-print" style={{
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
                  <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedPOs.length}</strong> Selected
                </span>

                {/* Edit Info: Only available BEFORE MD approval (Draft / Pending Approval). Once MD approved, Edit is disabled/disappeared */}
                {!isExecutiveOrMD && !isAccounts && (() => {
                  // Check if any selected PO has already been approved by MD or progressed further
                  const canEdit = selectedPOs.length > 0 && selectedPOs.every(poNo => {
                    const target = poList.find(p => p.poNo === poNo || p.id === poNo);
                    if (!target) return false;
                    const st = String(target.status || '').trim();
                    const isDraftOrPending = st === 'Draft' || st.includes('Pending') || st.includes('WAITING') || st === 'Draft / Pending Approval';
                    return isDraftOrPending;
                  });

                  if (!canEdit) return null;

                  return (
                    <button
                      onClick={() => {
                        if (selectedPOs.length > 1) {
                          alert('You cannot edit multiple items at once.');
                        } else if (selectedPOs.length === 1) {
                          const targetPoNo = selectedPOs[0];
                          const idx = poList.findIndex(p => p.poNo === targetPoNo);
                          const targetPo = poList[idx] || { poNo: targetPoNo, vendor: '' };
                          setSelectedPOs([]);
                          handleStartEdit(targetPo, idx >= 0 ? idx : 0);
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
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                    >
                      <Edit3 size={14} style={{ color: '#64748B' }} /> Edit Info
                    </button>
                  );
                })()}

                {/* 3. Role & Status-specific Primary Actions (1 PO Selected) */}
                {selectedPOs.length === 1 && (() => {
                  const target = poList.find(p => p.poNo === selectedPOs[0] || p.id === selectedPOs[0]);
                  if (!target) return null;
                  const st = String(target.status || '').trim();
                  const stt = String(target.statusType || '').toLowerCase();

                  // ACCOUNTS ROLE ACTIONS: Verify Payment or Payment Processed badge ONLY
                  if (isAccounts) {
                    const rowStage = getPoStage(target);
                    const isPaidOrBeyond = st === 'Payment Processed' || stt === 'payment_processed' || rowStage === 'PAYMENT_PROCESSED' || rowStage === 'PROCEED_PO' || Boolean(target.paymentDetails) || Boolean(target.proceedDetails) || st === 'Proceed PO' || stt === 'proceed_po' || st.includes('CLOSED') || st.includes('PARTIALLY');
                    if (isPaidOrBeyond) {
                      return (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          borderRadius: '8px',
                          backgroundColor: '#ECFDF5',
                          color: '#065F46',
                          fontSize: '11px',
                          fontWeight: '700',
                          border: '1px solid #A7F3D0'
                        }}>
                          <CheckCircle size={13} style={{ color: '#059669' }} /> Payment Processed / Credit Verified
                        </div>
                      );
                    }
                    const isMdApproved = (st === 'MD Approved' || st === 'OPEN' || st === 'Approved' || stt === 'md_approved' || rowStage === 'MD_APPROVED') && !Boolean(target.paymentDetails);
                    if (isMdApproved) {
                      return (
                        <button
                          onClick={() => {
                            setSelectedPOs([]);
                            handleOpenPaymentProcessModal(target);
                          }}
                          style={{
                            backgroundColor: '#FFFBEB',
                            border: '1px solid #FDE68A',
                            color: '#92400E',
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
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEF3C7'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFBEB'}
                        >
                          <CreditCard size={14} style={{ color: '#D97706' }} /> Verify Payment
                        </button>
                      );
                    }
                    return null;
                  }

                  // PROCUREMENT / ADMIN / CEO ACTIONS (isAccounts is FALSE)
                  const rowStage = getPoStage(target);
                  const isClosed = rowStage === 'CLOSED' || st.toUpperCase().includes('CLOSED') || st.toUpperCase().includes('FULLY RECEIVED') || stt === 'closed';
                  const isPartiallyReceived = rowStage === 'PARTIALLY_RECEIVED' || st.toUpperCase().includes('PARTIAL') || stt.includes('partial');

                  // If Closed / Fully Received or already in GRN receiving, no lifecycle progression actions needed here
                  if (isClosed || isPartiallyReceived) {
                    return null;
                  }

                  const isProceedPo = st === 'Proceed PO' || st === 'PROCEED PO' || stt === 'proceed_po' || rowStage === 'PROCEED_PO' || Boolean(target.proceedDetails);
                  const isPaymentProcessed = !isProceedPo && (st === 'Payment Processed' || stt === 'payment_processed' || rowStage === 'PAYMENT_PROCESSED' || Boolean(target.paymentDetails));
                  const isAlreadyApproved = isPaymentProcessed || isProceedPo || st === 'MD Approved' || stt === 'md_approved' || rowStage === 'MD_APPROVED';
                  const isDraftOrPending = !isAlreadyApproved && (st === 'Draft' || st.includes('Pending') || st.includes('WAITING') || st === 'Draft / Pending Approval' || st === 'OPEN');

                  // A) If CEO/MD and still Draft -> Show "Approve as MD"
                  if (canApproveAsMD && isDraftOrPending) {
                    return (
                      <button
                        onClick={() => {
                          setSelectedPOs([]);
                          setApprovingPo(target);
                        }}
                        title="Approve Purchase Order directly as MD / CEO"
                        style={{
                          backgroundColor: '#F0FDF4',
                          border: '1.5px solid #86EFAC',
                          color: '#15803D',
                          borderRadius: '10px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(22, 163, 74, 0.15)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#DCFCE7'; e.currentTarget.style.borderColor = '#4ADE80'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F0FDF4'; e.currentTarget.style.borderColor = '#86EFAC'; }}
                      >
                        <CheckCircle size={14} style={{ color: '#16A34A' }} /> Approve PO (Authorize Payment)
                      </button>
                    );
                  }

                  // B) If Payment Processed -> Show "Proceed PO (Ready for GRN)"
                  if (isPaymentProcessed) {
                    return (
                      <button
                        onClick={() => handleOpenProceedPoModal(target)}
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
                          boxShadow: '0 1px 2px rgba(14, 116, 144, 0.25)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0891B2'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
                      >
                        <Send size={14} style={{ color: '#FFFFFF' }} /> Proceed PO (Ready for GRN)
                      </button>
                    );
                  }

                  // C) If Proceed PO -> Show "Push to GRN" (Proceed PO disappears)
                  if (isProceedPo) {
                    return (
                      <button
                        onClick={() => {
                          setSelectedPOs([]);
                          handlePushToGrn(target);
                        }}
                        style={{
                          backgroundColor: '#0E7490',
                          border: 'none',
                          color: '#FFFFFF',
                          borderRadius: '10px',
                          padding: '6px 16px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(14, 116, 144, 0.3)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0891B2'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
                      >
                        <Boxes size={14} style={{ color: '#FFFFFF' }} /> Push to GRN
                      </button>
                    );
                  }

                  return null;
                })()}

                {/* 4. Cancel PO: Opens cancellation remark popup (Replacing Delete) */}
                {!isAccounts && (
                  <button
                    onClick={() => {
                      if (selectedPOs && selectedPOs.length > 1) {
                        alert("Please select a single Purchase Order to cancel.");
                        return;
                      }
                      const target = (selectedPOs && selectedPOs.length > 0)
                        ? (poList.find(p => p.poNo === selectedPOs[0] || p.id === selectedPOs[0]) || { poNo: selectedPOs[0], id: selectedPOs[0], vendor: 'Vendor Reference' })
                        : (poList[0] || null);
                      if (!target) return;
                      if (String(target.status || '').toUpperCase() === 'CANCELLED') {
                        alert(`PO ${target.poNo || target.id} is already cancelled.`);
                        return;
                      }
                      setCancellingPo(target);
                      setCancellationRemarkInput('');
                    }}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #FECACA',
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
                    <Ban size={14} style={{ color: '#DC2626' }} /> Cancel PO
                  </button>
                )}

                {/* 5. View Details */}
                <button
                  onClick={() => {
                    if (selectedPOs && selectedPOs.length > 1) {
                      alert("You can't open details for multiple files at once. Please select a single item to view details.");
                      return;
                    }
                    const target = (selectedPOs && selectedPOs.length > 0)
                      ? (poList.find(p => p.poNo === selectedPOs[0] || p.id === selectedPOs[0]) || { poNo: selectedPOs[0], id: selectedPOs[0], vendor: 'Vendor Reference' })
                      : (poList[0] || null);
                    setSelectedPOs([]);
                    if (target) {
                      handleStartView(target);
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
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                >
                  <Eye size={14} style={{ color: '#0E7490' }} /> View Details
                </button>

                {/* 6. Export / Print PDF */}
                <button
                  onClick={() => {
                    if (selectedPOs && selectedPOs.length > 1) {
                      alert("Please select a single Purchase Order to export / print PDF.");
                      return;
                    }
                    const target = (selectedPOs && selectedPOs.length > 0)
                      ? (poList.find(p => p.poNo === selectedPOs[0] || p.id === selectedPOs[0]) || { poNo: selectedPOs[0], id: selectedPOs[0], vendor: 'Vendor Reference' })
                      : (poList[0] || null);
                    if (!target) return;
                    setSelectedPOs([]);
                    setPrintPoModal(target);
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
                  <FileText size={14} style={{ color: '#059669' }} /> Export / Print PDF
                </button>

                <button
                  onClick={() => setSelectedPOs([])}
                  title="Deselect all"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    marginLeft: '2px'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ==================== VIEW 2: DEDICATED FULL-PAGE CREATOR/EDITOR/VIEW SCREEN ==================== */}
      {(viewMode === 'create' || viewMode === 'edit' || viewMode === 'view') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#1e293b' }}>

          {/* Title Bar */}
          <div
            className="po-no-print"
            style={
              viewMode === 'view'
                ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
                : {
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
                  }
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: viewMode === 'view' ? '0' : '16px' }}>
              {viewMode !== 'view' && (
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
              )}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: viewMode === 'view' ? '20px' : '22px', fontWeight: viewMode === 'view' ? 'bold' : '900', color: viewMode === 'view' ? '#0f172a' : '#FFFFFF', margin: 0, letterSpacing: viewMode === 'view' ? 'normal' : '-0.3px' }}>
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
                <span style={{ fontSize: '13px', color: viewMode === 'view' ? '#64748b' : '#CFFAFE', marginTop: '4px' }}>
                  {viewMode === 'view' ? `Details of purchase order ${poNumber}.` : 'Fill in the details below to create a new purchase order.'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {viewMode === 'view' ? (
                <>
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
                      style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '600', color: '#4338CA', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Copy style={{ width: '14px', height: '14px', color: '#4338CA' }} /> Clone PO
                    </button>
                  )}
                  {/* Stage-based Workflow Action Buttons */}
                  {(() => {
                    const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber) || {
                      poNo: poNumber,
                      vendor: vendorName,
                      amount: `₹ ${Number(getGrandTotal() || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                      paymentTerms
                    };

                    let hasLocalGrn = false;
                    let isLocalGrnClosed = false;
                    try {
                      const localGrns = JSON.parse(localStorage.getItem('controlroom_central_grns_v2') || localStorage.getItem('goods_receipt_notes') || '[]');
                      if (Array.isArray(localGrns)) {
                        const matched = localGrns.filter(g => {
                          const gRef = String(g.poRef || g.poNo || g.poId || '').toLowerCase().trim();
                          const pRef = String(poNumber || '').toLowerCase().trim();
                          return gRef && pRef && (gRef === pRef || gRef.includes(pRef) || pRef.includes(gRef));
                        });
                        if (matched.length > 0) {
                          hasLocalGrn = true;
                          isLocalGrnClosed = matched.some(g => {
                            const gst = String(g.status || '').toUpperCase();
                            return gst.includes('CLOSED') || gst.includes('FULLY RECEIVED') || gst.includes('FULLY ACCEPTED');
                          });
                        }
                      }
                    } catch (_) {}

                    const st = String(viewingPoStatus || currentPoObj?.status || '').trim();
                    const objStatus = String(currentPoObj?.status || '').trim();
                    const objStatusType = String(currentPoObj?.statusType || '').toLowerCase();
                    const totalRec = Number(currentPoObj?.totalReceived || currentPoObj?.totalReceivedQty || 0);
                    const grnCount = Number(currentPoObj?.grnCount || (currentPoObj?.grnHistory ? currentPoObj.grnHistory.length : 0));

                    const isClosed = st.includes('CLOSED') || st.includes('FULLY RECEIVED') || objStatus.includes('CLOSED') || objStatusType === 'closed' || isLocalGrnClosed;
                    const isAlreadyInGrnProcessOrPartial = !isClosed && (
                      st.toUpperCase().includes('PARTIAL') ||
                      objStatus.toUpperCase().includes('PARTIAL') ||
                      objStatusType.includes('partial') ||
                      st.toUpperCase().includes('PACKED') ||
                      objStatus.toUpperCase().includes('PACKED') ||
                      objStatusType.includes('packed') ||
                      st.toUpperCase().includes('GRN PROCESS') ||
                      objStatus.toUpperCase().includes('GRN PROCESS') ||
                      totalRec > 0 ||
                      hasLocalGrn ||
                      grnCount > 0
                    );
                    const isProceedPoOnly = !isClosed && !isAlreadyInGrnProcessOrPartial && (st === 'Proceed PO' || st === 'PROCEED PO' || objStatus === 'Proceed PO' || objStatusType === 'proceed_po' || Boolean(currentPoObj?.proceedDetails));
                    const isGrnProcess = isAlreadyInGrnProcessOrPartial || isProceedPoOnly;
                    const isPaymentProcessed = !isClosed && !isGrnProcess && (st === 'Payment Processed' || objStatus === 'Payment Processed' || objStatusType === 'payment_processed' || Boolean(currentPoObj?.paymentDetails));
                    const isMdApproved = (st === 'MD Approved' || objStatus === 'MD Approved' || objStatusType === 'md_approved' || Boolean(currentPoObj?.approvedBy)) && !isClosed && !isGrnProcess && !isPaymentProcessed;
                    const isDraftOrPending = !isClosed && !isGrnProcess && !isPaymentProcessed && !isMdApproved;

                    if (isClosed) {
                      return (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '700', color: '#166534' }}>
                          <CheckCircle size={14} style={{ color: '#16A34A' }} /> GRN Completed
                        </div>
                      );
                    }

                    if (isAlreadyInGrnProcessOrPartial) {
                      return (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#ECFEFF', border: '1px solid #0E7490', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '700', color: '#0E7490' }}>
                          <CheckCircle size={14} style={{ color: '#0E7490' }} /> In GRN Process
                        </div>
                      );
                    }

                    if (isProceedPoOnly) {
                      if (isAccounts) {
                        return (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#ECFEFF', border: '1px solid #0E7490', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: '700', color: '#0E7490' }}>
                            <CheckCircle size={14} style={{ color: '#0E7490' }} /> Proceed PO (GRN Ready)
                          </div>
                        );
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => handlePushToGrn(currentPoObj)}
                          style={{
                            backgroundColor: '#0E7490',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 18px',
                            fontSize: '13px',
                            fontWeight: '700',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)'
                          }}
                        >
                          <Boxes size={15} /> Push to GRN
                        </button>
                      );
                    }

                    if (isPaymentProcessed) {
                      if (!isProcurementHead) {
                        return (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#ECFDF5',
                            border: '1px solid #A7F3D0',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#065F46'
                          }}>
                            <CheckCircle size={15} style={{ color: '#059669' }} /> Payment Processed / Credit Verified
                          </div>
                        );
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => handleOpenProceedPoModal(currentPoObj)}
                          style={{ backgroundColor: '#0E7490', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '700', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)' }}
                        >
                          <Send style={{ width: '15px', height: '15px' }} /> Proceed PO (Ready for GRN)
                        </button>
                      );
                    }

                    if (isMdApproved) {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#F0FDF4',
                            border: '1px solid #BBF7D0',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#166534'
                          }}>
                            <ShieldCheck size={14} style={{ color: '#16A34A' }} /> Approved by CEO — Ready for Payment
                          </div>
                          {isAccounts && (
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentProcessModal(currentPoObj)}
                              style={{ backgroundColor: '#D97706', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '700', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(217, 119, 6, 0.25)' }}
                            >
                              <CreditCard style={{ width: '15px', height: '15px' }} /> Process Payment / Verify Credit
                            </button>
                          )}
                        </div>
                      );
                    }

                    if (isDraftOrPending) {
                      if (canApproveAsMD) {
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setRejectingPo(currentPoObj)}
                              style={{
                                backgroundColor: '#FEF2F2',
                                border: '1px solid #FECACA',
                                borderRadius: '8px',
                                padding: '8px 18px',
                                fontSize: '13px',
                                fontWeight: '700',
                                color: '#DC2626',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEE2E2'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
                            >
                              <XCircle style={{ width: '15px', height: '15px' }} /> Reject PO
                            </button>
                            <button
                              type="button"
                              onClick={() => setApprovingPo(currentPoObj)}
                              style={{
                                backgroundColor: '#16A34A',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 20px',
                                fontSize: '13px',
                                fontWeight: '700',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#15803D'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16A34A'}
                            >
                              <CheckCircle style={{ width: '15px', height: '15px' }} /> Approve PO (Authorize Payment)
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#FFFBEB',
                          border: '1px solid #FDE68A',
                          borderRadius: '8px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#B45309'
                        }}>
                          <Clock style={{ width: '14px', height: '14px', color: '#D97706' }} /> Awaiting MD / CEO Approval
                        </div>
                      );
                    }

                    return null;
                  })()}

                  <button
                    type="button"
                    style={{ backgroundColor: '#2563eb', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Mail style={{ width: '14px', height: '14px' }} /> Share as mail
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {/* Form Content Cards */}

          {/* Skeleton loader — shown while PO detail is fetching */}
          {poDetailLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="section-card" style={{ padding: '30px', borderRadius: '16px', borderTop: '4px solid #0E7490', display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

                    {/* Multi-Location / Branch Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '6px 10px', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                        <Building2 size={13} color="#0E7490" />
                        <span>Vendor Site / Location:</span>
                      </div>
                      <select
                        value={deliveryLocationId}
                        onChange={(e) => {
                          const selId = e.target.value;
                          setDeliveryLocationId(selId);
                          if (selId === 'custom') return;
                          const chosen = vendorLocations.find(l => l.id === selId);
                          if (chosen) {
                            setDeliveryAddress1(chosen.address1 || '');
                            setDeliveryAddress2(chosen.address2 || '');
                            setDeliveryCity(chosen.city || '');
                            setDeliveryState(chosen.state || '');
                            setDeliveryPincode(chosen.pincode || '');
                            const combined = formatAddressObj(chosen);
                            setDeliveryAddress(combined);
                            if (sameAsDelivery) {
                              setBillingAddress1(chosen.address1 || '');
                              setBillingAddress2(chosen.address2 || '');
                              setBillingCity(chosen.city || '');
                              setBillingState(chosen.state || '');
                              setBillingPincode(chosen.pincode || '');
                              setBillingAddress(combined);
                            }
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
                          color: '#0E7490',
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
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '700', color: '#475569', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={sameAsDelivery}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSameAsDelivery(checked);
                            if (checked) {
                              setBillingAddress1(deliveryAddress1);
                              setBillingAddress2(deliveryAddress2);
                              setBillingCity(deliveryCity);
                              setBillingState(deliveryState);
                              setBillingPincode(deliveryPincode);
                              setBillingAddress(deliveryAddress);
                            }
                          }}
                          style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                        />
                        Same as Delivery
                      </label>
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
                    <select id="purchase-orders-payment-terms" name="paymentTerms" aria-label="Payment Terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white' }}>
                      <option value="" disabled>Select Payment Terms</option>
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
              <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px 0', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', margin: '0 24px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                    3
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    LINE ITEMS
                  </h3>
                </div>

                {(() => {
                  const hasAnySet = items.some(it => Boolean(it.isPresetItem && it.presetGroupId));
                  const distinctSetGroupIds = [];
                  items.forEach(it => {
                    if (it.isPresetItem && it.presetGroupId && !distinctSetGroupIds.includes(it.presetGroupId)) {
                      distinctSetGroupIds.push(it.presetGroupId);
                    }
                  });
                  const colCount = hasAnySet ? 10 : 8;
                  return (
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '240px' }}>{hasAnySet ? 'Product / Item *' : 'Item & Description *'}</th>
                        {hasAnySet ? (
                          <th style={{ padding: '10px 8px', textAlign: 'center', width: '110px' }}>HSN / SAC</th>
                        ) : (
                          <th style={{ padding: '10px 12px', textAlign: 'left', width: '150px' }}>Account</th>
                        )}
                        <th style={{ padding: '10px 8px', textAlign: 'center', width: '85px' }}>{hasAnySet ? 'UOM' : 'Unit'}</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', width: '85px' }}>{hasAnySet ? 'Qty / Set *' : 'Qty *'}</th>
                        {hasAnySet && (
                          <th style={{ padding: '10px 8px', textAlign: 'center', width: '100px', color: '#0E7490', backgroundColor: '#ECFEFF' }}>Total Qty</th>
                        )}
                        <th style={{ padding: '10px 10px', textAlign: 'right', width: '110px' }}>{hasAnySet ? 'Price (₹) *' : 'Rate (₹) *'}</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', width: '85px' }}>GST (%)</th>
                        {hasAnySet && (
                          <th style={{ padding: '10px 10px', textAlign: 'left', width: '130px', color: '#0E7490', backgroundColor: '#ECFEFF' }}>Pack Amt (₹) *</th>
                        )}
                        <th style={{ padding: '10px 12px', textAlign: 'right', width: '110px' }}>Amount (₹)</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center', width: '50px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={colCount} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748B', fontSize: '13px', backgroundColor: '#FAFAFA' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <Boxes size={28} style={{ color: '#94A3B8' }} />
                              <div>No line items added yet. Click <strong>Add New Row</strong>, <strong>Add Items in Bulk</strong>, or <strong>Create Set</strong> below.</div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        items.map((item, idx) => {
                          const isSetItem = Boolean(item.isPresetItem && item.presetGroupId);
                          const groupId = item.presetGroupId;
                          const grp = isSetItem ? (presetGroups[groupId] || { presetName: item.presetName || 'Custom Set', setCount: 1, unit: 'Sets', kitPrice: '', gstRate: '18%' }) : null;
                          const setGroupItems = isSetItem ? items.filter(it => it.presetGroupId === groupId) : [];
                          const isFirstInGroup = isSetItem && items.findIndex(it => it.presetGroupId === groupId) === idx;
                          const packIndex = isSetItem ? (distinctSetGroupIds.indexOf(groupId) + 1) : 0;
                          const setCount = grp ? (Number(grp.setCount) || 1) : 1;
                          const rowQty = Number(item.qty || 0);
                          const totalDispatchQty = isSetItem ? (rowQty * setCount) : rowQty;
                          const total = isSetItem ? 0 : (rowQty * (item.rate || 0));

                          return (
                            <React.Fragment key={idx}>
                              {isFirstInGroup && (
                                <tr style={{ backgroundColor: '#EFF6FF', borderTop: '2px solid #0E7490', borderBottom: '1px solid #BAE6FD' }}>
                                  <td colSpan={colCount} style={{ padding: '8px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' }}>
                                          PACK {packIndex}
                                        </span>
                                        <strong style={{ fontSize: '13px', color: '#0F172A', fontWeight: '800' }}>
                                          {grp?.presetName || 'Custom Set'}
                                        </strong>
                                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#E0F2FE', color: '#0369A1', border: '1px solid #BAE6FD' }}>
                                          Total Quantity: {setCount} {grp?.unit === 'kW' ? 'kW' : (setCount > 1 ? 'Sets' : 'Set')} ({setGroupItems.length} {setGroupItems.length === 1 ? 'item' : 'items'})
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '11px', color: '#475569', fontWeight: '600' }}>
                                          Kit Rate: <strong style={{ color: '#0F172A' }}>₹ {Number(grp?.kitPrice || 0).toLocaleString('en-IN')}</strong> / {grp?.unit === 'kW' ? 'kW' : 'Set'} | Total: <strong style={{ color: '#0E7490' }}>₹ {(Number(grp?.kitPrice || 0) * setCount).toLocaleString('en-IN')}</strong> + {grp?.gstRate || '18%'} GST
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleAddSetItem(groupId)}
                                          style={{ border: '1px solid #0E7490', backgroundColor: '#FFFFFF', color: '#0E7490', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                        >
                                          + Add Item
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRemovePresetGroup(groupId)}
                                          style={{ border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2', color: '#DC2626', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                        >
                                          Remove Set
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isSetItem ? '#F8FAFC' : '#FFFFFF' }}>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <TypeableProductSelect
                                    id={`purchase-orders-item-select-${typeof idx !== 'undefined' ? idx : 0}`}
                                    name={`poItemSelect_${typeof idx !== 'undefined' ? idx : 0}`}
                                    value={item.name || ''}
                                    itemsList={availableCatalogItems}
                                    placeholder="Type or select Item from Directory..."
                                    accentColor="#2563EB"
                                    style={{ width: '100%', minWidth: '220px', height: '34px' }}
                                    onChange={(val, matched) => {
                                      const found = matched || availableCatalogItems.find(zi => (zi.name || '').toLowerCase() === (val || '').toLowerCase());
                                      setItems(prev => (prev || []).map((it, i) => {
                                        if (i !== idx) return it;
                                        const next = { ...it, name: val };
                                        if (found) {
                                          if (!it.isPresetItem && found.rate !== undefined && found.rate !== null && Number(found.rate) > 0) {
                                            next.rate = Number(found.rate);
                                          }
                                          if (found.unit || found.uom) {
                                            next.unit = (found.unit || found.uom || 'NOS').toUpperCase();
                                          }
                                          if (found.hsn || found.hsn_or_sac) {
                                            next.hsn = found.hsn || found.hsn_or_sac;
                                          }
                                          if (found.account) {
                                            next.account = found.account;
                                          }
                                          if (found.tax !== undefined && found.tax !== null) {
                                            next.tax = Number(found.tax);
                                          }
                                          if (found.description && !it.description) {
                                            next.description = found.description;
                                          }
                                        }
                                        return next;
                                      }));
                                    }}
                                  />
                                  <textarea id={`purchase-orders-description-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`description_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Enter item description / specifications"
                                    rows={3}
                                    value={item.description || ''}
                                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                    placeholder="Enter item description / specifications..."
                                    style={{ width: '100%', minHeight: '64px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '6px 8px', fontSize: '12px', lineHeight: '1.4', fontFamily: 'inherit', resize: 'vertical', backgroundColor: '#f8fafc', color: '#334155', outline: 'none', boxSizing: 'border-box' }}
                                   />
                                </div>
                              </td>
                              {hasAnySet ? (
                                <td style={{ padding: '8px 8px' }}>
                                  <input
                                    type="text"
                                    value={item.hsn || ''}
                                    onChange={(e) => handleItemChange(idx, 'hsn', e.target.value)}
                                    placeholder="HSN"
                                    style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 6px', fontSize: '12px', textAlign: 'center', backgroundColor: '#FFFFFF' }}
                                  />
                                </td>
                              ) : (
                                <td style={{ padding: '8px 12px' }}>
                                  <select id={`purchase-orders-account-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`account_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Account" value={item.account} onChange={(e) => handleItemChange(idx, 'account', e.target.value)} style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 6px', fontSize: '12px' }}>
                                    <option value="Raw Materials">Raw Materials</option>
                                    <option value="Finished Goods">Finished Goods</option>
                                  </select>
                                </td>
                              )}
                              <td style={{ padding: '8px 8px' }}>
                                <select id={`purchase-orders-unit-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`unit_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Unit" value={item.unit} onChange={(e) => handleItemChange(idx, 'unit', e.target.value)} style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 4px', fontSize: '12px' }}>
                                  {item.unit && !['MT', 'NOS', 'KG', 'PCS', 'MTR', 'SET', 'kW', 'LENGTH'].includes(item.unit) && (
                                    <option value={item.unit}>{item.unit}</option>
                                  )}
                                  <option>MT</option>
                                  <option>NOS</option>
                                  <option>KG</option>
                                  <option>PCS</option>
                                  <option>MTR</option>
                                  <option>SET</option>
                                  <option>kW</option>
                                  <option>LENGTH</option>
                                </select>
                              </td>
                              <td style={{ padding: '8px 8px' }}>
                                <input id={`purchase-orders-qty-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`qty_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Qty" type="number" value={item.qty} onChange={(e) => handleItemChange(idx, 'qty', e.target.value === '' ? '' : Number(e.target.value))} required style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 4px', fontSize: '12px', textAlign: 'center' }}  />
                              </td>
                              {hasAnySet && (
                                <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF' }}>
                                  {totalDispatchQty} {item.unit || 'NOS'}
                                </td>
                              )}
                              <td style={{ padding: '8px 8px' }}>
                                {isSetItem ? (
                                  <div style={{ textAlign: 'right', fontSize: '11px', fontWeight: '600', color: '#64748B', paddingRight: '6px' }}>
                                    In Pack
                                  </div>
                                ) : (
                                  <input id={`purchase-orders-rate-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`rate_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Rate" type="number" value={item.rate} onChange={(e) => handleItemChange(idx, 'rate', e.target.value === '' ? '' : Number(e.target.value))} required style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', textAlign: 'right' }}  />
                                )}
                              </td>
                              <td style={{ padding: '8px 8px' }}>
                                <select id={`purchase-orders-tax-18-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`tax18_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Tax 18"
                                  value={item.tax !== undefined && item.tax !== '' ? Number(item.tax) : 18}
                                  onChange={(e) => handleItemChange(idx, 'tax', Number(e.target.value))}
                                  style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 4px', fontSize: '12px' }}
                                >
                                  <option value={18}>18%</option>
                                  <option value={12}>12%</option>
                                  <option value={5}>5%</option>
                                  <option value={0}>0%</option>
                                  {item.tax !== undefined && item.tax !== '' && ![18, 12, 5, 0].includes(Number(item.tax)) && (
                                    <option value={Number(item.tax)}>{Number(item.tax)}%</option>
                                  )}
                                </select>
                              </td>
                              {hasAnySet && (
                                isSetItem ? (
                                  isFirstInGroup ? (
                                    <td rowSpan={setGroupItems.length} style={{ padding: '8px 10px', backgroundColor: '#ECFEFF', verticalAlign: 'middle', borderLeft: '1px solid #BAE6FD' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={grp?.kitPrice || ''}
                                          onChange={(e) => handleUpdateGroupKitPrice(groupId, e.target.value)}
                                          placeholder="Pack ₹"
                                          style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1.5px solid #0E7490', padding: '0 8px', fontSize: '12px', fontWeight: '700', textAlign: 'right', backgroundColor: '#FFFFFF', color: '#0F172A', boxSizing: 'border-box' }}
                                        />
                                        <span style={{ fontSize: '10px', color: '#0369A1', fontWeight: '700', textAlign: 'right' }}>
                                          Total: ₹{(Number(grp?.kitPrice || 0) * setCount).toLocaleString('en-IN')}
                                        </span>
                                      </div>
                                    </td>
                                  ) : null
                                ) : (
                                  <td style={{ padding: '8px 10px', textAlign: 'center', color: '#94A3B8', fontSize: '11px' }}>—</td>
                                )
                              )}
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: isSetItem ? '#64748B' : '#1e293b' }}>
                                {isSetItem ? 'In Pack' : `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <button type="button" onClick={() => handleRemoveItem(idx)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                                  <Trash2 style={{ width: '14px', height: '14px' }} />
                                </button>
                              </td>
                            </tr>
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                  );
                })()}

                <div style={{ margin: '14px 20px 6px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Add New Row Button (Matches Zoho Books layout) */}
                  <button
                    type="button"
                    onClick={handleAddItem}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      color: '#1E293B',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF',
                        fontSize: '14px',
                        fontWeight: '700',
                        lineHeight: 1,
                        flexShrink: 0
                      }}
                    >
                      +
                    </span>
                    Add New Row
                  </button>

                  {/* Add Items in Bulk Button (Matches Zoho Books layout) */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBulkItems({});
                      setBulkItemSearch('');
                      setBulkCategoryFilter('All');
                      setShowBulkItemModal(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      color: '#1E293B',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF',
                        fontSize: '14px',
                        fontWeight: '700',
                        lineHeight: 1,
                        flexShrink: 0
                      }}
                    >
                      +
                    </span>
                    Add Items in Bulk
                  </button>

                  {/* Add New Product Button */}
                  <button
                    type="button"
                    onClick={() => setShowCreateProductModal(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      color: '#1E293B',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF',
                        fontSize: '14px',
                        fontWeight: '700',
                        lineHeight: 1,
                        flexShrink: 0
                      }}
                    >
                      +
                    </span>
                    Add New Product
                  </button>

                  {/* Create Set Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setNewSetName(`Custom Set ${Object.keys(presetGroups || {}).length + 1}`);
                      setNewSetCount(1);
                      setNewSetUnit('Sets');
                      setNewSetPrice('');
                      setNewSetGstRate('18%');
                      setShowCreateSetModal(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#F5F3FF',
                      border: '1px solid #DDD6FE',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '13.5px',
                      fontWeight: '700',
                      color: '#6D28D9',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EDE9FE'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F5F3FF'; }}
                  >
                    <Layers size={15} />
                    Create Set
                  </button>

                  {Object.values(presetGroups).map(grp => (
                    <button
                      key={grp.groupId}
                      type="button"
                      onClick={() => handleAddSetItem(grp.groupId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: '#ECFEFF',
                        border: '1px solid #A5F3FC',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        color: '#0E7490',
                        cursor: 'pointer'
                      }}
                    >
                      + Add Extra Item into {grp.presetName}
                    </button>
                  ))}
                </div>

              </div>

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
        </div>
      )}

      {/* ==================== DELETE CONFIRMATION POPUP ==================== */}
      {deleteIdx !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '420px', padding: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#ef4444', color: 'white', fontSize: '12px', fontWeight: '800', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.15em' }}>
              URGENT
            </div>
            <div style={{ padding: '16px', border: '1.5px dashed #cbd5e1', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Delete Purchase Order?</h3>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>{poList[deleteIdx].poDate}</span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                Are you sure you want to permanently delete Purchase Order <strong>{poList[deleteIdx].poNo}</strong>? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '6px' }}>
                <button onClick={() => setDeleteIdx(null)} style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                <button onClick={executeDeletePO} style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Delete PO</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ZOHO BOOKS STYLE "ADD ITEMS IN BULK" MODAL ==================== */}
      {/* ==================== CEO LOGIN PURCHASE ORDER DETAILS MODAL POPUP ==================== */}
      {showCeoPoModal && (
        <div
          className="ceo-po-modal-overlay po-no-print"
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
              setShowCeoPoModal(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              width: '100%',
              maxWidth: '1100px',
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
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#E0F2FE',
                  color: '#0369A1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileText size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                      Purchase Order: {poNumber}
                    </h3>
                    {viewingPoStatus && renderStatusBadge(
                      (viewingPoStatus.includes('CLOSED') || viewingPoStatus.includes('FULLY RECEIVED')) ? 'closed' :
                      (viewingPoStatus.includes('PARTIALLY')) ? 'partially_received' :
                      (viewingPoStatus === 'Proceed PO') ? 'proceed_po' :
                      (viewingPoStatus === 'Payment Processed') ? 'payment_processed' :
                      (viewingPoStatus === 'MD Approved' || viewingPoStatus === 'OPEN' || viewingPoStatus === 'Approved') ? 'approved' :
                      (viewingPoStatus === 'REJECTED') ? 'rejected' : 'pending',
                      viewingPoStatus
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Vendor: <strong style={{ color: '#0F172A' }}>{vendorName || '—'}</strong> • PO Date: {poDate || '—'}
                  </span>
                </div>
              </div>

              {/* Action Buttons in Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {(() => {
                  const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber) || {
                    poNo: poNumber,
                    vendor: vendorName,
                    amount: `₹ ${Number(getGrandTotal() || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                    paymentTerms
                  };
                  const st = String(viewingPoStatus || currentPoObj?.status || '').trim();
                  const objStatusType = String(currentPoObj?.statusType || '').toLowerCase();
                  const isMdApproved = st === 'MD Approved' || objStatusType === 'md_approved' || Boolean(currentPoObj?.approvedBy);
                  const isDraftOrPending = !isMdApproved && (st === 'Draft' || st.includes('Pending') || st.includes('WAITING') || st === 'Draft / Pending Approval' || st === 'OPEN');

                  if (isDraftOrPending && canApproveAsMD) {
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => setRejectingPo(currentPoObj)}
                          style={{
                            backgroundColor: '#FEF2F2',
                            border: '1px solid #FECACA',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#DC2626',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <XCircle size={14} /> Reject PO
                        </button>
                        <button
                          type="button"
                          onClick={() => setApprovingPo(currentPoObj)}
                          style={{
                            backgroundColor: '#16A34A',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                          }}
                        >
                          <CheckCircle size={14} /> Approve PO
                        </button>
                      </>
                    );
                  }
                  if (isMdApproved) {
                    return (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: '#F0FDF4',
                        border: '1px solid #BBF7D0',
                        borderRadius: '8px',
                        padding: '5px 12px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        color: '#166534'
                      }}>
                        <ShieldCheck size={14} style={{ color: '#16A34A' }} /> Approved by CEO
                      </span>
                    );
                  }
                  return null;
                })()}

                <button
                  type="button"
                  onClick={() => setPrintPoModal({
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
                    billingAddress,
                    items,
                    notes,
                    terms,
                    discountPct,
                    shippingCharges,
                    otherCharges
                  })}
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
                  <Printer size={13} /> Print
                </button>

                <button
                  type="button"
                  onClick={() => setShowCeoPoModal(false)}
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
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: '#FFFFFF' }}>
              {poDetailLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="skeleton-shimmer" style={{ height: '36px', width: '60%', borderRadius: '8px' }} />
                  <div className="skeleton-shimmer" style={{ height: '120px', width: '100%', borderRadius: '12px' }} />
                  <div className="skeleton-shimmer" style={{ height: '200px', width: '100%', borderRadius: '12px' }} />
                </div>
              ) : (
                renderPoReadOnlyDocument()
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 24px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Grand Total:</span>
                <strong style={{ fontSize: '16px', color: '#0E7490', fontWeight: '800' }}>
                  ₹{Number(getGrandTotal() || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCeoPoModal(false)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#334155',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>

                {(() => {
                  const currentPoObj = poList.find(p => p.poNo === poNumber || p.id === poNumber);
                  const st = String(viewingPoStatus || currentPoObj?.status || '').trim();
                  const objStatusType = String(currentPoObj?.statusType || '').toLowerCase();
                  const isMdApproved = st === 'MD Approved' || objStatusType === 'md_approved' || Boolean(currentPoObj?.approvedBy);
                  const isDraftOrPending = !isMdApproved && (st === 'Draft' || st.includes('Pending') || st.includes('WAITING') || st === 'Draft / Pending Approval' || st === 'OPEN');

                  if (isDraftOrPending && canApproveAsMD) {
                    return (
                      <button
                        type="button"
                        onClick={() => setApprovingPo(currentPoObj)}
                        style={{
                          backgroundColor: '#16A34A',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 20px',
                          fontSize: '13px',
                          fontWeight: '700',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                        }}
                      >
                        <CheckCircle size={15} /> Approve PO (Authorize Payment)
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkItemModal && (() => {
        const selectedCount = Object.keys(selectedBulkItems).length;
        const allFilteredSelected = filteredBulkCatalog.length > 0 && filteredBulkCatalog.every(it => selectedBulkItems[it.name]);

        const toggleSelectAll = () => {
          if (allFilteredSelected) {
            setSelectedBulkItems({});
          } else {
            const next = { ...selectedBulkItems };
            filteredBulkCatalog.forEach(it => {
              if (!next[it.name]) {
                next[it.name] = { item: it, qty: 1 };
              }
            });
            setSelectedBulkItems(next);
          }
        };

        const toggleSelectItem = (it) => {
          setSelectedBulkItems(prev => {
            const next = { ...prev };
            if (next[it.name]) {
              delete next[it.name];
            } else {
              next[it.name] = { item: it, qty: 1 };
            }
            return next;
          });
        };

        const updateItemQty = (it, newQty) => {
          const validQty = Math.max(1, Number(newQty) || 1);
          setSelectedBulkItems(prev => ({
            ...prev,
            [it.name]: { item: it, qty: validQty }
          }));
        };

        const handleConfirmBulkAdd = () => {
          const selectedKeys = Object.keys(selectedBulkItems);
          if (selectedKeys.length === 0) return;

          const itemsToAdd = selectedKeys.map(k => {
            const entry = selectedBulkItems[k];
            const it = entry.item;
            return {
              name: it.name || '',
              description: it.description || '',
              account: it.account || 'Raw Material',
              qty: Number(entry.qty) > 0 ? Number(entry.qty) : 1,
              unit: it.unit || 'MT',
              rate: Number(it.rate) || 0,
              tax: it.tax !== undefined && it.tax !== '' ? Number(it.tax) : 18
            };
          });

          setItems(prev => {
            const cleanPrev = prev.filter(p => p.name && p.name.trim() !== '');
            return [...cleanPrev, ...itemsToAdd];
          });

          setShowBulkItemModal(false);
          setSelectedBulkItems({});
          setBulkItemSearch('');
          showCustomAlert(`Added ${itemsToAdd.length} items to Purchase Order.`, 'Items Added in Bulk', 'success');
        };

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '16px',
            boxSizing: 'border-box'
          }}>
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              width: '100%',
              maxWidth: '740px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Boxes size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
                      Add Items in Bulk
                    </h3>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                      Select materials or items from your directory to insert into this Purchase Order
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBulkItemModal(false)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#94A3B8',
                    padding: '6px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search & Category Filter Toolbar */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    value={bulkItemSearch}
                    onChange={(e) => setBulkItemSearch(e.target.value)}
                    placeholder="Search items by name, SKU, or specification..."
                    style={{
                      width: '100%',
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      paddingLeft: '36px',
                      paddingRight: '12px',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  {bulkItemSearch && (
                    <button
                      type="button"
                      onClick={() => setBulkItemSearch('')}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 'none',
                        background: 'transparent',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {['All', 'Raw Material', 'Consumables', 'Fasteners'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setBulkCategoryFilter(cat)}
                        style={{
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          backgroundColor: bulkCategoryFilter === cat ? '#2563EB' : '#F1F5F9',
                          color: bulkCategoryFilter === cat ? '#FFFFFF' : '#475569',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    Showing <strong>{filteredBulkCatalog.length}</strong> items
                    {selectedCount > 0 && <span style={{ color: '#2563EB', fontWeight: '700', marginLeft: '6px' }}>({selectedCount} selected)</span>}
                  </div>
                </div>
              </div>

              {/* Items List Table Header */}
              <div style={{
                padding: '8px 20px',
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                display: 'grid',
                gridTemplateColumns: '40px 1fr 110px 120px 100px',
                alignItems: 'center',
                fontSize: '11px',
                fontWeight: '700',
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                <div>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', accentColor: '#2563EB' }}
                  />
                </div>
                <div>Item Name & Account</div>
                <div>Unit</div>
                <div style={{ textAlign: 'right' }}>Rate</div>
                <div style={{ textAlign: 'center' }}>Quantity</div>
              </div>

              {/* Scrollable Items List */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', padding: '0 8px' }}>
                {filteredBulkCatalog.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
                    <Boxes size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>No items match your search.</div>
                    <div style={{ fontSize: '11.5px', marginTop: '4px' }}>Try searching with a different term or clear the filter.</div>
                  </div>
                ) : (
                  filteredBulkCatalog.map(it => {
                    const isSelected = !!selectedBulkItems[it.name];
                    const curQty = selectedBulkItems[it.name]?.qty || 1;

                    return (
                      <div
                        key={it.id || it.name}
                        onClick={() => toggleSelectItem(it)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '40px 1fr 110px 120px 100px',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          margin: '4px 0',
                          border: isSelected ? '1px solid #BFDBFE' : '1px solid transparent',
                          backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectItem(it)}
                            style={{ cursor: 'pointer', accentColor: '#2563EB' }}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>
                            {it.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '10.5px', color: '#64748B', backgroundColor: '#F1F5F9', padding: '1px 6px', borderRadius: '4px' }}>
                              {it.account}
                            </span>
                            {it.sku && (
                              <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>
                                SKU: {it.sku}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: '12px', color: '#475569', fontWeight: '500' }}>
                          {it.unit}
                        </div>

                        <div style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: '700', textAlign: 'right' }}>
                          ₹{Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>

                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        >
                          <input
                            type="number"
                            min="1"
                            value={curQty}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateItemQty(it, val);
                            }}
                            style={{
                              width: '60px',
                              height: '28px',
                              borderRadius: '6px',
                              border: isSelected ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
                              textAlign: 'center',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: '#FFFFFF',
                              color: '#0F172A',
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '14px 20px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12.5px', color: '#64748B' }}>
                    {selectedCount > 0 ? (
                      <>
                        <strong style={{ color: '#2563EB' }}>{selectedCount}</strong> {selectedCount === 1 ? 'item' : 'items'} selected
                      </>
                    ) : (
                      'Select one or more items above'
                    )}
                  </span>
                  {selectedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedBulkItems({})}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#EF4444',
                        fontSize: '11.5px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowBulkItemModal(false)}
                    style={{
                      height: '36px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmBulkAdd}
                    disabled={selectedCount === 0}
                    style={{
                      height: '36px',
                      padding: '0 18px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: selectedCount === 0 ? '#94A3B8' : '#2563EB',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                      boxShadow: selectedCount === 0 ? 'none' : '0 2px 6px rgba(37, 99, 235, 0.3)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Add {selectedCount > 0 ? `${selectedCount} ` : ''}Item{selectedCount !== 1 ? 's' : ''} to PO
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================== CREATE NEW PRODUCT MODAL ==================== */}
      <CreateProductModal
        isOpen={showCreateProductModal}
        onClose={() => setShowCreateProductModal(false)}
        onProductCreated={handleProductCreatedFromModal}
        defaultCategory="Raw Material"
      />

      {/* ==================== SAVE CONFIRMATION POPUP ==================== */}
      {showSaveConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '420px', padding: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#2563eb', color: 'white', fontSize: '12px', fontWeight: '800', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.15em' }}>
              CONFIRM
            </div>
            <div style={{ padding: '16px', border: '1.5px dashed #cbd5e1', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Save Purchase Order?</h3>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                Please confirm the details of purchase order <strong>{poNumber}</strong>:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#475569', paddingLeft: '8px', borderLeft: '3px solid #3b82f6' }}>
                <div><strong>Vendor:</strong> {vendorName || 'Fresh Vendor'}</div>
                <div><strong>Total Amount:</strong> ₹{getGrandTotal().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '6px' }}>
                <button onClick={() => setShowSaveConfirm(false)} style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Discard</button>
                <button onClick={executeCreatePO} style={{ backgroundColor: '#dbeafe', color: '#2563eb', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Save PO</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CANCEL/DISCARD DETAILS CONFIRMATION POPUP ==================== */}
      {showCancelConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '420px', padding: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ backgroundColor: '#f97316', color: 'white', fontSize: '12px', fontWeight: '800', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.15em' }}>
              DISCARD
            </div>
            <div style={{ padding: '16px', border: '1.5px dashed #cbd5e1', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Discard Changes?</h3>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                Are you sure you want to discard your changes? All unsaved details for this Purchase Order will be lost.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '6px' }}>
                <button onClick={() => setShowCancelConfirm(false)} style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>No, Go Back</button>
                <button onClick={() => {
                  setShowCancelConfirm(false);
                  try {
                    sessionStorage.removeItem('controlroom_po_view_mode');
                    sessionStorage.removeItem('controlroom_viewing_po');
                  } catch (_) {}
                  setViewMode('list');
                }} style={{ backgroundColor: '#ffedd5', color: '#ea580c', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Discard Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL PURCHASE ORDER MODAL */}
      {cancellingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', border: '1px solid #E2E8F0', width: '460px', maxWidth: '92vw', padding: '22px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#DC2626', color: '#FFFFFF', fontSize: '12px', fontWeight: '800', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.12em', gap: '6px' }}>
              <Ban size={15} /> CANCEL PURCHASE ORDER
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>
                Cancel PO {cancellingPo.poNo || cancellingPo.id}?
              </h3>
              <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div>Vendor: <strong style={{ color: '#0F172A' }}>{cancellingPo.vendor || cancellingPo.vendorName || vendorName}</strong></div>
                <div>Amount: <strong style={{ color: '#0F172A' }}>{cancellingPo.amount ? `₹${Number(cancellingPo.amount).toLocaleString('en-IN')}` : (cancellingPo.total ? `₹${Number(cancellingPo.total).toLocaleString('en-IN')}` : '—')}</strong></div>
                <div>Current Status: <strong style={{ color: '#0E7490' }}>{cancellingPo.status || 'Active'}</strong></div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <label htmlFor="po-cancellation-remark-input" style={{ fontSize: '11px', fontWeight: 'bold', color: '#DC2626' }}>
                  Cancellation Remark (Mandatory) *
                </label>
                <textarea
                  id="po-cancellation-remark-input"
                  name="cancellationRemarkInput"
                  aria-label="Cancellation Remark"
                  value={cancellationRemarkInput}
                  onChange={(e) => setCancellationRemarkInput(e.target.value)}
                  placeholder="Enter detailed reason / remark for cancelling this PO..."
                  style={{ height: '70px', borderRadius: '8px', border: '1.5px solid #FCA5A5', padding: '8px 12px', fontSize: '12px', resize: 'none', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setCancellingPo(null); setCancellationRemarkInput(''); }}
                  style={{ border: 'none', backgroundColor: 'transparent', color: '#64748B', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={!cancellationRemarkInput || String(cancellationRemarkInput).trim() === ''}
                  onClick={() => handleCancelPoSubmit(cancellingPo)}
                  style={{
                    backgroundColor: (!cancellationRemarkInput || String(cancellationRemarkInput).trim() === '') ? '#FCA5A5' : '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: (!cancellationRemarkInput || String(cancellationRemarkInput).trim() === '') ? 'not-allowed' : 'pointer'
                  }}
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CEO REJECTION MODAL */}
      {rejectingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10005 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '450px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#dc2626', color: 'white', fontSize: '12px', fontWeight: '800', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.15em' }}>
              REJECT PURCHASE ORDER
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Reject PO {rejectingPo.poNo}?</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Vendor: <strong>{rejectingPo.vendor}</strong> | Amount: <strong>{rejectingPo.amount}</strong></span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                <label htmlFor="purchase-orders-rejection-reason-mandatory" style={{ fontSize: '11px', fontWeight: 'bold', color: '#dc2626' }}>Rejection Reason (Mandatory) *</label>
                <textarea id="purchase-orders-rejection-reason-mandatory" name="rejectionReasonMandatory" aria-label="Rejection Reason (Mandatory)"
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="Enter detailed reason for rejecting this PO..."
                  style={{ height: '70px', borderRadius: '8px', border: '1.5px solid #fca5a5', padding: '8px 12px', fontSize: '12px', resize: 'none' }}
                 />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button onClick={() => { setRejectingPo(null); setRejectionReasonInput(''); }} style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => handleRejectPoSubmit(rejectingPo)} style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Confirm Rejection</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CEO APPROVAL & PAYMENT AUTHORIZATION MODAL */}
      {approvingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10005 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '500px', maxWidth: '92vw', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#16a34a', color: 'white', fontSize: '12px', fontWeight: '800', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.12em', gap: '8px' }}>
              <ShieldCheck size={16} /> CEO APPROVAL & PAYMENT AUTHORIZATION
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                  Approve PO {approvingPo.poNo || approvingPo.id}?
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Vendor: <strong style={{ color: '#0F172A' }}>{approvingPo.vendor}</strong> | Value: <strong style={{ color: '#0E7490' }}>{approvingPo.amount}</strong>
                </span>
              </div>

              {/* Informative Authorization Notice */}
              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle size={18} style={{ color: '#16A34A', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '12px', color: '#166534', lineHeight: '1.45' }}>
                  <strong style={{ display: 'block', marginBottom: '2px' }}>CEO Authorization for Payment Release:</strong>
                  By approving this Purchase Order, you officially authorize Accounts to proceed with the payment clearance or credit terms release. Once approved, real-time alerts will notify Accounts and Procurement immediately.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="purchase-orders-approval-remarks-md" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                  Approval Remarks / Instructions for Accounts (Optional)
                </label>
                <textarea
                  id="purchase-orders-approval-remarks-md"
                  name="approvalRemarksMD"
                  aria-label="Approval Remarks / Instructions for Accounts"
                  value={approvalRemarksInput}
                  onChange={(e) => setApprovalRemarksInput(e.target.value)}
                  placeholder="Enter approval notes or payment instructions..."
                  style={{ height: '65px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '12px', resize: 'none', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const target = approvingPo;
                    setApprovingPo(null);
                    setApprovalRemarksInput('');
                    setRejectingPo(target);
                  }}
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#DC2626',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <XCircle size={14} /> Reject PO
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => { setApprovingPo(null); setApprovalRemarksInput(''); }}
                    style={{ border: 'none', backgroundColor: 'transparent', color: '#64748B', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: '8px 12px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprovePoSubmit(approvingPo)}
                    style={{
                      backgroundColor: '#16A34A',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 20px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
                    }}
                  >
                    <CheckCircle size={15} /> Approve PO & Authorize Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT PROCESS & CREDIT VERIFICATION MODAL (SUPPORTS UP TO 4 PROOF IMAGES) */}
      {paymentProcessingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '560px', maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#D97706', color: 'white', fontSize: '12px', fontWeight: '800', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.12em' }}>
              ACCOUNTS TEAM — PAYMENT & CREDIT PROCESS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Process Payment / Verify Credit</h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>PO Ref: <strong>{paymentProcessingPo.poNo}</strong> | Vendor: <strong>{paymentProcessingPo.vendor}</strong></span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#92400E', backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', padding: '4px 10px', borderRadius: '8px' }}>
                  {paymentProcessingPo.amount}
                </span>
              </div>

              {/* Mode Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="purchase-orders-payment-settlement-mode" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                  Payment / Settlement Mode <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  id="purchase-orders-payment-settlement-mode"
                  name="paymentSettlementMode"
                  aria-label="Payment / Settlement Mode"
                  value={payModeInput}
                  onChange={(e) => setPayModeInput(e.target.value)}
                  style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white' }}
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
                  <option value="UPI / Online">UPI / Corporate Card</option>
                  <option value="Cheque / DD">Cheque / Demand Draft</option>
                  <option value="Credit / Net Terms">Credit Mode (Vendor Credit Period / Net Days)</option>
                  <option value="Advance 50% / Balance on Delivery">Partial Advance Payment</option>
                </select>
              </div>

              {/* Conditional Credit Fields vs Direct Payment Fields */}
              {payModeInput === 'Credit / Net Terms' ? (
                <div style={{ backgroundColor: '#FEF9C3', border: '1px solid #FDE047', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={16} style={{ color: '#854D0E' }} />
                    <strong style={{ fontSize: '12px', color: '#854D0E' }}>Credit Verification Required</strong>
                  </div>
                  <p style={{ fontSize: '11px', color: '#713F12', margin: 0, lineHeight: 1.4 }}>
                    This PO will be marked as Credit Verified by Accounts. MD / CEO has authorized the PO, and once Accounts confirms credit terms, Procurement can Proceed PO for GRN.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    <label htmlFor="purchase-orders-agreed-credit-terms" style={{ fontSize: '11px', fontWeight: 'bold', color: '#854D0E' }}>Agreed Credit Terms / Days</label>
                    <input
                      id="purchase-orders-agreed-credit-terms"
                      name="agreedCreditTerms"
                      aria-label="Agreed Credit Terms / Days"
                      type="text"
                      value={payCreditTermsInput}
                      onChange={(e) => setPayCreditTermsInput(e.target.value)}
                      placeholder="e.g. Net 30 Days, PDC 45 Days..."
                      style={{ height: '34px', borderRadius: '6px', border: '1px solid #FDE047', padding: '0 10px', fontSize: '12px', backgroundColor: '#FFFFFF' }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label htmlFor="purchase-orders-utr-ref" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                      Transaction / UTR Reference No. <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      id="purchase-orders-utr-ref"
                      name="uTRReferenceNo"
                      aria-label="Transaction / UTR Reference No."
                      type="text"
                      value={payRefInput}
                      onChange={(e) => setPayRefInput(e.target.value)}
                      placeholder="e.g. UTR12345678"
                      style={{ height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label htmlFor="purchase-orders-amount-recorded" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                      Amount Recorded (₹) <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      id="purchase-orders-amount-recorded"
                      name="amountRecorded"
                      aria-label="Amount Recorded (₹)"
                      type="text"
                      value={payAmountInput}
                      onChange={(e) => setPayAmountInput(e.target.value)}
                      placeholder="Amount"
                      style={{ height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12px' }}
                    />
                  </div>
                </div>
              )}

              {/* Multi-Image Payment Proof Upload (Up to 4 Images) - Non-Credit modes */}
              {payModeInput !== 'Credit / Net Terms' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Payment Proof Images <span style={{ color: '#EF4444', fontWeight: 'bold' }}>* (Mandatory, max 4)</span>
                    </label>
                    <span style={{ fontSize: '11px', color: payImagesInput.length > 0 ? '#059669' : '#64748B', fontWeight: '700' }}>
                      {payImagesInput.length}/4 uploaded
                    </span>
                  </div>

                  {/* Uploaded Images Grid */}
                  {payImagesInput.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: '8px' }}>
                      {payImagesInput.map((imgObj, idx) => (
                        <div
                          key={idx}
                          style={{
                            border: '1px solid #86EFAC',
                            backgroundColor: '#F0FDF4',
                            borderRadius: '8px',
                            padding: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            position: 'relative'
                          }}
                        >
                          <div
                            onClick={() => setPreviewZoomImage(imgObj)}
                            style={{ position: 'relative', width: '100%', height: '65px', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer', backgroundColor: '#E2E8F0' }}
                            title="Click to zoom preview"
                          >
                            <img
                              src={imgObj.dataUrl}
                              alt={imgObj.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <div style={{ position: 'absolute', bottom: '2px', right: '2px', backgroundColor: 'rgba(15, 23, 42, 0.7)', borderRadius: '3px', padding: '1px 3px', color: '#FFF' }}>
                              <Maximize2 size={10} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '10px', color: '#166534', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '75px' }}>
                              {imgObj.name || `Proof #${idx + 1}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemovePaymentImage(idx)}
                              style={{
                                background: '#FEE2E2',
                                border: 'none',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#DC2626',
                                cursor: 'pointer',
                                padding: 0
                              }}
                              title="Remove image"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Dropzone if less than 4 images */}
                  {payImagesInput.length < 4 && (
                    <label style={{
                      border: '2px dashed #CBD5E1',
                      borderRadius: '10px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      backgroundColor: '#F8FAFC',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.backgroundColor = '#F0FDFA'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                    >
                      <UploadCloud size={20} style={{ color: '#0E7490' }} />
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#0E7490' }}>
                        {payImagesInput.length === 0 ? 'Click to upload Payment Screenshot / Receipt (up to 4)' : `+ Add Another Image (${4 - payImagesInput.length} remaining)`}
                      </span>
                      <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                        PNG, JPG, JPEG (Auto-compressed to &lt;25 KB)
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handlePaymentImageUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="purchase-orders-pay-remarks-input" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                  Accounts Verification Notes (Optional)
                </label>
                <textarea
                  id="purchase-orders-pay-remarks-input"
                  name="payRemarksInput"
                  aria-label="Accounts Verification Notes (Optional)"
                  value={payRemarksInput}
                  onChange={(e) => setPayRemarksInput(e.target.value)}
                  placeholder="Enter remarks or voucher details..."
                  style={{ height: '48px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '12px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setPaymentProcessingPo(null)}
                  style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleProcessPaymentSubmit(paymentProcessingPo)}
                  style={{ backgroundColor: '#D97706', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Check size={14} /> {payModeInput === 'Credit / Net Terms' ? 'Confirm Credit Terms' : 'Record & Verify Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROCEED PO & VENDOR DISPATCH CONFIRMATION MODAL (STEP 4) */}
      {proceedingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '16px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '680px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#0E7490', color: 'white', fontSize: '12px', fontWeight: '800', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.12em', gap: '8px' }}>
              <Send size={15} /> PROCEED PO & VENDOR DISPATCH (PROCUREMENT)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Card 1: PO & Vendor Summary */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px 16px' }}>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#0F172A', margin: 0 }}>
                    Proceed Purchase Order: {proceedingPo.poNo || proceedingPo.id}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    Vendor: <strong style={{ color: '#0F172A' }}>{proceedingPo.vendor}</strong> | Date: <strong>{proceedingPo.date || new Date().toLocaleDateString('en-GB')}</strong>
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', display: 'block' }}>
                    {proceedingPo.amount}
                  </span>
                  <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>
                    ✓ CEO Approved
                  </span>
                </div>
              </div>

              {/* Card 2: Accounts Payment Clearance Details */}
              {(() => {
                const pd = proceedingPo.paymentDetails;
                const proofImages = Array.isArray(pd?.paymentImages) && pd.paymentImages.length > 0
                  ? pd.paymentImages
                  : (pd?.paymentImage ? [{ dataUrl: pd.paymentImage, name: pd.paymentImageMeta?.name || 'Payment_Proof.jpg', size: pd.paymentImageMeta?.size || '' }] : []);

                return (
                  <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '12px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle size={15} style={{ color: '#16A34A' }} /> Accounts Payment Clearance Verified
                      </strong>
                      {pd?.date && (
                        <span style={{ fontSize: '10.5px', color: '#15803D', fontWeight: '700', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '6px' }}>
                          Verified on {pd.date} {pd.time}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', fontSize: '11.5px' }}>
                      <div>
                        <span style={{ color: '#4B5563', display: 'block', fontSize: '10.5px' }}>Payment Mode</span>
                        <strong style={{ color: '#111827' }}>{pd?.mode || 'Bank Transfer'}</strong>
                      </div>
                      {pd?.refNo && (
                        <div>
                          <span style={{ color: '#4B5563', display: 'block', fontSize: '10.5px' }}>Transaction / UTR Ref</span>
                          <strong style={{ color: '#0E7490' }}>{pd.refNo}</strong>
                        </div>
                      )}
                      <div>
                        <span style={{ color: '#4B5563', display: 'block', fontSize: '10.5px' }}>Amount Recorded</span>
                        <strong style={{ color: '#111827' }}>{pd?.amount || proceedingPo.amount}</strong>
                      </div>
                      {pd?.remarks && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span style={{ color: '#4B5563', display: 'block', fontSize: '10.5px' }}>Accounts Notes</span>
                          <span style={{ color: '#374151' }}>{pd.remarks}</span>
                        </div>
                      )}
                    </div>

                    {/* Payment Proof Images (Up to 4) with Lightbox Zoom */}
                    {proofImages.length > 0 && (
                      <div style={{ borderTop: '1px solid #DCFCE7', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Image size={13} /> Attached Payment Proof Receipts ({proofImages.length}):
                          </span>
                          <span style={{ fontSize: '10px', color: '#15803D' }}>Click any receipt to zoom preview</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
                          {proofImages.map((imgObj, idx) => (
                            <div
                              key={idx}
                              onClick={() => setPreviewZoomImage(imgObj)}
                              style={{
                                border: '1px solid #86EFAC',
                                borderRadius: '8px',
                                padding: '4px',
                                backgroundColor: '#FFFFFF',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#86EFAC'; e.currentTarget.style.transform = 'none'; }}
                            >
                              <div style={{ position: 'relative', width: '100%', height: '58px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#F1F5F9' }}>
                                <img
                                  src={imgObj.dataUrl || imgObj}
                                  alt={imgObj.name || `Proof ${idx + 1}`}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <div style={{ position: 'absolute', bottom: '2px', right: '2px', backgroundColor: 'rgba(15, 23, 42, 0.7)', borderRadius: '3px', padding: '1px 3px', color: '#FFF' }}>
                                  <Maximize2 size={10} />
                                </div>
                              </div>
                              <span style={{ fontSize: '9.5px', fontWeight: '700', color: '#166534', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {imgObj.name || `Receipt #${idx + 1}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Card 3: Formatted Vendor Message Content (WhatsApp & Email Preview) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="purchase-orders-vendor-message-content" style={{ fontSize: '11px', fontWeight: 'bold', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={13} style={{ color: '#0E7490' }} /> Vendor Message Preview (WhatsApp & Email Format)
                  </label>
                  <span style={{ fontSize: '10.5px', color: '#64748B' }}>Editable text</span>
                </div>
                <textarea
                  id="purchase-orders-vendor-message-content"
                  name="vendorMessageContent"
                  aria-label="Vendor Message Preview (WhatsApp & Email Format)"
                  value={proceedMessageContent}
                  onChange={(e) => setProceedMessageContent(e.target.value)}
                  style={{
                    height: '110px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '8px 10px',
                    fontSize: '11.5px',
                    fontFamily: 'monospace',
                    lineHeight: '1.4',
                    color: '#1E293B',
                    backgroundColor: '#F8FAFC',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Vendor Email & Phone Contact Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="purchase-orders-vendor-company-com" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Mail size={13} style={{ color: '#0E7490' }} /> Vendor Email Address
                  </label>
                  <input
                    id="purchase-orders-vendor-company-com"
                    name="vendorCompanyCom"
                    aria-label="Vendor Email Address"
                    type="email"
                    value={proceedEmailInput}
                    onChange={(e) => setProceedEmailInput(e.target.value)}
                    placeholder="vendor@company.com"
                    style={{ height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12px', color: '#1E293B', backgroundColor: '#FFFFFF' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="purchase-orders-vendor-phone-input" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={13} style={{ color: '#16A34A' }} /> Vendor Mobile / WhatsApp No.
                  </label>
                  <input
                    id="purchase-orders-vendor-phone-input"
                    name="vendorPhoneInput"
                    aria-label="Vendor Mobile / WhatsApp No."
                    type="text"
                    value={proceedPhoneInput}
                    onChange={(e) => setProceedPhoneInput(e.target.value)}
                    placeholder="e.g. 9884720789"
                    style={{ height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12px', color: '#1E293B', backgroundColor: '#FFFFFF' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label htmlFor="purchase-orders-proceed-remarks-input" style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                  Internal Dispatch Remarks (Optional)
                </label>
                <textarea
                  id="purchase-orders-proceed-remarks-input"
                  name="proceedRemarksInput"
                  aria-label="Internal Dispatch Remarks (Optional)"
                  value={proceedRemarksInput}
                  onChange={(e) => setProceedRemarksInput(e.target.value)}
                  placeholder="Enter dispatch notes, delivery gate instructions, etc..."
                  style={{ height: '42px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '6px 10px', fontSize: '12px', resize: 'none' }}
                />
              </div>

              {/* Action Buttons: WhatsApp + Authorize Dispatch */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '10px', borderTop: '1px solid #E2E8F0' }}>
                <button
                  type="button"
                  onClick={() => handleSendViaWhatsApp(proceedingPo)}
                  style={{
                    backgroundColor: '#25D366',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(37, 211, 102, 0.25)'
                  }}
                  title="Open WhatsApp Web / App with this message content"
                >
                  <MessageSquare size={14} /> Send via WhatsApp
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => { setProceedingPo(null); setProceedRemarksInput(''); setProceedEmailInput(''); setProceedPhoneInput(''); }}
                    style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: '8px 14px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleProceedPoSubmit(proceedingPo)}
                    style={{
                      backgroundColor: '#0E7490',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 20px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)'
                    }}
                  >
                    <Send size={14} /> Authorize & Send PO to Vendor
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN LIGHTBOX ZOOM MODAL FOR PAYMENT PROOF IMAGES */}
      {previewZoomImage && (
        <div 
          onClick={() => setPreviewZoomImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 11000,
            padding: '24px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '16px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '16px' }}>
              <strong style={{ fontSize: '14px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} style={{ color: '#0E7490' }} />
                {typeof previewZoomImage === 'object' ? previewZoomImage.name || 'Payment Proof Receipt' : 'Payment Proof Receipt'}
              </strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={typeof previewZoomImage === 'object' ? previewZoomImage.dataUrl : previewZoomImage}
                  download={typeof previewZoomImage === 'object' ? previewZoomImage.name || 'payment_proof.jpg' : 'payment_proof.jpg'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#0E7490',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Download size={13} /> Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewZoomImage(null)}
                  style={{
                    background: '#F1F5F9',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#475569'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', maxHeight: '78vh' }}>
              <img
                src={typeof previewZoomImage === 'object' ? previewZoomImage.dataUrl : previewZoomImage}
                alt="Payment Proof Zoom"
                style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '8px', border: '1px solid #E2E8F0' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* CREDIT CONFIRMATION NOTIFICATION POPUP */}
      {creditAlertPopup && (
        <div style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 10000, animation: 'slideInRight 0.3s ease-out' }}>
          <div style={{ backgroundColor: '#FFFFFF', border: '2px solid #F59E0B', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', width: '380px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                  <AlertCircle size={16} />
                </div>
                <strong style={{ fontSize: '13px', color: '#92400E' }}>Credit Term Verified by Accounts</strong>
              </div>
              <button
                onClick={() => setCreditAlertPopup(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: 1.4 }}>
              PO <strong>{creditAlertPopup.poNo}</strong> ({creditAlertPopup.vendor}) is confirmed under <strong>{creditAlertPopup.terms}</strong>. CEO approval was verified, and accounts team has authorized credit terms.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              {isProcurementHead ? (
                <button
                  type="button"
                  onClick={() => {
                    const targetPo = poList.find(p => p.poNo === creditAlertPopup.poNo) || { poNo: creditAlertPopup.poNo, vendor: creditAlertPopup.vendor, amount: creditAlertPopup.amount };
                    setCreditAlertPopup(null);
                    handleOpenProceedPoModal(targetPo);
                  }}
                  style={{ backgroundColor: '#0E7490', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Proceed PO Now <ArrowRight size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreditAlertPopup(null)}
                  style={{ backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MANDATORY VALIDATION MODAL */}
      {validationErrorModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
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
                {validationErrorModal.fields.map((field, idx) => (
                  <li key={idx}><strong>{field}</strong></li>
                ))}
              </ul>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => setValidationErrorModal(null)}
                style={{ backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)' }}
              >
                OK, I'll fill it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE CUSTOM SET / KIT MODAL ─── */}
      {showCreateSetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              width: '460px',
              maxWidth: '92vw',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    Create Custom Set / Kit
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                    Bundle products into a set for this Purchase Order
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateSetModal(false)}
                style={{ border: 'none', background: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomSet} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Set / Kit Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="e.g. Custom 5kW Structure Set"
                  style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1.5px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '600', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Pricing / Capacity Unit
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setNewSetUnit('Sets')}
                    style={{ flex: 1, height: '36px', borderRadius: '8px', border: newSetUnit === 'Sets' ? '2px solid #7C3AED' : '1.5px solid #CBD5E1', backgroundColor: newSetUnit === 'Sets' ? '#F5F3FF' : '#FFFFFF', color: newSetUnit === 'Sets' ? '#7C3AED' : '#475569', fontWeight: '800', fontSize: '12.5px', cursor: 'pointer' }}
                  >
                    Sets (Set-based)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSetUnit('kW')}
                    style={{ flex: 1, height: '36px', borderRadius: '8px', border: newSetUnit === 'kW' ? '2px solid #7C3AED' : '1.5px solid #CBD5E1', backgroundColor: newSetUnit === 'kW' ? '#F5F3FF' : '#FFFFFF', color: newSetUnit === 'kW' ? '#7C3AED' : '#475569', fontWeight: '800', fontSize: '12.5px', cursor: 'pointer' }}
                  >
                    kW (Kilowatt Capacity)
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    {newSetUnit === 'kW' ? 'Capacity (kW)' : 'Number of Sets'}
                  </label>
                  <input
                    type="number"
                    min={newSetUnit === 'kW' ? '0.01' : '1'}
                    step={newSetUnit === 'kW' ? 'any' : '1'}
                    max="99999"
                    value={newSetCount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') { setNewSetCount(''); return; }
                      setNewSetCount(newSetUnit === 'kW' ? (parseFloat(val) || '') : (parseInt(val, 10) || ''));
                    }}
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1.5px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    GST Rate
                  </label>
                  <select
                    value={newSetGstRate}
                    onChange={(e) => setNewSetGstRate(e.target.value)}
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1.5px solid #CBD5E1', padding: '0 10px', fontSize: '13px', fontWeight: '700', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="18%">18%</option>
                    <option value="12%">12%</option>
                    <option value="5%">5%</option>
                    <option value="0%">0%</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  {newSetUnit === 'kW' ? 'Rate per kW (₹)' : 'Pack Amt / Set Price (₹)'} <span style={{ fontSize: '11px', fontWeight: '400', color: '#64748B' }}>(Optional, can set in table)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: '#64748B' }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={newSetPrice}
                    onChange={(e) => setNewSetPrice(e.target.value)}
                    placeholder={newSetUnit === 'kW' ? 'Enter rate per 1 kW' : 'Enter Pack Amount for 1 set'}
                    style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1.5px solid #CBD5E1', padding: '0 12px 0 28px', fontSize: '13px', fontWeight: '700', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateSetModal(false)}
                  style={{ padding: '9px 18px', borderRadius: '8px', backgroundColor: '#FFFFFF', color: '#475569', border: '1px solid #CBD5E1', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 20px', borderRadius: '8px', backgroundColor: '#7C3AED', color: '#FFFFFF', border: 'none', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(124, 58, 237, 0.3)' }}
                >
                  <Layers size={15} />
                  Create Set &amp; Add Items
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
