import React, { useState, useMemo } from 'react';
import {
  Sliders, RefreshCw, Check, Layers, ShieldCheck,
  Boxes, Sun, LayoutGrid, CheckSquare, Square, Info
} from 'lucide-react';
import {
  DEFAULT_NALCO_PRICE,
  ALUMINIUM_CATALOG,
  ALUMINIUM_PROFILE_FAMILIES,
  getProfileFamilyForRail,
  calculateAluminiumStructure
} from '../../utils/aluminiumStructureConfigurator';
import MasterStructureProfileDropdown from './MasterStructureProfileDropdown';

/**
 * 2D Interactive Solar Rooftop Schematic for Mini Rail / Standing Seam
 */
/**
 * 2D High-Definition CAD Architectural Schematic for Mini Rail / Standing Seam
 */
function AluminiumSchematicView({
  selectedRailDef,
  fixingModel,
  totalPanels,
  totalRows,
  panelWp,
  totalKw,
  railCountPerPanel
}) {
  const isStandingSeam = selectedRailDef.category === 'Standing Seam';
  const railHeightMm = selectedRailDef.height || (isStandingSeam ? 80 : 100);
  const railLengthMm = selectedRailDef.length || 300;

  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      borderRadius: '16px',
      padding: '22px',
      border: '1px solid #E2E8F0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px'
    }}>
      {/* 1. Header Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        paddingBottom: '16px',
        borderBottom: '1px solid #F1F5F9'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              backgroundColor: isStandingSeam ? '#ECFEFF' : '#EEF2FF',
              color: isStandingSeam ? '#0E7490' : '#4F46E5',
              border: `1px solid ${isStandingSeam ? '#A5F3FC' : '#C7D2FE'}`,
              fontSize: '11px',
              fontWeight: '800',
              padding: '3px 9px',
              borderRadius: '6px',
              letterSpacing: '0.4px'
            }}>
              {isStandingSeam ? 'STANDING SEAM SECT.' : 'MINI RAIL SECT.'}
            </span>
            <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>
              Precision 2D CAD Architectural Detail
            </span>
            <span style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              color: '#64748B',
              fontSize: '10.5px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '6px'
            }}>
              Scale 1:5 CAD Cross-Section
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#64748B' }}>
            AutoCAD-grade elevation & section view of extruded Al 6063-T6 rail, roof interface & solar PV mounting
          </p>
        </div>

        {/* Live Detail Specs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '5px 12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Rail Profile</div>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#0E7490' }}>{railHeightMm}mm (H) × {railLengthMm}mm (L)</div>
          </div>
          <div style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '5px 12px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Fixing</div>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F766E' }}>{isStandingSeam ? 'Grub Screws' : 'Rivets + EPDM'}</div>
          </div>
        </div>
      </div>

      {/* 2. Main CAD Elevation Section Canvas */}
      <div style={{
        position: 'relative',
        width: '100%',
        backgroundColor: '#F8FAFC',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #E2E8F0',
        boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.03)'
      }}>
        <svg
          viewBox="0 0 760 300"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
            <defs>
              {/* Subtle Architectural CAD Grid */}
              <pattern id="aluCadGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.75" fill="#CBD5E1" />
              </pattern>

              {/* Roof Sub-Deck Hatch */}
              <pattern id="subDeckHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="8" stroke="#E2E8F0" strokeWidth="1" />
              </pattern>

              {/* Extruded Aluminium 6063-T6 Silver Metallic Gradient */}
              <linearGradient id="aluExtrusion" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#94A3B8" />
                <stop offset="15%" stopColor="#E2E8F0" />
                <stop offset="45%" stopColor="#F8FAFC" />
                <stop offset="75%" stopColor="#CBD5E1" />
                <stop offset="100%" stopColor="#64748B" />
              </linearGradient>

              {/* Secondary Aluminium Gradient for Web / Flanges */}
              <linearGradient id="aluWebGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#CBD5E1" />
                <stop offset="50%" stopColor="#94A3B8" />
                <stop offset="100%" stopColor="#64748B" />
              </linearGradient>

              {/* High-Efficiency Monocrystalline Silicon Solar Cell Gradient */}
              <linearGradient id="monoSolarCell" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0F172A" />
                <stop offset="35%" stopColor="#1E3A8A" />
                <stop offset="70%" stopColor="#1D4ED8" />
                <stop offset="100%" stopColor="#0B132B" />
              </linearGradient>

              {/* Solar Glass Anti-Reflective Specular Glare */}
              <linearGradient id="glassGlare" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
                <stop offset="30%" stopColor="rgba(255,255,255,0.05)" />
                <stop offset="70%" stopColor="rgba(255,255,255,0.3)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
              </linearGradient>

              {/* SS304 Stainless Steel Polished Fastener Gradient */}
              <linearGradient id="ss304Fastener" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F1F5F9" />
                <stop offset="40%" stopColor="#FFFFFF" />
                <stop offset="70%" stopColor="#CBD5E1" />
                <stop offset="100%" stopColor="#94A3B8" />
              </linearGradient>

              {/* Metal Roof Deck Profile Gradient */}
              <linearGradient id="galvalumeSheet" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#94A3B8" />
                <stop offset="50%" stopColor="#64748B" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>

              {/* CAD Dimension Arrow Marker */}
              <marker id="cadDimArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 Z" fill="#0E7490" />
              </marker>

              {/* Soft Drop Shadow for Clamps & Rails */}
              <filter id="cadShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0F172A" floodOpacity="0.15" />
              </filter>
            </defs>

            {/* Background Engineering Grid */}
            <rect x="0" y="0" width="760" height="300" fill="url(#aluCadGrid)" />

            {/* Sub-Roof Structure / Purling Area Hatching */}
            <rect x="0" y="240" width="760" height="60" fill="url(#subDeckHatch)" />
            <line x1="0" y1="240" x2="760" y2="240" stroke="#94A3B8" strokeWidth="1" strokeDasharray="4 2" />

            {/* ============================================================== */}
            {/* 1. ROOF PROFILE SECTION                                        */}
            {/* ============================================================== */}
            {isStandingSeam ? (
              /* Standing Seam Roof Sheet with Vertical Ribs & Crimped Seam */
              <g>
                {/* Horizontal Deck Pan */}
                <path
                  d="M 0 236 L 140 236 M 154 236 L 372 236 M 388 236 L 606 236 M 620 236 L 760 236"
                  stroke="url(#galvalumeSheet)"
                  strokeWidth="3.5"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* Standing Seam Rib 1 (Left - x: 147) */}
                <path
                  d="M 140 236 L 144 204 Q 144 196 147 196 Q 150 196 150 204 L 154 236"
                  fill="#94A3B8"
                  stroke="#475569"
                  strokeWidth="1.5"
                />
                <circle cx="147" cy="195" r="4.5" fill="#64748B" stroke="#334155" strokeWidth="1" />

                {/* Standing Seam Rib 2 (Center - x: 380 - Clamped) */}
                <path
                  d="M 372 236 L 376 204 Q 376 196 380 196 Q 384 196 384 204 L 388 236"
                  fill="#94A3B8"
                  stroke="#475569"
                  strokeWidth="1.5"
                />
                <circle cx="380" cy="195" r="4.5" fill="#64748B" stroke="#334155" strokeWidth="1" />

                {/* Standing Seam Rib 3 (Right - x: 613) */}
                <path
                  d="M 606 236 L 610 204 Q 610 196 613 196 Q 616 196 616 204 L 620 236"
                  fill="#94A3B8"
                  stroke="#475569"
                  strokeWidth="1.5"
                />
                <circle cx="613" cy="195" r="4.5" fill="#64748B" stroke="#334155" strokeWidth="1" />
              </g>
            ) : (
              /* Trapezoidal Corrugated Roof Profile */
              <g>
                <path
                  d="M 0 240 L 70 240 L 105 198 L 195 198 L 230 240 L 305 240 L 340 198 L 420 198 L 455 240 L 535 240 L 570 198 L 650 198 L 685 240 L 760 240"
                  fill="none"
                  stroke="url(#galvalumeSheet)"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* EPDM Rubber Weatherproof Gasket under Mini Rail Crests */}
                {/* Left EPDM Pad */}
                <rect x="120" y="194" width="60" height="4" rx="1.5" fill="#0F172A" />
                {/* Center EPDM Pad */}
                <rect x="350" y="194" width="60" height="4" rx="1.5" fill="#0F172A" />
                {/* Right EPDM Pad */}
                <rect x="580" y="194" width="60" height="4" rx="1.5" fill="#0F172A" />
              </g>
            )}

            {/* ============================================================== */}
            {/* 2. ALUMINIUM EXTRUDED RAILS                                    */}
            {/* ============================================================== */}
            {/*
              Center Rail: Center at X = 380
              Left Rail (End): Center at X = 150
              Right Rail (End): Center at X = 610
            */}
            {(() => {
              const railY = 120;
              const railH = 74;

              const renderExtrudedRail = (cx, isCenter = false) => {
                const rx = cx - 22;
                return (
                  <g key={cx} filter="url(#cadShadow)">
                    {/* Standing Seam Clamping Base vs Mini Rail Base */}
                    {isStandingSeam ? (
                      /* Standing Seam Clamp Base Block that cups the seam */
                      <g>
                        {/* Seam clamp saddle */}
                        <path
                          d={`M ${cx - 24} ${railY + railH + 6} L ${cx - 24} ${railY + railH - 12} L ${cx - 16} ${railY + railH - 24} L ${cx + 16} ${railY + railH - 24} L ${cx + 24} ${railY + railH - 12} L ${cx + 24} ${railY + railH + 6} L ${cx + 10} ${railY + railH + 6} L ${cx + 8} ${railY + railH - 8} L ${cx - 8} ${railY + railH - 8} L ${cx - 10} ${railY + railH + 6} Z`}
                          fill="url(#aluExtrusion)"
                          stroke="#475569"
                          strokeWidth="1.2"
                        />
                        {/* SS304 Grub Screws (Lateral Non-Penetrative Fastening) */}
                        <rect x={cx - 30} y={railY + railH - 4} width="10" height="8" rx="1.5" fill="url(#ss304Fastener)" stroke="#334155" strokeWidth="1" />
                        <line x1={cx - 28} y1={railY + railH} x2={cx - 22} y2={railY + railH} stroke="#0E7490" strokeWidth="1.5" />
                        <rect x={cx + 20} y={railY + railH - 4} width="10" height="8" rx="1.5" fill="url(#ss304Fastener)" stroke="#334155" strokeWidth="1" />
                        <line x1={cx + 22} y1={railY + railH} x2={cx + 28} y2={railY + railH} stroke="#0E7490" strokeWidth="1.5" />
                      </g>
                    ) : (
                      /* Mini Rail Flange Footing with Rivet Penetrations */
                      <g>
                        {/* Wide Base Flange */}
                        <rect x={cx - 28} y={railY + railH - 6} width="56" height="6" rx="1" fill="url(#aluExtrusion)" stroke="#475569" strokeWidth="1" />
                        {/* Blind Rivets with Neo-Washers */}
                        <g>
                          <rect x={cx - 22} y={railY + railH - 9} width="6" height="4" rx="1" fill="url(#ss304Fastener)" stroke="#1E293B" strokeWidth="0.8" />
                          <line x1={cx - 19} y1={railY + railH - 5} x2={cx - 19} y2={railY + railH + 9} stroke="#475569" strokeWidth="2.5" />
                          <rect x={cx + 16} y={railY + railH - 9} width="6" height="4" rx="1" fill="url(#ss304Fastener)" stroke="#1E293B" strokeWidth="0.8" />
                          <line x1={cx + 19} y1={railY + railH - 5} x2={cx + 19} y2={railY + railH + 9} stroke="#475569" strokeWidth="2.5" />
                        </g>
                      </g>
                    )}

                    {/* Main Rail Column Body (Al 6063-T6 Extrusion) */}
                    <rect x={rx} y={railY} width="44" height={railH - 6} rx="2" fill="url(#aluExtrusion)" stroke="#334155" strokeWidth="1.2" />

                    {/* Internal Structural Hollow Chamber (Extrusion Cavity) */}
                    <rect x={rx + 8} y={railY + 16} width="28" height={railH - 30} rx="2" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1" strokeDasharray="3 2" />

                    {/* Top T-Slot Groove & Flanges */}
                    <path
                      d={`M ${rx} ${railY + 12} L ${rx + 12} ${railY + 12} L ${rx + 12} ${railY + 5} L ${rx + 32} ${railY + 5} L ${rx + 32} ${railY + 12} L ${rx + 44} ${railY + 12}`}
                      fill="none"
                      stroke="#334155"
                      strokeWidth="1.2"
                    />

                    {/* Anti-Slip Side Serrations */}
                    <line x1={rx + 1} y1={railY + 28} x2={rx + 4} y2={railY + 28} stroke="#64748B" strokeWidth="1" />
                    <line x1={rx + 1} y1={railY + 34} x2={rx + 4} y2={railY + 34} stroke="#64748B" strokeWidth="1" />
                    <line x1={rx + 1} y1={railY + 40} x2={rx + 4} y2={railY + 40} stroke="#64748B" strokeWidth="1" />
                    <line x1={rx + 40} y1={railY + 28} x2={rx + 43} y2={railY + 28} stroke="#64748B" strokeWidth="1" />
                    <line x1={rx + 40} y1={railY + 34} x2={rx + 43} y2={railY + 34} stroke="#64748B" strokeWidth="1" />
                    <line x1={rx + 40} y1={railY + 40} x2={rx + 43} y2={railY + 40} stroke="#64748B" strokeWidth="1" />
                  </g>
                );
              };

              return (
                <g>
                  {renderExtrudedRail(150, false)}
                  {renderExtrudedRail(380, true)}
                  {renderExtrudedRail(610, false)}
                </g>
              );
            })()}

            {/* ============================================================== */}
            {/* 3. SOLAR PV MODULES (Cross Section with Anodized Frame)        */}
            {/* ============================================================== */}
            {/*
              Left Panel:   x1: 150 (on end clamp) to x2: 368 (on center mid clamp)
              Right Panel:  x1: 392 (on center mid clamp) to x2: 610 (on end clamp)
              Module Height: 35mm (scaled to 24px in SVG)
              Surface Y: 94px to 118px
            */}
            {(() => {
              const panelTopY = 94;
              const panelH = 24;

              const renderSolarModule = (x1, x2, label) => {
                const width = x2 - x1;
                return (
                  <g key={label} filter="url(#cadShadow)">
                    {/* Anodized Aluminium Outer Frame Box */}
                    <rect
                      x={x1}
                      y={panelTopY}
                      width={width}
                      height={panelH}
                      rx="2"
                      fill="url(#monoSolarCell)"
                      stroke="#1E293B"
                      strokeWidth="1.2"
                    />

                    {/* Frame Top Lip & Bottom Return Flanges */}
                    <rect x={x1} y={panelTopY} width="10" height={panelH} fill="url(#aluExtrusion)" stroke="#475569" strokeWidth="0.8" />
                    <rect x={x2 - 10} y={panelTopY} width="10" height={panelH} fill="url(#aluExtrusion)" stroke="#475569" strokeWidth="0.8" />

                    {/* Toughened Solar Glass Surface & Specular Glare */}
                    <rect x={x1 + 10} y={panelTopY + 1} width={width - 20} height="4" fill="url(#glassGlare)" />

                    {/* Monocrystalline Silicon Cell Grid Busbar Lines */}
                    {Array.from({ length: 6 }).map((_, bIdx) => {
                      const bx = x1 + 20 + bIdx * ((width - 40) / 5);
                      return (
                        <g key={bIdx}>
                          <line x1={bx} y1={panelTopY + 3} x2={bx} y2={panelTopY + panelH - 3} stroke="#93C5FD" strokeWidth="0.8" strokeDasharray="2 1" />
                          <circle cx={bx} cy={panelTopY + 12} r="1.5" fill="#E0F2FE" />
                        </g>
                      );
                    })}

                    {/* Panel Label Pill Badge */}
                    <g transform={`translate(${(x1 + x2) / 2}, ${panelTopY + 12})`}>
                      <rect x="-48" y="-7.5" width="96" height="15" rx="4" fill="rgba(15, 23, 42, 0.75)" stroke="#38BDF8" strokeWidth="0.8" />
                      <text x="0" y="3.5" fontSize="8.5" fontWeight="800" fill="#E0F2FE" textAnchor="middle" letterSpacing="0.3">
                        {label} ({panelWp}W)
                      </text>
                    </g>
                  </g>
                );
              };

              return (
                <g>
                  {renderSolarModule(152, 368, 'PV MODULE 1')}
                  {renderSolarModule(392, 608, 'PV MODULE 2')}
                </g>
              );
            })()}

            {/* ============================================================== */}
            {/* 4. CLAMPING SYSTEM (Universal Mid & End Clamps + SS304 Bolts)  */}
            {/* ============================================================== */}

            {/* Central UNIVERSAL MID CLAMP Assembly (X: 380) */}
            <g filter="url(#cadShadow)">
              {/* Mid Clamp Bridge (Anodized Al 6063-T6) gripping both module frames */}
              <path
                d="M 364 88 L 396 88 L 396 95 L 388 95 L 388 120 L 372 120 L 372 95 L 364 95 Z"
                fill="url(#aluExtrusion)"
                stroke="#0E7490"
                strokeWidth="1.2"
              />

              {/* Clamping Teeth / Serrations pressing down on panels */}
              <rect x="364" y="93" width="6" height="3" fill="#0E7490" />
              <rect x="390" y="93" width="6" height="3" fill="#0E7490" />

              {/* SS304 M8 Allen Socket Head Cap Screw */}
              <rect x="375" y="74" width="10" height="14" rx="2" fill="url(#ss304Fastener)" stroke="#1E293B" strokeWidth="1" />
              {/* Hex Socket Head Cavity */}
              <polygon points="378,77 382,77 384,80 382,83 378,83 376,80" fill="#334155" />
              {/* Spring Washer & Flat Washer */}
              <rect x="373" y="87" width="14" height="2.5" rx="0.5" fill="#64748B" stroke="#0F172A" strokeWidth="0.5" />

              {/* Stainless Steel M8 Threaded Rod down into Rail T-Slot */}
              <line x1="380" y1="88" x2="380" y2="128" stroke="#334155" strokeWidth="2.5" strokeDasharray="2 1" />
              {/* M8 Sliding T-Nut inside rail channel */}
              <rect x="371" y="125" width="18" height="6" rx="1.5" fill="#475569" stroke="#0F172A" strokeWidth="1" />
            </g>

            {/* Left UNIVERSAL END CLAMP Assembly (X: 150) */}
            <g filter="url(#cadShadow)">
              {/* End Clamp Z-Profile gripping Left Module outer frame */}
              <path
                d="M 142 88 L 162 88 L 162 95 L 156 95 L 156 120 L 142 120 Z"
                fill="url(#aluExtrusion)"
                stroke="#D97706"
                strokeWidth="1.2"
              />
              <rect x="156" y="93" width="6" height="3" fill="#D97706" />
              {/* M8 Allen Bolt */}
              <rect x="144" y="76" width="9" height="12" rx="1.5" fill="url(#ss304Fastener)" stroke="#1E293B" strokeWidth="1" />
              <polygon points="146,78 150,78 152,81 150,84 146,84 144,81" fill="#334155" />
            </g>

            {/* Right UNIVERSAL END CLAMP Assembly (X: 610) */}
            <g filter="url(#cadShadow)">
              {/* End Clamp Z-Profile gripping Right Module outer frame */}
              <path
                d="M 618 88 L 598 88 L 598 95 L 604 95 L 604 120 L 618 120 Z"
                fill="url(#aluExtrusion)"
                stroke="#D97706"
                strokeWidth="1.2"
              />
              <rect x="598" y="93" width="6" height="3" fill="#D97706" />
              {/* M8 Allen Bolt */}
              <rect x="607" y="76" width="9" height="12" rx="1.5" fill="url(#ss304Fastener)" stroke="#1E293B" strokeWidth="1" />
              <polygon points="610,78 614,78 616,81 614,84 610,84 608,81" fill="#334155" />
            </g>

            {/* ============================================================== */}
            {/* 5. ARCHITECTURAL CAD DIMENSIONS & CALLOUT LINES                */}
            {/* ============================================================== */}

            {/* A. Rail Height Dimension Line (Left Side) */}
            <g>
              <line x1="102" y1="120" x2="102" y2="194" stroke="#0E7490" strokeWidth="1.5" markerStart="url(#cadDimArrow)" markerEnd="url(#cadDimArrow)" />
              <line x1="94" y1="120" x2="114" y2="120" stroke="#0E7490" strokeWidth="1" />
              <line x1="94" y1="194" x2="114" y2="194" stroke="#0E7490" strokeWidth="1" />
              <rect x="52" y="146" width="46" height="20" rx="4" fill="#FFFFFF" stroke="#0E7490" strokeWidth="1" />
              <text x="75" y="160" fontSize="10" fontWeight="900" fill="#0E7490" textAnchor="middle">
                {railHeightMm} mm
              </text>
              <text x="75" y="172" fontSize="7.5" fontWeight="700" fill="#64748B" textAnchor="middle">
                RAIL HT.
              </text>
            </g>

            {/* B. Module Frame Thickness Dimension (Right Side) */}
            <g>
              <line x1="648" y1="94" x2="648" y2="118" stroke="#0E7490" strokeWidth="1.5" markerStart="url(#cadDimArrow)" markerEnd="url(#cadDimArrow)" />
              <line x1="640" y1="94" x2="656" y2="94" stroke="#0E7490" strokeWidth="1" />
              <line x1="640" y1="118" x2="656" y2="118" stroke="#0E7490" strokeWidth="1" />
              <rect x="654" y="96" width="58" height="20" rx="4" fill="#FFFFFF" stroke="#0E7490" strokeWidth="1" />
              <text x="683" y="110" fontSize="10" fontWeight="900" fill="#0E7490" textAnchor="middle">
                35 mm
              </text>
            </g>

            {/* C. Clamping Gap Dimension (Center) */}
            <g>
              <line x1="368" y1="62" x2="392" y2="62" stroke="#0E7490" strokeWidth="1.2" markerStart="url(#cadDimArrow)" markerEnd="url(#cadDimArrow)" />
              <line x1="368" y1="58" x2="368" y2="66" stroke="#0E7490" strokeWidth="1" />
              <line x1="392" y1="58" x2="392" y2="66" stroke="#0E7490" strokeWidth="1" />
              <rect x="360" y="44" width="40" height="15" rx="3" fill="#FFFFFF" stroke="#0E7490" strokeWidth="0.8" />
              <text x="380" y="55" fontSize="8.5" fontWeight="800" fill="#0E7490" textAnchor="middle">
                24 mm
              </text>
            </g>

            {/* D. Callout Badges with Technical Leader Lines */}
            {/* Mid Clamp Callout */}
            <g transform="translate(380, 26)">
              <rect x="-95" y="-12" width="190" height="24" rx="12" fill="#ECFDF5" stroke="#10B981" strokeWidth="1.2" />
              <circle cx="-82" cy="0" r="4" fill="#10B981" />
              <text x="-70" y="4" fontSize="10" fontWeight="900" fill="#065F46">
                Universal Mid Clamp (SS304 M8)
              </text>
              {/* Leader Line to Mid Clamp */}
              <line x1="0" y1="12" x2="0" y2="44" stroke="#10B981" strokeWidth="1" strokeDasharray="2 2" />
            </g>

            {/* End Clamp Callout (Left) */}
            <g transform="translate(150, 26)">
              <rect x="-85" y="-12" width="170" height="24" rx="12" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.2" />
              <circle cx="-72" cy="0" r="4" fill="#F59E0B" />
              <text x="-60" y="4" fontSize="10" fontWeight="900" fill="#92400E">
                End Clamp (Al 6063-T6)
              </text>
              <line x1="0" y1="12" x2="0" y2="44" stroke="#F59E0B" strokeWidth="1" strokeDasharray="2 2" />
            </g>

            {/* Fastener Callout (Bottom Center) */}
            {isStandingSeam ? (
              <g transform="translate(380, 276)">
                <rect x="-115" y="-12" width="230" height="24" rx="12" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1.2" />
                <circle cx="-102" cy="0" r="4" fill="#3B82F6" />
                <text x="-90" y="4" fontSize="10" fontWeight="900" fill="#1E40AF">
                  Non-Penetrative SS304 Grub Screws
                </text>
              </g>
            ) : (
              <g transform="translate(380, 276)">
                <rect x="-115" y="-12" width="230" height="24" rx="12" fill="#F0FDF4" stroke="#22C55E" strokeWidth="1.2" />
                <circle cx="-102" cy="0" r="4" fill="#22C55E" />
                <text x="-90" y="4" fontSize="10" fontWeight="900" fill="#166534">
                  EPDM Gasket + SS304 Blind Rivets
                </text>
              </g>
            )}

            {/* Datum Elevation Level Marker */}
            <g transform="translate(16, 236)">
              <path d="M 0 0 L 8 -10 L 16 0 Z" fill="#0E7490" />
              <line x1="8" y1="-10" x2="8" y2="0" stroke="#0E7490" strokeWidth="1.5" />
              <text x="22" y="-3" fontSize="10" fontWeight="900" fill="#0E7490" letterSpacing="0.4">
                ROOF DATUM ±0.00
              </text>
              <text x="0" y="18" fontSize="9" fontWeight="800" fill="#64748B" letterSpacing="0.3">
                {isStandingSeam ? 'STANDING SEAM PROFILE (NON-PENETRATIVE)' : 'TRAPEZOIDAL DECK + EPDM SEAL'}
              </text>
            </g>
          </svg>
        </div>

      {/* 3. Technical Engineering Specifications Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '10px'
      }}>
        <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 14px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Extruded Alloy</div>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
            Al 6063-T6 Anodized
          </div>
        </div>

        <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 14px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Rail Profile</div>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#0E7490', marginTop: '2px' }}>
            {railHeightMm} mm (H) × {railLengthMm} mm (L)
          </div>
        </div>

        <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 14px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Roof Fastening</div>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>
            {isStandingSeam ? 'SS304 Grub Screws' : 'Blind Rivet + EPDM'}
          </div>
        </div>

        <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 14px' }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total Rail Pieces</div>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#0F766E', marginTop: '2px' }}>
            {totalPanels * railCountPerPanel} Rails / Table
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AluminiumStructureConfiguratorView({
  initialRailId = 'ssr_100',
  masterStructureValue,
  onMasterStructureChange,
  onSwitchCategory,
  onApplyToQuote,
  onClose
}) {
  // 1. Master Configuration Inputs (Strings allow natural backspacing & re-typing without snapping back)
  const [selectedRailId, setSelectedRailId] = useState(initialRailId || 'ssr_100');
  const [panels, setPanels] = useState('4');
  const [rows, setRows] = useState('1');
  const [panelWp, setPanelWp] = useState('625');
  const [railCountPerPanel, setRailCountPerPanel] = useState(2);
  const [grubScrewsPerRail, setGrubScrewsPerRail] = useState(2);
  const [setCount, setSetCount] = useState('1');

  // Input Validation Guards
  const parsedPanels = parseInt(panels, 10);
  const parsedRows = parseInt(rows, 10);
  const parsedWp = parseFloat(panelWp);
  const parsedSetCount = parseInt(setCount, 10);

  const isPanelsValid = !isNaN(parsedPanels) && parsedPanels >= 1;
  const isRowsValid = !isNaN(parsedRows) && parsedRows >= 1;
  const isWpValid = !isNaN(parsedWp) && parsedWp > 0;
  const isSetCountValid = !isNaN(parsedSetCount) && parsedSetCount >= 1;

  const isFormValid = isPanelsValid && isRowsValid && isWpValid && isSetCountValid;

  const safePanels = isPanelsValid ? parsedPanels : 1;
  const safeRows = isRowsValid ? parsedRows : 1;
  const safeWp = isWpValid ? parsedWp : 625;
  const safeSetCount = isSetCountValid ? parsedSetCount : 1;

  // 2. Pricing & Master Commodity Rates Drawer
  const [showRatesDrawer, setShowRatesDrawer] = useState(false);
  const [nalcoPrice, setNalcoPrice] = useState(DEFAULT_NALCO_PRICE);
  const [marginPct, setMarginPct] = useState(30);

  // 3. Tab for Preview ('schematic' | 'bom')
  const [activeTab, setActiveTab] = useState('schematic');
  const [bomSearch, setBomSearch] = useState('');

  // Quotation Scope Insertion Mode ('group' | 'itemized')
  const [insertionMode, setInsertionMode] = useState('group');

  // Selected Rail Object
  const selectedRailDef = useMemo(() => {
    return ALUMINIUM_CATALOG.find(x => x.id === selectedRailId) || ALUMINIUM_CATALOG[0];
  }, [selectedRailId]);

  const handleRailChange = (railId) => {
    setSelectedRailId(railId);
  };

  // Current Profile Family (Categorized by Profile Type & Height - Lengths handled in Step 2)
  const currentFamily = useMemo(() => {
    return getProfileFamilyForRail(selectedRailDef);
  }, [selectedRailDef]);

  // Available Lengths for Current Profile Category/Height
  const availableLengths = useMemo(() => {
    return ALUMINIUM_CATALOG.filter(x =>
      x.category === selectedRailDef.category &&
      (selectedRailDef.height ? x.height === selectedRailDef.height : true)
    );
  }, [selectedRailDef]);

  // 4. Live Calculation Engine (100% Excel Parity - Fastening is auto-determined by the chosen material)
  const isStandingSeam = Boolean(
    selectedRailDef?.category === 'Standing Seam' ||
    (selectedRailDef?.name && selectedRailDef.name.toLowerCase().includes('standing seam'))
  );
  const effectiveFixingModel = isStandingSeam ? 'Standing Seam' : 'Riviting';

  const calcResult = useMemo(() => {
    const marginMultiplier = 1 + ((parseFloat(marginPct) || 30) / 100);
    return calculateAluminiumStructure({
      rowsConfig: [{ panels: safePanels, rows: safeRows }],
      panelWp: safeWp,
      selectedRailId,
      fixingModel: effectiveFixingModel,
      railCountPerPanel: parseFloat(railCountPerPanel) || 2,
      grubScrewsPerRail: parseFloat(grubScrewsPerRail) || 2,
      nalcoPrice: parseFloat(nalcoPrice) || DEFAULT_NALCO_PRICE,
      margin: marginMultiplier
    });
  }, [safePanels, safeRows, safeWp, selectedRailId, effectiveFixingModel, railCountPerPanel, grubScrewsPerRail, nalcoPrice, marginPct]);

  // Filtered BOM
  const filteredBom = useMemo(() => {
    if (!bomSearch.trim()) return calcResult.items;
    const q = bomSearch.toLowerCase();
    return calcResult.items.filter(it => it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q));
  }, [calcResult.items, bomSearch]);

  // Multiply by Set Count
  const totalQuotedAmount = isFormValid ? parseFloat((calcResult.totalAmount * safeSetCount).toFixed(2)) : 0;
  const totalQuotedPanels = isFormValid ? calcResult.totalPanels * safeSetCount : 0;
  const totalQuotedKw = isFormValid ? parseFloat((calcResult.totalKw * safeSetCount).toFixed(3)) : 0;

  // 5. Handle Apply to Quotation
  const handleApply = () => {
    if (!isFormValid) {
      alert('Please enter valid quantities for Panels per Row, Number of Rows, and Set Multiplier before proceeding.');
      return;
    }

    const mult = safeSetCount;
    const grpId = 'alu_cfg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const grpTitle = `${isStandingSeam ? 'Standing Seam' : 'Mini Rail'} ${calcResult.title}`;

    if (insertionMode === 'group') {
      const finalItems = calcResult.items.map(it => {
        const multQty = it.qty * mult;
        return {
          name: it.name,
          category: `${calcResult.systemType} • ${it.category}`,
          specs: `${calcResult.systemType} • ${it.category}`,
          qty: String(multQty),
          baseQty: it.qty,
          uom: 'NOS',
          unit: 'NOS',
          rate: '0',
          gstRate: '18%',
          hsn: it.hsn || '76109010',
          presetName: calcResult.title,
          presetGroupId: grpId,
          isPresetItem: true,
          specDetails: {
            category: it.category,
            weightGrams: it.weightGrams,
            unitCost: it.unitCost,
            unitPrice: it.unitPrice
          }
        };
      });

      onApplyToQuote?.({
        mode: 'group',
        groupId: grpId,
        groupTitle: grpTitle,
        kitPrice: String(calcResult.totalAmount),
        setCount: mult,
        items: finalItems,
        result: {
          structureType: calcResult.systemType,
          tableTitle: calcResult.title,
          totalPanels: totalQuotedPanels,
          totalKw: totalQuotedKw,
          quotedPrice: calcResult.totalAmount,
          totalQuotedPrice: totalQuotedAmount
        }
      });
    } else {
      // Itemized Line Items
      const finalItems = calcResult.items.map(it => {
        const multQty = it.qty * mult;
        return {
          name: it.name,
          category: `${calcResult.systemType} • ${it.category}`,
          specs: `${calcResult.systemType} • ${it.category}`,
          qty: String(multQty),
          baseQty: it.qty,
          uom: 'NOS',
          unit: 'NOS',
          rate: String(it.unitPrice),
          gstRate: '18%',
          hsn: it.hsn || '76109010',
          isPresetItem: false,
          presetGroupId: null
        };
      });

      onApplyToQuote?.({
        mode: 'itemized',
        groupId: null,
        groupTitle: grpTitle,
        kitPrice: null,
        setCount: mult,
        items: finalItems,
        result: {
          structureType: calcResult.systemType,
          tableTitle: calcResult.title,
          totalPanels: totalQuotedPanels,
          totalKw: totalQuotedKw,
          quotedPrice: calcResult.totalAmount,
          totalQuotedPrice: totalQuotedAmount
        }
      });
    }

    onClose?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* 1. Commodity Rate Drawer */}
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
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                Commodity & Margin Settings (NALCO Benchmark)
              </span>
              <span style={{ fontSize: '11px', color: '#64748B' }}>
                Governs raw aluminium piece cost and margins
              </span>
            </div>
            <button
              onClick={() => {
                setNalcoPrice(DEFAULT_NALCO_PRICE);
                setMarginPct(30);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'transparent',
                border: 'none',
                color: '#0E7490',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={12} /> Reset to Defaults
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            {/* NALCO Rate */}
            <div style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '8px 12px'
            }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block' }}>
                NALCO Aluminium Rate (₹/kg)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{ fontWeight: '800', color: '#64748B' }}>₹</span>
                <input
                  type="number"
                  value={nalcoPrice}
                  onChange={(e) => setNalcoPrice(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '14px',
                    fontWeight: '800',
                    color: '#0F172A',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Margin % */}
            <div style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '8px 12px'
            }}>
              <label style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'block' }}>
                Margin Markup (%)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <input
                  type="number"
                  value={marginPct}
                  onChange={(e) => setMarginPct(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '14px',
                    fontWeight: '800',
                    color: '#0F172A',
                    outline: 'none'
                  }}
                />
                <span style={{ fontWeight: '800', color: '#64748B' }}>%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Two-Column Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '430px 1fr',
        gap: '0',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* LEFT COLUMN: Controls & Sizing */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #E2E8F0',
          padding: '20px 24px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px'
        }}>
          {/* Quick Rates Bar Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              System Parameters
            </span>
            <button
              onClick={() => setShowRatesDrawer(!showRatesDrawer)}
              style={{
                background: showRatesDrawer ? '#ECFEFF' : '#F8FAFC',
                color: showRatesDrawer ? '#0E7490' : '#475569',
                border: '1px solid #CBD5E1',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Sliders size={12} />
              <span>NALCO Price (₹{nalcoPrice}/kg)</span>
            </button>
          </div>

          {/* Step 1: Profile & Rail Family */}
          <MasterStructureProfileDropdown
            value={masterStructureValue || `alu_fam_${currentFamily.familyId}`}
            onChange={(val) => {
              if (onMasterStructureChange) {
                onMasterStructureChange(val);
              } else if (val.startsWith('alu_fam_')) {
                const famId = val.replace('alu_fam_', '');
                const targetFamily = ALUMINIUM_PROFILE_FAMILIES.find(f => f.familyId === famId);
                if (targetFamily) {
                  const matchingRails = ALUMINIUM_CATALOG.filter(x => x.category === targetFamily.category && x.height === targetFamily.height);
                  const sameLengthRail = matchingRails.find(r => r.length === selectedRailDef.length);
                  handleRailChange(sameLengthRail ? sameLengthRail.id : targetFamily.defaultRailId);
                }
              }
            }}
            activeBadge={`${currentFamily.category} (${currentFamily.height}mm)`}
          />

          {/* Step 2: Rail Length Specification (Separate Dedicated Container) */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                2. Rail Length Specification
              </label>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490' }}>
                {selectedRailDef.length} mm ({selectedRailDef.weight}g)
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: availableLengths.length === 3 ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
              {availableLengths.map(r => {
                const isSel = r.id === selectedRailId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleRailChange(r.id)}
                    style={{
                      padding: '10px 8px',
                      backgroundColor: isSel ? '#ECFEFF' : '#F8FAFC',
                      border: isSel ? '2px solid #0E7490' : '1px solid #E2E8F0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: '800', color: isSel ? '#0E7490' : '#0F172A' }}>
                      {r.length} mm
                    </div>
                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px', fontWeight: '600' }}>
                      {r.weight}g
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: System Layout Sizing */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px', display: 'block' }}>
              3. Solar Array Layout
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <div style={{
                backgroundColor: '#F8FAFC',
                border: !isPanelsValid ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '8px 12px',
                transition: 'border-color 0.15s ease'
              }}>
                <span style={{ fontSize: '10.5px', fontWeight: '700', color: !isPanelsValid ? '#DC2626' : '#64748B' }}>
                  Panels per Row <span style={{ color: '#EF4444' }}>*</span>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={panels}
                  placeholder="e.g. 4"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d+$/.test(val)) {
                      setPanels(val);
                    }
                  }}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '15px', fontWeight: '800', color: '#0F172A', outline: 'none' }}
                />
              </div>

              <div style={{
                backgroundColor: '#F8FAFC',
                border: !isRowsValid ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '8px 12px',
                transition: 'border-color 0.15s ease'
              }}>
                <span style={{ fontSize: '10.5px', fontWeight: '700', color: !isRowsValid ? '#DC2626' : '#64748B' }}>
                  Number of Rows <span style={{ color: '#EF4444' }}>*</span>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={rows}
                  placeholder="e.g. 1"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d+$/.test(val)) {
                      setRows(val);
                    }
                  }}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '15px', fontWeight: '800', color: '#0F172A', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Step 4: Panel Wattage & Multipliers */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '10px', display: 'block' }}>
              4. Panel Wattage & Set Multiplier
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              <div style={{
                backgroundColor: '#F8FAFC',
                border: !isWpValid ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '8px 12px',
                transition: 'border-color 0.15s ease'
              }}>
                <span style={{ fontSize: '10.5px', fontWeight: '700', color: !isWpValid ? '#DC2626' : '#64748B' }}>
                  Panel Wattage (Wp) <span style={{ color: '#EF4444' }}>*</span>
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={panelWp}
                  placeholder="e.g. 625"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setPanelWp(val);
                    }
                  }}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '15px', fontWeight: '800', color: '#0F172A', outline: 'none' }}
                />
              </div>

              <div style={{
                backgroundColor: '#F8FAFC',
                border: !isSetCountValid ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '8px 12px',
                transition: 'border-color 0.15s ease'
              }}>
                <span style={{ fontSize: '10.5px', fontWeight: '700', color: !isSetCountValid ? '#DC2626' : '#64748B' }}>
                  Table / Set Multiplier <span style={{ color: '#EF4444' }}>*</span>
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={setCount}
                  placeholder="e.g. 1"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d+$/.test(val)) {
                      setSetCount(val);
                    }
                  }}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '15px', fontWeight: '800', color: '#0F172A', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Summary Mini Card */}
          <div style={{
            backgroundColor: '#F0F9FF',
            border: '1px solid #BAE6FD',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#0369A1', fontWeight: '700' }}>Total Capacity:</span>
              <strong style={{ color: '#0F172A' }}>{totalQuotedKw} kW ({totalQuotedPanels} Panels)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#0369A1', fontWeight: '700' }}>Per kW Rate:</span>
              <strong style={{ color: '#0F172A' }}>₹ {calcResult.perKwRate.toLocaleString('en-IN')} / kW</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#0369A1', fontWeight: '700' }}>Per Set Cost:</span>
              <strong style={{ color: '#0F172A' }}>₹ {calcResult.perSetCost.toLocaleString('en-IN')}</strong>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Tabs (Schematic / BOM) */}
        <div style={{
          backgroundColor: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Tab Navigation Header */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            padding: '0 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '48px',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'schematic', label: '2D Schematic & Elevation' },
                { id: 'bom', label: `Bill of Materials (${calcResult.items.length} Items)` }
              ].map(t => {
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    style={{
                      height: '48px',
                      padding: '0 14px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: isActive ? '3px solid #0E7490' : '3px solid transparent',
                      color: isActive ? '#0E7490' : '#64748B',
                      fontSize: '12.5px',
                      fontWeight: isActive ? '800' : '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === 'bom' && (
              <input
                type="text"
                placeholder="Search BOM items..."
                value={bomSearch}
                onChange={(e) => setBomSearch(e.target.value)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  fontSize: '11.5px',
                  width: '180px'
                }}
              />
            )}
          </div>

          {/* Tab Body */}
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            {activeTab === 'schematic' ? (
              <AluminiumSchematicView
                selectedRailDef={selectedRailDef}
                fixingModel={effectiveFixingModel}
                totalPanels={calcResult.totalPanels}
                totalRows={calcResult.totalRows}
                panelWp={calcResult.panelWp}
                totalKw={calcResult.totalKw}
                railCountPerPanel={railCountPerPanel}
              />
            ) : (
              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '10px',
                border: '1px solid #E2E8F0',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1', color: '#475569', fontWeight: '800', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Item Description</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Piece Weight</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Unit Price (₹)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBom.map((it, idx) => {
                      const multQty = it.qty * setCount;
                      const multAmount = parseFloat((it.amount * setCount).toFixed(2));
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0F172A' }}>
                            {it.name}
                            <span style={{ fontSize: '10px', color: '#64748B', display: 'block', fontWeight: '500' }}>
                              Category: {it.category}
                            </span>
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: '800', color: '#0F172A' }}>
                            {multQty} {it.uom}
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', color: '#64748B' }}>
                            {it.weightGrams ? `${it.weightGrams}g` : '—'}
                          </td>
                          <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                            ₹{it.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: '#0F172A' }}>
                            ₹{multAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Footer Bar with Live Totals and Apply Button */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E2E8F0',
        padding: '14px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        {/* Left Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Capacity</div>
            <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A' }}>{totalQuotedKw} kW</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Price per kW</div>
            <div style={{ fontSize: '14px', fontWeight: '900', color: '#0284C7' }}>₹{calcResult.perKwRate.toLocaleString('en-IN')}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Quoted Price</div>
            <div style={{ fontSize: '17px', fontWeight: '900', color: '#059669' }}>
              ₹{totalQuotedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Center: Quotation Scope Radio Selector */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          backgroundColor: '#F8FAFC',
          padding: '8px 16px',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', whiteSpace: 'nowrap' }}>
            Quotation Scope:
          </span>
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: '700',
            color: insertionMode === 'group' ? '#0E7490' : '#475569',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}>
            <input
              type="radio"
              name="alu_cfg_insertion_mode"
              checked={insertionMode === 'group'}
              onChange={() => setInsertionMode('group')}
              style={{ accentColor: '#0E7490', cursor: 'pointer' }}
            />
            Preset Kit (₹{Math.round(calcResult.totalAmount).toLocaleString('en-IN')}/Table)
          </label>
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: '700',
            color: insertionMode === 'itemized' ? '#0E7490' : '#475569',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}>
            <input
              type="radio"
              name="alu_cfg_insertion_mode"
              checked={insertionMode === 'itemized'}
              onChange={() => setInsertionMode('itemized')}
              style={{ accentColor: '#0E7490', cursor: 'pointer' }}
            />
            Itemized Line Items
          </label>
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 18px',
              backgroundColor: '#F1F5F9',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isFormValid}
            onClick={handleApply}
            title={!isFormValid ? 'Please enter valid values for Panels per Row, Number of Rows, and Multiplier' : ''}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 24px',
              background: isFormValid ? 'linear-gradient(135deg, #059669 0%, #10B981 100%)' : '#94A3B8',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: '800',
              color: '#FFFFFF',
              cursor: isFormValid ? 'pointer' : 'not-allowed',
              boxShadow: isFormValid ? '0 4px 12px rgba(16, 185, 129, 0.35)' : 'none',
              opacity: isFormValid ? 1 : 0.75,
              transition: 'all 0.15s ease'
            }}
          >
            <Check size={16} />
            <span>
              {isFormValid
                ? (insertionMode === 'group'
                    ? `Apply to Quotation (${safeSetCount} Kit${safeSetCount > 1 ? 's' : ''})`
                    : `Apply Itemized Items (${calcResult.items.length * safeSetCount} Lines)`)
                : 'Enter Valid Quantities to Proceed'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

