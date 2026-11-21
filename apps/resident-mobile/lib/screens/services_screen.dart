import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/payloads.dart';
import '../state/providers.dart';
import '../theme/pemo_colors.dart';
import '../widgets/pemo_widgets.dart';
import '../widgets/screen_state_view.dart';

/// MOB-03 Services, with Help desk.
///
/// Coming-soon services are shown greyed WITH A STATED REASON, never as failing
/// buttons: a control that looks live and does nothing is worse than one that
/// explains itself.
class ServicesScreen extends ConsumerWidget {
  const ServicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeCodeProvider);
    final async = ref.watch(servicesProvider);
    final t = AppLocalizations.of(context)!;
    final tt = Theme.of(context).textTheme;

    return AsyncStateView<ServicesPayload>(
      localeCode: locale,
      async: async,
      builder: (context, d, {required bool stale}) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(t.navServices, style: tt.headlineLarge),
          const SizedBox(height: 16),
          Container(
            key: const Key('help-desk-card'),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: PemoColors.brandPrimaryTint,
              border: Border.all(color: PemoColors.brandTintBorder),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t.sectionHelpDesk, style: tt.titleMedium),
              const SizedBox(height: 6),
              if (d.helpDeskHours != null)
                Text(d.helpDeskHours!.forLocale(locale),
                    style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage)),
              if (d.typicalReplyMinutes != null) ...[
                const SizedBox(height: 4),
                Text(
                  t.typicalReply(d.typicalReplyMinutes!),
                  style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage),
                ),
              ],
              const SizedBox(height: 12),
              PemoPrimaryAction(
                label: t.actionCallOffice,
                onPressed: d.helpDeskOpenNow ? () {} : null,
              ),
            ]),
          ),
          const SizedBox(height: 20),
          for (final s in d.services)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Semantics(
                container: true,
                enabled: s.isAvailable,
                label: s.isAvailable
                    ? '${s.label.forLocale(locale)}. ${s.state.forLocale(locale)}'
                    // An unavailable service announces WHY. A greyed row that
                    // says nothing is the screen-reader equivalent of a dead button.
                    : '${s.label.forLocale(locale)}. ${s.state.forLocale(locale)}. ${s.reason?.forLocale(locale) ?? ''}',
                child: ListTile(
                contentPadding: EdgeInsets.zero,
                minVerticalPadding: 12,
                enabled: s.isAvailable,
                title: Text(
                  s.label.forLocale(locale),
                  style: tt.labelLarge?.copyWith(
                    color: s.isAvailable ? PemoColors.neutral950 : PemoColors.neutral400,
                  ),
                ),
                subtitle: Text(
                  s.isAvailable
                      ? s.state.forLocale(locale)
                      : '${s.state.forLocale(locale)} — ${s.reason?.forLocale(locale) ?? ''}',
                  style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage),
                  ),
                ),
              ),
            ),
          if (d.comingSoonNote != null) ...[
            const SizedBox(height: 12),
            Text(d.comingSoonNote!.forLocale(locale),
                style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage)),
          ],
        ],
      ),
    );
  }
}
