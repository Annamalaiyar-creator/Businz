import React, { useState, useEffect } from "react";
import { Download, X, FileText, Upload } from "lucide-react";
import { getMediaFromCache, getMediaFromCacheAsync, saveMediaToCache } from "../../utils/otherViewsShared";
import { resolveDocumentUrlAsync } from "../../utils/documentResolver";

export default function DocPreviewModal({ previewDocModal, onClose }) {
  const rawDoc = previewDocModal?.doc;
  const docTitle = previewDocModal?.title || 'Document Preview';
  const docName = typeof rawDoc === 'string' ? rawDoc : (rawDoc?.name || 'Uploaded File');
  const bomCode = previewDocModal?.bomCode;

  // Synchronous initial check
  const getInitialData = () => {
    if (!previewDocModal) return null;
    if (typeof rawDoc === 'string') {
      if (rawDoc.startsWith('data:') || rawDoc.startsWith('http://') || rawDoc.startsWith('https://') || rawDoc.startsWith('blob:') || rawDoc.startsWith('/uploads/') || rawDoc.startsWith('/api/uploads/')) {
        return rawDoc;
      }
      return getMediaFromCache(rawDoc);
    } else if (rawDoc && typeof rawDoc === 'object') {
      const immediate = rawDoc.previewUrl || rawDoc.url || rawDoc.dataUrl || rawDoc.fileData || rawDoc.proofDocData || (rawDoc.name ? getMediaFromCache(rawDoc.name) : null);
      if (immediate) return immediate;
      if (rawDoc._rawFile && (rawDoc._rawFile instanceof Blob || rawDoc._rawFile instanceof File)) {
        try { return URL.createObjectURL(rawDoc._rawFile); } catch (_) { }
      }
      if (rawDoc.id) {
        const fromId = getMediaFromCache(rawDoc.id);
        if (fromId) return fromId;
      }
      if (docName) {
        const fromName = getMediaFromCache(docName);
        if (fromName) return fromName;
      }
      if (rawDoc instanceof Blob || rawDoc instanceof File) {
        try { return URL.createObjectURL(rawDoc); } catch (_) { }
      }
    }
    return null;
  };

  const [resolvedData, setResolvedData] = useState(getInitialData);

  // Asynchronous background resolution from IndexedDB, Cloud Storage, or Server
  useEffect(() => {
    if (!previewDocModal) return;
    let active = true;
    if (!resolvedData && docName) {
      // 1. Check IndexedDB cache asynchronously
      getMediaFromCacheAsync(docName).then((url) => {
        if (active && url) {
          setResolvedData(url);
          saveMediaToCache(docName, url);
        }
      });

      // 2. Check storage path via backend signed URL
      if (rawDoc && typeof rawDoc === 'object' && (rawDoc.storageBucket || rawDoc.storagePath)) {
        resolveDocumentUrlAsync(rawDoc, bomCode).then((url) => {
          if (active && url) {
            setResolvedData(url);
            saveMediaToCache(docName, url);
          }
        });
      }

      // 3. Check server media cache
      fetch(`/api/media/find/${encodeURIComponent(docName)}`)
        .then((r) => r.json())
        .then((data) => {
          if (active && data?.found && data?.url) {
            setResolvedData(data.url);
            saveMediaToCache(docName, data.url);
          }
        })
        .catch(() => {});
    }
    return () => { active = false; };
  }, [docName, rawDoc, resolvedData, bomCode, previewDocModal]);

  if (!previewDocModal) return null;

  const isImg = Boolean(
    resolvedData && (
      resolvedData.startsWith('data:image/') ||
      rawDoc?.type?.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|gif|bmp|svg)($|\?)/i.test(docName) ||
      /\.(jpg|jpeg|png|webp|gif|bmp|svg)($|\?)/i.test(resolvedData)
    )
  );

  const isVid = Boolean(
    (resolvedData && (
      resolvedData.startsWith('data:video/') ||
      rawDoc?.type?.startsWith('video/') ||
      /\.(mp4|webm|mov|mkv|avi)($|\?)/i.test(docName) ||
      /\.(mp4|webm|mov|mkv|avi)($|\?)/i.test(resolvedData)
    )) ||
    rawDoc?.type?.startsWith('video/') ||
    /\.(mp4|webm|mov|mkv|avi)($|\?)/i.test(docName)
  );

  return (
    <div
      onClick={() => onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15,23,42,0.75)',
        backdropFilter: 'blur(3px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          maxWidth: '850px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          border: '1px solid #E2E8F0'
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>{docTitle}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B', wordBreak: 'break-all' }}>{docName}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {resolvedData && (
              <a
                href={resolvedData}
                target="_blank"
                rel="noopener noreferrer"
                download={docName || 'document'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#0E7490',
                  backgroundColor: '#ECFEFF',
                  border: '1px solid #A5F3FC',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
              >
                <Download size={13} /> Open / Download
              </a>
            )}
            <button
              onClick={() => onClose()}
              style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '8px' }}
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '340px', backgroundColor: '#0F172A' }}>
          {!resolvedData ? (
            <div style={{
              backgroundColor: '#1E293B',
              borderRadius: '14px',
              padding: '28px 36px',
              textAlign: 'center',
              maxWidth: '480px',
              border: '1px solid #334155',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              color: '#F1F5F9'
            }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: '#FFFFFF' }}>
                <FileText size={30} />
              </div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '800', color: '#FFFFFF' }}>
                Official Document Record
              </h4>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#38BDF8', wordBreak: 'break-all' }}>
                {docName}
              </div>
              <div style={{ margin: '14px 0', padding: '10px 14px', backgroundColor: '#0F172A', borderRadius: '8px', border: '1px solid #334155', fontSize: '11.5px', color: '#94A3B8', textAlign: 'left', lineHeight: '1.5' }}>
                <div><strong>Document Status:</strong> <span style={{ color: '#4ADE80' }}>✓ Verified Order Attachment</span></div>
                <div><strong>Reference:</strong> {previewDocModal.bomCode || 'Order Confirmation'}</div>
                <div><strong>Size:</strong> {rawDoc?.size || 'Attached'}</div>
              </div>
              <label style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#0E7490',
                color: '#FFFFFF',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                marginTop: '6px'
              }}>
                <Upload size={14} /> Attach / Re-upload Image File
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files && e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (re) => {
                        const url = re.target?.result;
                        if (url) {
                          setResolvedData(url);
                          saveMediaToCache(docName, url);
                          if (file.name) saveMediaToCache(file.name, url);
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>
          ) : isImg ? (
            <img
              src={resolvedData}
              alt={docName}
              style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.5)' }}
            />
          ) : isVid ? (
            <video
              controls
              autoPlay
              src={resolvedData}
              style={{ maxWidth: '100%', maxHeight: '68vh', borderRadius: '8px', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.5)' }}
            />
          ) : (
            <iframe
              src={resolvedData}
              title={docName}
              style={{ width: '100%', height: '580px', border: 'none', borderRadius: '8px', backgroundColor: '#FFFFFF' }}
            />
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
          <span style={{ fontSize: '12px', color: '#64748B' }}>
            {rawDoc?.size ? `Size: ${rawDoc.size}` : ''}
          </span>
          <button
            onClick={() => onClose()}
            style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', color: '#334155', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
