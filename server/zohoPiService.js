import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { zohoRequest } from './zohoAuthService.js';
import { query, isDbConnected } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getStoreFilePath(filename) {
  return path.join(__dirname, filename);
}

/**
 * Parse any raw address (object or string) into a structured Zoho Books address object.
 */
function parseToZohoAddress(rawAddr, fallbackContactAddr = {}) {
  let street1 = '';
  let street2 = '';
  let city = '';
  let state = '';
  let zip = '';
  let phone = '';

  if (rawAddr && typeof rawAddr === 'object') {
    street1 = rawAddr.street || rawAddr.address || rawAddr.address1 || '';
    street2 = rawAddr.street2 || rawAddr.address2 || rawAddr.area || '';
    city = rawAddr.city || '';
    state = rawAddr.state || '';
    zip = rawAddr.pincode || rawAddr.pin || rawAddr.zip || '';
    phone = rawAddr.phone || '';
  } else if (typeof rawAddr === 'string' && rawAddr.trim()) {
    const s = rawAddr.trim();
    const pinMatch = s.match(/\b(\d{6})\b/);
    if (pinMatch) zip = pinMatch[1];

    const parts = s.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      street1 = parts[0] || '';
      street2 = parts.slice(1, parts.length - 2).join(', ') || parts[1] || '';
      city = parts[parts.length - 2] || '';
      state = parts[parts.length - 1].replace(/\b\d{6}\b/, '').replace(/[-–]/g, '').trim();
    } else if (parts.length === 2) {
      street1 = parts[0] || '';
      city = parts[1] || '';
    } else {
      street1 = s;
    }
  }

  // Fallback to contact's existing address fields if blank
  if (!street1 && fallbackContactAddr?.address) street1 = fallbackContactAddr.address;
  if (!street2 && fallbackContactAddr?.street2) street2 = fallbackContactAddr.street2;
  if (!city && fallbackContactAddr?.city) city = fallbackContactAddr.city;
  if (!state && fallbackContactAddr?.state) state = fallbackContactAddr.state;
  if (!zip && (fallbackContactAddr?.zip || fallbackContactAddr?.pincode)) zip = fallbackContactAddr.zip || fallbackContactAddr.pincode;
  if (!phone && fallbackContactAddr?.phone) phone = fallbackContactAddr.phone;

  const result = {
    address: String(street1 || '').slice(0, 100).trim(),
    street2: String(street2 || '').slice(0, 100).trim(),
    city: String(city || '').slice(0, 50).trim(),
    state: String(state || '').slice(0, 50).trim(),
    zip: String(zip || '').slice(0, 20).trim(),
    country: 'India'
  };

  if (phone) {
    result.phone = String(phone).slice(0, 30).trim();
  }

  return result;
}

/**
 * Resolve or dynamically provision a customer contact in Zoho Books, returning contactId and full contact details.
 */
