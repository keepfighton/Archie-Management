package handlers

import (
	"encoding/csv"
	"fmt"
	"html/template"
	"strings"
	"time"

	"github.com/cbqa/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *InternalProjectHandler) accessibleInternalProjectIDs(c *gin.Context) *gorm.DB {
	query := h.db.Model(&models.InternalProject{}).Select("internal_projects.id")
	if getUserRole(c) != "admin" {
		query = query.Joins("JOIN internal_project_members ipm ON ipm.project_id = internal_projects.id AND ipm.deleted_at IS NULL").
			Where("ipm.user_id = ?", getUserID(c))
	}
	return query
}

func applyInternalReportFilters(query *gorm.DB, c *gin.Context, projectColumn, userColumn, dateColumn string) *gorm.DB {
	if projectID := strings.TrimSpace(c.Query("project_id")); projectID != "" {
		query = query.Where(projectColumn+" = ?", projectID)
	}
	if userID := strings.TrimSpace(c.Query("user_id")); userID != "" && userColumn != "" {
		query = query.Where(userColumn+" = ?", userID)
	}
	if from := strings.TrimSpace(c.Query("from")); from != "" && dateColumn != "" {
		if parsed, err := parseInternalProjectDate(from); err == nil {
			query = query.Where(dateColumn+" >= ?", parsed)
		}
	}
	if to := strings.TrimSpace(c.Query("to")); to != "" && dateColumn != "" {
		if parsed, err := parseInternalProjectDate(to); err == nil {
			query = query.Where(dateColumn+" < ?", parsed.AddDate(0, 0, 1))
		}
	}
	return query
}

