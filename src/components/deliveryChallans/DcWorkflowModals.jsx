import React from "react";
import {
  Boxes, CheckCircle, Clock, HelpCircle, Package, Plus, Search, Shield, Trash2, X
} from "lucide-react";

export default function DcWorkflowModals(props) {
  const {
    showBulkItemModal,
    setShowBulkItemModal,
    bulkItemSearch,
    setBulkItemSearch,
    availableInventoryItems = [],
    selectedBulkItems = {},
    setSelectedBulkItems,
    handleBulkToggle,
    handleConfirmBulkAdd,

    showDcPrefModal,
    setShowDcPrefModal,
    tempNumberMode,
    setTempNumberMode,
    tempPrefix,
    setTempPrefix,
    tempNextNum,
    setTempNextNum,
    tempManualNum,
    setTempManualNum,
    handleSaveDcPreferences,

    showReturnModal,
    setShowReturnModal,
    returnDc,
    setReturnDc,
    returnDate,
    setReturnDate,
    returnRef,
    setReturnRef,
    returnReceivedBy,
    setReturnReceivedBy,
    returnRemarks,
    setReturnRemarks,
    returnReceivedRows = [],
    handleUpdateReceivedRow,
    handleAddReceivedRow,
    handleRemoveReceivedRow,
    handleSaveReturn,
    returnSubmitting
  } = props;

  return (
    <>
      {showBulkItemModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            width: '100%',
            maxWidth: '740px',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#F8FAFC'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Boxes size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
                    Add Items in Bulk
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                    Select materials or items from your directory to insert into this Delivery Challan
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowBulkItemModal(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#94A3B8',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0 12px', height: '36px' }}>
                <Search size={15} style={{ color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Search materials or products…"
                  value={bulkItemSearch}
                  onChange={(e) => setBulkItemSearch(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#1E293B' }}
                />
              </div>
            </div>

            {/* Item List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {availableInventoryItems
                .filter(it => !bulkItemSearch || (it.name || '').toLowerCase().includes(bulkItemSearch.toLowerCase()))
                .map((it, idx) => {
                  const key = it.code || it.name || `bulk-${idx}`;
                  const isChecked = Boolean(selectedBulkItems[key]);
                  return (
                    <div
                      key={key}
                      onClick={() => handleBulkToggle(key, it)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: isChecked ? '1.5px solid #0E7490' : '1px solid #E2E8F0',
                        backgroundColor: isChecked ? '#ECFEFF' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                        />
                        <div>
                          <strong style={{ fontSize: '13px', color: '#0F172A', display: 'block' }}>{it.name}</strong>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>
                            {it.category || 'Raw Material'} | UOM: {it.unit || 'NOS'} | Rate: ₹{it.rate || 0}
                          </span>
                        </div>
                      </div>

                      {isChecked && (
                        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', color: '#475569' }}>Qty:</span>
                          <input
                            type="number"
                            min={1}
                            value={selectedBulkItems[key]?.qty || 1}
                            onChange={(e) => {
                              const v = Number(e.target.value) || 1;
                              setSelectedBulkItems(prev => ({
                                ...prev,
                                [key]: { ...prev[key], qty: v }
                              }));
                            }}
                            style={{
                              width: '60px',
                              height: '28px',
                              borderRadius: '6px',
                              border: '1px solid #0E7490',
                              textAlign: 'center',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: '#0E7490'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: '600' }}>
                {Object.keys(selectedBulkItems).length} item(s) selected
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowBulkItemModal(false)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBulkAdd}
                  disabled={Object.keys(selectedBulkItems).length === 0}
                  style={{
                    backgroundColor: Object.keys(selectedBulkItems).length === 0 ? '#94A3B8' : '#0E7490',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#FFFFFF',
                    cursor: Object.keys(selectedBulkItems).length === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Add Selected Items to DC
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: CONFIGURE DELIVERY CHALLAN# PREFERENCES (EXACT ZOHO BOOKS DESIGN) ==================== */}
      {showDcPrefModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1200,
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            width: '100%',
            maxWidth: '560px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden',
            fontFamily: 'inherit'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FFFFFF'
            }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1E293B' }}>
                Configure Delivery Challan# Preferences
              </h3>
              <button
                type="button"
                onClick={() => setShowDcPrefModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'inline-flex'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Location & Associated Series header (matching Zoho Books) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: '12px',
                paddingBottom: '12px',
                borderBottom: '1px solid #F1F5F9'
              }}>
                <div>
                  <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '600' }}>Location</span>
                  <strong style={{ fontSize: '12.5px', color: '#1E293B' }}>VRM Structures India Pvt Ltd</strong>
                </div>
                <div>
                  <span style={{ fontSize: '10.5px', color: '#64748B', display: 'block', fontWeight: '600' }}>Associated Series</span>
                  <span style={{ fontSize: '12.5px', color: '#334155', fontWeight: '600' }}>Default Transaction Series</span>
                </div>
              </div>

              {/* Explanatory text */}
              <p style={{ margin: 0, fontSize: '12.5px', color: '#334155', lineHeight: '1.5' }}>
                Your delivery challan numbers are set on auto-generate mode to save your time. Are you sure about changing this setting?
              </p>

              {/* Radio Option 1: Auto-generate */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#1E293B' }}>
                  <input
                    type="radio"
                    name="dc-number-mode"
                    value="auto"
                    checked={tempNumberMode === 'auto'}
                    onChange={() => setTempNumberMode('auto')}
                    style={{ accentColor: '#2563EB', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>Continue auto-generating delivery challan numbers</span>
                  <span title="Numbers will be incremented automatically using prefix and sequential digits." style={{ color: '#94A3B8', display: 'inline-flex', cursor: 'help' }}>
                    <HelpCircle size={13} />
                  </span>
                </label>

                {tempNumberMode === 'auto' && (
                  <div style={{ marginLeft: '24px', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Prefix</label>
                      <input
                        type="text"
                        value={tempPrefix}
                        onChange={(e) => setTempPrefix(e.target.value)}
                        placeholder="e.g. VRMS/JW/26-27/ or DC/26-27/"
                        style={{
                          height: '36px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          padding: '0 10px',
                          fontSize: '13px',
                          color: '#1E293B',
                          fontWeight: '600'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Next Number</label>
                      <input
                        type="text"
                        value={tempNextNum}
                        onChange={(e) => setTempNextNum(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="e.g. 001 or 0271"
                        style={{
                          height: '36px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          padding: '0 10px',
                          fontSize: '13px',
                          color: '#1E293B',
                          fontWeight: '600'
                        }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2', fontSize: '11.5px', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CFFAFE' }}>
                      Resulting Next Challan#: <strong>{tempPrefix}{tempNextNum}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Radio Option 2: Manual entry */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#1E293B' }}>
                  <input
                    type="radio"
                    name="dc-number-mode"
                    value="manual"
                    checked={tempNumberMode === 'manual'}
                    onChange={() => setTempNumberMode('manual')}
                    style={{ accentColor: '#2563EB', width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>Enter delivery challan numbers manually</span>
                </label>
                {tempNumberMode === 'manual' && (
                  <div style={{ marginLeft: '24px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Enter Custom Delivery Challan#</label>
                    <input
                      type="text"
                      value={tempManualNum}
                      onChange={(e) => setTempManualNum(e.target.value)}
                      placeholder="e.g. VRMS/JW/26-27/001 or DC/CUSTOM/01"
                      style={{
                        height: '36px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        padding: '0 10px',
                        fontSize: '13px',
                        color: '#1E293B',
                        fontWeight: '600'
                      }}
                    />
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748B' }}>
                      Delivery Challan# on the form will be locked to this custom value.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons (Bottom Left aligned matching Zoho Books) */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              gap: '10px',
              backgroundColor: '#FFFFFF'
            }}>
              <button
                type="button"
                onClick={handleSaveDcPreferences}
                style={{
                  height: '36px',
                  padding: '0 20px',
                  borderRadius: '6px',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  fontWeight: '600',
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowDcPrefModal(false)}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  color: '#334155',
                  fontWeight: '600',
                  fontSize: '13px',
                  border: '1px solid #CBD5E1',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: RECEIVE BACK JOB WORK GOODS ==================== */}
      {showReturnModal && returnDc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100000,
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            width: '100%',
            maxWidth: '840px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#F8FAFC'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: '#ECFEFF',
                  color: '#0E7490',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Package size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                    Receive Back Job Work Goods
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span>DC No: <strong style={{ color: '#0E7490' }}>{returnDc.dcNo || returnDc.id}</strong></span>
                    <span>•</span>
                    <span>Vendor: <strong>{returnDc.customerName || returnDc.vendor}</strong></span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setShowReturnModal(false); setReturnDc(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Row 1: Return Date | Vendor Challan | Received By */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                    Return Date <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    required
                    style={{
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      padding: '0 10px',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                    Vendor Challan
                  </label>
                  <input
                    type="text"
                    value={returnRef}
                    onChange={(e) => setReturnRef(e.target.value)}
                    placeholder="e.g. VEND-DC-881"
                    style={{
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      padding: '0 10px',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                    Received By <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={returnReceivedBy}
                    onChange={(e) => setReturnReceivedBy(e.target.value)}
                    placeholder="e.g. Ramesh"
                    required
                    style={{
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      padding: '0 10px',
                      fontSize: '13px'
                    }}
                  />
                </div>
              </div>

              {/* SECTION 1: OUTWARD MATERIAL SENT REFERENCE (JOB WORK REFERENCE) */}
              <div style={{ backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Boxes size={15} style={{ color: '#0E7490' }} />
                    <span>1. Outward Material Sent (Job Work Reference)</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Original Delivery Challan Goods Movement
                  </span>
                </div>

                <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F1F5F9', color: '#475569', borderBottom: '1px solid #CBD5E1' }}>
                        <th style={{ padding: '7px 10px', width: '45px' }}>S.No</th>
                        <th style={{ padding: '7px 10px' }}>Sent Material Description</th>
                        <th style={{ padding: '7px 10px', textAlign: 'right' }}>Sent Qty</th>
                        <th style={{ padding: '7px 10px', textAlign: 'right' }}>Already Received</th>
                        <th style={{ padding: '7px 10px', textAlign: 'right' }}>Remaining Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(returnDc?.items || []).map((it, idx) => {
                        const sentQty = Number(it.qty || it.dcQty || 1);
                        const alreadyReturned = (returnDc?.returns || []).reduce((sum, ret) => {
                          const matched = (ret.returnedItems || []).filter(r => (
                            (r.sentItemIdx !== undefined ? r.sentItemIdx === idx : r.itemIdx === idx) ||
                            r.sentItemName === it.name ||
                            r.itemName === it.name
                          ));
                          return sum + matched.reduce((s, m) => s + Number(m.returnedQty || 0), 0);
                        }, 0);
                        const remaining = Math.max(0, sentQty - alreadyReturned);

                        return (
                          <tr key={idx} style={{ borderBottom: idx === (returnDc?.items || []).length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                            <td style={{ padding: '7px 10px', color: '#64748B' }}>{idx + 1}</td>
                            <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                              {it.name || it.description}
                            </td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '600' }}>
                              {sentQty} {it.unit || ''}
                            </td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', color: '#15803D', fontWeight: '600' }}>
                              {alreadyReturned} {it.unit || ''}
                            </td>
                            <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '800', color: remaining > 0 ? '#B45309' : '#059669' }}>
                              {remaining} {it.unit || ''}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PREVIOUSLY RECEIVED CONSIGNMENTS (INWARD HISTORY) */}
              {Array.isArray(returnDc?.returns) && returnDc.returns.length > 0 && (
                <div style={{ backgroundColor: '#F0FDF4', borderRadius: '10px', border: '1px solid #86EFAC', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={15} style={{ color: '#16A34A' }} />
                      <span>Previously Received Consignments ({returnDc.returns.length})</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#15803D', fontWeight: '600' }}>
                      Recorded Inward History
                    </span>
                  </div>

                  <div style={{ border: '1px solid #BBF7D0', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#DCFCE7', color: '#166534', borderBottom: '1px solid #86EFAC' }}>
                          <th style={{ padding: '7px 10px', width: '45px' }}>S.No</th>
                          <th style={{ padding: '7px 10px', width: '110px' }}>Received Date</th>
                          <th style={{ padding: '7px 10px' }}>Product Name</th>
                          <th style={{ padding: '7px 10px', textAlign: 'right', width: '130px' }}>Received Qty</th>
                          <th style={{ padding: '7px 10px', width: '120px' }}>Received By</th>
                          <th style={{ padding: '7px 10px', width: '120px' }}>Vendor Challan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnDc.returns.flatMap((ret, rIdx) => {
                          const items = ret.returnedItems && ret.returnedItems.length > 0 ? ret.returnedItems : [ret];
                          return items.map((ri, iIdx) => (
                            <tr key={`${rIdx}-${iIdx}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '7px 10px', color: '#64748B' }}>{rIdx + 1}.{iIdx + 1}</td>
                              <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F766E', whiteSpace: 'nowrap' }}>
                                {ret.returnDate || ret.date || '—'}
                              </td>
                              <td style={{ padding: '7px 10px', fontWeight: '700', color: '#0F172A' }}>
                                {ri.receivedItemName || ri.itemName || ri.sentItemName || '—'}
                                {ri.sentItemName && ri.receivedItemName && ri.sentItemName !== ri.receivedItemName && (
                                  <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '400', display: 'block' }}>
                                    (from {ri.sentItemName})
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: '800', color: '#15803D' }}>
                                +{ri.returnedQty !== undefined ? ri.returnedQty : (ri.qty || 0)} {ri.unit || ''}
                              </td>
                              <td style={{ padding: '7px 10px', color: '#475569' }}>
                                {ret.receivedBy || '—'}
                              </td>
                              <td style={{ padding: '7px 10px', color: '#64748B', fontSize: '11px' }}>
                                {ret.vendorChallan || ret.returnRef || ret.ref || '—'}
                              </td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* SECTION 2: RECEIVED PRODUCTS (SEPARATE SECTION) */}
              <div style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1.5px solid #0E7490', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0E7490', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Package size={16} />
                      <span>2. Received Product <span style={{ color: '#EF4444' }}>*</span></span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginTop: '2px' }}>
                      Enter the finished goods or processed items received back from job work (e.g. Rod processed into Mini Rail).
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleAddReceivedRow}
                      style={{
                        backgroundColor: '#0E7490',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 2px 4px rgba(14,116,144,0.25)'
                      }}
                    >
                      <Plus size={14} /> Add Received Product
                    </button>
                  </div>
                </div>

                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ padding: '9px 10px', width: '45px' }}>S.No</th>
                        <th style={{ padding: '9px 10px' }}>
                          Received Product <span style={{ color: '#EF4444' }}>*</span>
                        </th>
                        <th style={{ padding: '9px 10px', textAlign: 'right', width: '130px' }}>
                          Received Qty <span style={{ color: '#EF4444' }}>*</span>
                        </th>
                        <th style={{ padding: '9px 10px', width: '90px' }}>Unit</th>
                        <th style={{ padding: '9px 6px', width: '32px', textAlign: 'center' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnReceivedRows.map((row, idx) => {
                        return (
                          <tr key={row.id || idx} style={{ borderBottom: idx === returnReceivedRows.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                            <td style={{ padding: '8px 10px', color: '#64748B', verticalAlign: 'middle' }}>{idx + 1}</td>

                            {/* Received Product */}
                            <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                              <input
                                type="text"
                                value={row.receivedItemName}
                                onChange={(e) => handleUpdateReceivedRow(idx, 'receivedItemName', e.target.value)}
                                placeholder="e.g. Mini Rail, Finished Goods"
                                required
                                style={{
                                  width: '100%',
                                  height: '34px',
                                  borderRadius: '6px',
                                  border: '1px solid #0E7490',
                                  padding: '0 10px',
                                  fontSize: '13px',
                                  fontWeight: '700',
                                  color: '#0F172A',
                                  backgroundColor: '#FFFFFF',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </td>

                            {/* Received Qty */}
                            <td style={{ padding: '6px 10px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={row.receivedQty}
                                onChange={(e) => handleUpdateReceivedRow(idx, 'receivedQty', Math.max(0, Number(e.target.value) || 0))}
                                style={{
                                  width: '110px',
                                  height: '34px',
                                  borderRadius: '6px',
                                  border: '1px solid #0E7490',
                                  padding: '0 8px',
                                  textAlign: 'right',
                                  fontSize: '13px',
                                  fontWeight: '700',
                                  color: '#0E7490'
                                }}
                              />
                            </td>

                            {/* Unit */}
                            <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
                              <input
                                type="text"
                                value={row.unit}
                                onChange={(e) => handleUpdateReceivedRow(idx, 'unit', e.target.value)}
                                placeholder="Unit"
                                style={{
                                  width: '80px',
                                  height: '34px',
                                  borderRadius: '6px',
                                  border: '1px solid #CBD5E1',
                                  padding: '0 8px',
                                  fontSize: '12px',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </td>

                            {/* Action (Remove row) */}
                            <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                              {returnReceivedRows.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveReceivedRow(idx)}
                                  title="Remove item"
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    color: '#94A3B8',
                                    cursor: 'pointer',
                                    padding: '4px'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks / Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                  Inspection / Quality Notes
                </label>
                <textarea
                  rows={2}
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  placeholder="e.g. Received in good order, machining completed as per drawing, zero defects observed..."
                  style={{
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    padding: '8px 10px',
                    fontSize: '12.5px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Statutory Note */}
              <div style={{
                backgroundColor: '#F8FAFC',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '11.5px',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Shield size={16} style={{ color: '#0E7490', flexShrink: 0 }} />
                <span>
                  Acknowledging this return automatically credits inventory stock back for the received quantities and sets the DC status to <strong>Partially Returned</strong> or <strong>Closed</strong>.
                </span>
              </div>
            </div>

            {/* Modal Footer with Explicit Action Buttons */}
            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              backgroundColor: '#FFFFFF',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                onClick={() => { setShowReturnModal(false); setReturnDc(null); }}
                style={{
                  height: '38px',
                  padding: '0 18px',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontWeight: '600',
                  fontSize: '13px',
                  border: '1px solid #CBD5E1',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Save as Partially Received Button */}
                <button
                  type="button"
                  onClick={() => handleSaveReturn('partial')}
                  disabled={returnSubmitting}
                  style={{
                    height: '38px',
                    padding: '0 18px',
                    borderRadius: '8px',
                    backgroundColor: '#FEF3C7',
                    color: '#92400E',
                    fontWeight: '700',
                    fontSize: '13px',
                    border: '1px solid #FDE68A',
                    cursor: returnSubmitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(217, 119, 6, 0.1)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { if (!returnSubmitting) e.currentTarget.style.backgroundColor = '#FDE68A'; }}
                  onMouseLeave={(e) => { if (!returnSubmitting) e.currentTarget.style.backgroundColor = '#FEF3C7'; }}
                >
                  <Clock size={15} />
                  {returnSubmitting ? 'Saving...' : 'Save as Partially Received'}
                </button>

                {/* Close DC Fully Button */}
                <button
                  type="button"
                  onClick={() => handleSaveReturn('full')}
                  disabled={returnSubmitting}
                  style={{
                    height: '38px',
                    padding: '0 20px',
                    borderRadius: '8px',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    fontWeight: '700',
                    fontSize: '13px',
                    border: 'none',
                    cursor: returnSubmitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(14,116,144,0.3)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { if (!returnSubmitting) e.currentTarget.style.backgroundColor = '#0891B2'; }}
                  onMouseLeave={(e) => { if (!returnSubmitting) e.currentTarget.style.backgroundColor = '#0E7490'; }}
                >
                  <CheckCircle size={15} />
                  {returnSubmitting ? 'Closing...' : 'Close DC Fully'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