async function resolveZohoCustomerId(pi) {
  const customerName = String(pi.customerName || pi.companyName || pi.vendor || 'Direct Customer').trim();
  let lastZohoError = null;

  const fetchContactDetail = async (contactId) => {
    try {
      const detailRes = await zohoRequest({ path: `/books/v3/contacts/${contactId}` });
      if (detailRes.ok && detailRes.data?.contact) {
        return detailRes.data.contact;
      }
    } catch (_) {}
    return { contact_id: contactId };
  };

  // 1. Search existing contact by exact name
  try {
    const searchRes = await zohoRequest({
      path: `/books/v3/contacts?contact_name=${encodeURIComponent(customerName)}`
    });
    if (searchRes.ok && Array.isArray(searchRes.data?.contacts) && searchRes.data.contacts.length > 0) {
      const match = searchRes.data.contacts.find(c =>
        c.contact_name?.toLowerCase() === customerName.toLowerCase() ||
        c.company_name?.toLowerCase() === customerName.toLowerCase()
      ) || searchRes.data.contacts[0];
      if (match?.contact_id) {
        const fullContact = await fetchContactDetail(match.contact_id);
        return { contactId: match.contact_id, contact: fullContact };
      }
    }
    if (searchRes.data?.message && searchRes.data?.code !== 0) {
      lastZohoError = searchRes.data.message;
    }
  } catch (err) {
    lastZohoError = err.message;
    console.warn('[Zoho Contact Search Error]:', err.message);
  }

  // 2. Fallback search by search_text
  try {
    const textSearchRes = await zohoRequest({
      path: `/books/v3/contacts?search_text=${encodeURIComponent(customerName)}`
    });
    if (textSearchRes.ok && Array.isArray(textSearchRes.data?.contacts) && textSearchRes.data.contacts.length > 0) {
      const match = textSearchRes.data.contacts.find(c =>
        c.contact_name?.toLowerCase() === customerName.toLowerCase()
      ) || textSearchRes.data.contacts[0];
      if (match?.contact_id) {
        const fullContact = await fetchContactDetail(match.contact_id);
        return { contactId: match.contact_id, contact: fullContact };
      }
    }
    if (textSearchRes.data?.message && textSearchRes.data?.code !== 0) {
      lastZohoError = textSearchRes.data.message;
    }
  } catch (_) {}

  // 3. Create new customer contact in Zoho Books
  try {
    const rawGst = String(pi.gstNo || pi.gstNumber || '').trim();
    const billingAddrObj = parseToZohoAddress(pi.billingAddress || pi.deliveryAddress);
    const shippingAddrObj = parseToZohoAddress(pi.deliveryAddress || pi.billingAddress);

    const newCustPayload = {
      contact_name: customerName,
      company_name: customerName,
      contact_type: 'customer',
      customer_sub_type: 'business',
      currency_code: 'INR',
      notes: rawGst && rawGst !== '—' && rawGst !== '-' ? `GSTIN: ${rawGst}` : undefined
    };

    if (pi.phone) newCustPayload.phone = String(pi.phone).trim().slice(0, 30);
    if (pi.email && pi.email.includes('@')) newCustPayload.email = String(pi.email).trim().slice(0, 50);

    if (billingAddrObj.address) {
      newCustPayload.billing_address = billingAddrObj;
    }
    if (shippingAddrObj.address) {
      newCustPayload.shipping_address = shippingAddrObj;
    }

    const createRes = await zohoRequest({
      method: 'POST',
      path: '/books/v3/contacts'
    }, newCustPayload);

    if (createRes.ok && createRes.data?.contact?.contact_id) {
      console.log(`[Zoho Contact Created]: ${customerName} -> ${createRes.data.contact.contact_id}`);
      return { contactId: createRes.data.contact.contact_id, contact: createRes.data.contact };
    }
    if (createRes.data?.message && createRes.data?.code !== 0) {
      lastZohoError = createRes.data.message;
    }
  } catch (err) {
    lastZohoError = err.message;
    console.warn('[Zoho Contact Creation Error]:', err.message);
  }

  // 4. Fallback to first existing contact in Zoho Books
  try {
    const firstRes = await zohoRequest({ path: '/books/v3/contacts?per_page=1' });
    if (firstRes.ok && firstRes.data?.contacts?.[0]?.contact_id) {
      const firstId = firstRes.data.contacts[0].contact_id;
      const fullContact = await fetchContactDetail(firstId);
      return { contactId: firstId, contact: fullContact };
    }
    if (firstRes.data?.message && firstRes.data?.code !== 0) {
      lastZohoError = firstRes.data.message;
    }
  } catch (_) {}

  throw new Error(lastZohoError ? `Zoho Error: ${lastZohoError}` : 'Unable to resolve or create Customer Contact in Zoho Books.');
}

/**
 * Format date string to YYYY-MM-DD
 */
