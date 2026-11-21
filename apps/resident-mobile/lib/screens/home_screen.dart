import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/payloads.dart';
import '../state/providers.dart';
import '../theme/pemo_colors.dart';
import '../widgets/pemo_widgets.dart';
import '../widgets/screen_state_view.dart';

/// MOB-02 Home. Design system section 10.1 hierarchy:
/// estate/unit context, urgent message only when present, calm Home Safety
/// summary, open cases, notices, quick services.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeCodeProvider);
    final async = ref.watch(homeProvider);
    final t = AppLocalizations.of(context)!;
    final tt = Theme.of(context).textTheme;

    return AsyncStateView<HomePayload>(
      localeCode: locale,
      async: async,
      builder: (context, d, {required bool stale}) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('${d.greeting.forLocale(locale)}, ${d.residentName}', style: tt.headlineLarge),
          PemoUnitSwitcher(options: d.unitSwitcher, localeCode: locale),
          const SizedBox(height: 16),
          if (d.safety != null) ...[
            // monitoringCoverage is not a severity. When coverage is none the
            // severity is information and the client MUST read both fields:
            // severity alone is insufficient to render this state.
            if (d.safety!.notMonitored)
              PemoEmptyState(
                message: t.notMonitored,
              ),
            PemoSafetyBanner(
              safety: d.safety!,
              localeCode: locale,
              freshnessOverride: stale ? d.safety!.freshness : null,
            ),
          ],
          if (d.openCase != null) ...[
            const SizedBox(height: 16),
            Text(t.sectionOpenCase, style: tt.titleMedium),
            const SizedBox(height: 8),
            PemoCaseStatus(openCase: d.openCase!, localeCode: locale),
          ],
          if (d.notices.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(t.sectionNotices, style: tt.titleMedium),
            const SizedBox(height: 8),
            for (final n in d.notices)
              Padding(padding: const EdgeInsets.only(bottom: 10), child: PemoNoticeCard(notice: n, localeCode: locale)),
          ],
          if (d.quickServices.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(t.sectionQuickServices, style: tt.titleMedium),
            const SizedBox(height: 8),
            for (final s in d.quickServices)
              ListTile(
                contentPadding: EdgeInsets.zero,
                minVerticalPadding: 12,
                title: Text(s.label.forLocale(locale), style: tt.labelLarge),
                subtitle: Text(
                  s.isAvailable
                      ? s.state.forLocale(locale)
                      : '${s.state.forLocale(locale)} — ${s.reason?.forLocale(locale) ?? ''}',
                  style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage),
                ),
                enabled: s.isAvailable,
              ),
          ],
        ],
      ),
    );
  }
}
