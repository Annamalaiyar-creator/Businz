import React, { useState } from 'react';
import {
  Briefcase, Plus, Search, Filter, ArrowRight, CheckCircle2, ChevronRight,
  DollarSign, Calculator, Layers, X, Clock, AlertCircle, Sparkles, User,
  Calendar, Phone, MessageSquare, Trash2, Eye, Boxes, CheckCircle
} from 'lucide-react';
import { STAGE_PROBABILITIES } from '../../services/crmStore';

export default function CrmOpportunitiesView({
  opportunities = [],
  customers = [],
  onUpdateOpportunity,
  onCreateOpportunity,
  onDeleteOpportunity,
  onNavigateTab
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState(null);

  // Standard Table Selection & Pagination State (Matches BOM Orders)
  const [selectedRows, setSelectedRows] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [newOpp, setNewOpp] = useState({
    title: '',
    customerId: '',
    companyName: '',
    dealValue: '',
    capacityKw: '',
    structureType: 'Aluminium Rooftop Rails',
    stage: 'Requirement Received',
    assignedSalesperson: localStorage.getItem('controlroom_logged_user_name') || 'Sales Representative',
    targetCloseDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    notes: ''
  });

  const stagesList = Object.keys(STAGE_PROBABILITIES);

  const filteredOpps = opportunities.filter(o => {
    const q = searchTerm.toLowerCase();
    const matchSearch = !searchTerm ||
      o.title?.toLowerCase().includes(q) ||
      o.companyName?.toLowerCase().includes(q) ||
      o.id?.toLowerCase().includes(q);
    const matchStage = selectedStageFilter === 'All' || o.stage === selectedStageFilter;
    return matchSearch && matchStage;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredOpps.length / rowsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const indexOfLastRow = safeCurrentPage * rowsPerPage;
  const indexOfFirstRow = (safeCurrentPage - 1) * rowsPerPage;
  const currentRows = filteredOpps.slice(indexOfFirstRow, indexOfLastRow);

  const handleSelectRowGeneric = (id) => {
    setSelectedRows(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newOpp.title || !newOpp.companyName || !newOpp.dealValue) {
      alert('Please fill out Opportunity Title, Customer, and Deal Value.');
      return;
    }

    const nextId = `OPP-2026-${String(100 + opportunities.length + 1)}`;
    const oppRecord = {
      id: nextId,
      ...newOpp,
      dealValue: parseFloat(newOpp.dealValue),
      probability: STAGE_PROBABILITIES[newOpp.stage] || 50,
      createdAt: new Date().toISOString()
    };

    onCreateOpportunity(oppRecord);
    setShowCreateModal(false);
  };

  const handleStageChange = (opp, nextStage) => {
    const nextProb = STAGE_PROBABILITIES[nextStage] || 50;
    onUpdateOpportunity({
      ...opp,
      stage: nextStage,
      probability: nextProb
    });
  };

  // Convert Opportunity to BOM
  const handleConvertToBom = (opp) => {
    const currentUser = opp.assignedSalesperson || localStorage.getItem('controlroom_logged_user_name') || 'Sales Representative';
    // Package BOM data
    const bomPayload = {
      customerName: opp.companyName,
      capacityKw: opp.capacityKw || 100,
      structureType: opp.structureType || 'Aluminium Rooftop Rails',
      salesPerson: currentUser,
      dealValue: opp.dealValue,
      sourceOppId: opp.id
    };

    // Store in localStorage for BOM component to consume
    try {
      localStorage.setItem('controlroom_converting_bom', JSON.stringify(bomPayload));
    } catch (e) {}

    // Navigate to BOM Orders
    onNavigateTab('Sales BOM');
  };

  const getStageBadgeStyles = (stage) => {
    switch (stage) {
      case 'Won':
        return { bg: '#DCFCE7', fg: '#15803D', border: '1px solid #86EFAC' };
      case 'Lost':
        return { bg: '#FEE2E2', fg: '#B91C1C', border: '1px solid #FCA5A5' };
      case 'Proposal Submitted':
      case 'Price Negotiation':
        return { bg: '#FEF3C7', fg: '#B45309', border: '1px solid #FDE68A' };
      case 'Contract Review':
        return { bg: '#E0E7FF', fg: '#4338CA', border: '1px solid #C7D2FE' };
      case 'Site Survey Done':
      case 'Design Approved':
        return { bg: '#E0F2FE', fg: '#0369A1', border: '1px solid #BAE6FD' };
      default:
        return { bg: '#F1F5F9', fg: '#475569', border: '1px solid #CBD5E1' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', position: 'relative' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: '#0E7490',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Briefcase size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              Opportunity & Pipeline Management
            </h2>
            <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
              10-Stage solar project tracking with automated win probability & instant BOM conversion
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#0E7490',
            color: '#FFFFFF',
            border: 'none',
            padding: '9px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)'
          }}
        >
          <Plus size={16} /> New Opportunity
        </button>
      </div>

      {/* Filter Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: '12px 18px',
        borderRadius: '10px',
        border: '1px solid #E2E8F0'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #CBD5E1',
          padding: '6px 12px',
          borderRadius: '8px',
          flex: 1,
          minWidth: '240px'
        }}>
          <Search size={16} color="#64748B" />
          <input
            type="text"
            placeholder="Search opportunities by title, customer, or Opp ID..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>Stage:</span>
          <select
            value={selectedStageFilter}
            onChange={(e) => { setSelectedStageFilter(e.target.value); setCurrentPage(1); }}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '12px',
              fontWeight: '600',
              backgroundColor: '#FFFFFF',
              cursor: 'pointer'
            }}
          >
            <option value="All">All Stages</option>
            {stagesList.map(st => (
              <option key={st} value={st}>{st} ({STAGE_PROBABILITIES[st]}%)</option>
            ))}
          </select>
        </div>

        {(searchTerm || selectedStageFilter !== 'All') && (
          <button
            type="button"
            onClick={() => { setSearchTerm(''); setSelectedStageFilter('All'); setCurrentPage(1); }}
            style={{
              padding: '6px 12px',
              backgroundColor: '#F1F5F9',
              color: '#0E7490',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Opportunities Data Table (Exact BOM Orders Design System) */}
      <div className="section-card" style={{ padding: '0', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="custom-table" style={{ width: '100%', minWidth: '1100px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                  <input
                    type="checkbox"
                    style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                    checked={currentRows.length > 0 && currentRows.every(r => selectedRows.includes(r.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const newSelection = Array.from(new Set([...selectedRows, ...currentRows.map(r => r.id)]));
                        setSelectedRows(newSelection);
                      } else {
                        const pageIds = currentRows.map(r => r.id);
                        setSelectedRows(selectedRows.filter(id => !pageIds.includes(id)));
                      }
                    }}
                  />
                </th>
                <th style={{ width: '140px', minWidth: '140px', padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Opp ID</th>
                <th style={{ minWidth: '240px', padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Title & Scope</th>
                <th style={{ minWidth: '180px', padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Customer / Account</th>
                <th style={{ width: '150px', minWidth: '150px', padding: '12px 14px', fontWeight: 'bold', textAlign: 'right', whiteSpace: 'nowrap' }}>Deal Value (₹)</th>
                <th style={{ width: '220px', minWidth: '220px', padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Stage & Win Prob</th>
                <th style={{ width: '160px', minWidth: '160px', padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>Salesperson</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpps.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748B' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Boxes size={32} style={{ color: '#CBD5E1' }} />
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>No opportunities found</span>
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                        No records match your active search or stage filter. Try adjusting your query or clear filters.
                      </span>
                      {(searchTerm || selectedStageFilter !== 'All') && (
                        <button
                          type="button"
                          onClick={() => { setSearchTerm(''); setSelectedStageFilter('All'); setCurrentPage(1); }}
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
                currentRows.map((opp) => {
                  const isChecked = selectedRows.includes(opp.id);
                  const prob = STAGE_PROBABILITIES[opp.stage] || 50;
                  const stageStyle = getStageBadgeStyles(opp.stage);

                  return (
                    <tr
                      key={opp.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'all 0.15s ease',
                        backgroundColor: isChecked ? '#ECFEFF' : 'transparent'
                      }}
                      className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                    >
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
                          onChange={() => handleSelectRowGeneric(opp.id)}
                        />
                      </td>

                      <td
                        onClick={() => setSelectedOpp(opp)}
                        style={{ padding: '12px 14px', fontWeight: 'bold', color: '#2563EB', cursor: 'pointer' }}
                        title="Click to view Opportunity Details"
                      >
                        {opp.id}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '700', color: '#0F172A' }}>{opp.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                          {opp.capacityKw ? `${opp.capacityKw} kW • ` : ''}{opp.structureType}
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', fontWeight: '600', color: '#334155' }}>
                        {opp.companyName}
                      </td>

                      <td style={{ padding: '12px 14px', fontWeight: '800', color: '#0F172A', textAlign: 'right' }}>
                        ₹ {Number(opp.dealValue || 0).toLocaleString()}
                      </td>

                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <select
                            value={opp.stage}
                            onChange={(e) => handleStageChange(opp, e.target.value)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: stageStyle.border,
                              fontSize: '12px',
                              fontWeight: '700',
                              color: stageStyle.fg,
                              backgroundColor: stageStyle.bg,
                              cursor: 'pointer'
                            }}
                          >
                            {stagesList.map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490' }}>
                            {prob}%
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: '12px 14px', color: '#334155', fontWeight: '600' }}>
                        {opp.assignedSalesperson}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER - STRICT MANDATE & RULES MATCH */}
        {filteredOpps.length > 0 && (
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
              <span>Showing {filteredOpps.length === 0 ? 0 : indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredOpps.length)} of {filteredOpps.length} entries</span>
            </div>

            {/* Right Side: Page navigation controls */}
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
                  defaultValue={safeCurrentPage}
                  id="crm-opps-goto-page-input"
                  style={{ width: '42px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}
                />
                <button
                  onClick={() => {
                    const val = parseInt(document.getElementById('crm-opps-goto-page-input')?.value || '1', 10);
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

      {/* FLOATING ACTION BAR FOR SELECTED ROWS (MATCHES BOM ORDERS RULE) */}
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
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px', paddingRight: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
            <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedRows.length}</strong> Selected
          </span>

          {/* Convert to BOM */}
          <button
            onClick={() => {
              const targetId = selectedRows[0];
              const targetOpp = opportunities.find(o => o.id === targetId);
              if (targetOpp) {
                handleConvertToBom(targetOpp);
              }
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
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)'
            }}
          >
            <Layers size={14} style={{ color: '#FFFFFF' }} /> + Create BOM
          </button>

          {/* View Details */}
          <button
            onClick={() => {
              const targetId = selectedRows[0];
              const targetOpp = opportunities.find(o => o.id === targetId);
              if (targetOpp) {
                setSelectedOpp(targetOpp);
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
              flexShrink: 0,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <Eye size={14} style={{ color: '#0E7490' }} /> View Details
          </button>

          {/* Delete Action if available */}
          {onDeleteOpportunity && (
            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete ${selectedRows.length} selected opportunity(ies)?`)) {
                  selectedRows.forEach(id => onDeleteOpportunity(id));
                  setSelectedRows([]);
                }
              }}
              style={{
                backgroundColor: '#FEF2F2',
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
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxShadow: '0 1px 2px rgba(220, 38, 38, 0.1)'
              }}
            >
              <Trash2 size={14} style={{ color: '#DC2626' }} /> Delete
            </button>
          )}

          {/* Deselect / Dismiss */}
          <button
            onClick={() => setSelectedRows([])}
            title="Clear Selection"
            style={{
              background: 'none',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              padding: '4px 8px',
              fontSize: '14px',
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Details Modal */}
      {selectedOpp && (
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
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0E7490' }}>
                    {selectedOpp.id}
                  </span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    backgroundColor: getStageBadgeStyles(selectedOpp.stage).bg,
                    color: getStageBadgeStyles(selectedOpp.stage).fg,
                    border: getStageBadgeStyles(selectedOpp.stage).border
                  }}>
                    {selectedOpp.stage} ({STAGE_PROBABILITIES[selectedOpp.stage] || 50}%)
                  </span>
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: '4px 0 0 0' }}>
                  {selectedOpp.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOpp(null)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Customer Account</span>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', marginTop: '4px' }}>
                    {selectedOpp.companyName}
                  </div>
                </div>

                <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Deal Value</span>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#0E7490', marginTop: '4px' }}>
                    ₹ {Number(selectedOpp.dealValue || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Capacity & Scope</span>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginTop: '2px' }}>
                    {selectedOpp.capacityKw ? `${selectedOpp.capacityKw} kW` : 'Not specified'} • {selectedOpp.structureType}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Target Close Date</span>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginTop: '2px' }}>
                    {selectedOpp.targetCloseDate || 'Not specified'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Assigned Salesperson</span>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginTop: '2px' }}>
                    {selectedOpp.assignedSalesperson || 'Unassigned'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Created Timestamp</span>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginTop: '2px' }}>
                    {selectedOpp.createdAt ? new Date(selectedOpp.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>

              {selectedOpp.notes && (
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Commercial Notes</span>
                  <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px', backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                    {selectedOpp.notes}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedOpp(null)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const oppToConvert = selectedOpp;
                    setSelectedOpp(null);
                    handleConvertToBom(oppToConvert);
                  }}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Layers size={14} /> + Create BOM
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
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
            maxWidth: '650px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            border: '1px solid #E2E8F0'
          }}>
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Create New Commercial Opportunity
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                  VRM Structures India Pvt Ltd • B2B Sales Pipeline
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Opportunity Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500 kW Aluminium Rooftop Structure"
                  value={newOpp.title}
                  onChange={(e) => setNewOpp({ ...newOpp, title: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Customer / EPC Account *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Company Name"
                    value={newOpp.companyName}
                    onChange={(e) => setNewOpp({ ...newOpp, companyName: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Commercial Deal Value (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 1500000"
                    value={newOpp.dealValue}
                    onChange={(e) => setNewOpp({ ...newOpp, dealValue: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Structure Type
                  </label>
                  <select
                    value={newOpp.structureType}
                    onChange={(e) => setNewOpp({ ...newOpp, structureType: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                  >
                    <option value="Aluminium Rooftop Rails">Aluminium Rooftop Rails</option>
                    <option value="Tin Shed Clamping Systems">Tin Shed Mini Rails</option>
                    <option value="HDG Ground Mounting Structures">HDG Ground Purlins / Struts</option>
                    <option value="Walkways & Safety Handrails">Walkways & Handrails</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Capacity (kW)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 500"
                    value={newOpp.capacityKw}
                    onChange={(e) => setNewOpp({ ...newOpp, capacityKw: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Starting Stage
                  </label>
                  <select
                    value={newOpp.stage}
                    onChange={(e) => setNewOpp({ ...newOpp, stage: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', backgroundColor: '#FFFFFF' }}
                  >
                    {stagesList.map(st => (
                      <option key={st} value={st}>{st} ({STAGE_PROBABILITIES[st]}%)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Target Close Date
                  </label>
                  <input
                    type="date"
                    value={newOpp.targetCloseDate}
                    onChange={(e) => setNewOpp({ ...newOpp, targetCloseDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)' }}
                >
                  Save Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
