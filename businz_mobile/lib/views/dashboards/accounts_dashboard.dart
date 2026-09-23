import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../services/api_service.dart';

class AccountsDashboardView extends StatefulWidget {
  final String userRole;
  final Function(String targetTab) onNavigateSection;

  const AccountsDashboardView({
    super.key,
    required this.userRole,
    required this.onNavigateSection,
  });

  @override
  State<AccountsDashboardView> createState() => _AccountsDashboardViewState();
}

class _AccountsDashboardViewState extends State<AccountsDashboardView> {
  int approvedPOs = 0;
  int pendingVerification = 0;
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadAccountsData();
  }

  Future<void> _loadAccountsData() async {
    setState(() => isLoading = true);
    try {
      final pos = await ApiService.fetchPurchaseOrders();
      int approved = 0;
      int pending = 0;

      for (final p in pos) {
        final st = (p['status'] ?? '').toString().toLowerCase();
        if (st.contains('approved') || st.contains('closed') || st.contains('received')) {
          approved++;
        } else {
          pending++;
        }
      }

      if (mounted) {
        setState(() {
          approvedPOs = approved;
          pendingVerification = pending;
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
      color: const Color(0xFF059669),
      onRefresh: _loadAccountsData,
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
                        'FINANCE & COMMERCIAL AUDIT',
                        style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800),
                      ),
                    ),
                    const Icon(Icons.account_balance_wallet_outlined, color: Colors.white, size: 20),
                  ],
                ),
                const SizedBox(height: 10),
                const Text(
                  'Accounts Control Panel',
                  style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800),
                ),
                Text(
                  'Active Officer: ${widget.userRole}',
                  style: const TextStyle(color: Color(0xFFA7F3D0), fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          Text('Financial Audit & Commitments', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),

          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.25,
            children: [
              _buildFinanceCard('Approved POs', '$approvedPOs', 'Cleared for Payment', Icons.check_circle_outlined, const Color(0xFF059669), const Color(0xFFD1FAE5), () => widget.onNavigateSection('Purchase Orders')),
              _buildFinanceCard('Awaiting Audit', '$pendingVerification', 'Pending Verification', Icons.hourglass_top_outlined, AppTheme.statusAmber, AppTheme.statusAmberBg, () => widget.onNavigateSection('Purchase Orders')),
              _buildFinanceCard('Payment Status', 'Active', 'All Vendors Current', Icons.payments_outlined, AppTheme.primaryTeal, AppTheme.primaryLightTeal, () => widget.onNavigateSection('Purchase Orders')),
              _buildFinanceCard('Zoho Books Sync', 'Online', 'Realtime Ledger', Icons.sync_outlined, const Color(0xFF2563EB), const Color(0xFFDBEAFE), () {}),
            ],
          ),

          const SizedBox(height: 20),
          Text('Financial Actions', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          _buildActionItem('Purchase Orders Verification', 'Review vendor bills, GST allocations, and approval authorizations', Icons.receipt_long, () => widget.onNavigateSection('Purchase Orders')),
          const SizedBox(height: 8),
          _buildActionItem('BOM Customer Payment Terms', 'Inspect customer advances, PI references, and credit approvals', Icons.alt_route, () => widget.onNavigateSection('BOM Orders')),
        ],
      ),
    );
  }

  Widget _buildFinanceCard(String title, String val, String sub, IconData icon, Color color, Color bg, VoidCallback onTap) {
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
            Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: const Color(0xFFD1FAE5), borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: const Color(0xFF059669), size: 20)),
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
