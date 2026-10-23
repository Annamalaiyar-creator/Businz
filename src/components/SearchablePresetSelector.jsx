import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { VRM_HDG_PRESETS, getAllActivePresets } from '../vrmHdgProposalPresets';

/**
 * SearchablePresetSelector
 * Allows both typing to search/filter presets and clicking to open a comprehensive dropdown menu.
 * Displays ALL available presets (master standard + tech support custom presets).
 */
function SearchablePresetSelector({
  value,
  onChange,
  activePresetsMap,
  placeholder = "Select Structure Preset...",
  accentColor = "#4F46E5",
  width = "380px",
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Active presets combined with live updates
  const [presetsStore, setPresetsStore] = useState(() => {
    if (activePresetsMap && Object.keys(activePresetsMap).length > 0) return activePresetsMap;
    return getAllActivePresets();
  });

  useEffect(() => {
    if (activePresetsMap && Object.keys(activePresetsMap).length > 0) {
      setPresetsStore(activePresetsMap);
    }
  }, [activePresetsMap]);

  useEffect(() => {
    const handlePresetUpdate = (e) => {
      if (e.detail) {
        setPresetsStore(e.detail);
      }
    };
    window.addEventListener('vrm_presets_updated', handlePresetUpdate);
    return () => window.removeEventListener('vrm_presets_updated', handlePresetUpdate);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allPresetsList = useMemo(() => {
    const map = presetsStore || VRM_HDG_PRESETS || {};
    return Object.values(map);
  }, [presetsStore]);

  // Selected preset object
  const selectedPresetObj = useMemo(() => {
    if (!value) return null;
    return presetsStore[value] || (VRM_HDG_PRESETS && VRM_HDG_PRESETS[value]) || null;
  }, [value, presetsStore]);

  // When value changes from outside, sync or keep searchTerm clean
  useEffect(() => {
    if (selectedPresetObj && !isOpen) {
      setSearchTerm(selectedPresetObj.label || selectedPresetObj.id);
    } else if (!value && !isOpen) {
      setSearchTerm('');
    }
  }, [value, selectedPresetObj, isOpen]);

  // Categories definition
  const categorizedPresets = useMemo(() => {
    // Optimization: When dropdown is closed, do NOT compute heavy categories!
    if (!isOpen) return [];

    const categories = [
      { name: 'Tech Support & Custom Presets', match: (p) => Boolean(p.isCustom || (p.id && String(p.id).includes('custom'))) },
      { name: 'GAL Hat Purline Structures (2 Row)', match: (p) => p.category === 'GAL Hat Purline Structures (2 Row)' || (p.label && p.label.includes('GAL Hat Purline (2 Row)')) },
      { name: 'GAL Hat Purline Structures (3 Row)', match: (p) => p.category === 'GAL Hat Purline Structures (3 Row)' || (p.label && p.label.includes('GAL Hat Purline (3 Row)')) },
      { name: 'GAL Hat Purline Structures (1 Row)', match: (p) => p.category === 'GAL Hat Purline Structures (1 Row)' || (p.label && p.label.includes('GAL Hat Purline (1 Row)')) },
      { name: 'HDG C Purlin Structures (2 Row)', match: (p) => p.category === 'HDG C Purlin Structures (2 Row)' || (p.label && p.label.includes('HDG C Purlin (2 Row)')) },
      { name: 'HDG C Purlin Structures (3 Row)', match: (p) => p.category === 'HDG C Purlin Structures (3 Row)' || (p.label && p.label.includes('HDG C Purlin (3 Row)')) },
      { name: 'HDG C Purlin Structures (1 Row)', match: (p) => p.category === 'HDG C Purlin Structures (1 Row)' || (p.label && p.label.includes('HDG C Purlin (1 Row)')) },
      { name: 'Mini Rail Kits (6063T6 Aluminum)', match: (p) => p.category === 'Mini Rail Kits' || (p.label && p.label.toLowerCase().includes('mini rail')) },
      { name: 'Adhesive Rail Kits (Penetrative / Non-Penetrative)', match: (p) => p.category === 'Adhesive Rail Kits' || (p.label && p.label.toLowerCase().includes('adhesive')) },
      { name: 'Long Rail & Double C Rail Kits', match: (p) => p.category === 'Long Rail & Double C Kits' || p.category === 'Long Rail Kits' || (p.label && (p.label.includes('Rail') || p.label.includes('rail'))) },
      { name: 'Reverse Tilt Triangle Structures', match: (p) => p.category === 'Reverse Tilt Triangle Structures' || p.category === 'Triangle Structure Kits' || (p.label && p.label.toLowerCase().includes('triangle')) },
      { name: 'DCR BOS Solar Proposal Kits', match: (p) => p.category === 'DCR BOS Solar Kits' || p.category === 'BOS Solar Kits' || (p.label && p.label.includes('BOS KITS')) }
    ];

    const q = (searchTerm || '').toLowerCase().trim();

    // Filter by search query if any
    const filtered = allPresetsList.filter(p => {
      if (!q) return true;
      if (selectedPresetObj && (selectedPresetObj.label === searchTerm || selectedPresetObj.id === searchTerm)) {
        return true;
      }
      return (
        (p.label && p.label.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.items && p.items.some(it => (it.name && it.name.toLowerCase().includes(q))))
      );
    });

    const groupsMap = new Map();
    categories.forEach(c => groupsMap.set(c.name, []));
    const uncat = [];

    filtered.forEach(p => {
      let matched = false;
      for (const cat of categories) {
        if (cat.match(p)) {
          groupsMap.get(cat.name).push(p);
          matched = true;
          break;
        }
      }
      if (!matched) uncat.push(p);
    });

    const groups = [];
    categories.forEach(cat => {
      const items = groupsMap.get(cat.name);
      if (items && items.length > 0) {
        groups.push({ category: cat.name, items });
      }
    });
    if (uncat.length > 0) {
      groups.push({ category: 'Other Tech Support & Custom Presets', items: uncat });
    }

    return groups;
  }, [isOpen, allPresetsList, searchTerm, selectedPresetObj]);

  const handleSelect = (presetId) => {
    const target = presetsStore[presetId] || (VRM_HDG_PRESETS && VRM_HDG_PRESETS[presetId]);
    if (target) {
      setSearchTerm(target.label || target.id);
    }
    setIsOpen(false);
    if (onChange) {
      onChange(presetId, target);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSearchTerm('');
    if (onChange) {
      onChange('', null);
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const totalPresetsCount = allPresetsList.length;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: width || '100%', minWidth: '280px', ...style }}>
      {/* Input container with typing and dropdown trigger */}
      <div
        onClick={() => {
          setIsOpen(true);
          if (inputRef.current) inputRef.current.focus();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          border: isOpen ? `1.5px solid ${accentColor}` : '1.5px solid #CBD5E1',
          borderRadius: '10px',
          height: style?.height || '42px',
          padding: '0 12px',
          boxShadow: isOpen ? `0 0 0 2px ${accentColor}1A` : 'none',
          cursor: 'text',
          boxSizing: 'border-box',
          transition: 'all 0.15s ease'
        }}
      >
        <Search size={14} style={{ color: '#94A3B8', marginRight: '8px', flexShrink: 0 }} />
        
        <input id="searchable-preset-selector-search-term" name="searchTerm" aria-label="SearchTerm"
          ref={inputRef}
          type="text"
          value={searchTerm}
          placeholder={selectedPresetObj ? (selectedPresetObj.label || selectedPresetObj.id) : `${placeholder} (${totalPresetsCount} available)`}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          style={{
            border: 'none',
            outline: 'none',
            width: '100%',
            fontSize: '12px',
            fontWeight: '600',
            color: '#0F172A',
            backgroundColor: 'transparent',
            padding: 0
          }}
         />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            title="Clear selection"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94A3B8',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              marginRight: '4px'
            }}
          >
            <X size={13} />
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
            if (!isOpen && inputRef.current) inputRef.current.focus();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#64748B',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ChevronDown
            size={15}
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          />
        </button>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '100%',
            minWidth: '380px',
            maxHeight: '340px',
            overflowY: 'auto',
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 9999,
            padding: '6px 0'
          }}
        >
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Presets ({totalPresetsCount})
              </span>
              {searchTerm && (
                <span style={{ fontSize: '11px', color: accentColor, fontWeight: '700' }}>
                  Filtered
                </span>
              )}
            </div>
          </div>

          {categorizedPresets.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '12px', fontWeight: '500' }}>
              No presets matching "{searchTerm}"
            </div>
          ) : (
            categorizedPresets.map((group) => (
              <div key={group.category} style={{ marginBottom: '4px' }}>
                <div style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: '800',
                  color: '#475569',
                  backgroundColor: '#F1F5F9',
                  borderTop: '1px solid #E2E8F0',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{group.category}</span>
                  <span style={{ fontSize: '10px', backgroundColor: '#E2E8F0', color: '#334155', padding: '1px 6px', borderRadius: '10px', fontWeight: '700' }}>
                    {group.items.length}
                  </span>
                </div>

                {group.items.map((preset) => {
                  const isSelected = value === preset.id;
                  const itemsCount = preset.items ? preset.items.length : 0;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSelect(preset.id)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: isSelected ? `${accentColor}12` : 'transparent',
                        borderLeft: isSelected ? `3px solid ${accentColor}` : '3px solid transparent',
                        transition: 'background-color 0.1s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: isSelected ? '700' : '600',
                          color: isSelected ? accentColor : '#0F172A',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden'
                        }}>
                          {preset.label || preset.id}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', color: '#64748B' }}>
                            {itemsCount} component{itemsCount !== 1 ? 's' : ''}
                          </span>
                          {preset.isCustom && (
                            <span style={{ fontSize: '9px', fontWeight: '800', color: '#7C3AED', backgroundColor: '#EDE9FE', padding: '1px 5px', borderRadius: '4px' }}>
                              Tech Support
                            </span>
                          )}
                          {(preset.price || preset.rate) && (
                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#059669' }}>
                              ₹{parseFloat(preset.price || preset.rate).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <Check size={14} style={{ color: accentColor, flexShrink: 0, marginLeft: '8px' }} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(SearchablePresetSelector);
