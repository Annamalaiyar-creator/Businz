import React, { useState, useEffect } from 'react';
import { Bell, HelpCircle, ChevronDown, LogOut, Check, RotateCcw, CheckCircle2, ArrowRight, Code, FileCheck, CheckCircle, Menu, Smartphone } from 'lucide-react';

import { isRoleTargeted, speakNotificationVoice, playPorterOrderAlert, getPorterVoiceCue } from '../services/notificationService';

export const filterCompletedBomNotifications = (notificationsList) => {
  if (!Array.isArray(notificationsList) || notificationsList.length === 0) return [];
  
  let boms = [];
  try {
    const savedBoms = localStorage.getItem('controlroom_bom_store');
    if (savedBoms) boms = JSON.parse(savedBoms);
  } catch (e) {}

  const completedBomCodes = new Set();
  if (Array.isArray(boms)) {
    boms.forEach(b => {
      if (!b) return;
      const code = String(b.bomCode || b.code || b.id || '').toUpperCase().trim();
      const status = String(b.status || '').toLowerCase().trim();
      const isCompleted = 
        b.invoiceConfirmed ||
        status === 'completed' ||
        status.includes('awaiting vehicle loading') ||
        status.includes('fully dispatched') ||
        status.includes('closed') ||
        (b.accountsVerification && b.accountsVerification.verified);
      
      if (code && isCompleted) {
        completedBomCodes.add(code);
      }
    });
  }

  // BOM-621 is specifically completed
  completedBomCodes.add('BOM-621');

  return notificationsList.filter(n => {
    if (!n) return false;
    const txt = `${n.title || ''} ${n.message || ''}`.toUpperCase();
    for (const code of completedBomCodes) {
      if (txt.includes(code)) {
        // Obsolete packing/verification notifications for completed BOMs
        if (txt.includes('PACK') || txt.includes('PACKED') || txt.includes('PACKING') || txt.includes('READY FOR DISPATCH')) {
          return false;
        }
      }
    }
    return true;
  });
};

