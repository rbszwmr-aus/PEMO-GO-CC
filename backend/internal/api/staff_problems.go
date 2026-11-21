package api

import "pemo/internal/platform"

// StaffProblem is a management-web problem body.
type StaffProblem struct {
	Type         string
	Title        string
	Status       int
	StaffMessage platform.LocalizedText
	Retryable    bool
}

func (p *StaffProblem) Error() string { return p.Title }

// Body renders the problem with its correlation id.
func (p *StaffProblem) Body(correlationID string) map[string]any {
	return map[string]any{"type": p.Type, "title": p.Title, "status": p.Status, "correlationId": correlationID,
		"staffMessage": p.StaffMessage, "retryable": p.Retryable}
}

func sp(typ, title string, status int, en, zh string, retry bool) *StaffProblem {
	return &StaffProblem{problemBase + "/" + typ, title, status, platform.LocalizedText{En: en, ZhHant: zh}, retry}
}

type staffProblemsT struct{}

// staffProblems is the management-web problem catalogue (generated from the
// Node catalogue; identical types, titles, statuses and text).
var staffProblems staffProblemsT

// TooManyRequests is new in the Go build (review S3: rate limiting).
func (staffProblemsT) TooManyRequests() *StaffProblem {
	return sp("too-many-requests", "Too many requests", 429, "Too many requests. Please wait a moment and try again.", "請求過多，請稍候再試。", true)
}

