module pemo

go 1.24.7

replace gopkg.in/yaml.v3 => ./third_party/stub/gopkg_in_yaml_v3

replace gopkg.in/check.v1 => ./third_party/stub/gopkg_in_check_v1

replace golang.org/x/text => github.com/golang/text v0.27.0

replace golang.org/x/crypto => github.com/golang/crypto v0.40.0

replace golang.org/x/sync => github.com/golang/sync v0.16.0

require github.com/jackc/pgx/v5 v5.7.5

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	golang.org/x/crypto v0.37.0 // indirect
	golang.org/x/sync v0.16.0 // indirect
	golang.org/x/text v0.27.0 // indirect
)
