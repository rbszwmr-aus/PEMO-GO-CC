import 'package:flutter/material.dart';

import '../data/models/models.dart';
import '../l10n/app_localizations.dart';
import '../theme/pemo_colors.dart';
import '../theme/pemo_theme.dart';
import '../theme/pemo_type.dart';
import '../theme/severity_tokens.g.dart';
import 'pemo_status_badge.dart';

export 'pemo_status_badge.dart';

/// The statutory disclaimer, rendered VERBATIM from server-supplied data.
///
/// Never hardcoded, never abbreviated, never translated in the client. A test in
/// test/rules/ fails the build if this text appears as a Dart literal anywhere
/// in lib/ or in either ARB file: asserting the string matches is easy,
/// asserting it cannot be hardcoded is what keeps it matching.
class PemoDisclaimer extends StatelessWidget {
  const PemoDisclaimer({super.key, required this.disclaimer, required this.localeCode});
  final Localized? disclaimer;
  final String localeCode;

  @override
  Widget build(BuildContext context) {
    final d = disclaimer;
    if (d == null) return const SizedBox.shrink();
    return Semantics(
      container: true,
      child: Padding(
        key: const Key('statutory-disclaimer'),
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Text(
          d.forLocale(localeCode),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage),
        ),
      ),
    );
  }
}

/// Calm normal. Design system section 10.1 requires a small icon and label,
/// never a large green card.
///
/// v2.0's monotone ladder makes this structural: `normal` holds the palest
/// surface of the seven by construction, so a loud normal is a token violation
/// rather than a matter of taste.
class PemoSafetyBanner extends StatelessWidget {
  const PemoSafetyBanner({super.key, required this.safety, required this.localeCode, this.freshnessOverride});
  final SafetySummary safety;
  final String localeCode;
  final Freshness? freshnessOverride;

  @override
  Widget build(BuildContext context) {
    final f = freshnessOverride ?? safety.freshness;
    final tt = Theme.of(context).textTheme;
    return Container(
      key: const Key('safety-banner'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: PemoColors.white,
        border: Border.all(color: PemoColors.neutral200),
        borderRadius: BorderRadius.circular(PemoTheme.radiusCard),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            PemoStatusBadge(
              severity: safety.severity,
              localeCode: localeCode,
              badgeKey: const Key('banner-severity-badge'),
            ),
            const Spacer(),
          ]),
          const SizedBox(height: 12),
          Text(safety.headline.forLocale(localeCode), style: tt.titleMedium),
          const SizedBox(height: 6),
          Text(safety.detail.forLocale(localeCode),
              style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage)),
          if (f != null) ...[
            const SizedBox(height: 10),
            PemoDataAge(freshness: f, observedAt: safety.observedAt, localeCode: localeCode),
          ],
          PemoDisclaimer(disclaimer: safety.disclaimer, localeCode: localeCode),
        ],
      ),
    );
  }
}

/// Data age as the SERVER derived it. Never recomputed here.
class PemoDataAge extends StatelessWidget {
  const PemoDataAge({super.key, required this.freshness, required this.observedAt, required this.localeCode});
  final Freshness freshness;
  final DateTime? observedAt;
  final String localeCode;

  static String humanAge(int seconds, String localeCode) {
    final zh = localeCode.startsWith('zh');
    if (seconds < 60) return zh ? '$seconds 秒前' : '$seconds seconds ago';
    final m = seconds ~/ 60;
    if (m < 60) return zh ? '$m 分鐘前' : '$m minutes ago';
    final h = m ~/ 60;
    if (h < 24) return zh ? '$h 小時前' : '$h hours ago';
    final d = h ~/ 24;
    return zh ? '$d 天前' : '$d days ago';
  }

  @override
  Widget build(BuildContext context) {
    final zh = localeCode.startsWith('zh');
    final stale = freshness.isStale;
    final tokens = SeverityTokens.of(stale ? Severity.offline : Severity.normal);
    final text = stale
        ? (zh ? '此資料並非最新，更新於${humanAge(freshness.ageSeconds, localeCode)}。請勿依賴此資料判斷安全狀況。'
              : 'This is not current. Last reported ${humanAge(freshness.ageSeconds, localeCode)}. Do not rely on it to judge safety.')
        : (zh ? '更新於${humanAge(freshness.ageSeconds, localeCode)}'
              : 'Updated ${humanAge(freshness.ageSeconds, localeCode)}');
    return Semantics(
      container: true,
      label: text,
      child: Row(key: const Key('data-age'), children: [
        Icon(stale ? Icons.schedule : Icons.check_circle_outline, size: 14, color: tokens.strong),
        const SizedBox(width: 6),
        Flexible(
          child: Text(text,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: stale ? tokens.strong : PemoColors.secondaryTextOnPage,
                  )),
        ),
      ]),
    );
  }
}

/// A safety action. Never labelled OK or Confirm. Design system section 8.1.
class PemoPrimaryAction extends StatelessWidget {
  const PemoPrimaryAction({super.key, required this.label, required this.onPressed, this.inFlight = false, this.isPrimary = true});
  final String label;
  final VoidCallback? onPressed;
  final bool inFlight;
  final bool isPrimary;

  @override
  Widget build(BuildContext context) {
    final child = inFlight
        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: PemoColors.white))
        : Text(label);
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: PemoTheme.minTouchTarget, minWidth: PemoTheme.minTouchTarget),
      child: isPrimary
          ? FilledButton(
              onPressed: inFlight ? null : onPressed,
              style: FilledButton.styleFrom(
                backgroundColor: PemoColors.brandPrimary,
                foregroundColor: PemoColors.white,
                minimumSize: const Size(0, PemoTheme.minTouchTarget),
              ),
              child: child)
          : OutlinedButton(
              onPressed: inFlight ? null : onPressed,
              style: OutlinedButton.styleFrom(
                foregroundColor: PemoColors.brandBesideCritical,
                minimumSize: const Size(0, PemoTheme.minTouchTarget),
              ),
              child: child),
    );
  }
}

