import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  // Primary (USB ADB Reverse) and Fallback (Wi-Fi LAN) Base URLs
  static const String primaryBaseUrl = 'http://127.0.0.1:5001/api';
  static const String lanBaseUrl = 'http://192.168.0.3:5001/api';
  static String activeBaseUrl = primaryBaseUrl;

  // Resilient HTTP GET with automatic failover between ADB Reverse and LAN Wi-Fi
  static Future<http.Response> _get(String path, {Duration timeout = const Duration(seconds: 5)}) async {
    try {
      final res = await http.get(Uri.parse('$activeBaseUrl$path')).timeout(timeout);
      return res;
    } catch (_) {
      // Switch to alternative URL and retry once
      final altUrl = (activeBaseUrl == primaryBaseUrl) ? lanBaseUrl : primaryBaseUrl;
      try {
        final res = await http.get(Uri.parse('$altUrl$path')).timeout(timeout);
        activeBaseUrl = altUrl; // Remember working endpoint
        return res;
      } catch (e) {
        rethrow;
      }
    }
  }

  // Resilient HTTP POST with automatic failover
  static Future<http.Response> _post(String path, dynamic body, {Duration timeout = const Duration(seconds: 6)}) async {
    final bodyStr = body is String ? body : jsonEncode(body);
    final headers = {'Content-Type': 'application/json'};
    try {
      final res = await http.post(Uri.parse('$activeBaseUrl$path'), headers: headers, body: bodyStr).timeout(timeout);
      return res;
    } catch (_) {
      final altUrl = (activeBaseUrl == primaryBaseUrl) ? lanBaseUrl : primaryBaseUrl;
      try {
        final res = await http.post(Uri.parse('$altUrl$path'), headers: headers, body: bodyStr).timeout(timeout);
        activeBaseUrl = altUrl;
        return res;
      } catch (e) {
        rethrow;
      }
    }
  }

  // --- RAW MATERIALS & STORES ---
  static Future<List<dynamic>> fetchRawMaterials() async {
    try {
      final res = await _get('/raw-materials', timeout: const Duration(seconds: 6));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data is List) return data;
      }
    } catch (e) {
      // ignore: avoid_print
      print('fetchRawMaterials error: $e');
    }
    return [];
  }

  static Future<bool> inwardStockItem(String itemCode, double addedQty, {String? notes}) async {
    try {
      final res = await _get('/store/raw_materials_store');
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body);
        List<dynamic> items = (body['data'] is List) ? List.from(body['data']) : [];
        final idx = items.indexWhere((i) => (i['code'] == itemCode) || (i['id'] == itemCode));
        if (idx != -1) {
          final currentQty = double.tryParse(items[idx]['stock']?.toString() ?? items[idx]['qty']?.toString() ?? '0') ?? 0.0;
          final newQty = currentQty + addedQty;
          items[idx]['stock'] = newQty;
          items[idx]['available'] = newQty;
          items[idx]['physicalStock'] = newQty;
          items[idx]['availableStock'] = newQty;
          items[idx]['lastUpdated'] = DateTime.now().toIso8601String();
          if (notes != null && notes.isNotEmpty) {
            items[idx]['lastInwardNotes'] = notes;
          }

          final saveRes = await _post('/store/raw_materials_store', items);
          return saveRes.statusCode == 200 || saveRes.statusCode == 201;
        }
      }
    } catch (e) {
      // ignore: avoid_print
      print('inwardStockItem error: $e');
    }
    return false;
  }

  // --- PROFORMA INVOICES (PI) ---
  static Future<List<dynamic>> fetchProformaInvoices() async {
    try {
      final res = await _get('/store/sales_pi_store');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data is Map && data['data'] is List) return data['data'];
        if (data is List) return data;
      }
    } catch (e) {
      // ignore: avoid_print
      print('fetchProformaInvoices error: $e');
    }
    return [];
  }

  static Future<bool> createProformaInvoice(Map<String, dynamic> pi) async {
    try {
      final res = await _post('/store/sales_pi_store', [pi]);
      return res.statusCode == 200 || res.statusCode == 201;
    } catch (e) {
      // ignore: avoid_print
      print('createProformaInvoice error: $e');
      return false;
    }
  }

  // --- BILL OF MATERIALS (BOM) ---
  static Future<List<dynamic>> fetchBoms() async {
    try {
      final res = await _get('/boms');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data is Map && data['data'] is List) return data['data'];
        if (data is List) return data;
      }
    } catch (_) {}
    return [];
  }

  static Future<String> getNextBomCode() async {
    try {
      final res = await _get('/boms/next-code', timeout: const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        return data['nextBomCode'] ?? data['nextCode'] ?? 'BOM-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
      }
    } catch (_) {}
    return 'BOM-${DateTime.now().millisecondsSinceEpoch.toString().substring(8)}';
  }

  static Future<bool> createBom(Map<String, dynamic> bom) async {
    try {
      // 1. Post to /api/boms
      final res = await _post('/boms', {'bom': bom, 'isNew': true});

      // 2. Also ensure presence in /api/store/bom_store and /api/store/bom_orders
      await _post('/store/bom_store', [bom]);
      await _post('/store/bom_orders', [bom]);

      return res.statusCode == 200 || res.statusCode == 201;
    } catch (e) {
      // ignore: avoid_print
      print('createBom error: $e');
      return false;
    }
  }

  static Future<bool> convertPiToBom(
    Map<String, dynamic> pi,
    String assignedBomCode, {
    List<dynamic>? customItems,
    String? remarks,
    String? deliveryTerms,
  }) async {
    try {
      final customerName = pi['customerName'] ?? pi['vendor'] ?? 'Commercial Client';
      final rawItems = customItems ?? (pi['items'] is List ? pi['items'] : []);
      
      // Calculate total amount from items if possible
      num calculatedTotal = 0;
      for (final it in rawItems) {
        final qty = num.tryParse('${it['qty'] ?? it['quantity'] ?? 0}') ?? 0;
        final rate = num.tryParse('${it['rate'] ?? it['unitRate'] ?? it['price'] ?? 0}') ?? 0;
        calculatedTotal += (qty * rate);
      }
      final totalAmount = calculatedTotal > 0 ? calculatedTotal : (pi['totalAmount'] ?? pi['amount'] ?? 0);

      final newBom = {
        'id': assignedBomCode,
        'bomCode': assignedBomCode,
        'code': assignedBomCode,
        'customerName': customerName,
        'companyName': customerName,
        'customer': customerName,
        'c2': customerName,
        'contactPerson': pi['contactPerson'] ?? '',
        'phone': pi['phone'] ?? '',
        'email': pi['email'] ?? '',
        'gstNo': pi['gstNo'] ?? '',
        'piNo': pi['piNo'] ?? '',
        'sourcePiNo': pi['piNo'] ?? '',
        'convertedFromPi': true,
        'createdAt': DateTime.now().toIso8601String(),
        'status': 'Sales Confirmed - Ready for Production',
        'commercialApproval': 'Approved',
        'salesConfirmationDate': DateTime.now().toIso8601String(),
        'items': rawItems,
        'totalAmount': totalAmount,
        'totalValue': totalAmount,
        'remarks': remarks ?? 'Converted from ${pi['piNo']} on BUSINZ Mobile',
        'deliveryTerms': deliveryTerms ?? 'Standard Delivery',
      };

      // 1. Create the BOM in production pipelines
      final bomCreated = await createBom(newBom);
      if (!bomCreated) return false;

      // 2. Update the PI record with status = 'Converted to BOM'
      final updatedPi = Map<String, dynamic>.from(pi);
      updatedPi['status'] = 'Converted to BOM';
      updatedPi['convertedToBom'] = true;
      updatedPi['isConverted'] = true;
      updatedPi['convertedBomCode'] = assignedBomCode;
      updatedPi['convertedDate'] = DateTime.now().toIso8601String();

      await _post('/store/sales_pi_store', [updatedPi]);

      return true;
    } catch (e) {
      // ignore: avoid_print
      print('convertPiToBom error: $e');
      return false;
    }
  }

  // --- PURCHASE ORDERS (ZOHO INTEGRATED) ---
  static Future<List<dynamic>> fetchPurchaseOrders() async {
    try {
      final res = await _get('/zoho/purchaseorders');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data is Map && data['purchaseorders'] is List) return data['purchaseorders'];
        if (data is List) return data;
      }
    } catch (_) {}
    return [];
  }

  static Future<bool> approvePurchaseOrder(
    String poId, {
    String? remarks,
    String? approver,
  }) async {
    try {
      final res = await _post(
        '/zoho/purchaseorders/$poId/approve',
        {
          'remarks': remarks ?? 'Approved by CEO / MD via BUSINZ Mobile',
          'approver': approver ?? 'CEO / MD',
        },
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        return data['success'] == true;
      }
    } catch (e) {
      // ignore: avoid_print
      print('approvePurchaseOrder error: $e');
    }
    return false;
  }

  // --- WORK ORDERS ---
  static Future<List<dynamic>> fetchWorkOrders() async {
    try {
      final res = await _get('/workorders');
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data is Map && data['workOrders'] is List) return data['workOrders'];
        if (data is List) return data;
      }
    } catch (_) {}
    return [];
  }

  static Future<bool> createWorkOrder(Map<String, dynamic> wo) async {
    try {
      final res = await _post('/workorders', wo);
      return res.statusCode == 200 || res.statusCode == 201;
    } catch (e) {
      // ignore: avoid_print
      print('createWorkOrder error: $e');
      return false;
    }
  }

  static Future<bool> advanceWorkOrder(Map<String, dynamic> wo) async {
    try {
      final stages = [
        'Raw Material Prep',
        'Extrusion / Cutting',
        'Fabrication & Punching',
        'Quality Inspection',
        'Completed & Ready'
      ];
      final currentStage = wo['currentStage'] ?? wo['stage'] ?? stages[0];
      final currentIndex = stages.indexOf(currentStage);
      final nextStage = currentIndex < stages.length - 1 ? stages[currentIndex + 1] : stages.last;
      final newStatus = nextStage == stages.last ? 'Completed' : 'In Progress';

      final updated = Map<String, dynamic>.from(wo);
      updated['currentStage'] = nextStage;
      updated['stage'] = nextStage;
      updated['status'] = newStatus;

      return await createWorkOrder(updated);
    } catch (_) {
      return false;
    }
  }
}
