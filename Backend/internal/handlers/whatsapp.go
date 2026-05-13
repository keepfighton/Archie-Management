package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/cbqa/backend/internal/config"
	"github.com/cbqa/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type WhatsAppHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewWhatsAppHandler(db *gorm.DB, cfg *config.Config) *WhatsAppHandler {
	return &WhatsAppHandler{db: db, cfg: cfg}
}

type whatsAppWebhookPayload struct {
	Entry []struct {
		Changes []struct {
			Value struct {
				Messages []struct {
					From string `json:"from"`
					Type string `json:"type"`
					Text struct {
						Body string `json:"body"`
					} `json:"text"`
				} `json:"messages"`
			} `json:"value"`
		} `json:"changes"`
	} `json:"entry"`
}

type ownerReportSummary struct {
	OpenProjects      int64
	CompletedProjects int64
	HoldProjects      int64
	CancelledProjects int64
	TotalClients      int64
	TotalLeads        int64
	TotalInvoiced     float64
	TotalIncome       float64
	TotalExpenses     float64
	DueAmount         float64
	OverdueAmount     float64
	NotPaidAmount     float64
}

type statusCount struct {
	Status string
	Count  int64
}

type invoiceStatusSummary struct {
	Status string
	Count  int64
	Total  float64
	Paid   float64
	Due    float64
}

type amountGroup struct {
	Name  string
	Count int64
	Total float64
}

type projectTimeSummary struct {
	ProjectID uint
	Title     string
	Count     int64
	Hours     float64
}

func (h *WhatsAppHandler) VerifyWebhook(c *gin.Context) {
	mode := c.Query("hub.mode")
	token := c.Query("hub.verify_token")
	challenge := c.Query("hub.challenge")

	if mode == "subscribe" && token != "" && token == h.cfg.WhatsAppVerifyToken {
		c.String(http.StatusOK, challenge)
		return
	}

	c.JSON(http.StatusForbidden, gin.H{"error": "invalid webhook verification token"})
}

func (h *WhatsAppHandler) ReceiveWebhook(c *gin.Context) {
	body, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}

	if !h.validSignature(c.GetHeader("X-Hub-Signature-256"), body) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	var payload whatsAppWebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid webhook payload"})
		return
	}

	for _, message := range extractWhatsAppMessages(payload) {
		if message.From == "" || strings.TrimSpace(message.Text.Body) == "" {
			continue
		}
		if !h.isAllowedOwner(message.From) {
			log.Printf("ignored WhatsApp message from unregistered number: %s", message.From)
			continue
		}
		reply := h.buildReply(message.Text.Body)
		if reply == "" {
			continue
		}
		if err := h.sendText(message.From, reply); err != nil {
			log.Printf("failed sending WhatsApp reply to %s: %v", message.From, err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "received"})
}

func extractWhatsAppMessages(payload whatsAppWebhookPayload) []struct {
	From string `json:"from"`
	Type string `json:"type"`
	Text struct {
		Body string `json:"body"`
	} `json:"text"`
} {
	var messages []struct {
		From string `json:"from"`
		Type string `json:"type"`
		Text struct {
			Body string `json:"body"`
		} `json:"text"`
	}
	for _, entry := range payload.Entry {
		for _, change := range entry.Changes {
			messages = append(messages, change.Value.Messages...)
		}
	}
	return messages
}

func (h *WhatsAppHandler) validSignature(header string, body []byte) bool {
	if h.cfg.WhatsAppAppSecret == "" {
		return true
	}
	if !strings.HasPrefix(header, "sha256=") {
		return false
	}

	expectedMAC := hmac.New(sha256.New, []byte(h.cfg.WhatsAppAppSecret))
	expectedMAC.Write(body)
	expected := expectedMAC.Sum(nil)

	actual, err := hex.DecodeString(strings.TrimPrefix(header, "sha256="))
	if err != nil {
		return false
	}

	return hmac.Equal(actual, expected)
}

func (h *WhatsAppHandler) isAllowedOwner(from string) bool {
	owners := strings.Split(h.cfg.WhatsAppOwnerNumbers, ",")
	for _, owner := range owners {
		if normalizePhone(owner) != "" && normalizePhone(owner) == normalizePhone(from) {
			return true
		}
	}
	return false
}

