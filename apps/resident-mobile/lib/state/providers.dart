import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/fixture_repository.dart';
import '../data/models/payloads.dart';
import '../data/safety_repository.dart';
import 'screen_state.dart';

/// Overridden in tests via ProviderScope(overrides:) so any design system
/// section 18 state is reachable with no network, no timer and no manual tap.
final repositoryProvider = Provider<SafetyRepository>((ref) => FixtureSafetyRepository());

/// Which fixture state to render. Tests override this to drive a screen into
/// any state directly.
final fixtureStateProvider = Provider<String>((ref) => 'default');

final localeCodeProvider = Provider<String>((ref) => 'en');

final homeProvider = FutureProvider<ScreenState<HomePayload>>(
    (ref) => ref.watch(repositoryProvider).home(state: ref.watch(fixtureStateProvider)));
final servicesProvider = FutureProvider<ScreenState<ServicesPayload>>(
    (ref) => ref.watch(repositoryProvider).services(state: ref.watch(fixtureStateProvider)));
final safetyOverviewProvider = FutureProvider<ScreenState<SafetyOverviewPayload>>(
    (ref) => ref.watch(repositoryProvider).safetyOverview(state: ref.watch(fixtureStateProvider)));
final safetyEventProvider = FutureProvider<ScreenState<SafetyEventPayload>>(
    (ref) => ref.watch(repositoryProvider).safetyEvent(state: ref.watch(fixtureStateProvider)));
final accountProvider = FutureProvider<ScreenState<AccountPayload>>(
    (ref) => ref.watch(repositoryProvider).account(state: ref.watch(fixtureStateProvider)));

/// In-flight acknowledgement state, so a double tap cannot produce two effects.
class AcknowledgeController extends StateNotifier<AcknowledgeUiState> {
  AcknowledgeController(this._repo) : super(const AcknowledgeUiState.idle());
  final SafetyRepository _repo;

  Future<void> acknowledge(String eventId) async {
    if (state.inFlight || state.done) return; // idempotent from the UI side
    state = const AcknowledgeUiState(inFlight: true, done: false);
    final r = await _repo.acknowledge(eventId);
    state = AcknowledgeUiState(inFlight: false, done: true, at: r.acknowledgedAt);
  }
}

class AcknowledgeUiState {
  const AcknowledgeUiState({required this.inFlight, required this.done, this.at});
  const AcknowledgeUiState.idle() : inFlight = false, done = false, at = null;
  final bool inFlight;
  final bool done;
  final DateTime? at;
}

final acknowledgeProvider =
    StateNotifierProvider<AcknowledgeController, AcknowledgeUiState>(
        (ref) => AcknowledgeController(ref.watch(repositoryProvider)));
