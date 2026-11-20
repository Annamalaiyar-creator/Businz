import React, { useCallback, useEffect, useState } from 'react';
import { Columns3, List, RefreshCw, ChevronRight, User } from 'lucide-react';
import { slApi, onSmartLeadChange, formatINR, formatDate, isOverdue } from './smartLeadsApi';
import { StageBadge, TempBadge, SkeletonRows, EmptyState } from './SlShared';
import { StageModal } from './LeadActions';

export default function PipelineView({ meta, onOpenLead, toast }) {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'list'
  const [ownerFilter, setOwnerFilter] = useState('');
  const [stageModalLead, setStageModalLead] = useState(null);

  const isManager = !!meta?.me?.isManager;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await slApi.pipeline({ owner: ownerFilter || undefined, perStage: 30 });
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
    if (idx >= 0 && idx < stages.length - 2) { // Won is idx 5, Lost is idx 6
      const next = stages[idx + 1];
      setStageModalLead({ lead, initialStage: next });
    } else {
      setStageModalLead({ lead, initialStage: '' });
    }
  };

  return (
    <div>
      {/* Top Controls & View Mode Segment */}
      <div className="sl-toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="sl-seg" role="group" aria-label="Pipeline view mode">
            <button
              className={viewMode === 'kanban' ? 'active' : ''}
              onClick={() => setViewMode('kanban')}
              aria-label="Kanban board view"
            >
              <Columns3 size={13} /> Kanban
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <List size={13} /> List
            </button>
          </div>

          {isManager && (
            <select
              className="sl-select"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              aria-label="Filter by owner"
              style={{ width: 'auto', minWidth: 150 }}
            >
              <option value="">All Team Members</option>
              {(meta?.team || []).map(t => (
                <option key={t.user_id} value={t.user_id}>{t.name}</option>
              ))}
            </select>
          )}

          <button className="sl-btn" onClick={load} aria-label="Refresh pipeline">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Forecast disclaimer pill */}
        <div className="sl-faint" style={{ fontSize: 11 }}>
          Weighted Forecast = Stage Value × Probability. Probabilities are estimates.
        </div>
      </div>

      {/* KPI Cards Banner */}
      <div className="sl-kpis">
        <div className="sl-card sl-kpi">
          <div className="sl-kpi-label">Open Pipeline Value</div>
          <div className="sl-kpi-value">{formatINR(totalOpenValue)}</div>
          <div className="sl-kpi-hint">{totalOpenCount} open leads across 5 active stages</div>
        </div>
        <div className="sl-card sl-kpi">
          <div className="sl-kpi-label">Weighted Sales Forecast</div>
          <div className="sl-kpi-value" style={{ color: '#0E7490' }}>{formatINR(totalWeightedForecast)}</div>
          <div className="sl-kpi-hint">Stage-probability weighted pipeline</div>
        </div>
        <div className="sl-card sl-kpi">
          <div className="sl-kpi-label">Closed Won Orders</div>
          <div className="sl-kpi-value" style={{ color: '#047857' }}>{formatINR(wonValue)}</div>
          <div className="sl-kpi-hint">{wonCount} converted leads</div>
        </div>
      </div>

      {error && (
        <div className="sl-alert sl-alert-error">
          {error} <button className="sl-btn sl-btn-sm" style={{ marginLeft: 8 }} onClick={load}>Retry</button>
        </div>
      )}

      {loading && columns.length === 0 ? (
        <div className="sl-card"><SkeletonRows rows={6} /></div>
      ) : columns.length === 0 ? (
        <div className="sl-card"><EmptyState title="No pipeline data" text="No leads found for the selected filter." /></div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW */
        <div className="sl-board">
          {columns.map(col => (
            <div key={col.stage} className="sl-col">
              <div className="sl-col-head">
                <div className="sl-col-top">
                  <div className="sl-col-title">
                    <span>{col.stage}</span>
                    <span className="sl-badge" style={{ fontSize: 10, padding: '1px 6px' }}>
                      {col.count}
                    </span>
                  </div>
                  <span className="sl-faint" style={{ fontSize: 11, fontWeight: 600 }}>
                    {col.probability}%
                  </span>
                </div>
                <div className="sl-col-metrics">
                  <span>Total: <strong className="sl-col-val">{formatINR(col.value)}</strong></span>
                  {!['Won', 'Lost'].includes(col.stage) && (
                    <span className="sl-faint">Est: {formatINR(col.weightedValue)}</span>
                  )}
                </div>
              </div>

              <div className="sl-col-cards">
                {col.cards.length === 0 ? (
                  <div className="sl-faint" style={{ textAlign: 'center', padding: '24px 8px', fontSize: 12 }}>
                    No leads in this stage
                  </div>
                ) : (
                  col.cards.map(card => (
                    <div
                      key={card.id}
                      className="sl-card-kanban"
                      onClick={() => onOpenLead(card.id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="k-name">{card.company_name}</div>
                      <div className="k-meta">{card.lead_number} · {card.source || 'Manual'}</div>

                      {card.contact_person && (
                        <div className="k-contact">{card.contact_person}{card.phone ? ` · ${card.phone}` : ''}</div>
                      )}

                      <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <TempBadge temperature={card.temperature} score={card.score} />
                        {card.estimated_value ? (
                          <span className="sl-strong" style={{ fontSize: 12 }}>{formatINR(card.estimated_value)}</span>
                        ) : null}
                      </div>

                      {card.next_action_due_at && (
                        <div
                          className={`k-meta ${isOverdue(card.next_action_due_at) ? 'sl-overdue' : ''}`}
                          style={{ marginTop: 6 }}
                        >
                          Due: {formatDate(card.next_action_due_at, true)}
                        </div>
                      )}

                      <div className="k-foot">
                        <span className="sl-faint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <User size={11} /> {card.assigned_to_name ? card.assigned_to_name.split(' ')[0] : 'Unassigned'}
                        </span>
                        <button
                          className="k-action"
                          onClick={(e) => advanceStage(e, card, col.stage)}
                          title="Move or advance stage"
                        >
                          Move <ChevronRight size={10} style={{ verticalAlign: -1 }} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST / TABLE VIEW GROUPED BY STAGE */
        <div style={{ display: 'grid', gap: 16 }}>
          {columns.map(col => (
            <div key={col.stage} className="sl-card sl-table-wrap">
              <div style={{ padding: '12px 16px', background: '#FAFAFA', borderBottom: '1px solid var(--sl-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StageBadge stage={col.stage} />
                  <span className="sl-strong" style={{ fontSize: 13 }}>{col.count} Leads</span>
                  <span className="sl-faint">· Total: {formatINR(col.value)}</span>
                </div>
                <div className="sl-faint" style={{ fontSize: 12 }}>
                  Probability: <strong>{col.probability}%</strong> {!['Won', 'Lost'].includes(col.stage) && `(Weighted: ${formatINR(col.weightedValue)})`}
                </div>
              </div>

              {col.cards.length === 0 ? (
                <div className="sl-faint" style={{ padding: 16, textAlign: 'center', fontSize: 12 }}>No leads in this stage</div>
              ) : (
                <table className="sl-table">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Contact</th>
                      <th>Priority / Score</th>
                      <th>Owner</th>
                      <th>Next Action</th>
                      <th style={{ textAlign: 'right' }}>Est. Value</th>
                      <th style={{ width: 80, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {col.cards.map(l => (
                      <tr key={l.id} onClick={() => onOpenLead(l.id)}>
                        <td>
                          <div className="sl-strong">{l.company_name}</div>
                          <div className="sl-faint">{l.lead_number} · {l.source || '—'}</div>
                        </td>
                        <td>
                          <div>{l.contact_person || '—'}</div>
                          <div className="sl-faint">{l.phone || l.email || '—'}</div>
                        </td>
                        <td><TempBadge temperature={l.temperature} score={l.score} /></td>
                        <td>{l.assigned_to_name || <span className="sl-faint">Unassigned</span>}</td>
                        <td>
                          {l.next_action_due_at ? (
                            <span className={isOverdue(l.next_action_due_at) ? 'sl-overdue' : ''}>
                              {formatDate(l.next_action_due_at, true)}
                            </span>
                          ) : <span className="sl-faint">—</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {l.estimated_value ? formatINR(l.estimated_value) : <span className="sl-faint">—</span>}
                        </td>
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="sl-btn sl-btn-sm"
                            onClick={(e) => advanceStage(e, l, col.stage)}
                          >
                            Move
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
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