func (h *WhatsAppHandler) buildReply(message string) string {
	normalized := normalizeQuestion(message)
	switch {
	case normalized == "help" || normalized == "bantuan" || normalized == "menu":
		return h.menuReply()
	case strings.Contains(normalized, "laporan") ||
		strings.Contains(normalized, "report") ||
		strings.Contains(normalized, "ringkasan") ||
		strings.Contains(normalized, "dashboard") ||
		strings.Contains(normalized, "summary"):
		report, err := h.ownerReport()
		if err != nil {
			log.Printf("failed building owner report: %v", err)
			return "Maaf, laporan NEXONE belum bisa dibuat saat ini."
		}
		return formatOwnerReport(report)
	case containsAny(normalized, "semua data", "all data", "overview", "gambaran"):
		return h.businessOverviewReply()
	case containsAny(normalized, "profit", "keuntungan", "laba", "margin", "cashflow", "cash flow", "income vs expense"):
		return h.financeReply()
	case containsAny(normalized, "cluster", "klaster"):
		return h.clusterReply(normalized)
	case containsAny(normalized, "milestone", "milestones", "tahapan"):
		return h.milestoneReply(normalized)
	case containsAny(normalized, "deliverable", "deliverables", "output", "dokumen akhir", "serahan"):
		return h.deliverableReply(normalized)
	case containsAny(normalized, "pic project", "pic proyek", "penanggung jawab project", "penanggung jawab proyek"):
		return h.projectPICReply(normalized)
	case containsAny(normalized, "timecard", "time card", "timesheet", "jam kerja"):
		return h.timecardReply(normalized)
	case containsAny(normalized, "project", "proyek"):
		return h.projectReply(normalized)
	case containsAny(normalized, "task", "tugas", "pekerjaan"):
		return h.taskReply(normalized)
	case containsAny(normalized, "invoice", "tagihan", "piutang", "billing"):
		return h.invoiceReply(normalized)
	case containsAny(normalized, "payment", "pembayaran", "income", "pemasukan", "diterima", "receipt"):
		return h.paymentReply(normalized)
	case containsAny(normalized, "expense", "expenses", "pengeluaran", "biaya", "cost"):
		return h.expenseReply(normalized)
	case containsAny(normalized, "client", "klien", "pelanggan", "customer"):
		return h.clientReply(normalized)
	case containsAny(normalized, "lead", "prospek", "opportunity"):
		return h.leadReply(normalized)
	case containsAny(normalized, "contract", "kontrak"):
		return h.contractReply(normalized)
	case containsAny(normalized, "quotation", "quote", "penawaran"):
		return h.quotationReply(normalized)
	case containsAny(normalized, "order", "pesanan"):
		return h.orderReply(normalized)
	case containsAny(normalized, "team", "tim", "member", "anggota", "cuti", "leave", "clock"):
		return h.teamReply(normalized)
	default:
		return "Saya belum menangkap maksudnya.\n\nKetik 'menu' untuk contoh pertanyaan, atau coba seperti:\n- berapa project berjalan\n- nama project aktif\n- invoice overdue\n- profit\n- lead summary"
	}
}

func (h *WhatsAppHandler) menuReply() string {
	return `NEXONE WA Assistant

Contoh pertanyaan:
- laporan
- semua data
- berapa project berjalan
- nama project aktif
- project selesai / project hold
- cluster
- milestone
- deliverable
- pic project
- timecard project
- task summary
- invoice overdue
- tagihan belum dibayar
- income / payment
- expense
- profit
- client
- lead summary
- kontrak
- penawaran
- order
- team`
}

func (h *WhatsAppHandler) businessOverviewReply() string {
	report, err := h.ownerReport()
	if err != nil {
		log.Printf("failed building overview: %v", err)
		return "Maaf, overview NEXONE belum bisa dibuat saat ini."
	}
	return formatOwnerReport(report)
}

func (h *WhatsAppHandler) projectReply(q string) string {
	if containsAny(q, "pic", "penanggung jawab") {
		return h.projectPICReply(q)
	}
	status, label := projectStatusFromQuestion(q)
	if asksList(q) {
		return h.projectListReply(status, label)
	}
	if asksCount(q) || status != "" {
		return h.projectCountReply(status, label)
	}
	return h.projectOverviewReply()
}

func (h *WhatsAppHandler) projectOverviewReply() string {
	var rows []statusCount
	if err := h.db.Model(&models.Project{}).
		Select("status, COUNT(*) as count").
		Group("status").
		Order("status").
		Scan(&rows).Error; err != nil {
		log.Printf("failed building project overview: %v", err)
		return "Maaf, data project belum bisa dibaca."
	}
	var total int64
	h.db.Model(&models.Project{}).Count(&total)

	lines := []string{fmt.Sprintf("Project NEXONE: %d total", total)}
	for _, row := range rows {
		lines = append(lines, fmt.Sprintf("- %s: %d", projectStatusLabel(row.Status), row.Count))
	}
	return strings.Join(lines, "\n")
}

func (h *WhatsAppHandler) projectCountReply(status, label string) string {
	var count int64
	query := h.db.Model(&models.Project{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Count(&count).Error; err != nil {
		log.Printf("failed counting projects: %v", err)
		return "Maaf, jumlah project belum bisa dibaca."
	}
	if status == "" {
		label = "total"
	}
	return fmt.Sprintf("Project %s: %d", label, count)
}

func (h *WhatsAppHandler) projectListReply(status, label string) string {
	var projects []models.Project
	query := h.db.Preload("Client").Preload("Cluster").Preload("Pic").Order("id asc").Limit(15)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Find(&projects).Error; err != nil {
		log.Printf("failed listing projects: %v", err)
		return "Maaf, daftar project belum bisa dibaca."
	}
	if len(projects) == 0 {
		if label == "" {
			return "Belum ada project."
		}
		return fmt.Sprintf("Belum ada project %s.", label)
	}

	title := "Daftar project"
	if label != "" {
		title += " " + label
	}
	lines := []string{title + ":"}
	for i, project := range projects {
		client := "-"
		if project.Client != nil && project.Client.Name != "" {
			client = project.Client.Name
		}
		cluster := "-"
		if project.Cluster != nil && project.Cluster.Name != "" {
			cluster = project.Cluster.Name
		}
		pic := "-"
		if project.Pic != nil && project.Pic.Name != "" {
			pic = project.Pic.Name
		}
		lines = append(lines, fmt.Sprintf("%d. %s\n   %s | %s | progress %d%% | %s\n   cluster: %s | PIC: %s", i+1, project.Title, client, formatIDR(project.Price), project.Progress, formatDate(project.Deadline.Time), cluster, pic))
	}
	return limitWhatsAppText(strings.Join(lines, "\n"))
}

func (h *WhatsAppHandler) clusterReply(q string) string {
	if asksList(q) || !asksCount(q) {
		var clusters []models.Cluster
		if err := h.db.Preload("Projects", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "title", "cluster_id", "status").Order("title asc")
		}).Order("name asc").Limit(15).Find(&clusters).Error; err != nil {
			log.Printf("failed listing clusters: %v", err)
			return "Maaf, daftar cluster belum bisa dibaca."
		}
		if len(clusters) == 0 {
			return "Belum ada cluster."
		}
		lines := []string{"Cluster NEXONE:"}
		for i, cluster := range clusters {
			open, completed, hold := 0, 0, 0
			for _, project := range cluster.Projects {
				switch project.Status {
				case "open":
					open++
				case "completed":
					completed++
				case "hold":
					hold++
				}
			}
			lines = append(lines, fmt.Sprintf("%d. %s | %d project (open %d, selesai %d, hold %d)", i+1, cluster.Name, len(cluster.Projects), open, completed, hold))
		}
		return limitWhatsAppText(strings.Join(lines, "\n"))
	}
	var count int64
	h.db.Model(&models.Cluster{}).Count(&count)
	return fmt.Sprintf("Cluster NEXONE: %d", count)
}

