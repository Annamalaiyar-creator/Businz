import React, { useState } from "react";
import {
  Trash2, X, CheckCircle, Phone, UploadCloud, Truck, Package,
  Upload, Camera, Image, Video, Film
} from "lucide-react";
import { saveCloudStore } from "../../utils/supabaseDataSync";

export default function VehicleLoadingModal({
  vehicleLoadingModal,
  onClose,
  setBomStore,
  setActiveMediaPreviewModal = () => {}
}) {
  const [vehicleLoadingData, setVehicleLoadingData] = useState({
    vehicleNo: "",
    driverName: "",
    driverPhone: "",
    transporter: "VRL Logistics Direct Fleet",
    lrNo: "LR-881204",
    sealNo: "SL-884920"
  });
  const [loadingPhotos, setLoadingPhotos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState([]);
const bom = vehicleLoadingModal;
const bCode = bom.bomCode || bom.code || 'BOM-2026';
const invNo = bom.invoiceNo || (bom.invoiceConfirmed ? `INV-${bCode.replace('BOM-', '')}` : 'INV-2026-FINAL');
const custName = bom.customerName || bom.companyName || bom.customer || 'Customer';
const delAddr = bom.deliveryAddress || 'Client Delivery Site';
const isReadOnly = Boolean(bom.isReadOnly || bom.status === 'Completed' || bom.status === 'Fully Dispatched & BOM Flow Completed' || bom.status === 'Fully Dispatched & Delivered');

// Existing vehicle loading data if already saved
const existingLoading = bom.vehicleLoading || {};
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

const handleAddPhotoFiles = (files) => {
  if (!files || files.length === 0) return;
  Array.from(files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const newPhoto = {
        id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        dataUrl: loadEvt.target.result,
        capturedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      };
      setLoadingPhotos(prev => [...prev, newPhoto]);
    };
    reader.readAsDataURL(file);
  });
};

const handleAddVideoFiles = (files) => {
  if (!files || files.length === 0) return;
  Array.from(files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const newVideo = {
        id: `video_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        dataUrl: loadEvt.target.result,
        recordedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      };
      setLoadingVideos(prev => [...prev, newVideo]);
    };
    reader.readAsDataURL(file);
  });
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

  const dataUrl = canvas.toDataURL('image/jpeg');
  const samplePhoto = {
    id: `photo_sample_${Date.now()}`,
    name: `Truck_Loading_LivePhoto_${Date.now().toString().slice(-4)}.jpg`,
    size: '1.4 MB',
    dataUrl: dataUrl,
    capturedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  };
  setLoadingPhotos(prev => [...prev, samplePhoto]);
};

const handleFinalizeVehicleLoading = () => {
  if (!isReadOnly) {
    if (!vNo) {
      alert('⚠️ Please enter the Vehicle / Lorry Registration Number before completing dispatch!');
      return;
    }
    if (currentPhotos.length === 0 && currentVideos.length === 0) {
      alert('⚠️ Verification Photo/Video Mandatory!\n\nPlease capture or upload at least one loading photo or video of the vehicle before finalizing.');
      return;
    }
  }

  const loadingPayload = {
    vehicleNo: vNo || 'TN-09-CB-4821',
    driverName: dName || 'K. Murugan',
    driverPhone: dPhone || '+91 98765 43210',
    transporter: transp,
    lrNo: lr,
    sealNo: seal,
    photos: currentPhotos,
    videos: currentVideos,
    loadedAt: new Date().toISOString(),
    loadedTimeStr: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  };

  // Update BOM status to Fully Completed & persist
  setBomStore(prev => {
    const updated = prev.map(b => (b.bomCode === bCode || b.code === bCode) ? {
      ...b,
      status: 'Completed',
      fullyCompleted: true,
      vehicleLoading: loadingPayload,
      completedAt: new Date().toISOString()
    } : b);
    try {
      saveCloudStore('bom_store', updated);
    } catch (e) { }
    return updated;
  });

  // Update Invoice status to Fully Dispatched & Delivered & persist
  setInvoiceList(prev => {
    const updatedInvoices = prev.map(i => (i.poNo === bCode || i.code === bCode || i.invNo === invNo) ? {
      ...i,
      status: 'Fully Dispatched & Delivered',
      pay: 'Completed & Delivered',
      vehicleLoading: loadingPayload
    } : i);
    try {
      saveCloudStore('invoice_store', updatedInvoices);
    } catch (e) { }
    return updatedInvoices;
  });

  const completedSummary = {
    bomCode: bCode,
    invoiceNo: invNo,
    customer: custName,
    salesPerson: (bom.salesPerson || localStorage.getItem('controlroom_logged_user_name') || 'Mohith JV').replace(/\s*\([^)]*\)/g, '').trim(),
    deliveryAddress: delAddr,
    packedCount: packedItems.length,
    vehicleLoading: loadingPayload
  };

  onClose();
  setLoadingPhotos([]);
  setLoadingVideos([]);
  setCompletedBomSummaryModal(completedSummary);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
            <Truck size={18} style={{ color: '#4F46E5' }} />
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
              Vehicle & Driver Logistics Information
            </span>
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

              {/* Photo Grid Gallery */}
              {currentPhotos.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
                  {currentPhotos.map((p, pIdx) => (
                    <div key={p.id || pIdx} style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                      <div
                        onClick={() => setActiveMediaPreviewModal({ type: 'image', url: p.dataUrl, name: p.name })}
                        style={{ height: '120px', width: '100%', backgroundColor: '#0F172A', cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <img src={p.dataUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
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

              {/* Video Player Gallery */}
              {currentVideos.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                  {currentVideos.map((vid, vIdx) => (
                    <div key={vid.id || vIdx} style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
                      <video
                        controls
                        src={vid.dataUrl}
                        style={{ width: '100%', height: '180px', backgroundColor: '#0F172A', objectFit: 'contain' }}
                      />
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
              style={{
                padding: '10px 24px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#16A34A',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 3px 10px rgba(22,163,74,0.3)'
              }}
            >
              <CheckCircle size={16} /> Complete Vehicle Loading & Finalize BOM
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
);
}
