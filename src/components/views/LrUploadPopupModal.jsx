import React, { useState } from 'react';
import { FileText, UploadCloud, Eye, Loader2, CheckCircle, Info, X } from 'lucide-react';
import { uploadBomDocumentFile, validateClientFile } from '../../utils/bomStorageClient';
import { saveCloudBomRow, saveCloudInvoiceRow } from '../../utils/supabaseDataSync';
import { centralInventoryStore } from '../../utils/centralInventoryStore';
import { stripDataUrlsFromRecord } from '../../utils/otherViewsShared';
import { notifyDispatchCompletedToSales } from '../../services/notificationService';
import { saveMediaToCache } from '../../utils/mediaUtils';

/**
 * Fast client-side image compression helper
 */
async function compressImageForUpload(file, maxDimension = 1280, quality = 0.82) {
  if (!file || !file.type.startsWith('image/')) return file;
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        let width = img.width || 1280;
        let height = img.height || 720;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
          resolve(compressedFile);
        }, 'image/jpeg', quality);
      } catch (_) {
        resolve(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export default function LrUploadPopupModal({
  bom,
  onClose,
  setBomStore = () => {},
  setInvoiceList = () => {},
  setActiveMediaPreviewModal = () => {},
  onSuccess = () => {}
}) {
  if (!bom) return null;

  const bCode = bom.bomCode || bom.code || 'BOM-2026';
  const existingLoading = bom.vehicleLoading || {};
  const transp = bom.transporterName || bom.transporter || existingLoading.transporter || '3rd-Party Transport';

  const [lrNo, setLrNo] = useState(bom.lrNo || existingLoading.lrNo || '');
  const [lrDoc, setLrDoc] = useState(bom.lrCopyDoc || existingLoading.lrCopyDoc || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileSelect = async (e) => {
    const rawFile = e.target.files && e.target.files[0];
    if (!rawFile) return;

    setUploading(true);
    setErrorMsg('');
    try {
      validateClientFile(rawFile);
      // Fast client-side compression for images
      const fileToUpload = rawFile.type.startsWith('image/')
        ? await compressImageForUpload(rawFile)
        : rawFile;

      const localPreview = URL.createObjectURL(fileToUpload);
      const localDataUrl = await readFileAsDataUrl(fileToUpload);

      if (fileToUpload.name && localDataUrl) {
        saveMediaToCache(fileToUpload.name, localDataUrl);
      }

      const metadata = await uploadBomDocumentFile({
        file: fileToUpload,
        bomCode: bCode,
        category: 'dispatch/lr_copy'
      });

      setLrDoc({
        id: `lr_${Date.now()}`,
        name: metadata.originalName || fileToUpload.name,
        size: `${(fileToUpload.size / 1024).toFixed(1)} KB`,
        storageBucket: metadata.storageBucket,
        storagePath: metadata.storagePath,
        url: metadata.url || localPreview,
        dataUrl: metadata.dataUrl || localDataUrl,
        previewUrl: localPreview,
        mimeType: metadata.mimeType || fileToUpload.type,
        uploadedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('LR upload error:', err);
      setErrorMsg(err.message || 'Failed to upload LR Copy file.');
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = () => {
    if (!lrDoc) return;
    const isPdf = lrDoc.mimeType === 'application/pdf' || (lrDoc.name && lrDoc.name.toLowerCase().endsWith('.pdf'));
    const url = lrDoc.url || lrDoc.dataUrl || lrDoc.previewUrl;
    if (typeof setActiveMediaPreviewModal === 'function') {
      setActiveMediaPreviewModal({
        type: isPdf ? 'pdf' : 'image',
        url,
        dataUrl: url,
        previewUrl: url,
        title: `LR Copy - ${lrDoc.name || bCode}`,
        name: lrDoc.name || `LR Copy - ${bCode}`,
        bomCode: bCode,
        storageBucket: lrDoc.storageBucket,
        storagePath: lrDoc.storagePath
      });
    } else {
      window.open(url, '_blank');
    }
  };

  const handleSaveAndComplete = async () => {
    if (uploading) return;
    if (!lrDoc && !lrNo.trim()) {
      setErrorMsg('Please upload the physical LR Copy file or enter the LR Number.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const cleanSeq = (bCode.match(/(\d+)$/)?.[1] || '01');
      const invNo = bom.invoiceNo || `VRM-INV-2026-${cleanSeq}`;
      const custName = bom.customerName || bom.companyName || bom.customer || 'Customer';
      const authenticSalesPerson = bom.salesPerson || bom.sales_person || bom.createdBy || 'Sales Department';
      const authenticSalesPersonCode = bom.salesPersonCode || bom.sales_person_code || bom.createdById || '';

      const updatedLoading = {
        ...existingLoading,
        lrNo: lrNo.trim() || existingLoading.lrNo || 'LR Uploaded',
        lrCopyDoc: lrDoc,
        fullyCompleted: true
      };

      const updatedBomData = {
        ...bom,
        status: 'Completed',
        fullyCompleted: true,
        vehicleLoading: updatedLoading,
        lrCopyDoc: lrDoc,
        lrNo: lrNo.trim() || bom.lrNo || existingLoading.lrNo || '',
        completedAt: new Date().toISOString()
      };

      // 1. Deduct Inventory if not already deducted
      if (!bom.stockDeducted) {
        try {
          const itemsToDeduct = (bom.items && bom.items.length > 0) ? bom.items : (bom.dispatchPacking || []);
          centralInventoryStore.deductStockForBOM(bCode, itemsToDeduct, authenticSalesPerson || 'Dispatch LR Upload', false);
        } catch (cErr) {
          console.warn('Central store deduction note:', cErr);
        }
      }

      // 2. Local state update
      setBomStore(prev => {
        const list = Array.isArray(prev) ? prev : [];
        const next = list.map(b => (b.bomCode === bCode || b.code === bCode || b.id === bCode) ? updatedBomData : b);
        try {
          localStorage.setItem('controlroom_bom_store', JSON.stringify(next.map(stripDataUrlsFromRecord)));
        } catch (_) {}
        return next;
      });

      // 3. Server update
      try {
        await fetch('/api/boms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bom: updatedBomData, isUpdate: true })
        });
      } catch (apiErr) {
        console.warn('Server BOM update error:', apiErr);
      }

      // 4. Cloud sync
      try {
        await saveCloudBomRow(updatedBomData);
      } catch (cErr) {
        console.warn('Cloud BOM sync error:', cErr);
      }

      // 5. Update invoice list
      if (typeof setInvoiceList === 'function') {
        setInvoiceList(prev => {
          const list = Array.isArray(prev) ? prev : [];
          const next = list.map(i => (i.poNo === bCode || i.code === bCode || i.invNo === invNo) ? {
            ...i,
            status: 'Fully Dispatched & Delivered',
            pay: 'Completed & Delivered',
            vehicleLoading: updatedLoading,
            lrCopyDoc: lrDoc
          } : i);
          try {
            const targetInvoice = next.find(i => (i.poNo === bCode || i.code === bCode || i.invNo === invNo));
            if (targetInvoice) saveCloudInvoiceRow(targetInvoice);
            localStorage.setItem('controlroom_invoice_store', JSON.stringify(next.map(stripDataUrlsFromRecord)));
          } catch (_) {}
          return next;
        });
      }

      // 6. Notify sales
      try {
        notifyDispatchCompletedToSales({
          bomCode: bCode,
          customerName: custName,
          salesPerson: authenticSalesPerson,
          salesPersonCode: authenticSalesPersonCode,
          vehicleNo: updatedLoading.vehicleNo || '3rd-Party Transport',
          lrNo: lrNo.trim() || 'Uploaded',
          transporter: transp,
          deliveryMode: 'transport',
          status: 'Completed'
        });
      } catch (nErr) {
        console.warn('Sales notification error:', nErr);
      }

      onSuccess(updatedBomData);
      onClose();
    } catch (err) {
      console.error('Finalize LR copy error:', err);
      setErrorMsg(err.message || 'Failed to complete dispatch with LR copy.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        zIndex: 25000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '540px',
          maxWidth: '96vw',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                color: '#38BDF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>
                Upload Transporter LR Copy / Bilty
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>
                Order Ref: <strong style={{ color: '#E2E8F0' }}>{bCode}</strong> • {transp}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#FFFFFF',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errorMsg && (
            <div
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12.5px',
                fontWeight: '600'
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* LR Number Input */}
          <div>
            <label
              htmlFor="lr-upload-popup-number"
              style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}
            >
              LR / Docket / Bilty Number
            </label>
            <input
              id="lr-upload-popup-number"
              type="text"
              value={lrNo}
              onChange={(e) => setLrNo(e.target.value)}
              placeholder="e.g. VRL-892401 or ARC-6621"
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                padding: '0 12px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Document Upload Zone */}
          <div
            style={{
              backgroundColor: lrDoc ? '#F0FDF4' : '#F8FAFC',
              border: `2px dashed ${lrDoc ? '#86EFAC' : '#CBD5E1'}`,
              borderRadius: '12px',
              padding: '20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            {lrDoc ? (
              <>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '10px',
                    backgroundColor: '#DCFCE7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <CheckCircle size={26} style={{ color: '#16A34A' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A' }}>
                    {lrDoc.name}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                    {lrDoc.size || 'Attached'} • Ready to finalize
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={handlePreview}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: '1px solid #0E7490',
                      backgroundColor: '#0E7490',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Eye size={13} /> View File
                  </button>
                  <label
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: uploading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Replace
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      disabled={uploading}
                      style={{ display: 'none' }}
                      onChange={handleFileSelect}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setLrDoc(null)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #FCA5A5',
                      backgroundColor: '#FEF2F2',
                      color: '#EF4444',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Remove
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: '#E0F2FE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <UploadCloud size={24} style={{ color: '#0284C7' }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                    Upload Physical LR / Bilty Receipt
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                    Supports PNG, JPG, or PDF (Images are auto-compressed for instant upload)
                  </div>
                </div>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '800',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(14,116,144,0.3)',
                    marginTop: '4px'
                  }}
                >
                  {uploading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                  {uploading ? 'Uploading LR Copy...' : 'Choose File to Upload'}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    disabled={uploading}
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                </label>
              </>
            )}
          </div>

          <div
            style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '11.5px',
              color: '#475569',
              lineHeight: '1.4',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}
          >
            <Info size={15} style={{ color: '#0E7490', flexShrink: 0, marginTop: '2px' }} />
            <div>
              Attaching this LR copy will finalize the order dispatch lifecycle, notify the sales department, and close the BOM.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              fontSize: '12.5px',
              fontWeight: '700',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAndComplete}
            disabled={saving || uploading}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: (saving || uploading) ? '#94A3B8' : '#0E7490',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: '800',
              cursor: (saving || uploading) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: (saving || uploading) ? 'none' : '0 2px 6px rgba(14,116,144,0.3)'
            }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
            {saving ? 'Saving...' : 'Confirm & Complete Dispatch'}
          </button>
        </div>
      </div>
    </div>
  );
}
