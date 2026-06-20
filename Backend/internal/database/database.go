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
		Logger:                                   logger.Default.LogMode(logLevel),
		DisableForeignKeyConstraintWhenMigrating: true,
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
	// Step 1: Run AutoMigrate to create all tables first
	if err := db.AutoMigrate(
		&models.User{},
		&models.Client{},
		&models.Contact{},
		&models.Cluster{},
		&models.Project{},
		&models.InternalProject{},
		&models.InternalProjectMember{},
		&models.InternalProjectColumn{},
		&models.InternalTask{},
		&models.InternalTaskAssignee{},
		&models.InternalTimeLog{},
		&models.InternalSubtask{},
		&models.InternalTaskComment{},
		&models.InternalTaskCommentMention{},
		&models.InternalTaskAttachment{},
		&models.InternalTaskReferenceLink{},
		&models.InternalTaskActivity{},
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
		&models.Notification{},
		&models.TimeCard{},
		&models.File{},
		&models.Todo{},
		&models.Label{},
		&models.Quotation{},
		&models.QuotationItem{},
		&models.AuditLog{},
		&models.AppRole{},
		&models.RolePermission{},
		&models.Milestone{},
		&models.Deliverable{},
		&models.UserPresence{},
		&models.Conversation{},
		&models.ConversationMember{},
		&models.Message{},
		&models.Asset{},
		&models.AssetMasterData{},
	); err != nil {
		return err
	}

	// Step 2: Sync table sequences (AFTER tables exist)
	tables := []string{"projects", "internal_projects", "internal_project_members", "internal_project_columns", "internal_tasks", "internal_task_assignees", "internal_time_logs", "internal_subtasks", "internal_task_comments", "internal_task_comment_mentions", "internal_task_attachments", "internal_task_reference_links", "internal_task_activities", "notifications", "tasks", "clients", "leads", "invoices", "users", "leaves"}
	for _, table := range tables {
		s := fmt.Sprintf(`DO $$ BEGIN PERFORM setval(pg_get_serial_sequence('%s', 'id'), COALESCE((SELECT MAX(id) FROM %s), 0) + 1, false); END $$;`, table, table)
		if err := db.Exec(s).Error; err != nil {
			// Log but don't fail - sequence sync is optional
			fmt.Printf("Warning: failed to sync %s sequence: %v\n", table, err)
		}
	}

	// Step 3: Recalculate progress (AFTER both projects and tasks tables exist)
	if err := db.Exec(`
		UPDATE projects p
		SET progress = COALESCE((
			SELECT CASE WHEN COUNT(*) = 0 THEN 0
			            ELSE ROUND(COUNT(*) FILTER (WHERE status = 'done') * 100.0 / COUNT(*))
			       END
			FROM tasks t
			WHERE t.project_id = p.id AND t.deleted_at IS NULL
		), 0)
	`).Error; err != nil {
		// Log but don't fail - this is just a data fix
		fmt.Printf("Warning: failed to recalculate project progress: %v\n", err)
	}

	if err := seedInternalProjectColumns(db); err != nil {
		return err
	}

	return seedTaskKanbanColumns(db)
}

func seedInternalProjectColumns(db *gorm.DB) error {
	type columnDefinition struct {
		Key      string
		Label    string
		Color    string
		Position int
	}
	definitions := []columnDefinition{
		{Key: "backlog", Label: "Backlog", Color: "slate", Position: 1},
		{Key: "todo", Label: "To Do", Color: "blue", Position: 2},
		{Key: "development", Label: "Development", Color: "yellow", Position: 3},
		{Key: "review", Label: "Review", Color: "purple", Position: 4},
		{Key: "uat", Label: "UAT", Color: "cyan", Position: 5},
		{Key: "deploy_to_production", Label: "Deploy To Production", Color: "orange", Position: 6},
		{Key: "done", Label: "Done", Color: "green", Position: 7},
	}

	var projects []models.InternalProject
	if err := db.Find(&projects).Error; err != nil {
		return err
	}

	for _, project := range projects {
		if err := db.Transaction(func(tx *gorm.DB) error {
			var developmentColumn models.InternalProjectColumn
			err := tx.Where("project_id = ? AND key = ?", project.ID, "development").First(&developmentColumn).Error
			if err == gorm.ErrRecordNotFound {
				var legacyColumn models.InternalProjectColumn
				if legacyErr := tx.Where("project_id = ? AND key = ?", project.ID, "in_progress").First(&legacyColumn).Error; legacyErr == nil {
					if updateErr := tx.Model(&legacyColumn).Updates(map[string]any{
						"key": "development", "label": "Development", "color": "yellow", "position": 3,
					}).Error; updateErr != nil {
						return updateErr
					}
					if updateErr := tx.Model(&models.InternalTask{}).
						Where("project_id = ? AND column_id = ?", project.ID, legacyColumn.ID).
						Update("status", "development").Error; updateErr != nil {
						return updateErr
					}
				}
			} else if err != nil {
				return err
			}

			for _, definition := range definitions {
				var column models.InternalProjectColumn
				err := tx.Where("project_id = ? AND key = ?", project.ID, definition.Key).First(&column).Error
				if err == gorm.ErrRecordNotFound {
					column = models.InternalProjectColumn{
						ProjectID: project.ID, Key: definition.Key, Label: definition.Label,
						Color: definition.Color, Position: definition.Position,
					}
					if err := tx.Create(&column).Error; err != nil {
						return err
					}
					continue
				}
				if err != nil {
					return err
				}
				if err := tx.Model(&column).Updates(map[string]any{
					"label": definition.Label, "color": definition.Color, "position": definition.Position,
				}).Error; err != nil {
					return err
				}
			}
			return nil
		}); err != nil {
			return err
		}
	}

	return nil
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
