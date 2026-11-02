import React, { useState, useRef, useEffect } from "react";
import {
  Check, Trash2, CheckCircle, CheckSquare, XCircle, ChevronLeft,
  UploadCloud, Package, Upload, Receipt, Camera, Video, Play, Save, X, Loader2, Truck, Clock, User, AlertTriangle, FileText
} from "lucide-react";
import { stripDataUrlsFromRecord, saveMediaToCache, getMediaFromCache, getMediaFromCacheAsync, uploadMediaFile } from "../../utils/otherViewsShared";
import { saveCloudStore, saveCloudBomRow } from "../../utils/supabaseDataSync";
import { addLiveNotification } from "../Header";
import { notifyBomPackedAndSentToAccounts } from "../../services/notificationService";
import { VRM_PRODUCTS } from "../../utils/vrmProductsData";
import { centralInventoryStore } from "../../utils/centralInventoryStore";
import { ActiveMediaPreviewModal } from "./DispatchAndPreviewModals";
import { uploadBomDocumentFile, deleteBomDocumentFile } from "../../utils/bomStorageClient";
import { resolveDocumentUrlAsync } from "../../utils/documentResolver";

/**
 * Helper to deduplicate repeated address segments so delivery address is never printed multiple times
 */
function cleanDisplayAddress(addr) {
  if (!addr || typeof addr !== 'string') return addr || '';
  const parts = addr.split(',').map(p => p.trim()).filter(Boolean);
  const seen = new Set();
  const unique = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(part);
    }
  }
  return unique.join(', ');
}

/**
 * Async Dispatch Photo Thumbnail Component
 * Resolves signed URLs, local caches, and fallback server uploads asynchronously
 * so photos never show a black or broken preview.
 */
