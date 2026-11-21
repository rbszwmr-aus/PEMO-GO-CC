package api

import "pemo/internal/platform"

const problemBase = "https://pemo.local/problems"

func bp(b bool) *bool { return &b }

func lt(en, zh string) *platform.LocalizedText { return &platform.LocalizedText{En: en, ZhHant: zh} }

// Resident-mobile problem catalogue (identical types, titles and text).
var problems = struct {
	NotAuthorizedForUnit     func() *platform.Problem
	CaregiverScopeExpired    func(endedOn platform.LocalizedText) *platform.Problem
	SessionExpired           func() *platform.Problem
	InvalidCredential        func() *platform.Problem
	IntegrationUnavailable   func() *platform.Problem
	InternalError            func() *platform.Problem
	UnmappedUnit             func() *platform.Problem
	EventNotFound            func() *platform.Problem
	EventRetracted           func(supersededBy *string) *platform.Problem
	DuplicateAcknowledgement func() *platform.Problem
	BadRequest               func(detail string) *platform.Problem
	Refused                  func() *platform.Problem
	RequestTooLarge          func() *platform.Problem
	TooManyRequests          func() *platform.Problem
}{
	NotAuthorizedForUnit: func() *platform.Problem {
		return &platform.Problem{Type: problemBase + "/not-authorized", Title: "Not authorized for this unit", Status: 403,
			ResidentMessage: lt("You do not have access to this home. Contact the management office if you think this is wrong.",
				"您沒有此住戶的存取權限。如認為有誤，請聯絡管理處。"), Retryable: bp(false)}
	},
	CaregiverScopeExpired: func(e platform.LocalizedText) *platform.Problem {
		return &platform.Problem{Type: problemBase + "/caregiver-scope-expired", Title: "Caregiver access has expired", Status: 403,
			ResidentMessage: lt("Your permission to view this home's safety status ended on "+e.En+". Ask the resident to renew it.",
				"您查看此住戶安全狀態的權限已於"+e.ZhHant+"結束。請聯絡住戶重新授權。"), Retryable: bp(false)}
	},
	SessionExpired: func() *platform.Problem {
		return &platform.Problem{Type: problemBase + "/session-expired", Title: "Session expired", Status: 401,
			ResidentMessage: lt("Please sign in again to continue.", "請重新登入以繼續。"), Retryable: bp(false)}
	},
	InvalidCredential: func() *platform.Problem {
		return &platform.Problem{Type: problemBase + "/invalid-credential", Title: "Credential is not valid", Status: 401,
			ResidentMessage: lt("Please sign in again to continue.", "請重新登入以繼續。"), Retryable: bp(false)}
	},
	IntegrationUnavailable: func() *platform.Problem {
		return &platform.Problem{Type: problemBase + "/integration-unavailable", Title: "Integration unavailable", Status: 503,
			ResidentMessage: lt("Safety status is unavailable right now. This does not mean your home is safe or unsafe — we cannot check it.",
				"目前無法顯示安全狀態。這不表示您的居所安全或不安全，只是我們無法檢查。"), Retryable: bp(true)}
	},
	InternalError: func() *platform.Problem {
		return &platform.Problem{Type: problemBase + "/internal-error", Title: "Internal error", Status: 500,
			ResidentMessage: lt("Something went wrong on our side. Please try again shortly.", "我們的系統出現問題，請稍後再試。"), Retryable: bp(true)}
	},
	UnmappedUnit: func() *platform.Problem {
		return &platform.Problem{Type: problemBase + "/unmapped-unit", Title: "Unit is not mapped to a monitored location", Status: 409,
			ResidentMessage: lt("We cannot show a safety status for this home yet because it is not linked to a monitored location. The management office has been told.",
				"此住戶尚未連結至受監察的位置，因此暫時無法顯示安全狀態。已通知管理處。"), Retryable: bp(false)}
	},
	EventNotFound: func() *platform.Problem {
		return &platform.Problem{Type: problemBase + "/event-not-found", Title: "Event not found", Status: 404,
			ResidentMessage: lt("This alert is not available to you.", "您無法查看此警報。"), Retryable: bp(false)}
	},
	EventRetracted: func(by *string) *platform.Problem {
		p := &platform.Problem{Type: problemBase + "/event-retracted", Title: "Event retracted by source", Status: 410,
			ResidentMessage: lt("This alert was withdrawn. A corrected message has been sent to you.", "此警報已撤回。我們已向您發出更正訊息。"), Retryable: bp(false)}
		if by != nil {
			p.SupersededBy = *by
		}
		return p
	},
	DuplicateAcknowledgement: func() *platform.Problem {
		return &platform.Problem{Type: problemBase + "/duplicate-acknowledgement", Title: "Acknowledgement already recorded", Status: 409,
			ResidentMessage: lt("You have already acknowledged this alert. We have not recorded it twice.", "您已確認此警報，我們不會重複記錄。"), Retryable: bp(false)}
	},
	BadRequest: func(d string) *platform.Problem {
		return &platform.Problem{Type: problemBase + "/bad-request", Title: "Bad request", Status: 400, Detail: d, Retryable: bp(false)}
	},
	Refused: func() *platform.Problem {
		return &platform.Problem{Type: problemBase + "/refused", Title: "Request refused", Status: 400, Detail: "the request body was refused", Retryable: bp(false)}
	},
	RequestTooLarge: func() *platform.Problem {
		return &platform.Problem{Type: problemBase + "/request-too-large", Title: "Request too large", Status: 413, Detail: "the request body is too large", Retryable: bp(false)}
	},
	TooManyRequests: func() *platform.Problem {
		return &platform.Problem{Type: problemBase + "/too-many-requests", Title: "Too many requests", Status: 429,
			ResidentMessage: lt("Too many requests. Please wait a moment and try again.", "請求過多，請稍候再試。"), Retryable: bp(true)}
	},
}
