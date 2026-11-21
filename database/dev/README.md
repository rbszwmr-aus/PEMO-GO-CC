# PEMO development database

Development fixture for `GEN-006-ST`. Local only. No cloud resource, no
deployment, no infrastructure-as-code. Cloud provider and environment topology
remain `Unresolved` in the committed architecture baseline and are not selected
here.

## Run

```bash
cp database/dev/.env.example database/dev/.env   # set a local password; .env is git-ignored
docker compose -f database/dev/docker-compose.yml up -d
```

Connection: `postgres://pemo_owner@127.0.0.1:25480/pemo_dev`.

> **Go build (PEMO-GO-CC).** The compose project, container and volume are
> `pemo-go-dev`, `pemo-go-dev-db` and `pemo-go-dev-db-data`, published on
> **127.0.0.1:25480**, so this database runs side by side with the Node build's
> `pemo-dev-db` on 55433 without sharing anything. The history below is the
> Node build's and is kept as written.

## Why a dedicated service on port 55433 (Node build)

The host already runs two unrelated PostgreSQL services:

| Service | Port | Relationship to PEMO |
|---|---|---|
| Host PostgreSQL 16 (`systemd`) | `127.0.0.1:5432` | Unrelated. Never reused, connected to or modified. |
| Container `carpark-review-db` | `127.0.0.1:55432` | Unrelated. Untouched. |
| Container `pemo-dev-db` | `127.0.0.1:55433` | The Node build of PEMO. Untouched by the Go build. |
| **Container `pemo-go-dev-db`** | **`127.0.0.1:25480`** | **This project (Go build).** |

## Persistence gate

Recovered from `RETIRED-FEAT-001-platform-foundation_v3.md` section 3.10 and
required by `GEN-006-ST` section 2.7. All eight steps were performed **before
the first migration ran**. Results are recorded in the Step 2 report.

| # | Gate | Result |
|---|---|---|
| 1 | Service and database identified by name | `pemo-dev-db`, database `pemo_dev`, role `pemo_dev` |
| 2 | Container mounts inspected | one named volume `pemo-dev-db-data` → `/var/lib/postgresql/data` |
| 3 | Data directory is not tmpfs or RAM-backed | `/proc/mounts` inside the container shows `/dev/mapper/ubuntu--vg-ubuntu--lv … ext4 rw,relatime` |
| 4 | Intended volume recorded | `pemo-dev-db-data` (docker `local` driver) |
| 5 | No unrelated service reused or modified | host `5432` and `carpark-review-db` untouched |
| 6 | Backup location outside the database volume | `/home/luipt/backups/pemo-dev-db/`, outside the volume and outside the repository |
| 7 | Write → restart → read probe | value written, container restarted, same value read back |
| 8 | Backup and restore drill | `pg_dump -Fc` → restore into a scratch database → value verified → scratch database dropped |

A development database that silently loses state on restart wastes days before
anyone suspects the storage layer. That is the whole reason this gate exists.

## Never

`docker prune`, volume removal, broad cleanup, destructive migration commands,
`git reset --hard`, or recursive deletion. The backup directory is outside the
volume precisely so that no database operation can remove it.
