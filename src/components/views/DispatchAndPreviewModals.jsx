import React from "react";
import {
  Check, X, FileText, Download, CheckCircle, CheckSquare, Printer, Receipt, FileCheck, AlertTriangle, XCircle
} from "lucide-react";
import { getMediaFromCache } from "../../utils/otherViewsShared";

      export function CompletedBomSummaryModal({ completedBomSummaryModal, onClose }) {
  return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100001, fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', border: '1px solid #E2E8F0', width: '620px', maxWidth: '95%', padding: '32px', boxShadow: '0 30px 60px -15px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: '22px', textAlign: 'center' }}>

            <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 8px 20px rgba(22,101,52,0.2)' }}>
              <CheckCircle size={40} />
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: '900', color: '#16A34A', textTransform: 'uppercase', letterSpacing: '1px' }}>
                🎉 BOM FULFILLMENT 100% COMPLETE
              </span>
              <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#0F172A', margin: '4px 0 0 0' }}>
                Order & BOM Flow Successfully Completed!
              </h2>
              <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0' }}>
                BOM Reference: <strong style={{ color: '#2563EB' }}>{completedBomSummaryModal.bomCode}</strong> • Sales Creator: <strong style={{ color: '#0E7490' }}>👤 {(completedBomSummaryModal.salesPerson || localStorage.getItem('controlroom_logged_user_name') || 'Mohith JV').replace(/\s*\([^)]*\)/g, '').trim()}</strong> • Customer: <strong>{completedBomSummaryModal.customer}</strong>
              </p>
            </div>

            {/* Lifecycle Stages Passed */}
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#334155', textTransform: 'uppercase' }}>Completed Journey Stages</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534' }}>
                  <CheckCircle size={15} /> 1. Sales BOM Created & Address Proof Attached
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534' }}>
                  <CheckCircle size={15} /> 2. Dispatch Items Packed & Verified ({completedBomSummaryModal.packedCount} items)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534' }}>
                  <CheckCircle size={15} /> 3. Accounts Verification & Payment Slip Approved
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534' }}>
                  <CheckCircle size={15} /> 4. Tax Invoice Confirmed & Inventory Stock Decremented
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534' }}>
                  <CheckCircle size={15} /> 5. Vehicle Loading Verified with Photos & Videos ({completedBomSummaryModal.vehicleLoading?.vehicleNo})
                </div>
              </div>
            </div>

            {/* Media Storage & Location Info Panel */}
            <div style={{ backgroundColor: '#F1F5F9', borderRadius: '14px', border: '1px solid #CBD5E1', padding: '14px 18px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase' }}>
                  📁 Media Storage & Audit Information
                </div>
                <span style={{ fontSize: '10px', color: '#166534', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '8px', fontWeight: '800' }}>
                  Synced & Quota-Protected
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                • <strong>Storage Target:</strong> LocalStorage + Cache API (<code style={{ color: '#0E7490', backgroundColor: '#E0F2FE', padding: '1px 4px', borderRadius: '4px' }}>controlroom_media_cache</code>)<br />
                • <strong>Loading Photos:</strong> {completedBomSummaryModal.vehicleLoading?.photos?.length || 0} files captured<br />
                • <strong>Loading Videos:</strong> {completedBomSummaryModal.vehicleLoading?.videos?.length || 0} files captured<br />
                • <strong>Timestamp:</strong> {completedBomSummaryModal.vehicleLoading?.loadedTimeStr || new Date().toLocaleString()}
              </div>
            </div>

            {/* Customer Sharing Actions (WhatsApp / Email) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#475569' }}>
                Send Dispatch Details, Photos & Videos to Customer:
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    const cust = completedBomSummaryModal.customer || 'Valued Customer';
                    const bNum = completedBomSummaryModal.bomCode || 'BOM';
                    const inv = completedBomSummaryModal.invoiceNo || 'INV';
                    const vNum = completedBomSummaryModal.vehicleLoading?.vehicleNo || 'TN-09-CB-4821';
                    const drv = completedBomSummaryModal.vehicleLoading?.driverName || 'Driver';
                    const dPhone = completedBomSummaryModal.vehicleLoading?.driverPhone || '';
                    const lr = completedBomSummaryModal.vehicleLoading?.lrNo || 'LR-881204';
                    const phCount = completedBomSummaryModal.vehicleLoading?.photos?.length || 0;
                    const vdCount = completedBomSummaryModal.vehicleLoading?.videos?.length || 0;

                    const msg = `📦 *DISPATCH NOTIFICATION - CONTROL ROOM*\n\nDear ${cust},\nYour order has been fully packed, inspected, and loaded into the delivery vehicle.\n\n• *BOM Reference:* ${bNum}\n• *Invoice No:* ${inv}\n• *Vehicle Number:* ${vNum}\n• *Driver:* ${drv} (${dPhone})\n• *LR Number:* ${lr}\n• *Loading Media:* ${phCount} Photo(s), ${vdCount} Video(s) verified on dock.\n\nThank you for choosing us!`;
                    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
                    window.open(waUrl, '_blank');
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(22,163,74,0.3)'
                  }}
                >
                  <span>💬 Send to Customer via WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cust = completedBomSummaryModal.customer || 'Valued Customer';
                    const bNum = completedBomSummaryModal.bomCode || 'BOM';
                    const inv = completedBomSummaryModal.invoiceNo || 'INV';
                    const vNum = completedBomSummaryModal.vehicleLoading?.vehicleNo || 'TN-09-CB-4821';
                    const drv = completedBomSummaryModal.vehicleLoading?.driverName || 'Driver';
                    const lr = completedBomSummaryModal.vehicleLoading?.lrNo || 'LR-881204';
                    const phCount = completedBomSummaryModal.vehicleLoading?.photos?.length || 0;
                    const vdCount = completedBomSummaryModal.vehicleLoading?.videos?.length || 0;

                    const subject = `Dispatch & Loading Confirmation: ${bNum} (${inv})`;
                    const body = `Dear ${cust},\n\nWe are pleased to inform you that your shipment is dispatched.\n\nOrder Details:\n• BOM Number: ${bNum}\n• Tax Invoice: ${inv}\n• Vehicle Registration: ${vNum}\n• Driver Name: ${drv}\n• LR Consignment Number: ${lr}\n• Verification Media: ${phCount} loading photos and ${vdCount} videos captured.\n\nBest Regards,\nLogistics & Dispatch Operations Team`;
                    const mailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
                    window.location.href = mailUrl;
                  }}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#1E293B',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>✉️ Send via Email</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => onClose()}
                style={{ padding: '12px 32px', borderRadius: '12px', border: 'none', backgroundColor: '#0F172A', color: '#FFFFFF', fontSize: '14px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,23,42,0.25)' }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
}

export function ActiveMediaPreviewModal({ activeMediaPreviewModal, onClose }) {
  if (!activeMediaPreviewModal) return null;
  const rawUrl = activeMediaPreviewModal.url || getMediaFromCache(activeMediaPreviewModal.name) || getMediaFromCache(activeMediaPreviewModal.id);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100005 }}>
      <div style={{ maxWidth: '90%', maxHeight: '90%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: '700' }}>{activeMediaPreviewModal.name || 'Media Preview'}</span>
          <button
            type="button"
            onClick={() => onClose()}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: '#FFFFFF', padding: '6px 14px', cursor: 'pointer', fontWeight: '700' }}
          >
            Close ✕
          </button>
        </div>
        {activeMediaPreviewModal.type === 'video' ? (
          <video controls autoPlay playsInline src={rawUrl} style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '12px' }}>
            Your browser does not support playing this video.
          </video>
        ) : (
          <img src={rawUrl} alt="Full Preview" style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '12px' }} />
        )}
      </div>
    </div>
  );
}

      export function PreviewAddressProofModal({ previewAddressProofModal, onClose }) {
  return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100000, fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', width: '900px', maxWidth: '95vw', maxHeight: '94vh', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#DCFCE7', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileCheck size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Delivery Address Proof Attachment</h3>
                  <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <span>Uploaded by: <strong style={{ color: '#0F172A' }}>{(previewAddressProofModal.uploadedBy || localStorage.getItem('controlroom_logged_user_name') || 'Mohith JV').replace(/\s*\([^)]*\)/g, '').trim()}</strong></span>
                    <span>•</span>
                    <span>BOM: <strong style={{ color: '#2563EB' }}>{previewAddressProofModal.bomRef || 'BOM Reference'}</strong></span>
                    <span>•</span>
                    <span>File: <strong style={{ color: '#475569' }}>{previewAddressProofModal.name || 'Document.png'}</strong> ({previewAddressProofModal.size || 'Image'})</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onClose()}
                style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: 'white', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body - 100% Focused on the Image */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, backgroundColor: '#0B0F19', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              {previewAddressProofModal.dataUrl ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                  <img
                    src={previewAddressProofModal.dataUrl}
                    alt="Delivery Address Proof"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '74vh',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.5)'
                    }}
                  />
                </div>
              ) : (
                <div style={{ color: '#94A3B8', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <FileText size={48} style={{ color: '#64748B' }} />
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#F1F5F9' }}>{previewAddressProofModal.name || 'Attachment Document'}</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>Uploaded by {(previewAddressProofModal.uploadedBy || localStorage.getItem('controlroom_logged_user_name') || 'Mohith JV').replace(/\s*\([^)]*\)/g, '').trim()} • {previewAddressProofModal.size || '0.13 MB'}</div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#166534', backgroundColor: '#DCFCE7', padding: '4px 10px', borderRadius: '20px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <CheckCircle size={14} /> Official Address Proof
                </span>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Uploaded by <strong>{(previewAddressProofModal.uploadedBy || localStorage.getItem('controlroom_logged_user_name') || 'Mohith JV').replace(/\s*\([^)]*\)/g, '').trim()}</strong>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (previewAddressProofModal.dataUrl) {
                      const a = document.createElement('a');
                      a.href = previewAddressProofModal.dataUrl;
                      a.download = previewAddressProofModal.name || 'Address_Proof.png';
                      a.click();
                    } else {
                      alert(`Downloading ${previewAddressProofModal.name || 'Document'}...`);
                    }
                  }}
                  style={{ padding: '9px 18px', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Download size={15} /> Download Image
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (previewAddressProofModal?.dataUrl) {
                      const win = window.open();
                      if (win) {
                        win.document.write(`<html style="background:#0B0F19;margin:0;height:100%;display:flex;justify-content:center;align-items:center;"><head><title>Address Proof — ${previewAddressProofModal.name || "Document"}</title></head><body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;"><img src="${previewAddressProofModal.dataUrl}" style="max-width:96vw;max-height:96vh;object-fit:contain;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.6);"/></body></html>`);
                      }
                    }
                  }}
                  style={{ padding: '9px 18px', borderRadius: '10px', border: '1px solid #4F46E5', backgroundColor: '#EEF2FF', color: '#4F46E5', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                >
                  Open in New Window ↗
                </button>
                <button
                  type="button"
                  onClick={() => onClose()}
                  style={{ padding: '9px 22px', borderRadius: '10px', border: 'none', backgroundColor: '#2563EB', color: 'white', fontSize: '12px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 6px rgba(37,99,235,0.25)' }}
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        </div>
      );
}

      export function DispatchChecklistPreviewModal({ dispatchChecklistPreviewModal, onClose }) {
  return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100003, fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', width: '740px', maxWidth: '95vw', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #E2E8F0', background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)', color: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#059669', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(5,150,105,0.35)' }}>
                  <CheckSquare size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#FFFFFF', margin: 0 }}>
                      Dispatch Goods Packing Checklist
                    </h3>
                    <span style={{ backgroundColor: '#10B981', color: '#FFFFFF', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
                      {dispatchChecklistPreviewModal.packedCount} / {dispatchChecklistPreviewModal.allCount} Packed
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                    BOM Order: <strong style={{ color: '#38BDF8' }}>{dispatchChecklistPreviewModal.bomCode}</strong> • Customer: <strong style={{ color: '#FFFFFF' }}>{dispatchChecklistPreviewModal.customerName}</strong> • Verified by: <strong style={{ color: '#A7F3D0' }}>{dispatchChecklistPreviewModal.packedBy}</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onClose()}
                style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'transparent', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Checklist Table */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '12px', textAlign: 'center', width: '70px' }}>Packed</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Product Code</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Description & Spec</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>BOM Qty</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(dispatchChecklistPreviewModal.packedItems || []).map((item, idx) => {
                    const isPacked = item.packed !== false;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: isPacked ? '#F0FDF4' : '#FFF7ED' }}>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{
                            width: '22px', height: '22px', borderRadius: '6px', margin: '0 auto',
                            backgroundColor: isPacked ? '#166534' : '#FED7AA',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF'
                          }}>
                            {isPacked ? <Check size={14} /> : <span style={{ fontSize: '11px', color: '#C2410C', fontWeight: '800' }}>✕</span>}
                          </div>
                        </td>
                        <td style={{ padding: '12px', fontWeight: '800', color: '#2563EB' }}>
                          {item.code || `PRD-00${idx + 1}`}
                        </td>
                        <td style={{ padding: '12px', fontWeight: '700', color: isPacked ? '#166534' : '#1E293B' }}>
                          {item.name || item.description || 'Hardware / Mounting Component'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', fontWeight: '800', color: '#475569' }}>
                          {item.bomQty || item.qty || 1} <span style={{ fontSize: '11px', color: '#94A3B8' }}>Nos</span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '800',
                            backgroundColor: isPacked ? '#DCFCE7' : '#FFEDD5',
                            color: isPacked ? '#166534' : '#C2410C',
                            border: `1px solid ${isPacked ? '#BBF7D0' : '#FDBA74'}`
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isPacked ? '#22C55E' : '#EA580C' }} />
                            {isPacked ? 'Verified & Packed' : 'Pending Packing'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <span style={{ fontSize: '12px', color: '#64748B' }}>
                Physical warehouse inspection verified by <strong>{dispatchChecklistPreviewModal.packedBy}</strong>
              </span>
              <button
                type="button"
                onClick={() => onClose()}
                style={{ padding: '9px 24px', borderRadius: '10px', border: 'none', backgroundColor: '#0F172A', color: '#FFFFFF', fontSize: '12.5px', fontWeight: '800', cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      );
}

      export function ViewingProofDocModal({ viewingProofDocModal, onClose, bomStore = [] }) {
  return (() => {
        const bRef = viewingProofDocModal.bomCode || viewingProofDocModal.code || viewingProofDocModal.poNo;
        const matchedBom = bomStore.find(b => b.bomCode === bRef || b.code === bRef || (b.salesOrderNo && b.salesOrderNo === bRef));
        const rawProof = viewingProofDocModal.paymentProofDoc || matchedBom?.paymentProofDoc || viewingProofDocModal.payments?.proofDocObj || viewingProofDocModal.payments?.proofDoc || viewingProofDocModal.proofDoc || viewingProofDocModal.salesPoDetails?.proofDocObj;
        const docName = typeof rawProof === 'string' ? rawProof : rawProof?.name || viewingProofDocModal.paymentProofDocName || 'Payment_Proof_Receipt.jpg';
        const salesPaymentProof = viewingProofDocModal.paymentProofDoc || matchedBom?.paymentProofDoc || viewingProofDocModal.payments?.proofDocObj || viewingProofDocModal.salesPoDetails?.proofDocObj;
        let pDocDataUrl = (typeof salesPaymentProof === 'string' && salesPaymentProof.startsWith('data:'))
          ? salesPaymentProof
          : (salesPaymentProof?.dataUrl || salesPaymentProof?.fileData || salesPaymentProof?.url || (typeof rawProof === 'string' && rawProof.startsWith('data:') ? rawProof : null) || rawProof?.dataUrl || rawProof?.fileData || rawProof?.url);
        if (!pDocDataUrl && docName) {
          pDocDataUrl = getMediaFromCache(docName);
        }
        const bCode = viewingProofDocModal.bomCode || viewingProofDocModal.code || viewingProofDocModal.poNo || 'BOM-2026';
        const cName = viewingProofDocModal.customerName || viewingProofDocModal.companyName || viewingProofDocModal.vendor || 'Customer';
        const amtVal = parseFloat(viewingProofDocModal.grandTotal || viewingProofDocModal.invAmt || 0);
        const pType = viewingProofDocModal.paymentType || '100% Advance';

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100000,
            padding: '20px',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              maxWidth: '680px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '92vh'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '18px 24px',
                borderBottom: '1px solid #F1F5F9',
                background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)',
                color: '#FFFFFF',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
                  }}>
                    <Receipt style={{ width: '20px', height: '20px', color: '#FFFFFF' }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: '900', margin: 0, color: '#FFFFFF' }}>
                      Recorded Payment Proof Document
                    </h2>
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0 0' }}>
                      {docName} • {bCode} • {cName}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => window.print()}
                    title="Print Receipt"
                    style={{
                      background: 'rgba(255,255,255,0.12)', border: 'none',
                      color: '#FFFFFF', width: '34px', height: '34px', borderRadius: '8px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <Printer style={{ width: '16px', height: '16px' }} />
                  </button>
                  <button
                    onClick={() => onClose()}
                    style={{
                      background: 'rgba(255,255,255,0.12)', border: 'none',
                      color: '#FFFFFF', width: '34px', height: '34px', borderRadius: '8px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <X style={{ width: '18px', height: '18px' }} />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: '#F8FAFC' }}>
                {pDocDataUrl ? (
                  <div style={{
                    borderRadius: '14px', overflow: 'hidden', border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF', padding: '16px', textAlign: 'center',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
                  }}>
                    <img
                      src={pDocDataUrl}
                      alt="Payment Proof Attachment"
                      style={{ maxWidth: '100%', maxHeight: '520px', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>{docName}</span>
                  </div>
                ) : (
                  <div style={{
                    borderRadius: '14px', border: '1.5px dashed #CBD5E1',
                    backgroundColor: '#FFFFFF', padding: '40px 20px', textAlign: 'center',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
                  }}>
                    <FileText style={{ width: '44px', height: '44px', color: '#94A3B8' }} />
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#334155' }}>No File Attachment Found</div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>Document name recorded: {docName}</div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '16px 24px',
                backgroundColor: '#FFFFFF',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Digitally verified payment transaction proof
                </span>
                <button
                  onClick={() => onClose()}
                  style={{
                    border: 'none',
                    backgroundColor: '#0F172A',
                    color: '#FFFFFF',
                    height: '38px',
                    padding: '0 22px',
                    borderRadius: '9px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        );
      })();
}

export function BomCancelPromptModal({
  bomCancelPromptModal,
  onClose,
  onConfirmCancel
}) {
  const [cancellationReasonInput, setCancellationReasonInput] = React.useState('');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100000, padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '540px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        border: '1px solid #E2E8F0',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#FFFFFF'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <AlertTriangle style={{ width: '22px', height: '22px', color: '#FFFFFF' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>
                Cancel BOM & Restore Stock
              </h3>
              <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                BOM: <strong>{bomCancelPromptModal.bomCode || bomCancelPromptModal.code}</strong> • Customer: {bomCancelPromptModal.customerName || bomCancelPromptModal.clientName || 'Customer'}
              </div>
            </div>
          </div>
          <button
            onClick={() => onClose()}
            style={{
              background: 'none', border: 'none', color: '#FFFFFF',
              cursor: 'pointer', padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '12px',
            color: '#991B1B',
            lineHeight: 1.5
          }}>
            <strong>⚠️ Why are you cancelling this BOM?</strong>
            <br />
            The Sales Person (<strong>{(bomCancelPromptModal.salesPerson || localStorage.getItem('controlroom_logged_user_name') || 'Sales Executive').replace(/\s*\([^)]*\)/g, '').trim()}</strong>) who raised this order will be immediately notified with your reason, and reserved stock will be returned to raw inventory.
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Quick Select Reason
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[
                'Customer requested order cancellation',
                'Specification / Drawing changed by client',
                'Payment term non-compliance',
                'Wrong profile / cut length selected in BOM',
                'Duplicate BOM entry created',
                'Material grade / thickness unavailable'
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCancellationReasonInput(preset)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: cancellationReasonInput === preset ? '1.5px solid #DC2626' : '1px solid #CBD5E1',
                    backgroundColor: cancellationReasonInput === preset ? '#FEF2F2' : '#F8FAFC',
                    color: cancellationReasonInput === preset ? '#DC2626' : '#475569',
                    fontSize: '11px',
                    fontWeight: cancellationReasonInput === preset ? '700' : '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Cancellation Reason <span style={{ color: '#DC2626' }}>* (Required)</span>
            </label>
            <textarea
              value={cancellationReasonInput}
              onChange={(e) => setCancellationReasonInput(e.target.value)}
              placeholder="Explain why this BOM is being cancelled (e.g. Customer cancelled the project, drawing mismatch...)"
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                fontSize: '13px',
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: '1.5'
              }}
              onFocus={(e) => e.target.style.borderColor = '#DC2626'}
              onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          backgroundColor: '#F8FAFC',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            type="button"
            onClick={() => onClose()}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Keep BOM Active
          </button>
          <button
            type="button"
            onClick={() => {
              if (!cancellationReasonInput.trim()) {
                alert('Please enter or select a reason for cancelling this BOM.');
                return;
              }
              onConfirmCancel(bomCancelPromptModal, cancellationReasonInput.trim());
            }}
            disabled={!cancellationReasonInput.trim()}
            style={{
              padding: '9px 22px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: cancellationReasonInput.trim() ? '#DC2626' : '#FCA5A5',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: '800',
              cursor: cancellationReasonInput.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: cancellationReasonInput.trim() ? '0 4px 12px rgba(220, 38, 38, 0.3)' : 'none'
            }}
          >
            <XCircle size={15} /> Confirm & Cancel BOM
          </button>
        </div>
      </div>
    </div>
  );
}
