import React, { useState, useEffect } from "react";
import {
  Eye, FileText, X, CheckCircle, Clock, XCircle, Calendar,
  UploadCloud, Download, Upload, Printer, Layers, Receipt, IndianRupee, Image,
  Loader2, ExternalLink, AlertTriangle, User, Truck, Package, ShieldCheck, BellRing,
  ChevronLeft
} from "lucide-react";
import { getMediaFromCache, getMediaFromCacheAsync, saveMediaToCache, formatCurrency, cleanNum, compressAndSaveFile, stripDataUrlsFromRecord } from "../../utils/otherViewsShared";
import { resolveDocumentUrl, resolveDocumentUrlAsync } from "../../utils/documentResolver";
import { saveCloudStore, saveCloudBomRow, saveCloudInvoiceRow } from "../../utils/supabaseDataSync";
import { notifyAccountsVerificationCompleted } from "../../services/notificationService";
import { notifySalesForMissingPaymentProof } from "../../utils/salesAlertHelper";
import { supabase } from "../../supabaseClient";
import StatusBadge from "../StatusBadge";
import { extractGstRate } from "../../utils/gstHelper";
// VRMBomPrintSheet removed per user mandate: strictly display itemized interactive BOM table with centered kit pricing in accounts login

function ResilientDocThumbnail({ docUrl, docName, isPdf, fallbackColor = '#2563EB', alt = 'Document' }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(docUrl);

  useEffect(() => {
    setCurrentUrl(docUrl);
    setLoadFailed(false);
  }, [docUrl]);

  if (isPdf) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#DC2626' }}>
        <FileText size={30} />
        <span style={{ fontSize: '10px', fontWeight: '800' }}>PDF Document</span>
        <span style={{ fontSize: '9px', color: '#64748B' }}>Click to View</span>
      </div>
    );
  }

  if (currentUrl && !loadFailed) {
    return (
      <img
        src={currentUrl}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        onError={() => {
          if (docName) {
            fetch(`/api/media/find/${encodeURIComponent(docName)}`)
              .then(r => r.json())
              .then(data => {
                if (data?.found && data?.url) {
                  const clean = data.url.startsWith('/uploads/') ? `/api${data.url}` : data.url;
                  setCurrentUrl(clean);
                } else {
                  setLoadFailed(true);
                }
              })
              .catch(() => setLoadFailed(true));
          } else {
            setLoadFailed(true);
          }
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: fallbackColor, textAlign: 'center', padding: '4px' }}>
      <FileText size={26} />
      <span style={{ fontSize: '10px', fontWeight: '800', color: '#0F172A', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {docName || 'Document'}
      </span>
      <span style={{ fontSize: '9px', color: fallbackColor, fontWeight: '700' }}>Click to View</span>
    </div>
  );
}

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
  setInvoiceList = () => {},
  showCustomAlert
}) {
  const [viewingProofDocModal, setViewingProofDocModal] = useState(null);
  const [resolvedProofDataUrl, setResolvedProofDataUrl] = useState(null);
  const [isResolvingProof, setIsResolvingProof] = useState(false);
  const [showAdjustPayment, setShowAdjustPayment] = useState(false);

  // Dynamic mobile viewport detection
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let active = true;
    if (!accountsVerificationModal) {
      setResolvedProofDataUrl(null);
      setIsResolvingProof(false);
      return;
    }

    const bCode = accountsVerificationModal.bomCode || accountsVerificationModal.code;

    // 1. Resolve Payment / Remittance Proof
    const rawProof = accountsVerificationModal.paymentProofDoc ||
      accountsVerificationModal.balancePaymentProofDoc ||
      accountsVerificationModal.balanceProofDoc ||
      accountsVerificationModal.payments?.proofDocObj ||
      accountsVerificationModal.payments?.balanceProofDocObj ||
      accountsVerificationModal.payments?.proofDoc ||
      accountsVerificationModal.payments?.balanceProofDoc ||
      accountsVerificationModal.proofDoc ||
      accountsVerificationModal.salesPoDetails?.proofDocObj ||
      accountsVerificationModal.salesPoDetails?.balanceProofDocObj;

    let docName = null;
    if (rawProof) {
      if (typeof rawProof === 'string' && !rawProof.startsWith('data:')) {
        docName = rawProof;
      } else if (rawProof.name) {
        docName = rawProof.name;
      } else if (rawProof.originalName) {
        docName = rawProof.originalName;
      }
    }
    if (!docName && accountsVerificationModal.paymentProofDocName) {
      docName = accountsVerificationModal.paymentProofDocName;
    }
    if (!docName && accountsVerificationModal.payments?.proofDoc) {
      docName = accountsVerificationModal.payments.proofDoc;
    }
    if (!docName && accountsVerificationModal.payments?.balanceProofDoc) {
      docName = accountsVerificationModal.payments.balanceProofDoc;
    }

    let immediate = resolveDocumentUrl(rawProof) ||
      ((typeof rawProof === 'string' && rawProof.startsWith('data:')) ? rawProof : null) ||
      (rawProof?.dataUrl || rawProof?.fileData || rawProof?.url || accountsVerificationModal.proofDocData || accountsVerificationModal.payments?.proofDocData || null);

    if (!immediate && docName) {
      immediate = getMediaFromCache(docName);
    }

    const srcPiNo = accountsVerificationModal.sourcePiNo || accountsVerificationModal.piNo;
    if (!immediate && srcPiNo && typeof window !== 'undefined') {
      try {
        const rawPis = localStorage.getItem('controlroom_pi_store') || localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('businz_pi_store');
        if (rawPis) {
          const parsed = JSON.parse(rawPis);
          const piList = Array.isArray(parsed) ? parsed : (parsed.pis || []);
          const pi = piList.find(p => p.piNo === srcPiNo || p.id === srcPiNo);
          if (pi) {
            const piData = pi.proofDocData || pi.payments?.proofDocData || (typeof pi.paymentProofDoc === 'string' && pi.paymentProofDoc.startsWith('data:') ? pi.paymentProofDoc : pi.paymentProofDoc?.dataUrl);
            if (piData) immediate = piData;
          }
        }
      } catch (_) {}
    }

    if (immediate && !immediate.startsWith('blob:')) {
      if (immediate.startsWith('/uploads/')) immediate = `/api${immediate}`;
      setResolvedProofDataUrl(immediate);
      setIsResolvingProof(false);
    } else if (rawProof || docName) {
      setIsResolvingProof(true);
      resolveDocumentUrlAsync(rawProof || docName, bCode).then(sUrl => {
        if (active) {
          if (sUrl) {
            const cleanUrl = sUrl.startsWith('/uploads/') ? `/api${sUrl}` : sUrl;
            setResolvedProofDataUrl(cleanUrl);
            if (docName) saveMediaToCache(docName, cleanUrl);
          }
          setIsResolvingProof(false);
        }
      }).catch(() => {
        if (active) setIsResolvingProof(false);
      });
    } else {
      setIsResolvingProof(false);
    }

    return () => { active = false; };
  }, [accountsVerificationModal]);

  const [singleOrderVerification, setSingleOrderVerification] = useState(null);
  const [loadingVerification, setLoadingVerification] = useState(false);

  // Requirement 2: Only fetch accounts_verification when a user opens the accounts verification screen for one single order
  useEffect(() => {
    let isMounted = true;
    if (!accountsVerificationModal) {
      setSingleOrderVerification(null);
      return;
    }

    const orderId = accountsVerificationModal.id || accountsVerificationModal.bomCode || accountsVerificationModal.code;
    if (!orderId) return;

    setLoadingVerification(true);
    const fetchSingleOrderAccountsVerification = async () => {
      try {
        let result = await supabase
          .from('bom_orders')
          .select('accounts_verification')
          .eq('id', orderId)
          .maybeSingle();

        if (!result?.data && accountsVerificationModal.bomCode) {
          result = await supabase
            .from('bom_orders')
            .select('accounts_verification')
            .eq('bom_code', accountsVerificationModal.bomCode)
            .maybeSingle();
        }

        if (isMounted && result?.data?.accounts_verification) {
          const raw = result.data.accounts_verification;
          const clean = typeof raw === 'object' ? { ...raw } : {};
          delete clean._extra_data;
          setSingleOrderVerification(clean);
        }
      } catch (err) {
        console.warn('[AccountsVerificationModal] Single verification fetch notice:', err);
      } finally {
        if (isMounted) setLoadingVerification(false);
      }
    };

    fetchSingleOrderAccountsVerification();

    return () => { isMounted = false; };
  }, [accountsVerificationModal?.id, accountsVerificationModal?.bomCode, accountsVerificationModal?.code]);

  const accVerif = singleOrderVerification || (accountsVerificationModal && accountsVerificationModal.accountsVerification) || {};
  const isAlreadyCompleted = Boolean(
    isAccountsViewOnly ||
    accVerif.verified === true ||
    (accountsVerificationModal.status && accountsVerificationModal.status.includes('Accounts Verified')) ||
    accountsVerificationModal.status === 'ACCOUNTS VERIFIED' ||
    accountsVerificationModal.isAccountsDone === true
  );
  const isCancelled = Boolean(
    accountsVerificationModal?.cancelled ||
    accountsVerificationModal?.status === 'Cancelled' ||
    accountsVerificationModal?.status === 'CANCELLED' ||
    accountsVerificationModal?.status === 'Cancelled & Stock Restored' ||
    (accountsVerificationModal?.status && typeof accountsVerificationModal.status === 'string' && accountsVerificationModal.status.toLowerCase().includes('cancel'))
  );
  const isPartialPackingOrder = Boolean(
    accountsVerificationModal?.isPartialPacking ||
    accountsVerificationModal?.accountsVerification?.isPartialPacking ||
    accountsVerificationModal?.packingStatus === 'PARTIALLY_PACKED' ||
    String(accountsVerificationModal?.status || '').toLowerCase().includes('partial')
  );
  const normalizePaymentTerm = (term) => {
    if (!term) return '';
    const str = String(term).trim();
    if (str.includes('100%') || str === 'Full Payment' || str === 'Paid' || str === 'Payment Received — 100%') return '100% Paid';
    if (str.includes('Partial') || str.includes('50%')) return 'Partial Paid';
    if (str.includes('While Dispatch') || str.includes('Before Dispatch')) return 'Payment While Dispatch';
    if (str.includes('Credit') || str.includes('Net 30')) return 'Credit Payment';
    return str;
  };
  const salesPaymentStatus = normalizePaymentTerm(accountsVerificationModal?.paymentType || accountsVerificationModal?.paymentTerms || accountsVerificationModal?.c3) || '100% Paid';

  // Customer Payment Status is strictly determined by Sales BOM and cannot be altered by Accounts
  const currentPayStatus = salesPaymentStatus;
  const hardCopy = isAlreadyCompleted ? true : Boolean(accVerif.hardCopyReceived);
  const bomCodeText = (accountsVerificationModal && (accountsVerificationModal.bomCode || accountsVerificationModal.code)) || 'BOM-2026';
  const custNameText = (() => {
    if (!accountsVerificationModal) return 'Customer';
    const m = accountsVerificationModal;
    if (m.customerName && m.customerName !== 'Customer' && m.customerName !== '-') return m.customerName;
    if (m.companyName && m.companyName !== '-') return m.companyName;
    if (m.c2 && m.c2 !== 'Customer') return m.c2;
    if (m.vendor && m.vendor !== 'Customer') return m.vendor;
    if (m.clientName) return m.clientName;
    return m.customerName || m.companyName || 'Customer';
  })();
  const payTypeText = (accountsVerificationModal && (accountsVerificationModal.paymentType || accountsVerificationModal.c3)) || 'Net 30 Days';

  const rawDispatchPushed = accountsVerificationModal?.accountsVerification?.packedAt || 
                            accountsVerificationModal?.packedAt || 
                            accountsVerificationModal?.packingCompletedAt || 
                            accountsVerificationModal?.packingVerifiedAt || 
                            accountsVerificationModal?.sentToAccountsAt || 
                            accountsVerificationModal?.accountsVerification?.sentToAccountsAt || 
                            accountsVerificationModal?.accountsSentAt ||
                            accountsVerificationModal?.salesPaymentProofUploadedAt ||
                            accountsVerificationModal?.paymentProofUploadedAt;

  const dispatchReceivedText = (() => {
    if (!rawDispatchPushed) return null;
    try {
      const d = new Date(rawDispatchPushed);
      if (!isNaN(d.getTime())) {
        const dStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const tStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        return `${dStr} at ${tStr}`;
      }
      return String(rawDispatchPushed);
    } catch (_) {
      return String(rawDispatchPushed);
    }
  })();

  // Resolve linked source PI early so Accounts has full GST total & PI-level payment proofs
  const resolvedMatchedPi = (() => {
    const targetPiNo = accountsVerificationModal?.sourcePiNo || accountsVerificationModal?.piNo;
    if (!targetPiNo || typeof window === 'undefined') return null;
    try {
      const rawPiStore = localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('controlroom_pi_store') || localStorage.getItem('businz_pi_store') || localStorage.getItem('sales_pi_store');
      if (!rawPiStore) return null;
      const parsedPis = JSON.parse(rawPiStore);
      const piArr = Array.isArray(parsedPis) ? parsedPis : (parsedPis.pis || []);
      const targetNorm = String(targetPiNo).trim().toLowerCase();
      return piArr.find(p =>
        String(p.piNo || '').trim().toLowerCase() === targetNorm ||
        String(p.id || '').trim().toLowerCase() === targetNorm
      ) || null;
    } catch (_) {
      return null;
    }
  })();

  const gstRateFallback = extractGstRate(accountsVerificationModal?.gstRate ?? resolvedMatchedPi?.gstRate, 18);
  const gstMultFallback = 1 + gstRateFallback / 100;
  const rawSubForOrder = cleanNum(accountsVerificationModal?.subTotal, 0) || cleanNum(accountsVerificationModal?.subtotal, 0) || cleanNum(resolvedMatchedPi?.subTotal, 0);
  const rawGstForOrder = cleanNum(accountsVerificationModal?.gstAmount, 0) || cleanNum(resolvedMatchedPi?.gstAmount, 0);
  const subWithGstForOrder = rawSubForOrder > 0
    ? (rawGstForOrder > 0 ? rawSubForOrder + rawGstForOrder : Math.round(rawSubForOrder * gstMultFallback * 100) / 100)
    : 0;
  const itemsSumWithGst = Array.isArray(accountsVerificationModal?.items) && accountsVerificationModal.items.length > 0
    ? Math.round(accountsVerificationModal.items.reduce((s, it) => {
        const lineSub = Number(it.rate || it.price || 0) * Number(it.qty || it.bomQty || 1);
        const itemRate = extractGstRate(it.gstRate ?? it.tax, gstRateFallback);
        return s + (lineSub * (1 + itemRate / 100));
      }, 0) * 100) / 100
    : 0;
  const orderValue =
    cleanNum(accountsVerificationModal?.grandTotal, 0) ||
    cleanNum(resolvedMatchedPi?.grandTotal, 0) ||
    subWithGstForOrder ||
    cleanNum(accountsVerificationModal?.totalAmount, 0) ||
    itemsSumWithGst;

  const getExpectedInvNo = () => {
    const raw = accountsVerificationModal?.invoiceNo;
    if (raw && raw !== 'Pending Confirmation' && raw !== 'Assigned upon Clearance') {
      const isTaken = (invoiceList || []).some(inv => 
        (inv.invNo === raw || inv.code === raw || inv.invoiceNo === raw) &&
        inv.poNo !== accountsVerificationModal?.bomCode && inv.bomCode !== accountsVerificationModal?.bomCode
      );
      if (!isTaken) return raw;
    }
    return '';
  };

  const [assignedInvoiceNo, setAssignedInvoiceNo] = useState(getExpectedInvNo);

  useEffect(() => {
    const expected = getExpectedInvNo();
    setAssignedInvoiceNo(expected);
  }, [accountsVerificationModal?.bomCode, accountsVerificationModal?.code, accountsVerificationModal?.id, accountsVerificationModal?.invoiceNo]);

  // STRICT AUDIT RULE: For unverified orders, do NOT auto-fill Payment Date or Total Amount from sales BOM.
  // The Accounts team must inspect the payment slip below and manually enter the actual received date & amount.
  const currentPayDate = (accVerif.paymentDate !== undefined && accVerif.paymentDate !== null && accVerif.paymentDate !== '')
    ? accVerif.paymentDate 
    : (isAlreadyCompleted ? (accountsVerificationModal?.paymentDate || '') : '');
  const hasSavedSlipAmount = isAlreadyCompleted && accVerif.verifiedSlipAmount !== undefined && accVerif.verifiedSlipAmount !== null && accVerif.verifiedSlipAmount !== '';
  const currentTotalAmount = hasSavedSlipAmount
    ? accVerif.verifiedSlipAmount
    : ((accVerif.totalAmount !== undefined && accVerif.totalAmount !== null && accVerif.totalAmount !== '')
      ? accVerif.totalAmount
      : (isAlreadyCompleted ? (orderValue > 0 ? orderValue : (accountsVerificationModal?.grandTotal || accountsVerificationModal?.subTotal || accountsVerificationModal?.totalAmount || '')) : ''));
  const adjustedAmountRaw = (accVerif.adjustedAmount !== undefined && accVerif.adjustedAmount !== null && accVerif.adjustedAmount !== '')
    ? accVerif.adjustedAmount
    : (accountsVerificationModal?.adjustedAmount !== undefined && accountsVerificationModal?.adjustedAmount !== null ? accountsVerificationModal.adjustedAmount : '');
  const adjustedAmountNum = cleanNum(adjustedAmountRaw, 0);
  const adjustedFromRef = accVerif.adjustedFromRef || accountsVerificationModal?.adjustedFromRef || '';
  const adjustedNote = accVerif.adjustedNote || accountsVerificationModal?.adjustedNote || '';
  const verifiedSlipAmountNum = hasSavedSlipAmount
    ? cleanNum(accVerif.verifiedSlipAmount, 0)
    : (isAlreadyCompleted && adjustedAmountNum > 0 && cleanNum(currentTotalAmount, 0) >= adjustedAmountNum
      ? Math.max(0, cleanNum(currentTotalAmount, 0) - adjustedAmountNum)
      : cleanNum(currentTotalAmount, 0));
  const effectiveTotalAmountNum = verifiedSlipAmountNum + adjustedAmountNum;

  const payType = accountsVerificationModal?.paymentType || accountsVerificationModal?.paymentTerms || accountsVerificationModal?.c3 || '';
  const payTypeLower = String(payType).toLowerCase();
  const creditDays = Number(accountsVerificationModal?.creditDays || 30);
  const verifiedOrderTotal = orderValue > 0 ? orderValue : cleanNum(accountsVerificationModal?.grandTotal, 0);
  const isCreditTerms = currentPayStatus === 'Credit Payment' ||
    payTypeLower.includes('credit') || 
    payTypeLower.includes('net 30') || 
    payTypeLower.includes('net 15') || 
    payTypeLower.includes('net 45') || 
    payTypeLower.includes('net 60') ||
    Number(accountsVerificationModal?.creditDays || 0) > 0;
  // Cash orders carry no payment proof; Accounts records the cash received and must confirm the full amount.
  const isCashTerms = currentPayStatus === 'Cash' || payTypeLower === 'cash';
  // Delivery Challan orders carry no customer payment, so no slip/date/amount is required in Accounts.
  const isDcOrder = ['docType', 'documentType', 'invoiceType'].some(k => {
    const v = String(accountsVerificationModal?.[k] || '').toUpperCase();
    return v === 'DC' || v.includes('CHALLAN');
  });
  const isWhileDispatch = !isCreditTerms && (payType === 'Payment While Dispatch' || payTypeLower.includes('while dispatch') || payTypeLower.includes('before dispatch'));
  const isPartialPaidTerms = !isCreditTerms && (payTypeLower.includes('partial') || payTypeLower.includes('50%'));
  const is100PaidTerms = !isCreditTerms && (payTypeLower.includes('100%') || payTypeLower.includes('full') || payTypeLower.includes('advance'));
  const requiresPaymentProofForApproval = !isCreditTerms && !isDcOrder && Boolean(
    isWhileDispatch ||
    isPartialPaidTerms ||
    is100PaidTerms ||
    accountsVerificationModal?.awaitingSalesPaymentProof ||
    accountsVerificationModal?.accountsVerification?.paymentStatus === 'Awaiting Sales Payment Slip' ||
    String(accountsVerificationModal?.status || '').toLowerCase().includes('awaiting sales payment proof') ||
    String(accountsVerificationModal?.status || '').toLowerCase().includes('payment proof pending')
  );

  const rawProofForCheck = accountsVerificationModal?.paymentProofDoc ||
    accountsVerificationModal?.payments?.proofDocObj ||
    accountsVerificationModal?.payments?.proofDoc ||
    accountsVerificationModal?.proofDoc ||
    accountsVerificationModal?.salesPoDetails?.proofDocObj ||
    accountsVerificationModal?.balancePaymentProofDoc ||
    accountsVerificationModal?.payments?.balanceProofDocObj ||
    accountsVerificationModal?.payments?.balanceProofDoc ||
    resolvedMatchedPi?.paymentProofDoc ||
    (Array.isArray(resolvedMatchedPi?.paymentProofDocs) && resolvedMatchedPi.paymentProofDocs[0]) ||
    resolvedMatchedPi?.payments?.proofDocObj ||
    resolvedMatchedPi?.payments?.proofDoc;

  const hasUploadedPaymentProof = Boolean(
    (typeof rawProofForCheck === 'string' && rawProofForCheck.trim().length > 0) ||
    (rawProofForCheck && typeof rawProofForCheck === 'object' && (rawProofForCheck.url || rawProofForCheck.dataUrl || rawProofForCheck.fileData || rawProofForCheck.storagePath || rawProofForCheck.storageBucket || rawProofForCheck.name || rawProofForCheck.originalName)) ||
    resolvedProofDataUrl ||
    accountsVerificationModal?.paymentProofDocName ||
    (Array.isArray(accountsVerificationModal?.paymentProofDocs) && accountsVerificationModal.paymentProofDocs.length > 0) ||
    (Array.isArray(accountsVerificationModal?.balancePaymentProofDocs) && accountsVerificationModal.balancePaymentProofDocs.length > 0) ||
    (Array.isArray(resolvedMatchedPi?.paymentProofDocs) && resolvedMatchedPi.paymentProofDocs.length > 0) ||
    accountsVerificationModal?.balancePaymentProofDoc ||
    accountsVerificationModal?.balanceProofDoc ||
    accountsVerificationModal?.payments?.proofDoc ||
    accountsVerificationModal?.payments?.balanceProofDoc
  );

  const hasBalancePaymentProof = Boolean(
    accountsVerificationModal?.balancePaymentProofDoc ||
    accountsVerificationModal?.balanceProofDoc ||
    (Array.isArray(accountsVerificationModal?.balancePaymentProofDocs) && accountsVerificationModal.balancePaymentProofDocs.length > 0) ||
    accountsVerificationModal?.payments?.balanceProofDocObj ||
    accountsVerificationModal?.payments?.balanceProofDoc ||
    accountsVerificationModal?.payments?.balanceUploaded ||
    accountsVerificationModal?.payments?.balanceSettled ||
    accountsVerificationModal?.payments?.dispatch50Uploaded ||
    accountsVerificationModal?.creditSettled ||
    accountsVerificationModal?.paymentSettled ||
    accountsVerificationModal?.accountsVerification?.creditSettled ||
    accountsVerificationModal?.accountsVerification?.paymentStatus === 'Payment Proof Attached' ||
    accountsVerificationModal?.accountsVerification?.paymentStatus === 'Payment Proof Attached by Sales' ||
    (accountsVerificationModal?.balanceAmount !== undefined && accountsVerificationModal?.balanceAmount !== null && Number(accountsVerificationModal.balanceAmount) <= 0 && Number(accountsVerificationModal.partialAmount) > 0 && hasUploadedPaymentProof)
  );

  const isMissingRequiredPaymentProof = !isCreditTerms && !isDcOrder && Boolean(
    isPartialPaidTerms ? !hasBalancePaymentProof : (requiresPaymentProofForApproval && !hasUploadedPaymentProof)
  );

  // Accounts may push Partial Paid / Payment While Dispatch orders forward when payment is received but proof is not attached
  const canForcePushWithoutProof = Boolean(
    isMissingRequiredPaymentProof && (isPartialPaidTerms || isWhileDispatch) &&
    /account/i.test(String(userRole || '')) && !isAccountsViewOnly
  );

  const isVerified = Boolean(
    currentPayStatus && 
    (isCreditTerms || isDcOrder || (currentPayDate && effectiveTotalAmountNum > 0)) &&
    !isMissingRequiredPaymentProof
  );
  const isPartialVerified = Boolean(isCreditTerms ? !isVerified : (currentPayStatus || currentPayDate || effectiveTotalAmountNum > 0)) && !isVerified;

  const payStatusConfig = {
    '100% Paid': { bg: '#DCFCE7', color: '#166534', label: '100% Paid', icon: <CheckCircle style={{ width: '18px', height: '18px' }} /> },
    'Payment Received — 100%': { bg: '#DCFCE7', color: '#166534', label: '100% Paid', icon: <CheckCircle style={{ width: '18px', height: '18px' }} /> },
    'Partial Paid': { bg: '#FEF3C7', color: '#B45309', label: 'Partial Paid', icon: <Clock style={{ width: '18px', height: '18px' }} /> },
    'Payment Received — 50%': { bg: '#FEF3C7', color: '#B45309', label: 'Partial Paid', icon: <Clock style={{ width: '18px', height: '18px' }} /> },
    'Payment While Dispatch': { bg: '#FEF9C3', color: '#854D0E', label: 'Payment While Dispatch', icon: <Clock style={{ width: '18px', height: '18px' }} /> },
    'Credit Payment': { bg: '#DBEAFE', color: '#1E40AF', label: 'Credit Payment', icon: <Receipt style={{ width: '18px', height: '18px' }} /> },
    'Cash': { bg: '#ECFDF5', color: '#047857', label: 'Cash', icon: <Receipt style={{ width: '18px', height: '18px' }} /> },
  };
  const currentPayConfig = (currentPayStatus && payStatusConfig[currentPayStatus]) || { bg: '#F1F5F9', color: '#475569', label: 'Pending Verification', icon: <Clock style={{ width: '18px', height: '18px' }} /> };

  const completeVerification = async (forcePushReason = '') => {
    const forcePushMeta = forcePushReason
      ? { forcePushedWithoutProof: true, forcePushReason, forcePushedByRole: userRole || 'Accounts', forcePushedAt: new Date().toISOString() }
      : {};
    if (isMissingRequiredPaymentProof && !forcePushReason) {
      alert(`⛔ CANNOT APPROVE — PAYMENT PROOF PENDING\n\nThis order has payment terms "${payType || 'Payment While Dispatch / Partial Payment'}". The required ${isPartialPaidTerms ? 'remaining balance ' : ''}payment proof slip has NOT been uploaded by the Sales person yet.\n\nBy strict company policy, this order remains in Payment Proof Pending until the Sales person attaches the payment proof receipt.`);
      return;
    }
    if (isCashTerms && accVerif.cashFullAmountReceived !== 'Yes') {
      alert('⚠️ Cash order: please confirm "Have you received the full amount?" as Yes before completing verification.');
      return;
    }
    if (!isCreditTerms && !isDcOrder && !currentPayDate) {
      alert('⚠️ Please enter the verified Payment Date from the payment slip before completing accounts verification.');
      return;
    }
    if (!isCreditTerms && !isDcOrder && effectiveTotalAmountNum <= 0) {
      alert('⚠️ Please enter the verified Total Amount (₹) from the payment slip (or apply an Adjust Payment amount) before completing accounts verification.');
      return;
    }

    const targetCode = accountsVerificationModal.bomCode || accountsVerificationModal.code;
    const targetOrderAmt = orderValue > 0 ? orderValue : cleanNum(accountsVerificationModal?.grandTotal, 0);
    const balanceDue = isDcOrder ? 0 : (isCreditTerms ? targetOrderAmt : Math.max(0, targetOrderAmt - effectiveTotalAmountNum));
    const verifiedPayStatus = isDcOrder ? 'Delivery Challan — No Payment' : isCreditTerms
      ? (currentPayStatus || 'Credit Payment')
      : (balanceDue <= 0
          ? '100% Received • Fully Settled'
          : `Partial Payment (₹ ${balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Due)`);

    let finalInvNo = assignedInvoiceNo;
    const isTaken = (no) => {
      if (!no || no === 'Pending Confirmation' || no === 'Assigned upon Clearance' || no === 'Auto-Assign') return true;
      const inInvoices = (invoiceList || []).some(inv => 
        (inv.invNo === no || inv.code === no || inv.invoiceNo === no) &&
        inv.poNo !== targetCode && inv.bomCode !== targetCode
      );
      if (inInvoices) return true;
      return (bomStore || []).some(b =>
        b && (b.invoiceNo === no || b.taxInvoiceNo === no) &&
        b.bomCode !== targetCode && b.code !== targetCode
      );
    };

    // Atomically reserve next sequential Tax Invoice number upon clearance
    if (!finalInvNo || finalInvNo === 'Pending Confirmation' || finalInvNo === 'Assigned upon Clearance' || isTaken(finalInvNo)) {
      try {
        const res = await fetch('/api/next-invoice-number?reserve=true');
        if (res.ok) {
          const data = await res.json();
          if (data && data.nextInvNo && !isTaken(data.nextInvNo)) {
            finalInvNo = data.nextInvNo;
          }
        }
      } catch (_) {}
    }
    if (!finalInvNo || isTaken(finalInvNo)) {
      const bCode = accountsVerificationModal.bomCode || accountsVerificationModal.code || '';
      const matchSeq = bCode.match(/VRM-BOM-(\d{4})-(\d+)/i);
      const candidate = matchSeq ? `VRM-INV-${matchSeq[1]}-${matchSeq[2]}` : '';
      finalInvNo = (!candidate || isTaken(candidate)) ? `VRM-INV-2026-${Date.now().toString().slice(-4)}` : candidate;
    }

    const verifiedBOM = accountsVerificationModal;
    const updatedBomData = {
      ...verifiedBOM,
      invoiceNo: finalInvNo,
      grandTotal: targetOrderAmt > 0 ? targetOrderAmt : effectiveTotalAmountNum,
      paymentDate: isCreditTerms ? '' : currentPayDate,
      isAccountsDone: true,
      invoiceConfirmed: false,
      accountsVerification: {
        ...(verifiedBOM.accountsVerification || {}),
        paymentStatus: verifiedPayStatus,
        paymentDate: isCreditTerms ? '' : currentPayDate,
        totalAmount: isCreditTerms ? verifiedOrderTotal : effectiveTotalAmountNum,
        verifiedSlipAmount: verifiedSlipAmountNum,
        adjustedAmount: adjustedAmountNum,
        adjustedFromRef: String(adjustedFromRef || '').trim(),
        adjustedNote: String(adjustedNote || '').trim(),
        orderTotal: targetOrderAmt,
        balanceAmount: balanceDue,
        hardCopyReceived: true,
        verified: true,
        verifiedBy: verifiedBOM.accountsVerification?.verifiedBy || 'Accounts Executive (Venkatesh)',
        verifiedByRole: 'Accounts Team Lead',
        ...forcePushMeta,
        verifiedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric' })
      },
      proofDoc: verifiedBOM.payments?.proofDoc || verifiedBOM.paymentProofDoc?.name || null,
      proofDocData: verifiedBOM.payments?.proofDocData || verifiedBOM.paymentProofDoc?.dataUrl || null,
      status: 'Accounts Verified & Passed to Invoice'
    };
    delete updatedBomData.c2;
    delete updatedBomData.c3;
    delete updatedBomData.c4;
    delete updatedBomData.c5;
    delete updatedBomData.c6;

    setBomStore(prev => {
      const updated = (prev || []).map(b => (b.bomCode === targetCode || b.code === targetCode || b.id === verifiedBOM.id) ? updatedBomData : b);
      return updated;
    });

    // Save to localStorage and Cloud Store for BOM
    try {
      const currentLocal = JSON.parse(localStorage.getItem('controlroom_bom_store') || '[]');
      const updatedLocal = currentLocal.map(b => (b.bomCode === targetCode || b.code === targetCode || b.id === verifiedBOM.id) ? updatedBomData : b);
      localStorage.setItem('controlroom_bom_store', JSON.stringify(updatedLocal.map(stripDataUrlsFromRecord)));
      saveCloudBomRow(updatedBomData);
    } catch (_) {}

    // Push to server so Accounts & Billing sees it across devices
    try {
      fetch('/api/boms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bom: stripDataUrlsFromRecord(updatedBomData), isUpdate: true })
      }).catch(() => {});
    } catch (_) {}

    // Invoice lines are an exact copy of the confirmed BOM lines (rate, kit, GST unchanged).
    // The packing list only decides packed / not packed for each line.
    const packingArr = Array.isArray(verifiedBOM.dispatchPacking) ? verifiedBOM.dispatchPacking : [];
    const isSamePackingLine = (p, it) => Boolean(p) &&
      String(p.presetGroupId || '') === String(it.presetGroupId || '') &&
      ((p.code && it.code && p.code === it.code) || (p.name && it.name && p.name.toLowerCase().trim() === it.name.toLowerCase().trim()));
    const packedItems = (verifiedBOM.items || []).length > 0
      ? verifiedBOM.items.map((it, idx) => {
        const p = isSamePackingLine(packingArr[idx], it) ? packingArr[idx] : packingArr.find(pk => isSamePackingLine(pk, it));
        const isPacked = p ? Boolean(p.packed) : true;
        return { ...it, selected: isPacked, packed: isPacked };
      })
      : packingArr.map((p, pIdx) => ({
        code: p.code || `PRD-00${pIdx + 1}`,
        name: p.name || `Item ${pIdx + 1}`,
        qty: cleanNum(p.bomQty || p.qty, 1),
        bomQty: cleanNum(p.bomQty || p.qty, 1),
        invQty: cleanNum(p.bomQty || p.qty, 1),
        rate: cleanNum(p.rate, 0),
        isPresetItem: Boolean(p.isPresetItem),
        presetGroupId: p.presetGroupId || null,
        presetName: p.presetName || '',
        selected: Boolean(p.packed),
        packed: Boolean(p.packed)
      }));
    const orderTotalForInvoice = cleanNum(updatedBomData.grandTotal, 0) || effectiveTotalAmountNum;

    const newInvEntry = {
      invNo: finalInvNo,
      code: finalInvNo,
      invoiceNo: finalInvNo,
      invoiceConfirmed: false,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      vendor: verifiedBOM.customerName || verifiedBOM.companyName || custNameText,
      customerName: verifiedBOM.customerName || verifiedBOM.companyName || custNameText,
      salesPerson: (verifiedBOM.salesPerson || verifiedBOM.createdBy || 'Sales Department').replace(/\s*\([^)]*\)/g, '').trim(),
      salesPersonCode: verifiedBOM.salesPersonCode || verifiedBOM.createdById || '',
      poNo: targetCode,
      bomCode: targetCode,
      grnNo: 'GRN-VERIFIED',
      invAmt: formatCurrency(orderTotalForInvoice),
      poVal: formatCurrency(orderTotalForInvoice),
      grnVal: formatCurrency(orderTotalForInvoice),
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
        paymentStatus: verifiedPayStatus,
        paymentDate: isCreditTerms ? '' : currentPayDate,
        totalAmount: isCreditTerms ? verifiedOrderTotal : effectiveTotalAmountNum,
        verifiedSlipAmount: verifiedSlipAmountNum,
        adjustedAmount: adjustedAmountNum,
        adjustedFromRef: String(adjustedFromRef || '').trim(),
        adjustedNote: String(adjustedNote || '').trim(),
        orderTotal: targetOrderAmt,
        balanceAmount: balanceDue,
        hardCopyReceived: hardCopy,
        verified: true,
        ...(isCashTerms ? { cashFullAmountReceived: accVerif.cashFullAmountReceived || '', cashChallanNo: String(accVerif.cashChallanNo || '').trim() } : {}),
        ...forcePushMeta
      },
      proofDoc: verifiedBOM.payments?.proofDoc || verifiedBOM.paymentProofDoc?.name || null,
      proofDocData: verifiedBOM.payments?.proofDocData || verifiedBOM.paymentProofDoc?.dataUrl || null,
      paymentProofDoc: verifiedBOM.paymentProofDoc || null
    };

    setInvoiceList(prev => {
      const filtered = (prev || []).filter(i => i.poNo !== targetCode && i.bomCode !== targetCode && (finalInvNo ? (i.invNo !== finalInvNo && i.code !== finalInvNo) : true));
      const updated = [newInvEntry, ...filtered];
      try {
        saveCloudInvoiceRow(newInvEntry);
        localStorage.setItem('controlroom_invoice_store', JSON.stringify(updated.map(stripDataUrlsFromRecord)));
        fetch('/api/store/invoice_store', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stripDataUrlsFromRecord(newInvEntry))
        }).catch(() => {});
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
      invoiceNo: finalInvNo,
      salesPerson: verifiedBOM.salesPerson
    });

    setAccountsVerificationModal(null);
    if (typeof showCustomAlert === 'function') {
      showCustomAlert(`Accounts Verification approved for ${bomCodeText}.\n\nOfficial Invoice Number Assigned: ${finalInvNo} (Matches BUSINZ Native Catalog sequence).\n\nOrder passed directly to Invoice Management with invoice number ready.`, 'Accounts Verification Completed', 'success');
    }
  };

  const modalContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ─── GRADIENT HEADER BANNER ─── */}
      <div className="dispatch-modal-banner" style={{
        background: isAlreadyCompleted
          ? 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)'
          : 'linear-gradient(135deg, #0E7490 0%, #0369A1 100%)',
        borderRadius: '16px',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
        boxShadow: isAlreadyCompleted ? '0 8px 24px rgba(6,78,59,0.35)' : '0 8px 24px rgba(14,116,144,0.35)',
        boxSizing: 'border-box',
        width: '100%'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.2px' }}>
            Accounts Payment & Document Verification
          </h1>
          <span style={{
            backgroundColor: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)',
            color: '#FFFFFF', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '800'
          }}>
            {bomCodeText}
          </span>
          <StatusBadge
            status={isAlreadyCompleted ? 'ACCOUNTS VERIFIED' : (isMissingRequiredPaymentProof ? 'PAYMENT PROOF PENDING' : (payType.includes('100%') ? '100% PAID • READY FOR CLEARANCE' : 'AWAITING ACCOUNTS CLEARANCE'))}
            size="sm"
          />
          {isPartialPackingOrder && (
            <span style={{
              backgroundColor: '#FEF3C7',
              color: '#92400E',
              border: '1px solid #FCD34D',
              padding: '3px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '800',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              <Package style={{ width: '13px', height: '13px', color: '#D97706' }} />
              PARTIAL SHIPMENT
            </span>
          )}
        </div>
        {isAccountsViewOnly && (
          <button
            type="button"
            onClick={() => {
              setAccountsVerificationModal(null);
              if (setIsAccountsViewOnly) setIsAccountsViewOnly(false);
            }}
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              padding: '6px 14px',
              color: '#FFFFFF',
              fontSize: '12.5px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'; }}
          >
            <X size={15} /> Close Viewer
          </button>
        )}
      </div>

      {/* ─── DEDICATED ORDER & DISPATCH DETAILS SECTION ─── */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        padding: '16px 20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)',
        gap: '16px',
        alignItems: 'center',
        boxSizing: 'border-box',
        width: '100%'
      }}>
        {/* Customer Name */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Customer Name
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={custNameText}>
            {custNameText}
          </div>
        </div>

        {/* Sales Creator */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Sales Creator
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '3px', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', padding: '2px 8px', borderRadius: '6px' }}>
            <User size={13} style={{ color: '#0D9488' }} />
            <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F766E' }}>
              {((accountsVerificationModal.salesPerson || accountsVerificationModal.createdBy || 'Sales Department')).replace(/\s*\([^)]*\)/g, '').trim()}
            </span>
          </div>
        </div>

        {/* Document Type */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Document Type
          </div>
          <div style={{ marginTop: '3px' }}>
            {accountsVerificationModal?.docType === 'DC' ? (
              <span style={{
                backgroundColor: '#FEF3C7',
                border: '1px solid #FCD34D',
                color: '#92400E',
                padding: '2px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '800',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <Truck size={13} strokeWidth={2.2} />
                <span>DC (Delivery Challan)</span>
              </span>
            ) : (
              <span style={{
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                color: '#1E40AF',
                padding: '2px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '800',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <FileText size={13} strokeWidth={2.2} />
                <span>Tax Invoice</span>
              </span>
            )}
            {accountsVerificationModal?.docType === 'DC' && (
              <div style={{ marginTop: '4px', fontSize: '12px', color: '#92400E', fontWeight: '600' }}>
                <strong>DC Remarks:</strong> {accountsVerificationModal?.dcRemarks || '—'}
              </div>
            )}
          </div>
        </div>

        {/* Received from Dispatch */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Received from Dispatch
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '3px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '2px 8px', borderRadius: '6px' }}>
            <Clock size={13} style={{ color: '#64748B' }} />
            <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#334155' }}>
              {dispatchReceivedText || '—'}
            </span>
          </div>
        </div>

        {/* Official Invoice Number */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Official Invoice No
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '3px', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '2px 8px', borderRadius: '6px' }}>
            <Receipt size={13} style={{ color: '#0E7490' }} />
            <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0E7490' }}>
              {assignedInvoiceNo || (isAlreadyCompleted ? 'Assigned' : 'Assigned upon Clearance')}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 4 STAT CARDS (Payment Terms, Order Total Value, Amount Received, Pending Balance) ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isMobile ? '10px' : '14px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {/* 1. Payment Terms Card */}
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0',
          padding: isMobile ? '12px 14px' : '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '12px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: isMobile ? '38px' : '42px', height: isMobile ? '38px' : '42px', borderRadius: '12px', flexShrink: 0,
            background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(37,99,235,0.25)'
          }}>
            <Receipt style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#FFFFFF' }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Terms</div>
            <div style={{ fontSize: isMobile ? '13px' : '13.5px', fontWeight: '900', color: '#0F172A', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{payTypeText || '100% Paid'}</div>
            <div style={{ marginTop: '3px' }}>
              <span style={{
                fontSize: '10.5px',
                fontWeight: '700',
                color: (currentPayStatus.includes('Received') || currentPayStatus.includes('Settled') || currentPayStatus.includes('100%')) ? '#15803D' : (currentPayStatus.includes('Credit') ? '#1D4ED8' : '#B45309'),
                backgroundColor: (currentPayStatus.includes('Received') || currentPayStatus.includes('Settled') || currentPayStatus.includes('100%')) ? '#DCFCE7' : (currentPayStatus.includes('Credit') ? '#EFF6FF' : '#FEF3C7'),
                border: (currentPayStatus.includes('Received') || currentPayStatus.includes('Settled') || currentPayStatus.includes('100%')) ? '1px solid #BBF7D0' : (currentPayStatus.includes('Credit') ? '1px solid #BFDBFE' : '1px solid #FDE68A'),
                padding: '2px 8px',
                borderRadius: '4px',
                display: 'inline-block'
              }}>
                {currentPayStatus || '100% Received'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Order Total Value Card */}
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0',
          padding: isMobile ? '12px 14px' : '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '12px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: isMobile ? '38px' : '42px', height: isMobile ? '38px' : '42px', borderRadius: '12px', flexShrink: 0,
            background: 'linear-gradient(135deg, #0F172A, #334155)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(15,23,42,0.2)'
          }}>
            <IndianRupee style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#FFFFFF' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Order Total Value
            </div>
            <div style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: '900', color: '#0F172A', lineHeight: 1.2 }}>
              ₹ {verifiedOrderTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* 3. Received from Slip Card */}
        <div style={{
          backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0',
          padding: isMobile ? '12px 14px' : '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '12px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: isMobile ? '38px' : '42px', height: isMobile ? '38px' : '42px', borderRadius: '12px', flexShrink: 0,
            background: 'linear-gradient(135deg, #0E7490, #06B6D4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(14,116,144,0.25)'
          }}>
            <IndianRupee style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#FFFFFF' }} />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isCreditTerms ? 'Credit Amount' : 'Amount Received'}
            </div>
            <div style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: '900', color: '#0E7490', lineHeight: 1.2 }}>
              {isCreditTerms
                ? `₹ ${verifiedOrderTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                : (effectiveTotalAmountNum > 0 ? `₹ ${effectiveTotalAmountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Pending Entry')}
            </div>
          </div>
        </div>

        {/* 4. Pending Balance Card */}
        {(() => {
          const targetAmt = verifiedOrderTotal;
          const currentBal = isCreditTerms ? 0 : Math.max(0, targetAmt - effectiveTotalAmountNum);
          const isBalZero = targetAmt > 0 && currentBal <= 0;
          return (
            <div style={{
              backgroundColor: isCreditTerms ? '#EFF6FF' : (isBalZero ? '#F0FDF4' : '#FFFBEB'),
              borderRadius: '14px',
              border: isCreditTerms ? '1px solid #BFDBFE' : (isBalZero ? '1.5px solid #86EFAC' : '1.5px solid #FCD34D'),
              padding: isMobile ? '12px 14px' : '16px 18px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '12px',
              boxSizing: 'border-box'
            }}>
              <div style={{
                width: isMobile ? '38px' : '42px', height: isMobile ? '38px' : '42px', borderRadius: '12px', flexShrink: 0,
                background: isCreditTerms
                  ? 'linear-gradient(135deg, #1D4ED8, #3B82F6)'
                  : (isBalZero ? 'linear-gradient(135deg, #166534, #16A34A)' : 'linear-gradient(135deg, #B45309, #D97706)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isBalZero ? '0 4px 10px rgba(22,101,52,0.25)' : '0 4px 10px rgba(217,119,6,0.25)'
              }}>
                <IndianRupee style={{ width: isMobile ? '18px' : '20px', height: isMobile ? '18px' : '20px', color: '#FFFFFF' }} />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: isCreditTerms ? '#1D4ED8' : (isBalZero ? '#15803D' : '#B45309'), textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {isCreditTerms ? 'Credit Tenor' : 'Pending Balance'}
                </div>
                <div style={{ fontSize: isMobile ? '15px' : '17px', fontWeight: '900', color: isCreditTerms ? '#1D4ED8' : (isBalZero ? '#166534' : '#DC2626'), lineHeight: 1.2 }}>
                  {isCreditTerms ? `${creditDays || 30} Days Due` : `₹ ${currentBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ─── PARTIAL PACKING NOTICE BANNER ─── */}
      {isPartialPackingOrder && (
        <div style={{
          backgroundColor: '#FFFBEB',
          border: '1.5px solid #FDE68A',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 8px rgba(245,158,11,0.06)'
        }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px',
            backgroundColor: '#FEF3C7', color: '#B45309',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <Package style={{ width: '20px', height: '20px' }} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#92400E', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Partially Packed Shipment</span>
              <span style={{ fontSize: '11px', color: '#B45309', backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', padding: '1px 8px', borderRadius: '12px', fontWeight: '800' }}>
                Dispatch Forwarded
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#78350F', marginTop: '3px', lineHeight: '1.5' }}>
              Dispatch has confirmed packing for a subset of items for this order. Accounts can verify payment details and generate the invoice sequence for this partial dispatch. Unpacked items will remain in the dispatch queue for future shipments.
            </div>
          </div>
        </div>
      )}

      {/* ─── PAYMENT WHILE DISPATCH HOLD BANNER ─── */}
      {isWhileDispatch && !hasUploadedPaymentProof && (
        <div style={{
          backgroundColor: '#FFFBEB',
          border: '1.5px solid #FCD34D',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
          boxShadow: '0 2px 8px rgba(245,158,11,0.08)'
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            backgroundColor: '#FEF3C7', color: '#B45309',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle style={{ width: '20px', height: '20px' }} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#92400E', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span>⛔ Payment While Dispatch — On Hold in Accounts</span>
              <span style={{ fontSize: '10px', color: '#DC2626', backgroundColor: '#FEE2E2', border: '1px solid #FECACA', padding: '1px 8px', borderRadius: '4px', fontWeight: '800' }}>LOCKED</span>
            </div>
            <div style={{ fontSize: '12px', color: '#78350F', lineHeight: '1.5' }}>
              This order has payment terms <strong>"Payment While Dispatch"</strong>. The sales person has <strong>not yet uploaded the payment proof attachment</strong>.
              By strict company policy, this order <strong>cannot pass to the Billing Team</strong> and will remain on hold in Accounts until the sales person uploads the remittance receipt/slip.
            </div>
          </div>
        </div>
      )}

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
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Payment Details &amp; Verification</h3>
            <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>Confirm &amp; record customer payment receipt date and verified total amount</p>
          </div>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isCreditTerms ? (
            <div style={{
              backgroundColor: '#F0FDF4',
              border: '1.5px solid #86EFAC',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={20} color="#166534" />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#166534' }}>
                      Credit Payment Terms — No Payment Slip or Upfront Amount Entry Required
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#15803D' }}>
                      This order is authorized on Credit. Payment date and received amount are not collected at this stage. Accounts can verify and pass directly to Billing.
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: '#166534',
                  backgroundColor: '#DCFCE7',
                  border: '1px solid #BBF7D0',
                  padding: '4px 10px',
                  borderRadius: '999px'
                }}>
                  {creditDays || 30} Days Credit Period
                </span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '10px',
                padding: '12px',
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                border: '1px solid #BBF7D0'
              }}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>Order Total Value</span>
                  <span style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>
                    ₹ {verifiedOrderTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>Payment Term</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#166534' }}>
                    {currentPayStatus || 'Credit Payment'} ({creditDays || 30} Days)
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', display: 'block' }}>Billing Clearance</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0E7490' }}>
                    Cleared to Generate Invoice
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Payment Date and Total Amount Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Payment Date <span style={{ color: '#EF4444' }}>*</span> {isAlreadyCompleted ? <span style={{ fontSize: '10px', color: '#166534', fontWeight: '700' }}>(Verified)</span> : <span style={{ fontSize: '11px', color: '#B45309', fontWeight: '600' }}>— Enter date verified from slip</span>}
                  </label>
                  <input id="accounts-verification-slice-0-10" name="slice010" aria-label="Slice 0 10"
                    type="date"
                    disabled={isAlreadyCompleted}
                    value={currentPayDate ? String(currentPayDate).slice(0, 10) : ''}
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
                      border: (!currentPayDate && !isAlreadyCompleted) ? '1.5px solid #F59E0B' : '1px solid #CBD5E1', padding: '0 12px',
                      fontSize: '13px', fontWeight: '600', color: '#0F172A',
                      outline: 'none', backgroundColor: isAlreadyCompleted ? '#F1F5F9' : '#FFFFFF',
                      cursor: isAlreadyCompleted ? 'not-allowed' : 'pointer',
                      boxSizing: 'border-box'
                    }}
                   />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Amount Received from Slip (₹) <span style={{ color: '#EF4444' }}>*</span> {isAlreadyCompleted ? <span style={{ fontSize: '10px', color: '#166534', fontWeight: '700' }}>(Verified)</span> : <span style={{ fontSize: '11px', color: '#B45309', fontWeight: '600' }}>— Enter actual payment verified from slip</span>}
                  </label>
                  <input id="accounts-verification-current-total-amount" name="currentTotalAmount" aria-label="Enter verified amount received from slip (e.g. 10000)"
                    type="number"
                    step="0.01"
                    placeholder="Enter verified amount received from slip (e.g. 10000)"
                    disabled={isAlreadyCompleted}
                    value={currentTotalAmount}
                    onChange={(e) => {
                      if (isAlreadyCompleted) return;
                      const val = e.target.value;
                      setAccountsVerificationModal(prev => prev ? ({
                        ...prev,
                        grandTotal: cleanNum(prev.grandTotal, 0) > 0 ? prev.grandTotal : (parseFloat(val) || 0),
                        accountsVerification: { ...(prev.accountsVerification || {}), totalAmount: val }
                      }) : null);
                    }}
                    style={{
                      width: '100%', height: '42px', borderRadius: '10px',
                      border: ((currentTotalAmount === '' || cleanNum(currentTotalAmount, 0) <= 0) && !isAlreadyCompleted) ? '1.5px solid #F59E0B' : '1px solid #CBD5E1', padding: '0 12px',
                      fontSize: '13px', fontWeight: '700', color: '#0F172A',
                      outline: 'none', backgroundColor: isAlreadyCompleted ? '#F1F5F9' : '#FFFFFF',
                      cursor: isAlreadyCompleted ? 'not-allowed' : 'text',
                      boxSizing: 'border-box'
                    }}
                   />
                </div>
              </div>

              {/* Cash order: confirm full amount received + optional challan number */}
              {isCashTerms && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px', padding: '12px 14px' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#065F46', marginBottom: '6px' }}>
                      Have you received the full amount? <span style={{ color: '#EF4444' }}>*</span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      {['Yes', 'No'].map(opt => (
                        <label key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#0F172A', cursor: isAlreadyCompleted ? 'not-allowed' : 'pointer' }}>
                          <input
                            type="radio"
                            name="cashFullAmountReceived"
                            value={opt}
                            disabled={isAlreadyCompleted}
                            checked={accVerif.cashFullAmountReceived === opt}
                            onChange={() => setAccountsVerificationModal(prev => prev ? ({
                              ...prev,
                              accountsVerification: { ...(prev.accountsVerification || {}), cashFullAmountReceived: opt }
                            }) : null)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                    {accVerif.cashFullAmountReceived === 'No' && (
                      <div style={{ fontSize: '11px', color: '#B91C1C', fontWeight: '700', marginTop: '6px' }}>
                        This order cannot move to the next step until the full cash amount is received.
                      </div>
                    )}
                  </div>
                  <div>
                    <label htmlFor="accounts-cash-challan-no" style={{ fontSize: '12px', fontWeight: '700', color: '#065F46', display: 'block', marginBottom: '6px' }}>
                      Challan Number (optional)
                    </label>
                    <input
                      id="accounts-cash-challan-no"
                      name="cashChallanNo"
                      type="text"
                      disabled={isAlreadyCompleted}
                      value={accVerif.cashChallanNo || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAccountsVerificationModal(prev => prev ? ({
                          ...prev,
                          accountsVerification: { ...(prev.accountsVerification || {}), cashChallanNo: val }
                        }) : null);
                      }}
                      style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '600', color: '#0F172A', boxSizing: 'border-box', backgroundColor: isAlreadyCompleted ? '#F1F5F9' : '#FFFFFF' }}
                    />
                  </div>
                </div>
              )}

              {/* Adjust Payment (Accounts Only — Only visible if enabled by Accounts person or if an amount was entered) */}
              {(() => {
                const isReadOnly = isAlreadyCompleted || isAccountsViewOnly;
                // In View/Completed mode: ONLY show if an adjustment was actually entered/recorded
                if (isReadOnly) {
                  if (adjustedAmountNum <= 0) return null;
                  return (
                    <div style={{ marginTop: '14px' }}>
                      <div style={{
                        backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD',
                        borderRadius: '12px', padding: '14px',
                        display: 'flex', flexDirection: 'column', gap: '10px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0369A1' }}>
                            Adjusted Payment (From Previous Payment / Advance)
                          </span>
                          <span style={{
                            fontSize: '11px', fontWeight: '800', padding: '2px 9px', borderRadius: '999px',
                            backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0'
                          }}>
                            Adjusted: ₹ {adjustedAmountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '10px' }}>
                          <div>
                            <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '2px' }}>Adjusted Amount</div>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>₹ {adjustedAmountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                          </div>
                          {adjustedFromRef && (
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '2px' }}>Reference</div>
                              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{adjustedFromRef}</div>
                            </div>
                          )}
                          {adjustedNote && (
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '2px' }}>Note</div>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{adjustedNote}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                // In active Verification mode: show button or form
                if (!showAdjustPayment && adjustedAmountNum <= 0) {
                  return (
                    <div style={{ marginTop: '14px' }}>
                      <button
                        type="button"
                        onClick={() => setShowAdjustPayment(true)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '8px 14px', borderRadius: '8px',
                          border: '1px solid #0E7490', backgroundColor: '#ECFEFF',
                          color: '#0E7490', fontSize: '12px', fontWeight: '800', cursor: 'pointer'
                        }}
                      >
                        + Adjust Payment
                      </button>
                    </div>
                  );
                }

                return (
                  <div style={{ marginTop: '14px' }}>
                    <div style={{
                      backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD',
                      borderRadius: '12px', padding: '14px',
                      display: 'flex', flexDirection: 'column', gap: '12px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#0369A1' }}>
                          Adjust Payment (From Previous Payment / Advance)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAdjustPayment(false);
                            setAccountsVerificationModal(prev => prev ? ({
                              ...prev,
                              accountsVerification: {
                                ...(prev.accountsVerification || {}),
                                adjustedAmount: '',
                                adjustedFromRef: '',
                                adjustedNote: ''
                              }
                            }) : null);
                          }}
                          style={{
                            border: '1px solid #FECACA', backgroundColor: '#FEF2F2',
                            color: '#DC2626', borderRadius: '6px', padding: '4px 10px',
                            fontSize: '11px', fontWeight: '700', cursor: 'pointer'
                          }}
                        >
                          Remove Adjustment
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                            Adjusted Amount (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="e.g. 40000"
                            value={adjustedAmountRaw}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAccountsVerificationModal(prev => prev ? ({
                                ...prev,
                                accountsVerification: { ...(prev.accountsVerification || {}), adjustedAmount: val }
                              }) : null);
                            }}
                            style={{
                              width: '100%', height: '38px', borderRadius: '8px',
                              border: '1px solid #93C5FD', padding: '0 10px',
                              fontSize: '13px', fontWeight: '700', color: '#0F172A',
                              backgroundColor: '#FFFFFF',
                              boxSizing: 'border-box', outline: 'none'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                            Previous Order / Receipt Ref (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="Optional — e.g. PI-00045 / UTR-XXXX"
                            value={adjustedFromRef}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAccountsVerificationModal(prev => prev ? ({
                                ...prev,
                                accountsVerification: { ...(prev.accountsVerification || {}), adjustedFromRef: val }
                              }) : null);
                            }}
                            style={{
                              width: '100%', height: '38px', borderRadius: '8px',
                              border: '1px solid #93C5FD', padding: '0 10px',
                              fontSize: '12.5px', fontWeight: '600', color: '#0F172A',
                              backgroundColor: '#FFFFFF',
                              boxSizing: 'border-box', outline: 'none'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>
                            Note (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Excess from old order"
                            value={adjustedNote}
                            onChange={(e) => {
                              const val = e.target.value;
                              setAccountsVerificationModal(prev => prev ? ({
                                ...prev,
                                accountsVerification: { ...(prev.accountsVerification || {}), adjustedNote: val }
                              }) : null);
                            }}
                            style={{
                              width: '100%', height: '38px', borderRadius: '8px',
                              border: '1px solid #93C5FD', padding: '0 10px',
                              fontSize: '12.5px', fontWeight: '600', color: '#0F172A',
                              backgroundColor: '#FFFFFF',
                              boxSizing: 'border-box', outline: 'none'
                            }}
                          />
                        </div>
                      </div>

                      {(() => {
                        const targetOrderAmt = orderValue > 0 ? orderValue : cleanNum(accountsVerificationModal?.grandTotal, 0);
                        const remainingBal = Math.max(0, targetOrderAmt - effectiveTotalAmountNum);
                        return (
                          <div style={{
                            display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center',
                            padding: '8px 12px', borderRadius: '8px', backgroundColor: '#FFFFFF',
                            border: '1px solid #E0F2FE', fontSize: '12px', fontWeight: '700'
                          }}>
                            <span style={{ color: '#475569' }}>Order Total: <strong style={{ color: '#0F172A' }}>₹ {targetOrderAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                            <span style={{ color: '#475569' }}>Paid Now: <strong style={{ color: '#0E7490' }}>₹ {verifiedSlipAmountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                            <span style={{ color: '#475569' }}>Adjusted: <strong style={{ color: '#0369A1' }}>₹ {adjustedAmountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                            <span style={{ color: '#475569' }}>Total Settled: <strong style={{ color: '#059669' }}>₹ {effectiveTotalAmountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></span>
                            {targetOrderAmt > 0 && (
                              <span style={{ color: remainingBal <= 0 ? '#059669' : '#B45309' }}>
                                Balance: <strong>₹ {remainingBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {/* Customer Credit Terms & Credit Amount Notice for Accounts Verification */}
          {(() => {
            const isCredit = currentPayStatus === 'Credit Payment' || 
              String(accountsVerificationModal?.paymentType || accountsVerificationModal?.paymentTerms || '').toLowerCase().includes('credit') ||
              Number(accountsVerificationModal?.creditDays || 0) > 0;
            const cDays = Number(accountsVerificationModal?.creditDays || 30);
            const totalVal = cleanNum(currentTotalAmount, 0) || cleanNum(accountsVerificationModal?.grandTotal, 0);
            if (!isCredit) return null;

            // Helper to check if a BOM's credit has been settled
            const isBomCreditSettled = (item) => {
              if (!item) return true;
              if (item.creditSettled || item.paymentSettled || item.paymentUpdated) return true;
              const s = String(item.status || '').toLowerCase();
              if (s.includes('credit settled') || s.includes('payment settled') || s.includes('payment uploaded & settled')) return true;
              const accItem = item.accountsVerification || {};
              if (accItem.creditSettled || accItem.paymentStatus === 'Credit Settled (100% Paid)') return true;
              return false;
            };

            const allBoms = (Array.isArray(bomStore) && bomStore.length > 0)
              ? bomStore
              : (() => {
                  try {
                    const localBoms = localStorage.getItem('controlroom_bom_store');
                    return localBoms ? JSON.parse(localBoms) : [];
                  } catch (_) { return []; }
                })();

            const normCust = (name) => String(name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            const m = accountsVerificationModal || {};
            const bCustNorm = normCust(m.customerName || m.companyName || m.c2 || m.vendor || m.clientName);
            const bGstNorm = String(m.gstNo || m.customerGst || m.c3 || '').toUpperCase().trim();
            const bCode = m.bomCode || m.code || m.id;

            let prevUnsettledCredit = 0;
            if (bCustNorm.length >= 2 || bGstNorm.length >= 5) {
              allBoms.forEach(other => {
                const otherCode = other.bomCode || other.code || other.id;
                if (!otherCode || otherCode === bCode) return;
                if (other.cancelled || other.status === 'Cancelled' || other.status === 'Cancelled & Stock Restored' || (typeof other.status === 'string' && other.status.toLowerCase().includes('cancel'))) return;

                const otherCustNorm = normCust(other.customerName || other.companyName || other.c2 || other.vendor || other.clientName);
                const otherGstNorm = String(other.gstNo || other.customerGst || other.c3 || '').toUpperCase().trim();
                const isMatch = (bGstNorm && otherGstNorm && bGstNorm === otherGstNorm) ||
                  (bCustNorm && otherCustNorm && (bCustNorm === otherCustNorm || bCustNorm.includes(otherCustNorm) || otherCustNorm.includes(bCustNorm)));
                if (!isMatch) return;

                const otherPType = String(other.paymentType || other.paymentTerms || other.accountsVerification?.paymentStatus || '').toLowerCase();
                const otherCDays = Number(other.creditDays || 0);
                const isOtherCredit = otherPType.includes('credit') || otherPType.includes('net 30') || otherCDays > 0;

                if (isOtherCredit && !isBomCreditSettled(other)) {
                  const otherAmt = Number(other.accountsVerification?.totalAmount || other.grandTotal || other.subTotal || other.totalAmount || 0);
                  if (otherAmt > 0) {
                    prevUnsettledCredit += otherAmt;
                  }
                }
              });
            }

            const totalCreditRisk = prevUnsettledCredit + totalVal;

            return (
              <div style={{
                marginTop: '12px',
                padding: '12px 16px',
                borderRadius: '10px',
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                fontSize: '12px',
                color: '#1E40AF'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={18} style={{ color: '#2563EB', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: '800', color: '#1E3A8A' }}>
                      Customer Credit Terms: {cDays} Days Credit Cycle
                    </div>
                    {prevUnsettledCredit > 0 && (
                      <span style={{ fontSize: '11px', color: '#B45309', fontWeight: '700', backgroundColor: '#FEF3C7', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '3px' }}>
                        ⚠️ ₹ {prevUnsettledCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Previous Unsettled Credit
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Total Customer Credit:</div>
                  <strong style={{ fontSize: '15px', color: '#1E3A8A', fontWeight: '800' }}>
                    {totalCreditRisk > 0 ? `₹ ${totalCreditRisk.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Order Total'}
                  </strong>
                  {prevUnsettledCredit > 0 && totalVal > 0 && (
                    <div style={{ fontSize: '10.5px', color: '#64748B' }}>
                      (₹{prevUnsettledCredit.toLocaleString('en-IN')} Prev + ₹{totalVal.toLocaleString('en-IN')} Current)
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Payment Proof Document & Remittance Slip Image Inspection */}
          {(() => {
            const rawProof = accountsVerificationModal.paymentProofDoc ||
              accountsVerificationModal.balancePaymentProofDoc ||
              accountsVerificationModal.balanceProofDoc ||
              accountsVerificationModal.payments?.proofDocObj ||
              accountsVerificationModal.payments?.balanceProofDocObj ||
              accountsVerificationModal.payments?.proofDoc ||
              accountsVerificationModal.payments?.balanceProofDoc ||
              accountsVerificationModal.proofDoc ||
              accountsVerificationModal.salesPoDetails?.proofDocObj ||
              accountsVerificationModal.salesPoDetails?.balanceProofDocObj ||
              null;

            let fallbackDocName = null;
            if (rawProof) {
              if (typeof rawProof === 'string' && !rawProof.startsWith('data:')) {
                fallbackDocName = rawProof;
              } else if (rawProof.name) {
                fallbackDocName = rawProof.name;
              } else if (rawProof.originalName) {
                fallbackDocName = rawProof.originalName;
              }
            }
            if (!fallbackDocName && accountsVerificationModal.paymentProofDocName) {
              fallbackDocName = accountsVerificationModal.paymentProofDocName;
            }
            if (!fallbackDocName && accountsVerificationModal.payments?.proofDoc) {
              fallbackDocName = accountsVerificationModal.payments.proofDoc;
            }
            if (!fallbackDocName && accountsVerificationModal.payments?.balanceProofDoc) {
              fallbackDocName = accountsVerificationModal.payments.balanceProofDoc;
            }

            const docName = fallbackDocName || (rawProof ? 'Payment_Proof' : null);
            const pDocDataUrl = resolvedProofDataUrl ||
              resolveDocumentUrl(rawProof) ||
              ((typeof rawProof === 'string' && rawProof.startsWith('data:')) ? rawProof : null) ||
              (rawProof?.dataUrl || rawProof?.fileData || rawProof?.url || accountsVerificationModal.proofDocData || accountsVerificationModal.payments?.proofDocData || null) ||
              (fallbackDocName ? getMediaFromCache(fallbackDocName) : null);

            const allPaymentDocs = (() => {
              const candidates = [
                ...(Array.isArray(accountsVerificationModal.paymentProofDocs) ? accountsVerificationModal.paymentProofDocs : []),
                ...(Array.isArray(accountsVerificationModal.balancePaymentProofDocs) ? accountsVerificationModal.balancePaymentProofDocs : []),
                ...(Array.isArray(accountsVerificationModal.payments?.proofDocObjs) ? accountsVerificationModal.payments.proofDocObjs : []),
                ...(Array.isArray(accountsVerificationModal.payments?.proofDocs) ? accountsVerificationModal.payments.proofDocs : []),
                ...(Array.isArray(accountsVerificationModal.uploadedDocuments)
                  ? accountsVerificationModal.uploadedDocuments.filter(d =>
                      (d?.category && String(d.category).toLowerCase().includes('payment')) ||
                      (d?.type && String(d.type).toLowerCase().includes('payment')) ||
                      (d?.name && String(d.name).toLowerCase().includes('payment'))
                    )
                  : []),
                ...(accountsVerificationModal.paymentProofDoc ? (Array.isArray(accountsVerificationModal.paymentProofDoc) ? accountsVerificationModal.paymentProofDoc : [accountsVerificationModal.paymentProofDoc]) : []),
                ...(accountsVerificationModal.balancePaymentProofDoc ? [accountsVerificationModal.balancePaymentProofDoc] : []),
                ...(accountsVerificationModal.balanceProofDoc ? [accountsVerificationModal.balanceProofDoc] : []),
                ...(accountsVerificationModal.payments?.proofDocObj ? [accountsVerificationModal.payments.proofDocObj] : []),
                ...(accountsVerificationModal.payments?.balanceProofDocObj ? [accountsVerificationModal.payments.balanceProofDocObj] : []),
                ...(accountsVerificationModal.salesPoDetails?.proofDocObj ? [accountsVerificationModal.salesPoDetails.proofDocObj] : []),
                ...(accountsVerificationModal.salesPoDetails?.balanceProofDocObj ? [accountsVerificationModal.salesPoDetails.balanceProofDocObj] : []),
                ...(Array.isArray(resolvedMatchedPi?.paymentProofDocs) ? resolvedMatchedPi.paymentProofDocs : []),
                ...(resolvedMatchedPi?.paymentProofDoc ? (Array.isArray(resolvedMatchedPi.paymentProofDoc) ? resolvedMatchedPi.paymentProofDoc : [resolvedMatchedPi.paymentProofDoc]) : []),
                ...(Array.isArray(resolvedMatchedPi?.payments?.proofDocObjs) ? resolvedMatchedPi.payments.proofDocObjs : []),
                ...(rawProof ? [typeof rawProof === 'object' ? rawProof : { name: rawProof }] : [])
              ].filter(Boolean);

              const seen = new Set();
              const deduped = [];
              for (const d of candidates) {
                const docObj = typeof d === 'object' ? d : { name: String(d) };
                const key = docObj.storagePath || docObj.url || docObj.name || docObj.originalName || JSON.stringify(docObj);
                if (key && !seen.has(key)) {
                  seen.add(key);
                  deduped.push(docObj);
                }
              }
              return deduped;
            })();

            const hasAnyPaymentProof = allPaymentDocs.length > 0 || hasUploadedPaymentProof;

            return (
              <div style={{
                marginTop: '4px',
                paddingTop: '16px',
                borderTop: '1px solid #F1F5F9'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                    <Image size={15} style={{ color: '#2563EB' }} /> Payment Proof Documents & Remittance Slips ({allPaymentDocs.length})
                  </label>
                  {allPaymentDocs.length > 0 && (
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '4px', border: '1px solid #BBF7D0' }}>
                      ✓ Verified & Attached by Sales ({allPaymentDocs.length} {allPaymentDocs.length > 1 ? 'Files' : 'File'})
                    </span>
                  )}
                </div>

                {hasAnyPaymentProof ? (
                  <div style={{
                    backgroundColor: '#F8FAFC',
                    border: '1.5px dashed #CBD5E1',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'grid',
                    gridTemplateColumns: allPaymentDocs.length > 1 ? 'repeat(auto-fill, minmax(180px, 1fr))' : '1fr',
                    gap: '12px'
                  }}>
                    {allPaymentDocs.map((docItem, dIdx) => {
                      const docName = typeof docItem === 'string' ? docItem : (docItem?.originalName || docItem?.name || `Payment_Proof_${dIdx + 1}`);
                      const directUrl = (typeof docItem === 'string' && docItem.startsWith('data:'))
                        ? docItem
                        : (docItem?.dataUrl || docItem?.fileData || docItem?.url || null);
                      const pDocDataUrl = directUrl || getMediaFromCache(docName) || resolveDocumentUrl(docItem);
                      const isDocPdf = Boolean(
                        (docName && docName.toLowerCase().endsWith('.pdf')) ||
                        (docItem && (docItem.type === 'application/pdf' || docItem.mimeType === 'application/pdf')) ||
                        (pDocDataUrl && (pDocDataUrl.toLowerCase().includes('.pdf') || pDocDataUrl.startsWith('data:application/pdf')))
                      );

                      return (
                        <div key={dIdx} style={{
                          backgroundColor: '#FFFFFF',
                          border: '1px solid #E2E8F0',
                          borderRadius: '10px',
                          padding: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
                        }}>
                          <div
                            onClick={() => setViewingProofDocModal({
                              ...accountsVerificationModal,
                              targetDoc: docItem,
                              targetDocUrl: pDocDataUrl,
                              targetDocName: docName,
                              docTitle: `Payment Proof #${dIdx + 1}: ${docName}`
                            })}
                            style={{
                              cursor: 'pointer',
                              width: '100%',
                              height: '110px',
                              borderRadius: '6px',
                              overflow: 'hidden',
                              backgroundColor: '#F8FAFC',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid #F1F5F9'
                            }}
                            title="Click to view full payment slip"
                          >
                            <ResilientDocThumbnail
                              docUrl={pDocDataUrl}
                              docName={docName}
                              isPdf={isDocPdf}
                              fallbackColor="#2563EB"
                              alt={docName}
                            />
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '11.5px', fontWeight: '800', color: '#0F172A', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={docName}>
                              {docName}
                            </div>
                            {docItem?.size && (
                              <span style={{ fontSize: '10px', color: '#64748B' }}>
                                {(docItem.size / 1024).toFixed(0)} KB • Verified Slip
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                            <button
                              type="button"
                              onClick={() => setViewingProofDocModal({
                                ...accountsVerificationModal,
                                targetDoc: docItem,
                                targetDocUrl: pDocDataUrl,
                                targetDocName: docName,
                                docTitle: `Payment Proof #${dIdx + 1}: ${docName}`
                              })}
                              style={{
                                flex: 1,
                                backgroundColor: '#EFF6FF',
                                border: '1px solid #BFDBFE',
                                color: '#1D4ED8',
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '3px'
                              }}
                            >
                              <Eye size={11} /> View
                            </button>
                            {(pDocDataUrl || docName) && (
                              <a
                                href={pDocDataUrl || `/api/uploads/${encodeURIComponent(docName)}`}
                                download={docName}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  backgroundColor: '#F8FAFC',
                                  border: '1px solid #CBD5E1',
                                  color: '#334155',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '3px'
                                }}
                              >
                                <Download size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (isWhileDispatch && !hasUploadedPaymentProof) ? (
                  <div
                    style={{
                      backgroundColor: '#FEF2F2',
                      border: '1.5px dashed #F87171',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626', flexShrink: 0 }}>
                        <AlertTriangle size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>Awaiting Payment Slip from Salesperson</span>
                          <span style={{ fontSize: '10px', color: '#DC2626', backgroundColor: '#FEE2E2', border: '1px solid #FECACA', padding: '1px 8px', borderRadius: '4px', fontWeight: '800' }}>HOLD</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#B91C1C', marginTop: '3px', lineHeight: '1.4' }}>
                          Sales team must upload the dispatch settlement payment receipt via <strong>Update Payment</strong> before this order can be verified or passed to Billing.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (docName || rawProof || pDocDataUrl) ? (
                  <div
                    onClick={() => setViewingProofDocModal({
                      ...accountsVerificationModal,
                      targetDoc: rawProof,
                      targetDocUrl: pDocDataUrl,
                      targetDocName: docName,
                      docTitle: 'Payment Proof Document & Remittance Slip'
                    })}
                    style={{
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      flexWrap: 'wrap',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F1F5F9'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                        <Receipt size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{docName || 'Payment Proof Attachment'}</span>
                          <span style={{ fontSize: '10px', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>Click to View</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                          Payment advice recorded for {bomCodeText}. Click anywhere to view the remittance slip & verification record.
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingProofDocModal({
                            ...accountsVerificationModal,
                            targetDoc: rawProof,
                            targetDocUrl: pDocDataUrl,
                            targetDocName: docName,
                            docTitle: 'Payment Proof Document & Remittance Slip'
                          });
                        }}
                        style={{
                          backgroundColor: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          color: '#1D4ED8',
                          fontSize: '11.5px',
                          fontWeight: '700',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <Eye size={13} /> View Attached Slip
                      </button>
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
                    {isPartialPaidTerms && !hasBalancePaymentProof && (
                      <div style={{
                        width: '100%',
                        marginTop: '10px',
                        backgroundColor: '#FFFBEB',
                        border: '1.5px solid #F59E0B',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#92400E' }}>
                          ⚠️ Initial advance proof is attached above, but <strong>Remaining Balance Payment Proof</strong> is still pending from Sales.
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => notifySalesForMissingPaymentProof({
                              ...accountsVerificationModal,
                              effectiveTotalAmountNum,
                              payType
                            })}
                            style={{
                              backgroundColor: '#D97706',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: '800',
                              color: '#FFFFFF',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(217, 119, 6, 0.3)',
                              transition: 'all 0.15s ease'
                            }}
                            title="Send alert to assigned Salesperson via WhatsApp & In-App Notification"
                          >
                            <BellRing size={12} color="#FFFFFF" /> Notify Sales / Send Alert
                          </button>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#DC2626', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', padding: '4px 10px', borderRadius: '6px' }}>
                            Payment Proof Pending
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (requiresPaymentProofForApproval || (is100PaidTerms && !isCreditTerms && !isDcOrder)) ? (
                  <div style={{
                    backgroundColor: '#FFFBEB',
                    border: '1.5px solid #F59E0B',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
                        <AlertTriangle size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#92400E', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>Payment Proof Pending — Not Attached by Sales</span>
                          <span style={{ fontSize: '10px', color: '#B45309', backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>Action Required (Sales)</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#B45309', marginTop: '2px' }}>
                          Payment Terms: <strong>{payType || 'Payment While Dispatch / Partial Payment'}</strong>. Accounts verification is locked until Sales attaches the payment proof receipt.
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => notifySalesForMissingPaymentProof({
                          ...accountsVerificationModal,
                          effectiveTotalAmountNum,
                          payType
                        })}
                        style={{
                          backgroundColor: '#D97706',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '6px 14px',
                          fontSize: '11.5px',
                          fontWeight: '800',
                          color: '#FFFFFF',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(217, 119, 6, 0.3)',
                          transition: 'all 0.15s ease'
                        }}
                        title="Send alert to assigned Salesperson via WhatsApp & In-App Notification"
                      >
                        <BellRing size={13} color="#FFFFFF" /> Notify Sales / Send Alert
                      </button>
                      <div style={{
                        backgroundColor: '#FEF2F2',
                        border: '1px solid #FECACA',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: '800',
                        color: '#DC2626',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        <Clock size={13} color="#DC2626" /> Payment Proof Pending
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
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>Payment Terms: {currentPayConfig?.label || 'Credit / Standard Terms'}</span>
                          <span style={{ fontSize: '10px', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>Terms Confirmed</span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                          Standard credit / agreed terms for {bomCodeText}. Payment slip will be collected upon credit cycle settlement.
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
                      <CheckCircle size={13} color="#0E7490" /> Verified via Terms
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

        // Pre-fetch source PI items if available for maximum rate resolution accuracy
        let sourcePiItems = [];
        let matchedPi = null;
        if (accountsVerificationModal.sourcePiNo || accountsVerificationModal.piNo) {
          try {
            const rawPiStore = typeof window !== 'undefined' ? (localStorage.getItem('controlroom_pi_store') || localStorage.getItem('businz_pi_store')) : null;
            if (rawPiStore) {
              const parsedPis = JSON.parse(rawPiStore);
              const piList = Array.isArray(parsedPis) ? parsedPis : (parsedPis.pis || []);
              const targetPiNo = accountsVerificationModal.sourcePiNo || accountsVerificationModal.piNo;
              matchedPi = piList.find(p => p.piNo === targetPiNo || p.id === targetPiNo);
              if (matchedPi && Array.isArray(matchedPi.items)) {
                sourcePiItems = matchedPi.items;
              }
            }
          } catch (_) {}
        }

        const dynamicAccItems = rawAccItems.map((it, idx) => {
          const q = parseFloat(it.qty || it.bomQty || 1) || 1;
          const packedArr = Array.isArray(accountsVerificationModal.dispatchPacking) ? accountsVerificationModal.dispatchPacking : [];
          const origItemsArr = Array.isArray(accountsVerificationModal.items) ? accountsVerificationModal.items : [];
          const sameIdxOrig = origItemsArr[idx] && (
            (origItemsArr[idx].code && it.code && origItemsArr[idx].code === it.code) ||
            (origItemsArr[idx].name && it.name && origItemsArr[idx].name.toLowerCase().trim() === it.name.toLowerCase().trim())
          ) ? origItemsArr[idx] : null;
          const sameIdxPacked = packedArr[idx] && (
            (packedArr[idx].code && it.code && packedArr[idx].code === it.code) ||
            (packedArr[idx].name && it.name && packedArr[idx].name.toLowerCase().trim() === it.name.toLowerCase().trim())
          ) ? packedArr[idx] : null;
          const resolvedGroupId = it.presetGroupId || sameIdxOrig?.presetGroupId || sameIdxPacked?.presetGroupId || null;
          const matchingPacked = sameIdxPacked || packedArr.find(p =>
            (!resolvedGroupId || !p.presetGroupId || String(p.presetGroupId) === String(resolvedGroupId)) &&
            ((p.name && it.name && p.name.toLowerCase().trim() === it.name.toLowerCase().trim()) || (p.code && it.code && p.code === it.code))
          );
          const pQty = (it.packedQty !== undefined && it.packedQty !== null && it.packedQty !== '')
            ? it.packedQty
            : (matchingPacked && matchingPacked.packedQty !== undefined && matchingPacked.packedQty !== null && matchingPacked.packedQty !== '' ? matchingPacked.packedQty : (it.packed ? q : 0));

          let r = parseFloat(
            it.rate !== undefined && it.rate !== null && it.rate !== '' ? it.rate :
            it.unitPrice !== undefined ? it.unitPrice :
            it.unit_price !== undefined ? it.unit_price :
            it.price !== undefined ? it.price :
            it.unitRate !== undefined ? it.unitRate :
            it.unit_rate !== undefined ? it.unit_rate :
            it.selling_rate !== undefined ? it.selling_rate :
            it.sellingPrice !== undefined ? it.sellingPrice : 0
          ) || 0;

          // Check line totals if unit rate was not directly provided
          if (r === 0) {
            const lineAmt = parseFloat(it.taxable || it.lineTotal || it.amount || it.amt || it.subtotal || it.total || 0) || 0;
            if (lineAmt > 0 && q > 0) {
              r = Math.round((lineAmt / q) * 100) / 100;
            }
          }

          // Check original items array if it came from dispatchPacking
          if (r === 0 && Array.isArray(accountsVerificationModal.items)) {
            const match = accountsVerificationModal.items.find(m => 
              (m.code && it.code && m.code === it.code) || 
              (m.name && it.name && m.name.toLowerCase().trim() === it.name.toLowerCase().trim())
            );
            if (match) {
              r = parseFloat(
                match.rate !== undefined && match.rate !== null && match.rate !== '' ? match.rate :
                match.unitPrice !== undefined ? match.unitPrice :
                match.unit_price !== undefined ? match.unit_price :
                match.price !== undefined ? match.price :
                match.unitRate !== undefined ? match.unitRate : 0
              ) || 0;
              if (r === 0) {
                const matchAmt = parseFloat(match.taxable || match.lineTotal || match.amount || match.amt || 0) || 0;
                const matchQ = parseFloat(match.qty || match.bomQty || 1) || 1;
                if (matchAmt > 0 && matchQ > 0) {
                  r = Math.round((matchAmt / matchQ) * 100) / 100;
                }
              }
            }
          }

          // Check source PI items
          if (r === 0 && sourcePiItems.length > 0) {
            const piMatch = sourcePiItems.find(piIt => 
              (piIt.code && it.code && piIt.code === it.code) ||
              (piIt.name && it.name && piIt.name.toLowerCase().trim() === it.name.toLowerCase().trim())
            );
            if (piMatch) {
              r = parseFloat(
                piMatch.rate !== undefined && piMatch.rate !== null && piMatch.rate !== '' ? piMatch.rate :
                piMatch.unitPrice !== undefined ? piMatch.unitPrice :
                piMatch.unit_price !== undefined ? piMatch.unit_price :
                piMatch.price !== undefined ? piMatch.price : 0
              ) || 0;
              if (r === 0) {
                const piAmt = parseFloat(piMatch.taxable || piMatch.lineTotal || piMatch.amount || piMatch.amt || 0) || 0;
                const piQ = parseFloat(piMatch.qty || 1) || 1;
                if (piAmt > 0 && piQ > 0) {
                  r = Math.round((piAmt / piQ) * 100) / 100;
                }
              }
            }
          }

          return {
            ...it,
            code: it.code || `PRD-00${idx + 1}`,
            name: it.name || `Item ${idx + 1}`,
            desc: it.category || it.desc || 'Standard component',
            qty: q,
            packedQty: pQty,
            uom: it.uom || 'Nos',
            rate: r,
            amt: q * r,
            packed: it.packed !== undefined ? Boolean(it.packed) : (matchingPacked ? Boolean(matchingPacked.packed) : true),
            isPresetItem: Boolean(it.isPresetItem || sameIdxOrig?.isPresetItem || matchingPacked?.isPresetItem || resolvedGroupId),
            presetGroupId: resolvedGroupId || matchingPacked?.presetGroupId || null,
            presetName: it.presetName || sameIdxOrig?.presetName || matchingPacked?.presetName || ''
          };
        });

        const bomPG = accountsVerificationModal.presetGroups;
        const hasBomPG = Array.isArray(bomPG) ? bomPG.length > 0 : Boolean(bomPG && typeof bomPG === 'object' && Object.keys(bomPG).length > 0);
        const rawPresetGroups = hasBomPG ? bomPG : (matchedPi?.presetGroups || resolvedMatchedPi?.presetGroups || {});
        let pGroups = (Array.isArray(rawPresetGroups) && rawPresetGroups.length > 0)
          ? rawPresetGroups.map((g, i) => ({ ...g, groupId: g?.groupId || g?.id || `preset-${i + 1}` }))
          : (typeof rawPresetGroups === 'object' && Object.keys(rawPresetGroups).length > 0)
            ? Object.entries(rawPresetGroups).map(([key, val]) => ({ ...val, groupId: val?.groupId || val?.id || key }))
            : [];

        // Order Subtotal and Grand Total
        const gTotal = cleanNum(accountsVerificationModal?.grandTotal) || cleanNum(matchedPi?.grandTotal) || orderValue || 0;
        const modalGstMult = 1 + (extractGstRate(accountsVerificationModal?.gstRate ?? matchedPi?.gstRate, 18) / 100);
        const sTotal = cleanNum(accountsVerificationModal?.subTotal) || cleanNum(accountsVerificationModal?.subtotal) || cleanNum(matchedPi?.subTotal) || cleanNum(matchedPi?.subtotal) || (gTotal > 0 ? Math.round((gTotal / modalGstMult) * 100) / 100 : 0);

        // Comprehensive Detection of Preset Structure Packages
        const hasPresetMetadata = Boolean(
          accountsVerificationModal.presetName ||
          accountsVerificationModal.preset ||
          accountsVerificationModal.presetId ||
          accountsVerificationModal.presetTitle ||
          accountsVerificationModal.selectedPreset ||
          accountsVerificationModal.isPresetOrder ||
          matchedPi?.presetName ||
          matchedPi?.preset ||
          matchedPi?.isPresetOrder ||
          cleanNum(accountsVerificationModal.presetKitPrice) > 0 ||
          cleanNum(accountsVerificationModal.kitPrice) > 0 ||
          cleanNum(accountsVerificationModal.kitSubtotal) > 0 ||
          cleanNum(matchedPi?.presetKitPrice) > 0 ||
          cleanNum(matchedPi?.kitPrice) > 0 ||
          cleanNum(matchedPi?.kitSubtotal) > 0 ||
          dynamicAccItems.some(it => it.isPresetItem || it.presetGroupId || it.presetName) ||
          (dynamicAccItems.length > 0 && dynamicAccItems.every(it => cleanNum(it.rate) === 0) && (orderValue > 0 || gTotal > 0 || sTotal > 0))
        );

        if (pGroups.length === 0 && hasPresetMetadata) {
          const detectedName = accountsVerificationModal.presetName ||
            accountsVerificationModal.presetTitle ||
            accountsVerificationModal.preset ||
            (typeof accountsVerificationModal.selectedPreset === 'string' ? accountsVerificationModal.selectedPreset : accountsVerificationModal.selectedPreset?.name) ||
            matchedPi?.presetName ||
            matchedPi?.presetTitle ||
            matchedPi?.preset ||
            dynamicAccItems.find(it => it.presetName)?.presetName ||
            'Pre-Engineered Structure Kit Package';

          const sCount = parseFloat(accountsVerificationModal.presetSetCount) || parseFloat(accountsVerificationModal.setCount) || parseFloat(matchedPi?.presetSetCount) || parseFloat(matchedPi?.setCount) || 1;
          const knownCustomTotal = dynamicAccItems.filter(it => !it.isPresetItem && !it.presetGroupId && cleanNum(it.rate) > 0).reduce((acc, it) => acc + (it.qty * cleanNum(it.rate)), 0);
          const kPrice = cleanNum(accountsVerificationModal.presetKitPrice) || cleanNum(accountsVerificationModal.kitPrice) || cleanNum(accountsVerificationModal.kitSubtotal) || cleanNum(matchedPi?.presetKitPrice) || cleanNum(matchedPi?.kitPrice) || (sTotal > knownCustomTotal ? Math.round(((sTotal - knownCustomTotal) / sCount) * 100) / 100 : (sTotal > 0 ? Math.round((sTotal / sCount) * 100) / 100 : 0));
          const pUnit = accountsVerificationModal.presetUnit || matchedPi?.presetUnit || (String(detectedName).toLowerCase().includes('kw') ? 'kW' : 'Sets');

          pGroups = [{
            presetName: detectedName,
            setCount: sCount,
            unit: pUnit,
            unitType: pUnit,
            kitPrice: kPrice
          }];
        }

        // Fallback for Kit Price if 0 but order has value
        const knownCustomTotal = dynamicAccItems.filter(it => !it.isPresetItem && !it.presetGroupId && cleanNum(it.rate) > 0).reduce((acc, it) => acc + (it.qty * cleanNum(it.rate)), 0);
        let presetKitsTotal = pGroups.reduce((acc, g) => acc + ((cleanNum(g.kitPrice) || 0) * (parseFloat(g.setCount) || 1)), 0);
        if (pGroups.length > 0 && (presetKitsTotal === 0 || presetKitsTotal === sTotal) && sTotal > knownCustomTotal) {
          const unallocatedKitSub = sTotal - knownCustomTotal;
          if (pGroups.length === 1) {
            const sCount = parseFloat(pGroups[0].setCount) || 1;
            pGroups[0].kitPrice = Math.round((unallocatedKitSub / sCount) * 100) / 100;
            presetKitsTotal = unallocatedKitSub;
          }
        }

        // Fallback for Loose/Individual Items: If items have rate 0, distribute order's taxable subtotal proportionally
        const existingCoveredSubtotal = dynamicAccItems.reduce((acc, it) => acc + (it.qty * it.rate), 0) + presetKitsTotal;
        const unallocatedRemaining = Math.max(0, sTotal - existingCoveredSubtotal);
        const zeroRateItems = dynamicAccItems.filter(it => it.rate === 0 && !it.isPresetItem && !it.presetGroupId);

        if (unallocatedRemaining > 0 && zeroRateItems.length > 0) {
          const totalZeroQty = zeroRateItems.reduce((acc, it) => acc + it.qty, 0);
          if (totalZeroQty > 0) {
            const unitRatePerQty = Math.round((unallocatedRemaining / totalZeroQty) * 100) / 100;
            zeroRateItems.forEach(it => {
              it.rate = unitRatePerQty;
              it.amt = Math.round(it.qty * it.rate * 100) / 100;
            });
          }
        }

        const PRESET_THEMES = [
          { primary: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC', tagBg: '#CFFAFE', tagText: '#155E75', badge: 'SET 1' },
          { primary: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', tagBg: '#E0E7FF', tagText: '#3730A3', badge: 'SET 2' },
          { primary: '#D97706', bg: '#FFFBEB', border: '#FDE68A', tagBg: '#FEF3C7', tagText: '#92400E', badge: 'SET 3' },
          { primary: '#059669', bg: '#ECFDF5', border: '#A7F3D0', tagBg: '#D1FAE5', tagText: '#065F46', badge: 'SET 4' },
          { primary: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', tagBg: '#EDE9FE', tagText: '#5B21B6', badge: 'SET 5' },
        ];

        // Strictly assign each BOM item to at most ONE preset group (never merge all presets into SET 1)
        const assignedItemIndices = new Set();
        const kitItemsByGroup = pGroups.map((grp, gIdx) => {
          const grpId = grp.groupId || grp.id || null;
          const grpNameLower = String(grp.presetName || '').trim().toLowerCase();
          const matched = [];
          dynamicAccItems.forEach((it, itemIdx) => {
            if (assignedItemIndices.has(itemIdx)) return;
            const byGroupId = Boolean(grpId && it.presetGroupId && String(it.presetGroupId) === String(grpId));
            const byPresetName = Boolean(!it.presetGroupId && grpNameLower && String(it.presetName || '').trim().toLowerCase() === grpNameLower);
            const isZeroRateKitComponent = Boolean(!it.presetGroupId && !it.presetName && (it.isPresetItem || cleanNum(it.rate) === 0) && gIdx === 0);
            if (byGroupId || byPresetName || isZeroRateKitComponent) {
              assignedItemIndices.add(itemIdx);
              matched.push(it);
            }
          });
          return matched;
        });
        if (pGroups.length === 1 && kitItemsByGroup[0].length === 0) {
          dynamicAccItems.forEach((it, itemIdx) => {
            if (it.isPresetItem || cleanNum(it.rate) === 0) {
              assignedItemIndices.add(itemIdx);
              kitItemsByGroup[0].push(it);
            }
          });
        }

        const looseAccItems = pGroups.length > 0
          ? dynamicAccItems.filter((it, itemIdx) => !assignedItemIndices.has(itemIdx) && !it.presetGroupId)
          : dynamicAccItems;

        // Compute subtotal & GST without double-counting preset components and using each preset's actual GST rate
        const standaloneSubTotal = looseAccItems.reduce((acc, curr) => acc + curr.amt, 0);
        const accSubTotal = standaloneSubTotal + presetKitsTotal;
        const defaultOrderGstPct = extractGstRate(accountsVerificationModal?.gstRate ?? matchedPi?.gstRate, 18);
        const presetGstTotal = pGroups.reduce((acc, grp, gIdx) => {
          const gItems = kitItemsByGroup[gIdx] || [];
          const kTotal = (parseFloat(grp.setCount) || 1) * (cleanNum(grp.kitPrice) || 0);
          const rawGst = grp.gstRate || gItems[0]?.gstRate || (String(grp.presetName || '').toLowerCase().includes('bos') && String(grp.presetName || '').toLowerCase().includes('dcr') ? 5 : defaultOrderGstPct);
          const pct = parseFloat(String(rawGst).replace('%', ''));
          const safePct = Number.isFinite(pct) ? pct : defaultOrderGstPct;
          return acc + (kTotal * safePct / 100);
        }, 0);
        const standaloneGstTotal = looseAccItems.reduce((acc, curr) => {
          const pct = parseFloat(String(curr.gstRate ?? defaultOrderGstPct).replace('%', ''));
          const safePct = Number.isFinite(pct) ? pct : defaultOrderGstPct;
          return acc + (curr.amt * safePct / 100);
        }, 0);
        const accTotalGst = presetGstTotal + standaloneGstTotal;
        const accGrandTotal = accSubTotal + accTotalGst;

        return (
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            overflow: 'hidden'
          }}>
            {/* ── Section Header ── */}
            <div style={{
              padding: '18px 24px',
              background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0E7490, #0891B2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(14,116,144,0.4)'
                }}>
                  <FileText style={{ width: '18px', height: '18px', color: '#FFFFFF' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#FFFFFF', margin: 0 }}>
                      BOM Items & Pricing Verification
                    </h3>
                    <span style={{
                      padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                      backgroundColor: 'rgba(14,116,144,0.3)', color: '#67E8F9',
                      border: '1px solid rgba(103,232,249,0.3)'
                    }}>
                      Official Pricing & Quantities
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#94A3B8', margin: '3px 0 0 0' }}>
                    {dynamicAccItems.length} line item{dynamicAccItems.length !== 1 ? 's' : ''} · Verify prices, quantities and pack status before clearance
                  </p>
                </div>
              </div>
              {/* Grand Total Pill in Header */}
              <div style={{
                backgroundColor: 'rgba(14,116,144,0.2)',
                border: '1px solid rgba(14,116,144,0.4)',
                borderRadius: '12px',
                padding: '8px 18px',
                textAlign: 'right'
              }}>
                <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600', marginBottom: '2px' }}>ORDER VALUE (incl. GST)</div>
                <div style={{ fontSize: '18px', fontWeight: '900', color: '#67E8F9' }}>
                  ₹ {(orderValue > 0 ? orderValue : accGrandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* ── Summary Strip ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              borderBottom: '1px solid #E2E8F0',
              backgroundColor: '#F8FAFC'
            }}>
              {[
                { label: 'Taxable Amount', value: `₹ ${accSubTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#0F172A' },
                { label: `GST Amount`, value: `₹ ${accTotalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#D97706' },
                { label: 'Total with GST', value: `₹ ${accGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#0E7490' }
              ].map((s, i) => (
                <div key={i} style={{
                  padding: '12px 20px',
                  borderRight: i < 2 ? '1px solid #E2E8F0' : 'none',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{s.label}</div>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* ── Kit / Preset Groups ── */}
            {pGroups.length > 0 && pGroups.map((grp, gIdx) => {
              const theme = PRESET_THEMES[gIdx % PRESET_THEMES.length];
              const sCount = parseFloat(grp.setCount) || 1;
              const kPrice = cleanNum(grp.kitPrice) || 0;
              const kTotal = sCount * kPrice;
              const unitType = grp.unit || grp.unitType || (grp.isKwBased || String(grp.presetName || '').toLowerCase().includes('kw') ? 'kW' : 'Sets');
              const kitItems = kitItemsByGroup[gIdx] || [];
              const rawGst = grp.gstRate || kitItems[0]?.gstRate || (pGroups.length === 1 && Number(accountsVerificationModal.subTotal) > 0 && Number(accountsVerificationModal.gstAmount) >= 0
                ? Math.round((Number(accountsVerificationModal.gstAmount) / Number(accountsVerificationModal.subTotal)) * 100)
                : null) || (String(grp.presetName || '').toLowerCase().includes('bos') && String(grp.presetName || '').toLowerCase().includes('dcr') ? 5 : 18);
              const kitGstPct = parseFloat(String(rawGst).replace('%', ''));
              const safeKitGstPct = Number.isFinite(kitGstPct) ? kitGstPct : 18;
              const kitGstAmt = kTotal * (safeKitGstPct / 100);
              const kitGrandTotal = kTotal + kitGstAmt;

              return (
                <div key={`acc-kit-${gIdx}`} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  {/* Kit Group Header Card */}
                  <div style={{
                    background: `linear-gradient(135deg, ${theme.bg} 0%, #FFFFFF 100%)`,
                    borderLeft: `4px solid ${theme.primary}`,
                    padding: '14px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    borderBottom: `1px solid ${theme.border}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        backgroundColor: theme.primary, color: '#FFFFFF',
                        fontSize: '10px', fontWeight: '900', padding: '3px 10px',
                        borderRadius: '6px', letterSpacing: '0.6px'
                      }}>
                        {theme.badge}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                        {grp.presetName || 'Pre-Engineered Structure Kit'}
                      </span>
                      <span style={{
                        backgroundColor: theme.tagBg || theme.bg, color: theme.primary,
                        fontSize: '11px', fontWeight: '700', padding: '2px 10px',
                        borderRadius: '20px', border: `1px solid ${theme.border}`
                      }}>
                        {sCount} {unitType}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Kit Rate</div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: theme.primary }}>₹ {kPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })} / {unitType}</div>
                      </div>
                      <div style={{ width: '1px', height: '32px', backgroundColor: theme.border }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>GST ({safeKitGstPct}%)</div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#D97706' }}>₹ {kitGstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div style={{ width: '1px', height: '32px', backgroundColor: theme.border }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Total incl. GST</div>
                        <div style={{ fontSize: '15px', fontWeight: '900', color: '#0E7490' }}>₹ {kitGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                  </div>

                  {/* Kit Components Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                          <th style={{ padding: '10px 16px', width: '55px', textAlign: 'center', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>#</th>
                          <th style={{ padding: '10px 16px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Code</th>
                          <th style={{ padding: '10px 16px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</th>
                          <th style={{ padding: '10px 16px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>BOM Qty</th>
                          <th style={{ padding: '10px 16px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Packed</th>
                          <th style={{ padding: '10px 16px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Pack Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kitItems.map((it, kIdx) => {
                          const isFullyPacked = it.packedQty >= it.qty;
                          const isPartial = !isFullyPacked && it.packedQty > 0;
                          return (
                            <tr key={`kit-item-${gIdx}-${kIdx}`} style={{
                              borderBottom: '1px solid #F1F5F9',
                              backgroundColor: kIdx % 2 === 0 ? '#FFFFFF' : theme.bg
                            }}>
                              <td style={{ padding: '12px 16px', textAlign: 'center', color: theme.primary, fontWeight: '700', fontSize: '12px' }}>{`${gIdx + 1}.${kIdx + 1}`}</td>
                              <td style={{ padding: '12px 16px' }}>
                                <span style={{
                                  fontFamily: 'monospace', fontSize: '12px', fontWeight: '800', color: '#2563EB',
                                  backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: '6px'
                                }}>{it.code}</span>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '13px' }}>{it.name}</div>
                                {it.desc && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{it.desc}</div>}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <span style={{ fontWeight: '800', color: '#0F172A', fontSize: '14px' }}>{it.qty}</span>
                                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', marginLeft: '4px' }}>{it.uom}</span>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <span style={{
                                  fontWeight: '800', fontSize: '14px',
                                  color: isFullyPacked ? '#166534' : isPartial ? '#B45309' : '#64748B'
                                }}>{it.packedQty}</span>
                                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', marginLeft: '4px' }}>{it.uom}</span>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                {isFullyPacked ? (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800',
                                    backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0'
                                  }}>
                                    <CheckCircle style={{ width: '11px', height: '11px' }} /> Packed
                                  </span>
                                ) : isPartial ? (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800',
                                    backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A'
                                  }}>
                                    <Clock style={{ width: '11px', height: '11px' }} /> Partial
                                  </span>
                                ) : (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800',
                                    backgroundColor: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0'
                                  }}>
                                    <Clock style={{ width: '11px', height: '11px' }} /> Pending
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* ── Loose / Individual Products ── */}
            {(() => {
              const looseItems = looseAccItems;
              if (looseItems.length === 0 && pGroups.length > 0) return null;

              return (
                <div>
                  {/* Section separator label if mixed */}
                  {pGroups.length > 0 && looseItems.length > 0 && (
                    <div style={{
                      padding: '10px 24px',
                      backgroundColor: '#F8FAFC',
                      borderTop: '2px solid #E2E8F0',
                      borderBottom: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <span style={{
                        padding: '3px 12px', borderRadius: '6px',
                        backgroundColor: '#475569', color: '#FFFFFF',
                        fontSize: '11px', fontWeight: '900', letterSpacing: '0.5px'
                      }}>
                        INDIVIDUAL / STANDALONE PRODUCTS
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>{looseItems.length} item{looseItems.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}

                  {/* Standalone Items Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                          <th style={{ padding: '11px 16px', width: '50px', textAlign: 'center', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>#</th>
                          <th style={{ padding: '11px 16px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Code</th>
                          <th style={{ padding: '11px 16px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</th>
                          <th style={{ padding: '11px 16px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>BOM Qty</th>
                          <th style={{ padding: '11px 16px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Packed</th>
                          <th style={{ padding: '11px 16px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Unit Rate</th>
                          <th style={{ padding: '11px 16px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Line Total</th>
                          <th style={{ padding: '11px 16px', fontSize: '10px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center' }}>Pack Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {looseItems.map((it, idx) => {
                          const isFullyPacked = it.packedQty >= it.qty;
                          const isPartial = !isFullyPacked && it.packedQty > 0;
                          return (
                            <tr key={`loose-${idx}`} style={{
                              borderBottom: '1px solid #F1F5F9',
                              backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFBFC'
                            }}>
                              <td style={{ padding: '14px 16px', textAlign: 'center', color: '#94A3B8', fontWeight: '700', fontSize: '12px' }}>{idx + 1}</td>
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{
                                  fontFamily: 'monospace', fontSize: '12px', fontWeight: '800', color: '#2563EB',
                                  backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: '6px'
                                }}>{it.code}</span>
                              </td>
                              <td style={{ padding: '14px 16px' }}>
                                <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '13px' }}>{it.name}</div>
                                {it.desc && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{it.desc}</div>}
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <span style={{ fontWeight: '800', color: '#0F172A', fontSize: '14px' }}>{it.qty}</span>
                                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', marginLeft: '4px' }}>{it.uom}</span>
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <span style={{
                                  fontWeight: '800', fontSize: '14px',
                                  color: isFullyPacked ? '#166534' : isPartial ? '#B45309' : '#64748B'
                                }}>{it.packedQty}</span>
                                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', marginLeft: '4px' }}>{it.uom}</span>
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: '#475569', fontSize: '13px' }}>
                                ₹ {it.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '900', color: '#0E7490', fontSize: '14px' }}>
                                ₹ {it.amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                {isFullyPacked ? (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800',
                                    backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0'
                                  }}>
                                    <CheckCircle style={{ width: '11px', height: '11px' }} /> Packed
                                  </span>
                                ) : isPartial ? (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800',
                                    backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A'
                                  }}>
                                    <Clock style={{ width: '11px', height: '11px' }} /> Partial
                                  </span>
                                ) : (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800',
                                    backgroundColor: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0'
                                  }}>
                                    <Clock style={{ width: '11px', height: '11px' }} /> Pending
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ─── STICKY BOTTOM ACTION BAR (Matching PI & Invoice Management) ─── */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderTop: '1.5px solid #CBD5E1',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          zIndex: 50,
          boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.08)',
          borderRadius: '12px',
          marginTop: '16px',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              setAccountsVerificationModal(null);
              if (setIsAccountsViewOnly) setIsAccountsViewOnly(false);
            }}
            style={{
              height: '40px',
              borderRadius: '8px',
              border: '1.5px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              padding: '0 18px',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
          >
            <ChevronLeft size={16} /> {isAccountsViewOnly ? 'Close Viewer' : 'Back'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {!isAlreadyCompleted && !isAccountsViewOnly ? (
            <>
              {isMissingRequiredPaymentProof && (
                <button
                  type="button"
                  onClick={() => notifySalesForMissingPaymentProof({
                    ...accountsVerificationModal,
                    effectiveTotalAmountNum,
                    payType
                  })}
                  style={{
                    height: '40px',
                    padding: '0 18px',
                    borderRadius: '8px',
                    backgroundColor: '#FEF3C7',
                    border: '1.5px solid #F59E0B',
                    color: '#92400E',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FDE68A'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FEF3C7'}
                  title="Send alert to assigned Salesperson via WhatsApp & In-App Notification"
                >
                  <BellRing style={{ width: '16px', height: '16px', color: '#D97706' }} />
                  Notify Sales / Send Alert
                </button>
              )}
              {canForcePushWithoutProof && (
                <button
                  type="button"
                  onClick={() => {
                    const reason = window.prompt('Force push without payment proof\n\nConfirm the payment IS received and only the proof attachment is missing.\nEnter a reason / reference (required):', '');
                    if (reason === null) return;
                    if (!reason.trim()) { alert('A reason is required to force push without payment proof.'); return; }
                    completeVerification(reason.trim());
                  }}
                  style={{
                    height: '40px',
                    padding: '0 18px',
                    borderRadius: '8px',
                    backgroundColor: '#7C2D12',
                    border: 'none',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  title="Accounts confirms payment is received; proof attachment is still pending"
                >
                  <CheckCircle style={{ width: '15px', height: '15px' }} />
                  Force Push (Payment Received)
                </button>
              )}
              <button
                type="button"
                onClick={() => completeVerification()}
                style={{
                  height: '40px',
                  borderRadius: '8px',
                  border: isMissingRequiredPaymentProof ? '1.5px solid #FECACA' : 'none',
                  backgroundColor: isMissingRequiredPaymentProof ? '#FEF2F2' : '#0E7490',
                  color: isMissingRequiredPaymentProof ? '#DC2626' : '#FFFFFF',
                  padding: '0 24px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  fontSize: '13px',
                  boxShadow: isMissingRequiredPaymentProof ? 'none' : '0 2px 8px rgba(14, 116, 144, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { if (!isMissingRequiredPaymentProof) e.currentTarget.style.backgroundColor = '#0891B2'; }}
                onMouseLeave={(e) => { if (!isMissingRequiredPaymentProof) e.currentTarget.style.backgroundColor = '#0E7490'; }}
                title={isMissingRequiredPaymentProof ? "Locked: Payment Proof Pending from Sales person" : ""}
              >
                {isMissingRequiredPaymentProof ? (
                  <>
                    <Clock style={{ width: '15px', height: '15px', color: '#DC2626' }} />
                    Payment Proof Pending (Locked)
                  </>
                ) : (
                  <>
                    <CheckCircle style={{ width: '15px', height: '15px' }} />
                    Complete Verification
                  </>
                )}
              </button>
            </>
          ) : (
            <div
              style={{
                backgroundColor: '#DCFCE7',
                color: '#166534',
                border: '1px solid #86EFAC',
                borderRadius: '8px',
                padding: '0 18px',
                height: '40px',
                fontSize: '13px',
                fontWeight: '800',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle style={{ width: '16px', height: '16px', color: '#166534' }} /> {isAccountsViewOnly ? 'Accounts Verification Details' : 'Accounts Verified & Passed to Invoice'}
            </div>
          )}
        </div>
      </div>

      {/* ─── RECORDED PAYMENT PROOF DOCUMENT VIEWER MODAL ─── */}
      {viewingProofDocModal && (
        <RecordedProofViewerModal
          viewingProofDocModal={viewingProofDocModal}
          onClose={() => setViewingProofDocModal(null)}
          initialResolvedUrl={
            viewingProofDocModal.targetDocUrl || resolvedProofDataUrl
          }
          custNameText={custNameText}
          orderValue={orderValue}
          payTypeText={payTypeText}
        />
      )}
    </div>
  );

  if (isAccountsViewOnly) {
    return (
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setAccountsVerificationModal(null);
            if (setIsAccountsViewOnly) setIsAccountsViewOnly(false);
          }
        }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 10000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px',
          boxSizing: 'border-box'
        }}
      >
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          maxWidth: '1240px',
          width: '100%',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          padding: '24px',
          boxSizing: 'border-box',
          position: 'relative'
        }}>
          {modalContent}
        </div>
      </div>
    );
  }

  return modalContent;
}

function RecordedProofViewerModal({
  viewingProofDocModal,
  onClose,
  initialResolvedUrl,
  custNameText,
  orderValue,
  payTypeText
}) {
  const isAddressDoc = Boolean(
    viewingProofDocModal?.docTitle?.toLowerCase().includes('address') ||
    viewingProofDocModal?.targetDocName?.toLowerCase().includes('address')
  );

  const rawProof = viewingProofDocModal?.targetDoc ||
    (isAddressDoc ? (
      viewingProofDocModal?.deliveryAddressProofDoc ||
      viewingProofDocModal?.addressProofDoc ||
      viewingProofDocModal?.deliveryProofDoc
    ) : (
      viewingProofDocModal?.paymentProofDoc ||
      viewingProofDocModal?.payments?.proofDocObj ||
      viewingProofDocModal?.payments?.proofDoc ||
      viewingProofDocModal?.balancePaymentProofDoc ||
      viewingProofDocModal?.balanceProofDoc ||
      viewingProofDocModal?.proofDoc ||
      viewingProofDocModal?.salesPoDetails?.proofDocObj
    )) ||
    viewingProofDocModal?.deliveryAddressProofDoc ||
    viewingProofDocModal?.addressProofDoc;

  let docName = viewingProofDocModal?.targetDocName || null;
  if (!docName && rawProof) {
    if (typeof rawProof === 'string' && !rawProof.startsWith('data:')) {
      docName = rawProof;
    } else if (rawProof.name) {
      docName = rawProof.name;
    } else if (rawProof.originalName) {
      docName = rawProof.originalName;
    }
  }
  if (!docName) {
    docName = isAddressDoc
      ? (viewingProofDocModal?.deliveryAddressProofDocName || viewingProofDocModal?.addressProofDocName)
      : (viewingProofDocModal?.paymentProofDocName || viewingProofDocModal?.balancePaymentProofDocName || viewingProofDocModal?.balanceProofDocName);
  }

  const explicitUrl = viewingProofDocModal?.targetDocUrl || initialResolvedUrl || null;
  const [docUrl, setDocUrl] = useState(explicitUrl);
  const [loading, setLoading] = useState(!explicitUrl);
  const [imageError, setImageError] = useState(false);

  // Sync with explicit URL updates from parent
  useEffect(() => {
    if (explicitUrl) {
      setDocUrl(explicitUrl);
      setLoading(false);
      setImageError(false);
    }
  }, [explicitUrl]);

  const bCode = viewingProofDocModal?.bomCode || viewingProofDocModal?.code || 'BOM-2026';
  const cName = viewingProofDocModal?.customerName || viewingProofDocModal?.companyName || custNameText;
  const amtVal = parseFloat(viewingProofDocModal?.grandTotal || orderValue || 0);
  const pType = viewingProofDocModal?.paymentType || payTypeText || '100% Advance';

  useEffect(() => {
    let active = true;

    // 1. If explicit URL already provided and is data/blob, we're done
    if (explicitUrl && (explicitUrl.startsWith('data:') || explicitUrl.startsWith('blob:'))) {
      setDocUrl(explicitUrl);
      setLoading(false);
      return;
    }

    // 2. Direct synchronous values
    let direct = (typeof rawProof === 'string' && rawProof.startsWith('data:'))
      ? rawProof
      : (rawProof?.dataUrl || rawProof?.fileData || rawProof?.url || (!isAddressDoc ? (viewingProofDocModal?.proofDocData || viewingProofDocModal?.payments?.proofDocData) : null) || null);

    if (!direct && docName) {
      direct = getMediaFromCache(docName);
    }
    if (!direct && rawProof) {
      direct = resolveDocumentUrl(rawProof);
    }
    if (direct && !direct.startsWith('blob:')) {
      if (direct.startsWith('/uploads/')) direct = `/api${direct}`;
      setDocUrl(direct);
      if (direct.startsWith('data:')) {
        setLoading(false);
        return;
      }
    }

    setLoading(!explicitUrl && !direct);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try { controller.abort(); } catch (_) {}
    }, 4000); // 4-second maximum safety timeout to guarantee loading never hangs

    const resolveAsync = async () => {
      try {
        // Fast: Check source PI in local storage
        const srcPiNo = viewingProofDocModal?.sourcePiNo || viewingProofDocModal?.piNo;
        if (srcPiNo && typeof window !== 'undefined') {
          try {
            const rawPis = localStorage.getItem('controlroom_pi_store') || localStorage.getItem('controlroom_sales_pi_store') || localStorage.getItem('businz_pi_store');
            if (rawPis) {
              const parsed = JSON.parse(rawPis);
              const list = Array.isArray(parsed) ? parsed : (parsed.pis || []);
              const pi = list.find(p => p.piNo === srcPiNo || p.id === srcPiNo);
              if (pi) {
                const piData = !isAddressDoc
                  ? (pi.proofDocData || pi.payments?.proofDocData || (typeof pi.paymentProofDoc === 'string' && pi.paymentProofDoc.startsWith('data:') ? pi.paymentProofDoc : pi.paymentProofDoc?.dataUrl))
                  : (pi.deliveryProofDoc?.dataUrl || (typeof pi.deliveryProofDoc === 'string' && pi.deliveryProofDoc.startsWith('data:') ? pi.deliveryProofDoc : null));
                if (piData && active) {
                  setDocUrl(piData);
                  setLoading(false);
                  setImageError(false);
                  return;
                }
              }
            }
          } catch (_) {}
        }

        // 3. Storage resolver (Supabase / VPS bucket)
        if (rawProof && (rawProof.storageBucket || rawProof.storagePath)) {
          try {
            const url = await resolveDocumentUrlAsync(rawProof, bCode);
            if (active && url) {
              const cleanUrl = url.startsWith('/uploads/') ? `/api${url}` : url;
              setDocUrl(cleanUrl);
              if (docName) saveMediaToCache(docName, cleanUrl);
              setLoading(false);
              setImageError(false);
              return;
            }
          } catch (_) {}
        }

        // 4. Media cache async (IndexedDB)
        if (docName) {
          try {
            const cUrl = await getMediaFromCacheAsync(docName);
            if (active && cUrl) {
              setDocUrl(cUrl);
              setLoading(false);
              setImageError(false);
              return;
            }
          } catch (_) {}

          // 5. Server media find API
          try {
            const res = await fetch(`/api/media/find/${encodeURIComponent(docName)}`, { signal: controller.signal });
            if (res.ok) {
              const data = await res.json().catch(() => null);
              if (active && data?.found && data?.url) {
                const cleanUrl = data.url.startsWith('/uploads/') ? `/api${data.url}` : data.url;
                setDocUrl(cleanUrl);
                saveMediaToCache(docName, cleanUrl);
                setLoading(false);
                setImageError(false);
                return;
              }
            }
          } catch (_) {}

          // 6. Direct /api/uploads fallback
          if (active) {
            const directUploadUrl = `/api/uploads/${encodeURIComponent(docName)}`;
            try {
              const headRes = await fetch(directUploadUrl, { method: 'HEAD', signal: controller.signal }).catch(() => null);
              if (headRes && headRes.ok && active) {
                setDocUrl(directUploadUrl);
                setLoading(false);
                setImageError(false);
                return;
              }
            } catch (_) {}
          }

          // 7. Check standard category subfolder directly
          if (active && bCode) {
            const cat = isAddressDoc ? 'delivery-proof' : 'payment-proof';
            const catUrl = `/api/uploads/bom-documents/${encodeURIComponent(bCode)}/${cat}/${encodeURIComponent(docName)}`;
            try {
              const headRes = await fetch(catUrl, { method: 'HEAD', signal: controller.signal }).catch(() => null);
              if (headRes && headRes.ok && active) {
                setDocUrl(catUrl);
                setLoading(false);
                setImageError(false);
                return;
              }
            } catch (_) {}
          }
        }
      } catch (err) {
        console.warn('[RecordedProofViewerModal] Document resolution note:', err);
      } finally {
        clearTimeout(timeoutId);
        if (active) setLoading(false);
      }
    };

    resolveAsync();
    return () => {
      active = false;
      clearTimeout(timeoutId);
      try { controller.abort(); } catch (_) {}
    };
  }, [viewingProofDocModal, docName, bCode, explicitUrl]);

  const isPdf = Boolean(
    (docName && docName.toLowerCase().endsWith('.pdf')) ||
    (rawProof && (rawProof.type === 'application/pdf' || rawProof.mimeType === 'application/pdf')) ||
    (docUrl && (docUrl.toLowerCase().includes('.pdf') || docUrl.startsWith('data:application/pdf')))
  );

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000005,
      padding: '20px',
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '20px',
        maxWidth: '740px',
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
                {viewingProofDocModal?.docTitle || 'Recorded Document Proof'}
              </h2>
              <p style={{ fontSize: '12px', color: '#94A3B8', margin: '2px 0 0 0' }}>
                {docName || 'Document Attachment'} • {bCode} • {cName}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {docUrl && (
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={docName || 'Document_Proof'}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: '#FFFFFF',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '700',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <ExternalLink style={{ width: '14px', height: '14px' }} /> Open / Download
              </a>
            )}
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
              onClick={onClose}
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
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
              <Loader2 className="animate-spin" size={36} style={{ color: '#2563EB' }} />
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                {viewingProofDocModal?.docTitle ? `Loading ${viewingProofDocModal.docTitle}...` : 'Loading Document Proof...'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>{docName || 'Fetching attachment'}</div>
            </div>
          ) : (docUrl && !imageError) ? (
            isPdf ? (
              <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E2E8F0', height: '500px' }}>
                <iframe src={docUrl} title="Document Proof PDF" style={{ width: '100%', height: '100%', border: 'none' }} />
              </div>
            ) : (
              <div style={{
                borderRadius: '14px', overflow: 'hidden', border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF', padding: '16px', textAlign: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center'
              }}>
                <img
                  src={docUrl}
                  alt="Document Proof Attachment"
                  style={{ maxWidth: '100%', maxHeight: '480px', objectFit: 'contain', borderRadius: '8px' }}
                  onError={(e) => {
                    if (!e.currentTarget.dataset.retried && docName) {
                      e.currentTarget.dataset.retried = 'true';
                      fetch(`/api/media/find/${encodeURIComponent(docName)}`)
                        .then(r => r.json())
                        .then(data => {
                          if (data?.found && data?.url) {
                            const cleanUrl = data.url.startsWith('/uploads/') ? `/api${data.url}` : data.url;
                            setDocUrl(cleanUrl);
                          } else if (!e.currentTarget.src.includes('/api/uploads/')) {
                            e.currentTarget.src = `/api/uploads/${encodeURIComponent(docName)}`;
                          } else {
                            setImageError(true);
                          }
                        })
                        .catch(() => {
                          if (!e.currentTarget.src.includes('/api/uploads/')) {
                            e.currentTarget.src = `/api/uploads/${encodeURIComponent(docName)}`;
                          } else {
                            setImageError(true);
                          }
                        });
                      return;
                    }
                    setImageError(true);
                  }}
                />
              </div>
            )
          ) : (
            /* Authentic Document Status Card */
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1.5px dashed #CBD5E1',
              padding: '36px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '14px',
                backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#2563EB'
              }}>
                <Receipt style={{ width: '28px', height: '28px' }} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
                {docName ? `Recorded File: ${docName}` : 'Document Recorded'}
              </div>
              <div style={{ fontSize: '13px', color: '#64748B', maxWidth: '440px', lineHeight: '1.5' }}>
                {docName
                  ? `The document "${docName}" is officially recorded for this order. It was uploaded by the sales team during order creation.`
                  : 'Document is officially recorded for this order.'}
              </div>
              {docName && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <a
                    href={`/api/uploads/${encodeURIComponent(docName)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '8px 18px',
                      backgroundColor: '#2563EB',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: '700',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Download size={14} /> Open / Download File
                  </a>
                </div>
              )}
              <div style={{
                marginTop: '12px',
                padding: '12px 18px',
                backgroundColor: '#F8FAFC',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                display: 'inline-flex',
                gap: '24px',
                fontSize: '12px',
                color: '#475569',
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}>
                <div><strong>BOM Order:</strong> {bCode}</div>
                <div><strong>Customer:</strong> {cName}</div>
                <div><strong>Amount:</strong> ₹{amtVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
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
            {docUrl ? 'Official verified document proof attachment' : 'Digitally sealed electronic transaction advice'}
          </span>
          <button
            onClick={onClose}
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
}
