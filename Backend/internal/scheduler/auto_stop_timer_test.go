package scheduler

import (
	"testing"
	"time"
)

func wibTime(t *testing.T, hour, minute int) time.Time {
	t.Helper()
	location := jakartaLocation()
	return time.Date(2026, time.June, 10, hour, minute, 0, 0, location)
}

func TestLatestCutoffBeforeDailyRun(t *testing.T) {
	got := LatestCutoff(wibTime(t, 10, 0))
	want := time.Date(2026, time.June, 9, 23, 30, 0, 0, jakartaLocation())
	if !got.Equal(want) {
		t.Fatalf("LatestCutoff() = %v, want %v", got, want)
	}
}

func TestLatestCutoffAfterDailyRun(t *testing.T) {
	got := LatestCutoff(wibTime(t, 23, 45))
	want := time.Date(2026, time.June, 10, 23, 30, 0, 0, jakartaLocation())
	if !got.Equal(want) {
		t.Fatalf("LatestCutoff() = %v, want %v", got, want)
	}
}

func TestClockInAllowed(t *testing.T) {
	if !ClockInAllowed(wibTime(t, 23, 29)) {
		t.Fatal("clock-in should be allowed before cutoff")
	}
	if ClockInAllowed(wibTime(t, 23, 30)) {
		t.Fatal("clock-in should be blocked at cutoff")
	}
}
