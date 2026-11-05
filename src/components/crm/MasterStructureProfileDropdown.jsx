import React from 'react';
import { MASTER_STRUCTURE_OPTIONS } from '../../utils/hdgStructureConfigurator';

export default function MasterStructureProfileDropdown({
  value,
  onChange,
  activeBadge
}) {
  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          1. Structure & Column Profile
        </label>
        {activeBadge && (
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490' }}>
            {activeBadge}
          </span>
        )}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          height: '40px',
          borderRadius: '8px',
          border: '1.5px solid #CBD5E1',
          backgroundColor: '#F8FAFC',
          padding: '0 12px',
          fontSize: '13px',
          fontWeight: '700',
          color: '#0F172A',
          cursor: 'pointer',
          outline: 'none',
          transition: 'border-color 0.15s ease'
        }}
      >
        {MASTER_STRUCTURE_OPTIONS.map(grp => (
          <optgroup key={grp.group} label={grp.group}>
            {grp.options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

