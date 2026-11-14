import React, { useEffect } from 'react';
import {
  Plus, Check, Trash2, FileText, X, CheckCircle, ArrowLeft, Edit, Layers, Building2, Truck, Boxes, User, Landmark, ShieldCheck, FileCheck, Copy, ChevronDown, ChevronUp, GripVertical
} from 'lucide-react';
import SearchablePresetSelector from '../SearchablePresetSelector';
import TypeableProductSelect from '../TypeableProductSelect';
import { resolveProductCode, isRailPreset, isKwPreset, calculateTotalDispatchQty } from '../../utils/vrmProductsData';
import { searchCustomers } from '../../services/customerService';
import { getHsnCode, is5PctSolarProduct } from '../../utils/hsnCodeService';
import { PRESET_THEMES, getPresetTheme } from '../../utils/presetThemes';

export default function PiCreatorEditorSection({ ctx }) {
  const {
    GST_STATE_MAP,
    viewMode,
    piList,
    isTechSupport,
    salespersonsList,
    selectedSalespersonCode,
    setSelectedSalespersonCode,
    editIdx,
    getActiveUserName,
    activePresetsMap,
    selectedPreset,
    setSelectedPreset,
    presetGroups,
    setPresetGroups,
    setSubPresetModalGroup,
    setNestedSubPresetVal,
    setNestedSubPresetCount,
    selectedItemIndexes,
    setSelectedItemIndexes,
    setShowClearConfirmModal,
    setShowCreateSetModal,
    setNewSetName,
    setNewSetCount,
    setNewSetPrice,
    setNewSetGstRate,
    setShowBulkItemModal,
    setBulkItemSearch,
    setBulkCategoryFilter,
    setPiConfirmModal,
    copiedBankField,
    handleCopyBankDetail,
    customerList,
    setCustomerList,
    searchCustTimerRef,
    itemsList,
    piNumber,
    isSubmittingPI,
    piDate,
    salesPerson,
    setSalesPerson,
    vendorName,
    setVendorName,
    contactPerson,
    setContactPerson,
    phone,
    setPhone,
    email,
    setEmail,
    gstNo,
    setGstNo,
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
    piItems,
    setPiItems,
    draggedItemIndex,
    setDraggedItemIndex,
    dragOverItemIndex,
    setDragOverItemIndex,
    piFormErrors,
    setPiFormErrors,
    paymentTerms,
    setPaymentTerms,
    isCustomerDropdownOpen,
    setIsCustomerDropdownOpen,
    customerDropdownRef,
    uniqueCustomerList,
    filteredCustomerSuggestions,
    handleSelectCustomer,
    calculatePiTotals,
    handleAddMaterialRow,
    handleAddPresetItem,
    handleReorderPiItem,
    handleMovePiItemStep,
    handleMovePresetGroupBlock,
    handleAddPresetToOrder,
    handleRemovePresetGroup,
    handleRemoveMaterialRow,
    triggerSaveConfirm,
    triggerDraftConfirm
  } = ctx;

  // Smooth viewport auto-scroll while dragging a product row near top/bottom edges
  useEffect(() => {
    if (draggedItemIndex === null || draggedItemIndex === undefined) return;
    let rafId = null;
    let scrollSpeed = 0;

    const tick = () => {
      if (scrollSpeed !== 0) {
        window.scrollBy(0, scrollSpeed);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const handleWindowDragOver = (e) => {
      const edgeThreshold = 110;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (e.clientY < edgeThreshold) {
        const ratio = Math.max(0.25, (edgeThreshold - e.clientY) / edgeThreshold);
        scrollSpeed = -Math.round(14 * ratio);
      } else if (e.clientY > vh - edgeThreshold) {
        const ratio = Math.max(0.25, (e.clientY - (vh - edgeThreshold)) / edgeThreshold);
        scrollSpeed = Math.round(14 * ratio);
      } else {
        scrollSpeed = 0;
      }
    };

    window.addEventListener('dragover', handleWindowDragOver, { passive: true });
    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [draggedItemIndex]);

  return (
    <>
      {/* ==================== VIEW 2: DEDICATED FULL-PAGE CREATOR/EDITOR VIEW ==================== */}
      {(viewMode === 'create' || viewMode === 'edit') && (() => {
        const totals = calculatePiTotals();
        const hasAnyPreset = (piItems || []).some(it => it.isPresetItem);
        const hasAnyKwPreset = (piItems || []).some(it => isKwPreset(it.presetName, it.unit || it.uom, it)) ||
          Object.values(presetGroups || {}).some(g => isKwPreset(g.presetName || g.name, g.unit || g.unitType));

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>

            {/* Top Page Title Bar with Action Buttons matching BOM */}
            <div
              style={{
                background: 'linear-gradient(135deg, #075985 0%, #0E7490 50%, #0891B2 100%)',
                borderRadius: '18px',
                padding: '24px 28px',
                color: '#FFFFFF',
                boxShadow: '0 10px 25px -5px rgba(14, 116, 144, 0.4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.18)',
                    backdropFilter: 'blur(6px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FileCheck style={{ width: '24px', height: '24px', color: '#FFFFFF' }} />
                </div>
                <div>
                  <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
                    {viewMode === 'edit' ? `Edit Proforma Invoice: ${piNumber}` : 'Create Proforma Invoice (PI)'}
                  </h1>
                  <p style={{ fontSize: '13px', color: '#CFFAFE', margin: '4px 0 0 0' }}>
                    Configure customer commercial billing, structured pack kits, freight specifications & payment terms
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPiConfirmModal('cancel')}
                style={{
                  border: '1px solid rgba(255, 255, 255, 0.35)',
                  backgroundColor: 'rgba(255, 255, 255, 0.14)',
                  color: '#FFFFFF',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px'
                }}
              >
                <ArrowLeft size={15} />
                Back
              </button>
            </div>

            {/* SECTION 1: PI DETAILS & DATES */}
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                  1
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  PI DETAILS & DATES
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div>
                  <label htmlFor="performa-invoice-pi-date" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    PI Date
                  </label>
                  <input id="performa-invoice-pi-date" name="pIDate" aria-label="PI Date"
                    type="date"
                    readOnly
                    disabled
                    value={piDate}
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      padding: '0 14px',
                      fontSize: '13px',
                      color: '#475569',
                      backgroundColor: '#F8FAFC',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'not-allowed'
                    }}
                   />
                </div>

                <div>
                  <label htmlFor="performa-invoice-pi-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    PI Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input id="performa-invoice-pi-number" name="pINumber" aria-label="PI Number"
                      type="text"
                      readOnly
                      disabled
                      value={viewMode === 'edit' ? (piNumber || 'N/A') : 'Auto Generated'}
                      style={{
                        width: '100%',
                        height: '42px',
                        borderRadius: '10px',
                        border: '1px solid #E2E8F0',
                        padding: '0 14px',
                        fontSize: '13px',
                        fontWeight: '800',
                        color: viewMode === 'edit' ? '#0E7490' : '#059669',
                        backgroundColor: viewMode === 'edit' ? '#F8FAFC' : '#F0FDF4',
                        outline: 'none',
                        boxSizing: 'border-box',
                        cursor: 'not-allowed'
                      }}
                     />
                  </div>
                </div>

                <div>
                  <label htmlFor="performa-invoice-sales-executive" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    {isTechSupport ? 'Assign to Sales Executive (Optional)' : 'Sales Executive'}
                  </label>
                  <div style={{ position: 'relative' }}>
                    {isTechSupport ? (
                      <select
                        id="performa-invoice-sales-executive"
                        name="salesExecutive"
                        aria-label="Assign to Sales Executive"
                        value={selectedSalespersonCode || ''}
                        onChange={(e) => {
                          const code = e.target.value;
                          setSelectedSalespersonCode(code);
                          const sp = salespersonsList.find(s => s.employee_code === code);
                          if (sp) {
                            setSalesPerson(sp.employee_name);
                          } else {
                            setSalesPerson('');
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '42px',
                          borderRadius: '10px',
                          border: '1.5px solid #0E7490',
                          padding: '0 14px',
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#0F172A',
                          backgroundColor: '#ECFEFF',
                          outline: 'none',
                          boxSizing: 'border-box',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">-- Unassigned (Assign Later) --</option>
                        {salespersonsList.map(s => (
                          <option key={s.employee_code} value={s.employee_code}>
                            {s.employee_name} ({s.employee_code})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input id="performa-invoice-sales-executive" name="salesExecutive" aria-label="Sales Executive"
                        type="text"
                        readOnly
                        disabled
                        value={salesPerson || getActiveUserName()}
                        style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', fontWeight: '600', color: '#475569', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box', cursor: 'not-allowed' }}
                       />
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="performa-invoice-payment-terms" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Payment Terms
                  </label>
                  <select id="performa-invoice-payment-terms" name="paymentTerms" aria-label="Payment Terms"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <option value="100% Paid">100% Paid</option>
                    <option value="Partial Paid">Partial Paid</option>
                    <option value="Payment While Dispatch">Payment While Dispatch</option>
                    <option value="Credit Payment">Credit Payment</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 2: CUSTOMER INFORMATION & ADDRESSES (NO DELIVERY PROOF AS INSTRUCTED) */}
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                  2
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  CUSTOMER INFORMATION & ADDRESSES
                </h3>
              </div>

              {/* Row 1: Customer Contact details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div ref={customerDropdownRef} style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Company Name <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input name="orCompany" aria-label="Type or select company"
                      id="pi-field-vendorName"
                      type="text"
                      autoComplete="off"
                      placeholder="Type or select company..."
                      value={vendorName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVendorName(val);
                        setIsCustomerDropdownOpen(true);
                        const q = val.trim();
                        if (q.length >= 2) {
                          if (searchCustTimerRef.current) clearTimeout(searchCustTimerRef.current);
                          searchCustTimerRef.current = setTimeout(async () => {
                            try {
                              const matches = await searchCustomers({ query: q, limit: 50 });
                              if (Array.isArray(matches) && matches.length > 0) {
                                setCustomerList(prev => {
                                  const map = new Map();
                                  (prev || []).forEach(p => {
                                    const k = (p.customerCode || p.id || p.companyName || p.name || '').toLowerCase().trim();
                                    if (k) map.set(k, p);
                                  });
                                  matches.forEach(m => {
                                    const k = (m.customerCode || m.id || m.companyName || m.name || '').toLowerCase().trim();
                                    if (k && !map.has(k)) map.set(k, m);
                                  });
                                  return Array.from(map.values());
                                });
                              }
                            } catch (_) {}
                          }, 250);
                        }
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      onBlur={() => {
                        const clean = (vendorName || '').trim().toLowerCase();
                        if (clean) {
                          const match = (customerList || []).find(c => {
                            const cComp = (c.companyName || c.name || c.c2 || '').toLowerCase().trim();
                            return cComp === clean;
                          });
                          if (match) {
                            handleSelectCustomer(match);
                          }
                        }
                      }}
                      style={{
                        width: '100%',
                        height: '42px',
                        borderRadius: '10px',
                        border: (!vendorName?.trim() && piFormErrors?.['pi-field-vendorName']) ? '1.5px solid #EF4444' : (isCustomerDropdownOpen ? '1.5px solid #0E7490' : '1px solid #E2E8F0'),
                        padding: '0 36px 0 14px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#0F172A',
                        outline: 'none',
                        boxSizing: 'border-box',
                        backgroundColor: (!vendorName?.trim() && piFormErrors?.['pi-field-vendorName']) ? '#FEF2F2' : '#FFFFFF',
                        boxShadow: isCustomerDropdownOpen ? '0 0 0 3px rgba(14, 116, 144, 0.1)' : 'none'
                      }}
                     />
                    <button
                      type="button"
                      onClick={() => setIsCustomerDropdownOpen(prev => !prev)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748B'
                      }}
                      title="Toggle customer list"
                    >
                      <ChevronDown size={16} style={{ transform: isCustomerDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                    </button>
                  </div>

                  {/* Custom Searchable Scrollable Dropdown List with ALL 61+ Customers */}
                  {isCustomerDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      minWidth: 'min(500px, 92vw)',
                      width: 'max(100%, 500px)',
                      maxWidth: '92vw',
                      backgroundColor: '#FFFFFF',
                      borderRadius: '12px',
                      border: '1px solid #CBD5E1',
                      boxShadow: '0 14px 35px -4px rgba(0, 0, 0, 0.18), 0 6px 14px -2px rgba(0, 0, 0, 0.08)',
                      zIndex: 9999,
                      maxHeight: '380px',
                      overflowY: 'auto',
                      padding: '6px'
                    }}>
                      <div style={{
                        padding: '8px 12px',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        color: '#64748B',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '8px',
                        marginBottom: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>SHOWING {filteredCustomerSuggestions.length} OF {uniqueCustomerList.length} REGISTERED CUSTOMERS</span>
                        {vendorName && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVendorName('');
                            }}
                            style={{ border: 'none', background: 'transparent', color: '#0E7490', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px' }}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {filteredCustomerSuggestions.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                          No matching customers found for "{vendorName}". You can continue typing to use this new company.
                        </div>
                      ) : (
                        filteredCustomerSuggestions.map((c, idx) => {
                          const name = (c.companyName || c.name || c.c2 || c.code || '').trim();
                          const gst = c.gst || c.gstNumber || c.gstNo || c.gstin;
                          const contact = c.contact || c.contactPerson || c.primaryContact?.name;
                          const phone = c.phone || c.mobile || c.primaryContact?.phone;
                          const city = c.city || c.billingAddressObj?.city;
                          const isSelected = name.toLowerCase() === (vendorName || '').toLowerCase().trim();

                          return (
                            <div
                              key={idx}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectCustomer(c);
                                setIsCustomerDropdownOpen(false);
                              }}
                              onClick={() => {
                                handleSelectCustomer(c);
                                setIsCustomerDropdownOpen(false);
                              }}
                              style={{
                                padding: '10px 14px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? '#ECFEFF' : 'transparent',
                                borderLeft: isSelected ? '3px solid #0E7490' : '3px solid transparent',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'background-color 0.1s ease',
                                gap: '12px',
                                marginBottom: '2px'
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '13.5px', fontWeight: '700', color: isSelected ? '#0E7490' : '#0F172A', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.3' }}>
                                  {name}
                                </div>
                                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  {contact && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><User size={12} style={{ color: '#64748B' }} /> {contact}</span>}
                                  {phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>📞 {phone}</span>}
                                  {city && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>📍 {city}</span>}
                                </div>
                              </div>
                              {gst && (
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#0369A1', backgroundColor: '#E0F2FE', padding: '3px 8px', borderRadius: '5px', whiteSpace: 'nowrap', alignSelf: 'center' }}>
                                  GST: {gst}
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="performa-invoice-customer-name" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Customer Name
                  </label>
                  <input id="performa-invoice-customer-name" name="customerName" aria-label="Customer Name"
                    type="text"
                    placeholder="e.g. Rajesh Kannan"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                   />
                </div>

                <div>
                  <label htmlFor="pi-field-phone" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Phone Number
                  </label>
                  <input name="phoneNumber" aria-label="Phone Number"
                    id="pi-field-phone"
                    type="text"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: (!phone?.trim() && piFormErrors?.['pi-field-phone']) ? '1.5px solid #EF4444' : '1px solid #E2E8F0', backgroundColor: (!phone?.trim() && piFormErrors?.['pi-field-phone']) ? '#FEF2F2' : 'white', padding: '0 14px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                   />
                </div>

                <div>
                  <label htmlFor="performa-invoice-email-address" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input id="performa-invoice-email-address" name="emailAddress" aria-label="Email Address"
                    type="email"
                    placeholder="accounts@solarclient.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                   />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', margin: 0 }}>
                      Customer GSTIN
                    </label>
                    {Boolean(gstNo && gstNo.trim().length >= 2 && GST_STATE_MAP[gstNo.trim().substring(0, 2)]) && (
                      <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700' }}>
                        State: {GST_STATE_MAP[gstNo.trim().substring(0, 2)]}
                      </span>
                    )}
                  </div>
                  <input id="performa-invoice-33aabcv1234f1z5" name="33AABCV1234F1Z5" aria-label="33AABCV1234F1Z5"
                    type="text"
                    placeholder="e.g. 33AABCV1234F1Z5"
                    value={gstNo}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setGstNo(val);
                      if (val.trim().length >= 2) {
                        const sCode = val.trim().substring(0, 2);
                        const mappedState = GST_STATE_MAP[sCode];
                        if (mappedState && (!billingState || billingState.trim() === '')) {
                          setBillingState(mappedState);
                          if (sameAsBilling) setDeliveryState(mappedState);
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '10px',
                      border: (gstNo && gstNo.trim().length >= 2 && GST_STATE_MAP[gstNo.trim().substring(0, 2)] && billingState && billingState.trim() && GST_STATE_MAP[gstNo.trim().substring(0, 2)].toLowerCase() !== billingState.trim().toLowerCase()) ? '1.5px solid #F87171' : '1px solid #E2E8F0',
                      padding: '0 14px',
                      fontSize: '13px',
                      fontWeight: '700',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                   />
                  {Boolean(
                    gstNo && gstNo.trim().length >= 2 &&
                    GST_STATE_MAP[gstNo.trim().substring(0, 2)] &&
                    billingState && billingState.trim() &&
                    GST_STATE_MAP[gstNo.trim().substring(0, 2)].toLowerCase() !== billingState.trim().toLowerCase()
                  ) && (
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#B91C1C', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span>⚠️ GST code ({gstNo.trim().substring(0, 2)}) is for <strong>{GST_STATE_MAP[gstNo.trim().substring(0, 2)]}</strong>, but Billing State is <strong>{billingState}</strong>.</span>
                      <button
                        type="button"
                        onClick={() => {
                          const correct = GST_STATE_MAP[gstNo.trim().substring(0, 2)];
                          setBillingState(correct);
                          if (sameAsBilling) setDeliveryState(correct);
                        }}
                        style={{ backgroundColor: '#DC2626', color: 'white', border: 'none', borderRadius: '5px', padding: '3px 8px', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Sync to {GST_STATE_MAP[gstNo.trim().substring(0, 2)]}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Dual Addresses Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* Billing Address Card */}
                <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                      <Building2 size={14} color="#0E7490" />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Official Billing Address</h4>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Primary address for invoices & commercial records</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label htmlFor="pi-field-billingStreet" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Street / Premises Address</label>
                      <input name="streetPremisesAddress" aria-label="Street / Premises Address"
                        id="pi-field-billingStreet"
                        type="text"
                        placeholder="Plot No, Industrial Estate, Landmark..."
                        value={billingStreet}
                        onChange={(e) => {
                          setBillingStreet(e.target.value);
                          if (sameAsBilling) setDeliveryStreet(e.target.value);
                        }}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: (!billingStreet?.trim() && piFormErrors?.['pi-field-billingStreet']) ? '1.5px solid #EF4444' : '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: (!billingStreet?.trim() && piFormErrors?.['pi-field-billingStreet']) ? '#FEF2F2' : 'white' }}
                       />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '10px' }}>
                      <div>
                        <label htmlFor="pi-field-billingCity" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                        <input name="city" aria-label="City"
                          id="pi-field-billingCity"
                          type="text"
                          placeholder="City"
                          value={billingCity}
                          onChange={(e) => {
                            setBillingCity(e.target.value);
                            if (sameAsBilling) setDeliveryCity(e.target.value);
                          }}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: (!billingCity?.trim() && piFormErrors?.['pi-field-billingCity']) ? '1.5px solid #EF4444' : '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: (!billingCity?.trim() && piFormErrors?.['pi-field-billingCity']) ? '#FEF2F2' : 'white' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="pi-field-billingState" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                        <input name="state" aria-label="State"
                          id="pi-field-billingState"
                          type="text"
                          placeholder="State"
                          value={billingState}
                          onChange={(e) => {
                            setBillingState(e.target.value);
                            if (sameAsBilling) setDeliveryState(e.target.value);
                            if (setPiFormErrors && piFormErrors?.['pi-field-billingState']) {
                              setPiFormErrors(prev => ({ ...prev, 'pi-field-billingState': false }));
                            }
                          }}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: piFormErrors?.['pi-field-billingState'] ? '1.5px solid #EF4444' : '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: piFormErrors?.['pi-field-billingState'] ? '#FEF2F2' : 'white' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="pi-field-billingPincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>PIN Code</label>
                        <input name="pINCode" aria-label="PIN Code"
                          id="pi-field-billingPincode"
                          type="text"
                          placeholder="600001"
                          value={billingPincode}
                          onChange={(e) => {
                            setBillingPincode(e.target.value);
                            if (sameAsBilling) setDeliveryPincode(e.target.value);
                          }}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: (!billingPincode?.trim() && piFormErrors?.['pi-field-billingPincode']) ? '1.5px solid #EF4444' : '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: (!billingPincode?.trim() && piFormErrors?.['pi-field-billingPincode']) ? '#FEF2F2' : 'white' }}
                         />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Address Card */}
                <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#ECFEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490' }}>
                        <Truck size={14} color="#0E7490" />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Consignee / Delivery Site Address</h4>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>Site dispatch location</span>
                      </div>
                    </div>
                    <label htmlFor="performa-invoice-same-as-billing" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', color: '#0E7490', cursor: 'pointer', backgroundColor: '#ECFEFF', padding: '4px 10px', borderRadius: '6px', border: '1px solid #A5F3FC' }}>
                      <input id="performa-invoice-same-as-billing" name="sameAsBilling" aria-label="SameAsBilling"
                        type="checkbox"
                        checked={sameAsBilling}
                        onChange={(e) => {
                          const isSame = e.target.checked;
                          setSameAsBilling(isSame);
                          if (isSame) {
                            setDeliveryStreet(billingStreet);
                            setDeliveryCity(billingCity);
                            setDeliveryState(billingState);
                            setDeliveryPincode(billingPincode);
                          }
                        }}
                        style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                       />
                      Same as Billing Address
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label htmlFor="pi-field-deliveryStreet" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Site / Dispatch Location Address</label>
                      <input name="input2" aria-label="Site / Dispatch Location Address"
                        id="pi-field-deliveryStreet"
                        type="text"
                        disabled={sameAsBilling}
                        placeholder="Solar Project Site, Survey No, Village..."
                        value={sameAsBilling ? billingStreet : deliveryStreet}
                        onChange={(e) => setDeliveryStreet(e.target.value)}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: (!sameAsBilling && !deliveryStreet?.trim() && piFormErrors?.['pi-field-deliveryStreet']) ? '1.5px solid #EF4444' : '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: sameAsBilling ? '#F1F5F9' : ((!deliveryStreet?.trim() && piFormErrors?.['pi-field-deliveryStreet']) ? '#FEF2F2' : 'white'), cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                       />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '10px' }}>
                      <div>
                        <label htmlFor="pi-field-deliveryCity" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City / District</label>
                        <input name="cityDistrict" aria-label="City / District"
                          id="pi-field-deliveryCity"
                          type="text"
                          disabled={sameAsBilling}
                          placeholder="City"
                          value={sameAsBilling ? billingCity : deliveryCity}
                          onChange={(e) => setDeliveryCity(e.target.value)}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: (!sameAsBilling && !deliveryCity?.trim() && piFormErrors?.['pi-field-deliveryCity']) ? '1.5px solid #EF4444' : '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: sameAsBilling ? '#F1F5F9' : ((!deliveryCity?.trim() && piFormErrors?.['pi-field-deliveryCity']) ? '#FEF2F2' : 'white'), cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="performa-invoice-state" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                        <input id="performa-invoice-state" name="state" aria-label="State"
                          type="text"
                          disabled={sameAsBilling}
                          placeholder="State"
                          value={sameAsBilling ? billingState : deliveryState}
                          onChange={(e) => setDeliveryState(e.target.value)}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: sameAsBilling ? '#F1F5F9' : 'white', cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="performa-invoice-pin-code" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>PIN Code</label>
                        <input id="performa-invoice-pin-code" name="pINCode" aria-label="PIN Code"
                          type="text"
                          disabled={sameAsBilling}
                          placeholder="600001"
                          value={sameAsBilling ? billingPincode : deliveryPincode}
                          onChange={(e) => setDeliveryPincode(e.target.value)}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: sameAsBilling ? '#F1F5F9' : 'white', cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                         />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: ORDER ITEMS & BILL OF MATERIALS */}
            <div id="pi-field-items" style={{ backgroundColor: (piFormErrors?.['pi-field-items'] && piItems.length === 0) ? '#FEF2F2' : 'white', borderRadius: '16px', border: piFormErrors?.['pi-field-items'] ? '2px solid #EF4444' : '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
              {/* Section 3 Header — Clean Single Row */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px', gap: '20px', flexWrap: 'wrap', borderBottom: '1px solid #F1F5F9' }}>
                {/* Left: Badge + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: 'auto' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>3</div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ORDER ITEMS & BILL OF MATERIALS</span>
                </div>

                {/* Pack Pill */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: '#ECFEFF', padding: '0 16px', borderRadius: '20px', height: '40px', border: '1px solid #CFFAFE' }}>
                  <Layers style={{ width: '15px', height: '15px', color: '#0E7490' }} />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0E7490' }}>Pack:</span>
                </div>

                {/* Searchable Pack Selector */}
                <SearchablePresetSelector
                  value={selectedPreset}
                  activePresetsMap={activePresetsMap}
                  accentColor="#0E7490"
                  width="380px"
                  placeholder="Pick a Pack to add..."
                  groupTitleLabel="Packs"
                  emptyLabel="packs"
                  style={{ height: '40px' }}
                  onChange={(val, targetPreset) => {
                    if (val && targetPreset && targetPreset.items) {
                      handleAddPresetToOrder(val, targetPreset, 1);
                    } else if (!val) {
                      setSelectedPreset('');
                    }
                  }}
                />

                {/* Clear Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedItemIndexes.length > 0) {
                      setPiItems(prev => prev.filter((_, idx) => !selectedItemIndexes.includes(idx)));
                      setSelectedItemIndexes([]);
                    } else {
                      if (piItems.length > 0) setShowClearConfirmModal(true);
                    }
                  }}
                  title={selectedItemIndexes.length > 0 ? `Remove ${selectedItemIndexes.length} selected item(s)` : 'Clear all order items'}
                  style={{ border: 'none', backgroundColor: selectedItemIndexes.length > 0 ? '#EF4444' : '#FFE4E6', color: selectedItemIndexes.length > 0 ? 'white' : '#E11D48', width: '40px', height: '40px', borderRadius: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
                >
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>

              {/* Active Pack Badges / Pills */}
              {Object.values(presetGroups).length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '12px 24px 0 24px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>Active Packs in Order:</span>
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
                      {grp.presetName} ({grp.setCount} {grp.unit || (grp.setCount > 1 ? 'Sets' : 'Set')})
                      <button
                        type="button"
                        onClick={() => handleAddPresetItem(grp.groupId)}
                        style={{
                          border: 'none',
                          backgroundColor: '#0E7490',
                          color: '#FFFFFF',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: '700',
                          padding: '1px 6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          marginLeft: '2px'
                        }}
                        title={`Add extra item bundled into ${grp.presetName}`}
                      >
                        <Plus size={11} /> Add Item
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSubPresetModalGroup(grp.groupId);
                          setNestedSubPresetVal('');
                          setNestedSubPresetCount(1);
                        }}
                        style={{
                          border: 'none',
                          backgroundColor: '#0284C7',
                          color: '#FFFFFF',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: '800',
                          padding: '1px 7px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          marginLeft: '2px'
                        }}
                        title={`Select a second pack to nest inside ${grp.presetName}`}
                      >
                        <Layers size={11} /> + Nest Sub-Pack
                      </button>
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

              {/* Section 3 Content */}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Items Table */}
              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                <table style={{ width: '100%', minWidth: hasAnyPreset ? '1480px' : '1360px', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: '#475569', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '12px 4px', width: '38px', minWidth: '38px', textAlign: 'center', color: '#64748B' }} title="Drag handle to reorder / align products">
                        <GripVertical size={14} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                      </th>
                      <th style={{ padding: '12px 8px', width: '42px', minWidth: '42px', textAlign: 'center' }}>
                        <input id="performa-invoice-checkbox" name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
                          type="checkbox"
                          checked={piItems.length > 0 && selectedItemIndexes.length === piItems.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItemIndexes(piItems.map((_, idx) => idx));
                            } else {
                              setSelectedItemIndexes([]);
                            }
                          }}
                          style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                         />
                      </th>
                      <th style={{ padding: '12px 10px', fontWeight: '700', minWidth: '280px' }}>Product / Item <span style={{ color: '#EF4444' }}>*</span></th>
                      <th style={{ padding: '12px 8px', fontWeight: '700', width: '120px', minWidth: '120px', textAlign: 'center' }}>HSN / SAC</th>
                      <th style={{ padding: '12px 6px', fontWeight: '700', width: '95px', minWidth: '95px', textAlign: 'center' }}>UOM</th>
                      <th style={{ padding: '12px 8px', fontWeight: '700', width: '110px', minWidth: '110px', textAlign: 'center' }}>{hasAnyKwPreset ? 'Qty / kW' : 'Qty / Set'} <span style={{ color: '#EF4444' }}>*</span></th>
                      <th style={{ padding: '12px 8px', fontWeight: '700', width: '135px', minWidth: '135px', textAlign: 'center', color: '#0E7490', backgroundColor: '#ECFEFF' }}>Total Dispatch Qty</th>
                      <th style={{ padding: '12px 10px', fontWeight: '700', width: '115px', minWidth: '115px' }}>Price (₹) <span style={{ color: '#EF4444' }}>*</span></th>
                      <th style={{ padding: '12px 8px', fontWeight: '700', width: '100px', minWidth: '100px', textAlign: 'center' }}>GST Rate</th>
                      {hasAnyPreset && (
                        <th style={{ padding: '12px 10px', fontWeight: '700', width: '130px', minWidth: '130px', color: '#0E7490', backgroundColor: '#ECFEFF' }}>
                          Pack Amt (₹) <span style={{ color: '#EF4444' }}>*</span>
                        </th>
                      )}
                      <th style={{ padding: '12px 10px', fontWeight: '700', width: '115px', minWidth: '115px', textAlign: 'right' }}>Taxable (₹)</th>
                      <th style={{ padding: '12px 10px', fontWeight: '700', width: '120px', minWidth: '120px', textAlign: 'right' }}>Total (₹)</th>
                      <th style={{ padding: '12px 6px', fontWeight: '700', width: '48px', minWidth: '48px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {piItems.length === 0 ? (
                      <tr>
                        <td colSpan={hasAnyPreset ? 13 : 12} style={{ padding: '48px 16px', textAlign: 'center', color: '#94A3B8' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Boxes size={28} style={{ color: '#CBD5E1' }} />
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B' }}>No products or materials in Proforma Invoice</span>
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Select a Pack above or click "Add Product / Item" to author PI line items</span>
                          </div>
                        </td>
                      </tr>
                    ) : (() => {
                      const distinctPresetGroupIds = [];
                      piItems.forEach(it => {
                        if (it.isPresetItem && it.presetGroupId && !distinctPresetGroupIds.includes(it.presetGroupId)) {
                          distinctPresetGroupIds.push(it.presetGroupId);
                        }
                      });

                      return piItems.map((item, i) => {
                        const isChecked = selectedItemIndexes.includes(i);
                        const isPresetItem = Boolean(item.isPresetItem);
                        const groupId = item.presetGroupId;
                        const currentGroup = groupId ? (presetGroups[groupId] || { kitPrice: '', setCount: 1, presetName: item.presetName }) : null;

                        const groupIndex = groupId ? distinctPresetGroupIds.indexOf(groupId) : -1;
                        const presetNumber = groupIndex >= 0 ? groupIndex + 1 : 1;
                        const theme = groupIndex >= 0 ? getPresetTheme(groupIndex) : PRESET_THEMES[0];
                        const packBadge = `PACK ${presetNumber}`;

                        let isFirstInGroup = false;
                        let groupCount = 0;
                        let itemIndexInGroup = 0;
                        const isSub = Boolean(item.isSubPreset || item.subPresetName || item.subPresetId);
                        if (isPresetItem && groupId) {
                          const itemsInGroup = piItems.filter(it => it.presetGroupId === groupId && !it.isSubPreset && !it.subPresetName && !it.subPresetId);
                          groupCount = itemsInGroup.length;
                          isFirstInGroup = piItems.findIndex(it => it.presetGroupId === groupId) === i;
                          itemIndexInGroup = !isSub ? (itemsInGroup.findIndex(it => it === item) + 1) : 0;
                        }

                        const subItems = isSub ? piItems.filter(it => it.presetGroupId === groupId && (it.subPresetId === item.subPresetId || it.subPresetName === item.subPresetName)) : [];
                        const subGroupCount = subItems.length;
                        const itemIndexInSubGroup = isSub ? subItems.findIndex(it => it === item) + 1 : 0;

                        const customItems = piItems.filter(it => !it.isPresetItem);
                        const isFirstCustomItem = !isPresetItem && piItems.findIndex(it => !it.isPresetItem) === i;
                        const customIndex = !isPresetItem ? customItems.findIndex(it => it === item) + 1 : null;

                        const displaySNo = isPresetItem && distinctPresetGroupIds.length > 0
                          ? `${presetNumber}.${itemIndexInGroup}`
                          : (customIndex !== null ? (distinctPresetGroupIds.length > 0 ? `C.${customIndex}` : `${i + 1}`) : `${i + 1}`);

                        const q = parseFloat(item.qty) || 0;
                        const r = parseFloat(item.rate) || 0;
                        const taxable = isPresetItem ? 0 : q * r;
                        const cleanedGstStr = String(item.gstRate !== undefined && item.gstRate !== null && item.gstRate !== '' ? item.gstRate : '18%').replace('%', '').trim();
                        const gstPct = isNaN(parseFloat(cleanedGstStr)) ? 18 : parseFloat(cleanedGstStr);
                        const itemTotal = taxable + (taxable * (gstPct / 100));

                        return (
                          <React.Fragment key={i}>
                            {isFirstInGroup && (
                              <tr key={`preset-hdr-${groupId}`} style={{ backgroundColor: theme.bg, borderTop: `2.5px solid ${theme.primary}`, borderBottom: `1.5px solid ${theme.border}` }}>
                                <td colSpan={hasAnyPreset ? 13 : 12} style={{ padding: '8px 14px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        backgroundColor: theme.primary,
                                        color: '#FFFFFF',
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        letterSpacing: '0.5px'
                                      }}>
                                        {packBadge}
                                      </span>
                                      <strong style={{ fontSize: '13px', color: '#0F172A', fontWeight: '800' }}>
                                        {currentGroup?.presetName || item.presetName || 'Structure Kit'}
                                      </strong>
                                      <span style={{
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        padding: '1px 8px',
                                        borderRadius: '10px',
                                        backgroundColor: theme.tagBg,
                                        color: theme.tagText,
                                        border: `1px solid ${theme.border}`
                                      }}>
                                        Total Quantity: {currentGroup?.setCount || 1} {currentGroup?.unit === 'kW' ? 'kW' : ((currentGroup?.setCount || 1) > 1 ? 'Sets' : 'Set')} ({groupCount} components)
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                                        {(parseFloat(currentGroup?.setCount) || 1) !== 1 ? (
                                          <>Kit Rate: <strong style={{ color: '#334155' }}>₹ {Number(currentGroup?.kitPrice || 0).toLocaleString('en-IN')}</strong> / {currentGroup?.unit === 'kW' ? 'kW' : 'Set'} | Total: <strong style={{ color: theme.primary, fontSize: '12px' }}>₹ {(Number(currentGroup?.kitPrice || 0) * (parseFloat(currentGroup?.setCount) || 1)).toLocaleString('en-IN')}</strong> + {currentGroup?.gstRate || '18%'} GST</>
                                        ) : (
                                          <>Kit Amount: <strong style={{ color: theme.primary, fontSize: '12px' }}>₹ {Number(currentGroup?.kitPrice || 0).toLocaleString('en-IN')}</strong> / {currentGroup?.unit === 'kW' ? 'kW' : 'Set'} + {currentGroup?.gstRate || '18%'} GST</>
                                        )}
                                      </span>

                                      {/* Move entire preset group up / down buttons */}
                                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#FFFFFF', padding: '2px 4px', borderRadius: '6px', border: `1px solid ${theme.border}` }}>
                                        <button
                                          type="button"
                                          onClick={() => handleMovePresetGroupBlock(groupId, -1)}
                                          disabled={groupIndex === 0}
                                          style={{
                                            border: 'none',
                                            backgroundColor: 'transparent',
                                            color: groupIndex === 0 ? '#CBD5E1' : theme.primary,
                                            cursor: groupIndex === 0 ? 'not-allowed' : 'pointer',
                                            padding: '2px 5px',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '2px'
                                          }}
                                          title={`Move ${packBadge} up`}
                                        >
                                          <ChevronUp size={11} /> Move Up
                                        </button>
                                        <span style={{ color: '#E2E8F0' }}>|</span>
                                        <button
                                          type="button"
                                          onClick={() => handleMovePresetGroupBlock(groupId, 1)}
                                          disabled={groupIndex === distinctPresetGroupIds.length - 1}
                                          style={{
                                            border: 'none',
                                            backgroundColor: 'transparent',
                                            color: groupIndex === distinctPresetGroupIds.length - 1 ? '#CBD5E1' : theme.primary,
                                            cursor: groupIndex === distinctPresetGroupIds.length - 1 ? 'not-allowed' : 'pointer',
                                            padding: '2px 5px',
                                            borderRadius: '4px',
                                            fontSize: '10px',
                                            fontWeight: '700',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '2px'
                                          }}
                                          title={`Move ${packBadge} down`}
                                        >
                                          <ChevronDown size={11} /> Move Down
                                        </button>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleAddPresetItem(groupId)}
                                        style={{
                                          padding: '2px 8px',
                                          fontSize: '11px',
                                          fontWeight: '700',
                                          color: theme.primary,
                                          backgroundColor: '#FFFFFF',
                                          border: `1px solid ${theme.border}`,
                                          borderRadius: '6px',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}
                                        title={`Add component row to ${packBadge}`}
                                      >
                                        <Plus size={11} /> Add to {packBadge}
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                            {isFirstCustomItem && distinctPresetGroupIds.length > 0 && (
                              <tr key="custom-items-banner" style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #64748B', borderBottom: '1px solid #CBD5E1' }}>
                                <td colSpan={hasAnyPreset ? 13 : 12} style={{ padding: '8px 14px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: '#475569',
                                      color: '#FFFFFF',
                                      fontSize: '11px',
                                      fontWeight: '800',
                                      letterSpacing: '0.5px'
                                    }}>
                                      CUSTOM ITEMS
                                    </span>
                                    <strong style={{ fontSize: '12px', color: '#334155' }}>
                                      Additional Materials / Custom Products ({customItems.length} items)
                                    </strong>
                                  </div>
                                </td>
                              </tr>
                            )}
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
                                  handleReorderPiItem(fromIdx, i);
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
                                    : (isChecked ? '#ECFEFF' : (isPresetItem ? (groupIndex % 2 === 1 ? '#F5F3FF' : '#F0FDFA') : 'transparent'))),
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
                                      onClick={(e) => { e.stopPropagation(); handleMovePiItemStep(i, -1); }}
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
                                      onClick={(e) => { e.stopPropagation(); handleMovePiItemStep(i, 1); }}
                                      disabled={i === piItems.length - 1}
                                      style={{
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: i === piItems.length - 1 ? 'not-allowed' : 'pointer',
                                        padding: '1px',
                                        color: i === piItems.length - 1 ? '#CBD5E1' : '#64748B',
                                        lineHeight: 1
                                      }}
                                      title="Move product down"
                                    >
                                      <ChevronDown size={11} />
                                    </button>
                                  </div>
                                  {i > 0 && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleReorderPiItem(i, 0); }}
                                      style={{
                                        border: '1px solid #CBD5E1',
                                        borderRadius: '4px',
                                        background: '#F8FAFC',
                                        cursor: 'pointer',
                                        padding: '1px 4px',
                                        fontSize: '9px',
                                        fontWeight: '700',
                                        color: '#0E7490',
                                        lineHeight: 1.2
                                      }}
                                      title="Move directly to #1 (Top)"
                                    >
                                      ↑1
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td style={{
                                padding: '12px 14px',
                                textAlign: 'center',
                                borderLeft: isChecked ? '4px solid #0E7490' : (isPresetItem ? `4px solid ${theme.primary}` : '4px solid #CBD5E1')
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                  <input id="performa-invoice-checkbox" name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) setSelectedItemIndexes(prev => [...prev, i]);
                                      else setSelectedItemIndexes(prev => prev.filter(idx => idx !== i));
                                    }}
                                    style={{ accentColor: theme.primary, cursor: 'pointer' }}
                                  />
                                  <span style={{ fontSize: '10px', fontWeight: '800', color: isPresetItem ? theme.primary : '#64748B' }}>
                                    #{displaySNo}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 10px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {item.isSubPreset && (
                                    <div style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      backgroundColor: '#F0FDFA',
                                      color: '#0D9488',
                                      border: '1px solid #99F6E4',
                                      borderRadius: '4px',
                                      padding: '1px 6px',
                                      fontSize: '10.5px',
                                      fontWeight: 800,
                                      width: 'fit-content'
                                    }}>
                                      ↳ Sub-Kit: {item.subPresetName}
                                    </div>
                                  )}
                                  <TypeableProductSelect
                                    value={item.name || ''}
                                    itemsList={itemsList}
                                    placeholder="Type or select product / item..."
                                    accentColor={theme.primary}
                                    onChange={(val, matched) => {
                                      if (!matched) {
                                        const dynamicHsn = getHsnCode({ name: val, category: item.category });
                                        const isSolar5 = is5PctSolarProduct(val, item.category, dynamicHsn);
                                        setPiItems(prev => prev.map((mat, idx) => idx === i ? {
                                          ...mat,
                                          name: val,
                                          hsn: dynamicHsn,
                                          gstRate: isSolar5 ? '5%' : mat.gstRate
                                        } : mat));
                                        return;
                                      }
                                      const pName = matched.name;
                                      const pCat = matched.category || matched.description || item.category;
                                      const pCode = matched.code || matched.sku || resolveProductCode(matched) || item.code;
                                      const pHsn = matched.hsn || matched.hsn_or_sac || getHsnCode(matched || { name: pName, category: pCat });
                                      const isSolar5 = is5PctSolarProduct(pName, pCat, pHsn);
                                      let rawUom = matched.uom || matched.unit || item.uom || item.unit || 'NOS';
                                      const u = String(rawUom).trim().toUpperCase();
                                      let resolvedUom = 'NOS';
                                      if (['METER', 'METERS', 'MTR', 'MTRS', 'M'].includes(u)) resolvedUom = 'MTR';
                                      else if (['PIECES', 'PIECE', 'PCS', 'PC'].includes(u)) resolvedUom = 'PCS';
                                      else if (['SET', 'SETS'].includes(u)) resolvedUom = 'SET';
                                      else if (['KILOGRAM', 'KILOGRAMS', 'KG', 'KGS'].includes(u)) resolvedUom = 'KG';
                                      else if (['BOX', 'BOXES'].includes(u)) resolvedUom = 'BOX';
                                      else if (['PACKET', 'PACKETS', 'PKT', 'PKTS'].includes(u)) resolvedUom = 'PKT';
                                      else if (['PAIR', 'PAIRS'].includes(u)) resolvedUom = 'PAIR';
                                      else if (['LOT', 'LOTS'].includes(u)) resolvedUom = 'LOT';
                                      else if (['TON', 'TONS'].includes(u)) resolvedUom = 'TON';
                                      else if (['KW', 'KWH'].includes(u)) resolvedUom = 'KW';
                                      else if (u) resolvedUom = u;
                                      else resolvedUom = 'NOS';
                                      setPiItems(prev => prev.map((mat, idx) => idx === i ? {
                                        ...mat,
                                        code: pCode || mat.code,
                                        name: pName,
                                        rate: matched.price || matched.rate ? String(matched.price || matched.rate) : mat.rate,
                                        uom: resolvedUom,
                                        unit: resolvedUom,
                                        category: pCat,
                                        gstRate: isSolar5 ? '5%' : (mat.gstRate || '18%'),
                                        hsn: pHsn
                                      } : mat));
                                    }}
                                  />
                                  <input id={`performa-invoice-category-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`category_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Description / Technical specs"
                                    type="text"
                                    placeholder="Description / Technical specs..."
                                    value={item.category || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPiItems(prev => prev.map((mat, idx) => {
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
                                    style={{ width: '100%', height: '28px', borderRadius: '6px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '11px', color: '#64748B', outline: 'none', boxSizing: 'border-box', backgroundColor: '#F8FAFC' }}
                                  />
                                  {isPresetItem && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                      <span style={{
                                        fontSize: '10px',
                                        fontWeight: '800',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: isSub ? '#F0FDFA' : theme.tagBg,
                                        color: isSub ? '#0D9488' : theme.tagText,
                                        border: `1px solid ${isSub ? '#99F6E4' : theme.border}`,
                                        letterSpacing: '0.3px'
                                      }}>
                                        {isSub ? `↳ SUB-KIT • Component ${itemIndexInSubGroup} of ${subGroupCount}` : `${theme.badge} • Component ${itemIndexInGroup} of ${groupCount}`}
                                      </span>
                                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }} title={isSub ? item.subPresetName : (currentGroup?.presetName || item.presetName)}>
                                        {isSub ? item.subPresetName : (currentGroup?.presetName || item.presetName)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '12px 6px', textAlign: 'center' }}>
                                <input id={`performa-invoice-hsn-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`hsn_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="HSN / SAC"
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
                              <td style={{ padding: '12px 4px', textAlign: 'center', width: '105px', minWidth: '105px', whiteSpace: 'nowrap' }}>
                                {(() => {
                                  const currentUom = String(item.uom || item.unit || 'NOS').trim().toUpperCase() || 'NOS';
                                  const standardUoms = ['NOS', 'SET', 'KW', 'KG', 'MTR', 'PCS', 'BOX', 'PKT', 'PAIR', 'LOT', 'TON'];
                                  return (
                                    <select id={`performa-invoice-uom-nos-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`uomNOS_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Uom NOS"
                                      value={currentUom}
                                      onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        setPiItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, uom: val, unit: val } : mat));
                                      }}
                                      style={{
                                        width: '100%',
                                        minWidth: '95px',
                                        height: '38px',
                                        borderRadius: '8px',
                                        border: '1px solid #E2E8F0',
                                        padding: '0 6px 0 10px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        color: '#0F172A',
                                        backgroundColor: '#FFFFFF',
                                        outline: 'none',
                                        boxSizing: 'border-box',
                                        cursor: 'pointer',
                                        textAlign: 'center'
                                      }}
                                    >
                                      {!standardUoms.includes(currentUom) && (
                                        <option value={currentUom}>{currentUom}</option>
                                      )}
                                      <option value="NOS">NOS</option>
                                      <option value="SET">SET</option>
                                      <option value="KW">KW</option>
                                      <option value="KG">KG</option>
                                      <option value="MTR">MTR</option>
                                      <option value="PCS">PCS</option>
                                      <option value="BOX">BOX</option>
                                      <option value="PKT">PKT</option>
                                      <option value="PAIR">PAIR</option>
                                      <option value="LOT">LOT</option>
                                      <option value="TON">TON</option>
                                    </select>
                                  );
                                })()}
                              </td>
                               <td style={{ padding: '12px 6px', verticalAlign: 'middle' }}>
                                <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <input id={`performa-invoice-0-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`0_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="0"
                                    type="number"
                                    value={item.qty}
                                    placeholder="0"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPiItems(prev => prev.map((mat, idx) => {
                                        if (idx !== i) return mat;
                                        const mult = Math.max(0.01, parseFloat(currentGroup?.setCount) || 1);
                                        const parsedVal = parseFloat(val) || 0;
                                        return {
                                          ...mat,
                                          qty: val,
                                          baseQty: isPresetItem ? (parsedVal / mult) : mat.baseQty
                                        };
                                      }));
                                    }}
                                    style={{ width: '100%', minWidth: '88px', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '13px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', fontWeight: '700', color: '#0F172A', backgroundColor: '#FFFFFF' }}
                                  />
                                </div>
                              </td>
                              {/* Total Dispatch Quantity Column */}
                              <td style={{ padding: '12px 6px', textAlign: 'center', backgroundColor: isPresetItem ? (groupIndex % 2 === 1 ? '#F5F3FF' : '#F0FDFA') : '#F8FAFC' }}>
                                {(() => {
                                  if (!isPresetItem) {
                                    return (
                                      <span style={{ color: '#94A3B8', fontWeight: '700', fontSize: '13px' }} title="Standalone product; entered quantity is direct total quantity">—</span>
                                    );
                                  }
                                  const effectivePresetName = isSub ? item.subPresetName : (currentGroup?.presetName || item.presetName);
                                  const effectiveUnit = isSub ? (item.subUnit || item.unit || 'Sets') : (currentGroup?.unit || currentGroup?.unitType || item.unit || item.uom);
                                  const nestedSub = isSub && currentGroup?.nestedSubPresets?.find(n => (n.id === item.subPresetId || n.name === item.subPresetName));
                                  const effectiveSetCount = isSub ? (item.subSetCount || nestedSub?.setCount || 1) : (currentGroup?.setCount || 1);

                                  const isKw = isKwPreset(effectivePresetName, effectiveUnit, item);
                                  const isRail = isRailPreset(effectivePresetName, item.category, item.subPresetName, item.name);

                                  const calcDispQty = calculateTotalDispatchQty(
                                    item,
                                    effectiveSetCount,
                                    effectivePresetName,
                                    item.category,
                                    effectiveUnit
                                  );
                                  const dispVal = (item.totalDispatchQty !== undefined && item.totalDispatchQty !== null && item.totalDispatchQty !== '')
                                    ? item.totalDispatchQty
                                    : (calcDispQty || '');
                                  return (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                      <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        backgroundColor: '#FFFFFF',
                                        border: `1.5px solid ${isPresetItem ? (isSub ? '#0D9488' : theme.border) : '#0E7490'}`,
                                        borderRadius: '6px',
                                        padding: '2px 6px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                      }}>
                                        <input
                                          type="number"
                                          min="0"
                                          value={dispVal}
                                          placeholder={String(calcDispQty || 0)}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setPiItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, totalDispatchQty: val } : mat));
                                          }}
                                          style={{
                                            width: '70px',
                                            height: '28px',
                                            border: 'none',
                                            fontSize: '13px',
                                            color: isPresetItem ? (isSub ? '#0F766E' : theme.primary) : '#0E7490',
                                            fontWeight: '800',
                                            textAlign: 'center',
                                            outline: 'none',
                                            backgroundColor: 'transparent'
                                          }}
                                        />
                                        <span style={{ fontSize: '10px', color: '#64748B', fontWeight: '700' }}>
                                          {item.uom || item.unit || 'NOS'}
                                        </span>
                                      </div>
                                      {isPresetItem && (
                                        <span style={{ fontSize: '9px', color: (isKw || isRail) ? '#059669' : '#64748B', fontWeight: '600', letterSpacing: '0.2px' }}>
                                          {isKw ? 'Direct kW Qty' : (isRail ? 'Direct Rails Qty' : `Formula: ${parseFloat(item.qty) || 0} × ${effectiveSetCount}`)}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td style={{ padding: '12px 10px' }}>
                                {isPresetItem ? (
                                  <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                                ) : (
                                  <input id={`performa-invoice-0-00-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`000_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="0.00"
                                    type="number"
                                    value={item.rate}
                                    placeholder="0.00"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPiItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, rate: val } : mat));
                                    }}
                                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '13px', textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                                  />
                                )}
                              </td>
                              <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                <select id={`performa-invoice-gst-rate-18-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`gstRate18_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="GstRate 18"
                                  value={item.gstRate || (currentGroup && currentGroup.gstRate) || '18%'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPiItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, gstRate: val } : mat));
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
                                          backgroundColor: theme.bg,
                                          borderLeft: `2px solid ${theme.border}`,
                                          borderRight: `2px solid ${theme.border}`
                                        }}
                                      >
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                          <span
                                            style={{
                                              fontSize: '11px',
                                              fontWeight: '800',
                                              color: theme.primary,
                                              textAlign: 'center',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap',
                                              maxWidth: '120px',
                                              display: 'block'
                                            }}
                                            title={currentGroup?.presetName}
                                          >
                                            {packBadge}: {currentGroup?.presetName}
                                          </span>

                                          <div style={{ position: 'relative', width: '100%' }}>
                                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', fontWeight: '700', color: (!currentGroup?.kitPrice || parseFloat(currentGroup?.kitPrice) <= 0) ? '#DC2626' : theme.primary, pointerEvents: 'none' }}>₹</span>
                                            <input id="performa-invoice-0-00" name="000" aria-label="0.00"
                                              type="number"
                                              required
                                              value={currentGroup?.kitPrice || ''}
                                              placeholder="Enter Amt *"
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
                                                border: (!currentGroup?.kitPrice || parseFloat(currentGroup?.kitPrice) <= 0) ? '2px solid #EF4444' : `2px solid ${theme.border}`,
                                                padding: '0 10px 0 26px',
                                                fontSize: '15px', fontWeight: '800',
                                                color: (!currentGroup?.kitPrice || parseFloat(currentGroup?.kitPrice) <= 0) ? '#DC2626' : '#0F172A',
                                                textAlign: 'right', outline: 'none', boxSizing: 'border-box',
                                                backgroundColor: (!currentGroup?.kitPrice || parseFloat(currentGroup?.kitPrice) <= 0) ? '#FEF2F2' : 'white'
                                              }}
                                            />
                                          </div>
                                          {(!currentGroup?.kitPrice || parseFloat(currentGroup?.kitPrice) <= 0) && (
                                            <span style={{ fontSize: '10px', fontWeight: '800', color: '#EF4444', textAlign: 'center' }}>
                                              * Mandatory Amount
                                            </span>
                                          )}

                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontSize: '10.5px', color: theme.primary, fontWeight: '700' }}>
                                              {groupCount} items ×
                                            </span>
                                            <input id="performa-invoice-set-count" name="setCount" aria-label="SetCount"
                                              type="number"
                                              min="0"
                                              step={(currentGroup?.unit || 'Sets') === 'kW' ? 'any' : '1'}
                                              max="99999"
                                              value={currentGroup?.setCount !== undefined && currentGroup?.setCount !== null ? currentGroup.setCount : ''}
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
                                              style={{
                                                width: '50px', height: '26px', borderRadius: '6px',
                                                border: `1.5px solid ${theme.border}`, fontSize: '12px',
                                                fontWeight: '800', color: theme.primary, textAlign: 'center',
                                                padding: '0 2px', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box'
                                              }}
                                              title={(currentGroup?.unit || 'Sets') === 'kW' ? "Capacity in kW" : "Sets multiplier for this pack"}
                                            />
                                            <select
                                              value={currentGroup?.unit || 'Sets'}
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
                                                border: `1.5px solid ${theme.border}`, padding: '0 2px',
                                                fontSize: '11px', fontWeight: '800',
                                                color: theme.primary, backgroundColor: '#FFFFFF',
                                                outline: 'none', cursor: 'pointer'
                                              }}
                                              title="Choose unit: Sets or kW"
                                            >
                                              <option value="Sets">Sets</option>
                                              <option value="kW">kW</option>
                                            </select>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                            <span style={{ fontSize: '10px', color: theme.primary, fontWeight: '700' }}>GST:</span>
                                            <select id={`performa-invoice-gst-rate-18-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`gstRate18_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="GstRate 18"
                                              value={currentGroup?.gstRate || item.gstRate || '18%'}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                if (groupId) {
                                                  setPresetGroups(prev => ({
                                                    ...prev,
                                                    [groupId]: { ...(prev[groupId] || currentGroup), gstRate: val }
                                                  }));
                                                }
                                                setPiItems(prev => prev.map((mat, idx) =>
                                                  ((mat.presetGroupId || 'legacy_default') === groupId || idx === i)
                                                    ? { ...mat, gstRate: val }
                                                    : mat
                                                ));
                                              }}
                                              style={{
                                                height: '24px', borderRadius: '6px',
                                                border: `1.5px solid ${theme.border}`, padding: '0 4px',
                                                fontSize: '11px', fontWeight: '800',
                                                color: theme.primary, backgroundColor: '#FFFFFF',
                                                outline: 'none', cursor: 'pointer'
                                              }}
                                              title="Change GST Rate for this pack"
                                            >
                                              <option value="18%">18%</option>
                                              <option value="12%">12%</option>
                                              <option value="5%">5%</option>
                                              <option value="0%">0%</option>
                                            </select>
                                          </div>
                                          {groupId && (
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
                                                borderRadius: '4px',
                                                marginTop: '2px'
                                              }}
                                              title={`Remove entire ${currentGroup?.presetName} pack`}
                                            >
                                              Remove Pack
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  }
                                  return null;
                                } else {
                                  return (
                                    <td style={{ padding: '12px 10px', textAlign: 'center', color: '#94A3B8', fontSize: '11px' }}>
                                      —
                                    </td>
                                  );
                                }
                              })()}
                            <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '600', color: '#334155' }}>
                              {isPresetItem ? (
                                <span style={{ fontSize: '11px', color: '#94A3B8' }}>—</span>
                              ) : (
                                `₹${taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              )}
                            </td>
                            <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                              {isPresetItem ? (
                                <span style={{ fontSize: '11px', color: '#94A3B8' }}>—</span>
                              ) : (
                                `₹${itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              )}
                            </td>
                            <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveMaterialRow(i)}
                                style={{
                                  border: 'none',
                                  background: '#FEF2F2',
                                  color: '#EF4444',
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#FEE2E2';
                                  e.currentTarget.style.color = '#DC2626';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#FEF2F2';
                                  e.currentTarget.style.color = '#EF4444';
                                }}
                                title="Delete Item"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    });
                  })()}
                  </tbody>
                </table>
              </div>

              {(() => {
                const piAddBtnStyle = {
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F1F5F9',
                  color: '#1E293B',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background-color 0.15s ease'
                };
                const plusCircleIcon = (
                  <span style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: '700',
                    lineHeight: 1,
                    flexShrink: 0
                  }}>+</span>
                );
                return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleAddMaterialRow}
                  style={piAddBtnStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                >
                  {plusCircleIcon}
                  {hasAnyPreset ? 'Add Standalone Item' : 'Add Product / Item'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBulkItemSearch('');
                    setBulkCategoryFilter('All');
                    setShowBulkItemModal(true);
                  }}
                  style={piAddBtnStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  title="Select multiple products/items from catalog at once"
                >
                  {plusCircleIcon}
                  Add Bulk Items
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNewSetName(`Custom Set ${Object.keys(presetGroups || {}).length + 1}`);
                    setNewSetCount(1);
                    setNewSetPrice('');
                    setNewSetGstRate('18%');
                    setShowCreateSetModal(true);
                  }}
                  style={piAddBtnStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  title="Create a custom ad-hoc Set / Kit for this PI alone (does not alter pack dropdown)"
                >
                  {plusCircleIcon}
                  Create Set
                </button>

                {Object.values(presetGroups).map(grp => (
                  <button
                    key={grp.groupId}
                    type="button"
                    onClick={() => handleAddPresetItem(grp.groupId)}
                    style={piAddBtnStyle}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                    title={`Add extra item bundled into ${grp.presetName} (₹0 unit rate, included in single kit price)`}
                  >
                    {plusCircleIcon}
                    Add Extra Item into {grp.presetName}
                  </button>
                ))}
              </div>
                );
              })()}
            </div>
          </div>

          {/* SIDE-BY-SIDE SECTIONS: 4 (VRM OFFICIAL COMMERCIAL BANK DETAILS - LEFT) & 5 (FINANCIAL BREAKDOWN - RIGHT) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '24px', alignItems: 'start' }}>
            
            {/* SECTION 4: VRM OFFICIAL COMMERCIAL BANK DETAILS (LEFT) */}
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                  4
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  VRM OFFICIAL COMMERCIAL BANK DETAILS
                </h3>
              </div>

              {/* Structured Bank Detail Cards */}
              <div style={{ backgroundColor: '#F0FDFA', borderRadius: '12px', border: '1px solid #99F6E4', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Beneficiary Name Banner */}
                <div style={{ paddingBottom: '10px', borderBottom: '1px solid #CCFBF1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Beneficiary Account Name</div>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>VRM Structures India Private Limited</div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '6px', border: '1px solid #A7F3D0', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={13} /> Verified
                  </span>
                </div>

                {/* Bank Name & Account Type Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CCFBF1', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Bank Name</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginTop: '2px' }}>HDFC Bank</div>
                  </div>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CCFBF1', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Account Type</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginTop: '2px' }}>Current Account</div>
                  </div>
                </div>

                {/* Account Number & IFSC with Copy Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #99F6E4', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', textTransform: 'uppercase' }}>Current Account Number</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', fontFamily: 'monospace', letterSpacing: '0.5px', marginTop: '2px' }}>50200031629272</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyBankDetail('50200031629272', 'Account Number')}
                      title="Copy Account Number"
                      style={{ border: '1px solid #99F6E4', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {copiedBankField === 'Account Number' ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                    </button>
                  </div>

                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #99F6E4', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', textTransform: 'uppercase' }}>RTGS / NEFT / IFSC</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', fontFamily: 'monospace', letterSpacing: '0.5px', marginTop: '2px' }}>HDFC0007315</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyBankDetail('HDFC0007315', 'IFSC Code')}
                      title="Copy IFSC Code"
                      style={{ border: '1px solid #99F6E4', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {copiedBankField === 'IFSC Code' ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                {/* Branch Location */}
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CCFBF1', borderRadius: '8px', padding: '8px 12px', fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span><strong>Branch:</strong> VINAYAGAPURAM BRANCH</span>
                  <span style={{ color: '#0E7490', fontSize: '10px', fontWeight: '700' }}>Settlement: INR (₹)</span>
                </div>
              </div>
            </div>

            {/* SECTION 5: FINANCIAL BREAKDOWN (RIGHT) */}
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              borderTop: '4px solid #0E7490',
              boxShadow: '0 4px 10px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                      5
                    </div>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      FINANCIAL BREAKDOWN
                    </h3>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '4px 10px', borderRadius: '6px', border: '1px solid #A5F3FC' }}>
                    INR (₹) Commercial
                  </span>
                </div>

                {/* Financial Calculation Lines */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#F8FAFC', padding: '16px 18px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  {totals.kitSubtotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#4F46E5' }}>
                      <span style={{ fontWeight: '600' }}>Pack Kits Subtotal:</span>
                      <span style={{ fontWeight: '700' }}>₹{totals.kitSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                    <span>Line Items Subtotal:</span>
                    <span style={{ fontWeight: '600', color: '#0F172A' }}>₹{(totals.sub - totals.kitSubtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', color: '#0F172A', fontWeight: '700', borderTop: '1px dashed #CBD5E1', paddingTop: '8px' }}>
                    <span>Total Taxable Subtotal:</span>
                    <span>₹{totals.sub.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* Dynamic GST Tiers Breakdown - Only shown when GST > 0 */}
                  {totals.gst > 0 && (totals.gstTiers || []).length > 0 && (
                    <>
                      {totals.isIntra ? (
                        (totals.gstTiers || []).map(tier => (
                          <React.Fragment key={tier.rate}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#475569', paddingLeft: '4px' }}>
                              <span>CGST ({tier.cgstRate || (tier.rate / 2)}%){(totals.gstTiers || []).length > 1 ? ` (on ${tier.rate}% items)` : ''}:</span>
                              <span style={{ fontWeight: '600', color: '#0F172A' }}>₹{(tier.cgstAmt ?? (tier.gstAmt / 2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#475569', paddingLeft: '4px' }}>
                              <span>SGST ({tier.sgstRate || (tier.rate / 2)}%){(totals.gstTiers || []).length > 1 ? ` (on ${tier.rate}% items)` : ''}:</span>
                              <span style={{ fontWeight: '600', color: '#0F172A' }}>₹{(tier.sgstAmt ?? (tier.gstAmt / 2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </React.Fragment>
                        ))
                      ) : (
                        (totals.gstTiers || []).map(tier => (
                          <div key={tier.rate} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#475569', paddingLeft: '4px' }}>
                            <span>IGST ({tier.rate}%){(totals.gstTiers || []).length > 1 ? ` (on ${tier.rate}% items)` : ''}:</span>
                            <span style={{ fontWeight: '600', color: '#0F172A' }}>₹{tier.gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        ))
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '7px 12px', borderRadius: '8px' }}>
                        <span>Total GST Amount:</span>
                        <span>₹{totals.gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '2px solid #0E7490',
                      paddingTop: '12px',
                      marginTop: '2px'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '14.5px', fontWeight: '800', color: '#0F172A', display: 'block' }}>Grand Total (INR)</span>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Inclusive of all statutory taxes</span>
                    </div>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: '#0E7490' }}>
                      ₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>

            {/* Sticky Bottom Menu Bar Following with Scroll for Create / Edit Proforma Invoice */}
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
                  onClick={() => setPiConfirmModal('cancel')}
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
                  Back
                </button>

                <button
                  type="button"
                  onClick={triggerDraftConfirm}
                  disabled={isSubmittingPI}
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    border: '1.5px solid #0E7490',
                    backgroundColor: '#FFFFFF',
                    color: '#0E7490',
                    padding: '0 18px',
                    fontWeight: '700',
                    cursor: isSubmittingPI ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    transition: 'all 0.15s ease',
                    opacity: isSubmittingPI ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => { if (!isSubmittingPI) e.currentTarget.style.backgroundColor = '#ECFEFF'; }}
                  onMouseLeave={(e) => { if (!isSubmittingPI) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  onClick={triggerSaveConfirm}
                  disabled={isSubmittingPI}
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                    padding: '0 22px',
                    fontWeight: '800',
                    cursor: isSubmittingPI ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    transition: 'all 0.15s ease',
                    opacity: isSubmittingPI ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => { if (!isSubmittingPI) e.currentTarget.style.backgroundColor = '#059669'; }}
                  onMouseLeave={(e) => { if (!isSubmittingPI) e.currentTarget.style.backgroundColor = '#10B981'; }}
                >
                  {editIdx !== null && (piList[editIdx]?.status === 'Draft' || piList[editIdx]?.statusType === 'draft')
                    ? 'Complete & Release PI'
                    : 'Confirm PI'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Grand Total:</span>
                <strong style={{ fontSize: '15px', color: '#0E7490', fontWeight: '800' }}>
                  ₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>

          </div>
        );
      })()}
    </>
  );
}
