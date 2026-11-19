/**
 * Shared Credit Customer Eligibility & Credit Limit Enforcement Helper (BUSINZ)
 *
 * Rules:
 * 1. Only CEO-approved credit customers (creditApproved === true || creditStatus === 'approved')
 *    are eligible to use "Credit Payment" on Create PI, Create BOM, and Reconfirm BOM.
 * 2. Hard block: (existing unsettled credit + current order total) must not exceed
 *    the CEO-approved creditLimit (and creditLimit must be > 0).
 */

const normalizeCompanyKey = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/\b(private|pvt|limited|ltd|llp|inc|corporation|corp)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

const normalizeGstKey = (gst) => {
  const clean = String(gst || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  return clean.length >= 10 ? clean : '';
};

const parseAmount = (val) => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const cleaned = String(val ?? '0').replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

export const isCustomerCreditApproved = (customer) => {
  if (!customer || typeof customer !== 'object') return false;
  return Boolean(
    customer.creditApproved === true ||
    customer.credit_approved === true ||
    String(customer.creditStatus || customer.credit_status || '').trim().toLowerCase() === 'approved'
  );
};

export const getCustomerCreditStatus = (customer) => {
  if (!customer || typeof customer !== 'object') return 'none';
  if (isCustomerCreditApproved(customer)) return 'approved';
  const raw = String(customer.creditStatus || customer.credit_status || 'none').trim().toLowerCase();
  if (raw === 'pending_ceo_approval' || raw === 'rejected') return raw;
  return 'none';
};

export const findMatchingCustomerRecord = (customerList = [], { companyName = '', customerName = '', gstNo = '', customerCode = '' } = {}) => {
  if (!Array.isArray(customerList) || customerList.length === 0) return null;
  const targetCode = String(customerCode || '').trim().toLowerCase();
  const targetGst = normalizeGstKey(gstNo);
  const targetName = normalizeCompanyKey(companyName || customerName);

  if (targetCode) {
    const byCode = customerList.find(c =>
      c && String(c.customerCode || c.code || c.id || '').trim().toLowerCase() === targetCode
    );
    if (byCode) return byCode;
  }
  if (targetGst) {
    const byGst = customerList.find(c =>
      c && normalizeGstKey(c.gstNumber || c.gstNo || c.gstin || c.gst) === targetGst
    );
    if (byGst) return byGst;
  }
  if (targetName) {
    const exactName = customerList.find(c => {
      if (!c) return false;
      const c1 = normalizeCompanyKey(c.companyName || c.c2 || c.name);
      const c2 = normalizeCompanyKey(c.customerName);
      return (c1 && c1 === targetName) || (c2 && c2 === targetName);
    });
    if (exactName) return exactName;
  }
  return null;
};

const isBomCreditOrderUnsettled = (bom) => {
  if (!bom || typeof bom !== 'object') return false;
  const st = String(bom.status || '').toLowerCase();
  if (bom.cancelled || st.includes('cancel') || st.includes('stock restored') || st.includes('rejected')) {
    return false;
  }
  if (bom.creditSettled || bom.paymentSettled || bom.paymentUpdated) return false;
  if (st.includes('credit settled') || st.includes('payment settled') || st.includes('payment uploaded & settled')) {
    return false;
  }
  const acc = bom.accountsVerification || {};
  if (acc.creditSettled || acc.paymentStatus === 'Credit Settled (100% Paid)') return false;

  const payType = String(bom.paymentType || bom.paymentTerms || bom.piPaymentTerms || '').toLowerCase();
  return payType.includes('credit') || payType.includes('net 30') || Number(bom.creditDays || 0) > 0;
};

export const calculateCustomerUnsettledCredit = (customer, bomStore = [], excludeBomCode = null) => {
  if (!customer || !Array.isArray(bomStore) || bomStore.length === 0) return 0;
  const targetGst = normalizeGstKey(customer.gstNumber || customer.gstNo || customer.gstin || customer.gst);
  const targetName = normalizeCompanyKey(customer.companyName || customer.c2 || customer.name || customer.customerName);
  const excludeKey = String(excludeBomCode || '').trim().toLowerCase();

  let used = 0;
  for (let i = 0; i < bomStore.length; i++) {
    const b = bomStore[i];
    if (!isBomCreditOrderUnsettled(b)) continue;
    const bCode = String(b.bomCode || b.code || b.id || '').trim().toLowerCase();
    if (excludeKey && bCode && bCode === excludeKey) continue;

    const bGst = normalizeGstKey(b.gstNo || b.gstNumber || b.gstin || b.gst);
    const bName = normalizeCompanyKey(b.companyName || b.customerName || b.c2);
    const gstMatch = Boolean(targetGst && bGst && targetGst === bGst);
    const nameMatch = Boolean(targetName && bName && targetName === bName);
    if (!gstMatch && !nameMatch) continue;

    const amt = parseAmount(b.grandTotal ?? b.total ?? b.amount ?? b.c5 ?? b.subTotal ?? 0);
    if (amt > 0) used += amt;
  }
  return Math.round(used * 100) / 100;
};

export const evaluateCreditEligibility = ({
  customer = null,
  bomStore = [],
  orderTotal = 0,
  excludeBomCode = null
} = {}) => {
  const approved = isCustomerCreditApproved(customer);
  const status = getCustomerCreditStatus(customer);
  const creditLimit = Math.max(0, parseAmount(customer?.creditLimit ?? customer?.credit_limit ?? 0));
  const creditDays = Math.max(1, Math.min(365, parseInt(customer?.creditDays ?? customer?.credit_days ?? 30, 10) || 30));
  const usedCredit = approved ? calculateCustomerUnsettledCredit(customer, bomStore, excludeBomCode) : 0;
  const orderAmt = Math.max(0, parseAmount(orderTotal));
  const availableCredit = Math.max(0, Math.round((creditLimit - usedCredit) * 100) / 100);
  const projectedTotal = Math.round((usedCredit + orderAmt) * 100) / 100;
  const hasValidLimit = creditLimit > 0;
  const exceedsLimit = approved && (!hasValidLimit || projectedTotal > creditLimit);
  const canUseCredit = approved && hasValidLimit && !exceedsLimit;

  let reason = '';
  if (!customer) {
    reason = 'Select a CEO-approved credit customer to enable Credit Payment.';
  } else if (!approved) {
    if (status === 'pending_ceo_approval') {
      reason = 'Credit facility request is pending CEO approval.';
    } else if (status === 'rejected') {
      reason = `Credit request was rejected by CEO${customer.creditRejectionReason ? `: ${customer.creditRejectionReason}` : '.'}`;
    } else {
      reason = 'This customer is not an approved credit customer. Request credit approval from CEO in Customer Creation / Edit.';
    }
  } else if (!hasValidLimit) {
    reason = 'CEO has not set a valid Credit Limit (> ₹0) for this customer yet.';
  } else if (exceedsLimit) {
    reason = `Credit Limit Exceeded! Used: ₹${usedCredit.toLocaleString('en-IN')} + Order: ₹${orderAmt.toLocaleString('en-IN')} = ₹${projectedTotal.toLocaleString('en-IN')} exceeds CEO Approved Limit of ₹${creditLimit.toLocaleString('en-IN')} (Available: ₹${availableCredit.toLocaleString('en-IN')}).`;
  }

  return {
    approved,
    status,
    creditLimit,
    creditDays,
    usedCredit,
    availableCredit,
    orderAmt,
    projectedTotal,
    exceedsLimit,
    canUseCredit,
    reason
  };
};
