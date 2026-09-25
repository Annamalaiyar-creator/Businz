import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText, Plus, Search, Eye, Share2, MessageSquare, Download, Check,
  Building2, Printer, X, DollarSign, Calendar, Tag, ChevronRight,
  RotateCcw, Edit3, Trash2, CheckCircle, Clock, AlertCircle, Layers,
  Truck, ArrowRight, Copy, RefreshCw, Send, Mail, Boxes, User, Landmark,
  AlertTriangle, ShoppingCart, ShieldCheck
} from 'lucide-react';
import { VRM_HDG_PRESETS, getAllActivePresets } from '../../vrmHdgProposalPresets';
import SearchablePresetSelector from '../SearchablePresetSelector';
import TypeableProductSelect from '../TypeableProductSelect';
import NotificationToast from '../NotificationToast';
import { addLiveNotification } from '../Header';
import { getFullProductsCatalogWithStock } from '../../utils/productCatalogService';
import { saveCloudStore, saveCloudStoreImmediate, fetchCloudStore, subscribeToCloudStore } from '../../utils/supabaseDataSync';

const QUOTATION_TERMS_PRESETS = [
  {
    key: 'standard_mms',
    label: 'Standard Solar MMS',
    text: `1. Validity: This quotation is valid for 15 days from the proposal date. Raw material price escalation clause applies thereafter.
2. Payment Terms: 50% advance along with confirmed Purchase Order / PI approval, balance 50% prior to material dispatch from our manufacturing facility.
3. Delivery Timeline: Dispatch within 7 to 10 working days from receipt of advance payment and approved engineering drawings.
4. Taxes & Duties: GST 18% is applicable as per Govt. statutory norms and charged extra.
5. Structural Warranty: 10 Years limited warranty against manufacturing defects for Aluminium 6063 T6 anodized rails & SS304 hardware.
6. Freight & Transit: Freight charges on to-pay basis or as agreed. Transit insurance by consignee. Unloading at site is in customer's scope.`
  },
  {
    key: 'aluminium_rails',
    label: 'Aluminium Rooftop Rails',
    text: `1. Scope: Supply of high-strength Aluminium 6063 T6 anodized rails, end clamps, mid clamps, and SS304 fasteners as per quotation scope.
2. Price Validity: Offer valid for 15 days from quote date.
3. Payment Terms: 50% advance along with PO, 50% against proforma invoice before dispatch.
4. Delivery: Within 5 to 7 days from advance receipt.
5. Quality & Warranty: Anodized coating 15+ microns, 10 Years warranty against structural corrosion.
6. Freight: Ex-works Chennai / freight to-pay basis. Unloading and site storage in buyer's scope.`
  },
  {
    key: 'hdg_ground',
    label: 'HDG Ground Mounting',
    text: `1. Material Specification: Hot Dip Galvanized (HDG) steel structures with minimum 80 microns coating conforming to IS 4759.
2. Validity: 10 days validity due to steel raw material market fluctuations.
3. Payment: 40% advance with order, 50% against readiness of material before dispatch, 10% on delivery.
4. Fabrication & Delivery: 15 to 20 working days based on project schedule and approved structure drawings.
5. Inspection: Factory inspection allowed before dispatch with prior intimation.
6. Freight & Insurance: Transportation arranged to project site on agreed freight terms; transit insurance in buyer's scope.`
  },
  {
    key: 'tin_shed',
    label: 'Tin Shed Industrial Kits',
    text: `1. Solution: Non-penetrative / penetrative tin shed mini rails, EPDM rubber gaskets, self-drilling screws, and clamp accessories.
2. Price Validity: 15 days from date of issue.
3. Payment Terms: 100% advance payment prior to dispatch.
4. Delivery Period: 3 to 5 business days from payment confirmation.
5. Testing & Warranty: Wind speed tested up to 170 km/h, 10 Years performance warranty.
6. Transportation: Dispatch via local transport / courier; freight paid by customer.`
  },
  {
    key: 'credit_30',
    label: '30 Days Credit (Approved EPC)',
    text: `1. Payment Terms: 30 days credit from the date of site delivery and original invoice submission.
2. Quotation Validity: Valid for 30 days from proposal date.
3. Delivery: Guaranteed dispatch within 7 to 10 days of formal PO issuance.
4. Statutory Taxes: GST 18% applicable as extra.
5. Warranty & Replacement: 10 Years manufacturer structural warranty. Any transit damaged goods replaced free of cost within 7 days.
6. Site Unloading: Consignee / client scope.`
  }
];

const QUOTE_SENDING_TEMPLATES = [
  {
    key: 'official_intro',
    title: 'Official Commercial Proposal',
    channel: 'Both',
    subject: 'Commercial Quotation for Solar MMS — {{quoteNumber}} | VRM Structures',
    body: `Dear {{customerName}},

Greetings from VRM Structures India Pvt Ltd.

Thank you for your interest in our precision-engineered solar module mounting structures. We are pleased to present our official commercial proposal #{{quoteNumber}} dated {{quoteDate}} for your project requirement:

• Project / Scope: {{structureType}} ({{capacityKw}} kW)
• Quotation Total: {{formattedTotal}} (inclusive of taxes)
• Validity: {{validityDays}} days from proposal date
• Delivery Timeline: 7–10 working days from PO & advance payment

Attached / enclosed please find the itemized quotation along with our structural drawings and structural warranty certificate. 

Please review and feel free to revert if you require any technical adjustments or revisions. We look forward to partnering with your esteemed organization.

Warm regards,
{{salesRep}}
Sales & Engineering Division
VRM Structures India Pvt Ltd
Phone: +91 98400 12345 | sales@vrmstructures.com`
  },
  {
    key: 'quick_whatsapp',
    title: 'Quick WhatsApp Summary',
    channel: 'WhatsApp',
    subject: 'Quotation {{quoteNumber}} — VRM Structures',
    body: `Hi {{customerName}},

Greetings from VRM Structures.

Please find our commercial quotation *#{{quoteNumber}}* for your *{{structureType}}* requirement:

*Grand Total:* {{formattedTotal}}
*Scope:* {{itemCount}} line items ({{capacityKw}} kW capacity)
*Validity:* {{validityDays}} days
*Lead Time:* 7–10 days from drawing approval & advance

Detailed quotation PDF and drawing sheets are ready for your review. Would you like to schedule a quick 5-minute call today to go over any questions?

Best regards,
*{{salesRep}}* | VRM Structures`
  },
  {
    key: 'revision_update',
    title: 'Quotation Revision Notice',
    channel: 'Both',
    subject: 'Revised Quotation {{quoteNumber}} (Rev #{{revCount}}) — VRM Structures',
    body: `Dear {{customerName}},

Hope you are having a productive week.

As per your latest technical feedback and updated site requirements, we have revised commercial quotation #{{quoteNumber}} (Revision #{{revCount}}).

Key updates made:
• Revised Scope: {{structureType}}
• Revised Total: {{formattedTotal}}
• Payment Terms: {{paymentTerms}}

The updated quotation sheet has been generated for your final clearance. Please let us know if everything is in order to issue the Proforma Invoice (PI) and lock production slots.

Warm regards,
{{salesRep}}
VRM Structures India Pvt Ltd`
  },
  {
    key: 'urgent_approval',
    title: 'Price Validity & Fast-Track Lead',
    channel: 'Both',
    subject: 'Urgent: Quotation {{quoteNumber}} Price Lock Confirmation — VRM Structures',
    body: `Dear {{customerName}},

Regarding quotation #{{quoteNumber}} for {{structureType}} (Amount: {{formattedTotal}}), this is a friendly reminder that raw material price validity is active for this week.

To secure this pricing and ensure our priority manufacturing dispatch within 7 days, kindly confirm your approval so we can release the Proforma Invoice (PI) today.

Thank you for your continued trust in VRM Structures.

Best regards,
{{salesRep}}
VRM Structures India Pvt Ltd`
  }
];

export const is5PctSolarProduct = (name = '', cat = '') => {
  const text = `${name} ${cat}`.toLowerCase();
  return (
    text.includes('inverter') ||
    text.includes('solar panel') ||
    text.includes('solar module') ||
    text.includes('pv module') ||
    text.includes('panel') ||
    text.includes('module') ||
    text.includes('topcon') ||
    text.includes('bifacial') ||
    text.includes('monocrystalline') ||
    text.includes('polycrystalline') ||
    text.includes('dcr') ||
    text.includes('ongrid') ||
    text.includes('offgrid') ||
    text.includes('hybrid inverter') ||
    text.includes('waaree')
  );
};

