import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Check, AlertCircle, Package, Plus } from 'lucide-react';
import { normalizeProductName } from '../utils/vrmProductsData';

/**
 * TypeableProductSelect
 * A hybrid typeable input and interactive dropdown menu (combobox).
 * Allows users to:
 * 1. Type freely any custom product name or search term ("typeable")
 * 2. Click the chevron or focus to open a full dropdown list of catalog items with live stock & price ("dropdown")
 * 3. Select any item to auto-populate product details
 */
export default function TypeableProductSelect({
  value = '',
  onChange,
  itemsList = [],
  placeholder = 'Type or select product / item...',
  disabled = false,
  style = {},
  inputStyle = {},
  accentColor = '#0E7490'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value || '');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuCoords, setMenuCoords] = useState({ top: 0, left: 0, width: 360 });

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Sync internal search query with external value changes
  useEffect(() => {
    setSearchQuery(value || '');
  }, [value]);

  // Update floating dropdown coordinates
  const updateMenuPosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuHeight = 280;
    const fitsBelow = spaceBelow >= menuHeight || spaceBelow > rect.top;

    setMenuCoords({
      top: fitsBelow ? rect.bottom + 4 : Math.max(8, rect.top - menuHeight - 4),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 360) - 16)),
      width: Math.max(rect.width, 380),
      maxHeight: Math.min(320, fitsBelow ? spaceBelow - 16 : rect.top - 16)
    });
  };

  useEffect(() => {
    if (isOpen) {
      updateMenuPosition();
      const handleScrollOrResize = () => updateMenuPosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  // Outside click listener
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [isOpen]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    const list = Array.isArray(itemsList) ? itemsList : [];
    const q = (searchQuery || '').toLowerCase().trim();
    if (!q) return list.slice(0, 100);
    const normQ = normalizeProductName(q);

    return list.filter(item => {
      const name = String(item.name || '').toLowerCase();
      const code = String(item.code || '').toLowerCase();
      const cat = String(item.category || item.description || '').toLowerCase();
      const normName = normalizeProductName(item.name);
      return name.includes(q) || code.includes(q) || cat.includes(q) ||
        (normQ && normName.includes(normQ));
    }).slice(0, 100);
  }, [itemsList, searchQuery]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!isOpen) setIsOpen(true);
    setHighlightedIndex(0);

    // Call onChange with typed text and matched item if exact or normalized
    const vLow = val.toLowerCase().trim();
    const vNorm = normalizeProductName(val);
    const matched = (itemsList || []).find(it => {
      const itName = (it.name || '').toLowerCase().trim();
      const itCode = (it.code || '').toLowerCase().trim();
      const itNorm = normalizeProductName(it.name);
      return itName === vLow || itCode === vLow || (vNorm && itNorm === vNorm);
    });
    if (onChange) {
      onChange(val, matched || null);
    }
  };

  const handleSelectItem = (item) => {
    setSearchQuery(item.name);
    setIsOpen(false);
    if (onChange) {
      onChange(item.name, item);
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleCustomSelect = () => {
    if (!searchQuery.trim()) return;
    setIsOpen(false);
    if (onChange) {
      onChange(searchQuery.trim(), null);
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (isOpen) {
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredItems[highlightedIndex]) {
          handleSelectItem(filteredItems[highlightedIndex]);
        } else if (searchQuery.trim()) {
          handleCustomSelect();
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const isExactMatch = filteredItems.some(
    it => (it.name || '').toLowerCase() === (searchQuery || '').toLowerCase()
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      {/* Typeable Input with Embedded Dropdown Toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: disabled ? '#F8FAFC' : '#FFFFFF',
          border: isOpen ? `1.5px solid ${accentColor}` : '1px solid #CBD5E1',
          borderRadius: '7px',
          height: style?.height || '34px',
          padding: '0 6px 0 10px',
          boxSizing: 'border-box',
          transition: 'all 0.15s ease',
          cursor: disabled ? 'not-allowed' : 'text',
          boxShadow: isOpen ? `0 0 0 2px ${accentColor}1A` : 'none'
        }}
      >
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={searchQuery}
          placeholder={placeholder}
          onChange={handleInputChange}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
              updateMenuPosition();
            }
          }}
          onKeyDown={handleKeyDown}
          style={{
            border: 'none',
            outline: 'none',
            width: '100%',
            height: '100%',
            fontSize: '13px',
            fontWeight: '600',
            color: disabled ? '#64748B' : '#0F172A',
            backgroundColor: 'transparent',
            padding: 0,
            cursor: disabled ? 'not-allowed' : 'text',
            ...inputStyle
          }}
        />

        {/* Dropdown Chevron Toggle Button */}
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (disabled) return;
            const next = !isOpen;
            setIsOpen(next);
            if (next && inputRef.current) {
              inputRef.current.focus();
              updateMenuPosition();
            }
          }}
          title={isOpen ? 'Close item dropdown' : 'Open item dropdown list'}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: isOpen ? accentColor : '#94A3B8',
            padding: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            flexShrink: 0,
            transition: 'transform 0.2s ease, color 0.15s ease'
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

      {/* Floating Dropdown Menu rendered in Portal to avoid table overflow clipping */}
      {isOpen && !disabled && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${menuCoords.top}px`,
            left: `${menuCoords.left}px`,
            width: `${menuCoords.width}px`,
            maxHeight: `${menuCoords.maxHeight || 280}px`,
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 12px 28px -6px rgba(15, 23, 42, 0.18), 0 4px 12px -2px rgba(15, 23, 42, 0.08)',
            zIndex: 99999999,
            overflowY: 'auto',
            fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
            animation: 'fadeInMenu 0.15s ease-out forwards'
          }}
        >
          {/* Header info badge */}
          <div style={{
            padding: '7px 12px',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            fontWeight: '700',
            color: '#64748B'
          }}>
            <span>Catalog Items ({filteredItems.length} available)</span>
            <span style={{ fontSize: '10px', color: '#94A3B8' }}>Click or type custom item</span>
          </div>

          {/* Custom Typed Option (if user typed something not matching exactly) */}
          {searchQuery.trim() && !isExactMatch && (
            <div
              onClick={handleCustomSelect}
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid #F1F5F9',
                backgroundColor: '#F0FDF4',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#DCFCE7'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F0FDF4'}
            >
              <Plus size={14} style={{ color: '#16A34A', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#15803D' }}>
                  Use custom item: "{searchQuery.trim()}"
                </span>
                <span style={{ fontSize: '10.5px', color: '#16A34A' }}>
                  Press Enter or click to add as custom item
                </span>
              </div>
            </div>
          )}

          {/* List of items */}
          {filteredItems.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
              No matching catalog items found.
            </div>
          ) : (
            filteredItems.map((prod, idx) => {
              const isSelected = (value || '').toLowerCase() === (prod.name || '').toLowerCase();
              const isHighlighted = highlightedIndex === idx;
              const stockNum = Number(
                prod.stock !== undefined ? prod.stock :
                (prod.availableStock !== undefined ? prod.availableStock : 0)
              );
              const isOutOfStock = stockNum <= 0;
              const uom = prod.uom || prod.unit || 'NOS';
              const price = prod.price || prod.rate || null;

              return (
                <div
                  key={prod.code || prod.id || `${prod.name}-${idx}`}
                  onClick={() => handleSelectItem(prod)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    padding: '9px 12px',
                    borderBottom: '1px solid #F8FAFC',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isSelected ? '#ECFEFF' : (isHighlighted ? '#F1F5F9' : '#FFFFFF'),
                    transition: 'background-color 0.12s ease'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', paddingRight: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isSelected && <Check size={13} style={{ color: accentColor, flexShrink: 0 }} />}
                      <span style={{
                        fontSize: '12.5px',
                        fontWeight: isSelected ? '800' : '700',
                        color: isSelected ? accentColor : '#0F172A',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {prod.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: '#64748B' }}>
                      {prod.code && (
                        <span style={{ backgroundColor: '#F1F5F9', padding: '1px 5px', borderRadius: '4px', fontWeight: '700', color: '#475569' }}>
                          {prod.code}
                        </span>
                      )}
                      {(prod.category || prod.description) && (
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                          {prod.category || prod.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side: Stock Badge & Price */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '10.5px',
                      fontWeight: '800',
                      padding: '2px 7px',
                      borderRadius: '12px',
                      backgroundColor: isOutOfStock ? '#FEF2F2' : '#ECFDF5',
                      color: isOutOfStock ? '#DC2626' : '#059669',
                      border: isOutOfStock ? '1px solid #FECACA' : '1px solid #A7F3D0'
                    }}>
                      {isOutOfStock ? `⚠️ 0 ${uom}` : `✓ ${stockNum.toLocaleString()} ${uom}`}
                    </span>

                    {price && (
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                        ₹{Number(price).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
