import React, { useState, useEffect, useRef } from "react";
import {
  Trash2, X, CheckCircle, Phone, UploadCloud, Truck, Package,
  Upload, Camera, Image, Loader2, FileText, Eye, ChevronLeft, User,
  Info, FileCheck, Check, Clock
} from "lucide-react";
import { saveCloudStore, saveCloudBomRow, saveCloudInvoiceRow } from "../../utils/supabaseDataSync";
import { centralInventoryStore } from "../../utils/centralInventoryStore";
import { uploadBomDocumentFile, validateClientFile } from "../../utils/bomStorageClient";
import { resolveDocumentUrlAsync } from "../../utils/documentResolver";
import { ActiveMediaPreviewModal } from "./DispatchAndPreviewModals";
import { getMediaFromCache, saveMediaToCache } from "../../utils/mediaUtils";
import { stripDataUrlsFromRecord } from "../../utils/otherViewsShared";
import { notifyDispatchCompletedToSales } from "../../services/notificationService";

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function VehicleMediaImg({ photo, bomCode, onClick }) {
  const initial = photo.url || photo.dataUrl || photo.previewUrl || '';
  const [resolvedSrc, setResolvedSrc] = useState(initial);
  const [loading, setLoading] = useState(!initial && Boolean(photo.storageBucket || photo.storagePath));
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    const current = photo.url || photo.dataUrl || photo.previewUrl || '';
    if (current) {
      setResolvedSrc(current);
      setLoading(false);
      setLoadError(false);
      return;
    }
    if (photo.storageBucket || photo.storagePath) {
      setLoading(true);
      resolveDocumentUrlAsync(photo, bomCode)
        .then(url => {
          if (active) {
            if (url) {
              setResolvedSrc(url);
              setLoadError(false);
            } else {
              setLoadError(true);
            }
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setLoadError(true);
            setLoading(false);
          }
        });
    }
    return () => { active = false; };
  }, [photo, bomCode]);

  const handleClick = async () => {
    let src = resolvedSrc || photo.url || photo.dataUrl || photo.previewUrl || '';
    if (!src && (photo.storageBucket || photo.storagePath)) {
      src = await resolveDocumentUrlAsync(photo, bomCode);
      if (src) setResolvedSrc(src);
    }
    if (onClick) onClick(src || photo.url || photo.dataUrl || photo.previewUrl || '');
  };

  return (
    <div
      onClick={handleClick}
      title="Click to view full photo"
      style={{
        height: '130px',
        width: '100%',
        backgroundColor: '#0F172A',
        cursor: 'pointer',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {resolvedSrc && !loadError ? (
        <>
          <img
            src={resolvedSrc}
            alt={photo.name || 'Vehicle Loading Proof'}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s ease' }}
            onError={() => setLoadError(true)}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
              opacity: 0,
              transition: 'opacity 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              fontWeight: '800',
              fontSize: '12px',
              gap: '6px'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; }}
          >
            <Eye size={16} /> Click to View
          </div>
        </>
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#38BDF8' }}>
          <Loader2 className="animate-spin text-cyan-400" size={22} />
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Loading photo...</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: '#94A3B8', padding: '12px', textAlign: 'center' }}>
          <Image size={24} style={{ color: '#64748B' }} />
          <span style={{ fontSize: '11px', color: '#E2E8F0', fontWeight: '700' }}>{photo.name || 'Proof Photo'}</span>
          <span style={{ fontSize: '10px', color: '#38BDF8', textDecoration: 'underline' }}>Click to preview</span>
        </div>
      )}
    </div>
  );
}