class PemoEmptyState extends StatelessWidget {
  const PemoEmptyState({super.key, required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Padding(
        key: const Key('empty-state'),
        padding: const EdgeInsets.all(24),
        child: Text(message, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: PemoColors.secondaryTextOnPage)),
      );
}

class PemoErrorState extends StatelessWidget {
  const PemoErrorState({super.key, required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Padding(
        key: const Key('error-state'),
        padding: const EdgeInsets.all(24),
        child: Row(children: [
          Icon(Icons.error_outline, color: SeverityTokens.of(Severity.warning).strong),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: Theme.of(context).textTheme.bodyMedium)),
        ]),
      );
}

/// The CLIENT has no connection.
///
/// Distinct from [PemoUnknownState]: "the service is not reporting" and "we
/// cannot determine the condition" are different messages to a resident, which
/// is why they are two tokens and not one. v2.0 places their surfaces 18.48 L*
/// apart precisely so a resident can tell them apart before reading.
class PemoOfflineState extends StatelessWidget {
  const PemoOfflineState({super.key, required this.localeCode, this.lastObservedAt});
  final String localeCode;
  final DateTime? lastObservedAt;

  @override
  Widget build(BuildContext context) {
    final s = AppLocalizations.of(context)!;
    final t = SeverityTokens.of(Severity.offline);
    final text = s.clientOffline;
    return Container(
      key: const Key('client-offline-state'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: t.surface,
        border: Border.all(color: t.border, width: 1.5),
        borderRadius: BorderRadius.circular(PemoTheme.radiusPanel),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.wifi_off_outlined, color: t.strong, size: 20),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.strong))),
      ]),
    );
  }
}

/// The condition cannot be determined. Never rendered as offline, never normal.
class PemoUnknownState extends StatelessWidget {
  const PemoUnknownState({super.key, required this.localeCode});
  final String localeCode;

  @override
  Widget build(BuildContext context) {
    final s = AppLocalizations.of(context)!;
    final t = SeverityTokens.of(Severity.unknown);
    final text = s.conditionUnknown;
    return Container(
      key: const Key('unknown-state'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: t.surface,
        border: Border.all(color: t.border, width: 1.5),
        borderRadius: BorderRadius.circular(PemoTheme.radiusPanel),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.help_outline, color: t.strong, size: 20),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.strong))),
      ]),
    );
  }
}

class PemoNoticeCard extends StatelessWidget {
  const PemoNoticeCard({super.key, required this.notice, required this.localeCode});
  final Notice notice;
  final String localeCode;
  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: PemoColors.white,
        border: Border.all(color: PemoColors.neutral200),
        borderRadius: BorderRadius.circular(PemoTheme.radiusPanel),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        PemoStatusBadge(severity: notice.severity, localeCode: localeCode),
        const SizedBox(height: 8),
        Text(notice.title.forLocale(localeCode), style: tt.labelLarge),
        const SizedBox(height: 4),
        Text(notice.summary.forLocale(localeCode), style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage)),
      ]),
    );
  }
}

class PemoCaseStatus extends StatelessWidget {
  const PemoCaseStatus({super.key, required this.openCase, required this.localeCode});
  final OpenCase openCase;
  final String localeCode;
  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: PemoColors.white,
        border: Border.all(color: PemoColors.neutral200),
        borderRadius: BorderRadius.circular(PemoTheme.radiusPanel),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Identifier: monospace, read character by character. Section 4.3.
        Text(openCase.caseReference, key: const Key('case-reference'), style: PemoType.identifier),
        const SizedBox(height: 6),
        Text(openCase.title.forLocale(localeCode), style: tt.labelLarge),
        const SizedBox(height: 4),
        Text(openCase.status.forLocale(localeCode), style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage)),
      ]),
    );
  }
}

class PemoUnitSwitcher extends StatelessWidget {
  const PemoUnitSwitcher({super.key, required this.options, required this.localeCode, this.onChanged});
  final List<UnitOption> options;
  final String localeCode;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    if (options.isEmpty) return const SizedBox.shrink();
    final current = options.firstWhere((o) => o.isCurrent, orElse: () => options.first);
    return Semantics(
      button: true,
      label: current.displayLine.forLocale(localeCode),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: PemoTheme.minTouchTarget),
        child: InkWell(
          key: const Key('unit-switcher'),
          onTap: options.length > 1 ? () => onChanged?.call(current.unitId) : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(children: [
              Flexible(
                child: Text(current.displayLine.forLocale(localeCode),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage)),
              ),
              if (options.length > 1)
                const Icon(Icons.expand_more, size: 18, color: PemoColors.secondaryTextOnPage),
            ]),
          ),
        ),
      ),
    );
  }
}

class PemoTimeline extends StatelessWidget {
  const PemoTimeline({super.key, required this.updates, required this.localeCode});
  final List<ManagementUpdate> updates;
  final String localeCode;
  @override
  Widget build(BuildContext context) {
    if (updates.isEmpty) return const SizedBox.shrink();
    final tt = Theme.of(context).textTheme;
    return Column(
      key: const Key('management-timeline'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final u in updates)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Padding(
                padding: EdgeInsets.only(top: 6, right: 10),
                child: Icon(Icons.circle, size: 8, color: PemoColors.brandPrimary),
              ),
              Expanded(child: Text(u.body.forLocale(localeCode), style: tt.bodySmall)),
            ]),
          ),
      ],
    );
  }
}
