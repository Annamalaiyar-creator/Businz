import React from 'react';

/**
 * Format string to Title Case (First letter capitalized, remaining lowercase)
 * e.g., "COMPLETED" -> "Completed", "IN PROGRESS" -> "In Progress", "PASSED WITH DEFECTS" -> "Passed With Defects"
 */
export function formatTitleCase(text) {
  if (!text) return '';
  const str = String(text).trim();

  // Special overrides for standard acronyms
  if (str.toUpperCase() === 'OPEN') return 'Open';
  if (str.toUpperCase() === 'CLOSED') return 'Closed';
  if (str.toUpperCase() === 'EXCEL (.XLSX)') return 'Excel (.xlsx)';
  if (str.toUpperCase() === 'PDF (.PDF)') return 'PDF (.pdf)';
  if (str.toUpperCase() === 'GRADE A+') return 'Grade A+';
  if (str.toUpperCase() === 'GRADE A') return 'Grade A';

  return str
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (!word) return '';
      if (word.startsWith('(')) {
        return '(' + word.charAt(1).toUpperCase() + word.slice(2);
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Standardized Status Icons:
 * - Pending / Warning / Reorder Warning -> AlertTriangle
 * - In Progress / Running / On The Way / Processing -> Dashed circle
 * - Submitted / Sent / Dispatched -> Paper plane (Send)
 * - In Review / Inspection -> Search
 * - Success / Approved / Completed / Active / Closed / Sufficient / Resolved -> CheckCircle2
 * - Failed / Rejected / Overdue / Cancelled / Maintenance / Out Of Stock -> XCircle
 * - Expired / Draft / Inactive -> Clock
 */

const IconPending = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconInProgress = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeDasharray="3 3" strokeLinecap="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9"/>
  </svg>
);

const IconSubmitted = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(-25deg)', transformOrigin: 'center', flexShrink: 0 }}>
    <path d="m22 2-7 20-4-9-9-4Z"/>
    <path d="M22 2 11 13"/>
  </svg>
);

const IconInReview = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="11" cy="11" r="8"/>
    <path d="m21 21-4.3-4.3"/>
  </svg>
);

const IconSuccess = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>
);

const IconFailed = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9"/>
    <path d="m15 9-6 6"/>
    <path d="m9 9 6 6"/>
  </svg>
);

const IconExpired = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r="9"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

