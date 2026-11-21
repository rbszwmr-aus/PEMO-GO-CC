import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../l10n/app_localizations.dart';
import '../state/screen_state.dart';
import 'pemo_widgets.dart';

/// Renders every design system section 18 state.
///
/// The `switch` is exhaustive over the sealed [ScreenState] hierarchy, so adding
/// a state to the hierarchy without handling it here is a COMPILE ERROR rather
/// than a screen that silently renders nothing.
class ScreenStateView<T> extends StatelessWidget {
  const ScreenStateView({
    super.key,
    required this.state,
    required this.localeCode,
    required this.builder,
  });

  final ScreenState<T> state;
  final String localeCode;

  /// Renders the data. [stale] is passed through so the screen can never treat
  /// stale data as ordinary loaded data by accident.
  final Widget Function(BuildContext context, T data, {required bool stale}) builder;

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context)!;
    return switch (state) {
      Loading<T>() => const Center(
          key: Key('loading-state'),
          child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()),
        ),
      Loaded<T>(:final data) => builder(context, data, stale: false),
      Partial<T>(:final data) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            key: const Key('partial-state'),
            padding: const EdgeInsets.only(bottom: 12),
            child: PemoErrorState(
              message: t.statePartial,
            ),
          ),
          Expanded(child: builder(context, data, stale: false)),
        ]),
      // Stale is NOT collapsed into Loaded. Design system 3.1: stale data must
      // never render as normal.
      Stale<T>(:final data) => builder(context, data, stale: true),
      Empty<T>(:final data) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          PemoEmptyState(message: t.stateEmpty),
          Expanded(child: builder(context, data, stale: false)),
        ]),
      DuplicateSubmission<T>(:final data) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            key: const Key('duplicate-submission-state'),
            padding: const EdgeInsets.only(bottom: 12),
            child: PemoEmptyState(
              message: t.stateDuplicateSubmission,
            ),
          ),
          Expanded(child: builder(context, data, stale: false)),
        ]),
      ClientOffline<T>(:final lastPayload, :final lastObservedAt) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            PemoOfflineState(localeCode: localeCode, lastObservedAt: lastObservedAt),
            if (lastPayload != null) ...[
              const SizedBox(height: 12),
              // Rendered as STALE: the payload predates the connection loss.
              Expanded(child: builder(context, lastPayload, stale: true)),
            ],
          ],
        ),
      ScreenError<T>(:final message) => PemoErrorState(message: message.forLocale(localeCode)),
      NoPermission<T>(:final reason) => PemoErrorState(message: reason.forLocale(localeCode)),
      SessionExpired<T>() => PemoErrorState(
          message: t.stateSessionExpired,
        ),
      IntegrationUnavailable<T>(:final reason) => PemoErrorState(message: reason.forLocale(localeCode)),
    };
  }
}

/// Wraps an async provider.
///
/// A provider that FAILS renders an error state, never an endless spinner. An
/// endless spinner hides the failure: it looks like slow loading, and in a test
/// it looks like a timeout rather than the exception that actually occurred.
class AsyncStateView<T> extends StatelessWidget {
  const AsyncStateView({
    super.key,
    required this.async,
    required this.localeCode,
    required this.builder,
  });

  final AsyncValue<ScreenState<T>> async;
  final String localeCode;
  final Widget Function(BuildContext context, T data, {required bool stale}) builder;

  @override
  Widget build(BuildContext context) => async.when(
        loading: () => const Center(
          key: Key('loading-state'),
          child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()),
        ),
        error: (e, _) => PemoErrorState(key: const Key('provider-error'), message: '$e'),
        data: (state) => ScreenStateView<T>(state: state, localeCode: localeCode, builder: builder),
      );
}
