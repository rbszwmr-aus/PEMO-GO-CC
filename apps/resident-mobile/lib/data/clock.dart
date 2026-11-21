/// Time in this client comes from three different sources doing three different
/// jobs. Conflating them is how a threshold ends up believed to be a guarantee.
///
///   1. AGE AT FETCH      -> the SERVER's clock. The response carries
///                           meta.generatedAt and safety.observedAt, and the
///                           server has already derived freshness from them.
///                           The device clock never enters this arithmetic.
///
///   2. AGE GROWTH AFTER FETCH -> a MONOTONIC clock. Something local has to tick
///                           between fetches, and it must not be wall clock.
///                           Wall clocks jump: NTP correction, a user changing
///                           the time, a daylight-saving defect. A BACKWARD jump
///                           makes cached data get younger, which is the
///                           dangerous direction, and no skew threshold detects
///                           it because the skew is momentary and self-correcting.
///
///   3. WALL-CLOCK SKEW   -> a DEVICE-HEALTH signal, not the correctness
///                           mechanism. Reported in diagnostics, never to a
///                           resident.
library;

/// A monotonic time source. Never goes backwards, whatever the wall clock does.
abstract interface class MonotonicClock {
  Duration get elapsed;
}

class StopwatchClock implements MonotonicClock {
  StopwatchClock() : _sw = Stopwatch()..start();
  final Stopwatch _sw;
  @override
  Duration get elapsed => _sw.elapsed;
}

/// Test double. Advances only when a test says so, and cannot be moved back:
/// [advance] rejects a negative duration, because a monotonic clock that can go
/// backwards is not a monotonic clock and a test using one proves nothing.
class FakeMonotonicClock implements MonotonicClock {
  Duration _elapsed = Duration.zero;
  @override
  Duration get elapsed => _elapsed;
  void advance(Duration d) {
    if (d.isNegative) {
      throw ArgumentError('A monotonic clock cannot go backwards.');
    }
    _elapsed += d;
  }
}

/// The wall clock, injectable so a test can move it backwards on purpose.
typedef WallClock = DateTime Function();

/// How far the device's wall clock is from the server's, and what to do about it.
class ClockSkew {
  const ClockSkew(this.offset);

  /// deviceNow - serverGeneratedAt. Positive means the device is AHEAD.
  final Duration offset;

  /// Beyond this, the client stops trusting its own wall clock for anything
  /// resident-visible and degrades to `unknown`.
  ///
  /// 120 seconds. Against the 3600-second freshness window this is a BOUNDED
  /// ERROR, not an impossibility: a 120-second skew misclassifies any datum
  /// whose true age falls within 3.3% of the boundary. It is chosen because it
  /// sits far outside ordinary NTP drift, so exceeding it indicates a genuinely
  /// wrong clock rather than jitter.
  ///
  /// Degrading to `unknown` rather than `normal` or `offline` is deliberate:
  /// neither "everything is fine" nor "the service is not reporting" is true.
  /// What is true is that the condition cannot be determined.
  static const threshold = Duration(seconds: 120);

  bool get exceedsThreshold => offset.abs() > threshold;

  /// Diagnostics only. Never rendered to a resident.
  String get diagnostic =>
      'clock skew ${offset.inSeconds}s (device ${offset.isNegative ? 'behind' : 'ahead of'} server)';
}

/// Tracks how old a payload is, from the moment it arrived.
///
/// [serverAgeAtFetch] is the server's own answer. Growth is monotonic. There is
/// deliberately no code path here that subtracts two DateTime values.
class FreshnessTracker {
  FreshnessTracker({
    required this.serverAgeAtFetch,
    required this.windowSeconds,
    required MonotonicClock clock,
  })  : _clock = clock,
        _elapsedAtFetch = clock.elapsed;

  final Duration serverAgeAtFetch;
  final int windowSeconds;
  final MonotonicClock _clock;
  final Duration _elapsedAtFetch;

  /// Age now: what the server said, plus monotonic time since it arrived.
  Duration get currentAge => serverAgeAtFetch + (_clock.elapsed - _elapsedAtFetch);

  bool get isStale => currentAge.inSeconds > windowSeconds;
}
