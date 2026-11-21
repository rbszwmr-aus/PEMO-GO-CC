import '../data/models/models.dart';

/// Every state design system section 18 requires, as a sealed hierarchy.
///
/// Sealed, not an enum with a payload field, so an exhaustive `switch` makes a
/// missing state a COMPILE ERROR in every screen that fails to handle it. State
/// coverage is enforced by the type system rather than by a checklist, and it
/// stays enforced if the state-management library is ever replaced.
sealed class ScreenState<T> {
  const ScreenState();
}

/// No server response exists while a request is in flight. Client-rendered.
class Loading<T> extends ScreenState<T> {
  const Loading();
}

class Loaded<T> extends ScreenState<T> {
  const Loaded(this.data);
  final T data;
}

class Empty<T> extends ScreenState<T> {
  const Empty(this.data);
  final T data;
}

/// Server responded, but some sections could not be assembled.
class Partial<T> extends ScreenState<T> {
  const Partial(this.data);
  final T data;
}

/// Server data is older than its freshness window. NEVER rendered as normal.
class Stale<T> extends ScreenState<T> {
  const Stale(this.data, this.freshness);
  final T data;
  final Freshness? freshness;
}

/// The CLIENT has no connection. This is not a severity and never comes from the
/// server: the server cannot know the client's network state. It is data-age
/// presentation over the last successfully retrieved payload, and it must carry
/// an explicit do-not-rely-on-this warning. severity.json notASeverity.clientConnectivity.
class ClientOffline<T> extends ScreenState<T> {
  const ClientOffline({this.lastPayload, this.lastObservedAt});
  final T? lastPayload;
  final DateTime? lastObservedAt;
}

class ScreenError<T> extends ScreenState<T> {
  const ScreenError(this.message);
  final Localized message;
}

class NoPermission<T> extends ScreenState<T> {
  const NoPermission(this.reason);
  final Localized reason;
}

class SessionExpired<T> extends ScreenState<T> {
  const SessionExpired();
}

class IntegrationUnavailable<T> extends ScreenState<T> {
  const IntegrationUnavailable(this.reason);
  final Localized reason;
}

/// A write was submitted twice. The second is absorbed, not re-applied.
class DuplicateSubmission<T> extends ScreenState<T> {
  const DuplicateSubmission(this.data);
  final T data;
}
