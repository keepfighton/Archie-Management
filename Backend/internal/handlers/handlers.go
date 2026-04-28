package handlers

import (
	"encoding/csv"
	"fmt"
	"html/template"
	"io"
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

func (h *DashboardHandler) GetStats(c *gin.Context) {
	userID := getUserID(c)
	var stats struct {
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
	today := time.Now().Format("2006-01-02")
	h.db.Model(&models.Task{}).Where("assigned_to_id = ? AND status != 'done'", userID).Count(&stats.OpenTasks)
	h.db.Model(&models.Project{}).Where("status = 'open'").Count(&stats.OpenProjects)
	h.db.Model(&models.Project{}).Where("status = 'completed'").Count(&stats.CompletedProjects)
	h.db.Model(&models.Project{}).Where("status = 'hold'").Count(&stats.HoldProjects)
	h.db.Model(&models.Client{}).Count(&stats.TotalClients)
	h.db.Model(&models.Lead{}).Count(&stats.TotalLeads)
	h.db.Model(&models.User{}).Where("is_active = true").Count(&stats.TotalMembers)
	h.db.Model(&models.Invoice{}).Select("COALESCE(SUM(due_amount),0)").Scan(&stats.DueAmount)
	h.db.Model(&models.Payment{}).Select("COALESCE(SUM(amount),0)").Scan(&stats.TotalIncome)
	h.db.Model(&models.Expense{}).Select("COALESCE(SUM(total),0)").Scan(&stats.TotalExpenses)
	h.db.Model(&models.Task{}).Where("status = 'todo'").Count(&stats.TasksTodo)
	h.db.Model(&models.Task{}).Where("status = 'in_progress'").Count(&stats.TasksInProgress)
	h.db.Model(&models.Task{}).Where("status = 'done'").Count(&stats.TasksDone)
	h.db.Model(&models.Task{}).Where("status = 'expired'").Count(&stats.TasksExpired)
	h.db.Model(&models.Invoice{}).Where("status = 'overdue'").Select("COALESCE(SUM(due_amount),0)").Scan(&stats.OverdueAmount)
	h.db.Model(&models.Invoice{}).Where("status = 'not_paid'").Select("COALESCE(SUM(total_amount),0)").Scan(&stats.NotPaidAmount)
	h.db.Model(&models.Invoice{}).Where("status = 'partially_paid'").Select("COALESCE(SUM(due_amount),0)").Scan(&stats.PartiallyPaidAmount)
	h.db.Model(&models.Invoice{}).Where("status = 'fully_paid'").Select("COALESCE(SUM(total_amount),0)").Scan(&stats.FullyPaidAmount)
	h.db.Model(&models.Invoice{}).Where("status = 'draft'").Select("COALESCE(SUM(total_amount),0)").Scan(&stats.DraftAmount)
	h.db.Model(&models.Invoice{}).Select("COALESCE(SUM(total_amount),0)").Scan(&stats.TotalInvoiced)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
	}
	if client.OwnerID == 0 {
		client.OwnerID = getUserID(c)
	}
	if err := h.db.Create(&client).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return
	}
	recordAudit(h.db, c, "create", "client", client.ID, client.Name)
	c.JSON(http.StatusCreated, client)
}

func (h *ClientHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var client models.Client
	if err := h.db.Preload("Owner").Preload("Contacts").Preload("Labels").First(&client, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Client not found"}); return
	}
	c.JSON(http.StatusOK, client)
}

func (h *ClientHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var client models.Client
	if err := h.db.First(&client, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Client not found"}); return
	}
	if err := c.ShouldBindJSON(&client); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
	}
	contact.ClientID = id
	h.db.Create(&contact)
	c.JSON(http.StatusCreated, contact)
}

func (h *ClientHandler) UpdateContact(c *gin.Context) {
	contactID, _ := strconv.ParseUint(c.Param("contactId"), 10, 64)
	var contact models.Contact
	if err := h.db.First(&contact, contactID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contact not found"}); return
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
	}
	h.db.Create(&project)
	recordAudit(h.db, c, "create", "project", project.ID, project.Title)
	c.JSON(http.StatusCreated, project)
}

