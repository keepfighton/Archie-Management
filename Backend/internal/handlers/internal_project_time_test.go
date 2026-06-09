package handlers

import (
	"testing"
	"time"
)

func TestParseInternalProjectDateUsesWIB(t *testing.T) {
	got, err := parseInternalProjectDate("2026-06-10")
	if err != nil {
		t.Fatalf("parseInternalProjectDate() error = %v", err)
	}
	if got.Year() != 2026 || got.Month() != time.June || got.Day() != 10 || got.Hour() != 0 {
		t.Fatalf("unexpected date: %v", got)
	}
	_, offset := got.Zone()
	if offset != 7*60*60 {
		t.Fatalf("timezone offset = %d, want %d", offset, 7*60*60)
	}
}
