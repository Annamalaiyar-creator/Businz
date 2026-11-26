import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Truck,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  Phone,
  Mail,
  MessageSquare,
  Star,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  X
} from 'lucide-react';

const FIVE_STEPS = [
  { id: 'CONFIRMED', label: 'Confirmed', icon: CheckCircle2 },
  { id: 'PACKED', label: 'Packed', icon: Package },
  { id: 'BILLED', label: 'Billed', icon: FileText },
  { id: 'DISPATCHED', label: 'Dispatched', icon: Truck },
  { id: 'DELIVERED', label: 'Delivered', icon: ShieldCheck }
];

function mapStageToFiveStepIndex(stageCode) {
  switch (String(stageCode || '').toUpperCase()) {
    case 'DELIVERED':
      return 4;
    case 'READY_FOR_LOADING':
    case 'LOADING_IN_PROGRESS':
    case 'DISPATCHED':
      return 3;
    case 'ORDER_VERIFICATION':
    case 'INVOICE_GENERATED':
      return 2;
    case 'PACKING_IN_PROGRESS':
    case 'PACKING_COMPLETED':
      return 1;
    case 'ORDER_CONFIRMED':
    case 'RECEIVED_BY_DISPATCH':
    default:
      return 0;
  }
}

export default function CustomerOrderTrackingPortal({ token: propToken }) {
  const token = propToken || (() => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    const qToken = params.get('token') || params.get('track_token');
    if (qToken) return decodeURIComponent(qToken).trim();
    const pathname = window.location.pathname || '';
    const match = pathname.match(/^\/(?:order|track)\/(.+)$/);
    return match && match[1] ? decodeURIComponent(match[1]).trim() : '';
  })();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  const [showAllStages, setShowAllStages] = useState(false);

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
    } catch (_) {
      setError({ type: 'NETWORK_ERROR', message: 'Network connection issue. Please check your internet.' });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
  }, [token]);

  useEffect(() => {
    if (!token || error) return;
    let reconnectTimer = null;
    const connectSSE = () => {
      try {
        const sse = new EventSource(`/api/track/events?token=${encodeURIComponent(token)}`);
        sseRef.current = sse;
        sse.onopen = () => setIsLiveConnected(true);
        sse.addEventListener('connected', () => setIsLiveConnected(true));
        sse.addEventListener('tracking_update', () => fetchTracking());
        sse.onerror = () => {
          setIsLiveConnected(false);
          sse.close();
          reconnectTimer = setTimeout(connectSSE, 8000);
        };
      } catch (_) {
        setIsLiveConnected(false);
      }
    };
    connectSSE();
    const pollInterval = setInterval(fetchTracking, 20000);
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

  const handleReportIssue = async (e) => {
    e.preventDefault();
    if (!issueRemarks.trim()) return;
    setIssueSubmitting(true);
    try {
      const res = await fetch(`/api/track/${token}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueCategory: issueType,
          issueDescription: issueRemarks,
          contactNumber: orderData?.customerMobile
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIssueSuccess(true);
        setTimeout(() => {
          setShowIssueModal(false);
          setIssueSuccess(false);
          setIssueRemarks('');
        }, 2000);
      } else {
        alert(data.error || 'Failed to submit issue');
      }
    } catch (_) {
      alert('Network error while submitting issue');
    } finally {
      setIssueSubmitting(false);
    }
  };

  const handleConfirmDelivery = async (e) => {
    e.preventDefault();
    setDeliverySubmitting(true);
    try {
      const res = await fetch(`/api/track/${token}/confirm-delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedBy: orderData?.customerName,
          feedbackRating: deliveryRating,
          feedbackNotes: deliveryRemarks
        })
      });
      const data = await res.json();
      if (res.ok) {
        setDeliverySuccess(true);
        fetchTracking();
        setTimeout(() => {
          setShowDeliveryModal(false);
          setDeliverySuccess(false);
        }, 2000);
      } else {
        alert(data.error || 'Failed to confirm delivery');
      }
    } catch (_) {
      alert('Network error while confirming delivery');
    } finally {
      setDeliverySubmitting(false);
    }
  };

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
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          border: '3px solid #E2E8F0',
          borderTopColor: '#0E7490',
          animation: 'businz_spin 0.8s linear infinite',
          marginBottom: '14px'
        }} />
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Loading Order Status...</div>
        <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>Fetching live updates from BUSINZ</div>
        <style>{`@keyframes businz_spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

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
          maxWidth: '440px',
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
            margin: '0 auto 18px'
          }}>
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>
            {error?.type === 'EXPIRED' ? 'Tracking Link Inactive' : 'Order Not Found'}
          </h2>
          <p style={{ fontSize: '14px', color: '#64748B', lineHeight: '1.5', margin: '0 0 20px' }}>
            {error?.message || 'We could not locate this order tracking reference.'}
          </p>
        </div>
      </div>
    );
  }

  const {
    bomCode,
    piNumber,
    customerName,
    lastUpdatedAt,
    currentStage,
    packingProgress,
    timeline = [],
    documents = [],
    transport,
    companyBranding
  } = orderData;

  const brandColor = companyBranding?.brandColor || '#0E7490';
  const isDelivered = currentStage?.stage === 'DELIVERED';
  const isDispatched = currentStage?.stage === 'DISPATCHED' || isDelivered;
  const activeStepIdx = mapStageToFiveStepIndex(currentStage?.stage);
  const progressWidthPct = Math.round((activeStepIdx / (FIVE_STEPS.length - 1)) * 100);
  const visibleTimeline = showAllStages
    ? timeline
    : timeline.filter(s => s.state === 'CURRENT' || s.state === 'COMPLETED').slice(-4);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F1F5F9',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      color: '#0F172A',
      paddingBottom: '48px'
    }}>
      {/* 1. Clean Top Header */}
      <header style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        position: 'sticky',
        top: 0,
        zIndex: 40
      }}>
        <div style={{
          maxWidth: '980px',
          margin: '0 auto',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: brandColor,
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '17px'
            }}>
              B
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
                {companyBranding?.companyName || 'BUSINZ Track'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', fontSize: '12px', color: '#64748B' }}>
                <span style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: isLiveConnected ? '#10B981' : '#94A3B8',
                  display: 'inline-block'
                }} />
                <span>{isLiveConnected ? 'Live order updates' : 'Auto-refreshing'}</span>
              </div>
            </div>
          </div>

          <a
            href={`https://wa.me/${(companyBranding?.supportPhone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I am tracking order ${bomCode}. I have a query.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              backgroundColor: '#25D366',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            <MessageSquare size={15} />
            <span className="hide-on-mobile">WhatsApp Support</span>
          </a>
        </div>
      </header>

      <main style={{ maxWidth: '980px', margin: '0 auto', padding: '22px 16px' }}>
        {/* 2. Hero Card + Modern E-Commerce 5-Step Progress Bar */}
        <section style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid #E2E8F0',
          padding: '24px',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
          marginBottom: '20px'
        }}>
          {/* Top Order Identity Row */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            marginBottom: '24px'
          }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Order Reference
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.5px' }}>
                  {bomCode}
                </span>
                <button
                  onClick={() => copyToClipboard(bomCode, 'BOM')}
                  title="Copy Order Reference"
                  style={{
                    background: '#F1F5F9',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#475569',
                    cursor: 'pointer',
                    padding: '5px',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                >
                  {copiedText === 'BOM' ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                </button>
              </div>
              <div style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                For <strong style={{ color: '#0F172A' }}>{customerName}</strong>
                {piNumber && piNumber !== 'N/A' && <span> • PI: <strong>{piNumber}</strong></span>}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '7px 14px',
                borderRadius: '9999px',
                backgroundColor: isDelivered ? '#ECFDF5' : (isDispatched ? '#EFF6FF' : '#ECFEFF'),
                color: isDelivered ? '#059669' : (isDispatched ? '#1D4ED8' : brandColor),
                fontWeight: 700,
                fontSize: '13px'
              }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isDelivered ? '#10B981' : (isDispatched ? '#2563EB' : brandColor)
                }} />
                {currentStage?.label || 'Processing'}
              </span>
              <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '6px' }}>
                Updated {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'recently'}
              </div>
            </div>
          </div>

          {/* 5-Step Horizontal Stepper */}
          <div style={{ position: 'relative', padding: '8px 0 18px' }}>
            <div style={{
              position: 'absolute',
              top: '26px',
              left: '8%',
              right: '8%',
              height: '4px',
              backgroundColor: '#E2E8F0',
              borderRadius: '9999px',
              zIndex: 1
            }}>
              <div style={{
                width: `${progressWidthPct}%`,
                height: '100%',
                backgroundColor: isDelivered ? '#10B981' : brandColor,
                borderRadius: '9999px',
                transition: 'width 0.4s ease'
              }} />
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              position: 'relative',
              zIndex: 2,
              gap: '6px'
            }}>
              {FIVE_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const done = idx < activeStepIdx || (idx === 4 && isDelivered);
                const current = idx === activeStepIdx && !isDelivered;
                return (
                  <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: done ? '#10B981' : (current ? brandColor : '#FFFFFF'),
                      color: done || current ? '#FFFFFF' : '#94A3B8',
                      border: done || current ? 'none' : '2px solid #CBD5E1',
                      boxShadow: current ? `0 0 0 5px ${brandColor}22` : 'none',
                      transition: 'all 0.2s ease'
                    }}>
                      {done ? <Check size={18} strokeWidth={2.8} /> : <Icon size={17} />}
                    </div>
                    <span style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      fontWeight: current || done ? 700 : 500,
                      color: current ? brandColor : (done ? '#0F172A' : '#94A3B8')
                    }}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Stage Description Banner */}
          <div style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '13px',
            color: '#334155',
            marginBottom: '18px'
          }}>
            <strong style={{ color: '#0F172A' }}>{currentStage?.label}:</strong> {currentStage?.description || 'Your order is progressing through our verified workflow.'}
          </div>

          {/* 4 Compact Stat Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px'
          }}>
            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>Packing Progress</div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
                {packingProgress?.percentage || 0}%
              </div>
              <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '9999px', marginTop: '8px', overflow: 'hidden' }}>
                <div style={{
                  width: `${packingProgress?.percentage || 0}%`,
                  height: '100%',
                  backgroundColor: packingProgress?.percentage === 100 ? '#10B981' : brandColor
                }} />
              </div>
            </div>

            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>Items Packed</div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', marginTop: '4px' }}>
                {packingProgress?.packedLines || 0} / {packingProgress?.totalLines || 0} Lines
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                {packingProgress?.pendingLines || 0} pending
              </div>
            </div>

            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>Carrier / Transport</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {transport?.transporterName || 'Pending Assignment'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                LR: {transport?.lrNumber || 'Awaiting Dispatch'}
              </div>
            </div>

            <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>Vehicle</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '4px' }}>
                {transport?.vehicleNumber || 'Awaiting Loading'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
                {transport?.transportMode || 'Road Transport'}
              </div>
            </div>
          </div>
        </section>

        {/* 3. Segmented Navigation Tabs */}
        <div style={{
          display: 'inline-flex',
          gap: '6px',
          backgroundColor: '#E2E8F0',
          padding: '4px',
          borderRadius: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          {[
            { id: 'overview', label: 'Tracking & Shipment', icon: Truck },
            { id: 'products', label: `Items (${packingProgress?.totalLines || 0})`, icon: Package },
            { id: 'documents', label: `Documents (${documents?.length || 0})`, icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  fontWeight: isSel ? 700 : 600,
                  color: isSel ? '#0F172A' : '#475569',
                  backgroundColor: isSel ? '#FFFFFF' : 'transparent',
                  border: 'none',
                  borderRadius: '9px',
                  boxShadow: isSel ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                  cursor: 'pointer'
                }}
              >
                <Icon size={15} color={isSel ? brandColor : '#64748B'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 4. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', alignItems: 'start' }}>
            {/* Shipment & Actions Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '22px'
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
                    <Truck size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Shipment Details</h3>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Carrier & consignment info</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#64748B' }}>Transporter</span>
                    <strong style={{ color: '#0F172A' }}>{transport?.transporterName || 'Pending'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#64748B' }}>Vehicle Number</span>
                    <strong style={{ color: '#0F172A' }}>{transport?.vehicleNumber || 'Awaiting Loading'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#64748B' }}>LR / Consignment No</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ color: '#0F172A' }}>{transport?.lrNumber || 'Awaiting Dispatch'}</strong>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', fontSize: '13px' }}>
                      <span style={{ color: '#64748B' }}>Driver Phone</span>
                      <a href={`tel:${transport.driverPhone}`} style={{ fontWeight: 700, color: brandColor, textDecoration: 'none' }}>
                        {transport.driverPhone}
                      </a>
                    </div>
                  )}
                </div>

                {/* Action Buttons — Confirm Delivery ONLY shown after Dispatched */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
                  {isDispatched && !isDelivered && (
                    <button
                      onClick={() => setShowDeliveryModal(true)}
                      style={{
                        flex: 1,
                        minWidth: '150px',
                        padding: '11px 14px',
                        borderRadius: '10px',
                        backgroundColor: '#059669',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <CheckCircle2 size={16} />
                      Confirm Delivery
                    </button>
                  )}

                  {isDelivered && (
                    <div style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#ECFDF5',
                      color: '#059669',
                      border: '1px solid #A7F3D0',
                      fontSize: '13px',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}>
                      <CheckCircle2 size={16} />
                      Delivery Confirmed
                    </div>
                  )}

                  <button
                    onClick={() => setShowIssueModal(true)}
                    style={{
                      flex: 1,
                      minWidth: '140px',
                      padding: '11px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#FFFBEB',
                      color: '#B45309',
                      border: '1px solid #FDE68A',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
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

              {/* Support Card */}
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                padding: '20px'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>Customer Care</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {companyBranding?.supportPhone && (
                    <a
                      href={`tel:${companyBranding.supportPhone}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        color: '#0F172A',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    >
                      <Phone size={15} color={brandColor} />
                      <span>{companyBranding.supportPhone}</span>
                    </a>
                  )}
                  <a
                    href={`mailto:${companyBranding?.supportEmail || 'support@businz.com'}?subject=Tracking Query: ${bomCode}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      backgroundColor: '#F8FAFC',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      color: '#0F172A',
                      fontSize: '13px',
                      fontWeight: 600
                    }}
                  >
                    <Mail size={15} color={brandColor} />
                    <span>{companyBranding?.supportEmail || 'support@businz.com'}</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Detailed Activity Timeline (Compact + Expandable) */}
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              padding: '22px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Order Activity</h3>
                {timeline.length > 4 && (
                  <button
                    onClick={() => setShowAllStages(prev => !prev)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#F1F5F9',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    <span>{showAllStages ? 'Show recent' : `View all ${timeline.length} stages`}</span>
                    {showAllStages ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
              </div>

              <div style={{ position: 'relative', paddingLeft: '4px' }}>
                {visibleTimeline.map((stageItem, idx) => {
                  const done = stageItem.state === 'COMPLETED';
                  const current = stageItem.state === 'CURRENT';
                  const isLast = idx === visibleTimeline.length - 1;
                  return (
                    <div key={stageItem.stageId} style={{ display: 'flex', gap: '14px', position: 'relative', minHeight: '56px' }}>
                      {!isLast && (
                        <div style={{
                          position: 'absolute',
                          left: '13px',
                          top: '26px',
                          bottom: '-6px',
                          width: '2px',
                          backgroundColor: done ? '#10B981' : '#E2E8F0'
                        }} />
                      )}
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: done ? '#ECFDF5' : (current ? '#ECFEFF' : '#F1F5F9'),
                        color: done ? '#059669' : (current ? brandColor : '#94A3B8'),
                        border: current ? `2px solid ${brandColor}` : 'none',
                        flexShrink: 0,
                        zIndex: 2
                      }}>
                        {done ? <CheckCircle2 size={15} /> : (
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: current ? brandColor : '#CBD5E1' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, paddingBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '13.5px',
                            fontWeight: current || done ? 700 : 500,
                            color: current ? brandColor : (done ? '#0F172A' : '#64748B')
                          }}>
                            {stageItem.label}
                          </span>
                          {stageItem.timestamp && (
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                              {new Date(stageItem.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0', lineHeight: 1.4 }}>
                          {stageItem.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 5. PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>Itemized Packing Progress</h3>
                <div style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>{packingProgress?.summaryText || '0% Packing Completed'}</div>
              </div>
              <span style={{
                fontSize: '13px',
                fontWeight: 700,
                padding: '5px 12px',
                borderRadius: '9999px',
                backgroundColor: packingProgress?.percentage === 100 ? '#ECFDF5' : '#ECFEFF',
                color: packingProgress?.percentage === 100 ? '#059669' : brandColor
              }}>
                {packingProgress?.percentage || 0}% Packed
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(packingProgress?.products || []).map((prod, idx) => {
                const fullyPacked = prod.isFullyPacked;
                const partial = prod.status === 'PARTIALLY_PACKED';
                const pct = prod.orderedQty > 0 ? Math.min(100, Math.round((prod.packedQty / prod.orderedQty) * 100)) : 0;
                return (
                  <div key={prod.code || idx} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{prod.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                          Code: <strong>{prod.code}</strong> • Ordered: <strong>{prod.orderedQty} {prod.uom}</strong> • Packed: <strong>{prod.packedQty} {prod.uom}</strong>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        backgroundColor: fullyPacked ? '#ECFDF5' : (partial ? '#FEF3C7' : '#F1F5F9'),
                        color: fullyPacked ? '#059669' : (partial ? '#B45309' : '#64748B')
                      }}>
                        {fullyPacked ? 'Packed' : (partial ? 'Partial' : 'Pending')}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '5px', backgroundColor: '#F1F5F9', borderRadius: '9999px', marginTop: '10px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: fullyPacked ? '#10B981' : brandColor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '22px' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 16px' }}>Order Documents</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
              {documents.map((doc, idx) => {
                const isAvail = Boolean(doc.available);
                return (
                  <div key={doc.type || idx} style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: '9999px',
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
                      <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A' }}>{doc.title}</div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>Ref: <strong>{doc.docNumber}</strong></div>
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
                          gap: '7px',
                          padding: '9px 12px',
                          borderRadius: '9px',
                          backgroundColor: brandColor,
                          color: '#FFFFFF',
                          fontSize: '13px',
                          fontWeight: 600,
                          textDecoration: 'none'
                        }}
                      >
                        <Download size={15} />
                        <span>Download / View</span>
                      </a>
                    ) : (
                      <div style={{
                        padding: '9px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '9px',
                        textAlign: 'center',
                        fontSize: '12px',
                        color: '#94A3B8'
                      }}>
                        Available once generated
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Report Issue Modal */}
      {showIssueModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 100
        }}>
          <div style={{ maxWidth: '460px', width: '100%', backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '26px', position: 'relative' }}>
            <button onClick={() => setShowIssueModal(false)} style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px' }}>Report an Issue</h3>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 18px' }}>Our dispatch and support team will respond shortly.</p>
            {issueSuccess ? (
              <div style={{ padding: '22px', textAlign: 'center', backgroundColor: '#ECFDF5', borderRadius: '12px', color: '#059669' }}>
                <CheckCircle2 size={34} style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 700 }}>Issue Submitted</div>
              </div>
            ) : (
              <form onSubmit={handleReportIssue}>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', marginBottom: '14px', fontSize: '14px' }}
                >
                  <option value="MISSING_PRODUCTS">Missing Items / Shortage</option>
                  <option value="DAMAGED_PRODUCTS">Damaged During Transit</option>
                  <option value="INCORRECT_ITEMS">Incorrect Specifications</option>
                  <option value="DOCUMENT_DISCREPANCY">Invoice / LR Discrepancy</option>
                  <option value="OTHER">Other Query</option>
                </select>
                <textarea
                  rows={4}
                  value={issueRemarks}
                  onChange={(e) => setIssueRemarks(e.target.value)}
                  placeholder="Describe the issue..."
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', boxSizing: 'border-box', marginBottom: '16px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setShowIssueModal(false)} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFF', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={issueSubmitting} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: 'none', backgroundColor: brandColor, color: '#FFF', fontWeight: 700, cursor: 'pointer' }}>
                    {issueSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirm Delivery Modal */}
      {showDeliveryModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 100
        }}>
          <div style={{ maxWidth: '440px', width: '100%', backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '26px', position: 'relative' }}>
            <button onClick={() => setShowDeliveryModal(false)} style={{ position: 'absolute', top: '18px', right: '18px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
              <X size={20} />
            </button>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px' }}>Confirm Delivery Receipt</h3>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 18px' }}>Confirm that you received your order in good condition.</p>
            {deliverySuccess ? (
              <div style={{ padding: '22px', textAlign: 'center', backgroundColor: '#ECFDF5', borderRadius: '12px', color: '#059669' }}>
                <CheckCircle2 size={34} style={{ margin: '0 auto 10px' }} />
                <div style={{ fontWeight: 700 }}>Delivery Confirmed!</div>
              </div>
            ) : (
              <form onSubmit={handleConfirmDelivery}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} type="button" onClick={() => setDeliveryRating(star)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: star <= deliveryRating ? '#F59E0B' : '#E2E8F0' }}>
                      <Star size={28} fill={star <= deliveryRating ? '#F59E0B' : 'none'} />
                    </button>
                  ))}
                </div>
                <textarea
                  rows={3}
                  value={deliveryRemarks}
                  onChange={(e) => setDeliveryRemarks(e.target.value)}
                  placeholder="Optional delivery note..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', boxSizing: 'border-box', marginBottom: '16px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setShowDeliveryModal(false)} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFF', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={deliverySubmitting} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: 'none', backgroundColor: '#059669', color: '#FFF', fontWeight: 700, cursor: 'pointer' }}>
                    {deliverySubmitting ? 'Confirming...' : 'Confirm Received'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .hide-on-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