func (h *ProjectHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var project models.Project
	if err := h.db.Preload("Client").Preload("Tasks").Preload("Labels").Preload("Members").First(&project, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project not found"}); return
	}
	c.JSON(http.StatusOK, project)
}

func (h *ProjectHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var project models.Project
	if err := h.db.First(&project, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"}); return
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

func (h *TaskHandler) List(c *gin.Context) {
	var q PaginationQuery
	c.ShouldBindQuery(&q)
	var tasks []models.Task
	var total int64
	query := h.db.Model(&models.Task{}).Preload("AssignedTo").Preload("Project").Preload("Labels")
	if q.Q != "" {
		query = query.Where("title ILIKE ?", "%"+q.Q+"%")
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if assignedTo := c.Query("assigned_to_id"); assignedTo != "" {
		query = query.Where("assigned_to_id = ?", assignedTo)
	}
	query.Count(&total)
	query.Scopes(paginate(q)).Order("id desc").Find(&tasks)
	c.JSON(http.StatusOK, gin.H{"data": tasks, "total": total})
}

func (h *TaskHandler) Create(c *gin.Context) {
	var task models.Task
	if err := c.ShouldBindJSON(&task); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
	}
	h.db.Create(&task)
	recordAudit(h.db, c, "create", "task", task.ID, task.Title)
	c.JSON(http.StatusCreated, task)
}

func (h *TaskHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var task models.Task
	if err := h.db.Preload("AssignedTo").Preload("Project").Preload("Collaborators").First(&task, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"}); return
	}
	c.JSON(http.StatusOK, task)
}

func (h *TaskHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var task models.Task
	if err := h.db.First(&task, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"}); return
	}
	c.ShouldBindJSON(&task)
	h.db.Save(&task)
	recordAudit(h.db, c, "update", "task", task.ID, task.Title)
	c.JSON(http.StatusOK, task)
}

func (h *TaskHandler) UpdateStatus(c *gin.Context) {
	id, _ := getID(c)
	var req struct{ Status string `json:"status"` }
	c.ShouldBindJSON(&req)
	h.db.Model(&models.Task{}).Where("id = ?", id).Update("status", req.Status)
	c.JSON(http.StatusOK, gin.H{"message": "Status updated"})
}

func (h *TaskHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	var task models.Task
	h.db.First(&task, id)
	h.db.Delete(&models.Task{}, id)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
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
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"}); return
	}
	c.JSON(http.StatusOK, lead)
}

func (h *LeadHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var lead models.Lead
	if err := h.db.First(&lead, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"}); return
	}
	c.ShouldBindJSON(&lead)
	h.db.Save(&lead)
	recordAudit(h.db, c, "update", "lead", lead.ID, lead.Name)
	c.JSON(http.StatusOK, lead)
}

func (h *LeadHandler) UpdateStatus(c *gin.Context) {
	id, _ := getID(c)
	var req struct{ Status string `json:"status"` }
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
		c.JSON(http.StatusNotFound, gin.H{"error": "Lead not found"}); return
	}
	client := models.Client{
		Name:    lead.Name,
		Email:   lead.Email,
		Phone:   lead.Phone,
		OwnerID: getUserID(c),
	}
	if err := h.db.Create(&client).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()}); return
	}
	h.db.Model(&lead).Update("status", "won")
	recordAudit(h.db, c, "convert", "lead", lead.ID, lead.Name+" → Client")
	c.JSON(http.StatusCreated, client)
}

// ─── INVOICE ─────────────────────────────────────────

type InvoiceHandler struct{ db *gorm.DB }

func NewInvoiceHandler(db *gorm.DB) *InvoiceHandler { return &InvoiceHandler{db: db} }

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
	c.JSON(http.StatusOK, gin.H{"data": invoices, "total": total})
}