func (h *WhatsAppHandler) milestoneReply(q string) string {
	projectQuery := extractAfterAny(q, "milestone project", "milestone proyek", "milestones project", "milestones proyek", "tahapan project", "tahapan proyek")
	project, hasProject, err := h.findProjectByText(projectQuery)
	if err != nil {
		log.Printf("failed finding project for milestone: %v", err)
		return "Maaf, data project untuk milestone belum bisa dibaca."
	}

	var milestones []models.Milestone
	query := h.db.Preload("Project").Preload("Assignee").Order("due_date asc, id asc").Limit(15)
	if hasProject {
		query = query.Where("project_id = ?", project.ID)
	}
	if status, _ := milestoneStatusFromQuestion(q); status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Find(&milestones).Error; err != nil {
		log.Printf("failed listing milestones: %v", err)
		return "Maaf, milestone belum bisa dibaca."
	}
	if len(milestones) == 0 {
		if hasProject {
			return fmt.Sprintf("Belum ada milestone untuk project %s.", project.Title)
		}
		return "Belum ada milestone."
	}

	title := "Milestone NEXONE"
	if hasProject {
		title = "Milestone: " + project.Title
	}
	lines := []string{title + ":"}
	for i, milestone := range milestones {
		projectTitle := "-"
		if milestone.Project != nil && milestone.Project.Title != "" {
			projectTitle = milestone.Project.Title
		}
		assignee := "-"
		if milestone.Assignee != nil && milestone.Assignee.Name != "" {
			assignee = milestone.Assignee.Name
		}
		lines = append(lines, fmt.Sprintf("%d. %s\n   %s | %s | %s | PIC %s", i+1, milestone.Name, projectTitle, milestoneStatusLabel(milestone.Status), formatDate(milestone.DueDate.Time), assignee))
	}
	return limitWhatsAppText(strings.Join(lines, "\n"))
}

func (h *WhatsAppHandler) deliverableReply(q string) string {
	projectQuery := extractAfterAny(q, "deliverable project", "deliverable proyek", "deliverables project", "deliverables proyek", "output project", "output proyek", "serahan project", "serahan proyek")
	project, hasProject, err := h.findProjectByText(projectQuery)
	if err != nil {
		log.Printf("failed finding project for deliverable: %v", err)
		return "Maaf, data project untuk deliverable belum bisa dibaca."
	}

	var deliverables []models.Deliverable
	query := h.db.Preload("Project").Order("due_date asc, id asc").Limit(15)
	if hasProject {
		query = query.Where("project_id = ?", project.ID)
	}
	if containsAny(q, "overdue", "terlambat", "lewat") {
		query = query.Where("status <> ? AND due_date < ?", "approved", time.Now())
	} else if status, _ := deliverableStatusFromQuestion(q); status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Find(&deliverables).Error; err != nil {
		log.Printf("failed listing deliverables: %v", err)
		return "Maaf, deliverable belum bisa dibaca."
	}
	if len(deliverables) == 0 {
		if hasProject {
			return fmt.Sprintf("Belum ada deliverable untuk project %s.", project.Title)
		}
		return "Belum ada deliverable."
	}

	title := "Deliverable NEXONE"
	if hasProject {
		title = "Deliverable: " + project.Title
	}
	lines := []string{title + ":"}
	for i, deliverable := range deliverables {
		projectTitle := "-"
		if deliverable.Project != nil && deliverable.Project.Title != "" {
			projectTitle = deliverable.Project.Title
		}
		lines = append(lines, fmt.Sprintf("%d. %s\n   %s | %s | %s", i+1, deliverable.Name, projectTitle, deliverableStatusLabel(deliverable.Status), formatDate(deliverable.DueDate.Time)))
	}
	return limitWhatsAppText(strings.Join(lines, "\n"))
}

func (h *WhatsAppHandler) projectPICReply(q string) string {
	projectQuery := extractAfterAny(q, "pic project", "pic proyek", "penanggung jawab project", "penanggung jawab proyek")
	project, hasProject, err := h.findProjectByText(projectQuery)
	if err != nil {
		log.Printf("failed finding project for PIC: %v", err)
		return "Maaf, data PIC project belum bisa dibaca."
	}
	if hasProject {
		if err := h.db.Preload("Pic").Preload("Client").First(&project, project.ID).Error; err != nil {
			log.Printf("failed loading project PIC: %v", err)
			return "Maaf, PIC project belum bisa dibaca."
		}
		pic := "-"
		if project.Pic != nil && project.Pic.Name != "" {
			pic = project.Pic.Name
		}
		client := "-"
		if project.Client != nil && project.Client.Name != "" {
			client = project.Client.Name
		}
		return fmt.Sprintf("PIC project %s:\nClient: %s\nPIC: %s\nStatus: %s\nProgress: %d%%", project.Title, client, pic, projectStatusLabel(project.Status), project.Progress)
	}

	var projects []models.Project
	if err := h.db.Preload("Pic").Preload("Client").Order("status asc, id asc").Limit(15).Find(&projects).Error; err != nil {
		log.Printf("failed listing project PIC: %v", err)
		return "Maaf, daftar PIC project belum bisa dibaca."
	}
	if len(projects) == 0 {
		return "Belum ada project."
	}
	lines := []string{"PIC Project NEXONE:"}
	for i, project := range projects {
		pic := "-"
		if project.Pic != nil && project.Pic.Name != "" {
			pic = project.Pic.Name
		}
		lines = append(lines, fmt.Sprintf("%d. %s | %s | %s", i+1, project.Title, pic, projectStatusLabel(project.Status)))
	}
	return limitWhatsAppText(strings.Join(lines, "\n"))
}

