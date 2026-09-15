import React, { useState } from 'react';
import {
  LayoutDashboard,
  GitBranch,
  Warehouse,
  ClipboardList,
  MessageSquare,
  ShoppingCart,
  LogOut,
  Monitor,
  Smartphone,
  Layers,
  ChevronDown
} from 'lucide-react';

import MobileDashboardView from './views/MobileDashboardView';
import MobileInventoryView from './views/MobileInventoryView';
import MobileBomOrdersView from './views/MobileBomOrdersView';
import MobileWorkOrdersView from './views/MobileWorkOrdersView';
import MobilePurchaseOrdersView from './views/MobilePurchaseOrdersView';
import MobileCrmView from './views/MobileCrmView';

export default function MobileLayout({
  userRole,
  onSwitchRole,
  onSignOut,
  onToggleDesktopView
}) {
  const [activeTab, setActiveTab] = useState('Home'); // 'Home' | 'BOM' | 'Stock' | 'WorkOrders' | 'WhatsApp' | 'PurchaseOrders'
  const [showRoleDrawer, setShowRoleDrawer] = useState(false);

  const roles = [
    'CEO', 'MD', 'Sales Head', 'Sales Executive',
    'Production Head', 'Floor Supervisor', 'Dispatch Head',
    'Procurement Head', 'Accounts Head'
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#F8FAFC',
      color: '#0F172A',
      fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
      position: 'relative',
      maxWidth: '520px',
      margin: '0 auto',
      boxShadow: '0 0 40px rgba(0, 0, 0, 0.08)'
    }}>
      {/* 1. TOP MOBILE HEADER */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#0E7490',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '900',
            fontSize: '15px'
          }}>
            CR
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '900', color: '#0F172A', lineHeight: 1.1 }}>
              Control Room
            </div>
            <div
              onClick={() => setShowRoleDrawer(!showRoleDrawer)}
              style={{
                fontSize: '11px',
                color: '#0E7490',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                cursor: 'pointer',
                marginTop: '2px'
              }}
            >
              <span>{userRole}</span>
              <ChevronDown size={12} />
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Switch to Desktop button */}
          <button
            onClick={onToggleDesktopView}
            title="Switch to Desktop View"
            style={{
              backgroundColor: '#F1F5F9',
              border: '1px solid #E2E8F0',
              color: '#475569',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <Monitor size={14} />
            <span>Web</span>
          </button>

          <button
            onClick={onSignOut}
            title="Sign Out"
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FEE2E2',
              color: '#DC2626',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Role Switcher Sheet Modal */}
      {showRoleDrawer && (
        <div
          onClick={() => setShowRoleDrawer(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              padding: '20px',
              maxHeight: '60vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ width: '40px', height: '4px', backgroundColor: '#CBD5E1', borderRadius: '2px', margin: '0 auto 12px auto' }} />
            <h3 style={{ fontSize: '15px', fontWeight: '800', margin: '0 0 12px 0', color: '#0F172A' }}>
              Switch Mobile User Role
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              {roles.map(r => (
                <button
                  key={r}
                  onClick={() => {
                    onSwitchRole(r);
                    setShowRoleDrawer(false);
                  }}
                  style={{
                    backgroundColor: userRole === r ? '#ECFEFF' : '#F8FAFC',
                    color: userRole === r ? '#0E7490' : '#334155',
                    border: userRole === r ? '1px solid #0E7490' : '1px solid #E2E8F0',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. MAIN SCROLLABLE VIEW CONTAINER */}
      <main style={{ flex: 1, padding: '14px', overflowY: 'auto' }}>
        {activeTab === 'Home' && (
          <MobileDashboardView userRole={userRole} onNavigateTab={setActiveTab} />
        )}

        {activeTab === 'BOM' && (
          <MobileBomOrdersView userRole={userRole} onNavigate={setActiveTab} />
        )}

        {activeTab === 'Stock' && (
          <MobileInventoryView userRole={userRole} onNavigate={setActiveTab} />
        )}

        {activeTab === 'WorkOrders' && (
          <MobileWorkOrdersView userRole={userRole} onNavigate={setActiveTab} />
        )}

        {activeTab === 'PurchaseOrders' && (
          <MobilePurchaseOrdersView userRole={userRole} onNavigate={setActiveTab} />
        )}

        {activeTab === 'WhatsApp' && (
          <MobileCrmView userRole={userRole} />
        )}
      </main>

      {/* 3. FIXED NATIVE-STYLE BOTTOM NAVIGATION BAR */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '520px',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E2E8F0',
        padding: '6px 12px 12px 12px',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        zIndex: 9999,
        boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.04)',
        boxSizing: 'border-box'
      }}>
        {/* Tab 1: Home */}
        <button
          onClick={() => setActiveTab('Home')}
          style={{
            border: 'none',
            background: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            color: activeTab === 'Home' ? '#0E7490' : '#94A3B8',
            cursor: 'pointer',
            padding: '4px 0'
          }}
        >
          <LayoutDashboard size={20} strokeWidth={activeTab === 'Home' ? 2.5 : 1.8} />
          <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'Home' ? '800' : '600' }}>Home</span>
        </button>

        {/* Tab 2: BOM Orders */}
        <button
          onClick={() => setActiveTab('BOM')}
          style={{
            border: 'none',
            background: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            color: activeTab === 'BOM' ? '#2563EB' : '#94A3B8',
            cursor: 'pointer',
            padding: '4px 0'
          }}
        >
          <GitBranch size={20} strokeWidth={activeTab === 'BOM' ? 2.5 : 1.8} />
          <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'BOM' ? '800' : '600' }}>BOM</span>
        </button>

        {/* Tab 3: Stock Stores */}
        <button
          onClick={() => setActiveTab('Stock')}
          style={{
            border: 'none',
            background: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            color: activeTab === 'Stock' ? '#0E7490' : '#94A3B8',
            cursor: 'pointer',
            padding: '4px 0'
          }}
        >
          <Warehouse size={20} strokeWidth={activeTab === 'Stock' ? 2.5 : 1.8} />
          <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'Stock' ? '800' : '600' }}>Stock</span>
        </button>

        {/* Tab 4: Work Orders (Factory Floor) */}
        <button
          onClick={() => setActiveTab('WorkOrders')}
          style={{
            border: 'none',
            background: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            color: activeTab === 'WorkOrders' ? '#7C3AED' : '#94A3B8',
            cursor: 'pointer',
            padding: '4px 0'
          }}
        >
          <ClipboardList size={20} strokeWidth={activeTab === 'WorkOrders' ? 2.5 : 1.8} />
          <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'WorkOrders' ? '800' : '600' }}>Floor</span>
        </button>

        {/* Tab 5: Chat / CRM */}
        <button
          onClick={() => setActiveTab('WhatsApp')}
          style={{
            border: 'none',
            background: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            color: activeTab === 'WhatsApp' ? '#16A34A' : '#94A3B8',
            cursor: 'pointer',
            padding: '4px 0'
          }}
        >
          <MessageSquare size={20} strokeWidth={activeTab === 'WhatsApp' ? 2.5 : 1.8} />
          <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'WhatsApp' ? '800' : '600' }}>Chat</span>
        </button>
      </nav>
    </div>
  );
}
