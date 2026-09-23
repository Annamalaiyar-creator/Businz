import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class InventoryView extends StatefulWidget {
  final String userRole;

  const InventoryView({super.key, required this.userRole});

  @override
  State<InventoryView> createState() => _InventoryViewState();
}

class _InventoryViewState extends State<InventoryView> {
  List<dynamic> allMaterials = [];
  List<dynamic> filteredMaterials = [];
  bool isLoading = true;
  String searchQuery = '';
  String selectedFilter = 'All'; // 'All' | 'In Stock' | 'Low Stock' | 'Out of Stock'

  @override
  void initState() {
    super.initState();
    _loadMaterials();
  }

  Future<void> _loadMaterials() async {
    setState(() => isLoading = true);
    final mats = await ApiService.fetchRawMaterials();
    if (mounted) {
      setState(() {
        allMaterials = mats;
        _applyFilters();
        isLoading = false;
      });
    }
  }

  void _applyFilters() {
    filteredMaterials = allMaterials.where((m) {
      final code = (m['code'] ?? m['sku'] ?? '').toString();
      final name = (m['name'] ?? '').toString();
      final cat = (m['category'] ?? m['cat'] ?? '').toString();

      if (code.isEmpty || code == '—' || code.toUpperCase() == 'RM-VRM') return false;

      // Status Filter
      final status = (m['status'] ?? '').toString().toLowerCase();
      final stock = num.tryParse('${m['stock'] ?? m['physicalStock'] ?? 0}') ?? 0;
      final minLvl = num.tryParse('${m['minLevel'] ?? 50}') ?? 50;

      if (selectedFilter == 'In Stock' && (stock <= minLvl || status.contains('out'))) return false;
      if (selectedFilter == 'Low Stock' && (stock == 0 || stock > minLvl)) return false;
      if (selectedFilter == 'Out of Stock' && stock > 0) return false;

      // Search Query
      if (searchQuery.isNotEmpty) {
        final q = searchQuery.toLowerCase();
        final matchCode = code.toLowerCase().contains(q);
        final matchName = name.toLowerCase().contains(q);
        final matchCat = cat.toLowerCase().contains(q);
        if (!matchCode && !matchName && !matchCat) return false;
      }

      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // 1. Search & Filter Bar
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
                  hintText: 'Search code, name, category...',
                  hintStyle: const TextStyle(fontSize: 13, color: AppTheme.textMuted),
                  prefixIcon: const Icon(Icons.search, size: 20, color: AppTheme.primaryTeal),
                  filled: true,
                  fillColor: AppTheme.backgroundLight,
                  contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppTheme.borderSubtle),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppTheme.borderSubtle),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: const BorderSide(color: AppTheme.primaryTeal, width: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: ['All', 'In Stock', 'Low Stock', 'Out of Stock'].map((f) {
                    final isSelected = selectedFilter == f;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(f),
                        selected: isSelected,
                        selectedColor: AppTheme.primaryLightTeal,
                        backgroundColor: AppTheme.backgroundLight,
                        labelStyle: TextStyle(
                          fontSize: 11.5,
                          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                          color: isSelected ? AppTheme.primaryTeal : AppTheme.textDark,
                        ),
                        side: BorderSide(
                          color: isSelected ? AppTheme.primaryTeal : AppTheme.borderSubtle,
                        ),
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
              ),
            ],
          ),
        ),

