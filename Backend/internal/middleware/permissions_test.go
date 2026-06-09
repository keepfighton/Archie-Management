package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequirePermissionAllowsAdminWithoutDatabaseLookup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	called := false
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("role", "admin") })
	router.Use(RequirePermission(nil, "internal-project.dashboard", false))
	router.GET("/", func(c *gin.Context) { called = true; c.Status(http.StatusOK) })
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
	if !called {
		t.Fatal("admin request should reach the next handler")
	}
}

func TestRequirePermissionRejectsMissingUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	router := gin.New()
	router.Use(func(c *gin.Context) { c.Set("role", "member") })
	router.Use(RequirePermission(nil, "internal-project.dashboard", false))
	router.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
}
