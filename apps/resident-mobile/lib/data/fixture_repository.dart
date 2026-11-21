import 'dart:convert';

import 'fixture_corpus.g.dart';
import 'models/models.dart';
import 'models/payloads.dart';
import 'safety_repository.dart';
import '../state/screen_state.dart';

/// Fixture-backed implementation reading the corpus embedded from the pinned
/// commit. No HTTP, no base URL, no timers.
///
/// A fixture-backed shell is not proof of a working product, a working
/// integration or any safety capability.
class FixtureSafetyRepository implements SafetyRepository {
  FixtureSafetyRepository();

  final Set<String> _acknowledged = <String>{};

  Map<String, dynamic>? _raw(String screen, String state) {
    final s = FixtureCorpus.byScreenAndState[screen];
    final j = s?[state];
    if (j == null) return null;
    return jsonDecode(j) as Map<String, dynamic>;
  }

  /// Maps a fixture state name onto the sealed [ScreenState] hierarchy.
  ///
  /// `stale` is deliberately NOT collapsed into `Loaded`: design system 3.1
  /// requires stale data never render as normal, and the type keeps that
  /// distinction alive all the way to the widget.
  /// Maps a fixture onto the sealed [ScreenState] hierarchy.
  ///
  /// Error fixtures are RFC 7807 problem+json (`type`, `status`,
  /// `residentMessage`), not a payload with an error field, so the HTTP status
  /// is what selects the state. Mapping on `status` rather than on the fixture's
  /// file name means a new error fixture lands in the right state without this
  /// switch being edited.
  ///
  /// `stale` is deliberately NOT collapsed into `Loaded`: design system 3.1
  /// requires stale data never render as normal, and the type keeps that
  /// distinction alive all the way to the widget.
  ScreenState<T> _wrap<T>(String screen, String state, T Function(Map<String, dynamic>) parse) {
    if (state == 'loading') return Loading<T>();

    if (state == 'offline') {
      // Client connectivity. The server never emits this: it cannot know it.
      final last = _raw(screen, 'default');
      return ClientOffline<T>(
        lastPayload: last == null ? null : parse(last),
        lastObservedAt:
            last == null ? null : Meta.fromJson(last['meta'] as Map<String, dynamic>).generatedAt,
      );
    }

    final raw = _raw(screen, state) ?? _raw(screen, 'default');
    if (raw == null) return Loading<T>();

    // RFC 7807 problem+json.
    if (raw.containsKey('status') && raw.containsKey('type')) {
      final msg = Localized.maybe(raw['residentMessage']) ??
          const Localized(en: 'Something went wrong', zhHant: '發生錯誤');
      switch (raw['status'] as int) {
        case 401:
          return SessionExpired<T>();
        case 403:
          return NoPermission<T>(msg);
        case 409:
          final d = _raw(screen, 'default');
          return d == null ? ScreenError<T>(msg) : DuplicateSubmission<T>(parse(d));
        case 503:
          return IntegrationUnavailable<T>(msg);
        default:
          return ScreenError<T>(msg);
      }
    }

    final data = parse(raw);
    switch (state) {
      case 'empty':
        return Empty<T>(data);
      case 'partial':
        return Partial<T>(data);
      case 'stale':
        final f = (raw['safety'] as Map<String, dynamic>?)?['freshness'];
        return Stale<T>(data, f == null ? null : Freshness.fromJson(f as Map<String, dynamic>));
      default:
        return Loaded<T>(data);
    }
  }

  @override
  Future<ScreenState<HomePayload>> home({String state = 'default'}) async =>
      _wrap('mob-02-home', state, HomePayload.fromJson);

  @override
  Future<ScreenState<ServicesPayload>> services({String state = 'default'}) async =>
      _wrap('mob-03-services', state, ServicesPayload.fromJson);

  @override
  Future<ScreenState<SafetyOverviewPayload>> safetyOverview({String state = 'default'}) async =>
      _wrap('mob-08-safety-overview', state, SafetyOverviewPayload.fromJson);

  @override
  Future<ScreenState<SafetyEventPayload>> safetyEvent({String state = 'default'}) async =>
      _wrap('mob-09-safety-event-detail', state, SafetyEventPayload.fromJson);

  @override
  Future<ScreenState<AccountPayload>> account({String state = 'default'}) async =>
      _wrap('mob-11-account', state, AccountPayload.fromJson);

  @override
  Future<AcknowledgeResult> acknowledge(String eventId) async {
    if (_acknowledged.contains(eventId)) {
      return const AcknowledgeResult(AcknowledgeOutcome.alreadyRecorded, null);
    }
    _acknowledged.add(eventId);
    return AcknowledgeResult(AcknowledgeOutcome.recorded, DateTime.now());
  }
}
