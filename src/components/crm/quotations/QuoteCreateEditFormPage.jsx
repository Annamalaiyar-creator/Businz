import React from "react";
import {
  FileText, Plus, Search, Eye, Share2, MessageSquare, Download, Check,
  Building2, Printer, X, DollarSign, Calendar, Tag, ChevronRight,
  RotateCcw, Edit3, Trash2, CheckCircle, Clock, AlertCircle, Layers,
  Truck, ArrowLeft, ArrowRight, Copy, RefreshCw, Send, Mail, Boxes, User, Landmark,
  AlertTriangle, ShoppingCart, ShieldCheck, Smartphone, QrCode, Zap,
  ChevronDown, ChevronUp, GripVertical
} from "lucide-react";
import HdgStructureConfiguratorModal from "../HdgStructureConfiguratorModal";
import SearchablePresetSelector from "../../SearchablePresetSelector";
import TypeableProductSelect from "../../TypeableProductSelect";
import { QUOTATION_TERMS_PRESETS } from "./crmQuotationConstants";
import { extractGstRate } from "../../../utils/gstHelper";
import { getHsnCode, is5PctSolarProduct } from "../../../utils/hsnCodeService";
import { SALES_UOM_OPTIONS, isSalesLoginRole, normalizeSalesUomValue, calculateTotalDispatchQty } from "../../../utils/vrmProductsData";

