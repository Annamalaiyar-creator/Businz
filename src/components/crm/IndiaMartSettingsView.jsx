import React, { useState, useEffect } from 'react';
import {
  Globe, Shield, Key, Phone, RefreshCw, CheckCircle2, AlertTriangle,
  Clock, Database, ArrowRight, Check, AlertCircle, Save, ExternalLink
} from 'lucide-react';

export default function IndiaMartSettingsView({ userRole = 'CEO' }) {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  const [form, setForm] = useState({
    mobileNumber: '',
    crmApiKey: '',
    autoSyncEnabled: true,
    syncIntervalMinutes: 15
  });

  const [logs, setLogs] = useState([]);
  const [configMeta, setConfigMeta] = useState({
    hasKey: false,
    lastSyncAt: null,
    lastSyncStatus: null
  });

  const canEdit = ['ceo', 'md', 'tech support', 'technical administrator', 'admin'].some(r =>
    (userRole || '').toLowerCase().includes(r)
  );

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/indiamart/config');
      const data = await res.json();
      if (data?.success && data?.config) {
        setForm({
          mobileNumber: data.config.mobile_number || '',
          crmApiKey: data.config.crm_api_key_masked || '',
          autoSyncEnabled: data.config.auto_sync_enabled ?? true,
          syncIntervalMinutes: data.config.sync_interval_minutes || 15
        });
        setConfigMeta({
          hasKey: data.config.has_key,
          lastSyncAt: data.config.last_sync_at,
          lastSyncStatus: data.config.last_sync_status
        });
      }
    } catch (err) {
      console.error('Failed to load IndiaMART config:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await fetch('/api/integrations/indiamart/logs');
      const data = await res.json();
      if (data?.success && Array.isArray(data.logs)) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to load IndiaMART logs:', err);
    }
  };

  useEffect(() => {
    loadConfig();
    loadLogs();
  }, []);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!canEdit) return;

    setLoading(true);
    setSaveSuccess(false);
    try {
      const payload = {
        mobileNumber: form.mobileNumber,
        autoSyncEnabled: form.autoSyncEnabled,
        syncIntervalMinutes: form.syncIntervalMinutes
      };

      // Only send API key if user changed it (not the masked placeholder)
      if (form.crmApiKey && !form.crmApiKey.includes('••••')) {
        payload.crmApiKey = form.crmApiKey;
      }

      const res = await fetch('/api/integrations/indiamart/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        await loadConfig();
      } else {
        alert(data.error || 'Failed to save configuration');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/integrations/indiamart/test', {
        method: 'POST'
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/integrations/indiamart/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'MANUAL' })
      });
      const data = await res.json();
      setSyncResult(data);
      await loadLogs();
      await loadConfig();
    } catch (err) {
      setSyncResult({ success: false, error: err.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0891B2 0%, #0E7490 100%)',
        borderRadius: '16px',
        padding: '24px 28px',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 10px 25px -5px rgba(14, 116, 144, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Globe size={28} color="#FFFFFF" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>IndiaMART CRM Integration</h2>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: 'rgba(255,255,255,0.25)',
                padding: '2px 8px',
                borderRadius: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Enterprise Encrypted
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.9 }}>
              Automated ingestion of buyer inquiries directly into BUSINZ Central Leads with 24-hour SLA tracking.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSyncNow}
            disabled={syncing || !configMeta.hasKey}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#FFFFFF',
              color: '#0E7490',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: syncing || !configMeta.hasKey ? 'not-allowed' : 'pointer',
              opacity: syncing || !configMeta.hasKey ? 0.6 : 1,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Main Grid: Form + Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>
        {/* Left Card: Secure Configuration Form */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={20} color="#0E7490" />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0F172A' }}>
                API Credentials & Security
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#16A34A', fontWeight: 500 }}>
              <CheckCircle2 size={14} />
              AES-256-GCM Encrypted
            </div>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Primary Registered Mobile Number
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} color="#64748B" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="text"
                  placeholder="e.g. 9840155678"
                  value={form.mobileNumber}
                  onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
                  disabled={!canEdit || loading}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                The mobile number registered with your IndiaMART seller account.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                IndiaMART CRM API Key (GLUSR_CRM_KEY)
              </label>
              <div style={{ position: 'relative' }}>
                <Key size={16} color="#64748B" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="text"
                  placeholder={configMeta.hasKey ? '••••••••••••••••' : 'Paste API Key from IndiaMART Seller Panel'}
                  value={form.crmApiKey}
                  onChange={(e) => setForm({ ...form, crmApiKey: e.target.value })}
                  disabled={!canEdit || loading}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                API key is encrypted via AES-256-GCM before storage. It is never stored or transmitted in plaintext.
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0'
            }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B', display: 'block' }}>
                  Automatic Background Ingestion
                </span>
                <span style={{ fontSize: '11px', color: '#64748B' }}>
                  Pulls new enquiries automatically via background cron
                </span>
              </div>
              <input
                type="checkbox"
                checked={form.autoSyncEnabled}
                onChange={(e) => setForm({ ...form, autoSyncEnabled: e.target.checked })}
                disabled={!canEdit || loading}
                style={{ width: '18px', height: '18px', accentColor: '#0E7490', cursor: 'pointer' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Sync Frequency (Minutes)
              </label>
              <select
                value={form.syncIntervalMinutes}
                onChange={(e) => setForm({ ...form, syncIntervalMinutes: Number(e.target.value) })}
                disabled={!canEdit || loading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '14px',
                  backgroundColor: '#FFFFFF',
                  boxSizing: 'border-box'
                }}
              >
                <option value={15}>Every 15 minutes (Recommended)</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every 1 hour</option>
              </select>
            </div>

            {canEdit && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Save size={16} />
                  {loading ? 'Saving...' : saveSuccess ? 'Saved Securely!' : 'Save Configuration'}
                </button>

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !configMeta.hasKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#F1F5F9',
                    color: '#334155',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: testing || !configMeta.hasKey ? 'not-allowed' : 'pointer'
                  }}
                >
                  <RefreshCw size={15} className={testing ? 'animate-spin' : ''} />
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
            )}
          </form>

          {/* Test Connection Result Alert */}
          {testResult && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: testResult.success ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${testResult.success ? '#BBF7D0' : '#FECACA'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px',
              color: testResult.success ? '#15803D' : '#B91C1C'
            }}>
              {testResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <div>
                <strong>{testResult.success ? 'Connection Successful!' : 'Connection Failed:'}</strong>{' '}
                {testResult.message}
                {testResult.sampleCount !== undefined && ` (${testResult.sampleCount} enquiries detected)`}
              </div>
            </div>
          )}

          {/* Sync Result Alert */}
          {syncResult && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: syncResult.success ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${syncResult.success ? '#BBF7D0' : '#FECACA'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px',
              color: syncResult.success ? '#15803D' : '#B91C1C'
            }}>
              {syncResult.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <div>
                <strong>Sync {syncResult.success ? 'Completed' : 'Failed'}:</strong>{' '}
                {syncResult.success
                  ? `Fetched: ${syncResult.fetched || 0}, New Inserted: ${syncResult.inserted || 0}, Duplicates Skipped: ${syncResult.skipped || 0}`
                  : syncResult.error || 'Sync encountered an error'}
              </div>
            </div>
          )}
        </div>

        {/* Right Card: Status & Operational Overview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>
              Connection Health
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#64748B' }}>Credentials Stored:</span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: configMeta.hasKey ? '#16A34A' : '#DC2626',
                  backgroundColor: configMeta.hasKey ? '#DCFCE7' : '#FEE2E2',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}>
                  {configMeta.hasKey ? 'Configured & Encrypted' : 'Missing Credentials'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#64748B' }}>Last Ingestion:</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#1E293B' }}>
                  {configMeta.lastSyncAt ? new Date(configMeta.lastSyncAt).toLocaleString() : 'Never synced'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#64748B' }}>Last Status:</span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: configMeta.lastSyncStatus === 'SUCCESS' ? '#16A34A' : (configMeta.lastSyncStatus === 'ERROR' ? '#DC2626' : '#64748B')
                }}>
                  {configMeta.lastSyncStatus || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: '#F8FAFC',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '20px'
          }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              IndiaMART Integration Rules
            </h4>
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#64748B', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Enquiries are ingested idempotently using unique IndiaMART Query IDs to prevent duplicates.</li>
              <li>New leads arrive in the <strong>New / Unassigned</strong> queue.</li>
              <li>CEO and Tech Support receive persistent notifications upon arrival.</li>
              <li>A 24-hour inactivity SLA starts counting down immediately from creation.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sync Logs Table */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        padding: '20px 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={18} color="#0E7490" />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>
              Recent Ingestion Logs
            </h3>
          </div>
          <button
            onClick={loadLogs}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              color: '#64748B',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} />
            Refresh Logs
          </button>
        </div>

        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#94A3B8', fontSize: '13px' }}>
            No sync logs recorded yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Timestamp</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Sync Type</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Fetched</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Inserted</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Skipped</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Message / Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', color: '#1E293B', fontFamily: 'monospace', fontSize: '12px' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#F1F5F9',
                        color: '#475569',
                        fontWeight: 600
                      }}>
                        {log.sync_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        backgroundColor: log.status === 'SUCCESS' ? '#DCFCE7' : '#FEE2E2',
                        color: log.status === 'SUCCESS' ? '#16A34A' : '#DC2626'
                      }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#1E293B', fontWeight: 500 }}>{log.leads_fetched || 0}</td>
                    <td style={{ padding: '10px 12px', color: '#16A34A', fontWeight: 600 }}>+{log.leads_inserted || 0}</td>
                    <td style={{ padding: '10px 12px', color: '#64748B' }}>{log.duplicates_skipped || 0}</td>
                    <td style={{ padding: '10px 12px', color: '#475569', fontSize: '12px' }}>
                      {log.error_message || (log.leads_inserted > 0 ? 'Leads ingested successfully' : 'No new leads found')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
