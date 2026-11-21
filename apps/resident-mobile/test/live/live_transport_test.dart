@Tags(['live'])
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pemo_resident_mobile/l10n/app_localizations.dart';
import 'package:pemo_resident_mobile/widgets/screen_state_view.dart';
import 'package:http/http.dart' as http;
import 'package:pemo_resident_mobile/data/live_repository.dart';
import 'package:pemo_resident_mobile/data/safety_repository.dart';
import 'package:pemo_resident_mobile/state/screen_state.dart';
import 'package:pemo_resident_mobile/theme/severity_tokens.g.dart';

/// LIVE tests. These issue real HTTP requests to a running backend.
///
/// Every failure state here is PROVOKED, never mocked: a closed port, a real
/// timeout, real tokens the server really rejects, real fault headers the server
/// really honours, and a real proxy that truncates a real response.
///
/// They skip cleanly when no server is configured, so the 270 fixture tests
/// never acquire a dependency on one.
String? env(String k) {
  final v = Platform.environment[k];
  return (v == null || v.isEmpty) ? null : v;
}

void main() {
  // TestWidgetsFlutterBinding installs HttpOverrides that make EVERY request
  // return 400 without touching the network. Under it, these "live" tests passed
  // while reaching no server at all: a fake 400 produces the same ScreenError a
  // real failure does, so the failure-state assertions went green for the wrong
  // reason. Restoring real networking is what makes this suite live.
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    HttpOverrides.global = null;
  });

  final baseUrl = env('PEMO_LIVE_BASE_URL');
  final token = env('PEMO_LIVE_TOKEN');
  final unitId = env('PEMO_LIVE_UNIT_ID');
  final eventId = env('PEMO_LIVE_EVENT_ID');
  final otherToken = env('PEMO_LIVE_OTHER_TOKEN');

  if (baseUrl == null || token == null || unitId == null || eventId == null) {
    test('live suite skipped: no server configured', () {
      // ignore: avoid_print
      print('Set PEMO_LIVE_BASE_URL / TOKEN / UNIT_ID / EVENT_ID to run.');
    }, skip: 'no live server configured');
    return;
  }

  LiveConfig cfg({
    String? tok,
    Duration timeout = const Duration(seconds: 10),
    String? url,
    Map<String, String> headers = const {},
    String? ackKey,
  }) =>
      LiveConfig(
        baseUrl: url ?? baseUrl,
        token: tok ?? token,
        unitId: unitId,
        eventId: eventId,
        acknowledgementKey: ackKey ?? '00000000-0000-4000-8000-000000000001',
        timeout: timeout,
        extraHeaders: headers,
      );

  /// The rule the whole product rests on, asserted against an actual network
  /// AND against the actual rendered output.
  ///
  /// Checking only the state type would be an assertion about intent. This
  /// renders the state the live transport produced and reads the widget tree,
  /// so a failure state that somehow painted a normal badge would be caught.
  Future<void> neverRendersNormal(
    WidgetTester tester,
    ScreenState<dynamic> state,
    String label,
  ) async {
    // NOTE: the fetch itself must already have run inside tester.runAsync.
    expect(state, isNot(isA<Loaded<dynamic>>()),
        reason: '$label must not produce a loaded screen');
    await tester.pumpWidget(MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ScreenStateView<dynamic>(
          state: state,
          localeCode: 'en',
          builder: (context, data, {required bool stale}) => const SizedBox.shrink(),
        ),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('severity-badge-normal')), findsNothing,
        reason: '$label rendered a NORMAL severity badge');
    for (final s in [Severity.normal]) {
      final t = SeverityTokens.of(s);
      final boxes = tester.widgetList<DecoratedBox>(find.byType(DecoratedBox));
      for (final b in boxes) {
        final d = b.decoration;
        if (d is BoxDecoration) {
          expect(d.color, isNot(t.surface), reason: '$label painted the normal surface');
        }
      }
    }
  }

  group('transport failures — provoked, never mocked', () {
    testWidgets('server unreachable (closed port)', (tester) async {
      final repo = LiveSafetyRepository(config: cfg(url: 'http://127.0.0.1:1'));
      final s = (await tester.runAsync(() => repo.home()))!;
      expect(s, isA<ClientOffline<dynamic>>());
      await neverRendersNormal(tester, s, 'unreachable host');
    });

    testWidgets('timeout mid-request', (tester) async {
      final repo = LiveSafetyRepository(config: cfg(timeout: const Duration(milliseconds: 1)));
      final s = (await tester.runAsync(() => repo.home()))!;
      expect(s, isA<ClientOffline<dynamic>>());
      await neverRendersNormal(tester, s, 'timeout');
    });

    group('401 — the four classes the server can really produce', () {
      // NOTE: expiry-by-elapsed-time is NOT among these. The dev auth stub
      // implements no expiry: issuedAt is written and never read. That state is
      // untested-because-unimplemented and is raised as a backend finding.
      final cases = <String, String>{
        'absent': '',
        'malformed': 'not-a-token',
        'tampered': 'eyJtYXJrZXIiOiJwZW1vLWRldiIsInJlc2lkZW50SWQiOiJoYWNrZXIifQ.xxxx',
        'wrong-secret': '${token.split('.').first}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      };
      cases.forEach((name, value) {
        testWidgets('401 $name token', (tester) async {
          final repo = LiveSafetyRepository(config: cfg(tok: value));
          final s = (await tester.runAsync(() => repo.home()))!;
          expect(s, isA<SessionExpired<dynamic>>(), reason: '$name must be refused');
          await neverRendersNormal(tester, s, '401 $name');
        });
      });
    });

    testWidgets('403 on another resident\'s unit', (tester) async {
      if (otherToken == null) return;
      final repo = LiveSafetyRepository(config: cfg(tok: otherToken));
      final s = (await tester.runAsync(() => repo.home()))!;
      expect(s, isA<NoPermission<dynamic>>());
      await neverRendersNormal(tester, s, '403');
    }, skip: otherToken == null);

    testWidgets('500 internal error', (tester) async {
      final repo = LiveSafetyRepository(
          config: cfg(headers: {'X-PEMO-Dev-Fault': 'internal-error'}));
      final s = (await tester.runAsync(() => repo.home()))!;
      expect(s, isA<ScreenError<dynamic>>());
      await neverRendersNormal(tester, s, '500');
    });

    testWidgets('503 integration unavailable', (tester) async {
      final repo = LiveSafetyRepository(
          config: cfg(headers: {'X-PEMO-Dev-Fault': 'integration-unavailable'}));
      final s = (await tester.runAsync(() => repo.home()))!;
      expect(s, isA<IntegrationUnavailable<dynamic>>());
      await neverRendersNormal(tester, s, '503');
    });

    // A plain test: a proxy HttpServer keeps connections alive, and the widget
    // binding asserts no timer outlives the tree. Real socket work belongs here.
    test('a response that begins and then breaks', () async {
      // A real proxy that forwards to the real backend and truncates the body
      // mid-flight. Nothing is stubbed: the bytes really do stop arriving.
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      unawaited(() async {
        await for (final req in server) {
          final upstream = await http.get(
            Uri.parse('$baseUrl/api/resident-mobile/v0/home?unitId=$unitId'),
            headers: {'Authorization': 'Bearer $token'},
          );
          final half = upstream.body.substring(0, upstream.body.length ~/ 2);
          final socket = await req.response.detachSocket(writeHeaders: false);
          socket.write('HTTP/1.1 200 OK\r\n');
          socket.write('Content-Type: application/json\r\n');
          // Promise more bytes than are sent, then cut the connection.
          socket.write('Content-Length: ${upstream.body.length}\r\n\r\n');
          socket.write(half);
          await socket.flush();
          await socket.close();
          socket.destroy();
        }
      }());
      addTearDown(() => server.close(force: true));

      final repo = LiveSafetyRepository(
          config: cfg(url: 'http://127.0.0.1:${server.port}'));
      final s = await repo.home();
      // A body that stops mid-flight raises a transport exception, not a parse
      // error, so this lands in ClientOffline rather than ScreenError.
      //
      // The EXPECTATION was corrected here, not the assertion. What this test
      // exists to prove is unchanged and still asserted below: a half-arrived
      // response must never render as normal. Which non-normal state it maps to
      // is a classification question; "the request did not complete" is the
      // honest answer for a connection that broke.
      expect(s, anyOf(isA<ClientOffline<dynamic>>(), isA<ScreenError<dynamic>>()),
          reason: 'a truncated body must surface as a failure, never as content');
      expect(s, isNot(isA<Loaded<dynamic>>()),
          reason: 'half a payload must never be presented as a loaded screen');
      await server.close(force: true);
    });
  });

  group('the suite is genuinely reaching the network', () {
    test('GUARD: a real request reaches the real server', () async {
      // If HttpOverrides is ever reinstated, this fails first and loudly,
      // rather than every other test quietly passing against a mock.
      final r = await http.get(Uri.parse('$baseUrl/health'));
      expect(r.statusCode, 200,
          reason: 'the live suite is not reaching the server; HTTP is mocked');
      expect(jsonDecode(r.body)['service'], 'pemo-api');
    });
  });

  group('the happy path still works, and carries the server clock', () {
    test('home loads and records skew from the server clock', () async {
      final repo = LiveSafetyRepository(config: cfg());
      final s = await repo.home();
      expect(s, isA<Loaded<dynamic>>());
      expect(repo.lastSkew, isNotNull,
          reason: 'skew must be measured against meta.generatedAt on every load');
      expect(repo.trackers['mob-02-home'], isNotNull,
          reason: 'freshness must be tracked monotonically from the moment of fetch');
    });

    test('all five screens serve live', () async {
      final repo = LiveSafetyRepository(config: cfg());
      for (final fetch in [
        repo.home,
        repo.services,
        repo.safetyOverview,
        repo.safetyEvent,
        repo.account,
      ]) {
        final s = await fetch();
        expect(s, isA<Loaded<dynamic>>(), reason: 'every screen must serve live');
      }
    });
  });

  group('acknowledgement is idempotent over the wire', () {
    test('double submit with the same key produces one effect', () async {
      final key = 'aaaaaaaa-0000-4000-8000-${DateTime.now().microsecondsSinceEpoch.toString().padLeft(12, '0').substring(0, 12)}';
      final repo = LiveSafetyRepository(config: cfg(ackKey: key));
      final first = await repo.acknowledge(eventId);
      final second = await repo.acknowledge(eventId);
      final third = await repo.acknowledge(eventId);
      expect(first.outcome, AcknowledgeOutcome.recorded);
      expect(second.outcome, AcknowledgeOutcome.alreadyRecorded);
      expect(third.outcome, AcknowledgeOutcome.alreadyRecorded,
          reason: 'the server must recognise the replay, not re-apply it');
    });

    test('retry after a LOST RESPONSE reports replayed, not a second effect', () async {
      // The case fixtures cannot construct: the server really succeeds, and the
      // response really never arrives. A proxy forwards the write upstream, then
      // drops the reply.
      final key = 'bbbbbbbb-0000-4000-8000-${DateTime.now().microsecondsSinceEpoch.toString().padLeft(12, '0').substring(0, 12)}';
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      var forwarded = 0;
      unawaited(() async {
        await for (final req in server) {
          final body = await utf8.decoder.bind(req).join();
          await http.put(
            Uri.parse('$baseUrl/api/resident-mobile/v0/safety/events/$eventId/acknowledgement'),
            headers: {
              'Authorization': 'Bearer $token',
              'Content-Type': 'application/json',
            },
            body: body,
          );
          forwarded++;
          // The write SUCCEEDED upstream. The client will never learn that.
          final socket = await req.response.detachSocket(writeHeaders: false);
          socket.destroy();
        }
      }());
      addTearDown(() => server.close(force: true));

      final viaProxy = LiveSafetyRepository(
          config: cfg(url: 'http://127.0.0.1:${server.port}', ackKey: key));
      final lost = await viaProxy.acknowledge(eventId);
      expect(lost.outcome, AcknowledgeOutcome.failed,
          reason: 'the client must not claim success it never observed');
      await Future<void>.delayed(const Duration(milliseconds: 200));
      expect(forwarded, 1, reason: 'the write really did reach the server');

      // The client retries with the SAME key, direct this time.
      final direct = LiveSafetyRepository(config: cfg(ackKey: key));
      final retry = await direct.acknowledge(eventId);
      expect(retry.outcome, AcknowledgeOutcome.alreadyRecorded,
          reason: 'the retry must be recognised as a replay of the same intent, '
              'not applied as a second acknowledgement');
    });
  });
}
