package handlers

import (
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/cbqa/backend/internal/models"
	"github.com/cbqa/backend/internal/scheduler"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type InternalProjectHandler struct{ db *gorm.DB }

func NewInternalProjectHandler(db *gorm.DB) *InternalProjectHandler {
	return &InternalProjectHandler{db: db}
}

func (h *InternalProjectHandler) canAccess(c *gin.Context, projectID uint) bool {
	if getUserRole(c) == "admin" {
		return true
	}
	var count int64
	h.db.Model(&models.InternalProjectMember{}).
		Where("project_id = ? AND user_id = ?", projectID, getUserID(c)).
		Count(&count)
	return count > 0
}

func (h *InternalProjectHandler) canManage(c *gin.Context, project models.InternalProject) bool {
	return getUserRole(c) == "admin" || project.OwnerID == getUserID(c)
}

func (h *InternalProjectHandler) loadProject(id uint) (models.InternalProject, error) {
	var project models.InternalProject
	err := h.db.
		Preload("Owner").
		Preload("Members.User").
		Preload("Columns", func(db *gorm.DB) *gorm.DB { return db.Order("position asc, id asc") }).
		First(&project, id).Error
	return project, err
}

func (h *InternalProjectHandler) List(c *gin.Context) {
	var q PaginationQuery
	c.ShouldBindQuery(&q)

	query := h.db.Model(&models.InternalProject{})
	if getUserRole(c) != "admin" {
		query = query.Joins("JOIN internal_project_members ipm ON ipm.project_id = internal_projects.id AND ipm.deleted_at IS NULL").
			Where("ipm.user_id = ?", getUserID(c))
	}
	if search := strings.TrimSpace(q.Q); search != "" {
		query = query.Where("internal_projects.name ILIKE ? OR internal_projects.description ILIKE ?", "%"+search+"%", "%"+search+"%")
	}
	if status := strings.TrimSpace(c.Query("status")); status != "" {
		query = query.Where("internal_projects.status = ?", status)
	}

	var total int64
	query.Distinct("internal_projects.id").Count(&total)

	var projects []models.InternalProject
	query.Distinct("internal_projects.*").
		Preload("Owner").
		Preload("Members.User").
		Order("internal_projects.created_at desc").
		Scopes(paginate(q)).
		Find(&projects)

	c.JSON(http.StatusOK, gin.H{"data": projects, "total": total, "page": q.Page, "limit": q.Limit})
}

func (h *InternalProjectHandler) Dashboard(c *gin.Context) {
	projectID, _ := strconv.ParseUint(c.Query("project_id"), 10, 64)
	userID, _ := strconv.ParseUint(c.Query("user_id"), 10, 64)
	days, _ := strconv.Atoi(c.DefaultQuery("days", "30"))
	if days != 7 && days != 30 && days != 90 {
		days = 30
	}

	query := h.db.Model(&models.InternalProject{})
	if getUserRole(c) != "admin" {
		query = query.Joins("JOIN internal_project_members access_member ON access_member.project_id = internal_projects.id AND access_member.deleted_at IS NULL").
			Where("access_member.user_id = ?", getUserID(c))
	}
	if projectID > 0 {
		query = query.Where("internal_projects.id = ?", uint(projectID))
	}
	if userID > 0 {
		query = query.Joins("JOIN internal_project_members filter_member ON filter_member.project_id = internal_projects.id AND filter_member.deleted_at IS NULL").
			Where("filter_member.user_id = ?", uint(userID))
	}

	var projects []models.InternalProject
	if err := query.Distinct("internal_projects.*").
		Preload("Owner").Preload("Members.User").
		Preload("Tasks.Column").Preload("Tasks.Assignees.User").
		Order("internal_projects.updated_at desc").Find(&projects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	statusOrder := []string{"backlog", "todo", "development", "review", "uat", "deploy_to_production", "done"}
	statusLabels := map[string]string{
		"backlog": "Backlog", "todo": "To Do", "development": "Development", "review": "Review",
		"uat": "UAT", "deploy_to_production": "Deploy To Production", "done": "Done",
	}
	statusCounts := map[string]int{}
	memberWorkload := map[uint]map[string]any{}
	projectSummaries := make([]gin.H, 0, len(projects))
	attentionTasks := make([]gin.H, 0)
	totalTasks := 0
	doneTasks := 0
	overdueTasks := 0
	highPriorityTasks := 0
	now := time.Now()
	horizon := now.AddDate(0, 0, days)

	for _, project := range projects {
		projectTotal := 0
		projectDone := 0
		projectOverdue := 0
		projectHigh := 0
		for _, task := range project.Tasks {
			if userID > 0 {
				assigned := false
				for _, assignee := range task.Assignees {
					if assignee.UserID == uint(userID) {
						assigned = true
						break
					}
				}
				if !assigned {
					continue
				}
			}

			projectTotal++
			totalTasks++
			statusCounts[task.Status]++
			isDone := task.Status == "done"
			isOverdue := task.DueDate != nil && task.DueDate.Before(now) && !isDone
			isHigh := (task.Priority == "high" || task.Priority == "urgent") && !isDone
			if isDone {
				projectDone++
				doneTasks++
			}
			if isOverdue {
				projectOverdue++
				overdueTasks++
			}
			if isHigh {
				projectHigh++
				highPriorityTasks++
			}

			for _, assignee := range task.Assignees {
				if assignee.User == nil {
					continue
				}
				// If user filter active, only show that user's workload
				if userID > 0 && assignee.UserID != uint(userID) {
					continue
				}
				entry, exists := memberWorkload[assignee.UserID]
				if !exists {
					entry = map[string]any{
						"user_id": assignee.UserID, "name": assignee.User.Name, "email": assignee.User.Email,
						"total": 0, "open": 0, "done": 0, "overdue": 0,
					}
					memberWorkload[assignee.UserID] = entry
				}
				entry["total"] = entry["total"].(int) + 1
				if isDone {
					entry["done"] = entry["done"].(int) + 1
				} else {
					entry["open"] = entry["open"].(int) + 1
				}
				if isOverdue {
					entry["overdue"] = entry["overdue"].(int) + 1
				}
			}

			if !isDone && (isOverdue || isHigh || (task.DueDate != nil && !task.DueDate.After(horizon))) {
				attentionTasks = append(attentionTasks, gin.H{
					"id": task.ID, "project_id": project.ID, "project_name": project.Name,
					"title": task.Title, "status": task.Status, "priority": task.Priority,
					"due_date": task.DueDate, "overdue": isOverdue, "assignees": task.Assignees,
				})
			}
		}

		progress := 0
		if projectTotal > 0 {
			progress = projectDone * 100 / projectTotal
		}
		projectSummaries = append(projectSummaries, gin.H{
			"id": project.ID, "name": project.Name, "status": project.Status, "progress": progress,
			"owner": project.Owner, "members": project.Members, "total_tasks": projectTotal,
			"done_tasks": projectDone, "overdue_tasks": projectOverdue, "high_priority_tasks": projectHigh,
			"updated_at": project.UpdatedAt,
		})
	}

	distribution := make([]gin.H, 0, len(statusOrder))
	for _, status := range statusOrder {
		distribution = append(distribution, gin.H{"status": status, "label": statusLabels[status], "count": statusCounts[status]})
	}
	workload := make([]map[string]any, 0, len(memberWorkload))
	for _, entry := range memberWorkload {
		workload = append(workload, entry)
	}
	sort.Slice(workload, func(i, j int) bool {
		return workload[i]["open"].(int) > workload[j]["open"].(int)
	})
	sort.Slice(attentionTasks, func(i, j int) bool {
		leftOverdue := attentionTasks[i]["overdue"].(bool)
		rightOverdue := attentionTasks[j]["overdue"].(bool)
		if leftOverdue != rightOverdue {
			return leftOverdue
		}
		leftDate, leftOK := attentionTasks[i]["due_date"].(*time.Time)
		rightDate, rightOK := attentionTasks[j]["due_date"].(*time.Time)
		if !leftOK || leftDate == nil {
			return false
		}
		if !rightOK || rightDate == nil {
			return true
		}
		return leftDate.Before(*rightDate)
	})
	if len(attentionTasks) > 12 {
		attentionTasks = attentionTasks[:12]
	}

	activeProjects := 0
	archivedProjects := 0
	for _, project := range projects {
		if project.Status == "active" {
			activeProjects++
		} else if project.Status == "archived" {
			archivedProjects++
		}
	}
	overallProgress := 0
	if totalTasks > 0 {
		overallProgress = doneTasks * 100 / totalTasks
	}

	// Count my tasks (tasks assigned to current user)
	currentUserID := getUserID(c)
	myTasksCount := 0
	for _, project := range projects {
		for _, task := range project.Tasks {
			isDone := task.Status == "done"
			if !isDone {
				for _, assignee := range task.Assignees {
					if assignee.UserID == currentUserID {
						myTasksCount++
						break
					}
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"summary": gin.H{
			"total_projects": len(projects), "active_projects": activeProjects, "archived_projects": archivedProjects,
			"total_tasks": totalTasks, "done_tasks": doneTasks, "overdue_tasks": overdueTasks,
			"high_priority_tasks": highPriorityTasks, "overall_progress": overallProgress, "my_tasks": myTasksCount,
		},
		"status_distribution": distribution,
		"projects":            projectSummaries,
		"workload":            workload,
		"attention_tasks":     attentionTasks,
		"days":                days,
	})
}

func (h *InternalProjectHandler) Create(c *gin.Context) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	if len(req.Name) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Project name must contain at least 2 characters"})
		return
	}

	resetSequenceIfEmpty(h.db, "internal_projects")
	project := models.InternalProject{
		Name:        req.Name,
		Description: req.Description,
		OwnerID:     getUserID(c),
		Status:      "active",
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&project).Error; err != nil {
			return err
		}
		member := models.InternalProjectMember{ProjectID: project.ID, UserID: project.OwnerID, Role: "owner"}
		if err := tx.Create(&member).Error; err != nil {
			return err
		}
		columns := []models.InternalProjectColumn{
			{ProjectID: project.ID, Key: "backlog", Label: "Backlog", Color: "slate", Position: 1},
			{ProjectID: project.ID, Key: "todo", Label: "To Do", Color: "blue", Position: 2},
			{ProjectID: project.ID, Key: "development", Label: "Development", Color: "yellow", Position: 3},
			{ProjectID: project.ID, Key: "review", Label: "Review", Color: "purple", Position: 4},
			{ProjectID: project.ID, Key: "uat", Label: "UAT", Color: "cyan", Position: 5},
			{ProjectID: project.ID, Key: "deploy_to_production", Label: "Deploy To Production", Color: "orange", Position: 6},
			{ProjectID: project.ID, Key: "done", Label: "Done", Color: "green", Position: 7},
		}
		return tx.Create(&columns).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	recordAudit(h.db, c, "create", "internal_project", project.ID, project.Name)
	created, _ := h.loadProject(project.ID)
	c.JSON(http.StatusCreated, created)
}

func (h *InternalProjectHandler) Get(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	if !h.canAccess(c, id) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this internal project"})
		return
	}
	project, err := h.loadProject(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Internal project not found"})
		return
	}
	c.JSON(http.StatusOK, project)
}

func (h *InternalProjectHandler) Update(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	var project models.InternalProject
	if err := h.db.First(&project, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Internal project not found"})
		return
	}
	if !h.canManage(c, project) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the project owner or an admin can update this project"})
		return
	}
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Status      string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Project name must contain at least 2 characters"})
		return
	}
	if req.Status == "" {
		req.Status = project.Status
	}
	if req.Status != "active" && req.Status != "archived" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Status must be active or archived"})
		return
	}
	project.Name = req.Name
	project.Description = strings.TrimSpace(req.Description)
	project.Status = req.Status
	if err := h.db.Save(&project).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	recordAudit(h.db, c, "update", "internal_project", project.ID, project.Name)
	updated, _ := h.loadProject(project.ID)
	c.JSON(http.StatusOK, updated)
}

