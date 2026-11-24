import React from 'react';
import { ArrowRight, Layers, Warehouse } from 'lucide-react';

export default function CeoEngineeringTab({
  presetsList = [],
  bomList = [],
  onNavigateTab,
  teamDirectory = [],
  personPerformanceData = [],
  setActivePersonModal,
  periodMultiplier = 1
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Engineering Top Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Structural Presets Active</span>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#D97706' }}>{presetsList.length} Presets</div>
          <div style={{ fontSize: '11px', color: '#D97706', fontWeight: '700' }}>
            {presetsList.length > 0 ? 'Validated for Plant Tooling' : 'No presets registered'}
          </div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Calculation Engine Executions</span>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#2563EB' }}>{bomList.length} Formulations</div>
          <div style={{ fontSize: '11px', color: '#64748B' }}>Active project engineering</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Technical QA & Material Audits</span>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#4F46E5' }}>
            {bomList.filter(b => b.qcPassed || b.status === 'Completed').length} QA Validations
          </div>
          <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>Factory structural inspections</div>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EAEFEF', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>Engineering Status</span>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#16A34A' }}>
            {presetsList.length > 0 ? 'Presets Ready' : 'Standby'}
          </div>
          <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: '700' }}>Preset & tooling database active</div>
        </div>
      </div>

      {/* Design & Tech Support Leads */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #EAEFEF',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
            Design Engineering & Technical Support Leads
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => onNavigateTab && onNavigateTab('Preset Management')}
              style={{
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Preset Management <ArrowRight size={12} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {teamDirectory.filter(t => t.department === 'Design' || t.department === 'Tech Support').map(eng => {
            const perf = personPerformanceData.find(p => p.code === eng.code);
            return (
              <div
                key={eng.code}
                onClick={() => setActivePersonModal && setActivePersonModal(perf)}
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12.5px', fontWeight: '800', color: '#0F172A' }}>{eng.name}</div>
                    <div style={{ fontSize: '10.5px', color: '#64748B' }}>{eng.designation}</div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: perf?.ratingColor, backgroundColor: perf?.ratingBg, padding: '2px 7px', borderRadius: '6px' }}>
                    {perf?.targetPct}% Target
                  </span>
                </div>

                <div style={{ fontSize: '18px', fontWeight: '900', color: eng.department === 'Design' ? '#D97706' : '#4F46E5', marginTop: '4px' }}>
                  {Math.round(perf?.achievedVal || 0)} {eng.unit}
                </div>

                <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, perf?.targetPct || 0)}%`,
                    height: '100%',
                    backgroundColor: eng.department === 'Design' ? '#D97706' : '#4F46E5'
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#64748B' }}>
                  <span>{perf?.recordCount || 0} Technical Operations</span>
                  <span>Target: {Math.round(eng.monthlyTarget * periodMultiplier)} {eng.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Engineering Tools & Specifications Matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} color="#4F46E5" />
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
              Standard Preset Management
            </span>
          </div>
          <p style={{ fontSize: '11px', color: '#64748B', margin: 0, lineHeight: '1.4' }}>
            Pre-configured structural profiles for Solar Ground Mounts, Single-Axis Trackers, and Industrial Rooftops ready for 1-click BOM creation.
          </p>
          <button
            onClick={() => onNavigateTab && onNavigateTab('Preset Management')}
            style={{
              marginTop: '8px',
              border: '1px solid #C7D2FE',
              backgroundColor: '#EEF2FF',
              color: '#4338CA',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Manage Presets & Dies
          </button>
        </div>

        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #EAEFEF', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Warehouse size={16} color="#059669" />
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
              Raw Material Stock Status
            </span>
          </div>
          <p style={{ fontSize: '11px', color: '#64748B', margin: 0, lineHeight: '1.4' }}>
            Real-time visibility into steel coil tonnage, billet stocks, zinc coating stores, and hardware fastener buffers for uninterrupted production.
          </p>
          <button
            onClick={() => onNavigateTab && onNavigateTab('Stock Status')}
            style={{
              marginTop: '8px',
              border: '1px solid #A7F3D0',
              backgroundColor: '#ECFDF5',
              color: '#047857',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            View Live Stock Status
          </button>
        </div>
      </div>
    </div>
  );
}