export default function QuoteCreateEditFormPage(props) {
  const {
    showBOMQuoteForm,
    setShowBOMQuoteForm,
    editingQuoteId,
    quoteCode,
    quoteDate,
    revisionCount,
    customerName,
    handleSelectCustomer,
    customerList = [],
    contactPerson,
    setContactPerson,
    phone,
    setPhone,
    gstNumber,
    setGstNumber,
    capacityKw,
    setCapacityKw,
    billingStreet,
    setBillingStreet,
    billingCity,
    setBillingCity,
    billingState,
    setBillingState,
    billingPincode,
    setBillingPincode,
    sameAsBilling,
    setSameAsBilling,
    deliveryStreet,
    setDeliveryStreet,
    deliveryCity,
    setDeliveryCity,
    deliveryState,
    setDeliveryState,
    deliveryPincode,
    setDeliveryPincode,
    transportMode,
    setTransportMode,
    transportScope,
    setTransportScope,
    transporterName,
    setTransporterName,
    vehicleNo,
    setVehicleNo,
    validUntilDate,
    setValidUntilDate,
    selectedPreset,
    setSelectedPreset,
    handleAddPresetToOrder,
    activePresetsMap = {},
    presetGroups = {},
    setPresetGroups,
    quoteItems = [],
    setQuoteItems,
    selectedItemIndexes = [],
    setSelectedItemIndexes,
    draggedItemIndex,
    setDraggedItemIndex,
    dragOverItemIndex,
    setDragOverItemIndex,
    handleReorderQuoteItem,
    handleMoveQuoteItemStep,
    handleMovePresetGroupBlock,
    handleRemovePresetGroup,
    handleAddMaterialRow,
    handleRemoveMaterialRow,
    itemsList = [],
    totals = {},
    selectedTermsPreset,
    setSelectedTermsPreset,
    terms,
    setTerms,
    copiedBankField,
    handleCopyBankDetail,
    quoteConfirmModal,
    setQuoteConfirmModal,
    validationAlert,
    setValidationAlert,
    validateQuotationForm,
    handleSaveQuotationRecord,
    showHdgConfiguratorModal,
    setShowHdgConfiguratorModal,
    handleApplyHdgStructure,
    showClearConfirmModal,
    setShowClearConfirmModal,
    salesPerson,
    userRole,
    getActiveUserName
  } = props;

  const hasAnyPreset = (quoteItems || []).some(it => it.isPresetItem);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>
        
        {/* Top Banner Matching BOM Page */}
        <div style={{
          background: 'linear-gradient(135deg, #075985 0%, #0E7490 50%, #0891B2 100%)',
          borderRadius: '18px',
          padding: '24px 28px',
          color: '#FFFFFF',
          boxShadow: '0 10px 25px -5px rgba(14, 116, 144, 0.4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText style={{ width: '24px', height: '24px', color: '#FFFFFF' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
                  {editingQuoteId ? 'Revise Commercial Quotation' : 'Create Solar Structure Quotation'}
                </h1>
                {revisionCount > 0 && (
                  <span style={{ backgroundColor: '#F59E0B', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '800' }}>
                    Rev #{revisionCount}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '13px', color: '#CFFAFE', margin: '4px 0 0 0' }}>
                Configure client scope, compile structure kit presets, customize line items freely, and generate official commercial proposal
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button
              onClick={() => setQuoteConfirmModal('cancel')}
              style={{ border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', color: '#FFFFFF', cursor: 'pointer', backdropFilter: 'blur(4px)', whiteSpace: 'nowrap' }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!customerName || !customerName.trim()) {
                  alert('⚠️ Please specify or select a Customer Name before proceeding.');
                  return;
                }
                if (!quoteItems || quoteItems.length === 0) {
                  alert('⚠️ Please add at least one Product / Item to the quotation materials list.');
                  return;
                }
                setQuoteConfirmModal('create');
              }}
              style={{ border: 'none', background: '#10B981', color: 'white', padding: '10px 22px', borderRadius: '10px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
            >
              <CheckCircle style={{ width: '16px', height: '16px' }} />
              <span>{editingQuoteId ? 'Save & Send Revision →' : 'Create Quotation →'}</span>
            </button>
          </div>
        </div>

        {/* SECTION 1: QUOTATION & ORDER INFORMATION */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              1
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              QUOTATION INFORMATION
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div>
              <label htmlFor="crm-quotations-quote-date" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '6px' }}>
                Quote Date
              </label>
              <input id="crm-quotations-quote-date" name="quoteDate" aria-label="Quote Date"
                type="date"
                value={quoteDate}
                readOnly
                disabled
                title="Quote date is automatically recorded and cannot be modified"
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  padding: '0 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#64748B',
                  backgroundColor: '#F1F5F9',
                  cursor: 'not-allowed',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
               />
            </div>
            <div>
              <label htmlFor="quote-field-validUntil" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Valid Until <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input name="validUntil" aria-label="Valid Until"
                id="quote-field-validUntil"
                type="date"
                value={validUntilDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  const val = e.target.value;
                  const todayStr = new Date().toISOString().split('T')[0];
                  if (val && val < todayStr) {
                    setValidUntilDate(todayStr);
                  } else {
                    setValidUntilDate(val);
                  }
                }}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="crm-quotations-quote-reference-no" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Quote Reference No.</label>
              <input id="crm-quotations-quote-reference-no" name="quoteReferenceNo" aria-label="Quote Reference No."
                type="text"
                value={quoteCode}
                readOnly
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0E7490', backgroundColor: '#F0FDFA', fontWeight: '800', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="crm-quotations-sales-representative" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748B', marginBottom: '6px' }}>
                Sales Representative <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input id="crm-quotations-sales-representative" name="salesRepresentative" aria-label="Sales Representative"
                type="text"
                readOnly
                disabled
                value={salesPerson || getActiveUserName()}
                title="Sales representative is tied to the logged-in account and cannot be modified"
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', fontWeight: '700', color: '#475569', backgroundColor: '#F1F5F9', cursor: 'not-allowed', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
          </div>
        </div>

        {/* SECTION 2: CUSTOMER INFORMATION & ADDRESSES */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              2
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              CUSTOMER INFORMATION & SITE DESTINATION
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="quote-field-customerName" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Customer Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input name="customerName" aria-label="Customer Name"
                id="quote-field-customerName"
                type="text"
                list="quotation-customer-suggestions"
                placeholder="Type or select customer from CRM directory..."
                value={customerName}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #CBD5E1', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none', fontWeight: '600' }}
               />
              <datalist id="quotation-customer-suggestions">
                {customerList.map((c, idx) => {
                  const val = c.code || c.companyName || c.customerName;
                  const label = c.c2 || c.companyName;
                  return (
                    <option key={idx} value={val}>
                      {label && label !== val ? `${val} (${label})` : val}
                    </option>
                  );
                })}
              </datalist>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div>
              <label htmlFor="crm-quotations-contact-person" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Contact Person</label>
              <input id="crm-quotations-contact-person" name="contactPerson" aria-label="Contact Person"
                type="text"
                placeholder="e.g. Rajesh Kumar"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="quote-field-phone" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Phone / WhatsApp</label>
              <input name="phoneWhatsApp" aria-label="Phone / WhatsApp"
                id="quote-field-phone"
                type="text"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="crm-quotations-customer-gst-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Customer GST Number</label>
              <input id="crm-quotations-customer-gst-number" name="customerGSTNumber" aria-label="Customer GST Number"
                type="text"
                placeholder="33AAAAA0000A1Z5"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', textTransform: 'uppercase', fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="crm-quotations-plant-capacity-k-w" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Plant Capacity (kW)</label>
              <input id="crm-quotations-plant-capacity-k-w" name="plantCapacityKW" aria-label="Plant Capacity (kW)"
                type="number"
                placeholder="100"
                value={capacityKw}
                onChange={(e) => setCapacityKw(e.target.value)}
                style={{ width: '100%', height: '40px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
          </div>

          {/* Dual Address Cards: Billing Address and Site Delivery Address */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '4px' }}>
            {/* Card 1: Billing Address */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 style={{ width: '16px', height: '16px', color: '#0E7490' }} />
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Billing Address</h4>
              </div>

              <div>
                <label htmlFor="quote-field-billingStreet" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Address</label>
                <input name="address" aria-label="Address"
                  id="quote-field-billingStreet"
                  type="text"
                  placeholder="e.g. Plot No 42, SIDCO Industrial Estate, Ambattur"
                  value={billingStreet}
                  onChange={(e) => {
                    setBillingStreet(e.target.value);
                    if (sameAsBilling) setDeliveryStreet(e.target.value);
                  }}
                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none', backgroundColor: '#FFFFFF' }}
                 />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label htmlFor="quote-field-billingCity" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                  <input name="city" aria-label="City"
                    id="quote-field-billingCity"
                    type="text"
                    placeholder="e.g. Chennai"
                    value={billingCity}
                    onChange={(e) => {
                      setBillingCity(e.target.value);
                      if (sameAsBilling) setDeliveryCity(e.target.value);
                    }}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none', backgroundColor: '#FFFFFF' }}
                   />
                </div>
                <div>
                  <label htmlFor="quote-field-billingState" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                  <input name="state" aria-label="State"
                    id="quote-field-billingState"
                    type="text"
                    placeholder="e.g. Tamil Nadu"
                    value={billingState}
                    onChange={(e) => {
                      setBillingState(e.target.value);
                      if (sameAsBilling) setDeliveryState(e.target.value);
                    }}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none', backgroundColor: '#FFFFFF' }}
                   />
                </div>
                <div>
                  <label htmlFor="quote-field-billingPincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                  <input name="pincode" aria-label="Pincode"
                    id="quote-field-billingPincode"
                    type="text"
                    placeholder="e.g. 600058"
                    value={billingPincode}
                    onChange={(e) => {
                      setBillingPincode(e.target.value);
                      if (sameAsBilling) setDeliveryPincode(e.target.value);
                    }}
                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', boxSizing: 'border-box', outline: 'none', backgroundColor: '#FFFFFF' }}
                   />
                </div>
              </div>
            </div>

            {/* Card 2: Site Delivery Address (with Same-as-Billing toggle) */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', backgroundColor: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck style={{ width: '16px', height: '16px', color: '#0E7490' }} />
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Site Delivery Address</h4>
                </div>
                <label htmlFor="crm-quotations-same-as-billing" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#0E7490', cursor: 'pointer' }}>
                  <input id="crm-quotations-same-as-billing" name="sameAsBilling" aria-label="SameAsBilling"
                    type="checkbox"
                    checked={sameAsBilling}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSameAsBilling(checked);
                      if (checked) {
                        setDeliveryStreet(billingStreet);
                        setDeliveryCity(billingCity);
                        setDeliveryState(billingState);
                        setDeliveryPincode(billingPincode);
                      }
                    }}
                    style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                   />
                  Same as Billing
                </label>
              </div>

              <div>
                <label htmlFor="quote-field-deliveryStreet" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Address</label>
                <input name="address" aria-label="Address"
                  id="quote-field-deliveryStreet"
                  type="text"
                  placeholder="e.g. Solar Site Project Location, Plot 10"
                  value={sameAsBilling ? billingStreet : deliveryStreet}
                  disabled={sameAsBilling}
                  onChange={(e) => setDeliveryStreet(e.target.value)}
                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                 />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label htmlFor="quote-field-deliveryCity" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                  <input name="city" aria-label="City" id="quote-field-deliveryCity" type="text" placeholder="e.g. Chennai" value={sameAsBilling ? billingCity : deliveryCity} disabled={sameAsBilling} onChange={(e) => setDeliveryCity(e.target.value)} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: sameAsBilling ? 'not-allowed' : 'text' }}  />
                </div>
                <div>
                  <label htmlFor="quote-field-deliveryState" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                  <input name="state" aria-label="State" id="quote-field-deliveryState" type="text" placeholder="e.g. Tamil Nadu" value={sameAsBilling ? billingState : deliveryState} disabled={sameAsBilling} onChange={(e) => setDeliveryState(e.target.value)} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: sameAsBilling ? 'not-allowed' : 'text' }}  />
                </div>
                <div>
                  <label htmlFor="quote-field-deliveryPincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Pincode</label>
                  <input name="pincode" aria-label="Pincode" id="quote-field-deliveryPincode" type="text" placeholder="e.g. 600058" value={sameAsBilling ? billingPincode : deliveryPincode} disabled={sameAsBilling} onChange={(e) => setDeliveryPincode(e.target.value)} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: sameAsBilling ? '#64748B' : '#0F172A', backgroundColor: sameAsBilling ? '#F1F5F9' : '#FFFFFF', boxSizing: 'border-box', outline: 'none', cursor: sameAsBilling ? 'not-allowed' : 'text' }}  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: ORDER ITEMS & BILL OF MATERIALS (BOM PRESET COMPILER) */}
        <div id="quote-field-items" style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
          {/* Section 3 Header — Clean Single Row */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px', gap: '20px', flexWrap: 'wrap', borderBottom: '1px solid #F1F5F9' }}>
            {/* Left: Badge + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: 'auto' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>3</div>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>QUOTATION SCOPE & LINE ITEMS</span>
            </div>

            {/* Preset Pill */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: '#ECFEFF', padding: '0 16px', borderRadius: '20px', height: '40px', border: '1px solid #CFFAFE' }}>
              <Layers style={{ width: '15px', height: '15px', color: '#0E7490' }} />
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0E7490' }}>Preset:</span>
            </div>

            {/* Searchable Preset Selector */}
            <SearchablePresetSelector
              value={selectedPreset}
              activePresetsMap={activePresetsMap}
              accentColor="#0E7490"
              width="380px"
              placeholder="Pick a Preset to add..."
              style={{ height: '40px' }}
              onChange={(val, targetPreset) => {
                if (val && targetPreset && targetPreset.items) {
                  handleAddPresetToOrder(val, targetPreset, 1);
                } else if (!val) {
                  setSelectedPreset('');
                }
              }}
            />

            {/* HDG / SHS Structure Configurator Button */}
            <button
              type="button"
              onClick={() => setShowHdgConfiguratorModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                background: 'linear-gradient(135deg, #075985 0%, #0E7490 100%)',
                color: 'white',
                padding: '0 16px',
                borderRadius: '20px',
                height: '40px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '800',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(14, 116, 144, 0.35)',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Zap size={15} style={{ color: '#FDE047' }} />
              <span>HDG Configurator</span>
            </button>

            {/* Clear Button */}
            <button
              type="button"
              onClick={() => {
                if (selectedItemIndexes.length > 0) {
                  setQuoteItems(prev => prev.filter((_, idx) => !selectedItemIndexes.includes(idx)));
                  setSelectedItemIndexes([]);
                } else {
                  if (quoteItems.length > 0) setShowClearConfirmModal(true);
                }
              }}
              title={selectedItemIndexes.length > 0 ? `Remove ${selectedItemIndexes.length} selected item(s)` : 'Clear all quotation items'}
              style={{ border: 'none', backgroundColor: selectedItemIndexes.length > 0 ? '#EF4444' : '#FFE4E6', color: selectedItemIndexes.length > 0 ? 'white' : '#E11D48', width: '40px', height: '40px', borderRadius: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
            >
              <X style={{ width: '18px', height: '18px' }} />
            </button>
          </div>

          {/* Active Preset Badges / Pills */}
          {Object.values(presetGroups).length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '12px 24px 0 24px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>Active Presets in Quotation:</span>
              {Object.values(presetGroups).map(grp => (
                <span
                  key={grp.groupId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#ECFEFF',
                    color: '#0E7490',
                    border: '1px solid #A5F3FC',
                    borderRadius: '16px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: '700'
                  }}
                >
                  <Layers size={13} style={{ color: '#0E7490' }} />
                  {grp.presetName} ({grp.unit === 'kW' ? `Total Capacity: ${grp.setCount || 1} kW` : `Total Quantity: ${grp.setCount || 1} Set${(grp.setCount || 1) > 1 ? 's' : ''}`})
                  <button
                    type="button"
                    onClick={() => handleRemovePresetGroup(grp.groupId)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 0 0 2px', display: 'flex', alignItems: 'center', color: '#0891B2' }}
                    title={`Remove ${grp.presetName}`}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Clear confirm modal */}
          {showClearConfirmModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
              <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle style={{ width: '20px', height: '20px' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>Clear All Quotation Items?</h3>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>Are you sure you want to delete all items from this quotation scope?</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button onClick={() => setShowClearConfirmModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => { setQuoteItems([]); setSelectedPreset(''); setPresetGroups({}); setSelectedItemIndexes([]); setShowClearConfirmModal(false); }} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#DC2626', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Clear All Items</button>
                </div>
              </div>
            </div>
          )}

          {/* Clean Modern Items Table */}
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
              <table style={{ width: '100%', minWidth: quoteItems.some(it => it.isPresetItem) ? '1500px' : '1360px', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ color: '#475569', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '12px 4px', width: '38px', minWidth: '38px', textAlign: 'center', color: '#64748B' }} title="Drag handle to reorder / align products">
                      <GripVertical size={14} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                    </th>
                    <th style={{ padding: '12px 8px', width: '42px', minWidth: '42px', textAlign: 'center' }}>
                      <input id="crm-quotations-checkbox" name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
                        type="checkbox"
                        checked={quoteItems.length > 0 && selectedItemIndexes.length === quoteItems.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItemIndexes(quoteItems.map((_, idx) => idx));
                          } else {
                            setSelectedItemIndexes([]);
                          }
                        }}
                        style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                       />
                    </th>
                    <th style={{ padding: '12px 10px', fontWeight: '700', minWidth: '280px' }}>Product / Item <span style={{ color: '#EF4444' }}>*</span></th>
                    <th style={{ padding: '12px 8px', fontWeight: '700', width: '120px', minWidth: '120px', textAlign: 'center' }}>HSN / SAC</th>
                    <th style={{ padding: '12px 8px', fontWeight: '700', width: '95px', minWidth: '95px', textAlign: 'center' }}>UOM</th>
                    <th style={{ padding: '12px 8px', fontWeight: '700', width: '105px', minWidth: '105px', textAlign: 'center' }}>Qty / Set <span style={{ color: '#EF4444' }}>*</span></th>
                    <th style={{ padding: '12px 8px', fontWeight: '700', width: '125px', minWidth: '125px', textAlign: 'center', backgroundColor: '#ECFEFF', color: '#0E7490', borderTop: '2px solid #0E7490' }}>Total Dispatch Qty</th>
                    <th style={{ padding: '12px 10px', fontWeight: '700', width: '115px', minWidth: '115px' }}>Price (₹) <span style={{ color: '#EF4444' }}>*</span></th>
                    <th style={{ padding: '12px 8px', fontWeight: '700', width: '100px', minWidth: '100px', textAlign: 'center' }}>GST Rate</th>
                    {quoteItems.some(it => it.isPresetItem) && (
                      <th style={{ padding: '12px 10px', fontWeight: '700', width: '130px', minWidth: '130px', color: '#0E7490', backgroundColor: '#ECFEFF' }}>
                        Preset Amt (₹) <span style={{ color: '#EF4444' }}>*</span>
                      </th>
                    )}
                    <th style={{ padding: '12px 10px', fontWeight: '700', width: '115px', minWidth: '115px', textAlign: 'right' }}>Taxable (₹)</th>
                    <th style={{ padding: '12px 10px', fontWeight: '700', width: '120px', minWidth: '120px', textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ padding: '12px 6px', fontWeight: '700', width: '48px', minWidth: '48px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteItems.length === 0 ? (
                    <tr>
                      <td colSpan={quoteItems.some(it => it.isPresetItem) ? 13 : 12} style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                        No items added yet. Pick a preset above or click <strong>+ Add Product / Item</strong> below.
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const hasAnyPreset = quoteItems.some(it => it.isPresetItem);
                      return quoteItems.map((item, i) => {
                      const q = parseFloat(item.qty) || 0;
                      const r = parseFloat(item.rate) || 0;
                      const taxable = q * r;
                      const gstPct = extractGstRate(item.gstRate, 18);
                      const gstAmt = taxable * (gstPct / 100);
                      const rowTot = taxable + gstAmt;
                      const isChecked = selectedItemIndexes.includes(i);

                      const isPresetItem = Boolean(item.isPresetItem);
                      const groupId = item.presetGroupId || (isPresetItem ? 'legacy_default' : null);
                      const groupItems = isPresetItem ? quoteItems.filter(it => (it.presetGroupId || 'legacy_default') === groupId) : [];
                      const isFirstInGroup = isPresetItem && quoteItems.findIndex(it => (it.presetGroupId || 'legacy_default') === groupId) === i;
                      const groupCount = groupItems.length;
                      const currentGroup = (groupId && presetGroups[groupId]) || {
                        groupId: groupId || 'legacy_default',
                        presetName: item.presetName || selectedPreset || 'Preset Kit',
                        setCount: 1,
                        kitPrice: ''
                      };

                      return (
                        <tr
                          key={i}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', String(i));
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggedItemIndex(i);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOverItemIndex !== i) setDragOverItemIndex(i);
                          }}
                          onDragLeave={() => {
                            if (dragOverItemIndex === i) setDragOverItemIndex(null);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const fromIdx = draggedItemIndex !== null ? draggedItemIndex : parseInt(e.dataTransfer.getData('text/plain'), 10);
                            if (!isNaN(fromIdx) && fromIdx !== i) {
                              handleReorderQuoteItem(fromIdx, i);
                            }
                            setDraggedItemIndex(null);
                            setDragOverItemIndex(null);
                          }}
                          onDragEnd={() => {
                            setDraggedItemIndex(null);
                            setDragOverItemIndex(null);
                          }}
                          style={{
                            borderBottom: (dragOverItemIndex === i && draggedItemIndex !== null && draggedItemIndex < i)
                              ? '3px solid #0E7490'
                              : '1px solid #F1F5F9',
                            borderTop: (dragOverItemIndex === i && draggedItemIndex !== null && draggedItemIndex > i)
                              ? '3px solid #0E7490'
                              : 'none',
                            backgroundColor: draggedItemIndex === i
                              ? '#F8FAFC'
                              : (dragOverItemIndex === i
                                ? '#ECFEFF'
                                : (isChecked ? '#ECFEFF' : (i % 2 === 1 ? '#FAFBFC' : 'white'))),
                            opacity: draggedItemIndex === i ? 0.35 : 1,
                            transition: 'background-color 0.15s ease, opacity 0.15s ease'
                          }}
                        >
                          <td
                            style={{
                              padding: '8px 4px',
                              textAlign: 'center',
                              cursor: 'grab',
                              userSelect: 'none',
                              verticalAlign: 'middle',
                              borderLeft: (draggedItemIndex === i || dragOverItemIndex === i) ? '3px solid #0E7490' : 'none'
                            }}
                            title="Click and drag to reorder / align product, or use arrows"
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                              <GripVertical size={16} style={{ color: '#94A3B8', cursor: 'grab' }} />
                              <div style={{ display: 'flex', gap: '2px' }}>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleMoveQuoteItemStep(i, -1); }}
                                  disabled={i === 0}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: i === 0 ? 'not-allowed' : 'pointer',
                                    padding: '1px',
                                    color: i === 0 ? '#CBD5E1' : '#64748B',
                                    lineHeight: 1
                                  }}
                                  title="Move product up"
                                >
                                  <ChevronUp size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleMoveQuoteItemStep(i, 1); }}
                                  disabled={i === quoteItems.length - 1}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: i === quoteItems.length - 1 ? 'not-allowed' : 'pointer',
                                    padding: '1px',
                                    color: i === quoteItems.length - 1 ? '#CBD5E1' : '#64748B',
                                    lineHeight: 1
                                  }}
                                  title="Move product down"
                                >
                                  <ChevronDown size={11} />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center', borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent' }}>
                            <input id="crm-quotations-checkbox" name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedItemIndexes(prev => [...prev, i]);
                                else setSelectedItemIndexes(prev => prev.filter(idx => idx !== i));
                              }}
                              style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                             />
                          </td>
                          <td style={{ padding: '10px 10px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {/* Line 1: Product / Item Name (Typeable & Dropdown) */}
                              <TypeableProductSelect
                                value={item.name || ''}
                                itemsList={itemsList}
                                placeholder="Type or select product / item..."
                                accentColor="#4F46E5"
                                onChange={(val, matched) => {
                                  if (!matched) {
                                    const dynamicHsn = getHsnCode({ name: val, category: item.category });
                                    const isSolar5 = is5PctSolarProduct(val, item.category, dynamicHsn);
                                    setQuoteItems(prev => prev.map((mat, idx) => idx === i ? {
                                      ...mat,
                                      name: val,
                                      hsn: dynamicHsn,
                                      gstRate: isSolar5 ? '5%' : mat.gstRate
                                    } : mat));
                                    return;
                                  }
                                  const pName = matched.name;
                                  const pCat = matched.category || matched.description || item.category;
                                  const pHsn = matched.hsn || matched.hsn_or_sac || getHsnCode(matched || { name: pName, category: pCat });
                                  const isSolar5 = is5PctSolarProduct(pName, pCat, pHsn);
                                  setQuoteItems(prev => prev.map((mat, idx) => idx === i ? {
                                    ...mat,
                                    name: pName,
                                    rate: matched ? String(matched.price || matched.rate || mat.rate) : mat.rate,
                                    uom: matched ? (matched.uom || matched.unit || mat.uom || mat.unit || 'NOS') : (mat.uom || mat.unit || 'NOS'),
                                    unit: matched ? (matched.uom || matched.unit || mat.uom || mat.unit || 'NOS') : (mat.uom || mat.unit || 'NOS'),
                                    category: pCat,
                                    gstRate: isSolar5 ? '5%' : (mat.gstRate || '18%'),
                                    hsn: pHsn
                                  } : mat));
                                }}
                              />
                               {/* Line 2: Description */}
                               <input id={`crm-quotations-description-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`description_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Description"
                                 type="text"
                                 placeholder="Description..."
                                 value={item.category || ''}
                                 onChange={(e) => {
                                   const val = e.target.value;
                                   setQuoteItems(prev => prev.map((mat, idx) => {
                                     if (idx !== i) return mat;
                                     const isSolar5 = is5PctSolarProduct(mat.name, val);
                                     const dynamicHsn = getHsnCode({ name: mat.name, category: val }) || mat.hsn;
                                     return {
                                       ...mat,
                                       category: val,
                                       gstRate: isSolar5 ? '5%' : mat.gstRate,
                                       hsn: dynamicHsn
                                     };
                                   }));
                                 }}
                                 style={{ width: '100%', height: '28px', borderRadius: '6px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '11px', color: '#64748B', outline: 'none', boxSizing: 'border-box', backgroundColor: '#F8FAFC', cursor: 'text' }}
                                />
                             </div>
                           </td>
                           <td style={{ padding: '12px 6px' }}>
                             <input id={`crm-quotations-hsn-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`hsn_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="HSN / SAC"
                               type="text"
                               readOnly
                               tabIndex={-1}
                               placeholder={getHsnCode(item) || 'HSN Code'}
                               value={item.hsn !== undefined && item.hsn !== '' ? item.hsn : (item.name ? getHsnCode(item) : '')}
                               style={{
                                 width: '100%',
                                 minWidth: '100px',
                                 height: '38px',
                                 borderRadius: '8px',
                                 border: '1px solid #E2E8F0',
                                 padding: '0 6px',
                                 fontSize: '12px',
                                 fontWeight: '700',
                                 color: '#475569',
                                 backgroundColor: '#F8FAFC',
                                 outline: 'none',
                                 boxSizing: 'border-box',
                                 textAlign: 'center',
                                 cursor: 'not-allowed'
                               }}
                               title="HSN / SAC Code (Auto-populated from master catalog; read-only)"
                             />
                           </td>
                           <td style={{ padding: '12px 10px' }}>
                             {(() => {
                               const isSalesUser = isSalesLoginRole(userRole);
                               if (isSalesUser) {
                                 const currentUom = normalizeSalesUomValue(item.uom || item.unit || 'NOS');
                                 const salesAllowedValues = SALES_UOM_OPTIONS.map((o) => o.value);
                                 return (
                                   <select
                                     id={`crm-quotations-uom-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                     name={`uOM_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`}
                                     aria-label="UOM"
                                     value={currentUom}
                                     onChange={(e) => {
                                       const val = e.target.value.toUpperCase();
                                       setQuoteItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, uom: val, unit: val } : mat));
                                     }}
                                     style={{ width: '100%', minWidth: '80px', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 6px', fontSize: '12px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF', fontWeight: '700', cursor: 'pointer', color: '#0F172A' }}
                                   >
                                     {!salesAllowedValues.includes(currentUom) && (
                                       <option value={currentUom}>{currentUom}</option>
                                     )}
                                     {SALES_UOM_OPTIONS.map((opt) => (
                                       <option key={opt.value} value={opt.value}>{opt.label}</option>
                                     ))}
                                   </select>
                                 );
                               }
                               return (
                                 <>
                                   <input id={`crm-quotations-uom-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`uOM_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="UOM"
                                     type="text"
                                     list={`uom-list-${i}`}
                                     placeholder="UOM"
                                     value={item.uom || item.unit || 'NOS'}
                                     onChange={(e) => {
                                       const val = e.target.value;
                                       setQuoteItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, uom: val, unit: val } : mat));
                                     }}
                                     style={{ width: '100%', minWidth: '80px', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '12px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF', fontWeight: '700', cursor: 'text' }}
                                    />
                                   <datalist id={`uom-list-${i}`}>
                                     <option value="NOS" />
                                     <option value="SET" />
                                     <option value="KW" />
                                     <option value="KG" />
                                     <option value="MTR" />
                                     <option value="PCS" />
                                     <option value="BOX" />
                                     <option value="PKT" />
                                     <option value="PAIR" />
                                     <option value="LOT" />
                                     <option value="TON" />
                                   </datalist>
                                 </>
                               );
                             })()}
                           </td>
                           <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                               <input id={`crm-quotations-0-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`0_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Qty / Set"
                                 type="number"
                                 value={item.qty}
                                 placeholder="0"
                                 onChange={(e) => {
                                   const val = e.target.value;
                                   const numVal = parseFloat(val) || 0;
                                   const setCount = parseFloat(currentGroup?.setCount || 1) || 1;
                                   const calculatedDisp = calculateTotalDispatchQty(
                                     { ...item, qty: numVal, presetId: currentGroup?.presetId || item.presetId },
                                     setCount,
                                     currentGroup?.presetName || item.presetName,
                                     currentGroup?.category || item.category,
                                     currentGroup?.unit || currentGroup?.unitType || item.unit || item.uom
                                   );
                                   setQuoteItems(prev => prev.map((mat, idx) => idx === i ? {
                                     ...mat,
                                     qty: val,
                                     qtyPerSet: val,
                                     totalDispatchQty: calculatedDisp
                                   } : mat));
                                 }}
                                 style={{ width: '100%', minWidth: '88px', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '13px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', cursor: 'text', fontWeight: '700' }}
                                />
                             </div>
                           </td>
                           <td style={{ padding: '8px 10px', textAlign: 'center', backgroundColor: isPresetItem ? '#F0FDFA' : '#F8FAFC', verticalAlign: 'middle' }}>
                             {(() => {
                               if (!isPresetItem) {
                                 return <span style={{ color: '#94A3B8', fontWeight: '700', fontSize: '13px' }} title="Standalone product; entered quantity is direct total quantity">—</span>;
                               }
                               const setCount = parseFloat(currentGroup?.setCount || 1) || 1;
                               const calculatedDisp = calculateTotalDispatchQty(
                                 { ...item, presetId: currentGroup?.presetId || item.presetId },
                                 setCount,
                                 currentGroup?.presetName || item.presetName,
                                 currentGroup?.category || item.category,
                                 currentGroup?.unit || currentGroup?.unitType || item.unit || item.uom
                               );
                               const dispQty = (item.totalDispatchQty !== undefined && item.totalDispatchQty !== null && item.totalDispatchQty !== '')
                                 ? item.totalDispatchQty
                                 : calculatedDisp;
                               const numQty = parseFloat(item.qty) || 0;
                               return (
                                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                   <input
                                     type="number"
                                     min="0"
                                     value={dispQty}
                                     placeholder={String(calculatedDisp || 0)}
                                     onChange={(e) => {
                                       const val = e.target.value;
                                       setQuoteItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, totalDispatchQty: val } : mat));
                                     }}
                                     style={{ width: '85px', height: '36px', borderRadius: '6px', border: '1.5px solid #0E7490', padding: '0 6px', fontSize: '12.5px', fontWeight: '800', textAlign: 'center', color: '#0E7490', backgroundColor: 'white', outline: 'none' }}
                                   />
                                   {calculatedDisp !== numQty && (
                                     <div style={{ fontSize: '10px', color: '#0E7490', fontWeight: '600' }}>
                                       ({item.qty} × {setCount})
                                     </div>
                                   )}
                                 </div>
                               );
                             })()}
                           </td>
                          <td style={{ padding: '12px 10px' }}>
                            {isPresetItem ? (
                              <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                            ) : (
                              <input id={`crm-quotations-0-00-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`000_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="0.00"
                                type="number"
                                value={item.rate}
                                placeholder="0.00"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setQuoteItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, rate: val } : mat));
                                }}
                                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '13px', textAlign: 'right', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white', cursor: 'text' }}
                               />
                            )}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            <select id={`crm-quotations-gst-rate-18-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`gstRate18_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="GstRate 18"
                              value={item.gstRate || (currentGroup && currentGroup.gstRate) || '18%'}
                              onChange={(e) => {
                                const val = e.target.value;
                                setQuoteItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, gstRate: val } : mat));
                              }}
                              style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #C7D2FE', padding: '0 6px', fontSize: '12px', fontWeight: '700', color: '#4338CA', backgroundColor: '#EEF2FF', outline: 'none', cursor: 'pointer', textAlign: 'center' }}
                            >
                              <option value="18%">18%</option>
                              <option value="12%">12%</option>
                              <option value="5%">5%</option>
                              <option value="0%">0%</option>
                            </select>
                          </td>
                          {hasAnyPreset && (() => {
                            if (isPresetItem) {
                              if (isFirstInGroup) {
                                return (
                                  <td
                                    rowSpan={groupCount}
                                    style={{
                                      padding: '12px 10px',
                                      verticalAlign: 'middle',
                                      backgroundColor: '#EEF2FF',
                                      borderLeft: '2px solid #C7D2FE',
                                      borderRight: '2px solid #C7D2FE'
                                    }}
                                  >
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                      <span
                                        style={{
                                          fontSize: '11px',
                                          fontWeight: '800',
                                          color: '#4338CA',
                                          textAlign: 'center',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          maxWidth: '120px',
                                          display: 'block'
                                        }}
                                        title={currentGroup.presetName}
                                      >
                                        {currentGroup.presetName}
                                      </span>

                                      <div style={{ position: 'relative', width: '100%' }}>
                                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', fontWeight: '700', color: '#6366F1', pointerEvents: 'none' }}>₹</span>
                                        <input id="crm-quotations-0-00" name="000" aria-label="0.00"
                                          type="number"
                                          value={currentGroup.kitPrice}
                                          placeholder="0.00"
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (groupId) {
                                              setPresetGroups(prev => ({
                                                ...prev,
                                                [groupId]: { ...(prev[groupId] || currentGroup), kitPrice: val }
                                              }));
                                            }
                                          }}
                                          style={{
                                            width: '100%', height: '42px', borderRadius: '8px',
                                            border: '2px solid #818CF8', padding: '0 10px 0 26px',
                                            fontSize: '15px', fontWeight: '800', color: '#312E81',
                                            textAlign: 'right', outline: 'none', boxSizing: 'border-box',
                                            backgroundColor: 'white', cursor: 'text'
                                          }}
                                         />
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: '600' }}>
                                          {groupCount} items ×
                                        </span>
                                        <input id="crm-quotations-set-count" name="setCount" aria-label="SetCount"
                                          type="number"
                                          min="0"
                                          max="999"
                                          value={currentGroup.setCount !== undefined && currentGroup.setCount !== null ? currentGroup.setCount : ''}
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) => {
                                            const rawVal = e.target.value;
                                            if (rawVal === '') {
                                              if (groupId) {
                                                setPresetGroups(prev => ({
                                                  ...prev,
                                                  [groupId]: { ...(prev[groupId] || currentGroup), setCount: '' }
                                                }));
                                              }
                                              return;
                                            }
                                            const parsed = parseFloat(rawVal);
                                            const valToSave = isNaN(parsed) ? '' : Math.max(0, parsed);
                                            if (groupId) {
                                              setPresetGroups(prev => ({
                                                ...prev,
                                                [groupId]: { ...(prev[groupId] || currentGroup), setCount: valToSave }
                                              }));
                                            }
                                          }}
                                          onBlur={() => {
                                            const current = currentGroup.setCount;
                                            const finalCount = (current === '' || isNaN(parseFloat(current)) || parseFloat(current) < 0) ? 1 : Math.max(0, parseFloat(current));
                                            if (groupId) {
                                              setPresetGroups(prev => ({
                                                ...prev,
                                                [groupId]: { ...(prev[groupId] || currentGroup), setCount: finalCount }
                                              }));
                                            }
                                          }}
                                          style={{
                                            width: '50px', height: '26px', borderRadius: '6px',
                                            border: '1.5px solid #818CF8', fontSize: '12px',
                                            fontWeight: '800', color: '#312E81', textAlign: 'center',
                                            padding: '0 2px', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box', cursor: 'text'
                                          }}
                                          title={(currentGroup.unit || 'Sets') === 'kW' ? "Capacity in kW" : "Sets multiplier for this preset"}
                                         />
                                        <select
                                          value={currentGroup.unit || 'Sets'}
                                          onChange={(e) => {
                                            const newUnit = e.target.value;
                                            if (groupId) {
                                              setPresetGroups(prev => ({
                                                ...prev,
                                                [groupId]: { ...(prev[groupId] || currentGroup), unit: newUnit }
                                              }));
                                            }
                                          }}
                                          style={{
                                            height: '26px', borderRadius: '6px',
                                            border: '1.5px solid #818CF8', padding: '0 2px',
                                            fontSize: '11px', fontWeight: '800',
                                            color: '#312E81', backgroundColor: '#FFFFFF',
                                            outline: 'none', cursor: 'pointer'
                                          }}
                                          title="Choose unit: Sets or kW"
                                        >
                                          <option value="Sets">Sets</option>
                                          <option value="kW">kW</option>
                                        </select>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                        <span style={{ fontSize: '10px', color: '#6366F1', fontWeight: '700' }}>GST:</span>
                                        <select id={`crm-quotations-gst-rate-18-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`gstRate18_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="GstRate 18"
                                          value={currentGroup.gstRate || item.gstRate || '18%'}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (groupId) {
                                              setPresetGroups(prev => ({
                                                ...prev,
                                                [groupId]: { ...(prev[groupId] || currentGroup), gstRate: val }
                                              }));
                                            }
                                            setQuoteItems(prev => prev.map((mat, idx) =>
                                              ((mat.presetGroupId || 'legacy_default') === groupId || idx === i)
                                                ? { ...mat, gstRate: val }
                                                : mat
                                            ));
                                          }}
                                          style={{
                                            height: '24px', borderRadius: '6px',
                                            border: '1.5px solid #818CF8', padding: '0 4px',
                                            fontSize: '11px', fontWeight: '800',
                                            color: '#312E81', backgroundColor: '#FFFFFF',
                                            outline: 'none', cursor: 'pointer'
                                          }}
                                          title="Change GST Rate for this preset"
                                        >
                                          <option value="18%">18%</option>
                                          <option value="12%">12%</option>
                                          <option value="5%">5%</option>
                                          <option value="0%">0%</option>
                                        </select>
                                      </div>

                                      {groupId && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                          <button
                                            type="button"
                                            onClick={() => handleMovePresetGroupBlock(groupId, -1)}
                                            style={{
                                              border: '1px solid #C7D2FE',
                                              backgroundColor: '#FFFFFF',
                                              color: '#4338CA',
                                              fontSize: '10px',
                                              fontWeight: '700',
                                              cursor: 'pointer',
                                              padding: '2px 5px',
                                              borderRadius: '4px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '2px'
                                            }}
                                            title={`Move ${currentGroup.presetName} preset block up`}
                                          >
                                            <ChevronUp size={10} /> Up
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleMovePresetGroupBlock(groupId, 1)}
                                            style={{
                                              border: '1px solid #C7D2FE',
                                              backgroundColor: '#FFFFFF',
                                              color: '#4338CA',
                                              fontSize: '10px',
                                              fontWeight: '700',
                                              cursor: 'pointer',
                                              padding: '2px 5px',
                                              borderRadius: '4px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '2px'
                                            }}
                                            title={`Move ${currentGroup.presetName} preset block down`}
                                          >
                                            <ChevronDown size={10} /> Down
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRemovePresetGroup(groupId)}
                                            style={{
                                              border: 'none',
                                              backgroundColor: 'transparent',
                                              color: '#EF4444',
                                              fontSize: '10px',
                                              fontWeight: '700',
                                              cursor: 'pointer',
                                              padding: '2px 6px',
                                              borderRadius: '4px'
                                            }}
                                            title={`Remove entire ${currentGroup.presetName} preset`}
                                          >
                                            Remove Kit
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );
                              } else {
                                return null;
                              }
                            } else {
                              return <td style={{ padding: '12px 10px', textAlign: 'center' }}><span style={{ fontSize: '11px', color: '#CBD5E1' }}>—</span></td>;
                            }
                          })()}
                          <td style={{ padding: '12px 10px', color: '#475569', textAlign: 'right', fontWeight: '600' }}>
                            {isPresetItem ? (
                              <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                            ) : (
                              `₹${taxable.toFixed(2)}`
                            )}
                          </td>
                          <td style={{ padding: '12px 10px', fontWeight: 'bold', color: '#0F172A', textAlign: 'right' }}>
                            {isPresetItem ? (
                              <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                            ) : (
                              `₹${rowTot.toFixed(2)}`
                            )}
                          </td>
                          <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterialRow(i)}
                              style={{ border: 'none', background: '#FEF2F2', color: '#EF4444', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Delete Item"
                            >
                              <Trash2 style={{ width: '15px', height: '15px' }} />
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()
                )}
                </tbody>
              </table>
            </div>

            <div>
              <button
                type="button"
                onClick={handleAddMaterialRow}
                style={{ border: '1px solid #A5F3FC', background: '#ECFEFF', color: '#0E7490', padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus style={{ width: '15px', height: '15px' }} />
                Add Product / Item
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 4: TRANSPORT & LOGISTICS DETAILS + TERMS & CONDITIONS */}
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
              4
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              TRANSPORT, LOGISTICS & TERMS AND CONDITIONS
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div>
              <label htmlFor="crm-quotations-mode-of-transport" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Mode of Transport</label>
              <select id="crm-quotations-mode-of-transport" name="modeOfTransport" aria-label="Mode of Transport"
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none', cursor: 'pointer' }}
              >
                <option value="Transport">Transport (Road Freight)</option>
                <option value="Own Vehicle">Own Vehicle</option>
                <option value="Porter / Local">Porter / Local Delivery</option>
                <option value="Courier">Courier / Express</option>
              </select>
            </div>
            <div>
              <label htmlFor="crm-quotations-transporter-name" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Transporter Name</label>
              <input id="crm-quotations-transporter-name" name="transporterName" aria-label="Transporter Name"
                type="text"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                placeholder="e.g. VRL Logistics / TCI Freight"
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="crm-quotations-vehicle-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Vehicle Number</label>
              <input id="crm-quotations-vehicle-number" name="vehicleNumber" aria-label="Vehicle Number"
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="e.g. TN 01 AB 1234"
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none' }}
               />
            </div>
            <div>
              <label htmlFor="crm-quotations-logistics-scope" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Logistics Scope</label>
              <select id="crm-quotations-logistics-scope" name="logisticsScope" aria-label="Logistics Scope"
                value={transportScope}
                onChange={(e) => setTransportScope(e.target.value)}
                style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', boxSizing: 'border-box', outline: 'none', cursor: 'pointer' }}
              >
                <option value="VRM Structures">VRM Structures Scope</option>
                <option value="Customer Scope">Customer Scope (To-Pay)</option>
              </select>
            </div>
          </div>

          {/* Terms & Conditions Presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>Quotation Terms & Conditions Clauses</label>
              <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', padding: '4px 10px', borderRadius: '8px' }}>
                Preset: {QUOTATION_TERMS_PRESETS.find(p => p.key === selectedTermsPreset)?.label || 'Custom / Typed'}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedTermsPreset('');
                  setTerms('');
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: selectedTermsPreset === '' ? '1.5px dashed #0E7490' : '1px solid #CBD5E1',
                  backgroundColor: selectedTermsPreset === '' ? '#F0FDFA' : '#FFFFFF',
                  color: selectedTermsPreset === '' ? '#0E7490' : '#475569',
                  fontSize: '11px',
                  fontWeight: selectedTermsPreset === '' ? '700' : '500',
                  cursor: 'pointer'
                }}
              >
                Clear / Custom
              </button>

              {QUOTATION_TERMS_PRESETS.map((p) => {
                const isSelected = selectedTermsPreset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setSelectedTermsPreset(p.key);
                      setTerms(p.text);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid #0E7490' : '1px solid #CBD5E1',
                      backgroundColor: isSelected ? '#0E7490' : '#FFFFFF',
                      color: isSelected ? '#FFFFFF' : '#475569',
                      fontSize: '11px',
                      fontWeight: isSelected ? '700' : '500',
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <textarea id="crm-quotations-terms" name="terms" aria-label="Select a preset above or freely type custom quotation Terms & Conditions"
              value={terms}
              onChange={(e) => {
                setTerms(e.target.value);
                if (selectedTermsPreset !== '') setSelectedTermsPreset('');
              }}
              rows={6}
              placeholder="Select a preset above or freely type custom quotation Terms & Conditions..."
              style={{
                width: '100%',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                padding: '12px 14px',
                fontSize: '12px',
                lineHeight: '1.6',
                color: '#1E293B',
                boxSizing: 'border-box',
                outline: 'none',
                resize: 'vertical',
                backgroundColor: '#FAFBFC'
              }}
             />

          </div>
        </div>

        {/* SIDE-BY-SIDE SECTIONS: 5 (OUR COMPANY BANK ACCOUNT DETAILS) & 6 (FINANCIAL SUMMARY & COMMERCIAL TOTALS) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', alignItems: 'stretch' }}>
          
          {/* SECTION 5: OUR COMPANY BANK ACCOUNT DETAILS */}
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                    5
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Landmark size={16} style={{ color: '#0E7490' }} /> VRM OFFICIAL COMMERCIAL BANK DETAILS
                  </h3>
                </div>
                <span style={{ fontSize: '10px', fontWeight: '700', backgroundColor: '#ECFDF5', color: '#0E7490', border: '1px solid #A5F3FC', padding: '3px 9px', borderRadius: '6px' }}>
                  RTGS / NEFT / IMPS
                </span>
              </div>

              {/* Dedicated Banking Card Layout */}
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Beneficiary Name Banner */}
                <div style={{ paddingBottom: '10px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Beneficiary Name</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>VRM Structures India Private Limited</div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '6px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={13} /> Verified
                  </span>
                </div>

                {/* Bank Name & Account Type Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Bank Name</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginTop: '2px' }}>HDFC Bank</div>
                  </div>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Account Type</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginTop: '2px' }}>Current Account</div>
                  </div>
                </div>

                {/* Account Number & IFSC with Copy Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#0284C7', fontWeight: '700', textTransform: 'uppercase' }}>Account Number</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0369A1', fontFamily: 'monospace', letterSpacing: '0.5px', marginTop: '2px' }}>50200031629272</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyBankDetail('50200031629272', 'Account Number')}
                      title="Copy Account Number"
                      style={{ border: '1px solid #BAE6FD', backgroundColor: '#F0F9FF', color: '#0284C7', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {copiedBankField === 'Account Number' ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                    </button>
                  </div>

                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#0284C7', fontWeight: '700', textTransform: 'uppercase' }}>IFSC Code</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0369A1', fontFamily: 'monospace', letterSpacing: '0.5px', marginTop: '2px' }}>HDFC0007315</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyBankDetail('HDFC0007315', 'IFSC Code')}
                      title="Copy IFSC Code"
                      style={{ border: '1px solid #BAE6FD', backgroundColor: '#F0F9FF', color: '#0284C7', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {copiedBankField === 'IFSC Code' ? <Check size={14} color="#059669" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Branch Location */}
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span><strong>Branch:</strong> VINAYAGAPURAM BRANCH</span>
                  <span style={{ color: '#64748B', fontSize: '10px' }}>Settlement: INR (₹)</span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: '11px', color: '#64748B', padding: '10px 12px', backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={15} style={{ color: '#0E7490', flexShrink: 0 }} />
              <span>Please transfer advance & milestone payments directly to this verified company account.</span>
            </div>
          </div>

          {/* SECTION 6: FINANCIAL SUMMARY & COMMERCIAL TOTALS */}
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '20px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                  6
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  FINANCIAL SUMMARY & COMMERCIAL TOTALS
                </h3>
              </div>

              {/* Subtotals Breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                {totals.kitSubtotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '8px 12px', borderRadius: '8px' }}>
                    <span style={{ fontWeight: '700' }}>Preset Kits Subtotal</span>
                    <strong style={{ color: '#0E7490' }}>₹{totals.kitSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748B' }}>
                  <span>Taxable Subtotal (Before GST)</span>
                  <strong style={{ color: '#0F172A' }}>₹{totals.sub.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748B', fontSize: '12px' }}>
                  <span>CGST (9%)</span>
                  <span style={{ color: '#475569', fontWeight: '600' }}>₹{totals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748B', fontSize: '12px' }}>
                  <span>SGST (9%)</span>
                  <span style={{ color: '#475569', fontWeight: '600' }}>₹{totals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '8px 12px', borderRadius: '8px' }}>
                  <span>Total Applicable GST (18%)</span>
                  <span>₹{totals.gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0F172A', fontSize: '18px', fontWeight: '800', borderTop: '2px solid #E2E8F0', paddingTop: '12px', marginTop: '4px' }}>
                  <span>Grand Total (Incl. GST)</span>
                  <span style={{ color: '#0E7490' }}>₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Menu Bar Following with Scroll for Create / Edit Quotation */}
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
            marginTop: '8px',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setQuoteConfirmModal('cancel')}
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
              <ArrowLeft size={15} /> Back
            </button>

            <button
              type="button"
              onClick={() => {
                const validation = validateQuotationForm(true);
                if (!validation.isValid) {
                  setValidationAlert({
                    fields: validation.missingList.map(m => typeof m === 'object' ? (m.name || m.field) : m),
                    firstTargetId: validation.missingList[0]?.targetId
                  });
                  return;
                }
                setQuoteConfirmModal('draft');
              }}
              style={{
                height: '40px',
                borderRadius: '8px',
                border: '1.5px solid #0E7490',
                backgroundColor: '#FFFFFF',
                color: '#0E7490',
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
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ECFEFF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
            >
              <FileText size={15} /> Save as Draft
            </button>

            <button
              type="button"
              onClick={() => {
                const validation = validateQuotationForm(false);
                if (!validation.isValid) {
                  setValidationAlert({
                    fields: validation.missingList.map(m => typeof m === 'object' ? (m.name || m.field) : m),
                    firstTargetId: validation.missingList[0]?.targetId
                  });
                  return;
                }
                setQuoteConfirmModal('create');
              }}
              style={{
                height: '40px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#10B981',
                color: '#FFFFFF',
                padding: '0 22px',
                fontWeight: '800',
                cursor: 'pointer',
                fontSize: '13px',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#059669'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#10B981'; }}
            >
              <CheckCircle style={{ width: '16px', height: '16px' }} />
              <span>{editingQuoteId ? 'Save & Send Revision →' : 'Confirm Quotation →'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Grand Total:</span>
            <strong style={{ fontSize: '15px', color: '#0E7490', fontWeight: '800' }}>
              ₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>
        </div>

        {/* CONFIRMATION / SUBMISSION MODAL */}
        {quoteConfirmModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', maxWidth: '440px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: quoteConfirmModal === 'cancel' ? '#FEE2E2' : quoteConfirmModal === 'draft' ? '#FFFBEB' : '#ECFEFF', color: quoteConfirmModal === 'cancel' ? '#DC2626' : quoteConfirmModal === 'draft' ? '#D97706' : '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {quoteConfirmModal === 'cancel' ? <AlertTriangle style={{ width: '20px', height: '20px' }} /> : quoteConfirmModal === 'draft' ? <FileText style={{ width: '20px', height: '20px' }} /> : <Layers style={{ width: '20px', height: '20px' }} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                    {quoteConfirmModal === 'cancel'
                      ? 'Discard Quotation?'
                      : quoteConfirmModal === 'draft'
                        ? 'Save Quotation as Draft?'
                        : (editingQuoteId ? 'Confirm & Send Revision?' : 'Confirm & Create Quotation?')}
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B', lineHeight: '1.4' }}>
                    {quoteConfirmModal === 'cancel'
                      ? 'Are you sure you want to cancel? Any unsaved changes in this proposal form will be lost.'
                      : quoteConfirmModal === 'draft'
                        ? `Save Commercial Quotation (${quoteCode}) as a Draft? You can edit, revise, or confirm it at any time later.`
                        : `Are you sure you want to finalize and save Commercial Quotation (${quoteCode})?`}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setQuoteConfirmModal(null)}
                  style={{ border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#475569', padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const mode = quoteConfirmModal;
                    setQuoteConfirmModal(null);
                    if (mode === 'cancel') {
                      setShowBOMQuoteForm(false);
                    } else if (mode === 'draft') {
                      handleSaveQuotationRecord('Draft');
                    } else if (mode === 'create') {
                      handleSaveQuotationRecord('Sent');
                    }
                  }}
                  style={{
                    border: 'none',
                    backgroundColor: quoteConfirmModal === 'cancel' ? '#DC2626' : '#0E7490',
                    color: 'white',
                    padding: '9px 20px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  {quoteConfirmModal === 'cancel' ? 'Yes, Discard' : quoteConfirmModal === 'draft' ? 'Save Draft' : 'Confirm & Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CUSTOM MANDATORY VALIDATION MODAL (MATCHING PO CREATION POPUP) */}
        {validationAlert && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', width: '460px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', flexShrink: 0 }}>
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>Mandatory Fields Required</h3>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>Please complete all required fields to move forward.</p>
                </div>
              </div>
              <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>You did not fill out the following mandatory box(es):</span>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#DC2626', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(validationAlert.fields || []).map((field, idx) => (
                    <li key={idx}><strong>{field}</strong></li>
                  ))}
                </ul>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  onClick={() => {
                    const targetId = validationAlert.firstTargetId;
                    setValidationAlert(null);
                    if (targetId) {
                      setTimeout(() => {
                        const el = document.getElementById(targetId);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          el.focus?.();
                        }
                      }, 100);
                    }
                  }}
                  style={{ backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)' }}
                >
                  OK, I'll fill it
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HDG Structure Configurator Modal */}
        <HdgStructureConfiguratorModal
          isOpen={showHdgConfiguratorModal}
          onClose={() => setShowHdgConfiguratorModal(false)}
          onApplyToQuote={handleApplyHdgStructure}
        />

      </div>
    );
}
