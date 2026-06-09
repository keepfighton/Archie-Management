package scheduler

import (
	"fmt"
	"log"
	"time"

	"github.com/cbqa/backend/internal/models"
	"gorm.io/gorm"
)

const (
	cutoffHour   = 23
	cutoffMinute = 30
)

func jakartaLocation() *time.Location {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		log.Printf("Warning: Failed to load Asia/Jakarta timezone, using UTC+7: %v", err)
		return time.FixedZone("WIB", 7*60*60)
	}
	return location
}

// DailyCutoff returns the 23:30 cutoff for the supplied calendar day in WIB.
func DailyCutoff(now time.Time) time.Time {
	local := now.In(jakartaLocation())
	return time.Date(local.Year(), local.Month(), local.Day(), cutoffHour, cutoffMinute, 0, 0, local.Location())
}

// LatestCutoff returns the most recent cutoff at or before now.
func LatestCutoff(now time.Time) time.Time {
	cutoff := DailyCutoff(now)
	if now.In(cutoff.Location()).Before(cutoff) {
		return cutoff.AddDate(0, 0, -1)
	}
	return cutoff
}

// ClockInAllowed prevents a new active timer from being opened after the daily
// auto-stop has already run. Manual completed entries remain available.
func ClockInAllowed(now time.Time) bool {
	return now.In(jakartaLocation()).Before(DailyCutoff(now))
}

// StartAutoStopTimers runs daily at 23:30 WIB to auto clock-out all active timers
func StartAutoStopTimers(db *gorm.DB) {
	location := jakartaLocation()

	// Catch up timers that survived a restart or downtime past a cutoff. Their
	// duration is capped at the missed cutoff instead of the restart time.
	if stopped, err := AutoStopTimersBefore(db, LatestCutoff(time.Now())); err != nil {
		log.Printf("Auto-stop startup catch-up failed: %v", err)
	} else if stopped > 0 {
		log.Printf("Auto-stop startup catch-up: stopped %d stale timer(s)", stopped)
	}

	for {
		now := time.Now().In(location)

		// Calculate next run at 23:30 WIB
		next := time.Date(now.Year(), now.Month(), now.Day(), 23, 30, 0, 0, location)
		if now.After(next) {
			// If already past 23:30 today, schedule for tomorrow
			next = next.Add(24 * time.Hour)
		}

		duration := next.Sub(now)
		log.Printf("Next auto-stop timers scheduled at: %s (in %v)", next.Format("2006-01-02 15:04:05 MST"), duration)

		timer := time.NewTimer(duration)
		<-timer.C

		if stopped, err := AutoStopTimersBefore(db, next); err != nil {
			log.Printf("Auto-stop failed: %v", err)
		} else {
			log.Printf("Auto-stop: Successfully stopped %d active timer(s) at %s", stopped, next.Format("2006-01-02 15:04:05 MST"))
		}
	}
}

// AutoStopTimersBefore closes active timers that started no later than cutoff.
// Using cutoff as clock_out prevents downtime from inflating tracked hours.
func AutoStopTimersBefore(db *gorm.DB, cutoff time.Time) (int, error) {
	var activeLogs []models.InternalTimeLog
	if err := db.Where("clock_out IS NULL AND clock_in <= ?", cutoff).Find(&activeLogs).Error; err != nil {
		return 0, fmt.Errorf("find active time logs: %w", err)
	}
	stopped := 0
	for _, logEntry := range activeLogs {
		durationSecs := int64(cutoff.Sub(logEntry.ClockIn).Seconds())
		if durationSecs < 0 {
			durationSecs = 0
		}

		if err := db.Model(&logEntry).Updates(map[string]any{
			"clock_out":        cutoff,
			"duration_seconds": durationSecs,
		}).Error; err != nil {
			return stopped, fmt.Errorf("stop timer %d: %w", logEntry.ID, err)
		}
		stopped++
	}
	return stopped, nil
}