func (h *WhatsAppHandler) timecardReply(q string) string {
	projectQuery := extractAfterAny(q, "timecard project", "timecard proyek", "time card project", "time card proyek", "timesheet project", "timesheet proyek", "jam kerja project", "jam kerja proyek")
	project, hasProject, err := h.findProjectByText(projectQuery)
	if err != nil {
		log.Printf("failed finding project for timecard: %v", err)
		return "Maaf, data project untuk timecard belum bisa dibaca."
	}

	if hasProject {
		var count int64
		var hours float64
		h.db.Model(&models.TimeCard{}).Where("project_id = ?", project.ID).Count(&count)
		h.db.Model(&models.TimeCard{}).Where("project_id = ?", project.ID).Select("COALESCE(SUM(duration),0)").Scan(&hours)
		return fmt.Sprintf("Timecard project %s:\nRecord: %d\nTotal jam: %.2f", project.Title, count, hours)
	}

	var rows []projectTimeSummary
	if err := h.db.Table("time_cards tc").
		Select("p.id as project_id, p.title as title, COUNT(tc.id) as count, COALESCE(SUM(tc.duration),0) as hours").
		Joins("JOIN projects p ON p.id = tc.project_id").
		Where("tc.deleted_at IS NULL AND p.deleted_at IS NULL").
		Group("p.id, p.title").
		Order("hours desc").
		Limit(15).
		Scan(&rows).Error; err != nil {
		log.Printf("failed building project timecard summary: %v", err)
		return "Maaf, summary timecard project belum bisa dibaca."
	}
	if len(rows) == 0 {
		return "Belum ada timecard yang terhubung ke project."
	}
	lines := []string{"Timecard per project:"}
	for i, row := range rows {
		lines = append(lines, fmt.Sprintf("%d. %s | %.2f jam | %d record", i+1, row.Title, row.Hours, row.Count))
	}
	return limitWhatsAppText(strings.Join(lines, "\n"))
}

func (h *WhatsAppHandler) taskReply(q string) string {
	status, label := taskStatusFromQuestion(q)
	if asksList(q) {
		var tasks []models.Task
		query := h.db.Preload("Project").Order("deadline asc, id asc").Limit(15)
		if status != "" {
			query = query.Where("status = ?", status)
		}
		if err := query.Find(&tasks).Error; err != nil {
			log.Printf("failed listing tasks: %v", err)
			return "Maaf, daftar task belum bisa dibaca."
		}
		if len(tasks) == 0 {
			return "Belum ada task yang cocok."
		}
		lines := []string{"Daftar task:"}
		for i, task := range tasks {
			project := "-"
			if task.Project != nil && task.Project.Title != "" {
				project = task.Project.Title
			}
			lines = append(lines, fmt.Sprintf("%d. %s\n   %s | %s | %s", i+1, task.Title, project, taskStatusLabel(task.Status), formatDate(task.Deadline.Time)))
		}
		return limitWhatsAppText(strings.Join(lines, "\n"))
	}
	return h.statusSummaryReply("Task", h.db.Model(&models.Task{}), taskStatusLabel, status, label)
}

func (h *WhatsAppHandler) invoiceReply(q string) string {
	status, label := invoiceStatusFromQuestion(q)
	if asksList(q) {
		var invoices []models.Invoice
		query := h.db.Preload("Client").Preload("Project").Order("due_date asc, id asc").Limit(15)
		if status != "" {
			query = query.Where("status = ?", status)
		}
		if err := query.Find(&invoices).Error; err != nil {
			log.Printf("failed listing invoices: %v", err)
			return "Maaf, daftar invoice belum bisa dibaca."
		}
		if len(invoices) == 0 {
			return "Belum ada invoice yang cocok."
		}
		lines := []string{"Daftar invoice:"}
		for i, invoice := range invoices {
			client := "-"
			if invoice.Client != nil && invoice.Client.Name != "" {
				client = invoice.Client.Name
			}
			lines = append(lines, fmt.Sprintf("%d. %s - %s\n   %s | paid %s | due %s | %s", i+1, invoice.InvoiceNumber, client, formatIDR(invoice.TotalAmount), formatIDR(invoice.PaidAmount), formatIDR(invoice.DueAmount), invoiceStatusLabel(invoice.Status)))
		}
		return limitWhatsAppText(strings.Join(lines, "\n"))
	}

	var rows []invoiceStatusSummary
	query := h.db.Model(&models.Invoice{}).
		Select("status, COUNT(*) as count, COALESCE(SUM(total_amount),0) as total, COALESCE(SUM(paid_amount),0) as paid, COALESCE(SUM(due_amount),0) as due").
		Group("status").
		Order("status")
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Scan(&rows).Error; err != nil {
		log.Printf("failed building invoice summary: %v", err)
		return "Maaf, summary invoice belum bisa dibaca."
	}
	if len(rows) == 0 {
		return "Belum ada invoice yang cocok."
	}
	title := "Invoice NEXONE"
	if label != "" {
		title += " " + label
	}
	lines := []string{title + ":"}
	for _, row := range rows {
		lines = append(lines, fmt.Sprintf("- %s: %d | total %s | paid %s | due %s", invoiceStatusLabel(row.Status), row.Count, formatIDR(row.Total), formatIDR(row.Paid), formatIDR(row.Due)))
	}
	return strings.Join(lines, "\n")
}

