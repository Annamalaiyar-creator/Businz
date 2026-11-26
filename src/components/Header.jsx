import React, { useState, useEffect } from 'react';
import { 
  ChevronDown, LogOut, 
  Menu, ChevronRight, GitBranch, ShieldCheck, 
  Settings
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import { CODE_TO_SALES_NAME } from './pi/piHelpers';

export const filterCompletedBomNotifications = () => [];
export const addLiveNotification = () => {};

export default function Header({
  activeTab,
  userRole = 'Procurement Admin',
  onSwitchRole,
  onOpenLoginModal,
  onLogout,
  onAddAccount,
  onSwitchAccount,
  onRemoveAccount,
  accountVersion = 0,
  onSelectTab,
  onToggleSidebar
}) {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const isExecutiveOrMD = userRole === 'CEO' || userRole === 'Managing Director' || userRole === 'MD';
  const isTechAdmin = userRole === 'Technical Administrator' || userRole === 'Technical Admin' || userRole === 'Developer' || (userRole || '').startsWith('TA');

  const [, setProfileUpdateTick] = useState(0);
  useEffect(() => {
    const handleProfileUpdate = () => setProfileUpdateTick(t => t + 1);
    window.addEventListener('businz_user_updated', handleProfileUpdate);
    return () => window.removeEventListener('businz_user_updated', handleProfileUpdate);
  }, []);

  useEffect(() => {
    const handleOutsideClick = () => {
      setShowRoleMenu(false);
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') handleOutsideClick();
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);


  // Map userRole and logged_emp_id to person's actual name with strict role-affinity verification
  const storedName = (localStorage.getItem('controlroom_logged_user_name') || '').trim();
  const storedEmpId = (localStorage.getItem('controlroom_logged_emp_id') || '').trim().toUpperCase();
  const storedEmail = (localStorage.getItem('controlroom_logged_user') || '').trim().toLowerCase();

  let userName = '';

  // 1. Authoritative resolution: Check live employee directory by exact storedEmpId first (auto-heals stale localStorage)
  if (!userName) {
    try {
      const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
      const allEmps = [...(Array.isArray(storedEmps) ? storedEmps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];

      let matchedEmp = null;
      if (storedEmpId) {
        matchedEmp = allEmps.find(e => e && (
          String(e.employee_code || '').toUpperCase() === storedEmpId ||
          String(e.code || '').toUpperCase() === storedEmpId
        ));
        if (!matchedEmp) {
          matchedEmp = allEmps.find(e => e && Array.isArray(e.alias_codes) && e.alias_codes.some(a => String(a).toUpperCase() === storedEmpId));
        }
      }
      if (!matchedEmp && storedEmail) {
        matchedEmp = allEmps.find(e => e && String(e.email || '').toLowerCase() === storedEmail);
      }
      // Only match by unique role for singular leadership positions (never for shared roles like Sales/Floor)
      if (!matchedEmp && userRole) {
        const normR = String(userRole).toLowerCase();
        const isSingularRole = normR.includes('ceo') || normR.includes('md') || normR.includes('managing director') || normR.includes('technical admin');
        if (isSingularRole) {
          matchedEmp = allEmps.find(e => e && e.role === userRole && (e.employee_name || e.name));
        }
      }

      if (matchedEmp && (matchedEmp.employee_name || matchedEmp.name)) {
        userName = matchedEmp.employee_name || matchedEmp.name;
      }
    } catch (_) {}
  }

  // 2. Canonical sales mapping fallback
  if (!userName && storedEmpId && CODE_TO_SALES_NAME[storedEmpId]) {
    userName = CODE_TO_SALES_NAME[storedEmpId];
  }

  // 3. Fallback to storedName if employee directory lookup wasn't available
  if (!userName && storedName && storedName !== 'undefined' && storedName !== 'null' && storedName !== 'Executive Leadership (CEO)' && storedName !== 'Sales Executive') {
    userName = storedName;
  }

  // Auto-heal stored name in localStorage if it was previously corrupted to another person
  if (userName && userName !== storedName) {
    try { localStorage.setItem('controlroom_logged_user_name', userName); } catch (_) {}
  }

  // Canonical role defaults if not discovered from employee directory
  if (!userName || userName === 'Executive Leadership (CEO)' || userName === 'CEO') {
    const norm = String(userRole || '').toLowerCase();
    if (norm.includes('ceo') || norm.includes('md') || norm.includes('managing director')) {
      userName = 'Velmurugan Rathinam';
    } else if (norm.includes('technical administrator') || norm.includes('technical admin') || norm.includes('developer')) {
      userName = 'Annamalaiyar';
    } else if (norm === 'production head' || norm.includes('production head')) {
      userName = 'Senthil Kumar';
    } else if (norm === 'dispatch head' || norm.includes('dispatch head')) {
      userName = 'Kalpana';
    } else if (norm === 'accounts head' || norm === 'accounts') {
      userName = 'Venkatesh';
    } else if (norm.includes('accounts executive') || norm.includes('accounts lead')) {
      userName = 'Priya';
    } else if (norm === 'sales head') {
      userName = 'Sales Head';
    } else if (norm.includes('sales')) {
      userName = (storedName && storedName !== 'undefined' && storedName !== 'null' && storedName !== 'Executive Leadership (CEO)') ? storedName : 'Sales Executive';
    } else if (norm.includes('design engineer')) {
      userName = 'Dinesh';
    } else if (norm.includes('design executive')) {
      userName = 'Kavitha';
    } else if (norm.includes('invoice') || norm.includes('billing')) {
      userName = 'Anand';
    } else if (norm.includes('bom')) {
      userName = 'Balaji';
    } else if (norm === 'hr' || norm.startsWith('hr')) {
      userName = 'HR Operations';
    } else if (norm.includes('procurement')) {
      userName = 'Annamalaiyar';
    } else {
      userName = (storedName && storedName !== 'undefined' && storedName !== 'null') ? storedName : (userRole || 'Annamalaiyar');
    }
  }

  // Only initialize stored name if empty, NEVER overwrite an existing authentic user name
  if (userName && !storedName) {
    try { localStorage.setItem('controlroom_logged_user_name', userName); } catch (_) {}
  }
  const safeName = (userName && userName !== 'undefined' && userName !== 'null') ? userName : (userRole || 'Annamalaiyar');
  const avatarLetter = (safeName.charAt(0) || 'A').toUpperCase();

  const userEmail = (storedEmail && storedEmail.includes('@'))
    ? storedEmail
    : `${safeName.toLowerCase().replace(/[^a-z0-9]/g, '')}@vrmstructures.in`;

  return (
    <header 
      className="top-navigation app-header-responsive" 
      style={{
        height: '60px',
        borderRadius: '16px',
        margin: '16px 16px 12px 16px',
        background: 'linear-gradient(135deg, #075985 0%, #0E7490 50%, #0891B2 100%)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 16px',
        boxShadow: '0 6px 22px rgba(14, 116, 144, 0.25)',
        position: 'relative',
        zIndex: 1000,
        color: '#FFFFFF',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
      }}
    >
      {/* Dynamic Keyframes CSS for Disappearing Badge Animation */}
      <style>{`
        @keyframes disappearInAir {
          0% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 1;
            filter: blur(0px);
          }
          100% {
            transform: translate3d(0, -32px, 0) scale(2);
            opacity: 0;
            filter: blur(8px);
          }
        }
        @keyframes bzMenuIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .bz-profile-menu { animation: bzMenuIn 0.16s ease-out; transform-origin: top right; }
        .bz-menu-item {
          width: 100%; display: flex; align-items: center; gap: 12px;
          padding: 9px 10px; border: none; border-radius: 10px; background: transparent;
          cursor: pointer; text-align: left; font-family: inherit; color: #1E293B;
          transition: background-color 0.15s ease;
        }
        .bz-menu-item:hover, .bz-menu-item:focus-visible { background-color: #F1F5F9; outline: none; }
        .bz-menu-icon {
          width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          background-color: #ECFEFF; color: #0E7490;
        }
        .bz-menu-title { display: block; font-size: 13px; font-weight: 700; color: inherit; }
        .bz-menu-sub { display: block; font-size: 11px; color: #94A3B8; margin-top: 1px; }
        .bz-menu-danger { color: #DC2626; }
        .bz-menu-danger .bz-menu-icon { background-color: #FEF2F2; color: #DC2626; }
        .bz-menu-danger:hover, .bz-menu-danger:focus-visible { background-color: #FEF2F2; }
      `}</style>

      {/* Left side: Breadcrumb & Title */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minWidth: 0
        }}
      >
        {/* Mobile Hamburger Menu Button */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="mobile-header-menu-btn"
            title="Toggle Menu"
            style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: '#FFFFFF',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <Menu style={{ width: '20px', height: '20px' }} />
          </button>
        )}

        <div className="header-brand-prefix" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#BAE6FD', fontWeight: '800', fontSize: '13.5px', letterSpacing: '0.5px' }}>BUSINZ</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.35)', fontWeight: '300' }}>|</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <h2 style={{
            fontSize: '16px',
            fontWeight: '800',
            color: '#FFFFFF',
            margin: 0,
            letterSpacing: '-0.3px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {(activeTab === 'Purchase Orders' && isExecutiveOrMD) 
              ? 'Purchase Order Approvals' 
              : (activeTab === 'Purchase Orders' && userRole.includes('Accounts')) 
                ? 'Purchase Order Verification' 
                : (activeTab === 'Dashboard' && (userRole === 'Billing' || userRole === 'Invoice Executive'))
                  ? 'Billing Dashboard'
                  : (activeTab === 'Dashboard' && (userRole.includes('Accounts') || userRole === 'Finance & Accounts'))
                    ? 'Finance Dashboard'
                    : (activeTab || 'Dashboard')}
          </h2>
        </div>
      </div>

      {/* Right side: Actions & Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>

        {/* Real-time Enterprise Notification Center */}
        <NotificationCenter onNavigateTab={onSelectTab} />

        {/* Vertical Separator */}
        <div style={{ width: '1px', height: '22px', backgroundColor: 'rgba(255, 255, 255, 0.25)' }} />

        {/* Profile Details Dropdown Trigger */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setShowRoleMenu(prev => !prev);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', position: 'relative' }}
        >
          {/* Circular Profile Photo Initials Avatar */}
          <div 
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              color: '#0E7490',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '900',
              fontSize: '13px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
          >
            {avatarLetter}
          </div>

          {/* Name of the person */}
          <div className="header-user-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#FFFFFF', lineHeight: '1.2', letterSpacing: '-0.2px' }}>
              {userName}
            </span>
            <span style={{ fontSize: '10.5px', color: '#BAE6FD', fontWeight: '600' }}>
              {userRole}
            </span>
          </div>
          <ChevronDown className="header-user-chevron" style={{ width: '15px', height: '15px', color: '#FFFFFF', opacity: 0.9 }} />

          {/* Profile Menu Popup */}
          {showRoleMenu && (
            <div
              role="menu"
              aria-label="Account menu"
              className="bz-profile-menu"
              style={{
                position: 'absolute',
                top: '50px',
                right: 0,
                width: '300px',
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.25), 0 2px 6px rgba(15, 23, 42, 0.05)',
                zIndex: 99999,
                maxHeight: 'calc(100vh - 84px)',
                overflowY: 'auto',
                cursor: 'default',
                color: '#0F172A',
                fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Identity card */}
              <div style={{ padding: '16px', background: 'linear-gradient(135deg, #ECFEFF 0%, #FFFFFF 100%)', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #0E7490 0%, #155E75 100%)', color: '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', fontWeight: '800', boxShadow: '0 4px 12px rgba(14, 116, 144, 0.3)'
                  }}>
                    {avatarLetter}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '14.5px', fontWeight: '800', color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {safeName}
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={userEmail}>
                      {userEmail}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#0E7490', backgroundColor: '#FFFFFF', border: '1px solid #A5F3FC', padding: '3px 10px', borderRadius: '50px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <ShieldCheck size={12} /> {userRole}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '3px 10px', borderRadius: '50px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16A34A' }} /> Signed in
                  </span>
                </div>
              </div>

              {/* Navigation items */}
              <div style={{ padding: '8px' }}>
                <button
                  type="button"
                  role="menuitem"
                  className="bz-menu-item"
                  onClick={() => {
                    setShowRoleMenu(false);
                    onSelectTab && onSelectTab('Settings');
                  }}
                >
                  <span className="bz-menu-icon" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                    <Settings size={16} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <span className="bz-menu-title">Settings</span>
                    <span className="bz-menu-sub">Preferences, integrations & credentials</span>
                  </span>
                  <ChevronRight size={15} style={{ color: '#CBD5E1' }} />
                </button>
              </div>

              {/* Logout */}
              <div style={{ padding: '8px', borderTop: '1px solid #F1F5F9' }}>
                <button
                  type="button"
                  role="menuitem"
                  className="bz-menu-item bz-menu-danger"
                  onClick={() => {
                    setShowRoleMenu(false);
                    const logoutHandler = onLogout || onOpenLoginModal;
                    logoutHandler && logoutHandler();
                  }}
                >
                  <span className="bz-menu-icon"><LogOut size={16} /></span>
                  <span style={{ flex: 1 }}>
                    <span className="bz-menu-title">Log out</span>
                  </span>
                </button>
              </div>

              {/* Footer */}
              <div style={{ padding: '10px 16px 12px', backgroundColor: '#F8FAFC', borderTop: '1px solid #F1F5F9', fontSize: '11px', color: '#94A3B8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700', color: '#64748B' }}>BUSINZ · v1.5.69</span>
                  <button
                    type="button"
                    onClick={() => setShowTerms(prev => !prev)}
                    style={{ border: 'none', background: 'none', padding: 0, color: '#0E7490', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    {showTerms ? 'Hide terms' : 'Terms & Conditions'}
                  </button>
                </div>
                {showTerms && (
                  <div style={{ marginTop: '8px', color: '#64748B', lineHeight: 1.5 }}>
                    Confidential internal enterprise management platform for VRM Structures. Authorised users only.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
