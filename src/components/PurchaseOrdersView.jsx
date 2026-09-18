import React, { useState, useEffect, useRef } from 'react';
import { Plus, Check, Hourglass, Edit3, Trash2, Eye, FileText, X, XCircle, UploadCloud, CheckCircle, Search, AlertTriangle, ArrowLeft, ArrowRight, MoreVertical, Edit, Truck, Info, Mail, Calendar, Filter, ChevronLeft, ChevronRight, RotateCcw, ChevronDown, AlertCircle, Copy, Tag, MoreHorizontal, CreditCard, Send, Image, Boxes, Clock, FileCode } from 'lucide-react';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { getSafeZohoPOs, getSafeZohoVendors, getSafeZohoItems, saveSafeZohoPO } from '../services/zohoSafeSync';
import StatusBadge from './StatusBadge';
import NotificationToast from './NotificationToast';
import TallySyncModal from './views/TallySyncModal';

const PRESET_MATERIALS = [
  { name: 'GI Steel Coil 2mm', account: 'Raw Material', unit: 'MT', rate: 45000, tax: 18 },
  { name: 'GI Steel Coil 1.6mm', account: 'Raw Material', unit: 'MT', rate: 43000, tax: 18 },
  { name: 'CRC Sheet 1.2mm', account: 'Raw Material', unit: 'MT', rate: 52000, tax: 18 },
  { name: 'Self Drilling Screw', account: 'Consumables', unit: 'NOS', rate: 3.5, tax: 16 },
  { name: 'Hex Bolt M10', account: 'Fasteners', unit: 'NOS', rate: 6.2, tax: 18 },
  { name: 'Structural Steel I-Beam', account: 'Raw Material', unit: 'MT', rate: 48000, tax: 18 },
  { name: 'Electrical Copper Cable 4sqmm', account: 'Consumables', unit: 'MTR', rate: 120, tax: 18 },
  { name: 'Cement Bag 50kg', account: 'Raw Material', unit: 'NOS', rate: 410, tax: 12 },
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
  
  const getLoggedInUserName = () => {
    const storedName = localStorage.getItem('controlroom_logged_user_name');
    if (storedName && storedName !== 'undefined' && storedName !== 'null') return storedName;
    try {
      const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
      const allEmps = [...(Array.isArray(storedEmps) ? storedEmps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];
      const match = allEmps.find(e => e && (e.role === userRole || (userRole.includes('Supervisor') && String(e.role).includes('Supervisor')) || (userRole.includes('Dispatch') && String(e.role).includes('Dispatch'))));
      if (match && (match.employee_name || match.name)) return match.employee_name || match.name;
    } catch(e) {}
    if (userRole === 'Production Head') return 'Senthil Kumar';
    if (userRole === 'Technical Administrator' || userRole === 'CEO') return 'Annamalaiyar';
    if (userRole === 'Dispatch Head') return 'Kalpana';
    if (userRole === 'Floor Supervisor') return 'Floor Supervisor';
    if (userRole === 'Floor Employee') return 'Floor Employee';
    if (userRole === 'Accounts Head') return 'Venkatesh';
    if (userRole === 'Accounts Executive') return 'Priya';
    if (userRole === 'Sales Head') return 'Vijay';
    if (userRole === 'Sales Executive') return 'Mohith JV';
    if (userRole === 'Design Engineer') return 'Dinesh';
    if (userRole === 'Design Executive') return 'Kavitha';
    if (userRole === 'Invoice Executive' || userRole === 'Billing') return 'Anand';
    if (userRole === 'BOM Executive') return 'Balaji';
    if (userRole === 'Procurement Head' || userRole === 'Procurement Admin') return 'Annamalaiyar';
    return 'Annamalaiyar';
  };

  const loggedInUserName = getLoggedInUserName();
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'create' | 'edit' | 'view'
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
  const [showTallyModal, setShowTallyModal] = useState(false);

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
    if (s === 'REJECTED' || st === 'rejected') return 'REJECTED';

    const totOrd = Number(po.totalOrderedQty || (Array.isArray(po.items) ? po.items.reduce((sum, it) => sum + Number(it.qty || it.quantity || 0), 0) : 0));
    const totRec = Number(po.totalReceivedQty || po.totalReceived || (Array.isArray(po.items) ? po.items.reduce((sum, it) => sum + Number(it.previouslyReceived || 0), 0) : 0));
    if ((totOrd > 0 && totRec > 0 && totRec < totOrd) || s.toUpperCase().includes('PARTIAL') || st.includes('partial')) {
      return 'PARTIALLY_RECEIVED';
    }

    if (s.includes('CLOSED') || st === 'closed' || s.includes('FULLY RECEIVED') || (totOrd > 0 && totRec >= totOrd)) return 'CLOSED';
    if (s.toLowerCase().includes('proceed') || st.includes('proceed') || Boolean(po.proceedDetails)) return 'PROCEED_PO';
    if (s.toLowerCase().includes('payment') || st.includes('payment') || Boolean(po.paymentDetails)) return 'PAYMENT_PROCESSED';
    if (s === 'MD Approved' || st === 'md_approved' || Boolean(po.approvedBy)) return 'MD_APPROVED';
    return 'Draft';
  };

  const [statusFilter, setStatusFilter] = useState('All');
  const [filterDate, setFilterDate] = useState('');
  const [poTab, setPoTab] = useState(isExecutiveOrMD ? 'Draft' : isAccounts ? 'MD_APPROVED' : 'All');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setFilterDate('');
    setPoTab('All');
    setCurrentPage(1);
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
      const safePOs = await getSafeZohoPOs();
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

            const effStatus = keepIncoming ? (p.status || existing.status) : existing.status;
            const effStatusType = keepIncoming ? (p.statusType || existing.statusType) : existing.statusType;

            const existingItems = Array.isArray(existing.items) && existing.items.length > 0 ? existing.items : [];
            const incomingItems = Array.isArray(p.items) && p.items.length > 0 ? p.items : [];
            return {
              ...existing,
              ...p,
              status: effStatus,
              statusType: effStatusType,
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

        const existingKeys = new Set(mergedIncoming.map(p => normalize(p.poNo || p.id)));
        const localOnly = currentPrev.filter(p => {
          const k1 = normalize(p.poNo);
          const k2 = normalize(p.id);
          return (k1 && !existingKeys.has(k1)) && (k2 && !existingKeys.has(k2));
        });

        return [...mergedIncoming, ...localOnly];
      };

      if (Array.isArray(safePOs) && safePOs.length > 0) {
        setPoList(prev => mergeWithPrev(safePOs, prev));
      } else {
        const response = await fetchWithTimeout('/api/zoho/purchaseorders', { timeout: 25000 }).catch(() => null);
        if (response && response.ok) {
          const zohoPOs = await response.json().catch(() => []);
          if (Array.isArray(zohoPOs)) {
            setPoList(prev => mergeWithPrev(zohoPOs, prev));
          }
        }
      }
    } catch (err) {
      console.error("Error fetching Zoho POs:", err);
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
          getSafeZohoVendors(),
          getSafeZohoItems()
        ]);
        if (Array.isArray(safeVendors) && safeVendors.length > 0) {
          setZohoVendors(safeVendors);
        } else {
          const vRes = await fetchWithTimeout('/api/zoho/vendors', { timeout: 25000 }).catch(() => null);
          if (vRes && vRes.ok) {
            const vData = await vRes.json().catch(() => []);
            setZohoVendors(vData || []);
          }
        }

        if (Array.isArray(safeItems) && safeItems.length > 0) {
          setZohoItems(safeItems);
        } else {
          const iRes = await fetchWithTimeout('/api/zoho/items', { timeout: 25000 }).catch(() => null);
          if (iRes && iRes.ok) {
            const iData = await iRes.json().catch(() => []);
            setZohoItems(iData || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch dropdown resources from Zoho:", err);
      }
    };
    fetchZohoPOs();
    fetchZohoDropdowns();

    // Instant Real-Time Push Listener: Refetches POs the millisecond another user creates, approves, or modifies a PO
    const handlePoPush = () => {
      fetchZohoPOs(true);
    };
    window.addEventListener('controlroom_po_updated', handlePoPush);
    window.addEventListener('controlroom_storage_update', handlePoPush);

    // Auto-poll Zoho Books POs silently in background every 30 seconds as fallback
    const pollInterval = setInterval(() => {
      fetchZohoPOs(true);
    }, 30000);

    return () => {
      window.removeEventListener('controlroom_po_updated', handlePoPush);
      window.removeEventListener('controlroom_storage_update', handlePoPush);
      clearInterval(pollInterval);
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
          
          fetch('/api/zoho/next-po-number')
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
  const [branch, setBranch] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [email, setEmail] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [deliveryType, setDeliveryType] = useState('Organization'); // 'Organization' | 'Customer'
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [sameAsDelivery, setSameAsDelivery] = useState(true);

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

  // Pricing Charges
  const [shippingCharges, setShippingCharges] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);

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
    return items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.rate || 0)), 0);
  };
  const getDiscount = () => {
    return getSubTotal() * (Number(discountPct || 0) / 100);
  };
  const getTaxableAmount = () => {
    return getSubTotal() - getDiscount();
  };
  const getCGST = () => {
    const factor = (100 - Number(discountPct || 0)) / 100;
    const totalTax = items.reduce((sum, item) => {
      const itemTaxable = (Number(item.qty || 0) * Number(item.rate || 0)) * factor;
      const itemTaxPct = Number(item.tax !== undefined && item.tax !== '' ? item.tax : 18);
      return sum + (itemTaxable * (itemTaxPct / 100));
    }, 0);
    return totalTax / 2;
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
    setItems([...items, { name: '', account: 'Raw Material', qty: 1, unit: 'MT', rate: 0, tax: 18 }]);
  };

  const handleRemoveItem = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, val) => {
    const updated = [...items];
    updated[idx][field] = val;
    setItems(updated);
  };

  const [formErrors, setFormErrors] = useState({});
  const [rejectingPo, setRejectingPo] = useState(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [approvingPo, setApprovingPo] = useState(null);
  const [approvalRemarksInput, setApprovalRemarksInput] = useState('');

  // Payment Processing & Credit Verification Modal states
  const [paymentProcessingPo, setPaymentProcessingPo] = useState(null);
  const [payModeInput, setPayModeInput] = useState('Bank Transfer');
  const [payRefInput, setPayRefInput] = useState('');
  const [payAmountInput, setPayAmountInput] = useState('');
  const [payRemarksInput, setPayRemarksInput] = useState('');
  const [payCreditTermsInput, setPayCreditTermsInput] = useState('Net 30 Days');
  const [payImageInput, setPayImageInput] = useState(null);
  const [payImageMeta, setPayImageMeta] = useState(null);
  const [creditAlertPopup, setCreditAlertPopup] = useState(null);

  // Proceed PO Confirmation Modal state
  const [proceedingPo, setProceedingPo] = useState(null);
  const [proceedRemarksInput, setProceedRemarksInput] = useState('');
  const [proceedEmailInput, setProceedEmailInput] = useState('');

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
    if (!deliveryAddress || String(deliveryAddress).trim() === '') missingFields.push('Delivery Address');
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
      account: it.account || 'Cost of Goods Sold',
      qty: Number(it.qty || 1),
      unit: it.unit || 'NOS',
      rate: Number(it.rate) > 0 ? Number(it.rate) : 0,
      tax: (it.tax !== undefined && it.tax !== '' && !isNaN(Number(it.tax))) ? Number(it.tax) : 18,
      sku: it.sku || ''
    }));

    setFormErrors({});
    const statusTypeToSave = isDraft ? 'draft' : (statusToSave === 'WAITING FOR APPROVAL' ? 'pending' : 'approved');

    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-GB', {
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

    const newPO = {
      id: assignedId,
      zohoId: assignedZohoId,
      poNo: safePoNo || ('PO-' + String(poList.length + 1).padStart(5, '0')),
      vendor: vendorName || 'Fresh Vendor',
      branch: branch || '',
      contactPerson: contactPerson || '',
      contactNo: contactNo || '',
      email: email || '',
      gstNo: safeGstNo,
      deliveryType: deliveryType,
      deliveryAddress: (deliveryAddress || '').trim(),
      billingAddress: (billingAddress || '').trim(),
      poDate: editIdx !== null ? poList[editIdx].poDate : formattedDate,
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
    saveSafeZohoPO(newPO);

    const syncPOToServer = async (isEdit) => {
      try {
        const res = await fetch('/api/zoho/purchaseorders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newPO)
        });

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
            saveSafeZohoPO(mergedSavedPO);
            showCustomAlert(data.message || 'Purchase Order created successfully in Zoho Books!', 'PO Created', 'success');
          } else if (data.message) {
            showCustomAlert(data.message, 'Zoho Sync Notice', 'warning');
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
        fetchZohoPOs();
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
    saveSafeZohoPO(updatedApprovedPo);

    fetch(`/api/zoho/purchaseorders/${encodeURIComponent(poId)}/approve`, {
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
    setPayImageInput(null);
    setPayImageMeta(null);
  };

  const handlePaymentImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Lightweight compression using FileReader / Canvas
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = img.width > MAX_WIDTH ? MAX_WIDTH : img.width;
        canvas.height = img.width > MAX_WIDTH ? img.height * scaleSize : img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setPayImageInput(dataUrl);
        setPayImageMeta({
          name: file.name,
          size: `${Math.round(dataUrl.length * 0.75 / 1024)} KB`,
          type: file.type || 'image/jpeg',
          uploadedAt: new Date().toISOString()
        });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleProcessPaymentSubmit = async (poTarget) => {
    if (!poTarget) return;
    const poId = poTarget.poNo || poTarget.id;
    const isCredit = payModeInput === 'Credit / Net Terms';

    // Image of the payment is mandatory for all non-credit payment modes (Bank Transfer, UPI, Cheque, Advance, etc.)
    if (!isCredit && !payImageInput) {
      alert('Payment Proof Image is mandatory. Please attach the image of the payment to complete verification.');
      return;
    }

    const clean = (s) => String(s || '').replace(/[/_\-\s]/g, '').toLowerCase();
    const targetKey = clean(poId);

    const updatedPaymentPo = {
      ...poTarget,
      status: 'Payment Processed',
      statusType: 'payment_processed',
      paymentDetails: {
        mode: payModeInput,
        refNo: payRefInput || (isCredit ? 'CREDIT-CONFIRMED' : ''),
        amount: payAmountInput ? `₹ ${Number(payAmountInput).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : poTarget.amount,
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        remarks: payRemarksInput || (isCredit ? 'Credit terms verified by Accounts team' : 'Payment recorded by Accounts'),
        isCredit,
        creditTerms: payCreditTermsInput,
        paymentImage: payImageInput,
        paymentImageMeta: payImageMeta,
        verifiedBy: 'Accounts Team'
      }
    };

    setPaymentProcessingPo(null);
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
      await saveSafeZohoPO(updatedPaymentPo);
    } catch (saveErr) {
      console.warn('saveSafeZohoPO notice:', saveErr);
    }

    // Broadcast update to other tabs (Procurement team, etc.)
    try {
      window.dispatchEvent(new CustomEvent('controlroom_po_updated', { detail: updatedPaymentPo }));
      window.dispatchEvent(new Event('controlroom_storage_update'));
    } catch (_) {}

    // Call backend endpoint to ensure server memory & disk are updated synchronously
    try {
      await fetch(`/api/zoho/purchaseorders/${encodeURIComponent(poId)}/process-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMode: payModeInput,
          paymentRef: payRefInput || (isCredit ? 'CREDIT-CONFIRMED' : ''),
          amountPaid: payAmountInput ? `₹ ${Number(payAmountInput).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : poTarget.amount,
          remarks: payRemarksInput || (isCredit ? 'Credit terms verified by Accounts team' : 'Payment recorded by Accounts'),
          isCredit: isCredit,
          creditTerms: payCreditTermsInput,
          paymentImage: payImageInput,
          paymentImageMeta: payImageMeta
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

  const handleProceedPoSubmit = async (poTarget) => {
    if (!poTarget) return;
    const poId = poTarget.poNo || poTarget.id;

    const now = new Date();
    const proceedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const proceedTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const remarks = proceedRemarksInput || 'Authorized for dispatch and GRN creation';
    const targetVendorEmail = (proceedEmailInput || poTarget.email || email || '').trim();

    const proceedDetails = {
      date: proceedDate,
      time: proceedTime,
      remarks,
      authorizedBy: 'Procurement Head',
      vendorEmail: targetVendorEmail,
      emailDispatched: Boolean(targetVendorEmail),
      deliveryStatus: targetVendorEmail ? `Dispatched to ${targetVendorEmail}` : 'Authorized (Ready for GRN)'
    };

    const updatedProceedPo = {
      ...poTarget,
      status: 'Proceed PO',
      statusType: 'proceed_po',
      email: targetVendorEmail || poTarget.email,
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

    // 2. Persist immediately to cloud & disk
    try {
      await saveSafeZohoPO(updatedProceedPo);
    } catch (saveErr) {
      console.warn('saveSafeZohoPO notice:', saveErr);
    }

    try {
      window.dispatchEvent(new CustomEvent('controlroom_po_updated', { detail: updatedProceedPo }));
      window.dispatchEvent(new Event('controlroom_storage_update'));
    } catch (_) {}

    // 3. Call backend endpoint to update server memory and disk store synchronously
    try {
      await fetch(`/api/zoho/purchaseorders/${encodeURIComponent(poId)}/proceed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remarks,
          authorizedBy: 'Procurement Head',
          vendorEmail: targetVendorEmail
        })
      });
    } catch (e) {
      console.warn('Backend proceed notice:', e);
    }

    const alertMsg = targetVendorEmail
      ? `PO ${poId} marked as Proceed PO! An official Purchase Order copy has been automatically dispatched to vendor (${targetVendorEmail}). Ready for GRN receiving.`
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

    fetch(`/api/zoho/purchaseorders/${encodeURIComponent(poId)}/reject`, {
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
    setBranch(effBranch);
    setContactPerson(effContact);
    setContactNo(effContactNo);
    setEmail(effEmail);
    setGstNo(effGst);
    setDeliveryType(po.deliveryType || 'Organization');
    setDeliveryAddress(effDelAddr);
    setBillingAddress(effBillAddr);
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
    const targetId = (/^\d{15,}$/.test(String(po.id || ''))) 
      ? po.id 
      : ((/^\d{15,}$/.test(String(po.zohoId || ''))) 
        ? po.zohoId 
        : (po.id || po.poNo || po.zohoId));
    if (targetId) {
      if (!enrichedPo.items || enrichedPo.items.length === 0) {
        setPoDetailLoading(true);
      }
      try {
        const res = await fetch(`/api/zoho/purchaseorders/${encodeURIComponent(targetId)}`);
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
            saveSafeZohoPO(merged);
            try {
              sessionStorage.setItem('controlroom_viewing_po', JSON.stringify(merged));
            } catch (_) {}
          }
        }
      } catch (err) {
        console.error("Failed to load PO details from Zoho", err);
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
    setViewMode('view');
    try {
      sessionStorage.setItem('controlroom_po_view_mode', 'view');
      sessionStorage.setItem('controlroom_viewing_po', JSON.stringify(enrichedPo));
    } catch (_) {}
    setActiveDropdownIdx(null);
    const targetId = (/^\d{15,}$/.test(String(po.id || ''))) 
      ? po.id 
      : ((/^\d{15,}$/.test(String(po.zohoId || ''))) 
        ? po.zohoId 
        : (po.id || po.poNo || po.zohoId));
    if (targetId) {
      if (!enrichedPo.items || enrichedPo.items.length === 0) {
        setPoDetailLoading(true);
      }
      try {
        const res = await fetch(`/api/zoho/purchaseorders/${encodeURIComponent(targetId)}`);
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
            saveSafeZohoPO(merged);
            try {
              sessionStorage.setItem('controlroom_viewing_po', JSON.stringify(merged));
            } catch (_) {}
          }
      } catch (err) {
        console.error("Failed to load PO details from Zoho", err);
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
      const res = await fetch('/api/zoho/next-po-number');
      if (res.ok) {
        const data = await res.json();
        if (data.nextPoNumber) {
          setPoNumber(data.nextPoNumber);
        }
      }
    } catch (e) {
      setPoNumber('PO-' + String(poList.length + 1).padStart(5, '0'));
    }

    setViewMode('create');

    const targetId = (/^\d{15,}$/.test(String(po.id || ''))) 
      ? po.id 
      : ((/^\d{15,}$/.test(String(po.zohoId || ''))) 
        ? po.zohoId 
        : (po.id || po.poNo || po.zohoId));
    if (targetId) {
      if (!enrichedPo.items || enrichedPo.items.length === 0) {
        setPoDetailLoading(true);
      }
      try {
        const res = await fetch(`/api/zoho/purchaseorders/${encodeURIComponent(targetId)}`);
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
          const nextRes = await fetch('/api/zoho/next-po-number');
          if (nextRes.ok) {
            const nextData = await nextRes.json();
            if (nextData.nextPoNumber) {
              setPoNumber(nextData.nextPoNumber);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load PO details for cloning from Zoho", err);
      } finally {
        setPoDetailLoading(false);
      }
    }
  };

  // Helper to calculate next PO number matching Zoho Books format (PO-000XX)
  const getNextPoNumber = (list) => {
    let maxNum = 43;
    (list || []).forEach(p => {
      const str = String(p.poNo || p.id || '');
      const match = str.match(/^PO-(\d+)/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (val > maxNum && val < 2000) {
          maxNum = val;
        }
      }
    });
    return 'PO-' + String(maxNum + 1).padStart(5, '0');
  };

  // Triggers fresh form initialization
  const handleStartFreshPO = () => {
    setEditIdx(null);
    setPoNumber(getNextPoNumber(poList));
    fetch('/api/zoho/next-po-number')
      .then(res => res.json())
      .then(data => {
        if (data && data.nextPoNo) {
          setPoNumber(data.nextPoNo);
        }
      })
      .catch(() => { });
    setVendorName('');
    setBranch('');
    setContactPerson('');
    setContactNo('');
    setEmail('');
    setGstNo('');
    setDeliveryType('Organization');
    setDeliveryAddress('');
    setBillingAddress('');
    setSameAsDelivery(true);
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
      const targetId = targetPO.id || targetPO.poNo || targetPO.zohoId;

      setPoList(prev => prev.filter((_, i) => i !== deleteIdx));
      setDeleteIdx(null);

      if (targetId) {
        fetch(`/api/zoho/purchaseorders/${encodeURIComponent(targetId)}`, {
          method: 'DELETE'
        }).then(res => res.json()).then(data => {
          console.log('PO deleted from Zoho & Control Room:', data);
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
    return <StatusBadge status={label || type} size="sm" />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-24)' }}>

      {/* ==================== VIEW 1: MAIN PO LIST SCREEN ==================== */}
      {viewMode === 'list' && (() => {
        const allStatusOptions = isAccounts ? [
          'All',
          'Awaiting Accounts Verification',
          'Payment Processed / Credit Verified',
          'Draft / Pending MD Approval',
          'REJECTED'
        ] : [
          'All',
          'Draft',
          'Draft / Pending Approval',
          'MD Approved',
          'Payment Processed',
          'Proceed PO',
          'OPEN / PARTIALLY RECEIVED',
          'CLOSED / FULLY RECEIVED',
          'REJECTED'
        ];

        const filteredPOList = poList.filter(po => {
          if (!po) return false;
          const pNo = String(po.poNo || po.id || '');
          const pVend = String(po.vendor || po.companyName || '');
          const matchesSearch = pNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
            pVend.toLowerCase().includes(searchQuery.toLowerCase());

          const statusStr = String(po.status || '');
          const currentStage = getPoStage(po);

          const matchesStatus = statusFilter === 'All' ||
            (statusFilter === 'Awaiting Accounts Verification' && currentStage === 'MD_APPROVED') ||
            (statusFilter === 'Payment Processed / Credit Verified' && currentStage === 'PAYMENT_PROCESSED') ||
            (statusFilter === 'Proceed PO (GRN Ready)' && currentStage === 'PROCEED_PO') ||
            (statusFilter === 'Draft / Pending MD Approval' && currentStage === 'Draft') ||
            (statusFilter === 'Draft' && currentStage === 'Draft') ||
            (statusFilter === 'Draft / Pending Approval' && currentStage === 'Draft') ||
            (statusFilter === 'MD Approved' && currentStage === 'MD_APPROVED') ||
            (statusFilter === 'Payment Processed' && currentStage === 'PAYMENT_PROCESSED') ||
            (statusFilter === 'Proceed PO' && currentStage === 'PROCEED_PO') ||
            (statusFilter === 'OPEN' && (statusStr === 'OPEN' || currentStage === 'MD_APPROVED' || currentStage === 'Draft')) ||
            (statusFilter === 'OPEN / PARTIALLY RECEIVED' && currentStage === 'PARTIALLY_RECEIVED') ||
            (statusFilter === 'CLOSED / FULLY RECEIVED' && currentStage === 'CLOSED') ||
            (statusFilter === 'REJECTED' && currentStage === 'REJECTED') ||
            statusStr === statusFilter;

          const matchesTab = poTab === 'All' || currentStage === poTab;

          let matchesDate = true;
          if (filterDate) {
            if (po.poDate) {
              const pD = new Date(po.poDate);
              const fD = new Date(filterDate);
              if (!isNaN(pD.getTime()) && !isNaN(fD.getTime())) {
                const pStr = pD.toISOString().split('T')[0];
                const fStr = fD.toISOString().split('T')[0];
                if (pStr !== fStr && !String(po.poDate).includes(filterDate)) {
                  matchesDate = false;
                }
              } else if (!String(po.poDate).includes(filterDate)) {
                matchesDate = false;
              }
            } else {
              matchesDate = false;
            }
          }

          return matchesSearch && matchesStatus && matchesTab && matchesDate;
        });

        const sortedPOList = [...filteredPOList].sort((a, b) => {
          const parseNum = (item) => {
            const str = String(item.poNo || item.id || '');
            const match = str.match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
          };
          return parseNum(b) - parseNum(a);
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
                <button
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  title="Refresh Purchase Orders from Zoho Books"
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

                {!isExecutiveOrMD && (
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
                <input
                  type="text"
                  placeholder="Search Purchase Orders (PO No, Company Name)..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
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
                    onChange={(e) => { setFilterDate(e.target.value); setCurrentPage(1); }}
                    style={{ border: 'none', outline: 'none', fontSize: '12px', color: '#334155', backgroundColor: 'transparent' }}
                  />
                </div>

                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '12px', backgroundColor: 'white', color: '#334155', outline: 'none' }}>
                  {allStatusOptions.map(s => (
                    <option key={s} value={s}>
                      {s === 'All' ? 'Status: All' : s}
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

            {/* 2. STATUS TABS ROW */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '20px', padding: '4px 0', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
              {(isExecutiveOrMD ? [
                { id: 'Draft', label: 'Pending MD Approval', count: poList.filter(po => getPoStage(po) === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'MD_APPROVED', label: 'Approved by MD', count: poList.filter(po => getPoStage(po) === 'MD_APPROVED').length, bg: '#e0e7ff', fg: '#3730a3' },
                { id: 'All', label: 'All Purchase Orders', count: poList.length, bg: '#e2e8f0', fg: '#475569' }
              ] : isAccounts ? [
                { id: 'MD_APPROVED', label: 'Awaiting Accounts Verification', count: poList.filter(po => getPoStage(po) === 'MD_APPROVED').length, bg: '#e0e7ff', fg: '#3730a3' },
                { id: 'PAYMENT_PROCESSED', label: 'Payment Processed / Credit Verified', count: poList.filter(po => getPoStage(po) === 'PAYMENT_PROCESSED').length, bg: '#fef3c7', fg: '#92400e' },
                { id: 'Draft', label: 'Pending MD Approval', count: poList.filter(po => getPoStage(po) === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'All', label: 'All Orders', count: poList.length, bg: '#e2e8f0', fg: '#475569' }
              ] : [
                { id: 'All', label: 'All Orders', count: poList.length, bg: '#e2e8f0', fg: '#475569' },
                { id: 'Draft', label: 'Draft / Pending Approval', count: poList.filter(po => getPoStage(po) === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
                { id: 'MD_APPROVED', label: 'MD Approved', count: poList.filter(po => getPoStage(po) === 'MD_APPROVED').length, bg: '#e0e7ff', fg: '#3730a3' },
                { id: 'PAYMENT_PROCESSED', label: 'Payment Processed / Credit Verified', count: poList.filter(po => getPoStage(po) === 'PAYMENT_PROCESSED').length, bg: '#fef3c7', fg: '#92400e' },
                { id: 'PROCEED_PO', label: 'Proceed PO (GRN Ready)', count: poList.filter(po => getPoStage(po) === 'PROCEED_PO').length, bg: '#ecfeff', fg: '#0e7490' },
                { id: 'PARTIALLY_RECEIVED', label: 'Open / Partially Received', count: poList.filter(po => getPoStage(po) === 'PARTIALLY_RECEIVED').length, bg: '#fef3c7', fg: '#b45309' },
                { id: 'CLOSED', label: 'Closed / Fully Received', count: poList.filter(po => getPoStage(po) === 'CLOSED').length, bg: '#dcfce7', fg: '#15803d' },
                { id: 'REJECTED', label: 'Rejected', count: poList.filter(po => getPoStage(po) === 'REJECTED').length, bg: '#fee2e2', fg: '#dc2626' }
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

            {/* PO Table */}
            <div className="section-card" style={{ padding: 0, overflowX: 'auto', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px' }}>
              <div className="table-responsive" style={{ border: 'none', borderRadius: '16px', margin: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
                <table className="custom-table" style={{ fontSize: '13px', width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#475569', height: '48px' }}>
                      <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', textAlign: 'center', padding: '12px 0', boxSizing: 'border-box' }}>
                        <input
                          type="checkbox"
                          onChange={(e) => handleSelectAll(e, filteredPOList)}
                          checked={filteredPOList.length > 0 && filteredPOList.every(po => selectedPOs.includes(po.poNo))}
                          style={{ cursor: 'pointer', borderRadius: '4px', accentColor: '#0E7490' }}
                        />
                      </th>
                      <th style={{ width: '16%', minWidth: '130px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>PO No.</th>
                      <th style={{ width: '28%', minWidth: '200px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Company Name</th>
                      <th style={{ width: '14%', minWidth: '120px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>PO Date</th>
                      <th style={{ width: '16%', minWidth: '140px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Expected Delivery</th>
                      <th style={{ width: '14%', minWidth: '130px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'right', boxSizing: 'border-box' }}>Total Value</th>
                      <th style={{ width: '12%', minWidth: '130px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'center', boxSizing: 'border-box' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableLoading ? (
                      Array.from({ length: 6 }).map((_, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ textAlign: 'center', padding: '12px 0', width: '48px' }}>
                            <input type="checkbox" defaultChecked={false} disabled />
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
                              <input
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
                {/* 4. PAGINATION FOOTER */}
                {filteredPOList.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', fontSize: '13px', color: '#64748b', borderTop: '1px solid #f1f5f9' }}>
                    <div>
                      Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredPOList.length)} of {filteredPOList.length} entries
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Rows per page:</span>
                        <select
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
            </div>

            {/* Floating Selection Toolbar (exact reference design) */}
            {selectedPOs.length > 0 && (
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
                          onClick={() => handleOpenPaymentProcessModal(target)}
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
                  const isPaymentProcessed = st === 'Payment Processed' || stt === 'payment_processed' || rowStage === 'PAYMENT_PROCESSED' || Boolean(target.paymentDetails);
                  const isProceedPo = st === 'Proceed PO' || st === 'PROCEED PO' || stt === 'proceed_po' || rowStage === 'PROCEED_PO' || Boolean(target.proceedDetails);
                  const isAlreadyApproved = isPaymentProcessed || isProceedPo || st === 'MD Approved' || stt === 'md_approved' || rowStage === 'MD_APPROVED' || st.includes('CLOSED') || st.includes('PARTIALLY');
                  const isDraftOrPending = !isAlreadyApproved && (st === 'Draft' || st.includes('Pending') || st.includes('WAITING') || st === 'Draft / Pending Approval' || st === 'OPEN');

                  // A) If CEO/MD and still Draft -> Show "Approve as MD"
                  if (canApproveAsMD && isDraftOrPending) {
                    return (
                      <button
                        onClick={() => setApprovingPo(target)}
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
                        <CheckCircle size={14} style={{ color: '#16A34A' }} /> Approve as MD
                      </button>
                    );
                  }

                  // B) If Payment Processed -> Show "Proceed PO (Ready for GRN)"
                  if (isPaymentProcessed) {
                    return (
                      <button
                        onClick={() => {
                          setProceedEmailInput(target.email || email || (target.vendor ? `contact@${target.vendor.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : ''));
                          setProceedingPo(target);
                        }}
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
                        onClick={() => handlePushToGrn(target)}
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

                {/* 4. Delete: For Procurement/Admin (not MD, not Accounts) */}
                {!isExecutiveOrMD && !isAccounts && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete ${selectedPOs.length} selected PO(s)?`)) {
                        setSelectedPOs([]);
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
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                  >
                    <Trash2 size={14} style={{ color: '#DC2626' }} /> Delete
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
                  <FileText size={14} style={{ color: '#059669' }} /> Export / Print PDF
                </button>

                {/* 7. Export to Tally */}
                {(isAccounts || isAdminOrTech) && (
                  <button
                    onClick={() => setShowTallyModal(true)}
                    style={{
                      backgroundColor: '#FEF3C7',
                      border: '1px solid #FDE68A',
                      color: '#92400E',
                      borderRadius: '10px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px rgba(217,119,6,0.1)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FDE68A'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FEF3C7'}
                    title="Export selected Purchase Orders to TallyPrime / Tally.ERP 9"
                  >
                    <FileCode size={14} style={{ color: '#D97706' }} /> Export to Tally
                  </button>
                )}

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
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
              <span style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                {viewMode === 'view' ? `Details of purchase order ${poNumber}.` : 'Fill in the details below to create a new purchase order.'}
              </span>
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
                          onClick={() => {
                            setProceedEmailInput(currentPoObj?.email || email || (currentPoObj?.vendor ? `contact@${currentPoObj.vendor.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : ''));
                            setProceedingPo(currentPoObj);
                          }}
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
                            <CheckCircle size={14} style={{ color: '#16A34A' }} /> MD Approved
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
                              <CheckCircle style={{ width: '15px', height: '15px' }} /> Approve as MD
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
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    style={{ backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    style={{ backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                  >
                    Generate PDF
                  </button>
                  <button
                    type="button"
                    onClick={(e) => executeCreatePO(e, 'Draft')}
                    disabled={isSubmittingPO}
                    style={{ backgroundColor: '#fff7ed', border: '1px solid #fdba74', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '600', color: '#c2410c', cursor: isSubmittingPO ? 'not-allowed' : 'pointer', opacity: isSubmittingPO ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <FileText style={{ width: '15px', height: '15px' }} />
                    {isSubmittingPO ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button
                    type="button"
                    onClick={triggerSaveConfirm}
                    disabled={isSubmittingPO}
                    style={{ backgroundColor: '#2563eb', border: 'none', borderRadius: '8px', padding: '8px 24px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: isSubmittingPO ? 'not-allowed' : 'pointer', opacity: isSubmittingPO ? 0.6 : 1 }}
                  >
                    {isSubmittingPO ? 'Processing...' : 'Send for Approval'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Form Content Cards */}

          {/* Skeleton loader — shown while Zoho PO detail is fetching */}
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
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <span style={{ fontSize: '13px', color: '#1D4ED8', fontWeight: '600' }}>Loading PO details from Zoho Books…</span>
              </div>
            </div>
          )}

          {viewMode === 'view' && !poDetailLoading ? (
            /* ==================== PREMIUM READ-ONLY PO DOCUMENT LAYOUT ==================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

              {/* Visual PO Workflow History Timeline */}
              <div className="section-card" style={{ padding: '20px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
              <div className="section-card" style={{ padding: '30px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative', borderTop: '4px solid #0E7490', backgroundColor: '#FFFFFF', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#1E293B', margin: 0, letterSpacing: '-0.5px' }}>ARMS AI PVT LTD</h1>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '4px' }}>No.684, Podalakur Road, Nellore - 524002, Nellore</span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>GSTIN: 37AAACT2727Q1ZS | contact@armsai.com</span>
                  </div>
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
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', fontWeight: '400', lineHeight: '1.3' }}>
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

                      {pd.paymentImage && (
                        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>Payment Proof Attachment:</span>
                          <a
                            href={pd.paymentImage}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: '#FFFFFF',
                              border: '1px solid #CBD5E1',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#0E7490',
                              textDecoration: 'none'
                            }}
                          >
                            <Image size={13} /> View Attached Payment Proof
                          </a>
                        </div>
                      )}
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
                    <div style={{
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
                          onClick={() => window.print()}
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
                                  onClick={() => {
                                    setProceedEmailInput(currentPoObj?.email || email || (currentPoObj?.vendor ? `contact@${currentPoObj.vendor.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : ''));
                                    setProceedingPo(currentPoObj);
                                  }}
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
          ) : (
            /* ==================== CREATOR & EDITOR ACTIVE FIELDS LAYOUT ==================== */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* 1. Vendor Information */}
              <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <strong style={{ fontSize: '14px', color: '#2563eb', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>1. Vendor Information</strong>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Company Name <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <select
                      value={vendorName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVendorName(val);
                        const found = zohoVendors.find(v => v.name === val);
                        if (found) {
                          setContactPerson(found.contact || '');
                          setContactNo(found.phone || found.mobile || '');
                          setEmail(found.email || '');
                          setGstNo(found.gstin || found.gstNo || '33ABCDE1234F1Z5');
                          const vAddr = found.billingAddress || found.address || found.registeredAddress || `${val}, Main Road, Industrial Estate, Tamil Nadu - 600028`;
                          setBillingAddress(vAddr);
                        }
                      }}
                      required
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155', width: '100%', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="" disabled>Select Zoho Vendor...</option>
                      {zohoVendors.map((v, idx) => (
                        <option key={idx} value={v.name}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Branch</label>
                    <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Vendor Name</label>
                    <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Contact Number</label>
                    <input type="text" value={contactNo} onChange={(e) => setContactNo(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Email ID</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>GST Number</label>
                    <input type="text" value={gstNo} onChange={(e) => setGstNo(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', textTransform: 'uppercase' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Delivery To:</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: '500', color: '#475569', fontSize: '12px' }}>
                    <input type="radio" name="deliveryType" value="Organization" checked={deliveryType === 'Organization'} onChange={() => setDeliveryType('Organization')} /> Organization
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: '500', color: '#475569', fontSize: '12px' }}>
                    <input type="radio" name="deliveryType" value="Customer" checked={deliveryType === 'Customer'} onChange={() => setDeliveryType('Customer')} /> Customer
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Delivery Address <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <textarea
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      rows="3"
                      required
                      placeholder="Enter destination delivery address..."
                      style={{ borderRadius: '8px', border: '1px solid #cbd5e1', padding: '10px 12px', fontSize: '13px', fontFamily: 'inherit', resize: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Billing Address</label>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>Auto-populated from Vendor</span>
                    </div>
                    <textarea
                      value={billingAddress}
                      readOnly
                      rows="3"
                      placeholder="Select vendor to auto-populate billing address..."
                      style={{ borderRadius: '8px', border: '1px solid #cbd5e1', padding: '10px 12px', fontSize: '13px', fontFamily: 'inherit', resize: 'none', backgroundColor: '#f8fafc', color: '#334155', fontWeight: '500' }}
                    />
                  </div>
                </div>

              </div>

              {/* 2. Purchase Order Information */}
              <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <strong style={{ fontSize: '14px', color: '#2563eb', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>2. Purchase Order Information</strong>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>PO Number</label>
                    <input type="text" value={poNumber} disabled style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: '#f8fafc', color: '#64748b' }} />
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>(Auto Generated)</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      PO Date <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} required style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Expected Delivery Date <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <input type="date" min={new Date().toISOString().split('T')[0]} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} required style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Payment Terms <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white' }}>
                      <option value="" disabled>Select Payment Terms</option>
                      <option value="Net 30 Days">Net 30 Days</option>
                      <option value="Net 45 Days">Net 45 Days</option>
                      <option value="Net 60 Days">Net 60 Days</option>
                      <option value="Immediate">Immediate</option>
                      <option value="100% Advance">100% Advance</option>
                      <option value="50% Advance, 50% on Delivery">50% Advance, 50% on Delivery</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      PO Issued By <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={purchaser || loggedInUserName}
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: '#F8FAFC', color: '#334155', fontWeight: '600' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Shipment Preference <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <select value={shipmentPref} onChange={(e) => setShipmentPref(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155' }}>
                      <option value="" disabled>Select Shipment Preference</option>
                      <option value="Transport">Transport</option>
                      <option value="Dedicated Vehicle">Dedicated Vehicle</option>
                      <option value="Own Vehicle">Own Vehicle</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: shipmentPref === 'Transport' ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Scope <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155' }}>
                      <option value="Vendor Scope">Vendor Scope</option>
                      <option value="VRM Structure Scope">VRM Structure Scope</option>
                    </select>
                  </div>

                  {shipmentPref === 'Transport' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                        Transport Name / Carrier <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={transportName}
                        onChange={(e) => setTransportName(e.target.value)}
                        placeholder="e.g. A2B transport, Blackbird..."
                        style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155' }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Currency <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="INR - Indian Rupee"
                      style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: '#F8FAFC', color: '#334155', fontWeight: '600' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Priority <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155' }}>
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                </div>

              </div>

              {/* 3. Items Table */}
              <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 0' }}>
                <strong style={{ fontSize: '14px', color: '#2563eb', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', margin: '0 20px' }}>3. Line Items</strong>

                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left' }}>Item & Description *</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', width: '150px' }}>Account</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '80px' }}>Qty *</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '80px' }}>Unit</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', width: '110px' }}>Rate (₹) *</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '90px' }}>GST (%)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', width: '110px' }}>Amount (₹)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', width: '50px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => {
                        const total = (item.qty || 0) * (item.rate || 0);
                        const taxAmt = total * ((item.tax || 0) / 100);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <input
                                  type="text"
                                  list={`po-item-datalist-${idx}`}
                                  value={item.name || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const found = zohoItems.find(zi => zi.name.toLowerCase() === val.toLowerCase());
                                    handleItemChange(idx, 'name', val);
                                    if (found) {
                                      handleItemChange(idx, 'rate', found.rate || 0);
                                      handleItemChange(idx, 'unit', (found.unit || 'NOS').toUpperCase());
                                      if (found.description && !item.description) {
                                        handleItemChange(idx, 'description', found.description);
                                      }
                                    }
                                  }}
                                  placeholder="Type or select Item Name..."
                                  required
                                  style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', backgroundColor: 'white', color: '#334155', outline: 'none' }}
                                />
                                <datalist id={`po-item-datalist-${idx}`}>
                                  {zohoItems.map((zi, zidx) => (
                                    <option key={zidx} value={zi.name}>{zi.sku ? `[${zi.sku}] ${zi.name}` : zi.name}</option>
                                  ))}
                                </datalist>
                                <input
                                  type="text"
                                  value={item.description || ''}
                                  onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                  placeholder="Enter item description / specifications..."
                                  style={{ width: '100%', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '11px', backgroundColor: '#f8fafc', color: '#334155', outline: 'none' }}
                                />
                              </div>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <select value={item.account} onChange={(e) => handleItemChange(idx, 'account', e.target.value)} style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 6px', fontSize: '12px' }}>
                                <option value="Raw Materials">Raw Materials</option>
                                <option value="Finished Goods">Finished Goods</option>
                              </select>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input type="number" value={item.qty} onChange={(e) => handleItemChange(idx, 'qty', e.target.value === '' ? '' : Number(e.target.value))} required style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 4px', fontSize: '12px', textAlign: 'center' }} />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <select value={item.unit} onChange={(e) => handleItemChange(idx, 'unit', e.target.value)} style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 4px', fontSize: '12px' }}>
                                {item.unit && !['MT', 'NOS', 'KG', 'PCS', 'MTR'].includes(item.unit) && (
                                  <option value={item.unit}>{item.unit}</option>
                                )}
                                <option>MT</option>
                                <option>NOS</option>
                                <option>KG</option>
                                <option>PCS</option>
                                <option>MTR</option>
                              </select>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input type="number" value={item.rate} onChange={(e) => handleItemChange(idx, 'rate', e.target.value === '' ? '' : Number(e.target.value))} required style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', textAlign: 'right' }} />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <select
                                value={item.tax !== undefined && item.tax !== '' ? Number(item.tax) : 18}
                                onChange={(e) => handleItemChange(idx, 'tax', Number(e.target.value))}
                                style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 4px', fontSize: '12px' }}
                              >
                                <option value={18}>18%</option>
                                <option value={16}>16%</option>
                                <option value={12}>12%</option>
                                <option value={5}>5%</option>
                                <option value={0}>0%</option>
                              </select>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: '#1e293b' }}>
                              ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <button type="button" onClick={() => handleRemoveItem(idx)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                                <Trash2 style={{ width: '14px', height: '14px' }} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ margin: '0 20px' }}>
                  <button type="button" onClick={handleAddItem} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'transparent', color: '#2563eb', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                    <Plus style={{ width: '14px', height: '14px' }} /> Add Line Item
                  </button>
                </div>

              </div>

              {/* 4. Calculations Summary & Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>

                {/* Notes & Terms */}
                <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <strong style={{ fontSize: '14px', color: '#2563eb', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>Notes & Terms</strong>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Notes & Remarks</label>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows="3" placeholder="Add remarks for internal reference..." style={{ borderRadius: '8px', border: '1px solid #cbd5e1', padding: '10px 12px', fontSize: '13px', fontFamily: 'inherit', resize: 'none' }} />
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

                    <textarea
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      rows="6"
                      placeholder="Select a preset above or type custom Terms & Conditions..."
                      style={{ borderRadius: '8px', border: '1px solid #cbd5e1', padding: '10px 12px', fontSize: '12px', fontFamily: 'inherit', resize: 'vertical', minHeight: '130px', backgroundColor: '#FFFFFF' }}
                    />
                  </div>
                </div>

                {/* Calculations Summary */}
                <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#f8fafc' }}>
                  <strong style={{ fontSize: '14px', color: '#2563eb', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>Summary Details</strong>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>Subtotal</span>
                    <strong style={{ color: '#334155' }}>₹ {items.reduce((acc, curr) => acc + ((curr.qty || 0) * (curr.rate || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>Discount (%)</span>
                    <input type="number" value={discountPct} onChange={(e) => setDiscountPct(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '60px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', textAlign: 'right', fontSize: '12px' }} />
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
                    <input type="number" value={shippingCharges} onChange={(e) => setShippingCharges(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', textAlign: 'right', fontSize: '12px' }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#64748b' }}>Other Charges (₹)</span>
                    <input type="number" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', textAlign: 'right', fontSize: '12px' }} />
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

      {/* CEO REJECTION MODAL */}
      {rejectingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '450px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#dc2626', color: 'white', fontSize: '12px', fontWeight: '800', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.15em' }}>
              REJECT PURCHASE ORDER
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Reject PO {rejectingPo.poNo}?</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Vendor: <strong>{rejectingPo.vendor}</strong> | Amount: <strong>{rejectingPo.amount}</strong></span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#dc2626' }}>Rejection Reason (Mandatory) *</label>
                <textarea
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

      {/* MD APPROVAL MODAL */}
      {approvingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '460px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#16a34a', color: 'white', fontSize: '12px', fontWeight: '800', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.15em' }}>
              MD APPROVAL
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Approve PO {approvingPo.poNo}?</h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Vendor: <strong>{approvingPo.vendor}</strong> | Amount: <strong>{approvingPo.amount}</strong></span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Approval Remarks / MD Notes</label>
                <textarea
                  value={approvalRemarksInput}
                  onChange={(e) => setApprovalRemarksInput(e.target.value)}
                  placeholder="Enter MD remarks or instructions for Accounts..."
                  style={{ height: '60px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 12px', fontSize: '12px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button onClick={() => { setApprovingPo(null); setApprovalRemarksInput(''); }} style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => handleApprovePoSubmit(approvingPo)} style={{ backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Approve as MD</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT PROCESS & CREDIT VERIFICATION MODAL */}
      {paymentProcessingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#D97706', color: 'white', fontSize: '12px', fontWeight: '800', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.15em' }}>
              ACCOUNTS TEAM - PAYMENT & CREDIT PROCESS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Process Payment / Verify Credit</h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>PO Ref: <strong>{paymentProcessingPo.poNo}</strong> | Vendor: <strong>{paymentProcessingPo.vendor}</strong></span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B', backgroundColor: '#FEF3C7', padding: '4px 10px', borderRadius: '8px' }}>
                  {paymentProcessingPo.amount}
                </span>
              </div>

              {/* Mode Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Payment / Settlement Mode <span style={{ color: '#EF4444' }}>*</span></label>
                <select
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
                    This PO will be marked as Credit Verified by Accounts. MD has approved the PO, and once Accounts confirms the credit terms, you can Proceed PO for GRN (No payment receipt upload required for credit terms).
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#854D0E' }}>Agreed Credit Terms / Days</label>
                    <input
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
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>
                      Transaction / UTR Reference No.
                    </label>
                    <input
                      type="text"
                      value={payRefInput}
                      onChange={(e) => setPayRefInput(e.target.value)}
                      placeholder="e.g. UTR12345678"
                      style={{ height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Amount Recorded (₹)</label>
                    <input
                      type="text"
                      value={payAmountInput}
                      onChange={(e) => setPayAmountInput(e.target.value)}
                      placeholder="Amount"
                      style={{ height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12px' }}
                    />
                  </div>
                </div>
              )}

              {/* Mandatory Payment Proof Image Attachment - ONLY for Non-Credit payment modes */}
              {payModeInput !== 'Credit / Net Terms' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Payment Proof Image <span style={{ color: '#EF4444', fontWeight: 'bold' }}>* (Mandatory)</span>
                    </label>
                    {payImageMeta && (
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                        ✓ {payImageMeta.name} ({payImageMeta.size})
                      </span>
                    )}
                  </div>

                  {!payImageInput ? (
                    <label style={{
                      border: '2px dashed #CBD5E1',
                      borderRadius: '10px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      backgroundColor: '#F8FAFC',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0E7490'; e.currentTarget.style.backgroundColor = '#F0FDFA'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                    >
                      <UploadCloud size={24} style={{ color: '#0E7490' }} />
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#0E7490' }}>
                        Click to upload Payment Screenshot / Receipt <span style={{ color: '#EF4444' }}>*</span>
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>
                        PNG, JPG, JPEG or WEBP (Max 5MB - Auto-compressed)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePaymentImageUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      backgroundColor: '#F0FDF4',
                      border: '1px solid #BBF7D0',
                      borderRadius: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={payImageInput}
                          alt="Payment Proof"
                          style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #86EFAC' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#166534' }}>{payImageMeta?.name || 'Payment_Proof.jpg'}</span>
                          <span style={{ fontSize: '11px', color: '#15803D' }}>{payImageMeta?.size || 'Image attached'} • Ready to verify</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPayImageInput(null);
                          setPayImageMeta(null);
                        }}
                        style={{
                          background: '#FEE2E2',
                          border: '1px solid #FECACA',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          color: '#DC2626',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <X size={12} /> Remove
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Accounts Verification Notes (Optional)</label>
                <textarea
                  value={payRemarksInput}
                  onChange={(e) => setPayRemarksInput(e.target.value)}
                  placeholder="Enter remarks or voucher details..."
                  style={{ height: '50px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '12px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={() => setPaymentProcessingPo(null)}
                  style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
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

      {/* PROCEED PO CONFIRMATION MODAL */}
      {proceedingPo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', width: '500px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: '#0E7490', color: 'white', fontSize: '12px', fontWeight: '800', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: '0.15em' }}>
              AUTHORIZE PROCEED PO (PROCUREMENT HEAD)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Authorize Proceed PO for {proceedingPo.poNo}?</h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>Vendor: <strong>{proceedingPo.vendor}</strong> | Amount: <strong>{proceedingPo.amount}</strong></span>
              </div>

              {/* Automated Vendor Dispatch & Checklist Card */}
              <div style={{ backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle size={18} style={{ color: '#0E7490', flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '12px', color: '#155E75', lineHeight: '1.4' }}>
                  <strong>Procurement Head Final Authorization:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '11px' }}>
                    <li>MD Approval has been granted and Accounts has verified payment/credit.</li>
                    <li><strong>Automatic Vendor Dispatch:</strong> The purchase order details will be automatically sent to the vendor upon authorization.</li>
                    <li>This PO will immediately become available in the <strong>GRN Process</strong> for warehouse receiving.</li>
                  </ul>
                </div>
              </div>

              {/* Vendor Email Recipient Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Mail size={13} style={{ color: '#0E7490' }} /> Vendor Recipient Email (Auto Dispatched on Authorization)
                </label>
                <input
                  type="email"
                  value={proceedEmailInput}
                  onChange={(e) => setProceedEmailInput(e.target.value)}
                  placeholder="vendor@company.com"
                  style={{ height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12px', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                />
                <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                  The PO schedule and line item specifications will be automatically delivered to this address.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569' }}>Proceed Authorization Remarks (Optional)</label>
                <textarea
                  value={proceedRemarksInput}
                  onChange={(e) => setProceedRemarksInput(e.target.value)}
                  placeholder="Enter dispatch notes, delivery gate instructions, etc..."
                  style={{ height: '50px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '8px 10px', fontSize: '12px', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '6px' }}>
                <button
                  onClick={() => { setProceedingPo(null); setProceedRemarksInput(''); setProceedEmailInput(''); }}
                  style={{ border: 'none', backgroundColor: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleProceedPoSubmit(proceedingPo)}
                  style={{ backgroundColor: '#0E7490', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)' }}
                >
                  <Send size={14} /> Authorize & Send PO to Vendor
                </button>
              </div>
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
              PO <strong>{creditAlertPopup.poNo}</strong> ({creditAlertPopup.vendor}) is confirmed under <strong>{creditAlertPopup.terms}</strong>. MD approval was verified, and accounts team has authorized credit terms.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              {isProcurementHead ? (
                <button
                  onClick={() => {
                    const targetPo = poList.find(p => p.poNo === creditAlertPopup.poNo) || { poNo: creditAlertPopup.poNo, vendor: creditAlertPopup.vendor, amount: creditAlertPopup.amount };
                    setCreditAlertPopup(null);
                    setProceedEmailInput(targetPo.email || email || (targetPo.vendor ? `contact@${targetPo.vendor.toLowerCase().replace(/[^a-z0-9]/g, '')}.com` : ''));
                    setProceedingPo(targetPo);
                  }}
                  style={{ backgroundColor: '#0E7490', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  Proceed PO Now <ArrowRight size={12} />
                </button>
              ) : (
                <button
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

      {/* ─── CUSTOM TOAST NOTIFICATION POPUP (MATCHES DESIGN SYSTEM) ─── */}
      {customAlert && (
        <NotificationToast
          alert={customAlert}
          onClose={() => setCustomAlert(null)}
        />
      )}

      {/* TallyPrime Integration Modal */}
      {showTallyModal && (
        <TallySyncModal
          isOpen={showTallyModal}
          onClose={() => setShowTallyModal(false)}
          records={(selectedPOs || []).map(poCode => {
            return (poList || []).find(p => p.poNumber === poCode || p.poNo === poCode || p.code === poCode || p.id === poCode);
          }).filter(Boolean)}
          type="Purchase Order"
          showAlert={showCustomToast}
        />
      )}
    </div>
  );
}
