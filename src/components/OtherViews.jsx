import React, { Component } from 'react';
import RfpView from './views/RfpView';
import VendorManagementView from './views/VendorManagementView';
import QuotationsView from './views/QuotationsView';
import GoodsReceiptNoteView from './views/GoodsReceiptNoteView';
import InvoiceUploadView from './views/InvoiceUploadView';
import PaymentsView from './views/PaymentsView';
import VendorPerformanceView from './views/VendorPerformanceView';
import SpendAnalyticsView from './views/SpendAnalyticsView';
import MaterialReorderView from './views/MaterialReorderView';
import StockStatusView from './views/StockStatusView';
import PriceComparisonView from './views/PriceComparisonView';
import ItemsDirectoryView from './views/ItemsDirectoryView';
import ProcurementReportsView from './views/ProcurementReportsView';
import DispatchDashboardView from './views/DispatchDashboardView';
import ProductionViewsEngine from './views/ProductionViewsEngine';
import BomOrdersView from './views/BomOrdersView';
import PresetManagementView from './views/PresetManagementView';
import SalesCrmEngine from './crm/SalesCrmEngine';
import BackupVaultView from './views/BackupVaultView';
import { RefreshCw } from 'lucide-react';

class ViewErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error(`Render error in view "${this.props.activeTab}":`, error, errorInfo);
  }
  componentDidUpdate(prevProps) {
    if (prevProps.activeTab !== this.props.activeTab && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '32px',
          margin: '20px 0',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '20px' }}>
            ⚠️
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: '0 0 6px' }}>
            View Loading Notice: {this.props.activeTab}
          </h3>
          <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '420px', margin: '0 auto 16px', lineHeight: '1.5' }}>
            This view encountered a display issue. Your other tabs and navigation remain fully active.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: '8px 18px',
                backgroundColor: '#0E7490',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} /> Retry Loading View
            </button>
          </div>
          {this.state.error && (
            <details open style={{ marginTop: '14px', textAlign: 'left', backgroundColor: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '11px', color: '#64748B' }}>
              <summary style={{ cursor: 'pointer', fontWeight: '700', color: '#DC2626' }}>Technical Details</summary>
              <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#991B1B', fontFamily: 'monospace' }}>
                {this.state.error.stack || this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

export default function OtherViews(props) {
  const { activeTab, userRole = 'Sales Executive' } = props;

  return (
    <ViewErrorBoundary activeTab={activeTab}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        {activeTab === 'Requests for Purchase' && <RfpView {...props} />}
        {activeTab === 'Vendor Management' && <VendorManagementView {...props} />}
        {(activeTab === 'Goods Receipt Note' || activeTab === 'Goods Receipt Note (GRN)') && <GoodsReceiptNoteView {...props} />}
        {activeTab === 'Upload Invoice' && <InvoiceUploadView {...props} />}
        {activeTab === 'Payments' && (
          userRole === 'Procurement Head' || userRole === 'Procurement Admin' || userRole?.includes('Procurement') ? (
            <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', marginTop: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '8px' }}>Access Restricted</h3>
              <p style={{ fontSize: '13px', color: '#64748B' }}>The Payments screen is not available for Procurement Head.</p>
            </div>
          ) : (
            <PaymentsView {...props} />
          )
        )}
        {activeTab === 'Vendor Performance' && <VendorPerformanceView {...props} />}
        {activeTab === 'Spend Analytics' && <SpendAnalyticsView {...props} />}
        {activeTab === 'Material Reorder' && <MaterialReorderView {...props} />}
        {activeTab === 'Stock Status' && (
          (userRole === 'Sales Head' || userRole === 'Sales Executive') ? (
            <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', marginTop: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '8px' }}>Access Restricted</h3>
              <p style={{ fontSize: '13px', color: '#64748B' }}>Please use Inventory Stores or Raw Material Directory.</p>
            </div>
          ) : (
            <StockStatusView {...props} />
          )
        )}
        {activeTab === 'Price Comparison' && <PriceComparisonView {...props} />}
        {activeTab === 'Items Directory' && (
          (userRole === 'Sales Head' || userRole === 'Sales Executive') ? (
            <div style={{ padding: '32px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', marginTop: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', marginBottom: '8px' }}>Access Restricted</h3>
              <p style={{ fontSize: '13px', color: '#64748B' }}>Items & Materials Catalog is restricted for Sales accounts.</p>
            </div>
          ) : (
            <ItemsDirectoryView {...props} />
          )
        )}
        {(activeTab === 'Procurement Reports' || activeTab === 'Spend Reports' || activeTab === 'Supplier Reports') && <ProcurementReportsView {...props} />}
        {(activeTab === 'Dispatch Dashboard' || (userRole === 'Dispatch Head' && activeTab === 'Dashboard')) && <DispatchDashboardView {...props} />}

        {/* Sales CRM Master Engine (Individual Dedicated Tabs) */}
        {['Sales CRM', 'CRM', 'Sales & CRM', 'Leads', 'Customers', 'Customer Management', 'Opportunities', 'Follow-ups', 'WhatsApp Inbox', 'Quotations', 'Product Catalog', 'Sales Reports'].includes(activeTab) && (
          <SalesCrmEngine
            userRole={userRole}
            activeTab={activeTab}
            onNavigateTab={props.onChangeTab || props.onSelectTab}
          />
        )}

        {/* BOM Orders dedicated view */}
        {['BOM Orders', 'BOM', 'Sales BOM', 'BOM / Routing'].includes(activeTab) && (
          <BomOrdersView {...props} />
        )}

        {/* Preset Management dedicated view (Tech Support & Admin) */}
        {['Preset Management', 'Presets', 'BOM Presets'].includes(activeTab) && (
          <PresetManagementView {...props} />
        )}

        {/* Backup & Disaster Recovery Vault */}
        {['Backup & Vault', 'Backup & Restore', 'System Backup', 'Disaster Recovery', 'Backup Vault'].includes(activeTab) && (
          <BackupVaultView userRole={userRole} />
        )}

        {/* Production & BOM & Invoices engine */}
        {(![
          'Requests for Purchase', 'Vendor Management', 'Quotations',
          'Goods Receipt Note', 'Goods Receipt Note (GRN)', 'Upload Invoice', 'Payments',
          'Vendor Performance', 'Spend Analytics', 'Material Reorder',
          'Stock Status', 'Price Comparison', 'Items Directory',
          'Procurement Reports', 'Spend Reports', 'Supplier Reports',
          'Dispatch Dashboard', 'BOM Orders', 'BOM', 'Sales BOM', 'BOM / Routing',
          'Preset Management', 'Presets', 'BOM Presets',
          'Backup & Vault', 'Backup & Restore', 'System Backup', 'Disaster Recovery', 'Backup Vault',
          'Sales CRM', 'CRM', 'Sales & CRM', 'Leads', 'Customers', 'Customer Management', 'Opportunities', 'Follow-ups', 'WhatsApp Inbox', 'Quotations', 'Product Catalog', 'Sales Reports'
        ].includes(activeTab) || ['Work Orders', 'Planning & Scheduling', 'Production Monitoring',
          'Quality Control', 'Machine Maintenance', 'Inventory',
          'Production Reports', 'Efficiency Reports', 'Downtime Analytics',
          'Add Work Order', 'Record Production', 'Report Downtime', 'Dispatch Orders', 'Accounts Verification', 'Invoice Management'
        ].includes(activeTab)) && activeTab !== 'Dispatch Dashboard' && !['BOM Orders', 'BOM', 'Sales BOM', 'BOM / Routing', 'Backup & Vault', 'Backup & Restore', 'System Backup', 'Disaster Recovery', 'Backup Vault'].includes(activeTab) && (
          <ProductionViewsEngine {...props} />
        )}
      </div>
    </ViewErrorBoundary>
  );
}

