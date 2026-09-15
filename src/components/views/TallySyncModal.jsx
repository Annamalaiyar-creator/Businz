import React, { useState, useEffect } from 'react';
import { X, Download, RefreshCw, CheckCircle, AlertTriangle, FileCode, Check, Server, ExternalLink, HelpCircle } from 'lucide-react';
import { generateTallySalesInvoicesXml, generateTallyPurchaseOrdersXml, downloadTallyXmlFile } from '../../utils/tallyXmlGenerator';

export default function TallySyncModal({
  isOpen,
  onClose,
  records = [],
  type = 'Sales Invoice', // 'Sales Invoice' | 'Purchase Order'
  showAlert = () => {}
}) {
  if (!isOpen) return null;

  const [companyName, setCompanyName] = useState(() => localStorage.getItem('businz_tally_company') || 'VRM ENERGY PVT LTD');
  const [salesLedger, setSalesLedger] = useState('Sales - GST');
  const [tallyStatus, setTallyStatus] = useState({ checking: true, online: false, message: 'Checking Tally HTTP server...' });
  const [syncingDirect, setSyncingDirect] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [showXmlPreview, setShowXmlPreview] = useState(false);

  // Check live connectivity to Tally HTTP Server
  useEffect(() => {
    let isMounted = true;
    const checkTally = async () => {
      try {
        const res = await fetch('/api/tally/status', { method: 'GET', signal: AbortSignal.timeout(3500) });
        if (!isMounted) return;
        if (res.ok) {
          const data = await res.json();
          setTallyStatus({
            checking: false,
            online: data.online,
            message: data.online ? `Connected to Tally Server at ${data.host || 'localhost:9000'}` : 'Tally HTTP server is offline on port 9000. Use XML file import.'
          });
        } else {
          setTallyStatus({ checking: false, online: false, message: 'Tally HTTP server offline. Use XML file import.' });
        }
      } catch (_) {
        if (isMounted) {
          setTallyStatus({ checking: false, online: false, message: 'Tally HTTP server offline. Use XML file import.' });
        }
      }
    };
    checkTally();
    return () => { isMounted = false; };
  }, []);

  const handleSaveCompany = (val) => {
    setCompanyName(val);
    try { localStorage.setItem('businz_tally_company', val); } catch (_) {}
  };

  // Generate XML Content
  const xmlContent = type === 'Purchase Order'
    ? generateTallyPurchaseOrdersXml(records, { companyName })
    : generateTallySalesInvoicesXml(records, { companyName, salesLedger });

  // Handle Download XML
  const handleDownload = () => {
    const timestamp = new Date().toISOString().slice(0, 10);
    const prefix = type === 'Purchase Order' ? 'BUSINZ_Tally_Purchase_Orders' : 'BUSINZ_Tally_Sales_Invoices';
    const filename = `${prefix}_${timestamp}.xml`;
    downloadTallyXmlFile(xmlContent, filename);
    if (showAlert) showAlert(`✅ Tally XML file (${filename}) downloaded successfully!\n\nOpen TallyPrime ➔ Import Data ➔ Transactions to load.`);
  };

  // Handle Direct Sync to Tally HTTP Port 9000
  const handleDirectSync = async () => {
    setSyncingDirect(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/tally/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xml: xmlContent,
          type,
          recordCount: records.length,
          companyName
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSyncResult({ success: true, message: `✅ Successfully posted ${records.length} voucher(s) directly to TallyPrime!` });
        if (showAlert) showAlert(`✅ Success! Vouchers synchronized with TallyPrime.`);
      } else {
        setSyncResult({
          success: false,
          message: data.message || 'Tally HTTP server is not reachable on port 9000. Please download the XML file to import.'
        });
      }
    } catch (err) {
      setSyncResult({
        success: false,
        message: 'Could not connect to local Tally HTTP port. Download the XML file and use Tally ➔ Import Data.'
      });
    } finally {
      setSyncingDirect(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '620px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          backgroundColor: '#0891B2',
          backgroundImage: 'linear-gradient(135deg, #0E7490 0%, #155E75 100%)',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#FFFFFF'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: '900'
            }}>
              📊
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em' }}>
                TallyPrime &amp; Tally.ERP 9 Integration
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '12px', opacity: 0.85 }}>
                BUSINZ Automated Voucher &amp; Ledger Synchronization
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#FFFFFF',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Selected Summary Pill */}
          <div style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B', fontWeight: '700' }}>
                Selected for Export
              </span>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
                {records.length} {type}{records.length === 1 ? '' : 's'}
              </div>
            </div>
            <div style={{
              backgroundColor: '#ECFEFF',
              color: '#0E7490',
              border: '1px solid #CFFAFE',
              borderRadius: '20px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              Tally Voucher Format
            </div>
          </div>

          {/* Tally Connection Status Indicator */}
          <div style={{
            backgroundColor: tallyStatus.online ? '#F0FDF4' : '#FFFBEB',
            border: `1px solid ${tallyStatus.online ? '#BBF7D0' : '#FDE68A'}`,
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: tallyStatus.online ? '#16A34A' : '#D97706',
              boxShadow: tallyStatus.online ? '0 0 0 3px rgba(22, 163, 74, 0.2)' : '0 0 0 3px rgba(217, 119, 6, 0.2)',
              flexShrink: 0
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: tallyStatus.online ? '#166534' : '#92400E' }}>
                {tallyStatus.online ? 'Tally HTTP Server Active (Live Sync Ready)' : 'Direct HTTP Offline (File Import Ready)'}
              </div>
              <div style={{ fontSize: '11px', color: tallyStatus.online ? '#15803D' : '#B45309', marginTop: '2px' }}>
                {tallyStatus.message}
              </div>
            </div>
          </div>

          {/* Tally Settings Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Tally Company Name:
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => handleSaveCompany(e.target.value)}
                placeholder="e.g. VRM ENERGY PVT LTD"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                {type === 'Purchase Order' ? 'Purchase Ledger Name:' : 'Sales Ledger Name:'}
              </label>
              <input
                type="text"
                value={salesLedger}
                onChange={(e) => setSalesLedger(e.target.value)}
                placeholder="e.g. Sales - GST"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Result Alert if Direct Sync was executed */}
          {syncResult && (
            <div style={{
              backgroundColor: syncResult.success ? '#DCFCE7' : '#FEF2F2',
              border: `1px solid ${syncResult.success ? '#86EFAC' : '#FECACA'}`,
              color: syncResult.success ? '#166534' : '#991B1B',
              padding: '12px 16px',
              borderRadius: '10px',
              fontSize: '12.5px',
              fontWeight: '600'
            }}>
              {syncResult.message}
            </div>
          )}

          {/* Import Guide instructions */}
          <div style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '14px 18px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HelpCircle size={14} style={{ color: '#0E7490' }} />
              How to Import in TallyPrime:
            </div>
            <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '11.5px', color: '#475569', lineHeight: '1.6' }}>
              <li>Click <strong>Download Tally XML (.xml)</strong> below.</li>
              <li>Open <strong>TallyPrime</strong> and select your Company.</li>
              <li>Go to <strong>Import (Alt + O)</strong> ➔ <strong>Transactions</strong>.</li>
              <li>Select File Format <strong>XML</strong> and choose the downloaded file.</li>
            </ol>
          </div>

          {/* Optional XML Preview collapsible */}
          <div>
            <button
              type="button"
              onClick={() => setShowXmlPreview(!showXmlPreview)}
              style={{
                background: 'none',
                border: 'none',
                color: '#0E7490',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: 0
              }}
            >
              <FileCode size={13} />
              {showXmlPreview ? 'Hide Raw Tally XML' : 'Preview Raw Tally XML'}
            </button>
            {showXmlPreview && (
              <pre style={{
                backgroundColor: '#0F172A',
                color: '#38BDF8',
                padding: '14px',
                borderRadius: '8px',
                fontSize: '10.5px',
                maxHeight: '160px',
                overflow: 'auto',
                marginTop: '8px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'monospace'
              }}>
                {xmlContent}
              </pre>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          backgroundColor: '#F8FAFC',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>

          {/* Direct Sync (Available when Tally HTTP server is reachable) */}
          <button
            onClick={handleDirectSync}
            disabled={syncingDirect}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #0E7490',
              backgroundColor: '#ECFEFF',
              color: '#0E7490',
              fontSize: '13px',
              fontWeight: '800',
              cursor: syncingDirect ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Post directly to local Tally HTTP Server (Port 9000)"
          >
            <RefreshCw size={14} style={{ animation: syncingDirect ? 'spin 1s linear infinite' : 'none' }} />
            {syncingDirect ? 'Syncing...' : 'Direct Sync to Tally'}
          </button>

          {/* Download XML Button (100% Guaranteed works offline & online) */}
          <button
            onClick={handleDownload}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0E7490',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(14, 116, 144, 0.25)'
            }}
          >
            <Download size={15} />
            Download Tally XML (.xml)
          </button>
        </div>
      </div>
    </div>
  );
}
