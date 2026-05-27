package config

import "testing"

func TestParsePositiveIntEnv(t *testing.T) {
	tests := []struct {
		name     string
		value    string
		expected int
	}{
		{name: "missing uses fallback", value: "", expected: 24},
		{name: "valid integer", value: "12", expected: 12},
		{name: "trimmed integer", value: " 48 ", expected: 48},
		{name: "invalid format uses fallback", value: "24h", expected: 24},
		{name: "zero uses fallback", value: "0", expected: 24},
		{name: "negative uses fallback", value: "-1", expected: 24},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("JWT_EXP_HOURS", tt.value)
			if got := parsePositiveIntEnv("JWT_EXP_HOURS", 24); got != tt.expected {
				t.Fatalf("parsePositiveIntEnv() = %d, want %d", got, tt.expected)
			}
		})
	}
}
