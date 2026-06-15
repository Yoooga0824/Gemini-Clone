package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"gemini-clone/backend/internal/api/handlers"
)

// NewRouter wires routes and wraps them with CORS middleware.
func NewRouter(chatHandler *handlers.ChatHandler, allowedOrigin string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/api/chat", chatHandler.PostChat)

	return withCORS(mux, allowedOrigin)
}

func withCORS(next http.Handler, allowedOrigin string) http.Handler {
	allowedOrigins := parseAllowedOrigins(allowedOrigin)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if isOriginAllowed(origin, allowedOrigins) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Vary", "Origin")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func parseAllowedOrigins(raw string) map[string]struct{} {
	// ALLOWED_ORIGIN supports comma-separated values, for example:
	// http://localhost:3000,http://localhost:3001,http://127.0.0.1:3001
	origins := map[string]struct{}{}

	if strings.TrimSpace(raw) == "" {
		origins["http://localhost:3000"] = struct{}{}
		return origins
	}

	for _, item := range strings.Split(raw, ",") {
		origin := strings.TrimSpace(item)
		if origin == "" {
			continue
		}
		origins[origin] = struct{}{}
	}

	return origins
}

func isOriginAllowed(origin string, allowed map[string]struct{}) bool {
	if origin == "" {
		return false
	}
	_, ok := allowed[origin]
	return ok
}
