package main

import (
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"time"

	"gemini-clone/backend/internal/api"
	"gemini-clone/backend/internal/api/handlers"
	"gemini-clone/backend/internal/config"
	"gemini-clone/backend/internal/database"
	"gemini-clone/backend/internal/provider"
	"gemini-clone/backend/internal/repository"
	"gemini-clone/backend/internal/service"
	"gemini-clone/backend/internal/websearch"

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

	var searchClient websearch.Client
	if cfg.WebSearchProvider == "tavily" && cfg.TavilyAPIKey != "" {
		searchClient = websearch.NewTavilyClient(cfg.TavilyBaseURL, cfg.TavilyAPIKey)
	}

	llmClients := make(map[string]*provider.OpenAICompatibleClient, len(cfg.ModelProviders))
	for modelKey, providerCfg := range cfg.ModelProviders {
		llmClients[modelKey] = provider.NewOpenAICompatibleClient(
			providerCfg.BaseURL,
			providerCfg.Path,
			providerCfg.APIKey,
			providerCfg.Model,
			cfg.MaxTokens,
			cfg.Temperature,
			time.Duration(cfg.UpstreamRequestTimeoutSeconds)*time.Second,
			searchClient,
			cfg.WebSearchMaxResults,
		)
	}

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
	adminRepo := repository.NewAdminRepository(db)

	authService := service.NewAuthService(userRepo, cfg.JWTSecret, cfg.JWTExpiryHours, cfg.AdminEmail)
	userService := service.NewUserService(userRepo, cfg.AdminEmail)
	usageService := service.NewUsageService(usageRepo, userRepo)
	adminService := service.NewAdminService(userRepo, adminRepo, cfg.AdminEmail)
	modelGenerators := make(map[string]service.Generator, len(llmClients))
	for modelKey, client := range llmClients {
		modelGenerators[modelKey] = client
	}
	chatService := service.NewChatService(modelGenerators, cfg.ModelOrder, chatRepo, usageService)

	authHandler := handlers.NewAuthHandler(authService)
	userHandler := handlers.NewUserHandler(userService, cfg.AvatarUploadDir, cfg.AvatarMaxBytes)
	usageHandler := handlers.NewUsageHandler(usageService)
	chatHandler := handlers.NewChatHandler(chatService)
	adminHandler := handlers.NewAdminHandler(adminService)
	visitHandler := handlers.NewVisitHandler(adminService, cfg.JWTSecret)
	router := api.NewRouter(
		chatHandler,
		authHandler,
		userHandler,
		usageHandler,
		adminHandler,
		visitHandler,
		userRepo,
		cfg.AllowedOrigin,
		cfg.JWTSecret,
		cfg.AdminEmail,
		filepath.Dir(cfg.AvatarUploadDir),
	)

	addr := ":" + cfg.ServerPort
	fmt.Printf("Go backend listening on http://localhost%s\n", addr)
	fmt.Printf("Health check: http://localhost%s/api/health\n", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
