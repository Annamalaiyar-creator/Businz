import React from "react";
import { X, ShoppingCart, CheckCircle, AlertTriangle } from "lucide-react";

export default function StockItemDetailModal(props) {
  const {
    viewingStockItem,
    setViewingStockItem,
    isSalesUser,
    isDispatchUser,
    handleCreatePoFromSelectedStock,
    combinedList = []
  } = props;

  if (!viewingStockItem) return null;

  return (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10001,
                    padding: '20px'
                  }}>
                    <div style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: '16px',
                      width: '100%',
                      maxWidth: '640px',
                      maxHeight: '90vh',
                      overflowY: 'auto',
                      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                      fontFamily: "'Plus Jakarta Sans', sans-serif"
                    }}>
                      <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0F172A' }}>{viewingStockItem.item}</h3>
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#ECFEFF', color: '#0E7490', fontWeight: '700' }}>
                              {viewingStockItem.code}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontWeight: '700',
                              backgroundColor: viewingStockItem.productType === 'Finished Goods' ? '#EFF6FF' : (viewingStockItem.productType === 'Raw Material' ? '#FEF3C7' : '#FAF5FF'),
                              color: viewingStockItem.productType === 'Finished Goods' ? '#1D4ED8' : (viewingStockItem.productType === 'Raw Material' ? '#B45309' : '#7E22CE'),
                              border: `1px solid ${viewingStockItem.productType === 'Finished Goods' ? '#BFDBFE' : (viewingStockItem.productType === 'Raw Material' ? '#FDE68A' : '#E9D5FF')}`
                            }}>
                              {viewingStockItem.productType === 'Finished Goods' ? 'Finished Good' : (viewingStockItem.productType === 'Raw Material' ? 'Raw Material' : 'Accessory')}
                            </span>
                            <span style={{ fontSize: '12px', color: '#64748B' }}>
                              Category: <strong style={{ color: '#334155' }}>{viewingStockItem.category}</strong> &bull; Warehouse: <strong style={{ color: '#334155' }}>{viewingStockItem.location}</strong>
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setViewingStockItem(null)}
                          style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{
                          padding: '12px 16px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          backgroundColor: viewingStockItem.status === 'In Stock' ? '#F0FDF4' : viewingStockItem.status === 'Low Stock' ? '#FFFBEB' : '#FEF2F2',
                          border: `1px solid ${viewingStockItem.status === 'In Stock' ? '#BBF7D0' : viewingStockItem.status === 'Low Stock' ? '#FEF3C7' : '#FECACA'}`
                        }}>
                          {viewingStockItem.status === 'In Stock' ? (
                            <CheckCircle size={18} style={{ color: '#15803D' }} />
                          ) : (
                            <AlertTriangle size={18} style={{ color: viewingStockItem.status === 'Low Stock' ? '#D97706' : '#DC2626' }} />
                          )}
                          <div>
                            <strong style={{ fontSize: '13px', color: viewingStockItem.status === 'In Stock' ? '#15803D' : viewingStockItem.status === 'Low Stock' ? '#D97706' : '#DC2626' }}>
                              Status: {viewingStockItem.status}
                            </strong>
                            <div style={{ fontSize: '12px', color: '#475569' }}>
                              {viewingStockItem.status === 'In Stock'
                                ? 'Stock is currently healthy and above minimum safety buffer.'
                                : viewingStockItem.status === 'Low Stock'
                                ? 'Inventory is below the minimum reorder threshold. Replenishment recommended.'
                                : 'Inventory is completely exhausted. Immediate procurement order required.'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: isSalesUser ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '12px' }}>
                          <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Available Stock</span>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: viewingStockItem.status === 'In Stock' ? '#10B981' : viewingStockItem.status === 'Low Stock' ? '#F59E0B' : '#EF4444', marginTop: '4px' }}>
                              {viewingStockItem.stock}
                            </div>
                          </div>
                          <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Reserved (BOM/PI)</span>
                            <div style={{ fontSize: '20px', fontWeight: '800', color: '#475569', marginTop: '4px' }}>
                              {viewingStockItem.allocated}
                            </div>
                          </div>
                          {!isSalesUser && (
                            <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>Incoming (PO)</span>
                              <div style={{ fontSize: '20px', fontWeight: '800', color: '#2563EB', marginTop: '4px' }}>
                                {viewingStockItem.incoming}
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
                          {!isSalesUser && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                              <span style={{ fontSize: '13px', color: '#64748B' }}>Reorder Level (Min Buffer)</span>
                              <strong style={{ fontSize: '13px', color: '#0F172A' }}>{viewingStockItem.minLevel} NOS</strong>
                            </div>
                          )}
                          {!isSalesUser && !isDispatchUser && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                              <span style={{ fontSize: '13px', color: '#64748B' }}>Total Stock Valuation</span>
                              <strong style={{ fontSize: '13px', color: '#0F172A' }}>{viewingStockItem.val}</strong>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px' }}>
                            <span style={{ fontSize: '13px', color: '#64748B' }}>Warehouse Storage Location</span>
                            <strong style={{ fontSize: '13px', color: '#0F172A' }}>{viewingStockItem.location}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                          onClick={() => setViewingStockItem(null)}
                          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Close
                        </button>
                        {!isSalesUser && !isDispatchUser && (
                          <button
                            onClick={() => {
                              const itemKey = viewingStockItem.code || viewingStockItem.item;
                              setViewingStockItem(null);
                              handleCreatePoFromSelectedStock([itemKey], combinedList);
                            }}
                            style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#0E7490', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <ShoppingCart size={15} />
                            Create PO / Reorder Item
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
  );
}
