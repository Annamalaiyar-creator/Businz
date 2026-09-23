import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

class ProformaInvoicesView extends StatefulWidget {
  final VoidCallback? onNavigateToBoms;

  const ProformaInvoicesView({super.key, this.onNavigateToBoms});

  @override
  State<ProformaInvoicesView> createState() => _ProformaInvoicesViewState();
}

class _ProformaInvoicesViewState extends State<ProformaInvoicesView> {
  List<dynamic> _allPis = [];
  List<dynamic> _filteredPis = [];
  bool _isLoading = true;
  String _selectedFilter = 'All';
  final TextEditingController _searchCtrl = TextEditingController();
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _loadData();
    _searchCtrl.addListener(_applyFilters);
    // Silent background sync with Web every 8 seconds
    _pollTimer = Timer.periodic(const Duration(seconds: 8), (_) => _silentRefresh());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _silentRefresh() async {
    try {
      final data = await ApiService.fetchProformaInvoices();
      if (mounted && data.isNotEmpty && data.length != _allPis.length) {
        setState(() {
          _allPis = data;
          _applyFilters();
        });
      }
    } catch (_) {}
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final data = await ApiService.fetchProformaInvoices();
    if (mounted) {
      setState(() {
        _allPis = data;
        _isLoading = false;
        _applyFilters();
      });
    }
  }

  void _applyFilters() {
    final query = _searchCtrl.text.toLowerCase().trim();
    setState(() {
      _filteredPis = _allPis.where((pi) {
        final piNo = (pi['piNo'] ?? pi['id'] ?? '').toString().toLowerCase();
        final customer = (pi['customerName'] ?? pi['vendor'] ?? '').toString().toLowerCase();
        final prod = (pi['productName'] ?? '').toString().toLowerCase();
        final status = (pi['status'] ?? 'Issued').toString();

        final matchesSearch = query.isEmpty ||
            piNo.contains(query) ||
            customer.contains(query) ||
            prod.contains(query);

        if (!matchesSearch) return false;

        if (_selectedFilter == 'All') return true;
        if (_selectedFilter == 'Issued') return status == 'Issued' || status == 'Sent';
        if (_selectedFilter == 'Converted') return status == 'Converted to BOM' || pi['convertedToBom'] == true;
        if (_selectedFilter == 'Pending') return status != 'Converted to BOM' && status != 'Cancelled';
        return true;
      }).toList();

      // Sort newest first
      _filteredPis.sort((a, b) {
        final aMatch = RegExp(r'PI-(\d+)').firstMatch(a['piNo']?.toString() ?? a['id']?.toString() ?? '');
        final bMatch = RegExp(r'PI-(\d+)').firstMatch(b['piNo']?.toString() ?? b['id']?.toString() ?? '');
        final aNum = aMatch != null ? int.tryParse(aMatch.group(1)!) ?? 0 : 0;
        final bNum = bMatch != null ? int.tryParse(bMatch.group(1)!) ?? 0 : 0;
        return bNum.compareTo(aNum);
      });
    });
  }

