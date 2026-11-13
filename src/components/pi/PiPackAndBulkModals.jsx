import React, { Suspense, lazy } from 'react';
import {
  Plus, Check, Trash2, FileText, X, Search, Filter, Layers, Download, Boxes, UserCheck, FileCheck, Lock
} from 'lucide-react';
import SearchablePresetSelector from '../SearchablePresetSelector';
import { VRM_HDG_PRESETS } from '../../vrmHdgProposalPresets';

const VRMProformaInvoicePrintTemplate = lazy(() => import('../VRMProformaInvoicePrintTemplate'));

export default function PiPackAndBulkModals({ ctx }) {
  const {
    userRole,
    canonicalizeSalespersonCode,
    selectedStandaloneIndexes,
    isCeo,
    viewMode,
    printModalPi,
    setPrintModalPi,
    showTopToast,
    currentEmpName,
    showAssignPiModal,
    setShowAssignPiModal,
    assignPiTarget,
    setAssignPiTarget,
    salespersonsList,
    selectedSalespersonCode,
    setSelectedSalespersonCode,
    assignReason,
    setAssignReason,
    isAssigningPi,
    handleConfirmAssignPi,
    handlePrintTemplatePiUpdate,
    activePresetsMap,
    presetGroups,
    subPresetModalGroup,
    setSubPresetModalGroup,
    nestedSubPresetVal,
    setNestedSubPresetVal,
    nestedSubPresetCount,
    setNestedSubPresetCount,
    showConvertPresetModal,
    setShowConvertPresetModal,
    convertPresetName,
    setConvertPresetName,
    convertPresetPrice,
    setConvertPresetPrice,
    convertPresetGst,
    setConvertPresetGst,
    setSelectedItemIndexes,
    showCreateSetModal,
    setShowCreateSetModal,
    newSetName,
    setNewSetName,
    newSetCount,
    setNewSetCount,
    newSetUnit,
    setNewSetUnit,
    newSetPrice,
    setNewSetPrice,
    newSetGstRate,
    setNewSetGstRate,
    showBulkItemModal,
    setShowBulkItemModal,
    bulkItemSearch,
    setBulkItemSearch,
    selectedBulkItems,
    setSelectedBulkItems,
    bulkCategoryFilter,
    setBulkCategoryFilter,
    previewDocModal,
    setPreviewDocModal,
    piBulkCategories,
    filteredPiBulkCatalog,
    salesPerson,
    setPiItems,
    handleConvertSelectedToPreset,
    handleCreateCustomSet,
    handleAttachSubPresetToGroup
  } = ctx;

  return (
    <>
      {/* ==================== FLOATING ACTION BAR: CONVERT SELECTED TO PACK ==================== */}
      {selectedStandaloneIndexes.length > 0 && !showConvertPresetModal && (
        <div style={{
          position: 'fixed',
          bottom: (viewMode === 'create' || viewMode === 'edit') ? '84px' : '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '50px',
          boxShadow: '0 10px 30px -5px rgba(0,0,0,0.15), 0 4px 6px -2px rgba(0,0,0,0.05)',
          padding: '8px 16px',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          gap: '10px',
          zIndex: 10000,
          width: 'max-content',
          maxWidth: 'calc(100vw - 32px)'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#0E7490', backgroundColor: '#ECFEFF', padding: '4px 12px', borderRadius: '20px' }}>
            {selectedStandaloneIndexes.length} Selected
          </span>
          <button
            type="button"
            onClick={() => { setConvertPresetName(''); setConvertPresetPrice(''); setShowConvertPresetModal(true); }}
            style={{ border: 'none', backgroundColor: '#0D9488', color: '#FFFFFF', height: '34px', padding: '0 14px', borderRadius: '20px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800 }}
          >
            <Layers size={14} /> Convert to Pack
          </button>
          <button
            type="button"
            onClick={() => {
              setPiItems(prev => (prev || []).filter((_, idx) => !selectedStandaloneIndexes.includes(idx)));
              setSelectedItemIndexes([]);
            }}
            style={{ border: '1px solid #FECACA', backgroundColor: '#FEF2F2', color: '#DC2626', height: '34px', padding: '0 14px', borderRadius: '20px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800 }}
          >
            <Trash2 size={14} /> Delete
          </button>
          <button
            type="button"
            onClick={() => setSelectedItemIndexes([])}
            title="Clear selection"
            style={{ border: 'none', background: '#F1F5F9', color: '#64748B', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ==================== CONVERT STANDALONE ITEMS TO PI-ONLY PRESET ==================== */}
      {showConvertPresetModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <form onSubmit={handleConvertSelectedToPreset} style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', width: '480px', maxWidth: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid #E2E8F0' }}>
            <div style={{ padding: '18px 20px', backgroundColor: '#F0FDFA', borderBottom: '1px solid #CCFBF1', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F766E', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} color="#0D9488" /> Convert to Pack
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#0D9488' }}>
                  {selectedStandaloneIndexes.length} standalone item(s) · applies to this PI only
                </p>
              </div>
              <button type="button" onClick={() => setShowConvertPresetModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Pack Name</label>
                <input autoFocus type="text" value={convertPresetName} onChange={(e) => setConvertPresetName(e.target.value)} placeholder="e.g. Site A Fasteners Kit" style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Pack Amount (₹)</label>
                  <input type="number" min="0" value={convertPresetPrice} onChange={(e) => setConvertPresetPrice(e.target.value)} placeholder="Full pack price" style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>GST</label>
                  <select value={convertPresetGst} onChange={(e) => setConvertPresetGst(e.target.value)} style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '13px', boxSizing: 'border-box', backgroundColor: '#FFFFFF' }}>
                    <option value="0%">0%</option>
                    <option value="5%">5%</option>
                    <option value="12%">12%</option>
                    <option value="18%">18%</option>
                    <option value="28%">28%</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 20px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setShowConvertPresetModal(false)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#0D9488', color: '#FFFFFF', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}>Convert to Pack</button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== NESTED SUB-PACK MODAL (PACK INSIDE PACK) ==================== */}
      {subPresetModalGroup && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '520px',
            maxWidth: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'visible',
            border: '1px solid #E2E8F0'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '18px 20px',
              backgroundColor: '#F0FDFA',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
              borderBottom: '1px solid #CCFBF1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F766E', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} color="#0D9488" />
                  Nest Sub-Pack Kit
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#0D9488' }}>
                  Embedding inside <strong>{presetGroups[subPresetModalGroup]?.presetName || 'Primary Pack'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubPresetModalGroup(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Select Secondary Pack to Nest Inside:
                </label>
                <SearchablePresetSelector
                  value={nestedSubPresetVal}
                  activePresetsMap={activePresetsMap}
                  accentColor="#0D9488"
                  width="100%"
                  placeholder="Search and pick secondary pack to nest..."
                  groupTitleLabel="Packs"
                  emptyLabel="packs"
                  onChange={(val) => {
                    setNestedSubPresetVal(val);
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Sub-Pack Multiplier (Quantity / Sets)
                </label>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={nestedSubPresetCount}
                  onChange={(e) => setNestedSubPresetCount(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    width: '100%',
                    height: '38px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 20px',
              backgroundColor: '#F8FAFC',
              borderBottomLeftRadius: '16px',
              borderBottomRightRadius: '16px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={() => setSubPresetModalGroup(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!nestedSubPresetVal}
                onClick={() => {
                  const target = activePresetsMap?.[nestedSubPresetVal] || VRM_HDG_PRESETS?.[nestedSubPresetVal];
                  if (target) {
                    handleAttachSubPresetToGroup(subPresetModalGroup, nestedSubPresetVal, target, nestedSubPresetCount);
                  }
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: nestedSubPresetVal ? '#0D9488' : '#94A3B8',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: nestedSubPresetVal ? 'pointer' : 'not-allowed',
                  boxShadow: nestedSubPresetVal ? '0 2px 6px rgba(13, 148, 136, 0.3)' : 'none'
                }}
              >
                Bundle Inside Pack
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ADD ITEMS IN BULK MODAL (PI) ==================== */}
      {showBulkItemModal && (viewMode === 'create' || viewMode === 'edit') && (() => {
        const selectedCount = Object.keys(selectedBulkItems).length;
        const allFilteredSelected = filteredPiBulkCatalog.length > 0 && filteredPiBulkCatalog.every(it => selectedBulkItems[it.itemKey]);

        const toggleSelectAll = () => {
          if (allFilteredSelected) {
            setSelectedBulkItems(prev => {
              const next = { ...prev };
              filteredPiBulkCatalog.forEach(it => {
                delete next[it.itemKey];
              });
              return next;
            });
          } else {
            const next = { ...selectedBulkItems };
            filteredPiBulkCatalog.forEach(it => {
              if (!next[it.itemKey]) {
                next[it.itemKey] = { item: it, qty: 1 };
              }
            });
            setSelectedBulkItems(next);
          }
        };

        const toggleSelectItem = (it) => {
          setSelectedBulkItems(prev => {
            const next = { ...prev };
            if (next[it.itemKey]) {
              delete next[it.itemKey];
            } else {
              next[it.itemKey] = { item: it, qty: 1 };
            }
            return next;
          });
        };

        const updateItemQty = (it, newQty) => {
          const parsed = parseFloat(newQty);
          const validQty = !isNaN(parsed) && parsed > 0 ? parsed : 1;
          setSelectedBulkItems(prev => ({
            ...prev,
            [it.itemKey]: { item: it, qty: validQty }
          }));
        };

        const handleConfirmBulkAdd = () => {
          const selectedKeys = Object.keys(selectedBulkItems);
          if (selectedKeys.length === 0) return;

          const itemsToAdd = selectedKeys.map(k => {
            const entry = selectedBulkItems[k];
            const it = entry.item;
            const validQty = parseFloat(entry.qty) > 0 ? parseFloat(entry.qty) : 1;
            return {
              code: it.code || '',
              name: it.name || '',
              category: it.category || '',
              uom: it.uom || 'NOS',
              unit: it.uom || 'NOS',
              qty: String(validQty),
              qtyPerSet: String(validQty),
              totalDispatchQty: validQty,
              rate: String(it.rate ?? '0'),
              gstRate: it.gstRate || '18%',
              hsn: it.hsn || '73089090',
              isPresetItem: false
            };
          });

          setPiItems(prev => {
            const cleanPrev = (prev || []).filter(p => p.isPresetItem || (p.name && p.name.trim() !== ''));
            return [...cleanPrev, ...itemsToAdd];
          });

          setShowBulkItemModal(false);
          setSelectedBulkItems({});
          setBulkItemSearch('');
          showTopToast(`Added ${itemsToAdd.length} item(s) to Proforma Invoice`, 'success');
        };

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 99999,
            padding: '16px',
            boxSizing: 'border-box'
          }}>
            <div style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              width: '100%',
              maxWidth: '780px',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden'
            }}>
              {/* Modal Header */}
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
                    backgroundColor: '#ECFEFF',
                    color: '#0E7490',
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
                      Select multiple products or materials from your directory to insert into this Proforma Invoice
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

              {/* Search & Category Filter Toolbar */}
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    value={bulkItemSearch}
                    onChange={(e) => setBulkItemSearch(e.target.value)}
                    placeholder="Search products by name, code, HSN, or category..."
                    style={{
                      width: '100%',
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      paddingLeft: '36px',
                      paddingRight: '32px',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  {bulkItemSearch && (
                    <button
                      type="button"
                      onClick={() => setBulkItemSearch('')}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 'none',
                        background: 'transparent',
                        color: '#94A3B8',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {piBulkCategories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setBulkCategoryFilter(cat)}
                        style={{
                          border: 'none',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          backgroundColor: bulkCategoryFilter === cat ? '#0E7490' : '#F1F5F9',
                          color: bulkCategoryFilter === cat ? '#FFFFFF' : '#475569',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    Showing <strong>{filteredPiBulkCatalog.length}</strong> items
                    {selectedCount > 0 && <span style={{ color: '#0E7490', fontWeight: '700', marginLeft: '6px' }}>({selectedCount} selected)</span>}
                  </div>
                </div>
              </div>

              {/* Items List Table Header */}
              <div style={{
                padding: '8px 20px',
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                display: 'grid',
                gridTemplateColumns: '40px 1fr 90px 90px 100px 100px',
                alignItems: 'center',
                fontSize: '11px',
                fontWeight: '700',
                color: '#64748B',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                <div>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', accentColor: '#0E7490' }}
                  />
                </div>
                <div>Product Name & Category</div>
                <div>Unit</div>
                <div style={{ textAlign: 'right' }}>Stock</div>
                <div style={{ textAlign: 'right' }}>Rate</div>
                <div style={{ textAlign: 'center' }}>Quantity</div>
              </div>

              {/* Scrollable Items List */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px', padding: '0 8px' }}>
                {filteredPiBulkCatalog.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
                    <Boxes size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>No items match your search.</div>
                    <div style={{ fontSize: '11.5px', marginTop: '4px' }}>Try searching with a different term or clear the filter.</div>
                  </div>
                ) : (
                  filteredPiBulkCatalog.map((it) => {
                    const selEntry = selectedBulkItems[it.itemKey];
                    const isSelected = Boolean(selEntry);
                    return (
                      <div
                        key={it.itemKey}
                        onClick={() => toggleSelectItem(it)}
                        style={{
                          padding: '10px 12px',
                          margin: '4px 0',
                          borderRadius: '8px',
                          display: 'grid',
                          gridTemplateColumns: '40px 1fr 90px 90px 100px 100px',
                          alignItems: 'center',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#ECFEFF' : '#FFFFFF',
                          border: isSelected ? '1px solid #A5F3FC' : '1px solid transparent',
                          transition: 'all 0.12s ease'
                        }}
                      >
                        <div onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectItem(it)}
                            style={{ cursor: 'pointer', accentColor: '#0E7490' }}
                          />
                        </div>
                        <div style={{ minWidth: 0, paddingRight: '10px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {it.name}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            <span>{it.category}</span>
                            {it.code && <span style={{ color: '#0E7490', fontWeight: '600' }}>• {it.code}</span>}
                            <span>• HSN {it.hsn}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                          {it.uom}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: '700', textAlign: 'right', color: it.stock > 0 ? '#059669' : '#94A3B8' }}>
                          {it.stock !== null ? it.stock : '—'}
                        </div>
                        <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0F172A', textAlign: 'right' }}>
                          ₹{Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={isSelected ? selEntry.qty : ''}
                            placeholder="1"
                            disabled={!isSelected}
                            onChange={(e) => updateItemQty(it, e.target.value)}
                            style={{
                              width: '72px',
                              height: '30px',
                              borderRadius: '6px',
                              border: isSelected ? '1.5px solid #0E7490' : '1px solid #E2E8F0',
                              textAlign: 'center',
                              fontSize: '12px',
                              fontWeight: '700',
                              backgroundColor: isSelected ? '#FFFFFF' : '#F8FAFC',
                              color: isSelected ? '#0F172A' : '#94A3B8',
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '14px 20px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                  {selectedCount > 0 ? `${selectedCount} item(s) ready to add` : 'Check one or more items above'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowBulkItemModal(false)}
                    style={{
                      height: '36px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#475569',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={selectedCount === 0}
                    onClick={handleConfirmBulkAdd}
                    style={{
                      height: '36px',
                      padding: '0 18px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: selectedCount > 0 ? '#0E7490' : '#94A3B8',
                      color: '#FFFFFF',
                      fontSize: '12.5px',
                      fontWeight: '800',
                      cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Plus size={14} /> Add {selectedCount > 0 ? `${selectedCount} ` : ''}Selected Item{selectedCount === 1 ? '' : 's'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================== CREATE CUSTOM SET MODAL (THIS PI ALONE) ==================== */}
      {showCreateSetModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              width: '460px',
              maxWidth: '92vw',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    Create Custom Set / Kit
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                    Bundle products into a kit for this PI alone
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateSetModal(false)}
                style={{ border: 'none', background: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Notice badge */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '10px 12px', fontSize: '11.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={15} style={{ color: '#64748B', flexShrink: 0 }} />
              <span>This custom set exists <strong>only in this PI</strong> and will not be added to the master pack dropdown.</span>
            </div>

            <form onSubmit={handleCreateCustomSet} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Set / Kit Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="e.g. Custom 5kW Solar Kit, Special Client Bundle"
                  style={{
                    width: '100%', height: '40px', borderRadius: '8px',
                    border: '1.5px solid #CBD5E1', padding: '0 12px',
                    fontSize: '13px', fontWeight: '600', color: '#0F172A',
                    outline: 'none', boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Pricing / Capacity Unit
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setNewSetUnit('Sets')}
                    style={{
                      flex: 1, height: '36px', borderRadius: '8px',
                      border: newSetUnit === 'Sets' ? '2px solid #7C3AED' : '1.5px solid #CBD5E1',
                      backgroundColor: newSetUnit === 'Sets' ? '#F5F3FF' : '#FFFFFF',
                      color: newSetUnit === 'Sets' ? '#7C3AED' : '#475569',
                      fontWeight: '800', fontSize: '12.5px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                    }}
                  >
                    <span>Sets (Set-based)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSetUnit('kW')}
                    style={{
                      flex: 1, height: '36px', borderRadius: '8px',
                      border: newSetUnit === 'kW' ? '2px solid #7C3AED' : '1.5px solid #CBD5E1',
                      backgroundColor: newSetUnit === 'kW' ? '#F5F3FF' : '#FFFFFF',
                      color: newSetUnit === 'kW' ? '#7C3AED' : '#475569',
                      fontWeight: '800', fontSize: '12.5px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                    }}
                  >
                    <span>kW (Kilowatt Capacity)</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    {newSetUnit === 'kW' ? 'Capacity (kW)' : 'Number of Sets'}
                  </label>
                  <input
                    type="number"
                    min={newSetUnit === 'kW' ? '0.01' : '1'}
                    step={newSetUnit === 'kW' ? 'any' : '1'}
                    max="99999"
                    value={newSetCount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setNewSetCount('');
                        return;
                      }
                      setNewSetCount(newSetUnit === 'kW' ? (parseFloat(val) || '') : (parseInt(val) || ''));
                    }}
                    placeholder={newSetUnit === 'kW' ? 'e.g. 50 or 10.5' : '1'}
                    style={{
                      width: '100%', height: '40px', borderRadius: '8px',
                      border: '1.5px solid #CBD5E1', padding: '0 12px',
                      fontSize: '13px', fontWeight: '700', color: '#0F172A',
                      outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    GST Rate
                  </label>
                  <select
                    value={newSetGstRate}
                    onChange={(e) => setNewSetGstRate(e.target.value)}
                    style={{
                      width: '100%', height: '40px', borderRadius: '8px',
                      border: '1.5px solid #CBD5E1', padding: '0 10px',
                      fontSize: '13px', fontWeight: '700', color: '#0F172A',
                      outline: 'none', boxSizing: 'border-box', backgroundColor: 'white'
                    }}
                  >
                    <option value="18%">18%</option>
                    <option value="12%">12%</option>
                    <option value="5%">5%</option>
                    <option value="0%">0%</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  {newSetUnit === 'kW' ? 'Rate per kW (₹)' : 'Kit / Set Lump-Sum Price (₹)'} <span style={{ fontSize: '11px', fontWeight: '400', color: '#64748B' }}>(Optional, can set in table)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: '#64748B' }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={newSetPrice}
                    onChange={(e) => setNewSetPrice(e.target.value)}
                    placeholder={newSetUnit === 'kW' ? 'Enter rate per 1 kW' : 'Enter total taxable price for 1 set'}
                    style={{
                      width: '100%', height: '40px', borderRadius: '8px',
                      border: '1.5px solid #CBD5E1', padding: '0 12px 0 28px',
                      fontSize: '13px', fontWeight: '700', color: '#0F172A',
                      outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateSetModal(false)}
                  style={{
                    padding: '9px 18px', borderRadius: '8px',
                    backgroundColor: '#FFFFFF', color: '#475569',
                    border: '1px solid #CBD5E1', fontSize: '13px',
                    fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 20px', borderRadius: '8px',
                    backgroundColor: '#7C3AED', color: 'white',
                    border: 'none', fontSize: '13px',
                    fontWeight: '800', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 2px 6px rgba(124, 58, 237, 0.3)'
                  }}
                >
                  <Layers size={15} />
                  Create Set & Add Items
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== SIGNED DOCUMENT PREVIEW MODAL ==================== */}
      {previewDocModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1001
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #CBD5E1',
              width: '560px',
              maxHeight: '85vh',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileCheck size={18} color="#0E7490" />
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>{previewDocModal.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDocModal(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'auto', maxHeight: 'calc(85vh - 70px)' }}>
              {previewDocModal.dataUrl && previewDocModal.dataUrl.startsWith('data:image') ? (
                <img
                  src={previewDocModal.dataUrl}
                  alt={previewDocModal.name}
                  style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <FileText size={48} color="#0E7490" />
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{previewDocModal.name}</span>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>PDF document cached safely in offline local storage</span>
                  {previewDocModal.dataUrl && (
                    <a
                      href={previewDocModal.dataUrl}
                      download={previewDocModal.name}
                      style={{ marginTop: '8px', padding: '8px 16px', backgroundColor: '#0E7490', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '700' }}
                    >
                      Download Attached File
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== ASSIGN / REASSIGN PROFORMA INVOICE MODAL ==================== */}
      {showAssignPiModal && assignPiTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px'
          }}
          onClick={() => {
            if (!isAssigningPi) {
              setShowAssignPiModal(false);
              setAssignPiTarget(null);
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #E2E8F0',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    Assign Proforma Invoice
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    {assignPiTarget.piNo || assignPiTarget.id} · {assignPiTarget.vendor || assignPiTarget.customerName || 'Customer'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isAssigningPi) {
                    setShowAssignPiModal(false);
                    setAssignPiTarget(null);
                  }
                }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Order Summary Strip */}
              <div style={{ backgroundColor: '#F0FDFA', border: '1px solid #CCFBF1', borderRadius: '12px', padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: '#0F766E', display: 'block', fontSize: '11px', fontWeight: '700' }}>Current Assigned Rep</span>
                  <strong style={{ color: '#0F172A' }}>
                    {assignPiTarget.salesPerson || assignPiTarget.salesperson || assignPiTarget.createdBy || 'Unassigned / Direct'}
                  </strong>
                  {assignPiTarget.salesPersonCode && (
                    <span style={{ color: '#64748B', display: 'block', fontSize: '10.5px' }}>({canonicalizeSalespersonCode(assignPiTarget.salesPersonCode, assignPiTarget.salesPerson)})</span>
                  )}
                </div>
                <div>
                  <span style={{ color: '#0F766E', display: 'block', fontSize: '11px', fontWeight: '700' }}>PI Grand Total</span>
                  <strong style={{ color: '#0E7490', fontSize: '14px' }}>
                    ₹ {Number(assignPiTarget.grandTotal || assignPiTarget.totalAmount || assignPiTarget.subTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              {/* Target Salesperson Select */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Assign To Sales Executive <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={selectedSalespersonCode}
                  onChange={(e) => setSelectedSalespersonCode(e.target.value)}
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '13px',
                    color: '#0F172A',
                    fontWeight: '600',
                    outline: 'none',
                    backgroundColor: '#FFFFFF'
                  }}
                >
                  <option value="">— Select Sales Executive —</option>
                  {salespersonsList.map((sp) => (
                    <option key={sp.employee_code} value={sp.employee_code}>
                      {sp.employee_name} ({sp.employee_code}) — {sp.role || 'Sales Executive'}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                  The selected sales executive will immediately see this PI in their Sales login and can convert it to a BOM Order.
                </span>
              </div>

              {/* Reason / Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Assignment Note / Instructions (Optional)
                </label>
                <textarea
                  rows={3}
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder="e.g. Lead inquiry verified by Tech Support, kindly follow up with client and convert to BOM..."
                  style={{
                    width: '100%',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    padding: '10px 12px',
                    fontSize: '12.5px',
                    color: '#0F172A',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Audit trail indicator */}
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 12px', fontSize: '11px', color: '#64748B', lineHeight: '1.5' }}>
                <span style={{ fontWeight: '700', color: '#0F172A' }}>Permanent Audit Rule:</span> Your name (<strong>{currentEmpName || userRole || 'Tech Support'}</strong>) will be recorded permanently in the Proforma Invoice history.
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: '#F8FAFC' }}>
              <button
                type="button"
                disabled={isAssigningPi}
                onClick={() => {
                  setShowAssignPiModal(false);
                  setAssignPiTarget(null);
                }}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isAssigningPi ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAssigningPi || !selectedSalespersonCode}
                onClick={handleConfirmAssignPi}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: (!isAssigningPi && selectedSalespersonCode) ? '#0E7490' : '#94A3B8',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: (!isAssigningPi && selectedSalespersonCode) ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: (!isAssigningPi && selectedSalespersonCode) ? '0 2px 6px rgba(14,116,144,0.3)' : 'none'
                }}
              >
                {isAssigningPi ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== OFFICIAL PROFORMA INVOICE PRINT & PDF TEMPLATE ==================== */}
      {printModalPi && (
        <Suspense fallback={null}>
          <VRMProformaInvoicePrintTemplate
            piData={printModalPi}
            onClose={() => setPrintModalPi(null)}
            onSavePi={handlePrintTemplatePiUpdate}
            userRole={userRole}
            isCeo={isCeo}
            readOnly={isCeo}
          />
        </Suspense>
      )}
    </>
  );
}
