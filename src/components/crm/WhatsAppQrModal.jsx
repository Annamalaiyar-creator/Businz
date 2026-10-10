import React, { useState, useEffect } from 'react';
import { 
  QrCode, CheckCircle2, AlertCircle, RefreshCw, X, LogOut, 
  Smartphone, ShieldCheck, Users, ExternalLink, Zap, MessageSquare
} from 'lucide-react';
import { 
  getCleanCurrentUserId, 
  getCurrentSalesRepName, 
  getWhatsAppStatus, 
  connectWhatsApp, 
  disconnectWhatsApp,
  getAllWhatsAppSessions 
} from '../../utils/whatsappDispatchService';

export default function WhatsAppQrModal({ isOpen, onClose, onSessionChanged }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teamSessions, setTeamSessions] = useState([]);
  const [activeTab, setActiveTab] = useState('my_session'); // 'my_session' | 'team_sessions'
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testSuccess, setTestSuccess] = useState('');
  const [testError, setTestError] = useState('');

  const currentUserId = getCleanCurrentUserId();
  const salesRepName = getCurrentSalesRepName();

  // Load session status
  const fetchStatus = async () => {
    try {
      const data = await getWhatsAppStatus(currentUserId);
      setSession(data);
      if (onSessionChanged) onSessionChanged(data);
    } catch (e) {
      console.error('Error fetching WhatsApp status:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load all team sessions
  const fetchTeamSessions = async () => {
    try {
      const data = await getAllWhatsAppSessions();
      if (data?.sessions) {
        setTeamSessions(data.sessions);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetchStatus();
    fetchTeamSessions();

    // Poll every 3 seconds while QR code is waiting
    const interval = setInterval(() => {
      fetchStatus();
      fetchTeamSessions();
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleStartConnect = async () => {
    setRefreshing(true);
    try {
      const res = await connectWhatsApp(currentUserId);
      setSession(res);
      if (onSessionChanged) onSessionChanged(res);
    } catch (err) {
      console.error('Connect failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your WhatsApp account from BUSINZ?')) return;
    setLoading(true);
    try {
      await disconnectWhatsApp(currentUserId);
      await fetchStatus();
      await fetchTeamSessions();
    } catch (err) {
      alert('Failed to disconnect: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestMessage = async (e) => {
    e.preventDefault();
    if (!testPhone) return;
    setTestSending(true);
    setTestSuccess('');
    setTestError('');

    try {
      const cleanPhone = testPhone.replace(/[^0-9]/g, '');
      const res = await fetch('/api/whatsapp/multi/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          to: cleanPhone,
          text: `Hello from BUSINZ!\nThis test message confirms that ${salesRepName}'s WhatsApp is successfully connected to BUSINZ CRM.`
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send test message');
      setTestSuccess(`Test message sent successfully to +${cleanPhone}`);
    } catch (err) {
      setTestError(err.message);
    } finally {
      setTestSending(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = session?.status === 'CONNECTED';
  const hasQr = Boolean(session?.qrCode);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: '#075E54', // WhatsApp Green Header
          padding: '18px 24px',
          color: '#FFFFFF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MessageSquare size={20} color="#FFFFFF" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', letterSpacing: '-0.3px' }}>
                WhatsApp Multi-Number Linking
              </h3>
              <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                Rep: <span style={{ fontWeight: '700' }}>{salesRepName}</span> ({currentUserId})
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#FFFFFF'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #E2E8F0',
          backgroundColor: '#F8FAFC'
        }}>
          <button
            onClick={() => setActiveTab('my_session')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'my_session' ? '3px solid #16A34A' : '3px solid transparent',
              backgroundColor: activeTab === 'my_session' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'my_session' ? '#16A34A' : '#64748B',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Smartphone size={16} /> My WhatsApp Connection
          </button>
          <button
            onClick={() => {
              setActiveTab('team_sessions');
              fetchTeamSessions();
            }}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              borderBottom: activeTab === 'team_sessions' ? '3px solid #16A34A' : '3px solid transparent',
              backgroundColor: activeTab === 'team_sessions' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'team_sessions' ? '#16A34A' : '#64748B',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Users size={16} /> Team Status ({teamSessions.filter(s => s.status === 'CONNECTED').length} Connected)
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'my_session' && (
            <div>
              {/* STATE 1: CONNECTED */}
              {isConnected ? (
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <div style={{
                    width: '68px',
                    height: '68px',
                    borderRadius: '50%',
                    backgroundColor: '#DCFCE7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.2)'
                  }}>
                    <CheckCircle2 size={38} color="#16A34A" />
                  </div>

                  <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
                    WhatsApp Linked Successfully!
                  </h3>
                  <div style={{ fontSize: '14px', color: '#16A34A', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Smartphone size={16} /> +{session?.phoneNumber || 'Registered Phone'}
                  </div>

                  <div style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'left',
                    marginBottom: '20px'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Ready Capabilities for {salesRepName}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#334155', lineHeight: '1.6' }}>
                      <li>Quotations, PIs, and BOMs send directly from <strong>your phone number</strong>.</li>
                      <li>Customers receive official PDFs without you downloading files manually.</li>
                      <li>Incoming customer replies sync live into your BUSINZ CRM inbox.</li>
                    </ul>
                  </div>

                  {/* Send Test Message Box */}
                  <form onSubmit={handleSendTestMessage} style={{
                    backgroundColor: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    borderRadius: '12px',
                    padding: '14px',
                    marginBottom: '20px',
                    textAlign: 'left'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#166534', marginBottom: '8px' }}>
                      Send Quick Verification Test
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Enter phone with country code (e.g. 919876543210)"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '12px'
                        }}
                      />
                      <button
                        type="submit"
                        disabled={testSending || !testPhone}
                        style={{
                          backgroundColor: '#16A34A',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '8px 14px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: testSending ? 'wait' : 'pointer'
                        }}
                      >
                        {testSending ? 'Sending...' : 'Send Test'}
                      </button>
                    </div>
                    {testSuccess && (
                      <div style={{ fontSize: '11px', color: '#15803D', fontWeight: '700', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <CheckCircle2 size={13} /> {testSuccess}
                      </div>
                    )}
                    {testError && (
                      <div style={{ fontSize: '11px', color: '#DC2626', fontWeight: '700', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <AlertCircle size={13} /> {testError}
                      </div>
                    )}
                  </form>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                    <button
                      onClick={handleDisconnect}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        border: '1px solid #FCA5A5',
                        backgroundColor: '#FEF2F2',
                        color: '#DC2626',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <LogOut size={16} /> Disconnect WhatsApp
                    </button>
                    <button
                      onClick={onClose}
                      style={{
                        padding: '10px 24px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#0F172A',
                        color: '#FFFFFF',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* STATE 2: SCAN QR CODE TO CONNECT */
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                      Link Your WhatsApp to BUSINZ
                    </h4>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
                      Scan this QR code with WhatsApp on your phone to link your number.
                    </p>
                  </div>

                  {/* QR Code Container */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    backgroundColor: '#F8FAFC',
                    borderRadius: '16px',
                    border: '2px dashed #CBD5E1',
                    marginBottom: '20px'
                  }}>
                    {hasQr ? (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{
                          padding: '12px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          display: 'inline-block'
                        }}>
                          <img
                            src={session.qrCode}
                            alt="Scan WhatsApp QR"
                            style={{ width: '220px', height: '220px', display: 'block' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '12px', fontSize: '12px', color: '#64748B' }}>
                          <RefreshCw size={13} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
                          <span>Waiting for scan... auto-refreshes if needed</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '24px 16px' }}>
                        {loading || refreshing ? (
                          <div>
                            <RefreshCw size={36} color="#16A34A" style={{ animation: 'spin 1.5s linear infinite', marginBottom: '12px' }} />
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
                              Generating pairing QR code...
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                              Connecting secure session for {salesRepName}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <QrCode size={48} color="#94A3B8" style={{ marginBottom: '12px' }} />
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
                              No active pairing session
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', marginBottom: '16px' }}>
                              Click below to start a secure QR session for your phone number.
                            </div>
                            <button
                              onClick={handleStartConnect}
                              style={{
                                backgroundColor: '#16A34A',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '10px 20px',
                                fontSize: '13px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <QrCode size={15} /> Generate WhatsApp QR Code
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Step-by-step instructions */}
                  <div style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '16px'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginBottom: '10px' }}>
                      HOW TO LINK FROM YOUR PHONE:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: '#334155' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px', flexShrink: 0 }}>1</span>
                        <span>Open <strong>WhatsApp</strong> on your phone.</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px', flexShrink: 0 }}>2</span>
                        <span>Tap <strong>Menu</strong> on Android or <strong>Settings</strong> on iPhone.</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px', flexShrink: 0 }}>3</span>
                        <span>Select <strong>Linked Devices</strong>, then tap <strong>Link a Device</strong>.</span>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '11px', flexShrink: 0 }}>4</span>
                        <span>Point your camera at the QR code above.</span>
                      </div>
                    </div>
                  </div>

                  {hasQr && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                      <button
                        onClick={handleStartConnect}
                        disabled={refreshing}
                        style={{
                          backgroundColor: '#F1F5F9',
                          color: '#475569',
                          border: '1px solid #CBD5E1',
                          borderRadius: '8px',
                          padding: '8px 16px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
                        Refresh QR Code
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'team_sessions' && (
            <div>
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                  Team WhatsApp Accounts
                </h4>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  Overview of all 5-6 sales representatives and their linked phone numbers in BUSINZ.
                </div>
              </div>

              {teamSessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8', fontSize: '13px' }}>
                  No active team sessions found yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {teamSessions.map((s, idx) => {
                    const isUserMe = s.userId === currentUserId;
                    return (
                      <div
                        key={s.userId || idx}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '10px',
                          border: isUserMe ? '2px solid #16A34A' : '1px solid #E2E8F0',
                          backgroundColor: isUserMe ? '#F0FDF4' : '#FFFFFF',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: '800', fontSize: '13px', color: '#0F172A' }}>
                              {s.userId}
                            </span>
                            {isUserMe && (
                              <span style={{ fontSize: '10px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#16A34A', color: '#FFFFFF' }}>
                                YOU
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                            {s.phoneNumber ? `+${s.phoneNumber}` : 'No phone linked'}
                          </div>
                        </div>

                        <div>
                          {s.status === 'CONNECTED' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800', color: '#16A34A', backgroundColor: '#DCFCE7', padding: '4px 10px', borderRadius: '12px' }}>
                              <CheckCircle2 size={12} /> Connected
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700', color: '#64748B', backgroundColor: '#F1F5F9', padding: '4px 10px', borderRadius: '12px' }}>
                              Disconnected
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
