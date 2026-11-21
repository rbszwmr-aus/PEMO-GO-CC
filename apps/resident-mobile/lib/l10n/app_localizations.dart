import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_zh.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('zh'),
  ];

  /// No description provided for @navHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// No description provided for @navServices.
  ///
  /// In en, this message translates to:
  /// **'Services'**
  String get navServices;

  /// No description provided for @navSafety.
  ///
  /// In en, this message translates to:
  /// **'Safety'**
  String get navSafety;

  /// No description provided for @navInbox.
  ///
  /// In en, this message translates to:
  /// **'Inbox'**
  String get navInbox;

  /// No description provided for @navAccount.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get navAccount;

  /// No description provided for @sectionOpenCase.
  ///
  /// In en, this message translates to:
  /// **'Open case'**
  String get sectionOpenCase;

  /// No description provided for @sectionNotices.
  ///
  /// In en, this message translates to:
  /// **'Notices'**
  String get sectionNotices;

  /// No description provided for @sectionQuickServices.
  ///
  /// In en, this message translates to:
  /// **'Quick services'**
  String get sectionQuickServices;

  /// No description provided for @sectionHelpDesk.
  ///
  /// In en, this message translates to:
  /// **'Help desk'**
  String get sectionHelpDesk;

  /// No description provided for @sectionInstalledServices.
  ///
  /// In en, this message translates to:
  /// **'Installed services'**
  String get sectionInstalledServices;

  /// No description provided for @sectionRecentEvents.
  ///
  /// In en, this message translates to:
  /// **'Recent events'**
  String get sectionRecentEvents;

  /// No description provided for @sectionManagementUpdates.
  ///
  /// In en, this message translates to:
  /// **'Management updates'**
  String get sectionManagementUpdates;

  /// No description provided for @sectionYourUnits.
  ///
  /// In en, this message translates to:
  /// **'Your flats'**
  String get sectionYourUnits;

  /// No description provided for @sectionNotificationPreferences.
  ///
  /// In en, this message translates to:
  /// **'Notification preferences'**
  String get sectionNotificationPreferences;

  /// No description provided for @titleHomeSafety.
  ///
  /// In en, this message translates to:
  /// **'Home Safety'**
  String get titleHomeSafety;

  /// No description provided for @titleAccount.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get titleAccount;

  /// No description provided for @residentPass.
  ///
  /// In en, this message translates to:
  /// **'RESIDENT PASS'**
  String get residentPass;

  /// No description provided for @actionCallOffice.
  ///
  /// In en, this message translates to:
  /// **'Call management office'**
  String get actionCallOffice;

  /// No description provided for @actionAcknowledge.
  ///
  /// In en, this message translates to:
  /// **'Acknowledge alert'**
  String get actionAcknowledge;

  /// No description provided for @actionAcknowledged.
  ///
  /// In en, this message translates to:
  /// **'Acknowledged'**
  String get actionAcknowledged;

  /// No description provided for @stateEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing to show yet.'**
  String get stateEmpty;

  /// No description provided for @statePartial.
  ///
  /// In en, this message translates to:
  /// **'Some sections could not be loaded.'**
  String get statePartial;

  /// No description provided for @stateSessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your session has expired. Please sign in again.'**
  String get stateSessionExpired;

  /// No description provided for @stateDuplicateSubmission.
  ///
  /// In en, this message translates to:
  /// **'This was already recorded. It has not been repeated.'**
  String get stateDuplicateSubmission;

  /// No description provided for @stateNoEvent.
  ///
  /// In en, this message translates to:
  /// **'No event to show.'**
  String get stateNoEvent;

  /// No description provided for @clientOffline.
  ///
  /// In en, this message translates to:
  /// **'Your device has no connection, so this screen is showing previously received information. Do not rely on it to judge safety.'**
  String get clientOffline;

  /// No description provided for @conditionUnknown.
  ///
  /// In en, this message translates to:
  /// **'We are unable to confirm the current condition for this flat.'**
  String get conditionUnknown;

  /// No description provided for @notMonitored.
  ///
  /// In en, this message translates to:
  /// **'This flat has no PEMO-connected sensors installed.'**
  String get notMonitored;

  /// No description provided for @notMonitoredDetail.
  ///
  /// In en, this message translates to:
  /// **'This flat has no PEMO-connected sensors, so there is no safety condition to report.'**
  String get notMonitoredDetail;

  /// No description provided for @managementUpdatePending.
  ///
  /// In en, this message translates to:
  /// **'Management has not published an update yet.'**
  String get managementUpdatePending;

  /// No description provided for @correctionLinked.
  ///
  /// In en, this message translates to:
  /// **'This is a correction and remains linked to the original event.'**
  String get correctionLinked;

  /// No description provided for @dataAgeUpdated.
  ///
  /// In en, this message translates to:
  /// **'Updated {age}'**
  String dataAgeUpdated(Object age);

  /// No description provided for @dataAgeStale.
  ///
  /// In en, this message translates to:
  /// **'This is not current. Last reported {age}. Do not rely on it to judge safety.'**
  String dataAgeStale(Object age);

  /// No description provided for @typicalReply.
  ///
  /// In en, this message translates to:
  /// **'Typical reply within {minutes} minutes during office hours'**
  String typicalReply(Object minutes);

  /// No description provided for @ageSeconds.
  ///
  /// In en, this message translates to:
  /// **'{n} seconds ago'**
  String ageSeconds(Object n);

  /// No description provided for @ageMinutes.
  ///
  /// In en, this message translates to:
  /// **'{n} minutes ago'**
  String ageMinutes(Object n);

  /// No description provided for @ageHours.
  ///
  /// In en, this message translates to:
  /// **'{n} hours ago'**
  String ageHours(Object n);

  /// No description provided for @ageDays.
  ///
  /// In en, this message translates to:
  /// **'{n} days ago'**
  String ageDays(Object n);

  /// No description provided for @inboxSpecifiedNotBuilt.
  ///
  /// In en, this message translates to:
  /// **'This screen is specified but not yet built (MOB-06).'**
  String get inboxSpecifiedNotBuilt;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'zh'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'zh':
      return AppLocalizationsZh();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
