#!/usr/bin/env python3
"""Resident-mobile fixture parity against the Go API (port of
tests/contract/fixture-parity.test.ts).

For every served fixture: reseed the base world, apply the fixture's scenario,
call the API with the fixture's correlation id and clock (dev seams), and
require the response to be EQUAL to the fixture, status and body.

  python3 tests/go/fixture_parity.py --pemo backend/bin/pemo --base http://127.0.0.1:23280
"""
import argparse, json, pathlib, subprocess, sys, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parents[2]
FIX = ROOT / "tests/fixtures/resident-mobile"
RESIDENT, UNIT = "res_wfg_000412", "unit_wfg_a_12_a1"
ROUTES = {
    "mob-02-home": (lambda b: "/api/resident-mobile/v0/home", True),
    "mob-03-services": (lambda b: "/api/resident-mobile/v0/services", True),
    "mob-08-safety-overview": (lambda b: "/api/resident-mobile/v0/safety/overview", True),
    "mob-09-safety-event-detail": (lambda b: "/api/resident-mobile/v0/safety/events/" + (((b or {}).get("event") or {}).get("eventId") or (b or {}).get("eventId") or "evt_20260813_smoke01"), False),
    "mob-11-account": (lambda b: "/api/resident-mobile/v0/account", False),
}
FAULTS = {"integration-unavailable": "integration-unavailable", "error": "internal-error", "partial": "partial"}

def pemo(args, *cmd):
    out = subprocess.run([args.pemo, "-root", str(ROOT), *cmd], capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(f"pemo {' '.join(cmd)}: {out.stderr.strip()}")
    return out.stdout.strip()

def request(base, method, url, headers, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    h = dict(headers)
    if data is not None:
        h["content-type"] = "application/json"
    req = urllib.request.Request(base + url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")

def diff(a, b, path="$"):
    if type(a) != type(b):
        return [f"{path}: {json.dumps(a, ensure_ascii=False)[:120]} != {json.dumps(b, ensure_ascii=False)[:120]}"]
    if isinstance(a, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            if k not in a: out.append(f"{path}.{k}: missing in response")
            elif k not in b: out.append(f"{path}.{k}: unexpected in response")
            else: out += diff(a[k], b[k], f"{path}.{k}")
        return out
    if isinstance(a, list):
        if len(a) != len(b):
            return [f"{path}: length {len(a)} != {len(b)}"]
        return [e for i, (x, y) in enumerate(zip(a, b)) for e in diff(x, y, f"{path}[{i}]")]
    return [] if a == b else [f"{path}: {json.dumps(a, ensure_ascii=False)[:120]} != {json.dumps(b, ensure_ascii=False)[:120]}"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pemo", default=str(ROOT / "backend/bin/pemo"))
    ap.add_argument("--base", default="http://127.0.0.1:23280")
    args = ap.parse_args()
    manifest = json.load(open(FIX / "index.json", encoding="utf-8"))
    tokens = {}
    def token(rid, expired=False):
        k = (rid, expired)
        if k not in tokens:
            tokens[k] = pemo(args, "resident-token", rid, *(["--expired"] if expired else []))
        return tokens[k]
    passed, failed = 0, []
    for e in manifest["fixtures"]:
        if e.get("file") is None or e["screen"] not in ROUTES:
            continue
        expected = json.load(open(FIX / e["file"], encoding="utf-8"))
        status = e.get("httpStatus") or 200
        pemo(args, "reseed")
        scen = ROOT / "database/seeds/scenarios" / f"{e['screen']}__{e['state']}.sql"
        if scen.exists():
            pemo(args, "seed", scen.name)
        meta = (expected or {}).get("meta") or {}
        cid = meta.get("correlationId") or (expected or {}).get("correlationId") or "1a2b3c4d-0000-4000-8000-00000000ffff"
        gen = meta.get("generatedAt") or "2026-08-13T10:00:00+08:00"
        h = {"x-correlation-id": cid, "x-pemo-dev-now": gen, "x-pemo-dev-scenario": e["state"]}
        rid, unit = RESIDENT, UNIT
        if e["state"] == "caregiver-permission-expired" and e["screen"] == "mob-08-safety-overview":
            rid = "res_wfg_000733"
        if e["state"] == "no-permission":
            rid = "res_wfg_000001"
        if e["state"] == "unknown-unit" and e["screen"] == "mob-08-safety-overview":
            unit = "unit_wfg_c_08_c3"
        h["authorization"] = "Bearer " + token(rid, e["state"] == "session-expired")
        if e["state"] in FAULTS:
            h["x-pemo-dev-fault"] = FAULTS[e["state"]]
        path_of, needs_unit = ROUTES[e["screen"]]
        overrides = {"retracted-event": "evt_20260813_retract", "resident-not-authorized": "evt_20260813_other01"}
        if e["state"] in ("acknowledgement-recorded", "acknowledgement-replayed", "duplicate-submission"):
            ev = (expected or {}).get("eventId") or "evt_20260813_smoke01"
            url = f"/api/resident-mobile/v0/safety/events/{ev}/acknowledgement"
            acted = ((expected or {}).get("acknowledgement") or {}).get("acknowledgedAt") or gen
            payload = {"acknowledgementKey": "4f1c9a55-0000-4000-8000-000000000001", "action": "i_am_safe", "occurredAt": acted}
            got = request(args.base, "PUT", url, h, payload)
            if e["state"] == "acknowledgement-replayed":
                got = request(args.base, "PUT", url, h, payload)
            elif e["state"] == "duplicate-submission":
                got = request(args.base, "PUT", url, h, {**payload, "acknowledgementKey": "4f1c9a55-0000-4000-8000-000000000002"})
        else:
            if e["state"] in overrides and e["screen"] == "mob-09-safety-event-detail":
                url = "/api/resident-mobile/v0/safety/events/" + overrides[e["state"]]
            else:
                url = path_of(expected) + (f"?unitId={unit}" if needs_unit else "")
            got = request(args.base, "GET", url, h)
        errs = []
        if got[0] != status:
            errs.append(f"status {got[0]} != {status}: {json.dumps(got[1], ensure_ascii=False)[:300]}")
        else:
            errs += diff(expected, got[1])
        if errs:
            failed.append(e["file"])
            print("FAIL", e["file"])
            for x in errs[:8]:
                print("      ", x)
        else:
            passed += 1
            print("ok  ", e["file"])
    pemo(args, "reseed")
    print(f"\n{passed} fixtures identical, {len(failed)} differ")
    sys.exit(1 if failed else 0)

if __name__ == "__main__":
    main()
