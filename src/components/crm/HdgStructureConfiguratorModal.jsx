import React, { useState, useMemo } from 'react';
import {
  X, Zap, Check, CheckCircle, Sliders, Layers, RefreshCw,
  FileText, ShieldCheck, DollarSign, ChevronDown, ChevronUp,
  Info, ArrowRight, Boxes, Wrench, Scale, Search,
  Sun, Eye, Compass, LayoutGrid, CheckSquare, Square, Maximize2
} from 'lucide-react';
import {
  C_SECTION_LEG_WEIGHTS,
  SHS_LEG_WEIGHTS,
  C_SECTION_LEG_PAIRS,
  SHS_LEG_PAIRS,
  DEFAULT_RAW_MATERIAL_RATES,
  calculateHdgStructure
} from '../../utils/hdgStructureConfigurator';

/**
 * High-Definition Interactive 2D Solar Table Schematic (Side Elevation & Top Layout)
 */
function SolarTableSchematicFullView({
  columnProfile,
  rowModel,
  tableSize,
  leg1Height,
  leg2Height,
  hasBracing,
  hasCrossBracing,
  totalPanels,
  capacityKw,
  totalPanelsPerTable,
  capacityKwPerTable
}) {
  // Canvas coordinate constants (760 x 300)
  const groundY = 230;
  const leg1X = 180;
  const leg2X = 540;

  // Scale leg heights
  const scaleLeg = (h) => {
    const minH = 900;
    const maxH = 3000;
    const clamped = Math.max(minH, Math.min(maxH, h));
    return 65 + ((clamped - minH) / (maxH - minH)) * 105;
  };

  const leg1Px = scaleLeg(leg1Height);
  const leg2Px = scaleLeg(leg2Height);

  const leg1TopY = groundY - leg1Px;
  const leg2TopY = groundY - leg2Px;

  // Rafter endpoints
  const rafterStartX = leg1X - 60;
  const rafterEndX = leg2X + 80;
  const slope = (leg2TopY - leg1TopY) / (leg2X - leg1X);
  const rafterStartY = leg1TopY + slope * (rafterStartX - leg1X);
  const rafterEndY = leg2TopY + slope * (rafterEndX - leg2X);
  const rafterMidX = (rafterStartX + rafterEndX) / 2;
  const rafterMidY = (rafterStartY + rafterEndY) / 2;

  // Center Leg for 3-Row (intermediate column connects directly to sloping rafter)
  const is3Row = rowModel === '3 Row';
  const leg3X = (leg1X + leg2X) / 2;
  const leg3TopY = leg1TopY + slope * (leg3X - leg1X);
  const leg3Px = Math.max(0, groundY - leg3TopY);
  const leg3HeightMm = Math.round(leg1Height + (leg2Height - leg1Height) * 0.5);

  // Purlins count & positions
  const purlinCount = rowModel === '1 Row' ? 2 : rowModel === '2 Row' ? 4 : 6;
  const purlinPoints = [];
  for (let i = 0; i < purlinCount; i++) {
    const t = (i + 0.5) / purlinCount;
    const px = rafterStartX + t * (rafterEndX - rafterStartX);
    const py = rafterStartY + t * (rafterEndY - rafterStartY);
    purlinPoints.push({ x: px, y: py });
  }

  // Tilt angle
  const angleDeg = Math.round(Math.atan2(Math.abs(leg2Height - leg1Height), 1800) * (180 / Math.PI));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Main Architectural Side Elevation Canvas */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '18px 22px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Title & Dimension Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#ECFEFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Sun size={18} style={{ color: '#0E7490' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '900', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Architectural Side Elevation View
                </span>
                <span style={{
                  backgroundColor: '#F0FDFA',
                  color: '#0D9488',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '800'
                }}>
                  Scale 1:20 Graphic
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748B' }}>
                Live dimensioned profile showing columns, base footings, sloping rafter, purlins & bracing
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '6px 12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Structure Tilt</div>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#0E7490' }}>~{angleDeg}° Angle</div>
            </div>
            <div style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '6px 12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Capacity / Table</div>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#0F766E' }}>{capacityKwPerTable} kWp</div>
            </div>
          </div>
        </div>

        {/* Large SVG Drawing */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '280px',
          backgroundColor: '#F8FAFC',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #E2E8F0'
        }}>
          <svg
            viewBox="0 0 760 300"
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <defs>
              <pattern id="full-ground-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="10" stroke="#E2E8F0" strokeWidth="1.2" />
              </pattern>
              <linearGradient id="full-pv-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1E3A8A" />
                <stop offset="50%" stopColor="#2563EB" />
                <stop offset="100%" stopColor="#1D4ED8" />
              </linearGradient>
              <linearGradient id="full-rafter-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#0E7490" />
              </marker>
            </defs>

            {/* Ground Line & Hatching */}
            <rect x="0" y={groundY} width="760" height={300 - groundY} fill="url(#full-ground-hatch)" />
            <line x1="0" y1={groundY} x2="760" y2={groundY} stroke="#64748B" strokeWidth="2.5" />

            {/* Datum Elevation Level Marker (positioned safely on left margin to prevent any text overlap) */}
            <g transform={`translate(16, ${groundY})`}>
              <path d="M 0 0 L 8 -10 L 16 0 Z" fill="#0E7490" />
              <line x1="8" y1="-10" x2="8" y2="0" stroke="#0E7490" strokeWidth="1.5" />
              <text x="22" y="-3" fontSize="10" fontWeight="900" fill="#0E7490" letterSpacing="0.4">
                GL ±0.00
              </text>
              <text x="0" y="16" fontSize="9" fontWeight="800" fill="#64748B" letterSpacing="0.3">
                DATUM LEVEL
              </text>
            </g>

            {/* Concrete Pedestals / Footings */}
            {/* Front Footing */}
            <rect x={leg1X - 26} y={groundY} width="52" height="18" rx="2" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
            <rect x={leg1X - 20} y={groundY - 7} width="40" height="8" rx="2" fill="#64748B" />
            <line x1={leg1X - 14} y1={groundY - 7} x2={leg1X - 14} y2={groundY + 12} stroke="#334155" strokeWidth="2" strokeDasharray="3 1" />
            <line x1={leg1X + 14} y1={groundY - 7} x2={leg1X + 14} y2={groundY + 12} stroke="#334155" strokeWidth="2" strokeDasharray="3 1" />

            {/* Rear Footing */}
            <rect x={leg2X - 26} y={groundY} width="52" height="18" rx="2" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
            <rect x={leg2X - 20} y={groundY - 7} width="40" height="8" rx="2" fill="#64748B" />
            <line x1={leg2X - 14} y1={groundY - 7} x2={leg2X - 14} y2={groundY + 12} stroke="#334155" strokeWidth="2" strokeDasharray="3 1" />
            <line x1={leg2X + 14} y1={groundY - 7} x2={leg2X + 14} y2={groundY + 12} stroke="#334155" strokeWidth="2" strokeDasharray="3 1" />

            {/* Front Column Leg-1 */}
            <rect
              x={leg1X - 7}
              y={leg1TopY}
              width="14"
              height={leg1Px}
              rx="2"
              fill={columnProfile === 'Square Tube' ? '#0284C7' : '#0E7490'}
              stroke="#083344"
              strokeWidth="0.8"
            />

            {/* Rear Column Leg-2 */}
            <rect
              x={leg2X - 7}
              y={leg2TopY}
              width="14"
              height={leg2Px}
              rx="2"
              fill={columnProfile === 'Square Tube' ? '#0284C7' : '#0E7490'}
              stroke="#083344"
              strokeWidth="0.8"
            />

            {/* Optional Center Leg-3 (for 3-Row) */}
            {is3Row && (
              <g>
                <rect x={leg3X - 26} y={groundY} width="52" height="18" rx="2" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="1" />
                <rect x={leg3X - 20} y={groundY - 7} width="40" height="8" rx="2" fill="#64748B" />
                <line x1={leg3X - 14} y1={groundY - 7} x2={leg3X - 14} y2={groundY + 12} stroke="#334155" strokeWidth="2" strokeDasharray="3 1" />
                <line x1={leg3X + 14} y1={groundY - 7} x2={leg3X + 14} y2={groundY + 12} stroke="#334155" strokeWidth="2" strokeDasharray="3 1" />
                <rect
                  x={leg3X - 7}
                  y={leg3TopY}
                  width="14"
                  height={leg3Px}
                  rx="2"
                  fill={columnProfile === 'Square Tube' ? '#0284C7' : '#0E7490'}
                  stroke="#083344"
                  strokeWidth="0.8"
                />
                {/* Rafter Cleat Node connecting Center Column Leg to Rafter */}
                <circle cx={leg3X} cy={leg3TopY} r="6" fill="#334155" stroke="white" strokeWidth="1.5" />
              </g>
            )}

            {/* Diagonal Bracing Struts */}
            {hasBracing ? (
              <g>
                {/* Diagonal 1 */}
                <line
                  x1={leg1X}
                  y1={groundY - 24}
                  x2={leg2X}
                  y2={leg2TopY + 22}
                  stroke="#10B981"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                {/* Diagonal 2 */}
                <line
                  x1={leg2X}
                  y1={groundY - 24}
                  x2={leg1X}
                  y2={leg1TopY + 22}
                  stroke="#10B981"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                {/* Bracing Plate Connection Nodes */}
                <circle cx={leg1X} cy={groundY - 24} r="5" fill="#047857" stroke="white" strokeWidth="1.5" />
                <circle cx={leg2X} cy={leg2TopY + 22} r="5" fill="#047857" stroke="white" strokeWidth="1.5" />
                <circle cx={leg2X} cy={groundY - 24} r="5" fill="#047857" stroke="white" strokeWidth="1.5" />
                <circle cx={leg1X} cy={leg1TopY + 22} r="5" fill="#047857" stroke="white" strokeWidth="1.5" />
                <rect
                  x={is3Row ? (leg1X + leg3X) / 2 - 42 : 330}
                  y={groundY - 45}
                  width="84"
                  height="20"
                  rx="10"
                  fill="#10B981"
                />
                <text
                  x={is3Row ? (leg1X + leg3X) / 2 : 372}
                  y={groundY - 31}
                  fontSize="10"
                  fontWeight="900"
                  fill="white"
                  textAnchor="middle"
                >
                  BRACING ACTIVE
                </text>
              </g>
            ) : (
              <g>
                <line
                  x1={leg1X}
                  y1={groundY - 20}
                  x2={leg2X}
                  y2={leg2TopY + 20}
                  stroke="#CBD5E1"
                  strokeWidth="1.5"
                  strokeDasharray="5 3"
                />
                <line
                  x1={leg2X}
                  y1={groundY - 20}
                  x2={leg1X}
                  y2={leg1TopY + 20}
                  stroke="#CBD5E1"
                  strokeWidth="1.5"
                  strokeDasharray="5 3"
                />
              </g>
            )}

            {/* Cross Bracing Marker */}
            {hasCrossBracing && (
              <g>
                <rect
                  x={is3Row ? (leg3X + leg2X) / 2 - 48 : 290}
                  y={groundY - 75}
                  width="96"
                  height="20"
                  rx="10"
                  fill="#0891B2"
                />
                <text
                  x={is3Row ? (leg3X + leg2X) / 2 : 338}
                  y={groundY - 61}
                  fontSize="10"
                  fontWeight="900"
                  fill="white"
                  textAnchor="middle"
                >
                  CROSS BRACED
                </text>
              </g>
            )}

            {/* Sloping Rafter Beam */}
            <line
              x1={rafterStartX}
              y1={rafterStartY}
              x2={rafterEndX}
              y2={rafterEndY}
              stroke="url(#full-rafter-grad)"
              strokeWidth="9"
              strokeLinecap="round"
            />

            {/* Rafter Cleats connecting to Leg Tops */}
            <circle cx={leg1X} cy={leg1TopY} r="6" fill="#334155" stroke="white" strokeWidth="1.5" />
            <circle cx={leg2X} cy={leg2TopY} r="6" fill="#334155" stroke="white" strokeWidth="1.5" />

            {/* Purlins running across the Rafter */}
            {purlinPoints.map((pt, i) => (
              <g key={i}>
                <rect
                  x={pt.x - 5}
                  y={pt.y - 10}
                  width="10"
                  height="10"
                  rx="2"
                  fill="#475569"
                  stroke="#1E293B"
                  strokeWidth="1"
                  transform={`rotate(${angleDeg}, ${pt.x}, ${pt.y})`}
                />
              </g>
            ))}

            {/* Mounted Solar PV Panels (Detailed with 3 cells per row) */}
            {(() => {
              const panelsPerCol = rowModel === '1 Row' ? 1 : rowModel === '2 Row' ? 2 : 3;
              const panelWidth = (rafterEndX - rafterStartX - 24) / panelsPerCol;
              const panels = [];
              for (let p = 0; p < panelsPerCol; p++) {
                const pStart = rafterStartX + 12 + p * panelWidth;
                const pEnd = pStart + panelWidth - 6;
                const pStartY = rafterStartY + slope * (pStart - rafterStartX) - 12;
                const pEndY = rafterStartY + slope * (pEnd - rafterStartX) - 12;

                panels.push(
                  <g key={p}>
                    {/* Solar panel surface */}
                    <line
                      x1={pStart}
                      y1={pStartY}
                      x2={pEnd}
                      y2={pEndY}
                      stroke="url(#full-pv-grad)"
                      strokeWidth="12"
                      strokeLinecap="round"
                    />
                    {/* Panel frame border */}
                    <line
                      x1={pStart}
                      y1={pStartY}
                      x2={pEnd}
                      y2={pEndY}
                      stroke="#93C5FD"
                      strokeWidth="1.5"
                    />
                    {/* Cell divider lines */}
                    <circle cx={(pStart + pEnd) / 2} cy={(pStartY + pEndY) / 2} r="2" fill="white" />
                  </g>
                );
              }
              return panels;
            })()}

            {/* Dimension Lines & Height Callouts */}
            {/* Front Leg-1 Height Line */}
            <line x1={leg1X - 25} y1={groundY} x2={leg1X - 25} y2={leg1TopY} stroke="#0E7490" strokeWidth="1.5" />
            <line x1={leg1X - 32} y1={groundY} x2={leg1X - 18} y2={groundY} stroke="#0E7490" strokeWidth="1.5" />
            <line x1={leg1X - 32} y1={leg1TopY} x2={leg1X - 18} y2={leg1TopY} stroke="#0E7490" strokeWidth="1.5" />
            <rect x={leg1X - 70} y={(groundY + leg1TopY) / 2 - 12} width="56" height="22" rx="4" fill="white" stroke="#0E7490" strokeWidth="1" />
            <text x={leg1X - 42} y={(groundY + leg1TopY) / 2 + 3} fontSize="11" fontWeight="900" fill="#0E7490" textAnchor="middle">
              {leg1Height} mm
            </text>

            {/* Rear Leg-2 Height Line */}
            <line x1={leg2X + 25} y1={groundY} x2={leg2X + 25} y2={leg2TopY} stroke="#0E7490" strokeWidth="1.5" />
            <line x1={leg2X + 18} y1={groundY} x2={leg2X + 32} y2={groundY} stroke="#0E7490" strokeWidth="1.5" />
            <line x1={leg2X + 18} y1={leg2TopY} x2={leg2X + 32} y2={leg2TopY} stroke="#0E7490" strokeWidth="1.5" />
            <rect x={leg2X + 28} y={(groundY + leg2TopY) / 2 - 12} width="56" height="22" rx="4" fill="white" stroke="#0E7490" strokeWidth="1" />
            <text x={leg2X + 56} y={(groundY + leg2TopY) / 2 + 3} fontSize="11" fontWeight="900" fill="#0E7490" textAnchor="middle">
              {leg2Height} mm
            </text>

            {/* Column Labels */}
            <text x={leg1X} y={groundY + 38} fontSize="11" fontWeight="800" fill="#0E7490" textAnchor="middle">
              Leg-1 (Front: {leg1Height}mm)
            </text>
            {is3Row && (
              <text x={leg3X} y={groundY + 38} fontSize="11" fontWeight="800" fill="#0E7490" textAnchor="middle">
                Center Leg-3 ({leg3HeightMm}mm)
              </text>
            )}
            <text x={leg2X} y={groundY + 38} fontSize="11" fontWeight="800" fill="#0E7490" textAnchor="middle">
              Leg-2 (Rear: {leg2Height}mm)
            </text>

            {/* Sloping Rafter Callout Badge (Floating Pill Badge Above Solar Panels - Zero Overlap) */}
            <g transform={`translate(${rafterMidX}, ${rafterMidY - 32})`}>
              <rect
                x="-125"
                y="-12"
                width="250"
                height="24"
                rx="12"
                fill="#FFFBEB"
                stroke="#D97706"
                strokeWidth="1.2"
                filter="drop-shadow(0 1px 2px rgba(0,0,0,0.06))"
              />
              <text
                x="0"
                y="4"
                fontSize="11"
                fontWeight="900"
                fill="#B45309"
                textAnchor="middle"
              >
                Galvalume Rafter ({rowModel} Slope • ~{angleDeg}°)
              </text>
            </g>
          </svg>
        </div>

        {/* Technical Callout Badges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '4px' }}>
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Column Section</div>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
              {columnProfile === 'Square Tube' ? 'SHS 60×60 (2mm)' : 'CS 100×50×15 (2mm)'}
            </div>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Rafter Beam</div>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
              CS 80×40×15 (1.6mm)
            </div>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Purlins Span</div>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
              CS 70×40×15 (1.2mm)
            </div>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Foundation Base</div>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
              P - 150/200 (5mm HDG)
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top View PV Module Layout Grid (2D Table Layout) */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #E2E8F0',
        padding: '16px 22px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LayoutGrid size={16} style={{ color: '#2563EB' }} />
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Top View: Module Layout Grid ({totalPanelsPerTable} Panels / Table)
              </span>
              <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: '#64748B' }}>
                {rowModel} Orientation × {tableSize} Columns • 550W Standard Half-Cut PV Modules
              </p>
            </div>
          </div>

          <span style={{ fontSize: '11px', fontWeight: '800', color: '#2563EB', backgroundColor: '#EFF6FF', padding: '3px 8px', borderRadius: '6px' }}>
            {capacityKwPerTable} kWp per Table
          </span>
        </div>

        {/* Visual Modules Grid */}
        <div style={{
          backgroundColor: '#F8FAFC',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {Array.from({ length: rowModel === '1 Row' ? 1 : rowModel === '2 Row' ? 2 : 3 }).map((_, rIdx) => (
            <div key={rIdx} style={{ display: 'grid', gridTemplateColumns: `repeat(${tableSize}, 1fr)`, gap: '8px' }}>
              {Array.from({ length: tableSize }).map((_, cIdx) => (
                <div
                  key={cIdx}
                  style={{
                    height: '50px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 50%, #1D4ED8 100%)',
                    border: '1px solid #93C5FD',
                    boxShadow: '0 1px 3px rgba(37,99,235,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    position: 'relative'
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: '800', opacity: 0.95 }}>
                    PV-{rIdx + 1}.{cIdx + 1}
                  </span>
                  <span style={{ fontSize: '8px', opacity: 0.8 }}>550W</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HdgStructureConfiguratorModal({
  isOpen,
  onClose,
  onApplyToQuote,
  initialData = {}
}) {
  if (!isOpen) return null;

  // Configuration State
  const [columnProfile, setColumnProfile] = useState(initialData.columnProfile || 'C Section');
  const [rowModel, setRowModel] = useState(initialData.rowModel || '2 Row');
  const [tableSize, setTableSize] = useState(initialData.tableSize || 3);
  const [setCount, setSetCount] = useState(initialData.setCount || 1);

  // Leg Heights
  const [selectedPairIndex, setSelectedPairIndex] = useState(0);
  const [customLegs, setCustomLegs] = useState(false);
  const [leg1Height, setLeg1Height] = useState(900);
  const [leg2Height, setLeg2Height] = useState(1500);

  // Bracing Toggles
  const [hasBracing, setHasBracing] = useState(initialData.hasBracing ?? false);
  const [hasCrossBracing, setHasCrossBracing] = useState(initialData.hasCrossBracing ?? false);

  // Raw Material Rates
  const [showRatesDrawer, setShowRatesDrawer] = useState(false);
  const [hdgRate, setHdgRate] = useState(DEFAULT_RAW_MATERIAL_RATES.hdgRate);
  const [galvalRate, setGalvalRate] = useState(DEFAULT_RAW_MATERIAL_RATES.galvalRate);
  const [allenM8Rate, setAllenM8Rate] = useState(DEFAULT_RAW_MATERIAL_RATES.allenM8);
  const [hexM12Rate, setHexM12Rate] = useState(DEFAULT_RAW_MATERIAL_RATES.hexM12);
  const [hexM10Rate, setHexM10Rate] = useState(DEFAULT_RAW_MATERIAL_RATES.hexM10);
  const [anchorM10Rate, setAnchorM10Rate] = useState(DEFAULT_RAW_MATERIAL_RATES.anchorM10);

  // BOM search filter
  const [bomSearch, setBomSearch] = useState('');

  // Insertion Mode ('group' | 'itemized')
  const [insertionMode, setInsertionMode] = useState('group');

  // Preview Tab: default to 'schematic' so user can view full architectural drawing!
  const [activeTab, setActiveTab] = useState('schematic'); // 'schematic' | 'bom' | 'accessories' | 'terms'

  // Handle Profile Change (adjust leg pairs)
  const handleProfileChange = (profile) => {
    setColumnProfile(profile);
    setSelectedPairIndex(0);
    setCustomLegs(false);
    if (profile === 'Square Tube') {
      setLeg1Height(2100);
      setLeg2Height(2500);
    } else {
      setLeg1Height(900);
      setLeg2Height(1500);
    }
  };

  // Handle Leg Pair Preset Selection
  const handlePairSelect = (idx) => {
    setSelectedPairIndex(idx);
    setCustomLegs(false);
    const pairs = columnProfile === 'Square Tube' ? SHS_LEG_PAIRS : C_SECTION_LEG_PAIRS;
    const pair = pairs[idx];
    if (pair) {
      setLeg1Height(pair.leg1);
      setLeg2Height(pair.leg2);
    }
  };

  // Reset Rates to Default
  const handleResetRates = () => {
    setHdgRate(DEFAULT_RAW_MATERIAL_RATES.hdgRate);
    setGalvalRate(DEFAULT_RAW_MATERIAL_RATES.galvalRate);
    setAllenM8Rate(DEFAULT_RAW_MATERIAL_RATES.allenM8);
    setHexM12Rate(DEFAULT_RAW_MATERIAL_RATES.hexM12);
    setHexM10Rate(DEFAULT_RAW_MATERIAL_RATES.hexM10);
    setAnchorM10Rate(DEFAULT_RAW_MATERIAL_RATES.anchorM10);
  };

  // Live Calculation
  const result = useMemo(() => {
    return calculateHdgStructure({
      columnProfile,
      rowModel,
      tableSize,
      leg1Height,
      leg2Height,
      hasBracing,
      hasCrossBracing,
      hdgRate,
      galvalRate,
      fastenerRates: {
        allenM8: allenM8Rate,
        hexM12: hexM12Rate,
        hexM10: hexM10Rate,
        anchorM10: anchorM10Rate
      },
      setCount
    });
  }, [
    columnProfile, rowModel, tableSize, leg1Height, leg2Height,
    hasBracing, hasCrossBracing, hdgRate, galvalRate,
    allenM8Rate, hexM12Rate, hexM10Rate, anchorM10Rate, setCount
  ]);

  // Derived wattage calculations
  const totalPanelsPerTable = (rowModel === '1 Row' ? 1 : rowModel === '2 Row' ? 2 : 3) * tableSize;
  const totalPanels = totalPanelsPerTable * setCount;
  const capacityKw = ((totalPanels * 550) / 1000).toFixed(2);
  const capacityKwPerTable = ((totalPanelsPerTable * 550) / 1000).toFixed(2);
  const totalWatts = totalPanels * 550;
  const ratePerWatt = totalWatts > 0 ? (result.totalQuotedPrice / totalWatts).toFixed(2) : '0.00';

  // Filtered BOM parts for search
  const filteredParts = useMemo(() => {
    if (!bomSearch.trim()) return result.parts;
    const q = bomSearch.toLowerCase().trim();
    return result.parts.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.section.toLowerCase().includes(q) ||
      p.material.toLowerCase().includes(q)
    );
  }, [result.parts, bomSearch]);

  // Apply to Quotation Handler
  const handleApply = () => {
    if (!onApplyToQuote) return;

    const mult = Math.max(1, parseInt(setCount) || 1);
    const grpId = 'hdg_cfg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const grpTitle = `${columnProfile === 'Square Tube' ? 'SHS' : 'HDG C-Section'} ${result.tableTitle}`;

    const generatedItems = [];

    if (insertionMode === 'group') {
      result.parts.forEach(p => {
        generatedItems.push({
          name: `${p.name} (${p.section})`,
          category: `L:${p.length}mm | Thk:${p.thickness}mm | ${p.material} | Unit Wt:${p.unitWeight.toFixed(2)}kg`,
          uom: 'NOS',
          baseQty: p.qty,
          qty: String(p.qty * mult),
          rate: '0',
          gstRate: '18%',
          isPresetItem: true,
          presetGroupId: grpId,
          presetName: grpTitle,
          specDetails: {
            length: p.length,
            section: p.section,
            thickness: p.thickness,
            material: p.material,
            unitWeight: p.unitWeight,
            totalWeight: p.totalWeight * mult
          }
        });
      });

      result.accessories.forEach(acc => {
        if (acc.qty > 0) {
          generatedItems.push({
            name: `${acc.supply}`,
            category: `Purpose: ${acc.purpose} | Size: ${acc.size} | ${acc.material}`,
            uom: 'NOS',
            baseQty: acc.qty,
            qty: String(acc.qty * mult),
            rate: '0',
            gstRate: '18%',
            isPresetItem: true,
            presetGroupId: grpId,
            presetName: grpTitle,
            specDetails: {
              purpose: acc.purpose,
              size: acc.size,
              material: acc.material,
              unitPrice: acc.unitPrice
            }
          });
        }
      });

      onApplyToQuote({
        mode: 'group',
        groupId: grpId,
        groupTitle: grpTitle,
        kitPrice: String(result.quotedPrice),
        setCount: mult,
        items: generatedItems,
        result
      });
    } else {
      result.parts.forEach(p => {
        const itemRate = p.qty > 0 ? (p.cost / p.qty).toFixed(2) : '0';
        generatedItems.push({
          name: `${p.name} - ${p.section}`,
          category: `Length: ${p.length}mm | Thk: ${p.thickness}mm | Material: ${p.material} | Wt: ${p.unitWeight.toFixed(2)} kg`,
          uom: 'NOS',
          qty: String(p.qty * mult),
          rate: itemRate,
          gstRate: '18%',
          isPresetItem: false
        });
      });

      result.accessories.forEach(acc => {
        if (acc.qty > 0) {
          generatedItems.push({
            name: `${acc.supply}`,
            category: `${acc.purpose} (${acc.size} - ${acc.material})`,
            uom: 'NOS',
            qty: String(acc.qty * mult),
            rate: String(acc.unitPrice),
            gstRate: '18%',
            isPresetItem: false
          });
        }
      });

      onApplyToQuote({
        mode: 'itemized',
        groupId: null,
        groupTitle: grpTitle,
        kitPrice: null,
        setCount: mult,
        items: generatedItems,
        result
      });
    }

    onClose();
  };

  const currentPairs = columnProfile === 'Square Tube' ? SHS_LEG_PAIRS : C_SECTION_LEG_PAIRS;
  const availableLegHeights = columnProfile === 'Square Tube'
    ? [2100, 2500, 3000]
    : Object.keys(C_SECTION_LEG_WEIGHTS).map(Number).sort((a, b) => a - b);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '22px',
        width: '100%',
        maxWidth: '1320px',
        maxHeight: '96vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8)',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* 1. Header (Clean Light Gradient) */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #075985 0%, #0E7490 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(14, 116, 144, 0.25)'
            }}>
              <Zap style={{ width: '20px', height: '20px', color: '#FDE047' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0F172A', letterSpacing: '-0.3px' }}>
                  Solar HDG Structure Configurator
                </h2>
                <span style={{
                  backgroundColor: '#ECFEFF',
                  color: '#0E7490',
                  border: '1px solid #CFFAFE',
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  Live Quotation Engine
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                C-Section 100×50×15 & Square Tube 60×60 • Pre-Engineered Unified 1-Row, 2-Row & 3-Row Tables
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setShowRatesDrawer(!showRatesDrawer)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: showRatesDrawer ? '#ECFEFF' : '#F8FAFC',
                color: showRatesDrawer ? '#0E7490' : '#475569',
                border: '1px solid',
                borderColor: showRatesDrawer ? '#A5F3FC' : '#CBD5E1',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Sliders size={14} />
              <span>Rates & Pricing ({showRatesDrawer ? 'Close' : 'Edit'})</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#F1F5F9',
                border: 'none',
                color: '#64748B',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 2. Collapsible Rates Drawer */}
        {showRatesDrawer && (
          <div style={{
            backgroundColor: '#FFFFFF',
            borderBottom: '2px solid #E2E8F0',
            padding: '14px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={14} style={{ color: '#0E7490' }} />
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>
                  Raw Material & Fastener Pricing Overrides
                </span>
                <span style={{ fontSize: '11px', color: '#64748B' }}>
                  (Dynamic weight and hardware rates update all calculations immediately)
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetRates}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: '#0E7490',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={11} />
                <span>Reset to Standard Defaults</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                  HDG Price (₹/kg)
                </label>
                <input
                  type="number"
                  value={hdgRate}
                  onChange={e => setHdgRate(e.target.value)}
                  style={{ width: '100%', height: '34px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '12px', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                  Galvalume (₹/kg)
                </label>
                <input
                  type="number"
                  value={galvalRate}
                  onChange={e => setGalvalRate(e.target.value)}
                  style={{ width: '100%', height: '34px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '12px', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                  Allen M8x20 (₹)
                </label>
                <input
                  type="number"
                  value={allenM8Rate}
                  onChange={e => setAllenM8Rate(e.target.value)}
                  style={{ width: '100%', height: '34px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '12px', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                  Hex M12x30 (₹)
                </label>
                <input
                  type="number"
                  value={hexM12Rate}
                  onChange={e => setHexM12Rate(e.target.value)}
                  style={{ width: '100%', height: '34px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '12px', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                  Hex M10x30 (₹)
                </label>
                <input
                  type="number"
                  value={hexM10Rate}
                  onChange={e => setHexM10Rate(e.target.value)}
                  style={{ width: '100%', height: '34px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '12px', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                  Anchor M10x100 (₹)
                </label>
                <input
                  type="number"
                  value={anchorM10Rate}
                  onChange={e => setAnchorM10Rate(e.target.value)}
                  style={{ width: '100%', height: '34px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 8px', fontSize: '12px', fontWeight: '700', color: '#0F172A', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 4. Split Two-Column Body */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '430px 1fr',
          overflow: 'hidden',
          flex: 1
        }}>
          {/* Left Column: Parameter Selection Form */}
          <div style={{
            padding: '20px 24px',
            backgroundColor: '#FAFAFA',
            borderRight: '1px solid #E2E8F0',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Step 1: Column Profile */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  1. Column Profile
                </label>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490' }}>
                  {columnProfile === 'C Section' ? 'CS 100×50×15' : 'SHS 60×60'}
                </span>
              </div>
              <select
                value={columnProfile}
                onChange={e => handleProfileChange(e.target.value)}
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
                <option value="C Section">C Section — CS 100×50×15 (2.0mm HDG)</option>
                <option value="Square Tube">Square Tube — SHS 60×60 (2.0mm Heavy Duty)</option>
              </select>
            </div>

            {/* Step 2: Row Model */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  2. Row Model
                </label>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490' }}>
                  {rowModel} Portrait
                </span>
              </div>
              <select
                value={rowModel}
                onChange={e => setRowModel(e.target.value)}
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
                <option value="1 Row">1 Row (Single Row Portrait • Compact Shed)</option>
                <option value="2 Row">2 Row (Double Row Portrait • Standard Rooftop)</option>
                <option value="3 Row">3 Row (Triple Row Portrait • High Capacity 3-Leg)</option>
              </select>
            </div>

            {/* Step 3: Table Size (Modules per Table) */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  3. Table Size (Modules per Table)
                </label>
                <span style={{
                  backgroundColor: '#F0FDFA',
                  color: '#0D9488',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '800'
                }}>
                  {totalPanelsPerTable} Modules • {capacityKwPerTable} kWp
                </span>
              </div>
              <select
                value={tableSize}
                onChange={e => setTableSize(Number(e.target.value))}
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
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(sz => {
                  const pCount = (rowModel === '1 Row' ? 1 : rowModel === '2 Row' ? 2 : 3) * sz;
                  const kw = ((pCount * 550) / 1000).toFixed(2);
                  return (
                    <option key={sz} value={sz}>
                      {sz} Columns ({pCount} Solar Panels • ~{kw} kWp)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Step 4: Leg Heights (mm) */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  4. Leg Heights (mm)
                </label>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490' }}>
                  L1: {leg1Height}mm / L2: {leg2Height}mm
                </span>
              </div>
              <select
                value={customLegs ? 'custom' : selectedPairIndex}
                onChange={e => {
                  if (e.target.value === 'custom') {
                    setCustomLegs(true);
                  } else {
                    handlePairSelect(Number(e.target.value));
                  }
                }}
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
                {currentPairs.map((pair, idx) => (
                  <option key={idx} value={idx}>
                    {pair.label} (Front: {pair.leg1}mm / Rear: {pair.leg2}mm)
                  </option>
                ))}
                <option value="custom">Custom Heights (Specify Front & Rear)</option>
              </select>

              {customLegs && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Front Leg-1
                    </label>
                    <select
                      value={leg1Height}
                      onChange={e => setLeg1Height(Number(e.target.value))}
                      style={{
                        width: '100%',
                        height: '36px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        padding: '0 8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0F172A',
                        backgroundColor: 'white'
                      }}
                    >
                      {availableLegHeights.map(h => (
                        <option key={h} value={h}>{h} mm</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Rear Leg-2
                    </label>
                    <select
                      value={leg2Height}
                      onChange={e => setLeg2Height(Number(e.target.value))}
                      style={{
                        width: '100%',
                        height: '36px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        padding: '0 8px',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#0F172A',
                        backgroundColor: 'white'
                      }}
                    >
                      {availableLegHeights.map(h => (
                        <option key={h} value={h}>{h} mm</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Step 5: Structural Bracing */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  5. Structural Bracing
                </label>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '800',
                  color: (hasBracing || hasCrossBracing) ? '#0D9488' : '#64748B'
                }}>
                  {hasBracing && hasCrossBracing ? 'Bracing + Cross' : hasBracing ? 'Bracing Active' : hasCrossBracing ? 'Cross Braced' : 'No Bracing'}
                </span>
              </div>
              <select
                value={
                  hasBracing && hasCrossBracing ? 'both' :
                  hasBracing ? 'bracing' :
                  hasCrossBracing ? 'cross' : 'none'
                }
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'none') {
                    setHasBracing(false);
                    setHasCrossBracing(false);
                  } else if (val === 'bracing') {
                    setHasBracing(true);
                    setHasCrossBracing(false);
                  } else if (val === 'cross') {
                    setHasBracing(false);
                    setHasCrossBracing(true);
                  } else if (val === 'both') {
                    setHasBracing(true);
                    setHasCrossBracing(true);
                  }
                }}
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
                <option value="none">No Bracing (Standard Rigid Rafter)</option>
                <option value="bracing">Bracing Active (Diagonal Struts & Cleats)</option>
                <option value="cross">Cross Braced Only (X-Pattern Bracing)</option>
                <option value="both">Bracing + Cross Braced (Heavy Duty Maximum Wind Resistance)</option>
              </select>
            </div>

            {/* Step 6: Number of Tables / Sets */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  6. Number of Tables / Sets
                </label>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490' }}>
                  {totalPanels} Total Panels • {capacityKw} kWp
                </span>
              </div>
              <select
                value={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100].includes(setCount) ? setCount : 'custom'}
                onChange={e => {
                  if (e.target.value === 'custom') {
                    // keep current value
                  } else {
                    setSetCount(Number(e.target.value));
                  }
                }}
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
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100].map(cnt => {
                  const pTotal = totalPanelsPerTable * cnt;
                  const kwTotal = ((pTotal * 550) / 1000).toFixed(2);
                  return (
                    <option key={cnt} value={cnt}>
                      {cnt} Table{cnt > 1 ? 's' : ''} ({pTotal} Solar Panels • {kwTotal} kWp)
                    </option>
                  );
                })}
                <option value="custom">Custom Quantity...</option>
              </select>

              {![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100].includes(setCount) && (
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={setCount}
                    onChange={e => setSetCount(Math.max(1, parseInt(e.target.value) || 1))}
                    placeholder="Enter table count..."
                    style={{
                      width: '100%',
                      height: '36px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      padding: '0 10px',
                      fontSize: '13px',
                      fontWeight: '700',
                      color: '#0F172A'
                    }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', whiteSpace: 'nowrap' }}>
                    Tables
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live Schematic, Pricing & Detailed BOM */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#FFFFFF',
            overflow: 'hidden'
          }}>
            {/* Top Compact Pricing & Metric Summary Card */}
            <div style={{
              padding: '14px 24px',
              backgroundColor: '#FAFAFA',
              borderBottom: '1px solid #E2E8F0',
              flexShrink: 0
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #F0FDFA 0%, #ECFEFF 100%)',
                border: '1px solid #CCFBF1',
                borderRadius: '14px',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 6px rgba(14, 116, 144, 0.05)'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{
                      backgroundColor: '#0E7490',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}>
                      {result.tableTitle}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#0F766E' }}>
                      Profile: {columnProfile} • {totalPanelsPerTable} Panels / Table
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '26px', fontWeight: '900', color: '#0F172A', letterSpacing: '-0.5px' }}>
                      ₹{result.quotedPrice.toLocaleString('en-IN')}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>
                      / Table
                    </span>
                    {setCount > 1 && (
                      <span style={{
                        backgroundColor: '#10B981',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '900',
                        marginLeft: '4px'
                      }}>
                        Total: ₹{result.totalQuotedPrice.toLocaleString('en-IN')} ({setCount} Tables)
                      </span>
                    )}
                  </div>
                </div>

                {/* Metrics Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ backgroundColor: 'white', border: '1px solid #99F6E4', borderRadius: '10px', padding: '6px 12px', textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Rate / Watt</div>
                    <div style={{ fontSize: '13px', fontWeight: '900', color: '#0F766E' }}>₹{ratePerWatt} / W</div>
                  </div>
                  <div style={{ backgroundColor: 'white', border: '1px solid #99F6E4', borderRadius: '10px', padding: '6px 12px', textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>HDG Weight</div>
                    <div style={{ fontSize: '13px', fontWeight: '900', color: '#0E7490' }}>{result.hdgWeight.toFixed(1)} kg</div>
                  </div>
                  <div style={{ backgroundColor: 'white', border: '1px solid #99F6E4', borderRadius: '10px', padding: '6px 12px', textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Galvalume</div>
                    <div style={{ fontSize: '13px', fontWeight: '900', color: '#B45309' }}>{result.galvalWeight.toFixed(1)} kg</div>
                  </div>
                  <div style={{ backgroundColor: 'white', border: '1px solid #99F6E4', borderRadius: '10px', padding: '6px 12px', textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>Total Wt / Table</div>
                    <div style={{ fontSize: '13px', fontWeight: '900', color: '#0F172A' }}>{result.totalWeight.toFixed(1)} kg</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 20px',
              borderBottom: '1px solid #E2E8F0',
              backgroundColor: '#FAFAFA',
              flexShrink: 0,
              flexWrap: 'nowrap',
              whiteSpace: 'nowrap',
              gap: '12px',
              overflowX: 'auto'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'nowrap',
                whiteSpace: 'nowrap',
                gap: '4px'
              }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('schematic')}
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    fontSize: '13px',
                    fontWeight: '800',
                    color: activeTab === 'schematic' ? '#0E7490' : '#64748B',
                    borderBottom: activeTab === 'schematic' ? '3px solid #0E7490' : '3px solid transparent',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  <Eye size={15} style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap' }}>Live Structural Schematic (Full View)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('bom')}
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    fontSize: '13px',
                    fontWeight: '800',
                    color: activeTab === 'bom' ? '#0E7490' : '#64748B',
                    borderBottom: activeTab === 'bom' ? '3px solid #0E7490' : '3px solid transparent',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  <Boxes size={15} style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap' }}>Structural Components BOM ({result.parts.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('accessories')}
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    fontSize: '13px',
                    fontWeight: '800',
                    color: activeTab === 'accessories' ? '#0E7490' : '#64748B',
                    borderBottom: activeTab === 'accessories' ? '3px solid #0E7490' : '3px solid transparent',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  <Wrench size={15} style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap' }}>Fasteners & Accessories ({result.accessories.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('terms')}
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    fontSize: '13px',
                    fontWeight: '800',
                    color: activeTab === 'terms' ? '#0E7490' : '#64748B',
                    borderBottom: activeTab === 'terms' ? '3px solid #0E7490' : '3px solid transparent',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                >
                  <FileText size={15} style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap' }}>Commercial Terms</span>
                </button>
              </div>

              {/* Quick Search when on BOM tab */}
              {activeTab === 'bom' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'white',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  width: '180px'
                }}>
                  <Search size={13} style={{ color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Search BOM..."
                    value={bomSearch}
                    onChange={e => setBomSearch(e.target.value)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      fontSize: '11px',
                      width: '100%',
                      backgroundColor: 'transparent'
                    }}
                  />
                  {bomSearch && (
                    <button
                      type="button"
                      onClick={() => setBomSearch('')}
                      style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Tab Content (Full Height Scrollable) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
              {/* TAB 1: FULL STRUCTURAL SCHEMATIC */}
              {activeTab === 'schematic' && (
                <SolarTableSchematicFullView
                  columnProfile={columnProfile}
                  rowModel={rowModel}
                  tableSize={tableSize}
                  leg1Height={leg1Height}
                  leg2Height={leg2Height}
                  hasBracing={hasBracing}
                  hasCrossBracing={hasCrossBracing}
                  totalPanels={totalPanels}
                  capacityKw={capacityKw}
                  totalPanelsPerTable={totalPanelsPerTable}
                  capacityKwPerTable={capacityKwPerTable}
                />
              )}

              {/* TAB 2: FULL STRUCTURAL COMPONENTS BOM TABLE */}
              {activeTab === 'bom' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B' }}>
                      BOM Bill of Materials per Table (Quantities auto-multiplied by {setCount} for quotation)
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                      Structure Cost: ₹{result.structureCost.toFixed(2)} (with 3% wastage allowance)
                    </span>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                        <th style={{ padding: '9px 10px', fontWeight: '800' }}>#</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800' }}>Part Name</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800' }}>Section</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800', textAlign: 'center' }}>Length</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800', textAlign: 'center' }}>Thk</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800' }}>Material</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800', textAlign: 'right' }}>Unit Wt</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800', textAlign: 'right' }}>Total Wt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParts.map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: idx % 2 === 1 ? '#FAFBFC' : 'white' }}>
                          <td style={{ padding: '8px 10px', color: '#94A3B8', fontWeight: '600' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0F172A' }}>{p.name}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: '#334155' }}>{p.section}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: 'monospace' }}>{p.length} mm</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>{p.thickness} mm</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '800',
                              backgroundColor: p.material === 'HDG' ? '#ECFEFF' : '#FEF3C7',
                              color: p.material === 'HDG' ? '#0E7490' : '#B45309'
                            }}>
                              {p.material === 'HDG' ? 'HDG' : 'GALVALUME'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#0E7490' }}>
                            {p.qty}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {p.unitWeight.toFixed(2)} kg
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace' }}>
                            {p.totalWeight.toFixed(2)} kg
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: FASTENERS / ACCESSORIES TABLE */}
              {activeTab === 'accessories' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B' }}>
                      Fasteners & Accessories per Table
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>
                      Accessory Subtotal: ₹{result.accessoryCost.toFixed(2)}
                    </span>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                        <th style={{ padding: '9px 10px', fontWeight: '800' }}>#</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800' }}>Supply / Fastener</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800' }}>Purpose</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800', textAlign: 'center' }}>Size</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800' }}>Material</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800', textAlign: 'right' }}>Unit Price</th>
                        <th style={{ padding: '9px 10px', fontWeight: '800', textAlign: 'right' }}>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.accessories.map((acc, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: idx % 2 === 1 ? '#FAFBFC' : 'white' }}>
                          <td style={{ padding: '8px 10px', color: '#94A3B8', fontWeight: '600' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0F172A' }}>{acc.supply}</td>
                          <td style={{ padding: '8px 10px', color: '#64748B' }}>{acc.purpose}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: 'monospace' }}>{acc.size}</td>
                          <td style={{ padding: '8px 10px', fontWeight: '700', color: acc.material === 'SS304' ? '#059669' : '#0E7490' }}>
                            {acc.material}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#0E7490' }}>
                            {acc.qty}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                            ₹{acc.unitPrice}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace' }}>
                            ₹{acc.cost.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 4: COMMERCIAL TERMS */}
              {activeTab === 'terms' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B', marginBottom: '2px' }}>
                    Standard Commercial Proposal Terms (from HDG Configurator)
                  </div>
                  {result.commercialTerms.map((t, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: '1px solid #E2E8F0',
                        backgroundColor: '#F8FAFC',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#0E7490' }}>
                        {idx + 1}. {t.term}:
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                        {t.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Actions Bar (Light & Clean) */}
            <div style={{
              padding: '14px 24px',
              backgroundColor: '#FAFAFA',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              {/* Insertion Mode Radio Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                  Quotation Scope:
                </span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#0E7490', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="cfg_insertion_mode"
                    checked={insertionMode === 'group'}
                    onChange={() => setInsertionMode('group')}
                    style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                  />
                  Preset Kit (₹{result.quotedPrice.toLocaleString('en-IN')}/Table)
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#475569', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="cfg_insertion_mode"
                    checked={insertionMode === 'itemized'}
                    onChange={() => setInsertionMode('itemized')}
                    style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                  />
                  Itemized Line Items
                </label>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '9px 18px',
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
                  onClick={handleApply}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '9px 24px',
                    fontSize: '13px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <CheckCircle size={16} />
                  <span>Apply to Quotation (₹{result.totalQuotedPrice.toLocaleString('en-IN')})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
