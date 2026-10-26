import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Filter, Plus, Phone, MessageSquare, Calendar, ArrowRight,
  CheckCircle2, Clock, AlertCircle, Building2, User, Mail, ExternalLink,
  ChevronRight, RefreshCw, X, ShieldAlert, Sparkles, Tag, Eye, MoreHorizontal,
  FileText, Check, ChevronDown, Zap, Send, TrendingUp, Layers, Award,
  Trash2, UserCheck, RotateCcw, Download, Printer, ChevronLeft,
  ChevronsLeft, ChevronsRight, AlertTriangle, PhoneCall, Users,
  FileCheck2, Compass, Edit3, UserPlus, Lock
} from 'lucide-react';
import Lead360PageView, { LEAD_STAGES, getStageRank, canTransitionStage } from './Lead360PageView';
import { getNextSequence } from '../../utils/sequenceGenerator';

const STRUCTURE_CATEGORIES = [
  'Aluminium Mounting Structures',
  'Tin Shed Clamping Systems',
  'HDG Ground Mounting Structures',
  'Walkways & Safety Handrails',
  'Ballasted Rooftop Systems',
  'Solar Carport Structures',
  'Custom OEM Mounting'
];

export default function CrmLeadsView({
  userRole = 'Sales Executive',
  customers = [],
  quotations = [],
  opportunities = [],
  boms = [],
  onNavigateTab,
  onOpenWhatsAppChat,
  onConvertLead
}) {
  // Current Logged In User Identity
  const loggedInEmpId = (localStorage.getItem('controlroom_logged_emp_id') || '').trim();
  const loggedInUserName = (localStorage.getItem('controlroom_logged_user_name') || '').trim();
  const loggedInEmail = (localStorage.getItem('controlroom_logged_user') || '').trim().toLowerCase();

  // Role Checks
  const effectiveRole = (typeof window !== 'undefined' ? (localStorage.getItem('controlroom_user_role') || userRole) : userRole) || '';
  const effectiveRoleLower = effectiveRole.toLowerCase();
  const empCodeUpper = (loggedInEmpId || '').toUpperCase().trim();
  const userNameLower = (loggedInUserName || '').toLowerCase().trim();

  const isCeo = ['ceo', 'md', 'managing director'].some(r => effectiveRoleLower.includes(r)) || empCodeUpper.startsWith('CEO-') || userNameLower.includes('ceo') || userNameLower.includes('md');
  const isTechSupport = ['tech support', 'technical support', 'tech_support'].some(r => effectiveRoleLower.includes(r)) || empCodeUpper.startsWith('TS-') || userNameLower.includes('tech support') || userNameLower.includes('support');
  const isSalesHead = effectiveRoleLower.includes('sales head') || empCodeUpper.startsWith('SH-');
  const isTechAdmin = ['technical administrator', 'technical admin', 'developer', 'ta', 'admin', 'super admin'].some(r => effectiveRoleLower.includes(r)) || empCodeUpper.startsWith('TA-') || empCodeUpper.startsWith('ADM-');
  const isSalesPerson = (effectiveRoleLower.includes('sales') && !isSalesHead && !isCeo && !isTechSupport && !isTechAdmin);
  const isSalesExec = !isCeo && !isTechSupport && !isSalesHead && !isTechAdmin;

  // Lead Creation Privilege: strictly CEO/MD and Tech Support / Tech Admin alone (NEVER sales person / sales executive / sales head)
  const canCreateLead = (isCeo || isTechSupport || isTechAdmin) && !isSalesPerson;

  // Global Visibility Privileges: strictly CEO/MD and Tech Support / Tech Admin / Sales Head / Admin
  const hasGlobalView = isCeo || isTechSupport || isTechAdmin || isSalesHead;
  const canAssign = isCeo || isTechSupport || isTechAdmin;

  // Master State from Authoritative PostgreSQL API
  const [dbLeads, setDbLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [salespersons, setSalespersons] = useState([]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [assignedFilter, setAssignedFilter] = useState('All');

  // Interactive Selection State
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);

  // Page mode: 'table' | '360' (Dedicated full-page 360° intelligence view)
  const [viewMode, setViewMode] = useState('table');
  const [editingLead, setEditingLead] = useState(null);

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [activeLead, setActiveLead] = useState(null);
  const [leadDetailData, setLeadDetailData] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Pagination State (Strictly [5, 10])
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [goToPageInput, setGoToPageInput] = useState('');

  // Notifications State
  const [notifications, setNotifications] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  // Create Form State
  const [createForm, setCreateForm] = useState({
    companyName: '',
    contactPerson: '',
    designation: '',
    phone: '',
    whatsapp: '',
    email: '',
    location: '',
    source: 'Direct Inbound',
    productRequirement: '',
    category: '',
    estimatedKw: '',
    notes: '',
    priority: 'MEDIUM',
    status: 'New',
    assignedToId: '',
    assignedToName: '',
    assignedToRole: ''
  });

  // Assign Form State
  const [assignForm, setAssignForm] = useState({
    assignedToId: '',
    assignedToName: '',
    assignedToRole: 'Sales Executive',
    reason: 'Assigned for prompt customer qualification'
  });

  // Activity Form State
  const [activityForm, setActivityForm] = useState({
    activityType: 'CALL',
    callDurationSeconds: 180,
    summary: '',
    customerResponse: ''
  });

  // Inbound Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch Authoritative Leads from Backend
  const fetchLeads = async () => {
    try {
      setIsLoading(true);
      const headers = {
        'x-user-role': effectiveRole || userRole,
        'x-user-emp-id': loggedInEmpId,
        'x-user-name': loggedInUserName
      };

      const res = await fetch('/api/crm/leads', { headers });
      const json = await res.json();
      if (json?.success && Array.isArray(json.data)) {
        setDbLeads(json.data);
      }
    } catch (err) {
      console.error('Failed to load leads from database:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Salespersons for Assignment Dropdowns
  const fetchSalespersons = async () => {
    try {
      const res = await fetch('/api/crm/salespersons');
      const json = await res.json();
      if (json?.success && Array.isArray(json.salespersons)) {
        setSalespersons(json.salespersons);
      }
    } catch (err) {
      console.error('Failed to load salespersons:', err);
    }
  };

  // Fetch Notifications
  const fetchNotifications = async () => {
    if (!loggedInEmpId) return;
    try {
      const res = await fetch(`/api/crm/leads/notifications?employeeCode=${encodeURIComponent(loggedInEmpId)}`, {
        headers: { 'x-user-emp-id': loggedInEmpId }
      });
      const json = await res.json();
      if (json?.success && Array.isArray(json.notifications)) {
        setNotifications(json.notifications);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchSalespersons();
    fetchNotifications();

    // Periodic Refresh every 45s
    const timer = setInterval(() => {
      fetchLeads();
      fetchNotifications();
    }, 45000);

    return () => clearInterval(timer);
  }, [userRole, loggedInEmpId]);

  // Load Lead Detailed History and Open Lead 360° Intelligence View
  const openLeadDetail = async (lead) => {
    setActiveLead(lead);
    setViewMode('360');
    setIsDetailLoading(true);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}`);
      const json = await res.json();
      if (json?.success && json.data) {
        setLeadDetailData(json.data);
      } else {
        setLeadDetailData(lead);
      }
    } catch (err) {
      setLeadDetailData(lead);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // 12 KPI Metrics Calculation
  const kpis = useMemo(() => {
    const list = dbLeads || [];
    const now = new Date();

    const totalLeads = list.length;
    const unassigned = list.filter(l => !l.assigned_to_user_id || l.status === 'New').length;
    const assigned = list.filter(l => l.assigned_to_user_id && l.status === 'Assigned').length;
    const contacted = list.filter(l => ['Contacted', 'In Progress', 'Qualified'].includes(l.status)).length;
    const proposalSent = list.filter(l => l.status === 'Proposal Sent' || Number(l.quotes_sent || 0) > 0).length;
    const revisions = list.reduce((sum, l) => sum + Number(l.total_revisions || 0), 0);
    const converted = list.filter(l => l.status === 'Converted' || Number(l.quotes_accepted || 0) > 0).length;
    const dropped = list.filter(l => ['Dropped', 'Lost', 'Disqualified'].includes(l.status)).length;
    const unattended2h = list.filter(l => l.is_unattended_2h || l.is_unattended_24h).length;
    const escalated48h = list.filter(l => l.is_unattended_48h).length;

    const followupsToday = list.filter(l => {
      if (!l.next_followup_date) return false;
      const d = new Date(l.next_followup_date);
      return d.toDateString() === now.toDateString();
    }).length;

    const indiamartLeads = list.filter(l => (l.source || '').toLowerCase().includes('indiamart')).length;

    return [
      { label: 'Total Leads', val: totalLeads, color: '#0E7490', bg: '#ECFEFF', icon: Users },
      { label: 'Unassigned', val: unassigned, color: '#D97706', bg: '#FEF3C7', icon: AlertCircle },
      { label: 'Assigned Leads', val: assigned, color: '#2563EB', bg: '#EFF6FF', icon: UserCheck },
      { label: 'In Progress', val: contacted, color: '#0284C7', bg: '#E0F2FE', icon: PhoneCall },
      { label: 'Quotations Sent', val: proposalSent, color: '#7C3AED', bg: '#F3E8FF', icon: FileCheck2 },
      { label: 'Quote Revisions', val: revisions, color: '#9333EA', bg: '#FAF5FF', icon: RotateCcw },
      { label: 'Converted Won', val: converted, color: '#059669', bg: '#ECFDF5', icon: Award },
      { label: 'Dropped / Lost', val: dropped, color: '#64748B', bg: '#F1F5F9', icon: Trash2 },
      { label: '2h Inactive', val: unattended2h, color: '#EA580C', bg: '#FFF7ED', icon: Clock },
      { label: '48h Escalated', val: escalated48h, color: '#DC2626', bg: '#FEF2F2', icon: AlertCircle },
      { label: 'Follow-ups Today', val: followupsToday, color: '#0891B2', bg: '#ECFEFF', icon: Calendar },
      { label: 'IndiaMART Inbound', val: indiamartLeads, color: '#B45309', bg: '#FFFBEB', icon: Compass }
    ];
  }, [dbLeads]);

  // Status Sub-Tabs with Badges (Matching Stock Status / Items Directory Design System)
  const leadTabs = useMemo(() => {
    const list = dbLeads;
    const total = list.length;
    const unassigned = list.filter(l => !l.assigned_to_user_id || l.status === 'New').length;
    const inProgress = list.filter(l => ['Assigned', 'Contacted', 'In Progress'].includes(l.status)).length;
    const proposals = list.filter(l => l.status === 'Proposal Sent').length;
    const converted = list.filter(l => l.status === 'Converted').length;
    const inactive2h = list.filter(l => (l.is_unattended_2h || l.is_unattended_24h) && !l.is_unattended_48h).length;
    const escalated48h = list.filter(l => l.is_unattended_48h).length;
    const dropped = list.filter(l => ['Dropped', 'Lost', 'Disqualified'].includes(l.status)).length;

    return [
      { id: 'All', label: 'All Leads', count: total, bg: '#F1F5F9', color: '#475569' },
      { id: 'Unassigned', label: 'Unassigned', count: unassigned, bg: '#FEF3C7', color: '#B45309' },
      { id: 'Contacted', label: 'In Progress', count: inProgress, bg: '#E0F2FE', color: '#0369A1' },
      { id: 'Proposal Sent', label: 'Proposals', count: proposals, bg: '#F3E8FF', color: '#7E22CE' },
      { id: 'Converted', label: 'Converted', count: converted, bg: '#DCFCE7', color: '#15803D' },
      { id: '2h Inactive', label: '2h Inactive', count: inactive2h, bg: '#FFF7ED', color: '#EA580C' },
      { id: '48h Escalated', label: '48h Escalated', count: escalated48h, bg: '#FEF2F2', color: '#DC2626' },
      { id: 'Dropped', label: 'Dropped', count: dropped, bg: '#F1F5F9', color: '#64748B' }
    ];
  }, [dbLeads]);

  // Filter sales representatives strictly to Sales Executive and Sales Head roles only
  const salesRepresentatives = useMemo(() => {
    return (salespersons || []).filter(s => {
      const r = (s.role || '').trim().toLowerCase();
      return r === 'sales executive' || r === 'sales head' || r.includes('sales executive') || r.includes('sales head');
    });
  }, [salespersons]);

  // Filtering Logic
  const filteredLeads = useMemo(() => {
    return dbLeads.filter(lead => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (lead.company_name || '').toLowerCase().includes(q) ||
        (lead.contact_person || '').toLowerCase().includes(q) ||
        (lead.lead_number || '').toLowerCase().includes(q) ||
        (lead.phone || '').includes(q) ||
        (lead.email || '').toLowerCase().includes(q) ||
        (lead.location || '').toLowerCase().includes(q);

      let matchStatus = true;
      if (statusFilter === 'Unassigned') {
        matchStatus = !lead.assigned_to_user_id || lead.status === 'New';
      } else if (statusFilter === 'Contacted') {
        matchStatus = ['Assigned', 'Contacted', 'In Progress'].includes(lead.status);
      } else if (statusFilter === '2h Inactive' || statusFilter === '24h Inactive') {
        matchStatus = lead.is_unattended_2h || lead.is_unattended_24h;
      } else if (statusFilter === '48h Escalated') {
        matchStatus = lead.is_unattended_48h;
      } else if (statusFilter === 'Dropped') {
        matchStatus = ['Dropped', 'Lost', 'Disqualified'].includes(lead.status);
      } else if (statusFilter !== 'All') {
        matchStatus = lead.status === statusFilter;
      }

      // Salesperson data isolation: Sales persons see leads assigned to them + unassigned leads
      if (!hasGlobalView) {
        const myEmp = (loggedInEmpId || '').toLowerCase().trim();
        const myName = (loggedInUserName || '').toLowerCase().trim();
        const assignedId = (lead.assigned_to_user_id || '').toLowerCase().trim();
        const assignedName = (lead.assigned_to_name || lead.assigned_salesperson || '').toLowerCase().trim();

        const isUnassigned = !lead.assigned_to_user_id || lead.status === 'New';
        const isAssignedToMe = (
          isUnassigned ||
          (myEmp && (assignedId === myEmp || assignedName.includes(myEmp) || (assignedId && myEmp.includes(assignedId)))) ||
          (myName && (assignedName.includes(myName) || (assignedName && myName.includes(assignedName))))
        );
        if ((myEmp || myName) && !isAssignedToMe) return false;
      }

      const matchSource = sourceFilter === 'All' || lead.source === sourceFilter;
      const matchAssigned = assignedFilter === 'All' || lead.assigned_to_user_id === assignedFilter;

      return matchSearch && matchStatus && matchSource && matchAssigned;
    });
  }, [dbLeads, searchQuery, statusFilter, sourceFilter, assignedFilter, hasGlobalView, loggedInEmpId, loggedInUserName]);

  // Pagination Slice
  const totalEntries = filteredLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const indexOfFirstRow = (safeCurrentPage - 1) * rowsPerPage;
  const indexOfLastRow = Math.min(indexOfFirstRow + rowsPerPage, totalEntries);
  const currentRows = filteredLeads.slice(indexOfFirstRow, indexOfLastRow);

  // Table Row Selection
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedLeadIds(currentRows.map(l => l.id));
    } else {
      setSelectedLeadIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedLeadIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Open Edit Modal for Lead
  const handleOpenEditModal = (targetLead) => {
    const l = targetLead || activeLead;
    if (!l) return;
    const isConverted = Boolean(
      l.status === 'Converted' ||
      l.status === 'Won' ||
      l.is_converted ||
      l.converted_customer_code ||
      l.convertedCustomerCode ||
      l.converted_customer_id
    );
    if (isConverted) {
      alert('This lead has already been converted to a Customer and cannot be edited. Its details are locked.');
      return;
    }
    setEditingLead(l);
    setCreateForm({
      companyName: l.company_name || l.companyName || '',
      contactPerson: l.contact_person || l.contactPerson || '',
      designation: l.designation || '',
      phone: l.phone || '',
      whatsapp: l.whatsapp || '',
      email: l.email || '',
      location: l.location || '',
      source: l.source || 'Direct Inbound',
      productRequirement: l.product_requirement || l.productRequirement || '',
      category: l.category || '',
      estimatedKw: l.estimated_kw || l.estimatedKw || '',
      notes: l.notes || '',
      priority: l.priority || 'MEDIUM',
      status: l.status || 'New',
      assignedToId: l.assigned_to_user_id || '',
      assignedToName: l.assigned_to_name || '',
      assignedToRole: l.assigned_to_role || ''
    });
    setShowCreateModal(true);
  };

  // Direct Status Transition from Lead 360 View
  const handleUpdateStatusDirect = async (newStatus, remarks = '') => {
    if (!activeLead?.id) return;
    const isLeadConverted = Boolean(
      activeLead.status === 'Converted' ||
      activeLead.status === 'Won' ||
      activeLead.is_converted ||
      activeLead.converted_customer_code ||
      activeLead.convertedCustomerCode ||
      activeLead.converted_customer_id
    );
    if (isLeadConverted) {
      alert('This lead has already been converted to a Customer. Stages are locked.');
      return;
    }
    if (!canTransitionStage(activeLead.status, newStatus)) {
      alert(`Stages cannot be reversed. Lead stage can only progress forward from "${activeLead.status}".`);
      return;
    }
    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-user-role': userRole,
        'x-user-emp-id': loggedInEmpId,
        'x-user-name': loggedInUserName
      };
      const res = await fetch(`/api/crm/leads/${activeLead.id}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status: newStatus, remarks })
      });
      const data = await res.json();
      if (data?.success) {
        showToast(`Lead status updated to "${newStatus}"!`);
        await fetchLeads();
        const detRes = await fetch(`/api/crm/leads/${activeLead.id}`);
        const detJson = await detRes.json();
        if (detJson?.success && detJson.data) {
          setLeadDetailData(detJson.data);
          setActiveLead(detJson.data);
        }
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Submit Lead Creation or Update
  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!createForm.phone || !createForm.phone.trim()) {
      alert('Phone Number is mandatory.');
      return;
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-user-role': effectiveRole || userRole,
        'x-user-emp-id': loggedInEmpId,
        'x-user-name': loggedInUserName
      };

      if (editingLead) {
        if (createForm.status && !canTransitionStage(editingLead.status, createForm.status)) {
          alert(`Lead stage cannot be reversed. "${editingLead.status}" cannot be moved backward to "${createForm.status}".`);
          return;
        }
        const targetId = editingLead.id || editingLead.lead_number;
        const res = await fetch(`/api/crm/leads/${targetId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(createForm)
        });
        const data = await res.json();
        if (data?.success) {
          showToast(`Lead ${editingLead.lead_number || ''} updated successfully!`);
          setShowCreateModal(false);
          setEditingLead(null);
          await fetchLeads();
          const refreshId = editingLead.id || editingLead.lead_number;
          if (refreshId) {
            const detRes = await fetch(`/api/crm/leads/${refreshId}`);
            const detJson = await detRes.json();
            if (detJson?.success && detJson.data) {
              setLeadDetailData(detJson.data);
              setActiveLead(detJson.data);
            }
          }
        } else {
          alert(data.error || 'Failed to update lead');
        }
        return;
      }

      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers,
        body: JSON.stringify(createForm)
      });
      const data = await res.json();
      if (data?.success) {
        showToast(`Lead ${data.lead.lead_number} created successfully!`);
        setShowCreateModal(false);
        setStatusFilter('All');
        setSearchQuery('');
        setCreateForm({
          companyName: '',
          contactPerson: '',
          designation: '',
          phone: '',
          whatsapp: '',
          email: '',
          location: '',
          source: 'Direct Inbound',
          productRequirement: '',
          category: '',
          estimatedKw: '',
          notes: '',
          priority: 'MEDIUM',
          assignedToId: '',
          assignedToName: '',
          assignedToRole: ''
        });
        await fetchLeads();
      } else {
        alert(data.error || 'Failed to create lead');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Convert Lead to Customer & follow in Customer List
  const handleConvertToCustomer = async (lead) => {
    if (!lead) return;

    const compName = (lead.company_name || lead.companyName || 'New Customer').trim();
    const contactName = (lead.contact_name || lead.contactPerson || compName).trim();
    const phoneVal = (lead.phone || lead.phone_number || '').trim();
    const emailVal = (lead.email || '').trim();
    const cityVal = lead.city || 'Chennai';
    const stateVal = lead.state || 'Tamil Nadu';
    const addressVal = lead.address || '';
    const repVal = lead.assigned_to_name || lead.assignedSalesperson || loggedInUserName || '';

    // Generate canonical customer code: VRM-CS-[YYYY]-[SEQ] (e.g. VRM-CS-2026-01)
    let nextCode;
    try {
      const res = await fetch('/api/next-customer-number');
      if (res.ok) {
        const json = await res.json();
        if (json?.nextCustomerCode) nextCode = json.nextCustomerCode;
      }
    } catch (_) {}

    if (!nextCode) {
      try {
        const seq = getNextSequence('CS', customers || []);
        nextCode = seq?.code;
      } catch (_) {}
    }
    if (!nextCode) {
      const fy = new Date().getFullYear();
      nextCode = `VRM-CS-${fy}-01`;
    }
    const newCustomer = {
      id: nextCode,
      customerCode: nextCode,
      code: nextCode,
      companyName: compName,
      customerName: contactName,
      customerType: 'EPC Contractor',
      industry: 'Solar Energy / Utility Scale',
      gstNumber: lead.gst_number || lead.gstNumber || '',
      gstNo: lead.gst_number || lead.gstNumber || '',
      panNumber: lead.pan_number || lead.panNumber || '',
      address: addressVal,
      address1: addressVal,
      billingAddress: addressVal,
      dispatchAddress: addressVal,
      city: cityVal,
      state: stateVal,
      pincode: lead.pincode || '600001',
      creditLimit: 2500000,
      creditDays: 30,
      paymentTerms: '50% Advance + 50% Dispatch',
      assignedSalesperson: repVal,
      source: lead.source || 'Lead Conversion',
      phone: phoneVal,
      email: emailVal,
      primaryContact: {
        name: contactName,
        designation: lead.designation || 'Project Head',
        phone: phoneVal,
        whatsapp: lead.whatsapp || phoneVal,
        email: emailVal
      },
      leadId: lead.id || lead.lead_number,
      leadNumber: lead.lead_number || lead.id,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    // 1. Direct Central Database persistence to PostgreSQL public.customers
    try {
      await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer)
      });
    } catch (err) {
      console.warn('Customer database save notice:', err);
    }

    // 2. If onConvertLead callback exists from parent engine, call it for client state
    if (typeof onConvertLead === 'function') {
      try {
        await onConvertLead({
          ...lead,
          companyName: compName,
          contactPerson: contactName,
          phone: phoneVal,
          email: emailVal,
          assignedSalesperson: repVal
        }, newCustomer);
      } catch (err) {
        console.warn('onConvertLead error:', err);
      }
    }

    // 3. Update Lead status to 'Converted' in backend DB
    try {
      await fetch(`/api/crm/leads/${lead.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newStatus: 'Converted',
          remarks: `Converted to Customer (${newCustomer.customerCode} - ${compName})`,
          convertedCustomerId: newCustomer.id,
          convertedCustomerCode: newCustomer.customerCode,
          updatedBy: loggedInEmpId || loggedInUserName || 'SYSTEM'
        })
      });
    } catch (err) {
      console.warn('Lead status conversion sync notice:', err);
    }

    // 4. Update local dbLeads state
    setDbLeads(prev => prev.map(l => (l.id === lead.id || l.lead_number === lead.lead_number) ? { 
      ...l, 
      status: 'Converted',
      converted_customer_id: newCustomer.id,
      converted_customer_code: newCustomer.customerCode,
      convertedCustomerCode: newCustomer.customerCode
    } : l));

    // 5. Toast feedback & navigate to Customers list to follow up
    showToast(`✓ Converted "${compName}" to Customer (${newCustomer.customerCode})! Redirecting to Customers list...`);

    if (onNavigateTab) {
      setTimeout(() => {
        onNavigateTab('Customers', { searchCustomer: newCustomer.customerCode });
      }, 500);
    }
  };

  // Submit Lead Assignment
  const handleAssignLead = async (e) => {
    e.preventDefault();
    if (!activeLead) return;
    if (!assignForm.assignedToId || !assignForm.assignedToName) {
      alert('Please select a target sales employee.');
      return;
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-user-role': userRole,
        'x-user-emp-id': loggedInEmpId,
        'x-user-name': loggedInUserName
      };

      const res = await fetch(`/api/crm/leads/${activeLead.id}/assign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          assignedToId: assignForm.assignedToId,
          assignedToName: assignForm.assignedToName,
          assignedToRole: assignForm.assignedToRole,
          reason: assignForm.reason
        })
      });
      const data = await res.json();
      if (data?.success) {
        showToast(`Lead assigned to ${assignForm.assignedToName} by ${loggedInUserName || userRole}!`);
        setShowAssignModal(false);
        await fetchLeads();
        if (showDetailDrawer) await openLeadDetail(activeLead);
      } else {
        alert(data.error || 'Failed to assign lead');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Submit Lead Activity (Customer Call / WhatsApp / Meeting)
  const handleRecordActivity = async (e) => {
    e.preventDefault();
    if (!activeLead) return;
    if (!activityForm.summary.trim()) {
      alert('Please provide an activity summary.');
      return;
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-user-role': userRole,
        'x-user-emp-id': loggedInEmpId,
        'x-user-name': loggedInUserName
      };

      const res = await fetch(`/api/crm/leads/${activeLead.id}/activity`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          activityType: activityForm.activityType,
          summary: activityForm.summary,
          customerResponse: activityForm.customerResponse,
          callDurationSeconds: Number(activityForm.callDurationSeconds) || 0
        })
      });
      const data = await res.json();
      if (data?.success) {
        showToast(data.timerCleared ? 'Activity logged! Inactivity SLA timer cleared!' : 'Activity logged successfully!');
        setShowActivityModal(false);
        setActivityForm({
          activityType: 'CALL',
          callDurationSeconds: 180,
          summary: '',
          customerResponse: ''
        });
        await fetchLeads();
        if (showDetailDrawer) await openLeadDetail(activeLead);
      } else {
        alert(data.error || 'Failed to record activity');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Inbound Simulation Handler
  const handleSimulateInbound = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/crm/leads/simulate-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: 'Surya Kiran Solar EPC Pvt Ltd',
          contactPerson: 'Ramesh Kumar',
          phone: '+91 98401 55678',
          source: 'IndiaMART Inbound',
          productRequirement: '150 kW Aluminium Rooftop Mounting Structures for industrial warehouse in Hosur.',
          estimatedKw: 150
        })
      });
      const data = await res.json();
      if (data?.success) {
        showToast(`⚡ Inbound lead simulated: "${data.lead.company_name}" (${data.lead.lead_number})!`);
        await fetchLeads();
        await fetchNotifications();
      }
    } catch (err) {
      console.warn('Simulation notice:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const headers = [
      'Lead Number', 'Company Name', 'Contact Person', 'Phone', 'Email',
      'Location', 'Product Requirement', 'Estimated kW', 'Source',
      'Assigned To', 'Assigned By', 'Status', '2h Inactive', 'Created At'
    ];

    const targetList = selectedLeadIds.length > 0
      ? dbLeads.filter(l => selectedLeadIds.includes(l.id))
      : filteredLeads;

    const rows = targetList.map(l => [
      l.lead_number,
      l.company_name,
      l.contact_person,
      l.phone,
      l.email || '',
      l.location || '',
      l.product_requirement || '',
      l.estimated_kw || '',
      l.source || '',
      l.assigned_to_name ? `${l.assigned_to_name} (${l.assigned_to_user_id})` : 'Unassigned',
      l.assigned_by_name ? `${l.assigned_by_name} (${l.assigned_by_role || ''})` : '-',
      l.status || '',
      (l.is_unattended_2h || l.is_unattended_24h) ? 'YES' : 'NO',
      l.created_at ? new Date(l.created_at).toLocaleString() : ''
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BUSINZ_Leads_${selectedLeadIds.length > 0 ? 'Selected_' : 'Report_'}${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  // =========================================================================
  // MAIN RENDER: LEAD 360° INTELLIGENCE VIEW OR DEFAULT DIRECTORY TABLE
  // =========================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', minWidth: 0, paddingBottom: '80px' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} color="#10B981" />
          {toastMessage}
        </div>
      )}

      {viewMode === '360' && activeLead ? (
        <Lead360PageView
          lead={leadDetailData || activeLead}
          onBack={() => {
            setViewMode('table');
            setActiveLead(null);
            setLeadDetailData(null);
          }}
          onEditLead={(leadToEdit) => handleOpenEditModal(leadToEdit)}
          onConvertToCustomer={handleConvertToCustomer}
          onOpenWhatsAppChat={onOpenWhatsAppChat}
          onNavigateTab={onNavigateTab}
          quotations={quotations}
          opportunities={opportunities}
          boms={boms}
          customers={customers}
          activeAccountUser={loggedInUserName}
          userRole={userRole}
          onUpdateStatus={handleUpdateStatusDirect}
          onLogActivity={() => setShowActivityModal(true)}
          onAssign={() => setShowAssignModal(true)}
          onRefreshLead={async () => {
            if (activeLead?.id) {
              const res = await fetch(`/api/crm/leads/${activeLead.id}`);
              const json = await res.json();
              if (json?.success && json.data) {
                setLeadDetailData(json.data);
                setActiveLead(json.data);
              }
            }
          }}
        />
      ) : (
        <>
          {/* 1. TOP HEADER WITH CREATE BUTTON (BUSINZ DESIGN SYSTEM) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Lead Management
          </h2>
          <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
            Comprehensive inquiry-to-deal tracking, multi-channel inbound capture & automated follow-up workflows
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {canCreateLead && (
            <button
              onClick={() => {
                setEditingLead(null);
                setCreateForm({
                  companyName: '',
                  contactPerson: '',
                  designation: '',
                  phone: '',
                  whatsapp: '',
                  email: '',
                  location: '',
                  source: 'Direct Inbound',
                  productRequirement: '',
                  category: '',
                  estimatedKw: '',
                  notes: '',
                  priority: 'MEDIUM',
                  assignedToId: '',
                  assignedToName: '',
                  assignedToRole: ''
                });
                setShowCreateModal(true);
              }}
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
              <span>Create Lead</span>
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
          )}
        </div>
      </div>

      {/* 12 Modern Bright-Themed KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '12px'
      }}>
        {kpis.map((kpi, idx) => {
          const IconComp = kpi.icon;
          return (
            <div
              key={idx}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: kpi.bg,
                color: kpi.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <IconComp size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {kpi.label}
                </span>
                <span style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', display: 'block', lineHeight: 1.2 }}>
                  {kpi.val}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Authoritative Table Card (Matching Stock Status / Items Directory Design System) */}
      <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
        
        {/* 1. Integrated Search & Dropdown Filters Strip */}
        <div style={{ padding: '14px 20px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '220px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search by Lead / Company / Code / Type..."
              style={{ height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px 0 36px', fontSize: '13px', width: '100%', boxSizing: 'border-box', backgroundColor: '#FFFFFF', color: '#334155' }}
            />
            <Search style={{ width: '14px', height: '14px', color: '#94A3B8', position: 'absolute', left: '12px', top: '12px' }} />
          </div>

          <div style={{ minWidth: '150px' }}>
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1); }}
              style={{ height: '38px', width: '100%', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#FFFFFF', color: '#334155', fontWeight: '500' }}
            >
              <option value="All">All Sources</option>
              <option value="IndiaMART Inbound">IndiaMART</option>
              <option value="Website">Website</option>
              <option value="WhatsApp Inbound">WhatsApp</option>
              <option value="Direct Call">Direct Call</option>
              <option value="Referral">Referral</option>
            </select>
          </div>

          {hasGlobalView && (
            <div style={{ minWidth: '160px' }}>
              <select
                value={assignedFilter}
                onChange={(e) => { setAssignedFilter(e.target.value); setCurrentPage(1); }}
                style={{ height: '38px', width: '100%', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', backgroundColor: '#FFFFFF', color: '#334155', fontWeight: '500' }}
              >
                <option value="All">All Assignees</option>
                {salesRepresentatives.map(s => (
                  <option key={s.employee_code} value={s.employee_code}>
                    {s.employee_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(searchQuery || statusFilter !== 'All' || sourceFilter !== 'All' || assignedFilter !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All');
                setSourceFilter('All');
                setAssignedFilter('All');
                setCurrentPage(1);
              }}
              title="Reset Filters"
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                color: '#475569',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>

        {/* 2. Status Sub-Tabs Row (Exact Design from Stock Status) */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', padding: '0 20px', gap: '20px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: '#FFFFFF', overflowX: 'auto' }}>
          {leadTabs.map(tab => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setCurrentPage(1);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '12px 4px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: isActive ? '#0E7490' : '#64748B',
                  borderBottom: isActive ? '2px solid #0E7490' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: tab.bg,
                  color: tab.color,
                  fontWeight: 'bold'
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table" style={{ width: '100%', minWidth: '1180px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                  <input
                    type="checkbox"
                    checked={currentRows.length > 0 && selectedLeadIds.length === currentRows.length}
                    onChange={handleSelectAll}
                    style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                  />
                </th>
                <th style={{ padding: '12px 14px', width: '60px', minWidth: '60px', textAlign: 'center' }}>S.No.</th>
                <th style={{ padding: '12px 14px', minWidth: '220px' }}>Lead & Company</th>
                <th style={{ padding: '12px 14px', minWidth: '170px' }}>Primary Contact</th>
                <th style={{ padding: '12px 14px', minWidth: '180px' }}>Requirement</th>
                <th style={{ padding: '12px 14px', width: '130px', minWidth: '130px' }}>Source</th>
                <th style={{ padding: '12px 14px', width: '150px', minWidth: '150px' }}>Assigned To</th>
                <th style={{ padding: '12px 14px', width: '140px', minWidth: '140px', textAlign: 'center' }}>Lead Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: '#64748B' }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                    Loading authoritative CRM leads from database...
                  </td>
                </tr>
              ) : currentRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
                    No leads found matching your criteria.
                  </td>
                </tr>
              ) : (
                currentRows.map((lead, idx) => {
                  const isSelected = selectedLeadIds.includes(lead.id);

                  // Status Pill Styling
                  let statusBg = '#F1F5F9';
                  let statusColor = '#475569';
                  const st = (lead.status || 'New').toLowerCase().trim();
                  if (st === 'new') { statusBg = '#FEF3C7'; statusColor = '#B45309'; }
                  else if (st === 'assigned') { statusBg = '#EFF6FF'; statusColor = '#1D4ED8'; }
                  else if (st === 'contacted' || st === 'in progress' || st === 'process') { statusBg = '#E0F2FE'; statusColor = '#0369A1'; }
                  else if (st === 'opportunity' || st === 'qualified') { statusBg = '#F3E8FF'; statusColor = '#7E22CE'; }
                  else if (st === 'proposal sent') { statusBg = '#FAF5FF'; statusColor = '#9333EA'; }
                  else if (st === 'converted' || st === 'won') { statusBg = '#DCFCE7'; statusColor = '#15803D'; }
                  else if (['dropped', 'lost', 'disqualified'].includes(st)) { statusBg = '#FEE2E2'; statusColor = '#B91C1C'; }

                  // Source Badge Styling
                  const isIndiaMart = (lead.source || '').toLowerCase().includes('indiamart');
                  const sourceBg = isIndiaMart ? '#FFF7ED' : '#F1F5F9';
                  const sourceColor = isIndiaMart ? '#EA580C' : '#475569';

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => openLeadDetail(lead)}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        backgroundColor: isSelected ? '#ECFEFF' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      className={`table-row-hover ${isSelected ? 'selected-row' : ''}`}
                    >
                      {/* Checkbox with left accent border when selected */}
                      <td
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: '48px',
                          padding: '12px 0',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          borderLeft: isSelected ? '4px solid #0E7490' : '4px solid transparent'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(lead.id)}
                          style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                        />
                      </td>

                      {/* Row Index # */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748B', fontWeight: 600 }}>
                        {indexOfFirstRow + idx + 1}
                      </td>

                      {/* Lead & Company (Matching Material / SKU layout from Stock Status) */}
                      <td style={{ padding: '12px 14px' }}>
                        {(() => {
                          const isLeadConverted = lead.status === 'Converted' || lead.status === 'Won';
                          const resolvedCustCode = lead.converted_customer_code || lead.convertedCustomerCode || lead.converted_customer_id || (
                            customers?.find(c => 
                              (c.leadId && (c.leadId === lead.id || c.leadId === lead.lead_number)) ||
                              (c.leadNumber && (c.leadNumber === lead.lead_number || c.leadNumber === lead.id)) ||
                              (lead.phone && c.phone === lead.phone && (isLeadConverted || c.companyName === lead.company_name))
                            )?.customerCode
                          );

                          return (
                            <>
                              <div style={{ fontWeight: 700, color: '#0F172A', cursor: 'pointer' }}>
                                {lead.company_name || 'Independent Client'}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: 700 }}>
                                  {lead.lead_number || lead.id}
                                </span>
                                {!isCeo && !isTechSupport && isLeadConverted && resolvedCustCode && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (typeof onNavigateTab === 'function') {
                                        onNavigateTab('Customers', { searchCustomer: resolvedCustCode, targetCustomer: resolvedCustCode });
                                      }
                                      window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', { 
                                        detail: { tab: 'Customers', searchCustomer: resolvedCustCode, targetCustomer: resolvedCustCode } 
                                      }));
                                    }}
                                    title={`View Customer ${resolvedCustCode} in Customers`}
                                    style={{
                                      fontSize: '10px',
                                      color: '#065F46',
                                      backgroundColor: '#ECFDF5',
                                      border: '1px solid #A7F3D0',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#D1FAE5'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ECFDF5'}
                                  >
                                    Cust: {resolvedCustCode} ↗
                                  </button>
                                )}
                                {lead.created_at && (
                                  <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                                    • {new Date(lead.created_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </td>

                      {/* Primary Contact */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <User size={12} color="#64748B" /> {lead.contact_person || '-'}
                        </div>
                        {lead.phone && (
                          <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <Phone size={11} color="#94A3B8" /> {lead.phone}
                          </div>
                        )}
                        {lead.location && (
                          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>
                            {lead.location}
                          </div>
                        )}
                      </td>

                      {/* Product Requirement */}
                      <td style={{ padding: '12px 14px', maxWidth: '180px' }}>
                        <div style={{ fontSize: '12px', color: '#1E293B', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={lead.product_requirement}>
                          {lead.product_requirement || 'General Solar Mounting'}
                        </div>
                        <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: 600 }}>
                          {lead.estimated_kw ? `${lead.estimated_kw} kW` : ''}
                        </span>
                      </td>

                      {/* Source */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: sourceBg,
                          color: sourceColor,
                          border: isIndiaMart ? '1px solid #FDBA74' : '1px solid #E2E8F0'
                        }}>
                          {lead.source || 'Inbound'}
                        </span>
                      </td>

                      {/* Assigned To */}
                      <td style={{ padding: '12px 14px' }}>
                        {lead.assigned_to_name ? (
                          <div>
                            <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '12px' }}>
                              {lead.assigned_to_name}
                            </div>
                            <span style={{ fontSize: '10px', color: '#64748B', backgroundColor: '#F1F5F9', padding: '1px 5px', borderRadius: '4px' }}>
                              {lead.assigned_to_user_id}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 600, backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '4px' }}>
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Lead Status */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {(() => {
                          const isLeadConverted = lead.status === 'Converted' || lead.status === 'Won';
                          const resolvedCustCode = lead.converted_customer_code || lead.convertedCustomerCode || lead.converted_customer_id || (
                            customers?.find(c => 
                              (c.leadId && (c.leadId === lead.id || c.leadId === lead.lead_number)) ||
                              (c.leadNumber && (c.leadNumber === lead.lead_number || c.leadNumber === lead.id)) ||
                              (lead.phone && c.phone === lead.phone && (isLeadConverted || c.companyName === lead.company_name))
                            )?.customerCode
                          );

                          return (
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: '12px',
                                backgroundColor: isLeadConverted ? '#DCFCE7' : statusBg,
                                color: isLeadConverted ? '#166534' : statusColor,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                whiteSpace: 'nowrap'
                              }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isLeadConverted ? '#166534' : statusColor }}></span>
                                {isLeadConverted ? 'Converted to Customer' : (lead.status || 'New')}
                              </span>
                              {!isCeo && !isTechSupport && isLeadConverted && resolvedCustCode && (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (typeof onNavigateTab === 'function') {
                                        onNavigateTab('Customers', { searchCustomer: resolvedCustCode, targetCustomer: resolvedCustCode });
                                      }
                                      window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', { 
                                        detail: { tab: 'Customers', searchCustomer: resolvedCustCode, targetCustomer: resolvedCustCode } 
                                      }));
                                    }}
                                    title={`View Customer ${resolvedCustCode} in Customers`}
                                    style={{
                                      backgroundColor: '#0E7490',
                                      color: '#FFFFFF',
                                      border: 'none',
                                      fontSize: '11px',
                                      fontWeight: '800',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      boxShadow: '0 1px 3px rgba(14,116,144,0.3)',
                                      transition: 'transform 0.1s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                  >
                                    <UserCheck size={12} style={{ marginRight: '3px' }} />
                                    {resolvedCustCode} ↗
                                  </button>
                                </div>
                              )}
                              {lead.is_unattended_48h ? (
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#DC2626', marginTop: '3px' }}>
                                  48h Escalated
                                </div>
                              ) : (lead.is_unattended_2h || lead.is_unattended_24h) ? (
                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#EA580C', marginTop: '3px' }}>
                                  2h Unattended
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Standard Pagination Footer Layout */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderTop: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Left Side: Rows per page [5, 10] + Showing X to Y of Z entries */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748B' }}>
              <span>Showing per page</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A'
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Showing {totalEntries === 0 ? 0 : indexOfFirstRow + 1} to {indexOfLastRow} of {totalEntries} entries
            </span>
          </div>

          {/* Right Side: Page buttons (<< < 1 2 3 > >>) + Go to page input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <button
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage === 1}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: safeCurrentPage === 1 ? 0.4 : 1
                }}
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={safeCurrentPage === 1}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: safeCurrentPage === 1 ? 0.4 : 1
                }}
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  style={{
                    minWidth: '28px',
                    height: '28px',
                    padding: '0 6px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: safeCurrentPage === p ? '#0E7490' : '#CBD5E1',
                    backgroundColor: safeCurrentPage === p ? '#0E7490' : '#FFFFFF',
                    color: safeCurrentPage === p ? '#FFFFFF' : '#334155',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={safeCurrentPage === totalPages}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: safeCurrentPage === totalPages ? 0.4 : 1
                }}
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage === totalPages}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: safeCurrentPage === totalPages ? 0.4 : 1
                }}
              >
                <ChevronsRight size={14} />
              </button>
            </div>

            {/* Go to page input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>Go to page</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={goToPageInput}
                onChange={(e) => setGoToPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const p = parseInt(goToPageInput, 10);
                    if (p >= 1 && p <= totalPages) {
                      setCurrentPage(p);
                      setGoToPageInput('');
                    }
                  }
                }}
                style={{
                  width: '45px',
                  padding: '4px 6px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  textAlign: 'center'
                }}
              />
              <button
                onClick={() => {
                  const p = parseInt(goToPageInput, 10);
                  if (p >= 1 && p <= totalPages) {
                    setCurrentPage(p);
                    setGoToPageInput('');
                  }
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #0E7490',
                  backgroundColor: '#ECFEFF',
                  color: '#0E7490',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Go ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Action Bar (White pill design, single line) */}
      {selectedLeadIds.length > 0 && (
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
            <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedLeadIds.length}</strong> Selected
          </span>

          {/* View Details */}
          <button
            onClick={() => {
              const lead = dbLeads.find(l => l.id === selectedLeadIds[0]);
              setSelectedLeadIds([]);
              if (lead) openLeadDetail(lead);
            }}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#1E293B',
              borderRadius: '50px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <Eye size={14} style={{ color: '#0E7490' }} /> View Details
          </button>

          {/* Edit Lead (Accessible to Sales Person and all roles) */}
          {(() => {
            const selectedLead = selectedLeadIds.length === 1 ? dbLeads.find(l => l.id === selectedLeadIds[0]) : null;
            const isLeadConverted = selectedLead && (
              selectedLead.status === 'Converted' ||
              selectedLead.status === 'Won' ||
              selectedLead.is_converted ||
              selectedLead.converted_customer_code ||
              selectedLead.convertedCustomerCode ||
              selectedLead.converted_customer_id
            );

            if (isLeadConverted) {
              return (
                <span
                  title="Lead converted to Customer. Details cannot be edited."
                  style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #CBD5E1',
                    color: '#94A3B8',
                    borderRadius: '50px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    userSelect: 'none'
                  }}
                >
                  <Lock size={14} style={{ color: '#94A3B8' }} /> Edit Locked
                </span>
              );
            }

            return (
              <button
                onClick={() => {
                  if (selectedLeadIds.length > 1) {
                    alert('You can only edit one lead at a time.');
                    return;
                  }
                  const lead = dbLeads.find(l => l.id === selectedLeadIds[0]);
                  setSelectedLeadIds([]);
                  if (lead) handleOpenEditModal(lead);
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  color: '#1E293B',
                  borderRadius: '50px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              >
                <Edit3 size={14} style={{ color: '#0E7490' }} /> Edit Lead
              </button>
            );
          })()}

          {/* Convert to Customer / View Customer (Hidden for CEO & Tech Support logins) */}
          {!isCeo && !isTechSupport && (() => {
            const selectedLead = selectedLeadIds.length === 1 ? dbLeads.find(l => l.id === selectedLeadIds[0]) : null;
            const isLeadConverted = selectedLead && (selectedLead.status === 'Converted' || selectedLead.status === 'Won');
            const selCustCode = selectedLead && (
              selectedLead.converted_customer_code || selectedLead.convertedCustomerCode || selectedLead.converted_customer_id ||
              customers?.find(c => 
                (c.leadId && (c.leadId === selectedLead.id || c.leadId === selectedLead.lead_number)) || 
                (c.leadNumber && (c.leadNumber === selectedLead.lead_number || c.leadNumber === selectedLead.id)) || 
                (selectedLead.phone && c.phone === selectedLead.phone)
              )?.customerCode
            );

            if (isLeadConverted && selCustCode) {
              return (
                <button
                  onClick={() => {
                    setSelectedLeadIds([]);
                    if (typeof onNavigateTab === 'function') {
                      onNavigateTab('Customers', { searchCustomer: selCustCode, targetCustomer: selCustCode });
                    }
                    window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', {
                      detail: { tab: 'Customers', searchCustomer: selCustCode, targetCustomer: selCustCode }
                    }));
                  }}
                  style={{
                    backgroundColor: '#0E7490',
                    border: 'none',
                    color: '#FFFFFF',
                    borderRadius: '50px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxShadow: '0 1px 3px rgba(14,116,144,0.3)'
                  }}
                >
                  <UserCheck size={14} /> View Customer ({selCustCode}) ↗
                </button>
              );
            }

            return (
              <button
                onClick={() => {
                  if (selectedLeadIds.length > 1) {
                    alert('Please select one lead at a time to convert to a customer.');
                    return;
                  }
                  const lead = dbLeads.find(l => l.id === selectedLeadIds[0]);
                  setSelectedLeadIds([]);
                  if (lead) handleConvertToCustomer(lead);
                }}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  color: '#0E7490',
                  borderRadius: '50px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ECFEFF'; e.currentTarget.style.borderColor = '#0E7490'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
              >
                <UserPlus size={14} style={{ color: '#0E7490' }} /> Convert to Customer
              </button>
            );
          })()}

          {/* Reassign (CEO/TS/SH) */}
          {canAssign && (
            <button
              onClick={() => {
                const lead = dbLeads.find(l => l.id === selectedLeadIds[0]);
                setSelectedLeadIds([]);
                if (lead) {
                  setActiveLead(lead);
                  setShowAssignModal(true);
                }
              }}
              style={{
                backgroundColor: '#0E7490',
                border: 'none',
                color: '#FFFFFF',
                borderRadius: '50px',
                padding: '6px 16px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)'
              }}
            >
              <UserCheck size={14} style={{ color: '#FFFFFF' }} /> Assign / Reassign
            </button>
          )}

          {/* Export Selected to CSV (Hidden for CEO & Tech Support logins) */}
          {!isCeo && !isTechSupport && (
            <button
              onClick={() => {
                handleExportCsv();
                setSelectedLeadIds([]);
              }}
              style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#1E293B',
                borderRadius: '50px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <Download size={14} style={{ color: '#059669' }} /> Export Selected
            </button>
          )}

          {/* Close / Deselect */}
          <button
            onClick={() => setSelectedLeadIds([])}
            title="Deselect all"
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px 6px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              flexShrink: 0
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
        </>
      )}

      {/* CREATE LEAD MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                  {editingLead ? `Edit Lead: ${editingLead.lead_number || editingLead.company_name || 'Details'}` : 'Create New Lead'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                  {editingLead ? 'Update lead profile, customer contact details, and technical scope.' : 'Auto-sequenced sequence number with 2-hour inactivity SLA.'}
                </p>
              </div>
              <button onClick={() => { setShowCreateModal(false); setEditingLead(null); }} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                    Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Solar Energy Ltd (Optional)"
                    value={createForm.companyName}
                    onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Sharma (Optional)"
                    value={createForm.contactPerson}
                    onChange={(e) => setCreateForm({ ...createForm, contactPerson: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#0E7490', marginBottom: '5px' }}>
                    Phone Number * (Mandatory)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9840123456"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value, whatsapp: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #0E7490', fontSize: '13px', boxSizing: 'border-box', backgroundColor: '#F0FDFA' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. rajesh@apexsolar.com (Optional)"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                    Inbound Source
                  </label>
                  <select
                    value={createForm.source}
                    onChange={(e) => setCreateForm({ ...createForm, source: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF', boxSizing: 'border-box' }}
                  >
                    <option value="Direct Inbound">Direct Inbound</option>
                    <option value="IndiaMART Inbound">IndiaMART</option>
                    <option value="Website">Website</option>
                    <option value="WhatsApp Inbound">WhatsApp</option>
                    <option value="Direct Call">Direct Call</option>
                    <option value="Referral">Referral</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                    Project Location / City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chennai, Tamil Nadu"
                    value={createForm.location}
                    onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                    Structure Category
                  </label>
                  <select
                    value={createForm.category || ''}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF', boxSizing: 'border-box' }}
                  >
                    <option value="">Select Structure Category...</option>
                    {STRUCTURE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                    Estimated kW
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 50"
                    value={createForm.estimatedKw || ''}
                    onChange={(e) => setCreateForm({ ...createForm, estimatedKw: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Product Requirement / Technical Scope
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Need aluminium walk-way clamps and 50kW rail mounting system with SS fasteners."
                  value={createForm.productRequirement || ''}
                  onChange={(e) => setCreateForm({ ...createForm, productRequirement: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Status (Available during Edit) */}
              {editingLead && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                    Lead Status
                  </label>
                  <select
                    value={createForm.status || 'New'}
                    onChange={(e) => {
                      const sel = e.target.value;
                      if (!canTransitionStage(editingLead.status, sel)) {
                        alert(`Stages cannot be reversed. Lead stage can only progress forward from "${editingLead.status}".`);
                        return;
                      }
                      setCreateForm({ ...createForm, status: sel });
                    }}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF', boxSizing: 'border-box' }}
                  >
                    {LEAD_STAGES.map(s => {
                      const isPast = getStageRank(s) < getStageRank(editingLead.status);
                      return (
                        <option key={s} value={s} disabled={isPast}>
                          {s} {isPast ? '🔒 (Locked)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Assign Lead to Representative */}
              {canAssign ? (
                <div style={{ backgroundColor: '#F0FDFA', border: '1.5px solid #CCFBF1', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#0E7490' }}>
                      <UserCheck size={16} style={{ color: '#0E7490' }} />
                      Assign To (Sales Representative)
                    </label>
                    <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: 700, backgroundColor: '#CCFBF1', padding: '2px 8px', borderRadius: '4px' }}>
                      Optional
                    </span>
                  </div>
                  <select
                    value={createForm.assignedToId || ''}
                    onChange={(e) => {
                      const pool = (salesRepresentatives && salesRepresentatives.length > 0) ? salesRepresentatives : (salespersons || []);
                      const sel = pool.find(s => s.employee_code === e.target.value);
                      if (sel) {
                        setCreateForm({
                          ...createForm,
                          assignedToId: sel.employee_code,
                          assignedToName: sel.employee_name,
                          assignedToRole: sel.role || 'Sales Executive'
                        });
                      } else {
                        setCreateForm({
                          ...createForm,
                          assignedToId: '',
                          assignedToName: '',
                          assignedToRole: ''
                        });
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #99F6E4',
                      fontSize: '13px',
                      backgroundColor: '#FFFFFF',
                      boxSizing: 'border-box',
                      color: createForm.assignedToId ? '#0F172A' : '#64748B',
                      fontWeight: createForm.assignedToId ? 700 : 500
                    }}
                  >
                    <option value="">— Unassigned (Assign Later) —</option>
                    {((salesRepresentatives && salesRepresentatives.length > 0) ? salesRepresentatives : (salespersons || [])).map(s => (
                      <option key={s.employee_code} value={s.employee_code}>
                        {s.employee_name} ({s.employee_code} • {s.role || 'Sales Executive'})
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: '11px', color: '#475569', marginTop: '4px', display: 'block' }}>
                    Select a sales executive to assign immediately upon creation, or leave unassigned.
                  </span>
                </div>
              ) : editingLead ? (
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Assigned Representative</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', backgroundColor: '#F1F5F9', padding: '3px 8px', borderRadius: '6px' }}>
                    {createForm.assignedToName || 'Unassigned'}
                  </span>
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setEditingLead(null); }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1.5,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {editingLead ? 'Update Lead' : 'Create & Initialize SLA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN / REASSIGN LEAD MODAL (CEO & Tech Support) */}
      {showAssignModal && activeLead && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            padding: '26px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                  Assign Lead: {activeLead.lead_number}
                </h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  {activeLead.company_name} • Assigner: <strong>{loggedInUserName || userRole}</strong>
                </span>
              </div>
              <button onClick={() => setShowAssignModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignLead} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Select Sales Representative *
                </label>
                <select
                  required
                  value={assignForm.assignedToId}
                  onChange={(e) => {
                    const sel = salesRepresentatives.find(s => s.employee_code === e.target.value);
                    if (sel) {
                      setAssignForm({
                        ...assignForm,
                        assignedToId: sel.employee_code,
                        assignedToName: sel.employee_name,
                        assignedToRole: sel.role || 'Sales Executive'
                      });
                    } else {
                      setAssignForm({ ...assignForm, assignedToId: e.target.value, assignedToName: '' });
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    backgroundColor: '#FFFFFF',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="">-- Choose Sales Representative --</option>
                  {salesRepresentatives.map(s => (
                    <option key={s.employee_code} value={s.employee_code}>
                      {s.employee_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Assignment Reason / Instructions (Permanent Audit Trail) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={assignForm.reason}
                  onChange={(e) => setAssignForm({ ...assignForm, reason: e.target.value })}
                  placeholder="e.g. South region customer requested technical proposal within 24 hours."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                fontSize: '11px',
                color: '#64748B'
              }}>
                <strong>Permanent Audit Rule:</strong> Your name (<strong>{loggedInUserName || userRole}</strong>) will be recorded permanently in the lead's historical audit trail as the assigner.
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1.5,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTIVITY LOGGER MODAL (Enforces Qualifying Customer Activities) */}
      {showActivityModal && activeLead && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            padding: '26px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                  Log Customer Activity: {activeLead.company_name}
                </h3>
                <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                  {activeLead.lead_number} • Conductor: {loggedInUserName || userRole}
                </span>
              </div>
              <button onClick={() => setShowActivityModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordActivity} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                    Activity Type *
                  </label>
                  <select
                    value={activityForm.activityType}
                    onChange={(e) => setActivityForm({ ...activityForm, activityType: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF', boxSizing: 'border-box' }}
                  >
                    <option value="CALL">Phone Call</option>
                    <option value="WHATSAPP">WhatsApp Discussion</option>
                    <option value="EMAIL">Email Communication</option>
                    <option value="MEETING">Client Meeting / Site Visit</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                    Call Duration (Seconds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={activityForm.callDurationSeconds}
                    onChange={(e) => setActivityForm({ ...activityForm, callDurationSeconds: Number(e.target.value) })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Summary of Discussion *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Called client to verify technical rooftop specifications and pitch aluminium clamp structures."
                  value={activityForm.summary}
                  onChange={(e) => setActivityForm({ ...activityForm, summary: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Customer Response / Outcome
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Client requested a formal quotation by tomorrow 2 PM. Very interested."
                  value={activityForm.customerResponse}
                  onChange={(e) => setActivityForm({ ...activityForm, customerResponse: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#F0FDF4',
                border: '1px solid #BBF7D0',
                fontSize: '11px',
                color: '#15803D'
              }}>
                <strong>Qualifying Interaction:</strong> Submitting this customer activity will verify engagement and immediately clear any pending 2-hour unattended warnings.
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowActivityModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1.5,
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Record Activity & Satisfy SLA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LEAD PROFILE & DETAIL DRAWER */}
      {showDetailDrawer && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            width: '100%',
            maxWidth: '680px',
            height: '100%',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {/* Drawer Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #E2E8F0' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0E7490', backgroundColor: '#ECFEFF', padding: '2px 8px', borderRadius: '4px' }}>
                  {leadDetailData?.lead_number || activeLead?.lead_number}
                </span>
                <h2 style={{ margin: '6px 0 2px', fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>
                  {leadDetailData?.company_name || activeLead?.company_name}
                </h2>
                <span style={{ fontSize: '13px', color: '#64748B' }}>
                  Contact: <strong>{leadDetailData?.contact_person || activeLead?.contact_person}</strong> ({leadDetailData?.phone || activeLead?.phone})
                </span>
              </div>
              <button
                onClick={() => { setShowDetailDrawer(false); setLeadDetailData(null); }}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Quick Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Current Status</span>
                <strong style={{ fontSize: '14px', color: '#0F172A' }}>{leadDetailData?.status || activeLead?.status}</strong>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Assigned Rep</span>
                <strong style={{ fontSize: '13px', color: '#0F172A' }}>
                  {leadDetailData?.assigned_to_name ? `${leadDetailData.assigned_to_name} (${leadDetailData.assigned_to_user_id})` : 'Unassigned'}
                </strong>
              </div>
              <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>Assigned By</span>
                <strong style={{ fontSize: '13px', color: '#0E7490' }}>
                  {leadDetailData?.assigned_by_name ? `${leadDetailData.assigned_by_name} (${leadDetailData.assigned_by_role || ''})` : '—'}
                </strong>
              </div>
            </div>

            {/* Inactivity & SLA Status */}
            <div style={{
              padding: '14px 18px',
              borderRadius: '10px',
              backgroundColor: (leadDetailData?.is_unattended_2h || leadDetailData?.is_unattended_24h) ? '#FFF7ED' : '#F0FDF4',
              border: `1px solid ${(leadDetailData?.is_unattended_2h || leadDetailData?.is_unattended_24h) ? '#FED7AA' : '#BBF7D0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: (leadDetailData?.is_unattended_2h || leadDetailData?.is_unattended_24h) ? '#C2410C' : '#15803D' }}>
                  {leadDetailData?.is_unattended_48h ? '48-Hour Escalation Triggered' : (leadDetailData?.is_unattended_2h || leadDetailData?.is_unattended_24h) ? '2-Hour Inactivity Warning Active' : 'SLA Active & Compliant'}
                </span>
                <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '2px' }}>
                  Last Qualifying Activity: {leadDetailData?.last_qualifying_activity_at ? new Date(leadDetailData.last_qualifying_activity_at).toLocaleString() : 'No qualifying call/interaction yet'}
                </span>
              </div>
              <button
                onClick={() => {
                  setShowActivityModal(true);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Log Call Now
              </button>
            </div>

            {/* Permanent Assignment History Timeline */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <UserCheck size={16} color="#0E7490" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  Permanent Assignment Audit Trail
                </h4>
              </div>
              {(!leadDetailData?.assignmentHistory || leadDetailData.assignmentHistory.length === 0) ? (
                <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
                  No historical reassignments recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {leadDetailData.assignmentHistory.map((ah) => (
                    <div
                      key={ah.id}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, color: '#0F172A' }}>
                          Assigned To: {ah.assigned_to_name} ({ah.assigned_to_user_id})
                        </span>
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                          {new Date(ah.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px' }}>
                        Assigned By: <strong>{ah.assigned_by_name}</strong> ({ah.assigned_by_role})
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px', fontStyle: 'italic' }}>
                        Reason: "{ah.assignment_reason}"
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity Timeline */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <PhoneCall size={16} color="#059669" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  Qualifying Activity & Customer Call Log
                </h4>
              </div>
              {(!leadDetailData?.activities || leadDetailData.activities.length === 0) ? (
                <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
                  No calls or discussions logged yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {leadDetailData.activities.map((act) => (
                    <div
                      key={act.id}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontWeight: 700,
                          color: '#059669',
                          backgroundColor: '#ECFDF5',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px'
                        }}>
                          {act.activity_type} {act.call_duration_seconds > 0 ? `(${Math.floor(act.call_duration_seconds / 60)}m ${act.call_duration_seconds % 60}s)` : ''}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                          {new Date(act.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#1E293B', marginTop: '6px', fontWeight: 500 }}>
                        {act.summary}
                      </div>
                      {act.customer_response && (
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', backgroundColor: '#F8FAFC', padding: '6px 10px', borderRadius: '6px' }}>
                          💬 Customer Response: "{act.customer_response}"
                        </div>
                      )}
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '4px' }}>
                        Conducted By: {act.conducted_by_name} ({act.conducted_by_role})
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quotations Breakdown */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <FileCheck2 size={16} color="#7C3AED" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  Linked Quotations & Revisions ({leadDetailData?.quotations?.length || 0})
                </h4>
              </div>
              {(!leadDetailData?.quotations || leadDetailData.quotations.length === 0) ? (
                <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
                  No quotations created for this lead yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {leadDetailData.quotations.map((q) => (
                    <div
                      key={q.id}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '12px'
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, color: '#0E7490' }}>{q.quote_number}</span>
                        {q.revision_number > 0 && (
                          <span style={{ marginLeft: '6px', fontSize: '10px', backgroundColor: '#FAF5FF', color: '#9333EA', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                            Rev {q.revision_number}
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '2px' }}>
                          Grand Total: ₹{Number(q.grand_total || 0).toLocaleString()} • Status: <strong>{q.status}</strong>
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                        {new Date(q.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status Transition Audit Trail */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <RotateCcw size={16} color="#64748B" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  Status Transition Audit History
                </h4>
              </div>
              {(!leadDetailData?.statusHistory || leadDetailData.statusHistory.length === 0) ? (
                <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '8px', fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
                  Initial status only.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {leadDetailData.statusHistory.map((sh) => (
                    <div
                      key={sh.id}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '6px',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>
                        Changed from <strong>{sh.previous_status || 'Start'}</strong> → <strong>{sh.new_status}</strong> by {sh.updated_by_name}
                      </span>
                      <span style={{ color: '#94A3B8' }}>{new Date(sh.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
