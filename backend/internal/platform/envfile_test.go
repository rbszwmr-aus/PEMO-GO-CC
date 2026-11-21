package platform

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadEnvFileKeepsExistingEnvironment(t *testing.T) {
	f := filepath.Join(t.TempDir(), ".env")
	_ = os.WriteFile(f, []byte("# c\nPEMO_T_A=1\nexport PEMO_T_B=\"two words\"\nPEMO_T_C=file\n"), 0o600)
	t.Setenv("PEMO_T_C", "env")
	if err := LoadEnvFile(f); err != nil {
		t.Fatal(err)
	}
	if os.Getenv("PEMO_T_A") != "1" || os.Getenv("PEMO_T_B") != "two words" || os.Getenv("PEMO_T_C") != "env" {
		t.Fatal("env file semantics")
	}
}

func TestConfigDefaultsAvoidOtherProjectsPorts(t *testing.T) {
	env := map[string]string{"PEMO_ENV": "development", "PEMO_DB_NAME": "x", "PEMO_DB_USER": "u", "PEMO_DB_PASSWORD": "p", "PEMO_DEV_TOKEN_SECRET": "s", "PEMO_DB_OWNER_USER": "o", "PEMO_DB_OWNER_PASSWORD": "p"}
	c, err := LoadConfigFrom(func(k string) (string, bool) { v, ok := env[k]; return v, ok })
	if err != nil {
		t.Fatal(err)
	}
	reserved := map[int]bool{3100: true, 3200: true, 3210: true, 3300: true, 5173: true, 5174: true, 5175: true, 5176: true, 5177: true,
		5179: true, 5185: true, 5186: true, 5432: true, 55432: true, 55433: true, 55434: true, 18120: true, 18121: true, 8080: true}
	if reserved[c.HTTPPort] || reserved[c.Database.Port] {
		t.Fatalf("default ports %d/%d collide with another project", c.HTTPPort, c.Database.Port)
	}
}
