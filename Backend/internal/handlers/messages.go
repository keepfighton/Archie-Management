package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/cbqa/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type MessageHandler struct {
	db *gorm.DB
}

func NewMessageHandler(db *gorm.DB) *MessageHandler {
	return &MessageHandler{db: db}
}

func (h *MessageHandler) Heartbeat(c *gin.Context) {
	userID := getUserID(c)
	now := time.Now()

	var presence models.UserPresence
	err := h.db.Where("user_id = ?", userID).First(&presence).Error
	if err == gorm.ErrRecordNotFound {
		presence = models.UserPresence{UserID: userID, Status: "online", LastSeenAt: now}
		if err := h.db.Create(&presence).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update presence"})
			return
		}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update presence"})
		return
	} else {
		presence.Status = "online"
		presence.LastSeenAt = now
		if err := h.db.Save(&presence).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update presence"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"presence": presencePayload(presence.LastSeenAt)})
}

func (h *MessageHandler) ListUsers(c *gin.Context) {
	currentUserID := getUserID(c)
	var users []models.User
	if err := h.db.
		Where("is_active = ? AND id <> ?", true, currentUserID).
		Order("name asc").
		Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load users"})
		return
	}

	var presences []models.UserPresence
	h.db.Where("user_id <> ?", currentUserID).Find(&presences)
	presenceByUser := map[uint]models.UserPresence{}
	for _, presence := range presences {
		presenceByUser[presence.UserID] = presence
	}

	items := make([]gin.H, 0, len(users))
	for _, user := range users {
		presence := presenceByUser[user.ID]
		items = append(items, gin.H{
			"user":     userPayload(user),
			"presence": presencePayload(presence.LastSeenAt),
		})
	}

	c.JSON(http.StatusOK, gin.H{"users": items})
}

func (h *MessageHandler) ListConversations(c *gin.Context) {
	userID := getUserID(c)
	var members []models.ConversationMember
	if err := h.db.
		Preload("Conversation.Members.User").
		Where("user_id = ?", userID).
		Order("updated_at desc").
		Find(&members).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load conversations"})
		return
	}

	items := make([]gin.H, 0, len(members))
	for _, member := range members {
		conversation := member.Conversation
		if conversation == nil {
			continue
		}
		var lastMessage models.Message
		h.db.Preload("Sender").
			Where("conversation_id = ?", conversation.ID).
			Order("created_at desc").
			First(&lastMessage)

		var unread int64
		query := h.db.Model(&models.Message{}).
			Where("conversation_id = ? AND sender_id <> ?", conversation.ID, userID)
		if member.LastReadAt != nil {
			query = query.Where("created_at > ?", *member.LastReadAt)
		}
		query.Count(&unread)

		items = append(items, conversationPayload(*conversation, userID, lastMessage, unread))
	}

	c.JSON(http.StatusOK, gin.H{"conversations": items})
}

func (h *MessageHandler) GetOrCreateDirectConversation(c *gin.Context) {
	userID := getUserID(c)
	var req struct {
		UserID uint `json:"user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.UserID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot create a conversation with yourself"})
		return
	}

	var other models.User
	if err := h.db.Where("id = ? AND is_active = ?", req.UserID, true).First(&other).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User was not found"})
		return
	}

	conversation, err := h.findDirectConversation(userID, req.UserID)
	if err != nil && err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load conversation"})
		return
	}
	if err == gorm.ErrRecordNotFound {
		conversation = models.Conversation{Type: "direct", CreatedByID: userID}
		if err := h.db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(&conversation).Error; err != nil {
				return err
			}
			members := []models.ConversationMember{
				{ConversationID: conversation.ID, UserID: userID},
				{ConversationID: conversation.ID, UserID: req.UserID},
			}
			return tx.Create(&members).Error
		}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create conversation"})
			return
		}
	}

	h.db.Preload("Members.User").First(&conversation, conversation.ID)
	c.JSON(http.StatusOK, gin.H{"conversation": conversationPayload(conversation, userID, models.Message{}, 0)})
}

func (h *MessageHandler) ListMessages(c *gin.Context) {
	userID := getUserID(c)
	conversationID, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	if !h.isMember(conversationID, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Conversation access denied"})
		return
	}

	var messages []models.Message
	if err := h.db.
		Preload("Sender").
		Where("conversation_id = ?", conversationID).
		Order("created_at asc").
		Limit(100).
		Find(&messages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load messages"})
		return
	}

	h.markRead(conversationID, userID)

	items := make([]gin.H, 0, len(messages))
	for _, message := range messages {
		items = append(items, messagePayload(message))
	}
	c.JSON(http.StatusOK, gin.H{"messages": items})
}

func (h *MessageHandler) SendMessage(c *gin.Context) {
	userID := getUserID(c)
	conversationID, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	if !h.isMember(conversationID, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Conversation access denied"})
		return
	}

	var req struct {
		Body string `json:"body" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	body := strings.TrimSpace(req.Body)
	if body == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Message cannot be empty"})
		return
	}

	message := models.Message{
		ConversationID: conversationID,
		SenderID:       userID,
		Body:           body,
		MessageType:    "text",
	}
	if err := h.db.Create(&message).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send message"})
		return
	}
	h.markRead(conversationID, userID)
	h.db.Preload("Sender").First(&message, message.ID)

	c.JSON(http.StatusCreated, gin.H{"message": messagePayload(message)})
}