func (h *WhatsAppHandler) paymentReply(q string) string {
	var count int64
	var total float64
	if err := h.db.Model(&models.Payment{}).Count(&count).Select("COALESCE(SUM(amount),0)").Scan(&total).Error; err != nil {
		log.Printf("failed building payment summary: %v", err)
		return "Maaf, data payment belum bisa dibaca."
	}
	if asksList(q) {
		var payments []models.Payment
		if err := h.db.Preload("Invoice").Order("payment_date desc, id desc").Limit(12).Find(&payments).Error; err != nil {
			log.Printf("failed listing payments: %v", err)
			return "Maaf, daftar payment belum bisa dibaca."
		}
		lines := []string{fmt.Sprintf("Payment diterima: %s dari %d transaksi", formatIDR(total), count)}
		for i, payment := range payments {
			invoice := fmt.Sprintf("invoice #%d", payment.InvoiceID)
			if payment.Invoice != nil && payment.Invoice.InvoiceNumber != "" {
				invoice = payment.Invoice.InvoiceNumber
			}
			lines = append(lines, fmt.Sprintf("%d. %s | %s | %s", i+1, invoice, formatIDR(payment.Amount), formatDate(payment.PaymentDate.Time)))
		}
		return limitWhatsAppText(strings.Join(lines, "\n"))
	}
	return fmt.Sprintf("Income/payment diterima: %s dari %d transaksi", formatIDR(total), count)
}

func (h *WhatsAppHandler) expenseReply(q string) string {
	var count int64
	var total float64
	if err := h.db.Model(&models.Expense{}).Count(&count).Select("COALESCE(SUM(total),0)").Scan(&total).Error; err != nil {
		log.Printf("failed building expense summary: %v", err)
		return "Maaf, data expense belum bisa dibaca."
	}
	if containsAny(q, "kategori", "category") {
		var rows []amountGroup
		if err := h.db.Model(&models.Expense{}).Select("COALESCE(NULLIF(category,''),'Other') as name, COUNT(*) as count, COALESCE(SUM(total),0) as total").Group("COALESCE(NULLIF(category,''),'Other')").Order("total desc").Scan(&rows).Error; err != nil {
			log.Printf("failed grouping expenses: %v", err)
			return "Maaf, kategori expense belum bisa dibaca."
		}
		lines := []string{"Expense per kategori:"}
		for _, row := range rows {
			lines = append(lines, fmt.Sprintf("- %s: %d | %s", row.Name, row.Count, formatIDR(row.Total)))
		}
		return strings.Join(lines, "\n")
	}
	return fmt.Sprintf("Expense NEXONE: %s dari %d transaksi", formatIDR(total), count)
}

func (h *WhatsAppHandler) financeReply() string {
	var income, expenses, invoiced, due float64
	h.db.Model(&models.Payment{}).Select("COALESCE(SUM(amount),0)").Scan(&income)
	h.db.Model(&models.Expense{}).Select("COALESCE(SUM(total),0)").Scan(&expenses)
	h.db.Model(&models.Invoice{}).Select("COALESCE(SUM(total_amount),0)").Scan(&invoiced)
	h.db.Model(&models.Invoice{}).Select("COALESCE(SUM(due_amount),0)").Scan(&due)
	return fmt.Sprintf(`Keuangan NEXONE
Total invoice: %s
Income diterima: %s
Expense: %s
Profit estimasi: %s
Tagihan outstanding: %s`, formatIDR(invoiced), formatIDR(income), formatIDR(expenses), formatIDR(income-expenses), formatIDR(due))
}

func (h *WhatsAppHandler) clientReply(q string) string {
	if asksList(q) || !asksCount(q) {
		var clients []models.Client
		if err := h.db.Order("name asc").Limit(15).Find(&clients).Error; err != nil {
			log.Printf("failed listing clients: %v", err)
			return "Maaf, daftar client belum bisa dibaca."
		}
		if len(clients) == 0 {
			return "Belum ada client."
		}
		lines := []string{"Daftar client:"}
		for i, client := range clients {
			contact := strings.TrimSpace(client.Email)
			if contact == "" {
				contact = strings.TrimSpace(client.Phone)
			}
			if contact == "" {
				contact = "-"
			}
			lines = append(lines, fmt.Sprintf("%d. %s | %s", i+1, client.Name, contact))
		}
		return limitWhatsAppText(strings.Join(lines, "\n"))
	}
	var count int64
	h.db.Model(&models.Client{}).Count(&count)
	return fmt.Sprintf("Client NEXONE: %d", count)
}

func (h *WhatsAppHandler) leadReply(q string) string {
	status, label := leadStatusFromQuestion(q)
	if asksList(q) {
		var leads []models.Lead
		query := h.db.Order("id desc").Limit(15)
		if status != "" {
			query = query.Where("status = ?", status)
		}
		if err := query.Find(&leads).Error; err != nil {
			log.Printf("failed listing leads: %v", err)
			return "Maaf, daftar lead belum bisa dibaca."
		}
		if len(leads) == 0 {
			return "Belum ada lead yang cocok."
		}
		lines := []string{"Daftar lead:"}
		for i, lead := range leads {
			lines = append(lines, fmt.Sprintf("%d. %s | %s | %s", i+1, lead.Name, leadStatusLabel(lead.Status), firstNonEmpty(lead.PrimaryContact, lead.Phone, lead.Email, "-")))
		}
		return limitWhatsAppText(strings.Join(lines, "\n"))
	}
	return h.statusSummaryReply("Lead", h.db.Model(&models.Lead{}), leadStatusLabel, status, label)
}

