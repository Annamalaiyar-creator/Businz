import React from "react";
import { Plus, X, XCircle, ChevronDown, ChevronUp, Receipt, Camera, Video } from "lucide-react";
import StatusBadge from "../StatusBadge";
import { getMediaFromCache } from "../../utils/otherViewsShared";

export default function QuickPreviewDrawer({
  quickPreviewRecord,
  onClose,
  activeTab,
  canCancelBom,
  handleCancelBomOrder,
  onViewFullDetails,
  filteredRows = [],
  totalRecords = 1,
  setActiveMediaPreviewModal
}) {
  const displayCount = Array.isArray(filteredRows) && filteredRows.length > 0
    ? filteredRows.length
    : (typeof totalRecords === 'number' && totalRecords > 0 ? totalRecords : 1);

  return (
  <div
    onClick={() => onClose()}
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      justifyContent: 'flex-end',
      zIndex: 20000,
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
    }}
  >
    {/* Right-Side Slide-Over Drawer Panel */}
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        backgroundColor: '#FFFFFF',
        width: '580px',
        maxWidth: '92vw',
        height: '100vh',
        overflowY: 'auto',
        boxShadow: '-12px 0 40px rgba(15, 23, 42, 0.2)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        boxSizing: 'border-box',
        animation: 'slideInRight 0.25s ease-out'
      }}
    >
      {/* Top Drawer Header matching mockup */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
            {activeTab === 'Customer Management' ? 'Customer Preview' : `${activeTab} Preview`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '3px 10px', borderRadius: '14px', fontSize: '11px', color: '#64748B', fontWeight: '700' }}>
            <ChevronDown size={14} style={{ cursor: 'pointer' }} />
            <ChevronUp size={14} style={{ cursor: 'pointer' }} />
            <span>1 of {displayCount}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => {
              if (typeof onViewFullDetails === 'function') {
                onViewFullDetails(quickPreviewRecord);
              }
              onClose();
            }}
            style={{
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#1E293B',
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
          >
            View Full Details
          </button>

          {canCancelBom && ['Dispatch Orders', 'Accounts Verification', 'BOM Orders', 'BOM', 'BOM / Routing'].includes(activeTab) && quickPreviewRecord.status !== 'Cancelled & Stock Restored' && quickPreviewRecord.status !== 'CANCELLED' && !quickPreviewRecord.cancelled && (
            <button
              onClick={() => {
                const rec = quickPreviewRecord;
                handleCancelBomOrder(rec);
                onClose();
              }}
              style={{
                border: '1px solid #FECACA',
                backgroundColor: '#FEF2F2',
                color: '#DC2626',
                padding: '6px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(220,38,38,0.08)'
              }}
              title="Cancel BOM and restore blocked stock back into inventory"
            >
              <XCircle size={14} style={{ color: '#DC2626' }} /> Cancel BOM
            </button>
          )}
          <button
            onClick={() => onClose()}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B', padding: '4px', display: 'inline-flex', alignItems: 'center' }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Customer / Profile Main Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '4px' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#ECFEFF',
          color: '#0E7490',
          border: '2px solid #0E7490',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          fontWeight: '800',
          flexShrink: 0
        }}>
          {(quickPreviewRecord.c2 || quickPreviewRecord.code || 'CR').charAt(0).toUpperCase()}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              {quickPreviewRecord.customerName || quickPreviewRecord.companyName || quickPreviewRecord.c2 || quickPreviewRecord.name || 'Customer'}
            </h3>
            <StatusBadge status={quickPreviewRecord.status || quickPreviewRecord.c4 || 'Active'} size="sm" />
          </div>
          <span style={{ fontSize: '12px', color: '#64748B' }}>
            Ref Code: <strong style={{ color: '#0E7490' }}>{quickPreviewRecord.bomCode || quickPreviewRecord.code || quickPreviewRecord.id || '—'}</strong>
          </span>
        </div>
      </div>

      {/* 4 Stat Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
        <div>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            REF CODE
          </span>
          <strong style={{ fontSize: '14px', color: '#0F172A', fontWeight: '800', lineHeight: '1.2' }}>
            {quickPreviewRecord.bomCode || quickPreviewRecord.code || '—'}
          </strong>
        </div>
        <div>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            STATUS
          </span>
          <strong style={{ fontSize: '13px', color: '#0E7490', fontWeight: '800', lineHeight: '1.2' }}>
            {quickPreviewRecord.status || quickPreviewRecord.c4 || 'Pending'}
          </strong>
        </div>
        <div>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            TOTAL ITEMS
          </span>
          <strong style={{ fontSize: '15px', color: '#0F172A', fontWeight: '800', lineHeight: '1.2' }}>
            {(quickPreviewRecord.items || quickPreviewRecord.materials || []).length || 0}
          </strong>
        </div>
        <div>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            ORDER VALUE
          </span>
          <strong style={{ fontSize: '15px', color: '#0F172A', fontWeight: '800', lineHeight: '1.2' }}>
            {quickPreviewRecord.grandTotal ? `₹ ${Number(quickPreviewRecord.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : (quickPreviewRecord.c5 || quickPreviewRecord.value || '—')}
          </strong>
        </div>
      </div>

      {/* Customer & Order Details Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
          Record Details
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '12px' }}>
          <div>
            <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Customer Name</span>
            <strong style={{ color: '#0F172A' }}>{quickPreviewRecord.customerName || quickPreviewRecord.companyName || quickPreviewRecord.c2 || '—'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Order Date</span>
            <strong style={{ color: '#0F172A' }}>{quickPreviewRecord.date || quickPreviewRecord.c3 || quickPreviewRecord.date1 || '—'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Mode of Transport</span>
            <strong style={{ color: '#0F172A' }}>{quickPreviewRecord.transportMode || quickPreviewRecord.c4 || '—'}</strong>
          </div>
          <div>
            <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Transport Name</span>
            <strong style={{ color: '#0F172A' }}>{quickPreviewRecord.transporterName || quickPreviewRecord.c5 || '—'}</strong>
          </div>
          {quickPreviewRecord.vehicleNo ? (
            <div>
              <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Vehicle Number</span>
              <strong style={{ color: '#0284C7' }}>{quickPreviewRecord.vehicleNo}</strong>
            </div>
          ) : null}
          {quickPreviewRecord.lrNo || quickPreviewRecord.lrNumber ? (
            <div>
              <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>LR / Docket No.</span>
              <strong style={{ color: '#0284C7' }}>{quickPreviewRecord.lrNo || quickPreviewRecord.lrNumber}</strong>
            </div>
          ) : null}
          <div>
            <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Accounts Approval</span>
            <span style={{ backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0', padding: '2px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: '800' }}>
              • {quickPreviewRecord.isAccountsDone ? 'Verified' : (quickPreviewRecord.status || 'Pending Verification')}
            </span>
          </div>
          <div>
            <span style={{ color: '#64748B', display: 'block', marginBottom: '2px' }}>Shipping Address</span>
            <strong style={{ color: '#0F172A' }}>{quickPreviewRecord.deliveryAddress || quickPreviewRecord.shippingAddress || quickPreviewRecord.billingAddress || '—'}</strong>
          </div>
        </div>
      </div>

      {/* Active Dispatch & Itemized Product Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            Itemized Product & BOM Checklist
          </h4>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0E7490' }}>
            {(quickPreviewRecord.items || quickPreviewRecord.materials || []).length} Item(s)
          </span>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                  <th style={{ padding: '8px 10px', width: '30px' }}>#</th>
                  <th style={{ padding: '8px 10px' }}>Product Item</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>UOM</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Rate (₹)</th>
                </tr>
              </thead>
              <tbody>
                {((quickPreviewRecord.items || quickPreviewRecord.materials || []).length > 0
                  ? (quickPreviewRecord.items || quickPreviewRecord.materials)
                  : [{ name: quickPreviewRecord.productName || quickPreviewRecord.c2 || 'BOM Material Kit', uom: 'NOS', qty: 1, rate: parseFloat(quickPreviewRecord.grandTotal || quickPreviewRecord.value || 0) }]
                ).map((it, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 10px', color: '#94A3B8', fontWeight: '700' }}>{idx + 1}</td>
                    <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0F172A' }}>{it.name || '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: '#475569' }}>{it.uom || it.unit || 'NOS'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#0E7490' }}>{it.qty || 1}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600', color: '#0F172A' }}>₹ {Number(it.rate || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dispatch Packed Items Media Section in Quick Preview */}
      {(() => {
        const packMedia = quickPreviewRecord.dispatchPackingMedia || {};
        const packPhotos = packMedia.photos || [];
        const packVideos = packMedia.videos || [];
        const hasMedia = packPhotos.length > 0 || packVideos.length > 0;

        if (!hasMedia && !quickPreviewRecord.status?.includes('Dispatch') && !quickPreviewRecord.status?.includes('Packed') && !quickPreviewRecord.dispatchPacking) {
          return null;
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={16} style={{ color: '#0E7490' }} />
                <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Dispatch Packed Items Media ({packPhotos.length} Photos, {packVideos.length} Videos)
                </h4>
              </div>
              <span style={{ fontSize: '11px', color: '#64748B' }}>Captured by Dispatch</span>
            </div>

            {hasMedia ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                {(packPhotos || []).map((ph, pIdx) => {
                  const photoUrl = (ph.url && !ph.url.startsWith('blob:'))
                    ? ph.url
                    : ((ph.dataUrl && !ph.dataUrl.startsWith('blob:')) ? ph.dataUrl : (getMediaFromCache(ph.name) || getMediaFromCache(ph.id) || (ph.name ? `/api/uploads/${ph.name}` : '')));
                  return (
                    <div
                      key={pIdx}
                      onClick={() => {
                        if (typeof setActiveMediaPreviewModal === 'function') {
                          setActiveMediaPreviewModal({ type: 'image', url: photoUrl, name: ph.name || `Photo ${pIdx + 1}` });
                        } else if (photoUrl) {
                          window.open(photoUrl, '_blank');
                        }
                      }}
                      style={{ height: '76px', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #CBD5E1', backgroundColor: '#0F172A', position: 'relative' }}
                    >
                      <img
                        src={photoUrl || ph.dataUrl}
                        alt={ph.name}
                        onError={(e) => {
                          if (!e.currentTarget.dataset.retried && ph.name) {
                            e.currentTarget.dataset.retried = 'true';
                            fetch(`/api/media/find/${encodeURIComponent(ph.name)}`)
                              .then(r => r.json())
                              .then(data => {
                                if (data?.found && data?.url) {
                                  e.currentTarget.src = data.url;
                                  saveMediaToCache(ph.name, data.url);
                                }
                              }).catch(() => {});
                          }
                        }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 6px', fontSize: '9px', fontWeight: '700', display: 'flex', justifyContent: 'space-between' }}>
                        <span>📷 Photo</span>
                        <span>›</span>
                      </div>
                    </div>
                  );
                })}
                {packVideos.map((vd, vIdx) => {
                  const videoUrl = (vd.url && !vd.url.startsWith('blob:'))
                    ? vd.url
                    : ((vd.dataUrl && !vd.dataUrl.startsWith('blob:')) ? vd.dataUrl : (getMediaFromCache(vd.name) || getMediaFromCache(vd.id) || (vd.name ? `/api/uploads/${vd.name}` : '')));
                  return (
                    <div
                      key={vIdx}
                      onClick={() => {
                        if (typeof setActiveMediaPreviewModal === 'function') {
                          setActiveMediaPreviewModal({ type: 'video', url: videoUrl, name: vd.name || `Video ${vIdx + 1}` });
                        } else if (videoUrl) {
                          window.open(videoUrl, '_blank');
                        }
                      }}
                      style={{ height: '76px', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #CBD5E1', backgroundColor: '#0F172A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', position: 'relative' }}
                    >
                      <Video size={20} style={{ color: '#38BDF8' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 6px', fontSize: '9px', fontWeight: '700', display: 'flex', justifyContent: 'space-between' }}>
                        <span>🎥 Video</span>
                        <span>›</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic', backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '10px', border: '1px dashed #E2E8F0' }}>
                No packing photos or videos attached yet for this order.
              </div>
            )}
          </div>
        );
      })()}

    </div>
  </div>
  );
}
