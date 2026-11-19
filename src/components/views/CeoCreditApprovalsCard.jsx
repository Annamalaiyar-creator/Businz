import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CreditCard, CheckCircle, XCircle, Search, RefreshCw, ShieldCheck } from 'lucide-react';
import { invalidateCustomerCache, searchCustomers } from '../../services/customerService';

export default function CeoCreditApprovalsCard() {
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingList, setPendingList] = useState([]);
  const [approvedList, setApprovedList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyCode, setBusyCode] = useState('');
  const [limitDrafts, setLimitDrafts] = useState({});
  const [daysDrafts, setDaysDrafts] = useState({});
  const [statusMsg, setStatusMsg] = useState(null);

  // Quick-approve existing customer search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [quickPick, setQuickPick] = useState(null);
  const [quickLimit, setQuickLimit] = useState('');
  const [quickDays, setQuickDays] = useState('30');
  const searchTimerRef = useRef(null);

  const loadCreditLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers/credit-requests');
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        const pend = Array.isArray(json.pending) ? json.pending : [];
        const appr = Array.isArray(json.approved) ? json.approved : [];
        setPendingList(pend);
        setApprovedList(appr);
        const initLimits = {};
        const initDays = {};
        [...pend, ...appr].forEach(c => {
          initLimits[c.customerCode] = String(c.creditLimit > 0 ? c.creditLimit : (c.creditRequestedLimit || ''));
          initDays[c.customerCode] = String(c.creditDays || 30);
        });
        setLimitDrafts(initLimits);
        setDaysDrafts(initDays);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCreditLists();
  }, [loadCreditLists]);

  const handleDecision = async (customerCode, decision, customLimit = null, customDays = null) => {
    const code = String(customerCode || '').trim();
    if (!code) return;
    const limitNum = Number(customLimit != null ? customLimit : limitDrafts[code]) || 0;
    const daysNum = Math.max(1, Math.min(365, parseInt(customDays != null ? customDays : daysDrafts[code], 10) || 30));

    if (decision === 'approve' && limitNum <= 0) {
      setStatusMsg({ type: 'error', text: 'Please enter an Approved Credit Limit greater than ₹0.' });
      return;
    }

    let rejectionReason = '';
    if (decision === 'reject') {
      const prompted = window.prompt('Optional reason for rejecting credit request:', '');
      if (prompted === null) return;
      rejectionReason = prompted;
    }
    if (decision === 'revoke') {
      if (!window.confirm(`Revoke Credit Facility for customer ${code}?`)) return;
    }

    setBusyCode(code);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(code)}/credit-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          creditLimit: limitNum,
          creditDays: daysNum,
          rejectionReason
        })
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setStatusMsg({ type: 'error', text: json?.error || 'Failed to update credit decision.' });
        return;
      }
      invalidateCustomerCache();
      setStatusMsg({
        type: 'success',
        text: decision === 'approve'
          ? `Approved Credit Limit ₹${limitNum.toLocaleString('en-IN')} (${daysNum} days) for ${code}.`
          : `Updated credit status for ${code}.`
      });
      setQuickPick(null);
      setSearchQuery('');
      setSearchResults([]);
      setQuickLimit('');
      await loadCreditLists();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err?.message || 'Network error while updating credit decision.' });
    } finally {
      setBusyCode('');
    }
  };

  const handleSearchExisting = (val) => {
    setSearchQuery(val);
    setQuickPick(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const trimmed = val.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const list = await searchCustomers(trimmed, 8);
        setSearchResults(Array.isArray(list) ? list : []);
      } catch (_) {
        setSearchResults([]);
      }
    }, 250);
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#F3E8FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={16} />
          </div>
          <div>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
              Customer Credit Approvals & Credit Limits
            </span>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>
              Only CEO-approved credit customers can select Credit Payment in PI & BOM orders
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            style={{
              border: activeTab === 'pending' ? '1.5px solid #7C3AED' : '1px solid #E2E8F0',
              backgroundColor: activeTab === 'pending' ? '#F5F3FF' : '#FFFFFF',
              color: activeTab === 'pending' ? '#6D28D9' : '#475569',
              padding: '5px 12px',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: '800',
              cursor: 'pointer'
            }}
          >
            Pending Requests ({pendingList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('approved')}
            style={{
              border: activeTab === 'approved' ? '1.5px solid #059669' : '1px solid #E2E8F0',
              backgroundColor: activeTab === 'approved' ? '#ECFDF5' : '#FFFFFF',
              color: activeTab === 'approved' ? '#047857' : '#475569',
              padding: '5px 12px',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: '800',
              cursor: 'pointer'
            }}
          >
            Approved Credit Customers ({approvedList.length})
          </button>
          <button
            type="button"
            onClick={loadCreditLists}
            disabled={loading}
            title="Refresh credit list"
            style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#475569', padding: '5px 8px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {statusMsg && (
        <div style={{
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '700',
          backgroundColor: statusMsg.type === 'error' ? '#FEF2F2' : '#F0FDF4',
          color: statusMsg.type === 'error' ? '#B91C1C' : '#166534',
          border: `1px solid ${statusMsg.type === 'error' ? '#FECACA' : '#BBF7D0'}`
        }}>
          {statusMsg.text}
        </div>
      )}

      {activeTab === 'pending' && (
        <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                <th style={{ padding: '8px 10px' }}>Customer</th>
                <th style={{ padding: '8px 10px' }}>Requested By</th>
                <th style={{ padding: '8px 10px' }}>Set Credit Limit (₹)</th>
                <th style={{ padding: '8px 10px' }}>Credit Days</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>CEO Decision</th>
              </tr>
            </thead>
            <tbody>
              {pendingList.length > 0 ? pendingList.map(c => (
                <tr key={c.customerCode} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: '800', color: '#0F172A' }}>{c.companyName}</div>
                    <div style={{ fontSize: '10px', color: '#64748B' }}>{c.customerCode}{c.gstNo ? ` • ${c.gstNo}` : ''}</div>
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: '600', color: '#334155' }}>
                    {c.creditRequestedBy || c.assignedSalesperson || 'Sales'}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      type="number"
                      min="1"
                      placeholder="Set Limit ₹"
                      value={limitDrafts[c.customerCode] ?? ''}
                      onChange={(e) => setLimitDrafts(prev => ({ ...prev, [c.customerCode]: e.target.value }))}
                      style={{ width: '120px', height: '30px', borderRadius: '6px', border: '1px solid #C4B5FD', padding: '0 8px', fontSize: '12px', fontWeight: '700' }}
                    />
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={daysDrafts[c.customerCode] ?? '30'}
                      onChange={(e) => setDaysDrafts(prev => ({ ...prev, [c.customerCode]: e.target.value }))}
                      style={{ width: '60px', height: '30px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 6px', fontSize: '12px', fontWeight: '700' }}
                    />
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        type="button"
                        disabled={busyCode === c.customerCode}
                        onClick={() => handleDecision(c.customerCode, 'approve')}
                        style={{ border: 'none', backgroundColor: '#059669', color: '#FFFFFF', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <CheckCircle size={12} /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyCode === c.customerCode}
                        onClick={() => handleDecision(c.customerCode, 'reject')}
                        style={{ border: '1px solid #FECACA', backgroundColor: '#FEF2F2', color: '#DC2626', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#16A34A', fontWeight: '700' }}>
                    No pending customer credit approval requests.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'approved' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Quick Approve Existing Customer */}
          <div style={{ padding: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="#0E7490" /> Approve Existing Customer for Credit Facility
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1 1 240px' }}>
                <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Search existing customer by name, code, or GST..."
                  value={searchQuery}
                  onChange={(e) => handleSearchExisting(e.target.value)}
                  style={{ width: '100%', height: '34px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px 0 30px', fontSize: '12px', boxSizing: 'border-box' }}
                />
                {searchResults.length > 0 && !quickPick && (
                  <div style={{ position: 'absolute', top: '38px', left: 0, right: 0, backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.1)', zIndex: 40, maxHeight: '180px', overflowY: 'auto' }}>
                    {searchResults.map(r => (
                      <div
                        key={r.customerCode || r.id}
                        onClick={() => {
                          setQuickPick(r);
                          setSearchQuery(`${r.companyName} (${r.customerCode})`);
                          setQuickLimit(r.creditLimit > 0 ? String(r.creditLimit) : '');
                          setQuickDays(String(r.creditDays || 30));
                          setSearchResults([]);
                        }}
                        style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', fontSize: '12px' }}
                      >
                        <strong>{r.companyName}</strong> <span style={{ color: '#64748B' }}>({r.customerCode})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="number"
                min="1"
                placeholder="Credit Limit (₹)"
                value={quickLimit}
                onChange={(e) => setQuickLimit(e.target.value)}
                style={{ width: '140px', height: '34px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12px', fontWeight: '700' }}
              />
              <input
                type="number"
                min="1"
                max="365"
                placeholder="Days"
                value={quickDays}
                onChange={(e) => setQuickDays(e.target.value)}
                style={{ width: '70px', height: '34px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '12px', fontWeight: '700' }}
              />
              <button
                type="button"
                disabled={!quickPick || busyCode === quickPick?.customerCode}
                onClick={() => quickPick && handleDecision(quickPick.customerCode || quickPick.id, 'approve', quickLimit, quickDays)}
                style={{ border: 'none', backgroundColor: quickPick ? '#0E7490' : '#CBD5E1', color: '#FFFFFF', height: '34px', padding: '0 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: quickPick ? 'pointer' : 'not-allowed' }}
              >
                Approve Credit
              </button>
            </div>
          </div>

          <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                  <th style={{ padding: '8px 10px' }}>Customer</th>
                  <th style={{ padding: '8px 10px' }}>Approved Limit (₹)</th>
                  <th style={{ padding: '8px 10px' }}>Days</th>
                  <th style={{ padding: '8px 10px' }}>Approved By</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvedList.length > 0 ? approvedList.map(c => (
                  <tr key={c.customerCode} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: '800', color: '#0F172A' }}>{c.companyName}</div>
                      <div style={{ fontSize: '10px', color: '#64748B' }}>{c.customerCode}{c.gstNo ? ` • ${c.gstNo}` : ''}</div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        type="number"
                        min="1"
                        value={limitDrafts[c.customerCode] ?? ''}
                        onChange={(e) => setLimitDrafts(prev => ({ ...prev, [c.customerCode]: e.target.value }))}
                        style={{ width: '120px', height: '30px', borderRadius: '6px', border: '1px solid #A7F3D0', padding: '0 8px', fontSize: '12px', fontWeight: '800', color: '#065F46' }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={daysDrafts[c.customerCode] ?? '30'}
                        onChange={(e) => setDaysDrafts(prev => ({ ...prev, [c.customerCode]: e.target.value }))}
                        style={{ width: '60px', height: '30px', borderRadius: '6px', border: '1px solid #CBD5E1', padding: '0 6px', fontSize: '12px', fontWeight: '700' }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px', color: '#475569', fontSize: '11px' }}>
                      {c.creditApprovedBy || 'CEO'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          disabled={busyCode === c.customerCode}
                          onClick={() => handleDecision(c.customerCode, 'approve')}
                          style={{ border: '1px solid #A7F3D0', backgroundColor: '#ECFDF5', color: '#047857', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Update Limit
                        </button>
                        <button
                          type="button"
                          disabled={busyCode === c.customerCode}
                          onClick={() => handleDecision(c.customerCode, 'revoke')}
                          style={{ border: '1px solid #FECACA', backgroundColor: '#FEF2F2', color: '#DC2626', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Revoke
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#64748B', fontWeight: '600' }}>
                      No CEO-approved credit customers yet. Use the search bar above or approve pending requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
