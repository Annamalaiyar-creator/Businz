import React, { useState } from 'react';
import {
  Boxes, Search, Filter, Layers, Tag, Eye, CheckCircle, Package,
  ExternalLink, ArrowRight, RefreshCw, ShieldCheck
} from 'lucide-react';
import { getItems } from '../../services/businzDataService';

export default function CrmProductCatalog({ onNavigateTab }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Load directly from Central Product Master
  const items = getItems();

  const categories = ['All', 'Aluminium', 'HDG Steel', 'Clamps', 'Hardware & Fasteners', 'Walkway'];

  const filteredItems = items.filter(it => {
    const q = searchTerm.toLowerCase();
    const name = (it.name || it.item_name || '').toLowerCase();
    const sku = (it.sku || it.item_code || '').toLowerCase();
    const matchSearch = !searchTerm || name.includes(q) || sku.includes(q);

    let matchCat = true;
    if (selectedCategory === 'Aluminium') matchCat = name.includes('alu') || name.includes('rail');
    else if (selectedCategory === 'HDG Steel') matchCat = name.includes('hdg') || name.includes('purlin') || name.includes('channel') || name.includes('strut');
    else if (selectedCategory === 'Clamps') matchCat = name.includes('clamp') || name.includes('mid') || name.includes('end');
    else if (selectedCategory === 'Hardware & Fasteners') matchCat = name.includes('bolt') || name.includes('nut') || name.includes('fastener') || name.includes('ss');
    else if (selectedCategory === 'Walkway') matchCat = name.includes('walkway') || name.includes('mesh') || name.includes('grating');

    return matchSearch && matchCat;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: '#0E7490',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Boxes size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              Live Product Catalog & Specifications
            </h2>
            <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
              Directly connected to VRM central Product Master ({items.length} items synced)
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: '12px 18px',
        borderRadius: '10px',
        border: '1px solid #E2E8F0'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #CBD5E1',
          padding: '6px 12px',
          borderRadius: '8px',
          flex: 1,
          minWidth: '240px'
        }}>
          <Search size={16} color="#64748B" />
          <input
            type="text"
            placeholder="Search solar profile name, dimensions, SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '13px', width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: selectedCategory === c ? '#0E7490' : '#F1F5F9',
                color: selectedCategory === c ? '#FFFFFF' : '#475569',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px'
      }}>
        {filteredItems.slice(0, 30).map((it, idx) => (
          <div
            key={it.item_id || it.itemId || idx}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', color: '#0E7490' }}>
                  {it.sku || it.item_code || `VRM-PROD-${idx + 1}`}
                </span>
                <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#DCFCE7', color: '#15803D' }}>
                  Standard Spec
                </span>
              </div>
              <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', margin: '0 0 6px', lineHeight: '1.3' }}>
                {it.name || it.item_name}
              </h4>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
                Unit: {it.unit || 'PCS'} • Stock Available
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #F1F5F9' }}>
              <div>
                <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>Selling Rate</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                  ₹ {Number(it.rate || it.selling_rate || 280).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => onNavigateTab('BOM')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #0E7490',
                  backgroundColor: '#F0FDFA',
                  color: '#0E7490',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                + Add to BOM
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