  // --- CONVERT PI TO BOM MODAL WITH CUSTOMIZABLE ITEMS & SPECS ---
  void _showConvertToBomSheet(Map<String, dynamic> pi) async {
    final piNo = pi['piNo'] ?? pi['id'] ?? 'PI';
    final customer = pi['customerName'] ?? pi['vendor'] ?? 'Commercial Client';

    // Fetch next BOM code
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator(color: AppTheme.primaryTeal)),
    );

    final nextCode = await ApiService.getNextBomCode();
    if (!mounted) return;
    Navigator.of(context).pop(); // dismiss loading

    // Initial items cloned from PI
    List<Map<String, dynamic>> editableItems = [];
    if (pi['items'] is List && (pi['items'] as List).isNotEmpty) {
      for (final it in (pi['items'] as List)) {
        editableItems.add(Map<String, dynamic>.from(it is Map ? it : {}));
      }
    } else {
      // Fallback single item from PI product name
      final prod = pi['productName'] ?? pi['item'] ?? 'Solar Mounting Structure';
      final qty = pi['qty'] ?? pi['quantity'] ?? 100;
      final rate = pi['rate'] ?? pi['unitRate'] ?? 450;
      editableItems.add({
        'name': prod,
        'item': prod,
        'qty': qty,
        'quantity': qty,
        'unit': 'Nos',
        'rate': rate,
        'specs': 'Standard Factory Extrusion & Cutting Specs',
      });
    }

    final remarksCtrl = TextEditingController(text: 'Converted from $piNo on BUSINZ Mobile');
    final deliveryTermsCtrl = TextEditingController(text: 'Ex-Works / Standard Dispatch');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        bool isConverting = false;

        return StatefulBuilder(
          builder: (context, setModalState) {
            num calcTotal() {
              num total = 0;
              for (final it in editableItems) {
                final q = num.tryParse('${it['qty'] ?? it['quantity'] ?? 0}') ?? 0;
                final r = num.tryParse('${it['rate'] ?? it['unitRate'] ?? 0}') ?? 0;
                total += (q * r);
              }
              return total;
            }

            void showAddItemDialog() {
              final nameCtrl = TextEditingController();
              final qtyCtrl = TextEditingController(text: '100');
              final unitCtrl = TextEditingController(text: 'Nos');
              final rateCtrl = TextEditingController(text: '500');
              final specsCtrl = TextEditingController(text: 'ALU-6063-T6 Cut to length');

              showDialog(
                context: context,
                builder: (dialogCtx) => AlertDialog(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  title: const Text('Add Component / Spec', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppTheme.darkSlate)),
                  content: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextField(
                          controller: nameCtrl,
                          decoration: const InputDecoration(labelText: 'Item Name / Profile', hintText: 'e.g. Solar Rail 2414mm'),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              flex: 2,
                              child: TextField(
                                controller: qtyCtrl,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(labelText: 'Qty'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextField(
                                controller: unitCtrl,
                                decoration: const InputDecoration(labelText: 'Unit'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              flex: 2,
                              child: TextField(
                                controller: rateCtrl,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(labelText: 'Rate (₹)'),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: specsCtrl,
                          decoration: const InputDecoration(labelText: 'Technical Specification', hintText: 'e.g. 15 Micron Anodized'),
                        ),
                      ],
                    ),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(dialogCtx).pop(),
                      child: const Text('Cancel', style: TextStyle(color: AppTheme.textMuted)),
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryTeal,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () {
                        final name = nameCtrl.text.trim();
                        if (name.isEmpty) return;
                        setModalState(() {
                          editableItems.add({
                            'name': name,
                            'item': name,
                            'qty': num.tryParse(qtyCtrl.text.trim()) ?? 100,
                            'quantity': num.tryParse(qtyCtrl.text.trim()) ?? 100,
                            'unit': unitCtrl.text.trim(),
                            'rate': num.tryParse(rateCtrl.text.trim()) ?? 0,
                            'specs': specsCtrl.text.trim(),
                          });
                        });
                        Navigator.of(dialogCtx).pop();
                      },
                      child: const Text('Add to BOM'),
                    ),
                  ],
                ),
              );
            }

            return Container(
              height: MediaQuery.of(context).size.height * 0.90,
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
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryTeal.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.transform, color: AppTheme.primaryTeal, size: 24),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Convert PI to BOM Order',
                              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppTheme.darkSlate),
                            ),
                            Text(
                              'Assigns $nextCode linked to $piNo',
                              style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryTeal.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppTheme.primaryTeal),
                        ),
                        child: Text(
                          nextCode,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppTheme.primaryTeal),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  // Client info card
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppTheme.backgroundLight,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.borderSubtle),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(customer, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.darkSlate)),
                              Text('Source Proforma: $piNo', style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                            ],
                          ),
                        ),
                        Text(
                          '₹ ${calcTotal().toStringAsFixed(0)}',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: AppTheme.darkSlate),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  // Items header with Add button
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Components & Specifications (${editableItems.length})',
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppTheme.darkSlate),
                      ),
                      TextButton.icon(
                        style: TextButton.styleFrom(
                          foregroundColor: AppTheme.primaryTeal,
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        ),
                        onPressed: showAddItemDialog,
                        icon: const Icon(Icons.add_circle_outline, size: 16),
                        label: const Text('Add Item / Spec', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ),
                  // Scrollable Items list
                  Expanded(
                    child: editableItems.isEmpty
                        ? const Center(
                            child: Text('No items added. Tap "Add Item / Spec" to add components.', style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
                          )
                        : ListView.separated(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            itemCount: editableItems.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (context, idx) {
                              final it = editableItems[idx];
                              final itName = it['name'] ?? it['item'] ?? 'Component';
                              final itQty = it['qty'] ?? it['quantity'] ?? 0;
                              final itUnit = it['unit'] ?? 'Nos';
                              final itRate = it['rate'] ?? it['unitRate'] ?? 0;
                              final itSpecs = it['specs'] ?? '';

                              return Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: AppTheme.borderSubtle),
                                ),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(itName.toString(), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.darkSlate)),
                                          const SizedBox(height: 2),
                                          Text(
                                            'Qty: $itQty $itUnit • Rate: ₹$itRate',
                                            style: const TextStyle(fontSize: 11.5, color: AppTheme.textMuted),
                                          ),
                                          if (itSpecs.toString().isNotEmpty) ...[
                                            const SizedBox(height: 2),
                                            Text(
                                              'Spec: $itSpecs',
                                              style: const TextStyle(fontSize: 11, color: AppTheme.primaryTeal, fontWeight: FontWeight.w500),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline, size: 18, color: AppTheme.statusRed),
                                      onPressed: () {
                                        setModalState(() {
                                          editableItems.removeAt(idx);
                                        });
                                      },
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ),
                  const SizedBox(height: 10),
                  // Remarks
                  TextField(
                    controller: remarksCtrl,
                    decoration: InputDecoration(
                      labelText: 'Production / Factory Remarks',
                      labelStyle: const TextStyle(fontSize: 12),
                      filled: true,
                      fillColor: AppTheme.backgroundLight,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
                    ),
                  ),
                  const SizedBox(height: 14),
                  // Submit Button
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primaryTeal,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                      onPressed: isConverting
                          ? null
                          : () async {
                              if (editableItems.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Please add at least 1 item to the BOM.')),
                                );
                                return;
                              }
                              setModalState(() => isConverting = true);
                              final ok = await ApiService.convertPiToBom(
                                pi,
                                nextCode,
                                customItems: editableItems,
                                remarks: remarksCtrl.text.trim(),
                                deliveryTerms: deliveryTermsCtrl.text.trim(),
                              );
                              if (!mounted) return;
                              Navigator.of(ctx).pop();
                              if (ok) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text('✓ Successfully converted $piNo into $nextCode! CEO & Production notified.'),
                                    backgroundColor: AppTheme.statusGreen,
                                  ),
                                );
                                _loadData();
                                if (widget.onNavigateToBoms != null) {
                                  widget.onNavigateToBoms!();
                                }
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Failed to convert PI to BOM. Please check server connection.'),
                                    backgroundColor: AppTheme.statusRed,
                                  ),
                                );
                              }
                            },
                      child: isConverting
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : Text(
                              'Confirm & Generate BOM ($nextCode)',
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                            ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // --- CREATE NEW PI MODAL ---
  void _showCreatePiSheet() {
    final customerCtrl = TextEditingController(text: 'Tata Power Solar Systems Ltd');
    final contactCtrl = TextEditingController(text: 'Operations Desk');
    final phoneCtrl = TextEditingController(text: '9876543210');
    final emailCtrl = TextEditingController(text: 'commercial@client.com');
    final gstinCtrl = TextEditingController(text: '27AAACT2345D1ZA');

    final itemNameCtrl = TextEditingController(text: 'Solar Mounting Rail 2414mm');
    final qtyCtrl = TextEditingController(text: '250');
    final rateCtrl = TextEditingController(text: '480');

    bool isSubmitting = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.88,
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
                            color: AppTheme.primaryTeal.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.receipt_long, color: AppTheme.primaryTeal, size: 22),
                        ),
                        const SizedBox(width: 12),
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Create Proforma Invoice',
                              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppTheme.darkSlate),
                            ),
                            Text(
                              'Commercial Sales Quote & Proforma',
                              style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Customer Details
                    const Text('CUSTOMER DETAILS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.textMuted, letterSpacing: 0.5)),
                    const SizedBox(height: 8),
                    _buildTextField(customerCtrl, 'Customer / Client Name', Icons.business),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(child: _buildTextField(contactCtrl, 'Contact Person', Icons.person)),
                        const SizedBox(width: 10),
                        Expanded(child: _buildTextField(phoneCtrl, 'Phone Number', Icons.phone)),
                      ],
                    ),
                    const SizedBox(height: 10),
                    _buildTextField(emailCtrl, 'Client Email', Icons.email),
                    const SizedBox(height: 10),
                    _buildTextField(gstinCtrl, 'GSTIN', Icons.verified_user),

                    const SizedBox(height: 20),
                    const Text('PRODUCT LINE ITEM', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.textMuted, letterSpacing: 0.5)),
                    const SizedBox(height: 8),
                    _buildTextField(itemNameCtrl, 'Product / Item Name', Icons.inventory_2),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: _buildTextField(qtyCtrl, 'Quantity (NOS)', Icons.numbers, isNumber: true),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildTextField(rateCtrl, 'Unit Rate (₹)', Icons.currency_rupee, isNumber: true),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primaryTeal,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          elevation: 0,
                        ),
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                final cust = customerCtrl.text.trim();
                                final item = itemNameCtrl.text.trim();
                                final qty = double.tryParse(qtyCtrl.text.trim()) ?? 100;
                                final rate = double.tryParse(rateCtrl.text.trim()) ?? 100;

                                if (cust.isEmpty || item.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Please fill all required fields.')),
                                  );
                                  return;
                                }

                                setModalState(() => isSubmitting = true);

                                // Compute next PI number from existing PIs
                                int maxNum = 55;
                                for (var p in _allPis) {
                                  final numMatch = RegExp(r'PI-(\d+)').firstMatch(p['piNo']?.toString() ?? p['id']?.toString() ?? '');
                                  if (numMatch != null) {
                                    final val = int.tryParse(numMatch.group(1)!) ?? 0;
                                    // only consider values <= 999 to prevent outliers
                                    if (val > maxNum && val < 1000) maxNum = val;
                                  }
                                }
                                final nextPiNo = 'PI-${(maxNum + 1).toString().padLeft(5, '0')}';
                                final subtotal = qty * rate;
                                final gst = subtotal * 0.18;
                                final total = subtotal + gst;

                                final newPi = {
                                  'id': nextPiNo,
                                  'piNo': nextPiNo,
                                  'customerName': cust,
                                  'vendor': cust,
                                  'contactPerson': contactCtrl.text.trim(),
                                  'phone': phoneCtrl.text.trim(),
                                  'email': emailCtrl.text.trim(),
                                  'gstNo': gstinCtrl.text.trim(),
                                  'productName': item,
                                  'status': 'Issued',
                                  'totalAmount': total,
                                  'amount': total,
                                  'date': DateTime.now().toIso8601String().split('T')[0],
                                  'items': [
                                    {
                                      'name': item,
                                      'code': 'PRD-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}',
                                      'category': 'Aluminium Profiles',
                                      'uom': 'NOS',
                                      'qty': qty.toString(),
                                      'rate': rate.toString(),
                                      'gstRate': '18%',
                                      'total': total.toString(),
                                    }
                                  ],
                                };

                                final ok = await ApiService.createProformaInvoice(newPi);
                                if (!mounted) return;
                                Navigator.of(ctx).pop();

                                if (ok) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('✓ $nextPiNo created and synced to database!'),
                                      backgroundColor: AppTheme.statusGreen,
                                    ),
                                  );
                                  _loadData();
                                } else {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Failed to save PI. Please retry.'),
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
                                  Icon(Icons.check, size: 18),
                                  SizedBox(width: 8),
                                  Text('Save & Issue PI', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
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

  Widget _buildTextField(TextEditingController ctrl, String label, IconData icon, {bool isNumber = false}) {
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
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.primaryTeal, width: 1.5)),
      ),
    );
  }



  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundLight,
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppTheme.primaryTeal,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('New PI', style: TextStyle(fontWeight: FontWeight.w700)),
        onPressed: _showCreatePiSheet,
      ),
      body: RefreshIndicator(
        onRefresh: _loadData,
        color: AppTheme.primaryTeal,
        child: Column(
          children: [
            // Search and filters bar
            Container(
              color: Colors.white,
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Column(
                children: [
                  TextField(
                    controller: _searchCtrl,
                    decoration: InputDecoration(
                      hintText: 'Search PI number, customer, product...',
                      prefixIcon: const Icon(Icons.search, color: AppTheme.textMuted),
                      contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.borderSubtle)),
                      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.primaryTeal, width: 1.5)),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildFilterChip('All'),
                        const SizedBox(width: 8),
                        _buildFilterChip('Pending BOM'),
                        const SizedBox(width: 8),
                        _buildFilterChip('Converted'),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: AppTheme.primaryTeal))
                  : _filteredPis.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.receipt_long_outlined, size: 56, color: Colors.grey.shade400),
                              const SizedBox(height: 12),
                              const Text('No Proforma Invoices Found', style: TextStyle(fontWeight: FontWeight.w700, color: AppTheme.darkSlate)),
                              const SizedBox(height: 4),
                              Text('Tap "+ New PI" to create one.', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                            ],
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _filteredPis.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 12),
                          itemBuilder: (context, idx) {
                            final pi = _filteredPis[idx];
                            final piNo = pi['piNo'] ?? pi['id'] ?? 'PI-00000';
                            final customer = pi['customerName'] ?? pi['vendor'] ?? 'Commercial Client';
                            final product = pi['productName'] ?? (pi['items'] is List && pi['items'].isNotEmpty ? pi['items'][0]['name'] : 'Solar Mounting Assembly');
                            final status = pi['status'] ?? 'Issued';
                            final isConverted = status.toString().toLowerCase().contains('convert') || pi['convertedToBom'] == true;
                            final convertedCode = pi['convertedBomCode'] ?? '';

                            return Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: isConverted ? AppTheme.statusGreen.withOpacity(0.3) : AppTheme.borderSubtle),
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
                                              color: isConverted ? AppTheme.statusGreen.withOpacity(0.1) : AppTheme.primaryTeal.withOpacity(0.1),
                                              borderRadius: BorderRadius.circular(10),
                                            ),
                                            child: Icon(
                                              Icons.description,
                                              size: 20,
                                              color: isConverted ? AppTheme.statusGreen : AppTheme.primaryTeal,
                                            ),
                                          ),
                                          const SizedBox(width: 10),
                                          Text(
                                            piNo,
                                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppTheme.darkSlate),
                                          ),
                                        ],
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: isConverted ? AppTheme.statusGreen.withOpacity(0.1) : AppTheme.lightTeal,
                                          borderRadius: BorderRadius.circular(20),
                                        ),
                                        child: Text(
                                          isConverted ? '✓ Converted to BOM' : 'Issued',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                            color: isConverted ? AppTheme.statusGreen : AppTheme.primaryTeal,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  Text(
                                    customer,
                                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.darkSlate),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Product: $product',
                                    style: const TextStyle(fontSize: 12, color: AppTheme.textMuted),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 14),

                                  // Action Button: Convert to BOM if not converted
                                  if (!isConverted)
                                    SizedBox(
                                      width: double.infinity,
                                      height: 40,
                                      child: ElevatedButton.icon(
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: AppTheme.primaryTeal,
                                          foregroundColor: Colors.white,
                                          elevation: 0,
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                        ),
                                        icon: const Icon(Icons.arrow_forward, size: 16),
                                        label: const Text('Convert to BOM', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                                        onPressed: () => _showConvertToBomSheet(pi),
                                      ),
                                    )
                                  else
                                    Container(
                                      width: double.infinity,
                                      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                                      decoration: BoxDecoration(
                                        color: Colors.grey.shade50,
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(color: Colors.grey.shade200),
                                      ),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          const Text('Linked BOM:', style: TextStyle(fontSize: 12, color: AppTheme.textMuted)),
                                          Text(
                                            convertedCode.isNotEmpty ? convertedCode : 'BOM Confirmed',
                                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.statusGreen),
                                          ),
                                        ],
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

  Widget _buildFilterChip(String label) {
    final isSelected = _selectedFilter == label;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedFilter = label;
          _applyFilters();
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryTeal : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : AppTheme.darkSlate,
          ),
        ),
      ),
    );
  }
}
