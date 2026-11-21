import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/models/payloads.dart';
import '../state/providers.dart';
import '../theme/pemo_colors.dart';
import '../theme/pemo_type.dart';
import '../widgets/screen_state_view.dart';

/// MOB-11 Account. Resident pass, unit membership, notification preferences
/// including locked entries with VISIBLE reasons.
class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeCodeProvider);
    final async = ref.watch(accountProvider);
    final t = AppLocalizations.of(context)!;
    final tt = Theme.of(context).textTheme;

    return AsyncStateView<AccountPayload>(
      localeCode: locale,
      async: async,
      builder: (context, d, {required bool stale}) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(t.titleAccount, style: tt.headlineLarge),
          const SizedBox(height: 16),
          if (d.pass != null)
            Container(
              key: const Key('resident-pass'),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: PemoColors.brandPrimary,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t.residentPass,
                    style: PemoType.identifier.copyWith(color: PemoColors.onBrandMuted, letterSpacing: 1.2)),
                const SizedBox(height: 8),
                Text(d.pass!.holderName, style: tt.titleLarge?.copyWith(color: PemoColors.white)),
                const SizedBox(height: 2),
                Text(d.pass!.unitDisplayLine.forLocale(locale),
                    style: tt.bodySmall?.copyWith(color: PemoColors.onBrandMuted)),
                const SizedBox(height: 10),
                Text(d.pass!.passReference,
                    key: const Key('pass-reference'),
                    style: PemoType.identifier.copyWith(color: PemoColors.onBrandMuted)),
                if (d.pass!.note != null) ...[
                  const SizedBox(height: 12),
                  Text(d.pass!.note!.forLocale(locale),
                      style: tt.bodySmall?.copyWith(color: PemoColors.onBrandMuted)),
                ],
              ]),
            ),
          if (d.memberships.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text(t.sectionYourUnits, style: tt.titleMedium),
            const SizedBox(height: 8),
            for (final m in d.memberships)
              ListTile(
                contentPadding: EdgeInsets.zero,
                minVerticalPadding: 12,
                title: Text(m.displayLine.forLocale(locale), style: tt.bodyMedium),
                subtitle: Text(m.role, style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage)),
                trailing: m.isCurrent ? const Icon(Icons.check, color: PemoColors.brandPrimary) : null,
              ),
          ],
          if (d.preferences.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text(t.sectionNotificationPreferences, style: tt.titleMedium),
            const SizedBox(height: 8),
            for (final p in d.preferences)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Semantics(
                  container: true,
                  enabled: !p.locked,
                  label: p.locked
                      ? '${p.label.forLocale(locale)}. ${p.lockReason?.forLocale(locale) ?? ''}'
                      : p.label.forLocale(locale),
                  child: SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: p.enabled,
                  // A locked preference states WHY it is locked. A disabled
                  // control must never be the only signal.
                  onChanged: p.locked ? null : (_) {},
                  title: Text(p.label.forLocale(locale), style: tt.labelLarge),
                  subtitle: p.locked && p.lockReason != null
                      ? Text(p.lockReason!.forLocale(locale),
                          style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage))
                        : null,
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}
