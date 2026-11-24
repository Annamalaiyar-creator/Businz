import React from 'react';
import { Eye, Filter, Search, Target, X } from 'lucide-react';

export default function CeoPersonnelTab({
  personDeptFilter,
  setPersonDeptFilter,
  personSearchQuery,
  setPersonSearchQuery,
  setShowCeoTargetModal,
  filteredPersonnel = [],
  setActivePersonModal,
  selectedPeriod,
  periodMultiplier = 1,
  setViewingRepBomsModal
}) {
  return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Top Personnel Filter & Search Toolbar */}
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #EAEFEF',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)'
          }}>
            {/* Department Quick Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
                Department:
              </span>
              {['all', 'Sales', 'Procurement', 'Accounts', 'Production', 'Dispatch', 'Billing', 'Design', 'Tech Support'].map(dept => (
                <button
                  key={dept}
                  onClick={() => setPersonDeptFilter(dept)}
                  style={{
                    border: 'none',
                    backgroundColor: personDeptFilter === dept ? '#0E7490' : '#F1F5F9',
                    color: personDeptFilter === dept ? '#FFFFFF' : '#475569',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: personDeptFilter === dept ? '800' : '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {dept === 'all' ? 'All Teams' : dept}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '4px 10px',
              minWidth: '220px'
            }}>
              <Search size={14} color="#64748B" />
              <input id="ceo-executive-dashboard-person-search-query" name="personSearchQuery" aria-label="Search person by name, code, role"
                type="text"
                placeholder="Search person by name, code, role..."
                value={personSearchQuery}
                onChange={(e) => setPersonSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  outline: 'none',
                  fontSize: '11px',
                  width: '100%',
                  color: '#0F172A'
                }}
               />
              {personSearchQuery && (
                <X size={12} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={() => setPersonSearchQuery('')} />
              )}
            </div>
          </div>

          {/* Person-Wise Performance Scorecards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))',
            gap: '12px',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box'
          }}>
            {filteredPersonnel.map((emp) => {
              const isCurrency = emp.unit === 'Revenue' || emp.unit === 'PO Spend' || emp.unit === 'Invoicing' || emp.unit === 'Collections';
              const formatMetric = (val) => {
                if (isCurrency) {
                  return val >= 10000000 
                    ? `₹ ${(val / 10000000).toFixed(2)} Cr`
                    : `₹ ${(val / 100000).toFixed(2)} L`;
                }
                return `${Math.round(val)} ${emp.unit}`;
              };
              const formattedVal = formatMetric(emp.achievedVal);
              const formattedTarget = formatMetric(emp.scaledTarget);

              const deptColor = {
                Sales: '#0E7490',
                Procurement: '#2563EB',
                Accounts: '#7C3AED',
                Billing: '#9333EA',
                Production: '#0284C7',
                Dispatch: '#059669',
                Design: '#D97706',
                'Tech Support': '#4F46E5'
              }[emp.department] || '#0E7490';

              const deptBg = {
                Sales: '#ECFEFF',
                Procurement: '#EFF6FF',
                Accounts: '#F5F3FF',
                Billing: '#FAF5FF',
                Production: '#F0F9FF',
                Dispatch: '#ECFDF5',
                Design: '#FFFBEB',
                'Tech Support': '#EEF2FF'
              }[emp.department] || '#ECFEFF';

              return (
                <div
                  key={emp.code}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '16px',
                    border: '1px solid #EAEFEF',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 4px 18px rgba(15, 23, 42, 0.03)',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                >
                  {/* Card Header: Avatar + Info + Rating */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          backgroundColor: emp.avatarBg,
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: '800',
                          flexShrink: 0
                        }}>
                          {emp.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                              {emp.name}
                            </span>
                            <span style={{
                              fontSize: '9.5px',
                              fontWeight: '700',
                              color: '#64748B',
                              backgroundColor: '#F1F5F9',
                              padding: '1px 5px',
                              borderRadius: '4px'
                            }}>
                              {emp.code}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>
                            {emp.designation}
                          </div>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        color: emp.ratingColor,
                        backgroundColor: emp.ratingBg,
                        padding: '2px 8px',
                        borderRadius: '8px',
                        whiteSpace: 'nowrap'
                      }}>
                        {emp.rating}
                      </span>
                    </div>

                    {/* Department Tag & Core Metric */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #F1F5F9' }}>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: '800',
                        color: deptColor,
                        backgroundColor: deptBg,
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        {emp.department} • {emp.unit}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {emp.department === 'Sales' && (
                          <span style={{
                            fontSize: '10.5px',
                            fontWeight: '800',
                            color: '#0E7490',
                            backgroundColor: '#ECFEFF',
                            border: '1px solid #A5F3FC',
                            padding: '1px 6px',
                            borderRadius: '6px'
                          }}>
                            📦 {emp.records?.boms?.length || 0} BOMs
                          </span>
                        )}
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>
                          {emp.recordCount} Active Records
                        </span>
                      </div>
                    </div>

                    {/* Value Metrics & Progress Bar */}
                    <div style={{ marginTop: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', padding: '10px 12px', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>
                            Achieved ({selectedPeriod})
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: '900', color: '#0F172A', marginTop: '1px' }}>
                            {formattedVal}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '10px', color: '#64748B' }}>Target: {formattedTarget}</div>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: emp.targetPct >= 100 ? '#16A34A' : '#0E7490' }}>
                            {emp.targetPct}%
                          </div>
                        </div>
                      </div>

                      {/* Visual progress bar */}
                      <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '4px', marginTop: '6px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, emp.targetPct)}%`,
                          height: '100%',
                          backgroundColor: emp.targetPct >= 100 ? '#16A34A' : (emp.targetPct >= 85 ? '#0E7490' : '#F59E0B'),
                          borderRadius: '4px',
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Action Button */}
                  <button
                    onClick={() => setActivePersonModal(emp)}
                    style={{
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Eye size={12} color="#0E7490" /> View Detailed Records & Activity
                  </button>
                </div>
              );
            })}
          </div>

          {/* Comprehensive Personnel Leaderboard Matrix Table */}
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
              <div>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Enterprise Personnel Accountability Matrix
                </span>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  Cross-departmental evaluation of key executives and representatives across Sales, SCM & Finance
                </div>
              </div>
              <span style={{ fontSize: '10.5px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '3px 8px', borderRadius: '8px' }}>
                {filteredPersonnel.length} Personnel Monitored
              </span>
            </div>

            <div style={{ border: '1px solid #F1F5F9', borderRadius: '10px', overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
              <table style={{ width: '100%', minWidth: '700px', fontSize: '11.5px', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontWeight: '700' }}>
                    <th style={{ padding: '10px 12px' }}>Team Member</th>
                    <th style={{ padding: '10px 12px' }}>Department & Role</th>
                    <th style={{ padding: '10px 12px' }}>Primary KPI Handled</th>
                    <th style={{ padding: '10px 12px' }}>Output Value ({selectedPeriod})</th>
                    <th style={{ padding: '10px 12px' }}>Target Progress</th>
                    <th style={{ padding: '10px 12px' }}>Status Rating</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPersonnel.map((emp, idx) => (
                    <tr key={emp.code} style={{ borderBottom: idx === filteredPersonnel.length - 1 ? 'none' : '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            backgroundColor: emp.avatarBg,
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: '800'
                          }}>
                            {emp.name[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: '800', color: '#0F172A' }}>{emp.name}</div>
                            <div style={{ fontSize: '10px', color: '#64748B' }}>{emp.code} • {emp.email}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: '10.5px',
                          fontWeight: '800',
                          color: emp.department === 'Sales' ? '#0E7490' : (emp.department === 'Procurement' ? '#2563EB' : '#7C3AED'),
                          backgroundColor: emp.department === 'Sales' ? '#ECFEFF' : (emp.department === 'Procurement' ? '#EFF6FF' : '#F5F3FF'),
                          padding: '2px 8px',
                          borderRadius: '6px'
                        }}>
                          {emp.department}
                        </span>
                        <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '2px' }}>{emp.role}</div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: '700', color: '#0F172A' }}>{emp.unit}</div>
                        <div style={{ fontSize: '10.5px', color: '#64748B' }}>{emp.recordCount} Transactions</div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: '800', color: '#0E7490', fontSize: '12.5px' }}>
                          {emp.achievedVal >= 10000000 ? `₹ ${(emp.achievedVal / 10000000).toFixed(2)} Cr` : `₹ ${(emp.achievedVal / 100000).toFixed(2)} L`}
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '80px', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.min(100, emp.targetPct)}%`,
                              height: '100%',
                              backgroundColor: emp.targetPct >= 100 ? '#16A34A' : (emp.targetPct >= 85 ? '#0E7490' : '#F59E0B')
                            }} />
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#0F172A' }}>{emp.targetPct}%</span>
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          color: emp.ratingColor,
                          backgroundColor: emp.ratingBg,
                          padding: '2px 7px',
                          borderRadius: '8px'
                        }}>
                          {emp.rating}
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => setActivePersonModal(emp)}
                          style={{
                            border: 'none',
                            backgroundColor: '#F1F5F9',
                            color: '#0E7490',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          View Dossier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
  );
}
