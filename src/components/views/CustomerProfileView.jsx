import React from "react";
import { Users, Phone, Edit3, ChevronLeft, Truck, FileText } from "lucide-react";

export default function CustomerProfileView({
  viewingCustomer,
  setViewingCustomer,
  setEditingCustomer,
  setShowCustomerForm,
  setCustFormName,
  setCustFormCompany,
  setCustFormGstNo,
  setCustFormMobile,
  setCustFormEmail,
  setCustFormBillingAddress,
  setCustFormBillingCity,
  setCustFormBillingState,
  setCustFormBillingPincode,
  setCustFormDeliveryAddress,
  setCustFormDeliveryCity,
  setCustFormDeliveryState,
  setCustFormDeliveryPincode,
  setCustFormSameAsBilling
}) {
  const c = viewingCustomer;
  const bObj = c.billingAddressObj || {};
  const dObj = c.deliveryAddressObj || {};
  const b1 = c.address1 || c.billingAddress1 || bObj.address1 || '';
  const b2 = c.address2 || c.billingAddress2 || bObj.address2 || '';
  const bStreet = [b1, b2].filter(Boolean).join(', ') || bObj.address || c.c6 || c.billingAddress || '—';
  const bCity = bObj.city || c.city || '—';
  const bState = bObj.state || c.state || '—';
  const bPin = bObj.pincode || c.pincode || '—';

  const d1 = c.dispatchAddress1 || c.shippingAddress1 || dObj.address1 || '';
  const d2 = c.dispatchAddress2 || c.shippingAddress2 || dObj.address2 || '';
  const dStreet = [d1, d2].filter(Boolean).join(', ') || dObj.address || c.c7 || c.deliveryAddress || '—';
  const dCity = dObj.city || c.dispatchCity || bCity;
  const dState = dObj.state || c.dispatchState || bState;
  const dPin = dObj.pincode || c.dispatchPincode || bPin;

  const isSame = (c.deliveryAddress === c.billingAddress && Boolean(c.billingAddress)) || (!c.c7 && !c.deliveryAddress) || (bStreet === dStreet && bStreet !== '—');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
      {/* TOP BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '18px 24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => setViewingCustomer(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '700', color: '#475569', cursor: 'pointer' }}
          >
            <ChevronLeft style={{ width: '16px', height: '16px' }} /> Back to Customers
          </button>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              Customer Profile: {c.code}
            </h2>
            <span style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', display: 'block' }}>
              Company: <strong style={{ color: '#2563EB' }}>{c.c2 || c.code}</strong> • Status: <strong style={{ color: '#166534' }}>ACTIVE</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => {
              const cust = viewingCustomer;
              setEditingCustomer({ ...cust, originalCode: cust.code });
              setCustFormName(cust.code);
              setCustFormCompany(cust.c2 || cust.code);
              setCustFormGstNo(cust.gstNo || '33AABCU9603R1ZM');
              setCustFormMobile(cust.c4 || '');
              setCustFormEmail(cust.c5 || '');

              setCustFormBillingAddress(bObj.address || cust.c6 || cust.billingAddress || '');
              setCustFormBillingCity(bObj.city || '');
              setCustFormBillingState(bObj.state || '');
              setCustFormBillingPincode(bObj.pincode || '');

              setCustFormSameAsBilling(isSame);
              setCustFormDeliveryAddress(dObj.address || cust.c7 || cust.deliveryAddress || '');
              setCustFormDeliveryCity(dObj.city || '');
              setCustFormDeliveryState(dObj.state || '');
              setCustFormDeliveryPincode(dObj.pincode || '');
              setViewingCustomer(null);
            }}
            style={{ border: 'none', backgroundColor: '#2563EB', color: 'white', height: '40px', padding: '0 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}
          >
            <Edit3 style={{ width: '15px', height: '15px' }} /> Edit Customer
          </button>
        </div>
      </div>

      {/* OVERVIEW SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
        <div style={{ backgroundColor: 'white', padding: '18px 20px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Customer Name</span>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', marginTop: '6px' }}>{c.code}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '18px 20px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Company Name</span>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#2563EB', marginTop: '6px' }}>{c.c2 || c.code}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '18px 20px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>GSTIN / Tax No.</span>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#059669', marginTop: '6px', letterSpacing: '0.5px' }}>{c.gstNo || '33AABCU9603R1ZM'}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '18px 20px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Mobile / Phone</span>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginTop: '6px' }}>{c.c4 || '—'}</div>
        </div>
        <div style={{ backgroundColor: 'white', padding: '18px 20px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Email Address</span>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginTop: '6px' }}>{c.c5 || '—'}</div>
        </div>
      </div>

      {/* STRUCTURED ADDRESS CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Billing Address Card */}
        <div style={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
              <FileText style={{ width: '16px', height: '16px' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Registered Billing Address</h3>
              <span style={{ fontSize: '11px', color: '#64748B' }}>Primary address used for tax invoices and billing</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block' }}>STREET ADDRESS</span>
              <strong style={{ color: '#0F172A', fontSize: '14px' }}>{bStreet}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '4px', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block' }}>CITY</span>
                <strong style={{ color: '#0F172A' }}>{bCity}</strong>
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block' }}>STATE</span>
                <strong style={{ color: '#0F172A' }}>{bState}</strong>
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block' }}>PINCODE</span>
                <strong style={{ color: '#0F172A' }}>{bPin}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Address Card */}
        <div style={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5' }}>
                <Truck style={{ width: '16px', height: '16px' }} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Physical Delivery Address</h3>
                <span style={{ fontSize: '11px', color: '#64748B' }}>Primary location for material delivery & shipping</span>
              </div>
            </div>
            {isSame && (
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', backgroundColor: '#DCFCE7', padding: '3px 8px', borderRadius: '12px' }}>
                Same as Billing
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block' }}>STREET ADDRESS</span>
              <strong style={{ color: '#0F172A', fontSize: '14px' }}>{dStreet}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '4px', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block' }}>CITY</span>
                <strong style={{ color: '#0F172A' }}>{dCity}</strong>
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block' }}>STATE</span>
                <strong style={{ color: '#0F172A' }}>{dState}</strong>
              </div>
              <div>
                <span style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', display: 'block' }}>PINCODE</span>
                <strong style={{ color: '#0F172A' }}>{dPin}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
