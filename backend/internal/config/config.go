package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	ServerPort    string
	AllowedOrigin string

	UpstreamBaseURL string
	UpstreamPath    string
	UpstreamAPIKey  string
	UpstreamModel   string
	MaxTokens       int
	Temperature     float64
}

func Load() (Config, error) {
	cfg := Config{
		ServerPort:      getEnv("SERVER_PORT", "8080"),
		AllowedOrigin:   getEnv("ALLOWED_ORIGIN", "http://localhost:3000"),
		UpstreamBaseURL: getEnv("UPSTREAM_BASE_URL", "https://api.deepseek.com"),
		UpstreamPath:    getEnv("UPSTREAM_PATH", "/v1/chat/completions"),
		UpstreamAPIKey:  strings.TrimSpace(getEnv("UPSTREAM_API_KEY", "")),
		UpstreamModel:   getEnv("UPSTREAM_MODEL", "deepseek-chat"),
		MaxTokens:       getEnvInt("UPSTREAM_MAX_TOKENS", 2048),
		Temperature:     getEnvFloat("UPSTREAM_TEMPERATURE", 0.7),
	}

	if cfg.UpstreamAPIKey == "" {
		return Config{}, fmt.Errorf("UPSTREAM_API_KEY is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func getEnvFloat(key string, fallback float64) float64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return fallback
	}
	return n
}
