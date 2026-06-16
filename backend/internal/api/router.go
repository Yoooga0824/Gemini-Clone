package api

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"

	"gemini-clone/backend/internal/api/handlers"
	"gemini-clone/backend/internal/middleware"
)

func NewRouter(
	chatHandler *handlers.ChatHandler,
	authHandler *handlers.AuthHandler,
	userHandler *handlers.UserHandler,
	usageHandler *handlers.UsageHandler,
	allowedOrigin string,
	jwtSecret string,
	uploadsRoot string,
) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/api/auth/register", authHandler.PostRegister)
	mux.HandleFunc("/api/auth/login", authHandler.PostLogin)
	mux.HandleFunc("/api/me", middleware.RequireAuth(jwtSecret, routeMethods(userHandler.GetMe, userHandler.PatchMe)))
	mux.HandleFunc("/api/me/avatar", middleware.RequireAuth(jwtSecret, userHandler.PostAvatar))
	mux.HandleFunc("/api/usage", middleware.RequireAuth(jwtSecret, usageHandler.GetUsageSummary))
	mux.HandleFunc("/api/chat", chatHandler.PostChat)
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(filepath.Clean(uploadsRoot)))))

	return withCORS(mux, allowedOrigin)
}

func routeMethods(getHandler, patchHandler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			getHandler(w, r)
			return
		}
		if r.Method == http.MethodPatch {
			patchHandler(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusMethodNotAllowed)
		_, _ = w.Write([]byte(`{"error":{"message":"method not allowed"}}`))
	}
}

func withCORS(next http.Handler, allowedOrigin string) http.Handler {
	allowedOrigins := parseAllowedOrigins(allowedOrigin)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if isOriginAllowed(origin, allowedOrigins) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
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
