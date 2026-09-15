import React from "react";
import { Download, X, FileText } from "lucide-react";
import { getMediaFromCache } from "../../utils/otherViewsShared";

export default function DocPreviewModal({ previewDocModal, onClose }) {
  if (!previewDocModal) return null;
  const rawDoc = previewDocModal.doc;
  const docTitle = previewDocModal.title || 'Document Preview';
  const docName = typeof rawDoc === 'string' ? rawDoc : (rawDoc?.name || 'Uploaded File');

  let resolvedData = null;
  if (typeof rawDoc === 'string') {
    if (rawDoc.startsWith('data:') || rawDoc.startsWith('http://') || rawDoc.startsWith('https://') || rawDoc.startsWith('blob:') || rawDoc.startsWith('/uploads/') || rawDoc.startsWith('/api/uploads/')) {
      resolvedData = rawDoc;
    } else {
      resolvedData = getMediaFromCache(rawDoc);
    }
  } else if (rawDoc && typeof rawDoc === 'object') {
    resolvedData = rawDoc.url || rawDoc.dataUrl || rawDoc.fileData || rawDoc.proofDocData || (rawDoc.name ? getMediaFromCache(rawDoc.name) : null);
    if (!resolvedData && rawDoc.id) {
      resolvedData = getMediaFromCache(rawDoc.id);
    }
    if (!resolvedData && docName) {
      resolvedData = getMediaFromCache(docName);
    }
    if (!resolvedData && rawDoc instanceof Blob) {
      try {
        resolvedData = URL.createObjectURL(rawDoc);
      } catch (e) { }
    }
  }

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
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
              <FileText size={48} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
              <p style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: '#F1F5F9' }}>No visual preview available</p>
              <p style={{ fontSize: '12px', marginTop: '6px' }}>Attached file: {docName}</p>
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
  };
