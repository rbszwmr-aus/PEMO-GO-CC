package platform

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// Migration is one NNNN_<module>_<slug>.up.sql / .down.sql pair.
type Migration struct {
	Sequence         int
	Module, Slug     string
	UpFile, DownFile string
	UpSQL, DownSQL   string
	Checksum         string
}

// MigrationError names what is wrong with the migration set.
type MigrationError struct{ Msg string }

func (e *MigrationError) Error() string { return e.Msg }

var filePattern = regexp.MustCompile(`^(\d{4})_(` + strings.Join(AllSchemas, "|") + `)_([a-z0-9_]+)\.up\.sql$`)

var (
	lineComment  = regexp.MustCompile(`--[^\n]*`)
	blockComment = regexp.MustCompile(`(?s)/\*.*?\*/`)
	stringLit    = regexp.MustCompile(`'(?:[^']|'')*'`)
)

// A migration may only touch the schema its filename declares.
func assertSchemaOwnership(file, sql, own string) error {
	s := lineComment.ReplaceAllString(sql, " ")
	s = blockComment.ReplaceAllString(s, " ")
	s = stringLit.ReplaceAllString(s, " '' ")
	for _, schema := range AllSchemas {
		if schema == own {
			continue
		}
		re := regexp.MustCompile(`(?i)\b` + schema + `\s*\.\s*["a-zA-Z_]`)
		if re.MatchString(s) {
			return &MigrationError{fmt.Sprintf("%s declares module %q but references schema %q. A migration may only touch its own schema.", file, own, schema)}
		}
	}
	return nil
}

// LoadMigrations reads and checks every migration in dir.
func LoadMigrations(dir string) ([]Migration, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var names []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".up.sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	seen := map[int]bool{}
	var out []Migration
	for _, up := range names {
		m := filePattern.FindStringSubmatch(up)
		if m == nil {
			return nil, &MigrationError{fmt.Sprintf("Migration file %q does not match NNNN_<module>_<slug>.up.sql with a known module.", up)}
		}
		seq, _ := strconv.Atoi(m[1])
		if seen[seq] {
			return nil, &MigrationError{fmt.Sprintf("Duplicate migration sequence %04d.", seq)}
		}
		seen[seq] = true
		down := strings.TrimSuffix(up, ".up.sql") + ".down.sql"
		upSQL, err := os.ReadFile(filepath.Join(dir, up))
		if err != nil {
			return nil, err
		}
		downSQL, err := os.ReadFile(filepath.Join(dir, down))
		if err != nil {
			return nil, &MigrationError{fmt.Sprintf("Migration %q has no matching %s. Every migration rolls back.", up, down)}
		}
		if err := assertSchemaOwnership(up, string(upSQL), m[2]); err != nil {
			return nil, err
		}
		if err := assertSchemaOwnership(down, string(downSQL), m[2]); err != nil {
			return nil, err
		}
		sum := sha256.Sum256(upSQL)
		out = append(out, Migration{seq, m[2], m[3], up, down, string(upSQL), string(downSQL), hex.EncodeToString(sum[:])})
	}
	return out, nil
}

const ledgerDDL = `
  CREATE SCHEMA IF NOT EXISTS platform;
  CREATE TABLE IF NOT EXISTS platform.schema_migration (
    sequence     integer      PRIMARY KEY,
    module       text         NOT NULL,
    slug         text         NOT NULL,
    file_name    text         NOT NULL,
    checksum     text         NOT NULL,
    applied_at   timestamptz  NOT NULL DEFAULT now()
  );`

// MigrateUp applies every pending migration, one transaction each, and
// refuses if an applied file was edited (checksum ledger). The ledger format
// is identical to the Node runner's, so either can continue the other's work.
func MigrateUp(ctx context.Context, db DB, dir string) (applied, already []string, err error) {
	ms, err := LoadMigrations(dir)
	if err != nil {
		return nil, nil, err
	}
	if err := db.Exec(ctx, ledgerDDL); err != nil {
		return nil, nil, err
	}
	rows, err := db.Query(ctx, `SELECT sequence, file_name, checksum FROM platform.schema_migration`)
	if err != nil {
		return nil, nil, err
	}
	ledger := map[int64]Row{}
	for _, r := range rows {
		ledger[r.Int("sequence")] = r
	}
	for _, m := range ms {
		if rec, ok := ledger[int64(m.Sequence)]; ok {
			if rec.Str("checksum") != m.Checksum {
				return applied, already, &MigrationError{m.UpFile + " was modified after it was applied. An applied migration is immutable; write a new one."}
			}
			already = append(already, m.UpFile)
			continue
		}
		err := db.Tx(ctx, func(tx DB) error {
			if err := tx.Exec(ctx, m.UpSQL); err != nil {
				return fmt.Errorf("%s: %w", m.UpFile, err)
			}
			return tx.Exec(ctx, `INSERT INTO platform.schema_migration (sequence, module, slug, file_name, checksum) VALUES ($1, $2, $3, $4, $5)`,
				m.Sequence, m.Module, m.Slug, m.UpFile, m.Checksum)
		})
		if err != nil {
			return applied, already, err
		}
		applied = append(applied, m.UpFile)
	}
	return applied, already, nil
}

// MigrateDown rolls back applied migrations newest first, down to (but not
// including) toSequence; toSequence < 0 rolls back only the newest one.
func MigrateDown(ctx context.Context, db DB, dir string, toSequence int) ([]string, error) {
	ms, err := LoadMigrations(dir)
	if err != nil {
		return nil, err
	}
	rows, err := db.Query(ctx, `SELECT sequence FROM platform.schema_migration ORDER BY sequence DESC`)
	if err != nil {
		return nil, err
	}
	bySeq := map[int]Migration{}
	for _, m := range ms {
		bySeq[m.Sequence] = m
	}
	var rolled []string
	for i, r := range rows {
		seq := int(r.Int("sequence"))
		if toSequence >= 0 && seq <= toSequence {
			break
		}
		if toSequence < 0 && i > 0 {
			break
		}
		m, ok := bySeq[seq]
		if !ok {
			return rolled, &MigrationError{fmt.Sprintf("applied migration %04d has no file to roll back with", seq)}
		}
		err := db.Tx(ctx, func(tx DB) error {
			if err := tx.Exec(ctx, m.DownSQL); err != nil {
				return fmt.Errorf("%s: %w", m.DownFile, err)
			}
			return tx.Exec(ctx, `DELETE FROM platform.schema_migration WHERE sequence = $1`, seq)
		})
		if err != nil {
			return rolled, err
		}
		rolled = append(rolled, m.DownFile)
	}
	return rolled, nil
}