export default function CrmQuotationsView({
  quotations = [],
  onSaveQuotation,
  onNavigateTab,
  onOpenWhatsAppChat,
  userRole = 'Sales Executive'
}) {
  // Search & Filter states matching BOM page
  const [searchQueryText, setSearchQueryText] = useState('');
  const [filterDateVal, setFilterDateVal] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('All');
  const [selectedRows, setSelectedRows] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Modals & Forms
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [showBOMQuoteForm, setShowBOMQuoteForm] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState(null);
  const [revisionCount, setRevisionCount] = useState(0);

  // Quote Sending Template Modal State
  const [sendQuoteModalData, setSendQuoteModalData] = useState(null);
  const [sendChannel, setSendChannel] = useState('WhatsApp'); // 'WhatsApp' | 'Email'
  const [activeSendTemplateKey, setActiveSendTemplateKey] = useState('quick_whatsapp');
  const [editableEmailSubject, setEditableEmailSubject] = useState('');
  const [editableMessageBody, setEditableMessageBody] = useState('');
  const [recipientContact, setRecipientContact] = useState('');

  // Notification / Conversion toast state
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = 'success', title = 'Quotation Notice') => {
    setToastMessage({ message: msg, type, title });
    addLiveNotification({
      id: 'quote_notif_' + Date.now(),
      title: title || 'Quotation Notice',
      message: msg,
      time: 'Just now',
      type: type,
      role: 'All',
      targetTab: 'Quotations'
    });
  };

  // Preset Selection in Quote Creation
  const [selectedPreset, setSelectedPreset] = useState('');
  const [activePresetsMap, setActivePresetsMap] = useState(() => getAllActivePresets());
  const [presetSetCount, setPresetSetCount] = useState(1);
  const [presetGroups, setPresetGroups] = useState({});
  const [selectedItemIndexes, setSelectedItemIndexes] = useState([]);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [quoteConfirmModal, setQuoteConfirmModal] = useState(null); // 'cancel' | 'draft' | 'create'

  useEffect(() => {
    const handlePresetUpdate = (e) => {
      if (e.detail) setActivePresetsMap(e.detail);
    };
    window.addEventListener('vrm_presets_updated', handlePresetUpdate);
    return () => window.removeEventListener('vrm_presets_updated', handlePresetUpdate);
  }, []);

  // Customer List synced directly from Supabase cloud database
  const [customerList, setCustomerList] = useState(() => [
    { code: 'Vikram Solar Pvt Ltd', companyName: 'Vikram Solar Pvt Ltd', c2: 'Vikram Solar Pvt Ltd', gstNumber: '33AABCU9603R1ZM', gstNo: '33AABCU9603R1ZM', contactPerson: 'Rajesh Kumar', phone: '+91 98765 43210', email: 'rajesh@vikramsolar.com', billingAddress: 'Plot 42, SIDCO Industrial Estate, Ambattur', city: 'Chennai', state: 'Tamil Nadu', pincode: '600058' },
    { code: 'Tata Power Renewable', companyName: 'Tata Power Ltd', c2: 'Tata Power Ltd', gstNumber: '29AAACT2727Q1ZW', gstNo: '29AAACT2727Q1ZW', contactPerson: 'Anish Sharma', phone: '+91 98123 45678', email: 'anish.s@tatapower.com', billingAddress: '12 Electronic City Phase 1', city: 'Bengaluru', state: 'Karnataka', pincode: '560100' },
    { code: 'Apex Infra Systems', companyName: 'Apex Infra Ltd', c2: 'Apex Infra Ltd', gstNumber: '33AABCA1234F1Z5', gstNo: '33AABCA1234F1Z5', contactPerson: 'Priya Sundaram', phone: '+91 99400 11223', email: 'priya@apexinfra.com', billingAddress: '88 Mount Road, Guindy', city: 'Chennai', state: 'Tamil Nadu', pincode: '600032' }
  ]);

  useEffect(() => {
    let active = true;
    fetchCloudStore('customer_store', []).then(list => {
      if (active && Array.isArray(list) && list.length > 0) {
        setCustomerList(list);
      }
    });
    const unsub = subscribeToCloudStore('customer_store', (newList) => {
      if (active && Array.isArray(newList) && newList.length > 0) {
        setCustomerList(newList);
      }
    });
    return () => {
      active = false;
      if (unsub && unsub.unsubscribe) unsub.unsubscribe();
    };
  }, []);

  // Full 285+ Standardized Products Catalog with Live Central Inventory Stock
  const [itemsList, setItemsList] = useState(() => getFullProductsCatalogWithStock());

  useEffect(() => {
    const refreshCatalog = () => {
      setItemsList(getFullProductsCatalogWithStock());
    };
    window.addEventListener('central_inventory_updated', refreshCatalog);
    window.addEventListener('controlroom_storage_update', refreshCatalog);
    window.addEventListener('storage', refreshCatalog);
    return () => {
      window.removeEventListener('central_inventory_updated', refreshCatalog);
      window.removeEventListener('controlroom_storage_update', refreshCatalog);
      window.removeEventListener('storage', refreshCatalog);
    };
  }, []);

  const getItemStock = (itemName, itemCode) => {
    if (!itemName && !itemCode) return null;
    const cleanName = (itemName || '').toLowerCase().trim();
    const cleanCode = (itemCode || '').toLowerCase().trim();
    const found = (itemsList || []).find(p => 
      (cleanCode && (p.code || '').toLowerCase().trim() === cleanCode) ||
      (cleanName && (p.name || '').toLowerCase().trim() === cleanName) ||
      (cleanName && (p.name || '').toLowerCase().includes(cleanName))
    );
    if (!found) return null;
    return Number(found.stock !== undefined ? found.stock : (found.availableStock !== undefined ? found.availableStock : 0));
  };

  // Resolve currently logged in account user's name dynamically (matching Header & auth state)
  const getActiveUserName = () => {
    const stored = localStorage.getItem('controlroom_logged_user_name');
    if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim() !== '') return stored.trim();
    try {
      const u = JSON.parse(localStorage.getItem('controlroom_logged_user') || '{}');
      if (u.name) return u.name;
      if (u.fullName) return u.fullName;
      if (u.username) return u.username;
    } catch (e) {}
    if (userRole === 'Sales Head') return 'Vijay';
    if (userRole === 'CEO' || userRole === 'Technical Administrator') return 'Annamalaiyar';
    return 'Mohit JV';
  };

  // Full BOM-style Quote Form state
  const [quoteCode, setQuoteCode] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntilDate, setValidUntilDate] = useState(new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState(new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]);
  const [salesPerson, setSalesPerson] = useState(getActiveUserName());

  // Customer Info
  const [customerName, setCustomerName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [structureType, setStructureType] = useState('Aluminium Rooftop Rails (6063 T6)');
  const [capacityKw, setCapacityKw] = useState('');

  // Addresses
  const [billingStreet, setBillingStreet] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingPincode, setBillingPincode] = useState('');

  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [deliveryStreet, setDeliveryStreet] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [deliveryPincode, setDeliveryPincode] = useState('');

  // Line items
  const [quoteItems, setQuoteItems] = useState([]);
  const [validationAlert, setValidationAlert] = useState(null);

  // Transport & Logistics
  const [transportMode, setTransportMode] = useState('Transport');
  const [transporterName, setTransporterName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [transportScope, setTransportScope] = useState('VRM Structures');

  // Terms & Conditions Preset & Custom State (Matching PO format)
  const [selectedTermsPreset, setSelectedTermsPreset] = useState('');
  const [terms, setTerms] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');

  // Bank Account Copy helper state
  const [copiedBankField, setCopiedBankField] = useState(null);

  const handleCopyBankDetail = (text, fieldName) => {
    try {
      if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      }
    } catch (_) {}
    setCopiedBankField(fieldName);
    showToast(`${fieldName} copied to clipboard!`);
    setTimeout(() => {
      setCopiedBankField(null);
    }, 2000);
  };

  // Normalizing quotations
  const normalizedQuotes = useMemo(() => {
    if (!Array.isArray(quotations)) return [];
    return quotations.filter(Boolean).map(q => {
      const code = q.quoteNumber || q.id || 'QT-UNKNOWN';
      const date = q.date || (q.createdAt ? q.createdAt.split('T')[0] : '2026-09-04');
      const customer = q.customerName || q.companyName || q.customer || 'Unknown Customer';
      const structure = q.structureType || (q.items && q.items[0]?.name) || (q.items && q.items[0]?.description) || 'Mounting System';
      const rep = (q.salesPerson || q.salesperson || q.salesRep || getActiveUserName()).toString().replace(/\s*\([^)]*\)/g, '').trim();
      const grandTotalVal = Number(q.totalAmount ?? q.grandTotal ?? 0) || 0;
      const status = q.status || 'Draft';
      const revCount = q.revisionCount || 0;

      let stBg = '#eff6ff';
      let stFg = '#1d4ed8';
      let stBorder = '1px solid #bfdbfe';

      if (status === 'Draft') {
        stBg = '#fff7ed';
        stFg = '#c2410c';
        stBorder = '1px solid #fed7aa';
      } else if (status === 'Sent') {
        stBg = '#dcfce7';
        stFg = '#166534';
        stBorder = '1px solid #bbf7d0';
      } else if (status === 'Accepted') {
        stBg = '#ecfdf5';
        stFg = '#059669';
        stBorder = '1px solid #a7f3d0';
      } else if (status === 'Revised') {
        stBg = '#fef3c7';
        stFg = '#b45309';
        stBorder = '1px solid #fde68a';
      } else if (status === 'Converted to PI' || status === 'PI Generated') {
        stBg = '#f0fdfa';
        stFg = '#0e7490';
        stBorder = '1px solid #a5f3fc';
      } else if (status === 'Cancelled' || status === 'Rejected') {
        stBg = '#fef2f2';
        stFg = '#b91c1c';
        stBorder = '1px solid #fca5a5';
      }

      return {
        ...q,
        code,
        date,
        customer,
        structure,
        salesRep: rep,
        numericTotal: grandTotalVal,
        formattedTotal: `₹ ${grandTotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
        status,
        revCount,
        stBg,
        stFg,
        stBorder
      };
    });
  }, [quotations]);

  const currentEmpId = (localStorage.getItem('controlroom_logged_emp_id') || '').trim();
  const currentEmpName = (localStorage.getItem('controlroom_logged_user_name') || '').trim();
  const currentLoggedEmail = (localStorage.getItem('controlroom_logged_user') || '').trim().toLowerCase();
  const isRestrictedSalesUser = userRole === 'Sales Executive';

  const visibleQuotes = useMemo(() => {
    if (!isRestrictedSalesUser) return normalizedQuotes;

    const curCode = currentEmpId.toUpperCase();
    const curName = currentEmpName.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    const curEmail = currentLoggedEmail;

    return normalizedQuotes.filter(q => {
      if (!q) return false;
      const spCode = (q.salesPersonCode || q.createdById || '').trim().toUpperCase();
      if (curCode && spCode && spCode === curCode) return true;

      const spName = (q.salesPerson || q.salesperson || q.salesRep || q.createdBy || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      if (curName && spName) {
        if (spName === curName) return true;
        const cleanSp = spName.replace(/\s+/g, '');
        const cleanCur = curName.replace(/\s+/g, '');
        if (cleanSp === cleanCur || cleanSp.includes(cleanCur) || cleanCur.includes(cleanSp)) return true;
      }

      if (curEmail && (q.salesPersonEmail || q.email || '').toLowerCase() === curEmail) {
        return true;
      }

      return false;
    });
  }, [normalizedQuotes, isRestrictedSalesUser, currentEmpId, currentEmpName, currentLoggedEmail]);

  // Page config
  const pageConfig = useMemo(() => {
    return {
      title: 'Solar Structure Quotations',
      subtitle: 'Commercial proposals, structure scope estimations, and formal client quotations',
      actionText: 'New Quotation',
      searchPlaceholder: 'Search Quotations (Quote #, Customer Name, Structure Scope)...',
      tabs: [
        { id: 'All', label: 'All Quotations', count: visibleQuotes.length, bg: '#e2e8f0', fg: '#475569' },
        { id: 'Draft', label: 'Draft', count: visibleQuotes.filter(q => q.status === 'Draft').length, bg: '#fff7ed', fg: '#c2410c' },
        { id: 'Sent', label: 'Sent', count: visibleQuotes.filter(q => q.status === 'Sent').length, bg: '#dcfce7', fg: '#166534' },
        { id: 'Revised', label: 'Revised', count: visibleQuotes.filter(q => q.status === 'Revised').length, bg: '#fef3c7', fg: '#b45309' },
        { id: 'Converted to PI', label: 'Converted to PI', count: visibleQuotes.filter(q => q.status === 'Converted to PI' || q.status === 'PI Generated').length, bg: '#f0fdfa', fg: '#0e7490' },
        { id: 'Accepted', label: 'Accepted', count: visibleQuotes.filter(q => q.status === 'Accepted').length, bg: '#ecfdf5', fg: '#059669' }
      ]
    };
  }, [visibleQuotes]);

  // Filtering
  const filteredRows = useMemo(() => {
    return visibleQuotes.filter(r => {
      const qText = searchQueryText.toLowerCase().trim();
      const matchesSearch = !qText ||
        (r.code && r.code.toLowerCase().includes(qText)) ||
        (r.customer && r.customer.toLowerCase().includes(qText)) ||
        (r.structure && r.structure.toLowerCase().includes(qText)) ||
        (r.salesRep && r.salesRep.toLowerCase().includes(qText)) ||
        (r.convertedPiNo && r.convertedPiNo.toLowerCase().includes(qText));

      const matchesDate = !filterDateVal || (r.date && r.date.startsWith(filterDateVal));

      const subTab = activeSubTab.toLowerCase();
      const rStatus = (r.status || '').toLowerCase();
      const matchesTab = subTab === 'all' || subTab === 'all quotations' || rStatus === subTab || (subTab === 'converted to pi' && (rStatus === 'converted to pi' || rStatus === 'pi generated'));

      return matchesSearch && matchesDate && matchesTab;
    });
  }, [visibleQuotes, searchQueryText, filterDateVal, activeSubTab]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredRows.slice(indexOfFirstRow, indexOfLastRow);

  // Row selection handler
  const handleSelectRow = (code) => {
    setSelectedRows(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(filteredRows.map(r => r.code));
    } else {
      setSelectedRows([]);
    }
  };

  // Financial calculations with multi-preset group and individual items support
  const calculateTotals = () => {
    // 1. Preset Groups Subtotal
    let kitSubtotal = 0;
    const groupIds = Object.keys(presetGroups || {});
    groupIds.forEach(grpId => {
      const grp = presetGroups[grpId];
      if (grp) {
        const unitPrice = parseFloat(grp.kitPrice) || 0;
        const multiplier = parseInt(grp.setCount) || 1;
        kitSubtotal += (unitPrice * multiplier);
      }
    });

    // 2. Individual items subtotal
    const itemsSub = (quoteItems || []).reduce((acc, item) => {
      if (item.isPresetItem) return acc;
      const q = parseFloat(item.qty) || 0;
      const r = parseFloat(item.rate) || 0;
      return acc + (q * r);
    }, 0);

    const sub = itemsSub + kitSubtotal;

    // 3. GST: Custom item GSTs + Preset kits GST (dynamically from preset's selected gstRate)
    const itemsGst = (quoteItems || []).reduce((acc, item) => {
      if (item.isPresetItem) return acc;
      const q = parseFloat(item.qty) || 0;
      const r = parseFloat(item.rate) || 0;
      const rowTot = q * r;
      const pct = parseFloat(String(item.gstRate || '18%').replace('%', '')) || 18;
      return acc + (rowTot * (pct / 100));
    }, 0);

    let kitGst = 0;
    groupIds.forEach(grpId => {
      const grp = presetGroups[grpId];
      if (grp) {
        const unitPrice = parseFloat(grp.kitPrice) || 0;
        const multiplier = parseInt(grp.setCount) || 1;
        const groupTotal = unitPrice * multiplier;

        const groupItems = (quoteItems || []).filter(it => (it.presetGroupId || 'legacy_default') === grpId);
        const totalQty = groupItems.reduce((sum, it) => sum + (parseFloat(it.qty) || 1), 0);

        if (totalQty > 0) {
          groupItems.forEach(it => {
            const itQty = parseFloat(it.qty) || 1;
            const itemShare = groupTotal * (itQty / totalQty);
            const itGstRate = parseFloat(String(it.gstRate || grp.gstRate || '18%').replace('%', '')) || 0;
            kitGst += itemShare * (itGstRate / 100);
          });
        } else {
          const gRateStr = grp?.gstRate || '18%';
          const gPct = parseFloat(String(gRateStr).replace('%', '')) || 0;
          kitGst += groupTotal * (gPct / 100);
        }
      }
    });

    const gst = itemsGst + kitGst;

    const grand = sub + gst;
    const cgst = gst / 2;
    const sgst = gst / 2;
    return {
      sub: isNaN(sub) ? 0 : sub,
      kitSubtotal: isNaN(kitSubtotal) ? 0 : kitSubtotal,
      gst: isNaN(gst) ? 0 : gst,
      grand: isNaN(grand) ? 0 : grand,
      cgst: isNaN(cgst) ? 0 : cgst,
      sgst: isNaN(sgst) ? 0 : sgst
    };
  };

  const totals = calculateTotals();

  // Helper handlers for Presets and Items
  const handleAddMaterialRow = () => {
    setQuoteItems(prev => [...(prev || []), { name: '', category: '', uom: 'NOS', qty: '1', rate: '', gstRate: '18%' }]);
  };

  const handleAddPresetToOrder = (presetId, targetPreset, setsCount) => {
    if (!targetPreset || !targetPreset.items || targetPreset.items.length === 0) return;
    const groupId = 'preset_grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const multiplier = Math.max(1, parseInt(setsCount) || 1);

    let defaultPrice = '';
    if (targetPreset.price || targetPreset.rate) {
      defaultPrice = String(targetPreset.price || targetPreset.rate);
    } else {
      const origSum = targetPreset.items.reduce((acc, it) => acc + (parseFloat(it.qty || 1) * parseFloat(it.rate || 0)), 0);
      defaultPrice = origSum > 0 ? String(origSum) : '';
    }

    const presetName = targetPreset.label || presetId;
    const initialGstRate = targetPreset.gstRate || targetPreset.gst || '18%';

    setPresetGroups(prev => ({
      ...prev,
      [groupId]: {
        groupId,
        presetId,
        presetName,
        setCount: multiplier,
        kitPrice: defaultPrice,
        gstRate: initialGstRate
      }
    }));

    const newItems = targetPreset.items.map(it => {
      const baseQ = parseFloat(it.qty) || 1;
      return {
        ...it,
        presetGroupId: groupId,
        presetName,
        baseQty: baseQ,
        qty: String(Math.round(baseQ * multiplier)),
        rate: '0',
        gstRate: is5PctSolarProduct(it.name, it.category || it.specs) ? '5%' : (it.gstRate || initialGstRate),
        isPresetItem: true
      };
    });

    setQuoteItems(prev => [...(prev || []), ...newItems]);
    setSelectedPreset('');
    setPresetSetCount(1);
  };

  const handleRemovePresetGroup = (groupId) => {
    setQuoteItems(prev => (prev || []).filter(item => (item.presetGroupId || 'legacy_default') !== groupId));
    setPresetGroups(prev => {
      const updated = { ...prev };
      delete updated[groupId];
      return updated;
    });
  };

  const handleRemoveMaterialRow = (idx) => {
    const itemToRemove = quoteItems[idx];
    setQuoteItems(prev => {
      const updated = (prev || []).filter((_, i) => i !== idx);
      if (itemToRemove && itemToRemove.presetGroupId) {
        const remainingInGroup = updated.filter(it => it.presetGroupId === itemToRemove.presetGroupId);
        if (remainingInGroup.length === 0) {
          setPresetGroups(pgPrev => {
            const c = { ...pgPrev };
            delete c[itemToRemove.presetGroupId];
            return c;
          });
        }
      }
      return updated;
    });
  };

  const handleSelectCustomer = (val) => {
    setCustomerName(val);
    const target = (val || '').toLowerCase().trim();
    if (!target) return;
    const chosen = customerList.find(c => {
      const code = (c.code || '').toLowerCase().trim();
      const c2 = (c.c2 || '').toLowerCase().trim();
      const cName = (c.customerName || c.companyName || '').toLowerCase().trim();
      return code === target || c2 === target || cName === target ||
             (code && code.startsWith(target)) || (c2 && c2.startsWith(target)) ||
             (cName && cName.startsWith(target)) || (cName && cName.includes(target));
    });
    if (chosen) {
      const bObj = chosen.billingAddressObj || {};
      const bAddr = bObj.address || chosen.billingAddress || chosen.c6 || chosen.address || '';
      const bCity = bObj.city || chosen.city || '';
      const bState = bObj.state || chosen.state || '';
      const bPin = bObj.pincode || chosen.pincode || '';

      const dObj = chosen.deliveryAddressObj || {};
      const dAddr = dObj.address || chosen.deliveryAddress || chosen.dispatchAddress || chosen.c7 || '';
      const dCity = dObj.city || chosen.dispatchCity || chosen.deliveryCity || '';
      const dState = dObj.state || chosen.dispatchState || chosen.deliveryState || '';
      const dPin = dObj.pincode || chosen.dispatchPincode || chosen.deliveryPincode || '';

      setContactPerson(chosen.contactPerson || chosen.c3 || contactPerson);
      setPhone(chosen.phone || chosen.c4 || phone);
      setEmail(chosen.email || chosen.c5 || email);
      setGstNumber(chosen.gstNumber || chosen.gstNo || gstNumber);

      setBillingStreet(bAddr);
      setBillingCity(bCity);
      setBillingState(bState);
      setBillingPincode(bPin);

      const clean = (s) => String(s || '').trim().toLowerCase();
      const isSame = !dAddr || (
        clean(dAddr) === clean(bAddr) &&
        clean(dCity) === clean(bCity) &&
        clean(dState) === clean(bState) &&
        clean(dPin) === clean(bPin)
      );

      setSameAsBilling(isSame);
      if (dAddr && !isSame) {
        setDeliveryStreet(dAddr);
        setDeliveryCity(dCity);
        setDeliveryState(dState);
        setDeliveryPincode(dPin);
      } else {
        setDeliveryStreet(bAddr);
        setDeliveryCity(bCity);
        setDeliveryState(bState);
        setDeliveryPincode(bPin);
      }
    }
  };

  // Open Create BOM-style Quote
  const handleOpenCreateForm = () => {
    const nextCode = `QT-2026-${String(10 + quotations.length + 1)}`;
    setQuoteCode(nextCode);
    setQuoteDate(new Date().toISOString().split('T')[0]);
    setValidUntilDate(new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);
    setDeliveryDate(new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]);
    setCustomerName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setGstNumber('');
    setStructureType('Aluminium Rooftop Rails (6063 T6)');
    setCapacityKw('');
    setBillingStreet('');
    setBillingCity('');
    setBillingState('');
    setBillingPincode('');
    setSameAsBilling(true);
    setDeliveryStreet('');
    setDeliveryCity('');
    setDeliveryState('');
    setDeliveryPincode('');
    setSelectedPreset('');
    setPresetSetCount(1);
    setPresetGroups({});
    setSelectedItemIndexes([]);
    setQuoteItems([]);
    setTransportMode('Transport');
    setTransporterName('');
    setVehicleNo('');
    setTransportScope('VRM Structures');
    setPaymentTerms('50% Advance + 50% Before Dispatch');
    setSelectedTermsPreset(QUOTATION_TERMS_PRESETS[0].key);
    setTerms(QUOTATION_TERMS_PRESETS[0].text);
    setSalesPerson(getActiveUserName());
    setEditingQuoteId(null);
    setRevisionCount(0);
    setShowBOMQuoteForm(true);
  };

  // Open Edit / Revise Quote
  const handleStartEditQuote = (quote) => {
    setQuoteCode(quote.quoteNumber || quote.code || quote.id);
    setQuoteDate(quote.date || (quote.createdAt ? quote.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]));
    const todayStr = new Date().toISOString().split('T')[0];
    const initialValidUntil = (quote.validUntil && quote.validUntil >= todayStr)
      ? quote.validUntil
      : new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    setValidUntilDate(initialValidUntil);
    setDeliveryDate(quote.deliveryDate || new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0]);
    setCustomerName(quote.customerName || quote.customer || quote.companyName || '');
    setContactPerson(quote.contactPerson || '');
    setPhone(quote.phone || '');
    setEmail(quote.email || '');
    setGstNumber(quote.gstNumber || quote.gstNo || '');
    setStructureType(quote.structureType || quote.structure || 'Aluminium Rooftop Rails (6063 T6)');
    setCapacityKw(quote.capacityKw || 100);
    setBillingStreet(quote.billingAddress || quote.address || '');
    setBillingCity(quote.city || 'Chennai');
    setBillingState(quote.state || 'Tamil Nadu');
    setBillingPincode(quote.pincode || '600001');
    setSameAsBilling(quote.sameAsBilling !== undefined ? quote.sameAsBilling : true);
    setDeliveryStreet(quote.deliveryAddress || quote.deliveryStreet || '');
    setDeliveryCity(quote.deliveryCity || 'Chennai');
    setDeliveryState(quote.deliveryState || 'Tamil Nadu');
    setDeliveryPincode(quote.deliveryPincode || '600001');
    setTransportMode(quote.transportMode || 'Transport');
    setTransporterName(quote.transporterName || 'VRL Logistics');
    setVehicleNo(quote.vehicleNo || '');
    setTransportScope(quote.transportScope || 'VRM Structures');
    setPaymentTerms(quote.paymentTerms || '50% Advance + 50% Before Dispatch');
    setTerms(quote.terms || quote.notes || QUOTATION_TERMS_PRESETS[0].text);
    setSelectedTermsPreset(quote.termsPresetKey || '');
    setSalesPerson(quote.salesPerson || quote.salesperson || quote.salesRep || getActiveUserName());
    setRevisionCount(Number(quote.revisionCount || quote.revCount || 0));
    setPresetGroups(quote.presetGroups || {});

    if (Array.isArray(quote.items) && quote.items.length > 0) {
      setQuoteItems(quote.items.map(it => ({
        name: it.name || it.description || 'Solar Structure Component',
        category: it.category || 'MMS Parts',
        uom: it.uom || it.unit || 'NOS',
        qty: String(it.qty || 1),
        baseQty: it.baseQty || it.qty || 1,
        rate: String(it.rate || 0),
        gstRate: it.gstRate || '18%',
        isPresetItem: Boolean(it.isPresetItem),
        presetGroupId: it.presetGroupId || '',
        presetName: it.presetName || ''
      })));
    } else {
      setQuoteItems([
        { name: 'Solar Mounting Structure Kit', category: 'Structure', uom: 'SET', qty: '1', rate: '25000', gstRate: '18%' }
      ]);
    }

    setEditingQuoteId(quote.id || quote.quoteNumber || quote.code);
    setShowBOMQuoteForm(true);
    setSelectedQuote(null);
  };

  // Validate required quotation fields
  const validateQuotationForm = () => {
    const missing = [];
    if (!customerName || !customerName.trim()) {
      missing.push({ name: 'Customer / Company Name', targetId: 'quote-field-customerName' });
    }
    if (!phone || !phone.trim()) {
      missing.push({ name: 'Phone / WhatsApp Number', targetId: 'quote-field-phone' });
    }
    if (!billingStreet || !billingStreet.trim()) {
      missing.push({ name: 'Billing Street Address', targetId: 'quote-field-billingStreet' });
    }
    if (!billingCity || !billingCity.trim()) {
      missing.push({ name: 'Billing City', targetId: 'quote-field-billingCity' });
    }
    if (!billingState || !billingState.trim()) {
      missing.push({ name: 'Billing State', targetId: 'quote-field-billingState' });
    }
    if (!billingPincode || !billingPincode.trim()) {
      missing.push({ name: 'Billing Pincode', targetId: 'quote-field-billingPincode' });
    }
    if (!sameAsBilling) {
      if (!deliveryStreet || !deliveryStreet.trim()) {
        missing.push({ name: 'Delivery Street Address', targetId: 'quote-field-deliveryStreet' });
      }
      if (!deliveryCity || !deliveryCity.trim()) {
        missing.push({ name: 'Delivery City', targetId: 'quote-field-deliveryCity' });
      }
      if (!deliveryState || !deliveryState.trim()) {
        missing.push({ name: 'Delivery State', targetId: 'quote-field-deliveryState' });
      }
      if (!deliveryPincode || !deliveryPincode.trim()) {
        missing.push({ name: 'Delivery Pincode', targetId: 'quote-field-deliveryPincode' });
      }
    }
    if (!quoteItems || quoteItems.length === 0) {
      missing.push({ name: 'Quotation Items (Add at least 1 item or preset kit)', targetId: 'quote-field-items' });
    } else {
      const hasValidItem = quoteItems.some(it => (it.name && it.name.trim()) || it.isPresetItem);
      if (!hasValidItem) {
        missing.push({ name: 'Valid Product / Item in Quotation Scope', targetId: 'quote-field-items' });
      }
    }
    const todayStr = new Date().toISOString().split('T')[0];
    if (!validUntilDate || !validUntilDate.trim()) {
      missing.push({ name: 'Valid Until Date', targetId: 'quote-field-validUntil' });
    } else if (validUntilDate < todayStr) {
      missing.push({ name: 'Valid Until Date cannot be in the past or a finished date', targetId: 'quote-field-validUntil' });
    }

    return {
      isValid: missing.length === 0,
      missingList: missing
    };
  };

  // Submit / Save Quotation (with unlimited revision capability)
  const handleSaveQuotationRecord = (saveAsStatus = 'Sent') => {
    const validation = validateQuotationForm();
    if (!validation.isValid) {
      setValidationAlert({
        fields: validation.missingList.map(m => typeof m === 'object' ? (m.name || m.field) : m),
        firstTargetId: validation.missingList[0]?.targetId
      });
      return;
    }

    const calculated = calculateTotals();
    const isEditing = Boolean(editingQuoteId);
    const newRevCount = isEditing ? revisionCount + 1 : 0;
    const finalStatus = isEditing && saveAsStatus !== 'Draft' ? 'Revised' : saveAsStatus;

    const record = {
      id: quoteCode,
      quoteNumber: quoteCode,
      code: quoteCode,
      date: quoteDate,
      validUntil: validUntilDate,
      deliveryDate,
      customerName: customerName.trim(),
      companyName: customerName.trim(),
      contactPerson,
      phone,
      email,
      gstNumber,
      gstNo: gstNumber,
      structureType,
      capacityKw,
      billingAddress: billingStreet,
      city: billingCity,
      state: billingState,
      pincode: billingPincode,
      sameAsBilling,
      deliveryAddress: sameAsBilling ? billingStreet : deliveryStreet,
      deliveryCity: sameAsBilling ? billingCity : deliveryCity,
      deliveryState: sameAsBilling ? billingState : deliveryState,
      deliveryPincode: sameAsBilling ? billingPincode : deliveryPincode,
      items: quoteItems.map(it => ({
        ...it,
        description: it.category || it.name,
        amount: (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0)
      })),
      presetGroups,
      salesperson: salesPerson,
      salesPerson: salesPerson,
      subtotal: calculated.sub,
      taxableAmount: calculated.sub,
      kitSubtotal: calculated.kitSubtotal,
      discountTotal: 0,
      gstTotal: calculated.gst,
      cgst: calculated.cgst,
      sgst: calculated.sgst,
      grandTotal: calculated.grand,
      totalAmount: calculated.grand,
      status: finalStatus,
      revisionCount: newRevCount,
      transportMode,
      transporterName,
      vehicleNo,
      transportScope,
      paymentTerms,
      terms,
      termsPresetKey: selectedTermsPreset,
      notes: terms,
      updatedAt: new Date().toISOString(),
      createdAt: isEditing ? (quotations.find(q => (q.quoteNumber || q.id) === editingQuoteId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };

    if (onSaveQuotation) {
      onSaveQuotation(record);
    } else {
      // Cloud store fallback persistence
      fetchCloudStore('crm_quotations', []).then(currentList => {
        const filtered = (Array.isArray(currentList) ? currentList : []).filter(q => (q.quoteNumber || q.id) !== record.id);
        const updated = [record, ...filtered];
        saveCloudStoreImmediate('crm_quotations', updated);
      });
    }

    showToast(isEditing ? `Quotation ${record.quoteNumber} revised successfully! (Rev #${newRevCount})` : `Quotation ${record.quoteNumber} created successfully!`);
    setShowBOMQuoteForm(false);
  };

  // Convert Quotation directly to Proforma Invoice (PI)
  const handleConvertToPI = async (quote) => {
    if (!quote) return;

    // 1. Generate Next Sales PI Number
    const existingPIs = await fetchCloudStore('sales_pi_store', []);
    const nextPiIndex = (Array.isArray(existingPIs) ? existingPIs.length : 0) + 101;
    const piNumber = `SPI-2026-${nextPiIndex}`;

    // 2. Prepare items and amounts
    const cleanAmount = Number(quote.grandTotal || quote.totalAmount || quote.numericTotal || 0);
    const firstItem = (quote.items && quote.items[0]) || {};
    const totalQty = (quote.items || []).reduce((acc, it) => acc + (parseFloat(it.qty) || 0), 0) || 1;

    const repName = quote.salesPerson || quote.salesperson || quote.salesRep || getActiveUserName();
    const repCode = quote.salesPersonCode || quote.createdById || '';

    const newPI = {
      piNo: piNumber,
      sourceQuoteNo: quote.code || quote.quoteNumber,
      vendor: quote.customer || quote.customerName || quote.companyName || 'Customer Client',
      customerName: quote.customer || quote.customerName || quote.companyName || 'Customer Client',
      gstNo: quote.gstNumber || quote.gstNo || '33AAAAA0000A1Z5',
      productName: quote.structure || quote.structureType || firstItem.name || 'Solar Mounting Rails & Components',
      unitValue: cleanAmount > 0 && totalQty > 0 ? Math.round(cleanAmount / totalQty) : cleanAmount,
      quantity: totalQty,
      amount: `₹${cleanAmount.toLocaleString('en-IN')}`,
      pdfName: `sales_pi_${(quote.customer || 'client').toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`,
      piDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      expDate: new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Pending Approval',
      statusType: 'pending',
      type: 'Sales PI',
      salesPerson: repName,
      salesperson: repName,
      salesPersonCode: repCode,
      createdBy: repName,
      createdById: repCode,
      items: (quote.items || []).map(it => {
        const isPreset = Boolean(it.isPresetItem);
        return {
          name: it.name || it.description,
          category: it.category || (isPreset ? 'Preset Component' : 'MMS Scope'),
          uom: it.uom || it.unit || 'NOS',
          qty: String(it.qty || 1),
          baseQty: it.baseQty != null ? it.baseQty : (parseFloat(it.qty) || 1),
          rate: isPreset ? '0' : String(it.rate || 0),
          gstRate: it.gstRate || '18%',
          isPresetItem: isPreset,
          presetGroupId: it.presetGroupId || null,
          presetName: it.presetName || null
        };
      }),
      presetGroups: quote.presetGroups || {},
      presetName: quote.presetName || null,
      presetKitPrice: quote.presetKitPrice || quote.kitSubtotal || null,
      presetSetCount: quote.presetSetCount || null,
      kitSubtotal: quote.kitSubtotal || null,
      notes: `Generated automatically from Quotation ${quote.code || quote.quoteNumber}. Unlimited revisions kept in quotation history.`
    };

    // 3. Save to sales PI store in Supabase cloud database
    const updatedPIs = [newPI, ...(Array.isArray(existingPIs) ? existingPIs.filter(p => p.piNo !== piNumber) : [])];
    try {
      await saveCloudStoreImmediate('sales_pi_store', updatedPIs);
      await saveCloudStoreImmediate('proforma_invoice_store', updatedPIs);
      fetch('/api/zoho/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPI)
      }).catch(() => {});
      window.dispatchEvent(new Event('controlroom_storage_update'));
    } catch (e) {}

    // 4. Mark quotation status as 'Converted to PI'
    const updatedQuote = {
      ...quote,
      status: 'Converted to PI',
      convertedPiNo: piNumber,
      convertedAt: new Date().toISOString()
    };
    if (onSaveQuotation) {
      onSaveQuotation(updatedQuote);
    } else {
      fetchCloudStore('crm_quotations', []).then(currentList => {
        const updated = (Array.isArray(currentList) ? currentList : []).map(q => (q.quoteNumber || q.id) === (quote.quoteNumber || quote.id) ? updatedQuote : q);
        saveCloudStoreImmediate('crm_quotations', updated);
      });
    }

    // 5. Notify & offer navigation to Performa Invoice tab
    showToast(`Quotation ${quote.code || quote.quoteNumber} converted to Proforma Invoice (${piNumber})!`);
    if (selectedQuote) setSelectedQuote(null);

    // Provide immediate navigation prompt
    const goToPi = window.confirm(`Quotation successfully converted to PI (${piNumber})!\n\nWould you like to open the Performa Invoices page to view and track it now?`);
    if (goToPi && onNavigateTab) {
      onNavigateTab('Performa Invoice');
    }
  };

  // Prepare and open Send Quotation Template Modal
  const handleOpenSendQuoteModal = (quote, channel = 'WhatsApp') => {
    if (!quote) return;
    const defaultTemplateKey = channel === 'WhatsApp' ? 'quick_whatsapp' : 'official_intro';
    const tmpl = QUOTE_SENDING_TEMPLATES.find(t => t.key === defaultTemplateKey) || QUOTE_SENDING_TEMPLATES[0];

    // Compute template replacements
    const custName = quote.customer || quote.customerName || quote.companyName || 'Valued Customer';
    const qNum = quote.code || quote.quoteNumber || 'QT-2026';
    const qDate = quote.date || (quote.createdAt ? quote.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
    const struct = quote.structure || quote.structureType || 'Solar MMS Rails & Clamps';
    const kw = quote.capacityKw || '100';
    const total = quote.formattedTotal || `₹ ${Number(quote.grandTotal || quote.totalAmount || 0).toLocaleString('en-IN')}`;
    const itemsCount = (quote.items && quote.items.length) || 1;
    const rep = quote.salesRep || quote.salesPerson || quote.salesperson || getActiveUserName();
    const payTerms = quote.paymentTerms || '50% Advance + 50% Before Dispatch';
    const rev = quote.revCount || quote.revisionCount || 0;

    const fillVars = (txt) => {
      return (txt || '')
        .replace(/\{\{customerName\}\}/g, custName)
        .replace(/\{\{quoteNumber\}\}/g, qNum)
        .replace(/\{\{quoteDate\}\}/g, qDate)
        .replace(/\{\{structureType\}\}/g, struct)
        .replace(/\{\{capacityKw\}\}/g, String(kw))
        .replace(/\{\{formattedTotal\}\}/g, total)
        .replace(/\{\{itemCount\}\}/g, String(itemsCount))
        .replace(/\{\{validityDays\}\}/g, '15')
        .replace(/\{\{salesRep\}\}/g, rep)
        .replace(/\{\{paymentTerms\}\}/g, payTerms)
        .replace(/\{\{revCount\}\}/g, String(rev));
    };

    setSendQuoteModalData(quote);
    setSendChannel(channel);
    setActiveSendTemplateKey(tmpl.key);
    setEditableEmailSubject(fillVars(tmpl.subject));
    setEditableMessageBody(fillVars(tmpl.body));
    setRecipientContact(channel === 'WhatsApp' ? (quote.phone || '+91 98765 43210') : (quote.email || 'procurement@client.com'));
  };

  // Switch template inside modal and re-fill placeholders
  const handleSelectSendTemplate = (tmplKey) => {
    setActiveSendTemplateKey(tmplKey);
    const tmpl = QUOTE_SENDING_TEMPLATES.find(t => t.key === tmplKey);
    if (!tmpl || !sendQuoteModalData) return;

    const quote = sendQuoteModalData;
    const custName = quote.customer || quote.customerName || quote.companyName || 'Valued Customer';
    const qNum = quote.code || quote.quoteNumber || 'QT-2026';
    const qDate = quote.date || (quote.createdAt ? quote.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
    const struct = quote.structure || quote.structureType || 'Solar MMS Rails & Clamps';
    const kw = quote.capacityKw || '100';
    const total = quote.formattedTotal || `₹ ${Number(quote.grandTotal || quote.totalAmount || 0).toLocaleString('en-IN')}`;
    const itemsCount = (quote.items && quote.items.length) || 1;
    const rep = quote.salesRep || quote.salesPerson || quote.salesperson || getActiveUserName();
    const payTerms = quote.paymentTerms || '50% Advance + 50% Before Dispatch';
    const rev = quote.revCount || quote.revisionCount || 0;

    const fillVars = (txt) => {
      return (txt || '')
        .replace(/\{\{customerName\}\}/g, custName)
        .replace(/\{\{quoteNumber\}\}/g, qNum)
        .replace(/\{\{quoteDate\}\}/g, qDate)
        .replace(/\{\{structureType\}\}/g, struct)
        .replace(/\{\{capacityKw\}\}/g, String(kw))
        .replace(/\{\{formattedTotal\}\}/g, total)
        .replace(/\{\{itemCount\}\}/g, String(itemsCount))
        .replace(/\{\{validityDays\}\}/g, '15')
        .replace(/\{\{salesRep\}\}/g, rep)
        .replace(/\{\{paymentTerms\}\}/g, payTerms)
        .replace(/\{\{revCount\}\}/g, String(rev));
    };

    setEditableEmailSubject(fillVars(tmpl.subject));
    setEditableMessageBody(fillVars(tmpl.body));
  };

  // Handle Send Quote execution
  const handleExecuteSendQuote = () => {
    if (!sendQuoteModalData) return;
    const quote = sendQuoteModalData;

    if (sendChannel === 'WhatsApp') {
      const cleanPhone = (recipientContact || '').replace(/[^0-9]/g, '');
      const encodedMsg = encodeURIComponent(editableMessageBody);
      const whatsappUrl = cleanPhone 
        ? `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${encodedMsg}`
        : `https://wa.me/?text=${encodedMsg}`;

      // Open WhatsApp web / app
      window.open(whatsappUrl, '_blank');
      showToast(`Quotation ${quote.code || quote.quoteNumber} dispatched via WhatsApp!`);
    } else {
      // Email via mailto
      const mailtoUrl = `mailto:${recipientContact || ''}?subject=${encodeURIComponent(editableEmailSubject)}&body=${encodeURIComponent(editableMessageBody)}`;
      window.location.href = mailtoUrl;
      showToast(`Email client opened for ${recipientContact || 'customer'}!`);
    }

    // Update status to 'Sent' if it was draft
    if (quote.status === 'Draft') {
      const updatedQuote = { ...quote, status: 'Sent' };
      if (onSaveQuotation) {
        onSaveQuotation(updatedQuote);
      } else {
        fetchCloudStore('crm_quotations', []).then(currentList => {
          const updated = (Array.isArray(currentList) ? currentList : []).map(q => (q.quoteNumber || q.id) === (quote.quoteNumber || quote.id) ? updatedQuote : q);
          saveCloudStoreImmediate('crm_quotations', updated);
        });
      }
    }

    setSendQuoteModalData(null);
  };

  // Add Item Row
  const handleAddItemRow = () => {
    setQuoteItems(prev => [
      ...prev,
      { name: '', category: 'Mounting Components', uom: 'NOS', qty: '1', rate: '0', gstRate: '18%' }
    ]);
  };

  // Remove Item Row
  const handleRemoveItemRow = (idx) => {
    setQuoteItems(prev => prev.filter((_, i) => i !== idx));
  };

  // =========================================================================
  // VIEW 1: FULL BOM-STYLE QUOTATION CREATION / EDITING FORM
  // =========================================================================
  if (showBOMQuoteForm) {
    const hasAnyPreset = (quoteItems || []).some(it => it.isPresetItem);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>
        
        {/* Top Banner Matching BOM Page */}
        <div style={{
          background: 'linear-gradient(135deg, #075985 0%, #0E7490 50%, #0891B2 100%)',
          borderRadius: '18px',
          padding: '24px 28px',
          color: '#FFFFFF',
          boxShadow: '0 10px 25px -5px rgba(14, 116, 144, 0.4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText style={{ width: '24px', height: '24px', color: '#FFFFFF' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
                  {editingQuoteId ? 'Revise Commercial Quotation' : 'Create Solar Structure Quotation'}
                </h1>
                {revisionCount > 0 && (
                  <span style={{ backgroundColor: '#F59E0B', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '800' }}>
                    Rev #{revisionCount}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '13px', color: '#CFFAFE', margin: '4px 0 0 0' }}>
                Configure client scope, compile structure kit presets, customize line items freely, and generate official commercial proposal
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button
              onClick={() => setQuoteConfirmModal('cancel')}
              style={{ border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer', backdropFilter: 'blur(4px)', whiteSpace: 'nowrap' }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!customerName || !customerName.trim()) {
                  alert('⚠️ Please specify or select a Customer Name before proceeding.');
                  return;
                }
                if (!quoteItems || quoteItems.length === 0) {
                  alert('⚠️ Please add at least one Product / Item to the quotation materials list.');
                  return;
                }
                setQuoteConfirmModal('create');
              }}
              style={{ border: 'none', background: '#10B981', color: 'white', padding: '10px 22px', borderRadius: '10px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
            >
              <CheckCircle style={{ width: '16px', height: '16px' }} />
              <span>{editingQuoteId ? 'Save & Send Revision →' : 'Create Quotation →'}</span>
            </button>
          </div>
        </div>

        {/* SECTION 1: QUOTATION & ORDER INFORMATION */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              1
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              QUOTATION INFORMATION
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '6px' }}>
                Quote Date
              </label>
              <input
                type="date"
                value={quoteDate}
                readOnly
                disabled
                title="Quote date is automatically recorded and cannot be modified"
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  padding: '0 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#64748B',
                  backgroundColor: '#F1F5F9',
                  cursor: 'not-allowed',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Valid Until <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                id="quote-field-validUntil"
                type="date"
                value={validUntilDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  const val = e.target.value;
                  const todayStr = new Date().toISOString().split('T')[0];
                  if (val && val < todayStr) {
                    setValidUntilDate(todayStr);
                  } else {
                    setValidUntilDate(val);
                  }
                }}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Quote Reference No.</label>
              <input
                type="text"
                value={quoteCode}
                readOnly
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0E7490', backgroundColor: '#F0FDFA', fontWeight: '800', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '6px' }}>
                Sales Representative <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={salesPerson || getActiveUserName()}
                title="Sales representative is tied to the logged-in account and cannot be modified"
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', fontWeight: '700', color: '#475569', backgroundColor: '#F1F5F9', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: CUSTOMER INFORMATION & ADDRESSES */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              2
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              CUSTOMER INFORMATION & SITE DESTINATION
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Customer Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                id="quote-field-customerName"
                type="text"
                list="quotation-customer-suggestions"
                placeholder="Type or select customer from CRM directory..."
                value={customerName}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none', fontWeight: '600' }}
              />
              <datalist id="quotation-customer-suggestions">
                {customerList.map((c, idx) => {
                  const val = c.code || c.companyName || c.customerName;
                  const label = c.c2 || c.companyName;
                  return (
                    <option key={idx} value={val}>
                      {label && label !== val ? `${val} (${label})` : val}
                    </option>
                  );
                })}
              </datalist>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Contact Person</label>
              <input
                type="text"
                placeholder="e.g. Rajesh Kumar"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Phone / WhatsApp</label>
              <input
                id="quote-field-phone"
                type="text"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Customer GST Number</label>
              <input
                type="text"
                placeholder="33AAAAA0000A1Z5"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', textTransform: 'uppercase', fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Plant Capacity (kW)</label>
              <input
                type="number"
                placeholder="100"
                value={capacityKw}
                onChange={(e) => setCapacityKw(e.target.value)}
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>

          {/* Dual Address Cards: Billing Address and Site Delivery Address */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '4px' }}>
            {/* Card 1: Billing Address */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 style={{ width: '16px', height: '16px', color: '#0E7490' }} />
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Billing Address</h4>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Address</label>
                <input
                  id="quote-field-billingStreet"
                  type="text"
                  placeholder="e.g. Plot No 42, SIDCO Industrial Estate, Ambattur"
                  value={billingStreet}
                  onChange={(e) => {
                    setBillingStreet(e.target.value);
                    if (sameAsBilling) setDeliveryStreet(e.target.value);
                  }}
                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none', backgroundColor: '#FFFFFF' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                  <input
                    id="quote-field-billingCity"
                    type="text"
                    placeholder="e.g. Chennai"
                    value={billingCity}
                    onChange={(e) => {
                      setBillingCity(e.target.value);
                      if (sameAsBilling) setDeliveryCity(e.target.value);
                    }}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none', backgroundColor: '#FFFFFF' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                  <input
                    id="quote-field-billingState"
                    type="text"
                    placeholder="e.g. Tamil Nadu"
                    value={billingState}
                    onChange={(e) => {
                      setBillingState(e.target.value);
                      if (sameAsBilling) setDeliveryState(e.target.value);
                    }}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none', backgroundColor: '#FFFFFF' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                  <input
                    id="quote-field-billingPincode"
                    type="text"
                    placeholder="e.g. 600058"
                    value={billingPincode}
                    onChange={(e) => {
                      setBillingPincode(e.target.value);
                      if (sameAsBilling) setDeliveryPincode(e.target.value);
                    }}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none', backgroundColor: '#FFFFFF' }}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Site Delivery Address (with Same-as-Billing toggle) */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck style={{ width: '16px', height: '16px', color: '#0E7490' }} />
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Site Delivery Address</h4>
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#0E7490', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={sameAsBilling}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSameAsBilling(checked);
                      if (checked) {
                        setDeliveryStreet(billingStreet);
                        setDeliveryCity(billingCity);
                        setDeliveryState(billingState);
                        setDeliveryPincode(billingPincode);
                      }
                    }}
                    style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                  />
                  Same as Billing
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Address</label>
                <input
                  id="quote-field-deliveryStreet"
                  type="text"
                  placeholder="e.g. Solar Site Project Location, Plot 10"
                  value={sameAsBilling ? billingStreet : deliveryStreet}
                  disabled={sameAsBilling}
                  onChange={(e) => setDeliveryStreet(e.target.value)}
                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                  <input id="quote-field-deliveryCity" type="text" placeholder="e.g. Chennai" value={sameAsBilling ? billingCity : deliveryCity} disabled={sameAsBilling} onChange={(e) => setDeliveryCity(e.target.value)} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: sameAsBilling ? 'not-allowed' : 'text' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                  <input id="quote-field-deliveryState" type="text" placeholder="e.g. Tamil Nadu" value={sameAsBilling ? billingState : deliveryState} disabled={sameAsBilling} onChange={(e) => setDeliveryState(e.target.value)} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: sameAsBilling ? 'not-allowed' : 'text' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                  <input id="quote-field-deliveryPincode" type="text" placeholder="e.g. 600058" value={sameAsBilling ? billingPincode : deliveryPincode} disabled={sameAsBilling} onChange={(e) => setDeliveryPincode(e.target.value)} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: sameAsBilling ? 'not-allowed' : 'text' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: ORDER ITEMS & BILL OF MATERIALS (BOM PRESET COMPILER) */}
        <div id="quote-field-items" style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
          {/* Section 3 Header — Clean Single Row */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px', gap: '20px', flexWrap: 'wrap', borderBottom: '1px solid #F1F5F9' }}>
            {/* Left: Badge + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: 'auto' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>3</div>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>QUOTATION SCOPE & LINE ITEMS</span>
            </div>

            {/* Preset Pill */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: '#ECFEFF', padding: '0 16px', borderRadius: '20px', height: '40px', border: '1px solid #CFFAFE' }}>
              <Layers style={{ width: '15px', height: '15px', color: '#0E7490' }} />
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0E7490' }}>Preset:</span>
            </div>

            {/* Searchable Preset Selector */}
            <SearchablePresetSelector
              value={selectedPreset}
              activePresetsMap={activePresetsMap}
              accentColor="#0E7490"
              width="380px"
              placeholder="Pick a Preset to add..."
              style={{ height: '40px' }}
              onChange={(val, targetPreset) => {
                if (val && targetPreset && targetPreset.items) {
                  handleAddPresetToOrder(val, targetPreset, 1);
                } else if (!val) {
                  setSelectedPreset('');
                }
              }}
            />

            {/* Clear Button */}
            <button
              type="button"
              onClick={() => {
                if (selectedItemIndexes.length > 0) {
                  setQuoteItems(prev => prev.filter((_, idx) => !selectedItemIndexes.includes(idx)));
                  setSelectedItemIndexes([]);
                } else {
                  if (quoteItems.length > 0) setShowClearConfirmModal(true);
                }
              }}
              title={selectedItemIndexes.length > 0 ? `Remove ${selectedItemIndexes.length} selected item(s)` : 'Clear all quotation items'}
              style={{ border: 'none', backgroundColor: selectedItemIndexes.length > 0 ? '#EF4444' : '#FFE4E6', color: selectedItemIndexes.length > 0 ? 'white' : '#E11D48', width: '40px', height: '40px', borderRadius: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
            >
              <X style={{ width: '18px', height: '18px' }} />
            </button>
          </div>

          {/* Active Preset Badges / Pills */}
          {Object.values(presetGroups).length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '12px 24px 0 24px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>Active Presets in Quotation:</span>
              {Object.values(presetGroups).map(grp => (
                <span
                  key={grp.groupId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#ECFEFF',
                    color: '#0E7490',
                    border: '1px solid #A5F3FC',
                    borderRadius: '16px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: '700'
                  }}
                >
                  <Layers size={13} style={{ color: '#0E7490' }} />
                  {grp.presetName} ({grp.setCount} Set{grp.setCount > 1 ? 's' : ''})
                  <button
                    type="button"
                    onClick={() => handleRemovePresetGroup(grp.groupId)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 0 0 2px', display: 'flex', alignItems: 'center', color: '#0891B2' }}
                    title={`Remove ${grp.presetName}`}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Clear confirm modal */}
          {showClearConfirmModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle style={{ width: '20px', height: '20px' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Clear All Quotation Items?</h3>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>Are you sure you want to delete all items from this quotation scope?</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button onClick={() => setShowClearConfirmModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => { setQuoteItems([]); setSelectedPreset(''); setPresetGroups({}); setSelectedItemIndexes([]); setShowClearConfirmModal(false); }} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#DC2626', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Clear All Items</button>
                </div>
              </div>
            </div>
          )}

          {/* Clean Modern Items Table */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ color: '#475569', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '12px 14px', width: '30px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={quoteItems.length > 0 && selectedItemIndexes.length === quoteItems.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItemIndexes(quoteItems.map((_, idx) => idx));
                          } else {
                            setSelectedItemIndexes([]);
                          }
                        }}
                        style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '12px 10px', fontWeight: '700', width: '30%' }}>Product / Item <span style={{ color: '#EF4444' }}>*</span></th>
                    <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%' }}>UOM</th>
                    <th style={{ padding: '12px 10px', fontWeight: '700', width: '8%', textAlign: 'center' }}>Qty <span style={{ color: '#EF4444' }}>*</span></th>
                    <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%' }}>Price (₹)</th>
                    <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%', textAlign: 'center' }}>GST Rate</th>
                    {quoteItems.some(it => it.isPresetItem) && <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%', color: '#0E7490', backgroundColor: '#ECFEFF' }}>Preset Amt (₹)</th>}
                    <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%', textAlign: 'right' }}>Taxable (₹)</th>
                    <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%', textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ padding: '12px 10px', fontWeight: '700', width: '4%', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteItems.length === 0 ? (
                    <tr>
                      <td colSpan={quoteItems.some(it => it.isPresetItem) ? 10 : 9} style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                        No items added yet. Pick a preset above or click <strong>+ Add Product / Item</strong> below.
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const hasAnyPreset = quoteItems.some(it => it.isPresetItem);
                      return quoteItems.map((item, i) => {
                      const q = parseFloat(item.qty) || 0;
                      const r = parseFloat(item.rate) || 0;
                      const taxable = q * r;
                      const gstPct = parseFloat(String(item.gstRate || '18%').replace('%', '')) || 18;
                      const gstAmt = taxable * (gstPct / 100);
                      const rowTot = taxable + gstAmt;
                      const isChecked = selectedItemIndexes.includes(i);

                      const isPresetItem = Boolean(item.isPresetItem);
                      const groupId = item.presetGroupId || (isPresetItem ? 'legacy_default' : null);
                      const groupItems = isPresetItem ? quoteItems.filter(it => (it.presetGroupId || 'legacy_default') === groupId) : [];
                      const isFirstInGroup = isPresetItem && quoteItems.findIndex(it => (it.presetGroupId || 'legacy_default') === groupId) === i;
                      const groupCount = groupItems.length;
                      const currentGroup = (groupId && presetGroups[groupId]) || {
                        groupId: groupId || 'legacy_default',
                        presetName: item.presetName || selectedPreset || 'Preset Kit',
                        setCount: 1,
                        kitPrice: ''
                      };

                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: isChecked ? '#ECFEFF' : (i % 2 === 1 ? '#FAFBFC' : 'white') }}>
                          <td style={{ padding: '12px 10px', textAlign: 'center', borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedItemIndexes(prev => [...prev, i]);
                                else setSelectedItemIndexes(prev => prev.filter(idx => idx !== i));
                              }}
                              style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '10px 10px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {/* Line 1: Product / Item Name (Typeable & Dropdown) */}
                              <TypeableProductSelect
                                value={item.name || ''}
                                itemsList={itemsList}
                                placeholder="Type or select product / item..."
                                accentColor="#4F46E5"
                                onChange={(val, matched) => {
                                  const pName = matched ? matched.name : val;
                                  const pCat = matched ? (matched.category || matched.description || item.category) : item.category;
                                  const isSolar5 = is5PctSolarProduct(pName, pCat);
                                  setQuoteItems(prev => prev.map((mat, idx) => idx === i ? {
                                    ...mat,
                                    name: pName,
                                    rate: matched ? String(matched.price || matched.rate || mat.rate) : mat.rate,
                                    uom: matched ? (matched.uom || matched.unit || mat.uom) : mat.uom,
                                    category: pCat,
                                    gstRate: isSolar5 ? '5%' : (mat.gstRate || '18%')
                                  } : mat));
                                }}
                              />
                               {/* Line 2: Description */}
                               <input
                                 type="text"
                                 placeholder="Description..."
                                 value={item.category || ''}
                                 onChange={(e) => {
                                   const val = e.target.value;
                                   setQuoteItems(prev => prev.map((mat, idx) => {
                                     if (idx !== i) return mat;
                                     const isSolar5 = is5PctSolarProduct(mat.name, val);
                                     return {
                                       ...mat,
                                       category: val,
                                       gstRate: isSolar5 ? '5%' : mat.gstRate
                                     };
                                   }));
                                 }}
                                 style={{ width: '100%', height: '28px', borderRadius: '6px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '11px', color: '#64748B', outline: 'none', boxSizing: 'border-box', backgroundColor: '#F8FAFC', cursor: 'text' }}
                               />
                             </div>
                           </td>
                           <td style={{ padding: '12px 10px' }}>
                             <input
                               type="text"
                               list={`uom-list-${i}`}
                               placeholder="UOM"
                               value={item.uom || 'NOS'}
                               onChange={(e) => {
                                 const val = e.target.value;
                                 setQuoteItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, uom: val } : mat));
                               }}
                               style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '12px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF', fontWeight: '600', cursor: 'text' }}
                             />
                             <datalist id={`uom-list-${i}`}>
                               <option value="NOS" />
                               <option value="SET" />
                               <option value="KG" />
                               <option value="MTR" />
                               <option value="PCS" />
                               <option value="BOX" />
                               <option value="PKT" />
                               <option value="PAIR" />
                             </datalist>
                           </td>
                           <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                               {(() => {
                                 const avail = getItemStock(item.name, item.code);
                                 if (avail === null) {
                                   return (
                                     <span style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', letterSpacing: '0.2px' }}>
                                       Stock: —
                                     </span>
                                   );
                                 }
                                 const isOut = avail <= 0;
                                 return (
                                   <span
                                     title={`Available Stock: ${avail.toLocaleString()}`}
                                     style={{
                                       fontSize: '10.5px',
                                       fontWeight: '800',
                                       padding: '1px 7px',
                                       borderRadius: '10px',
                                       backgroundColor: isOut ? '#FEF2F2' : '#ECFDF5',
                                       color: isOut ? '#DC2626' : '#059669',
                                       border: isOut ? '1px solid #FECACA' : '1px solid #A7F3D0',
                                       whiteSpace: 'nowrap',
                                       lineHeight: '1.3'
                                     }}
                                   >
                                     Stock: {avail.toLocaleString()}
                                   </span>
                                 );
                               })()}
                               <input
                                 type="number"
                                 value={item.qty}
                                 placeholder="0"
                                 onChange={(e) => {
                                   const val = e.target.value;
                                   setQuoteItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, qty: val } : mat));
                                 }}
                                 style={{ width: '100%', height: '34px', borderRadius: '7px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '13px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', cursor: 'text', fontWeight: '600' }}
                               />
                             </div>
                           </td>
                          <td style={{ padding: '12px 10px' }}>
                            {isPresetItem ? (
                              <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                            ) : (
                              <input
                                type="number"
                                value={item.rate}
                                placeholder="0.00"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQuoteItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, rate: val } : mat));
                                }}
                                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '13px', textAlign: 'right', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', cursor: 'text' }}
                              />
                            )}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            <select
                              value={item.gstRate || (currentGroup && currentGroup.gstRate) || '18%'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQuoteItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, gstRate: val } : mat));
                              }}
                              style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #C7D2FE', padding: '0 6px', fontSize: '12px', fontWeight: '700', color: '#4338CA', backgroundColor: '#EEF2FF', outline: 'none', cursor: 'pointer', textAlign: 'center' }}
                            >
                              <option value="18%">18% GST</option>
                              <option value="12%">12% GST</option>
                              <option value="5%">5% GST</option>
                              <option value="0%">0% Exempt</option>
                            </select>
                          </td>
                          {hasAnyPreset && (() => {
                            if (isPresetItem) {
                              if (isFirstInGroup) {
                                return (
                                  <td
                                    rowSpan={groupCount}
                                    style={{
                                      padding: '12px 10px',
                                      verticalAlign: 'middle',
                                      backgroundColor: '#EEF2FF',
                                      borderLeft: '2px solid #C7D2FE',
                                      borderRight: '2px solid #C7D2FE'
                                    }}
                                  >
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: '800',
                                          color: '#4338CA',
                                          textAlign: 'center',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          maxWidth: '120px',
                                          display: 'block'
                                        }}
                                        title={currentGroup.presetName}
                                      >
                                        {currentGroup.presetName}
                                      </span>

                                      <div style={{ position: 'relative', width: '100%' }}>
                                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', fontWeight: '700', color: '#6366F1', pointerEvents: 'none' }}>₹</span>
                                        <input
                                          type="number"
                                          value={currentGroup.kitPrice}
                                          placeholder="0.00"
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (groupId) {
                                              setPresetGroups(prev => ({
                                                ...prev,
                                                [groupId]: { ...(prev[groupId] || currentGroup), kitPrice: val }
                                              }));
                                            }
                                          }}
                                          style={{
                                            width: '100%', height: '42px', borderRadius: '8px',
                                            border: '2px solid #818CF8', padding: '0 10px 0 26px',
                                            fontSize: '15px', fontWeight: '800', color: '#312E81',
                                            textAlign: 'right', outline: 'none', boxSizing: 'border-box',
                                            backgroundColor: 'white', cursor: 'text'
                                          }}
                                        />
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: '600' }}>
                                          {groupCount} items ×
                                        </span>
                                        <input
                                          type="number"
                                          min="0"
                                          max="999"
                                          value={currentGroup.setCount !== undefined && currentGroup.setCount !== null ? currentGroup.setCount : ''}
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) => {
                                            const rawVal = e.target.value;
                                            if (rawVal === '') {
                                              if (groupId) {
                                                setPresetGroups(prev => ({
                                                  ...prev,
                                                  [groupId]: { ...(prev[groupId] || currentGroup), setCount: '' }
                                                }));
                                              }
                                              return;
                                            }
                                            const parsed = parseInt(rawVal);
                                            const valToSave = isNaN(parsed) ? '' : Math.max(0, parsed);
                                            if (groupId) {
                                              setPresetGroups(prev => ({
                                                ...prev,
                                                [groupId]: { ...(prev[groupId] || currentGroup), setCount: valToSave }
                                              }));
                                            }
                                            const multiplier = isNaN(parsed) ? 0 : Math.max(0, parsed);
                                            setQuoteItems(prev => prev.map(mat => {
                                              if ((mat.presetGroupId || 'legacy_default') === groupId && mat.baseQty) {
                                                return { ...mat, qty: String(Math.round(mat.baseQty * multiplier)) };
                                              }
                                              return mat;
                                            }));
                                          }}
                                          onBlur={() => {
                                            const current = currentGroup.setCount;
                                            const finalCount = (current === '' || isNaN(parseInt(current)) || parseInt(current) < 0) ? 1 : Math.max(0, parseInt(current));
                                            if (groupId) {
                                              setPresetGroups(prev => ({
                                                ...prev,
                                                [groupId]: { ...(prev[groupId] || currentGroup), setCount: finalCount }
                                              }));
                                            }
                                            setQuoteItems(prev => prev.map(mat => {
                                              if ((mat.presetGroupId || 'legacy_default') === groupId && mat.baseQty) {
                                                return { ...mat, qty: String(Math.round(mat.baseQty * finalCount)) };
                                              }
                                              return mat;
                                            }));
                                          }}
                                          style={{
                                            width: '42px', height: '26px', borderRadius: '6px',
                                            border: '1.5px solid #818CF8', fontSize: '13px',
                                            fontWeight: '800', color: '#312E81', textAlign: 'center',
                                            padding: '0 2px', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box', cursor: 'text'
                                          }}
                                          title="Sets multiplier for this preset"
                                        />
                                        <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: '600' }}>
                                          set{(parseInt(currentGroup.setCount) || 1) !== 1 ? 's' : ''}
                                        </span>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                        <span style={{ fontSize: '10px', color: '#6366F1', fontWeight: '700' }}>GST:</span>
                                        <select
                                          value={currentGroup.gstRate || item.gstRate || '18%'}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (groupId) {
                                              setPresetGroups(prev => ({
                                                ...prev,
                                                [groupId]: { ...(prev[groupId] || currentGroup), gstRate: val }
                                              }));
                                            }
                                            setQuoteItems(prev => prev.map((mat, idx) =>
                                              ((mat.presetGroupId || 'legacy_default') === groupId || idx === i)
                                                ? { ...mat, gstRate: val }
                                                : mat
                                            ));
                                          }}
                                          style={{
                                            height: '24px', borderRadius: '6px',
                                            border: '1.5px solid #818CF8', padding: '0 4px',
                                            fontSize: '11px', fontWeight: '800',
                                            color: '#312E81', backgroundColor: '#FFFFFF',
                                            outline: 'none', cursor: 'pointer'
                                          }}
                                          title="Change GST Rate for this preset"
                                        >
                                          <option value="18%">18%</option>
                                          <option value="12%">12%</option>
                                          <option value="5%">5%</option>
                                          <option value="0%">0%</option>
                                        </select>
                                      </div>

                                      {groupId && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemovePresetGroup(groupId)}
                                          style={{
                                            border: 'none',
                                            backgroundColor: 'transparent',
                                            color: '#EF4444',
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            marginTop: '2px'
                                          }}
                                          title={`Remove entire ${currentGroup.presetName} preset`}
                                        >
                                          Remove Kit
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                );
                              } else {
                                return null;
                              }
                            } else {
                              return <td style={{ padding: '12px 10px', textAlign: 'center' }}><span style={{ fontSize: '11px', color: '#CBD5E1' }}>—</span></td>;
                            }
                          })()}
                          <td style={{ padding: '12px 10px', color: '#475569', textAlign: 'right', fontWeight: '600' }}>
                            {isPresetItem ? (
                              <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                            ) : (
                              `₹${taxable.toFixed(2)}`
                            )}
                          </td>
                          <td style={{ padding: '12px 10px', fontWeight: 'bold', color: '#0F172A', textAlign: 'right' }}>
                            {isPresetItem ? (
                              <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                            ) : (
                              `₹${rowTot.toFixed(2)}`
                            )}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterialRow(i)}
                              style={{ border: 'none', background: '#FEF2F2', color: '#EF4444', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Delete Item"
                            >
                              <Trash2 style={{ width: '15px', height: '15px' }} />
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()
                )}
                </tbody>
              </table>
            </div>

            <div>
              <button
                type="button"
                onClick={handleAddMaterialRow}
                style={{ border: '1px solid #A5F3FC', background: '#ECFEFF', color: '#0E7490', padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus style={{ width: '15px', height: '15px' }} />
                Add Product / Item
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 4: TRANSPORT & LOGISTICS DETAILS + TERMS & CONDITIONS */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              4
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TRANSPORT, LOGISTICS & TERMS AND CONDITIONS
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Mode of Transport</label>
              <select
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none', cursor: 'pointer' }}
              >
                <option value="Transport">Transport (Road Freight)</option>
                <option value="Own Vehicle">Own Vehicle</option>
                <option value="Porter / Local">Porter / Local Delivery</option>
                <option value="Courier">Courier / Express</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Transporter Name</label>
              <input
                type="text"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                placeholder="e.g. VRL Logistics / TCI Freight"
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Vehicle Number</label>
              <input
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="e.g. TN 01 AB 1234"
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Logistics Scope</label>
              <select
                value={transportScope}
                onChange={(e) => setTransportScope(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none', cursor: 'pointer' }}
              >
                <option value="VRM Structures">VRM Structures Scope</option>
                <option value="Customer Scope">Customer Scope (To-Pay)</option>
              </select>
            </div>
          </div>

          {/* Terms & Conditions Presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>Quotation Terms & Conditions Clauses</label>
              <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', padding: '4px 10px', borderRadius: '8px' }}>
                Preset: {QUOTATION_TERMS_PRESETS.find(p => p.key === selectedTermsPreset)?.label || 'Custom / Typed'}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedTermsPreset('');
                  setTerms('');
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: selectedTermsPreset === '' ? '1.5px dashed #0E7490' : '1px solid #CBD5E1',
                  backgroundColor: selectedTermsPreset === '' ? '#F0FDFA' : '#FFFFFF',
                  color: selectedTermsPreset === '' ? '#0E7490' : '#475569',
                  fontSize: '11px',
                  fontWeight: selectedTermsPreset === '' ? '700' : '500',
                  cursor: 'pointer'
                }}
              >
                Clear / Custom
              </button>

              {QUOTATION_TERMS_PRESETS.map((p) => {
                const isSelected = selectedTermsPreset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setSelectedTermsPreset(p.key);
                      setTerms(p.text);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid #0E7490' : '1px solid #CBD5E1',
                      backgroundColor: isSelected ? '#0E7490' : '#FFFFFF',
                      color: isSelected ? '#FFFFFF' : '#475569',
                      fontSize: '11px',
                      fontWeight: isSelected ? '700' : '500',
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={terms}
              onChange={(e) => {
                setTerms(e.target.value);
                if (selectedTermsPreset !== '') setSelectedTermsPreset('');
              }}
              rows={6}
              placeholder="Select a preset above or freely type custom quotation Terms & Conditions..."
              style={{
                width: '100%',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                padding: '12px 14px',
                fontSize: '12px',
                lineHeight: '1.6',
                color: '#1E293B',
                boxSizing: 'border-box',
                outline: 'none',
                resize: 'vertical',
                backgroundColor: '#FAFBFC'
              }}
            />

          </div>
        </div>

        {/* SIDE-BY-SIDE SECTIONS: 5 (OUR COMPANY BANK ACCOUNT DETAILS) & 6 (FINANCIAL SUMMARY & COMMERCIAL TOTALS) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', alignItems: 'stretch' }}>
          
          {/* SECTION 5: OUR COMPANY BANK ACCOUNT DETAILS */}
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                    5
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Landmark size={16} style={{ color: '#0E7490' }} /> VRM OFFICIAL COMMERCIAL BANK DETAILS
                  </h3>
                </div>
                <span style={{ fontSize: '10px', fontWeight: '700', backgroundColor: '#ECFDF5', color: '#0E7490', border: '1px solid #A5F3FC', padding: '3px 9px', borderRadius: '6px' }}>
                  RTGS / NEFT / IMPS
                </span>
              </div>

              {/* Dedicated Banking Card Layout */}
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Beneficiary Name Banner */}
                <div style={{ paddingBottom: '10px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Beneficiary Name</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>VRM Structures India Private Limited</div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '6px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={13} /> Verified
                  </span>
                </div>

                {/* Bank Name & Account Type Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Bank Name</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginTop: '2px' }}>HDFC Bank</div>
                  </div>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Account Type</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginTop: '2px' }}>Current Account</div>
                  </div>
                </div>

                {/* Account Number & IFSC with Copy Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#0284C7', fontWeight: '700', textTransform: 'uppercase' }}>Account Number</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0369A1', fontFamily: 'monospace', letterSpacing: '0.5px', marginTop: '2px' }}>50200031629272</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyBankDetail('50200031629272', 'Account Number')}
                      title="Copy Account Number"
                      style={{ border: '1px solid #BAE6FD', backgroundColor: '#F0F9FF', color: '#0284C7', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {copiedBankField === 'Account Number' ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                    </button>
                  </div>

                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#0284C7', fontWeight: '700', textTransform: 'uppercase' }}>IFSC Code</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0369A1', fontFamily: 'monospace', letterSpacing: '0.5px', marginTop: '2px' }}>HDFC0007315</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyBankDetail('HDFC0007315', 'IFSC Code')}
                      title="Copy IFSC Code"
                      style={{ border: '1px solid #BAE6FD', backgroundColor: '#F0F9FF', color: '#0284C7', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {copiedBankField === 'IFSC Code' ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Branch Location */}
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span><strong>Branch:</strong> Vinayagapuram Branch</span>
                  <span style={{ color: '#64748B', fontSize: '10px' }}>Settlement: INR (₹)</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: '#64748B', padding: '10px 12px', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={15} style={{ color: '#0E7490', flexShrink: 0 }} />
              <span>Please transfer advance & milestone payments directly to this verified company account.</span>
            </div>
          </div>

          {/* SECTION 6: FINANCIAL SUMMARY & COMMERCIAL TOTALS */}
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '20px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                  6
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  FINANCIAL SUMMARY & COMMERCIAL TOTALS
                </h3>
              </div>

              {/* Subtotals Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                {totals.kitSubtotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '8px 12px', borderRadius: '8px' }}>
                    <span style={{ fontWeight: '700' }}>Preset Kits Subtotal</span>
                    <strong style={{ color: '#0E7490' }}>₹{totals.kitSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748B' }}>
                  <span>Taxable Subtotal (Before GST)</span>
                  <strong style={{ color: '#0F172A' }}>₹{totals.sub.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748B', fontSize: '12px' }}>
                  <span>CGST (9%)</span>
                  <span style={{ color: '#475569', fontWeight: '600' }}>₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748B', fontSize: '12px' }}>
                  <span>SGST (9%)</span>
                  <span style={{ color: '#475569', fontWeight: '600' }}>₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '8px 12px', borderRadius: '8px' }}>
                  <span>Total Applicable GST (18%)</span>
                  <span>₹{totals.gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0F172A', fontSize: '18px', fontWeight: '800', borderTop: '2px solid #E2E8F0', paddingTop: '12px', marginTop: '4px' }}>
                  <span>Grand Total (Incl. GST)</span>
                  <span style={{ color: '#0E7490' }}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setQuoteConfirmModal('cancel')}
                style={{ border: '1px solid #CBD5E1', background: 'white', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', color: '#475569', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const validation = validateQuotationForm();
                  if (!validation.isValid) {
                    setValidationAlert({
                      fields: validation.missingList.map(m => typeof m === 'object' ? (m.name || m.field) : m),
                      firstTargetId: validation.missingList[0]?.targetId
                    });
                    return;
                  }
                  setQuoteConfirmModal('create');
                }}
                style={{ border: 'none', background: '#10B981', color: 'white', padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <CheckCircle style={{ width: '16px', height: '16px' }} />
                <span>{editingQuoteId ? 'Save & Send Revision →' : 'Create Quotation →'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* CONFIRMATION / SUBMISSION MODAL */}
        {quoteConfirmModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', maxWidth: '440px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: quoteConfirmModal === 'cancel' ? '#FEE2E2' : '#ECFEFF', color: quoteConfirmModal === 'cancel' ? '#DC2626' : '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {quoteConfirmModal === 'cancel' ? <AlertTriangle style={{ width: '20px', height: '20px' }} /> : <Layers style={{ width: '20px', height: '20px' }} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                    {quoteConfirmModal === 'cancel' ? 'Discard Quotation?' : (editingQuoteId ? 'Confirm & Send Revision?' : 'Confirm & Create Quotation?')}
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>
                    {quoteConfirmModal === 'cancel'
                      ? 'Are you sure you want to cancel? Any unsaved changes in this proposal form will be lost.'
                      : `Are you sure you want to finalize and save Commercial Quotation (${quoteCode})?`}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setQuoteConfirmModal(null)}
                  style={{ border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const mode = quoteConfirmModal;
                    setQuoteConfirmModal(null);
                    if (mode === 'cancel') {
                      setShowBOMQuoteForm(false);
                    } else if (mode === 'create') {
                      handleSaveQuotationRecord('Sent');
                    }
                  }}
                  style={{
                    border: 'none',
                    backgroundColor: quoteConfirmModal === 'cancel' ? '#DC2626' : '#0E7490',
                    color: 'white',
                    padding: '9px 20px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  {quoteConfirmModal === 'cancel' ? 'Yes, Discard' : 'Confirm & Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOM MANDATORY VALIDATION MODAL (MATCHING PO CREATION POPUP) */}
        {validationAlert && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
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
                  {(validationAlert.fields || []).map((field, idx) => (
                    <li key={idx}><strong>{field}</strong></li>
                  ))}
                </ul>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  onClick={() => {
                    const targetId = validationAlert.firstTargetId;
                    setValidationAlert(null);
                    if (targetId) {
                      setTimeout(() => {
                        const el = document.getElementById(targetId);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          el.focus?.();
                        }
                      }, 100);
                    }
                  }}
                  style={{ backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)' }}
                >
                  OK, I'll fill it
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // =========================================================================
  // VIEW 2: STANDARD QUOTATIONS TABLE (ACTIONS COLUMN REMOVED)
  // =========================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ─── CUSTOM TOAST NOTIFICATION (MATCHING SYSTEM-WIDE NOTIFICATIONS) ─── */}
      {toastMessage && (
        <NotificationToast
          alert={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* 1. TOP HEADER WITH CREATE BUTTON MATCHING BOM PAGE */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            {pageConfig.title}
          </h2>
          <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
            {pageConfig.subtitle}
          </span>
        </div>
        <button
          onClick={handleOpenCreateForm}
          style={{
            backgroundColor: '#0E7490',
            border: 'none',
            color: '#FFFFFF',
            height: '40px',
            padding: '0 6px 0 20px',
            borderRadius: '50px',
            fontSize: '13px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(14, 116, 144, 0.2)',
            transition: 'all 0.2s ease'
          }}
        >
          <span>{pageConfig.actionText}</span>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0E7490'
          }}>
            <Plus size={16} strokeWidth={3} />
          </div>
        </button>
      </div>

      {/* 2. FILTERS & SEARCH ROW MATCHING BOM PAGE */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '12px 16px', backgroundColor: '#fafbfc', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center', width: '100%', boxSizing: 'border-box', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#f8fafc', width: '380px' }}>
          <Search style={{ width: '15px', height: '15px', color: '#64748b' }} />
          <input
            type="text"
            placeholder={pageConfig.searchPlaceholder}
            value={searchQueryText}
            onChange={(e) => { setSearchQueryText(e.target.value); setCurrentPage(1); }}
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: 'white' }}>
            <Calendar style={{ width: '14px', height: '14px', color: '#64748b' }} />
            <input
              type="date"
              value={filterDateVal}
              onChange={(e) => { setFilterDateVal(e.target.value); setCurrentPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#334155', backgroundColor: 'transparent' }}
            />
          </div>

          <button
            onClick={() => { setSearchQueryText(''); setFilterDateVal(''); setActiveSubTab('All'); setCurrentPage(1); }}
            title="Clear Filters"
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              height: '38px',
              width: '38px'
            }}
          >
            <RotateCcw style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </div>

      {/* 3. STATUS SUB-TABS ROW MATCHING BOM PAGE */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '20px', padding: '4px 0', alignItems: 'center', flexWrap: 'wrap' }}>
        {pageConfig.tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveSubTab(tab.id); setCurrentPage(1); }}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '10px 4px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: activeSubTab === tab.id ? '#0E7490' : '#64748b',
              borderBottom: activeSubTab === tab.id ? '2px solid #0E7490' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {tab.label}
            <span style={{
              fontSize: '10px',
              padding: '2px 7px',
              borderRadius: '12px',
              backgroundColor: tab.bg,
              color: tab.fg,
              fontWeight: 'bold'
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 4. MAIN DATA TABLE (ACTIONS COLUMN REMOVED PER SPECIFICATION) */}
      <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="custom-table" style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                  <input
                    type="checkbox"
                    style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                    checked={filteredRows.length > 0 && filteredRows.every(r => selectedRows.includes(r.code))}
                    onChange={handleSelectAll}
                  />
                </th>
                <th style={{ width: '140px', minWidth: '140px', padding: '12px 14px', fontWeight: 'bold' }}>Quote #</th>
                <th style={{ width: '120px', minWidth: '120px', padding: '12px 14px', fontWeight: 'bold' }}>Date</th>
                <th style={{ minWidth: '220px', padding: '12px 14px', fontWeight: 'bold' }}>Customer Name</th>
                <th style={{ minWidth: '180px', padding: '12px 14px', fontWeight: 'bold' }}>Structure Scope</th>
                <th style={{ width: '150px', minWidth: '150px', padding: '12px 14px', fontWeight: 'bold' }}>Sales Rep</th>
                <th style={{ width: '140px', minWidth: '140px', padding: '12px 14px', fontWeight: 'bold', textAlign: 'right' }}>Total (₹)</th>
                <th style={{ width: '140px', minWidth: '140px', padding: '12px 14px', fontWeight: 'bold', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {currentRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                    No quotations found matching your criteria.
                  </td>
                </tr>
              ) : (
                currentRows.map((row, idx) => {
                  const isChecked = selectedRows.includes(row.code);
                  return (
                    <tr
                      key={row.code || idx}
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
                          boxSizing: 'border-box',
                          borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                        }}
                      >
                        <input
                          type="checkbox"
                          style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                          checked={isChecked}
                          onChange={() => handleSelectRow(row.code)}
                        />
                      </td>
                      <td
                        onClick={() => setSelectedQuote(row)}
                        style={{ padding: '12px 14px', fontWeight: 'bold', color: '#0E7490' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{row.code}</span>
                          {row.revCount > 0 && (
                            <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', fontSize: '10px', padding: '1px 6px', borderRadius: '8px', fontWeight: '800' }}>
                              R{row.revCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        onClick={() => setSelectedQuote(row)}
                        style={{ padding: '12px 14px', color: '#64748B' }}
                      >
                        {row.date}
                      </td>
                      <td 
                        onClick={() => setSelectedQuote(row)}
                        style={{ padding: '12px 14px', fontWeight: '700', color: '#0F172A' }}
                      >
                        {row.customer}
                      </td>
                      <td 
                        onClick={() => setSelectedQuote(row)}
                        style={{ padding: '12px 14px', color: '#334155' }}
                      >
                        {row.structure}
                      </td>
                      <td 
                        onClick={() => setSelectedQuote(row)}
                        style={{ padding: '12px 14px', color: '#0E7490', fontWeight: '700', fontSize: '12px' }}
                      >
                        <span style={{ backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <User size={13} style={{ color: '#0E7490' }} /> {row.salesRep}
                        </span>
                      </td>
                      <td 
                        onClick={() => setSelectedQuote(row)}
                        style={{ padding: '12px 14px', fontWeight: 'bold', color: '#0F172A', textAlign: 'right' }}
                      >
                        {row.formattedTotal}
                      </td>
                      <td 
                        onClick={() => setSelectedQuote(row)}
                        style={{ padding: '12px 14px', textAlign: 'center' }}
                      >
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span style={{
                            backgroundColor: row.stBg,
                            color: row.stFg,
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            border: row.stBorder
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: row.stFg }}></span>
                            {row.status}
                          </span>
                          {row.convertedPiNo && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', { 
                                  detail: { tab: 'Performa Invoice', targetPi: row.convertedPiNo } 
                                }));
                                if (typeof onNavigateTab === 'function') {
                                  onNavigateTab('Performa Invoice');
                                }
                              }}
                              title={`Converted to Proforma Invoice ${row.convertedPiNo} - Click to view PI`}
                              style={{
                                backgroundColor: '#0E7490',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                fontSize: '10.5px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                boxShadow: '0 1px 2px rgba(14,116,144,0.3)'
                              }}
                            >
                              🔗 {row.convertedPiNo} ↗
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. PAGINATION FOOTER EXACT RULES */}
        {filteredRows.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', fontSize: '13px', color: '#64748B', borderTop: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Showing per page</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  style={{ height: '32px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', padding: '0 8px', backgroundColor: 'white', fontWeight: 'bold' }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </div>
              <span>Showing {filteredRows.length === 0 ? 0 : indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredRows.length)} of {filteredRows.length} entries</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                  style={{ border: '1px solid #E2E8F0', background: currentPage === 1 ? '#F8FAFC' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
                >
                  &laquo;
                </button>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  style={{ border: '1px solid #E2E8F0', background: currentPage === 1 ? '#F8FAFC' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                >
                  &lt;
                </button>

                {(() => {
                  let start = Math.max(1, currentPage - 1);
                  let end = start + 2;
                  if (end > totalPages) {
                    end = totalPages;
                    start = Math.max(1, end - 2);
                  }
                  return Array.from({ length: Math.max(1, end - start + 1) }, (_, i) => start + i).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      style={{
                        border: '1px solid #E2E8F0',
                        background: page === currentPage ? '#0E7490' : 'white',
                        color: page === currentPage ? 'white' : '#475569',
                        cursor: 'pointer',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: page === currentPage ? 'bold' : '500'
                      }}
                    >
                      {page}
                    </button>
                  ));
                })()}

                <button
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  style={{ border: '1px solid #E2E8F0', background: (currentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                >
                  &gt;
                </button>
                <button
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(totalPages)}
                  style={{ border: '1px solid #E2E8F0', background: (currentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
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
                  defaultValue={currentPage}
                  id="crm-quotations-goto-page-input"
                  style={{ width: '42px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}
                />
                <button
                  onClick={() => {
                    const val = parseInt(document.getElementById('crm-quotations-goto-page-input')?.value || '1', 10);
                    if (val >= 1 && val <= totalPages) setCurrentPage(val);
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

      {/* 6. FLOATING BOTTOM ACTION BAR FOR SELECTED ROWS WITH "CONVERT TO PI" */}
      {selectedRows.length > 0 && (
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
          fontFamily: "'DM Sans', sans-serif"
        }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px', paddingRight: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedRows.length}</strong> Selected
          </span>

          {/* View Details */}
          <button
            onClick={() => {
              if (selectedRows.length === 1) {
                const target = normalizedQuotes.find(q => q.code === selectedRows[0]);
                setSelectedRows([]);
                if (target) setSelectedQuote(target);
              } else {
                alert('Viewing multiple items is not supported. Please select a single quotation.');
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
              flexShrink: 0
            }}
          >
            <Eye size={14} style={{ color: '#0E7490' }} /> View
          </button>

          {/* Edit / Revise Quote */}
          <button
            onClick={() => {
              if (selectedRows.length === 1) {
                const target = normalizedQuotes.find(q => q.code === selectedRows[0]);
                setSelectedRows([]);
                if (target) handleStartEditQuote(target);
              } else {
                alert('Editing multiple quotations at once is not supported.');
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
              flexShrink: 0
            }}
          >
            <Edit3 size={14} style={{ color: '#2563EB' }} /> Edit / Revise
          </button>

          {/* Send Quote Template Button */}
          <button
            onClick={() => {
              if (selectedRows.length === 1) {
                const target = normalizedQuotes.find(q => q.code === selectedRows[0]);
                setSelectedRows([]);
                if (target) handleOpenSendQuoteModal(target, 'WhatsApp');
              } else {
                alert('Sending quote template is supported for one quotation at a time. Please select a single quotation.');
              }
            }}
            style={{
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              color: '#16A34A',
              borderRadius: '10px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            <Send size={14} style={{ color: '#16A34A' }} /> Send Quote
          </button>

          {/* Convert to PI Button */}
          <button
            onClick={() => {
              if (selectedRows.length === 1) {
                const target = normalizedQuotes.find(q => q.code === selectedRows[0]);
                setSelectedRows([]);
                if (target) handleConvertToPI(target);
              } else {
                alert('Converting multiple quotations to PI at once is not supported. Please select one quotation.');
              }
            }}
            style={{
              backgroundColor: '#0E7490',
              border: 'none',
              color: 'white',
              borderRadius: '10px',
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)'
            }}
          >
            <ArrowRight size={14} /> Convert to PI
          </button>

          {/* Delete */}
          <button
            onClick={async () => {
              if (window.confirm(`Are you sure you want to delete ${selectedRows.length} selected quotation(s)?`)) {
                const updatedQuotes = quotations.filter(q => !selectedRows.includes(q.quoteNumber || q.id));
                await saveCloudStoreImmediate('crm_quotations', updatedQuotes);
                setSelectedRows([]);
                window.dispatchEvent(new CustomEvent('controlroom_crm_update', { detail: { key: 'quotations', count: updatedQuotes.length } }));
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
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
              flexShrink: 0
            }}
          >
            <Trash2 size={14} style={{ color: '#DC2626' }} /> Delete
          </button>

          <div style={{ height: '18px', width: '1px', backgroundColor: '#E2E8F0', margin: '0 2px', flexShrink: 0 }} />

          <button
            onClick={() => setSelectedRows([])}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              flexShrink: 0
            }}
            title="Deselect all"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 7. QUOTATION PREVIEW & DETAIL MODAL (WITH CONVERT TO PI BUTTON) */}
      {selectedQuote && typeof document !== 'undefined' && createPortal(
        <div
          className="quote-modal-overlay"
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
        >
          <div
            id="quotation-printable-modal"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '820px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '32px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #E2E8F0'
            }}
          >
            <style>{`
              @page {
                size: A4 portrait;
                margin: 12mm 14mm 12mm 14mm !important; /* 4-side clean margin on every page */
              }
              @media print {
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  height: auto !important;
                  min-height: 100% !important;
                  overflow: visible !important;
                  background: #ffffff !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                #root,
                .no-print,
                .quote-modal-overlay > .no-print {
                  display: none !important;
                }
                .quote-modal-overlay {
                  position: static !important;
                  display: block !important;
                  width: 100% !important;
                  height: auto !important;
                  min-height: auto !important;
                  overflow: visible !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: transparent !important;
                  backdrop-filter: none !important;
                  z-index: auto !important;
                }
                #quotation-printable-modal {
                  position: static !important;
                  display: block !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  max-height: none !important;
                  height: auto !important;
                  overflow: visible !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  box-shadow: none !important;
                  border: none !important;
                  border-radius: 0 !important;
                  background: #ffffff !important;
                }
                table {
                  page-break-inside: auto !important;
                  break-inside: auto !important;
                  width: 100% !important;
                }
                thead {
                  display: table-header-group !important;
                }
                tfoot {
                  display: table-footer-group !important;
                }
                tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  page-break-after: auto !important;
                  break-after: auto !important;
                }
                .avoid-break {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
              }
            `}</style>
            {/* Header / Brand */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0E7490', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A', margin: 0 }}>
                  VRM STRUCTURES INDIA PVT LTD
                </h2>
                <p style={{ fontSize: '11px', color: '#64748B', margin: '4px 0 0' }}>
                  Solar Module Mounting Structures (MMS) Manufacturer
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#0E7490' }}>
                  {selectedQuote.code || selectedQuote.quoteNumber}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>Date: {selectedQuote.date || new Date().toLocaleDateString()}</div>
                {selectedQuote.revCount > 0 && (
                  <span style={{ fontSize: '10px', fontWeight: '800', color: '#B45309', backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '8px', display: 'inline-block', marginTop: '2px' }}>
                    Revision #{selectedQuote.revCount}
                  </span>
                )}
              </div>
            </div>

            {/* Customer Details */}
            <div style={{ marginBottom: '20px', fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div><strong>Prepared For:</strong> {selectedQuote.customer || selectedQuote.customerName}</div>
              <div><strong>Structure Scope:</strong> {selectedQuote.structure || selectedQuote.structureType}</div>
              <div><strong>Sales Representative:</strong> {selectedQuote.salesRep || selectedQuote.salesPerson}</div>
              {selectedQuote.phone && <div><strong>Contact:</strong> {selectedQuote.phone}</div>}
              {selectedQuote.paymentTerms && <div><strong>Payment Terms:</strong> {selectedQuote.paymentTerms}</div>}
              {selectedQuote.deliveryAddress && <div><strong>Delivery Address:</strong> {selectedQuote.deliveryAddress}</div>}
            </div>

            {/* Items with Consolidated Preset Kit Pricing (No ₹0 rows) */}
            {(() => {
              const quoteItemsList = selectedQuote.items || [];
              const rawPresetGroups = selectedQuote.presetGroups || {};
              const groupMeta = {};
              quoteItemsList.forEach((it, idx) => {
                if (it.isPresetItem || it.presetGroupId) {
                  const gid = it.presetGroupId || 'default_preset';
                  if (!groupMeta[gid]) {
                    const savedGrp = (typeof rawPresetGroups === 'object' && !Array.isArray(rawPresetGroups) && rawPresetGroups[gid])
                      || (Array.isArray(rawPresetGroups) && rawPresetGroups.find(g => g.groupId === gid))
                      || null;
                    const name = it.presetName || (savedGrp && savedGrp.presetName) || 'Pre-Engineered MMS Kit Package';
                    const setCount = (savedGrp && parseInt(savedGrp.setCount)) || 1;
                    const kitPrice = savedGrp && savedGrp.kitPrice !== undefined ? parseFloat(savedGrp.kitPrice) : (parseFloat(selectedQuote.kitSubtotal) || 0);
                    groupMeta[gid] = {
                      groupId: gid,
                      name,
                      setCount,
                      kitPrice,
                      totalAmount: kitPrice * setCount,
                      itemsCount: 0,
                      firstIndex: idx
                    };
                  }
                  groupMeta[gid].itemsCount += 1;
                }
              });

              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '20px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '10px', textAlign: 'left', fontWeight: '700', color: '#475569' }}>Item Description</th>
                      <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>Qty</th>
                      <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>Rate (₹)</th>
                      <th style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: '#475569' }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteItemsList.map((it, idx) => {
                      const itQty = Number(it.qty || 0);
                      const itRate = Number(it.rate || 0);
                      const itAmt = Number(it.amount || (itQty * itRate));
                      const isPreset = Boolean(it.isPresetItem || it.presetGroupId);
                      const gid = isPreset ? (it.presetGroupId || 'default_preset') : null;
                      const gInfo = gid ? groupMeta[gid] : null;
                      const isFirstInGroup = gInfo && gInfo.firstIndex === idx;

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: isPreset ? '#FBFDFF' : 'transparent' }}>
                          <td style={{ padding: '10px', color: '#0F172A', fontWeight: isPreset ? '500' : '600' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {isPreset && (
                                <span style={{ fontSize: '10px', backgroundColor: '#E0F2FE', color: '#0369A1', fontWeight: '700', padding: '1px 6px', borderRadius: '4px' }}>
                                  KIT COMPONENT
                                </span>
                              )}
                              <span>{it.name || it.description}</span>
                            </div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#334155' }}>
                            {itQty} {it.unit || it.uom || 'NOS'}
                          </td>
                          {isPreset ? (
                            isFirstInGroup ? (
                              <td
                                rowSpan={gInfo.itemsCount}
                                style={{
                                  padding: '10px',
                                  textAlign: 'right',
                                  verticalAlign: 'middle',
                                  backgroundColor: '#F0FDFA',
                                  borderLeft: '1px solid #CCFBF1',
                                  borderRight: '1px solid #CCFBF1'
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                  <span style={{ fontSize: '10px', fontWeight: '800', color: '#0E7490', backgroundColor: '#CCFBF1', padding: '2px 6px', borderRadius: '4px' }}>
                                    {gInfo.setCount} Set{gInfo.setCount > 1 ? 's' : ''} Kit
                                  </span>
                                  <span style={{ fontWeight: '800', color: '#0E7490', fontSize: '13px' }}>
                                    ₹ {gInfo.kitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </td>
                            ) : null
                          ) : (
                            <td style={{ padding: '10px', textAlign: 'right', color: '#334155' }}>
                              ₹ {itRate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          )}
                          {isPreset ? (
                            isFirstInGroup ? (
                              <td
                                rowSpan={gInfo.itemsCount}
                                style={{
                                  padding: '10px',
                                  textAlign: 'right',
                                  verticalAlign: 'middle',
                                  fontWeight: '800',
                                  color: '#0E7490',
                                  fontSize: '13px',
                                  backgroundColor: '#F0FDFA'
                                }}
                              >
                                ₹ {gInfo.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                            ) : null
                          ) : (
                            <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                              ₹ {itAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}

            {/* Terms and Conditions Preview (Dynamic PO Style) */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  TERMS AND CONDITIONS
                </h4>
                {selectedQuote.termsPresetKey && (
                  <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', padding: '2px 8px', borderRadius: '6px' }}>
                    Preset: {QUOTATION_TERMS_PRESETS.find(p => p.key === selectedQuote.termsPresetKey)?.label || 'Custom'}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#334155',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '12px 14px'
              }}>
                {selectedQuote.terms || selectedQuote.notes || (
                  `1. Validity: 15 days from quote date; prices subject to aluminium/steel index escalation thereafter.\n` +
                  `2. Payment: 50% advance with order / PI, balance 50% before material dispatch from plant.\n` +
                  `3. Delivery: 7–10 working days from advance & drawing approvals. Transit insurance by consignee.\n` +
                  `4. Taxes: GST 18% extra as applicable at time of invoicing.\n` +
                  `5. Warranty: 10 Years limited structural warranty for 6063 T6 anodized rails & SS304 hardware.\n` +
                  `6. Freight: On to-pay basis or as agreed. Unloading at site is in customer's scope.`
                )}
              </div>
              {selectedQuote.notes && selectedQuote.terms && selectedQuote.notes !== selectedQuote.terms && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #CBD5E1', fontSize: '11px', color: '#334155' }}>
                  <strong>Special Conditions / Remarks:</strong> {selectedQuote.notes}
                </div>
              )}
            </div>

            {/* SIDE-BY-SIDE: BANK ACCOUNT DETAILS (LEFT) & FINANCIAL SUMMARY TOTALS (RIGHT) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px', alignItems: 'stretch' }}>
              
              {/* Company Bank Account Details Card in Preview */}
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #BAE6FD', borderRadius: '12px', padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#0369A1', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Landmark size={15} style={{ color: '#0284C7' }} /> VRM OFFICIAL COMMERCIAL BANK DETAILS
                    </h4>
                    <span style={{ fontSize: '10px', fontWeight: '700', backgroundColor: '#E0F2FE', color: '#0284C7', padding: '2px 8px', borderRadius: '6px', border: '1px solid #BAE6FD' }}>
                      RTGS / NEFT / IMPS
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#64748B', fontWeight: '600' }}>Beneficiary Name:</span>
                      <strong style={{ color: '#0F172A' }}>VRM Structures India Private Limited</strong>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px' }}>
                        <div style={{ color: '#64748B', fontSize: '10px', fontWeight: '600' }}>Bank Name:</div>
                        <strong style={{ color: '#0F172A', fontSize: '12px' }}>HDFC Bank</strong>
                      </div>
                      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px' }}>
                        <div style={{ color: '#64748B', fontSize: '10px', fontWeight: '600' }}>Account Type:</div>
                        <strong style={{ color: '#0F172A', fontSize: '12px' }}>Current Account</strong>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ color: '#0284C7', fontSize: '10px', fontWeight: '700' }}>Account Number:</div>
                          <strong style={{ color: '#0369A1', fontFamily: 'monospace', fontSize: '13px' }}>50200031629272</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyBankDetail('50200031629272', 'Account Number')}
                          title="Copy Account Number"
                          style={{ border: '1px solid #BAE6FD', backgroundColor: '#F0F9FF', color: '#0284C7', padding: '4px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          {copiedBankField === 'Account Number' ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                        </button>
                      </div>

                      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ color: '#0284C7', fontSize: '10px', fontWeight: '700' }}>IFSC Code:</div>
                          <strong style={{ color: '#0369A1', fontFamily: 'monospace', fontSize: '13px' }}>HDFC0007315</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyBankDetail('HDFC0007315', 'IFSC Code')}
                          title="Copy IFSC Code"
                          style={{ border: '1px solid #BAE6FD', backgroundColor: '#F0F9FF', color: '#0284C7', padding: '4px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          {copiedBankField === 'IFSC Code' ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 10px', color: '#475569', fontSize: '11px' }}>
                      <strong>Branch:</strong> Vinayagapuram Branch
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '10.5px', color: '#0369A1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={14} style={{ color: '#0284C7', flexShrink: 0 }} />
                  <span>Official Verified Account for Advance & Settlement Payments</span>
                </div>
              </div>

              {/* Financial Summary & Commercial Totals Card on Right */}
              <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    FINANCIAL SUMMARY & COMMERCIAL TOTALS
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#64748B' }}>
                      <span>Taxable Subtotal:</span>
                      <strong style={{ color: '#0F172A' }}>₹ {Number(selectedQuote.taxableAmount || selectedQuote.subtotal || selectedQuote.numericTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    {selectedQuote.gstTotal ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#64748B' }}>
                        <span>Applicable GST (18%):</span>
                        <strong style={{ color: '#0F172A' }}>₹ {Number(selectedQuote.gstTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #E2E8F0', marginTop: '6px' }}>
                      <span style={{ fontWeight: '800', color: '#0F172A', fontSize: '14px' }}>Grand Total (Incl. GST):</span>
                      <strong style={{ fontWeight: '800', color: '#0E7490', fontSize: '17px' }}>
                        {selectedQuote.formattedTotal || `₹ ${Number(selectedQuote.grandTotal || selectedQuote.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                      </strong>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '12px', padding: '8px 10px', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: '8px', fontSize: '11px', color: '#0F766E' }}>
                  Rates quoted are inclusive of engineering & manufacturing scope as detailed above.
                </div>
              </div>
            </div>

            {/* Bottom Actions Modal */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    const q = selectedQuote;
                    setSelectedQuote(null);
                    handleStartEditQuote(q);
                  }}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#1E293B', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Edit3 size={14} style={{ color: '#2563EB' }} /> Edit / Revise Quote
                </button>
                <button
                  onClick={() => handleOpenSendQuoteModal(selectedQuote, 'WhatsApp')}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #16A34A', backgroundColor: '#F0FDF4', color: '#16A34A', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 2px rgba(22,163,74,0.1)' }}
                >
                  <Send size={14} style={{ color: '#16A34A' }} /> Send Quote Template
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => window.print()}
                  style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={14} /> Print PDF
                </button>
                <button
                  onClick={() => handleConvertToPI(selectedQuote)}
                  style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <ArrowRight size={14} /> Convert to PI
                </button>
                <button
                  onClick={() => setSelectedQuote(null)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#0F172A', color: '#FFFFFF', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 8. EDITABLE QUOTATION SENDING TEMPLATE MODAL */}
      {sendQuoteModalData && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '720px',
            maxHeight: '92vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
            border: '1px solid #CBD5E1',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A' }}>
                    <Send size={18} />
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A', margin: 0 }}>
                    Send Quotation to Client
                  </h3>
                </div>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 40px' }}>
                  Select an official template, review or edit the wording freely, and dispatch via WhatsApp or Email.
                </p>
              </div>
              <button
                onClick={() => setSendQuoteModalData(null)}
                style={{ border: 'none', background: '#F1F5F9', color: '#64748B', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quote Summary Pill */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '12px 18px', borderRadius: '12px', border: '1px solid #E2E8F0', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '12px' }}>
                <span style={{ color: '#64748B' }}>Quotation: </span>
                <strong style={{ color: '#0E7490', fontWeight: '800' }}>{sendQuoteModalData.code || sendQuoteModalData.quoteNumber}</strong>
                <span style={{ margin: '0 8px', color: '#CBD5E1' }}>|</span>
                <span style={{ color: '#64748B' }}>Client: </span>
                <strong style={{ color: '#0F172A' }}>{sendQuoteModalData.customer || sendQuoteModalData.customerName}</strong>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0E7490' }}>
                {sendQuoteModalData.formattedTotal || `₹ ${Number(sendQuoteModalData.grandTotal || 0).toLocaleString()}`}
              </div>
            </div>

            {/* Channel Switcher */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                Choose Dispatch Channel
              </label>
              <div style={{ display: 'inline-flex', gap: '8px', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSendChannel('WhatsApp');
                    setRecipientContact(sendQuoteModalData.phone || '+91 98765 43210');
                  }}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: sendChannel === 'WhatsApp' ? '#16A34A' : 'transparent',
                    color: sendChannel === 'WhatsApp' ? '#FFFFFF' : '#475569',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <MessageSquare size={14} /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSendChannel('Email');
                    setRecipientContact(sendQuoteModalData.email || 'procurement@client.com');
                  }}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: sendChannel === 'Email' ? '#0E7490' : 'transparent',
                    color: sendChannel === 'Email' ? '#FFFFFF' : '#475569',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Mail size={14} /> Official Email
                </button>
              </div>
            </div>

            {/* Template Presets Picker */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                Select Message Template Preset
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {QUOTE_SENDING_TEMPLATES.map((tmpl) => {
                  const isSelected = activeSendTemplateKey === tmpl.key;
                  return (
                    <div
                      key={tmpl.key}
                      onClick={() => handleSelectSendTemplate(tmpl.key)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: isSelected ? '1.5px solid #0E7490' : '1px solid #E2E8F0',
                        backgroundColor: isSelected ? '#F0FDFA' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? '0 2px 6px rgba(14,116,144,0.1)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: isSelected ? '800' : '600', color: isSelected ? '#0E7490' : '#1E293B' }}>
                          {tmpl.title}
                        </span>
                        {isSelected && <Check size={14} style={{ color: '#0E7490' }} />}
                      </div>
                      <span style={{ fontSize: '10px', color: '#64748B', display: 'block', marginTop: '3px' }}>
                        Channel: {tmpl.channel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recipient Input */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                {sendChannel === 'WhatsApp' ? 'WhatsApp Phone Number' : 'Recipient Email Address'}
              </label>
              <input
                type="text"
                value={recipientContact}
                onChange={(e) => setRecipientContact(e.target.value)}
                placeholder={sendChannel === 'WhatsApp' ? '+91 98765 43210' : 'procurement@client.com'}
                style={{
                  width: '100%',
                  height: '40px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  padding: '0 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#1E293B',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            {/* If Email, show editable Subject */}
            {sendChannel === 'Email' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={editableEmailSubject}
                  onChange={(e) => setEditableEmailSubject(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    padding: '0 14px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#1E293B',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>
            )}

            {/* Editable Template Message Body */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                  Message Content (Fully Editable)
                </label>
                <span style={{ fontSize: '11px', color: '#64748B' }}>
                  Feel free to edit or add custom remarks before sending
                </span>
              </div>
              <textarea
                rows={10}
                value={editableMessageBody}
                onChange={(e) => setEditableMessageBody(e.target.value)}
                style={{
                  width: '100%',
                  borderRadius: '12px',
                  border: '1px solid #CBD5E1',
                  padding: '14px',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                  lineHeight: '1.6',
                  color: '#1E293B',
                  boxSizing: 'border-box',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: '180px',
                  backgroundColor: '#FAFBFC'
                }}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setSendQuoteModalData(null)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExecuteSendQuote}
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: sendChannel === 'WhatsApp' ? '#16A34A' : '#0E7490',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: sendChannel === 'WhatsApp' ? '0 4px 12px rgba(22,163,74,0.3)' : '0 4px 12px rgba(14,116,144,0.3)'
                }}
              >
                <Send size={15} />
                <span>{sendChannel === 'WhatsApp' ? 'Send via WhatsApp →' : 'Send via Email →'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
