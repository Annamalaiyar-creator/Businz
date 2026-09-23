import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

class ProductionDashboardView extends StatefulWidget {
  final String userRole;
  final Function(String targetTab) onNavigateSection;

  const ProductionDashboardView({
    super.key,
    required this.userRole,
    required this.onNavigateSection,
  });

  @override
  State<ProductionDashboardView> createState() => _ProductionDashboardViewState();
}

class _ProductionDashboardViewState extends State<ProductionDashboardView> {
  int activeWorkOrders = 0;
  int cuttingStage = 0;
  int fabricationStage = 0;
  int completedOrders = 0;
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProductionData();
  }

  Future<void> _loadProductionData() async {
    setState(() => isLoading = true);
    try {
      final wos = await ApiService.fetchWorkOrders();
      int active = 0;
      int cutting = 0;
      int fab = 0;
      int done = 0;

      for (final w in wos) {
        final stage = (w['currentStage'] ?? w['stage'] ?? '').toString().toLowerCase();
        final status = (w['status'] ?? '').toString().toLowerCase();

        if (status.contains('completed')) {
          done++;
        } else {
          active++;
          if (stage.contains('prep') || stage.contains('cutting') || stage.contains('extrusion')) {
            cutting++;
          } else if (stage.contains('fabrication') || stage.contains('punching') || stage.contains('quality')) {
            fab++;
          }
        }
      }

      if (mounted) {
        setState(() {
          activeWorkOrders = active;
          cuttingStage = cutting;
          fabricationStage = fab;
          completedOrders = done;
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
      color: const Color(0xFF7C3AED),
      onRefresh: _loadProductionData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Department Banner
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF4C1D95), Color(0xFF6D28D9)],
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
                        'PRODUCTION & PLANT OPERATIONS',
                        style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800),
                      ),
                    ),
                    const Icon(Icons.precision_manufacturing_outlined, color: Colors.white, size: 20),
                  ],
                ),
                const SizedBox(height: 10),
                const Text(
                  'Factory Floor Control',
                  style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800),
                ),
                Text(
                  'Active Station: ${widget.userRole}',
                  style: const TextStyle(color: Color(0xFFDDD6FE), fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          Text('Plant Work Orders Status', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),

          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.25,
            children: [
              _buildProdCard('Active Jobs', '$activeWorkOrders', 'In Plant Line', Icons.pending_actions_outlined, const Color(0xFF7C3AED), const Color(0xFFF3E8FF), () => widget.onNavigateSection('Work Orders')),
              _buildProdCard('Cutting & Extrusion', '$cuttingStage', 'Station 1 & 2', Icons.content_cut_outlined, const Color(0xFF0284C7), const Color(0xFFE0F2FE), () => widget.onNavigateSection('Work Orders')),
              _buildProdCard('Fabrication & QC', '$fabricationStage', 'Station 3 & 4', Icons.build_outlined, const Color(0xFFD97706), const Color(0xFFFEF3C7), () => widget.onNavigateSection('Work Orders')),
              _buildProdCard('Completed FG', '$completedOrders', 'Ready to Pack', Icons.check_circle_outlined, AppTheme.statusGreen, AppTheme.statusGreenBg, () => widget.onNavigateSection('Work Orders')),
            ],
          ),

          const SizedBox(height: 20),
          Text('Floor Actions', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          _buildActionItem('Active Work Orders Tracker', 'Inspect job cards, target pieces, and advance manufacturing stages', Icons.precision_manufacturing, () => widget.onNavigateSection('Work Orders')),
          const SizedBox(height: 8),
          _buildActionItem('Raw Material Consumption', 'Check bay inventory and allocated aluminum lengths', Icons.warehouse, () => widget.onNavigateSection('Inventory Stores')),
        ],
      ),
    );
  }

  Widget _buildProdCard(String title, String val, String sub, IconData icon, Color color, Color bg, VoidCallback onTap) {
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
            Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: const Color(0xFFF3E8FF), borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: const Color(0xFF7C3AED), size: 20)),
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
