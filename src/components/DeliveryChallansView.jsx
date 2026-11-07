import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Truck, Search, Plus, Filter, Calendar, ChevronDown, ChevronLeft, ChevronRight,
  Eye, Edit3, Trash2, Printer, FileText, CheckCircle, Clock, AlertCircle, Ban,
  Building2, ArrowLeft, ArrowRight, Send, Check, X, Shield, RefreshCw, RotateCcw,
  Upload, Download, Layers, Package, DollarSign, HelpCircle, Paperclip, ChevronUp,
  Boxes, MapPin, AlertTriangle, ExternalLink, Settings
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import ModernDateRangePicker from './ModernDateRangePicker';
import { centralInventoryStore } from '../utils/centralInventoryStore';
import { saveCloudStore, fetchCloudStore } from '../utils/supabaseDataSync';
import { getNextSequence } from '../utils/sequenceGenerator';
import { getHsnCode } from '../utils/hsnCodeService';
import { parseAddressString, formatAddressObj, getVendorLocations } from '../utils/otherViewsShared';

// ==================== COMPANY PROFILES (OFFICIAL BUSINZ LOCATIONS) ====================
export const COMPANY_LOCATIONS = {
  'VRM Structures India Pvt Ltd': {
    name: 'VRM Structures India Pvt Ltd',
    locationLabel: 'VRM Structures India Pvt Ltd',
    address: '1427, GNT Road, Nagappa Industrial Estate, Madhavaram, Chennai, Tamil Nadu – 600066',
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

const CHALLAN_TYPES = [
  'For Job Work',
  'Supply on Approval',
  'Removal on account of other reasons',
  'Supply of Liquid Gas',
  'Others'
];

const WAREHOUSE_LOCATIONS = [
  'VRM Structures - Madhavaram Main Warehouse',
  'VRM Structures - AP Plant Warehouse',
  'Jash Sun - Kelambakkam Warehouse'
];

const TERMS_PRESETS = [
  {
    key: 'rule55',
    label: 'Standard Rule 55 CGST',
    text: '1. The goods transported under this Delivery Challan are strictly subject to Rule 55 of CGST Rules, 2017.\n2. This movement represents non-chargeable goods transit and does not constitute a sale.\n3. Goods must be inspected upon delivery and acknowledged on the consignee copy.'
  },
  {
    key: 'jobwork',
    label: 'For Job Work',
    text: '1. Goods are being sent for job work processing under Section 143 / Rule 55 of CGST Rules, 2017.\n2. Processed goods must be returned within the statutory period stipulated under GST law.\n3. Challan is valid for transit verification.'
  },
  {
    key: 'approval',
    label: 'Supply on Approval',
    text: '1. Goods are sent on an approval basis for trial and evaluation.\n2. Acceptance or return of goods shall be confirmed within 15 days of dispatch.\n3. No commercial value is payable on this transaction.'
  }
];

export default function DeliveryChallansView({ userRole = 'Procurement Head', onNavigateTab }) {
  // ==================== STATE MANAGEMENT ====================
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'create' | 'edit' | 'view'
  const [dcList, setDcList] = useState([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [selectedDCs, setSelectedDCs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dcTab, setDcTab] = useState('All');
  const [filterDate, setFilterDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [jumpToPage, setJumpToPage] = useState('');

  // Cancel Modal State
  const [cancellingDc, setCancellingDc] = useState(null);
  const [cancellationRemarkInput, setCancellationRemarkInput] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  // Active DC Record for View/Edit
  const [activeDc, setActiveDc] = useState(null);
  const [editIdx, setEditIdx] = useState(null);

  // ==================== FORM STATE ====================
  const [companyLocation, setCompanyLocation] = useState('VRM Structures India Pvt Ltd');
  const [customerName, setCustomerName] = useState('');
  const [vendorGst, setVendorGst] = useState('');
  const [dcNumber, setDcNumber] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [dcDate, setDcDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [challanType, setChallanType] = useState('Job Work');
  const [warehouseLocation, setWarehouseLocation] = useState('VRM Structures - Madhavaram Main Warehouse');
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

  const currentCustomerObj = useMemo(() => {
    return knownCustomers.find(c => c.name.toLowerCase() === (customerName || '').toLowerCase()) || null;
  }, [knownCustomers, customerName]);

  const customerLocations = useMemo(() => {
    return getVendorLocations(currentCustomerObj);
  }, [currentCustomerObj]);
  const [transporter, setTransporter] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [lrNo, setLrNo] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [selectedTermsPreset, setSelectedTermsPreset] = useState('rule55');
  const [terms, setTerms] = useState(TERMS_PRESETS[0].text);
  const [discountPct, setDiscountPct] = useState(0);
  const [adjustment, setAdjustment] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ==================== DC NUMBER PREFERENCES STATE (ZOHO STYLE) ====================
  const [showDcPrefModal, setShowDcPrefModal] = useState(false);
  const [dcNumberMode, setDcNumberMode] = useState(() => {
    try {
      return localStorage.getItem('businz_dc_number_mode') || 'auto';
    } catch (_) {
      return 'auto';
    }
  });
  const [dcPrefPrefix, setDcPrefPrefix] = useState(() => {
    try {
      return localStorage.getItem('businz_dc_pref_prefix') || 'VRMS/JW/26-27/';
    } catch (_) {
      return 'VRMS/JW/26-27/';
    }
  });
  const [dcPrefNextNum, setDcPrefNextNum] = useState(() => {
    try {
      return localStorage.getItem('businz_dc_pref_next_num') || '';
    } catch (_) {
      return '';
    }
  });
  const [tempNumberMode, setTempNumberMode] = useState('auto');
  const [tempPrefix, setTempPrefix] = useState('VRMS/JW/26-27/');
  const [tempNextNum, setTempNextNum] = useState('001');
  const [tempManualNum, setTempManualNum] = useState('');

  // Line items state
  const [items, setItems] = useState([]);

  // Bulk Item Modal
  const [showBulkItemModal, setShowBulkItemModal] = useState(false);

  // ==================== JOB WORK RETURN STATE ====================
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnDc, setReturnDc] = useState(null);
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [returnRef, setReturnRef] = useState('');
  const [returnReceivedBy, setReturnReceivedBy] = useState('');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [returnReceivedRows, setReturnReceivedRows] = useState([]);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [bulkItemSearch, setBulkItemSearch] = useState('');
  const [selectedBulkItems, setSelectedBulkItems] = useState({});

  // Dynamic suggestions: known customers
  const [knownCustomers, setKnownCustomers] = useState([]);

  // Toast / Alert notification
  const [toastAlert, setToastAlert] = useState(null);
  const showCustomAlert = (msg, title = 'Notice', type = 'info') => {
    setToastAlert({ message: msg, title, type });
    setTimeout(() => setToastAlert(null), 4000);
  };

  // ==================== LOAD DELIVERY CHALLANS ====================
  const loadDeliveryChallans = async () => {
    setTableLoading(true);
    let loaded = [];
    try {
      const localStr = localStorage.getItem('controlroom_dc_store');
      if (localStr) {
        const parsed = JSON.parse(localStr);
        if (Array.isArray(parsed)) loaded = parsed;
      }
    } catch (_) {}

    try {
      const res = await fetch('/api/deliverychallans');
      if (res.ok) {
        const serverDCs = await res.json();
        if (Array.isArray(serverDCs) && serverDCs.length > 0) {
          const map = new Map();
          loaded.forEach(d => map.set(d.dcNo || d.id || d.code, d));
          serverDCs.forEach(d => map.set(d.dcNo || d.id || d.code, { ...map.get(d.dcNo || d.id || d.code), ...d }));
          loaded = Array.from(map.values());
        }
      }
    } catch (_) {}

    // Clean mock seeded records if present
    loaded = loaded.filter(d =>
      !(d.dcNo === 'DC-2026-0001' && d.customerName === 'Tata Power Solar Systems Ltd') &&
      !(d.dcNo === 'DC-2026-0002' && d.customerName === 'Adani Solar Energy')
    );

    setDcList(loaded);
    setTableLoading(false);
  };

  useEffect(() => {
    loadDeliveryChallans();
    const handleStorageUpdate = (e) => {
      if (!e.detail || e.detail.key === 'controlroom_dc_store') {
        loadDeliveryChallans();
      }
    };
    window.addEventListener('controlroom_storage_update', handleStorageUpdate);
    return () => window.removeEventListener('controlroom_storage_update', handleStorageUpdate);
  }, []);

  // Load known customers from BOMs and customer directory
  useEffect(() => {
    const custMap = new Map();
    try {
      const rawBoms = localStorage.getItem('controlroom_bom_store');
      if (rawBoms) {
        const parsed = JSON.parse(rawBoms);
        if (Array.isArray(parsed)) {
          parsed.forEach(b => {
            const name = (b.customerName || b.vendor || b.clientName || '').trim();
            const addr = (b.deliveryAddress || b.c6 || b.billingAddress || '').trim();
            const bAddr = (b.billingAddress || b.address || '').trim();
            const gst = (b.gstNo || b.gst || '').trim();
            if (name && !custMap.has(name.toLowerCase())) {
              custMap.set(name.toLowerCase(), { name, address: addr, billingAddress: bAddr, gst });
            }
          });
        }
      }
    } catch (_) {}

    try {
      const rawCust = localStorage.getItem('controlroom_customer_store') || localStorage.getItem('crm_customers');
      if (rawCust) {
        const parsed = JSON.parse(rawCust);
        if (Array.isArray(parsed)) {
          parsed.forEach(c => {
            const name = (c.name || c.companyName || c.contact_name || '').trim();
            const addr = (c.billingAddress || c.address || '').trim();
            const gst = (c.gstNo || c.gst || '').trim();
            if (name && !custMap.has(name.toLowerCase())) {
              custMap.set(name.toLowerCase(), { name, address: addr, billingAddress: addr, gst });
            }
          });
        }
      }
    } catch (_) {}

    setKnownCustomers(Array.from(custMap.values()));
  }, []);

  // Generate next sequential DC Number (VRMS/JW/26-27/001 format or customized preference)
  const fetchNextDcNumber = () => {
    try {
      if (dcNumberMode === 'manual' && dcNumber) {
        return dcNumber;
      }
      if (dcPrefPrefix && dcPrefNextNum) {
        return `${dcPrefPrefix}${dcPrefNextNum}`;
      }
      const seq = getNextSequence('JW', dcList);
      const standardCode = seq.code || `VRMS/JW/26-27/${String(dcList.length + 1).padStart(3, '0')}`;
      if (dcPrefPrefix && dcPrefPrefix !== 'VRMS/JW/26-27/') {
        const lastSlash = standardCode.lastIndexOf('/');
        const numPart = lastSlash !== -1 ? standardCode.slice(lastSlash + 1) : String(dcList.length + 1).padStart(3, '0');
        return `${dcPrefPrefix}${numPart}`;
      }
      return standardCode;
    } catch (_) {}
    return `VRMS/JW/26-27/${String(dcList.length + 1).padStart(3, '0')}`;
  };

  const handleOpenDcPrefModal = () => {
    const cur = dcNumber || fetchNextDcNumber();
    const lastSlash = cur.lastIndexOf('/');
    if (lastSlash !== -1) {
      setTempPrefix(dcPrefPrefix || cur.slice(0, lastSlash + 1));
      setTempNextNum(dcPrefNextNum || cur.slice(lastSlash + 1));
    } else {
      setTempPrefix(dcPrefPrefix || 'VRMS/JW/26-27/');
      setTempNextNum(dcPrefNextNum || '001');
    }
    setTempManualNum(cur);
    setTempNumberMode(dcNumberMode);
    setShowDcPrefModal(true);
  };

  const handleSaveDcPreferences = () => {
    try {
      localStorage.setItem('businz_dc_number_mode', tempNumberMode);
      localStorage.setItem('businz_dc_pref_prefix', tempPrefix);
      localStorage.setItem('businz_dc_pref_next_num', tempNextNum);
      if (tempNumberMode === 'manual') {
        localStorage.setItem('businz_dc_pref_manual_num', tempManualNum);
      }
    } catch (_) {}
    setDcNumberMode(tempNumberMode);
    setDcPrefPrefix(tempPrefix);
    setDcPrefNextNum(tempNextNum);

    if (tempNumberMode === 'auto') {
      const generated = `${tempPrefix || ''}${tempNextNum || '001'}`;
      setDcNumber(generated);
    } else {
      setDcNumber(tempManualNum || dcNumber);
    }
    setShowDcPrefModal(false);
  };

  // ==================== LINE ITEMS HELPERS ====================
  const handleAddNewRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: '',
        description: '',
        brand: 'VRM',
        wp: '',
        qty: 1,
        unit: 'NOS',
        rate: 0,
        tax: 18
      }
    ]);
  };

  const handleItemChange = (idx, field, val) => {
    setItems(prev => {
      const updated = [...prev];
      const target = { ...updated[idx] };
      if (field === 'qty' || field === 'rate' || field === 'tax') {
        target[field] = val === '' ? '' : Number(val);
      } else {
        target[field] = val;
      }
      updated[idx] = target;
      return updated;
    });
  };

  const handleRemoveItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCustomerSelect = (val) => {
    setCustomerName(val);
    const found = knownCustomers.find(c => c.name.toLowerCase() === val.toLowerCase());
    if (found) {
      if (found.gst && (!vendorGst || vendorGst.trim() === '')) {
        setVendorGst(found.gst);
      }
      const cLocs = getVendorLocations(found);
      if (cLocs.length > 0) {
        const reg = cLocs.find(l => l.id === 'registered_office') || cLocs[0];
        const ship = cLocs.find(l => l.id === 'factory_plant') || cLocs[1] || reg;
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
        if (ship.gst && (!vendorGst || vendorGst.trim() === '')) {
          setVendorGst(ship.gst);
        }
      } else {
        if (found.address) {
          setDeliveryAddress(found.address);
          const parsedDel = parseAddressString(found.address);
          setDeliveryAddress1(parsedDel.address1 || '');
          setDeliveryAddress2(parsedDel.address2 || '');
          setDeliveryCity(parsedDel.city || '');
          setDeliveryState(parsedDel.state || '');
          setDeliveryPincode(parsedDel.pincode || '');
        }
        if (found.billingAddress) {
          setBillingAddress(found.billingAddress);
          const parsedBill = parseAddressString(found.billingAddress);
          setBillingAddress1(parsedBill.address1 || '');
          setBillingAddress2(parsedBill.address2 || '');
          setBillingCity(parsedBill.city || '');
          setBillingState(parsedBill.state || '');
          setBillingPincode(parsedBill.pincode || '');
        }
      }
    }
  };

  // Financial Calculations matching BUSINZ PO structure
  const subtotal = useMemo(() => {
    return items.reduce((acc, curr) => acc + ((Number(curr.qty) || 0) * (Number(curr.rate) || 0)), 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    return (subtotal * (Number(discountPct) || 0)) / 100;
  }, [subtotal, discountPct]);

  const taxableAmount = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const totalTax = useMemo(() => {
    return items.reduce((acc, curr) => {
      const lineBase = (Number(curr.qty) || 0) * (Number(curr.rate) || 0);
      const lineDisc = (lineBase * (Number(discountPct) || 0)) / 100;
      const lineTaxable = Math.max(0, lineBase - lineDisc);
      const taxRate = curr.tax !== undefined && curr.tax !== '' ? Number(curr.tax) : 18;
      return acc + (lineTaxable * (taxRate / 100));
    }, 0);
  }, [items, discountPct]);

  const grandTotal = useMemo(() => {
    const adj = Number(adjustment) || 0;
    return Math.round(taxableAmount + totalTax + adj);
  }, [taxableAmount, totalTax, adjustment]);

  const roundOff = useMemo(() => {
    const adj = Number(adjustment) || 0;
    const raw = taxableAmount + totalTax + adj;
    return Number((grandTotal - raw).toFixed(2));
  }, [taxableAmount, totalTax, adjustment, grandTotal]);

  // Handle file uploads (Max 5, 10MB each)
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (attachedFiles.length + files.length > 5) {
      alert("You can upload a maximum of 5 files per Delivery Challan.");
      return;
    }
    files.forEach(f => {
      if (f.size > 10 * 1024 * 1024) {
        alert(`File ${f.name} exceeds 10MB limit.`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedFiles(prev => [
          ...prev,
          {
            name: f.name,
            size: (f.size / 1024).toFixed(1) + ' KB',
            type: f.type,
            dataUrl: reader.result
          }
        ]);
      };
      reader.readAsDataURL(f);
    });
  };

  const handleStartFreshDC = () => {
    setCompanyLocation('VRM Structures India Pvt Ltd');
    setCustomerName('');
    setVendorGst('');
    setDcNumber(fetchNextDcNumber());
    setReferenceNo('');
    setDcDate(new Date().toISOString().split('T')[0]);
    setChallanType('Job Work');
    setWarehouseLocation('');
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
    setTransporter('');
    setVehicleNo('');
    setLrNo('');
    setCustomerNotes('');
    setSelectedTermsPreset('rule55');
    setTerms(TERMS_PRESETS[0].text);
    setDiscountPct(0);
    setAdjustment(0);
    setAttachedFiles([]);
    setItems([]);
    setEditIdx(null);
    setActiveDc(null);
    setViewMode('create');
  };

  const handleStartEdit = (dc) => {
    setActiveDc(dc);
    setEditIdx(dcList.findIndex(d => (d.dcNo === dc.dcNo || d.id === dc.id)));
    setCompanyLocation(dc.companyLocation || dc.branch || 'VRM Structures India Pvt Ltd');
    setCustomerName(dc.customerName || dc.vendor || '');
    setVendorGst(dc.vendorGst || dc.gstNo || dc.gstin || '');
    setDcNumber(dc.dcNo || dc.code || '');
    setReferenceNo(dc.referenceNo || dc.refNo || dc.bomCode || '');
    setDcDate(dc.dcDate || dc.date || new Date().toISOString().split('T')[0]);
    setChallanType(dc.challanType || 'Job Work');
    setWarehouseLocation(dc.warehouseLocation || '');
    setDeliveryAddress(dc.deliveryAddress || '');
    const parsedDel = (dc.deliveryAddressObj && typeof dc.deliveryAddressObj === 'object')
      ? dc.deliveryAddressObj
      : parseAddressString(dc.deliveryAddress || '');
    setDeliveryAddress1(dc.deliveryAddress1 || parsedDel.address1 || '');
    setDeliveryAddress2(dc.deliveryAddress2 || parsedDel.address2 || '');
    setDeliveryCity(dc.deliveryCity || parsedDel.city || '');
    setDeliveryState(dc.deliveryState || parsedDel.state || '');
    setDeliveryPincode(dc.deliveryPincode || parsedDel.pincode || '');

    setBillingAddress(dc.billingAddress || '');
    const parsedBill = (dc.billingAddressObj && typeof dc.billingAddressObj === 'object')
      ? dc.billingAddressObj
      : parseAddressString(dc.billingAddress || '');
    setBillingAddress1(dc.billingAddress1 || parsedBill.address1 || '');
    setBillingAddress2(dc.billingAddress2 || parsedBill.address2 || '');
    setBillingCity(dc.billingCity || parsedBill.city || '');
    setBillingState(dc.billingState || parsedBill.state || '');
    setBillingPincode(dc.billingPincode || parsedBill.pincode || '');
    setSameAsDelivery(dc.deliveryAddress === dc.billingAddress && Boolean(dc.deliveryAddress));
    setTransporter(dc.transporter || '');
    setVehicleNo(dc.vehicleNo || '');
    setLrNo(dc.lrNo || '');
    setCustomerNotes(dc.customerNotes || dc.notes || '');
    setTerms(dc.termsAndConditions || dc.terms || TERMS_PRESETS[0].text);
    setDiscountPct(dc.discountPct || dc.discount || 0);
    setAdjustment(dc.adjustment || 0);
    setAttachedFiles(dc.attachedFiles || []);

    const loadedItems = Array.isArray(dc.items) ? dc.items.map((it, idx) => ({
      id: it.id || `item-${idx}`,
      name: it.name || it.description || '',
      description: it.description || '',
      brand: it.brand || 'VRM',
      wp: it.wp || it.spec || '',
      qty: Number(it.qty || it.dcQty || 1),
      unit: it.unit || 'NOS',
      rate: Number(it.rate || 0),
      tax: Number(it.tax !== undefined ? it.tax : (it.taxRate !== undefined ? it.taxRate : 18))
    })) : [];

    setItems(loadedItems);
    setViewMode('edit');
  };

  const handleStartView = (dc) => {
    setActiveDc(dc);
    setViewMode('view');
  };

  // ==================== SAVE DELIVERY CHALLAN ====================
  const handleSaveDC = async (isDraft = false) => {
    if (!customerName || customerName.trim() === '') {
      alert("⚠️ Company / Customer Name is mandatory.");
      return;
    }
    if (!dcNumber || dcNumber.trim() === '') {
      alert("⚠️ Delivery Challan# is mandatory.");
      return;
    }
    const effDel = formatAddressObj({ address1: deliveryAddress1, address2: deliveryAddress2, city: deliveryCity, state: deliveryState, pincode: deliveryPincode }) || deliveryAddress.trim();
    const effBill = formatAddressObj({ address1: billingAddress1, address2: billingAddress2, city: billingCity, state: billingState, pincode: billingPincode }) || billingAddress.trim() || effDel;

    if (!effDel || (!deliveryAddress1.trim() && !deliveryCity.trim() && !deliveryAddress.trim())) {
      alert("⚠️ Delivery Address is mandatory.");
      return;
    }
    if (items.length === 0) {
      alert("⚠️ Please add at least one line item to the Delivery Challan.");
      return;
    }

    setIsSubmitting(true);
    const compProfile = getCompanyProfile(companyLocation);
    const effStatus = isDraft ? 'Draft' : 'In Transit';

    const newRecord = {
      id: dcNumber.trim(),
      code: dcNumber.trim(),
      dcNo: dcNumber.trim(),
      status: effStatus,
      statusType: isDraft ? 'draft' : 'in_transit',
      companyLocation,
      branch: companyLocation,
      companyName: compProfile.name,
      companyAddress: compProfile.address,
      companyGst: compProfile.gst,
      sourceOfSupply: compProfile.state,
      customerName: customerName.trim(),
      vendor: customerName.trim(),
      vendorGst: (vendorGst || '').toUpperCase().trim(),
      gstNo: (vendorGst || '').toUpperCase().trim(),
      gstin: (vendorGst || '').toUpperCase().trim(),
      deliveryAddress: effDel,
      deliveryAddress1: deliveryAddress1.trim(),
      deliveryAddress2: deliveryAddress2.trim(),
      deliveryCity: deliveryCity.trim(),
      deliveryState: deliveryState.trim(),
      deliveryPincode: deliveryPincode.trim(),
      deliveryAddressObj: {
        address1: deliveryAddress1.trim(),
        address2: deliveryAddress2.trim(),
        city: deliveryCity.trim(),
        state: deliveryState.trim(),
        pincode: deliveryPincode.trim()
      },
      billingAddress: effBill,
      billingAddress1: billingAddress1.trim(),
      billingAddress2: billingAddress2.trim(),
      billingCity: billingCity.trim(),
      billingState: billingState.trim(),
      billingPincode: billingPincode.trim(),
      billingAddressObj: {
        address1: billingAddress1.trim(),
        address2: billingAddress2.trim(),
        city: billingCity.trim(),
        state: billingState.trim(),
        pincode: billingPincode.trim()
      },
      referenceNo: referenceNo.trim() || '—',
      refNo: referenceNo.trim() || '—',
      dcDate,
      date: dcDate,
      challanType,
      warehouseLocation,
      transporter: transporter.trim() || 'Direct Fleet',
      vehicleNo: vehicleNo.toUpperCase().trim() || '—',
      lrNo: lrNo.trim() || '—',
      customerNotes: customerNotes.trim(),
      notes: customerNotes.trim(),
      termsAndConditions: terms.trim(),
      terms: terms.trim(),
      discountPct: Number(discountPct) || 0,
      adjustment: Number(adjustment) || 0,
      subtotal,
      totalTax,
      roundOff,
      totalAmount: grandTotal,
      amount: `₹ ${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      totalValue: grandTotal,
      attachedFiles,
      items: items.map(it => ({
        ...it,
        dcQty: Number(it.qty) || 1,
        amount: ((Number(it.qty) || 1) * (Number(it.rate) || 0))
      })),
      createdAt: activeDc?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Deduct stock if not draft
    if (!isDraft) {
      try {
        centralInventoryStore.deductStockForDC(
          newRecord.dcNo,
          newRecord.referenceNo || 'DIRECT',
          newRecord.items,
          'Procurement Head'
        );
      } catch (err) {
        console.warn("Stock deduction notice:", err);
      }
    }

    let updatedList = [];
    if (editIdx !== null && dcList[editIdx]) {
      updatedList = dcList.map((d, i) => i === editIdx ? newRecord : d);
    } else {
      updatedList = [newRecord, ...dcList.filter(d => d.dcNo !== newRecord.dcNo && d.id !== newRecord.dcNo)];
    }

    setDcList(updatedList);
    try {
      localStorage.setItem('controlroom_dc_store', JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent('controlroom_storage_update', { detail: { key: 'controlroom_dc_store' } }));
    } catch (_) {}

    try {
      await fetch('/api/deliverychallans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
      saveCloudStore('delivery_challan_store', updatedList);
    } catch (_) {}

    setIsSubmitting(false);
    showCustomAlert(
      `Delivery Challan ${newRecord.dcNo} ${isDraft ? 'saved as Draft' : 'created & issued'} successfully!`,
      isDraft ? 'Draft Saved' : 'Challan Created',
      'success'
    );

    setActiveDc(newRecord);
    setViewMode('view');
  };

  // ==================== CANCEL DELIVERY CHALLAN ====================
  const handleConfirmCancel = async () => {
    if (!cancellationRemarkInput || cancellationRemarkInput.trim() === '') {
      alert("⚠️ A cancellation remark is mandatory to cancel a Delivery Challan.");
      return;
    }
    if (!cancellingDc) return;

    setCancelSubmitting(true);
    const targetId = cancellingDc.dcNo || cancellingDc.id;

    const updatedList = dcList.map(d => {
      if (d.dcNo === targetId || d.id === targetId) {
        return {
          ...d,
          status: 'Cancelled',
          statusType: 'cancelled',
          cancelled: true,
          cancellationRemark: cancellationRemarkInput.trim(),
          cancelReason: cancellationRemarkInput.trim(),
          cancelledBy: 'Procurement Head',
          cancelledDate: new Date().toLocaleDateString('en-GB'),
          cancelledAt: new Date().toISOString()
        };
      }
      return d;
    });

    setDcList(updatedList);
    try {
      localStorage.setItem('controlroom_dc_store', JSON.stringify(updatedList));
      window.dispatchEvent(new CustomEvent('controlroom_storage_update', { detail: { key: 'controlroom_dc_store' } }));
    } catch (_) {}

    try {
      await fetch(`/api/deliverychallans/${encodeURIComponent(targetId)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remark: cancellationRemarkInput.trim(),
          cancelledBy: 'Procurement Head'
        })
      });
      saveCloudStore('delivery_challan_store', updatedList);
    } catch (_) {}

    setCancelSubmitting(false);
    setCancellingDc(null);
    setCancellationRemarkInput('');
    showCustomAlert(`Delivery Challan ${targetId} cancelled successfully.`, 'Challan Cancelled', 'info');

    if (activeDc && (activeDc.dcNo === targetId || activeDc.id === targetId)) {
      setActiveDc(prev => ({
        ...prev,
        status: 'Cancelled',
        statusType: 'cancelled',
        cancelled: true,
        cancellationRemark: cancellationRemarkInput.trim()
      }));
    }
  };

  // ==================== BULK ITEM MODAL HANDLER ====================
  const availableInventoryItems = useMemo(() => {
    try {
      const items = centralInventoryStore.getItems();
      if (Array.isArray(items) && items.length > 0) return items;
    } catch (_) {}
    return [
      { name: 'GI Steel Coil 2mm', code: 'RM-COIL-01', category: 'Raw Material', rate: 45000, unit: 'MT', tax: 18 },
      { name: 'GI Steel Coil 1.6mm', code: 'RM-COIL-02', category: 'Raw Material', rate: 43000, unit: 'MT', tax: 18 },
      { name: 'CRC Sheet 1.2mm', code: 'RM-CRC-01', category: 'Raw Material', rate: 52000, unit: 'MT', tax: 18 },
      { name: 'Self Drilling Screw', code: 'CON-SCR-01', category: 'Consumables', rate: 3.5, unit: 'NOS', tax: 18 },
      { name: 'Hex Bolt M10', code: 'FAS-BLT-01', category: 'Fasteners', rate: 6.2, unit: 'NOS', tax: 18 },
      { name: 'Structural Steel I-Beam', code: 'RM-BEAM-01', category: 'Raw Material', rate: 48000, unit: 'MT', tax: 18 },
      { name: 'Electrical Copper Cable 4sqmm', code: 'CON-CAB-01', category: 'Consumables', rate: 120, unit: 'MTR', tax: 18 }
    ];
  }, []);

  const handleBulkToggle = (itemKey, item) => {
    setSelectedBulkItems(prev => {
      const next = { ...prev };
      if (next[itemKey]) {
        delete next[itemKey];
      } else {
        next[itemKey] = { item, qty: 1 };
      }
      return next;
    });
  };

  const handleConfirmBulkAdd = () => {
    const keys = Object.keys(selectedBulkItems);
    if (keys.length === 0) return;
    const added = keys.map(k => {
      const entry = selectedBulkItems[k];
      const it = entry.item;
      return {
        id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: it.name || it.description || '',
        description: it.description || '',
        brand: 'VRM',
        wp: '',
        qty: Number(entry.qty) || 1,
        unit: it.unit || 'NOS',
        rate: Number(it.rate) || 0,
        tax: Number(it.tax !== undefined ? it.tax : 18)
      };
    });
    setItems(prev => [...prev, ...added]);
    setShowBulkItemModal(false);
    setSelectedBulkItems({});
    setBulkItemSearch('');
    showCustomAlert(`Added ${added.length} items to Delivery Challan.`, 'Items Added in Bulk', 'success');
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setDcTab('All');
    setFilterDate('');
    setFilterEndDate('');
    setCurrentPage(1);
  };

  // ==================== FILTERING & PAGINATION (MATCHING PO EXACT LOGIC) ====================
  const allStatusOptions = [
    'All orders',
    'Draft',
    'In Transit',
    'Delivered',
    'Cancelled'
  ];

  const filteredDCList = useMemo(() => {
    return dcList.filter(d => {
      const dcNum = String(d.dcNo || d.id || d.code || '').toLowerCase();
      const cust = String(d.customerName || d.vendor || '').toLowerCase();
      const ref = String(d.referenceNo || d.refNo || d.bomCode || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || dcNum.includes(q) || cust.includes(q) || ref.includes(q);

      const st = String(d.status || 'Draft').trim();
      let matchesStatus = true;
      if (statusFilter !== 'All' && statusFilter !== 'All orders') {
        if (statusFilter === 'Draft') matchesStatus = st.toLowerCase().includes('draft');
        else if (statusFilter === 'In Transit') matchesStatus = st.toLowerCase().includes('transit');
        else if (statusFilter === 'Delivered') matchesStatus = st.toLowerCase().includes('deliver') || st.toLowerCase().includes('closed');
        else if (statusFilter === 'Cancelled') matchesStatus = st.toLowerCase().includes('cancel');
        else matchesStatus = st === statusFilter;
      }

      let matchesTab = true;
      if (dcTab !== 'All') {
        if (dcTab === 'Draft') matchesTab = st.toLowerCase().includes('draft');
        else if (dcTab === 'In Transit') matchesTab = st.toLowerCase().includes('transit');
        else if (dcTab === 'At Job Work') matchesTab = st.toLowerCase().includes('job work') || st.toLowerCase() === 'at job work';
        else if (dcTab === 'Partially Returned') matchesTab = st.toLowerCase().includes('partially');
        else if (dcTab === 'Delivered') matchesTab = st.toLowerCase().includes('deliver') || st.toLowerCase().includes('closed');
        else if (dcTab === 'Cancelled') matchesTab = st.toLowerCase().includes('cancel');
      }

      let matchesDate = true;
      if (filterDate || filterEndDate) {
        const rawDate = d.dcDate || d.date || d.createdAt;
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
  }, [dcList, searchQuery, statusFilter, dcTab, filterDate, filterEndDate]);

  const sortedDCList = useMemo(() => {
    return [...filteredDCList].sort((a, b) => {
      const parseNum = (item) => {
        const str = String(item.dcNo || item.id || '');
        const match = str.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      return parseNum(b) - parseNum(a);
    });
  }, [filteredDCList]);

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = sortedDCList.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(sortedDCList.length / rowsPerPage) || 1;

  const statusCounts = useMemo(() => {
    return {
      all: dcList.length,
      draft: dcList.filter(d => String(d.status || '').toLowerCase().includes('draft')).length,
      inTransit: dcList.filter(d => String(d.status || '').toLowerCase().includes('transit')).length,
      atJobWork: dcList.filter(d => String(d.status || '').toLowerCase().includes('job work') || String(d.status || '').toLowerCase() === 'at job work').length,
      partiallyReturned: dcList.filter(d => String(d.status || '').toLowerCase().includes('partially')).length,
      delivered: dcList.filter(d => String(d.status || '').toLowerCase().includes('deliver') || String(d.status || '').toLowerCase().includes('closed')).length,
      cancelled: dcList.filter(d => String(d.status || '').toLowerCase().includes('cancel')).length
    };
  }, [dcList]);

  // ==================== JOB WORK RETURN HANDLERS ====================
  const handleOpenReturnModal = (dc) => {
    setReturnDc(dc);
    setReturnDate(new Date().toISOString().split('T')[0]);
    setReturnRef('');
    setReturnReceivedBy('');
    setReturnRemarks('');

    // Pre-fill received items: each sent item has an initial receiving row
    const initialRows = [];
    if (Array.isArray(dc.items)) {
      dc.items.forEach((it, idx) => {
        const sentQty = Number(it.qty || it.dcQty || 1);
        const alreadyReturned = (dc.returns || []).reduce((sum, ret) => {
          const matched = (ret.returnedItems || []).filter(r => (
            (r.sentItemIdx !== undefined ? r.sentItemIdx === idx : r.itemIdx === idx) ||
            r.sentItemName === it.name ||
            r.itemName === it.name
          ));
          return sum + matched.reduce((s, m) => s + Number(m.returnedQty || 0), 0);
        }, 0);
        const remaining = Math.max(0, sentQty - alreadyReturned);
        initialRows.push({
          id: `rec_${idx}_${Date.now()}`,
          sentItemIdx: idx,
          sentItemName: it.name || it.description || `Item ${idx + 1}`,
          sentQty,
          remainingSentQty: remaining,
          receivedItemName: it.name || it.description || '',
          receivedQty: remaining > 0 ? remaining : 0,
          unit: it.unit || 'Nos'
        });
      });
    }
    setReturnReceivedRows(initialRows);
    setShowReturnModal(true);
  };

  const handleAddReceivedRow = () => {
    const firstSent = returnDc?.items?.[0];
    setReturnReceivedRows(prev => [
      ...prev,
      {
        id: `rec_${Date.now()}_${Math.random()}`,
        sentItemIdx: 0,
        sentItemName: firstSent?.name || firstSent?.description || 'Job Work Item',
        sentQty: Number(firstSent?.qty || firstSent?.dcQty || 1),
        remainingSentQty: 0,
        receivedItemName: '',
        receivedQty: '',
        unit: firstSent?.unit || 'Nos'
      }
    ]);
  };

  const handleUpdateReceivedRow = (index, field, value) => {
    setReturnReceivedRows(prev => {
      const next = [...prev];
      const updatedRow = { ...next[index], [field]: value };
      if (field === 'sentItemIdx') {
        const selectedSent = returnDc?.items?.[value];
        if (selectedSent) {
          const sentQty = Number(selectedSent.qty || selectedSent.dcQty || 1);
          const alreadyReturned = (returnDc?.returns || []).reduce((sum, ret) => {
            const matched = (ret.returnedItems || []).filter(r => (
              (r.sentItemIdx !== undefined ? r.sentItemIdx === Number(value) : r.itemIdx === Number(value)) ||
              r.sentItemName === selectedSent.name ||
              r.itemName === selectedSent.name
            ));
            return sum + matched.reduce((s, m) => s + Number(m.returnedQty || 0), 0);
          }, 0);
          updatedRow.sentItemName = selectedSent.name || selectedSent.description || '';
          updatedRow.sentQty = sentQty;
          updatedRow.remainingSentQty = Math.max(0, sentQty - alreadyReturned);
          if (!updatedRow.receivedItemName) {
            updatedRow.receivedItemName = selectedSent.name || '';
          }
          if (!updatedRow.unit) {
            updatedRow.unit = selectedSent.unit || 'Nos';
          }
        }
      }
      next[index] = updatedRow;
      return next;
    });
  };

  const handleRemoveReceivedRow = (index) => {
    setReturnReceivedRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleReceiveAllRemaining = () => {
    setReturnReceivedRows(prev => prev.map(r => ({
      ...r,
      receivedQty: r.remainingSentQty !== undefined ? r.remainingSentQty : r.receivedQty
    })));
  };

  const handleSaveReturn = async () => {
    if (!returnDc) return;
    if (!returnDate) { alert('Please enter a Return Date.'); return; }
    if (!returnReceivedBy.trim()) { alert('Please enter who received the goods.'); return; }

    const validRows = returnReceivedRows.filter(r => Number(r.receivedQty) > 0);
    if (validRows.length === 0) {
      alert('Please enter at least one item with a received quantity greater than 0.');
      return;
    }

    const missingName = validRows.some(r => !String(r.receivedItemName || '').trim());
    if (missingName) {
      alert('Please enter a Received Product / Finished Goods name for all items being received.');
      return;
    }

    setReturnSubmitting(true);
    try {
      const returnedItems = validRows.map(r => ({
        sentItemIdx: Number(r.sentItemIdx !== undefined ? r.sentItemIdx : 0),
        itemIdx: Number(r.sentItemIdx !== undefined ? r.sentItemIdx : 0),
        sentItemName: r.sentItemName || '',
        itemName: r.receivedItemName.trim(),
        receivedItemName: r.receivedItemName.trim(),
        unit: r.unit || 'Nos',
        sentQty: Number(r.sentQty || 0),
        returnedQty: Number(r.receivedQty || 0)
      }));

      const newReturn = {
        returnId: `RET-${Date.now()}`,
        returnDate,
        returnRef: returnRef.trim(),
        receivedBy: returnReceivedBy.trim(),
        remarks: returnRemarks.trim(),
        returnedItems,
        createdAt: new Date().toISOString()
      };

      // Calculate updated status
      const allItems = returnDc.items || [];
      const existingReturns = returnDc.returns || [];
      const updatedReturns = [...existingReturns, newReturn];

      const totalSentByIdx = {};
      const totalReturnedByIdx = {};
      allItems.forEach((it, idx) => {
        totalSentByIdx[idx] = Number(it.qty || it.dcQty || 1);
        totalReturnedByIdx[idx] = 0;
      });
      updatedReturns.forEach(ret => {
        (ret.returnedItems || []).forEach(ri => {
          const idx = ri.sentItemIdx !== undefined ? ri.sentItemIdx : ri.itemIdx;
          if (idx !== undefined && totalReturnedByIdx[idx] !== undefined) {
            totalReturnedByIdx[idx] = (totalReturnedByIdx[idx] || 0) + Number(ri.returnedQty || 0);
          }
        });
      });

      const allFullyReturned = allItems.every((_, idx) =>
        (totalReturnedByIdx[idx] || 0) >= (totalSentByIdx[idx] || 0)
      );
      const anyReturned = updatedReturns.some(ret => (ret.returnedItems || []).length > 0);

      let newStatus = returnDc.status;
      if (allFullyReturned) {
        newStatus = 'Closed';
      } else if (anyReturned) {
        newStatus = 'Partially Returned';
      }

      // Update the DC record (1 targeted update)
      const updatedDc = {
        ...returnDc,
        returns: updatedReturns,
        status: newStatus,
        statusType: allFullyReturned ? 'closed' : 'partially_returned',
        updatedAt: new Date().toISOString()
      };

      // Credit stock back for returned items (credited under received product name)
      try {
        returnedItems.forEach(ri => {
          if (ri.returnedQty > 0) {
            const stockName = ri.receivedItemName || ri.itemName;
            centralInventoryStore.addStock && centralInventoryStore.addStock(
              stockName,
              ri.returnedQty,
              `Job Work Inward — DC: ${returnDc.dcNo || returnDc.id}, Ret: ${newReturn.returnId} (${ri.receivedItemName !== ri.sentItemName ? `Processed from ${ri.sentItemName}` : 'Returned'})`
            );
          }
        });
      } catch (err) {
        console.warn('Stock credit notice:', err);
      }

      // Save to localStorage
      try {
        const raw = localStorage.getItem('controlroom_dc_store');
        const list = raw ? JSON.parse(raw) : [];
        const updated = list.map(d =>
          (d.dcNo === returnDc.dcNo || d.id === returnDc.id) ? updatedDc : d
        );
        localStorage.setItem('controlroom_dc_store', JSON.stringify(updated));
      } catch (_) {}

      // Sync to server
      try {
        await fetch(`/api/deliverychallans/${returnDc.dcNo || returnDc.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedDc)
        });
      } catch (_) {}

      // Update local state (1 row only)
      setDcList(prev => prev.map(d =>
        (d.dcNo === returnDc.dcNo || d.id === returnDc.id) ? updatedDc : d
      ));
      setActiveDc(updatedDc);

      setShowReturnModal(false);
      setReturnDc(null);
      showCustomAlert(
        allFullyReturned
          ? `All items received back. DC ${returnDc.dcNo} is now Closed ✅`
          : `Partial return recorded for DC ${returnDc.dcNo}. Status: Partially Returned.`,
        'Job Work Return Recorded',
        'success'
      );
    } catch (err) {
      console.error('Return save error:', err);
      showCustomAlert('Failed to save return. Please try again.', 'Error', 'error');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedDCs(sortedDCList.map(d => d.dcNo || d.id));
    } else {
      setSelectedDCs([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedDCs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-24, 24px)', width: '100%', boxSizing: 'border-box' }}>

      {/* Official DC Dedicated Print Isolation Stylesheet */}
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
          aside, nav, header, footer,
          [class*="sidebar"],
          [class*="Sidebar"],
          .floating-action-bar,
          .dc-no-print,
          .no-print {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
          #businz-dc-official-document {
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
          #businz-dc-official-document * {
            visibility: visible !important;
          }
        }
      `}</style>

      {/* Toast Alert */}
      {toastAlert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 100000,
          backgroundColor: toastAlert.type === 'success' ? '#ECFDF5' : toastAlert.type === 'error' ? '#FEF2F2' : '#EFF6FF',
          border: `1px solid ${toastAlert.type === 'success' ? '#A7F3D0' : toastAlert.type === 'error' ? '#FECACA' : '#BFDBFE'}`,
          borderRadius: '12px',
          padding: '12px 18px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {toastAlert.type === 'success' ? <CheckCircle size={18} style={{ color: '#059669' }} /> : <AlertCircle size={18} style={{ color: '#DC2626' }} />}
          <div>
            <strong style={{ fontSize: '13px', color: '#1E293B', display: 'block' }}>{toastAlert.title}</strong>
            <span style={{ fontSize: '12px', color: '#475569' }}>{toastAlert.message}</span>
          </div>
        </div>
      )}

      {/* ==================== VIEW 1: MAIN DC LIST SCREEN ==================== */}
      {viewMode === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>

          {/* Header section with Action Button (Exact PO Design with Pill Button & Circular Arrow) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', width: '100%', boxSizing: 'border-box' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#0F172A' }}>
                Delivery Challans (DC)
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Generate, tracking and dispatch management of statutory Delivery Challans (Rule 55 CGST)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={handleStartFreshDC}
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
                <span>Create DC</span>
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

          {/* 1. FILTERS & SEARCH ROW CARD (Exact PO Layout & Colors) */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: '#fafbfc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            alignItems: 'center',
            width: '100%',
            boxSizing: 'border-box',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#f8fafc', width: '320px', maxWidth: '100%', boxSizing: 'border-box' }}>
              <Search style={{ width: '15px', height: '15px', color: '#64748b', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search Delivery Challans (DC No, Company Name)..."
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

              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '12px', backgroundColor: 'white', color: '#334155', outline: 'none' }}
              >
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

          {/* 2. STATUS TABS ROW (Exact PO Tabs Style & Color Palettes) */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '20px', padding: '4px 0', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[
              { id: 'All', label: 'All orders', count: statusCounts.all, bg: '#e2e8f0', fg: '#475569' },
              { id: 'Draft', label: 'Draft', count: statusCounts.draft, bg: '#fff7ed', fg: '#c2410c' },
              { id: 'In Transit', label: 'In Transit', count: statusCounts.inTransit, bg: '#fef3c7', fg: '#92400e' },
              { id: 'At Job Work', label: 'At Job Work', count: statusCounts.atJobWork, bg: '#EFF6FF', fg: '#1D4ED8' },
              { id: 'Partially Returned', label: 'Partially Returned', count: statusCounts.partiallyReturned, bg: '#FEF3C7', fg: '#B45309' },
              { id: 'Delivered', label: 'Closed / Delivered', count: statusCounts.delivered, bg: '#dcfce7', fg: '#15803d' },
              { id: 'Cancelled', label: 'Cancelled', count: statusCounts.cancelled, bg: '#fee2e2', fg: '#b91c1c' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setDcTab(tab.id); setCurrentPage(1); }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '10px 4px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: dcTab === tab.id ? '#2563eb' : '#64748b',
                  borderBottom: dcTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
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

          {/* 3. TABLE CARD (Exact custom-table & section-card classes from PO) */}
          <div className="section-card" style={{ padding: 0, overflowX: 'auto', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px' }}>
            <div className="table-responsive" style={{ border: 'none', borderRadius: '16px', margin: 0, overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
              <table className="custom-table" style={{ fontSize: '13px', width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#475569', height: '48px' }}>
                    <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', textAlign: 'center', padding: '12px 0', boxSizing: 'border-box' }}>
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={sortedDCList.length > 0 && sortedDCList.every(dc => selectedDCs.includes(dc.dcNo || dc.id))}
                        style={{ cursor: 'pointer', borderRadius: '4px', accentColor: '#0E7490' }}
                      />
                    </th>
                    <th style={{ width: '16%', minWidth: '130px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>DC No.</th>
                    <th style={{ width: '28%', minWidth: '200px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Company Name</th>
                    <th style={{ width: '14%', minWidth: '120px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>DC Date</th>
                    <th style={{ width: '16%', minWidth: '140px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'left', boxSizing: 'border-box' }}>Challan Type</th>
                    <th style={{ width: '14%', minWidth: '130px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'right', boxSizing: 'border-box' }}>Total Value</th>
                    <th style={{ width: '12%', minWidth: '130px', fontWeight: '700', padding: '12px 14px', color: '#334155', textAlign: 'center', boxSizing: 'border-box' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ textAlign: 'center', padding: '12px 0', width: '48px' }}>
                          <input type="checkbox" disabled />
                        </td>
                        <td style={{ padding: '12px 14px' }}><div className="skeleton-shimmer skeleton-text" style={{ width: '90px', height: '14px' }} /></td>
                        <td style={{ padding: '12px 14px' }}><div className="skeleton-shimmer skeleton-text" style={{ width: '70%', height: '14px' }} /></td>
                        <td style={{ padding: '12px 14px' }}><div className="skeleton-shimmer skeleton-text" style={{ width: '80px', height: '14px' }} /></td>
                        <td style={{ padding: '12px 14px' }}><div className="skeleton-shimmer skeleton-text" style={{ width: '80px', height: '14px' }} /></td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}><div className="skeleton-shimmer skeleton-text" style={{ width: '85px', height: '14px', marginLeft: 'auto' }} /></td>
                        <td style={{ textAlign: 'center', padding: '12px 14px' }}><div className="skeleton-shimmer" style={{ width: '80px', height: '22px', borderRadius: '12px', margin: '0 auto' }} /></td>
                      </tr>
                    ))
                  ) : currentRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '48px 16px', color: '#64748B' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <Truck size={32} style={{ color: '#CBD5E1' }} />
                          <strong style={{ fontSize: '14px', color: '#1E293B' }}>No Delivery Challans Found</strong>
                          <span style={{ fontSize: '12px' }}>Click "Create DC" to generate your first Delivery Challan.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentRows.map((dc, idx) => {
                      const dcKey = dc.dcNo || dc.id;
                      const isChecked = selectedDCs.includes(dcKey);
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
                              onChange={() => handleSelectRow(dcKey)}
                              style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ fontWeight: '600', color: '#2563eb', textAlign: 'left' }}>
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handleStartView(dc);
                              }}
                              style={{ fontWeight: '600', color: '#2563eb', textDecoration: 'none' }}
                            >
                              {dc.dcNo || dc.code || dc.id}
                            </a>
                          </td>
                          <td style={{ fontWeight: '500', color: '#1e293b', textAlign: 'left' }}>
                            {dc.customerName || dc.vendor || '—'}
                          </td>
                          <td style={{ color: '#64748b', textAlign: 'left' }}>
                            {dc.dcDate || dc.date || '—'}
                          </td>
                          <td style={{ color: '#64748b', textAlign: 'left' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#F1F5F9',
                              color: '#475569',
                              fontSize: '11px',
                              fontWeight: '600'
                            }}>
                              {dc.challanType || 'For Job Work'}
                            </span>
                          </td>
                          <td style={{ fontWeight: '600', color: '#1e293b', textAlign: 'right' }}>
                            ₹ {Number(dc.totalAmount || dc.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <StatusBadge status={dc.status || 'Draft'} size="sm" />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* 4. PAGINATION FOOTER (Exact PO Footer Layout & Controls) */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 24px',
              fontSize: '13px',
              color: '#64748b',
              borderTop: '1px solid #f1f5f9',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                Showing {sortedDCList.length === 0 ? 0 : indexOfFirstRow + 1} to {Math.min(indexOfLastRow, sortedDCList.length)} of {sortedDCList.length} entries
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Rows per page:</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    style={{ height: '30px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', padding: '0 4px', backgroundColor: 'white' }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
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

                  {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                    Math.max(0, currentPage - 2),
                    Math.min(totalPages, currentPage + 2)
                  ).map(page => (
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
          </div>

          {/* Floating Selection Toolbar (exact reference design matching PO) */}
          {selectedDCs.length > 0 && (
            <div className="floating-action-bar dc-no-print" style={{
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
                <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedDCs.length}</strong> Selected
              </span>

              {/* Edit Info (Single selection) */}
              {selectedDCs.length === 1 && (() => {
                const target = dcList.find(d => (d.dcNo === selectedDCs[0] || d.id === selectedDCs[0]));
                if (!target || String(target.status || '').toLowerCase().includes('cancel')) return null;
                return (
                  <button
                    onClick={() => {
                      setSelectedDCs([]);
                      handleStartEdit(target);
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

              {/* Receive Back (Single selection, not cancelled / not closed) */}
              {selectedDCs.length === 1 && (() => {
                const target = dcList.find(d => (d.dcNo === selectedDCs[0] || d.id === selectedDCs[0]));
                if (!target) return null;
                const isCancelledOrClosed = ['cancelled', 'closed'].some(s => String(target.status || '').toLowerCase().includes(s));
                if (isCancelledOrClosed) return null;
                return (
                  <button
                    onClick={() => {
                      setSelectedDCs([]);
                      handleOpenReturnModal(target);
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
                      boxShadow: '0 1px 2px rgba(14,116,144,0.25)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0891B2'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
                  >
                    <Package size={14} style={{ color: '#FFFFFF' }} /> Receive Back
                  </button>
                );
              })()}

              {/* View Details */}
              <button
                onClick={() => {
                  if (selectedDCs.length > 1) {
                    alert("Please select a single Delivery Challan to view details.");
                    return;
                  }
                  const target = dcList.find(d => (d.dcNo === selectedDCs[0] || d.id === selectedDCs[0]));
                  if (target) {
                    setSelectedDCs([]);
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

              {/* Export / Print PDF */}
              <button
                onClick={() => {
                  if (selectedDCs.length > 1) {
                    alert("Please select a single Delivery Challan to export / print PDF.");
                    return;
                  }
                  const target = dcList.find(d => (d.dcNo === selectedDCs[0] || d.id === selectedDCs[0]));
                  if (target) {
                    setSelectedDCs([]);
                    handleStartView(target);
                    setTimeout(() => window.print(), 400);
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
                <FileText size={14} style={{ color: '#059669' }} /> Export / Print PDF
              </button>

              {/* Cancel DC (Opens Mandatory Remark Modal) */}
              <button
                onClick={() => {
                  if (selectedDCs.length > 1) {
                    alert("Please select a single Delivery Challan to cancel.");
                    return;
                  }
                  const target = dcList.find(d => (d.dcNo === selectedDCs[0] || d.id === selectedDCs[0]));
                  if (!target) return;
                  if (String(target.status || '').toLowerCase().includes('cancel')) {
                    alert(`Delivery Challan ${target.dcNo || target.id} is already cancelled.`);
                    return;
                  }
                  setCancellingDc(target);
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
                <Ban size={14} style={{ color: '#DC2626' }} /> Cancel DC
              </button>

              {/* Deselect All */}
              <button
                onClick={() => setSelectedDCs([])}
                title="Deselect all"
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

        </div>
      )}

      {/* ==================== VIEW 2: DEDICATED FULL-PAGE CREATOR/EDITOR SCREEN (EXACT PO DESIGN) ==================== */}
      {(viewMode === 'create' || viewMode === 'edit') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: '#1e293b' }}>

          {/* Title Bar (Exact PO Header Bar) */}
          <div className="dc-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                  {viewMode === 'edit' ? 'Edit Delivery Challan' : 'Create Delivery Challan'}
                </h2>
              </div>
              <span style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                Fill in the details below to generate an official delivery challan under Rule 55 CGST.
              </span>
            </div>

            {/* Close / Back button top-right */}
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="Close and go back to DC List"
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#64748B',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#1E293B'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.color = '#64748B'; }}
            >
              <X size={15} /> Close
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* 1. Consignee / Customer Information (section-card style matching PO) */}
            <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <strong style={{ fontSize: '14px', color: '#2563eb', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                1. Consignee & Dispatch Information
              </strong>

              {/* Row 1: Customer Name | Vendor GST | Delivery Challan# | Challan Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 0.8fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="dc-customer-name" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                    Customer / Consignee Name <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                  </label>
                  <input
                    id="dc-customer-name"
                    type="text"
                    list="known-customers-datalist"
                    placeholder="Type or select Customer Name..."
                    value={customerName}
                    onChange={(e) => handleCustomerSelect(e.target.value)}
                    required
                    style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#334155', width: '100%', boxSizing: 'border-box' }}
                  />
                  <datalist id="known-customers-datalist">
                    {knownCustomers.map((c, idx) => (
                      <option key={idx} value={c.name}>{c.name} {c.address ? `(${c.address.slice(0, 30)}…)` : ''}</option>
                    ))}
                  </datalist>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="dc-vendor-gst" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                    Vendor / Consignee GST Number
                  </label>
                  <input
                    id="dc-vendor-gst"
                    type="text"
                    placeholder="e.g. 33AABCT1332L1Z1"
                    value={vendorGst}
                    onChange={(e) => setVendorGst(e.target.value.toUpperCase())}
                    maxLength={15}
                    style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white', color: '#0E7490', fontWeight: '700', textTransform: 'uppercase', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label htmlFor="dc-number" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Delivery Challan# <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenDcPrefModal}
                      title="Configure Delivery Challan# Preferences"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '1px 5px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        color: '#0E7490',
                        fontSize: '11px',
                        fontWeight: '600',
                        borderRadius: '4px',
                        backgroundColor: '#ECFEFF'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#CFFAFE'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ECFEFF'}
                    >
                      <Settings size={12} />
                      <span>Configure</span>
                    </button>
                  </div>
                  <input
                    id="dc-number"
                    type="text"
                    readOnly
                    value={dcNumber}
                    onClick={handleOpenDcPrefModal}
                    title="Delivery Challan# is non-editable here. Click to open Configure Preferences."
                    placeholder={dcPrefPrefix ? `${dcPrefPrefix}001` : 'VRMS/JW/26-27/001'}
                    required
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      padding: '0 12px',
                      fontSize: '13px',
                      fontWeight: '700',
                      color: '#0E7490',
                      backgroundColor: '#F8FAFC',
                      cursor: 'pointer'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="dc-challan-type" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                    Challan Type
                  </label>
                  <input
                    id="dc-challan-type"
                    type="text"
                    readOnly
                    value="Job Work"
                    style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: '#F8FAFC', color: '#0E7490', fontWeight: '700', cursor: 'default' }}
                  />
                </div>
              </div>

              {/* Row 2: Reference# | Delivery Challan Date | Transporter Name | Vehicle Number */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="dc-reference-no" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                    Reference#
                  </label>
                  <input
                    id="dc-reference-no"
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g. PO-0012, BOM-2026-45, Work Order Ref"
                    style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="dc-date" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                    Delivery Challan Date <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>
                  </label>
                  <input
                    id="dc-date"
                    type="date"
                    value={dcDate}
                    onChange={(e) => setDcDate(e.target.value)}
                    required
                    style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', backgroundColor: 'white' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="dc-transporter" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                    Transporter Name
                  </label>
                  <input
                    id="dc-transporter"
                    type="text"
                    value={transporter}
                    onChange={(e) => setTransporter(e.target.value)}
                    placeholder="e.g. VRL Logistics, Direct Fleet..."
                    style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="dc-vehicle-no" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                    Vehicle Number
                  </label>
                  <input
                    id="dc-vehicle-no"
                    type="text"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                    placeholder="e.g. TN-05-AB-1234"
                    style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', textTransform: 'uppercase' }}
                  />
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
                      <span>Consignee Site / Location:</span>
                    </div>
                    <select
                      value={deliveryLocationId}
                      onChange={(e) => {
                        const selId = e.target.value;
                        setDeliveryLocationId(selId);
                        if (selId === 'custom') return;
                        const chosen = customerLocations.find(l => l.id === selId);
                        if (chosen) {
                          setDeliveryAddress1(chosen.address1 || '');
                          setDeliveryAddress2(chosen.address2 || '');
                          setDeliveryCity(chosen.city || '');
                          setDeliveryState(chosen.state || '');
                          setDeliveryPincode(chosen.pincode || '');
                          const combined = formatAddressObj(chosen);
                          setDeliveryAddress(combined);
                          if (chosen.gst) {
                            setVendorGst(chosen.gst);
                          }
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
                      {customerLocations.length > 0 ? (
                        customerLocations.map((loc) => (
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
                        const chosen = customerLocations.find(l => l.id === selId);
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
                      {customerLocations.length > 0 ? (
                        customerLocations.map((loc) => (
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
                      placeholder="Customer billing street / building..."
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

            {/* 2. Line Items (section-card style matching PO exactly) */}
            <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 0' }}>
              <strong style={{ fontSize: '14px', color: '#2563eb', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px', margin: '0 20px' }}>
                2. Line Items
              </strong>

              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Item & Description *</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', width: '130px' }}>Brand</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', width: '100px' }}>WP</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '80px' }}>Qty *</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '80px' }}>Unit</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', width: '110px' }}>Rate (₹) *</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '90px' }}>GST (%)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', width: '110px' }}>Amount (₹)</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '50px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748B', fontSize: '13px', backgroundColor: '#FAFAFA' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Boxes size={28} style={{ color: '#94A3B8' }} />
                            <div>No line items added yet. Click <strong>Add New Row</strong> or <strong>Add Items in Bulk</strong> below.</div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      items.map((item, idx) => {
                        const lineAmount = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <input
                                  type="text"
                                  list={`dc-item-datalist-${idx}`}
                                  value={item.name || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const found = availableInventoryItems.find(ai => ai.name.toLowerCase() === val.toLowerCase());
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
                                <datalist id={`dc-item-datalist-${idx}`}>
                                  {availableInventoryItems.map((ai, zidx) => (
                                    <option key={zidx} value={ai.name}>{ai.code ? `[${ai.code}] ${ai.name}` : ai.name}</option>
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
                              <input
                                type="text"
                                value={item.brand || 'VRM'}
                                onChange={(e) => handleItemChange(idx, 'brand', e.target.value)}
                                placeholder="Brand"
                                style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', boxSizing: 'border-box' }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="text"
                                value={item.wp || ''}
                                onChange={(e) => handleItemChange(idx, 'wp', e.target.value)}
                                placeholder="WP"
                                style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', boxSizing: 'border-box' }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="number"
                                min={0.01}
                                step="any"
                                value={item.qty}
                                onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                                required
                                style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 4px', fontSize: '12px', textAlign: 'center' }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <select
                                value={item.unit || 'NOS'}
                                onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 4px', fontSize: '12px' }}
                              >
                                <option value="NOS">NOS</option>
                                <option value="MT">MT</option>
                                <option value="KG">KG</option>
                                <option value="PCS">PCS</option>
                                <option value="MTR">MTR</option>
                              </select>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={item.rate}
                                onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                                required
                                style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', textAlign: 'right' }}
                              />
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <select
                                value={item.tax !== undefined && item.tax !== '' ? Number(item.tax) : 18}
                                onChange={(e) => handleItemChange(idx, 'tax', Number(e.target.value))}
                                style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 4px', fontSize: '12px' }}
                              >
                                <option value={18}>18%</option>
                                <option value={12}>12%</option>
                                <option value={5}>5%</option>
                                <option value={28}>28%</option>
                                <option value={0}>0%</option>
                              </select>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: '#1e293b' }}>
                              ₹{lineAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              >
                                <Trash2 style={{ width: '14px', height: '14px' }} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Exact Add New Row and Add Items in Bulk Buttons from PO */}
              <div style={{ margin: '14px 20px 6px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleAddNewRow}
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
                  <span style={{
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
                  }}>
                    +
                  </span>
                  Add New Row
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedBulkItems({});
                    setBulkItemSearch('');
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
                  <span style={{
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
                  }}>
                    +
                  </span>
                  Add Items in Bulk
                </button>
              </div>

            </div>

            {/* 3. Calculations Summary & Notes (2-column layout matching PO) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>

              {/* Notes & Terms Card */}
              <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <strong style={{ fontSize: '14px', color: '#2563eb', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                  Notes & Terms
                </strong>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label htmlFor="dc-notes" style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                    Customer Notes & Remarks
                  </label>
                  <textarea
                    id="dc-notes"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    rows="3"
                    placeholder="Enter notes / remarks for internal and transport reference..."
                    style={{ borderRadius: '8px', border: '1px solid #cbd5e1', padding: '10px 12px', fontSize: '13px', fontFamily: 'inherit', resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Terms & Conditions</label>
                    <span style={{ fontSize: '10px', color: '#94A3B8' }}>Select a preset to auto-fill</span>
                  </div>

                  {/* Clean Preset Pill Buttons */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                    rows="5"
                    placeholder="Select a preset above or type custom Terms & Conditions..."
                    style={{ borderRadius: '8px', border: '1px solid #cbd5e1', padding: '10px 12px', fontSize: '12px', fontFamily: 'inherit', resize: 'vertical', minHeight: '110px', backgroundColor: '#FFFFFF' }}
                  />
                </div>

                {/* Attach File(s) Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                      Attach File(s) to Delivery Challan
                    </label>
                    <span style={{ fontSize: '10px', color: '#94A3B8' }}>Max 5 files, 10MB each</span>
                  </div>
                  <label style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#F8FAFC',
                    border: '1px dashed #CBD5E1',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#0E7490',
                    cursor: 'pointer',
                    width: 'fit-content'
                  }}>
                    <Upload size={14} /> Upload File
                    <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                  {attachedFiles.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      {attachedFiles.map((f, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 10px', backgroundColor: '#F1F5F9', borderRadius: '6px', fontSize: '11px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1E293B' }}>
                            <Paperclip size={12} style={{ color: '#64748B' }} /> {f.name} ({f.size})
                          </span>
                          <button type="button" onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer' }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Calculations Summary Details Card (matching PO style) */}
              <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#f8fafc', height: 'fit-content' }}>
                <strong style={{ fontSize: '14px', color: '#2563eb', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                  Summary Details
                </strong>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Subtotal</span>
                  <strong style={{ color: '#334155' }}>
                    ₹ {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Discount (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={discountPct}
                    onChange={(e) => setDiscountPct(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: '60px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', textAlign: 'right', fontSize: '12px' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Total GST Amount</span>
                  <strong style={{ color: '#334155' }}>
                    ₹ {totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Adjustment (₹)
                    <HelpCircle size={12} style={{ color: '#94A3B8' }} title="Add or subtract adjustment" />
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={adjustment}
                    onChange={(e) => setAdjustment(e.target.value)}
                    style={{ width: '100px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', textAlign: 'right', fontSize: '12px' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#64748b' }}>Round Off</span>
                  <strong style={{ color: '#64748b' }}>
                    ₹ {roundOff.toFixed(2)}
                  </strong>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>Grand Total</strong>
                    <span style={{ fontSize: '10.5px', color: '#0E7490', fontWeight: '600' }}>Rule 55 Non-Chargeable</span>
                  </div>
                  <strong style={{ fontSize: '18px', color: '#2563eb' }}>
                    ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

            </div>

          </div>

          {/* Sticky Bottom Action Bar Following with Scroll for Create / Edit Delivery Challan (Exact PO Design) */}
          <div
            className="dc-no-print"
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
                onClick={() => handleSaveDC(true)}
                disabled={isSubmitting}
                style={{
                  height: '40px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#334155',
                  padding: '0 20px',
                  fontWeight: '600',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                  opacity: isSubmitting ? 0.6 : 1
                }}
                onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                onMouseLeave={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                {isSubmitting ? 'Saving...' : 'Save as Draft'}
              </button>

              {/* Cancel */}
              <button
                type="button"
                onClick={() => setViewMode('list')}
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

              {/* Create / Update Delivery Challan */}
              <button
                type="button"
                onClick={() => handleSaveDC(false)}
                disabled={isSubmitting}
                style={{
                  height: '40px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  padding: '0 22px',
                  fontWeight: '600',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  opacity: isSubmitting ? 0.6 : 1
                }}
                onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = '#1D4ED8'; }}
                onMouseLeave={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = '#2563EB'; }}
              >
                {isSubmitting ? 'Submitting...' : viewMode === 'edit' ? 'Save Changes' : 'Create Delivery Challan'}
              </button>
            </div>

            {/* Grand Total Display (Matching PO) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Grand Total:</span>
              <strong style={{ fontSize: '15px', color: '#2563EB', fontWeight: '800' }}>
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

        </div>
      )}

      {/* ==================== VIEW 3: VIEW DETAILS SCREEN (EXACT PO DESIGN) ==================== */}
      {viewMode === 'view' && activeDc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* View Details Header */}
          <div className="dc-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                  View Delivery Challan: {activeDc.dcNo || activeDc.code || activeDc.id}
                </h2>
                <StatusBadge status={activeDc.status || 'Draft'} size="sm" />
              </div>
              <span style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                Issued by {activeDc.companyName} on {activeDc.dcDate || activeDc.date}.
              </span>
            </div>
          </div>

          {/* Cancellation Notice if Cancelled */}
          {String(activeDc.status || '').toLowerCase().includes('cancel') && (
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '10px',
              padding: '12px 18px',
              color: '#991B1B',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertCircle size={18} style={{ color: '#DC2626', flexShrink: 0 }} />
              <div>
                <strong>THIS DELIVERY CHALLAN HAS BEEN CANCELLED</strong>
                <div style={{ fontSize: '12px', marginTop: '2px' }}>
                  Remark: {activeDc.cancellationRemark || activeDc.cancelReason || 'No remark provided'}
                </div>
              </div>
            </div>
          )}

          {/* Official Delivery Challan Header Card (Exact section-card styling from PO) */}
          <div
            id="businz-dc-official-document"
            className="section-card businz-dc-document"
            style={{
              padding: '30px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              position: 'relative',
              borderTop: '4px solid #0E7490',
              backgroundColor: '#FFFFFF',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}
          >
            {/* Header Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#1E293B', margin: 0, letterSpacing: '-0.5px' }}>
                  {activeDc.companyName}
                </h1>
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>{activeDc.companyAddress}</span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '2px' }}>
                  GSTIN: <strong>{activeDc.companyGst}</strong> | State: {activeDc.sourceOfSupply || 'Tamil Nadu'}
                </span>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block',
                  backgroundColor: '#0E7490',
                  color: '#FFFFFF',
                  padding: '4px 14px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontWeight: '900',
                  letterSpacing: '1px',
                  textTransform: 'uppercase'
                }}>
                  DELIVERY CHALLAN
                </span>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '700', marginTop: '4px' }}>
                  (RULE 55 OF CGST RULES, 2017)
                </div>
                <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                  DC No: {activeDc.dcNo || activeDc.code}
                </div>
                <div style={{ fontSize: '12px', color: '#475569' }}>
                  Date: <strong>{activeDc.dcDate || activeDc.date}</strong>
                </div>
              </div>
            </div>

            {/* 3-Column Info Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '18px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              padding: '16px',
              fontSize: '12px',
              border: '1px solid #E2E8F0'
            }}>
              <div>
                <strong style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Consignee / Deliver To
                </strong>
                <span style={{ color: '#0F172A', fontWeight: '800', fontSize: '13px', display: 'block' }}>{activeDc.customerName || 'Customer'}</span>
                {(activeDc.vendorGst || activeDc.gstNo || activeDc.gstin) && (
                  <div style={{ color: '#0E7490', fontWeight: '800', fontSize: '11px', marginTop: '3px', marginBottom: '3px', display: 'inline-block', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', borderRadius: '4px', padding: '1px 6px' }}>
                    GSTIN: <span>{activeDc.vendorGst || activeDc.gstNo || activeDc.gstin}</span>
                  </div>
                )}
                <span style={{ color: '#334155', lineHeight: '1.4', display: 'block', marginTop: '2px' }}>
                  {activeDc.deliveryAddress}
                </span>
              </div>

              <div>
                <strong style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Transport & Logistics
                </strong>
                <div style={{ color: '#334155', lineHeight: '1.6' }}>
                  <div>Vehicle No: <strong>{activeDc.vehicleNo || '—'}</strong></div>
                  <div>Transporter: <strong>{activeDc.transporter || 'Direct Fleet'}</strong></div>
                  <div>LR / Consignment#: <strong>{activeDc.lrNo || '—'}</strong></div>
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Challan Details
                </strong>
                <div style={{ color: '#334155', lineHeight: '1.6' }}>
                  <div>Challan Type: <strong>{activeDc.challanType || 'Job Work'}</strong></div>
                  <div>Reference#: <strong>{activeDc.referenceNo || '—'}</strong></div>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px', width: '30px' }}>#</th>
                    <th style={{ padding: '8px 10px' }}>Description of Goods</th>
                    <th style={{ padding: '8px 10px', width: '80px' }}>Brand</th>
                    <th style={{ padding: '8px 10px', width: '70px' }}>WP</th>
                    <th style={{ padding: '8px 10px', width: '70px', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '8px 10px', width: '85px', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ padding: '8px 10px', width: '75px', textAlign: 'right' }}>Tax %</th>
                    <th style={{ padding: '8px 10px', width: '100px', textAlign: 'right' }}>Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(activeDc.items) && activeDc.items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '8px 10px', color: '#64748B' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 10px', fontWeight: '600', color: '#0F172A' }}>
                        {it.name}
                        {it.description && <div style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 'normal' }}>{it.description}</div>}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#475569' }}>{it.brand || 'VRM'}</td>
                      <td style={{ padding: '8px 10px', color: '#475569' }}>{it.wp || '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>
                        {Number(it.qty || it.dcQty || 1).toLocaleString('en-IN')} {it.unit || ''}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                        ₹ {Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                        {it.tax !== undefined ? `${it.tax}%` : '18%'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                        ₹ {Number(it.amount || ((it.qty || 1) * (it.rate || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations & Statutory Declaration Footer */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '20px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
              <div>
                <strong style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Statutory Rule 55 Declaration & Notes
                </strong>
                <p style={{ margin: 0, fontSize: '11px', color: '#334155', lineHeight: '1.4' }}>
                  The goods described above are being transported strictly under Rule 55 of the CGST Rules, 2017. This transaction represents goods movement for {activeDc.challanType || 'Job Work / Approval'} and does not constitute a sale. No sales consideration is payable on this delivery challan.
                </p>
                {activeDc.customerNotes && (
                  <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#475569' }}>
                    <strong>Customer Notes:</strong> {activeDc.customerNotes}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px', color: '#475569', textAlign: 'right' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <strong>₹ {Number(activeDc.subtotal || activeDc.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
                {activeDc.discountPct > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Discount ({activeDc.discountPct}%):</span>
                    <strong>- ₹ {((Number(activeDc.subtotal || 0) * activeDc.discountPct) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                )}
                {activeDc.totalTax > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>GST Amount:</span>
                    <strong>₹ {Number(activeDc.totalTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </div>
                )}
                {activeDc.adjustment !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Adjustment:</span>
                    <strong>₹ {Number(activeDc.adjustment || 0).toFixed(2)}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0E7490', paddingTop: '6px', fontSize: '14px', color: '#0F172A' }}>
                  <strong>Total Value:</strong>
                  <strong style={{ color: '#0E7490' }}>₹ {Number(activeDc.totalAmount || activeDc.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>
            </div>

            {/* Signatures Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '20px',
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px dashed #CBD5E1',
              textAlign: 'center',
              fontSize: '11px',
              color: '#64748B'
            }}>
              <div>
                <div style={{ height: '36px' }}></div>
                <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '4px', fontWeight: '700', color: '#334155' }}>
                  Prepared By (Procurement)
                </div>
              </div>
              <div>
                <div style={{ height: '36px' }}></div>
                <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '4px', fontWeight: '700', color: '#334155' }}>
                  Dispatched By (Logistics / Stores)
                </div>
              </div>
              <div>
                <div style={{ height: '36px' }}></div>
                <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '4px', fontWeight: '700', color: '#334155' }}>
                  Received & Acknowledged By Consignee
                </div>
              </div>
            </div>

          </div>

          {/* ==================== JOB WORK RETURN TRACKING & HISTORY CARD ==================== */}
          {(() => {
            const allItems = Array.isArray(activeDc.items) ? activeDc.items : [];
            const returnsList = Array.isArray(activeDc.returns) ? activeDc.returns : [];

            // Compute per-item return stats
            let totalSent = 0;
            let totalReturned = 0;

            const itemStats = allItems.map((it, idx) => {
              const sentQty = Number(it.qty || it.dcQty || 1);
              totalSent += sentQty;
              const matchingReturnedItems = [];
              const retQty = returnsList.reduce((sum, ret) => {
                const matchedList = (ret.returnedItems || []).filter(r => (
                  (r.sentItemIdx !== undefined ? r.sentItemIdx === idx : r.itemIdx === idx) ||
                  r.sentItemName === it.name ||
                  r.itemName === it.name
                ));
                matchedList.forEach(m => matchingReturnedItems.push(m));
                return sum + matchedList.reduce((s, m) => s + Number(m.returnedQty || 0), 0);
              }, 0);
              totalReturned += retQty;
              const balance = Math.max(0, sentQty - retQty);
              const receivedNames = Array.from(new Set(
                matchingReturnedItems
                  .map(m => m.receivedItemName || m.itemName)
                  .filter(n => n && n !== (it.name || it.description))
              ));
              return {
                ...it,
                idx,
                sentQty,
                retQty,
                balance,
                receivedNames
              };
            });

            const totalBalance = Math.max(0, totalSent - totalReturned);
            const isFullyReturned = totalSent > 0 && totalBalance === 0;
            const isPartiallyReturned = totalReturned > 0 && totalBalance > 0;
            const isCancelled = String(activeDc.status || '').toLowerCase().includes('cancel');

            return (
              <div className="section-card dc-no-print" style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                {/* Header & Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: '#EFF6FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#2563EB'
                    }}>
                      <Boxes size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1E293B' }}>
                        Job Work Return Tracking & Reconciliation
                      </h3>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>
                        Track materials sent for processing under Rule 55 and received back into inventory.
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {isFullyReturned ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        backgroundColor: '#DCFCE7',
                        color: '#15803D',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}>
                        <CheckCircle size={14} /> Full Return Received (Settled)
                      </span>
                    ) : isPartiallyReturned ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        backgroundColor: '#FEF3C7',
                        color: '#B45309',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}>
                        <Clock size={14} /> Partially Returned ({totalReturned}/{totalSent})
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        backgroundColor: '#F1F5F9',
                        color: '#475569',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}>
                        <Clock size={14} /> Awaiting Return from Vendor
                      </span>
                    )}

                    {!isCancelled && !isFullyReturned && (
                      <button
                        type="button"
                        onClick={() => handleOpenReturnModal(activeDc)}
                        style={{
                          backgroundColor: '#0E7490',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '7px 16px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(14,116,144,0.2)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0891B2'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
                      >
                        <Package size={14} /> Record Return Entry
                      </button>
                    )}
                  </div>
                </div>

                {/* 3 Summary Cards */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '14px'
                }}>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '14px 16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Quantity Sent</span>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#1E293B', marginTop: '4px' }}>
                      {totalSent.toLocaleString('en-IN')} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748B' }}>units</span>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#F0FDF4', padding: '14px 16px', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                    <span style={{ fontSize: '11px', color: '#15803D', fontWeight: '700', textTransform: 'uppercase' }}>Total Received Back</span>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#15803D', marginTop: '4px' }}>
                      {totalReturned.toLocaleString('en-IN')} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#15803D' }}>units</span>
                    </div>
                  </div>

                  <div style={{ backgroundColor: totalBalance > 0 ? '#FFFBEB' : '#F8FAFC', padding: '14px 16px', borderRadius: '10px', border: totalBalance > 0 ? '1px solid #FDE68A' : '1px solid #E2E8F0' }}>
                    <span style={{ fontSize: '11px', color: totalBalance > 0 ? '#92400E' : '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Remaining with Vendor</span>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: totalBalance > 0 ? '#B45309' : '#059669', marginTop: '4px' }}>
                      {totalBalance.toLocaleString('en-IN')} <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#64748B' }}>units</span>
                    </div>
                  </div>
                </div>

                {/* Per-Item Reconciliation Table */}
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#334155', margin: '0 0 10px 0' }}>
                    Item-wise Return Status
                  </h4>
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>
                          <th style={{ padding: '8px 12px' }}>S.No</th>
                          <th style={{ padding: '8px 12px' }}>Item Description</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Sent Qty</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Returned Qty</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Balance Pending</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemStats.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: idx === itemStats.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                            <td style={{ padding: '8px 12px', color: '#64748B' }}>{idx + 1}</td>
                            <td style={{ padding: '8px 12px', fontWeight: '600', color: '#1E293B' }}>
                              <div>{item.name || item.description}</div>
                              {item.receivedNames && item.receivedNames.length > 0 && (
                                <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '600', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>↳ Inwarded as:</span>
                                  <span style={{ backgroundColor: '#ECFEFF', padding: '1px 6px', borderRadius: '4px', border: '1px solid #CFFAFE' }}>
                                    {item.receivedNames.join(', ')}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600' }}>{item.sentQty} {item.unit || ''}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: '#15803D' }}>{item.retQty} {item.unit || ''}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: item.balance > 0 ? '#B45309' : '#059669' }}>
                              {item.balance} {item.unit || ''}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              {item.balance === 0 ? (
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#15803D', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '10px' }}>
                                  Fully Returned
                                </span>
                              ) : item.retQty > 0 ? (
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#B45309', backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '10px' }}>
                                  Partial
                                </span>
                              ) : (
                                <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', backgroundColor: '#F1F5F9', padding: '2px 8px', borderRadius: '10px' }}>
                                  Pending
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Return Consignments Log */}
                {returnsList.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#334155', margin: '0 0 10px 0' }}>
                      Return Consignments Inwarded ({returnsList.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {returnsList.map((ret, rIdx) => (
                        <div key={rIdx} style={{
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          borderRadius: '8px',
                          padding: '12px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#0E7490', color: '#FFFFFF', padding: '2px 8px', borderRadius: '4px' }}>
                                #{rIdx + 1}
                              </span>
                              <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                                Return Date: {ret.returnDate}
                              </strong>
                              {ret.returnRef && (
                                <span style={{ fontSize: '12px', color: '#64748B' }}>
                                  (Ref: <strong>{ret.returnRef}</strong>)
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '11.5px', color: '#475569' }}>
                              Received By: <strong>{ret.receivedBy}</strong>
                            </span>
                          </div>

                          {/* Items in this return */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                            {(ret.returnedItems || []).map((ri, riIdx) => {
                              const isDiff = ri.sentItemName && ri.sentItemName !== (ri.receivedItemName || ri.itemName);
                              return (
                                <span key={riIdx} style={{
                                  fontSize: '11px',
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: '6px',
                                  padding: '3px 8px',
                                  color: '#334155',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}>
                                  <strong style={{ color: '#0E7490' }}>{ri.receivedItemName || ri.itemName}</strong>
                                  {isDiff && (
                                    <span style={{ color: '#64748B', fontSize: '10.5px' }}>
                                      (from {ri.sentItemName})
                                    </span>
                                  )}
                                  <span style={{ fontWeight: '700', color: '#15803D' }}>
                                    +{ri.returnedQty} {ri.unit || ''}
                                  </span>
                                </span>
                              );
                            })}
                          </div>

                          {ret.remarks && (
                            <div style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic', marginTop: '2px' }}>
                              Notes: {ret.remarks}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Sticky Bottom Action Bar Following with Scroll for View Delivery Challan */}
          <div
            className="dc-no-print"
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
              marginTop: '16px',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* 1. Back to DC List */}
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                Back to DC List
              </button>

              {/* 2. Receive Back Button */}
              {!['cancelled', 'closed'].some(s => String(activeDc.status || '').toLowerCase().includes(s)) && (
                <button
                  type="button"
                  onClick={() => handleOpenReturnModal(activeDc)}
                  style={{
                    backgroundColor: '#0E7490',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    boxShadow: '0 2px 6px rgba(14,116,144,0.3)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0891B2'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
                >
                  <Package size={15} /> Receive Back
                </button>
              )}

              {/* 3. Edit Info */}
              {!String(activeDc.status || '').toLowerCase().includes('cancel') && (
                <button
                  type="button"
                  onClick={() => handleStartEdit(activeDc)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                >
                  <Edit3 size={14} style={{ color: '#64748B' }} /> Edit Info
                </button>
              )}

              {/* 4. Export / Print PDF */}
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                <FileText size={14} style={{ color: '#059669' }} /> Export / Print PDF
              </button>
            </div>

            {/* Right: Total Value Display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>DC Total:</span>
              <strong style={{ fontSize: '15px', color: '#0E7490', fontWeight: '800' }}>
                ₹ {Number(activeDc.totalAmount || activeDc.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

        </div>
      )}

      {/* ==================== MODAL: CANCEL DELIVERY CHALLAN ==================== */}
      {cancellingDc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#FEF2F2' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                <Ban size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#991B1B' }}>
                  Cancel Delivery Challan
                </h3>
                <span style={{ fontSize: '12px', color: '#7F1D1D' }}>
                  DC No: <strong>{cancellingDc.dcNo || cancellingDc.id}</strong>
                </span>
              </div>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.4' }}>
                Cancelling this Delivery Challan will mark its status as <strong>Cancelled</strong> and restore any outward-deducted inventory stock back into available stores.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#0F172A', marginBottom: '6px' }}>
                  Cancellation Remark / Reason <span style={{ color: '#EF4444' }}>* (Mandatory)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Specify why this delivery challan is being cancelled (e.g. Order cancelled by client, incorrect items loaded, duplicate challan)..."
                  value={cancellationRemarkInput}
                  onChange={(e) => setCancellationRemarkInput(e.target.value)}
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: '#1E293B',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { setCancellingDc(null); setCancellationRemarkInput(''); }}
                disabled={cancelSubmitting}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelSubmitting || !cancellationRemarkInput.trim()}
                style={{
                  backgroundColor: (!cancellationRemarkInput.trim() || cancelSubmitting) ? '#FCA5A5' : '#DC2626',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#FFFFFF',
                  cursor: (!cancellationRemarkInput.trim() || cancelSubmitting) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {cancelSubmitting ? 'Cancelling…' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: ADD ITEMS IN BULK ==================== */}
      {showBulkItemModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
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
            {/* Header */}
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
                    Select materials or items from your directory to insert into this Delivery Challan
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
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0 12px', height: '36px' }}>
                <Search size={15} style={{ color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Search materials or products…"
                  value={bulkItemSearch}
                  onChange={(e) => setBulkItemSearch(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#1E293B' }}
                />
              </div>
            </div>

            {/* Item List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {availableInventoryItems
                .filter(it => !bulkItemSearch || (it.name || '').toLowerCase().includes(bulkItemSearch.toLowerCase()))
                .map((it, idx) => {
                  const key = it.code || it.name || `bulk-${idx}`;
                  const isChecked = Boolean(selectedBulkItems[key]);
                  return (
                    <div
                      key={key}
                      onClick={() => handleBulkToggle(key, it)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: isChecked ? '1.5px solid #0E7490' : '1px solid #E2E8F0',
                        backgroundColor: isChecked ? '#ECFEFF' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                        />
                        <div>
                          <strong style={{ fontSize: '13px', color: '#0F172A', display: 'block' }}>{it.name}</strong>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>
                            {it.category || 'Raw Material'} | UOM: {it.unit || 'NOS'} | Rate: ₹{it.rate || 0}
                          </span>
                        </div>
                      </div>

                      {isChecked && (
                        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: '#475569' }}>Qty:</span>
                          <input
                            type="number"
                            min={1}
                            value={selectedBulkItems[key]?.qty || 1}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 1;
                              setSelectedBulkItems(prev => ({
                                ...prev,
                                [key]: { ...prev[key], qty: v }
                              }));
                            }}
                            style={{
                              width: '60px',
                              height: '28px',
                              borderRadius: '6px',
                              border: '1px solid #0E7490',
                              textAlign: 'center',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: '#0E7490'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: '600' }}>
                {Object.keys(selectedBulkItems).length} item(s) selected
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowBulkItemModal(false)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkAdd}
                  disabled={Object.keys(selectedBulkItems).length === 0}
                  style={{
                    backgroundColor: Object.keys(selectedBulkItems).length === 0 ? '#94A3B8' : '#0E7490',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#FFFFFF',
                    cursor: Object.keys(selectedBulkItems).length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Add Selected Items to DC
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: CONFIGURE DELIVERY CHALLAN# PREFERENCES (EXACT ZOHO BOOKS DESIGN) ==================== */}
      {showDcPrefModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1200,
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            width: '100%',
            maxWidth: '560px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden',
            fontFamily: 'inherit'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FFFFFF'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1E293B' }}>
                Configure Delivery Challan# Preferences
              </h3>
              <button
                type="button"
                onClick={() => setShowDcPrefModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'inline-flex'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Location & Associated Series header (matching Zoho Books) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: '12px',
                paddingBottom: '12px',
                borderBottom: '1px solid #F1F5F9'
              }}>
                <div>
                  <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '600' }}>Location</span>
                  <strong style={{ fontSize: '12.5px', color: '#1E293B' }}>VRM Structures India Pvt Ltd</strong>
                </div>
                <div>
                  <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '600' }}>Associated Series</span>
                  <span style={{ fontSize: '12.5px', color: '#334155', fontWeight: '600' }}>Default Transaction Series</span>
                </div>
              </div>

              {/* Explanatory text */}
              <p style={{ margin: 0, fontSize: '12.5px', color: '#334155', lineHeight: '1.5' }}>
                Your delivery challan numbers are set on auto-generate mode to save your time. Are you sure about changing this setting?
              </p>

              {/* Radio Option 1: Auto-generate */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#1E293B' }}>
                  <input
                    type="radio"
                    name="dc-number-mode"
                    value="auto"
                    checked={tempNumberMode === 'auto'}
                    onChange={() => setTempNumberMode('auto')}
                    style={{ accentColor: '#2563EB', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>Continue auto-generating delivery challan numbers</span>
                  <span title="Numbers will be incremented automatically using prefix and sequential digits." style={{ color: '#94A3B8', display: 'inline-flex', cursor: 'help' }}>
                    <HelpCircle size={13} />
                  </span>
                </label>

                {tempNumberMode === 'auto' && (
                  <div style={{ marginLeft: '24px', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Prefix</label>
                      <input
                        type="text"
                        value={tempPrefix}
                        onChange={(e) => setTempPrefix(e.target.value)}
                        placeholder="e.g. VRMS/JW/26-27/ or DC/26-27/"
                        style={{
                          height: '36px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          padding: '0 10px',
                          fontSize: '13px',
                          color: '#1E293B',
                          fontWeight: '600'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Next Number</label>
                      <input
                        type="text"
                        value={tempNextNum}
                        onChange={(e) => setTempNextNum(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="e.g. 001 or 0271"
                        style={{
                          height: '36px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          padding: '0 10px',
                          fontSize: '13px',
                          color: '#1E293B',
                          fontWeight: '600'
                        }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2', fontSize: '11.5px', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CFFAFE' }}>
                      Resulting Next Challan#: <strong>{tempPrefix}{tempNextNum}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Radio Option 2: Manual entry */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#1E293B' }}>
                  <input
                    type="radio"
                    name="dc-number-mode"
                    value="manual"
                    checked={tempNumberMode === 'manual'}
                    onChange={() => setTempNumberMode('manual')}
                    style={{ accentColor: '#2563EB', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>Enter delivery challan numbers manually</span>
                </label>
                {tempNumberMode === 'manual' && (
                  <div style={{ marginLeft: '24px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Enter Custom Delivery Challan#</label>
                    <input
                      type="text"
                      value={tempManualNum}
                      onChange={(e) => setTempManualNum(e.target.value)}
                      placeholder="e.g. VRMS/JW/26-27/001 or DC/CUSTOM/01"
                      style={{
                        height: '36px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        padding: '0 10px',
                        fontSize: '13px',
                        color: '#1E293B',
                        fontWeight: '600'
                      }}
                    />
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748B' }}>
                      Delivery Challan# on the form will be locked to this custom value.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons (Bottom Left aligned matching Zoho Books) */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              gap: '10px',
              backgroundColor: '#FFFFFF'
            }}>
              <button
                type="button"
                onClick={handleSaveDcPreferences}
                style={{
                  height: '36px',
                  padding: '0 20px',
                  borderRadius: '6px',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowDcPrefModal(false)}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  color: '#334155',
                  fontWeight: '600',
                  fontSize: '13px',
                  border: '1px solid #CBD5E1',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: RECEIVE BACK JOB WORK GOODS ==================== */}
      {showReturnModal && returnDc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100000,
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            width: '100%',
            maxWidth: '840px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
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
                  backgroundColor: '#ECFEFF',
                  color: '#0E7490',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Package size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                    Receive Back Job Work Goods
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span>DC No: <strong style={{ color: '#0E7490' }}>{returnDc.dcNo || returnDc.id}</strong></span>
                    <span>•</span>
                    <span>Vendor: <strong>{returnDc.customerName || returnDc.vendor}</strong></span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setShowReturnModal(false); setReturnDc(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Row 1: Return Date | Vendor Challan | Received By */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                    Return Date <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    required
                    style={{
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      padding: '0 10px',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                    Vendor Challan
                  </label>
                  <input
                    type="text"
                    value={returnRef}
                    onChange={(e) => setReturnRef(e.target.value)}
                    placeholder="e.g. VEND-DC-881"
                    style={{
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      padding: '0 10px',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                    Received By <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={returnReceivedBy}
                    onChange={(e) => setReturnReceivedBy(e.target.value)}
                    placeholder="e.g. Ramesh"
                    required
                    style={{
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      padding: '0 10px',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              {/* SECTION 1: OUTWARD MATERIAL SENT REFERENCE (JOB WORK REFERENCE) */}
              <div style={{ backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Boxes size={15} style={{ color: '#0E7490' }} />
                    <span>1. Outward Material Sent (Job Work Reference)</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Original Delivery Challan Goods Movement
                  </span>
                </div>

                <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F1F5F9', color: '#475569', borderBottom: '1px solid #CBD5E1' }}>
                        <th style={{ padding: '7px 10px', width: '45px' }}>S.No</th>
                        <th style={{ padding: '7px 10px' }}>Sent Material Description</th>
                        <th style={{ padding: '7px 10px', textAlign: 'right' }}>Sent Qty</th>
                        <th style={{ padding: '7px 10px', textAlign: 'right' }}>Already Received</th>
                        <th style={{ padding: '7px 10px', textAlign: 'right' }}>Remaining Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(returnDc?.items || []).map((it, idx) => {
                        const sentQty = Number(it.qty || it.dcQty || 1);
                        const alreadyReturned = (returnDc?.returns || []).reduce((sum, ret) => {
                          const matched = (ret.returnedItems || []).filter(r => (
                            (r.sentItemIdx !== undefined ? r.sentItemIdx === idx : r.itemIdx === idx) ||
                            r.sentItemName === it.name ||
                            r.itemName === it.name
                          ));
                          return sum + matched.reduce((s, m) => s + Number(m.returnedQty || 0), 0);
                        }, 0);
                        const remaining = Math.max(0, sentQty - alreadyReturned);

                        return (
                          <tr key={idx} style={{ borderBottom: idx === (returnDc?.items || []).length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                            <td style={{ padding: '7px 10px', color: '#64748B' }}>{idx + 1}</td>
                            <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                              {it.name || it.description}
                            </td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '600' }}>
                              {sentQty} {it.unit || ''}
                            </td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: '#15803D', fontWeight: '600' }}>
                              {alreadyReturned} {it.unit || ''}
                            </td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '800', color: remaining > 0 ? '#B45309' : '#059669' }}>
                              {remaining} {it.unit || ''}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 2: RECEIVED PRODUCTS (SEPARATE SECTION) */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1.5px solid #0E7490', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0E7490', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Package size={16} />
                      <span>2. Received Product <span style={{ color: '#EF4444' }}>*</span></span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '2px' }}>
                      Enter the finished goods or processed items received back from job work (e.g. Rod processed into Mini Rail).
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleAddReceivedRow}
                      style={{
                        backgroundColor: '#0E7490',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 2px 4px rgba(14,116,144,0.25)'
                      }}
                    >
                      <Plus size={14} /> Add Received Product
                    </button>
                  </div>
                </div>

                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ padding: '9px 10px', width: '45px' }}>S.No</th>
                        <th style={{ padding: '9px 10px' }}>
                          Received Product <span style={{ color: '#EF4444' }}>*</span>
                        </th>
                        <th style={{ padding: '9px 10px', textAlign: 'right', width: '130px' }}>
                          Received Qty <span style={{ color: '#EF4444' }}>*</span>
                        </th>
                        <th style={{ padding: '9px 10px', width: '90px' }}>Unit</th>
                        <th style={{ padding: '9px 6px', width: '32px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnReceivedRows.map((row, idx) => {
                        return (
                          <tr key={row.id || idx} style={{ borderBottom: idx === returnReceivedRows.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                            <td style={{ padding: '8px 10px', color: '#64748B', verticalAlign: 'middle' }}>{idx + 1}</td>

                            {/* Received Product */}
                            <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                              <input
                                type="text"
                                value={row.receivedItemName}
                                onChange={(e) => handleUpdateReceivedRow(idx, 'receivedItemName', e.target.value)}
                                placeholder="e.g. Mini Rail, Finished Goods"
                                required
                                style={{
                                  width: '100%',
                                  height: '34px',
                                  borderRadius: '6px',
                                  border: '1px solid #0E7490',
                                  padding: '0 10px',
                                  fontSize: '13px',
                                  fontWeight: '700',
                                  color: '#0F172A',
                                  backgroundColor: '#FFFFFF',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </td>

                            {/* Received Qty */}
                            <td style={{ padding: '6px 10px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={row.receivedQty}
                                onChange={(e) => handleUpdateReceivedRow(idx, 'receivedQty', Math.max(0, Number(e.target.value) || 0))}
                                style={{
                                  width: '110px',
                                  height: '34px',
                                  borderRadius: '6px',
                                  border: '1px solid #0E7490',
                                  padding: '0 8px',
                                  textAlign: 'right',
                                  fontSize: '13px',
                                  fontWeight: '700',
                                  color: '#0E7490'
                                }}
                              />
                            </td>

                            {/* Unit */}
                            <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                              <input
                                type="text"
                                value={row.unit}
                                onChange={(e) => handleUpdateReceivedRow(idx, 'unit', e.target.value)}
                                placeholder="Unit"
                                style={{
                                  width: '80px',
                                  height: '34px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                  padding: '0 8px',
                                  fontSize: '12px',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </td>

                            {/* Action (Remove row) */}
                            <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                              {returnReceivedRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveReceivedRow(idx)}
                                  title="Remove item"
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    color: '#94A3B8',
                                    cursor: 'pointer',
                                    padding: '4px'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks / Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                  Inspection / Quality Notes
                </label>
                <textarea
                  rows={2}
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  placeholder="e.g. Received in good order, machining completed as per drawing, zero defects observed..."
                  style={{
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    padding: '8px 10px',
                    fontSize: '12.5px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Statutory Note */}
              <div style={{
                backgroundColor: '#F8FAFC',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '11.5px',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Shield size={16} style={{ color: '#0E7490', flexShrink: 0 }} />
                <span>
                  Acknowledging this return automatically credits inventory stock back for the received quantities and sets the DC status to <strong>Partially Returned</strong> or <strong>Closed</strong>.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: '#FFFFFF'
            }}>
              <button
                type="button"
                onClick={() => { setShowReturnModal(false); setReturnDc(null); }}
                style={{
                  height: '38px',
                  padding: '0 18px',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontWeight: '600',
                  fontSize: '13px',
                  border: '1px solid #CBD5E1',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveReturn}
                disabled={returnSubmitting}
                style={{
                  height: '38px',
                  padding: '0 22px',
                  borderRadius: '8px',
                  backgroundColor: '#0E7490',
                  color: '#FFFFFF',
                  fontWeight: '700',
                  fontSize: '13px',
                  border: 'none',
                  cursor: returnSubmitting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(14,116,144,0.3)'
                }}
                onMouseEnter={(e) => { if (!returnSubmitting) e.currentTarget.style.backgroundColor = '#0891B2'; }}
                onMouseLeave={(e) => { if (!returnSubmitting) e.currentTarget.style.backgroundColor = '#0E7490'; }}
              >
                <CheckCircle size={15} />
                {returnSubmitting ? 'Inwarding...' : 'Confirm Goods Receipt & Inward'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
