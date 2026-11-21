#!/usr/bin/env python3
"""Black-box conformance run against the Go API.

Every call is checked two ways: the status code must be one the OpenAPI
operation documents, and the JSON body must validate against that response's
schema (JSON Schema 2020-12, as OpenAPI 3.1 uses). Writes walk real flows
(notice lifecycle, grants, occupancy, acknowledgements, email).

  python3 tests/go/conformance.py --base http://127.0.0.1:23280 \
      --staff-token "$(pemo dev-token stf_wfg_manager)" \
      --resident-token "$(pemo resident-token res_wfg_000412)"

Needs: pip install pyyaml jsonschema
"""
import argparse, json, re, sys, uuid, urllib.request, urllib.error, pathlib
import yaml
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

ROOT = pathlib.Path(__file__).resolve().parents[2]
SURFACES = {
    "/api/management-web/v0": ROOT / "packages/api-contracts/management-web/openapi.yaml",
    "/api/resident-mobile/v0": ROOT / "packages/api-contracts/resident-mobile/openapi.yaml",
}

class Contract:
    def __init__(self, prefix, file):
        self.prefix = prefix
        self.doc = yaml.safe_load(open(file, encoding="utf-8"))
        self.uri = "urn:pemo:" + prefix
        self.registry = Registry().with_resource(self.uri, Resource(contents=self.anchor(self.doc), specification=DRAFT202012))
        self.ops = []
        for p, ops in self.doc["paths"].items():
            rx = re.compile("^" + re.sub(r"\{[^}]+\}", "[^/]+", p) + "$")
            for m, op in ops.items():
                if m in ("get", "post", "put", "patch", "delete"):
                    self.ops.append((m.upper(), rx, p, op))

    def find(self, method, path):
        for m, rx, p, op in self.ops:
            if m == method and rx.match(path):
                return p, op
        return None, None

    def validate(self, op, status, ctype, body):
        resp = op.get("responses", {})
        r = resp.get(str(status)) or resp.get(f"{str(status)[0]}XX") or resp.get("default")
        if r is None:
            return [f"status {status} is not documented (documented: {', '.join(resp)})"]
        if "$ref" in r:
            r = self.resolve(r["$ref"])
        content = r.get("content")
        if not content:
            return []
        mt = ctype.split(";")[0].strip()
        schema = (content.get(mt) or {}).get("schema")
        if schema is None:
            return [f"media type {mt} not documented for {status} (documented: {', '.join(content)})"]
        wrapped = {"$ref": self.uri + "#" + self.ptr(schema)} if False else self.anchor(schema)
        v = Draft202012Validator(wrapped, registry=self.registry)
        return [f"{'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message[:300]}" for e in v.iter_errors(body)]

    def resolve(self, ref):
        node = self.doc
        for part in ref.lstrip("#/").split("/"):
            node = node[part.replace("~1", "/").replace("~0", "~")]
        return node

    def anchor(self, schema):
        # Rewrite local refs so they resolve against the whole document.
        def fix(n):
            if isinstance(n, dict):
                out = {k: (self.uri + v if k == "$ref" and isinstance(v, str) and v.startswith("#") else fix(v)) for k, v in n.items() if k != "nullable"}
                # The contracts still use the OpenAPI 3.0 `nullable` keyword.
                if n.get("nullable") is True:
                    if "enum" in out:
                        out["enum"] = list(out["enum"]) + [None]
                    return {"anyOf": [out, {"type": "null"}]}
                return out
            if isinstance(n, list):
                return [fix(x) for x in n]
            return n
        return fix(schema)

    def ptr(self, s):
        return ""

# Mismatches between the published contract and the wire that the Node build
# ALSO produced (same code path, ported as is). Each is a contract decision,
# not a Go change; see docs/go-migration/MIGRATION-NOTES.md.
KNOWN_DRIFT = [
    ("GET", r"/overview$", r"recentNotices/\d+/(type|state)", "overview.recentNotices uses the notices module vocabulary (planned_interruption, live), not the contract's"),
    ("PUT", r"/acknowledgement$", r"problems/refused", "interim 'refused' problem type for a __proto__ body is not in the resident registry yet"),
    ("GET", r"/notices/[^/]+/delivery$", r"'recipients' was unexpected", "notice delivery lists the resolved recipients, which the contract schema does not declare"),
    ("POST", r"/admin/email/test$", r"status 403 is not documented", "admin email test refuses non-administrators with 403, which the contract does not list"),
]

