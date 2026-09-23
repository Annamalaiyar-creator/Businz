import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class WelcomeView extends StatelessWidget {
  final VoidCallback onGetStarted;
  final VoidCallback onLogin;

  const WelcomeView({
    super.key,
    required this.onGetStarted,
    required this.onLogin,
  });

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: const Color(0xFF07080B),
      body: Stack(
        children: [
          // ================= TOP GLOWING CELESTIAL ARC =================
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: size.height * 0.46,
            child: CustomPaint(
              painter: _CelestialArcPainter(),
            ),
          ),

          // ================= CONTENT =================
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 16.0),
              child: Column(
                children: [
                  const Spacer(flex: 3),

                  // Stylized 5-person entity emblem matching the reference
                  CustomPaint(
                    size: const Size(54, 46),
                    painter: _EmblemPainter(),
                  ),
                  const SizedBox(height: 28),

                  // Headline
                  Text(
                    'Welcome to BUSINZ',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: -0.5,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Subtitle
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 300),
                    child: Text(
                      'Starting today, your AI operations assistant saves you 2 hours daily.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w400,
                        color: Colors.white.withValues(alpha: 0.72),
                        height: 1.45,
                      ),
                    ),
                  ),

                  const Spacer(flex: 2),

                  // Primary Pill Button: "Get Started"
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: ElevatedButton(
                      onPressed: onGetStarted,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF07080B),
                        elevation: 12,
                        shadowColor: Colors.white.withValues(alpha: 0.4),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(9999),
                        ),
                      ),
                      child: Text(
                        'Get Started',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Secondary Action: "Already have an account? Log in"
                  GestureDetector(
                    onTap: onLogin,
                    behavior: HitTestBehavior.opaque,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4.0),
                      child: RichText(
                        textAlign: TextAlign.center,
                        text: TextSpan(
                          text: 'Already have an account? ',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 14.5,
                            color: Colors.white.withValues(alpha: 0.65),
                          ),
                          children: [
                            TextSpan(
                              text: 'Log in',
                              style: GoogleFonts.plusJakartaSans(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),

                  // Legal Disclaimer
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 290),
                    child: RichText(
                      textAlign: TextAlign.center,
                      text: TextSpan(
                        text: 'By tapping Get Started, I agree with the ',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11.5,
                          color: Colors.white.withValues(alpha: 0.42),
                          height: 1.5,
                        ),
                        children: [
                          TextSpan(
                            text: 'Terms of Service',
                            style: GoogleFonts.plusJakartaSans(
                              color: Colors.white.withValues(alpha: 0.78),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const TextSpan(text: ' and '),
                          TextSpan(
                            text: 'Privacy Policy',
                            style: GoogleFonts.plusJakartaSans(
                              color: Colors.white.withValues(alpha: 0.78),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const TextSpan(text: '.'),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Custom painter for the atmospheric cosmic arc
class _CelestialArcPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height * 0.52);

    // 1. Deep cosmic blue glow blob
    final bluePaint = Paint()
      ..shader = RadialGradient(
        center: Alignment.topCenter,
        radius: 0.85,
        colors: [
          const Color(0xFF3B82F6).withValues(alpha: 0.85),
          const Color(0xFF1D4ED8).withValues(alpha: 0.5),
          const Color(0xFF0F172A).withValues(alpha: 0.1),
          Colors.transparent,
        ],
        stops: const [0.0, 0.45, 0.75, 1.0],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height * 0.75))
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 36);

    canvas.drawOval(
      Rect.fromCenter(center: Offset(center.dx, center.dy - 35), width: size.width * 0.82, height: size.height * 0.55),
      bluePaint,
    );

    // 2. Glowing celestial rim arc
    final arcRect = Rect.fromCenter(
      center: Offset(center.dx, center.dy + 30),
      width: size.width * 0.9,
      height: size.height * 0.7,
    );

    // Ambient golden/ivory wide halo
    final haloPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 16
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18)
      ..shader = SweepGradient(
        center: Alignment.topCenter,
        colors: [
          const Color(0xFFB45309).withValues(alpha: 0.2),
          const Color(0xFFF59E0B).withValues(alpha: 0.7),
          const Color(0xFFFEF08A).withValues(alpha: 0.95),
          Colors.white,
          const Color(0xFFFEF08A).withValues(alpha: 0.95),
          const Color(0xFFF59E0B).withValues(alpha: 0.7),
          const Color(0xFFB45309).withValues(alpha: 0.2),
        ],
      ).createShader(arcRect);

    canvas.drawArc(arcRect, 3.3, 2.7, false, haloPaint);

    // Crisp inner rim stroke
    final crispPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.8
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3)
      ..shader = LinearGradient(
        colors: [
          const Color(0xFFB45309).withValues(alpha: 0.3),
          const Color(0xFFF59E0B).withValues(alpha: 0.8),
          Colors.white,
          const Color(0xFFF59E0B).withValues(alpha: 0.8),
          const Color(0xFFB45309).withValues(alpha: 0.3),
        ],
      ).createShader(arcRect);

    canvas.drawArc(arcRect, 3.3, 2.7, false, crispPaint);

    // 3. Dark planet body masking the lower center
    final maskPaint = Paint()..color = const Color(0xFF07080B);
    final maskPath = Path()
      ..addArc(arcRect, 3.3, 2.7)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(maskPath, maskPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Custom painter for the stylized 5-person entity emblem
class _EmblemPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final whitePaint = Paint()..color = Colors.white;

    // 5 Heads
    canvas.drawCircle(const Offset(8, 11), 3.2, whitePaint);
    canvas.drawCircle(const Offset(17, 8), 3.4, whitePaint);
    canvas.drawCircle(const Offset(27, 6), 3.6, whitePaint);
    canvas.drawCircle(const Offset(37, 8), 3.4, whitePaint);
    canvas.drawCircle(const Offset(46, 11), 3.2, whitePaint);

    // Curved shoulder bar
    final barPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 3.2
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path()
      ..moveTo(8, 16)
      ..quadraticBezierTo(27, 10, 46, 16);
    canvas.drawPath(path, barPaint);

    // 4 Vertical Pillars
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(11.5, 19, 4.5, 19), const Radius.circular(2.25)), whitePaint);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(21, 17, 4.5, 21), const Radius.circular(2.25)), whitePaint);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(28.5, 17, 4.5, 21), const Radius.circular(2.25)), whitePaint);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(38, 19, 4.5, 19), const Radius.circular(2.25)), whitePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