func (h *InvoiceHandler) Create(c *gin.Context) {
	var invoice models.Invoice
	if err := c.ShouldBindJSON(&invoice); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
	}
	h.db.Create(&invoice)
	recordAudit(h.db, c, "create", "invoice", invoice.ID, invoice.InvoiceNumber)
	c.JSON(http.StatusCreated, invoice)
}

func (h *InvoiceHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var invoice models.Invoice
	if err := h.db.Preload("Client").Preload("Project").Preload("Items").Preload("Payments").First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"}); return
	}
	c.JSON(http.StatusOK, invoice)
}

func (h *InvoiceHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var invoice models.Invoice
	if err := h.db.First(&invoice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"}); return
	}
	c.ShouldBindJSON(&invoice)
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
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"}); return
	}

	tmpl := template.Must(template.New("invoice").Funcs(template.FuncMap{
		"formatCurrency": func(amount float64, currency string) string {
			return fmt.Sprintf("%s %.2f", currency, amount)
		},
		"formatDate": func(t models.FlexTime) string {
			if t.IsZero() { return "-" }
			return t.Format("02 January 2006")
		},
	}).Parse(invoicePDFTemplate))

	c.Header("Content-Type", "text/html; charset=utf-8")
	tmpl.Execute(c.Writer, invoice)
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
    <tr><td class="label">Subtotal</td><td style="text-align:right">{{formatCurrency .TotalAmount .Currency}}</td></tr>
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
  <p>Dokumen ini digenerate otomatis oleh OneTool &bull; Dicetak pada: ` + "`" + `{{.InvoiceNumber}}` + "`" + `</p>
