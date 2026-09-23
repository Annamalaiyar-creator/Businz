import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

class ProcurementDashboardView extends StatefulWidget {
  final String userRole;
  final Function(String targetTab) onNavigateSection;

  const ProcurementDashboardView({
    super.key,
    required this.userRole,
    required this.onNavigateSection,
  });

  @override
  State<ProcurementDashboardView> createState() => _ProcurementDashboardViewState();
}

class _ProcurementDashboardViewState extends State<ProcurementDashboardView> {
  int pendingPOs = 0;
  int totalPOs = 0;
  int criticalStock = 0;
  int totalMaterials = 0;
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProcurementData();
  }

  Future<void> _loadProcurementData() async {
    setState(() => isLoading = true);
    try {
      final results = await Future.wait([
        ApiService.fetchPurchaseOrders(),
        ApiService.fetchRawMaterials(),
      ]);

      final pos = results[0];
      final mats = results[1];

      int pend = 0;
      for (final p in pos) {
        final st = (p['status'] ?? '').toString().toLowerCase();
        if (st.contains('open') || st.contains('draft') || st.contains('pending')) {
          pend++;
        }
      }

      int crit = 0;
      for (final m in mats) {
        final stock = num.tryParse('${m['stock'] ?? m['physicalStock'] ?? 0}') ?? 0;
        final minLvl = num.tryParse('${m['minLevel'] ?? 50}') ?? 50;
        if (stock <= minLvl) crit++;
      }

      if (mounted) {
        setState(() {
          totalPOs = pos.length;
          pendingPOs = pend;
          criticalStock = crit;
          totalMaterials = mats.length;
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
      color: const Color(0xFF2563EB),
      onRefresh: _loadProcurementData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Department Banner
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1E3A8A), Color(0xFF1D4ED8)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'PROCUREMENT & SOURCING',
                        style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800),
                      ),
                    ),
                    const Icon(Icons.shopping_cart_outlined, color: Colors.white, size: 20),
                  ],
                ),
                const SizedBox(height: 10),
                const Text(
                  'Procurement Control Hub',
                  style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800),
                ),
                Text(
                  'Active Officer: ${widget.userRole}',
                  style: const TextStyle(color: Color(0xFFBFDBFE), fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          Text('Purchasing & Stores Status', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),

          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.25,
            children: [
              _buildProcCard('Pending POs', '$pendingPOs', 'Awaiting Approvals', Icons.shopping_bag_outlined, const Color(0xFF2563EB), const Color(0xFFDBEAFE), () => widget.onNavigateSection('Purchase Orders')),
              _buildProcCard('Critical Stock', '$criticalStock', 'Requires Reorder', Icons.warning_amber_rounded, AppTheme.statusAmber, AppTheme.statusAmberBg, () => widget.onNavigateSection('Inventory Stores')),
              _buildProcCard('Total POs', '$totalPOs', 'Issued to Vendors', Icons.receipt_long_outlined, AppTheme.statusGreen, AppTheme.statusGreenBg, () => widget.onNavigateSection('Purchase Orders')),
              _buildProcCard('Catalog Stores', '$totalMaterials', 'Active SKU Items', Icons.warehouse_outlined, AppTheme.primaryTeal, AppTheme.primaryLightTeal, () => widget.onNavigateSection('Inventory Stores')),
            ],
          ),

          const SizedBox(height: 20),
          Text('Procurement Actions', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          _buildActionItem('Purchase Orders & Zoho Approvals', 'Inspect PO-000XX numbers, vendor details, and order values', Icons.receipt_outlined, () => widget.onNavigateSection('Purchase Orders')),
          const SizedBox(height: 8),
          _buildActionItem('Raw Material Store Inwarding', 'Check live balances, physical stock levels, and safety thresholds', Icons.warehouse_outlined, () => widget.onNavigateSection('Inventory Stores')),
        ],
      ),
    );
  }

  Widget _buildProcCard(String title, String val, String sub, IconData icon, Color color, Color bg, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: AppTheme.borderSubtle)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)), child: Icon(icon, color: color, size: 18)),
                Text(val, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: color)),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppTheme.darkSlate)),
                Text(sub, style: const TextStyle(fontSize: 10.5, color: AppTheme.textMuted), maxLines: 1),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionItem(String title, String desc, IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppTheme.borderSubtle)),
        child: Row(
          children: [
            Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: const Color(0xFFDBEAFE), borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: const Color(0xFF2563EB), size: 20)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppTheme.darkSlate)),
                  Text(desc, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
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
