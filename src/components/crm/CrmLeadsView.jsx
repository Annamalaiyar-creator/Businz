import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Filter, Plus, Phone, MessageSquare, Calendar, ArrowRight,
  CheckCircle2, Clock, AlertCircle, Building2, User, Mail, ExternalLink,
  ChevronRight, RefreshCw, X, ShieldAlert, Sparkles, Tag, Eye, MoreHorizontal,
  FileText, Check, ChevronDown, Zap, Send, TrendingUp, Layers, Award,
  Trash2, UserCheck, RotateCcw, Download, Printer, MapPin, ChevronLeft,
  ChevronsLeft, ChevronsRight, AlertTriangle, Flame, PhoneCall, Users,
  FileCheck2, Compass, ShieldCheck, HelpCircle
} from 'lucide-react';

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
  onNavigateTab,
  onOpenWhatsAppChat
}) {
  // Current Logged In User Identity
  const loggedInEmpId = (localStorage.getItem('controlroom_logged_emp_id') || '').trim();
  const loggedInUserName = (localStorage.getItem('controlroom_logged_user_name') || '').trim();
  const loggedInEmail = (localStorage.getItem('controlroom_logged_user') || '').trim().toLowerCase();

  // Role Checks
  const isCeo = ['ceo', 'md', 'managing director'].some(r => (userRole || '').toLowerCase().includes(r));
  const isTechSupport = ['tech support', 'technical support'].some(r => (userRole || '').toLowerCase().includes(r));
  const isSalesHead = (userRole || '').toLowerCase().includes('sales head');
  const isTechAdmin = ['technical administrator', 'technical admin', 'developer'].some(r => (userRole || '').toLowerCase().includes(r));
  const isSalesExec = !isCeo && !isTechSupport && !isSalesHead && !isTechAdmin;

  // Global Visibility Privileges
  const hasGlobalView = isCeo || isTechSupport || isSalesHead || isTechAdmin;
  const canAssign = isCeo || isTechSupport || isSalesHead || isTechAdmin;

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
    productRequirement: '50kW Aluminium Rooftop Mounting Structures',
    category: 'Aluminium Mounting Structures',
    estimatedKw: '50',
    notes: '',
    priority: 'MEDIUM'
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
        'x-user-role': userRole,
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

  // Load Lead Detailed History for Drawer
  const openLeadDetail = async (lead) => {
    setActiveLead(lead);
    setShowDetailDrawer(true);
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
    const unattended24h = list.filter(l => l.is_unattended_24h).length;
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
      { label: '24h Inactive', val: unattended24h, color: '#EA580C', bg: '#FFF7ED', icon: Clock },
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
    const inactive24h = list.filter(l => l.is_unattended_24h && !l.is_unattended_48h).length;
    const escalated48h = list.filter(l => l.is_unattended_48h).length;
    const dropped = list.filter(l => ['Dropped', 'Lost', 'Disqualified'].includes(l.status)).length;

    return [
      { id: 'All', label: 'All Leads', count: total, bg: '#F1F5F9', color: '#475569' },
      { id: 'Unassigned', label: 'Unassigned', count: unassigned, bg: '#FEF3C7', color: '#B45309' },
      { id: 'Contacted', label: 'In Progress', count: inProgress, bg: '#E0F2FE', color: '#0369A1' },
      { id: 'Proposal Sent', label: 'Quotations Sent', count: proposals, bg: '#F3E8FF', color: '#7E22CE' },
      { id: 'Converted', label: 'Converted', count: converted, bg: '#DCFCE7', color: '#15803D' },
      { id: '24h Inactive', label: '24h Inactive', count: inactive24h, bg: '#FFF7ED', color: '#EA580C' },
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
      } else if (statusFilter === '24h Inactive') {
        matchStatus = lead.is_unattended_24h;
      } else if (statusFilter === '48h Escalated') {
        matchStatus = lead.is_unattended_48h;
      } else if (statusFilter === 'Dropped') {
        matchStatus = ['Dropped', 'Lost', 'Disqualified'].includes(lead.status);
      } else if (statusFilter !== 'All') {
        matchStatus = lead.status === statusFilter;
      }

      const matchSource = sourceFilter === 'All' || lead.source === sourceFilter;
      const matchAssigned = assignedFilter === 'All' || lead.assigned_to_user_id === assignedFilter;

      return matchSearch && matchStatus && matchSource && matchAssigned;
    });
  }, [dbLeads, searchQuery, statusFilter, sourceFilter, assignedFilter]);

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

  // Submit Lead Creation
  const handleCreateLead = async (e) => {
    e.preventDefault();
    if (!createForm.companyName || !createForm.contactPerson || !createForm.phone) {
      alert('Company Name, Contact Person, and Phone are mandatory.');
      return;
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        'x-user-role': userRole,
        'x-user-emp-id': loggedInEmpId,
        'x-user-name': loggedInUserName
      };

      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers,
        body: JSON.stringify(createForm)
      });
      const data = await res.json();
      if (data?.success) {
        showToast(`Lead ${data.lead.lead_number} created successfully!`);
        setShowCreateModal(false);
        setCreateForm({
          companyName: '',
          contactPerson: '',
          designation: '',
          phone: '',
          whatsapp: '',
          email: '',
          location: '',
          source: 'Direct Inbound',
          productRequirement: '50kW Aluminium Rooftop Mounting Structures',
          category: 'Aluminium Mounting Structures',
          estimatedKw: '50',
          notes: '',
          priority: 'MEDIUM'
        });
        await fetchLeads();
      } else {
        alert(data.error || 'Failed to create lead');
      }
    } catch (err) {
      alert(err.message);
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
        showToast(data.timerCleared ? 'Activity logged! 24h unattended timer cleared! ✅' : 'Activity logged successfully!');
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
      'Assigned To', 'Assigned By', 'Status', '24h Inactive', 'Created At'
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
      l.is_unattended_24h ? 'YES' : 'NO',
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
          <button
            onClick={() => setShowCreateModal(true)}
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
                <th style={{ padding: '12px 14px', width: '50px', minWidth: '50px', textAlign: 'center' }}>#</th>
                <th style={{ padding: '12px 14px', minWidth: '220px' }}>Lead # & Company</th>
                <th style={{ padding: '12px 14px', minWidth: '170px' }}>Primary Contact</th>
                <th style={{ padding: '12px 14px', minWidth: '180px' }}>Requirement</th>
                <th style={{ padding: '12px 14px', width: '130px', minWidth: '130px' }}>Source</th>
                <th style={{ padding: '12px 14px', width: '150px', minWidth: '150px' }}>Assigned To</th>
                <th style={{ padding: '12px 14px', width: '120px', minWidth: '120px', textAlign: 'center' }}>Quotations</th>
                <th style={{ padding: '12px 14px', width: '130px', minWidth: '130px', textAlign: 'center' }}>SLA Status</th>
                <th style={{ padding: '12px 14px', width: '130px', minWidth: '130px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px 0', color: '#64748B' }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                    Loading authoritative CRM leads from database...
                  </td>
                </tr>
              ) : currentRows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
                    No leads found matching your criteria.
                  </td>
                </tr>
              ) : (
                currentRows.map((lead, idx) => {
                  const isSelected = selectedLeadIds.includes(lead.id);

                  // Status Pill Styling
                  let statusBg = '#F1F5F9';
                  let statusColor = '#475569';
                  if (lead.status === 'New') { statusBg = '#FEF3C7'; statusColor = '#B45309'; }
                  else if (lead.status === 'Assigned') { statusBg = '#EFF6FF'; statusColor = '#1D4ED8'; }
                  else if (lead.status === 'Contacted' || lead.status === 'In Progress') { statusBg = '#E0F2FE'; statusColor = '#0369A1'; }
                  else if (lead.status === 'Proposal Sent') { statusBg = '#F3E8FF'; statusColor = '#7E22CE'; }
                  else if (lead.status === 'Converted') { statusBg = '#DCFCE7'; statusColor = '#15803D'; }
                  else if (['Dropped', 'Lost', 'Disqualified'].includes(lead.status)) { statusBg = '#FEE2E2'; statusColor = '#B91C1C'; }

                  // Source Badge Styling
                  const isIndiaMart = (lead.source || '').toLowerCase().includes('indiamart');
                  const sourceBg = isIndiaMart ? '#FFF7ED' : '#F1F5F9';
                  const sourceColor = isIndiaMart ? '#EA580C' : '#475569';

                  // SLA Badge
                  let slaBadge = (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#ECFDF5', color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={11} /> Active
                    </span>
                  );
                  if (lead.is_unattended_48h) {
                    slaBadge = (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#FEF2F2', color: '#DC2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertCircle size={12} /> 48h Escalated
                      </span>
                    );
                  } else if (lead.is_unattended_24h) {
                    slaBadge = (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#FFF7ED', color: '#EA580C', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} /> 24h Unattended
                      </span>
                    );
                  }

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
                        <div style={{ fontWeight: 700, color: '#0F172A', cursor: 'pointer' }}>
                          {lead.company_name || 'Independent Client'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                          <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: 700 }}>
                            {lead.lead_number}
                          </span>
                          {lead.created_at && (
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                              • {new Date(lead.created_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
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

                      {/* Quotations Metric */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '10px',
                            backgroundColor: (lead.quotations_count || 0) > 0 ? '#F3E8FF' : '#F1F5F9',
                            color: (lead.quotations_count || 0) > 0 ? '#7C3AED' : '#64748B'
                          }}>
                            {lead.quotations_count || 0}
                          </span>
                          {(lead.total_revisions || 0) > 0 && (
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: '#FAF5FF',
                              color: '#9333EA',
                              border: '1px solid #E9D5FF'
                            }}>
                              Rev {lead.total_revisions}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* SLA Timer */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {slaBadge}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: statusBg,
                          color: statusColor
                        }}>
                          {lead.status}
                        </span>
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

          {/* Reassign (CEO/TS/SH) */}
          {canAssign && (
            <button
              onClick={() => {
                const lead = dbLeads.find(l => l.id === selectedLeadIds[0]);
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

          {/* Export Selected to CSV */}
          <button
            onClick={handleExportCsv}
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
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>Create New Lead</h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                  Auto-sequenced sequence number with 24-hour inactivity SLA.
                </p>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                    Company / Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Solar Energy Ltd"
                    value={createForm.companyName}
                    onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Sharma"
                    value={createForm.contactPerson}
                    onChange={(e) => setCreateForm({ ...createForm, contactPerson: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 9840123456"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value, whatsapp: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. rajesh@apexsolar.com"
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
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF', boxSizing: 'border-box' }}
                  >
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
                    value={createForm.estimatedKw}
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
                  value={createForm.productRequirement}
                  onChange={(e) => setCreateForm({ ...createForm, productRequirement: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
                  Create & Initialize SLA
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
                ✅ <strong>Qualifying Interaction:</strong> Submitting this customer activity will verify engagement and immediately clear any pending 24-hour unattended warnings.
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
              backgroundColor: leadDetailData?.is_unattended_24h ? '#FFF7ED' : '#F0FDF4',
              border: `1px solid ${leadDetailData?.is_unattended_24h ? '#FED7AA' : '#BBF7D0'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: leadDetailData?.is_unattended_24h ? '#C2410C' : '#15803D' }}>
                  {leadDetailData?.is_unattended_48h ? '48-Hour Escalation Triggered' : leadDetailData?.is_unattended_24h ? '24-Hour Inactivity Warning Active' : 'SLA Active & Compliant'}
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
