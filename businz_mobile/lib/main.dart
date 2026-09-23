import 'package:flutter/material.dart';
import 'theme/app_theme.dart';
import 'views/welcome_view.dart';
import 'views/login_view.dart';
import 'views/dashboard_view.dart';
import 'views/inventory_view.dart';
import 'views/bom_orders_view.dart';
import 'views/work_orders_view.dart';
import 'views/purchase_orders_view.dart';
import 'views/proforma_invoices_view.dart';
import 'views/dashboards/sales_dashboard.dart';
import 'views/dashboards/production_dashboard.dart';
import 'views/dashboards/procurement_dashboard.dart';
import 'views/dashboards/accounts_dashboard.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const BusinzApp());
}

class BusinzApp extends StatelessWidget {
  const BusinzApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BUSINZ',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: const MainNavigationShell(),
    );
  }
}

class MainNavigationShell extends StatefulWidget {
  const MainNavigationShell({super.key});

  @override
  State<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends State<MainNavigationShell> {
  bool _isAuthenticated = false;
  bool _showLoginForm = false;
  String _activeRole = 'CEO / MD';
  String _activeUserName = 'CEO / MD';
  int _currentTabIndex = 0;

  final List<String> _allRoles = [
    'CEO / MD',
    'Sales Head',
    'Sales Executive',
    'Production Head',
    'Floor Supervisor',
    'Floor Employee',
    'Procurement Head',
    'Accounts Head',
    'Accounts Executive',
  ];

  void _handleLoginSuccess(String role, String userName) {
    setState(() {
      _activeRole = role;
      _activeUserName = userName;
      _isAuthenticated = true;
      _currentTabIndex = 0;
    });
  }

  void _handleSignOut() {
    setState(() {
      _isAuthenticated = false;
      _showLoginForm = false;
      _currentTabIndex = 0;
    });
  }

  // Determine Department from Role
  String _getDepartment(String role) {
    if (role.contains('CEO') || role.contains('MD')) return 'Executive Leadership';
    if (role.contains('Sales')) return 'Sales & Commercial';
    if (role.contains('Production') || role.contains('Floor')) return 'Production';
    if (role.contains('Procurement')) return 'Procurement';
    if (role.contains('Accounts')) return 'Accounts & Finance';
    return 'General';
  }

  @override
  Widget build(BuildContext context) {
    // 1. Strict Authentication Guard - shows WelcomeView or LoginView if not authenticated
    if (!_isAuthenticated) {
      if (_showLoginForm) {
        return LoginView(
          onLoginSuccess: _handleLoginSuccess,
          onBack: () => setState(() => _showLoginForm = false),
        );
      }
      return WelcomeView(
        onGetStarted: () => setState(() => _showLoginForm = true),
        onLogin: () => setState(() => _showLoginForm = true),
      );
    }

    final dept = _getDepartment(_activeRole);

    // Build department-specific navigation configuration
    List<Widget> views = [];
    List<BottomNavigationBarItem> navItems = [];
    List<String> titles = [];

    if (dept == 'Sales & Commercial') {
      views = [
        SalesDashboardView(
          userRole: _activeRole,
          onNavigateSection: (sec) {
            if (sec == 'Proforma Invoices') setState(() => _currentTabIndex = 1);
            if (sec == 'BOM Orders') setState(() => _currentTabIndex = 2);
            if (sec == 'Inventory Stores') setState(() => _currentTabIndex = 3);
          },
        ),
        ProformaInvoicesView(
          onNavigateToBoms: () => setState(() => _currentTabIndex = 2),
        ),
        BomOrdersView(userRole: _activeRole),
        InventoryView(userRole: _activeRole),
      ];
      titles = ['Sales Hub', 'Proforma Invoices', 'BOM Orders', 'Stores'];
      navItems = const [
        BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard), label: 'Sales'),
        BottomNavigationBarItem(icon: Icon(Icons.receipt_long_outlined), activeIcon: Icon(Icons.receipt_long), label: 'PIs'),
        BottomNavigationBarItem(icon: Icon(Icons.alt_route_outlined), activeIcon: Icon(Icons.alt_route), label: 'BOMs'),
        BottomNavigationBarItem(icon: Icon(Icons.warehouse_outlined), activeIcon: Icon(Icons.warehouse), label: 'Stores'),
      ];
    } else if (dept == 'Production') {
      views = [
        ProductionDashboardView(
          userRole: _activeRole,
          onNavigateSection: (sec) {
            if (sec == 'Work Orders') setState(() => _currentTabIndex = 1);
            if (sec == 'Inventory Stores') setState(() => _currentTabIndex = 2);
          },
        ),
        WorkOrdersView(userRole: _activeRole),
        InventoryView(userRole: _activeRole),
      ];
      titles = ['Production Dashboard', 'Floor Work Orders', 'Raw Material Stores'];
      navItems = const [
        BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard), label: 'Plant'),
        BottomNavigationBarItem(icon: Icon(Icons.precision_manufacturing_outlined), activeIcon: Icon(Icons.precision_manufacturing), label: 'Work Orders'),
        BottomNavigationBarItem(icon: Icon(Icons.warehouse_outlined), activeIcon: Icon(Icons.warehouse), label: 'Stores'),
      ];
    } else if (dept == 'Procurement') {
      views = [
        ProcurementDashboardView(
          userRole: _activeRole,
          onNavigateSection: (sec) {
            if (sec == 'Purchase Orders') setState(() => _currentTabIndex = 1);
            if (sec == 'Inventory Stores') setState(() => _currentTabIndex = 2);
          },
        ),
        PurchaseOrdersView(userRole: _activeRole),
        InventoryView(userRole: _activeRole),
      ];
      titles = ['Procurement Hub', 'Purchase Orders (Zoho)', 'Live Inventory Stores'];
      navItems = const [
        BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard), label: 'Sourcing'),
        BottomNavigationBarItem(icon: Icon(Icons.shopping_cart_outlined), activeIcon: Icon(Icons.shopping_cart), label: 'POs'),
        BottomNavigationBarItem(icon: Icon(Icons.warehouse_outlined), activeIcon: Icon(Icons.warehouse), label: 'Inventory'),
      ];
    } else if (dept == 'Accounts & Finance') {
      views = [
        AccountsDashboardView(
          userRole: _activeRole,
          onNavigateSection: (sec) {
            if (sec == 'Purchase Orders') setState(() => _currentTabIndex = 1);
            if (sec == 'BOM Orders') setState(() => _currentTabIndex = 2);
          },
        ),
        PurchaseOrdersView(userRole: _activeRole),
        BomOrdersView(userRole: _activeRole),
      ];
      titles = ['Finance Dashboard', 'PO Verification', 'BOM Payment Approvals'];
      navItems = const [
        BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard), label: 'Finance'),
        BottomNavigationBarItem(icon: Icon(Icons.receipt_long_outlined), activeIcon: Icon(Icons.receipt_long), label: 'Verify POs'),
        BottomNavigationBarItem(icon: Icon(Icons.alt_route_outlined), activeIcon: Icon(Icons.alt_route), label: 'BOMs'),
      ];
    } else {
      // Executive Leadership (CEO, MD) - Full Cross-Department Access
      views = [
        DashboardView(
          userRole: _activeRole,
          onNavigateTab: (idx) => setState(() => _currentTabIndex = idx),
        ),
        ProformaInvoicesView(
          onNavigateToBoms: () => setState(() => _currentTabIndex = 2),
        ),
        BomOrdersView(userRole: _activeRole),
        WorkOrdersView(userRole: _activeRole),
        PurchaseOrdersView(userRole: _activeRole),
        InventoryView(userRole: _activeRole),
      ];
      titles = [
        'Operations Control Room',
        'Proforma Invoices',
        'BOM Orders',
        'Floor Work Orders',
        'Purchase Orders',
        'Inventory Stores',
      ];
      navItems = const [
        BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), activeIcon: Icon(Icons.dashboard), label: 'Home'),
        BottomNavigationBarItem(icon: Icon(Icons.receipt_long_outlined), activeIcon: Icon(Icons.receipt_long), label: 'PIs'),
        BottomNavigationBarItem(icon: Icon(Icons.alt_route_outlined), activeIcon: Icon(Icons.alt_route), label: 'BOM'),
        BottomNavigationBarItem(icon: Icon(Icons.precision_manufacturing_outlined), activeIcon: Icon(Icons.precision_manufacturing), label: 'Floor'),
        BottomNavigationBarItem(icon: Icon(Icons.shopping_cart_outlined), activeIcon: Icon(Icons.shopping_cart), label: 'POs'),
        BottomNavigationBarItem(icon: Icon(Icons.warehouse_outlined), activeIcon: Icon(Icons.warehouse), label: 'Stock'),
      ];
    }

    final safeIndex = _currentTabIndex >= views.length ? 0 : _currentTabIndex;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppTheme.primaryTeal,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'BZ',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 14,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'BUSINZ',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      color: AppTheme.darkSlate,
                      height: 1.1,
                    ),
                  ),
                  Text(
                    titles[safeIndex],
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textMuted,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          // Role Pill
          InkWell(
            onTap: _showRolePicker,
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppTheme.primaryLightTeal,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppTheme.primaryTeal.withOpacity(0.3)),
              ),
              child: Row(
                children: [
                  Text(
                    _activeRole,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.primaryTeal,
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(Icons.arrow_drop_down, size: 16, color: AppTheme.primaryTeal),
                ],
              ),
            ),
          ),
          const SizedBox(width: 6),
          // Logout Icon
          IconButton(
            icon: const Icon(Icons.logout, size: 18, color: AppTheme.statusRed),
            tooltip: 'Sign Out',
            onPressed: _handleSignOut,
          ),
          const SizedBox(width: 4),
        ],
      ),
      drawer: Drawer(
        child: Column(
          children: [
            // Drawer Header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 50, 20, 20),
              color: AppTheme.darkSlate,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppTheme.primaryTeal,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Center(
                      child: Text(
                        'BZ',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          fontSize: 18,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _activeUserName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                  Text(
                    'Dept: $dept',
                    style: const TextStyle(color: AppTheme.primaryCyan, fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
            // Department Navigation Links
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  ...List.generate(titles.length, (i) {
                    return ListTile(
                      leading: Icon(
                        i == 0
                            ? Icons.dashboard_outlined
                            : (titles[i].contains('Proforma') || titles[i].contains('PI'))
                                ? Icons.receipt_long_outlined
                                : titles[i].contains('BOM')
                                    ? Icons.alt_route_outlined
                                    : titles[i].contains('Work')
                                        ? Icons.precision_manufacturing_outlined
                                        : titles[i].contains('Purchase')
                                            ? Icons.shopping_cart_outlined
                                            : Icons.warehouse_outlined,
                        color: safeIndex == i ? AppTheme.primaryTeal : AppTheme.darkSlate,
                      ),
                      title: Text(
                        titles[i],
                        style: TextStyle(
                          fontWeight: safeIndex == i ? FontWeight.w800 : FontWeight.w600,
                          color: safeIndex == i ? AppTheme.primaryTeal : AppTheme.darkSlate,
                          fontSize: 13.5,
                        ),
                      ),
                      selected: safeIndex == i,
                      selectedTileColor: AppTheme.primaryLightTeal,
                      onTap: () {
                        setState(() => _currentTabIndex = i);
                        Navigator.pop(context);
                      },
                    );
                  }),
                  const Divider(height: 24),
                  ListTile(
                    leading: const Icon(Icons.switch_account_outlined, color: AppTheme.primaryTeal),
                    title: const Text('Switch Role', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                    onTap: () {
                      Navigator.pop(context);
                      _showRolePicker();
                    },
                  ),
                  ListTile(
                    leading: const Icon(Icons.logout_outlined, color: AppTheme.statusRed),
                    title: const Text('Sign Out', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: AppTheme.statusRed)),
                    onTap: () {
                      Navigator.pop(context);
                      _handleSignOut();
                    },
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.all(16),
              color: AppTheme.backgroundLight,
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.circle, size: 8, color: AppTheme.statusGreen),
                  SizedBox(width: 6),
                  Text('Connected to Node Server:5001', style: TextStyle(fontSize: 11, color: AppTheme.textMuted, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
      ),
      body: views[safeIndex],
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: const Border(top: BorderSide(color: AppTheme.borderSubtle)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: safeIndex,
          onTap: (idx) => setState(() => _currentTabIndex = idx),
          type: BottomNavigationBarType.fixed,
          backgroundColor: Colors.white,
          selectedItemColor: AppTheme.primaryTeal,
          unselectedItemColor: AppTheme.textMuted,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 10.5),
          elevation: 0,
          items: navItems,
        ),
      ),
    );
  }

  void _showRolePicker() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
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
              const Text('Switch Mobile Role & Workspace', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppTheme.darkSlate)),
              const SizedBox(height: 4),
              const Text('Each role loads its dedicated department tools & metrics.', style: TextStyle(fontSize: 11.5, color: AppTheme.textMuted)),
              const SizedBox(height: 12),
              Expanded(
                child: ListView(
                  children: _allRoles.map((r) {
                    final isSelected = _activeRole == r;
                    return InkWell(
                      onTap: () {
                        setState(() {
                          _activeRole = r;
                          _currentTabIndex = 0;
                        });
                        Navigator.pop(context);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                        margin: const EdgeInsets.only(bottom: 6),
                        decoration: BoxDecoration(
                          color: isSelected ? AppTheme.primaryLightTeal : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: isSelected ? AppTheme.primaryTeal : AppTheme.borderSubtle),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(r, style: TextStyle(fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600, color: isSelected ? AppTheme.primaryTeal : AppTheme.textDark, fontSize: 13)),
                                Text(_getDepartment(r), style: const TextStyle(fontSize: 10.5, color: AppTheme.textMuted)),
                              ],
                            ),
                            if (isSelected) const Icon(Icons.check_circle, color: AppTheme.primaryTeal, size: 18),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
