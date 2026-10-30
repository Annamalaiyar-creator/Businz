import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, ChevronDown, LogOut, 
  Menu, ChevronRight, LayoutDashboard, GitBranch, Users, ShieldCheck, 
  X, Share2, MessageSquare, Mail, Sliders, ExternalLink, Check, RefreshCw 
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';

export const filterCompletedBomNotifications = () => [];
export const addLiveNotification = () => {};

export default function Header({ activeTab, userRole = 'Procurement Admin', onSwitchRole, onOpenLoginModal, onSelectTab, onToggleSidebar }) {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const isExecutiveOrMD = userRole === 'CEO' || userRole === 'Managing Director' || userRole === 'MD';
  const isTechAdmin = userRole === 'Technical Administrator' || userRole === 'Technical Admin' || userRole === 'Developer' || (userRole || '').startsWith('TA');

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


  // Map userRole or logged_user_name to person's actual name
  const storedName = localStorage.getItem('controlroom_logged_user_name');
  let userName = (storedName && storedName !== 'undefined' && storedName !== 'null') ? storedName : '';

  // If storedName was previously 'Executive Leadership (CEO)', heal it to actual CEO person name
  if ((userRole === 'CEO' || userRole === 'MD' || userRole === 'Managing Director') && (!userName || userName === 'Executive Leadership (CEO)' || userName === 'CEO')) {
    try {
      const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
      const allEmps = [...(Array.isArray(storedEmps) ? storedEmps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];
      const match = allEmps.find(e => e && ((e.employee_code || '').toUpperCase().startsWith('CEO') || e.role === 'CEO' || e.role === 'Managing Director'));
      if (match && (match.employee_name || match.name)) {
        userName = match.employee_name || match.name;
      }
    } catch(e) {}
    if (!userName || userName === 'Executive Leadership (CEO)' || userName === 'CEO') {
      userName = 'Velmurugan Rathinam';
    }
    localStorage.setItem('controlroom_logged_user_name', userName);
  }

  // If storedName was previously hardcoded as 'Vijay', heal it from registered employee record if available
  if (userRole === 'Sales Head' && (!userName || userName.toLowerCase() === 'vijay' || userName.toLowerCase() === 'sales' || userName.toLowerCase() === 'sales head')) {
    try {
      const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
      const allEmps = [...(Array.isArray(storedEmps) ? storedEmps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];
      const match = allEmps.find(e => e && e.role === 'Sales Head' && e.employee_name && e.employee_name.toLowerCase() !== 'vijay');
      if (match && (match.employee_name || match.name)) {
        userName = match.employee_name || match.name;
        localStorage.setItem('controlroom_logged_user_name', userName);
      }
    } catch(e) {}
  }

  if (!userName || userName === 'Executive Leadership (CEO)') {
    try {
      const storedEmps = JSON.parse(localStorage.getItem('controlroom_employees_list') || '[]');
      const cloudEmps = JSON.parse(localStorage.getItem('controlroom_employees_store') || '[]');
      const allEmps = [...(Array.isArray(storedEmps) ? storedEmps : []), ...(Array.isArray(cloudEmps) ? cloudEmps : [])];
      const match = allEmps.find(e => e && (e.role === userRole || (userRole.includes('Supervisor') && String(e.role).includes('Supervisor')) || (userRole.includes('Dispatch') && String(e.role).includes('Dispatch'))));
      if (match && (match.employee_name || match.name)) {
        userName = match.employee_name || match.name;
      }
    } catch(e) {}
  }
  if (!userName || userName === 'Executive Leadership (CEO)') {
    if (userRole === 'Production Head') userName = 'Senthil Kumar';
    else if (userRole === 'CEO' || userRole === 'MD' || userRole === 'Managing Director') userName = 'Velmurugan Rathinam';
    else if (userRole === 'Technical Administrator') userName = 'Annamalaiyar';
    else if (userRole === 'Dispatch Head') userName = 'Kalpana';
    else if (userRole === 'Floor Supervisor') userName = 'Floor Supervisor';
    else if (userRole === 'Floor Employee') userName = 'Floor Employee';
    else if (userRole === 'Accounts Head') userName = 'Venkatesh';
    else if (userRole === 'Accounts Executive') userName = 'Priya';
    else if (userRole === 'Sales Head') userName = 'Sales Head';
    else if (userRole === 'Sales Executive') userName = 'Sales Executive';
    else if (userRole === 'Design Engineer') userName = 'Dinesh';
    else if (userRole === 'Design Executive') userName = 'Kavitha';
    else if (userRole === 'Invoice Executive' || userRole === 'Billing') userName = 'Anand';
    else if (userRole === 'BOM Executive') userName = 'Balaji';
    else if (userRole === 'Procurement Head' || userRole === 'Procurement Admin') userName = 'Annamalaiyar';
    else userName = 'Annamalaiyar';
  }
  const safeName = (userName && userName !== 'undefined' && userName !== 'null') ? userName : (userRole || 'Annamalaiyar');
  const avatarLetter = (safeName.charAt(0) || 'A').toUpperCase();

  const storedEmail = localStorage.getItem('controlroom_logged_user');
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

        {/* Neumorphism Help & Support Button */}
        <button 
          title="Help & Support"
          className="header-action-help"
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            backgroundColor: '#FFFFFF',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
            transition: 'transform 0.15s ease, boxShadow 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.9)';
          }}
        >
          <HelpCircle style={{ width: '18px', height: '18px', color: '#1E293B' }} />
        </button>

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
                overflow: 'hidden',
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
                    onSelectTab && onSelectTab('Dashboard');
                  }}
                >
                  <span className="bz-menu-icon"><LayoutDashboard size={16} /></span>
                  <span style={{ flex: 1 }}>
                    <span className="bz-menu-title">My Dashboard</span>
                    <span className="bz-menu-sub">Go to your home screen</span>
                  </span>
                  <ChevronRight size={15} style={{ color: '#CBD5E1' }} />
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="bz-menu-item"
                  onClick={() => {
                    setShowRoleMenu(false);
                    onSelectTab && onSelectTab('Integration');
                  }}
                >
                  <span className="bz-menu-icon" style={{ backgroundColor: '#EEF2FF', color: '#4F46E5' }}>
                    <Share2 size={16} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <span className="bz-menu-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Integration
                      <span style={{
                        fontSize: '9.5px',
                        fontWeight: '800',
                        backgroundColor: '#ECFDF5',
                        color: '#059669',
                        padding: '1px 6px',
                        borderRadius: '6px',
                        border: '1px solid #A7F3D0'
                      }}>
                        Live
                      </span>
                    </span>
                    <span className="bz-menu-sub">IndiaMART, WhatsApp, Meta & Zoho APIs</span>
                  </span>
                  <ChevronRight size={15} style={{ color: '#CBD5E1' }} />
                </button>


                <button
                  type="button"
                  role="menuitem"
                  className="bz-menu-item"
                  onClick={() => {
                    setShowRoleMenu(false);
                    onOpenLoginModal && onOpenLoginModal();
                  }}
                >
                  <span className="bz-menu-icon"><Users size={16} /></span>
                  <span style={{ flex: 1 }}>
                    <span className="bz-menu-title">Switch Account</span>
                    <span className="bz-menu-sub">Sign in as a different user</span>
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
                    onOpenLoginModal && onOpenLoginModal();
                  }}
                >
                  <span className="bz-menu-icon"><LogOut size={16} /></span>
                  <span className="bz-menu-title" style={{ flex: 1 }}>Log out</span>
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
