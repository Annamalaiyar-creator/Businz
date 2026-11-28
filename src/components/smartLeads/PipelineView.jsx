import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronRight, User, TrendingUp, DollarSign, CheckCircle2,
  Search, X, RotateCcw, Filter, Clock
} from 'lucide-react';
import { slApi, onSmartLeadChange, formatINR, formatDate, isOverdue } from './smartLeadsApi';
import { TempBadge, SkeletonRows, EmptyState } from './SlShared';
import { StageModal } from './LeadActions';

export default function PipelineView({ meta, onOpenLead, toast }) {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [tempFilter, setTempFilter] = useState('');
  const [search, setSearch] = useState('');
  const [stageModalLead, setStageModalLead] = useState(null);
  const [draggingLead, setDraggingLead] = useState(null);
  const [dragOverStage, setDragOverStage] = useState('');

  const isManager = !!meta?.me?.isManager;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await slApi.pipeline({ owner: ownerFilter || undefined, perStage: 40 });
      setColumns(res.columns || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ownerFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime updates
  useEffect(() => onSmartLeadChange(() => {
    load();
  }), [load]);

  // Calculations for summary banner
  const openColumns = columns.filter(c => !['Won', 'Lost'].includes(c.stage));
  const totalOpenValue = openColumns.reduce((sum, c) => sum + (c.value || 0), 0);
  const totalWeightedForecast = openColumns.reduce((sum, c) => sum + (c.weightedValue || 0), 0);
  const totalOpenCount = openColumns.reduce((sum, c) => sum + (c.count || 0), 0);
  const wonCol = columns.find(c => c.stage === 'Won');
  const wonValue = wonCol?.value || 0;
  const wonCount = wonCol?.count || 0;

  const handleStageUpdated = (lead, msg) => {
    setStageModalLead(null);
    if (msg) toast(msg);
    load();
  };

  const advanceStage = (e, lead, currentStage) => {
    e.stopPropagation();
    const stages = meta?.stages || [];
    const idx = stages.indexOf(currentStage);
    if (idx >= 0 && idx < stages.length - 2) {
      const next = stages[idx + 1];
      setStageModalLead({ lead, initialStage: next });
    } else {
      setStageModalLead({ lead, initialStage: '' });
    }
  };

  const handleDropOnStage = async (e, targetStage) => {
    e.preventDefault();
    setDragOverStage('');
    let payload = draggingLead;
    try {
      const raw = e.dataTransfer?.getData('text/plain');
      if (raw) payload = JSON.parse(raw);
    } catch (_) {}
    setDraggingLead(null);

    if (!payload?.id || !targetStage || payload.fromStage === targetStage) return;

    const sourceCol = columns.find(c => c.stage === payload.fromStage);
    const draggedCard = sourceCol?.cards?.find(c => String(c.id) === String(payload.id));
    if (!draggedCard) return;

    if (targetStage === 'Lost') {
      setStageModalLead({ lead: draggedCard, initialStage: 'Lost' });
      return;
    }

    // Optimistic UI move
    setColumns(prev => prev.map(col => {
      if (col.stage === payload.fromStage) {
        const nextCards = (col.cards || []).filter(c => String(c.id) !== String(payload.id));
        const val = nextCards.reduce((s, c) => s + (c.estimated_value || 0), 0);
        return { ...col, cards: nextCards, count: nextCards.length, value: val };
      }
      if (col.stage === targetStage) {
        const nextCards = [{ ...draggedCard, pipeline_stage: targetStage }, ...(col.cards || [])];
        const val = nextCards.reduce((s, c) => s + (c.estimated_value || 0), 0);
        return { ...col, cards: nextCards, count: nextCards.length, value: val };
      }
      return col;
    }));

    try {
      await slApi.changeStage(payload.id, { stage: targetStage });
      toast(`Moved to ${targetStage}`);
      load();
    } catch (err) {
      load();
      if (err?.message) toast(err.message, 'error');
      setStageModalLead({ lead: draggedCard, initialStage: targetStage });
    }
  };

  // Filter cards per column based on search & temperature
  const filteredColumns = columns.map(col => {
    const matchingCards = (col.cards || []).filter(card => {
      if (tempFilter && card.temperature !== tempFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = (card.company_name || '').toLowerCase().includes(q);
        const matchesContact = (card.contact_person || '').toLowerCase().includes(q);
        const matchesPhone = (card.phone || '').includes(q);
        const matchesLeadNo = (card.lead_number || '').toLowerCase().includes(q);
        const matchesRep = (card.assigned_to_name || '').toLowerCase().includes(q);
        if (!matchesName && !matchesContact && !matchesPhone && !matchesLeadNo && !matchesRep) {
          return false;
        }
      }
      return true;
    });

    const filteredValue = matchingCards.reduce((s, c) => s + (c.estimated_value || 0), 0);

    return {
      ...col,
      cards: matchingCards,
      displayCount: matchingCards.length,
      displayValue: search.trim() || tempFilter ? filteredValue : col.value
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Integrated Search & Filter Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        background: '#fafbfc',
        border: '1px solid #E2E8F0',
        borderRadius: '12px',
        padding: '10px 16px',
        flexWrap: 'wrap'
      }}>
        {/* Left: Search Box */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid #cbd5e1',
          borderRadius: '8px',
          padding: '0 12px',
          height: '38px',
          backgroundColor: '#FFFFFF',
          flex: '1 1 260px',
          maxWidth: '420px'
        }}>
          <Search size={15} color="#94A3B8" style={{ flexShrink: 0 }} />
          <input
            id="smart-leads-pipeline-search"
            type="text"
            placeholder="Search deals (Company, Contact, Phone, Value)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#334155' }}
            aria-label="Search pipeline deals"
          />
          {search && (
            <X size={15} color="#94A3B8" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => setSearch('')} />
          )}
        </div>

        {/* Right: Priority, Owner & Reset */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0, marginLeft: 'auto' }}>
          {/* Priority Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#FFFFFF' }}>
            <Filter style={{ width: '14px', height: '14px', color: '#64748b', flexShrink: 0 }} />
            <select
              aria-label="Filter by priority"
              value={tempFilter}
              onChange={(e) => setTempFilter(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#334155', backgroundColor: 'transparent', cursor: 'pointer' }}
            >
              <option value="">All Priorities</option>
              <option value="Hot">Hot Deals</option>
              <option value="Warm">Warm Deals</option>
              <option value="Cold">Cold Deals</option>
            </select>
          </div>

          {/* Team Member Filter (for managers) */}
          {isManager && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#FFFFFF' }}>
              <User style={{ width: '14px', height: '14px', color: '#64748b', flexShrink: 0 }} />
              <select
                aria-label="Filter by sales rep"
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '13px', color: '#334155', backgroundColor: 'transparent', cursor: 'pointer' }}
              >
                <option value="">All Team Members</option>
                {(meta?.team || []).map(t => (
                  <option key={t.user_id} value={t.user_id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Reset button */}
          <button
            onClick={() => {
              setSearch('');
              setTempFilter('');
              setOwnerFilter('');
              load();
            }}
            title="Reset Filters"
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
              width: '38px',
              flexShrink: 0
            }}
          >
            <RotateCcw style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </div>

      {/* 2. Flat Summary Stats Cards (Clean, No Colored Borders) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px'
      }}>
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Open Pipeline Value
            </span>
            <TrendingUp size={16} color="#0E7490" />
          </div>
          <span style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
            {formatINR(totalOpenValue)}
          </span>
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            {totalOpenCount} Active Deals in Pipeline
          </span>
        </div>

        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Weighted Sales Forecast
            </span>
            <DollarSign size={16} color="#2563EB" />
          </div>
          <span style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
            {formatINR(totalWeightedForecast)}
          </span>
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            Probability adjusted forecast
          </span>
        </div>

        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Closed Won Revenue
            </span>
            <CheckCircle2 size={16} color="#059669" />
          </div>
          <span style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', lineHeight: 1.2 }}>
            {formatINR(wonValue)}
          </span>
          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
            {wonCount} Converted Orders
          </span>
        </div>
      </div>

      {error && (
        <div className="sl-alert sl-alert-error">
          {error} <button className="sl-btn sl-btn-sm" style={{ marginLeft: 8 }} onClick={load}>Retry</button>
        </div>
      )}

      {/* 3. Clean Kanban Board (No Colored Borders Anywhere) */}
      {loading && columns.length === 0 ? (
        <div className="sl-card"><SkeletonRows rows={6} /></div>
      ) : columns.length === 0 ? (
        <div className="sl-card"><EmptyState title="No pipeline data" text="No leads found for the selected filter." /></div>
      ) : (
        <div className="sl-board" style={{ gap: '14px', paddingBottom: '16px' }}>
          {filteredColumns.map(col => {
            const isWon = col.stage === 'Won';
            const isLost = col.stage === 'Lost';
            const isDropTarget = dragOverStage === col.stage && draggingLead?.fromStage !== col.stage;

            return (
              <div
                key={col.stage}
                className="sl-col"
                onDragOver={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                  if (dragOverStage !== col.stage) setDragOverStage(col.stage);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setDragOverStage(prev => (prev === col.stage ? '' : prev));
                  }
                }}
                onDrop={(e) => handleDropOnStage(e, col.stage)}
                style={{
                  flex: '0 0 290px',
                  background: isDropTarget ? '#ECFEFF' : '#F8FAFC',
                  border: isDropTarget ? '2px dashed #0E7490' : '1px solid #E2E8F0',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: 'calc(100vh - 220px)',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease'
                }}
              >
                {/* Column Head: Clean & Neutral, NO colored top border */}
                <div style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  borderRadius: '12px 12px 0 0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                        {col.stage}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: '10px',
                        backgroundColor: '#F1F5F9',
                        color: '#475569'
                      }}>
                        {col.displayCount}
                      </span>
                    </div>

                    {!isWon && !isLost && (
                      <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>
                        {col.probability}%
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px', fontSize: '11px', color: '#64748B' }}>
                    <span>Total Pipeline: <strong style={{ color: '#0F172A', fontWeight: 700 }}>{formatINR(col.displayValue)}</strong></span>
                  </div>
                </div>

                {/* Column Cards Container */}
                <div style={{ padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {col.cards.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 8px', color: '#94A3B8', fontSize: '12px' }}>
                      No leads in this stage
                    </div>
                  ) : (
                    col.cards.map(card => {
                      const overdueFlag = card.next_action_due_at && isOverdue(card.next_action_due_at);

                      return (
                        <div
                          key={card.id}
                          draggable
                          onDragStart={(e) => {
                            const payload = { id: card.id, fromStage: col.stage };
                            if (e.dataTransfer) {
                              e.dataTransfer.setData('text/plain', JSON.stringify(payload));
                              e.dataTransfer.effectAllowed = 'move';
                            }
                            setDraggingLead(payload);
                          }}
                          onDragEnd={() => {
                            setDraggingLead(null);
                            setDragOverStage('');
                          }}
                          onClick={() => onOpenLead(card.id)}
                          role="button"
                          tabIndex={0}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '10px',
                            padding: '12px',
                            cursor: 'grab',
                            opacity: draggingLead?.id === card.id ? 0.55 : 1,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#E2E8F0';
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)';
                          }}
                        >
                          {/* Company Name & Lead No */}
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
                              {card.company_name || 'Individual Lead'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ color: '#0E7490', fontWeight: 600 }}>{card.lead_number}</span>
                              {card.source && (
                                <>
                                  <span>•</span>
                                  <span>{card.source}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Contact Person */}
                          {card.contact_person && (
                            <div style={{ fontSize: '12px', color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <User size={12} color="#64748B" />
                              <span>{card.contact_person}</span>
                              {card.phone && (
                                <span style={{ color: '#94A3B8', fontSize: '11px' }}>({card.phone})</span>
                              )}
                            </div>
                          )}

                          {/* Priority Pill & Deal Value */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                            <TempBadge temperature={card.temperature} score={card.score} />
                            {card.estimated_value > 0 ? (
                              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                                {formatINR(card.estimated_value)}
                              </span>
                            ) : null}
                          </div>

                          {/* Due Date Indicator */}
                          {card.next_action_due_at && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: overdueFlag ? '#DC2626' : '#64748B',
                              backgroundColor: overdueFlag ? '#FEF2F2' : '#F8FAFC',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              marginTop: '2px'
                            }}>
                              <Clock size={11} color={overdueFlag ? '#DC2626' : '#64748B'} />
                              <span>Due: {formatDate(card.next_action_due_at, true)}</span>
                              {overdueFlag && (
                                <strong style={{ marginLeft: 'auto', fontSize: '10px' }}>OVERDUE</strong>
                              )}
                            </div>
                          )}

                          {/* Card Footer: Sales Rep + Move Button */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '6px',
                            paddingTop: '6px',
                            borderTop: '1px solid #F1F5F9'
                          }}>
                            {/* Assigned Rep Avatar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: '#E0F2FE',
                                color: '#0369A1',
                                fontSize: '10px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {(card.assigned_to_name || 'S').charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontSize: '11px', color: '#64748B' }}>
                                {card.assigned_to_name ? card.assigned_to_name.split(' ')[0] : 'Unassigned'}
                              </span>
                            </div>

                            {/* Move Stage Button */}
                            <button
                              onClick={(e) => advanceStage(e, card, col.stage)}
                              title="Advance deal to next stage"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: '#F1F5F9',
                                border: '1px solid #E2E8F0',
                                color: '#475569',
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.backgroundColor = '#0E7490';
                                e.currentTarget.style.color = '#FFFFFF';
                                e.currentTarget.style.borderColor = '#0E7490';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.backgroundColor = '#F1F5F9';
                                e.currentTarget.style.color = '#475569';
                                e.currentTarget.style.borderColor = '#E2E8F0';
                              }}
                            >
                              Move <ChevronRight size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stage Transition Modal */}
      {stageModalLead && (
        <StageModal
          meta={meta}
          lead={stageModalLead.lead}
          initialStage={stageModalLead.initialStage}
          onClose={() => setStageModalLead(null)}
          onDone={handleStageUpdated}
        />
      )}
    </div>
  );
}
