package main

import (
	"context"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"pemo/internal/platform"
)

// Module packages map to the schema each owns.
var modulePackages = map[string]string{
	"platform": "platform", "property": "property", "access": "access", "resident": "resident", "homesafety": "home_safety",
	"notices": "notices", "helpdesk": "helpdesk", "strata": "strata", "integration": "integration",
}

// moduleSchemas are the schemas a runtime query may not qualify (except its own).
var moduleSchemas = []string{"platform", "property", "resident", "home_safety", "integration", "access", "notices", "helpdesk", "service_case", "strata"}

type exemption struct{ file, schema, reason string }

var exemptions = []exemption{
	{"internal/platform/audit.go", "access", "THE sanctioned crossing (GEN-011): platform writes the audit row through access.append_audit_event on the calling module's own transaction."},
	{"internal/platform/audit.go", "platform", "idempotency functions are platform's own, called on the module's transaction."},
	{"internal/caseacts/caseacts.go", "service_case", "service_case is written only through its SECURITY DEFINER commands (open_from_ticket, append_assertion), granted to the helpdesk login."},
}

var sqlVerb = regexp.MustCompile(`(?i)\b(SELECT|INSERT|UPDATE|DELETE|FROM|JOIN|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE)\b`)

func (e *env) verifyBoundaries(ctx context.Context) (int, error) {
	var failures []string
	check := func(name string, ok bool, detail string) {
		tag := "ok  "
		if !ok {
			tag = "FAIL"
			failures = append(failures, name+": "+detail)
		}
		if detail != "" {
			fmt.Printf("%s  %s — %s\n", tag, name, detail)
		} else {
			fmt.Printf("%s  %s\n", tag, name)
		}
	}
	backend := filepath.Join(e.root, "backend")
	if _, err := os.Stat(backend); err != nil {
		backend = "."
	}
	fset := token.NewFileSet()
	err := filepath.WalkDir(filepath.Join(backend, "internal"), func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") {
			return err
		}
		rel, _ := filepath.Rel(backend, path)
		rel = filepath.ToSlash(rel)
		parts := strings.Split(rel, "/")
		pkg := parts[1]
		f, err := parser.ParseFile(fset, path, nil, parser.ParseComments)
		if err != nil {
			return err
		}
		own, isModule := modulePackages[pkg]
		// Layer 1: a module imports only platform (and the standard library / drivers).
		if isModule && !strings.HasSuffix(rel, "_test.go") {
			var bad []string
			for _, im := range f.Imports {
				p, _ := strconv.Unquote(im.Path.Value)
				if strings.HasPrefix(p, "pemo/internal/") && p != "pemo/internal/platform" && p != "pemo/internal/"+pkg {
					bad = append(bad, p)
				}
			}
			check("no-module-to-module("+rel+")", len(bad) == 0, strings.Join(bad, ", "))
		}
		// Layer 2: schema-qualified SQL reaching another module's schema.
		var findings []string
		ast.Inspect(f, func(n ast.Node) bool {
			lit, ok := n.(*ast.BasicLit)
			if !ok || lit.Kind != token.STRING {
				return true
			}
			s, err := strconv.Unquote(lit.Value)
			if err != nil || !sqlVerb.MatchString(s) {
				return true
			}
			for _, schema := range moduleSchemas {
				if isModule && schema == own {
					continue
				}
				if slices.ContainsFunc(exemptions, func(x exemption) bool { return x.file == rel && x.schema == schema }) {
					continue
				}
				re := regexp.MustCompile(`(?i)\b"?` + schema + `"?\s*\.\s*"?[a-z_][a-z0-9_]*`)
				for _, m := range re.FindAllString(s, -1) {
					findings = append(findings, m)
				}
			}
			return true
		})
		if !strings.HasSuffix(rel, "_test.go") {
			check("no-cross-schema-sql("+rel+")", len(findings) == 0, strings.Join(findings, ", "))
		}
		return nil
	})
	if err != nil {
		return 1, err
	}
	for _, x := range exemptions {
		fmt.Printf("ok    sanctioned-crossing(%s → %s) — %s\n", x.file, x.schema, strings.SplitN(x.reason, ".", 2)[0])
	}
	// Layers 3 and 4: the database itself.
	db, err := e.owner(ctx)
	if err != nil {
		return 1, err
	}
	defer db.Close()
	fks, err := db.Query(ctx, `SELECT c.conname, ns.nspname AS from_schema, fns.nspname AS to_schema, t.relname AS from_table
       FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace ns ON ns.oid = t.relnamespace
       JOIN pg_class ft ON ft.oid = c.confrelid JOIN pg_namespace fns ON fns.oid = ft.relnamespace
      WHERE c.contype = 'f' AND ns.nspname <> fns.nspname AND ns.nspname = ANY($1::text[]) AND fns.nspname = ANY($1::text[])`, moduleSchemas)
	if err != nil {
		return 1, err
	}
	var fkd []string
	for _, r := range fks {
		fkd = append(fkd, fmt.Sprintf("%s.%s → %s (%s)", r.Str("from_schema"), r.Str("from_table"), r.Str("to_schema"), r.Str("conname")))
	}
	check("no-cross-module-foreign-key", len(fks) == 0, strings.Join(fkd, "; "))
	rows, err := db.Query(ctx, `SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg\_%' ESCAPE '\' AND nspname NOT IN ('information_schema','public') ORDER BY 1`)
	if err != nil {
		return 1, err
	}
	var found []string
	for _, r := range rows {
		found = append(found, r.Str("nspname"))
	}
	allowed := append([]string{}, platform.AllSchemas...)
	slices.Sort(allowed)
	slices.Sort(found)
	check("only-in-scope-schemas", slices.Equal(found, allowed), strings.Join(found, ", "))
	fmt.Println()
	if len(failures) > 0 {
		fmt.Printf("FAIL — %d boundary violation(s).\n", len(failures))
		return 1, nil
	}
	fmt.Println("PASS — module boundaries hold at all four layers.")
	return 0, nil
}