</div>
<script>window.onload=function(){window.print()}</script>
</body>
</html>`

func (h *InvoiceHandler) AddPayment(c *gin.Context) {
	id, _ := getID(c)
	var payment models.Payment
	if err := c.ShouldBindJSON(&payment); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
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
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"}); return
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
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"}); return
	}
	h.db.Delete(&payment)
	h.recalcInvoice(invoiceID)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *InvoiceHandler) recalcInvoice(invoiceID uint) {
	var items []models.InvoiceItem
	h.db.Where("invoice_id = ?", invoiceID).Find(&items)
	var subtotal float64
	for _, it := range items {
		subtotal += it.Total
	}
	var paidAmount float64
	h.db.Model(&models.Payment{}).Where("invoice_id = ?", invoiceID).Select("COALESCE(SUM(amount), 0)").Scan(&paidAmount)
	var invoice models.Invoice
	h.db.First(&invoice, invoiceID)
	invoice.TotalAmount = subtotal + invoice.TaxAmount - invoice.DiscountAmount
	invoice.PaidAmount = paidAmount
	invoice.DueAmount = invoice.TotalAmount - invoice.PaidAmount
	if invoice.TotalAmount > 0 && invoice.PaidAmount >= invoice.TotalAmount {
		invoice.Status = "fully_paid"
	} else if invoice.PaidAmount > 0 {
		invoice.Status = "partially_paid"
	} else if invoice.Status != "draft" && !invoice.DueDate.IsZero() && invoice.DueDate.Time.Before(time.Now()) {
		invoice.Status = "overdue"
	}
	h.db.Save(&invoice)
}

func (h *InvoiceHandler) Summary(c *gin.Context) {
	var summary []struct {
		ClientName    string  `json:"client_name"`
		Count         int     `json:"count"`
		InvoiceTotal  float64 `json:"invoice_total"`
		PaymentReceived float64 `json:"payment_received"`
		Due           float64 `json:"due"`
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
	if q != "" {
		query = query.Joins("JOIN invoices ON invoices.id = payments.invoice_id").
			Joins("LEFT JOIN clients ON clients.id = invoices.client_id").
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
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"}); return
	}
	c.JSON(http.StatusOK, payment)
}

// ─── CONTRACT ────────────────────────────────────────

type ContractHandler struct{ db *gorm.DB }

func NewContractHandler(db *gorm.DB) *ContractHandler { return &ContractHandler{db: db} }

func (h *ContractHandler) List(c *gin.Context) {
	var contracts []models.Contract
	var total int64
	h.db.Model(&models.Contract{}).Count(&total)
	h.db.Preload("Client").Preload("Project").Find(&contracts)
	c.JSON(http.StatusOK, gin.H{"data": contracts, "total": total})
}

func (h *ContractHandler) Create(c *gin.Context) {
	var contract models.Contract
	if err := c.ShouldBindJSON(&contract); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
	}
	h.db.Create(&contract)
	recordAudit(h.db, c, "create", "contract", contract.ID, contract.Title)
	c.JSON(http.StatusCreated, contract)
}

func (h *ContractHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var contract models.Contract
	if err := h.db.Preload("Client").Preload("Project").First(&contract, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"}); return
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
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
	h.db.Model(&models.Order{}).Count(&total)
	h.db.Preload("Client").Find(&orders)
	c.JSON(http.StatusOK, gin.H{"data": orders, "total": total})
}

func (h *OrderHandler) Create(c *gin.Context) {
	var order models.Order
	if err := c.ShouldBindJSON(&order); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
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

func (h *TeamHandler) CreateMember(c *gin.Context) {
	var req struct {
		Name      string `json:"name" binding:"required"`
		Email     string `json:"email" binding:"required,email"`
		Password  string `json:"password" binding:"required,min=6"`
		JobTitle  string `json:"job_title"`
		Phone     string `json:"phone"`
		Role      string `json:"role"`
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
	var members []models.User
	var total int64
	active := c.Query("inactive") != "true"
	h.db.Model(&models.User{}).Where("is_active = ?", active).Count(&total)
	h.db.Where("is_active = ?", active).Order("name asc").Find(&members)
	c.JSON(http.StatusOK, gin.H{"data": members, "total": total})
}

func (h *TeamHandler) GetMember(c *gin.Context) {
	id, _ := getID(c)
	var member models.User
	h.db.First(&member, id)
	c.JSON(http.StatusOK, member)
}

func (h *TeamHandler) UpdateMember(c *gin.Context) {
	id, _ := getID(c)
	var member models.User
	h.db.First(&member, id)
	c.ShouldBindJSON(&member)
	h.db.Save(&member)
	c.JSON(http.StatusOK, member)
}

func (h *TeamHandler) DeleteMember(c *gin.Context) {
	id, _ := getID(c)
	var member models.User
	if err := h.db.First(&member, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"}); return
	}
	h.db.Model(&member).Update("is_active", false)
	c.JSON(http.StatusOK, gin.H{"message": "User deactivated"})
}

func (h *TeamHandler) ResetPassword(c *gin.Context) {
	id, _ := getID(c)
	var req struct {
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
	}
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"}); return
	}
	if err := h.db.Model(&models.User{}).Where("id = ?", id).Update("password", string(hashed)).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset password"}); return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully"})
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
		c.JSON(http.StatusConflict, gin.H{"error": "Already clocked in"}); return
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
		c.JSON(http.StatusNotFound, gin.H{"error": "No active clock-in found"}); return
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
	}
	leave.UserID = getUserID(c)
	leave.Status = "pending"
	h.db.Create(&leave)
	c.JSON(http.StatusCreated, leave)
}

func (h *TeamHandler) UpdateLeaveStatus(c *gin.Context) {
	id, _ := getID(c)
	var req struct{ Status string `json:"status"` }
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"}); return
	}
	defer file.Close()

	// Simpan ke subdirektori YYYY/MM
	subDir := time.Now().Format("2006/01")
	dir := filepath.Join(h.uploadDir, subDir)
	if err := os.MkdirAll(dir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload dir"}); return
	}

	// Nama file unik: timestamp + nama asli
	uniqueName := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(header.Filename))
	relPath := filepath.Join(subDir, uniqueName)
	fullPath := filepath.Join(h.uploadDir, relPath)

	dst, err := os.Create(fullPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"}); return
	}
	defer dst.Close()
	if _, err = io.Copy(dst, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write file"}); return
	}

	f := models.File{
		Name:     header.Filename,
		Path:     relPath,
		URL:      "/api/v1/files/download/" + fmt.Sprintf("%d", 0), // diupdate setelah create
		Size:     header.Size,
		MimeType: header.Header.Get("Content-Type"),
		OwnerID:  getUserID(c),
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
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"}); return
	}
	if f.OwnerID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"}); return
	}
	if f.IsFolder || f.Path == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Not a downloadable file"}); return
	}
	fullPath := filepath.Join(h.uploadDir, f.Path)
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, f.Name))
	c.File(fullPath)
}

func (h *FileHandler) CreateFolder(c *gin.Context) {
	var folder models.File
	if err := c.ShouldBindJSON(&folder); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
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
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
	}
	if err := h.db.Create(&role).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Role name already exists"}); return
	}
	c.JSON(http.StatusCreated, role)
}

func (h *AppRoleHandler) Get(c *gin.Context) {
	id, _ := getID(c)
	var role models.AppRole
	if err := h.db.Preload("Permissions").First(&role, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"}); return
	}
	c.JSON(http.StatusOK, role)
}

func (h *AppRoleHandler) Update(c *gin.Context) {
	id, _ := getID(c)
	var role models.AppRole
	if err := h.db.First(&role, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"}); return
	}
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	c.ShouldBindJSON(&req)
	if req.Name != "" { role.Name = req.Name }
	role.Description = req.Description
	h.db.Save(&role)
	c.JSON(http.StatusOK, role)
}

func (h *AppRoleHandler) Delete(c *gin.Context) {
	id, _ := getID(c)
	var count int64
	h.db.Model(&models.User{}).Where("app_role_id = ?", id).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("Role masih digunakan oleh %d user", count)}); return
	}
	h.db.Delete(&models.AppRole{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *AppRoleHandler) SetPermissions(c *gin.Context) {
	id, _ := getID(c)
	var role models.AppRole
	if err := h.db.First(&role, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Role not found"}); return
	}
	var permissions []models.RolePermission
	if err := c.ShouldBindJSON(&permissions); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()}); return
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
			if e.User != nil { userName = e.User.Name }
			w.Write([]string{e.Date.Format("2006-01-02"), e.Category, e.Title, fmt.Sprintf("%.2f", e.Amount), fmt.Sprintf("%.2f", e.Tax), fmt.Sprintf("%.2f", e.Total), userName})
		}

	case "leads":
		var leads []models.Lead
		h.db.Preload("Owner").Find(&leads)
		w.Write([]string{"Nama", "Kontak", "Email", "Status", "Sumber", "Owner", "Tanggal Dibuat"})
		for _, l := range leads {
			ownerName := ""
			if l.Owner != nil { ownerName = l.Owner.Name }
			w.Write([]string{l.Name, l.PrimaryContact, l.Email, l.Status, l.Source, ownerName, l.CreatedAt.Format("2006-01-02")})
		}

	case "projects":
		var projects []models.Project
		h.db.Preload("Client").Find(&projects)
		w.Write([]string{"Proyek", "Klien", "Status", "Progress", "Mulai", "Deadline", "Nilai"})
		for _, p := range projects {
			clientName := ""
			if p.Client != nil { clientName = p.Client.Name }
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
			if tc.User != nil { userName = tc.User.Name }
			outTime := "-"
			if tc.OutTime != nil { outTime = tc.OutTime.Format("15:04") }
			w.Write([]string{userName, tc.InDate.Format("2006-01-02"), tc.InTime.Format("15:04"), outTime, fmt.Sprintf("%.2f", tc.Duration)})
		}

	default:
		w.Write([]string{"error", "tipe laporan tidak dikenal: " + reportType})
		w.Write([]string{"tersedia", strings.Join([]string{"invoices", "expenses", "leads", "projects", "timecards"}, ", ")})
	}
}