func (h *InternalProjectHandler) Delete(c *gin.Context) {
	if getUserRole(c) != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can delete internal projects"})
		return
	}
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	var project models.InternalProject
	if err := h.db.First(&project, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Internal project not found"})
		return
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		var taskIDs []uint
		if err := tx.Unscoped().Model(&models.InternalTask{}).Where("project_id = ?", id).Pluck("id", &taskIDs).Error; err != nil {
			return err
		}
		if len(taskIDs) > 0 {
			var commentIDs []uint
			if err := tx.Unscoped().Model(&models.InternalTaskComment{}).Where("task_id IN ?", taskIDs).Pluck("id", &commentIDs).Error; err != nil {
				return err
			}
			if len(commentIDs) > 0 {
				if err := tx.Where("comment_id IN ?", commentIDs).Delete(&models.InternalTaskCommentMention{}).Error; err != nil {
					return err
				}
			}
			for _, relation := range []any{&models.InternalTaskComment{}, &models.InternalTaskAttachment{}, &models.InternalTaskReferenceLink{}, &models.InternalTaskActivity{}, &models.InternalSubtask{}} {
				if err := tx.Unscoped().Where("task_id IN ?", taskIDs).Delete(relation).Error; err != nil {
					return err
				}
			}
			if err := tx.Unscoped().Where("task_id IN ?", taskIDs).Delete(&models.InternalTimeLog{}).Error; err != nil {
				return err
			}
			if err := tx.Where("task_id IN ?", taskIDs).Delete(&models.InternalTaskAssignee{}).Error; err != nil {
				return err
			}
			if err := tx.Where("entity_type = ? AND entity_id IN ?", "internal_task", taskIDs).Delete(&models.Notification{}).Error; err != nil {
				return err
			}
		}
		if err := tx.Where("entity_type = ? AND entity_id = ?", "internal_project", id).Delete(&models.Notification{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("project_id = ?", id).Delete(&models.InternalTask{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("project_id = ?", id).Delete(&models.InternalProjectColumn{}).Error; err != nil {
			return err
		}
		if err := tx.Unscoped().Where("project_id = ?", id).Delete(&models.InternalProjectMember{}).Error; err != nil {
			return err
		}
		return tx.Unscoped().Delete(&project).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	recordAudit(h.db, c, "delete", "internal_project", project.ID, project.Name)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *InternalProjectHandler) ListMembers(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	if !h.canAccess(c, id) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this internal project"})
		return
	}
	var members []models.InternalProjectMember
	h.db.Preload("User").Where("project_id = ?", id).Order("role desc, created_at asc").Find(&members)
	c.JSON(http.StatusOK, gin.H{"data": members})
}

func (h *InternalProjectHandler) AddMember(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	var project models.InternalProject
	if err := h.db.First(&project, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Internal project not found"})
		return
	}
	if !h.canManage(c, project) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the project owner or an admin can add members"})
		return
	}
	var req struct {
		UserID uint `json:"user_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.UserID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid user_id is required"})
		return
	}
	var user models.User
	if err := h.db.Where("id = ? AND is_active = true", req.UserID).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Active user not found"})
		return
	}
	var member models.InternalProjectMember
	err := h.db.Unscoped().Where("project_id = ? AND user_id = ?", id, req.UserID).First(&member).Error
	if err == nil {
		if member.DeletedAt.Valid {
			if err := h.db.Unscoped().Model(&member).Updates(map[string]any{"deleted_at": nil, "role": "member", "updated_at": time.Now()}).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		} else {
			c.JSON(http.StatusConflict, gin.H{"error": "User is already a project member"})
			return
		}
	} else if err == gorm.ErrRecordNotFound {
		member = models.InternalProjectMember{ProjectID: id, UserID: req.UserID, Role: "member"}
		if err := h.db.Create(&member).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	h.db.Preload("User").First(&member, member.ID)
	recordAudit(h.db, c, "add_member", "internal_project", project.ID, user.Name)
	if req.UserID != getUserID(c) {
		_ = createPersonalNotification(h.db, req.UserID, "project_member", "Added to internal project", "You were added to "+project.Name, fmt.Sprintf("/internal-project/projects/%d", project.ID), "internal_project", project.ID)
	}
	c.JSON(http.StatusCreated, member)
}

func (h *InternalProjectHandler) RemoveMember(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	userID, valid := parseUintParam(c, "userId")
	if !valid {
		return
	}
	var project models.InternalProject
	if err := h.db.First(&project, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Internal project not found"})
		return
	}
	if !h.canManage(c, project) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the project owner or an admin can remove members"})
		return
	}
	if userID == project.OwnerID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Project owner cannot be removed"})
		return
	}
	result := h.db.Where("project_id = ? AND user_id = ?", id, userID).Delete(&models.InternalProjectMember{})
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Project member not found"})
		return
	}
	recordAudit(h.db, c, "remove_member", "internal_project", project.ID, "user")
	c.JSON(http.StatusOK, gin.H{"message": "Member removed"})
}

type internalTaskPayload struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Category    string     `json:"category"`
	Priority    string     `json:"priority"`
	DueDate     *time.Time `json:"due_date"`
	ColumnID    uint       `json:"column_id"`
	AssigneeIDs []uint     `json:"assignee_ids"`
}

func (h *InternalProjectHandler) loadTask(projectID, taskID uint) (models.InternalTask, error) {
	var task models.InternalTask
	err := h.db.Preload("Column").Preload("Creator").Preload("Assignees.User").
		Where("project_id = ?", projectID).First(&task, taskID).Error
	return task, err
}

func (h *InternalProjectHandler) loadAccessibleTask(c *gin.Context, taskID uint) (models.InternalTask, bool) {
	var task models.InternalTask
	if err := h.db.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return task, false
	}
	if !h.canAccess(c, task.ProjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return task, false
	}
	return task, true
}

func recordInternalTaskActivity(tx *gorm.DB, taskID, userID uint, action, description string) error {
	return tx.Create(&models.InternalTaskActivity{
		TaskID: taskID, UserID: userID, Action: action, Description: description,
	}).Error
}

func (h *InternalProjectHandler) validateTaskInput(tx *gorm.DB, projectID uint, req internalTaskPayload) (models.InternalProjectColumn, error) {
	var column models.InternalProjectColumn
	if err := tx.Where("id = ? AND project_id = ?", req.ColumnID, projectID).First(&column).Error; err != nil {
		return column, gorm.ErrRecordNotFound
	}
	if req.Priority != "low" && req.Priority != "medium" && req.Priority != "high" && req.Priority != "urgent" {
		return column, gorm.ErrInvalidData
	}
	if len(req.AssigneeIDs) > 0 {
		var count int64
		if err := tx.Model(&models.InternalProjectMember{}).
			Where("project_id = ? AND user_id IN ?", projectID, req.AssigneeIDs).
			Distinct("user_id").Count(&count).Error; err != nil {
			return column, err
		}
		unique := map[uint]struct{}{}
		for _, userID := range req.AssigneeIDs {
			if userID > 0 {
				unique[userID] = struct{}{}
			}
		}
		if int64(len(unique)) != count {
			return column, gorm.ErrForeignKeyViolated
		}
	}
	return column, nil
}

func (h *InternalProjectHandler) replaceTaskAssignees(tx *gorm.DB, taskID uint, assigneeIDs []uint) error {
	if err := tx.Where("task_id = ?", taskID).Delete(&models.InternalTaskAssignee{}).Error; err != nil {
		return err
	}
	seen := map[uint]struct{}{}
	assignees := make([]models.InternalTaskAssignee, 0, len(assigneeIDs))
	for _, userID := range assigneeIDs {
		if userID == 0 {
			continue
		}
		if _, exists := seen[userID]; exists {
			continue
		}
		seen[userID] = struct{}{}
		assignees = append(assignees, models.InternalTaskAssignee{TaskID: taskID, UserID: userID})
	}
	if len(assignees) == 0 {
		return nil
	}
	return tx.Create(&assignees).Error
}

func recalcInternalProjectProgress(tx *gorm.DB, projectID uint) error {
	var total, done int64
	if err := tx.Model(&models.InternalTask{}).Where("project_id = ?", projectID).Count(&total).Error; err != nil {
		return err
	}
	if total > 0 {
		if err := tx.Model(&models.InternalTask{}).
			Joins("JOIN internal_project_columns ipc ON ipc.id = internal_tasks.column_id").
			Where("internal_tasks.project_id = ? AND ipc.key = ?", projectID, "done").Count(&done).Error; err != nil {
			return err
		}
	}
	progress := 0
	if total > 0 {
		progress = int(done * 100 / total)
	}
	return tx.Model(&models.InternalProject{}).Where("id = ?", projectID).Update("progress", progress).Error
}

func (h *InternalProjectHandler) ListTasks(c *gin.Context) {
	projectID, ok := mustGetID(c)
	if !ok {
		return
	}
	if !h.canAccess(c, projectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this internal project"})
		return
	}
	var tasks []models.InternalTask
	query := h.db.Preload("Column").Preload("Creator").Preload("Assignees.User").Where("project_id = ?", projectID)
	if search := strings.TrimSpace(c.Query("q")); search != "" {
		query = query.Where("title ILIKE ? OR description ILIKE ?", "%"+search+"%", "%"+search+"%")
	}
	query.Order("column_id asc, position asc, id asc").Find(&tasks)
	c.JSON(http.StatusOK, gin.H{"data": tasks, "total": len(tasks)})
}

func (h *InternalProjectHandler) CreateTask(c *gin.Context) {
	projectID, ok := mustGetID(c)
	if !ok {
		return
	}
	if !h.canAccess(c, projectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this internal project"})
		return
	}
	var req internalTaskPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	if len(req.Title) < 2 || req.ColumnID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Task title and column are required"})
		return
	}
	if req.Priority == "" {
		req.Priority = "medium"
	}
	var task models.InternalTask
	err := h.db.Transaction(func(tx *gorm.DB) error {
		column, err := h.validateTaskInput(tx, projectID, req)
		if err != nil {
			return err
		}
		var maxPosition int
		tx.Model(&models.InternalTask{}).Where("project_id = ? AND column_id = ?", projectID, column.ID).
			Select("COALESCE(MAX(position), 0)").Scan(&maxPosition)
		task = models.InternalTask{
			ProjectID: projectID, ColumnID: column.ID, Title: req.Title,
			Description: strings.TrimSpace(req.Description), Category: strings.TrimSpace(req.Category),
			Status: column.Key, Priority: req.Priority, DueDate: req.DueDate,
			CreatorID: getUserID(c), Position: maxPosition + 1,
		}
		if err := tx.Create(&task).Error; err != nil {
			return err
		}
		if err := h.replaceTaskAssignees(tx, task.ID, req.AssigneeIDs); err != nil {
			return err
		}
		if err := createPersonalNotifications(tx, req.AssigneeIDs, getUserID(c), "task_assignment", "New internal task assignment", task.Title, fmt.Sprintf("/internal-project/projects/%d", projectID), "internal_task", task.ID); err != nil {
			return err
		}
		if err := recordInternalTaskActivity(tx, task.ID, getUserID(c), "created", "Task created"); err != nil {
			return err
		}
		return recalcInternalProjectProgress(tx, projectID)
	})
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project column"})
		} else if err == gorm.ErrInvalidData {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid priority"})
		} else if err == gorm.ErrForeignKeyViolated {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Assignees must be project members"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	recordAudit(h.db, c, "create", "internal_task", task.ID, task.Title)
	created, _ := h.loadTask(projectID, task.ID)
	c.JSON(http.StatusCreated, created)
}

func (h *InternalProjectHandler) UpdateTask(c *gin.Context) {
	projectID, ok := mustGetID(c)
	if !ok {
		return
	}
	taskID, valid := parseUintParam(c, "taskId")
	if !valid {
		return
	}
	if !h.canAccess(c, projectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this internal project"})
		return
	}
	var req internalTaskPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	if len(req.Title) < 2 || req.ColumnID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Task title and column are required"})
		return
	}
	if req.Priority == "" {
		req.Priority = "medium"
	}
	var task models.InternalTask
	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ? AND project_id = ?", taskID, projectID).First(&task).Error; err != nil {
			return err
		}
		oldStatus := task.Status
		var oldAssigneeIDs []uint
		if err := tx.Model(&models.InternalTaskAssignee{}).Where("task_id = ?", task.ID).Pluck("user_id", &oldAssigneeIDs).Error; err != nil {
			return err
		}
		column, err := h.validateTaskInput(tx, projectID, req)
		if err != nil {
			return err
		}
		if task.ColumnID != column.ID {
			var maxPosition int
			tx.Model(&models.InternalTask{}).Where("project_id = ? AND column_id = ?", projectID, column.ID).
				Select("COALESCE(MAX(position), 0)").Scan(&maxPosition)
			task.Position = maxPosition + 1
		}
		task.ColumnID = column.ID
		task.Status = column.Key
		task.Title = req.Title
		task.Description = strings.TrimSpace(req.Description)
		task.Category = strings.TrimSpace(req.Category)
		task.Priority = req.Priority
		task.DueDate = req.DueDate
		if err := tx.Save(&task).Error; err != nil {
			return err
		}
		if err := h.replaceTaskAssignees(tx, task.ID, req.AssigneeIDs); err != nil {
			return err
		}
		oldAssignees := map[uint]struct{}{}
		for _, userID := range oldAssigneeIDs {
			oldAssignees[userID] = struct{}{}
		}
		newAssignments := make([]uint, 0)
		for _, userID := range req.AssigneeIDs {
			if _, exists := oldAssignees[userID]; !exists {
				newAssignments = append(newAssignments, userID)
			}
		}
		if err := createPersonalNotifications(tx, newAssignments, getUserID(c), "task_assignment", "New internal task assignment", task.Title, fmt.Sprintf("/internal-project/projects/%d", projectID), "internal_task", task.ID); err != nil {
			return err
		}
		if oldStatus != task.Status {
			recipients := append(append([]uint{}, oldAssigneeIDs...), req.AssigneeIDs...)
			if err := createPersonalNotifications(tx, recipients, getUserID(c), "task_status", "Internal task status changed", fmt.Sprintf("%s moved to %s", task.Title, column.Label), fmt.Sprintf("/internal-project/projects/%d", projectID), "internal_task", task.ID); err != nil {
				return err
			}
		}
		if err := recordInternalTaskActivity(tx, task.ID, getUserID(c), "updated", "Task details updated"); err != nil {
			return err
		}
		return recalcInternalProjectProgress(tx, projectID)
	})
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task or column not found"})
		} else if err == gorm.ErrInvalidData {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid priority"})
		} else if err == gorm.ErrForeignKeyViolated {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Assignees must be project members"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}
	recordAudit(h.db, c, "update", "internal_task", task.ID, task.Title)
	updated, _ := h.loadTask(projectID, task.ID)
	c.JSON(http.StatusOK, updated)
}

func (h *InternalProjectHandler) MoveTask(c *gin.Context) {
	projectID, ok := mustGetID(c)
	if !ok {
		return
	}
	taskID, valid := parseUintParam(c, "taskId")
	if !valid {
		return
	}
	if !h.canAccess(c, projectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this internal project"})
		return
	}
	var req struct {
		ColumnID uint `json:"column_id"`
		Position int  `json:"position"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.ColumnID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid column_id is required"})
		return
	}
	var task models.InternalTask
	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ? AND project_id = ?", taskID, projectID).First(&task).Error; err != nil {
			return err
		}
		var column models.InternalProjectColumn
		if err := tx.Where("id = ? AND project_id = ?", req.ColumnID, projectID).First(&column).Error; err != nil {
			return err
		}
		var tasks []models.InternalTask
		if err := tx.Where("project_id = ? AND column_id = ? AND id <> ?", projectID, column.ID, task.ID).
			Order("position asc, id asc").Find(&tasks).Error; err != nil {
			return err
		}
		position := req.Position
		if position < 0 {
			position = 0
		}
		if position > len(tasks) {
			position = len(tasks)
		}
		tasks = append(tasks, models.InternalTask{})
		copy(tasks[position+1:], tasks[position:])
		tasks[position] = task
		for index := range tasks {
			tasks[index].ColumnID = column.ID
			tasks[index].Status = column.Key
			tasks[index].Position = index + 1
			if err := tx.Model(&models.InternalTask{}).Where("id = ?", tasks[index].ID).
				Updates(map[string]any{"column_id": column.ID, "status": column.Key, "position": index + 1}).Error; err != nil {
				return err
			}
		}
		var assigneeIDs []uint
		if err := tx.Model(&models.InternalTaskAssignee{}).Where("task_id = ?", task.ID).Pluck("user_id", &assigneeIDs).Error; err != nil {
			return err
		}
		if err := createPersonalNotifications(tx, assigneeIDs, getUserID(c), "task_status", "Internal task status changed", fmt.Sprintf("%s moved to %s", task.Title, column.Label), fmt.Sprintf("/internal-project/projects/%d", projectID), "internal_task", task.ID); err != nil {
			return err
		}
		if err := recordInternalTaskActivity(tx, task.ID, getUserID(c), "moved", "Task moved to "+column.Label); err != nil {
			return err
		}
		return recalcInternalProjectProgress(tx, projectID)
	})
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task or column not found"})
		return
	}
	recordAudit(h.db, c, "move", "internal_task", task.ID, task.Title)
	moved, _ := h.loadTask(projectID, task.ID)
	c.JSON(http.StatusOK, moved)
}

