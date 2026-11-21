import 'models.dart';

class HomePayload {
  const HomePayload({required this.meta, required this.residentName, required this.greeting, required this.unit, required this.unitSwitcher, required this.safety, required this.openCase, required this.notices, required this.quickServices});
  final Meta meta;
  final String residentName;
  final Localized greeting;
  final Unit? unit;
  final List<UnitOption> unitSwitcher;
  final SafetySummary? safety;
  final OpenCase? openCase;
  final List<Notice> notices;
  final List<ServiceEntry> quickServices;

  factory HomePayload.fromJson(Map<String, dynamic> j) => HomePayload(
        meta: Meta.fromJson(j['meta'] as Map<String, dynamic>),
        residentName: (j['resident'] as Map<String, dynamic>?)?['displayName'] as String? ?? '',
        greeting: Localized.maybe((j['resident'] as Map<String, dynamic>?)?['greeting']) ?? const Localized(en: '', zhHant: ''),
        unit: j['unit'] == null ? null : Unit.fromJson(j['unit'] as Map<String, dynamic>),
        unitSwitcher: ((j['unitSwitcher'] as List?) ?? const []).map((e) => UnitOption.fromJson(e as Map<String, dynamic>)).toList(),
        safety: j['safety'] == null ? null : SafetySummary.fromJson(j['safety'] as Map<String, dynamic>),
        openCase: j['openCase'] == null ? null : OpenCase.fromJson(j['openCase'] as Map<String, dynamic>),
        notices: ((j['notices'] as List?) ?? const []).map((e) => Notice.fromJson(e as Map<String, dynamic>)).toList(),
        quickServices: ((j['quickServices'] as List?) ?? const []).map((e) => ServiceEntry.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

class ServicesPayload {
  const ServicesPayload({required this.meta, required this.helpDeskOpenNow, required this.helpDeskHours, required this.typicalReplyMinutes, required this.services, required this.comingSoonNote});
  final Meta meta;
  final bool helpDeskOpenNow;
  final Localized? helpDeskHours;
  final int? typicalReplyMinutes;
  final List<ServiceEntry> services;
  final Localized? comingSoonNote;

  factory ServicesPayload.fromJson(Map<String, dynamic> j) {
    final hd = j['helpDesk'] as Map<String, dynamic>?;
    return ServicesPayload(
      meta: Meta.fromJson(j['meta'] as Map<String, dynamic>),
      helpDeskOpenNow: hd?['openNow'] as bool? ?? false,
      helpDeskHours: Localized.maybe(hd?['hours']),
      typicalReplyMinutes: hd?['typicalReplyMinutes'] as int?,
      services: ((j['services'] as List?) ?? const []).map((e) => ServiceEntry.fromJson(e as Map<String, dynamic>)).toList(),
      comingSoonNote: Localized.maybe(j['comingSoonNote']),
    );
  }
}

class SafetyOverviewPayload {
  const SafetyOverviewPayload({required this.meta, required this.unit, required this.safety, required this.installedServices, required this.installedServicesNote, required this.recentEvents});
  final Meta meta;
  final Unit? unit;
  final SafetySummary? safety;
  final List<InstalledService> installedServices;
  final Localized? installedServicesNote;
  final List<SafetyEvent> recentEvents;

  factory SafetyOverviewPayload.fromJson(Map<String, dynamic> j) => SafetyOverviewPayload(
        meta: Meta.fromJson(j['meta'] as Map<String, dynamic>),
        unit: j['unit'] == null ? null : Unit.fromJson(j['unit'] as Map<String, dynamic>),
        safety: j['safety'] == null ? null : SafetySummary.fromJson(j['safety'] as Map<String, dynamic>),
        installedServices: ((j['installedServices'] as List?) ?? const []).map((e) => InstalledService.fromJson(e as Map<String, dynamic>)).toList(),
        installedServicesNote: Localized.maybe(j['installedServicesNote']),
        recentEvents: ((j['recentEvents'] as List?) ?? const []).map((e) => SafetyEvent.fromJson(e as Map<String, dynamic>)).toList(),
      );
}

class SafetyEventPayload {
  const SafetyEventPayload({required this.meta, required this.event});
  final Meta meta;
  final SafetyEvent? event;
  factory SafetyEventPayload.fromJson(Map<String, dynamic> j) => SafetyEventPayload(
        meta: Meta.fromJson(j['meta'] as Map<String, dynamic>),
        event: j['event'] == null ? null : SafetyEvent.fromJson(j['event'] as Map<String, dynamic>),
      );
}

class AccountPayload {
  const AccountPayload({required this.meta, required this.residentName, required this.pass, required this.memberships, required this.preferences});
  final Meta meta;
  final String residentName;
  final ResidentPass? pass;
  final List<UnitOption> memberships;
  final List<NotificationPreference> preferences;

  factory AccountPayload.fromJson(Map<String, dynamic> j) => AccountPayload(
        meta: Meta.fromJson(j['meta'] as Map<String, dynamic>),
        residentName: (j['resident'] as Map<String, dynamic>?)?['displayName'] as String? ?? '',
        pass: j['pass'] == null ? null : ResidentPass.fromJson(j['pass'] as Map<String, dynamic>),
        memberships: ((j['memberships'] as List?) ?? const []).map((e) => UnitOption.fromJson(e as Map<String, dynamic>)).toList(),
        preferences: ((j['notificationPreferences'] as List?) ?? const []).map((e) => NotificationPreference.fromJson(e as Map<String, dynamic>)).toList(),
      );
}
