import React from 'react';
import { CheckCircle2, ClipboardList } from 'lucide-react';
import { CeoKpiGrid } from '../views/CeoExecutiveDashboardView';
import CeoProductionAnalyticsSection from '../views/CeoProductionAnalyticsSection';

export default function CeoProductionTab({
  workOrdersList = [],
  activeWorkOrdersCount = 0,
  completedWorkOrdersCount = 0,
  bomList = [],
  inventoryList = [],
  onNavigateTab
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Production Top Ribbon (BUSINZ DESIGN SYSTEM) */}
      <CeoKpiGrid kpis={[
        {
          title: 'WORK ORDERS',
          value: `${workOrdersList.length} Work Orders`,
          trend: `${activeWorkOrdersCount} In-Progress`,
          trendUp: workOrdersList.length > 0,
          icon: ClipboardList,
          iconColor: '#0E7490',
          iconBg: '#ECFEFF',
          bottomPrefix: 'Active lines ',
          bottomHighlight: `${activeWorkOrdersCount} In Production`,
          onClick: () => onNavigateTab && onNavigateTab('Work Orders')
        },
        {
          title: 'COMPLETED WORK ORDERS',
          value: `${completedWorkOrdersCount} Completed`,
          trend: `${workOrdersList.length > 0 ? Math.round((completedWorkOrdersCount / workOrdersList.length) * 100) : 100}% Done`,
          trendUp: true,
          icon: CheckCircle2,
          iconColor: '#16A34A',
          iconBg: '#F0FDF4',
          bottomPrefix: 'Completion rate ',
          bottomHighlight: `${completedWorkOrdersCount} of ${workOrdersList.length} Finished`,
          onClick: () => onNavigateTab && onNavigateTab('Work Orders')
        }
      ]} />

      <CeoProductionAnalyticsSection
        workOrdersList={workOrdersList}
        bomList={bomList}
        inventoryList={inventoryList}
      />
    </div>
  );
}
