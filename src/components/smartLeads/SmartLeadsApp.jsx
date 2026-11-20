import React, { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Users, Columns3, CalendarClock, Settings, Zap, UsersRound, BarChart3, Sparkles } from 'lucide-react';
import './smartLeads.css';
import { slApi } from './smartLeadsApi';
import { useToast, EmptyState, SkeletonRows } from './SlShared';
import AllLeadsView from './AllLeadsView';
import LeadProfileView from './LeadProfileView';
import LeadSettingsView from './LeadSettingsView';
import PipelineView from './PipelineView';
import FollowupsView from './FollowupsView';
import OverviewView from './OverviewView';

const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'leads', label: 'All Leads', icon: Users },
  { key: 'pipeline', label: 'Pipeline', icon: Columns3 },
  { key: 'followups', label: 'Follow-ups', icon: CalendarClock },
  { key: 'automation', label: 'Automation', icon: Zap, phase: 3 },
  { key: 'team', label: 'Sales Team', icon: UsersRound, phase: 2 },
  { key: 'reports', label: 'Reports', icon: BarChart3, phase: 5 },
  { key: 'settings', label: 'Settings', icon: Settings }
];
const MOBILE_KEYS = ['overview', 'leads', 'pipeline', 'followups', 'settings'];

export default function SmartLeadsApp() {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');
  const [section, setSection] = useState('leads');
  const [openLeadId, setOpenLeadId] = useState(null);
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
  else if (section === 'settings') body = <LeadSettingsView meta={meta} onMetaChange={loadMeta} toast={toast} />;
  else body = <div className="sl-card"><EmptyState title={`${current.label} — coming in phase ${current.phase}`} text="This screen is part of the approved Smart Leads plan and will be built in its phase." /></div>;

  return (
    <div className="sl-root">
      <div className="sl-header">
        <div>
          <h1 className="sl-title">
            <Sparkles size={20} color="#0E7490" />
            Smart Leads
            <span className="sl-beta">Local Test</span>
          </h1>
          <p className="sl-subtitle">{meta?.me ? `${meta.me.name} (${meta.me.role}) · Sales Command Center` : 'Sales Command Center & Pipeline'}</p>
        </div>
      </div>
      <nav className="sl-nav" aria-label="Smart Leads sections">
        {SECTIONS.map(s => <button key={s.key} className={section === s.key && !openLeadId ? 'active' : ''} onClick={() => go(s.key)}>{s.label}</button>)}
      </nav>
      {body}
      <nav className="sl-bottomnav" aria-label="Smart Leads sections">
        {SECTIONS.filter(s => MOBILE_KEYS.includes(s.key)).map(s => {
          const Icon = s.icon;
          return <button key={s.key} className={section === s.key ? 'active' : ''} onClick={() => go(s.key)}><Icon size={20} />{s.label}</button>;
        })}
      </nav>
      {toastNode}
    </div>
  );
}
