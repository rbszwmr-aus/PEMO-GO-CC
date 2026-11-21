#!/usr/bin/env python3
"""Side-by-side: the same read requests against the Node API and the Go API,
bodies compared after removing per-request values (correlationId, generatedAt).

Both databases must be seeded from the same seeds (the Node stack on its own
database, the Go stack on 25480). Nothing is written. Run it where both stacks
are reachable (e.g. the AMD box):

  python3 tests/go/compare_with_node.py \
     --node http://127.0.0.1:8080 --node-secret "$NODE_PEMO_DEV_TOKEN_SECRET" \
     --go   http://127.0.0.1:23280 --go-secret  "$GO_PEMO_DEV_TOKEN_SECRET"
"""
import argparse, base64, datetime, hashlib, hmac, json, sys, urllib.request, urllib.error

def token(secret, subject):
    claims = {"marker": "pemo-dev", "residentId": subject,
              "issuedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"}
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
    payload = b64(json.dumps(claims, separators=(",", ":")).encode())
    return payload + "." + b64(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())

VOLATILE = {"correlationId", "generatedAt"}

def scrub(v):
    if isinstance(v, dict):
        return {k: ("<volatile>" if k in VOLATILE else scrub(x)) for k, x in v.items()}
    if isinstance(v, list):
        return [scrub(x) for x in v]
    return v

def get(base, path, tok, headers):
    h = {"authorization": "Bearer " + tok, "x-correlation-id": "00000000-0000-4000-8000-000000000001", **headers}
    try:
        with urllib.request.urlopen(urllib.request.Request(base + path, headers=h)) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"null")

def diff(a, b, p="$", out=None):
    out = [] if out is None else out
    if type(a) != type(b):
        out.append(f"{p}: node {json.dumps(a, ensure_ascii=False)[:100]} | go {json.dumps(b, ensure_ascii=False)[:100]}")
    elif isinstance(a, dict):
        if list(a) != list(b) and set(a) == set(b):
            out.append(f"{p}: same keys, different order")
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b:
                out.append(f"{p}.{k}: only in {'go' if k in b else 'node'}")
            else:
                diff(a[k], b[k], f"{p}.{k}", out)
    elif isinstance(a, list):
        if len(a) != len(b):
            out.append(f"{p}: node has {len(a)} items, go has {len(b)}")
        for i, (x, y) in enumerate(zip(a, b)):
            diff(x, y, f"{p}[{i}]", out)
    elif a != b:
        out.append(f"{p}: node {json.dumps(a, ensure_ascii=False)[:100]} | go {json.dumps(b, ensure_ascii=False)[:100]}")
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--node", required=True); ap.add_argument("--node-secret", required=True)
    ap.add_argument("--go", required=True); ap.add_argument("--go-secret", required=True)
    ap.add_argument("--resident", default="res_wfg_000412"); ap.add_argument("--unit", default="unit_wfg_a_12_a1")
    ap.add_argument("--staff", default="stf_wfg_manager")
    a = ap.parse_args()
    clock = {"x-pemo-dev-now": "2026-08-13T10:00:00+08:00"}
    R, S = "/api/resident-mobile/v0", "/api/management-web/v0"
    checks = [
        ("resident", f"{R}/home?unitId={a.unit}", clock), ("resident", f"{R}/services?unitId={a.unit}", clock),
        ("resident", f"{R}/safety/overview?unitId={a.unit}", clock), ("resident", f"{R}/account", clock),
        ("resident", f"{R}/safety/events/evt_20260813_smoke01", clock), ("resident", f"{R}/notices", {}),
        ("staff", f"{S}/scope", {}), ("staff", f"{S}/properties/tree", {}), ("staff", f"{S}/overview", {}),
        ("staff", f"{S}/notices", {}), ("staff", f"{S}/helpdesk/queue", {}), ("staff", f"{S}/strata/charges", {}),
        ("staff", f"{S}/strata/payments", {}), ("staff", f"{S}/strata/charges/chg_wfg_a1_202609", {}),
        ("staff", f"{S}/scope?limit=3", {}), ("staff", f"{S}/strata/charges/chg_nope", {}),
        ("none", f"{S}/scope", {}), ("none", f"{R}/home?unitId={a.unit}", {}),
    ]
    same = 0
    for who, path, h in checks:
        sub = {"resident": a.resident, "staff": "staff:" + a.staff, "none": "nobody"}[who]
        nt = token(a.node_secret, sub) if who != "none" else "x"
        gt = token(a.go_secret, sub) if who != "none" else "x"
        ns, nb = get(a.node, path, nt, h)
        gs, gb = get(a.go, path, gt, h)
        d = ([f"status: node {ns} | go {gs}"] if ns != gs else []) + diff(scrub(nb), scrub(gb))
        if d:
            print("DIFF", path)
            for x in d[:10]:
                print("     ", x)
        else:
            same += 1
            print("same", path, ns)
    print(f"\n{same}/{len(checks)} identical")
    sys.exit(0 if same == len(checks) else 1)

if __name__ == "__main__":
    main()
