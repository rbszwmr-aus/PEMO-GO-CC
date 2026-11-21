import 'dart:convert';
import 'dart:io';

import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pemo_resident_mobile/data/fixture_corpus.g.dart';
import 'package:pemo_resident_mobile/theme/severity_tokens.g.dart';

/// The severity palette is GENERATED from severity.json, never transcribed.
///
/// This test re-reads the contract independently of the generator, so drift
/// fails the build even if `node tool/generate-tokens.mjs` is never run
/// again. Hard-coding a hex would break the split the contract depends on: the
/// severity-enum-agreement check binds structure, not colour, which is exactly
/// what let the palette move from design system v1.1 to v2.0 without touching
/// the enum.
void main() {
  final contract = jsonDecode(
    File('../../packages/api-contracts/resident-mobile/severity.json').readAsStringSync(),
  ) as Map<String, dynamic>;

  Color hex(String h) => Color(int.parse('FF${h.substring(1)}', radix: 16));

  test('contract version matches the generated tokens and the embedded corpus', () {
    expect(SeverityTokens.contractVersion, contract['contractVersion']);
    expect(FixtureCorpus.contractVersion, contract['contractVersion']);
  });

  test('seven levels, in contract order, no more and no fewer', () {
    final order = (contract['levelOrder'] as List).cast<String>();
    expect(order.length, 7,
        reason: 'seven levels, not six: offline and unknown are different statements');
    expect(Severity.values.map((e) => e.wireValue).toList(), order);
  });

  test('every strong, surface and border matches severity.json exactly', () {
    final levels = contract['levels'] as Map<String, dynamic>;
    for (final s in Severity.values) {
      final c = (levels[s.wireValue] as Map<String, dynamic>)['color'] as Map<String, dynamic>;
      final t = SeverityTokens.of(s);
      expect(t.strong, hex(c['strong'] as String), reason: '${s.wireValue}.strong drifted');
      expect(t.surface, hex(c['surface'] as String), reason: '${s.wireValue}.surface drifted');
      expect(t.border, hex(c['border'] as String), reason: '${s.wireValue}.border drifted');
    }
  });

  test('labels match the contract in both languages', () {
    final levels = contract['levels'] as Map<String, dynamic>;
    for (final s in Severity.values) {
      final l = (levels[s.wireValue] as Map<String, dynamic>)['label'] as Map<String, dynamic>;
      expect(SeverityTokens.of(s).labelEn, l['en']);
      expect(SeverityTokens.of(s).labelZhHant, l['zh-Hant']);
    }
  });

  test('monitoringCoverage is not a severity value', () {
    final order = (contract['levelOrder'] as List).cast<String>();
    for (final v in ['full', 'partial', 'none']) {
      expect(order.contains(v), isFalse,
          reason: 'coverage is a statement about what exists, severity about a condition');
    }
    expect((contract['notASeverity'] as Map).containsKey('monitoringCoverage'), isTrue);
  });

  test('embedded fixture corpus is byte-identical to the source corpus', () {
    var checked = 0;
    for (final screen in FixtureCorpus.byScreenAndState.keys) {
      for (final entry in FixtureCorpus.byScreenAndState[screen]!.entries) {
        final src = File('../../tests/fixtures/resident-mobile/$screen/${entry.key}.json');
        if (!src.existsSync()) continue;
        expect(jsonDecode(entry.value), jsonDecode(src.readAsStringSync()),
            reason: '$screen/${entry.key} diverged from the source fixture');
        checked++;
      }
    }
    expect(checked, greaterThan(60), reason: 'expected the full corpus to be embedded');
  });
}
