import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class WorkOrdersView extends StatefulWidget {
  final String userRole;

  const WorkOrdersView({super.key, required this.userRole});

  @override
  State<WorkOrdersView> createState() => _WorkOrdersViewState();
}

class _WorkOrdersViewState extends State<WorkOrdersView> {
  List<dynamic> allWos = [];
  List<dynamic> filteredWos = [];
  bool isLoading = true;
  String searchQuery = '';
  String selectedFilter = 'All';

  final List<String> stages = [
    'Raw Material Prep',
    'Extrusion / Cutting',
    'Fabrication & Punching',
    'Quality Inspection',
    'Completed & Ready'
  ];

  @override
  void initState() {
    super.initState();
    _loadWorkOrders();
  }

  Future<void> _loadWorkOrders() async {
    setState(() => isLoading = true);
    final wos = await ApiService.fetchWorkOrders();
    if (mounted) {
      setState(() {
        allWos = wos;
        _applyFilters();
        isLoading = false;
      });
    }
  }

  void _applyFilters() {
    filteredWos = allWos.where((w) {
      final id = (w['id'] ?? w['workOrderNo'] ?? w['woId'] ?? '').toString().toLowerCase();
      final prod = (w['product'] ?? w['productName'] ?? '').toString().toLowerCase();
      final status = (w['status'] ?? '').toString().toLowerCase();

      if (selectedFilter == 'In Progress' && status.contains('completed')) return false;
      if (selectedFilter == 'Completed' && !status.contains('completed')) return false;

      if (searchQuery.isNotEmpty) {
        final q = searchQuery.toLowerCase();
        if (!id.contains(q) && !prod.contains(q)) return false;
      }

      return true;
    }).toList();
  }

