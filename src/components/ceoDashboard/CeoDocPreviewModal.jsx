import React from 'react';
import { Download, FileText, X } from 'lucide-react';
import { resolveDocumentUrl } from '../../utils/documentResolver';
import { getMediaFromCache } from '../../utils/otherViewsShared';

export default function CeoDocPreviewModal({ previewDocModal, setPreviewDocModal }) {
  if (!previewDocModal) return null;

  const rawDoc = previewDocModal.doc;
  const docTitle = previewDocModal.title || 'Document Preview';
  const docName = typeof rawDoc === 'string' ? rawDoc : (rawDoc?.name || 'Uploaded File');

  let resolvedData = null;
  if (typeof rawDoc === 'string') {
    if (rawDoc.startsWith('data:') || rawDoc.startsWith('http://') || rawDoc.startsWith('https://') || rawDoc.startsWith('/uploads/') || rawDoc.startsWith('/api/uploads/')) {
      resolvedData = rawDoc;
    } else {
      resolvedData = getMediaFromCache(rawDoc) || null;
    }
  } else if (rawDoc && typeof rawDoc === 'object') {
    resolvedData = rawDoc.dataUrl || rawDoc.url || rawDoc.fileData || rawDoc.previewUrl || getMediaFromCache(rawDoc.name) || resolveDocumentUrl(rawDoc) || null;
  }
  if (resolvedData && typeof resolvedData === 'string' && resolvedData.startsWith('/uploads/')) {
    resolvedData = `/api${resolvedData}`;
  }

  const isPdf = /\.pdf($|\?)/i.test(docName) || (typeof resolvedData === 'string' && resolvedData.startsWith('data:application/pdf'));

  return (
    <div
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
      onClick={() => setPreviewDocModal(null)}
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
              type="button"
              onClick={() => setPreviewDocModal(null)}
              style={{
                border: 'none',
                background: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748B',
                backgroundColor: '#F1F5F9'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', minHeight: '350px' }}>
          {resolvedData ? (
            isPdf ? (
              <iframe
                src={resolvedData}
                title={docName}
                style={{ width: '100%', height: '70vh', border: 'none', borderRadius: '8px', backgroundColor: '#FFFFFF' }}
              />
            ) : (
              <img
                src={resolvedData}
                alt={docName}
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              />
            )
          ) : (
            <div style={{ textAlign: 'center', color: '#64748B' }}>
              <FileText size={40} style={{ opacity: 0.5, marginBottom: '8px' }} />
              <p style={{ margin: 0, fontWeight: '700' }}>Document preview unavailable or loading...</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px' }}>{docName}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
