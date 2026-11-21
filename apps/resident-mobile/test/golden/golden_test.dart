import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pemo_resident_mobile/screens/account_screen.dart';
import 'package:pemo_resident_mobile/screens/home_screen.dart';
import 'package:pemo_resident_mobile/screens/safety_event_screen.dart';
import 'package:pemo_resident_mobile/screens/safety_overview_screen.dart';
import 'package:pemo_resident_mobile/screens/services_screen.dart';

import '../support/harness.dart';

/// Goldens for the states a live backend will not conveniently produce.
///
/// A golden does not detect wrongness: it preserves whatever was there when it
/// was written. These were written against the corpus at contract 0.2.1, AFTER
/// the freshness correction in that release — a golden baked against the earlier
/// ageSeconds would have locked in a misreported observation age and looked
/// correct indefinitely.
///
/// Font note: Libre Franklin and Noto Sans TC are not present in the test
/// environment, so glyphs render from the test fallback. These goldens are
/// therefore layout and colour regressions, not typography proof.
void main() {
  final cases = <String, ({Widget Function() build, List<String> states})>{
    'home': (build: () => const HomeScreen(), states: ['default', 'offline', 'stale']),
    'services': (build: () => const ServicesScreen(), states: ['default']),
    'safety-overview': (
      build: () => const SafetyOverviewScreen(),
      states: ['default', 'sensor-offline', 'stale', 'no-installed-sensors'],
    ),
    'safety-event': (
      build: () => const SafetyEventScreen(),
      states: ['default', 'unknown-unit', 'all-clear', 'management-update-pending'],
    ),
    'account': (build: () => const AccountScreen(), states: ['default']),
  };

  cases.forEach((name, spec) {
    for (final state in spec.states) {
      for (final locale in ['en', 'zh']) {
        testWidgets('golden: $name/$state/$locale', (t) async {
          await t.binding.setSurfaceSize(const Size(390, 844)); // a common handset
          await pumpScreen(t, spec.build(), fixtureState: state, locale: locale);
          await expectLater(
            find.byType(MaterialApp),
            matchesGoldenFile('goldens/$name.$state.$locale.png'),
          );
        });
      }
    }
  });
}
