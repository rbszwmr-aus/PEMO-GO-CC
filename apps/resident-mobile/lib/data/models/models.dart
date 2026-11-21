import '../../theme/severity_tokens.g.dart';

/// Bilingual copy as the contract carries it. Both languages come from the
/// server payload: no safety string is concatenated, invented or translated
/// in the client. Design system section 16.
class Localized {
  const Localized({required this.en, required this.zhHant});
  final String en;
  final String zhHant;

  factory Localized.fromJson(Map<String, dynamic> j) =>
      Localized(en: j['en'] as String? ?? '', zhHant: j['zh-Hant'] as String? ?? '');

  static Localized? maybe(Object? j) =>
      j == null ? null : Localized.fromJson(j as Map<String, dynamic>);

  String forLocale(String code) => code.startsWith('zh') ? zhHant : en;
}

class Meta {
  const Meta({required this.correlationId, required this.contractVersion, required this.generatedAt});
  final String correlationId;
  final String contractVersion;
  final DateTime generatedAt;

  factory Meta.fromJson(Map<String, dynamic> j) => Meta(
        correlationId: j['correlationId'] as String,
        contractVersion: j['contractVersion'] as String,
        generatedAt: DateTime.parse(j['generatedAt'] as String),
      );
}

/// Data age, as the SERVER derived it.
///
/// Never recomputed client-side. The contract asserts ageSeconds equals
/// generatedAt minus observedAt and that status agrees with the window
/// (validate.mjs, freshness-age and freshness-status, added in v0.2.1 after a
/// fixture shipped 103000 against timestamps saying 103560). Recomputing here
/// would put a second, divergent answer in front of the resident for the exact
/// number they are asked to judge staleness by.
class Freshness {
  const Freshness({required this.status, required this.ageSeconds, required this.windowSeconds});
  final String status; // 'current' | 'stale'
  final int ageSeconds;
  final int windowSeconds;

  bool get isStale => status == 'stale';

  factory Freshness.fromJson(Map<String, dynamic> j) => Freshness(
        status: j['status'] as String,
        ageSeconds: j['ageSeconds'] as int,
        windowSeconds: j['windowSeconds'] as int,
      );
}

class Unit {
  const Unit({required this.unitId, required this.displayLine});
  final String unitId;
  final Localized displayLine;
  factory Unit.fromJson(Map<String, dynamic> j) =>
      Unit(unitId: j['unitId'] as String, displayLine: Localized.fromJson(j['displayLine'] as Map<String, dynamic>));
}

class UnitOption {
  const UnitOption({required this.unitId, required this.displayLine, required this.role, required this.isCurrent});
  final String unitId;
  final Localized displayLine;
  final String role;
  final bool isCurrent;
  factory UnitOption.fromJson(Map<String, dynamic> j) => UnitOption(
        unitId: j['unitId'] as String,
        displayLine: Localized.fromJson(j['displayLine'] as Map<String, dynamic>),
        role: j['role'] as String? ?? '',
        isCurrent: j['isCurrent'] as bool? ?? false,
      );
}

/// A safety condition as classified by the server.
///
/// severity is NEVER derived, inferred, recomputed or overridden client-side
/// (severity.json consumerObligations). monitoringCoverage is a separate field,
/// not a severity: a unit with no installed service has no condition to classify.
class SafetySummary {
  const SafetySummary({
    required this.severity,
    required this.monitoringCoverage,
    required this.headline,
    required this.detail,
    required this.observedAt,
    required this.freshness,
    required this.disclaimer,
  });
  final Severity severity;
  final String monitoringCoverage; // 'full' | 'partial' | 'none'
  final Localized headline;
  final Localized detail;
  final DateTime? observedAt;
  final Freshness? freshness;

  /// Server-supplied. Rendered verbatim, never hardcoded, never abbreviated.
  final Localized? disclaimer;

  bool get notMonitored => monitoringCoverage == 'none';

