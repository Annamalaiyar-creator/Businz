import 'dart:async';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class DashboardView extends StatefulWidget {
  final String userRole;
  final Function(int) onNavigateTab;

  const DashboardView({
    super.key,
    required this.userRole,
    required this.onNavigateTab,
  });

  @override
  State<DashboardView> createState() => _DashboardViewState();
}

class _DashboardViewState extends State<DashboardView> {
  int totalBoms = 0;
  int lowStockCount = 0;
  int activeWorkOrders = 0;
  int pendingPOs = 0;
  bool isLoading = true;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _loadData();
    // Silent auto-refresh every 7 seconds for live executive dashboard KPIs
    _pollTimer = Timer.periodic(const Duration(seconds: 7), (_) => _silentRefresh());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _silentRefresh() async {
    try {
      final results = await Future.wait([
        ApiService.fetchBoms(),
        ApiService.fetchRawMaterials(),
        ApiService.fetchWorkOrders(),
        ApiService.fetchPurchaseOrders(),
      ]);
      final boms = results[0];
      final mats = results[1];
      final wos = results[2];
      final pos = results[3];

      int lowStock = 0;
      for (final m in mats) {
        final status = (m['status'] ?? '').toString().toLowerCase();
        final stock = num.tryParse('${m['stock'] ?? m['physicalStock'] ?? 0}') ?? 0;
        final minLvl = num.tryParse('${m['minLevel'] ?? 50}') ?? 50;
        if (status.contains('low') || status.contains('out') || stock <= minLvl) {
          lowStock++;
        }
      }

      int activeWo = 0;
      for (final w in wos) {
        final s = (w['status'] ?? '').toString().toLowerCase();
        if (!s.contains('completed')) activeWo++;
      }

      int pendPo = 0;
      for (final p in pos) {
        final s = (p['status'] ?? '').toString().toLowerCase();
        final st = (p['statusType'] ?? '').toString().toLowerCase();
        if (!s.contains('approved') && !st.contains('approved') && !s.contains('closed')) {
          pendPo++;
        }
      }

      if (mounted) {
        setState(() {
          totalBoms = boms.length;
          lowStockCount = lowStock;
          activeWorkOrders = activeWo;
          pendingPOs = pendPo;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadData() async {
    setState(() => isLoading = true);
    try {
      final results = await Future.wait([
        ApiService.fetchBoms(),
        ApiService.fetchRawMaterials(),
        ApiService.fetchWorkOrders(),
        ApiService.fetchPurchaseOrders(),
      ]);

      final boms = results[0];
      final mats = results[1];
      final wos = results[2];
      final pos = results[3];

      int lowStock = 0;
      for (final m in mats) {
        final status = (m['status'] ?? '').toString().toLowerCase();
        final stock = num.tryParse('${m['stock'] ?? m['physicalStock'] ?? 0}') ?? 0;
        final minLvl = num.tryParse('${m['minLevel'] ?? 50}') ?? 50;
        if (status.contains('low') || status.contains('out') || stock <= minLvl) {
          lowStock++;
        }
      }

      int activeWo = 0;
      for (final w in wos) {
        final s = (w['status'] ?? '').toString().toLowerCase();
        if (!s.contains('completed')) activeWo++;
      }

      int pendPo = 0;
      for (final p in pos) {
        final s = (p['status'] ?? '').toString().toLowerCase();
        if (s.contains('open') || s.contains('draft') || s.contains('pending')) {
          pendPo++;
        }
      }

      if (mounted) {
        setState(() {
          totalBoms = boms.length;
          lowStockCount = lowStock;
          activeWorkOrders = activeWo;
          pendingPOs = pendPo;
          isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: AppTheme.primaryTeal,
      onRefresh: _loadData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 1. Executive Welcome Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.08),
                  blurRadius: 15,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppTheme.primaryTeal.withOpacity(0.3),
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: AppTheme.primaryCyan.withOpacity(0.4)),
                            ),
                            child: const Text(
                              'BUSINZ MOBILE',
                              style: TextStyle(
                                color: AppTheme.primaryCyan,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: AppTheme.statusGreen,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Text(
                            'Live Node Sync',
                            style: TextStyle(color: Colors.white70, fontSize: 11),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Operations Control Room',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Active Role: ${widget.userRole}',
                        style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppTheme.primaryTeal,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Center(
                    child: Text(
                      'BZ',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // 2. Section Title
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Key Operational Metrics',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              if (isLoading)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primaryTeal),
                )
              else
                IconButton(
                  icon: const Icon(Icons.refresh, size: 18, color: AppTheme.textMuted),
                  onPressed: _loadData,
                  visualDensity: VisualDensity.compact,
                ),
            ],
          ),
          const SizedBox(height: 10),

          // 3. Grid of 4 Key Metrics
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.25,
            children: [
              _buildMetricCard(
                title: 'BOM Orders',
                value: '$totalBoms',
                subtitle: 'Active BOM Orders',
                icon: Icons.alt_route_rounded,
                color: AppTheme.statusBlue,
                bgColor: AppTheme.statusBlueBg,
                onTap: () => widget.onNavigateTab(2), // Tab 2 = BOM
              ),
              _buildMetricCard(
                title: 'Critical Stock',
                value: '$lowStockCount',
                subtitle: 'Low / Out of Stock',
                icon: Icons.warning_amber_rounded,
                color: AppTheme.statusAmber,
                bgColor: AppTheme.statusAmberBg,
                onTap: () => widget.onNavigateTab(1), // Tab 1 = Stock
              ),
              _buildMetricCard(
                title: 'Floor Orders',
                value: '$activeWorkOrders',
                subtitle: 'Active in Production',
                icon: Icons.precision_manufacturing_rounded,
                color: const Color(0xFF7C3AED),
                bgColor: const Color(0xFFF3E8FF),
                onTap: () => widget.onNavigateTab(3), // Tab 3 = Work Orders
              ),
              _buildMetricCard(
                title: 'Purchase Orders',
                value: '$pendingPOs',
                subtitle: 'Pending Approvals',
                icon: Icons.shopping_cart_outlined,
                color: AppTheme.statusGreen,
                bgColor: AppTheme.statusGreenBg,
                onTap: () => widget.onNavigateTab(4), // Tab 4 = POs
              ),
            ],
          ),
          const SizedBox(height: 20),

          // 4. Quick Action Buttons
          Text('Quick Department Actions', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          _buildActionTile(
            icon: Icons.inventory_2_outlined,
            title: 'Live Materials & Stock Inventory',
            subtitle: 'Inspect warehouse balances, HSN codes, and levels',
            color: AppTheme.primaryTeal,
            onTap: () => widget.onNavigateTab(1),
          ),
          const SizedBox(height: 8),
          _buildActionTile(
            icon: Icons.account_tree_outlined,
            title: 'Bill of Materials (BOM)',
            subtitle: 'Track production orders, components, and customer approvals',
            color: AppTheme.statusBlue,
            onTap: () => widget.onNavigateTab(2),
          ),
          const SizedBox(height: 8),
          _buildActionTile(
            icon: Icons.factory_outlined,
            title: 'Factory Floor Execution',
            subtitle: 'Advance work orders across cutting, fabrication, and QC',
            color: const Color(0xFF7C3AED),
            onTap: () => widget.onNavigateTab(3),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.borderSubtle),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: bgColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, size: 18, color: color),
                ),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.darkSlate,
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 10.5,
                    color: AppTheme.textMuted,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.borderSubtle),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.darkSlate,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppTheme.textMuted),
          ],
        ),
      ),
    );
  }
}
