import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pemo_resident_mobile/data/fixture_corpus.g.dart';
import 'package:pemo_resident_mobile/screens/inbox_placeholder.dart';

import '../support/harness.dart';
import '../support/screens.dart';

/// Design system section 18 — the required state list, plus the Home Safety
/// additions. Every one must RENDER, in both languages, from fixture data.
const requiredStates = <String>[
  'loading', 'empty', 'error', 'partial', 'offline', 'stale',
  'no-permission', 'session-expired', 'integration-unavailable',
  'duplicate-submission', 'long-content-en', 'long-content-zh',
];

void main() {
  group('design system section 18 state coverage', () {
    for (final key in renderableScreens) {
      for (final state in requiredStates) {
        for (final locale in ['en', 'zh']) {
          testWidgets('$key / $state / $locale renders', (t) async {
            await pumpScreen(t, screenFor(key)!, fixtureState: state, locale: locale);
            expect(t.takeException(), isNull,
                reason: '$key/$state/$locale threw while rendering');
            // Something must actually be on screen. A silently blank state is
            // the failure this whole exercise exists to prevent, and it is the
            // one a render-without-throwing check would happily pass.
            final hasText = find.byType(Text).evaluate().isNotEmpty;
            final hasSpinner = find.byType(CircularProgressIndicator).evaluate().isNotEmpty;
            expect(hasText || hasSpinner, isTrue,
                reason: '$key/$state/$locale rendered a blank screen');
          });
        }
      }
    }

    /// Home Safety additional states, per section 18.
    const safetyStates = <String, List<String>>{
      'mob-08-safety-overview': [
        'no-installed-sensors', 'sensor-offline', 'unknown-unit',
        'caregiver-permission-expired', 'all-clear',
      ],
      'mob-09-safety-event-detail': [
        'event-update', 'duplicate-event', 'late-event', 'corrected-event',
        'retracted-event', 'resident-not-authorized', 'management-update-pending',
        'all-clear', 'unknown-unit', 'acknowledgement-recorded',
        'acknowledgement-replayed', 'common-area-event',
      ],
    };

    safetyStates.forEach((key, states) {
      for (final state in states) {
        testWidgets('$key / $state renders (Home Safety additional state)', (t) async {
          expect(FixtureCorpus.byScreenAndState[key]!.containsKey(state), isTrue,
              reason: '$key is missing a fixture for the required state $state');
          await pumpScreen(t, screenFor(key)!, fixtureState: state);
          expect(t.takeException(), isNull);
        });
      }
    });
  });

  group('the known screen gap is recorded, not invented', () {
    testWidgets('MOB-06 Inbox says specified but not yet built', (t) async {
      await pumpScreen(t, const InboxPlaceholder(localeCode: 'en'));
      expect(find.byKey(const Key('inbox-placeholder')), findsOneWidget);
      expect(find.textContaining('MOB-06'), findsOneWidget,
          reason: 'the placeholder must cite the register entry that specifies it');
      expect(find.textContaining('specified'), findsOneWidget,
          reason: 'it is specified but unbuilt, NOT undesigned; calling it undesigned '
              'risks it being re-designed when a specification already exists');
    });
  });

  group('client-only states are client-rendered, per the contract', () {
    test('the contract records why loading, offline and duplicate-submission have no payload', () {
      expect(FixtureCorpus.clientOnlyReasons, isNotEmpty);
      final offlineReasons = FixtureCorpus.clientOnlyReasons.entries
          .where((e) => e.key.endsWith('/offline'));
      expect(offlineReasons, isNotEmpty);
      for (final e in offlineReasons) {
        expect(e.value.toLowerCase(), contains('client'),
            reason: 'client connectivity is not a severity and the server never emits it');
      }
    });
  });
}
