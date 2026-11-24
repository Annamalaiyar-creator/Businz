import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { parseAddressString, formatAddressObj } from '../../utils/otherViewsShared';
import { getHsnCode } from '../../utils/hsnCodeService';
import { extractGstRate } from '../../utils/gstHelper';

export async function uploadAndParsePoPdf(e, ctx) {
  const {
    showCustomAlert,
    setIsParsingPoPdf,
    zohoVendors,
    handleVendorChange,
    setVendorName,
    setGstNo,
    setContactPerson,
    setContactNo,
    setEmail,
    setPoDate,
    setDeliveryDate,
    setPaymentTerms,
    setAdvancePaidPct,
    setDeliveryAddress,
    setDeliveryAddress1,
    setDeliveryAddress2,
    setDeliveryCity,
    setDeliveryState,
    setDeliveryPincode,
    setBillingAddress,
    setBillingAddress1,
    setBillingAddress2,
    setBillingCity,
    setBillingState,
    setBillingPincode,
    setNotes,
    setTerms,
    setShippingCharges,
    setItems,
    availableCatalogItems,
    setDiscountPct,
    poNumber
  } = ctx;

  
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      showCustomAlert('Please upload a valid digital PDF (.pdf) file.', 'Invalid File Type', 'warning');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showCustomAlert('PDF file must be 10 MB or smaller.', 'File Too Large', 'warning');
      return;
    }

    setIsParsingPoPdf(true);
    try {
      const fileBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read the PDF file.'));
        reader.readAsDataURL(file);
      });

      const res = await fetchWithTimeout('/api/po/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileBase64 })
      }, 20000);

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `Failed to parse PO PDF (HTTP ${res.status})`);
      }

      if (payload.scannedWarning) {
        showCustomAlert(
          'This PDF appears to be a scanned image with no selectable text. Please upload a digital/text-based PO PDF.',
          'Scanned PDF Detected',
          'warning'
        );
        return;
      }

      const data = payload.data || {};
      const applied = [];

      // IMPORTANT: Never overwrite poNumber — BUSINZ keeps its own Zoho sequential PO-000XX number.

      // 1. Vendor match (by GSTIN first, then name)
      const norm = (s) => String(s || '').trim().toLowerCase();
      let matchedVendor = null;
      if (data.vendorGstin) {
        matchedVendor = (zohoVendors || []).find(v => norm(v.gstin || v.gstNo) === norm(data.vendorGstin));
      }
      if (!matchedVendor && data.vendorName) {
        const targetName = norm(data.vendorName);
        matchedVendor = (zohoVendors || []).find(v => {
          const vn = norm(v.name);
          return vn === targetName || (vn && targetName && (vn.includes(targetName) || targetName.includes(vn)));
        });
      }

      if (matchedVendor) {
        handleVendorChange(matchedVendor.name, matchedVendor);
        applied.push('Vendor');
      } else if (data.vendorName) {
        setVendorName(data.vendorName);
        applied.push('Vendor Name');
      }

      if (data.vendorGstin) {
        setGstNo(data.vendorGstin);
        if (!applied.includes('Vendor')) applied.push('GSTIN');
      }
      if (data.contactPerson) setContactPerson(data.contactPerson);
      if (data.contactNo) setContactNo(data.contactNo);
      if (data.email) setEmail(data.email);

      // 2. Dates
      if (data.poDate) {
        setPoDate(data.poDate);
        applied.push('PO Date');
      }
      if (data.deliveryDate) {
        setDeliveryDate(data.deliveryDate);
        applied.push('Delivery Date');
      }

      // 3. Payment Terms
      if (data.paymentTerms) {
        setPaymentTerms(data.paymentTerms);
        if (data.paymentTerms === 'Advance' && data.advancePaidPct !== null && data.advancePaidPct !== undefined) {
          setAdvancePaidPct(String(data.advancePaidPct));
        }
        applied.push('Payment Terms');
      }

      // 4. Delivery & Billing Addresses
      if (data.deliveryAddress) {
        const parsedDel = parseAddressString(data.deliveryAddress);
        setDeliveryAddress(data.deliveryAddress);
        setDeliveryAddress1(parsedDel.address1 || data.deliveryAddress);
        setDeliveryAddress2(parsedDel.address2 || '');
        if (parsedDel.city) setDeliveryCity(parsedDel.city);
        if (parsedDel.state) setDeliveryState(parsedDel.state);
        if (parsedDel.pincode) setDeliveryPincode(parsedDel.pincode);
        applied.push('Delivery Address');
      }
      if (data.billingAddress && !matchedVendor) {
        const parsedBill = parseAddressString(data.billingAddress);
        setBillingAddress(data.billingAddress);
        setBillingAddress1(parsedBill.address1 || data.billingAddress);
        setBillingAddress2(parsedBill.address2 || '');
        if (parsedBill.city) setBillingCity(parsedBill.city);
        if (parsedBill.state) setBillingState(parsedBill.state);
        if (parsedBill.pincode) setBillingPincode(parsedBill.pincode);
        applied.push('Billing Address');
      }

      // 5. Charges, Notes & Terms
      if (Number(data.shippingCharges) > 0) {
        setShippingCharges(Number(data.shippingCharges));
        applied.push('Shipping Charges');
      }
      if (Number(data.discountPct) > 0) {
        setDiscountPct(Number(data.discountPct));
        applied.push('Discount %');
      }
      if (data.notes) {
        setNotes(data.notes);
        applied.push('Notes');
      }
      if (data.terms) {
        setTerms(data.terms);
        applied.push('Terms');
      }

      // 6. Line Items
      if (Array.isArray(data.items) && data.items.length > 0) {
        const mappedItems = data.items.map(it => {
          const itemNameLower = norm(it.name);
          const catalogMatch = (availableCatalogItems || []).find(c => norm(c.name) === itemNameLower);
          return {
            name: catalogMatch ? catalogMatch.name : it.name,
            description: it.description || catalogMatch?.description || '',
            account: catalogMatch?.account || it.account || 'Raw Materials',
            hsn: it.hsn || catalogMatch?.hsn || getHsnCode(it.name) || '',
            qty: Number(it.qty) > 0 ? Number(it.qty) : 1,
            unit: (it.unit || catalogMatch?.unit || 'NOS').toUpperCase(),
            rate: Number(it.rate) >= 0 ? Number(it.rate) : (Number(catalogMatch?.rate) || 0),
            tax: Number.isFinite(Number(it.tax)) ? Number(it.tax) : 18
          };
        });
        setItems(mappedItems);
        applied.push(`${mappedItems.length} Line Item(s)`);
      }

      if (applied.length === 0) {
        showCustomAlert(
          'PDF was read, but no standard PO fields could be matched automatically. Please fill the fields manually or share a sample PDF to tune the parser.',
          'No Fields Matched',
          'warning'
        );
      } else {
        showCustomAlert(
          `✅ Copied from PDF: ${applied.join(', ')}. PO Number (${poNumber || 'BUSINZ sequence'}) was kept untouched. Please review before saving.`,
          'PO PDF Auto-Filled',
          'success'
        );
      }
    } catch (err) {
      showCustomAlert(err?.message || 'Unable to parse the uploaded PO PDF.', 'PO PDF Upload Error', 'warning');
    } finally {
      setIsParsingPoPdf(false);
    }

}