export const addLiveNotification = (notif) => {
  try {
    const existing = JSON.parse(localStorage.getItem('vrm_live_notifications') || '[]');
    const notifWithId = {
      id: notif.id || `notif-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      time: notif.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      targetRoles: notif.targetRoles || (notif.role ? [notif.role] : ['All']),
      role: notif.role || (Array.isArray(notif.targetRoles) ? notif.targetRoles[0] : 'All'),
      ...notif
    };
    const cleaned = filterCompletedBomNotifications(existing);
    const updated = [notifWithId, ...cleaned.filter(n => {
      if (notifWithId.id && n.id === notifWithId.id) return false;
      if (notifWithId.message && n.message === notifWithId.message) return false;
      return true;
    })].slice(0, 50);
    localStorage.setItem('vrm_live_notifications', JSON.stringify(updated));
    window.dispatchEvent(new Event('vrm_notifications_updated'));

    // Play Porter order alert chime and speak short punchy voice cue
    playPorterOrderAlert();
    setTimeout(() => {
      const cue = getPorterVoiceCue(notifWithId);
      speakNotificationVoice(cue, { rate: 1.12, pitch: 1.05 });
    }, 320);
  } catch (e) {
    console.error('Error adding live notification:', e);
  }
};

export default function Header({ activeTab, userRole = 'Procurement Admin', onSwitchRole, onOpenLoginModal, onSelectTab, onToggleSidebar }) {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const isExecutiveOrMD = userRole === 'CEO' || userRole === 'Managing Director' || userRole === 'MD';
  
  const [readIds, setReadIds] = useState(() => {
    try {
      const saved = localStorage.getItem('controlroom_read_notification_ids');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [liveNotifications, setLiveNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('vrm_live_notifications');
      const parsed = saved ? JSON.parse(saved) : [];
      const cleaned = filterCompletedBomNotifications(parsed);
      if (cleaned.length !== parsed.length) {
        localStorage.setItem('vrm_live_notifications', JSON.stringify(cleaned));
      }
      return cleaned;
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem('vrm_live_notifications');
        const parsed = saved ? JSON.parse(saved) : [];
        const cleaned = filterCompletedBomNotifications(parsed);
        if (cleaned.length !== parsed.length) {
          localStorage.setItem('vrm_live_notifications', JSON.stringify(cleaned));
        }
        setLiveNotifications(cleaned);
      } catch (e) {}
    };
    const handleOutsideClick = () => {
      setShowRoleMenu(false);
      setShowNotificationMenu(false);
    };
    window.addEventListener('vrm_notifications_updated', handleUpdate);
    window.addEventListener('click', handleOutsideClick);
    return () => {
      window.removeEventListener('vrm_notifications_updated', handleUpdate);
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);


  // Filter notifications based on active user login role (or show system-wide alerts)
  const roleNotifications = liveNotifications.filter(n => {
    return isRoleTargeted(userRole, n.targetRoles || n.role, n.metadata);
  });

  const unreadNotifications = roleNotifications.filter(n => {
    const isReadById = n.id && readIds.includes(n.id);
    const isReadByMsg = n.message && readIds.includes(n.message);
    return !isReadById && !isReadByMsg;
  });
  const unreadCount = unreadNotifications.length;

  // Map userRole or logged_user_name to person's actual name
  const storedName = localStorage.getItem('controlroom_logged_user_name');
  let userName = (storedName && storedName !== 'undefined' && storedName !== 'null') ? storedName : '';
  if (!userName) {
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
  if (!userName) {
    if (userRole === 'Production Head') userName = 'Senthil Kumar';
    else if (userRole === 'Technical Administrator' || userRole === 'CEO') userName = 'Annamalaiyar';
    else if (userRole === 'Dispatch Head') userName = 'Kalpana';
    else if (userRole === 'Floor Supervisor') userName = 'Floor Supervisor';
    else if (userRole === 'Floor Employee') userName = 'Floor Employee';
    else if (userRole === 'Accounts Head') userName = 'Venkatesh';
    else if (userRole === 'Accounts Executive') userName = 'Priya';
    else if (userRole === 'Sales Head') userName = 'Vijay';
    else if (userRole === 'Sales Executive') userName = 'Mohith JV';
    else if (userRole === 'Design Engineer') userName = 'Dinesh';
    else if (userRole === 'Design Executive') userName = 'Kavitha';
    else if (userRole === 'Invoice Executive' || userRole === 'Billing') userName = 'Anand';
    else if (userRole === 'BOM Executive') userName = 'Balaji';
    else if (userRole === 'Procurement Head' || userRole === 'Procurement Admin') userName = 'Annamalaiyar';
    else userName = 'Annamalaiyar';
  }
  const safeName = (userName && userName !== 'undefined' && userName !== 'null') ? userName : 'Annamalaiyar';
  const avatarLetter = (safeName.charAt(0) || 'A').toUpperCase();

  const storedEmail = localStorage.getItem('controlroom_logged_user');
  const userEmail = (storedEmail && storedEmail.includes('@'))
    ? storedEmail
    : `${safeName.toLowerCase().replace(/[^a-z0-9]/g, '')}@vrmstructures.in`;

  const deleteItem = (item, e) => {
    if (e) e.stopPropagation();
    try {
      const itemId = typeof item === 'object' ? item.id : item;
      const itemMsg = typeof item === 'object' ? item.message : (typeof item === 'string' ? item : null);
      const existing = JSON.parse(localStorage.getItem('vrm_live_notifications') || '[]');
      const filtered = existing.filter(n => {
        if (itemId && n.id === itemId) return false;
        if (itemMsg && n.message === itemMsg) return false;
        return true;
      });
      localStorage.setItem('vrm_live_notifications', JSON.stringify(filtered));
      setLiveNotifications(filtered);
      window.dispatchEvent(new Event('vrm_notifications_updated'));
    } catch (err) {}
  };


  const markItemAsRead = (item, e) => {
    if (e) e.stopPropagation();
    const itemId = typeof item === 'object' ? (item.id || item.message) : item;
    if (!itemId) return;
    const itemMsg = typeof item === 'object' ? item.message : null;
    const additions = [itemId, itemMsg].filter(Boolean);
    const updated = Array.from(new Set([...readIds, ...additions]));
    setReadIds(updated);
    try {
      localStorage.setItem('controlroom_read_notification_ids', JSON.stringify(updated));
      localStorage.setItem('controlroom_notifications_read', 'true');
    } catch (err) {}
  };

  const markAllAsRead = (e) => {
    if (e) e.stopPropagation();
    const currentKeys = [];
    roleNotifications.forEach(n => {
      if (n.id) currentKeys.push(n.id);
      if (n.message) currentKeys.push(n.message);
    });
    const updated = Array.from(new Set([...readIds, ...currentKeys]));
    setReadIds(updated);
    try {
      localStorage.setItem('controlroom_read_notification_ids', JSON.stringify(updated));
      localStorage.setItem('controlroom_notifications_read', 'true');
    } catch (err) {}
  };

  const handleNotificationItemClick = (notif) => {
    // 1. Mark read so it disappears from the notification spot
    markItemAsRead(notif);
    // 2. Close notification menu
    setShowNotificationMenu(false);
    // 3. Navigate to the respective screen
    if (onSelectTab && notif.targetTab) {
      onSelectTab(notif.targetTab);
    }
  };

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
            {(activeTab === 'Purchase Orders' && isExecutiveOrMD) ? 'Purchase Order Approvals' : (activeTab === 'Purchase Orders' && userRole.includes('Accounts')) ? 'Purchase Order Verification' : (activeTab || 'Dashboard')}
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


        {/* Neumorphism Notification Icon Button with Disappearing Badge Animation */}
        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
          <button 
            title="Notifications"
            onClick={(e) => {
              e.stopPropagation();
              setShowNotificationMenu(prev => !prev);
              setShowRoleMenu(false);
            }}
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
            {/* Solid Dark Slate Bell Icon */}
            <Bell style={{ width: '18px', height: '18px', color: '#1E293B', fill: '#1E293B' }} />
            
            {/* Red Circle Badge with count */}
            {unreadCount > 0 && (
              <span 
                style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  width: '18px',
                  height: '18px',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  borderRadius: '50%',
                  fontSize: '11px',
                  fontWeight: '900',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #FFFFFF',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
                  lineHeight: '1',
                  pointerEvents: 'none'
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotificationMenu && (
            <div
              style={{
                position: 'absolute',
                top: '52px',
                right: 0,
                backgroundColor: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 12px 30px -5px rgba(15, 23, 42, 0.2)',
                width: '320px',
                padding: '16px',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                color: '#0F172A'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>Notifications</span>
                  {unreadCount > 0 && (
                    <span style={{ fontSize: '10px', backgroundColor: '#EFF6FF', color: '#0284C7', fontWeight: '800', padding: '2px 7px', borderRadius: '10px' }}>
                      {unreadCount} New
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      style={{ border: 'none', background: 'none', color: '#0284C7', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                {unreadNotifications.length > 0 ? (
                  unreadNotifications.map((notif, idx) => (
                    <div 
                      key={notif.id || notif.message || `notif-${idx}`}
                      onClick={() => handleNotificationItemClick(notif)}
                      style={{ 
                        backgroundColor: '#F8FAFC', 
                        padding: '10px 12px', 
                        borderRadius: '10px', 
                        border: '1px solid #F1F5F9', 
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F1F5F9';
                        e.currentTarget.style.borderColor = '#CBD5E1';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                        e.currentTarget.style.borderColor = '#F1F5F9';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: notif.badgeColor || '#0284C7', display: 'inline-block' }}></span>
                          {notif.title}
                        </div>
                        <button
                          title="Delete notification"
                          onClick={(e) => deleteItem(notif, e)}
                          style={{ border: 'none', background: 'none', color: '#94A3B8', fontSize: '12px', cursor: 'pointer', padding: '0 2px' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#DC2626'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#94A3B8'}
                        >
                          ✕
                        </button>
                      </div>
                      <div style={{ color: '#475569', fontSize: '11px', marginTop: '3px' }}>{notif.message}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                        <span style={{ color: '#94A3B8', fontSize: '10px' }}>{notif.time}</span>
                        <span style={{ color: '#0284C7', fontSize: '10.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          Open {notif.targetTab} <ArrowRight style={{ width: '10px', height: '10px' }} />
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '20px 10px', textAlign: 'center', color: '#64748B', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 style={{ width: '26px', height: '26px', color: '#16A34A' }} />
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#0F172A' }}>No unread notifications</span>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>All notifications have been read and cleared</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Vertical Separator */}
        <div style={{ width: '1px', height: '22px', backgroundColor: 'rgba(255, 255, 255, 0.25)' }} />

        {/* Profile Details Dropdown Trigger */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setShowRoleMenu(prev => !prev);
            setShowNotificationMenu(false);
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

          {/* Role & Login Menu Popup */}
          {showRoleMenu && (
            <div 
              style={{
                position: 'absolute',
                top: '46px',
                right: 0,
                backgroundColor: '#FFFFFF',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 12px 30px -5px rgba(15, 23, 42, 0.2)',
                width: '240px',
                padding: '8px',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#0F172A', lineHeight: '1.2' }}>{safeName}</div>
                <div style={{ fontSize: '11px', color: '#0E7490', fontWeight: '700', marginTop: '3px' }}>{userRole}</div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{userEmail}</div>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', marginTop: '4px', paddingTop: '4px' }}>

                <button
                  onClick={() => {
                    setShowRoleMenu(false);
                    onOpenLoginModal && onOpenLoginModal();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#FEF2F2',
                    color: '#EF4444',
                    fontSize: '12.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  <LogOut style={{ width: '15px', height: '15px' }} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
