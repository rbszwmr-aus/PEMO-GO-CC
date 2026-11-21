import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pemo_resident_mobile/data/fixture_repository.dart';
import 'package:pemo_resident_mobile/l10n/app_localizations.dart';
import 'package:pemo_resident_mobile/state/providers.dart';
import 'package:pemo_resident_mobile/theme/pemo_theme.dart';

/// Every design system section 18 state is reached by overriding a provider.
/// No network, no timer, no manual tap anywhere in this suite.
Future<void> pumpScreen(
  WidgetTester tester,
  Widget screen, {
  String fixtureState = 'default',
  String locale = 'en',
  TextScaler? textScaler,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        repositoryProvider.overrideWithValue(FixtureSafetyRepository()),
        fixtureStateProvider.overrideWithValue(fixtureState),
        localeCodeProvider.overrideWithValue(locale),
      ],
      child: MaterialApp(
        theme: PemoTheme.light(),
        locale: locale.startsWith('zh') ? const Locale('zh') : const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) => MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: textScaler ?? TextScaler.noScaling),
            child: Scaffold(body: screen),
          ),
        ),
      ),
    ),
  );
  // A loading state is a PERPETUAL animation by design, so pumpAndSettle can
  // never settle on it. Pumping a frame is the correct wait there; using
  // pumpAndSettle would report a timeout and read as a broken screen.
  if (fixtureState == 'loading') {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 16));
  } else {
    await tester.pumpAndSettle();
  }
}
