import React from "react";
import { Check, FileText, ChevronLeft, Save, Truck, Users } from "lucide-react";

export default function CustomerFormView({
  showCustomerForm,
  setShowCustomerForm,
  editingCustomer,
  setEditingCustomer,
  custFormName,
  setCustFormName,
  custFormCompany,
  setCustFormCompany,
  custFormGstNo,
  setCustFormGstNo,
  custFormMobile,
  setCustFormMobile,
  custFormAltPhone = '',
  setCustFormAltPhone,
  custFormEmail,
  setCustFormEmail,
  custFormBillingAddress1 = '',
  setCustFormBillingAddress1,
  custFormBillingAddress2 = '',
  setCustFormBillingAddress2,
  custFormBillingAddress,
  setCustFormBillingAddress,
  custFormBillingCity,
  setCustFormBillingCity,
  custFormBillingState,
  setCustFormBillingState,
  custFormBillingPincode,
  setCustFormBillingPincode,
  custFormDeliveryAddress1 = '',
  setCustFormDeliveryAddress1,
  custFormDeliveryAddress2 = '',
  setCustFormDeliveryAddress2,
  custFormDeliveryAddress,
  setCustFormDeliveryAddress,
  custFormDeliveryCity,
  setCustFormDeliveryCity,
  custFormDeliveryState,
  setCustFormDeliveryState,
  custFormDeliveryPincode,
  setCustFormDeliveryPincode,
  custFormSameAsBilling,
  setCustFormSameAsBilling,
  customerList,
  setCustomerList,
  setNewBomCustomer,
  setNewBomProductName,
  setNewBomDeliveryAddress,
  setSameAsBilling
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: "'DM Sans', sans-serif" }}>

      {/* TOP HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '16px 24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
            {editingCustomer ? `Edit Customer: ${editingCustomer.originalCode}` : 'Create New Customer'}
          </h2>
          <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', display: 'block' }}>
            {editingCustomer ? 'Update existing customer details' : 'Register a new customer profile in Customer Management'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              setShowCustomerForm(false);
              setEditingCustomer(null);
              setCustFormName('');
              setCustFormCompany('');
              setCustFormGstNo('');
              setCustFormMobile('');
              setCustFormEmail('');
            }}
            style={{ border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', height: '40px', padding: '0 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const name = custFormName.trim();
              if (!name) {
                alert('Please enter Customer / Display Name');
                return;
              }
              const company = custFormCompany.trim() || name;
              const gstNo = custFormGstNo.trim() || '33AABCU9603R1ZM';
              const mobile = custFormMobile.trim() || '+91 98000 00000';
              const email = custFormEmail.trim() || 'contact@client.com';

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

              const b1 = (custFormBillingAddress1 || '').trim();
              const b2 = (custFormBillingAddress2 || '').trim();
              const billingStreet = [b1, b2].filter(Boolean).join(', ') || custFormBillingAddress.trim();

              const d1 = (custFormDeliveryAddress1 || '').trim();
              const d2 = (custFormDeliveryAddress2 || '').trim();
              const deliveryStreet = custFormSameAsBilling
                ? billingStreet
                : ([d1, d2].filter(Boolean).join(', ') || custFormDeliveryAddress.trim());

              const billingStr = formatAddr(billingStreet, custFormBillingCity, custFormBillingState, custFormBillingPincode);
              const deliveryStr = custFormSameAsBilling
                ? billingStr
                : formatAddr(deliveryStreet, custFormDeliveryCity, custFormDeliveryState, custFormDeliveryPincode);

              const billingObj = {
                address1: b1,
                address2: b2,
                address: billingStreet,
                city: custFormBillingCity.trim(),
                state: custFormBillingState.trim(),
                pincode: custFormBillingPincode.trim()
              };

              const deliveryObj = custFormSameAsBilling ? { ...billingObj } : {
                address1: d1,
                address2: d2,
                address: deliveryStreet,
                city: custFormDeliveryCity.trim(),
                state: custFormDeliveryState.trim(),
                pincode: custFormDeliveryPincode.trim()
              };

              if (editingCustomer) {
                setCustomerList(prev => prev.map(c => c.code === editingCustomer.originalCode ? {
                  ...c,
                  code: name,
                  c2: company,
                  gstNo: gstNo,
                  c4: mobile,
                  altPhone: custFormAltPhone,
                  altNumber: custFormAltPhone,
                  c5: email,
                  address1: b1,
                  address2: b2,
                  billingAddress1: b1,
                  billingAddress2: b2,
                  dispatchAddress1: custFormSameAsBilling ? b1 : d1,
                  dispatchAddress2: custFormSameAsBilling ? b2 : d2,
                  shippingAddress1: custFormSameAsBilling ? b1 : d1,
                  shippingAddress2: custFormSameAsBilling ? b2 : d2,
                  address: billingStreet,
                  dispatchAddress: deliveryStreet,
                  c6: billingStr,
                  billingAddress: billingStr,
                  billingAddressObj: billingObj,
                  c7: deliveryStr,
                  deliveryAddress: deliveryStr,
                  deliveryAddressObj: deliveryObj
                } : c));
                setEditingCustomer(null);
              } else {
                const newCustObj = {
                  code: name,
                  c2: company,
                  gstNo: gstNo,
                  c3: 'Primary Contact',
                  c4: mobile,
                  altPhone: custFormAltPhone,
                  altNumber: custFormAltPhone,
                  c5: email,
                  address1: b1,
                  address2: b2,
                  billingAddress1: b1,
                  billingAddress2: b2,
                  dispatchAddress1: custFormSameAsBilling ? b1 : d1,
                  dispatchAddress2: custFormSameAsBilling ? b2 : d2,
                  shippingAddress1: custFormSameAsBilling ? b1 : d1,
                  shippingAddress2: custFormSameAsBilling ? b2 : d2,
                  address: billingStreet,
                  dispatchAddress: deliveryStreet,
                  c6: billingStr,
                  billingAddress: billingStr,
                  billingAddressObj: billingObj,
                  c7: deliveryStr,
                  deliveryAddress: deliveryStr,
                  deliveryAddressObj: deliveryObj,
                  status: 'ACTIVE',
                  stBg: '#dcfce7',
                  stFg: '#166534',
                  stBorder: '1px solid #bbf7d0',
                  tabGroup: 'Active'
                };
                setCustomerList(prev => [newCustObj, ...prev]);
                setNewBomProductName(name);
                if (deliveryStr) {
                  setNewBomDeliveryAddress(deliveryStr);
                } else if (billingStr) {
                  setNewBomDeliveryAddress(billingStr);
                  setSameAsBilling(true);
                }

                // Synchronize to BUSINZ Native Catalog in the background
                try {
                  fetch('/api/customers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      companyName: company,
                      customerCode: name,
                      gstNumber: gstNo,
                      address1: b1,
                      address2: b2,
                      billingAddress1: b1,
                      billingAddress2: b2,
                      dispatchAddress1: custFormSameAsBilling ? b1 : d1,
                      dispatchAddress2: custFormSameAsBilling ? b2 : d2,
                      shippingAddress1: custFormSameAsBilling ? b1 : d1,
                      shippingAddress2: custFormSameAsBilling ? b2 : d2,
                      address: billingStreet,
                      dispatchAddress: deliveryStreet,
                      billingAddress: billingStr,
                      deliveryAddress: deliveryStr,
                      billingAddressObj: billingObj,
                      deliveryAddressObj: deliveryObj,
                      city: custFormBillingCity,
                      state: custFormBillingState,
                      pincode: custFormBillingPincode,
                      altPhone: custFormAltPhone,
                      altNumber: custFormAltPhone,
                      primaryContact: {
                        name: name,
                        phone: mobile,
                        altPhone: custFormAltPhone,
                        email: email
                      }
                    })
                  }).catch(() => {});
                } catch (e) {}
              }

              // Reset form fields
              setCustFormName('');
              setCustFormCompany('');
              setCustFormGstNo('');
              setCustFormMobile('');
              if (setCustFormAltPhone) setCustFormAltPhone('');
              setCustFormEmail('');
              if (setCustFormBillingAddress1) setCustFormBillingAddress1('');
              if (setCustFormBillingAddress2) setCustFormBillingAddress2('');
              setCustFormBillingAddress('');
              setCustFormBillingCity('');
              setCustFormBillingState('');
              setCustFormBillingPincode('');
              setCustFormSameAsBilling(false);
              if (setCustFormDeliveryAddress1) setCustFormDeliveryAddress1('');
              if (setCustFormDeliveryAddress2) setCustFormDeliveryAddress2('');
              setCustFormDeliveryAddress('');
              setCustFormDeliveryCity('');
              setCustFormDeliveryState('');
              setCustFormDeliveryPincode('');
              setShowCustomerForm(false);
            }}
            style={{ border: 'none', backgroundColor: '#2563EB', color: 'white', height: '40px', padding: '0 24px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
          >
            <Check style={{ width: '16px', height: '16px' }} />
            {editingCustomer ? 'Update Customer' : 'Save Customer'}
          </button>
        </div>
      </div>

      {/* FORM CONTAINER */}
      <div style={{ backgroundColor: 'white', padding: '28px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* SECTION TITLE */}
        <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: '#EEF2FF', border: '1px solid #E0E7FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
            <Users style={{ width: '18px', height: '18px' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>Customer Information</h3>
            <span style={{ fontSize: '12px', color: '#64748B' }}>Fill in customer details to register profile</span>
          </div>
        </div>

        {/* ROW 1: DISPLAY NAME & COMPANY NAME */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
              Customer / Display Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Vikram Solar Pvt Ltd"
              value={custFormName}
              onChange={(e) => setCustFormName(e.target.value)}
              style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>Company Name</label>
            <input
              type="text"
              placeholder="e.g. Vikram Solar Solutions Infrastructure Ltd"
              value={custFormCompany}
              onChange={(e) => setCustFormCompany(e.target.value)}
              style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>

        {/* ROW 2: GST NUMBER, MOBILE, ALT NUMBER & EMAIL */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>GST Number (GSTIN)</label>
            <input
              type="text"
              placeholder="e.g. 33AABCU9603R1ZM"
              value={custFormGstNo}
              onChange={(e) => setCustFormGstNo(e.target.value.toUpperCase())}
              style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none', fontWeight: '700', letterSpacing: '0.5px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>Mobile / Phone Number</label>
            <input
              type="text"
              placeholder="+91 98765 43210"
              value={custFormMobile}
              onChange={(e) => setCustFormMobile(e.target.value)}
              style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>Alt Number / Phone</label>
            <input
              type="text"
              placeholder="+91 98765 43211 / Landline"
              value={custFormAltPhone}
              onChange={(e) => setCustFormAltPhone && setCustFormAltPhone(e.target.value)}
              style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>Email Address</label>
            <input
              type="email"
              placeholder="contact@company.com"
              value={custFormEmail}
              onChange={(e) => setCustFormEmail(e.target.value)}
              style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>

        {/* ROW 3: BILLING & DELIVERY STRUCTURED ADDRESSES */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

          {/* BILLING ADDRESS SECTION */}
          <div style={{
            backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px',
            padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                <FileText style={{ width: '15px', height: '15px' }} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Billing Address</h4>
                <span style={{ fontSize: '11px', color: '#64748B' }}>Primary address for invoices & tax records</span>
              </div>
            </div>

            {/* Street Address Line 1 */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Billing Address 1 <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>(Building / Door / Flat / Street)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. No 1427, GNT Road, Nagappa Industrial Estate"
                value={custFormBillingAddress1}
                onChange={(e) => {
                  const val = e.target.value;
                  if (setCustFormBillingAddress1) setCustFormBillingAddress1(val);
                  setCustFormBillingAddress([val, custFormBillingAddress2].filter(Boolean).join(', '));
                  if (custFormSameAsBilling) {
                    if (setCustFormDeliveryAddress1) setCustFormDeliveryAddress1(val);
                    setCustFormDeliveryAddress([val, custFormBillingAddress2].filter(Boolean).join(', '));
                  }
                }}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none', backgroundColor: '#FFFFFF' }}
              />
            </div>

            {/* Street Address Line 2 */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Billing Address 2 <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>(Area / Landmark / Road)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Near Puzhal Toll Plaza, Redhills Road"
                value={custFormBillingAddress2}
                onChange={(e) => {
                  const val = e.target.value;
                  if (setCustFormBillingAddress2) setCustFormBillingAddress2(val);
                  setCustFormBillingAddress([custFormBillingAddress1, val].filter(Boolean).join(', '));
                  if (custFormSameAsBilling) {
                    if (setCustFormDeliveryAddress2) setCustFormDeliveryAddress2(val);
                    setCustFormDeliveryAddress([custFormBillingAddress1, val].filter(Boolean).join(', '));
                  }
                }}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none', backgroundColor: '#FFFFFF' }}
              />
            </div>

            {/* City, State, Pincode */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chennai"
                  value={custFormBillingCity}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustFormBillingCity(val);
                    if (custFormSameAsBilling) setCustFormDeliveryCity(val);
                  }}
                  style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none', backgroundColor: '#FFFFFF' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  State
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tamil Nadu"
                  value={custFormBillingState}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustFormBillingState(val);
                    if (custFormSameAsBilling) setCustFormDeliveryState(val);
                  }}
                  style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none', backgroundColor: '#FFFFFF' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Pincode
                </label>
                <input
                  type="text"
                  placeholder="e.g. 600028"
                  value={custFormBillingPincode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustFormBillingPincode(val);
                    if (custFormSameAsBilling) setCustFormDeliveryPincode(val);
                  }}
                  style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', boxSizing: 'border-box', outline: 'none', backgroundColor: '#FFFFFF' }}
                />
              </div>
            </div>
          </div>

          {/* DELIVERY / SHIPPING ADDRESS SECTION */}
          <div style={{
            backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px',
            padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
                  <Truck style={{ width: '15px', height: '15px' }} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Delivery Address</h4>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>Destination for material dispatch</span>
                </div>
              </div>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#4F46E5', cursor: 'pointer', backgroundColor: '#EEF2FF', padding: '4px 10px', borderRadius: '8px', border: '1px solid #C7D2FE' }}>
                <input
                  type="checkbox"
                  checked={custFormSameAsBilling}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setCustFormSameAsBilling(checked);
                    if (checked) {
                      if (setCustFormDeliveryAddress1) setCustFormDeliveryAddress1(custFormBillingAddress1);
                      if (setCustFormDeliveryAddress2) setCustFormDeliveryAddress2(custFormBillingAddress2);
                      setCustFormDeliveryAddress(custFormBillingAddress);
                      setCustFormDeliveryCity(custFormBillingCity);
                      setCustFormDeliveryState(custFormBillingState);
                      setCustFormDeliveryPincode(custFormBillingPincode);
                    }
                  }}
                  style={{ accentColor: '#4F46E5', cursor: 'pointer' }}
                />
                Same as Billing
              </label>
            </div>

            {/* Street Address Line 1 */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Shipping Address 1 <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>(Warehouse / Site / Street)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Plot No 42, SIDCO Industrial Estate"
                value={custFormSameAsBilling ? custFormBillingAddress1 : custFormDeliveryAddress1}
                disabled={custFormSameAsBilling}
                onChange={(e) => {
                  const val = e.target.value;
                  if (setCustFormDeliveryAddress1) setCustFormDeliveryAddress1(val);
                  setCustFormDeliveryAddress([val, custFormDeliveryAddress2].filter(Boolean).join(', '));
                }}
                style={{
                  width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px',
                  color: custFormSameAsBilling ? '#64748B' : '#0F172A',
                  backgroundColor: custFormSameAsBilling ? '#F1F5F9' : '#FFFFFF',
                  boxSizing: 'border-box', outline: 'none',
                  cursor: custFormSameAsBilling ? 'not-allowed' : 'text'
                }}
              />
            </div>

            {/* Street Address Line 2 */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Shipping Address 2 <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>(Industrial Estate / Landmark / Road)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Near Ambattur Railway Station"
                value={custFormSameAsBilling ? custFormBillingAddress2 : custFormDeliveryAddress2}
                disabled={custFormSameAsBilling}
                onChange={(e) => {
                  const val = e.target.value;
                  if (setCustFormDeliveryAddress2) setCustFormDeliveryAddress2(val);
                  setCustFormDeliveryAddress([custFormDeliveryAddress1, val].filter(Boolean).join(', '));
                }}
                style={{
                  width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px',
                  color: custFormSameAsBilling ? '#64748B' : '#0F172A',
                  backgroundColor: custFormSameAsBilling ? '#F1F5F9' : '#FFFFFF',
                  boxSizing: 'border-box', outline: 'none',
                  cursor: custFormSameAsBilling ? 'not-allowed' : 'text'
                }}
              />
            </div>

            {/* City, State, Pincode */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  City
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chennai"
                  value={custFormSameAsBilling ? custFormBillingCity : custFormDeliveryCity}
                  disabled={custFormSameAsBilling}
                  onChange={(e) => setCustFormDeliveryCity(e.target.value)}
                  style={{
                    width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px',
                    color: custFormSameAsBilling ? '#64748B' : '#0F172A',
                    backgroundColor: custFormSameAsBilling ? '#F1F5F9' : '#FFFFFF',
                    boxSizing: 'border-box', outline: 'none',
                    cursor: custFormSameAsBilling ? 'not-allowed' : 'text'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  State
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tamil Nadu"
                  value={custFormSameAsBilling ? custFormBillingState : custFormDeliveryState}
                  disabled={custFormSameAsBilling}
                  onChange={(e) => setCustFormDeliveryState(e.target.value)}
                  style={{
                    width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px',
                    color: custFormSameAsBilling ? '#64748B' : '#0F172A',
                    backgroundColor: custFormSameAsBilling ? '#F1F5F9' : '#FFFFFF',
                    boxSizing: 'border-box', outline: 'none',
                    cursor: custFormSameAsBilling ? 'not-allowed' : 'text'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Pincode
                </label>
                <input
                  type="text"
                  placeholder="e.g. 600058"
                  value={custFormSameAsBilling ? custFormBillingPincode : custFormDeliveryPincode}
                  disabled={custFormSameAsBilling}
                  onChange={(e) => setCustFormDeliveryPincode(e.target.value)}
                  style={{
                    width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px',
                    color: custFormSameAsBilling ? '#64748B' : '#0F172A',
                    backgroundColor: custFormSameAsBilling ? '#F1F5F9' : '#FFFFFF',
                    boxSizing: 'border-box', outline: 'none',
                    cursor: custFormSameAsBilling ? 'not-allowed' : 'text'
                  }}
                />
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
