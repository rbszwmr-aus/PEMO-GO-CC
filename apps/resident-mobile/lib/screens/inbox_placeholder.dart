import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';

import '../theme/pemo_colors.dart';

/// MOB-06 Inbox.
///
/// SPECIFIED but not yet built. RETIRED-DOC-002 section 7 is the screen register
/// that produced this design and it specifies all eleven screens; six of them,
/// including this one, were never visually exported. That is materially
/// different from "undesigned", and describing it as undesigned would risk it
/// being re-designed from scratch when a specification already exists.
///
/// Its layout is deliberately not invented here.
class InboxPlaceholder extends StatelessWidget {
  const InboxPlaceholder({super.key, required this.localeCode});
  final String localeCode;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final tt = Theme.of(context).textTheme;
    return Center(
      key: const Key('inbox-placeholder'),
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.inbox_outlined, size: 40, color: PemoColors.neutral400),
          const SizedBox(height: 12),
          Text(t.navInbox, style: tt.titleMedium),
          const SizedBox(height: 8),
          Text(
            t.inboxSpecifiedNotBuilt,
            textAlign: TextAlign.center,
            style: tt.bodySmall?.copyWith(color: PemoColors.secondaryTextOnPage),
          ),
        ]),
      ),
    );
  }
}
