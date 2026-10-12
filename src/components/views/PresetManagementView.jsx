import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, Search, Plus, Edit2, Trash2, Check, X,
  Save, RefreshCw, Filter, FileText, ChevronRight,
  Package, AlertCircle, ArrowLeft, Eye
} from 'lucide-react';
import { VRM_PRODUCTS } from '../../utils/vrmProductsData';
import { VRM_HDG_PRESETS, getAllActivePresets, saveCustomPreset, deleteCustomPreset, syncPresetsWithCloud } from '../../vrmHdgProposalPresets';
import { saveCloudStore, fetchCloudStore } from '../../utils/supabaseDataSync';
import CreatePresetKitView from './CreatePresetKitView';

export default function PresetManagementView(props) {
  const { userRole = 'Tech Support', onChangeTab } = props;

  // Presets state
  const [allPresets, setAllPresets] = useState(() => getAllActivePresets());
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState(null);

  // Dedicated Screen for Create / Edit Preset Kit (BOM Screen Aesthetic)
  const [isCreateScreenOpen, setIsCreateScreenOpen] = useState(false);
  const [targetPresetForScreen, setTargetPresetForScreen] = useState(null);

  // Modal / Drawer state for Create & Edit
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Item Search in Editor
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [suggestedProducts, setSuggestedProducts] = useState([]);

  // Load and sync from cloud/server on mount
  useEffect(() => {
    const loadStore = async () => {
      try {
        const synced = await syncPresetsWithCloud();
        if (synced && typeof synced === 'object') {
          setAllPresets(synced);
        }
      } catch (err) {
        console.error('Failed to sync cloud presets', err);
      }
    };
    loadStore();

    // Listen to local updates
    const handleUpdate = (e) => {
      if (e.detail) {
        setAllPresets(e.detail);
      }
    };
    window.addEventListener('vrm_presets_updated', handleUpdate);
    return () => window.removeEventListener('vrm_presets_updated', handleUpdate);
  }, []);

  // Distinct categories
  const categoriesList = useMemo(() => {
    const cats = new Set();
    Object.values(allPresets).forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return ['All', ...Array.from(cats)];
  }, [allPresets]);

  // Filtered presets (Custom & newly created presets placed at the very TOP)
  const filteredPresets = useMemo(() => {
    const list = Object.values(allPresets).filter(preset => {
      const matchesCat = activeCategory === 'All' || preset.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (preset.label || '').toLowerCase().includes(q) ||
        (preset.id || '').toLowerCase().includes(q) ||
        (preset.category || '').toLowerCase().includes(q) ||
        (preset.items || []).some(it => (it.name || '').toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });

    // Sort: custom / newly created first, then alphabetically by label
    return list.sort((a, b) => {
      if (a.isCustom && !b.isCustom) return -1;
      if (!a.isCustom && b.isCustom) return 1;
      const timeA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const timeB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return (a.label || '').localeCompare(b.label || '');
    });
  }, [allPresets, activeCategory, searchQuery]);

  // Handle open Create Preset Screen (Dedicated Screen like Create BOM)
  const handleOpenCreate = () => {
    const newId = `preset_custom_${Date.now()}`;
    setTargetPresetForScreen({
      id: newId,
      label: '',
      category: activeCategory !== 'All' ? activeCategory : 'GAL Hat Purline Structures (2 Row)',
      isCustom: true,
      items: [
        { name: '', qty: '1', uom: 'NOS', category: 'General', rate: '0.0', gstRate: '18%' }
      ]
    });
    setIsCreateScreenOpen(true);
  };

  // Handle open Edit Preset Screen
  const handleOpenEdit = (preset) => {
    setTargetPresetForScreen(JSON.parse(JSON.stringify(preset)));
    setIsCreateScreenOpen(true);
  };

  // Save Preset from Dedicated Screen
  const handleSaveFromScreen = (savedPreset) => {
    const updatedAll = saveCustomPreset(savedPreset);
    if (updatedAll) {
      setAllPresets({ ...updatedAll });
    }

    // Auto-select the preset's category (or 'All') and clear search so the user immediately sees it
    if (savedPreset.category) {
      setActiveCategory(savedPreset.category);
    } else {
      setActiveCategory('All');
    }
    setSearchQuery('');
    setSelectedPresetId(savedPreset.id);
    setTimeout(() => setSelectedPresetId(null), 4000);

    setSaveSuccessMsg(`✓ Preset Kit "${savedPreset.label}" created successfully and added to "${savedPreset.category || 'All'}"!`);
    setTimeout(() => setSaveSuccessMsg(''), 6000);
    setIsCreateScreenOpen(false);
    setTargetPresetForScreen(null);

    // Scroll to top of list smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Autocomplete suggestions for product items in editor
  useEffect(() => {
    if (!itemSearchTerm || itemSearchTerm.trim().length < 2) {
      setSuggestedProducts([]);
      return;
    }
    const q = itemSearchTerm.toLowerCase().trim();
    const matches = (VRM_PRODUCTS || []).filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.material && p.material.toLowerCase().includes(q))
    ).slice(0, 10);
    setSuggestedProducts(matches);
  }, [itemSearchTerm]);

  // Add item to editing preset
  const handleAddItemToPreset = (product) => {
    if (!editingPreset) return;
    const newItem = {
      code: product.code || '',
      name: product.name || '',
      qty: '1',
      uom: product.uom || 'NOS',
      category: product.material || 'General',
      rate: String(product.rate || '0.0'),
      gstRate: product.gst || '18%'
    };
    setEditingPreset(prev => ({
      ...prev,
      items: [...(prev.items || []).filter(i => i.name && i.name.trim() !== ''), newItem]
    }));
    setItemSearchTerm('');
    setSuggestedProducts([]);
  };

  // Update item field in editing preset
  const handleUpdateItem = (index, field, value) => {
    if (!editingPreset) return;
    const updated = [...(editingPreset.items || [])];
    updated[index] = { ...updated[index], [field]: value };
    setEditingPreset(prev => ({ ...prev, items: updated }));
  };

  // Remove item from editing preset
  const handleRemoveItem = (index) => {
    if (!editingPreset) return;
    const updated = (editingPreset.items || []).filter((_, idx) => idx !== index);
    setEditingPreset(prev => ({ ...prev, items: updated }));
  };

  // Save Preset to cloud & localStorage
  const handleSavePreset = () => {
    if (!editingPreset || !editingPreset.label.trim()) {
      alert('Please provide a valid Preset Name / Title.');
      return;
    }
    const cleanItems = (editingPreset.items || []).filter(it => it.name && it.name.trim() !== '');
    if (cleanItems.length === 0) {
      alert('Please add at least one component to the preset.');
      return;
    }

    const presetToSave = {
      ...editingPreset,
      label: editingPreset.label.trim(),
      isCustom: true,
      items: cleanItems,
      updated_at: new Date().toISOString()
    };

    // Save locally and trigger event
    const updatedAll = saveCustomPreset(presetToSave);
    if (updatedAll) {
      setAllPresets(updatedAll);
    }

    setSaveSuccessMsg(`Preset "${presetToSave.label}" saved successfully! Available across the app.`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
    setIsEditModalOpen(false);
  };

  // Delete custom preset
  const handleDeletePreset = (id, label) => {
    if (!window.confirm(`Are you sure you want to delete preset "${label}"?`)) return;
    const updated = deleteCustomPreset(id);
    setAllPresets({ ...updated });
  };

  // Render Dedicated Screen for Create / Edit Preset Kit (BOM Screen Aesthetic)
  if (isCreateScreenOpen) {
    return (
      <CreatePresetKitView
        preset={targetPresetForScreen}
        userRole={userRole}
        availableCategories={categoriesList.filter(c => c !== 'All')}
        onSave={handleSaveFromScreen}
        onCancel={() => {
          setIsCreateScreenOpen(false);
          setTargetPresetForScreen(null);
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '1440px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Top Banner & Header */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px 28px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: '#EEF2FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4F46E5',
            border: '1px solid #C7D2FE'
          }}>
            <Layers size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                Preset Management Engine
              </h1>
              <span style={{
                backgroundColor: '#EDE9FE',
                color: '#6D28D9',
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                Tech Support
              </span>
            </div>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
              Create, customize, and edit standardized BOM Presets & Hat Purline configurations. Changes sync instantly across BOM Orders.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            id="create-preset-btn"
            onClick={handleOpenCreate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#4F46E5',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)'
            }}
          >
            <Plus size={16} />
            Create New Preset
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {saveSuccessMsg && (
        <div style={{
          backgroundColor: '#ECFDF5',
          border: '1px solid #6EE7B7',
          color: '#065F46',
          borderRadius: '10px',
          padding: '12px 18px',
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Check size={16} color="#059669" />
          {saveSuccessMsg}
        </div>
      )}

      {/* Search & Category Filter Toolbar */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '14px',
        padding: '16px 20px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '320px', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Search presets by name, purlin, table size, components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                height: '40px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                padding: '0 12px 0 36px',
                fontSize: '13px',
                color: '#0F172A',
                outline: 'none',
                backgroundColor: '#F8FAFC'
              }}
            />
          </div>

          <div style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>
            Showing <strong style={{ color: '#4F46E5' }}>{filteredPresets.length}</strong> of {Object.keys(allPresets).length} Total Presets
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categoriesList.map(cat => {
            const isSelected = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: isSelected ? '1px solid #4F46E5' : '1px solid #E2E8F0',
                  backgroundColor: isSelected ? '#EEF2FF' : '#FFFFFF',
                  color: isSelected ? '#4F46E5' : '#64748B',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Presets Grid / List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
        {filteredPresets.map(preset => {
          const itemCount = (preset.items || []).length;
          const isJustSaved = selectedPresetId === preset.id;

          return (
            <div
              key={preset.id}
              style={{
                backgroundColor: isJustSaved ? '#F0FDFA' : '#FFFFFF',
                borderRadius: '12px',
                border: isJustSaved ? '2px solid #0E7490' : '1px solid #E2E8F0',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
                boxShadow: isJustSaved ? '0 4px 14px rgba(14, 116, 144, 0.15)' : '0 1px 3px rgba(0,0,0,0.02)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#4F46E5',
                    backgroundColor: '#EEF2FF',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    {preset.category || 'Preset Assembly'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={() => handleOpenEdit(preset)}
                      title="Edit Preset"
                      style={{
                        backgroundColor: '#F1F5F9',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        color: '#475569'
                      }}
                    >
                      <Edit2 size={13} />
                    </button>
                    {preset.isCustom && (
                      <button
                        onClick={() => handleDeletePreset(preset.id, preset.label)}
                        title="Delete Preset"
                        style={{
                          backgroundColor: '#FEE2E2',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 8px',
                          cursor: 'pointer',
                          color: '#DC2626'
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                  {preset.label}
                </h3>

                {/* Items Summary Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                  {(preset.items || []).slice(0, 4).map((it, idx) => (
                    <span
                      key={idx}
                      style={{
                        fontSize: '11px',
                        color: '#475569',
                        backgroundColor: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '4px',
                        padding: '2px 6px'
                      }}
                    >
                      {it.name} ({it.qty} {it.uom || 'NOS'})
                    </span>
                  ))}
                  {itemCount > 4 && (
                    <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: '700', padding: '2px 6px' }}>
                      +{itemCount - 4} more items
                    </span>
                  )}
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid #F1F5F9',
                paddingTop: '12px',
                marginTop: '8px'
              }}>
                <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                  {itemCount} Bill of Material Components
                </span>
                <button
                  onClick={() => handleOpenEdit(preset)}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#4F46E5',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Edit & Customize <ChevronRight size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isEditModalOpen && editingPreset && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '860px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#FAFAFA'
            }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  {editingPreset.isCustom ? 'Create New Preset Kit' : `Edit Preset: ${editingPreset.label}`}
                </h2>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0' }}>
                  Configure component materials, section sizes, and quantities. Saved presets appear immediately in the BOM Preset selector.
                </p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{ backgroundColor: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Preset Meta Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Preset Label / Name *
                  </label>
                  <input
                    type="text"
                    value={editingPreset.label}
                    onChange={(e) => setEditingPreset(prev => ({ ...prev, label: e.target.value }))}
                    placeholder="e.g. 2*4 HP (650 x 1300) Standard Kit"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      padding: '0 12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Category *
                  </label>
                  <select
                    value={editingPreset.category}
                    onChange={(e) => setEditingPreset(prev => ({ ...prev, category: e.target.value }))}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      padding: '0 12px',
                      fontSize: '13px',
                      fontWeight: '600',
                      outline: 'none',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="GAL Hat Purline Structures (2 Row)">GAL Hat Purline Structures (2 Row)</option>
                    <option value="GAL Hat Purline Structures (3 Row)">GAL Hat Purline Structures (3 Row)</option>
                    <option value="GAL Hat Purline Structures (1 Row)">GAL Hat Purline Structures (1 Row)</option>
                    <option value="HDG C Purlin Structures (2 Row)">HDG C Purlin Structures (2 Row)</option>
                    <option value="HDG C Purlin Structures (3 Row)">HDG C Purlin Structures (3 Row)</option>
                    <option value="HDG C Purlin Structures (1 Row)">HDG C Purlin Structures (1 Row)</option>
                    <option value="Mini Rail Kits">Mini Rail Kits (6063T6 Aluminum)</option>
                    <option value="Adhesive Rail Kits">Adhesive Rail Kits</option>
                    <option value="Long Rail & Double C Kits">Long Rail & Double C Kits</option>
                    <option value="Reverse Tilt Triangle Structures">Reverse Tilt Triangle Structures</option>
                    <option value="DCR BOS Solar Kits">DCR BOS Solar Proposal Kits</option>
                    <option value="Custom Assemblies">Custom Assemblies & Kits</option>
                  </select>
                </div>
              </div>

              {/* Add Components Search */}
              <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Search & Add Standardized Components from Catalog:
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    value={itemSearchTerm}
                    onChange={(e) => setItemSearchTerm(e.target.value)}
                    placeholder="Type product name (e.g. Leg 650, Mid Clamp 35mm, Rafter, Allen Bolt...)"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      height: '38px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      padding: '0 12px 0 36px',
                      fontSize: '13px',
                      outline: 'none',
                      backgroundColor: 'white'
                    }}
                  />

                  {/* Dropdown Suggestions */}
                  {suggestedProducts.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '42px',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      zIndex: 10
                    }}>
                      {suggestedProducts.map((p, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleAddItemToPreset(p)}
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
                            <div style={{ fontSize: '11px', color: '#64748B' }}>Code: {p.code} | Grade: {p.material}</div>
                          </div>
                          <span style={{ fontSize: '11px', backgroundColor: '#EDE9FE', color: '#6D28D9', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                            + Add
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Items List Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', margin: 0, textTransform: 'uppercase' }}>
                    Preset Components List ({editingPreset.items ? editingPreset.items.length : 0})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPreset(prev => ({
                        ...prev,
                        items: [...(prev.items || []), { name: '', qty: '1', uom: 'NOS', category: 'General', rate: '0.0', gstRate: '18%' }]
                      }));
                    }}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#4F46E5',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={14} /> Add Custom Line
                  </button>
                </div>

                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: '700' }}>
                      <tr>
                        <th style={{ padding: '8px 12px', width: '35px' }}>#</th>
                        <th style={{ padding: '8px 12px' }}>Product / Component Name</th>
                        <th style={{ padding: '8px 12px', width: '90px' }}>Quantity</th>
                        <th style={{ padding: '8px 12px', width: '80px' }}>UOM</th>
                        <th style={{ padding: '8px 12px', width: '110px' }}>Material Grade</th>
                        <th style={{ padding: '8px 12px', width: '40px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(editingPreset.items || []).map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 12px', color: '#94A3B8', fontWeight: '600' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="text"
                              value={it.name}
                              onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                              placeholder="Component description..."
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                height: '30px',
                                borderRadius: '4px',
                                border: '1px solid #CBD5E1',
                                padding: '0 8px',
                                fontSize: '12px'
                              }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="number"
                              min="1"
                              value={it.qty}
                              onChange={(e) => handleUpdateItem(idx, 'qty', e.target.value)}
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                height: '30px',
                                borderRadius: '4px',
                                border: '1px solid #CBD5E1',
                                padding: '0 8px',
                                fontSize: '12px',
                                fontWeight: '700',
                                textAlign: 'center'
                              }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              value={it.uom || 'NOS'}
                              onChange={(e) => handleUpdateItem(idx, 'uom', e.target.value)}
                              style={{
                                width: '100%',
                                height: '30px',
                                borderRadius: '4px',
                                border: '1px solid #CBD5E1',
                                padding: '0 4px',
                                fontSize: '12px',
                                backgroundColor: 'white'
                              }}
                            >
                              <option value="NOS">NOS</option>
                              <option value="SET">SET</option>
                              <option value="MTR">MTR</option>
                              <option value="KG">KG</option>
                            </select>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <input
                              type="text"
                              value={it.category || ''}
                              onChange={(e) => handleUpdateItem(idx, 'category', e.target.value)}
                              placeholder="e.g. HDG, GAL, 6063T6"
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                height: '30px',
                                borderRadius: '4px',
                                border: '1px solid #CBD5E1',
                                padding: '0 8px',
                                fontSize: '12px'
                              }}
                            />
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              style={{ backgroundColor: 'transparent', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '4px' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: '#FAFAFA'
            }}>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
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
                onClick={handleSavePreset}
                style={{
                  padding: '9px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#4F46E5',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Save size={15} />
                Save & Synchronize Preset
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