export function getStatusStyleConfig(statusOrType, customLabel) {
  const raw = String(statusOrType || customLabel || '').trim().toLowerCase();

  // 0. PO Specific Sequential Workflow States & Accounts Verification States
  if (
    raw === 'pending dispatch packing' ||
    raw === 'pending_dispatch_packing'
  ) {
    return {
      label: customLabel || 'Pending Dispatch Packing',
      bg: '#fff7ed',
      color: '#c2410c',
      border: '1px solid #fed7aa',
      Icon: IconPending
    };
  }

  if (
    raw === 'partially packed' ||
    raw === 'partially_packed'
  ) {
    return {
      label: customLabel || 'Partially Packed',
      bg: '#fef3c7',
      color: '#b45309',
      border: '1px solid #fde68a',
      Icon: IconInProgress
    };
  }

  if (
    raw === 'packed & ready for dispatch' ||
    raw === 'packed' ||
    raw === 'packing verified' ||
    raw === 'dispatch packing verified - sent to accounts'
  ) {
    return {
      label: customLabel || 'Packed & Ready for Dispatch',
      bg: '#dcfce7',
      color: '#166534',
      border: '1px solid #86efac',
      Icon: IconSuccess
    };
  }

  if (
    raw === 'awaiting vehicle loading' ||
    raw === 'awaiting vehicle loading & dispatch' ||
    raw === 'awaiting_vehicle_loading'
  ) {
    return {
      label: customLabel || 'Awaiting Vehicle Loading',
      bg: '#dbeafe',
      color: '#1e40af',
      border: '1px solid #93c5fd',
      Icon: IconInProgress
    };
  }

  if (
    raw === 'completed & dispatched' ||
    raw === 'closed / dispatched' ||
    raw === 'fully dispatched & delivered'
  ) {
    return {
      label: customLabel || 'Completed & Dispatched',
      bg: '#dcfce7',
      color: '#166534',
      border: '1px solid #86efac',
      Icon: IconSuccess
    };
  }

  if (
    raw === 'accounts verified' ||
    raw === 'accounts_verified' ||
    raw === 'accounts verified & passed to invoice'
  ) {
    return {
      label: customLabel || 'Accounts Verified',
      bg: '#dcfce7',
      color: '#166534',
      border: '1px solid #bbf7d0',
      Icon: IconSuccess
    };
  }

  if (
    raw === 'partially verified' ||
    raw === 'partially_verified'
  ) {
    return {
      label: customLabel || 'Partially Verified',
      bg: '#fef3c7',
      color: '#92400e',
      border: '1px solid #fde68a',
      Icon: IconPending
    };
  }

  if (
    raw === 'pending verification' ||
    raw === 'pending_verification'
  ) {
    return {
      label: customLabel || 'Pending Verification',
      bg: '#fef3c7',
      color: '#b45309',
      border: '1px solid #fde68a',
      Icon: IconPending
    };
  }

  if (
    raw === 'awaiting accounts verification' ||
    raw === 'awaiting_accounts_verification' ||
    raw === 'pending accounts verification'
  ) {
    return {
      label: customLabel || 'Awaiting Accounts Verification',
      bg: '#e0e7ff',
      color: '#3730a3',
      border: '1px solid #c7d2fe',
      Icon: IconInProgress
    };
  }

  if (
    raw === 'md approved' ||
    raw === 'md_approved'
  ) {
    return {
      label: customLabel || 'MD Approved',
      bg: '#e0e7ff',
      color: '#3730a3',
      border: '1px solid #c7d2fe',
      Icon: IconSuccess
    };
  }

  if (
    raw === 'payment processed' ||
    raw === 'payment_processed' ||
    raw === 'credit verified' ||
    raw === 'payment processed / credit verified'
  ) {
    return {
      label: customLabel || 'Payment Processed',
      bg: '#fef3c7',
      color: '#92400e',
      border: '1px solid #fde68a',
      Icon: IconSuccess
    };
  }

  if (
    raw === 'proceed po' ||
    raw === 'proceed_po'
  ) {
    return {
      label: customLabel || 'Proceed PO',
      bg: '#ecfeff',
      color: '#0e7490',
      border: '1px solid #a5f3fc',
      Icon: IconSuccess
    };
  }

  // 1. Pending / Warning (Soft Orange)
  if (
    raw === 'pending' || 
    raw === 'draft / pending approval' || 
    raw === 'waiting for approval' || 
    raw === 'pending approval' ||
    raw === 'pending review' ||
    raw === 'warning' ||
    raw === 'reorder warning' ||
    raw.includes('pending')
  ) {
    return {
      label: customLabel || 'Pending',
      bg: '#fff7ed',
      color: '#c2410c',
      border: '1px solid #fdba74',
      Icon: IconPending
    };
  }

  // 2. In Progress / Running / On The Way (Soft Blue)
  if (
    raw === 'in progress' || 
    raw === 'in_progress' || 
    raw === 'ontheway' || 
    raw === 'on the way' || 
    raw === 'in transit' || 
    raw === 'in procurement' || 
    raw === 'processing' ||
    raw === 'running' ||
    raw === 'planned' ||
    raw.includes('partially')
  ) {
    return {
      label: customLabel || (raw.includes('way') ? 'On The Way' : (raw.includes('partially') ? 'Partially Received' : 'In Progress')),
      bg: '#eff6ff',
      color: '#1d4ed8',
      border: '1px solid #bfdbfe',
      Icon: IconInProgress
    };
  }

  // 3. Submitted / Sent / Dispatched (Soft Purple)
  if (
    raw === 'submitted' || 
    raw === 'sent' || 
    raw === 'dispatched'
  ) {
    return {
      label: customLabel || 'Submitted',
      bg: '#faf5ff',
      color: '#7e22ce',
      border: '1px solid #e9d5ff',
      Icon: IconSubmitted
    };
  }

  // 4. In Review / Inspection Hold / Passed With Defects (Soft Yellow)
  if (
    raw === 'in review' || 
    raw === 'in_review' || 
    raw === 'review' || 
    raw === 'inspection hold' ||
    raw === 'passed with defect' ||
    raw === 'passed with defects' ||
    raw === 'idle' ||
    raw.includes('review')
  ) {
    return {
      label: customLabel || (raw.includes('defect') ? 'Passed With Defects' : 'In Review'),
      bg: '#fef9c3',
      color: '#a16207',
      border: '1px solid #fde047',
      Icon: IconInReview
    };
  }

  // 5. Completed / Approved / Success / Scheduled / Closed / Active / Sufficient / Resolved / In Stock (Soft Green)
  if (
    raw === 'completed' || 
    raw === 'approved' || 
    raw === 'success' || 
    raw === 'open' || 
    raw === 'scheduled' || 
    raw === 'closed' || 
    raw === 'sufficient' ||
    raw === 'resolved' ||
    raw === 'target met' ||
    raw === 'target exceeded' ||
    raw === 'in stock' ||
    raw === 'material ready' ||
    raw.includes('closed') || 
    raw.includes('fully') ||
    raw === 'active' ||
    raw === 'passed' ||
    raw === 'paid' ||
    raw === 'ready for payment' ||
    raw === '3-way match ok' ||
    raw === 'invoice confirmed' ||
    raw === 'confirmed' ||
    raw === 'invoice_confirmed' ||
    raw.includes('confirmed')
  ) {
    let display = customLabel || 'Completed';
    if (!customLabel) {
      if (raw.includes('confirmed')) display = 'Invoice Confirmed';
      else if (raw === 'approved') display = 'Approved';
      else if (raw === 'scheduled') display = 'Scheduled';
      else if (raw.includes('closed')) display = 'Closed';
      else if (raw === 'open') display = 'Open';
      else if (raw === 'completed') display = 'Completed';
    }
    return {
      label: display,
      bg: '#f0fdf4',
      color: '#15803d',
      border: '1px solid #bbf7d0',
      Icon: IconSuccess
    };
  }

  // 6. Failed / Rejected / Overdue / Cancelled / Shortage / Maintenance / Out of Stock (Soft Red)
  if (
    raw === 'failed' || 
    raw === 'rejected' || 
    raw === 'overdue' || 
    raw === 'cancelled' || 
    raw === 'canceled' ||
    raw === 'blacklisted' ||
    raw === 'shortage detected' ||
    raw === 'critical shortage' ||
    raw === 'out of stock' ||
    raw === 'maintenance' ||
    raw === 'on hold'
  ) {
    let display = customLabel || 'Failed';
    if (!customLabel) {
      if (raw === 'rejected') display = 'Rejected';
      else if (raw === 'overdue') display = 'Overdue';
    }
    return {
      label: display,
      bg: '#fee2e2',
      color: '#dc2626',
      border: '1px solid #fca5a5',
      Icon: IconFailed
    };
  }

  // 7. Expired / Draft / Inactive / Ready to Start (Soft Grey)
  if (
    raw === 'expired' || 
    raw === 'draft' || 
    raw === 'inactive' || 
    raw === 'archived' ||
    raw === 'ready to start'
  ) {
    return {
      label: customLabel || (raw === 'draft' ? 'Draft' : 'Expired'),
      bg: '#f1f5f9',
      color: '#475569',
      border: '1px solid #cbd5e1',
      Icon: IconExpired
    };
  }

  // Default Fallback
  return {
    label: customLabel || statusOrType || 'Pending',
    bg: '#fff7ed',
    color: '#c2410c',
    border: '1px solid #fdba74',
    Icon: IconPending
  };
}

export default function StatusBadge({ status, type, label, bg, color, border, style = {}, size = 'md' }) {
  const config = getStatusStyleConfig(type || status, label || status);
  const { Icon } = config;

  const isSmall = size === 'sm';
  const padding = isSmall ? '4px 10px' : '5px 12px';
  const fontSize = isSmall ? '11px' : '12px';
  const iconSize = isSmall ? 13 : 14;

  // Prioritize standardized config colors so statuses of the same name (e.g. "Completed") always share the exact same color system-wide
  const finalBg = config.bg;
  const finalColor = config.color;
  const finalBorder = config.border;

  const rawLabel = label || config.label || status || '';
  const displayLabel = formatTitleCase(rawLabel);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isSmall ? '5px' : '6px',
        padding: padding,
        borderRadius: '12px',
        backgroundColor: finalBg,
        color: finalColor,
        border: finalBorder,
        fontSize: fontSize,
        fontWeight: '700',
        letterSpacing: '0.1px',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        lineHeight: 1.2,
        ...style
      }}
    >
      <Icon size={iconSize} />
      <span>{displayLabel}</span>
    </span>
  );
}