def find(node, key):
    """First value of `key` anywhere in a JSON body."""
    if isinstance(node, dict):
        if key in node and not isinstance(node[key], (dict, list)):
            return node[key]
        for v in node.values():
            r = find(v, key)
            if r is not None:
                return r
    elif isinstance(node, list):
        for v in node:
            r = find(v, key)
            if r is not None:
                return r
    return None

class Runner:
    def __init__(self, base, staff, resident):
        self.base, self.staff, self.resident = base.rstrip("/"), staff, resident
        self.contracts = [Contract(p, f) for p, f in SURFACES.items()]
        self.failures, self.passed, self.uncovered, self.drift = [], 0, [], []

    def call(self, method, path, token=None, body=None, expect=None, headers=None, note=""):
        h = {"accept": "application/json"}
        if token:
            h["authorization"] = "Bearer " + token
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            h["content-type"] = "application/json"
        h.update(headers or {})
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(req) as r:
                status, ctype, raw = r.status, r.headers.get("content-type", ""), r.read()
        except urllib.error.HTTPError as e:
            status, ctype, raw = e.code, e.headers.get("content-type", ""), e.read()
        try:
            parsed = json.loads(raw) if raw else None
        except ValueError:
            parsed = raw.decode(errors="replace")
        label = f"{method} {path.split('?')[0]} -> {status}{' (' + note + ')' if note else ''}"
        errs = []
        if expect is not None and status not in (expect if isinstance(expect, (list, tuple)) else [expect]):
            errs.append(f"expected {expect}, got {status}: {str(parsed)[:300]}")
        bare = path.split("?")[0]
        contract = next((c for c in self.contracts if bare.startswith(c.prefix)), None)
        if contract:
            tmpl, op = contract.find(method, bare[len(contract.prefix):])
            if op is None:
                self.uncovered.append(f"{method} {bare}")
            elif parsed is not None and not isinstance(parsed, str):
                errs += contract.validate(op, status, ctype, parsed)
        known = [d for d in KNOWN_DRIFT if d[0] == method and re.search(d[1], bare) and any(re.search(d[2], e) for e in errs)]
        if errs and known and all(any(re.search(d[2], e) for d in known) for e in errs):
            self.drift.append((label, known[0][3]))
            print("drift", label, "—", known[0][3])
            return status, parsed
        if errs:
            self.failures.append((label, errs))
            print("FAIL", label)
            for e in errs[:6]:
                print("      ", e)
        else:
            self.passed += 1
            print("ok  ", label)
        return status, parsed

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:23280")
    ap.add_argument("--staff-token", required=True)
    ap.add_argument("--resident-token", required=True)
    ap.add_argument("--unit", default="unit_wfg_a_12_a1")
    ap.add_argument("--non-admin-token", help="a staff token WITHOUT grant_administrator (checks the refusal)")
    ap.add_argument("--admin-token", help="a staff token whose principal holds grant_administrator in the organisation (enables the grant flows)")
    a = ap.parse_args()
    R = Runner(a.base, a.staff_token, a.resident_token)
    S, T, U = a.staff_token, a.resident_token, a.unit
    M, RM = "/api/management-web/v0", "/api/resident-mobile/v0"

    # ---- resident-mobile reads ----
    for p in (f"/home?unitId={U}", f"/services?unitId={U}", f"/safety/overview?unitId={U}", "/account", "/notices"):
        R.call("GET", RM + p, T, expect=200)
    R.call("GET", RM + f"/home?unitId={U}", None, expect=401, note="no token")
    R.call("GET", RM + f"/home?unitId={U}", "garbage", expect=401, note="bad token")
    R.call("GET", RM + "/home?unitId=unit_does_not_exist", T, expect=403, note="other unit")
    st, ov = R.call("GET", RM + f"/safety/overview?unitId={U}", T, expect=200)
    events = []
    def walk(n):
        if isinstance(n, dict):
            if isinstance(n.get("eventId"), str): events.append(n["eventId"])
            for v in n.values(): walk(v)
        elif isinstance(n, list):
            for v in n: walk(v)
    walk(ov)
    for ev in events[:3]:
        R.call("GET", RM + f"/safety/events/{ev}?unitId={U}", T, expect=200)
        key = str(uuid.uuid4())
        # First run records (200/201); later runs use a NEW key for the same event, which is a duplicate (409).
        first, _ = R.call("PUT", RM + f"/safety/events/{ev}/acknowledgement?unitId={U}", T, {"action": "seen", "acknowledgementKey": key}, expect=[200, 201, 409, 410])
        R.call("PUT", RM + f"/safety/events/{ev}/acknowledgement?unitId={U}", T, {"action": "seen", "acknowledgementKey": key}, expect=first, note="same key replays")
        R.call("PUT", RM + f"/safety/events/{ev}/acknowledgement?unitId={U}", T, {"action": "maybe", "acknowledgementKey": key}, expect=400, note="bad action")
    R.call("GET", RM + f"/safety/events/evt_nope?unitId={U}", T, expect=404, note="unknown event")
    R.call("PUT", RM + "/safety/events/x/acknowledgement", T, {"__proto__": {"x": 1}}, expect=400, note="__proto__ refused")

    # ---- management reads ----
    for p in ("/scope", "/overview", "/properties/tree", "/properties/tree?limit=5", "/notices", "/helpdesk/queue",
              "/strata/charges", "/strata/payments"):
        R.call("GET", M + p, S, expect=200)
    R.call("GET", M + "/scope", None, expect=401, note="no token")
    st, charges = R.call("GET", M + "/strata/charges", S, expect=200)
    if charges and charges.get("charges"):
        cid = charges["charges"][0]["chargeId"]
        R.call("GET", M + f"/strata/charges/{cid}", S, expect=200)
        R.call("POST", M + f"/strata/charges/{cid}/invoice-email", S, {}, expect=200)
        R.call("GET", M + f"/strata/charges/{cid}", S, expect=200, note="with invoice send")
    R.call("GET", M + "/strata/charges/chg_nope", S, expect=404)
    R.call("POST", M + "/admin/email/test", S, {"to": "ops@example.invalid"}, expect=[200, 403])
    st, q = R.call("GET", M + "/helpdesk/queue", S, expect=200)
    rows = (q or {}).get("rows") or []
    if rows:
        R.call("GET", M + f"/helpdesk/contacts/{rows[0]['id']}", S, expect=200)

    # ---- notice lifecycle ----
    st, scope = R.call("GET", M + "/scope", S, expect=200)
    estate = next((n["node"] for n in scope.get("nodes", []) if n["node"]["kind"] == "estate"), None) if scope else None
    if estate:
        body = {"noticeType": "general", "titleEn": "Go conformance notice", "titleZhHant": "Go 合規通告",
                "bodyEn": "Checking the Go API.", "bodyZhHant": "檢查 Go API。",
                "targets": [{"nodeKind": estate["kind"], "nodeId": estate["id"]}]}
        R.call("POST", M + "/notices", S, body, expect=400, note="no Idempotency-Key")
        st, n = R.call("POST", M + "/notices", S, body, expect=201, headers={"idempotency-key": str(uuid.uuid4())})
        nid = find(n, "noticeId")
        if nid:
            R.call("GET", M + f"/notices/{nid}", S, expect=200)
            # 'general' is not approval-gated: submit/approve are refused (409), publish goes through.
            for act, want in (("submit", 409), ("approve", 409), ("publish", 200)):
                st, d = R.call("GET", M + f"/notices/{nid}", S, expect=200)
                ver = find(d, "version")
                R.call("POST", M + f"/notices/{nid}/{act}", S, {"fromVersion": ver}, expect=want, note=act)
            st, d = R.call("GET", M + f"/notices/{nid}", S, expect=200)
            R.call("POST", M + f"/notices/{nid}/submit", S, {"fromVersion": 1}, expect=[409, 422], note="stale fromVersion")
            R.call("GET", M + f"/notices/{nid}/acknowledgements", S, expect=[200, 409])
            R.call("GET", M + f"/notices/{nid}/delivery", S, expect=200)
            R.call("POST", M + f"/notices/{nid}/email", S, {}, expect=[200, 422])
            R.call("GET", RM + "/notices", T, expect=200, note="after publish")

    # ---- grants, principals, memberships (grant_administrator) ----
    if a.admin_token:
        A = a.admin_token
        k = lambda: {"idempotency-key": str(uuid.uuid4())}
        st, g = R.call("POST", M + "/grants", A, {"groupId": "grp_wfg_block_a_staff", "role": "approver", "nodeKind": "floor",
                       "nodeId": "fl_wfg_a_gf", "reasonCode": "role_change"}, expect=[201, 200], headers=k())
        R.call("POST", M + "/grants", A, {"groupId": "grp_wfg_block_a_staff", "role": "approver", "nodeKind": "building",
               "nodeId": "blk_wfg_a"}, expect=400, headers=k(), note="reason code required")
        if a.non_admin_token:
            R.call("POST", M + "/grants", a.non_admin_token, {"groupId": "grp_wfg_block_a_staff", "role": "estate_staff", "nodeKind": "floor",
                   "nodeId": "flr_wfg_a_12", "reasonCode": "role_change"}, expect=[403, 404], headers=k(), note="not an administrator")
        gid = find(g, "grantId")
        if gid:
            R.call("POST", M + f"/grants/{gid}/revoke", A, {"reasonCode": "granted_in_error"}, expect=200, headers=k())
            R.call("POST", M + f"/grants/{gid}/revoke", A, {"reasonCode": "granted_in_error"}, expect=[200, 409], headers=k(), note="again")
        ext = "idp-" + uuid.uuid4().hex[:10]
        st, p = R.call("POST", M + "/principals", A, {"organizationId": "org_wingfu_holdings", "externalId": ext, "displayName": "Go 測試"}, expect=[201, 200])
        R.call("POST", M + "/principals", A, {"organizationId": "org_wingfu_holdings", "externalId": ext, "displayName": "Go 測試"}, expect=[200, 201, 409], note="same identity")
        pid = find(p, "principalId")
        if pid:
            st, mem = R.call("POST", M + "/groups/grp_wfg_block_a_staff/members", A, {"principalId": pid, "reasonCode": "new_appointment"}, expect=[201, 200], headers=k())
            mid = find(mem, "membershipId")
            if mid:
                R.call("POST", M + f"/memberships/{mid}/remove", A, {"reasonCode": "added_in_error"}, expect=200, headers=k())
        # occupancy + estate contact
        st, o = R.call("POST", M + "/units/unit_wfg_a_12_a1/occupancies", S, {"residentId": "res_wfg_000733", "role": "caregiver"}, expect=[201, 409])
        oid = find(o, "occupancyId")
        if oid:
            R.call("POST", M + f"/occupancies/{oid}/end", S, {}, expect=200)
        R.call("POST", M + "/estates/est_wing_fu_garden/contacts", S, {"contactKind": "approved_service", "nameEn": "Go Plumbing",
               "nameZhHant": "Go 水喉", "telephone": "+852 0000 0000"}, expect=[201, 409])
        R.call("POST", M + "/safety/events/evt_hs_004417/updates", S, {"bodyEn": "Staff are on the way.", "bodyZhHant": "職員正前往。"}, expect=[201, 404])

    print()
    print(f"{R.passed} passed, {len(R.drift)} inherited contract drift, {len(R.failures)} failed")
    if R.uncovered:
        print("calls outside the published contracts (not schema-checked):", ", ".join(sorted(set(R.uncovered))))
    sys.exit(1 if R.failures else 0)

if __name__ == "__main__":
    main()
