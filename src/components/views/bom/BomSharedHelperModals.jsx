import React from 'react';
import {
  FileText, AlertCircle, X, CheckCircle, Clock, Download, Layers, Video, Image, Image as ImageIcon, FileSpreadsheet, Loader
} from 'lucide-react';
import { saveMediaToCache, getMediaFromCache } from '../../../utils/otherViewsShared';
import { resolveDocumentUrl, resolveDocumentUrlAsync } from '../../../utils/documentResolver';
import { VRMBomPrintSheet } from '../../VRMBomPrintTemplate';

export function BomDocPreviewModal({ ctx }) {
  const {
    previewDocModal,
    setPreviewDocModal,
    alert
  } = ctx;

    if (!previewDocModal) return null;
    const rawDoc = previewDocModal.doc;
    const docTitle = previewDocModal.title || 'Document Preview';
    const docName = typeof rawDoc === 'string' ? rawDoc : (rawDoc?.name || 'Uploaded File');

    let resolvedData = null;
    const isCleanStr = (s) => typeof s === 'string' && s && !s.startsWith('blob:');
    if (typeof rawDoc === 'string') {
      if (rawDoc.startsWith('blob:')) {
        resolvedData = null;
      } else if (rawDoc.startsWith('data:') || rawDoc.startsWith('http://') || rawDoc.startsWith('https://') || rawDoc.startsWith('/uploads/') || rawDoc.startsWith('/api/uploads/')) {
        resolvedData = rawDoc;
      } else {
        const cached = getMediaFromCache(rawDoc);
        resolvedData = cached || null;
      }
    } else if (rawDoc && typeof rawDoc === 'object') {
      const u = isCleanStr(rawDoc.url) ? rawDoc.url : null;
      const d = isCleanStr(rawDoc.dataUrl) ? rawDoc.dataUrl : null;
      const prevUrl = (isCleanStr(rawDoc.previewUrl) || (rawDoc._rawFile && rawDoc.previewUrl)) ? rawDoc.previewUrl : null;
      const f = isCleanStr(rawDoc.fileData) ? rawDoc.fileData : null;
      const p = isCleanStr(rawDoc.proofDocData) ? rawDoc.proofDocData : null;
      const c1 = rawDoc.name ? getMediaFromCache(rawDoc.name) : null;
      const c2 = rawDoc.id ? getMediaFromCache(rawDoc.id) : null;
      const cacheVal = c1 || c2 || null;
      const directResolved = rawDoc ? resolveDocumentUrl(rawDoc) : null;

      resolvedData = d || u || prevUrl || f || p || cacheVal || directResolved;
      if (resolvedData && typeof resolvedData === 'string' && resolvedData.startsWith('/uploads/')) {
        resolvedData = `/api${resolvedData}`;
      }
      if (!resolvedData && rawDoc._rawFile && (rawDoc._rawFile instanceof Blob || rawDoc._rawFile instanceof File)) {
        try {
          resolvedData = URL.createObjectURL(rawDoc._rawFile);
        } catch (e) { }
      }
      if (!resolvedData && (rawDoc instanceof Blob || rawDoc instanceof File)) {
        try {
          resolvedData = URL.createObjectURL(rawDoc);
        } catch (e) { }
      }
    }

    // Resolve private Supabase Storage documents via secure signed URLs
    if (!resolvedData && rawDoc && typeof rawDoc === 'object' && (rawDoc.storageBucket || rawDoc.storagePath) && !rawDoc._fetchingStorage) {
      if (typeof rawDoc === 'object') rawDoc._fetchingStorage = true;
      const bCode = previewDocModal.bomCode || rawDoc.bomCode || (rawDoc.storagePath ? rawDoc.storagePath.split('/')[0] : null);
      resolveDocumentUrlAsync(rawDoc, bCode)
        .then(url => {
          if (url) {
            const cleanUrl = url.startsWith('/uploads/') ? `/api${url}` : url;
            setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, url: cleanUrl, dataUrl: cleanUrl, _fetchingStorage: false } } : null);
          } else {
            if (typeof rawDoc === 'object') rawDoc._fetchingStorageDone = true;
            setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, _fetchingStorage: false, _fetchingStorageDone: true } } : null);
          }
        })
        .catch(() => {
          if (typeof rawDoc === 'object') rawDoc._fetchingStorageDone = true;
          setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, _fetchingStorage: false, _fetchingStorageDone: true } } : null);
        });
    }

    // Auto-fetch from server if not found in local memory/IndexedDB
    if (!resolvedData && docName && typeof window !== 'undefined') {
      const isMediaFile = /\.(mp4|webm|mov|mkv|avi|jpg|jpeg|png|webp|gif|pdf)($|\?)/i.test(docName);
      if (isMediaFile && !rawDoc?._fetchingServer && !rawDoc?._fetchingServerDone) {
        if (typeof rawDoc === 'object' && rawDoc) rawDoc._fetchingServer = true;
        fetch(`/api/media/find/${encodeURIComponent(docName)}`)
          .then(r => r.json())
          .then(data => {
            if (data?.found && data?.url) {
              const cleanUrl = data.url.startsWith('/uploads/') ? `/api${data.url}` : data.url;
              saveMediaToCache(docName, cleanUrl);
              setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, url: cleanUrl, dataUrl: cleanUrl, _fetchingServer: false } } : null);
            } else {
              const fallbackUrl = `/api/uploads/${encodeURIComponent(docName)}`;
              setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, url: fallbackUrl, dataUrl: fallbackUrl, _fetchingServer: false, _fetchingServerDone: true } } : null);
            }
          })
          .catch(() => {
            const fallbackUrl = `/api/uploads/${encodeURIComponent(docName)}`;
            setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, url: fallbackUrl, dataUrl: fallbackUrl, _fetchingServer: false, _fetchingServerDone: true } } : null);
          });
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
        onClick={() => setPreviewDocModal(null)}
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
                onClick={() => setPreviewDocModal(null)}
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '8px' }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '340px', backgroundColor: '#0F172A' }}>
            {(!resolvedData || previewDocModal?._loadFailed) ? (
              rawDoc?._fetchingServer && !rawDoc?._fetchingServerDone ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
                  <div style={{ width: '36px', height: '36px', border: '3px solid #0E7490', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 14px', animation: 'spin 0.8s linear infinite' }} />
                  <p style={{ fontSize: '14px', fontWeight: '800', margin: 0, color: '#F1F5F9' }}>Loading visual preview from server...</p>
                  <p style={{ fontSize: '12px', marginTop: '6px', color: '#94A3B8' }}>{docName}</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '36px 20px', color: '#94A3B8', maxWidth: '480px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '14px', backgroundColor: 'rgba(14,116,144,0.15)', color: '#38BDF8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    {isVid ? <Video size={28} /> : <FileText size={28} />}
                  </div>
                  <h4 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: '#F1F5F9' }}>Dispatch Packing Proof Attached</h4>
                  <p style={{ fontSize: '12px', marginTop: '8px', color: '#CBD5E1', lineHeight: '1.5' }}>
                    This {isVid ? 'video' : 'photo'} was registered by Dispatch Fulfillment Team during packing verification.
                  </p>
                  <div style={{ marginTop: '16px', padding: '10px 14px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '10px', fontSize: '11px', color: '#94A3B8', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div><strong style={{ color: '#E2E8F0' }}>File:</strong> {docName}</div>
                    {rawDoc?.size && <div><strong style={{ color: '#E2E8F0' }}>Size:</strong> {rawDoc.size}</div>}
                    {rawDoc?.uploadedAt && <div><strong style={{ color: '#E2E8F0' }}>Time:</strong> {rawDoc.uploadedAt}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      fetch(`/api/media/find/${encodeURIComponent(docName)}`)
                        .then(r => r.json())
                        .then(data => {
                          if (data?.found && data?.url) {
                            saveMediaToCache(docName, data.url);
                            setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, url: data.url, dataUrl: data.url } } : null);
                          } else {
                            alert(`File "${docName}" is attached to the BOM packing record. For visual playback, please ensure the dispatch device has synced with the server.`);
                          }
                        }).catch(() => {});
                    }}
                    style={{
                      marginTop: '16px', backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none',
                      padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: '800', cursor: 'pointer'
                    }}
                  >
                    Retry Server Lookup
                  </button>
                </div>
              )
            ) : isImg ? (
              <img
                src={resolvedData}
                alt={docName}
                onError={(e) => {
                  if (!e.currentTarget.dataset.retried && docName) {
                    e.currentTarget.dataset.retried = 'true';
                    fetch(`/api/media/find/${encodeURIComponent(docName)}`)
                      .then(r => r.json())
                      .then(data => {
                        if (data?.found && data?.url) {
                          const cleanUrl = data.url.startsWith('/uploads/') ? `/api${data.url}` : data.url;
                          saveMediaToCache(docName, cleanUrl);
                          setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, url: cleanUrl, dataUrl: cleanUrl }, _loadFailed: false } : null);
                        } else {
                          setPreviewDocModal(prev => prev ? { ...prev, _loadFailed: true } : null);
                        }
                      }).catch(() => {
                        setPreviewDocModal(prev => prev ? { ...prev, _loadFailed: true } : null);
                      });
                    return;
                  }
                  setPreviewDocModal(prev => prev ? { ...prev, _loadFailed: true } : null);
                }}
                style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.5)' }}
              />
            ) : isVid ? (
              <video
                controls
                autoPlay
                playsInline
                src={resolvedData}
                onError={(e) => {
                  if (!e.currentTarget.dataset.retried && docName) {
                    e.currentTarget.dataset.retried = 'true';
                    fetch(`/api/media/find/${encodeURIComponent(docName)}`)
                      .then(r => r.json())
                      .then(data => {
                        if (data?.found && data?.url) {
                          const cleanUrl = data.url.startsWith('/uploads/') ? `/api${data.url}` : data.url;
                          saveMediaToCache(docName, cleanUrl);
                          setPreviewDocModal(prev => prev ? { ...prev, doc: { ...prev.doc, url: cleanUrl, dataUrl: cleanUrl } } : null);
                        } else if (!e.currentTarget.src.includes('/api/uploads/')) {
                          e.currentTarget.src = `/api/uploads/${encodeURIComponent(docName)}`;
                        }
                      }).catch(() => {
                        if (!e.currentTarget.src.includes('/api/uploads/')) {
                          e.currentTarget.src = `/api/uploads/${encodeURIComponent(docName)}`;
                        }
                      });
                  }
                }}
                style={{ maxWidth: '100%', maxHeight: '68vh', borderRadius: '8px', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.5)' }}
              >
                Your browser does not support playing this video.
              </video>
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
              onClick={() => setPreviewDocModal(null)}
              style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', color: '#334155', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
}

export function BomValidationErrorModal({ ctx }) {
  const {
    validationErrorModal,
    setValidationErrorModal
  } = ctx;

    if (!validationErrorModal) return null;
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
        <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', width: '460px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', flexShrink: 0 }}>
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>Mandatory Fields Required</h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>Please complete all required fields to move forward.</p>
            </div>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>You did not fill out the following mandatory box(es):</span>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#DC2626', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(validationErrorModal.fields || []).map((field, idx) => (
                <li key={idx}><strong>{field}</strong></li>
              ))}
            </ul>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              onClick={() => {
                const targetId = validationErrorModal.firstTargetId;
                setValidationErrorModal(null);
                if (targetId) {
                  setTimeout(() => {
                    const el = document.getElementById(targetId);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.focus?.();
                    }
                  }, 100);
                }
              }}
              style={{ backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)' }}
            >
              OK, I'll fill it
            </button>
          </div>
        </div>
      </div>
    );
}

