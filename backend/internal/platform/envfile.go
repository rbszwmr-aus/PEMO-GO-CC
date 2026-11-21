package platform

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// LoadEnvFile reads KEY=VALUE lines (like node --env-file) into the process
// environment. Variables already set in the environment win.
func LoadEnvFile(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	n := 0
	for sc.Scan() {
		n++
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			return fmt.Errorf("%s:%d: expected KEY=VALUE", path, n)
		}
		k, v = strings.TrimSpace(k), strings.TrimSpace(v)
		if len(v) >= 2 && (v[0] == '"' && v[len(v)-1] == '"' || v[0] == '\'' && v[len(v)-1] == '\'') {
			v = v[1 : len(v)-1]
		}
		if _, set := os.LookupEnv(k); !set {
			_ = os.Setenv(k, v)
		}
	}
	return sc.Err()
}

// FindRepoRoot walks up from dir to the directory holding packages/api-contracts.
func FindRepoRoot(dir string) (string, error) {
	d, err := filepath.Abs(dir)
	if err != nil {
		return "", err
	}
	for {
		if st, err := os.Stat(filepath.Join(d, "packages", "api-contracts")); err == nil && st.IsDir() {
			return d, nil
		}
		parent := filepath.Dir(d)
		if parent == d {
			return "", errors.New("repository root not found (no packages/api-contracts above " + dir + "); pass -root")
		}
		d = parent
	}
}

// PreflightRequired are the variables every command needs.
var PreflightRequired = []string{"PEMO_ENV", "PEMO_DB_NAME", "PEMO_DB_USER", "PEMO_DB_PASSWORD", "PEMO_DEV_TOKEN_SECRET"}

// Preflight explains missing configuration before anything connects.
func Preflight(envPath string) error {
	var missing []string
	for _, k := range PreflightRequired {
		if strings.TrimSpace(os.Getenv(k)) == "" {
			missing = append(missing, k)
		}
	}
	if len(missing) == 0 {
		return nil
	}
	state := envPath + " does not exist, so nothing was loaded."
	if _, err := os.Stat(envPath); err == nil {
		state = envPath + " exists, but these variables are unset: " + strings.Join(missing, ", ")
	}
	return &ConfigurationError{Msg: strings.Join([]string{"", "PEMO backend configuration is missing.", "", "  " + state, "",
		"  Missing: " + strings.Join(missing, ", "), "", "  Fix:", "    cp database/dev/.env.example " + envPath,
		"    # then set the values in " + envPath, "", "  " + envPath + " is git-ignored and must never be committed.", ""}, "\n")}
}
