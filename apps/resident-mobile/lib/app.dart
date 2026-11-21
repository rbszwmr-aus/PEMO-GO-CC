import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'l10n/app_localizations.dart';
import 'screens/account_screen.dart';
import 'screens/home_screen.dart';
import 'screens/inbox_placeholder.dart';
import 'screens/safety_overview_screen.dart';
import 'screens/services_screen.dart';
import 'state/providers.dart';
import 'theme/pemo_colors.dart';
import 'theme/pemo_theme.dart';

/// Five destinations, fixed by design system section 7.2:
/// Home, Services, Safety, Inbox, Account.
class PemoApp extends ConsumerWidget {
  const PemoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final code = ref.watch(localeCodeProvider);
    return MaterialApp(
      title: 'PEMO',
      debugShowCheckedModeBanner: false,
      theme: PemoTheme.light(),
      locale: code.startsWith('zh') ? const Locale.fromSubtags(languageCode: 'zh', scriptCode: 'Hant') : const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      localeResolutionCallback: (locale, supported) {
        if (locale?.languageCode == 'zh') return const Locale('zh');
        return const Locale('en');
      },
      home: const _Shell(),
    );
  }
}

class _Shell extends ConsumerStatefulWidget {
  const _Shell();
  @override
  ConsumerState<_Shell> createState() => _ShellState();
}

class _ShellState extends ConsumerState<_Shell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    final code = ref.watch(localeCodeProvider);
    final pages = [
      const HomeScreen(),
      const ServicesScreen(),
      const SafetyOverviewScreen(),
      InboxPlaceholder(localeCode: code),
      const AccountScreen(),
    ];
    return Scaffold(
      body: SafeArea(child: pages[_index]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        indicatorColor: PemoColors.brandPrimaryTint,
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home), label: t.navHome),
          NavigationDestination(icon: const Icon(Icons.grid_view_outlined), selectedIcon: const Icon(Icons.grid_view), label: t.navServices),
          NavigationDestination(icon: const Icon(Icons.shield_outlined), selectedIcon: const Icon(Icons.shield), label: t.navSafety),
          NavigationDestination(icon: const Icon(Icons.inbox_outlined), selectedIcon: const Icon(Icons.inbox), label: t.navInbox),
          NavigationDestination(icon: const Icon(Icons.person_outline), selectedIcon: const Icon(Icons.person), label: t.navAccount),
        ],
      ),
    );
  }
}
