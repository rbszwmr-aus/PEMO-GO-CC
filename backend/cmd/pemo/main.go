// Command pemo is the operator CLI (Go port of apps/api/src/cli and
// database/bootstrap.sh). Every subcommand loads database/dev/.env first.
//
//	pemo bootstrap [--with-seed]     roles, login passwords, migrations, grants (and seeds)
//	pemo migrate [up | down [floor]] migrations as the owner
//	pemo seed [scenario.sql]         base seeds + default scenarios, or one scenario
//	pemo dev-token <principalId>     a development staff token
//	pemo resident-token <residentId> a development resident token
//	pemo provision-organization <orgId> <externalId> <displayName> <groupName> [reasonCode]
//	pemo verify-boundaries           module boundaries (Go imports, SQL, database)
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata"

	"pemo/internal/api"
	"pemo/internal/platform"
)

const usage = `usage: pemo [-env-file F] [-root DIR] <command> [args]

commands:
  bootstrap [--with-seed]
  migrate [up | down [floorSequence]]
  seed [scenario.sql]
  dev-token <staffPrincipalId>
  resident-token <residentId> [--expired]
  reseed                        (clear rows that block the base seeds, then re-apply them; test harness)
  provision-organization <orgId> <externalId> <displayName> <groupName> [reasonCode]
  verify-boundaries`

func main() {
	envFile := flag.String("env-file", "database/dev/.env", "KEY=VALUE file (existing environment wins)")
	root := flag.String("root", "", "repository root")
	flag.Usage = func() { fmt.Fprintln(os.Stderr, usage) }
	flag.Parse()
	args := flag.Args()
	if len(args) == 0 {
		flag.Usage()
		os.Exit(2)
	}
	code, err := run(*envFile, *root, args)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		if code == 0 {
			code = 1
		}
	}
	os.Exit(code)
}

type env struct {
	root string
	cfg  *platform.Config
	log  *platform.Logger
}

func setup(envFile, root string, needConfig bool) (*env, error) {
	if root == "" {
		r, err := platform.FindRepoRoot(".")
		if err != nil {
			return nil, err
		}
		root = r
	}
	if !filepath.IsAbs(envFile) {
		envFile = filepath.Join(root, envFile)
	}
	_ = platform.LoadEnvFile(envFile)
	e := &env{root: root}
	if !needConfig {
		return e, nil
	}
	if err := platform.Preflight(envFile); err != nil {
		return nil, err
	}
	cfg, err := platform.LoadConfig()
	if err != nil {
		return nil, err
	}
	e.cfg, e.log = cfg, platform.NewLogger(cfg.LogLevel, "pemo-cli")
	return e, nil
}

func run(envFile, root string, args []string) (int, error) {
	ctx := context.Background()
	cmd, rest := args[0], args[1:]
	needConfig := cmd != "verify-boundaries-static"
	e, err := setup(envFile, root, needConfig)
	if err != nil {
		return 1, err
	}
	switch cmd {
	case "bootstrap":
		return 0, e.bootstrap(ctx, len(rest) > 0 && rest[0] == "--with-seed")
	case "migrate":
		return 0, e.migrate(ctx, rest)
	case "seed":
		return 0, e.seed(ctx, rest)
	case "dev-token":
		if len(rest) != 1 {
			return 2, errors.New("usage: pemo dev-token <staff principal id>")
		}
		return e.devToken(ctx, rest[0])
	case "resident-token":
		if len(rest) < 1 || len(rest) > 2 || (len(rest) == 2 && rest[1] != "--expired") {
			return 2, errors.New("usage: pemo resident-token <resident id> [--expired]")
		}
		return e.residentToken(ctx, rest[0], len(rest) == 2)
	case "reseed":
		return 0, e.reseed(ctx)
	case "provision-organization":
		if len(rest) < 4 {
			return 2, errors.New("usage: pemo provision-organization <orgId> <externalId> <displayName> <groupName> [reasonCode]")
		}
		return e.provision(ctx, rest)
	case "verify-boundaries":
		return e.verifyBoundaries(ctx)
	}
	return 2, fmt.Errorf("unknown command %q\n%s", cmd, usage)
}

