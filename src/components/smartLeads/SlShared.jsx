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

/**
 * Signature BUSINZ KPI Grid layout container
 */
export function BusinzKpiGrid({ children, minWidth = '200px' }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}, 1fr))`,
      gap: '12px',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {children}
    </div>
  );
}

/**
 * Signature BUSINZ KPI Card Component
 * Matches the exact design language of CeoExecutiveDashboard and Sales Command Center
 */
export function BusinzKpiCard({
  title,
  value,
  valColor,
  icon: Icon,
  iconColor = '#0E7490',
  iconBg = '#ECFEFF',
  trend,
  trendUp,
  trendNeutral,
  bottomPrefix,
  bottomHighlight,
  bottomHighlightColor,
  onClick,
  isSelected,
  highlightCard
}) {
  const [hovered, setHovered] = useState(false);
  const isUp = trendUp;
  const isNeutral = trendNeutral;
  const trendBg = isUp ? '#ECFDF5' : (isNeutral ? '#F1F5F9' : '#FEF2F2');
  const trendBorder = isUp ? '1px solid #A7F3D0' : (isNeutral ? '1px solid #E2E8F0' : '1px solid #FECACA');
  const trendText = isUp ? '#059669' : (isNeutral ? '#475569' : '#DC2626');
  const resolvedBottomHighlightColor = bottomHighlightColor || (isUp ? '#059669' : (isNeutral ? '#0F172A' : '#0E7490'));

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        backgroundColor: isSelected ? '#F0FDFA' : (hovered && onClick ? '#F8FAFC' : '#FFFFFF'),
        borderRadius: '16px',
        border: isSelected
          ? '1.5px solid #0E7490'
          : (hovered && onClick ? '1.5px solid #0E7490' : (highlightCard ? '1.5px solid #FCA5A5' : '1px solid #E2E8F0')),
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: isSelected
          ? '0 0 0 1px #0E7490, 0 4px 18px rgba(14, 116, 144, 0.12)'
          : (highlightCard
              ? '0 4px 18px rgba(220, 38, 38, 0.08)'
              : '0 4px 18px rgba(15, 23, 42, 0.03)'),
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        minWidth: 0,
        boxSizing: 'border-box'
      }}
    >
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: '800',
            color: isSelected ? '#0E7490' : '#64748B',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {title}
        </span>
        {Icon && (
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              backgroundColor: isSelected ? '#CCFBF1' : iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Icon size={16} color={isSelected ? '#0E7490' : iconColor} />
          </div>
        )}
      </div>

      {/* Value & Trend Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '22px',
            fontWeight: '900',
            color: highlightCard ? '#DC2626' : (valColor || '#0F172A'),
            letterSpacing: '-0.5px',
            lineHeight: '1.1'
          }}
        >
          {value}
        </span>

        {trend !== undefined && trend !== null && trend !== '' && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '11px',
              fontWeight: '800',
              color: trendText,
              backgroundColor: trendBg,
              border: trendBorder,
              padding: '2px 7px',
              borderRadius: '6px',
              lineHeight: '1.2'
            }}
          >
            {trend}
          </span>
        )}
      </div>

      {/* Signature Bottom Sub-Card Box */}
      {(bottomPrefix || bottomHighlight) && (
        <div
          style={{
            backgroundColor: isSelected ? '#E6FFFA' : '#F8FAFC',
            border: isSelected ? '1px solid #99F6E4' : '1px solid #F1F5F9',
            borderRadius: '10px',
            padding: '6px 10px',
            fontSize: '11px',
            fontWeight: '500',
            color: '#64748B',
            lineHeight: '1.3',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 'auto'
          }}
        >
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span>{bottomPrefix}</span>
            {bottomHighlight && (
              <span style={{ color: resolvedBottomHighlightColor, fontWeight: '800', marginLeft: '3px' }}>
                {bottomHighlight}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
