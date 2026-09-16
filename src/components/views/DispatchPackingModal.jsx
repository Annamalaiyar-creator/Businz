import React, { useState, useRef } from "react";
import {
  Check, Trash2, CheckCircle, CheckSquare, XCircle, ChevronLeft,
  UploadCloud, Package, Upload, Receipt, Camera, Video, Play, Save, X
} from "lucide-react";
import { stripDataUrlsFromRecord, compressAndSaveFile, saveMediaToCache, getMediaFromCache, uploadMediaFile } from "../../utils/otherViewsShared";
import { saveCloudStore } from "../../utils/supabaseDataSync";
import { addLiveNotification } from "../Header";
import { notifyBomPackedAndSentToAccounts } from "../../services/notificationService";
import { VRM_PRODUCTS } from "../../utils/vrmProductsData";
import { centralInventoryStore } from "../../utils/centralInventoryStore";
import { ActiveMediaPreviewModal } from "./DispatchAndPreviewModals";

export default function DispatchPackingModal({
  dispatchPackingModal,
  setDispatchPackingModal,
  bomStore,
  setBomStore,
  setInvoiceList,
  canCancelBom = false,
  handleCancelBomOrder = () => {},
  setActiveMediaPreviewModal
}) {
  const [showDispatchCameraModal, setShowDispatchCameraModal] = useState(false);
  const [dispatchCameraError, setDispatchCameraError] = useState('');
  const [localActiveMediaPreview, setLocalActiveMediaPreview] = useState(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const dispatchCameraStreamRef = useRef(null);
  const dispatchCameraVideoRef = useRef(null);
  const dispatchCameraCanvasRef = useRef(null);

  const targetCode = dispatchPackingModal?.bomCode || dispatchPackingModal?.code || dispatchPackingModal?.id;

  const syncBOMMediaItem = (itemType, itemId, permanentUrl) => {
    if (!targetCode || !permanentUrl) return;

    // 1. Update React state immediately
    if (typeof setBomStore === 'function') {
      setBomStore(prev => {
        return (prev || []).map(b => {
          if (b.bomCode === targetCode || b.code === targetCode || b.id === targetCode) {
            const rawMedia = b.dispatchPackingMedia || { photos: [], videos: [] };
            let updatedPhotos = rawMedia.photos || [];
            let updatedVideos = rawMedia.videos || [];
            if (itemType === 'photo') {
              updatedPhotos = updatedPhotos.map(p => (p.id === itemId || p.name === itemId) ? { ...p, url: permanentUrl, dataUrl: permanentUrl } : p);
            } else if (itemType === 'video') {
              updatedVideos = updatedVideos.map(v => (v.id === itemId || v.name === itemId) ? { ...v, url: permanentUrl, dataUrl: permanentUrl, uploading: false } : v);
            }
            return {
              ...b,
              dispatchPackingMedia: { ...rawMedia, photos: updatedPhotos, videos: updatedVideos }
            };
          }
          return b;
        });
      });
    }

    // 2. Persist to localStorage & Server
    try {
      const raw = localStorage.getItem('controlroom_bom_store');
      if (raw) {
        const localList = JSON.parse(raw);
        let matchedBom = null;
        const updatedLocal = localList.map(b => {
          if (b.bomCode === targetCode || b.code === targetCode || b.id === targetCode) {
            const rawMedia = b.dispatchPackingMedia || { photos: [], videos: [] };
            let updatedPhotos = rawMedia.photos || [];
            let updatedVideos = rawMedia.videos || [];
            if (itemType === 'photo') {
              updatedPhotos = updatedPhotos.map(p => (p.id === itemId || p.name === itemId) ? { ...p, url: permanentUrl, dataUrl: permanentUrl } : p);
            } else if (itemType === 'video') {
              updatedVideos = updatedVideos.map(v => (v.id === itemId || v.name === itemId) ? { ...v, url: permanentUrl, dataUrl: permanentUrl, uploading: false } : v);
            }
            matchedBom = {
              ...b,
              dispatchPackingMedia: { ...rawMedia, photos: updatedPhotos, videos: updatedVideos }
            };
            return matchedBom;
          }
          return b;
        });
        localStorage.setItem('controlroom_bom_store', JSON.stringify(updatedLocal.map(stripDataUrlsFromRecord)));
        if (matchedBom) {
          fetch('/api/boms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bom: stripDataUrlsFromRecord(matchedBom), isUpdate: true })
          }).catch(() => {});
          window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: matchedBom } }));
        }
      }
    } catch (_) {}
  };

  const handleMediaPreview = (media) => {
    if (typeof setActiveMediaPreviewModal === 'function') {
      setActiveMediaPreviewModal(media);
    }
    setLocalActiveMediaPreview(media);
  };

  const rawItems = (dispatchPackingModal.items || []).map(it => {
    const nameStr = (it.name || it.c2 || 'Item').toLowerCase().trim();
    const code = nameStr.includes('mid 30') ? 'MC30' : (nameStr.includes('mini rail') ? 'MR100N' : (it.code || it.itemCode || it.productCode || it.c1 || null));
    return { name: it.name || it.c2 || 'Item', code, bomQty: it.qty || 1, packed: false };
  });
  const itemsToPack = (dispatchPackingModal.dispatchPacking && Array.isArray(dispatchPackingModal.dispatchPacking) && dispatchPackingModal.dispatchPacking.length > 0)
    ? dispatchPackingModal.dispatchPacking.map(p => {
        const nameStr = (p.name || '').toLowerCase().trim();
        const code = nameStr.includes('mid 30') ? 'MC30' : (nameStr.includes('mini rail') ? 'MR100N' : (p.code || null));
        return { ...p, code };
      })
    : rawItems;

  const isCancelled = Boolean(
    dispatchPackingModal.cancelled ||
    dispatchPackingModal.status === 'Cancelled' ||
    dispatchPackingModal.status === 'CANCELLED' ||
    dispatchPackingModal.status === 'Cancelled & Stock Restored' ||
    (dispatchPackingModal.status && typeof dispatchPackingModal.status === 'string' && dispatchPackingModal.status.toLowerCase().includes('cancel'))
  );

  const isPackedAndReady = Boolean(
    isCancelled ||
    dispatchPackingModal.isReadOnly ||
    dispatchPackingModal.isViewOnly ||
    dispatchPackingModal.status === 'Packed & Ready for Dispatch' ||
    dispatchPackingModal.status === 'PACKED & READY FOR DISPATCH' ||
    dispatchPackingModal.status === 'Packed & Awaiting Dispatch Payment' ||
    dispatchPackingModal.status === 'Accounts Verified & Passed to Invoice' ||
    dispatchPackingModal.status === 'ACCOUNTS VERIFIED' ||
    dispatchPackingModal.status === 'Invoice Confirmed' ||
    dispatchPackingModal.status === 'Closed' ||
    dispatchPackingModal.status === 'CLOSED'
  );

  const packedItemsCount = itemsToPack.filter(p => p.packed).length;
  const totalItemsCount = itemsToPack.length;
  const allItemsPacked = totalItemsCount > 0 && packedItemsCount === totalItemsCount;
  const progressPercent = totalItemsCount > 0 ? Math.round((packedItemsCount / totalItemsCount) * 100) : 0;
  const isPartial = packedItemsCount > 0 && !allItemsPacked;

  const savePackingData = () => {
    if (uploadingCount > 0) {
      alert('Media files (photos/videos) are currently uploading to the server. Please wait a few seconds so that Sales and Accounts can view them.');
      return;
    }
    const isWhileDispatch = (dispatchPackingModal.paymentType === 'Payment While Dispatch' || (dispatchPackingModal.paymentType || '').includes('While Dispatch'));
    const nextStatus = allItemsPacked
      ? (isWhileDispatch ? 'Packed & Awaiting Dispatch Payment' : 'Packed & Ready for Dispatch')
      : 'Partially Packed';
    const needsSalesPaymentNotification = allItemsPacked && isWhileDispatch;

    const accountsVerificationData = (dispatchPackingModal.accountsVerification && dispatchPackingModal.accountsVerification.verified)
      ? dispatchPackingModal.accountsVerification
      : (allItemsPacked ? { paymentStatus: isWhileDispatch ? 'Awaiting Sales Payment Slip' : null, hardCopyReceived: false, softCopyReceived: false, verified: false } : (dispatchPackingModal.accountsVerification || {}));

    const rawMedia = dispatchPackingModal.dispatchPackingMedia;
    const cleanMedia = rawMedia ? {
      photos: (rawMedia.photos || []).map(p => {
        const bestUrl = (p.url && !p.url.startsWith('blob:'))
          ? p.url
          : (getMediaFromCache(p.id) || getMediaFromCache(p.name) || (p.dataUrl && !p.dataUrl.startsWith('blob:') ? p.dataUrl : (p.name ? `/api/uploads/${p.name}` : '')));
        const cleanBestUrl = (bestUrl && !bestUrl.startsWith('blob:')) ? bestUrl : undefined;
        return {
          ...p,
          url: cleanBestUrl,
          dataUrl: (p.dataUrl && !p.dataUrl.startsWith('blob:')) ? p.dataUrl : cleanBestUrl
        };
      }),
      videos: (rawMedia.videos || []).map(v => {
        const bestUrl = (v.url && !v.url.startsWith('blob:'))
          ? v.url
          : (getMediaFromCache(v.id) || getMediaFromCache(v.name) || (v.dataUrl && !v.dataUrl.startsWith('blob:') ? v.dataUrl : (v.name ? `/api/uploads/${v.name}` : '')));
        const cleanBestUrl = (bestUrl && !bestUrl.startsWith('blob:')) ? bestUrl : undefined;
        return {
          ...v,
          url: cleanBestUrl,
          dataUrl: (v.dataUrl && !v.dataUrl.startsWith('blob:')) ? v.dataUrl : cleanBestUrl,
          uploading: false
        };
      })
    } : null;

    const updatedPackedBom = {
      ...dispatchPackingModal,
      dispatchPacking: itemsToPack,
      dispatchPackingMedia: cleanMedia,
      status: nextStatus,
      pendingSalesDispatchPayment: needsSalesPaymentNotification,
      reissuedByAccounts: false,
      isAccountsDone: false,
      accountsVerification: accountsVerificationData,
      isUpdate: true
    };
    delete updatedPackedBom.c2;
    delete updatedPackedBom.c3;
    delete updatedPackedBom.c4;
    delete updatedPackedBom.c5;
    delete updatedPackedBom.c6;

    const targetCode = dispatchPackingModal.bomCode || dispatchPackingModal.code || dispatchPackingModal.id;

    // 1. Deduct / Reserve Stock in Central Inventory & Raw Materials Stores immediately
    try {
      centralInventoryStore.deductStockForBOM(targetCode, itemsToPack, 'Dispatch Packing');
    } catch (cErr) {
      console.warn('Central store deduction error in DispatchPackingModal:', cErr);
    }

    // 2. Update React state immediately
    setBomStore(prev => {
      const updated = (prev || []).map(b => (b.bomCode === targetCode || b.code === targetCode || b.id === targetCode || b.id === dispatchPackingModal.id) ? { ...b, ...updatedPackedBom } : b);
      return updated;
    });

    // 3. Persist to cloud store and localStorage
    saveCloudStore('bom_store', (bomStore || []).map(b => (b.bomCode === targetCode || b.code === targetCode || b.id === targetCode || b.id === dispatchPackingModal.id) ? { ...b, ...updatedPackedBom } : b));
    try {
      const currentLocal = JSON.parse(localStorage.getItem('controlroom_bom_store') || '[]');
      const updatedLocal = currentLocal.map(b => (b.bomCode === targetCode || b.code === targetCode || b.id === targetCode || b.id === dispatchPackingModal.id) ? { ...b, ...updatedPackedBom } : b);
      localStorage.setItem('controlroom_bom_store', JSON.stringify(updatedLocal.map(stripDataUrlsFromRecord)));
    } catch (_) {}

    // 4. Dispatch global sync event so all views and tabs update in real time
    window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: updatedPackedBom } }));
    window.dispatchEvent(new Event('central_inventory_updated'));
    window.dispatchEvent(new Event('controlroom_raw_materials_update'));
    window.dispatchEvent(new Event('controlroom_storage_update'));
    window.dispatchEvent(new Event('storage'));

    // 5. Push to server immediately so Accounts sees it across browsers and devices
    try {
      fetch('/api/boms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bom: stripDataUrlsFromRecord(updatedPackedBom), isUpdate: true })
      }).catch(() => {});
    } catch (_) {}

    const targetBomCode = dispatchPackingModal.bomCode;
    const targetNum = targetBomCode ? targetBomCode.replace(/[^0-9]/g, '') : '';
    if (typeof setInvoiceList === 'function') {
      setInvoiceList(prev => (prev || []).map(inv => {
        const invPoNum = inv.poNo ? inv.poNo.replace(/[^0-9]/g, '') : '';
        const invNoNum = inv.invNo ? inv.invNo.replace(/[^0-9]/g, '') : '';
        const isMatch = inv.poNo === targetBomCode || inv.invNo === targetBomCode || inv.code === targetBomCode || (targetNum && (invPoNum === targetNum || invNoNum === targetNum));
        if (isMatch) {
          const currentItems = (inv.items && inv.items.length > 0) ? inv.items : (dispatchPackingModal.items || []);
          const updatedInvItems = currentItems.map((it, idx) => {
            const matchingPacked = itemsToPack.find(p => p.name === it.name || p.code === it.code || (it.name && p.name && p.name.toLowerCase().trim() === it.name.toLowerCase().trim())) || itemsToPack[idx];
            return { ...it, selected: matchingPacked ? Boolean(matchingPacked.packed) : false };
          });
          return { ...inv, items: updatedInvItems };
        }
        return inv;
      }));
    }
    setDispatchPackingModal(null);

    // Safely resolve the salesperson who created the BOM and customer name
    const matchingBom = (bomStore || []).find(b => b.bomCode === targetBomCode || b.code === targetBomCode || b.id === dispatchPackingModal.id);
    const resolvedSalesPerson = (dispatchPackingModal.salesPerson || dispatchPackingModal.createdBy || dispatchPackingModal.salesperson || matchingBom?.salesPerson || matchingBom?.createdBy || matchingBom?.salesperson || '').replace(/\s*\([^)]*\)/g, '').trim();
    const resolvedSalesPersonCode = dispatchPackingModal.salesPersonCode || dispatchPackingModal.createdById || matchingBom?.salesPersonCode || matchingBom?.createdById || '';
    const resolvedCustomer = dispatchPackingModal.customerName || dispatchPackingModal.companyName || matchingBom?.customerName || matchingBom?.companyName || 'Customer';

    addLiveNotification({
      id: `notif-pack-${targetBomCode}-${Date.now()}`,
      title: allItemsPacked ? 'BOM Packing Verified' : 'BOM Packing Updated',
      message: `BOM Order ${targetBomCode} for ${resolvedCustomer} is ${allItemsPacked ? '100% Packed & Ready' : 'Partially Packed'}. Status: ${nextStatus}`,
      type: allItemsPacked ? 'success' : 'info',
      category: 'Dispatch',
      time: 'Just now',
      targetTab: 'BOM Orders',
      targetRoles: [resolvedSalesPerson, resolvedSalesPersonCode, 'Sales Executive', 'Sales Head', 'Accounts Head', 'Accounts Executive', 'Production Head', 'Dispatch Head'].filter(Boolean),
      metadata: {
        bomCode: targetBomCode,
        customerName: resolvedCustomer,
        salesPerson: resolvedSalesPerson,
        salesPersonCode: resolvedSalesPersonCode,
        step: 'BOM_PACKED'
      }
    });

    if (allItemsPacked) {
      // Trigger Real-time Workflow Notifications with Porter order alert sound & voice for Sales & Accounts
      notifyBomPackedAndSentToAccounts({
        bomCode: targetBomCode,
        customerName: resolvedCustomer,
        salesPerson: resolvedSalesPerson,
        salesPersonCode: resolvedSalesPersonCode,
        createdBy: resolvedSalesPerson,
        createdById: resolvedSalesPersonCode
      });

      setTimeout(() => {
        if (isWhileDispatch) {
          alert(`📦 Dispatch packing completed for BOM (${targetBomCode})!\n🔔 Notification sent to Salesperson (${resolvedSalesPerson || 'Sales Creator'}) to attach Dispatch Payment Receipt before Accounts verification.`);
        } else {
          alert(`📦 Dispatch packing verified & completed for BOM (${targetBomCode})!\nOrder is now forwarded to Accounts for payment & document verification.`);
        }
      }, 350);
    } else {
      alert(`📦 Dispatch packing progress saved as Partially Packed.`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: "'DM Sans', sans-serif", minHeight: '100%' }}>

      {/* ─── GRADIENT STATUS BANNER HEADER ─── */}
      {/* ─── GRADIENT STATUS BANNER HEADER ─── */}
      <div style={{
        background: isCancelled
          ? 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)'
          : allItemsPacked
            ? 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)'
            : isPartial
              ? 'linear-gradient(135deg, #78350F 0%, #92400E 100%)'
              : 'linear-gradient(135deg, #1E3A5F 0%, #1E40AF 100%)',
        borderRadius: '16px',
        padding: '24px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: isCancelled ? '0 8px 24px rgba(127,29,29,0.35)' : allItemsPacked ? '0 8px 24px rgba(6,78,59,0.35)' : isPartial ? '0 8px 24px rgba(120,53,15,0.35)' : '0 8px 24px rgba(30,58,138,0.35)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Back button */}
          <button
            onClick={() => setDispatchPackingModal(null)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              backgroundColor: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '10px', padding: '9px 16px',
              fontSize: '13px', fontWeight: '700', color: '#FFFFFF',
              cursor: 'pointer', backdropFilter: 'blur(4px)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
          >
            <ChevronLeft style={{ width: '16px', height: '16px' }} /> Back
          </button>

          {/* Title + meta */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.2px' }}>
                {isCancelled
                  ? 'Dispatch Packing Specifications (CANCELLED - VIEW ONLY)'
                  : (isPackedAndReady ? 'Dispatch Packing Specifications (Locked)' : 'Dispatch Packing Verification')}
              </h1>
              <span style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.35)',
                color: '#FFFFFF', padding: '3px 12px',
                borderRadius: '20px', fontSize: '12px', fontWeight: '800'
              }}>
                {dispatchPackingModal.bomCode}
              </span>
              {isCancelled ? (
                <span style={{
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  padding: '3px 12px', borderRadius: '20px',
                  fontSize: '11px', fontWeight: '800',
                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#DC2626' }}></span>
                  CANCELLED (VIEW ONLY)
                </span>
              ) : (
                <span style={{
                  backgroundColor: allItemsPacked ? '#DCFCE7' : isPartial ? '#FEF3C7' : '#DBEAFE',
                  color: allItemsPacked ? '#166534' : isPartial ? '#92400E' : '#1E40AF',
                  padding: '3px 12px', borderRadius: '20px',
                  fontSize: '11px', fontWeight: '800',
                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: allItemsPacked ? '#166534' : isPartial ? '#D97706' : '#2563EB' }}></span>
                  {allItemsPacked ? 'ALL ITEMS PACKED' : isPartial ? 'PARTIALLY PACKED' : 'PENDING PACKING'}
                </span>
              )}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginTop: '6px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span>Customer: <strong style={{ color: '#FFFFFF' }}>{dispatchPackingModal.customerName}</strong></span>
              <span>•</span>
              <span>Sales Creator: <strong style={{ color: '#FFFFFF', backgroundColor: 'rgba(14, 116, 144, 0.45)', padding: '2px 8px', borderRadius: '6px' }}>👤 {(dispatchPackingModal.salesPerson || localStorage.getItem('controlroom_logged_user_name') || 'Mohith JV').replace(/\s*\([^)]*\)/g, '').trim()}</strong></span>
              <span>•</span>
              <span>Payment: <strong style={{ color: '#FFFFFF' }}>{dispatchPackingModal.paymentType}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          {canCancelBom && !isCancelled && dispatchPackingModal.status !== 'Cancelled & Stock Restored' && (
            <button
              onClick={() => handleCancelBomOrder(dispatchPackingModal)}
              style={{
                border: '1px solid rgba(239, 68, 68, 0.4)',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#FEE2E2', height: '42px', padding: '0 18px',
                borderRadius: '10px', fontSize: '13px', fontWeight: '800',
                cursor: 'pointer', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
              title="Cancel BOM and restore blocked stock back into inventory"
            >
              <XCircle style={{ width: '15px', height: '15px', color: '#FCA5A5' }} />
              Cancel BOM
            </button>
          )}
          <button
            onClick={() => setDispatchPackingModal(null)}
            style={{
              border: '1px solid rgba(255,255,255,0.3)',
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: '#FFFFFF', height: '42px', padding: '0 20px',
              borderRadius: '10px', fontSize: '13px', fontWeight: '700',
              cursor: 'pointer', backdropFilter: 'blur(4px)'
            }}
          >
            Close
          </button>
          {!isPackedAndReady && !isCancelled && (
            <button
              onClick={savePackingData}
              disabled={uploadingCount > 0}
              style={{
                border: 'none',
                backgroundColor: uploadingCount > 0 ? '#E2E8F0' : '#FFFFFF',
                color: uploadingCount > 0 ? '#94A3B8' : (allItemsPacked ? '#065F46' : isPartial ? '#92400E' : '#1E40AF'),
                height: '42px', padding: '0 22px',
                borderRadius: '10px', fontSize: '13px', fontWeight: '900',
                cursor: uploadingCount > 0 ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <CheckCircle style={{ width: '16px', height: '16px' }} />
              {uploadingCount > 0 ? `Uploading Media (${uploadingCount})...` : 'Save Verification'}
            </button>
          )}
        </div>
      </div>

      {/* ─── CANCELLATION DETAILS ALERT BANNER ─── */}
      {isCancelled && (
        <div style={{
          backgroundColor: '#FEF2F2',
          border: '1.5px solid #FCA5A5',
          borderRadius: '14px',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px',
          boxShadow: '0 4px 14px rgba(220, 38, 38, 0.08)'
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            backgroundColor: '#DC2626', color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <XCircle style={{ width: '22px', height: '22px' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: '#991B1B' }}>
                This BOM Order has been Cancelled
              </h3>
              <span style={{
                backgroundColor: '#FEE2E2', color: '#DC2626',
                fontSize: '11px', fontWeight: '800', padding: '2px 10px',
                borderRadius: '12px', border: '1px solid #FCA5A5'
              }}>
                VIEW ONLY MODE • NON-EDITABLE
              </span>
            </div>
            <p style={{ margin: '6px 0 10px 0', fontSize: '13px', color: '#7F1D1D', lineHeight: 1.5 }}>
              <strong>Cancellation Reason:</strong> {dispatchPackingModal.cancellationReason || 'No cancellation reason provided.'}
            </p>
            <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: '#991B1B', flexWrap: 'wrap' }}>
              <span><strong>Cancelled By:</strong> {dispatchPackingModal.cancelledBy || 'Dispatch Head'}</span>
              <span>•</span>
              <span><strong>Date:</strong> {dispatchPackingModal.cancelledAt ? new Date(dispatchPackingModal.cancelledAt).toLocaleString('en-IN') : 'Recently'}</span>
              <span>•</span>
              <span><strong>Inventory Status:</strong> All reserved stock released back to inventory</span>
              <span>•</span>
              <span><strong>Sales Person:</strong> {(dispatchPackingModal.salesPerson || 'Sales Executive').replace(/\s*\([^)]*\)/g, '').trim()} (Notified)</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── 4 STATS CARDS ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {/* Progress Card */}
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '14px',
          border: '1px solid #E2E8F0', padding: '18px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', gap: '14px'
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
            background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(37,99,235,0.25)'
          }}>
            <Package style={{ width: '22px', height: '22px', color: '#FFFFFF' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Items Packed</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#0F172A', lineHeight: 1.2 }}>
              {packedItemsCount}<span style={{ fontSize: '14px', color: '#64748B', fontWeight: '600' }}>/{totalItemsCount}</span>
            </div>
          </div>
        </div>

        {/* Completion % Card */}
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '14px',
          border: '1px solid #E2E8F0', padding: '18px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', gap: '14px'
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
            background: allItemsPacked ? 'linear-gradient(135deg, #166534, #16A34A)' : isPartial ? 'linear-gradient(135deg, #B45309, #D97706)' : 'linear-gradient(135deg, #64748B, #94A3B8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: allItemsPacked ? '0 4px 10px rgba(22,101,52,0.3)' : '0 4px 10px rgba(100,116,139,0.2)'
          }}>
            <CheckCircle style={{ width: '22px', height: '22px', color: '#FFFFFF' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Completion</div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: allItemsPacked ? '#166534' : '#0F172A', lineHeight: 1.2 }}>{progressPercent}%</div>
          </div>
        </div>

        {/* Delivery Card */}
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '14px',
          border: '1px solid #E2E8F0', padding: '18px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Delivery Address</div>
          <div style={{ fontSize: '12px', color: '#1E293B', fontWeight: '600', lineHeight: '1.5' }}>
            {dispatchPackingModal.deliveryAddress || 'Plot 14, Phase II, Nagappa Estate, Puzhal, Chennai – 600066.'}
          </div>
        </div>

        {/* Value Card */}
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '14px',
          border: '1px solid #E2E8F0', padding: '18px 20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Order Value</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#0F172A' }}>
            ₹ {parseFloat(dispatchPackingModal.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* ─── PROGRESS BAR CARD ─── */}
      <div style={{
        backgroundColor: '#FFFFFF', borderRadius: '14px',
        border: '1px solid #E2E8F0', padding: '18px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex', alignItems: 'center', gap: '20px'
      }}>
        <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', minWidth: '160px' }}>
          Packing Progress
        </div>
        <div style={{ flex: 1, height: '12px', backgroundColor: '#F1F5F9', borderRadius: '20px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
          <div style={{
            width: `${progressPercent}%`, height: '100%',
            background: allItemsPacked
              ? 'linear-gradient(90deg, #166534, #16A34A)'
              : isPartial
                ? 'linear-gradient(90deg, #B45309, #D97706)'
                : 'linear-gradient(90deg, #1E40AF, #2563EB)',
            borderRadius: '20px',
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
          }} />
        </div>
        <div style={{
          fontSize: '13px', fontWeight: '900', whiteSpace: 'nowrap',
          color: allItemsPacked ? '#166534' : isPartial ? '#B45309' : '#2563EB'
        }}>
          {packedItemsCount} of {totalItemsCount} Packed ({progressPercent}%)
        </div>
      </div>

      {/* ─── CHECKLIST TABLE CARD ─── */}
      <div style={{
        backgroundColor: '#FFFFFF', borderRadius: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        overflow: 'hidden'
      }}>
        {/* Table toolbar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '18px 24px', borderBottom: '2px solid #F1F5F9',
          background: 'linear-gradient(135deg, #FAFBFC 0%, #F8FAFC 100%)'
        }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              Goods Packing Checklist
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0' }}>
              {isPackedAndReady ? 'All goods are verified, packed, and locked for logistics dispatch.' : 'Check each item as it is physically placed into the shipment box.'}
            </p>
          </div>
          {!isPackedAndReady && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  const allPacked = itemsToPack.map(p => ({ ...p, packed: true }));
                  setDispatchPackingModal({ ...dispatchPackingModal, dispatchPacking: allPacked });
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  border: '1px solid #BBF7D0', backgroundColor: '#F0FDF4',
                  color: '#166534', height: '36px', padding: '0 16px',
                  borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer'
                }}
              >
                <CheckCircle style={{ width: '14px', height: '14px' }} /> Mark All Packed
              </button>
              <button
                onClick={() => {
                  const nonePacked = itemsToPack.map(p => ({ ...p, packed: false }));
                  setDispatchPackingModal({ ...dispatchPackingModal, dispatchPacking: nonePacked });
                }}
                style={{
                  border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF',
                  color: '#475569', height: '36px', padding: '0 16px',
                  borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '13px 20px', width: '60px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Check</th>
                <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>Product Code</th>
                <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>Product Description</th>
                <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>BOM Qty</th>
                <th style={{ padding: '13px 20px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {itemsToPack.map((pItem, idx) => {
                const cutLenMm = pItem.cutLengthMm || pItem.lengthMm || (pItem.name && pItem.name.includes('300') ? '300' : (pItem.name && pItem.name.includes('100') ? '100' : (pItem.name && pItem.name.includes('mm') ? pItem.name.match(/\d+\s*mm/i)?.[0]?.replace(/mm/i, '').trim() : '300')));

                return (
                  <tr
                    key={idx}
                    onClick={isPackedAndReady ? undefined : () => {
                      const updatedPacking = itemsToPack.map((pi, i) => i === idx ? { ...pi, packed: !pi.packed } : pi);
                      setDispatchPackingModal({ ...dispatchPackingModal, dispatchPacking: updatedPacking });
                    }}
                    style={{
                      borderBottom: '1px solid #F1F5F9',
                      backgroundColor: pItem.packed ? '#F0FDF4' : '#FFFFFF',
                      cursor: isPackedAndReady ? 'default' : 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={e => (!isPackedAndReady && !pItem.packed) && (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                    onMouseLeave={e => (!isPackedAndReady && !pItem.packed) && (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                  >
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '6px', margin: '0 auto',
                        backgroundColor: pItem.packed ? '#166534' : '#FFFFFF',
                        border: pItem.packed ? '2px solid #166534' : '2px solid #CBD5E1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s ease',
                        boxShadow: pItem.packed ? '0 2px 6px rgba(22,101,52,0.25)' : '0 1px 2px rgba(0,0,0,0.05)'
                      }}>
                        {pItem.packed && <CheckCircle style={{ width: '14px', height: '14px', color: '#FFFFFF' }} />}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: '#2563EB', fontSize: '13px', textAlign: 'left' }}>
                      {(() => {
                        const nameStr = (pItem.name || '').toLowerCase().trim();
                        if (nameStr.includes('mid 30') || nameStr.includes('mid30') || nameStr.includes('mc30')) return 'MC30';
                        if (nameStr.includes('mid 35') || nameStr.includes('mid35') || nameStr.includes('mc35')) return 'MC35';
                        if (nameStr.includes('end 30') || nameStr.includes('end30') || nameStr.includes('ec30')) return 'EC30';
                        if (nameStr.includes('end 35') || nameStr.includes('end35') || nameStr.includes('ec35')) return 'EC35';
                        if (nameStr.includes('mini rail') || nameStr.includes('mr100')) return 'MR100N';
                        if (pItem.code && pItem.code !== 'MR100N') return pItem.code;
                        if (pItem.itemCode && pItem.itemCode !== 'MR100N') return pItem.itemCode;
                        const matchedProduct = VRM_PRODUCTS.find(vp => vp.name && pItem.name && vp.name.toLowerCase().trim() === nameStr);
                        if (matchedProduct) return matchedProduct.code;
                        return pItem.code || 'PROD-CODE';
                      })()}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: pItem.packed ? '700' : '600', color: pItem.packed ? '#166534' : '#1E293B', fontSize: '13px', textAlign: 'left' }}>
                      {pItem.name}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '13px' }}>
                      {pItem.bomQty || pItem.qty || 1} <span style={{ fontSize: '11px', color: '#94A3B8' }}>Nos</span>
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '5px 14px', borderRadius: '20px',
                        fontSize: '11px', fontWeight: '800',
                        backgroundColor: pItem.packed ? '#DCFCE7' : '#FFF7ED',
                        color: pItem.packed ? '#166534' : '#C2410C',
                        border: `1px solid ${pItem.packed ? '#BBF7D0' : '#FED7AA'}`
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: pItem.packed ? '#22C55E' : '#F97316' }}></span>
                        {pItem.packed ? 'Packed' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ─── PACKED ITEMS PHOTOS & VIDEOS VERIFICATION SECTION ─── */}
        <div style={{
          padding: '20px 24px',
          borderTop: '1px solid #E2E8F0',
          backgroundColor: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera size={18} style={{ color: '#0E7490' }} />
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                Packed Items Media Verification (Photos & Videos)
              </h4>
            </div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Stored securely in Businz Media Cache & Cloud Sync
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {!isPackedAndReady && (
              <>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  backgroundColor: '#0E7490', color: '#FFFFFF',
                  padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '800',
                  cursor: 'pointer', boxShadow: '0 2px 4px rgba(14,116,144,0.2)'
                }}>
                  <UploadCloud size={14} /> Upload Packing Photo(s)
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        Array.from(files).forEach(f => {
                          compressAndSaveFile(f, (docMeta) => {
                            if (docMeta) {
                              const photoId = `pack_photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                              saveMediaToCache(docMeta.name, docMeta.dataUrl);
                              const newPhoto = {
                                id: photoId,
                                name: docMeta.name,
                                size: docMeta.size,
                                dataUrl: docMeta.dataUrl,
                                uploadedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                              };
                              setDispatchPackingModal(prev => {
                                const existingMedia = prev?.dispatchPackingMedia || { photos: [], videos: [] };
                                return {
                                  ...prev,
                                  dispatchPackingMedia: { ...existingMedia, photos: [...(existingMedia.photos || []), newPhoto] }
                                };
                              });
                              // Asynchronously stream photo to backend server disk
                              setUploadingCount(prev => prev + 1);
                              uploadMediaFile(f).then(uRes => {
                                if (uRes && uRes.url) {
                                  saveMediaToCache(docMeta.name, uRes.url);
                                  saveMediaToCache(photoId, uRes.url);
                                  setDispatchPackingModal(prev => {
                                    if (!prev) return prev;
                                    const existingMedia = prev?.dispatchPackingMedia || { photos: [], videos: [] };
                                    const updatedPhotos = (existingMedia.photos || []).map(p =>
                                      p.id === photoId ? { ...p, url: uRes.url, dataUrl: uRes.url } : p
                                    );
                                    return {
                                      ...prev,
                                      dispatchPackingMedia: { ...existingMedia, photos: updatedPhotos }
                                    };
                                  });
                                  syncBOMMediaItem('photo', photoId, uRes.url);
                                }
                              }).catch(() => {}).finally(() => {
                                setUploadingCount(prev => Math.max(0, prev - 1));
                              });
                            }
                          });
                        });
                      }
                    }}
                  />
                </label>

                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  backgroundColor: '#FFFFFF', color: '#0E7490', border: '1px solid #0E7490',
                  padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '800',
                  cursor: 'pointer'
                }}>
                  <Video size={14} /> Upload Packing Video
                  <input
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files && e.target.files[0];
                      if (file) {
                        const vItemId = `pack_video_${Date.now()}`;
                        let localUrl = '';
                        try {
                          localUrl = URL.createObjectURL(file);
                        } catch (_) {}

                        const vItem = {
                          id: vItemId,
                          name: file.name,
                          size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
                          dataUrl: localUrl,
                          url: localUrl,
                          uploadedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
                          uploading: true
                        };

                        setDispatchPackingModal(prev => {
                          const existingMedia = prev?.dispatchPackingMedia || { photos: [], videos: [] };
                          return {
                            ...prev,
                            dispatchPackingMedia: { ...existingMedia, videos: [...(existingMedia.videos || []), vItem] }
                          };
                        });

                        // 🎥 Stream large video directly to backend server disk so sales and accounts can view it
                        setUploadingCount(prev => prev + 1);
                        uploadMediaFile(file).then(res => {
                          if (res && res.url) {
                            saveMediaToCache(file.name, res.url);
                            saveMediaToCache(vItemId, res.url);
                            setDispatchPackingModal(prev => {
                              if (!prev) return prev;
                              const existingMedia = prev?.dispatchPackingMedia || { photos: [], videos: [] };
                              const updatedVideos = (existingMedia.videos || []).map(v =>
                                v.id === vItemId ? { ...v, url: res.url, dataUrl: res.url, uploading: false } : v
                              );
                              return {
                                ...prev,
                                dispatchPackingMedia: { ...existingMedia, videos: updatedVideos }
                              };
                            });
                            syncBOMMediaItem('video', vItemId, res.url);
                          }
                        }).catch(err => {
                          console.warn('[DispatchPackingModal video upload error]:', err);
                        }).finally(() => {
                          setUploadingCount(prev => Math.max(0, prev - 1));
                        });
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={async () => {
                    setShowDispatchCameraModal(true);
                    setDispatchCameraError('');
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
                      });
                      dispatchCameraStreamRef.current = stream;
                      setTimeout(() => {
                        if (dispatchCameraVideoRef.current) {
                          dispatchCameraVideoRef.current.srcObject = stream;
                          dispatchCameraVideoRef.current.play().catch(() => {});
                        }
                      }, 100);
                    } catch (err) {
                      setDispatchCameraError('Unable to access camera. Please allow camera permissions or upload images instead.');
                    }
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none',
                    padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '800',
                    cursor: 'pointer', boxShadow: '0 2px 6px rgba(14,116,144,0.3)'
                  }}
                >
                  <Camera size={14} /> Live Camera
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 640;
                    canvas.height = 400;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#0F172A';
                    ctx.fillRect(0, 0, 640, 400);
                    ctx.fillStyle = '#0E7490';
                    ctx.fillRect(40, 60, 560, 280);
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = 'bold 20px sans-serif';
                    ctx.fillText(`PACKED CARTON: ${dispatchPackingModal.bomCode}`, 60, 110);
                    ctx.font = '14px sans-serif';
                    ctx.fillText(`Customer: ${dispatchPackingModal.customerName}`, 60, 150);
                    ctx.fillText(`Verified Packed by Dispatch Desk • ${new Date().toLocaleTimeString()}`, 60, 190);
                    const sampleUrl = canvas.toDataURL('image/jpeg');
                    const samplePhoto = {
                      id: `pack_photo_${Date.now()}`,
                      name: `Packed_Box_Verified_${Date.now().toString().slice(-4)}.jpg`,
                      size: '1.2 MB',
                      dataUrl: sampleUrl,
                      uploadedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    };
                    setDispatchPackingModal(prev => {
                      const existingMedia = prev.dispatchPackingMedia || { photos: [], videos: [] };
                      return {
                        ...prev,
                        dispatchPackingMedia: { ...existingMedia, photos: [...(existingMedia.photos || []), samplePhoto] }
                      };
                    });
                  }}
                  style={{
                    border: '1px dashed #CBD5E1', backgroundColor: '#FFFFFF',
                    color: '#475569', height: '36px', padding: '0 14px',
                    borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  + Add Sample Packing Photo
                </button>
              </>
            )}
          </div>

          {/* Media Gallery Thumbnails */}
          {((dispatchPackingModal.dispatchPackingMedia?.photos || []).length > 0 || (dispatchPackingModal.dispatchPackingMedia?.videos || []).length > 0) ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginTop: '6px' }}>
              {(dispatchPackingModal.dispatchPackingMedia?.photos || []).map((ph, phIdx) => {
                const photoSrc = ph.url || ph.dataUrl || getMediaFromCache(ph.name) || getMediaFromCache(ph.id);
                return (
                  <div key={ph.id || phIdx} style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div
                      onClick={() => handleMediaPreview({ type: 'image', url: photoSrc, name: ph.name })}
                      style={{ height: '90px', backgroundColor: '#0F172A', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <img src={photoSrc} alt={ph.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>
                        {ph.name}
                      </span>
                      {!isPackedAndReady && (
                        <button
                          type="button"
                          onClick={() => {
                            setDispatchPackingModal(prev => {
                              const existingMedia = prev.dispatchPackingMedia || { photos: [], videos: [] };
                              return {
                                ...prev,
                                dispatchPackingMedia: {
                                  ...existingMedia,
                                  photos: existingMedia.photos.filter((_, i) => i !== phIdx)
                                }
                              };
                            });
                          }}
                          style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {(dispatchPackingModal.dispatchPackingMedia?.videos || []).map((vd, vdIdx) => {
                const videoSrc = (vd.url && !vd.url.startsWith('blob:')) ? vd.url : (vd.dataUrl || getMediaFromCache(vd.name) || getMediaFromCache(vd.id) || (vd.name ? `/api/uploads/${vd.name}` : ''));
                return (
                  <div key={vd.id || vdIdx} style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div
                      onClick={() => !vd.uploading && handleMediaPreview({ type: 'video', url: videoSrc, name: vd.name })}
                      style={{ height: '90px', backgroundColor: '#0F172A', cursor: vd.uploading ? 'wait' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', gap: '4px' }}
                    >
                      <Video size={24} style={{ color: vd.uploading ? '#F59E0B' : '#38BDF8' }} />
                      <span style={{ fontSize: '10px', color: vd.uploading ? '#FDE68A' : '#FFFFFF' }}>{vd.uploading ? 'Uploading to server...' : 'Play Video'}</span>
                    </div>
                  <div style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>
                      {vd.name}
                    </span>
                    {!isPackedAndReady && (
                      <button
                        type="button"
                        onClick={() => {
                          setDispatchPackingModal(prev => {
                            const existingMedia = prev.dispatchPackingMedia || { photos: [], videos: [] };
                            return {
                              ...prev,
                              dispatchPackingMedia: {
                                ...existingMedia,
                                videos: existingMedia.videos.filter((_, i) => i !== vdIdx)
                              }
                            };
                          });
                        }}
                        style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic' }}>
              No packing media uploaded yet. Please attach packed item photos / videos before forwarding to Accounts.
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div style={{
          padding: '16px 24px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>Items Packed:</span>
            <span style={{
              fontSize: '13px', fontWeight: '900',
              color: allItemsPacked ? '#059669' : isPartial ? '#D97706' : '#2563EB',
              backgroundColor: allItemsPacked ? '#ECFDF5' : isPartial ? '#FFFBEB' : '#EFF6FF',
              padding: '2px 8px', borderRadius: '6px'
            }}>
              {packedItemsCount} / {totalItemsCount} ({progressPercent}%)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {canCancelBom && !isCancelled && (
              <button
                type="button"
                onClick={() => {
                  handleCancelBomOrder(dispatchPackingModal);
                  setDispatchPackingModal(null);
                }}
                style={{
                  border: '1px solid #FCA5A5',
                  background: '#FEF2F2',
                  color: '#DC2626', height: '40px', padding: '0 16px',
                  borderRadius: '10px', fontSize: '12px', fontWeight: '800',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
                title="Cancel BOM and restore blocked stock back into inventory"
              >
                <XCircle style={{ width: '15px', height: '15px', color: '#DC2626' }} />
                Cancel BOM & Restore Stock
              </button>
            )}
            <button
              onClick={() => setDispatchPackingModal(null)}
              style={{
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569', height: '40px', padding: '0 20px',
                borderRadius: '10px', fontSize: '13px', fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
            {!isPackedAndReady && !isCancelled && (
              <button
                onClick={savePackingData}
                disabled={uploadingCount > 0}
                style={{
                  border: 'none',
                  background: uploadingCount > 0 ? '#94A3B8' : (allItemsPacked ? 'linear-gradient(135deg, #059669, #10B981)' : 'linear-gradient(135deg, #1E40AF, #2563EB)'),
                  color: '#FFFFFF', height: '40px', padding: '0 24px',
                  borderRadius: '10px', fontSize: '13px', fontWeight: '800',
                  cursor: uploadingCount > 0 ? 'not-allowed' : 'pointer',
                  boxShadow: allItemsPacked ? '0 4px 12px rgba(16,185,129,0.35)' : '0 4px 12px rgba(37,99,235,0.3)',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                <CheckCircle style={{ width: '16px', height: '16px' }} />
                {uploadingCount > 0 ? `Uploading Proof (${uploadingCount} in progress)...` : (allItemsPacked ? 'Save & Confirm Packing (Send to Accounts)' : 'Save Packing Progress')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DISPATCH LIVE CAMERA MODAL */}
      {showDispatchCameraModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#0F172A', borderRadius: '16px', border: '1px solid #334155',
            width: '100%', maxWidth: '640px', overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #334155',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Camera size={18} style={{ color: '#38BDF8' }} />
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#FFFFFF' }}>
                  Dispatch Live Camera — Snap Packed Item
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (dispatchCameraStreamRef.current) {
                    dispatchCameraStreamRef.current.getTracks().forEach(t => t.stop());
                    dispatchCameraStreamRef.current = null;
                  }
                  setShowDispatchCameraModal(false);
                }}
                style={{ border: 'none', background: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ position: 'relative', width: '100%', height: '380px', backgroundColor: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {dispatchCameraError ? (
                <div style={{ color: '#F87171', padding: '20px', textAlign: 'center', fontSize: '13px' }}>
                  {dispatchCameraError}
                </div>
              ) : (
                <video
                  ref={dispatchCameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
              <canvas ref={dispatchCameraCanvasRef} style={{ display: 'none' }} />
            </div>

            <div style={{
              padding: '16px 20px', borderTop: '1px solid #334155',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: '#1E293B'
            }}>
              <button
                type="button"
                onClick={() => {
                  if (dispatchCameraStreamRef.current) {
                    dispatchCameraStreamRef.current.getTracks().forEach(t => t.stop());
                    dispatchCameraStreamRef.current = null;
                  }
                  setShowDispatchCameraModal(false);
                }}
                style={{
                  padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '700',
                  backgroundColor: '#334155', color: '#CBD5E1', border: 'none', cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={Boolean(dispatchCameraError)}
                onClick={() => {
                  if (dispatchCameraVideoRef.current && dispatchCameraCanvasRef.current) {
                    const v = dispatchCameraVideoRef.current;
                    const c = dispatchCameraCanvasRef.current;
                    c.width = v.videoWidth || 640;
                    c.height = v.videoHeight || 480;
                    const ctx = c.getContext('2d');
                    ctx.drawImage(v, 0, 0, c.width, c.height);
                    const photoUrl = c.toDataURL('image/jpeg', 0.85);

                    const capturedId = `pack_photo_live_${Date.now()}`;
                    const capturedName = `Live_Packed_Box_${Date.now().toString().slice(-4)}.jpg`;
                    saveMediaToCache(capturedName, photoUrl);
                    saveMediaToCache(capturedId, photoUrl);

                    const capturedPhoto = {
                      id: capturedId,
                      name: capturedName,
                      size: '1.1 MB',
                      dataUrl: photoUrl,
                      uploadedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    };

                    setDispatchPackingModal(prev => {
                      const existingMedia = prev?.dispatchPackingMedia || { photos: [], videos: [] };
                      return {
                        ...prev,
                        dispatchPackingMedia: { ...existingMedia, photos: [...(existingMedia.photos || []), capturedPhoto] }
                      };
                    });

                    // Asynchronously upload camera snapshot to server
                    setUploadingCount(prev => prev + 1);
                    uploadMediaFile(photoUrl, capturedName).then(uRes => {
                      if (uRes && uRes.url) {
                        saveMediaToCache(capturedName, uRes.url);
                        saveMediaToCache(capturedId, uRes.url);
                        setDispatchPackingModal(prev => {
                          if (!prev) return prev;
                          const existingMedia = prev?.dispatchPackingMedia || { photos: [], videos: [] };
                          const updatedPhotos = (existingMedia.photos || []).map(p =>
                            p.id === capturedId ? { ...p, url: uRes.url, dataUrl: uRes.url } : p
                          );
                          return {
                            ...prev,
                            dispatchPackingMedia: { ...existingMedia, photos: updatedPhotos }
                          };
                        });
                        syncBOMMediaItem('photo', capturedId, uRes.url);
                      }
                    }).catch(() => {}).finally(() => {
                      setUploadingCount(prev => Math.max(0, prev - 1));
                    });

                    if (dispatchCameraStreamRef.current) {
                      dispatchCameraStreamRef.current.getTracks().forEach(t => t.stop());
                      dispatchCameraStreamRef.current = null;
                    }
                    setShowDispatchCameraModal(false);
                  }
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none',
                  padding: '10px 22px', borderRadius: '10px', fontSize: '13px', fontWeight: '800',
                  cursor: 'pointer', boxShadow: '0 4px 12px rgba(14,116,144,0.4)'
                }}
              >
                <Camera size={16} /> Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOCAL MEDIA LIGHTBOX PREVIEW */}
      {localActiveMediaPreview && (
        <ActiveMediaPreviewModal
          activeMediaPreviewModal={localActiveMediaPreview}
          onClose={() => setLocalActiveMediaPreview(null)}
        />
      )}
    </div>
  );
}