func (h *WhatsAppHandler) contractReply(q string) string {
	if asksList(q) {
		var contracts []models.Contract
		if err := h.db.Preload("Client").Order("id desc").Limit(12).Find(&contracts).Error; err != nil {
			log.Printf("failed listing contracts: %v", err)
			return "Maaf, daftar kontrak belum bisa dibaca."
		}
		lines := []string{"Daftar kontrak:"}
		for i, contract := range contracts {
			client := "-"
			if contract.Client != nil && contract.Client.Name != "" {
				client = contract.Client.Name
			}
			lines = append(lines, fmt.Sprintf("%d. %s - %s | %s | %s", i+1, contract.ContractNumber, contract.Title, client, formatIDR(contract.Amount)))
		}
		return limitWhatsAppText(strings.Join(lines, "\n"))
	}
	return h.statusSummaryReply("Kontrak", h.db.Model(&models.Contract{}), plainStatusLabel, "", "")
}

func (h *WhatsAppHandler) quotationReply(q string) string {
	if asksList(q) {
		var quotations []models.Quotation
		if err := h.db.Preload("Client").Order("id desc").Limit(12).Find(&quotations).Error; err != nil {
			log.Printf("failed listing quotations: %v", err)
			return "Maaf, daftar penawaran belum bisa dibaca."
		}
		lines := []string{"Daftar penawaran:"}
		for i, quotation := range quotations {
			client := "-"
			if quotation.Client != nil && quotation.Client.Name != "" {
				client = quotation.Client.Name
			}
			lines = append(lines, fmt.Sprintf("%d. %s - %s | %s | %s", i+1, quotation.QuoteNumber, quotation.Title, client, formatIDR(quotation.TotalAmount)))
		}
		return limitWhatsAppText(strings.Join(lines, "\n"))
	}
	return h.statusSummaryReply("Penawaran", h.db.Model(&models.Quotation{}), plainStatusLabel, "", "")
}

func (h *WhatsAppHandler) orderReply(q string) string {
	if asksList(q) {
		var orders []models.Order
		if err := h.db.Preload("Client").Preload("Project").Order("id desc").Limit(12).Find(&orders).Error; err != nil {
			log.Printf("failed listing orders: %v", err)
			return "Maaf, daftar order belum bisa dibaca."
		}
		lines := []string{"Daftar order:"}
		for i, order := range orders {
			client := "-"
			if order.Client != nil && order.Client.Name != "" {
				client = order.Client.Name
			}
			lines = append(lines, fmt.Sprintf("%d. %s | %s | %s | %s", i+1, order.OrderNumber, client, plainStatusLabel(order.Status), formatIDR(order.Amount)))
		}
		return limitWhatsAppText(strings.Join(lines, "\n"))
	}
	return h.statusSummaryReply("Order", h.db.Model(&models.Order{}), plainStatusLabel, "", "")
}

func (h *WhatsAppHandler) teamReply(q string) string {
	var totalMembers, activeMembers, clockedIn, onLeave int64
	today := time.Now().In(time.FixedZone("WIB", 7*60*60)).Format("2006-01-02")
	h.db.Model(&models.User{}).Count(&totalMembers)
	h.db.Model(&models.User{}).Where("is_active = true").Count(&activeMembers)
	h.db.Model(&models.User{}).Where("is_active = true AND clocked_in = true").Count(&clockedIn)
	h.db.Model(&models.Leave{}).Where("status = 'approved' AND DATE(start_date) <= ? AND DATE(end_date) >= ?", today, today).Count(&onLeave)
	return fmt.Sprintf(`Team NEXONE
Total member: %d
Member aktif: %d
Clocked in: %d
Cuti hari ini: %d`, totalMembers, activeMembers, clockedIn, onLeave)
}

func (h *WhatsAppHandler) statusSummaryReply(title string, query *gorm.DB, labeler func(string) string, onlyStatus, onlyLabel string) string {
	var rows []statusCount
	if onlyStatus != "" {
		query = query.Where("status = ?", onlyStatus)
	}
	if err := query.Select("status, COUNT(*) as count").Group("status").Order("status").Scan(&rows).Error; err != nil {
		log.Printf("failed building %s summary: %v", title, err)
		return fmt.Sprintf("Maaf, summary %s belum bisa dibaca.", strings.ToLower(title))
	}
	if len(rows) == 0 {
		return fmt.Sprintf("%s %s: 0", title, onlyLabel)
	}
	lines := []string{title + " NEXONE:"}
	for _, row := range rows {
		lines = append(lines, fmt.Sprintf("- %s: %d", labeler(row.Status), row.Count))
	}
	return strings.Join(lines, "\n")
}

