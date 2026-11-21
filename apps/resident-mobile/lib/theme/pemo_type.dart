import 'package:flutter/material.dart';
import 'pemo_colors.dart';

/// Typography from PEMO_UI_Design_System_v2.0 section 4.
///
/// Libre Franklin for Latin, Noto Sans TC for Traditional Chinese. This REVERSES
/// design system v1.1, which recorded "Inter stands" and marked the export a
/// deviation. The Product Owner's export ruling of 2026-08-13 reversed that:
/// Libre Franklin is correct and Inter is superseded. v2.0 change log, inversion 1.
abstract final class PemoType {
  static const latin = 'Libre Franklin';
  static const hant = 'Noto Sans TC';

  /// Identifiers only. Never body copy, never safety instructions, never
  /// Traditional Chinese. Design system v2.0 section 4.3.
  static const mono = 'IBM Plex Mono';

  static const fallback = <String>[hant, 'PingFang TC', 'Microsoft JhengHei', 'sans-serif'];

  /// Latin and Traditional Chinese are set at the SAME numeric weight within a
  /// text style. A mismatch reads as accidental emphasis on the Latin half, and
  /// it shows up worst in bilingual safety copy. v2.0 section 4.1.
  static TextTheme textTheme() => const TextTheme(
        displayLarge: TextStyle(fontFamily: latin, fontFamilyFallback: fallback, fontSize: 28, fontWeight: FontWeight.w700, height: 1.20),
        headlineLarge: TextStyle(fontFamily: latin, fontFamilyFallback: fallback, fontSize: 24, fontWeight: FontWeight.w700, height: 1.25),
        titleLarge: TextStyle(fontFamily: latin, fontFamilyFallback: fallback, fontSize: 20, fontWeight: FontWeight.w600, height: 1.30),
        titleMedium: TextStyle(fontFamily: latin, fontFamilyFallback: fallback, fontSize: 18, fontWeight: FontWeight.w600, height: 1.35),
        bodyLarge: TextStyle(fontFamily: latin, fontFamilyFallback: fallback, fontSize: 17, fontWeight: FontWeight.w400, height: 1.55),
        bodyMedium: TextStyle(fontFamily: latin, fontFamilyFallback: fallback, fontSize: 16, fontWeight: FontWeight.w400, height: 1.50),
        bodySmall: TextStyle(fontFamily: latin, fontFamilyFallback: fallback, fontSize: 14, fontWeight: FontWeight.w400, height: 1.45),
        labelLarge: TextStyle(fontFamily: latin, fontFamilyFallback: fallback, fontSize: 15, fontWeight: FontWeight.w600, height: 1.30),
        labelSmall: TextStyle(fontFamily: latin, fontFamilyFallback: fallback, fontSize: 12, fontWeight: FontWeight.w500, height: 1.40),
      );

  /// Case references, pass references. Identifiers a resident reads character by
  /// character or quotes to the office. Never prose.
  static const identifier = TextStyle(fontFamily: mono, fontSize: 13, fontWeight: FontWeight.w500, color: PemoColors.neutral700);
}
