import React, { useEffect, useState } from 'react';
import {
  Zap, Settings, ShieldCheck, Bell, Clock, Globe,
  Copy, Check, Play, RefreshCw, Send, CheckCircle2
} from 'lucide-react';
import { slApi } from './smartLeadsApi';
import { SkeletonRows } from './SlShared';

export default function AutomationView({ meta, toast }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await slApi.automation();
      setConfig(res.data || {});
    } catch (err) {
      if (toast) toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await slApi.saveAutomation(config);
      if (toast) toast('Automation settings saved successfully', 'success');
    } catch (err) {
      if (toast) toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const runSimulation = async () => {
    setSimulating(true);
    setSimulationResult(null);
    try {
      const res = await slApi.testWebhook({
        company_name: 'Solartech Enterprises Ltd',
        contact_person: 'Rajesh Sharma',
        phone: '+91 98401 23456',
        email: 'rajesh@solartech.in',
        source: 'Website Inbound Form',
        product_requirement: '75kW HDG Tracker Mount Structure',
        estimated_value: 680000
      });
      setSimulationResult(res);
      if (toast) toast(res.message, 'success');
    } catch (err) {
      if (toast) toast(err.message, 'error');
    } finally {
      setSimulating(false);
    }
  };

  if (loading || !config) {
    return (
      <div style={{ padding: '24px', background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
        <SkeletonRows rows={6} />
      </div>
    );
  }

  const webhookUrl = `${window.location.origin}/api/smart-leads/webhook/inbound`;
  const apiKey = config.inboundWebhook?.apiKey || 'sl_wh_live_2026_vrm';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Lead Automation & Webhook Integration
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
            Configure automatic lead ingestion, instant salesperson assignment, and response SLAs.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 18px', borderRadius: '8px', border: 'none',
              background: '#0E7490', color: '#FFFFFF', fontSize: '13px',
              fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '18px' }}>
        {/* Card 1: Inbound Webhook Integration */}
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ECFEFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={18} color="#0E7490" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', margin: 0 }}>Inbound Lead Webhook</h3>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Direct capture from website, Meta & IndiaMART</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                WEBHOOK ENDPOINT URL
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', background: '#F8FAFC', color: '#334155' }}
                />
                <button
                  onClick={() => handleCopy(webhookUrl, 'url')}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  {copiedUrl ? <Check size={14} color="#16A34A" /> : <Copy size={14} color="#475569" />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>
                WEBHOOK API SECRET KEY
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  readOnly
                  value={apiKey}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', background: '#F8FAFC', color: '#334155' }}
                />
                <button
                  onClick={() => handleCopy(apiKey, 'key')}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  {copiedKey ? <Check size={14} color="#16A34A" /> : <Copy size={14} color="#475569" />}
                </button>
              </div>
            </div>
          </div>

          {/* Webhook Test Simulator */}
          <div style={{ background: '#F0FDFA', border: '1px dashed #0E7490', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#0E7490' }}>Webhook Inbound Simulator</span>
              <button
                onClick={runSimulation}
                disabled={simulating}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '6px', border: 'none',
                  background: '#0E7490', color: '#FFFFFF', fontSize: '12px', fontWeight: '600',
                  cursor: simulating ? 'not-allowed' : 'pointer'
                }}
              >
                <Play size={12} />
                {simulating ? 'Simulating...' : 'Simulate Test Lead'}
              </button>
            </div>
            {simulationResult && (
              <div style={{ fontSize: '12px', color: '#065F46', background: '#DCFCE7', padding: '8px 10px', borderRadius: '6px' }}>
                ✅ Inbound lead created: <strong>{simulationResult.lead?.lead_number}</strong> assigned to <strong>{simulationResult.lead?.assigned_to}</strong>.
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Automatic Salesperson Assignment */}
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="#2563EB" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', margin: 0 }}>Auto-Assignment Rules</h3>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Distribute new leads instantly across the sales team</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.autoAssign?.enabled || false}
                onChange={(e) => setConfig({
                  ...config,
                  autoAssign: { ...config.autoAssign, enabled: e.target.checked }
                })}
                style={{ width: '16px', height: '16px', accentColor: '#0E7490' }}
              />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B' }}>
                Enable Automatic Assignment on Lead Ingestion
              </span>
            </label>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                Distribution Strategy
              </label>
              <select
                value={config.autoAssign?.mode || 'round_robin'}
                onChange={(e) => setConfig({
                  ...config,
                  autoAssign: { ...config.autoAssign, mode: e.target.value }
                })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              >
                <option value="round_robin">Round Robin (Equal sequential rotation)</option>
                <option value="workload_balance">Workload Balancing (Assign to rep with fewest open leads)</option>
              </select>
            </div>

            <div style={{ fontSize: '12px', color: '#64748B', background: '#F8FAFC', padding: '10px', borderRadius: '8px' }}>
              ℹ️ Eligible team members with the 'Sales' or 'Sales Executive' role will automatically participate in lead distribution.
            </div>
          </div>
        </div>

        {/* Card 3: Response SLA & Escalation Alerts */}
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={18} color="#DC2626" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', margin: 0 }}>SLA & Response Alerts</h3>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Prevent delayed touchpoints and deal slips</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                Uncontacted Lead Alert SLA
              </label>
              <select
                value={config.slaAlerts?.uncontactedHours || 24}
                onChange={(e) => setConfig({
                  ...config,
                  slaAlerts: { ...config.slaAlerts, uncontactedHours: Number(e.target.value) }
                })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              >
                <option value={4}>4 Hours (Fast Response)</option>
                <option value={12}>12 Hours (Same Day)</option>
                <option value={24}>24 Hours (Standard SLA)</option>
                <option value={48}>48 Hours (Relaxed SLA)</option>
              </select>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.slaAlerts?.escalateToManager ?? true}
                onChange={(e) => setConfig({
                  ...config,
                  slaAlerts: { ...config.slaAlerts, escalateToManager: e.target.checked }
                })}
                style={{ width: '16px', height: '16px', accentColor: '#0E7490' }}
              />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B' }}>
                Escalate overdue SLA leads to Sales Manager
              </span>
            </label>
          </div>
        </div>

        {/* Card 4: Automated Follow-up Scheduling */}
        <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={18} color="#16A34A" />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', margin: 0 }}>Auto Follow-up Creation</h3>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Ensure every new lead immediately has a scheduled next action</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.autoFollowup?.enabled || false}
                onChange={(e) => setConfig({
                  ...config,
                  autoFollowup: { ...config.autoFollowup, enabled: e.target.checked }
                })}
                style={{ width: '16px', height: '16px', accentColor: '#0E7490' }}
              />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B' }}>
                Auto-schedule first follow-up when lead is created
              </span>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Touchpoint Type
                </label>
                <select
                  value={config.autoFollowup?.type || 'CALL'}
                  onChange={(e) => setConfig({
                    ...config,
                    autoFollowup: { ...config.autoFollowup, type: e.target.value }
                  })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                >
                  <option value="CALL">Phone Call</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="EMAIL">Email</option>
                  <option value="MEETING">Meeting</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Target Due Time
                </label>
                <select
                  value={config.autoFollowup?.delayHours || 24}
                  onChange={(e) => setConfig({
                    ...config,
                    autoFollowup: { ...config.autoFollowup, delayHours: Number(e.target.value) }
                  })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                >
                  <option value={4}>In 4 Hours</option>
                  <option value={12}>In 12 Hours</option>
                  <option value={24}>In 24 Hours</option>
                  <option value={48}>In 48 Hours</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
