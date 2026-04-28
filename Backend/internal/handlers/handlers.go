package handlers

import (
	"crypto/rand"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/cbqa/backend/internal/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// ─── HELPERS ─────────────────────────────────────────

func recordAudit(db *gorm.DB, c *gin.Context, action, entityType string, entityID uint, entityName string) {
	db.Create(&models.AuditLog{
		UserID:     getUserID(c),
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		EntityName: entityName,
		IPAddress:  c.ClientIP(),
	})
}

func getID(c *gin.Context) (uint, error) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	return uint(id), err
}

func getUserID(c *gin.Context) uint {
	id, _ := c.Get("user_id")
	return id.(uint)
}

type PaginationQuery struct {
	Page  int    `form:"page,default=1"`
	Limit int    `form:"limit,default=10"`
	Q     string `form:"q"`
}

func paginate(q PaginationQuery) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		offset := (q.Page - 1) * q.Limit
		return db.Offset(offset).Limit(q.Limit)
	}
}

// ─── DASHBOARD ───────────────────────────────────────

type DashboardHandler struct{ db *gorm.DB }

func NewDashboardHandler(db *gorm.DB) *DashboardHandler { return &DashboardHandler{db: db} }

func dashboardRangeStart(now time.Time, rangeKey string) (time.Time, bool) {
	switch strings.ToLower(strings.TrimSpace(rangeKey)) {
	case "", "all":
		return time.Time{}, false
	case "7d":
		return now.AddDate(0, 0, -7), true
	case "30d":
		return now.AddDate(0, 0, -30), true
	case "90d":
		return now.AddDate(0, 0, -90), true
	case "ytd":
		return time.Date(now.Year(), time.January, 1, 0, 0, 0, 0, now.Location()), true
	default:
		return time.Time{}, false
	}
}

func applyDashboardRange(query *gorm.DB, column string, start time.Time, enabled bool) *gorm.DB {
	if !enabled {
		return query
	}
	return query.Where(column+" >= ?", start)
}

func (h *DashboardHandler) GetStats(c *gin.Context) {
	userID := getUserID(c)
	var stats struct {
		Range               string  `json:"range"`
		OpenTasks           int64   `json:"open_tasks"`
		OpenProjects        int64   `json:"open_projects"`
		CompletedProjects   int64   `json:"completed_projects"`
		HoldProjects        int64   `json:"hold_projects"`
		TotalClients        int64   `json:"total_clients"`
		TotalLeads          int64   `json:"total_leads"`
		TotalMembers        int64   `json:"total_members"`
		DueAmount           float64 `json:"due_amount"`
		TotalIncome         float64 `json:"total_income"`
		TotalExpenses       float64 `json:"total_expenses"`
		TasksTodo           int64   `json:"tasks_todo"`
		TasksInProgress     int64   `json:"tasks_in_progress"`
		TasksDone           int64   `json:"tasks_done"`
		TasksExpired        int64   `json:"tasks_expired"`
		OverdueAmount       float64 `json:"overdue_amount"`
		NotPaidAmount       float64 `json:"not_paid_amount"`
		PartiallyPaidAmount float64 `json:"partially_paid_amount"`
		FullyPaidAmount     float64 `json:"fully_paid_amount"`
		DraftAmount         float64 `json:"draft_amount"`
		TotalInvoiced       float64 `json:"total_invoiced"`
		ClockedInCount      int64   `json:"clocked_in_count"`
		OnLeaveToday        int64   `json:"on_leave_today"`
	}
	now := time.Now()
	today := now.Format("2006-01-02")
	stats.Range = strings.ToLower(strings.TrimSpace(c.DefaultQuery("range", "all")))
	rangeStart, hasRange := dashboardRangeStart(now, stats.Range)

	applyRange := func(query *gorm.DB) *gorm.DB {
		return applyDashboardRange(query, "created_at", rangeStart, hasRange)
	}

	applyRange(h.db.Model(&models.Task{})).Where("assigned_to_id = ? AND status != 'done'", userID).Count(&stats.OpenTasks)
	applyRange(h.db.Model(&models.Project{})).Where("status = 'open'").Count(&stats.OpenProjects)
	applyRange(h.db.Model(&models.Project{})).Where("status = 'completed'").Count(&stats.CompletedProjects)
	applyRange(h.db.Model(&models.Project{})).Where("status = 'hold'").Count(&stats.HoldProjects)
	applyRange(h.db.Model(&models.Client{})).Count(&stats.TotalClients)
	applyRange(h.db.Model(&models.Lead{})).Count(&stats.TotalLeads)
	h.db.Model(&models.User{}).Where("is_active = true").Count(&stats.TotalMembers)
	applyRange(h.db.Model(&models.Invoice{})).Select("COALESCE(SUM(due_amount),0)").Scan(&stats.DueAmount)
	applyRange(h.db.Model(&models.Payment{})).Select("COALESCE(SUM(amount),0)").Scan(&stats.TotalIncome)
	applyRange(h.db.Model(&models.Expense{})).Select("COALESCE(SUM(total),0)").Scan(&stats.TotalExpenses)
	applyRange(h.db.Model(&models.Task{})).Where("status = 'todo'").Count(&stats.TasksTodo)
	applyRange(h.db.Model(&models.Task{})).Where("status = 'in_progress'").Count(&stats.TasksInProgress)
	applyRange(h.db.Model(&models.Task{})).Where("status = 'done'").Count(&stats.TasksDone)
	applyRange(h.db.Model(&models.Task{})).Where("status = 'expired'").Count(&stats.TasksExpired)
	applyRange(h.db.Model(&models.Invoice{})).Where("status = 'overdue'").Select("COALESCE(SUM(due_amount),0)").Scan(&stats.OverdueAmount)
	applyRange(h.db.Model(&models.Invoice{})).Where("status = 'not_paid'").Select("COALESCE(SUM(total_amount),0)").Scan(&stats.NotPaidAmount)
	applyRange(h.db.Model(&models.Invoice{})).Where("status = 'partially_paid'").Select("COALESCE(SUM(due_amount),0)").Scan(&stats.PartiallyPaidAmount)
	applyRange(h.db.Model(&models.Invoice{})).Where("status = 'fully_paid'").Select("COALESCE(SUM(total_amount),0)").Scan(&stats.FullyPaidAmount)
	applyRange(h.db.Model(&models.Invoice{})).Where("status = 'draft'").Select("COALESCE(SUM(total_amount),0)").Scan(&stats.DraftAmount)
	applyRange(h.db.Model(&models.Invoice{})).Select("COALESCE(SUM(total_amount),0)").Scan(&stats.TotalInvoiced)
	h.db.Model(&models.User{}).Where("clocked_in = true AND is_active = true").Count(&stats.ClockedInCount)
	h.db.Model(&models.Leave{}).Where("status = 'approved' AND DATE(start_date) <= ? AND DATE(end_date) >= ?", today, today).Count(&stats.OnLeaveToday)
	c.JSON(http.StatusOK, stats)
}

// ─── CLIENT ──────────────────────────────────────────

type ClientHandler struct{ db *gorm.DB }

func NewClientHandler(db *gorm.DB) *ClientHandler { return &ClientHandler{db: db} }

func (h *ClientHandler) ListAllContacts(c *gin.Context) {
	var contacts []models.Contact
	h.db.Preload("Client").Find(&contacts)
	c.JSON(http.StatusOK, gin.H{"data": contacts, "total": len(contacts)})
}

func (h *ClientHandler) List(c *gin.Context) {
	var q PaginationQuery
	c.ShouldBindQuery(&q)
	var clients []models.Client
	var total int64
	query := h.db.Model(&models.Client{}).Preload("Owner").Preload("Labels")
	if q.Q != "" {
		query = query.Where("name ILIKE ?", "%"+q.Q+"%")
	}
	query.Count(&total)
	query.Scopes(paginate(q)).Find(&clients)
	c.JSON(http.StatusOK, gin.H{"data": clients, "total": total, "page": q.Page, "limit": q.Limit})
}

func (h *ClientHandler) Create(c *gin.Context) {
	var client models.Client
	if err := c.ShouldBindJSON(&client); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if client.OwnerID == 0 {
		client.OwnerID = getUserID(c)
	}
	if err := h.db.Create(&client).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	recordAudit(h.db, c, "create", "client", client.ID, client.Name)
	c.JSON(http.StatusCreated, client)
}

func (h *ClientHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var client models.Client
	if err := h.db.Preload("Owner").Preload("Contacts").Preload("Labels").First(&client, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Client not found"})
		return
	}
	c.JSON(http.StatusOK, client)
}

func (h *ClientHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var client models.Client
	if err := h.db.First(&client, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Client not found"})
		return
	}
	if err := c.ShouldBindJSON(&client); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Save(&client)
	recordAudit(h.db, c, "update", "client", client.ID, client.Name)
	c.JSON(http.StatusOK, client)
}

func (h *ClientHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	var client models.Client
	h.db.First(&client, id)
	h.db.Delete(&models.Client{}, id)
	recordAudit(h.db, c, "delete", "client", id, client.Name)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *ClientHandler) GetContacts(c *gin.Context) {
	id, _ := getID(c)
	var contacts []models.Contact
	h.db.Where("client_id = ?", id).Find(&contacts)
	c.JSON(http.StatusOK, gin.H{"data": contacts})
}

func (h *ClientHandler) AddContact(c *gin.Context) {
	id, _ := getID(c)
	var contact models.Contact
	if err := c.ShouldBindJSON(&contact); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	contact.ClientID = id
	h.db.Create(&contact)
	c.JSON(http.StatusCreated, contact)
}

func (h *ClientHandler) UpdateContact(c *gin.Context) {
	contactID, _ := strconv.ParseUint(c.Param("contactId"), 10, 64)
	var contact models.Contact
	if err := h.db.First(&contact, contactID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contact not found"})
		return
	}
	c.ShouldBindJSON(&contact)
	h.db.Save(&contact)
	c.JSON(http.StatusOK, contact)
}

func (h *ClientHandler) DeleteContact(c *gin.Context) {
	contactID, _ := strconv.ParseUint(c.Param("contactId"), 10, 64)
	h.db.Delete(&models.Contact{}, contactID)
	c.JSON(http.StatusOK, gin.H{"message": "Contact deleted"})
}

func (h *ClientHandler) GetProjects(c *gin.Context) {
	id, _ := getID(c)
	var projects []models.Project
	h.db.Where("client_id = ?", id).Find(&projects)
	c.JSON(http.StatusOK, gin.H{"data": projects})
}

func (h *ClientHandler) GetInvoices(c *gin.Context) {
	id, _ := getID(c)
	var invoices []models.Invoice
	h.db.Where("client_id = ?", id).Find(&invoices)
	c.JSON(http.StatusOK, gin.H{"data": invoices})
}

