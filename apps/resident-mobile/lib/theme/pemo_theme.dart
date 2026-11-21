import 'package:flutter/material.dart';
import 'pemo_colors.dart';
import 'pemo_type.dart';

/// Design system v2.0 section 13.
///
/// NOTE: section 13 is `Proposed`, not `Accepted`. Only sections 3 and 3.1 are
/// Accepted. This theme is built to guidance that has not been approved, and it
/// should be read as such rather than as settled architecture. UI-007-ST step 1
/// report section 11.
abstract final class PemoTheme {
  static const radiusSmall = 5.0;
  static const radiusControl = 8.0;
  static const radiusPanel = 10.0;
  static const radiusDialog = 12.0;
  static const radiusCard = 16.0;

  /// Minimum interactive target. 48 preferred, never below 44.
  /// Design system sections 6.3 and 15.
  static const minTouchTarget = 48.0;
  static const absoluteMinTouchTarget = 44.0;

  static ThemeData light() {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: PemoColors.neutral50,
      colorScheme: base.colorScheme.copyWith(
        primary: PemoColors.brandPrimary,
        onPrimary: PemoColors.white,
        secondary: PemoColors.brandDeep,
        surface: PemoColors.white,
        onSurface: PemoColors.neutral950,
        outline: PemoColors.neutral200,
      ),
      textTheme: PemoType.textTheme().apply(
        bodyColor: PemoColors.neutral950,
        displayColor: PemoColors.neutral950,
      ),
      dividerColor: PemoColors.neutral200,
      // Material's default Switch is 40px tall, below the 44px floor in
      // design system 6.3 and 15. Padded raises the tap target to 48.
      switchTheme: const SwitchThemeData(materialTapTargetSize: MaterialTapTargetSize.padded),
      checkboxTheme: const CheckboxThemeData(materialTapTargetSize: MaterialTapTargetSize.padded),
      radioTheme: const RadioThemeData(materialTapTargetSize: MaterialTapTargetSize.padded),
      cardTheme: const CardThemeData(
        color: PemoColors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
      ),
    );
  }
}
