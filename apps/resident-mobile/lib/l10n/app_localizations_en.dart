// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get navHome => 'Home';

  @override
  String get navServices => 'Services';

  @override
  String get navSafety => 'Safety';

  @override
  String get navInbox => 'Inbox';

  @override
  String get navAccount => 'Account';

  @override
  String get sectionOpenCase => 'Open case';

  @override
  String get sectionNotices => 'Notices';

  @override
  String get sectionQuickServices => 'Quick services';

  @override
  String get sectionHelpDesk => 'Help desk';

  @override
  String get sectionInstalledServices => 'Installed services';

  @override
  String get sectionRecentEvents => 'Recent events';

  @override
  String get sectionManagementUpdates => 'Management updates';

  @override
  String get sectionYourUnits => 'Your flats';

  @override
  String get sectionNotificationPreferences => 'Notification preferences';

  @override
  String get titleHomeSafety => 'Home Safety';

  @override
  String get titleAccount => 'Account';

  @override
  String get residentPass => 'RESIDENT PASS';

  @override
  String get actionCallOffice => 'Call management office';

  @override
  String get actionAcknowledge => 'Acknowledge alert';

  @override
  String get actionAcknowledged => 'Acknowledged';

  @override
  String get stateEmpty => 'Nothing to show yet.';

  @override
  String get statePartial => 'Some sections could not be loaded.';

  @override
  String get stateSessionExpired =>
      'Your session has expired. Please sign in again.';

  @override
  String get stateDuplicateSubmission =>
      'This was already recorded. It has not been repeated.';

  @override
  String get stateNoEvent => 'No event to show.';

  @override
  String get clientOffline =>
      'Your device has no connection, so this screen is showing previously received information. Do not rely on it to judge safety.';

  @override
  String get conditionUnknown =>
      'We are unable to confirm the current condition for this flat.';

  @override
  String get notMonitored =>
      'This flat has no PEMO-connected sensors installed.';

  @override
  String get notMonitoredDetail =>
      'This flat has no PEMO-connected sensors, so there is no safety condition to report.';

  @override
  String get managementUpdatePending =>
      'Management has not published an update yet.';

  @override
  String get correctionLinked =>
      'This is a correction and remains linked to the original event.';

  @override
  String dataAgeUpdated(Object age) {
    return 'Updated $age';
  }

  @override
  String dataAgeStale(Object age) {
    return 'This is not current. Last reported $age. Do not rely on it to judge safety.';
  }

  @override
  String typicalReply(Object minutes) {
    return 'Typical reply within $minutes minutes during office hours';
  }

  @override
  String ageSeconds(Object n) {
    return '$n seconds ago';
  }

  @override
  String ageMinutes(Object n) {
    return '$n minutes ago';
  }

  @override
  String ageHours(Object n) {
    return '$n hours ago';
  }

  @override
  String ageDays(Object n) {
    return '$n days ago';
  }

  @override
  String get inboxSpecifiedNotBuilt =>
      'This screen is specified but not yet built (MOB-06).';
}