function formatZohoDate(dStr) {
  if (!dStr) return new Date().toISOString().split('T')[0];
  const s = String(dStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmyMatch = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

// Active Zoho Tax ID mapping for VRM Structures India Pvt Ltd (Tamil Nadu State Code 33)
const VERIFIED_ZOHO_TAXES = {
  intra: {
    18: '1264216000000016172', // GST18 (CGST 9% + SGST 9%)
    5: '1264216000000016196',  // GST5 (CGST 2.5% + SGST 2.5%)
    6: '1264216000000050655',  // GST6
    3: '1264216000000050649',  // GST3
    0.25: '1264216000000050625', // GST0.25
    0: '1264216000000016190'   // GST0
  },
  inter: {
    18: '1264216000000016088', // IGST18
    5: '1264216000000016084',  // IGST5
    6: '1264216000000050497',  // IGST6
    3: '1264216000000050491',  // IGST3
    0.25: '1264216000000050485', // IGST0.25
    0: '1264216000000016082'   // IGST0
  }
};

let cachedZohoTaxes = null;
let lastTaxFetch = 0;

async function fetchActiveZohoTaxes() {
  const now = Date.now();
  if (cachedZohoTaxes && (now - lastTaxFetch < 1000 * 60 * 30)) {
    return cachedZohoTaxes;
  }
  try {
    const res = await zohoRequest({ path: '/books/v3/settings/taxes' });
    if (res.ok && Array.isArray(res.data?.taxes)) {
      cachedZohoTaxes = res.data.taxes.filter(t => t.status === 'Active' && !t.is_inactive);
      lastTaxFetch = now;
      return cachedZohoTaxes;
    }
  } catch (err) {
    console.warn('[Zoho Tax Cache Warning]:', err.message);
  }
  return cachedZohoTaxes || [];
}

function resolveZohoTaxId({ isIntraState, requestedRate, activeTaxes = [] }) {
  const spec = isIntraState ? 'intra' : 'inter';
  let numRate = parseFloat(requestedRate);
  if (isNaN(numRate) || numRate <= 0) {
    numRate = 18; // Standard GST for solar mounting structures
  }

  // If 12% is requested, note that GST12 is expired in Zoho Books; map to active 18%
  if (Math.abs(numRate - 12) < 0.01) {
    console.log('[Zoho Tax Resolution] Rate 12% requested, but GST12 is expired in Zoho Books. Mapping to active 18% standard.');
    numRate = 18;
  }

  // Check dynamic active taxes from Zoho API
  if (activeTaxes.length > 0) {
    const match = activeTaxes.find(t => 
      t.tax_specification === spec && 
      Math.abs(parseFloat(t.tax_percentage) - numRate) < 0.01 &&
      (isIntraState ? (t.tax_type === 'tax_group' || (t.tax_name && t.tax_name.startsWith('GST'))) : (t.tax_name && t.tax_name.startsWith('IGST')))
    );
    if (match?.tax_id) return match.tax_id;
  }

  // Fallback to verified static table
  const specMap = VERIFIED_ZOHO_TAXES[spec] || VERIFIED_ZOHO_TAXES.intra;
  return specMap[numRate] || specMap[18] || '1264216000000016172';
}

function determineIsIntraState(piData) {
  const rawGst = String(piData.gstNo || piData.gstNumber || '').trim();
  if (rawGst && rawGst.length >= 2) {
    const code = rawGst.substring(0, 2);
    return code === '33'; // 33 is Tamil Nadu
  }
  const stateStr = String(
    piData.deliveryAddress?.state || 
    piData.billingAddress?.state || 
    piData.state || 
    ''
  ).toLowerCase();
  if (stateStr.includes('tamil nadu') || stateStr.includes('tn') || stateStr.includes('tamilnadu')) {
    return true;
  }
  // Default to true (Tamil Nadu intra-state) for VRM Structures
  return true;
}

/**
 * Push a single Proforma Invoice to Zoho Books as an Estimate / Quote.
 */
export async function pushPiToZoho(piData) {
  if (!piData || !piData.piNo) {
    throw new Error('Valid PI record with piNo is required.');
  }

  const cleanPiNo = String(piData.piNo).trim();
  console.log(`[Zoho Push] Starting 1-way push for PI: ${cleanPiNo}...`);

  // 1. Resolve Customer Contact in Zoho Books
  const customerResolution = await resolveZohoCustomerId(piData);
  const customerId = customerResolution.contactId || customerResolution;
  const contactObj = customerResolution.contact || {};

  // 2. Fetch Active Zoho Taxes and determine Tax Specification
  const activeTaxes = await fetchActiveZohoTaxes();
  const isIntraState = determineIsIntraState(piData);
  const defaultRate = parseFloat(piData.taxRate || piData.gstRate) || 18;

  // 3. Build Line Items
  const lineItems = [];
  const pGroups = piData.presetGroups || {};
  const groupEntries = Array.isArray(pGroups) ? pGroups : Object.values(pGroups);
  const hasPresetGroups = groupEntries.length > 0;

  // Add Preset Kits
  if (hasPresetGroups) {
    groupEntries.forEach(grp => {
      if (!grp) return;
      const setCount = parseFloat(grp.setCount) || 1;
      const unitPrice = parseFloat(grp.kitPrice != null ? grp.kitPrice : grp.price) || 0;
      const name = grp.presetName || grp.name || piData.presetName || 'Solar Mounting Structure Preset Kit';
      const kitRate = parseFloat(grp.taxRate || grp.gstRate) || defaultRate;
      const taxId = resolveZohoTaxId({ isIntraState, requestedRate: kitRate, activeTaxes });
      lineItems.push({
        name: String(name).slice(0, 100),
        rate: unitPrice,
        quantity: setCount,
        tax_id: taxId,
        description: `Preset Kit Package (${setCount} Set)`.slice(0, 100)
      });
    });
  }

  // Add Custom / Individual items
  const customItems = Array.isArray(piData.items) ? piData.items : [];
  customItems.forEach(it => {
    if (hasPresetGroups && (it.isPresetItem || it.presetGroupId)) return;
    const q = parseFloat(it.qty || it.quantity) || 1;
    let r = parseFloat(it.rate != null ? it.rate : it.unitValue);
    if (isNaN(r) || r < 0) r = 0;
    const itemRate = parseFloat(it.taxRate || it.gstRate) || defaultRate;
    const taxId = resolveZohoTaxId({ isIntraState, requestedRate: itemRate, activeTaxes });
    lineItems.push({
      name: String(it.name || it.productName || 'Solar Structure Component').slice(0, 100),
      rate: r,
      quantity: q,
      tax_id: taxId,
      description: String(it.description || it.category || 'Product Scope').slice(0, 100)
    });
  });

  // Fallback line item if empty
  if (lineItems.length === 0) {
    const fallbackRate = parseFloat(piData.grandTotal || piData.subtotal || piData.total || 1000);
    const taxId = resolveZohoTaxId({ isIntraState, requestedRate: defaultRate, activeTaxes });
    lineItems.push({
      name: String(piData.productName || 'Solar Mounting Structure Scope').slice(0, 100),
      rate: fallbackRate,
      quantity: 1,
      tax_id: taxId,
      description: 'Solar Structure Scope'
    });
  }

  // 4. Resolve structured Billing & Shipping addresses with fallbacks
  const rawBilling = piData.billingAddress || (piData.sameAsBilling ? piData.deliveryAddress : null) || piData.deliveryAddress;
  const rawShipping = piData.deliveryAddress || (piData.sameAsBilling ? piData.billingAddress : null) || piData.billingAddress;

  const parsedBilling = parseToZohoAddress(rawBilling, contactObj.billing_address);
  const parsedShipping = parseToZohoAddress(rawShipping, contactObj.shipping_address || contactObj.billing_address || parsedBilling);

  // If one of them has an address and the other is blank, cross-copy so neither Bill To nor Ship To is empty
  if (!parsedBilling.address && parsedShipping.address) {
    Object.assign(parsedBilling, parsedShipping);
  }
  if (!parsedShipping.address && parsedBilling.address) {
    Object.assign(parsedShipping, parsedBilling);
  }

  // 5. Build Zoho Books Estimate Payload
  const zohoPayload = {
    customer_id: customerId,
    estimate_number: cleanPiNo,
    date: formatZohoDate(piData.piDate),
    expiry_date: (piData.expDate || piData.validUntilDate) ? formatZohoDate(piData.expDate || piData.validUntilDate) : undefined,
    line_items: lineItems,
    notes: (piData.remarks || piData.notes || `Proforma Invoice ${cleanPiNo} generated via BUSINZ`).slice(0, 80),
    billing_address: parsedBilling,
    shipping_address: parsedShipping
  };

  if (contactObj.billing_address?.address_id) {
    zohoPayload.billing_address_id = contactObj.billing_address.address_id;
  }
  if (contactObj.shipping_address?.address_id) {
    zohoPayload.shipping_address_id = contactObj.shipping_address.address_id;
  }

  let zohoEstimate = null;
  let actionTaken = 'created';

  // 4. If already has zohoEstimateId, try updating via PUT
  if (piData.zohoEstimateId) {
    console.log(`[Zoho Push] Updating existing Zoho Estimate: ${piData.zohoEstimateId}...`);
    const putRes = await zohoRequest({
      method: 'PUT',
      path: `/books/v3/estimates/${piData.zohoEstimateId}?ignore_auto_number_generation=true`
    }, zohoPayload);

    if (putRes.ok && putRes.data?.estimate) {
      zohoEstimate = putRes.data.estimate;
      actionTaken = 'updated';
    } else {
      console.warn(`[Zoho Push] Update via ID failed (${putRes.data?.message || putRes.statusCode}), attempting search or recreate...`);
    }
  }

  // 5. If not updated, try POST to create
  if (!zohoEstimate) {
    const postRes = await zohoRequest({
      method: 'POST',
      path: '/books/v3/estimates?ignore_auto_number_generation=true'
    }, zohoPayload);

    if (postRes.ok && postRes.data?.estimate) {
      zohoEstimate = postRes.data.estimate;
      actionTaken = 'created';
    } else if (postRes.data?.code === 36015 || postRes.data?.code === 1001 || (postRes.data?.message && postRes.data.message.toLowerCase().includes('already exists'))) {
      // Estimate number already exists in Zoho Books -> Find & update via PUT
      console.log(`[Zoho Push] Estimate ${cleanPiNo} already exists in Zoho Books. Locating for PUT update...`);
      const searchRes = await zohoRequest({
        path: `/books/v3/estimates?estimate_number=${encodeURIComponent(cleanPiNo)}`
      });

      let foundEst = searchRes.data?.estimates?.find(e =>
        String(e.estimate_number || '').trim().toLowerCase() === cleanPiNo.toLowerCase()
      );

      if (!foundEst) {
        const textSearchRes = await zohoRequest({
          path: `/books/v3/estimates?search_text=${encodeURIComponent(cleanPiNo)}`
        });
        foundEst = textSearchRes.data?.estimates?.find(e =>
          String(e.estimate_number || '').trim().toLowerCase() === cleanPiNo.toLowerCase()
        ) || textSearchRes.data?.estimates?.[0];
      }

      if (foundEst?.estimate_id) {
        const putUpdateRes = await zohoRequest({
          method: 'PUT',
          path: `/books/v3/estimates/${foundEst.estimate_id}?ignore_auto_number_generation=true`
        }, zohoPayload);

        if (putUpdateRes.ok && putUpdateRes.data?.estimate) {
          zohoEstimate = putUpdateRes.data.estimate;
          actionTaken = 'updated';
        } else {
          zohoEstimate = foundEst;
          actionTaken = 'synced';
        }
      } else {
        throw new Error(postRes.data?.message || `Estimate ${cleanPiNo} already exists in Zoho Books but could not be updated.`);
      }
    } else {
      throw new Error(postRes.data?.message || `Zoho Books API error [${postRes.statusCode}]: ${JSON.stringify(postRes.data)}`);
    }
  }

  // 6. Mark estimate as Sent in Zoho Books so it is active/official
  if (zohoEstimate?.estimate_id) {
    try {
      await zohoRequest({
        method: 'POST',
        path: `/books/v3/estimates/${zohoEstimate.estimate_id}/status/sent`
      }, null);
    } catch (_) {}
  }

  // 7. Update PI record in local stores and database (Targeted 1-row update)
  const updatedPiMetadata = {
    zohoSynced: true,
    zohoEstimateId: String(zohoEstimate.estimate_id).trim(),
    zohoEstimateNo: zohoEstimate.estimate_number || cleanPiNo,
    zohoSyncedAt: new Date().toISOString(),
    zohoSyncError: null,
    zohoModule: 'Quotes'
  };

  const syncStores = (fileName) => {
    try {
      const p = getStoreFilePath(fileName);
      if (fs.existsSync(p)) {
        const list = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(list)) {
          let modified = false;
          const targetLower = cleanPiNo.toLowerCase();
          const updatedList = list.map(item => {
            if (String(item.piNo || item.id || '').trim().toLowerCase() === targetLower) {
              modified = true;
              return { ...item, ...updatedPiMetadata };
            }
            return item;
          });
          if (modified) {
            fs.writeFileSync(p, JSON.stringify(updatedList, null, 2), 'utf8');
          }
        }
      }
    } catch (err) {
      console.warn(`[Zoho Push] Store update failed for ${fileName}:`, err.message);
    }
  };

  syncStores('proforma_invoice_store.json');
  syncStores('sales_pi_store.json');

  if (isDbConnected()) {
    try {
      await query(`
        UPDATE public.controlroom_store
        SET data = (
          SELECT jsonb_agg(
            CASE 
              WHEN LOWER(TRIM(elem->>'piNo')) = LOWER($1) OR LOWER(TRIM(elem->>'id')) = LOWER($1)
              THEN elem || $2::jsonb
              ELSE elem
            END
          )
          FROM jsonb_array_elements(data::jsonb) AS elem
        ),
        updated_at = NOW()
        WHERE key IN ('proforma_invoice_store', 'sales_pi_store')
      `, [cleanPiNo, JSON.stringify(updatedPiMetadata)]);
    } catch (err) {
      console.warn('[Zoho Push] Database store update failed:', err.message);
    }
  }

  const resultPi = {
    ...piData,
    ...updatedPiMetadata
  };

  console.log(`[Zoho Push Success] PI ${cleanPiNo} pushed to Zoho Books as Estimate #${zohoEstimate.estimate_number || cleanPiNo} (${actionTaken}).`);

  return {
    success: true,
    action: actionTaken,
    message: `Proforma Invoice ${cleanPiNo} successfully ${actionTaken} in Zoho Books as Quote #${zohoEstimate.estimate_number || cleanPiNo}.`,
    estimate: zohoEstimate,
    pi: resultPi
  };
}
