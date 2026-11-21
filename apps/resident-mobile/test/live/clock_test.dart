import 'package:flutter_test/flutter_test.dart';
import 'package:pemo_resident_mobile/data/clock.dart';

/// Three time sources, three jobs:
///   age at fetch          -> SERVER clock
///   age growth after fetch -> MONOTONIC clock
///   wall-clock skew        -> device-health signal only
///
/// These tests are hermetic: no server, no network, no real waiting.
void main() {
  group('age growth after fetch uses a monotonic source', () {
    test('age grows by exactly the monotonic elapsed time', () {
      final clock = FakeMonotonicClock();
      final t = FreshnessTracker(
        serverAgeAtFetch: const Duration(seconds: 120),
        windowSeconds: 3600,
        clock: clock,
      );
      expect(t.currentAge, const Duration(seconds: 120));
      clock.advance(const Duration(seconds: 300));
      expect(t.currentAge, const Duration(seconds: 420),
          reason: 'age must be server age at fetch plus monotonic elapsed');
      expect(t.isStale, isFalse);
    });

    test('data becomes stale once monotonic age passes the window', () {
      final clock = FakeMonotonicClock();
      final t = FreshnessTracker(
        serverAgeAtFetch: const Duration(seconds: 3500),
        windowSeconds: 3600,
        clock: clock,
      );
      expect(t.isStale, isFalse);
      clock.advance(const Duration(seconds: 200));
      expect(t.isStale, isTrue,
          reason: 'cached data must go stale on its own as time passes');
    });

    /// THE DANGEROUS DIRECTION.
    ///
    /// A wall clock can jump backwards: NTP correction, a user changing the
    /// time, a daylight-saving defect. If age were computed by subtracting two
    /// DateTime values, a backward jump would make cached data get YOUNGER, and
    /// stale safety data would present as current. No skew threshold catches
    /// this, because the jump is momentary and self-correcting.
    test('moving the WALL clock backwards does not make cached data younger', () {
      final monotonic = FakeMonotonicClock();
      var wallNow = DateTime.parse('2026-08-13T20:00:00+08:00');

      final t = FreshnessTracker(
        serverAgeAtFetch: const Duration(seconds: 3000),
        windowSeconds: 3600,
        clock: monotonic,
      );
      final ageBefore = t.currentAge;

      // The device's wall clock lurches an hour into the past...
      wallNow = wallNow.subtract(const Duration(hours: 1));
      // ...and monotonic time still only moves forward.
      monotonic.advance(const Duration(seconds: 700));

      expect(t.currentAge, greaterThan(ageBefore),
          reason: 'a backward wall-clock jump must never reduce cached age');
      expect(t.currentAge, const Duration(seconds: 3700));
      expect(t.isStale, isTrue,
          reason: 'the data is genuinely stale and a backward clock jump must '
              'not rescue it into looking current');
      expect(wallNow.isBefore(DateTime.parse('2026-08-13T20:00:00+08:00')), isTrue,
          reason: 'sanity: the wall clock really did move backwards');
    });

    test('a monotonic clock refuses to move backwards at all', () {
      final clock = FakeMonotonicClock();
      expect(() => clock.advance(const Duration(seconds: -1)), throwsArgumentError,
          reason: 'a monotonic source that can go backwards is not monotonic, '
              'and a test using one would prove nothing');
    });

    test('the real StopwatchClock is monotonic and non-decreasing', () {
      final c = StopwatchClock();
      final a = c.elapsed;
      final b = c.elapsed;
      expect(b >= a, isTrue);
    });
  });

  group('wall-clock skew is a device-health signal, not the correctness mechanism', () {
    final serverNow = DateTime.parse('2026-08-13T20:00:00+08:00');

    test('device ahead: skew positive, under threshold tolerated', () {
      final skew = ClockSkew(serverNow.add(const Duration(seconds: 90)).difference(serverNow));
      expect(skew.offset, const Duration(seconds: 90));
      expect(skew.exceedsThreshold, isFalse);
      expect(skew.diagnostic, contains('ahead'));
    });

    test('device behind: skew negative, under threshold tolerated', () {
      final skew = ClockSkew(serverNow.subtract(const Duration(seconds: 90)).difference(serverNow));
      expect(skew.offset, const Duration(seconds: -90));
      expect(skew.exceedsThreshold, isFalse);
      expect(skew.diagnostic, contains('behind'));
    });

    test('beyond 120s in EITHER direction the device clock is not trusted', () {
      expect(const ClockSkew(Duration(seconds: 121)).exceedsThreshold, isTrue);
      expect(const ClockSkew(Duration(seconds: -121)).exceedsThreshold, isTrue);
      expect(ClockSkew.threshold, const Duration(seconds: 120));
    });

    test('the threshold is a bounded error, not an impossibility', () {
      // Against a 3600s window a 120s skew misclassifies anything whose true age
      // is within 3.3% of the boundary. Stated as a bound, because a claim
      // stated more strongly than it is true gets inherited as a guarantee.
      const window = 3600;
      final bandFraction = ClockSkew.threshold.inSeconds / window;
      expect(bandFraction, closeTo(0.033, 0.001));
    });

    test('skew is diagnostic text, and carries nothing resident-facing', () {
      final d = const ClockSkew(Duration(seconds: 300)).diagnostic;
      expect(d, contains('clock skew'));
      for (final resident in ['safe', 'normal', 'alert', 'emergency', '正常', '緊急']) {
        expect(d.toLowerCase(), isNot(contains(resident)),
            reason: 'skew diagnostics must never leak into resident-facing wording');
      }
    });
  });
}
