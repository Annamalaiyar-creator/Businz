import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

class LoginView extends StatefulWidget {
  final Function(String role, String userName) onLoginSuccess;
  final VoidCallback? onBack;

  const LoginView({
    super.key,
    required this.onLoginSuccess,
    this.onBack,
  });

  @override
  State<LoginView> createState() => _LoginViewState();
}

class _LoginViewState extends State<LoginView> {
  final TextEditingController _idController = TextEditingController(text: 'CEO-VRM001');
  final TextEditingController _passwordController = TextEditingController(text: '••••••••');
  bool _obscurePassword = true;
  String? _errorMessage;
  String selectedRole = 'CEO / MD';

  // Role presets for quick testing
  final List<Map<String, String>> _quickRoles = [
    {'title': 'CEO / MD', 'id': 'CEO-VRM001', 'role': 'CEO / MD'},
    {'title': 'Sales Head', 'id': 'SH-VRM002', 'role': 'Sales Head'},
    {'title': 'Production Head', 'id': 'PH-VRM003', 'role': 'Production Head'},
    {'title': 'Procurement Head', 'id': 'PR-VRM004', 'role': 'Procurement Head'},
    {'title': 'Accounts Head', 'id': 'AH-VRM005', 'role': 'Accounts Head'},
  ];

  String _detectRoleFromId(String input) {
    final clean = input.trim().toUpperCase();
    if (clean.startsWith('CEO') || clean.startsWith('MD') || clean.startsWith('TA') || clean.contains('ADMIN') || clean.contains('DIRECTOR')) return 'CEO / MD';
    if (clean.startsWith('SH')) return 'Sales Head';
    if (clean.startsWith('SE') || clean.contains('SALES')) return 'Sales Executive';
    if (clean.startsWith('PH') || clean.contains('PROD')) return 'Production Head';
    if (clean.startsWith('FS')) return 'Floor Supervisor';
    if (clean.startsWith('FE')) return 'Floor Employee';
    if (clean.startsWith('PR') || clean.contains('PROC')) return 'Procurement Head';
    if (clean.startsWith('AH')) return 'Accounts Head';
    if (clean.startsWith('AE') || clean.contains('ACC')) return 'Accounts Executive';
    return selectedRole;
  }

  void _handleContinueToVerification() {
    final id = _idController.text.trim();
    final pwd = _passwordController.text.trim();

    if (id.isEmpty) {
      setState(() => _errorMessage = 'Please enter your Employee ID or Email');
      return;
    }
    if (pwd.isEmpty) {
      setState(() => _errorMessage = 'Please enter your Password');
      return;
    }

    setState(() => _errorMessage = null);

    final detectedRole = _detectRoleFromId(id);

    // Open Pinterest-style 6-Digit Google Authenticator Verification Bottom Sheet
    _showVerificationBottomSheet(context, detectedRole, id);
  }

  void _showVerificationBottomSheet(BuildContext context, String role, String userIdentifier) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return _GoogleAuthVerificationSheet(
          userIdentifier: userIdentifier,
          role: role,
          onVerified: () {
            Navigator.of(ctx).pop();
            widget.onLoginSuccess(role, userIdentifier);
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF07080B),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top Back button
              if (widget.onBack != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 20.0),
                  child: InkWell(
                    onTap: widget.onBack,
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.arrow_back_ios_new, size: 14, color: Color(0xFF94A3B8)),
                          const SizedBox(width: 8),
                          Text(
                            'Back to Welcome',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFF94A3B8),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

              const SizedBox(height: 8),

              // Brand Icon Badge
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppTheme.primaryTeal,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.primaryTeal.withValues(alpha: 0.4),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Center(
                  child: Text(
                    'BZ',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 20,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Title & Subtitle
              Text(
                'Sign In to BUSINZ',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Enter your credentials to access your department portal.',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13.5,
                  color: const Color(0xFF94A3B8),
                  height: 1.4,
                ),
              ),

              const SizedBox(height: 28),

              // Quick Role Presets (Horizontally scrollable chips)
              Text(
                'QUICK DEMO ACCESS',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF64748B),
                  letterSpacing: 0.8,
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _quickRoles.map((item) {
                  final isSelected = _idController.text == item['id'];
                  return ChoiceChip(
                    label: Text(item['title']!),
                    selected: isSelected,
                    selectedColor: AppTheme.primaryTeal.withValues(alpha: 0.25),
                    backgroundColor: const Color(0xFF13151D),
                    side: BorderSide(
                      color: isSelected ? AppTheme.primaryTeal : const Color(0xFF232634),
                    ),
                    labelStyle: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected ? const Color(0xFF38BDF8) : const Color(0xFF94A3B8),
                    ),
                    onSelected: (val) {
                      setState(() {
                        _idController.text = item['id']!;
                        selectedRole = item['role']!;
                      });
                    },
                  );
                }).toList(),
              ),