export function BomExportFormatModal({ ctx }) {
  const {
    exportFormatRecord,
    setExportFormatRecord,
    isExportingFormat,
    handleExportBomCsv,
    handleExportAsPdf,
    handleExportAsJpg
  } = ctx;

    if (!exportFormatRecord) return null;
    return (
      <>
        {/* EXPORT FORMAT SELECTOR MODAL (PDF / JPG / CSV) */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => !isExportingFormat && setExportFormatRecord(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden',
              border: '1px solid #E2E8F0'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(to right, #F8FAFC, #FFFFFF)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: '#ECFEFF',
                    border: '1px solid #CFFAFE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Download size={20} style={{ color: '#0E7490' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0F172A' }}>
                    Select Export Format
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                    {exportFormatRecord.bomCode || exportFormatRecord.code || 'BOM Order'} • Choose your required format
                  </p>
                </div>
              </div>
              <button
                disabled={Boolean(isExportingFormat)}
                onClick={() => setExportFormatRecord(null)}
                style={{
                  border: 'none',
                  backgroundColor: '#F1F5F9',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isExportingFormat ? 'not-allowed' : 'pointer',
                  color: '#64748B'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Format Options */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* PDF Option */}
              <div
                onClick={() => !isExportingFormat && handleExportAsPdf(exportFormatRecord)}
                style={{
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  cursor: isExportingFormat ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isExportingFormat === 'pdf' ? '#EFF6FF' : '#FFFFFF',
                  borderColor: isExportingFormat === 'pdf' ? '#3B82F6' : '#E2E8F0',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FEE2E2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <FileText size={24} style={{ color: '#DC2626' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>PDF Document</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#FEE2E2', color: '#B91C1C' }}>.pdf</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B', lineHeight: '1.4' }}>
                      Official printable A4 document with complete specifications, items, and authorized signature.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(isExportingFormat)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: isExportingFormat ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isExportingFormat === 'pdf' ? (
                    <>
                      <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    'Export PDF'
                  )}
                </button>
              </div>

              {/* JPG Option */}
              <div
                onClick={() => !isExportingFormat && handleExportAsJpg(exportFormatRecord)}
                style={{
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  cursor: isExportingFormat ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: isExportingFormat === 'jpg' ? '#EFF6FF' : '#FFFFFF',
                  borderColor: isExportingFormat === 'jpg' ? '#3B82F6' : '#E2E8F0',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      backgroundColor: '#EEF2FF',
                      border: '1px solid #E0E7FF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <ImageIcon size={24} style={{ color: '#4F46E5' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>JPG Image</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#E0E7FF', color: '#4338CA' }}>.jpg</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B', lineHeight: '1.4' }}>
                      High-resolution graphic image formatted for instant mobile viewing, WhatsApp, and chat.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(isExportingFormat)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: isExportingFormat ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isExportingFormat === 'jpg' ? (
                    <>
                      <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    'Export JPG'
                  )}
                </button>
              </div>

              {/* CSV Option */}
              <div
                onClick={() => {
                  if (isExportingFormat) return;
                  handleExportBomCsv(exportFormatRecord);
                  setExportFormatRecord(null);
                }}
                style={{
                  border: '1.5px solid #E2E8F0',
                  borderRadius: '14px',
                  padding: '16px 18px',
                  cursor: isExportingFormat ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#FFFFFF',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      backgroundColor: '#ECFDF5',
                      border: '1px solid #D1FAE5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <FileSpreadsheet size={24} style={{ color: '#059669' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>CSV Spreadsheet</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#D1FAE5', color: '#047857' }}>.csv</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B', lineHeight: '1.4' }}>
                      Structured tabular spreadsheet with item breakdown, GST, pricing, and customer metadata.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(isExportingFormat)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: isExportingFormat ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  Export CSV
                </button>
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #F1F5F9',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center'
              }}
            >
              <button
                type="button"
                disabled={Boolean(isExportingFormat)}
                onClick={() => setExportFormatRecord(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: isExportingFormat ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Hidden offscreen sheet for high-res PDF / JPG rasterization */}
        <div
          id="bom-export-hidden-target"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '880px',
            backgroundColor: '#FFFFFF',
            pointerEvents: 'none',
            zIndex: -9999
          }}
        >
          <VRMBomPrintSheet bomData={exportFormatRecord} id="export-sheet-hidden-canvas" />
        </div>
      </>
    );
}

export function BomSubmittingOverlay({ ctx }) {
  const {
    isSubmittingBom,
    bomSubmitStage,
    bomSubmitAssignedCode,
    bomConfirmModal
  } = ctx;

    if (!isSubmittingBom) return null;

    const isDraft = bomConfirmModal === 'draft';
    const currentStepIndex =
      bomSubmitStage === 'completed' ? 4 :
      bomSubmitStage === 'saving' ? 3 :
      bomSubmitStage === 'reserving' ? 2 : 1;

    const progressPct =
      bomSubmitStage === 'completed' ? 100 :
      bomSubmitStage === 'saving' ? 88 :
      bomSubmitStage === 'reserving' ? 60 : 25;

    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.78)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '20px'
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '36px 32px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Top Accent Animated Gradient Line */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '5px',
              background: 'linear-gradient(90deg, #0E7490, #06B6D4, #3B82F6, #10B981, #0E7490)',
              backgroundSize: '200% 100%',
              animation: 'shimmerSweep 2s linear infinite'
            }}
          />

          {/* 3D Isometric Animation Styles */}
          <style>{`
            @keyframes isoFloatBottom {
              0%, 100% { transform: translateY(0px) translateZ(0px); }
              50% { transform: translateY(-4px) translateZ(4px); }
            }
            @keyframes isoFloatMiddle {
              0%, 100% { transform: translateY(0px) translateZ(24px); }
              50% { transform: translateY(-7px) translateZ(32px); }
            }
            @keyframes isoFloatTop {
              0%, 100% { transform: translateY(0px) translateZ(48px); }
              50% { transform: translateY(-11px) translateZ(60px); }
            }
            @keyframes isoPulseRing {
              0% { transform: scale(0.65); opacity: 0.85; }
              100% { transform: scale(1.6); opacity: 0; }
            }
            @keyframes isoScanBeam {
              0% { transform: translateX(-100%) rotate(45deg); opacity: 0; }
              30% { opacity: 0.55; }
              70% { opacity: 0.55; }
              100% { transform: translateX(200%) rotate(45deg); opacity: 0; }
            }
          `}</style>

          {/* Smallcase-Inspired 3D Isometric Progress Indicator */}
          <div style={{
            perspective: '750px',
            perspectiveOrigin: '50% 35%',
            width: '160px',
            height: '135px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            marginBottom: '10px'
          }}>
            {/* Ground Shadow */}
            <div style={{
              position: 'absolute',
              bottom: '12px',
              width: '110px',
              height: '52px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(14, 116, 144, 0.35) 0%, rgba(6, 182, 212, 0.08) 55%, transparent 75%)',
              filter: 'blur(7px)',
              transform: 'rotateX(58deg)',
              animation: 'pulseGlow 2.5s ease-in-out infinite'
            }} />

            {/* 3D Isometric Stack Container */}
            <div style={{
              position: 'relative',
              width: '90px',
              height: '90px',
              transformStyle: 'preserve-3d',
              transform: 'rotateX(58deg) rotateZ(-38deg)'
            }}>
              {/* Base Layer Plate */}
              <div style={{
                position: 'absolute',
                width: '90px',
                height: '90px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.25) 0%, rgba(6, 182, 212, 0.1) 100%)',
                border: '1.5px solid rgba(14, 116, 144, 0.45)',
                boxShadow: '0 8px 24px rgba(14, 116, 144, 0.25), inset 0 0 14px rgba(6, 182, 212, 0.15)',
                backdropFilter: 'blur(4px)',
                transformStyle: 'preserve-3d',
                animation: 'isoFloatBottom 3s ease-in-out infinite'
              }}>
                <div style={{
                  position: 'absolute',
                  inset: '7px',
                  borderRadius: '12px',
                  border: '1px dashed rgba(14, 116, 144, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: '1.5px solid rgba(6, 182, 212, 0.6)',
                    animation: 'isoPulseRing 2s ease-out infinite'
                  }} />
                </div>
              </div>

              {/* Middle Floating Plate */}
              <div style={{
                position: 'absolute',
                top: '9px',
                left: '9px',
                width: '72px',
                height: '72px',
                borderRadius: '15px',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.38) 0%, rgba(59, 130, 246, 0.18) 100%)',
                border: '1.5px solid rgba(6, 182, 212, 0.65)',
                boxShadow: '0 10px 24px rgba(6, 182, 212, 0.28), inset 0 0 12px rgba(255, 255, 255, 0.25)',
                transformStyle: 'preserve-3d',
                animation: 'isoFloatMiddle 3s ease-in-out infinite',
                animationDelay: '0.2s',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent)',
                  animation: 'isoScanBeam 2.4s ease-in-out infinite'
                }} />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '7px',
                    border: '1.5px solid rgba(255,255,255,0.65)',
                    transform: 'rotate(45deg)'
                  }} />
                </div>
              </div>

              {/* Top Apex Plate with Glowing Symbol */}
              <div style={{
                position: 'absolute',
                top: '18px',
                left: '18px',
                width: '54px',
                height: '54px',
                borderRadius: '13px',
                background: bomSubmitStage === 'completed'
                  ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #0E7490 0%, #06B6D4 100%)',
                border: '2px solid #FFFFFF',
                boxShadow: '0 14px 30px rgba(14, 116, 144, 0.45), 0 0 18px rgba(6, 182, 212, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                transformStyle: 'preserve-3d',
                animation: 'isoFloatTop 3s ease-in-out infinite',
                animationDelay: '0.4s'
              }}>
                {bomSubmitStage === 'completed' ? (
                  <CheckCircle size={26} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }} />
                ) : (
                  <Layers size={22} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }} />
                )}
              </div>
            </div>
          </div>

          {/* Header Badge */}
          <div style={{
            fontSize: '11px',
            fontWeight: '800',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: '#0E7490',
            backgroundColor: '#ECFEFF',
            padding: '4px 12px',
            borderRadius: '20px',
            marginBottom: '10px'
          }}>
            {bomSubmitStage === 'completed' ? 'Success • Complete' : 'Processing BOM Order'}
          </div>

          {/* Title */}
          <h3 style={{
            fontSize: '20px',
            fontWeight: '800',
            color: '#0F172A',
            margin: '0 0 6px 0',
            letterSpacing: '-0.3px'
          }}>
            {bomSubmitStage === 'completed'
              ? 'BOM Created Successfully!'
              : (isDraft ? 'Saving Draft BOM...' : 'Creating Bill of Materials...')}
          </h3>

          {/* Description */}
          <p style={{
            fontSize: '13px',
            color: '#64748B',
            margin: '0 0 20px 0',
            lineHeight: '1.5',
            maxWidth: '360px'
          }}>
            {bomSubmitStage === 'completed'
              ? `Official BOM (${bomSubmitAssignedCode || 'Saved'}) registered and dispatched.`
              : 'Please wait while we assign sequential code, reserve inventory, and sync records.'}
          </p>

          {/* Real-time Checklist Cards */}
          <div
            style={{
              width: '100%',
              backgroundColor: '#F8FAFC',
              borderRadius: '14px',
              border: '1px solid #E2E8F0',
              padding: '14px 16px',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              textAlign: 'left'
            }}
          >
            {/* Step 1 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px' }}>
              {currentStepIndex === 1 ? (
                <Loader size={16} style={{ color: '#0E7490', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              ) : currentStepIndex > 1 ? (
                <CheckCircle size={16} style={{ color: '#10B981', flexShrink: 0 }} />
              ) : (
                <Clock size={16} style={{ color: '#94A3B8', flexShrink: 0 }} />
              )}
              <span style={{
                fontWeight: currentStepIndex === 1 ? '700' : '500',
                color: currentStepIndex === 1 ? '#0E7490' : (currentStepIndex > 1 ? '#0F172A' : '#64748B')
              }}>
                {bomSubmitAssignedCode ? `Sequential Code Assigned: ${bomSubmitAssignedCode}` : 'Assigning Sequential BOM Code...'}
              </span>
            </div>

            {/* Step 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px' }}>
              {currentStepIndex === 2 ? (
                <Loader size={16} style={{ color: '#0E7490', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              ) : currentStepIndex > 2 ? (
                <CheckCircle size={16} style={{ color: '#10B981', flexShrink: 0 }} />
              ) : (
                <Clock size={16} style={{ color: '#94A3B8', flexShrink: 0 }} />
              )}
              <span style={{
                fontWeight: currentStepIndex === 2 ? '700' : '500',
                color: currentStepIndex === 2 ? '#0E7490' : (currentStepIndex > 2 ? '#0F172A' : '#64748B')
              }}>
                Reserving Inventory Items & Raw Materials...
              </span>
            </div>

            {/* Step 3 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px' }}>
              {currentStepIndex === 3 ? (
                <Loader size={16} style={{ color: '#0E7490', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              ) : currentStepIndex > 3 ? (
                <CheckCircle size={16} style={{ color: '#10B981', flexShrink: 0 }} />
              ) : (
                <Clock size={16} style={{ color: '#94A3B8', flexShrink: 0 }} />
              )}
              <span style={{
                fontWeight: currentStepIndex === 3 ? '700' : '500',
                color: currentStepIndex === 3 ? '#0E7490' : (currentStepIndex > 3 ? '#0F172A' : '#64748B')
              }}>
                Syncing with Cloud Database & Dispatch System...
              </span>
            </div>
          </div>

          {/* Smooth Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#E2E8F0',
              borderRadius: '10px',
              overflow: 'hidden',
              position: 'relative',
              marginBottom: '16px'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPct}%`,
                backgroundColor: currentStepIndex >= 4 ? '#10B981' : '#0E7490',
                borderRadius: '10px',
                transition: 'width 0.4s ease-in-out, background-color 0.3s ease'
              }}
            />
          </div>

          {/* Warning Banner Against Multiple Clicks */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '11.5px',
              color: '#B45309',
              backgroundColor: '#FEF3C7',
              border: '1px solid #FDE68A',
              padding: '8px 14px',
              borderRadius: '10px',
              lineHeight: '1.4'
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0, color: '#D97706' }} />
            <span><strong>Please do not click again or refresh.</strong> Your order is being safely saved to prevent duplicates.</span>
          </div>
        </div>
      </div>
    );
}
