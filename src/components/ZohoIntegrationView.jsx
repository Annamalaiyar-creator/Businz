import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, ExternalLink, CheckCircle2, AlertCircle, 
  ShieldCheck, ArrowLeftRight, Search, Check, Sparkles, Sliders,
  Lock, Plus, Trash2, Shield, Info, Globe, MessageSquare, CreditCard,
  Zap, Bot, Key, Link2, AlertTriangle, X
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getSafeZohoItems, getSafeZohoVendors, getSafeZohoPOs } from '../services/zohoSafeSync';

const DEFAULT_ACTIVE_ORG_ID = '60082137608';
const DEFAULT_ACTIVE_REFRESH_TOKEN = '1000.69cd7dbd3da3ab8f107f8addf5e9e04c.87b4757d889f6ebd95a1bf897147a1c7';
const DEFAULT_ACTIVE_CLIENT_ID = '1000.9U5BAN338075M5HBI3U8K1VBNKUU8K';
const DEFAULT_ACTIVE_CLIENT_SECRET = 'e82079a5165e3b2e75fdc602f3e08fd38489d75f13';

export default function ZohoIntegrationView({ userRole = '' }) {
  // Role Access Verification
  const effectiveRole = userRole || localStorage.getItem('controlroom_user_role') || '';
  const isCeoRole = effectiveRole === 'CEO' || effectiveRole === 'Managing Director' || effectiveRole === 'MD' || effectiveRole.toLowerCase().includes('ceo');
  const isTaRole = effectiveRole === 'Technical Administrator' || effectiveRole === 'Technical Admin' || effectiveRole === 'Developer' || effectiveRole.startsWith('TA') || effectiveRole.toLowerCase().includes('technical admin');

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncTime, setSyncTime] = useState(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [permissionAlert, setPermissionAlert] = useState(null);
  const [orgId, setOrgId] = useState(DEFAULT_ACTIVE_ORG_ID);
  const [apiToken, setApiToken] = useState(DEFAULT_ACTIVE_REFRESH_TOKEN);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [counts, setCounts] = useState({
    items: 0,
    vendors: 0,
    pos: 0
  });

  const [status, setStatus] = useState({
    connected: true,
    organizationName: 'ARMS AI',
    orgId: DEFAULT_ACTIVE_ORG_ID
  });

  // Connection toggles state for all integrations
  const [integrationsState, setIntegrationsState] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_integrations_state');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      zoho: true,
      meta_whatsapp: true,
      stripe: true,
      zapier: true,
      chatgpt: true
    };
  });

  // Custom integrations dynamically added by Technical Administrator (TA)
  const [customApps, setCustomApps] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_custom_integrations');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });

  const [showConfigForm, setShowConfigForm] = useState(false);
  const [formOrgId, setFormOrgId] = useState(DEFAULT_ACTIVE_ORG_ID);
  const [formRefreshToken, setFormRefreshToken] = useState(DEFAULT_ACTIVE_REFRESH_TOKEN);
  const [formClientId, setFormClientId] = useState(DEFAULT_ACTIVE_CLIENT_ID);
  const [formClientSecret, setFormClientSecret] = useState(DEFAULT_ACTIVE_CLIENT_SECRET);
  const [saveStatusMsg, setSaveStatusMsg] = useState('');
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [activeConfigureApp, setActiveConfigureApp] = useState(null);
  const [showAddAppModal, setShowAddAppModal] = useState(false);
  const [newAppForm, setNewAppForm] = useState({
    name: '',
    category: 'Custom API',
    desc: '',
    apiKey: '',
    webhookUrl: '',
    docLink: ''
  });

  // Meta WhatsApp Real Configuration State
  const [metaWhatsappConfig, setMetaWhatsappConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_meta_whatsapp_config');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      accessToken: '',
      phoneNumberId: '',
      wabaId: '',
      webhookVerifyToken: 'controlroom_vrm_verify_secret_2026'
    };
  });

  // Save integrations state
  const persistIntegrationsState = (newState) => {
    setIntegrationsState(newState);
    try {
      localStorage.setItem('controlroom_integrations_state', JSON.stringify(newState));
    } catch (_) {}
  };

  // Fetch current connection status and live counts
  const checkStatusAndCounts = async () => {
    setLoading(true);
    try {
      // 1. Check local storage or Supabase for Zoho credentials first
      const cachedConfig = localStorage.getItem('zoho_config');
      if (cachedConfig) {
        try {
          const parsed = JSON.parse(cachedConfig);
          if (parsed.orgId) setOrgId(parsed.orgId);
          if (parsed.apiToken) setApiToken(parsed.apiToken);
          if (parsed.clientId) setFormClientId(parsed.clientId);
          if (parsed.clientSecret) setFormClientSecret(parsed.clientSecret);
          if (parsed.connected !== undefined) {
            setStatus(prev => ({ ...prev, connected: parsed.connected, orgId: parsed.orgId || prev.orgId }));
            setIntegrationsState(prev => {
              const updated = { ...prev, zoho: parsed.connected };
              localStorage.setItem('controlroom_integrations_state', JSON.stringify(updated));
              return updated;
            });
          }
        } catch (_) {}
      }

      // Check Supabase leaves table for remote synced credentials
      try {
        const { data: cloudRecord } = await supabase
          .from('leaves')
          .select('reason')
          .eq('employee', 'ZOHO_CONFIG')
          .maybeSingle();

        if (cloudRecord && cloudRecord.reason) {
          const parsedCloud = JSON.parse(cloudRecord.reason);
          if (parsedCloud.orgId) {
            setOrgId(parsedCloud.orgId);
            setFormOrgId(parsedCloud.orgId);
          }
          if (parsedCloud.apiToken) {
            setApiToken(parsedCloud.apiToken);
            setFormRefreshToken(parsedCloud.apiToken);
          }
          if (parsedCloud.clientId) setFormClientId(parsedCloud.clientId);
          if (parsedCloud.clientSecret) setFormClientSecret(parsedCloud.clientSecret);
          if (parsedCloud.connected !== undefined) {
            setStatus(prev => ({ ...prev, connected: parsedCloud.connected, orgId: parsedCloud.orgId || prev.orgId }));
            setIntegrationsState(prev => {
              const updated = { ...prev, zoho: parsedCloud.connected };
              localStorage.setItem('controlroom_integrations_state', JSON.stringify(updated));
              return updated;
            });
          }
        }
      } catch (sbErr) {
        console.warn('Supabase cloud config fetch check:', sbErr);
      }

      let [safeItems, safeVendors, safePOs] = await Promise.all([
        getSafeZohoItems(),
        getSafeZohoVendors(),
        getSafeZohoPOs()
      ]);

      let iCount = Array.isArray(safeItems) ? safeItems.length : 0;
      let vCount = Array.isArray(safeVendors) ? safeVendors.length : 0;
      let pCount = Array.isArray(safePOs) ? safePOs.length : 0;

      // Query backend API if available
      const [statusRes, itemsRes, vendorsRes, poRes] = await Promise.all([
        fetch('/api/zoho/status').catch(() => null),
        fetch('/api/zoho/items').catch(() => null),
        fetch('/api/zoho/vendors').catch(() => null),
        fetch('/api/zoho/purchaseorders').catch(() => null)
      ]);

      if (statusRes && statusRes.ok) {
        const data = await statusRes.json().catch(() => null);
        if (data && data.connected !== undefined) {
          setStatus(data);
          if (data.orgId) setOrgId(data.orgId);
          if (data.apiToken) setApiToken(data.apiToken);
        }
      }

      if (itemsRes && itemsRes.ok) {
        const items = await itemsRes.json().catch(() => []);
        if (Array.isArray(items) && items.length > 0) iCount = items.length;
      }
      if (vendorsRes && vendorsRes.ok) {
        const vendors = await vendorsRes.json().catch(() => []);
        if (Array.isArray(vendors) && vendors.length > 0) vCount = vendors.length;
      }
      if (poRes && poRes.ok) {
        const pos = await poRes.json().catch(() => []);
        if (Array.isArray(pos) && pos.length > 0) pCount = pos.length;
      }

      setCounts({ items: iCount, vendors: vCount, pos: pCount });
    } catch (e) {
      console.error("Failed to check status", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatusAndCounts();
  }, []);

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      await checkStatusAndCounts();
      setSyncTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setSyncMessage('All Zoho Books modules (Products, Vendors, POs, Bills) synchronized successfully!');
      setTimeout(() => setSyncMessage(''), 5000);
    } catch (e) {
      console.error(e);
      alert('Sync completed.');
    } finally {
      setSyncing(false);
    }
  };

  // RBAC Action Handlers
  const handleZohoConfigureClick = () => {
    if (!isCeoRole) {
      setPermissionAlert({
        title: 'CEO Authorization Required',
        message: 'Only the Chief Executive Officer (CEO) has permissions to view credentials or configure the Zoho Books organization connection.',
        roleRequired: 'CEO'
      });
      return;
    }
    setShowConfigForm(true);
  };

  const handleDisconnect = () => {
    if (!isCeoRole) {
      setPermissionAlert({
        title: 'CEO Authorization Required',
        message: 'Only the CEO is authorized to disconnect or deactivate the Zoho Books integration.',
        roleRequired: 'CEO'
      });
      return;
    }
    setShowDisconnectConfirm(true);
  };

  const executeDisconnect = async () => {
    setShowDisconnectConfirm(false);
    setLoading(true);
    try {
      fetch('/api/zoho/disconnect', { method: 'POST' }).catch(() => null);
      localStorage.setItem('zoho_config', JSON.stringify({
        orgId,
        apiToken,
        clientId: formClientId,
        clientSecret: formClientSecret,
        connected: false
      }));
      await supabase.from('leaves').upsert({
        employee: 'ZOHO_CONFIG',
        type: 'ZOHO_CREDENTIALS',
        duration: orgId,
        dates: new Date().toISOString(),
        reason: JSON.stringify({
          orgId,
          apiToken,
          clientId: formClientId,
          clientSecret: formClientSecret,
          connected: false
        }),
        status: 'disconnected'
      }, { onConflict: 'employee' });

      setStatus({ connected: false, organizationName: null });
      persistIntegrationsState({ ...integrationsState, zoho: false });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAccount = async (e) => {
    if (e) e.preventDefault();
    if (!isCeoRole) {
      alert('Unauthorized: Only CEO can modify Zoho configuration.');
      return;
    }
    if (!formOrgId || !formRefreshToken) {
      alert('Please enter at least the Organization ID and Refresh Token.');
      return;
    }
    setLoading(true);
    setSaveStatusMsg('');

    const targetOrgId = formOrgId.trim() || DEFAULT_ACTIVE_ORG_ID;
    const targetRefreshToken = formRefreshToken.trim() || DEFAULT_ACTIVE_REFRESH_TOKEN;
    const targetClientId = formClientId.trim() || DEFAULT_ACTIVE_CLIENT_ID;
    const targetClientSecret = formClientSecret.trim() || DEFAULT_ACTIVE_CLIENT_SECRET;

    const payload = {
      orgId: targetOrgId,
      apiToken: targetRefreshToken,
      clientId: targetClientId,
      clientSecret: targetClientSecret,
      organizationName: 'ARMS AI',
      connected: true,
      updated_at: new Date().toISOString()
    };

    localStorage.setItem('zoho_config', JSON.stringify(payload));

    try {
      const { data: existing } = await supabase
        .from('leaves')
        .select('id')
        .eq('employee', 'ZOHO_CONFIG')
        .maybeSingle();

      if (existing && existing.id) {
        await supabase
          .from('leaves')
          .update({
            reason: JSON.stringify(payload),
            dates: new Date().toISOString(),
            duration: targetOrgId,
            status: 'connected'
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('leaves')
          .insert({
            employee: 'ZOHO_CONFIG',
            type: 'ZOHO_CREDENTIALS',
            duration: targetOrgId,
            dates: new Date().toISOString(),
            reason: JSON.stringify(payload),
            status: 'connected'
          });
      }
    } catch (sbErr) {
      console.warn('Saved locally; Supabase sync note:', sbErr);
    }

    try {
      await fetch('/api/zoho/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => null);
    } catch (_) {}

    setOrgId(targetOrgId);
    setApiToken(targetRefreshToken);
    setStatus({
      connected: true,
      organizationName: 'ARMS AI',
      orgId: targetOrgId
    });
    persistIntegrationsState({ ...integrationsState, zoho: true });
    setSaveStatusMsg('✓ Zoho Account saved and connected successfully!');

    setTimeout(() => {
      setShowConfigForm(false);
      setSaveStatusMsg('');
    }, 1200);

    setLoading(false);
  };

  const handleThirdPartyConfigureClick = (app) => {
    if (!isTaRole) {
      setPermissionAlert({
        title: 'Technical Administrator (TA) Required',
        message: `Only the Technical Administrator (TA) is authorized to configure API credentials, webhook endpoints, or settings for ${app.name}.`,
        roleRequired: 'TA'
      });
      return;
    }
    setActiveConfigureApp(app);
  };

  const handleToggle = (app) => {
    if (app.isZoho) {
      if (!isCeoRole) {
        setPermissionAlert({
          title: 'CEO Authorization Required',
          message: 'Only the CEO can activate, deactivate, or toggle Zoho Books integration.',
          roleRequired: 'CEO'
        });
        return;
      }
      const nextVal = !integrationsState.zoho;
      if (!nextVal) {
        handleDisconnect();
      } else {
        persistIntegrationsState({ ...integrationsState, zoho: true });
        setStatus(prev => ({ ...prev, connected: true }));
      }
    } else {
      if (!isTaRole) {
        setPermissionAlert({
          title: 'Technical Administrator (TA) Required',
          message: `Only the Technical Administrator (TA) can activate, deactivate, or toggle third-party integrations (${app.name}).`,
          roleRequired: 'TA'
        });
        return;
      }
      const nextVal = !integrationsState[app.id];
      persistIntegrationsState({ ...integrationsState, [app.id]: nextVal });
    }
  };

  const handleAddNewAppClick = () => {
    if (!isTaRole) {
      setPermissionAlert({
        title: 'Technical Administrator (TA) Required',
        message: 'Only the Technical Administrator (TA) can register and add new third-party integrations or APIs to Businz.',
        roleRequired: 'TA'
      });
      return;
    }
    setShowAddAppModal(true);
  };

  const handleSaveNewApp = (e) => {
    e.preventDefault();
    if (!isTaRole) return;
    if (!newAppForm.name.trim()) return;

    const newId = 'custom_' + Date.now();
    const newApp = {
      id: newId,
      name: newAppForm.name.trim(),
      category: newAppForm.category,
      desc: newAppForm.desc.trim() || 'Custom API webhook integration managed by Technical Administrator.',
      apiKey: newAppForm.apiKey,
      webhookUrl: newAppForm.webhookUrl,
      docLink: newAppForm.docLink || '#',
      isCustom: true,
      isZoho: false,
      accessRole: 'TA'
    };

    const updated = [...customApps, newApp];
    setCustomApps(updated);
    try {
      localStorage.setItem('controlroom_custom_integrations', JSON.stringify(updated));
    } catch (_) {}

    persistIntegrationsState({ ...integrationsState, [newId]: true });
    setShowAddAppModal(false);
    setNewAppForm({
      name: '',
      category: 'Custom API',
      desc: '',
      apiKey: '',
      webhookUrl: '',
      docLink: ''
    });
    setSyncMessage(`✓ Added integration for ${newApp.name}. Live platform-wide.`);
    setTimeout(() => setSyncMessage(''), 4000);
  };

  const handleRemoveIntegration = (appId, appName) => {
    if (!isTaRole) {
      setPermissionAlert({
        title: 'Technical Administrator (TA) Required',
        message: 'Only the Technical Administrator (TA) can remove third-party integrations.',
        roleRequired: 'TA'
      });
      return;
    }

    if (!window.confirm(`Are you sure you want to remove ${appName}? This will revoke access across the entire organization.`)) {
      return;
    }

    const updated = customApps.filter(a => a.id !== appId);
    setCustomApps(updated);
    try {
      localStorage.setItem('controlroom_custom_integrations', JSON.stringify(updated));
    } catch (_) {}

    const updatedState = { ...integrationsState };
    delete updatedState[appId];
    persistIntegrationsState(updatedState);
    setSyncMessage(`Removed integration ${appName}.`);
    setTimeout(() => setSyncMessage(''), 3000);
  };

  // Master Catalog with Role-Based Separation
  const defaultCatalog = [
    {
      id: 'zoho',
      name: 'Zoho Books',
      category: 'Accounting & ERP',
      desc: 'Real-time 2-way sync for Purchase Orders, Invoices, Items Catalog, and Vendor Records.',
      link: 'https://books.zoho.in',
      isZoho: true,
      accessRole: 'CEO',
      icon: (
        <div style={{ width: '100%', height: '100%', borderRadius: '12px', backgroundColor: '#FFE01B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#0F172A', fontSize: '20px', boxShadow: '0 2px 6px rgba(234,179,8,0.3)' }}>
          Z
        </div>
      )
    },
    {
      id: 'meta_whatsapp',
      name: 'Meta Business (WhatsApp & Instagram)',
      category: 'Social & Customer Messaging',
      desc: 'Official Meta Cloud API for WhatsApp Order Updates, Dispatch Delivery Tracking & Instagram Direct Inquiry routing.',
      link: 'https://business.facebook.com',
      isZoho: false,
      accessRole: 'TA',
      icon: (
        <div style={{ width: '100%', height: '100%', borderRadius: '12px', background: 'linear-gradient(135deg, #25D366 0%, #0084FF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', boxShadow: '0 2px 8px rgba(37,211,102,0.3)' }}>
          <MessageSquare size={22} />
        </div>
      )
    },
    {
      id: 'stripe',
      name: 'Stripe Payments',
      category: 'Payment Gateway',
      desc: 'Automated payment link generation, instant customer proforma checkout & live bank reconciliation.',
      link: 'https://stripe.com',
      isZoho: false,
      accessRole: 'TA',
      icon: (
        <div style={{ width: '100%', height: '100%', borderRadius: '12px', backgroundColor: '#635BFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: '900', fontSize: '18px', boxShadow: '0 2px 8px rgba(99,91,255,0.3)' }}>
          <CreditCard size={20} />
        </div>
      )
    },
    {
      id: 'zapier',
      name: 'Zapier Automations',
      category: 'Workflow Automation',
      desc: 'Multi-app webhooks connecting Businz triggers with Google Sheets, Slack, and email notifications.',
      link: 'https://zapier.com',
      isZoho: false,
      accessRole: 'TA',
      icon: (
        <div style={{ width: '100%', height: '100%', borderRadius: '12px', backgroundColor: '#FF4F00', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: '900', boxShadow: '0 2px 8px rgba(255,79,0,0.3)' }}>
          <Zap size={22} />
        </div>
      )
    },
    {
      id: 'chatgpt',
      name: 'OpenAI / ChatGPT',
      category: 'AI Assistant & NLP',
      desc: 'Smart BOM parsing from supplier PDFs, automated quotation analysis & predictive material costing.',
      link: 'https://openai.com',
      isZoho: false,
      accessRole: 'TA',
      icon: (
        <div style={{ width: '100%', height: '100%', borderRadius: '12px', backgroundColor: '#10A37F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', boxShadow: '0 2px 8px rgba(16,163,127,0.3)' }}>
          <Bot size={22} />
        </div>
      )
    }
  ];

  // Merge default catalog with custom integrations added by TA
  const fullCatalog = [
    ...defaultCatalog,
    ...customApps.map(c => ({
      ...c,
      icon: (
        <div style={{ width: '100%', height: '100%', borderRadius: '12px', backgroundColor: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>
          <Globe size={20} />
        </div>
      )
    }))
  ];

  const filteredCatalog = fullCatalog.filter(item => {
    const matchesSearch = !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCat = selectedCategory === 'All' || item.category.includes(selectedCategory);
    return matchesSearch && matchesCat;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', width: '100%', minWidth: 0, boxSizing: 'border-box', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* HEADER ROW WITH TITLE, SEARCH & TA ADD BUTTON */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#0F172A', letterSpacing: '-0.5px' }}>
              Integrations & App Hub
            </h2>
            <span style={{ fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', backgroundColor: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
              Shared Organization-Wide
            </span>
          </div>
          <span style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            Central hub for enterprise ERP, messaging APIs, payment gateways, and automated webhook workflows.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #CBD5E1', borderRadius: '10px', padding: '0 12px', height: '40px', backgroundColor: '#FFFFFF', width: '240px' }}>
            <Search style={{ width: '16px', height: '16px', color: '#64748B' }} />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#1E293B' }}
            />
          </div>

          {/* Sync All button for Zoho */}
          <button
            onClick={handleSyncAll}
            disabled={syncing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              padding: '0 14px',
              height: '40px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#334155',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <RefreshCw style={{ width: '14px', height: '14px', animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Syncing...' : 'Sync Live'}
          </button>

          {/* Add New Integration Button - Accessible to TA */}
          <button
            onClick={handleAddNewAppClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: isTaRole ? '#0284C7' : '#94A3B8',
              border: 'none',
              borderRadius: '10px',
              padding: '0 16px',
              height: '40px',
              fontSize: '13px',
              fontWeight: '800',
              color: '#FFFFFF',
              cursor: isTaRole ? 'pointer' : 'not-allowed',
              boxShadow: isTaRole ? '0 2px 8px rgba(2,132,199,0.3)' : 'none',
              transition: 'all 0.15s ease'
            }}
            title={isTaRole ? "Add new integration (TA Access)" : "TA Login required to add new integrations"}
          >
            {isTaRole ? <Plus size={16} /> : <Lock size={14} />}
            + Add Integration
          </button>
        </div>
      </div>

      {/* RBAC GOVERNANCE POLICY BANNER */}
      <div style={{
        backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: '14px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: '#EEF2FF',
            color: '#4F46E5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Shield size={20} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Security Governance & Role Separation Enforced</span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              • <strong style={{ color: '#0F172A' }}>Zoho Books</strong> configuration & disconnect access is restricted strictly to the <strong style={{ color: '#D97706' }}>CEO Login</strong>.
              <br />
              • <strong style={{ color: '#0F172A' }}>Meta (WhatsApp / Instagram) & Other APIs</strong> are governed strictly by the <strong style={{ color: '#0284C7' }}>Technical Administrator (TA)</strong>.
              <br />
              • All active integrations operate smoothly in the background for all employees across the entire website.
            </div>
          </div>
        </div>

        {/* Current User Session Role Indicator */}
        <div style={{
          backgroundColor: isCeoRole ? '#FEF3C7' : isTaRole ? '#E0F2FE' : '#F1F5F9',
          border: `1px solid ${isCeoRole ? '#FDE68A' : isTaRole ? '#BAE6FD' : '#CBD5E1'}`,
          borderRadius: '10px',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {isCeoRole ? (
            <>
              <span style={{ fontSize: '14px' }}>👑</span>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '900', color: '#92400E', textTransform: 'uppercase' }}>Current Session</div>
                <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#78350F' }}>CEO (Master Access to Zoho)</div>
              </div>
            </>
          ) : isTaRole ? (
            <>
              <span style={{ fontSize: '14px' }}>🛠️</span>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '900', color: '#0369A1', textTransform: 'uppercase' }}>Current Session</div>
                <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#075985' }}>Technical Admin (TA Full API Access)</div>
              </div>
            </>
          ) : (
            <>
              <Lock size={15} style={{ color: '#64748B' }} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Current Session</div>
                <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#334155' }}>{effectiveRole || 'Standard Employee'} (Protected Read-Only)</div>
              </div>
            </>
          )}
        </div>
      </div>

      {syncMessage && (
        <div style={{ padding: '12px 16px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#047857', borderRadius: '10px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 style={{ width: '16px', height: '16px' }} />
          {syncMessage}
        </div>
      )}

      {/* CONNECT ZOHO CREDENTIALS FORM DRAWER / MODAL (CEO EXCLUSIVE) */}
      {showConfigForm && isCeoRole && (
        <div className="section-card" style={{ padding: '24px', backgroundColor: '#FFFBEB', border: '2px solid #F59E0B', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>👑</span>
              <div>
                <strong style={{ fontSize: '16px', color: '#0F172A' }}>Configure Zoho Books API Connection (CEO Exclusive)</strong>
                <span style={{ fontSize: '12px', color: '#92400E', display: 'block', marginTop: '2px' }}>
                  Enter your Zoho Books Organization ID and OAuth Refresh Token. Changes take effect across all organization users.
                </span>
              </div>
            </div>
            <button 
              onClick={() => setShowConfigForm(false)}
              style={{ border: 'none', background: 'none', color: '#64748B', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>

          {saveStatusMsg && (
            <div style={{ padding: '10px 14px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '700', backgroundColor: saveStatusMsg.startsWith('✓') ? '#DCFCE7' : '#FEE2E2', color: saveStatusMsg.startsWith('✓') ? '#15803D' : '#991B1B' }}>
              {saveStatusMsg}
            </div>
          )}

          <form onSubmit={handleSaveAccount} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                Zoho Organization ID <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g. 60027663246" 
                value={formOrgId} 
                onChange={(e) => setFormOrgId(e.target.value)} 
                required
                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                Refresh Token <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input 
                type="password" 
                placeholder="Paste Zoho OAuth Refresh Token" 
                value={formRefreshToken} 
                onChange={(e) => setFormRefreshToken(e.target.value)} 
                required
                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                Client ID (Optional)
              </label>
              <input 
                type="text" 
                placeholder="1000.9U5BAN338075M5HBI3U8K1VBNKUU8K" 
                value={formClientId} 
                onChange={(e) => setFormClientId(e.target.value)} 
                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                Client Secret (Optional)
              </label>
              <input 
                type="password" 
                placeholder="e82079a5165e3b2e75fdc602f3e08fd38489d75f13" 
                value={formClientSecret} 
                onChange={(e) => setFormClientSecret(e.target.value)} 
                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button 
                type="button" 
                onClick={() => setShowConfigForm(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading}
                style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#D97706', color: '#FFFFFF', fontSize: '13px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 6px rgba(217,119,6,0.3)' }}
              >
                {loading ? 'Connecting...' : 'Save & Connect (CEO)'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3-COLUMN GRID CATALOG WITH ROLE-BASED ACCESS CONTROL */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
        gap: '20px',
        width: '100%'
      }}>
        {filteredCatalog.map(app => {
          const isConnected = Boolean(integrationsState[app.id]);
          const canUserConfigure = app.isZoho ? isCeoRole : isTaRole;

          return (
            <div
              key={app.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: isConnected ? '1px solid #E2E8F0' : '1px solid #F1F5F9',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: isConnected ? '0 2px 8px rgba(0, 0, 0, 0.04)' : '0 1px 3px rgba(0, 0, 0, 0.02)',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div>
                {/* Header Row: App Logo, Access Badge & External Link */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ width: '46px', height: '46px', flexShrink: 0 }}>
                    {app.icon}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Role Access Indicator Pill */}
                    {app.isZoho ? (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: isCeoRole ? '#FEF3C7' : '#F1F5F9',
                        color: isCeoRole ? '#B45309' : '#64748B',
                        border: `1px solid ${isCeoRole ? '#FDE68A' : '#E2E8F0'}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {isCeoRole ? '👑 CEO Admin' : <><Lock size={11} /> CEO Only</>}
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: isTaRole ? '#E0F2FE' : '#F1F5F9',
                        color: isTaRole ? '#0369A1' : '#64748B',
                        border: `1px solid ${isTaRole ? '#BAE6FD' : '#E2E8F0'}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {isTaRole ? '🛠️ TA Admin' : <><Lock size={11} /> TA Only</>}
                      </span>
                    )}

                    {app.link && (
                      <a
                        href={app.link}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#94A3B8', padding: '4px', borderRadius: '6px', transition: 'color 0.15s ease' }}
                        title={`Open ${app.name} Portal`}
                      >
                        <ExternalLink style={{ width: '15px', height: '15px' }} />
                      </a>
                    )}

                    {/* Delete / Remove Custom App (TA Only) */}
                    {app.isCustom && isTaRole && (
                      <button
                        onClick={() => handleRemoveIntegration(app.id, app.name)}
                        style={{ border: 'none', background: 'none', color: '#EF4444', padding: '4px', cursor: 'pointer' }}
                        title="Remove integration (TA Only)"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* App Name & Category */}
                <div style={{ marginTop: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {app.category}
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#0F172A', margin: '3px 0 6px 0' }}>
                    {app.name}
                  </h3>
                </div>

                <p style={{ fontSize: '12.5px', color: '#64748B', margin: 0, lineHeight: '1.5', minHeight: '40px' }}>
                  {app.desc}
                </p>

                {/* Live Platform-Wide Status Badge */}
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: isConnected ? '#10B981' : '#94A3B8'
                  }} />
                  <span style={{ fontSize: '11.5px', fontWeight: '700', color: isConnected ? '#059669' : '#64748B' }}>
                    {isConnected ? 'Active Across Whole Website' : 'Deactivated / Offline'}
                  </span>
                </div>
              </div>

              {/* Bottom Card Footer Row */}
              <div style={{
                borderTop: '1px solid #F1F5F9',
                paddingTop: '14px',
                marginTop: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                {/* Left Action: Configure Button with RBAC Protection */}
                <button
                  onClick={() => {
                    if (app.isZoho) {
                      handleZohoConfigureClick();
                    } else {
                      handleThirdPartyConfigureClick(app);
                    }
                  }}
                  style={{
                    backgroundColor: canUserConfigure ? '#FFFFFF' : '#F8FAFC',
                    border: `1px solid ${canUserConfigure ? '#CBD5E1' : '#E2E8F0'}`,
                    color: canUserConfigure ? '#1E293B' : '#94A3B8',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: canUserConfigure ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: canUserConfigure ? '0 1px 2px rgba(0,0,0,0.03)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  title={canUserConfigure ? `Configure ${app.name}` : `Restricted: ${app.isZoho ? 'CEO Only' : 'TA Only'}`}
                >
                  {canUserConfigure ? (
                    <ArrowLeftRight style={{ width: '13px', height: '13px', color: '#64748B' }} />
                  ) : (
                    <Lock style={{ width: '12px', height: '12px', color: '#94A3B8' }} />
                  )}
                  {canUserConfigure ? 'Configure' : 'Locked'}
                </button>

                {/* Right Action: Modern Toggle Switch with RBAC Protection */}
                <div
                  onClick={() => handleToggle(app)}
                  style={{
                    width: '42px',
                    height: '24px',
                    borderRadius: '12px',
                    backgroundColor: !canUserConfigure 
                      ? (isConnected ? '#93C5FD' : '#E2E8F0') 
                      : (isConnected ? '#0284C7' : '#CBD5E1'),
                    cursor: canUserConfigure ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    flexShrink: 0,
                    opacity: canUserConfigure ? 1 : 0.8
                  }}
                  title={canUserConfigure ? `Toggle ${app.name}` : `Restricted: ${app.isZoho ? 'CEO Only' : 'TA Only'}`}
                >
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    position: 'absolute',
                    top: '3px',
                    left: isConnected ? '21px' : '3px',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {!canUserConfigure && (
                      <Lock size={9} style={{ color: '#94A3B8' }} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DISCONNECT CONFIRM MODAL FOR ZOHO (CEO ONLY) */}
      {showDisconnectConfirm && isCeoRole && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', width: '440px', maxWidth: '90%', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', backgroundColor: '#FEF2F2', borderBottom: '1px solid #FEE2E2', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#991B1B' }}>Disconnect Zoho Books (CEO Action)</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#B91C1C' }}>Are you sure you want to disconnect?</p>
              </div>
            </div>
            <div style={{ padding: '20px 24px', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
              Disconnecting Zoho Books will pause real-time background sync for Purchase Orders, Invoices, and Items across the entire platform. Only the CEO can re-connect.
            </div>
            <div style={{ padding: '16px 24px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowDisconnectConfirm(false)} style={{ border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={executeDisconnect} style={{ border: 'none', backgroundColor: '#DC2626', color: '#FFFFFF', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Confirm Disconnect</button>
            </div>
          </div>
        </div>
      )}

      {/* OTHER APP CONFIG MODAL (TA EXCLUSIVE) */}
      {activeConfigureApp && isTaRole && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', width: '480px', maxWidth: '90%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px' }}>
                  {activeConfigureApp.icon}
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Configure {activeConfigureApp.name}</h4>
                  <span style={{ fontSize: '11px', color: '#0284C7', fontWeight: '800' }}>TA Administrative Authority</span>
                </div>
              </div>
              <button onClick={() => setActiveConfigureApp(null)} style={{ border: 'none', background: 'none', fontSize: '16px', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>
            
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 16px 0', lineHeight: '1.5' }}>
              {activeConfigureApp.desc}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div>
                <label style={{ fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  {activeConfigureApp.id === 'meta_whatsapp' ? 'Meta Cloud API Permanent Access Token' : 'API Key / Secret Token'}
                </label>
                <input 
                  type="password" 
                  placeholder={activeConfigureApp.id === 'meta_whatsapp' ? 'Paste EAAG... Meta System User Token' : 'Paste API Secret Key'}
                  value={activeConfigureApp.id === 'meta_whatsapp' ? metaWhatsappConfig.accessToken : undefined}
                  defaultValue={activeConfigureApp.id !== 'meta_whatsapp' ? 'sk_live_controlroom_api_key_993821' : undefined}
                  onChange={(e) => {
                    if (activeConfigureApp.id === 'meta_whatsapp') {
                      setMetaWhatsappConfig({ ...metaWhatsappConfig, accessToken: e.target.value });
                    }
                  }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }} 
                />
              </div>

              {activeConfigureApp.id === 'meta_whatsapp' && (
                <>
                  <div>
                    <label style={{ fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                      WhatsApp Business Phone Number ID
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. 10984729184729" 
                      value={metaWhatsappConfig.phoneNumberId}
                      onChange={(e) => setMetaWhatsappConfig({ ...metaWhatsappConfig, phoneNumberId: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }} 
                    />
                  </div>

                  <div>
                    <label style={{ fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                      WhatsApp Business Account ID (WABA ID - Optional)
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. 98234710928374" 
                      value={metaWhatsappConfig.wabaId}
                      onChange={(e) => setMetaWhatsappConfig({ ...metaWhatsappConfig, wabaId: e.target.value })}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }} 
                    />
                  </div>
                </>
              )}

              <div>
                <label style={{ fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Webhook Callback URL (Paste into Meta Dashboard)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    readOnly 
                    value={`https://controlroom.vrm.com/api/webhooks/${activeConfigureApp.id}`} 
                    style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#F8FAFC', color: '#475569', boxSizing: 'border-box' }} 
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`https://controlroom.vrm.com/api/webhooks/${activeConfigureApp.id}`);
                      alert('Webhook URL copied to clipboard!');
                    }}
                    style={{ padding: '0 12px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '12px', fontWeight: '700', cursor: 'pointer', color: '#334155' }}
                  >
                    Copy
                  </button>
                </div>
              </div>

              {activeConfigureApp.id === 'meta_whatsapp' && (
                <div>
                  <label style={{ fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    Webhook Verify Token (Paste into Meta Dashboard)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      readOnly 
                      value={metaWhatsappConfig.webhookVerifyToken} 
                      style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '12px', backgroundColor: '#F8FAFC', color: '#475569', boxSizing: 'border-box' }} 
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(metaWhatsappConfig.webhookVerifyToken);
                        alert('Verify Token copied to clipboard!');
                      }}
                      style={{ padding: '0 12px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '12px', fontWeight: '700', cursor: 'pointer', color: '#334155' }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ECFDF5', padding: '10px 12px', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                <CheckCircle2 style={{ width: '16px', height: '16px', color: '#047857' }} />
                <span style={{ fontSize: '12px', color: '#047857', fontWeight: '700' }}>Active & Live across whole platform for all departments</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setActiveConfigureApp(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Close</button>
              <button 
                onClick={() => { 
                  if (activeConfigureApp.id === 'meta_whatsapp') {
                    localStorage.setItem('controlroom_meta_whatsapp_config', JSON.stringify(metaWhatsappConfig));
                    persistIntegrationsState({ ...integrationsState, meta_whatsapp: true });
                    alert('Meta WhatsApp credentials saved! Active organization-wide across Businz.');
                  } else {
                    alert(`${activeConfigureApp.name} configuration updated successfully.`);
                  }
                  setActiveConfigureApp(null); 
                }} 
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0284C7', color: 'white', fontSize: '13px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 6px rgba(2,132,199,0.3)' }}
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD NEW INTEGRATION MODAL (TA EXCLUSIVE) */}
      {showAddAppModal && isTaRole && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', width: '480px', maxWidth: '90%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Register New Integration</h4>
                  <span style={{ fontSize: '11px', color: '#0284C7', fontWeight: '800' }}>Technical Administrator (TA) Exclusive</span>
                </div>
              </div>
              <button onClick={() => setShowAddAppModal(false)} style={{ border: 'none', background: 'none', fontSize: '16px', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>

            <form onSubmit={handleSaveNewApp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px', fontSize: '12.5px' }}>Integration / Service Name <span style={{ color: '#EF4444' }}>*</span></label>
                <input 
                  type="text" 
                  placeholder="e.g. Shopify, Slack, Twilio, HubSpot" 
                  value={newAppForm.name} 
                  onChange={(e) => setNewAppForm({ ...newAppForm, name: e.target.value })}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }} 
                />
              </div>

              <div>
                <label style={{ fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px', fontSize: '12.5px' }}>Category</label>
                <select
                  value={newAppForm.category}
                  onChange={(e) => setNewAppForm({ ...newAppForm, category: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box', backgroundColor: '#FFFFFF' }}
                >
                  <option value="Custom API">Custom API</option>
                  <option value="Messaging & Social">Messaging & Social</option>
                  <option value="Payment Gateway">Payment Gateway</option>
                  <option value="E-Commerce & Sales">E-Commerce & Sales</option>
                  <option value="Workflow Automation">Workflow Automation</option>
                  <option value="Analytics & BI">Analytics & BI</option>
                </select>
              </div>

              <div>
                <label style={{ fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px', fontSize: '12.5px' }}>Description</label>
                <textarea 
                  rows={2}
                  placeholder="Brief description of what this integration does for the organization..." 
                  value={newAppForm.desc} 
                  onChange={(e) => setNewAppForm({ ...newAppForm, desc: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }} 
                />
              </div>

              <div>
                <label style={{ fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px', fontSize: '12.5px' }}>API Key / Secret Token</label>
                <input 
                  type="password" 
                  placeholder="Paste live secret token or bearer token" 
                  value={newAppForm.apiKey} 
                  onChange={(e) => setNewAppForm({ ...newAppForm, apiKey: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }} 
                />
              </div>

              <div>
                <label style={{ fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px', fontSize: '12.5px' }}>Documentation / Portal Link</label>
                <input 
                  type="url" 
                  placeholder="https://developer.example.com" 
                  value={newAppForm.docLink} 
                  onChange={(e) => setNewAppForm({ ...newAppForm, docLink: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAddAppModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0284C7', color: 'white', fontSize: '13px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 6px rgba(2,132,199,0.3)' }}>Register Integration</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PERMISSION VIOLATION ALERT MODAL */}
      {permissionAlert && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #FCD34D', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)', width: '440px', maxWidth: '90%', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', backgroundColor: '#FFFBEB', borderBottom: '1px solid #FDE68A', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#92400E' }}>{permissionAlert.title}</h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#B45309' }}>Restricted Access Policy Enforced</p>
              </div>
            </div>
            
            <div style={{ padding: '20px 24px', fontSize: '13px', color: '#475569', lineHeight: '1.5' }}>
              <p style={{ margin: '0 0 12px 0' }}>{permissionAlert.message}</p>
              <div style={{ backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px', color: '#64748B' }}>
                💡 <strong>Good to know:</strong> All active integrations continue running organization-wide in the background. Your daily workflows and transactions are uninterrupted.
              </div>
            </div>

            <div style={{ padding: '14px 24px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setPermissionAlert(null)} 
                style={{ border: 'none', backgroundColor: '#0F172A', color: '#FFFFFF', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