func (h *WhatsAppHandler) ownerReport() (ownerReportSummary, error) {
	var summary ownerReportSummary

	if err := h.db.Model(&models.Project{}).Where("status = 'open'").Count(&summary.OpenProjects).Error; err != nil {
		return summary, err
	}
	if err := h.db.Model(&models.Project{}).Where("status = 'completed'").Count(&summary.CompletedProjects).Error; err != nil {
		return summary, err
	}
	if err := h.db.Model(&models.Project{}).Where("status = 'hold'").Count(&summary.HoldProjects).Error; err != nil {
		return summary, err
	}
	if err := h.db.Model(&models.Project{}).Where("status = 'cancelled'").Count(&summary.CancelledProjects).Error; err != nil {
		return summary, err
	}
	if err := h.db.Model(&models.Client{}).Count(&summary.TotalClients).Error; err != nil {
		return summary, err
	}
	if err := h.db.Model(&models.Lead{}).Count(&summary.TotalLeads).Error; err != nil {
		return summary, err
	}
	if err := h.db.Model(&models.Invoice{}).Select("COALESCE(SUM(total_amount),0)").Scan(&summary.TotalInvoiced).Error; err != nil {
		return summary, err
	}
	if err := h.db.Model(&models.Payment{}).Select("COALESCE(SUM(amount),0)").Scan(&summary.TotalIncome).Error; err != nil {
		return summary, err
	}
	if err := h.db.Model(&models.Expense{}).Select("COALESCE(SUM(total),0)").Scan(&summary.TotalExpenses).Error; err != nil {
		return summary, err
	}
	if err := h.db.Model(&models.Invoice{}).Select("COALESCE(SUM(due_amount),0)").Scan(&summary.DueAmount).Error; err != nil {
		return summary, err
	}
	if err := h.db.Model(&models.Invoice{}).Where("status = 'overdue'").Select("COALESCE(SUM(due_amount),0)").Scan(&summary.OverdueAmount).Error; err != nil {
		return summary, err
	}
	if err := h.db.Model(&models.Invoice{}).Where("status IN ?", []string{"not_paid", "partially_paid"}).Select("COALESCE(SUM(due_amount),0)").Scan(&summary.NotPaidAmount).Error; err != nil {
		return summary, err
	}

	return summary, nil
}

func formatOwnerReport(summary ownerReportSummary) string {
	profit := summary.TotalIncome - summary.TotalExpenses
	now := time.Now().In(time.FixedZone("WIB", 7*60*60)).Format("02 Jan 2006 15:04")

	return fmt.Sprintf(`Ringkasan NEXONE
%s WIB

Project berjalan: %d
Project selesai: %d
Project hold: %d
Project batal: %d

Total invoice: %s
Income diterima: %s
Expense: %s
Profit estimasi: %s

Tagihan belum dibayar: %s
Overdue: %s

Client: %d
Lead: %d`,
		now,
		summary.OpenProjects,
		summary.CompletedProjects,
		summary.HoldProjects,
		summary.CancelledProjects,
		formatIDR(summary.TotalInvoiced),
		formatIDR(summary.TotalIncome),
		formatIDR(summary.TotalExpenses),
		formatIDR(profit),
		formatIDR(summary.NotPaidAmount),
		formatIDR(summary.OverdueAmount),
		summary.TotalClients,
		summary.TotalLeads,
	)
}

func normalizeQuestion(message string) string {
	normalized := strings.ToLower(strings.TrimSpace(message))
	replacer := strings.NewReplacer(
		"?", " ",
		"!", " ",
		".", " ",
		",", " ",
		":", " ",
		";", " ",
		"_", " ",
		"-", " ",
		"  ", " ",
	)
	for i := 0; i < 3; i++ {
		normalized = replacer.Replace(normalized)
	}
	return strings.TrimSpace(normalized)
}

func extractAfterAny(s string, markers ...string) string {
	for _, marker := range markers {
		idx := strings.Index(s, marker)
		if idx >= 0 {
			return strings.TrimSpace(s[idx+len(marker):])
		}
	}
	return ""
}

func (h *WhatsAppHandler) findProjectByText(text string) (models.Project, bool, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return models.Project{}, false, nil
	}

	var project models.Project
	if id, ok := parseUintText(text); ok {
		err := h.db.First(&project, id).Error
		if err == nil {
			return project, true, nil
		}
		if err != gorm.ErrRecordNotFound {
			return project, false, err
		}
	}

	err := h.db.Where("title ILIKE ?", "%"+text+"%").Order("id desc").First(&project).Error
	if err == nil {
		return project, true, nil
	}
	if err == gorm.ErrRecordNotFound {
		return models.Project{}, false, nil
	}
	return project, false, err
}

func parseUintText(text string) (uint, bool) {
	var digits strings.Builder
	for _, r := range text {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
			continue
		}
		if digits.Len() > 0 {
			break
		}
	}
	if digits.Len() == 0 {
		return 0, false
	}
	var value uint64
	if _, err := fmt.Sscanf(digits.String(), "%d", &value); err != nil || value == 0 {
		return 0, false
	}
	return uint(value), true
}

func containsAny(s string, needles ...string) bool {
	for _, needle := range needles {
		if strings.Contains(s, needle) {
			return true
		}
	}
	return false
}

func asksList(q string) bool {
	return containsAny(q, "apa aja", "apa saja", "nama", "daftar", "list", "lihat", "tampilkan", "detail", "mana saja", "yang mana")
}

func asksCount(q string) bool {
	return containsAny(q, "berapa", "jumlah", "total", "count", "berapa banyak")
}

func projectStatusFromQuestion(q string) (string, string) {
	switch {
	case containsAny(q, "berjalan", "aktif", "open", "terbuka", "ongoing"):
		return "open", "berjalan"
	case containsAny(q, "selesai", "completed", "done", "finish"):
		return "completed", "selesai"
	case containsAny(q, "hold", "tertunda", "ditunda"):
		return "hold", "hold"
	case containsAny(q, "batal", "cancel", "cancelled"):
		return "cancelled", "batal"
	default:
		return "", ""
	}
}

func taskStatusFromQuestion(q string) (string, string) {
	switch {
	case containsAny(q, "todo", "to do", "belum", "baru"):
		return "todo", "to do"
	case containsAny(q, "progress", "berjalan", "aktif", "dikerjakan"):
		return "in_progress", "in progress"
	case containsAny(q, "selesai", "done"):
		return "done", "done"
	case containsAny(q, "expired", "lewat", "terlambat"):
		return "expired", "expired"
	default:
		return "", ""
	}
}

