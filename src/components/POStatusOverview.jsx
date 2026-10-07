import React, { useState } from 'react';

const defaultStatusItems = [
  { name: 'Completed & Approved', count: '0', color: '#16A34A', pct: 0 },
  { name: 'In Production', count: '0', color: '#0284C7', pct: 0 },
  { name: 'Pending Verification', count: '0', color: '#0E7490', pct: 0 },
  { name: 'Draft / Pending', count: '0', color: '#EA580C', pct: 0 }
];

export default function POStatusOverview({ 
  title = "Work Orders by Status",
  items = defaultStatusItems,
  totalCount = "0",
  totalLabel = "TOTAL ORDERS"
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const statusItems = (items && items.length > 0) ? items : defaultStatusItems;
  const numSegments = statusItems.length;

  // Donut SVG Parameters
  const cx = 110;
  const cy = 110;
  const outerR = 90;
  const innerR = 60;
  const gapRad = 0.05; // Clean subtle gap between pie slices

  const totalGaps = numSegments * gapRad;
  const availableAngle = (2 * Math.PI) - totalGaps;

  let currentAngle = -Math.PI / 2;

  const segmentPaths = statusItems.map((item, idx) => {
    const arcSpan = (item.pct || 0) * availableAngle;
    const a1 = currentAngle + (gapRad / 2);
    const a2 = a1 + Math.max(0.04, arcSpan);

    currentAngle = a2 + (gapRad / 2);

    if (a2 <= a1) return null;

    const x1_out = cx + outerR * Math.cos(a1);
    const y1_out = cy + outerR * Math.sin(a1);
    const x2_out = cx + outerR * Math.cos(a2);
    const y2_out = cy + outerR * Math.sin(a2);

    const x1_in = cx + innerR * Math.cos(a1);
    const y1_in = cy + innerR * Math.sin(a1);
    const x2_in = cx + innerR * Math.cos(a2);
    const y2_in = cy + innerR * Math.sin(a2);

    const largeArc = (a2 - a1) > Math.PI ? 1 : 0;

    const pathData = `M ${x1_out} ${y1_out} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2_out} ${y2_out} L ${x2_in} ${y2_in} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x1_in} ${y1_in} Z`;

    const isHovered = hoveredIdx === idx;

    return (
      <path
        key={idx}
        d={pathData}
        fill={item.color}
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinejoin="round"
        style={{
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          transformOrigin: `${cx}px ${cy}px`,
          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
          opacity: hoveredIdx !== null && !isHovered ? 0.5 : 1,
          filter: isHovered ? `drop-shadow(0px 6px 12px ${item.color}55)` : 'none'
        }}
        onMouseEnter={() => setHoveredIdx(idx)}
        onMouseLeave={() => setHoveredIdx(null)}
      />
    );
  });

  return (
    <div 
      className="section-card po-status-overview-card" 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        padding: '14px 16px', 
        backgroundColor: '#FFFFFF',
        border: '1px solid #EAEFEF',
        borderRadius: '20px',
        boxSizing: 'border-box',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        position: 'relative',
        height: '100%',
        justifyContent: 'space-between'
      }}
    >
      {/* Card Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {title}
        </h3>
      </div>

      {/* Main Body Split: LEFT Normal Pie Chart + RIGHT Legend List */}
      <div className="po-status-body" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px', minWidth: 0 }}>
        
        {/* LEFT SIDE: Normal Pie / Donut SVG with Center Counter */}
        <div style={{ position: 'relative', width: statusItems.length > 4 ? '118px' : '126px', height: statusItems.length > 4 ? '118px' : '126px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="100%" height="100%" viewBox="0 0 220 220" style={{ width: '100%', height: '100%' }}>
            {Number(totalCount) === 0 || segmentPaths.every(p => p === null) ? (
              <circle cx={cx} cy={cy} r={75} stroke="#E2E8F0" strokeWidth="18" fill="none" />
            ) : (
              segmentPaths
            )}
          </svg>

          {/* Center Counter */}
          <div 
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              padding: '10px'
            }}
          >
            {(() => {
              const displayVal = String(hoveredIdx !== null ? statusItems[hoveredIdx].count : totalCount);
              const valLen = displayVal.length;
              const dynamicFontSize = valLen > 10 ? '11px' : valLen > 7 ? '12.5px' : valLen > 4 ? '14px' : '16px';

              return (
                <span 
                  style={{ 
                    fontSize: dynamicFontSize, 
                    fontWeight: '900', 
                    color: hoveredIdx !== null ? statusItems[hoveredIdx].color : '#0F172A', 
                    lineHeight: '1.1',
                    textAlign: 'center',
                    maxWidth: '82px',
                    wordBreak: 'break-word',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {displayVal}
                </span>
              );
            })()}
            <span style={{ fontSize: '8px', color: '#64748B', fontWeight: '800', letterSpacing: '0.4px', marginTop: '2px', textTransform: 'uppercase', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '78px' }}>
              {hoveredIdx !== null ? statusItems[hoveredIdx].name : totalLabel}
            </span>
          </div>
        </div>

        {/* RIGHT SIDE: Legend Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: statusItems.length > 4 ? '4px' : '6px', flex: '1 1 130px', minWidth: '120px', height: '100%' }}>
          {statusItems.map((item, idx) => {
            const pctDisplay = `${Math.round((item.pct || 0) * 100)}%`;
            const isDense = statusItems.length > 4;

            return (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  gap: '4px',
                  cursor: 'pointer',
                  opacity: hoveredIdx !== null && hoveredIdx !== idx ? 0.45 : 1,
                  padding: isDense ? '4px 7px' : '5px 8px',
                  borderRadius: '8px',
                  backgroundColor: hoveredIdx === idx ? `${item.color}15` : '#F8FAFC',
                  border: hoveredIdx === idx ? `1px solid ${item.color}` : '1px solid #E2E8F0',
                  transition: 'all 0.2s ease',
                  minWidth: 0,
                  flex: 1
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                  <span style={{ 
                    width: isDense ? '7px' : '8px', 
                    height: isDense ? '7px' : '8px', 
                    borderRadius: '50%', 
                    backgroundColor: item.color, 
                    flexShrink: 0 
                  }} />
                  <span style={{ fontSize: isDense ? '10px' : '10.5px', fontWeight: '700', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <span style={{ fontSize: isDense ? '9.5px' : '10px', fontWeight: '700', color: '#64748B' }}>
                    {pctDisplay}
                  </span>
                  <span style={{ fontSize: isDense ? '11px' : '11.5px', fontWeight: '900', color: '#0F172A', minWidth: '18px', textAlign: 'right' }}>
                    {item.count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
