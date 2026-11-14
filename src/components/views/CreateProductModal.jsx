import React, { useState } from 'react';
import { X, Check, Boxes, Package, ShieldCheck } from 'lucide-react';
import { centralInventoryStore } from '../../utils/centralInventoryStore';
import { saveCloudStore } from '../../utils/supabaseDataSync';

export default function CreateProductModal({ isOpen, onClose, onProductCreated, defaultCategory = 'Raw Material' }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState(defaultCategory); // 'Raw Material' or 'Finished Goods'
  const [unit, setUnit] = useState(defaultCategory === 'Raw Material' ? 'MT' : 'NOS');
  const [purchaseRate, setPurchaseRate] = useState('');
  const [salesRate, setSalesRate] = useState('');
  const [hsn, setHsn] = useState('73089090');
  const [tax, setTax] = useState('18');
  const [openingStock, setOpeningStock] = useState('0');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter the Product Name.');
      return;
    }

    setIsSubmitting(true);

    try {
      const generatedCode = code.trim() || `${category === 'Raw Material' ? 'RM' : 'FG'}-${Date.now().toString().slice(-6)}`;
      const cleanRate = Number(salesRate) || Number(purchaseRate) || 0;
      const cleanPurchaseRate = Number(purchaseRate) || 0;
      const cleanStock = Number(openingStock) || 0;
      const cleanUnit = (unit || 'NOS').toUpperCase();

      const itemPayload = {
        name: trimmedName,
        code: generatedCode,
        sku: generatedCode,
        rate: cleanRate,
        price: cleanRate,
        purchaseRate: cleanPurchaseRate,
        unit: cleanUnit,
        uom: cleanUnit,
        category: category,
        cat: category,
        productType: 'goods',
        status: 'Active',
        hsn: hsn.trim() || '73089090',
        tax: Number(tax) || 18,
        description: description.trim() || trimmedName,
        stock: cleanStock,
        openingStock: cleanStock,
        physicalStock: cleanStock,
        availableStock: cleanStock,
        available: cleanStock,
        createdAt: new Date().toISOString()
      };

      // 1. Post to backend /api/items with session headers
      try {
        const sessionId = localStorage.getItem('controlroom_active_session_id') || localStorage.getItem('businz_active_session_id') || '';
        const userRole = localStorage.getItem('controlroom_user_role') || localStorage.getItem('businz_user_role') || 'procurement';
        const headers = { 'Content-Type': 'application/json' };
        if (sessionId) headers['x-session-id'] = sessionId;
        if (userRole) headers['x-user-role'] = userRole;

        const res = await fetch('/api/items', {
          method: 'POST',
          headers,
          body: JSON.stringify(itemPayload)
        });

        if (res.ok) {
          const resData = await res.json().catch(() => ({}));
          if (resData.item) {
            itemPayload.id = resData.item.id || resData.item.itemId || itemPayload.code;
            itemPayload.itemId = itemPayload.id;
          }
        }
      } catch (netErr) {
        console.warn('[CreateProductModal] Backend sync notice:', netErr.message);
      }

      // 2. Register into Central Inventory Store
      try {
        centralInventoryStore.registerItem(itemPayload, true, true);
      } catch (invErr) {
        console.warn('[CreateProductModal] Central Inventory notice:', invErr.message);
      }

      // 3. Update local controlroom_item_store cache
      try {
        const rawStore = localStorage.getItem('controlroom_item_store') || localStorage.getItem('item_store') || '[]';
        const currentList = JSON.parse(rawStore);
        const filtered = Array.isArray(currentList) ? currentList.filter(i => {
          const ic = String(i.code || i.sku || i.itemId || '').toLowerCase().trim();
          const iname = String(i.name || '').toLowerCase().trim();
          return ic !== itemPayload.code.toLowerCase() && iname !== itemPayload.name.toLowerCase();
        }) : [];
        const updatedList = [itemPayload, ...filtered];
        localStorage.setItem('controlroom_item_store', JSON.stringify(updatedList));
        saveCloudStore('item_store', updatedList);
      } catch (_) {}

      // 4. Dispatch live synchronization events across BUSINZ
      try {
        window.dispatchEvent(new CustomEvent('controlroom_items_update', { detail: { item: itemPayload } }));
        window.dispatchEvent(new CustomEvent('central_inventory_updated', { detail: { item: itemPayload } }));
      } catch (_) {}

      // 5. Notify parent callback
      if (typeof onProductCreated === 'function') {
        onProductCreated(itemPayload);
      }

      onClose();
    } catch (err) {
      console.error('[CreateProductModal] Error saving product:', err);
      setError(err.message || 'Failed to save product. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.25)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header (Zoho Books Style) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid #F1F5F9',
            backgroundColor: '#F8FAFC'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: '#ECFEFF',
                color: '#0E7490',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Boxes size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
                New Product
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                Create and sync directly with Item Directory and Central Inventory
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#0F172A'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Error Banner */}
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FEE2E2',
                  borderRadius: '8px',
                  color: '#991B1B',
                  fontSize: '12.5px',
                  fontWeight: '500'
                }}
              >
                {error}
              </div>
            )}

            {/* 1. Item Classification (Sleek Zoho Style Radio Switcher) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px'
              }}
            >
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#334155' }}>
                Item Type <span style={{ color: '#EF4444' }}>*</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: category === 'Raw Material' ? '700' : '500',
                    color: category === 'Raw Material' ? '#0E7490' : '#475569'
                  }}
                >
                  <input
                    type="radio"
                    name="productCategory"
                    value="Raw Material"
                    checked={category === 'Raw Material'}
                    onChange={() => {
                      setCategory('Raw Material');
                      if (unit === 'NOS') setUnit('MT');
                    }}
                    style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                  />
                  <span>Raw Material</span>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 'normal' }}>
                    (Coils, Sheets, Fasteners)
                  </span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: category === 'Finished Goods' ? '700' : '500',
                    color: category === 'Finished Goods' ? '#0E7490' : '#475569'
                  }}
                >
                  <input
                    type="radio"
                    name="productCategory"
                    value="Finished Goods"
                    checked={category === 'Finished Goods'}
                    onChange={() => {
                      setCategory('Finished Goods');
                      if (unit === 'MT') setUnit('NOS');
                    }}
                    style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                  />
                  <span>Finished Goods</span>
                  <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 'normal' }}>
                    (Structures, Solar MMS)
                  </span>
                </label>
              </div>
            </div>

            {/* 2. Primary Information */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                  Item Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. GI Steel Coil 2mm / Solar MMS Kit"
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '13px',
                    color: '#0F172A',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#0E7490'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                  SKU / Item Code <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 'normal' }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={`Auto (${category === 'Raw Material' ? 'RM' : 'FG'}-...)`}
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '13px',
                    color: '#0F172A',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#0E7490'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; }}
                />
              </div>
            </div>

            {/* 3. Measurement & Tax Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                  Unit of Measurement <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 10px',
                    fontSize: '13px',
                    color: '#0F172A',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="MT">MT (Metric Tonnes)</option>
                  <option value="NOS">NOS (Numbers)</option>
                  <option value="KG">KG (Kilograms)</option>
                  <option value="SET">SET (Sets)</option>
                  <option value="MTR">MTR (Meters)</option>
                  <option value="LG">LG (Length)</option>
                  <option value="SQM">SQM (Square Meters)</option>
                  <option value="PKT">PKT (Packets)</option>
                  <option value="BOX">BOX (Boxes)</option>
                  <option value="LTR">LTR (Litres)</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                  HSN / SAC Code
                </label>
                <input
                  type="text"
                  value={hsn}
                  onChange={(e) => setHsn(e.target.value)}
                  placeholder="73089090"
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 12px',
                    fontSize: '13px',
                    color: '#0F172A',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                  GST Rate (%)
                </label>
                <select
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                  style={{
                    height: '40px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    padding: '0 10px',
                    fontSize: '13px',
                    color: '#0F172A',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="18">18%</option>
                  <option value="5">5%</option>
                </select>
              </div>
            </div>

            {/* 4. Rates & Stock (Zoho 2-Column Section Layout) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                padding: '16px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '10px'
              }}
            >
              {/* Purchase Information */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Purchase Information
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                    Purchase Cost (₹)
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '12px', fontSize: '13px', color: '#64748B', fontWeight: '600' }}>
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={purchaseRate}
                      onChange={(e) => setPurchaseRate(e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        height: '38px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        padding: '0 12px 0 28px',
                        fontSize: '13px',
                        color: '#0F172A',
                        backgroundColor: '#FFFFFF',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                    Initial Opening Stock
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={openingStock}
                      onChange={(e) => setOpeningStock(e.target.value)}
                      placeholder="0"
                      style={{
                        width: '100%',
                        height: '38px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        padding: '0 50px 0 12px',
                        fontSize: '13px',
                        color: '#0F172A',
                        backgroundColor: '#FFFFFF',
                        outline: 'none'
                      }}
                    />
                    <span style={{ position: 'absolute', right: '12px', fontSize: '11px', color: '#64748B', fontWeight: '700' }}>
                      {unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sales Information */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Sales Information
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                    Selling Price (₹)
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '12px', fontSize: '13px', color: '#64748B', fontWeight: '600' }}>
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={salesRate}
                      onChange={(e) => setSalesRate(e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        height: '38px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        padding: '0 12px 0 28px',
                        fontSize: '13px',
                        color: '#0F172A',
                        backgroundColor: '#FFFFFF',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                    Inventory Status
                  </label>
                  <div
                    style={{
                      height: '38px',
                      borderRadius: '8px',
                      backgroundColor: '#ECFEFF',
                      border: '1px solid #A5F3FC',
                      padding: '0 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#0E7490'
                    }}
                  >
                    <ShieldCheck size={16} />
                    <span>Active in Central Inventory ({category})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Description / Specifications */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                Description / Technical Specifications <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 'normal' }}>(Optional)</span>
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. 550 GSM HDG coating, Grade YSt 310, drawing reference, manufacturer specs..."
                style={{
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: '#0F172A',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'border-color 0.15s ease'
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#0E7490'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; }}
              />
            </div>
          </div>

          {/* Modal Footer (Sticky Bottom Action Bar) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 24px',
              borderTop: '1px solid #F1F5F9',
              backgroundColor: '#F8FAFC'
            }}
          >
            <div style={{ fontSize: '12px', color: '#64748B' }}>
              Auto-syncs to <strong>Item Directory</strong> & <strong>Inventory</strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  height: '38px',
                  padding: '0 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  height: '38px',
                  padding: '0 22px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#0E7490',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: '700',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(14, 116, 144, 0.2)',
                  opacity: isSubmitting ? 0.7 : 1
                }}
              >
                <Check size={16} />
                {isSubmitting ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
