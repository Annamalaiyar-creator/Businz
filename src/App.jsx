import React, { useState, useEffect, useRef, Component, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import KPIGrid from './components/KPIGrid';
import POTrendChart from './components/POTrendChart';
import POStatusOverview from './components/POStatusOverview';
import RecentPurchaseOrders from './components/RecentPurchaseOrders';
import SidebarRightColumn from './components/SidebarRightColumn';
import MaterialReorderAlerts from './components/MaterialReorderAlerts';
import LoginScreen from './components/LoginScreen';
import NotificationToast from './components/NotificationToast';
import realtimeNotificationService from './services/realtimeNotificationService';


// Route/View-Level Code Splitting via React.lazy() (Preserves all behavior, isolates bundle weight)
const PerformaInvoiceView = lazy(() => import('./components/PerformaInvoiceView'));
const PurchaseOrdersView = lazy(() => import('./components/PurchaseOrdersView'));
const DeliveryChallansView = lazy(() => import('./components/DeliveryChallansView'));
const OtherViews = lazy(() => import('./components/OtherViews'));
const DashboardFullReference = lazy(() => import('./components/DashboardFullReference'));
const InventoryAutoConversion = lazy(() => import('./components/InventoryAutoConversion'));
const VRMTemplateStudioView = lazy(() => import('./components/VRMTemplateStudioView'));
const ProductionAdminView = lazy(() => import('./components/ProductionAdminView'));
const SalesExecutiveDashboardView = lazy(() => import('./components/views/SalesExecutiveDashboardView'));
const AccountsFinanceDashboard = lazy(() => import('./components/views/AccountsFinanceDashboard'));
const BillingDashboardView = lazy(() => import('./components/views/BillingDashboardView'));
const CeoExecutiveDashboardView = lazy(() => import('./components/views/CeoExecutiveDashboardView'));
const TechSupportDashboardView = lazy(() => import('./components/views/TechSupportDashboardView'));
const TechnicalAdminDashboardView = lazy(() => import('./components/views/TechnicalAdminDashboardView'));
const DeveloperPortalView = lazy(() => import('./components/DeveloperPortalView'));
const CustomerOrderTrackingPortal = lazy(() => import('./components/tracking/CustomerOrderTrackingPortal'));
const CustomerOrderTrackingView = lazy(() => import('./components/views/CustomerOrderTrackingView'));

import { ShoppingCart, Factory, Shield, User, ArrowRight, Receipt, RefreshCw, Clock } from 'lucide-react';
import {
  heartbeatActiveSession,
  revokeSession,
  upsertSavedAccount,
  removeSavedAccount,
  activateSavedAccountLocal,
  verifySavedAccountSession
} from './services/sessionService';
import { playWorkflowNotificationSound, unlockNotificationAudio } from './services/notificationService';
import { getPurchaseOrders, getItems } from './services/businzDataService';
import { fetchMasterBranding } from './services/brandingService';
import { initRealtimeSync } from './services/realtimeSyncService';
import { fetchCloudStore } from './utils/supabaseDataSync';
import { CANONICAL_PRODUCT_ALIASES } from './utils/vrmProductsData';

function AppViewLoadingFallback({ activeTab }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '320px',
      padding: '40px',
      backgroundColor: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid #E2E8F0',
      margin: '20px 0',
      boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)'
    }}>
      <div style={{
        width: '34px',
        height: '34px',
        border: '3px solid #E2E8F0',
        borderTopColor: '#0E7490',
        borderRadius: '50%',
        animation: 'controlroom_spin 0.8s linear infinite'
      }} />
      <style>{`@keyframes controlroom_spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{
        marginTop: '16px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#475569',
        fontFamily: "'DM Sans', -apple-system, sans-serif"
      }}>
        Loading {activeTab || 'BUSINZ Dashboard'}...
      </div>
    </div>
  );
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('App render error caught by boundary:', error, errorInfo);
    if (error?.message && (error.message.includes('dynamically imported module') || error.message.includes('Failed to fetch dynamically imported module'))) {
      const reloadKey = 'businz_chunk_reload_ts';
      const lastReload = Number(sessionStorage.getItem(reloadKey) || 0);
      if (Date.now() - lastReload > 8000) {
        sessionStorage.setItem(reloadKey, String(Date.now()));
        console.warn('[BUSINZ] Dynamic chunk missing (deployment update). Auto-refreshing...');
        window.location.reload();
      }
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
          color: '#0F172A',
          fontFamily: "'DM Sans', -apple-system, sans-serif",
          padding: '24px'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '32px',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.05)'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>Dashboard Render Recovery</h2>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '20px', lineHeight: '1.5' }}>
              The dashboard encountered a temporary loading issue. Click below to refresh your dashboard session.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center' }}>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    try {
                      sessionStorage.clear();
                      localStorage.removeItem('controlroom_active_tab');
                      localStorage.removeItem('controlroom_po_view_mode');
                      localStorage.removeItem('controlroom_viewing_po');
                    } catch (_) {}
                    this.setState({ hasError: false, error: null });
                    window.location.reload();
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <RefreshCw size={14} /> Reset to Dashboard
                </button>
                <button
                  onClick={() => {
                    try {
                      sessionStorage.clear();
                      localStorage.clear();
                    } catch (_) {}
                    this.setState({ hasError: false, error: null });
                    window.location.reload();
                  }}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: '#F1F5F9',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Sign In Again
                </button>
              </div>

              {this.state.error && (
                <details open style={{ marginTop: '14px', textAlign: 'left', backgroundColor: '#FEF2F2', padding: '12px 14px', borderRadius: '8px', border: '1px solid #FECACA', fontSize: '11px', color: '#991B1B' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: '700', color: '#DC2626', marginBottom: '6px' }}>Error Diagnostic Info</summary>
                  <pre style={{ marginTop: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#991B1B', maxHeight: '180px', overflowY: 'auto', fontSize: '11px', fontFamily: 'monospace' }}>
                    {this.state.error.stack || this.state.error.toString()}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// 🛡️ Defensive Startup Protection: Automatically sanitize bloated or corrupted legacy localStorage caches (> 400 KB)
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const bloatedKeys = [
      'controlroom_customer_store',
      'businz_crm_customers',
      'controlroom_customers_store',
      'customer_store',
      'crm_customers',
      'controlroom_raw_materials_store',
      'controlroom_items_list',
      'controlroom_central_items_v2'
    ];
    bloatedKeys.forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        if (raw && raw.length > 400000) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            localStorage.setItem(k, JSON.stringify(parsed.slice(0, 300)));
          } else {
            localStorage.removeItem(k);
          }
        }
      } catch (_) {
        try { localStorage.removeItem(k); } catch (__) {}
      }
    });
  }
} catch (_) {}

function App() {
  // Default sidebar collapsed to TRUE (closed/inside by default on loading)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [toastAlert, setToastAlert] = useState(null);


  const showCustomAlert = (msg, title, type = 'info') => {
    setToastAlert({ message: msg, title, type });
  };

  // Authentication & Role State (Strict authentication guard - defaults to FALSE unless logged in)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const val = localStorage.getItem('controlroom_is_authenticated');
    return val === 'true';
  });

  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('controlroom_user_role') || '';
  });

  // Active Tab State (Restores current active tab on page refresh or URL search param)
  const [activeTab, setActiveTab] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const urlTab = urlParams.get('tab');
        if (urlTab && urlTab.trim()) return urlTab.trim();
      }
    } catch (_) {}
    return localStorage.getItem('controlroom_active_tab') || 'Dashboard';
  });

  // Technical Administrator view mode ('console' or 'erp')
  const [devViewMode, setDevViewMode] = useState(() => {
    return localStorage.getItem('controlroom_dev_view_mode') || 'console';
  });

  // Initialize WhatsApp-Style Real-Time Push Sync Engine across all modules
  useEffect(() => {
    initRealtimeSync();
    try {
      if (localStorage.getItem('controlroom_prod_cutover_stock_zero_20261006_v2') !== 'true') {
        const wipeKeys = [
          'controlroom_bom_store',
          'controlroom_sales_pi_store',
          'controlroom_proforma_invoice_store',
          'controlroom_procurement_pi_store',
          'sales_pi_store',
          'proforma_invoice_store',
          'controlroom_po_store',
          'controlroom_grn_store',
          'controlroom_invoice_store',
          'controlroom_payment_store',
          'controlroom_workorder_store',
          'controlroom_vrm_prod_workorders',
          'controlroom_vrm_prod_ledger',
          'controlroom_central_reservations_v2',
          'controlroom_central_grns_v2',
          'controlroom_goods_receipt_notes',
          'goods_receipt_notes',
          'controlroom_dc_store',
          'controlroom_converting_bom',
          'controlroom_converting_pi',
          'controlroom_viewing_po',
          'controlroom_pending_reorder_po',
          'controlroom_notifications_store',
          'controlroom_read_notification_ids',
          'controlroom_dismissed_alerts',
          'controlroom_central_items_v2',
          'controlroom_items_list',
          'controlroom_raw_materials_store',
          'controlroom_inventory_items',
          'controlroom_vrm_prod_inventory'
        ];
        wipeKeys.forEach(k => {
          try { localStorage.removeItem(k); } catch (_) {}
        });
        localStorage.setItem('controlroom_prod_cutover_stock_zero_20261006_v2', 'true');
      }
    } catch (_) {}
  }, []);

  const [targetPoNo, setTargetPoNo] = useState(null);
  const [targetPoTab, setTargetPoTab] = useState(null);
  const [targetBomCode, setTargetBomCode] = useState(null);
  const [targetPiNo, setTargetPiNo] = useState(null);
  const [targetCustomerCode, setTargetCustomerCode] = useState(null);
  const [convertingPiData, setConvertingPiData] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalPrefill, setLoginModalPrefill] = useState('');
  const [loginModalNotice, setLoginModalNotice] = useState('');
  const [accountVersion, setAccountVersion] = useState(0);

  const IDLE_WARNING_MS = 60 * 60 * 1000;
  const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [idleRemainingSec, setIdleRemainingSec] = useState(3600);
  const [idleLogoutNotice, setIdleLogoutNotice] = useState('');
  const idleWarningVisibleRef = useRef(false);
  const idleLastActivityRef = useRef(Date.now());
  const idleWarningTimerRef = useRef(null);
  const idleLogoutTimerRef = useRef(null);
  const idleCountdownIntervalRef = useRef(null);
  const stayLoggedInHandlerRef = useRef(null);

  // Ensure the currently authenticated account is persisted in browser saved accounts
  useEffect(() => {
    if (!isAuthenticated || !userRole) return;
    try {
      const empCode = localStorage.getItem('controlroom_logged_emp_id') || '';
      const email = localStorage.getItem('controlroom_logged_user_email') || localStorage.getItem('controlroom_logged_user') || '';
      const name = localStorage.getItem('controlroom_logged_user_name') || '';
      const sessionId = localStorage.getItem('controlroom_device_session_id') || '';
      const sessionStartTime = Number(localStorage.getItem('controlroom_session_start_time')) || Date.now();
      if (empCode || email || userRole) {
        upsertSavedAccount({
          empCode,
          email,
          name,
          role: userRole,
          sessionId,
          sessionStartTime,
          lastUsedAt: Date.now()
        });
      }
    } catch (_) {}
  }, [isAuthenticated, userRole, accountVersion]);

  useEffect(() => {
    const handleCustomNavigate = (e) => {
      if (!e || !e.detail) return;
      if (typeof e.detail === 'string') {
        handleTabChange(e.detail);
      } else if (typeof e.detail === 'object') {
        const { tab, targetPo, targetBom, targetPi, poTabTarget, searchCustomer, targetCustomer } = e.detail;
        if (targetPo) setTargetPoNo(targetPo);
        if (targetBom) setTargetBomCode(targetBom);
        if (targetPi) setTargetPiNo(targetPi);
        if (poTabTarget) setTargetPoTab(poTabTarget);
        const resolvedCustomer = searchCustomer || targetCustomer;
        if (resolvedCustomer) setTargetCustomerCode(resolvedCustomer);
        if (tab) handleTabChange(tab, targetPo, poTabTarget, resolvedCustomer);
      }
    };
    window.addEventListener('controlroom_navigate_tab', handleCustomNavigate);
    return () => window.removeEventListener('controlroom_navigate_tab', handleCustomNavigate);
  }, []);

  // Keep real-time workflow & lead notification stream active ONLY while authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      realtimeNotificationService.stop();
      setToastAlert(null);
      return undefined;
    }

    realtimeNotificationService.start();

    const handleIncomingToast = (e) => {
      if (!e || !e.detail) return;
      if (localStorage.getItem('controlroom_is_authenticated') !== 'true') return;
      setToastAlert(e.detail);
    };

    window.addEventListener('businz_notification_received', handleIncomingToast);
    window.addEventListener('businz_show_toast', handleIncomingToast);

    return () => {
      window.removeEventListener('businz_notification_received', handleIncomingToast);
      window.removeEventListener('businz_show_toast', handleIncomingToast);
    };
  }, [isAuthenticated]);

  // Unlock browser Web Audio & speech synthesis on first user interaction for live voice alerts
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const handleFirstGesture = () => {
      unlockNotificationAudio();
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
    window.addEventListener('pointerdown', handleFirstGesture, { once: true, passive: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, [isAuthenticated]);

  // Auto-logout after 2 hours of inactivity with 1-hour warning popup & "Stay" button
  useEffect(() => {
    const clearAllIdleTimers = () => {
      if (idleWarningTimerRef.current) {
        clearTimeout(idleWarningTimerRef.current);
        idleWarningTimerRef.current = null;
      }
      if (idleLogoutTimerRef.current) {
        clearTimeout(idleLogoutTimerRef.current);
        idleLogoutTimerRef.current = null;
      }
      if (idleCountdownIntervalRef.current) {
        clearInterval(idleCountdownIntervalRef.current);
        idleCountdownIntervalRef.current = null;
      }
    };

    if (!isAuthenticated) {
      clearAllIdleTimers();
      idleWarningVisibleRef.current = false;
      setShowIdleWarning(false);
      stayLoggedInHandlerRef.current = null;
      return undefined;
    }

    const performIdleAutoLogout = () => {
      clearAllIdleTimers();
      idleWarningVisibleRef.current = false;
      setShowIdleWarning(false);

      try {
        realtimeNotificationService.stop();
      } catch (_) {}

      const sesId = localStorage.getItem('controlroom_device_session_id');
      const currentEmpId = localStorage.getItem('controlroom_logged_emp_id') || '';
      const currentUser = localStorage.getItem('controlroom_logged_user') || '';
      const currentRole = localStorage.getItem('controlroom_user_role') || '';

      try {
        if (sesId) revokeSession(sesId, { useTargetSessionAuth: true });
      } catch (_) {}
      try {
        if (currentEmpId || currentUser || currentRole) {
          removeSavedAccount({ empCode: currentEmpId, email: currentUser, role: currentRole });
        }
      } catch (_) {}

      localStorage.removeItem('controlroom_is_authenticated');
      localStorage.removeItem('controlroom_user_role');
      localStorage.removeItem('controlroom_logged_user');
      localStorage.removeItem('controlroom_logged_user_email');
      localStorage.removeItem('controlroom_logged_user_name');
      localStorage.removeItem('controlroom_logged_emp_id');
      localStorage.removeItem('controlroom_device_session_id');
      localStorage.removeItem('controlroom_session_start_time');
      localStorage.removeItem('controlroom_active_tab');
      localStorage.removeItem('controlroom_sidebar_active_item');

      setToastAlert(null);
      setShowLoginModal(false);
      setLoginModalPrefill('');
      setLoginModalNotice('');
      setIdleLogoutNotice('You were automatically logged out after 2 hours of inactivity. Please sign in again.');
      setUserRole('');
      setIsAuthenticated(false);
      setActiveTab('Dashboard');
    };

    const showWarningPhase = (remainingMs) => {
      clearAllIdleTimers();
      const safeRemainingMs = Math.max(0, remainingMs);
      if (safeRemainingMs <= 0) {
        performIdleAutoLogout();
        return;
      }

      const wasVisible = idleWarningVisibleRef.current;
      idleWarningVisibleRef.current = true;
      setIdleRemainingSec(Math.ceil(safeRemainingMs / 1000));
      setShowIdleWarning(true);

      if (!wasVisible) {
        try {
          playWorkflowNotificationSound();
        } catch (_) {}
      }

      idleLogoutTimerRef.current = setTimeout(() => {
        performIdleAutoLogout();
      }, safeRemainingMs);

      idleCountdownIntervalRef.current = setInterval(() => {
        const msLeft = (idleLastActivityRef.current + IDLE_TIMEOUT_MS) - Date.now();
        if (msLeft <= 0) {
          performIdleAutoLogout();
        } else {
          setIdleRemainingSec(Math.ceil(msLeft / 1000));
        }
      }, 1000);
    };

    const scheduleWarningDelay = (delayMs) => {
      clearAllIdleTimers();
      const safeDelay = Math.max(1000, delayMs);
      idleWarningTimerRef.current = setTimeout(() => {
        const elapsed = Date.now() - idleLastActivityRef.current;
        if (elapsed >= IDLE_TIMEOUT_MS) {
          performIdleAutoLogout();
        } else if (elapsed >= IDLE_WARNING_MS) {
          showWarningPhase(IDLE_TIMEOUT_MS - elapsed);
        } else {
          scheduleWarningDelay(IDLE_WARNING_MS - elapsed);
        }
      }, safeDelay);
    };

    const scheduleFromActivity = (nowTs = Date.now(), force = false) => {
      if (idleWarningVisibleRef.current && !force) return;
      if (force) {
        idleWarningVisibleRef.current = false;
        setShowIdleWarning(false);
      }
      idleLastActivityRef.current = nowTs;
      scheduleWarningDelay(IDLE_WARNING_MS);
    };

    let lastActivityHandledAt = Date.now();

    const handleUserActivity = () => {
      if (idleWarningVisibleRef.current) return;
      const now = Date.now();
      if (now - lastActivityHandledAt < 1000) return;
      lastActivityHandledAt = now;
      scheduleFromActivity(now, false);
    };

    const handleWindowWake = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const elapsed = Date.now() - idleLastActivityRef.current;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        performIdleAutoLogout();
      } else if (elapsed >= IDLE_WARNING_MS) {
        showWarningPhase(IDLE_TIMEOUT_MS - elapsed);
      } else if (!idleWarningVisibleRef.current) {
        scheduleWarningDelay(IDLE_WARNING_MS - elapsed);
      }
    };

    stayLoggedInHandlerRef.current = () => {
      const now = Date.now();
      lastActivityHandledAt = now;
      scheduleFromActivity(now, true);
      try {
        heartbeatActiveSession().catch(() => {});
      } catch (_) {}
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(ev => window.addEventListener(ev, handleUserActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleWindowWake);
    window.addEventListener('focus', handleWindowWake);

    scheduleFromActivity(Date.now(), true);

    return () => {
      clearAllIdleTimers();
      stayLoggedInHandlerRef.current = null;
      events.forEach(ev => window.removeEventListener(ev, handleUserActivity));
      document.removeEventListener('visibilitychange', handleWindowWake);
      window.removeEventListener('focus', handleWindowWake);
    };
  }, [isAuthenticated, accountVersion]);

  const handleLoginSuccess = (roleName) => {
    setIdleLogoutNotice('');
    setUserRole(roleName);
    setIsAuthenticated(true);
    const defaultTab = 'Dashboard';
    setActiveTab(defaultTab);
    try {
      localStorage.setItem('controlroom_active_tab', defaultTab);
      localStorage.removeItem('controlroom_sidebar_active_item');
      if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('tab');
        window.history.replaceState({ tab: defaultTab, isBusinzNavigation: true }, '', currentUrl.toString());
      }
    } catch (_) {}
    try {
      realtimeNotificationService.start(true);
    } catch (_) {}
  };

  const handleRoleSwitch = (newRole) => {
    setIdleLogoutNotice('');
    setUserRole(newRole);
    localStorage.setItem('controlroom_user_role', newRole);
    localStorage.setItem('controlroom_is_authenticated', 'true');
    setIsAuthenticated(true);

    // Check if current logged employee matches the new role; if not, resolve canonical identity for newRole
    const currentEmpId = localStorage.getItem('controlroom_logged_emp_id');
    let empMatchesRole = false;

    if (currentEmpId) {
      try {
        const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
        const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
        const allEmps = [...(Array.isArray(storedEmps) ? storedEmps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];
        const currentEmp = allEmps.find(e => e && (e.employee_code === currentEmpId || e.code === currentEmpId));
        if (currentEmp && (currentEmp.role === newRole || (newRole.toLowerCase().includes('sales') && String(currentEmp.role).toLowerCase().includes('sales')))) {
          empMatchesRole = true;
        }
      } catch (_) {}
    }

    if (!empMatchesRole) {
      const norm = (newRole || '').toLowerCase();
      let newEmpId = '';
      let newUserName = '';

      try {
        const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
        const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
        const allEmps = [...(Array.isArray(storedEmps) ? storedEmps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];
        const match = allEmps.find(e => e && e.role === newRole && (e.employee_name || e.name));
        if (match) {
          newEmpId = match.employee_code || match.code || '';
          newUserName = match.employee_name || match.name || '';
        }
      } catch (_) {}

      if (!newUserName) {
        if (norm.includes('ceo') || norm.includes('md') || norm.includes('managing director')) {
          newEmpId = 'CEO-001';
          newUserName = 'Velmurugan Rathinam';
        } else if (norm.includes('tech support') || norm.includes('technical support')) {
          newEmpId = 'TS-VRM001';
          newUserName = 'Tech Support Specialist';
        } else if (norm === 'sales head') {
          newEmpId = 'SH-001';
          newUserName = 'Sales Head';
        } else if (norm.includes('sales')) {
          newEmpId = 'SE-001';
          newUserName = 'Sales Executive';
        } else if (norm === 'hr' || norm.startsWith('hr')) {
          newEmpId = 'HR-001';
          newUserName = 'HR Operations';
        } else if (norm.includes('technical admin') || norm.includes('technical administrator')) {
          newEmpId = 'TA-001';
          newUserName = 'Annamalaiyar';
        } else if (norm.includes('accounts head') || norm === 'accounts') {
          newEmpId = 'AH-001';
          newUserName = 'Venkatesh';
        } else if (norm.includes('accounts')) {
          newEmpId = 'AE-001';
          newUserName = 'Priya';
        } else if (norm.includes('production')) {
          newEmpId = 'PH-001';
          newUserName = 'Senthil Kumar';
        } else if (norm.includes('dispatch')) {
          newEmpId = 'DH-001';
          newUserName = 'Kalpana';
        } else if (norm.includes('billing') || norm.includes('invoice')) {
          newEmpId = 'INV-001';
          newUserName = 'Anand';
        } else if (norm.includes('design')) {
          newEmpId = 'DE-001';
          newUserName = 'Dinesh';
        } else {
          newEmpId = 'EMP-001';
          newUserName = newRole;
        }
      }

      if (newEmpId) localStorage.setItem('controlroom_logged_emp_id', newEmpId);
      if (newUserName) localStorage.setItem('controlroom_logged_user_name', newUserName);
    }

    // Reconnect notification socket immediately with the new role & credentials
    try {
      realtimeNotificationService.start(true);
    } catch (_) {}

    const defaultTab = 'Dashboard';
    setActiveTab(defaultTab);
    try {
      localStorage.setItem('controlroom_active_tab', defaultTab);
      localStorage.removeItem('controlroom_sidebar_active_item');
      if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('tab');
        window.history.replaceState({ tab: defaultTab, isBusinzNavigation: true }, '', currentUrl.toString());
      }
    } catch (_) {}
  };

  const persistCurrentAccountSnapshot = () => {
    try {
      const curRole = userRole || localStorage.getItem('controlroom_user_role') || '';
      const curName = localStorage.getItem('controlroom_logged_user_name') || '';
      const curEmail = localStorage.getItem('controlroom_logged_user_email') || localStorage.getItem('controlroom_logged_user') || '';
      const curEmp = localStorage.getItem('controlroom_logged_emp_id') || '';
      const curSes = localStorage.getItem('controlroom_device_session_id') || '';
      const curStart = Number(localStorage.getItem('controlroom_session_start_time')) || Date.now();
      if (curRole && (curEmp || curEmail)) {
        upsertSavedAccount({
          empCode: curEmp,
          email: curEmail,
          name: curName,
          role: curRole,
          sessionId: curSes,
          sessionStartTime: curStart
        });
      }
    } catch (_) {}
  };

  const handleOpenAddAccount = (prefillIdentifier = '', notice = '') => {
    persistCurrentAccountSnapshot();
    setLoginModalPrefill(typeof prefillIdentifier === 'string' ? prefillIdentifier : '');
    setLoginModalNotice(typeof notice === 'string' ? notice : '');
    setShowLoginModal(true);
  };

  const handleRemoveSavedAccount = (targetAccount) => {
    if (!targetAccount) return;
    try {
      if (targetAccount.sessionId) {
        revokeSession(targetAccount.sessionId, { useTargetSessionAuth: true });
      }
    } catch (_) {}
    removeSavedAccount(targetAccount.key || targetAccount);
    setAccountVersion((v) => v + 1);
  };

  const handleSwitchAccount = async (targetAccount) => {
    if (!targetAccount) return;
    const currentEmp = (localStorage.getItem('controlroom_logged_emp_id') || '').trim().toLowerCase();
    const currentEmail = (localStorage.getItem('controlroom_logged_user') || '').trim().toLowerCase();
    const targetEmp = String(targetAccount.empCode || '').trim().toLowerCase();
    const targetEmail = String(targetAccount.email || '').trim().toLowerCase();

    if ((targetEmp && currentEmp && targetEmp === currentEmp) || (!targetEmp && targetEmail && targetEmail === currentEmail)) {
      return;
    }

    // Keep current account saved before switching
    persistCurrentAccountSnapshot();

    const check = await verifySavedAccountSession(targetAccount);
    if (!check.valid) {
      const targetLabel = targetAccount.name || targetAccount.empCode || targetAccount.email || 'this account';
      if (check.reason === 'revoked') {
        removeSavedAccount(targetAccount.key || targetAccount);
        setAccountVersion((v) => v + 1);
        handleOpenAddAccount(
          targetAccount.empCode || targetAccount.email || '',
          `Session for ${targetLabel} was signed out or revoked. Enter your password to sign in again.`
        );
      } else {
        handleOpenAddAccount(
          targetAccount.empCode || targetAccount.email || '',
          `Session for ${targetLabel} expired after server restart or inactivity. Enter your password once to re-enable instant switching.`
        );
      }
      return;
    }

    const resolvedTarget = check.session?.empCode
      ? {
          ...targetAccount,
          empCode: check.session.empCode,
          email: check.session.email || targetAccount.email
        }
      : targetAccount;

    localStorage.removeItem('controlroom_active_tab');
    localStorage.removeItem('controlroom_sidebar_active_item');
    setToastAlert(null);
    setTargetPoNo(null);
    setTargetBomCode(null);
    setTargetPiNo(null);
    setTargetPoTab(null);
    setTargetCustomerCode(null);
    setConvertingPiData(null);
    activateSavedAccountLocal(resolvedTarget);
    handleRoleSwitch(resolvedTarget.role);
    setAccountVersion((v) => v + 1);
    try {
      realtimeNotificationService.start(true);
    } catch (_) {}
  };

  const handleSignOut = async () => {
    try {
      realtimeNotificationService.stop();
    } catch (_) {}
    const currentSesId = localStorage.getItem('controlroom_device_session_id');
    const currentEmpId = localStorage.getItem('controlroom_logged_emp_id') || '';
    const currentUser = localStorage.getItem('controlroom_logged_user') || '';
    const currentRole = userRole || localStorage.getItem('controlroom_user_role') || '';
    try {
      if (currentSesId) {
        revokeSession(currentSesId, { useTargetSessionAuth: true });
      }
    } catch (e) {}

    const remaining = removeSavedAccount({
      empCode: currentEmpId,
      email: currentUser,
      role: currentRole
    });

    localStorage.removeItem('controlroom_active_tab');
    localStorage.removeItem('controlroom_sidebar_active_item');
    try {
      if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('tab');
        window.history.replaceState({}, '', currentUrl.toString());
      }
    } catch (_) {}
    setToastAlert(null);
    idleWarningVisibleRef.current = false;
    setShowIdleWarning(false);
    setShowLoginModal(false);
    setLoginModalPrefill('');
    setLoginModalNotice('');
    setIdleLogoutNotice('');
    setTargetPoNo(null);
    setTargetBomCode(null);
    setTargetPiNo(null);
    setTargetPoTab(null);
    setTargetCustomerCode(null);
    setConvertingPiData(null);

    if (remaining.length > 0) {
      for (const candidate of remaining) {
        const check = await verifySavedAccountSession(candidate);
        if (check.valid) {
          activateSavedAccountLocal(candidate);
          handleRoleSwitch(candidate.role);
          setAccountVersion((v) => v + 1);
          try {
            realtimeNotificationService.start(true);
          } catch (_) {}
          return;
        }
        removeSavedAccount(candidate.key || candidate);
      }
    }

    localStorage.removeItem('controlroom_is_authenticated');
    localStorage.removeItem('controlroom_user_role');
    localStorage.removeItem('controlroom_logged_user');
    localStorage.removeItem('controlroom_logged_user_email');
    localStorage.removeItem('controlroom_logged_user_name');
    localStorage.removeItem('controlroom_logged_emp_id');
    localStorage.removeItem('controlroom_device_session_id');
    localStorage.removeItem('controlroom_session_start_time');
    setUserRole('');
    setIsAuthenticated(false);
    setActiveTab('Dashboard');
    setAccountVersion((v) => v + 1);
  };

  const handleTabChange = (tab, targetPo = null, poTabTarget = null, targetCustomer = null, options = {}) => {
    const { skipPush = false } = options || {};

    if (targetPo) {
      if (typeof targetPo === 'object' && (targetPo.searchCustomer || targetPo.targetCustomer)) {
        setTargetCustomerCode(targetPo.searchCustomer || targetPo.targetCustomer);
      } else if (typeof targetPo === 'object' && (targetPo.recordId || targetPo.document_id || targetPo.highlightId)) {
        const poTargetCode = targetPo.recordId || targetPo.document_id || targetPo.highlightId;
        setTargetPoNo(poTargetCode);
        if (targetPo.filterTab || targetPo.targetPoTab) {
          setTargetPoTab(targetPo.filterTab || targetPo.targetPoTab);
        } else if (tab === 'Purchase Orders') {
          setTargetPoTab('Draft');
        }
      } else {
        setTargetPoNo(targetPo);
      }
    }
    if (poTabTarget) {
      setTargetPoTab(poTabTarget);
    }
    if (targetCustomer) {
      const resolvedCust = typeof targetCustomer === 'object' ? (targetCustomer.searchCustomer || targetCustomer.targetCustomer) : targetCustomer;
      if (resolvedCust) setTargetCustomerCode(resolvedCust);
    }
    setActiveTab(tab);
    try {
      localStorage.setItem('controlroom_active_tab', tab);
    } catch (e) {
      console.warn('Could not persist active tab to localStorage:', e);
    }

    // HTML5 Browser History Integration (Back / Forward navigation)
    if (!skipPush && typeof window !== 'undefined' && window.history && window.history.pushState) {
      try {
        const currentUrl = new URL(window.location.href);
        const hasTabParam = currentUrl.searchParams.has('tab');
        if (window.history.state?.tab !== tab || hasTabParam) {
          currentUrl.searchParams.delete('tab');
          window.history.pushState(
            { tab, isBusinzNavigation: true },
            '',
            currentUrl.toString()
          );
        }
      } catch (err) {
        console.warn('Could not push browser history state:', err);
      }
    }
  };

  // HTML5 History Management: Listen for Browser Back / Forward buttons
  useEffect(() => {
    // 1. Ensure initial history state has current tab
    try {
      if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('tab');
        window.history.replaceState(
          { tab: activeTab, isBusinzNavigation: true },
          '',
          currentUrl.toString()
        );
      }
    } catch (_) {}

    // 2. Popstate listener for Back/Forward navigation
    const handlePopState = (event) => {
      // If this was an in-page anchor hash jump (e.g. #section or #field), do NOT reset the active tab!
      if (!event?.state?.tab && window.location.hash) {
        return;
      }

      let targetTab = event?.state?.tab;

      if (!targetTab) {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          targetTab = urlParams.get('tab');
        } catch (_) {}
      }

      if (!targetTab) {
        targetTab = 'Dashboard';
      }

      // Smoothly navigate back to previous menu without re-pushing history
      handleTabChange(targetTab, null, null, null, { skipPush: true });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Ensure Billing / Invoice Executive role cannot land on removed Payments or Spend pages
  useEffect(() => {
    if ((userRole === 'Billing' || userRole === 'Invoice Executive') && 
        (activeTab === 'Payments' || activeTab === 'Spend Analytics' || activeTab === 'Spend Reports')) {
      handleTabChange('Invoice Management');
    }
  }, [userRole, activeTab]);

  // Ensure Accounts Head / Accounts Executive role cannot land on removed Spend, Payments, Delivery Challans, or Templates pages
  useEffect(() => {
    const isAccountsRole = userRole === 'Accounts Head' || userRole === 'Accounts Executive' || userRole === 'Finance & Accounts' || (userRole || '').toLowerCase().includes('account');
    if (isAccountsRole && 
        (activeTab === 'Payments' || activeTab === 'Spend Analytics' || activeTab === 'Spend Reports' || activeTab === 'Delivery Challans' || activeTab === 'Templates' || activeTab === 'Templetes' || activeTab === 'Print Templates' || activeTab === 'Template Studio' || activeTab === 'Template Customizer' || activeTab === 'PO Template')) {
      handleTabChange('Finance Dashboard');
    }

    const isDispatchRole = userRole === 'Dispatch Head' || userRole === 'Dispatch' || userRole === 'Dispatch Executive' || String(userRole || '').toLowerCase().includes('dispatch');
    if (isDispatchRole && activeTab === 'Delivery Challans') {
      handleTabChange('Dispatch Dashboard');
    }

    const isProcurementRole = userRole === 'Procurement' || userRole === 'Procurement Head' || userRole === 'Procurement Admin' || userRole === 'Procurement Executive' || String(userRole || '').toLowerCase().includes('procurement');
    const forbiddenProcurementTabs = [
      'Dispatch Orders', 'Dispatch Dashboard', 'BOM Orders', 'Sales BOM', 'BOM', 'BOM / Routing', 'Create BOM',
      'Accounts Verification', 'Invoice Management', 'Proforma Invoice', 'Performa Invoice',
      'Sales Dashboard', 'Leads', 'Quotations', 'Work Orders'
    ];
    if (isProcurementRole && forbiddenProcurementTabs.includes(activeTab)) {
      handleTabChange('Dashboard');
    }
  }, [userRole, activeTab]);

  const toggleSidebar = () => {
    const nextState = !sidebarCollapsed;
    setSidebarCollapsed(nextState);
    try {
      localStorage.setItem('controlroom_sidebar_collapsed', String(nextState));
    } catch (e) {
      console.warn('Could not persist sidebar state to localStorage:', e);
    }
  };

  // Heartbeat & session verification interval (checks every 25 seconds)
  useEffect(() => {
    if (isAuthenticated) {
      heartbeatActiveSession();
      const interval = setInterval(() => {
        heartbeatActiveSession();
      }, 25000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, accountVersion]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const [poData, itemsData, branding, rawData, deletedCodes] = await Promise.all([
          getPurchaseOrders(),
          getItems(),
          fetchMasterBranding(),
          fetch('/api/raw-materials')
            .then(r => r.json())
            .catch(() => fetchCloudStore('RAW_MATERIALS_STORE', [])),
          fetch('/api/raw-materials/deleted')
            .then(r => r.json())
            .catch(() => [])
        ]);

        const delSet = new Set((Array.isArray(deletedCodes) ? deletedCodes : []).map(c => String(c).toUpperCase().trim()));
        if (delSet.size > 0) {
          try {
            const existingDel = localStorage.getItem('controlroom_deleted_raw_materials');
            const parsedDel = existingDel ? JSON.parse(existingDel) : [];
            const merged = Array.from(new Set([...parsedDel, ...delSet]));
            localStorage.setItem('controlroom_deleted_raw_materials', JSON.stringify(merged));

            // Also purge from local storage caches
            ['controlroom_items_list', 'controlroom_raw_materials_store', 'controlroom_inventory_items', 'controlroom_central_items_v2'].forEach(key => {
              const raw = localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  const cleaned = parsed.filter(it => {
                    const c = String(it?.code || it?.sku || it?.itemId || '').toUpperCase().trim();
                    const n = String(it?.name || '').toUpperCase().trim();
                    return !delSet.has(c) && !delSet.has(n);
                  });
                  if (cleaned.length !== parsed.length) {
                    localStorage.setItem(key, JSON.stringify(cleaned));
                  }
                }
              }
            });
          } catch (_) {}
        }
        
        if (Array.isArray(rawData) && rawData.length > 0) {
          try {
            const cleanedRaw = rawData.filter(r => {
              const c = String(r?.code || r?.sku || '').toUpperCase().trim();
              const n = String(r?.name || '').toUpperCase().trim();
              return !delSet.has(c) && !delSet.has(n);
            });
            localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(cleanedRaw));
          } catch (_) {}
        }

        if (Array.isArray(poData)) {
          setPurchaseOrders(poData);
        }
        if (Array.isArray(itemsData)) {
          let mergedItems = itemsData.filter(it => {
            const c = String(it.code || it.sku || it.itemId || '').trim();
            const n = String(it.name || '').trim();
            const uc = c.toUpperCase();
            const un = n.toUpperCase();
            if (delSet.has(uc) || delSet.has(un)) return false;
            return !/^\d{10,}$/.test(c) && !/^\d{10,}$/.test(n);
          });
          if (Array.isArray(rawData) && rawData.length > 0) {
            const rawMap = new Map();
            rawData.forEach(rm => {
              const rawK = String(rm.code || rm.sku || rm.itemId || rm.name).toUpperCase().trim();
              if (/^\d{10,}$/.test(rawK)) return;
              const canonK = CANONICAL_PRODUCT_ALIASES[rawK] || rawK;
              rawMap.set(rawK, rm);
              rawMap.set(canonK, rm);
              if (rm.name && !/^\d{10,}$/.test(String(rm.name).trim())) rawMap.set(String(rm.name).toUpperCase().trim(), rm);
            });
            mergedItems = mergedItems.map(it => {
              const rawK = String(it.code || it.sku || it.itemId || it.name).toUpperCase().trim();
              const canonK = CANONICAL_PRODUCT_ALIASES[rawK] || rawK;
              const nameK = it.name ? String(it.name).toUpperCase().trim() : '';
              const rm = rawMap.get(rawK) || rawMap.get(canonK) || (nameK && rawMap.get(nameK));
              if (rm) {
                return {
                  ...it,
                  stock: rm.stock !== undefined ? rm.stock : it.stock,
                  availableStock: rm.availableStock !== undefined ? rm.availableStock : it.availableStock,
                  physicalStock: rm.physicalStock !== undefined ? rm.physicalStock : it.physicalStock,
                  reserved: rm.reserved !== undefined ? rm.reserved : it.reserved
                };
              }
              return it;
            });
          }
          setItemsList(mergedItems);
          try {
            window.dispatchEvent(new Event('central_inventory_updated'));
          } catch (e) {}
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();

    // Listen to real-time inventory updates so all logged-in employees see stock updates with 0s latency
    const handleRawUpdate = (e) => {
      const updated = e?.detail?.rawMaterials || e?.detail?.items || (e?.detail?.item ? [e.detail.item] : null) || e?.detail?.storeData;
      if (Array.isArray(updated) && updated.length > 0) {
        setItemsList(prev => {
          if (!Array.isArray(prev)) return prev;
          const rawMap = new Map();
          updated.forEach(rm => {
            const rawK = String(rm.code || rm.sku || rm.itemId || rm.name || '').toUpperCase().trim();
            if (!rawK || /^\d{10,}$/.test(rawK)) return;
            const canonK = CANONICAL_PRODUCT_ALIASES[rawK] || rawK;
            rawMap.set(rawK, rm);
            rawMap.set(canonK, rm);
            if (rm.name && !/^\d{10,}$/.test(String(rm.name).trim())) rawMap.set(String(rm.name).toUpperCase().trim(), rm);
          });
          const matchedKeys = new Set();
          const nextItems = prev.map(it => {
            const rawK = String(it.code || it.sku || it.itemId || it.name || '').toUpperCase().trim();
            const canonK = CANONICAL_PRODUCT_ALIASES[rawK] || rawK;
            const nameK = it.name ? String(it.name).toUpperCase().trim() : '';
            const rm = rawMap.get(rawK) || rawMap.get(canonK) || (nameK && rawMap.get(nameK));
            if (rm) {
              matchedKeys.add(rawK);
              matchedKeys.add(canonK);
              if (nameK) matchedKeys.add(nameK);
              return {
                ...it,
                stock: rm.stock !== undefined ? rm.stock : it.stock,
                availableStock: rm.availableStock !== undefined ? rm.availableStock : it.availableStock,
                physicalStock: rm.physicalStock !== undefined ? rm.physicalStock : it.physicalStock,
                reserved: rm.reserved !== undefined ? rm.reserved : it.reserved
              };
            }
            return it;
          });

          // Also append any newly created products not yet in itemsList
          const brandNewItems = [];
          updated.forEach(rm => {
            const rawK = String(rm.code || rm.sku || rm.itemId || rm.name || '').toUpperCase().trim();
            const canonK = CANONICAL_PRODUCT_ALIASES[rawK] || rawK;
            const nameK = rm.name ? String(rm.name).toUpperCase().trim() : '';
            if (rawK && !matchedKeys.has(rawK) && !matchedKeys.has(canonK) && (!nameK || !matchedKeys.has(nameK))) {
              brandNewItems.push(rm);
              matchedKeys.add(rawK);
              if (nameK) matchedKeys.add(nameK);
            }
          });

          return [...brandNewItems, ...nextItems];
        });
        try {
          window.dispatchEvent(new Event('central_inventory_updated'));
        } catch (_) {}
      }
    };

    window.addEventListener('controlroom_raw_materials_update', handleRawUpdate);
    window.addEventListener('controlroom_items_update', handleRawUpdate);
    return () => {
      window.removeEventListener('controlroom_raw_materials_update', handleRawUpdate);
      window.removeEventListener('controlroom_items_update', handleRawUpdate);
    };
  }, []);

  // BUSINZ Track: Standalone Public Customer Order Tracking Portal (/order/:token or /track/:token or ?track_token=)
  const isCustomerTrackingRoute = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/order/') ||
    window.location.pathname.startsWith('/track/') ||
    new URLSearchParams(window.location.search).has('track_token')
  );

  if (isCustomerTrackingRoute) {
    return (
      <Suspense fallback={<AppViewLoadingFallback activeTab="Order Tracking" />}>
        <CustomerOrderTrackingPortal />
      </Suspense>
    );
  }

  if (!isAuthenticated || !userRole) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} infoMessage={idleLogoutNotice} />;
  }



  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar 
        key={`sidebar-${userRole}-${accountVersion}`}
        collapsed={sidebarCollapsed} 
        onToggle={toggleSidebar} 
        activeTab={activeTab} 
        onChangeTab={handleTabChange}
        userRole={userRole} 
      />

      {/* Mobile Drawer Backdrop */}
      {!sidebarCollapsed && (
        <div 
          className="mobile-sidebar-backdrop"
          onClick={toggleSidebar}
          style={{
            display: 'none',
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(2px)',
            zIndex: 99998
          }}
        />
      )}

      {/* Main View Wrapper */}
      <main className="main-wrapper">
        {/* Top Header Card */}
        <Header 
          activeTab={activeTab} 
          userRole={userRole}
          onSwitchRole={handleRoleSwitch}
          onOpenLoginModal={handleSignOut}
          onLogout={handleSignOut}
          onAddAccount={() => handleOpenAddAccount('')}
          onSwitchAccount={handleSwitchAccount}
          onRemoveAccount={handleRemoveSavedAccount}
          accountVersion={accountVersion}
          onSelectTab={handleTabChange}
          onToggleSidebar={toggleSidebar}
        />

        {/* Scrollable Center Content Pane */}
        <div key={`pane-${userRole}-${accountVersion}`} className={`content-pane ${(!activeTab.includes('Dashboard')) ? 'procurement-layout' : ''} ${(activeTab === 'Templates' || activeTab === 'Templetes' || activeTab === 'Print Templates' || activeTab === 'Template Studio' || activeTab === 'Template Customizer') ? 'templates-view-pane' : ''} ${(activeTab === 'Dashboard' || activeTab === 'Executive Dashboard') ? 'dashboard-view-pane' : ''}`}>
          <Suspense fallback={<AppViewLoadingFallback activeTab={activeTab} />}>
            {(((userRole === 'Technical Administrator' || userRole === 'Technical Admin' || (userRole || '').startsWith('TA') || userRole === 'Developer') && (activeTab === 'Dashboard' || activeTab === 'Admin Dashboard' || activeTab === 'Developer Console' || activeTab === 'Developer Portal')) || (['User Management', 'System Health', 'Active Sessions', 'Backup Vault', 'Developer Console', 'Developer Portal'].includes(activeTab) && (userRole === 'Technical Administrator' || userRole === 'Technical Admin' || (userRole || '').startsWith('TA') || userRole === 'Developer' || userRole === 'CEO' || userRole === 'MD' || userRole === 'Managing Director' || userRole === 'Admin' || userRole === 'Super Admin'))) ? (
              <TechnicalAdminDashboardView userRole={userRole} activeTab={activeTab} onNavigateTab={handleTabChange} />
            ) : (activeTab === 'Dashboard' || activeTab === 'Production Dashboard' || activeTab === 'Dispatch Dashboard' || activeTab === 'Supervisor Dashboard' || activeTab === 'Operator Workspace' || activeTab === 'Floor Employee') && (userRole.includes('Production') || userRole === 'Dispatch' || userRole === 'Dispatch Head' || userRole.includes('Dispatch') || userRole === 'Floor Employee' || userRole === 'Floor Executive' || userRole === 'Machine Operator' || userRole === 'Production Head' || userRole === 'Floor Supervisor') ? (
              <ProductionAdminView activeTab={activeTab} userRole={userRole} />
            ) : (activeTab === 'Performa Invoice' || activeTab === 'Proforma Invoice') ? (
              <PerformaInvoiceView 
                userRole={userRole}
                onNavigateTab={handleTabChange}
                targetPiNo={targetPiNo}
                clearTargetPi={() => setTargetPiNo(null)}
                onConvertToBom={(piData) => {
                  setConvertingPiData(piData);
                  handleTabChange('BOM Orders');
                }} 
              />
            ) : (activeTab === 'Templates' || activeTab === 'Templetes' || activeTab === 'Print Templates' || activeTab === 'Template Studio' || activeTab === 'Template Customizer' || activeTab === 'PO Template') ? (
              (userRole === 'Tech Support' || userRole === 'Technical Support' || (userRole || '').toLowerCase().includes('tech support')) ? (
                <TechSupportDashboardView userRole={userRole} onNavigateTab={handleTabChange} />
              ) : (userRole === 'Accounts Head' || userRole === 'Accounts Executive' || userRole === 'Finance & Accounts' || (userRole || '').toLowerCase().includes('account')) ? (
                <AccountsFinanceDashboard userRole={userRole} onNavigateTab={handleTabChange} />
              ) : (
                <VRMTemplateStudioView userRole={userRole} onBackToPI={() => handleTabChange(userRole?.includes('Procurement') ? 'Purchase Orders' : (String(userRole || '').toLowerCase().includes('dispatch') ? 'Dispatch Orders' : 'Proforma Invoice'))} />
              )
            ) : activeTab === 'Purchase Orders' ? (
              <PurchaseOrdersView 
                userRole={userRole} 
                targetPoNo={targetPoNo} 
                clearTargetPo={() => setTargetPoNo(null)} 
                targetPoTab={targetPoTab}
                clearTargetPoTab={() => setTargetPoTab(null)}
                onNavigateTab={handleTabChange}
              />
            ) : activeTab === 'Delivery Challans' ? (
              <DeliveryChallansView 
                userRole={userRole} 
                onNavigateTab={handleTabChange}
              />
            ) : (activeTab === 'Inventory Stock Conversion' || activeTab === 'Enter Coil Purchase (in Ton)' || activeTab === 'Inventory - (Auto Conversion)') ? (
              <InventoryAutoConversion />
            ) : (activeTab === 'Customer Order Tracking' || activeTab === 'Order Tracking') ? (
              <CustomerOrderTrackingView userRole={userRole} onNavigateTab={handleTabChange} />
            ) : (activeTab === 'Sales Dashboard' || (activeTab === 'Dashboard' && (userRole === 'Sales' || userRole === 'Sales Executive' || userRole === 'Sales Head'))) ? (
              <SalesExecutiveDashboardView userRole={userRole} onNavigateTab={handleTabChange} />
            ) : (activeTab !== 'Dashboard' && activeTab !== 'Executive Dashboard' && activeTab !== 'Procurement Dashboard' && activeTab !== 'Finance & Accounts' && activeTab !== 'Design & BOM Center' && activeTab !== 'Finance Dashboard' && activeTab !== 'Billing Dashboard' && activeTab !== 'Tech Support Dashboard') ? (
              ((userRole === 'Tech Support' || userRole === 'Technical Support' || (userRole || '').toLowerCase().includes('tech support')) && (activeTab === 'BOM Orders' || activeTab === 'BOM' || activeTab === 'Sales BOM' || activeTab === 'BOM / Routing')) ? (
                <TechSupportDashboardView userRole={userRole} onNavigateTab={handleTabChange} />
              ) : (
                <OtherViews 
                  activeTab={activeTab} 
                  onChangeTab={handleTabChange} 
                  userRole={userRole} 
                  convertingPiData={convertingPiData}
                  onClearConvertingPiData={() => setConvertingPiData(null)}
                  targetBomCode={targetBomCode}
                  clearTargetBom={() => setTargetBomCode(null)}
                  targetPiNo={targetPiNo}
                  targetCustomerCode={targetCustomerCode}
                  clearTargetCustomer={() => setTargetCustomerCode(null)}
                  itemsList={itemsList}
                  purchaseOrders={purchaseOrders}
                />
              )
            ) : (activeTab === 'Billing Dashboard' || ((activeTab === 'Dashboard') && (userRole === 'Invoice Executive' || userRole === 'Billing' || (userRole || '').toLowerCase().includes('billing') || (userRole || '').toLowerCase().includes('invoice')))) ? (
              <BillingDashboardView userRole={userRole} onNavigateTab={handleTabChange} />
            ) : (activeTab === 'Finance Dashboard' || ((activeTab === 'Dashboard' || activeTab === 'Finance & Accounts') && (userRole === 'Accounts' || userRole === 'Accounts Head' || userRole === 'Accounts Executive' || userRole === 'Finance & Accounts' || (userRole || '').toLowerCase().includes('account')))) ? (
              <AccountsFinanceDashboard userRole={userRole} onNavigateTab={handleTabChange} />
            ) : ((activeTab === 'Dashboard' || activeTab === 'Executive Dashboard') && (userRole === 'CEO' || userRole === 'MD' || userRole === 'Managing Director' || userRole === 'HR')) ? (
              <CeoExecutiveDashboardView userRole={userRole} onNavigateTab={handleTabChange} />
            ) : ((activeTab === 'Dashboard' || activeTab === 'Tech Support Dashboard') && (userRole === 'Tech Support' || userRole === 'Technical Support' || (userRole || '').toLowerCase().includes('tech support'))) ? (
              <TechSupportDashboardView userRole={userRole} onNavigateTab={handleTabChange} />
            ) : (
              <DashboardFullReference userRole={userRole} />
            )}
          </Suspense>
        </div>
      </main>

      {/* Role-Based Login Screen Modal */}
      {showLoginModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: '#F5F5FA',
          zIndex: 999999,
          overflowY: 'auto',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center'
        }}>
          <div style={{ position: 'relative', width: '100%', minHeight: '100%' }}>
            <button
              onClick={() => {
                setShowLoginModal(false);
                setLoginModalPrefill('');
                setLoginModalNotice('');
              }}
              style={{
                position: 'fixed',
                top: '20px',
                right: '24px',
                zIndex: 1000000,
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontWeight: '900',
                color: '#64748B',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
              title="Close Portal Switcher"
            >
              ✕
            </button>
            <LoginScreen 
              initialIdentifier={loginModalPrefill}
              isAddAccountMode={true}
              infoMessage={loginModalNotice}
              onLoginSuccess={(role) => {
                setToastAlert(null);
                setTargetPoNo(null);
                setTargetBomCode(null);
                setTargetPiNo(null);
                setTargetPoTab(null);
                setTargetCustomerCode(null);
                setConvertingPiData(null);
                setLoginModalPrefill('');
                setLoginModalNotice('');
                handleRoleSwitch(role);
                setAccountVersion((v) => v + 1);
                setShowLoginModal(false);
                try {
                  realtimeNotificationService.start(true);
                } catch (_) {}
              }} 
            />
          </div>
        </div>
      )}

      {/* Modern WhatsApp / SaaS Real-Time Notification Card */}
      {isAuthenticated && (
        <NotificationToast 
          alert={toastAlert} 
          onClose={() => setToastAlert(null)} 
          onNavigate={(tab, extra) => handleTabChange(tab, extra)} 
        />
      )}

      {/* 1-Hour Idle Inactivity Warning Modal (Auto-logout at 2 hours) */}
      {isAuthenticated && showIdleWarning && (() => {
        const safeSec = Math.max(0, idleRemainingSec);
        const mins = Math.floor(safeSec / 60);
        const secs = safeSec % 60;
        const formattedRemaining = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="businz-idle-warning-title"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(3px)',
              zIndex: 1000001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
          >
            <div style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 24px 48px -12px rgba(15, 23, 42, 0.28)',
              padding: '24px',
              fontFamily: "'Plus Jakarta Sans', 'DM Sans', -apple-system, sans-serif"
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: '#FEF3C7',
                  color: '#B45309',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Clock size={22} />
                </div>
                <div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    letterSpacing: '0.6px',
                    color: '#0E7490',
                    textTransform: 'uppercase'
                  }}>
                    BUSINZ Security
                  </div>
                  <h3 id="businz-idle-warning-title" style={{
                    margin: '2px 0 0 0',
                    fontSize: '17px',
                    fontWeight: '800',
                    color: '#0F172A'
                  }}>
                    Session Inactivity Warning
                  </h3>
                </div>
              </div>

              <p style={{
                margin: '0 0 18px 0',
                fontSize: '14px',
                lineHeight: '1.55',
                color: '#334155'
              }}>
                You have been idle for 1 hour. You will be automatically logged out in{' '}
                <strong style={{ color: '#B45309', fontVariantNumeric: 'tabular-nums' }}>
                  {formattedRemaining}
                </strong>{' '}
                unless you stay signed in.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleSignOut}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                    color: '#475569',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Log Out
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => stayLoggedInHandlerRef.current && stayLoggedInHandlerRef.current()}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#0E7490',
                    color: '#FFFFFF',
                    fontSize: '13.5px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(14, 116, 144, 0.25)'
                  }}
                >
                  Stay
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Sidebar Navigation */}
    </div>
  );
}

export default function AppRoot() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}