func (h *MessageHandler) MarkRead(c *gin.Context) {
	userID := getUserID(c)
	conversationID, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	if !h.isMember(conversationID, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Conversation access denied"})
		return
	}
	h.markRead(conversationID, userID)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (h *MessageHandler) findDirectConversation(userA, userB uint) (models.Conversation, error) {
	var conversation models.Conversation
	err := h.db.
		Joins("JOIN conversation_members cm_a ON cm_a.conversation_id = conversations.id AND cm_a.user_id = ?", userA).
		Joins("JOIN conversation_members cm_b ON cm_b.conversation_id = conversations.id AND cm_b.user_id = ?", userB).
		Where("conversations.type = ?", "direct").
		First(&conversation).Error
	return conversation, err
}

func (h *MessageHandler) isMember(conversationID, userID uint) bool {
	var count int64
	h.db.Model(&models.ConversationMember{}).
		Where("conversation_id = ? AND user_id = ?", conversationID, userID).
		Count(&count)
	return count > 0
}

func (h *MessageHandler) markRead(conversationID, userID uint) {
	now := time.Now()
	h.db.Model(&models.ConversationMember{}).
		Where("conversation_id = ? AND user_id = ?", conversationID, userID).
		Updates(map[string]any{"last_read_at": &now})
}

func parseUintParam(c *gin.Context, name string) (uint, bool) {
	id, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid id"})
		return 0, false
	}
	return uint(id), true
}

func presencePayload(lastSeen time.Time) gin.H {
	status := "offline"
	if !lastSeen.IsZero() {
		elapsed := time.Since(lastSeen)
		if elapsed <= 2*time.Minute {
			status = "online"
		} else if elapsed <= 10*time.Minute {
			status = "away"
		}
	}
	return gin.H{"status": status, "last_seen_at": lastSeen}
}

func conversationPayload(conversation models.Conversation, currentUserID uint, lastMessage models.Message, unread int64) gin.H {
	members := make([]gin.H, 0, len(conversation.Members))
	var title string
	for _, member := range conversation.Members {
		if member.User == nil {
			continue
		}
		members = append(members, gin.H{
			"user":         userPayload(*member.User),
			"last_read_at": member.LastReadAt,
		})
		if conversation.Type == "direct" && member.UserID != currentUserID {
			title = member.User.Name
		}
	}
	if title == "" {
		title = conversation.Name
	}
	if title == "" {
		title = "Conversation"
	}

	payload := gin.H{
		"id":           conversation.ID,
		"type":         conversation.Type,
		"name":         conversation.Name,
		"title":        title,
		"members":      members,
		"unread_count": unread,
		"updated_at":   conversation.UpdatedAt,
	}
	if lastMessage.ID != 0 {
		payload["last_message"] = messagePayload(lastMessage)
	}
	return payload
}

func messagePayload(message models.Message) gin.H {
	payload := gin.H{
		"id":              message.ID,
		"conversation_id": message.ConversationID,
		"sender_id":       message.SenderID,
		"body":            message.Body,
		"message_type":    message.MessageType,
		"created_at":      message.CreatedAt,
	}
	if message.Sender != nil {
		payload["sender"] = userPayload(*message.Sender)
	}
	return payload
}
