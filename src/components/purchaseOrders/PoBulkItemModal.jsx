import React from 'react';
import {
  Boxes,
  Search,
  Check,
  X
} from 'lucide-react';

export default function PoBulkItemModal(props) {
  const {
    showBulkItemModal,
    setShowBulkItemModal,
    bulkItemSearch,
    setBulkItemSearch,
    bulkCategoryFilter,
    setBulkCategoryFilter,
    selectedBulkItems,
    setSelectedBulkItems,
    items,
    setItems,
    showCustomAlert,
    filteredBulkCatalog  } = props;

  if (!showBulkItemModal) return null;

        const selectedCount = Object.keys(selectedBulkItems).length;
        const allFilteredSelected = filteredBulkCatalog.length > 0 && filteredBulkCatalog.every(it => selectedBulkItems[it.name]);

        const toggleSelectAll = () => {
          if (allFilteredSelected) {
            setSelectedBulkItems({});
          } else {
            const next = { ...selectedBulkItems };
            filteredBulkCatalog.forEach(it => {
              if (!next[it.name]) {
                next[it.name] = { item: it, qty: 1 };
              }
            });
            setSelectedBulkItems(next);
          }
        };

        const toggleSelectItem = (it) => {
          setSelectedBulkItems(prev => {
            const next = { ...prev };
            if (next[it.name]) {
              delete next[it.name];
            } else {
              next[it.name] = { item: it, qty: 1 };
            }
            return next;
          });
        };

        const updateItemQty = (it, newQty) => {
          const validQty = Math.max(1, Number(newQty) || 1);
          setSelectedBulkItems(prev => ({
            ...prev,
            [it.name]: { item: it, qty: validQty }
          }));
        };

        const handleConfirmBulkAdd = () => {
          const selectedKeys = Object.keys(selectedBulkItems);
          if (selectedKeys.length === 0) return;

          const itemsToAdd = selectedKeys.map(k => {
            const entry = selectedBulkItems[k];
            const it = entry.item;
            return {
              name: it.name || '',
              description: it.description || '',
              account: it.account || 'Raw Material',
              qty: Number(entry.qty) > 0 ? Number(entry.qty) : 1,
              unit: it.unit || 'MT',
              rate: Number(it.rate) || 0,
              tax: it.tax !== undefined && it.tax !== '' ? Number(it.tax) : 18
            };
          });

          setItems(prev => {
            const cleanPrev = prev.filter(p => p.name && p.name.trim() !== '');
            return [...cleanPrev, ...itemsToAdd];
          });

          setShowBulkItemModal(false);
          setSelectedBulkItems({});
          setBulkItemSearch('');
          showCustomAlert(`Added ${itemsToAdd.length} items to Purchase Order.`, 'Items Added in Bulk', 'success');
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
                      Select materials or items from your directory to insert into this Purchase Order
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
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.backgroundColor = '#E2E8F0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.backgroundColor = 'transparent'; }}
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
                    placeholder="Search items by name, SKU, or specification..."
                    style={{
                      width: '100%',
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      paddingLeft: '36px',
                      paddingRight: '12px',
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
                    {['All', 'Raw Material', 'Consumables', 'Fasteners'].map(cat => (
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
                          backgroundColor: bulkCategoryFilter === cat ? '#2563EB' : '#F1F5F9',
                          color: bulkCategoryFilter === cat ? '#FFFFFF' : '#475569',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    Showing <strong>{filteredBulkCatalog.length}</strong> items
                    {selectedCount > 0 && <span style={{ color: '#2563EB', fontWeight: '700', marginLeft: '6px' }}>({selectedCount} selected)</span>}
                  </div>
                </div>
              </div>

              {/* Items List Table Header */}
              <div style={{
                padding: '8px 20px',
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                display: 'grid',
                gridTemplateColumns: '40px 1fr 110px 120px 100px',
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
                    style={{ cursor: 'pointer', accentColor: '#2563EB' }}
                  />
                </div>
                <div>Item Name & Account</div>
                <div>Unit</div>
                <div style={{ textAlign: 'right' }}>Rate</div>
                <div style={{ textAlign: 'center' }}>Quantity</div>
              </div>

              {/* Scrollable Items List */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', padding: '0 8px' }}>
                {filteredBulkCatalog.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
                    <Boxes size={32} style={{ margin: '0 auto 8px auto', opacity: 0.5 }} />
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>No items match your search.</div>
                    <div style={{ fontSize: '11.5px', marginTop: '4px' }}>Try searching with a different term or clear the filter.</div>
                  </div>
                ) : (
                  filteredBulkCatalog.map(it => {
                    const isSelected = !!selectedBulkItems[it.name];
                    const curQty = selectedBulkItems[it.name]?.qty || 1;

                      
  return (
<div
                        key={it.id || it.name}
                        onClick={() => toggleSelectItem(it)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '40px 1fr 110px 120px 100px',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          margin: '4px 0',
                          border: isSelected ? '1px solid #BFDBFE' : '1px solid transparent',
                          backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectItem(it)}
                            style={{ cursor: 'pointer', accentColor: '#2563EB' }}
                          />
                        </div>

                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>
                            {it.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '10.5px', color: '#64748B', backgroundColor: '#F1F5F9', padding: '1px 6px', borderRadius: '4px' }}>
                              {it.account}
                            </span>
                            {it.sku && (
                              <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>
                                SKU: {it.sku}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ fontSize: '12px', color: '#475569', fontWeight: '500' }}>
                          {it.unit}
                        </div>

                        <div style={{ fontSize: '12.5px', color: '#0F172A', fontWeight: '700', textAlign: 'right' }}>
                          ₹{Number(it.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>

                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        >
                          <input
                            type="number"
                            min="1"
                            value={curQty}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateItemQty(it, val);
                            }}
                            style={{
                              width: '60px',
                              height: '28px',
                              borderRadius: '6px',
                              border: isSelected ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
                              textAlign: 'center',
                              fontSize: '12px',
                              fontWeight: '600',
                              backgroundColor: '#FFFFFF',
                              color: '#0F172A',
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F8FAFC'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12.5px', color: '#64748B' }}>
                    {selectedCount > 0 ? (
                      <>
                        <strong style={{ color: '#2563EB' }}>{selectedCount}</strong> {selectedCount === 1 ? 'item' : 'items'} selected
                      </>
                    ) : (
                      'Select one or more items above'
                    )}
                  </span>
                  {selectedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedBulkItems({})}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#EF4444',
                        fontSize: '11.5px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

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
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmBulkAdd}
                    disabled={selectedCount === 0}
                    style={{
                      height: '36px',
                      padding: '0 18px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: selectedCount === 0 ? '#94A3B8' : '#2563EB',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                      boxShadow: selectedCount === 0 ? 'none' : '0 2px 6px rgba(37, 99, 235, 0.3)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Add {selectedCount > 0 ? `${selectedCount} ` : ''}Item{selectedCount !== 1 ? 's' : ''} to PO
                  </button>
                </div>
              </div>
            </div>
          </div>
  );
}
