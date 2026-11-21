import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../state/screen_state.dart';
import 'clock.dart';
import 'models/models.dart';
import 'models/payloads.dart';
import 'safety_repository.dart';

/// Live implementation of [SafetyRepository].
///
/// Added ALONGSIDE FixtureSafetyRepository, which is untouched: the fixture
/// suite is the contract-conformance evidence and it keeps running exactly as
/// it did. This class is the swap seam UI-007-ST built for.
///
/// Localhost, development only. See LiveConfig.
class LiveSafetyRepository implements SafetyRepository {
  LiveSafetyRepository({
    required this.config,
    http.Client? client,
    MonotonicClock? monotonic,
    WallClock? wallClock,
  })  : _client = client ?? http.Client(),
        _monotonic = monotonic ?? StopwatchClock(),
        _wallClock = wallClock ?? DateTime.now;

  final LiveConfig config;
  final http.Client _client;
  final MonotonicClock _monotonic;
  final WallClock _wallClock;

  /// Last observed skew, for diagnostics. Never rendered to a resident.
  ClockSkew? lastSkew;

  /// Freshness trackers keyed by screen, so age grows monotonically after fetch.
  final Map<String, FreshnessTracker> trackers = {};

  Uri _url(String path, [Map<String, String>? query]) =>
      Uri.parse('${config.baseUrl}/api/resident-mobile/v0/$path')
          .replace(queryParameters: {if (query != null) ...query});

  Map<String, String> get _headers => {
        'Authorization': 'Bearer ${config.token}',
        'Accept': 'application/json',
        ...config.extraHeaders,
      };

  /// Every transport outcome maps onto the sealed ScreenState hierarchy.
  ///
  /// NONE of these may render as normal. That is the rule the whole product
  /// rests on, and until this PID it had never been exercised against an actual
  /// network.
  Future<ScreenState<T>> _fetch<T>(
    String screen,
    String path,
    T Function(Map<String, dynamic>) parse, {
    Map<String, String>? query,
  }) async {
    late final http.Response response;
    try {
      response = await _client
          .get(_url(path, query), headers: _headers)
          .timeout(config.timeout);
    } on TimeoutException {
      return ClientOffline<T>(lastObservedAt: null);
    } catch (_) {
      // Unreachable host, connection refused, DNS failure, socket reset, and a
      // response that begins and then breaks all land here. A resident is told
      // the app cannot reach the service; they are never told everything is fine.
      return ClientOffline<T>(lastObservedAt: null);
    }

    Map<String, dynamic> body;
    try {
      body = jsonDecode(response.body) as Map<String, dynamic>;
    } on FormatException {
      // A truncated or non-JSON body. Not normal, not silently empty.
      return ScreenError<T>(const Localized(
        en: 'The service sent a response we could not read.',
        zhHant: '服務回應無法解讀。',
      ));
    }

    if (response.statusCode >= 400) return _problem<T>(response.statusCode, body);

    _recordSkew(body);
    _track(screen, body);
    return Loaded<T>(parse(body));
  }

  /// RFC 7807. Discriminated by `type` URI, NEVER by status code alone: the
  /// backend returns 409 for both unit quarantine and duplicate acknowledgement,
  /// deliberately, and only the type tells them apart.
  ScreenState<T> _problem<T>(int status, Map<String, dynamic> body) {
    final type = body['type'] as String? ?? '';
    final message = Localized.maybe(body['residentMessage']) ??
        const Localized(en: 'Something went wrong.', zhHant: '發生錯誤。');

    if (type.endsWith('/session-expired')) return SessionExpired<T>();
    if (type.endsWith('/not-authorized')) return NoPermission<T>(message);
    if (type.endsWith('/integration-unavailable')) return IntegrationUnavailable<T>(message);
    if (type.endsWith('/unit-not-mapped')) {
      // Quarantine. A condition PEMO should be able to classify and cannot.
      return ScreenError<T>(message);
    }
    return ScreenError<T>(message);
  }

  /// Skew is measured, recorded, and used ONLY to decide whether the device's
  /// own sense of time is trustworthy. It is never shown to a resident.
  void _recordSkew(Map<String, dynamic> body) {
    final generatedAt = (body['meta'] as Map<String, dynamic>?)?['generatedAt'] as String?;
    if (generatedAt == null) return;
    lastSkew = ClockSkew(_wallClock().difference(DateTime.parse(generatedAt)));
  }