func (staffProblemsT) InvalidCredential() *StaffProblem {
	return sp("invalid-credential", "Credential is not valid", 401, "Please sign in again to continue.", "請重新登入以繼續。", false)
}
func (staffProblemsT) SessionExpired() *StaffProblem {
	return sp("session-expired", "Session expired", 401, "Please sign in again to continue.", "請重新登入以繼續。", false)
}
func (staffProblemsT) ScopeNotFound() *StaffProblem {
	return sp("scope-not-found", "Scope not found", 404, "This scope is not available.", "無法使用此範圍。", false)
}
func (staffProblemsT) EventNotFound() *StaffProblem {
	return sp("event-not-found", "Event not found", 404, "This event is not available.", "無法使用此事件。", false)
}
func (staffProblemsT) NoticeNotFound() *StaffProblem {
	return sp("notice-not-found", "Notice not found", 404, "This notice is not available.", "無法使用此通告。", false)
}
func (staffProblemsT) NoticeOutOfScope() *StaffProblem {
	return sp("notice-out-of-scope", "Notice not found", 404, "This notice is not available.", "無法使用此通告。", false)
}
func (staffProblemsT) NoticeWrongState(d platform.LocalizedText) *StaffProblem {
	return sp("notice-wrong-state", "Notice is not in a state that allows this", 409, d.En, d.ZhHant, false)
}
func (staffProblemsT) NoticeStaleVersion(d platform.LocalizedText) *StaffProblem {
	return sp("notice-stale-version", "The notice has changed since this act was prepared", 409, d.En, d.ZhHant, true)
}
func (staffProblemsT) NoticeApprovalRequired() *StaffProblem {
	return sp("notice-approval-required", "This notice type requires approval before publication", 409, "This notice type must be approved before it can be published.", "此類通告必須先獲批准才可發佈。", false)
}
func (staffProblemsT) NoticeIncompleteTranslation() *StaffProblem {
	return sp("notice-incomplete-translation", "Both languages are required to publish", 422, "A notice must carry both English and Traditional Chinese before it is published.", "通告必須同時具備英文及繁體中文內容才可發佈。", false)
}
func (staffProblemsT) NoticeEmptyAudience() *StaffProblem {
	return sp("notice-empty-audience", "This notice would reach nobody", 422, "The targeting rule resolves to no residents. Check the targets before publishing.", "目標規則未涵蓋任何住戶，請於發佈前檢查目標。", false)
}
func (staffProblemsT) NoticeInvalidTarget() *StaffProblem {
	return sp("bad-request", "A target is not addressable", 400, "A target names a node kind this surface cannot address, a kind without an id, or nothing at all.", "目標節點無效。", false)
}
func (staffProblemsT) NoticeScheduleInverted() *StaffProblem {
	return sp("notice-schedule-inverted", "The schedule ends before it starts", 422, "The expiry time must be after the publication time.", "結束時間必須晚於發佈時間。", false)
}
func (staffProblemsT) NoticeRetargetingForbidden() *StaffProblem {
	return sp("notice-retargeting-forbidden", "A correction may not change who the notice addresses", 409, "A correction may change content and schedule only. To change the audience, withdraw this notice and issue a new one.", "更正只可修改內容及時間。如需更改對象，請撤回本通告並另發新通告。", false)
}
func (staffProblemsT) CursorExpired() *StaffProblem {
	return sp("cursor-expired", "Cursor expired", 410, "This page position is no longer valid. Restart the list from the beginning.", "此頁面位置已失效，請從頭重新載入列表。", false)
}
func (staffProblemsT) BadRequest(d platform.LocalizedText) *StaffProblem {
	return sp("invalid-request", "Request is not valid", 400, d.En, d.ZhHant, false)
}
func (staffProblemsT) Refused() *StaffProblem {
	return sp("refused", "Request refused", 400, "The request body was refused.", "請求內容已被拒絕。", false)
}
func (staffProblemsT) RequestTooLarge() *StaffProblem {
	return sp("request-too-large", "Request too large", 413, "The request body is too large.", "請求內容過大。", false)
}
func (staffProblemsT) OccupancyTargetNotFound() *StaffProblem {
	return sp("occupancy-target-not-found", "Unit or resident not found", 404, "This unit or resident is not available.", "無法使用此單位或住戶。", false)
}
func (staffProblemsT) GrantTargetNotFound() *StaffProblem {
	return sp("grant-target-not-found", "Node or grant not found", 404, "This node or grant is not available.", "無法使用此節點或授權。", false)
}
func (staffProblemsT) AdministrationFloor() *StaffProblem {
	return sp("insufficient-administration-scope", "Insufficient authority over this group", 403, "You cannot administer this group: it confers authority at nodes you do not administer.", "您無法管理此群組：其授權範圍包含您未管理的節點。", false)
}
func (staffProblemsT) MembershipExists() *StaffProblem {
	return sp("membership-already-exists", "Already a member", 409, "This person already holds a current membership of this group.", "此人已持有此群組的現行成員資格。", false)
}
func (staffProblemsT) MembershipNotLive() *StaffProblem {
	return sp("membership-not-live", "Membership is not current", 409, "This membership has already ended.", "此成員資格已結束。", false)
}
func (staffProblemsT) PrincipalTargetNotFound() *StaffProblem {
	return sp("principal-target-not-found", "Group or person not found", 404, "This group or person is not available.", "無法使用此群組或人員。", false)
}
func (staffProblemsT) IdentityAlreadyRecorded() *StaffProblem {
	return sp("identity-already-recorded", "Identity already recorded", 409, "This external identity is already recorded in this organization.", "此外部身分已在此機構中登記。", false)
}
func (staffProblemsT) GrantExists() *StaffProblem {
	return sp("grant-already-exists", "Grant already exists", 409, "This group already holds this role at this node.", "此群組已於此節點持有此角色。", false)
}
func (staffProblemsT) GrantNotLive() *StaffProblem {
	return sp("grant-not-live", "Grant is not live", 409, "This grant has already ended.", "此授權已結束。", false)
}
func (staffProblemsT) LastGrantAdministrator() *StaffProblem {
	return sp("last-grant-administrator", "Last grant administrator", 409, "This is the last grant administrator. Appoint another before removing this one.", "這是最後一位授權管理員。請先委任另一位，再移除此位。", false)
}
func (staffProblemsT) OrganizationAlreadyProvisioned() *StaffProblem {
	return sp("organization-already-provisioned", "Organization already provisioned", 409, "This organization has already been provisioned.", "此機構已完成初始設定。", false)
}
func (staffProblemsT) IdempotencyKeyConflict() *StaffProblem {
	return sp("idempotency-key-conflict", "Idempotency key already used for a different request", 409, "This request key was already used for a different request. Use a new key.", "此請求識別碼已用於另一項請求。請使用新的識別碼。", false)
}
func (staffProblemsT) OccupancyExists() *StaffProblem {
	return sp("occupancy-already-exists", "Occupancy already recorded", 409, "This resident already holds a current occupancy of this unit.", "此住戶已持有此單位的現行居住紀錄。", false)
}
func (staffProblemsT) EstateNotFound() *StaffProblem {
	return sp("estate-not-found", "Estate not found", 404, "This estate is not available.", "無法使用此屋苑。", false)
}
func (staffProblemsT) ManagementOfficeExists() *StaffProblem {
	return sp("management-office-contact-exists", "Management office contact already recorded", 409, "This estate already has a management office contact.", "此屋苑已設有管理處聯絡資料。", false)
}
func (staffProblemsT) OccupancyNotLive() *StaffProblem {
	return sp("occupancy-not-live", "Occupancy is not live", 409, "This occupancy has already ended, so it cannot be ended again.", "此居住紀錄已結束，無法再次結束。", false)
}
func (staffProblemsT) ChargeNotFound() *StaffProblem {
	return sp("record-not-found", "Charge not found", 404, "This charge is not available.", "無法使用此帳單。", false)
}
func (staffProblemsT) NoticeEmailNoRecipient() *StaffProblem {
	return sp("notice-email-no-recipient", "No email recipient", 422, "This notice has no household contact email to send to.", "此通告沒有可發送的住戶聯絡電郵。", false)
}
func (staffProblemsT) HelpdeskContactNotFound() *StaffProblem {
	return sp("record-not-found", "Help-desk contact not found", 404, "This help-desk contact is not available.", "無法使用此服務台聯絡。", false)
}
func (staffProblemsT) EmailSendForbidden() *StaffProblem {
	return sp("email-send-forbidden", "Sending is not permitted", 403, "You do not have permission to send this.", "你沒有發送此郵件的權限。", false)
}
func (staffProblemsT) AdministrationRequired() *StaffProblem {
	return sp("administration-required", "Administrator permission required", 403, "This action is limited to administrators.", "此操作僅限管理員。", false)
}
func (staffProblemsT) CommunicationsUnavailable() *StaffProblem {
	return sp("communications-unavailable", "Communications unavailable", 503, "Mail cannot be sent right now because communications are not configured. This is not a successful send.", "目前無法寄出郵件，因為通訊尚未設定。這不是一次成功的發送。", true)
}
func (staffProblemsT) InternalError() *StaffProblem {
	return sp("internal-error", "Internal error", 500, "Something went wrong on our side. Please try again shortly.", "我們的系統出現問題，請稍後再試。", true)
}
