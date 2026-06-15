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
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config failed: %v", err)
	}

	llmClient := provider.NewOpenAICompatibleClient(
		cfg.UpstreamBaseURL,
		cfg.UpstreamPath,
		cfg.UpstreamAPIKey,
		cfg.UpstreamModel,
		cfg.MaxTokens,
		cfg.Temperature,
	)

	chatService := service.NewChatService(llmClient)
	chatHandler := handlers.NewChatHandler(chatService)
	router := api.NewRouter(chatHandler, cfg.AllowedOrigin)

	addr := ":" + cfg.ServerPort
	fmt.Printf("Go backend listening on http://localhost%s\n", addr)
	fmt.Printf("Health check: http://localhost%s/api/health\n", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
