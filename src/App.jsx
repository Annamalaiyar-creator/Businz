import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import KPIGrid from './components/KPIGrid';
import POTrendChart from './components/POTrendChart';
import POStatusOverview from './components/POStatusOverview';
import RecentPurchaseOrders from './components/RecentPurchaseOrders';
import SidebarRightColumn from './components/SidebarRightColumn';
import MaterialReorderAlerts from './components/MaterialReorderAlerts';
import PerformaInvoiceView from './components/PerformaInvoiceView';
import PurchaseOrdersView from './components/PurchaseOrdersView';
import OtherViews from './components/OtherViews';
import ZohoIntegrationView from './components/ZohoIntegrationView';
import DashboardFullReference from './components/DashboardFullReference';
import MaterialCalculationEngine from './components/MaterialCalculationEngine';
import InventoryAutoConversion from './components/InventoryAutoConversion';
import CreateWorkOrderPage from './components/CreateWorkOrderPage';
import VRMTemplateStudioView from './components/VRMTemplateStudioView';

import ProductionAdminView from './components/ProductionAdminView';
import SalesExecutiveDashboardView from './components/views/SalesExecutiveDashboardView';
import AccountsFinanceDashboard from './components/views/AccountsFinanceDashboard';
import LoginScreen from './components/LoginScreen';
import DeveloperPortalView from './components/DeveloperPortalView';
import NotificationToast from './components/NotificationToast';
import WorkflowNotificationBanner from './components/WorkflowNotificationBanner';
import useDeviceDetect from './hooks/useDeviceDetect';
import MobileLayout from './components/mobile/MobileLayout';
import { ShoppingCart, Factory, Shield, User, ArrowRight, Receipt, RefreshCw } from 'lucide-react';
import { useEffect, Component } from 'react';
import { heartbeatActiveSession, registerActiveSession, revokeSession } from './services/sessionService';
import { getSafeZohoPOs, getSafeZohoItems } from './services/zohoSafeSync';
import { fetchMasterBranding } from './services/brandingService';
import { initRealtimeSync } from './services/realtimeSyncService';

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
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    this.setState({ hasError: false });
                    localStorage.removeItem('controlroom_active_tab');
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
                    localStorage.removeItem('controlroom_is_authenticated');
                    localStorage.removeItem('controlroom_user_role');
                    localStorage.removeItem('controlroom_active_tab');
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
                <details style={{ marginTop: '14px', textAlign: 'left', backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px', color: '#64748B' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: '700', color: '#DC2626' }}>View Error Diagnostic Info</summary>
                  <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#991B1B' }}>
                    {this.state.error.toString()}
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

function App() {
  // Default sidebar collapsed to TRUE (closed/inside by default on loading)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [toastAlert, setToastAlert] = useState(null);
  const { isMobile, toggleViewMode } = useDeviceDetect();

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

  // Active Tab State (Restores current active tab on page refresh)
  const [activeTab, setActiveTab] = useState(() => {
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
      localStorage.removeItem('controlroom_customer_list');
    } catch (_) {}
  }, []);

  const [targetPoNo, setTargetPoNo] = useState(null);
  const [targetPoTab, setTargetPoTab] = useState(null);
  const [targetBomCode, setTargetBomCode] = useState(null);
  const [targetPiNo, setTargetPiNo] = useState(null);
  const [convertingPiData, setConvertingPiData] = useState(null);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [itemsList, setItemsList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    const handleCustomNavigate = (e) => {
      if (!e || !e.detail) return;
      if (typeof e.detail === 'string') {
        handleTabChange(e.detail);
      } else if (typeof e.detail === 'object') {
        const { tab, targetPo, targetBom, targetPi, poTabTarget } = e.detail;
        if (targetPo) setTargetPoNo(targetPo);
        if (targetBom) setTargetBomCode(targetBom);
        if (targetPi) setTargetPiNo(targetPi);
        if (poTabTarget) setTargetPoTab(poTabTarget);
        if (tab) handleTabChange(tab, targetPo, poTabTarget);
      }
    };
    window.addEventListener('controlroom_navigate_tab', handleCustomNavigate);
    return () => window.removeEventListener('controlroom_navigate_tab', handleCustomNavigate);
  }, []);

  const handleRoleSwitch = (newRole) => {
    setUserRole(newRole);
    localStorage.setItem('controlroom_user_role', newRole);
    localStorage.setItem('controlroom_is_authenticated', 'true');
    setIsAuthenticated(true);
    const defaultTab = 'Dashboard';
    setActiveTab(defaultTab);
    localStorage.setItem('controlroom_active_tab', defaultTab);
  };

  const handleSignOut = () => {
    try {
      const sesId = localStorage.getItem('controlroom_device_session_id');
      if (sesId) {
        revokeSession(sesId);
      }
    } catch (e) {}
    localStorage.removeItem('controlroom_is_authenticated');
    localStorage.removeItem('controlroom_user_role');
    localStorage.removeItem('controlroom_logged_user');
    localStorage.removeItem('controlroom_logged_user_name');
    localStorage.removeItem('controlroom_logged_emp_id');
    localStorage.removeItem('controlroom_device_session_id');
    localStorage.removeItem('controlroom_session_start_time');
    localStorage.removeItem('controlroom_active_tab');
    setIsAuthenticated(false);
    setActiveTab('Dashboard');
    setShowLoginModal(false);
  };

  const handleTabChange = (tab, targetPo = null, poTabTarget = null) => {
    if (targetPo) {
      setTargetPoNo(targetPo);
    }
    if (poTabTarget) {
      setTargetPoTab(poTabTarget);
    }
    setActiveTab(tab);
    try {
      localStorage.setItem('controlroom_active_tab', tab);
    } catch (e) {
      console.warn('Could not persist active tab to localStorage:', e);
    }
  };

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
      const email = localStorage.getItem('controlroom_logged_user');
      const empCode = localStorage.getItem('controlroom_logged_emp_id');
      const name = localStorage.getItem('controlroom_logged_user_name');
      const role = localStorage.getItem('controlroom_user_role');
      if (email) {
        registerActiveSession(email, empCode, name, role);
      }

      heartbeatActiveSession();
      const interval = setInterval(() => {
        heartbeatActiveSession();
      }, 25000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const [poData, itemsData, branding, rawData] = await Promise.all([
          getSafeZohoPOs(),
          getSafeZohoItems(),
          fetchMasterBranding(),
          fetch('/api/raw-materials').then(r => r.json()).catch(() => [])
        ]);
        
        if (Array.isArray(rawData) && rawData.length > 0) {
          try {
            localStorage.setItem('controlroom_raw_materials_store', JSON.stringify(rawData));
          } catch (_) {}
        }

        if (Array.isArray(poData)) {
          setPurchaseOrders(poData);
        }
        if (Array.isArray(itemsData)) {
          setItemsList(itemsData);
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
  }, []);

  if (!isAuthenticated || !userRole) {
    return <LoginScreen onLoginSuccess={(role) => handleRoleSwitch(role)} />;
  }

  // Dedicated Mobile UI for touch devices, smartphones, or manual toggle
  if (isMobile) {
    return (
      <div className="mobile-root-container" style={{ width: '100%', minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
        <MobileLayout 
          userRole={userRole} 
          onSwitchRole={handleRoleSwitch} 
          onSignOut={handleSignOut} 
          onToggleDesktopView={() => toggleViewMode('desktop')} 
        />
        {toastAlert && (
          <NotificationToast 
            alert={toastAlert} 
            onClose={() => setToastAlert(null)} 
          />
        )}
        <WorkflowNotificationBanner 
          userRole={userRole} 
          onNavigate={handleTabChange} 
        />
      </div>
    );
  }

  // Developer / Technical Admin Portal Dedicated Fullscreen Console
  const isDevRole = userRole === 'Technical Administrator' || userRole === 'Developer' || (userRole || '').startsWith('TA') || activeTab === 'Developer Console' || activeTab === 'Developer Portal';
  
  if (isDevRole && devViewMode === 'console') {
    return (
      <>
        <DeveloperPortalView 
          userRole={userRole} 
          onSignOut={handleSignOut} 
          showCustomAlert={showCustomAlert} 
          onSwitchToErp={() => {
            setDevViewMode('erp');
            localStorage.setItem('controlroom_dev_view_mode', 'erp');
          }}
        />
        {toastAlert && (
          <NotificationToast 
            alert={toastAlert} 
            onClose={() => setToastAlert(null)} 
          />
        )}
        <WorkflowNotificationBanner 
          userRole={userRole} 
          onNavigate={handleTabChange} 
        />
      </>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar 
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
        {/* Technical Administrator ERP Mode Banner */}
        {isDevRole && (
          <div style={{
            backgroundColor: '#0F172A',
            color: '#38BDF8',
            padding: '8px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            fontWeight: '800',
            borderBottom: '1px solid #1E293B',
            zIndex: 999
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#38BDF8', boxShadow: '0 0 8px #38BDF8' }} />
              <span>Technical Administrator Session — Businz CRM Active (TA Integration Permissions Live)</span>
            </div>
            <button
              onClick={() => {
                setDevViewMode('console');
                localStorage.setItem('controlroom_dev_view_mode', 'console');
              }}
              style={{
                backgroundColor: '#0284C7',
                border: 'none',
                color: '#FFFFFF',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              « Return to Dev Console
            </button>
          </div>
        )}

        {/* Top Header Card */}
        <Header 
          activeTab={activeTab} 
          userRole={userRole}
          onSwitchRole={handleRoleSwitch}
          onOpenLoginModal={handleSignOut}
          onSelectTab={handleTabChange}
          onToggleSidebar={toggleSidebar}
          onToggleMobileView={() => toggleViewMode('mobile')}
        />

        {/* Scrollable Center Content Pane */}
        <div className={`content-pane procurement-layout ${(activeTab === 'Templates' || activeTab === 'Templetes' || activeTab === 'Print Templates' || activeTab === 'Template Studio' || activeTab === 'Template Customizer') ? 'templates-view-pane' : ''}`}>
          {(activeTab === 'Dashboard' || activeTab === 'Production Dashboard' || activeTab === 'Dispatch Dashboard' || activeTab === 'Supervisor Dashboard' || activeTab === 'Operator Workspace' || activeTab === 'Floor Employee') && (userRole.includes('Production') || userRole === 'Dispatch Head' || userRole === 'Floor Employee' || userRole === 'Machine Operator' || userRole === 'Production Head' || userRole === 'Floor Supervisor') ? (
            <ProductionAdminView activeTab={activeTab} userRole={userRole} />
          ) : (activeTab === 'Performa Invoice' || activeTab === 'Proforma Invoice') ? (
            <PerformaInvoiceView 
              userRole={userRole}
              onNavigateTab={handleTabChange}
              targetPiNo={targetPiNo}
              clearTargetPi={() => setTargetPiNo(null)}
              onConvertToBom={(piData) => {
                setConvertingPiData(piData);
                handleTabChange('Sales BOM');
              }} 
            />
          ) : (activeTab === 'Templates' || activeTab === 'Templetes' || activeTab === 'Print Templates' || activeTab === 'Template Studio' || activeTab === 'Template Customizer') ? (
            <VRMTemplateStudioView onBackToPI={() => handleTabChange('Proforma Invoice')} />
          ) : activeTab === 'Purchase Orders' ? (
            <PurchaseOrdersView 
              userRole={userRole} 
              targetPoNo={targetPoNo} 
              clearTargetPo={() => setTargetPoNo(null)} 
              targetPoTab={targetPoTab}
              clearTargetPoTab={() => setTargetPoTab(null)}
              onNavigateTab={handleTabChange}
            />
          ) : activeTab === 'Zoho Integration' ? (
            <ZohoIntegrationView userRole={userRole} />
          ) : activeTab === 'Material Calculation Engine' ? (
            <MaterialCalculationEngine onBack={() => handleTabChange('BOM')} />
          ) : (activeTab === 'Inventory Stock Conversion' || activeTab === 'Enter Coil Purchase (in Ton)' || activeTab === 'Inventory - (Auto Conversion)') ? (
            <InventoryAutoConversion />
          ) : (activeTab !== 'Dashboard' && activeTab !== 'Executive Dashboard' && activeTab !== 'Procurement Dashboard' && activeTab !== 'Finance & Accounts' && activeTab !== 'Sales & CRM' && activeTab !== 'Design & BOM Center' && activeTab !== 'Finance Dashboard') ? (
            <OtherViews 
              activeTab={activeTab} 
              onChangeTab={handleTabChange} 
              userRole={userRole} 
              convertingPiData={convertingPiData}
              onClearConvertingPiData={() => setConvertingPiData(null)}
              targetBomCode={targetBomCode}
              clearTargetBom={() => setTargetBomCode(null)}
              targetPiNo={targetPiNo}
              itemsList={itemsList}
              purchaseOrders={purchaseOrders}
            />
          ) : (activeTab === 'Dashboard' && (userRole === 'Sales Executive' || userRole === 'Sales Head')) ? (
            <SalesExecutiveDashboardView userRole={userRole} onNavigateTab={handleTabChange} />
          ) : (activeTab === 'Finance Dashboard' || ((activeTab === 'Dashboard' || activeTab === 'Finance & Accounts') && (userRole === 'Accounts Head' || userRole === 'Accounts Executive' || userRole === 'Invoice Executive' || userRole === 'Billing'))) ? (
            <AccountsFinanceDashboard userRole={userRole} onNavigateTab={handleTabChange} />
          ) : (
            <DashboardFullReference userRole={userRole} />
          )}
        </div>
      </main>

      {/* Role-Based Login Screen Modal */}
      {showLoginModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: '#F5F5FA',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <button
              onClick={() => setShowLoginModal(false)}
              style={{
                position: 'absolute',
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
              onLoginSuccess={(role) => {
                handleRoleSwitch(role);
                setShowLoginModal(false);
              }} 
            />
          </div>
        </div>
      )}

      {/* Real-Time Interactive Workflow Notification Banner with Audio Chime & Deep Link */}
      <WorkflowNotificationBanner 
        userRole={userRole} 
        onNavigate={handleTabChange} 
      />
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
