import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

// Canonical BUSINZ KPI Grid Component for all CEO Dashboards
export function CeoKpiGrid({ kpis }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  if (!kpis || !kpis.length) return null;
  return (
    <div 
      className="ceo-kpi-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '10px',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box'
      }}
    >
      {kpis.map((kpi, kIdx) => {
        const isUp = kpi.trendUp;
        const isNeutral = kpi.trendNeutral;
        const trendBg = isUp ? '#ECFDF5' : (isNeutral ? '#F1F5F9' : '#FEF2F2');
        const trendBorder = isUp ? '1px solid #A7F3D0' : (isNeutral ? '1px solid #E2E8F0' : '1px solid #FECACA');
        const trendText = isUp ? '#059669' : (isNeutral ? '#475569' : '#DC2626');
        const highlightColor = kpi.bottomHighlightColor || (isUp ? '#059669' : (isNeutral ? '#0F172A' : '#DC2626'));
        const isHovered = hoveredIdx === kIdx && Boolean(kpi.onClick);
        
        return (
          <div 
            key={kIdx}
            onClick={kpi.onClick}
            onMouseEnter={() => setHoveredIdx(kIdx)}
            onMouseLeave={() => setHoveredIdx(null)}
            role={kpi.onClick ? 'button' : undefined}
            tabIndex={kpi.onClick ? 0 : undefined}
            style={{
              backgroundColor: kpi.isSelected ? '#F0FDFA' : (isHovered ? '#F0FDFA' : '#FFFFFF'),
              borderRadius: '16px',
              border: `1px solid ${kpi.isSelected ? '#0E7490' : (isHovered ? '#0E7490' : (kpi.highlightCard ? '#FCA5A5' : '#EAEFEF'))}`,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxShadow: kpi.isSelected 
                ? '0 0 0 1px #0E7490, 0 4px 18px rgba(14, 116, 144, 0.12)' 
                : (kpi.highlightCard 
                    ? '0 4px 18px rgba(220, 38, 38, 0.08)' 
                    : '0 4px 18px rgba(15, 23, 42, 0.03)'),
              transform: 'none',
              cursor: kpi.onClick ? 'pointer' : 'default',
              transition: 'background-color 0.15s ease, border-color 0.15s ease',
              minWidth: 0,
              boxSizing: 'border-box'
            }}
          >
            {/* Top Main Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <span 
                  style={{ 
                    fontSize: '11px', 
                    fontWeight: '800', 
                    color: kpi.isSelected ? '#0E7490' : '#64748B', 
                    letterSpacing: '0.04em', 
                    textTransform: 'uppercase', 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                  }}
                >
                  {kpi.title}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '20px', fontWeight: '900', color: kpi.highlightCard ? '#DC2626' : (kpi.valColor || '#0F172A'), letterSpacing: '-0.5px', lineHeight: '1.1' }}>
                  {kpi.value}
                </span>
                
                {kpi.trend !== undefined && kpi.trend !== null && (
                  <span 
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '2px', 
                      fontSize: '11px', 
                      fontWeight: '800', 
                      color: trendText, 
                      backgroundColor: trendBg, 
                      border: trendBorder, 
                      padding: '1.5px 6px', 
                      borderRadius: '6px', 
                      lineHeight: '1.2' 
                    }}
                  >
                    {!kpi.hideTrendIcon && (
                      isUp ? (
                        <ArrowUpRight style={{ width: '12px', height: '12px' }} />
                      ) : (
                        <ArrowDownRight style={{ width: '12px', height: '12px' }} />
                      )
                    )}
                    {kpi.trend}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Sub-Card Box */}
            <div 
              style={{ 
                backgroundColor: '#F8FAFC', 
                border: '1px solid #F1F5F9', 
                borderRadius: '10px', 
                padding: '6px 10px', 
                fontSize: '11px', 
                fontWeight: '500', 
                color: '#64748B', 
                lineHeight: '1.3', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span>{kpi.bottomPrefix}</span>
                <span style={{ color: highlightColor, fontWeight: '800' }}>
                  {kpi.bottomHighlight}
                </span>
              </div>
              {kpi.onClick && (
                <span style={{ color: '#0E7490', fontWeight: '800', fontSize: '10.5px', marginLeft: '6px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  View →
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
export default CeoKpiGrid;
