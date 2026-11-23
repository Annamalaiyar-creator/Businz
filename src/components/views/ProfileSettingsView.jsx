import React, { useState, useEffect } from 'react';
import {
  Building2, Globe, Calendar, Clock, Upload, Search, Filter,
  CheckCircle2, AlertTriangle, Layers, ShieldCheck, Bell, Users,
  CreditCard, Link2, Sliders, ChevronDown, Save, Sparkles, Check,
  Laptop, Mail, MessageSquare, Briefcase, Lock, Database, ArrowRight,
  User, KeyRound, Shield, CheckCircle
} from 'lucide-react';

export default function ProfileSettingsView({ userRole, onNavigateTab }) {
  const [activeTab, setActiveTab] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  // Read stored user profile details
  const storedEmpCode = localStorage.getItem('controlroom_logged_emp_id') || localStorage.getItem('controlroom_logged_user_emp_code') || '';
  const storedName = localStorage.getItem('controlroom_logged_user_name') || userRole || 'User';
  const storedEmail = localStorage.getItem('controlroom_logged_user_email') || localStorage.getItem('controlroom_logged_user') || (storedEmpCode ? `${storedEmpCode.toLowerCase()}@businz.com` : 'user@businz.com');

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

  const handleSaveProfile = (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      localStorage.setItem('controlroom_logged_user_name', profile.name);
      localStorage.setItem('vrm_user_name', profile.name);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveWorkspace = (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      localStorage.setItem('businz_workspace_settings', JSON.stringify(workspace));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setBusy(false);
    }
  };

  const tabs = [
    { key: 'general', label: 'General & Profile', icon: User },
    { key: 'workspace', label: 'Workspace Details', icon: Building2 },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'privacy', label: 'Privacy & Security', icon: ShieldCheck },
    { key: 'integrations', label: 'Integrations Hub', icon: Link2 },
    { key: 'billing', label: 'Subscription & License', icon: CreditCard }
  ];

  return (
    <div style={{
      maxWidth: '1100px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#0F172A',
      boxSizing: 'border-box'
    }}>
      {/* 1. Header Section */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #0E7490 0%, #155E75 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            fontWeight: '800',
            boxShadow: '0 4px 12px rgba(14, 116, 144, 0.25)'
          }}>
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                Profile & Workspace Settings
              </h1>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                backgroundColor: '#ECFEFF',
                color: '#0E7490',
                border: '1px solid #CFFAFE',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                {userRole || 'Active User'}
              </span>
            </div>
            <p style={{ fontSize: '12.5px', color: '#64748B', margin: '3px 0 0 0', fontWeight: '500' }}>
              Manage personal profile details, organization workspace settings, notification preferences, and integrations.
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            color: '#166534',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '700'
          }}>
            <CheckCircle size={15} color="#16A34A" /> Settings saved successfully
          </div>
        )}
      </div>

      {/* 2. Sub-navigation Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        borderBottom: '1px solid #E2E8F0',
        overflowX: 'auto',
        whiteSpace: 'nowrap'
      }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                padding: '12px 2px',
                fontSize: '14px',
                fontWeight: isActive ? '700' : '500',
                color: isActive ? '#0E7490' : '#64748B',
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid #0E7490' : '2px solid transparent',
                marginBottom: '-1px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease'
              }}
            >
              <TabIcon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. TAB: GENERAL & PROFILE */}
      {activeTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start',
            paddingBottom: '28px',
            borderBottom: '1px solid #F1F5F9'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <User size={16} color="#0E7490" />
                <span>Personal Profile</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Your personal details, contact info, and role assignment.
              </p>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '580px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    color: '#0F172A',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                    Employee Code
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profile.empCode}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#F8FAFC',
                      fontSize: '13.5px',
                      color: '#64748B',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                    Role / Position
                  </label>
                  <input
                    type="text"
                    disabled
                    value={profile.role}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#F8FAFC',
                      fontSize: '13.5px',
                      color: '#64748B',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
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
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13.5px',
                    color: '#0F172A',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={busy}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
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
          </div>
        </div>
      )}

      {/* 4. TAB: WORKSPACE DETAILS */}
      {activeTab === 'workspace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start',
            paddingBottom: '28px',
            borderBottom: '1px solid #F1F5F9'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <Building2 size={16} color="#0E7490" />
                <span>Organization Identity</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Company legal name, enterprise branding, and industry classification.
              </p>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '580px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Workspace / Company Name
                </label>
                <input
                  type="text"
                  value={workspace.name}
                  onChange={(e) => setWorkspace(w => ({ ...w, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    color: '#0F172A',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                  Industry Sector
                </label>
                <input
                  type="text"
                  value={workspace.industry}
                  onChange={(e) => setWorkspace(w => ({ ...w, industry: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13.5px',
                    color: '#0F172A',
                    boxSizing: 'border-box'
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
                    value={workspace.timezone}
                    onChange={(e) => setWorkspace(w => ({ ...w, timezone: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      color: '#0F172A',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '6px' }}>
                    Language
                  </label>
                  <input
                    type="text"
                    value={workspace.language}
                    onChange={(e) => setWorkspace(w => ({ ...w, language: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      color: '#0F172A',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={handleSaveWorkspace}
                  disabled={busy}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
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
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <Bell size={16} color="#0E7490" />
                <span>Notification Channels</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Choose where you receive instant notifications when leads are assigned or approvals are pending.
              </p>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '20px',
              maxWidth: '580px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {[
                { key: 'emailNewLead', title: 'New Order / Assignment Alerts', desc: 'Email when a new order or item is assigned to your queue' },
                { key: 'emailSlaBreach', title: 'Overdue SLA & Approvals Warning', desc: 'Alert when critical operational touchpoint SLA is breached' },
                { key: 'whatsappAlerts', title: 'WhatsApp Push Notifications', desc: 'Real-time alert messages via WhatsApp Gateway' },
                { key: 'dailyDigest', title: 'Daily Morning Digest', desc: 'Summary of scheduled production orders and active dispatches' }
              ].map(item => (
                <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid #F8FAFC' }}>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#0F172A' }}>{item.title}</div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{item.desc}</div>
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
          </div>
        </div>
      )}

      {/* 6. TAB: PRIVACY & SECURITY */}
      {activeTab === 'privacy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <KeyRound size={16} color="#0E7490" />
                <span>Security & Credentials</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Password updates, session isolation, and access protection.
              </p>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '580px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
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
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13.5px',
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
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13.5px',
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
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13.5px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '12.5px',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ShieldCheck size={16} color="#059669" />
                <span>Session Security: Multi-device authorization enabled with automatic session locking.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. TAB: INTEGRATIONS */}
      {activeTab === 'integrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <Link2 size={16} color="#0E7490" />
                <span>Connected Integrations</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                External ERP, WhatsApp messaging, and lead pipeline connections.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab && onNavigateTab('Integration Hub')}
                style={{
                  marginTop: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: '#ECFEFF',
                  border: '1px solid #A5F3FC',
                  color: '#0E7490',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Open Full Integrations Hub <ArrowRight size={14} />
              </button>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxWidth: '580px'
            }}>
              {[
                { name: 'Zoho Books ERP', desc: 'Sequential PO numbers (PO-000XX) & dual disk/cloud persistence', status: 'Connected', color: '#059669', bg: '#ECFDF5' },
                { name: 'WhatsApp Business API', desc: 'Multi-device QR session and automated customer notifications', status: 'Active', color: '#059669', bg: '#ECFDF5' },
                { name: 'Official Support Mail', desc: 'Incoming IMAP and outgoing SMTP integration', status: 'Active', color: '#059669', bg: '#ECFDF5' },
                { name: 'Facebook & Meta Suite', desc: 'Meta Lead Ads and Facebook Messenger direct routing', status: 'Webhook Ready', color: '#2563EB', bg: '#EFF6FF' }
              ].map(intg => (
                <div
                  key={intg.name}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    padding: '14px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{intg.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{intg.desc}</div>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: intg.color,
                    background: intg.bg,
                    padding: '3px 10px',
                    borderRadius: '12px'
                  }}>
                    {intg.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 8. TAB: SUBSCRIPTION & BILLING */}
      {activeTab === 'billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <CreditCard size={16} color="#0E7490" />
                <span>Subscription & Deployment</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Active BUSINZ instance tier and cloud database details.
              </p>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '22px',
              maxWidth: '580px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>BUSINZ Enterprise Core</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>PostgreSQL Authoritative Backend • Unlimited Seats</div>
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
              <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                Directly connected to PostgreSQL authoritative store. Real-time sync, zero egress waste, and unlimited internal users enabled.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
