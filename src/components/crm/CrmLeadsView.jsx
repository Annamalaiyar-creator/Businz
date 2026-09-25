import React, { useState, useMemo } from 'react';
import {
  Search, Filter, Plus, Phone, MessageSquare, Calendar, ArrowRight,
  CheckCircle2, Clock, AlertCircle, Building2, User, Mail, ExternalLink,
  ChevronRight, RefreshCw, X, ShieldAlert, Sparkles, Tag, Eye, MoreHorizontal,
  FileText, Check, ChevronDown, Zap, Send, TrendingUp, Layers, Award,
  Trash2, UserCheck, RotateCcw, Download, Printer
} from 'lucide-react';

const STRUCTURE_CATEGORIES = [
  'Aluminium Mounting Structures',
  'Tin Shed Clamping Systems',
  'HDG Ground Mounting Structures',
  'Walkways & Safety Handrails',
  'Ballasted Rooftop Systems'
];

const SALES_REPRESENTATIVES = [
  'Mohith JV',
  'Vijay',
  'Gowtham',
  'Suresh Babu',
  'Sales Representative'
];

export default function CrmLeadsView({
  leads = [],
  customers = [],
  userRole = 'Sales Executive',
  onSaveLead,
  onConvertLead,
  onUpdateLeadStatus,
  onBatchUpdateLeads,
  onDeleteLeads,
  onNavigateTab,
  onOpenWhatsAppChat
}) {
  // Current Logged In User Identity
  const loggedInUserName = (localStorage.getItem('controlroom_logged_user_name') || '').trim();
  const loggedInEmail = (localStorage.getItem('controlroom_logged_user') || '').trim().toLowerCase();

  // Resolve effective salesperson name (e.g. "Mohith JV" or "Vijay")
  const effectiveSalesperson = (loggedInUserName || (userRole === 'Sales Head' ? 'Vijay' : 'Mohith JV')).replace(/\s*\([^)]*\)/g, '').trim();

  // Check if role has multi-rep visibility privileges
  const isManagerOrAdmin = ['ceo', 'md', 'managing director', 'admin', 'director', 'sales head'].some(r =>
    (userRole || '').toLowerCase().includes(r) || loggedInUserName.toLowerCase().includes(r)
  );

  // View scope: defaults to 'my' so user ONLY sees their assigned leads!
  const [viewScope, setViewScope] = useState('my'); // 'my' | 'all'

  // Match lead against logged in user
  const isLeadAssignedToMe = (lead) => {
    if (!lead || !lead.assignedSalesperson) return false;
    const rep = String(lead.assignedSalesperson).replace(/\s*\([^)]*\)/g, '').toLowerCase().trim();
    const me = effectiveSalesperson.toLowerCase().trim();
    if (rep === me) return true;
    if (rep.includes(me) || me.includes(rep)) return true;
    if (loggedInEmail && lead.assignedEmail && lead.assignedEmail.toLowerCase().trim() === loggedInEmail) return true;
    return false;
  };

  // Scoped leads: strictly user's assigned leads by default!
  const scopedLeads = useMemo(() => {
    if (viewScope === 'all' && isManagerOrAdmin) {
      return leads;
    }
    return leads.filter(isLeadAssignedToMe);
  }, [leads, viewScope, isManagerOrAdmin, effectiveSalesperson, loggedInEmail]);

  // Search & Filter States matching PI/BOM
  const [searchQuery, setSearchQuery] = useState('');
  const [leadTab, setLeadTab] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationToast, setSimulationToast] = useState(null);

  // Pagination State matching PI/BOM (Strictly [5, 10])
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [goToPageInput, setGoToPageInput] = useState('');

  // Bulk Reassign Modal State
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedRepToAssign, setSelectedRepToAssign] = useState(SALES_REPRESENTATIVES[0]);

  // Lead Create Modal State
  const [createMode, setCreateMode] = useState('ai'); // 'ai' | 'manual'
  const [aiPasteText, setAiPasteText] = useState('');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  const [newLeadForm, setNewLeadForm] = useState({
    companyName: '',
    contactPerson: '',
    designation: '',
    phone: '',
    whatsapp: '',
    email: '',
    location: '',
    source: 'WhatsApp Inbound',
    category: 'Aluminium Mounting Structures',
    estimatedKw: '',
    notes: '',
    assignedSalesperson: effectiveSalesperson
  });

  const [dupWarning, setDupWarning] = useState(null);
  const [newTimelineNote, setNewTimelineNote] = useState('');

  // Duplicate Check
  const handlePhoneOrEmailChange = (field, value) => {
    setNewLeadForm(prev => ({ ...prev, [field]: value }));
    const trimmed = String(value || '').trim().toLowerCase();
    if (!trimmed || trimmed.length < 5) {
      setDupWarning(null);
      return;
    }

    const dupLead = leads.find(l => 
      (field === 'phone' || field === 'whatsapp')
        ? (l.phone?.replace(/\D/g, '') === trimmed.replace(/\D/g, '') || l.whatsapp?.replace(/\D/g, '') === trimmed.replace(/\D/g, ''))
        : (l.email?.toLowerCase() === trimmed)
    );

    const dupCustomer = customers.find(c =>
      (field === 'phone' || field === 'whatsapp')
        ? (c.primaryContact?.phone?.replace(/\D/g, '') === trimmed.replace(/\D/g, '') || c.primaryContact?.whatsapp?.replace(/\D/g, '') === trimmed.replace(/\D/g, ''))
        : (c.primaryContact?.email?.toLowerCase() === trimmed)
    );

    if (dupLead) {
      setDupWarning(`Notice: A lead already exists: "${dupLead.companyName}" (${dupLead.leadNumber}) assigned to ${dupLead.assignedSalesperson}.`);
    } else if (dupCustomer) {
      setDupWarning(`Notice: This contact is already an existing Customer: "${dupCustomer.companyName}" (${dupCustomer.customerCode}).`);
    } else {
      setDupWarning(null);
    }
  };

  // AI Auto-Extraction
  const handleRunAiAnalysis = async () => {
    if (!aiPasteText.trim()) return;
    setIsAiAnalyzing(true);
    try {
      const res = await fetch('/api/crm/ai/analyze-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: aiPasteText })
      });
      const data = await res.json();
      if (data?.analysis) {
        setNewLeadForm(prev => ({
          ...prev,
          estimatedKw: data.analysis.estimatedKw || prev.estimatedKw || '',
          category: data.analysis.category || prev.category,
          companyName: data.analysis.companyName || prev.companyName || 'Solar Project Client',
          location: data.analysis.location || prev.location || '',
          phone: data.analysis.phone || prev.phone || '',
          whatsapp: data.analysis.phone || prev.whatsapp || '',
          notes: aiPasteText
        }));
      }
    } catch (e) {
      const clean = aiPasteText.toLowerCase();
      const kwMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:kw|k\.w|kilowatt|megawatt|mw)/i);
      const kw = kwMatch ? parseFloat(kwMatch[1]) : 100;
      let cat = 'Aluminium Mounting Structures';
      if (clean.includes('tin') || clean.includes('sheet') || clean.includes('shed')) cat = 'Tin Shed Clamping Systems';
      else if (clean.includes('ground') || clean.includes('hdg')) cat = 'HDG Ground Mounting Structures';

      setNewLeadForm(prev => ({
        ...prev,
        estimatedKw: kw,
        category: cat,
        notes: aiPasteText
      }));
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Inbound Simulator
  const handleSimulateInboundLead = async () => {
    setIsSimulating(true);
    try {
      const samples = [
        {
          companyName: 'Surya Kiran Solar EPC',
          contactPerson: 'Ramesh Kumar',
          phone: '+91 98401 55678',
          message: 'Need urgent proposal for 150 kW Aluminium Rooftop solar mounting structure for project in Hosur.',
          source: 'WhatsApp Inbound'
        },
        {
          companyName: 'SunPower Infrastructures Ltd',
          contactPerson: 'Anand Varma',
          phone: '+91 94432 11223',
          message: 'RFQ: 350 kW Ground Mount Fixed Tilt HDG structures required for solar park near Coimbatore.',
          source: 'IndiaMART Webhook'
        },
        {
          companyName: 'GreenWatt Engineering Pvt Ltd',
          contactPerson: 'Deepak Patel',
          phone: '+91 98220 88990',
          message: 'Inquiring for 80 kW Tin Shed Mini Rails with EPDM rubber and SS fasteners. Site in Sri City.',
          source: 'VRM Website Form'
        }
      ];

      const sample = samples[Math.floor(Math.random() * samples.length)];
      const res = await fetch('/api/crm/leads/simulate-inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sample,
          assignedSalesperson: effectiveSalesperson
        })
      });
      const data = await res.json();
      if (data?.lead && onSaveLead) {
        const leadWithRep = {
          ...data.lead,
          assignedSalesperson: effectiveSalesperson
        };
        onSaveLead(leadWithRep);
        setSimulationToast(`⚡ Inbound lead captured & pre-qualified for ${effectiveSalesperson}: "${leadWithRep.companyName}" (${leadWithRep.requirement})`);
        setTimeout(() => setSimulationToast(null), 5000);
      }
    } catch (e) {
      console.warn('Simulation notice:', e);
    } finally {
      setIsSimulating(false);
    }
  };

  // Stage sub-tabs counts matching PI & BOM sub-tabs
  const tabCounts = useMemo(() => {
    return {
      All: scopedLeads.length,
      'New Lead': scopedLeads.filter(l => l.status === 'New Lead').length,
      Contacted: scopedLeads.filter(l => l.status === 'Contacted').length,
      Qualified: scopedLeads.filter(l => l.status === 'Qualified').length,
      Converted: scopedLeads.filter(l => l.status === 'Converted').length,
      Disqualified: scopedLeads.filter(l => l.status === 'Disqualified').length
    };
  }, [scopedLeads]);

  // CSV Export matching PI & BOM
  const handleExportCsv = () => {
    const escapeCsv = (str) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };
    const headers = ['Lead Number', 'Company Name', 'Contact Person', 'Phone', 'Email', 'Location', 'Solar Scope', 'Estimated kW', 'Estimated Value (INR)', 'Source', 'Sales Rep', 'Status', 'Created Date'];
    const rows = filteredLeads.map(l => [
      l.leadNumber,
      l.companyName,
      l.contactPerson,
      l.phone,
      l.email || '',
      l.location || '',
      l.category || '',
      l.estimatedKw || '',
      (l.estimatedValue || ((parseFloat(l.estimatedKw) || 50) * 2800)).toFixed(2),
      l.source || '',
      l.assignedSalesperson || '',
      l.status || '',
      l.createdAt ? l.createdAt.split('T')[0] : ''
    ]);
    const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BUSINZ_Leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filtering Logic
  const filteredLeads = useMemo(() => {
    return scopedLeads.filter(lead => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        lead.companyName?.toLowerCase().includes(q) ||
        lead.contactPerson?.toLowerCase().includes(q) ||
        lead.leadNumber?.toLowerCase().includes(q) ||
        lead.phone?.includes(q) ||
        lead.email?.toLowerCase().includes(q) ||
        lead.location?.toLowerCase().includes(q);

      const matchTab = leadTab === 'All' || lead.status === leadTab;
      const matchSource = sourceFilter === 'All' || lead.source === sourceFilter;
      return matchSearch && matchTab && matchSource;
    });
  }, [scopedLeads, searchQuery, leadTab, sourceFilter]);

  // Pagination Slice
  const totalEntries = filteredLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const indexOfFirstRow = (safeCurrentPage - 1) * rowsPerPage;
  const indexOfLastRow = Math.min(indexOfFirstRow + rowsPerPage, totalEntries);
  const currentRows = filteredLeads.slice(indexOfFirstRow, indexOfLastRow);

  // Table Row Selection
  const handleSelectAll = (e, items) => {
    if (e.target.checked) {
      setSelectedLeads(items.map(l => l.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedLeads(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setLeadTab('All');
    setSourceFilter('All');
    setCurrentPage(1);
  };

  // Bulk Operations
  const handleBulkReassign = () => {
    if (onBatchUpdateLeads && selectedLeads.length > 0) {
      onBatchUpdateLeads(selectedLeads, { assignedSalesperson: selectedRepToAssign });
      setShowReassignModal(false);
      setSelectedLeads([]);
    }
  };

  const handleBulkMarkQualified = () => {
    if (onBatchUpdateLeads && selectedLeads.length > 0) {
      onBatchUpdateLeads(selectedLeads, { status: 'Qualified' });
      setSelectedLeads([]);
    }
  };

  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedLeads.length} lead(s)?`)) {
      if (onDeleteLeads) {
        onDeleteLeads(selectedLeads);
      }
      setSelectedLeads([]);
    }
  };

  // Handle Form Submission
  const handleCreateLeadSubmit = (e) => {
    e.preventDefault();
    if (!newLeadForm.companyName || !newLeadForm.contactPerson || !newLeadForm.phone) {
      alert('Please provide Company Name, Contact Person, and Phone Number.');
      return;
    }

    const nextNumber = `LEAD-${String(leads.length + 1).padStart(3, '0')}`;
    const kw = parseFloat(newLeadForm.estimatedKw) || 50;
    const isAutoQualified = kw >= 10;

    const newRecord = {
      id: `LEAD-2026-${String(Date.now()).slice(-4)}`,
      leadNumber: nextNumber,
      companyName: newLeadForm.companyName,
      contactPerson: newLeadForm.contactPerson,
      designation: newLeadForm.designation || 'Project Head',
      phone: newLeadForm.phone,
      whatsapp: newLeadForm.whatsapp || newLeadForm.phone,
      email: newLeadForm.email,
      location: newLeadForm.location || 'Tamil Nadu',
      source: newLeadForm.source,
      status: isAutoQualified ? 'Qualified' : 'New Lead',
      priority: kw >= 100 ? 'HIGH' : 'MEDIUM',
      assignedSalesperson: newLeadForm.assignedSalesperson,
      estimatedKw: kw,
      category: newLeadForm.category,
      estimatedValue: kw * 2800,
      notes: newLeadForm.notes,
      createdAt: new Date().toISOString(),
      timeline: [
        {
          id: `TL-${Date.now()}-1`,
          type: 'lead_created',
          title: 'Lead Created',
          description: `Created by ${newLeadForm.assignedSalesperson} via ${newLeadForm.source}`,
          timestamp: new Date().toISOString()
        },
        ...(isAutoQualified ? [{
          id: `TL-${Date.now()}-2`,
          type: 'auto_qualified',
          title: '⚡ Auto-Qualified by System',
          description: `Project size (${kw} kW) satisfies commercial criteria (>=10 kW).`,
          timestamp: new Date().toISOString()
        }] : [])
      ]
    };

    onSaveLead(newRecord);
    setShowCreateModal(false);
    setNewLeadForm({
      companyName: '',
      contactPerson: '',
      designation: '',
      phone: '',
      whatsapp: '',
      email: '',
      location: '',
      source: 'WhatsApp Inbound',
      category: 'Aluminium Mounting Structures',
      estimatedKw: '',
      notes: '',
      assignedSalesperson: effectiveSalesperson
    });
    setAiPasteText('');
    setDupWarning(null);
  };

  // Add Note in Drawer
  const handleAddTimelineNote = () => {
    if (!newTimelineNote.trim() || !selectedLead) return;
    const noteEntry = {
      id: `TL-${Date.now()}`,
      type: 'manual_note',
      title: 'Interaction Note',
      description: newTimelineNote.trim(),
      timestamp: new Date().toISOString()
    };
    const updated = {
      ...selectedLead,
      timeline: [noteEntry, ...(selectedLead.timeline || [])]
    };
    setSelectedLead(updated);
    onSaveLead(updated);
    setNewTimelineNote('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Toast Notification for Real-Time Automation */}
      {simulationToast && (
        <div style={{
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          padding: '12px 20px',
          borderRadius: '10px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          fontWeight: '600',
          borderLeft: '4px solid #10B981'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={18} color="#34D399" />
            <span>{simulationToast}</span>
          </div>
          <button
            onClick={() => setSimulationToast(null)}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 1. TOP TITLE AND CONTROLS BAR MATCHING PI & BOM DESIGN */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>
              Sales Leads Directory
            </h2>
            <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '12px', backgroundColor: '#ECFEFF', color: '#0E7490', border: '1px solid #CFFAFE' }}>
              👤 {effectiveSalesperson}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '3px 0 0 0' }}>
            {viewScope === 'my' ? `Showing leads assigned strictly to ${effectiveSalesperson}` : 'Showing all organizational solar project leads'}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Executive/Manager Toggle */}
          {isManagerOrAdmin && (
            <div style={{ display: 'flex', backgroundColor: '#F1F5F9', borderRadius: '8px', padding: '3px', border: '1px solid #E2E8F0', marginRight: '6px' }}>
              <button
                type="button"
                onClick={() => { setViewScope('my'); setCurrentPage(1); }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '700',
                  backgroundColor: viewScope === 'my' ? '#0E7490' : 'transparent',
                  color: viewScope === 'my' ? '#FFFFFF' : '#475569',
                  cursor: 'pointer'
                }}
              >
                My Leads ({leads.filter(isLeadAssignedToMe).length})
              </button>
              <button
                type="button"
                onClick={() => { setViewScope('all'); setCurrentPage(1); }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '700',
                  backgroundColor: viewScope === 'all' ? '#0E7490' : 'transparent',
                  color: viewScope === 'all' ? '#FFFFFF' : '#475569',
                  cursor: 'pointer'
                }}
              >
                All Leads ({leads.length})
              </button>
            </div>
          )}

          {/* Simulate Inbound Lead Button */}
          <button
            onClick={handleSimulateInboundLead}
            disabled={isSimulating}
            title="Simulate incoming WhatsApp/Web inquiry with AI auto-extraction"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#F0FDF4',
              color: '#15803D',
              border: '1px solid #BBF7D0',
              padding: '0 14px',
              height: '40px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: isSimulating ? 'not-allowed' : 'pointer'
            }}
          >
            <Zap size={14} color="#16A34A" />
            {isSimulating ? 'Capturing...' : 'Simulate Inbound Lead'}
          </button>

          {/* New Solar Lead Button - Matching Create PI pill with circular icon */}
          <button
            onClick={() => {
              setShowCreateModal(true);
              setCreateMode('ai');
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
              boxShadow: '0 2px 4px rgba(14, 116, 144, 0.2)',
              transition: 'all 0.2s ease-in-out',
              flexShrink: 0
            }}
          >
            <span>New Solar Lead</span>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              color: '#0E7490',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <ArrowRight style={{ width: '16px', height: '16px', color: '#0E7490' }} />
            </div>
          </button>
        </div>
      </div>

      {/* 2. FILTERS & SEARCH ROW CARD (EXACT MATCHING PI & BOM REFERENCE DESIGN) */}
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
        marginBottom: '16px'
      }}>
        {/* Search Input Box */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '0 12px',
          height: '38px',
          backgroundColor: '#f8fafc',
          flex: '1 1 240px',
          maxWidth: '380px',
          minWidth: '200px'
        }}>
          <Search style={{ width: '15px', height: '15px', color: '#64748b', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search Leads (Lead No, Company, Contact, Phone)..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', minWidth: 0, color: '#334155' }}
          />
          {searchQuery && (
            <X size={14} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
          )}
        </div>

        {/* Filter Controls on Right */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', cursor: 'pointer', backgroundColor: 'white', fontSize: '13px', color: '#475569' }}>
            <span>Date Range</span>
            <Calendar style={{ width: '14px', height: '14px', color: '#64748b' }} />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1); }}
            style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 24px 0 10px', fontSize: '13px', backgroundColor: 'white', color: '#334155', minWidth: '130px', outline: 'none' }}
          >
            <option value="All">Source: All</option>
            <option value="WhatsApp Inbound">WhatsApp Inbound</option>
            <option value="VRM Website Form">VRM Website</option>
            <option value="IndiaMART Webhook">IndiaMART</option>
            <option value="Referral">Referral</option>
            <option value="Renewable Expo">Renewable Expo</option>
          </select>

          <button
            onClick={() => {}}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 16px', height: '38px', cursor: 'pointer', backgroundColor: 'white', fontSize: '13px', fontWeight: '600', color: '#475569' }}
          >
            <Filter style={{ width: '14px', height: '14px', marginRight: '4px' }} />
            <span>Filters</span>
          </button>

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
              transition: 'all 0.15s ease'
            }}
          >
            <RotateCcw style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </div>

      {/* 3. STATUS SUB-TABS ROW & EXPORT BUTTON (EXACT WORK ORDERS / PI REFERENCE DESIGN) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '0',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          {[
            { id: 'All', label: 'All Leads', count: tabCounts.All },
            { id: 'New Lead', label: 'New Inquiries', count: tabCounts['New Lead'] },
            { id: 'Contacted', label: 'Contacted', count: tabCounts.Contacted },
            { id: 'Qualified', label: 'Qualified', count: tabCounts.Qualified },
            { id: 'Converted', label: 'Converted', count: tabCounts.Converted },
            { id: 'Disqualified', label: 'Disqualified', count: tabCounts.Disqualified }
          ].map(tab => {
            const isActive = leadTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setLeadTab(tab.id); setCurrentPage(1); }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '12px 0',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: isActive ? '#0E7490' : '#64748b',
                  borderBottom: isActive ? '2px solid #0E7490' : '2px solid transparent',
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
                  backgroundColor: tab.id === 'Converted' ? '#ecfdf5' : tab.id === 'Qualified' ? '#ccfbf1' : tab.id === 'New Lead' ? '#fef3c7' : tab.id === 'Disqualified' ? '#fef2f2' : '#f1f5f9',
                  color: tab.id === 'Converted' ? '#059669' : tab.id === 'Qualified' ? '#0f766e' : tab.id === 'New Lead' ? '#b45309' : tab.id === 'Disqualified' ? '#b91c1c' : '#475569',
                  fontWeight: 'bold'
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleExportCsv}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '6px 14px',
            backgroundColor: 'white',
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#475569',
            cursor: 'pointer',
            marginBottom: '8px',
            flexShrink: 0
          }}
        >
          <Download style={{ width: '14px', height: '14px' }} />
          Export
        </button>
      </div>

      {/* 4. MAIN DATA TABLE MATCHING EXACT REFERENCE DESIGN */}
      <div className="section-card" style={{ padding: 0, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="custom-table" style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                  <input
                    type="checkbox"
                    style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                    checked={filteredLeads.length > 0 && filteredLeads.every(l => selectedLeads.includes(l.id))}
                    onChange={(e) => handleSelectAll(e, filteredLeads)}
                  />
                </th>
                <th style={{ width: '140px', minWidth: '130px', padding: '12px 14px', boxSizing: 'border-box' }}>Lead No.</th>
                <th style={{ minWidth: '220px', padding: '12px 14px', boxSizing: 'border-box' }}>Company Name</th>
                <th style={{ width: '180px', minWidth: '160px', padding: '12px 14px', boxSizing: 'border-box' }}>Solar Scope & kW</th>
                <th style={{ width: '130px', minWidth: '120px', padding: '12px 14px', boxSizing: 'border-box' }}>Lead Date</th>
                <th style={{ width: '150px', minWidth: '130px', padding: '12px 14px', textAlign: 'right', boxSizing: 'border-box' }}>Estimated Value</th>
                <th style={{ width: '140px', minWidth: '130px', padding: '12px 14px', boxSizing: 'border-box' }}>Sales Rep</th>
                <th style={{ width: '140px', minWidth: '130px', padding: '12px 14px', textAlign: 'center', boxSizing: 'border-box' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <FileText size={32} style={{ color: '#CBD5E1' }} />
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>No leads found</span>
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>No records match your active filter or search query. Click "+ New Solar Lead" above to author a new project inquiry.</span>
                      {(searchQuery || leadTab !== 'All' || sourceFilter !== 'All') && (
                        <button
                          type="button"
                          onClick={clearFilters}
                          style={{
                            marginTop: '6px',
                            padding: '6px 14px',
                            backgroundColor: '#F1F5F9',
                            color: '#0E7490',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                currentRows.map((lead, idx) => {
                  const isChecked = selectedLeads.includes(lead.id);
                  const isConverted = lead.status === 'Converted';
                  const isQualified = lead.status === 'Qualified';
                  const isNew = lead.status === 'New Lead';

                  let statusBg = '#EFF6FF';
                  let statusFg = '#2563EB';
                  if (isConverted) {
                    statusBg = '#ECFDF5';
                    statusFg = '#059669';
                  } else if (isQualified) {
                    statusBg = '#CCFBF1';
                    statusFg = '#0F766E';
                  } else if (isNew) {
                    statusBg = '#FEF3C7';
                    statusFg = '#B45309';
                  } else if (lead.status === 'Disqualified') {
                    statusBg = '#FEF2F2';
                    statusFg = '#DC2626';
                  }

                  const estValue = lead.estimatedValue || ((parseFloat(lead.estimatedKw) || 50) * 2800);

                  return (
                    <tr
                      key={lead.id || idx}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'all 0.15s ease',
                        backgroundColor: isChecked ? '#ECFEFF' : 'transparent',
                        height: '52px'
                      }}
                      className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                    >
                      {/* Checkbox with VRM Left Border Accent */}
                      <td style={{
                        width: '48px',
                        minWidth: '48px',
                        padding: '12px 14px',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        boxSizing: 'border-box',
                        borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                      }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleSelectRow(lead.id)}
                          style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                        />
                      </td>

                      {/* Lead No. with Source Indicator */}
                      <td
                        onClick={() => setSelectedLead(lead)}
                        style={{ padding: '12px 14px', cursor: 'pointer' }}
                      >
                        <div style={{ fontWeight: 'bold', color: '#2563EB', fontSize: '13px' }}>
                          {lead.leadNumber}
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: '700', color: lead.source?.includes('WhatsApp') ? '#059669' : '#0284C7', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: lead.source?.includes('WhatsApp') ? '#059669' : '#0284C7', display: 'inline-block' }}></span>
                          {lead.source || 'Direct'}
                        </span>
                      </td>

                      {/* Company Name & Contact Details */}
                      <td
                        onClick={() => setSelectedLead(lead)}
                        style={{ padding: '12px 14px', cursor: 'pointer', fontWeight: '600', color: '#1E293B' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: '700', color: '#0F172A' }}>{lead.companyName}</span>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>Attn: {lead.contactPerson} • {lead.phone}</span>
                        </div>
                        {lead.location && (
                          <div style={{ marginTop: '3px' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '1px 7px', borderRadius: '50px', display: 'inline-block' }}>
                              📍 {lead.location}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Solar Scope & kW */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{lead.estimatedKw ? `${lead.estimatedKw} kW` : 'Custom Spec'}</span>
                          {lead.estimatedKw >= 100 && (
                            <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#B45309', fontWeight: '800' }}>
                              HIGH VAL
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          {lead.category || 'Aluminium Mounting Structures'}
                        </div>
                      </td>

                      {/* Lead Date */}
                      <td style={{ padding: '12px 14px', color: '#64748B' }}>
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>

                      {/* Estimated Value */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 'bold', color: '#0F172A' }}>
                        ₹ {estValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Sales Rep */}
                      <td style={{ padding: '12px 14px', color: '#334155', fontWeight: '600' }}>
                        {lead.assignedSalesperson || 'Unassigned'}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          backgroundColor: statusBg,
                          color: statusFg,
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusFg }}></span>
                          {lead.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* 5. PAGINATION FOOTER EXACT MATCHING PI & BOM STANDARD RULES */}
          {filteredLeads.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', fontSize: '13px', color: '#64748B', borderTop: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
              {/* Left Side: Rows per page selector + Showing X to Y of Z entries */}
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
                <span>Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredLeads.length)} of {filteredLeads.length} entries</span>
              </div>

              {/* Right Side: Page navigation controls adjacent to Go to page input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage(1)}
                    style={{ border: '1px solid #E2E8F0', background: safeCurrentPage === 1 ? '#F8FAFC' : 'white', cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
                  >
                    &laquo;
                  </button>
                  <button
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    style={{ border: '1px solid #E2E8F0', background: safeCurrentPage === 1 ? '#F8FAFC' : 'white', cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                  >
                    &lt;
                  </button>

                  {(() => {
                    let start = Math.max(1, safeCurrentPage - 1);
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
                          background: page === safeCurrentPage ? '#0E7490' : 'white',
                          color: page === safeCurrentPage ? 'white' : '#475569',
                          cursor: 'pointer',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontWeight: page === safeCurrentPage ? 'bold' : '500'
                        }}
                      >
                        {page}
                      </button>
                    ));
                  })()}

                  <button
                    disabled={safeCurrentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    style={{ border: '1px solid #E2E8F0', background: (safeCurrentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (safeCurrentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                  >
                    &gt;
                  </button>
                  <button
                    disabled={safeCurrentPage === totalPages || totalPages === 0}
                    onClick={() => setCurrentPage(totalPages)}
                    style={{ border: '1px solid #E2E8F0', background: (safeCurrentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (safeCurrentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
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
                    value={goToPageInput}
                    onChange={(e) => setGoToPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const p = parseInt(goToPageInput);
                        if (p >= 1 && p <= totalPages) {
                          setCurrentPage(p);
                          setGoToPageInput('');
                        }
                      }
                    }}
                    style={{ width: '42px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <button
                    onClick={() => {
                      const p = parseInt(goToPageInput);
                      if (p >= 1 && p <= totalPages) {
                        setCurrentPage(p);
                        setGoToPageInput('');
                      }
                    }}
                    style={{ height: '32px', padding: '0 10px', background: '#0E7490', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Go &rsaquo;
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. FLOATING BOTTOM ACTION BAR EXACT MATCHING PI & BOM RULES */}
      {selectedLeads.length > 0 && (
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
            <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedLeads.length}</strong> Selected
          </span>

          {/* View Details */}
          <button
            onClick={() => {
              if (selectedLeads.length > 1) {
                alert("You can't open details for multiple leads at once. Please select a single lead.");
                return;
              }
              const target = leads.find(l => l.id === selectedLeads[0]);
              if (target) setSelectedLead(target);
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
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
          >
            <Eye size={14} style={{ color: '#0E7490' }} /> View Details
          </button>

          {/* Convert to Opportunity */}
          {(() => {
            const targetLead = selectedLeads.length === 1 ? leads.find(l => l.id === selectedLeads[0]) : null;
            if (!targetLead || targetLead.status === 'Converted') return null;

            return (
              <button
                onClick={() => onConvertLead(targetLead)}
                style={{
                  backgroundColor: '#4F46E5',
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
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(79, 70, 229, 0.3)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4338CA'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4F46E5'}
              >
                <ArrowRight size={14} style={{ color: '#FFFFFF' }} /> Convert to Opportunity
              </button>
            );
          })()}

          {/* Assign Sales Rep */}
          <button
            onClick={() => setShowReassignModal(true)}
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
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
          >
            <UserCheck size={14} style={{ color: '#0E7490' }} /> Assign Sales Rep
          </button>

          {/* Mark Qualified */}
          <button
            onClick={handleBulkMarkQualified}
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
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
          >
            <CheckCircle2 size={14} style={{ color: '#059669' }} /> Mark Qualified
          </button>

          {/* Delete Leads */}
          <button
            onClick={handleBulkDelete}
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
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FEF2F2'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
          >
            <Trash2 size={14} style={{ color: '#DC2626' }} /> Delete
          </button>

          {/* Deselect All */}
          <button
            onClick={() => setSelectedLeads([])}
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
              marginLeft: '2px',
              flexShrink: 0
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Bulk Reassign Modal */}
      {showReassignModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10002,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '420px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            border: '1px solid #E2E8F0'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px' }}>
              Assign {selectedLeads.length} Selected Leads
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 16px' }}>
              Select a sales representative to take ownership of these leads.
            </p>

            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Sales Representative
            </label>
            <select
              value={selectedRepToAssign}
              onChange={(e) => setSelectedRepToAssign(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                fontWeight: '600',
                color: '#0F172A',
                marginBottom: '20px'
              }}
            >
              {SALES_REPRESENTATIVES.map(rep => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowReassignModal(false)}
                style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkReassign}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Lead Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)',
            border: '1px solid #E2E8F0'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 24px',
              borderBottom: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC'
            }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Create New Solar Project Lead
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#E0F2FE', color: '#0369A1' }}>
                    AI-Powered
                  </span>
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>
                  VRM Structures India Pvt Ltd • B2B Sales Management
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Mode Switch Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', padding: '0 24px' }}>
              <button
                type="button"
                onClick={() => setCreateMode('ai')}
                style={{
                  padding: '12px 18px',
                  border: 'none',
                  borderBottom: createMode === 'ai' ? '2px solid #0E7490' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  color: createMode === 'ai' ? '#0E7490' : '#64748B',
                  fontWeight: '700',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Sparkles size={16} /> AI Smart Paste (Instant)
              </button>
              <button
                type="button"
                onClick={() => setCreateMode('manual')}
                style={{
                  padding: '12px 18px',
                  border: 'none',
                  borderBottom: createMode === 'manual' ? '2px solid #0E7490' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  color: createMode === 'manual' ? '#0E7490' : '#64748B',
                  fontWeight: '700',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <FileText size={16} /> Standard Manual Form
              </button>
            </div>

            <form onSubmit={handleCreateLeadSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* AI Smart Paste Section */}
              {createMode === 'ai' && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#F0FDFA',
                  borderRadius: '10px',
                  border: '1px solid #CCFBF1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F766E', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={15} /> Paste Raw Customer Message (WhatsApp, Email, RFQ)
                  </div>
                  <textarea
                    rows={3}
                    placeholder="e.g. 'Hi VRM, I am Rajesh from Vikram Solar Chennai. We need quote for 250 kW Tin Shed Mini Rails. Call me on 9876543210.'"
                    value={aiPasteText}
                    onChange={(e) => setAiPasteText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>
                      AI automatically extracts Company, Contact, Phone, kW Capacity & Structure Type.
                    </span>
                    <button
                      type="button"
                      disabled={isAiAnalyzing || !aiPasteText.trim()}
                      onClick={handleRunAiAnalysis}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: '#0E7490',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: isAiAnalyzing || !aiPasteText.trim() ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Sparkles size={14} />
                      {isAiAnalyzing ? 'Extracting...' : 'Auto-Extract with AI'}
                    </button>
                  </div>
                </div>
              )}

              {/* Duplicate Warning Alert */}
              {dupWarning && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#FFFBEB',
                  borderRadius: '8px',
                  border: '1px solid #FDE68A',
                  color: '#B45309',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={18} />
                  <span>{dupWarning}</span>
                </div>
              )}

              {/* Form Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Company / EPC Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Solar Ltd"
                    value={newLeadForm.companyName}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, companyName: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Contact Person Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Kannan"
                    value={newLeadForm.contactPerson}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, contactPerson: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98765 43210"
                    value={newLeadForm.phone}
                    onChange={(e) => handlePhoneOrEmailChange('phone', e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    placeholder="Same as phone if blank"
                    value={newLeadForm.whatsapp}
                    onChange={(e) => handlePhoneOrEmailChange('whatsapp', e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="rajesh@company.com"
                    value={newLeadForm.email}
                    onChange={(e) => handlePhoneOrEmailChange('email', e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Lead Source
                  </label>
                  <select
                    value={newLeadForm.source}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="WhatsApp Inbound">WhatsApp Inbound</option>
                    <option value="VRM Website Form">VRM Website</option>
                    <option value="IndiaMART Webhook">IndiaMART</option>
                    <option value="Referral">Referral</option>
                    <option value="Renewable Expo">Renewable Expo</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Structure Category
                  </label>
                  <select
                    value={newLeadForm.category}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, category: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                  >
                    {STRUCTURE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Estimated kW Capacity
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={newLeadForm.estimatedKw}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, estimatedKw: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Project Site Location & Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Oragadam industrial rooftop, 140 km/h wind speed requirement, delivery before month end."
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', resize: 'vertical' }}
                />
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 22px', borderRadius: '8px', border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)' }}
                >
                  Save & Pre-Qualify Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide-Over Detail & Interaction Timeline Drawer */}
      {selectedLead && (
        <div style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          width: '560px',
          maxWidth: '100vw',
          backgroundColor: '#FFFFFF',
          boxShadow: '-10px 0 25px -5px rgba(0,0,0,0.15)',
          zIndex: 10001,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid #E2E8F0'
        }}>
          {/* Drawer Header */}
          <div style={{
            padding: '18px 20px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Lead Details • {selectedLead.leadNumber}
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: '2px 0 0' }}>
                {selectedLead.companyName}
              </h3>
            </div>
            <button
              onClick={() => setSelectedLead(null)}
              style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Drawer Content */}
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Visual 4-Step Stage Stepper */}
            <div style={{
              padding: '14px',
              backgroundColor: '#F8FAFC',
              borderRadius: '10px',
              border: '1px solid #E2E8F0'
            }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '10px' }}>
                Stage Progression Stepper
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {['New Lead', 'Contacted', 'Qualified', 'Converted'].map((st, i) => {
                  const stages = ['New Lead', 'Contacted', 'Qualified', 'Converted'];
                  const currentIndex = stages.indexOf(selectedLead.status);
                  const isDone = i <= currentIndex;
                  const isCurrent = selectedLead.status === st;

                  return (
                    <button
                      key={st}
                      onClick={() => {
                        if (st === 'Converted') {
                          setSelectedLead(null);
                          onConvertLead(selectedLead);
                        } else if (onUpdateLeadStatus) {
                          onUpdateLeadStatus(selectedLead.id, st, `Stage manually updated to "${st}"`);
                          setSelectedLead(prev => ({ ...prev, status: st }));
                        }
                      }}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '6px',
                        border: isCurrent ? '2px solid #0E7490' : (isDone ? '1px solid #CCFBF1' : '1px solid #CBD5E1'),
                        backgroundColor: isCurrent ? '#0E7490' : (isDone ? '#F0FDFA' : '#FFFFFF'),
                        color: isCurrent ? '#FFFFFF' : (isDone ? '#0F766E' : '#64748B'),
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contact Details Card */}
            <div style={{ padding: '14px', backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Primary Contact Information</span>
                <span style={{ color: '#0E7490', fontWeight: '700' }}>{selectedLead.assignedSalesperson}</span>
              </div>
              <div style={{ fontSize: '13px', color: '#0F172A', fontWeight: '700' }}>
                {selectedLead.contactPerson} ({selectedLead.designation || 'Project Head'})
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>📞 Phone: <strong style={{ color: '#0F172A' }}>{selectedLead.phone}</strong></div>
                <div>💬 WhatsApp: <strong style={{ color: '#0F172A' }}>{selectedLead.whatsapp || selectedLead.phone}</strong></div>
                <div>✉️ Email: <strong style={{ color: '#0F172A' }}>{selectedLead.email || 'Not specified'}</strong></div>
                <div>📍 Location: <strong style={{ color: '#0F172A' }}>{selectedLead.location || 'Tamil Nadu'}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <a
                  href={`tel:${selectedLead.phone}`}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    color: '#0284C7',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    textDecoration: 'none'
                  }}
                >
                  <Phone size={14} /> Call Phone
                </a>
                <button
                  onClick={() => onOpenWhatsAppChat ? onOpenWhatsAppChat(selectedLead) : onNavigateTab('WhatsApp Inbox')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid #BBF7D0',
                    backgroundColor: '#F0FDF4',
                    color: '#16A34A',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <MessageSquare size={14} /> Open WhatsApp
                </button>
              </div>
            </div>

            {/* Solar Scope & Deal Valuation Card */}
            <div style={{ padding: '14px', backgroundColor: '#F0FDFA', borderRadius: '10px', border: '1px solid #CCFBF1' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F766E', marginBottom: '6px' }}>
                Solar Engineering Scope & Valuation
              </div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                {selectedLead.estimatedKw ? `${selectedLead.estimatedKw} kW Capacity` : 'Custom Scope'}
              </div>
              <div style={{ fontSize: '12px', color: '#334155', marginTop: '3px' }}>
                Category: <strong>{selectedLead.category || 'Aluminium Mounting Structures'}</strong>
              </div>
              <div style={{ fontSize: '12px', color: '#0F766E', fontWeight: '700', marginTop: '4px' }}>
                Estimated Deal Value: ₹ {((parseFloat(selectedLead.estimatedKw) || 50) * 2800).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              {selectedLead.notes && (
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '8px', padding: '8px', backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  {selectedLead.notes}
                </div>
              )}
            </div>

            {/* Quick Convert Button */}
            {selectedLead.status !== 'Converted' && (
              <div style={{
                padding: '16px',
                backgroundColor: '#EFF6FF',
                borderRadius: '10px',
                border: '1px solid #DBEAFE',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#1E40AF' }}>
                  Ready to quote this solar structure?
                </div>
                <p style={{ fontSize: '12px', color: '#3B82F6', margin: 0 }}>
                  Convert this lead into an active Customer and commercial Opportunity to generate BOM calculations and Quotations.
                </p>
                <button
                  onClick={() => {
                    const l = selectedLead;
                    setSelectedLead(null);
                    onConvertLead(l);
                  }}
                  style={{
                    padding: '9px 14px',
                    backgroundColor: '#1D4ED8',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <ArrowRight size={14} /> Convert to Customer & Opportunity
                </button>
              </div>
            )}

            {/* Add Quick Note */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginBottom: '6px' }}>
                Add Interaction Note
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="e.g. Called client; sent catalog via WhatsApp..."
                  value={newTimelineNote}
                  onChange={(e) => setNewTimelineNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTimelineNote()}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12px'
                  }}
                />
                <button
                  onClick={handleAddTimelineNote}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Log
                </button>
              </div>
            </div>

            {/* Chronological Activity Timeline */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginBottom: '12px' }}>
                Chronological Activity Timeline
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '2px solid #E2E8F0', paddingLeft: '14px', marginLeft: '6px' }}>
                {(selectedLead.timeline || [
                  {
                    id: 'TL-1',
                    type: 'lead_created',
                    title: 'Inquiry Logged',
                    description: `Recorded via ${selectedLead.source}`,
                    timestamp: selectedLead.createdAt
                  }
                ]).map((item, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: '-21px',
                      top: '2px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: item.type?.includes('auto') ? '#10B981' : '#0E7490',
                      border: '2px solid #FFFFFF'
                    }} />
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      {item.description}
                    </div>
                    <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
