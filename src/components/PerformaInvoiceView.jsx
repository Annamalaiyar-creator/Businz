import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Check, Hourglass, Edit3, Trash2, Eye, FileText, X, UploadCloud, CheckCircle, Search, AlertTriangle, ArrowLeft, ArrowRight, MoreVertical, Edit, Info, Calendar, Filter, ChevronLeft, ChevronRight, RotateCcw, Layers, Tag, MoreHorizontal, Download, Building2, Truck, Boxes, User, Landmark, ShieldCheck, Upload, FileCheck, ShoppingCart, Clock, Printer, Palette, Copy, AlertCircle } from 'lucide-react';
import StatusBadge from './StatusBadge';
import SearchablePresetSelector from './SearchablePresetSelector';
import TypeableProductSelect from './TypeableProductSelect';
import ModernDateRangePicker from './ModernDateRangePicker';
import VRMProformaInvoicePrintTemplate from './VRMProformaInvoicePrintTemplate';
import { VRM_HDG_PRESETS, getAllActivePresets } from '../vrmHdgProposalPresets';
import { saveMediaToCache, getMediaFromCache, compressAndSaveFile, normalizePaymentTerm, STANDARD_PAYMENT_TERMS } from '../utils/otherViewsShared';
import { getFullProductsCatalogWithStock } from '../utils/productCatalogService';
import { normalizeProductName, resolveProductCode } from '../utils/vrmProductsData';
import { centralInventoryStore } from '../utils/centralInventoryStore';
import { saveCloudStore, saveCloudStoreImmediate, fetchCloudStore, subscribeToCloudStore } from '../utils/supabaseDataSync';
import { notifyPiCreated } from '../services/notificationService';
import { isTamilNaduIntra, calculateGstTiers } from '../utils/gstHelper';

const defaultSalesPIs = [];

