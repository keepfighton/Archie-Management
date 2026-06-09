package server

import (
	"testing"

	"github.com/cbqa/backend/internal/config"
)

func TestInternalProjectRoutesRegistered(t *testing.T) {
	server := New(&config.Config{Env: "test"}, nil)
	routes := map[string]bool{}
	for _, route := range server.router.Routes() {
		routes[route.Method+" "+route.Path] = true
	}

	for _, route := range []string{
		"GET /api/v1/internal-projects/dashboard",
		"GET /api/v1/internal-projects/time-summary",
		"GET /api/v1/internal-projects/reports/export",
		"GET /api/v1/internal-projects/reports/summary",
	} {
		if !routes[route] {
			t.Fatalf("route %q is not registered", route)
		}
	}
}
