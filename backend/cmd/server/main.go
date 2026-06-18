package main

import (
	"fmt"
	"log"
	"net/http"
	"path/filepath"

	"gemini-clone/backend/internal/api"
	"gemini-clone/backend/internal/api/handlers"
	"gemini-clone/backend/internal/config"
	"gemini-clone/backend/internal/database"
	"gemini-clone/backend/internal/provider"
	"gemini-clone/backend/internal/repository"
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

	db, err := database.OpenMySQL(cfg.MySQLDSN)
	if err != nil {
		log.Fatalf("open database failed: %v", err)
	}
	defer db.Close()

	if err := database.RunInitMigration(db, filepath.Join("migrations", "001_init.sql")); err != nil {
		log.Fatalf("run migration failed: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	usageRepo := repository.NewUsageRepository(db)
	chatRepo := repository.NewChatRepository(db)

	authService := service.NewAuthService(userRepo, cfg.JWTSecret, cfg.JWTExpiryHours)
	userService := service.NewUserService(userRepo)
	usageService := service.NewUsageService(usageRepo)
	chatService := service.NewChatService(llmClient, chatRepo, usageService, cfg.UpstreamModel)

	authHandler := handlers.NewAuthHandler(authService)
	userHandler := handlers.NewUserHandler(userService, cfg.AvatarUploadDir, cfg.AvatarMaxBytes)
	usageHandler := handlers.NewUsageHandler(usageService)
	chatHandler := handlers.NewChatHandler(chatService)
	router := api.NewRouter(
		chatHandler,
		authHandler,
		userHandler,
		usageHandler,
		cfg.AllowedOrigin,
		cfg.JWTSecret,
		filepath.Dir(cfg.AvatarUploadDir),
	)

	addr := ":" + cfg.ServerPort
	fmt.Printf("Go backend listening on http://localhost%s\n", addr)
	fmt.Printf("Health check: http://localhost%s/api/health\n", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