export default function VehicleLoadingModal({
  vehicleLoadingModal,
  onClose,
  setBomStore,
  setActiveMediaPreviewModal = () => {},
  setCompletedBomSummaryModal = () => {},
  setInvoiceList = () => {}
}) {
  const bom = vehicleLoadingModal;
  const existingLoading = bom.vehicleLoading || {};
  const [localMediaPreviewModal, setLocalMediaPreviewModal] = useState(null);

  const salesTransportMode = (() => {
    const raw = bom.transportMode || bom.deliveryMode || existingLoading.deliveryMode || '';
    const str = String(raw).trim().toLowerCase();
    if (str.includes('own') || str.includes('porter')) return 'Own Vehicle';
    if (str.includes('portal') || str.includes('self') || str.includes('direct') || str.includes('pickup') || str.includes('customer')) return 'Portal';
    return 'Transport';
  })();
  const isTransport = salesTransportMode === 'Transport';
  const deliveryMode = isTransport ? 'transport' : (salesTransportMode === 'Own Vehicle' ? 'own_vehicle' : 'direct');
  const [lrCopyDoc, setLrCopyDoc] = useState(
    bom.lrCopyDoc || existingLoading.lrCopyDoc || null
  );
  const [uploadingLr, setUploadingLr] = useState(false);
  const [showLrPopup, setShowLrPopup] = useState(false);
  const [popupLrNo, setPopupLrNo] = useState('');

  const [vehicleLoadingData, setVehicleLoadingData] = useState({
    vehicleNo: existingLoading.vehicleNo || "",
    driverName: existingLoading.driverName || "",
    driverPhone: existingLoading.driverPhone || "",
    transporter: existingLoading.transporter || "",
    lrNo: existingLoading.lrNo || "",
    sealNo: existingLoading.sealNo || ""
  });
  const [loadingPhotos, setLoadingPhotos] = useState(() => (Array.isArray(existingLoading.photos) && existingLoading.photos.length > 0 ? existingLoading.photos : []));
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showAddPhotoMenu, setShowAddPhotoMenu] = useState(false);
  const [showLiveCameraModal, setShowLiveCameraModal] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const cameraStreamRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraCanvasRef = useRef(null);

  const handleOpenLiveCamera = async () => {
    setShowLiveCameraModal(true);
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      cameraStreamRef.current = stream;
      setTimeout(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      setCameraError('Unable to access camera. Please allow camera permissions or upload images instead.');
    }
  };

  const handleSnapCameraPhoto = async () => {
    if (!cameraVideoRef.current || !cameraCanvasRef.current) return;
    const video = cameraVideoRef.current;
    const canvas = cameraCanvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    setShowLiveCameraModal(false);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setUploadingMedia(true);
      try {
        const fileName = `Vehicle_Loading_Snap_${Date.now().toString().slice(-4)}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        const metadata = await uploadBomDocumentFile({
          file,
          bomCode: bCode,
          category: 'dispatch/images'
        });
        const now = new Date();
        const uploadTimestamp = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const uploadDateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const newPhoto = {
          id: `photo_cam_${Date.now()}`,
          name: fileName,
          size: `${(blob.size / 1024 / 1024).toFixed(1)} MB`,
          storageBucket: metadata.storageBucket,
          storagePath: metadata.storagePath,
          url: metadata.url || canvas.toDataURL('image/jpeg', 0.85),
          dataUrl: metadata.dataUrl || canvas.toDataURL('image/jpeg', 0.85),
          previewUrl: URL.createObjectURL(blob),
          mimeType: 'image/jpeg',
          uploadedAt: now.toISOString(),
          capturedAt: `${uploadDateStr}, ${uploadTimestamp}`
        };
        setLoadingPhotos(prev => [...prev, newPhoto]);
      } catch (err) {
        alert(`Camera photo upload failed: ${err.message}`);
      } finally {
        setUploadingMedia(false);
      }
    }, 'image/jpeg', 0.85);
  };

  const bCode = bom.bomCode || bom.code || 'BOM-2026';
  const cleanSeq = (bCode.match(/(\d+)$/)?.[1] || '01');
  const invNo = bom.invoiceNo || (bom.invoiceConfirmed ? `VRM-INV-2026-${cleanSeq}` : `VRM-INV-2026-${cleanSeq}`);
  const custName = bom.customerName || bom.companyName || bom.customer || 'Customer';
  const delAddr = bom.deliveryAddress || 'Client Delivery Site';
  const authenticSalesPerson = (bom.salesPerson || bom.sales_person || bom.createdBy || 'Sales Department').replace(/\s*\([^)]*\)/g, '').trim();

  const isAwaitingLr = bom.status === 'Dispatched - Awaiting LR Copy';
  const isReadOnly = Boolean((bom.isReadOnly || bom.status === 'Completed' || bom.status === 'Fully Dispatched & BOM Flow Completed' || bom.status === 'Fully Dispatched & Delivered') && !isAwaitingLr);

  const handleUploadLrCopy = async (file) => {
    if (!file) return;
    setUploadingLr(true);
    try {
      validateClientFile(file);
      const localPreview = URL.createObjectURL(file);
      const localDataUrl = await readFileAsDataUrl(file);
      const metadata = await uploadBomDocumentFile({
        file,
        bomCode: bCode,
        category: 'dispatch/lr_copy'
      });
      setLrCopyDoc({
        id: `lr_${Date.now()}`,
        name: metadata.originalName || file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        storageBucket: metadata.storageBucket,
        storagePath: metadata.storagePath,
        url: metadata.url || localPreview,
        dataUrl: metadata.dataUrl || localDataUrl,
        previewUrl: localPreview,
        mimeType: metadata.mimeType || file.type,
        uploadedAt: new Date().toISOString()
      });
    } catch (err) {
      alert(`LR Copy upload error: ${err.message}`);
    } finally {
      setUploadingLr(false);
    }
  };

  const handlePreviewLrCopy = async () => {
    if (!lrCopyDoc) return;
    let targetUrl = lrCopyDoc.url || lrCopyDoc.dataUrl || lrCopyDoc.previewUrl;
    if (!targetUrl && lrCopyDoc.name) {
      targetUrl = getMediaFromCache(lrCopyDoc.name);
    }
    if (!targetUrl && (lrCopyDoc.storageBucket || lrCopyDoc.storagePath)) {
      targetUrl = await resolveDocumentUrlAsync(lrCopyDoc, bCode);
    }
    if (!targetUrl && lrCopyDoc.name) {
      try {
        const r = await fetch(`/api/media/find/${encodeURIComponent(lrCopyDoc.name)}`);
        const d = await r.json();
        if (d && d.found && d.url) {
          targetUrl = d.url;
          saveMediaToCache(lrCopyDoc.name, d.url);
        }
      } catch (_) {}
    }
    const isPdf = lrCopyDoc.mimeType === 'application/pdf' ||
                  (lrCopyDoc.name && lrCopyDoc.name.toLowerCase().endsWith('.pdf'));
    const modalPayload = {
      type: isPdf ? 'pdf' : 'image',
      url: targetUrl || '',
      dataUrl: targetUrl || '',
      previewUrl: targetUrl || '',
      title: `LR Copy - ${lrCopyDoc.name || bCode}`,
      name: lrCopyDoc.name || `LR Copy - ${bCode}`,
      bomCode: bCode,
      storageBucket: lrCopyDoc.storageBucket,
      storagePath: lrCopyDoc.storagePath
    };
    setLocalMediaPreviewModal(modalPayload);
    setActiveMediaPreviewModal(modalPayload);
  };

  const openPhotoPreview = async (photo) => {
    if (!photo) return;
    let src = photo.url || photo.dataUrl || photo.previewUrl;
    if (!src && photo.name) {
      src = getMediaFromCache(photo.name);
    }
    if (!src && (photo.storageBucket || photo.storagePath)) {
      src = await resolveDocumentUrlAsync(photo, bCode);
    }
    if (!src && photo.name) {
      try {
        const r = await fetch(`/api/media/find/${encodeURIComponent(photo.name)}`);
        const d = await r.json();
        if (d && d.found && d.url) {
          src = d.url;
          saveMediaToCache(photo.name, d.url);
        }
      } catch (_) {}
    }
    const modalPayload = {
      type: 'image',
      url: src || photo.url || photo.dataUrl || photo.previewUrl || '',
      dataUrl: src || photo.url || photo.dataUrl || photo.previewUrl || '',
      previewUrl: src || photo.url || photo.dataUrl || photo.previewUrl || '',
      name: photo.name,
      title: `Loading Proof Photo - ${photo.name || bCode}`,
      bomCode: bCode,
      storageBucket: photo.storageBucket,
      storagePath: photo.storagePath
    };
    setLocalMediaPreviewModal(modalPayload);
    setActiveMediaPreviewModal(modalPayload);
  };

  const vNo = vehicleLoadingData.vehicleNo || existingLoading.vehicleNo || '';
  const dName = vehicleLoadingData.driverName || existingLoading.driverName || '';
  const dPhone = vehicleLoadingData.driverPhone || existingLoading.driverPhone || '';
  const transp = bom.transporterName || bom.transporter || vehicleLoadingData.transporter || existingLoading.transporter || '';
  const lr = vehicleLoadingData.lrNo || existingLoading.lrNo || '';
  const seal = vehicleLoadingData.sealNo || existingLoading.sealNo || '';

  const currentPhotos = loadingPhotos.length > 0 ? loadingPhotos : (existingLoading.photos || []);
  const currentVideos = existingLoading.videos || [];

  const packedItems = (bom.dispatchPacking && Array.isArray(bom.dispatchPacking) && bom.dispatchPacking.length > 0)
    ? bom.dispatchPacking.filter(p => Boolean(p.packed))
    : (bom.items || []).filter(i => i.selected !== false);

  const allPackedItems = (() => {
    if (bom.dispatchPacking && Array.isArray(bom.dispatchPacking) && bom.dispatchPacking.length > 0) {
      return bom.dispatchPacking;
    }
    if (bom.items && Array.isArray(bom.items) && bom.items.length > 0) {
      return bom.items;
    }
    if (bom.lineItems && Array.isArray(bom.lineItems) && bom.lineItems.length > 0) {
      return bom.lineItems;
    }
    return [];
  })();

  const packingProofPhotos = (
    bom.dispatchPackingMedia?.photos ||
    bom.packingPhotos ||
    bom.packingPhotoList ||
    []
  );

  const handleAddPhotoFiles = async (files) => {
    if (!files || files.length === 0) return;
    setUploadingMedia(true);
    setUploadError('');
    try {
      for (const file of Array.from(files)) {
        validateClientFile(file);
        const localPreview = URL.createObjectURL(file);
        const localDataUrl = await readFileAsDataUrl(file);
        const metadata = await uploadBomDocumentFile({
          file,
          bomCode: bCode,
          category: 'dispatch/images'
        });
        const newPhoto = {
          id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: metadata.originalName || file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          storageBucket: metadata.storageBucket,
          storagePath: metadata.storagePath,
          url: metadata.url || localPreview,
          dataUrl: metadata.dataUrl || localDataUrl,
          previewUrl: localPreview,
          mimeType: metadata.mimeType || file.type,
          uploadedAt: metadata.uploadedAt || new Date().toISOString(),
          capturedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        };
        setLoadingPhotos(prev => [...prev, newPhoto]);
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      setUploadError(err.message || 'Failed to upload photo');
      alert(`Failed to upload photo: ${err.message}`);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleInitiateConfirm = () => {
    if (uploadingMedia || uploadingLr) {
      alert('Media or LR document is currently uploading to secure storage. Please wait until upload completes.');
      return;
    }

    // If own vehicle or customer portal / self-pickup -> complete immediately, NO POPUP!
    if (!isTransport) {
      handleFinalizeVehicleLoading({ forceStatus: 'Completed', overrideLrDoc: null });
      return;
    }

    // If 3rd-party transport:
    // If LR copy is already attached, complete immediately
    if (lrCopyDoc && (lrCopyDoc.url || lrCopyDoc.dataUrl || lrCopyDoc.name)) {
      handleFinalizeVehicleLoading({ forceStatus: 'Completed', overrideLrDoc: lrCopyDoc });
      return;
    }

    // If no LR copy attached, open the dedicated LR Copy Upload Popup Menu
    setPopupLrNo(vehicleLoadingData.lrNo || existingLoading.lrNo || '');
    setShowLrPopup(true);
  };

  const handleFinalizeVehicleLoading = async (options = {}) => {
    if (uploadingMedia || uploadingLr) {
      alert('Media or LR document is currently uploading to secure storage. Please wait until upload completes.');
      return;
    }

    const { forceStatus, overrideLrDoc, overrideLrNo } = options;

    const isTransport = deliveryMode === 'transport';
    const isOwnVehicle = deliveryMode === 'own_vehicle';

    const effectiveVehicleNo = vNo || (isTransport ? '' : isOwnVehicle ? 'Own Vehicle / Porter' : 'Customer Pickup');
    const effectiveTransporter = transp || (isTransport ? '' : isOwnVehicle ? 'Own Vehicle / Porter' : 'Self-Pickup / Direct Delivery');
    const activeLrDoc = overrideLrDoc !== undefined ? overrideLrDoc : lrCopyDoc;
    const effectiveLrNo = overrideLrNo !== undefined ? overrideLrNo : (lr || popupLrNo || '');

    const hasLrCopy = Boolean(activeLrDoc && (activeLrDoc.url || activeLrDoc.dataUrl || activeLrDoc.name));
    const willCloseBom = forceStatus ? (forceStatus === 'Completed') : (!isTransport || hasLrCopy);
    const nextBomStatus = forceStatus || (willCloseBom ? 'Completed' : 'Dispatched - Awaiting LR Copy');
    const nextInvoiceStatus = willCloseBom ? 'Fully Dispatched & Delivered' : 'Dispatched - In Transit';

    // Strictly user-uploaded photos. No fake canvas images are ever generated.
    const finalizedPhotos = currentPhotos;

    const loadingPayload = {
      ...existingLoading,
      deliveryMode,
      isTransport,
      vehicleNo: effectiveVehicleNo,
      driverName: dName,
      driverPhone: dPhone,
      transporter: effectiveTransporter,
      lrNo: effectiveLrNo || (isTransport ? (willCloseBom ? '' : 'Awaiting LR Copy') : 'N/A (Own Vehicle / Direct)'),
      sealNo: seal || '',
      lrCopyDoc: activeLrDoc || null,
      photos: finalizedPhotos,
      videos: currentVideos,
      loadedAt: existingLoading.loadedAt || new Date().toISOString(),
      loadedTimeStr: existingLoading.loadedTimeStr || new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      fullyCompleted: willCloseBom
    };

    // Preserve authentic salesperson details from the order
    const authenticSalesPerson = bom.salesPerson || bom.sales_person || bom.createdBy || 'Sales Department';
    const authenticSalesPersonCode = bom.salesPersonCode || bom.sales_person_code || bom.createdById || '';

    // Permanently Deduct Inventory in Central Inventory Store & Raw Materials Store upon Vehicle Loading ONLY if not already deducted at Invoice
    if (!bom.stockDeducted) {
      try {
        const itemsToDeduct = (bom.items && bom.items.length > 0) ? bom.items : packedItems;
        centralInventoryStore.deductStockForBOM(bCode, itemsToDeduct, authenticSalesPerson || 'Dispatch Vehicle Loading', false);
      } catch (cErr) {
        console.warn('Central store deduction error in VehicleLoadingModal:', cErr);
      }
    }
    try {
      centralInventoryStore.releaseReservation(bCode);
    } catch (_) {}

    const updatedBomData = {
      ...bom,
      status: nextBomStatus,
      fullyCompleted: willCloseBom,
      stockDeducted: true,
      vehicleLoading: loadingPayload,
      lrCopyDoc: activeLrDoc || bom.lrCopyDoc || null,
      salesPerson: authenticSalesPerson,
      salesPersonCode: authenticSalesPersonCode,
      dispatchedAt: bom.dispatchedAt || new Date().toISOString(),
      completedAt: willCloseBom ? new Date().toISOString() : null
    };

    // 1. Update BOM status in local React state immediately
    setBomStore(prev => {
      const updated = (prev || []).map(b => (b.bomCode === bCode || b.code === bCode || b.id === bCode) ? updatedBomData : b);
      try {
        localStorage.setItem('controlroom_bom_store', JSON.stringify(updated.map(stripDataUrlsFromRecord)));
      } catch (_) {}
      return updated;
    });

    // 2. Authoritative server update first - immediately updates server cache & PostgreSQL
    try {
      await fetch('/api/boms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bom: updatedBomData, isUpdate: true })
      });
    } catch (apiErr) {
      console.warn('Error saving BOM to /api/boms in VehicleLoadingModal:', apiErr);
    }

    // 3. Direct cloud sync via Supabase client
    try {
      await saveCloudBomRow(updatedBomData);
    } catch (e) {
      console.warn('Error saving BOM row to cloud in VehicleLoadingModal:', e);
    }

    // Update Invoice status & persist
    if (typeof setInvoiceList === 'function') {
      setInvoiceList(prev => {
        const updatedInvoices = (prev || []).map(i => (i.poNo === bCode || i.code === bCode || i.invNo === invNo) ? {
          ...i,
          status: nextInvoiceStatus,
          pay: willCloseBom ? 'Completed & Delivered' : 'Dispatched - In Transit',
          vehicleLoading: loadingPayload,
          lrCopyDoc: activeLrDoc || i.lrCopyDoc || null
        } : i);
        try {
          const targetInvoice = updatedInvoices.find(i => (i.poNo === bCode || i.code === bCode || i.invNo === invNo));
          if (targetInvoice) saveCloudInvoiceRow(targetInvoice);
          localStorage.setItem('controlroom_invoice_store', JSON.stringify(updatedInvoices.map(stripDataUrlsFromRecord)));
        } catch (e) { }
        return updatedInvoices;
      });
    }

    window.dispatchEvent(new Event('central_inventory_updated'));
    window.dispatchEvent(new Event('controlroom_raw_materials_update'));
    window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: updatedBomData, action: 'upsert' } }));

    // Notify Sales Person that dispatch for this BOM is completed
    try {
      notifyDispatchCompletedToSales({
        bomCode: bCode,
        customerName: custName,
        salesPerson: authenticSalesPerson,
        salesPersonCode: authenticSalesPersonCode,
        vehicleNo: effectiveVehicleNo,
        lrNo: isTransport ? effectiveLrNo : 'N/A (Own Vehicle / Direct)',
        transporter: effectiveTransporter,
        deliveryMode,
        status: nextBomStatus
      });
    } catch (nErr) {
      console.warn('Dispatch completion notification error:', nErr);
    }

    const completedSummary = {
      bomCode: bCode,
      invoiceNo: invNo,
      customer: custName,
      salesPerson: authenticSalesPerson,
      deliveryAddress: delAddr,
      packedCount: packedItems.length,
      vehicleLoading: loadingPayload,
      status: nextBomStatus
    };

    setShowLrPopup(false);
    onClose();
    setLoadingPhotos([]);

    if (willCloseBom) {
      if (typeof setCompletedBomSummaryModal === 'function') {
        setCompletedBomSummaryModal(completedSummary);
      }
      alert(`Vehicle loading verified & goods dispatched successfully for Order ${bCode}!`);
    } else {
      alert(`Vehicle loading recorded & goods dispatched.\n\nOrder ${bCode} is marked as "Dispatched - Awaiting LR Copy". The BOM will remain open in Dispatch Orders until the Transporter LR receipt is uploaded.`);
    }
  };

return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: "'DM Sans', sans-serif", minHeight: '100%' }}>

    {/* ─── GRADIENT STATUS BANNER HEADER (Exact Dispatch Packing Specifications Theme) ─── */}
    <div style={{
      background: isReadOnly
        ? 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)'
        : 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)',
      borderRadius: '16px',
      padding: '24px 28px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 8px 24px rgba(6,78,59,0.35)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Back button */}
        <button
          type="button"
          onClick={onClose}
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
              {isReadOnly ? 'Dispatch Vehicle Loading Specifications (Locked)' : 'Dispatch Vehicle Loading Verification'}
            </h1>
            <span style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.35)',
              color: '#FFFFFF', padding: '3px 12px',
              borderRadius: '20px', fontSize: '12px', fontWeight: '800'
            }}>
              {bCode}
            </span>
            <span style={{
              backgroundColor: '#DCFCE7',
              border: '1px solid #86EFAC',
              color: '#166534', padding: '3px 12px',
              borderRadius: '20px', fontSize: '11px', fontWeight: '800'
            }}>
              {invNo}
            </span>
            <span style={{
              backgroundColor: '#DCFCE7',
              color: '#166534',
              padding: '3px 12px', borderRadius: '20px',
              fontSize: '11px', fontWeight: '800',
              display: 'inline-flex', alignItems: 'center', gap: '4px'
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#166534' }}></span>
              {isReadOnly ? 'DISPATCH COMPLETED' : 'ALL ITEMS PACKED'}
            </span>
          </div>

          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginTop: '6px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span>Customer: <strong style={{ color: '#FFFFFF' }}>{custName}</strong></span>
            <span>•</span>
            <span>
              Sales Creator: <strong style={{
                color: '#FFFFFF',
                backgroundColor: 'rgba(14, 116, 144, 0.45)',
                padding: '2px 8px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <User style={{ width: '13px', height: '13px', color: '#67E8F9' }} /> {authenticSalesPerson}
              </strong>
            </span>
            <span>•</span>
            <span>Payment: <strong style={{ color: '#FFFFFF' }}>{bom.paymentType || '100% Paid'}</strong></span>
          </div>
        </div>
      </div>

      {/* Action Buttons in Header */}
      {!isReadOnly && (
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleInitiateConfirm}
            disabled={uploadingMedia || uploadingLr}
            style={{
              border: 'none',
              backgroundColor: (uploadingMedia || uploadingLr) ? '#E2E8F0' : '#FFFFFF',
              color: (uploadingMedia || uploadingLr) ? '#94A3B8' : '#065F46',
              height: '42px', padding: '0 20px',
              borderRadius: '10px', fontSize: '13px', fontWeight: '900',
              cursor: (uploadingMedia || uploadingLr) ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <CheckCircle style={{ width: '16px', height: '16px' }} />
            {uploadingMedia || uploadingLr
              ? 'Uploading Media...'
              : isAwaitingLr
                ? 'Upload LR Copy & Close BOM'
                : 'Confirm Loading & Dispatch'}
          </button>
        </div>
      )}
    </div>

    {/* ─── 1. VERIFIED PACKED ITEMS & CARGO MANIFEST CARD ─── */}
    <div style={{
      backgroundColor: '#FFFFFF', borderRadius: '16px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '18px 24px', borderBottom: '1px solid #E2E8F0',
        background: 'linear-gradient(135deg, #FAFBFC 0%, #F8FAFC 100%)',
        flexWrap: 'wrap', gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={20} style={{ color: '#0E7490' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Verified Packed Items & Cargo Manifest
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0' }}>
              Full list of verified items packed at fulfillment center ready for vehicle transport & dispatch.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0',
            color: '#065F46', padding: '5px 14px', borderRadius: '20px',
            fontSize: '12px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '6px'
          }}>
            <CheckCircle size={14} style={{ color: '#059669' }} />
            {allPackedItems.length} Items Packed & Verified (100%)
          </span>
        </div>
      </div>

      {/* Items Manifest Table */}
      <div style={{ padding: '0', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <th style={{ padding: '12px 18px', textAlign: 'center', width: '50px', fontWeight: '800' }}>#</th>
              <th style={{ padding: '12px 18px', textAlign: 'left', width: '140px', fontWeight: '800' }}>Item Code</th>
              <th style={{ padding: '12px 18px', textAlign: 'left', fontWeight: '800' }}>Description / Specification</th>
              <th style={{ padding: '12px 18px', textAlign: 'center', width: '130px', fontWeight: '800' }}>Ordered Qty</th>
              <th style={{ padding: '12px 18px', textAlign: 'center', width: '130px', fontWeight: '800' }}>Packed Qty</th>
              <th style={{ padding: '12px 18px', textAlign: 'center', width: '170px', fontWeight: '800' }}>Verification Status</th>
            </tr>
          </thead>
          <tbody>
            {allPackedItems.length > 0 ? (
              allPackedItems.map((item, idx) => {
                const code = item.code || item.itemCode || item.productCode || `ITM-${idx + 1}`;
                const name = item.name || item.itemName || 'Standard Component';
                const qty = Number(item.qty || item.bomQty || item.packedQty || 1);
                const uom = item.uom || item.unit || 'Nos';
                const isPacked = item.packed !== false;
                return (
                  <tr key={idx} style={{ borderBottom: idx === allPackedItems.length - 1 ? 'none' : '1px solid #F1F5F9', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                    <td style={{ padding: '12px 18px', textAlign: 'center', color: '#64748B', fontWeight: '700' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span style={{
                        backgroundColor: '#EFF6FF', color: '#1D4ED8',
                        padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '800',
                        border: '1px solid #BFDBFE'
                      }}>
                        {code}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', fontWeight: '700', color: '#0F172A' }}>
                      {name}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', color: '#475569', fontWeight: '700' }}>
                      {qty.toLocaleString('en-IN')} {uom}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'center', color: '#059669', fontWeight: '800' }}>
                      {qty.toLocaleString('en-IN')} {uom}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                      <span style={{
                        backgroundColor: isPacked ? '#ECFDF5' : '#FFFBEB',
                        color: isPacked ? '#047857' : '#B45309',
                        padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800',
                        border: isPacked ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                        display: 'inline-flex', alignItems: 'center', gap: '4px'
                      }}>
                        <CheckCircle size={12} style={{ color: isPacked ? '#059669' : '#D97706' }} />
                        {isPacked ? 'Verified & Packed' : 'Partially Packed'}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontStyle: 'italic' }}>
                  All order components verified and confirmed from Sales BOM.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Dispatch Packing Proof Photos (if attached during packing step) */}
      {packingProofPhotos.length > 0 && (
        <div style={{ padding: '16px 24px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0E7490', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={15} /> Dispatch Packing Proof Photos ({packingProofPhotos.length})
            </span>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              Photos captured during Dispatch Packing stage (boxes & accessories)
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
            {packingProofPhotos.map((ph, phIdx) => (
              <div
                key={ph.id || phIdx}
                onClick={() => openPhotoPreview(ph)}
                style={{
                  height: '85px', borderRadius: '8px', overflow: 'hidden',
                  cursor: 'pointer', border: '1px solid #CBD5E1', backgroundColor: '#0F172A',
                  position: 'relative'
                }}
                title={ph.name || 'Click to view packing photo'}
              >
                <VehicleMediaImg photo={ph} bomCode={bCode} onClick={() => openPhotoPreview(ph)} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    {/* ─── VEHICLE LOADING & LOGISTICS MOVEMENT CARD ─── */}
    <div style={{
      backgroundColor: '#FFFFFF', borderRadius: '16px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      overflow: 'hidden'
    }}>
      {/* Header Info */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 24px', borderBottom: '1px solid #E2E8F0',
        background: 'linear-gradient(135deg, #FAFBFC 0%, #F8FAFC 100%)',
        flexWrap: 'wrap', gap: '12px'
      }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Truck size={18} style={{ color: '#0E7490' }} /> Vehicle Loading & Dispatch Verification
          </h3>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0 0' }}>
            Verify vehicle loading and capture dispatch proof photos before departure.
          </p>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 14px', borderRadius: '20px',
          backgroundColor: isTransport ? '#ECFEFF' : '#F1F5F9',
          border: `1px solid ${isTransport ? '#A5F3FC' : '#CBD5E1'}`,
          fontSize: '12px', fontWeight: '800',
          color: isTransport ? '#0E7490' : '#475569'
        }}>
          <Truck size={14} /> Transport Mode: {salesTransportMode} {transp ? `• ${transp}` : ''}
        </div>
      </div>

      {/* LR Copy Attachment (shown ONLY when Transport is selected by Sales) */}
      {isTransport && (
        <div style={{
          padding: '18px 24px',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} style={{ color: '#0E7490' }} />
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                  Transporter LR Copy / Bilty Attachment
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                  Transport Mode: <strong style={{ color: '#0E7490' }}>Transport</strong> {transp ? `(${transp})` : ''}. Attach lorry receipt / bilty for 3rd-party logistics.
                </p>
              </div>
            </div>
            {!isReadOnly && !lrCopyDoc && (
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '7px 16px', borderRadius: '8px',
                backgroundColor: '#0E7490', color: '#FFFFFF',
                fontSize: '12px', fontWeight: '700', cursor: uploadingLr ? 'not-allowed' : 'pointer'
              }}>
                <Upload size={14} /> {uploadingLr ? 'Uploading...' : 'Attach LR Copy (PDF / Image)'}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  disabled={uploadingLr}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadLrCopy(e.target.files[0]);
                    }
                  }}
                  style={{ display: 'none' }}
                />
              </label>
            )}
          </div>

          {lrCopyDoc ? (
            <div style={{
              backgroundColor: '#F0FDF4',
              border: '1px solid #86EFAC',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle size={20} style={{ color: '#16A34A' }} />
                <div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#166534' }}>
                    Transporter LR Copy Attached: {lrCopyDoc.name || 'Lorry_Receipt.pdf'}
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#64748B', marginLeft: '8px' }}>
                    ({lrCopyDoc.size || 'Attached'})
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handlePreviewLrCopy}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: '1px solid #0E7490',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Eye size={13} /> View LR
                </button>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setLrCopyDoc(null)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid #FCA5A5',
                      backgroundColor: '#FEF2F2',
                      color: '#EF4444',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    ✕ Remove
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1.5px dashed #CBD5E1',
              backgroundColor: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                No LR Copy attached yet. You can attach it here or when confirming dispatch departure.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ─── VEHICLE LOADING PROOF PHOTOS SECTION ─── */}
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
                Vehicle Loading & Logistics Proof Photos
              </h4>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                Capture or upload clear photos of loaded vehicle, cargo securing, and logistics dispatch before departure.
              </p>
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            Stored securely in Businz Cloud & Media Storage
          </span>
        </div>

        {/* Blue alert strip */}
        <div style={{
          backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', borderRadius: '10px',
          padding: '10px 14px', fontSize: '12px', color: '#0E7490', fontWeight: '700',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <CheckCircle size={16} style={{ color: '#0E7490', flexShrink: 0 }} />
          <span>Uploaded loading photos are saved instantly and viewed directly by the Sales Person and Accounts team.</span>
        </div>

        {/* Add Photo dropdown button */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {!isReadOnly && (
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
                <Camera size={15} /> Add Loading Photo ▾
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
                      <input id="vehicle-loading-input-1" name="input1" aria-label="Input 1"
                        type="file"
                        multiple
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          setShowAddPhotoMenu(false);
                          handleAddPhotoFiles(e.target.files);
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

        {/* Uploading indicator */}
        {uploadingMedia && (
          <div style={{ padding: '10px 16px', backgroundColor: '#ECFEFF', border: '1px solid #06B6D4', borderRadius: '8px', color: '#0E7490', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 size={16} className="animate-spin" /> Uploading media files to secure storage...
          </div>
        )}

        {/* Media Gallery Thumbnails */}
        {currentPhotos.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginTop: '6px' }}>
            {currentPhotos.map((ph, phIdx) => (
              <div key={ph.id || phIdx} style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div
                  onClick={() => openPhotoPreview(ph)}
                  style={{ height: '95px', backgroundColor: '#0F172A', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                >
                  <VehicleMediaImg
                    photo={ph}
                    bomCode={bCode}
                    onClick={() => openPhotoPreview(ph)}
                  />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15,23,42,0.8)', color: '#FFFFFF', padding: '3px 8px', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={11} style={{ color: '#38BDF8', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ph.capturedAt || 'Verified'}</span>
                  </div>
                </div>
                <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }} title={ph.name}>
                    {ph.name}
                  </span>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setLoadingPhotos(prev => prev.filter((_, idx) => idx !== phIdx))}
                      style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                      title="Remove photo"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: '#64748B', fontStyle: 'italic' }}>
            No vehicle loading photos uploaded yet. You can attach lorry photos or snap directly using Live Camera.
          </div>
        )}
      </div>

      {/* Action Buttons Footer */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid #E2E8F0',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ fontSize: '13px', color: '#64748B', fontWeight: '700' }}>
          Transport Mode: <span style={{
            color: isTransport ? '#0E7490' : '#475569',
            fontWeight: '900'
          }}>
            {salesTransportMode} {isTransport && transp ? `(${transp})` : (!isTransport ? '(No LR Required)' : '')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 20px', borderRadius: '8px', border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF', color: '#475569', fontSize: '13px',
              fontWeight: '700', cursor: 'pointer', transition: 'all 0.15s ease'
            }}
          >
            <ChevronLeft size={16} /> Back
          </button>
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleInitiateConfirm}
              disabled={uploadingMedia || uploadingLr}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 22px', borderRadius: '8px', border: 'none',
                backgroundColor: (uploadingMedia || uploadingLr) ? '#94A3B8' : '#0E7490',
                color: '#FFFFFF', fontSize: '13px', fontWeight: '800',
                cursor: (uploadingMedia || uploadingLr) ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(14,116,144,0.3)',
                transition: 'all 0.15s ease'
              }}
            >
              <Truck size={16} />
              {isAwaitingLr
                ? 'Upload LR Copy & Close BOM'
                : 'Confirm Loading & Dispatch'}
            </button>
          )}
        </div>
      </div>
    </div>

    {/* Dedicated LR Copy Upload Popup Modal for 3rd-Party Transport */}
    {showLrPopup && (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999, padding: '20px'
      }}>
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '18px',
          width: '100%', maxWidth: '540px', overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          border: '1px solid #CBD5E1', display: 'flex', flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{
            padding: '18px 22px',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} style={{ color: '#38BDF8' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                  Upload Transporter LR Copy / Bilty
                </h3>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
                Order Ref: <strong style={{ color: '#E2E8F0' }}>{bCode}</strong> • {transp || '3rd-Party Transport'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowLrPopup(false)}
              style={{
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: '#FFFFFF', width: '32px', height: '32px', borderRadius: '8px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', fontWeight: 'bold'
              }}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* LR Docket Number input */}
            <div>
              <label htmlFor="vehicle-loading-lr-docket-bilty" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                LR / Docket / Bilty Number
              </label>
              <input id="vehicle-loading-lr-docket-bilty" name="lRDocketBilty" aria-label="LR / Docket / Bilty Number"
                type="text"
                value={popupLrNo}
                onChange={(e) => {
                  setPopupLrNo(e.target.value);
                  setVehicleLoadingData(prev => ({ ...prev, lrNo: e.target.value }));
                }}
                placeholder="e.g. LR-2026-8812"
                style={{
                  width: '100%', height: '42px', borderRadius: '10px',
                  border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px',
                  fontWeight: '700', color: '#0F172A', outline: 'none', boxSizing: 'border-box'
                }}
               />
            </div>

            {/* Upload Zone */}
            <div style={{
              backgroundColor: lrCopyDoc ? '#F0FDF4' : '#F8FAFC',
              border: `2px dashed ${lrCopyDoc ? '#86EFAC' : '#CBD5E1'}`,
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px'
            }}>
              {lrCopyDoc ? (
                <>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '10px',
                    backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <FileText size={24} style={{ color: '#16A34A' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                      {lrCopyDoc.name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                      {lrCopyDoc.size || 'Attached'} • Ready to Complete
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={handlePreviewLrCopy}
                      style={{
                        padding: '6px 12px', borderRadius: '6px',
                        border: '1px solid #0E7490', backgroundColor: '#0E7490',
                        color: '#FFFFFF', fontSize: '11.5px', fontWeight: '700',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      <Eye size={13} /> View
                    </button>
                    <label style={{
                      padding: '6px 12px', borderRadius: '6px',
                      border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF',
                      color: '#0F172A', fontSize: '11.5px', fontWeight: '700',
                      cursor: uploadingLr ? 'not-allowed' : 'pointer'
                    }}>
                      Replace
                      <input id="vehicle-loading-input-2" name="input2" aria-label="Input 2"
                        type="file"
                        accept="image/*,application/pdf"
                        disabled={uploadingLr}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleUploadLrCopy(e.target.files[0]);
                          }
                        }}
                       />
                    </label>
                    <button
                      type="button"
                      onClick={() => setLrCopyDoc(null)}
                      style={{
                        padding: '6px 10px', borderRadius: '6px',
                        border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2',
                        color: '#EF4444', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '12px',
                    backgroundColor: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <UploadCloud size={24} style={{ color: '#0284C7' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                      Upload Physical LR / Bilty Receipt
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                      Supports PNG, JPG, or PDF from driver or transporter
                    </div>
                  </div>
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    backgroundColor: '#0E7490', color: '#FFFFFF',
                    padding: '8px 18px', borderRadius: '8px',
                    fontSize: '12.5px', fontWeight: '800',
                    cursor: uploadingLr ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(14,116,144,0.3)',
                    marginTop: '4px'
                  }}>
                    {uploadingLr ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                    {uploadingLr ? 'Uploading LR Copy...' : 'Choose File to Upload'}
                    <input id="vehicle-loading-input-3" name="input3" aria-label="Input 3"
                      type="file"
                      accept="image/*,application/pdf"
                      disabled={uploadingLr}
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadLrCopy(e.target.files[0]);
                        }
                      }}
                     />
                  </label>
                </>
              )}
            </div>

            {/* Explanatory note */}
            <div style={{
              backgroundColor: '#FFFBEB', border: '1px solid #FDE68A',
              borderRadius: '10px', padding: '10px 14px',
              fontSize: '11.5px', color: '#92400E', lineHeight: '1.4',
              display: 'flex', alignItems: 'flex-start', gap: '8px'
            }}>
              <Info size={15} style={{ color: '#D97706', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>LR Copy Requirement:</strong> If the LR copy is available now, upload it and click <strong>"Upload & Complete Dispatch"</strong>. If the driver has not yet provided the LR copy, you can click <strong>"Skip & Dispatch (Awaiting LR Copy)"</strong> so the vehicle can depart on road; the BOM will remain open until the receipt is uploaded later.
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          <div style={{
            padding: '14px 22px', backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px'
          }}>
            <button
              type="button"
              onClick={() => setShowLrPopup(false)}
              style={{
                padding: '8px 16px', borderRadius: '8px',
                border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF',
                color: '#475569', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  handleFinalizeVehicleLoading({
                    forceStatus: 'Dispatched - Awaiting LR Copy',
                    overrideLrDoc: null,
                    overrideLrNo: popupLrNo || lr
                  });
                }}
                disabled={uploadingLr}
                style={{
                  padding: '8px 16px', borderRadius: '8px',
                  border: '1px solid #F59E0B', backgroundColor: '#FEF3C7',
                  color: '#92400E', fontSize: '12.5px', fontWeight: '800',
                  cursor: uploadingLr ? 'not-allowed' : 'pointer'
                }}
              >
                Skip & Dispatch (Awaiting LR)
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!lrCopyDoc) {
                    alert('Please choose an LR Copy file to upload, or click "Skip & Dispatch (Awaiting LR)" if the document is not yet received.');
                    return;
                  }
                  handleFinalizeVehicleLoading({
                    forceStatus: 'Completed',
                    overrideLrDoc: lrCopyDoc,
                    overrideLrNo: popupLrNo || lr
                  });
                }}
                disabled={!lrCopyDoc || uploadingLr}
                style={{
                  padding: '8px 20px', borderRadius: '8px', border: 'none',
                  backgroundColor: (!lrCopyDoc || uploadingLr) ? '#94A3B8' : '#0E7490',
                  color: '#FFFFFF', fontSize: '12.5px', fontWeight: '800',
                  cursor: (!lrCopyDoc || uploadingLr) ? 'not-allowed' : 'pointer',
                  boxShadow: (!lrCopyDoc || uploadingLr) ? 'none' : '0 2px 6px rgba(14,116,144,0.3)',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <CheckCircle size={15} /> Upload & Complete Dispatch
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Live Camera Modal (like DispatchPackingModal) */}
    {showLiveCameraModal && (
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
                Dispatch Live Camera — Snap Loading Photo
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (cameraStreamRef.current) {
                  cameraStreamRef.current.getTracks().forEach(t => t.stop());
                  cameraStreamRef.current = null;
                }
                setShowLiveCameraModal(false);
              }}
              style={{ border: 'none', background: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          <div style={{ position: 'relative', width: '100%', height: '380px', backgroundColor: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {cameraError ? (
              <div style={{ color: '#F87171', padding: '20px', textAlign: 'center', fontSize: '13px' }}>
                {cameraError}
              </div>
            ) : (
              <video
                ref={cameraVideoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            <canvas ref={cameraCanvasRef} style={{ display: 'none' }} />
          </div>

          <div style={{
            padding: '16px 20px', borderTop: '1px solid #334155',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            backgroundColor: '#0F172A'
          }}>
            <button
              type="button"
              onClick={() => {
                if (cameraStreamRef.current) {
                  cameraStreamRef.current.getTracks().forEach(t => t.stop());
                  cameraStreamRef.current = null;
                }
                setShowLiveCameraModal(false);
              }}
              style={{
                padding: '8px 18px', borderRadius: '8px', border: '1px solid #475569',
                backgroundColor: '#1E293B', color: '#94A3B8', fontSize: '13px', fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSnapCameraPhoto}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 24px', borderRadius: '8px', border: 'none',
                backgroundColor: '#0284C7', color: '#FFFFFF', fontSize: '13px', fontWeight: '800',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(2,132,199,0.4)'
              }}
            >
              <Camera size={16} /> Capture Photo
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Local Media Lightbox Preview */}
    {localMediaPreviewModal && (
      <ActiveMediaPreviewModal
        activeMediaPreviewModal={localMediaPreviewModal}
        onClose={() => {
          setLocalMediaPreviewModal(null);
          setActiveMediaPreviewModal(null);
        }}
      />
    )}
  </div>
);
}

