import React from 'react';
import { Plus, Trash2, Boxes, Layers, Tag } from 'lucide-react';
import TypeableProductSelect from '../TypeableProductSelect';
import { getHsnCode } from '../../utils/hsnCodeService';

export default function PoItemsTableSection(props) {
  const {
    items = [],
    setItems,
    presetGroups = {},
    setPresetGroups,
    deleteIdx,
    setDeleteIdx,
    availableCatalogItems = [],
    handleAddItem,
    handleRemoveItem,
    handleItemChange,
    handleAddSetItem,
    handleRemovePresetGroup,
    handleUpdateGroupKitPrice,
    setShowCreateSetModal,
    setShowBulkItemModal,
    viewMode,
    isProcurementRole,
    setNewSetName,
    setNewSetCount,
    setNewSetUnit,
    setNewSetPrice,
    setNewSetGstRate,
    setShowCreateProductModal,
    setSelectedBulkItems,
    setBulkCategoryFilter,
    setBulkItemSearch
  } = props;

  return (
    <>
              {/* 3. Items Table */}
              <div className="section-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px 0', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', margin: '0 24px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                    3
                  </div>
                  <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    LINE ITEMS
                  </h3>
                </div>

                {(() => {
                  const hasAnySet = items.some(it => Boolean(it.isPresetItem && it.presetGroupId));
                  const distinctSetGroupIds = [];
                  items.forEach(it => {
                    if (it.isPresetItem && it.presetGroupId && !distinctSetGroupIds.includes(it.presetGroupId)) {
                      distinctSetGroupIds.push(it.presetGroupId);
                    }
                  });
                  const colCount = hasAnySet ? 9 : 8;
                  return (
                <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', minWidth: '240px' }}>{hasAnySet ? 'Product / Item *' : 'Item & Description *'}</th>
                        {hasAnySet ? (
                          <th style={{ padding: '10px 8px', textAlign: 'center', width: '110px' }}>HSN / SAC</th>
                        ) : (
                          <th style={{ padding: '10px 12px', textAlign: 'left', width: '150px' }}>Account</th>
                        )}
                        <th style={{ padding: '10px 8px', textAlign: 'center', width: '85px' }}>{hasAnySet ? 'UOM' : 'Unit'}</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', width: '85px' }}>Qty *</th>
                        <th style={{ padding: '10px 10px', textAlign: 'right', width: '110px' }}>{hasAnySet ? 'Price (₹) *' : 'Rate (₹) *'}</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', width: '85px' }}>GST (%)</th>
                        {hasAnySet && (
                          <th style={{ padding: '10px 10px', textAlign: 'left', width: '130px', color: '#0E7490', backgroundColor: '#ECFEFF' }}>Pack Amt (₹) *</th>
                        )}
                        <th style={{ padding: '10px 12px', textAlign: 'right', width: '110px' }}>Amount (₹)</th>
                        <th style={{ padding: '10px 10px', textAlign: 'center', width: '50px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={colCount} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748B', fontSize: '13px', backgroundColor: '#FAFAFA' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <Boxes size={28} style={{ color: '#94A3B8' }} />
                              <div>
                                {isProcurementRole ? (
                                  <>No line items added yet. Click <strong>Add New Row</strong> or <strong>Add Items in Bulk</strong> below.</>
                                ) : (
                                  <>No line items added yet. Click <strong>Add New Row</strong>, <strong>Add Items in Bulk</strong>, or <strong>Create Set</strong> below.</>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        items.map((item, idx) => {
                          const isSetItem = Boolean(item.isPresetItem && item.presetGroupId);
                          const groupId = item.presetGroupId;
                          const grp = isSetItem ? (presetGroups[groupId] || { presetName: item.presetName || 'Custom Set', setCount: 1, unit: 'Sets', kitPrice: '', gstRate: '18%' }) : null;
                          const setGroupItems = isSetItem ? items.filter(it => it.presetGroupId === groupId) : [];
                          const isFirstInGroup = isSetItem && items.findIndex(it => it.presetGroupId === groupId) === idx;
                          const packIndex = isSetItem ? (distinctSetGroupIds.indexOf(groupId) + 1) : 0;
                          const setCount = grp ? (Number(grp.setCount) || 1) : 1;
                          const rowQty = Number(item.qty || 0);
                          const total = isSetItem ? 0 : (rowQty * (item.rate || 0));

                          return (
                            <React.Fragment key={idx}>
                              {isFirstInGroup && (
                                <tr style={{ backgroundColor: '#EFF6FF', borderTop: '2px solid #0E7490', borderBottom: '1px solid #BAE6FD' }}>
                                  <td colSpan={colCount} style={{ padding: '8px 14px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ padding: '3px 8px', borderRadius: '6px', backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' }}>
                                          PACK {packIndex}
                                        </span>
                                        <strong style={{ fontSize: '13px', color: '#0F172A', fontWeight: '800' }}>
                                          {grp?.presetName || 'Custom Set'}
                                        </strong>
                                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#E0F2FE', color: '#0369A1', border: '1px solid #BAE6FD' }}>
                                          Total Quantity: {setCount} {grp?.unit === 'kW' ? 'kW' : (setCount > 1 ? 'Sets' : 'Set')} ({setGroupItems.length} {setGroupItems.length === 1 ? 'item' : 'items'})
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '11px', color: '#475569', fontWeight: '600' }}>
                                          Kit Rate: <strong style={{ color: '#0F172A' }}>₹ {Number(grp?.kitPrice || 0).toLocaleString('en-IN')}</strong> / {grp?.unit === 'kW' ? 'kW' : 'Set'} | Total: <strong style={{ color: '#0E7490' }}>₹ {(Number(grp?.kitPrice || 0) * setCount).toLocaleString('en-IN')}</strong> + {grp?.gstRate || '18%'} GST
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleAddSetItem(groupId)}
                                          style={{ border: '1px solid #0E7490', backgroundColor: '#FFFFFF', color: '#0E7490', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                        >
                                          + Add Item
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRemovePresetGroup(groupId)}
                                          style={{ border: '1px solid #FCA5A5', backgroundColor: '#FEF2F2', color: '#DC2626', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                                        >
                                          Remove Set
                                        </button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: isSetItem ? '#F8FAFC' : '#FFFFFF' }}>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <TypeableProductSelect
                                    id={`purchase-orders-item-select-${typeof idx !== 'undefined' ? idx : 0}`}
                                    name={`poItemSelect_${typeof idx !== 'undefined' ? idx : 0}`}
                                    value={item.name || ''}
                                    itemsList={availableCatalogItems}
                                    placeholder="Type or select Item from Directory..."
                                    accentColor="#2563EB"
                                    style={{ width: '100%', minWidth: '220px', height: '34px' }}
                                    onChange={(val, matched) => {
                                      const found = matched || availableCatalogItems.find(zi => (zi.name || '').toLowerCase() === (val || '').toLowerCase());
                                      setItems(prev => (prev || []).map((it, i) => {
                                        if (i !== idx) return it;
                                        const next = { ...it, name: val };
                                        if (found) {
                                          if (!it.isPresetItem && found.rate !== undefined && found.rate !== null && Number(found.rate) > 0) {
                                            next.rate = Number(found.rate);
                                          }
                                          if (found.unit || found.uom) {
                                            next.unit = (found.unit || found.uom || 'NOS').toUpperCase();
                                          }
                                          next.hsn = found.hsn || found.hsn_or_sac || found.hsnCode || getHsnCode(found || val);
                                          if (found.account) {
                                            next.account = found.account;
                                          }
                                          if (found.tax !== undefined && found.tax !== null) {
                                            next.tax = Number(found.tax);
                                          }
                                          if (found.description && !it.description) {
                                            next.description = found.description;
                                          }
                                        } else if (val) {
                                          next.hsn = getHsnCode(val);
                                        }
                                        return next;
                                      }));
                                    }}
                                  />
                                  <textarea id={`purchase-orders-description-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`description_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Enter item description / specifications"
                                    rows={3}
                                    value={item.description || ''}
                                    onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                    placeholder="Enter item description / specifications..."
                                    style={{ width: '100%', minHeight: '64px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '6px 8px', fontSize: '12px', lineHeight: '1.4', fontFamily: 'inherit', resize: 'vertical', backgroundColor: '#f8fafc', color: '#334155', outline: 'none', boxSizing: 'border-box' }}
                                   />
                                </div>
                              </td>
                              {hasAnySet ? (
                                <td style={{ padding: '8px 8px' }}>
                                  <input
                                    type="text"
                                    value={item.hsn !== undefined && item.hsn !== '' ? item.hsn : (item.name ? getHsnCode(item) : '')}
                                    onChange={(e) => handleItemChange(idx, 'hsn', e.target.value)}
                                    placeholder={item.name ? getHsnCode(item) : 'HSN'}
                                    style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 6px', fontSize: '12px', textAlign: 'center', backgroundColor: '#FFFFFF' }}
                                  />
                                </td>
                              ) : (
                                <td style={{ padding: '8px 12px' }}>
                                  <select id={`purchase-orders-account-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`account_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Account" value={item.account} onChange={(e) => handleItemChange(idx, 'account', e.target.value)} style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 6px', fontSize: '12px' }}>
                                    <option value="Raw Materials">Raw Materials</option>
                                    <option value="Finished Goods">Finished Goods</option>
                                  </select>
                                </td>
                              )}
                              <td style={{ padding: '8px 8px' }}>
                                <select id={`purchase-orders-unit-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`unit_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Unit" value={item.unit} onChange={(e) => handleItemChange(idx, 'unit', e.target.value)} style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 4px', fontSize: '12px' }}>
                                  {item.unit && !['MT', 'KG', 'LG', 'NOS', 'PCS', 'MTR'].includes(item.unit) && (
                                    <option value={item.unit}>{item.unit}</option>
                                  )}
                                  <option value="MT">MT</option>
                                  <option value="KG">KG</option>
                                  <option value="LG">LG</option>
                                  <option value="NOS">NOS</option>
                                  <option value="PCS">PCS</option>
                                  <option value="MTR">MTR</option>
                                </select>
                              </td>
                              <td style={{ padding: '8px 8px' }}>
                                <input id={`purchase-orders-qty-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`qty_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Qty" type="number" value={item.qty} onChange={(e) => handleItemChange(idx, 'qty', e.target.value === '' ? '' : Number(e.target.value))} required style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 4px', fontSize: '12px', textAlign: 'center' }}  />
                              </td>
                              <td style={{ padding: '8px 8px' }}>
                                {isSetItem ? (
                                  <div style={{ textAlign: 'right', fontSize: '11px', fontWeight: '600', color: '#64748B', paddingRight: '6px' }}>
                                    In Pack
                                  </div>
                                ) : (
                                  <input id={`purchase-orders-rate-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`rate_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Rate" type="number" value={item.rate} onChange={(e) => handleItemChange(idx, 'rate', e.target.value === '' ? '' : Number(e.target.value))} required style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', textAlign: 'right' }}  />
                                )}
                              </td>
                              <td style={{ padding: '8px 8px' }}>
                                <select id={`purchase-orders-tax-18-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`tax18_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Tax 18"
                                  value={item.tax !== undefined && item.tax !== '' ? Number(item.tax) : 18}
                                  onChange={(e) => handleItemChange(idx, 'tax', Number(e.target.value))}
                                  style={{ width: '100%', height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 4px', fontSize: '12px' }}
                                >
                                  <option value={18}>18%</option>
                                  <option value={12}>12%</option>
                                  <option value={5}>5%</option>
                                  <option value={0}>0%</option>
                                  {item.tax !== undefined && item.tax !== '' && ![18, 12, 5, 0].includes(Number(item.tax)) && (
                                    <option value={Number(item.tax)}>{Number(item.tax)}%</option>
                                  )}
                                </select>
                              </td>
                              {hasAnySet && (
                                isSetItem ? (
                                  isFirstInGroup ? (
                                    <td rowSpan={setGroupItems.length} style={{ padding: '8px 10px', backgroundColor: '#ECFEFF', verticalAlign: 'middle', borderLeft: '1px solid #BAE6FD', minWidth: '175px' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: '800', color: '#0E7490', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '165px', display: 'block' }} title={grp?.presetName}>
                                          PACK {packIndex}: {grp?.presetName}
                                        </span>
                                        <div style={{ position: 'relative', width: '100%' }}>
                                          <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', fontWeight: '700', color: (!grp?.kitPrice || parseFloat(grp?.kitPrice) <= 0) ? '#DC2626' : '#0E7490', pointerEvents: 'none' }}>₹</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={grp?.kitPrice || ''}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => handleUpdateGroupKitPrice(groupId, e.target.value)}
                                            placeholder="Enter Amt *"
                                            style={{
                                              width: '100%',
                                              height: '36px',
                                              borderRadius: '7px',
                                              border: (!grp?.kitPrice || parseFloat(grp?.kitPrice) <= 0) ? '2px solid #EF4444' : '2px solid #0E7490',
                                              padding: '0 8px 0 22px',
                                              fontSize: '13px',
                                              fontWeight: '800',
                                              textAlign: 'right',
                                              backgroundColor: (!grp?.kitPrice || parseFloat(grp?.kitPrice) <= 0) ? '#FEF2F2' : '#FFFFFF',
                                              color: (!grp?.kitPrice || parseFloat(grp?.kitPrice) <= 0) ? '#DC2626' : '#0F172A',
                                              outline: 'none',
                                              boxSizing: 'border-box'
                                            }}
                                          />
                                        </div>
                                        {(!grp?.kitPrice || parseFloat(grp?.kitPrice) <= 0) && (
                                          <span style={{ fontSize: '10px', fontWeight: '800', color: '#EF4444', textAlign: 'center' }}>
                                            * Mandatory Amount
                                          </span>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                            {setGroupItems.length} items ×
                                          </span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            max="99999"
                                            value={grp?.setCount !== undefined && grp?.setCount !== null ? grp.setCount : ''}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                              const rawVal = e.target.value;
                                              setPresetGroups(prev => {
                                                const cur = prev[groupId];
                                                if (!cur) return prev;
                                                if (rawVal === '') return { ...prev, [groupId]: { ...cur, setCount: '' } };
                                                const parsed = parseFloat(rawVal);
                                                return { ...prev, [groupId]: { ...cur, setCount: isNaN(parsed) ? '' : Math.max(0, parsed) } };
                                              });
                                            }}
                                            style={{ width: '48px', height: '26px', borderRadius: '6px', border: '1.5px solid #BAE6FD', fontSize: '11.5px', fontWeight: '800', color: '#0E7490', textAlign: 'center', padding: '0 2px', outline: 'none', backgroundColor: '#FFFFFF', boxSizing: 'border-box' }}
                                            title="Multiplier for this pack"
                                          />
                                          <select
                                            value={grp?.unit || 'MT'}
                                            onChange={(e) => {
                                              const newUom = e.target.value;
                                              setPresetGroups(prev => {
                                                const cur = prev[groupId];
                                                if (!cur) return prev;
                                                return { ...prev, [groupId]: { ...cur, unit: newUom } };
                                              });
                                            }}
                                            style={{ height: '26px', borderRadius: '6px', border: '1.5px solid #BAE6FD', padding: '0 4px', fontSize: '11px', fontWeight: '800', color: '#0E7490', backgroundColor: '#FFFFFF', outline: 'none', cursor: 'pointer' }}
                                            title="Select Pack UOM"
                                          >
                                            {grp?.unit && !['MT', 'KG', 'LG', 'NOS', 'PCS', 'MTR'].includes(grp.unit) && (
                                              <option value={grp.unit}>{grp.unit}</option>
                                            )}
                                            <option value="MT">MT</option>
                                            <option value="KG">KG</option>
                                            <option value="LG">LG</option>
                                            <option value="NOS">NOS</option>
                                            <option value="PCS">PCS</option>
                                            <option value="MTR">MTR</option>
                                          </select>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700' }}>GST:</span>
                                            <select
                                              value={grp?.gstRate || '18%'}
                                              onChange={(e) => {
                                                const newGst = e.target.value;
                                                const taxNum = parseFloat(String(newGst).replace('%', '')) || 0;
                                                setPresetGroups(prev => {
                                                  const cur = prev[groupId];
                                                  if (!cur) return prev;
                                                  return { ...prev, [groupId]: { ...cur, gstRate: newGst } };
                                                });
                                                setItems(prev => (prev || []).map(it => it.presetGroupId === groupId ? { ...it, tax: taxNum } : it));
                                              }}
                                              style={{ height: '24px', borderRadius: '6px', border: '1.5px solid #BAE6FD', padding: '0 4px', fontSize: '11px', fontWeight: '800', color: '#0E7490', backgroundColor: '#FFFFFF', outline: 'none', cursor: 'pointer' }}
                                            >
                                              <option value="18%">18%</option>
                                              <option value="12%">12%</option>
                                              <option value="5%">5%</option>
                                              <option value="0%">0%</option>
                                            </select>
                                          </div>
                                          <span style={{ fontSize: '10px', color: '#0369A1', fontWeight: '800' }}>
                                            ₹{(Number(grp?.kitPrice || 0) * setCount).toLocaleString('en-IN')}
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                  ) : null
                                ) : (
                                  <td style={{ padding: '8px 10px', textAlign: 'center', color: '#94A3B8', fontSize: '11px' }}>—</td>
                                )
                              )}
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', color: isSetItem ? '#64748B' : '#1e293b' }}>
                                {isSetItem ? 'In Pack' : `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                              </td>
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <button type="button" onClick={() => handleRemoveItem(idx)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                                  <Trash2 style={{ width: '14px', height: '14px' }} />
                                </button>
                              </td>
                            </tr>
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                  );
                })()}

                <div style={{ margin: '14px 20px 6px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  {/* Add New Row Button (Matches Zoho Books layout) */}
                  <button
                    type="button"
                    onClick={handleAddItem}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      color: '#1E293B',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF',
                        fontSize: '14px',
                        fontWeight: '700',
                        lineHeight: 1,
                        flexShrink: 0
                      }}
                    >
                      +
                    </span>
                    Add New Row
                  </button>

                  {/* Add Items in Bulk Button (Matches Zoho Books layout) */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBulkItems({});
                      setBulkItemSearch('');
                      setBulkCategoryFilter('All');
                      setShowBulkItemModal(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      color: '#1E293B',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF',
                        fontSize: '14px',
                        fontWeight: '700',
                        lineHeight: 1,
                        flexShrink: 0
                      }}
                    >
                      +
                    </span>
                    Add Items in Bulk
                  </button>

                  {/* Add New Product Button */}
                  <button
                    type="button"
                    onClick={() => setShowCreateProductModal(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      color: '#1E293B',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#3B82F6',
                        color: '#FFFFFF',
                        fontSize: '14px',
                        fontWeight: '700',
                        lineHeight: 1,
                        flexShrink: 0
                      }}
                    >
                      +
                    </span>
                    Add New Product
                  </button>

                  {/* Create Set Button (hidden for Procurement login) */}
                  {!isProcurementRole && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewSetName(`Custom Set ${Object.keys(presetGroups || {}).length + 1}`);
                        setNewSetCount(1);
                        setNewSetUnit('MT');
                        setNewSetPrice('');
                        setNewSetGstRate('18%');
                        setShowCreateSetModal(true);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: '#F5F3FF',
                        border: '1px solid #DDD6FE',
                        borderRadius: '8px',
                        padding: '8px 16px',
                        fontSize: '13.5px',
                        fontWeight: '700',
                        color: '#6D28D9',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EDE9FE'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F5F3FF'; }}
                    >
                      <Layers size={15} />
                      Create Set
                    </button>
                  )}

                  {Object.values(presetGroups).map(grp => (
                    <button
                      key={grp.groupId}
                      type="button"
                      onClick={() => handleAddSetItem(grp.groupId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: '#ECFEFF',
                        border: '1px solid #A5F3FC',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        color: '#0E7490',
                        cursor: 'pointer'
                      }}
                    >
                      + Add Extra Item into {grp.presetName}
                    </button>
                  ))}
                </div>

              </div>

    </>
  );
}
