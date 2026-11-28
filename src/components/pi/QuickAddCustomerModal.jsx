import React, { useState, useRef, useEffect } from 'react';
import { X, Save, FileText, Truck, UserPlus } from 'lucide-react';
import { getNextSequence } from '../../utils/sequenceGenerator';
import { invalidateCustomerCache } from '../../services/customerService';

const INITIAL_FORM_STATE = {
  customerName: '',
  companyName: '',
  customerType: 'EPC Contractor',
  gstNumber: '',
  panNumber: '',
  address1: '',
  address2: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  dispatchAddress1: '',
  dispatchAddress2: '',
  dispatchAddress: '',
  dispatchCity: '',
  dispatchState: '',
  dispatchPincode: '',
  sameAsBilling: true,
  creditLimit: '',
  creditDays: '30',
  creditApproved: false,
  creditStatus: 'none',
  creditRequestedLimit: '',
  requestCreditApproval: false,
  paymentTerms: '',
  source: 'Direct Client',
  billingAddressType: 'Registered Office',
  notes: '',
  altPhone: '',
  primaryContact: {
    name: '',
    phone: '',
    altPhone: '',
    whatsapp: '',
    email: ''
  }
};

export default function QuickAddCustomerModal({
  isOpen,
  onClose,
  existingCustomers = [],
  activeUserName = 'System User',
  onCreated
}) {
  const [formCust, setFormCust] = useState(INITIAL_FORM_STATE);
  const [gstLookupLoading, setGstLookupLoading] = useState(false);
  const [gstLookupNotice, setGstLookupNotice] = useState(null);
  const [gstAddresses, setGstAddresses] = useState([]);
  const [saveError, setSaveError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const lastAutoFetchedGstRef = useRef('');

  useEffect(() => {
    if (isOpen) {
      setFormCust(INITIAL_FORM_STATE);
      setGstLookupLoading(false);
      setGstLookupNotice(null);
      setGstAddresses([]);
      setSaveError(null);
      setIsSaving(false);
      lastAutoFetchedGstRef.current = '';
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const nextCodePreview =
    getNextSequence('CS', existingCustomers || []).code ||
    `VRM-CS-${new Date().getFullYear()}-01`;

  const applyGstAddressChoice = (addrObj) => {
    if (!addrObj) return;
    setFormCust((prev) => ({
      ...prev,
      address1: addrObj.address1 || addrObj.address || prev.address1,
      address2: addrObj.address2 || '',
      address: addrObj.address || prev.address,
      city: addrObj.city || prev.city,
      state: addrObj.state || prev.state,
      pincode: addrObj.pincode || prev.pincode,
      ...(prev.sameAsBilling ? {
        dispatchAddress1: addrObj.address1 || addrObj.address || prev.dispatchAddress1,
        dispatchAddress2: addrObj.address2 || '',
        dispatchAddress: addrObj.address || prev.dispatchAddress,
        dispatchCity: addrObj.city || prev.dispatchCity,
        dispatchState: addrObj.state || prev.dispatchState,
        dispatchPincode: addrObj.pincode || prev.dispatchPincode
      } : {})
    }));
  };

  const handleFetchGstDetails = async (overrideGst) => {
    const cleanGst = String(overrideGst ?? formCust.gstNumber ?? '').trim().toUpperCase();
    if (cleanGst.length !== 15) return;
    setGstLookupLoading(true);
    setGstLookupNotice(null);
    try {
      const res = await fetch(`/api/gst-lookup?gstin=${encodeURIComponent(cleanGst)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setGstLookupNotice({ ok: false, msg: data.error || 'GST lookup failed.' });
        return;
      }
      const addrs = Array.isArray(data.addresses) && data.addresses.length > 0 ? data.addresses : [];
      setGstAddresses(addrs);
      const resolvedName = data.legalName || data.tradeName || '';
      setFormCust((prev) => ({
        ...prev,
        gstNumber: cleanGst,
        panNumber: data.pan || cleanGst.substring(2, 12),
        companyName: resolvedName || prev.companyName,
        customerName: data.tradeName || resolvedName || prev.customerName,
        additionalAddresses: addrs.length > 0 ? addrs : prev.additionalAddresses,
        address1: data.address1 || data.address || prev.address1,
        address2: data.address2 || prev.address2,
        address: data.address || prev.address,
        city: data.city || prev.city,
        state: data.state || prev.state,
        pincode: data.pincode || prev.pincode,
        ...(prev.sameAsBilling ? {
          dispatchAddress1: data.address1 || data.address || prev.dispatchAddress1,
          dispatchAddress2: data.address2 || prev.dispatchAddress2,
          dispatchAddress: data.address || prev.dispatchAddress,
          dispatchCity: data.city || prev.dispatchCity,
          dispatchState: data.state || prev.dispatchState,
          dispatchPincode: data.pincode || prev.dispatchPincode
        } : {})
      }));
      setGstLookupNotice({
        ok: true,
        msg: `Fetched ${resolvedName || cleanGst} (${data.status || 'Active'})${addrs.length > 1 ? ` · ${addrs.length} addresses found` : ''}`
      });
    } catch (err) {
      setGstLookupNotice({ ok: false, msg: err?.message || 'Failed to fetch GST details.' });
    } finally {
      setGstLookupLoading(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaveError(null);

    const resolvedName = (formCust.companyName || formCust.customerName || '').trim();
    if (!resolvedName) {
      setSaveError('Company / Organization Legal Name is mandatory.');
      return;
    }
    if (!formCust.source || !formCust.source.trim()) {
      setSaveError('Acquisition Source is mandatory.');
      return;
    }
    if (!formCust.customerType || !formCust.customerType.trim()) {
      setSaveError('Customer Account Type is mandatory.');
      return;
    }
    if (!formCust.primaryContact.name || !formCust.primaryContact.name.trim()) {
      setSaveError('Contact Person Name is mandatory.');
      return;
    }
    if (!formCust.primaryContact.phone || !formCust.primaryContact.phone.trim()) {
      setSaveError('Mobile / Phone is mandatory.');
      return;
    }
    if (!formCust.address1 || !formCust.address1.trim()) {
      setSaveError('Billing Address 1 (Building / Street) is mandatory.');
      return;
    }

    const cleanGstInput = String(formCust.gstNumber || '').trim().toUpperCase();
    if (cleanGstInput) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(cleanGstInput)) {
        setSaveError('Invalid GST Number format. Must be a valid 15-character GSTIN (e.g. 33AABCU9603R1ZM).');
        return;
      }
      const dupGstCust = (existingCustomers || []).find((c) => {
        const cGst = String(c.gstNumber || c.gstNo || c.gstin || '').trim().toUpperCase();
        return cGst && cGst === cleanGstInput;
      });
      if (dupGstCust) {
        setSaveError(`Duplicate GST Number: "${cleanGstInput}" is already registered to "${dupGstCust.companyName || dupGstCust.customerName || dupGstCust.name || 'another customer'}".`);
        return;
      }
    }

    const customerCode = nextCodePreview;
    const formatAddr = (addr, city, state, pin) => {
      const parts = [];
      if (addr && addr.trim()) parts.push(addr.trim());
      if (city && city.trim()) parts.push(city.trim());
      if (state && state.trim() && pin && pin.trim()) {
        parts.push(`${state.trim()} - ${pin.trim()}`);
      } else {
        if (state && state.trim()) parts.push(state.trim());
        if (pin && pin.trim()) parts.push(pin.trim());
      }
      return parts.join(', ');
    };

    const billingStreetCombined = [formCust.address1, formCust.address2].filter(Boolean).join(', ') || formCust.address || '';
    const dispatchStreetCombined = formCust.sameAsBilling
      ? billingStreetCombined
      : ([formCust.dispatchAddress1, formCust.dispatchAddress2].filter(Boolean).join(', ') || formCust.dispatchAddress || '');

    const billingStr = formatAddr(billingStreetCombined, formCust.city, formCust.state, formCust.pincode);
    const dispatchStr = formCust.sameAsBilling
      ? billingStr
      : formatAddr(dispatchStreetCombined, formCust.dispatchCity, formCust.dispatchState, formCust.dispatchPincode);

    const billingObj = {
      address1: (formCust.address1 || '').trim(),
      address2: (formCust.address2 || '').trim(),
      address: billingStreetCombined.trim(),
      city: (formCust.city || '').trim(),
      state: (formCust.state || '').trim(),
      pincode: (formCust.pincode || '').trim()
    };

    const deliveryObj = formCust.sameAsBilling ? { ...billingObj } : {
      address1: (formCust.dispatchAddress1 || '').trim(),
      address2: (formCust.dispatchAddress2 || '').trim(),
      address: dispatchStreetCombined.trim(),
      city: (formCust.dispatchCity || '').trim(),
      state: (formCust.dispatchState || '').trim(),
      pincode: (formCust.dispatchPincode || '').trim()
    };

    const repName = activeUserName || 'System User';
    const record = {
      id: customerCode,
      customerCode,
      ...formCust,
      customerName: resolvedName,
      companyName: resolvedName,
      code: customerCode,
      c2: resolvedName,
      c3: formCust.primaryContact?.name || '',
      c4: formCust.primaryContact?.phone || '',
      c5: formCust.primaryContact?.email || '',
      altPhone: formCust.primaryContact?.altPhone || formCust.altPhone || '',
      altNumber: formCust.primaryContact?.altPhone || formCust.altPhone || '',
      address1: (formCust.address1 || '').trim(),
      address2: (formCust.address2 || '').trim(),
      billingAddress1: (formCust.address1 || '').trim(),
      billingAddress2: (formCust.address2 || '').trim(),
      dispatchAddress1: formCust.sameAsBilling ? (formCust.address1 || '').trim() : (formCust.dispatchAddress1 || '').trim(),
      dispatchAddress2: formCust.sameAsBilling ? (formCust.address2 || '').trim() : (formCust.dispatchAddress2 || '').trim(),
      shippingAddress1: formCust.sameAsBilling ? (formCust.address1 || '').trim() : (formCust.dispatchAddress1 || '').trim(),
      shippingAddress2: formCust.sameAsBilling ? (formCust.address2 || '').trim() : (formCust.dispatchAddress2 || '').trim(),
      address: billingStreetCombined,
      dispatchAddress: dispatchStreetCombined,
      c6: billingStr,
      billingAddress: billingStr,
      billingAddressObj: billingObj,
      c7: dispatchStr,
      deliveryAddress: dispatchStr,
      deliveryAddressObj: deliveryObj,
      gstNo: cleanGstInput || '',
      gstNumber: cleanGstInput || '',
      status: 'ACTIVE',
      assignedSalesperson: repName,
      c8: repName,
      salesPerson: repName,
      creditDays: 30,
      creditLimit: 0,
      creditRequestedLimit: 0,
      creditApproved: false,
      creditStatus: 'none',
      requestCreditApproval: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIsSaving(true);
    try {
      const sesId = typeof window !== 'undefined'
        ? (localStorage.getItem('controlroom_device_session_id') || localStorage.getItem('businz_device_session_id'))
        : null;
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sesId ? { 'x-session-id': sesId } : {})
        },
        body: JSON.stringify({ ...record, isNew: true })
      });
      const resJson = await response.json().catch(() => ({}));
      if (!response.ok || resJson?.success === false) {
        setSaveError(
          response.status === 401
            ? 'Your login session expired. Please sign in again to save this customer.'
            : (resJson?.error || 'Failed to save customer to database. Please try again.')
        );
        return;
      }

      const mergedFinal = resJson?.customer ? { ...record, ...resJson.customer } : record;
      invalidateCustomerCache();
      try {
        window.dispatchEvent(new CustomEvent('controlroom_customer_update', { detail: mergedFinal }));
      } catch (_) {}
      if (onCreated) onCreated(mergedFinal);
    } catch (_) {
      setSaveError('Unable to reach server to save customer. Please check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '92vh',
          backgroundColor: '#F8FAFC',
          borderRadius: '18px',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.35)',
          border: '1px solid #CBD5E1',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
                Add New B2B Customer
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                Create customer right from PI — saved to Customer Master & auto-selected here immediately
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: '34px', height: '34px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSave} style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {saveError && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: '13px', fontWeight: '700' }}>
              ⚠️ {saveError}
            </div>
          )}

          {/* SECTION 1: ACCOUNT IDENTIFICATION */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800' }}>1</div>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ACCOUNT IDENTIFICATION
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Customer Code</label>
                <input type="text" value={nextCodePreview} readOnly disabled style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', color: '#0E7490', fontWeight: '800', backgroundColor: '#F0FDFA', cursor: 'not-allowed', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Creation Date</label>
                <input type="date" value={new Date().toISOString().split('T')[0]} readOnly disabled style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 12px', fontSize: '13px', color: '#64748B', backgroundColor: '#F1F5F9', cursor: 'not-allowed', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Acquisition Source <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select value={formCust.source} onChange={(e) => setFormCust({ ...formCust, source: e.target.value })} required style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box' }}>
                  <option value="Direct Client">Direct Client / Walk-in</option>
                  <option value="Website">Official Website Lead</option>
                  <option value="WhatsApp">WhatsApp Business</option>
                  <option value="Referral">Client / EPC Referral</option>
                  <option value="Trade Exhibition">Intersolar / Renewable Expo</option>
                  <option value="ERP">ERP Database Import</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: COMPANY PROFILE & STATUTORY DETAILS */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800' }}>2</div>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                COMPANY PROFILE & STATUTORY DETAILS
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Company / Organization Legal Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Solar Limited"
                  value={formCust.companyName}
                  onChange={(e) => setFormCust({ ...formCust, companyName: e.target.value, customerName: e.target.value })}
                  style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Customer Account Type <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select value={formCust.customerType} onChange={(e) => setFormCust({ ...formCust, customerType: e.target.value })} required style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box' }}>
                  <option value="EPC Contractor">EPC Contractor</option>
                  <option value="Independent Power Producer (IPP)">Independent Power Producer (IPP)</option>
                  <option value="Module & Structure Manufacturer">Module & Structure Manufacturer</option>
                  <option value="Rooftop Installer">Rooftop Solar Installer</option>
                  <option value="Distributor">Solar Distributor / Reseller</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  GSTIN / Tax ID (15 Digits)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="e.g. 33AABCV1234F1Z5"
                    value={formCust.gstNumber}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      const cleanVal = val.trim();
                      const derivedPan = cleanVal.length >= 12 ? cleanVal.substring(2, 12) : (formCust.panNumber || '');
                      setFormCust({ ...formCust, gstNumber: val, panNumber: derivedPan });
                      if (/^[0-9]{2}[A-Z0-9]{13}$/.test(cleanVal)) {
                        if (lastAutoFetchedGstRef.current !== cleanVal) {
                          lastAutoFetchedGstRef.current = cleanVal;
                          handleFetchGstDetails(cleanVal);
                        }
                      } else {
                        lastAutoFetchedGstRef.current = '';
                        if (gstLookupNotice) setGstLookupNotice(null);
                        if (gstAddresses.length > 0) setGstAddresses([]);
                      }
                    }}
                    style={{ width: '100%', height: '40px', borderRadius: '10px', border: gstLookupLoading ? '1px solid #0E7490' : '1px solid #CBD5E1', padding: gstLookupLoading ? '0 105px 0 12px' : '0 12px', fontSize: '13px', fontFamily: 'monospace', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                  />
                  {gstLookupLoading && (
                    <div style={{ position: 'absolute', right: '10px', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '6px', backgroundColor: '#ECFEFF', color: '#0E7490', fontSize: '11px', fontWeight: '700', pointerEvents: 'none' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M12 2a10 10 0 0 1 10 10">
                          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.75s" repeatCount="indefinite" />
                        </path>
                      </svg>
                      <span>Fetching...</span>
                    </div>
                  )}
                </div>
                {gstLookupNotice && (
                  <div style={{ marginTop: '5px', fontSize: '11px', fontWeight: '600', color: gstLookupNotice.ok ? '#059669' : '#DC2626' }}>
                    {gstLookupNotice.msg}
                  </div>
                )}
                {gstAddresses.length > 1 && (
                  <select
                    onChange={(e) => {
                      const chosen = gstAddresses[Number(e.target.value)];
                      if (chosen) applyGstAddressChoice(chosen);
                    }}
                    style={{ marginTop: '6px', width: '100%', height: '34px', borderRadius: '8px', border: '1px solid #BAE6FD', backgroundColor: '#F0F9FF', padding: '0 10px', fontSize: '11.5px', fontWeight: '600', color: '#0369A1' }}
                  >
                    {gstAddresses.map((a, idx) => (
                      <option key={idx} value={idx}>{a.label}: {a.address}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: AUTHORIZED PRIMARY CONTACT PERSON */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800' }}>3</div>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                AUTHORIZED PRIMARY CONTACT PERSON
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Contact Person Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Kannan"
                  value={formCust.primaryContact.name}
                  onChange={(e) => setFormCust({ ...formCust, primaryContact: { ...formCust.primaryContact, name: e.target.value } })}
                  style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Mobile / Phone <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="+91 98765 43210"
                  value={formCust.primaryContact.phone}
                  onChange={(e) => setFormCust({ ...formCust, primaryContact: { ...formCust.primaryContact, phone: e.target.value } })}
                  style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Alt Number / Phone
                </label>
                <input
                  type="text"
                  placeholder="+91 98765 43211"
                  value={formCust.primaryContact.altPhone || formCust.altPhone || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormCust({ ...formCust, altPhone: val, primaryContact: { ...formCust.primaryContact, altPhone: val } });
                  }}
                  style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="accounts@solarclient.com"
                  value={formCust.primaryContact.email}
                  onChange={(e) => setFormCust({ ...formCust, primaryContact: { ...formCust.primaryContact, email: e.target.value } })}
                  style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: BILLING & DISPATCH ADDRESS */}
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800' }}>4</div>
              <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                BILLING & DISPATCH ADDRESS
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
              {/* 4A: BILLING ADDRESS */}
              <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '8px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                    <FileText size={15} />
                  </div>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Billing Address</h4>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>
                    Billing Address 1 <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Building / Door / Street"
                    value={formCust.address1}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormCust((prev) => ({
                        ...prev,
                        address1: val,
                        address: [val, prev.address2].filter(Boolean).join(', '),
                        dispatchAddress1: prev.sameAsBilling ? val : prev.dispatchAddress1,
                        dispatchAddress: prev.sameAsBilling ? [val, prev.address2].filter(Boolean).join(', ') : prev.dispatchAddress
                      }));
                    }}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>Billing Address 2</label>
                  <input
                    type="text"
                    placeholder="Area / Landmark / Road"
                    value={formCust.address2}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormCust((prev) => ({
                        ...prev,
                        address2: val,
                        address: [prev.address1, val].filter(Boolean).join(', '),
                        dispatchAddress2: prev.sameAsBilling ? val : prev.dispatchAddress2,
                        dispatchAddress: prev.sameAsBilling ? [prev.address1, val].filter(Boolean).join(', ') : prev.dispatchAddress
                      }));
                    }}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>City</label>
                    <input
                      type="text"
                      placeholder="Chennai"
                      value={formCust.city}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormCust((prev) => ({ ...prev, city: val, dispatchCity: prev.sameAsBilling ? val : prev.dispatchCity }));
                      }}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>State</label>
                    <input
                      type="text"
                      placeholder="Tamil Nadu"
                      value={formCust.state}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormCust((prev) => ({ ...prev, state: val, dispatchState: prev.sameAsBilling ? val : prev.dispatchState }));
                      }}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Pincode</label>
                    <input
                      type="text"
                      placeholder="600066"
                      value={formCust.pincode}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormCust((prev) => ({ ...prev, pincode: val, dispatchPincode: prev.sameAsBilling ? val : prev.dispatchPincode }));
                      }}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* 4B: DISPATCH ADDRESS */}
              <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '8px', backgroundColor: '#ECFEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490' }}>
                      <Truck size={15} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Dispatch / Delivery Address</h4>
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '700', color: '#0E7490', cursor: 'pointer', backgroundColor: '#ECFEFF', padding: '3px 9px', borderRadius: '7px', border: '1px solid #A5F3FC' }}>
                    <input
                      type="checkbox"
                      checked={formCust.sameAsBilling}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setFormCust((prev) => ({
                          ...prev,
                          sameAsBilling: checked,
                          dispatchAddress1: checked ? prev.address1 : prev.dispatchAddress1,
                          dispatchAddress2: checked ? prev.address2 : prev.dispatchAddress2,
                          dispatchAddress: checked ? [prev.address1, prev.address2].filter(Boolean).join(', ') : prev.dispatchAddress,
                          dispatchCity: checked ? prev.city : prev.dispatchCity,
                          dispatchState: checked ? prev.state : prev.dispatchState,
                          dispatchPincode: checked ? prev.pincode : prev.dispatchPincode
                        }));
                      }}
                      style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                    />
                    Same as Billing
                  </label>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>Shipping Address 1</label>
                  <input
                    type="text"
                    placeholder="Warehouse / Site / Street"
                    value={formCust.sameAsBilling ? formCust.address1 : formCust.dispatchAddress1}
                    disabled={formCust.sameAsBilling}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormCust((prev) => ({ ...prev, dispatchAddress1: val, dispatchAddress: [val, prev.dispatchAddress2].filter(Boolean).join(', ') }));
                    }}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: formCust.sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: formCust.sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '5px' }}>Shipping Address 2</label>
                  <input
                    type="text"
                    placeholder="Industrial Estate / Landmark / Road"
                    value={formCust.sameAsBilling ? formCust.address2 : formCust.dispatchAddress2}
                    disabled={formCust.sameAsBilling}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormCust((prev) => ({ ...prev, dispatchAddress2: val, dispatchAddress: [prev.dispatchAddress1, val].filter(Boolean).join(', ') }));
                    }}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', color: formCust.sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: formCust.sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>City</label>
                    <input
                      type="text"
                      placeholder="Chennai"
                      value={formCust.sameAsBilling ? formCust.city : formCust.dispatchCity}
                      disabled={formCust.sameAsBilling}
                      onChange={(e) => setFormCust({ ...formCust, dispatchCity: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', color: formCust.sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: formCust.sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>State</label>
                    <input
                      type="text"
                      placeholder="Tamil Nadu"
                      value={formCust.sameAsBilling ? formCust.state : formCust.dispatchState}
                      disabled={formCust.sameAsBilling}
                      onChange={(e) => setFormCust({ ...formCust, dispatchState: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', color: formCust.sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: formCust.sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Pincode</label>
                    <input
                      type="text"
                      placeholder="600066"
                      value={formCust.sameAsBilling ? formCust.pincode : formCust.dispatchPincode}
                      disabled={formCust.sameAsBilling}
                      onChange={(e) => setFormCust({ ...formCust, dispatchPincode: e.target.value })}
                      style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 10px', fontSize: '12.5px', color: formCust.sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: formCust.sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', padding: '10px 22px', borderRadius: '10px', fontSize: '13.5px', fontWeight: '700', color: '#475569', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{ backgroundColor: isSaving ? '#94A3B8' : '#0E7490', border: 'none', color: '#FFFFFF', padding: '10px 26px', borderRadius: '10px', fontSize: '13.5px', fontWeight: '800', cursor: isSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(14, 116, 144, 0.3)' }}
            >
              <Save size={16} />
              {isSaving ? 'Saving...' : 'Save & Select Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