const defaultProcurementPIs = [];

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
  if (item.status === 'Pending Approval' || item.status === 'Approved') {
    return { ...item, status: 'Issued', statusType: 'issued' };
  }
  return item;
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
    // Only associate BOMs if this PI was explicitly converted or has an assigned BOM code
    const isExplicitlyConverted = Boolean(
      pi.convertedToBom || 
      pi.status === 'Converted to BOM' || 
      pi.convertedBomNo || 
      pi.convertedBomCode
    );
    if (!isExplicitlyConverted) return [];

    const piNum = (pi.piNo || pi.estimate_number || pi.id || '').trim().toLowerCase();
    const explicitCode = (pi.convertedBomNo || pi.convertedBomCode || '').trim().toLowerCase();

    const matches = (bomList || []).filter(b => {
      if (!b) return false;
      // Do NOT link to cancelled or restored BOMs
      if (b.cancelled || b.status === 'Cancelled' || b.status === 'Cancelled & Stock Restored') return false;

      const sPi = (b.sourcePiNo || '').trim().toLowerCase();
      // Match sourcePiNo or explicit converted BOM code
      if (piNum && sPi && sPi === piNum) return true;
      if (explicitCode) {
        const bCode = (b.bomCode || b.code || b.id || '').trim().toLowerCase();
        if (bCode && bCode === explicitCode) return true;
      }
      return false;
    });

    if (matches.length <= 1) return matches;

    // Strict 1-to-1 deduplication safeguard:
    // If multiple exist historically, prefer explicit convertedBomCode, otherwise sort by latest BOM number
    if (explicitCode) {
      const explicitMatch = matches.find(b => {
        const bCode = (b.bomCode || b.code || b.id || '').trim().toLowerCase();
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
    if (!window.confirm(`Are you sure you want to mark Proforma Invoice ${cleanPiNo} as Cancelled? This will also update its status to Declined in Zoho Books.`)) {
      return;
    }

    setCancellingPiNo(cleanPiNo);
    const updated = piList.map(p => (p.piNo === cleanPiNo || p.id === cleanPiNo) ? { ...p, status: 'Cancelled', statusType: 'cancelled' } : p);
    updatePiList(updated);

    try {
      const resp = await fetch('/api/zoho/estimates/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          piNo: cleanPiNo,
          zohoEstimateId: piToCancel.zohoEstimateId,
          reason: 'Cancelled by user in BUSINZ'
        })
      });
      const data = await resp.json();
      if (data && data.success) {
        notifyPiCreated({
          title: `PI ${cleanPiNo} Cancelled`,
          message: data.message || `Proforma Invoice ${cleanPiNo} marked as Cancelled & Declined in Zoho Books.`,
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
  const isRestrictedSalesUser = userRole === 'Sales Executive';

  const getEffectiveSalesPerson = () => {
    if (currentEmpName && currentEmpName !== 'undefined' && currentEmpName !== 'null') return currentEmpName;
    const storedUser = localStorage.getItem('controlroom_logged_user');
    if (storedUser && storedUser.trim() && storedUser !== 'undefined' && storedUser !== 'null') return storedUser.trim();
    if (userRole === 'Sales Head') return 'Vijay';
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
      if (curCode && spCode && spCode === curCode) return true;

      const spName = String(pi.salesPerson || pi.salesperson || pi.salesRep || pi.createdBy || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
      if (curName && spName) {
        if (spName === curName) return true;
        const cleanSp = spName.replace(/\s+/g, '');
        const cleanCur = curName.replace(/\s+/g, '');
        if (cleanSp === cleanCur || cleanSp.includes(cleanCur) || cleanCur.includes(cleanSp)) return true;
      }

      if (curEmail && String(pi.salesPersonEmail || pi.email || '').toLowerCase() === curEmail) return true;

      // Allow viewing company-wide or unassigned Zoho estimates
      if (!spCode && !spName) return true;

      return false;
    });
  }, [piList, isRestrictedSalesUser, currentEmpId, currentEmpName, currentLoggedEmail]);

  useEffect(() => {
    const loadPiData = async () => {
      // 1. Authoritative source: Supabase cloud stores (fast)
      try {
        const [salesCloud, proformaCloud] = await Promise.all([
          fetchCloudStore('sales_pi_store').catch(() => []),
          fetchCloudStore('proforma_invoice_store').catch(() => [])
        ]);

        const mergedMap = new Map();
        const primaryCloud = (Array.isArray(salesCloud) && salesCloud.length > 0)
          ? salesCloud
          : (Array.isArray(proformaCloud) ? proformaCloud : []);

        primaryCloud.forEach(p => {
          if (p && p.piNo) {
            mergedMap.set(String(p.piNo).trim().toLowerCase(), normalizePiRecord(p));
          }
        });

        if (Array.isArray(proformaCloud)) {
          proformaCloud.forEach(p => {
            if (p && p.piNo) {
              const k = String(p.piNo).trim().toLowerCase();
              if (!mergedMap.has(k)) {
                mergedMap.set(k, normalizePiRecord(p));
              }
            }
          });
        }

        if (mergedMap.size > 0) {
          const result = Array.from(mergedMap.values()).map(normalizePiRecord);
          setPiList(result);
          try {
            localStorage.setItem(storageKey, JSON.stringify(result));
          } catch (_) {}
        }
      } catch (err) {
        console.error('Error loading Supabase PI data:', err);
      } finally {
        // Immediately unblock table loading so UI does not wait for external Zoho round-trips
        setTableLoading(false);
      }

      // 2. Fetch Zoho Estimates in background and smoothly enrich without blocking the UI
      try {
        const zohoRes = await fetch('/api/zoho/estimates');
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

              return Array.from(mergedMap.values()).map(normalizePiRecord);
            });
          }
        }
      } catch (_) {}
    };

    loadPiData();

    // Live Realtime sync directly from Supabase Database
    const sub = subscribeToCloudStore('sales_pi_store', (latest) => {
      if (Array.isArray(latest)) {
        setPiList(latest.map(normalizePiRecord));
        setTableLoading(false);
      }
    });

    const onStoreUpdate = () => loadPiData();
    window.addEventListener('controlroom_store_update', onStoreUpdate);

    return () => {
      if (sub && sub.unsubscribe) sub.unsubscribe();
      window.removeEventListener('controlroom_store_update', onStoreUpdate);
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

  // Direct manual or automatic one-click sync of a PI to Zoho Books (Quotes)
  const syncPiToZoho = async (targetPi) => {
    if (!targetPi || syncingPiNo) return;
    const cleanNo = String(targetPi.piNo || targetPi.id || '').trim();
    setSyncingPiNo(cleanNo);
    try {
      const sanitizedPi = stripDataUrlsFromRecord(targetPi);
      delete sanitizedPi.paymentProofDoc;
      delete sanitizedPi.deliveryProofDoc;
      delete sanitizedPi.deliveryAddressProofDoc;

      const res = await fetch('/api/zoho/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sanitizedPi, piNo: cleanNo })
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          res.status === 404
            ? `Backend API server unreachable (HTTP 404). Please ensure the Node.js backend application is running in Plesk / hosting control panel.`
            : `Server returned HTTP ${res.status} (${res.statusText || 'Non-JSON response'}).`
        );
      }

      const data = await res.json();
      const rawEstId = data?.zohoEstimateId || data?.estimate?.zohoEstimateId;
      const estId = (rawEstId && /^\d{15,22}$/.test(String(rawEstId).trim())) ? String(rawEstId).trim() : null;

      if (estId) {
        const finalEstNo = data?.estimate?.piNo || cleanNo;
        const updated = piList.map(p => {
          const matchNo = String(p.piNo || '').trim().toLowerCase();
          const matchId = String(p.id || '').trim().toLowerCase();
          const targetKey = cleanNo.toLowerCase();
          if (matchNo === targetKey || matchId === targetKey || matchNo === finalEstNo.toLowerCase()) {
            return {
              ...p,
              piNo: finalEstNo,
              zohoEstimateId: estId,
              zohoSynced: true,
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
            if (pNo === targetKey || pId === targetKey || pNo === finalEstNo.toLowerCase()) {
              return {
                ...prev,
                piNo: finalEstNo,
                zohoEstimateId: estId,
                zohoSynced: true,
                zohoSyncError: null,
                zohoModule: 'Quotes'
              };
            }
            return prev;
          });
        }
        showTopToast(`✓ Proforma Invoice ${finalEstNo} successfully synced with Zoho Books (Quotes # ${finalEstNo})!`, 'success');
      } else {
        const errMsg = data?.zohoError || data?.notice || data?.error || data?.message || (!res.ok ? `HTTP ${res.status} error` : 'Zoho Books synchronization could not be confirmed. Please verify your connection.');
        showTopToast(`Notice from Zoho Books: ${errMsg}`, 'error', 6000);
      }
    } catch (err) {
      showTopToast(`Notice syncing with Zoho Books: ${err.message}`, 'error', 6000);
    } finally {
      setSyncingPiNo(null);
    }
  };

  const handleConvertToBom = (pi) => {
    if (!pi || isConvertingToBom) return;

    // Strict 1-to-1 Safeguard: If this PI is already converted or linked to an active BOM, navigate directly to it!
    const existingBoms = getConvertedBomsForPi(pi);
    let targetExistingBom = existingBoms && existingBoms.length > 0 ? existingBoms[0] : null;
    if (!targetExistingBom) {
      const pNo = String(pi.piNo || pi.estimate_number || pi.id || '').trim().toLowerCase();
      targetExistingBom = (bomList || []).find(b => {
        if (!b || b.cancelled || b.status === 'Cancelled' || b.status === 'Cancelled & Stock Restored') return false;
        const sPi = String(b.sourcePiNo || b.piNo || '').trim().toLowerCase();
        if (pNo && sPi === pNo) return true;
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

    const billingObj = { street: bStreet, address: bStreet, city: bCity, state: bState, pincode: bPin };
    const deliveryObj = { street: dStreet, address: dStreet, city: dCity, state: dState, pincode: dPin };

    const pGroups = pi.presetGroups || {};
    const pGroupList = Array.isArray(pGroups) ? pGroups : Object.values(pGroups);
    const pName = pi.presetName || (pGroupList.length > 0 ? pGroupList.map(g => `${g.presetName} (${g.setCount} Set${g.setCount > 1 ? 's' : ''})`).join(' + ') : null);
    const pKitPrice = pi.presetKitPrice != null ? pi.presetKitPrice : (pi.kitSubtotal != null ? pi.kitSubtotal : null);
    const pSetCount = pi.presetSetCount || (pGroupList.length > 0 ? pGroupList.reduce((s, g) => s + (parseInt(g.setCount) || 1), 0) : 1);

    const conversionData = {
      sourcePiNo: pi.piNo,
      customerName: pi.vendor || pi.customerName || '',
      companyName: pi.companyName || pi.vendor || pi.customerName || '',
      contactPerson: pi.contactPerson || pi.contact || '',
      phone: pi.phone || pi.mobile || '',
      email: pi.email || '',
      gstNo: pi.gstNo || pi.gst || '',
      productName: pi.productName || 'Solar Mounting Rails & Accessories',
      billingAddress: billingObj,
      billingAddressObj: billingObj,
      billingStreet: bStreet,
      billingCity: bCity,
      billingState: bState,
      billingPincode: bPin,
      deliveryAddress: deliveryObj,
      deliveryAddressObj: deliveryObj,
      deliveryStreet: dStreet,
      deliveryCity: dCity,
      deliveryState: dState,
      deliveryPincode: dPin,
      sameAsBilling: isSameAddr,
      transportMode: pi.transportMode || 'Transport',
      transporterName: pi.transporterName || '',
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
      kitSubtotal: pi.kitSubtotal || null,
      subtotal: pi.subtotal || null,
      grandTotal: pi.grandTotal || null,
      salesPerson: pi.salesPerson || pi.salesperson || pi.salesRep || getEffectiveSalesPerson(),
      salesPersonCode: pi.salesPersonCode || currentEmpId,
      createdBy: pi.createdBy || getEffectiveSalesPerson(),
      createdById: pi.createdById || currentEmpId,
      items: (pi.items && pi.items.length > 0) ? pi.items.map(it => {
        const isPreset = Boolean(it.isPresetItem);
        const resolvedC = it.code || it.sku || it.itemId || resolveProductCode(it) || '';
        return {
          ...it,
          code: resolvedC,
          name: it.name || 'Structural Steel Beams',
          category: it.category || (isPreset ? 'Preset Component' : 'Custom Material'),
          uom: it.uom || 'NOS',
          qty: String(it.qty || '1'),
          baseQty: it.baseQty != null ? it.baseQty : (parseFloat(it.qty) || 1),
          rate: isPreset ? '0' : String(it.rate !== undefined && it.rate !== null && it.rate !== '' ? it.rate : '0'),
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
    if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim() !== '') return stored.trim();
    try {
      const u = JSON.parse(localStorage.getItem('controlroom_logged_user') || '{}');
      if (u.name) return u.name;
      if (u.fullName) return u.fullName;
      if (u.username) return u.username;
    } catch (e) {}
    if (userRole === 'Sales Head') return 'Vijay';
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
      const stored = localStorage.getItem('controlroom_customer_store') || localStorage.getItem('controlroom_crm_customers') || localStorage.getItem('controlroom_customer_list');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
      { code: 'Vikram Solar Pvt Ltd', companyName: 'Vikram Solar Pvt Ltd', c2: 'Vikram Solar Pvt Ltd', gst: '33AABCV1234F1Z5', gstNo: '33AABCV1234F1Z5', contact: 'Rajesh Kannan', contactPerson: 'Rajesh Kannan', phone: '+91 98765 43210', email: 'rajesh@vikramsolar.com', billingAddress: 'Plot 42, SIDCO Industrial Estate, Ambattur', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
      { code: 'Tata Power Solar Systems Ltd', companyName: 'Tata Power Solar Systems Ltd', c2: 'Tata Power Solar Systems Ltd', gst: '29AAACT2345D1ZA', gstNo: '29AAACT2345D1ZA', contact: 'Karthik Raja', contactPerson: 'Karthik Raja', phone: '+91 98450 12345', email: 'karthik@tatapower.com', billingAddress: '12 Electronic City Phase 1', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      { code: 'Waaree Energies Ltd', companyName: 'Waaree Energies Ltd', c2: 'Waaree Energies Ltd', gst: '24AAACW5678B1Z2', gstNo: '24AAACW5678B1Z2', contact: 'Dharmesh Patel', contactPerson: 'Dharmesh Patel', phone: '+91 97234 56789', email: 'dharmesh@waaree.com', billingAddress: '88 Ring Road, Surat', city: 'Surat', state: 'Gujarat', pincode: '395001' }
    ];
  });

  // Sync Customers directly from Supabase, Zoho Books & CRM Customers
  useEffect(() => {
    let isMounted = true;

    const syncCustomers = async () => {
      try {
        let merged = [];
        // 1. Check localStorage first for instant local responsiveness
        try {
          const raw = localStorage.getItem('controlroom_customer_store') || localStorage.getItem('controlroom_crm_customers') || localStorage.getItem('controlroom_customer_list');
          if (raw) {
            const p = JSON.parse(raw);
            if (Array.isArray(p) && p.length > 0) merged = [...p];
          }
        } catch (_) {}

        // 2. Fetch from Supabase Cloud Store
        try {
          const cloudCusts = await fetchCloudStore('customer_store', []);
          if (Array.isArray(cloudCusts) && cloudCusts.length > 0) {
            cloudCusts.forEach(cc => {
              const nameKey = (cc.companyName || cc.name || cc.c2 || cc.code || '').toLowerCase().trim();
              if (nameKey && !merged.some(m => (m.companyName || m.name || m.c2 || m.code || '').toLowerCase().trim() === nameKey)) {
                merged.push(cc);
              }
            });
          }
        } catch (_) {}

        // 3. Fallback to Zoho Customers endpoint if list is small
        if (merged.length < 5) {
          try {
            const zohoRes = await fetch('/api/zoho/customers');
            if (zohoRes.ok) {
              const zList = await zohoRes.json();
              if (Array.isArray(zList) && zList.length > 0) {
                zList.forEach(zc => {
                  const nameKey = (zc.companyName || zc.name || zc.c2 || zc.code || '').toLowerCase().trim();
                  if (nameKey && !merged.some(m => (m.companyName || m.name || m.c2 || m.code || '').toLowerCase().trim() === nameKey)) {
                    merged.push(zc);
                  }
                });
              }
            }
          } catch (_) {}
        }

        if (isMounted && merged.length > 0) {
          setCustomerList(merged);
        }
      } catch (err) {
        console.warn('[PI] Customer sync notice:', err);
      }
    };

    syncCustomers();

    // Subscribe to realtime cloud customer updates
    const realtimeCustSub = subscribeToCloudStore('customer_store', (updatedCusts) => {
      if (isMounted && Array.isArray(updatedCusts) && updatedCusts.length > 0) {
        setCustomerList(prev => {
          const combined = [...updatedCusts];
          (prev || []).forEach(p => {
            const nameKey = (p.companyName || p.name || p.c2 || p.code || '').toLowerCase().trim();
            if (nameKey && !combined.some(c => (c.companyName || c.name || c.c2 || c.code || '').toLowerCase().trim() === nameKey)) {
              combined.push(p);
            }
          });
          return combined;
        });
      }
    });

    const handleLocalCustUpdate = () => syncCustomers();
    window.addEventListener('controlroom_customer_store_updated', handleLocalCustUpdate);
    window.addEventListener('controlroom_storage_update', handleLocalCustUpdate);
    window.addEventListener('storage', handleLocalCustUpdate);

    return () => {
      isMounted = false;
      if (realtimeCustSub && realtimeCustSub.unsubscribe) realtimeCustSub.unsubscribe();
      window.removeEventListener('controlroom_customer_store_updated', handleLocalCustUpdate);
      window.removeEventListener('controlroom_storage_update', handleLocalCustUpdate);
      window.removeEventListener('storage', handleLocalCustUpdate);
    };
  }, []);

  // Full 285+ Standardized Products Catalog with Live Central Inventory Stock
  const [itemsList, setItemsList] = useState(() => getFullProductsCatalogWithStock());

  useEffect(() => {
    const refreshCatalog = () => {
      setItemsList(getFullProductsCatalogWithStock());
    };

    // Ensure all 312 products from server master are loaded immediately
    fetch('/api/raw-materials')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          try {
            localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(data));
          } catch (_) {}
          setItemsList(getFullProductsCatalogWithStock());
        }
      })
      .catch(() => {});

    window.addEventListener('central_inventory_updated', refreshCatalog);
    window.addEventListener('controlroom_storage_update', refreshCatalog);
    window.addEventListener('controlroom_raw_materials_update', refreshCatalog);
    window.addEventListener('controlroom_items_update', refreshCatalog);
    window.addEventListener('storage', refreshCatalog);
    return () => {
      window.removeEventListener('central_inventory_updated', refreshCatalog);
      window.removeEventListener('controlroom_storage_update', refreshCatalog);
      window.removeEventListener('controlroom_raw_materials_update', refreshCatalog);
      window.removeEventListener('controlroom_items_update', refreshCatalog);
      window.removeEventListener('storage', refreshCatalog);
    };
  }, []);

  const getItemStock = (itemName, itemCode) => {
    if (!itemName && !itemCode) return null;
    const cleanName = (itemName || '').replace(/[\u2013\u2014]/g, '-').toLowerCase().trim();
    const cleanCode = (itemCode || '').toLowerCase().trim();
    const resolvedCode = resolveProductCode({ name: itemName, code: itemCode }).toLowerCase().trim();
    const normName = normalizeProductName(cleanName);

    const isMr300 = cleanCode === 'mr-300mm' || resolvedCode === 'mr-300mm' || cleanCode === 'mr300' ||
      ((cleanName.includes('mini rail') || normName.includes('mini rail')) && (cleanName.includes('300') || cleanName === 'mini rail'));

    // 1. Primary authoritative lookup: search in itemsList (synchronous with TypeableProductSelect dropdown)
    const found = (itemsList || []).find(p => {
      const pCode = (p.code || '').toLowerCase().trim();
      const pResCode = resolveProductCode(p).toLowerCase().trim();
      const pName = (p.name || '').replace(/[\u2013\u2014]/g, '-').toLowerCase().trim();
      const pNorm = normalizeProductName(p.name);
      if (isMr300) {
        return pCode === 'mr-300mm' || pCode === 'mr300' || (pName.includes('mini rail') && (pName.includes('300') || pName === 'mini rail'));
      }
      return (resolvedCode && (pCode === resolvedCode || pResCode === resolvedCode)) ||
        (cleanCode && (pCode === cleanCode || pResCode === cleanCode)) ||
        (normName && pNorm === normName) ||
        (cleanName && pName === cleanName) ||
        (cleanName && pName.includes(cleanName));
    });
    if (found) {
      const st = Number(found.availableStock !== undefined ? found.availableStock : (found.stock !== undefined ? found.stock : 0));
      if (!isNaN(st) && st >= 0) return st;
    }

    // 2. Fallback to raw materials store in localStorage
    try {
      const rawSaved = localStorage.getItem('controlroom_raw_materials_store');
      if (rawSaved) {
        const rawList = JSON.parse(rawSaved);
        if (Array.isArray(rawList)) {
          const rawFound = rawList.find(rm => {
            const rmCode = (rm.code || rm.sku || '').toLowerCase().trim();
            const rmResCode = resolveProductCode(rm).toLowerCase().trim();
            const rmName = (rm.name || '').replace(/[\u2013\u2014]/g, '-').toLowerCase().trim();
            if (isMr300) {
              return rmCode === 'mr-300mm' || rmCode === 'mr300' || (rmName.includes('mini rail') && (rmName.includes('300') || rmName === 'mini rail'));
            }
            return (resolvedCode && (rmCode === resolvedCode || rmResCode === resolvedCode)) ||
              (cleanCode && (rmCode === cleanCode || rmResCode === cleanCode)) ||
              (cleanName && (rmName === cleanName || rmName.includes(cleanName) || cleanName.includes(rmName))) ||
              (normName && (normalizeProductName(rm.name) === normName));
          });
          if (rawFound) {
            const isDemo = cleanCode === 'alu-len-2414mm' || resolvedCode === 'alu-len-2414mm' || isMr300;
            const isLegacyDummy = !isDemo && Number(rawFound.goodsReceived || 0) === 0 && Number(rawFound.issuedProd || 0) === 0 &&
              (rawFound.lastUpdated === 'Stock Set to 5,000' || (Number(rawFound.stock) === 5000 && Number(rawFound.physicalStock) === 5000));
            if (isLegacyDummy) return 0;
            const st = Number(rawFound.availableStock !== undefined ? rawFound.availableStock : (rawFound.stock !== undefined ? rawFound.stock : (rawFound.physicalStock || 0)));
            if (!isNaN(st) && st >= 0) return st;
          }
        }
      }
    } catch (_) {}

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
  const [vehicleNo, setVehicleNo] = useState('');
  const [transportScope, setTransportScope] = useState('VRM Structures');

  const [paymentTerms, setPaymentTerms] = useState('100% Paid');
  const [creditDays, setCreditDays] = useState('');
  const [remarks, setRemarks] = useState('');

  // Customer auto-suggest handler
  const handleSelectCustomer = (cName) => {
    setVendorName(cName);
    const cleanSearch = (cName || '').toLowerCase().trim();
    if (!cleanSearch) return;

    const found = (customerList || []).find(c => {
      const cComp = (c.companyName || c.name || c.c2 || c.code || '').toLowerCase().trim();
      return cComp === cleanSearch;
    }) || (customerList || []).find(c => {
      const cComp = (c.companyName || c.name || c.c2 || c.code || '').toLowerCase().trim();
      return cComp.length > 2 && (cComp.startsWith(cleanSearch) || cleanSearch.startsWith(cComp) || cComp.includes(cleanSearch));
    });

    if (found) {
      if (found.gst || found.gstNumber || found.gstNo) setGstNo(found.gst || found.gstNumber || found.gstNo);
      if (found.contact || found.contactPerson) setContactPerson(found.contact || found.contactPerson);
      if (found.phone) setPhone(found.phone);
      if (found.email) setEmail(found.email);
      if (found.paymentTerms) setPaymentTerms(found.paymentTerms);
      const street = found.billingAddress || found.street || found.address || '';
      if (street) setBillingStreet(street);
      if (found.city) setBillingCity(found.city);
      if (found.state) setBillingState(found.state);
      if (found.pincode) setBillingPincode(found.pincode);
      if (sameAsBilling) {
        if (street) setDeliveryStreet(street);
        if (found.city) setDeliveryCity(found.city);
        if (found.state) setDeliveryState(found.state);
        if (found.pincode) setDeliveryPincode(found.pincode);
      }
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

    const newItems = targetPreset.items.map(it => {
      const baseQ = parseFloat(it.qty) || 1;
      const resCode = resolveProductCode(it);
      return {
        ...it,
        code: it.code || resCode,
        presetGroupId: groupId,
        presetName,
        baseQty: baseQ,
        qty: String(Math.round(baseQ * multiplier)),
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
    const existingNums = (piList || []).map(p => {
      const match = String(p.piNo || p.id || '').match(/PI-(\d+)/i);
      return match ? parseInt(match[1], 10) : 0;
    }).filter(n => Number.isFinite(n) && n > 0);
    const localMax = existingNums.length > 0 ? Math.max(0, ...existingNums) : 0;
    const fallback = `PI-${String(localMax + 1).padStart(5, '0')}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const res = await fetch('/api/zoho/next-pi-number', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.nextPiNo) {
          const serverNum = data.nextNum || (parseInt(data.nextPiNo.replace(/[^0-9]/g, ''), 10) || 0);
          const trueMax = Math.max(localMax, serverNum - 1);
          const finalNo = 'PI-' + String(trueMax + 1).padStart(5, '0');
          setPiNumber(finalNo);
          return finalNo;
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
        if (!it.name || !it.name.trim()) {
          invalid.push(`Item #${idx + 1}: Name is required`);
        } else if (q <= 0) {
          invalid.push(`Item #${idx + 1} (${it.name}): Quantity must be > 0`);
        }
      });
      if (invalid.length > 0) {
        missingList.push({
          field: 'Incomplete Item Details',
          message: invalid.join(' • '),
          targetId: 'pi-field-items'
        });
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (validUntilDate && validUntilDate < todayStr) {
      missingList.push({
        field: 'Payment Due / Valid Until Date',
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
    setPiConfirmModal('draft');
  };

  // Submits the new or edited PI
  const executeCreatePI = async (isDraft = false) => {
    if (isSubmittingPI) return;
    setIsSubmittingPI(true);
    try {
      const totals = calculatePiTotals();
      const joinedProducts = piItems.map(it => it.name).filter(Boolean).join(', ') || 'Solar Structure & Accessories';

      let cleanPiNo;
      if (editIdx !== null) {
        cleanPiNo = (piNumber && piNumber.trim() && piNumber !== 'Auto-Assigned')
          ? piNumber.trim().toUpperCase()
          : (piList[editIdx]?.piNo || `PI-${String(editIdx + 1).padStart(5, '0')}`);
      } else {
        // Generate the sequential PI number at the last step upon final submission (same as BOM)
        cleanPiNo = await fetchNextPiNumber();
      }

      setPiNumber(cleanPiNo);

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
        status: isDraft ? 'Draft' : (editIdx !== null ? (piList[editIdx].status === 'Pending Approval' || piList[editIdx].status === 'Approved' ? 'Issued' : piList[editIdx].status) : 'Issued'),
        statusType: isDraft ? 'draft' : (editIdx !== null ? (piList[editIdx].statusType === 'pending' || piList[editIdx].statusType === 'approved' ? 'issued' : piList[editIdx].statusType) : 'issued'),
        salesPerson: editIdx !== null ? (piList[editIdx].salesPerson || getEffectiveSalesPerson()) : getEffectiveSalesPerson(),
        salesperson: editIdx !== null ? (piList[editIdx].salesPerson || getEffectiveSalesPerson()) : getEffectiveSalesPerson(),
        salesPersonCode: editIdx !== null ? (piList[editIdx].salesPersonCode || currentEmpId || 'SE-VRM001') : (currentEmpId || 'SE-VRM001'),
        salesPersonEmail: editIdx !== null ? (piList[editIdx].salesPersonEmail || currentLoggedEmail || 'sales@armsai.com') : (currentLoggedEmail || 'sales@armsai.com'),
        createdBy: editIdx !== null ? (piList[editIdx].createdBy || getEffectiveSalesPerson()) : getEffectiveSalesPerson(),
        createdById: editIdx !== null ? (piList[editIdx].createdById || currentEmpId || 'SE-VRM001') : (currentEmpId || 'SE-VRM001'),
        zohoSynced: editIdx !== null ? (piList[editIdx].zohoSynced || false) : false,
        zohoEstimateId: editIdx !== null ? (piList[editIdx].zohoEstimateId || null) : null,
        zohoModule: 'Quotes'
      };

      let updatedList;
      if (editIdx !== null) {
        updatedList = [...piList];
        updatedList[editIdx] = newPI;
        setEditIdx(null);
      } else {
        updatedList = [newPI, ...piList];
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

      // Push to Zoho Books Quotes (Estimates API)
      fetch('/api/zoho/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPI)
      }).then(res => res.json()).then(data => {
        const rawEstId = data?.zohoEstimateId || data?.estimate?.zohoEstimateId;
        const estId = (rawEstId && /^\d{15,22}$/.test(String(rawEstId).trim())) ? String(rawEstId).trim() : null;
        if (estId) {
          const finalEstNo = data?.estimate?.piNo || newPI.piNo;
          console.log('[ZOHO ESTIMATE SYNC SUCCESS]', estId);
          const enrichedList = updatedList.map(p => (p.piNo === newPI.piNo || p.id === newPI.id) ? {
            ...p,
            piNo: finalEstNo,
            zohoEstimateId: estId,
            zohoSynced: true,
            zohoSyncError: null,
            zohoModule: 'Quotes'
          } : p);
          updatePiList(enrichedList);
        } else if (data && data.zohoError) {
          console.warn('[ZOHO ESTIMATE SYNC NOTICE]', data.zohoError);
          const enrichedList = updatedList.map(p => (p.piNo === newPI.piNo || p.id === newPI.id) ? {
            ...p,
            zohoSynced: false,
            zohoSyncError: data.zohoError
          } : p);
          updatePiList(enrichedList);
        }
      }).catch(err => {
        console.warn('[ZOHO ESTIMATE SYNC NOTICE]', err);
      });

      // Instantly dismiss modal and advance to list view so user is never stuck
      setPiConfirmModal(null);
      resetForm();
      setViewMode('list');

      // In-app top message notification (Self-dismissing, NO browser alert modal or OK button)
      const safeCustomer = (vendorName || customerName || 'Customer').trim();
      showTopToast(
        isDraft
          ? `📝 Proforma Invoice (${cleanPiNo}) for ${safeCustomer} has been saved as Draft.`
          : `✅ You have completed the PI (${cleanPiNo}) for ${safeCustomer}!`,
        'success',
        6000
      );
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
    setRemarks(pi.remarks || '');
    setTransportMode(pi.transportMode || 'Transport');
    setTransporterName(pi.transporterName || '');
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

          const isConverted = hasSavedBom && Boolean(pi.convertedToBom || pi.status === 'Converted to BOM' || pi.convertedBomNo || pi.convertedBomCode);
          const currentStatus = isConverted
            ? 'Converted to BOM'
            : ((pi.status === 'Pending Approval' || pi.status === 'Approved' || pi.status === 'Converted to BOM')
              ? 'Issued'
              : (pi.status || 'Issued'));

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
                <input
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

                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} style={{ height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 24px 0 10px', fontSize: '13px', backgroundColor: 'white', color: '#334155', minWidth: '130px', outline: 'none' }}>
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
                    const matchedBoms = getConvertedBomsForPi(pi);
                    const isConverted = matchedBoms.length > 0 && Boolean(pi.convertedToBom || pi.status === 'Converted to BOM' || pi.convertedBomNo || pi.convertedBomCode);
                    const st = isConverted ? 'Converted to BOM' : ((pi.status === 'Pending Approval' || pi.status === 'Approved' || pi.status === 'Converted to BOM') ? 'Issued' : (pi.status || 'Issued'));
                    return st === 'Issued';
                  }).length },
                  { id: 'Converted to BOM', label: 'Converted to BOM', count: visiblePIList.filter(pi => {
                    const matchedBoms = getConvertedBomsForPi(pi);
                    return matchedBoms.length > 0 && Boolean(pi.convertedToBom || pi.status === 'Converted to BOM' || pi.convertedBomNo || pi.convertedBomCode);
                  }).length },
                  { id: 'Cancelled', label: 'Cancelled', count: visiblePIList.filter(pi => pi.status === 'Cancelled').length },
                  { id: 'Draft', label: 'Draft', count: visiblePIList.filter(pi => pi.status === 'Draft').length }
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
                        <input
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
                                      <span className="businz-pulse-dot" /> Live Cloud & Zoho Sync
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>
                                    Retrieving quotation records from BUSINZ Cloud Storage & Zoho Books...
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {Array.from({ length: 6 }).map((_, idx) => (
                          <tr key={`pi-skeleton-${idx}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ textAlign: 'center', padding: '12px 0', width: '48px' }}>
                              <input type="checkbox" defaultChecked={false} disabled style={{ opacity: 0.3 }} />
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

                        const matchedBoms = getConvertedBomsForPi(pi);
                        const hasSavedBom = matchedBoms.length > 0;
                        const isConverted = hasSavedBom && Boolean(pi.convertedToBom || pi.status === 'Converted to BOM' || pi.convertedBomNo || pi.convertedBomCode);
                        const currentStatus = isConverted
                          ? 'Converted to BOM'
                          : ((pi.status === 'Pending Approval' || pi.status === 'Approved' || pi.status === 'Converted to BOM')
                            ? 'Issued'
                            : (pi.status || 'Issued'));

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
                              <input
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
                              {pi.zohoEstimateId ? (
                                <span style={{ fontSize: '10px', fontWeight: '700', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }} title={`Synced to Zoho Books Quotes (Estimate ID: ${pi.zohoEstimateId})`}>
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#059669', display: 'inline-block' }}></span>
                                  Zoho Quotes
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={Boolean(syncingPiNo)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    syncPiToZoho(pi);
                                  }}
                                  style={{
                                    fontSize: '9.5px',
                                    fontWeight: '700',
                                    color: '#0E7490',
                                    backgroundColor: '#F0FDFA',
                                    border: '1px solid #A5F3FC',
                                    borderRadius: '4px',
                                    padding: '1px 5px',
                                    cursor: syncingPiNo ? 'not-allowed' : 'pointer',
                                    marginTop: '2px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    opacity: (syncingPiNo && syncingPiNo !== String(pi.piNo || pi.id).trim()) ? 0.5 : 1
                                  }}
                                  title="Click to sync this PI directly with Zoho Books Quotes"
                                >
                                  {syncingPiNo === String(pi.piNo || pi.id).trim() ? (
                                    <>
                                      <RotateCcw size={10} style={{ animation: 'spin 0.75s linear infinite' }} />
                                      Syncing...
                                    </>
                                  ) : (
                                    <>↻ Sync Zoho</>
                                  )}
                                </button>
                              )}
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
                                          📦 {bCode} ↗
                                        </button>
                                      );
                                    })}
                                  </div>
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
                        <select
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
                        <input
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
                  const matchedBoms = getConvertedBomsForPi(target);
                  const hasSavedBom = matchedBoms.length > 0;
                  const isConverted = hasSavedBom && Boolean(target.convertedToBom || target.status === 'Converted to BOM' || target.convertedBomNo || target.convertedBomCode);

                  if (isConverted) {
                    const firstBomCode = matchedBoms[0]?.bomCode || matchedBoms[0]?.code || matchedBoms[0]?.id;
                    return (
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
                    );
                  }

                  return (
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

                {/* Zoho Books Action */}
                {(() => {
                  const targetPiNo = selectedPIs[0];
                  const targetPi = targetPiNo ? piList.find(p => p.piNo === targetPiNo) : null;
                  if (!targetPi) return null;

                  if (targetPi.zohoEstimateId) {
                    return (
                      <a
                        href={`https://books.zoho.in/app/60082137608#/quotes/${targetPi.zohoEstimateId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setSelectedPIs([])}
                        style={{
                          backgroundColor: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          color: '#059669',
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
                          textDecoration: 'none',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          transition: 'all 0.15s ease'
                        }}
                        title="View official Quote in Zoho Books"
                      >
                        <ShieldCheck size={14} style={{ color: '#059669' }} /> Zoho Quotes ↗
                      </a>
                    );
                  }

                  const isTargetSyncing = syncingPiNo && syncingPiNo === String(targetPi.piNo || targetPi.id || '').trim();
                  return (
                    <button
                      disabled={Boolean(syncingPiNo)}
                      onClick={() => {
                        setSelectedPIs([]);
                        syncPiToZoho(targetPi);
                      }}
                      style={{
                        backgroundColor: '#F0FDFA',
                        border: '1px solid #A5F3FC',
                        color: '#0E7490',
                        borderRadius: '10px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: syncingPiNo ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        transition: 'all 0.15s ease',
                        opacity: syncingPiNo ? 0.7 : 1
                      }}
                      title="Sync this PI directly to Zoho Books Quotes"
                    >
                      <RotateCcw size={14} style={{ color: '#0E7490', animation: isTargetSyncing ? 'spin 0.75s linear infinite' : 'none' }} />
                      {isTargetSyncing ? 'Syncing to Zoho...' : 'Sync to Zoho'}
                    </button>
                  );
                })()}

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
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    PI Date
                  </label>
                  <input
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
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Payment Due / Valid Until Date
                  </label>
                  <input
                    id="pi-field-validUntil"
                    type="date"
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
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    PI Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
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
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Sales Executive
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
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
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Payment Terms
                  </label>
                  <select
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
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Transport Scope
                  </label>
                  <select
                    value={transportScope}
                    onChange={(e) => setTransportScope(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="VRM Structures">VRM Structures</option>
                    <option value="Customer Scope">Customer Scope</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Transport Mode
                  </label>
                  <select
                    value={transportMode}
                    onChange={(e) => setTransportMode(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', backgroundColor: 'white', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="Transport">Transport</option>
                    <option value="Own Vehicle">Own Vehicle</option>
                    <option value="Portal">Portal</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Transporter Name
                  </label>
                  <input
                    type="text"
                    value={transporterName}
                    placeholder="e.g. VRL Logistics, SafeXpress..."
                    onChange={(e) => setTransporterName(e.target.value)}
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
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Company Name <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    id="pi-field-vendorName"
                    type="text"
                    list="pi-customers-datalist"
                    placeholder="Search or enter company..."
                    value={vendorName}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', fontWeight: '600', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <datalist id="pi-customers-datalist">
                    {(customerList || []).reduce((acc, c) => {
                      const name = (c.companyName || c.name || c.c2 || c.code || '').trim();
                      if (name && !acc.some(item => (item.companyName || item.name || item.c2 || item.code || '').trim().toLowerCase() === name.toLowerCase())) {
                        acc.push(c);
                      }
                      return acc;
                    }, []).map((c, idx) => {
                      const name = (c.companyName || c.name || c.c2 || c.code || '').trim();
                      const gst = c.gst || c.gstNumber || c.gstNo;
                      const contact = c.contact || c.contactPerson;
                      const city = c.city || '';
                      const details = [gst ? `GST: ${gst}` : null, contact ? `Contact: ${contact}` : null, city].filter(Boolean).join(' • ');
                      return (
                        <option key={idx} value={name}>
                          {details}
                        </option>
                      );
                    })}
                  </datalist>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Customer Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Kannan"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Phone Number
                  </label>
                  <input
                    id="pi-field-phone"
                    type="text"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={{ width: '100%', height: '42px', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '0 14px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input
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
                  <input
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
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Street / Premises Address</label>
                      <input
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
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City</label>
                        <input
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
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                        <input
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
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>PIN Code</label>
                        <input
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
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '700', color: '#0E7490', cursor: 'pointer', backgroundColor: '#ECFEFF', padding: '4px 10px', borderRadius: '6px', border: '1px solid #A5F3FC' }}>
                      <input
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
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>Site / Dispatch Location Address</label>
                      <input
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
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>City / District</label>
                        <input
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
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>State</label>
                        <input
                          type="text"
                          disabled={sameAsBilling}
                          placeholder="State"
                          value={sameAsBilling ? billingState : deliveryState}
                          onChange={(e) => setDeliveryState(e.target.value)}
                          style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '0 12px', fontSize: '12px', color: '#0F172A', outline: 'none', boxSizing: 'border-box', backgroundColor: sameAsBilling ? '#F1F5F9' : 'white', cursor: sameAsBilling ? 'not-allowed' : 'text' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '4px' }}>PIN Code</label>
                        <input
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
                        <input
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
                      <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%' }}>Price (₹)</th>
                      <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%', textAlign: 'center' }}>GST Rate</th>
                      {hasAnyPreset && <th style={{ padding: '12px 10px', fontWeight: '700', width: '10%', color: '#0E7490', backgroundColor: '#ECFEFF' }}>Preset Amt (₹)</th>}
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
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Select an engineering Preset above or click "+ Add Product / Item" to author PI line items</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      piItems.map((item, i) => {
                        const isChecked = selectedItemIndexes.includes(i);
                        const isPresetItem = Boolean(item.isPresetItem);
                        const groupId = item.presetGroupId;
                        const currentGroup = groupId ? (presetGroups[groupId] || { kitPrice: '', setCount: 1, presetName: item.presetName }) : null;

                        let isFirstInGroup = false;
                        let groupCount = 0;
                        if (isPresetItem && groupId) {
                          const itemsInGroup = piItems.filter(it => it.presetGroupId === groupId);
                          groupCount = itemsInGroup.length;
                          isFirstInGroup = piItems.findIndex(it => it.presetGroupId === groupId) === i;
                        }

                        const q = parseFloat(item.qty) || 0;
                        const r = parseFloat(item.rate) || 0;
                        const taxable = isPresetItem ? 0 : q * r;
                        const gstPct = parseFloat(String(item.gstRate || '18%').replace('%', '')) || 18;
                        const itemTotal = taxable + (taxable * (gstPct / 100));

                        return (
                          <tr
                            key={i}
                            style={{
                              borderBottom: '1px solid #F1F5F9',
                              backgroundColor: isChecked ? '#ECFEFF' : (isPresetItem ? '#F8FAFC' : 'transparent'),
                              transition: 'background-color 0.15s ease'
                            }}
                          >
                            <td style={{
                              padding: '12px 14px',
                              textAlign: 'center',
                              borderLeft: isChecked ? '4px solid #0E7490' : '4px solid transparent'
                            }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedItemIndexes(prev => [...prev, i]);
                                  else setSelectedItemIndexes(prev => prev.filter(idx => idx !== i));
                                }}
                                style={{ accentColor: '#0E7490', cursor: 'pointer' }}
                              />
                            </td>
                            <td style={{ padding: '12px 10px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <TypeableProductSelect
                                  value={item.name || ''}
                                  itemsList={itemsList}
                                  placeholder="Type or select product / item..."
                                  accentColor="#0E7490"
                                  onChange={(val, matched) => {
                                    if (!matched) {
                                      setPiItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, name: val } : mat));
                                      return;
                                    }
                                    const pName = matched.name;
                                    const pCat = matched.category || matched.description || item.category;
                                    const pCode = matched.code || matched.sku || resolveProductCode(matched) || item.code;
                                    const isSolar5 = is5PctSolarProduct(pName, pCat);
                                    setPiItems(prev => prev.map((mat, idx) => idx === i ? {
                                      ...mat,
                                      code: pCode || mat.code,
                                      name: pName,
                                      rate: matched.price || matched.rate ? String(matched.price || matched.rate) : mat.rate,
                                      uom: matched.uom || matched.unit || mat.uom,
                                      category: pCat,
                                      gstRate: isSolar5 ? '5%' : (mat.gstRate || '18%')
                                    } : mat));
                                  }}
                                />
                                <input
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
                              </div>
                            </td>
                            <td style={{ padding: '12px 10px' }}>
                              <input
                                type="text"
                                list={`pi-uom-list-${i}`}
                                placeholder="UOM"
                                value={item.uom || 'NOS'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPiItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, uom: val } : mat));
                                }}
                                style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '12px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF', fontWeight: '600' }}
                              />
                              <datalist id={`pi-uom-list-${i}`}>
                                <option value="NOS" />
                                <option value="SET" />
                                <option value="KG" />
                                <option value="MTR" />
                                <option value="PCS" />
                                <option value="BOX" />
                                <option value="PKT" />
                                <option value="PAIR" />
                              </datalist>
                            </td>
                            <td style={{ padding: '12px 10px', verticalAlign: 'middle' }}>
                              <div style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <input
                                  type="number"
                                  value={item.qty}
                                  placeholder="0"
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPiItems(prev => prev.map((mat, idx) => idx === i ? { ...mat, qty: val } : mat));
                                  }}
                                  style={{ width: '100%', height: '38px', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '0 8px', fontSize: '13px', textAlign: 'center', outline: 'none', boxSizing: 'border-box', fontWeight: '600', backgroundColor: '#FFFFFF' }}
                                />
                              </div>
                            </td>
                            <td style={{ padding: '12px 10px' }}>
                              {isPresetItem ? (
                                <span style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic' }}>—</span>
                              ) : (
                                <input
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
                              <select
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
                                        backgroundColor: '#EEF2FF',
                                        borderLeft: '2px solid #C7D2FE',
                                        borderRight: '2px solid #C7D2FE'
                                      }}
                                    >
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                        <span
                                          style={{
                                            fontSize: '11px',
                                            fontWeight: '800',
                                            color: '#4338CA',
                                            textAlign: 'center',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            maxWidth: '120px',
                                            display: 'block'
                                          }}
                                          title={currentGroup?.presetName}
                                        >
                                          {currentGroup?.presetName}
                                        </span>

                                        <div style={{ position: 'relative', width: '100%' }}>
                                          <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', fontWeight: '700', color: '#6366F1', pointerEvents: 'none' }}>₹</span>
                                          <input
                                            type="number"
                                            value={currentGroup?.kitPrice || ''}
                                            placeholder="0.00"
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
                                              border: '2px solid #818CF8', padding: '0 10px 0 26px',
                                              fontSize: '15px', fontWeight: '800', color: '#312E81',
                                              textAlign: 'right', outline: 'none', boxSizing: 'border-box',
                                              backgroundColor: 'white'
                                            }}
                                          />
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                          <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: '600' }}>
                                            {groupCount} items ×
                                          </span>
                                          <input
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
                                              const multiplier = isNaN(parsed) ? 0 : Math.max(0, parsed);
                                              setPiItems(prev => prev.map(mat => {
                                                if ((mat.presetGroupId || 'legacy_default') === groupId && mat.baseQty) {
                                                  return { ...mat, qty: String(Math.round(mat.baseQty * multiplier)) };
                                                }
                                                return mat;
                                              }));
                                            }}
                                            style={{
                                              width: '42px', height: '26px', borderRadius: '6px',
                                              border: '1.5px solid #818CF8', fontSize: '13px',
                                              fontWeight: '800', color: '#312E81', textAlign: 'center',
                                              padding: '0 2px', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box'
                                            }}
                                            title="Sets multiplier for this preset"
                                          />
                                          <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: '600' }}>
                                            set{(parseInt(currentGroup?.setCount) || 1) !== 1 ? 's' : ''}
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                           <span style={{ fontSize: '10px', color: '#6366F1', fontWeight: '700' }}>GST:</span>
                                           <select
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
                                               border: '1.5px solid #818CF8', padding: '0 4px',
                                               fontSize: '11px', fontWeight: '800',
                                               color: '#312E81', backgroundColor: '#FFFFFF',
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleAddMaterialRow}
                  style={{ border: '1px solid #A5F3FC', background: '#ECFEFF', color: '#0E7490', padding: '9px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus style={{ width: '15px', height: '15px' }} />
                  Add Product / Item
                </button>
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
                  Confirm & Save Proforma Invoice
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
        const matchedBoms = getConvertedBomsForPi(selectedPi);
        const hasSavedBom = matchedBoms.length > 0;
        const isConverted = hasSavedBom && Boolean(selectedPi.convertedToBom || selectedPi.status === 'Converted to BOM' || selectedPi.convertedBomNo || selectedPi.convertedBomCode);

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
                        isConverted ? 'converted' : selectedPi.status === 'Cancelled' ? 'cancelled' : selectedPi.status === 'Draft' ? 'draft' : 'issued',
                        isConverted ? 'Converted to BOM' : selectedPi.status || 'Issued'
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
                  {selectedPi.zohoEstimateId ? (
                    <a
                      href={`https://books.zoho.in/app/60082137608#/quotes/${selectedPi.zohoEstimateId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open and view official Quote in Zoho Books"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        backgroundColor: '#ECFDF5',
                        color: '#059669',
                        border: '1.5px solid #A7F3D0',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '800',
                        textDecoration: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      ✓ Zoho Quotes ↗
                    </a>
                  ) : (() => {
                    const isSelectedSyncing = syncingPiNo && syncingPiNo === String(selectedPi.piNo || selectedPi.id || '').trim();
                    return (
                      <button
                        type="button"
                        disabled={Boolean(syncingPiNo)}
                        onClick={() => syncPiToZoho(selectedPi)}
                        title="Push this Proforma Invoice to Zoho Books Quotes"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          backgroundColor: '#F0FDFA',
                          color: '#0E7490',
                          border: '1.5px solid #0E7490',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '800',
                          cursor: syncingPiNo ? 'not-allowed' : 'pointer',
                          opacity: syncingPiNo ? 0.7 : 1
                        }}
                      >
                        <RotateCcw size={14} style={{ color: '#0E7490', animation: isSelectedSyncing ? 'spin 0.75s linear infinite' : 'none' }} />
                        {isSelectedSyncing ? 'Syncing to Zoho...' : 'Sync to Zoho'}
                      </button>
                    );
                  })()}
                  {(() => {
                    const matchedBoms = getConvertedBomsForPi(selectedPi);
                    const isConverted = (matchedBoms && matchedBoms.length > 0) || Boolean(selectedPi?.status === 'Converted to BOM' || selectedPi?.convertedToBom || selectedPi?.convertedBomCode);
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
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#059669', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                        📦
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
                      {piItemsList.length > 0 ? (
                        piItemsList.map((it, idx) => {
                          const isPreset = Boolean(it.isPresetItem || it.presetGroupId || (!it.rate && subtotalVal > 0));
                          const itQty = parseFloat(it.qty) || 1;
                          const itRate = parseFloat(it.rate) || 0;
                          const itTaxable = isPreset ? 0 : (itQty * itRate);
                          const itGstPct = parseFloat(String(it.gstRate || '18').replace('%', '')) || 18;
                          const itAmt = isPreset ? null : (itTaxable + (itTaxable * (itGstPct / 100)));

                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                              <td style={{ padding: '10px 12px', color: '#64748B', fontWeight: '600' }}>{idx + 1}</td>
                              <td style={{ padding: '10px 12px', color: '#0F172A', fontWeight: '700' }}>
                                <div>{it.name || 'Component Item'}</div>
                                {it.category && <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 'normal' }}>{it.category}</span>}
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
                                  <span style={{ fontSize: '11px', color: '#0E7490', fontStyle: 'italic', fontWeight: '600' }}>In Kit</span>
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
                          );
                        })
                      ) : (
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
                      {cancellingPiNo === selectedPi.piNo ? 'Cancelling in Zoho...' : 'Cancel PI'}
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
                    selectedPi.status !== 'Cancelled' && (
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
