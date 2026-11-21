import React, { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Users, Columns3, CalendarClock, Settings, Zap, UsersRound, BarChart3 } from 'lucide-react';
import './smartLeads.css';
import { slApi } from './smartLeadsApi';
import { useToast, EmptyState, SkeletonRows } from './SlShared';
import AllLeadsView from './AllLeadsView';
import LeadProfileView, { LeadProfileModal } from './LeadProfileView';
import LeadSettingsView from './LeadSettingsView';
import PipelineView from './PipelineView';
import FollowupsView from './FollowupsView';
import OverviewView from './OverviewView';
import TeamView from './TeamView';
import ReportsView from './ReportsView';
import AutomationView from './AutomationView';

const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'leads', label: 'All Leads', icon: Users },
  { key: 'pipeline', label: 'Pipeline', icon: Columns3 },
  { key: 'followups', label: 'Follow-ups', icon: CalendarClock },
  { key: 'automation', label: 'Automation', icon: Zap, adminOnly: true },
  { key: 'team', label: 'Sales Team', icon: UsersRound, adminOnly: true },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings, adminOnly: true }
];
const MOBILE_KEYS = ['overview', 'leads', 'pipeline', 'followups', 'settings'];

export default function SmartLeadsApp({ userRole: propUserRole }) {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');
  const [section, setSection] = useState('leads');
  const [openLeadId, setOpenLeadId] = useState(null);
  const [toast, toastNode] = useToast();

  const effectiveRole = String(propUserRole || meta?.me?.role || localStorage.getItem('vrm_user_role') || '').toLowerCase().trim();
  const isCeoOrTechSupport = /ceo|tech\s*support|technical\s*support|technical\s*admin|admin|super\s*admin|md|managing\s*director/i.test(effectiveRole);
  const isSales = /sales/i.test(effectiveRole) && !isCeoOrTechSupport;
  const canCreateLead = !isSales;

  // Visible sections: Automation, Sales Team, Settings are strictly visible to CEO and Tech Support only
  const availableSections = SECTIONS.filter(s => !s.adminOnly || isCeoOrTechSupport);

  // Redirect if currently on a restricted section
  useEffect(() => {
    if (!isCeoOrTechSupport && ['automation', 'team', 'settings'].includes(section)) {
      setSection('leads');
    }
  }, [isCeoOrTechSupport, section]);

  const loadMeta = useCallback(async () => {
    try { setMetaError(''); setMeta(await slApi.meta()); }
    catch (err) { setMetaError(err.status === 404 ? 'Smart Leads is not enabled on this server.' : err.message); }
  }, []);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  const go = (key) => { setSection(key); setOpenLeadId(null); };
  const closeLead = useCallback(() => setOpenLeadId(null), []);
  const current = availableSections.find(s => s.key === section) || availableSections[0] || SECTIONS[0];

  let body;
  if (metaError) body = <div className="sl-alert sl-alert-error">{metaError} <button className="sl-btn sl-btn-sm" onClick={loadMeta}>Retry</button></div>;
  else if (!meta) body = <div className="sl-card"><SkeletonRows rows={6} /></div>;
  else if (section === 'overview') body = <OverviewView meta={meta} onNavigate={go} onOpenLead={setOpenLeadId} toast={toast} />;
  else if (section === 'leads') body = <AllLeadsView meta={meta} onOpenLead={setOpenLeadId} toast={toast} canCreateLead={canCreateLead} />;
  else if (section === 'pipeline') body = <PipelineView meta={meta} onOpenLead={setOpenLeadId} toast={toast} />;
  else if (section === 'followups') body = <FollowupsView meta={meta} onOpenLead={setOpenLeadId} toast={toast} />;
  else if (section === 'team' && isCeoOrTechSupport) body = <TeamView meta={meta} onNavigate={go} onOpenLead={setOpenLeadId} toast={toast} />;
  else if (section === 'reports') body = <ReportsView meta={meta} onNavigate={go} toast={toast} />;
  else if (section === 'automation' && isCeoOrTechSupport) body = <AutomationView meta={meta} toast={toast} />;
  else if (section === 'settings' && isCeoOrTechSupport) body = <LeadSettingsView meta={meta} onMetaChange={loadMeta} toast={toast} />;
  else body = <div className="sl-card"><EmptyState title={`${current.label}`} text="Section under active development or restricted." /></div>;

  const visibleMobileKeys = MOBILE_KEYS.filter(k => k !== 'settings' || isCeoOrTechSupport);

  return (
    <div className="sl-root">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Smart Leads
          </h2>
          <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
            AI-powered lead intelligence, pipeline stages & automated customer conversion workflows
          </span>
        </div>
      </div>
      <nav className="sl-nav" aria-label="Smart Leads sections">
        {availableSections.map(s => <button key={s.key} className={section === s.key ? 'active' : ''} onClick={() => go(s.key)}>{s.label}</button>)}
      </nav>
      {body}
      {openLeadId && (
        <LeadProfileModal
          meta={meta}
          leadId={openLeadId}
          onClose={closeLead}
          toast={toast}
        />
      )}
      <nav className="sl-bottomnav" aria-label="Smart Leads sections">
        {availableSections.filter(s => visibleMobileKeys.includes(s.key)).map(s => {
          const Icon = s.icon;
          return <button key={s.key} className={section === s.key ? 'active' : ''} onClick={() => go(s.key)}><Icon size={20} />{s.label}</button>;
        })}
      </nav>
      {toastNode}
    </div>
  );
}
