import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pemo_resident_mobile/data/fixture_corpus.g.dart';
import 'package:pemo_resident_mobile/data/fixture_repository.dart';
import 'package:pemo_resident_mobile/data/safety_repository.dart';
import 'package:pemo_resident_mobile/l10n/app_localizations.dart';
import 'package:pemo_resident_mobile/screens/home_screen.dart';
import 'package:pemo_resident_mobile/screens/safety_event_screen.dart';
import 'package:pemo_resident_mobile/state/providers.dart';
import 'package:pemo_resident_mobile/theme/pemo_theme.dart';
import 'package:pemo_resident_mobile/theme/severity_tokens.g.dart';
import 'package:pemo_resident_mobile/widgets/pemo_widgets.dart';

import '../support/harness.dart';

List<File> libSources() => Directory('lib')
    .listSync(recursive: true)
    .whereType<File>()
    .where((f) => f.path.endsWith('.dart'))
    .toList();

void main() {
  // ───────────────────────── RULE 2 ─────────────────────────
  group('rule 2: severity is never communicated by colour alone', () {
    testWidgets('every badge carries icon, visible text label and semantic label', (t) async {
      final handle = t.ensureSemantics();
      for (final s in Severity.values) {
        await t.pumpWidget(MaterialApp(
          home: Scaffold(body: PemoStatusBadge(severity: s, localeCode: 'en')),
        ));
        final tokens = SeverityTokens.of(s);
        expect(find.byIcon(PemoStatusBadge.iconFor(s)), findsOneWidget,
            reason: '${s.wireValue} rendered without an icon');
        expect(find.text(tokens.labelEn), findsOneWidget,
            reason: '${s.wireValue} rendered without a visible label');
        expect(find.bySemanticsLabel(tokens.labelEn), findsWidgets,
            reason: '${s.wireValue} rendered without a semantic label');
      }
      handle.dispose();
    });

    testWidgets('every severity has a DISTINCT icon, so shape alone separates them', (t) async {
      final icons = Severity.values.map(PemoStatusBadge.iconFor).toSet();
      expect(icons.length, Severity.values.length,
          reason: 'two severities share an icon, so the non-colour cue does not distinguish them');
    });

    test('offline and unknown carry different labels in both languages', () {
      final o = SeverityTokens.of(Severity.offline);
      final u = SeverityTokens.of(Severity.unknown);
      expect(o.labelEn, isNot(u.labelEn));
      expect(o.labelZhHant, isNot(u.labelZhHant));
    });
  });

  // ───────────────────────── RULE 3 ─────────────────────────
  group('rule 3: the statutory disclaimer is server-supplied and verbatim', () {
    testWidgets('renders byte-identical to the fixture field, both locales', (t) async {
      final raw = jsonDecode(FixtureCorpus.byScreenAndState['mob-09-safety-event-detail']!['default']!)
          as Map<String, dynamic>;
      final d = (raw['event'] as Map<String, dynamic>)['disclaimer'] as Map<String, dynamic>;

      await pumpScreen(t, const SafetyEventScreen());
      expect(find.text(d['en'] as String), findsOneWidget,
          reason: 'English disclaimer was not rendered verbatim');

      await pumpScreen(t, const SafetyEventScreen(), locale: 'zh');
      expect(find.text(d['zh-Hant'] as String), findsOneWidget,
          reason: 'Traditional Chinese disclaimer was not rendered verbatim');
    });

    /// Asserting the string MATCHES is easy. Asserting it cannot be hardcoded is
    /// what keeps it matching: a literal in the source would keep passing the
    /// match test above while silently detaching from the server.
    test('the disclaimer text appears nowhere as a literal in lib/ or the ARB files', () {
      final raw = jsonDecode(FixtureCorpus.byScreenAndState['mob-09-safety-event-detail']!['default']!)
          as Map<String, dynamic>;
      final d = (raw['event'] as Map<String, dynamic>)['disclaimer'] as Map<String, dynamic>;
      final needles = <String>[
        (d['en'] as String).substring(0, 40),
        (d['zh-Hant'] as String).substring(0, 12),
      ];
      final files = <File>[
        ...libSources(),
        File('lib/l10n/app_en.arb'),
        File('lib/l10n/app_zh.arb'),
      ];
      for (final f in files) {
        if (!f.existsSync()) continue;
        if (f.path.contains('fixture_corpus.g.dart')) continue; // the corpus IS the server data
        final src = f.readAsStringSync();
        for (final n in needles) {
          expect(src.contains(n), isFalse,
              reason: 'disclaimer text is hardcoded in ${f.path}; it must come from the payload');
        }
      }
    });
  });

  // ───────────────────────── RULE 4 ─────────────────────────
  //
  // Contract 0.2.2 SCOPED the denylist, and the scoping changes what this test
  // is allowed to do. From `appliesTo`:
  //
  //   responsePropertyNames -> forbiddenPropertyNames
  //   responseStringValues  -> forbiddenValuePatterns
  //   clientAuthoredCopy    -> forbiddenValuePatterns ONLY, never
  //                            forbiddenPropertyNames
  //
  // The earlier version of this test applied field-name terms to prose. That is
  // now explicitly forbidden, and it is what produced the "Your units" false
  // positive. Re-running the old test unchanged would have passed — the
  // exception was added in my favour — while still doing the wrong thing.
  group('rule 4: no raw 2IoThub, device identifier or telemetry term reaches a screen', () {
    Map<String, dynamic> denylist() => jsonDecode(
          File('../../packages/api-contracts/resident-mobile/forbidden-terms.json')
              .readAsStringSync(),
        ) as Map<String, dynamic>;

    /// Client-authored copy: value patterns only.
    test('client-authored copy carries no leaked engineering vocabulary', () {
      final patterns = ((denylist()['forbiddenValuePatterns'] as List).cast<Map<String, dynamic>>())
          .map((p) => (name: p['name'] as String, re: RegExp(p['pattern'] as String)))
          .toList();
      expect(patterns, isNotEmpty);

      final hits = <String>[];
      for (final path in ['lib/l10n/app_en.arb', 'lib/l10n/app_zh.arb']) {
        final arb = jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;
        for (final e in arb.entries) {
          if (e.key.startsWith('@') || e.value is! String) continue;
          for (final p in patterns) {
            if (p.re.hasMatch(e.value as String)) hits.add('$path ${e.key}: ${p.name}');
          }
        }
      }
      // Rendered string literals in the app source are client-authored too.
      for (final f in libSources().where((f) => !f.path.contains('fixture_corpus.g.dart'))) {
        for (final m in RegExp("'([^'\\n]{2,})'").allMatches(f.readAsStringSync())) {
          for (final p in patterns) {
            if (p.re.hasMatch(m.group(1)!)) hits.add('${f.path}: ${p.name} in "${m.group(1)}"');
          }
        }
      }
      expect(hits, isEmpty, reason: 'engineering vocabulary in client copy:\n${hits.join('\n')}');
    });

    /// Property-name rules, applied to property names: the app must never READ a
    /// forbidden field out of a payload, because reading it is the step before
    /// rendering it. This is the field-name surface as it exists in a client.
    test('the app reads no forbidden property name out of any payload', () {
      final d = denylist();
      final exceptions = ((d['allowedExceptions'] as List?) ?? const [])
          .map((e) => ((e as Map<String, dynamic>)['term'] as String).toLowerCase())
          .toSet();

      final terms = <String>{};
      for (final cat in (d['forbiddenPropertyNames'] as Map<String, dynamic>).values) {
        for (final t in ((cat as Map<String, dynamic>)['terms'] as List).cast<String>()) {
          if (!exceptions.contains(t.toLowerCase())) terms.add(t.toLowerCase());
        }
      }
      expect(terms.length, greaterThan(20));

      // Every JSON key the app reads, e.g. j['severity'] or raw['event'].
      final hits = <String>[];
      for (final f in libSources().where((f) => !f.path.contains('fixture_corpus.g.dart'))) {
        for (final m in RegExp(r"\[\s*'([A-Za-z0-9_-]+)'\s*\]").allMatches(f.readAsStringSync())) {
          final key = m.group(1)!.toLowerCase().replaceAll(RegExp('[^a-z0-9]'), '');
          if (terms.contains(key)) hits.add('${f.path}: reads property "${m.group(1)}"');
        }
      }
      expect(hits, isEmpty, reason: 'forbidden property names read by the client:\n${hits.join('\n')}');
    });

    /// The exception that was added for this PID is genuinely present, so a
    /// later narrowing of it fails here rather than silently in a screen.
    test('unit and units are allowed at the resident boundary', () {
      final exceptions = ((denylist()['allowedExceptions'] as List).cast<Map<String, dynamic>>())
          .map((e) => (e['term'] as String).toLowerCase())
          .toSet();
      expect(exceptions, containsAll(<String>['unit', 'units']),
          reason: 'resident copy names the flat a resident lives in; '
              'if this exception is withdrawn, the copy must change with it');
    });
  });

  // ───────────────────────── RULE 5 ─────────────────────────
  group('rule 5: critical styling is reserved; no flashing, no celebration', () {
    test('no repeating animation anywhere in the app source', () {
      for (final f in libSources()) {
        final src = f.readAsStringSync();
        expect(src.contains('.repeat('), isFalse,
            reason: '${f.path} uses a repeating animation; critical alerts must not flash or pulse');
      }
    });

    test('no confetti, celebration or success animation package is present', () {
      // Match the dependency NAME, not any substring: "rive" is inside
      // "flutter_riverpod", and a substring check would fail on the state
      // library while claiming to have found an animation package.
      final deps = RegExp(r'^\s{2}([a-z_0-9]+):', multiLine: true)
          .allMatches(File('pubspec.yaml').readAsStringSync())
          .map((m) => m.group(1)!)
          .toSet();
      for (final banned in ['confetti', 'lottie', 'rive', 'flutter_animate']) {
        expect(deps.contains(banned), isFalse, reason: 'celebratory animation dependency: $banned');
      }
    });
  });

  // ───────────────────────── RULE 6 ─────────────────────────
  group('rule 6: safety action buttons are never OK or Confirm', () {
    test('neither ARB file contains a bare OK or Confirm action label', () {
      for (final path in ['lib/l10n/app_en.arb', 'lib/l10n/app_zh.arb']) {
        final arb = jsonDecode(File(path).readAsStringSync()) as Map<String, dynamic>;
        for (final e in arb.entries) {
          if (!e.key.startsWith('action')) continue;
          final v = (e.value as String).trim().toLowerCase();
          expect(['ok', 'confirm', '確定', '確認'].contains(v), isFalse,
              reason: '$path ${e.key} is a bare "$v"; say what the resident is confirming');
        }
      }
    });

    testWidgets('the acknowledgement action names what it acknowledges', (t) async {
      await pumpScreen(t, const SafetyEventScreen());
      final btn = find.byKey(const Key('acknowledge-action'));
      expect(btn, findsOneWidget);
      final label = t.widget<Text>(find.descendant(of: btn, matching: find.byType(Text))).data!;
      expect(label.toLowerCase(), isNot('ok'));
      expect(label.toLowerCase(), isNot('confirm'));
      expect(label.length, greaterThan(4));
    });
  });

  // ───────────────────────── RULE 9 ─────────────────────────
  group('rule 9: acknowledgement is idempotent from the UI side', () {
    testWidgets('a double tap produces exactly one effect', (t) async {
      final repo = _CountingRepository();
      await t.pumpWidget(ProviderScope(
        overrides: [
          repositoryProvider.overrideWithValue(repo),
          fixtureStateProvider.overrideWithValue('default'),
          localeCodeProvider.overrideWithValue('en'),
        ],
        child: const _TestApp(child: SafetyEventScreen()),
      ));
      await t.pumpAndSettle();

      final btn = find.byKey(const Key('acknowledge-action'));
      await t.tap(btn);
      await t.pump();            // in-flight
      await t.tap(btn);          // second tap while in flight
      await t.pumpAndSettle();
      await t.tap(btn);          // third tap after completion
      await t.pumpAndSettle();

      expect(repo.acknowledgeCalls, 1,
          reason: 'acknowledgement was applied ${repo.acknowledgeCalls} times');
    });
  });

  // ───────────────────────── RULE 10 ─────────────────────────
  group('rule 10: a normal state stays calm', () {
    test('normal holds the palest surface of the seven, by construction', () {
      double luminance(Color c) => c.computeLuminance();
      final normal = luminance(SeverityTokens.of(Severity.normal).surface);
      for (final s in Severity.values.where((s) => s != Severity.normal)) {
        expect(luminance(SeverityTokens.of(s).surface), lessThan(normal),
            reason: '${s.wireValue} surface is paler than normal; the v2.0 ladder is monotone '
                'so a calm normal holds structurally, not by taste');
      }
    });

    testWidgets('a normal home renders no full-bleed severity card', (t) async {
      await pumpScreen(t, const HomeScreen());
      // The banner is a bordered panel on the page ground, not a filled block.
      final banner = t.widget<Container>(find.byKey(const Key('safety-banner')));
      final dec = banner.decoration as BoxDecoration;
      expect(dec.color, isNot(SeverityTokens.of(Severity.normal).strong),
          reason: 'a calm normal must not be a large filled green card');
    });
  });

  // ───────────────────── coverage is not a severity ─────────────────────
  test('monitoringCoverage none is paired with information, never with a safety severity', () {
    for (final screen in ['mob-02-home', 'mob-08-safety-overview']) {
      for (final e in FixtureCorpus.byScreenAndState[screen]!.entries) {
        final raw = jsonDecode(e.value) as Map<String, dynamic>;
        final safety = raw['safety'] as Map<String, dynamic>?;
        if (safety == null) continue;
        if (safety['monitoringCoverage'] != 'none') continue;
        expect(safety['severity'], 'information',
            reason: '$screen/${e.key}: coverage none must pair with information');
      }
    }
  });
}

class _TestApp extends StatelessWidget {
  const _TestApp({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => MaterialApp(
        theme: PemoTheme.light(),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(body: child),
      );
}

class _CountingRepository extends FixtureSafetyRepository {
  int acknowledgeCalls = 0;
  @override
  Future<AcknowledgeResult> acknowledge(String eventId) {
    acknowledgeCalls++;
    return super.acknowledge(eventId);
  }
}
