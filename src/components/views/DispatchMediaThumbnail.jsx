import React, { useState, useEffect } from 'react';
import { Camera, Eye, Loader2 } from 'lucide-react';
import { resolveDocumentUrl, resolveDocumentUrlAsync } from '../../utils/documentResolver';
import { getMediaFromCache, saveMediaToCache } from '../../utils/otherViewsShared';

export default function DispatchMediaThumbnail({
  photo,
  bomCode,
  onClick,
  label = 'View Photo',
  height = '84px',
  style = {}
}) {
  const isClean = (s) => typeof s === 'string' && s && !s.startsWith('blob:');

  const getDirectUrl = (p) => {
    if (!p) return '';
    if (typeof p === 'string') return isClean(p) ? p : '';
    if (isClean(p.url)) return p.url.startsWith('/uploads/') ? `/api${p.url}` : p.url;
    
    // Check synchronous document resolver
    const directResolved = resolveDocumentUrl(p);
    if (directResolved) return directResolved;

    // Check storagePath
    if (p.storagePath && typeof p.storagePath === 'string') {
      const cleanPath = p.storagePath.replace(/^\/+/, '').replace(/^bom-documents\//, '');
      return `/api/uploads/bom-documents/${cleanPath}`;
    }

    if (isClean(p.dataUrl)) return p.dataUrl;

    const cached = (p.name ? getMediaFromCache(p.name) : null) || (p.id ? getMediaFromCache(p.id) : null);
    if (cached) return cached;

    return '';
  };

  const initial = getDirectUrl(photo);
  const [src, setSrc] = useState(initial);
  const [loading, setLoading] = useState(!initial && Boolean(photo?.storageBucket || photo?.storagePath || photo?.name));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    const currentDirect = getDirectUrl(photo);
    if (currentDirect) {
      setSrc(currentDirect);
      setLoading(false);
      setHasError(false);
      return;
    }

    if (photo && (photo.storageBucket || photo.storagePath)) {
      setLoading(true);
      resolveDocumentUrlAsync(photo, bomCode)
        .then(u => {
          if (!active) return;
          if (u) {
            setSrc(u);
            setHasError(false);
            if (photo.name) saveMediaToCache(photo.name, u);
          } else {
            if (photo.name) {
              fetch(`/api/media/find/${encodeURIComponent(photo.name)}`)
                .then(r => r.json())
                .then(d => {
                  if (!active) return;
                  if (d?.found && d?.url) {
                    setSrc(d.url);
                    setHasError(false);
                    saveMediaToCache(photo.name, d.url);
                  } else {
                    setHasError(true);
                  }
                })
                .catch(() => { if (active) setHasError(true); });
            } else {
              setHasError(true);
            }
          }
        })
        .catch(() => {
          if (active && photo?.name) {
            fetch(`/api/media/find/${encodeURIComponent(photo.name)}`)
              .then(r => r.json())
              .then(d => {
                if (!active) return;
                if (d?.found && d?.url) {
                  setSrc(d.url);
                  setHasError(false);
                  saveMediaToCache(photo.name, d.url);
                } else {
                  setHasError(true);
                }
              })
              .catch(() => { if (active) setHasError(true); });
          } else if (active) {
            setHasError(true);
          }
        })
        .finally(() => { if (active) setLoading(false); });
    } else if (photo?.name) {
      setLoading(true);
      fetch(`/api/media/find/${encodeURIComponent(photo.name)}`)
        .then(r => r.json())
        .then(d => {
          if (!active) return;
          if (d?.found && d?.url) {
            setSrc(d.url);
            setHasError(false);
            saveMediaToCache(photo.name, d.url);
          } else {
            setHasError(true);
          }
        })
        .catch(() => { if (active) setHasError(true); })
        .finally(() => { if (active) setLoading(false); });
    }
    return () => { active = false; };
  }, [photo, bomCode]);

  const handleClick = async () => {
    let finalUrl = src || getDirectUrl(photo);
    if (!finalUrl && photo && (photo.storageBucket || photo.storagePath)) {
      finalUrl = await resolveDocumentUrlAsync(photo, bomCode);
    }
    if (onClick) onClick(finalUrl || '');
  };

  return (
    <div
      onClick={handleClick}
      style={{
        height,
        borderRadius: '10px',
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1.5px solid #CBD5E1',
        backgroundColor: '#0F172A',
        position: 'relative',
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
        transition: 'transform 0.15s ease',
        ...style
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {src && !hasError ? (
        <img
          src={src}
          alt={photo?.name || 'Dispatch Proof'}
          onError={(e) => {
            if (!e.currentTarget.dataset.retried && photo?.name) {
              e.currentTarget.dataset.retried = 'true';
              fetch(`/api/media/find/${encodeURIComponent(photo.name)}`)
                .then(r => r.json())
                .then(d => {
                  if (d?.found && d?.url) {
                    setSrc(d.url);
                    saveMediaToCache(photo.name, d.url);
                  } else {
                    setHasError(true);
                  }
                })
                .catch(() => setHasError(true));
            } else {
              setHasError(true);
            }
          }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : loading ? (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#38BDF8', gap: '4px' }}>
          <Loader2 className="animate-spin text-cyan-400" size={16} />
          <span style={{ fontSize: '10px', color: '#94A3B8' }}>Loading photo...</span>
        </div>
      ) : (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: '4px' }}>
          <Camera size={18} style={{ color: '#64748B' }} />
          <span style={{ fontSize: '9.5px', color: '#94A3B8', textAlign: 'center', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
            {photo?.name || 'Photo'}
          </span>
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(15,23,42,0.75)', color: '#FFFFFF',
        padding: '2px 6px', fontSize: '10px', fontWeight: '700',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span>📷 {label}</span>
        <span>›</span>
      </div>
    </div>
  );
}

