package main

import (
	"log"

	"github.com/cbqa/backend/internal/config"
	"github.com/cbqa/backend/internal/database"
	"github.com/cbqa/backend/internal/scheduler"
	"github.com/cbqa/backend/internal/server"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	if err := database.Migrate(db); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Start background scheduler for auto-stop timers
	go scheduler.StartAutoStopTimers(db)
	log.Println("Auto-stop timer scheduler started (runs daily at 23:30 WIB)")

	srv := server.New(cfg, db)
	log.Printf("Server starting on port %s", cfg.Port)
	if err := srv.Run(); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
