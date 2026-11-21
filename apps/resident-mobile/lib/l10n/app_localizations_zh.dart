// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Chinese (`zh`).
class AppLocalizationsZh extends AppLocalizations {
  AppLocalizationsZh([String locale = 'zh']) : super(locale);

  @override
  String get navHome => '主頁';

  @override
  String get navServices => '服務';

  @override
  String get navSafety => '安全';

  @override
  String get navInbox => '收件匣';

  @override
  String get navAccount => '帳戶';

  @override
  String get sectionOpenCase => '個案';

  @override
  String get sectionNotices => '通告';

  @override
  String get sectionQuickServices => '快速服務';

  @override
  String get sectionHelpDesk => '服務台';

  @override
  String get sectionInstalledServices => '已安裝的服務';

  @override
  String get sectionRecentEvents => '近期事件';

  @override
  String get sectionManagementUpdates => '管理處更新';

  @override
  String get sectionYourUnits => '單位';

  @override
  String get sectionNotificationPreferences => '通知設定';

  @override
  String get titleHomeSafety => '家居安全';

  @override
  String get titleAccount => '帳戶';

  @override
  String get residentPass => '住戶通行證';

  @override
  String get actionCallOffice => '致電管理處';

  @override
  String get actionAcknowledge => '確認已閱讀此警報';

  @override
  String get actionAcknowledged => '已確認';

  @override
  String get stateEmpty => '目前沒有內容。';

  @override
  String get statePartial => '部分內容暫時無法顯示。';

  @override
  String get stateSessionExpired => '登入已逾時，請重新登入。';

  @override
  String get stateDuplicateSubmission => '此操作已記錄，不會重複執行。';

  @override
  String get stateNoEvent => '沒有事件。';

  @override
  String get clientOffline => '您的裝置目前沒有網絡連線，此畫面顯示的是先前接收的資料。請勿依賴此資料判斷安全狀況。';

  @override
  String get conditionUnknown => '無法確定此單位的安全狀況。';

  @override
  String get notMonitored => '此單位尚未安裝 PEMO 感應器。';

  @override
  String get notMonitoredDetail => '此單位尚未安裝 PEMO 感應器，因此沒有可報告的安全狀況。';

  @override
  String get managementUpdatePending => '管理處尚未發布更新。';

  @override
  String get correctionLinked => '此為更正，與原事件相關。';

  @override
  String dataAgeUpdated(Object age) {
    return '更新於$age';
  }

  @override
  String dataAgeStale(Object age) {
    return '此資料並非最新，更新於$age。請勿依賴此資料判斷安全狀況。';
  }

  @override
  String typicalReply(Object minutes) {
    return '辦公時間內通常於 $minutes 分鐘內回覆';
  }

  @override
  String ageSeconds(Object n) {
    return '$n 秒前';
  }

  @override
  String ageMinutes(Object n) {
    return '$n 分鐘前';
  }

  @override
  String ageHours(Object n) {
    return '$n 小時前';
  }

  @override
  String ageDays(Object n) {
    return '$n 天前';
  }

  @override
  String get inboxSpecifiedNotBuilt => '此畫面已在設計規格中訂明（MOB-06），但尚未建置。';
}
