import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Truck, Search, Plus, Filter, Calendar, ChevronDown, ChevronLeft, ChevronRight,
  Eye, Edit3, Trash2, Printer, FileText, CheckCircle, Clock, AlertCircle, Ban,
  Building2, ArrowLeft, Send, Check, X, Shield, RefreshCw, Upload, Download,
  Layers, Package, DollarSign, HelpCircle, Paperclip, ChevronUp, Boxes
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { centralInventoryStore } from '../utils/centralInventoryStore';
import { saveCloudStore, fetchCloudStore } from '../utils/supabaseDataSync';
import { getNextSequence } from '../utils/sequenceGenerator';
import { getHsnCode } from '../utils/hsnCodeService';

// ==================== COMPANY PROFILES (OFFICIAL BUSINZ LOCATIONS) ====================
export const COMPANY_LOCATIONS = {
  'VRM Structures (Madhavaram)': {
    name: 'VRM Structures India Pvt Ltd',
    locationLabel: 'VRM Structures (Madhavaram)',
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

export const getCompanyProfile = (locationKey) => {
  if (!locationKey) return COMPANY_LOCATIONS['VRM Structures (Madhavaram)'];
  const norm = String(locationKey).trim().toLowerCase();
  if (norm.includes('ap') || norm.includes('andhra') || norm.includes('tada') || norm.includes('nellore')) {
    return COMPANY_LOCATIONS['VRM Structures (AP)'];
  }
  if (norm.includes('jash') || norm.includes('sun')) {
    return COMPANY_LOCATIONS['Jashsun'];
  }
  return COMPANY_LOCATIONS['VRM Structures (Madhavaram)'];
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

const TAX_OPTIONS = [
  { label: 'Select a Tax', rate: 0 },
  { label: 'GST 18% [18%]', rate: 18 },
  { label: 'GST 12% [12%]', rate: 12 },
  { label: 'GST 5% [5%]', rate: 5 },
  { label: 'GST 28% [28%]', rate: 28 },
  { label: 'Exempt / 0% [0%]', rate: 0 }
];

export default function DeliveryChallansView({ userRole = 'Procurement Head', onNavigateTab }) {
  // ==================== STATE MANAGEMENT ====================
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'create' | 'edit' | 'view'
  const [dcList, setDcList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDCs, setSelectedDCs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Challans');
  const [dateFilter, setDateFilter] = useState('All Dates');

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

  // ==================== FORM STATE (MATCHES ZOHO BOOKS FIELDS) ====================
  const [companyLocation, setCompanyLocation] = useState('VRM Structures (Madhavaram)');
  const [customerName, setCustomerName] = useState('');
  const [dcNumber, setDcNumber] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [dcDate, setDcDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [challanType, setChallanType] = useState('For Job Work');
  const [warehouseLocation, setWarehouseLocation] = useState('VRM Structures - Madhavaram Main Warehouse');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [transporter, setTransporter] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [lrNo, setLrNo] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState(
    '1. The goods transported under this Delivery Challan are strictly subject to Rule 55 of CGST Rules, 2017.\n2. This goods movement is non-chargeable and not for sale consideration.\n3. Goods must be inspected upon delivery and acknowledged on the consignee copy.'
  );
  const [adjustment, setAdjustment] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState([]);

  // Line items state
  const [items, setItems] = useState([]);

  // Bulk Item Modal
  const [showBulkItemModal, setShowBulkItemModal] = useState(false);
  const [bulkItemSearch, setBulkItemSearch] = useState('');
  const [bulkCategoryFilter, setBulkCategoryFilter] = useState('All');
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
    setLoading(true);
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

    // Clean dummy demo seed records if present
    loaded = loaded.filter(d =>
      !(d.dcNo === 'DC-2026-0001' && d.customerName === 'Tata Power Solar Systems Ltd') &&
      !(d.dcNo === 'DC-2026-0002' && d.customerName === 'Adani Solar Energy')
    );

    setDcList(loaded);
    setLoading(false);
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
            const gst = (b.gstNo || b.gst || '').trim();
            if (name && !custMap.has(name.toLowerCase())) {
              custMap.set(name.toLowerCase(), { name, address: addr, gst });
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
              custMap.set(name.toLowerCase(), { name, address: addr, gst });
            }
          });
        }
      }
    } catch (_) {}

    setKnownCustomers(Array.from(custMap.values()));
  }, []);

  // Generate next sequential DC Number
  const fetchNextDcNumber = () => {
    try {
      const seq = getNextSequence('DC', dcList);
      return seq.code || `DC/26-27/${String(dcList.length + 1).padStart(4, '0')}`;
    } catch (_) {}
    return `DC/26-27/${String(dcList.length + 1).padStart(4, '0')}`;
  };

  // ==================== FORM HELPERS ====================
  const handleAddNewRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: '',
        brand: 'VRM',
        wp: '',
        qty: 1,
        rate: 0,
        discountPct: 0,
        taxRate: 18,
        hsn: '7308'
      }
    ]);
  };

  const handleUpdateItem = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      const target = { ...updated[index] };
      if (field === 'qty' || field === 'rate' || field === 'discountPct' || field === 'taxRate') {
        target[field] = value === '' ? '' : Number(value);
      } else {
        target[field] = value;
      }
      updated[index] = target;
      return updated;
    });
  };

  const handleRemoveItem = (index) => {
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleCustomerSelect = (custVal) => {
    setCustomerName(custVal);
    const matched = knownCustomers.find(c => c.name.toLowerCase() === custVal.toLowerCase());
    if (matched && matched.address && (!deliveryAddress || deliveryAddress.trim() === '')) {
      setDeliveryAddress(matched.address);
    }
  };

  // Calculations
  const calculatedTotals = useMemo(() => {
    let subTotal = 0;
    let totalTax = 0;

    items.forEach(it => {
      const q = parseFloat(it.qty) || 0;
      const r = parseFloat(it.rate) || 0;
      const dPct = parseFloat(it.discountPct) || 0;
      const taxRate = parseFloat(it.taxRate) || 0;

      const baseAmount = q * r;
      const discountAmount = (baseAmount * dPct) / 100;
      const taxable = Math.max(0, baseAmount - discountAmount);
      const taxVal = (taxable * taxRate) / 100;

      subTotal += taxable;
      totalTax += taxVal;
    });

    const netBeforeAdj = subTotal + totalTax;
    const adj = parseFloat(adjustment) || 0;
    const unroundedTotal = netBeforeAdj + adj;
    const roundedTotal = Math.round(unroundedTotal);
    const roundOff = (roundedTotal - unroundedTotal);

    return {
      subTotal: Number(subTotal.toFixed(2)),
      totalTax: Number(totalTax.toFixed(2)),
      roundOff: Number(roundOff.toFixed(2)),
      total: Number(roundedTotal.toFixed(2))
    };
  }, [items, adjustment]);

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

  // Reset form
  const resetForm = () => {
    setCompanyLocation('VRM Structures (Madhavaram)');
    setCustomerName('');
    setDcNumber(fetchNextDcNumber());
    setReferenceNo('');
    setDcDate(new Date().toISOString().split('T')[0]);
    setChallanType('For Job Work');
    setWarehouseLocation('VRM Structures - Madhavaram Main Warehouse');
    setDeliveryAddress('');
    setTransporter('');
    setVehicleNo('');
    setLrNo('');
    setCustomerNotes('');
    setAdjustment(0);
    setAttachedFiles([]);
    setItems([]);
    setEditIdx(null);
    setActiveDc(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setDcNumber(fetchNextDcNumber());
    setViewMode('create');
  };

  const handleStartEdit = (dc) => {
    setActiveDc(dc);
    setEditIdx(dcList.findIndex(d => (d.dcNo === dc.dcNo || d.id === dc.id)));
    setCompanyLocation(dc.companyLocation || dc.branch || 'VRM Structures (Madhavaram)');
    setCustomerName(dc.customerName || dc.vendor || '');
    setDcNumber(dc.dcNo || dc.code || '');
    setReferenceNo(dc.referenceNo || dc.refNo || dc.bomCode || '');
    setDcDate(dc.dcDate || dc.date || new Date().toISOString().split('T')[0]);
    setChallanType(dc.challanType || 'For Job Work');
    setWarehouseLocation(dc.warehouseLocation || 'VRM Structures - Madhavaram Main Warehouse');
    setDeliveryAddress(dc.deliveryAddress || '');
    setTransporter(dc.transporter || '');
    setVehicleNo(dc.vehicleNo || '');
    setLrNo(dc.lrNo || '');
    setCustomerNotes(dc.customerNotes || dc.notes || '');
    setTermsAndConditions(dc.termsAndConditions || dc.terms || '');
    setAdjustment(dc.adjustment || 0);
    setAttachedFiles(dc.attachedFiles || []);

    const loadedItems = Array.isArray(dc.items) ? dc.items.map((it, idx) => ({
      id: it.id || `item-${idx}`,
      name: it.name || it.description || '',
      brand: it.brand || 'VRM',
      wp: it.wp || it.spec || '',
      qty: Number(it.qty || it.dcQty || 1),
      rate: Number(it.rate || 0),
      discountPct: Number(it.discountPct || it.discount || 0),
      taxRate: Number(it.taxRate !== undefined ? it.taxRate : (it.tax || 18)),
      hsn: it.hsn || '7308'
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
      alert("⚠️ Customer Name is mandatory.");
      return;
    }
    if (!dcNumber || dcNumber.trim() === '') {
      alert("⚠️ Delivery Challan# is mandatory.");
      return;
    }
    if (items.length === 0) {
      alert("⚠️ Please add at least one line item to the Delivery Challan.");
      return;
    }

    const compProfile = getCompanyProfile(companyLocation);
    const effStatus = isDraft ? 'Draft' : 'In Transit';

    const newRecord = {
      id: dcNumber.trim(),
      code: dcNumber.trim(),
      dcNo: dcNumber.trim(),
      status: effStatus,
      statusType: isDraft ? 'draft' : 'in_transit',
      companyLocation,
      companyName: compProfile.name,
      companyAddress: compProfile.address,
      companyGst: compProfile.gst,
      sourceOfSupply: compProfile.state,
      customerName: customerName.trim(),
      vendor: customerName.trim(),
      deliveryAddress: deliveryAddress.trim() || 'Client Delivery Site',
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
      termsAndConditions: termsAndConditions.trim(),
      adjustment: parseFloat(adjustment) || 0,
      subTotal: calculatedTotals.subTotal,
      taxTotal: calculatedTotals.totalTax,
      roundOff: calculatedTotals.roundOff,
      totalAmount: calculatedTotals.total,
      totalValue: calculatedTotals.total,
      attachedFiles,
      items: items.map(it => {
        const q = parseFloat(it.qty) || 0;
        const r = parseFloat(it.rate) || 0;
        const dPct = parseFloat(it.discountPct) || 0;
        const taxR = parseFloat(it.taxRate) || 0;
        const taxable = Math.max(0, (q * r) - ((q * r * dPct) / 100));
        const amount = taxable + (taxable * taxR) / 100;
        return {
          ...it,
          dcQty: q,
          amount: Number(amount.toFixed(2))
        };
      }),
      createdAt: activeDc?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 1. Deduct Central Inventory Stock immediately if not draft
    if (!isDraft) {
      try {
        centralInventoryStore.deductStockForDC(
          newRecord.dcNo,
          newRecord.referenceNo || 'DIRECT',
          newRecord.items,
          'Procurement Head'
        );
      } catch (err) {
        console.warn("Stock deduction warning:", err);
      }
    }

    // 2. Persist locally
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

    // 3. Persist to server / Supabase
    try {
      await fetch('/api/deliverychallans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRecord)
      });
      saveCloudStore('delivery_challan_store', updatedList);
    } catch (_) {}

    showCustomAlert(
      `Delivery Challan ${newRecord.dcNo} ${isDraft ? 'saved as Draft' : 'issued & marked In Transit'} successfully!`,
      isDraft ? 'Draft Saved' : 'Challan Issued',
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
        brand: 'VRM',
        wp: '',
        qty: Number(entry.qty) || 1,
        rate: Number(it.rate) || 0,
        discountPct: 0,
        taxRate: Number(it.tax !== undefined ? it.tax : 18),
        hsn: it.hsn || '7308'
      };
    });
    setItems(prev => [...prev, ...added]);
    setShowBulkItemModal(false);
    setSelectedBulkItems({});
    setBulkItemSearch('');
    showCustomAlert(`Added ${added.length} items to Delivery Challan.`, 'Items Added in Bulk', 'success');
  };

  // ==================== FILTERING & PAGINATION ====================
  const filteredList = useMemo(() => {
    return dcList.filter(d => {
      const dcNum = String(d.dcNo || d.id || d.code || '').toLowerCase();
      const cust = String(d.customerName || d.vendor || '').toLowerCase();
      const ref = String(d.referenceNo || d.refNo || d.bomCode || '').toLowerCase();
      const veh = String(d.vehicleNo || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || dcNum.includes(q) || cust.includes(q) || ref.includes(q) || veh.includes(q);

      const st = String(d.status || 'Draft').trim();
      let matchesStatus = true;
      if (statusFilter === 'Draft') matchesStatus = st.toLowerCase().includes('draft');
      else if (statusFilter === 'In Transit') matchesStatus = st.toLowerCase().includes('transit');
      else if (statusFilter === 'Delivered') matchesStatus = st.toLowerCase().includes('deliver') || st.toLowerCase().includes('closed');
      else if (statusFilter === 'Cancelled') matchesStatus = st.toLowerCase().includes('cancel');

      return matchesSearch && matchesStatus;
    });
  }, [dcList, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredList.length / rowsPerPage) || 1;
  const indexOfFirstRow = (currentPage - 1) * rowsPerPage;
  const indexOfLastRow = indexOfFirstRow + rowsPerPage;
  const currentDisplayedRows = filteredList.slice(indexOfFirstRow, indexOfLastRow);

  const statusCounts = useMemo(() => {
    return {
      all: dcList.length,
      draft: dcList.filter(d => String(d.status || '').toLowerCase().includes('draft')).length,
      inTransit: dcList.filter(d => String(d.status || '').toLowerCase().includes('transit')).length,
      delivered: dcList.filter(d => String(d.status || '').toLowerCase().includes('deliver') || String(d.status || '').toLowerCase().includes('closed')).length,
      cancelled: dcList.filter(d => String(d.status || '').toLowerCase().includes('cancel')).length
    };
  }, [dcList]);

  // ==================== RENDER STATUS BADGE ====================
  const renderDcStatusBadge = (statusStr) => {
    const raw = String(statusStr || 'Draft').trim();
    if (raw.toLowerCase().includes('cancel')) {
      return <StatusBadge status="Cancelled" customLabel="Cancelled" size="sm" />;
    }
    if (raw.toLowerCase().includes('transit')) {
      return <StatusBadge status="In Transit" customLabel="In Transit" size="sm" />;
    }
    if (raw.toLowerCase().includes('deliver') || raw.toLowerCase().includes('closed')) {
      return <StatusBadge status="Delivered" customLabel="Delivered" size="sm" />;
    }
    return <StatusBadge status="Draft" customLabel="Draft" size="sm" />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: "'DM Sans', sans-serif" }}>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Top Header Card */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.4px' }}>
                Delivery Challans (DC)
              </h1>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
                Generate, track, and dispatch statutory delivery challans under Rule 55 CGST for goods transit, job work, and consignments.
              </p>
            </div>

            <button
              onClick={handleStartCreate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#0E7490',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 20px',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(14, 116, 144, 0.3)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0891B2'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0E7490'}
            >
              <Plus size={16} /> Create Delivery Challan
            </button>
          </div>

          {/* Search Bar & Quick Filters */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            padding: '12px 16px',
            border: '1px solid #E2E8F0',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px' }}>
              <Search size={16} style={{ color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search Delivery Challans (DC No, Customer Name, Reference, Vehicle No)..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '13.5px',
                  width: '100%',
                  color: '#1E293B'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Date Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 12px', backgroundColor: '#F8FAFC' }}>
                <Calendar size={14} style={{ color: '#64748B' }} />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '12.5px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}
                >
                  <option value="All Dates">All Dates</option>
                  <option value="Today">Today</option>
                  <option value="This Month">This Month</option>
                </select>
              </div>

              {/* Status Filter Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '6px 12px', backgroundColor: '#F8FAFC' }}>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '12.5px', fontWeight: '700', color: '#0E7490', cursor: 'pointer' }}
                >
                  <option value="All Challans">All Challans</option>
                  <option value="Draft">Draft</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <button
                onClick={loadDeliveryChallans}
                title="Refresh table"
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Status Tabs Row */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '2px', overflowX: 'auto' }}>
            {[
              { label: 'All Challans', count: statusCounts.all },
              { label: 'Draft', count: statusCounts.draft },
              { label: 'In Transit', count: statusCounts.inTransit },
              { label: 'Delivered', count: statusCounts.delivered },
              { label: 'Cancelled', count: statusCounts.cancelled }
            ].map(tab => {
              const isActive = statusFilter === tab.label;
              return (
                <button
                  key={tab.label}
                  onClick={() => { setStatusFilter(tab.label); setCurrentPage(1); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    borderBottom: isActive ? '3px solid #0E7490' : '3px solid transparent',
                    backgroundColor: 'transparent',
                    color: isActive ? '#0E7490' : '#64748B',
                    fontWeight: isActive ? '700' : '500',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                  <span style={{
                    backgroundColor: isActive ? '#ECFEFF' : '#F1F5F9',
                    color: isActive ? '#0E7490' : '#64748B',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '1px 7px',
                    borderRadius: '10px'
                  }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Delivery Challans Standard Table Card */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    <th style={{ padding: '14px 16px', width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={currentDisplayedRows.length > 0 && currentDisplayedRows.every(r => selectedDCs.includes(r.dcNo || r.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const newSelected = Array.from(new Set([...selectedDCs, ...currentDisplayedRows.map(r => r.dcNo || r.id)]));
                            setSelectedDCs(newSelected);
                          } else {
                            const pageIds = currentDisplayedRows.map(r => r.dcNo || r.id);
                            setSelectedDCs(selectedDCs.filter(id => !pageIds.includes(id)));
                          }
                        }}
                        style={{ accentColor: '#0E7490', cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                    </th>
                    <th style={{ padding: '14px 16px', fontWeight: '700' }}>DC Number</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700' }}>Customer / Consignee</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700' }}>Challan Type</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700' }}>DC Date</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700' }}>Warehouse</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700' }}>Reference#</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'right' }}>Total Value</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: '#64748B' }}>
                        Loading Delivery Challans…
                      </td>
                    </tr>
                  ) : currentDisplayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748B' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <Truck size={32} style={{ color: '#CBD5E1' }} />
                          <strong style={{ fontSize: '14px', color: '#1E293B' }}>No Delivery Challans Found</strong>
                          <span style={{ fontSize: '12px' }}>Click "+ Create Delivery Challan" to generate your first delivery challan.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    currentDisplayedRows.map((dc) => {
                      const dcKey = dc.dcNo || dc.id;
                      const isSelected = selectedDCs.includes(dcKey);
                      const isCancelled = String(dc.status || '').toLowerCase().includes('cancel');

                      return (
                        <tr
                          key={dcKey}
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            backgroundColor: isSelected ? '#ECFEFF' : '#FFFFFF',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                          onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                        >
                          <td style={{
                            padding: '12px 16px',
                            borderLeft: isSelected ? '4px solid #0E7490' : '4px solid transparent'
                          }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedDCs(prev => [...prev, dcKey]);
                                else setSelectedDCs(prev => prev.filter(k => k !== dcKey));
                              }}
                              style={{ accentColor: '#0E7490', cursor: 'pointer', width: '16px', height: '16px' }}
                            />
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <button
                              type="button"
                              onClick={() => handleStartView(dc)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                color: '#0E7490',
                                fontWeight: '700',
                                fontSize: '13px',
                                cursor: 'pointer',
                                textDecoration: 'underline'
                              }}
                            >
                              {dc.dcNo || dc.code || dc.id}
                            </button>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#1E293B', fontWeight: '600' }}>
                            {dc.customerName || dc.vendor || '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
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
                          <td style={{ padding: '12px 16px', color: '#64748B' }}>
                            {dc.dcDate || dc.date || '—'}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '12px' }}>
                            {dc.warehouseLocation ? dc.warehouseLocation.replace('VRM Structures - ', '') : 'Main Warehouse'}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748B', fontFamily: 'monospace' }}>
                            {dc.referenceNo || dc.refNo || dc.bomCode || '—'}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                            ₹ {Number(dc.totalAmount || dc.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {renderDcStatusBadge(dc.status)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Standard Pagination Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px',
              borderTop: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '13px',
              color: '#64748B'
            }}>
              {/* Left Side: Rows per page & entries count */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Showing per page:</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    style={{
                      height: '30px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '12px',
                      fontWeight: '600',
                      padding: '0 6px',
                      backgroundColor: '#FFFFFF',
                      color: '#1E293B',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                  </select>
                </div>
                <span>
                  Showing {filteredList.length === 0 ? 0 : indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredList.length)} of {filteredList.length} entries
                </span>
              </div>

              {/* Right Side: Page buttons + Go to page */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    style={{
                      border: '1px solid #CBD5E1',
                      background: currentPage === 1 ? '#F1F5F9' : '#FFFFFF',
                      color: currentPage === 1 ? '#94A3B8' : '#475569',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  >
                    «
                  </button>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{
                      border: '1px solid #CBD5E1',
                      background: currentPage === 1 ? '#F1F5F9' : '#FFFFFF',
                      color: currentPage === 1 ? '#94A3B8' : '#475569',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  >
                    ‹
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                    Math.max(0, currentPage - 2),
                    Math.min(totalPages, currentPage + 1)
                  ).map(pg => (
                    <button
                      key={pg}
                      onClick={() => setCurrentPage(pg)}
                      style={{
                        border: pg === currentPage ? 'none' : '1px solid #CBD5E1',
                        background: pg === currentPage ? '#0E7490' : '#FFFFFF',
                        color: pg === currentPage ? '#FFFFFF' : '#475569',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: pg === currentPage ? '700' : '500',
                        cursor: 'pointer'
                      }}
                    >
                      {pg}
                    </button>
                  ))}

                  <button
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{
                      border: '1px solid #CBD5E1',
                      background: (currentPage === totalPages || totalPages === 0) ? '#F1F5F9' : '#FFFFFF',
                      color: (currentPage === totalPages || totalPages === 0) ? '#94A3B8' : '#475569',
                      cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  >
                    ›
                  </button>
                  <button
                    disabled={currentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage(totalPages)}
                    style={{
                      border: '1px solid #CBD5E1',
                      background: (currentPage === totalPages || totalPages === 0) ? '#F1F5F9' : '#FFFFFF',
                      color: (currentPage === totalPages || totalPages === 0) ? '#94A3B8' : '#475569',
                      cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  >
                    »
                  </button>
                </div>

                {/* Go to page */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Go to page:</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={jumpToPage}
                    onChange={(e) => setJumpToPage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const target = Number(jumpToPage);
                        if (target >= 1 && target <= totalPages) {
                          setCurrentPage(target);
                          setJumpToPage('');
                        }
                      }
                    }}
                    style={{
                      width: '45px',
                      height: '28px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      textAlign: 'center',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const target = Number(jumpToPage);
                      if (target >= 1 && target <= totalPages) {
                        setCurrentPage(target);
                        setJumpToPage('');
                      }
                    }}
                    style={{
                      border: '1px solid #CBD5E1',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      backgroundColor: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      color: '#0E7490'
                    }}
                  >
                    Go ›
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Action Bar (Fixed at Bottom Center, Single Line, No 3-Dot Menu, No Delete) */}
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
              padding: '8px 18px',
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              gap: '10px',
              zIndex: 10000
            }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginRight: '6px' }}>
                {selectedDCs.length} Selected
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
                      border: '1px solid #CBD5E1',
                      color: '#334155',
                      borderRadius: '10px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Edit3 size={14} style={{ color: '#64748B' }} /> Edit Info
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
                  border: '1px solid #CBD5E1',
                  color: '#1E293B',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
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
                  border: '1px solid #CBD5E1',
                  color: '#1E293B',
                  borderRadius: '10px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
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
                  gap: '6px'
                }}
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

      {/* ==================== VIEW 2: CREATE / EDIT DELIVERY CHALLAN FORM ==================== */}
      {(viewMode === 'create' || viewMode === 'edit') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Form Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
              >
                <ArrowLeft size={16} /> Back to DC List
              </button>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  {viewMode === 'edit' ? `Edit Delivery Challan: ${dcNumber}` : 'New Delivery Challan'}
                </h1>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Statutory goods movement document under Rule 55 of CGST Rules, 2017.
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  backgroundColor: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '8px 18px',
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
                onClick={() => handleSaveDC(true)}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1.5px solid #0E7490',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#0E7490',
                  cursor: 'pointer'
                }}
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleSaveDC(false)}
                style={{
                  backgroundColor: '#0E7490',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 22px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(14, 116, 144, 0.25)'
                }}
              >
                {viewMode === 'edit' ? 'Update Delivery Challan' : 'Create Delivery Challan'}
              </button>
            </div>
          </div>

          {/* Section 1: PO Issuing Location (Our Company) - CLEAN, NO BORDER */}
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
                      justifyContent: 'center',
                      fontSize: '18px'
                    }}>
                      🏢
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                          PO Issuing Location (Our Company)
                        </span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '700',
                          backgroundColor: '#ECFEFF',
                          color: '#0E7490',
                          padding: '2px 8px',
                          borderRadius: '12px'
                        }}>
                          Dispatch Entity
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>
                        Choose company issuing location. Its official address and GST number are applied to this Delivery Challan & printout.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>Location:</span>
                    <select
                      value={companyLocation}
                      onChange={(e) => setCompanyLocation(e.target.value)}
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
                      <option value="VRM Structures (Madhavaram)">VRM Structures (Madhavaram)</option>
                      <option value="VRM Structures (AP)">VRM Structures (AP)</option>
                      <option value="Jashsun">Jashsun</option>
                    </select>
                  </div>
                </div>

                {/* Company Details Preview */}
                <div style={{
                  backgroundColor: '#F8FAFC',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                  fontSize: '12px'
                }}>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>Company Name</span>
                    <strong style={{ color: '#0F172A', fontSize: '13px' }}>{currentCompany.name}</strong>
                    <div style={{ color: '#0E7490', fontSize: '11px', fontWeight: '600', marginTop: '2px' }}>📍 {currentCompany.locationLabel}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>GST Number</span>
                    <strong style={{ color: '#059669', fontSize: '13px', letterSpacing: '0.5px' }}>{currentCompany.gst}</strong>
                    <div style={{ color: '#64748B', fontSize: '11px', marginTop: '2px' }}>State: {currentCompany.state}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>Registered Address (Printout View)</span>
                    <span style={{ color: '#334155', lineHeight: '1.4' }}>{currentCompany.address}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Section 2: Consignee & Challan Metadata Form (Exact Fields from User's Reference Screenshots) */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', margin: 0, borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              Delivery Challan Particulars
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Customer Name* */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Customer Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  list="known-customers-datalist"
                  placeholder="Select or enter customer name"
                  value={customerName}
                  onChange={(e) => handleCustomerSelect(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '13px',
                    color: '#1E293B',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <datalist id="known-customers-datalist">
                  {knownCustomers.map((c, i) => (
                    <option key={i} value={c.name}>{c.name} {c.address ? `(${c.address.slice(0, 30)}…)` : ''}</option>
                  ))}
                </datalist>
              </div>

              {/* Location (Source of Supply) */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Location (Source of Supply)
                </label>
                <div style={{
                  height: '38px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  padding: '0 12px',
                  backgroundColor: '#F8FAFC',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569'
                }}>
                  {getCompanyProfile(companyLocation).name} (Source: {getCompanyProfile(companyLocation).state})
                </div>
              </div>

              {/* Delivery Challan#* */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Delivery Challan# <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="DC/26-27/0271"
                  value={dcNumber}
                  onChange={(e) => setDcNumber(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#0E7490',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Reference# */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Reference#
                </label>
                <input
                  type="text"
                  placeholder="e.g. PO-0012, BOM-2026-45, Work Order Ref"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '13px',
                    color: '#1E293B',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Delivery Challan Date* */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Delivery Challan Date <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="date"
                  value={dcDate}
                  onChange={(e) => setDcDate(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '13px',
                    color: '#1E293B',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Challan Type* */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Challan Type <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={challanType}
                  onChange={(e) => setChallanType(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#1E293B',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                >
                  {CHALLAN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Warehouse Location */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Warehouse Location
                </label>
                <select
                  value={warehouseLocation}
                  onChange={(e) => setWarehouseLocation(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#1E293B',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                >
                  {WAREHOUSE_LOCATIONS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>

              {/* Delivery Address */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Delivery / Consignee Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter consignee site / delivery address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
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

              {/* Logistics Row: Transporter, Vehicle No, LR No */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '6px' }}>
                  Transporter Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. VRL Logistics, Direct Fleet"
                  value={transporter}
                  onChange={(e) => setTransporter(e.target.value)}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '6px' }}>
                  Vehicle Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. TN-05-AB-1234"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '6px' }}>
                  LR / Consignment No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. LR-987654"
                  value={lrNo}
                  onChange={(e) => setLrNo(e.target.value)}
                  style={{ width: '100%', height: '36px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Item Table (Exact Columns & Buttons from User's Reference Screenshot) */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', margin: 0 }}>
                Item Table
              </h3>
              <span style={{ fontSize: '12px', color: '#64748B' }}>
                All quantities are tracked and outward-deducted under Rule 55.
              </span>
            </div>

            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    <th style={{ padding: '10px 12px', width: '30px' }}>#</th>
                    <th style={{ padding: '10px 12px', minWidth: '220px' }}>Item Details</th>
                    <th style={{ padding: '10px 12px', width: '110px' }}>Brand</th>
                    <th style={{ padding: '10px 12px', width: '90px' }}>WP</th>
                    <th style={{ padding: '10px 12px', width: '90px', textAlign: 'right' }}>Quantity</th>
                    <th style={{ padding: '10px 12px', width: '100px', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ padding: '10px 12px', width: '90px', textAlign: 'right' }}>Discount %</th>
                    <th style={{ padding: '10px 12px', width: '130px' }}>Tax</th>
                    <th style={{ padding: '10px 12px', width: '110px', textAlign: 'right' }}>Amount (₹)</th>
                    <th style={{ padding: '10px 12px', width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '36px 16px', textAlign: 'center', color: '#64748B' }}>
                        No items added yet. Click <strong>+ Add New Row</strong> or <strong>+ Add Items in Bulk</strong> below.
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => {
                      const q = parseFloat(it.qty) || 0;
                      const r = parseFloat(it.rate) || 0;
                      const dPct = parseFloat(it.discountPct) || 0;
                      const taxR = parseFloat(it.taxRate) || 0;
                      const taxable = Math.max(0, (q * r) - ((q * r * dPct) / 100));
                      const amount = taxable + (taxable * taxR) / 100;

                      return (
                        <tr key={it.id || idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 12px', color: '#94A3B8', fontWeight: '600' }}>{idx + 1}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <input
                              type="text"
                              placeholder="Type or click to select an item"
                              list="items-catalog-datalist"
                              value={it.name}
                              onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                              style={{
                                width: '100%',
                                height: '34px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                padding: '0 8px',
                                fontSize: '13px',
                                color: '#1E293B',
                                boxSizing: 'border-box'
                              }}
                            />
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <input
                              type="text"
                              placeholder="Brand"
                              value={it.brand}
                              onChange={(e) => handleUpdateItem(idx, 'brand', e.target.value)}
                              style={{ width: '100%', height: '34px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '12.5px', boxSizing: 'border-box' }}
                            />
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <input
                              type="text"
                              placeholder="WP"
                              value={it.wp}
                              onChange={(e) => handleUpdateItem(idx, 'wp', e.target.value)}
                              style={{ width: '100%', height: '34px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '12.5px', boxSizing: 'border-box' }}
                            />
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <input
                              type="number"
                              min={0.01}
                              step="any"
                              value={it.qty}
                              onChange={(e) => handleUpdateItem(idx, 'qty', e.target.value)}
                              style={{ width: '100%', height: '34px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', textAlign: 'right', fontSize: '13px', fontWeight: '600', boxSizing: 'border-box' }}
                            />
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={it.rate}
                              onChange={(e) => handleUpdateItem(idx, 'rate', e.target.value)}
                              style={{ width: '100%', height: '34px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', textAlign: 'right', fontSize: '13px', boxSizing: 'border-box' }}
                            />
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={it.discountPct}
                              onChange={(e) => handleUpdateItem(idx, 'discountPct', e.target.value)}
                              style={{ width: '100%', height: '34px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 8px', textAlign: 'right', fontSize: '13px', boxSizing: 'border-box' }}
                            />
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <select
                              value={it.taxRate}
                              onChange={(e) => handleUpdateItem(idx, 'taxRate', Number(e.target.value))}
                              style={{ width: '100%', height: '34px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 6px', fontSize: '12px', backgroundColor: '#FFFFFF', boxSizing: 'border-box', cursor: 'pointer' }}
                            >
                              {TAX_OPTIONS.map(to => <option key={to.label} value={to.rate}>{to.label}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                            {amount.toFixed(2)}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              title="Delete row"
                              style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <datalist id="items-catalog-datalist">
                {availableInventoryItems.map((ai, i) => (
                  <option key={i} value={ai.name}>{ai.name} ({ai.unit || 'Nos'}) — ₹{ai.rate || 0}</option>
                ))}
              </datalist>
            </div>

            {/* Action Buttons: Add New Row & Add Items in Bulk (Exact Design from Reference Image 1) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
              {/* Add New Row Button */}
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
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E2E8F0'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'}
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

              {/* Add Items in Bulk Button */}
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
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E2E8F0'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'}
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

          {/* Section 4: Calculations Summary & Notes (Exact 2-Column Layout from Reference Image 2) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px' }}>

            {/* Left Column: Customer Notes, Terms & Conditions, Attachments */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Customer Notes */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px 20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '8px' }}>
                  Customer Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter any notes to be displayed in your transaction"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
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

              {/* Terms & Conditions */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px 20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1E293B', marginBottom: '8px' }}>
                  Terms & Conditions
                </label>
                <textarea
                  rows={4}
                  placeholder="Enter the terms and conditions of your business to be displayed in your transaction"
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '10px 12px',
                    fontSize: '12.5px',
                    color: '#334155',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'none',
                    lineHeight: '1.5',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Attach File(s) to Delivery Challan */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', margin: 0 }}>
                    Attach File(s) to Delivery Challan
                  </label>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Max 5 files, 10MB each
                  </span>
                </div>

                <label style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#F8FAFC',
                  border: '1px dashed #CBD5E1',
                  borderRadius: '8px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0E7490',
                  cursor: 'pointer'
                }}>
                  <Upload size={16} /> Upload File
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>

                {/* Attached file list */}
                {attachedFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
                    {attachedFiles.map((f, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', backgroundColor: '#F1F5F9', borderRadius: '6px', fontSize: '12px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1E293B' }}>
                          <Paperclip size={13} style={{ color: '#64748B' }} /> {f.name} ({f.size})
                        </span>
                        <button
                          type="button"
                          onClick={() => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))}
                          style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Financial Calculations Card (Sub Total, Adjustment, Round Off, Total) */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              height: 'fit-content'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', margin: 0, borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
                Summary Calculations
              </h3>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13.5px', color: '#475569' }}>
                <span>Sub Total:</span>
                <span style={{ fontWeight: '600', color: '#0F172A' }}>
                  ₹ {calculatedTotals.subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {calculatedTotals.totalTax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13.5px', color: '#475569' }}>
                  <span>Total Tax (GST):</span>
                  <span style={{ fontWeight: '600', color: '#0F172A' }}>
                    ₹ {calculatedTotals.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Adjustment Field */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13.5px', color: '#475569' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Adjustment:
                  <HelpCircle size={13} style={{ color: '#94A3B8' }} title="Add or subtract adjustment (e.g. freight, rounding)" />
                </span>
                <input
                  type="number"
                  step="any"
                  value={adjustment}
                  onChange={(e) => setAdjustment(e.target.value)}
                  style={{
                    width: '120px',
                    height: '32px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    padding: '0 8px',
                    textAlign: 'right',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#0F172A',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Round Off */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13.5px', color: '#475569' }}>
                <span>Round Off:</span>
                <span style={{ fontWeight: '600', color: '#64748B' }}>
                  ₹ {calculatedTotals.roundOff.toFixed(2)}
                </span>
              </div>

              {/* Grand Total */}
              <div style={{
                borderTop: '2px solid #E2E8F0',
                paddingTop: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <strong style={{ fontSize: '16px', color: '#0F172A', display: 'block' }}>Total ( ₹ )</strong>
                  <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '600' }}>Rule 55 Non-Chargeable Value</span>
                </div>
                <strong style={{ fontSize: '22px', fontWeight: '900', color: '#0E7490' }}>
                  ₹ {calculatedTotals.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </strong>
              </div>

              <div style={{ backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: '8px', padding: '10px 14px', fontSize: '11.5px', color: '#0F766E', lineHeight: '1.4' }}>
                ℹ️ Delivery Challans are non-chargeable statutory instruments. No tax invoice sales consideration is collected on this transaction.
              </div>
            </div>

          </div>

          {/* Form Bottom Save / Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 0', borderTop: '1px solid #E2E8F0' }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                backgroundColor: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '10px 22px',
                fontSize: '13.5px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSaveDC(true)}
              style={{
                backgroundColor: '#FFFFFF',
                border: '1.5px solid #0E7490',
                borderRadius: '8px',
                padding: '10px 22px',
                fontSize: '13.5px',
                fontWeight: '700',
                color: '#0E7490',
                cursor: 'pointer'
              }}
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={() => handleSaveDC(false)}
              style={{
                backgroundColor: '#0E7490',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 26px',
                fontSize: '13.5px',
                fontWeight: '700',
                color: '#FFFFFF',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(14, 116, 144, 0.25)'
              }}
            >
              {viewMode === 'edit' ? 'Update Delivery Challan' : 'Create Delivery Challan'}
            </button>
          </div>

        </div>
      )}

      {/* ==================== VIEW 3: VIEW DETAILS & OFFICIAL PRINT TEMPLATE ==================== */}
      {viewMode === 'view' && activeDc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* View Details Header & Actions */}
          <div className="dc-no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: '600'
                }}
              >
                <ArrowLeft size={16} /> Back to DC List
              </button>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    {activeDc.dcNo || activeDc.code || activeDc.id}
                  </h1>
                  {renderDcStatusBadge(activeDc.status)}
                </div>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Issued by {activeDc.companyName} on {activeDc.dcDate || activeDc.date}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
                    gap: '6px'
                  }}
                >
                  <Edit3 size={15} /> Edit DC
                </button>
              )}

              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  backgroundColor: '#0E7490',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(14, 116, 144, 0.25)'
                }}
              >
                <Printer size={15} /> Export / Print PDF
              </button>

              {!String(activeDc.status || '').toLowerCase().includes('cancel') && (
                <button
                  type="button"
                  onClick={() => {
                    setCancellingDc(activeDc);
                    setCancellationRemarkInput('');
                  }}
                  style={{
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#DC2626',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Ban size={15} /> Cancel DC
                </button>
              )}
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

          {/* Official Delivery Challan Printable Document (Isolated on Print) */}
          <div
            id="businz-dc-official-document"
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid #E2E8F0',
              borderTop: '5px solid #0E7490',
              padding: '36px 40px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            {/* Header: Company Name & Delivery Challan Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0E7490', paddingBottom: '16px' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
                  {activeDc.companyName}
                </h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#475569', maxWidth: '480px', lineHeight: '1.4' }}>
                  {activeDc.companyAddress}
                </p>
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#0E7490', fontWeight: '700' }}>
                  GSTIN: {activeDc.companyGst} | State: {activeDc.sourceOfSupply || 'Tamil Nadu'}
                </div>
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

            {/* 3-Column Info Grid: Consignee, Transport Details, Challan Particulars */}
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
              {/* Consignee / Delivery Address */}
              <div>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Consignee / Deliver To
                </span>
                <strong style={{ fontSize: '13px', color: '#0F172A', display: 'block' }}>{activeDc.customerName || 'Customer'}</strong>
                <p style={{ margin: '4px 0 0 0', color: '#334155', lineHeight: '1.4' }}>
                  {activeDc.deliveryAddress}
                </p>
              </div>

              {/* Transport & Logistics */}
              <div>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Transport & Dispatch Info
                </span>
                <div style={{ color: '#334155', lineHeight: '1.6' }}>
                  <div>Vehicle No: <strong>{activeDc.vehicleNo || '—'}</strong></div>
                  <div>Transporter: <strong>{activeDc.transporter || 'Direct Fleet'}</strong></div>
                  <div>LR / Consignment#: <strong>{activeDc.lrNo || '—'}</strong></div>
                </div>
              </div>

              {/* Challan Particulars */}
              <div>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Challan Details
                </span>
                <div style={{ color: '#334155', lineHeight: '1.6' }}>
                  <div>Challan Type: <strong>{activeDc.challanType || 'For Job Work'}</strong></div>
                  <div>Reference#: <strong>{activeDc.referenceNo || '—'}</strong></div>
                  <div>Warehouse: <strong>{activeDc.warehouseLocation ? activeDc.warehouseLocation.replace('VRM Structures - ', '') : 'Main'}</strong></div>
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
                      </td>
                      <td style={{ padding: '8px 10px', color: '#475569' }}>{it.brand || 'VRM'}</td>
                      <td style={{ padding: '8px 10px', color: '#475569' }}>{it.wp || '—'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>
                        {Number(it.qty || it.dcQty || 1).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                        ₹ {Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569' }}>
                        {it.taxRate !== undefined ? `${it.taxRate}%` : '18%'}
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
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  Statutory Rule 55 Declaration & Notes
                </span>
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
                  <span>Sub Total:</span>
                  <strong>₹ {Number(activeDc.subTotal || activeDc.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
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
            maxWidth: '680px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Boxes size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>Add Items in Bulk</h3>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>Select items from catalog to insert into Delivery Challan</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkItemModal(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}
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
                            {it.category || 'Raw Material'} | UOM: {it.unit || 'Nos'} | Rate: ₹{it.rate || 0}
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

    </div>
  );
}
