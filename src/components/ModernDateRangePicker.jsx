import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const WEEKDAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// Helper to format Date to YYYY-MM-DD local string
export function formatDateToISO(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format ISO string (YYYY-MM-DD) into display label like "1 - 30 Jun 2026"
export function formatRangeDisplay(startDateStr, endDateStr, presetLabel) {
  if (presetLabel && presetLabel !== 'Custom range') {
    return presetLabel;
  }
  if (!startDateStr && !endDateStr) {
    return 'All Dates';
  }
  if (startDateStr && !endDateStr) {
    const s = new Date(startDateStr);
    return `${s.getDate()} ${MONTH_NAMES_SHORT[s.getMonth()]} ${s.getFullYear()}`;
  }
  if (startDateStr && endDateStr) {
    if (startDateStr === endDateStr) {
      const s = new Date(startDateStr);
      return `${s.getDate()} ${MONTH_NAMES_SHORT[s.getMonth()]} ${s.getFullYear()}`;
    }
    const s = new Date(startDateStr);
    const e = new Date(endDateStr);
    const sYear = s.getFullYear();
    const eYear = e.getFullYear();
    const sMonth = s.getMonth();
    const eMonth = e.getMonth();

    if (sYear === eYear && sMonth === eMonth) {
      // E.g., "1 - 30 Jun 2026"
      return `${s.getDate()} - ${e.getDate()} ${MONTH_NAMES_SHORT[sMonth]} ${sYear}`;
    } else if (sYear === eYear) {
      // E.g., "25 May - 10 Jun 2026"
      return `${s.getDate()} ${MONTH_NAMES_SHORT[sMonth]} - ${e.getDate()} ${MONTH_NAMES_SHORT[eMonth]} ${sYear}`;
    } else {
      // E.g., "15 Dec 2025 - 10 Jan 2026"
      return `${s.getDate()} ${MONTH_NAMES_SHORT[sMonth]} ${sYear} - ${e.getDate()} ${MONTH_NAMES_SHORT[eMonth]} ${eYear}`;
    }
  }
  return 'Date range';
}

export default function ModernDateRangePicker({
  startDate = '',
  endDate = '',
  onChange,
  placeholder = 'Date range',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [preset, setPreset] = useState(null);

  // Month navigation for calendar
  const initialDate = startDate ? new Date(startDate) : new Date();
  const [navYear, setNavYear] = useState(initialDate.getFullYear());
  const [navMonth, setNavMonth] = useState(initialDate.getMonth()); // 0-indexed

  // Range selection working state
  const [tempStart, setTempStart] = useState(startDate || null);
  const [tempEnd, setTempEnd] = useState(endDate || null);
  const [hoverDate, setHoverDate] = useState(null);

  const containerRef = useRef(null);

  // Synchronize when external props change
  useEffect(() => {
    setTempStart(startDate || null);
    setTempEnd(endDate || null);
    if (startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) {
        setNavYear(d.getFullYear());
        setNavMonth(d.getMonth());
      }
    }
  }, [startDate, endDate]);

  // Handle click outside to close popovers
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowCalendar(false);
        setHoverDate(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (navMonth === 0) {
      setNavMonth(11);
      setNavYear(prev => prev - 1);
    } else {
      setNavMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (navMonth === 11) {
      setNavMonth(0);
      setNavYear(prev => prev + 1);
    } else {
      setNavMonth(prev => prev + 1);
    }
  };

  // Preset Handlers
  const handleSelectPreset = (key) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let start = '';
    let end = '';
    let label = '';

    if (key === 'ALL') {
      start = '';
      end = '';
      label = 'All Dates';
    } else if (key === '24H') {
      start = formatDateToISO(today);
      end = formatDateToISO(today);
      label = '24h';
    } else if (key === '7D') {
      const past = new Date(today);
      past.setDate(today.getDate() - 6);
      start = formatDateToISO(past);
      end = formatDateToISO(today);
      label = '7 days';
    } else if (key === '2W') {
      const past = new Date(today);
      past.setDate(today.getDate() - 13);
      start = formatDateToISO(past);
      end = formatDateToISO(today);
      label = '2 weeks';
    } else if (key === '30D') {
      const past = new Date(today);
      past.setDate(today.getDate() - 29);
      start = formatDateToISO(past);
      end = formatDateToISO(today);
      label = '30 days';
    }

    setPreset(label);
    setTempStart(start);
    setTempEnd(end);
    setIsOpen(false);
    setShowCalendar(false);

    if (onChange) {
      onChange({ startDate: start, endDate: end, label });
    }
  };

  // Day selection logic for custom range
  const handleDayClick = (isoString) => {
    if (!tempStart || (tempStart && tempEnd)) {
      // First click: select start date
      setTempStart(isoString);
      setTempEnd(null);
    } else {
      // Second click: select end date
      let newStart = tempStart;
      let newEnd = isoString;
      if (newEnd < newStart) {
        newStart = isoString;
        newEnd = tempStart;
      }
      setTempStart(newStart);
      setTempEnd(newEnd);
      setPreset('Custom range');
      setIsOpen(false);
      setShowCalendar(false);

      if (onChange) {
        onChange({ startDate: newStart, endDate: newEnd, label: 'Custom range' });
      }
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setTempStart(null);
    setTempEnd(null);
    setPreset(null);
    if (onChange) {
      onChange({ startDate: '', endDate: '', label: 'All Dates' });
    }
  };

  // Calculate calendar days
  const daysInMonth = new Date(navYear, navMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(navYear, navMonth, 1).getDay() + 6) % 7; // Monday = 0, Sunday = 6

  const prevMonthDaysCount = new Date(navYear, navMonth, 0).getDate();
  const calendarCells = [];

  // 1. Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthDaysCount - i;
    const prevMonthIndex = navMonth === 0 ? 11 : navMonth - 1;
    const prevYearVal = navMonth === 0 ? navYear - 1 : navYear;
    const iso = `${prevYearVal}-${String(prevMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarCells.push({
      day,
      iso,
      isCurrentMonth: false
    });
  }

  // 2. Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${navYear}-${String(navMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      day: d,
      iso,
      isCurrentMonth: true
    });
  }

  // 3. Next month leading days (fill to complete week row or total rows)
  const remainingCells = (7 - (calendarCells.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const nextMonthIndex = navMonth === 11 ? 0 : navMonth + 1;
    const nextYearVal = navMonth === 11 ? navYear + 1 : navYear;
    const iso = `${nextYearVal}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({
      day: d,
      iso,
      isCurrentMonth: false
    });
  }

  // Active range calculation for calendar rendering
  const activeEffectiveStart = tempStart;
  const activeEffectiveEnd = tempEnd || (tempStart && hoverDate ? (hoverDate >= tempStart ? hoverDate : tempStart) : null);
  const isRangeReversed = tempStart && hoverDate && hoverDate < tempStart && !tempEnd;
  const effectiveStartBound = isRangeReversed ? hoverDate : activeEffectiveStart;
  const effectiveEndBound = isRangeReversed ? tempStart : activeEffectiveEnd;

  const displayLabel = formatRangeDisplay(startDate, endDate, preset);
  const hasActiveRange = Boolean(startDate || endDate);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', ...style }}>
      {/* TRIGGER BUTTON (Matches user reference image pill) */}
      <div
        id="btn-modern-date-range-trigger"
        onClick={() => {
          setIsOpen(!isOpen);
          setShowCalendar(false);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          height: '38px',
          padding: '0 12px',
          borderRadius: '8px',
          border: isOpen ? '1px solid #0E7490' : '1px solid #CBD5E1',
          backgroundColor: '#FFFFFF',
          cursor: 'pointer',
          userSelect: 'none',
          boxShadow: isOpen ? '0 0 0 3px rgba(14, 116, 144, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
          transition: 'all 0.15s ease'
        }}
      >
        <Calendar style={{ width: '14px', height: '14px', color: '#475569', flexShrink: 0 }} />
        <span style={{ fontSize: '13px', fontWeight: '500', color: hasActiveRange ? '#0F172A' : '#64748B', whiteSpace: 'nowrap' }}>
          {displayLabel}
        </span>
        {hasActiveRange && (
          <div
            onClick={handleClear}
            title="Clear date filter"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#F1F5F9',
              color: '#64748B',
              cursor: 'pointer',
              marginLeft: '2px',
              flexShrink: 0
            }}
          >
            <X size={11} />
          </div>
        )}
        <ChevronDown
          style={{
            width: '14px',
            height: '14px',
            color: '#64748B',
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease'
          }}
        />
      </div>

      {/* DROPDOWN 1: PRESET OPTIONS (Matches user reference image dropdown) */}
      {isOpen && !showCalendar && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: '180px',
            backgroundColor: '#FFFFFF',
            borderRadius: '14px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
            padding: '6px 0',
            zIndex: 9999,
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {/* Preset list items */}
          <div
            onClick={() => handleSelectPreset('ALL')}
            style={{
              padding: '9px 18px',
              fontSize: '13px',
              fontWeight: '500',
              color: '#334155',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            All Dates
          </div>

          <div
            onClick={() => handleSelectPreset('24H')}
            style={{
              padding: '9px 18px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1E293B',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            24h
          </div>

          <div
            onClick={() => handleSelectPreset('7D')}
            style={{
              padding: '9px 18px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1E293B',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            7 days
          </div>

          <div
            onClick={() => handleSelectPreset('2W')}
            style={{
              padding: '9px 18px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1E293B',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            2 weeks
          </div>

          <div
            onClick={() => handleSelectPreset('30D')}
            style={{
              padding: '9px 18px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#1E293B',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            30 days
          </div>

          {/* Separator line */}
          <div style={{ height: '1px', backgroundColor: '#F1F5F9', margin: '6px 0' }} />

          {/* Bottom Pill: "Custom range..." (Exact match from screenshot) */}
          <div style={{ padding: '0 10px' }}>
            <button
              id="btn-open-custom-range"
              type="button"
              onClick={() => {
                setShowCalendar(true);
              }}
              style={{
                width: '100%',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                border: 'none',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'block',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#D1FAE5')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ECFDF5')}
            >
              Custom range...
            </button>
          </div>
        </div>
      )}

      {/* DROPDOWN 2: CUSTOM RANGE CALENDAR (Matches user reference image calendar popup) */}
      {isOpen && showCalendar && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '320px',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 20px 35px -10px rgba(0, 0, 0, 0.15), 0 10px 15px -5px rgba(0, 0, 0, 0.08)',
            padding: '16px 18px',
            boxSizing: 'border-box',
            zIndex: 10000,
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {/* Top Row: Close button on left, centered title "Custom range" */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div
              onClick={() => setShowCalendar(false)}
              title="Back / Close"
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748B',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#E2E8F0')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
            >
              <X size={13} />
            </div>

            <div style={{ fontSize: '15px', fontWeight: '700', color: '#1E293B', textAlign: 'center' }}>
              Custom range
            </div>

            <div style={{ width: '24px' }} />
          </div>

          {/* Month & Year Navigator: < April 2026 > */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '0 4px' }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748B',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <ChevronLeft size={16} />
            </button>

            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
              {MONTH_NAMES[navMonth]} {navYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748B',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Days of Week Header: Mo Tu We Th Fr Sa Su */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '8px' }}>
            {WEEKDAY_NAMES.map((wd) => (
              <span key={wd} style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8' }}>
                {wd}
              </span>
            ))}
          </div>

          {/* Calendar Day Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              rowGap: '6px',
              textAlign: 'center'
            }}
          >
            {calendarCells.map((cell, idx) => {
              const { day, iso, isCurrentMonth } = cell;

              const isStart = effectiveStartBound === iso;
              const isEnd = effectiveEndBound === iso;
              const isInRange =
                effectiveStartBound &&
                effectiveEndBound &&
                iso >= effectiveStartBound &&
                iso <= effectiveEndBound;

              const hasRangeSpan = effectiveStartBound && effectiveEndBound && effectiveStartBound !== effectiveEndBound;

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(iso)}
                  onMouseEnter={() => setHoverDate(iso)}
                  style={{
                    position: 'relative',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  {/* Connecting Mint-Green Strip for Range */}
                  {hasRangeSpan && isInRange && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '2px',
                        bottom: '2px',
                        left: isStart ? '50%' : '0',
                        right: isEnd ? '50%' : '0',
                        backgroundColor: '#A7F3D0',
                        zIndex: 1
                      }}
                    />
                  )}

                  {/* Day Circle / Pill */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: isStart || isEnd ? '700' : isInRange ? '600' : '500',
                      backgroundColor: isStart || isEnd ? '#334155' : 'transparent',
                      color:
                        isStart || isEnd
                          ? '#FFFFFF'
                          : isInRange
                          ? '#064E3B'
                          : isCurrentMonth
                          ? '#334155'
                          : '#CBD5E1',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isStart && !isEnd && !isInRange) {
                        e.currentTarget.style.backgroundColor = '#F1F5F9';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isStart && !isEnd && !isInRange) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {day}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Helper Message: "Click here to start a range" (Exact match with screenshot) */}
          <div style={{ textAlign: 'center', marginTop: '16px', paddingTop: '4px' }}>
            {!tempStart ? (
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                Click here to start a range
              </span>
            ) : !tempEnd ? (
              <span style={{ fontSize: '12px', color: '#0E7490', fontWeight: '600' }}>
                Select end date to complete range
              </span>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#0E7490', fontWeight: '700' }}>
                  {formatRangeDisplay(tempStart, tempEnd, 'Custom range')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setShowCalendar(false);
                  }}
                  style={{
                    backgroundColor: '#0E7490',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
