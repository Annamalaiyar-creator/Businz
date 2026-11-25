// ===================================================================================
// BUSINZ ERP: SALES ALERT & NOTIFICATION HELPER
// ===================================================================================
// Allows Accounts / Dispatch / Admin to instantly notify & ping the assigned
// salesperson via WhatsApp and In-App real-time alerts when documents are missing.
// ===================================================================================

import { notifyPaymentProofPendingToSales } from '../services/notificationService';
import { formatCurrency } from './otherViewsShared';

/**
 * Look up assigned salesperson's phone & profile in the employee directory
 */
export function findSalespersonContact(salesPerson, salesPersonCode) {
  const cleanName = String(salesPerson || '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/^(Sales Executive|Salesperson|Sales Rep|Sales)\s*[-:]?\s*/i, '')
    .trim();
  const cleanCode = String(salesPersonCode || '').trim().toUpperCase();

  let matchedEmp = null;
  try {
    const listRaw = localStorage.getItem('controlroom_employees_list') || 
                    localStorage.getItem('controlroom_employees_store') || '[]';
    const emps = JSON.parse(listRaw);
    if (Array.isArray(emps)) {
      matchedEmp = emps.find(e => {
        if (!e) return false;
        const eCode = String(e.employee_code || e.code || '').trim().toUpperCase();
        const eName = String(e.employee_name || e.name || '').trim().toLowerCase();
        
        if (cleanCode && eCode && eCode === cleanCode) return true;
        if (cleanName && eName) {
          const targetLower = cleanName.toLowerCase();
          if (eName === targetLower || eName.includes(targetLower) || targetLower.includes(eName)) {
            return true;
          }
        }
        return false;
      });
    }
  } catch (err) {
    console.warn('[salesAlertHelper] Error querying employees list:', err);
  }

  const phone = matchedEmp ? (matchedEmp.phone || matchedEmp.mobile || matchedEmp.whatsapp || '') : '';
  const empName = matchedEmp ? (matchedEmp.employee_name || matchedEmp.name || cleanName) : cleanName;
  const empCode = matchedEmp ? (matchedEmp.employee_code || matchedEmp.code || cleanCode) : cleanCode;

  return {
    phone,
    empName: empName || 'Salesperson',
    empCode: empCode || ''
  };
}

/**
 * Dispatch an alert to the assigned salesperson for missing payment slip:
 * 1. In-App Server Workflow Notification
 * 2. In-App Floating Toast
 * 3. One-Click WhatsApp Ping
 */
export function notifySalesForMissingPaymentProof(targetOrder, options = {}) {
  if (!targetOrder) return { success: false, error: 'No order provided' };

  try {
    const bomCode = targetOrder.bomCode || targetOrder.code || targetOrder.id || 'BOM Order';
    const customerName = targetOrder.customerName || targetOrder.companyName || targetOrder.c2 || targetOrder.vendor || 'Customer';
    const rawSalesPerson = targetOrder.salesPerson || targetOrder.createdBy || targetOrder.c3 || 'Sales Department';
    const rawSalesCode = targetOrder.salesPersonCode || targetOrder.createdById || '';
    const paymentTerms = targetOrder.paymentType || targetOrder.paymentTerms || targetOrder.payType || 'Payment on Dispatch';
    
    // Resolve amount
    let rawAmount = targetOrder.effectiveTotalAmountNum || targetOrder.totalAmount || targetOrder.orderTotal || targetOrder.grandTotal || targetOrder.pricing?.grandTotal || targetOrder.amount || targetOrder.invAmt || targetOrder.poVal || targetOrder.c6 || targetOrder.c7 || 0;
    if (typeof rawAmount === 'string') {
      rawAmount = Number(rawAmount.replace(/[^0-9.]/g, '')) || 0;
    }
    const cleanAmt = String(formatCurrency(rawAmount)).replace(/^₹\s*/, '');

    // 1. Resolve Contact
    const { phone, empName, empCode } = findSalespersonContact(rawSalesPerson, rawSalesCode);

    // 2. Dispatch Server-Side Workflow Notification
    try {
      notifyPaymentProofPendingToSales({
        bomCode,
        customerName,
        paymentType: paymentTerms,
        salesPerson: empName,
        salesPersonCode: empCode
      });
    } catch (err) {
      console.warn('[salesAlertHelper] Workflow notification dispatch failed:', err);
    }

    // 3. Dispatch Local In-App Toast
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('businz_show_toast', {
        detail: {
          message: `Payment slip alert dispatched to ${empName}${empCode ? ` (${empCode})` : ''} for BOM ${bomCode}.`,
          title: 'Sales Alert Dispatched',
          type: 'warning',
          document_type: 'BOM',
          duration: 6
        }
      }));
    }

    // 4. Construct WhatsApp Message
    const waMessage = 
`⚠️ *[BUSINZ ACCOUNTS ALERT]*
Payment slip is missing for BOM Order *${bomCode}* (${customerName}).

💰 *Order Value*: ₹ ${cleanAmt}
📋 *Payment Terms*: ${paymentTerms}

Dispatch packing has been verified, but Accounts verification is *BLOCKED* pending payment receipt.

👉 Please upload the payment slip in BUSINZ immediately so this order can be billed and dispatched.`;

    // 5. Open WhatsApp
    let cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    const waUrl = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(waMessage)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(waMessage)}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');

    // 6. User Feedback Alert (unless silent)
    if (!options.silent) {
      alert(`📢 SALES ALERT DISPATCHED!\n\n• In-App alert sent to: ${empName}${empCode ? ` (${empCode})` : ''}\n• WhatsApp message opened${cleanPhone ? ` to: +${cleanPhone}` : ''}\n\nMessage:\n"Payment slip missing for BOM ${bomCode} (${customerName}). Please upload immediately."`);
    }

    return {
      success: true,
      bomCode,
      empName,
      empCode,
      phone: cleanPhone
    };
  } catch (err) {
    console.error('[salesAlertHelper] Failed to notify sales:', err);
    if (!options.silent) {
      alert('Alert initiated. Please verify with the sales representative.');
    }
    return { success: false, error: err.message };
  }
}
