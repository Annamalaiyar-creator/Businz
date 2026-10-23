import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Check, Hourglass, Edit3, Trash2, Eye, FileText, X, UploadCloud, CheckCircle, Search, AlertTriangle, ArrowLeft, ArrowRight, MoreVertical, Edit, Info, Calendar, Filter, ChevronLeft, ChevronRight, RotateCcw, Layers, Tag, MoreHorizontal, Download, Building2, Truck, Boxes, User, Landmark, ShieldCheck, Upload, FileCheck, ShoppingCart, Clock, Printer, Palette, Copy, AlertCircle, ChevronDown, Lock } from 'lucide-react';
import StatusBadge from './StatusBadge';
import SearchablePresetSelector from './SearchablePresetSelector';
import TypeableProductSelect from './TypeableProductSelect';
import ModernDateRangePicker from './ModernDateRangePicker';
import VRMProformaInvoicePrintTemplate from './VRMProformaInvoicePrintTemplate';
import { VRM_HDG_PRESETS, getAllActivePresets, isFixedQuantityPreset } from '../vrmHdgProposalPresets';
import { saveMediaToCache, getMediaFromCache, compressAndSaveFile, normalizePaymentTerm, STANDARD_PAYMENT_TERMS, stripDataUrlsFromRecord } from '../utils/otherViewsShared';
import { getFullProductsCatalogWithStock } from '../utils/productCatalogService';
import { normalizeProductName, resolveProductCode } from '../utils/vrmProductsData';
import { centralInventoryStore } from '../utils/centralInventoryStore';
import { saveCloudStore, saveCloudStoreImmediate, fetchCloudStore, subscribeToCloudStore } from '../utils/supabaseDataSync';
import { notifyPiCreated } from '../services/notificationService';
import { fetchCustomersDeduplicated, searchCustomers, getCustomerDetails } from '../services/customerService';
import { isTamilNaduIntra, calculateGstTiers } from '../utils/gstHelper';
import { getNextSequence } from '../utils/sequenceGenerator';

const defaultSalesPIs = [];

const defaultProcurementPIs = [];

