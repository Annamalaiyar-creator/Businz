import React from 'react';
import { Boxes, AlertTriangle, Layers } from 'lucide-react';
import CeoKpiGrid from './CeoKpiGrid';
import CeoInventoryAnalyticsSection from '../views/CeoInventoryAnalyticsSection';

export default function CeoInventoryTab({
  inventoryList = [],
  bomList = [],
  allGrnList = [],
  allPoList = [],
  totalProductionTonnage = 0,
  onNavigateTab
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Inventory Top Ribbon (BUSINZ DESIGN SYSTEM) */}
      <CeoKpiGrid kpis={[
        {
          title: 'TOTAL INVENTORY SKUS',
          value: `${inventoryList.length} Items`,
          trend: 'Catalog Synced',
          trendUp: true,
          icon: Boxes,
          iconColor: '#0E7490',
          iconBg: '#ECFEFF',
          bottomPrefix: 'Items directory ',
          bottomHighlight: `${inventoryList.length} Active SKUs`,
          onClick: () => onNavigateTab && onNavigateTab('Items Directory')
        },
        {
          title: 'LOW STOCK / REORDER ALERTS',
          value: `${inventoryList.filter(it => (parseFloat(it.stock || it.quantity || it.availableStock || 0) || 0) <= (parseFloat(it.minStock || it.reorderLevel || 10) || 10)).length} Items`,
          trend: inventoryList.filter(it => (parseFloat(it.stock || it.quantity || it.availableStock || 0) || 0) <= (parseFloat(it.minStock || it.reorderLevel || 10) || 10)).length > 0 ? 'Critical' : 'Healthy',
          trendUp: inventoryList.filter(it => (parseFloat(it.stock || it.quantity || it.availableStock || 0) || 0) <= (parseFloat(it.minStock || it.reorderLevel || 10) || 10)).length === 0,
          highlightCard: inventoryList.filter(it => (parseFloat(it.stock || it.quantity || it.availableStock || 0) || 0) <= (parseFloat(it.minStock || it.reorderLevel || 10) || 10)).length > 0,
          icon: AlertTriangle,
          iconColor: '#DC2626',
          iconBg: '#FEF2F2',
          bottomPrefix: 'Reorder status ',
          bottomHighlight: 'Below Minimum Threshold',
          onClick: () => onNavigateTab && onNavigateTab('Material Reorder')
        },
        {
          title: 'RESERVED FOR BOMS',
          value: `${bomList.length} Active BOMs`,
          trend: `${totalProductionTonnage.toFixed(1)} MT`,
          trendUp: bomList.length > 0,
          icon: Layers,
          iconColor: '#2563EB',
          iconBg: '#EFF6FF',
          bottomPrefix: 'Material allocation ',
          bottomHighlight: `${totalProductionTonnage.toFixed(1)} MT Allocated`,
          onClick: () => onNavigateTab && onNavigateTab('Stock Status')
        }
      ]} />

      <CeoInventoryAnalyticsSection
        inventoryList={inventoryList}
        bomList={bomList}
        grnList={allGrnList}
        poList={allPoList}
        onNavigateTab={onNavigateTab}
      />
    </div>
  );
}
