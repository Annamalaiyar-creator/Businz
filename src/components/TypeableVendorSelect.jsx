import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Building2, Check, Search, X } from 'lucide-react';

/**
 * TypeableVendorSelect
 * Interactive combo control: both freely typeable and full searchable dropdown.
 * Used in Purchase Order creation for Company / Vendor Name.
 */
export default function TypeableVendorSelect({
  id = 'purchase-orders-company-name',
  name = 'companyName',
  value = '',
  onChange,
  vendors = [],
  placeholder = 'Type or select Vendor...',
  disabled = false,
  required = false,
  style = {},
  accentColor = '#2563EB'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value || '');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuCoords, setMenuCoords] = useState({
    top: 'auto',
    bottom: 'auto',
    left: 0,
    width: 340,
    maxHeight: 260
  });

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const justSelectedRef = useRef(false);

  // Sync internal state when external value changes
  useEffect(() => {
    setSearchQuery(value || '');
  }, [value]);

  // Update floating dropdown coordinates directly anchored to input element
  const updateMenuPosition = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();

    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setIsOpen(false);
      return;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < 150 && spaceAbove > spaceBelow;

    const menuWidth = Math.max(rect.width, 320);
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - menuWidth - 12);
    }
    if (left < 12) left = 12;

    const maxHeight = Math.min(280, Math.max(160, (openUpward ? spaceAbove : spaceBelow) - 16));

    if (openUpward) {
      setMenuCoords({
        top: 'auto',
        bottom: window.innerHeight - rect.top + 4,
        left,
        width: menuWidth,
        maxHeight
      });
    } else {
      setMenuCoords({
        top: rect.bottom + 4,
        bottom: 'auto',
        left,
        width: menuWidth,
        maxHeight
      });
    }
  };

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      window.addEventListener('scroll', updateMenuPosition, true);
      window.addEventListener('resize', updateMenuPosition);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [isOpen]);

  // Filter vendors based on query
  const filteredVendors = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return vendors || [];
    return (vendors || []).filter((v) => {
      const vName = String(v.name || v.companyName || '').toLowerCase();
      const vContact = String(v.contact || v.contactPerson || '').toLowerCase();
      const vCity = String(v.city || '').toLowerCase();
      const vGst = String(v.gstin || v.gstNo || '').toLowerCase();
      return vName.includes(q) || vContact.includes(q) || vCity.includes(q) || vGst.includes(q);
    });
  }, [vendors, searchQuery]);

  const handleSelectVendor = (vendor) => {
    const selectedName = vendor.name || vendor.companyName || '';
    setSearchQuery(selectedName);
    justSelectedRef.current = true;
    setIsOpen(false);
    if (onChange) {
      onChange(selectedName, vendor);
    }
    setTimeout(() => {
      justSelectedRef.current = false;
    }, 200);
  };

  const handleCustomSelect = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    justSelectedRef.current = true;
    setIsOpen(false);
    if (onChange) {
      onChange(trimmed, null);
    }
    setTimeout(() => {
      justSelectedRef.current = false;
    }, 200);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
        updateMenuPosition();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredVendors.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredVendors.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredVendors.length) {
        handleSelectVendor(filteredVendors[highlightedIndex]);
      } else if (searchQuery.trim()) {
        handleCustomSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const isExactMatch = filteredVendors.some(
    (v) => (v.name || v.companyName || '').toLowerCase() === (searchQuery || '').trim().toLowerCase()
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      {/* Combobox Input with Embedded Chevron */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: disabled ? '#F8FAFC' : '#FFFFFF',
          border: isOpen ? `1.5px solid ${accentColor}` : '1px solid #CBD5E1',
          borderRadius: '8px',
          height: '38px',
          padding: '0 8px 0 12px',
          boxSizing: 'border-box',
          transition: 'all 0.15s ease',
          boxShadow: isOpen ? `0 0 0 2px ${accentColor}1A` : 'none'
        }}
      >
        <input
          id={id}
          name={name}
          aria-label={placeholder}
          ref={inputRef}
          type="text"
          disabled={disabled}
          required={required}
          value={searchQuery}
          placeholder={placeholder}
          onChange={(e) => {
            const val = e.target.value;
            setSearchQuery(val);
            if (!isOpen) {
              setIsOpen(true);
              updateMenuPosition();
            }
            if (onChange) {
              onChange(val, null);
            }
          }}
          onFocus={() => {
            if (!disabled && !justSelectedRef.current) {
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
            padding: 0
          }}
        />

        {/* Clear Button */}
        {searchQuery && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSearchQuery('');
              if (onChange) onChange('', null);
              if (inputRef.current) inputRef.current.focus();
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              color: '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={14} />
          </button>
        )}

        {/* Chevron Dropdown Toggle */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (disabled) return;
            if (isOpen) {
              setIsOpen(false);
            } else {
              setIsOpen(true);
              updateMenuPosition();
              if (inputRef.current) inputRef.current.focus();
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: '4px',
            color: isOpen ? accentColor : '#64748B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.15s ease'
          }}
        >
          <ChevronDown
            size={16}
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease'
            }}
          />
        </button>
      </div>

      {/* Floating Dropdown Menu (via Portal to escape container overflow) */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: menuCoords.top !== 'auto' ? `${menuCoords.top}px` : 'auto',
              bottom: menuCoords.bottom !== 'auto' ? `${menuCoords.bottom}px` : 'auto',
              left: `${menuCoords.left}px`,
              width: `${menuCoords.width}px`,
              maxHeight: `${menuCoords.maxHeight}px`,
              backgroundColor: '#FFFFFF',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              overflowY: 'auto',
              zIndex: 99999,
              fontFamily: 'inherit'
            }}
          >
            {/* Header info */}
            <div
              style={{
                padding: '6px 10px',
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                fontWeight: '700',
                color: '#64748B'
              }}
            >
              <span>Vendors ({filteredVendors.length} found)</span>
              <span style={{ fontSize: '10px', color: '#94A3B8' }}>Select or type custom</span>
            </div>

            {/* Custom Typed Option (if query does not match existing vendor exactly) */}
            {searchQuery.trim() && !isExactMatch && (
              <div
                onClick={handleCustomSelect}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #F1F5F9',
                  backgroundColor: '#F0FDF4',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#15803D',
                  fontWeight: '600'
                }}
              >
                <span>Use custom vendor:</span>
                <strong style={{ color: '#166534' }}>"{searchQuery.trim()}"</strong>
              </div>
            )}

            {/* Vendor List */}
            {filteredVendors.length === 0 && !searchQuery.trim() ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>
                No vendors found. Type to enter a new vendor.
              </div>
            ) : (
              filteredVendors.map((vendor, idx) => {
                const vName = vendor.name || vendor.companyName || '';
                const isSelected = vName.toLowerCase() === (searchQuery || '').trim().toLowerCase();
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectVendor(vendor)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      backgroundColor: isHighlighted ? `${accentColor}10` : isSelected ? '#F0F9FF' : 'transparent',
                      borderLeft: isSelected ? `3px solid ${accentColor}` : '3px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      transition: 'background-color 0.1s ease',
                      borderBottom: '1px solid #F8FAFC'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building2 size={13} style={{ color: accentColor, flexShrink: 0 }} />
                        <span style={{ fontSize: '12.5px', fontWeight: isSelected ? '700' : '600', color: '#0F172A' }}>
                          {vName}
                        </span>
                      </div>
                      {(vendor.contact || vendor.contactPerson || vendor.city || vendor.gstin || vendor.gstNo) && (
                        <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '2px', paddingLeft: '19px' }}>
                          {vendor.contact || vendor.contactPerson ? `Contact: ${vendor.contact || vendor.contactPerson}` : ''}
                          {(vendor.contact || vendor.contactPerson) && (vendor.city || vendor.gstin || vendor.gstNo) ? ' • ' : ''}
                          {vendor.city ? vendor.city : ''}
                          {vendor.city && (vendor.gstin || vendor.gstNo) ? ' • ' : ''}
                          {vendor.gstin || vendor.gstNo ? `GST: ${vendor.gstin || vendor.gstNo}` : ''}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check size={14} style={{ color: accentColor, flexShrink: 0 }} />}
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
