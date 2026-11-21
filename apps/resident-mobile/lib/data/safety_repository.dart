import 'models/payloads.dart';
import '../state/screen_state.dart';

/// The single swap seam.
///
/// When GEN-006-ST lands, a live implementation of this interface replaces
/// [FixtureSafetyRepository] and nothing else changes: no screen, no widget, no
/// state class. There is deliberately no HTTP client, no base URL and no network
/// permission anywhere in this application.
abstract interface class SafetyRepository {
  Future<ScreenState<HomePayload>> home({String state = 'default'});
  Future<ScreenState<ServicesPayload>> services({String state = 'default'});
  Future<ScreenState<SafetyOverviewPayload>> safetyOverview({String state = 'default'});
  Future<ScreenState<SafetyEventPayload>> safetyEvent({String state = 'default'});
  Future<ScreenState<AccountPayload>> account({String state = 'default'});

  /// Idempotent from the UI side: acknowledging twice produces one effect.
  Future<AcknowledgeResult> acknowledge(String eventId);
}

/// [failed] is distinct from [alreadyRecorded] on purpose.
///
/// An early version of the live client mapped every non-2xx to alreadyRecorded,
/// which reports a transport failure as a completed acknowledgement — the client
/// telling a resident their "I am safe" was recorded when it may not have been.
/// Only a 409 duplicate-acknowledgement means already recorded.
enum AcknowledgeOutcome { recorded, alreadyRecorded, failed }

class AcknowledgeResult {
  const AcknowledgeResult(this.outcome, this.acknowledgedAt);
  final AcknowledgeOutcome outcome;
  final DateTime? acknowledgedAt;
}
