import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pemo_resident_mobile/data/fixture_corpus.g.dart';
import 'package:pemo_resident_mobile/screens/home_screen.dart';
import 'package:pemo_resident_mobile/screens/safety_event_screen.dart';
import 'package:pemo_resident_mobile/screens/safety_overview_screen.dart';
import 'package:pemo_resident_mobile/theme/severity_tokens.g.dart';

import '../support/harness.dart';

/// RULE 1 — the single most important rule in this PID.
///
/// Offline, stale, unknown or missing data must NEVER render as normal, safe or
/// green. Design system sections 3.1 and 10.3. A green "all safe" over stale
/// data is the failure mode that makes a safety product dangerous.
///
/// These assertions read the ACTUAL Color off the rendered widget, via a keyed
/// finder. find.byType(DecoratedBox) is ambiguous — Material, Scaffold and Card
/// all use decorated boxes internally — and an unkeyed finder would make this
/// test pass while asserting nothing. A rule that passes for the wrong reason is
/// worse than no rule, because it retires the question.
void main() {
  final normal = SeverityTokens.of(Severity.normal);
  final normalColours = {normal.strong, normal.surface, normal.border};

  Color badgeFill(WidgetTester tester, Key key) {
    final box = tester.widget<DecoratedBox>(find.byKey(key));
    return (box.decoration as BoxDecoration).color!;
  }

  group('rule 1: a non-normal condition never renders with normal styling', () {
    // Every severity except normal, checked at the token layer first: if the
    // generated palette ever collides with normal, every downstream assertion
    // below is meaningless.
    test('no non-normal severity shares any colour with normal', () {
      for (final s in Severity.values.where((s) => s != Severity.normal)) {
        final t = SeverityTokens.of(s);
        expect(normalColours.contains(t.surface), isFalse,
            reason: '${s.wireValue} surface ${t.surface} collides with a normal token');
        expect(normalColours.contains(t.strong), isFalse,
            reason: '${s.wireValue} strong ${t.strong} collides with a normal token');
      }
    });

    testWidgets('offline severity renders the offline surface, not normal', (t) async {
      await pumpScreen(t, const SafetyOverviewScreen(), fixtureState: 'sensor-offline');
      final offline = SeverityTokens.of(Severity.offline);
      final fill = badgeFill(t, const Key('banner-severity-badge'));
      expect(fill, offline.surface);
      expect(normalColours.contains(fill), isFalse);
    });

    testWidgets('unknown severity renders the unknown surface, not normal and not offline', (t) async {
      // mob-09/unknown-unit carries severity "unknown". mob-08/unknown-unit is a
      // 409 problem+json and is a different state entirely.
      await pumpScreen(t, const SafetyEventScreen(), fixtureState: 'unknown-unit');
      final unknown = SeverityTokens.of(Severity.unknown);
      final offline = SeverityTokens.of(Severity.offline);
      final fill = badgeFill(t, const Key('event-severity-badge'));
      expect(fill, unknown.surface);
      expect(fill, isNot(offline.surface),
          reason: 'offline and unknown are different statements to a resident');
      expect(normalColours.contains(fill), isFalse);
    });

    testWidgets('stale data is not presented as current', (t) async {
      await pumpScreen(t, const SafetyOverviewScreen(), fixtureState: 'stale');
      // The data-age line must be present and must carry the stale treatment.
      expect(find.byKey(const Key('data-age')), findsOneWidget);
      final text = t.widget<Text>(
        find.descendant(of: find.byKey(const Key('data-age')), matching: find.byType(Text)),
      );
      expect(text.style?.color, isNot(SeverityTokens.of(Severity.normal).strong),
          reason: 'a stale age line must not be styled as a normal one');
    });

    testWidgets('client-offline renders its own state and never a normal badge', (t) async {
      await pumpScreen(t, const HomeScreen(), fixtureState: 'offline');
      expect(find.byKey(const Key('client-offline-state')), findsOneWidget);
      // The last payload beneath it is shown as stale, never as a fresh normal.
      final banner = find.byKey(const Key('safety-banner'));
      if (banner.evaluate().isNotEmpty) {
        expect(find.byKey(const Key('data-age')), findsWidgets);
      }
    });
  });

  /// Sweep: for EVERY fixture declaring an overall safety condition, assert the
  /// banner renders THAT condition's tokens.
  ///
  /// An earlier version of this sweep skipped any fixture whose raw JSON
  /// contained "severity":"normal" anywhere. On mob-08/sensor-offline that
  /// string comes from a per-sensor normal while the overall condition is
  /// offline, so the fixture that matters most was being skipped. A fixture with
  /// a critical overall condition and one healthy sensor would have been skipped
  /// too. Parse the payload and assert on the overall badge.
  group('rule 1 sweep: the overall condition badge matches the declared severity', () {
    final overview = FixtureCorpus.byScreenAndState['mob-08-safety-overview']!;

    for (final state in overview.keys) {
      testWidgets('mob-08/$state', (t) async {
        final raw = jsonDecode(overview[state]!) as Map<String, dynamic>;
        final safety = raw['safety'] as Map<String, dynamic>?;
        if (safety == null) return; // problem+json: no condition is declared
        final declared = Severity.fromWire(safety['severity'] as String);

        await pumpScreen(t, const SafetyOverviewScreen(), fixtureState: state);
        final banner = find.byKey(const Key('banner-severity-badge'));
        if (banner.evaluate().isEmpty) return; // state renders no banner

        final fill = badgeFill(t, const Key('banner-severity-badge'));
        expect(fill, SeverityTokens.of(declared).surface,
            reason: 'mob-08/$state declares ${declared.wireValue} but the banner '
                'rendered a different token');

        if (declared != Severity.normal) {
          expect(normalColours.contains(fill), isFalse,
              reason: 'mob-08/$state declares ${declared.wireValue} yet the banner '
                  'rendered a normal colour');
        }
      });
    }
  });

  /// The event screen equivalent: the event badge must match the event severity.
  group('rule 1 sweep: the event badge matches the declared event severity', () {
    final detail = FixtureCorpus.byScreenAndState['mob-09-safety-event-detail']!;

    for (final state in detail.keys) {
      testWidgets('mob-09/$state', (t) async {
        final raw = jsonDecode(detail[state]!) as Map<String, dynamic>;
        final event = raw['event'] as Map<String, dynamic>?;
        if (event == null) return;
        final declared = Severity.fromWire(event['severity'] as String);

        await pumpScreen(t, const SafetyEventScreen(), fixtureState: state);
        final badge = find.byKey(const Key('event-severity-badge'));
        if (badge.evaluate().isEmpty) return;

        final fill = badgeFill(t, const Key('event-severity-badge'));
        expect(fill, SeverityTokens.of(declared).surface,
            reason: 'mob-09/$state declares ${declared.wireValue} but rendered another token');
        if (declared != Severity.normal) {
          expect(normalColours.contains(fill), isFalse);
        }
      });
    }
  });
}
