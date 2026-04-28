package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/cbqa/backend/internal/config"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID uint   `json:"user_id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	JTI    string `json:"jti"`
	jwt.RegisteredClaims
}

// ─── Token Blacklist (in-memory) ─────────────────────

type blacklistEntry struct{ expiry time.Time }

var (
	blacklist   = sync.Map{}
	cleanupOnce sync.Once
)

func startCleanup() {
	go func() {
		for {
			time.Sleep(15 * time.Minute)
			now := time.Now()
			blacklist.Range(func(k, v any) bool {
				if v.(blacklistEntry).expiry.Before(now) {
					blacklist.Delete(k)
				}
				return true
			})
		}
	}()
}

func BlacklistToken(jti string, expiry time.Time) {
	cleanupOnce.Do(startCleanup)
	blacklist.Store(jti, blacklistEntry{expiry: expiry})
}

func isBlacklisted(jti string) bool {
	v, ok := blacklist.Load(jti)
	if !ok {
		return false
	}
	if v.(blacklistEntry).expiry.Before(time.Now()) {
		blacklist.Delete(jti)
		return false
	}
	return true
}

func newJTI() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// ─────────────────────────────────────────────────────

func GenerateToken(cfg *config.Config, userID uint, email, role string) (string, error) {
	expiry := time.Now().Add(time.Duration(cfg.JWTExpHours) * time.Hour)
	claims := &Claims{
		UserID: userID,
		Email:  email,
		Role:   role,
		JTI:    newJTI(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiry),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}

func AuthRequired(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
			return
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(parts[1], claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return []byte(cfg.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		if isBlacklisted(claims.JTI) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Token has been invalidated"})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)
		c.Set("jti", claims.JTI)
		c.Set("token_expiry", claims.ExpiresAt.Time)
		c.Next()
	}
}

func AdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		if role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			return
		}
		c.Next()
	}
}

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Allow-Origin wildcard ("*") and Allow-Credentials: true are mutually
		// exclusive per the Fetch spec — browsers reject that combination.
		// This API uses Bearer tokens in Authorization headers (not cookies),
		// so credentials mode is not required.
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