func (e *env) owner(ctx context.Context) (platform.DB, error) {
	return platform.NewAdminDB(ctx, e.cfg.DatabaseOwner, e.cfg.DBPool)
}

func (e *env) execFile(ctx context.Context, db platform.DB, file string, prelude string) error {
	b, err := os.ReadFile(file)
	if err != nil {
		return err
	}
	return db.Tx(ctx, func(tx platform.DB) error {
		if prelude != "" {
			if err := tx.Exec(ctx, prelude); err != nil {
				return err
			}
		}
		if err := tx.Exec(ctx, string(b)); err != nil {
			return fmt.Errorf("%s: %w", filepath.Base(file), err)
		}
		return nil
	})
}

func sqlLit(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }

var ident = regexp.MustCompile(`^[a-z_][a-z0-9_]*$`)

func (e *env) bootstrap(ctx context.Context, withSeed bool) error {
	db, err := e.owner(ctx)
	if err != nil {
		return err
	}
	defer db.Close()
	envSet := "SELECT set_config('pemo.env', " + sqlLit(e.cfg.Environment) + ", true)"
	step := func(name, detail string) { fmt.Printf("  %-14s %s\n", name, detail) }
	step("ensure-roles", "database/roles/000-roles.sql")
	if err := e.execFile(ctx, db, filepath.Join(e.root, "database", "roles", "000-roles.sql"), envSet); err != nil {
		return fmt.Errorf("ensure-roles: %w", err)
	}
	prefix := os.Getenv("PEMO_DB_LOGIN_PREFIX")
	if prefix == "" {
		prefix = "pemo_app_"
	}
	setPassword := func(role, pass string) error {
		if !ident.MatchString(role) {
			return fmt.Errorf("refusing role name %q", role)
		}
		return db.Exec(ctx, "ALTER ROLE "+role+" LOGIN PASSWORD "+sqlLit(pass))
	}
	if err := setPassword(os.Getenv("PEMO_DB_USER"), os.Getenv("PEMO_DB_PASSWORD")); err != nil {
		return fmt.Errorf("could not set %s's password: %w", os.Getenv("PEMO_DB_USER"), err)
	}
	schemas := []string{"platform", "property", "resident", "home_safety", "access", "notices", "helpdesk", "strata"}
	if e.cfg.Environment == "development" || e.cfg.Environment == "test" || e.cfg.Environment == "ci" {
		schemas = append(schemas, "dev_scaffold")
	}
	for _, s := range schemas {
		pass := os.Getenv("PEMO_DB_PASSWORD_" + strings.ToUpper(s))
		if pass == "" {
			pass = os.Getenv("PEMO_DB_MODULE_PASSWORD")
		}
		if pass == "" {
			pass = os.Getenv("PEMO_DB_PASSWORD")
		}
		if err := setPassword(prefix+s, pass); err != nil {
			return fmt.Errorf("could not set %s%s's password: %w", prefix, s, err)
		}
	}
	step("migrate", "as "+e.cfg.DatabaseOwner.User)
	applied, already, err := platform.MigrateUp(ctx, db, filepath.Join(e.root, "database", "migrations"))
	if err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	fmt.Printf("                 applied %d, already applied %d\n", len(applied), len(already))
	step("apply-grants", "database/roles/010-grants.sql (per-module, reconciling)")
	if err := e.execFile(ctx, db, filepath.Join(e.root, "database", "roles", "010-grants.sql"), envSet); err != nil {
		return fmt.Errorf("apply-grants: %w", err)
	}
	if withSeed {
		step("seed", "as "+e.cfg.DatabaseOwner.User)
		if err := e.seedAll(ctx, db); err != nil {
			return err
		}
	}
	fmt.Printf("  ok             bootstrap complete — module pools connect as %s<schema>, owner is %s\n", prefix, e.cfg.DatabaseOwner.User)
	return nil
}

