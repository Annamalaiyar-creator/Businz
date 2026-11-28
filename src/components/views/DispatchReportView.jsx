import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Filter, RefreshCw, Search, X, ChevronLeft, ChevronRight, Truck, PackageOpen } from 'lucide-react';
import { fetchCloudStore } from '../../utils/supabaseDataSync';
import CeoKpiGrid from '../ceoDashboard/CeoKpiGrid';
import { getItems } from '../../services/businzDataService';
import { centralInventoryStore } from '../../utils/centralInventoryStore';
import { syncPresetsWithCloud, getAllActivePresets } from '../../vrmHdgProposalPresets';
import { calculateTotalDispatchQty } from '../../utils/vrmProductsData';

// Dispatch Report (Dispatch login): BOMs received / cancelled / invoiced / dispatched for a day, month or custom range,
// plus product-wise quantities that actually went out (items and preset kits).

const pad = (n) => String(n).padStart(2, '0');
// Local calendar day key YYYY-MM-DD
const dayKey = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const todayKey = () => dayKey(new Date());
const fmtDay = (key) => {
  if (!key) return '—';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const isCancelledBom = (b) => Boolean(b.cancelled || /cancel/i.test(String(b.status || '')));
const isDispatchedBom = (b) => !isCancelledBom(b) && /complet|dispatched|delivered|closed/i.test(String(b.status || '')) && !/sent to dispatch/i.test(String(b.status || ''));
const isSentToDispatch = (b) => Boolean(
  b.salesConfirmed || b.salesReconfirmed || b.salesConfirmedAt ||
  /sent to dispatch|packed|accounts|invoice|loading|dispatched|complet/i.test(String(b.status || ''))
) && !/^(draft|pending confirmation)$/i.test(String(b.status || '').trim());

// Event dates used by the report
// First time the BOM reached Dispatch: the earlier valid one of the two "sent" timestamps
const receivedDate = (b) => {
  const valid = [b.salesConfirmedAt, b.reconfirmedAt].filter(v => v && typeof v !== 'object' && !Number.isNaN(new Date(v).getTime()));
  return valid.sort((x, y) => new Date(x) - new Date(y))[0] || '';
};
const cancelledDate = (b) => b.cancelledAt || b.updatedAt || '';
const invoicedDate = (b) => b.invoiceConfirmedAt || b.updatedAt || '';
const dispatchedDate = (b) => b.vehicleLoading?.loadedAt || b.dispatchedAt || b.completedAt || b.updatedAt || '';

// Total ordered qty of a BOM line: kit items are stored per set, so use the same rule as Dispatch packing
const orderedQtyOf = (b, it) => {
  if (!it.presetGroupId) return num(it.qty);
  const groups = Array.isArray(b.presetGroups) ? b.presetGroups : Object.values(b.presetGroups || {});
  const g = groups.find(x => (x?.groupId || x?.id) === it.presetGroupId) || {};
  return num(calculateTotalDispatchQty(it, num(g.setCount ?? g.sets ?? 1) || 1, g.presetName || it.presetName || '', g.category || '', g.unitType || g.unit || ''));
};
// Quantities that actually left: packed quantities when packing exists, otherwise the BOM quantity
const goneOutItems = (b) => {
  const packing = Array.isArray(b.dispatchPacking) && b.dispatchPacking.length > 0 ? b.dispatchPacking : null;
  if (packing) {
    return packing.map(it => ({
      name: it.name || it.itemName || it.code || 'Item',
      uom: it.uom || it.unit || 'NOS',
      qty: it.packedQty !== undefined && it.packedQty !== null && it.packedQty !== ''
        ? num(it.packedQty)
        : (it.packed ? num(it.qty || it.bomQty) : 0)
    }));
  }
  return (Array.isArray(b.items) ? b.items : []).map(it => ({ name: it.name || it.code || 'Item', uom: it.uom || it.unit || 'NOS', qty: orderedQtyOf(b, it) }));
};
const kitsOf = (b) => {
  const groups = Array.isArray(b.presetGroups) ? b.presetGroups : Object.values(b.presetGroups || {});
  return groups.filter(Boolean).map(g => ({
    name: g.presetName || g.name || 'Preset Kit',
    unit: String(g.unitType || g.unit || '').toLowerCase() === 'kw' ? 'kW' : 'Sets',
    qty: num(g.setCount ?? g.sets ?? 1) || 1
  }));
};

// ---------- BUSINZ design system pieces (same look as the CEO dashboards) ----------
const BusinzSectionCard = ({ title, rightNode, children }) => (
  <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #EAEFEF', borderRadius: '16px', overflow: 'visible', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', padding: '12px 18px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #EAEFEF', borderRadius: '16px 16px 0 0' }}>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.2px' }}>{title}</h3>
      {rightNode}
    </div>
    <div style={{ padding: '14px' }}>{children}</div>
  </div>
);

const tableWrap = { backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '12px', overflowX: 'auto' };
const theadRow = { backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' };
const th = { textAlign: 'left', padding: '10px 14px', whiteSpace: 'nowrap' };
const td = { padding: '10px 14px', borderBottom: '1px solid #F1F5F9', color: '#0F172A', fontSize: '12.5px' };
const pill = (active) => ({
  padding: '5px 12px', borderRadius: '999px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
  border: active ? '1px solid #0E7490' : '1px solid #E2E8F0', backgroundColor: active ? '#ECFEFF' : '#FFFFFF', color: active ? '#0E7490' : '#475569'
});
const ctrl = { height: '32px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', padding: '0 10px', fontSize: '12px', color: '#0F172A', boxSizing: 'border-box' };
const btn = { ...ctrl, display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: '700', color: '#334155' };

const Empty = ({ text }) => (
  <div style={{ padding: '18px', textAlign: 'center', fontSize: '12.5px', color: '#94A3B8' }}>{text}</div>
);

// "Showing x–y of n" footer with 5 / 10 per page (BUSINZ table standard)
function usePaged(rows, resetKey) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  useEffect(() => { setPage(1); }, [resetKey, size]);
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const safe = Math.min(page, pages);
  const visible = rows.slice((safe - 1) * size, safe * size);
  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', padding: '10px 14px', borderTop: '1px solid #F1F5F9', fontSize: '11.5px', color: '#64748B', fontWeight: '600' }}>
      <span>Showing {total === 0 ? 0 : (safe - 1) * size + 1}–{Math.min(safe * size, total)} of {total}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <select aria-label="Rows per page" value={size} onChange={(e) => setSize(Number(e.target.value))} style={{ ...ctrl, height: '26px', padding: '0 6px', fontSize: '11.5px' }}>
          <option value={5}>5 / page</option>
          <option value={10}>10 / page</option>
        </select>
        <button type="button" aria-label="Previous page" disabled={safe <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
          style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderRadius: '6px', padding: '3px 7px', cursor: safe <= 1 ? 'not-allowed' : 'pointer', opacity: safe <= 1 ? 0.45 : 1 }}>
          <ChevronLeft size={13} />
        </button>
        <span style={{ color: '#0F172A', fontWeight: '800' }}>{safe} / {pages}</span>
        <button type="button" aria-label="Next page" disabled={safe >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}
          style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', borderRadius: '6px', padding: '3px 7px', cursor: safe >= pages ? 'not-allowed' : 'pointer', opacity: safe >= pages ? 0.45 : 1 }}>
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
  return { visible, footer };
}

