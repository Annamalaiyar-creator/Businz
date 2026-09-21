import React, { useState } from 'react';
import {
  Briefcase, Plus, Search, Filter, ArrowRight, CheckCircle2, ChevronRight,
  DollarSign, Calculator, Layers, X, Clock, AlertCircle, Sparkles, User,
  Calendar, Phone, MessageSquare, Trash2
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
      salesPerson: currentUser, // user rule: without role suffixes
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
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
            cursor: 'pointer'
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
            placeholder="Search opportunities by title, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>Stage:</span>
          <select
            value={selectedStageFilter}
            onChange={(e) => setSelectedStageFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '12px',
              fontWeight: '600',
              backgroundColor: '#FFFFFF'
            }}
          >
            <option value="All">All Stages</option>
            {stagesList.map(st => (
              <option key={st} value={st}>{st} ({STAGE_PROBABILITIES[st]}%)</option>
            ))}
          </select>
        </div>
      </div>

      {/* Opportunities Table */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569' }}>Opp ID</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569' }}>Title & Scope</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569' }}>Customer</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569' }}>Deal Value (₹)</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569' }}>Stage & Win Prob</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569' }}>Salesperson</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpps.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: '#64748B' }}>
                    No opportunities match your filter.
                  </td>
                </tr>
              ) : (
                filteredOpps.map(opp => {
                  const prob = STAGE_PROBABILITIES[opp.stage] || 50;
                  return (
                    <tr key={opp.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0E7490' }}>
                        {opp.id}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '700', color: '#0F172A' }}>{opp.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>
                          {opp.capacityKw ? `${opp.capacityKw} kW • ` : ''}{opp.structureType}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: '600', color: '#334155' }}>
                        {opp.companyName}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: '800', color: '#0F172A' }}>
                        ₹ {Number(opp.dealValue || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <select
                            value={opp.stage}
                            onChange={(e) => handleStageChange(opp, e.target.value)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: '1px solid #CBD5E1',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: opp.stage === 'Won' ? '#15803D' : opp.stage === 'Lost' ? '#B91C1C' : '#0F172A',
                              backgroundColor: opp.stage === 'Won' ? '#DCFCE7' : opp.stage === 'Lost' ? '#FEE2E2' : '#FFFFFF',
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
                      <td style={{ padding: '14px 16px', color: '#334155', fontWeight: '600' }}>
                        {opp.assignedSalesperson}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {/* Convert to BOM */}
                          <button
                            onClick={() => handleConvertToBom(opp)}
                            title="Generate Engineering BOM Order"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #0E7490',
                              backgroundColor: '#0E7490',
                              color: '#FFFFFF',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Layers size={13} /> + Create BOM
                          </button>
                          {onDeleteOpportunity && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete opportunity "${opp.title}" (${opp.id})?`)) {
                                  onDeleteOpportunity(opp.id);
                                }
                              }}
                              title="Delete Opportunity"
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1px solid #FECACA',
                                backgroundColor: '#FEF2F2',
                                color: '#DC2626',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Trash2 size={13} />
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
      </div>

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
                  style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
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
