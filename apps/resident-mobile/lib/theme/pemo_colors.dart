import 'package:flutter/painting.dart';

/// Brand and neutral roles from PEMO_UI_Design_System_v2.0 section 2.
///
/// Taken from the design system, never from the export's pixels. The export is
/// the design AUTHORITY, not correctness: v2.0 section 2.2 records that
/// #6E7480 measures 4.34:1 on the #F5F6F9 page ground and fails AA for normal
/// text, and both exports use it in exactly that position.
///
/// Severity colours are NOT here. They are generated from severity.json into
/// severity_tokens.g.dart. Design system section 19 forbids one-off severity colours.
abstract final class PemoColors {
  // 2.1 Brand
  static const brandPrimary = Color(0xFF5B4BC4);
  static const brandDeep = Color(0xFF42349B);
  static const brandPrimaryTint = Color(0xFFEFEDFA);
  static const brandTintBorder = Color(0xFFDED9F6);

  /// On-brand accent. Icon and indicator dot on a brand ground ONLY.
  /// 2.21:1 on white: never text on a light surface.
  static const brandAccent = Color(0xFFF59A08);

  // 2.4 On-brand text tints
  static const onBrandMuted = Color(0xFFE4DBFD);
  static const onDeepMuted = Color(0xFFDCD3F8);
  static const onDeepSubtle = Color(0xFFCFC0FB);

  // 2.2 Neutrals
  static const neutral950 = Color(0xFF14161C); // primary text
  static const neutral900 = Color(0xFF2A2E38);
  static const neutral800 = Color(0xFF3A404E);
  static const neutral700 = Color(0xFF4A5060);
  static const neutral600 = Color(0xFF5B6172); // secondary text on the page ground
  static const neutral500 = Color(0xFF6E7480); // WHITE GROUNDS ONLY. See below.
  static const neutral400 = Color(0xFF9AA0AE);
  static const neutral300 = Color(0xFFD6DAE4);
  static const neutral200 = Color(0xFFE1E4EC);
  static const neutral150 = Color(0xFFEDEFF4);
  static const neutral100 = Color(0xFFF0F2F6);
  static const neutral50 = Color(0xFFF5F6F9); // page background
  static const neutral25 = Color(0xFFFAFBFD);
  static const white = Color(0xFFFFFFFF);

  /// Secondary text on [neutral50]. Use this, NOT [neutral500].
  ///
  /// neutral500 measures 4.34:1 on neutral50 and fails WCAG 2.2 AA for normal
  /// text; it passes on white at 4.69:1. Design system v2.0 section 2.2.
  static const secondaryTextOnPage = neutral600;

  /// Brand text or icon sharing a light surface with a critical severity strong.
  ///
  /// Use brandPrimary, NOT brandDeep. Against the re-banded critical #85110F,
  /// brandDeep measures 1.05:1 (dL* 1.46) and brandPrimary 1.56:1 (dL* 12.08):
  /// critical moved into the band brandDeep occupies. Luminance separation is
  /// unavailable here, so section 3.1's icon-and-label is the PRIMARY means of
  /// distinction, not a backstop. Design system v2.0 section 15.3.
  static const brandBesideCritical = brandPrimary;
}