func (e *env) migrate(ctx context.Context, args []string) error {
	db, err := e.owner(ctx)
	if err != nil {
		return err
	}
	defer db.Close()
	dir := filepath.Join(e.root, "database", "migrations")
	direction := "up"
	if len(args) > 0 {
		direction = args[0]
	}
	switch direction {
	case "up":
		applied, already, err := platform.MigrateUp(ctx, db, dir)
		if err != nil {
			return err
		}
		e.log.Info("migrations applied", map[string]any{"applied": len(applied), "alreadyApplied": len(already), "files": applied})
	case "down":
		floor := 0
		if len(args) > 1 {
			n, err := strconv.Atoi(args[1])
			if err != nil || n < 0 {
				return fmt.Errorf("down target must be a non-negative integer sequence, received %q", args[1])
			}
			floor = n
		}
		rolled, err := platform.MigrateDown(ctx, db, dir, floor)
		if err != nil {
			return err
		}
		e.log.Info("migrations rolled back", map[string]any{"count": len(rolled), "files": rolled})
	default:
		return fmt.Errorf("unknown direction %q. Use \"up\" or \"down\"", direction)
	}
	return nil
}

func sqlFiles(dir, suffix string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	var out []string
	for _, d := range entries {
		if !d.IsDir() && strings.HasSuffix(d.Name(), suffix) {
			out = append(out, d.Name())
		}
	}
	sort.Strings(out)
	return out, nil
}

func (e *env) seedAll(ctx context.Context, db platform.DB) error {
	seeds := filepath.Join(e.root, "database", "seeds")
	files, err := sqlFiles(seeds, ".sql")
	if err != nil {
		return err
	}
	for _, f := range files {
		if err := e.execFile(ctx, db, filepath.Join(seeds, f), ""); err != nil {
			return err
		}
	}
	e.log.Info("base seeds applied", map[string]any{"files": files})
	scen := filepath.Join(seeds, "scenarios")
	defaults, err := sqlFiles(scen, "__default.sql")
	if err != nil {
		return err
	}
	for _, f := range defaults {
		if err := e.execFile(ctx, db, filepath.Join(scen, f), ""); err != nil {
			return err
		}
	}
	e.log.Info("default scenarios applied", map[string]any{"files": defaults})
	return nil
}

func (e *env) seed(ctx context.Context, args []string) error {
	db, err := e.owner(ctx)
	if err != nil {
		return err
	}
	defer db.Close()
	if len(args) > 0 {
		f := args[0]
		if !filepath.IsAbs(f) {
			f = filepath.Join(e.root, "database", "seeds", "scenarios", f)
		}
		if err := e.execFile(ctx, db, f, ""); err != nil {
			return err
		}
		e.log.Info("scenario applied", map[string]any{"file": args[0]})
		return nil
	}
	return e.seedAll(ctx, db)
}

var deleteFrom = regexp.MustCompile(`(?i)DELETE\s+FROM\s+([a-z_]+\.[a-z_]+)`)