// ─── PROJECT ─────────────────────────────────────────

type ProjectHandler struct{ db *gorm.DB }

func NewProjectHandler(db *gorm.DB) *ProjectHandler { return &ProjectHandler{db: db} }

func (h *ProjectHandler) List(c *gin.Context) {
	var q PaginationQuery
	c.ShouldBindQuery(&q)
	var projects []models.Project
	var total int64
	query := h.db.Model(&models.Project{}).Preload("Client").Preload("Labels")
	if q.Q != "" {
		query = query.Where("title ILIKE ?", "%"+q.Q+"%")
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	query.Count(&total)
	query.Scopes(paginate(q)).Find(&projects)
	c.JSON(http.StatusOK, gin.H{"data": projects, "total": total})
}

func (h *ProjectHandler) Create(c *gin.Context) {
	var project models.Project
	if err := c.ShouldBindJSON(&project); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Create(&project)
	recordAudit(h.db, c, "create", "project", project.ID, project.Title)
	c.JSON(http.StatusCreated, project)
}

func (h *ProjectHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var project models.Project
	if err := h.db.Preload("Client").Preload("Tasks").Preload("Labels").Preload("Members").First(&project, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"})
		return
	}
	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var project models.Project
	if err := h.db.First(&project, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	c.ShouldBindJSON(&project)
	h.db.Save(&project)
	recordAudit(h.db, c, "update", "project", project.ID, project.Title)
	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	var project models.Project
	h.db.First(&project, id)
	h.db.Delete(&models.Project{}, id)
	recordAudit(h.db, c, "delete", "project", id, project.Title)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *ProjectHandler) GetTasks(c *gin.Context) {
	id, _ := getID(c)
	var tasks []models.Task
	h.db.Preload("AssignedTo").Where("project_id = ?", id).Find(&tasks)
	c.JSON(http.StatusOK, gin.H{"data": tasks})
}

func (h *ProjectHandler) GetTimeline(c *gin.Context) {
	id, _ := getID(c)
	var tasks []models.Task
	h.db.Where("project_id = ?", id).Order("updated_at desc").Limit(20).Find(&tasks)
	c.JSON(http.StatusOK, gin.H{"data": tasks})
}

// ─── TASK ────────────────────────────────────────────

type TaskHandler struct{ db *gorm.DB }

func NewTaskHandler(db *gorm.DB) *TaskHandler { return &TaskHandler{db: db} }

func isValidTaskStatus(status string) bool {
	switch status {
	case "todo", "in_progress", "done", "expired":
		return true
	default:
		return false
	}
}

type taskPayload struct {
	Title          string          `json:"title"`
	ProjectID      *uint           `json:"project_id"`
	AssignedToID   *uint           `json:"assigned_to_id"`
	KanbanColumnID *uint           `json:"kanban_column_id"`
	StartDate      models.FlexTime `json:"start_date"`
	Deadline       models.FlexTime `json:"deadline"`
	Status         string          `json:"status"`
	Milestone      string          `json:"milestone"`
	Description    string          `json:"description"`
	Priority       string          `json:"priority"`
}

type taskKanbanColumnPayload struct {
	Title  string `json:"title"`
	Status string `json:"status"`
}

type reorderTaskKanbanColumnsPayload struct {
	ColumnIDs []uint `json:"column_ids"`
}

type moveTaskKanbanPayload struct {
	DestinationColumnID uint `json:"destination_column_id"`
	DestinationIndex    int  `json:"destination_index"`
}

var errTaskKanbanColumnHasTasks = errors.New("move tasks to another kanban column first before deleting it")

func taskDefaultColumnTitle(status string) string {
	switch status {
	case "in_progress":
		return "In Progress"
	case "done":
		return "Done"
	case "expired":
		return "Expired"
	default:
		return "To Do"
	}
}

func normalizeTaskStatus(status string) string {
	if status == "" {
		return "todo"
	}
	if isValidTaskStatus(status) {
		return status
	}
	return ""
}

func clampIndex(index, length int) int {
	if index < 0 {
		return 0
	}
	if index > length {
		return length
	}
	return index
}

func (h *TaskHandler) getDefaultTaskKanbanColumn(tx *gorm.DB, status string) (*models.TaskKanbanColumn, error) {
	var column models.TaskKanbanColumn
	err := tx.Where("status = ?", status).Order("position asc, id asc").First(&column).Error
	if err == nil {
		return &column, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	var maxPosition int
	if err := tx.Model(&models.TaskKanbanColumn{}).Select("COALESCE(MAX(position), 0)").Scan(&maxPosition).Error; err != nil {
		return nil, err
	}

	column = models.TaskKanbanColumn{
		Title:    taskDefaultColumnTitle(status),
		Status:   status,
		Position: maxPosition + 1,
	}
	if err := tx.Create(&column).Error; err != nil {
		return nil, err
	}
	return &column, nil
}

func (h *TaskHandler) resolveTaskKanbanColumn(tx *gorm.DB, status string, columnID *uint) (*models.TaskKanbanColumn, error) {
	normalizedStatus := normalizeTaskStatus(status)
	if normalizedStatus == "" {
		return nil, fmt.Errorf("invalid task status")
	}

	if columnID != nil && *columnID > 0 {
		var column models.TaskKanbanColumn
		if err := tx.First(&column, *columnID).Error; err != nil {
			return nil, err
		}
		if column.Status != normalizedStatus {
			return nil, fmt.Errorf("kanban column status mismatch")
		}
		return &column, nil
	}

	return h.getDefaultTaskKanbanColumn(tx, normalizedStatus)
}

func (h *TaskHandler) nextTaskKanbanPosition(tx *gorm.DB, columnID uint) (int, error) {
	var maxPosition int
	if err := tx.Model(&models.Task{}).
		Where("kanban_column_id = ?", columnID).
		Select("COALESCE(MAX(kanban_position), 0)").
		Scan(&maxPosition).Error; err != nil {
		return 0, err
	}
	return maxPosition + 1, nil
}

func (h *TaskHandler) fetchColumnTasks(tx *gorm.DB, columnID uint) ([]models.Task, error) {
	var tasks []models.Task
	err := tx.
		Where("kanban_column_id = ?", columnID).
		Order("kanban_position asc, updated_at desc, id asc").
		Find(&tasks).Error
	return tasks, err
}

func removeTaskFromColumn(tasks []models.Task, taskID uint) ([]models.Task, *models.Task) {
	next := make([]models.Task, 0, len(tasks))
	var moved *models.Task

	for _, task := range tasks {
		if task.ID == taskID {
			taskCopy := task
			moved = &taskCopy
			continue
		}
		next = append(next, task)
	}

	return next, moved
}

func insertTaskIntoColumn(tasks []models.Task, index int, task models.Task) []models.Task {
	clampedIndex := clampIndex(index, len(tasks))
	next := make([]models.Task, 0, len(tasks)+1)
	next = append(next, tasks[:clampedIndex]...)
	next = append(next, task)
	next = append(next, tasks[clampedIndex:]...)
	return next
}

func (h *TaskHandler) resequenceTaskColumn(tx *gorm.DB, column models.TaskKanbanColumn, tasks []models.Task) error {
	for index, task := range tasks {
		if err := tx.Model(&models.Task{}).
			Where("id = ?", task.ID).
			Updates(map[string]interface{}{
				"kanban_column_id": column.ID,
				"kanban_position":  index + 1,
				"status":           column.Status,
			}).Error; err != nil {
			return err
		}
	}
	return nil
}

func (h *TaskHandler) loadTaskWithRelations(tx *gorm.DB, id uint) (models.Task, error) {
	var task models.Task
	err := tx.Preload("AssignedTo").Preload("Project").Preload("Labels").Preload("KanbanColumn").First(&task, id).Error
	return task, err
}

func (h *TaskHandler) resequenceKanbanColumns(tx *gorm.DB, orderedIDs []uint) error {
	for index, id := range orderedIDs {
		if err := tx.Model(&models.TaskKanbanColumn{}).
			Where("id = ?", id).
			Update("position", index+1).Error; err != nil {
			return err
		}
	}
	return nil
}

func (h *TaskHandler) ListColumns(c *gin.Context) {
	var columns []models.TaskKanbanColumn
	if err := h.db.Order("position asc, id asc").Find(&columns).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": columns})
}

func (h *TaskHandler) CreateColumn(c *gin.Context) {
	var req taskKanbanColumnPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
		return
	}
	if !isValidTaskStatus(req.Status) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task status"})
		return
	}

	var column models.TaskKanbanColumn
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		var maxPosition int
		if err := tx.Model(&models.TaskKanbanColumn{}).Select("COALESCE(MAX(position), 0)").Scan(&maxPosition).Error; err != nil {
			return err
		}

		column = models.TaskKanbanColumn{
			Title:    req.Title,
			Status:   req.Status,
			Position: maxPosition + 1,
		}
		return tx.Create(&column).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	recordAudit(h.db, c, "create", "task_kanban_column", column.ID, column.Title)
	c.JSON(http.StatusCreated, gin.H{"data": column})
}

func (h *TaskHandler) UpdateColumn(c *gin.Context) {
	id, err := getID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid column id"})
		return
	}

	var req taskKanbanColumnPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
		return
	}
	if req.Status != "" && !isValidTaskStatus(req.Status) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task status"})
		return
	}

	var column models.TaskKanbanColumn
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&column, id).Error; err != nil {
			return err
		}

		previousStatus := column.Status
		column.Title = req.Title
		if req.Status != "" {
			column.Status = req.Status
		}

		if err := tx.Save(&column).Error; err != nil {
			return err
		}

		if previousStatus != column.Status {
			if err := tx.Model(&models.Task{}).
				Where("kanban_column_id = ?", column.ID).
				Update("status", column.Status).Error; err != nil {
				return err
			}
		}

		return nil
	}); err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Column not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	recordAudit(h.db, c, "update", "task_kanban_column", column.ID, column.Title)
	c.JSON(http.StatusOK, gin.H{"data": column})
}

func (h *TaskHandler) ReorderColumns(c *gin.Context) {
	var req reorderTaskKanbanColumnsPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.ColumnIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Column order is required"})
		return
	}

	seen := make(map[uint]struct{}, len(req.ColumnIDs))
	for _, id := range req.ColumnIDs {
		if id == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid column id"})
			return
		}
		if _, exists := seen[id]; exists {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Duplicate column id in reorder request"})
			return
		}
		seen[id] = struct{}{}
	}

	var columns []models.TaskKanbanColumn
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		var total int64
		if err := tx.Model(&models.TaskKanbanColumn{}).Count(&total).Error; err != nil {
			return err
		}
		if int64(len(req.ColumnIDs)) != total {
			return fmt.Errorf("all kanban columns must be included in reorder request")
		}
		if err := tx.Where("id IN ?", req.ColumnIDs).Find(&columns).Error; err != nil {
			return err
		}
		if len(columns) != len(req.ColumnIDs) {
			return gorm.ErrRecordNotFound
		}
		if err := h.resequenceKanbanColumns(tx, req.ColumnIDs); err != nil {
			return err
		}
		return tx.Order("position asc, id asc").Find(&columns).Error
	}); err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Column not found"})
			return
		}
		if strings.Contains(err.Error(), "all kanban columns must be included") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	recordAudit(h.db, c, "reorder", "task_kanban_column", 0, "Task kanban columns")
	c.JSON(http.StatusOK, gin.H{"data": columns})
}

