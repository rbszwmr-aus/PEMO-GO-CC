// The screens a corpus key renders to, and which keys render at all (GEN-056).
//
// The fixture corpus mixes three kinds: built fetching screens (mob-*), an unbuilt
// fetching screen (notices/MOB-06, InboxPlaceholder), and operation-fixtures
// (problems — Problem bodies, not a screen). A test that renders by raw corpus key
// throws for the last two: screenFor has no widget for them. So every render-by-key
// test derives its key list from TWO signals, neither a hand-kept kind list:
//   - kind == 'screen'  — DERIVED in the generator from the fixture shape (a GET-200
//     data fixture is what makes a group a screen); excludes `problems`.
//   - a widget exists    — `screenFor` returns null for a key it does not map, which
//     is the real widget wiring, not a classification list; excludes `notices`.

import 'package:flutter/material.dart';
import 'package:pemo_resident_mobile/data/fixture_corpus.g.dart';
import 'package:pemo_resident_mobile/screens/account_screen.dart';
import 'package:pemo_resident_mobile/screens/home_screen.dart';
import 'package:pemo_resident_mobile/screens/safety_event_screen.dart';
import 'package:pemo_resident_mobile/screens/safety_overview_screen.dart';
import 'package:pemo_resident_mobile/screens/services_screen.dart';

/// The built screen for a corpus key, or NULL if the app builds none. Null is the
/// "is it built" signal — the widget wiring itself, never a separate list.
Widget? screenFor(String key) => switch (key) {
      'mob-02-home' => const HomeScreen(),
      'mob-03-services' => const ServicesScreen(),
      'mob-08-safety-overview' => const SafetyOverviewScreen(),
      'mob-09-safety-event-detail' => const SafetyEventScreen(),
      'mob-11-account' => const AccountScreen(),
      _ => null,
    };

/// Corpus keys that RENDER: kind SCREEN and a widget exists. This is the ONLY list
/// a render-by-key test should iterate; raw `byScreenAndState.keys` includes
/// operation-fixtures and the unbuilt screen and will throw.
final List<String> renderableScreens = FixtureCorpus.byScreenAndState.keys
    .where((k) => FixtureCorpus.screenKind[k] == 'screen' && screenFor(k) != null)
    .toList();
