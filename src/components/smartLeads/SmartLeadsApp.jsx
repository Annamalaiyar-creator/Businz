import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard, Users, Columns3, CalendarClock, Settings,
  Zap, UsersRound, BarChart3, Plus
} from 'lucide-react';
import './smartLeads.css';
import { slApi } from './smartLeadsApi';
import { useToast, EmptyState, SkeletonRows } from './SlShared';
import AllLeadsView from './AllLeadsView';
import LeadProfileView from './LeadProfileView';
import LeadSettingsView from './LeadSettingsView';
import PipelineView from './PipelineView';
import FollowupsView from './FollowupsView';
import OverviewView from './OverviewView';
import TeamView from './TeamView';
import ReportsView from './ReportsView';
import AutomationView from './AutomationView';
import LeadFormModal from './LeadFormModal';

const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'leads', label: 'All Leads', icon: Users },
  { key: 'pipeline', label: 'Pipeline', icon: Columns3 },
  { key: 'followups', label: 'Follow-ups', icon: CalendarClock },
  { key: 'automation', label: 'Automation', icon: Zap },
  { key: 'team', label: 'Sales Team', icon: UsersRound },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings }
];
const MOBILE_KEYS = ['overview', 'leads', 'pipeline', 'followups', 'settings'];

export default function SmartLeadsApp() {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');
  const [section, setSection] = useState('leads');
  const [openLeadId, setOpenLeadId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, toastNode] = useToast();

  const loadMeta = useCallback(async () => {
    try { setMetaError(''); setMeta(await slApi.meta()); }
    catch (err) { setMetaError(err.status === 404 ? 'Smart Leads is not enabled on this server.' : err.message); }
  }, []);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  const go = (key) => { setSection(key); setOpenLeadId(null); };
  const closeLead = useCallback(() => setOpenLeadId(null), []);
  const current = SECTIONS.find(s => s.key === section);

  let body;
  if (metaError) body = <div className="sl-alert sl-alert-error">{metaError} <button className="sl-btn sl-btn-sm" onClick={loadMeta}>Retry</button></div>;
  else if (!meta) body = <div className="sl-card"><SkeletonRows rows={6} /></div>;
  else if (openLeadId) body = <LeadProfileView meta={meta} leadId={openLeadId} onBack={closeLead} toast={toast} />;
  else if (section === 'overview') body = <OverviewView meta={meta} onNavigate={go} onOpenLead={setOpenLeadId} toast={toast} />;
  else if (section === 'leads') body = <AllLeadsView meta={meta} onOpenLead={setOpenLeadId} toast={toast} />;
  else if (section === 'pipeline') body = <PipelineView meta={meta} onOpenLead={setOpenLeadId} toast={toast} />;
  else if (section === 'followups') body = <FollowupsView meta={meta} onOpenLead={setOpenLeadId} toast={toast} />;
  else if (section === 'team') body = <TeamView meta={meta} onNavigate={go} onOpenLead={setOpenLeadId} toast={toast} />;
  else if (section === 'reports') body = <ReportsView meta={meta} onNavigate={go} toast={toast} />;
  else if (section === 'automation') body = <AutomationView meta={meta} toast={toast} />;
  else if (section === 'settings') body = <LeadSettingsView meta={meta} onMetaChange={loadMeta} toast={toast} />;
  else body = <div className="sl-card"><EmptyState title={`${current.label}`} text="Section under active development." /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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

      {/* 2. SECTION SUB-TABS ROW (STANDARD BUSINZ UNDERLINE TABS) */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #E2E8F0',
        gap: '24px',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: '0 4px',
        overflowX: 'auto',
        scrollbarWidth: 'none'
      }}>
        {SECTIONS.map(s => {
          const isActive = section === s.key && !openLeadId;
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => go(s.key)}
              style={{
                border: 'none',
                background: 'transparent',
                padding: '12px 2px',
                fontSize: '13px',
                fontWeight: '700',
                color: isActive ? '#0E7490' : '#64748B',
                borderBottom: isActive ? '2px solid #0E7490' : '2px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={15} color={isActive ? '#0E7490' : '#64748B'} />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. SECTION CONTENT */}
      {body}

      {/* Mobile Bottom Nav */}
      <nav className="sl-bottomnav" aria-label="Smart Leads sections">
        {SECTIONS.filter(s => MOBILE_KEYS.includes(s.key)).map(s => {
          const Icon = s.icon;
          return <button key={s.key} className={section === s.key ? 'active' : ''} onClick={() => go(s.key)}><Icon size={20} />{s.label}</button>;
        })}
      </nav>

      {/* Global Create Lead Modal */}
      {showCreateModal && (
        <LeadFormModal
          meta={meta}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => {
            setShowCreateModal(false);
            if (toast) toast('Lead created successfully!', 'success');
            // If on leads view, trigger reload
            go('leads');
          }}
        />
      )}

      {toastNode}
    </div>
  );
}