func (h *TaskHandler) DeleteColumn(c *gin.Context) {
	id, err := getID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid column id"})
		return
	}

	var column models.TaskKanbanColumn
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&column, id).Error; err != nil {
			return err
		}

		var taskCount int64
		if err := tx.Model(&models.Task{}).Where("kanban_column_id = ?", column.ID).Count(&taskCount).Error; err != nil {
			return err
		}
		if taskCount > 0 {
			return errTaskKanbanColumnHasTasks
		}

		if err := tx.Delete(&models.TaskKanbanColumn{}, column.ID).Error; err != nil {
			return err
		}

		var remainingColumns []models.TaskKanbanColumn
		if err := tx.Order("position asc, id asc").Find(&remainingColumns).Error; err != nil {
			return err
		}

		orderedIDs := make([]uint, 0, len(remainingColumns))
		for _, remainingColumn := range remainingColumns {
			orderedIDs = append(orderedIDs, remainingColumn.ID)
		}

		return h.resequenceKanbanColumns(tx, orderedIDs)
	}); err != nil {
		switch err {
		case gorm.ErrRecordNotFound:
			c.JSON(http.StatusNotFound, gin.H{"error": "Column not found"})
			return
		case errTaskKanbanColumnHasTasks:
			c.JSON(http.StatusConflict, gin.H{"error": "This kanban column still has tasks. Move them to another kanban column first."})
			return
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	recordAudit(h.db, c, "delete", "task_kanban_column", column.ID, column.Title)
	c.JSON(http.StatusOK, gin.H{"message": "Column deleted"})
}

func (h *TaskHandler) List(c *gin.Context) {
	var q PaginationQuery
	c.ShouldBindQuery(&q)
	var tasks []models.Task
	var total int64
	query := h.db.Model(&models.Task{}).
		Preload("AssignedTo").
		Preload("Project").
		Preload("Labels").
		Preload("KanbanColumn")
	if q.Q != "" {
		query = query.Where("title ILIKE ?", "%"+q.Q+"%")
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if projectID := c.Query("project_id"); projectID != "" {
		query = query.Where("project_id = ?", projectID)
	}
	if assignedTo := c.Query("assigned_to_id"); assignedTo != "" {
		query = query.Where("assigned_to_id = ?", assignedTo)
	}
	query.Count(&total)
	result := query
	if strings.EqualFold(c.Query("fetch_all"), "true") {
		result = result.Order("kanban_column_id asc nulls last, kanban_position asc, updated_at desc, id desc")
	} else {
		result = result.Order("updated_at desc, id desc")
		result = result.Scopes(paginate(q))
	}
	result.Find(&tasks)
	c.JSON(http.StatusOK, gin.H{"data": tasks, "total": total})
}

func (h *TaskHandler) Create(c *gin.Context) {
	var req taskPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
		return
	}

	status := normalizeTaskStatus(req.Status)
	if status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task status"})
		return
	}

	if req.Priority == "" {
		req.Priority = "medium"
	}

	var task models.Task
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		column, err := h.resolveTaskKanbanColumn(tx, status, req.KanbanColumnID)
		if err != nil {
			return err
		}

		position, err := h.nextTaskKanbanPosition(tx, column.ID)
		if err != nil {
			return err
		}

		task = models.Task{
			Title:          req.Title,
			ProjectID:      req.ProjectID,
			AssignedToID:   req.AssignedToID,
			KanbanColumnID: &column.ID,
			KanbanPosition: position,
			StartDate:      req.StartDate,
			Deadline:       req.Deadline,
			Status:         column.Status,
			Milestone:      req.Milestone,
			Description:    req.Description,
			Priority:       req.Priority,
		}
		if err := tx.Create(&task).Error; err != nil {
			return err
		}

		task, err = h.loadTaskWithRelations(tx, task.ID)
		return err
	}); err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid kanban column"})
			return
		}
		if strings.Contains(err.Error(), "invalid task status") || strings.Contains(err.Error(), "mismatch") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	recordAudit(h.db, c, "create", "task", task.ID, task.Title)
	c.JSON(http.StatusCreated, task)
}

func (h *TaskHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var task models.Task
	if err := h.db.Preload("AssignedTo").Preload("Project").Preload("Collaborators").Preload("KanbanColumn").First(&task, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}
	c.JSON(http.StatusOK, task)
}

func (h *TaskHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	if err := h.db.First(&models.Task{}, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}

	var req taskPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
		return
	}

	status := normalizeTaskStatus(req.Status)
	if status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task status"})
		return
	}

	if req.Priority == "" {
		req.Priority = "medium"
	}

	var task models.Task
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&task, id).Error; err != nil {
			return err
		}

		previousColumnID := task.KanbanColumnID
		column, err := h.resolveTaskKanbanColumn(tx, status, req.KanbanColumnID)
		if err != nil {
			return err
		}

		task.Title = req.Title
		task.ProjectID = req.ProjectID
		task.AssignedToID = req.AssignedToID
		task.StartDate = req.StartDate
		task.Deadline = req.Deadline
		task.Milestone = req.Milestone
		task.Description = req.Description
		task.Priority = req.Priority
		task.Status = column.Status

		if previousColumnID == nil || *previousColumnID != column.ID {
			position, err := h.nextTaskKanbanPosition(tx, column.ID)
			if err != nil {
				return err
			}
			task.KanbanColumnID = &column.ID
			task.KanbanPosition = position
		}

		if err := tx.Save(&task).Error; err != nil {
			return err
		}

		if previousColumnID != nil && (task.KanbanColumnID == nil || *previousColumnID != *task.KanbanColumnID) {
			previousColumnTasks, err := h.fetchColumnTasks(tx, *previousColumnID)
			if err != nil {
				return err
			}
			var previousColumn models.TaskKanbanColumn
			if err := tx.First(&previousColumn, *previousColumnID).Error; err != nil {
				return err
			}
			if err := h.resequenceTaskColumn(tx, previousColumn, previousColumnTasks); err != nil {
				return err
			}
		}

		task, err = h.loadTaskWithRelations(tx, task.ID)
		return err
	}); err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid kanban column"})
			return
		}
		if strings.Contains(err.Error(), "invalid task status") || strings.Contains(err.Error(), "mismatch") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	recordAudit(h.db, c, "update", "task", task.ID, task.Title)
	c.JSON(http.StatusOK, task)
}

func (h *TaskHandler) UpdateStatus(c *gin.Context) {
	id, err := getID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task id"})
		return
	}

	var task models.Task
	if err := h.db.First(&task, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !isValidTaskStatus(req.Status) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task status"})
		return
	}

	if err := h.db.Transaction(func(tx *gorm.DB) error {
		previousColumnID := task.KanbanColumnID
		targetColumn, err := h.getDefaultTaskKanbanColumn(tx, req.Status)
		if err != nil {
			return err
		}

		if previousColumnID == nil || *previousColumnID != targetColumn.ID {
			position, err := h.nextTaskKanbanPosition(tx, targetColumn.ID)
			if err != nil {
				return err
			}
			task.KanbanColumnID = &targetColumn.ID
			task.KanbanPosition = position
		}

		task.Status = targetColumn.Status
		if err := tx.Save(&task).Error; err != nil {
			return err
		}

		if previousColumnID != nil && *previousColumnID != targetColumn.ID {
			var previousColumn models.TaskKanbanColumn
			if err := tx.First(&previousColumn, *previousColumnID).Error; err != nil {
				return err
			}
			previousTasks, err := h.fetchColumnTasks(tx, *previousColumnID)
			if err != nil {
				return err
			}
			if err := h.resequenceTaskColumn(tx, previousColumn, previousTasks); err != nil {
				return err
			}
		}

		task, err = h.loadTaskWithRelations(tx, id)
		return err
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	recordAudit(h.db, c, "update_status", "task", task.ID, task.Title)
	c.JSON(http.StatusOK, gin.H{"message": "Status updated", "data": task})
}

func (h *TaskHandler) MoveKanbanTask(c *gin.Context) {
	id, err := getID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task id"})
		return
	}

	var req moveTaskKanbanPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.DestinationColumnID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Destination column is required"})
		return
	}

	var task models.Task
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&task, id).Error; err != nil {
			return err
		}

		var destinationColumn models.TaskKanbanColumn
		if err := tx.First(&destinationColumn, req.DestinationColumnID).Error; err != nil {
			return err
		}

		var sourceColumn *models.TaskKanbanColumn
		if task.KanbanColumnID != nil {
			var existingSource models.TaskKanbanColumn
			if err := tx.First(&existingSource, *task.KanbanColumnID).Error; err == nil {
				sourceColumn = &existingSource
			}
		}
		if sourceColumn == nil {
			sourceColumn, err = h.getDefaultTaskKanbanColumn(tx, task.Status)
			if err != nil {
				return err
			}
		}

		sourceTasks, err := h.fetchColumnTasks(tx, sourceColumn.ID)
		if err != nil {
			return err
		}
		sourceTasks, movedTask := removeTaskFromColumn(sourceTasks, task.ID)
		if movedTask == nil {
			taskCopy := task
			movedTask = &taskCopy
		}

		if sourceColumn.ID == destinationColumn.ID {
			nextTasks := insertTaskIntoColumn(sourceTasks, req.DestinationIndex, *movedTask)
			if err := h.resequenceTaskColumn(tx, destinationColumn, nextTasks); err != nil {
				return err
			}
		} else {
			destinationTasks, err := h.fetchColumnTasks(tx, destinationColumn.ID)
			if err != nil {
				return err
			}
			destinationTasks, _ = removeTaskFromColumn(destinationTasks, task.ID)
			nextDestinationTasks := insertTaskIntoColumn(destinationTasks, req.DestinationIndex, *movedTask)

			if err := h.resequenceTaskColumn(tx, *sourceColumn, sourceTasks); err != nil {
				return err
			}
			if err := h.resequenceTaskColumn(tx, destinationColumn, nextDestinationTasks); err != nil {
				return err
			}
		}

		task, err = h.loadTaskWithRelations(tx, id)
		return err
	}); err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task or column not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	recordAudit(h.db, c, "move", "task", task.ID, task.Title)
	c.JSON(http.StatusOK, gin.H{"message": "Task moved", "data": task})
}

