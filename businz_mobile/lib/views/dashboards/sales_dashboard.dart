import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

class SalesDashboardView extends StatefulWidget {
  final String userRole;
  final Function(String targetTab) onNavigateSection;

  const SalesDashboardView({
    super.key,
    required this.userRole,
    required this.onNavigateSection,
  });

  @override
  State<SalesDashboardView> createState() => _SalesDashboardViewState();
}

class _SalesDashboardViewState extends State<SalesDashboardView> {
  int activeBoms = 0;
  int confirmedBoms = 0;
  int activePis = 0;
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSalesData();
  }

  Future<void> _loadSalesData() async {
    setState(() => isLoading = true);
    try {
      final boms = await ApiService.fetchBoms();
      final pis = await ApiService.fetchProformaInvoices();

      int confirmed = 0;
      for (final b in boms) {
        final st = (b['status'] ?? '').toString().toLowerCase();
        if (st.contains('confirm') || st.contains('dispatch')) confirmed++;
      }
      if (mounted) {
        setState(() {
          activeBoms = boms.length;
          confirmedBoms = confirmed;
          activePis = pis.length;
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
      color: AppTheme.statusGreen,
      onRefresh: _loadSalesData,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Department Banner
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF064E3B), Color(0xFF047857)],
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
                        'SALES & COMMERCIAL',
                        style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800),
                      ),
                    ),
                    const Icon(Icons.trending_up, color: Colors.white, size: 20),
                  ],
                ),
                const SizedBox(height: 10),
                const Text(
                  'Sales Executive Workspace',
                  style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800),
                ),
                Text(
                  'Active Operator: ${widget.userRole}',
                  style: const TextStyle(color: Color(0xFFA7F3D0), fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          Text('Commercial & Order Pipeline', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),

          // 2x2 Grid of Sales Metrics
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.25,
            children: [
              _buildSalesCard('Proforma Invoices', '$activePis', 'Issued Quotes', Icons.receipt_long_outlined, AppTheme.primaryTeal, AppTheme.primaryLightTeal, () => widget.onNavigateSection('Proforma Invoices')),
              _buildSalesCard('Confirmed BOMs', '$confirmedBoms', 'Ready for Production', Icons.check_circle_outline, AppTheme.statusGreen, AppTheme.statusGreenBg, () => widget.onNavigateSection('BOM Orders')),
              _buildSalesCard('BOM Orders', '$activeBoms', 'Pipeline Records', Icons.alt_route, AppTheme.statusBlue, AppTheme.statusBlueBg, () => widget.onNavigateSection('BOM Orders')),
              _buildSalesCard('Stock Directory', '312 Items', 'Check Feasibility', Icons.inventory_2_outlined, const Color(0xFF0F766E), const Color(0xFFCCFBF1), () => widget.onNavigateSection('Inventory Stores')),
            ],
          ),

          const SizedBox(height: 20),
          Text('Commercial Actions', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          _buildActionItem('Proforma Invoices & BOM Conversion', 'Create customer quotes, issue PIs, and convert to BOM in 1 tap', Icons.receipt_long, () => widget.onNavigateSection('Proforma Invoices')),
          const SizedBox(height: 8),
          _buildActionItem('BOM Orders & Client Verification', 'Review client specs, payment terms, and delivery timeline', Icons.alt_route, () => widget.onNavigateSection('BOM Orders')),
          const SizedBox(height: 8),
          _buildActionItem('Check Raw Material Inventory', 'Verify available physical lengths, profiles, and hardware before quoting', Icons.warehouse, () => widget.onNavigateSection('Inventory Stores')),
        ],
      ),
    );
  }

  Widget _buildSalesCard(String title, String val, String sub, IconData icon, Color color, Color bg, VoidCallback onTap) {
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
            Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: AppTheme.primaryLightTeal, borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: AppTheme.primaryTeal, size: 20)),
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
