import React, { useState } from 'react';

export default function DailyProductionTrendChart({ title = "DAILY PRODUCTION TREND (NOS)", mainValue = "4,862 NOS" }) {
  const [filter, setFilter] = useState('Monthly');
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, label: '', value: 0 });

  // 12 Months data matching reference bar heights & sequence
  const data = [
    { label: 'Jan', val: 320 },
    { label: 'Feb', val: 410 },
    { label: 'Mar', val: 540 },
    { label: 'Apr', val: 780 },
    { label: 'May', val: 820 },
    { label: 'Jun', val: 690 },
    { label: 'Jul', val: 950 },
    { label: 'Aug', val: 880 },
    { label: 'Sep', val: 1100 },
    { label: 'Oct', val: 1280 },
    { label: 'Nov', val: 980 },
    { label: 'Dec', val: 1150 }
  ];

  const maxVal = 1500;
  const chartHeight = 170;
  const barWidth = 26;
  const barGap = 16;
  const startX = 45;
  const startY = 185;

  const yTicks = [
    { label: '1.5k', val: 1500 },
    { label: '1.25k', val: 1250 },
    { label: '1k', val: 1000 },
    { label: '750', val: 750 },
    { label: '500', val: 500 },
    { label: '250', val: 250 },
    { label: '0', val: 0 }
  ];

  // Ocean Teal-Blue color theme matching top bar
  const primaryBlue = '#0284C7';
  const hoverBlue = '#075985';

  return (
    <div 
      className="section-card" 
      style={{ 
        padding: '14px 18px', 
        backgroundColor: '#FFFFFF',
        border: '1px solid #EAEFEF',
        borderRadius: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxSizing: 'border-box',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        position: 'relative'
      }}
    >
      {/* Top Header: Left Title, Right Select Dropdown */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {title}
          </span>
        </div>

        {/* Top-Right Dropdown Filter with Monthly and Yearly */}
        <select 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ 
            fontSize: '12px', 
            fontWeight: '600', 
            color: '#475569', 
            backgroundColor: '#FFFFFF', 
            border: '1px solid #CBD5E1', 
            borderRadius: '8px', 
            padding: '5px 12px',
            outline: 'none',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <option value="Monthly">Monthly</option>
          <option value="Yearly">Yearly</option>
        </select>
      </div>

      {/* SVG Bar Chart with Ocean Teal-Blue theme */}
      <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0' }}>
        <svg width="100%" viewBox="0 0 560 225" style={{ overflow: 'visible', minWidth: '400px', height: 'auto' }}>
          {/* Y-Axis Grid Labels */}
          {yTicks.map((tick, idx) => {
            const yPos = startY - (tick.val / maxVal) * chartHeight;
            return (
              <g key={idx}>
                <text 
                  x="32" 
                  y={yPos + 4} 
                  fill="#94A3B8" 
                  fontSize="10" 
                  fontWeight="600" 
                  textAnchor="end"
                >
                  {tick.label}
                </text>
              </g>
            );
          })}

          {/* Ocean Teal-Blue Bars with Rounded Tops */}
          {data.map((item, idx) => {
            const xPos = startX + idx * (barWidth + barGap);
            const height = (item.val / maxVal) * chartHeight;
            const yPos = startY - height;
            const isHovered = hoveredIdx === idx;

            return (
              <g 
                key={idx}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  setHoveredIdx(idx);
                  setTooltip({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY - 40,
                    label: item.label,
                    value: item.val
                  });
                }}
                onMouseMove={(e) => {
                  setTooltip(prev => ({ ...prev, x: e.clientX, y: e.clientY - 40 }));
                }}
                onMouseLeave={() => {
                  setHoveredIdx(null);
                  setTooltip(prev => ({ ...prev, visible: false }));
                }}
              >
                {/* Rounded Top Bar in Ocean Teal-Blue */}
                <rect
                  x={xPos}
                  y={yPos}
                  width={barWidth}
                  height={height}
                  rx="6"
                  ry="6"
                  fill={isHovered ? hoverBlue : primaryBlue}
                  opacity={hoveredIdx !== null && !isHovered ? 0.55 : 1}
                  style={{
                    transition: 'all 0.2s ease',
                    filter: isHovered ? 'drop-shadow(0px 4px 10px rgba(2, 132, 199, 0.45))' : 'none'
                  }}
                />

                {/* X-Axis Month Labels */}
                <text
                  x={xPos + barWidth / 2}
                  y={startY + 18}
                  fill={isHovered ? '#0F172A' : '#94A3B8'}
                  fontSize="11"
                  fontWeight={isHovered ? '800' : '600'}
                  textAnchor="middle"
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Floating Hover Tooltip */}
      {tooltip.visible && (
        <div
          style={{
            position: 'fixed',
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: 'translate(-50%, -100%)',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            padding: '8px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: '700',
            pointerEvents: 'none',
            zIndex: 9999,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: primaryBlue }} />
          <span>{tooltip.label}:</span>
          <span style={{ color: '#38BDF8', fontWeight: '900' }}>{tooltip.value.toLocaleString()} NOS</span>
        </div>
      )}
    </div>
  );
}
