package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/cbqa/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type NotificationHandler struct{ db *gorm.DB }

func NewNotificationHandler(db *gorm.DB) *NotificationHandler {
	return &NotificationHandler{db: db}
}

func createPersonalNotification(tx *gorm.DB, userID uint, notificationType, title, message, link, entityType string, entityID uint) error {
	if userID == 0 {
		return nil
	}
	return tx.Create(&models.Notification{
		UserID: userID, Type: notificationType, Title: title, Message: message,
		Link: link, EntityType: entityType, EntityID: entityID,
	}).Error
}

func createPersonalNotifications(tx *gorm.DB, userIDs []uint, actorID uint, notificationType, title, message, link, entityType string, entityID uint) error {
	seen := map[uint]struct{}{}
	for _, userID := range userIDs {
		if userID == 0 || userID == actorID {
			continue
		}
		if _, exists := seen[userID]; exists {
			continue
		}
		seen[userID] = struct{}{}
		if err := createPersonalNotification(tx, userID, notificationType, title, message, link, entityType, entityID); err != nil {
			return err
		}
	}
	return nil
}

func ensureInternalTaskReminders(db *gorm.DB, userID uint) {
	now := time.Now()
	limit := now.AddDate(0, 0, 3)
	var tasks []models.InternalTask
	db.Preload("Project").
		Joins("JOIN internal_task_assignees ita ON ita.task_id = internal_tasks.id").
		Where("ita.user_id = ? AND internal_tasks.due_date IS NOT NULL AND internal_tasks.due_date <= ? AND internal_tasks.status <> ?", userID, limit, "done").
		Order("internal_tasks.due_date asc").Find(&tasks)

	for _, task := range tasks {
		reminderType := "deadline"
		title := "Task deadline approaching"
		message := fmt.Sprintf("%s is due on %s", task.Title, task.DueDate.Format("02 Jan 2006"))
		if task.DueDate.Before(now) {
			reminderType = "overdue"
			title = "Task overdue"
			message = fmt.Sprintf("%s has passed its deadline", task.Title)
		}
		key := fmt.Sprintf("user:%d:internal-task:%d:%s", userID, task.ID, reminderType)
		notification := models.Notification{
			UserID: userID, Type: reminderType, Title: title, Message: message,
			Link: fmt.Sprintf("/internal-project/projects/%d", task.ProjectID), EntityType: "internal_task",
			EntityID: task.ID, UniqueKey: &key,
		}
		var existing models.Notification
		err := db.Unscoped().Where("user_id = ? AND unique_key = ?", userID, key).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			db.Create(&notification)
			continue
		}
		if err == nil && existing.DeletedAt.Valid {
			db.Unscoped().Model(&existing).Updates(map[string]any{
				"deleted_at": nil, "read_at": nil, "type": reminderType, "title": title,
				"message": message, "link": notification.Link, "created_at": now, "updated_at": now,
			})
		}
	}
}

func (h *NotificationHandler) List(c *gin.Context) {
	userID := getUserID(c)
	ensureInternalTaskReminders(h.db, userID)

	var notifications []models.Notification
	query := h.db.Where("user_id = ?", userID)
	if c.Query("unread") == "true" {
		query = query.Where("read_at IS NULL")
	}
	if err := query.Order("created_at desc, id desc").Limit(50).Find(&notifications).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load notifications"})
		return
	}
	var unread int64
	h.db.Model(&models.Notification{}).Where("user_id = ? AND read_at IS NULL", userID).Count(&unread)
	c.JSON(http.StatusOK, gin.H{"data": notifications, "unread": unread})
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	id, ok := mustGetID(c)
	if !ok {
		return
	}
	now := time.Now()
	result := h.db.Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", id, getUserID(c)).Update("read_at", &now)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Read"})
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	now := time.Now()
	if err := h.db.Model(&models.Notification{}).
		Where("user_id = ? AND read_at IS NULL", getUserID(c)).Update("read_at", &now).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark notifications as read"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "All notifications marked as read"})
}