func (h *InternalProjectHandler) DeleteTask(c *gin.Context) {
	projectID, ok := mustGetID(c)
	if !ok {
		return
	}
	taskID, valid := parseUintParam(c, "taskId")
	if !valid {
		return
	}
	if !h.canAccess(c, projectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this internal project"})
		return
	}
	var task models.InternalTask
	err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("id = ? AND project_id = ?", taskID, projectID).First(&task).Error; err != nil {
			return err
		}
		if getUserRole(c) != "admin" {
			var project models.InternalProject
			if err := tx.First(&project, projectID).Error; err != nil {
				return err
			}
			if project.OwnerID != getUserID(c) && task.CreatorID != getUserID(c) {
				return gorm.ErrInvalidTransaction
			}
		}
		if err := tx.Where("task_id = ?", task.ID).Delete(&models.InternalTaskAssignee{}).Error; err != nil {
			return err
		}
		var commentIDs []uint
		if err := tx.Model(&models.InternalTaskComment{}).Where("task_id = ?", task.ID).Pluck("id", &commentIDs).Error; err != nil {
			return err
		}
		if len(commentIDs) > 0 {
			if err := tx.Where("comment_id IN ?", commentIDs).Delete(&models.InternalTaskCommentMention{}).Error; err != nil {
				return err
			}
		}
		for _, relation := range []any{&models.InternalTaskComment{}, &models.InternalTaskAttachment{}, &models.InternalTaskReferenceLink{}, &models.InternalTaskActivity{}, &models.InternalTimeLog{}, &models.InternalSubtask{}} {
			if err := tx.Where("task_id = ?", task.ID).Delete(relation).Error; err != nil {
				return err
			}
		}
		if err := tx.Where("entity_type = ? AND entity_id = ?", "internal_task", task.ID).Delete(&models.Notification{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&task).Error; err != nil {
			return err
		}
		return recalcInternalProjectProgress(tx, projectID)
	})
	if err != nil {
		if err == gorm.ErrInvalidTransaction {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only the project owner, task creator, or an admin can delete this task"})
		} else {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		}
		return
	}
	recordAudit(h.db, c, "delete", "internal_task", task.ID, task.Title)
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ─── TIME TRACKING ────────────────────────────────────────────────────────────

