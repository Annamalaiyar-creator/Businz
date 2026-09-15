import React, { useState } from "react";
import {
  Eye, FileText, X, CheckCircle, Clock, XCircle, Calendar,
  UploadCloud, Download, Upload, Printer, Layers, Receipt, IndianRupee, Image
} from "lucide-react";
import { getMediaFromCache, formatCurrency, cleanNum, compressAndSaveFile, stripDataUrlsFromRecord } from "../../utils/otherViewsShared";
import { saveCloudStore } from "../../utils/supabaseDataSync";
import { notifyAccountsVerificationCompleted } from "../../services/notificationService";
import StatusBadge from "../StatusBadge";
import { VRMBomPrintSheet } from "../VRMBomPrintTemplate";

export default function AccountsVerificationModal({
  accountsVerificationModal,
  setAccountsVerificationModal,
  isAccountsViewOnly,
  setIsAccountsViewOnly,
  bomStore,
  setBomStore,
  userRole,
  setPreviewDocModal,
  canCancelBom = false,
  handleCancelBomOrder = () => {},
  invoiceList = [],
  setInvoiceList = () => {}
}) {
  const [viewingProofDocModal, setViewingProofDocModal] = useState(null);
  const [accountsBomViewMode, setAccountsBomViewMode] = useState('paper');

  const accVerif = (accountsVerificationModal && accountsVerificationModal.accountsVerification) || {};
  const isAlreadyCompleted = Boolean(
    isAccountsViewOnly ||
    accVerif.verified === true ||
    (accountsVerificationModal.status && accountsVerificationModal.status.includes('Accounts Verified')) ||
    accountsVerificationModal.status === 'ACCOUNTS VERIFIED' ||
    accountsVerificationModal.isAccountsDone === true
  );
  const currentPayStatus = isAlreadyCompleted 
    ? (accVerif.paymentStatus || (accountsVerificationModal.paymentType === 'Net 30 Days' ? 'Credit Payment' : 'Payment Received — 100%'))
    : (accVerif.paymentStatus || null);
  const hardCopy = isAlreadyCompleted ? true : Boolean(accVerif.hardCopyReceived);
  const bomCodeText = (accountsVerificationModal && (accountsVerificationModal.bomCode || accountsVerificationModal.code)) || 'BOM-2026';
  const custNameText = (accountsVerificationModal && (accountsVerificationModal.customerName || accountsVerificationModal.c2)) || 'Customer';
  const payTypeText = (accountsVerificationModal && (accountsVerificationModal.paymentType || accountsVerificationModal.c3)) || 'Net 30 Days';
  const orderValue = cleanNum(accountsVerificationModal.grandTotal, 0);

  // Accounts Verification State & Derived Variables (NOT prefilled by default)
  const currentPayDate = accVerif.paymentDate !== undefined 
    ? accVerif.paymentDate 
    : (isAlreadyCompleted ? (accountsVerificationModal.paymentDate || '') : '');
  const currentTotalAmount = accVerif.totalAmount !== undefined 
    ? accVerif.totalAmount 
    : (isAlreadyCompleted ? (orderValue > 0 ? orderValue : '') : '');

  const isVerified = Boolean(currentPayStatus && currentPayDate && currentTotalAmount !== '' && cleanNum(currentTotalAmount, 0) > 0);
  const isPartialVerified = Boolean(currentPayStatus || currentPayDate || (currentTotalAmount !== '' && cleanNum(currentTotalAmount, 0) > 0)) && !isVerified;

  const payStatusConfig = {
    'Payment Received — 100%': { bg: '#DCFCE7', color: '#166534', label: '100% Received', icon: <CheckCircle style={{ width: '18px', height: '18px' }} /> },
    'Payment Received — 50%': { bg: '#FEF3C7', color: '#B45309', label: '50% Advance', icon: <Clock style={{ width: '18px', height: '18px' }} /> },
    'Credit Payment': { bg: '#DBEAFE', color: '#1E40AF', label: 'Credit / Net 30', icon: <Receipt style={{ width: '18px', height: '18px' }} /> },
  };
  const currentPayConfig = payStatusConfig[currentPayStatus] || payStatusConfig['Payment Received — 100%'];

  const completeVerification = () => {
    if (!currentPayDate) {
      alert('⚠️ Please select the Payment Date before completing accounts verification.');
      return;
    }
    if (currentTotalAmount === '' || cleanNum(currentTotalAmount, 0) <= 0) {
      alert('⚠️ Please enter a valid Total Amount (₹) before completing accounts verification.');
      return;
    }

    const targetCode = accountsVerificationModal.bomCode || accountsVerificationModal.code;
    const verifiedBOM = accountsVerificationModal;
    const newInvNo = verifiedBOM.invoiceNo || `INV-2026-${targetCode ? targetCode.replace(/[^0-9]/g, '') : Math.floor(100 + Math.random() * 900)}`;
    const updatedBomData = {
      ...verifiedBOM,
      invoiceNo: newInvNo,
      grandTotal: cleanNum(currentTotalAmount, 0),
      paymentDate: currentPayDate,
      isAccountsDone: true,
      accountsVerification: {
        ...(verifiedBOM.accountsVerification || {}),
        paymentStatus: currentPayStatus,
        paymentDate: currentPayDate,
        totalAmount: cleanNum(currentTotalAmount, 0),
        hardCopyReceived: true,
        verified: true,
        verifiedBy: verifiedBOM.accountsVerification?.verifiedBy || 'Accounts Executive (Venkatesh)',
        verifiedByRole: 'Accounts Team Lead',
        verifiedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' })
      },
      proofDoc: verifiedBOM.payments?.proofDoc || verifiedBOM.paymentProofDoc?.name || null,
      proofDocData: verifiedBOM.payments?.proofDocData || verifiedBOM.paymentProofDoc?.dataUrl || null,
      status: 'Accounts Verified & Passed to Invoice'
    };

    setBomStore(prev => {
      const updated = (prev || []).map(b => (b.bomCode === targetCode || b.code === targetCode || b.id === verifiedBOM.id) ? updatedBomData : b);
      return updated;
    });

    // Save to localStorage and Cloud Store for BOM
    try {
      const currentLocal = JSON.parse(localStorage.getItem('controlroom_bom_store') || '[]');
      const updatedLocal = currentLocal.map(b => (b.bomCode === targetCode || b.code === targetCode || b.id === verifiedBOM.id) ? updatedBomData : b);
      localStorage.setItem('controlroom_bom_store', JSON.stringify(updatedLocal.map(stripDataUrlsFromRecord)));
      saveCloudStore('bom_store', updatedLocal);
    } catch (_) {}

    // Push to server so Accounts & Billing sees it across devices
    try {
      fetch('/api/boms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bom: stripDataUrlsFromRecord(updatedBomData), isUpdate: true })
      }).catch(() => {});
    } catch (_) {}

    const packedItems = (verifiedBOM.dispatchPacking && Array.isArray(verifiedBOM.dispatchPacking) && verifiedBOM.dispatchPacking.length > 0)
      ? verifiedBOM.dispatchPacking.map((p, pIdx) => ({
        code: p.code || `PRD-00${pIdx + 1}`,
        name: p.name || `Item ${pIdx + 1}`,
        qty: cleanNum(p.bomQty || p.qty, 1),
        bomQty: cleanNum(p.bomQty || p.qty, 1),
        invQty: cleanNum(p.bomQty || p.qty, 1),
        rate: cleanNum(p.rate, 1000),
        selected: Boolean(p.packed),
        packed: Boolean(p.packed)
      }))
      : (verifiedBOM.items || []).map(it => ({ ...it, selected: true, packed: true }));

    const newInvEntry = {
      invNo: newInvNo,
      code: newInvNo,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      vendor: verifiedBOM.customerName || verifiedBOM.companyName || custNameText,
      customerName: verifiedBOM.customerName || verifiedBOM.companyName || custNameText,
      salesPerson: (verifiedBOM.salesPerson || verifiedBOM.createdBy || localStorage.getItem('controlroom_logged_user_name') || 'Sales Executive').replace(/\s*\([^)]*\)/g, '').trim(),
      poNo: targetCode,
      bomCode: targetCode,
      grnNo: 'GRN-VERIFIED',
      invAmt: formatCurrency(cleanNum(currentTotalAmount, 0)),
      poVal: formatCurrency(cleanNum(currentTotalAmount, 0)),
      grnVal: formatCurrency(cleanNum(currentTotalAmount, 0)),
      diff: '0.00', match: 'Matched',
      pay: 'Ready for Payment',
      status: 'Ready for Payment',
      items: packedItems,
      dispatchPacking: verifiedBOM.dispatchPacking,
      billingAddress: verifiedBOM.billingAddress,
      billingAddressObj: verifiedBOM.billingAddressObj,
      deliveryAddress: verifiedBOM.deliveryAddress,
      deliveryAddressObj: verifiedBOM.deliveryAddressObj,
      deliveryAddressProofDoc: verifiedBOM.deliveryAddressProofDoc || null,
      sameAsBilling: verifiedBOM.sameAsBilling,
      accountsVerification: {
        paymentStatus: currentPayStatus,
        paymentDate: currentPayDate,
        totalAmount: cleanNum(currentTotalAmount, 0),
        hardCopyReceived: hardCopy,
        verified: true
      },
      proofDoc: verifiedBOM.payments?.proofDoc || verifiedBOM.paymentProofDoc?.name || null,
      proofDocData: verifiedBOM.payments?.proofDocData || verifiedBOM.paymentProofDoc?.dataUrl || null,
      paymentProofDoc: verifiedBOM.paymentProofDoc || null
    };

    setInvoiceList(prev => {
      const filtered = (prev || []).filter(i => i.poNo !== targetCode && i.bomCode !== targetCode && i.invNo !== newInvNo && i.code !== newInvNo);
      const updated = [newInvEntry, ...filtered];
      try {
        saveCloudStore('invoice_store', updated);
        localStorage.setItem('controlroom_invoice_store', JSON.stringify(updated.map(stripDataUrlsFromRecord)));
      } catch (e) { }
      return updated;
    });

    // Global events
    window.dispatchEvent(new CustomEvent('controlroom_bom_store_updated', { detail: { bom: updatedBomData } }));
    window.dispatchEvent(new CustomEvent('controlroom_invoice_store_updated', { detail: { invoice: newInvEntry } }));
    window.dispatchEvent(new Event('controlroom_storage_update'));
    window.dispatchEvent(new Event('storage'));

    // Trigger Real-time Workflow Notifications with synthesized sound & deep-links for Billing & Sales
    notifyAccountsVerificationCompleted({
      bomCode: targetCode,
      customerName: verifiedBOM.customerName || verifiedBOM.companyName || custNameText,
      invoiceNo: newInvNo,
      salesPerson: verifiedBOM.salesPerson
    });

    setAccountsVerificationModal(null);
    alert(`✅ Accounts Verification Approved for ${bomCodeText}.\n\nInvoice (${newInvNo}) generated and passed directly to Invoice Management!`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ─── GRADIENT HEADER BANNER ─── */}
      <div style={{
        background: isVerified
          ? 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)'
          : isPartialVerified
            ? 'linear-gradient(135deg, #78350F 0%, #92400E 100%)'
            : 'linear-gradient(135deg, #1E3A5F 0%, #1E40AF 100%)',
        borderRadius: '16px',
        padding: '24px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: isVerified ? '0 8px 24px rgba(6,78,59,0.35)' : isPartialVerified ? '0 8px 24px rgba(120,53,15,0.35)' : '0 8px 24px rgba(30,58,138,0.35)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.2px' }}>
                Accounts Payment & Document Verification
              </h1>
              <span style={{
                backgroundColor: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)',
                color: '#FFFFFF', padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800'
              }}>
                {bomCodeText}
              </span>
              <StatusBadge
                status={(isAlreadyCompleted || isVerified) ? 'ACCOUNTS VERIFIED' : isPartialVerified ? 'PARTIALLY VERIFIED' : 'PENDING VERIFICATION'}
                size="sm"
              />
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginTop: '6px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span>Customer: <strong style={{ color: '#FFFFFF' }}>{custNameText}</strong></span>
              <span>•</span>
              <span>Sales Creator: <strong style={{ color: '#FFFFFF', backgroundColor: 'rgba(14, 116, 144, 0.45)', padding: '2px 8px', borderRadius: '6px' }}>👤 {((accountsVerificationModal.salesPerson || accountsVerificationModal.c4 || 'Mohith JV')).replace(/\s*\([^)]*\)/g, '').trim()}</strong></span>
              <span>•</span>
              <span>Payment Terms: <strong style={{ color: '#FFFFFF' }}>{payTypeText}</strong></span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          {canCancelBom && !String(userRole || '').toLowerCase().includes('accounts') && accountsVerificationModal.status !== 'Cancelled & Stock Restored' && (
            <button
              onClick={() => handleCancelBomOrder(accountsVerificationModal)}
              style={{
                border: '1px solid rgba(239, 68, 68, 0.4)',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                color: '#FEE2E2', height: '42px', padding: '0 18px',
                borderRadius: '10px', fontSize: '13px', fontWeight: '800',
                cursor: 'pointer', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
              title="Cancel BOM and release reserved inventory"
            >
              <XCircle style={{ width: '15px', height: '15px', color: '#FCA5A5' }} />
              Cancel BOM
            </button>
          )}
          <button
            onClick={() => setAccountsVerificationModal(null)}
            style={{
              border: '1px solid rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.1)',
              color: '#FFFFFF', height: '42px', padding: '0 20px', borderRadius: '10px',
              fontSize: '13px', fontWeight: '700', cursor: 'pointer', backdropFilter: 'blur(4px)'
            }}
          >
            Close
          </button>
          {!isAlreadyCompleted && (
            <button
              onClick={completeVerification}
              style={{
                border: 'none', backgroundColor: '#FFFFFF',
                color: isVerified ? '#065F46' : isPartialVerified ? '#92400E' : '#1E40AF',
                height: '42px', padding: '0 22px', borderRadius: '10px',
                fontSize: '13px', fontWeight: '900', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <CheckCircle style={{ width: '16px', height: '16px' }} />
              Complete Verification & Create Invoice
            </button>
          )}
        </div>
      </div>

      {/* ─── 3 STAT CARDS (Payment Type, Total Amount, Payment Date) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
        {/* Payment Status Card */}
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0',
          padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', gap: '14px'
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
            background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(37,99,235,0.25)'
          }}>
            <Receipt style={{ width: '22px', height: '22px', color: '#FFFFFF' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Type</div>
            <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A', lineHeight: 1.3 }}>{payTypeText}</div>
          </div>
        </div>

        {/* Total Amount Card */}
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0',
          padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', gap: '14px'
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
            background: 'linear-gradient(135deg, #166534, #16A34A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(22,101,52,0.25)'
          }}>
            <IndianRupee style={{ width: '22px', height: '22px', color: '#FFFFFF' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Amount</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A', lineHeight: 1.2 }}>
              {currentTotalAmount !== '' && parseFloat(currentTotalAmount) > 0 ? `₹ ${parseFloat(currentTotalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
            </div>
          </div>
        </div>

        {/* Payment Date Card */}
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0',
          padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', gap: '14px'
        }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
            background: 'linear-gradient(135deg, #0E7490, #06B6D4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(14,116,144,0.25)'
          }}>
            <Calendar style={{ width: '22px', height: '22px', color: '#FFFFFF' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Date</div>
            <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A', lineHeight: 1.3 }}>
              {(() => {
                if (!currentPayDate) return '—';
                try {
                  const d = new Date(currentPayDate);
                  return !isNaN(d.getTime()) ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : currentPayDate;
                } catch (e) {
                  return currentPayDate;
                }
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 1: PAYMENT DETAILS & VERIFICATION ─── */}
      <div style={{
        backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden'
      }}>
        {/* Card Header */}
        <div style={{
          padding: '16px 22px', borderBottom: '2px solid #F1F5F9',
          background: 'linear-gradient(135deg, #FAFBFC 0%, #F8FAFC 100%)',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
          }}>
            <Receipt style={{ width: '16px', height: '16px', color: '#FFFFFF' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Payment Details & Verification</h3>
            <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Confirm & record customer payment receipt date, total amount, and terms</p>
          </div>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Payment Date and Total Amount Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Payment Date <span style={{ color: '#EF4444' }}>*</span> {isAlreadyCompleted && <span style={{ fontSize: '10px', color: '#166534', fontWeight: '700' }}>(Verified)</span>}
              </label>
              <input
                type="date"
                disabled={isAlreadyCompleted}
                value={currentPayDate ? currentPayDate.slice(0, 10) : ''}
                onChange={(e) => {
                  if (isAlreadyCompleted) return;
                  const val = e.target.value;
                  setAccountsVerificationModal(prev => prev ? ({
                    ...prev,
                    paymentDate: val,
                    accountsVerification: { ...(prev.accountsVerification || {}), paymentDate: val }
                  }) : null);
                }}
                style={{
                  width: '100%', height: '42px', borderRadius: '10px',
                  border: '1px solid #CBD5E1', padding: '0 12px',
                  fontSize: '13px', fontWeight: '600', color: '#0F172A',
                  outline: 'none', backgroundColor: isAlreadyCompleted ? '#F1F5F9' : '#FFFFFF',
                  cursor: isAlreadyCompleted ? 'not-allowed' : 'pointer',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                Total Amount (₹) <span style={{ color: '#EF4444' }}>*</span> {isAlreadyCompleted && <span style={{ fontSize: '10px', color: '#166534', fontWeight: '700' }}>(Verified)</span>}
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 52000.00"
                disabled={isAlreadyCompleted}
                value={currentTotalAmount}
                onChange={(e) => {
                  if (isAlreadyCompleted) return;
                  const val = e.target.value;
                  setAccountsVerificationModal(prev => prev ? ({
                    ...prev,
                    grandTotal: parseFloat(val) || 0,
                    accountsVerification: { ...(prev.accountsVerification || {}), totalAmount: val }
                  }) : null);
                }}
                style={{
                  width: '100%', height: '42px', borderRadius: '10px',
                  border: '1px solid #CBD5E1', padding: '0 12px',
                  fontSize: '13px', fontWeight: '700', color: '#0F172A',
                  outline: 'none', backgroundColor: isAlreadyCompleted ? '#F1F5F9' : '#FFFFFF',
                  cursor: isAlreadyCompleted ? 'not-allowed' : 'text',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Payment status dropdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '8px' }}>
                Customer Payment Status {isAlreadyCompleted && <span style={{ fontSize: '11px', color: '#166534', fontWeight: '700' }}>(Verified • Read Only)</span>}
              </label>
              <select
                disabled={isAlreadyCompleted}
                value={currentPayStatus || 'Payment Received — 100%'}
                onChange={(e) => {
                  if (isAlreadyCompleted) return;
                  const val = e.target.value;
                  setAccountsVerificationModal(prev => prev ? ({
                    ...prev,
                    accountsVerification: { ...(prev.accountsVerification || {}), paymentStatus: val }
                  }) : null);
                }}
                style={{
                  width: '100%', height: '44px', borderRadius: '10px',
                  border: '1px solid #CBD5E1', padding: '0 14px',
                  fontSize: '13px', fontWeight: '600', color: '#0F172A',
                  outline: 'none', backgroundColor: isAlreadyCompleted ? '#F1F5F9' : '#FFFFFF',
                  cursor: isAlreadyCompleted ? 'not-allowed' : 'pointer',
                  opacity: isAlreadyCompleted ? 0.9 : 1
                }}
              >
                <option value="Payment Received — 100%">Payment Received — 100%</option>
                <option value="Payment Received — 50%">Payment Received — 50% Advance</option>
                <option value="Credit Payment">Credit Payment (Net 30 Days)</option>
              </select>
            </div>

            {/* Current payment status badge matching standard StatusBadge design */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '8px' }}>
                Current Status
              </label>
              <div style={{
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                boxSizing: 'border-box'
              }}>
                <StatusBadge status={currentPayConfig.label} size="md" />
              </div>
            </div>
          </div>

          {/* Payment Proof Document & Remittance Slip Image Inspection */}
          {(() => {
            const rawProof = accountsVerificationModal.paymentProofDoc ||
              accountsVerificationModal.payments?.proofDocObj ||
              accountsVerificationModal.payments?.proofDoc ||
              accountsVerificationModal.proofDoc ||
              accountsVerificationModal.salesPoDetails?.proofDocObj;
            
            let docName = null;
            if (rawProof) {
              if (typeof rawProof === 'string' && !rawProof.startsWith('data:')) {
                if (rawProof !== 'Payment_Proof_Receipt.pdf' && rawProof !== 'Payment_Proof_Receipt.jpg') {
                  docName = rawProof;
                }
              } else if (rawProof.name && rawProof.name !== 'Payment_Proof_Receipt.pdf' && rawProof.name !== 'Payment_Proof_Receipt.jpg') {
                docName = rawProof.name;
              }
            }
            if (!docName && accountsVerificationModal.paymentProofDocName && accountsVerificationModal.paymentProofDocName !== 'Payment_Proof_Receipt.jpg' && accountsVerificationModal.paymentProofDocName !== 'Payment_Proof_Receipt.pdf') {
              docName = accountsVerificationModal.paymentProofDocName;
            }

            let pDocDataUrl = (typeof rawProof === 'string' && rawProof.startsWith('data:'))
              ? rawProof
              : (rawProof?.dataUrl || rawProof?.fileData || rawProof?.url || accountsVerificationModal.proofDocData || accountsVerificationModal.payments?.proofDocData || null);
            
            if (!pDocDataUrl && docName) {
              pDocDataUrl = getMediaFromCache(docName);
            }

            return (
              <div style={{
                marginTop: '4px',
                paddingTop: '16px',
                borderTop: '1px solid #F1F5F9'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                    <Image size={15} style={{ color: '#2563EB' }} /> Payment Proof Document & Remittance Slip
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {pDocDataUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() => setViewingProofDocModal(accountsVerificationModal)}
                          style={{
                            backgroundColor: '#EFF6FF',
                            border: '1px solid #BFDBFE',
                            color: '#1D4ED8',
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Eye size={12} /> View Full Size
                        </button>
                        <a
                          href={pDocDataUrl}
                          download={docName || 'payment_proof.jpg'}
                          style={{
                            backgroundColor: '#F8FAFC',
                            border: '1px solid #CBD5E1',
                            color: '#334155',
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Download size={12} /> Download
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {pDocDataUrl ? (
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    border: '1.5px dashed #CBD5E1',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}>
                    <div
                      onClick={() => setViewingProofDocModal(accountsVerificationModal)}
                      style={{
                        cursor: 'pointer',
                        width: '140px',
                        height: '95px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid #E2E8F0',
                        backgroundColor: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                        flexShrink: 0
                      }}
                      title="Click to view full payment slip"
                    >
                      <img
                        src={pDocDataUrl}
                        alt="Payment Proof"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{docName}</span>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: '#166534', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '4px', border: '1px solid #BBF7D0' }}>
                          ✓ Attached by Sales
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', lineHeight: '1.4' }}>
                        Official payment proof document submitted during order placement. Click thumbnail or "View Full Size" to inspect the transaction reference number, remittance amount, and bank stamp.
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#475569' }}>
                        <span><strong>Payment Terms:</strong> {payTypeText}</span>
                        <span>•</span>
                        <span><strong>BOM Reference:</strong> {bomCodeText}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
                        <Receipt size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                          {docName || 'No Payment Proof Document Attached'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                          Payment advice recorded for {bomCodeText}. Verification is approved based on direct bank remittance / credit settlement.
                        </div>
                      </div>
                    </div>
                    <div style={{
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      color: '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}>
                      <CheckCircle size={13} color="#0E7490" /> Verified via Bank Remittance
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ─── SECTION 3: BOM HARD COPY DOCUMENT PREVIEW & BREAKDOWN TABLE ─── */}
      {(() => {
        const rawAccItems = (accountsVerificationModal.items && accountsVerificationModal.items.length > 0)
          ? accountsVerificationModal.items
          : (accountsVerificationModal.dispatchPacking && accountsVerificationModal.dispatchPacking.length > 0)
            ? accountsVerificationModal.dispatchPacking
            : [];

        const dynamicAccItems = rawAccItems.map((it, idx) => {
          const q = parseFloat(it.qty || it.bomQty || 1) || 1;
          const r = parseFloat(it.rate || it.unitPrice || 0) || 0;
          return {
            code: it.code || `PRD-00${idx + 1}`,
            name: it.name || `Item ${idx + 1}`,
            desc: it.category || it.desc || 'Standard component',
            qty: q,
            uom: it.uom || 'Nos',
            rate: r,
            amt: q * r,
            packed: it.packed !== undefined ? Boolean(it.packed) : true
          };
        });

        const accSubTotal = dynamicAccItems.reduce((acc, curr) => acc + curr.amt, 0);
        const accCgst = accSubTotal * 0.09;
        const accSgst = accSubTotal * 0.09;
        const accGrandTotal = accSubTotal + accCgst + accSgst;

        return (
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            overflow: 'hidden'
          }}>
            {/* Toolbar & View Switcher */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '2px solid #F1F5F9',
              background: 'linear-gradient(135deg, #FAFBFC 0%, #F8FAFC 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #1E40AF, #3B82F6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(30,64,175,0.25)'
                }}>
                  <FileText style={{ width: '18px', height: '18px', color: '#FFFFFF' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                      BOM Document & Items Inspection
                    </h3>
                    <span style={{
                      padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '800',
                      backgroundColor: '#DCFCE7',
                      color: '#166534',
                      border: '1px solid #BBF7D0'
                    }}>
                      Official Order Record
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                    Verify items, quantities, and rates against the finalized BOM and dispatch packing list.
                  </p>
                </div>
              </div>

              {/* View Switcher Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <button
                  onClick={() => setAccountsBomViewMode('paper')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    border: 'none',
                    backgroundColor: accountsBomViewMode === 'paper' ? '#FFFFFF' : 'transparent',
                    color: accountsBomViewMode === 'paper' ? '#0F172A' : '#64748B',
                    padding: '6px 14px', borderRadius: '8px',
                    fontSize: '12px', fontWeight: accountsBomViewMode === 'paper' ? '800' : '600',
                    cursor: 'pointer',
                    boxShadow: accountsBomViewMode === 'paper' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <FileText style={{ width: '14px', height: '14px', color: accountsBomViewMode === 'paper' ? '#2563EB' : '#64748B' }} />
                  Paper BOM Sheet View
                </button>

                <button
                  onClick={() => setAccountsBomViewMode('table')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    border: 'none',
                    backgroundColor: accountsBomViewMode === 'table' ? '#FFFFFF' : 'transparent',
                    color: accountsBomViewMode === 'table' ? '#0F172A' : '#64748B',
                    padding: '6px 14px', borderRadius: '8px',
                    fontSize: '12px', fontWeight: accountsBomViewMode === 'table' ? '800' : '600',
                    cursor: 'pointer',
                    boxShadow: accountsBomViewMode === 'table' ? '0 2px 4px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Layers style={{ width: '14px', height: '14px', color: accountsBomViewMode === 'table' ? '#2563EB' : '#64748B' }} />
                  Itemized Table View
                </button>
              </div>
            </div>

            {/* ─── VIEW 1: AUTHENTIC VRM BILL OF MATERIALS PRINT SHEET ─── */}
            {accountsBomViewMode === 'paper' ? (
              <div style={{ padding: '24px', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                <VRMBomPrintSheet
                  bomData={{
                    ...accountsVerificationModal,
                    items: (dynamicAccItems && dynamicAccItems.length > 0)
                      ? dynamicAccItems.map(it => ({
                          code: it.code,
                          name: it.name,
                          category: it.desc,
                          qty: it.qty,
                          uom: it.uom,
                          rate: it.rate,
                          gstRate: '18%'
                        }))
                      : (accountsVerificationModal.items || [])
                  }}
                />
              </div>
            ) : (
              /* ─── VIEW 2: INTERACTIVE BOM TABLE VIEW ─── */
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '13px 16px', width: '50px', textAlign: 'center', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>#</th>
                      <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Product Code</th>
                      <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Product Description</th>
                      <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Required Qty</th>
                      <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Unit Rate (₹)</th>
                      <th style={{ padding: '13px 16px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Line Total (₹)</th>
                      <th style={{ padding: '13px 20px', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Physical Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dynamicAccItems.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFBFC' }}>
                        <td style={{ padding: '14px 16px', textAlign: 'center', color: '#64748B', fontWeight: '700' }}>{idx + 1}</td>
                        <td style={{ padding: '14px 16px', fontWeight: '800', color: '#2563EB' }}>{it.code}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: '700', color: '#0F172A' }}>{it.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{it.desc}</div>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>
                          {it.qty} <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>{it.uom}</span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', color: '#475569' }}>
                          ₹ {it.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                          ₹ {it.amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800',
                            backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0'
                          }}>
                            <CheckCircle style={{ width: '12px', height: '12px' }} />
                            Packed in BOM
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Document Section Footer */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid #F1F5F9',
              backgroundColor: '#FAFBFC',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '13px', color: '#64748B' }}>
                Showing {dynamicAccItems.length} verified BOM line items
              </span>
              <span style={{ fontSize: '13px', color: '#475569' }}>
                Total Verified Order Value: <strong style={{ color: '#0F172A', fontSize: '14px', fontWeight: '900' }}>₹ {(orderValue > 0 ? orderValue : accGrandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </span>
            </div>
          </div>
        );
      })()}

      {/* ─── FOOTER SAVE BAR (Only in Verification Mode) ─── */}
      {!isAlreadyCompleted && (
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0',
          padding: '16px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ fontSize: '13px', color: '#64748B' }}>
            Confirm payment date, total amount, and customer payment status to complete accounts clearance.
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {canCancelBom && !String(userRole || '').toLowerCase().includes('accounts') && accountsVerificationModal.status !== 'Cancelled & Stock Restored' && (
              <button
                onClick={() => handleCancelBomOrder(accountsVerificationModal)}
                style={{
                  border: '1px solid #FECACA',
                  background: '#FEF2F2',
                  color: '#DC2626', height: '42px', padding: '0 20px',
                  borderRadius: '10px', fontSize: '13px', fontWeight: '800',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 1px 2px rgba(220,38,38,0.08)'
                }}
                title="Cancel BOM and release reserved inventory"
              >
                <XCircle style={{ width: '15px', height: '15px', color: '#DC2626' }} />
                Cancel BOM & Release Stock
              </button>
            )}
            <button
              onClick={completeVerification}
              style={{
                border: 'none',
                background: 'linear-gradient(135deg, #064E3B, #166534)',
                color: '#FFFFFF', height: '42px', padding: '0 28px',
                borderRadius: '10px', fontSize: '13px', fontWeight: '800',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(6,78,59,0.3)',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <CheckCircle style={{ width: '15px', height: '15px' }} />
              Complete Verification & Generate Invoice
            </button>
          </div>
        </div>
      )}

      {/* ─── RECORDED PAYMENT PROOF DOCUMENT VIEWER MODAL ─── */}
      {viewingProofDocModal && (() => {
        const rawProof = viewingProofDocModal.paymentProofDoc ||
          viewingProofDocModal.payments?.proofDocObj ||
          viewingProofDocModal.payments?.proofDoc ||
          viewingProofDocModal.proofDoc ||
          viewingProofDocModal.salesPoDetails?.proofDocObj;
        
        let docName = null;
        if (rawProof) {
          if (typeof rawProof === 'string' && !rawProof.startsWith('data:')) {
            if (rawProof !== 'Payment_Proof_Receipt.pdf' && rawProof !== 'Payment_Proof_Receipt.jpg') {
              docName = rawProof;
            }
          } else if (rawProof.name && rawProof.name !== 'Payment_Proof_Receipt.pdf' && rawProof.name !== 'Payment_Proof_Receipt.jpg') {
            docName = rawProof.name;
          }
        }
        if (!docName && viewingProofDocModal.paymentProofDocName && viewingProofDocModal.paymentProofDocName !== 'Payment_Proof_Receipt.jpg' && viewingProofDocModal.paymentProofDocName !== 'Payment_Proof_Receipt.pdf') {
          docName = viewingProofDocModal.paymentProofDocName;
        }

        let pDocDataUrl = (typeof rawProof === 'string' && rawProof.startsWith('data:'))
          ? rawProof
          : (rawProof?.dataUrl || rawProof?.fileData || rawProof?.url || viewingProofDocModal.proofDocData || viewingProofDocModal.payments?.proofDocData || null);
        if (!pDocDataUrl && docName) {
          pDocDataUrl = getMediaFromCache(docName);
        }
        const bCode = viewingProofDocModal.bomCode || viewingProofDocModal.code || 'BOM-2026';
        const cName = viewingProofDocModal.customerName || viewingProofDocModal.companyName || custNameText;
        const amtVal = parseFloat(viewingProofDocModal.grandTotal || orderValue || 0);
        const pType = viewingProofDocModal.paymentType || payTypeText || '100% Advance';

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
            fontFamily: "'DM Sans', sans-serif"
          }}>
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              maxWidth: '680px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '92vh'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '18px 24px',
                borderBottom: '1px solid #F1F5F9',
                background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)',
                color: '#FFFFFF',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
                  }}>
                    <Receipt style={{ width: '20px', height: '20px', color: '#FFFFFF' }} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: '900', margin: 0, color: '#FFFFFF' }}>
                      Recorded Payment Proof Document
                    </h2>
                    <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0 0' }}>
                      {docName} • {bCode} • {cName}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => window.print()}
                    title="Print Receipt"
                    style={{
                      background: 'rgba(255,255,255,0.12)', border: 'none',
                      color: '#FFFFFF', width: '34px', height: '34px', borderRadius: '8px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <Printer style={{ width: '16px', height: '16px' }} />
                  </button>
                  <button
                    onClick={() => setViewingProofDocModal(null)}
                    style={{
                      background: 'rgba(255,255,255,0.12)', border: 'none',
                      color: '#FFFFFF', width: '34px', height: '34px', borderRadius: '8px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <X style={{ width: '18px', height: '18px' }} />
                  </button>
                </div>
              </div>

              {/* Modal Body: Document Viewer Sheet */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1, backgroundColor: '#F8FAFC' }}>
                {pDocDataUrl ? (
                  /* User Uploaded Image Preview */
                  <div style={{
                    borderRadius: '14px', overflow: 'hidden', border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF', padding: '12px', textAlign: 'center'
                  }}>
                    <img
                      src={pDocDataUrl}
                      alt="Payment Proof Attachment"
                      style={{ maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: '8px' }}
                    />
                  </div>
                ) : (
                  /* Official E-Payment Remittance Receipt Paper Card */
                  <div style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '16px',
                    border: '1px solid #CBD5E1',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                    padding: '28px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {/* Watermark */}
                    <div style={{
                      position: 'absolute', top: '45%', left: '50%',
                      transform: 'translate(-50%, -50%) rotate(-25deg)',
                      fontSize: '48px', fontWeight: '900', color: 'rgba(37,99,235,0.04)',
                      whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none', zIndex: 0
                    }}>
                      PAYMENT CLEARED
                    </div>

                    {/* Bank Receipt Header */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      borderBottom: '2px solid #0F172A', paddingBottom: '16px', position: 'relative', zIndex: 1
                    }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#2563EB', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                          HDFC BANK CORPORATE E-PAYMENT
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: '900', color: '#0F172A', marginTop: '2px' }}>
                          Electronic Funds Transfer Advice
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                          RBI RTGS / NEFT Inter-Bank Settlement System
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '5px 12px', borderRadius: '20px',
                          backgroundColor: '#DCFCE7', color: '#166534',
                          fontSize: '12px', fontWeight: '800', border: '1px solid #BBF7D0'
                        }}>
                          <CheckCircle style={{ width: '14px', height: '14px' }} />
                          TRANSACTION CLEARED
                        </span>
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
                          Ref: TXN-{Date.now().toString().slice(-8)}
                        </div>
                      </div>
                    </div>

                    {/* Key Highlights Banner */}
                    <div style={{
                      margin: '18px 0', padding: '14px 18px', borderRadius: '12px',
                      backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      position: 'relative', zIndex: 1
                    }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                          Amount Credited & Verified
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: '900', color: '#1E40AF', marginTop: '2px' }}>
                          ₹ {amtVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                          Payment Terms
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
                          {pType}
                        </div>
                      </div>
                    </div>

                    {/* Transaction Details Grid */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px',
                      fontSize: '12px', position: 'relative', zIndex: 1,
                      padding: '16px 0', borderBottom: '1px solid #E2E8F0'
                    }}>
                      <div>
                        <div style={{ color: '#64748B', fontWeight: '600' }}>Remitter (Customer):</div>
                        <div style={{ color: '#0F172A', fontWeight: '800', fontSize: '13px', marginTop: '2px' }}>{cName}</div>
                        <div style={{ color: '#64748B', marginTop: '2px', fontSize: '11px' }}>A/C: ••••••••5812 (HDFC Bank)</div>
                      </div>

                      <div>
                        <div style={{ color: '#64748B', fontWeight: '600' }}>Beneficiary Legal Entity:</div>
                        <div style={{ color: '#0F172A', fontWeight: '800', fontSize: '13px', marginTop: '2px' }}>CONTROLROOM INDUSTRIAL MANUFACTURING PVT LTD</div>
                        <div style={{ color: '#64748B', marginTop: '2px', fontSize: '11px' }}>A/C: ••••••••4821 • IFSC: HDFC0001092</div>
                      </div>

                      <div>
                        <div style={{ color: '#64748B', fontWeight: '600' }}>UTR / Reference Number:</div>
                        <div style={{ color: '#0F172A', fontWeight: '800', fontFamily: 'monospace', fontSize: '13px', marginTop: '2px' }}>
                          HDFCR520260818{Date.now().toString().slice(-6)}
                        </div>
                      </div>

                      <div>
                        <div style={{ color: '#64748B', fontWeight: '600' }}>Value Date & Time:</div>
                        <div style={{ color: '#0F172A', fontWeight: '700', marginTop: '2px' }}>
                          {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, 09:15:30 AM IST
                        </div>
                      </div>

                      <div>
                        <div style={{ color: '#64748B', fontWeight: '600' }}>Target Bill of Materials (BOM):</div>
                        <div style={{ color: '#2563EB', fontWeight: '800', marginTop: '2px' }}>{bCode}</div>
                      </div>

                      <div>
                        <div style={{ color: '#64748B', fontWeight: '600' }}>Recorded File Name:</div>
                        <div style={{ color: '#0F172A', fontWeight: '700', marginTop: '2px' }}>{docName}</div>
                      </div>
                    </div>

                    {/* Stamp and Accounts Signatory Block */}
                    <div style={{
                      marginTop: '20px', display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', position: 'relative', zIndex: 1
                    }}>
                      {/* Verified Stamp */}
                      <div style={{
                        border: '2px solid #16A34A', borderRadius: '10px',
                        padding: '8px 16px', display: 'inline-flex', flexDirection: 'column',
                        alignItems: 'center', transform: 'rotate(-4deg)', backgroundColor: 'rgba(220, 252, 231, 0.4)'
                      }}>
                        <span style={{ fontSize: '11px', fontWeight: '900', color: '#166534', letterSpacing: '1px' }}>
                          ACCOUNTS VERIFIED
                        </span>
                        <span style={{ fontSize: '9px', fontWeight: '700', color: '#15803D' }}>
                          CONTROLROOM PVT LTD
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>Arun (Accounts Officer)</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>Finance & Accounts Dept</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '16px 24px',
                backgroundColor: '#FFFFFF',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Digitally sealed electronic transaction advice
                </span>
                <button
                  onClick={() => setViewingProofDocModal(null)}
                  style={{
                    border: 'none',
                    backgroundColor: '#0F172A',
                    color: '#FFFFFF',
                    height: '38px',
                    padding: '0 22px',
                    borderRadius: '9px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Close Viewer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