  factory SafetySummary.fromJson(Map<String, dynamic> j) => SafetySummary(
        severity: Severity.fromWire(j['severity'] as String),
        monitoringCoverage: j['monitoringCoverage'] as String? ?? 'full',
        headline: Localized.fromJson(j['headline'] as Map<String, dynamic>),
        detail: Localized.fromJson(j['detail'] as Map<String, dynamic>),
        observedAt: j['observedAt'] == null ? null : DateTime.parse(j['observedAt'] as String),
        freshness: j['freshness'] == null ? null : Freshness.fromJson(j['freshness'] as Map<String, dynamic>),
        disclaimer: Localized.maybe(j['disclaimer']),
      );
}

class InstalledService {
  const InstalledService({required this.name, required this.location, required this.state, required this.severity});
  final Localized name;
  final Localized location;
  final Localized state;
  final Severity severity;
  factory InstalledService.fromJson(Map<String, dynamic> j) => InstalledService(
        name: Localized.fromJson(j['name'] as Map<String, dynamic>),
        location: Localized.fromJson(j['location'] as Map<String, dynamic>),
        state: Localized.fromJson(j['state'] as Map<String, dynamic>),
        severity: Severity.fromWire(j['severity'] as String),
      );
}

class SafetyAction {
  const SafetyAction({required this.actionKey, required this.label, required this.kind});
  final String actionKey;
  final Localized label;
  final String kind;
  factory SafetyAction.fromJson(Map<String, dynamic> j) => SafetyAction(
        actionKey: j['actionKey'] as String? ?? '',
        label: Localized.fromJson(j['label'] as Map<String, dynamic>),
        kind: j['kind'] as String? ?? 'secondary',
      );
}

class ManagementUpdate {
  const ManagementUpdate({required this.body, required this.publishedAt});
  final Localized body;
  final DateTime? publishedAt;
  factory ManagementUpdate.fromJson(Map<String, dynamic> j) => ManagementUpdate(
        body: Localized.fromJson((j['body'] ?? j['message']) as Map<String, dynamic>),
        publishedAt: j['publishedAt'] == null ? null : DateTime.parse(j['publishedAt'] as String),
      );
}

class Acknowledgement {
  const Acknowledgement({required this.acknowledged, required this.acknowledgedAt});
  final bool acknowledged;
  final DateTime? acknowledgedAt;
  factory Acknowledgement.fromJson(Map<String, dynamic> j) => Acknowledgement(
        acknowledged: j['acknowledged'] as bool? ?? false,
        acknowledgedAt: j['acknowledgedAt'] == null ? null : DateTime.parse(j['acknowledgedAt'] as String),
      );
}

class SafetyEvent {
  const SafetyEvent({
    required this.eventId,
    required this.severity,
    required this.title,
    required this.instruction,
    required this.location,
    required this.occurredAt,
    required this.actions,
    required this.managementUpdates,
    required this.managementUpdatePending,
    required this.acknowledgement,
    required this.disclaimer,
    required this.correctionOf,
  });
  final String eventId;
  final Severity severity;
  final Localized title;
  final Localized? instruction;
  final Localized? location;
  final DateTime? occurredAt;
  final List<SafetyAction> actions;
  final List<ManagementUpdate> managementUpdates;

  /// True means management has NOT yet published. The contract asserts this
  /// cannot be true alongside published updates (validate.mjs,
  /// update-pending-consistency, added in v0.2.1).
  final bool managementUpdatePending;
  final Acknowledgement? acknowledgement;
  final Localized? disclaimer;

  /// A correction names what it corrects, so it stays linked to the original.
  final String? correctionOf;

