import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/payloads.dart';
import '../state/providers.dart';
import '../theme/pemo_colors.dart';
import '../theme/severity_tokens.g.dart';
import '../widgets/pemo_widgets.dart';
import '../widgets/screen_state_view.dart';

/// MOB-08 Safety overview.
class SafetyOverviewScreen extends ConsumerWidget {
  const SafetyOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeCodeProvider);
    final async = ref.watch(safetyOverviewProvider);
    final t = AppLocalizations.of(context)!;
    final tt = Theme.of(context).textTheme;

    return AsyncStateView<SafetyOverviewPayload>(
      localeCode: locale,
      async: async,
      builder: (context, d, {required bool stale}) {
        final safety = d.safety;
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(t.titleHomeSafety, style: tt.headlineLarge),
            if (d.unit != null)
              Text(d.unit!.displayLine.forLocale(locale),
                  style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage)),
            const SizedBox(height: 16),
            if (safety != null) ...[
              // Unknown gets its own rendering, distinct from offline. The two
              // are different statements to a resident.
              if (safety.severity == Severity.unknown) ...[
                PemoUnknownState(localeCode: locale),
                const SizedBox(height: 12),
              ],
              if (safety.notMonitored) ...[
                PemoEmptyState(
                  message: t.notMonitoredDetail,
                ),
                const SizedBox(height: 12),
              ],
              PemoSafetyBanner(safety: safety, localeCode: locale),
            ],
            if (d.installedServices.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(t.sectionInstalledServices, style: tt.titleMedium),
              const SizedBox(height: 8),
              for (final s in d.installedServices)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: PemoColors.white,
                      border: Border.all(color: PemoColors.neutral200),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(s.name.forLocale(locale), style: tt.labelLarge),
                          Text(s.location.forLocale(locale),
                              style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage)),
                          Text(s.state.forLocale(locale), style: tt.bodySmall),
                        ]),
                      ),
                      PemoStatusBadge(
                        severity: s.severity,
                        localeCode: locale,
                        badgeKey: Key('installed-service-badge-${s.severity.wireValue}'),
                      ),
                    ]),
                  ),
                ),
            ],
            if (d.installedServicesNote != null) ...[
              const SizedBox(height: 4),
              Text(d.installedServicesNote!.forLocale(locale),
                  style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage)),
            ],
            if (d.recentEvents.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text(t.sectionRecentEvents, style: tt.titleMedium),
              const SizedBox(height: 8),
              for (final e in d.recentEvents)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    PemoStatusBadge(
                      severity: e.severity,
                      localeCode: locale,
                      badgeKey: Key('recent-event-badge-${e.eventId}'),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text(e.title.forLocale(locale), style: tt.bodySmall)),
                  ]),
                ),
            ],
          ],
        );
      },
    );
  }
}