  Future<void> _advanceStage(Map<String, dynamic> wo) async {
    final success = await ApiService.advanceWorkOrder(wo);
    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✓ Work Order stage advanced and saved!'),
          backgroundColor: AppTheme.statusGreen,
          duration: Duration(seconds: 2),
        ),
      );
      _loadWorkOrders();
    }
  }

  void _showCreateWorkOrderSheet() {
    final prodCtrl = TextEditingController(text: 'Solar Mounting Rail 2414mm');
    final custCtrl = TextEditingController(text: 'Tata Power Solar Systems Ltd');
    final qtyCtrl = TextEditingController(text: '500');
    final rawCtrl = TextEditingController(text: 'Raw Alu Coil');
    final bomCtrl = TextEditingController(text: 'BOM-735');
    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.85,
              padding: EdgeInsets.only(
                top: 20,
                left: 20,
                right: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: SingleChildScrollView(
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
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF7C3AED).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.precision_manufacturing, color: Color(0xFF7C3AED), size: 22),
                        ),
                        const SizedBox(width: 12),
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Issue Work Order',
                              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppTheme.darkSlate),
                            ),
                            Text(
                              'Dispatch job card to factory floor line',
                              style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    _buildFormField(prodCtrl, 'Product Name / Description', Icons.inventory_2),
                    const SizedBox(height: 10),
                    _buildFormField(custCtrl, 'Customer / Project', Icons.business),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(child: _buildFormField(qtyCtrl, 'Planned Qty (pcs)', Icons.numbers, isNumber: true)),
                        const SizedBox(width: 10),
                        Expanded(child: _buildFormField(bomCtrl, 'BOM Code (optional)', Icons.tag)),
                      ],
                    ),
                    const SizedBox(height: 10),
                    _buildFormField(rawCtrl, 'Raw Material Allocated', Icons.layers),

                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF7C3AED),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          elevation: 0,
                        ),
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                final prod = prodCtrl.text.trim();
                                final cust = custCtrl.text.trim();
                                final qty = int.tryParse(qtyCtrl.text.trim()) ?? 500;
                                if (prod.isEmpty || cust.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Please fill product and customer.')),
                                  );
                                  return;
                                }

                                setModalState(() => isSubmitting = true);

                                int maxNum = 57;
                                for (var w in allWos) {
                                  final numMatch = RegExp(r'\d+').firstMatch(w['workOrderNo']?.toString() ?? w['id']?.toString() ?? '');
                                  if (numMatch != null) {
                                    final val = int.tryParse(numMatch.group(0) ?? '') ?? 0;
                                    if (val > maxNum) maxNum = val;
                                  }
                                }
                                final nextWoId = 'WO-${maxNum + 1}';

                                final newWo = {
                                  'id': nextWoId,
                                  'workOrderNo': nextWoId,
                                  'productName': prod,
                                  'plannedQty': qty,
                                  'completedQty': 0,
                                  'customer': cust,
                                  'rawMaterial': rawCtrl.text.trim(),
                                  'bomCode': bomCtrl.text.trim(),
                                  'status': 'In Progress',
                                  'currentStage': 'Raw Material Prep',
                                  'stage': 'Raw Material Prep',
                                  'targetDate': DateTime.now().add(const Duration(days: 7)).toIso8601String().split('T')[0],
                                };

                                final ok = await ApiService.createWorkOrder(newWo);
                                if (!mounted) return;
                                Navigator.of(ctx).pop();

                                if (ok) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('✓ $nextWoId issued to factory floor!'),
                                      backgroundColor: AppTheme.statusGreen,
                                    ),
                                  );
                                  _loadWorkOrders();
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Failed to save Work Order. Please retry.'),
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
                            : const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.precision_manufacturing, size: 18),
                                  SizedBox(width: 8),
                                  Text('Issue Work Order', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                                ],
                              ),
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildFormField(TextEditingController ctrl, String label, IconData icon, {bool isNumber = false}) {
    return TextField(
      controller: ctrl,
      keyboardType: isNumber ? TextInputType.number : TextInputType.text,
      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.darkSlate),
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon, size: 18, color: AppTheme.textMuted),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF7C3AED), width: 1.5)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF7C3AED),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_task),
        label: const Text('Issue Work Order', style: TextStyle(fontWeight: FontWeight.w700)),
        onPressed: _showCreateWorkOrderSheet,
      ),
      body: RefreshIndicator(
        onRefresh: _loadWorkOrders,
        color: const Color(0xFF7C3AED),
        child: Column(
          children: [
            // Filter and Search Bar
            Container(
              padding: const EdgeInsets.all(16),
              color: Colors.white,
              child: Column(
                children: [
                  TextField(
                    onChanged: (v) {
                      searchQuery = v;
                      _applyFilters();
                    },
                    decoration: InputDecoration(
                      hintText: 'Search Work Order # or Product...',
                      prefixIcon: const Icon(Icons.search, color: AppTheme.textMuted),
                      contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF7C3AED), width: 1.5)),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: ['All', 'In Progress', 'Completed'].map((f) {
                      final isSelected = selectedFilter == f;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(f),
                          selected: isSelected,
                          selectedColor: const Color(0xFFF3E8FF),
                          backgroundColor: AppTheme.backgroundLight,
                          labelStyle: TextStyle(
                            fontSize: 11.5,
                            fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                            color: isSelected ? const Color(0xFF7C3AED) : AppTheme.darkSlate,
                          ),
                          onSelected: (val) {
                            if (val) {
                              setState(() {
                                selectedFilter = f;
                                _applyFilters();
                              });
                            }
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),

            Expanded(
              child: isLoading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFF7C3AED)))
                  : filteredWos.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.precision_manufacturing_outlined, size: 56, color: Colors.grey.shade400),
                              const SizedBox(height: 12),
                              const Text('No Work Orders Found', style: TextStyle(fontWeight: FontWeight.w700, color: AppTheme.darkSlate)),
                              const SizedBox(height: 4),
                              Text('Tap "+ Issue Work Order" to create a new job card.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                            ],
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: filteredWos.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, idx) {
                            final w = filteredWos[idx];
                            final id = w['id'] ?? w['workOrderNo'] ?? w['woId'] ?? 'WO-??';
                            final prod = w['product'] ?? w['productName'] ?? 'Solar Aluminum Rail';
                            final customer = w['customer'] ?? 'Direct Manufacturing';
                            final planned = w['plannedQty'] ?? w['qty'] ?? 0;
                            final currentStage = w['currentStage'] ?? w['stage'] ?? stages[0];
                            final stageIdx = stages.indexOf(currentStage);
                            final progress = stageIdx >= 0 ? (stageIdx + 1) / stages.length : 0.2;
                            final isCompleted = stageIdx == stages.length - 1 || (w['status'] ?? '').toString().toLowerCase().contains('completed');

                            return Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: AppTheme.borderSubtle),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.02),
                                    blurRadius: 10,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
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
                                            padding: const EdgeInsets.all(8),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFF3E8FF),
                                              borderRadius: BorderRadius.circular(10),
                                            ),
                                            child: const Icon(Icons.precision_manufacturing, size: 20, color: Color(0xFF7C3AED)),
                                          ),
                                          const SizedBox(width: 10),
                                          Text(
                                            id,
                                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppTheme.darkSlate),
                                          ),
                                        ],
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: isCompleted ? AppTheme.statusGreen.withOpacity(0.1) : const Color(0xFFF3E8FF),
                                          borderRadius: BorderRadius.circular(20),
                                        ),
                                        child: Text(
                                          isCompleted ? 'Completed' : 'In Line',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                            color: isCompleted ? AppTheme.statusGreen : const Color(0xFF7C3AED),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    prod,
                                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.darkSlate),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Client: $customer • Target: $planned pcs',
                                    style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                  ),
                                  const SizedBox(height: 14),

                                  // Stage Tracker
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Stage: $currentStage',
                                        style: TextStyle(
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w700,
                                          color: isCompleted ? AppTheme.statusGreen : const Color(0xFF7C3AED),
                                        ),
                                      ),
                                      Text(
                                        '${(progress * 100).toInt()}% Done',
                                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textMuted),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: LinearProgressIndicator(
                                      value: progress,
                                      backgroundColor: AppTheme.borderSubtle,
                                      color: isCompleted ? AppTheme.statusGreen : const Color(0xFF7C3AED),
                                      minHeight: 6,
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  if (!isCompleted)
                                    SizedBox(
                                      width: double.infinity,
                                      child: ElevatedButton.icon(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: const Color(0xFF7C3AED),
                                          foregroundColor: Colors.white,
                                          elevation: 0,
                                          padding: const EdgeInsets.symmetric(vertical: 8),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                        ),
                                        icon: const Icon(Icons.arrow_forward, size: 16),
                                        label: const Text('Advance to Next Stage', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                                        onPressed: () => _advanceStage(Map<String, dynamic>.from(w)),
                                      ),
                                    ),
                                ],
                              ),
                            );
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }
}
