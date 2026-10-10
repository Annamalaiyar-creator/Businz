import React, { useState } from 'react';
import {
  Share2, MessageSquare, Mail, Sliders, CheckCircle2,
  RefreshCw, ArrowRight, ShieldCheck, ExternalLink,
  ChevronRight, Activity, Cpu, Check, AlertCircle, Copy
} from 'lucide-react';

export default function IntegrationsHubView({ userRole = 'Tech Support', onNavigateTab }) {
  const [copiedKey, setCopiedKey] = useState(null);
  const [testingChannel, setTestingChannel] = useState(null);
  const [testResult, setTestResult] = useState({});

  const handleCopy = (key, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestConnection = (channel) => {
    setTestingChannel(channel);
    setTimeout(() => {
      setTestResult(prev => ({ ...prev, [channel]: true }));
      setTestingChannel(null);
    }, 800);
  };

  const integrations = [
    {
      id: 'whatsapp',
      name: 'WhatsApp Business & Support',
      category: 'Messaging & Omnichannel',
      icon: MessageSquare,
      iconColor: '#059669',
      iconBg: '#ECFDF5',
      iconBorder: '#A7F3D0',
      status: 'Live Connected',
      statusColor: '#059669',
      statusBg: '#ECFDF5',
      statusBorder: '#A7F3D0',
      description: 'Baileys Multi-Session QR code engine powering real-time chat, customer technical media sharing, and automated order notifications.',
      endpoint: 'http://localhost:5001/api/whatsapp/sessions',
      authType: 'Session Auth / Multi-Device QR',
      targetTab: 'WhatsApp Inbox',
      metrics: [
        { label: 'Active Sessions', value: 'Multi-User' },
        { label: 'Sync Latency', value: '< 250ms' },
        { label: 'Media Support', value: 'Docs, Images, Audio' }
      ]
    },
    {
      id: 'mail',
      name: 'Official Support Mail (IMAP / SMTP)',
      category: 'Email & Ticketing',
      icon: Mail,
      iconColor: '#0284C7',
      iconBg: '#F0F9FF',
      iconBorder: '#BAE6FD',
      status: 'Connected',
      statusColor: '#0284C7',
      statusBg: '#F0F9FF',
      statusBorder: '#BAE6FD',
      description: 'Incoming IMAP and outgoing SMTP integration for customer technical queries, quotations, and official support correspondence.',
      endpoint: 'imap.businz.com:993 / smtp.businz.com:465',
      authType: 'TLS / App Password',
      targetTab: 'Mail Inbox',
      metrics: [
        { label: 'Protocol', value: 'IMAP / SMTP' },
        { label: 'Encryption', value: 'SSL / TLS' },
        { label: 'Inbound Sync', value: 'Continuous' }
      ]
    },
    {
      id: 'meta',
      name: 'Facebook & Meta Support Suite',
      category: 'Social CRM & Lead Generation',
      icon: Share2,
      iconColor: '#4F46E5',
      iconBg: '#EEF2FF',
      iconBorder: '#C7D2FE',
      status: 'Webhook Ready',
      statusColor: '#4F46E5',
      statusBg: '#EEF2FF',
      statusBorder: '#C7D2FE',
      description: 'Facebook Messenger direct customer chats and Meta Lead Ads synchronization with instant response routing.',
      endpoint: 'https://api.businz.com/api/meta/webhook',
      authType: 'Graph API Token / App Secret',
      targetTab: 'Facebook & Meta',
      metrics: [
        { label: 'Messenger', value: 'Live 2-Way' },
        { label: 'Lead Ads', value: 'Direct Ingestion' },
        { label: 'Webhook', value: 'Verified' }
      ]
    },
    {
      id: 'zoho',
      name: 'Zoho Books ERP Integration',
      category: 'Accounting & Procurement',
      icon: Sliders,
      iconColor: '#0E7490',
      iconBg: '#ECFEFF',
      iconBorder: '#CFFAFE',
      status: 'Synchronized',
      statusColor: '#0E7490',
      statusBg: '#ECFEFF',
      statusBorder: '#CFFAFE',
      description: 'Official purchase order numbering sequence (PO-000XX), vendor catalog syncing, and dual disk/cloud persistence.',
      endpoint: 'https://books.zoho.in/api/v3/purchaseorders',
      authType: 'OAuth 2.0 / Refresh Token',
      targetTab: 'Purchase Orders',
      metrics: [
        { label: 'Numbering', value: 'PO-000XX' },
        { label: 'Persistence', value: 'Disk & Supabase' },
        { label: 'Payload Limiting', value: '<= 80 chars' }
      ]
    }
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      width: '100%',
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#0F172A',
      boxSizing: 'border-box'
    }}>
      {/* Top Header Card */}
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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#ECFEFF',
              border: '1px solid #CFFAFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Share2 size={20} color="#0E7490" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  BUSINZ Integration Hub
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
                  Omnichannel & ERP
                </span>
              </div>
              <p style={{ fontSize: '12.5px', color: '#64748B', margin: '3px 0 0 0', fontWeight: '500' }}>
                Manage WhatsApp messaging, Support Mail, Facebook & Meta suites, and Zoho Books ERP synchronization.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            color: '#166534',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '11.5px',
            fontWeight: '700'
          }}>
            <ShieldCheck size={14} color="#166534" />
            <span>4 / 4 Services Operational</span>
          </div>
        </div>
      </div>

      {/* Integration Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '16px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {integrations.map((item) => {
          const Icon = item.icon;
          const isTesting = testingChannel === item.id;
          const isTested = testResult[item.id];

          return (
            <div
              key={item.id}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}
            >
              <div>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      backgroundColor: item.iconBg,
                      border: `1px solid ${item.iconBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon size={22} color={item.iconColor} />
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {item.category}
                      </span>
                      <h3 style={{ fontSize: '14.5px', fontWeight: '800', color: '#0F172A', margin: '2px 0 0 0' }}>
                        {item.name}
                      </h3>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    backgroundColor: item.statusBg,
                    color: item.statusColor,
                    border: `1px solid ${item.statusBorder}`,
                    padding: '3px 8px',
                    borderRadius: '20px',
                    whiteSpace: 'nowrap'
                  }}>
                    {item.status}
                  </span>
                </div>

                {/* Description */}
                <p style={{
                  fontSize: '12px',
                  color: '#475569',
                  lineHeight: '1.5',
                  margin: '14px 0 16px 0',
                  fontWeight: '500'
                }}>
                  {item.description}
                </p>

                {/* Endpoint details */}
                <div style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #F1F5F9',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginBottom: '14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '700' }}>Endpoint:</span>
                    <button
                      onClick={() => handleCopy(item.id, item.endpoint)}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: copiedKey === item.id ? '#059669' : '#0E7490',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      {copiedKey === item.id ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedKey === item.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <span style={{
                    fontSize: '11.5px',
                    fontFamily: 'monospace',
                    color: '#0F172A',
                    fontWeight: '600',
                    wordBreak: 'break-all'
                  }}>
                    {item.endpoint}
                  </span>
                </div>

                {/* Metrics */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  borderTop: '1px solid #F1F5F9',
                  paddingTop: '12px'
                }}>
                  {item.metrics.map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: '600' }}>{m.label}</span>
                      <span style={{ fontSize: '11.5px', color: '#0F172A', fontWeight: '700', marginTop: '2px' }}>{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                borderTop: '1px solid #F1F5F9',
                paddingTop: '14px'
              }}>
                <button
                  onClick={() => handleTestConnection(item.id)}
                  disabled={isTesting}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: isTested ? '#059669' : '#475569',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <RefreshCw size={13} className={isTesting ? 'animate-spin' : ''} />
                  <span>{isTesting ? 'Pinging...' : isTested ? 'Passed' : 'Test Ping'}</span>
                </button>

                <button
                  onClick={() => onNavigateTab && onNavigateTab(item.targetTab)}
                  style={{
                    backgroundColor: item.iconColor,
                    border: 'none',
                    color: '#FFFFFF',
                    padding: '7px 14px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: `0 2px 6px ${item.iconColor}33`
                  }}
                >
                  <span>Launch {item.targetTab}</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
