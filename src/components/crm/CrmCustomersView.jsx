import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Search, Plus, Phone, MessageSquare, Mail, Building2, MapPin,
  CreditCard, FileText, CheckCircle2, ChevronRight, ChevronDown, X, AlertTriangle,
  Layers, Truck, DollarSign, Calendar, Eye, Edit3, ShieldAlert, RotateCcw,
  Trash2, Save, ArrowLeft, Check, RefreshCw, Briefcase, UserCheck,
  Clock, Tag, MoreHorizontal, Sparkles, ExternalLink, Send, AlertCircle
} from 'lucide-react';
import NotificationToast from '../NotificationToast';
import { addLiveNotification } from '../Header';
import Customer360PageView from './Customer360PageView';
import { saveCloudStore, fetchCloudStore } from '../../utils/supabaseDataSync';

export default function CrmCustomersView({
  customers = [],
  opportunities = [],
  quotations = [],
  onSaveCustomer,
  onBatchUpdateCustomers,
  onOpenWhatsAppChat,
  onNavigateTab
}) {
  // Page mode: 'table' | 'create' | 'details' (Dedicated full-page views)
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'create' | 'details'
  const [isSyncingZoho, setIsSyncingZoho] = useState(false);
  const [zohoSyncMessage, setZohoSyncMessage] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCustomerType, setFilterCustomerType] = useState('All');
  const [activeSubTab, setActiveSubTab] = useState('All');
  const [selectedRows, setSelectedRows] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [profileTab, setProfileTab] = useState('Timeline');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [dupError, setDupError] = useState(null);

  // Dynamically resolve current Control Room account holder's name (e.g. Mohith JV, Sanjay, etc.)
  const activeAccountUser = useMemo(() => {
    try {
      const stored = localStorage.getItem('controlroom_logged_user_name');
      if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim()) {
        return stored.trim();
      }
      return 'Sales Representative';
    } catch (e) {
      return 'Sales Representative';
    }
  }, []);

  // Customer 360 View Accordions & Interactive States
  const [isOverviewOpen, setIsOverviewOpen] = useState(true);
  const [isCompanyOpen, setIsCompanyOpen] = useState(true);
  const [isDealsOpen, setIsDealsOpen] = useState(true);
  const [isContactInfoExpanded, setIsContactInfoExpanded] = useState(true);

  const [newTaskInput, setNewTaskInput] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newNoteInput, setNewNoteInput] = useState('');

  // Customer Tasks store in Supabase cloud database
  const [customerTasks, setCustomerTasks] = useState({});

  // Customer Notes store in Supabase cloud database
  const [customerNotes, setCustomerNotes] = useState({});

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchCloudStore('crm_tasks', {}),
      fetchCloudStore('crm_notes', {})
    ]).then(([tasks, notes]) => {
      if (active) {
        if (tasks && typeof tasks === 'object' && !Array.isArray(tasks)) setCustomerTasks(tasks);
        if (notes && typeof notes === 'object' && !Array.isArray(notes)) setCustomerNotes(notes);
      }
    });
    return () => { active = false; };
  }, []);

  const handleAddCustomerTask = (custId) => {
    if (!newTaskInput.trim()) return;
    const taskObj = {
      id: 'task_' + Date.now(),
      text: newTaskInput.trim(),
      dueDate: newTaskDueDate || new Date().toISOString().split('T')[0],
      completed: false,
      createdAt: new Date().toISOString()
    };
    const updated = {
      ...customerTasks,
      [custId]: [taskObj, ...(customerTasks[custId] || [])]
    };
    setCustomerTasks(updated);
    saveCloudStore('crm_tasks', updated);
    setNewTaskInput('');
    setNewTaskDueDate('');
  };

  const handleToggleCustomerTask = (custId, taskId) => {
    const list = customerTasks[custId] || [];
    const updated = {
      ...customerTasks,
      [custId]: list.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
    };
    setCustomerTasks(updated);
    saveCloudStore('crm_tasks', updated);
  };

  const handleDeleteCustomerTask = (custId, taskId) => {
    const list = customerTasks[custId] || [];
    const updated = {
      ...customerTasks,
      [custId]: list.filter(t => t.id !== taskId)
    };
    setCustomerTasks(updated);
    saveCloudStore('crm_tasks', updated);
  };

  const handleAddCustomerNote = (custId) => {
    if (!newNoteInput.trim()) return;
    const noteObj = {
      id: 'note_' + Date.now(),
      text: newNoteInput.trim(),
      author: activeAccountUser,
      date: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    const updated = {
      ...customerNotes,
      [custId]: [noteObj, ...(customerNotes[custId] || [])]
    };
    setCustomerNotes(updated);
    saveCloudStore('crm_notes', updated);
    setNewNoteInput('');
  };

  // Form State for Dedicated Create/Edit Page
  const initialFormState = {
    customerName: '',
    companyName: '',
    customerType: 'EPC Contractor',
    gstNumber: '',
    panNumber: '',
    // Billing Address
    address: '',
    city: '',
    state: '',
    pincode: '',
    // Dispatch Address
    dispatchAddress: '',
    dispatchCity: '',
    dispatchState: '',
    dispatchPincode: '',
    sameAsBilling: true,
    // Background defaults (no longer required in UI)
    creditLimit: 2500000,
    creditDays: 30,
    paymentTerms: '50% Advance + 50% Dispatch',
    source: 'Direct Client',
    notes: '',
    primaryContact: {
      name: '',
      phone: '',
      whatsapp: '',
      email: ''
    }
  };

  const [formCust, setFormCust] = useState(initialFormState);

  // Sync with Zoho Books on component mount & manual trigger
  const handleSyncWithZoho = async (isManual = false) => {
    setIsSyncingZoho(true);
    try {
      // 1. Push any local CRM customer records lacking zohoContactId to Zoho Books
      if (Array.isArray(customers) && customers.length > 0) {
        const unsynced = customers.filter(c => !c.zohoContactId && (c.customerCode || c.companyName));
        for (const cust of unsynced) {
          try {
            await fetch('/api/zoho/customers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cust)
            });
          } catch (e) {
            console.warn('Background sync push notice for customer:', cust.customerCode, e.message);
          }
        }
      }

      // 2. Retrieve all live synchronized customers from Zoho Books
      const res = await fetch('/api/zoho/customers');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          if (typeof onBatchUpdateCustomers === 'function') {
            onBatchUpdateCustomers(data);
          } else if (typeof onSaveCustomer === 'function') {
            data.forEach(c => onSaveCustomer(c));
          }
          if (isManual) {
            setZohoSyncMessage({
              type: 'success',
              title: 'Zoho Books Synchronized',
              message: `Synchronized ${data.length} customer account(s) with Zoho Books!`
            });
            addLiveNotification({
              id: 'zoho_cust_sync_' + Date.now(),
              title: 'Zoho Books Synchronized',
              message: `Synchronized ${data.length} customer account(s) with Zoho Books!`,
              time: 'Just now',
              type: 'success',
              role: 'All',
              targetTab: 'Customers'
            });
          }
        }
      }
    } catch (err) {
      console.warn('Zoho customer sync notice:', err.message);
      if (isManual) {
        setZohoSyncMessage({
          type: 'error',
          title: 'Zoho Books Sync Notice',
          message: err.message || 'Unable to synchronize customer accounts with Zoho Books.'
        });
      }
    } finally {
      setIsSyncingZoho(false);
    }
  };

  // Initial Zoho sync on load
  useEffect(() => {
    handleSyncWithZoho();
  }, []);

  // Real-time duplicate validation
  const validateDuplicates = (field, value, currentId = null) => {
    const val = String(value || '').trim().toLowerCase();
    if (!val) {
      setDupError(null);
      return;
    }

    const dup = customers.find(c => {
      if (currentId && (c.id === currentId || c.customerCode === currentId)) return false;
      if (field === 'phone') {
        const p1 = c.primaryContact?.phone?.replace(/\D/g, '');
        const p2 = val.replace(/\D/g, '');
        return p1 && p2 && p1 === p2;
      }
      if (field === 'whatsapp') {
        const w1 = c.primaryContact?.whatsapp?.replace(/\D/g, '');
        const w2 = val.replace(/\D/g, '');
        return w1 && w2 && w1 === w2;
      }
      if (field === 'email') {
        return c.primaryContact?.email?.toLowerCase() === val;
      }
      if (field === 'gstNumber') {
        return c.gstNumber?.toLowerCase() === val;
      }
      if (field === 'companyName') {
        return c.companyName?.toLowerCase() === val;
      }
      return false;
    });

    if (dup) {
      setDupError(`⚠️ Warning: Duplicate detected! Existing customer with this ${field}: ${dup.companyName} (${dup.customerCode})`);
    } else {
      setDupError(null);
    }
  };

  // Sub-tabs config matching BOM design pattern
  const pageTabs = useMemo(() => [
    { id: 'All', label: 'All Accounts', count: customers.length, bg: '#E2E8F0', fg: '#475569' },
    { id: 'EPC', label: 'EPC Contractors', count: customers.filter(c => (c.customerType || '').includes('EPC')).length, bg: '#DCFCE7', fg: '#166534' },
    { id: 'IPP', label: 'IPP Developers', count: customers.filter(c => (c.customerType || '').includes('IPP') || (c.customerType || '').includes('Independent')).length, bg: '#DBEAFE', fg: '#1E40AF' },
    { id: 'Rooftop', label: 'Rooftop Installers', count: customers.filter(c => (c.customerType || '').includes('Rooftop')).length, bg: '#FEF3C7', fg: '#B45309' },
    { id: 'Distributor', label: 'Distributors', count: customers.filter(c => (c.customerType || '').includes('Distributor') || (c.customerType || '').includes('Reseller')).length, bg: '#F3E8FF', fg: '#7E22CE' }
  ], [customers]);

  // Filtered customers matching BOM filtering logic
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        c.companyName?.toLowerCase().includes(q) ||
        c.customerCode?.toLowerCase().includes(q) ||
        c.primaryContact?.name?.toLowerCase().includes(q) ||
        c.primaryContact?.phone?.includes(q) ||
        c.gstNumber?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q);

      const subTab = activeSubTab.toLowerCase();
      const cType = (c.customerType || '').toLowerCase();
      let matchesTab = true;
      if (subTab === 'epc') matchesTab = cType.includes('epc');
      else if (subTab === 'ipp') matchesTab = cType.includes('ipp') || cType.includes('independent');
      else if (subTab === 'rooftop') matchesTab = cType.includes('rooftop');
      else if (subTab === 'distributor') matchesTab = cType.includes('distributor') || cType.includes('reseller');

      const matchesTypeFilter = filterCustomerType === 'All' || c.customerType === filterCustomerType;

      return matchesSearch && matchesTab && matchesTypeFilter;
    });
  }, [customers, searchTerm, activeSubTab, filterCustomerType]);

  // Pagination calculation strictly matching BOM Table Rules
  const totalPages = Math.ceil(filteredCustomers.length / rowsPerPage) || 1;
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredCustomers.slice(indexOfFirstRow, indexOfLastRow);

  // Row selection handler
  const handleSelectRow = (code) => {
    setSelectedRows(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Open Create Customer Page
  const handleOpenCreatePage = () => {
    setEditingCustomer(null);
    setSelectedCustomer(null);
    setFormCust({
      ...initialFormState,
      assignedSalesperson: activeAccountUser
    });
    setDupError(null);
    setViewMode('create');
  };

  // Open Edit Customer Page
  const handleOpenEditPage = (cust) => {
    setEditingCustomer(cust);
    setFormCust({
      customerName: cust.customerName || cust.companyName || '',
      companyName: cust.companyName || '',
      assignedSalesperson: cust.assignedSalesperson || cust.salesPerson || activeAccountUser,
      customerType: cust.customerType || 'EPC Contractor',
      gstNumber: cust.gstNumber || '',
      panNumber: cust.panNumber || '',
      address: cust.address || '',
      city: cust.city || '',
      state: cust.state || '',
      pincode: cust.pincode || '',
      dispatchAddress: cust.dispatchAddress || cust.address || '',
      dispatchCity: cust.dispatchCity || cust.city || '',
      dispatchState: cust.dispatchState || cust.state || '',
      dispatchPincode: cust.dispatchPincode || cust.pincode || '',
      sameAsBilling: cust.sameAsBilling !== undefined ? cust.sameAsBilling : (!cust.dispatchAddress || cust.dispatchAddress === cust.address),
      creditLimit: cust.creditLimit || 2500000,
      creditDays: cust.creditDays || 30,
      paymentTerms: cust.paymentTerms || '50% Advance + 50% Dispatch',
      source: cust.source || 'Direct Client',
      notes: cust.notes || '',
      primaryContact: {
        name: cust.primaryContact?.name || '',
        phone: cust.primaryContact?.phone || '',
        whatsapp: cust.primaryContact?.whatsapp || '',
        email: cust.primaryContact?.email || ''
      }
    });
    setDupError(null);
    setViewMode('create');
  };

  // Submit Handler for Dedicated Customer Creation & Dual Sync with Zoho Books
  const handleSaveCustomerForm = async (e) => {
    if (e) e.preventDefault();

    if (!formCust.customerName || !formCust.customerName.trim()) {
      alert('⚠️ Customer Name is mandatory.');
      return;
    }
    if (!formCust.companyName || !formCust.companyName.trim()) {
      alert('⚠️ Company / Organization Legal Name is mandatory.');
      return;
    }
    if (!formCust.primaryContact.name || !formCust.primaryContact.name.trim()) {
      alert('⚠️ Authorized Contact Person Name is mandatory.');
      return;
    }
    if (!formCust.primaryContact.phone || !formCust.primaryContact.phone.trim()) {
      alert('⚠️ Contact Phone Number is mandatory.');
      return;
    }

    const customerCode = editingCustomer
      ? (editingCustomer.customerCode || editingCustomer.id)
      : `CUST-VRM-${String(100 + customers.length + 1)}`;

    const formatAddr = (addr, city, state, pin) => {
      const parts = [];
      if (addr && addr.trim()) parts.push(addr.trim());
      if (city && city.trim()) parts.push(city.trim());
      if (state && state.trim() && pin && pin.trim()) {
        parts.push(`${state.trim()} - ${pin.trim()}`);
      } else {
        if (state && state.trim()) parts.push(state.trim());
        if (pin && pin.trim()) parts.push(pin.trim());
      }
      return parts.join(', ');
    };

    const billingStr = formatAddr(formCust.address, formCust.city, formCust.state, formCust.pincode);
    const dispatchStr = formCust.sameAsBilling
      ? billingStr
      : formatAddr(formCust.dispatchAddress, formCust.dispatchCity, formCust.dispatchState, formCust.dispatchPincode);

    const billingObj = {
      address: (formCust.address || '').trim(),
      city: (formCust.city || '').trim(),
      state: (formCust.state || '').trim(),
      pincode: (formCust.pincode || '').trim()
    };

    const deliveryObj = formCust.sameAsBilling ? { ...billingObj } : {
      address: (formCust.dispatchAddress || '').trim(),
      city: (formCust.dispatchCity || '').trim(),
      state: (formCust.dispatchState || '').trim(),
      pincode: (formCust.dispatchPincode || '').trim()
    };

    // Respect existing customer rep on edit, or assign to active account user on new create
    const repName = formCust.assignedSalesperson || (editingCustomer ? (editingCustomer.assignedSalesperson || editingCustomer.salesPerson) : activeAccountUser) || activeAccountUser;

    const record = {
      id: customerCode,
      customerCode: customerCode,
      ...formCust,
      code: formCust.customerName || formCust.companyName,
      c2: formCust.companyName || formCust.customerName,
      c3: formCust.primaryContact?.name || '',
      c4: formCust.primaryContact?.phone || '',
      c5: formCust.primaryContact?.email || '',
      c6: billingStr,
      billingAddress: billingStr,
      billingAddressObj: billingObj,
      c7: dispatchStr,
      deliveryAddress: dispatchStr,
      deliveryAddressObj: deliveryObj,
      gstNo: formCust.gstNumber || '',
      status: 'ACTIVE',
      assignedSalesperson: repName,
      c8: repName,
      salesPerson: repName,
      updatedAt: new Date().toISOString()
    };
    if (!editingCustomer) {
      record.createdAt = new Date().toISOString();
    }

    // 1. Immediately save to CRM store
    onSaveCustomer(record);

    // 2. Also save to Supabase canonical customers table so BOM Creation & whole app picks it up
    try {
      saveCloudStore('customer_store', record);
      window.dispatchEvent(new CustomEvent('controlroom_customer_update', { detail: record }));
    } catch (e) {
      console.error('Error syncing customer to cloud store:', e);
    }

    // 3. Post to Zoho Books sync API
    try {
      const response = await fetch('/api/zoho/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
      const resJson = await response.json();
      if (resJson.customer) {
        const mergedFinal = { ...record, ...resJson.customer };
        onSaveCustomer(mergedFinal);
        saveCloudStore('customer_store', mergedFinal);
      }
      setZohoSyncMessage({
        type: 'success',
        text: resJson.message || '✅ Customer created and synchronized with Zoho Books!'
      });
    } catch (err) {
      console.warn('Zoho Customer Sync warning:', err);
      setZohoSyncMessage({
        type: 'info',
        text: 'Customer created locally in Businz. Zoho Books sync will retry automatically.'
      });
    }

    setViewMode('details');
    setEditingCustomer(null);
    setDupError(null);
    setSelectedCustomer(record);
  };

  // Center Workspace Tabs (matching reference video dealclosure-crm.web.app)
  const profileTabs = [
    'Timeline',
    'Tasks',
    'Notes',
    'Quotations',
    'WhatsApp Chat',
    'BOM Orders',
    'Opportunities',
    'Details'
  ];

  // =========================================================================
  // RENDER 1: DEDICATED SEPARATE PAGE - ADD / EDIT B2B SOLAR CUSTOMER
  // (Styled exactly like the Create BOM separate page)
  // =========================================================================
  if (viewMode === 'create') {
    const nextCodePreview = editingCustomer
      ? (editingCustomer.customerCode || editingCustomer.id)
      : `CUST-VRM-${String(100 + customers.length + 1)}`;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>
        
        {/* Top Header Banner (Matching Create BOM Vibrant Gradient Bar) */}
        <div style={{
          background: 'linear-gradient(135deg, #0E7490 0%, #155E75 100%)',
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
              <Building2 style={{ width: '26px', height: '26px', color: '#FFFFFF' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
                {editingCustomer ? `Edit Customer Account: ${editingCustomer.companyName}` : 'Add New B2B Solar Customer'}
              </h1>
              <p style={{ fontSize: '13px', color: '#CFFAFE', margin: '4px 0 0 0' }}>
                Configure client directory, enterprise KYC, billing & delivery addresses, commercial payment terms & Zoho Books sync
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => { setViewMode(selectedCustomer ? 'details' : 'table'); setEditingCustomer(null); setDupError(null); }}
              style={{ border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={15} /> {selectedCustomer ? 'Back to Details' : 'Back to Directory'}
            </button>
            <button
              type="button"
              onClick={handleSaveCustomerForm}
              style={{ border: 'none', background: '#10B981', color: 'white', padding: '10px 24px', borderRadius: '10px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={16} />
              {editingCustomer ? 'Update & Sync to Zoho →' : 'Save & Sync to Zoho →'}
            </button>
          </div>
        </div>

        {/* Real-time duplicate error banner */}
        {dupError && (
          <div style={{
            padding: '14px 18px',
            backgroundColor: '#FEF2F2',
            borderRadius: '12px',
            border: '1px solid #FCA5A5',
            color: '#B91C1C',
            fontSize: '13px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 2px 6px rgba(220, 38, 38, 0.08)'
          }}>
            <ShieldAlert size={20} />
            <span>{dupError}</span>
          </div>
        )}

        {/* SECTION 1: ACCOUNT IDENTIFICATION */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              1
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ACCOUNT IDENTIFICATION
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Customer Code</label>
              <input
                type="text"
                value={nextCodePreview}
                readOnly
                disabled
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0E7490', fontWeight: '800', backgroundColor: '#F0FDFA', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Creation Date</label>
              <input
                type="date"
                value={new Date().toISOString().split('T')[0]}
                disabled
                readOnly
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#64748B', backgroundColor: '#F1F5F9', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Acquisition Source</label>
              <select
                value={formCust.source}
                onChange={(e) => setFormCust({ ...formCust, source: e.target.value })}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
              >
                <option value="Direct Client">Direct Client / Walk-in</option>
                <option value="Website">Official Website Lead</option>
                <option value="WhatsApp">WhatsApp Business</option>
                <option value="Referral">Client / EPC Referral</option>
                <option value="Trade Exhibition">Intersolar / Renewable Expo</option>
                <option value="Zoho Books">Zoho Books Integrated</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 2: COMPANY PROFILE & STATUTORY DETAILS */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              2
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              COMPANY PROFILE & STATUTORY DETAILS
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Customer Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Vikram Solar"
                value={formCust.customerName}
                onChange={(e) => {
                  setFormCust({ ...formCust, customerName: e.target.value });
                  validateDuplicates('companyName', e.target.value, editingCustomer?.id);
                }}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Company / Organization Legal Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Vikram Solar Limited"
                value={formCust.companyName}
                onChange={(e) => {
                  setFormCust({ ...formCust, companyName: e.target.value });
                  validateDuplicates('companyName', e.target.value, editingCustomer?.id);
                }}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Customer Account Type
              </label>
              <select
                value={formCust.customerType}
                onChange={(e) => setFormCust({ ...formCust, customerType: e.target.value })}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
              >
                <option value="EPC Contractor">EPC Contractor</option>
                <option value="Independent Power Producer (IPP)">Independent Power Producer (IPP)</option>
                <option value="Module & Structure Manufacturer">Module & Structure Manufacturer</option>
                <option value="Rooftop Installer">Rooftop Solar Installer</option>
                <option value="Distributor">Solar Distributor / Reseller</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                GSTIN / Tax ID (15 Digits)
              </label>
              <input
                type="text"
                placeholder="e.g. 33AABCV1234F1Z5"
                value={formCust.gstNumber}
                onChange={(e) => {
                  setFormCust({ ...formCust, gstNumber: e.target.value.toUpperCase() });
                  validateDuplicates('gstNumber', e.target.value, editingCustomer?.id);
                }}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', fontFamily: 'monospace', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Permanent Account Number (PAN)
              </label>
              <input
                type="text"
                placeholder="e.g. AABCV1234F"
                value={formCust.panNumber}
                onChange={(e) => setFormCust({ ...formCust, panNumber: e.target.value.toUpperCase() })}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', fontFamily: 'monospace', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: AUTHORIZED PRIMARY CONTACT PERSON */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              3
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              AUTHORIZED PRIMARY CONTACT PERSON
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Contact Person Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rajesh Kannan"
                value={formCust.primaryContact.name}
                onChange={(e) => setFormCust({ ...formCust, primaryContact: { ...formCust.primaryContact, name: e.target.value } })}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Mobile / Phone <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="+91 98765 43210"
                value={formCust.primaryContact.phone}
                onChange={(e) => {
                  setFormCust({ ...formCust, primaryContact: { ...formCust.primaryContact, phone: e.target.value } });
                  validateDuplicates('phone', e.target.value, editingCustomer?.id);
                }}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="rajesh@vikramsolar.com"
                value={formCust.primaryContact.email}
                onChange={(e) => {
                  setFormCust({ ...formCust, primaryContact: { ...formCust.primaryContact, email: e.target.value } });
                  validateDuplicates('email', e.target.value, editingCustomer?.id);
                }}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: BILLING ADDRESS & DISPATCH ADDRESS (SEPARATED) */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              4
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              BILLING & DISPATCH ADDRESS
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* 4A: BILLING ADDRESS */}
            <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                  <FileText style={{ width: '16px', height: '16px' }} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Billing Address</h4>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>Primary address for official invoices & tax records</span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Billing Street / Premise Address</label>
                <input
                  type="text"
                  placeholder="e.g. No 1427, GNT Road, Nagappa Industrial Estate, Puzhal"
                  value={formCust.address}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormCust(prev => ({
                      ...prev,
                      address: val,
                      dispatchAddress: prev.sameAsBilling ? val : prev.dispatchAddress
                    }));
                  }}
                  style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>City</label>
                  <input
                    type="text"
                    placeholder="Chennai"
                    value={formCust.city}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormCust(prev => ({
                        ...prev,
                        city: val,
                        dispatchCity: prev.sameAsBilling ? val : prev.dispatchCity
                      }));
                    }}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>State</label>
                  <input
                    type="text"
                    placeholder="Tamil Nadu"
                    value={formCust.state}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormCust(prev => ({
                        ...prev,
                        state: val,
                        dispatchState: prev.sameAsBilling ? val : prev.dispatchState
                      }));
                    }}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Pincode</label>
                  <input
                    type="text"
                    placeholder="600066"
                    value={formCust.pincode}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormCust(prev => ({
                        ...prev,
                        pincode: val,
                        dispatchPincode: prev.sameAsBilling ? val : prev.dispatchPincode
                      }));
                    }}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
              </div>
            </div>

            {/* 4B: DISPATCH ADDRESS */}
            <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#ECFEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490' }}>
                    <Truck style={{ width: '16px', height: '16px' }} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Dispatch / Delivery Address</h4>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Destination location for physical goods dispatch</span>
                  </div>
                </div>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#0E7490', cursor: 'pointer', backgroundColor: '#ECFEFF', padding: '4px 10px', borderRadius: '8px', border: '1px solid #A5F3FC' }}>
                  <input
                    type="checkbox"
                    checked={formCust.sameAsBilling}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormCust(prev => ({
                        ...prev,
                        sameAsBilling: checked,
                        dispatchAddress: checked ? prev.address : prev.dispatchAddress,
                        dispatchCity: checked ? prev.city : prev.dispatchCity,
                        dispatchState: checked ? prev.state : prev.dispatchState,
                        dispatchPincode: checked ? prev.pincode : prev.dispatchPincode
                      }));
                    }}
                    style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                  />
                  Same as Billing
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Dispatch Street / Warehouse / Site Address</label>
                <input
                  type="text"
                  placeholder="e.g. Solar Project Site / Warehouse No 8, SIPCOT"
                  value={formCust.sameAsBilling ? formCust.address : formCust.dispatchAddress}
                  disabled={formCust.sameAsBilling}
                  onChange={(e) => setFormCust({ ...formCust, dispatchAddress: e.target.value })}
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    padding: '0 14px',
                    fontSize: '13px',
                    color: formCust.sameAsBilling ? '#64748B' : '#0F172A',
                    backgroundColor: formCust.sameAsBilling ? '#F1F5F9' : '#FFFFFF',
                    boxSizing: 'border-box',
                    outline: 'none',
                    cursor: formCust.sameAsBilling ? 'not-allowed' : 'text'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>City</label>
                  <input
                    type="text"
                    placeholder="e.g. Chennai"
                    value={formCust.sameAsBilling ? formCust.city : formCust.dispatchCity}
                    disabled={formCust.sameAsBilling}
                    onChange={(e) => setFormCust({ ...formCust, dispatchCity: e.target.value })}
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      padding: '0 14px',
                      fontSize: '13px',
                      color: formCust.sameAsBilling ? '#64748B' : '#0F172A',
                      backgroundColor: formCust.sameAsBilling ? '#F1F5F9' : '#FFFFFF',
                      boxSizing: 'border-box',
                      outline: 'none',
                      cursor: formCust.sameAsBilling ? 'not-allowed' : 'text'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>State</label>
                  <input
                    type="text"
                    placeholder="e.g. Tamil Nadu"
                    value={formCust.sameAsBilling ? formCust.state : formCust.dispatchState}
                    disabled={formCust.sameAsBilling}
                    onChange={(e) => setFormCust({ ...formCust, dispatchState: e.target.value })}
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      padding: '0 14px',
                      fontSize: '13px',
                      color: formCust.sameAsBilling ? '#64748B' : '#0F172A',
                      backgroundColor: formCust.sameAsBilling ? '#F1F5F9' : '#FFFFFF',
                      boxSizing: 'border-box',
                      outline: 'none',
                      cursor: formCust.sameAsBilling ? 'not-allowed' : 'text'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Pincode</label>
                  <input
                    type="text"
                    placeholder="e.g. 600066"
                    value={formCust.sameAsBilling ? formCust.pincode : formCust.dispatchPincode}
                    disabled={formCust.sameAsBilling}
                    onChange={(e) => setFormCust({ ...formCust, dispatchPincode: e.target.value })}
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      padding: '0 14px',
                      fontSize: '13px',
                      color: formCust.sameAsBilling ? '#64748B' : '#0F172A',
                      backgroundColor: formCust.sameAsBilling ? '#F1F5F9' : '#FFFFFF',
                      boxSizing: 'border-box',
                      outline: 'none',
                      cursor: formCust.sameAsBilling ? 'not-allowed' : 'text'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Submission Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '14px', paddingBottom: '20px' }}>
          <button
            type="button"
            onClick={() => { setViewMode(selectedCustomer ? 'details' : 'table'); setEditingCustomer(null); setDupError(null); }}
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '12px 24px', borderRadius: '10px', fontSize: '14px', fontWeight: '700', color: '#475569', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveCustomerForm}
            style={{ backgroundColor: '#0E7490', border: 'none', color: '#FFFFFF', padding: '12px 32px', borderRadius: '10px', fontSize: '14px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(14, 116, 144, 0.35)' }}
          >
            <Save size={16} />
            {editingCustomer ? 'Update & Synchronize to Zoho Books' : 'Save Customer & Synchronize to Zoho Books'}
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER 2: DEDICATED SEPARATE PAGE - CUSTOMER 360° INTELLIGENCE VIEW
  // =========================================================================
  if (viewMode === 'details' && selectedCustomer) {
    return (
      <Customer360PageView
        customer={selectedCustomer}
        onBack={() => {
          setViewMode('table');
          setSelectedCustomer(null);
        }}
        onEditCustomer={(cust) => handleOpenEditPage(cust)}
        onOpenWhatsAppChat={onOpenWhatsAppChat}
        onNavigateTab={onNavigateTab}
        opportunities={opportunities}
        quotations={quotations}
        activeAccountUser={activeAccountUser}
      />
    );
  }

  // =========================================================================
  // RENDER 3: DEFAULT CUSTOMER DIRECTORY TABLE
  // =========================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
      
      {/* ─── CUSTOM TOAST NOTIFICATION (MATCHING SYSTEM-WIDE NOTIFICATIONS) ─── */}
      {zohoSyncMessage && (
        <NotificationToast
          alert={zohoSyncMessage}
          onClose={() => setZohoSyncMessage(null)}
        />
      )}

      {/* 1. TOP HEADER WITH CREATE CUSTOMER BUTTON (MATCHING BOM PAGE TITLE & ACTION STYLE) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Customer Directory (B2B Solar Accounts)
          </h2>
          <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
            Centralized repository with 11-point 360° account intelligence, credit limits & automatic Zoho Books synchronization
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => handleSyncWithZoho(true)}
            disabled={isSyncingZoho}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#0E7490',
              height: '40px',
              padding: '0 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: isSyncingZoho ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <RefreshCw size={15} className={isSyncingZoho ? 'animate-spin' : ''} />
            <span>{isSyncingZoho ? 'Syncing Zoho...' : 'Sync Zoho Books'}</span>
          </button>

          <button
            onClick={handleOpenCreatePage}
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
            <span>Add Customer</span>
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
      </div>

      {/* 2. FILTERS & SEARCH ROW (EXACT BOM SEARCH & FILTER DESIGN) */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '12px 16px',
        backgroundColor: '#fafbfc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box',
        justifyContent: 'space-between'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '0 12px',
          height: '38px',
          backgroundColor: '#f8fafc',
          width: '360px'
        }}>
          <Search style={{ width: '15px', height: '15px', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search Customers (Company Name, Code, GSTIN, Contact)..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
          />
          {searchTerm && <X size={15} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={() => setSearchTerm('')} />}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: 'white' }}>
            <Building2 style={{ width: '14px', height: '14px', color: '#64748b' }} />
            <select
              value={filterCustomerType}
              onChange={(e) => { setFilterCustomerType(e.target.value); setCurrentPage(1); }}
              style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#334155', backgroundColor: 'transparent', cursor: 'pointer' }}
            >
              <option value="All">All Customer Types</option>
              <option value="EPC Contractor">EPC Contractor</option>
              <option value="Independent Power Producer (IPP)">Independent Power Producer (IPP)</option>
              <option value="Module & Structure Manufacturer">Module & Structure Manufacturer</option>
              <option value="Rooftop Installer">Rooftop Solar Installer</option>
              <option value="Distributor">Solar Distributor / Reseller</option>
            </select>
          </div>

          <button
            onClick={() => { setSearchTerm(''); setFilterCustomerType('All'); setActiveSubTab('All'); setCurrentPage(1); }}
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

      {/* 3. STATUS SUB-TABS ROW (EXACT BOM PILL TABS DESIGN) */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '20px', padding: '4px 0', alignItems: 'center', flexWrap: 'wrap' }}>
        {pageTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveSubTab(tab.id); setCurrentPage(1); }}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '10px 4px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: activeSubTab === tab.id ? '#2563eb' : '#64748b',
              borderBottom: activeSubTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
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

      {/* 4. MAIN DATA TABLE WITH INTERACTIVE ROW SELECTION & ACCENT LINES (STRICT BOM DESIGN) */}
      <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="custom-table" style={{ width: '100%', minWidth: '1200px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                  <input
                    type="checkbox"
                    style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                    checked={filteredCustomers.length > 0 && filteredCustomers.every(r => selectedRows.includes(r.customerCode || r.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows(filteredCustomers.map(r => r.customerCode || r.id));
                      } else {
                        setSelectedRows([]);
                      }
                    }}
                  />
                </th>
                <th style={{ width: '140px', minWidth: '140px', padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Customer Code</th>
                <th style={{ minWidth: '220px', padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Company Name</th>
                <th style={{ width: '180px', minWidth: '180px', padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Type & Industry</th>
                <th style={{ minWidth: '180px', padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Primary Contact</th>
                <th style={{ width: '160px', minWidth: '160px', padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>GST Number</th>
                <th style={{ width: '150px', minWidth: '150px', padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Assigned Rep</th>
              </tr>
            </thead>
            <tbody>
              {currentRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                    No customer accounts found matching your filters.
                  </td>
                </tr>
              ) : (
                currentRows.map((cust, idx) => {
                  const custCode = cust.customerCode || cust.id;
                  const isChecked = selectedRows.includes(custCode);

                  return (
                    <tr
                      key={cust.id || idx}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'all 0.15s ease',
                        backgroundColor: isChecked ? '#ECFEFF' : 'transparent'
                      }}
                      className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                    >
                      {/* Checkbox cell with 4px left accent line */}
                      <td style={{
                        width: '48px',
                        minWidth: '48px',
                        padding: '12px 0',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        boxSizing: 'border-box',
                        borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                      }}>
                        <input
                          type="checkbox"
                          style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                          checked={isChecked}
                          onChange={() => handleSelectRow(custCode)}
                        />
                      </td>

                      {/* Customer Code (Clickable blue like BOM Code) */}
                      <td
                        onClick={() => {
                          setSelectedCustomer(cust);
                          setViewMode('details');
                          setProfileTab('Timeline');
                        }}
                        style={{ padding: '12px 14px', fontWeight: 'bold', color: '#2563EB', cursor: 'pointer' }}
                        title="Click to view full 360° details"
                      >
                        {cust.customerCode || cust.id}
                      </td>

                      {/* Company Name & Location */}
                      <td
                        onClick={() => {
                          setSelectedCustomer(cust);
                          setViewMode('details');
                          setProfileTab('Timeline');
                        }}
                        style={{ padding: '12px 14px', cursor: 'pointer' }}
                        title="Click to view full 360° details"
                      >
                        <div style={{ fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{cust.companyName}</span>
                          {cust.source === 'Zoho Books' && (
                            <span style={{ fontSize: '10px', backgroundColor: '#F3E8FF', color: '#7E22CE', border: '1px solid #E9D5FF', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                              ZOHO
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{cust.city || '—'}, {cust.state || ''}</div>
                      </td>

                      {/* Type & Industry */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '600', color: '#334155' }}>{cust.customerType}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{cust.industry}</div>
                      </td>

                      {/* Primary Contact */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '600', color: '#0F172A' }}>{cust.primaryContact?.name || '—'}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{cust.primaryContact?.phone || '—'}</div>
                      </td>

                      {/* GST Number */}
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '600', color: '#475569' }}>
                        {cust.gstNumber || 'Not Registered'}
                      </td>

                      {/* Assigned Rep Badge */}
                      <td style={{ padding: '12px 14px', color: '#0E7490', fontWeight: '700', fontSize: '12px' }}>
                        <span style={{ backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          👤 {(cust.assignedSalesperson || cust.salesPerson || activeAccountUser).replace(/\s*\([^)]*\)/g, '').trim()}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. PAGINATION FOOTER - STRICT RULES MATCH (LEFT: ROWS PER PAGE [5,10] + SHOWING X TO Y; RIGHT: << < 1 2 > >> + GO TO PAGE) */}
        {filteredCustomers.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', fontSize: '13px', color: '#64748B', borderTop: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
            {/* Left Side: Rows per page selector + Showing X to Y entries */}
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
              <span>Showing {filteredCustomers.length === 0 ? 0 : indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredCustomers.length)} of {filteredCustomers.length} entries</span>
            </div>

            {/* Right Side: Page navigation controls */}
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
                  id="crm-customers-goto-page-input"
                  style={{ width: '42px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}
                />
                <button
                  onClick={() => {
                    const val = parseInt(document.getElementById('crm-customers-goto-page-input')?.value || '1', 10);
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

      {/* 6. FLOATING BOTTOM ACTION BAR FOR SELECTED ROWS (EXACT BOM FLOATING PILL BAR) */}
      {selectedRows.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 10000,
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px', paddingRight: '6px' }}>
            <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedRows.length}</strong> Selected
          </span>

          <button
            onClick={() => {
              if (selectedRows.length > 1) {
                alert('You can only edit one customer at a time.');
              } else if (selectedRows.length === 1) {
                const codeVal = selectedRows[0];
                const targetCust = customers.find(c => c.customerCode === codeVal || c.id === codeVal);
                if (targetCust) handleOpenEditPage(targetCust);
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
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <Edit3 size={14} style={{ color: '#64748B' }} /> Edit Info
          </button>

          <button
            onClick={() => {
              if (selectedRows.length === 1) {
                const codeVal = selectedRows[0];
                const targetCust = customers.find(c => c.customerCode === codeVal || c.id === codeVal);
                if (targetCust) {
                  setSelectedCustomer(targetCust);
                  setViewMode('details');
                  setProfileTab('Timeline');
                }
              } else {
                alert('Please select a single customer to view 360° details.');
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
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <Eye size={14} style={{ color: '#0E7490' }} /> View 360°
          </button>

          <button
            onClick={() => setSelectedRows([])}
            title="Deselect all"
            style={{ backgroundColor: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

    </div>
  );
}
