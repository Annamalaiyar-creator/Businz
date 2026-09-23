import React, { useState, useEffect } from "react";
import {
  Trash2, X, CheckCircle, Phone, UploadCloud, Truck, Package,
  Upload, Camera, Image, Video, Film, Loader2, FileText
} from "lucide-react";
import { saveCloudStore } from "../../utils/supabaseDataSync";
import { centralInventoryStore } from "../../utils/centralInventoryStore";
import { uploadBomDocumentFile, validateClientFile } from "../../utils/bomStorageClient";
import { resolveDocumentUrlAsync } from "../../utils/documentResolver";

function VehicleMediaImg({ photo, bomCode, onClick }) {
  const [resolvedSrc, setResolvedSrc] = useState(photo.url || photo.dataUrl || '');
  useEffect(() => {
    let active = true;
    if (!resolvedSrc && (photo.storageBucket || photo.storagePath)) {
      resolveDocumentUrlAsync(photo, bomCode).then(url => {
        if (active && url) setResolvedSrc(url);
      });
    }
    return () => { active = false; };
  }, [photo, bomCode, resolvedSrc]);

  return (
    <div
      onClick={() => onClick && onClick(resolvedSrc)}
      style={{ height: '120px', width: '100%', backgroundColor: '#0F172A', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {resolvedSrc ? (
        <img src={resolvedSrc} alt={photo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Loader2 className="animate-spin text-cyan-400" size={20} />
      )}
    </div>
  );
}

function VehicleMediaVideo({ video, bomCode }) {
  const [resolvedSrc, setResolvedSrc] = useState(video.url || video.dataUrl || '');
  useEffect(() => {
    let active = true;
    if (!resolvedSrc && (video.storageBucket || video.storagePath)) {
      resolveDocumentUrlAsync(video, bomCode).then(url => {
        if (active && url) setResolvedSrc(url);
      });
    }
    return () => { active = false; };
  }, [video, bomCode, resolvedSrc]);

  return (
    <video
      controls
      src={resolvedSrc}
      style={{ width: '100%', height: '180px', backgroundColor: '#0F172A', objectFit: 'contain' }}
    />
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

  const [deliveryMode, setDeliveryMode] = useState(
    bom.deliveryMode || existingLoading.deliveryMode || 'transport' // 'transport' | 'direct'
  );
  const [lrCopyDoc, setLrCopyDoc] = useState(
    bom.lrCopyDoc || existingLoading.lrCopyDoc || null
  );
  const [uploadingLr, setUploadingLr] = useState(false);

  const [vehicleLoadingData, setVehicleLoadingData] = useState({
    vehicleNo: existingLoading.vehicleNo || "",
    driverName: existingLoading.driverName || "",
    driverPhone: existingLoading.driverPhone || "",
    transporter: existingLoading.transporter || "VRL Logistics Direct Fleet",
    lrNo: existingLoading.lrNo || "LR-881204",
    sealNo: existingLoading.sealNo || "SL-884920"
  });
  const [loadingMediaMode, setLoadingMediaMode] = useState('photo'); // 'photo' | 'video' | 'camera'
  const [loadingPhotos, setLoadingPhotos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const bCode = bom.bomCode || bom.code || 'BOM-2026';
  const invNo = bom.invoiceNo || (bom.invoiceConfirmed ? `INV-${bCode.replace('BOM-', '')}` : 'INV-2026-FINAL');
  const custName = bom.customerName || bom.companyName || bom.customer || 'Customer';
  const delAddr = bom.deliveryAddress || 'Client Delivery Site';

  const isAwaitingLr = bom.status === 'Dispatched - Awaiting LR Copy';
  const isReadOnly = Boolean((bom.isReadOnly || bom.status === 'Completed' || bom.status === 'Fully Dispatched & BOM Flow Completed' || bom.status === 'Fully Dispatched & Delivered') && !isAwaitingLr);

  const handleUploadLrCopy = async (file) => {
    if (!file) return;
    setUploadingLr(true);
    try {
      validateClientFile(file);
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
        url: metadata.url || null,
        mimeType: metadata.mimeType,
        uploadedAt: new Date().toISOString()
      });
    } catch (err) {
      alert(`LR Copy upload error: ${err.message}`);
    } finally {
      setUploadingLr(false);
    }
  };

  const vNo = vehicleLoadingData.vehicleNo || existingLoading.vehicleNo || '';
  const dName = vehicleLoadingData.driverName || existingLoading.driverName || '';
  const dPhone = vehicleLoadingData.driverPhone || existingLoading.driverPhone || '';
  const transp = vehicleLoadingData.transporter || existingLoading.transporter || 'VRL Logistics Direct Fleet';
  const lr = vehicleLoadingData.lrNo || existingLoading.lrNo || 'LR-881204';
  const seal = vehicleLoadingData.sealNo || existingLoading.sealNo || 'SL-884920';

const currentPhotos = loadingPhotos.length > 0 ? loadingPhotos : (existingLoading.photos || []);
const currentVideos = loadingVideos.length > 0 ? loadingVideos : (existingLoading.videos || []);

const packedItems = (bom.dispatchPacking && Array.isArray(bom.dispatchPacking) && bom.dispatchPacking.length > 0)
  ? bom.dispatchPacking.filter(p => Boolean(p.packed))
  : (bom.items || []).filter(i => i.selected !== false);

const handleAddPhotoFiles = async (files) => {
  if (!files || files.length === 0) return;
  setUploadingMedia(true);
  setUploadError('');
  try {
    for (const file of Array.from(files)) {
      validateClientFile(file);
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
        mimeType: metadata.mimeType,
        uploadedAt: metadata.uploadedAt,
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

const handleAddVideoFiles = async (files) => {
  if (!files || files.length === 0) return;
  setUploadingMedia(true);
  setUploadError('');
  try {
    for (const file of Array.from(files)) {
      validateClientFile(file);
      const metadata = await uploadBomDocumentFile({
        file,
        bomCode: bCode,
        category: 'dispatch/videos'
      });
      const newVideo = {
        id: `video_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: metadata.originalName || file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        storageBucket: metadata.storageBucket,
        storagePath: metadata.storagePath,
        mimeType: metadata.mimeType,
        uploadedAt: metadata.uploadedAt,
        recordedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      };
      setLoadingVideos(prev => [...prev, newVideo]);
    }
  } catch (err) {
    console.error('Video upload error:', err);
    setUploadError(err.message || 'Failed to upload video');
    alert(`Failed to upload video: ${err.message}`);
  } finally {
    setUploadingMedia(false);
  }
};

const handleAddSamplePhoto = () => {
  // Generate an illustrative canvas snapshot for truck loading
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');

  // Background truck interior
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(0, 0, 640, 400);

  // Staged pallets & solar rails
  ctx.fillStyle = '#334155';
  ctx.fillRect(60, 160, 520, 180);
  ctx.fillStyle = '#64748B';
  ctx.fillRect(100, 100, 440, 100);

  // Straps
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(140, 80);
  ctx.lineTo(140, 340);
  ctx.moveTo(320, 80);
  ctx.lineTo(320, 340);
  ctx.moveTo(500, 80);
  ctx.lineTo(500, 340);
  ctx.stroke();

  // Header banner overlay
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(0, 0, 640, 60);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`TRUCK LOADING VERIFICATION: ${bCode}`, 20, 36);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#86EFAC';
  ctx.fillText(`VEHICLE: ${vNo || 'TN-09-CB-4821'} • TIME: ${new Date().toLocaleTimeString()}`, 380, 36);

  canvas.toBlob(async (blob) => {
    if (!blob) return;
    setUploadingMedia(true);
    try {
      const fileName = `Truck_Loading_LivePhoto_${Date.now().toString().slice(-4)}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      const metadata = await uploadBomDocumentFile({
        file,
        bomCode: bCode,
        category: 'dispatch/images'
      });
      const samplePhoto = {
        id: `photo_sample_${Date.now()}`,
        name: fileName,
        size: '1.4 MB',
        storageBucket: metadata.storageBucket,
        storagePath: metadata.storagePath,
        mimeType: metadata.mimeType,
        uploadedAt: metadata.uploadedAt,
        capturedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      };
      setLoadingPhotos(prev => [...prev, samplePhoto]);
    } catch (err) {
      alert(`Sample photo upload failed: ${err.message}`);
    } finally {
      setUploadingMedia(false);
    }
  }, 'image/jpeg', 0.85);
};

const handleFinalizeVehicleLoading = () => {
  if (uploadingMedia || uploadingLr) {
    alert('⏳ Media or LR document is currently uploading to secure storage. Please wait until upload completes.');
    return;
  }
  if (!isReadOnly && !isAwaitingLr) {
    if (!vNo) {
      alert('⚠️ Please enter the Vehicle / Lorry Registration Number before completing dispatch!');
      return;
    }
    if (currentPhotos.length === 0 && currentVideos.length === 0) {
      alert('⚠️ Verification Photo/Video Mandatory!\n\nPlease capture or upload at least one loading photo or video of the vehicle before finalizing.');
      return;
    }
  }

  const isTransport = deliveryMode === 'transport';
  const hasLrCopy = Boolean(lrCopyDoc && (lrCopyDoc.url || lrCopyDoc.dataUrl || lrCopyDoc.name));
  const willCloseBom = !isTransport || hasLrCopy;
  const nextBomStatus = willCloseBom ? 'Completed' : 'Dispatched - Awaiting LR Copy';
  const nextInvoiceStatus = willCloseBom ? 'Fully Dispatched & Delivered' : 'Dispatched - In Transit';

  const loadingPayload = {
    ...existingLoading,
    deliveryMode,
    isTransport,
    vehicleNo: vNo || 'TN-09-CB-4821',
    driverName: dName || 'K. Murugan',
    driverPhone: dPhone || '+91 98765 43210',
    transporter: isTransport ? transp : 'Self-Pickup / Customer Handover',
    lrNo: isTransport ? lr : 'N/A (Self-Pickup)',
    sealNo: isTransport ? seal : 'N/A',
    lrCopyDoc: lrCopyDoc || null,
    photos: currentPhotos,
    videos: currentVideos,
    loadedAt: existingLoading.loadedAt || new Date().toISOString(),
    loadedTimeStr: existingLoading.loadedTimeStr || new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    fullyCompleted: willCloseBom
  };

  // Deduct Inventory in Central Inventory Store & Raw Materials Store (only once)
  if (!bom.stockDeducted) {
    try {
      const itemsToDeduct = (bom.items && bom.items.length > 0) ? bom.items : packedItems;
      centralInventoryStore.deductStockForBOM(bCode, itemsToDeduct, bom.salesPerson || 'Dispatch Vehicle Loading');
    } catch (cErr) {
      console.warn('Central store deduction error in VehicleLoadingModal:', cErr);
    }
  }

  // Update BOM status to Fully Completed or Awaiting LR Copy & persist
  setBomStore(prev => {
    const updated = prev.map(b => (b.bomCode === bCode || b.code === bCode) ? {
      ...b,
      status: nextBomStatus,
      fullyCompleted: willCloseBom,
      stockDeducted: true,
      vehicleLoading: loadingPayload,
      lrCopyDoc: lrCopyDoc || b.lrCopyDoc || null,
      dispatchedAt: b.dispatchedAt || new Date().toISOString(),
      completedAt: willCloseBom ? new Date().toISOString() : null
    } : b);
    try {
      saveCloudStore('bom_store', updated);
    } catch (e) { }
    return updated;
  });

  // Update Invoice status & persist
  if (typeof setInvoiceList === 'function') {
    setInvoiceList(prev => {
      const updatedInvoices = (prev || []).map(i => (i.poNo === bCode || i.code === bCode || i.invNo === invNo) ? {
        ...i,
        status: nextInvoiceStatus,
        pay: willCloseBom ? 'Completed & Delivered' : 'Dispatched - In Transit',
        vehicleLoading: loadingPayload,
        lrCopyDoc: lrCopyDoc || i.lrCopyDoc || null
      } : i);
      try {
        saveCloudStore('invoice_store', updatedInvoices);
      } catch (e) { }
      return updatedInvoices;
    });
  }

  window.dispatchEvent(new Event('central_inventory_updated'));
  window.dispatchEvent(new Event('controlroom_raw_materials_update'));
  window.dispatchEvent(new Event('controlroom_storage_update'));
  window.dispatchEvent(new Event('storage'));

  const completedSummary = {
    bomCode: bCode,
    invoiceNo: invNo,
    customer: custName,
    salesPerson: (bom.salesPerson || localStorage.getItem('controlroom_logged_user_name') || 'Mohith JV').replace(/\s*\([^)]*\)/g, '').trim(),
    deliveryAddress: delAddr,
    packedCount: packedItems.length,
    vehicleLoading: loadingPayload,
    status: nextBomStatus
  };

  onClose();
  setLoadingPhotos([]);
  setLoadingVideos([]);

  if (willCloseBom) {
    if (typeof setCompletedBomSummaryModal === 'function') {
      setCompletedBomSummaryModal(completedSummary);
    }
  } else {
    alert(`✅ Vehicle loading verified & goods dispatched!\n\nOrder ${bCode} is marked as "Dispatched - Awaiting LR Copy". The BOM will remain open in Dispatch Orders until the Transporter LR receipt is uploaded.`);
  }
};

return (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', backgroundColor: '#F8FAFC', zIndex: 999999, fontFamily: "'DM Sans', sans-serif", overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Modal Header Banner */}
      <div style={{
        padding: '20px 28px',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #334155'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#4F46E5', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(79,70,229,0.4)' }}>
            <Truck size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#FFFFFF', margin: 0 }}>
                {isReadOnly ? 'Vehicle Loading & Dispatch Verification (Completed)' : 'Despatch Vehicle Loading Verification'}
              </h2>
              <span style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: '#FFFFFF', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800' }}>
                {bCode}
              </span>
              <span style={{ backgroundColor: '#DCFCE7', color: '#166534', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '800' }}>
                {invNo}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: '3px 0 0 0' }}>
              Customer: <strong style={{ color: '#FFFFFF' }}>{custName}</strong> • Sales Creator: <strong style={{ color: '#38BDF8' }}>👤 {(bom.salesPerson || localStorage.getItem('controlroom_logged_user_name') || 'Mohith JV').replace(/\s*\([^)]*\)/g, '').trim()}</strong> • Destination: <span>{delAddr}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            setLoadingPhotos([]);
            setLoadingVideos([]);
          }}
          style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Modal Body (Scrollable) */}
      <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '22px', backgroundColor: '#F8FAFC' }}>

        {/* 1. Fulfillment & Stock Deduction Strip */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={16} style={{ color: '#059669' }} />
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                Packed Items Verified & Stock Deducted ({packedItems.length} Items)
              </span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', padding: '3px 10px', borderRadius: '12px' }}>
              ✓ Stock Decremented in Inventory
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {packedItems.map((item, pIdx) => (
              <div key={pIdx} style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#166534' }}>{item.name}</div>
                  <div style={{ fontSize: '11px', color: '#15803D' }}>Qty: {item.qty || item.bomQty || 1} {item.uom || 'Nos'}</div>
                </div>
                <CheckCircle size={16} style={{ color: '#16A34A' }} />
              </div>
            ))}
          </div>
        </div>

        {/* 2. Vehicle, Driver & Logistics Details Form */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={18} style={{ color: '#4F46E5' }} />
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                Vehicle & Logistics Movement Details
              </span>
            </div>

            {/* Delivery Movement Selector */}
            <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '10px', gap: '4px' }}>
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => setDeliveryMode('transport')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: deliveryMode === 'transport' ? '#4F46E5' : 'transparent',
                  color: deliveryMode === 'transport' ? '#FFFFFF' : '#64748B',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: isReadOnly ? 'default' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                🚛 3rd-Party Transport (VRL/ARC)
              </button>
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => setDeliveryMode('direct')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: deliveryMode === 'direct' ? '#16A34A' : 'transparent',
                  color: deliveryMode === 'direct' ? '#FFFFFF' : '#64748B',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: isReadOnly ? 'default' : 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                📦 Self-Pickup / Direct Delivery
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                Vehicle / Lorry Number <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={vNo}
                onChange={(e) => setVehicleLoadingData({ ...vehicleLoadingData, vehicleNo: e.target.value })}
                placeholder="e.g. TN-09-CB-4821"
                style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                Driver Full Name
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={dName}
                onChange={(e) => setVehicleLoadingData({ ...vehicleLoadingData, driverName: e.target.value })}
                placeholder="e.g. K. Murugan"
                style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                Driver Phone Number
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={dPhone}
                onChange={(e) => setVehicleLoadingData({ ...vehicleLoadingData, driverPhone: e.target.value })}
                placeholder="e.g. +91 98765 43210"
                style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                Logistics / Fleet Carrier
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={transp}
                onChange={(e) => setVehicleLoadingData({ ...vehicleLoadingData, transporter: e.target.value })}
                placeholder="e.g. VRL Logistics / Company Fleet"
                style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                LR / Bilty / Docket No
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={lr}
                onChange={(e) => setVehicleLoadingData({ ...vehicleLoadingData, lrNo: e.target.value })}
                placeholder="e.g. LR-2026-8812"
                style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                Container / Seal Number
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={seal}
                onChange={(e) => setVehicleLoadingData({ ...vehicleLoadingData, sealNo: e.target.value })}
                placeholder="e.g. SEAL-99201"
                style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* LR Copy Attachment Card (Specific to 3rd Party Transport) */}
          {deliveryMode === 'transport' && (
            <div style={{
              backgroundColor: lrCopyDoc ? '#F0FDF4' : '#FFFBEB',
              border: `1.5px dashed ${lrCopyDoc ? '#86EFAC' : '#FCD34D'}`,
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} style={{ color: lrCopyDoc ? '#16A34A' : '#D97706' }} />
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                    Transporter Lorry Receipt (LR Copy)
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: lrCopyDoc ? '#DCFCE7' : '#FEF3C7',
                    color: lrCopyDoc ? '#15803D' : '#B45309'
                  }}>
                    {lrCopyDoc ? 'LR COPY ATTACHED' : 'AWAITING LR COPY'}
                  </span>
                </div>

                {!isReadOnly && (
                  <label style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: lrCopyDoc ? '#FFFFFF' : '#D97706',
                    color: lrCopyDoc ? '#0F172A' : '#FFFFFF',
                    border: lrCopyDoc ? '1px solid #CBD5E1' : 'none',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: uploadingLr ? 'not-allowed' : 'pointer'
                  }}>
                    {uploadingLr ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                    {lrCopyDoc ? 'Replace LR Copy' : 'Upload LR Copy Receipt'}
                    <input
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
                )}
              </div>

              {lrCopyDoc ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText size={20} style={{ color: '#0284C7' }} />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A' }}>{lrCopyDoc.name || 'Lorry_Receipt_Copy.pdf'}</div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>{lrCopyDoc.size || 'Attached'} • Uploaded {new Date(lrCopyDoc.uploadedAt || Date.now()).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {(lrCopyDoc.url || lrCopyDoc.dataUrl) && (
                      <button
                        type="button"
                        onClick={() => setActiveMediaPreviewModal({
                          type: 'image',
                          url: lrCopyDoc.url || lrCopyDoc.dataUrl,
                          title: `LR Copy - ${bCode}`
                        })}
                        style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #0284C7', backgroundColor: '#F0F9FF', color: '#0369A1', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        👁️ Preview LR
                      </button>
                    )}
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => setLrCopyDoc(null)}
                        style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '11.5px', color: '#78350F', margin: 0, lineHeight: 1.4 }}>
                  💡 <strong>Business Note:</strong> If the LR copy is not yet received from the driver/transporter, you can finalize vehicle loading now. The BOM order will be kept <strong>OPEN</strong> under <strong>"Awaiting LR Copy"</strong> status until the receipt is uploaded.
                </p>
              )}
            </div>
          )}
        </div>

        {/* 3. Vehicle Loading Proof Media (Photos & Videos Verification - CRITICAL) */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} style={{ color: '#4F46E5' }} />
                <span style={{ fontSize: '15px', fontWeight: '900', color: '#0F172A' }}>
                  Vehicle Loading Proof Media (Photos & Videos)
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                Capture or upload live media of packed items placed inside vehicle.
              </p>
            </div>

            {/* Mode selector */}
            <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '10px' }}>
              <button
                type="button"
                onClick={() => setLoadingMediaMode('photo')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', border: 'none',
                  backgroundColor: loadingMediaMode === 'photo' ? '#FFFFFF' : 'transparent',
                  color: loadingMediaMode === 'photo' ? '#4F46E5' : '#64748B',
                  fontSize: '12px', fontWeight: '800', cursor: 'pointer',
                  boxShadow: loadingMediaMode === 'photo' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <Image size={14} /> Photos ({currentPhotos.length})
              </button>
              <button
                type="button"
                onClick={() => setLoadingMediaMode('video')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', border: 'none',
                  backgroundColor: loadingMediaMode === 'video' ? '#FFFFFF' : 'transparent',
                  color: loadingMediaMode === 'video' ? '#4F46E5' : '#64748B',
                  fontSize: '12px', fontWeight: '800', cursor: 'pointer',
                  boxShadow: loadingMediaMode === 'video' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <Video size={14} /> Videos ({currentVideos.length})
              </button>
            </div>
          </div>

          {/* PHOTOS PANE */}
          {loadingMediaMode === 'photo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!isReadOnly && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    backgroundColor: '#4F46E5', color: '#FFFFFF',
                    padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800',
                    cursor: 'pointer', boxShadow: '0 2px 6px rgba(79,70,229,0.3)'
                  }}>
                    <UploadCloud size={16} /> Upload Loading Photos
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleAddPhotoFiles(e.target.files)}
                    />
                  </label>

                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    backgroundColor: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0',
                    padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800',
                    cursor: 'pointer', boxShadow: '0 2px 6px rgba(22,101,52,0.15)'
                  }}>
                    <Camera size={16} /> 📸 Capture Live Camera Photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={(e) => handleAddPhotoFiles(e.target.files)}
                    />
                  </label>
                </div>
              )}

              {/* Uploading indicator */}
              {uploadingMedia && (
                <div style={{ padding: '10px 16px', backgroundColor: '#ECFEFF', border: '1px solid #06B6D4', borderRadius: '8px', color: '#0E7490', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 size={16} className="animate-spin" /> Uploading media files to secure storage...
                </div>
              )}

              {/* Photo Grid Gallery */}
              {currentPhotos.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
                  {currentPhotos.map((p, pIdx) => (
                    <div key={p.id || pIdx} style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                      <VehicleMediaImg
                        photo={p}
                        bomCode={bCode}
                        onClick={(resolvedUrl) => setActiveMediaPreviewModal({ type: 'image', url: resolvedUrl, name: p.name, bomCode: bCode })}
                      />
                      <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                          <div style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ fontSize: '10px', color: '#64748B' }}>{p.size || '1.2 MB'} • {p.capturedAt || 'Verified'}</div>
                        </div>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => setLoadingPhotos(prev => prev.filter((_, idx) => idx !== pIdx))}
                            style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ border: '2px dashed #CBD5E1', borderRadius: '14px', padding: '28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', backgroundColor: '#FAFAFA' }}>
                  <Camera size={32} style={{ color: '#94A3B8' }} />
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>No vehicle loading photos uploaded yet</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>Take or upload photos of packed boxes and mounting rails inside the lorry.</div>
                </div>
              )}
            </div>
          )}

          {/* VIDEOS PANE */}
          {loadingMediaMode === 'video' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!isReadOnly && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    backgroundColor: '#0284C7', color: '#FFFFFF',
                    padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800',
                    cursor: 'pointer', boxShadow: '0 2px 6px rgba(2,132,199,0.3)'
                  }}>
                    <UploadCloud size={16} /> Upload Loading Video
                    <input
                      type="file"
                      accept="video/*,.mp4,.webm,.mov"
                      style={{ display: 'none' }}
                      onChange={(e) => handleAddVideoFiles(e.target.files)}
                    />
                  </label>

                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    backgroundColor: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE',
                    padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '800',
                    cursor: 'pointer'
                  }}>
                    <Video size={16} /> 🎥 Record Live Camera Video
                    <input
                      type="file"
                      accept="video/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={(e) => handleAddVideoFiles(e.target.files)}
                    />
                  </label>
                </div>
              )}

              {/* Uploading indicator */}
              {uploadingMedia && (
                <div style={{ padding: '10px 16px', backgroundColor: '#ECFEFF', border: '1px solid #06B6D4', borderRadius: '8px', color: '#0E7490', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Loader2 size={16} className="animate-spin" /> Uploading media files to secure storage...
                </div>
              )}

              {/* Video Player Gallery */}
              {currentVideos.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {currentVideos.map((vid, vIdx) => (
                    <div key={vid.id || vIdx} style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
                      <VehicleMediaVideo video={vid} bomCode={bCode} />
                      <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>{vid.name}</div>
                          <div style={{ fontSize: '10px', color: '#64748B' }}>{vid.size || '3.5 MB'} • Recorded {vid.recordedAt}</div>
                        </div>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => setLoadingVideos(prev => prev.filter((_, idx) => idx !== vIdx))}
                            style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer', padding: '4px' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ border: '2px dashed #CBD5E1', borderRadius: '14px', padding: '28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', backgroundColor: '#FAFAFA' }}>
                  <Film size={32} style={{ color: '#94A3B8' }} />
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>No loading video recorded yet</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>Record video of the vehicle loading process for physical dispatch audit.</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Footer */}
      <div style={{
        padding: '16px 28px',
        borderTop: '1px solid #E2E8F0',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ fontSize: '12px', color: '#64748B' }}>
          {isReadOnly ? (
            <span style={{ color: '#166534', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle size={16} /> Entire BOM Flow & Vehicle Dispatch 100% Completed
            </span>
          ) : (
            <span>Submitting will finalize vehicle loading & complete the entire BOM cycle.</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => {
              onClose();
              setLoadingPhotos([]);
              setLoadingVideos([]);
            }}
            style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            Close
          </button>

          {!isReadOnly && (
            <button
              type="button"
              onClick={handleFinalizeVehicleLoading}
              disabled={uploadingMedia || uploadingLr}
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: (uploadingMedia || uploadingLr) ? '#94A3B8' : (deliveryMode === 'transport' && !lrCopyDoc ? '#D97706' : '#16A34A'),
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '800',
                cursor: (uploadingMedia || uploadingLr) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: (uploadingMedia || uploadingLr) ? 'none' : (deliveryMode === 'transport' && !lrCopyDoc ? '0 3px 10px rgba(217,119,6,0.3)' : '0 3px 10px rgba(22,163,74,0.3)')
              }}
            >
              {uploadingMedia || uploadingLr ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Uploading Documents...
                </>
              ) : isAwaitingLr ? (
                <>
                  <CheckCircle size={16} /> Save LR Copy & Close BOM Order
                </>
              ) : deliveryMode === 'direct' ? (
                <>
                  <CheckCircle size={16} /> Confirm Self-Pickup & Complete BOM
                </>
              ) : lrCopyDoc ? (
                <>
                  <CheckCircle size={16} /> Confirm Loading & Complete BOM with LR Copy
                </>
              ) : (
                <>
                  <Truck size={16} /> Confirm Loading & Dispatch (Await LR Copy)
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);
}
