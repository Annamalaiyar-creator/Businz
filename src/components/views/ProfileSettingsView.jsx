import React, { useState, useEffect } from 'react';
import {
  Building2, ShieldCheck, Bell, CreditCard, Link2,
  Save, Check, User, KeyRound, Shield, CheckCircle, ArrowRight,
  Sliders, Globe, MessageSquare, Mail, Share2, Lock, AlertCircle,
  RefreshCw, CheckCircle2, ArrowLeft, Truck
} from 'lucide-react';
import ZohoConfigModal from './ZohoConfigModal';
import IndiaMartSettingsView from '../crm/IndiaMartSettingsView';

export default function ProfileSettingsView({ userRole, onNavigateTab }) {
  const [activeTab, setActiveTab] = useState('general');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  // Subview inside Integrations tab (e.g. 'indiamart')
  const [activeIntegrationSubView, setActiveIntegrationSubView] = useState(null);

  // Sync user profile from backend on mount
  useEffect(() => {
    fetch('/api/user/profile')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.user) {
          setProfile(p => ({
            ...p,
            name: d.user.name || p.name,
            email: d.user.email || p.email,
            phone: d.user.phone || p.phone,
            empCode: d.user.empCode || p.empCode,
            role: d.user.role || p.role,
            department: d.user.department || p.department
          }));
          if (d.user.name) {
            localStorage.setItem('controlroom_logged_user_name', d.user.name);
            localStorage.setItem('vrm_user_name', d.user.name);
            localStorage.setItem('businz_user_name', d.user.name);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Zoho modal & live status
  const [isZohoModalOpen, setIsZohoModalOpen] = useState(false);
  const [zohoConfig, setZohoConfig] = useState(null);
  const [isTestingZoho, setIsTestingZoho] = useState(false);
  const [zohoTestResult, setZohoTestResult] = useState(null);

  // BUSINZ Track: Customer Order Tracking Settings State
  const [trackingSettings, setTrackingSettings] = useState({
    is_enabled: true,
    brand_color: '#0E7490',
    support_phone: '+91 98765 43210',
    support_email: 'support@businz.com',
    show_packing_photos: true,
    show_loading_photos: true,
    show_driver_phone: true,
    auto_whatsapp_dispatch_received: true,
    auto_whatsapp_packing_completed: true,
    auto_whatsapp_dispatched: true,
    auto_whatsapp_delivered: true
  });
  const [trackingSaved, setTrackingSaved] = useState(false);

  useEffect(() => {
    fetch('/api/internal/tracking/settings')
      .then(r => r.json())
      .then(d => {
        if (d.settings && Object.keys(d.settings).length > 0) {
          setTrackingSettings(prev => ({ ...prev, ...d.settings }));
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveTrackingSettings = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/internal/tracking/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackingSettings)
      });
      if (res.ok) {
        setTrackingSaved(true);
        setTimeout(() => setTrackingSaved(false), 2000);
      }
    } catch (_) {}
    finally {
      setBusy(false);
    }
  };

  // Read stored user profile details
  const storedEmpCode = localStorage.getItem('controlroom_logged_emp_id') || localStorage.getItem('controlroom_logged_user_emp_code') || 'TA-001';
  const storedName = localStorage.getItem('controlroom_logged_user_name') || userRole || 'User';
  const storedEmail = localStorage.getItem('controlroom_logged_user_email') || localStorage.getItem('controlroom_logged_user') || (storedEmpCode ? `${storedEmpCode.toLowerCase()}@businz.com` : 'user@businz.com');

  // Check if current user is Technical Administrator (TA)
  const isTA = (
    userRole === 'Technical Administrator' ||
    userRole === 'Tech Support' ||
    (storedEmpCode && (storedEmpCode.toUpperCase().startsWith('TA') || storedEmpCode.toUpperCase().includes('ADMIN')))
  );

  const [profile, setProfile] = useState({
    name: storedName,
    empCode: storedEmpCode,
    email: storedEmail,
    role: userRole || 'Technical Administrator',
    phone: '+91 98765 43210',
    department: 'Operations & Engineering'
  });

  const [workspace, setWorkspace] = useState(() => {
    try {
      const saved = localStorage.getItem('businz_workspace_settings');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      name: 'BUSINZ Industrial Dynamics',
      url: 'businz.cloud/app',
      industry: 'Solar & Heavy Industrial Manufacturing',
      description: 'Unified enterprise CRM, quotation engine, proforma invoice generation, BOM production tracking, and dispatch control system.',
      weekStartsOn: 'Monday',
      language: 'English (US)',
      timezone: 'UTC+05:30 Asia/Kolkata (IST)',
      allowMemberCreation: true
    };
  });

  const [notifs, setNotifs] = useState({
    emailNewLead: true,
    emailSlaBreach: true,
    whatsappAlerts: true,
    browserPush: false,
    dailyDigest: true
  });

  const [passwordState, setPasswordState] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Fetch live Zoho configuration on mount
  useEffect(() => {
    let isMounted = true;
    const fetchZohoConfig = async () => {
      try {
        const res = await fetch('/api/zoho/config');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.config) {
            setZohoConfig(data.config);
          }
        }
      } catch (err) {
        console.warn('Could not fetch Zoho config:', err.message);
      }
    };
    fetchZohoConfig();
    return () => { isMounted = false; };
  }, []);

  const handleTestZoho = async () => {
    setIsTestingZoho(true);
    setZohoTestResult(null);
    try {
      const res = await fetch('/api/zoho/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        setZohoTestResult({ success: true, message: `Connected & Verified: ${data.organization?.name || 'Zoho Books Org'}` });
      } else {
        setZohoTestResult({ success: false, message: data.message || 'Connection test failed' });
      }
    } catch (err) {
      setZohoTestResult({ success: false, message: err.message });
    } finally {
      setIsTestingZoho(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    const cleanName = String(profile.name || '').trim();
    if (!cleanName) return;
    setBusy(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          email: String(profile.email || '').trim(),
          phone: String(profile.phone || '').trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('controlroom_logged_user_name', cleanName);
        localStorage.setItem('vrm_user_name', cleanName);
        localStorage.setItem('businz_user_name', cleanName);
        if (profile.email) localStorage.setItem('controlroom_logged_user_email', String(profile.email).trim());
        if (profile.phone) localStorage.setItem('controlroom_logged_user_phone', String(profile.phone).trim());

        const empId = (localStorage.getItem('controlroom_logged_emp_id') || '').trim().toUpperCase();
        const userEmail = (localStorage.getItem('controlroom_logged_user') || '').trim().toLowerCase();
        try {
          ['controlroom_employees_list', 'controlroom_employees_store'].forEach(key => {
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(list)) {
              const updated = list.map(emp => {
                if (!emp) return emp;
                const codeMatch = empId && (String(emp.employee_code || emp.code || '').trim().toUpperCase() === empId);
                const emailMatch = userEmail && (String(emp.email || '').trim().toLowerCase() === userEmail);
                if (codeMatch || emailMatch) {
                  return { ...emp, employee_name: cleanName, name: cleanName };
                }
                return emp;
              });
              localStorage.setItem(key, JSON.stringify(updated));
            }
          });
        } catch (_) {}

        // Notify Header, Dashboards, and all views immediately of the updated name
        window.dispatchEvent(new CustomEvent('businz_user_updated', {
          detail: { name: cleanName, email: profile.email, phone: profile.phone }
        }));
        window.dispatchEvent(new CustomEvent('controlroom_storage_update', {
          detail: { key: 'controlroom_logged_user_name', value: cleanName }
        }));

        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3500);
      } else {
        alert(data.error || 'Failed to update profile on server.');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      localStorage.setItem('controlroom_logged_user_name', cleanName);
      localStorage.setItem('vrm_user_name', cleanName);
      localStorage.setItem('businz_user_name', cleanName);
      window.dispatchEvent(new CustomEvent('businz_user_updated', {
        detail: { name: cleanName, email: profile.email, phone: profile.phone }
      }));
      window.dispatchEvent(new CustomEvent('controlroom_storage_update', {
        detail: { key: 'controlroom_logged_user_name', value: cleanName }
      }));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveWorkspace = (e) => {
    e?.preventDefault();
    if (!isTA) return;
    setBusy(true);
    try {
      localStorage.setItem('businz_workspace_settings', JSON.stringify(workspace));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } finally {
      setBusy(false);
    }
  };

  const handleResetProfile = () => {
    setProfile({
      name: storedName,
      empCode: storedEmpCode,
      email: storedEmail,
      role: userRole || 'Technical Administrator',
      phone: '+91 98765 43210',
      department: 'Operations & Engineering'
    });
  };

  const navItems = [
    { key: 'general', label: 'Personal Profile', icon: User },
    { key: 'workspace', label: 'Workspace Details', icon: Building2 },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'privacy', label: 'Privacy & Security', icon: KeyRound },
    { key: 'integrations', label: 'Integrations Hub', icon: Link2, badge: '5 Active' },
    { key: 'tracking', label: 'Order Tracking', icon: Truck },
    { key: 'billing', label: 'Subscription & License', icon: CreditCard }
  ];

  const currentTabLabel = navItems.find(n => n.key === activeTab)?.label || 'Settings';

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#0F172A',
      boxSizing: 'border-box'
    }}>
      {/* 1. Breadcrumb, Header & Action Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: '#94A3B8',
            fontWeight: '600',
            marginBottom: '4px'
          }}>
            <span>BUSINZ</span>
            <span>/</span>
            <span style={{ color: '#0E7490', fontWeight: '700' }}>Settings</span>
            <span>/</span>
            <span>{currentTabLabel}</span>
          </div>
          <h1 style={{
            fontSize: '22px',
            fontWeight: '800',
            color: '#0F172A',
            margin: 0,
            letterSpacing: '-0.02em'
          }}>
            Account & Workspace Settings
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {savedSuccess && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#F0FDF4',
              border: '1px solid #BBF7D0',
              color: '#166534',
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              <CheckCircle size={15} color="#16A34A" /> Settings saved successfully
            </div>
          )}

          {activeTab === 'general' && (
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={busy}
              style={{
                padding: '8px 18px',
                backgroundColor: '#0E7490',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(14, 116, 144, 0.25)'
              }}
            >
              <Save size={14} /> Save Profile Changes
            </button>
          )}

          {activeTab === 'workspace' && isTA && (
            <button
              type="button"
              onClick={handleSaveWorkspace}
              disabled={busy}
              style={{
                padding: '8px 18px',
                backgroundColor: '#0E7490',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(14, 116, 144, 0.25)'
              }}
            >
              <Save size={14} /> Save Workspace Changes
            </button>
          )}
        </div>
      </div>

      {/* 2. Main 2-Column Full-Width Enterprise Grid Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px minmax(0, 1fr)',
        gap: '20px',
        alignItems: 'start',
        width: '100%'
      }}>

        {/* ========================================================= */}
        {/* COLUMN 1: LEFT NAVIGATION MENU & USER IDENTITY */}
        {/* ========================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* User Mini Profile Card */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '12px 14px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#0E7490',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
              fontWeight: '800',
              flexShrink: 0
            }}>
              {(profile.name || 'A').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile.name}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile.role}
              </div>
            </div>
            <span style={{
              fontSize: '10px',
              fontWeight: '700',
              fontFamily: 'monospace',
              backgroundColor: '#F1F5F9',
              color: '#475569',
              padding: '2px 6px',
              borderRadius: '6px',
              flexShrink: 0
            }}>
              {profile.empCode}
            </span>
          </div>

          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '12px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{
              padding: '6px 12px 10px 12px',
              fontSize: '11px',
              fontWeight: '800',
              color: '#94A3B8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Settings Menu
            </div>

            {navItems.map(tab => {
              const isActive = activeTab === tab.key;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setActiveIntegrationSubView(null);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    fontSize: '12.5px',
                    fontWeight: isActive ? '700' : '600',
                    color: isActive ? '#FFFFFF' : '#475569',
                    backgroundColor: isActive ? '#0E7490' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <TabIcon size={16} color={isActive ? '#FFFFFF' : '#64748B'} />
                    <span>{tab.label}</span>
                  </div>
                  {isActive ? (
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#FFFFFF' }} />
                  ) : tab.badge ? (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      backgroundColor: '#ECFDF5',
                      color: '#059669',
                      padding: '2px 6px',
                      borderRadius: '6px'
                    }}>
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>


        {/* ========================================================= */}
        {/* COLUMN 2: FULL-WIDTH EXECUTIVE SETTINGS CONTENT PANE */}
        {/* ========================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, width: '100%' }}>

          {/* Executive Header Banner Card */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '20px 24px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                backgroundColor: '#0E7490',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: '800',
                boxShadow: '0 4px 12px rgba(14, 116, 144, 0.25)',
                flexShrink: 0
              }}>
                {(profile.name || 'A').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    {profile.name}
                  </h2>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#0E7490',
                    backgroundColor: '#ECFEFF',
                    border: '1px solid #CFFAFE',
                    padding: '2px 10px',
                    borderRadius: '999px'
                  }}>
                    {profile.role}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Employee Code: <strong style={{ color: '#0F172A' }}>{profile.empCode}</strong></span>
                  <span>•</span>
                  <span>{profile.department}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                fontSize: '11.5px',
                fontWeight: '700',
                color: '#475569',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                padding: '6px 14px',
                borderRadius: '8px'
              }}>
                {isTA ? 'Full System Scope' : 'Standard User Scope'}
              </span>
            </div>
          </div>

          {/* TAB 1: PERSONAL PROFILE */}
          {activeTab === 'general' && (
            <>
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '24px',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                      Personal Information
                    </h3>
                    <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0' }}>
                      Manage your profile display details and official contact channels.
                    </p>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#0E7490',
                    backgroundColor: '#ECFEFF',
                    padding: '3px 10px',
                    borderRadius: '8px'
                  }}>
                    Editable
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#0F172A',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                      Official Email Address
                    </label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        color: '#0F172A',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                      Contact Number
                    </label>
                    <input
                      type="text"
                      value={profile.phone}
                      onChange={(e) => setProfile(p => ({ ...p, phone: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        color: '#0F172A',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                        Assigned Department
                      </label>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Lock size={12} color="#94A3B8" /> Read-Only
                      </span>
                    </div>
                    <input
                      type="text"
                      value={profile.department || 'Operations & Engineering'}
                      readOnly
                      disabled
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: '1px solid #E2E8F0',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#64748B',
                        backgroundColor: '#F8FAFC',
                        cursor: 'not-allowed',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Organization Credentials Box */}
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '20px 24px',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                      System Credentials & Identity
                    </h3>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0' }}>
                      Managed securely by organizational authorization.
                    </p>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8' }}>Read-Only</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{
                    padding: '12px 14px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>Employee Code</div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', fontFamily: 'monospace', marginTop: '2px' }}>
                        {profile.empCode || 'TA-001'}
                      </div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '700', backgroundColor: '#E2E8F0', color: '#475569', padding: '2px 8px', borderRadius: '6px' }}>
                      Internal
                    </span>
                  </div>

                  <div style={{
                    padding: '12px 14px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>Assigned Access Role</div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#0E7490', marginTop: '2px' }}>
                        {profile.role}
                      </div>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: '700', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '2px 8px', borderRadius: '6px' }}>
                      Superadmin
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Unsaved changes will be discarded on navigation.
                </span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleResetProfile}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'transparent',
                      color: '#64748B',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={busy}
                    style={{
                      padding: '8px 20px',
                      backgroundColor: '#0E7490',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Save size={14} /> Save Profile Changes
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: WORKSPACE DETAILS (TA ONLY LOCK) */}
          {activeTab === 'workspace' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}>
              <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    Organization Identity & Workspace Details
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0' }}>
                    Legal company identity, enterprise timezone, and system formatting.
                  </p>
                </div>
                {isTA ? (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#0E7490',
                    backgroundColor: '#ECFEFF',
                    padding: '3px 10px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <ShieldCheck size={13} /> TA Full Edit Access
                  </span>
                ) : (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#991B1B',
                    backgroundColor: '#FEF2F2',
                    padding: '3px 10px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Lock size={13} /> Locked (TA Only)
                  </span>
                )}
              </div>

              {!isTA && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '12.5px',
                  color: '#92400E',
                  fontWeight: '600'
                }}>
                  <Lock size={16} color="#D97706" />
                  <span>Workspace details are locked. Only the Technical Administrator (TA) can modify and save these enterprise settings.</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                    Workspace / Legal Name
                  </label>
                  <input
                    type="text"
                    disabled={!isTA}
                    value={workspace.name}
                    onChange={(e) => setWorkspace(w => ({ ...w, name: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: isTA ? '#0F172A' : '#64748B',
                      backgroundColor: isTA ? '#FFFFFF' : '#F8FAFC',
                      boxSizing: 'border-box',
                      cursor: isTA ? 'text' : 'not-allowed'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                    Industry Sector
                  </label>
                  <input
                    type="text"
                    disabled={!isTA}
                    value={workspace.industry}
                    onChange={(e) => setWorkspace(w => ({ ...w, industry: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      color: isTA ? '#0F172A' : '#64748B',
                      backgroundColor: isTA ? '#FFFFFF' : '#F8FAFC',
                      boxSizing: 'border-box',
                      cursor: isTA ? 'text' : 'not-allowed'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                      Timezone
                    </label>
                    <input
                      type="text"
                      disabled={!isTA}
                      value={workspace.timezone}
                      onChange={(e) => setWorkspace(w => ({ ...w, timezone: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        color: isTA ? '#0F172A' : '#64748B',
                        backgroundColor: isTA ? '#FFFFFF' : '#F8FAFC',
                        boxSizing: 'border-box',
                        cursor: isTA ? 'text' : 'not-allowed'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                      Language
                    </label>
                    <input
                      type="text"
                      disabled={!isTA}
                      value={workspace.language}
                      onChange={(e) => setWorkspace(w => ({ ...w, language: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        color: isTA ? '#0F172A' : '#64748B',
                        backgroundColor: isTA ? '#FFFFFF' : '#F8FAFC',
                        boxSizing: 'border-box',
                        cursor: isTA ? 'text' : 'not-allowed'
                      }}
                    />
                  </div>
                </div>

                {isTA && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={handleSaveWorkspace}
                      disabled={busy}
                      style={{
                        padding: '8px 20px',
                        backgroundColor: '#0E7490',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Save size={14} /> Save Workspace Settings
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Operational Notification Channels
                </h3>
                <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0' }}>
                  Choose where and how you receive alerts for new orders and approvals.
                </p>
              </div>

              {[
                { key: 'emailNewLead', title: 'New Order / Assignment Alerts', desc: 'Email when a new order, BOM, or lead is assigned to you' },
                { key: 'emailSlaBreach', title: 'Overdue SLA & Approvals Warning', desc: 'Alert when critical operational touchpoint SLA is breached' },
                { key: 'whatsappAlerts', title: 'WhatsApp Push Notifications', desc: 'Real-time alert messages via WhatsApp Gateway' },
                { key: 'dailyDigest', title: 'Daily Morning Digest', desc: 'Summary of scheduled production orders and active dispatches' }
              ].map(item => (
                <div key={item.key} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 14px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{item.title}</div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>{item.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifs[item.key]}
                    onChange={(e) => setNotifs(n => ({ ...n, [item.key]: e.target.checked }))}
                    style={{ width: '18px', height: '18px', accentColor: '#0E7490', cursor: 'pointer' }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: PRIVACY & SECURITY */}
          {activeTab === 'privacy' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Security & Authentication Protocols
                </h3>
                <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0' }}>
                  Update credentials and maintain account security.
                </p>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Current Password
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={passwordState.currentPassword}
                  onChange={(e) => setPasswordState(p => ({ ...p, currentPassword: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={passwordState.newPassword}
                    onChange={(e) => setPasswordState(p => ({ ...p, newPassword: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={passwordState.confirmPassword}
                    onChange={(e) => setPasswordState(p => ({ ...p, confirmPassword: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: INTEGRATIONS HUB (ALL INTEGRATIONS BROUGHT DIRECTLY HERE) */}
          {activeTab === 'integrations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {activeIntegrationSubView === 'indiamart' ? (
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <button
                    type="button"
                    onClick={() => setActiveIntegrationSubView(null)}
                    style={{
                      alignSelf: 'flex-start',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '7px 14px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      color: '#0E7490',
                      cursor: 'pointer'
                    }}
                  >
                    <ArrowLeft size={15} /> Back to All Integrations
                  </button>
                  <IndiaMartSettingsView userRole={userRole} />
                </div>
              ) : (
                <div style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  padding: '24px',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px'
                }}>
                  <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                        Omnichannel & ERP Integrations Hub
                      </h3>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#059669',
                        backgroundColor: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        padding: '3px 10px',
                        borderRadius: '12px'
                      }}>
                        All Systems Active
                      </span>
                    </div>
                    <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0' }}>
                      Manage live ERP, WhatsApp messaging, IndiaMART leads, and support pipelines directly here.
                    </p>
                  </div>

                  {zohoTestResult && (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: zohoTestResult.success ? '#F0FDF4' : '#FEF2F2',
                      border: `1px solid ${zohoTestResult.success ? '#BBF7D0' : '#FECACA'}`,
                      color: zohoTestResult.success ? '#166534' : '#991B1B',
                      fontSize: '12px',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {zohoTestResult.success ? <CheckCircle2 size={16} color="#16A34A" /> : <AlertCircle size={16} color="#DC2626" />}
                      <span>{zohoTestResult.message}</span>
                    </div>
                  )}

                  {/* 1. Zoho Books ERP */}
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ECFEFF', border: '1px solid #CFFAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Sliders size={18} color="#0E7490" />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                            Zoho Books ERP Integration
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                            Accounting & Procurement • Sequential PO Numbers (PO-000XX)
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#059669', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 10px', borderRadius: '12px' }}>
                        Synchronized
                      </span>
                    </div>

                    <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                      Official purchase order numbering sequence (PO-000XX), vendor catalog syncing, and dual disk/cloud persistence.
                    </p>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '8px',
                      padding: '10px 12px',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '11.5px'
                    }}>
                      <div>
                        <span style={{ color: '#94A3B8', display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>Company</span>
                        <span style={{ fontWeight: '700', color: '#0F172A' }}>{zohoConfig?.companyName || 'VRM Structures'}</span>
                      </div>
                      <div>
                        <span style={{ color: '#94A3B8', display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>Org ID</span>
                        <span style={{ fontWeight: '700', color: '#0F172A', fontFamily: 'monospace' }}>{zohoConfig?.orgId || '60082137608'}</span>
                      </div>
                      <div>
                        <span style={{ color: '#94A3B8', display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>Numbering Format</span>
                        <span style={{ fontWeight: '700', color: '#0E7490', fontFamily: 'monospace' }}>PO-000XX</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={handleTestZoho}
                        disabled={isTestingZoho}
                        style={{
                          padding: '7px 14px',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#334155',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <RefreshCw size={13} className={isTestingZoho ? 'animate-spin' : ''} />
                        {isTestingZoho ? 'Testing...' : 'Test Connection'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsZohoModalOpen(true)}
                        style={{
                          padding: '7px 14px',
                          backgroundColor: '#0E7490',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Sliders size={13} /> Configure Zoho API
                      </button>
                    </div>
                  </div>

                  {/* 2. IndiaMART CRM Integration */}
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FFF7ED', border: '1px solid #FFEDD5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Globe size={18} color="#EA580C" />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                            IndiaMART CRM Integration
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                            B2B Lead Ingestion • Real-Time Webhook • Auto Sales Routing
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#059669', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 10px', borderRadius: '12px' }}>
                        Live API Sync
                      </span>
                    </div>

                    <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                      Automated CRM lead ingestion from IndiaMART buyers, push webhook listeners, and automatic rep assignment.
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => setActiveIntegrationSubView('indiamart')}
                        style={{
                          padding: '7px 14px',
                          backgroundColor: '#EA580C',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Globe size={13} /> Manage IndiaMART Keys & Settings
                      </button>
                    </div>
                  </div>

                  {/* 3. WhatsApp Business & Support */}
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <MessageSquare size={18} color="#059669" />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                            WhatsApp Business & Support
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                            Multi-Session QR • Real-Time Chat • Automated Notifications
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#059669', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 10px', borderRadius: '12px' }}>
                        Live Connected
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                      Baileys Multi-Session QR code engine powering real-time chat, customer technical media sharing, and automated order notifications.
                    </p>
                  </div>

                  {/* 4. Official Support Mail */}
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Mail size={18} color="#0284C7" />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                            Official Support Mail (IMAP / SMTP)
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                            Inbound IMAP (993) • Outbound SMTP (465) • SSL/TLS
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#0284C7', backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', padding: '3px 10px', borderRadius: '12px' }}>
                        Connected
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                      Incoming IMAP and outgoing SMTP integration for customer technical queries, quotations, and official support correspondence.
                    </p>
                  </div>

                  {/* 5. Facebook & Meta Suite */}
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Share2 size={18} color="#4F46E5" />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                            Facebook & Meta Support Suite
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                            Meta Lead Ads • Facebook Messenger • Graph API Webhook
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#4F46E5', backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', padding: '3px 10px', borderRadius: '12px' }}>
                        Webhook Ready
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#475569', margin: 0 }}>
                      Facebook Messenger direct customer chats and Meta Lead Ads synchronization with instant response routing.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SUBSCRIPTION */}
          {activeTab === 'billing' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    BUSINZ Enterprise Core
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0' }}>
                    PostgreSQL Authoritative Cloud Backend
                  </p>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#059669',
                  background: '#ECFDF5',
                  padding: '4px 10px',
                  borderRadius: '12px'
                }}>
                  Active License
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.6 }}>
                Directly connected to PostgreSQL authoritative store. Real-time sync, zero egress waste, and unlimited internal organization users enabled.
              </div>
            </div>
          )}

          {/* TAB 7: ORDER TRACKING SETTINGS */}
          {activeTab === 'tracking' && (
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    Live Customer Order Tracking
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0 0' }}>
                    Configure automated customer tracking links, WhatsApp notifications, and customer document permissions.
                  </p>
                </div>
                {trackingSaved && (
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={16} /> Saved!
                  </span>
                )}
              </div>

              {/* Master Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', backgroundColor: '#F8FAFC', borderRadius: '12px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Enable Customer Order Tracking</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Generate secure live tracking links for verified BOM orders.</div>
                </div>
                <input
                  type="checkbox"
                  checked={trackingSettings.is_enabled}
                  onChange={(e) => setTrackingSettings(s => ({ ...s, is_enabled: e.target.checked }))}
                  style={{ accentColor: '#0E7490', width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              {/* Branding & Contacts */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Brand Accent Color
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={trackingSettings.brand_color || '#0E7490'}
                      onChange={(e) => setTrackingSettings(s => ({ ...s, brand_color: e.target.value }))}
                      style={{ width: '36px', height: '36px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={trackingSettings.brand_color || '#0E7490'}
                      onChange={(e) => setTrackingSettings(s => ({ ...s, brand_color: e.target.value }))}
                      style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Customer Support Phone
                  </label>
                  <input
                    type="text"
                    value={trackingSettings.support_phone || ''}
                    onChange={(e) => setTrackingSettings(s => ({ ...s, support_phone: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                    Customer Support Email
                  </label>
                  <input
                    type="email"
                    value={trackingSettings.support_email || ''}
                    onChange={(e) => setTrackingSettings(s => ({ ...s, support_email: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Privacy Toggles */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
                  Customer Visibility & Photo Permissions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { key: 'show_packing_photos', label: 'Display warehouse packing verification photos on tracking portal' },
                    { key: 'show_loading_photos', label: 'Display vehicle bay loading & consignment photos' },
                    { key: 'show_driver_phone', label: 'Allow customer to view assigned delivery driver mobile number' }
                  ].map(item => (
                    <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(trackingSettings[item.key])}
                        onChange={(e) => setTrackingSettings(s => ({ ...s, [item.key]: e.target.checked }))}
                        style={{ accentColor: '#0E7490', width: '16px', height: '16px' }}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Automated WhatsApp Notification Triggers */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
                  Automated Meta WhatsApp Notification Triggers
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                  {[
                    { key: 'auto_whatsapp_dispatch_received', label: '1. Order Received by Dispatch' },
                    { key: 'auto_whatsapp_packing_completed', label: '2. Packing Completed' },
                    { key: 'auto_whatsapp_dispatched', label: '3. Order Dispatched & In Transit' },
                    { key: 'auto_whatsapp_delivered', label: '4. Delivery Completed' }
                  ].map(item => (
                    <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#334155', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(trackingSettings[item.key])}
                        onChange={(e) => setTrackingSettings(s => ({ ...s, [item.key]: e.target.checked }))}
                        style={{ accentColor: '#0E7490', width: '16px', height: '16px' }}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
                <button
                  onClick={handleSaveTrackingSettings}
                  disabled={busy}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Save size={15} />
                  <span>{busy ? 'Saving...' : 'Save Tracking Settings'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Zoho Configuration Modal */}
      {isZohoModalOpen && (
        <ZohoConfigModal
          isOpen={isZohoModalOpen}
          onClose={() => setIsZohoModalOpen(false)}
          initialConfig={zohoConfig}
          onSaved={(newCfg) => setZohoConfig(newCfg)}
        />
      )}
    </div>
  );
}
