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
 * Truncate address to maximum 80 characters to satisfy Zoho Books API constraint.
 */
function cleanZohoAddress(addr) {
  if (!addr) return undefined;
  if (typeof addr === 'string') {
    return addr.trim().slice(0, 80);
  }
  const parts = [
    addr.street || addr.address || '',
    addr.city || '',
    addr.state || '',
    addr.pincode || addr.pin || ''
  ].filter(Boolean);
  return parts.join(', ').trim().slice(0, 80) || undefined;
}

/**
 * Resolve or dynamically provision a customer contact in Zoho Books.
 */
async function resolveZohoCustomerId(pi) {
  const customerName = String(pi.customerName || pi.companyName || pi.vendor || 'Direct Customer').trim();
  let lastZohoError = null;

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
      if (match?.contact_id) return match.contact_id;
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
      if (match?.contact_id) return match.contact_id;
    }
    if (textSearchRes.data?.message && textSearchRes.data?.code !== 0) {
      lastZohoError = textSearchRes.data.message;
    }
  } catch (_) {}

  // 3. Create new customer contact in Zoho Books
  try {
    const rawGst = String(pi.gstNo || pi.gstNumber || '').trim();
    const billingAddrStr = cleanZohoAddress(pi.billingAddress);
    const shippingAddrStr = cleanZohoAddress(pi.deliveryAddress || pi.shippingAddress);

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

    if (billingAddrStr) {
      newCustPayload.billing_address = {
        address: billingAddrStr,
        city: (pi.billingAddress?.city || '').slice(0, 40),
        state: (pi.billingAddress?.state || '').slice(0, 40),
        zip: (pi.billingAddress?.pincode || '').slice(0, 20),
        country: 'India'
      };
    }

    if (shippingAddrStr) {
      newCustPayload.shipping_address = {
        address: shippingAddrStr,
        city: (pi.deliveryAddress?.city || '').slice(0, 40),
        state: (pi.deliveryAddress?.state || '').slice(0, 40),
        zip: (pi.deliveryAddress?.pincode || '').slice(0, 20),
        country: 'India'
      };
    }

    const createRes = await zohoRequest({
      method: 'POST',
      path: '/books/v3/contacts'
    }, newCustPayload);

    if (createRes.ok && createRes.data?.contact?.contact_id) {
      console.log(`[Zoho Contact Created]: ${customerName} -> ${createRes.data.contact.contact_id}`);
      return createRes.data.contact.contact_id;
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
      return firstRes.data.contacts[0].contact_id;
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

/**
 * Push a single Proforma Invoice to Zoho Books as an Estimate / Quote.
 */
export async function pushPiToZoho(piData) {
  if (!piData || !piData.piNo) {
    throw new Error('Valid PI record with piNo is required.');
  }

  const cleanPiNo = String(piData.piNo).trim();
  console.log(`[Zoho Push] Starting 1-way push for PI: ${cleanPiNo}...`);

  // 1. Resolve Customer Contact ID in Zoho Books
  const customerId = await resolveZohoCustomerId(piData);

  // 2. Build Line Items
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
      lineItems.push({
        name: String(name).slice(0, 100),
        rate: unitPrice,
        quantity: setCount,
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
    lineItems.push({
      name: String(it.name || it.productName || 'Solar Structure Component').slice(0, 100),
      rate: r,
      quantity: q,
      description: String(it.description || it.category || 'Product Scope').slice(0, 100)
    });
  });

  // Fallback line item if empty
  if (lineItems.length === 0) {
    const fallbackRate = parseFloat(piData.grandTotal || piData.subtotal || piData.total || 1000);
    lineItems.push({
      name: String(piData.productName || 'Solar Mounting Structure Scope').slice(0, 100),
      rate: fallbackRate,
      quantity: 1,
      description: 'Solar Structure Scope'
    });
  }

  // 3. Build Zoho Books Estimate Payload
  const zohoPayload = {
    customer_id: customerId,
    estimate_number: cleanPiNo,
    date: formatZohoDate(piData.piDate),
    expiry_date: (piData.expDate || piData.validUntilDate) ? formatZohoDate(piData.expDate || piData.validUntilDate) : undefined,
    line_items: lineItems,
    notes: (piData.remarks || piData.notes || `Proforma Invoice ${cleanPiNo} generated via BUSINZ`).slice(0, 80)
  };

  // Truncated addresses (Rule: <= 80 characters)
  const billingAddr = cleanZohoAddress(piData.billingAddress);
  const deliveryAddr = cleanZohoAddress(piData.deliveryAddress);
  if (billingAddr) zohoPayload.billing_address = { address: billingAddr };
  if (deliveryAddr) zohoPayload.shipping_address = { address: deliveryAddr };

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
