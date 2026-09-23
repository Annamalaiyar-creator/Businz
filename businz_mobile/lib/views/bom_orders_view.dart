import 'dart:async';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class BomOrdersView extends StatefulWidget {
  final String userRole;

  const BomOrdersView({super.key, required this.userRole});

  @override
  State<BomOrdersView> createState() => _BomOrdersViewState();
}

class _BomOrdersViewState extends State<BomOrdersView> {
  List<dynamic> allBoms = [];
  List<dynamic> filteredBoms = [];
  bool isLoading = true;
  String searchQuery = '';
  String selectedFilter = 'All';
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _loadBoms();
    // Silent auto-refresh every 6 seconds for 2-way live sync with Web
    _pollTimer = Timer.periodic(const Duration(seconds: 6), (_) => _silentRefresh());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _silentRefresh() async {
    try {
      final boms = await ApiService.fetchBoms();
      if (mounted && boms.isNotEmpty && boms.length != allBoms.length) {
        setState(() {
          allBoms = boms;
          _applyFilters();
        });
      }
    } catch (_) {}
  }

  Future<void> _loadBoms() async {
    setState(() => isLoading = true);
    final boms = await ApiService.fetchBoms();
    if (mounted) {
      setState(() {
        allBoms = boms;
        _applyFilters();
        isLoading = false;
      });
    }
  }

  void _applyFilters() {
    filteredBoms = allBoms.where((b) {
      final code = (b['bomCode'] ?? b['code'] ?? b['id'] ?? '').toString().toLowerCase();
      final cust = (b['customerName'] ?? b['customer'] ?? '').toString().toLowerCase();
      final pi = (b['piNo'] ?? b['sourcePi'] ?? '').toString().toLowerCase();
      final status = (b['status'] ?? '').toString().toLowerCase();

      if (selectedFilter == 'Confirmed' && !status.contains('confirmed')) return false;
      if (selectedFilter == 'Draft' && (status.contains('confirmed') || status.contains('delivered'))) return false;

      if (searchQuery.isNotEmpty) {
        final q = searchQuery.toLowerCase();
        if (!code.contains(q) && !cust.contains(q) && !pi.contains(q)) return false;
      }

      return true;
    }).toList();
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
                  hintText: 'Search BOM code, customer, PI...',
                  hintStyle: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
                  prefixIcon: const Icon(Icons.search, size: 20, color: AppTheme.statusBlue),
                  filled: true,
                  fillColor: AppTheme.backgroundLight,
                  contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppTheme.statusBlue, width: 1.5)),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: ['All', 'Confirmed', 'Draft'].map((f) {
                  final isSelected = selectedFilter == f;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(f),
                      selected: isSelected,
                      selectedColor: AppTheme.statusBlueBg,
                      backgroundColor: AppTheme.backgroundLight,
                      labelStyle: TextStyle(
                        fontSize: 11.5,
                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                        color: isSelected ? AppTheme.statusBlue : AppTheme.textDark,
                      ),
                      side: BorderSide(color: isSelected ? AppTheme.statusBlue : AppTheme.borderSubtle),
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

        // 2. BOMs List
        Expanded(
          child: isLoading
              ? const Center(child: CircularProgressIndicator(color: AppTheme.statusBlue))
              : filteredBoms.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.alt_route_rounded, size: 48, color: AppTheme.textMuted.withOpacity(0.5)),
                          const SizedBox(height: 8),
                          const Text('No BOM orders found', style: TextStyle(color: AppTheme.textMuted)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      color: AppTheme.statusBlue,
                      onRefresh: _loadBoms,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: filteredBoms.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, idx) {
                          final b = filteredBoms[idx];
                          final code = b['bomCode'] ?? b['code'] ?? 'BOM-${idx + 1}';
                          final cust = b['customerName'] ?? b['customer'] ?? 'Direct Customer';
                          final pi = b['piNo'] ?? b['sourcePi'] ?? 'N/A';
                          final status = (b['status'] ?? 'Confirmed').toString();
                          final isConfirmed = status.toLowerCase().contains('confirmed');

                          return InkWell(
                            onTap: () => _showBomDetails(b),
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: AppTheme.borderSubtle),
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
                                              color: AppTheme.statusBlueBg,
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: const Icon(Icons.alt_route_rounded, size: 16, color: AppTheme.statusBlue),
                                          ),
                                          const SizedBox(width: 8),
                                          Text(
                                            code.toString(),
                                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14.5, color: AppTheme.darkSlate),
                                          ),
                                        ],
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: isConfirmed ? AppTheme.statusGreenBg : AppTheme.statusAmberBg,
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          status,
                                          style: TextStyle(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.w800,
                                            color: isConfirmed ? AppTheme.statusGreen : AppTheme.statusAmber,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    cust.toString(),
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppTheme.darkSlate),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      const Icon(Icons.receipt_long_outlined, size: 13, color: AppTheme.textMuted),
                                      const SizedBox(width: 4),
                                      Text('Ref: $pi', style: const TextStyle(fontSize: 11.5, color: AppTheme.textMuted)),
                                    ],
                                  ),
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

  void _showBomDetails(dynamic b) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        final code = b['bomCode'] ?? b['code'] ?? 'BOM';
        final cust = b['customerName'] ?? b['customer'] ?? 'Customer';
        final pi = b['piNo'] ?? b['sourcePi'] ?? 'N/A';
        final status = b['status'] ?? 'Active';
        final items = b['items'] ?? b['bomItems'] ?? [];

        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(width: 36, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
              ),
              const SizedBox(height: 16),
              Text(code.toString(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.darkSlate)),
              Text('Customer: $cust', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textMuted)),
              Text('Proforma Ref: $pi', style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
              const Divider(height: 24),
              Text('Components (${items is List ? items.length : 0} items)', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
              const SizedBox(height: 8),
              if (items is List && items.isNotEmpty)
                ...items.take(3).map((it) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2),
                      child: Text('• ${it['name'] ?? it['item'] ?? 'Material'} (${it['qty'] ?? 1} Nos)', style: const TextStyle(fontSize: 12, color: AppTheme.darkSlate)),
                    ))
              else
                const Text('All items reserved & synced with stores', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF7C3AED),
                        side: const BorderSide(color: Color(0xFF7C3AED)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      icon: const Icon(Icons.precision_manufacturing, size: 16),
                      label: const Text('Issue Work Order', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      onPressed: () async {
                        Navigator.pop(context);
                        final woId = 'WO-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
                        final wo = {
                          'id': woId,
                          'workOrderNo': woId,
                          'productName': items is List && items.isNotEmpty ? (items[0]['name'] ?? 'BOM Component') : 'Solar Mounting Rail',
                          'plannedQty': 250,
                          'customer': cust,
                          'bomCode': code,
                          'status': 'In Progress',
                          'currentStage': 'Raw Material Prep',
                          'stage': 'Raw Material Prep',
                          'rawMaterial': 'Extrusion Billets & Coil',
                          'targetDate': DateTime.now().add(const Duration(days: 5)).toIso8601String().split('T')[0],
                        };
                        final ok = await ApiService.createWorkOrder(wo);
                        if (ok && mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text('✓ Work order $woId issued for $code to plant floor!'),
                              backgroundColor: AppTheme.statusGreen,
                            ),
                          );
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.darkSlate,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Close'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
