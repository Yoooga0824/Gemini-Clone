package database

import (
	"database/sql"
	"fmt"
	"os"
	"strings"
)

func RunInitMigration(db *sql.DB, migrationPath string) error {
	sqlBytes, err := os.ReadFile(migrationPath)
	if err != nil {
		return fmt.Errorf("read migration file: %w", err)
	}

	statements := strings.Split(string(sqlBytes), ";")
	for _, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("run migration statement failed: %w", err)
		}
	}
	return nil
}