  void _track(String screen, Map<String, dynamic> body) {
    final f = (body['safety'] as Map<String, dynamic>?)?['freshness'];
    if (f == null) return;
    final freshness = Freshness.fromJson(f as Map<String, dynamic>);
    trackers[screen] = FreshnessTracker(
      serverAgeAtFetch: Duration(seconds: freshness.ageSeconds),
      windowSeconds: freshness.windowSeconds,
      clock: _monotonic,
    );
  }

  @override
  Future<ScreenState<HomePayload>> home({String state = 'default'}) =>
      _fetch('mob-02-home', 'home', HomePayload.fromJson, query: {'unitId': config.unitId});

  @override
  Future<ScreenState<ServicesPayload>> services({String state = 'default'}) =>
      _fetch('mob-03-services', 'services', ServicesPayload.fromJson, query: {'unitId': config.unitId});

  @override
  Future<ScreenState<SafetyOverviewPayload>> safetyOverview({String state = 'default'}) => _fetch(
      'mob-08-safety-overview', 'safety/overview', SafetyOverviewPayload.fromJson,
      query: {'unitId': config.unitId});

  @override
  Future<ScreenState<SafetyEventPayload>> safetyEvent({String state = 'default'}) => _fetch(
      'mob-09-safety-event-detail', 'safety/events/${config.eventId}', SafetyEventPayload.fromJson);

  @override
  Future<ScreenState<AccountPayload>> account({String state = 'default'}) =>
      _fetch('mob-11-account', 'account', AccountPayload.fromJson);

  /// The one write path. Idempotent over the wire on the client-supplied key.
  ///
  /// The key is generated ONCE per resident intent and reused on every retry.
  /// Generating a new key per attempt would make each retry a new intent, which
  /// is precisely the bug idempotency keys exist to prevent.
  @override
  Future<AcknowledgeResult> acknowledge(String eventId) async {
    final key = config.acknowledgementKey;
    try {
      final response = await _client
          .put(
            _url('safety/events/$eventId/acknowledgement'),
            headers: {..._headers, 'Content-Type': 'application/json'},
            body: jsonEncode({'acknowledgementKey': key, 'action': 'i_am_safe'}),
          )
          .timeout(config.timeout);

      if (response.statusCode >= 400) {
        final type = (jsonDecode(response.body) as Map<String, dynamic>)['type'] as String? ?? '';
        // 409 is returned for BOTH unit quarantine and duplicate acknowledgement.
        // Only the type URI separates them; the status code cannot.
        if (type.endsWith('/duplicate-acknowledgement')) {
          return const AcknowledgeResult(AcknowledgeOutcome.alreadyRecorded, null);
        }
        return const AcknowledgeResult(AcknowledgeOutcome.failed, null);
      }
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final replayed = body['replayed'] as bool? ?? false;
      final at = (body['acknowledgement'] as Map<String, dynamic>?)?['acknowledgedAt'] as String?;
      return AcknowledgeResult(
        replayed ? AcknowledgeOutcome.alreadyRecorded : AcknowledgeOutcome.recorded,
        at == null ? null : DateTime.parse(at),
      );
    } catch (_) {
      // The lost-response case. The server may well have succeeded, but the
      // client cannot observe that and must NOT claim it: reporting success it
      // did not see is how a resident is told they are recorded as safe when
      // they may not be. It retries with the SAME key so the server can
      // recognise the replay.
      return const AcknowledgeResult(AcknowledgeOutcome.failed, null);
    }
  }
}

/// Base URL, token and identifiers come from configuration. Never hardcoded.
class LiveConfig {
  const LiveConfig({
    required this.baseUrl,
    required this.token,
    required this.unitId,
    required this.eventId,
    required this.acknowledgementKey,
    this.timeout = const Duration(seconds: 10),
    this.extraHeaders = const {},
  });

  final String baseUrl;
  final String token;
  final String unitId;
  final String eventId;

  /// One key per resident intent, reused across retries.
  final String acknowledgementKey;
  final Duration timeout;
  final Map<String, String> extraHeaders;
}
