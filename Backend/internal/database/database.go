package database

import (
	"fmt"

	"github.com/cbqa/backend/internal/config"
	"github.com/cbqa/backend/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Connect(cfg *config.Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable TimeZone=Asia/Jakarta",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName,
	)

	logLevel := logger.Silent
	if cfg.Env == "development" {
		logLevel = logger.Info
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	return db, nil
}

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&models.User{},
		&models.Client{},
		&models.Contact{},
		&models.Project{},
		&models.TaskKanbanColumn{},
		&models.Task{},
		&models.Lead{},
		&models.Invoice{},
		&models.InvoiceItem{},
		&models.Payment{},
		&models.Contract{},
		&models.Item{},
		&models.Order{},
		&models.Event{},
		&models.Note{},
		&models.Expense{},
		&models.Leave{},
		&models.Announcement{},
		&models.TimeCard{},
		&models.File{},
		&models.Todo{},
		&models.Label{},
		&models.Quotation{},
		&models.QuotationItem{},
		&models.AuditLog{},
		&models.AppRole{},
		&models.RolePermission{},
	); err != nil {
		return err
	}

	// Sync all table sequences to prevent ID gaps
	tables := []string{"projects", "tasks", "clients", "leads", "invoices", "team_members", "leave_requests"}
	for _, table := range tables {
		s := fmt.Sprintf(`DO $$ BEGIN PERFORM setval(pg_get_serial_sequence('%s', 'id'), COALESCE((SELECT MAX(id) FROM %s), 0) + 1, false); END $$;`, table, table)
		db.Exec(s)
	}

	return seedTaskKanbanColumns(db)
}

func seedTaskKanbanColumns(db *gorm.DB) error {
	defaultColumns := []models.TaskKanbanColumn{
		{Title: "To Do", Status: "todo", Position: 1},
		{Title: "In Progress", Status: "in_progress", Position: 2},
		{Title: "Done", Status: "done", Position: 3},
		{Title: "Expired", Status: "expired", Position: 4},
	}

	for _, column := range defaultColumns {
		var existing models.TaskKanbanColumn
		err := db.Where("status = ?", column.Status).Order("position asc, id asc").First(&existing).Error
		if err == nil {
			continue
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		if err := db.Create(&column).Error; err != nil {
			return err
		}
	}

	for _, status := range []string{"todo", "in_progress", "done", "expired"} {
		var column models.TaskKanbanColumn
		if err := db.Where("status = ?", status).Order("position asc, id asc").First(&column).Error; err != nil {
			return err
		}

		var maxPosition int
		db.Model(&models.Task{}).
			Where("kanban_column_id = ?", column.ID).
			Select("COALESCE(MAX(kanban_position), 0)").
			Scan(&maxPosition)

		var tasks []models.Task
		if err := db.
			Where("status = ? AND kanban_column_id IS NULL", status).
			Order("updated_at asc, id asc").
			Find(&tasks).Error; err != nil {
			return err
		}

		for index, task := range tasks {
			if err := db.Model(&models.Task{}).
				Where("id = ?", task.ID).
				Updates(map[string]interface{}{
					"kanban_column_id": column.ID,
					"kanban_position":  maxPosition + index + 1,
				}).Error; err != nil {
				return err
			}
		}
	}

	return nil
}
