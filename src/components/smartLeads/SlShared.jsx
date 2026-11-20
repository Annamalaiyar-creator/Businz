import React, { useEffect, useState, useCallback } from 'react';
import { X, Inbox } from 'lucide-react';

export function StageBadge({ stage }) {
  return <span className={`sl-badge sl-stage-${String(stage || '').replace(/\s/g, '')}`}>{stage || '—'}</span>;
}

export function TempBadge({ temperature, score }) {
  if (!temperature) return <span className="sl-faint">—</span>;
  return (
    <span className={`sl-badge sl-temp-${temperature}`} title={`Score ${score ?? '—'} / 100`}>
      <span className="sl-dot" />{temperature}{score != null ? ` · ${score}` : ''}
    </span>
  );
}

export function Modal({ title, onClose, children, footer, small }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sl-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sl-modal ${small ? 'sl-modal-sm' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sl-modal-head">
          <h3>{title}</h3>
          <button className="sl-btn sl-btn-ghost sl-btn-sm" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="sl-modal-body">{children}</div>
        {footer && <div className="sl-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="sl-state">
      <Inbox size={28} color="#9CA3AF" />
      <h4>{title}</h4>
      {text && <p style={{ margin: 0, fontSize: 13 }}>{text}</p>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }) {
  return (
    <div style={{ padding: 16, display: 'grid', gap: 14 }}>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="sl-skel" style={{ width: `${90 - (i % 3) * 15}%` }} />)}
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);
  const show = useCallback((message, type = 'ok') => setToast({ message, type }), []);
  const node = toast ? <div className={`sl-toast ${toast.type === 'error' ? 'error' : ''}`} role="status">{toast.message}</div> : null;
  return [show, node];
}

// BUSINZ standard pagination footer: rows-per-page [5, 10], range text, page buttons + Go to page
export function Pager({ page, pageSize, total, onPage, onPageSize }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const [goto, setGoto] = useState('');
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const go = () => { const n = parseInt(goto, 10); if (n >= 1 && n <= pages) onPage(n); setGoto(''); };
  return (
    <div className="sl-pager">
      <div className="sl-pager-left">
        <span>Showing per page</span>
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Rows per page">
          <option value={5}>5</option>
          <option value={10}>10</option>
        </select>
        <span>Showing {from} to {to} of {total} entries</span>
      </div>
      <div className="sl-pager-right">
        <button className="sl-page-btn" disabled={page <= 1} onClick={() => onPage(1)} aria-label="First page">«</button>
        <button className="sl-page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">‹</button>
        {nums.map(n => <button key={n} className={`sl-page-btn ${n === page ? 'active' : ''}`} onClick={() => onPage(n)}>{n}</button>)}
        <button className="sl-page-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">›</button>
        <button className="sl-page-btn" disabled={page >= pages} onClick={() => onPage(pages)} aria-label="Last page">»</button>
        <span>Go to page</span>
        <input className="sl-goto" value={goto} onChange={(e) => setGoto(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && go()} aria-label="Go to page" />
        <button className="sl-page-btn" style={{ width: 'auto', padding: '0 10px' }} onClick={go}>Go ›</button>
      </div>
    </div>
  );
}
