import React, { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Users, Columns3, CalendarClock, Zap, UsersRound, BarChart3 } from 'lucide-react';
import './smartLeads.css';
import { slApi } from './smartLeadsApi';
import { useToast, EmptyState, SkeletonRows } from './SlShared';
import AllLeadsView from './AllLeadsView';
import LeadProfileView, { LeadProfileModal } from './LeadProfileView';
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
  { key: 'reports', label: 'Reports', icon: BarChart3 }
];
const MOBILE_KEYS = ['overview', 'leads', 'pipeline', 'followups'];

export default function SmartLeadsApp({ userRole: propUserRole, onNavigateTab }) {
  const [meta, setMeta] = useState(null);
  const [metaError, setMetaError] = useState('');
  const [section, setSection] = useState('leads');
  const [openLeadId, setOpenLeadId] = useState(null);
  const [toast, toastNode] = useToast();

  const effectiveRole = String(propUserRole || meta?.me?.role || localStorage.getItem('vrm_user_role') || '').toLowerCase().trim();
  const isTechAdmin = /technical\s*admin|developer|^ta-/i.test(effectiveRole);
  const isCeoOrTechSupport = /ceo|tech\s*support|technical\s*support|admin|super\s*admin|md|managing\s*director/i.test(effectiveRole) && !isTechAdmin;
  const isSales = /sales/i.test(effectiveRole) && !isCeoOrTechSupport;
  const canCreateLead = !isSales;

  // Visible sections: Automation, Sales Team are strictly visible to CEO and Tech Support only
  const availableSections = SECTIONS.filter(s => !s.adminOnly || isCeoOrTechSupport);

  // Redirect if currently on a restricted section
  useEffect(() => {
    if (!isCeoOrTechSupport && ['automation', 'team'].includes(section)) {
      setSection('leads');
    }
  }, [isCeoOrTechSupport, section]);

  const loadMeta = useCallback(async () => {
    try { setMetaError(''); setMeta(await slApi.meta()); }
    catch (err) { setMetaError(err.status === 404 ? 'Smart Leads is not enabled on this server.' : err.message); }
  }, []);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  if (isTechAdmin) {
    return (
      <div className="sl-card" style={{ padding: '36px 24px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', marginBottom: '8px' }}>Technical Administrator Workspace</h3>
        <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6' }}>
          Smart Leads CRM is designated for Sales, Commercial, and Technical Support teams. System administration, database health, access control, and audit logs are available in the Admin Dashboard.
        </p>
      </div>
    );
  }

  const go = (key) => { setSection(key); setOpenLeadId(null); };
  const closeLead = useCallback(() => setOpenLeadId(null), []);
  const current = availableSections.find(s => s.key === section) || availableSections[0] || SECTIONS[0];

  let body;
  if (metaError) body = <div className="sl-alert sl-alert-error">{metaError} <button className="sl-btn sl-btn-sm" onClick={loadMeta}>Retry</button></div>;
  else if (!meta) body = <div className="sl-card"><SkeletonRows rows={6} /></div>;
  else if (section === 'overview') body = <OverviewView meta={meta} onNavigate={go} onOpenLead={setOpenLeadId} toast={toast} />;
  else if (section === 'leads') body = <AllLeadsView meta={meta} onOpenLead={setOpenLeadId} toast={toast} canCreateLead={canCreateLead} onNavigateTab={onNavigateTab} />;
  else if (section === 'pipeline') body = <PipelineView meta={meta} onOpenLead={setOpenLeadId} toast={toast} onNavigateTab={onNavigateTab} />;
  else if (section === 'followups') body = <FollowupsView meta={meta} onOpenLead={setOpenLeadId} toast={toast} />;
  else if (section === 'team' && isCeoOrTechSupport) body = <TeamView meta={meta} onNavigate={go} onOpenLead={setOpenLeadId} toast={toast} />;
  else if (section === 'reports') body = <ReportsView meta={meta} onNavigate={go} toast={toast} />;
  else if (section === 'automation' && isCeoOrTechSupport) body = <AutomationView meta={meta} toast={toast} />;
  else body = <div className="sl-card"><EmptyState title={`${current.label}`} text="Section under active development or restricted." /></div>;

  const visibleMobileKeys = MOBILE_KEYS;

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
          onNavigateTab={onNavigateTab}
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