func (h *TaskHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	var task models.Task
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&task, id).Error; err != nil {
			return err
		}

		previousColumnID := task.KanbanColumnID
		if err := tx.Delete(&models.Task{}, id).Error; err != nil {
			return err
		}

		if previousColumnID != nil {
			var column models.TaskKanbanColumn
			if err := tx.First(&column, *previousColumnID).Error; err == nil {
				tasks, err := h.fetchColumnTasks(tx, *previousColumnID)
				if err != nil {
					return err
				}
				if err := h.resequenceTaskColumn(tx, column, tasks); err != nil {
					return err
				}
			}
		}

		return nil
	}); err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	recordAudit(h.db, c, "delete", "task", id, task.Title)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ─── LEAD ────────────────────────────────────────────

type LeadHandler struct{ db *gorm.DB }

func NewLeadHandler(db *gorm.DB) *LeadHandler { return &LeadHandler{db: db} }

func (h *LeadHandler) List(c *gin.Context) {
	var q PaginationQuery
	c.ShouldBindQuery(&q)
	var leads []models.Lead
	var total int64
	query := h.db.Model(&models.Lead{}).Preload("Owner").Preload("Labels")
	if q.Q != "" {
		query = query.Where("name ILIKE ?", "%"+q.Q+"%")
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	query.Count(&total)
	query.Scopes(paginate(q)).Order("id desc").Find(&leads)
	c.JSON(http.StatusOK, gin.H{"data": leads, "total": total})
}

func (h *LeadHandler) Create(c *gin.Context) {
	var lead models.Lead
	if err := c.ShouldBindJSON(&lead); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	lead.OwnerID = getUserID(c)
	h.db.Create(&lead)
	recordAudit(h.db, c, "create", "lead", lead.ID, lead.Name)
	c.JSON(http.StatusCreated, lead)
}

func (h *LeadHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var lead models.Lead
	if err := h.db.Preload("Owner").First(&lead, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	c.JSON(http.StatusOK, lead)
}

func (h *LeadHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var lead models.Lead
	if err := h.db.First(&lead, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	c.ShouldBindJSON(&lead)
	h.db.Save(&lead)
	recordAudit(h.db, c, "update", "lead", lead.ID, lead.Name)
	c.JSON(http.StatusOK, lead)
}

func (h *LeadHandler) UpdateStatus(c *gin.Context) {
	id, _ := getID(c)
	var req struct {
		Status string `json:"status"`
	}
	c.ShouldBindJSON(&req)
	h.db.Model(&models.Lead{}).Where("id = ?", id).Update("status", req.Status)
	c.JSON(http.StatusOK, gin.H{"message": "Status updated"})
}

func (h *LeadHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	var lead models.Lead
	h.db.First(&lead, id)
	h.db.Delete(&models.Lead{}, id)
	recordAudit(h.db, c, "delete", "lead", id, lead.Name)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *LeadHandler) ConvertToClient(c *gin.Context) {
	id, _ := getID(c)
	var lead models.Lead
	if err := h.db.First(&lead, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lead not found"})
		return
	}
	client := models.Client{
		Name:    lead.Name,
		Email:   lead.Email,
		Phone:   lead.Phone,
		OwnerID: getUserID(c),
	}
	if err := h.db.Create(&client).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.db.Model(&lead).Update("status", "won")
	recordAudit(h.db, c, "convert", "lead", lead.ID, lead.Name+" → Client")
	c.JSON(http.StatusCreated, client)
}

// ─── INVOICE ─────────────────────────────────────────

type InvoiceHandler struct{ db *gorm.DB }

func NewInvoiceHandler(db *gorm.DB) *InvoiceHandler { return &InvoiceHandler{db: db} }

func (h *InvoiceHandler) applyInvoiceTotals(invoice *models.Invoice, subtotal, paidAmount float64) {
	if subtotal < 0 {
		subtotal = 0
	}
	if paidAmount < 0 {
		paidAmount = 0
	}

	totalAmount := subtotal + invoice.TaxAmount - invoice.DiscountAmount
	if totalAmount < 0 {
		totalAmount = 0
	}

	dueAmount := totalAmount - paidAmount
	if dueAmount < 0 {
		dueAmount = 0
	}

	invoice.SubtotalAmount = subtotal
	invoice.TotalAmount = totalAmount
	invoice.PaidAmount = paidAmount
	invoice.DueAmount = dueAmount

	if invoice.Status == "draft" && paidAmount == 0 {
		return
	}

	switch {
	case paidAmount > 0 && dueAmount == 0:
		invoice.Status = "fully_paid"
	case paidAmount > 0:
		invoice.Status = "partially_paid"
	case !invoice.DueDate.IsZero() && invoice.DueDate.Time.Before(time.Now()):
		invoice.Status = "overdue"
	default:
		invoice.Status = "not_paid"
	}
}

func (h *InvoiceHandler) hydrateInvoiceSubtotal(invoice *models.Invoice) {
	if len(invoice.Items) > 0 {
		var subtotal float64
		for _, item := range invoice.Items {
			subtotal += item.Total
		}
		invoice.SubtotalAmount = subtotal
		return
	}

	subtotal := invoice.TotalAmount - invoice.TaxAmount + invoice.DiscountAmount
	if subtotal < 0 {
		subtotal = 0
	}
	invoice.SubtotalAmount = subtotal
}

func (h *InvoiceHandler) List(c *gin.Context) {
	var q PaginationQuery
	c.ShouldBindQuery(&q)
	var invoices []models.Invoice
	var total int64
	query := h.db.Model(&models.Invoice{}).Preload("Client").Preload("Project").Preload("Labels")
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if q.Q != "" {
		query = query.Joins("LEFT JOIN clients ON clients.id = invoices.client_id").
			Where("invoices.invoice_number ILIKE ? OR clients.name ILIKE ?", "%"+q.Q+"%", "%"+q.Q+"%")
	}
	query.Count(&total)
	query.Scopes(paginate(q)).Order("invoices.id desc").Find(&invoices)
	for i := range invoices {
		h.hydrateInvoiceSubtotal(&invoices[i])
	}
	c.JSON(http.StatusOK, gin.H{"data": invoices, "total": total})
}

func (h *InvoiceHandler) Create(c *gin.Context) {
	var invoice models.Invoice
	if err := c.ShouldBindJSON(&invoice); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	subtotal := invoice.SubtotalAmount
	if subtotal == 0 {
		subtotal = invoice.TotalAmount - invoice.TaxAmount + invoice.DiscountAmount
	}
	h.applyInvoiceTotals(&invoice, subtotal, invoice.PaidAmount)
	h.db.Create(&invoice)
	recordAudit(h.db, c, "create", "invoice", invoice.ID, invoice.InvoiceNumber)
	c.JSON(http.StatusCreated, invoice)
}

func (h *InvoiceHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var invoice models.Invoice
	if err := h.db.Preload("Client").Preload("Project").Preload("Items").Preload("Payments").First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	h.hydrateInvoiceSubtotal(&invoice)
	c.JSON(http.StatusOK, invoice)
}

func (h *InvoiceHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var invoice models.Invoice
	if err := h.db.First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	if err := c.ShouldBindJSON(&invoice); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var itemTotals struct {
		Count    int64
		Subtotal float64
	}
	h.db.Model(&models.InvoiceItem{}).
		Where("invoice_id = ?", id).
		Select("COUNT(*) as count, COALESCE(SUM(total), 0) as subtotal").
		Scan(&itemTotals)

	var paymentTotals struct {
		Count int64
		Total float64
	}
	h.db.Model(&models.Payment{}).
		Where("invoice_id = ?", id).
		Select("COUNT(*) as count, COALESCE(SUM(amount), 0) as total").
		Scan(&paymentTotals)

	subtotal := invoice.SubtotalAmount
	if itemTotals.Count > 0 {
		subtotal = itemTotals.Subtotal
	} else if subtotal == 0 {
		subtotal = invoice.TotalAmount - invoice.TaxAmount + invoice.DiscountAmount
	}

	paidAmount := invoice.PaidAmount
	if paymentTotals.Count > 0 {
		paidAmount = paymentTotals.Total
	}

	h.applyInvoiceTotals(&invoice, subtotal, paidAmount)
	h.db.Save(&invoice)
	recordAudit(h.db, c, "update", "invoice", invoice.ID, invoice.InvoiceNumber)
	c.JSON(http.StatusOK, invoice)
}

func (h *InvoiceHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	var invoice models.Invoice
	h.db.First(&invoice, id)
	h.db.Delete(&models.Invoice{}, id)
	recordAudit(h.db, c, "delete", "invoice", id, invoice.InvoiceNumber)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *InvoiceHandler) ExportPDF(c *gin.Context) {
	id, _ := getID(c)
	var invoice models.Invoice
	if err := h.db.Preload("Client").Preload("Project").Preload("Items").Preload("Payments").First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	h.hydrateInvoiceSubtotal(&invoice)

	tmpl := template.Must(template.New("invoice").Funcs(template.FuncMap{
		"formatCurrency": func(amount float64, currency string) string {
			return fmt.Sprintf("%s %.2f", currency, amount)
		},
		"formatDate": func(t models.FlexTime) string {
			if t.IsZero() {
				return "-"
			}
			return t.Format("02 January 2006")
		},
	}).Parse(invoicePDFTemplate))

	c.Header("Content-Type", "text/html; charset=utf-8")
	data := struct {
		models.Invoice
		PrintedAt string
	}{
		Invoice:   invoice,
		PrintedAt: time.Now().Format("02 January 2006 15:04"),
	}
	tmpl.Execute(c.Writer, data)
}

const invoicePDFTemplate = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<title>Invoice {{.InvoiceNumber}}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #2563eb; padding-bottom: 24px; }
  .company { font-size: 24px; font-weight: 700; color: #2563eb; }
  .invoice-title { text-align: right; }
  .invoice-title h1 { font-size: 32px; font-weight: 800; color: #2563eb; letter-spacing: 2px; }
  .invoice-title p { color: #64748b; margin-top: 4px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
  .meta-box h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; }
  .meta-box p { font-size: 13px; line-height: 1.6; }
  .status { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .status-draft { background: #f1f5f9; color: #64748b; }
  .status-not_paid { background: #fef3c7; color: #92400e; }
  .status-partially_paid { background: #dbeafe; color: #1e40af; }
  .status-fully_paid { background: #dcfce7; color: #166534; }
  .status-overdue { background: #fee2e2; color: #991b1b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  thead th { background: #2563eb; color: #fff; padding: 10px 12px; text-align: left; font-size: 12px; }
  thead th:last-child { text-align: right; }
  tbody td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
  tbody td:last-child { text-align: right; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
  .totals table { width: 300px; }
  .totals td { padding: 6px 12px; }
  .totals .label { color: #64748b; }
  .totals .total-row td { font-weight: 700; font-size: 15px; border-top: 2px solid #2563eb; padding-top: 10px; color: #2563eb; }
  .payments h3 { font-size: 13px; font-weight: 600; margin-bottom: 10px; color: #374151; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="header">
  <div class="company">CBQA / OneTool</div>
  <div class="invoice-title">
    <h1>INVOICE</h1>
    <p>{{.InvoiceNumber}}</p>
    <p style="margin-top:8px"><span class="status status-{{.Status}}">{{.Status}}</span></p>
  </div>
</div>

<div class="meta">
  <div class="meta-box">
    <h3>Tagihan Kepada</h3>
    {{if .Client}}
    <p style="font-weight:600;font-size:15px">{{.Client.Name}}</p>
    <p>{{.Client.Email}}</p>
    <p>{{.Client.Phone}}</p>
    <p>{{.Client.Address}}</p>
    {{end}}
  </div>
  <div class="meta-box" style="text-align:right">
    <h3>Detail Invoice</h3>
    <p>Tanggal: <strong>{{formatDate .BillDate}}</strong></p>
    <p>Jatuh Tempo: <strong>{{formatDate .DueDate}}</strong></p>
    {{if .Project}}<p>Proyek: <strong>{{.Project.Title}}</strong></p>{{end}}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:50%">Deskripsi</th>
      <th style="width:15%;text-align:right">Qty</th>
      <th style="width:20%;text-align:right">Harga Satuan</th>
      <th style="width:15%">Total</th>
    </tr>
  </thead>
  <tbody>
    {{range .Items}}
    <tr>
      <td>{{.Description}}</td>
      <td style="text-align:right">{{.Quantity}}</td>
      <td style="text-align:right">{{formatCurrency .UnitPrice $.Currency}}</td>
      <td>{{formatCurrency .Total $.Currency}}</td>
    </tr>
    {{end}}
  </tbody>
</table>

<div class="totals">
  <table>
    <tr><td class="label">Subtotal</td><td style="text-align:right">{{formatCurrency .SubtotalAmount .Currency}}</td></tr>
    {{if .TaxAmount}}<tr><td class="label">Pajak</td><td style="text-align:right">{{formatCurrency .TaxAmount .Currency}}</td></tr>{{end}}
    {{if .DiscountAmount}}<tr><td class="label">Diskon</td><td style="text-align:right">-{{formatCurrency .DiscountAmount .Currency}}</td></tr>{{end}}
    <tr class="total-row"><td>Total</td><td style="text-align:right">{{formatCurrency .TotalAmount .Currency}}</td></tr>
    <tr><td class="label">Dibayar</td><td style="text-align:right">{{formatCurrency .PaidAmount .Currency}}</td></tr>
    <tr><td class="label" style="font-weight:600">Sisa Tagihan</td><td style="text-align:right;font-weight:600;color:#dc2626">{{formatCurrency .DueAmount .Currency}}</td></tr>
  </table>
</div>

{{if .Payments}}
<div class="payments">
  <h3>Riwayat Pembayaran</h3>
  <table>
    <thead><tr><th>Tanggal</th><th>Metode</th><th>Catatan</th><th>Jumlah</th></tr></thead>
    <tbody>
      {{range .Payments}}
      <tr>
        <td>{{formatDate .PaymentDate}}</td>
        <td>{{.PaymentMethod}}</td>
        <td>{{.Note}}</td>
        <td>{{formatCurrency .Amount $.Currency}}</td>
      </tr>
      {{end}}
    </tbody>
  </table>
</div>
{{end}}

{{if .Notes}}<div style="margin-top:24px;padding:16px;background:#f8fafc;border-radius:8px;"><strong>Catatan:</strong> {{.Notes}}</div>{{end}}

<div class="footer">
  <p>Dokumen ini digenerate otomatis oleh OneTool &bull; Dicetak pada: {{.PrintedAt}}</p>
</div>
<script>window.onload=function(){window.print()}</script>
</body>
</html>`

func (h *InvoiceHandler) AddPayment(c *gin.Context) {
	id, _ := getID(c)
	var payment models.Payment
	if err := c.ShouldBindJSON(&payment); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	payment.InvoiceID = id
	h.db.Create(&payment)
	h.recalcInvoice(id)
	c.JSON(http.StatusCreated, payment)
}

func (h *InvoiceHandler) AddItem(c *gin.Context) {
	id, _ := getID(c)
	var item models.InvoiceItem
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item.InvoiceID = id
	item.Total = item.Quantity * item.UnitPrice
	h.db.Create(&item)
	h.recalcInvoice(id)
	c.JSON(http.StatusCreated, item)
}

func (h *InvoiceHandler) UpdateItem(c *gin.Context) {
	invoiceID, _ := getID(c)
	itemID, _ := strconv.ParseUint(c.Param("itemId"), 10, 64)
	var item models.InvoiceItem
	if err := h.db.Where("id = ? AND invoice_id = ?", itemID, invoiceID).First(&item).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	c.ShouldBindJSON(&item)
	item.Total = item.Quantity * item.UnitPrice
	h.db.Save(&item)
	h.recalcInvoice(invoiceID)
	c.JSON(http.StatusOK, item)
}

func (h *InvoiceHandler) DeleteItem(c *gin.Context) {
	invoiceID, _ := getID(c)
	itemID, _ := strconv.ParseUint(c.Param("itemId"), 10, 64)
	h.db.Where("id = ? AND invoice_id = ?", itemID, invoiceID).Delete(&models.InvoiceItem{})
	h.recalcInvoice(invoiceID)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *InvoiceHandler) DeletePayment(c *gin.Context) {
	invoiceID, _ := getID(c)
	paymentID, _ := strconv.ParseUint(c.Param("paymentId"), 10, 64)
	var payment models.Payment
	if err := h.db.Where("id = ? AND invoice_id = ?", paymentID, invoiceID).First(&payment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	h.db.Delete(&payment)
	h.recalcInvoice(invoiceID)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *InvoiceHandler) recalcInvoice(invoiceID uint) {
	var invoice models.Invoice
	h.db.First(&invoice, invoiceID)
	var subtotal float64
	h.db.Model(&models.InvoiceItem{}).Where("invoice_id = ?", invoiceID).Select("COALESCE(SUM(total), 0)").Scan(&subtotal)
	var paidAmount float64
	h.db.Model(&models.Payment{}).Where("invoice_id = ?", invoiceID).Select("COALESCE(SUM(amount), 0)").Scan(&paidAmount)
	h.applyInvoiceTotals(&invoice, subtotal, paidAmount)
	h.db.Save(&invoice)
}

func (h *InvoiceHandler) Summary(c *gin.Context) {
	var summary []struct {
		ClientName      string  `json:"client_name"`
		Count           int     `json:"count"`
		InvoiceTotal    float64 `json:"invoice_total"`
		PaymentReceived float64 `json:"payment_received"`
		Due             float64 `json:"due"`
	}
	h.db.Table("invoices i").
		Select("c.name as client_name, COUNT(i.id) as count, SUM(i.total_amount) as invoice_total, SUM(i.paid_amount) as payment_received, SUM(i.due_amount) as due").
		Joins("JOIN clients c ON c.id = i.client_id").
		Where("i.deleted_at IS NULL").
		Group("c.name").
		Scan(&summary)
	c.JSON(http.StatusOK, gin.H{"data": summary})
}

// ─── PAYMENT ─────────────────────────────────────────

type PaymentHandler struct{ db *gorm.DB }

func NewPaymentHandler(db *gorm.DB) *PaymentHandler { return &PaymentHandler{db: db} }

func (h *PaymentHandler) List(c *gin.Context) {
	var payments []models.Payment
	var total int64
	q := c.Query("q")
	query := h.db.Preload("Invoice.Client").Order("payment_date desc")
	needsInvoiceJoin := c.Query("client_id") != "" || q != ""
	if needsInvoiceJoin {
		query = query.Joins("JOIN invoices ON invoices.id = payments.invoice_id")
	}
	if clientID := c.Query("client_id"); clientID != "" {
		query = query.Where("invoices.client_id = ?", clientID)
	}
	if q != "" {
		query = query.Joins("LEFT JOIN clients ON clients.id = invoices.client_id").
			Where("invoices.invoice_number ILIKE ? OR clients.name ILIKE ? OR payments.payment_method ILIKE ? OR payments.note ILIKE ?",
				"%"+q+"%", "%"+q+"%", "%"+q+"%", "%"+q+"%")
	}
	query.Find(&payments)
	total = int64(len(payments))
	c.JSON(http.StatusOK, gin.H{"data": payments, "total": total})
}

func (h *PaymentHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var payment models.Payment
	if err := h.db.Preload("Invoice").First(&payment, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	c.JSON(http.StatusOK, payment)
}

// ─── CONTRACT ────────────────────────────────────────

type ContractHandler struct{ db *gorm.DB }

func NewContractHandler(db *gorm.DB) *ContractHandler { return &ContractHandler{db: db} }

func (h *ContractHandler) List(c *gin.Context) {
	var contracts []models.Contract
	var total int64
	query := h.db.Model(&models.Contract{}).Preload("Client").Preload("Project")
	if clientID := c.Query("client_id"); clientID != "" {
		query = query.Where("client_id = ?", clientID)
	}
	query.Count(&total)
	query.Find(&contracts)
	c.JSON(http.StatusOK, gin.H{"data": contracts, "total": total})
}

func (h *ContractHandler) Create(c *gin.Context) {
	var contract models.Contract
	if err := c.ShouldBindJSON(&contract); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Create(&contract)
	recordAudit(h.db, c, "create", "contract", contract.ID, contract.Title)
	c.JSON(http.StatusCreated, contract)
}

func (h *ContractHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var contract models.Contract
	if err := h.db.Preload("Client").Preload("Project").First(&contract, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	c.JSON(http.StatusOK, contract)
}

func (h *ContractHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var contract models.Contract
	h.db.First(&contract, id)
	c.ShouldBindJSON(&contract)
	h.db.Save(&contract)
	recordAudit(h.db, c, "update", "contract", contract.ID, contract.Title)
	c.JSON(http.StatusOK, contract)
}

func (h *ContractHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	var contract models.Contract
	h.db.First(&contract, id)
	h.db.Delete(&models.Contract{}, id)
	recordAudit(h.db, c, "delete", "contract", id, contract.Title)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ─── ITEM ────────────────────────────────────────────

type ItemHandler struct{ db *gorm.DB }

func NewItemHandler(db *gorm.DB) *ItemHandler { return &ItemHandler{db: db} }

func (h *ItemHandler) List(c *gin.Context) {
	var items []models.Item
	var total int64
	h.db.Model(&models.Item{}).Count(&total)
	h.db.Find(&items)
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *ItemHandler) Create(c *gin.Context) {
	var item models.Item
	if err := c.ShouldBindJSON(&item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Create(&item)
	c.JSON(http.StatusCreated, item)
}

func (h *ItemHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var item models.Item
	h.db.First(&item, id)
	c.ShouldBindJSON(&item)
	h.db.Save(&item)
	c.JSON(http.StatusOK, item)
}

func (h *ItemHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	h.db.Delete(&models.Item{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ─── ORDER ───────────────────────────────────────────

type OrderHandler struct{ db *gorm.DB }

func NewOrderHandler(db *gorm.DB) *OrderHandler { return &OrderHandler{db: db} }

func (h *OrderHandler) List(c *gin.Context) {
	var orders []models.Order
	var total int64
	query := h.db.Model(&models.Order{}).Preload("Client")
	if clientID := c.Query("client_id"); clientID != "" {
		query = query.Where("client_id = ?", clientID)
	}
	query.Count(&total)
	query.Find(&orders)
	c.JSON(http.StatusOK, gin.H{"data": orders, "total": total})
}

func (h *OrderHandler) Create(c *gin.Context) {
	var order models.Order
	if err := c.ShouldBindJSON(&order); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Create(&order)
	c.JSON(http.StatusCreated, order)
}

func (h *OrderHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var order models.Order
	h.db.Preload("Client").First(&order, id)
	c.JSON(http.StatusOK, order)
}

func (h *OrderHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var order models.Order
	h.db.First(&order, id)
	c.ShouldBindJSON(&order)
	h.db.Save(&order)
	c.JSON(http.StatusOK, order)
}

func (h *OrderHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	var order models.Order
	if err := h.db.First(&order, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
		return
	}
	h.db.Delete(&order)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ─── EVENT ───────────────────────────────────────────

type EventHandler struct{ db *gorm.DB }

func NewEventHandler(db *gorm.DB) *EventHandler { return &EventHandler{db: db} }

func (h *EventHandler) List(c *gin.Context) {
	var events []models.Event
	query := h.db.Preload("Labels")
	if month := c.Query("month"); month != "" {
		query = query.Where("EXTRACT(MONTH FROM start_date) = ?", month)
	}
	if year := c.Query("year"); year != "" {
		query = query.Where("EXTRACT(YEAR FROM start_date) = ?", year)
	}
	query.Find(&events)
	c.JSON(http.StatusOK, gin.H{"data": events})
}

func (h *EventHandler) Create(c *gin.Context) {
	var event models.Event
	if err := c.ShouldBindJSON(&event); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	event.CreatedByID = getUserID(c)
	h.db.Create(&event)
	c.JSON(http.StatusCreated, event)
}

func (h *EventHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var event models.Event
	h.db.Preload("Labels").First(&event, id)
	c.JSON(http.StatusOK, event)
}

func (h *EventHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var event models.Event
	h.db.First(&event, id)
	c.ShouldBindJSON(&event)
	h.db.Save(&event)
	c.JSON(http.StatusOK, event)
}

func (h *EventHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	h.db.Delete(&models.Event{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ─── NOTE ────────────────────────────────────────────

type NoteHandler struct{ db *gorm.DB }

func NewNoteHandler(db *gorm.DB) *NoteHandler { return &NoteHandler{db: db} }

func (h *NoteHandler) List(c *gin.Context) {
	userID := getUserID(c)
	var notes []models.Note
	h.db.Where("user_id = ?", userID).Find(&notes)
	c.JSON(http.StatusOK, gin.H{"data": notes})
}

func (h *NoteHandler) Create(c *gin.Context) {
	var note models.Note
	if err := c.ShouldBindJSON(&note); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	note.UserID = getUserID(c)
	h.db.Create(&note)
	c.JSON(http.StatusCreated, note)
}

func (h *NoteHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var note models.Note
	h.db.First(&note, id)
	c.ShouldBindJSON(&note)
	h.db.Save(&note)
	c.JSON(http.StatusOK, note)
}

func (h *NoteHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	h.db.Delete(&models.Note{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ─── EXPENSE ─────────────────────────────────────────

type ExpenseHandler struct{ db *gorm.DB }

func NewExpenseHandler(db *gorm.DB) *ExpenseHandler { return &ExpenseHandler{db: db} }

func (h *ExpenseHandler) List(c *gin.Context) {
	userID := getUserID(c)
	var expenses []models.Expense
	var total int64
	recurring := c.Query("recurring") == "true"
	h.db.Model(&models.Expense{}).Where("user_id = ? AND is_recurring = ?", userID, recurring).Count(&total)
	h.db.Where("user_id = ? AND is_recurring = ?", userID, recurring).Order("date desc").Find(&expenses)
	c.JSON(http.StatusOK, gin.H{"data": expenses, "total": total})
}

func (h *ExpenseHandler) Create(c *gin.Context) {
	var expense models.Expense
	if err := c.ShouldBindJSON(&expense); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	expense.UserID = getUserID(c)
	expense.Total = expense.Amount + expense.Tax + expense.SecondTax
	h.db.Create(&expense)
	c.JSON(http.StatusCreated, expense)
}

func (h *ExpenseHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var expense models.Expense
	h.db.First(&expense, id)
	c.ShouldBindJSON(&expense)
	expense.Total = expense.Amount + expense.Tax + expense.SecondTax
	h.db.Save(&expense)
	c.JSON(http.StatusOK, expense)
}

func (h *ExpenseHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	h.db.Delete(&models.Expense{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ─── TEAM ────────────────────────────────────────────

type TeamHandler struct{ db *gorm.DB }

func NewTeamHandler(db *gorm.DB) *TeamHandler { return &TeamHandler{db: db} }

type optionalUint struct {
	Set   bool
	Value *uint
}

func (o *optionalUint) UnmarshalJSON(data []byte) error {
	o.Set = true
	raw := strings.TrimSpace(string(data))
	if raw == "" || raw == "null" {
		o.Value = nil
		return nil
	}

	var num uint
	if err := json.Unmarshal(data, &num); err == nil {
		o.Value = &num
		return nil
	}

	var str string
	if err := json.Unmarshal(data, &str); err == nil {
		str = strings.TrimSpace(str)
		if str == "" {
			o.Value = nil
			return nil
		}
		parsed, err := strconv.ParseUint(str, 10, 64)
		if err != nil {
			return fmt.Errorf("app_role_id must be a valid number")
		}
		value := uint(parsed)
		o.Value = &value
		return nil
	}

	return fmt.Errorf("app_role_id must be null or a valid number")
}

func (h *TeamHandler) appRoleExists(id *uint) bool {
	if id == nil {
		return true
	}
	var count int64
	h.db.Model(&models.AppRole{}).Where("id = ?", *id).Count(&count)
	return count > 0
}

func generateTemporaryPassword(length int) (string, error) {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%"
	password := make([]byte, length)
	for i := range password {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", err
		}
		password[i] = charset[n.Int64()]
	}
	return string(password), nil
}

func (h *TeamHandler) CreateMember(c *gin.Context) {
	var req struct {
		Name      string `json:"name" binding:"required"`
		Email     string `json:"email" binding:"required,email"`
		Password  string `json:"password" binding:"required,min=6"`
		JobTitle  string `json:"job_title"`
		Phone     string `json:"phone"`
		Role      string `json:"role" binding:"omitempty,oneof=admin member"`
		AppRoleID *uint  `json:"app_role_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.JobTitle = strings.TrimSpace(req.JobTitle)
	req.Phone = strings.TrimSpace(req.Phone)
	role := "member"
	if req.Role == "admin" {
		role = "admin"
		req.AppRoleID = nil
	}
	if !h.appRoleExists(req.AppRoleID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Selected app role was not found"})
		return
	}

	var count int64
	h.db.Model(&models.User{}).Where("email = ?", req.Email).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user := models.User{
		Name:      req.Name,
		Email:     req.Email,
		Password:  string(hashed),
		JobTitle:  req.JobTitle,
		Phone:     req.Phone,
		Role:      role,
		AppRoleID: req.AppRoleID,
		IsActive:  true,
	}
	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"user":        userPayload(user),
		"permissions": resolvePermissions(h.db, user),
	})
}

func (h *TeamHandler) ListMembers(c *gin.Context) {
	hasPage := c.Query("page") != ""
	hasLimit := c.Query("limit") != ""

	var q struct {
		PaginationQuery
		Status          string `form:"status"`
		IncludeInactive bool   `form:"include_inactive"`
	}
	c.ShouldBindQuery(&q)
	if hasPage && q.Page <= 0 {
		q.Page = 1
	}
	if hasLimit && q.Limit <= 0 {
		q.Limit = 10
	}

	var members []models.User
	var total int64
	query := h.db.Model(&models.User{})

	switch {
	case q.Status == "all" || q.IncludeInactive:
	case q.Status == "inactive" || c.Query("inactive") == "true":
		query = query.Where("is_active = ?", false)
	default:
		query = query.Where("is_active = ?", true)
	}

	if search := strings.TrimSpace(q.Q); search != "" {
		like := "%" + search + "%"
		query = query.Where("name ILIKE ? OR email ILIKE ? OR job_title ILIKE ?", like, like, like)
	}

	query.Count(&total)
	query = query.Order("name asc")
	if hasLimit || hasPage {
		if q.Page <= 0 {
			q.Page = 1
		}
		if q.Limit <= 0 {
			q.Limit = 10
		}
		query = query.Scopes(paginate(q.PaginationQuery))
	}
	query.Find(&members)
	c.JSON(http.StatusOK, gin.H{"data": members, "total": total, "page": q.Page, "limit": q.Limit})
}

func (h *TeamHandler) GetMember(c *gin.Context) {
	id, _ := getID(c)
	var member models.User
	if err := h.db.First(&member, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, member)
}

func (h *TeamHandler) UpdateMember(c *gin.Context) {
	id, _ := getID(c)
	var member models.User
	if err := h.db.First(&member, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var req struct {
		Name      *string      `json:"name"`
		Email     *string      `json:"email" binding:"omitempty,email"`
		JobTitle  *string      `json:"job_title"`
		Phone     *string      `json:"phone"`
		Role      *string      `json:"role" binding:"omitempty,oneof=admin member"`
		AppRoleID optionalUint `json:"app_role_id"`
		IsActive  *bool        `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}

	if req.Name != nil {
		name := strings.TrimSpace(*req.Name)
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Name is required"})
			return
		}
		updates["name"] = name
	}

	if req.Email != nil {
		email := strings.ToLower(strings.TrimSpace(*req.Email))
		if email == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Email is required"})
			return
		}
		var count int64
		h.db.Model(&models.User{}).Where("id <> ? AND email = ?", member.ID, email).Count(&count)
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
			return
		}
		updates["email"] = email
	}

	if req.JobTitle != nil {
		updates["job_title"] = strings.TrimSpace(*req.JobTitle)
	}
	if req.Phone != nil {
		updates["phone"] = strings.TrimSpace(*req.Phone)
	}

	nextRole := member.Role
	if req.Role != nil {
		nextRole = strings.TrimSpace(*req.Role)
		updates["role"] = nextRole
		if nextRole == "admin" {
			updates["app_role_id"] = nil
		}
	}

	if req.AppRoleID.Set && nextRole != "admin" {
		if !h.appRoleExists(req.AppRoleID.Value) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Selected app role was not found"})
			return
		}
		updates["app_role_id"] = req.AppRoleID.Value
	}

	if req.IsActive != nil {
		if member.ID == getUserID(c) && !*req.IsActive {
			c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot deactivate your own account"})
			return
		}
		updates["is_active"] = *req.IsActive
	}

	if len(updates) == 0 {
		c.JSON(http.StatusOK, gin.H{"user": userPayload(member), "permissions": resolvePermissions(h.db, member)})
		return
	}

	if err := h.db.Model(&member).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}
	h.db.First(&member, id)
	recordAudit(h.db, c, "update", "user", member.ID, member.Name)
	c.JSON(http.StatusOK, gin.H{"user": userPayload(member), "permissions": resolvePermissions(h.db, member)})
}

func (h *TeamHandler) UpdateMemberStatus(c *gin.Context) {
	id, _ := getID(c)
	var member models.User
	if err := h.db.First(&member, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var req struct {
		IsActive *bool `json:"is_active" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if member.ID == getUserID(c) && !*req.IsActive {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot deactivate your own account"})
		return
	}
	if err := h.db.Model(&member).Update("is_active", *req.IsActive).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user status"})
		return
	}
	member.IsActive = *req.IsActive
	recordAudit(h.db, c, "update_status", "user", member.ID, member.Name)
	c.JSON(http.StatusOK, gin.H{"user": userPayload(member), "permissions": resolvePermissions(h.db, member)})
}

func (h *TeamHandler) DeleteMember(c *gin.Context) {
	id, _ := getID(c)
	var member models.User
	if err := h.db.First(&member, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	h.db.Model(&member).Update("is_active", false)
	c.JSON(http.StatusOK, gin.H{"message": "User deactivated"})
}

func (h *TeamHandler) ResetPassword(c *gin.Context) {
	id, _ := getID(c)
	var member models.User
	if err := h.db.First(&member, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var req struct {
		Password string `json:"password" binding:"omitempty,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	password := strings.TrimSpace(req.Password)
	if password == "" {
		var err error
		password, err = generateTemporaryPassword(12)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate temporary password"})
			return
		}
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}
	if err := h.db.Model(&models.User{}).Where("id = ?", id).Update("password", string(hashed)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset password"})
		return
	}
	recordAudit(h.db, c, "reset_password", "user", member.ID, member.Name)
	c.JSON(http.StatusOK, gin.H{
		"message":            "Password reset successfully",
		"temp_password":      password,
		"temporary_password": password,
	})
}

func (h *TeamHandler) ListTimeCards(c *gin.Context) {
	var cards []models.TimeCard
	h.db.Preload("User").Order("in_date desc").Find(&cards)
	c.JSON(http.StatusOK, gin.H{"data": cards})
}

func (h *TeamHandler) ClockIn(c *gin.Context) {
	userID := getUserID(c)
	var existing models.TimeCard
	// Check if already clocked in
	if err := h.db.Where("user_id = ? AND out_time IS NULL", userID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Already clocked in"})
		return
	}
	now := time.Now()
	card := models.TimeCard{UserID: userID, InTime: now, InDate: now}
	h.db.Create(&card)
	h.db.Model(&models.User{}).Where("id = ?", userID).Update("clocked_in", true)
	c.JSON(http.StatusCreated, card)
}

func (h *TeamHandler) ClockOut(c *gin.Context) {
	userID := getUserID(c)
	var card models.TimeCard
	if err := h.db.Where("user_id = ? AND out_time IS NULL", userID).First(&card).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active clock-in found"})
		return
	}
	now := time.Now()
	duration := now.Sub(card.InTime).Hours()
	h.db.Model(&card).Updates(map[string]interface{}{
		"out_time": now,
		"out_date": now,
		"duration": duration,
	})
	h.db.Model(&models.User{}).Where("id = ?", userID).Update("clocked_in", false)
	c.JSON(http.StatusOK, gin.H{"message": "Clocked out"})
}

func (h *TeamHandler) ListLeaves(c *gin.Context) {
	userID := getUserID(c)
	var leaves []models.Leave
	h.db.Where("user_id = ?", userID).Order("start_date desc").Find(&leaves)
	c.JSON(http.StatusOK, gin.H{"data": leaves})
}

func (h *TeamHandler) ApplyLeave(c *gin.Context) {
	var leave models.Leave
	if err := c.ShouldBindJSON(&leave); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	leave.UserID = getUserID(c)
	leave.Status = "pending"
	h.db.Create(&leave)
	c.JSON(http.StatusCreated, leave)
}

func (h *TeamHandler) UpdateLeaveStatus(c *gin.Context) {
	id, _ := getID(c)
	var req struct {
		Status string `json:"status"`
	}
	c.ShouldBindJSON(&req)
	h.db.Model(&models.Leave{}).Where("id = ?", id).Update("status", req.Status)
	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func (h *TeamHandler) ListAnnouncements(c *gin.Context) {
	var announcements []models.Announcement
	h.db.Preload("CreatedBy").Order("created_at desc").Find(&announcements)
	c.JSON(http.StatusOK, gin.H{"data": announcements})
}

func (h *TeamHandler) CreateAnnouncement(c *gin.Context) {
	var ann models.Announcement
	if err := c.ShouldBindJSON(&ann); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ann.CreatedByID = getUserID(c)
	h.db.Create(&ann)
	c.JSON(http.StatusCreated, ann)
}

// ─── FILE ────────────────────────────────────────────

type FileHandler struct {
	db        *gorm.DB
	uploadDir string
}

func NewFileHandler(db *gorm.DB, uploadDir string) *FileHandler {
	os.MkdirAll(uploadDir, 0755)
	return &FileHandler{db: db, uploadDir: uploadDir}
}

func (h *FileHandler) List(c *gin.Context) {
	userID := getUserID(c)
	var files []models.File
	folderID := c.Query("folder_id")
	query := h.db.Where("owner_id = ?", userID)
	if folderID == "" {
		query = query.Where("folder_id IS NULL")
	} else {
		query = query.Where("folder_id = ?", folderID)
	}
	query.Find(&files)
	c.JSON(http.StatusOK, gin.H{"data": files})
}

func (h *FileHandler) Upload(c *gin.Context) {
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
		return
	}
	defer file.Close()

	// Simpan ke subdirektori YYYY/MM
	subDir := time.Now().Format("2006/01")
	dir := filepath.Join(h.uploadDir, subDir)
	if err := os.MkdirAll(dir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload dir"})
		return
	}

	// Nama file unik: timestamp + nama asli
	uniqueName := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(header.Filename))
	relPath := filepath.Join(subDir, uniqueName)
	fullPath := filepath.Join(h.uploadDir, relPath)

	dst, err := os.Create(fullPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}
	defer dst.Close()
	if _, err = io.Copy(dst, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write file"})
		return
	}

	f := models.File{
		Name:     header.Filename,
		Path:     relPath,
		URL:      "/api/v1/files/download/" + fmt.Sprintf("%d", 0), // diupdate setelah create
		Size:     header.Size,
		MimeType: header.Header.Get("Content-Type"),
		OwnerID:  getUserID(c),
	}
	if folderID := strings.TrimSpace(c.PostForm("folder_id")); folderID != "" {
		if parsed, err := strconv.ParseUint(folderID, 10, 64); err == nil {
			id := uint(parsed)
			f.FolderID = &id
		}
	}
	h.db.Create(&f)
	// Update URL dengan ID yang sudah ada
	h.db.Model(&f).Update("url", fmt.Sprintf("/api/v1/files/%d/download", f.ID))
	c.JSON(http.StatusCreated, f)
}

func (h *FileHandler) Download(c *gin.Context) {
	id, _ := getID(c)
	userID := getUserID(c)
	var f models.File
	if err := h.db.First(&f, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}
	if f.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	if f.IsFolder || f.Path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Not a downloadable file"})
		return
	}
	fullPath := filepath.Join(h.uploadDir, f.Path)
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, f.Name))
	c.File(fullPath)
}

func (h *FileHandler) CreateFolder(c *gin.Context) {
	var folder models.File
	if err := c.ShouldBindJSON(&folder); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	folder.IsFolder = true
	folder.OwnerID = getUserID(c)
	h.db.Create(&folder)
	c.JSON(http.StatusCreated, folder)
}

func (h *FileHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	h.db.Delete(&models.File{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *FileHandler) ToggleFavorite(c *gin.Context) {
	id, _ := getID(c)
	var f models.File
	h.db.First(&f, id)
	h.db.Model(&f).Update("is_favorite", !f.IsFavorite)
	c.JSON(http.StatusOK, gin.H{"is_favorite": !f.IsFavorite})
}

// ─── TODO ────────────────────────────────────────────

type TodoHandler struct{ db *gorm.DB }

func NewTodoHandler(db *gorm.DB) *TodoHandler { return &TodoHandler{db: db} }

func (h *TodoHandler) List(c *gin.Context) {
	userID := getUserID(c)
	done := c.Query("done") == "true"
	var todos []models.Todo
	h.db.Where("user_id = ? AND done = ?", userID, done).Order("created_at desc").Find(&todos)
	c.JSON(http.StatusOK, gin.H{"data": todos})
}

func (h *TodoHandler) Create(c *gin.Context) {
	var todo models.Todo
	if err := c.ShouldBindJSON(&todo); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	todo.UserID = getUserID(c)
	h.db.Create(&todo)
	c.JSON(http.StatusCreated, todo)
}

func (h *TodoHandler) MarkDone(c *gin.Context) {
	id, _ := getID(c)
	h.db.Model(&models.Todo{}).Where("id = ?", id).Updates(map[string]interface{}{"done": true, "done_at": gorm.Expr("NOW()")})
	c.JSON(http.StatusOK, gin.H{"message": "Marked as done"})
}

func (h *TodoHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	h.db.Delete(&models.Todo{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ─── REPORT ──────────────────────────────────────────

type ReportHandler struct{ db *gorm.DB }

func NewReportHandler(db *gorm.DB) *ReportHandler { return &ReportHandler{db: db} }

func (h *ReportHandler) InvoicesSummary(c *gin.Context) {
	year := c.Query("year")
	var summary []struct {
		ClientName      string  `json:"client_name"`
		Count           int     `json:"count"`
		InvoiceTotal    float64 `json:"invoice_total"`
		TaxAmount       float64 `json:"tax_amount"`
		PaymentReceived float64 `json:"payment_received"`
		Due             float64 `json:"due"`
	}
	query := h.db.Table("invoices i").
		Select("c.name as client_name, COUNT(i.id) as count, SUM(i.total_amount) as invoice_total, SUM(i.tax_amount) as tax_amount, SUM(i.paid_amount) as payment_received, SUM(i.due_amount) as due").
		Joins("JOIN clients c ON c.id = i.client_id").
		Where("i.deleted_at IS NULL")
	if year != "" {
		query = query.Where("EXTRACT(YEAR FROM i.bill_date) = ?", year)
	}
	query.Group("c.name").Order("invoice_total desc").Scan(&summary)
	c.JSON(http.StatusOK, gin.H{"data": summary})
}

func (h *ReportHandler) ProjectsSummary(c *gin.Context) {
	var summary struct {
		Open      int64 `json:"open"`
		Completed int64 `json:"completed"`
		Hold      int64 `json:"hold"`
		Cancelled int64 `json:"cancelled"`
	}
	h.db.Model(&models.Project{}).Where("status = 'open'").Count(&summary.Open)
	h.db.Model(&models.Project{}).Where("status = 'completed'").Count(&summary.Completed)
	h.db.Model(&models.Project{}).Where("status = 'hold'").Count(&summary.Hold)
	h.db.Model(&models.Project{}).Where("status = 'cancelled'").Count(&summary.Cancelled)
	c.JSON(http.StatusOK, summary)
}

func (h *ReportHandler) LeadsSummary(c *gin.Context) {
	var summary []struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	h.db.Model(&models.Lead{}).Select("status, COUNT(*) as count").Group("status").Scan(&summary)
	c.JSON(http.StatusOK, gin.H{"data": summary})
}

func (h *ReportHandler) ExpensesSummary(c *gin.Context) {
	var total float64
	h.db.Model(&models.Expense{}).Select("COALESCE(SUM(total), 0)").Scan(&total)
	c.JSON(http.StatusOK, gin.H{"total": total})
}

// ─── LABEL ───────────────────────────────────────────

type LabelHandler struct{ db *gorm.DB }

func NewLabelHandler(db *gorm.DB) *LabelHandler { return &LabelHandler{db: db} }

func (h *LabelHandler) List(c *gin.Context) {
	var labels []models.Label
	h.db.Find(&labels)
	c.JSON(http.StatusOK, gin.H{"data": labels})
}

func (h *LabelHandler) Create(c *gin.Context) {
	var label models.Label
	if err := c.ShouldBindJSON(&label); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Create(&label)
	c.JSON(http.StatusCreated, label)
}

func (h *LabelHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	h.db.Delete(&models.Label{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ─── APP ROLE ────────────────────────────────────────

type AppRoleHandler struct{ db *gorm.DB }

func NewAppRoleHandler(db *gorm.DB) *AppRoleHandler { return &AppRoleHandler{db: db} }

func (h *AppRoleHandler) List(c *gin.Context) {
	var roles []models.AppRole
	h.db.Preload("Permissions").Find(&roles)
	c.JSON(http.StatusOK, gin.H{"data": roles})
}

func (h *AppRoleHandler) Create(c *gin.Context) {
	var role models.AppRole
	if err := c.ShouldBindJSON(&role); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.db.Create(&role).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Role name already exists"})
		return
	}
	c.JSON(http.StatusCreated, role)
}

func (h *AppRoleHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var role models.AppRole
	if err := h.db.Preload("Permissions").First(&role, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
		return
	}
	c.JSON(http.StatusOK, role)
}

func (h *AppRoleHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var role models.AppRole
	if err := h.db.First(&role, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
		return
	}
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	c.ShouldBindJSON(&req)
	if req.Name != "" {
		role.Name = req.Name
	}
	role.Description = req.Description
	h.db.Save(&role)
	c.JSON(http.StatusOK, role)
}

func (h *AppRoleHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	var count int64
	h.db.Model(&models.User{}).Where("app_role_id = ?", id).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Role masih digunakan oleh %d user", count)})
		return
	}
	h.db.Delete(&models.AppRole{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *AppRoleHandler) SetPermissions(c *gin.Context) {
	id, _ := getID(c)
	var role models.AppRole
	if err := h.db.First(&role, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"})
		return
	}
	var permissions []models.RolePermission
	if err := c.ShouldBindJSON(&permissions); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Replace all permissions for this role
	h.db.Where("app_role_id = ?", id).Delete(&models.RolePermission{})
	for i := range permissions {
		permissions[i].AppRoleID = id
		permissions[i].ID = 0
	}
	if len(permissions) > 0 {
		h.db.Create(&permissions)
	}
	h.db.Preload("Permissions").First(&role, id)
	c.JSON(http.StatusOK, role)
}

// ─── AUDIT LOG ───────────────────────────────────────

type AuditLogHandler struct{ db *gorm.DB }

func NewAuditLogHandler(db *gorm.DB) *AuditLogHandler { return &AuditLogHandler{db: db} }

func (h *AuditLogHandler) List(c *gin.Context) {
	var logs []models.AuditLog
	var total int64
	query := h.db.Model(&models.AuditLog{}).Preload("User")

	if entityType := c.Query("entity_type"); entityType != "" {
		query = query.Where("entity_type = ?", entityType)
	}
	if userID := c.Query("user_id"); userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if action := c.Query("action"); action != "" {
		query = query.Where("action = ?", action)
	}
	if from := c.Query("from"); from != "" {
		query = query.Where("created_at >= ?", from)
	}
	if to := c.Query("to"); to != "" {
		query = query.Where("created_at <= ?", to+" 23:59:59")
	}

	query.Count(&total)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset := (page - 1) * limit
	query.Order("created_at desc").Offset(offset).Limit(limit).Find(&logs)
	c.JSON(http.StatusOK, gin.H{"data": logs, "total": total, "page": page, "limit": limit})
}

// ─── REPORT EXPORT ───────────────────────────────────

func (h *ReportHandler) ExportCSV(c *gin.Context) {
	reportType := c.DefaultQuery("type", "invoices")
	year := c.Query("year")

	filename := fmt.Sprintf("laporan_%s_%s.csv", reportType, time.Now().Format("2006-01-02"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Writer.Write([]byte("\xEF\xBB\xBF")) // UTF-8 BOM agar Excel baca karakter benar

	w := csv.NewWriter(c.Writer)
	defer w.Flush()

	switch reportType {
	case "invoices":
		type row struct {
			ClientName      string
			Count           int
			InvoiceTotal    float64
			TaxAmount       float64
			PaymentReceived float64
			Due             float64
		}
		var data []row
		q := h.db.Table("invoices i").
			Select("c.name as client_name, COUNT(i.id) as count, SUM(i.total_amount) as invoice_total, SUM(i.tax_amount) as tax_amount, SUM(i.paid_amount) as payment_received, SUM(i.due_amount) as due").
			Joins("JOIN clients c ON c.id = i.client_id").
			Where("i.deleted_at IS NULL")
		if year != "" {
			q = q.Where("EXTRACT(YEAR FROM i.bill_date) = ?", year)
		}
		q.Group("c.name").Order("invoice_total desc").Scan(&data)
		w.Write([]string{"Klien", "Jumlah Invoice", "Total Invoice", "Pajak", "Dibayar", "Sisa Tagihan"})
		for _, r := range data {
			w.Write([]string{r.ClientName, strconv.Itoa(r.Count), fmt.Sprintf("%.2f", r.InvoiceTotal), fmt.Sprintf("%.2f", r.TaxAmount), fmt.Sprintf("%.2f", r.PaymentReceived), fmt.Sprintf("%.2f", r.Due)})
		}

	case "expenses":
		var expenses []models.Expense
		q := h.db.Preload("User")
		if year != "" {
			q = q.Where("EXTRACT(YEAR FROM date) = ?", year)
		}
		q.Order("date desc").Find(&expenses)
		w.Write([]string{"Tanggal", "Kategori", "Judul", "Jumlah", "Pajak", "Total", "User"})
		for _, e := range expenses {
			userName := ""
			if e.User != nil {
				userName = e.User.Name
			}
			w.Write([]string{e.Date.Format("2006-01-02"), e.Category, e.Title, fmt.Sprintf("%.2f", e.Amount), fmt.Sprintf("%.2f", e.Tax), fmt.Sprintf("%.2f", e.Total), userName})
		}

	case "leads":
		var leads []models.Lead
		h.db.Preload("Owner").Find(&leads)
		w.Write([]string{"Nama", "Kontak", "Email", "Status", "Sumber", "Owner", "Tanggal Dibuat"})
		for _, l := range leads {
			ownerName := ""
			if l.Owner != nil {
				ownerName = l.Owner.Name
			}
			w.Write([]string{l.Name, l.PrimaryContact, l.Email, l.Status, l.Source, ownerName, l.CreatedAt.Format("2006-01-02")})
		}

	case "projects":
		var projects []models.Project
		h.db.Preload("Client").Find(&projects)
		w.Write([]string{"Proyek", "Klien", "Status", "Progress", "Mulai", "Deadline", "Nilai"})
		for _, p := range projects {
			clientName := ""
			if p.Client != nil {
				clientName = p.Client.Name
			}
			w.Write([]string{p.Title, clientName, p.Status, strconv.Itoa(p.Progress) + "%", p.StartDate.Format("2006-01-02"), p.Deadline.Format("2006-01-02"), fmt.Sprintf("%.2f", p.Price)})
		}

	case "timecards":
		var cards []models.TimeCard
		q := h.db.Preload("User")
		if year != "" {
			q = q.Where("EXTRACT(YEAR FROM in_date) = ?", year)
		}
		q.Order("in_date desc").Find(&cards)
		w.Write([]string{"Nama", "Tanggal", "Jam Masuk", "Jam Keluar", "Durasi (jam)"})
		for _, tc := range cards {
			userName := ""
			if tc.User != nil {
				userName = tc.User.Name
			}
			outTime := "-"
			if tc.OutTime != nil {
				outTime = tc.OutTime.Format("15:04")
			}
			w.Write([]string{userName, tc.InDate.Format("2006-01-02"), tc.InTime.Format("15:04"), outTime, fmt.Sprintf("%.2f", tc.Duration)})
		}

	default:
		w.Write([]string{"error", "tipe laporan tidak dikenal: " + reportType})
		w.Write([]string{"tersedia", strings.Join([]string{"invoices", "expenses", "leads", "projects", "timecards"}, ", ")})
	}
}
