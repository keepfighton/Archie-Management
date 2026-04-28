package config

import (
	"os"
	"strconv"

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
}

func Load() *Config {
	_ = godotenv.Load(".env.local", ".env")
	jwtExp, _ := strconv.Atoi(getEnv("JWT_EXP_HOURS", "24"))
	return &Config{
		Port:         getEnv("PORT", "8080"),
		DBHost:       getEnv("DB_HOST", "localhost"),
		DBPort:       getEnv("DB_PORT", "5432"),
		DBUser:       getEnv("DB_USER", "cbqa"),
		DBPassword:   getEnv("DB_PASSWORD", "cbqa123"),
		DBName:       getEnv("DB_NAME", "cbqa_db"),
		JWTSecret:    getEnv("JWT_SECRET", "cbqa-super-secret-key-change-in-production"),
		JWTExpHours:  jwtExp,
		Env:          getEnv("ENV", "development"),
		UploadDir:    getEnv("UPLOAD_DIR", "./uploads"),
		AppURL:       getEnv("APP_URL", "http://localhost:3000"),
		SMTPHost:     getEnv("SMTP_HOST", ""),
		SMTPPort:     getEnv("SMTP_PORT", "587"),
		SMTPUser:     getEnv("SMTP_USER", ""),
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:     getEnv("SMTP_FROM", "noreply@cbqa.com"),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