// ClockIn - Start timer untuk task
func (h *InternalProjectHandler) ClockIn(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if taskID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	userID := getUserID(c)
	if !scheduler.ClockInAllowed(time.Now()) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Clock in is unavailable after the daily 23:30 WIB cutoff"})
		return
	}
	var task models.InternalTask
	if err := h.db.Preload("Project").First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	// Check access
	if !h.canAccess(c, task.ProjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Check if user already has active timer
	var activeLog models.InternalTimeLog
	if err := h.db.Where("user_id = ? AND clock_out IS NULL", userID).First(&activeLog).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You already have an active timer. Please clock out first.", "active_task_id": activeLog.TaskID})
		return
	}

	// Create new time log
	now := time.Now()
	log := models.InternalTimeLog{
		TaskID:          uint(taskID),
		UserID:          userID,
		ClockIn:         now,
		DurationSeconds: 0,
	}

	if err := h.db.Create(&log).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clock in"})
		return
	}

	// Reload with associations
	h.db.Preload("Task").Preload("User").First(&log, log.ID)

	c.JSON(http.StatusOK, gin.H{"data": log})
}

func internalProjectLocation() *time.Location {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		return time.FixedZone("WIB", 7*60*60)
	}
	return location
}

func parseInternalProjectDate(value string) (time.Time, error) {
	return time.ParseInLocation("2006-01-02", value, internalProjectLocation())
}

