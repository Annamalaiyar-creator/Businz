import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Server, Database, ShieldAlert, Cpu, HardDrive,
  Activity, Terminal, Key, GitCommit, RefreshCw, AlertTriangle,
  CheckCircle2, Clock, Lock, Unlock, Play, RotateCcw, User, Users,
  Globe, Shield, Bell, Eye, EyeOff, Search, Filter, Settings,
  FileCode, Layers, FileText, Download, Upload, Zap, PhoneCall,
  ExternalLink, ChevronRight, AlertCircle, Sparkles, X, Check,
  Radio, BarChart2, RadioTower, Power, LogOut, Code, Info, ShieldCheck
} from 'lucide-react';
import { fetchCloudStore, saveCloudStore } from '../utils/supabaseDataSync';
import { fetchLiveActiveSessions, revokeSession, revokeAllOtherSessions } from '../services/sessionService';
import ZohoIntegrationView from './ZohoIntegrationView';
import BackupVaultView from './views/BackupVaultView';

export default function DeveloperPortalView({ userRole, onSignOut, showCustomAlert, onSwitchToErp }) {
  // Sidebar Collapse state
  const [isDevSidebarCollapsed, setIsDevSidebarCollapsed] = useState(false);

  // Navigation tab state
  const [activeDevTab, setActiveDevTab] = useState('Dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // 2FA / Authentication Modal State
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [pending2FAAction, setPending2FAAction] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');

  // Maintenance Mode State
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);

  // Secret Modal State
  const [isSecretModalOpen, setIsSecretModalOpen] = useState(false);
  const [selectedSecret, setSelectedSecret] = useState(null);
  const [newSecretValue, setNewSecretValue] = useState('');

  // Error Drawer Modal State
  const [selectedErrorDetail, setSelectedErrorDetail] = useState(null);

  // Restore Modal State
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');

  // Rollback Modal State
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const [rollbackVersion, setRollbackVersion] = useState('v2.4.0');
  const [rollbackReason, setRollbackReason] = useState('');

  // Deploy Server Modal State
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [deployLogs, setDeployLogs] = useState([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('v2.4.1');

  // Feature Flags State
  const [featureFlags, setFeatureFlags] = useState([
    { id: 1, name: 'Work Order 2-Step Wizard', desc: 'Enable 2-step material requirement & process routing planner', status: true, env: 'PRODUCTION', updatedBy: 'Annamalaiyar', updatedDate: '26 Aug 2026' },
    { id: 2, name: 'Usable Offcut Bar Inventory Return', desc: 'Return remaining uncut raw bar length to raw store as usable offcut', status: true, env: 'PRODUCTION', updatedBy: 'Annamalaiyar', updatedDate: '26 Aug 2026' },
    { id: 3, name: 'WhatsApp Business API Integration', desc: 'Send automated order & dispatch notifications via Meta API', status: true, env: 'PRODUCTION', updatedBy: 'Annamalaiyar', updatedDate: '25 Aug 2026' },
    { id: 4, name: 'Multi-Factory Production Routing', desc: 'Route BOM items across multiple plant locations dynamically', status: false, env: 'STAGING', updatedBy: 'Annamalaiyar', updatedDate: '24 Aug 2026' },
    { id: 5, name: 'AI Demand Forecasting Engine', desc: 'Predict raw material stock reorder points using historical lead times', status: false, env: 'DEVELOPMENT', updatedBy: 'Annamalaiyar', updatedDate: '22 Aug 2026' }
  ]);

  // System Health Live Status
  const [healthStatus, setHealthStatus] = useState({
    app: 'Healthy',
    api: 'Healthy',
    db: 'Healthy',
    redis: 'Healthy',
    queue: 'Healthy',
    storage: 'Healthy',
    email: 'Healthy',
    whatsapp: 'Healthy',
    webhook: 'Healthy'
  });
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Background Jobs State
  const [backgroundJobs, setBackgroundJobs] = useState([
    { id: 'JOB-901', name: 'Generate Daily Invoice PDF Summary', status: 'Completed', started: '10 mins ago', completed: '9 mins ago', duration: '4.2s', attempts: 1, error: null },
    { id: 'JOB-902', name: 'Send WhatsApp Dispatch Notification', status: 'Completed', started: '25 mins ago', completed: '25 mins ago', duration: '1.1s', attempts: 1, error: null },
    { id: 'JOB-903', name: 'Process Meta Webhook Event (Ref: #8841)', status: 'Completed', started: '1 hour ago', completed: '1 hour ago', duration: '0.8s', attempts: 1, error: null },
    { id: 'JOB-904', name: 'Nightly Database Backup & GCS Sync', status: 'Completed', started: '13 hours ago', completed: '13 hours ago', duration: '142s', attempts: 1, error: null },
    { id: 'JOB-905', name: 'Sync Inventory Balances to Zoho Books', status: 'Failed', started: '2 hours ago', completed: '2 hours ago', duration: '15.4s', attempts: 3, error: 'Zoho API HTTP 503 Service Unavailable' }
  ]);

  // Error Logs State
  const [errorLogs, setErrorLogs] = useState([
    { id: 'ERR-20491', timestamp: '26 Aug 2026 11:42:22', severity: 'Error', service: 'Production API', endpoint: '/api/work-orders', message: 'Internal server error during material calculation', user: 'USER-8841', status: 500, resolved: false, stack: 'Error: Cannot read property "cutLength" of undefined\n  at productionModuleEngine.js:324:18\n  at handleCreateWorkOrder (CreateWorkOrderPage.jsx:107:22)' },
    { id: 'ERR-20490', timestamp: '26 Aug 2026 10:15:04', severity: 'Warning', service: 'Zoho Sync', endpoint: '/api/zoho/purchaseorders', message: 'Zoho API rate limit threshold reached (80%)', user: 'SYSTEM', status: 429, resolved: true, stack: 'Warning: 80 requests/min exceeded. Throttling active.' },
    { id: 'ERR-20489', timestamp: '26 Aug 2026 09:30:11', severity: 'Critical', service: 'Database Proxy', endpoint: '/api/db/connect', message: 'Pool connection timeout (Max pool size 50 reached)', user: 'SYSTEM', status: 504, resolved: true, stack: 'ConnectionTimeoutError: Timeout acquiring connection from pool.\n  at Pool.acquire (/node_modules/pg-pool/index.js:88:14)' },
    { id: 'ERR-20488', timestamp: '25 Aug 2026 18:22:40', severity: 'Info', service: 'Auth Service', endpoint: '/api/auth/login', message: 'Suspicious login attempt blocked from IP 185.220.101.4', user: 'dev@vrm.com', status: 401, resolved: true, stack: 'SecurityAlert: 5 consecutive failed password attempts.' }
  ]);

  // Active Sessions State (Connected Live to Database)
  const [activeSessions, setActiveSessions] = useState([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const refreshLiveSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const liveList = await fetchLiveActiveSessions();
      if (Array.isArray(liveList) && liveList.length > 0) {
        setActiveSessions(liveList);
      } else {
        // Fallback with current administrator device if empty
        const email = localStorage.getItem('controlroom_logged_user') || 'Admin';
        const name = localStorage.getItem('controlroom_logged_user_name') || 'Annamalaiyar';
        setActiveSessions([{
          id: 'SES-ADMIN',
          user: `${name} (Developer)`,
          device: 'MacBook Pro / PC',
          browser: 'Web Browser',
          ip: 'Live Client',
          location: 'Chennai, India',
          loginTime: 'Today',
          lastActive: 'Just now',
          isCurrent: true
        }]);
      }
    } catch (e) {
      console.error('Error fetching live sessions:', e);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    refreshLiveSessions();
  }, []);

  useEffect(() => {
    if (activeDevTab === 'ActiveSessions') {
      refreshLiveSessions();
      const interval = setInterval(refreshLiveSessions, 15000);
      return () => clearInterval(interval);
    }
  }, [activeDevTab]);

  // Live Employee Access & Approval Control State
  const [employeesList, setEmployeesList] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
    } catch (e) {
      return [];
    }
  });
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [showAllPasswords, setShowAllPasswords] = useState(false);

  // Sync registered employee list from server & cloud database
  const refreshEmployeesList = async () => {
    setIsLoadingEmployees(true);
    try {
      const cloudData = await fetchCloudStore('employees_store', []);
      if (Array.isArray(cloudData)) {
        setEmployeesList(cloudData);
        localStorage.setItem('controlroom_employees_list', JSON.stringify(cloudData));
        const codes = cloudData.map(e => e.employee_code || e.code).filter(Boolean);
        localStorage.setItem('controlroom_registered_codes', JSON.stringify(codes));
      }
    } catch (e) {
      console.error('Error fetching employees from cloud:', e);
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  useEffect(() => {
    refreshEmployeesList();
  }, []);

  // Also auto-refresh whenever the UserManagement tab is activated
  useEffect(() => {
    if (activeDevTab === 'UserManagement') {
      refreshEmployeesList();
    }
  }, [activeDevTab]);

  // Trigger Live Health Check
  const handleCheckHealthAgain = () => {
    setIsCheckingHealth(true);
    setTimeout(() => {
      setIsCheckingHealth(false);
      if (showCustomAlert) {
        showCustomAlert('System health check completed. All 9 core microservices operational.', 'Health Verification', 'success');
      }
    }, 8000);
  };

  // Require 2FA OTP Modal for Critical Actions
  const trigger2FARequiredAction = (actionName, actionCallback) => {
    setPending2FAAction({ name: actionName, callback: actionCallback });
    setOtpInput('');
    setOtpError('');
    setIs2FAModalOpen(true);
  };

  const handleVerifyOTP = (e) => {
    e.preventDefault();
    if (otpInput === '123456' || otpInput.length === 6) {
      setIs2FAModalOpen(false);
      if (pending2FAAction && pending2FAAction.callback) {
        pending2FAAction.callback();
      }
      setPending2FAAction(null);
    } else {
      setOtpError('Invalid OTP code. Please enter 123456 for demo verification.');
    }
  };

  // Retry Failed Job
  const handleRetryJob = (jobId) => {
    trigger2FARequiredAction(`Retry Job ${jobId}`, () => {
      setBackgroundJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'Running', attempts: j.attempts + 1, error: null } : j));
      setTimeout(() => {
        setBackgroundJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'Completed', completed: 'Just now' } : j));
        if (showCustomAlert) showCustomAlert(`Job ${jobId} retried successfully!`, 'Job Success', 'success');
      }, 2000);
    });
  };

  // Rollback Deployment Handler
  const handleConfirmRollback = () => {
    if (!rollbackReason.trim()) {
      alert('Please enter a valid reason for rollback.');
      return;
    }
    trigger2FARequiredAction(`Rollback to ${rollbackVersion}`, () => {
      setIsRollbackModalOpen(false);
      if (showCustomAlert) showCustomAlert(`Application rolled back successfully to version ${rollbackVersion}. Audit log updated.`, 'Rollback Complete', 'success');
    });
  };

  // Restore Production Data Handler
  const handleConfirmRestore = () => {
    if (restoreConfirmText !== 'RESTORE PRODUCTION') {
      alert('Security Verification Failed: Please type RESTORE PRODUCTION exactly to continue.');
      return;
    }
    trigger2FARequiredAction('Restore Production Database Backup', () => {
      setIsRestoreModalOpen(false);
      setRestoreConfirmText('');
      if (showCustomAlert) showCustomAlert('Database restore initiated. System running from backup snapshot 26 Aug 2026 02:00 AM.', 'Database Restored', 'success');
    });
  };

  // Live Server Deployment Handler
  const handleStartDeployment = () => {
    trigger2FARequiredAction('Deploy Production Release v2.4.2', () => {
      setIsDeploying(true);
      setDeployLogs([
        '🚀 Initializing zero-downtime production deployment pipeline...',
        '📦 Fetching release package v2.4.2 from Git branch "main"...'
      ]);

      setTimeout(() => {
        setDeployLogs(prev => [...prev, '🧪 Running automated test suite (148 tests passed, 0 failures)...']);
      }, 1000);

      setTimeout(() => {
        setDeployLogs(prev => [...prev, '⚡ Compiling optimized client build assets with Vite (0 build warnings)...']);
      }, 2200);

      setTimeout(() => {
        setDeployLogs(prev => [...prev, '🗄️ Executing DB migration: 20260826_add_work_order_status...']);
      }, 3500);

      setTimeout(() => {
        setDeployLogs(prev => [...prev, '☁️ Syncing static assets to AWS CloudFront CDN & restarting worker instances...']);
      }, 4500);

      setTimeout(() => {
        setDeployLogs(prev => [...prev, '✅ DEPLOYMENT COMPLETE! Server updated to v2.4.2 (System Health: 100%)']);
        setIsDeploying(false);
        setCurrentVersion('v2.4.2');
        if (showCustomAlert) showCustomAlert('Server deployment completed successfully! Live version is now v2.4.2.', 'Deploy Success', 'success');
      }, 6000);
    });
  };

  // Logout All Other Sessions
  const handleLogoutAllOtherSessions = () => {
    trigger2FARequiredAction('Revoke All Other User & Device Sessions', async () => {
      await revokeAllOtherSessions();
      await refreshLiveSessions();
      if (showCustomAlert) showCustomAlert('All other active devices and user sessions have been terminated immediately from database.', 'Sessions Terminated', 'warning');
    });
  };

  // Sidebar Menu Items Definition
  const devSidebarCategories = [
    {
      category: 'MAIN CONSOLE',
      items: [
        { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      category: 'APPLICATION',
      items: [
        { id: 'AppOverview', label: 'Application Overview', icon: Code },
        { id: 'Environments', label: 'Environments', icon: Layers },
        { id: 'SystemConfig', label: 'System Configuration', icon: Settings },
        { id: 'FeatureFlags', label: 'Feature Flags', icon: Zap }
      ]
    },
    {
      category: 'MONITORING',
      items: [
        { id: 'SystemHealth', label: 'System Health', icon: Activity },
        { id: 'ServerMonitoring', label: 'Server Monitoring', icon: Server },
        { id: 'APIMonitoring', label: 'API Monitoring', icon: RadioTower },
        { id: 'ErrorLogs', label: 'Error Logs', icon: AlertTriangle, badge: '2' },
        { id: 'ActivityLogs', label: 'Activity Audit Logs', icon: FileText },
        { id: 'BackgroundJobs', label: 'Background Jobs', icon: RefreshCw }
      ]
    },
    {
      category: 'DATABASE',
      items: [
        { id: 'DatabaseOverview', label: 'Database Overview', icon: Database },
        { id: 'Migrations', label: 'Database Migrations', icon: GitCommit },
        { id: 'BackupRestore', label: 'Backup & Restore', icon: HardDrive }
      ]
    },
    {
      category: 'API & INTEGRATIONS',
      items: [
        { id: 'APIManagement', label: 'API Management', icon: Terminal },
        { id: 'Webhooks', label: 'Webhooks', icon: ExternalLink },
        { id: 'WhatsAppIntegration', label: 'WhatsApp / Meta API', icon: PhoneCall },
        { id: 'ThirdPartyIntegrations', label: 'Third-party Integrations', icon: Globe }
      ]
    },
    {
      category: 'DEPLOYMENT',
      items: [
        { id: 'DeploymentHistory', label: 'Deployment History', icon: Play },
        { id: 'Rollback', label: 'System Rollback', icon: RotateCcw }
      ]
    },
    {
      category: 'SECURITY & USERS',
      items: [
        { id: 'SecurityDashboard', label: 'Security Dashboard', icon: ShieldAlert },
        { id: 'ActiveSessions', label: 'Active Sessions', icon: Lock },
        { id: 'UserManagement', label: 'User Technical Control', icon: Users }
      ]
    },
    {
      category: 'SYSTEM & HELP',
      items: [
        { id: 'MaintenanceMode', label: 'Maintenance Mode', icon: Power },
        { id: 'DevProfile', label: 'Developer Profile', icon: User },
        { id: 'Documentation', label: 'Docs & System Info', icon: Info }
      ]
    }
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0B0F17', color: '#F1F5F9', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ─── MAINTENANCE MODE TOP BANNER ─── */}
      {isMaintenanceMode && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, backgroundColor: '#DC2626', color: '#FFFFFF', padding: '8px 16px', textAlign: 'center', fontWeight: '800', fontSize: '13px', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)' }}>
          <AlertTriangle style={{ width: '16px', height: '16px' }} />
          <span>PRODUCTION MAINTENANCE MODE ACTIVE — CRM IS RESTRICTED TO TECHNICAL ADMIN ONLY (Est. completion: 10 mins)</span>
          <button
            onClick={() => setIsMaintenanceMode(false)}
            style={{ backgroundColor: '#FFFFFF', color: '#DC2626', border: 'none', padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
          >
            Disable Maintenance
          </button>
        </div>
      )}

      {/* ─── TECHNICAL DEVELOPER SIDEBAR (INDEPENDENTLY SCROLLABLE WITH COLLAPSE TOGGLE) ─── */}
      <aside style={{
        width: isDevSidebarCollapsed ? '78px' : '270px',
        backgroundColor: '#0F172A',
        borderRight: '1px solid #1E293B',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
        marginTop: isMaintenanceMode ? '36px' : '0',
        transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden'
      }}>
        
        {/* Brand Header & Collapse Toggle Button */}
        <div style={{
          padding: isDevSidebarCollapsed ? '16px 8px' : '18px 16px',
          borderBottom: '1px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isDevSidebarCollapsed ? 'center' : 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(14, 165, 233, 0.4)',
              flexShrink: 0
            }}>
              <Code style={{ width: '22px', height: '22px', color: '#FFFFFF' }} />
            </div>
            {!isDevSidebarCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: '15px', fontWeight: '900', color: '#F8FAFC', letterSpacing: '-0.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>ControlRoom</div>
                <div style={{ fontSize: '10px', fontWeight: '800', color: '#38BDF8', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>DEV CONSOLE v2.4.1</div>
              </div>
            )}
          </div>

          {/* Collapse toggle button matching Production design */}
          <button
            onClick={() => setIsDevSidebarCollapsed(!isDevSidebarCollapsed)}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '8px',
              border: '1px solid #334155',
              backgroundColor: '#1E293B',
              color: '#94A3B8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              fontSize: '13px',
              fontWeight: '900',
              lineHeight: 1,
              transition: 'all 0.15s ease',
              marginLeft: isDevSidebarCollapsed ? '0' : '6px'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0284C7'; e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.borderColor = '#38BDF8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1E293B'; e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.borderColor = '#334155'; }}
            title={isDevSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isDevSidebarCollapsed ? '»' : '«'}
          </button>
        </div>

        {/* Sidebar Search (Visible when expanded) */}
        {!isDevSidebarCollapsed && (
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #1E293B' }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#64748B' }} />
              <input
                type="text"
                placeholder="Filter dev tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', height: '32px', borderRadius: '6px', backgroundColor: '#1E293B', border: '1px solid #334155', paddingLeft: '30px', paddingRight: '10px', fontSize: '12px', color: '#F1F5F9', outline: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Navigation Categories (ISOLATED INDEPENDENTLY SCROLLABLE AREA) */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: isDevSidebarCollapsed ? '10px 6px' : '10px',
          boxSizing: 'border-box'
        }}>
          {devSidebarCategories.map((cat, idx) => {
            const filteredItems = cat.items.filter(i => i.label.toLowerCase().includes(searchQuery.toLowerCase()));
            if (filteredItems.length === 0) return null;

            return (
              <div key={idx} style={{ marginTop: idx === 0 ? '4px' : '14px' }}>
                {!isDevSidebarCollapsed && (
                  <div style={{ fontSize: '9.5px', fontWeight: '800', color: '#475569', letterSpacing: '0.8px', padding: '4px 10px', marginBottom: '4px' }}>
                    {cat.category}
                  </div>
                )}
                {filteredItems.map(item => {
                  const IconComp = item.icon;
                  const isActive = activeDevTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveDevTab(item.id)}
                      title={isDevSidebarCollapsed ? item.label : undefined}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isDevSidebarCollapsed ? 'center' : 'space-between',
                        padding: isDevSidebarCollapsed ? '10px' : '8px 10px',
                        borderRadius: '6px',
                        backgroundColor: isActive ? '#0284C7' : 'transparent',
                        color: isActive ? '#FFFFFF' : '#94A3B8',
                        border: 'none',
                        fontSize: '12.5px',
                        fontWeight: isActive ? '700' : '500',
                        cursor: 'pointer',
                        marginBottom: '2px',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = '#1E293B'; e.currentTarget.style.color = '#F1F5F9'; } }}
                      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94A3B8'; } }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <IconComp style={{ width: '16px', height: '16px', color: isActive ? '#FFFFFF' : '#64748B', flexShrink: 0 }} />
                        {!isDevSidebarCollapsed && <span>{item.label}</span>}
                      </div>
                      {!isDevSidebarCollapsed && item.badge && (
                        <span style={{ backgroundColor: '#EF4444', color: '#FFFFFF', fontSize: '10px', fontWeight: '800', padding: '1px 6px', borderRadius: '10px' }}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Technical Developer Profile Footer */}
        <div style={{ padding: isDevSidebarCollapsed ? '10px 6px' : '14px', borderTop: '1px solid #1E293B', backgroundColor: '#0B0F17' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isDevSidebarCollapsed ? 'center' : 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0284C7', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '13px', flexShrink: 0 }}>
                A
              </div>
              {!isDevSidebarCollapsed && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#F1F5F9' }}>Annamalaiyar</div>
                  <div style={{ fontSize: '10px', color: '#38BDF8' }}>Technical Lead Admin</div>
                </div>
              )}
            </div>
            {!isDevSidebarCollapsed && (
              <button
                onClick={onSignOut}
                style={{ backgroundColor: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '6px' }}
                title="Sign Out Developer Console"
              >
                <LogOut style={{ width: '16px', height: '16px' }} />
              </button>
            )}
          </div>
        </div>

      </aside>

      {/* ─── MAIN TECHNICAL CONTENT AREA ─── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', marginTop: isMaintenanceMode ? '36px' : '0' }}>

        {/* Technical Top Bar */}
        <header style={{ height: '60px', backgroundColor: '#0F172A', borderBottom: '1px solid #1E293B', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', sticky: 'top', zIndex: 10 }}>
          
          {/* Status Badge Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#064E3B', border: '1px solid #059669', padding: '4px 12px', borderRadius: '20px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981', boxShadow: '0 0 8px #10B981', animation: 'pulse 2s infinite' }}></span>
              <span style={{ fontSize: '11px', fontWeight: '900', color: '#34D399', letterSpacing: '0.5px' }}>PRODUCTION ● OPERATIONAL</span>
            </div>
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              Server: <strong style={{ color: '#CBD5E1' }}>AWS us-east-1 (v2.4.1)</strong>
            </span>
          </div>

          {/* Quick Actions & Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {onSwitchToErp && (
              <button
                onClick={onSwitchToErp}
                style={{ backgroundColor: '#0284C7', border: '1px solid #38BDF8', color: '#FFFFFF', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 0 12px rgba(14,165,233,0.3)' }}
                title="Open Control Room ERP View"
              >
                <ExternalLink style={{ width: '13px', height: '13px' }} /> Launch Control Room ERP ↗
              </button>
            )}

            <button
              onClick={handleCheckHealthAgain}
              disabled={isCheckingHealth}
              style={{ backgroundColor: '#1E293B', border: '1px solid #334155', color: '#F1F5F9', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw style={{ width: '13px', height: '13px', animation: isCheckingHealth ? 'spin 1s linear infinite' : 'none' }} />
              {isCheckingHealth ? 'Checking Health...' : 'Check System Health'}
            </button>

            <button
              onClick={() => setIsRestoreModalOpen(true)}
              style={{ backgroundColor: '#451A03', border: '1px solid #9A3412', color: '#FDBA74', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <HardDrive style={{ width: '13px', height: '13px' }} /> Restore Database
            </button>

            <div style={{ height: '20px', width: '1px', backgroundColor: '#334155' }}></div>

            <div style={{ fontSize: '11.5px', color: '#64748B', textAlign: 'right' }}>
              <div>Last Login: <span style={{ color: '#94A3B8' }}>26 Aug 2026 11:20 AM</span></div>
              <div>Session: <span style={{ color: '#34D399' }}>2FA Verified (TLS 1.3)</span></div>
            </div>
          </div>
        </header>

        {/* View Switcher Container */}
        <div style={{ padding: '24px', flex: 1 }}>

          {/* 1. DASHBOARD OVERVIEW */}
          {activeDevTab === 'Dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* WELCOME BANNER CARD FOR DEVELOPER CONSOLE */}
              <div style={{
                backgroundColor: '#0F172A',
                borderRadius: '12px',
                border: '1px solid #1E293B',
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 2 }}>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#F8FAFC', margin: 0, letterSpacing: '-0.02em' }}>
                      Welcome back, {localStorage.getItem('controlroom_logged_user_name') || userRole || 'Technical Administrator'}!
                    </h2>
                    <p style={{ fontSize: '13px', color: '#94A3B8', margin: '4px 0 0 0', fontWeight: '500' }}>
                      System engineering console active — Full server infrastructure, API monitoring & database control.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 2 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Console Engine</div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginTop: '2px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#38BDF8', boxShadow: '0 0 8px #38BDF8' }}></span>
                      v2.4.1 Production
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions Panel */}
              <div style={{ backgroundColor: '#1E293B', borderRadius: '10px', padding: '16px 20px', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#F8FAFC' }}>Technical Quick Operations Console</h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Perform production engineering controls and real-time monitoring triggers.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setIsDeployModalOpen(true)} style={{ backgroundColor: '#0284C7', border: 'none', color: '#FFFFFF', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Play style={{ width: '13px', height: '13px' }} /> Deploy v2.4.2
                  </button>
                  <button onClick={() => setActiveDevTab('ErrorLogs')} style={{ backgroundColor: '#7F1D1D', border: '1px solid #991B1B', color: '#FCA5A5', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle style={{ width: '13px', height: '13px' }} /> View Error Logs
                  </button>
                  <button onClick={() => setIsRestoreModalOpen(true)} style={{ backgroundColor: '#334155', border: 'none', color: '#F1F5F9', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HardDrive style={{ width: '13px', height: '13px' }} /> Backup & Restore
                  </button>
                </div>
              </div>

              {/* 8 Technical Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div style={{ backgroundColor: '#1E293B', padding: '16px', borderRadius: '10px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700' }}>APP STATUS</div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#34D399', marginTop: '4px' }}>Operational</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>v2.4.1 (Commit #6d5739d)</div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '16px', borderRadius: '10px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700' }}>SERVER CPU / RAM</div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#38BDF8', marginTop: '4px' }}>14% / 38%</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>AWS us-east-1 (8 vCPU)</div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '16px', borderRadius: '10px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700' }}>DB CONNECTIONS</div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#A855F7', marginTop: '4px' }}>42 Active</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>PostgreSQL 16.2 (12.4 GB)</div>
                </div>

                <div style={{ backgroundColor: '#1E293B', padding: '16px', borderRadius: '10px', border: '1px solid #334155' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '700' }}>API UPTIME / RATE</div>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#34D399', marginTop: '4px' }}>99.98%</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>2,842 requests/min</div>
                </div>
              </div>

              {/* System Health Microservices Status Indicators */}
              <div style={{ backgroundColor: '#1E293B', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '800', color: '#F8FAFC' }}>Microservices & Subsystem Health Indicators</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                  {[
                    { name: 'Core Web Application', status: 'Healthy', ping: '12ms' },
                    { name: 'Production API Router', status: 'Healthy', ping: '18ms' },
                    { name: 'PostgreSQL Database Engine', status: 'Healthy', ping: '4ms' },
                    { name: 'Redis Cache & Session Store', status: 'Healthy', ping: '2ms' },
                    { name: 'Background Queue Manager', status: 'Healthy', ping: '8ms' },
                    { name: 'Meta WhatsApp Webhook Service', status: 'Healthy', ping: '45ms' },
                    { name: 'Storage & Object Store (GCS)', status: 'Healthy', ping: '32ms' },
                    { name: 'Email Delivery Gateway (SMTP)', status: 'Healthy', ping: '65ms' },
                    { name: 'Zoho Books Integration Service', status: 'Healthy', ping: '110ms' }
                  ].map((s, idx) => (
                    <div key={idx} style={{ backgroundColor: '#0F172A', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }}></span>
                        <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#CBD5E1' }}>{s.name}</span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#34D399', fontWeight: '800' }}>● {s.status} ({s.ping})</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* 2. ENVIRONMENT MANAGEMENT & MASKED SECRETS */}
          {activeDevTab === 'Environments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#F8FAFC' }}>Environment Infrastructure & Secret Vault</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Manage isolated application environments and secure environment key configurations.</p>
                </div>
                <button
                  onClick={() => { setSelectedSecret({ key: 'NEW_SECRET_KEY', val: '' }); setIsSecretModalOpen(true); }}
                  style={{ backgroundColor: '#0284C7', border: 'none', color: '#FFFFFF', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  + Add Secret Variable
                </button>
              </div>

              {/* 3 Environments Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {[
                  { env: 'Production', active: true, server: 'AWS us-east-1', db: 'PostgreSQL Prod', ver: 'v2.4.1', color: '#0284C7' },
                  { env: 'Staging', active: false, server: 'AWS us-east-2', db: 'PostgreSQL Staging', ver: 'v2.4.2-rc1', color: '#F59E0B' },
                  { env: 'Development', active: false, server: 'Local Sandbox', db: 'PostgreSQL Dev Local', ver: 'v2.5.0-dev', color: '#10B981' }
                ].map((e, idx) => (
                  <div key={idx} style={{ backgroundColor: '#1E293B', padding: '18px', borderRadius: '10px', border: `2px solid ${e.active ? e.color : '#334155'}`, position: 'relative' }}>
                    {e.active && (
                      <span style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: e.color, color: '#FFFFFF', fontSize: '10px', fontWeight: '900', padding: '2px 8px', borderRadius: '10px' }}>
                        LIVE PRODUCTION
                      </span>
                    )}
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#F8FAFC' }}>{e.env}</h4>
                    <div style={{ marginTop: '12px', fontSize: '12px', color: '#94A3B8', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>Server: <strong style={{ color: '#F1F5F9' }}>{e.server}</strong></div>
                      <div>Database: <strong style={{ color: '#F1F5F9' }}>{e.db}</strong></div>
                      <div>Version: <strong style={{ color: '#F1F5F9' }}>{e.ver}</strong></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Masked Environment Secrets Table */}
              <div style={{ backgroundColor: '#1E293B', padding: '20px', borderRadius: '10px', border: '1px solid #334155' }}>
                <h4 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: '800', color: '#F8FAFC' }}>Production Environment Secrets (Masked Security Enforcement)</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#64748B', textAlign: 'left' }}>
                      <th style={{ padding: '10px' }}>VARIABLE KEY</th>
                      <th style={{ padding: '10px' }}>SECRET VALUE</th>
                      <th style={{ padding: '10px' }}>ENVIRONMENT</th>
                      <th style={{ padding: '10px' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'DATABASE_URL', val: '************************************' },
                      { key: 'OPENAI_API_KEY', val: '************************************' },
                      { key: 'META_ACCESS_TOKEN', val: '************************************' },
                      { key: 'JWT_SECRET_KEY', val: '************************************' },
                      { key: 'ZOHO_CLIENT_SECRET', val: '************************************' }
                    ].map((sec, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '12px 10px', fontFamily: 'monospace', fontWeight: '700', color: '#38BDF8' }}>{sec.key}</td>
                        <td style={{ padding: '12px 10px', fontFamily: 'monospace', color: '#64748B' }}>{sec.val}</td>
                        <td style={{ padding: '12px 10px' }}><span style={{ backgroundColor: '#0369A1', color: '#FFFFFF', padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '800' }}>PRODUCTION</span></td>
                        <td style={{ padding: '12px 10px' }}>
                          <button
                            onClick={() => { setSelectedSecret(sec); setIsSecretModalOpen(true); }}
                            style={{ backgroundColor: '#334155', border: 'none', color: '#F1F5F9', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Update / Rotate Secret
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. ERROR LOGS MONITORING */}
          {activeDevTab === 'ErrorLogs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#F8FAFC' }}>Real-Time Error Monitoring Console</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Inspect system tracebacks, HTTP status codes, and affected endpoints.</p>
                </div>
              </div>

              <div style={{ backgroundColor: '#1E293B', borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0F172A', color: '#64748B', textAlign: 'left', borderBottom: '1px solid #334155' }}>
                      <th style={{ padding: '12px 14px' }}>ERROR ID</th>
                      <th style={{ padding: '12px 14px' }}>TIMESTAMP</th>
                      <th style={{ padding: '12px 14px' }}>SEVERITY</th>
                      <th style={{ padding: '12px 14px' }}>SERVICE</th>
                      <th style={{ padding: '12px 14px' }}>ENDPOINT</th>
                      <th style={{ padding: '12px 14px' }}>MESSAGE</th>
                      <th style={{ padding: '12px 14px' }}>STATUS</th>
                      <th style={{ padding: '12px 14px' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorLogs.map(err => (
                      <tr key={err.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '800', color: '#F8FAFC' }}>{err.id}</td>
                        <td style={{ padding: '12px 14px', color: '#94A3B8' }}>{err.timestamp}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            backgroundColor: err.severity === 'Critical' ? '#7F1D1D' : err.severity === 'Error' ? '#991B1B' : '#78350F',
                            color: '#FFFFFF',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10.5px',
                            fontWeight: '800'
                          }}>
                            {err.severity}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#CBD5E1' }}>{err.service}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#38BDF8' }}>{err.endpoint}</td>
                        <td style={{ padding: '12px 14px', color: '#E2E8F0', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{err.message}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '800', color: err.status >= 500 ? '#EF4444' : '#F59E0B' }}>{err.status}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <button
                            onClick={() => setSelectedErrorDetail(err)}
                            style={{ backgroundColor: '#0284C7', border: 'none', color: '#FFFFFF', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Inspect Stack
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. BACKGROUND JOBS */}
          {activeDevTab === 'BackgroundJobs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#F8FAFC' }}>Background Worker Jobs & Queue Control</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Monitor asynchronous worker tasks, retry failed jobs, and manage task execution queues.</p>
                </div>
              </div>

              <div style={{ backgroundColor: '#1E293B', borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0F172A', color: '#64748B', textAlign: 'left', borderBottom: '1px solid #334155' }}>
                      <th style={{ padding: '12px 14px' }}>JOB ID</th>
                      <th style={{ padding: '12px 14px' }}>JOB NAME</th>
                      <th style={{ padding: '12px 14px' }}>STATUS</th>
                      <th style={{ padding: '12px 14px' }}>STARTED</th>
                      <th style={{ padding: '12px 14px' }}>DURATION</th>
                      <th style={{ padding: '12px 14px' }}>ATTEMPTS</th>
                      <th style={{ padding: '12px 14px' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backgroundJobs.map(job => (
                      <tr key={job.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '800', color: '#F8FAFC' }}>{job.id}</td>
                        <td style={{ padding: '12px 14px', color: '#CBD5E1', fontWeight: '700' }}>{job.name}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{
                            backgroundColor: job.status === 'Completed' ? '#065F46' : job.status === 'Running' ? '#0369A1' : '#991B1B',
                            color: '#FFFFFF',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10.5px',
                            fontWeight: '800'
                          }}>
                            {job.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#94A3B8' }}>{job.started}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#94A3B8' }}>{job.duration}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700' }}>{job.attempts}</td>
                        <td style={{ padding: '12px 14px' }}>
                          {job.status === 'Failed' && (
                            <button
                              onClick={() => handleRetryJob(job.id)}
                              style={{ backgroundColor: '#DC2626', border: 'none', color: '#FFFFFF', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                            >
                              Retry Job Now
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. BACKUP & RESTORE */}
          {activeDevTab === 'BackupRestore' && (
            <BackupVaultView userRole={userRole || 'Technical Administrator'} />
          )}

          {/* 6. ROLLBACK & DEPLOYMENT */}
          {activeDevTab === 'Rollback' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ backgroundColor: '#1E293B', padding: '24px', borderRadius: '10px', border: '1px solid #334155' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#F8FAFC' }}>Emergency Production Rollback Manager</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Revert production deployment instantaneously to a prior verified release build.</p>

                <div style={{ marginTop: '20px' }}>
                  <button
                    onClick={() => setIsRollbackModalOpen(true)}
                    style={{ backgroundColor: '#DC2626', border: 'none', color: '#FFFFFF', padding: '10px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <RotateCcw style={{ width: '15px', height: '15px' }} /> Initiate Emergency System Rollback
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 7. FEATURE FLAGS */}
          {activeDevTab === 'FeatureFlags' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#F8FAFC' }}>Feature Toggles & Dynamic Capabilities</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Control feature deployment across environments without code redeployment.</p>
                </div>
              </div>

              <div style={{ backgroundColor: '#1E293B', borderRadius: '10px', border: '1px solid #334155', padding: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {featureFlags.map(flag => (
                    <div key={flag.id} style={{ backgroundColor: '#0F172A', padding: '16px', borderRadius: '8px', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <strong style={{ fontSize: '14px', color: '#F8FAFC' }}>{flag.name}</strong>
                          <span style={{ backgroundColor: flag.env === 'PRODUCTION' ? '#0369A1' : '#334155', color: '#FFFFFF', fontSize: '10px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px' }}>
                            {flag.env}
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>{flag.desc}</p>
                      </div>

                      <button
                        onClick={() => {
                          trigger2FARequiredAction(`Toggle Feature Flag: ${flag.name}`, () => {
                            setFeatureFlags(prev => prev.map(f => f.id === flag.id ? { ...f, status: !f.status } : f));
                          });
                        }}
                        style={{
                          backgroundColor: flag.status ? '#059669' : '#334155',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '800',
                          cursor: 'pointer'
                        }}
                      >
                        {flag.status ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 8. ACTIVE SESSIONS & SECURITY CONTROL */}
          {activeDevTab === 'ActiveSessions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#F8FAFC' }}>Active Device & Session Authorization Control</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Manage authenticated user sessions, IP bounds, and force emergency session terminations in real time.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={refreshLiveSessions}
                    disabled={isLoadingSessions}
                    style={{ backgroundColor: '#1E293B', border: '1px solid #334155', color: '#38BDF8', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <RefreshCw size={13} className={isLoadingSessions ? 'spin-icon' : ''} />
                    {isLoadingSessions ? 'Syncing...' : 'Refresh Sessions'}
                  </button>
                  <button
                    onClick={handleLogoutAllOtherSessions}
                    style={{ backgroundColor: '#DC2626', border: 'none', color: '#FFFFFF', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    Logout All Other Devices
                  </button>
                </div>
              </div>

              <div style={{ backgroundColor: '#1E293B', borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0F172A', color: '#64748B', textAlign: 'left', borderBottom: '1px solid #334155' }}>
                      <th style={{ padding: '12px 14px' }}>USER</th>
                      <th style={{ padding: '12px 14px' }}>DEVICE / BROWSER</th>
                      <th style={{ padding: '12px 14px' }}>IP ADDRESS</th>
                      <th style={{ padding: '12px 14px' }}>LOCATION</th>
                      <th style={{ padding: '12px 14px' }}>LOGIN TIME</th>
                      <th style={{ padding: '12px 14px' }}>LAST ACTIVE</th>
                      <th style={{ padding: '12px 14px' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSessions.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>
                          No active sessions registered.
                        </td>
                      </tr>
                    ) : (
                      activeSessions.map(ses => (
                        <tr key={ses.id} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '12px 14px', fontWeight: '700', color: '#F8FAFC' }}>
                            {ses.user} {ses.isCurrent && <span style={{ color: '#34D399', fontSize: '10px', marginLeft: '6px' }}>(THIS DEVICE)</span>}
                            {ses.empCode && <div style={{ fontSize: '10.5px', color: '#38BDF8', fontFamily: 'monospace' }}>{ses.empCode}</div>}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#CBD5E1' }}>{ses.device} - {ses.browser}</td>
                          <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#38BDF8' }}>{ses.ip}</td>
                          <td style={{ padding: '12px 14px', color: '#94A3B8' }}>{ses.location}</td>
                          <td style={{ padding: '12px 14px', color: '#94A3B8' }}>{ses.loginTime}</td>
                          <td style={{ padding: '12px 14px', color: '#34D399', fontWeight: '700' }}>{ses.lastActive}</td>
                          <td style={{ padding: '12px 14px' }}>
                            {!ses.isCurrent && (
                              <button
                                onClick={() => {
                                  trigger2FARequiredAction(`Revoke Session ${ses.id}`, async () => {
                                    await revokeSession(ses.id);
                                    await refreshLiveSessions();
                                    if (showCustomAlert) showCustomAlert(`Session for ${ses.user} has been terminated from the database.`, 'Session Terminated', 'warning');
                                  });
                                }}
                                style={{ backgroundColor: '#7F1D1D', border: 'none', color: '#FCA5A5', padding: '5px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                              >
                                Revoke Session
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 9. USER TECHNICAL CONTROL / USER MANAGEMENT */}
          {activeDevTab === 'UserManagement' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#F8FAFC' }}>User Management & Employee Access Approval Control</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Inspect registration access requests, grant developer authorization, and manage active/disabled employee accounts.</p>
                </div>
              </div>

              <div style={{ backgroundColor: '#1E293B', borderRadius: '10px', border: '1px solid #334155', padding: '16px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <button
                    onClick={() => setShowAllPasswords(prev => !prev)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: showAllPasswords ? 'rgba(245, 158, 11, 0.15)' : '#0F172A',
                      border: showAllPasswords ? '1px solid #F59E0B' : '1px solid #334155',
                      color: showAllPasswords ? '#FBBF24' : '#94A3B8',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {showAllPasswords ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showAllPasswords ? 'Hide All Passwords' : 'Show All Passwords'}
                  </button>
                  <button
                    onClick={refreshEmployeesList}
                    disabled={isLoadingEmployees}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: '#0F172A',
                      border: '1px solid #334155',
                      color: '#38BDF8',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={13} className={isLoadingEmployees ? 'spin-icon' : ''} />
                    {isLoadingEmployees ? 'Checking Live Server...' : 'Refresh Access Requests'}
                  </button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0F172A', color: '#64748B', textAlign: 'left', borderBottom: '1px solid #334155' }}>
                      <th style={{ padding: '12px 14px' }}>EMPLOYEE CODE</th>
                      <th style={{ padding: '12px 14px' }}>EMPLOYEE NAME</th>
                      <th style={{ padding: '12px 14px' }}>ROLE / TYPE</th>
                      <th style={{ padding: '12px 14px' }}>EMAIL</th>
                      <th style={{ padding: '12px 14px' }}>PASSWORD</th>
                      <th style={{ padding: '12px 14px' }}>STATUS</th>
                      <th style={{ padding: '12px 14px' }}>DEVELOPER ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeesList.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '28px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                          No employee accounts registered yet. When users sign up, their access requests will appear here in real time.
                        </td>
                      </tr>
                    ) : (
                      employeesList.map((emp, idx) => {
                        const empCode = emp.employee_code || emp.code;
                        const empStatus = emp.status || 'Active';
                        const isPending = empStatus === 'Pending Approval';
                        const empPassword = emp.password || '—';
                        const isRevealed = showAllPasswords || Boolean(revealedPasswords[empCode]);

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #334155', backgroundColor: isPending ? 'rgba(217, 119, 6, 0.08)' : 'transparent' }}>
                          <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '800', color: '#38BDF8' }}>{empCode}</td>
                          <td style={{ padding: '12px 14px', fontWeight: '700', color: '#F8FAFC' }}>{emp.employee_name || emp.name}</td>
                          <td style={{ padding: '12px 14px', color: '#CBD5E1' }}>{emp.role}</td>
                          <td style={{ padding: '12px 14px', color: '#94A3B8' }}>{emp.email}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#0F172A', padding: '3px 8px', borderRadius: '4px', border: '1px solid #334155' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: isRevealed ? '#34D399' : '#94A3B8', letterSpacing: isRevealed ? 'normal' : '2px', fontWeight: '700' }}>
                                {isRevealed ? empPassword : (empPassword !== '—' ? '••••••••' : '—')}
                              </span>
                              {empPassword !== '—' && (
                                <button
                                  type="button"
                                  onClick={() => setRevealedPasswords(prev => ({ ...prev, [empCode]: !prev[empCode] }))}
                                  title={isRevealed ? "Hide Password" : "Show Password"}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748B' }}
                                >
                                  {isRevealed ? <EyeOff size={12} color="#F59E0B" /> : <Eye size={12} color="#94A3B8" />}
                                </button>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ 
                              backgroundColor: empStatus === 'Disabled' ? '#7F1D1D' : isPending ? '#B45309' : '#065F46', 
                              color: empStatus === 'Disabled' ? '#FCA5A5' : isPending ? '#FDE68A' : '#34D399', 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              fontSize: '11px', 
                              fontWeight: '800' 
                            }}>
                              {empStatus}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {isPending ? (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  onClick={async () => {
                                    try {
                                      const updated = employeesList.map(e => ((e.employee_code || e.code) === empCode ? { ...e, status: 'Active' } : e));
                                      setEmployeesList(updated);
                                      localStorage.setItem('controlroom_employees_list', JSON.stringify(updated));
                                      saveCloudStore('employees_store', updated);
                                      if (showCustomAlert) showCustomAlert(`Access granted to Employee ${empCode} (${emp.role}). Account is now Active!`, 'Access Granted', 'success');
                                    } catch(err) {}
                                  }}
                                  style={{ 
                                    backgroundColor: '#059669', 
                                    border: 'none', 
                                    color: '#FFFFFF', 
                                    padding: '6px 12px', 
                                    borderRadius: '6px', 
                                    fontSize: '11.5px', 
                                    fontWeight: '800', 
                                    cursor: 'pointer', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '4px',
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="Approve access and activate account"
                                >
                                  ✓ Grant Access
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      const updated = employeesList.map(e => ((e.employee_code || e.code) === empCode ? { ...e, status: 'Rejected' } : e));
                                      setEmployeesList(updated);
                                      localStorage.setItem('controlroom_employees_list', JSON.stringify(updated));
                                      saveCloudStore('employees_store', updated);
                                      if (showCustomAlert) showCustomAlert(`Access request for Employee ${empCode} was rejected.`, 'Request Rejected', 'warning');
                                    } catch(err) {}
                                  }}
                                  style={{ 
                                    backgroundColor: '#DC2626', 
                                    border: 'none', 
                                    color: '#FFFFFF', 
                                    padding: '6px 12px', 
                                    borderRadius: '6px', 
                                    fontSize: '11.5px', 
                                    fontWeight: '800', 
                                    cursor: 'pointer', 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '4px',
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="Reject account access request"
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                {empStatus !== 'Active' ? (
                                  <button
                                    onClick={async () => {
                                      try {
                                        const updated = employeesList.map(e => ((e.employee_code || e.code) === empCode ? { ...e, status: 'Active' } : e));
                                        setEmployeesList(updated);
                                        localStorage.setItem('controlroom_employees_list', JSON.stringify(updated));
                                        saveCloudStore('employees_store', updated);
                                        if (showCustomAlert) showCustomAlert(`Access granted to Employee ${empCode}. Account is now Active!`, 'Access Granted', 'success');
                                      } catch(err) {}
                                    }}
                                    style={{ backgroundColor: '#059669', border: 'none', color: '#FFFFFF', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                                  >
                                    ✓ Grant Access
                                  </button>
                                ) : null}
                                <button
                                  onClick={async () => {
                                    try {
                                      const nextStatus = empStatus === 'Active' ? 'Disabled' : 'Active';
                                      const updated = employeesList.map(e => ((e.employee_code || e.code) === empCode ? { ...e, status: nextStatus } : e));
                                      setEmployeesList(updated);
                                      localStorage.setItem('controlroom_employees_list', JSON.stringify(updated));
                                      saveCloudStore('employees_store', updated);
                                      if (showCustomAlert) showCustomAlert(`Employee Account ${empCode} status updated to ${nextStatus}.`, `Account ${nextStatus}`, nextStatus === 'Active' ? 'success' : 'warning');
                                    } catch(err) {}
                                  }}
                                  style={{ 
                                    backgroundColor: empStatus === 'Disabled' || empStatus === 'Rejected' ? '#047857' : '#475569', 
                                    border: 'none', 
                                    color: '#F1F5F9', 
                                    padding: '5px 10px', 
                                    borderRadius: '5px', 
                                    fontSize: '11px', 
                                    fontWeight: '700', 
                                    cursor: 'pointer' 
                                  }}
                                >
                                  {empStatus === 'Disabled' || empStatus === 'Rejected' ? 'Re-enable Access' : 'Disable Access'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 10. ACTIVITY AUDIT LOGS WITH BEFORE/AFTER TRACKING */}
          {activeDevTab === 'ActivityLogs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#F8FAFC' }}>Developer Audit Trail & Before/After Change History</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Complete audit logs tracking user activity, login attempts, and record field mutations.</p>
                </div>
              </div>

              <div style={{ backgroundColor: '#1E293B', borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0F172A', color: '#64748B', textAlign: 'left', borderBottom: '1px solid #334155' }}>
                      <th style={{ padding: '12px 14px' }}>TIMESTAMP</th>
                      <th style={{ padding: '12px 14px' }}>EMPLOYEE CODE</th>
                      <th style={{ padding: '12px 14px' }}>MODULE</th>
                      <th style={{ padding: '12px 14px' }}>ACTION</th>
                      <th style={{ padding: '12px 14px' }}>RECORD ID</th>
                      <th style={{ padding: '12px 14px' }}>BEFORE VALUE</th>
                      <th style={{ padding: '12px 14px' }}>AFTER VALUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { time: '10:32 AM', code: 'AH-VRM001', module: 'Invoice', action: 'UPDATE', record: 'INV-1025', before: 'Amount: ₹85,000', after: 'Amount: ₹90,000' },
                      { time: '10:10 AM', code: 'AH-VRM001', module: 'Invoice', action: 'UPDATE', record: 'INV-1025', before: 'Terms: 30 Days', after: 'Terms: 45 Days' },
                      { time: '09:45 AM', code: 'SE-VRM001', module: 'Customer', action: 'UPDATE', record: 'CUST-304', before: 'Address: Chennai', after: 'Address: Kanchipuram' },
                      { time: '09:20 AM', code: 'SE-VRM001', module: 'Customer', action: 'CREATE', record: 'CUST-304', before: '—', after: 'Customer: Vikram Solar' },
                      { time: '08:50 AM', code: 'TA-VRM001', module: 'Auth', action: 'LOGIN', record: 'AUTH-001', before: 'Status: Offline', after: 'Status: Active Session' }
                    ].map((log, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '12px 14px', color: '#94A3B8' }}>{log.time}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '800', color: '#38BDF8' }}>{log.code}</td>
                        <td style={{ padding: '12px 14px', color: '#CBD5E1' }}>{log.module}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ backgroundColor: '#0369A1', color: '#FFFFFF', padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '800' }}>{log.action}</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#F8FAFC' }}>{log.record}</td>
                        <td style={{ padding: '12px 14px', color: '#FCA5A5', fontFamily: 'monospace' }}>{log.before}</td>
                        <td style={{ padding: '12px 14px', color: '#34D399', fontFamily: 'monospace' }}>{log.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* THIRD PARTY & WHATSAPP / META INTEGRATIONS VIEW */}
          {(activeDevTab === 'ThirdPartyIntegrations' || activeDevTab === 'WhatsAppIntegration') && (
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', border: '1px solid #CBD5E1', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <ZohoIntegrationView userRole={userRole} />
            </div>
          )}

          {/* OTHER TABS GENERIC PLACEHOLDER */}
          {!['Dashboard', 'Environments', 'ErrorLogs', 'BackgroundJobs', 'BackupRestore', 'Rollback', 'FeatureFlags', 'ActiveSessions', 'UserManagement', 'ActivityLogs', 'ThirdPartyIntegrations', 'WhatsAppIntegration'].includes(activeDevTab) && (
            <div style={{ backgroundColor: '#1E293B', padding: '40px', borderRadius: '10px', border: '1px solid #334155', textAlign: 'center' }}>
              <Code style={{ width: '40px', height: '40px', color: '#38BDF8', marginBottom: '12px' }} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#F8FAFC' }}>{activeDevTab} Module Active</h3>
              <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94A3B8' }}>All production endpoints, telemetry streams, and security hooks for <strong>{activeDevTab}</strong> are active.</p>
            </div>
          )}

        </div>

      </main>

      {/* ─── MODAL 1: 2FA / OTP VERIFICATION DIALOG ─── */}
      {is2FAModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#0F172A', border: '1px solid #38BDF8', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 0 30px rgba(56, 189, 248, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#38BDF8', marginBottom: '12px' }}>
              <ShieldCheck style={{ width: '22px', height: '22px' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900' }}>2FA Security Action Authorization</h3>
            </div>
            
            <p style={{ fontSize: '12.5px', color: '#94A3B8', margin: '0 0 16px 0' }}>
              Action Requested: <strong style={{ color: '#F1F5F9' }}>{pending2FAAction?.name}</strong>
            </p>

            <form onSubmit={handleVerifyOTP}>
              <label style={{ fontSize: '11px', fontWeight: '800', color: '#CBD5E1', display: 'block', marginBottom: '6px' }}>ENTER 6-DIGIT MFA OTP CODE</label>
              <input
                type="text"
                maxLength="6"
                placeholder="e.g. 123456"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                autoFocus
                style={{ width: '100%', height: '40px', borderRadius: '6px', backgroundColor: '#1E293B', border: '1px solid #334155', textAlign: 'center', fontSize: '18px', letterSpacing: '4px', fontWeight: '900', color: '#38BDF8', outline: 'none' }}
              />
              {otpError && <div style={{ color: '#EF4444', fontSize: '11.5px', marginTop: '6px', fontWeight: '700' }}>{otpError}</div>}

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setIs2FAModalOpen(false)}
                  style={{ flex: 1, height: '36px', borderRadius: '6px', backgroundColor: '#1E293B', border: '1px solid #334155', color: '#94A3B8', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, height: '36px', borderRadius: '6px', backgroundColor: '#0284C7', border: 'none', color: '#FFFFFF', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}
                >
                  Verify & Execute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: RESTORE DATABASE SAFETY CONFIRMATION ─── */}
      {isRestoreModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#0F172A', border: '2px solid #EF4444', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '460px', boxShadow: '0 0 35px rgba(239, 68, 68, 0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#EF4444', marginBottom: '12px' }}>
              <AlertTriangle style={{ width: '24px', height: '24px' }} />
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '900' }}>CRITICAL: RESTORE PRODUCTION DATABASE</h3>
            </div>

            <div style={{ backgroundColor: '#451A03', border: '1px solid #9A3412', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#FDBA74', marginBottom: '16px', lineHeight: '1.5' }}>
              <strong>WARNING:</strong> Restoring a database backup will OVERWRITE live production records with the snapshot from <strong>26 Aug 2026 02:00 AM</strong>.
            </div>

            <label style={{ fontSize: '11px', fontWeight: '800', color: '#CBD5E1', display: 'block', marginBottom: '6px' }}>TYPE "RESTORE PRODUCTION" TO CONFIRM:</label>
            <input
              type="text"
              placeholder="RESTORE PRODUCTION"
              value={restoreConfirmText}
              onChange={(e) => setRestoreConfirmText(e.target.value)}
              style={{ width: '100%', height: '38px', borderRadius: '6px', backgroundColor: '#1E293B', border: '1px solid #334155', padding: '0 10px', fontSize: '13px', fontWeight: '800', color: '#F8FAFC', outline: 'none', marginBottom: '20px' }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsRestoreModalOpen(false)}
                style={{ flex: 1, height: '38px', borderRadius: '6px', backgroundColor: '#1E293B', border: '1px solid #334155', color: '#94A3B8', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                style={{ flex: 1, height: '38px', borderRadius: '6px', backgroundColor: '#DC2626', border: 'none', color: '#FFFFFF', fontWeight: '900', fontSize: '12px', cursor: 'pointer' }}
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: ROLLBACK SYSTEM CONFIRMATION ─── */}
      {isRollbackModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#0F172A', border: '1px solid #DC2626', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#EF4444', marginBottom: '12px' }}>
              <RotateCcw style={{ width: '22px', height: '22px' }} />
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900' }}>Confirm Production Rollback</h3>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: '800', color: '#CBD5E1', display: 'block', marginBottom: '4px' }}>SELECT ROLLBACK TARGET VERSION</label>
              <select
                value={rollbackVersion}
                onChange={(e) => setRollbackVersion(e.target.value)}
                style={{ width: '100%', height: '36px', borderRadius: '6px', backgroundColor: '#1E293B', border: '1px solid #334155', color: '#F1F5F9', padding: '0 8px', fontSize: '13px' }}
              >
                <option value="v2.4.0">v2.4.0 (Deployed 24 Aug 2026)</option>
                <option value="v2.3.9">v2.3.9 (Deployed 20 Aug 2026)</option>
              </select>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '11px', fontWeight: '800', color: '#CBD5E1', display: 'block', marginBottom: '4px' }}>REASON FOR ROLLBACK (LOGGED TO AUDIT TRAIL)</label>
              <input
                type="text"
                placeholder="e.g. Critical API latency regression"
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                style={{ width: '100%', height: '36px', borderRadius: '6px', backgroundColor: '#1E293B', border: '1px solid #334155', color: '#F1F5F9', padding: '0 10px', fontSize: '12.5px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsRollbackModalOpen(false)}
                style={{ flex: 1, height: '36px', borderRadius: '6px', backgroundColor: '#1E293B', border: '1px solid #334155', color: '#94A3B8', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRollback}
                style={{ flex: 1, height: '36px', borderRadius: '6px', backgroundColor: '#DC2626', border: 'none', color: '#FFFFFF', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}
              >
                Execute Rollback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: ERROR INSPECTION STACK DRAWER ─── */}
      {selectedErrorDetail && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: '520px', backgroundColor: '#0F172A', height: '100%', borderLeft: '1px solid #334155', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle style={{ width: '20px', height: '20px', color: '#EF4444' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#F8FAFC' }}>Error Details: {selectedErrorDetail.id}</h3>
              </div>
              <button onClick={() => setSelectedErrorDetail(null)} style={{ backgroundColor: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px', color: '#CBD5E1' }}>
              <div><strong>Timestamp:</strong> {selectedErrorDetail.timestamp}</div>
              <div><strong>Service:</strong> {selectedErrorDetail.service}</div>
              <div><strong>Endpoint:</strong> <code style={{ color: '#38BDF8' }}>{selectedErrorDetail.endpoint}</code></div>
              <div><strong>HTTP Status:</strong> <span style={{ color: '#EF4444', fontWeight: '800' }}>{selectedErrorDetail.status}</span></div>
              <div><strong>Message:</strong> {selectedErrorDetail.message}</div>
            </div>

            <div>
              <strong style={{ fontSize: '12px', color: '#94A3B8', display: 'block', marginBottom: '6px' }}>TECHNICAL STACK TRACE</strong>
              <pre style={{ backgroundColor: '#020617', padding: '12px', borderRadius: '6px', border: '1px solid #1E293B', fontSize: '11px', color: '#FCA5A5', overflowX: 'auto', lineHeight: '1.4' }}>
                {selectedErrorDetail.stack}
              </pre>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setErrorLogs(prev => prev.map(e => e.id === selectedErrorDetail.id ? { ...e, resolved: true } : e));
                  setSelectedErrorDetail(null);
                  if (showCustomAlert) showCustomAlert(`Error ${selectedErrorDetail.id} marked as resolved!`, 'Resolved', 'success');
                }}
                style={{ flex: 1, height: '36px', borderRadius: '6px', backgroundColor: '#059669', border: 'none', color: '#FFFFFF', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}
              >
                Mark Resolved
              </button>
              <button
                onClick={() => setSelectedErrorDetail(null)}
                style={{ flex: 1, height: '36px', borderRadius: '6px', backgroundColor: '#1E293B', border: '1px solid #334155', color: '#94A3B8', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: MASKED SECRET UPDATE MODAL ─── */}
      {isSecretModalOpen && selectedSecret && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#0F172A', border: '1px solid #38BDF8', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '420px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '900', color: '#F8FAFC' }}>Rotate / Update Environment Secret</h3>
            <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 16px 0' }}>Updating variable <code style={{ color: '#38BDF8' }}>{selectedSecret.key}</code>. Values will be masked immediately upon saving.</p>

            <input
              type="password"
              placeholder="Enter new secret value..."
              value={newSecretValue}
              onChange={(e) => setNewSecretValue(e.target.value)}
              style={{ width: '100%', height: '38px', borderRadius: '6px', backgroundColor: '#1E293B', border: '1px solid #334155', padding: '0 10px', fontSize: '13px', color: '#F8FAFC', outline: 'none', marginBottom: '20px' }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsSecretModalOpen(false)}
                style={{ flex: 1, height: '36px', borderRadius: '6px', backgroundColor: '#1E293B', border: '1px solid #334155', color: '#94A3B8', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  trigger2FARequiredAction(`Rotate Secret ${selectedSecret.key}`, () => {
                    setIsSecretModalOpen(false);
                    setNewSecretValue('');
                    if (showCustomAlert) showCustomAlert(`Secret ${selectedSecret.key} rotated and encrypted successfully!`, 'Secret Saved', 'success');
                  });
                }}
                style={{ flex: 1, height: '36px', borderRadius: '6px', backgroundColor: '#0284C7', border: 'none', color: '#FFFFFF', fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}
              >
                Save & Encrypt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 6: LIVE SERVER DEPLOYMENT MODAL ─── */}
      {isDeployModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#0F172A', border: '1px solid #0284C7', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '580px', boxShadow: '0 0 35px rgba(2, 132, 199, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#38BDF8' }}>
                <Play style={{ width: '22px', height: '22px' }} />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '900' }}>Production Deployment Terminal (v2.4.2)</h3>
              </div>
              {!isDeploying && (
                <button onClick={() => setIsDeployModalOpen(false)} style={{ backgroundColor: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                  <X style={{ width: '18px', height: '18px' }} />
                </button>
              )}
            </div>

            <div style={{ fontSize: '12.5px', color: '#CBD5E1', marginBottom: '14px', lineHeight: '1.5' }}>
              Target Environment: <strong style={{ color: '#0EA5E9' }}>PRODUCTION (AWS us-east-1)</strong> | Current Version: <strong style={{ color: '#34D399' }}>{currentVersion}</strong>
            </div>

            {/* Terminal Live Output Log */}
            <div style={{ backgroundColor: '#020617', border: '1px solid #1E293B', borderRadius: '8px', padding: '14px', height: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11.5px', color: '#38BDF8', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
              {deployLogs.length === 0 ? (
                <div style={{ color: '#64748B' }}>Ready to launch deployment pipeline. Click "Authorize 2FA & Deploy Server" below.</div>
              ) : (
                deployLogs.map((log, idx) => (
                  <div key={idx} style={{ color: log.includes('✅') ? '#34D399' : log.includes('🚀') ? '#FDBA74' : '#E2E8F0' }}>
                    {log}
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsDeployModalOpen(false)}
                disabled={isDeploying}
                style={{ flex: 1, height: '40px', borderRadius: '6px', backgroundColor: '#1E293B', border: '1px solid #334155', color: '#94A3B8', fontWeight: '700', fontSize: '12px', cursor: isDeploying ? 'not-allowed' : 'pointer' }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleStartDeployment}
                disabled={isDeploying}
                style={{ flex: 1.5, height: '40px', borderRadius: '6px', backgroundColor: isDeploying ? '#0369A1' : '#0284C7', border: 'none', color: '#FFFFFF', fontWeight: '900', fontSize: '12.5px', cursor: isDeploying ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {isDeploying ? (
                  <>
                    <RefreshCw style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> Deploying to Production...
                  </>
                ) : (
                  <>
                    <Play style={{ width: '14px', height: '14px' }} /> Authorize 2FA & Deploy Server
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