function DispatchPhotoThumbnail({ ph, phIdx, bomCode, onPreview, onRemove, canRemove, formatUploadTime }) {
  const [src, setSrc] = useState(
    ph.url || ph.dataUrl || ph.previewUrl || getMediaFromCache(ph.name) || getMediaFromCache(ph.id) || ''
  );
  const [loading, setLoading] = useState(!src);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;

    // Check if we already have a usable direct or base64 URL
    const existing = ph.url || ph.dataUrl || ph.previewUrl || getMediaFromCache(ph.name) || getMediaFromCache(ph.id);
    if (existing && !existing.startsWith('blob:')) {
      setSrc(existing);
      setLoading(false);
      setLoadError(false);
      return;
    }

    setLoading(true);

    const resolveUrl = async () => {
      // 1. If it has storageBucket/storagePath, construct the direct static URL immediately
      if (ph.storagePath) {
        const directUrl = `/api/uploads/${ph.storageBucket || 'bom-documents'}/${ph.storagePath}`;
        if (active) {
          setSrc(directUrl);
          setLoading(false);
          setLoadError(false);
          return;
        }
      }

      // 2. Try documentResolver for signed URL if needed
      if (ph.storageBucket || ph.storagePath) {
        try {
          const signedUrl = await resolveDocumentUrlAsync(ph, bomCode);
          if (active && signedUrl) {
            setSrc(signedUrl);
            setLoading(false);
            setLoadError(false);
            return;
          }
        } catch (_) {}
      }

      // 2. Try async media cache / server media finder
      const docKey = ph.name || ph.id || ph.storagePath;
      if (docKey) {
        try {
          const cachedUrl = await getMediaFromCacheAsync(docKey);
          if (active && cachedUrl) {
            setSrc(cachedUrl);
            setLoading(false);
            setLoadError(false);
            return;
          }
        } catch (_) {}
      }

      // 3. Try /api/uploads direct fallback
      if (ph.name) {
        const directUploadUrl = `/api/uploads/${encodeURIComponent(ph.name)}`;
        if (active) {
          setSrc(directUploadUrl);
          setLoading(false);
          setLoadError(false);
        }
      } else {
        if (active) {
          setLoading(false);
          setLoadError(true);
        }
      }
    };

    resolveUrl();

    return () => { active = false; };
  }, [ph, bomCode]);

  const timeText = formatUploadTime(ph);

  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div
        onClick={() => onPreview({ ...ph, type: 'image', url: src, name: ph.name })}
        style={{
          height: '95px',
          backgroundColor: '#F8FAFC',
          cursor: 'pointer',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#64748B' }}>
            <Loader2 className="animate-spin" size={20} style={{ color: '#0E7490' }} />
            <span style={{ fontSize: '10px', fontWeight: '700' }}>Loading...</span>
          </div>
        ) : src && !loadError ? (
          <img
            src={src}
            alt={ph.name || 'Packing photo'}
            onError={() => {
              if (ph.name && !src.includes('/api/uploads/')) {
                setSrc(`/api/uploads/${encodeURIComponent(ph.name)}`);
              } else {
                setLoadError(true);
              }
            }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#94A3B8' }}>
            <Camera size={22} style={{ color: '#CBD5E1' }} />
            <span style={{ fontSize: '10px', fontWeight: '600' }}>Photo Preview</span>
          </div>
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15,23,42,0.82)', color: '#FFFFFF', padding: '3px 8px', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', backdropFilter: 'blur(2px)' }}>
          <Clock size={11} style={{ color: '#38BDF8', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{timeText}</span>
        </div>
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }} title={ph.name}>
          {ph.name || `Photo ${phIdx + 1}`}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
            title="Remove photo"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function DispatchPackingModal({
  dispatchPackingModal,
  setDispatchPackingModal,
  bomStore,
  setBomStore,
  setInvoiceList,
  canCancelBom = false,
  handleCancelBomOrder = () => {},
  setActiveMediaPreviewModal,
  setVehicleLoadingModal,
  userRole = 'Dispatch Head'
}) {
  const [showDispatchCameraModal, setShowDispatchCameraModal] = useState(false);
  const [showAddPhotoMenu, setShowAddPhotoMenu] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPartialConfirmModal, setShowPartialConfirmModal] = useState(false);
  const [dispatchCameraError, setDispatchCameraError] = useState('');
  const [localActiveMediaPreview, setLocalActiveMediaPreview] = useState(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const dispatchCameraStreamRef = useRef(null);
  const dispatchCameraVideoRef = useRef(null);
  const dispatchCameraCanvasRef = useRef(null);

  // Safety auto-reset so buttons are never permanently stuck disabled due to unhandled network/file errors
  useEffect(() => {
    if (uploadingCount > 0) {
      const timer = setTimeout(() => {
        setUploadingCount(0);
      }, 12000);
      return () => clearTimeout(timer);
    }
  }, [uploadingCount]);

  const handleOpenLiveCamera = async () => {
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
  };

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

  const handleMediaPreview = async (media) => {
    let resolvedUrl = media.url;
    if (!resolvedUrl && (media.storageBucket || media.storagePath)) {
      try {
        resolvedUrl = await resolveDocumentUrlAsync(media, dispatchPackingModal.bomCode);
      } catch (_) {}
    }
    if (!resolvedUrl && (media.name || media.id)) {
      try {
        resolvedUrl = await getMediaFromCacheAsync(media.name || media.id);
      } catch (_) {}
    }
    if (!resolvedUrl && media.name) {
      resolvedUrl = `/api/uploads/${encodeURIComponent(media.name)}`;
    }
    const finalMedia = { ...media, url: resolvedUrl || media.dataUrl, bomCode: dispatchPackingModal.bomCode };
    if (typeof setActiveMediaPreviewModal === 'function') {
      setActiveMediaPreviewModal(finalMedia);
    }
    setLocalActiveMediaPreview(finalMedia);
  };

  const isCancelled = Boolean(
    dispatchPackingModal.cancelled ||
    dispatchPackingModal.status === 'Cancelled' ||
    dispatchPackingModal.status === 'CANCELLED' ||
    dispatchPackingModal.status === 'Cancelled & Stock Restored' ||
    (dispatchPackingModal.status && typeof dispatchPackingModal.status === 'string' && dispatchPackingModal.status.toLowerCase().includes('cancel'))
  );

  // Accounts locked: Accounts has officially verified this BOM or it has proceeded to Billing / Vehicle Loading / Dispatched
  const isAccountsLocked = Boolean(
    dispatchPackingModal.accountsVerification?.verified ||
    dispatchPackingModal.status === 'Accounts Verified & Passed to Invoice' ||
    dispatchPackingModal.status === 'ACCOUNTS VERIFIED' ||
    dispatchPackingModal.status === 'Invoice Confirmed' ||
    dispatchPackingModal.status === 'Awaiting Vehicle Loading & Dispatch' ||
    dispatchPackingModal.status === 'AWAITING VEHICLE LOADING' ||
    dispatchPackingModal.status === 'Closed' ||
    dispatchPackingModal.status === 'CLOSED' ||
    dispatchPackingModal.status === 'COMPLETED & DISPATCHED' ||
    dispatchPackingModal.status === 'Completed' ||
    dispatchPackingModal.tabGroup === 'AwaitingLoading' ||
    dispatchPackingModal.tabGroup === 'Closed'
  );

  const isOrderPartiallyPacked = Boolean(
    dispatchPackingModal.status === 'Partially Packed' ||
    dispatchPackingModal.status === 'Partially Packed - Sent to Accounts' ||
    dispatchPackingModal.packingStatus === 'PARTIALLY_PACKED' ||
    dispatchPackingModal.isPartialPacking ||
    dispatchPackingModal.accountsVerification?.isPartialPacking ||
    (Array.isArray(dispatchPackingModal.dispatchPacking) && dispatchPackingModal.dispatchPacking.length > 0 &&
      dispatchPackingModal.dispatchPacking.filter(p => p.packed).length > 0 &&
      dispatchPackingModal.dispatchPacking.filter(p => p.packed).length < dispatchPackingModal.dispatchPacking.length)
  );

  const isPartiallySentToAccounts = Boolean(
    isOrderPartiallyPacked && (
      dispatchPackingModal.status === 'Partially Packed - Sent to Accounts' ||
      dispatchPackingModal.accountsVerification?.readyForAccounts
    )
  );

  const isAlreadySentToAccounts = Boolean(
    !isAccountsLocked && !isOrderPartiallyPacked && (
      dispatchPackingModal.status === 'Packed & Awaiting Accounts Verification' ||
      dispatchPackingModal.status === 'PACKING VERIFIED - SENT TO ACCOUNTS' ||
      dispatchPackingModal.status === 'Packing Verified - Sent to Accounts' ||
      dispatchPackingModal.tabGroup === 'Packed' ||
      dispatchPackingModal.packingStatus === 'PACKING_VERIFIED' ||
      (dispatchPackingModal.accountsVerification?.readyForAccounts && !dispatchPackingModal.accountsVerification?.isPartialPacking)
    )
  );

  const rawItems = (dispatchPackingModal.items || []).map(it => {
    const nameStr = (it.name || it.c2 || 'Item').toLowerCase().trim();
    const code = nameStr.includes('mid 30') ? 'MC30' : (nameStr.includes('mini rail') ? 'MR100N' : (it.code || it.itemCode || it.productCode || it.c1 || null));
    const isPacked = Boolean(isAccountsLocked || isAlreadySentToAccounts);
    return {
      name: it.name || it.c2 || 'Item',
      code,
      bomQty: it.qty || 1,
      packed: isPacked,
      packedQty: isPacked ? (it.qty || 1) : '',
      isPresetItem: Boolean(it.isPresetItem),
      presetGroupId: it.presetGroupId || null,
      presetName: it.presetName || null,
      category: it.category || null,
      cutLengthMm: it.cutLengthMm || it.lengthMm || null
    };
  });
  const itemsToPack = (dispatchPackingModal.dispatchPacking && Array.isArray(dispatchPackingModal.dispatchPacking) && dispatchPackingModal.dispatchPacking.length > 0)
    ? dispatchPackingModal.dispatchPacking.map((p, idx) => {
        const rawMatch = (dispatchPackingModal.items || [])[idx] || (dispatchPackingModal.items || []).find(it => (it.name && p.name && it.name.toLowerCase().trim() === p.name.toLowerCase().trim()) || (it.code && p.code && it.code === p.code)) || {};
        const nameStr = (p.name || p.itemName || '').toLowerCase().trim();
        const code = nameStr.includes('mid 30') ? 'MC30' : (nameStr.includes('mini rail') ? 'MR100N' : (p.code || rawMatch.code || null));
        const isPacked = isAccountsLocked ? (p.packed !== false) : Boolean(p.packed || p.scanned || (p.packedQty !== undefined && p.packedQty !== null && p.packedQty !== '' && Number(p.packedQty) > 0) || isAlreadySentToAccounts);
        const resolvedPackedQty = (p.packedQty !== undefined && p.packedQty !== null && p.packedQty !== '')
          ? p.packedQty
          : (isPacked ? (p.bomQty || p.qty || rawMatch.qty || 1) : '');
        return {
          ...p,
          code,
          bomQty: p.bomQty || p.qty || rawMatch.qty || 1,
          packed: isPacked,
          packedQty: resolvedPackedQty,
          isPresetItem: Boolean(p.isPresetItem || rawMatch.isPresetItem),
          presetGroupId: p.presetGroupId || rawMatch.presetGroupId || null,
          presetName: p.presetName || rawMatch.presetName || null,
          category: p.category || rawMatch.category || null,
          cutLengthMm: p.cutLengthMm || p.lengthMm || rawMatch.cutLengthMm || rawMatch.lengthMm || null
        };
      })
    : rawItems;

  const isPackedAndReady = Boolean(
    isCancelled ||
    dispatchPackingModal.isReadOnly ||
    dispatchPackingModal.isViewOnly ||
    isAccountsLocked
  );

  const formatUploadTime = (item) => {
    if (!item) return '';
    if (item.uploadTime) return item.uploadTime;
    const raw = item.uploadedAt || item.createdAt || item.date;
    if (!raw) return 'Recently';
    try {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        return `${dateStr}, ${timeStr}`;
      }
      return String(raw);
    } catch (_) {
      return String(raw);
    }
  };

  const syncModalMediaToStore = (updatedMedia) => {
    if (!targetCode) return;
    if (typeof setBomStore === 'function') {
      setBomStore(prev => (prev || []).map(b => (b.bomCode === targetCode || b.code === targetCode || b.id === targetCode) ? { ...b, dispatchPackingMedia: updatedMedia } : b));
    }
    try {
      const cur = JSON.parse(localStorage.getItem('controlroom_bom_store') || '[]');
      const next = cur.map(b => (b.bomCode === targetCode || b.code === targetCode || b.id === targetCode) ? { ...b, dispatchPackingMedia: updatedMedia } : b);
      localStorage.setItem('controlroom_bom_store', JSON.stringify(next.map(stripDataUrlsFromRecord)));
      const targetBom = next.find(b => b.bomCode === targetCode || b.code === targetCode || b.id === targetCode);
      if (targetBom) {
        saveCloudBomRow(targetBom);
        window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: targetBom } }));
        fetch('/api/boms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bom: stripDataUrlsFromRecord(targetBom), isUpdate: true })
        }).catch(() => {});
      }
    } catch (_) {}
  };

  const packedItemsCount = isAlreadySentToAccounts ? itemsToPack.length : itemsToPack.filter(p => p.packed).length;
  const totalItemsCount = itemsToPack.length;
  const allItemsPacked = isAlreadySentToAccounts || (totalItemsCount > 0 && packedItemsCount === totalItemsCount);
  const progressPercent = isAlreadySentToAccounts ? 100 : (totalItemsCount > 0 ? Math.round((packedItemsCount / totalItemsCount) * 100) : 0);
  const isPartial = !isAlreadySentToAccounts && packedItemsCount > 0 && !allItemsPacked;

  const isWhileDispatch = Boolean(
    dispatchPackingModal?.paymentType === 'Payment While Dispatch' ||
    String(dispatchPackingModal?.paymentType || '').toLowerCase().includes('while dispatch') ||
    String(dispatchPackingModal?.paymentType || '').toLowerCase().includes('before dispatch')
  );
  const isPartialPaid = Boolean(
    dispatchPackingModal?.paymentType === 'Partial Paid' ||
    dispatchPackingModal?.paymentType === 'Partial Payment' ||
    String(dispatchPackingModal?.paymentType || '').toLowerCase().includes('partial')
  );

  const hasPaymentProof = Boolean(
    dispatchPackingModal?.paymentProofDoc ||
    dispatchPackingModal?.payments?.proofDocObj ||
    dispatchPackingModal?.payments?.proofDoc ||
    dispatchPackingModal?.proofDoc ||
    dispatchPackingModal?.paymentProofAttached ||
    dispatchPackingModal?.hasPaymentProof
  );

  const needsSalesPaymentProof = (isWhileDispatch || isPartialPaid) && !hasPaymentProof;

  const handleSaveDraft = () => {
    if (uploadingCount > 0) {
      alert('Media files (photos/videos) are currently uploading to the server. Please wait a few seconds before saving.');
      return;
    }

    try {
      const rawMedia = dispatchPackingModal.dispatchPackingMedia;
      const cleanMedia = rawMedia ? {
        photos: (rawMedia.photos || []).map(p => {
          const directStorageUrl = p.storagePath ? `/api/uploads/${p.storageBucket || 'bom-documents'}/${p.storagePath}` : '';
          const bestUrl = (p.url && !p.url.startsWith('blob:'))
            ? p.url
            : (directStorageUrl || getMediaFromCache(p.id) || getMediaFromCache(p.name) || (p.dataUrl && !p.dataUrl.startsWith('blob:') ? p.dataUrl : (p.name ? `/api/uploads/${encodeURIComponent(p.name)}` : '')));
          const cleanBestUrl = (bestUrl && !bestUrl.startsWith('blob:')) ? bestUrl : (directStorageUrl || undefined);
          return {
            ...p,
            url: cleanBestUrl,
            dataUrl: (p.dataUrl && !p.dataUrl.startsWith('blob:')) ? p.dataUrl : cleanBestUrl
          };
        }),
        videos: (rawMedia.videos || []).map(v => {
          const directStorageUrl = v.storagePath ? `/api/uploads/${v.storageBucket || 'bom-documents'}/${v.storagePath}` : '';
          const bestUrl = (v.url && !v.url.startsWith('blob:'))
            ? v.url
            : (directStorageUrl || getMediaFromCache(v.id) || getMediaFromCache(v.name) || (v.dataUrl && !v.dataUrl.startsWith('blob:') ? v.dataUrl : (v.name ? `/api/uploads/${encodeURIComponent(v.name)}` : '')));
          const cleanBestUrl = (bestUrl && !bestUrl.startsWith('blob:')) ? bestUrl : (directStorageUrl || undefined);
          return {
            ...v,
            url: cleanBestUrl,
            dataUrl: (v.dataUrl && !v.dataUrl.startsWith('blob:')) ? v.dataUrl : cleanBestUrl,
            uploading: false
          };
        })
      } : null;

      const targetCode = dispatchPackingModal.bomCode || dispatchPackingModal.code || dispatchPackingModal.id;
      const matchingBom = (bomStore || []).find(b => b.bomCode === targetCode || b.code === targetCode || b.id === targetCode);

      const resolvedCustomer = (dispatchPackingModal.customerName && dispatchPackingModal.customerName !== 'Customer' && dispatchPackingModal.customerName !== '-')
        ? dispatchPackingModal.customerName
        : (matchingBom?.customerName || 'Customer Order');

      const confirmedDraftItems = itemsToPack.map(it => ({
        ...it,
        qty: it.bomQty || it.qty || 1,
        packed: Boolean(it.packed),
        packedQty: it.packedQty !== undefined && it.packedQty !== null && it.packedQty !== '' ? Number(it.packedQty) : (it.packed ? (it.bomQty || it.qty || 1) : '')
      }));

      const updatedDraftBom = {
        ...dispatchPackingModal,
        customerName: resolvedCustomer,
        companyName: resolvedCustomer,
        dispatchPacking: confirmedDraftItems,
        dispatchPackingMedia: cleanMedia,
        dispatchPackingDraft: true,
        status: dispatchPackingModal.status || 'Draft Packing',
        packingStatus: 'PACKING_IN_PROGRESS',
        isPartialPacking: Boolean(packedItemsCount < totalItemsCount),
        packedItemsCount: packedItemsCount,
        totalItemsCount: totalItemsCount,
        accountsVerification: {
          ...(dispatchPackingModal.accountsVerification || {}),
          readyForAccounts: false
        },
        isUpdate: true
      };

      // 1. Update React state immediately
      if (typeof setBomStore === 'function') {
        setBomStore(prev => (prev || []).map(b => (b.bomCode === targetCode || b.code === targetCode || b.id === targetCode) ? { ...b, ...updatedDraftBom } : b));
      }

      // 2. Persist to storage & cloud
      saveCloudBomRow(updatedDraftBom);
      try {
        const currentLocal = JSON.parse(localStorage.getItem('controlroom_bom_store') || '[]');
        const updatedLocal = currentLocal.map(b => (b.bomCode === targetCode || b.code === targetCode || b.id === targetCode) ? { ...b, ...updatedDraftBom } : b);
        localStorage.setItem('controlroom_bom_store', JSON.stringify(updatedLocal.map(stripDataUrlsFromRecord)));
      } catch (_) {}

      // 3. Dispatch global sync event
      window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: updatedDraftBom } }));

      // 4. Push to server
      try {
        fetch('/api/boms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bom: stripDataUrlsFromRecord(updatedDraftBom), isUpdate: true })
        }).catch(() => {});
      } catch (_) {}

      alert(`💾 Packing Progress Saved as Draft!\n\nAll checked products (${packedItemsCount}/${totalItemsCount}), entered quantities, and photos/videos have been securely saved.\n\nThis order remains in Dispatch and will NOT move to the next stage until you click "Complete Packing". You can re-open, edit, recheck, and add more photos anytime.`);
      setDispatchPackingModal(null);
    } catch (err) {
      console.error('Error saving packing draft:', err);
      alert('Unable to save draft. Please try again.');
    }
  };

  const savePackingData = (isPartialSave = false, proceedToLoading = false, sendPartialToAccounts = false) => {
    if (uploadingCount > 0) {
      alert('Media files (photos/videos) are currently uploading to the server. Please wait a few seconds so that Sales and Accounts can view them.');
      return;
    }

    try {
      const wasAlreadySentToAccounts = Boolean(isAlreadySentToAccounts || isAccountsLocked);
      let confirmedItems;
      let nextStatus;
      let isFullyConfirmed = false;

    const is100Paid = Boolean(
      dispatchPackingModal.paymentType === '100% Paid' ||
      dispatchPackingModal.paymentType === '100% Advance' ||
      (dispatchPackingModal.paymentType && dispatchPackingModal.paymentType.includes('100%')) ||
      (dispatchPackingModal.c4 && dispatchPackingModal.c4.includes('100%')) ||
      (dispatchPackingModal.c5 && dispatchPackingModal.c5.includes('100%'))
    );

    const isWhileDispatch = Boolean(
      dispatchPackingModal.paymentType === 'Payment While Dispatch' ||
      String(dispatchPackingModal.paymentType || '').toLowerCase().includes('while dispatch') ||
      String(dispatchPackingModal.paymentType || '').toLowerCase().includes('before dispatch')
    );
    const isPartialPaid = Boolean(
      dispatchPackingModal.paymentType === 'Partial Paid' ||
      dispatchPackingModal.paymentType === 'Partial Payment' ||
      String(dispatchPackingModal.paymentType || '').toLowerCase().includes('partial')
    );

    const hasPaymentProof = Boolean(
      dispatchPackingModal.paymentProofDoc ||
      dispatchPackingModal.payments?.proofDocObj ||
      dispatchPackingModal.payments?.proofDoc ||
      dispatchPackingModal.proofDoc ||
      dispatchPackingModal.paymentProofAttached ||
      dispatchPackingModal.hasPaymentProof
    );

    const needsSalesPaymentProof = (isWhileDispatch || isPartialPaid) && !hasPaymentProof;

    if (sendPartialToAccounts) {
      // User confirmed partial packing
      confirmedItems = itemsToPack.map(it => ({
        ...it,
        qty: it.bomQty || it.qty || 1,
        packed: Boolean(it.packed),
        packedQty: it.packed ? (it.packedQty !== undefined && it.packedQty !== null && it.packedQty !== '' ? Number(it.packedQty) : (it.bomQty || it.qty || 1)) : 0
      }));
      nextStatus = needsSalesPaymentProof ? 'Partially Packed — Awaiting Sales Payment Proof' : 'Partially Packed - Sent to Accounts';
      isFullyConfirmed = false;
    } else if (isPartialSave) {
      // User explicitly saving partial packing progress without sending to Accounts yet
      confirmedItems = itemsToPack.map(it => ({
        ...it,
        qty: it.bomQty || it.qty || 1,
        packed: Boolean(it.packed),
        packedQty: it.packed ? (it.packedQty !== undefined && it.packedQty !== null && it.packedQty !== '' ? Number(it.packedQty) : (it.bomQty || it.qty || 1)) : 0
      }));
      nextStatus = 'Partially Packed';
      isFullyConfirmed = false;
    } else {
      // User confirmed packing: all items marked packed
      confirmedItems = (itemsToPack && itemsToPack.length > 0)
        ? itemsToPack.map(it => ({
            ...it,
            qty: it.bomQty || it.qty || 1,
            packed: true,
            packedQty: (it.packedQty !== undefined && it.packedQty !== null && it.packedQty !== '' && Number(it.packedQty) > 0)
              ? Number(it.packedQty)
              : (it.bomQty || it.qty || 1)
          }))
        : (dispatchPackingModal.items || []).map(it => ({
            code: it.code,
            name: it.name,
            bomQty: it.qty || it.bomQty || 1,
            qty: it.qty || it.bomQty || 1,
            packed: true,
            packedQty: it.qty || it.bomQty || 1
          }));

      nextStatus = needsSalesPaymentProof ? 'Packed — Awaiting Sales Payment Proof' : 'Packed & Awaiting Accounts Verification';
      isFullyConfirmed = true;
    }

    const needsSalesPaymentNotification = (isFullyConfirmed || sendPartialToAccounts) && needsSalesPaymentProof;
    const shouldSendToAccounts = (isFullyConfirmed || sendPartialToAccounts) && !needsSalesPaymentProof;

    const accountsVerificationData = shouldSendToAccounts
      ? ((dispatchPackingModal.accountsVerification && dispatchPackingModal.accountsVerification.verified)
          ? dispatchPackingModal.accountsVerification
          : {
              paymentStatus: (dispatchPackingModal.accountsVerification && dispatchPackingModal.accountsVerification.paymentStatus) || null,
              hardCopyReceived: Boolean(dispatchPackingModal.accountsVerification?.hardCopyReceived),
              softCopyReceived: Boolean(dispatchPackingModal.accountsVerification?.softCopyReceived),
              verified: Boolean(dispatchPackingModal.accountsVerification?.verified),
              readyForAccounts: true,
              isPartialPacking: Boolean(sendPartialToAccounts || !isFullyConfirmed),
              packedItemsCount: packedItemsCount,
              totalItemsCount: totalItemsCount,
              packedAt: dispatchPackingModal.accountsVerification?.packedAt || new Date().toISOString()
            })
      : {
          ...(dispatchPackingModal.accountsVerification || {}),
          readyForAccounts: false,
          isPartialPacking: Boolean(sendPartialToAccounts || !isFullyConfirmed),
          paymentStatus: needsSalesPaymentProof ? 'Awaiting Sales Payment Slip' : (dispatchPackingModal.accountsVerification?.paymentStatus || null)
        };

    const rawMedia = dispatchPackingModal.dispatchPackingMedia;
    const cleanMedia = rawMedia ? {
      photos: (rawMedia.photos || []).map(p => {
        const directStorageUrl = p.storagePath ? `/api/uploads/${p.storageBucket || 'bom-documents'}/${p.storagePath}` : '';
        const bestUrl = (p.url && !p.url.startsWith('blob:'))
          ? p.url
          : (directStorageUrl || getMediaFromCache(p.id) || getMediaFromCache(p.name) || (p.dataUrl && !p.dataUrl.startsWith('blob:') ? p.dataUrl : (p.name ? `/api/uploads/${encodeURIComponent(p.name)}` : '')));
        const cleanBestUrl = (bestUrl && !bestUrl.startsWith('blob:')) ? bestUrl : (directStorageUrl || undefined);
        return {
          ...p,
          url: cleanBestUrl,
          dataUrl: (p.dataUrl && !p.dataUrl.startsWith('blob:')) ? p.dataUrl : cleanBestUrl
        };
      }),
      videos: (rawMedia.videos || []).map(v => {
        const directStorageUrl = v.storagePath ? `/api/uploads/${v.storageBucket || 'bom-documents'}/${v.storagePath}` : '';
        const bestUrl = (v.url && !v.url.startsWith('blob:'))
          ? v.url
          : (directStorageUrl || getMediaFromCache(v.id) || getMediaFromCache(v.name) || (v.dataUrl && !v.dataUrl.startsWith('blob:') ? v.dataUrl : (v.name ? `/api/uploads/${encodeURIComponent(v.name)}` : '')));
        const cleanBestUrl = (bestUrl && !bestUrl.startsWith('blob:')) ? bestUrl : (directStorageUrl || undefined);
        return {
          ...v,
          url: cleanBestUrl,
          dataUrl: (v.dataUrl && !v.dataUrl.startsWith('blob:')) ? v.dataUrl : cleanBestUrl,
          uploading: false
        };
      })
    } : null;

    const packedByUserId = (typeof localStorage !== 'undefined' ? localStorage.getItem('controlroom_logged_emp_id') || '' : '').trim();
    const loggedName = typeof localStorage !== 'undefined' ? localStorage.getItem('controlroom_logged_user_name') || '' : '';
    const packedByName = (loggedName || userRole || 'Dispatch Executive').trim();
    const packedAt = new Date().toISOString();

    const isDispatchUser = (name) => {
      if (!name) return false;
      const lower = String(name).toLowerCase().trim();
      return lower === 'anu' || lower.includes('dispatch') || lower.includes('fulfillment');
    };

    const matchingBom = (bomStore || []).find(b => b.bomCode === dispatchPackingModal.bomCode || b.code === dispatchPackingModal.bomCode || b.id === dispatchPackingModal.id);
    let resolvedSpName = dispatchPackingModal.salesPerson || matchingBom?.salesPerson || dispatchPackingModal.createdBy || matchingBom?.createdBy || 'Sales Department';
    if (isDispatchUser(resolvedSpName)) {
      if (matchingBom?.createdBy && !isDispatchUser(matchingBom.createdBy)) {
        resolvedSpName = matchingBom.createdBy;
      } else if (dispatchPackingModal.createdBy && !isDispatchUser(dispatchPackingModal.createdBy)) {
        resolvedSpName = dispatchPackingModal.createdBy;
      } else {
        resolvedSpName = 'Sales Department';
      }
    }
    const resolvedSpCode = dispatchPackingModal.salesPersonCode || matchingBom?.salesPersonCode || dispatchPackingModal.createdById || matchingBom?.createdById || '';
    const resolvedCreatedBy = (dispatchPackingModal.createdBy && !isDispatchUser(dispatchPackingModal.createdBy))
      ? dispatchPackingModal.createdBy
      : (matchingBom?.createdBy && !isDispatchUser(matchingBom.createdBy))
        ? matchingBom.createdBy
        : resolvedSpName;
    const resolvedCreatedById = dispatchPackingModal.createdById || matchingBom?.createdById || resolvedSpCode;

    const resolvedCustomer = (dispatchPackingModal.customerName && dispatchPackingModal.customerName !== 'Customer' && dispatchPackingModal.customerName !== '-')
      ? dispatchPackingModal.customerName
      : (dispatchPackingModal.companyName && dispatchPackingModal.companyName !== '-')
        ? dispatchPackingModal.companyName
        : (matchingBom?.customerName && matchingBom?.customerName !== 'Customer')
          ? matchingBom.customerName
          : (matchingBom?.companyName || 'Customer Order');

    const updatedPackedBom = {
      ...dispatchPackingModal,
      customerName: resolvedCustomer,
      companyName: resolvedCustomer,
      dispatchPacking: confirmedItems,
      dispatchPackingMedia: cleanMedia,
      status: nextStatus,
      packingStatus: isFullyConfirmed ? 'PACKING_VERIFIED' : 'PARTIALLY_PACKED',
      isPartialPacking: Boolean(sendPartialToAccounts || (!isFullyConfirmed && packedItemsCount > 0)),
      packedAt: packedAt,
      packedBy: packedByName,
      packedById: packedByUserId,
      packingCompletedAt: isFullyConfirmed ? packedAt : null,
      salesPerson: resolvedSpName,
      salesPersonCode: resolvedSpCode,
      createdBy: resolvedCreatedBy,
      createdById: resolvedCreatedById,
      awaitingSalesPaymentProof: Boolean(needsSalesPaymentProof),
      pendingSalesDispatchPayment: Boolean(needsSalesPaymentProof),
      reissuedByAccounts: wasAlreadySentToAccounts ? Boolean(dispatchPackingModal.reissuedByAccounts) : false,
      isAccountsDone: wasAlreadySentToAccounts ? Boolean(dispatchPackingModal.isAccountsDone) : false,
      accountsVerification: wasAlreadySentToAccounts
        ? (dispatchPackingModal.accountsVerification || accountsVerificationData)
        : {
            ...accountsVerificationData,
            packedAt: packedAt,
            packedBy: packedByName,
            packedById: packedByUserId
          },
      isUpdate: true
    };
    delete updatedPackedBom.c2;
    delete updatedPackedBom.c3;
    delete updatedPackedBom.c4;
    delete updatedPackedBom.c5;
    delete updatedPackedBom.c6;
    delete updatedPackedBom.c7;
    delete updatedPackedBom.dateTimeObj;
    delete updatedPackedBom.dateTime;

    const targetCode = dispatchPackingModal.bomCode || dispatchPackingModal.code || dispatchPackingModal.id;

    // Stock remains strictly in Reserved state during packing until Vehicle Loading is finalized

    // 2. Update React state immediately
    setBomStore(prev => {
      const updated = (prev || []).map(b => (b.bomCode === targetCode || b.code === targetCode || b.id === targetCode || b.id === dispatchPackingModal.id) ? { ...b, ...updatedPackedBom } : b);
      return updated;
    });

    // 3. Persist atomically to Supabase cloud store and localStorage
    saveCloudBomRow(updatedPackedBom);
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

    const targetBomCode = dispatchPackingModal.bomCode || dispatchPackingModal.code;
    if (targetBomCode && typeof setInvoiceList === 'function') {
      setInvoiceList(prev => (prev || []).map(inv => {
        const isMatch = inv.poNo === targetBomCode || inv.bomCode === targetBomCode;
        if (isMatch) {
          const currentItems = (inv.items && inv.items.length > 0) ? inv.items : (dispatchPackingModal.items || []);
          const updatedInvItems = currentItems.map((it, idx) => {
            const matchingPacked = itemsToPack.find(p => (p.name && it.name && p.name.toLowerCase().trim() === it.name.toLowerCase().trim()) || (p.code && it.code && p.code === it.code));
            return matchingPacked ? { ...it, selected: Boolean(matchingPacked.packed), packed: Boolean(matchingPacked.packed) } : it;
          });
          return { ...inv, items: updatedInvItems };
        }
        return inv;
      }));
    }
    setDispatchPackingModal(null);

    // Safely resolve the salesperson who created the BOM and customer name
    const resolvedSalesPerson = resolvedSpName.replace(/\s*\([^)]*\)/g, '').trim();
    const resolvedSalesPersonCode = resolvedSpCode;

    addLiveNotification({
      id: `notif-pack-${targetBomCode}-${Date.now()}`,
      title: isFullyConfirmed
        ? 'BOM Packing Verified'
        : (sendPartialToAccounts ? 'Partial Packing Sent to Accounts' : 'BOM Packing Updated'),
      message: isFullyConfirmed
        ? `BOM Order ${targetBomCode} for ${resolvedCustomer} is 100% Packed & Ready. Status: ${nextStatus}`
        : (sendPartialToAccounts
            ? `BOM Order ${targetBomCode} for ${resolvedCustomer} was partially packed (${packedItemsCount}/${totalItemsCount} items) and sent to Accounts for verification.`
            : `BOM Order ${targetBomCode} for ${resolvedCustomer} is Partially Packed (${packedItemsCount}/${totalItemsCount} items). Status: ${nextStatus}`),
      type: isFullyConfirmed ? 'success' : (sendPartialToAccounts ? 'warning' : 'info'),
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

    if (needsSalesPaymentProof) {
      addLiveNotification({
        id: `notif-payment-req-${targetBomCode}-${Date.now()}`,
        title: '⚠️ Attach Payment Slip (Goods Packed)',
        message: `Goods for BOM ${targetBomCode} (${resolvedCustomer}) are packed. Payment terms are "${dispatchPackingModal.paymentType}". Please attach payment proof so the order can proceed to Accounts.`,
        type: 'warning',
        category: 'Sales',
        time: 'Just now',
        targetTab: 'BOM Orders',
        targetRoles: [resolvedSalesPerson, resolvedSalesPersonCode, 'Sales Executive', 'Sales Head'].filter(Boolean),
        metadata: {
          bomCode: targetBomCode,
          customerName: resolvedCustomer,
          salesPerson: resolvedSalesPerson,
          salesPersonCode: resolvedSalesPersonCode,
          step: 'ATTACH_PAYMENT_PROOF'
        }
      });
      alert(`📦 Packing Verified!\n\nAll goods are packed. Because payment terms are "${dispatchPackingModal.paymentType}", this order has NOT been sent to Accounts yet.\n\nAn automated indication and alert have been sent to the Salesperson (${resolvedSalesPerson}) to attach the payment proof slip.\n\nOnce Sales attaches the payment proof, this order will automatically forward to the Accounts team.`);
    } else if (isFullyConfirmed || sendPartialToAccounts) {
      // Trigger Real-time Workflow Notifications with Porter order alert sound & voice for Sales & Accounts
      notifyBomPackedAndSentToAccounts({
        bomCode: targetBomCode,
        customerName: resolvedCustomer,
        salesPerson: resolvedSalesPerson,
        salesPersonCode: resolvedSalesPersonCode,
        createdBy: resolvedSalesPerson,
        createdById: resolvedSalesPersonCode
      });
      alert(`✅ Packing Verified!\n\nAll ${totalItemsCount} items verified and marked packed. Order successfully forwarded to the Accounts team for verification.`);
    }
  } catch (saveErr) {
    console.error('Error during savePackingData:', saveErr);
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
              {dispatchPackingModal.docType === 'DC' ? (
                <span style={{
                  backgroundColor: '#FEF3C7',
                  border: '1px solid #FCD34D',
                  color: '#92400E',
                  padding: '3px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: '900',
                  letterSpacing: '0.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <Truck size={13} strokeWidth={2.2} />
                  <span>DC (DELIVERY CHALLAN)</span>
                </span>
              ) : (
                <span style={{
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#1E40AF',
                  padding: '3px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: '900',
                  letterSpacing: '0.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <FileText size={13} strokeWidth={2.2} />
                  <span>TAX INVOICE</span>
                </span>
              )}
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
              ) : isPartiallySentToAccounts ? (
                <span style={{
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  border: '1px solid #FDE68A',
                  padding: '3px 12px', borderRadius: '20px',
                  fontSize: '11px', fontWeight: '800',
                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#D97706' }}></span>
                  PARTIALLY PACKED • SENT TO ACCOUNTS ({packedItemsCount}/{totalItemsCount})
                </span>
              ) : isAlreadySentToAccounts ? (
                <span style={{
                  backgroundColor: '#DCFCE7',
                  color: '#166534',
                  padding: '3px 12px', borderRadius: '20px',
                  fontSize: '11px', fontWeight: '800',
                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#166534' }}></span>
                  PACKING VERIFIED • SENT TO ACCOUNTS
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
              <span>Sales Creator: <strong style={{ color: '#FFFFFF', backgroundColor: 'rgba(14, 116, 144, 0.45)', padding: '2px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><User style={{ width: '13px', height: '13px', color: '#67E8F9' }} /> {(dispatchPackingModal.salesPerson || dispatchPackingModal.createdBy || 'Sales Department').replace(/\s*\([^)]*\)/g, '').trim()}</strong></span>
              <span>•</span>
              <span>Payment: <strong style={{ color: '#FFFFFF' }}>{dispatchPackingModal.paymentType}</strong></span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          {canCancelBom && !isCancelled && !isAccountsLocked && !isAlreadySentToAccounts && dispatchPackingModal.status !== 'Cancelled & Stock Restored' && (
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
          {!isAccountsLocked && !isCancelled && !dispatchPackingModal.isReadOnly && (
            <button
              type="button"
              onClick={() => savePackingData(false)}
              disabled={uploadingCount > 0}
              style={{
                border: 'none',
                backgroundColor: uploadingCount > 0 ? '#E2E8F0' : '#FFFFFF',
                color: uploadingCount > 0 ? '#94A3B8' : '#065F46',
                height: '42px', padding: '0 20px',
                borderRadius: '10px', fontSize: '13px', fontWeight: '900',
                cursor: uploadingCount > 0 ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <CheckCircle style={{ width: '16px', height: '16px' }} />
              {uploadingCount > 0 ? `Uploading Media (${uploadingCount})...` : (isAlreadySentToAccounts ? 'Packing Confirmed (Update Accounts)' : 'Packing Confirmed (Send to Accounts)')}
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

      {/* ─── 3 STATS CARDS (Order Value hidden for Dispatch role) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
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
            {cleanDisplayAddress(dispatchPackingModal.deliveryAddress || 'Plot 14, Phase II, Nagappa Estate, Puzhal, Chennai – 600066.')}
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
                  const allPacked = itemsToPack.map(p => ({
                    ...p,
                    packed: true,
                    packedQty: (p.packedQty !== undefined && p.packedQty !== null && p.packedQty !== '') ? p.packedQty : (p.bomQty || p.qty || 1)
                  }));
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
                  const nonePacked = itemsToPack.map(p => ({ ...p, packed: false, packedQty: '' }));
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

        {/* Table Grouped by Sets / Kits (Matching PI View Design) */}
        <div style={{ overflowX: 'auto' }}>
          {(() => {
            const rawPresetGroups = dispatchPackingModal.presetGroups || {};
            const presetGroupsMap = typeof rawPresetGroups === 'object' && !Array.isArray(rawPresetGroups)
              ? rawPresetGroups
              : (Array.isArray(rawPresetGroups)
                  ? rawPresetGroups.reduce((acc, g) => { if (g.groupId || g.presetGroupId) acc[g.groupId || g.presetGroupId] = g; return acc; }, {})
                  : {});

            // Collect distinct group IDs present in items
            const distinctGroupIds = [];
            itemsToPack.forEach(it => {
              const gid = it.presetGroupId;
              if (gid && !distinctGroupIds.includes(gid)) {
                distinctGroupIds.push(gid);
              }
            });

            // If items don't have presetGroupId directly, but presetGroups exists and items are marked preset
            if (distinctGroupIds.length === 0 && Object.keys(presetGroupsMap).length > 0) {
              Object.keys(presetGroupsMap).forEach(gid => distinctGroupIds.push(gid));
            }

            const PRESET_THEMES = [
              { primary: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC', tagBg: '#CFFAFE', tagText: '#155E75', badge: 'SET 1' },
              { primary: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', tagBg: '#E0E7FF', tagText: '#3730A3', badge: 'SET 2' },
              { primary: '#D97706', bg: '#FFFBEB', border: '#FDE68A', tagBg: '#FEF3C7', tagText: '#92400E', badge: 'SET 3' },
              { primary: '#059669', bg: '#ECFDF5', border: '#A7F3D0', tagBg: '#D1FAE5', tagText: '#065F46', badge: 'SET 4' },
              { primary: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', tagBg: '#EDE9FE', tagText: '#5B21B6', badge: 'SET 5' },
            ];

            const renderRow = (pItem, origIdx, itemNumberStr) => {
              const itemBomQty = pItem.bomQty || pItem.qty || 1;
              const currentPackedQty = (pItem.packedQty !== undefined && pItem.packedQty !== null && pItem.packedQty !== '') ? pItem.packedQty : (pItem.packed ? itemBomQty : '');

              return (
                <tr
                  key={origIdx}
                  onClick={isPackedAndReady ? undefined : () => {
                    const newPacked = !pItem.packed;
                    const updatedPacking = itemsToPack.map((pi, i) => i === origIdx ? {
                      ...pi,
                      packed: newPacked,
                      packedQty: newPacked ? (pi.packedQty ? pi.packedQty : (pi.bomQty || pi.qty || 1)) : ''
                    } : pi);
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {itemNumberStr && (
                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', backgroundColor: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>
                          #{itemNumberStr}
                        </span>
                      )}
                      <span>{pItem.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '13px' }}>
                    {itemBomQty} <span style={{ fontSize: '11px', color: '#94A3B8' }}>Nos</span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    {isPackedAndReady ? (
                      <span style={{ fontWeight: '800', color: '#0E7490', fontSize: '13px' }}>
                        {currentPackedQty !== '' ? currentPackedQty : 0} <span style={{ fontSize: '11px', color: '#94A3B8' }}>Nos</span>
                      </span>
                    ) : (
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          min="0"
                          max={itemBomQty || 999999}
                          placeholder={String(itemBomQty)}
                          value={currentPackedQty}
                          onChange={(e) => {
                            const rawVal = e.target.value;
                            const parsedVal = rawVal === '' ? '' : Math.max(0, parseInt(rawVal, 10) || 0);
                            const isAutoPacked = parsedVal !== '' && parsedVal > 0;
                            const updatedPacking = itemsToPack.map((pi, i) => i === origIdx ? {
                              ...pi,
                              packedQty: parsedVal,
                              packed: isAutoPacked
                            } : pi);
                            setDispatchPackingModal({ ...dispatchPackingModal, dispatchPacking: updatedPacking });
                          }}
                          style={{
                            width: '75px',
                            height: '32px',
                            textAlign: 'center',
                            borderRadius: '6px',
                            border: pItem.packed ? '1.5px solid #10B981' : '1px solid #CBD5E1',
                            backgroundColor: pItem.packed ? '#ECFDF5' : '#FFFFFF',
                            fontSize: '13px',
                            fontWeight: '800',
                            color: pItem.packed ? '#065F46' : '#1E293B',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                          title="Enter the actual packed quantity"
                        />
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>Nos</span>
                      </div>
                    )}
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
            };

            return (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '13px 20px', width: '60px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Check</th>
                    <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>Product Code</th>
                    <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>Product Description</th>
                    <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>BOM Qty</th>
                    <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Packed Qty</th>
                    <th style={{ padding: '13px 20px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {distinctGroupIds.length > 0 ? (
                    <>
                      {/* Render Sets/Kits */}
                      {distinctGroupIds.map((gid, gIdx) => {
                        const theme = PRESET_THEMES[gIdx % PRESET_THEMES.length];
                        const grp = presetGroupsMap[gid] || {};
                        const grpName = grp.presetName || grp.name || `Set / Kit ${gIdx + 1}`;
                        const setCount = parseInt(grp.setCount) || 1;

                        const setIndices = [];
                        itemsToPack.forEach((it, idx) => {
                          if (it.presetGroupId === gid || (!it.presetGroupId && it.isPresetItem && gIdx === 0)) {
                            setIndices.push(idx);
                          }
                        });

                        if (setIndices.length === 0) return null;

                        const allSetPacked = setIndices.every(i => itemsToPack[i]?.packed);
                        const packedCountInSet = setIndices.filter(i => itemsToPack[i]?.packed).length;

                        return (
                          <React.Fragment key={`set-grp-${gid}`}>
                            {/* Set Header Row */}
                            <tr style={{ backgroundColor: theme.bg, borderTop: `2px solid ${theme.primary}`, borderBottom: `1px solid ${theme.border}` }}>
                              <td colSpan={6} style={{ padding: '10px 18px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{
                                      padding: '3px 10px',
                                      borderRadius: '6px',
                                      backgroundColor: theme.primary,
                                      color: '#FFFFFF',
                                      fontSize: '11px',
                                      fontWeight: '900',
                                      letterSpacing: '0.5px'
                                    }}>
                                      {theme.badge}
                                    </span>
                                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                                      {grpName} {setCount > 1 ? `(${setCount} Sets)` : '(1 Set)'}
                                    </span>
                                    <span style={{ fontSize: '11.5px', fontWeight: '700', color: theme.tagText, backgroundColor: theme.tagBg, padding: '2px 8px', borderRadius: '4px' }}>
                                      {packedCountInSet} / {setIndices.length} Items Packed
                                    </span>
                                  </div>
                                  {!isPackedAndReady && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const shouldPack = !allSetPacked;
                                        const updatedPacking = itemsToPack.map((pi, i) => setIndices.includes(i) ? { ...pi, packed: shouldPack } : pi);
                                        setDispatchPackingModal({ ...dispatchPackingModal, dispatchPacking: updatedPacking });
                                      }}
                                      style={{
                                        border: `1px solid ${theme.primary}`,
                                        backgroundColor: allSetPacked ? '#FFFFFF' : theme.primary,
                                        color: allSetPacked ? theme.primary : '#FFFFFF',
                                        padding: '4px 12px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      {allSetPacked ? 'Unpack Set' : 'Pack Whole Set'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {/* Component items in this Set */}
                            {setIndices.map((origIdx, sItemIdx) => {
                              const pItem = itemsToPack[origIdx];
                              return renderRow(pItem, origIdx, `${gIdx + 1}.${sItemIdx + 1}`);
                            })}
                          </React.Fragment>
                        );
                      })}

                      {/* Render Loose / Non-Preset Items */}
                      {(() => {
                        const looseIndices = [];
                        itemsToPack.forEach((it, idx) => {
                          const isPartOfGroup = it.presetGroupId || (it.isPresetItem && distinctGroupIds.length > 0);
                          if (!isPartOfGroup) {
                            looseIndices.push(idx);
                          }
                        });

                        if (looseIndices.length === 0) return null;

                        return (
                          <React.Fragment key="loose-items-group">
                            <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #64748B', borderBottom: '1px solid #CBD5E1' }}>
                              <td colSpan={6} style={{ padding: '10px 18px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{
                                    padding: '3px 10px',
                                    borderRadius: '6px',
                                    backgroundColor: '#475569',
                                    color: '#FFFFFF',
                                    fontSize: '11px',
                                    fontWeight: '900',
                                    letterSpacing: '0.5px'
                                  }}>
                                    INDIVIDUAL PRODUCTS
                                  </span>
                                  <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#334155' }}>
                                    Additional Non-Kit Products ({looseIndices.length} items)
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {looseIndices.map((origIdx, lIdx) => {
                              const pItem = itemsToPack[origIdx];
                              return renderRow(pItem, origIdx, `C.${lIdx + 1}`);
                            })}
                          </React.Fragment>
                        );
                      })()}
                    </>
                  ) : (
                    itemsToPack.map((pItem, idx) => renderRow(pItem, idx, String(idx + 1)))
                  )}
                </tbody>
              </table>
            );
          })()}
        </div>

        {/* ─── PACKED ITEMS PHOTOS VERIFICATION SECTION ─── */}
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
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                  Packed Items & Small Accessories Proof Photos
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                  Capture or upload clear photos of packed boxes and small accessories (clamps, fasteners, nuts, bolts, brackets) before sending to Accounts.
                </p>
              </div>
            </div>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Stored securely in Businz Cloud & Media Storage
            </span>
          </div>

          {isAlreadySentToAccounts && (
            <div style={{
              backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', borderRadius: '10px',
              padding: '10px 14px', fontSize: '12px', color: '#0E7490', fontWeight: '700',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <CheckCircle size={16} style={{ color: '#0E7490', flexShrink: 0 }} />
              <span>Order is already with Accounts. Uploaded packing photos are saved instantly and viewed directly by the Sales Person and Accounts team without re-sending.</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {!isCancelled && (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  type="button"
                  onClick={() => setShowAddPhotoMenu(prev => !prev)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none',
                    padding: '8px 18px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '800',
                    cursor: 'pointer', boxShadow: '0 2px 6px rgba(14,116,144,0.3)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0891B2'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#0E7490'}
                >
                  <Camera size={15} /> Add Packing Photo ▾
                </button>

                {showAddPhotoMenu && (
                  <>
                    <div 
                      style={{ position: 'fixed', inset: 0, zIndex: 99 }} 
                      onClick={() => setShowAddPhotoMenu(false)} 
                    />
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                      backgroundColor: '#FFFFFF', borderRadius: '10px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #CBD5E1',
                      padding: '6px', minWidth: '220px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '4px'
                    }}>
                      <label 
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                          borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                          color: '#0F172A', transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F1F5F9'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <UploadCloud size={16} style={{ color: '#0E7490' }} />
                        <span>Upload from Device</span>
                        <input id="dispatch-packing-input-1" name="input1" aria-label="Input 1"
                          type="file"
                          multiple
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            setShowAddPhotoMenu(false);
                            const files = e.target.files;
                            if (files && files.length > 0) {
                              const bomCode = dispatchPackingModal.bomCode || dispatchPackingModal.id;
                              setUploadingCount(prev => prev + files.length);
                              const now = new Date();
                              const uploadTimestamp = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                              const uploadDateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                              const fullFormattedTime = `${uploadDateStr}, ${uploadTimestamp}`;

                              for (const f of Array.from(files)) {
                                try {
                                  const metadata = await uploadBomDocumentFile({
                                    file: f,
                                    bomCode,
                                    category: 'dispatch/images'
                                  });
                                  const photoId = `pack_photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                                  const newPhoto = {
                                    id: photoId,
                                    uploadedAt: now.toISOString(),
                                    uploadTime: fullFormattedTime,
                                    ...metadata
                                  };
                                  setDispatchPackingModal(prev => {
                                    if (!prev) return prev;
                                    const existingMedia = prev.dispatchPackingMedia || { photos: [], videos: [] };
                                    const updatedMedia = { ...existingMedia, photos: [...(existingMedia.photos || []), newPhoto] };
                                    syncModalMediaToStore(updatedMedia);
                                    return {
                                      ...prev,
                                      dispatchPackingMedia: updatedMedia
                                    };
                                  });
                                } catch (err) {
                                  alert(`Photo upload failed: ${err.message}`);
                                } finally {
                                  setUploadingCount(prev => Math.max(0, prev - 1));
                                }
                              }
                            }
                          }}
                         />
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAddPhotoMenu(false);
                          handleOpenLiveCamera();
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                          borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                          color: '#0F172A', background: 'none', border: 'none', width: '100%', textAlign: 'left',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F1F5F9'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Camera size={16} style={{ color: '#0E7490' }} />
                        <span>Open Live Camera</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Media Gallery Thumbnails */}
          {(dispatchPackingModal.dispatchPackingMedia?.photos || []).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginTop: '6px' }}>
              {(dispatchPackingModal.dispatchPackingMedia?.photos || []).map((ph, phIdx) => (
                <DispatchPhotoThumbnail
                  key={ph.id || phIdx}
                  ph={ph}
                  phIdx={phIdx}
                  bomCode={dispatchPackingModal.bomCode}
                  onPreview={handleMediaPreview}
                  onRemove={() => {
                    setDispatchPackingModal(prev => {
                      const existingMedia = prev.dispatchPackingMedia || { photos: [], videos: [] };
                      const updatedPhotos = existingMedia.photos.filter((_, i) => i !== phIdx);
                      const updatedMedia = { ...existingMedia, photos: updatedPhotos };
                      syncModalMediaToStore(updatedMedia);
                      return {
                        ...prev,
                        dispatchPackingMedia: updatedMedia
                      };
                    });
                  }}
                  canRemove={!isCancelled}
                  formatUploadTime={formatUploadTime}
                />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic' }}>
              No packing photos uploaded yet. Please attach packed item photos before forwarding to Accounts.
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
            {canCancelBom && !isCancelled && !isAlreadySentToAccounts && (
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
                borderRadius: '10px', fontSize: '13px', fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              ← Back
            </button>
            {/* If Accounts has verified/locked the BOM, Dispatch can still save proof photos */}
            {isAccountsLocked && !isCancelled && (
              <button
                type="button"
                onClick={() => savePackingData(false)}
                disabled={uploadingCount > 0}
                style={{
                  border: 'none',
                  background: uploadingCount > 0 ? '#94A3B8' : 'linear-gradient(135deg, #0E7490, #0891B2)',
                  color: '#FFFFFF', height: '40px', padding: '0 20px',
                  borderRadius: '10px', fontSize: '13px', fontWeight: '800',
                  cursor: uploadingCount > 0 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 2px 8px rgba(14,116,144,0.3)'
                }}
                title="Save added packing photos without altering workflow status"
              >
                <Save style={{ width: '15px', height: '15px' }} />
                Save Proof Photos
              </button>
            )}
            {/* UNIVERSAL SAVE AS DRAFT: Always available for dispatch personnel to save progress without advancing workflow */}
            {!isAccountsLocked && !isCancelled && !dispatchPackingModal.isReadOnly && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={uploadingCount > 0}
                style={{
                  border: '1.5px solid #0E7490',
                  background: '#ECFEFF',
                  color: '#0E7490',
                  height: '40px',
                  padding: '0 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: uploadingCount > 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 6px rgba(14,116,144,0.1)'
                }}
                title="Save current progress as draft without advancing order to next process"
              >
                <Save style={{ width: '15px', height: '15px' }} />
                Save as Draft {packedItemsCount > 0 ? `(${packedItemsCount}/${totalItemsCount})` : ''}
              </button>
            )}

            {/* Case 1: 0 items selected -> cannot proceed */}
            {!isAccountsLocked && !isCancelled && !dispatchPackingModal.isReadOnly && packedItemsCount === 0 && (
              <button
                type="button"
                disabled
                style={{
                  border: 'none',
                  background: '#CBD5E1',
                  color: '#64748B',
                  height: '40px',
                  padding: '0 20px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                title="Please select at least 1 product to complete packing"
              >
                Select Products to Complete
              </button>
            )}

            {/* Case 2: Partial packing -> Confirm Partial Packing (Send to Accounts) */}
            {!isAccountsLocked && !isCancelled && !dispatchPackingModal.isReadOnly && packedItemsCount > 0 && packedItemsCount < totalItemsCount && (
              <button
                type="button"
                onClick={() => setShowPartialConfirmModal(true)}
                disabled={uploadingCount > 0}
                style={{
                  border: 'none',
                  background: uploadingCount > 0 ? '#94A3B8' : 'linear-gradient(135deg, #D97706, #B45309)',
                  color: '#FFFFFF',
                  height: '40px',
                  padding: '0 20px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: uploadingCount > 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(217,119,6,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                title="Confirm partial packing and forward to Accounts verification"
              >
                <CheckCircle style={{ width: '15px', height: '15px' }} />
                {isPartiallySentToAccounts
                  ? `Update Partial in Accounts (${packedItemsCount}/${totalItemsCount})`
                  : `Confirm Partial Packing (Send to Accounts)`}
              </button>
            )}

            {/* Case 3: 100% Packed -> show Packing Confirmed (opens confirmation modal) */}
            {!isAccountsLocked && !isCancelled && !dispatchPackingModal.isReadOnly && packedItemsCount === totalItemsCount && (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={uploadingCount > 0}
                style={{
                  border: 'none',
                  background: uploadingCount > 0 ? '#94A3B8' : 'linear-gradient(135deg, #059669, #10B981)',
                  color: '#FFFFFF',
                  height: '40px',
                  padding: '0 22px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: uploadingCount > 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                title={needsSalesPaymentProof ? "Confirm packing and notify Sales to attach payment slip" : "Confirm all goods packing and forward to Accounts"}
              >
                <CheckCircle style={{ width: '16px', height: '16px' }} />
                {uploadingCount > 0 ? `Uploading Proof (${uploadingCount} in progress)...` : (isAlreadySentToAccounts ? 'Packing Confirmed (Update Accounts)' : (needsSalesPaymentProof ? 'Confirm Packing (Notify Sales for Payment)' : 'Packing Confirmed'))}
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

                    const now = new Date();
                    const uploadTimestamp = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                    const uploadDateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const fullFormattedTime = `${uploadDateStr}, ${uploadTimestamp}`;

                    const capturedPhoto = {
                      id: capturedId,
                      name: capturedName,
                      size: '1.1 MB',
                      dataUrl: photoUrl,
                      uploadedAt: now.toISOString(),
                      uploadTime: fullFormattedTime
                    };

                    setDispatchPackingModal(prev => {
                      const existingMedia = prev?.dispatchPackingMedia || { photos: [], videos: [] };
                      const updatedMedia = { ...existingMedia, photos: [...(existingMedia.photos || []), capturedPhoto] };
                      syncModalMediaToStore(updatedMedia);
                      return {
                        ...prev,
                        dispatchPackingMedia: updatedMedia
                      };
                    });

                    // Asynchronously upload camera snapshot to server
                    setUploadingCount(prev => prev + 1);
                    try {
                      if (typeof uploadMediaFile === 'function') {
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
                        }).catch(e => {
                          console.warn('Camera upload failed:', e);
                        }).finally(() => {
                          setUploadingCount(prev => Math.max(0, prev - 1));
                        });
                      } else {
                        setUploadingCount(prev => Math.max(0, prev - 1));
                      }
                    } catch (err) {
                      console.warn('Camera upload failed to initiate:', err);
                      setUploadingCount(prev => Math.max(0, prev - 1));
                    }

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

      {/* DISPATCH PACKING CONFIRMATION POPUP MODAL */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999999, padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: '16px',
            maxWidth: '480px', width: '100%', padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0F172A' }}>
                  Confirm Goods Packing
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                  BOM Code: <strong>{targetCode}</strong>
                </p>
              </div>
            </div>

            <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6', backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              Are you sure all <strong>{totalItemsCount} items</strong> and accessories are fully packed and verified?
              <br /><br />
              {needsSalesPaymentProof ? (
                <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', padding: '10px 12px', borderRadius: '8px', color: '#92400E', fontWeight: '600' }}>
                  ℹ️ Payment terms are <strong>"{dispatchPackingModal.paymentType}"</strong> without an attached payment proof.
                  <br />
                  This will mark packing complete and notify the <strong>Sales Team</strong> to attach the payment slip. The order will <strong>not</strong> go to Accounts until Sales attaches the proof.
                </div>
              ) : (
                <span>
                  This will mark packing as confirmed and forward the order to <strong>Accounts</strong> for payment & document verification.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: '10px 18px', borderRadius: '8px', border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF', color: '#475569', fontSize: '13px', fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  savePackingData(false);
                }}
                style={{
                  padding: '10px 22px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#059669', color: '#FFFFFF', fontSize: '13px', fontWeight: '800',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 4px 12px rgba(5,150,105,0.3)'
                }}
              >
                <CheckCircle size={16} /> Yes, Confirm Packing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH PARTIAL PACKING CONFIRMATION POPUP MODAL */}
      {showPartialConfirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999999, padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF', borderRadius: '16px',
            maxWidth: '520px', width: '100%', padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            display: 'flex', flexDirection: 'column', gap: '18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '46px', height: '46px', borderRadius: '12px',
                backgroundColor: '#FEF3C7', color: '#B45309',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
                  Confirm Partial Goods Packing
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                  BOM Code: <strong>{targetCode}</strong> • Customer: <strong>{resolvedCustomer}</strong>
                </p>
              </div>
            </div>

            {/* Breakdown Card */}
            <div style={{
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#92400E' }}>
                  Packing Progress:
                </span>
                <span style={{
                  fontSize: '12px', fontWeight: '800',
                  backgroundColor: '#FEF3C7', color: '#B45309',
                  padding: '2px 10px', borderRadius: '20px', border: '1px solid #FCD34D'
                }}>
                  {packedItemsCount} of {totalItemsCount} Items Packed ({progressPercent}%)
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ width: '100%', height: '8px', backgroundColor: '#FDE68A', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#D97706', borderRadius: '4px' }}></div>
              </div>

              <div style={{ fontSize: '12px', color: '#78350F', display: 'flex', justifyContent: 'space-between' }}>
                <span>Packed: <strong>{packedItemsCount} items</strong></span>
                <span>Remaining: <strong>{totalItemsCount - packedItemsCount} items</strong></span>
              </div>
            </div>

            {/* Explanation / Verification Notice */}
            <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6', backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              Are you sure you want to forward this <strong>partially packed order ({packedItemsCount}/{totalItemsCount} items)</strong> to <strong>Accounts Verification</strong>?
              <br /><br />
              • Accounts will verify payment & documentation for these packed items.
              <br />
              • The remaining <strong>{totalItemsCount - packedItemsCount} items</strong> can be packed and dispatched in a subsequent shipment.
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setShowPartialConfirmModal(false)}
                style={{
                  padding: '10px 18px', borderRadius: '8px', border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF', color: '#475569', fontSize: '13px', fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPartialConfirmModal(false);
                  savePackingData(true, false, true);
                }}
                style={{
                  padding: '10px 22px', borderRadius: '8px', border: 'none',
                  backgroundColor: '#D97706', color: '#FFFFFF', fontSize: '13px', fontWeight: '800',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 4px 12px rgba(217,119,6,0.35)'
                }}
              >
                <CheckCircle size={16} /> Yes, Send Partial to Accounts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