// Product filter: pick products to show; each pick shows as a chip that can be removed again. Nothing picked = all.
function ProductFilter({ label, options, selected, onChange, formatOption = (o) => o, searchPlaceholder = 'Search product name' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const shown = options.filter(o => formatOption(o).toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (name) => onChange(selected.includes(name) ? selected.filter(s => s !== name) : [...selected, name]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setOpen(o => !o)} style={btn} aria-expanded={open}>
          <Filter size={13} /> {label}{selected.length ? ` (${selected.length})` : ''}
        </button>
        {selected.length > 0 && (
          <button type="button" onClick={() => onChange([])} style={{ ...pill(false), border: 'none', color: '#DC2626', backgroundColor: 'transparent' }}>Clear all</button>
        )}
        {open && (
          <div style={{ position: 'absolute', top: '36px', left: 0, zIndex: 30, width: '340px', maxWidth: '90vw', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)', padding: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '5px 10px', marginBottom: '8px' }}>
              <Search size={13} color="#94A3B8" />
              <input autoFocus type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder}
                style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '12px', color: '#0F172A', width: '100%' }} />
            </div>
            <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {shown.length === 0 ? <Empty text="No matching products" /> : shown.map(name => (
                <label key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', fontSize: '12.5px', color: '#0F172A', cursor: 'pointer', borderRadius: '6px' }}>
                  <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} />
                  <span>{formatOption(name)}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button type="button" onClick={() => setOpen(false)} style={{ ...btn, backgroundColor: '#0E7490', color: '#FFFFFF', border: 'none' }}>Done</button>
            </div>
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {selected.map(name => (
            <span key={name} style={{ ...pill(true), display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'default' }}>
              {formatOption(name)}
              <button type="button" aria-label={`Remove ${formatOption(name)}`} onClick={() => toggle(name)}
                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: '#0E7490', display: 'inline-flex' }}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Drill-down popups ----------
const repOf = (b) => String(b?.salesPerson || b?.createdBy || b?.assignedSalesperson || '—').replace(/\s*\([^)]*\)/g, '').trim() || '—';
const EVENT_LABEL = { received: 'Received', cancelled: 'Cancelled', invoiced: 'Invoiced', dispatched: 'Dispatched' };
const statusBadge = (text) => (
  <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '999px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#475569', whiteSpace: 'nowrap' }}>{text || '—'}</span>
);
const codeLink = (code, onClick) => (
  <button type="button" onClick={onClick} title="Open BOM details"
    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontWeight: '800', color: '#0E7490', textDecoration: 'underline', textUnderlineOffset: '2px', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
    {code}
  </button>
);

function ReportModal({ title, subtitle, onClose, onBack, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(15, 23, 42, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '980px', maxHeight: '86vh', display: 'flex', flexDirection: 'column', backgroundColor: '#F8FAFC', border: '1px solid #EAEFEF', borderRadius: '16px', boxShadow: '0 24px 60px rgba(15, 23, 42, 0.25)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px 18px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #EAEFEF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            {onBack && <button type="button" onClick={onBack} style={btn}>← Back</button>}
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h3>
              {subtitle && <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: '600', marginTop: '2px' }}>{subtitle}</div>}
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ ...btn, padding: '0 8px' }}><X size={14} /></button>
        </div>
        <div style={{ padding: '14px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}

// BOMs behind a date / product / kit row: BOM code, customer, sales person, status, allocated qty or event
function BomListTable({ rows, onOpenBom, qtyLabel, showEvent }) {
  if (!rows.length) return <Empty text="No BOMs for this selection." />;
  return (
    <div style={tableWrap}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={theadRow}>
          <th style={th}>BOM Code</th><th style={th}>Customer</th><th style={th}>Sales Person</th>
          {showEvent && <th style={th}>What happened</th>}
          <th style={th}>Current Status</th>
          {qtyLabel && <th style={th}>{qtyLabel}</th>}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.bom.bomCode || r.bom.code}-${i}`}>
              <td style={td}>{codeLink(r.bom.bomCode || r.bom.code, () => onOpenBom(r.bom))}</td>
              <td style={td}>{r.bom.customerName || r.bom.companyName || '—'}</td>
              <td style={{ ...td, fontWeight: '700' }}>{repOf(r.bom)}</td>
              {showEvent && <td style={td}>{EVENT_LABEL[r.event] || r.event}</td>}
              <td style={td}>{statusBadge(r.bom.status)}</td>
              {qtyLabel && <td style={{ ...td, fontWeight: '800' }}>{Number(r.qty || 0).toLocaleString('en-IN')}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// One BOM: header facts, preset kits, and every product with ordered / packed qty
function BomDetail({ bom }) {
  const packing = Array.isArray(bom.dispatchPacking) ? bom.dispatchPacking : [];
  const packKey = (it) => `${it.presetGroupId || ''}|${String(it.name || '').trim().toLowerCase()}`;
  const packedMap = new Map(packing.map(p => [packKey(p), p]));
  const items = Array.isArray(bom.items) ? bom.items : [];
  const kits = kitsOf(bom);
  const groups = Array.isArray(bom.presetGroups) ? bom.presetGroups : Object.values(bom.presetGroups || {});
  const groupName = (id) => groups.find(g => (g?.groupId || g?.id) === id)?.presetName || '';
  const packedQtyOf = (it) => {
    const p = packedMap.get(packKey(it));
    if (!p) return packing.length ? 0 : null;
    if (p.packedQty !== undefined && p.packedQty !== null && p.packedQty !== '') return num(p.packedQty);
    return p.packed ? num(p.qty || p.bomQty) : 0;
  };
  const facts = [
    ['Customer', bom.customerName || bom.companyName || '—'],
    ['Sales Person', repOf(bom)],
    ['Status', statusBadge(bom.status)],
    ['Payment Type', bom.paymentType || bom.paymentTerms || '—'],
    ['Document', String(bom.docType || '').toUpperCase() === 'DC' ? 'DC (Delivery Challan)' : 'Invoice'],
    ['Invoice No', bom.invoiceNo || '—'],
    ['Order Value', `₹${num(bom.grandTotal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`],
    ['Sent to Dispatch', fmtDay(dayKey(receivedDate(bom)))]
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
        {facts.map(([k, v]) => (
          <div key={k} style={{ backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '12px', padding: '10px 12px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginTop: '4px' }}>{v}</div>
          </div>
        ))}
      </div>
      {kits.length > 0 && (
        <div style={tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={theadRow}><th style={th}>Preset Kit</th><th style={th}>Qty</th></tr></thead>
            <tbody>{kits.map((k, i) => <tr key={i}><td style={td}>{k.name}</td><td style={{ ...td, fontWeight: '800', whiteSpace: 'nowrap' }}>{k.qty} {k.unit}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      <div style={tableWrap}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={theadRow}><th style={th}>Product</th><th style={th}>Kit</th><th style={th}>UOM</th><th style={th}>Ordered Qty</th><th style={th}>Packed Qty</th></tr></thead>
          <tbody>
            {items.length === 0 ? <tr><td colSpan={5}><Empty text="No products on this BOM." /></td></tr> : items.map((it, i) => {
              const packed = packedQtyOf(it);
              return (
                <tr key={i}>
                  <td style={td}>{it.name || it.code || 'Item'}</td>
                  <td style={{ ...td, color: '#64748B' }}>{it.presetGroupId ? (groupName(it.presetGroupId) || it.presetName || 'Preset Kit') : 'Standalone'}</td>
                  <td style={td}>{String(it.uom || it.unit || 'NOS').toUpperCase()}</td>
                  <td style={{ ...td, fontWeight: '800' }}>{orderedQtyOf(bom, it).toLocaleString('en-IN')}</td>
                  <td style={td}>{packed === null ? 'Not packed yet' : packed.toLocaleString('en-IN')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DispatchReportView(props) {
  const [boms, setBoms] = useState(Array.isArray(props.bomStore) ? props.bomStore : []);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('month'); // day | month | custom
  const [day, setDay] = useState(todayKey());
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [from, setFrom] = useState(`${todayKey().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayKey());
  const [itemFilter, setItemFilter] = useState([]);
  const [kitFilter, setKitFilter] = useState([]);
  const [bomSearch, setBomSearch] = useState('');
  const [exporting, setExporting] = useState('');
  const [productBasis, setProductBasis] = useState('goneout'); // goneout | received
  const [dayFilter, setDayFilter] = useState([]); // picked dates (YYYY-MM-DD) for the Day-wise Summary
  const [popup, setPopup] = useState(null); // { type: 'bom' | 'day' | 'item' | 'kit', ..., back }
  const openBom = (bom, back = null) => setPopup({ type: 'bom', bom, back });
  const clickableRow = { cursor: 'pointer' };

  const load = async () => {
    setLoading(true);
    try {
      const sid = localStorage.getItem('controlroom_device_session_id') || '';
      const res = await fetch('/api/boms', { headers: sid ? { 'x-session-id': sid } : {} });
      const json = res.ok ? await res.json() : null;
      let list = Array.isArray(json) ? json : (json?.data || json?.boms || []);
      if (!Array.isArray(list) || list.length === 0) list = await fetchCloudStore('bom_store', []);
      if (Array.isArray(list) && list.length > 0) setBoms(list.filter(Boolean));
    } catch (_) {
      // keep whatever we already have
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // Full inventory product list and preset library for the product filters
  const [masterItems, setMasterItems] = useState([]);
  const [masterKits, setMasterKits] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const central = (() => { try { return centralInventoryStore.getInventoryItems() || []; } catch (_) { return []; } })();
      const api = await getItems().catch(() => []);
      const byName = new Map();
      [...(Array.isArray(api) ? api : []), ...central].forEach(it => {
        const name = String(it?.name || it?.itemName || '').trim();
        if (name && !byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), { name, uom: String(it.uom || it.unit || 'NOS').toUpperCase() });
      });
      const presets = await syncPresetsWithCloud().catch(() => getAllActivePresets());
      // The preset library is a keyed object (id -> preset), not an array
      const presetList = Array.isArray(presets) ? presets : Object.values(presets || {});
      const kitNamesAll = [...new Set(presetList.map(pr => String(pr?.name || pr?.presetName || pr?.label || pr?.title || '').trim()).filter(Boolean))];
      if (alive) { setMasterItems([...byName.values()]); setMasterKits(kitNamesAll); }
    })();
    return () => { alive = false; };
  }, []);

  // Selected period as inclusive [start, end] day keys
  const [start, end] = useMemo(() => {
    if (mode === 'day') return [day, day];
    if (mode === 'month') {
      const [y, m] = month.split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      return [`${month}-01`, `${month}-${pad(last)}`];
    }
    return from <= to ? [from, to] : [to, from];
  }, [mode, day, month, from, to]);
  const periodLabel = start === end ? fmtDay(start) : `${fmtDay(start)} – ${fmtDay(end)}`;

  const report = useMemo(() => {
    const inPeriod = (value) => { const k = dayKey(value); return Boolean(k) && k >= start && k <= end; };
    const received = boms.filter(b => isSentToDispatch(b) && inPeriod(receivedDate(b)));
    const cancelled = boms.filter(b => isCancelledBom(b) && inPeriod(cancelledDate(b)));
    const invoiced = boms.filter(b => !isCancelledBom(b) && b.invoiceConfirmed && inPeriod(invoicedDate(b)));
    const dispatched = boms.filter(b => isDispatchedBom(b) && inPeriod(dispatchedDate(b)));

    const days = {};
    const bump = (k, field, b) => { if (!k) return; days[k] = days[k] || { received: 0, cancelled: 0, invoiced: 0, dispatched: 0, list: [] }; days[k][field] += 1; days[k].list.push({ bom: b, event: field }); };
    received.forEach(b => bump(dayKey(receivedDate(b)), 'received', b));
    cancelled.forEach(b => bump(dayKey(cancelledDate(b)), 'cancelled', b));
    invoiced.forEach(b => bump(dayKey(invoicedDate(b)), 'invoiced', b));
    dispatched.forEach(b => bump(dayKey(dispatchedDate(b)), 'dispatched', b));
    const dayRows = Object.entries(days).sort(([a], [b]) => a.localeCompare(b));

    // Products: "gone out" = packed qty of dispatched orders; "received" = ordered qty of BOMs received
    const aggregate = (list, itemsFn) => {
    const itemMap = new Map();
    const kitMap = new Map();
    list.forEach(b => {
      itemsFn(b).forEach(it => {
        if (!it.qty) return;
        const key = `${it.name.trim().toLowerCase()}|${String(it.uom).toUpperCase()}`;
        const cur = itemMap.get(key) || { name: it.name.trim(), uom: String(it.uom).toUpperCase(), qty: 0, orders: new Map() };
        const oc = b.bomCode || b.code;
        cur.qty += it.qty; cur.orders.set(oc, { bom: b, qty: (cur.orders.get(oc)?.qty || 0) + it.qty });
        itemMap.set(key, cur);
      });
      kitsOf(b).forEach(k => {
        const key = `${k.name.trim().toLowerCase()}|${k.unit}`;
        const cur = kitMap.get(key) || { name: k.name.trim(), unit: k.unit, qty: 0, orders: new Map() };
        const oc = b.bomCode || b.code;
        cur.qty += k.qty; cur.orders.set(oc, { bom: b, qty: (cur.orders.get(oc)?.qty || 0) + k.qty });
        kitMap.set(key, cur);
      });
    });
    return {
      items: [...itemMap.values()].sort((a, b) => b.qty - a.qty),
      kits: [...kitMap.values()].sort((a, b) => b.qty - a.qty)
    };
    };
    const orderedItems = (b) => (Array.isArray(b.items) ? b.items : []).map(it => ({ name: it.name || it.code || 'Item', uom: it.uom || it.unit || 'NOS', qty: orderedQtyOf(b, it) }));
    const goneOut = aggregate(dispatched, goneOutItems);
    const ordered = aggregate(received, orderedItems);

    const bomMap = new Map();
    const add = (list, event, dateFn) => list.forEach(b => {
      const code = b.bomCode || b.code;
      const row = bomMap.get(code) || { bom: b, code, customer: b.customerName || b.companyName || '—', status: b.status || '—', invoiceNo: b.invoiceNo || '', value: num(b.grandTotal), events: [] };
      row.events.push(`${event} ${fmtDay(dayKey(dateFn(b)))}`);
      bomMap.set(code, row);
    });
    add(received, 'Received', receivedDate);
    add(cancelled, 'Cancelled', cancelledDate);
    add(invoiced, 'Invoiced', invoicedDate);
    add(dispatched, 'Dispatched', dispatchedDate);
    const bomRows = [...bomMap.values()].sort((a, b) => String(b.code).localeCompare(String(a.code)));

    return { received, cancelled, invoiced, dispatched, dayRows, goneOut, ordered, bomRows };
  }, [boms, start, end]);

  // Product filters (drop picks that no longer exist in the selected period)
  const products = productBasis === 'received' ? report.ordered : report.goneOut;
  const basisLabel = productBasis === 'received' ? 'Received (Ordered)' : 'Gone Out';
  // Filter lists = every inventory product / preset kit (plus any name seen in the period); picks with no orders show 0
  const itemNames = useMemo(() => [...new Set([...masterItems.map(i => i.name), ...products.items.map(i => i.name)])].sort((a, b) => a.localeCompare(b)), [masterItems, products]);
  const kitNames = useMemo(() => [...new Set([...masterKits, ...products.kits.map(k => k.name)])].sort((a, b) => a.localeCompare(b)), [masterKits, products]);
  const activeItemFilter = itemFilter;
  const activeKitFilter = kitFilter;
  const shownItems = activeItemFilter.length
    ? activeItemFilter.flatMap(n => {
        const rows = products.items.filter(i => i.name === n);
        return rows.length ? rows : [{ name: n, uom: masterItems.find(m => m.name === n)?.uom || 'NOS', qty: 0, orders: new Map() }];
      })
    : products.items;
  const shownKits = activeKitFilter.length
    ? activeKitFilter.flatMap(n => {
        const rows = products.kits.filter(k => k.name === n);
        return rows.length ? rows : [{ name: n, unit: 'Sets', qty: 0, orders: new Map() }];
      })
    : products.kits;
  const shownBoms = report.bomRows.filter(r => {
    const q = bomSearch.trim().toLowerCase();
    return !q || String(r.code).toLowerCase().includes(q) || String(r.customer).toLowerCase().includes(q) || String(r.invoiceNo).toLowerCase().includes(q);
  });

  // Day-wise date filter: options = every day in the selected period; picked days with no activity show zeros
  const periodDays = useMemo(() => {
    const out = [];
    const [ys, ms, ds] = start.split('-').map(Number);
    const cur = new Date(ys, ms - 1, ds);
    for (let i = 0; i < 400 && dayKey(cur) <= end; i += 1) { out.push(dayKey(cur)); cur.setDate(cur.getDate() + 1); }
    return out;
  }, [start, end]);
  const activeDayFilter = dayFilter.filter(k => k >= start && k <= end);
  const zeroDay = { received: 0, cancelled: 0, invoiced: 0, dispatched: 0, list: [] };
  const shownDayRows = activeDayFilter.length
    ? [...activeDayFilter].sort().map(k => [k, (report.dayRows.find(([d]) => d === k) || [k, zeroDay])[1]])
    : report.dayRows;
  const dayTotals = shownDayRows.reduce((t, [, v]) => ({ received: t.received + v.received, cancelled: t.cancelled + v.cancelled, invoiced: t.invoiced + v.invoiced, dispatched: t.dispatched + v.dispatched }), { ...zeroDay });
  const dayPaged = usePaged(shownDayRows, `${start}${end}${activeDayFilter.join('|')}`);
  const itemPaged = usePaged(shownItems, `${start}${end}${productBasis}${activeItemFilter.join('|')}`);
  const kitPaged = usePaged(shownKits, `${start}${end}${productBasis}${activeKitFilter.join('|')}`);
  const bomPaged = usePaged(shownBoms, `${start}${end}${bomSearch}`);

  // ---------- Downloads (what is on screen: selected period + product filters) ----------
  const sections = () => ([
    { title: 'Summary', head: ['Metric', 'Count'], rows: [
      ['BOMs Received', report.received.length], ['BOMs Cancelled', report.cancelled.length],
      ['Completed - Invoiced', report.invoiced.length], ['Completed - Dispatched', report.dispatched.length]
    ] },
    { title: 'Day-wise Summary', head: ['Date', 'Received', 'Cancelled', 'Invoiced', 'Dispatched'], rows: shownDayRows.map(([k, v]) => [fmtDay(k), v.received, v.cancelled, v.invoiced, v.dispatched]) },
    { title: `Product-wise ${basisLabel} - Items`, head: ['Item', 'UOM', 'Qty', 'Orders'], rows: shownItems.map(i => [i.name, i.uom, i.qty, i.orders.size]) },
    { title: `Product-wise ${basisLabel} - Preset Kits`, head: ['Preset Kit', 'Qty', 'Unit', 'Orders'], rows: shownKits.map(k => [k.name, k.qty, k.unit, k.orders.size]) },
    { title: 'BOMs in this Period', head: ['BOM Code', 'Customer', 'What happened', 'Current Status', 'Invoice No', 'Value (Rs)'], rows: shownBoms.map(r => [r.code, r.customer, r.events.join('; '), r.status, r.invoiceNo || '-', Math.round(r.value * 100) / 100]) }
  ]);
  const fileBase = `Dispatch_Report_${start}_to_${end}`;
  const download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [esc(`Dispatch Report - ${periodLabel}`), ''];
    sections().forEach(s => {
      lines.push(esc(s.title));
      lines.push(s.head.map(esc).join(','));
      s.rows.forEach(r => lines.push(r.map(esc).join(',')));
      lines.push('');
    });
    download(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `${fileBase}.csv`);
  };

  const exportExcel = async () => {
    setExporting('excel');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      sections().forEach(s => {
        const ws = XLSX.utils.aoa_to_sheet([[`${s.title} (${periodLabel})`], [], s.head, ...s.rows]);
        ws['!cols'] = s.head.map((h, i) => ({ wch: Math.min(60, Math.max(String(h).length, ...s.rows.map(r => String(r[i] ?? '').length)) + 2) }));
        XLSX.utils.book_append_sheet(wb, ws, s.title.replace(/[^A-Za-z0-9 -]/g, '').slice(0, 31));
      });
      XLSX.writeFile(wb, `${fileBase}.xlsx`);
    } finally {
      setExporting('');
    }
  };

  const exportPdf = async () => {
    setExporting('pdf');
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 36;
      let y = margin;
      const newPageIfNeeded = (h) => { if (y + h > pageH - margin) { doc.addPage(); y = margin; } };
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(15, 23, 42);
      doc.text('Dispatch Report', margin, y + 4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100, 116, 139);
      doc.text(periodLabel, margin, y + 20);
      y += 40;
      sections().forEach(s => {
        const colW = (pageW - margin * 2) / s.head.length;
        newPageIfNeeded(50);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11.5); doc.setTextColor(15, 23, 42);
        doc.text(s.title, margin, y); y += 10;
        const drawHead = () => {
          doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
          doc.rect(margin, y, pageW - margin * 2, 20, 'FD');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
          s.head.forEach((h, i) => doc.text(String(h).toUpperCase(), margin + 6 + i * colW, y + 13));
          y += 20;
        };
        drawHead();
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
        if (s.rows.length === 0) { doc.text('No records', margin + 6, y + 14); y += 22; }
        s.rows.forEach(r => {
          const cells = r.map(c => doc.splitTextToSize(String(c ?? ''), colW - 10));
          const h = Math.max(...cells.map(c => c.length)) * 11 + 8;
          if (y + h > pageH - margin) { doc.addPage(); y = margin; drawHead(); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(15, 23, 42); }
          cells.forEach((c, i) => doc.text(c, margin + 6 + i * colW, y + 12));
          doc.setDrawColor(241, 245, 249); doc.line(margin, y + h, pageW - margin, y + h);
          y += h;
        });
        y += 18;
      });
      doc.save(`${fileBase}.pdf`);
    } finally {
      setExporting('');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* Header: title, period picker, downloads */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', backgroundColor: '#FFFFFF', border: '1px solid #EAEFEF', borderRadius: '16px', padding: '14px 18px', boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.3px' }}>Dispatch Report</h2>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', fontWeight: '600' }}>{periodLabel}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {[['day', 'Day'], ['month', 'Month'], ['custom', 'Custom']].map(([m, lbl]) => (
            <button key={m} type="button" onClick={() => setMode(m)} style={pill(mode === m)}>{lbl}</button>
          ))}
          {mode === 'day' && <input aria-label="Report day" type="date" value={day} onChange={(e) => setDay(e.target.value || todayKey())} style={ctrl} />}
          {mode === 'month' && <input aria-label="Report month" type="month" value={month} onChange={(e) => setMonth(e.target.value || todayKey().slice(0, 7))} style={ctrl} />}
          {mode === 'custom' && (
            <>
              <input aria-label="Report from date" type="date" value={from} onChange={(e) => setFrom(e.target.value || todayKey())} style={ctrl} />
              <span style={{ fontSize: '12px', color: '#64748B' }}>to</span>
              <input aria-label="Report to date" type="date" value={to} onChange={(e) => setTo(e.target.value || todayKey())} style={ctrl} />
            </>
          )}
          <button type="button" onClick={load} style={btn} title="Refresh"><RefreshCw size={13} /> {loading ? 'Loading…' : 'Refresh'}</button>
          <button type="button" onClick={exportPdf} disabled={Boolean(exporting)} style={btn}><FileText size={13} /> {exporting === 'pdf' ? 'Preparing…' : 'PDF'}</button>
          <button type="button" onClick={exportExcel} disabled={Boolean(exporting)} style={btn}><FileSpreadsheet size={13} /> {exporting === 'excel' ? 'Preparing…' : 'Excel'}</button>
          <button type="button" onClick={exportCsv} disabled={Boolean(exporting)} style={btn}><Download size={13} /> CSV</button>
        </div>
      </div>

      {/* Product view switcher (same pills as the CEO dashboard switcher) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '2px 0 6px 0' }}>
        {[
          { id: 'goneout', label: 'Gone Out (Dispatched)', icon: Truck },
          { id: 'received', label: 'Received (Ordered)', icon: PackageOpen }
        ].map(tab => {
          const isActive = productBasis === tab.id;
          const TabIcon = tab.icon;
          return (
            <button key={tab.id} type="button" onClick={() => setProductBasis(tab.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '20px',
                border: isActive ? '1.5px solid #0E7490' : '1px solid #E2E8F0', backgroundColor: isActive ? '#0E7490' : '#FFFFFF',
                color: isActive ? '#FFFFFF' : '#475569', fontSize: '11.5px', fontWeight: isActive ? '800' : '600', cursor: 'pointer', whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 2px 8px rgba(14, 116, 144, 0.25)' : '0 1px 2px rgba(0,0,0,0.03)', transition: 'all 0.15s ease'
              }}>
              <TabIcon size={13} color={isActive ? '#FFFFFF' : '#64748B'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <CeoKpiGrid kpis={[
        { title: 'BOMs Received', value: `${report.received.length}`, valColor: '#0E7490', trend: 'Sent to Dispatch', trendNeutral: true, hideTrendIcon: true, bottomPrefix: 'Reached Dispatch ', bottomHighlight: 'in this period', bottomHighlightColor: '#0E7490' },
        { title: 'BOMs Cancelled', value: `${report.cancelled.length}`, valColor: '#DC2626', highlightCard: report.cancelled.length > 0, trend: 'Cancelled', trendNeutral: true, hideTrendIcon: true, bottomPrefix: 'Cancelled and ', bottomHighlight: 'stock restored', bottomHighlightColor: '#DC2626' },
        { title: 'Completed — Invoiced', value: `${report.invoiced.length}`, valColor: '#6D28D9', trend: 'Invoice', trendNeutral: true, hideTrendIcon: true, bottomPrefix: 'Tax invoice ', bottomHighlight: 'confirmed by Billing', bottomHighlightColor: '#6D28D9' },
        { title: 'Completed — Dispatched', value: `${report.dispatched.length}`, valColor: '#059669', trend: 'Gone out', trendUp: true, hideTrendIcon: true, bottomPrefix: 'Vehicle loaded and ', bottomHighlight: 'dispatched', bottomHighlightColor: '#059669' }
      ]} />

      <BusinzSectionCard title={`Day-wise Summary (${shownDayRows.length} ${shownDayRows.length === 1 ? 'day' : 'days'})`}>
        <ProductFilter label="Filter dates" options={periodDays} selected={activeDayFilter} onChange={setDayFilter} formatOption={fmtDay} searchPlaceholder="Search date (e.g. 27 Nov)" />
        <div style={tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={theadRow}><th style={th}>Date</th><th style={th}>Received</th><th style={th}>Cancelled</th><th style={th}>Invoiced</th><th style={th}>Dispatched</th></tr></thead>
            <tbody>
              {shownDayRows.length === 0 ? (
                <tr><td colSpan={5}><Empty text="No BOM activity in this period." /></td></tr>
              ) : dayPaged.visible.map(([k, v]) => (
                <tr key={k} style={clickableRow} title="Click to see the BOMs for this date" onClick={() => setPopup({ type: 'day', key: k, data: v })}><td style={{ ...td, fontWeight: '700', color: '#0E7490' }}>{fmtDay(k)}</td><td style={td}>{v.received}</td><td style={td}>{v.cancelled}</td><td style={td}>{v.invoiced}</td><td style={td}>{v.dispatched}</td></tr>
              ))}
              {shownDayRows.length > 0 && (
                <tr style={{ backgroundColor: '#F8FAFC' }}>
                  <td style={{ ...td, fontWeight: '800' }}>Total</td><td style={{ ...td, fontWeight: '800' }}>{dayTotals.received}</td><td style={{ ...td, fontWeight: '800' }}>{dayTotals.cancelled}</td><td style={{ ...td, fontWeight: '800' }}>{dayTotals.invoiced}</td><td style={{ ...td, fontWeight: '800' }}>{dayTotals.dispatched}</td>
                </tr>
              )}
            </tbody>
          </table>
          {shownDayRows.length > 0 && dayPaged.footer}
        </div>
      </BusinzSectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px', minWidth: 0 }}>
        <BusinzSectionCard title={`Product-wise ${basisLabel} — Items (${shownItems.length})`}>
          <ProductFilter label="Filter products" options={itemNames} selected={activeItemFilter} onChange={setItemFilter} />
          <div style={tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={theadRow}><th style={th}>Item</th><th style={th}>UOM</th><th style={th}>Qty</th><th style={th}>Orders</th></tr></thead>
              <tbody>
                {shownItems.length === 0 ? (
                  <tr><td colSpan={4}><Empty text={productBasis === 'received' ? 'No BOMs received in this period.' : 'No dispatched orders in this period.'} /></td></tr>
                ) : itemPaged.visible.map(it => (
                  <tr key={`${it.name}|${it.uom}`} style={clickableRow} title="Click to see the BOMs and quantities" onClick={() => setPopup({ type: 'item', row: it })}><td style={{ ...td, color: '#0E7490', fontWeight: '700' }}>{it.name}</td><td style={td}>{it.uom}</td><td style={{ ...td, fontWeight: '800' }}>{it.qty.toLocaleString('en-IN')}</td><td style={td}>{it.orders.size}</td></tr>
                ))}
              </tbody>
            </table>
            {shownItems.length > 0 && itemPaged.footer}
          </div>
        </BusinzSectionCard>

        <BusinzSectionCard title={`Product-wise ${basisLabel} — Preset Kits (${shownKits.length})`}>
          <ProductFilter label="Filter kits" options={kitNames} selected={activeKitFilter} onChange={setKitFilter} />
          <div style={tableWrap}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={theadRow}><th style={th}>Preset Kit</th><th style={th}>Qty</th><th style={th}>Orders</th></tr></thead>
              <tbody>
                {shownKits.length === 0 ? (
                  <tr><td colSpan={3}><Empty text={productBasis === 'received' ? 'No preset kits in BOMs received this period.' : 'No preset kits dispatched in this period.'} /></td></tr>
                ) : kitPaged.visible.map(k => (
                  <tr key={`${k.name}|${k.unit}`} style={clickableRow} title="Click to see the BOMs and quantities" onClick={() => setPopup({ type: 'kit', row: k })}><td style={{ ...td, color: '#0E7490', fontWeight: '700' }}>{k.name}</td><td style={{ ...td, fontWeight: '800', whiteSpace: 'nowrap' }}>{k.qty.toLocaleString('en-IN')} {k.unit}</td><td style={td}>{k.orders.size}</td></tr>
                ))}
              </tbody>
            </table>
            {shownKits.length > 0 && kitPaged.footer}
          </div>
        </BusinzSectionCard>
      </div>

      <BusinzSectionCard
        title={`BOMs in this Period (${shownBoms.length})`}
        rightNode={
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '5px 10px', minWidth: '230px' }}>
            <Search size={13} color="#94A3B8" />
            <input type="text" value={bomSearch} onChange={(e) => setBomSearch(e.target.value)} placeholder="Search BOM, customer or invoice"
              style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '12px', color: '#0F172A', width: '100%' }} />
          </div>
        }
      >
        <div style={tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={theadRow}><th style={th}>BOM Code</th><th style={th}>Customer</th><th style={th}>What happened</th><th style={th}>Current Status</th><th style={th}>Invoice No</th><th style={th}>Value</th></tr></thead>
            <tbody>
              {shownBoms.length === 0 ? (
                <tr><td colSpan={6}><Empty text="No BOMs in this period." /></td></tr>
              ) : bomPaged.visible.map(r => (
                <tr key={r.code}>
                  <td style={td}>{codeLink(r.code, () => openBom(r.bom))}</td>
                  <td style={td}>{r.customer}</td>
                  <td style={td}>{r.events.join(' · ')}</td>
                  <td style={td}>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 9px', borderRadius: '999px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#475569', whiteSpace: 'nowrap' }}>{r.status}</span>
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.invoiceNo || '—'}</td>
                  <td style={{ ...td, fontWeight: '700', whiteSpace: 'nowrap' }}>₹{r.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shownBoms.length > 0 && bomPaged.footer}
        </div>
      </BusinzSectionCard>
      {popup && (() => {
        const close = () => setPopup(null);
        const back = popup.back ? () => setPopup(popup.back) : null;
        if (popup.type === 'bom') {
          return (
            <ReportModal title={`BOM ${popup.bom.bomCode || popup.bom.code}`} subtitle={`${popup.bom.customerName || popup.bom.companyName || ''} · ${repOf(popup.bom)}`} onClose={close} onBack={back}>
              <BomDetail bom={popup.bom} />
            </ReportModal>
          );
        }
        if (popup.type === 'day') {
          const rows = (popup.data?.list || []).map(x => ({ bom: x.bom, event: x.event }));
          return (
            <ReportModal title={`BOMs on ${fmtDay(popup.key)}`} subtitle={`${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`} onClose={close}>
              <BomListTable rows={rows} showEvent onOpenBom={(bom) => openBom(bom, popup)} />
            </ReportModal>
          );
        }
        const isKit = popup.type === 'kit';
        const r = popup.row;
        const rows = [...(r.orders?.values() || [])].map(o => ({ bom: o.bom, qty: o.qty }));
        return (
          <ReportModal title={r.name} subtitle={`${basisLabel} · ${periodLabel} · ${r.qty.toLocaleString('en-IN')} ${isKit ? r.unit : r.uom} in ${rows.length} ${rows.length === 1 ? 'BOM' : 'BOMs'}`} onClose={close}>
            <BomListTable rows={rows} qtyLabel={isKit ? `Qty (${r.unit})` : `Qty Allocated (${r.uom})`} onOpenBom={(bom) => openBom(bom, popup)} />
          </ReportModal>
        );
      })()}
    </div>
  );
}
