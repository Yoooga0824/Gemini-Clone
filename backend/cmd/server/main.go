package main

import (
	"fmt"
	"log"
	"net/http"

	"gemini-clone/backend/internal/api"
	"gemini-clone/backend/internal/api/handlers"
	"gemini-clone/backend/internal/config"
	"gemini-clone/backend/internal/provider"
	"gemini-clone/backend/internal/service"

	"github.com/joho/godotenv"
)

func main() {
	// 0) Try to load .env automatically for local development.
	// This is optional: if no .env exists, we still continue and read OS env vars.
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// 1) Read environment config.
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config failed: %v", err)
	}

	// 2) Build low-level provider client (talks to upstream LLM).
	llmClient := provider.NewOpenAICompatibleClient(
		cfg.UpstreamBaseURL,
		cfg.UpstreamPath,
		cfg.UpstreamAPIKey,
		cfg.UpstreamModel,
		cfg.MaxTokens,
		cfg.Temperature,
	)

	// 3) Build service layer (business logic).
	chatService := service.NewChatService(llmClient)

	// 4) Build HTTP handlers.
	chatHandler := handlers.NewChatHandler(chatService)

	// 5) Wire routes and middleware.
	router := api.NewRouter(chatHandler, cfg.AllowedOrigin)

	// 6) Start server.
	addr := ":" + cfg.ServerPort
	fmt.Printf("Go backend listening on http://localhost%s\n", addr)
	fmt.Printf("Health check: http://localhost%s/api/health\n", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