        // 2. Materials List
        Expanded(
          child: isLoading
              ? const Center(child: CircularProgressIndicator(color: AppTheme.primaryTeal))
              : filteredMaterials.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.inventory_2_outlined, size: 48, color: AppTheme.textMuted.withOpacity(0.5)),
                          const SizedBox(height: 8),
                          const Text('No materials found', style: TextStyle(color: AppTheme.textMuted)),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      color: AppTheme.primaryTeal,
                      onRefresh: _loadMaterials,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: filteredMaterials.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, idx) {
                          final m = filteredMaterials[idx];
                          final code = m['code'] ?? m['sku'] ?? 'N/A';
                          final name = m['name'] ?? 'Unnamed Product';
                          final cat = m['cat'] ?? m['category'] ?? 'General';
                          final stock = num.tryParse('${m['stock'] ?? m['physicalStock'] ?? 0}') ?? 0;
                          final unit = m['unit'] ?? m['uom'] ?? 'Nos';
                          final minLvl = num.tryParse('${m['minLevel'] ?? 50}') ?? 50;

                          Color badgeColor = AppTheme.statusGreen;
                          Color badgeBg = AppTheme.statusGreenBg;
                          String statusText = 'In Stock';

                          if (stock == 0) {
                            badgeColor = AppTheme.statusRed;
                            badgeBg = AppTheme.statusRedBg;
                            statusText = 'Out of Stock';
                          } else if (stock <= minLvl) {
                            badgeColor = AppTheme.statusAmber;
                            badgeBg = AppTheme.statusAmberBg;
                            statusText = 'Low Stock';
                          }

                          return InkWell(
                            onTap: () => _showItemDetails(m),
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: AppTheme.borderSubtle),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  // Code Icon Badge
                                  Container(
                                    width: 44,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      color: AppTheme.primaryLightTeal,
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Center(
                                      child: Text(
                                        code.toString().substring(0, code.toString().length > 3 ? 3 : code.toString().length).toUpperCase(),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w900,
                                          fontSize: 12,
                                          color: AppTheme.primaryTeal,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  // Info
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          code.toString(),
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w800,
                                            color: AppTheme.darkSlate,
                                          ),
                                        ),
                                        Text(
                                          name.toString(),
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: AppTheme.textMuted,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 4),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: AppTheme.backgroundLight,
                                            borderRadius: BorderRadius.circular(4),
                                            border: Border.all(color: AppTheme.borderSubtle),
                                          ),
                                          child: Text(
                                            cat.toString(),
                                            style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: AppTheme.textMuted),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  // Stock Value Pill
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        '$stock $unit',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w900,
                                          color: badgeColor,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: badgeBg,
                                          borderRadius: BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          statusText,
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w800,
                                            color: badgeColor,
                                          ),
                                        ),
                                      ),
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

  void _showItemDetails(dynamic item) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        final code = item['code'] ?? item['sku'] ?? 'N/A';
        final name = item['name'] ?? 'Unnamed Product';
        final cat = item['cat'] ?? item['category'] ?? 'General';
        final stock = item['stock'] ?? item['physicalStock'] ?? 0;
        final openStock = item['openingStock'] ?? 0;
        final store = item['store'] ?? 'Main Store';
        final hsn = item['hsn'] ?? '7604';

        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(code.toString(), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.darkSlate)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: AppTheme.primaryLightTeal, borderRadius: BorderRadius.circular(20)),
                    child: Text(cat.toString(), style: const TextStyle(color: AppTheme.primaryTeal, fontWeight: FontWeight.w700, fontSize: 11)),
                  ),
                ],
              ),
              Text(name.toString(), style: const TextStyle(fontSize: 13, color: AppTheme.textMuted)),
              const Divider(height: 24),
              _buildDetailRow('Physical Stock', '$stock Nos'),
              _buildDetailRow('Opening Stock', '$openStock Nos'),
              _buildDetailRow('Storage Location', store.toString()),
              _buildDetailRow('HSN Code', hsn.toString()),
              const SizedBox(height: 16),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.primaryTeal,
                        side: const BorderSide(color: AppTheme.primaryTeal),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      icon: const Icon(Icons.add_shopping_cart, size: 16),
                      label: const Text('Inward Stock', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      onPressed: () {
                        Navigator.pop(context);
                        _showInwardModal(code.toString(), name.toString());
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

  void _showInwardModal(String code, String name) {
    final qtyCtrl = TextEditingController(text: '100');
    final notesCtrl = TextEditingController(text: 'Received via mobile GRN inward');
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryLightTeal,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(Icons.add_box, color: AppTheme.primaryTeal, size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Inward Physical Stock', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                        Text(code, style: const TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                      ],
                    ),
                  ),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Item: $name', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.darkSlate)),
                  const SizedBox(height: 14),
                  TextField(
                    controller: qtyCtrl,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: 'Quantity to Add (Nos)',
                      prefixIcon: const Icon(Icons.numbers, size: 18),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: notesCtrl,
                    decoration: InputDecoration(
                      labelText: 'Inward Remarks / PO Ref',
                      prefixIcon: const Icon(Icons.note_alt_outlined, size: 18),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryTeal,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: isSaving
                      ? null
                      : () async {
                          final added = double.tryParse(qtyCtrl.text.trim()) ?? 0.0;
                          if (added <= 0) return;
                          setDialogState(() => isSaving = true);
                          final ok = await ApiService.inwardStockItem(code, added, notes: notesCtrl.text.trim());
                          if (!mounted) return;
                          Navigator.pop(ctx);
                          if (ok) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text('✓ Successfully inwarded +${added.toInt()} Nos to $code!'),
                                backgroundColor: AppTheme.statusGreen,
                              ),
                            );
                            _loadMaterials();
                          }
                        },
                  child: isSaving
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Confirm Inward'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppTheme.textMuted, fontSize: 13)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.darkSlate, fontSize: 13)),
        ],
      ),
    );
  }
}
