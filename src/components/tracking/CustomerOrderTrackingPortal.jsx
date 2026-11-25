import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  Truck, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Download, 
  Phone, 
  Mail, 
  MessageSquare, 
  Share2, 
  ExternalLink, 
  ChevronRight, 
  ShieldCheck, 
  ArrowLeft, 
  Camera, 
  Star, 
  RefreshCw,
  Copy,
  Check,
  Building2,
  Calendar,
  Layers,
  HelpCircle,
  X
} from 'lucide-react';

export default function CustomerOrderTrackingPortal({ token: propToken }) {
  // Extract token from prop, URL query (?token= or ?track_token=), or full path after /order/ or /track/
  const token = propToken || (() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    const qToken = params.get('token') || params.get('track_token');
    if (qToken) return decodeURIComponent(qToken).trim();

    const pathname = window.location.pathname || '';
    const match = pathname.match(/^\/(?:order|track)\/(.+)$/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]).trim();
    }
    return '';
  })();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'products' | 'documents'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  
  // Modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueType, setIssueType] = useState('MISSING_PRODUCTS');
  const [issueRemarks, setIssueRemarks] = useState('');
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState(false);

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [deliveryRemarks, setDeliveryRemarks] = useState('');
  const [deliverySubmitting, setDeliverySubmitting] = useState(false);
  const [deliverySuccess, setDeliverySuccess] = useState(false);

  const sseRef = useRef(null);

  // Fetch initial tracking data
  const fetchTracking = async () => {
    if (!token) {
      setError({ type: 'NOT_FOUND', message: 'No tracking reference found in URL.' });
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/track?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404) {
          setError({ type: 'NOT_FOUND', message: data.error || 'Invalid or unknown tracking link.' });
        } else if (res.status === 410) {
          setError({ type: 'EXPIRED', message: data.error || 'This tracking link has expired or been revoked.' });
        } else {
          setError({ type: 'ERROR', message: data.error || 'Failed to load order tracking.' });
        }
        setLoading(false);
        return;
      }
      setOrderData(data.order || data.tracking);
      setError(null);
      setLoading(false);
    } catch (err) {
      setError({ type: 'NETWORK_ERROR', message: 'Network connection issue. Please check your internet.' });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
  }, [token]);

  // Real-time SSE Connection
  useEffect(() => {
    if (!token || error) return;

    let reconnectTimer = null;
    const connectSSE = () => {
      try {
        const sse = new EventSource(`/api/track/events?token=${encodeURIComponent(token)}`);
        sseRef.current = sse;

        sse.onopen = () => {
          setIsLiveConnected(true);
        };

        sse.addEventListener('connected', () => {
          setIsLiveConnected(true);
        });

        sse.addEventListener('tracking_update', (event) => {
          try {
            const payload = JSON.parse(event.data);
            // Re-fetch authoritative tracking payload to guarantee full UI sync
            fetchTracking();
          } catch (_) {}
        });

        sse.onerror = () => {
          setIsLiveConnected(false);
          sse.close();
          // Attempt reconnection after 8 seconds
          reconnectTimer = setTimeout(connectSSE, 8000);
        };
      } catch (_) {
        setIsLiveConnected(false);
      }
    };

    connectSSE();

    // Fallback polling every 20 seconds to guarantee fresh data even if SSE drops
    const pollInterval = setInterval(() => {
      fetchTracking();
    }, 20000);

    return () => {
      if (sseRef.current) sseRef.current.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(pollInterval);
    };
  }, [token, error]);

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  };

  // Submit Issue Handler
  const handleReportIssue = async (e) => {
    e.preventDefault();
    if (!issueRemarks.trim()) return;
    setIssueSubmitting(true);
    try {
      const res = await fetch(`/api/track/${token}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueType,
          remarks: issueRemarks,
          customerName: orderData?.customerName,
          customerPhone: orderData?.customerMobile
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIssueSuccess(true);
        setTimeout(() => {
          setShowIssueModal(false);
          setIssueSuccess(false);
          setIssueRemarks('');
        }, 2200);
      } else {
        alert(data.error || 'Failed to submit issue');
      }
    } catch (_) {
      alert('Network error while submitting issue');
    } finally {
      setIssueSubmitting(false);
    }
  };

  // Confirm Delivery Handler
  const handleConfirmDelivery = async (e) => {
    e.preventDefault();
    setDeliverySubmitting(true);
    try {
      const res = await fetch(`/api/track/${token}/confirm-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: orderData?.customerName,
          rating: deliveryRating,
          remarks: deliveryRemarks
        })
      });
      const data = await res.json();
      if (res.ok) {
        setDeliverySuccess(true);
        fetchTracking();
        setTimeout(() => {
          setShowDeliveryModal(false);
          setDeliverySuccess(false);
        }, 2200);
      } else {
        alert(data.error || 'Failed to confirm delivery');
      }
    } catch (_) {
      alert('Network error while confirming delivery');
    } finally {
      setDeliverySubmitting(false);
    }
  };

  // Loading State
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Inter', -apple-system, sans-serif"
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '3px solid #E2E8F0',
          borderTopColor: '#0E7490',
          animation: 'businz_spin 0.8s linear infinite',
          marginBottom: '16px'
        }} />
        <div style={{ fontSize: '15px', fontWeight: 600, color: '#0F172A' }}>
          Loading Your Live Order Tracking...
        </div>
        <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
          Connecting securely to BUSINZ Dispatch
        </div>
        <style>{`
          @keyframes businz_spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Error State
  if (error || !orderData) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'Inter', -apple-system, sans-serif"
      }}>
        <div style={{
          maxWidth: '460px',
          width: '100%',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '36px 28px',
          textAlign: 'center',
          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.06)',
          border: '1px solid #E2E8F0'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: error?.type === 'EXPIRED' ? '#FFFBEB' : '#FEF2F2',
            color: error?.type === 'EXPIRED' ? '#D97706' : '#DC2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
            {error?.type === 'EXPIRED' ? 'Tracking Link Inactive' : 'Order Not Found'}
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', lineHeight: '1.5', marginBottom: '24px' }}>
            {error?.message || 'We could not locate this order tracking reference. Please verify the WhatsApp link received or contact support.'}
          </p>
          <div style={{
            padding: '16px',
            backgroundColor: '#F1F5F9',
            borderRadius: '12px',
            fontSize: '13px',
            color: '#334155',
            textAlign: 'left'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Need help with your order?</div>
            <div>Support Desk: +91 98765 43210</div>
            <div>Email: support@businz.com</div>
          </div>
        </div>
      </div>
    );
  }

  const {
    bomCode,
    piNumber,
    customerName,
    createdAt,
    lastUpdatedAt,
    currentStage,
    packingProgress,
    timeline,
    documents,
    transport,
    shipments,
    companyBranding
  } = orderData;

  const brandColor = companyBranding?.brandColor || '#0E7490';
  const isDelivered = currentStage?.stage === 'DELIVERED';
  const isDispatched = currentStage?.stage === 'DISPATCHED' || isDelivered;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F8FAFC',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#0F172A',
      paddingBottom: '60px'
    }}>
      {/* 1. Header Banner */}
      <header style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '0 2px 4px rgba(15, 23, 42, 0.02)'
      }}>
        <div style={{
          maxWidth: '960px',
          margin: '0 auto',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Brand & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: brandColor,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '18px',
              letterSpacing: '-0.5px'
            }}>
              B
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                  {companyBranding?.companyName || 'BUSINZ Track'}
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 7px',
                  borderRadius: '20px',
                  backgroundColor: isLiveConnected ? '#ECFDF5' : '#FEF3C7',
                  color: isLiveConnected ? '#059669' : '#D97706',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isLiveConnected ? '#10B981' : '#F59E0B',
                    display: 'inline-block'
                  }} />
                  {isLiveConnected ? 'Live Real-Time' : 'Syncing'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>
                Live Customer Order & Dispatch Tracking
              </div>
            </div>
          </div>

          {/* WhatsApp Support Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={`https://wa.me/${(companyBranding?.supportPhone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I am tracking order ${bomCode}. I have a query.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: '#25D366',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              <MessageSquare size={16} />
              <span className="hide-on-mobile">WhatsApp Support</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 20px' }}>
        
        {/* 2. Order Summary Hero Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '24px',
          boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)',
          marginBottom: '20px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            borderBottom: '1px solid #F1F5F9',
            paddingBottom: '20px'
          }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Order Reference
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px' }}>
                  {bomCode}
                </span>
                <button
                  onClick={() => copyToClipboard(bomCode, 'BOM')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Copy Order Reference"
                >
                  {copiedText === 'BOM' ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                </button>
              </div>
              <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
                Customer: <strong style={{ color: '#0F172A' }}>{customerName}</strong>
                {piNumber && piNumber !== 'N/A' && (
                  <span style={{ marginLeft: '8px' }}>• PI: <strong>{piNumber}</strong></span>
                )}
              </div>
            </div>

            {/* Current Stage Status Pill */}
            <div style={{ textAlign: 'right' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '30px',
                backgroundColor: isDelivered ? '#ECFDF5' : (isDispatched ? '#EFF6FF' : '#F0FDFA'),
                color: isDelivered ? '#059669' : (isDispatched ? '#2563EB' : brandColor),
                fontWeight: 700,
                fontSize: '13px'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isDelivered ? '#10B981' : (isDispatched ? '#3B82F6' : brandColor)
                }} />
                {currentStage?.label || 'Processing'}
              </div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>
                Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recently'}
              </div>
            </div>
          </div>

          {/* Quick Metrics Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            marginTop: '20px'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Packing Progress</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                {packingProgress?.percentage || 0}% Completed
              </div>
              <div style={{
                width: '100%',
                height: '6px',
                backgroundColor: '#F1F5F9',
                borderRadius: '6px',
                overflow: 'hidden',
                marginTop: '6px'
              }}>
                <div style={{
                  width: `${packingProgress?.percentage || 0}%`,
                  height: '100%',
                  backgroundColor: packingProgress?.percentage === 100 ? '#10B981' : brandColor,
                  borderRadius: '6px',
                  transition: 'width 0.5s ease'
                }} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Packed Products</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                {packingProgress?.packedLines || 0} of {packingProgress?.totalLines || 0} Lines
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                {packingProgress?.pendingLines || 0} lines pending packing
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Carrier / Transport</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {transport?.transporterName || 'Pending Assignment'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                LR: {transport?.lrNumber || 'Awaiting Carrier'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>Destination Vehicle</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                {transport?.vehicleNumber || 'Awaiting Loading'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                Mode: {transport?.transportMode || 'Road'}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #E2E8F0',
          marginBottom: '20px'
        }}>
          {[
            { id: 'overview', label: 'Overview & Status', icon: Truck },
            { id: 'products', label: `Products (${packingProgress?.totalLines || 0})`, icon: Package },
            { id: 'documents', label: `Documents (${documents?.length || 0})`, icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 18px',
                  fontSize: '14px',
                  fontWeight: isSel ? 700 : 500,
                  color: isSel ? brandColor : '#64748B',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: isSel ? `3px solid ${brandColor}` : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 4. Tab Content: OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* 10-Stage Vertical Timeline */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '24px',
              boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.02)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px'
              }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Order Tracking Timeline
                </h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  10 Standard Verified Stages
                </span>
              </div>

              <div style={{ position: 'relative', paddingLeft: '8px' }}>
                {timeline && timeline.map((stageItem, idx) => {
                  const isCompleted = stageItem.state === 'COMPLETED';
                  const isCurrent = stageItem.state === 'CURRENT';
                  const isPending = stageItem.state === 'PENDING';
                  const isLast = idx === timeline.length - 1;

                  return (
                    <div key={stageItem.stageId} style={{ display: 'flex', gap: '16px', position: 'relative', minHeight: '64px' }}>
                      {/* Vertical line connecting stages */}
                      {!isLast && (
                        <div style={{
                          position: 'absolute',
                          left: '15px',
                          top: '28px',
                          bottom: '-8px',
                          width: '2px',
                          backgroundColor: isCompleted ? '#10B981' : '#E2E8F0'
                        }} />
                      )}

                      {/* Icon Indicator */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isCompleted ? '#ECFDF5' : (isCurrent ? '#F0FDFA' : '#F1F5F9'),
                        color: isCompleted ? '#059669' : (isCurrent ? brandColor : '#94A3B8'),
                        border: isCurrent ? `2px solid ${brandColor}` : 'none',
                        zIndex: 2,
                        flexShrink: 0
                      }}>
                        {isCompleted ? (
                          <CheckCircle2 size={18} />
                        ) : isCurrent ? (
                          <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: brandColor
                          }} />
                        ) : (
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#CBD5E1'
                          }} />
                        )}
                      </div>

                      {/* Stage Details */}
                      <div style={{ flex: 1, paddingBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                          <span style={{
                            fontSize: '14px',
                            fontWeight: isCurrent || isCompleted ? 700 : 500,
                            color: isCurrent ? brandColor : (isCompleted ? '#0F172A' : '#64748B')
                          }}>
                            {stageItem.label}
                          </span>
                          {stageItem.timestamp && (
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                              {new Date(stageItem.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                          {stageItem.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Transport Details & Customer Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Transport Card */}
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '24px',
                boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.02)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Truck size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                      Logistics & Transportation
                    </h3>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>
                      Carrier & vehicle tracking details
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>Transporter</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                      {transport?.transporterName || 'Pending'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>Vehicle Number</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', letterSpacing: '0.5px' }}>
                      {transport?.vehicleNumber || 'Awaiting Loading'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>LR (Consignment) No</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                        {transport?.lrNumber || 'Awaiting Dispatch'}
                      </span>
                      {transport?.lrNumber && transport?.lrNumber !== 'Awaiting Carrier Dispatch' && (
                        <button
                          onClick={() => copyToClipboard(transport.lrNumber, 'LR')}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: '2px' }}
                        >
                          {copiedText === 'LR' ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {transport?.driverPhone && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#64748B' }}>Driver Phone</span>
                      <a href={`tel:${transport.driverPhone}`} style={{ fontSize: '13px', fontWeight: 600, color: brandColor, textDecoration: 'none' }}>
                        {transport.driverPhone}
                      </a>
                    </div>
                  )}

                  {transport?.packagesCount && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#64748B' }}>Packages / Bundles</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                        {transport.packagesCount} Packages • {transport.bundlesCount || 0} Bundles
                      </span>
                    </div>
                  )}
                </div>

                {/* Customer Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button
                    onClick={() => setShowDeliveryModal(true)}
                    style={{
                      flex: 1,
                      padding: '12px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#ECFDF5',
                      color: '#059669',
                      border: '1px solid #A7F3D0',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <CheckCircle2 size={16} />
                    Confirm Delivery
                  </button>

                  <button
                    onClick={() => setShowIssueModal(true)}
                    style={{
                      flex: 1,
                      padding: '12px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#FFFBEB',
                      color: '#D97706',
                      border: '1px solid #FDE68A',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <AlertCircle size={16} />
                    Report an Issue
                  </button>
                </div>
              </div>

              {/* Dedicated Support Card */}
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '20px',
                boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.02)'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: '0 0 12px 0' }}>
                  Customer Care & Assistance
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <a
                    href={`tel:${companyBranding?.supportPhone || '+919876543210'}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      backgroundColor: '#F8FAFC',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      color: '#0F172A',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    <Phone size={16} color={brandColor} />
                    <span>Call Helpline: {companyBranding?.supportPhone || '+91 98765 43210'}</span>
                  </a>

                  <a
                    href={`mailto:${companyBranding?.supportEmail || 'support@businz.com'}?subject=Tracking Query: ${bomCode}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 14px',
                      backgroundColor: '#F8FAFC',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      color: '#0F172A',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    <Mail size={16} color={brandColor} />
                    <span>Email: {companyBranding?.supportEmail || 'support@businz.com'}</span>
                  </a>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* 5. Tab Content: PRODUCTS (Real-Time Product Packing Progress) */}
        {activeTab === 'products' && (
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.02)'
          }}>
            {/* Header with Overall Progress */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              borderBottom: '1px solid #F1F5F9',
              paddingBottom: '20px',
              marginBottom: '20px'
            }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Itemized Packing Progress
                </h3>
                <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                  {packingProgress?.summaryText || '0% Packing Completed'}
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color: packingProgress?.percentage === 100 ? '#059669' : brandColor
                }}>
                  {packingProgress?.percentage || 0}%
                </span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '20px',
                  backgroundColor: packingProgress?.percentage === 100 ? '#ECFDF5' : '#F0FDFA',
                  color: packingProgress?.percentage === 100 ? '#059669' : brandColor
                }}>
                  {packingProgress?.percentage === 100 ? 'Fully Packed' : 'Packing in Progress'}
                </span>
              </div>
            </div>

            {/* Product Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {packingProgress?.products && packingProgress.products.map((prod, idx) => {
                const isFullyPacked = prod.isFullyPacked;
                const isPartial = prod.status === 'PARTIALLY_PACKED';
                const percent = prod.orderedQty > 0 ? Math.min(100, Math.round((prod.packedQty / prod.orderedQty) * 100)) : 0;

                return (
                  <div
                    key={prod.code || idx}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '16px',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}>
                      <div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                          {prod.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                          Code: <strong>{prod.code}</strong> • UOM: <strong>{prod.uom}</strong>
                        </div>
                      </div>

                      {/* Status Chip */}
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        backgroundColor: isFullyPacked ? '#ECFDF5' : (isPartial ? '#FEF3C7' : '#F1F5F9'),
                        color: isFullyPacked ? '#059669' : (isPartial ? '#D97706' : '#64748B')
                      }}>
                        {isFullyPacked ? 'Fully Packed' : (isPartial ? 'Partially Packed' : 'Pending')}
                      </span>
                    </div>

                    {/* Progress Fill Bar */}
                    <div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: '#64748B',
                        marginBottom: '6px'
                      }}>
                        <span>Packed: <strong style={{ color: '#0F172A' }}>{prod.packedQty} {prod.uom}</strong> / {prod.orderedQty} {prod.uom}</span>
                        <span>Pending: <strong style={{ color: prod.pendingQty > 0 ? '#DC2626' : '#059669' }}>{prod.pendingQty} {prod.uom}</strong></span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '6px',
                        backgroundColor: '#F1F5F9',
                        borderRadius: '6px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${percent}%`,
                          height: '100%',
                          backgroundColor: isFullyPacked ? '#10B981' : (isPartial ? '#F59E0B' : '#CBD5E1'),
                          borderRadius: '6px',
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. Tab Content: DOCUMENTS (Customer Document Centre) */}
        {activeTab === 'documents' && (
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '24px',
            boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.02)'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Customer Document Centre
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
                Secure access to official commercial and dispatch documentation. Internal cost structures and trade secrets are sanitized.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px'
            }}>
              {documents && documents.map((doc, idx) => {
                const isAvail = doc.available;

                return (
                  <div
                    key={doc.type || idx}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '18px',
                      backgroundColor: '#FFFFFF',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '16px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: isAvail ? '#ECFDF5' : '#F1F5F9',
                          color: isAvail ? '#059669' : '#64748B'
                        }}>
                          {isAvail ? 'Available' : 'Preparing'}
                        </span>
                        {doc.date && (
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                            {new Date(doc.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>
                        {doc.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                        Reference: <strong>{doc.docNumber}</strong>
                      </div>
                    </div>

                    {isAvail ? (
                      <a
                        href={doc.url || `/api/track/${token}/documents/${doc.type.toLowerCase().replace(/_/g, '-')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          backgroundColor: '#0E7490',
                          color: '#FFFFFF',
                          fontSize: '13px',
                          fontWeight: 600,
                          textDecoration: 'none'
                        }}
                      >
                        <Download size={16} />
                        <span>Download / View</span>
                      </a>
                    ) : (
                      <div style={{
                        padding: '10px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '8px',
                        textAlign: 'center',
                        fontSize: '12px',
                        color: '#94A3B8',
                        fontWeight: 500
                      }}>
                        Generated automatically when dispatched
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>

      {/* 7. Modal: Report an Issue */}
      {showIssueModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 100
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.1)',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowIssueModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748B'
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
              Report an Issue with Your Order
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 20px 0' }}>
              Our dispatch and support team will inspect and resolve this immediately.
            </p>

            {issueSuccess ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                backgroundColor: '#ECFDF5',
                borderRadius: '12px',
                color: '#059669'
              }}>
                <CheckCircle2 size={36} style={{ margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 700, fontSize: '16px' }}>Issue Submitted Successfully</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Our operations manager has been alerted.</div>
              </div>
            ) : (
              <form onSubmit={handleReportIssue}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Issue Type
                  </label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '14px',
                      color: '#0F172A',
                      backgroundColor: '#FFFFFF'
                    }}
                  >
                    <option value="MISSING_PRODUCTS">Missing Items / Shortage</option>
                    <option value="DAMAGED_PRODUCTS">Damaged During Transit</option>
                    <option value="INCORRECT_ITEMS">Incorrect Item Specifications</option>
                    <option value="DOCUMENT_DISCREPANCY">Invoice / LR Discrepancy</option>
                    <option value="OTHER">Other Query</option>
                  </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Remarks & Description
                  </label>
                  <textarea
                    rows={4}
                    value={issueRemarks}
                    onChange={(e) => setIssueRemarks(e.target.value)}
                    placeholder="Describe the issue, specific items, or concerns..."
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#475569',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={issueSubmitting}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#0E7490',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {issueSubmitting ? 'Submitting...' : 'Submit Issue'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 8. Modal: Confirm Delivery */}
      {showDeliveryModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 100
        }}>
          <div style={{
            maxWidth: '460px',
            width: '100%',
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.1)',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowDeliveryModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748B'
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0' }}>
              Confirm Delivery Receipt
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 20px 0' }}>
              Confirm that you have received your products in good order.
            </p>

            {deliverySuccess ? (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                backgroundColor: '#ECFDF5',
                borderRadius: '12px',
                color: '#059669'
              }}>
                <CheckCircle2 size={36} style={{ margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 700, fontSize: '16px' }}>Delivery Confirmed!</div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>Thank you for choosing {companyBranding?.companyName}.</div>
              </div>
            ) : (
              <form onSubmit={handleConfirmDelivery}>
                <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '10px' }}>
                    How was your dispatch & delivery experience?
                  </label>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setDeliveryRating(star)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          color: star <= deliveryRating ? '#F59E0B' : '#E2E8F0'
                        }}
                      >
                        <Star size={28} fill={star <= deliveryRating ? '#F59E0B' : 'none'} />
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Feedback or Delivery Note (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={deliveryRemarks}
                    onChange={(e) => setDeliveryRemarks(e.target.value)}
                    placeholder="Received in good condition, unloaded at site..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowDeliveryModal(false)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#475569',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deliverySubmitting}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#059669',
                      color: '#FFFFFF',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {deliverySubmitting ? 'Confirming...' : 'Confirm Received'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Responsive CSS styling helper */}
      <style>{`
        @media (max-width: 640px) {
          .hide-on-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
