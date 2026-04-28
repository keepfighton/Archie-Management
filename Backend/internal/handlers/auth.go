package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"github.com/cbqa/backend/internal/config"
	"github.com/cbqa/backend/internal/middleware"
	"github.com/cbqa/backend/internal/models"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db  *gorm.DB
	cfg *config.Config
}

func NewAuthHandler(db *gorm.DB, cfg *config.Config) *AuthHandler {
	return &AuthHandler{db: db, cfg: cfg}
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

type RegisterRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	JobTitle string `json:"job_title"`
	Phone    string `json:"phone"`
	Role     string `json:"role"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	if err := h.db.Where("email = ? AND is_active = true", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}
	// preload AppRole for permissions
	if user.AppRoleID != nil {
		h.db.Preload("Permissions").First(&user.AppRole, *user.AppRoleID)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	token, err := middleware.GenerateToken(h.cfg, user.ID, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":       token,
		"user":        userPayload(user),
		"permissions": resolvePermissions(h.db, user),
	})
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.JobTitle = strings.TrimSpace(req.JobTitle)
	req.Phone = strings.TrimSpace(req.Phone)

	// Check if email exists
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
		Name:     req.Name,
		Email:    req.Email,
		Password: string(hashed),
		JobTitle: req.JobTitle,
		Phone:    req.Phone,
		Role:     "member",
		IsActive: true,
	}

	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	token, err := middleware.GenerateToken(h.cfg, user.ID, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"token":       token,
		"user":        userPayload(user),
		"permissions": nil, // new registrations have no AppRole assigned
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var user models.User
	if err := h.db.Preload("AppRole.Permissions").First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	// Return the same {user, permissions} envelope as Login so the frontend
	// can handle both responses identically.
	c.JSON(http.StatusOK, gin.H{
		"user":        userPayload(user),
		"permissions": resolvePermissions(h.db, user),
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	jti, _ := c.Get("jti")
	expiry, _ := c.Get("token_expiry")
	if jti != nil && expiry != nil {
		middleware.BlacklistToken(jti.(string), expiry.(time.Time))
	}
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	var user models.User
	if err := h.db.Where("email = ? AND is_active = true", req.Email).First(&user).Error; err != nil {
		// Jangan bocorkan apakah email terdaftar atau tidak
		c.JSON(http.StatusOK, gin.H{"message": "If email exists, reset link has been sent"})
		return
	}

	// Generate token reset 32-byte hex
	b := make([]byte, 32)
	rand.Read(b)
	token := hex.EncodeToString(b)
	expiry := time.Now().Add(1 * time.Hour)

	h.db.Model(&user).Updates(map[string]interface{}{
		"reset_token":        token,
		"reset_token_expiry": expiry,
	})

	resetURL := fmt.Sprintf("%s/reset-password?token=%s", h.cfg.AppURL, token)
	go sendResetEmail(h.cfg, user.Email, user.Name, resetURL)

	c.JSON(http.StatusOK, gin.H{"message": "If email exists, reset link has been sent"})
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req struct {
		Token       string `json:"token" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.Where("reset_token = ? AND reset_token_expiry > ?", req.Token, time.Now()).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token tidak valid atau sudah kadaluarsa"})
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	h.db.Model(&user).Updates(map[string]interface{}{
		"password":           string(hashed),
		"reset_token":        "",
		"reset_token_expiry": nil,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Password berhasil direset. Silakan login."})
}

// userPayload builds the standard user map returned in API responses.
func userPayload(user models.User) gin.H {
	return gin.H{
		"id":          user.ID,
		"name":        user.Name,
		"email":       user.Email,
		"job_title":   user.JobTitle,
		"phone":       user.Phone,
		"role":        user.Role,
		"app_role_id": user.AppRoleID,
		"avatar":      user.Avatar,
		"clocked_in":  user.ClockedIn,
	}
}

// resolvePermissions returns the permission list for a user.
// Admins get nil (frontend treats nil as full access).
// Members with an AppRole get that role's permissions.
// Members without an AppRole get nil (full access, backward compat).
func resolvePermissions(db *gorm.DB, user models.User) interface{} {
	if user.Role == "admin" {
		return nil
	}
	if user.AppRoleID == nil {
		return nil
	}
	var perms []models.RolePermission
	db.Where("app_role_id = ?", *user.AppRoleID).Find(&perms)
	return perms
}

func sendResetEmail(cfg *config.Config, toEmail, toName, resetURL string) {
	if cfg.SMTPHost == "" {
		return
	}
	subject := "Reset Password NEXONE"
	body := fmt.Sprintf(`<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
<h2 style="color:#2563eb">Reset Password NEXONE</h2>
<p>Halo <strong>%s</strong>,</p>
<p>Kami menerima permintaan reset password untuk akun Anda.</p>
<p style="margin:24px 0">
  <a href="%s" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
    Reset Password
  </a>
</p>
<p style="color:#64748b;font-size:13px">Link ini berlaku selama <strong>1 jam</strong>.<br>
Jika Anda tidak meminta reset password, abaikan email ini.</p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
<p style="color:#94a3b8;font-size:12px">NEXONE by Nexora</p>
</body></html>`, toName, resetURL)

	msg := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s",
		cfg.SMTPFrom, toEmail, subject, body,
	)
	auth := smtp.PlainAuth("", cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPHost)
	smtp.SendMail(cfg.SMTPHost+":"+cfg.SMTPPort, auth, cfg.SMTPFrom, []string{toEmail}, []byte(msg))
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var req struct {
		OldPassword string `json:"old_password" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.OldPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Old password is incorrect"})
		return
	}

	hashed, _ := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	h.db.Model(&user).Update("password", string(hashed))
	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}
