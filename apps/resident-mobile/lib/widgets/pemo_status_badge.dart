import 'package:flutter/material.dart';

import '../theme/pemo_theme.dart';
import '../theme/severity_tokens.g.dart';

/// Severity is NEVER communicated by colour alone.
///
/// Every badge carries an icon, a visible text label and a semantic label.
/// Design system section 3.1 and section 15. In the one pairing the palette
/// cannot separate — critical strong beside brand strong on a light surface —
/// this icon and label is the PRIMARY means of distinction, not a backstop.
class PemoStatusBadge extends StatelessWidget {
  const PemoStatusBadge({
    super.key,
    required this.severity,
    required this.localeCode,
    this.badgeKey,
  });

  final Severity severity;
  final String localeCode;

  /// Explicit key so tests can read the rendered fill off THIS box.
  /// find.byType(ColoredBox) is ambiguous: Scaffold uses ColoredBox internally,
  /// so an unkeyed finder would make the offline-never-green assertion pass
  /// while asserting nothing.
  final Key? badgeKey;

  static IconData iconFor(Severity s) => switch (s) {
        Severity.normal => Icons.check_circle_outline,
        Severity.information => Icons.info_outline,
        Severity.advisory => Icons.notifications_active_outlined,
        Severity.warning => Icons.warning_amber_outlined,
        Severity.critical => Icons.dangerous_outlined,
        Severity.offline => Icons.cloud_off_outlined,
        Severity.unknown => Icons.help_outline,
      };

  String label() {
    final t = SeverityTokens.of(severity);
    return localeCode.startsWith('zh') ? t.labelZhHant : t.labelEn;
  }

  @override
  Widget build(BuildContext context) {
    final t = SeverityTokens.of(severity);
    final text = label();
    return Semantics(
      container: true,
      // One clean node carrying the label. Without this the child Text produces
      // a second node and the badge's own label is not addressable.
      excludeSemantics: true,
      label: text,
      child: DecoratedBox(
        key: badgeKey ?? Key('severity-badge-${severity.wireValue}'),
        decoration: BoxDecoration(
          color: t.surface,
          border: Border.all(color: t.border, width: 1.5),
          borderRadius: BorderRadius.circular(PemoTheme.radiusSmall),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(iconFor(severity), size: 18, color: t.strong),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  text,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(color: t.strong),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
