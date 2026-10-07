import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users, Search, Plus, Phone, MessageSquare, Mail, Building2, MapPin,
  CreditCard, FileText, CheckCircle2, ChevronRight, ChevronDown, X, AlertTriangle,
  Layers, Truck, DollarSign, Calendar, Eye, Edit3, ShieldAlert, RotateCcw,
  Trash2, Save, ArrowLeft, Check, RefreshCw, Briefcase, UserCheck,
  Clock, Tag, MoreHorizontal, Sparkles, ExternalLink, Send, AlertCircle,
  UploadCloud, FileSpreadsheet, Download, FileCheck, ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
  onNavigateTab,
  isLoading = false
}) {
  // Page mode: 'table' | 'create' | 'details' (Dedicated full-page views)
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'create' | 'details'
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

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

  // Sync with Central Database on component mount & manual trigger
  const handleSyncWithBackend = async (isManual = false) => {
    // Only perform the heavy POST sync if manually triggered by user clicking sync button
    if (isManual) {
      setIsSyncing(true);
      try {
        if (Array.isArray(customers) && customers.length > 0) {
          const unsynced = customers.filter(c => (c.customerCode || c.companyName));
          for (const cust of unsynced) {
            try {
              await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cust)
              });
            } catch (e) {
              console.warn('Manual sync push notice for customer:', cust.customerCode, e.message);
            }
          }
        }

        const res = await fetch('/api/customers');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            if (typeof onBatchUpdateCustomers === 'function') {
              onBatchUpdateCustomers(data);
            } else if (typeof onSaveCustomer === 'function') {
              data.forEach(c => onSaveCustomer(c));
            }
            setSyncMessage({
              type: 'success',
              title: 'Customers Synchronized',
              message: `Synchronized ${data.length} customer account(s) with Central Database!`
            });
            addLiveNotification({
              id: 'cust_sync_' + Date.now(),
              title: 'Customers Synchronized',
              message: `Synchronized ${data.length} customer account(s) with Central Database!`,
              time: 'Just now',
              type: 'success',
              role: 'All',
              targetTab: 'Customers'
            });
          }
        }
      } catch (err) {
        console.warn('Customer sync notice:', err.message);
        setSyncMessage({
          type: 'error',
          title: 'Customer Sync Notice',
          message: err.message || 'Unable to synchronize customer accounts.'
        });
      } finally {
        setIsSyncing(false);
      }
    } else {
      // Background sync on mount: only query database if customers list has not been populated yet
      if (!Array.isArray(customers) || customers.length === 0) {
        try {
          const res = await fetch('/api/customers');
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0 && typeof onBatchUpdateCustomers === 'function') {
              onBatchUpdateCustomers(data);
            }
          }
        } catch (_) {}
      }
    }
  };

  // Single mount check: only sync if customers prop is currently empty
  useEffect(() => {
    if (!Array.isArray(customers) || customers.length === 0) {
      handleSyncWithBackend(false);
    }
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

  // Bulk Upload Modal State & Handlers
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [importStep, setImportStep] = useState(1); // 1: Upload File, 2: Map Fields (Zoho Books style), 3: Preview & Import
  const [bulkFile, setBulkFile] = useState(null);
  const [rawFileRows, setRawFileRows] = useState([]);
  const [fileHeaders, setFileHeaders] = useState([]);
  const [fieldMapping, setFieldMapping] = useState({});
  const [bulkParsedData, setBulkParsedData] = useState([]);
  const [bulkError, setBulkError] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const bulkFileInputRef = useRef(null);

  // Zoho-style Field Definitions for B2B Customer Mapping
  const BUSINZ_IMPORT_FIELDS = useMemo(() => [
    { key: 'companyName', label: 'Company Name', required: true, hint: 'Legal business name or organization' },
    { key: 'customerName', label: 'Customer / Contact Name', required: false, hint: 'Display name or contact person' },
    { key: 'customerType', label: 'Customer Type', required: false, hint: 'e.g. EPC Contractor, Developer, Reseller' },
    { key: 'contactPerson', label: 'Primary Contact Person', required: false, hint: 'Key contact person or manager' },
    { key: 'phone', label: 'Phone / Mobile', required: true, hint: 'Primary phone or WhatsApp number' },
    { key: 'email', label: 'Email Address', required: false, hint: 'Official billing or communication email' },
    { key: 'gstin', label: 'GSTIN / Tax ID', required: false, hint: '15-digit GST identification number' },
    { key: 'pan', label: 'PAN Number', required: false, hint: '10-character PAN number' },
    { key: 'address', label: 'Billing Address', required: false, hint: 'Street address, building, premises' },
    { key: 'city', label: 'City', required: false, hint: 'City or town' },
    { key: 'state', label: 'State', required: false, hint: 'State / province' },
    { key: 'pincode', label: 'Pincode / ZIP', required: false, hint: 'Postal PIN code' },
    { key: 'paymentTerms', label: 'Payment Terms', required: false, hint: 'e.g. 50% Advance + 50% Dispatch, Net 30' },
    { key: 'creditLimit', label: 'Credit Limit (₹)', required: false, hint: 'Approved credit limit in INR' }
  ], []);

  // Smart Header Auto-detection
  const guessFieldMapping = (headers) => {
    const used = new Set();
    const findMatch = (patterns) => {
      for (const pattern of patterns) {
        const found = headers.find(h => !used.has(h) && pattern.test(String(h || '').trim()));
        if (found) {
          used.add(found);
          return found;
        }
      }
      return '';
    };

    return {
      companyName: findMatch([/^company\s*name/i, /^company/i, /^firm/i, /^account\s*name/i, /^legal\s*name/i, /^organization/i]),
      customerName: findMatch([/^customer\s*name/i, /^customer/i, /^client\s*name/i, /^name/i]),
      customerType: findMatch([/^customer\s*type/i, /^type/i, /^category/i, /^nature/i]),
      contactPerson: findMatch([/^primary\s*contact/i, /^contact\s*person/i, /^contact\s*name/i, /^contact/i, /^person/i]),
      phone: findMatch([/^phone/i, /^mobile/i, /^contact\s*number/i, /^cell/i, /^whatsapp/i, /^tel/i]),
      email: findMatch([/^email/i, /^e-mail/i, /^mail/i]),
      gstin: findMatch([/^gstin/i, /^gst\s*number/i, /^gst\s*no/i, /^gst/i, /^tax\s*id/i]),
      pan: findMatch([/^pan\s*number/i, /^pan\s*no/i, /^pan/i]),
      address: findMatch([/^billing\s*address/i, /^address/i, /^street/i, /^premises/i, /^location/i]),
      city: findMatch([/^city/i, /^district/i, /^town/i]),
      state: findMatch([/^state/i, /^province/i]),
      pincode: findMatch([/^pincode/i, /^pin\s*code/i, /^pin/i, /^zip/i, /^postal/i]),
      paymentTerms: findMatch([/^payment\s*terms/i, /^terms/i, /^payment\s*condition/i, /^credit\s*days/i]),
      creditLimit: findMatch([/^credit\s*limit/i, /^limit/i, /^credit/i])
    };
  };

  const handleDownloadSampleTemplate = () => {
    const templateRows = [
      {
        "Company Name": "Apex Solar Energy Pvt Ltd",
        "Customer Name": "Apex Solar Energy",
        "Customer Type": "EPC Contractor",
        "GSTIN": "33AABCA1234D1Z5",
        "PAN": "AABCA1234D",
        "Contact Person": "Ramesh Kumar",
        "Phone": "9840123456",
        "Email": "ramesh@apexsolar.in",
        "Billing Address": "Plot 12, Industrial Estate, Ambattur",
        "City": "Chennai",
        "State": "Tamil Nadu",
        "Pincode": "600058",
        "Payment Terms": "50% Advance + 50% Dispatch",
        "Credit Limit": "2500000"
      },
      {
        "Company Name": "Bright Sun Infra LLP",
        "Customer Name": "Bright Sun Infra",
        "Customer Type": "Developer",
        "GSTIN": "29AABCB5678E1Z9",
        "PAN": "AABCB5678E",
        "Contact Person": "Priya Sharma",
        "Phone": "9880198765",
        "Email": "priya@brightsun.com",
        "Billing Address": "45/2, Outer Ring Road, Bellandur",
        "City": "Bangalore",
        "State": "Karnataka",
        "Pincode": "560103",
        "Payment Terms": "Net 30",
        "Credit Limit": "5000000"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers_Template");
    XLSX.writeFile(wb, "BUSINZ_Customer_Import_Template.xlsx");
  };

  const handleBulkFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFile(file);
    setBulkError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!Array.isArray(rawJson) || rawJson.length === 0) {
          setBulkError('The uploaded sheet contains no data rows.');
          setRawFileRows([]);
          setFileHeaders([]);
          return;
        }

        // Extract headers in exact left-to-right spreadsheet column order
        const headerRow = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [])
          .map(h => String(h || '').trim())
          .filter(h => h && !h.startsWith('__EMPTY'));

        // Collect all column headers from the uploaded spreadsheet
        const headersSet = new Set(headerRow);
        rawJson.forEach(row => {
          Object.keys(row).forEach(k => {
            const trimmed = String(k || '').trim();
            if (trimmed && !trimmed.startsWith('__EMPTY')) {
              headersSet.add(trimmed);
            }
          });
        });
        const headersList = Array.from(headersSet);

        if (headersList.length === 0) {
          setBulkError('Could not detect any column headers in the uploaded file.');
          return;
        }

        setRawFileRows(rawJson);
        setFileHeaders(headersList);

        // Auto-match headers and advance to Step 2 (Field Mapping)
        const initialMapping = guessFieldMapping(headersList);
        setFieldMapping(initialMapping);
        setImportStep(2);
      } catch (err) {
        console.error('Error reading excel/csv file:', err);
        setBulkError('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleProceedToPreview = () => {
    // Validation: Require at least companyName or customerName or contactPerson
    const hasNameMapping = Boolean(fieldMapping.companyName || fieldMapping.customerName || fieldMapping.contactPerson);
    if (!hasNameMapping) {
      setBulkError('Please map at least "Company Name" or "Customer / Contact Name" to a column from your spreadsheet.');
      return;
    }

    setBulkError(null);

    // Compile rows using the selected fieldMapping
    const mapped = rawFileRows.map((row, idx) => {
      const getVal = (key) => {
        const headerName = fieldMapping[key];
        if (!headerName) return '';
        return String(row[headerName] ?? '').trim();
      };

      const companyName = getVal('companyName');
      const customerName = getVal('customerName') || companyName;
      const contactName = getVal('contactPerson') || customerName;
      const customerType = getVal('customerType') || 'EPC Contractor';
      const phone = getVal('phone');
      const email = getVal('email');
      const gstin = getVal('gstin').toUpperCase();
      const pan = getVal('pan').toUpperCase() || (gstin.length === 15 ? gstin.substring(2, 12) : '');
      const address = getVal('address');
      const city = getVal('city');
      const state = getVal('state');
      const pincode = getVal('pincode');
      const paymentTerms = getVal('paymentTerms') || '50% Advance + 50% Dispatch';
      const limitRaw = getVal('creditLimit');
      const creditLimit = limitRaw ? (parseFloat(limitRaw.replace(/[^0-9.]/g, '')) || 2500000) : 2500000;

      return {
        id: 'CUST-VRM-' + String(100 + customers.length + idx + 1),
        customerCode: 'CUST-VRM-' + String(100 + customers.length + idx + 1),
        companyName: companyName || customerName || ('Customer ' + (idx + 1)),
        customerName: customerName || companyName || ('Customer ' + (idx + 1)),
        customerType,
        gstNumber: gstin,
        panNumber: pan,
        primaryContact: {
          name: contactName,
          phone: phone,
          whatsapp: phone,
          email: email
        },
        address,
        city,
        state,
        pincode,
        dispatchAddress: address,
        dispatchCity: city,
        dispatchState: state,
        dispatchPincode: pincode,
        sameAsBilling: true,
        paymentTerms,
        creditLimit,
        creditDays: 30,
        assignedSalesperson: activeAccountUser,
        source: 'Bulk Import',
        status: 'ACTIVE',
        code: customerName || companyName,
        c2: companyName || customerName,
        c3: contactName,
        c4: phone,
        c5: email,
        c6: address,
        c7: address
      };
    }).filter(c => c.companyName || c.customerName);

    if (mapped.length === 0) {
      setBulkError('No valid customer records could be compiled. Please check your mapped columns.');
      return;
    }

    setBulkParsedData(mapped);
    setImportStep(3); // Advance to preview
  };

  const handleExecuteBulkImport = async () => {
    if (bulkParsedData.length === 0) return;
    setIsImporting(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulkParsedData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (typeof onBatchUpdateCustomers === 'function') {
          onBatchUpdateCustomers(bulkParsedData);
        }
        setSyncMessage({
          type: 'success',
          text: '✓ Successfully imported ' + bulkParsedData.length + ' customers into BUSINZ!'
        });
        addLiveNotification({
          title: 'Bulk Customer Import',
          message: bulkParsedData.length + ' new customer accounts were imported into the directory.',
          type: 'success'
        });
        setIsBulkModalOpen(false);
        setBulkFile(null);
        setRawFileRows([]);
        setFileHeaders([]);
        setFieldMapping({});
        setBulkParsedData([]);
        setImportStep(1);
      } else {
        throw new Error(data.error || 'Failed to save imported customers');
      }
    } catch (err) {
      console.error('Bulk import error:', err);
      setBulkError('Import failed: ' + err.message);
    } finally {
      setIsImporting(false);
    }
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

  // Submit Handler for Dedicated Customer Creation & Central Sync
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

    // 3. Post to Central Customers API
    try {
      const response = await fetch('/api/customers', {
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
      setSyncMessage({
        type: 'success',
        text: resJson.message || '✅ Customer created and synchronized successfully!'
      });
    } catch (err) {
      console.warn('Customer Sync warning:', err);
      setSyncMessage({
        type: 'info',
        text: 'Customer created locally in Businz. Central sync will retry automatically.'
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
                Configure client directory, enterprise KYC, billing & delivery addresses, commercial payment terms & directory sync
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
              {editingCustomer ? 'Update Customer →' : 'Save Customer →'}
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
                <option value="ERP">ERP Database Import</option>
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
            {editingCustomer ? 'Update Customer' : 'Save Customer'}
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
      {syncMessage && (
        <NotificationToast
          alert={syncMessage}
          onClose={() => setSyncMessage(null)}
        />
      )}

      {/* 1. TOP HEADER WITH CREATE CUSTOMER BUTTON (MATCHING BOM PAGE TITLE & ACTION STYLE) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Customer Directory
          </h2>
          <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
            Centralized repository with 11-point 360° account intelligence, credit limits & automatic database synchronization
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => {
              setBulkError(null);
              setBulkFile(null);
              setRawFileRows([]);
              setFileHeaders([]);
              setFieldMapping({});
              setBulkParsedData([]);
              setImportStep(1);
              setIsBulkModalOpen(true);
            }}
            style={{
              backgroundColor: "#FFFFFF",
              border: "1.5px solid #0E7490",
              color: "#0E7490",
              height: "40px",
              padding: "0 16px",
              borderRadius: "50px",
              fontSize: "13px",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              boxShadow: "0 1px 3px rgba(14, 116, 144, 0.1)",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#F0FDFA";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#FFFFFF";
            }}
          >
            <UploadCloud size={16} strokeWidth={2.5} />
            <span>Upload Customer</span>
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
              {isLoading ? (
                <>
                  <tr style={{ backgroundColor: '#F0FDFA' }}>
                    <td
                      colSpan={7}
                      style={{ padding: '24px 16px', textAlign: 'center', borderBottom: '1px solid #CCFBF1' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="businz-spin-ring" />
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490' }}>
                                Loading Customer Accounts...
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#ECFDF5', color: '#059669', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', border: '1px solid #A7F3D0' }}>
                                <span className="businz-pulse-dot" /> Live Cloud Database Sync
                              </span>
                            </div>
                            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                              Retrieving customer directory from Businz Cloud...
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {Array.from({ length: 5 }).map((_, sIdx) => (
                    <tr key={`cust-skel-${sIdx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ textAlign: 'center', padding: '12px 0', width: '48px' }}>
                        <input type="checkbox" disabled style={{ opacity: 0.3 }} />
                      </td>
                      {Array.from({ length: 6 }).map((_, hIdx) => (
                        <td key={`cust-skel-cell-${hIdx}`} style={{ padding: '12px 14px' }}>
                          <div
                            className="skeleton-shimmer skeleton-text"
                            style={{
                              width: hIdx === 0 ? '90px' : (hIdx === 1 ? '65%' : '100px'),
                              height: '14px'
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ) : currentRows.length === 0 ? (
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
                setSelectedRows([]);
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
                setSelectedRows([]);
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


      {/* 5. BULK CUSTOMER UPLOAD MODAL (WITH ZOHO BOOKS-STYLE FIELD MAPPING) */}
      {isBulkModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.15s ease'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isImporting) {
              setIsBulkModalOpen(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '820px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                borderBottom: '1px solid #F1F5F9',
                backgroundColor: '#F8FAFC'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: '#ECFEFF',
                    color: '#0E7490',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <UploadCloud size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                    Import Customers (Zoho-Style Column Mapping)
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    Upload any spreadsheet and map your columns directly to BUSINZ customer fields
                  </p>
                </div>
              </div>

              <button
                disabled={isImporting}
                onClick={() => setIsBulkModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: isImporting ? 'not-allowed' : 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Zoho-style 3-Step Wizard Progress Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 24px',
                backgroundColor: '#F1F5F9',
                borderBottom: '1px solid #E2E8F0',
                fontSize: '12px',
                fontWeight: '700'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  onClick={() => { if (importStep > 1 && !isImporting) setImportStep(1); }}
                  style={{
                    cursor: importStep > 1 ? 'pointer' : 'default',
                    color: importStep === 1 ? '#0E7490' : (importStep > 1 ? '#16A34A' : '#64748B'),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: importStep === 1 ? '#0E7490' : (importStep > 1 ? '#DCFCE7' : '#E2E8F0'),
                    color: importStep === 1 ? '#FFFFFF' : (importStep > 1 ? '#16A34A' : '#64748B'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px'
                  }}>
                    {importStep > 1 ? '✓' : '1'}
                  </span>
                  <span>1. Select File</span>
                </div>

                <ChevronRight size={14} style={{ color: '#94A3B8' }} />

                <div
                  onClick={() => { if (rawFileRows.length > 0 && !isImporting) setImportStep(2); }}
                  style={{
                    cursor: rawFileRows.length > 0 ? 'pointer' : 'default',
                    color: importStep === 2 ? '#0E7490' : (importStep > 2 ? '#16A34A' : '#64748B'),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: importStep === 2 ? '#0E7490' : (importStep > 2 ? '#DCFCE7' : '#E2E8F0'),
                    color: importStep === 2 ? '#FFFFFF' : (importStep > 2 ? '#16A34A' : '#64748B'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px'
                  }}>
                    {importStep > 2 ? '✓' : '2'}
                  </span>
                  <span>2. Map Fields</span>
                </div>

                <ChevronRight size={14} style={{ color: '#94A3B8' }} />

                <div
                  style={{
                    color: importStep === 3 ? '#0E7490' : '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: importStep === 3 ? '#0E7490' : '#E2E8F0',
                    color: importStep === 3 ? '#FFFFFF' : '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px'
                  }}>
                    3
                  </span>
                  <span>3. Preview & Import</span>
                </div>
              </div>

              {bulkFile && (
                <div style={{ fontSize: '11.5px', color: '#475569', fontWeight: '500' }}>
                  File: <strong>{bulkFile.name}</strong> ({rawFileRows.length} rows)
                </div>
              )}
            </div>

            {/* Error Message Banner */}
            {bulkError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px 20px',
                  backgroundColor: '#FEF2F2',
                  borderBottom: '1px solid #FCA5A5',
                  color: '#991B1B',
                  fontSize: '12.5px'
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>{bulkError}</div>
                <button
                  type="button"
                  onClick={() => setBulkError(null)}
                  style={{ background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', padding: 0 }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ========================================================================= */}
              {/* STEP 1: SELECT FILE */}
              {/* ========================================================================= */}
              {importStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Sample Template Download Callout */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      backgroundColor: '#F0FDFA',
                      borderRadius: '12px',
                      border: '1px solid #CCFBF1',
                      gap: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <FileSpreadsheet size={22} style={{ color: '#0E7490', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#134E4A' }}>
                          Need the standard Excel format?
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#115E59' }}>
                          Download our pre-structured template or upload your existing customer file.
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadSampleTemplate}
                      style={{
                        backgroundColor: '#0E7490',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        boxShadow: '0 1px 2px rgba(14, 116, 144, 0.2)'
                      }}
                    >
                      <Download size={14} /> Download Sample Template
                    </button>
                  </div>

                  {/* Upload Drop Area */}
                  <div>
                    <input
                      type="file"
                      ref={bulkFileInputRef}
                      accept=".xlsx, .xls, .csv"
                      onChange={handleBulkFileChange}
                      style={{ display: 'none' }}
                    />

                    <div
                      onClick={() => {
                        if (!isImporting && bulkFileInputRef.current) {
                          bulkFileInputRef.current.click();
                        }
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (isImporting) return;
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          const droppedFile = e.dataTransfer.files[0];
                          const fakeEvent = { target: { files: [droppedFile] } };
                          handleBulkFileChange(fakeEvent);
                        }
                      }}
                      style={{
                        border: '2px dashed #CBD5E1',
                        borderRadius: '12px',
                        padding: '40px 20px',
                        textAlign: 'center',
                        backgroundColor: '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#0E7490';
                        e.currentTarget.style.backgroundColor = '#F0FDFA';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#CBD5E1';
                        e.currentTarget.style.backgroundColor = '#FFFFFF';
                      }}
                    >
                      <div
                        style={{
                          width: '54px',
                          height: '54px',
                          borderRadius: '50%',
                          backgroundColor: '#F1F5F9',
                          color: '#0E7490',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '4px'
                        }}
                      >
                        <UploadCloud size={28} />
                      </div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                        Click to select an Excel (.xlsx, .xls) or CSV file
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#64748B' }}>
                        or drag and drop your spreadsheet here to configure column mapping
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* STEP 2: ZOHO-STYLE FIELD MAPPING TABLE */}
              {/* ========================================================================= */}
              {importStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#F8FAFC',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>
                      Map your file headers to BUSINZ customer fields. If your actual company name is in <strong>Primary Contact</strong> or another column, select it in the dropdown below.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (bulkFileInputRef.current) bulkFileInputRef.current.click();
                      }}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#0E7490',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Change File
                    </button>
                  </div>

                  {/* Zoho Books Style Mapping Table */}
                  <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '42% 58%',
                        backgroundColor: '#F8FAFC',
                        borderBottom: '1px solid #E2E8F0',
                        padding: '10px 16px',
                        fontSize: '11.5px',
                        fontWeight: '800',
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      <div>BUSINZ FIELD</div>
                      <div>IMPORTED FILE HEADERS ({fileHeaders.length} Columns Found)</div>
                    </div>

                    <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                      {BUSINZ_IMPORT_FIELDS.map((field, idx) => {
                        const selectedHeader = fieldMapping[field.key] || '';
                        const sampleVal = selectedHeader && rawFileRows[0] ? rawFileRows[0][selectedHeader] : null;

                        return (
                          <div
                            key={field.key}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '42% 58%',
                              alignItems: 'center',
                              padding: '10px 16px',
                              borderBottom: idx < BUSINZ_IMPORT_FIELDS.length - 1 ? '1px solid #F1F5F9' : 'none',
                              backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'
                            }}
                          >
                            {/* Left: BUSINZ Target Field */}
                            <div style={{ paddingRight: '12px' }}>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>{field.label}</span>
                                {field.required && (
                                  <span style={{ color: '#EF4444', fontWeight: '800' }}>*</span>
                                )}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>
                                {field.hint}
                              </div>
                            </div>

                            {/* Right: Dropdown of File Headers + Sample Value */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <select
                                  value={selectedHeader}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setFieldMapping(prev => ({
                                      ...prev,
                                      [field.key]: val
                                    }));
                                  }}
                                  style={{
                                    flex: 1,
                                    height: '34px',
                                    borderRadius: '6px',
                                    border: selectedHeader ? '1.5px solid #0E7490' : '1px solid #CBD5E1',
                                    backgroundColor: selectedHeader ? '#F0FDFA' : '#FFFFFF',
                                    color: selectedHeader ? '#0F172A' : '#64748B',
                                    fontSize: '12.5px',
                                    fontWeight: selectedHeader ? '600' : '400',
                                    padding: '0 8px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <option value="">Select</option>
                                  {fileHeaders.map(hdr => {
                                    const isUsedElsewhere = Object.entries(fieldMapping).some(
                                      ([k, v]) => k !== field.key && v === hdr
                                    );
                                    return (
                                      <option key={hdr} value={hdr} disabled={isUsedElsewhere}>
                                        {hdr} {isUsedElsewhere ? '(Already mapped)' : ''}
                                      </option>
                                    );
                                  })}
                                </select>

                                {selectedHeader && (
                                  <button
                                    type="button"
                                    title="Unmap this field"
                                    onClick={() => {
                                      setFieldMapping(prev => ({ ...prev, [field.key]: '' }));
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#94A3B8',
                                      cursor: 'pointer',
                                      padding: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    <X size={15} />
                                  </button>
                                )}
                              </div>

                              {/* Sample Value from Row 1 */}
                              {selectedHeader && sampleVal !== null && sampleVal !== undefined && (
                                <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '2px' }}>
                                  <span style={{ color: '#0E7490', fontWeight: '700' }}>Row 1 Sample:</span>
                                  <span style={{ color: '#334155', fontStyle: 'italic', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    "{String(sampleVal).trim() || '(empty)'}"
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* STEP 3: PREVIEW COMPILED DATA */}
              {/* ========================================================================= */}
              {importStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: '#F0FDFA',
                      borderRadius: '8px',
                      border: '1px solid #CCFBF1'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#134E4A' }}>
                        Ready to Import {bulkParsedData.length} Customers
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#115E59' }}>
                        Records compiled using your custom column mapping from <strong>{bulkFile?.name}</strong>.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImportStep(2)}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #0E7490',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0E7490',
                        cursor: 'pointer'
                      }}
                    >
                      ← Adjust Mapping
                    </button>
                  </div>

                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                    Preview (First {Math.min(bulkParsedData.length, 5)} rows):
                  </div>

                  <div
                    style={{
                      maxHeight: '260px',
                      overflowY: 'auto',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px'
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px', fontWeight: '700', color: '#475569' }}>Company Name</th>
                          <th style={{ padding: '8px 12px', fontWeight: '700', color: '#475569' }}>Customer / Contact</th>
                          <th style={{ padding: '8px 12px', fontWeight: '700', color: '#475569' }}>Type</th>
                          <th style={{ padding: '8px 12px', fontWeight: '700', color: '#475569' }}>Phone</th>
                          <th style={{ padding: '8px 12px', fontWeight: '700', color: '#475569' }}>Email</th>
                          <th style={{ padding: '8px 12px', fontWeight: '700', color: '#475569' }}>GSTIN</th>
                          <th style={{ padding: '8px 12px', fontWeight: '700', color: '#475569' }}>City / State</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkParsedData.slice(0, 5).map((row, idx) => (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: idx < 4 ? '1px solid #F1F5F9' : 'none',
                              backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'
                            }}
                          >
                            <td style={{ padding: '8px 12px', fontWeight: '700', color: '#0F172A' }}>
                              {row.companyName}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#334155' }}>
                              {row.primaryContact?.name || row.customerName}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>{row.customerType || 'Customer'}</td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>{row.phone || '-'}</td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>{row.email || '-'}</td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>{row.gstNumber || '-'}</td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>
                              {[row.city, row.state].filter(Boolean).join(', ') || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {bulkParsedData.length > 5 && (
                    <div style={{ fontSize: '11.5px', color: '#64748B', textAlign: 'right' }}>
                      + {bulkParsedData.length - 5} more customer accounts will be created
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Navigation */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                borderTop: '1px solid #F1F5F9',
                backgroundColor: '#F8FAFC'
              }}
            >
              <div>
                {importStep > 1 ? (
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => setImportStep(prev => prev - 1)}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      color: '#475569',
                      borderRadius: '8px',
                      padding: '9px 16px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: isImporting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    ← Previous
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={() => setIsBulkModalOpen(false)}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      color: '#475569',
                      borderRadius: '8px',
                      padding: '9px 16px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: isImporting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {importStep === 1 && (
                  <button
                    type="button"
                    disabled={rawFileRows.length === 0}
                    onClick={() => setImportStep(2)}
                    style={{
                      backgroundColor: rawFileRows.length > 0 ? '#0E7490' : '#94A3B8',
                      border: 'none',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      padding: '9px 20px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: rawFileRows.length > 0 ? 'pointer' : 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: rawFileRows.length > 0 ? '0 2px 4px rgba(14, 116, 144, 0.25)' : 'none'
                    }}
                  >
                    <span>Next: Map Fields</span>
                    <ArrowRight size={15} />
                  </button>
                )}

                {importStep === 2 && (
                  <button
                    type="button"
                    onClick={handleProceedToPreview}
                    style={{
                      backgroundColor: '#0E7490',
                      border: 'none',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      padding: '9px 22px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>Next: Preview Data ({rawFileRows.length} Rows)</span>
                    <ArrowRight size={15} />
                  </button>
                )}

                {importStep === 3 && (
                  <button
                    type="button"
                    disabled={isImporting || bulkParsedData.length === 0}
                    onClick={handleExecuteBulkImport}
                    style={{
                      backgroundColor: bulkParsedData.length > 0 ? '#0E7490' : '#94A3B8',
                      border: 'none',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      padding: '9px 24px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: isImporting || bulkParsedData.length === 0 ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: bulkParsedData.length > 0 ? '0 2px 4px rgba(14, 116, 144, 0.25)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Importing Customers...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={16} />
                        <span>Import & Save ({bulkParsedData.length}) Customers</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