// GetTimeSummary returns completed tracked hours for today and the current
// week across projects visible to the current user.
func (h *InternalProjectHandler) GetTimeSummary(c *gin.Context) {
	projectID, _ := strconv.ParseUint(c.Query("project_id"), 10, 64)
	userID, _ := strconv.ParseUint(c.Query("user_id"), 10, 64)
	location := internalProjectLocation()
	now := time.Now().In(location)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location)
	weekStart := todayStart.AddDate(0, 0, -((int(now.Weekday()) + 6) % 7))
	tomorrow := todayStart.AddDate(0, 0, 1)

	baseQuery := func(from time.Time) *gorm.DB {
		query := h.db.Table("internal_time_logs itl").
			Joins("JOIN internal_tasks it ON it.id = itl.task_id AND it.deleted_at IS NULL").
			Where("itl.deleted_at IS NULL AND itl.clock_out IS NOT NULL").
			Where("it.project_id IN (?)", h.accessibleInternalProjectIDs(c)).
			Where("itl.clock_in >= ? AND itl.clock_in < ?", from, tomorrow)
		if projectID > 0 {
			query = query.Where("it.project_id = ?", uint(projectID))
		}
		if userID > 0 {
			query = query.Where("itl.user_id = ?", uint(userID))
		}
		return query
	}

	var todaySeconds, weekSeconds int64
	if err := baseQuery(todayStart).Select("COALESCE(SUM(itl.duration_seconds), 0)").Scan(&todaySeconds).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load today's tracked hours"})
		return
	}
	if err := baseQuery(weekStart).Select("COALESCE(SUM(itl.duration_seconds), 0)").Scan(&weekSeconds).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load weekly tracked hours"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"today_seconds": todaySeconds,
		"week_seconds":  weekSeconds,
		"timezone":      "Asia/Jakarta",
		"today":         todayStart.Format("2006-01-02"),
		"week_from":     weekStart.Format("2006-01-02"),
	})
}

// ClockOut - Stop timer untuk task
func (h *InternalProjectHandler) ClockOut(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if taskID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	userID := getUserID(c)
	var log models.InternalTimeLog
	if err := h.db.Where("task_id = ? AND user_id = ? AND clock_out IS NULL", taskID, userID).First(&log).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active timer found for this task"})
		return
	}

	// Calculate duration
	now := time.Now()
	duration := int64(now.Sub(log.ClockIn).Seconds())

	log.ClockOut = &now
	log.DurationSeconds = duration

	if err := h.db.Save(&log).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clock out"})
		return
	}

	// Reload with associations
	h.db.Preload("Task").Preload("User").First(&log, log.ID)

	c.JSON(http.StatusOK, gin.H{"data": log})
}

// GetActiveLog - Get user's active timer
func (h *InternalProjectHandler) GetActiveLog(c *gin.Context) {
	userID := getUserID(c)
	var log models.InternalTimeLog
	if err := h.db.Preload("Task.Project").Preload("User").
		Where("user_id = ? AND clock_out IS NULL", userID).
		First(&log).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"data": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": log})
}