// reseed is the test harness's reseed: clear every table with a foreign key
// into a table the seeds clear (derived, never listed), then apply the base seeds.
func (e *env) reseed(ctx context.Context) error {
	db, err := e.owner(ctx)
	if err != nil {
		return err
	}
	defer db.Close()
	seeds := filepath.Join(e.root, "database", "seeds")
	files, err := sqlFiles(seeds, ".sql")
	if err != nil {
		return err
	}
	cleared := map[string]bool{}
	for _, f := range files {
		b, err := os.ReadFile(filepath.Join(seeds, f))
		if err != nil {
			return err
		}
		for _, m := range deleteFrom.FindAllStringSubmatch(string(b), -1) {
			cleared[strings.ToLower(m[1])] = true
		}
	}
	if len(cleared) == 0 {
		return errors.New("reseed: parsed no DELETE target out of the seed files")
	}
	list := make([]string, 0, len(cleared))
	for t := range cleared {
		list = append(list, t)
	}
	deps, err := db.Query(ctx, `SELECT DISTINCT ns.nspname || '.' || t.relname AS dependent
         FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace ns ON ns.oid = t.relnamespace
         JOIN pg_class ft ON ft.oid = c.confrelid JOIN pg_namespace fns ON fns.oid = ft.relnamespace
        WHERE c.contype = 'f' AND fns.nspname || '.' || ft.relname = ANY($1::text[])`, list)
	if err != nil {
		return err
	}
	for _, d := range deps {
		name := d.Str("dependent")
		if !regexp.MustCompile(`^[a-z_]+\.[a-z_]+$`).MatchString(name) {
			return fmt.Errorf("reseed: unexpected table name %q", name)
		}
		if err := db.Exec(ctx, "DELETE FROM "+name); err != nil {
			return err
		}
	}
	for _, f := range files {
		if err := e.execFile(ctx, db, filepath.Join(seeds, f), ""); err != nil {
			return err
		}
	}
	return nil
}

func (e *env) devToken(ctx context.Context, principalID string) (int, error) {
	db, err := platform.NewModuleDB(ctx, "access", e.cfg.DatabaseOwner, e.cfg.DBPool)
	if err != nil {
		return 1, err
	}
	defer db.Close()
	r, err := db.QueryOne(ctx, `SELECT principal_id FROM staff_principal WHERE principal_id = $1`, principalID)
	if err != nil {
		return 1, err
	}
	if r == nil {
		return 1, errors.New("unknown principal")
	}
	fmt.Println(api.NewStaffAuth(api.NewDevAuth(e.cfg)).Issue(r.Str("principal_id"), time.Now()))
	return 0, nil
}

func (e *env) residentToken(ctx context.Context, residentID string, expired bool) (int, error) {
	db, err := platform.NewModuleDB(ctx, "resident", e.cfg.DatabaseOwner, e.cfg.DBPool)
	if err != nil {
		return 1, err
	}
	defer db.Close()
	r, err := db.QueryOne(ctx, `SELECT resident_id FROM resident WHERE resident_id = $1`, residentID)
	if err != nil {
		return 1, err
	}
	if r == nil {
		return 1, errors.New("unknown resident")
	}
	at := time.Now()
	if expired {
		at = at.Add(-time.Duration(e.cfg.DevTokenTTLSeconds+60) * time.Second)
	}
	fmt.Println(api.NewDevAuth(e.cfg).Issue(residentID, at))
	return 0, nil
}

func (e *env) provision(ctx context.Context, a []string) (int, error) {
	db, err := platform.NewModuleDB(ctx, "access", e.cfg.DatabaseOwner, e.cfg.DBPool)
	if err != nil {
		return 1, err
	}
	defer db.Close()
	in := api.GenesisInput{OrganizationID: a[0], ExternalID: a[1], DisplayName: a[2], GroupName: a[3]}
	if len(a) > 4 && a[4] != "" {
		in.ReasonCode = &a[4]
	}
	out, err := api.ProvisionOrganization(ctx, db, in)
	var ge *api.GenesisInputError
	if errors.As(err, &ge) {
		return 2, fmt.Errorf("bad input: %s", ge.Error())
	}
	if err != nil {
		return 1, err
	}
	switch out.Kind {
	case "provisioned":
		fmt.Printf("provisioned %s\n  grant %s\n", a[0], out.GrantID)
	case "replayed":
		fmt.Printf("already provisioned (idempotent replay) %s\n  grant %s\n", a[0], out.GrantID)
	default:
		return 1, fmt.Errorf("refused: %s", out.Reason)
	}
	return 0, nil
}

var _ = json.Marshal
