package config

import (
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	DBHost      string
	DBPort      string
	DBUser      string
	DBPassword  string
	DBName      string
	JWTSecret   string
	JWTExpHours int
	Env         string
	// File storage
	UploadDir string
	AppURL    string
	// SMTP
	SMTPHost     string
	SMTPPort     string
	SMTPUser     string
	SMTPPassword string
	SMTPFrom     string
	// WhatsApp Cloud API
	WhatsAppVerifyToken   string
	WhatsAppAccessToken   string
	WhatsAppPhoneNumberID string
	WhatsAppAppSecret     string
	WhatsAppAPIVersion    string
	WhatsAppOwnerNumbers  string
}

func Load() *Config {
	_ = godotenv.Load(".env.local", ".env")
	jwtExp := parsePositiveIntEnv("JWT_EXP_HOURS", 24)
	return &Config{
		Port:                  getEnv("PORT", "3092"),
		DBHost:                getEnv("DB_HOST", "localhost"),
		DBPort:                getEnv("DB_PORT", "5432"),
		DBUser:                getEnv("DB_USER", "cbqa"),
		DBPassword:            getEnv("DB_PASSWORD", "cbqa123"),
		DBName:                getEnv("DB_NAME", "cbqa_db"),
		JWTSecret:             getEnv("JWT_SECRET", "cbqa-super-secret-key-change-in-production"),
		JWTExpHours:           jwtExp,
		Env:                   getEnv("ENV", "development"),
		UploadDir:             getEnv("UPLOAD_DIR", "./uploads"),
		AppURL:                getEnv("APP_URL", "http://localhost:3000"),
		SMTPHost:              getEnv("SMTP_HOST", ""),
		SMTPPort:              getEnv("SMTP_PORT", "587"),
		SMTPUser:              getEnv("SMTP_USER", ""),
		SMTPPassword:          getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:              getEnv("SMTP_FROM", "noreply@cbqa.com"),
		WhatsAppVerifyToken:   getEnv("WHATSAPP_VERIFY_TOKEN", ""),
		WhatsAppAccessToken:   getEnv("WHATSAPP_ACCESS_TOKEN", ""),
		WhatsAppPhoneNumberID: getEnv("WHATSAPP_PHONE_NUMBER_ID", ""),
		WhatsAppAppSecret:     getEnv("WHATSAPP_APP_SECRET", ""),
		WhatsAppAPIVersion:    getEnv("WHATSAPP_API_VERSION", "v20.0"),
		WhatsAppOwnerNumbers:  getEnv("WHATSAPP_OWNER_NUMBERS", ""),
	}
}

func parsePositiveIntEnv(key string, fallback int) int {
	val := strings.TrimSpace(getEnv(key, ""))
	if val == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(val)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
