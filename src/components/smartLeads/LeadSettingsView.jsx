import React, { useState } from 'react';
import {
  Building2, Globe, Calendar, Clock, Upload, Search, Filter,
  CheckCircle2, AlertTriangle, Layers, ShieldCheck, Bell, Users,
  CreditCard, Link2, Sliders, ChevronDown, Save, Sparkles, Check,
  Laptop, Mail, MessageSquare, Briefcase, Lock, Database
} from 'lucide-react';
import { slApi } from './smartLeadsApi';

export default function LeadSettingsView({ meta, onMetaChange, toast }) {
  const isAdmin = !!meta?.me?.isAdmin;
  const [activeTab, setActiveTab] = useState('workspace');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Existing smart leads configuration states
  const [probs, setProbs] = useState(() => ({ ...meta.stageProbabilities }));
  const [sla, setSla] = useState(() => ({ ...meta.sla }));
  const [newReason, setNewReason] = useState('');
  const [busy, setBusy] = useState('');

  // Workspace settings state (matching reference image)
  const [workspace, setWorkspace] = useState(() => ({
    name: meta?.workspace?.name || 'BUSINZ Industrial Dynamics',
    url: meta?.workspace?.url || 'businz.cloud/app',
    industry: meta?.workspace?.industry || 'Solar & Heavy Industrial Manufacturing',
    description: meta?.workspace?.description || 'Unified enterprise CRM, quotation engine, proforma invoice generation, BOM production tracking, and dispatch control system.',
    weekStartsOn: meta?.workspace?.weekStartsOn || 'Monday',
    language: meta?.workspace?.language || 'English (US)',
    timezone: meta?.workspace?.timezone || 'UTC+05:30 Asia/Kolkata (IST)',
    allowMemberCreation: meta?.workspace?.allowMemberLeadCreation !== false
  }));

  // Notifications preferences state
  const [notifs, setNotifs] = useState({
    emailNewLead: true,
    emailSlaBreach: true,
    whatsappAlerts: true,
    browserPush: false,
    dailyDigest: true
  });

  const save = async (key, value, label) => {
    setBusy(key);
    try {
      await slApi.saveSetting(key, value);
      if (toast) toast(`${label} saved successfully`, 'success');
      onMetaChange();
    } catch (err) {
      if (toast) toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const saveWorkspaceSettings = async () => {
    setBusy('workspace');
    try {
      await slApi.saveSetting('workspace', workspace);
      if (toast) toast('Workspace settings saved successfully', 'success');
      onMetaChange();
    } catch (err) {
      if (toast) toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const addReason = async () => {
    if (!newReason.trim()) return;
    setBusy('reason');
    try {
      await slApi.addLostReason(newReason.trim());
      setNewReason('');
      if (toast) toast('Lost reason added', 'success');
      onMetaChange();
    } catch (err) {
      if (toast) toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const toggleReason = async (r) => {
    try {
      await slApi.toggleLostReason(r.id, !r.is_active);
      onMetaChange();
    } catch (err) {
      if (toast) toast(err.message, 'error');
    }
  };

  const SLA_LABELS = {
    firstResponseHours: 'First response SLA (hours)',
    followupEscalateAfterHours: 'Escalate overdue follow-up after (hours)',
    inactivityDays: 'Flag lead inactive after (days)'
  };

  const tabs = [
    { key: 'general', label: 'General Settings' },
    { key: 'workspace', label: 'Workspace' },
    { key: 'privacy', label: 'Privacy & Security' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'team', label: 'Team members' },
    { key: 'billing', label: 'Billing' },
    { key: 'integrations', label: 'Integrations' }
  ];

  return (
    <div style={{
      maxWidth: '1100px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      fontFamily: 'inherit'
    }}>
      {/* 1. Top Header Area (Matching reference screenshot) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#64748B',
            marginBottom: '4px',
            letterSpacing: '0.02em'
          }}>
            Settings
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#0F172A',
            margin: 0,
            lineHeight: 1.15
          }}>
            Settings
          </h1>
        </div>

        {/* Top Right Quick Controls: Search, Status, Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '0 10px',
            height: '38px',
            width: '240px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            <Search size={15} color="#94A3B8" style={{ marginRight: '8px', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                width: '100%',
                fontSize: '13px',
                color: '#0F172A',
                background: 'transparent'
              }}
            />
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#94A3B8',
              background: '#F1F5F9',
              padding: '2px 6px',
              borderRadius: '4px',
              marginLeft: '6px',
              flexShrink: 0
            }}>
              ⌘ F
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '0 12px',
            height: '38px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#334155',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}>
            <span>Status: {statusFilter}</span>
            <ChevronDown size={14} color="#64748B" style={{ marginLeft: '6px' }} />
          </div>

          <button
            type="button"
            title="Filter"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            <Filter size={15} />
          </button>
        </div>
      </div>

      {/* 2. Sub-navigation Tabs (Underlined SaaS Style) */}
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
                color: isActive ? '#0F172A' : '#64748B',
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid #0F172A' : '2px solid transparent',
                marginBottom: '-1px',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {!isAdmin && (
        <div style={{
          backgroundColor: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '13px',
          color: '#92400E',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={16} />
          <span>Read-only view. Only CEO, Managing Director, and Technical Administrator can save workspace settings.</span>
        </div>
      )}

      {/* 3. Tab Contents with 2-Column Section Layout */}

      {/* TAB: WORKSPACE (Exact visual replica of user's reference image) */}
      {activeTab === 'workspace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Section 1: Workspace Logo */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start',
            paddingBottom: '32px',
            borderBottom: '1px solid #F1F5F9'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <span style={{ color: '#64748B', fontSize: '16px' }}>⊚</span>
                <span>Workspace Logo</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Manage workspace logo and visual identity
              </p>
            </div>

            <div>
              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'inline-flex',
                flexDirection: 'column',
                gap: '14px',
                minWidth: '320px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '16px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: '3px solid #38BDF8',
                      boxSizing: 'border-box'
                    }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                      {workspace.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      Enterprise Production Plan • Created 2025
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isAdmin) {
                        const newName = window.prompt('Update Workspace Display Name:', workspace.name);
                        if (newName && newName.trim()) {
                          setWorkspace(w => ({ ...w, name: newName.trim() }));
                        }
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#334155',
                      cursor: isAdmin ? 'pointer' : 'default',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                  >
                    <Upload size={14} color="#64748B" />
                    Upload
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Workspace Information */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start',
            paddingBottom: '32px',
            borderBottom: '1px solid #F1F5F9'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <span style={{ color: '#64748B', fontSize: '16px' }}>⊚</span>
                <span>Workspace Information</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Edit workspace name, URL and description details
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '580px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Workspace Name
                </label>
                <div style={{ position: 'relative' }}>
                  <Building2 size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={workspace.name}
                    onChange={(e) => setWorkspace(w => ({ ...w, name: e.target.value }))}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 12px 0 38px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13.5px',
                      color: '#0F172A',
                      background: '#FFFFFF',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Workspace URL
                </label>
                <div style={{ position: 'relative' }}>
                  <Globe size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={workspace.url}
                    onChange={(e) => setWorkspace(w => ({ ...w, url: e.target.value }))}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 12px 0 38px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13.5px',
                      color: '#0F172A',
                      background: '#FFFFFF',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Industry
                </label>
                <div style={{ position: 'relative' }}>
                  <Briefcase size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={workspace.industry}
                    onChange={(e) => setWorkspace(w => ({ ...w, industry: e.target.value }))}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 12px 0 38px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13.5px',
                      color: '#0F172A',
                      background: '#FFFFFF',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Description (Optional)
                </label>
                <textarea
                  disabled={!isAdmin}
                  rows={3}
                  value={workspace.description}
                  onChange={(e) => setWorkspace(w => ({ ...w, description: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    color: '#0F172A',
                    background: '#FFFFFF',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Workspace Preferences */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start',
            paddingBottom: '32px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <span style={{ color: '#64748B', fontSize: '16px' }}>⊚</span>
                <span>Workspace Preferences</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Configure default settings and access controls
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '580px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Week Starts On
                </label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <select
                    disabled={!isAdmin}
                    value={workspace.weekStartsOn}
                    onChange={(e) => setWorkspace(w => ({ ...w, weekStartsOn: e.target.value }))}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 12px 0 38px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13.5px',
                      color: '#0F172A',
                      background: '#FFFFFF',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="Monday">Monday</option>
                    <option value="Sunday">Sunday</option>
                    <option value="Saturday">Saturday</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Language*
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '12px', fontSize: '16px' }}>🇮🇳</span>
                  <select
                    disabled={!isAdmin}
                    value={workspace.language}
                    onChange={(e) => setWorkspace(w => ({ ...w, language: e.target.value }))}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 12px 0 38px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13.5px',
                      color: '#0F172A',
                      background: '#FFFFFF',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="English (India)">English (India)</option>
                    <option value="English (US)">English (US)</option>
                    <option value="English (UK)">English (UK)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Time Zone
                </label>
                <div style={{ position: 'relative' }}>
                  <Clock size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                  <select
                    disabled={!isAdmin}
                    value={workspace.timezone}
                    onChange={(e) => setWorkspace(w => ({ ...w, timezone: e.target.value }))}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 12px 0 38px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13.5px',
                      color: '#0F172A',
                      background: '#FFFFFF',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="UTC+05:30 Asia/Kolkata (IST)">UTC+05:30 Asia/Kolkata (IST)</option>
                    <option value="UTC+00:00 UTC (Universal Time)">UTC+00:00 UTC (Universal Time)</option>
                    <option value="UTC+04:00 Asia/Dubai (GST)">UTC+04:00 Asia/Dubai (GST)</option>
                    <option value="UTC-08:00 Pacific Time (US & Canada)">UTC-08:00 Pacific Time (US & Canada)</option>
                  </select>
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '8px'
              }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#0F172A' }}>
                    Allow Members to Create Projects & Leads
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    If disabled, only admins and managers can create new sales leads
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={workspace.allowMemberCreation}
                  onChange={(e) => setWorkspace(w => ({ ...w, allowMemberCreation: e.target.checked }))}
                  style={{
                    width: '18px',
                    height: '18px',
                    accentColor: '#0E7490',
                    cursor: isAdmin ? 'pointer' : 'default'
                  }}
                />
              </div>

              {isAdmin && (
                <div style={{ marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={saveWorkspaceSettings}
                    disabled={busy === 'workspace'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 22px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#0E7490',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: busy === 'workspace' ? 'not-allowed' : 'pointer',
                      opacity: busy === 'workspace' ? 0.7 : 1,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
                    }}
                  >
                    <Save size={15} />
                    {busy === 'workspace' ? 'Saving...' : 'Save Workspace Changes'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: GENERAL SETTINGS (Pipeline Stages & Forecast Weights) */}
      {activeTab === 'general' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start',
            paddingBottom: '32px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <span style={{ color: '#64748B', fontSize: '16px' }}>⊚</span>
                <span>Pipeline Stages & Win Probability</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Used for weighted pipeline forecasting and automatic revenue estimation.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '580px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '16px'
              }}>
                {(meta.stages || []).map(s => (
                  <div key={s}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>
                      {s} (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      disabled={!isAdmin}
                      value={probs[s] ?? ''}
                      onChange={e => setProbs(p => ({ ...p, [s]: e.target.value.replace(/[^\d]/g, '') }))}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        fontSize: '13px',
                        color: '#0F172A',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                ))}
              </div>

              {isAdmin && (
                <div>
                  <button
                    type="button"
                    disabled={busy === 'stageProbabilities'}
                    onClick={() => save('stageProbabilities', Object.fromEntries(Object.entries(probs).map(([k, v]) => [k, Number(v)])), 'Stage Probabilities')}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#0E7490',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Save Probabilities
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: TEAM MEMBERS (Response SLAs & Sales Roster) */}
      {activeTab === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Follow-up SLAs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start',
            paddingBottom: '32px',
            borderBottom: '1px solid #F1F5F9'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <span style={{ color: '#64748B', fontSize: '16px' }}>⊚</span>
                <span>Response & Follow-up SLAs</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Set response thresholds, overdue follow-up escalation triggers, and inactivity reminders.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '580px' }}>
              {Object.keys(SLA_LABELS).map(k => (
                <div key={k}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '4px' }}>
                    {SLA_LABELS[k]}
                  </label>
                  <input
                    type="number"
                    min="1"
                    disabled={!isAdmin}
                    value={sla[k] ?? ''}
                    onChange={e => setSla(p => ({ ...p, [k]: e.target.value.replace(/[^\d.]/g, '') }))}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      color: '#0F172A',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              ))}

              {isAdmin && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    disabled={busy === 'sla'}
                    onClick={() => save('sla', Object.fromEntries(Object.entries(sla).map(([k, v]) => [k, Number(v)])), 'SLA Thresholds')}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#0E7490',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Save SLA Thresholds
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Active Sales Team Roster */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <span style={{ color: '#64748B', fontSize: '16px' }}>⊚</span>
                <span>Active Sales Representatives</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Currently provisioned members receiving inbound lead allocations.
              </p>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              maxWidth: '580px'
            }}>
              {(meta.team || []).map(t => (
                <div
                  key={t.user_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #F1F5F9',
                    background: '#F8FAFC'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#0E7490',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700',
                      fontSize: '12px'
                    }}>
                      {t.name ? t.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{t.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{t.role} · ID: {t.user_id}</div>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#059669',
                    background: '#ECFDF5',
                    padding: '2px 8px',
                    borderRadius: '10px'
                  }}>
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: PRIVACY & SECURITY (Lost Reasons & Scoring Rules) */}
      {activeTab === 'privacy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Lost Reasons */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start',
            paddingBottom: '32px',
            borderBottom: '1px solid #F1F5F9'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <span style={{ color: '#64748B', fontSize: '16px' }}>⊚</span>
                <span>Closed Lost Reasons</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Manage tags when deals do not close to power win/loss analysis.
              </p>
            </div>

            <div style={{ maxWidth: '580px', width: '100%' }}>
              {isAdmin && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <input
                    type="text"
                    placeholder="Add new lost reason..."
                    value={newReason}
                    maxLength={80}
                    onChange={e => setNewReason(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addReason()}
                    style={{
                      flex: 1,
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      color: '#0F172A'
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy === 'reason'}
                    onClick={addReason}
                    style={{
                      padding: '0 16px',
                      height: '38px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#0E7490',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Add
                  </button>
                </div>
              )}

              <div style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {(meta.lostReasons || []).map(r => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: '1px solid #F1F5F9'
                    }}
                  >
                    <span style={{ fontSize: '13px', color: r.is_active ? '#0F172A' : '#94A3B8', fontWeight: '500' }}>
                      {r.label} {!r.is_active && '(disabled)'}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => toggleReason(r)}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          background: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: '600',
                          color: '#475569',
                          cursor: 'pointer'
                        }}
                      >
                        {r.is_active ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scoring Rules */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <span style={{ color: '#64748B', fontSize: '16px' }}>⊚</span>
                <span>Rule-Based Lead Scoring</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Transparent points logic. Lead temperature automatically updates based on these rules.
              </p>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '16px 20px',
              maxWidth: '580px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700', color: '#0F172A', paddingBottom: '8px', borderBottom: '1px solid #F1F5F9' }}>
                <span>Hot / Warm thresholds</span>
                <span>≥ {meta?.scoring?.hotMin || 70} / ≥ {meta?.scoring?.warmMin || 40} pts</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                <span>Recent activity within {meta?.scoring?.recentActivityDays || 7} days</span>
                <span style={{ fontWeight: '700', color: '#059669' }}>+{meta?.scoring?.recentActivityPoints || 15} pts</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                <span>Inactive for {meta?.scoring?.staleDays || 14}+ days</span>
                <span style={{ fontWeight: '700', color: '#DC2626' }}>{meta?.scoring?.stalePenalty || -20} pts</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <span style={{ color: '#64748B', fontSize: '16px' }}>⊚</span>
                <span>Notification Channels</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Choose where you receive instant notifications when leads are assigned or follow-ups are due.
              </p>
            </div>

            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '16px 20px',
              maxWidth: '580px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {[
                { key: 'emailNewLead', title: 'New Inbound Lead Assignment', desc: 'Email when a new lead is assigned to you' },
                { key: 'emailSlaBreach', title: 'Overdue Follow-up SLA Warning', desc: 'Alert when customer touchpoint SLA is breached' },
                { key: 'whatsappAlerts', title: 'WhatsApp Push Notifications', desc: 'Real-time alert messages via WhatsApp Gateway' },
                { key: 'dailyDigest', title: 'Daily Morning Sales Digest', desc: 'Summary of scheduled follow-ups and active deals' }
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

      {/* TAB: BILLING */}
      {activeTab === 'billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <span style={{ color: '#64748B', fontSize: '16px' }}>⊚</span>
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
              padding: '20px',
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

      {/* TAB: INTEGRATIONS */}
      {activeTab === 'integrations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 280px) 1fr',
            gap: '32px',
            alignItems: 'start'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                <span style={{ color: '#64748B', fontSize: '16px' }}>⊚</span>
                <span>Active Integrations</span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', lineHeight: 1.4 }}>
                Connected external APIs and lead ingestion pipelines.
              </p>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxWidth: '580px'
            }}>
              {[
                { name: 'Zoho Books API', desc: 'Sequential PO numbers & double-entry accounting sync', status: 'Connected', color: '#059669', bg: '#ECFDF5' },
                { name: 'IndiaMART Lead Sync', desc: 'Direct webhook ingestion into Smart Leads', status: 'Active', color: '#059669', bg: '#ECFDF5' },
                { name: 'Meta Lead Ads', desc: 'Automated Facebook / Instagram lead capture', status: 'Standby', color: '#2563EB', bg: '#EFF6FF' },
                { name: 'WhatsApp Cloud Gateway', desc: 'Customer dispatch proofs & order tracking updates', status: 'Active', color: '#059669', bg: '#ECFDF5' }
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
    </div>
  );
}