func invoiceStatusFromQuestion(q string) (string, string) {
	switch {
	case containsAny(q, "overdue", "terlambat", "jatuh tempo"):
		return "overdue", "overdue"
	case containsAny(q, "belum dibayar", "not paid", "unpaid", "belum bayar"):
		return "not_paid", "belum dibayar"
	case containsAny(q, "sebagian", "partial", "partially"):
		return "partially_paid", "dibayar sebagian"
	case containsAny(q, "lunas", "fully paid", "paid"):
		return "fully_paid", "lunas"
	case containsAny(q, "draft"):
		return "draft", "draft"
	default:
		return "", ""
	}
}

func leadStatusFromQuestion(q string) (string, string) {
	switch {
	case containsAny(q, "new", "baru"):
		return "new", "baru"
	case containsAny(q, "qualified", "kualifikasi"):
		return "qualified", "qualified"
	case containsAny(q, "discussion", "diskusi"):
		return "discussion", "discussion"
	case containsAny(q, "negotiation", "negosiasi"):
		return "negotiation", "negotiation"
	case containsAny(q, "won", "menang", "deal"):
		return "won", "won"
	case containsAny(q, "lost", "kalah", "gagal"):
		return "lost", "lost"
	default:
		return "", ""
	}
}

func milestoneStatusFromQuestion(q string) (string, string) {
	switch {
	case containsAny(q, "pending", "belum", "menunggu"):
		return "pending", "pending"
	case containsAny(q, "progress", "berjalan", "dikerjakan"):
		return "in_progress", "in progress"
	case containsAny(q, "selesai", "done"):
		return "done", "done"
	default:
		return "", ""
	}
}

func deliverableStatusFromQuestion(q string) (string, string) {
	switch {
	case containsAny(q, "draft"):
		return "draft", "draft"
	case containsAny(q, "submitted", "submit", "terkirim"):
		return "submitted", "submitted"
	case containsAny(q, "approved", "approve", "disetujui"):
		return "approved", "approved"
	default:
		return "", ""
	}
}

func projectStatusLabel(status string) string {
	switch status {
	case "open":
		return "berjalan"
	case "completed":
		return "selesai"
	case "hold":
		return "hold"
	case "cancelled":
		return "batal"
	default:
		return plainStatusLabel(status)
	}
}

func taskStatusLabel(status string) string {
	switch status {
	case "todo":
		return "to do"
	case "in_progress":
		return "in progress"
	case "done":
		return "done"
	case "expired":
		return "expired"
	default:
		return plainStatusLabel(status)
	}
}

func invoiceStatusLabel(status string) string {
	switch status {
	case "not_paid":
		return "belum dibayar"
	case "partially_paid":
		return "dibayar sebagian"
	case "fully_paid":
		return "lunas"
	case "overdue":
		return "overdue"
	case "draft":
		return "draft"
	default:
		return plainStatusLabel(status)
	}
}

func leadStatusLabel(status string) string {
	switch status {
	case "new":
		return "baru"
	case "qualified":
		return "qualified"
	case "discussion":
		return "discussion"
	case "negotiation":
		return "negotiation"
	case "won":
		return "won"
	case "lost":
		return "lost"
	default:
		return plainStatusLabel(status)
	}
}

func milestoneStatusLabel(status string) string {
	switch status {
	case "pending":
		return "pending"
	case "in_progress":
		return "in progress"
	case "done":
		return "done"
	default:
		return plainStatusLabel(status)
	}
}

func deliverableStatusLabel(status string) string {
	switch status {
	case "draft":
		return "draft"
	case "submitted":
		return "submitted"
	case "approved":
		return "approved"
	default:
		return plainStatusLabel(status)
	}
}

func plainStatusLabel(status string) string {
	status = strings.TrimSpace(status)
	if status == "" {
		return "-"
	}
	return strings.ReplaceAll(status, "_", " ")
}

func formatDate(t time.Time) string {
	if t.IsZero() {
		return "-"
	}
	return t.In(time.FixedZone("WIB", 7*60*60)).Format("02 Jan 2006")
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func limitWhatsAppText(text string) string {
	const maxLen = 3500
	if len(text) <= maxLen {
		return text
	}
	return text[:maxLen] + "\n\n...dipotong, minta lebih spesifik untuk detail lengkap."
}

func (h *WhatsAppHandler) sendText(to, body string) error {
	if h.cfg.WhatsAppAccessToken == "" || h.cfg.WhatsAppPhoneNumberID == "" {
		return fmt.Errorf("WhatsApp credentials are not configured")
	}

	payload := map[string]interface{}{
		"messaging_product": "whatsapp",
		"to":                to,
		"type":              "text",
		"text": map[string]interface{}{
			"preview_url": false,
			"body":        body,
		},
	}
	rawPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("https://graph.facebook.com/%s/%s/messages", h.cfg.WhatsAppAPIVersion, h.cfg.WhatsAppPhoneNumberID)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(rawPayload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+h.cfg.WhatsAppAccessToken)
	req.Header.Set("Content-Type", "application/json")

	res, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.StatusCode >= 200 && res.StatusCode < 300 {
		return nil
	}

	responseBody, _ := io.ReadAll(io.LimitReader(res.Body, 2048))
	return fmt.Errorf("WhatsApp API returned %s: %s", res.Status, strings.TrimSpace(string(responseBody)))
}

func normalizePhone(phone string) string {
	var b strings.Builder
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func formatIDR(amount float64) string {
	value := int64(amount)
	sign := ""
	if value < 0 {
		sign = "-"
		value = -value
	}

	digits := fmt.Sprintf("%d", value)
	for i := len(digits) - 3; i > 0; i -= 3 {
		digits = digits[:i] + "." + digits[i:]
	}
	return sign + "Rp " + digits
}
