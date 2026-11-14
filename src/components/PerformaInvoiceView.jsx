import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Check, FileText, ArrowRight, Edit, Info, Layers, Boxes, Upload
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { getAllActivePresets } from '../vrmHdgProposalPresets';
import { compressAndSaveFile, normalizePaymentTerm, stripDataUrlsFromRecord } from '../utils/otherViewsShared';
import { getFullProductsCatalogWithStock } from '../utils/productCatalogService';
import { normalizeProductName, resolveProductCode } from '../utils/vrmProductsData';
import { saveCloudStoreImmediate, subscribeToCloudStore } from '../utils/supabaseDataSync';
import { notifyPiCreated } from '../services/notificationService';
import { searchCustomers } from '../services/customerService';
import { getHsnCode, is5PctSolarProduct } from '../utils/hsnCodeService';
import { PRESET_THEMES, getPresetTheme } from '../utils/presetThemes';
import {
  defaultSalesPIs,
  defaultProcurementPIs,
  normalizePiRecord,
  GST_STATE_MAP,
  canonicalizeSalespersonCode,
  CODE_TO_SALES_NAME,
  resolvePiSalesPersonName
} from './pi/piHelpers';
import { createPiActionHandlers } from './pi/piActionHandlers';
import PiListDashboardSection from './pi/PiListDashboardSection';
import PiCreatorEditorSection from './pi/PiCreatorEditorSection';
import PiDetailsAndConfirmModals from './pi/PiDetailsAndConfirmModals';
import PiPackAndBulkModals from './pi/PiPackAndBulkModals';

export { is5PctSolarProduct };
export { PRESET_THEMES, getPresetTheme };
export { GST_STATE_MAP, canonicalizeSalespersonCode, CODE_TO_SALES_NAME, resolvePiSalesPersonName };