func (h *InternalProjectHandler) ExportInternalProjectCSV(c *gin.Context) {
	reportType := c.DefaultQuery("type", "tasks")
	filename := fmt.Sprintf("internal_project_%s_%s.csv", reportType, time.Now().Format("2006-01-02"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.Writer.Write([]byte("\xEF\xBB\xBF"))
	w := csv.NewWriter(c.Writer)
	defer w.Flush()

	accessibleIDs := h.accessibleInternalProjectIDs(c)
	switch reportType {
	case "timesheet":
		type row struct {
			ProjectName     string
			TaskTitle       string
			UserName        string
			ClockIn         time.Time
			ClockOut        *time.Time
			DurationSeconds int64
		}
		var rows []row
		query := h.db.Table("internal_time_logs itl").
			Select("ip.name AS project_name, it.title AS task_title, u.name AS user_name, itl.clock_in, itl.clock_out, itl.duration_seconds").
			Joins("JOIN internal_tasks it ON it.id = itl.task_id AND it.deleted_at IS NULL").
			Joins("JOIN internal_projects ip ON ip.id = it.project_id AND ip.deleted_at IS NULL").
			Joins("JOIN users u ON u.id = itl.user_id AND u.deleted_at IS NULL").
			Where("itl.deleted_at IS NULL AND it.project_id IN (?)", accessibleIDs)
		query = applyInternalReportFilters(query, c, "it.project_id", "itl.user_id", "itl.clock_in")
		query.Order("itl.clock_in desc").Scan(&rows)
		_ = w.Write([]string{"Project", "Task", "User", "Clock In", "Clock Out", "Duration (Hours)"})
		for _, row := range rows {
			clockOut := "Active"
			if row.ClockOut != nil {
				clockOut = row.ClockOut.Format("2006-01-02 15:04")
			}
			_ = w.Write([]string{row.ProjectName, row.TaskTitle, row.UserName, row.ClockIn.Format("2006-01-02 15:04"), clockOut, fmt.Sprintf("%.2f", float64(row.DurationSeconds)/3600)})
		}
	default:
		var tasks []models.InternalTask
		query := h.db.Preload("Project").Preload("Column").Preload("Creator").Preload("Assignees.User").
			Where("project_id IN (?)", accessibleIDs)
		query = applyInternalReportFilters(query, c, "project_id", "", "due_date")
		if userID := strings.TrimSpace(c.Query("user_id")); userID != "" {
			assignedTaskIDs := h.db.Model(&models.InternalTaskAssignee{}).Select("task_id").Where("user_id = ?", userID)
			query = query.Where("id IN (?)", assignedTaskIDs)
		}
		query.Order("project_id asc, column_id asc, position asc").Find(&tasks)
		_ = w.Write([]string{"Project", "Task", "Category", "Priority", "Status", "Assignees", "Deadline", "Overdue", "Creator"})
		now := time.Now()
		for _, task := range tasks {
			assignees := make([]string, 0, len(task.Assignees))
			for _, assignee := range task.Assignees {
				if assignee.User != nil {
					assignees = append(assignees, assignee.User.Name)
				}
			}
			deadline := ""
			overdue := "No"
			if task.DueDate != nil {
				deadline = task.DueDate.Format("2006-01-02")
				if task.Status != "done" && task.DueDate.Before(now) {
					overdue = "Yes"
				}
			}
			projectName, creatorName := "", ""
			if task.Project != nil {
				projectName = task.Project.Name
			}
			if task.Creator != nil {
				creatorName = task.Creator.Name
			}
			_ = w.Write([]string{projectName, task.Title, task.Category, task.Priority, task.Status, strings.Join(assignees, ", "), deadline, overdue, creatorName})
		}
	}
}

func (h *InternalProjectHandler) PrintInternalProjectSummary(c *gin.Context) {
	accessibleIDs := h.accessibleInternalProjectIDs(c)
	var projects []models.InternalProject
	projectQuery := h.db.Preload("Owner").Preload("Members.User").Where("id IN (?)", accessibleIDs)
	projectQuery = applyInternalReportFilters(projectQuery, c, "id", "", "")
	if userID := strings.TrimSpace(c.Query("user_id")); userID != "" {
		memberProjectIDs := h.db.Model(&models.InternalProjectMember{}).Select("project_id").Where("user_id = ?", userID)
		projectQuery = projectQuery.Where("id IN (?)", memberProjectIDs)
	}
	projectQuery.Order("name asc").Find(&projects)

	projectIDs := make([]uint, 0, len(projects))
	for _, project := range projects {
		projectIDs = append(projectIDs, project.ID)
	}
	var tasks []models.InternalTask
	if len(projectIDs) > 0 {
		taskQuery := h.db.Preload("Project").Preload("Assignees.User").Where("project_id IN ?", projectIDs)
		taskQuery = applyInternalReportFilters(taskQuery, c, "project_id", "", "due_date")
		if userID := strings.TrimSpace(c.Query("user_id")); userID != "" {
			assignedTaskIDs := h.db.Model(&models.InternalTaskAssignee{}).Select("task_id").Where("user_id = ?", userID)
			taskQuery = taskQuery.Where("id IN (?)", assignedTaskIDs)
		}
		taskQuery.Find(&tasks)
	}
	now := time.Now()
	total, done, overdue, high := len(tasks), 0, 0, 0
	for _, task := range tasks {
		if task.Status == "done" {
			done++
		}
		if task.Status != "done" && task.DueDate != nil && task.DueDate.Before(now) {
			overdue++
		}
		if task.Status != "done" && (task.Priority == "high" || task.Priority == "urgent") {
			high++
		}
	}

	var totalSeconds int64
	if len(projectIDs) > 0 {
		query := h.db.Table("internal_time_logs itl").Joins("JOIN internal_tasks it ON it.id = itl.task_id").
			Where("itl.deleted_at IS NULL AND it.project_id IN ?", projectIDs)
		query = applyInternalReportFilters(query, c, "it.project_id", "itl.user_id", "itl.clock_in")
		query.Select("COALESCE(SUM(itl.duration_seconds), 0)").Scan(&totalSeconds)
	}

	data := struct {
		PrintedAt string
		From      string
		To        string
		Projects  []models.InternalProject
		Total     int
		Done      int
		Overdue   int
		High      int
		Hours     string
	}{
		PrintedAt: time.Now().Format("02 January 2006 15:04"), From: c.Query("from"), To: c.Query("to"),
		Projects: projects, Total: total, Done: done, Overdue: overdue, High: high,
		Hours: fmt.Sprintf("%.1f", float64(totalSeconds)/3600),
	}
	tmpl := template.Must(template.New("internal-project-report").Funcs(template.FuncMap{
		"memberCount": func(items []models.InternalProjectMember) int { return len(items) },
	}).Parse(internalProjectReportTemplate))
	c.Header("Content-Type", "text/html; charset=utf-8")
	_ = tmpl.Execute(c.Writer, data)
}

const internalProjectReportTemplate = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Internal Project Management Summary</title><style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:36px;font-size:12px}.header{display:flex;justify-content:space-between;border-bottom:3px solid #2563eb;padding-bottom:18px;margin-bottom:24px}.brand{font-size:24px;font-weight:700;color:#2563eb}.subtitle{color:#64748b;margin-top:5px}.meta{text-align:right;color:#64748b}.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:24px}.stat{border:1px solid #e2e8f0;border-radius:10px;padding:14px}.stat strong{display:block;font-size:22px;color:#0f172a}.stat span{color:#64748b}.section{margin-top:20px}.section h2{font-size:15px;margin-bottom:10px}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #e2e8f0;text-align:left}th{background:#f8fafc;color:#475569;font-size:11px}.progress{height:7px;background:#e2e8f0;border-radius:10px;overflow:hidden}.progress i{display:block;height:100%;background:#2563eb}@media print{body{margin:15mm}.no-print{display:none}} </style></head><body>
<div class="header"><div><div class="brand">NEXONE</div><div class="subtitle">Internal Project Management Summary</div></div><div class="meta">Printed {{.PrintedAt}}{{if .From}}<br>Period {{.From}} - {{.To}}{{end}}</div></div>
<div class="stats"><div class="stat"><strong>{{len .Projects}}</strong><span>Projects</span></div><div class="stat"><strong>{{.Total}}</strong><span>Total Tasks</span></div><div class="stat"><strong>{{.Done}}</strong><span>Completed</span></div><div class="stat"><strong>{{.Overdue}}</strong><span>Overdue</span></div><div class="stat"><strong>{{.High}}</strong><span>High Priority</span></div><div class="stat"><strong>{{.Hours}}h</strong><span>Tracked Hours</span></div></div>
<div class="section"><h2>Project Health</h2><table><thead><tr><th>Project</th><th>Owner</th><th>Status</th><th>Members</th><th>Progress</th></tr></thead><tbody>{{range .Projects}}<tr><td>{{.Name}}</td><td>{{if .Owner}}{{.Owner.Name}}{{end}}</td><td>{{.Status}}</td><td>{{memberCount .Members}}</td><td><div>{{.Progress}}%</div><div class="progress"><i style="width:{{.Progress}}%"></i></div></td></tr>{{else}}<tr><td colspan="5">No projects available.</td></tr>{{end}}</tbody></table></div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300))</script></body></html>`