// GetTimeLogs - Get time logs untuk task
func (h *InternalProjectHandler) GetTimeLogs(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if taskID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	var task models.InternalTask
	if err := h.db.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	// Check access
	if !h.canAccess(c, task.ProjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var logs []models.InternalTimeLog
	h.db.Where("task_id = ?", taskID).
		Preload("User").
		Order("clock_in desc").
		Find(&logs)

	// Calculate active log if exists
	var activeLog *models.InternalTimeLog
	for i := range logs {
		if logs[i].ClockOut == nil {
			activeLog = &logs[i]
			break
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": logs, "active_log": activeLog})
}

// CreateManualTimeLog - Buat time log manual
func (h *InternalProjectHandler) CreateManualTimeLog(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if taskID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	var task models.InternalTask
	if err := h.db.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	// Check access
	if !h.canAccess(c, task.ProjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var req struct {
		ClockIn  string `json:"clock_in" binding:"required"`
		ClockOut string `json:"clock_out" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse times
	clockIn, err := time.Parse(time.RFC3339, req.ClockIn)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid clock_in format"})
		return
	}
	clockOut, err := time.Parse(time.RFC3339, req.ClockOut)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid clock_out format"})
		return
	}

	if clockOut.Before(clockIn) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Clock out must be after clock in"})
		return
	}

	// Calculate duration
	duration := int64(clockOut.Sub(clockIn).Seconds())

	log := models.InternalTimeLog{
		TaskID:          uint(taskID),
		UserID:          getUserID(c),
		ClockIn:         clockIn,
		ClockOut:        &clockOut,
		DurationSeconds: duration,
	}

	if err := h.db.Create(&log).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create time log"})
		return
	}

	// Reload with associations
	h.db.Preload("User").First(&log, log.ID)

	c.JSON(http.StatusCreated, gin.H{"data": log})
}

// DeleteTimeLog - Hapus time log
func (h *InternalProjectHandler) DeleteTimeLog(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	logID, _ := strconv.ParseUint(c.Param("logId"), 10, 64)
	if taskID == 0 || logID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var log models.InternalTimeLog
	if err := h.db.First(&log, logID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Time log not found"})
		return
	}

	if log.TaskID != uint(taskID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Time log does not belong to this task"})
		return
	}

	// Get task to check access
	var task models.InternalTask
	if err := h.db.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if !h.canAccess(c, task.ProjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Check access (admin, project owner, or log owner)
	if getUserRole(c) != "admin" && task.CreatorID != getUserID(c) && log.UserID != getUserID(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if err := h.db.Delete(&log).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete time log"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// UpdateTimeLog - Edit clock_in / clock_out dari time log yang sudah ada
func (h *InternalProjectHandler) UpdateTimeLog(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	logID, _ := strconv.ParseUint(c.Param("logId"), 10, 64)
	if taskID == 0 || logID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var log models.InternalTimeLog
	if err := h.db.First(&log, logID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Time log not found"})
		return
	}

	if log.TaskID != uint(taskID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Time log does not belong to this task"})
		return
	}

	var task models.InternalTask
	if err := h.db.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if !h.canAccess(c, task.ProjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if getUserRole(c) != "admin" && task.CreatorID != getUserID(c) && log.UserID != getUserID(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var req struct {
		ClockIn  string `json:"clock_in" binding:"required"`
		ClockOut string `json:"clock_out" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	clockIn, err := time.Parse(time.RFC3339, req.ClockIn)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid clock_in format"})
		return
	}
	clockOut, err := time.Parse(time.RFC3339, req.ClockOut)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid clock_out format"})
		return
	}
	if clockOut.Before(clockIn) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Clock out must be after clock in"})
		return
	}

	log.ClockIn = clockIn
	log.ClockOut = &clockOut
	log.DurationSeconds = int64(clockOut.Sub(clockIn).Seconds())

	if err := h.db.Save(&log).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update time log"})
		return
	}

	h.db.Preload("User").First(&log, log.ID)
	c.JSON(http.StatusOK, gin.H{"data": log})
}

// GetMyTimeLogs - Get time logs user saat ini dengan filter tanggal
func (h *InternalProjectHandler) GetMyTimeLogs(c *gin.Context) {
	userID := getUserID(c)
	from := c.Query("from") // YYYY-MM-DD
	to := c.Query("to")     // YYYY-MM-DD

	query := h.db.Model(&models.InternalTimeLog{}).Where("user_id = ?", userID)

	if from != "" {
		fromTime, err := parseInternalProjectDate(from)
		if err == nil {
			query = query.Where("clock_in >= ?", fromTime)
		}
	}

	if to != "" {
		toTime, err := parseInternalProjectDate(to)
		if err == nil {
			// Add 1 day to include the whole day
			toTime = toTime.AddDate(0, 0, 1)
			query = query.Where("clock_in < ?", toTime)
		}
	}

	var logs []models.InternalTimeLog
	query.Preload("Task.Project").Preload("User").
		Order("clock_in desc").
		Find(&logs)

	c.JSON(http.StatusOK, gin.H{"data": logs})
}

// GetProjectTimeLogs - Get time logs untuk project dengan filter
func (h *InternalProjectHandler) GetProjectTimeLogs(c *gin.Context) {
	projectID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if projectID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid project ID"})
		return
	}

	// Check access
	if !h.canAccess(c, uint(projectID)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	from := c.Query("from")      // YYYY-MM-DD
	to := c.Query("to")          // YYYY-MM-DD
	userID := c.Query("user_id") // optional filter by user

	query := h.db.Model(&models.InternalTimeLog{}).
		Joins("JOIN internal_tasks ON internal_tasks.id = internal_time_logs.task_id").
		Where("internal_tasks.project_id = ?", projectID)

	if from != "" {
		fromTime, err := parseInternalProjectDate(from)
		if err == nil {
			query = query.Where("internal_time_logs.clock_in >= ?", fromTime)
		}
	}

	if to != "" {
		toTime, err := parseInternalProjectDate(to)
		if err == nil {
			toTime = toTime.AddDate(0, 0, 1)
			query = query.Where("internal_time_logs.clock_in < ?", toTime)
		}
	}

	if userID != "" {
		uid, _ := strconv.ParseUint(userID, 10, 64)
		if uid > 0 {
			query = query.Where("internal_time_logs.user_id = ?", uid)
		}
	}

	var logs []models.InternalTimeLog
	query.Preload("Task").Preload("User").
		Order("internal_time_logs.clock_in desc").
		Find(&logs)

	c.JSON(http.StatusOK, gin.H{"data": logs})
}

// ─── SUBTASK ──────────────────────────────────────────────────────────────────

// ListSubtasks - Get subtasks untuk task
func (h *InternalProjectHandler) ListSubtasks(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if taskID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	var task models.InternalTask
	if err := h.db.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	// Check access
	if !h.canAccess(c, task.ProjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var subtasks []models.InternalSubtask
	h.db.Where("task_id = ?", taskID).
		Preload("Assignee").
		Order("position asc, id asc").
		Find(&subtasks)

	c.JSON(http.StatusOK, gin.H{"data": subtasks})
}

// CreateSubtask - Buat subtask baru
func (h *InternalProjectHandler) CreateSubtask(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if taskID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	var task models.InternalTask
	if err := h.db.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	// Check access
	if !h.canAccess(c, task.ProjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var req struct {
		Title       string `json:"title" binding:"required"`
		Description string `json:"description"`
		AssigneeID  *uint  `json:"assignee_id"`
		DueDate     string `json:"due_date"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get max position
	var maxPos int
	h.db.Model(&models.InternalSubtask{}).
		Where("task_id = ?", taskID).
		Select("COALESCE(MAX(position), -1)").
		Scan(&maxPos)

	subtask := models.InternalSubtask{
		TaskID:      uint(taskID),
		Title:       req.Title,
		Description: req.Description,
		Status:      "pending",
		Position:    maxPos + 1,
		AssigneeID:  req.AssigneeID,
	}

	if req.DueDate != "" {
		if t, err := parseInternalProjectDate(req.DueDate); err == nil {
			dueDate := models.FlexTime{Time: t}
			subtask.DueDate = &dueDate
		}
	}

	if err := h.db.Create(&subtask).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subtask"})
		return
	}

	// Reload with associations
	h.db.Preload("Assignee").First(&subtask, subtask.ID)

	c.JSON(http.StatusCreated, gin.H{"data": subtask})
}

// UpdateSubtask - Update subtask
func (h *InternalProjectHandler) UpdateSubtask(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	subtaskID, _ := strconv.ParseUint(c.Param("subtaskId"), 10, 64)
	if taskID == 0 || subtaskID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var subtask models.InternalSubtask
	if err := h.db.First(&subtask, subtaskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Subtask not found"})
		return
	}

	if subtask.TaskID != uint(taskID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Subtask does not belong to this task"})
		return
	}

	// Get task to check access
	var task models.InternalTask
	if err := h.db.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	// Check access
	if !h.canAccess(c, task.ProjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		Status      *string `json:"status"`
		AssigneeID  *uint   `json:"assignee_id"`
		DueDate     *string `json:"due_date"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Title != nil {
		subtask.Title = *req.Title
	}
	if req.Description != nil {
		subtask.Description = *req.Description
	}
	if req.Status != nil {
		subtask.Status = *req.Status
	}
	if req.AssigneeID != nil {
		subtask.AssigneeID = req.AssigneeID
	}
	if req.DueDate != nil {
		if *req.DueDate == "" {
			subtask.DueDate = nil
		} else {
			if t, err := parseInternalProjectDate(*req.DueDate); err == nil {
				dueDate := models.FlexTime{Time: t}
				subtask.DueDate = &dueDate
			}
		}
	}

	if err := h.db.Save(&subtask).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update subtask"})
		return
	}

	// Reload with associations
	h.db.Preload("Assignee").First(&subtask, subtask.ID)

	c.JSON(http.StatusOK, gin.H{"data": subtask})
}

// ToggleSubtaskStatus - Toggle subtask status
func (h *InternalProjectHandler) ToggleSubtaskStatus(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	subtaskID, _ := strconv.ParseUint(c.Param("subtaskId"), 10, 64)
	if taskID == 0 || subtaskID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var subtask models.InternalSubtask
	if err := h.db.First(&subtask, subtaskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Subtask not found"})
		return
	}

	if subtask.TaskID != uint(taskID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Subtask does not belong to this task"})
		return
	}

	// Get task to check access
	var task models.InternalTask
	if err := h.db.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	// Check access
	if !h.canAccess(c, task.ProjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Toggle status
	if subtask.Status == "completed" {
		subtask.Status = "pending"
	} else {
		subtask.Status = "completed"
	}

	if err := h.db.Save(&subtask).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle subtask"})
		return
	}

	h.db.Preload("Assignee").First(&subtask, subtask.ID)

	c.JSON(http.StatusOK, gin.H{"data": subtask})
}

// DeleteSubtask - Hapus subtask
func (h *InternalProjectHandler) DeleteSubtask(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	subtaskID, _ := strconv.ParseUint(c.Param("subtaskId"), 10, 64)
	if taskID == 0 || subtaskID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	var subtask models.InternalSubtask
	if err := h.db.First(&subtask, subtaskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Subtask not found"})
		return
	}

	if subtask.TaskID != uint(taskID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Subtask does not belong to this task"})
		return
	}

	// Get task to check access
	var task models.InternalTask
	if err := h.db.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	// Check access (admin, project owner, or task creator)
	if getUserRole(c) != "admin" && task.CreatorID != getUserID(c) {
		var project models.InternalProject
		if err := h.db.First(&project, task.ProjectID).Error; err == nil {
			if project.OwnerID != getUserID(c) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
				return
			}
		}
	}

	if err := h.db.Delete(&subtask).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete subtask"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

// ReorderSubtasks - Reorder subtasks
func (h *InternalProjectHandler) ReorderSubtasks(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if taskID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}

	var task models.InternalTask
	if err := h.db.First(&task, taskID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	// Check access
	if !h.canAccess(c, task.ProjectID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var req struct {
		SubtaskIDs []uint `json:"subtask_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update positions
	err := h.db.Transaction(func(tx *gorm.DB) error {
		for i, subtaskID := range req.SubtaskIDs {
			if err := tx.Model(&models.InternalSubtask{}).
				Where("id = ? AND task_id = ?", subtaskID, taskID).
				Update("position", i).Error; err != nil {
				return err
			}
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reorder subtasks"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Reordered"})
}

// ─── TASK COLLABORATION ─────────────────────────────────────────────────────

func (h *InternalProjectHandler) ListTaskComments(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || taskID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}
	if _, ok := h.loadAccessibleTask(c, uint(taskID)); !ok {
		return
	}
	var comments []models.InternalTaskComment
	if err := h.db.Preload("User").Preload("Mentions.User").
		Where("task_id = ?", taskID).Order("created_at asc, id asc").Find(&comments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load comments"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": comments})
}

func (h *InternalProjectHandler) CreateTaskComment(c *gin.Context) {
	taskID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || taskID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid task ID"})
		return
	}
	task, ok := h.loadAccessibleTask(c, uint(taskID))
	if !ok {
		return
	}
	var req struct {
		Body             string `json:"body"`
		MentionedUserIDs []uint `json:"mentioned_user_ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Body) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Comment is required"})
		return
	}
	req.Body = strings.TrimSpace(req.Body)
	if len(req.Body) > 5000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Comment is too long"})
		return
	}

	comment := models.InternalTaskComment{TaskID: task.ID, UserID: getUserID(c), Body: req.Body}
	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&comment).Error; err != nil {
			return err
		}
		seen := map[uint]struct{}{}
		mentionedIDs := make([]uint, 0, len(req.MentionedUserIDs))
		for _, userID := range req.MentionedUserIDs {
			if userID == 0 {
				continue
			}
			if _, exists := seen[userID]; exists {
				continue
			}
			var count int64
			if err := tx.Model(&models.InternalProjectMember{}).
				Where("project_id = ? AND user_id = ?", task.ProjectID, userID).Count(&count).Error; err != nil {
				return err
			}
			if count == 0 {
				return gorm.ErrForeignKeyViolated
			}
			seen[userID] = struct{}{}
			mentionedIDs = append(mentionedIDs, userID)
			if err := tx.Create(&models.InternalTaskCommentMention{CommentID: comment.ID, UserID: userID}).Error; err != nil {
				return err
			}
		}
		if err := createPersonalNotifications(tx, mentionedIDs, getUserID(c), "task_mention", "You were mentioned in a task", task.Title, fmt.Sprintf("/internal-project/projects/%d", task.ProjectID), "internal_task", task.ID); err != nil {
			return err
		}
		var recipients []uint
		if err := tx.Model(&models.InternalTaskAssignee{}).Where("task_id = ?", task.ID).Pluck("user_id", &recipients).Error; err != nil {
			return err
		}
		recipients = append(recipients, task.CreatorID)
		for _, mentionedID := range mentionedIDs {
			seen[mentionedID] = struct{}{}
		}
		commentRecipients := make([]uint, 0, len(recipients))
		for _, userID := range recipients {
			if _, mentioned := seen[userID]; !mentioned {
				commentRecipients = append(commentRecipients, userID)
			}
		}
		if err := createPersonalNotifications(tx, commentRecipients, getUserID(c), "task_comment", "New comment on internal task", task.Title, fmt.Sprintf("/internal-project/projects/%d", task.ProjectID), "internal_task", task.ID); err != nil {
			return err
		}
		return recordInternalTaskActivity(tx, task.ID, getUserID(c), "commented", "Added a comment")
	})
	if err != nil {
		if err == gorm.ErrForeignKeyViolated {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Mentioned users must be project members"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add comment"})
		}
		return
	}
	h.db.Preload("User").Preload("Mentions.User").First(&comment, comment.ID)
	c.JSON(http.StatusCreated, comment)
}