  factory SafetyEvent.fromJson(Map<String, dynamic> j) => SafetyEvent(
        eventId: j['eventId'] as String,
        severity: Severity.fromWire(j['severity'] as String),
        title: Localized.fromJson(j['title'] as Map<String, dynamic>),
        instruction: Localized.maybe(j['instruction']),
        location: Localized.maybe(j['location']),
        occurredAt: j['occurredAt'] == null ? null : DateTime.parse(j['occurredAt'] as String),
        actions: ((j['actions'] as List?) ?? const [])
            .map((e) => SafetyAction.fromJson(e as Map<String, dynamic>))
            .toList(),
        managementUpdates: ((j['managementUpdates'] as List?) ?? const [])
            .map((e) => ManagementUpdate.fromJson(e as Map<String, dynamic>))
            .toList(),
        managementUpdatePending: j['managementUpdatePending'] as bool? ?? false,
        acknowledgement: j['acknowledgement'] == null
            ? null
            : Acknowledgement.fromJson(j['acknowledgement'] as Map<String, dynamic>),
        disclaimer: Localized.maybe(j['disclaimer']),
        correctionOf: (j['correction'] as Map<String, dynamic>?)?['correctsEventId'] as String?,
      );
}

class Notice {
  const Notice({required this.noticeId, required this.title, required this.summary, required this.severity});
  final String noticeId;
  final Localized title;
  final Localized summary;
  final Severity severity;
  factory Notice.fromJson(Map<String, dynamic> j) => Notice(
        noticeId: j['noticeId'] as String,
        title: Localized.fromJson(j['title'] as Map<String, dynamic>),
        summary: Localized.fromJson(j['summary'] as Map<String, dynamic>),
        severity: Severity.fromWire(j['severity'] as String),
      );
}

class OpenCase {
  const OpenCase({required this.caseReference, required this.title, required this.status});
  final String caseReference;
  final Localized title;
  final Localized status;
  factory OpenCase.fromJson(Map<String, dynamic> j) => OpenCase(
        caseReference: j['caseReference'] as String,
        title: Localized.fromJson(j['title'] as Map<String, dynamic>),
        status: Localized.fromJson(j['status'] as Map<String, dynamic>),
      );
}

class ServiceEntry {
  const ServiceEntry({required this.serviceKey, required this.label, required this.state, required this.availability, required this.reason});
  final String serviceKey;
  final Localized label;
  final Localized state;
  final String availability; // 'available' | 'coming_soon' | ...
  final Localized? reason;
  bool get isAvailable => availability == 'available';
  factory ServiceEntry.fromJson(Map<String, dynamic> j) => ServiceEntry(
        serviceKey: j['serviceKey'] as String,
        label: Localized.fromJson(j['label'] as Map<String, dynamic>),
        state: Localized.fromJson(j['state'] as Map<String, dynamic>),
        availability: j['availability'] as String? ?? 'available',
        reason: Localized.maybe(j['reason']),
      );
}

class NotificationPreference {
  const NotificationPreference({required this.label, required this.enabled, required this.locked, required this.lockReason});
  final Localized label;
  final bool enabled;
  final bool locked;
  final Localized? lockReason;
  factory NotificationPreference.fromJson(Map<String, dynamic> j) => NotificationPreference(
        label: Localized.fromJson(j['label'] as Map<String, dynamic>),
        enabled: j['enabled'] as bool? ?? false,
        locked: j['locked'] as bool? ?? false,
        lockReason: Localized.maybe(j['lockReason']),
      );
}

class ResidentPass {
  const ResidentPass({required this.passReference, required this.holderName, required this.unitDisplayLine, required this.carriesAccess, required this.note});
  final String passReference;
  final String holderName;
  final Localized unitDisplayLine;
  final bool carriesAccess;
  final Localized? note;
  factory ResidentPass.fromJson(Map<String, dynamic> j) => ResidentPass(
        passReference: j['passReference'] as String,
        holderName: j['holderName'] as String,
        unitDisplayLine: Localized.fromJson(j['unitDisplayLine'] as Map<String, dynamic>),
        carriesAccess: j['carriesAccess'] as bool? ?? false,
        note: Localized.maybe(j['note']),
      );
}
