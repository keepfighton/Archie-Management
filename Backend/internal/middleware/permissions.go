package middleware

import (
	"net/http"

	"github.com/cbqa/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// RequirePermission enforces dynamic application-role permissions. Admins and
// users without an assigned application role retain full access for backwards
// compatibility.
func RequirePermission(db *gorm.DB, menu string, edit bool) gin.HandlerFunc {
	return requirePermissions(db, []string{menu}, edit)
}

// RequireAnyPermission grants access when at least one listed menu permission
// is available. It is used by shared filter-data endpoints.
func RequireAnyPermission(db *gorm.DB, menus ...string) gin.HandlerFunc {
	return requirePermissions(db, menus, false)
}

func requirePermissions(db *gorm.DB, menus []string, edit bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if role, _ := c.Get("role"); role == "admin" {
			c.Next()
			return
		}

		userID, ok := c.Get("user_id")
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			return
		}

		var user models.User
		if err := db.Select("id", "app_role_id").First(&user, userID).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			return
		}
		if user.AppRoleID == nil {
			c.Next()
			return
		}

		var permissions []models.RolePermission
		if err := db.Where("app_role_id = ? AND menu IN ?", *user.AppRoleID, menus).Find(&permissions).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Failed to check permission"})
			return
		}
		allowed := false
		for _, permission := range permissions {
			if (!edit && permission.CanRead) || (edit && permission.CanEdit) {
				allowed = true
				break
			}
		}
		if !allowed {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Permission denied"})
			return
		}
		c.Next()
	}
}