func (h *InternalProjectHandler) DeleteTaskComment(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	commentID, _ := strconv.ParseUint(c.Param("commentId"), 10, 64)
	task, ok := h.loadAccessibleTask(c, uint(taskID))
	if !ok {
		return
	}
	var comment models.InternalTaskComment
	if err := h.db.Where("id = ? AND task_id = ?", commentID, task.ID).First(&comment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Comment not found"})
		return
	}
	if !h.canDeleteTaskCollaboration(c, task, comment.UserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("comment_id = ?", comment.ID).Delete(&models.InternalTaskCommentMention{}).Error; err != nil {
			return err
		}
		if err := tx.Delete(&comment).Error; err != nil {
			return err
		}
		return recordInternalTaskActivity(tx, task.ID, getUserID(c), "comment_deleted", "Deleted a comment")
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete comment"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *InternalProjectHandler) ListTaskAttachments(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if _, ok := h.loadAccessibleTask(c, uint(taskID)); !ok {
		return
	}
	var attachments []models.InternalTaskAttachment
	if err := h.db.Preload("File").Preload("UploadedBy").Where("task_id = ?", taskID).
		Order("created_at desc").Find(&attachments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load attachments"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": attachments})
}

func (h *InternalProjectHandler) CreateTaskAttachment(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	task, ok := h.loadAccessibleTask(c, uint(taskID))
	if !ok {
		return
	}
	var req struct {
		FileID uint `json:"file_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.FileID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid file_id is required"})
		return
	}
	var file models.File
	if err := h.db.Where("id = ? AND owner_id = ? AND is_folder = false", req.FileID, getUserID(c)).First(&file).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File not found or not owned by you"})
		return
	}
	attachment := models.InternalTaskAttachment{
		TaskID: task.ID, FileID: file.ID, UploadedByID: getUserID(c),
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&attachment).Error; err != nil {
			return err
		}
		return recordInternalTaskActivity(tx, task.ID, getUserID(c), "attachment_added", "Attached "+file.Name)
	}); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File is already attached or could not be attached"})
		return
	}
	h.db.Preload("File").Preload("UploadedBy").First(&attachment, attachment.ID)
	c.JSON(http.StatusCreated, attachment)
}

func (h *InternalProjectHandler) DeleteTaskAttachment(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	attachmentID, _ := strconv.ParseUint(c.Param("attachmentId"), 10, 64)
	task, ok := h.loadAccessibleTask(c, uint(taskID))
	if !ok {
		return
	}
	var attachment models.InternalTaskAttachment
	if err := h.db.Preload("File").Where("id = ? AND task_id = ?", attachmentID, task.ID).First(&attachment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Attachment not found"})
		return
	}
	if !h.canDeleteTaskCollaboration(c, task, attachment.UploadedByID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	fileName := "attachment"
	if attachment.File != nil {
		fileName = attachment.File.Name
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&attachment).Error; err != nil {
			return err
		}
		return recordInternalTaskActivity(tx, task.ID, getUserID(c), "attachment_deleted", "Removed "+fileName)
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove attachment"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *InternalProjectHandler) ListTaskReferenceLinks(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if _, ok := h.loadAccessibleTask(c, uint(taskID)); !ok {
		return
	}
	var links []models.InternalTaskReferenceLink
	if err := h.db.Preload("CreatedBy").Where("task_id = ?", taskID).Order("created_at desc").Find(&links).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load links"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": links})
}

func (h *InternalProjectHandler) CreateTaskReferenceLink(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	task, ok := h.loadAccessibleTask(c, uint(taskID))
	if !ok {
		return
	}
	var req struct {
		Title string `json:"title"`
		URL   string `json:"url"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.URL = strings.TrimSpace(req.URL)
	parsed, err := url.ParseRequestURI(req.URL)
	if req.Title == "" || err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "A title and valid http(s) URL are required"})
		return
	}
	link := models.InternalTaskReferenceLink{
		TaskID: task.ID, Title: req.Title, URL: req.URL, CreatedByID: getUserID(c),
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&link).Error; err != nil {
			return err
		}
		return recordInternalTaskActivity(tx, task.ID, getUserID(c), "link_added", "Added reference link "+link.Title)
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add link"})
		return
	}
	h.db.Preload("CreatedBy").First(&link, link.ID)
	c.JSON(http.StatusCreated, link)
}

