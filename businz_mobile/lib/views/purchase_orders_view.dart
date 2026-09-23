import 'dart:async';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class PurchaseOrdersView extends StatefulWidget {
  final String userRole;

  const PurchaseOrdersView({super.key, required this.userRole});

  @override
  State<PurchaseOrdersView> createState() => _PurchaseOrdersViewState();
}

class _PurchaseOrdersViewState extends State<PurchaseOrdersView> {
  List<dynamic> allPos = [];
  List<dynamic> filteredPos = [];
  bool isLoading = true;
  String searchQuery = '';
  String selectedFilter = 'All';
  Timer? _pollTimer;

  bool get isExecutiveRole {
    final r = widget.userRole.toLowerCase();
    return r.contains('ceo') || r.contains('md') || r.contains('executive');
  }

  @override
  void initState() {
    super.initState();
    _loadPos();
    // Silent auto-refresh every 6 seconds for instant 2-way sync
    _pollTimer = Timer.periodic(const Duration(seconds: 6), (_) => _silentRefresh());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  bool _isPoApproved(Map<String, dynamic> p) {
    final status = (p['status'] ?? '').toString().toLowerCase();
    final statusType = (p['statusType'] ?? '').toString().toLowerCase();
    final approvedBy = (p['approvedBy'] ?? '').toString().trim();
    final hasApprover = approvedBy.isNotEmpty && approvedBy != 'null' && approvedBy != '—';
    return hasApprover ||
        status.contains('approved') ||
        statusType.contains('approved') ||
        status.contains('issued') ||
        status.contains('proceed') ||
        status.contains('payment') ||
        status.contains('closed') ||
        status.contains('received');
  }

  String _getPoStatusBadgeText(Map<String, dynamic> p) {
    final status = (p['status'] ?? '').toString();
    final statusLower = status.toLowerCase();
    if (_isPoApproved(p)) {
      if (statusLower.contains('closed') || statusLower.contains('received')) return '✓ Closed / Received';
      if (statusLower.contains('proceed')) return '✓ Proceed PO';
      if (statusLower.contains('payment')) return '✓ Payment Done';
      return '✓ MD Approved';
    }
    return '⏳ Pending Approval';
  }

  Future<void> _silentRefresh() async {
    try {
      final pos = await ApiService.fetchPurchaseOrders();
      if (mounted && pos.isNotEmpty) {
        final currentHash = allPos.map((p) => '${p['poNo'] ?? p['purchaseorder_number']}_${p['status']}_${p['approvedBy']}').join('|');
        final newHash = pos.map((p) => '${p['poNo'] ?? p['purchaseorder_number']}_${p['status']}_${p['approvedBy']}').join('|');
        if (currentHash != newHash || pos.length != allPos.length) {
          setState(() {
            allPos = pos;
            _applyFilters();
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _loadPos() async {
    setState(() => isLoading = true);
    final pos = await ApiService.fetchPurchaseOrders();
    if (mounted) {
      setState(() {
        allPos = pos;
        _applyFilters();
        isLoading = false;
      });
    }
  }

  void _applyFilters() {
    filteredPos = allPos.where((p) {
      final no = (p['purchaseorder_number'] ?? p['poNo'] ?? p['id'] ?? '').toString().toLowerCase();
      final vendor = (p['vendor_name'] ?? p['vendor'] ?? '').toString().toLowerCase();
      final isApproved = _isPoApproved(p);

      if (selectedFilter == 'Approved' && !isApproved) return false;
      if (selectedFilter == 'Pending' && isApproved) return false;

      if (searchQuery.isNotEmpty) {
        final q = searchQuery.toLowerCase();
        if (!no.contains(q) && !vendor.contains(q)) return false;
      }

      return true;
    }).toList();
  }

  void _showApproveDialog(Map<String, dynamic> po) {
    final poId = (po['purchaseorder_number'] ?? po['poNo'] ?? po['id'] ?? '').toString();
    final vendor = (po['vendor_name'] ?? po['vendor'] ?? 'Official Supplier').toString();
    final total = (po['total'] ?? po['amount'] ?? '₹ 0.00').toString();
    final remarksCtrl = TextEditingController(text: 'Approved by ${widget.userRole} via BUSINZ Mobile');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        bool isSubmitting = false;

        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              padding: EdgeInsets.only(
                top: 20,
                left: 20,
                right: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppTheme.statusGreenBg,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.check_circle_outline, color: AppTheme.statusGreen, size: 24),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Executive PO Authorization',
                                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppTheme.darkSlate),
                              ),
                              Text(
                                'Authorizing Purchase Order $poId',
                                style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppTheme.backgroundLight,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.borderSubtle),
                      ),
                      child: Column(
                        children: [
                          _buildDetailRow('PO Number', poId, isBold: true, highlightColor: AppTheme.statusGreen),
                          const Divider(height: 14),
                          _buildDetailRow('Vendor / Supplier', vendor),
                          const SizedBox(height: 6),
                          _buildDetailRow('Total Order Value', total.startsWith('₹') ? total : '₹ $total', isBold: true),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: remarksCtrl,
                      decoration: InputDecoration(
                        labelText: 'Executive Remarks',
                        labelStyle: const TextStyle(fontSize: 12),
                        filled: true,
                        fillColor: AppTheme.backgroundLight,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.statusGreen,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          elevation: 0,
                        ),
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                setModalState(() => isSubmitting = true);
                                final ok = await ApiService.approvePurchaseOrder(
                                  poId,
                                  remarks: remarksCtrl.text.trim(),
                                  approver: widget.userRole,
                                );
                                if (!mounted) return;
                                Navigator.of(ctx).pop();
                                if (ok) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('✓ Purchase Order $poId approved! Procurement & Accounts notified.'),
                                      backgroundColor: AppTheme.statusGreen,
                                    ),
                                  );
                                  _loadPos();
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Failed to approve PO. Please check server connection.'),
                                      backgroundColor: AppTheme.statusRed,
                                    ),
                                  );
                                }
                              },
                        child: isSubmitting
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text(
                                'Confirm & Authorize PO',
                                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  void _showPoDetailsSheet(Map<String, dynamic> p) {
    final no = (p['purchaseorder_number'] ?? p['poNo'] ?? p['id'] ?? 'PO').toString();
    final vendor = (p['vendor_name'] ?? p['vendor'] ?? 'Official Supplier').toString();
    final status = (p['status'] ?? 'Draft').toString();
    final total = (p['total'] ?? p['amount'] ?? '₹ 0.00').toString();
    final isApproved = _isPoApproved(p);
    final approver = (p['approvedBy'] ?? p['approver'] ?? 'CEO / MD').toString();
    final approvalDate = p['approvalDate'] ?? '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        height: MediaQuery.of(context).size.height * 0.75,
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(no, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.darkSlate)),
                    Text(vendor, style: const TextStyle(fontSize: 13, color: AppTheme.textMuted)),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: isApproved ? AppTheme.statusGreenBg : AppTheme.statusAmberBg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _getPoStatusBadgeText(p),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: isApproved ? AppTheme.statusGreen : AppTheme.statusAmber,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.backgroundLight,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.borderSubtle),
              ),
              child: Column(
                children: [
                  _buildDetailRow('Total Order Value', total.startsWith('₹') ? total : '₹ $total', isBold: true),
                  const Divider(height: 14),
                  _buildDetailRow('Status', status),
                  if (isApproved) ...[
                    const SizedBox(height: 6),
                    _buildDetailRow('Approved By', approver.toString()),
                    if (approvalDate.toString().isNotEmpty) ...[
                      const SizedBox(height: 6),
                      _buildDetailRow('Approval Date', approvalDate.toString()),
                    ],
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Text('Line Items', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppTheme.darkSlate)),
            const SizedBox(height: 8),
            Expanded(
              child: (p['items'] is List && (p['items'] as List).isNotEmpty)
                  ? ListView.separated(
                      itemCount: (p['items'] as List).length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) {
                        final it = p['items'][i];
                        return Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppTheme.borderSubtle),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Text(
                                  it['name'] ?? it['item'] ?? 'Raw Material Item',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                                ),
                              ),
                              Text(
                                '${it['qty'] ?? it['quantity'] ?? 1} Nos',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppTheme.darkSlate),
                              ),
                            ],
                          ),
                        );
                      },
                    )
                  : const Center(
                      child: Text('Official items managed in Zoho Books.', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                    ),
            ),
            if (isExecutiveRole && !isApproved) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.statusGreen,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    _showApproveDialog(p);
                  },
                  icon: const Icon(Icons.check_circle_outline, size: 20),
                  label: const Text('Approve Purchase Order', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {bool isBold = false, Color? highlightColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
        Text(
          value,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
            color: highlightColor ?? AppTheme.darkSlate,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // 1. Search Bar & Status Filters
        Container(
          padding: const EdgeInsets.all(16),
          color: Colors.white,
          child: Column(
            children: [
              TextField(
                onChanged: (val) {
                  setState(() {
                    searchQuery = val;
                    _applyFilters();
                  });
                },
                decoration: InputDecoration(
                  hintText: 'Search PO number, vendor...',
                  hintStyle: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
                  prefixIcon: const Icon(Icons.search, size: 20, color: AppTheme.statusGreen),
                  filled: true,
                  fillColor: AppTheme.backgroundLight,
                  contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppTheme.statusGreen, width: 1.5)),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: ['All', 'Approved', 'Pending'].map((f) {
                  final isSelected = selectedFilter == f;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(f),
                      selected: isSelected,
                      selectedColor: AppTheme.statusGreenBg,
                      backgroundColor: AppTheme.backgroundLight,
                      labelStyle: TextStyle(
                        fontSize: 11.5,
                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                        color: isSelected ? AppTheme.statusGreen : AppTheme.textDark,
                      ),
                      side: BorderSide(color: isSelected ? AppTheme.statusGreen : AppTheme.borderSubtle),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      onSelected: (_) {
                        setState(() {
                          selectedFilter = f;
                          _applyFilters();
                        });
                      },
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        ),

        // 2. POs List
        Expanded(
          child: isLoading
              ? const Center(child: CircularProgressIndicator(color: AppTheme.statusGreen))
              : filteredPos.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.shopping_cart_outlined, size: 48, color: AppTheme.textMuted.withOpacity(0.5)),
                          const SizedBox(height: 8),
                          const Text('No purchase orders found', style: TextStyle(color: AppTheme.textMuted)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      color: AppTheme.statusGreen,
                      onRefresh: _loadPos,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: filteredPos.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, idx) {
                          final p = filteredPos[idx];
                          final no = (p['purchaseorder_number'] ?? p['poNo'] ?? p['id'] ?? 'PO-${idx + 1}').toString();
                          final vendor = (p['vendor_name'] ?? p['vendor'] ?? 'Official Supplier').toString();
                          final total = (p['total'] ?? p['amount'] ?? '₹ 0.00').toString();
                          final isApproved = _isPoApproved(p);

                          return InkWell(
                            onTap: () => _showPoDetailsSheet(p),
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isApproved ? AppTheme.statusGreen.withOpacity(0.3) : AppTheme.borderSubtle,
                                  width: isApproved ? 1.2 : 1.0,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.all(6),
                                            decoration: BoxDecoration(
                                              color: isApproved ? AppTheme.statusGreenBg : AppTheme.statusAmberBg,
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Icon(
                                              isApproved ? Icons.verified_outlined : Icons.receipt_outlined,
                                              size: 16,
                                              color: isApproved ? AppTheme.statusGreen : AppTheme.statusAmber,
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            no,
                                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14.5, color: AppTheme.darkSlate),
                                          ),
                                        ],
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: isApproved ? AppTheme.statusGreenBg : AppTheme.statusAmberBg,
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          _getPoStatusBadgeText(p),
                                          style: TextStyle(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.w800,
                                            color: isApproved ? AppTheme.statusGreen : AppTheme.statusAmber,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    vendor,
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.darkSlate),
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      const Text('Total Value', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                                      Text(
                                        total.startsWith('₹') ? total : '₹ $total',
                                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: AppTheme.darkSlate),
                                      ),
                                    ],
                                  ),
                                  if (isExecutiveRole && !isApproved) ...[
                                    const SizedBox(height: 12),
                                    SizedBox(
                                      width: double.infinity,
                                      height: 38,
                                      child: ElevatedButton.icon(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: AppTheme.statusGreen,
                                          foregroundColor: Colors.white,
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                          elevation: 0,
                                        ),
                                        onPressed: () => _showApproveDialog(p),
                                        icon: const Icon(Icons.check, size: 16),
                                        label: const Text('Approve PO', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}
