import React from 'react';
import {
  Clock, Truck, Printer, Download, CreditCard, PackageCheck, Boxes, Receipt, Factory
} from 'lucide-react';
import VRMBomPrintTemplate from '../../VRMBomPrintTemplate';

export default function BomConfirmCeoDetailSection({ ctx, auditVars }) {
  const {
    props,
    userRole,
    renderExportFormatModal,
    printingBomRecord,
    setPrintingBomRecord,
    setExportFormatRecord,
    confirmingBomModal,
    setConfirmingBomModal,
    defaultSalesPersonName,
    presetSetCount,
    presetUnit,
    presetKitPrice,
    presetGroups,
    totals
  } = ctx;
  const {
    orderSubTotal,
    orderGrandTotal,
    orderGstAmount,
    sourcePi,
    timing
  } = auditVars;

      const itemsList = Array.isArray(confirmingBomModal.items) ? confirmingBomModal.items : [];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>
          {/* Top Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  BOM Order Details · {confirmingBomModal.bomCode}
                </h1>
                <span style={{
                  backgroundColor: '#ECFEFF', color: '#0E7490',
                  fontSize: '11px', fontWeight: '800', padding: '3px 10px',
                  borderRadius: '12px', border: '1px solid #A5F3FC',
                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  CEO EXECUTIVE VIEW
                </span>
                {(confirmingBomModal.isEdited || (Array.isArray(confirmingBomModal.editHistory) && confirmingBomModal.editHistory.length > 0)) && (
                  <span style={{
                    backgroundColor: '#FEF3C7', color: '#B45309',
                    fontSize: '11px', fontWeight: '800', padding: '3px 10px',
                    borderRadius: '12px', border: '1px solid #FDE68A'
                  }}>
                    Edited{confirmingBomModal.lastEditedBy ? ` • ${confirmingBomModal.lastEditedBy}` : ''}
                  </span>
                )}
                <span style={{
                  backgroundColor: confirmingBomModal.status === 'Cancelled' ? '#FEE2E2' : '#F0FDF4',
                  color: confirmingBomModal.status === 'Cancelled' ? '#DC2626' : '#166534',
                  fontSize: '11px', fontWeight: '800', padding: '3px 10px',
                  borderRadius: '12px', border: `1px solid ${confirmingBomModal.status === 'Cancelled' ? '#FECACA' : '#BBF7D0'}`
                }}>
                  {confirmingBomModal.status || 'Active'}
                </span>
              </div>
              <span style={{ fontSize: '12.5px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                Customer: <strong style={{ color: '#0F172A' }}>{confirmingBomModal.customerName || confirmingBomModal.companyName || 'Customer'}</strong> • Rep: <strong>{(confirmingBomModal.salesPerson || confirmingBomModal.createdBy || defaultSalesPersonName).replace(/\s*\([^)]*\)/g, '').trim()}</strong> • Order Value: <strong style={{ color: '#0E7490' }}>₹ {orderGrandTotal.toLocaleString('en-IN')}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setPrintingBomRecord(confirmingBomModal)}
                title="Print BOM Order Sheet"
                style={{
                  border: '1px solid #059669',
                  backgroundColor: '#ECFDF5',
                  color: '#047857',
                  height: '38px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Printer size={14} /> Print BOM
              </button>
              <button
                onClick={() => setExportFormatRecord(confirmingBomModal)}
                title="Export BOM"
                style={{
                  border: '1px solid #0E7490',
                  backgroundColor: '#ECFEFF',
                  color: '#0E7490',
                  height: '38px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={14} /> Export BOM
              </button>
              <button
                onClick={() => setConfirmingBomModal(null)}
                style={{
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  height: '38px',
                  padding: '0 18px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Back to ALL BOMs
              </button>
            </div>
          </div>

          {Array.isArray(confirmingBomModal.editHistory) && confirmingBomModal.editHistory.length > 0 && (
            <div style={{
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: '12px',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  ✏️ Edited BOM History ({confirmingBomModal.editHistory.length})
                </span>
                {confirmingBomModal.lastEditedAt && (
                  <span style={{ fontSize: '11.5px', color: '#B45309', fontWeight: '600' }}>
                    Last edited by {confirmingBomModal.lastEditedBy || 'Sales'} on {new Date(confirmingBomModal.lastEditedAt).toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {[...confirmingBomModal.editHistory].reverse().map((entry, idx) => (
                  <div key={idx} style={{ backgroundColor: '#FFFFFF', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#0F172A', marginBottom: '4px' }}>
                      {entry.editedBy || 'Sales'}{entry.editedByRole ? ` (${entry.editedByRole})` : ''} • {entry.editedAt ? new Date(entry.editedAt).toLocaleString('en-IN') : ''}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {(Array.isArray(entry.changes) ? entry.changes : ['BOM details updated']).map((chg, cIdx) => (
                        <li key={cIdx}>{chg}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 1. TOP SECTION: ALL STAGES WITH ACTUAL TIME & STAGE PROCESSING AUDIT */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '20px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Header & Stage Status Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Order-to-Cash Lifecycle Progress
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>
                    Live timestamp audit tracking each handover from BOM confirmation to final loading.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '11.5px',
                  fontWeight: '800',
                  color: timing?.isCompleted ? '#16A34A' : '#0E7490',
                  backgroundColor: timing?.isCompleted ? '#F0FDF4' : '#ECFEFF',
                  border: `1px solid ${timing?.isCompleted ? '#BBF7D0' : '#BAE6FD'}`,
                  padding: '5px 12px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Clock size={13} />
                  {timing?.isCompleted ? (
                    <span>Status: <strong>Order Completed & Dispatched</strong> {timing?.totalTurnaround ? `(Turnaround: ${timing.totalTurnaround})` : ''}</span>
                  ) : (
                    <span>Current Stage: <strong>{timing?.activeStageName || 'In Processing'}</strong></span>
                  )}
                </span>
              </div>
            </div>

            {/* Horizontal Stage Cards Flow */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '12px',
              alignItems: 'stretch'
            }}>
              {/* Stage 1: PI Created */}
              <div style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
                    Step 1 · PI Created
                  </span>
                  <Receipt size={14} color="#64748B" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>
                    {timing?.piTime || (timing?.hasPi ? 'Completed' : '—')}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>
                    {confirmingBomModal.sourcePiNo ? `Ref: ${confirmingBomModal.sourcePiNo}` : (timing?.hasPi ? 'Proforma Invoice' : 'Direct BOM Order')}
                  </div>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid #E2E8F0', fontSize: '10.5px', fontWeight: '700', color: '#0284C7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{timing?.hasPi ? '✓ Converted to BOM' : '—'}</span>
                </div>
              </div>

              {/* Stage 2: BOM Confirmed */}
              <div style={{
                backgroundColor: '#F0F9FF',
                border: '1.5px solid #BAE6FD',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#0284C7', textTransform: 'uppercase' }}>
                    Step 2 · BOM Confirmed
                  </span>
                  <Factory size={14} color="#0284C7" />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: '#0369A1' }}>
                    {timing?.confirmedTime || (timing?.hasConfirmed ? 'Confirmed' : 'Draft')}
                  </div>
                  <div style={{ fontSize: '10px', color: '#0284C7', marginTop: '1px' }}>
                    {timing?.confirmedDate ? `${timing.confirmedDate} • Confirmed to Dispatch` : 'Pending Sales Confirmation'}
                  </div>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid #BAE6FD', fontSize: '10.5px', fontWeight: '700', color: '#0284C7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{timing?.hasConfirmed ? '✓ Pushed to Packing' : 'Draft'}</span>
                </div>
              </div>

              {/* Stage 3: Dispatch Packing */}
              <div style={{
                backgroundColor: timing?.hasPacking ? '#ECFDF5' : (timing?.isPackingActive ? '#FFFBEB' : '#F8FAFC'),
                border: `1.5px solid ${timing?.hasPacking ? '#A7F3D0' : (timing?.isPackingActive ? '#FDE68A' : '#E2E8F0')}`,
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: timing?.hasPacking ? '#059669' : (timing?.isPackingActive ? '#D97706' : '#64748B'), textTransform: 'uppercase' }}>
                    Step 3 · Dispatch Packing
                  </span>
                  <PackageCheck size={14} color={timing?.hasPacking ? '#059669' : '#D97706'} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: timing?.hasPacking ? '#047857' : (timing?.isPackingActive ? '#B45309' : '#475569') }}>
                    {timing?.hasPacking ? (timing?.packingCompletedTime ? `At ${timing.packingCompletedTime}` : 'Packed') : (timing?.isPackingActive ? 'Processing' : 'Pending')}
                  </div>
                  <div style={{ fontSize: '10px', color: timing?.hasPacking ? '#047857' : '#B45309', marginTop: '1px', fontWeight: '700' }}>
                    {timing?.hasPacking ? (timing.packingDuration ? `Took ${timing.packingDuration}` : 'Packing Verified') : (timing?.isPackingActive ? `Received: ${timing.packingReceivedTime || timing.confirmedTime || 'In Queue'}` : 'Awaiting packing')}
                  </div>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '6px', borderTop: `1px solid ${timing?.hasPacking ? '#A7F3D0' : '#FDE68A'}`, fontSize: '10.5px', fontWeight: '700', color: timing?.hasPacking ? '#059669' : '#D97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{timing?.hasPacking ? '✓ Pushed to Accounts' : (timing?.isPackingActive ? 'In Packing Queue' : 'Pending')}</span>
                </div>
              </div>

              {/* Stage 4: Accounts Verification */}
              <div style={{
                backgroundColor: timing?.hasAccounts ? '#ECFDF5' : (timing?.isAccountsActive ? '#F5F3FF' : '#F8FAFC'),
                border: `1.5px solid ${timing?.hasAccounts ? '#A7F3D0' : (timing?.isAccountsActive ? '#DDD6FE' : '#E2E8F0')}`,
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: timing?.hasAccounts ? '#059669' : (timing?.isAccountsActive ? '#7C3AED' : '#64748B'), textTransform: 'uppercase' }}>
                    Step 4 · Accounts Verification
                  </span>
                  <CreditCard size={14} color={timing?.hasAccounts ? '#059669' : '#7C3AED'} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: timing?.hasAccounts ? '#047857' : (timing?.isAccountsActive ? '#6D28D9' : '#475569') }}>
                    {timing?.hasAccounts ? (timing?.accountsCompletedTime ? `At ${timing.accountsCompletedTime}` : 'Verified') : (timing?.isAccountsActive ? 'Processing' : 'Pending')}
                  </div>
                  <div style={{ fontSize: '10px', color: timing?.hasAccounts ? '#047857' : '#6D28D9', marginTop: '1px', fontWeight: '700' }}>
                    {timing?.hasAccounts ? (timing.accountsDuration ? `Took ${timing.accountsDuration}` : 'Accounts Verified') : (timing?.isAccountsActive ? `Received: ${timing.accountsReceivedTime || ''}` : 'Awaiting accounts')}
                  </div>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '6px', borderTop: `1px solid ${timing?.hasAccounts ? '#A7F3D0' : '#DDD6FE'}`, fontSize: '10.5px', fontWeight: '700', color: timing?.hasAccounts ? '#059669' : '#7C3AED', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{timing?.hasAccounts ? '✓ Pushed to Billing' : (timing?.isAccountsActive ? 'In Verification' : 'Pending')}</span>
                </div>
              </div>

              {/* Stage 5: Invoice */}
              <div style={{
                backgroundColor: timing?.hasInvoice ? '#ECFDF5' : (timing?.isInvoiceActive ? '#EFF6FF' : '#F8FAFC'),
                border: `1.5px solid ${timing?.hasInvoice ? '#A7F3D0' : (timing?.isInvoiceActive ? '#BFDBFE' : '#E2E8F0')}`,
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: timing?.hasInvoice ? '#059669' : (timing?.isInvoiceActive ? '#2563EB' : '#64748B'), textTransform: 'uppercase' }}>
                    Step 5 · Invoice
                  </span>
                  <Receipt size={14} color={timing?.hasInvoice ? '#059669' : '#2563EB'} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: timing?.hasInvoice ? '#047857' : (timing?.isInvoiceActive ? '#1D4ED8' : '#475569') }}>
                    {timing?.hasInvoice ? (timing?.invoiceCompletedTime ? `At ${timing.invoiceCompletedTime}` : 'Invoiced') : (timing?.isInvoiceActive ? 'Processing' : 'Pending')}
                  </div>
                  <div style={{ fontSize: '10px', color: timing?.hasInvoice ? '#047857' : '#1D4ED8', marginTop: '1px', fontWeight: '700' }}>
                    {timing?.hasInvoice ? (timing.invoiceDuration ? `Took ${timing.invoiceDuration}` : 'Invoice Confirmed') : (timing?.isInvoiceActive ? `Received: ${timing.invoiceReceivedTime || ''}` : 'Awaiting billing')}
                  </div>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '6px', borderTop: `1px solid ${timing?.hasInvoice ? '#A7F3D0' : '#BFDBFE'}`, fontSize: '10.5px', fontWeight: '700', color: timing?.hasInvoice ? '#059669' : '#2563EB', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{timing?.hasInvoice ? '✓ Pushed to Loading' : (timing?.isInvoiceActive ? 'Generating Invoice' : 'Pending')}</span>
                </div>
              </div>

              {/* Stage 6: Final Dispatch */}
              <div style={{
                backgroundColor: timing?.hasDispatch ? '#F0FDF4' : (timing?.isDispatchActive ? '#F0FDF4' : '#F8FAFC'),
                border: `1.5px solid ${timing?.hasDispatch ? '#86EFAC' : (timing?.isDispatchActive ? '#BBF7D0' : '#E2E8F0')}`,
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: timing?.hasDispatch ? '#16A34A' : '#64748B', textTransform: 'uppercase' }}>
                    Step 6 · Final Dispatch
                  </span>
                  <Truck size={14} color={timing?.hasDispatch ? '#16A34A' : '#64748B'} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '900', color: timing?.hasDispatch ? '#15803D' : (timing?.isDispatchActive ? '#16A34A' : '#475569') }}>
                    {timing?.hasDispatch ? (timing?.dispatchCompletedTime ? `At ${timing.dispatchCompletedTime}` : 'Dispatched') : (timing?.isDispatchActive ? 'Processing' : 'Pending')}
                  </div>
                  <div style={{ fontSize: '10px', color: timing?.hasDispatch ? '#15803D' : '#16A34A', marginTop: '1px', fontWeight: '700' }}>
                    {timing?.hasDispatch ? (timing.dispatchDuration ? `Took ${timing.dispatchDuration}` : 'Final Dispatch') : (timing?.isDispatchActive ? `Received: ${timing.dispatchReceivedTime || ''}` : 'Awaiting loading')}
                  </div>
                </div>
                <div style={{ marginTop: 'auto', paddingTop: '6px', borderTop: `1px solid ${timing?.hasDispatch ? '#86EFAC' : '#BBF7D0'}`, fontSize: '10.5px', fontWeight: '700', color: timing?.hasDispatch ? '#16A34A' : '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{timing?.hasDispatch ? '✓ Order Completed' : (timing?.isDispatchActive ? 'Loading Vehicle' : 'Pending')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. BELOW THAT: LIST OF PRODUCTS & MATERIALS TABLE (PI FORMAT FOR CEO) */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '20px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Boxes size={18} color="#0E7490" />
                  Itemized Products & Preset Structure Kits
                </h3>
                <span style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px', display: 'block' }}>
                  Grouped by Structure Kit with component rates, HSN/SAC, GST, and totals in commercial PI format.
                </span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '4px 10px', borderRadius: '10px' }}>
                {itemsList.length} Item{itemsList.length !== 1 ? 's' : ''} Listed
              </span>
            </div>

            {(() => {
              let presetGroupsData = confirmingBomModal.presetGroups || sourcePi?.presetGroups || {};
              if (typeof presetGroupsData === 'string') {
                try {
                  presetGroupsData = JSON.parse(presetGroupsData);
                } catch (e) {
                  presetGroupsData = {};
                }
              }
              const sections = [];
              const sectionMap = new Map();

              const allZeroRates = itemsList.length > 0 && itemsList.every(it => (parseFloat(it.rate || it.price || 0) || 0) === 0);

              itemsList.forEach((it, idx) => {
                const isPreset = Boolean(it.isPresetItem || it.presetGroupId || it.presetName || (allZeroRates && (confirmingBomModal.presetName || sourcePi?.presetName)));
                const secKey = isPreset
                  ? (it.presetGroupId || it.presetName || confirmingBomModal.presetName || sourcePi?.presetName || 'PRESET_1')
                  : '__CUSTOM_ITEMS__';

                if (!sectionMap.has(secKey)) {
                  const secObj = {
                    key: secKey,
                    isPreset,
                    presetGroupId: it.presetGroupId,
                    presetName: isPreset ? (it.presetName || (it.presetGroupId && presetGroupsData[it.presetGroupId]?.presetName) || confirmingBomModal.presetName || sourcePi?.presetName || 'Preset Structure Kit') : 'Custom / Standalone Products',
                    items: []
                  };
                  sectionMap.set(secKey, secObj);
                  sections.push(secObj);
                }
                sectionMap.get(secKey).items.push({ item: it, originalIndex: idx });
              });

              // Fallback single section if items is empty
              if (sections.length === 0 && (confirmingBomModal.presetName || sourcePi?.presetName || orderGrandTotal > 0)) {
                sections.push({
                  key: 'PRESET_1',
                  isPreset: true,
                  presetGroupId: 'group_1',
                  presetName: confirmingBomModal.presetName || sourcePi?.presetName || 'Solar Mounting Structure Kit',
                  items: [{
                    item: {
                      name: confirmingBomModal.presetName || sourcePi?.presetName || 'Solar Mounting Structure Kit',
                      hsn: '73089090',
                      qty: confirmingBomModal.presetSetCount || sourcePi?.presetSetCount || 1,
                      uom: confirmingBomModal.presetUnit || sourcePi?.presetUnit || 'SET',
                      rate: orderSubTotal,
                      gstRate: '18%'
                    },
                    originalIndex: 0
                  }]
                });
              }

              // Pre-compute custom items taxable sum
              const customTaxableTotal = sections
                .filter(s => !s.isPreset)
                .flatMap(s => s.items)
                .reduce((sum, { item }) => {
                  const q = (parseFloat(item.totalDispatchQty) > 0 ? parseFloat(item.totalDispatchQty) : (parseFloat(item.qty || item.quantity || item.bomQty || 0) || 0));
                  const r = parseFloat(item.rate || item.price || 0) || 0;
                  return sum + (q * r);
                }, 0);

              const presetTaxablePool = Math.max(0, orderSubTotal - customTaxableTotal);
              const presetSections = sections.filter(s => s.isPreset);
              const presetGroupsList = Array.isArray(presetGroupsData)
                ? presetGroupsData
                : (presetGroupsData && typeof presetGroupsData === 'object' ? Object.values(presetGroupsData) : []);

              return (
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B' }}>
                        <th style={{ padding: '8px 10px', width: '38px', textAlign: 'center' }}>#</th>
                        <th style={{ padding: '8px 10px' }}>Product / Component</th>
                        <th style={{ padding: '8px 10px', width: '85px', textAlign: 'center' }}>HSN / SAC</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '70px' }}>Qty</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>UOM</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '110px' }}>Rate (₹)</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '55px' }}>GST</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sections.length > 0 ? (
                        sections.map((sec, secIdx) => {
                          if (sec.isPreset) {
                            const presetIdx = presetSections.indexOf(sec);
                            let grpConfig = (sec.presetGroupId && presetGroupsData[sec.presetGroupId]) || (presetGroupsData[sec.key]) || null;
                            if (!grpConfig && presetGroupsList.length > 0) {
                              grpConfig = presetGroupsList.find(g =>
                                (sec.presetGroupId && (g.id === sec.presetGroupId || g.groupId === sec.presetGroupId)) ||
                                (sec.presetName && g.presetName && g.presetName.toLowerCase().trim() === sec.presetName.toLowerCase().trim()) ||
                                (g.name && sec.presetName && g.name.toLowerCase().trim() === sec.presetName.toLowerCase().trim())
                              ) || null;
                            }
                            const setCount = parseFloat(grpConfig?.setCount || grpConfig?.quantity || confirmingBomModal.presetSetCount || sourcePi?.presetSetCount || 1) || 1;
                            const pUnit = grpConfig?.unit || grpConfig?.unitType || confirmingBomModal.presetUnit || sourcePi?.presetUnit || 'Sets';

                            // Calculate kit taxable
                            let taxable = 0;
                            if (grpConfig?.kitPrice && parseFloat(grpConfig.kitPrice) > 0) {
                              taxable = (parseFloat(grpConfig.kitPrice) || 0) * setCount;
                            } else if (confirmingBomModal.presetKitPrice && parseFloat(confirmingBomModal.presetKitPrice) > 0) {
                              taxable = (parseFloat(confirmingBomModal.presetKitPrice) || 0) * setCount;
                            } else if (sourcePi?.presetKitPrice && parseFloat(sourcePi.presetKitPrice) > 0) {
                              taxable = (parseFloat(sourcePi.presetKitPrice) || 0) * setCount;
                            } else if (confirmingBomModal.unitValue && parseFloat(confirmingBomModal.unitValue) > 0) {
                              taxable = parseFloat(confirmingBomModal.unitValue) || 0;
                            } else if (presetSections.length === 1) {
                              taxable = presetTaxablePool || (orderGrandTotal > 0 ? Math.round(orderGrandTotal / 1.18) : 0);
                            } else if (presetSections.length > 0) {
                              taxable = Math.round(presetTaxablePool / presetSections.length);
                            }

                            const rawGst = grpConfig?.gstRate || sec.items[0]?.item?.gstRate || confirmingBomModal.gstRate || sourcePi?.gstRate || '18%';
                            const gstPct = parseFloat(String(rawGst).replace('%', '').trim()) || 18;
                            const kitGst = Math.round(taxable * (gstPct / 100));
                            const kitTotal = Math.round(taxable + kitGst);

                            return (
                              <React.Fragment key={sec.key}>
                                {/* PRESET HEADER BANNER WITH KIT VALUE */}
                                <tr style={{ backgroundColor: '#F0FDFA', borderTop: '2.5px solid #0E7490', borderBottom: '1.5px solid #A5F3FC' }}>
                                  <td colSpan={8} style={{ padding: '9px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                          backgroundColor: '#0E7490',
                                          color: '#FFFFFF',
                                          fontSize: '10.5px',
                                          fontWeight: '900',
                                          padding: '2.5px 8px',
                                          borderRadius: '6px',
                                          letterSpacing: '0.5px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}>
                                          <Boxes size={12} />
                                          PRESET {presetIdx + 1}
                                        </span>
                                        <strong style={{ fontSize: '13px', color: '#0F172A', fontWeight: '800' }}>
                                          {sec.presetName}
                                        </strong>
                                        <span style={{
                                          fontSize: '11px',
                                          color: '#0E7490',
                                          fontWeight: '700',
                                          backgroundColor: '#ECFEFF',
                                          padding: '2px 8px',
                                          borderRadius: '12px',
                                          border: '1px solid #A5F3FC'
                                        }}>
                                          Total Qty: {setCount} {pUnit} ({sec.items.length} components)
                                        </span>
                                      </div>

                                      <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        backgroundColor: '#FFFFFF',
                                        border: '1.5px solid #0E7490',
                                        borderRadius: '8px',
                                        padding: '4px 12px',
                                        boxShadow: '0 1px 3px rgba(14, 116, 144, 0.08)'
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                          <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>KIT VALUE:</span>
                                          <strong style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: '900' }}>
                                            ₹ {Math.round(taxable).toLocaleString('en-IN')}
                                          </strong>
                                        </div>
                                        <span style={{ color: '#CBD5E1', fontWeight: '300' }}>|</span>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                          <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: '800', textTransform: 'uppercase' }}>GST ({gstPct}%):</span>
                                          <strong style={{ fontSize: '11.5px', color: '#0F172A', fontWeight: '800' }}>
                                            ₹ {kitGst.toLocaleString('en-IN')}
                                          </strong>
                                        </div>
                                        <span style={{ color: '#CBD5E1', fontWeight: '300' }}>|</span>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                          <span style={{ fontSize: '9.5px', color: '#0E7490', fontWeight: '800', textTransform: 'uppercase' }}>TOTAL:</span>
                                          <strong style={{ fontSize: '13.5px', color: '#0E7490', fontWeight: '900' }}>
                                            ₹ {kitTotal.toLocaleString('en-IN')}
                                          </strong>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>

                                {/* Individual Component Items */}
                                {sec.items.map(({ item: it, originalIndex }, cIdx) => {
                                  const q = (parseFloat(it.totalDispatchQty) > 0 ? parseFloat(it.totalDispatchQty) : (parseFloat(it.qty || it.quantity || it.bomQty || 0) || 0));
                                  const r = parseFloat(it.rate || it.price || 0) || 0;
                                  const taxRateStr = String(it.gstRate || it.gst || '18%').replace('%', '').trim();
                                  const taxRate = parseFloat(taxRateStr) || gstPct;
                                  const hasExplicitRate = r > 0;
                                  const taxableItem = q * r;
                                  const itemTotal = taxableItem + (taxableItem * (taxRate / 100));

                                  return (
                                    <tr key={originalIndex} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: cIdx % 2 === 1 ? '#FAFDFD' : '#FFFFFF' }}>
                                      <td style={{ padding: '7px 10px', color: '#64748B', fontWeight: '700', textAlign: 'center' }}>
                                        {presetIdx + 1}.{cIdx + 1}
                                      </td>
                                      <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                                        <div>{it.name || it.productName || it.c2 || 'Item'}</div>
                                        {it.subPresetName && (
                                          <div style={{ fontSize: '10px', color: '#0D9488', fontWeight: '700', marginTop: '1px' }}>
                                            ↳ Sub-Kit: {it.subPresetName}
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ padding: '7px 10px', color: '#64748B', textAlign: 'center' }}>{it.hsn || it.hsn_or_sac || '73089090'}</td>
                                      <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>{q}</td>
                                      <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{it.uom || it.unit || 'NOS'}</td>
                                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                                        {hasExplicitRate ? (
                                          <span style={{ color: '#475569', fontWeight: '700' }}>₹ {r.toLocaleString('en-IN')}</span>
                                        ) : (
                                          <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '4px', border: '1px solid #CFFAFE' }}>
                                            Incl. in Kit
                                          </span>
                                        )}
                                      </td>
                                      <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{taxRate}%</td>
                                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                                        {hasExplicitRate ? (
                                          <strong style={{ color: '#0F172A' }}>₹ {Math.round(itemTotal).toLocaleString('en-IN')}</strong>
                                        ) : (
                                          <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '2px 7px', borderRadius: '4px', border: '1px solid #CFFAFE' }}>
                                            Incl. in Kit
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}

                                {/* END OF PRESET DIVIDER */}
                                <tr style={{ backgroundColor: '#F0FDFA', borderTop: '1px dashed #99F6E4', borderBottom: '2.5px solid #0E7490' }}>
                                  <td colSpan={8} style={{ padding: '8px 14px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                      <div style={{ height: '1.5px', flex: 1, backgroundColor: '#5EEAD4' }} />
                                      <span style={{
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        color: '#0F766E',
                                        backgroundColor: '#CCFBF1',
                                        padding: '3px 12px',
                                        borderRadius: '999px',
                                        border: '1px solid #99F6E4',
                                        letterSpacing: '0.4px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                      }}>
                                        ✓ END OF PRESET {presetIdx + 1}: {sec.presetName} ({sec.items.length} Components • Total Kit Value: ₹ {kitTotal.toLocaleString('en-IN')})
                                      </span>
                                      <div style={{ height: '1.5px', flex: 1, backgroundColor: '#5EEAD4' }} />
                                    </div>
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          }

                          // CUSTOM / STANDALONE PRODUCTS SECTION
                          const customSecTaxable = sec.items.reduce((sum, { item }) => {
                            const q = (parseFloat(item.totalDispatchQty) > 0 ? parseFloat(item.totalDispatchQty) : (parseFloat(item.qty || item.quantity || item.bomQty || 0) || 0));
                            const r = parseFloat(item.rate || item.price || 0) || 0;
                            return sum + (q * r);
                          }, 0);

                          return (
                            <React.Fragment key="custom_section">
                              <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2.5px solid #475569', borderBottom: '1.5px solid #CBD5E1' }}>
                                <td colSpan={8} style={{ padding: '9px 12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{
                                        backgroundColor: '#475569',
                                        color: '#FFFFFF',
                                        fontSize: '10.5px',
                                        fontWeight: '900',
                                        padding: '2.5px 8px',
                                        borderRadius: '6px',
                                        letterSpacing: '0.5px'
                                      }}>
                                        START OF NEW PRODUCTS (STANDALONE)
                                      </span>
                                      <strong style={{ fontSize: '13px', color: '#1E293B', fontWeight: '800' }}>
                                        Additional Materials / Standalone Products ({sec.items.length} items)
                                      </strong>
                                    </div>
                                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '700' }}>
                                      Individually Priced Components • Subtotal: ₹ {Math.round(customSecTaxable).toLocaleString('en-IN')}
                                    </span>
                                  </div>
                                </td>
                              </tr>

                              {sec.items.map(({ item: it, originalIndex }, cIdx) => {
                                const q = (parseFloat(it.totalDispatchQty) > 0 ? parseFloat(it.totalDispatchQty) : (parseFloat(it.qty || it.quantity || it.bomQty || 0) || 0));
                                const r = parseFloat(it.rate || it.price || 0) || 0;
                                const taxRateStr = String(it.gstRate || it.gst || '18%').replace('%', '').trim();
                                const taxRate = parseFloat(taxRateStr) || 18;
                                const taxableItem = q * r;
                                const itemTotal = taxableItem + (taxableItem * (taxRate / 100));

                                return (
                                  <tr key={originalIndex} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: cIdx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }}>
                                    <td style={{ padding: '7px 10px', color: '#64748B', fontWeight: '700', textAlign: 'center' }}>
                                      C.{cIdx + 1}
                                    </td>
                                    <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                                      <div>{it.name || it.productName || it.c2 || 'Item'}</div>
                                      {it.category && (
                                        <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>
                                          {it.category}
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ padding: '7px 10px', color: '#64748B', textAlign: 'center' }}>{it.hsn || it.hsn_or_sac || '73089090'}</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>{q}</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{it.uom || it.unit || 'NOS'}</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#334155', fontWeight: '700' }}>
                                      ₹ {r.toLocaleString('en-IN')}
                                    </td>
                                    <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748B' }}>{taxRate}%</td>
                                    <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                                      ₹ {Math.round(itemTotal).toLocaleString('en-IN')}
                                    </td>
                                  </tr>
                                );
                              })}

                              <tr style={{ backgroundColor: '#F8FAFC', borderTop: '1px dashed #CBD5E1', borderBottom: '2.5px solid #475569' }}>
                                <td colSpan={8} style={{ padding: '7px 14px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                    <div style={{ height: '1px', flex: 1, backgroundColor: '#CBD5E1' }} />
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#475569', letterSpacing: '0.4px' }}>
                                      ✓ END OF STANDALONE PRODUCTS ({sec.items.length} Items)
                                    </span>
                                    <div style={{ height: '1px', flex: 1, backgroundColor: '#CBD5E1' }} />
                                  </div>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={8} style={{ padding: '16px', textAlign: 'center', color: '#94A3B8' }}>
                            No individual line items listed.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            {/* Financial Summary */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '4px'
            }}>
              <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Subtotal (Taxable):</span>
                  <strong style={{ color: '#0F172A' }}>₹ {Math.round(orderSubTotal).toLocaleString('en-IN')}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                  <span>Estimated GST (18%):</span>
                  <strong style={{ color: '#0F172A' }}>₹ {Math.round(orderGstAmount).toLocaleString('en-IN')}</strong>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '2px solid #0E7490',
                  paddingTop: '6px',
                  fontSize: '14px',
                  color: '#0E7490'
                }}>
                  <span><strong>Total Order Value:</strong></span>
                  <strong style={{ fontSize: '15px' }}>₹ {Math.round(orderGrandTotal).toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>
          </div>
          {renderExportFormatModal()}
          {printingBomRecord && (
            <VRMBomPrintTemplate
              bomData={printingBomRecord}
              onClose={() => setPrintingBomRecord(null)}
              userRole={props.userRole || userRole || 'CEO'}
              isSales={true}
            />
          )}
        </div>
      );
}