func (h *InternalProjectHandler) DeleteTaskReferenceLink(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	linkID, _ := strconv.ParseUint(c.Param("linkId"), 10, 64)
	task, ok := h.loadAccessibleTask(c, uint(taskID))
	if !ok {
		return
	}
	var link models.InternalTaskReferenceLink
	if err := h.db.Where("id = ? AND task_id = ?", linkID, task.ID).First(&link).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Link not found"})
		return
	}
	if !h.canDeleteTaskCollaboration(c, task, link.CreatedByID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}
	if err := h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&link).Error; err != nil {
			return err
		}
		return recordInternalTaskActivity(tx, task.ID, getUserID(c), "link_deleted", "Removed reference link "+link.Title)
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove link"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *InternalProjectHandler) ListTaskActivities(c *gin.Context) {
	taskID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if _, ok := h.loadAccessibleTask(c, uint(taskID)); !ok {
		return
	}
	var activities []models.InternalTaskActivity
	if err := h.db.Preload("User").Where("task_id = ?", taskID).
		Order("created_at desc, id desc").Limit(100).Find(&activities).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load activities"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": activities})
}

func (h *InternalProjectHandler) canDeleteTaskCollaboration(c *gin.Context, task models.InternalTask, ownerID uint) bool {
	if getUserRole(c) == "admin" || ownerID == getUserID(c) {
		return true
	}
	var project models.InternalProject
	return h.db.First(&project, task.ProjectID).Error == nil && project.OwnerID == getUserID(c)
}

// GetMyTasks returns tasks assigned to the current user. The compact project
// card uses the default limit, while the dedicated page can request more rows
// and include completed tasks.
func (h *InternalProjectHandler) GetMyTasks(c *gin.Context) {
	// Support viewing other user's tasks (for admin/manager)
	targetUserID := getUserID(c)
	if userIDParam := c.Query("user_id"); userIDParam != "" {
		if parsed, err := strconv.ParseUint(userIDParam, 10, 64); err == nil {
			targetUserID = uint(parsed)
		}
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "5"))
	if limit < 1 {
		limit = 5
	}
	if limit > 500 {
		limit = 500
	}
	includeDone := c.Query("include_done") == "true"

	var tasks []models.InternalTask
	query := h.db.
		Joins("JOIN internal_task_assignees ON internal_task_assignees.task_id = internal_tasks.id").
		Where("internal_task_assignees.user_id = ?", targetUserID).
		Preload("Project").
		Preload("Assignees.User").
		Preload("Column")
	if !includeDone {
		query = query.Where("internal_tasks.status != ?", "done")
	}
	err := query.Order("internal_tasks.created_at DESC").Limit(limit).Find(&tasks).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Sort by priority: overdue > urgent > high > medium > low
	now := time.Now()
	sort.Slice(tasks, func(i, j int) bool {
		iOverdue := tasks[i].DueDate != nil && tasks[i].DueDate.Before(now)
		jOverdue := tasks[j].DueDate != nil && tasks[j].DueDate.Before(now)
		if iOverdue != jOverdue {
			return iOverdue
		}
		iPrio := priorityWeight(tasks[i].Priority)
		jPrio := priorityWeight(tasks[j].Priority)
		if iPrio != jPrio {
			return iPrio > jPrio
		}
		if tasks[i].DueDate != nil && tasks[j].DueDate != nil {
			return tasks[i].DueDate.Before(*tasks[j].DueDate)
		}
		return tasks[i].DueDate != nil
	})

	c.JSON(http.StatusOK, gin.H{"data": tasks})
}

func priorityWeight(priority string) int {
	switch priority {
	case "urgent":
		return 4
	case "high":
		return 3
	case "medium":
		return 2
	case "low":
		return 1
	default:
		return 0
	}
}
