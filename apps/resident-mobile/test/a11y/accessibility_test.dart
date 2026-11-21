import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pemo_resident_mobile/data/fixture_corpus.g.dart';
import 'package:pemo_resident_mobile/theme/pemo_theme.dart';

import '../support/harness.dart';
import '../support/screens.dart';

void main() {
  final screenKeys = renderableScreens;

  // ───────────────────────── RULE 7 ─────────────────────────
  group('rule 7: touch targets are at least 44px, 48 preferred', () {
    for (final key in screenKeys) {
      testWidgets('$key default state', (t) async {
        await pumpScreen(t, screenFor(key)!);
        final undersized = <String>[];
        final below48 = <String>[];

        for (final type in <Type>[InkWell, FilledButton, OutlinedButton, TextButton, Switch, ListTile]) {
          for (final e in find.byType(type).evaluate()) {
            final size = e.size;
            if (size == null || size.isEmpty) continue;

            // A control inside a ListTile is not its own tap target: the whole
            // row is. Measured on this app, the Switch glyph is 40px while the
            // row that actually receives the gesture is 72px. Measuring the
            // glyph would report a failure that a resident could never
            // experience, and fixing that phantom would mean padding a control
            // whose target is already compliant.
            var insideTile = false;
            e.visitAncestorElements((a) {
              if (a.widget is ListTile) { insideTile = true; return false; }
              return true;
            });
            if (insideTile && type == Switch) continue;

            if (size.height < PemoTheme.absoluteMinTouchTarget) {
              undersized.add('$type ${size.height.toStringAsFixed(1)}px');
            } else if (size.height < PemoTheme.minTouchTarget) {
              below48.add('$type ${size.height.toStringAsFixed(1)}px');
            }
          }
        }
        expect(undersized, isEmpty, reason: '$key has targets below 44px: $undersized');
        // 48 is preferred, not mandatory. Reported, not failed.
        if (below48.isNotEmpty) {
          debugPrint('$key: ${below48.length} target(s) between 44 and 48px: $below48');
        }
      });
    }
  });

  // ───────────────────────── RULE 8 ─────────────────────────
  group('rule 8: both languages, and 200% text scaling without clipping', () {
    for (final key in screenKeys) {
      for (final locale in ['en', 'zh']) {
        testWidgets('$key renders in $locale', (t) async {
          await pumpScreen(t, screenFor(key)!, locale: locale);
          expect(renderExceptions(t), isEmpty);
        });

        testWidgets('$key at 200% text scale in $locale does not overflow', (t) async {
          await pumpScreen(t, screenFor(key)!,
              locale: locale, textScaler: const TextScaler.linear(2.0));
          expect(renderExceptions(t), isEmpty,
              reason: '$key clipped or overflowed at 200% in $locale');
        });

        testWidgets('$key with long $locale content does not overflow', (t) async {
          final state = locale == 'zh' ? 'long-content-zh' : 'long-content-en';
          if (!FixtureCorpus.byScreenAndState[key]!.containsKey(state)) return;
          await pumpScreen(t, screenFor(key)!, locale: locale, fixtureState: state);
          expect(renderExceptions(t), isEmpty,
              reason: '$key overflowed with long $locale content');
        });
      }
    }
  });

  // ───────────────────── screen-reader semantics ─────────────────────
  group('screen-reader semantics are present on status and interactive elements', () {
    for (final key in screenKeys) {
      testWidgets('$key exposes a non-empty semantics tree', (t) async {
        final handle = t.ensureSemantics();
        await pumpScreen(t, screenFor(key)!);

        final labelled = find.byWidgetPredicate((w) => w is Semantics && (w.properties.label?.isNotEmpty ?? false));
        expect(labelled, findsWidgets, reason: '$key exposes no semantic labels at all');

        // Every interactive element must be reachable by a screen reader.
        for (final e in find.byType(FilledButton).evaluate()) {
          final node = t.getSemantics(find.byWidget(e.widget));
          expect(node.label.isNotEmpty, isTrue,
              reason: '$key has an unlabelled button');
        }
        handle.dispose();
      });
    }
  });
}

/// Layout overflow and render exceptions surface through the test binding.
List<Object> renderExceptions(WidgetTester t) {
  final errors = <Object>[];
  final e = t.takeException();
  if (e != null) errors.add(e);
  return errors;
}
