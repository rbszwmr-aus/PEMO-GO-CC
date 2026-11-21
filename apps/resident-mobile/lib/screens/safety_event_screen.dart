import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/payloads.dart';
import '../state/providers.dart';
import '../theme/pemo_colors.dart';
import '../widgets/pemo_widgets.dart';
import '../widgets/screen_state_view.dart';

/// MOB-09 Safety-event detail.
///
/// Hierarchy fixed by design system section 10.2: severity label and icon,
/// plain-language event name, time and location, primary action instruction,
/// actions, latest management update, timeline, disclaimer.
class SafetyEventScreen extends ConsumerWidget {
  const SafetyEventScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeCodeProvider);
    final async = ref.watch(safetyEventProvider);
    final ack = ref.watch(acknowledgeProvider);
    final t = AppLocalizations.of(context)!;
    final tt = Theme.of(context).textTheme;

    return AsyncStateView<SafetyEventPayload>(
      localeCode: locale,
      async: async,
      builder: (context, d, {required bool stale}) {
        final e = d.event;
        if (e == null) {
          return PemoEmptyState(message: t.stateNoEvent);
        }
        final acknowledged = ack.done || (e.acknowledgement?.acknowledged ?? false);
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            PemoStatusBadge(
              severity: e.severity,
              localeCode: locale,
              badgeKey: const Key('event-severity-badge'),
            ),
            const SizedBox(height: 12),
            Text(e.title.forLocale(locale), style: tt.headlineLarge),
            const SizedBox(height: 6),
            if (e.location != null)
              Text(e.location!.forLocale(locale),
                  style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage)),
            if (e.correctionOf != null) ...[
              const SizedBox(height: 8),
              Text(
                t.correctionLinked,
                key: const Key('correction-link'),
                style: tt.bodySmall,
              ),
            ],
            if (e.instruction != null) ...[
              const SizedBox(height: 14),
              Text(e.instruction!.forLocale(locale), style: tt.bodyLarge),
            ],
            const SizedBox(height: 16),
            Wrap(spacing: 10, runSpacing: 10, children: [
              for (final a in e.actions)
                PemoPrimaryAction(
                  label: a.label.forLocale(locale),
                  isPrimary: a.kind == 'primary',
                  onPressed: () {},
                ),
              PemoPrimaryAction(
                key: const Key('acknowledge-action'),
                label: acknowledged ? t.actionAcknowledged : t.actionAcknowledge,
                inFlight: ack.inFlight,
                // Idempotent from the UI side: null once done, so a double tap
                // cannot produce a second effect.
                onPressed: acknowledged ? null : () => ref.read(acknowledgeProvider.notifier).acknowledge(e.eventId),
              ),
            ]),
            if (e.managementUpdatePending) ...[
              const SizedBox(height: 16),
              Text(
                t.managementUpdatePending,
                key: const Key('management-update-pending'),
                style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage),
              ),
            ],
            if (e.managementUpdates.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text(t.sectionManagementUpdates, style: tt.titleMedium),
              const SizedBox(height: 8),
              PemoTimeline(updates: e.managementUpdates, localeCode: locale),
            ],
            PemoDisclaimer(disclaimer: e.disclaimer, localeCode: locale),
          ],
        );
      },
    );
  }
}