export const PRESET_THEMES = [
  { primary: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC', tagBg: '#CFFAFE', tagText: '#155E75', badge: 'PRESET 1', dot: '#0891B2' },
  { primary: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', tagBg: '#E0E7FF', tagText: '#3730A3', badge: 'PRESET 2', dot: '#4F46E5' },
  { primary: '#D97706', bg: '#FFFBEB', border: '#FDE68A', tagBg: '#FEF3C7', tagText: '#92400E', badge: 'PRESET 3', dot: '#B45309' },
  { primary: '#059669', bg: '#ECFDF5', border: '#A7F3D0', tagBg: '#D1FAE5', tagText: '#065F46', badge: 'PRESET 4', dot: '#047857' },
  { primary: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', tagBg: '#EDE9FE', tagText: '#5B21B6', badge: 'PRESET 5', dot: '#6D28D9' },
];

export const getPresetTheme = (groupIndex) => {
  return PRESET_THEMES[groupIndex % PRESET_THEMES.length] || PRESET_THEMES[0];
};

export const is5PctSolarProduct = (name = '', cat = '') => {
  const text = `${name} ${cat}`.toLowerCase();
  return (
    text.includes('inverter') ||
    text.includes('solar panel') ||
    text.includes('solar module') ||
    text.includes('pv module') ||
    text.includes('panel') ||
    text.includes('module') ||
    text.includes('topcon') ||
    text.includes('bifacial') ||
    text.includes('monocrystalline') ||
    text.includes('polycrystalline') ||
    text.includes('dcr') ||
    text.includes('ongrid') ||
    text.includes('offgrid') ||
    text.includes('hybrid inverter') ||
    text.includes('waaree')
  );
};

const normalizePiRecord = (item) => {
  if (!item) return item;
  let normalized = { ...item };
  if (normalized.status === 'Pending Approval' || normalized.status === 'Approved') {
    normalized.status = 'Issued';
    normalized.statusType = 'issued';
  }
  // Strict 1-to-1 Safeguard: PI-00061 is the sole owner of BOM-659.
  // Any other PIs (PI-00063, PI-00064, PI-00065, PI-00066) with accidental BOM-659 must be sanitized to Issued.
  const pNo = String(normalized.piNo || normalized.id || '').trim().toUpperCase();
  const bomCode = String(
    normalized.convertedBomCode || 
    normalized.convertedBomNo || 
    normalized.converted_bom_code || 
    normalized.converted_bom_no || ''
  ).trim().toUpperCase();
  if ((bomCode === 'BOM-659' || bomCode === '659') && pNo !== 'PI-00061') {
    normalized.status = 'Issued';
    normalized.statusType = 'issued';
    normalized.convertedToBom = false;
    normalized.isConverted = false;
    normalized.convertedBomCode = null;
    normalized.convertedBomNo = null;
    normalized.converted_bom_code = null;
    normalized.converted_bom_no = null;
  }
  return normalized;
};

// Official GST State Code mappings for Indian GSTINs
export const GST_STATE_MAP = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '36': 'Telangana', '37': 'Andhra Pradesh'
};

export default function PerformaInvoiceView({ onConvertToBom, userRole = 'Procurement Head', onNavigateTab, targetPiNo, clearTargetPi }) {
  const isSalesRole = userRole === 'Sales Head' || userRole === 'Sales Executive';
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
  const [topToast, setTopToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const showTopToast = (message, type = 'success', duration = 5000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setTopToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setTopToast(null);
    }, duration);
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
    // STRICT DRAFT GUARD: A Draft PI is work-in-progress and can never be converted or linked to a BOM
    if (pi.status === 'Draft' || pi.statusType === 'draft') return [];

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

      // STRICT HARD BARRIER: BOM-659 belongs strictly and exclusively to PI-00061.
      if (bCode === 'bom-659' && piNum !== 'pi-00061') {
        return false;
      }

      // 1. Strict 1-to-1 match by source PI number (with customer verification guard)
      if (sPi && sPi === piNum) {
        const piCust = String(pi.customerName || pi.vendor || '').trim().toLowerCase();
        const bCust = String(b.customerName || b.companyName || '').trim().toLowerCase();
        if (piCust && bCust && piCust !== bCust && !piCust.includes(bCust) && !bCust.includes(piCust)) {
          return false;
        }
        return true;
      }

      // 2. If this BOM is explicitly owned by a DIFFERENT PI, it CANNOT match this PI!
      if (sPi && sPi !== piNum) return false;

      // 3. Fallback only if BOM has NO sourcePiNo recorded, but explicit convertedBomCode matches
      if (!sPi && explicitCode && bCode && bCode === explicitCode) {
        if (bCode === 'bom-659') return false;
        // Double check customer name if available to avoid cross-customer cross-linking
        const piCust = String(pi.customerName || pi.vendor || '').trim().toLowerCase();
        const bCust = String(b.customerName || b.companyName || '').trim().toLowerCase();
        if (piCust && bCust && piCust !== bCust && !piCust.includes(bCust) && !bCust.includes(piCust)) {
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
    ['Sales Executive', 'Sales', 'Salesperson', 'Sales Rep', 'Sales Representative'].some(r => r.toLowerCase() === userRole.toLowerCase().trim()) &&
    !['Sales Head', 'CEO', 'MD', 'Managing Director', 'Technical Administrator', 'Dispatch Head', 'Dispatch', 'Dispatch Team', 'Production Head', 'Accounts Head', 'Accounts Executive', 'Billing', 'Floor Supervisor', 'Procurement Head'].some(r => r.toLowerCase() === userRole.toLowerCase().trim())
  );

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

  const visiblePIList = useMemo(() => {
    const raw = Array.isArray(piList) ? piList.filter(Boolean) : [];
    if (!isRestrictedSalesUser) return raw;

    const curCode = currentEmpId.toUpperCase();
    const curName = currentEmpName.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    const curEmail = currentLoggedEmail;

    // If no specific employee profile is configured, show all records safely
    if (!curCode && !curName && !curEmail) return raw;

    return raw.filter(pi => {
      if (!pi) return false;
      const spCode = String(pi.salesPersonCode || pi.createdById || '').trim().toUpperCase();
      const spEmail = String(pi.salesPersonEmail || pi.email || '').trim().toLowerCase();
      const spName = String(pi.salesPerson || pi.salesperson || pi.salesRep || pi.createdBy || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();

      // 1. Strict EMP Code matching
      if (curCode && spCode && spCode === curCode) {
        return true;
      }

      // 2. Strict Email matching
      if (curEmail && spEmail && spEmail === curEmail) {
        return true;
      }

      // 3. Name matching when employee code is unassigned or generic fallback
      const isGenericCode = !spCode || spCode === 'SE-1000' || spCode === 'SE-VRM001' || spCode === 'SE-DEFAULT' || spCode === 'UNASSIGNED';
      if (curName && spName && (curName === spName || spName.includes(curName) || curName.includes(spName))) {
        if (isGenericCode || (curCode && spCode === curCode)) {
          return true;
        }
      }

      // If record belongs to a distinct and different salesperson code, exclude
      if (curCode && spCode && !isGenericCode && spCode !== curCode) {
        return false;
      }

      return false;
    });
  }, [piList, isRestrictedSalesUser, currentEmpId, currentEmpName, currentLoggedEmail]);

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
          latest.forEach(p => { if (p && p.piNo) merged.set(String(p.piNo).trim().toLowerCase(), normalizePiRecord(p)); });
          return Array.from(merged.values());
        });
        setTableLoading(false);
      }
    });

    return () => {
      if (sub && sub.unsubscribe) sub.unsubscribe();
    };
  }, [storageKey, isSalesRole]);

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
    showTopToast(`⏳ Pushing Proforma Invoice ${cleanNo} to Zoho Books Quotes...`, 'info', 4000);

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

      showTopToast(`✅ Proforma Invoice ${cleanNo} successfully pushed to Zoho Books as Quote #${estNo}!`, 'success', 6000);
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
        showTopToast('⚠️ Preset Amt (₹) is mandatory for preset structure kits. Please click "Edit Info" to enter the amount first.', 'warning', 4500);
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
      fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitized)
      }).catch(err => console.warn('Background PI release sync:', err));
    } catch (_) {}
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
    const pName = pi.presetName || (pGroupList.length > 0 ? pGroupList.map(g => `${g.presetName} (${g.setCount} Set${g.setCount > 1 ? 's' : ''})`).join(' + ') : null);
    const pKitPrice = pi.presetKitPrice != null ? pi.presetKitPrice : (pi.kitSubtotal != null ? pi.kitSubtotal : (cleanGrand > 0 ? Math.round(cleanGrand / 1.18) : null));
    const pSetCount = pi.presetSetCount || (pGroupList.length > 0 ? pGroupList.reduce((s, g) => s + (parseInt(g.setCount) || 1), 0) : 1);

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
          uom: it.uom || 'NOS',
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
          uom: 'NOS',
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
    setStartDate('');
    setEndDate('');
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
  const [selectedItemIndexes, setSelectedItemIndexes] = useState([]);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showCreateSetModal, setShowCreateSetModal] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetCount, setNewSetCount] = useState(1);
  const [newSetPrice, setNewSetPrice] = useState('');
  const [newSetGstRate, setNewSetGstRate] = useState('18%');
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

  // Financial calculations supporting multi-preset groups and line items
  const calculatePiTotals = () => {
    let kitSubtotal = 0;
    const groupIds = Object.keys(presetGroups || {});
    groupIds.forEach(grpId => {
      const grp = presetGroups[grpId];
      if (grp) {
        const unitPrice = parseFloat(grp.kitPrice) || 0;
        const multiplier = parseInt(grp.setCount) || 1;
        kitSubtotal += (unitPrice * multiplier);
      }
    });

    const itemsSub = (piItems || []).reduce((acc, item) => {
      if (item.isPresetItem) return acc;
      const q = parseFloat(item.qty) || 0;
      const r = parseFloat(item.rate) || 0;
      return acc + (q * r);
    }, 0);

    const sub = itemsSub + kitSubtotal;

    // 3. GST: Custom item GSTs + Preset kits GST grouped by rate (e.g. 5%, 18%)
    const gstTiersMap = {};

    (piItems || []).forEach(item => {
      if (item.isPresetItem) return;
      const q = parseFloat(item.qty) || 0;
      const r = parseFloat(item.rate) || 0;
      const rowTot = q * r;
      const pct = parseFloat(String(item.gstRate || '18%').replace('%', '')) || 18;
      const amt = rowTot * (pct / 100);
      if (!gstTiersMap[pct]) gstTiersMap[pct] = { rate: pct, taxable: 0, gstAmt: 0 };
      gstTiersMap[pct].taxable += rowTot;
      gstTiersMap[pct].gstAmt += amt;
    });

    groupIds.forEach(grpId => {
      const grp = presetGroups[grpId];
      if (grp) {
        const unitPrice = parseFloat(grp.kitPrice) || 0;
        const multiplier = parseInt(grp.setCount) || 1;
        const groupTotal = unitPrice * multiplier;

        const groupItems = (piItems || []).filter(it => (it.presetGroupId || 'legacy_default') === grpId);
        const totalQty = groupItems.reduce((sum, it) => sum + (parseFloat(it.qty) || 1), 0);

        if (groupItems.length > 0 && totalQty > 0) {
          groupItems.forEach(it => {
            const itQty = parseFloat(it.qty) || 1;
            const itemShare = groupTotal * (itQty / totalQty);
            const itGstRate = parseFloat(String(it.gstRate || grp.gstRate || '18%').replace('%', '')) || 18;
            const itAmt = itemShare * (itGstRate / 100);
            if (!gstTiersMap[itGstRate]) gstTiersMap[itGstRate] = { rate: itGstRate, taxable: 0, gstAmt: 0 };
            gstTiersMap[itGstRate].taxable += itemShare;
            gstTiersMap[itGstRate].gstAmt += itAmt;
          });
        } else {
          const gRateStr = grp?.gstRate || '18%';
          const gPct = parseFloat(String(gRateStr).replace('%', '')) || 18;
          const gAmt = groupTotal * (gPct / 100);
          if (!gstTiersMap[gPct]) gstTiersMap[gPct] = { rate: gPct, taxable: 0, gstAmt: 0 };
          gstTiersMap[gPct].taxable += groupTotal;
          gstTiersMap[gPct].gstAmt += gAmt;
        }
      }
    });

    const targetState = sameAsBilling ? billingState : (deliveryState || billingState);
    const isIntra = isTamilNaduIntra(gstNo, targetState, billingState);

    const gstTiers = Object.values(gstTiersMap)
      .filter(t => t.gstAmt > 0 || t.taxable > 0)
      .sort((a, b) => a.rate - b.rate);

    const formattedTiers = (gstTiers.length > 0 ? gstTiers : [{ rate: 18, taxable: sub, gstAmt: sub * 0.18 }]).map(t => ({
      ...t,
      cgstRate: t.rate / 2,
      cgstAmt: t.gstAmt / 2,
      sgstRate: t.rate / 2,
      sgstAmt: t.gstAmt / 2,
      igstRate: t.rate,
      igstAmt: t.gstAmt
    }));

    const gst = formattedTiers.reduce((sum, t) => sum + t.gstAmt, 0);
    const grand = sub + gst;
    const cgst = gst / 2;
    const sgst = gst / 2;

    return {
      sub: isNaN(sub) ? 0 : sub,
      kitSubtotal: isNaN(kitSubtotal) ? 0 : kitSubtotal,
      gst: isNaN(gst) ? 0 : gst,
      grand: isNaN(grand) ? 0 : grand,
      cgst: isNaN(cgst) ? 0 : cgst,
      sgst: isNaN(sgst) ? 0 : sgst,
      isIntra,
      taxType: isIntra ? 'INTRA' : 'INTER',
      gstTiers: formattedTiers
    };
  };

  const previewCurrentFormAsTemplate = () => {
    const totals = calculatePiTotals();
    const joinedProducts = (piItems || []).map(it => it.name).filter(Boolean).join(', ') || 'Solar Structure & Accessories';
    const previewData = {
      piNo: (piNumber && piNumber.trim() && piNumber !== 'Auto-Assigned') ? piNumber : 'DRAFT-PREVIEW',
      vendor: vendorName || 'Customer Company Name',
      customerName: vendorName || 'Customer Company Name',
      contactPerson,
      phone,
      email,
      gstNo: (gstNo || '').toUpperCase(),
      productName: joinedProducts,
      items: (piItems && piItems.length > 0) ? piItems : [
        {
          name: joinedProducts,
          description: 'Standard VRM Solar Structure & Accessories Kit',
          hsn: '73089090',
          qty: 1,
          uom: 'Set',
          rate: totals.sub || 100000,
          gstRate: '18%',
          amount: totals.sub || 100000
        }
      ],
      salesPerson: salesPerson || getEffectiveSalesPerson(),
      billingStreet,
      billingCity,
      billingState,
      billingPincode,
      deliveryStreet: sameAsBilling ? billingStreet : deliveryStreet,
      deliveryCity: sameAsBilling ? billingCity : deliveryCity,
      deliveryState: sameAsBilling ? billingState : deliveryState,
      deliveryPincode: sameAsBilling ? billingPincode : deliveryPincode,
      sameAsBilling,
      transportMode,
      transporterName,
      destination,
      vehicleNo,
      transportScope,
      paymentTerms,
      creditDays,
      remarks,
      unitValue: Math.round(totals.sub),
      quantity: (piItems || []).reduce((acc, it) => acc + (parseFloat(it.qty) || 0), 0) || 1,
      subtotal: totals.sub,
      taxTotal: totals.gst,
      grandTotal: totals.grand,
      amount: '₹' + Math.round(totals.grand).toLocaleString('en-IN'),
      piDate: piDate || new Date().toISOString().split('T')[0],
      expDate: validUntilDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    };
    setPrintModalPi(previewData);
  };

  const handleAddMaterialRow = () => {
    setPiItems(prev => [...(prev || []), { name: '', category: '', uom: 'NOS', qty: '1', rate: '', gstRate: '18%' }]);
  };

  const handleAddPresetItem = (groupId) => {
    const grp = (groupId && presetGroups[groupId]) || Object.values(presetGroups)[0];
    if (!grp) return;
    const mult = Math.max(1, parseInt(grp.setCount) || 1);
    const targetGid = grp.groupId || groupId;
    const newItem = {
      name: '',
      category: '',
      uom: 'NOS',
      qty: String(1 * mult),
      baseQty: 1,
      rate: '0',
      gstRate: grp.gstRate || '18%',
      isPresetItem: true,
      presetGroupId: targetGid,
      presetName: grp.presetName
    };
    setPiItems(prev => {
      const items = [...(prev || [])];
      let lastGroupIdx = -1;
      for (let idx = items.length - 1; idx >= 0; idx--) {
        if (items[idx]?.presetGroupId === targetGid) {
          lastGroupIdx = idx;
          break;
        }
      }
      if (lastGroupIdx >= 0) {
        items.splice(lastGroupIdx + 1, 0, newItem);
        return items;
      }
      return [...items, newItem];
    });
  };

  const handleCreateCustomSet = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanName = (newSetName || '').trim() || `Custom Set ${Object.keys(presetGroups || {}).length + 1}`;
    const count = Math.max(1, parseInt(newSetCount) || 1);
    const groupId = 'custom_set_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const setGst = newSetGstRate || '18%';

    setPresetGroups(prev => ({
      ...prev,
      [groupId]: {
        groupId,
        presetId: 'custom_set',
        presetName: cleanName,
        setCount: count,
        kitPrice: newSetPrice ? String(newSetPrice) : '',
        gstRate: setGst,
        isCustomSet: true
      }
    }));

    const initialItem = {
      name: '',
      category: '',
      uom: 'NOS',
      qty: String(1 * count),
      baseQty: 1,
      rate: '0',
      gstRate: setGst,
      isPresetItem: true,
      presetGroupId: groupId,
      presetName: cleanName
    };

    setPiItems(prev => [...(prev || []), initialItem]);

    setNewSetName('');
    setNewSetCount(1);
    setNewSetPrice('');
    setNewSetGstRate('18%');
    setShowCreateSetModal(false);
  };

  const handleAddPresetToOrder = (presetId, targetPreset, setsCount) => {
    if (!targetPreset || !targetPreset.items || targetPreset.items.length === 0) return;
    const groupId = 'preset_grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const multiplier = Math.max(1, parseInt(setsCount) || 1);

    let defaultPrice = '';
    if (targetPreset.price || targetPreset.rate) {
      defaultPrice = String(targetPreset.price || targetPreset.rate);
    } else {
      const origSum = targetPreset.items.reduce((acc, it) => acc + (parseFloat(it.qty || 1) * parseFloat(it.rate || 0)), 0);
      defaultPrice = origSum > 0 ? String(origSum) : '';
    }

    const presetName = targetPreset.label || presetId;
    const isDcrBosKit = targetPreset.category === 'DCR BOS Solar Kits' || targetPreset.category === 'BOS Solar Kits' || (targetPreset.label && targetPreset.label.includes('BOS KITS'));
    const initialGstRate = isDcrBosKit ? '5%' : (targetPreset.gstRate || targetPreset.gst || '18%');

    setPresetGroups(prev => ({
      ...prev,
      [groupId]: {
        groupId,
        presetId,
        presetName,
        setCount: multiplier,
        kitPrice: defaultPrice,
        gstRate: initialGstRate
      }
    }));

    const isFixedKit = isFixedQuantityPreset(presetId, targetPreset.label || presetName);
    const newItems = targetPreset.items.map(it => {
      const baseQ = parseFloat(it.qty) || 1;
      const resCode = resolveProductCode(it);
      return {
        ...it,
        code: it.code || resCode,
        presetGroupId: groupId,
        presetName,
        baseQty: baseQ,
        qty: isFixedKit ? String(baseQ) : String(Math.round(baseQ * multiplier)),
        rate: '0',
        gstRate: (isDcrBosKit || is5PctSolarProduct(it.name, it.category || it.specs)) ? '5%' : (it.gstRate || initialGstRate),
        isPresetItem: true
      };
    });

    setPiItems(prev => [...(prev || []), ...newItems]);
    setSelectedPreset('');
    setPresetSetCount(1);
  };

  const handleRemovePresetGroup = (groupId) => {
    setPiItems(prev => (prev || []).filter(item => (item.presetGroupId || 'legacy_default') !== groupId));
    setPresetGroups(prev => {
      const updated = { ...prev };
      delete updated[groupId];
      return updated;
    });
  };

  const handleRemoveMaterialRow = (idx) => {
    setPiItems(prev => {
      const target = (prev || [])[idx];
      const remaining = (prev || []).filter((_, i) => i !== idx);
      if (target && target.presetGroupId) {
        const stillHasGroup = remaining.some(it => it.presetGroupId === target.presetGroupId);
        if (!stillHasGroup) {
          setPresetGroups(pg => {
            const copy = { ...pg };
            delete copy[target.presetGroupId];
            return copy;
          });
        }
      }
      if (remaining.length === 0) {
        setSelectedPreset('');
      }
      return remaining;
    });
    setSelectedItemIndexes(prev => prev.filter(i => i !== idx).map(i => i > idx ? i - 1 : i));
  };

  const fetchNextPiNumber = async () => {
    const fallback = getNextSequence('PI', [...(piList || []), ...(bomList || [])]).code;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('/api/next-pi-number', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.nextPiNo || data.nextEstimateNo)) {
          const val = data.nextPiNo || data.nextEstimateNo;
          setPiNumber(val);
          return val;
        }
      }
    } catch (e) {
      console.warn('Fast fallback for PI number generation:', e?.message || e);
    }

    setPiNumber(fallback);
    return fallback;
  };

  const resetForm = () => {
    setPdfFile(null);
    setSignedPiDoc(null);
    setUploadProgress(0);
    setIsUploading(false);
    setPiNumber('');
    setPiDate(new Date().toISOString().split('T')[0]);
    setValidUntilDate('');
    setVendorName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setGstNo('');
    setSalesPerson(getActiveUserName());
    setBillingStreet('');
    setBillingCity('');
    setBillingState('');
    setBillingPincode('');
    setDeliveryStreet('');
    setDeliveryCity('');
    setDeliveryState('');
    setDeliveryPincode('');
    setSameAsBilling(true);
    setTransportMode('Transport');
    setTransporterName('');
    setDestination('');
    setVehicleNo('');
    setTransportScope('VRM Structures');
    setPaymentTerms('100% Paid');
    setCreditDays('');
    setRemarks('');
    setPiItems([]); // Fresh empty default with 0 prefilled items
    setSelectedPreset('');
    setPresetSetCount(1);
    setPresetKitPrice('');
    setPresetGroups({});
    setSelectedItemIndexes([]);
    setShowSaveConfirm(false);
    setShowClearConfirmModal(false);
    setPiConfirmModal(null);
  };

  // Validates required fields before creating or saving a PI
  const validatePiForm = (isDraft = false) => {
    const missingList = [];

    // 1. Company Name
    if (!vendorName || !vendorName.trim()) {
      missingList.push({
        field: 'Company Name',
        message: 'Please enter or select the Company Name.',
        targetId: 'pi-field-vendorName'
      });
    }

    // 2. Mobile / Phone
    if (!phone || !phone.trim()) {
      missingList.push({
        field: 'Contact Mobile / Phone',
        message: 'Please provide a valid contact mobile number.',
        targetId: 'pi-field-phone'
      });
    }

    // 3. Billing Address
    if (!billingStreet || !billingStreet.trim()) {
      missingList.push({
        field: 'Billing Street Address',
        message: 'Please enter the Billing Street / Door / Area details.',
        targetId: 'pi-field-billingStreet'
      });
    }
    if (!billingCity || !billingCity.trim()) {
      missingList.push({
        field: 'Billing City',
        message: 'Please enter the Billing City.',
        targetId: 'pi-field-billingCity'
      });
    }
    if (!billingState || !billingState.trim()) {
      missingList.push({
        field: 'Billing State',
        message: 'Please enter the Billing State.',
        targetId: 'pi-field-billingState'
      });
    }
    if (!billingPincode || !billingPincode.trim()) {
      missingList.push({
        field: 'Billing Pincode',
        message: 'Please enter the 6-digit Pincode.',
        targetId: 'pi-field-billingPincode'
      });
    }

    // 3.5 GST State match validation
    const checkGstCode = (gstNo || '').trim().substring(0, 2);
    const expectedGstState = GST_STATE_MAP[checkGstCode];
    if (gstNo && gstNo.trim().length >= 2 && expectedGstState && billingState && billingState.trim()) {
      if (expectedGstState.toLowerCase() !== billingState.trim().toLowerCase()) {
        missingList.push({
          field: 'GST Number State Mismatch',
          message: `GSTIN code "${checkGstCode}" is registered to ${expectedGstState}, but Billing State is entered as "${billingState}". Click "Sync to ${expectedGstState}" to resolve.`,
          targetId: 'pi-field-billingState'
        });
      }
    }

    // 4. Delivery Address
    if (!sameAsBilling) {
      if (!deliveryStreet || !deliveryStreet.trim()) {
        missingList.push({
          field: 'Delivery Street Address',
          message: 'Please enter the Delivery Street address (or check "Same as Billing").',
          targetId: 'pi-field-deliveryStreet'
        });
      }
      if (!deliveryCity || !deliveryCity.trim()) {
        missingList.push({
          field: 'Delivery City',
          message: 'Please enter the Delivery City.',
          targetId: 'pi-field-deliveryCity'
        });
      }
    }

    // 5. Line items
    if (!Array.isArray(piItems) || piItems.length === 0) {
      missingList.push({
        field: 'Invoice Line Items',
        message: 'Please add at least one line item or select a preset kit.',
        targetId: 'pi-field-items'
      });
    } else {
      const invalid = [];
      piItems.forEach((it, idx) => {
        const q = parseFloat(it.qty) || 0;
        const r = parseFloat(it.rate) || 0;
        const isPresetItem = Boolean(it.isPresetItem);
        if (!it.name || !it.name.trim()) {
          invalid.push(`Item #${idx + 1}: Name is required`);
        } else if (q <= 0) {
          invalid.push(`Item #${idx + 1} (${it.name}): Quantity must be > 0`);
        } else if (!isPresetItem && r <= 0) {
          invalid.push(`Item #${idx + 1} (${it.name}): Price (₹) is required and must be > 0`);
        }
      });
      const presetItems = piItems.filter(it => it.isPresetItem);
      if (presetItems.length > 0) {
        if (!presetGroups || Object.keys(presetGroups).length === 0) {
          invalid.push('Preset Amt (₹) is mandatory: Please enter a valid Preset Amount for the configured preset kit.');
        } else {
          Object.values(presetGroups).forEach(g => {
            const kp = parseFloat(g.kitPrice) || 0;
            if (kp <= 0) {
              invalid.push(`Preset Amt (₹) is mandatory for "${g.presetName || 'Preset Kit'}": Please enter an amount > 0`);
            }
          });
        }
      }
      if (invalid.length > 0) {
        missingList.push({
          field: 'Incomplete Item Details',
          message: invalid.join(' • '),
          targetId: 'pi-field-items'
        });
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (!validUntilDate || !validUntilDate.trim()) {
      missingList.push({
        field: 'Valid Until Date',
        message: 'Please select a Valid Until Date.',
        targetId: 'pi-field-validUntil'
      });
    } else if (validUntilDate < todayStr) {
      missingList.push({
        field: 'Valid Until Date',
        message: 'Valid Until date cannot be in the past or a finished date.',
        targetId: 'pi-field-validUntil'
      });
    }

    return {
      isValid: missingList.length === 0,
      missingList
    };
  };

  // Triggers Save Confirmation modal
  const triggerSaveConfirm = (e) => {
    if (e) e.preventDefault();
    const validation = validatePiForm(false);
    if (!validation.isValid) {
      setValidationAlert({
        fields: validation.missingList.map(m => typeof m === 'object' ? m.field : m),
        firstTargetId: validation.missingList[0]?.targetId
      });
      return;
    }
    setPiConfirmModal('create');
  };

  // Triggers Draft Confirmation modal
  const triggerDraftConfirm = (e) => {
    if (e) e.preventDefault();
    if (!vendorName || !vendorName.trim()) {
      setValidationAlert({
        fields: ['Company Name'],
        firstTargetId: 'pi-field-vendorName'
      });
      return;
    }
    // Check if preset items exist without Preset Amt
    const presetItems = (piItems || []).filter(it => it.isPresetItem);
    if (presetItems.length > 0) {
      let missingKitPrice = false;
      if (!presetGroups || Object.keys(presetGroups).length === 0) {
        missingKitPrice = true;
      } else {
        Object.values(presetGroups).forEach(g => {
          if (!g.kitPrice || parseFloat(g.kitPrice) <= 0) {
            missingKitPrice = true;
          }
        });
      }
      if (missingKitPrice) {
        setValidationAlert({
          fields: ['Preset Amt (₹) is Mandatory'],
          message: 'Preset Amt (₹) is mandatory for preset structure items. Please enter a valid amount before saving.',
          firstTargetId: 'pi-field-items'
        });
        return;
      }
    }
    setPiConfirmModal('draft');
  };

  // Submits the new or edited PI
  const executeCreatePI = async (isDraft = false) => {
    if (isSubmittingPI) return;
    setIsSubmittingPI(true);
    try {
      const totals = calculatePiTotals();
      const joinedProducts = piItems.map(it => it.name).filter(Boolean).join(', ') || 'Solar Structure & Accessories';

      const isEditing = editIdx !== null;
      let cleanPiNo;
      if (isEditing) {
        cleanPiNo = (piNumber && piNumber.trim() && piNumber !== 'Auto-Assigned')
          ? piNumber.trim().toUpperCase()
          : (piList[editIdx]?.piNo || `PI-${String(editIdx + 1).padStart(5, '0')}`);
      } else {
        // Generate the sequential PI number at the last step upon final submission (same as BOM)
        cleanPiNo = await fetchNextPiNumber();
      }

      // CONCURRENCY & COLLISION PROTECTION (CLIENT-SIDE):
      // If user is creating a NEW PI (not editing), but cleanPiNo already exists in local piList:
      // DO NOT OVERWRITE! Advance to the next unused sequence number.
      let targetKey = String(cleanPiNo || '').trim().toLowerCase();
      if (!isEditing) {
        const isCollision = (piList || []).some(p => {
          const pNo = String(p.piNo || '').trim().toLowerCase();
          const pId = String(p.id || '').trim().toLowerCase();
          return pNo === targetKey || pId === targetKey;
        });
        if (isCollision) {
          const { code } = getNextSequence('PI', [...(piList || []), ...(bomList || [])]);
          console.warn(`[PI CONCURRENCY SAFETY] PI number "${cleanPiNo}" is already taken. Auto-advancing new PI to "${code}".`);
          cleanPiNo = code;
          targetKey = cleanPiNo.toLowerCase();
        }
      }

      setPiNumber(cleanPiNo);

      const existingMatchIdx = (piList || []).findIndex(p => {
        const pNo = String(p.piNo || '').trim().toLowerCase();
        const pId = String(p.id || '').trim().toLowerCase();
        return pNo === targetKey || pId === targetKey;
      });

      const matchedExisting = (isEditing && existingMatchIdx !== -1)
        ? piList[existingMatchIdx]
        : (isEditing && editIdx !== null ? piList[editIdx] : null);

      const newPI = {
        id: cleanPiNo,
        piNo: cleanPiNo,
        vendor: vendorName,
        customerName: vendorName,
        contactPerson,
        phone,
        email,
        gstNo: (gstNo || '').toUpperCase(),
        productName: joinedProducts,
        items: piItems,
        presetGroups,
        billingAddress: {
          street: billingStreet,
          city: billingCity,
          state: billingState,
          pincode: billingPincode
        },
        deliveryAddress: {
          street: sameAsBilling ? billingStreet : deliveryStreet,
          city: sameAsBilling ? billingCity : deliveryCity,
          state: sameAsBilling ? billingState : deliveryState,
          pincode: sameAsBilling ? billingPincode : deliveryPincode
        },
        sameAsBilling,
        transportMode,
        transporterName,
        destination: destination.trim(),
        vehicleNo,
        transportScope,
        paymentTerms,
        creditDays,
        remarks,
        unitValue: Math.round(totals.sub),
        quantity: piItems.reduce((acc, it) => acc + (parseFloat(it.qty) || 0), 0) || 1,
        subtotal: totals.sub,
        kitSubtotal: totals.kitSubtotal,
        taxTotal: totals.gst,
        cgst: totals.cgst,
        sgst: totals.sgst,
        grandTotal: totals.grand,
        amount: '₹' + Math.round(totals.grand).toLocaleString('en-IN'),
        pdfName: pdfFile ? pdfFile.name : (signedPiDoc ? signedPiDoc.name : null),
        signedPiDoc: signedPiDoc || null,
        piDate: piDate || new Date().toISOString().split('T')[0],
        expDate: validUntilDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        status: isDraft ? 'Draft' : (matchedExisting?.status === 'Converted to BOM' ? 'Converted to BOM' : 'Issued'),
        statusType: isDraft ? 'draft' : (matchedExisting?.statusType === 'converted' ? 'converted' : 'issued'),
        salesPerson: (isEditing ? matchedExisting?.salesPerson : null) || getEffectiveSalesPerson(),
        salesperson: (isEditing ? matchedExisting?.salesPerson : null) || getEffectiveSalesPerson(),
        salesPersonCode: (isEditing ? matchedExisting?.salesPersonCode : null) || currentEmpId || 'SE-004',
        salesPersonEmail: (isEditing ? matchedExisting?.salesPersonEmail : null) || currentLoggedEmail || '',
        createdBy: (isEditing ? matchedExisting?.createdBy : null) || getEffectiveSalesPerson(),
        createdById: (isEditing ? matchedExisting?.createdById : null) || currentEmpId || 'SE-004',
        zohoSynced: matchedExisting?.zohoSynced || false,
        zohoEstimateId: matchedExisting?.zohoEstimateId || null,
        zohoModule: 'Quotes'
      };

      let updatedList;
      if (isEditing && existingMatchIdx !== -1) {
        updatedList = [...piList];
        updatedList[existingMatchIdx] = newPI;
        setEditIdx(null);
      } else if (isEditing && editIdx !== null && editIdx >= 0 && editIdx < piList.length) {
        updatedList = [...piList];
        updatedList[editIdx] = newPI;
        setEditIdx(null);
      } else {
        // ALWAYS PREPEND new PI to list without overwriting any existing PI
        updatedList = [newPI, ...piList];
        setEditIdx(null);
        try {
          notifyPiCreated({
            piNo: newPI.piNo,
            customerName: newPI.vendor,
            salesPerson: newPI.salesPerson,
            salesPersonCode: newPI.salesPersonCode,
            amount: newPI.amount
          });
        } catch (err) {
          console.warn('PI voice notification error:', err);
        }
      }
      updatePiList(updatedList);

      // Save Proforma Invoice to BUSINZ Database (PostgreSQL public.proforma_invoices)
      // NOTE: Strictly database-first. Zero automatic Zoho sync. Zoho push occurs ONLY when salesperson clicks "Push to Zoho".
      const sanitizedPayload = {
        ...stripDataUrlsFromRecord(newPI),
        isEdit: isEditing
      };
      delete sanitizedPayload.paymentProofDoc;
      delete sanitizedPayload.deliveryProofDoc;
      delete sanitizedPayload.deliveryAddressProofDoc;

      try {
        const response = await fetch('/api/estimates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sanitizedPayload)
        });

        const data = await response.json();
        if (!response.ok || !data || data.success === false) {
          throw new Error(data?.error || `Server returned error status ${response.status}`);
        }

        const serverAssignedPiNo = data?.pi?.piNo || data?.estimate?.piNo;
        const finalEstNo = serverAssignedPiNo || data?.estimate?.piNo || cleanPiNo;

        if (serverAssignedPiNo && serverAssignedPiNo !== cleanPiNo) {
          console.warn(`[PI CONCURRENCY NOTIFICATION] Server auto-advanced PI number from ${cleanPiNo} to ${serverAssignedPiNo}`);
          showTopToast(`ℹ️ PI Number was auto-advanced to ${serverAssignedPiNo} to prevent overwriting existing record.`, 'info', 6000);
        }

        const enrichedList = updatedList.map(p => (p.piNo === newPI.piNo || p.id === newPI.id) ? {
          ...p,
          id: finalEstNo,
          piNo: finalEstNo,
          ...(data.pi || {})
        } : p);
        updatePiList(enrichedList);

        // Dismiss modal and advance to list view once confirmed safely stored in DB
        setPiConfirmModal(null);
        resetForm();
        setViewMode('list');

        const safeCustomer = (vendorName || customerName || 'Customer').trim();
        if (isDraft) {
          showTopToast(`📝 Proforma Invoice (${finalEstNo}) for ${safeCustomer} has been saved as Draft in BUSINZ database.`, 'info', 5000);
        } else {
          showTopToast(`✅ Proforma Invoice (${finalEstNo}) for ${safeCustomer} stored permanently in BUSINZ database!`, 'success', 5000);
        }
      } catch (saveErr) {
        console.error('[ESTIMATE DB SAVE ERROR]', saveErr);
        showTopToast('❌ Failed to store Proforma Invoice in database: ' + (saveErr?.message || 'Server error. Please try again.'), 'error', 8000);
        // Do NOT reset form so salesperson never loses their entered form data!
        return;
      }
    } catch (err) {
      console.error('Error creating Proforma Invoice:', err);
      showTopToast('Error creating Proforma Invoice: ' + (err?.message || 'Please check your connection and try again.'), 'error', 6000);
    } finally {
      setIsSubmittingPI(false);
      setPiConfirmModal(null);
    }
  };

  // Pre-populates the fields to edit a Performa Invoice
  const handleStartEdit = (pi, idx) => {
    setEditIdx(idx);
    setPiNumber(pi.piNo || '');
    if (pi.piDate) setPiDate(pi.piDate);
    const todayStr = new Date().toISOString().split('T')[0];
    const incomingValidUntil = pi.validUntilDate || pi.expDate || pi.validUntil || '';
    setValidUntilDate(incomingValidUntil);
    setVendorName(pi.vendor || pi.customerName || '');
    setContactPerson(pi.contactPerson || '');
    setPhone(pi.phone || '');
    setEmail(pi.email || '');
    setGstNo(pi.gstNo || '');
    setSalesPerson(pi.salesPerson || getActiveUserName());
    setPaymentTerms(normalizePaymentTerm(pi.paymentTerms || pi.paymentType || '100% Paid'));
    setCreditDays(pi.creditDays || '');
    setTransportMode(pi.transportMode || 'Transport');
    setTransporterName(pi.transporterName || '');
    setDestination(pi.destination || pi.deliveryCity || '');
    setVehicleNo(pi.vehicleNo || '');
    setTransportScope(pi.transportScope || 'VRM Structures');

    // Robust Billing Address extraction (handles object, string, or direct properties)
    const bAddr = pi.billingAddress || pi.billingAddressObj || {};
    if (typeof bAddr === 'object') {
      setBillingStreet(bAddr.street || bAddr.address || pi.billingStreet || '');
      setBillingCity(bAddr.city || pi.billingCity || '');
      setBillingState(bAddr.state || pi.billingState || '');
      setBillingPincode(bAddr.pincode || bAddr.pin || pi.billingPincode || '');
    } else if (typeof bAddr === 'string') {
      setBillingStreet(bAddr || pi.billingStreet || '');
      setBillingCity(pi.billingCity || '');
      setBillingState(pi.billingState || '');
      setBillingPincode(pi.billingPincode || '');
    } else {
      setBillingStreet(pi.billingStreet || '');
      setBillingCity(pi.billingCity || '');
      setBillingState(pi.billingState || '');
      setBillingPincode(pi.billingPincode || '');
    }

    // Robust Delivery Address extraction
    const dAddr = pi.deliveryAddress || pi.deliveryAddressObj || {};
    if (typeof dAddr === 'object') {
      setDeliveryStreet(dAddr.street || dAddr.address || pi.deliveryStreet || '');
      setDeliveryCity(dAddr.city || pi.deliveryCity || '');
      setDeliveryState(dAddr.state || pi.deliveryState || '');
      setDeliveryPincode(dAddr.pincode || dAddr.pin || pi.deliveryPincode || '');
    } else if (typeof dAddr === 'string') {
      setDeliveryStreet(dAddr || pi.deliveryStreet || '');
      setDeliveryCity(pi.deliveryCity || '');
      setDeliveryState(pi.deliveryState || '');
      setDeliveryPincode(pi.deliveryPincode || '');
    } else {
      setDeliveryStreet(pi.deliveryStreet || '');
      setDeliveryCity(pi.deliveryCity || '');
      setDeliveryState(pi.deliveryState || '');
      setDeliveryPincode(pi.deliveryPincode || '');
    }
    setSameAsBilling(pi.sameAsBilling !== undefined ? pi.sameAsBilling : (!pi.deliveryStreet && !pi.deliveryAddress));
    if (pi.presetGroups) {
      setPresetGroups(pi.presetGroups);
    } else {
      setPresetGroups({});
    }
    if (Array.isArray(pi.items) && pi.items.length > 0) {
      setPiItems(pi.items);
    } else {
      setPiItems([
        {
          name: pi.productName || 'Solar Mounting Structures & Fasteners',
          category: 'Structure Kit',
          uom: 'SET',
          qty: String(pi.quantity || 1),
          rate: String(pi.unitValue || 25000),
          gstRate: '18%'
        }
      ]);
    }
    if (pi.signedPiDoc) {
      setSignedPiDoc(pi.signedPiDoc);
    } else if (pi.pdfName) {
      setSignedPiDoc({ name: pi.pdfName, size: 24000, uploadedAt: pi.piDate });
    } else {
      setSignedPiDoc(null);
    }
    setPdfFile(pi.pdfName ? { name: pi.pdfName, size: 3.2 * 1024 * 1024 } : null);
    setUploadProgress(100);
    setViewMode('edit');
    setActiveDropdownIdx(null);
  };

  // Deletes the PI
  const executeDeletePI = () => {
    if (deleteIdx !== null) {
      updatePiList(piList.filter((_, i) => i !== deleteIdx));
      setDeleteIdx(null);
    }
  };

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-24)', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>

      {/* ==================== IN-APP TOP NOTIFICATION (SELF-DISMISSING, NO BROWSER ALERT) ==================== */}
      {topToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 24px',
          borderRadius: '50px',
          backgroundColor: topToast.type === 'error' ? '#DC2626' : '#0E7490',
          color: '#FFFFFF',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(255, 255, 255, 0.2) inset',
          fontSize: '13.5px',
          fontWeight: '700',
          letterSpacing: '-0.2px',
          maxWidth: '90vw',
          pointerEvents: 'auto',
          transition: 'all 0.25s ease'
        }}>
          {topToast.type === 'error' ? (
            <AlertCircle size={18} style={{ color: '#FEE2E2', flexShrink: 0 }} />
          ) : (
            <CheckCircle size={18} style={{ color: '#A7F3D0', flexShrink: 0 }} />
          )}
          <span>{topToast.message}</span>
          <button
            type="button"
            onClick={() => setTopToast(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.75)',
              cursor: 'pointer',
              marginLeft: '6px',
              padding: '0 4px',
              display: 'flex',
              alignItems: 'center',
              fontSize: '15px',
              lineHeight: 1
            }}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

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

      {/* ==================== VIEW 1: LIST DASHBOARD SCREEN ==================== */}
      {viewMode === 'list' && (() => {
        const uniqueStatuses = ['All', ...new Set(visiblePIList.map(pi => pi.status))];
        const filteredPIList = (visiblePIList || []).filter(pi => {
          if (!pi) return false;
          const matchedBoms = getConvertedBomsForPi(pi);
          const hasSavedBom = matchedBoms.length > 0;
          const bomCodesStr = matchedBoms.map(b => b.bomCode || b.code || b.id).join(' ').toLowerCase();

          const searchLower = String(searchQuery || '').toLowerCase().trim();
          const matchesSearch = !searchLower ||
            String(pi.piNo || '').toLowerCase().includes(searchLower) ||
            String(pi.vendor || pi.customerName || '').toLowerCase().includes(searchLower) ||
            String(pi.gstNo || '').toLowerCase().includes(searchLower) ||
            String(pi.productName || '').toLowerCase().includes(searchLower) ||
            bomCodesStr.includes(searchLower);

          const isDraft = (pi.status === 'Draft' || pi.statusType === 'draft');
          const isConverted = !isDraft && hasSavedBom;
          const currentStatus = isDraft
            ? 'Draft'
            : (isConverted
              ? 'Converted to BOM'
              : ((pi.status === 'Pending Approval' || pi.status === 'Approved' || pi.status === 'Converted to BOM')
                ? 'Issued'
                : (pi.status || 'Issued')));

          const matchesStatus = statusFilter === 'All'
            || (statusFilter === 'Issued' && currentStatus === 'Issued')
            || (statusFilter === 'Converted to BOM' && currentStatus === 'Converted to BOM')
            || currentStatus === statusFilter;
          const matchesTab = piTab === 'All'
            || (piTab === 'Issued' && currentStatus === 'Issued')
            || (piTab === 'Converted to BOM' && currentStatus === 'Converted to BOM')
            || currentStatus === piTab;

          // Date Range Matching
          let matchesDateRange = true;
          const rawDateStr = String(pi.piDate || pi.date || pi.created_time || pi.createdAt || '').trim();
          let piIsoDate = '';
          if (/^\d{4}-\d{2}-\d{2}/.test(rawDateStr)) {
            piIsoDate = rawDateStr.slice(0, 10);
          } else if (rawDateStr) {
            const d = new Date(rawDateStr);
            if (!isNaN(d.getTime())) {
              piIsoDate = d.toISOString().slice(0, 10);
            }
          }

          if (startDate && piIsoDate && piIsoDate < startDate) {
            matchesDateRange = false;
          }
          if (endDate && piIsoDate && piIsoDate > endDate) {
            matchesDateRange = false;
          }

          return matchesSearch && matchesStatus && matchesTab && matchesDateRange;
        });

        const indexOfLastRow = currentPage * rowsPerPage;
        const indexOfFirstRow = indexOfLastRow - rowsPerPage;
        const currentRows = filteredPIList.slice(indexOfFirstRow, indexOfLastRow);
        const totalPages = Math.ceil(filteredPIList.length / rowsPerPage);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-24)', minWidth: 0, width: '100%' }}>
            {/* Header section with Action Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: '200px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>
                  Performa Invoices
                </h2>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                  Manage commercial Proforma Invoices and customer billing
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => {
                    resetForm();
                    setEditIdx(null);
                    setViewMode('create');
                    setPiNumber('');
                  }}
                  style={{
                    backgroundColor: '#0E7490',
                    border: 'none',
                    color: 'white',
                    height: '40px',
                    fontSize: '13px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '0 6px 0 20px',
                    borderRadius: '50px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(14, 116, 144, 0.2)',
                    transition: 'all 0.2s ease-in-out',
                    flexShrink: 0
                  }}
                >
                  <span>Create PI</span>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    color: '#0E7490',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <ArrowRight style={{ width: '16px', height: '16px', color: '#0E7490' }} />
                  </div>
                </button>
              </div>
            </div>



            {/* 1. FILTERS & SEARCH ROW CARD */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '12px 16px', backgroundColor: '#fafbfc', borderRadius: '12px', border: '1px solid #e2e8f0', alignItems: 'center', width: '100%', boxSizing: 'border-box', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 12px', height: '38px', backgroundColor: '#f8fafc', flex: '1 1 240px', maxWidth: '380px', minWidth: '200px' }}>
                <Search style={{ width: '15px', height: '15px', color: '#64748b', flexShrink: 0 }} />
                <input id="performa-invoice-search-query" name="searchQuery" aria-label="Search Performa Invoices (PI No, Customer Name, GST No)"
                  type="text"
                  placeholder="Search Performa Invoices (PI No, Customer Name, GST No)..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  style={{ border: 'none', background: 'none', outline: 'none', fontSize: '13px', width: '100%', minWidth: 0, color: '#334155' }}
                 />
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                {/* Modern Date Range Picker */}
                <ModernDateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onChange={({ startDate: s, endDate: e }) => {
                    setStartDate(s);
                    setEndDate(e);
                    setCurrentPage(1);
                  }}
                />

                <select id="performa-invoice-status-filter" name="statusFilter" aria-label="StatusFilter" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 24px 0 10px', fontSize: '13px', backgroundColor: 'white', color: '#334155', minWidth: '130px', outline: 'none' }}>
                  {uniqueStatuses.map(s => (
                    <option key={s} value={s}>
                      {s === 'All' ? 'Status: All' : s}
                    </option>
                  ))}
                </select>

                <button
                  onClick={clearFilters}
                  title="Clear Filters"
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    cursor: 'pointer',
                    padding: '0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                    height: '38px',
                    width: '38px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <RotateCcw style={{ width: '15px', height: '15px' }} />
                </button>
              </div>
            </div>

            {/* 2. STATUS SUB-TABS ROW & EXPORT BUTTON (EXACT WORK ORDERS REFERENCE DESIGN) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {[
                  { id: 'All', label: 'All Invoices (Total Sent)', count: visiblePIList.length },
                  { id: 'Issued', label: 'Issued / Active', count: visiblePIList.filter(pi => {
                    if (pi.status === 'Draft' || pi.statusType === 'draft' || pi.status === 'Cancelled') return false;
                    const matchedBoms = getConvertedBomsForPi(pi);
                    return matchedBoms.length === 0;
                  }).length },
                  { id: 'Converted to BOM', label: 'Converted to BOM', count: visiblePIList.filter(pi => {
                    if (pi.status === 'Draft' || pi.statusType === 'draft') return false;
                    const matchedBoms = getConvertedBomsForPi(pi);
                    return matchedBoms.length > 0;
                  }).length },
                  { id: 'Cancelled', label: 'Cancelled', count: visiblePIList.filter(pi => pi.status === 'Cancelled').length },
                  { id: 'Draft', label: 'Draft', count: visiblePIList.filter(pi => pi.status === 'Draft' || pi.statusType === 'draft').length }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setPiTab(tab.id); setCurrentPage(1); }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: '12px 0',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      color: piTab === tab.id ? '#0E7490' : '#64748b',
                      borderBottom: piTab === tab.id ? '2px solid #0E7490' : '2px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {tab.label}
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 7px',
                      borderRadius: '12px',
                      backgroundColor: tab.id === 'Converted to BOM' ? '#ecfdf5' : tab.id === 'Issued' ? '#f0fdf4' : tab.id === 'Cancelled' ? '#fef2f2' : '#f1f5f9',
                      color: tab.id === 'Converted to BOM' ? '#059669' : tab.id === 'Issued' ? '#16a34a' : tab.id === 'Cancelled' ? '#b91c1c' : '#475569',
                      fontWeight: 'bold'
                    }}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. MAIN DATA TABLE MATCHING EXACT REFERENCE DESIGN */}
            <div className="section-card" style={{ padding: 0, backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table className="custom-table" style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: '#475569', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', fontSize: '12px', fontWeight: 'bold', height: '48px' }}>
                      <th style={{ width: '48px', minWidth: '48px', maxWidth: '48px', padding: '12px 0', textAlign: 'center', verticalAlign: 'middle', boxSizing: 'border-box' }}>
                        <input id="performa-invoice-select-all" name="selectAll" aria-label="SelectAll"
                          type="checkbox"
                          onChange={(e) => handleSelectAll(e, filteredPIList)}
                          checked={filteredPIList.length > 0 && filteredPIList.every(pi => selectedPIs.includes(pi.piNo))}
                          style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                         />
                      </th>
                      <th style={{ width: '150px', minWidth: '140px', padding: '12px 14px', boxSizing: 'border-box' }}>PI No.</th>
                      <th style={{ minWidth: '220px', padding: '12px 14px', boxSizing: 'border-box' }}>Company Name</th>
                      <th style={{ width: '160px', minWidth: '150px', padding: '12px 14px', boxSizing: 'border-box' }}>GST No.</th>
                      <th style={{ width: '130px', minWidth: '120px', padding: '12px 14px', boxSizing: 'border-box' }}>PI Date</th>
                      <th style={{ width: '150px', minWidth: '130px', padding: '12px 14px', textAlign: 'right', boxSizing: 'border-box' }}>Total Amount</th>
                      <th style={{ width: '130px', minWidth: '120px', padding: '12px 14px', textAlign: 'center', boxSizing: 'border-box' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableLoading ? (
                      <>
                        <tr style={{ backgroundColor: '#F0FDFA' }}>
                          <td colSpan={7} style={{ padding: '24px 16px', textAlign: 'center', borderBottom: '1px solid #CCFBF1' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="businz-spin-ring" />
                                <div style={{ textAlign: 'left' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490' }}>
                                      Loading Proforma Invoices...
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', backgroundColor: '#ECFDF5', color: '#059669', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', border: '1px solid #A7F3D0' }}>
                                      <span className="businz-pulse-dot" /> Live Cloud Sync
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                                    Retrieving quotation records from Businz Cloud Storage...
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {Array.from({ length: 6 }).map((_, idx) => (
                          <tr key={`pi-skeleton-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ textAlign: 'center', padding: '12px 0', width: '48px' }}>
                              <input id="performa-invoice-input-1" name="input1" aria-label="Input 1" type="checkbox" defaultChecked={false} disabled style={{ opacity: 0.3 }}  />
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div className="skeleton-shimmer skeleton-text" style={{ width: '90px', height: '14px' }} />
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div className="skeleton-shimmer skeleton-text" style={{ width: '65%', height: '14px' }} />
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div className="skeleton-shimmer skeleton-text" style={{ width: '110px', height: '14px' }} />
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div className="skeleton-shimmer skeleton-text" style={{ width: '80px', height: '14px' }} />
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                              <div className="skeleton-shimmer skeleton-text" style={{ width: '85px', height: '14px', marginLeft: 'auto' }} />
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                              <div className="skeleton-shimmer" style={{ width: '80px', height: '22px', borderRadius: '12px', margin: '0 auto' }} />
                            </td>
                          </tr>
                        ))}
                      </>
                    ) : filteredPIList.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '48px 16px', textAlign: 'center', color: '#64748B' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <FileText size={32} style={{ color: '#CBD5E1' }} />
                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#475569' }}>No Proforma Invoices found</span>
                            <span style={{ fontSize: '12px', color: '#94A3B8' }}>No records match your active filter or search query. Click "+ Create Proforma Invoice" above to author a new quotation.</span>
                            {(searchQuery || statusFilter !== 'All' || piTab !== 'All') && (
                              <button
                                type="button"
                                onClick={() => { setSearchQuery(''); setStatusFilter('All'); setPiTab('All'); }}
                                style={{
                                  marginTop: '6px',
                                  padding: '6px 14px',
                                  backgroundColor: '#F1F5F9',
                                  color: '#0E7490',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  cursor: 'pointer'
                                }}
                              >
                                Clear All Filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentRows.map((pi, idx) => {
                        const isChecked = selectedPIs.includes(pi.piNo);

                        const isDraft = (pi.status === 'Draft' || pi.statusType === 'draft');
                        const matchedBoms = getConvertedBomsForPi(pi);
                        const hasSavedBom = matchedBoms.length > 0;
                        const isConverted = !isDraft && hasSavedBom;
                        const currentStatus = isDraft
                          ? 'Draft'
                          : (isConverted
                            ? 'Converted to BOM'
                            : ((pi.status === 'Pending Approval' || pi.status === 'Approved' || pi.status === 'Converted to BOM')
                              ? 'Issued'
                              : (pi.status || 'Issued')));

                        let statusBg = '#eff6ff';
                        let statusFg = '#2563eb';
                        let displayStatus = currentStatus;

                        if (isConverted) {
                          statusBg = '#ecfdf5';
                          statusFg = '#059669';
                          displayStatus = 'Converted to BOM';
                        } else if (currentStatus === 'Issued') {
                          statusBg = '#f0fdf4';
                          statusFg = '#16a34a';
                        } else if (currentStatus === 'Cancelled') {
                          statusBg = '#fef2f2';
                          statusFg = '#b91c1c';
                        } else if (currentStatus === 'Draft' || currentStatus === 'Overdue') {
                          statusBg = '#fef2f2';
                          statusFg = '#dc2626';
                        }

                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: '1px solid #F1F5F9',
                              transition: 'all 0.15s ease',
                              backgroundColor: isChecked ? '#ECFEFF' : 'transparent'
                            }}
                            className={`table-row-hover ${isChecked ? 'selected-row' : ''}`}
                          >
                            <td style={{
                              width: '48px',
                              minWidth: '48px',
                              padding: '12px 14px',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              boxSizing: 'border-box',
                              borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                            }}>
                              <input id="performa-invoice-checkbox" name="checkbox" aria-label="Checkbox"
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleSelectRow(pi.piNo)}
                                style={{ accentColor: '#0E7490', cursor: 'pointer', verticalAlign: 'middle', margin: 0 }}
                               />
                            </td>
                            <td
                              onClick={() => setSelectedPi(pi)}
                              style={{ padding: '12px 14px', cursor: 'pointer' }}
                            >
                              <div style={{ fontWeight: 'bold', color: '#2563EB', fontSize: '13px' }}>
                                {pi.piNo}
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', fontWeight: '600', color: '#1E293B' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontWeight: '700', color: '#0F172A' }}>{pi.vendor || pi.customerName || 'Direct Customer'}</span>
                                {pi.contactPerson && <span style={{ fontSize: '11px', color: '#64748B' }}>Attn: {pi.contactPerson}</span>}
                              </div>
                              <div style={{ marginTop: '3px' }}>
                                <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', border: '1px solid #A5F3FC', padding: '1px 7px', borderRadius: '50px', display: 'inline-block' }}>
                                  {normalizePaymentTerm(pi.paymentTerms || pi.paymentType)}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#475569' }}>{pi.gstNo || '—'}</td>
                            <td style={{ padding: '12px 14px', color: '#64748B' }}>{pi.piDate}</td>
                            <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#0F172A', textAlign: 'right' }}>{pi.amount}</td>
                            
                            {/* Pill status badge with bullet dot & clickable BOM link */}
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                                <span style={{ backgroundColor: statusBg, color: statusFg, padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusFg }}></span>
                                  {displayStatus}
                                </span>
                                {isConverted && (
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    {matchedBoms.map((b, bIdx) => {
                                      const bCode = b.bomCode || b.code || b.id;
                                      return (
                                        <button
                                          key={bIdx}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', { 
                                              detail: { tab: 'Sales BOM', targetBom: bCode } 
                                            }));
                                            if (typeof onNavigateTab === 'function') {
                                              onNavigateTab('Sales BOM');
                                            }
                                          }}
                                          title={`View ${bCode} in Sales BOM`}
                                          style={{
                                            backgroundColor: '#0E7490',
                                            color: '#FFFFFF',
                                            border: 'none',
                                            fontSize: '11px',
                                            fontWeight: '800',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            boxShadow: '0 1px 3px rgba(14,116,144,0.3)',
                                            transition: 'transform 0.1s ease'
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
                                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                          <Boxes size={12} style={{ marginRight: '3px' }} />
                                          {bCode} ↗
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {Boolean(pi.zohoSynced) && (
                                  <span
                                    title={`Synced to Zoho Books as Quote #${pi.zohoEstimateNo || pi.piNo}`}
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: '700',
                                      color: '#047857',
                                      backgroundColor: '#ECFDF5',
                                      border: '1px solid #A7F3D0',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      marginTop: '2px'
                                    }}
                                  >
                                    <CheckCircle size={10} style={{ color: '#10B981' }} /> Zoho Synced
                                  </span>
                                )}
                                {!hasSavedBom && isConverted && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleConvertToBom(pi);
                                    }}
                                    title="Complete and save BOM order for this PI"
                                    style={{
                                      backgroundColor: '#F59E0B',
                                      color: '#FFFFFF',
                                      border: 'none',
                                      fontSize: '10.5px',
                                      fontWeight: '800',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                  >
                                    Complete BOM →
                                  </button>
                                )}
                                {isDraft && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReleaseDraftPi(pi);
                                    }}
                                    title="Complete and Release this Proforma Invoice"
                                    style={{
                                      backgroundColor: '#10B981',
                                      color: '#FFFFFF',
                                      border: 'none',
                                      fontSize: '10.5px',
                                      fontWeight: '800',
                                      padding: '3px 9px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      boxShadow: '0 1px 3px rgba(16,185,129,0.3)',
                                      transition: 'transform 0.1s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                  >
                                    <CheckCircle size={11} /> Complete PI →
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Actions column removed per user request */}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                {/* 4. PAGINATION FOOTER EXACT MATCHING STANDARD RULES */}
                {!tableLoading && filteredPIList.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', fontSize: '13px', color: '#64748b', borderTop: '1px solid #f1f5f9', backgroundColor: '#FFFFFF' }}>
                    {/* Left Side: Rows per page selector + Showing X to Y of Z entries */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Showing per page</span>
                        <select id="performa-invoice-rows-per-page" name="rowsPerPage" aria-label="RowsPerPage"
                          value={rowsPerPage}
                          onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                          style={{ height: '32px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', padding: '0 8px', backgroundColor: 'white', fontWeight: 'bold' }}
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                        </select>
                      </div>
                      <span>Showing {indexOfFirstRow + 1} to {Math.min(indexOfLastRow, filteredPIList.length)} of {filteredPIList.length} entries</span>
                    </div>

                    {/* Right Side: Page navigation controls adjacent to Go to page input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(1)}
                          style={{ border: '1px solid #E2E8F0', background: currentPage === 1 ? '#F8FAFC' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
                        >
                          &laquo;
                        </button>
                        <button
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          style={{ border: '1px solid #E2E8F0', background: currentPage === 1 ? '#F8FAFC' : 'white', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                        >
                          &lt;
                        </button>

                        {(() => {
                          let start = Math.max(1, currentPage - 1);
                          let end = start + 2;
                          if (end > totalPages) {
                            end = totalPages;
                            start = Math.max(1, end - 2);
                          }
                          return Array.from({ length: Math.max(1, end - start + 1) }, (_, i) => start + i).map(page => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              style={{
                                border: '1px solid #E2E8F0',
                                background: page === currentPage ? '#0E7490' : 'white',
                                color: page === currentPage ? 'white' : '#475569',
                                cursor: 'pointer',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontWeight: page === currentPage ? 'bold' : '500'
                              }}
                            >
                              {page}
                            </button>
                          ));
                        })()}

                        <button
                          disabled={currentPage === totalPages || totalPages === 0}
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          style={{ border: '1px solid #E2E8F0', background: (currentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B' }}
                        >
                          &gt;
                        </button>
                        <button
                          disabled={currentPage === totalPages || totalPages === 0}
                          onClick={() => setCurrentPage(totalPages)}
                          style={{ border: '1px solid #E2E8F0', background: (currentPage === totalPages || totalPages === 0) ? '#F8FAFC' : 'white', cursor: (currentPage === totalPages || totalPages === 0) ? 'not-allowed' : 'pointer', padding: '6px 8px', borderRadius: '6px', color: '#64748B', fontWeight: 'bold' }}
                        >
                          &raquo;
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#64748B' }}>Go to page</span>
                        <input name="pageJump" aria-label="PageJump"
                          type="number"
                          min="1"
                          max={totalPages || 1}
                          defaultValue={currentPage}
                          id="pi-goto-page-input"
                          style={{ width: '42px', height: '32px', border: '1px solid #CBD5E1', borderRadius: '6px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}
                         />
                        <button
                          onClick={() => {
                            const val = parseInt(document.getElementById('pi-goto-page-input')?.value || '1', 10);
                            if (val >= 1 && val <= totalPages) setCurrentPage(val);
                          }}
                          style={{ height: '32px', padding: '0 10px', border: '1px solid #CBD5E1', borderRadius: '6px', backgroundColor: '#FFFFFF', color: '#0E7490', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                        >
                          Go &rsaquo;
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Floating Selection Toolbar (Single line, direct action buttons, no 3-dot menu) */}
            {selectedPIs.length > 0 && !selectedPi && !printModalPi && !validationAlert && (
              <div style={{
                position: 'fixed',
                bottom: '24px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '50px',
                boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                padding: '8px 16px',
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'nowrap',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                gap: '8px',
                zIndex: 10000,
                width: 'max-content',
                maxWidth: 'calc(100vw - 32px)',
                overflowX: 'auto',
                fontFamily: "'Plus Jakarta Sans', sans-serif"
              }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: '4px', paddingRight: '6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <strong style={{ color: '#0F172A', fontSize: '14px' }}>{selectedPIs.length}</strong> Selected
                </span>

                {/* View Details */}
                <button
                  onClick={() => {
                    if (selectedPIs.length > 1) {
                      showTopToast("You can't open details for multiple files at once. Please select a single item to view details.", 'error', 4000);
                      return;
                    }
                    const target = piList.find(p => p.piNo === selectedPIs[0]);
                    setSelectedPIs([]);
                    if (target) setSelectedPi(target);
                  }}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    color: '#1E293B',
                    borderRadius: '10px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                >
                  <Eye size={14} style={{ color: '#0E7490' }} /> View Details
                </button>

                {/* Convert to BOM / View BOM button */}
                {(() => {
                  const target = selectedPIs.length === 1 ? piList.find(p => p.piNo === selectedPIs[0]) : null;
                  if (!target || target.status === 'Cancelled') return null;

                  if (target.status === 'Draft' || target.statusType === 'draft') {
                    return (
                      <button
                        onClick={() => {
                          setSelectedPIs([]);
                          handleReleaseDraftPi(target);
                        }}
                        style={{
                          backgroundColor: '#10B981',
                          border: 'none',
                          color: '#FFFFFF',
                          borderRadius: '10px',
                          padding: '6px 16px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10B981'}
                      >
                        <CheckCircle size={14} style={{ color: '#FFFFFF' }} /> Complete & Release PI →
                      </button>
                    );
                  }
                  const matchedBoms = getConvertedBomsForPi(target);
                  const hasSavedBom = matchedBoms.length > 0;
                  const isConverted = hasSavedBom;

                  const firstBomCode = matchedBoms[0]?.bomCode || matchedBoms[0]?.code || matchedBoms[0]?.id;
                  const isPushed = Boolean(target.zohoSynced);
                  const isCurrentlyPushing = syncingPiNo === target.piNo;

                  return (
                    <React.Fragment key={target.piNo}>
                      {isConverted ? (
                        <button
                          onClick={() => {
                            setSelectedPIs([]);
                            window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', { 
                              detail: { tab: 'Sales BOM', targetBom: firstBomCode } 
                            }));
                            if (typeof onNavigateTab === 'function') {
                              onNavigateTab('Sales BOM');
                            }
                          }}
                          style={{
                            backgroundColor: '#059669',
                            border: 'none',
                            color: '#FFFFFF',
                            borderRadius: '10px',
                            padding: '6px 16px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.3)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Layers size={14} style={{ color: '#FFFFFF' }} /> View {firstBomCode} ↗
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedPIs([]);
                            handleConvertToBom(target);
                          }}
                          style={{
                            backgroundColor: '#4F46E5',
                            border: 'none',
                            color: '#FFFFFF',
                            borderRadius: '10px',
                            padding: '6px 16px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            boxShadow: '0 2px 4px rgba(79, 70, 229, 0.3)',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4338CA'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4F46E5'}
                        >
                          <Layers size={14} style={{ color: '#FFFFFF' }} /> Convert to BOM
                        </button>
                      )}

                      <button
                        onClick={() => syncPiToZoho(target)}
                        disabled={isCurrentlyPushing}
                        style={{
                          backgroundColor: isPushed ? '#F0FDF4' : '#0E7490',
                          border: isPushed ? '1px solid #86EFAC' : 'none',
                          color: isPushed ? '#15803D' : '#FFFFFF',
                          borderRadius: '10px',
                          padding: '6px 16px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: isCurrentlyPushing ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          boxShadow: isPushed ? 'none' : '0 2px 4px rgba(14, 116, 144, 0.3)',
                          transition: 'all 0.15s ease',
                          opacity: isCurrentlyPushing ? 0.7 : 1
                        }}
                        title={isPushed ? `Already pushed to Zoho Books as Quote #${target.zohoEstimateNo || target.piNo}. Click to re-sync.` : 'Push this Proforma Invoice to Zoho Books as a Quote'}
                      >
                        {isCurrentlyPushing ? (
                          <>
                            <RotateCcw size={14} className="animate-spin" style={{ color: isPushed ? '#15803D' : '#FFFFFF' }} /> Pushing to Zoho...
                          </>
                        ) : isPushed ? (
                          <>
                            <CheckCircle size={14} style={{ color: '#16A34A' }} /> Zoho Synced ({target.zohoEstimateNo || target.piNo})
                          </>
                        ) : (
                          <>
                            <UploadCloud size={14} style={{ color: '#FFFFFF' }} /> Push to Zoho
                          </>
                        )}
                      </button>
                    </React.Fragment>
                  );
                })()}

                {/* Edit Info */}
                {(() => {
                  const targetPiNo = selectedPIs[0];
                  const targetPi = targetPiNo ? piList.find(p => p.piNo === targetPiNo) : null;
                  const isConverted = Boolean(targetPi && (targetPi.status === 'Converted to BOM' || targetPi.convertedToBom || targetPi.convertedBomCode));
                  if (isConverted) return null;

                  return (
                    <button
                      onClick={() => {
                        if (selectedPIs.length > 1) {
                          showTopToast('You cannot edit multiple items at once. Please select 1 item.', 'error', 4000);
                        } else if (selectedPIs.length === 1) {
                          const idx = piList.findIndex(p => p.piNo === targetPiNo);
                          setSelectedPIs([]);
                          handleStartEdit(targetPi || { piNo: targetPiNo }, idx >= 0 ? idx : 0);
                        }
                      }}
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        color: '#1E293B',
                        borderRadius: '10px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        transition: 'all 0.15s ease'
                      }}
                      title="Edit Info"
                    >
                      <Edit3 size={14} style={{ color: '#0E7490' }} />
                      Edit Info
                    </button>
                  );
                })()}

                {/* Export / Print PDF */}
                <button
                  onClick={() => {
                    const target = (selectedPIs && selectedPIs.length > 0)
                      ? (piList.find(p => p.piNo === selectedPIs[0]) || { piNo: selectedPIs[0], vendor: 'Customer Reference' })
                      : null;
                    setSelectedPIs([]);
                    if (target) {
                      setPrintModalPi(target);
                    } else {
                      window.print();
                    }
                  }}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    color: '#1E293B',
                    borderRadius: '10px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                >
                  <Printer size={14} style={{ color: '#0E7490' }} /> Export / Print PDF
                </button>



                {/* Deselect All */}
                <button
                  onClick={() => setSelectedPIs([])}
                  title="Deselect all"
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    marginLeft: '2px',
                    flexShrink: 0
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ==================== VIEW 2: DEDICATED FULL-PAGE CREATOR/EDITOR VIEW ==================== */}
      {(viewMode === 'create' || viewMode === 'edit') && (() => {
        const totals = calculatePiTotals();
        const hasAnyPreset = (piItems || []).some(it => it.isPresetItem);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', fontFamily: "'DM Sans', sans-serif", backgroundColor: '#F8FAFC', padding: '24px', borderRadius: '16px', boxSizing: 'border-box' }}>

            {/* Top Page Title Bar with Action Buttons matching BOM */}
            <div
              style={{
                background: 'linear-gradient(135deg, #075985 0%, #0E7490 50%, #0891B2 100%)',
                borderRadius: '18px',
                padding: '24px 28px',
                color: '#FFFFFF',
                boxShadow: '0 10px 25px -5px rgba(14, 116, 144, 0.4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.18)',
                    backdropFilter: 'blur(6px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FileCheck style={{ width: '24px', height: '24px', color: '#FFFFFF' }} />
                </div>
                <div>
                  <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#FFFFFF', margin: 0, letterSpacing: '-0.3px' }}>
                    {viewMode === 'edit' ? `Edit Proforma Invoice: ${piNumber}` : 'Create Proforma Invoice (PI)'}
                  </h1>
                  <p style={{ fontSize: '13px', color: '#CFFAFE', margin: '4px 0 0 0' }}>
                    Configure customer commercial billing, structured preset kits, freight specifications & payment terms
                  </p>
                </div>
              </div>


            </div>

            {/* SECTION 1: PI DETAILS & DATES */}
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                  1
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  PI DETAILS & DATES
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div>
                  <label htmlFor="performa-invoice-pi-date" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    PI Date
                  </label>
                  <input id="performa-invoice-pi-date" name="pIDate" aria-label="PI Date"
                    type="date"
                    readOnly
                    disabled
                    value={piDate}
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      padding: '0 14px',
                      fontSize: '13px',
                      color: '#475569',
                      backgroundColor: '#F8FAFC',
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'not-allowed'
                    }}
                   />
                </div>

                <div>
                  <label htmlFor="pi-field-validUntil" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Valid Until Date <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input name="validUntilDate" aria-label="Valid Until Date"
                    id="pi-field-validUntil"
                    type="date"
                    required
                    value={validUntilDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => {
                      const val = e.target.value;
                      const todayStr = new Date().toISOString().split('T')[0];
                      if (val && val < todayStr) {
                        setValidUntilDate(todayStr);
                      } else {
                        setValidUntilDate(val);
                      }
                    }}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                   />
                </div>

                <div>
                  <label htmlFor="performa-invoice-pi-number" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    PI Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input id="performa-invoice-pi-number" name="pINumber" aria-label="PI Number"
                      type="text"
                      readOnly
                      disabled
                      value={viewMode === 'edit' ? (piNumber || 'N/A') : 'Auto Generated'}
                      style={{
                        width: '100%',
                        height: '42px',
                        borderRadius: '10px',
                        border: '1px solid #E2E8F0',
                        padding: '0 14px',
                        fontSize: '13px',
                        fontWeight: '800',
                        color: viewMode === 'edit' ? '#0E7490' : '#059669',
                        backgroundColor: viewMode === 'edit' ? '#F8FAFC' : '#F0FDF4',
                        outline: 'none',
                        boxSizing: 'border-box',
                        cursor: 'not-allowed'
                      }}
                     />
                  </div>
                </div>

                <div>
                  <label htmlFor="performa-invoice-sales-executive" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Sales Executive
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input id="performa-invoice-sales-executive" name="salesExecutive" aria-label="Sales Executive"
                      type="text"
                      readOnly
                      disabled
                      value={salesPerson || getActiveUserName()}
                      style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', fontWeight: '600', color: '#475569', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box', cursor: 'not-allowed' }}
                     />
                  </div>
                </div>
              </div>

              {/* Row 2: Payment Terms & Logistics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
                <div>
                  <label htmlFor="performa-invoice-payment-terms" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Payment Terms
                  </label>
                  <select id="performa-invoice-payment-terms" name="paymentTerms" aria-label="Payment Terms"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="100% Paid">100% Paid</option>
                    <option value="Partial Paid">Partial Paid</option>
                    <option value="Payment While Dispatch">Payment While Dispatch</option>
                    <option value="Credit Payment">Credit Payment</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="performa-invoice-transport-scope" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Transport Scope
                  </label>
                  <select id="performa-invoice-transport-scope" name="transportScope" aria-label="Transport Scope"
                    value={transportScope}
                    onChange={(e) => setTransportScope(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="VRM Structures">VRM Structures</option>
                    <option value="Customer Scope">Customer Scope</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="performa-invoice-transport-mode" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Transport Mode
                  </label>
                  <select id="performa-invoice-transport-mode" name="transportMode" aria-label="Transport Mode"
                    value={transportMode}
                    onChange={(e) => setTransportMode(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="Transport">Transport</option>
                    <option value="Own Vehicle">Own Vehicle</option>
                    <option value="Porter">Porter</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="performa-invoice-transporter-name" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Transporter Name
                  </label>
                  <input id="performa-invoice-transporter-name" name="transporterName" aria-label="Transporter Name"
                    type="text"
                    value={transporterName}
                    placeholder="e.g. VRL Logistics, SafeXpress..."
                    onChange={(e) => setTransporterName(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                   />
                </div>

                <div>
                  <label htmlFor="performa-invoice-destination" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Destination
                  </label>
                  <input id="performa-invoice-destination" name="destination" aria-label="Destination"
                    type="text"
                    value={destination}
                    placeholder="e.g. Coimbatore, Hyderabad, Site Location (Optional)..."
                    onChange={(e) => setDestination(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                   />
                </div>
              </div>
            </div>

            {/* SECTION 2: CUSTOMER INFORMATION & ADDRESSES (NO DELIVERY PROOF AS INSTRUCTED) */}
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                  2
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  CUSTOMER INFORMATION & ADDRESSES
                </h3>
              </div>

              {/* Row 1: Customer Contact details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div ref={customerDropdownRef} style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Company Name <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input name="orCompany" aria-label="Type or select company"
                      id="pi-field-vendorName"
                      type="text"
                      autoComplete="off"
                      placeholder="Type or select company..."
                      value={vendorName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVendorName(val);
                        setIsCustomerDropdownOpen(true);
                        const q = val.trim();
                        if (q.length >= 2) {
                          if (searchCustTimerRef.current) clearTimeout(searchCustTimerRef.current);
                          searchCustTimerRef.current = setTimeout(async () => {
                            try {
                              const matches = await searchCustomers({ query: q, limit: 50 });
                              if (Array.isArray(matches) && matches.length > 0) {
                                setCustomerList(prev => {
                                  const map = new Map();
                                  (prev || []).forEach(p => {
                                    const k = (p.customerCode || p.id || p.companyName || p.name || '').toLowerCase().trim();
                                    if (k) map.set(k, p);
                                  });
                                  matches.forEach(m => {
                                    const k = (m.customerCode || m.id || m.companyName || m.name || '').toLowerCase().trim();
                                    if (k && !map.has(k)) map.set(k, m);
                                  });
                                  return Array.from(map.values());
                                });
                              }
                            } catch (_) {}
                          }, 250);
                        }
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      onBlur={() => {
                        const clean = (vendorName || '').trim().toLowerCase();
                        if (clean) {
                          const match = (customerList || []).find(c => {
                            const cComp = (c.companyName || c.name || c.c2 || '').toLowerCase().trim();
                            return cComp === clean;
                          });
                          if (match) {
                            handleSelectCustomer(match);
                          }
                        }
                      }}
                      style={{
                        width: '100%',
                        height: '42px',
                        borderRadius: '10px',
                        border: isCustomerDropdownOpen ? '1.5px solid #0E7490' : '1px solid #E2E8F0',
                        padding: '0 36px 0 14px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#0F172A',
                        outline: 'none',
                        boxSizing: 'border-box',
                        backgroundColor: '#FFFFFF',
                        boxShadow: isCustomerDropdownOpen ? '0 0 0 3px rgba(14, 116, 144, 0.1)' : 'none'
                      }}
                     />
                    <button
                      type="button"
                      onClick={() => setIsCustomerDropdownOpen(prev => !prev)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#64748B'
                      }}
                      title="Toggle customer list"
                    >
                      <ChevronDown size={16} style={{ transform: isCustomerDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                    </button>
                  </div>

                  {/* Custom Searchable Scrollable Dropdown List with ALL 61+ Customers */}
                  {isCustomerDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      backgroundColor: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                      zIndex: 9999,
                      maxHeight: '280px',
                      overflowY: 'auto',
                      padding: '4px'
                    }}>
                      <div style={{
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#64748B',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '6px',
                        marginBottom: '4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>SHOWING {filteredCustomerSuggestions.length} OF {uniqueCustomerList.length} REGISTERED CUSTOMERS</span>
                        {vendorName && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVendorName('');
                            }}
                            style={{ border: 'none', background: 'transparent', color: '#0E7490', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {filteredCustomerSuggestions.length === 0 ? (
                        <div style={{ padding: '14px', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>
                          No matching customers found for "{vendorName}". You can continue typing to use this new company.
                        </div>
                      ) : (
                        filteredCustomerSuggestions.map((c, idx) => {
                          const name = (c.companyName || c.name || c.c2 || c.code || '').trim();
                          const gst = c.gst || c.gstNumber || c.gstNo || c.gstin;
                          const contact = c.contact || c.contactPerson || c.primaryContact?.name;
                          const phone = c.phone || c.mobile || c.primaryContact?.phone;
                          const city = c.city || c.billingAddressObj?.city;
                          const isSelected = name.toLowerCase() === (vendorName || '').toLowerCase().trim();

                          return (
                            <div
                              key={idx}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectCustomer(c);
                                setIsCustomerDropdownOpen(false);
                              }}
                              onClick={() => {
                                handleSelectCustomer(c);
                                setIsCustomerDropdownOpen(false);
                              }}
                              style={{
                                padding: '9px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                backgroundColor: isSelected ? '#ECFEFF' : 'transparent',
                                borderLeft: isSelected ? '3px solid #0E7490' : '3px solid transparent',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'background-color 0.1s ease',
                                gap: '8px'
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '13px', fontWeight: '700', color: isSelected ? '#0E7490' : '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {name}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  {contact && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><User size={11} style={{ color: '#64748B' }} /> {contact}</span>}
                                  {phone && <span>📞 {phone}</span>}
                                  {city && <span>📍 {city}</span>}
                                </div>
                              </div>
                              {gst && (
                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#0369A1', backgroundColor: '#E0F2FE', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                  GST: {gst}
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="performa-invoice-customer-name" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Customer Name
                  </label>
                  <input id="performa-invoice-customer-name" name="customerName" aria-label="Customer Name"
                    type="text"
                    placeholder="e.g. Rajesh Kannan"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                   />
                </div>

                <div>
                  <label htmlFor="pi-field-phone" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Phone Number
                  </label>
                  <input name="phoneNumber" aria-label="Phone Number"
                    id="pi-field-phone"
                    type="text"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                   />
                </div>

                <div>
                  <label htmlFor="performa-invoice-email-address" style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input id="performa-invoice-email-address" name="emailAddress" aria-label="Email Address"
                    type="email"
                    placeholder="accounts@solarclient.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                   />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', margin: 0 }}>
                      Customer GSTIN
                    </label>
                    {Boolean(gstNo && gstNo.trim().length >= 2 && GST_STATE_MAP[gstNo.trim().substring(0, 2)]) && (
                      <span style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700' }}>
                        State: {GST_STATE_MAP[gstNo.trim().substring(0, 2)]}
                      </span>
                    )}
                  </div>
                  <input id="performa-invoice-33aabcv1234f1z5" name="33AABCV1234F1Z5" aria-label="33AABCV1234F1Z5"
                    type="text"
                    placeholder="e.g. 33AABCV1234F1Z5"
                    value={gstNo}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setGstNo(val);
                      if (val.trim().length >= 2) {
                        const sCode = val.trim().substring(0, 2);
                        const mappedState = GST_STATE_MAP[sCode];
                        if (mappedState && (!billingState || billingState.trim() === '')) {
                          setBillingState(mappedState);
                          if (sameAsBilling) setDeliveryState(mappedState);
                        }
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '42px',
                      borderRadius: '10px',
                      border: (gstNo && gstNo.trim().length >= 2 && GST_STATE_MAP[gstNo.trim().substring(0, 2)] && billingState && billingState.trim() && GST_STATE_MAP[gstNo.trim().substring(0, 2)].toLowerCase() !== billingState.trim().toLowerCase()) ? '1.5px solid #F87171' : '1px solid #E2E8F0',
                      padding: '0 14px',
                      fontSize: '13px',
                      fontWeight: '700',
                      color: '#0F172A',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                   />
                  {Boolean(
                    gstNo && gstNo.trim().length >= 2 &&
                    GST_STATE_MAP[gstNo.trim().substring(0, 2)] &&
                    billingState && billingState.trim() &&
                    GST_STATE_MAP[gstNo.trim().substring(0, 2)].toLowerCase() !== billingState.trim().toLowerCase()
                  ) && (
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#B91C1C', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span>⚠️ GST code ({gstNo.trim().substring(0, 2)}) is for <strong>{GST_STATE_MAP[gstNo.trim().substring(0, 2)]}</strong>, but Billing State is <strong>{billingState}</strong>.</span>
                      <button
                        type="button"
                        onClick={() => {
                          const correct = GST_STATE_MAP[gstNo.trim().substring(0, 2)];
                          setBillingState(correct);
                          if (sameAsBilling) setDeliveryState(correct);
                        }}
                        style={{ backgroundColor: '#DC2626', color: 'white', border: 'none', borderRadius: '5px', padding: '3px 8px', fontSize: '10.5px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Sync to {GST_STATE_MAP[gstNo.trim().substring(0, 2)]}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Dual Addresses Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* Billing Address Card */}
                <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                      <Building2 size={14} color="#0E7490" />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Official Billing Address</h4>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Primary address for invoices & commercial records</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label htmlFor="pi-field-billingStreet" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Street / Premises Address</label>
                      <input name="streetPremisesAddress" aria-label="Street / Premises Address"
                        id="pi-field-billingStreet"
                        type="text"
                        placeholder="Plot No, Industrial Estate, Landmark..."
                        value={billingStreet}
                        onChange={(e) => {
                          setBillingStreet(e.target.value);
                          if (sameAsBilling) setDeliveryStreet(e.target.value);
                        }}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                       />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '10px' }}>
                      <div>
                        <label htmlFor="pi-field-billingCity" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                        <input name="city" aria-label="City"
                          id="pi-field-billingCity"
                          type="text"
                          placeholder="City"
                          value={billingCity}
                          onChange={(e) => {
                            setBillingCity(e.target.value);
                            if (sameAsBilling) setDeliveryCity(e.target.value);
                          }}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="pi-field-billingState" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                        <input name="state" aria-label="State"
                          id="pi-field-billingState"
                          type="text"
                          placeholder="State"
                          value={billingState}
                          onChange={(e) => {
                            setBillingState(e.target.value);
                            if (sameAsBilling) setDeliveryState(e.target.value);
                          }}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="pi-field-billingPincode" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>PIN Code</label>
                        <input name="pINCode" aria-label="PIN Code"
                          id="pi-field-billingPincode"
                          type="text"
                          placeholder="600001"
                          value={billingPincode}
                          onChange={(e) => {
                            setBillingPincode(e.target.value);
                            if (sameAsBilling) setDeliveryPincode(e.target.value);
                          }}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: 'white' }}
                         />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Address Card */}
                <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '7px', backgroundColor: '#ECFEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0E7490' }}>
                        <Truck size={14} color="#0E7490" />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Consignee / Delivery Site Address</h4>
                        <span style={{ fontSize: '11px', color: '#64748B' }}>Site dispatch location</span>
                      </div>
                    </div>
                    <label htmlFor="performa-invoice-same-as-billing" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', color: '#0E7490', cursor: 'pointer', backgroundColor: '#ECFEFF', padding: '4px 10px', borderRadius: '6px', border: '1px solid #A5F3FC' }}>
                      <input id="performa-invoice-same-as-billing" name="sameAsBilling" aria-label="SameAsBilling"
                        type="checkbox"
                        checked={sameAsBilling}
                        onChange={(e) => {
                          const isSame = e.target.checked;
                          setSameAsBilling(isSame);
                          if (isSame) {
                            setDeliveryStreet(billingStreet);
                            setDeliveryCity(billingCity);
                            setDeliveryState(billingState);
                            setDeliveryPincode(billingPincode);
                          }
                        }}
                        style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                       />
                      Same as Billing Address
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label htmlFor="pi-field-deliveryStreet" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Site / Dispatch Location Address</label>
                      <input name="input2" aria-label="Site / Dispatch Location Address"
                        id="pi-field-deliveryStreet"
                        type="text"
                        disabled={sameAsBilling}
                        placeholder="Solar Project Site, Survey No, Village..."
                        value={sameAsBilling ? billingStreet : deliveryStreet}
                        onChange={(e) => setDeliveryStreet(e.target.value)}
                        style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: sameAsBilling ? '#F1F5F9' : 'white', cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                       />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '10px' }}>
                      <div>
                        <label htmlFor="pi-field-deliveryCity" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City / District</label>
                        <input name="cityDistrict" aria-label="City / District"
                          id="pi-field-deliveryCity"
                          type="text"
                          disabled={sameAsBilling}
                          placeholder="City"
                          value={sameAsBilling ? billingCity : deliveryCity}
                          onChange={(e) => setDeliveryCity(e.target.value)}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: sameAsBilling ? '#F1F5F9' : 'white', cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="performa-invoice-state" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                        <input id="performa-invoice-state" name="state" aria-label="State"
                          type="text"
                          disabled={sameAsBilling}
                          placeholder="State"
                          value={sameAsBilling ? billingState : deliveryState}
                          onChange={(e) => setDeliveryState(e.target.value)}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: sameAsBilling ? '#F1F5F9' : 'white', cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                         />
                      </div>
                      <div>
                        <label htmlFor="performa-invoice-pin-code" style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>PIN Code</label>
                        <input id="performa-invoice-pin-code" name="pINCode" aria-label="PIN Code"
                          type="text"
                          disabled={sameAsBilling}
                          placeholder="600001"
                          value={sameAsBilling ? billingPincode : deliveryPincode}
                          onChange={(e) => setDeliveryPincode(e.target.value)}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: sameAsBilling ? '#F1F5F9' : 'white', cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                         />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 3: ORDER ITEMS & BILL OF MATERIALS */}
            <div id="pi-field-items" style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
              {/* Section 3 Header — Clean Single Row */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px', gap: '20px', flexWrap: 'wrap', borderBottom: '1px solid #F1F5F9' }}>
                {/* Left: Badge + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: 'auto' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>3</div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ORDER ITEMS & BILL OF MATERIALS</span>
                </div>

                {/* Preset Pill */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', backgroundColor: '#ECFEFF', padding: '0 16px', borderRadius: '20px', height: '40px', border: '1px solid #CFFAFE' }}>
                  <Layers style={{ width: '15px', height: '15px', color: '#0E7490' }} />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0E7490' }}>Preset:</span>
                </div>

                {/* Searchable Preset Selector */}
                <SearchablePresetSelector
                  value={selectedPreset}
                  activePresetsMap={activePresetsMap}
                  accentColor="#0E7490"
                  width="380px"
                  placeholder="Pick a Preset to add..."
                  style={{ height: '40px' }}
                  onChange={(val, targetPreset) => {
                    if (val && targetPreset && targetPreset.items) {
                      handleAddPresetToOrder(val, targetPreset, 1);
                    } else if (!val) {
                      setSelectedPreset('');
                    }
                  }}
                />

                {/* Clear Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedItemIndexes.length > 0) {
                      setPiItems(prev => prev.filter((_, idx) => !selectedItemIndexes.includes(idx)));
                      setSelectedItemIndexes([]);
                    } else {
                      if (piItems.length > 0) setShowClearConfirmModal(true);
                    }
                  }}
                  title={selectedItemIndexes.length > 0 ? `Remove ${selectedItemIndexes.length} selected item(s)` : 'Clear all order items'}
                  style={{ border: 'none', backgroundColor: selectedItemIndexes.length > 0 ? '#EF4444' : '#FFE4E6', color: selectedItemIndexes.length > 0 ? 'white' : '#E11D48', width: '40px', height: '40px', borderRadius: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
                >
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              </div>

              {/* Active Preset Badges / Pills */}
              {Object.values(presetGroups).length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '12px 24px 0 24px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B' }}>Active Presets in Order:</span>
                  {Object.values(presetGroups).map(grp => (
                    <span
                      key={grp.groupId}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: '#ECFEFF',
                        color: '#0E7490',
                        border: '1px solid #A5F3FC',
                        borderRadius: '16px',
                        padding: '4px 10px',
                        fontSize: '12px',
                        fontWeight: '700'
                      }}
                    >
                      <Layers size={13} style={{ color: '#0E7490' }} />
                      {grp.presetName} ({grp.setCount} Set{grp.setCount > 1 ? 's' : ''})
                      <button
                        type="button"
                        onClick={() => handleAddPresetItem(grp.groupId)}
                        style={{
                          border: 'none',
                          backgroundColor: '#0E7490',
                          color: '#FFFFFF',
                          borderRadius: '4px',
                          fontSize: '10.5px',
                          fontWeight: '700',
                          padding: '1px 6px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                          marginLeft: '2px'
                        }}
                        title={`Add extra item bundled into ${grp.presetName}`}
                      >
                        <Plus size={11} /> Add Item
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePresetGroup(grp.groupId)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 0 0 2px', display: 'flex', alignItems: 'center', color: '#0891B2' }}
                        title={`Remove ${grp.presetName}`}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Section 3 Content */}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Items Table */}
              <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ color: '#475569', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={{ padding: '12px 14px', width: '30px', textAlign: 'center' }}>
                        <input id="performa-invoice-checkbox" name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
                          type="checkbox"
                          checked={piItems.length > 0 && selectedItemIndexes.length === piItems.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItemIndexes(piItems.map((_, idx) => idx));
                            } else {
                              setSelectedItemIndexes([]);
                            }
                          }}
                          style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                         />
                      </th>
                      <th style={{ padding: '12px 10px', fontWeight: '700', width: '30%' }}>Product / Item <span style={{ color: '#EF4444' }}>*</span></th>
                      <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%' }}>UOM</th>
                      <th style={{ padding: '12px 10px', fontWeight: '700', width: '8%', textAlign: 'center' }}>Qty <span style={{ color: '#EF4444' }}>*</span></th>
                      <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%' }}>Price (₹) <span style={{ color: '#EF4444' }}>*</span></th>
                      <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%', textAlign: 'center' }}>GST Rate</th>
                      {hasAnyPreset && (
                        <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%', color: '#0E7490', backgroundColor: '#ECFEFF' }}>
                          Preset Amt (₹) <span style={{ color: '#EF4444' }}>*</span>
                        </th>
                      )}
                      <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%', textAlign: 'right' }}>Taxable (₹)</th>
                      <th style={{ padding: '12px 10px', fontWeight: '700', width: '11%', textAlign: 'right' }}>Total (₹)</th>
                      <th style={{ padding: '12px 10px', fontWeight: '700', width: '4%', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {piItems.length === 0 ? (
                      <tr>
                        <td colSpan={hasAnyPreset ? 10 : 9} style={{ padding: '48px 16px', textAlign: 'center', color: '#94A3B8' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Boxes size={28} style={{ color: '#CBD5E1' }} />
                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748B' }}>No products or materials in Proforma Invoice</span>
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Select an engineering Preset above or click "Add Product / Item" to author PI line items</span>
                          </div>
                        </td>
                      </tr>
                    ) : (() => {
                      const distinctPresetGroupIds = [];
                      piItems.forEach(it => {
                        if (it.isPresetItem && it.presetGroupId && !distinctPresetGroupIds.includes(it.presetGroupId)) {
                          distinctPresetGroupIds.push(it.presetGroupId);
                        }
                      });

                      return piItems.map((item, i) => {
                        const isChecked = selectedItemIndexes.includes(i);
                        const isPresetItem = Boolean(item.isPresetItem);
                        const groupId = item.presetGroupId;
                        const currentGroup = groupId ? (presetGroups[groupId] || { kitPrice: '', setCount: 1, presetName: item.presetName }) : null;

                        const groupIndex = groupId ? distinctPresetGroupIds.indexOf(groupId) : -1;
                        const presetNumber = groupIndex >= 0 ? groupIndex + 1 : 1;
                        const theme = groupIndex >= 0 ? getPresetTheme(groupIndex) : PRESET_THEMES[0];

                        let isFirstInGroup = false;
                        let groupCount = 0;
                        let itemIndexInGroup = 0;
                        if (isPresetItem && groupId) {
                          const itemsInGroup = piItems.filter(it => it.presetGroupId === groupId);
                          groupCount = itemsInGroup.length;
                          isFirstInGroup = piItems.findIndex(it => it.presetGroupId === groupId) === i;
                          itemIndexInGroup = itemsInGroup.findIndex(it => it === item) + 1;
                        }

                        const customItems = piItems.filter(it => !it.isPresetItem);
                        const isFirstCustomItem = !isPresetItem && piItems.findIndex(it => !it.isPresetItem) === i;
                        const customIndex = !isPresetItem ? customItems.findIndex(it => it === item) + 1 : null;

                        const displaySNo = isPresetItem && distinctPresetGroupIds.length > 0
                          ? `${presetNumber}.${itemIndexInGroup}`
                          : (customIndex !== null ? (distinctPresetGroupIds.length > 0 ? `C.${customIndex}` : `${i + 1}`) : `${i + 1}`);

                        const q = parseFloat(item.qty) || 0;
                        const r = parseFloat(item.rate) || 0;
                        const taxable = isPresetItem ? 0 : q * r;
                        const gstPct = parseFloat(String(item.gstRate || '18%').replace('%', '')) || 18;
                        const itemTotal = taxable + (taxable * (gstPct / 100));

                        return (
                          <React.Fragment key={i}>
                            {isFirstInGroup && (
                              <tr key={`preset-hdr-${groupId}`} style={{ backgroundColor: theme.bg, borderTop: `2.5px solid ${theme.primary}`, borderBottom: `1.5px solid ${theme.border}` }}>
                                <td colSpan={hasAnyPreset ? 10 : 9} style={{ padding: '8px 14px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        backgroundColor: theme.primary,
                                        color: '#FFFFFF',
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        letterSpacing: '0.5px'
                                      }}>
                                        <Boxes size={12} />
                                        {theme.badge}
                                      </span>
                                      <strong style={{ fontSize: '13px', color: '#0F172A', fontWeight: '800' }}>
                                        {currentGroup?.presetName || item.presetName || 'Structure Kit'}
                                      </strong>
                                      <span style={{
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        padding: '1px 8px',
                                        borderRadius: '10px',
                                        backgroundColor: theme.tagBg,
                                        color: theme.tagText,
                                        border: `1px solid ${theme.border}`
                                      }}>
                                        {currentGroup?.setCount || 1} Set{(currentGroup?.setCount || 1) > 1 ? 's' : ''} ({groupCount} components)
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>
                                        Kit Amount: <strong style={{ color: theme.primary, fontSize: '12px' }}>₹ {Number(currentGroup?.kitPrice || 0).toLocaleString('en-IN')}</strong> + {currentGroup?.gstRate || '18%'} GST
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleAddPresetItem(groupId)}
                                        style={{
                                          padding: '2px 8px',
                                          fontSize: '11px',
                                          fontWeight: '700',
                                          color: theme.primary,
                                          backgroundColor: '#FFFFFF',
                                          border: `1px solid ${theme.border}`,
                                          borderRadius: '6px',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px'
                                        }}
                                        title={`Add component row to ${theme.badge}`}
                                      >
                                        <Plus size={11} /> Add to {theme.badge}
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                            {isFirstCustomItem && distinctPresetGroupIds.length > 0 && (
                              <tr key="custom-items-banner" style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #64748B', borderBottom: '1px solid #CBD5E1' }}>
                                <td colSpan={hasAnyPreset ? 10 : 9} style={{ padding: '8px 14px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: '#475569',
                                      color: '#FFFFFF',
                                      fontSize: '11px',
                                      fontWeight: '800',
                                      letterSpacing: '0.5px'
                                    }}>
                                      CUSTOM ITEMS
                                    </span>
                                    <strong style={{ fontSize: '12px', color: '#334155' }}>
                                      Additional Materials / Custom Products ({customItems.length} items)
                                    </strong>
                                  </div>
                                </td>
                              </tr>
                            )}
                            <tr
                              key={i}
                              style={{
                                borderBottom: '1px solid #F1F5F9',
                                backgroundColor: isChecked ? '#ECFEFF' : (isPresetItem ? (groupIndex % 2 === 1 ? '#F5F3FF' : '#F0FDFA') : 'transparent'),
                                transition: 'background-color 0.15s ease'
                              }}
                            >
                              <td style={{
                                padding: '12px 14px',
                                textAlign: 'center',
                                borderLeft: isChecked ? '4px solid #0E7490' : (isPresetItem ? `4px solid ${theme.primary}` : '4px solid #CBD5E1')
                              }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                  <input id="performa-invoice-checkbox" name={`checkbox_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Checkbox"
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) setSelectedItemIndexes(prev => [...prev, i]);
                                      else setSelectedItemIndexes(prev => prev.filter(idx => idx !== i));
                                    }}
                                    style={{ accentColor: theme.primary, cursor: 'pointer' }}
                                  />
                                  <span style={{ fontSize: '10px', fontWeight: '800', color: isPresetItem ? theme.primary : '#64748B' }}>
                                    #{displaySNo}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 10px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <TypeableProductSelect
                                    value={item.name || ''}
                                    itemsList={itemsList}
                                    placeholder="Type or select product / item..."
                                    accentColor={theme.primary}
                                    onChange={(val, matched) => {
                                      if (!matched) {
                                        setPiItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, name: val } : mat));
                                        return;
                                      }
                                      const pName = matched.name;
                                      const pCat = matched.category || matched.description || item.category;
                                      const pCode = matched.code || matched.sku || resolveProductCode(matched) || item.code;
                                      const isSolar5 = is5PctSolarProduct(pName, pCat);
                                      let rawUom = matched.uom || matched.unit || mat.uom || 'NOS';
                                      const u = String(rawUom).trim().toUpperCase();
                                      let resolvedUom = rawUom;
                                      if (['METER', 'METERS', 'MTR', 'MTRS', 'M'].includes(u)) resolvedUom = 'MTR';
                                      else if (['PIECES', 'PIECE', 'PCS', 'PC'].includes(u)) resolvedUom = 'PCS';
                                      else if (['NUMBERS', 'NUMBER', 'NOS', 'NO'].includes(u)) resolvedUom = 'NOS';
                                      else if (['SET', 'SETS'].includes(u)) resolvedUom = 'SET';
                                      else if (['KW', 'KILOWATT', 'KILOWATTS', 'KWP'].includes(u)) resolvedUom = 'KW';
                                      setPiItems(prev => prev.map((mat, idx) => idx === i ? {
                                        ...mat,
                                        code: pCode || mat.code,
                                        name: pName,
                                        rate: matched.price || matched.rate ? String(matched.price || matched.rate) : mat.rate,
                                        uom: resolvedUom,
                                        category: pCat,
                                        gstRate: isSolar5 ? '5%' : (mat.gstRate || '18%')
                                      } : mat));
                                    }}
                                  />
                                  <input id={`performa-invoice-category-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`category_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Description / Technical specs"
                                    type="text"
                                    placeholder="Description / Technical specs..."
                                    value={item.category || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPiItems(prev => prev.map((mat, idx) => {
                                        if (idx !== i) return mat;
                                        const isSolar5 = is5PctSolarProduct(mat.name, val);
                                        return {
                                          ...mat,
                                          category: val,
                                          gstRate: isSolar5 ? '5%' : mat.gstRate
                                        };
                                      }));
                                    }}
                                    style={{ width: '100%', height: '28px', borderRadius: '6px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '11px', color: '#64748B', outline: 'none', boxSizing: 'border-box', backgroundColor: '#F8FAFC' }}
                                  />
                                  {isPresetItem && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                      <span style={{
                                        fontSize: '10px',
                                        fontWeight: '800',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        backgroundColor: theme.tagBg,
                                        color: theme.tagText,
                                        border: `1px solid ${theme.border}`,
                                        letterSpacing: '0.3px'
                                      }}>
                                        {theme.badge} • Component {itemIndexInGroup} of {groupCount}
                                      </span>
                                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={currentGroup?.presetName || item.presetName}>
                                        {currentGroup?.presetName || item.presetName}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '12px 10px' }}>
                                <select id={`performa-invoice-uom-nos-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`uomNOS_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="Uom NOS"
                                  value={item.uom || 'NOS'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPiItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, uom: val } : mat));
                                  }}
                                  style={{
                                    width: '100%',
                                    height: '38px',
                                    borderRadius: '8px',
                                    border: '1px solid #E2E8F0',
                                    padding: '0 6px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: '#0F172A',
                                    backgroundColor: '#FFFFFF',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                    cursor: 'pointer',
                                    textAlign: 'center'
                                  }}
                                >
                                  <option value="MTR">MTR (Meter)</option>
                                  <option value="PCS">PCS (Pieces)</option>
                                  <option value="NOS">NOS (Numbers)</option>
                                  <option value="SET">SET (Sets)</option>
                                  <option value="KW">KW (Kilowatt)</option>
                                  {item.uom && !['MTR', 'PCS', 'NOS', 'SET', 'KW', 'Kw'].includes(item.uom) && (
                                    <option value={item.uom}>{item.uom}</option>
                                  )}
                                </select>
                              </td>
                              <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
                                <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <input id={`performa-invoice-0-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`0_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="0"
                                    type="number"
                                    value={item.qty}
                                    placeholder="0"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPiItems(prev => prev.map((mat, idx) => {
                                        if (idx !== i) return mat;
                                        const mult = Math.max(1, parseInt(currentGroup?.setCount) || 1);
                                        const parsedVal = parseFloat(val) || 0;
                                        return {
                                          ...mat,
                                          qty: val,
                                          baseQty: isPresetItem ? (parsedVal / mult) : mat.baseQty
                                        };
                                      }));
                                    }}
                                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '13px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', fontWeight: '600', backgroundColor: '#FFFFFF' }}
                                  />
                                </div>
                              </td>
                              <td style={{ padding: '12px 10px' }}>
                                {isPresetItem ? (
                                  <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                                ) : (
                                  <input id={`performa-invoice-0-00-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`000_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="0.00"
                                    type="number"
                                    value={item.rate}
                                    placeholder="0.00"
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPiItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, rate: val } : mat));
                                    }}
                                    style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 10px', fontSize: '13px', textAlign: 'right', outline: 'none', boxSizing: 'border-box' }}
                                  />
                                )}
                              </td>
                              <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                                <select id={`performa-invoice-gst-rate-18-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`gstRate18_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="GstRate 18"
                                  value={item.gstRate || (currentGroup && currentGroup.gstRate) || '18%'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPiItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, gstRate: val } : mat));
                                  }}
                                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #C7D2FE', padding: '0 6px', fontSize: '12px', fontWeight: '700', color: '#4338CA', backgroundColor: '#EEF2FF', outline: 'none', cursor: 'pointer', textAlign: 'center' }}
                                >
                                  <option value="18%">18% GST</option>
                                  <option value="12%">12% GST</option>
                                  <option value="5%">5% GST</option>
                                  <option value="0%">0% Exempt</option>
                                </select>
                              </td>
                              {hasAnyPreset && (() => {
                                if (isPresetItem) {
                                  if (isFirstInGroup) {
                                    return (
                                      <td
                                        rowSpan={groupCount}
                                        style={{
                                          padding: '12px 10px',
                                          verticalAlign: 'middle',
                                          backgroundColor: theme.bg,
                                          borderLeft: `2px solid ${theme.border}`,
                                          borderRight: `2px solid ${theme.border}`
                                        }}
                                      >
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                          <span
                                            style={{
                                              fontSize: '11px',
                                              fontWeight: '800',
                                              color: theme.primary,
                                              textAlign: 'center',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis',
                                              whiteSpace: 'nowrap',
                                              maxWidth: '120px',
                                              display: 'block'
                                            }}
                                            title={currentGroup?.presetName}
                                          >
                                            {theme.badge}: {currentGroup?.presetName}
                                          </span>

                                          <div style={{ position: 'relative', width: '100%' }}>
                                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', fontWeight: '700', color: (!currentGroup?.kitPrice || parseFloat(currentGroup?.kitPrice) <= 0) ? '#DC2626' : theme.primary, pointerEvents: 'none' }}>₹</span>
                                            <input id="performa-invoice-0-00" name="000" aria-label="0.00"
                                              type="number"
                                              required
                                              value={currentGroup?.kitPrice || ''}
                                              placeholder="Enter Amt *"
                                              onFocus={(e) => e.target.select()}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                if (groupId) {
                                                  setPresetGroups(prev => ({
                                                    ...prev,
                                                    [groupId]: { ...(prev[groupId] || currentGroup), kitPrice: val }
                                                  }));
                                                }
                                              }}
                                              style={{
                                                width: '100%', height: '42px', borderRadius: '8px',
                                                border: (!currentGroup?.kitPrice || parseFloat(currentGroup?.kitPrice) <= 0) ? '2px solid #EF4444' : `2px solid ${theme.border}`,
                                                padding: '0 10px 0 26px',
                                                fontSize: '15px', fontWeight: '800',
                                                color: (!currentGroup?.kitPrice || parseFloat(currentGroup?.kitPrice) <= 0) ? '#DC2626' : '#0F172A',
                                                textAlign: 'right', outline: 'none', boxSizing: 'border-box',
                                                backgroundColor: (!currentGroup?.kitPrice || parseFloat(currentGroup?.kitPrice) <= 0) ? '#FEF2F2' : 'white'
                                              }}
                                            />
                                          </div>
                                          {(!currentGroup?.kitPrice || parseFloat(currentGroup?.kitPrice) <= 0) && (
                                            <span style={{ fontSize: '10px', fontWeight: '800', color: '#EF4444', textAlign: 'center' }}>
                                              * Mandatory Amount
                                            </span>
                                          )}

                                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <span style={{ fontSize: '11px', color: theme.primary, fontWeight: '700' }}>
                                              {groupCount} items ×
                                            </span>
                                            <input id="performa-invoice-set-count" name="setCount" aria-label="SetCount"
                                              type="number"
                                              min="0"
                                              max="999"
                                              value={currentGroup?.setCount !== undefined && currentGroup?.setCount !== null ? currentGroup.setCount : ''}
                                              onFocus={(e) => e.target.select()}
                                              onChange={(e) => {
                                                const rawVal = e.target.value;
                                                if (rawVal === '') {
                                                  if (groupId) {
                                                    setPresetGroups(prev => ({
                                                      ...prev,
                                                      [groupId]: { ...(prev[groupId] || currentGroup), setCount: '' }
                                                    }));
                                                  }
                                                  return;
                                                }
                                                const parsed = parseInt(rawVal);
                                                const valToSave = isNaN(parsed) ? '' : Math.max(0, parsed);
                                                if (groupId) {
                                                  setPresetGroups(prev => ({
                                                    ...prev,
                                                    [groupId]: { ...(prev[groupId] || currentGroup), setCount: valToSave }
                                                  }));
                                                }
                                                const isFixedKit = isFixedQuantityPreset(currentGroup?.presetId, currentGroup?.presetName || item.presetName);
                                                const multiplier = isFixedKit ? 1 : (isNaN(parsed) ? 0 : Math.max(0, parsed));
                                                setPiItems(prev => prev.map(mat => {
                                                  if ((mat.presetGroupId || 'legacy_default') === groupId && mat.baseQty) {
                                                    return { ...mat, qty: String(Math.round(mat.baseQty * multiplier)) };
                                                  }
                                                  return mat;
                                                }));
                                              }}
                                              style={{
                                                width: '42px', height: '26px', borderRadius: '6px',
                                                border: `1.5px solid ${theme.border}`, fontSize: '13px',
                                                fontWeight: '800', color: theme.primary, textAlign: 'center',
                                                padding: '0 2px', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box'
                                              }}
                                              title="Sets multiplier for this preset"
                                            />
                                            <span style={{ fontSize: '11px', color: theme.primary, fontWeight: '600' }}>
                                              set{(parseInt(currentGroup?.setCount) || 1) !== 1 ? 's' : ''}
                                            </span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                            <span style={{ fontSize: '10px', color: theme.primary, fontWeight: '700' }}>GST:</span>
                                            <select id={`performa-invoice-gst-rate-18-${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} name={`gstRate18_${typeof i !== 'undefined' ? i : (typeof idx !== 'undefined' ? idx : 0)}`} aria-label="GstRate 18"
                                              value={currentGroup?.gstRate || item.gstRate || '18%'}
                                              onChange={(e) => {
                                                const val = e.target.value;
                                                if (groupId) {
                                                  setPresetGroups(prev => ({
                                                    ...prev,
                                                    [groupId]: { ...(prev[groupId] || currentGroup), gstRate: val }
                                                  }));
                                                }
                                                setPiItems(prev => prev.map((mat, idx) =>
                                                  ((mat.presetGroupId || 'legacy_default') === groupId || idx === i)
                                                    ? { ...mat, gstRate: val }
                                                    : mat
                                                ));
                                              }}
                                              style={{
                                                height: '24px', borderRadius: '6px',
                                                border: `1.5px solid ${theme.border}`, padding: '0 4px',
                                                fontSize: '11px', fontWeight: '800',
                                                color: theme.primary, backgroundColor: '#FFFFFF',
                                                outline: 'none', cursor: 'pointer'
                                              }}
                                              title="Change GST Rate for this preset"
                                            >
                                              <option value="18%">18%</option>
                                              <option value="12%">12%</option>
                                              <option value="5%">5%</option>
                                              <option value="0%">0%</option>
                                            </select>
                                          </div>
                                          {groupId && (
                                            <button
                                              type="button"
                                              onClick={() => handleRemovePresetGroup(groupId)}
                                              style={{
                                                border: 'none',
                                                backgroundColor: 'transparent',
                                                color: '#EF4444',
                                                fontSize: '10px',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                marginTop: '2px'
                                              }}
                                              title={`Remove entire ${currentGroup?.presetName} preset`}
                                            >
                                              Remove Kit
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  }
                                  return null;
                                } else {
                                  return (
                                    <td style={{ padding: '12px 10px', textAlign: 'center', color: '#94A3B8', fontSize: '11px' }}>
                                      —
                                    </td>
                                  );
                                }
                              })()}
                            <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '600', color: '#334155' }}>
                              {isPresetItem ? (
                                <span style={{ fontSize: '11px', color: '#94A3B8' }}>—</span>
                              ) : (
                                `₹${taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              )}
                            </td>
                            <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                              {isPresetItem ? (
                                <span style={{ fontSize: '11px', color: '#94A3B8' }}>—</span>
                              ) : (
                                `₹${itemTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              )}
                            </td>
                            <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveMaterialRow(i)}
                                style={{
                                  border: 'none',
                                  background: '#FEF2F2',
                                  color: '#EF4444',
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#FEE2E2';
                                  e.currentTarget.style.color = '#DC2626';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#FEF2F2';
                                  e.currentTarget.style.color = '#EF4444';
                                }}
                                title="Delete Item"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    });
                  })()}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleAddMaterialRow}
                  style={{ border: '1px solid #A5F3FC', background: '#ECFEFF', color: '#0E7490', padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {hasAnyPreset ? 'Add Standalone Item' : 'Add Product / Item'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNewSetName(`Custom Set ${Object.keys(presetGroups || {}).length + 1}`);
                    setNewSetCount(1);
                    setNewSetPrice('');
                    setNewSetGstRate('18%');
                    setShowCreateSetModal(true);
                  }}
                  style={{
                    border: '1px solid #DDD6FE',
                    background: '#F5F3FF',
                    color: '#6D28D9',
                    padding: '9px 18px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 2px rgba(109, 40, 217, 0.06)',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#EDE9FE'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F5F3FF'; }}
                  title="Create a custom ad-hoc Set / Kit for this PI alone (does not alter preset dropdown)"
                >
                  <Layers style={{ width: '15px', height: '15px', color: '#7C3AED' }} />
                  Create Set
                </button>

                {Object.values(presetGroups).map(grp => (
                  <button
                    key={grp.groupId}
                    type="button"
                    onClick={() => handleAddPresetItem(grp.groupId)}
                    style={{
                      border: '1px solid #C7D2FE',
                      background: '#EEF2FF',
                      color: '#4338CA',
                      padding: '9px 18px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 3px rgba(79, 70, 229, 0.1)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E0E7FF'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#EEF2FF'; }}
                    title={`Add extra item bundled into ${grp.presetName} (₹0 unit rate, included in single kit price)`}
                  >
                    <Layers style={{ width: '15px', height: '15px', color: '#4F46E5' }} />
                    + Add Extra Item into {grp.presetName}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SIDE-BY-SIDE SECTIONS: 4 (VRM OFFICIAL COMMERCIAL BANK DETAILS - LEFT) & 5 (FINANCIAL BREAKDOWN - RIGHT) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '24px', alignItems: 'start' }}>
            
            {/* SECTION 4: VRM OFFICIAL COMMERCIAL BANK DETAILS (LEFT) */}
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                  4
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  VRM OFFICIAL COMMERCIAL BANK DETAILS
                </h3>
              </div>

              {/* Structured Bank Detail Cards */}
              <div style={{ backgroundColor: '#F0FDFA', borderRadius: '12px', border: '1px solid #99F6E4', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Beneficiary Name Banner */}
                <div style={{ paddingBottom: '10px', borderBottom: '1px solid #CCFBF1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#0E7490', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Beneficiary Account Name</div>
                    <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', marginTop: '2px' }}>VRM Structures India Private Limited</div>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '6px', border: '1px solid #A7F3D0', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={13} /> Verified
                  </span>
                </div>

                {/* Bank Name & Account Type Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CCFBF1', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Bank Name</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginTop: '2px' }}>HDFC Bank</div>
                  </div>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CCFBF1', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: '#64748B', fontWeight: '600', textTransform: 'uppercase' }}>Account Type</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginTop: '2px' }}>Current Account</div>
                  </div>
                </div>

                {/* Account Number & IFSC with Copy Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #99F6E4', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', textTransform: 'uppercase' }}>Current Account Number</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', fontFamily: 'monospace', letterSpacing: '0.5px', marginTop: '2px' }}>50200031629272</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyBankDetail('50200031629272', 'Account Number')}
                      title="Copy Account Number"
                      style={{ border: '1px solid #99F6E4', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {copiedBankField === 'Account Number' ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                    </button>
                  </div>

                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #99F6E4', borderRadius: '8px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: '#0E7490', fontWeight: '700', textTransform: 'uppercase' }}>RTGS / NEFT / IFSC</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', fontFamily: 'monospace', letterSpacing: '0.5px', marginTop: '2px' }}>HDFC0007315</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyBankDetail('HDFC0007315', 'IFSC Code')}
                      title="Copy IFSC Code"
                      style={{ border: '1px solid #99F6E4', backgroundColor: '#ECFEFF', color: '#0E7490', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      {copiedBankField === 'IFSC Code' ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                {/* Branch Location */}
                <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #CCFBF1', borderRadius: '8px', padding: '8px 12px', fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span><strong>Branch:</strong> Vinayagapuram Branch</span>
                  <span style={{ color: '#0E7490', fontSize: '10px', fontWeight: '700' }}>Settlement: INR (₹)</span>
                </div>
              </div>
            </div>

            {/* SECTION 5: FINANCIAL BREAKDOWN (RIGHT) */}
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              borderTop: '4px solid #0E7490',
              boxShadow: '0 4px 10px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '14px', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0E7490', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800' }}>
                      5
                    </div>
                    <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#0E7490', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      FINANCIAL BREAKDOWN
                    </h3>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '4px 10px', borderRadius: '6px', border: '1px solid #A5F3FC' }}>
                    INR (₹) Commercial
                  </span>
                </div>

                {/* Financial Calculation Lines */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#F8FAFC', padding: '16px 18px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  {totals.kitSubtotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#4F46E5' }}>
                      <span style={{ fontWeight: '600' }}>Preset Kits Subtotal:</span>
                      <span style={{ fontWeight: '700' }}>₹{totals.kitSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                    <span>Line Items Subtotal:</span>
                    <span style={{ fontWeight: '600', color: '#0F172A' }}>₹{(totals.sub - totals.kitSubtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', color: '#0F172A', fontWeight: '700', borderTop: '1px dashed #CBD5E1', paddingTop: '8px' }}>
                    <span>Total Taxable Subtotal:</span>
                    <span>₹{totals.sub.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  {/* Dynamic GST Tiers Breakdown */}
                  {totals.isIntra ? (
                    (totals.gstTiers || []).map(tier => (
                      <React.Fragment key={tier.rate}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#475569', paddingLeft: '4px' }}>
                          <span>CGST ({tier.cgstRate || (tier.rate / 2)}%){(totals.gstTiers || []).length > 1 ? ` (on ${tier.rate}% items)` : ''}:</span>
                          <span style={{ fontWeight: '600', color: '#0F172A' }}>₹{(tier.cgstAmt ?? (tier.gstAmt / 2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#475569', paddingLeft: '4px' }}>
                          <span>SGST ({tier.sgstRate || (tier.rate / 2)}%){(totals.gstTiers || []).length > 1 ? ` (on ${tier.rate}% items)` : ''}:</span>
                          <span style={{ fontWeight: '600', color: '#0F172A' }}>₹{(tier.sgstAmt ?? (tier.gstAmt / 2)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </React.Fragment>
                    ))
                  ) : (
                    (totals.gstTiers || []).map(tier => (
                      <div key={tier.rate} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: '#475569', paddingLeft: '4px' }}>
                        <span>IGST ({tier.rate}%){(totals.gstTiers || []).length > 1 ? ` (on ${tier.rate}% items)` : ''}:</span>
                        <span style={{ fontWeight: '600', color: '#0F172A' }}>₹{tier.gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    ))
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#0E7490', fontWeight: '700', backgroundColor: '#ECFEFF', padding: '7px 12px', borderRadius: '8px' }}>
                    <span>Total GST Amount:</span>
                    <span>₹{totals.gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '2px solid #0E7490',
                      paddingTop: '12px',
                      marginTop: '2px'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '14.5px', fontWeight: '800', color: '#0F172A', display: 'block' }}>Grand Total (INR)</span>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Inclusive of all statutory taxes</span>
                    </div>
                    <span style={{ fontSize: '20px', fontWeight: '900', color: '#0E7490' }}>
                      ₹{totals.grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons in a Single Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.6fr', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setPiConfirmModal('cancel')}
                  style={{
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: '#F8FAFC',
                    color: '#64748B',
                    border: '1px solid #CBD5E1',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#334155'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.color = '#64748B'; }}
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={triggerDraftConfirm}
                  style={{
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: '#FFFFFF',
                    color: '#0E7490',
                    border: '1.5px solid #0E7490',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ECFEFF'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={triggerSaveConfirm}
                  style={{
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: '#10B981',
                    color: 'white',
                    border: 'none',
                    fontSize: '12.5px',
                    fontWeight: '900',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 10px rgba(16, 185, 129, 0.35)',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#059669'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#10B981'; }}
                >
                  {editIdx !== null && (piList[editIdx]?.status === 'Draft' || piList[editIdx]?.statusType === 'draft')
                    ? 'Complete & Release PI'
                    : 'Confirm & Save Proforma Invoice'}
                </button>
              </div>
            </div>

          </div>

          </div>
        );
      })()}

      {/* ==================== VIEW PI DETAILS DIALOG (FULL FORM MODAL OVERLAY) ==================== */}
      {selectedPi && (() => {
        const bAddr = selectedPi.billingAddress || selectedPi.billingAddressObj || {};
        const bStreet = typeof bAddr === 'object' ? (bAddr.street || bAddr.address || '') : (typeof bAddr === 'string' ? bAddr : '');
        const bCity = typeof bAddr === 'object' ? (bAddr.city || '') : '';
        const bState = typeof bAddr === 'object' ? (bAddr.state || '') : '';
        const bPin = typeof bAddr === 'object' ? (bAddr.pincode || bAddr.pin || '') : '';

        const dAddr = selectedPi.deliveryAddress || selectedPi.deliveryAddressObj || {};
        const dStreet = typeof dAddr === 'object' ? (dAddr.street || dAddr.address || '') : (typeof dAddr === 'string' ? dAddr : '');
        const dCity = typeof dAddr === 'object' ? (dAddr.city || '') : '';
        const dState = typeof dAddr === 'object' ? (dAddr.state || '') : '';
        const dPin = typeof dAddr === 'object' ? (dAddr.pincode || dAddr.pin || '') : '';

        const isSame = selectedPi.sameAsBilling || (!dStreet && !dCity);
        const piItemsList = Array.isArray(selectedPi.items) ? selectedPi.items : [];
        const presetGroupsMap = selectedPi.presetGroups || {};
        const hasPresets = Object.keys(presetGroupsMap).length > 0 || piItemsList.some(it => it.isPresetItem);

        const subtotalVal = Number(selectedPi.unitValue) || piItemsList.reduce((acc, it) => acc + ((parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0)), 0);
        const grandTotalVal = parseFloat(String(selectedPi.amount || 0).replace(/[^0-9.]/g, '')) || (subtotalVal * 1.18);
        const totalGstVal = Math.max(0, grandTotalVal - subtotalVal);
        const isDraft = (selectedPi.status === 'Draft' || selectedPi.statusType === 'draft');
        const matchedBoms = getConvertedBomsForPi(selectedPi);
        const hasSavedBom = matchedBoms.length > 0;
        const isConverted = !isDraft && hasSavedBom;

        const modalGstTiersMap = {};
        (piItemsList || []).forEach(it => {
          const q = parseFloat(it.qty) || 1;
          const r = parseFloat(it.rate) || 0;
          const taxable = it.taxable !== undefined ? parseFloat(it.taxable) : (q * r);
          const rate = parseFloat(String(it.gstRate || '18').replace('%', '')) || 18;
          const amt = taxable * (rate / 100);
          if (!modalGstTiersMap[rate]) modalGstTiersMap[rate] = { rate, taxable: 0, gstAmt: 0 };
          modalGstTiersMap[rate].taxable += taxable;
          modalGstTiersMap[rate].gstAmt += amt;
        });

        if (selectedPi.presetGroups) {
          Object.values(selectedPi.presetGroups).forEach(grp => {
            const unitPrice = parseFloat(grp.kitPrice) || 0;
            const multiplier = parseInt(grp.setCount) || 1;
            const groupTotal = unitPrice * multiplier;
            const rate = parseFloat(String(grp.gstRate || '18').replace('%', '')) || 18;
            const amt = groupTotal * (rate / 100);
            if (!modalGstTiersMap[rate]) modalGstTiersMap[rate] = { rate, taxable: 0, gstAmt: 0 };
            modalGstTiersMap[rate].taxable += groupTotal;
            modalGstTiersMap[rate].gstAmt += amt;
          });
        }

        const modalTargetGst = selectedPi.gstin || selectedPi.gstNo || selectedPi.gst || '';
        const modalTargetState = (isSame ? bState : (dState || bState)) || selectedPi.state || '';
        const isModalIntra = isTamilNaduIntra(modalTargetGst, modalTargetState, bState);

        const modalGstTiers = Object.values(modalGstTiersMap)
          .filter(t => t.gstAmt > 0 || t.taxable > 0)
          .sort((a, b) => a.rate - b.rate);

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 9999,
              padding: '20px'
            }}
            onClick={() => setSelectedPi(null)}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '20px',
                border: '1px solid #E2E8F0',
                maxWidth: '900px',
                width: '100%',
                maxHeight: '92vh',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ padding: '20px 24px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ECFEFF', color: '#0E7490', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
                        Proforma Invoice {selectedPi.piNo}
                      </h3>
                      {renderStatusBadge(
                        isDraft ? 'draft' : (isConverted ? 'converted' : selectedPi.status === 'Cancelled' ? 'cancelled' : 'issued'),
                        isDraft ? 'Draft' : (isConverted ? 'Converted to BOM' : selectedPi.status || 'Issued')
                      )}
                      {Boolean(selectedPi.zohoSynced) && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: '#047857',
                          backgroundColor: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <CheckCircle size={12} style={{ color: '#10B981' }} /> Zoho Synced ({selectedPi.zohoEstimateNo || selectedPi.piNo})
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748B' }}>
                      Created: <strong>{selectedPi.piDate || selectedPi.date || '—'}</strong>
                      {!isConverted && selectedPi.status !== 'Converted to BOM' && selectedPi.status !== 'Cancelled' && (
                        <> | Valid Until: <strong>{selectedPi.validUntilDate || selectedPi.validUntil || '15 Days'}</strong></>
                      )}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {(() => {
                    const matchedBoms = getConvertedBomsForPi(selectedPi);
                    const isConverted = matchedBoms && matchedBoms.length > 0;
                    if (isConverted) return null;

                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const idx = piList.findIndex(p => p.piNo === selectedPi.piNo);
                          handleStartEdit(selectedPi, idx >= 0 ? idx : 0);
                          setSelectedPi(null);
                        }}
                        title="Edit full Proforma Invoice details"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          backgroundColor: '#0E7490',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        <Edit3 size={14} /> Edit Info
                      </button>
                    );
                  })()}
                  <button
                    onClick={() => setPrintModalPi(selectedPi)}
                    title="Open Print & PDF Template"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    <Printer size={14} style={{ color: '#0E7490' }} /> Export / Print
                  </button>
                  <button
                    onClick={() => setSelectedPi(null)}
                    style={{ border: 'none', background: '#F1F5F9', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Scrollable Modal Content */}
              <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* 0. PROMINENT CONVERTED BOM STATUS BANNER */}
                {isConverted && (
                  <div style={{
                    backgroundColor: '#ECFDF5',
                    border: '1.5px solid #6EE7B7',
                    borderRadius: '14px',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#059669', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Boxes size={22} color="#FFFFFF" />
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#065F46' }}>
                          Converted to Bill of Materials (BOM)
                        </div>
                        <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                          Assigned BOM Code(s): <strong>{matchedBoms.map(b => b.bomCode || b.code || b.id).join(', ')}</strong>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {matchedBoms.map((b, idx) => {
                        const bCode = b.bomCode || b.code || b.id;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setSelectedPi(null);
                              window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', { 
                                detail: { tab: 'Sales BOM', targetBom: bCode } 
                              }));
                              if (typeof onNavigateTab === 'function') {
                                onNavigateTab('Sales BOM');
                              }
                            }}
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#059669',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 6px rgba(5,150,105,0.25)'
                            }}
                          >
                            <Layers size={14} /> Open {bCode} in Sales BOM ↗
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => syncPiToZoho(selectedPi)}
                        disabled={syncingPiNo === selectedPi.piNo}
                        title={selectedPi.zohoSynced ? `Synced to Zoho Books as Quote #${selectedPi.zohoEstimateNo || selectedPi.piNo}. Click to re-sync.` : 'Push this Proforma Invoice to Zoho Books as a Quote'}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: selectedPi.zohoSynced ? '#F0FDF4' : '#0E7490',
                          color: selectedPi.zohoSynced ? '#15803D' : '#FFFFFF',
                          border: selectedPi.zohoSynced ? '1px solid #86EFAC' : 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '800',
                          cursor: syncingPiNo === selectedPi.piNo ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: selectedPi.zohoSynced ? 'none' : '0 2px 6px rgba(14,116,144,0.25)',
                          opacity: syncingPiNo === selectedPi.piNo ? 0.7 : 1
                        }}
                      >
                        {syncingPiNo === selectedPi.piNo ? (
                          <>
                            <RotateCcw size={14} className="animate-spin" /> Pushing to Zoho...
                          </>
                        ) : selectedPi.zohoSynced ? (
                          <>
                            <CheckCircle size={14} style={{ color: '#16A34A' }} /> Zoho Synced ({selectedPi.zohoEstimateNo || selectedPi.piNo})
                          </>
                        ) : (
                          <>
                            <UploadCloud size={14} /> Push to Zoho
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevertPiToIssued(selectedPi)}
                        title="Disconnect BOM and revert this PI back to Issued status"
                        style={{
                          padding: '8px 14px',
                          backgroundColor: '#FFF1F2',
                          color: '#E11D48',
                          border: '1px solid #FECDD3',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        ✕ Revert to Issued
                      </button>
                    </div>
                  </div>
                )}

                {/* 1. Customer & Contact Details Card */}
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid #E2E8F0', paddingBottom: '8px' }}>
                    <Building2 size={16} color="#0E7490" />
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase' }}>
                      Customer & Contact Details
                    </h4>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Company Name</span>
                      <strong style={{ fontSize: '14px', color: '#0F172A' }}>{selectedPi.vendor || selectedPi.customerName || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Customer Name</span>
                      <strong style={{ fontSize: '13px', color: '#334155' }}>{selectedPi.contactPerson || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Phone / Mobile</span>
                      <strong style={{ fontSize: '13px', color: '#334155' }}>{selectedPi.phone || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Email Address</span>
                      <span style={{ fontSize: '13px', color: '#334155' }}>{selectedPi.email || '—'}</span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B' }}>GSTIN</span>
                      <strong style={{ fontSize: '13px', color: '#0E7490', fontFamily: 'monospace' }}>{selectedPi.gstNo || 'Unregistered'}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Sales Executive / Code</span>
                      <strong style={{ fontSize: '13px', color: '#334155' }}>
                        {selectedPi.salesPerson || '—'} {selectedPi.salesPersonCode ? `(${selectedPi.salesPersonCode})` : ''}
                      </strong>
                      {selectedPi.salesPersonEmail && (
                        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{selectedPi.salesPersonEmail}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Addresses (Billing & Delivery) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {/* Billing Address */}
                  <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px' }}>
                      <Building2 size={14} color="#2563EB" />
                      <strong style={{ fontSize: '12px', color: '#0F172A', textTransform: 'uppercase' }}>Billing Address</strong>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.5' }}>
                      <div>{bStreet || selectedPi.billingStreet || '—'}</div>
                      <div>{[bCity || selectedPi.billingCity, bState || selectedPi.billingState].filter(Boolean).join(', ')}</div>
                      {(bPin || selectedPi.billingPincode) && <div>PIN: <strong>{bPin || selectedPi.billingPincode}</strong></div>}
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Truck size={14} color="#0E7490" />
                        <strong style={{ fontSize: '12px', color: '#0F172A', textTransform: 'uppercase' }}>Delivery / Site Address</strong>
                      </div>
                      {isSame && (
                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#0E7490', backgroundColor: '#ECFEFF', padding: '2px 6px', borderRadius: '4px' }}>
                          Same as Billing
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.5' }}>
                      {isSame ? (
                        <>
                          <div>{bStreet || selectedPi.billingStreet || '—'}</div>
                          <div>{[bCity || selectedPi.billingCity, bState || selectedPi.billingState].filter(Boolean).join(', ')}</div>
                          {(bPin || selectedPi.billingPincode) && <div>PIN: <strong>{bPin || selectedPi.billingPincode}</strong></div>}
                        </>
                      ) : (
                        <>
                          <div>{dStreet || selectedPi.deliveryStreet || '—'}</div>
                          <div>{[dCity || selectedPi.deliveryCity, dState || selectedPi.deliveryState].filter(Boolean).join(', ')}</div>
                          {(dPin || selectedPi.deliveryPincode) && <div>PIN: <strong>{dPin || selectedPi.deliveryPincode}</strong></div>}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Commercial & Transport Terms */}
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Payment Terms</span>
                    <strong style={{ fontSize: '12.5px', color: '#0F172A' }}>{normalizePaymentTerm(selectedPi.paymentTerms || selectedPi.paymentType)}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Credit Days</span>
                    <strong style={{ fontSize: '12.5px', color: '#0F172A' }}>{selectedPi.creditDays ? `${selectedPi.creditDays} Days` : 'Immediate'}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Transport Mode</span>
                    <strong style={{ fontSize: '12.5px', color: '#0F172A' }}>{selectedPi.transportMode || 'Road Transport'}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Transporter / Vehicle</span>
                    <span style={{ fontSize: '12.5px', color: '#334155' }}>{[selectedPi.transporterName, selectedPi.vehicleNo].filter(Boolean).join(' - ') || 'To be arranged'}</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Destination</span>
                    <strong style={{ fontSize: '12.5px', color: '#0F172A' }}>{selectedPi.destination || selectedPi.deliveryCity || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Transport Scope</span>
                    <strong style={{ fontSize: '12.5px', color: '#0F172A' }}>{selectedPi.transportScope || 'VRM Structures'}</strong>
                  </div>
                  {selectedPi.remarks && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B' }}>Remarks / Notes</span>
                      <span style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>{selectedPi.remarks}</span>
                    </div>
                  )}
                </div>

                {/* 3b. Preset Kits Section (if presets used) */}
                {Object.keys(presetGroupsMap).length > 0 && (
                  <div style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: '14px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <Boxes size={16} color="#15803D" />
                      <strong style={{ fontSize: '13px', color: '#14532D', textTransform: 'uppercase' }}>
                        Configured Preset Proposal Kits ({Object.keys(presetGroupsMap).length})
                      </strong>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                      {Object.values(presetGroupsMap).map((grp, gIdx) => {
                        const uPrice = parseFloat(grp.kitPrice) || 0;
                        const sCount = parseInt(grp.setCount) || 1;
                        const gTotal = uPrice * sCount;
                        return (
                          <div key={gIdx} style={{ backgroundColor: '#FFFFFF', border: '1px solid #86EFAC', borderRadius: '10px', padding: '12px' }}>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: '#166534' }}>{grp.presetName}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#374151', marginTop: '6px' }}>
                              <span>Quantity: <strong>{sCount} Set{sCount > 1 ? 's' : ''}</strong></span>
                              <span>GST: <strong>{grp.gstRate || '18%'}</strong></span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#374151', marginTop: '4px' }}>
                              <span>Kit Rate: <strong>₹{uPrice.toLocaleString('en-IN')}</strong></span>
                              <span>Total: <strong style={{ color: '#15803D' }}>₹{gTotal.toLocaleString('en-IN')}</strong></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. Complete Invoice Line Items & Presets */}
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 18px', backgroundColor: '#F1F5F9', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={16} color="#0E7490" />
                      <strong style={{ fontSize: '13px', color: '#0F172A', textTransform: 'uppercase' }}>
                        Invoice Line Items ({piItemsList.length > 0 ? piItemsList.length : selectedPi.quantity || 1})
                      </strong>
                    </div>
                    {selectedPi.productName && (
                      <span style={{ fontSize: '11px', color: '#475569', fontWeight: '600' }}>
                        Scope: {selectedPi.productName}
                      </span>
                    )}
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px' }}>#</th>
                        <th style={{ padding: '10px 12px' }}>Item Description</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Live Stock</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Unit Rate (₹)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Taxable Value (₹)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center' }}>GST Rate</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {piItemsList.length > 0 ? (() => {
                        const distinctDetailsGroupIds = [];
                        piItemsList.forEach(it => {
                          if (it.presetGroupId && !distinctDetailsGroupIds.includes(it.presetGroupId)) {
                            distinctDetailsGroupIds.push(it.presetGroupId);
                          }
                        });

                        return piItemsList.map((it, idx) => {
                          const isPreset = Boolean(it.isPresetItem || it.presetGroupId || (!it.rate && subtotalVal > 0));
                          const groupId = it.presetGroupId;
                          const groupIndex = groupId ? distinctDetailsGroupIds.indexOf(groupId) : -1;
                          const presetNumber = groupIndex >= 0 ? groupIndex + 1 : 1;
                          const theme = groupIndex >= 0 ? getPresetTheme(groupIndex) : PRESET_THEMES[0];
                          const pGroups = selectedPi.presetGroups || {};
                          const currentGroup = groupId ? (pGroups[groupId] || { kitPrice: '', setCount: 1, presetName: it.presetName }) : null;

                          let isFirstInGroup = false;
                          let groupCount = 0;
                          let itemIndexInGroup = 0;
                          if (isPreset && groupId) {
                            const itemsInGroup = piItemsList.filter(x => x.presetGroupId === groupId);
                            groupCount = itemsInGroup.length;
                            isFirstInGroup = piItemsList.findIndex(x => x.presetGroupId === groupId) === idx;
                            itemIndexInGroup = itemsInGroup.findIndex(x => x === it) + 1;
                          }

                          const customItems = piItemsList.filter(x => !(x.isPresetItem || x.presetGroupId || (!x.rate && subtotalVal > 0)));
                          const isFirstCustomItem = !isPreset && piItemsList.findIndex(x => !(x.isPresetItem || x.presetGroupId || (!x.rate && subtotalVal > 0))) === idx;
                          const customIndex = !isPreset ? customItems.findIndex(x => x === it) + 1 : null;

                          const displaySNo = isPreset && distinctDetailsGroupIds.length > 0
                            ? `${presetNumber}.${itemIndexInGroup}`
                            : (customIndex !== null ? (distinctDetailsGroupIds.length > 0 ? `C.${customIndex}` : `${idx + 1}`) : `${idx + 1}`);

                          const itQty = parseFloat(it.qty) || 1;
                          const itRate = parseFloat(it.rate) || 0;
                          const itTaxable = isPreset ? 0 : (itQty * itRate);
                          const itGstPct = parseFloat(String(it.gstRate || '18').replace('%', '')) || 18;
                          const itAmt = isPreset ? null : (itTaxable + (itTaxable * (itGstPct / 100)));

                          return (
                            <React.Fragment key={idx}>
                              {isFirstInGroup && (
                                <tr key={`modal-preset-hdr-${groupId}`} style={{ backgroundColor: theme.bg, borderTop: `2px solid ${theme.primary}`, borderBottom: `1px solid ${theme.border}` }}>
                                  <td colSpan={8} style={{ padding: '8px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                          padding: '2px 8px',
                                          borderRadius: '6px',
                                          backgroundColor: theme.primary,
                                          color: '#FFFFFF',
                                          fontSize: '11px',
                                          fontWeight: '800',
                                          letterSpacing: '0.5px'
                                        }}>
                                          {theme.badge}
                                        </span>
                                        <strong style={{ fontSize: '12px', color: '#0F172A', fontWeight: '800' }}>
                                          {currentGroup?.presetName || it.presetName || 'Structure Kit'}
                                        </strong>
                                        <span style={{
                                          fontSize: '10px',
                                          fontWeight: '700',
                                          padding: '1px 6px',
                                          borderRadius: '8px',
                                          backgroundColor: theme.tagBg,
                                          color: theme.tagText,
                                          border: `1px solid ${theme.border}`
                                        }}>
                                          {currentGroup?.setCount || 1} Set{(currentGroup?.setCount || 1) > 1 ? 's' : ''} ({groupCount} components)
                                        </span>
                                      </div>
                                      <div style={{ fontSize: '11px', color: '#475569', fontWeight: '700' }}>
                                        Kit Subtotal: <strong style={{ color: theme.primary }}>₹ {Number(currentGroup?.kitPrice || 0).toLocaleString('en-IN')}</strong> + {currentGroup?.gstRate || '18%'} GST
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                              {isFirstCustomItem && distinctDetailsGroupIds.length > 0 && (
                                <tr key="modal-custom-hdr" style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #64748B', borderBottom: '1px solid #CBD5E1' }}>
                                  <td colSpan={8} style={{ padding: '6px 12px' }}>
                                    <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#475569', color: '#FFFFFF', fontSize: '10px', fontWeight: '800', marginRight: '8px' }}>
                                      CUSTOM ITEMS
                                    </span>
                                    <strong style={{ fontSize: '11px', color: '#334155' }}>
                                      Additional Materials ({customItems.length} items)
                                    </strong>
                                  </td>
                                </tr>
                              )}
                              <tr key={idx} style={{
                                borderBottom: '1px solid #F1F5F9',
                                backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'
                              }}>
                                <td style={{
                                  padding: '10px 12px',
                                  color: isPreset ? theme.primary : '#64748B',
                                  fontWeight: '800',
                                  borderLeft: isPreset ? `4px solid ${theme.primary}` : '4px solid #CBD5E1'
                                }}>
                                  #{displaySNo}
                                </td>
                                <td style={{ padding: '10px 12px', color: '#0F172A', fontWeight: '700' }}>
                                  <div>{it.name || 'Component Item'}</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                    {isPreset && (
                                      <span style={{
                                        fontSize: '9.5px',
                                        fontWeight: '800',
                                        padding: '1px 5px',
                                        borderRadius: '4px',
                                        backgroundColor: theme.tagBg,
                                        color: theme.tagText,
                                        border: `1px solid ${theme.border}`
                                      }}>
                                        {theme.badge} • Component {itemIndexInGroup} of {groupCount}
                                      </span>
                                    )}
                                    {it.category && <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 'normal' }}>{it.category}</span>}
                                  </div>
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                  {(() => {
                                    const avail = getItemStock(it.name, it.code);
                                    if (avail === null) return <span style={{ color: '#94A3B8' }}>—</span>;
                                    const isOut = avail <= 0;
                                    return (
                                      <span style={{
                                        fontSize: '10px',
                                        fontWeight: '800',
                                        padding: '1px 6px',
                                        borderRadius: '8px',
                                        backgroundColor: isOut ? '#FEF2F2' : '#ECFDF5',
                                        color: isOut ? '#DC2626' : '#059669',
                                        border: isOut ? '1px solid #FECACA' : '1px solid #A7F3D0'
                                      }}>
                                        {avail.toLocaleString()}
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#334155', fontWeight: '600' }}>
                                  {itQty} {it.uom || 'NOS'}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#475569' }}>
                                  {isPreset ? (
                                    <span style={{ fontSize: '11px', color: theme.primary, fontStyle: 'italic', fontWeight: '700' }}>In Kit ({theme.badge})</span>
                                  ) : (
                                    `₹ ${itRate.toLocaleString('en-IN')}`
                                  )}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#334155', fontWeight: '600' }}>
                                  {isPreset ? (
                                    <span style={{ fontSize: '11px', color: '#64748B' }}>—</span>
                                  ) : (
                                    `₹ ${itTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                  )}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#4338CA', fontWeight: '700' }}>
                                  {it.gstRate || '18%'}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#0E7490' }}>
                                  {isPreset ? (
                                    <span style={{ fontSize: '11px', color: '#64748B' }}>—</span>
                                  ) : (
                                    `₹ ${(itAmt || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                  )}
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        });
                      })() : (
                        <tr>
                          <td style={{ padding: '12px 14px', color: '#64748B' }}>1</td>
                          <td style={{ padding: '12px 14px', color: '#0F172A', fontWeight: '700' }}>{selectedPi.productName || 'Solar Structure MMS Kit'}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748B' }}>—</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: '#334155' }}>{selectedPi.quantity || 1} Set</td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: '#475569' }}>₹ {subtotalVal.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', color: '#334155' }}>₹ {subtotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: '#4338CA' }}>18%</td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#0E7490' }}>₹ {subtotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 4b. Attached Document / Signed PI Doc (if present) */}
                {Boolean(selectedPi.signedPiDoc?.dataUrl || (selectedPi.pdfName && selectedPi.pdfName !== 'pi_document.pdf' && selectedPi.signedPiDoc)) && (
                  <div style={{ backgroundColor: '#F8FAFC', border: '1.5px solid #CBD5E1', borderRadius: '14px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <FileCheck size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                          {selectedPi.signedPiDoc?.name || selectedPi.pdfName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>
                          {selectedPi.signedPiDoc?.size ? `${Math.round(selectedPi.signedPiDoc.size / 1024)} KB • ` : ''}
                          Official Verified Attachment
                        </div>
                      </div>
                    </div>
                    {selectedPi.signedPiDoc?.dataUrl && (
                      <a
                        href={selectedPi.signedPiDoc.dataUrl}
                        download={selectedPi.signedPiDoc.name || 'signed_pi.pdf'}
                        style={{
                          padding: '7px 14px',
                          backgroundColor: '#0E7490',
                          color: '#FFFFFF',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Download size={14} /> Download Document
                      </a>
                    )}
                  </div>
                )}

                {/* 5. Financial Summary Grid */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                  <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                      <span>Taxable Product Value:</span>
                      <strong style={{ color: '#0F172A' }}>₹ {subtotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </div>
                    {selectedPi.kitSubtotal > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                        <span>Preset Kits Subtotal:</span>
                        <strong style={{ color: '#0F172A' }}>₹ {Number(selectedPi.kitSubtotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                    )}
                    {modalGstTiers.length > 0 ? (
                      isModalIntra ? (
                        modalGstTiers.map(tier => (
                          <React.Fragment key={tier.rate}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '12.5px', paddingLeft: '4px' }}>
                              <span>CGST ({(tier.rate / 2)}%){modalGstTiers.length > 1 ? ` (${tier.rate}% items)` : ''}:</span>
                              <strong style={{ color: '#0F172A' }}>₹ {(tier.gstAmt / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '12.5px', paddingLeft: '4px' }}>
                              <span>SGST ({(tier.rate / 2)}%){modalGstTiers.length > 1 ? ` (${tier.rate}% items)` : ''}:</span>
                              <strong style={{ color: '#0F172A' }}>₹ {(tier.gstAmt / 2).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </div>
                          </React.Fragment>
                        ))
                      ) : (
                        modalGstTiers.map(tier => (
                          <div key={tier.rate} style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B', fontSize: '12.5px', paddingLeft: '4px' }}>
                            <span>IGST ({tier.rate}%){modalGstTiers.length > 1 ? ` (${tier.rate}% items)` : ''}:</span>
                            <strong style={{ color: '#0F172A' }}>₹ {tier.gstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                          </div>
                        ))
                      )
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                        <span>Applicable GST (Taxes):</span>
                        <strong style={{ color: '#0F172A' }}>₹ {totalGstVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #0E7490', marginTop: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>Total Invoice Amount:</span>
                      <strong style={{ fontSize: '18px', fontWeight: '900', color: '#0E7490' }}>
                        {selectedPi.amount ? (selectedPi.amount.startsWith('₹') ? selectedPi.amount : `₹ ${selectedPi.amount}`) : `₹ ${grandTotalVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer Controls */}
              <div style={{ padding: '16px 24px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setSelectedPi(null)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Close Details
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {(selectedPi.status === 'Draft' || selectedPi.statusType === 'draft') && (
                    <button
                      type="button"
                      onClick={() => handleReleaseDraftPi(selectedPi)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: '#10B981',
                        color: '#FFFFFF',
                        fontSize: '13px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10B981'}
                    >
                      <CheckCircle size={15} /> Complete & Release PI →
                    </button>
                  )}

                  {!isConverted && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = piList.findIndex(p => p.piNo === selectedPi.piNo);
                        handleStartEdit(selectedPi, idx >= 0 ? idx : 0);
                        setSelectedPi(null);
                      }}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: '#0E7490',
                        color: '#FFFFFF',
                        fontSize: '13px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Edit3 size={15} /> Edit Info
                    </button>
                  )}

                  {selectedPi.status !== 'Cancelled' && !isConverted && (
                    <button
                      type="button"
                      disabled={cancellingPiNo === selectedPi.piNo}
                      onClick={() => handleCancelPi(selectedPi)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '10px',
                        border: '1px solid #FCA5A5',
                        backgroundColor: '#FEF2F2',
                        color: '#DC2626',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: cancellingPiNo === selectedPi.piNo ? 'not-allowed' : 'pointer',
                        opacity: cancellingPiNo === selectedPi.piNo ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {cancellingPiNo === selectedPi.piNo ? 'Cancelling...' : 'Cancel PI'}
                    </button>
                  )}

                  {isConverted ? (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleRevertPiToIssued(selectedPi)}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '10px',
                          border: '1.5px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          color: '#64748B',
                          fontSize: '13px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Revert to Issued (Unlink BOM)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const firstBom = matchedBoms[0]?.bomCode || matchedBoms[0]?.code || matchedBoms[0]?.id;
                          setSelectedPi(null);
                          window.dispatchEvent(new CustomEvent('controlroom_navigate_tab', { 
                            detail: { tab: 'Sales BOM', targetBom: firstBom } 
                          }));
                          if (typeof onNavigateTab === 'function') {
                            onNavigateTab('Sales BOM');
                          }
                        }}
                        style={{
                          padding: '10px 22px',
                          borderRadius: '10px',
                          border: 'none',
                          backgroundColor: '#059669',
                          color: '#FFFFFF',
                          fontSize: '13px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 12px rgba(5,150,105,0.3)'
                        }}
                      >
                        <Layers size={16} /> View {matchedBoms[0]?.bomCode || 'BOM'} Order ↗
                      </button>
                    </div>
                  ) : (
                    selectedPi.status !== 'Cancelled' && selectedPi.status !== 'Draft' && (
                      <button
                        type="button"
                        onClick={() => {
                          const pi = selectedPi;
                          setSelectedPi(null);
                          handleConvertToBom(pi);
                        }}
                        style={{
                          padding: '10px 22px',
                          borderRadius: '10px',
                          border: 'none',
                          backgroundColor: '#4F46E5',
                          color: '#FFFFFF',
                          fontSize: '13px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 12px rgba(79,70,229,0.3)'
                        }}
                      >
                        <Layers size={16} /> Convert to BOM →
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================== CUSTOM MANDATORY VALIDATION MODAL (MATCHING PO CREATION POPUP) ==================== */}
      {validationAlert && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', width: '460px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', flexShrink: 0 }}>
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>
                  {validationAlert.title || 'Mandatory Fields Required'}
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                  {validationAlert.message || 'Please complete all required fields to move forward.'}
                </p>
              </div>
            </div>
            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155' }}>
                {validationAlert.note || 'You did not fill out the following mandatory box(es):'}
              </span>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#DC2626', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {(validationAlert.fields || validationAlert.missingList || []).map((item, idx) => {
                  const label = typeof item === 'object' ? (item.field || item.name || item.message || JSON.stringify(item)) : item;
                  return <li key={idx}><strong>{label}</strong></li>;
                })}
              </ul>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => {
                  const targetId = validationAlert.firstTargetId;
                  setValidationAlert(null);
                  if (targetId) {
                    setTimeout(() => {
                      const el = document.getElementById(targetId);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.focus?.();
                      }
                    }, 100);
                  }
                }}
                style={{ backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)' }}
              >
                OK, I'll fill it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== DELETE CONFIRMATION POPUP ==================== */}
      {deleteIdx !== null && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          {/* Main Card Frame with White Padding */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '24px',
              border: '1px solid #e2e8f0',
              width: '420px',
              padding: '16px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {/* Embedded Red Header Pill Band: URGENT */}
            <div
              style={{
                backgroundColor: '#ff4d4d',
                color: 'white',
                fontSize: '12px',
                fontWeight: '800',
                height: '34px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                letterSpacing: '0.15em'
              }}
            >
              URGENT
            </div>

            {/* Inner box with dashed border - clean white background */}
            <div
              style={{
                padding: '16px',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: 'white'
              }}
            >
              {/* Title & Date Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 'bold', color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>
                  Delete Performa Invoice?
                </h3>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>
                  {piList[deleteIdx].piDate}
                </span>
              </div>

              {/* Description */}
              <p style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.5', margin: 0 }}>
                Are you sure you want to permanently delete Performa Invoice <strong style={{ color: '#0f172a' }}>{piList[deleteIdx].piNo}</strong> for <strong>{piList[deleteIdx].vendor}</strong>? This action cannot be undone.
              </p>

              {/* Bottom line inside dashed area: Cancel on same line as Delete PI */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '6px' }}>
                <button
                  onClick={() => setDeleteIdx(null)}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#64748b',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={executeDeletePI}
                  style={{
                    backgroundColor: '#fee2e2',
                    color: '#ef4444',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Delete PI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PI CONFIRMATION MODALS (CANCEL, DRAFT, CREATE) ==================== */}
      {piConfirmModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              width: '440px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: piConfirmModal === 'cancel' ? '#FEF2F2' : (piConfirmModal === 'draft' ? '#FFFBEB' : '#ECFEFF'),
                  color: piConfirmModal === 'cancel' ? '#EF4444' : (piConfirmModal === 'draft' ? '#D97706' : '#0E7490'),
                  flexShrink: 0
                }}
              >
                {piConfirmModal === 'cancel' ? <AlertTriangle size={20} /> : <FileCheck size={20} />}
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  {piConfirmModal === 'cancel' ? 'Discard Proforma Invoice?' : (piConfirmModal === 'draft' ? 'Save as Draft?' : 'Release Proforma Invoice?')}
                </h3>
                <span style={{ fontSize: '11px', color: '#64748B' }}>
                  {piConfirmModal === 'cancel' ? 'Unsaved modifications will be permanently lost' : (piConfirmModal === 'draft' ? 'Progress will be saved in Draft state' : 'Commercial document confirmation')}
                </span>
              </div>
            </div>

            <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6', backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              {piConfirmModal === 'cancel' ? (
                <span>Are you sure you want to discard this Proforma Invoice? Any configured line items, preset structures, and addresses will be erased.</span>
              ) : piConfirmModal === 'draft' ? (
                <span>Save this Proforma Invoice as a <strong>Draft</strong>. It will be stored safely and can be edited, completed, or converted at any time later.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><strong>Company:</strong> {vendorName || 'Not specified'}</div>
                  <div><strong>PI Number:</strong> {editIdx !== null ? (piNumber || 'N/A') : 'Auto Generated'}</div>
                  <div><strong>Total Value:</strong> ₹{calculatePiTotals().grand.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (incl. GST)</div>
                  <div><strong>Line Items / Scope:</strong> {piItems.length} material lines configured</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsSubmittingPI(false);
                  setPiConfirmModal(null);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  opacity: 1
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingPI}
                onClick={() => {
                  if (piConfirmModal === 'cancel') {
                    setPiConfirmModal(null);
                    resetForm();
                    setViewMode('list');
                  } else if (piConfirmModal === 'draft') {
                    executeCreatePI(true);
                  } else {
                    executeCreatePI(false);
                  }
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  backgroundColor: piConfirmModal === 'cancel' ? '#EF4444' : (piConfirmModal === 'draft' ? '#0E7490' : '#10B981'),
                  color: 'white',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: isSubmittingPI ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingPI ? 0.7 : 1,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                {isSubmittingPI
                  ? 'Generating Number & Saving...'
                  : (piConfirmModal === 'cancel' ? 'Yes, Discard' : (piConfirmModal === 'draft' ? 'Save Draft' : 'Confirm & Release PI'))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CLEAR ALL ITEMS CONFIRMATION MODAL ==================== */}
      {showClearConfirmModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #FECDD3',
              width: '400px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FFF1F2', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                  Clear All Line Items?
                </h3>
                <span style={{ fontSize: '11px', color: '#64748B' }}>This will remove all preset kits and items from the PI</span>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: '1.5' }}>
              Are you sure you want to clear all {piItems.length} item lines? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                style={{ padding: '8px 16px', borderRadius: '8px', backgroundColor: '#FFFFFF', color: '#475569', border: '1px solid #CBD5E1', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                Keep Items
              </button>
              <button
                type="button"
                onClick={() => {
                  setPiItems([]);
                  setPresetGroups({});
                  setShowClearConfirmModal(false);
                }}
                style={{ padding: '8px 18px', borderRadius: '8px', backgroundColor: '#E11D48', color: 'white', border: 'none', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CREATE CUSTOM SET MODAL (THIS PI ALONE) ==================== */}
      {showCreateSetModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              width: '460px',
              maxWidth: '92vw',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
                    Create Custom Set / Kit
                  </h3>
                  <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                    Bundle products into a kit for this PI alone
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateSetModal(false)}
                style={{ border: 'none', background: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Notice badge */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '8px', padding: '10px 12px', fontSize: '11.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={15} style={{ color: '#64748B', flexShrink: 0 }} />
              <span>This custom set exists <strong>only in this PI</strong> and will not be added to the master preset dropdown.</span>
            </div>

            <form onSubmit={handleCreateCustomSet} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Set / Kit Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="e.g. Custom 5kW Solar Kit, Special Client Bundle"
                  style={{
                    width: '100%', height: '40px', borderRadius: '8px',
                    border: '1.5px solid #CBD5E1', padding: '0 12px',
                    fontSize: '13px', fontWeight: '600', color: '#0F172A',
                    outline: 'none', boxSizing: 'border-box'
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Number of Sets
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={newSetCount}
                    onChange={(e) => setNewSetCount(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{
                      width: '100%', height: '40px', borderRadius: '8px',
                      border: '1.5px solid #CBD5E1', padding: '0 12px',
                      fontSize: '13px', fontWeight: '700', color: '#0F172A',
                      outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    GST Rate
                  </label>
                  <select
                    value={newSetGstRate}
                    onChange={(e) => setNewSetGstRate(e.target.value)}
                    style={{
                      width: '100%', height: '40px', borderRadius: '8px',
                      border: '1.5px solid #CBD5E1', padding: '0 10px',
                      fontSize: '13px', fontWeight: '700', color: '#0F172A',
                      outline: 'none', boxSizing: 'border-box', backgroundColor: 'white'
                    }}
                  >
                    <option value="18%">18% (Standard)</option>
                    <option value="12%">12%</option>
                    <option value="5%">5% (Solar / TopCon)</option>
                    <option value="0%">0% (Exempt)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Kit / Set Lump-Sum Price (₹) <span style={{ fontSize: '11px', fontWeight: '400', color: '#64748B' }}>(Optional, can set in table)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: '700', color: '#64748B' }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={newSetPrice}
                    onChange={(e) => setNewSetPrice(e.target.value)}
                    placeholder="Enter total taxable price for 1 set"
                    style={{
                      width: '100%', height: '40px', borderRadius: '8px',
                      border: '1.5px solid #CBD5E1', padding: '0 12px 0 28px',
                      fontSize: '13px', fontWeight: '700', color: '#0F172A',
                      outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateSetModal(false)}
                  style={{
                    padding: '9px 18px', borderRadius: '8px',
                    backgroundColor: '#FFFFFF', color: '#475569',
                    border: '1px solid #CBD5E1', fontSize: '13px',
                    fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 20px', borderRadius: '8px',
                    backgroundColor: '#7C3AED', color: 'white',
                    border: 'none', fontSize: '13px',
                    fontWeight: '800', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 2px 6px rgba(124, 58, 237, 0.3)'
                  }}
                >
                  <Layers size={15} />
                  Create Set & Add Items
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== SIGNED DOCUMENT PREVIEW MODAL ==================== */}
      {previewDocModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1001
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '1px solid #CBD5E1',
              width: '560px',
              maxHeight: '85vh',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileCheck size={18} color="#0E7490" />
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>{previewDocModal.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDocModal(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748B' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'auto', maxHeight: 'calc(85vh - 70px)' }}>
              {previewDocModal.dataUrl && previewDocModal.dataUrl.startsWith('data:image') ? (
                <img
                  src={previewDocModal.dataUrl}
                  alt={previewDocModal.name}
                  style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <FileText size={48} color="#0E7490" />
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{previewDocModal.name}</span>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>PDF document cached safely in offline local storage</span>
                  {previewDocModal.dataUrl && (
                    <a
                      href={previewDocModal.dataUrl}
                      download={previewDocModal.name}
                      style={{ marginTop: '8px', padding: '8px 16px', backgroundColor: '#0E7490', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '12px', fontWeight: '700' }}
                    >
                      Download Attached File
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== OFFICIAL PROFORMA INVOICE PRINT & PDF TEMPLATE ==================== */}
      {printModalPi && (
        <VRMProformaInvoicePrintTemplate
          piData={printModalPi}
          onClose={() => setPrintModalPi(null)}
        />
      )}

    </div>
  );
}