              const SizedBox(height: 24),

              // Error banner if any
              if (_errorMessage != null)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF450A0A),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF991B1B)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline, size: 16, color: Color(0xFFF87171)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12.5,
                            color: const Color(0xFFFCA5A5),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

              // Field 1: Employee ID or Email
              Text(
                'EMPLOYEE ID OR EMAIL',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF94A3B8),
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF12141C),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF242736)),
                ),
                child: TextField(
                  controller: _idController,
                  style: GoogleFonts.plusJakartaSans(
                    color: Colors.white,
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                  ),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.badge_outlined, size: 20, color: Color(0xFF64748B)),
                    hintText: 'e.g. TA-VRM001 or admin@businz.com',
                    hintStyle: GoogleFonts.plusJakartaSans(color: const Color(0xFF475569), fontSize: 13.5),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                ),
              ),

              const SizedBox(height: 18),

              // Field 2: Password
              Text(
                'PASSWORD',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF94A3B8),
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF12141C),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF242736)),
                ),
                child: TextField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  style: GoogleFonts.plusJakartaSans(
                    color: Colors.white,
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                  ),
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.lock_outline, size: 20, color: Color(0xFF64748B)),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        size: 20,
                        color: const Color(0xFF64748B),
                      ),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                    hintText: 'Enter your password',
                    hintStyle: GoogleFonts.plusJakartaSans(color: const Color(0xFF475569), fontSize: 13.5),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                ),
              ),

              const SizedBox(height: 32),

              // Submit Button: "Continue to Verification"
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _handleContinueToVerification,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF07080B),
                    elevation: 8,
                    shadowColor: Colors.white.withValues(alpha: 0.25),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(9999),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        'Continue to Verification',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.arrow_forward_rounded, size: 18),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // Security notice
              Center(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.shield_outlined, size: 14, color: Color(0xFF64748B)),
                    const SizedBox(width: 6),
                    Text(
                      'Secured with Google Authenticator (2FA)',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: const Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// =========================================================================
/// Google Authenticator 6-Digit Verification Sheet
/// Replicates the exact Pinterest reference design with 6 code input boxes,
/// active coral/orange border highlight, and auto-verification.
/// =========================================================================
class _GoogleAuthVerificationSheet extends StatefulWidget {
  final String userIdentifier;
  final String role;
  final VoidCallback onVerified;

  const _GoogleAuthVerificationSheet({
    required this.userIdentifier,
    required this.role,
    required this.onVerified,
  });

  @override
  State<_GoogleAuthVerificationSheet> createState() => _GoogleAuthVerificationSheetState();
}

class _GoogleAuthVerificationSheetState extends State<_GoogleAuthVerificationSheet> {
  // 6 digit controllers and focus nodes
  final List<TextEditingController> _controllers = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  int _activeBoxIndex = 0;
  bool _isVerifying = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Listen to focus changes to update active coral border
    for (int i = 0; i < 6; i++) {
      final index = i;
      _focusNodes[i].addListener(() {
        if (_focusNodes[index].hasFocus) {
          setState(() => _activeBoxIndex = index);
        }
      });
    }

    // Auto-focus first box after sheet opens
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNodes[0].requestFocus();
    });
  }

  @override
  void dispose() {
    for (var c in _controllers) {
      c.dispose();
    }
    for (var f in _focusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  void _onDigitChanged(int index, String val) {
    if (val.length > 1) {
      // If user pasted multiple characters
      final digits = val.replaceAll(RegExp(r'\D'), '');
      for (int i = 0; i < digits.length && (index + i) < 6; i++) {
        _controllers[index + i].text = digits[i];
      }
      final nextFocus = (index + digits.length).clamp(0, 5);
      _focusNodes[nextFocus].requestFocus();
      _checkAndAutoVerify();
      return;
    }

    if (val.isNotEmpty) {
      if (index < 5) {
        _focusNodes[index + 1].requestFocus();
      } else {
        _focusNodes[index].unfocus();
      }
    }
    _checkAndAutoVerify();
  }

  void _checkAndAutoVerify() {
    final enteredCode = _controllers.map((c) => c.text).join();
    if (enteredCode.length == 6) {
      _executeVerification(enteredCode);
    }
  }

  void _executeVerification(String code) async {
    setState(() {
      _isVerifying = true;
      _error = null;
    });

    // Simulated quick verification against Google Authenticator / Demo Code
    await Future.delayed(const Duration(milliseconds: 600));

    if (!mounted) return;

    // Accept valid 6-digit code or standard first-time demo code 123456
    if (code == '123456' || RegExp(r'^\d{6}$').hasMatch(code)) {
      widget.onVerified();
    } else {
      setState(() {
        _isVerifying = false;
        _error = 'Invalid verification code. Enter the 6 digits or use 123456.';
      });
    }
  }

  void _fillDemoCode() {
    const demo = '123456';
    for (int i = 0; i < 6; i++) {
      _controllers[i].text = demo[i];
    }
    _checkAndAutoVerify();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + bottomInset),
      decoration: const BoxDecoration(
        color: Color(0xFF14151B), // Dark slate modal matching Pinterest reference
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: Colors.black54,
            blurRadius: 30,
            offset: Offset(0, -6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle pill at top
          Center(
            child: Container(
              width: 38,
              height: 4.5,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: const Color(0xFF475569),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),

          // Title
          Text(
            "Let's verify your code",
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 8),

          // Subtitles
          Text(
            "We've required a 6-digit code from Google Authenticator.",
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 13.5,
              color: const Color(0xFF94A3B8),
              height: 1.4,
            ),
          ),
          Text(
            "It'll auto-verify once entered.",
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 13.5,
              color: const Color(0xFF94A3B8),
              height: 1.4,
            ),
          ),

          const SizedBox(height: 18),

          // First-Time Login Authenticator Setup Box
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF1E293B)),
            ),
            child: Row(
              children: [
                const Icon(Icons.security, size: 20, color: Color(0xFF38BDF8)),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'FIRST-TIME LOGIN SETUP',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF38BDF8),
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      RichText(
                        text: TextSpan(
                          text: 'Use Google Authenticator key ',
                          style: GoogleFonts.plusJakartaSans(fontSize: 11.5, color: const Color(0xFF94A3B8)),
                          children: [
                            TextSpan(
                              text: 'BUSINZ-8821',
                              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, color: Colors.white),
                            ),
                            const TextSpan(text: ' or default code '),
                            TextSpan(
                              text: '123456',
                              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, color: const Color(0xFF38BDF8)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // 6-DIGIT CODE INPUT BOXES (Pinterest Style with Coral/Orange active border)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(6, (index) {
              final isFocused = _activeBoxIndex == index && _focusNodes[index].hasFocus;
              final isFilled = _controllers[index].text.isNotEmpty;

              return Container(
                width: 46,
                height: 58,
                decoration: BoxDecoration(
                  color: const Color(0xFF1C1D26), // Dark box fill
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    // Coral/Orange accent active highlight (#FF5B37 / #F97316) from the Pinterest image!
                    color: isFocused
                        ? const Color(0xFFFF5B37)
                        : (isFilled ? const Color(0xFF334155) : const Color(0xFF262835)),
                    width: isFocused ? 2.2 : 1.2,
                  ),
                  boxShadow: isFocused
                      ? [
                          BoxShadow(
                            color: const Color(0xFFFF5B37).withValues(alpha: 0.35),
                            blurRadius: 10,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Center(
                  child: KeyboardListener(
                    focusNode: FocusNode(), // auxiliary for backspace detection
                    onKeyEvent: (event) {
                      if (event is KeyDownEvent && event.logicalKey == LogicalKeyboardKey.backspace) {
                        if (_controllers[index].text.isEmpty && index > 0) {
                          _focusNodes[index - 1].requestFocus();
                          _controllers[index - 1].clear();
                        }
                      }
                    },
                    child: TextField(
                      controller: _controllers[index],
                      focusNode: _focusNodes[index],
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      maxLength: 1,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                      decoration: const InputDecoration(
                        counterText: '',
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                      ),
                      onChanged: (val) => _onDigitChanged(index, val),
                    ),
                  ),
                ),
              );
            }),
          ),

          if (_error != null) ...[
            const SizedBox(height: 14),
            Text(
              _error!,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12.5,
                color: const Color(0xFFF87171),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],

          if (_isVerifying) ...[
            const SizedBox(height: 18),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFF5B37)),
              ),
            ),
          ],

          const SizedBox(height: 28),

          // Footer Action: Didn't receive the code? Resend / Auto-fill Demo
          GestureDetector(
            onTap: _fillDemoCode,
            behavior: HitTestBehavior.opaque,
            child: RichText(
              textAlign: TextAlign.center,
              text: TextSpan(
                text: "Didn't receive the code? ",
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13.5,
                  color: const Color(0xFF94A3B8),
                ),
                children: [
                  TextSpan(
                    text: 'Resend',
                    style: GoogleFonts.plusJakartaSans(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                  const TextSpan(text: '  •  '),
                  TextSpan(
                    text: 'Fill 123456',
                    style: GoogleFonts.plusJakartaSans(
                      color: const Color(0xFF38BDF8),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}
