import React, { useState, useEffect } from 'react';
import {
  Layers, Plus, Trash2, Check, ArrowLeft,
  Search, X
} from 'lucide-react';
import { VRM_PRODUCTS } from '../../utils/vrmProductsData';
import { getFullProductsCatalogWithStock } from '../../utils/productCatalogService';

export default function CreatePresetKitView({
  preset = null,
  onSave,
  onCancel,
  availableCategories = [],
  userRole = 'Tech Support'
}) {
  const isEditing = Boolean(preset && preset.id && !preset.id.startsWith('preset_custom_new_temp'));

  const [catalogTick, setCatalogTick] = useState(0);

  useEffect(() => {
    const refresh = () => setCatalogTick(t => t + 1);
    window.addEventListener('controlroom_items_update', refresh);
    window.addEventListener('central_inventory_updated', refresh);
    return () => {
      window.removeEventListener('controlroom_items_update', refresh);
      window.removeEventListener('central_inventory_updated', refresh);
    };
  }, []);

  const catalogProducts = React.useMemo(() => {
    try {
      return getFullProductsCatalogWithStock();
    } catch (_) {
      return VRM_PRODUCTS || [];
    }
  }, [catalogTick]);

  // Default Categories List combined with any passed from store
  const defaultCategories = [
    'GAL Hat Purline Structures (2 Row)',
    'GAL Hat Purline Structures (3 Row)',
    'GAL Hat Purline Structures (1 Row)',
    'HDG C Purlin Structures (2 Row)',
    'HDG C Purlin Structures (3 Row)',
    'HDG C Purlin Structures (1 Row)',
    'Mini Rail Kits',
    'Adhesive Rail Kits',
    'Long Rail & Double C Kits',
    'Reverse Tilt Triangle Structures',
    'DCR BOS Solar Kits',
    'Custom Assemblies'
  ];

  const mergedCategories = Array.from(
    new Set([...defaultCategories, ...(availableCategories || [])])
  );

  // Preset Meta Info (Matching the original simple inputs)
  const [label, setLabel] = useState(preset?.label || '');
  const [category, setCategory] = useState(preset?.category || mergedCategories[0] || 'GAL Hat Purline Structures (2 Row)');
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Items / Components List (Strictly: Product Name, Quantity, UOM, Material Grade - NO PRICE, NO GST)
  const [items, setItems] = useState(() => {
    if (preset && Array.isArray(preset.items) && preset.items.length > 0) {
      return JSON.parse(JSON.stringify(preset.items));
    }
    return [
      { name: '', qty: '1', uom: 'NOS', category: 'General' }
    ];
  });

  // Autocomplete / item search in catalog
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [confirmCancelModal, setConfirmCancelModal] = useState(false);

  useEffect(() => {
    if (!itemSearchTerm || itemSearchTerm.trim().length < 2) {
      setSuggestedProducts([]);
      return;
    }
    const q = itemSearchTerm.toLowerCase().trim();
    const matches = (catalogProducts || []).filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.material && p.material.toLowerCase().includes(q))
    ).slice(0, 15);
    setSuggestedProducts(matches);
  }, [itemSearchTerm, catalogProducts]);

  const handleAddItemFromCatalog = (product) => {
    const newItem = {
      code: product.code || '',
      name: product.name || '',
      qty: '1',
      uom: product.uom || 'NOS',
      category: product.material || 'General'
    };
    setItems(prev => {
      const filtered = prev.filter(i => i.name && i.name.trim() !== '');
      return [...filtered, newItem];
    });
    setItemSearchTerm('');
    setSuggestedProducts([]);
  };

  const handleAddBlankRow = () => {
    setItems(prev => [
      ...prev,
      { name: '', qty: '1', uom: 'NOS', category: 'General' }
    ]);
  };

  const handleRemoveRow = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateItem = (idx, field, value) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  // Perform Save
  const handlePerformSave = () => {
    if (!label.trim()) {
      alert('⚠️ Please provide a valid Preset Name / Title.');
      return;
    }

    const finalCategory = isCreatingNewCategory
      ? newCategoryName.trim()
      : category.trim();

    if (!finalCategory) {
      alert('⚠️ Please select or enter a Category name.');
      return;
    }

    const validItems = items.filter(it => it.name && it.name.trim());
    if (validItems.length === 0) {
      alert('⚠️ Please add at least one component to the preset.');
      return;
    }

    const payload = {
      ...(preset || {}),
      id: preset?.id || `preset_custom_${Date.now()}`,
      label: label.trim(),
      category: finalCategory,
      isCustom: true,
      items: validItems,
      updated_at: new Date().toISOString()
    };

    onSave(payload);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      width: '100%',
      maxWidth: '1440px',
      margin: '0 auto',
      fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      backgroundColor: '#F8FAFC',
      padding: '24px',
      borderRadius: '16px',
      boxSizing: 'border-box'
    }}>
      {/* Top Banner (Create BOM Screen Aesthetic) */}
      <div style={{
        background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
        borderRadius: '18px',
        padding: '24px 28px',
        color: '#FFFFFF',
        boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            backgroundColor: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Layers style={{ width: '24px', height: '24px', color: '#FFFFFF' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
              {isEditing ? `Edit Preset Kit: ${label}` : 'Create New Preset Kit'}
            </h1>
            <p style={{ fontSize: '13px', color: '#C7D2FE', margin: '4px 0 0 0' }}>
              Configure component materials, section sizes, and quantities. Saved presets appear immediately in the BOM Preset selector.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setConfirmCancelModal(true)}
            style={{
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              padding: '10px 20px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#FFFFFF',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ArrowLeft size={15} /> Cancel
          </button>
          <button
            type="button"
            onClick={handlePerformSave}
            style={{
              border: 'none',
              background: '#10B981',
              color: 'white',
              padding: '10px 24px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '900',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Check size={16} />
            Save Preset Kit →
          </button>
        </div>
      </div>

      {/* SECTION 1: PRESET INFORMATION (Clean & Simple) */}
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            backgroundColor: '#4F46E5',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: '800'
          }}>
            1
          </div>
          <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#4F46E5', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            PRESET INFORMATION
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Preset Label / Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. 2*4 HP (650 x 1300) Standard Kit"
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                padding: '0 14px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#0F172A',
                backgroundColor: 'white',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                Category <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNewCategory(!isCreatingNewCategory);
                  if (!isCreatingNewCategory) setNewCategoryName('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4F46E5',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                {isCreatingNewCategory ? '← Choose Existing' : '+ Create New Category'}
              </button>
            </div>

            {isCreatingNewCategory ? (
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Type new category name..."
                autoFocus
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: '2px solid #4F46E5',
                  padding: '0 12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0F172A',
                  backgroundColor: '#F8FAFC',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            ) : (
              <select
                value={category}
                onChange={(e) => {
                  if (e.target.value === '__CREATE_NEW__') {
                    setIsCreatingNewCategory(true);
                    setNewCategoryName('');
                  } else {
                    setCategory(e.target.value);
                  }
                }}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  padding: '0 12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#0F172A',
                  backgroundColor: 'white',
                  outline: 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box'
                }}
              >
                {mergedCategories.map((catName, cIdx) => (
                  <option key={cIdx} value={catName}>
                    {catName}
                  </option>
                ))}
                <option value="__CREATE_NEW__" style={{ color: '#4F46E5', fontWeight: 'bold' }}>
                  + Add / Create New Category...
                </option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: PRESET COMPONENTS LIST (Design of Create BOM Section 5, Content from Preset Modal) */}
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              backgroundColor: '#4F46E5',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: '800'
            }}>
              2
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#4F46E5', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                PRESET COMPONENTS LIST ({items.filter(it => it.name && it.name.trim()).length})
              </h3>
            </div>
          </div>

          {/* Search & Add Standardized Components from Catalog */}
          <div style={{ position: 'relative', width: '380px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              value={itemSearchTerm}
              onChange={(e) => setItemSearchTerm(e.target.value)}
              placeholder="Search & add standard components..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: '38px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                padding: '0 12px 0 36px',
                fontSize: '13px',
                outline: 'none',
                backgroundColor: '#F8FAFC'
              }}
            />

            {/* Dropdown Suggestions */}
            {suggestedProducts.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '44px',
                left: 0,
                right: 0,
                backgroundColor: 'white',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                maxHeight: '260px',
                overflowY: 'auto',
                zIndex: 50
              }}>
                {suggestedProducts.map((p, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleAddItemFromCatalog(p)}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid #F1F5F9'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#EEF2FF'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0F172A' }}>{p.name}</strong>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>
                        Code: {p.code || '—'} | Grade: {p.material || 'General'}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', backgroundColor: '#EDE9FE', color: '#6D28D9', padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>
                      + Add
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Components Table (Matching Create BOM Layout with clean Preset columns) */}
        <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <tr>
                <th style={{ padding: '12px 14px', width: '40px', color: '#94A3B8', fontWeight: '700' }}>#</th>
                <th style={{ padding: '12px 14px', fontWeight: '700' }}>
                  Product / Component Name <span style={{ color: '#EF4444' }}>*</span>
                </th>
                <th style={{ padding: '12px 14px', fontWeight: '700', width: '140px', textAlign: 'center' }}>
                  Quantity <span style={{ color: '#EF4444' }}>*</span>
                </th>
                <th style={{ padding: '12px 14px', fontWeight: '700', width: '130px' }}>UOM</th>
                <th style={{ padding: '12px 14px', fontWeight: '700', width: '220px' }}>Material Grade</th>
                <th style={{ padding: '12px 14px', fontWeight: '700', width: '60px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 14px', color: '#94A3B8', fontWeight: '600' }}>
                    {i + 1}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        list={`preset-product-datalist-${i}`}
                        placeholder="Type or pick product / component..."
                        value={item.name || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const matched = (catalogProducts || []).find(p =>
                            (p.name || '').toLowerCase() === val.toLowerCase() ||
                            (p.code || '').toLowerCase() === val.toLowerCase()
                          );
                          if (matched) {
                            setItems(prev => prev.map((mat, idx) => idx === i ? {
                              ...mat,
                              name: matched.name,
                              uom: matched.uom || mat.uom || 'NOS',
                              category: matched.category || matched.material || mat.category || 'General'
                            } : mat));
                          } else {
                            handleUpdateItem(i, 'name', val);
                          }
                        }}
                        style={{
                          width: '100%',
                          height: '38px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          padding: '0 12px',
                          fontSize: '13px',
                          backgroundColor: 'white',
                          color: '#0F172A',
                          outline: 'none',
                          boxSizing: 'border-box',
                          fontWeight: '600'
                        }}
                      />
                      <datalist id={`preset-product-datalist-${i}`}>
                        {(catalogProducts || []).map((prod, pidx) => (
                          <option key={pidx} value={prod.name}>
                            {prod.code ? `[${prod.code}] ${prod.name} (${prod.category || prod.material || 'General'})` : prod.name}
                          </option>
                        ))}
                      </datalist>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={item.qty}
                      onChange={(e) => handleUpdateItem(i, 'qty', e.target.value)}
                      style={{
                        width: '100%',
                        height: '38px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        padding: '0 8px',
                        fontSize: '13px',
                        fontWeight: '800',
                        color: '#4F46E5',
                        textAlign: 'center',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <select
                      value={item.uom || 'NOS'}
                      onChange={(e) => handleUpdateItem(i, 'uom', e.target.value)}
                      style={{
                        width: '100%',
                        height: '38px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        padding: '0 10px',
                        fontSize: '13px',
                        backgroundColor: '#FFFFFF',
                        fontWeight: '600',
                        outline: 'none'
                      }}
                    >
                      <option value="NOS">NOS</option>
                      <option value="SET">SET</option>
                      <option value="KG">KG</option>
                      <option value="MTR">MTR</option>
                      <option value="PCS">PCS</option>
                      <option value="BOX">BOX</option>
                      <option value="PKT">PKT</option>
                      <option value="PAIR">PAIR</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <input
                      type="text"
                      placeholder="e.g. HDG, GAL, 6063T6"
                      value={item.category || ''}
                      onChange={(e) => handleUpdateItem(i, 'category', e.target.value)}
                      style={{
                        width: '100%',
                        height: '38px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        padding: '0 12px',
                        fontSize: '13px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(i)}
                      style={{
                        border: 'none',
                        background: '#FEF2F2',
                        color: '#EF4444',
                        borderRadius: '6px',
                        padding: '8px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Remove row"
                    >
                      <Trash2 style={{ width: '15px', height: '15px' }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <button
            type="button"
            onClick={handleAddBlankRow}
            style={{
              border: '1px solid #E0E7FF',
              background: '#EEF2FF',
              color: '#4F46E5',
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus style={{ width: '15px', height: '15px' }} />
            Add Custom Line
          </button>
        </div>
      </div>

      {/* Bottom Action Footer (BOM Layout Style) */}
      <div style={{
        backgroundColor: 'white',
        padding: '16px 24px',
        borderRadius: '14px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <button
          type="button"
          onClick={() => setConfirmCancelModal(true)}
          style={{
            padding: '10px 22px',
            borderRadius: '10px',
            border: '1px solid #CBD5E1',
            backgroundColor: 'white',
            color: '#475569',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handlePerformSave}
          style={{
            padding: '10px 28px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: '#4F46E5',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: '800',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Check size={16} />
          Save & Synchronize Preset
        </button>
      </div>

      {/* CONFIRM CANCEL MODAL */}
      {confirmCancelModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '420px',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px 0' }}>
              Discard Changes?
            </h3>
            <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.4', margin: '0 0 20px 0' }}>
              Are you sure you want to cancel? Any unsaved changes entered in this preset kit will be lost.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setConfirmCancelModal(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: 'white',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmCancelModal(false);
                  onCancel();
                }}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#EF4444',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                Discard & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