export default function PerformaInvoiceView({ onConvertToBom, userRole = 'Procurement Head', onNavigateTab, targetPiNo, clearTargetPi }) {
  const isCeo = Boolean(
    (userRole && ['CEO', 'MD', 'Managing Director'].some(r => r.toLowerCase() === userRole.toLowerCase().trim())) ||
    (typeof window !== 'undefined' && ['CEO', 'MD', 'Managing Director'].some(r => r.toLowerCase() === (localStorage.getItem('controlroom_user_role') || '').toLowerCase().trim()))
  );
  const isSalesRole = userRole === 'Sales' || userRole === 'Sales Head' || userRole === 'Sales Executive';
  const storageKey = isSalesRole ? 'controlroom_sales_pi_store' : 'controlroom_procurement_pi_store';

  const [viewMode, setViewMode] = useState('list'); // 'list' | 'create' | 'edit'
  const [tableLoading, setTableLoading] = useState(() => {
    try {
      const s = localStorage.getItem('controlroom_sales_pi_store') || 
                localStorage.getItem('controlroom_procurement_pi_store') || 
                localStorage.getItem('sales_pi_store') || 
                localStorage.getItem('proforma_invoice_store');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch (_) {}
    return true;
  });
  const [isConvertingToBom, setIsConvertingToBom] = useState(false);
  const [convertingPiTarget, setConvertingPiTarget] = useState(null);
  const [syncingPiNo, setSyncingPiNo] = useState(null);
  const [selectedPi, setSelectedPi] = useState(null); // For viewing details popup overlay
  const [printModalPi, setPrintModalPi] = useState(null); // For official Print & PDF template
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [validationAlert, setValidationAlert] = useState(null); // Interactive Missing Fields popup modal
  const [piFormErrors, setPiFormErrors] = useState({});
  const [topToast, setTopToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const [filterSalesPerson, setFilterSalesPerson] = useState('All Sales');
  const [kpiFilterMeta, setKpiFilterMeta] = useState(() => {
    try {
      const saved = sessionStorage.getItem('controlroom_pi_initial_date_filter');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.targetKeys && Array.isArray(parsed.targetKeys)) {
          return {
            targetKeys: new Set(parsed.targetKeys),
            periodLabel: parsed.periodLabel || 'Overview',
            sourceLabel: parsed.sourceLabel || '',
            count: parsed.count ?? parsed.targetKeys.length
          };
        }
      }
    } catch (_) {}
    return null;
  });

  const [startDate, setStartDate] = useState(() => {
    try {
      const saved = sessionStorage.getItem('controlroom_pi_initial_date_filter');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.start || '';
      }
    } catch (_) {}
    return '';
  });
  const [endDate, setEndDate] = useState(() => {
    try {
      const saved = sessionStorage.getItem('controlroom_pi_initial_date_filter');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.end || '';
      }
    } catch (_) {}
    return '';
  });

  useEffect(() => {
    const handleFilterDate = (e) => {
      if (e?.detail) {
        if (e.detail.startDate !== undefined) setStartDate(e.detail.startDate || '');
        if (e.detail.endDate !== undefined) setEndDate(e.detail.endDate || '');
        if (e.detail.targetKeys && Array.isArray(e.detail.targetKeys)) {
          setKpiFilterMeta({
            targetKeys: new Set(e.detail.targetKeys),
            periodLabel: e.detail.periodLabel || 'Overview',
            sourceLabel: e.detail.sourceLabel || '',
            count: e.detail.count ?? e.detail.targetKeys.length
          });
          setPiTab('All');
        }
        setCurrentPage(1);
      }
    };
    window.addEventListener('controlroom_pi_filter_date', handleFilterDate);
    return () => window.removeEventListener('controlroom_pi_filter_date', handleFilterDate);
  }, []);

  // Dynamic mobile viewport detection (<= 768px)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768 || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null;
    const updateMobile = () => {
      setIsMobile((mediaQuery && mediaQuery.matches) || window.innerWidth <= 768);
    };
    if (mediaQuery) {
      if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', updateMobile);
      else if (mediaQuery.addListener) mediaQuery.addListener(updateMobile);
    }
    window.addEventListener('resize', updateMobile);
    return () => {
      if (mediaQuery) {
        if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', updateMobile);
        else if (mediaQuery.removeListener) mediaQuery.removeListener(updateMobile);
      }
      window.removeEventListener('resize', updateMobile);
    };
  }, []);

  const showTopToast = (message, type = 'success', duration = 5000) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('businz_show_toast', {
        detail: {
          message: String(message || '').replace(/^[✅📝❌⏳⚠️\s]+/, '').trim(),
          title: type === 'error' ? 'Attention Required' : 'Proforma Invoice Update',
          type,
          document_type: 'PI',
          duration: Math.round(duration / 1000)
        }
      }));
    }
  };

  const [bomList, setBomList] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_bom_store');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    const refreshBoms = () => {
      try {
        const saved = localStorage.getItem('controlroom_bom_store');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setBomList(parsed);
        }
      } catch (e) {}
    };

    fetch('/api/boms')
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        if (res && res.data && Array.isArray(res.data)) {
          setBomList(res.data);
          try {
            localStorage.setItem('controlroom_bom_store', JSON.stringify(res.data));
          } catch (_) {}
        }
      })
      .catch(() => {});

    window.addEventListener('controlroom_bom_store_updated', refreshBoms);
    window.addEventListener('controlroom_storage_update', refreshBoms);
    window.addEventListener('storage', refreshBoms);
    return () => {
      window.removeEventListener('controlroom_bom_store_updated', refreshBoms);
      window.removeEventListener('controlroom_storage_update', refreshBoms);
      window.removeEventListener('storage', refreshBoms);
    };
  }, []);

  // Cache-First Instant Hydration: load immediately from localStorage with 0ms delay
  const [piList, setPiList] = useState(() => {
    try {
      const s = localStorage.getItem('controlroom_sales_pi_store') || 
                localStorage.getItem('controlroom_procurement_pi_store') || 
                localStorage.getItem('sales_pi_store') || 
                localStorage.getItem('proforma_invoice_store');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizePiRecord);
        }
      }
    } catch (_) {}
    return [];
  });

  // Handle targetPiNo navigation
  useEffect(() => {
    if (targetPiNo && Array.isArray(piList) && piList.length > 0) {
      const t = String(targetPiNo).trim().toLowerCase();
      const match = piList.find(p => 
        (p.piNo && p.piNo.toLowerCase() === t) ||
        (p.estimate_number && p.estimate_number.toLowerCase() === t) ||
        (p.id && String(p.id).toLowerCase() === t)
      );
      if (match) {
        setSelectedPi(match);
        setSearchQuery(targetPiNo);
        if (typeof clearTargetPi === 'function') clearTargetPi();
      }
    }
  }, [targetPiNo, piList]);

  // Two-way helper to find all BOMs generated from this PI (Strict 1-to-1 mapping)
  const getConvertedBomsForPi = (pi) => {
    if (!pi) return [];

    const piNum = String(pi.piNo || pi.estimate_number || pi.id || '').trim().toLowerCase();
    if (!piNum) return [];

    const explicitCode = String(
      pi.convertedBomNo || 
      pi.convertedBomCode || 
      pi.converted_bom_no || 
      pi.converted_bom_code || ''
    ).trim().toLowerCase();

    const matches = (bomList || []).filter(b => {
      if (!b) return false;
      // Do NOT link to cancelled or restored BOMs
      if (b.cancelled || b.status === 'Cancelled' || b.status === 'Cancelled & Stock Restored') return false;

      const sPi = String(b.sourcePiNo || b.source_pi_no || '').trim().toLowerCase();
      const bCode = String(b.bomCode || b.code || b.id || '').trim().toLowerCase();
      const bId = String(b.id || '').trim().toLowerCase();

      // STRICT HARD BARRIER: BOM-659 belongs strictly and exclusively to PI-00061.
      if (bCode === 'bom-659' && piNum !== 'pi-00061') {
        return false;
      }

      // STRICT HARD BARRIER: PI 495 does not belong to BOM 381.
      if (piNum.includes('495') && bCode.includes('381')) {
        return false;
      }

      const piCust = String(pi.customerName || pi.vendor || pi.companyName || '').trim().toLowerCase();
      const bCust = String(b.customerName || b.companyName || '').trim().toLowerCase();
      const custMatches = (!piCust || !bCust || piCust.includes(bCust) || bCust.includes(piCust));

      // 1. Authoritative 1-to-1 match by explicit converted BOM code on the PI:
      // If the BOM explicitly has a sourcePiNo pointing to a DIFFERENT PI, it belongs to that other PI!
      if (explicitCode && (bCode === explicitCode || bId === explicitCode)) {
        if (sPi && sPi !== piNum) {
          return false; // BOM belongs to its original source PI, not this PI
        }
        if (!custMatches) {
          return false; // Different customer entirely
        }
        return true;
      }

      // 2. Strict 1-to-1 match by source PI number on the BOM:
      if (sPi && sPi === piNum) {
        if (!custMatches) {
          return false;
        }
        return true;
      }

      return false;
    });

    if (matches.length <= 1) return matches;

    // Strict 1-to-1 deduplication safeguard:
    if (explicitCode) {
      const explicitMatch = matches.find(b => {
        const bCode = String(b.bomCode || b.code || b.id || '').trim().toLowerCase();
        return bCode === explicitCode;
      });
      if (explicitMatch) return [explicitMatch];
    }

    const sorted = [...matches].sort((a, b) => {
      const na = parseInt(String(a.bomCode || a.code || '').replace(/\D/g, '') || '0', 10);
      const nb = parseInt(String(b.bomCode || b.code || '').replace(/\D/g, '') || '0', 10);
      return nb - na;
    });
    return [sorted[0]];
  };

  const handleRevertPiToIssued = (pi) => {
    if (!pi) return;
    const targetNo = String(pi.piNo || pi.id || '').trim().toLowerCase();
    const updated = piList.map(p => {
      const pNo = String(p.piNo || p.id || '').trim().toLowerCase();
      if (pNo === targetNo) {
        return {
          ...p,
          status: 'Issued',
          convertedToBom: false,
          convertedBomNo: null,
          convertedBomCode: null
        };
      }
      return p;
    });
    updatePiList(updated);
    if (selectedPi) {
      setSelectedPi(prev => prev ? ({
        ...prev,
        status: 'Issued',
        convertedToBom: false,
        convertedBomNo: null,
        convertedBomCode: null
      }) : null);
    }
  };

  const [cancellingPiNo, setCancellingPiNo] = useState(null);

  const handleCancelPi = async (piToCancel) => {
    if (!piToCancel || !piToCancel.piNo) return;
    const cleanPiNo = String(piToCancel.piNo).trim();
    if (!window.confirm(`Are you sure you want to mark Proforma Invoice ${cleanPiNo} as Cancelled?`)) {
      return;
    }

    setCancellingPiNo(cleanPiNo);
    const updated = piList.map(p => (p.piNo === cleanPiNo || p.id === cleanPiNo) ? { ...p, status: 'Cancelled', statusType: 'cancelled' } : p);
    updatePiList(updated);

    try {
      const resp = await fetch('/api/estimates/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          piNo: cleanPiNo,
          reason: 'Cancelled by user in Businz'
        })
      });
      const data = await resp.json();
      if (data && data.success) {
        notifyPiCreated({
          title: `PI ${cleanPiNo} Cancelled`,
          message: data.message || `Proforma Invoice ${cleanPiNo} marked as Cancelled.`,
          type: 'warning'
        });
      }
    } catch (err) {
      console.warn('[PI CANCEL ERROR]', err);
    } finally {
      setCancellingPiNo(null);
      setSelectedPi(null);
    }
  };

  const currentEmpId = (localStorage.getItem('controlroom_logged_emp_id') || '').trim();
  const currentEmpName = (localStorage.getItem('controlroom_logged_user_name') || '').trim();
  const currentLoggedEmail = (localStorage.getItem('controlroom_logged_user') || '').trim().toLowerCase();
  const isRestrictedSalesUser = Boolean(
    userRole &&
    ['Sales', 'Sales Executive', 'Salesperson', 'Sales Rep', 'Sales Representative', 'Sales Head'].some(r => r.toLowerCase() === userRole.toLowerCase().trim()) &&
    !['CEO', 'MD', 'Managing Director', 'Technical Administrator', 'Dispatch Head', 'Dispatch', 'Dispatch Team', 'Production Head', 'Production', 'Accounts Head', 'Accounts Executive', 'Accounts', 'Billing', 'Floor Supervisor', 'Procurement Head', 'Procurement'].some(r => r.toLowerCase() === userRole.toLowerCase().trim())
  );

  // Tech Support & Management PI Assignment Privileges
  const isTechSupport = Boolean(
    userRole &&
    (userRole === 'Tech Support' || userRole === 'Technical Support' || (userRole || '').toLowerCase().includes('tech support') || userRole === 'Technical Administrator')
  );
  const isTechSupportLogin = Boolean(
    userRole &&
    (userRole === 'Tech Support' || userRole === 'Technical Support' || (userRole || '').toLowerCase().trim() === 'tech support')
  );
  const isStrictTechSupport = Boolean(
    isTechSupportLogin &&
    !['CEO', 'MD', 'Managing Director', 'Technical Administrator', 'Admin', 'Super Admin'].some(r => (userRole || '').toLowerCase().trim() === r.toLowerCase())
  );
  const isSalesHead = Boolean(userRole && userRole.toLowerCase().includes('sales head'));
  // Assign privileges strictly restricted to Tech Support login alone (hidden for CEO & other roles)
  const canAssignPi = Boolean(
    !isCeo &&
    userRole &&
    (userRole === 'Tech Support' || userRole === 'Technical Support' || (userRole || '').toLowerCase().trim() === 'tech support')
  );

  // PI Assignment Modal State
  const [showAssignPiModal, setShowAssignPiModal] = useState(false);
  const [assignPiTarget, setAssignPiTarget] = useState(null);
  const [salespersonsList, setSalespersonsList] = useState([]);
  const [selectedSalespersonCode, setSelectedSalespersonCode] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [isAssigningPi, setIsAssigningPi] = useState(false);

  useEffect(() => {
    fetch('/api/crm/salespersons')
      .then(r => r.json())
      .then(d => {
        if (d && d.success && Array.isArray(d.salespersons)) {
          setSalespersonsList(d.salespersons);
        }
      })
      .catch(err => console.warn('Could not load salespersons list:', err.message));
  }, []);

  const handleOpenAssignModal = (pi) => {
    if (!pi) return;
    setAssignPiTarget(pi);
    const existingCode = pi.salesPersonCode || '';
    setSelectedSalespersonCode(existingCode);
    setAssignReason('');
    setShowAssignPiModal(true);
  };

  const handleConfirmAssignPi = async () => {
    if (!assignPiTarget || !selectedSalespersonCode) {
      alert('Please select a sales representative to assign this Proforma Invoice to.');
      return;
    }

    const targetSp = salespersonsList.find(s => s.employee_code === selectedSalespersonCode);
    if (!targetSp) {
      alert('Selected salesperson is invalid.');
      return;
    }

    const cleanPiNo = String(assignPiTarget.piNo || assignPiTarget.id || '').trim();
    setIsAssigningPi(true);

    try {
      const res = await fetch(`/api/crm/proforma-invoices/${encodeURIComponent(cleanPiNo)}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-emp-id': currentEmpId || 'TS-001',
          'x-user-name': currentEmpName || userRole || 'Tech Support',
          'x-user-role': userRole || 'Tech Support'
        },
        body: JSON.stringify({
          assignedToId: targetSp.employee_code,
          assignedToName: targetSp.employee_name,
          assignedToRole: targetSp.role || 'Sales Executive',
          assignedToEmail: targetSp.email || '',
          reason: assignReason || `Assigned by ${currentEmpName || userRole || 'Tech Support'}`
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to assign Proforma Invoice');
      }

      const nowIso = new Date().toISOString();
      const updatedItem = json.pi || {
        ...assignPiTarget,
        salesPerson: targetSp.employee_name,
        salesperson: targetSp.employee_name,
        salesRep: targetSp.employee_name,
        salesPersonCode: targetSp.employee_code,
        salesPersonEmail: targetSp.email || '',
        assignedSalesperson: targetSp.employee_name,
        assignedSalespersonCode: targetSp.employee_code,
        assignedBy: currentEmpName || userRole || 'Tech Support',
        assignedByRole: userRole || 'Tech Support',
        assignedAt: nowIso,
        assignmentReason: assignReason || `Assigned by ${currentEmpName || userRole || 'Tech Support'}`
      };

      const nextList = (piList || []).map(p =>
        String(p.piNo || p.id).trim().toLowerCase() === cleanPiNo.toLowerCase() ? updatedItem : p
      );
      updatePiList(nextList);

      if (selectedPi && String(selectedPi.piNo || selectedPi.id).trim().toLowerCase() === cleanPiNo.toLowerCase()) {
        setSelectedPi(updatedItem);
      }

      setShowAssignPiModal(false);
      setAssignPiTarget(null);
      showTopToast(`✅ Proforma Invoice ${cleanPiNo} successfully assigned to ${targetSp.employee_name}!`, 'success', 5000);
    } catch (err) {
      alert(`Assignment failed: ${err.message}`);
    } finally {
      setIsAssigningPi(false);
    }
  };

  const getEffectiveSalesPerson = () => {
    if (currentEmpName && currentEmpName !== 'undefined' && currentEmpName !== 'null' && currentEmpName.toLowerCase() !== 'vijay') return currentEmpName;
    try {
      const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
      const allEmps = [...(Array.isArray(storedEmps) ? storedEmps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];
      const match = allEmps.find(e => e && e.role === userRole && e.employee_name && e.employee_name.toLowerCase() !== 'vijay');
      if (match && (match.employee_name || match.name)) return match.employee_name || match.name;
    } catch (_) {}
    if (currentEmpName && currentEmpName !== 'undefined' && currentEmpName !== 'null') return currentEmpName;
    const storedUser = localStorage.getItem('controlroom_logged_user');
    if (storedUser && storedUser.trim() && storedUser !== 'undefined' && storedUser !== 'null') return storedUser.trim();
    if (userRole === 'Sales Head') return 'Sales Head';
    if (userRole === 'Accounts Head') return 'Venkatesh';
    if (userRole === 'Technical Administrator' || userRole === 'CEO') return 'Annamalaiyar';
    return userRole || 'Sales Executive';
  };

  // Date format helper: strictly DD.MM.YYYY
  const formatPiDateDot = (dStr) => {
    if (!dStr) return '—';
    const clean = String(dStr).trim();
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(clean)) return clean;
    
    const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const [, y, m, d] = isoMatch;
      return `${d}.${m}.${y}`;
    }
    
    const dt = new Date(clean);
    if (!isNaN(dt.getTime())) {
      const d = String(dt.getDate()).padStart(2, '0');
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const y = dt.getFullYear();
      return `${d}.${m}.${y}`;
    }
    return clean;
  };

  const visiblePIList = useMemo(() => {
    const raw = Array.isArray(piList) ? piList.filter(Boolean) : [];

    // Tech Support Isolation: Tech Support users only see PIs created by them
    if (isStrictTechSupport) {
      const curCode = (currentEmpId || '').toUpperCase().trim();
      const curName = (currentEmpName || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      const curEmail = (currentLoggedEmail || '').trim().toLowerCase();

      return raw.filter(pi => {
        if (!pi) return false;
        const createdCode = String(pi.createdById || pi.salesPersonCode || '').toUpperCase().trim();
        const createdName = String(pi.createdBy || pi.createdByName || pi.author || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
        const createdEmail = String(pi.createdByEmail || pi.salesPersonEmail || '').trim().toLowerCase();
        const assignedByCode = String(pi.assignedById || '').toUpperCase().trim();
        const assignedByName = String(pi.assignedBy || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();

        // STRICT SEPARATION: Any Sales Rep PI (SE-001 to SE-009, SH-001) is strictly excluded from Tech Support
        if (createdCode.startsWith('SE-') || createdCode.startsWith('SH-')) {
          if (assignedByCode !== curCode && createdCode !== curCode) {
            return false;
          }
        }
        // Disambiguate Sales Vasanth Kumar S vs Tech Support Vasanth
        const piFullText = [pi.salesPerson, pi.createdBy, pi.createdByName, pi.author].filter(Boolean).join(' ').toLowerCase();
        if (piFullText.includes('kumar') && (createdCode === 'SE-003' || piFullText.includes('vasanth'))) {
          if (curCode !== 'SE-003') {
            return false;
          }
        }

        // 1. Strict EMP Code matching (TS-001, TS-002, etc.)
        if (curCode && createdCode && (curCode === createdCode || (curCode === 'TS-VRM001' && createdCode === 'TS-001') || (curCode === 'TS-001' && createdCode === 'TS-VRM001'))) {
          return true;
        }
        if (curCode && assignedByCode && (curCode === assignedByCode)) {
          return true;
        }

        // 2. Exact email matching
        if (curEmail && createdEmail && curEmail === createdEmail) {
          return true;
        }

        // 3. Name matching (with strict boundary: "vasanth" vs "vasanth kumar")
        if (curName && createdName) {
          if (curName === createdName) return true;
          // Check for distinct numeric identifiers like "Tech Support 1" vs "Tech Support 2"
          const curNumMatch = curName.match(/\d+/);
          const createdNumMatch = createdName.match(/\d+/);
          if (curNumMatch && createdNumMatch && curNumMatch[0] !== createdNumMatch[0]) {
            return false;
          }
          if ((curName.includes('kumar') && !createdName.includes('kumar')) || (!curName.includes('kumar') && createdName.includes('kumar'))) {
            return false;
          }
          if (createdName === curName) {
            return true;
          }
        }
        if (curName && assignedByName) {
          const curNumMatch = curName.match(/\d+/);
          const assignedNumMatch = assignedByName.match(/\d+/);
          if (curNumMatch && assignedNumMatch && curNumMatch[0] !== assignedNumMatch[0]) {
            return false;
          }
          if ((curName.includes('kumar') && !assignedByName.includes('kumar')) || (!curName.includes('kumar') && assignedByName.includes('kumar'))) {
            return false;
          }
          if (curName === assignedByName) {
            return true;
          }
        }

        // 4. Default fallback for generic TS user and generic TS records
        const isGenericUser = !curName || curName === 'tech support' || curName === 'tech support specialist';
        const isGenericRecord = !createdName || createdName === 'tech support' || createdName === 'tech support specialist';
        if (isGenericUser && isGenericRecord) {
          return true;
        }

        return false;
      });
    }

    if (!isRestrictedSalesUser) return raw;

    const curCode = currentEmpId.toUpperCase();
    const curName = currentEmpName.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    const curEmail = currentLoggedEmail;

    // If no specific employee profile is configured, show all records safely
    if (!curCode && !curName && !curEmail) return raw;

    // Canonical Sales Team Definitions with Name matchers
    const SALES_TEAM = [
      { code: 'SE-001', name: 'Manojraj Selvaraj', matchNames: ['manoj', 'manojraj', 'manoj raj'], emails: ['sales.s1@'], oldCodes: ['SH-001'] },
      { code: 'SE-002', name: 'Sanjai kumar', matchNames: ['sanjai', 'sanjay', 'sanjai kumar'], emails: ['sanjaikumar', 'sales@gmail.com'], oldCodes: [] },
      { code: 'SE-003', name: 'Vasanth Kumar S', matchNames: ['vasanth kumar s', 'vasanth kumar', 'vasanthkumar'], excludeNames: ['support', 'tech'], emails: ['vasanthkumar'], oldCodes: ['SE-VRM006'] },
      { code: 'SE-004', name: 'Mohith JV', matchNames: ['mohith', 'mohit'], emails: ['sales.s4@'], oldCodes: ['SE-015'] },
      { code: 'SE-005', name: 'Shanthi', matchNames: ['shanthi', 'santhi'], emails: ['sales.s3@'], oldCodes: [] },
      { code: 'SE-006', name: 'Dhana Sekar', matchNames: ['dhana', 'dhanasekar', 'dhana sekar'], emails: ['dhanasekar'], oldCodes: ['SE-020'] },
      { code: 'SE-007', name: 'PRASHANTH', matchNames: ['prashanth', 'prasanth'], emails: ['sales.s2@'], oldCodes: [] },
      { code: 'SE-008', name: 'Pavithra', matchNames: ['pavithra', 'pavitra'], emails: ['projectsales'], oldCodes: ['SE-010'] },
      { code: 'SE-009', name: 'KALAISELVI T', matchNames: ['kalaiselvi', 'kalai'], emails: ['mms@'], oldCodes: ['SE-VRM090'] }
    ];

    // Detect which sales rep is currently logged in (Name-First, then Code)
    const activeRep = SALES_TEAM.find(rep => 
      (curName && rep.matchNames.some(m => curName.includes(m) && (!rep.excludeNames || !rep.excludeNames.some(ex => curName.includes(ex))))) ||
      (curCode && rep.code === curCode) ||
      (curEmail && rep.emails.some(e => curEmail.includes(e)))
    );

    return raw.filter(pi => {
      if (!pi) return false;

      // Extract all identifying names and text from the PI
      const piNameText = [
        pi.salesPerson, pi.salesperson, pi.salesRep, pi.createdBy,
        pi.assignedSalesperson, pi.assignedToName
      ].filter(Boolean).join(' ').toLowerCase();

      const piEmail = String(pi.salesPersonEmail || pi.email || '').toLowerCase().trim();
      const piCode = String(pi.salesPersonCode || pi.createdById || '').toUpperCase().trim();
      const assignedCode = String(pi.assignedSalespersonCode || pi.assignedToCode || pi.assignedToId || '').toUpperCase().trim();

      if (activeRep) {
        // 1. Primary Rule: NAME MATCHING
        // If PI contains activeRep's name keywords:
        const matchesActiveRepName = activeRep.matchNames.some(m => 
          piNameText.includes(m) && (!activeRep.excludeNames || !activeRep.excludeNames.some(ex => piNameText.includes(ex)))
        );
        if (matchesActiveRepName) {
          return true;
        }

        // If PI explicitly contains ANOTHER sales rep's name keywords, strictly exclude it!
        const matchesOtherRepName = SALES_TEAM.some(other => 
          other.code !== activeRep.code && 
          other.matchNames.some(m => piNameText.includes(m) && (!other.excludeNames || !other.excludeNames.some(ex => piNameText.includes(ex))))
        );
        if (matchesOtherRepName) {
          return false;
        }

        // 2. Email matching
        if (piEmail && activeRep.emails.some(e => piEmail.includes(e))) {
          return true;
        }

        // 3. Old code matching (e.g. SH-001 for Manojraj)
        if (activeRep.oldCodes && activeRep.oldCodes.includes(piCode)) {
          return true;
        }

        // 4. Directly assigned to activeRep
        if (assignedCode && assignedCode === activeRep.code) {
          return true;
        }

        // 5. Explicit new code match ONLY IF the PI has no conflicting other name
        if (piCode === activeRep.code) {
          return true;
        }

        return false;
      }

      // Fallback for non-mapped sales users
      if (curName && piNameText.includes(curName)) return true;
      if (curCode && (piCode === curCode || assignedCode === curCode)) return true;
      if (curEmail && piEmail === curEmail) return true;
      return false;
    });
  }, [piList, isRestrictedSalesUser, isStrictTechSupport, currentEmpId, currentEmpName, currentLoggedEmail]);

  const piMetrics = useMemo(() => {
    const list = Array.isArray(visiblePIList) ? visiblePIList : [];
    
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const utcToday = now.toISOString().split('T')[0];
    const isToday = (dStr) => {
      if (!dStr) return false;
      const s = String(dStr);
      return s.startsWith(localToday) || s.startsWith(utcToday);
    };

    const cleanNum = (val) => {
      if (typeof val === 'number') return isNaN(val) ? 0 : val;
      if (!val) return 0;
      const n = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
      return isNaN(n) ? 0 : n;
    };

    const formatCurrencyShort = (num) => {
      if (!num || isNaN(num)) return '₹ 0.00 L';
      if (num >= 10000000) return `₹ ${(num / 10000000).toFixed(2)} Cr`;
      return `₹ ${(num / 100000).toFixed(2)} L`;
    };

    // 1. Total PIs today
    const todayPis = list.filter(pi => {
      if (!pi) return false;
      return isToday(pi.piDate) || isToday(pi.date) || isToday(pi.createdAt);
    });
    const todayPiVal = todayPis.reduce((acc, pi) => acc + cleanNum(pi.grandTotal || pi.amount || pi.total || 0), 0);

    // 2. Converted to BOM today
    const todayConvertedPis = list.filter(pi => {
      if (!pi) return false;
      const matchedBoms = getConvertedBomsForPi(pi);
      if (matchedBoms.length > 0) {
        return matchedBoms.some(b => isToday(b.date) || isToday(b.createdAt)) || isToday(pi.convertedAt) || isToday(pi.updatedAt);
      }
      if (pi.status === 'Converted to BOM' || pi.statusType === 'converted') {
        return isToday(pi.convertedAt) || isToday(pi.updatedAt) || isToday(pi.date);
      }
      return false;
    });
    const todayConvertedVal = todayConvertedPis.reduce((acc, pi) => acc + cleanNum(pi.grandTotal || pi.amount || pi.total || 0), 0);

    // 3. Assigned to today
    const todayAssignedPis = list.filter(pi => {
      if (!pi) return false;
      const isAssigned = Boolean(
        pi.assignedSalesperson ||
        pi.assignedToName ||
        pi.assignedToId ||
        (pi.salesPerson && !pi.salesPerson.toLowerCase().includes('support') && !pi.salesPerson.toLowerCase().includes('admin') && !pi.salesPerson.toLowerCase().includes('direct'))
      );
      if (!isAssigned) return false;
      return isToday(pi.assignedAt) || isToday(pi.piDate) || isToday(pi.createdAt);
    });
    const todayAssignedVal = todayAssignedPis.reduce((acc, pi) => acc + cleanNum(pi.grandTotal || pi.amount || pi.total || 0), 0);

    return {
      todayPiCount: todayPis.length,
      todayPiValFormatted: formatCurrencyShort(todayPiVal),
      todayConvertedCount: todayConvertedPis.length,
      todayConvertedValFormatted: formatCurrencyShort(todayConvertedVal),
      todayAssignedCount: todayAssignedPis.length,
      todayAssignedValFormatted: formatCurrencyShort(todayAssignedVal),
      conversionRate: todayPis.length > 0 
        ? `${((todayConvertedPis.length / todayPis.length) * 100).toFixed(0)}% Converted`
        : '0% Converted'
    };
  }, [visiblePIList, bomList]);

  useEffect(() => {
    const loadPiData = async () => {
      // 1. Authoritative primary source: Self-hosted PostgreSQL database via /api/proforma-invoices
      try {
        const dbRes = await fetch('/api/proforma-invoices');
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          if (Array.isArray(dbData) && dbData.length > 0) {
            const mergedMap = new Map();
            // Authoritative database records take precedence
            dbData.forEach(p => {
              if (p && p.piNo) mergedMap.set(String(p.piNo).trim().toLowerCase(), normalizePiRecord(p));
            });

            // Zero-Data-Loss Safeguard: Preserve any locally staged/offline PIs
            try {
              const localCached = JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem('controlroom_sales_pi_store') || '[]');
              if (Array.isArray(localCached)) {
                localCached.forEach(lp => {
                  if (lp && lp.piNo) {
                    const k = String(lp.piNo).trim().toLowerCase();
                    if (!mergedMap.has(k)) {
                      mergedMap.set(k, normalizePiRecord(lp));
                    }
                  }
                });
              }
            } catch (_) {}

            const finalMerged = Array.from(mergedMap.values()).map(normalizePiRecord);
            setPiList(finalMerged);
            try {
              localStorage.setItem(storageKey, JSON.stringify(finalMerged));
              localStorage.setItem('controlroom_sales_pi_store', JSON.stringify(finalMerged));
            } catch (_) {}
            setTableLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('[PI Database Load Notice]:', err?.message || err);
      } finally {
        setTableLoading(false);
      }

      // 2. Fetch Zoho Estimates in background and smoothly enrich without blocking the UI
      try {
        const zohoRes = await fetch('/api/estimates');
        if (zohoRes.ok) {
          const zohoData = await zohoRes.json();
          if (Array.isArray(zohoData) && zohoData.length > 0) {
            const getRealZohoId = (cand) => {
              const s = String(cand || '').trim();
              return /^\d{15,22}$/.test(s) ? s : null;
            };

            setPiList(prevList => {
              const mergedMap = new Map();
              (prevList || []).forEach(p => {
                if (p && p.piNo) mergedMap.set(String(p.piNo).trim().toLowerCase(), p);
              });

              zohoData.forEach(zp => {
                if (zp && zp.piNo) {
                  const k = String(zp.piNo).trim().toLowerCase();
                  const zpZohoId = getRealZohoId(zp.zohoEstimateId) || getRealZohoId(zp.id);
                  if (!mergedMap.has(k)) {
                    mergedMap.set(k, normalizePiRecord({
                      ...zp,
                      zohoSynced: Boolean(zpZohoId),
                      zohoEstimateId: zpZohoId,
                      zohoModule: 'Quotes'
                    }));
                  } else {
                    const existing = mergedMap.get(k);
                    const finalId = zpZohoId || getRealZohoId(existing?.zohoEstimateId);
                    mergedMap.set(k, normalizePiRecord({
                      ...zp,
                      ...existing,
                      zohoSynced: Boolean(finalId),
                      zohoEstimateId: finalId,
                      zohoModule: 'Quotes'
                    }));
                  }
                }
              });

              const finalMerged = Array.from(mergedMap.values()).map(normalizePiRecord);
              try {
                localStorage.setItem(storageKey, JSON.stringify(finalMerged));
                localStorage.setItem('controlroom_sales_pi_store', JSON.stringify(finalMerged));
              } catch (_) {}
              return finalMerged;
            });
          }
        }
      } catch (err) {
        console.warn('[ZOHO ESTIMATES FETCH NOTICE]', err);
      }
    };

    loadPiData();

    // Live Realtime sync directly from Supabase Database
    const sub = subscribeToCloudStore('sales_pi_store', (latest) => {
      if (Array.isArray(latest) && latest.length > 0) {
        setPiList(prevList => {
          const merged = new Map();
          (prevList || []).forEach(p => { if (p && p.piNo) merged.set(String(p.piNo).trim().toLowerCase(), p); });
          latest.forEach(p => {
            if (p && p.piNo) {
              const k = String(p.piNo).trim().toLowerCase();
              const existing = merged.get(k);
              if (!existing) {
                merged.set(k, normalizePiRecord(p));
              } else {
                const incomingTime = new Date(p.updatedAt || p.updated_at || p.createdAt || p.created_at || 0).getTime();
                const existingTime = new Date(existing.updatedAt || existing.updated_at || existing.createdAt || existing.created_at || 0).getTime();
                if (incomingTime >= existingTime) {
                  merged.set(k, normalizePiRecord({ ...existing, ...p }));
                }
              }
            }
          });
          return Array.from(merged.values());
        });
        setTableLoading(false);
      }
    });

    // ⚡ Native Server-Sent Event (SSE) & Real-Time Single-Record Delta Listeners
    const handlePiRealtimeEvent = (e) => {
      const detail = e?.detail || {};
      const incomingPi = detail?.updatedPi || detail?.pi;
      const targetPiNo = String(detail?.piNo || detail?.documentId || incomingPi?.piNo || incomingPi?.id || '').trim();

      if (incomingPi && (incomingPi.piNo || incomingPi.id)) {
        const norm = normalizePiRecord(incomingPi);
        setPiList(prevList => {
          const list = Array.isArray(prevList) ? prevList : [];
          const cleanKey = String(norm.piNo || norm.id).trim().toLowerCase();
          const idx = list.findIndex(p => p && String(p.piNo || p.id).trim().toLowerCase() === cleanKey);
          let next;
          if (idx !== -1) {
            next = [...list];
            next[idx] = {
              ...list[idx],
              ...norm,
              salesPerson: norm.salesPerson || norm.assignedSalesperson || norm.salesperson || list[idx].salesPerson,
              salesperson: norm.salesperson || norm.salesPerson || norm.assignedSalesperson || list[idx].salesperson,
              salesRep: norm.salesRep || norm.salesPerson || norm.assignedSalesperson || list[idx].salesRep,
              salesPersonCode: norm.salesPersonCode || norm.assignedSalespersonCode || list[idx].salesPersonCode,
              assignedSalesperson: norm.assignedSalesperson || norm.salesPerson || list[idx].assignedSalesperson,
              assignedSalespersonCode: norm.assignedSalespersonCode || norm.salesPersonCode || list[idx].assignedSalespersonCode,
              assignedToCode: norm.assignedToCode || norm.assignedSalespersonCode || norm.salesPersonCode,
              assignedToId: norm.assignedToId || norm.assignedSalespersonCode || norm.salesPersonCode,
              assignedToName: norm.assignedToName || norm.assignedSalesperson || norm.salesPerson
            };
          } else {
            next = [norm, ...list];
          }
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
            localStorage.setItem('controlroom_sales_pi_store', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
      } else if (targetPiNo) {
        fetch('/api/proforma-invoices')
          .then(r => r.json())
          .then(allPis => {
            if (Array.isArray(allPis)) {
              const matched = allPis.find(p => p && String(p.piNo || p.id).trim().toLowerCase() === targetPiNo.toLowerCase());
              if (matched) {
                const normMatched = normalizePiRecord(matched);
                setPiList(prevList => {
                  const list = Array.isArray(prevList) ? prevList : [];
                  const cleanKey = targetPiNo.toLowerCase();
                  const idx = list.findIndex(p => p && String(p.piNo || p.id).trim().toLowerCase() === cleanKey);
                  let next;
                  if (idx !== -1) {
                    next = [...list];
                    next[idx] = {
                      ...list[idx],
                      ...normMatched,
                      salesPerson: normMatched.salesPerson || normMatched.assignedSalesperson || list[idx].salesPerson,
                      salesperson: normMatched.salesperson || normMatched.salesPerson || list[idx].salesperson,
                      salesRep: normMatched.salesRep || normMatched.salesPerson || list[idx].salesRep,
                      salesPersonCode: normMatched.salesPersonCode || normMatched.assignedSalespersonCode || list[idx].salesPersonCode,
                      assignedSalesperson: normMatched.assignedSalesperson || normMatched.salesPerson || list[idx].assignedSalesperson,
                      assignedSalespersonCode: normMatched.assignedSalespersonCode || normMatched.salesPersonCode || list[idx].assignedSalespersonCode,
                      assignedToCode: normMatched.assignedToCode || normMatched.assignedSalespersonCode || normMatched.salesPersonCode,
                      assignedToId: normMatched.assignedToId || normMatched.assignedSalespersonCode || normMatched.salesPersonCode,
                      assignedToName: normMatched.assignedToName || normMatched.assignedSalesperson || normMatched.salesPerson
                    };
                  } else {
                    next = [normMatched, ...list];
                  }
                  try {
                    localStorage.setItem(storageKey, JSON.stringify(next));
                    localStorage.setItem('controlroom_sales_pi_store', JSON.stringify(next));
                  } catch (_) {}
                  return next;
                });
              }
            }
          })
          .catch(() => {});
      }
    };

    window.addEventListener('controlroom_pi_updated', handlePiRealtimeEvent);
    window.addEventListener('controlroom_sales_pi_assigned', handlePiRealtimeEvent);
    window.addEventListener('controlroom_pi_store_updated', handlePiRealtimeEvent);

    return () => {
      if (sub && sub.unsubscribe) sub.unsubscribe();
      window.removeEventListener('controlroom_pi_updated', handlePiRealtimeEvent);
      window.removeEventListener('controlroom_sales_pi_assigned', handlePiRealtimeEvent);
      window.removeEventListener('controlroom_pi_store_updated', handlePiRealtimeEvent);
    };
  }, [storageKey, isSalesRole]);

  const handlePrintTemplatePiUpdate = (updatedPi) => {
    if (!updatedPi || !updatedPi.piNo) return;
    const cleanNo = String(updatedPi.piNo).trim().toLowerCase();
    setPiList(prevList => {
      const exists = (prevList || []).some(p => String(p.piNo || p.id).trim().toLowerCase() === cleanNo);
      let nextList;
      if (exists) {
        nextList = (prevList || []).map(p => String(p.piNo || p.id).trim().toLowerCase() === cleanNo ? normalizePiRecord({ ...p, ...updatedPi }) : p);
      } else {
        nextList = [normalizePiRecord(updatedPi), ...(prevList || [])];
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextList));
        localStorage.setItem('controlroom_sales_pi_store', JSON.stringify(nextList));
        saveCloudStoreImmediate('sales_pi_store', nextList);
        window.dispatchEvent(new Event('controlroom_storage_update'));
      } catch (_) {}
      return nextList;
    });
  };

  const updatePiList = (newList) => {
    setPiList(newList);
    try {
      localStorage.setItem('controlroom_sales_pi_store', JSON.stringify(newList));
      localStorage.setItem('controlroom_procurement_pi_store', JSON.stringify(newList));
      saveCloudStoreImmediate('sales_pi_store', newList);
      saveCloudStoreImmediate('proforma_invoice_store', newList);
      window.dispatchEvent(new Event('controlroom_storage_update'));
    } catch (e) {}
  };

  // Direct 1-way manual push of a PI to Zoho Books (Quotes / Estimates)
  const syncPiToZoho = async (targetPi) => {
    if (!targetPi || syncingPiNo) return;
    const cleanNo = String(targetPi.piNo || targetPi.id || '').trim();
    setSyncingPiNo(cleanNo);
    showTopToast(`Pushing Proforma Invoice ${cleanNo} to Zoho Books Quotes...`, 'info', 4000);

    try {
      const sanitizedPi = stripDataUrlsFromRecord(targetPi);
      delete sanitizedPi.paymentProofDoc;
      delete sanitizedPi.deliveryProofDoc;
      delete sanitizedPi.deliveryAddressProofDoc;

      const res = await fetch('/api/zoho/push-pi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piNo: cleanNo, pi: sanitizedPi })
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          res.status === 404
            ? `Backend API server unreachable (HTTP 404). Please ensure the Node.js backend application is running.`
            : `Server returned HTTP ${res.status} (${res.statusText || 'Non-JSON response'}).`
        );
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || data?.message || 'Zoho Books synchronization failed');
      }

      const est = data.estimate;
      const estNo = est?.estimate_number || cleanNo;
      const estId = String(est?.estimate_id || '').trim();

      const updated = piList.map(p => {
        const matchNo = String(p.piNo || '').trim().toLowerCase();
        const matchId = String(p.id || '').trim().toLowerCase();
        const targetKey = cleanNo.toLowerCase();
        if (matchNo === targetKey || matchId === targetKey || matchNo === estNo.toLowerCase()) {
          return {
            ...p,
            piNo: estNo,
            zohoEstimateId: estId,
            zohoEstimateNo: estNo,
            zohoSynced: true,
            zohoSyncedAt: new Date().toISOString(),
            zohoSyncError: null,
            zohoModule: 'Quotes'
          };
        }
        return p;
      });

      updatePiList(updated);

      if (selectedPi) {
        setSelectedPi(prev => {
          if (!prev) return null;
          const pNo = String(prev.piNo || '').trim().toLowerCase();
          const pId = String(prev.id || '').trim().toLowerCase();
          const targetKey = cleanNo.toLowerCase();
          if (pNo === targetKey || pId === targetKey || pNo === estNo.toLowerCase()) {
            return {
              ...prev,
              piNo: estNo,
              zohoEstimateId: estId,
              zohoEstimateNo: estNo,
              zohoSynced: true,
              zohoSyncedAt: new Date().toISOString(),
              zohoSyncError: null,
              zohoModule: 'Quotes'
            };
          }
          return prev;
        });
      }

      showTopToast(`Proforma Invoice ${cleanNo} successfully pushed to Zoho Books as Quote #${estNo}!`, 'success', 6000);
    } catch (err) {
      console.error('[Zoho Push Error]:', err);
      showTopToast(`❌ Zoho Push Failed: ${err.message}`, 'error', 7000);
    } finally {
      setSyncingPiNo(null);
    }
  };

  // Direct one-click completion and release of a Draft PI
  const handleReleaseDraftPi = async (targetPi) => {
    if (!targetPi) return;
    const cleanPiNo = targetPi.piNo || targetPi.id;
    const safeCustomer = (targetPi.vendor || targetPi.customerName || 'Customer').trim();

    // Check line items exist
    const itemsList = Array.isArray(targetPi.items) ? targetPi.items : [];
    if (itemsList.length === 0) {
      showTopToast('⚠️ Cannot complete PI without line items. Please click "Edit Info" to add items first.', 'warning', 4000);
      return;
    }

    // Check Preset Amt is entered if preset items exist
    const hasPreset = itemsList.some(it => it.isPresetItem);
    if (hasPreset) {
      const pGroups = targetPi.presetGroups || {};
      let missingKitPrice = false;
      if (Object.keys(pGroups).length === 0) {
        if (!targetPi.unitValue || parseFloat(targetPi.unitValue) <= 0) {
          missingKitPrice = true;
        }
      } else {
        Object.values(pGroups).forEach(g => {
          if (!g.kitPrice || parseFloat(g.kitPrice) <= 0) {
            missingKitPrice = true;
          }
        });
      }
      if (missingKitPrice) {
        showTopToast('⚠️ Pack Amt (₹) is mandatory for pack structure kits. Please click "Edit Info" to enter the amount first.', 'warning', 4500);
        return;
      }
    }

    const updatedPI = {
      ...targetPi,
      status: 'Issued',
      statusType: 'issued',
      issuedAt: new Date().toISOString()
    };

    const updatedList = piList.map(p => {
      const matchNo = String(p.piNo || '').trim().toLowerCase();
      const matchId = String(p.id || '').trim().toLowerCase();
      const targetKey = String(cleanPiNo).trim().toLowerCase();
      if (matchNo === targetKey || matchId === targetKey) {
        return updatedPI;
      }
      return p;
    });

    const cleanSalesPerson = (targetPi.salesPerson || targetPi.salesperson || targetPi.createdBy || 'Sales Executive').trim();
    const amtStr = targetPi.amount ? `₹${parseFloat(targetPi.amount).toLocaleString('en-IN')}` : (targetPi.totalAmount ? `₹${parseFloat(targetPi.totalAmount).toLocaleString('en-IN')}` : '');

    updatePiList(updatedList);
    notifyPiCreated({
      piNo: cleanPiNo,
      customerName: safeCustomer,
      salesPerson: cleanSalesPerson,
      amount: amtStr
    });

    // Push to backend /api/estimates
    try {
      const sanitized = stripDataUrlsFromRecord(updatedPI);
      delete sanitized.paymentProofDoc;
      delete sanitized.deliveryProofDoc;
      delete sanitized.deliveryAddressProofDoc;
      sanitized.isEdit = true;
      const resp = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized)
      });
      if (!resp.ok) {
        console.warn('PI release sync response not OK:', resp.status);
      }
    } catch (err) {
      console.warn('PI release sync error:', err);
    }
  };

  const handleConvertToBom = (pi) => {
    if (!pi || isConvertingToBom) return;

    if (pi.status === 'Draft') {
      showTopToast('⚠️ Draft Proforma Invoices cannot be converted to BOM. Please review and Release/Issue the PI first.', 'warning', 4000);
      return;
    }

    // Strict 1-to-1 Safeguard: If this PI is already converted or linked to an active BOM, navigate directly to it!
    const existingBoms = getConvertedBomsForPi(pi);
    let targetExistingBom = existingBoms && existingBoms.length > 0 ? existingBoms[0] : null;
    if (!targetExistingBom) {
      const pNo = String(pi.piNo || pi.estimate_number || pi.id || '').trim().toLowerCase();
      targetExistingBom = (bomList || []).find(b => {
        if (!b || b.cancelled || b.status === 'Cancelled' || b.status === 'Cancelled & Stock Restored') return false;
        const sPi = String(b.sourcePiNo || b.piNo || '').trim().toLowerCase();
        const bCode = String(b.bomCode || b.code || b.id || '').trim().toLowerCase();
        // BOM-659 belongs strictly to PI-00061
        if (bCode === 'bom-659' && pNo !== 'pi-00061') return false;
        // Never claim a BOM that is already owned by a different PI
        if (sPi && pNo && sPi !== pNo) return false;
        if (pi.convertedBomNo && (b.bomCode === pi.convertedBomNo || b.id === pi.convertedBomNo)) return true;
        if (pi.convertedBomCode && (b.bomCode === pi.convertedBomCode || b.id === pi.convertedBomCode)) return true;
        return false;
      });
    }

    if (targetExistingBom) {
      const targetBomCode = targetExistingBom.bomCode || targetExistingBom.code || targetExistingBom.id;
      showTopToast(`ℹ️ Proforma Invoice ${pi.piNo || ''} is already converted to ${targetBomCode}. Opening existing BOM...`, 'info', 4000);
      window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', { 
        detail: { tab: 'Sales BOM', targetBom: targetBomCode } 
      }));
      if (typeof onNavigateTab === 'function') {
        onNavigateTab('Sales BOM');
      }
      return;
    }

    setIsConvertingToBom(true);
    setConvertingPiTarget(pi);

    const cleanAmount = parseFloat(String(pi.amount || '').replace(/[^0-9.]/g, '')) || 0;
    const qty = parseFloat(pi.quantity) || 1;
    const rate = pi.unitValue || (cleanAmount > 0 ? cleanAmount / qty : 1000);

    // Cleanly normalize billing and delivery addresses for zero-loss BOM conversion
    const bStreet = typeof pi.billingAddress === 'object' ? (pi.billingAddress?.street || pi.billingAddress?.address || '') : (typeof pi.billingAddress === 'string' ? pi.billingAddress : (pi.billingStreet || ''));
    const bCity = typeof pi.billingAddress === 'object' ? (pi.billingAddress?.city || '') : (pi.billingCity || '');
    const bState = typeof pi.billingAddress === 'object' ? (pi.billingAddress?.state || '') : (pi.billingState || '');
    const bPin = typeof pi.billingAddress === 'object' ? (pi.billingAddress?.pincode || pi.billingAddress?.pin || '') : (pi.billingPincode || '');

    const isSameAddr = pi.sameAsBilling !== false;
    const dStreet = isSameAddr ? bStreet : (typeof pi.deliveryAddress === 'object' ? (pi.deliveryAddress?.street || pi.deliveryAddress?.address || '') : (typeof pi.deliveryAddress === 'string' ? pi.deliveryAddress : (pi.deliveryStreet || '')));
    const dCity = isSameAddr ? bCity : (typeof pi.deliveryAddress === 'object' ? (pi.deliveryAddress?.city || '') : (pi.deliveryCity || ''));
    const dState = isSameAddr ? bState : (typeof pi.deliveryAddress === 'object' ? (pi.deliveryAddress?.state || '') : (pi.deliveryState || ''));
    const dPin = isSameAddr ? bPin : (typeof pi.deliveryAddress === 'object' ? (pi.deliveryAddress?.pincode || pi.deliveryAddress?.pin || '') : (pi.deliveryPincode || ''));

    const formatAddrParts = (st, ct, sta, pin) => {
      return [st, [ct, sta].filter(Boolean).join(', '), pin ? `PIN: ${pin}` : ''].filter(Boolean).join(', ');
    };
    const bFormatted = formatAddrParts(bStreet, bCity, bState, bPin) || bStreet;
    const dFormatted = isSameAddr ? bFormatted : (formatAddrParts(dStreet, dCity, dState, dPin) || dStreet);

    const billingObj = { street: bStreet, address: bStreet, city: bCity, state: bState, pincode: bPin };
    const deliveryObj = { street: dStreet, address: dStreet, city: dCity, state: dState, pincode: dPin };

    const compName = (pi.vendor || pi.customerName || pi.companyName || '').trim();
    const custName = compName || 'Customer Order';
    const contactPerson = (pi.contactPerson || pi.contact || '').trim();

    const cleanGrand = parseFloat(String(pi.grandTotal || pi.amount || 0).replace(/[^0-9.]/g, '')) || 0;
    const cleanSub = parseFloat(String(pi.subtotal || pi.unitValue || 0).replace(/[^0-9.]/g, '')) || (cleanGrand > 0 ? Math.round(cleanGrand / 1.18) : 0);

    const pGroups = pi.presetGroups || {};
    const pGroupList = Array.isArray(pGroups) ? pGroups : Object.values(pGroups);
    const pName = pi.presetName || (pGroupList.length > 0 ? pGroupList.map(g => `${g.presetName} (${g.setCount} ${g.unit === 'kW' ? 'kW' : (g.setCount > 1 ? 'Sets' : 'Set')})`).join(' + ') : null);
    const pKitPrice = pi.presetKitPrice != null ? pi.presetKitPrice : (pi.kitSubtotal != null ? pi.kitSubtotal : (cleanGrand > 0 ? Math.round(cleanGrand / 1.18) : null));
    // Do NOT aggregate sum multiple kits into a single confusing number:
    const pSetCount = pGroupList.length === 1 ? (parseFloat(pGroupList[0]?.setCount) || 1) : (pi.presetSetCount || null);

    const conversionData = {
      sourcePiNo: pi.piNo,
      customerName: custName,
      companyName: compName,
      contactPerson: contactPerson,
      phone: pi.phone || pi.mobile || '',
      email: pi.email || '',
      gstNo: pi.gstNo || pi.gst || '',
      productName: pi.productName || 'Solar Mounting Rails & Accessories',
      billingAddress: bFormatted,
      billingAddressObj: billingObj,
      billingStreet: bStreet,
      billingCity: bCity,
      billingState: bState,
      billingPincode: bPin,
      deliveryAddress: dFormatted,
      deliveryAddressObj: deliveryObj,
      deliveryStreet: dStreet,
      deliveryCity: dCity,
      deliveryState: dState,
      deliveryPincode: dPin,
      sameAsBilling: isSameAddr,
      transportMode: pi.transportMode || 'Transport',
      transporterName: pi.transporterName || pi.transporter || '',
      destination: pi.destination || pi.deliveryCity || (typeof pi.deliveryAddress === 'string' ? pi.deliveryAddress : '') || '',
      vehicleNo: pi.vehicleNo || '',
      transportScope: pi.transportScope || 'VRM Structures',
      lrNo: pi.lrNo || '',
      paymentType: normalizePaymentTerm(pi.paymentType || pi.paymentTerms || '100% Paid'),
      paymentTerms: normalizePaymentTerm(pi.paymentType || pi.paymentTerms || '100% Paid'),
      paymentProofDoc: pi.paymentProofDoc || pi.proofDoc || pi.paymentSlip || pi.paymentDoc || null,
      partialAmount: pi.partialAmount || null,
      deliveryProofDoc: pi.deliveryProofDoc || pi.deliveryAddressProofDoc || null,
      creditDays: pi.creditDays || '',
      presetGroups: pGroups,
      presetName: pName,
      presetKitPrice: pKitPrice,
      presetSetCount: pSetCount,
      kitSubtotal: pi.kitSubtotal || (cleanGrand > 0 ? Math.round(cleanGrand / 1.18) : null),
      subtotal: cleanSub || null,
      grandTotal: cleanGrand || null,
      amount: pi.amount || ('₹' + Math.round(cleanGrand).toLocaleString('en-IN')),
      salesPerson: pi.salesPerson || pi.salesperson || pi.salesRep || getEffectiveSalesPerson(),
      salesPersonCode: pi.salesPersonCode || currentEmpId,
      createdBy: pi.createdBy || getEffectiveSalesPerson(),
      createdById: pi.createdById || currentEmpId,
      items: (pi.items && pi.items.length > 0) ? pi.items.map(it => {
        const isPreset = Boolean(it.isPresetItem);
        const resolvedC = it.code || it.sku || it.itemId || resolveProductCode(it) || '';
        const itQty = parseFloat(it.qty) || 1;
        let itRate = String(it.rate !== undefined && it.rate !== null && it.rate !== '' ? it.rate : '0');
        if (!isPreset && (parseFloat(itRate) === 0 || isNaN(parseFloat(itRate))) && cleanGrand > 0) {
          itRate = String(Math.round(cleanGrand / itQty / 1.18));
        }
        return {
          ...it,
          code: resolvedC,
          name: it.name || 'Structural Steel Beams',
          category: it.category || (isPreset ? 'Preset Component' : 'Custom Material'),
          uom: it.uom || it.unit || 'NOS',
          unit: it.uom || it.unit || 'NOS',
          qty: String(it.qty || '1'),
          baseQty: it.baseQty != null ? it.baseQty : (parseFloat(it.qty) || 1),
          rate: isPreset ? '0' : itRate,
          gstRate: it.gstRate || '18%',
          isPresetItem: isPreset,
          presetGroupId: it.presetGroupId || null,
          presetName: it.presetName || null
        };
      }) : [
        {
          code: pi.productCode || resolveProductCode({ name: pi.productName }) || '',
          name: pi.productName || 'Structural Steel Beams',
          category: 'PI Converted Materials',
          uom: pi.uom || pi.unit || 'NOS',
          unit: pi.uom || pi.unit || 'NOS',
          qty: String(qty),
          rate: String(rate),
          gstRate: '18%',
          isPresetItem: false
        }
      ],
      remarks: ''
    };

    try {
      localStorage.setItem('controlroom_pending_pi_to_bom', JSON.stringify(stripDataUrlsFromRecord(conversionData)));
    } catch (e) {}

    if (typeof onConvertToBom === 'function') {
      onConvertToBom(conversionData);
    } else {
      window.dispatchEvent(new CustomEvent('controlroom_convert_pi_bom', { detail: conversionData }));
    }
    setIsConvertingToBom(false);
    setConvertingPiTarget(null);
  };

  // Confirmation and edit states
  const [deleteIdx, setDeleteIdx] = useState(null); // Row index to delete
  const [showSaveConfirm, setShowSaveConfirm] = useState(false); // Save confirmation
  const [showCancelConfirm, setShowCancelConfirm] = useState(false); // Cancel confirmation
  const [editIdx, setEditIdx] = useState(null); // Row index to edit
  const [activeDropdownIdx, setActiveDropdownIdx] = useState(null); // Active 3-dot dropdown index

  const [selectedPIs, setSelectedPIs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [piTab, setPiTab] = useState('All');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const handleSelectAll = (e, items) => {
    if (e.target.checked) {
      setSelectedPIs(items.map(pi => pi.piNo));
    } else {
      setSelectedPIs([]);
    }
  };

  const handleSelectRow = (piNo) => {
    if (selectedPIs.includes(piNo)) {
      setSelectedPIs(selectedPIs.filter(item => item !== piNo));
    } else {
      setSelectedPIs([...selectedPIs, piNo]);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setFilterSalesPerson('All Sales');
    setStartDate('');
    setEndDate('');
    setKpiFilterMeta(null);
    try { sessionStorage.removeItem('controlroom_pi_initial_date_filter'); } catch (_) {}
    setPiTab('All');
    setCurrentPage(1);
  };

  // Resolve currently logged in user dynamically (matching Header & BOM creation)
  const getActiveUserName = () => {
    const stored = localStorage.getItem('controlroom_logged_user_name');
    if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim() !== '' && stored.toLowerCase() !== 'vijay') return stored.trim();
    try {
      const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
      const allEmps = [...(Array.isArray(storedEmps) ? storedEmps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];
      const match = allEmps.find(e => e && e.role === userRole && e.employee_name && e.employee_name.toLowerCase() !== 'vijay');
      if (match && (match.employee_name || match.name)) return match.employee_name || match.name;
    } catch (_) {}
    if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim() !== '') return stored.trim();
    try {
      const u = JSON.parse(localStorage.getItem('controlroom_logged_user') || '{}');
      if (u.name) return u.name;
      if (u.fullName) return u.fullName;
      if (u.username) return u.username;
    } catch (e) {}
    if (userRole === 'Sales Head') return 'Sales Head';
    if (userRole === 'CEO' || userRole === 'Technical Administrator') return 'Annamalaiyar';
    return 'Mohit JV';
  };

  // Preset Kits & Live Store
  const [activePresetsMap, setActivePresetsMap] = useState(() => getAllActivePresets());
  const [selectedPreset, setSelectedPreset] = useState('');
  const [presetSetCount, setPresetSetCount] = useState(1);
  const [presetKitPrice, setPresetKitPrice] = useState('');
  const [presetGroups, setPresetGroups] = useState({});
  // Nested Sub-Preset (Preset inside a Preset) State
  const [subPresetModalGroup, setSubPresetModalGroup] = useState(null);
  const [nestedSubPresetVal, setNestedSubPresetVal] = useState('');
  const [nestedSubPresetCount, setNestedSubPresetCount] = useState(1);
  // Convert selected standalone items into a PI-only preset
  const [showConvertPresetModal, setShowConvertPresetModal] = useState(false);
  const [convertPresetName, setConvertPresetName] = useState('');
  const [convertPresetPrice, setConvertPresetPrice] = useState('');
  const [convertPresetGst, setConvertPresetGst] = useState('18%');
  const [selectedItemIndexes, setSelectedItemIndexes] = useState([]);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showCreateSetModal, setShowCreateSetModal] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetCount, setNewSetCount] = useState(1);
  const [newSetUnit, setNewSetUnit] = useState('Sets');
  const [newSetPrice, setNewSetPrice] = useState('');
  const [newSetGstRate, setNewSetGstRate] = useState('18%');
  const [showBulkItemModal, setShowBulkItemModal] = useState(false);
  const [bulkItemSearch, setBulkItemSearch] = useState('');
  const [selectedBulkItems, setSelectedBulkItems] = useState({});
  const [bulkCategoryFilter, setBulkCategoryFilter] = useState('All');
  const [piConfirmModal, setPiConfirmModal] = useState(null); // 'cancel' | 'draft' | 'create'
  const [previewDocModal, setPreviewDocModal] = useState(null);
  const [copiedBankField, setCopiedBankField] = useState(null);

  const handleCopyBankDetail = (text, fieldName) => {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopiedBankField(fieldName);
      setTimeout(() => setCopiedBankField(null), 2000);
    } catch (_) {}
  };

  useEffect(() => {
    const handlePresetUpdate = (e) => {
      if (e.detail) setActivePresetsMap(e.detail);
    };
    window.addEventListener('vrm_presets_updated', handlePresetUpdate);
    return () => window.removeEventListener('vrm_presets_updated', handlePresetUpdate);
  }, []);

  // Customer directory lookup with live cloud & Zoho sync for instant auto-complete
  const [customerList, setCustomerList] = useState(() => {
    try {
      const stored = localStorage.getItem('businz_crm_customers') ||
                     localStorage.getItem('controlroom_customer_store') || 
                     localStorage.getItem('controlroom_crm_customers') || 
                     localStorage.getItem('controlroom_customer_list');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  // Sync Customers directly from Zoho Books, CRM Customers & Supabase
  const isSyncingCustRef = useRef(false);
  const searchCustTimerRef = useRef(null);
  useEffect(() => {
    let isMounted = true;

    const syncCustomers = async () => {
      if (isSyncingCustRef.current) return;
      isSyncingCustRef.current = true;
      try {
        const custMap = new Map();
        const register = (c) => {
          if (!c || typeof c !== 'object') return;
          const code = (c.customerCode || c.code || c.id || '').trim();
          const name = (c.companyName || c.name || c.c2 || c.customerName || '').trim();
          const primaryKey = (code || name).toLowerCase();
          if (!primaryKey) return;

          const existing = custMap.get(primaryKey) || (code ? custMap.get(code.toLowerCase()) : null) || {};

          const gstVal = (c.gstNo && c.gstNo !== '—' ? c.gstNo : '') ||
                         (c.gstNumber && c.gstNumber !== '—' ? c.gstNumber : '') ||
                         (c.gst && c.gst !== '—' ? c.gst : '') ||
                         (c.gstin && c.gstin !== '—' ? c.gstin : '') ||
                         existing.gstNo || existing.gstNumber || existing.gst || '';

          const contactVal = (c.contactPerson && c.contactPerson !== '—' ? c.contactPerson : '') ||
                            (c.contact && c.contact !== '—' ? c.contact : '') ||
                            c.primaryContact?.name ||
                            (c.customerName && c.customerName !== name && c.customerName !== '—' ? c.customerName : '') ||
                            existing.contactPerson || existing.contact || existing.primaryContact?.name || '';

          const phoneVal = (c.phone && c.phone !== '—' ? c.phone : '') ||
                          (c.mobile && c.mobile !== '—' ? c.mobile : '') ||
                          c.primaryContact?.phone ||
                          c.primaryContact?.whatsapp ||
                          (c.c4 && c.c4 !== '—' ? c.c4 : '') ||
                          existing.phone || existing.mobile || existing.primaryContact?.phone || '';

          const emailVal = (c.email && c.email !== '—' ? c.email : '') ||
                           c.primaryContact?.email ||
                           (c.c5 && c.c5 !== '—' ? c.c5 : '') ||
                           existing.email || existing.primaryContact?.email || '';

          const streetVal = (c.billingAddress && c.billingAddress !== '—' ? c.billingAddress : '') ||
                            (c.address1 && c.address1 !== '—' ? c.address1 : '') ||
                            (c.address && c.address !== '—' ? c.address : '') ||
                            (c.c6 && c.c6 !== '—' ? c.c6 : '') ||
                            c.billingAddressObj?.address1 ||
                            c.billingAddressObj?.address ||
                            existing.billingAddress || existing.address1 || existing.address || '';

          const cityVal = (c.city && c.city !== '—' ? c.city : '') ||
                          c.billingAddressObj?.city ||
                          existing.city || '';

          const stateVal = (c.state && c.state !== '—' ? c.state : '') ||
                           c.billingAddressObj?.state ||
                           (gstVal && gstVal.length >= 2 ? GST_STATE_MAP[gstVal.substring(0, 2)] : '') ||
                           existing.state || '';

          const pinVal = (c.pincode && c.pincode !== '—' ? c.pincode : '') ||
                         (c.pinCode && c.pinCode !== '—' ? c.pinCode : '') ||
                         (c.zip && c.zip !== '—' ? c.zip : '') ||
                         c.billingAddressObj?.pincode ||
                         existing.pincode || '';

          const dStreetVal = (c.dispatchAddress && c.dispatchAddress !== '—' ? c.dispatchAddress : '') ||
                             (c.dispatchAddress1 && c.dispatchAddress1 !== '—' ? c.dispatchAddress1 : '') ||
                             (c.deliveryAddress && c.deliveryAddress !== '—' ? c.deliveryAddress : '') ||
                             (c.shippingAddress && c.shippingAddress !== '—' ? c.shippingAddress : '') ||
                             (c.c7 && c.c7 !== '—' ? c.c7 : '') ||
                             c.deliveryAddressObj?.address1 ||
                             c.deliveryAddressObj?.address ||
                             existing.dispatchAddress || existing.deliveryAddress || streetVal;

          const dCityVal = (c.dispatchCity && c.dispatchCity !== '—' ? c.dispatchCity : '') ||
                           c.deliveryAddressObj?.city ||
                           existing.dispatchCity || cityVal;

          const dStateVal = (c.dispatchState && c.dispatchState !== '—' ? c.dispatchState : '') ||
                            c.deliveryAddressObj?.state ||
                            existing.dispatchState || stateVal;

          const dPinVal = (c.dispatchPincode && c.dispatchPincode !== '—' ? c.dispatchPincode : '') ||
                          c.deliveryAddressObj?.pincode ||
                          existing.dispatchPincode || pinVal;

          const merged = {
            ...existing,
            ...c,
            companyName: name || existing.companyName || '',
            name: name || existing.name || '',
            customerCode: code || existing.customerCode || '',
            gstNo: gstVal,
            gstNumber: gstVal,
            gst: gstVal,
            contactPerson: contactVal,
            contact: contactVal,
            phone: phoneVal,
            mobile: phoneVal,
            email: emailVal,
            paymentTerms: c.paymentTerms || existing.paymentTerms || '100% Paid',
            billingAddress: streetVal,
            address1: streetVal,
            address: streetVal,
            city: cityVal,
            state: stateVal,
            pincode: pinVal,
            dispatchAddress: dStreetVal,
            deliveryAddress: dStreetVal,
            dispatchCity: dCityVal,
            dispatchState: dStateVal,
            dispatchPincode: dPinVal
          };

          custMap.set(primaryKey, merged);
          if (code) custMap.set(code.toLowerCase(), merged);
        };

        // 1. Instant check from local storage
        try {
          const raw = localStorage.getItem('controlroom_customer_store') ||
                      localStorage.getItem('businz_crm_customers') ||
                      localStorage.getItem('controlroom_crm_customers');
          if (raw) {
            const p = JSON.parse(raw);
            if (Array.isArray(p)) p.forEach(register);
          }
        } catch (_) {}

        // 2. Fetch initial top-60 customers from backend with deduplication & caching (Phase B4)
        try {
          const list = await searchCustomers({ limit: 60 });
          if (Array.isArray(list) && list.length > 0) {
            list.forEach(register);
          }
        } catch (_) {}

        const unified = Array.from(new Set(custMap.values()));
        if (isMounted && unified.length > 0) {
          setCustomerList(unified);
          try {
            const lightweight = unified.map(c => {
              const pContact = c.primaryContact || {};
              const cPerson = (c.contactPerson && c.contactPerson !== '—' ? c.contactPerson : '') ||
                              (c.contact && c.contact !== '—' ? c.contact : '') ||
                              pContact.name ||
                              (c.customerName && c.customerName !== c.companyName ? c.customerName : '') ||
                              '';
              const rawPh = (c.phone && c.phone !== '—' ? c.phone : '') ||
                            (c.mobile && c.mobile !== '—' ? c.mobile : '') ||
                            pContact.phone || pContact.altPhone || pContact.whatsapp || '';
              const cleanPh = String(rawPh || '').replace(/^'/, '').trim();
              const em = (c.email && c.email !== '—' ? c.email : '') || pContact.email || '';
              const gst = (c.gstNo && c.gstNo !== '—' ? c.gstNo : '') ||
                          (c.gstNumber && c.gstNumber !== '—' ? c.gstNumber : '') ||
                          (c.gst && c.gst !== '—' ? c.gst : '') || '';
              const bAddr = c.billingAddress || c.address1 || c.address || c.street || c.billingAddressObj?.address1 || c.billingAddressObj?.address || '';
              const dAddr = c.dispatchAddress || c.deliveryAddress || c.dispatchAddress1 || c.deliveryAddressObj?.address1 || c.deliveryAddressObj?.address || bAddr;

              return {
                id: c.id || c.customerCode || '',
                customerCode: c.customerCode || c.code || '',
                companyName: c.companyName || c.name || c.c2 || '',
                name: c.companyName || c.name || '',
                customerName: c.customerName || cPerson || c.companyName || '',
                contactPerson: cPerson,
                contact: cPerson,
                phone: cleanPh,
                mobile: cleanPh,
                email: em,
                gstNo: gst,
                gst: gst,
                gstNumber: gst,
                primaryContact: {
                  name: cPerson || c.companyName || '',
                  phone: cleanPh,
                  whatsapp: cleanPh,
                  email: em
                },
                billingAddress: bAddr,
                address1: bAddr,
                address: bAddr,
                city: c.city || c.billingAddressObj?.city || '',
                state: c.state || c.billingAddressObj?.state || '',
                pincode: c.pincode || c.pinCode || c.zip || c.billingAddressObj?.pincode || '',
                billingAddressObj: c.billingAddressObj || {
                  address: bAddr,
                  city: c.city || '',
                  state: c.state || '',
                  pincode: c.pincode || ''
                },
                dispatchAddress: dAddr,
                deliveryAddress: dAddr,
                dispatchCity: c.dispatchCity || c.deliveryAddressObj?.city || c.city || '',
                dispatchState: c.dispatchState || c.deliveryAddressObj?.state || c.state || '',
                dispatchPincode: c.dispatchPincode || c.deliveryAddressObj?.pincode || c.pincode || '',
                deliveryAddressObj: c.delivery_address_obj || c.deliveryAddressObj || {
                  address: dAddr,
                  city: c.dispatchCity || c.city || '',
                  state: c.dispatchState || c.state || '',
                  pincode: c.dispatchPincode || c.pincode || ''
                },
                sameAsBilling: c.sameAsBilling !== false,
                paymentTerms: c.paymentTerms || ''
              };
            });
            localStorage.setItem('controlroom_customer_store', JSON.stringify(lightweight));
            localStorage.setItem('businz_crm_customers', JSON.stringify(lightweight));
          } catch (_) {}
        }
      } catch (err) {
        console.warn('[PI] Customer sync notice:', err);
      } finally {
        isSyncingCustRef.current = false;
      }
    };

    syncCustomers();

    // Subscribe to realtime cloud customer updates (delta row patching)
    const realtimeCustSub = subscribeToCloudStore('customer_store', (updatedCusts) => {
      if (!isMounted || !updatedCusts) return;
      setCustomerList(prev => {
        const custMap = new Map();
        (prev || []).forEach(p => {
          const k = (p.customerCode || p.code || p.companyName || p.name || p.c2 || '').toLowerCase().trim();
          if (k) custMap.set(k, p);
        });
        const incoming = Array.isArray(updatedCusts) ? updatedCusts : [updatedCusts];
        incoming.forEach(c => {
          const k = (c.customerCode || c.code || c.companyName || c.name || c.c2 || '').toLowerCase().trim();
          if (k) {
            if (c._deleted) {
              custMap.delete(k);
            } else {
              custMap.set(k, { ...(custMap.get(k) || {}), ...c });
            }
          }
        });
        return Array.from(custMap.values());
      });
    });

    const handleLocalCustUpdate = (e) => {
      if (e?.detail) {
        const incoming = Array.isArray(e.detail) ? e.detail : [e.detail];
        setCustomerList(prev => {
          const custMap = new Map();
          (prev || []).forEach(p => {
            const k = (p.customerCode || p.code || p.companyName || p.name || p.c2 || '').toLowerCase().trim();
            if (k) custMap.set(k, p);
          });
          incoming.forEach(c => {
            const k = (c.customerCode || c.code || c.companyName || c.name || c.c2 || '').toLowerCase().trim();
            if (k) custMap.set(k, { ...(custMap.get(k) || {}), ...c });
          });
          return Array.from(custMap.values());
        });
      }
    };

    window.addEventListener('controlroom_customer_store_updated', handleLocalCustUpdate);
    window.addEventListener('controlroom_customer_update', handleLocalCustUpdate);

    return () => {
      isMounted = false;
      if (realtimeCustSub && typeof realtimeCustSub === 'function') realtimeCustSub();
      window.removeEventListener('controlroom_customer_store_updated', handleLocalCustUpdate);
      window.removeEventListener('controlroom_customer_update', handleLocalCustUpdate);
    };
  }, []);


  // Full 285+ Standardized Products Catalog with Live Central Inventory Stock
  const [itemsList, setItemsList] = useState(() => getFullProductsCatalogWithStock());

  useEffect(() => {
    let timer = null;
    const refreshCatalog = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setItemsList(getFullProductsCatalogWithStock());
      }, 300);
    };

    // Ensure all 312 products from server master are loaded immediately
    fetch('/api/raw-materials')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          try {
            localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(data));
          } catch (_) {}
          refreshCatalog();
        }
      })
      .catch(() => {});

    window.addEventListener('central_inventory_updated', refreshCatalog);
    window.addEventListener('controlroom_raw_materials_update', refreshCatalog);
    window.addEventListener('controlroom_items_update', refreshCatalog);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('central_inventory_updated', refreshCatalog);
      window.removeEventListener('controlroom_raw_materials_update', refreshCatalog);
      window.removeEventListener('controlroom_items_update', refreshCatalog);
    };
  }, []);

  const stockLookupMap = useMemo(() => {
    const map = new Map();
    (itemsList || []).forEach(p => {
      const st = Number(p.availableStock !== undefined ? p.availableStock : (p.stock !== undefined ? p.stock : 0));
      const code = String(p.code || '').toLowerCase().trim();
      const name = String(p.name || '').replace(/[\u2013\u2014]/g, '-').toLowerCase().trim();
      const norm = normalizeProductName(p.name);
      if (code && !map.has(code)) map.set(code, st);
      if (name && !map.has(name)) map.set(name, st);
      if (norm && !map.has(norm)) map.set(norm, st);
      const resCode = resolveProductCode(p).toLowerCase().trim();
      if (resCode && !map.has(resCode)) map.set(resCode, st);
    });
    return map;
  }, [itemsList]);

  const getItemStock = (itemName, itemCode) => {
    if (!itemName && !itemCode) return null;
    const cleanCode = (itemCode || '').toLowerCase().trim();
    if (cleanCode && stockLookupMap.has(cleanCode)) return stockLookupMap.get(cleanCode);
    const cleanName = (itemName || '').replace(/[\u2013\u2014]/g, '-').toLowerCase().trim();
    if (cleanName && stockLookupMap.has(cleanName)) return stockLookupMap.get(cleanName);
    const normName = normalizeProductName(cleanName);
    if (normName && stockLookupMap.has(normName)) return stockLookupMap.get(normName);
    const resolvedCode = resolveProductCode({ name: itemName, code: itemCode }).toLowerCase().trim();
    if (resolvedCode && stockLookupMap.has(resolvedCode)) return stockLookupMap.get(resolvedCode);
    return 0;
  };

  // Normalized bulk item catalog powered from already-loaded itemsList (zero extra API calls)
  const availablePiBulkCatalog = useMemo(() => {
    const seen = new Set();
    return (itemsList || []).reduce((acc, it, idx) => {
      if (!it || !it.name || !String(it.name).trim()) return acc;
      const cleanName = String(it.name).trim();
      const rawUom = it.uom || it.unit || 'NOS';
      const u = String(rawUom).trim().toUpperCase();
      let resolvedUom = 'NOS';
      if (['METER', 'METERS', 'MTR', 'MTRS', 'M'].includes(u)) resolvedUom = 'MTR';
      else if (['PIECES', 'PIECE', 'PCS', 'PC'].includes(u)) resolvedUom = 'PCS';
      else if (['SET', 'SETS'].includes(u)) resolvedUom = 'SET';
      else if (['KILOGRAM', 'KILOGRAMS', 'KG', 'KGS'].includes(u)) resolvedUom = 'KG';
      else if (['BOX', 'BOXES'].includes(u)) resolvedUom = 'BOX';
      else if (['PACKET', 'PACKETS', 'PKT', 'PKTS'].includes(u)) resolvedUom = 'PKT';
      else if (['PAIR', 'PAIRS'].includes(u)) resolvedUom = 'PAIR';
      else if (['LOT', 'LOTS'].includes(u)) resolvedUom = 'LOT';
      else if (['TON', 'TONS'].includes(u)) resolvedUom = 'TON';
      else if (['KW', 'KWH'].includes(u)) resolvedUom = 'KW';
      else if (u) resolvedUom = u;

      const resolvedCode = String(it.code || it.sku || resolveProductCode(it) || '').trim();
      const itemKey = String(it.code || it.sku || it.id || cleanName || idx).trim().toLowerCase();
      if (seen.has(itemKey)) return acc;
      seen.add(itemKey);

      const pCat = it.category || it.description || 'General';
      const pHsn = it.hsn || it.hsn_or_sac || getHsnCode({ name: cleanName, category: pCat }) || '73089090';
      const isSolar5 = is5PctSolarProduct(cleanName, pCat, pHsn);
      const stockRaw = it.availableStock !== undefined ? it.availableStock : (it.stock !== undefined ? it.stock : null);

      acc.push({
        itemKey,
        code: resolvedCode,
        name: cleanName,
        category: pCat,
        uom: resolvedUom,
        rate: parseFloat(it.price ?? it.rate ?? 0) || 0,
        gstRate: isSolar5 ? '5%' : (it.gstRate || '18%'),
        hsn: pHsn,
        stock: stockRaw !== null && stockRaw !== undefined ? Number(stockRaw) : null
      });
      return acc;
    }, []);
  }, [itemsList]);

  const piBulkCategories = useMemo(() => {
    const cats = Array.from(new Set(availablePiBulkCatalog.map(i => i.category).filter(Boolean))).slice(0, 6);
    return ['All', ...cats];
  }, [availablePiBulkCatalog]);

  const filteredPiBulkCatalog = useMemo(() => {
    const q = (bulkItemSearch || '').trim().toLowerCase();
    return availablePiBulkCatalog.filter(it => {
      if (bulkCategoryFilter !== 'All' && it.category !== bulkCategoryFilter) return false;
      if (!q) return true;
      return (
        it.name.toLowerCase().includes(q) ||
        it.code.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        it.hsn.toLowerCase().includes(q)
      );
    });
  }, [availablePiBulkCatalog, bulkCategoryFilter, bulkItemSearch]);

  // Form Fields State
  const [pdfFile, setPdfFile] = useState(null);
  const [signedPiDoc, setSignedPiDoc] = useState(null);
  const [piNumber, setPiNumber] = useState('');
  const [isSubmittingPI, setIsSubmittingPI] = useState(false);
  const [piDate, setPiDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntilDate, setValidUntilDate] = useState('');
  const [salesPerson, setSalesPerson] = useState(getActiveUserName());
  const [vendorName, setVendorName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstNo, setGstNo] = useState('');

  // Addresses State (Dual Addresses - no delivery proof required for PI)
  const [billingStreet, setBillingStreet] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingPincode, setBillingPincode] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [deliveryStreet, setDeliveryStreet] = useState('');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [deliveryPincode, setDeliveryPincode] = useState('');

  // Structured Line Items State (Fresh empty default)
  const [piItems, setPiItems] = useState([]);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState(null);

  // Transport & Logistics
  const [transportMode, setTransportMode] = useState('Transport');
  const [transporterName, setTransporterName] = useState('');
  const [destination, setDestination] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [transportScope, setTransportScope] = useState('VRM Structures');

  const [paymentTerms, setPaymentTerms] = useState('100% Paid');
  const [creditDays, setCreditDays] = useState('');
  const [remarks, setRemarks] = useState('');

  // Customer dropdown toggle & click-outside ref
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Deduplicated list of all registered customers for the dropdown (O(N) Map lookup with field enrichment)
  const uniqueCustomerList = useMemo(() => {
    const map = new Map();
    (customerList || []).forEach(c => {
      if (!c) return;
      const codeKey = (c.customerCode || c.code || c.id || '').trim().toLowerCase();
      const nameKey = (c.companyName || c.name || c.c2 || c.customerName || '').trim().toLowerCase();
      const primaryKey = codeKey || nameKey;
      if (!primaryKey) return;
      const existing = map.get(primaryKey);
      if (!existing) {
        map.set(primaryKey, c);
      } else {
        map.set(primaryKey, {
          ...existing,
          ...c,
          gst: c.gst || c.gstNumber || c.gstNo || existing.gst || existing.gstNumber || existing.gstNo || '',
          gstNo: c.gstNo || c.gstNumber || c.gst || existing.gstNo || existing.gstNumber || '',
          gstNumber: c.gstNumber || c.gstNo || c.gst || existing.gstNumber || '',
          contact: c.contact || c.contactPerson || c.primaryContact?.name || existing.contact || existing.contactPerson || '',
          contactPerson: c.contactPerson || c.contact || c.primaryContact?.name || existing.contactPerson || existing.contact || '',
          phone: c.phone || c.mobile || c.primaryContact?.phone || existing.phone || existing.mobile || '',
          email: c.email || c.primaryContact?.email || existing.email || '',
          billingAddress: c.billingAddress || c.address1 || c.address || c.c6 || existing.billingAddress || existing.address1 || existing.address || '',
          address1: c.address1 || c.billingAddress || c.address || existing.address1 || existing.billingAddress || '',
          address: c.address || c.billingAddress || c.address1 || existing.address || '',
          city: c.city || existing.city || '',
          state: c.state || existing.state || '',
          pincode: c.pincode || c.pinCode || c.zip || existing.pincode || '',
          dispatchAddress: c.dispatchAddress || c.deliveryAddress || existing.dispatchAddress || existing.deliveryAddress || '',
          deliveryAddress: c.deliveryAddress || c.dispatchAddress || existing.deliveryAddress || existing.dispatchAddress || '',
          dispatchCity: c.dispatchCity || existing.dispatchCity || '',
          dispatchState: c.dispatchState || existing.dispatchState || '',
          dispatchPincode: c.dispatchPincode || existing.dispatchPincode || '',
          paymentTerms: c.paymentTerms || existing.paymentTerms || '',
          primaryContact: c.primaryContact || existing.primaryContact || {},
          billingAddressObj: c.billingAddressObj || existing.billingAddressObj || {},
          deliveryAddressObj: c.deliveryAddressObj || existing.deliveryAddressObj || {}
        });
      }
    });
    return Array.from(map.values());
  }, [customerList]);

  // Filtered customer suggestions based on user typing (capped at top 50 to prevent DOM freeze)
  const filteredCustomerSuggestions = useMemo(() => {
    const q = (vendorName || '').toLowerCase().trim();
    if (!q) return uniqueCustomerList.slice(0, 50);
    const matches = [];
    for (let i = 0; i < uniqueCustomerList.length; i++) {
      const c = uniqueCustomerList[i];
      const name = (c.companyName || c.name || c.c2 || c.code || '').toLowerCase();
      const code = (c.customerCode || c.code || c.id || '').toLowerCase();
      const gst = (c.gst || c.gstNumber || c.gstNo || c.gstin || '').toLowerCase();
      const city = (c.city || '').toLowerCase();
      const contact = (c.contact || c.contactPerson || c.primaryContact?.name || '').toLowerCase();
      const phone = (c.phone || c.mobile || c.primaryContact?.phone || '').toLowerCase();
      if (name.includes(q) || code.includes(q) || gst.includes(q) || city.includes(q) || contact.includes(q) || phone.includes(q)) {
        matches.push(c);
        if (matches.length >= 50) break;
      }
    }
    return matches;
  }, [uniqueCustomerList, vendorName]);

  // Customer auto-suggest handler with full field population
  const handleSelectCustomer = (customerOrName) => {
    let found = null;
    let nameToSet = '';

    if (customerOrName && typeof customerOrName === 'object') {
      found = customerOrName;
      nameToSet = (found.companyName || found.name || found.c2 || found.customerName || found.code || '').trim();
    } else {
      nameToSet = String(customerOrName || '').trim();
      const cleanSearch = nameToSet.toLowerCase();
      if (!cleanSearch) {
        setVendorName('');
        return;
      }
      // Exact match first
      found = (customerList || []).find(c => {
        const cComp = (c.companyName || c.name || c.c2 || c.code || c.customerCode || '').toLowerCase().trim();
        return cComp === cleanSearch;
      }) || (customerList || []).find(c => {
        const cComp = (c.companyName || c.name || c.c2 || c.customerName || '').toLowerCase().trim();
        return cComp.length > 2 && (cComp.startsWith(cleanSearch) || cleanSearch.startsWith(cComp) || cComp.includes(cleanSearch));
      });
    }

    if (nameToSet) {
      setVendorName(nameToSet);
    }

    if (found) {
      const pContact = found.primaryContact || {};
      const gstVal = (found.gst && found.gst !== '—' ? found.gst : '') ||
                     (found.gstNumber && found.gstNumber !== '—' ? found.gstNumber : '') ||
                     (found.gstNo && found.gstNo !== '—' ? found.gstNo : '') ||
                     (found.gstin && found.gstin !== '—' ? found.gstin : '') || '';
      setGstNo(gstVal);

      const contactVal = (found.contactPerson && found.contactPerson !== '—' ? found.contactPerson : '') ||
                         (found.contact && found.contact !== '—' ? found.contact : '') ||
                         (pContact.name && pContact.name !== '—' ? pContact.name : '') ||
                         (found.customerName && found.customerName !== nameToSet && found.customerName !== '—' ? found.customerName : '') ||
                         found.customerName || '';
      setContactPerson(contactVal);

      const phoneRaw = (found.phone && found.phone !== '—' ? found.phone : '') ||
                       (found.mobile && found.mobile !== '—' ? found.mobile : '') ||
                       (pContact.phone && pContact.phone !== '—' ? pContact.phone : '') ||
                       (pContact.altPhone && pContact.altPhone !== '—' ? pContact.altPhone : '') ||
                       (pContact.whatsapp && pContact.whatsapp !== '—' ? pContact.whatsapp : '') ||
                       (found.altPhone && found.altPhone !== '—' ? found.altPhone : '') ||
                       (found.c4 && found.c4 !== '—' ? found.c4 : '') || '';
      const phoneVal = String(phoneRaw || '').replace(/^'/, '').trim();
      setPhone(phoneVal);

      const emailVal = (found.email && found.email !== '—' ? found.email : '') ||
                       (pContact.email && pContact.email !== '—' ? pContact.email : '') ||
                       (found.c5 && found.c5 !== '—' ? found.c5 : '') || '';
      setEmail(emailVal);

      const termsVal = found.paymentTerms || found.terms || '';
      if (termsVal) setPaymentTerms(termsVal);

      const bAddrObj = found.billingAddressObj || {};
      const street = (found.billingAddress && found.billingAddress !== '—' ? found.billingAddress : '') ||
                     (found.billingAddress1 && found.billingAddress1 !== '—' ? found.billingAddress1 : '') ||
                     (found.address1 && found.address1 !== '—' ? found.address1 : '') ||
                     (found.address && found.address !== '—' ? found.address : '') ||
                     (found.street && found.street !== '—' ? found.street : '') ||
                     (found.c6 && found.c6 !== '—' ? found.c6 : '') ||
                     bAddrObj.address1 ||
                     bAddrObj.address ||
                     '';
      const city = (found.city && found.city !== '—' ? found.city : '') || bAddrObj.city || '';
      const state = (found.state && found.state !== '—' ? found.state : '') ||
                    bAddrObj.state ||
                    (gstVal && gstVal.length >= 2 ? GST_STATE_MAP[gstVal.substring(0, 2)] : '') ||
                    '';
      const pincode = (found.pincode && found.pincode !== '—' ? found.pincode : '') ||
                      (found.pinCode && found.pinCode !== '—' ? found.pinCode : '') ||
                      (found.zip && found.zip !== '—' ? found.zip : '') ||
                      bAddrObj.pincode ||
                      '';

      setBillingStreet(street);
      setBillingCity(city);
      setBillingState(state);
      setBillingPincode(pincode);

      const dAddrObj = found.deliveryAddressObj || {};
      const dStreet = (found.dispatchAddress && found.dispatchAddress !== '—' ? found.dispatchAddress : '') ||
                      (found.dispatchAddress1 && found.dispatchAddress1 !== '—' ? found.dispatchAddress1 : '') ||
                      (found.deliveryAddress && found.deliveryAddress !== '—' ? found.deliveryAddress : '') ||
                      (found.shippingAddress && found.shippingAddress !== '—' ? found.shippingAddress : '') ||
                      (found.c7 && found.c7 !== '—' ? found.c7 : '') ||
                      dAddrObj.address1 ||
                      dAddrObj.address ||
                      street;
      const dCity = (found.dispatchCity && found.dispatchCity !== '—' ? found.dispatchCity : '') || dAddrObj.city || city;
      const dState = (found.dispatchState && found.dispatchState !== '—' ? found.dispatchState : '') || dAddrObj.state || state;
      const dPincode = (found.dispatchPincode && found.dispatchPincode !== '—' ? found.dispatchPincode : '') || dAddrObj.pincode || pincode;

      const isSame = (found.sameAsBilling !== false && (!dStreet || dStreet === street));
      setSameAsBilling(isSame);
      setDeliveryStreet(isSame ? street : (dStreet || street));
      setDeliveryCity(isSame ? city : (dCity || city));
      setDeliveryState(isSame ? state : (dState || state));
      setDeliveryPincode(isSame ? pincode : (dPincode || pincode));
    }
  };

  // Upload progress states
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const uploadTimerRef = useRef(null);

  // Signed PI / Payment Advice upload handler using compressAndSaveFile
  const handleSignedDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const compressed = await compressAndSaveFile(file);
      setSignedPiDoc({
        name: compressed.name || file.name,
        size: compressed.size || file.size,
        type: compressed.type || file.type,
        dataUrl: compressed.dataUrl,
        uploadedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      });
      setPdfFile({ name: file.name, size: file.size });
      setUploadProgress(100);
    } catch (err) {
      console.warn('Doc compression failed, falling back:', err);
      setSignedPiDoc({
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      });
      setPdfFile({ name: file.name, size: file.size });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    if (uploadTimerRef.current) clearInterval(uploadTimerRef.current);
    setPdfFile(null);
    setSignedPiDoc(null);
    setUploadProgress(0);
    setIsUploading(false);
  };


  const selectedStandaloneIndexes = (selectedItemIndexes || []).filter(i => piItems[i] && !piItems[i].isPresetItem);

  // Close dropdown menu when clicking anywhere else
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdownIdx(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      if (uploadTimerRef.current) clearInterval(uploadTimerRef.current);
    };
  }, []);

  const renderStatusBadge = (type, label) => {
    return <StatusBadge type={type} label={label} size="sm" />;
  };

  const renderPdfIcon = () => {
    return (
      <div
        style={{
          width: '34px',
          height: '42px',
          borderRadius: '6px',
          backgroundColor: '#e2e8f0',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexShrink: 0
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '10px',
            height: '10px',
            backgroundColor: '#cbd5e1',
            borderBottomLeftRadius: '4px',
            borderTopRightRadius: '6px'
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '6px',
            left: '-6px',
            backgroundColor: '#ea580c',
            color: 'white',
            fontSize: '8px',
            fontWeight: 'bold',
            padding: '1px 4px',
            borderRadius: '3px',
            letterSpacing: '0.05em'
          }}
        >
          PDF
        </div>
      </div>
    );
  };

  // Helper to render the numbered label block
  const renderNumberedLabel = (number, text) => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            backgroundColor: '#2563eb',
            color: 'white',
            fontSize: '10px',
            fontWeight: 'bold'
          }}
        >
          {number}
        </span>
        <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b' }}>
          {text} <span style={{ color: '#ef4444' }}>*</span>
        </span>
      </div>
    );
  };

  const piCtx = {};
  Object.assign(piCtx, {
    onConvertToBom,
    userRole,
    onNavigateTab,
    targetPiNo,
    clearTargetPi,
    defaultSalesPIs,
    defaultProcurementPIs,
    normalizePiRecord,
    GST_STATE_MAP,
    canonicalizeSalespersonCode,
    CODE_TO_SALES_NAME,
    resolvePiSalesPersonName,
    selectedStandaloneIndexes,
    renderStatusBadge,
    renderPdfIcon,
    renderNumberedLabel,
    isCeo,
    isSalesRole,
    storageKey,
    viewMode,
    setViewMode,
    tableLoading,
    setTableLoading,
    isConvertingToBom,
    setIsConvertingToBom,
    convertingPiTarget,
    setConvertingPiTarget,
    syncingPiNo,
    setSyncingPiNo,
    selectedPi,
    setSelectedPi,
    printModalPi,
    setPrintModalPi,
    showFloatingMenu,
    setShowFloatingMenu,
    validationAlert,
    setValidationAlert,
    piFormErrors,
    setPiFormErrors,
    topToast,
    setTopToast,
    toastTimeoutRef,
    filterSalesPerson,
    setFilterSalesPerson,
    kpiFilterMeta,
    setKpiFilterMeta,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    isMobile,
    setIsMobile,
    showTopToast,
    bomList,
    setBomList,
    piList,
    setPiList,
    getConvertedBomsForPi,
    handleRevertPiToIssued,
    cancellingPiNo,
    setCancellingPiNo,
    handleCancelPi,
    currentEmpId,
    currentEmpName,
    currentLoggedEmail,
    isRestrictedSalesUser,
    isTechSupport,
    isTechSupportLogin,
    isStrictTechSupport,
    isSalesHead,
    canAssignPi,
    showAssignPiModal,
    setShowAssignPiModal,
    assignPiTarget,
    setAssignPiTarget,
    salespersonsList,
    setSalespersonsList,
    selectedSalespersonCode,
    setSelectedSalespersonCode,
    assignReason,
    setAssignReason,
    isAssigningPi,
    setIsAssigningPi,
    handleOpenAssignModal,
    handleConfirmAssignPi,
    getEffectiveSalesPerson,
    formatPiDateDot,
    visiblePIList,
    piMetrics,
    handlePrintTemplatePiUpdate,
    updatePiList,
    syncPiToZoho,
    handleReleaseDraftPi,
    handleConvertToBom,
    deleteIdx,
    setDeleteIdx,
    showSaveConfirm,
    setShowSaveConfirm,
    showCancelConfirm,
    setShowCancelConfirm,
    editIdx,
    setEditIdx,
    activeDropdownIdx,
    setActiveDropdownIdx,
    selectedPIs,
    setSelectedPIs,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    piTab,
    setPiTab,
    rowsPerPage,
    setRowsPerPage,
    currentPage,
    setCurrentPage,
    handleSelectAll,
    handleSelectRow,
    clearFilters,
    getActiveUserName,
    activePresetsMap,
    setActivePresetsMap,
    selectedPreset,
    setSelectedPreset,
    presetSetCount,
    setPresetSetCount,
    presetKitPrice,
    setPresetKitPrice,
    presetGroups,
    setPresetGroups,
    subPresetModalGroup,
    setSubPresetModalGroup,
    nestedSubPresetVal,
    setNestedSubPresetVal,
    nestedSubPresetCount,
    setNestedSubPresetCount,
    showConvertPresetModal,
    setShowConvertPresetModal,
    convertPresetName,
    setConvertPresetName,
    convertPresetPrice,
    setConvertPresetPrice,
    convertPresetGst,
    setConvertPresetGst,
    selectedItemIndexes,
    setSelectedItemIndexes,
    showClearConfirmModal,
    setShowClearConfirmModal,
    showCreateSetModal,
    setShowCreateSetModal,
    newSetName,
    setNewSetName,
    newSetCount,
    setNewSetCount,
    newSetUnit,
    setNewSetUnit,
    newSetPrice,
    setNewSetPrice,
    newSetGstRate,
    setNewSetGstRate,
    showBulkItemModal,
    setShowBulkItemModal,
    bulkItemSearch,
    setBulkItemSearch,
    selectedBulkItems,
    setSelectedBulkItems,
    bulkCategoryFilter,
    setBulkCategoryFilter,
    piConfirmModal,
    setPiConfirmModal,
    previewDocModal,
    setPreviewDocModal,
    copiedBankField,
    setCopiedBankField,
    handleCopyBankDetail,
    customerList,
    setCustomerList,
    isSyncingCustRef,
    searchCustTimerRef,
    itemsList,
    setItemsList,
    stockLookupMap,
    getItemStock,
    availablePiBulkCatalog,
    piBulkCategories,
    filteredPiBulkCatalog,
    pdfFile,
    setPdfFile,
    signedPiDoc,
    setSignedPiDoc,
    piNumber,
    setPiNumber,
    isSubmittingPI,
    setIsSubmittingPI,
    piDate,
    setPiDate,
    validUntilDate,
    setValidUntilDate,
    salesPerson,
    setSalesPerson,
    vendorName,
    setVendorName,
    contactPerson,
    setContactPerson,
    phone,
    setPhone,
    email,
    setEmail,
    gstNo,
    setGstNo,
    billingStreet,
    setBillingStreet,
    billingCity,
    setBillingCity,
    billingState,
    setBillingState,
    billingPincode,
    setBillingPincode,
    sameAsBilling,
    setSameAsBilling,
    deliveryStreet,
    setDeliveryStreet,
    deliveryCity,
    setDeliveryCity,
    deliveryState,
    setDeliveryState,
    deliveryPincode,
    setDeliveryPincode,
    piItems,
    setPiItems,
    draggedItemIndex,
    setDraggedItemIndex,
    dragOverItemIndex,
    setDragOverItemIndex,
    transportMode,
    setTransportMode,
    transporterName,
    setTransporterName,
    destination,
    setDestination,
    vehicleNo,
    setVehicleNo,
    transportScope,
    setTransportScope,
    paymentTerms,
    setPaymentTerms,
    creditDays,
    setCreditDays,
    remarks,
    setRemarks,
    isCustomerDropdownOpen,
    setIsCustomerDropdownOpen,
    customerDropdownRef,
    uniqueCustomerList,
    filteredCustomerSuggestions,
    handleSelectCustomer,
    uploadProgress,
    setUploadProgress,
    isUploading,
    setIsUploading,
    uploadTimerRef,
    handleSignedDocUpload,
    handleRemoveFile
  });
  const piActions = createPiActionHandlers(piCtx);
  Object.assign(piCtx, piActions);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-24)', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>

      {/* ==================== CONVERTING PI TO BOM ANIMATED MODAL ==================== */}
      {isConvertingToBom && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '32px',
            width: '90%',
            maxWidth: '450px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            border: '1px solid #E2E8F0'
          }}>
            {/* Smallcase-Inspired 3D Isometric Progress Indicator */}
            <div style={{
              perspective: '750px',
              perspectiveOrigin: '50% 35%',
              width: '150px',
              height: '125px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              {/* Ground Shadow */}
              <div style={{
                position: 'absolute',
                bottom: '10px',
                width: '100px',
                height: '48px',
                borderRadius: '50%',
                background: 'radial-gradient(ellipse at center, rgba(14, 116, 144, 0.35) 0%, rgba(6, 182, 212, 0.08) 55%, transparent 75%)',
                filter: 'blur(7px)',
                transform: 'rotateX(58deg)',
                animation: 'pulseGlow 2.5s ease-in-out infinite'
              }} />

              {/* 3D Isometric Stack Container */}
              <div style={{
                position: 'relative',
                width: '84px',
                height: '84px',
                transformStyle: 'preserve-3d',
                transform: 'rotateX(58deg) rotateZ(-38deg)'
              }}>
                {/* Base Layer Plate */}
                <div style={{
                  position: 'absolute',
                  width: '84px',
                  height: '84px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.25) 0%, rgba(6, 182, 212, 0.1) 100%)',
                  border: '1.5px solid rgba(14, 116, 144, 0.45)',
                  boxShadow: '0 8px 24px rgba(14, 116, 144, 0.25), inset 0 0 14px rgba(6, 182, 212, 0.15)',
                  backdropFilter: 'blur(4px)',
                  transformStyle: 'preserve-3d',
                  animation: 'isoFloatBottom 3s ease-in-out infinite'
                }}>
                  <div style={{
                    position: 'absolute',
                    inset: '6px',
                    borderRadius: '10px',
                    border: '1px dashed rgba(14, 116, 144, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: '1.5px solid rgba(6, 182, 212, 0.6)',
                      animation: 'isoPulseRing 2s ease-out infinite'
                    }} />
                  </div>
                </div>

                {/* Middle Floating Plate */}
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  width: '68px',
                  height: '68px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.38) 0%, rgba(59, 130, 246, 0.18) 100%)',
                  border: '1.5px solid rgba(6, 182, 212, 0.65)',
                  boxShadow: '0 10px 24px rgba(6, 182, 212, 0.28), inset 0 0 12px rgba(255, 255, 255, 0.25)',
                  transformStyle: 'preserve-3d',
                  animation: 'isoFloatMiddle 3s ease-in-out infinite',
                  animationDelay: '0.2s',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent)',
                    animation: 'isoScanBeam 2.4s ease-in-out infinite'
                  }} />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      border: '1.5px solid rgba(255,255,255,0.65)',
                      transform: 'rotate(45deg)'
                    }} />
                  </div>
                </div>

                {/* Top Apex Plate with Glowing Symbol */}
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0E7490 0%, #06B6D4 100%)',
                  border: '2px solid #FFFFFF',
                  boxShadow: '0 14px 30px rgba(14, 116, 144, 0.45), 0 0 18px rgba(6, 182, 212, 0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  transformStyle: 'preserve-3d',
                  animation: 'isoFloatTop 3s ease-in-out infinite',
                  animationDelay: '0.4s'
                }}>
                  <Layers size={22} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }} />
                </div>
              </div>
            </div>

            <div>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                color: '#0E7490',
                backgroundColor: '#ECFEFF',
                padding: '3px 10px',
                borderRadius: '12px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase'
              }}>
                Workflow Automation
              </span>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '8px 0 4px 0' }}>
                Converting Proforma Invoice to BOM...
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                Transferring line items, presets & customer data for <strong>{convertingPiTarget?.piNo || 'Quote'}</strong>
              </p>
            </div>

            {/* Visual Workflow Graphic */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '12px 16px',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} style={{ color: '#0E7490' }} />
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>PI: {convertingPiTarget?.piNo || 'Quote'}</span>
              </div>
              <ArrowRight size={14} style={{ color: '#94A3B8' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Boxes size={16} style={{ color: '#059669' }} />
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669' }}>Bill of Materials</span>
              </div>
            </div>

            {/* Reassuring Animated Progress Bar */}
            <div style={{ width: '100%', backgroundColor: '#E2E8F0', borderRadius: '10px', height: '6px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                backgroundColor: '#0E7490',
                borderRadius: '10px',
                animation: 'businzProgressFill 0.65s ease-in-out forwards'
              }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#059669', fontWeight: '700' }}>
              <span className="businz-pulse-dot" /> Preparing BOM workspace & calculating stock...
            </div>
          </div>
        </div>
      )}

      <PiListDashboardSection ctx={piCtx} />
      <PiCreatorEditorSection ctx={piCtx} />
      <PiDetailsAndConfirmModals ctx={piCtx} />
      <PiPackAndBulkModals ctx={piCtx} />

    </div>
  );
}
