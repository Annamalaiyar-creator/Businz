/**
 * BUSINZ WhatsApp Multi-Session Dispatch & Integration Service
 * Enables 5-6 sales persons to each connect their own WhatsApp number via QR code
 * and send Quotations, PIs, BOMs, and messages directly in 1 click.
 */

export function getCleanCurrentUserId() {
  if (typeof window === 'undefined') return 'sales_rep';
  const email = localStorage.getItem('controlroom_logged_user') || '';
  const name = localStorage.getItem('controlroom_logged_user_name') || '';
  const raw = email || name || 'sales_rep';
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 40) || 'sales_rep';
}

export function getCurrentSalesRepName() {
  if (typeof window === 'undefined') return 'Sales Representative';
  return localStorage.getItem('controlroom_logged_user_name') || 
         localStorage.getItem('controlroom_logged_user') || 
         'Sales Representative';
}

/**
 * Fetch status of the current or specified user's WhatsApp session
 */
export async function getWhatsAppStatus(userId = null) {
  const uid = userId || getCleanCurrentUserId();
  try {
    const res = await fetch(`/api/whatsapp/multi/status/${uid}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      userId: uid,
      status: 'DISCONNECTED',
      isReady: false,
      error: err.message
    };
  }
}

/**
 * Request or initiate connection (generates QR code)
 */
export async function connectWhatsApp(userId = null) {
  const uid = userId || getCleanCurrentUserId();
  try {
    const res = await fetch(`/api/whatsapp/multi/connect/${uid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      userId: uid,
      status: 'ERROR',
      isReady: false,
      error: err.message
    };
  }
}

/**
 * Disconnect / unlink WhatsApp session
 */
export async function disconnectWhatsApp(userId = null) {
  const uid = userId || getCleanCurrentUserId();
  try {
    const res = await fetch(`/api/whatsapp/multi/disconnect/${uid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Fetch all active sessions across all sales representatives
 */
export async function getAllWhatsAppSessions() {
  try {
    const res = await fetch('/api/whatsapp/multi/sessions');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return { success: false, sessions: [], error: err.message };
  }
}

/**
 * Fetch real synced chats and contacts from the user's connected WhatsApp
 */
export async function getWhatsAppChats(userId = null) {
  const uid = userId || getCleanCurrentUserId();
  try {
    const res = await fetch(`/api/whatsapp/multi/chats/${uid}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return { success: false, chats: [], error: err.message };
  }
}

/**
 * Start or add a chat with a specific phone number or contact
 */
export async function startWhatsAppChat({ phone, name = '', company = '', userId = null }) {
  const uid = userId || getCleanCurrentUserId();
  try {
    const res = await fetch('/api/whatsapp/multi/start-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, phone, name, company })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Send an outbound message or PDF document from current sales rep's WhatsApp
 */
export async function sendDirectWhatsApp({
  to,
  text = '',
  document = null,
  fileName = 'Document.pdf',
  mimetype = 'application/pdf',
  caption = '',
  userId = null
}) {
  const uid = userId || getCleanCurrentUserId();
  const cleanPhone = String(to || '').replace(/[^0-9]/g, '');

  if (!cleanPhone) {
    throw new Error('Please provide a valid recipient phone number.');
  }

  const res = await fetch('/api/whatsapp/multi/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: uid,
      to: cleanPhone,
      text,
      document,
      fileName,
      mimetype,
      caption
    })
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Failed to dispatch WhatsApp message.');
  }

  return data;
}

/**
 * Fallback to standard WhatsApp Web / App if session is not connected
 */
export function openWhatsAppWebFallback({ to, text = '' }) {
  const cleanPhone = String(to || '').replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
  const encodedText = encodeURIComponent(text);
  const url = formattedPhone 
    ? `https://wa.me/${formattedPhone}?text=${encodedText}` 
    : `https://wa.me/?text=${encodedText}`;
  window.open(url, '_blank');
}

/**
 * Formatted Quotation Message
 */
export function formatQuotationWhatsAppText(quote, customNote = '') {
  const custName = quote.customer || quote.customerName || quote.companyName || 'Valued Client';
  const qNum = quote.code || quote.quoteNumber || 'QT-2026';
  const total = quote.formattedTotal || (quote.grandTotal ? `Rs. ${Number(quote.grandTotal).toLocaleString('en-IN')}` : 'As Quoted');
  const struct = quote.structure || quote.structureType || 'Solar MMS Structures';
  const kw = quote.capacityKw ? `${quote.capacityKw} kW` : '';
  const rep = quote.salesRep || quote.salesPerson || getCurrentSalesRepName();
  const payTerms = quote.paymentTerms || '50% Advance + 50% Before Dispatch';

  let msg = `*OFFICIAL QUOTATION - BUSINZ / VRM ENERGY*\n`;
  msg += `-----------------------------------------\n`;
  msg += `*Quotation No:* ${qNum}\n`;
  msg += `*Customer:* ${custName}\n`;
  if (kw) msg += `*Capacity:* ${kw}\n`;
  msg += `*Product:* ${struct}\n`;
  msg += `*Total Amount:* ${total} (Incl. GST)\n`;
  msg += `*Payment Terms:* ${payTerms}\n`;
  msg += `*Validity:* 15 Days\n`;
  msg += `-----------------------------------------\n`;
  if (customNote) {
    msg += `*Note:* ${customNote}\n\n`;
  } else {
    msg += `Dear ${custName},\nPlease find our official quotation attached. Kindly review and let us know if you need any adjustments or if we can proceed to Proforma Invoice (PI).\n\n`;
  }
  msg += `Best Regards,\n*${rep}*\nBUSINZ • VRM Energy India Pvt Ltd\nContact for immediate assistance`;
  return msg;
}

/**
 * Formatted Proforma Invoice (PI) Message
 */
export function formatPiWhatsAppText(pi, customNote = '') {
  const custName = pi.vendor || pi.customerName || pi.companyName || 'Valued Client';
  const piNum = pi.piNo || pi.id || 'PI-2026';
  const amount = pi.amount || (pi.totalAmount ? `Rs. ${Number(pi.totalAmount).toLocaleString('en-IN')}` : 'As Invoiced');
  const prod = pi.productName || pi.product || 'Solar MMS & Preset Rails';
  const rep = pi.salesPerson || pi.salesperson || getCurrentSalesRepName();
  const payTerms = pi.paymentTerms || '100% Advance before dispatch';

  let msg = `*PROFORMA INVOICE (PI) - BUSINZ / VRM ENERGY*\n`;
  msg += `-----------------------------------------\n`;
  msg += `*PI Number:* ${piNum}\n`;
  msg += `*Client:* ${custName}\n`;
  msg += `*Order Items:* ${prod}\n`;
  msg += `*Invoice Value:* ${amount}\n`;
  msg += `*Payment Terms:* ${payTerms}\n`;
  msg += `-----------------------------------------\n`;
  if (customNote) {
    msg += `*Note:* ${customNote}\n\n`;
  } else {
    msg += `Dear ${custName},\nAttached is your official Proforma Invoice (${piNum}). Kindly process the payment per the bank account details mentioned in the document and share the UTR / payment proof here to initiate dispatch packing.\n\n`;
  }
  msg += `Best Regards,\n*${rep}*\nBUSINZ • VRM Energy India Pvt Ltd`;
  return msg;
}

/**
 * Formatted BOM Order Confirmation Message
 */
export function formatBomWhatsAppText(bom, customNote = '') {
  const custName = bom.customer || bom.customerName || 'Valued Client';
  const bomNum = bom.bomNumber || bom.bomNo || bom.id || 'BOM-2026';
  const struct = bom.structureType || bom.structure || 'Solar Mounting Structure';
  const rep = bom.salesPerson || getCurrentSalesRepName();

  let msg = `*BOM ORDER CONFIRMATION - BUSINZ*\n`;
  msg += `-----------------------------------------\n`;
  msg += `*BOM Reference:* ${bomNum}\n`;
  msg += `*Client:* ${custName}\n`;
  msg += `*System:* ${struct}\n`;
  msg += `-----------------------------------------\n`;
  if (customNote) {
    msg += `*Note:* ${customNote}\n\n`;
  } else {
    msg += `Dear ${custName},\nYour Bill of Materials (BOM) has been engineered and confirmed into our manufacturing workflow.\n\n`;
  }
  msg += `Best Regards,\n*${rep}*\nBUSINZ • VRM Energy India Pvt Ltd`;
  return msg;
}
