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

	DefaultModelKey string
	ModelProviders  map[string]ProviderConfig
	MaxTokens       int
	Temperature     float64

	MySQLDSN        string
	JWTSecret       string
	JWTExpiryHours  int
	AvatarUploadDir string
	AvatarMaxBytes  int64
}

type ProviderConfig struct {
	BaseURL string
	Path    string
	APIKey  string
	Model   string
}

func Load() (Config, error) {
	cfg := Config{
		ServerPort:      getEnv("SERVER_PORT", "8080"),
		AllowedOrigin:   getEnv("ALLOWED_ORIGIN", "http://localhost:3000"),
		DefaultModelKey: strings.ToLower(strings.TrimSpace(getEnv("DEFAULT_CHAT_MODEL", "kimi"))),
		MaxTokens:       getEnvInt("UPSTREAM_MAX_TOKENS", 2048),
		Temperature:     getEnvFloat("UPSTREAM_TEMPERATURE", 0.7),
		MySQLDSN:        strings.TrimSpace(getEnv("MYSQL_DSN", "")),
		JWTSecret:       strings.TrimSpace(getEnv("JWT_SECRET", "")),
		JWTExpiryHours:  getEnvInt("JWT_EXPIRY_HOURS", 168),
		AvatarUploadDir: getEnv("AVATAR_UPLOAD_DIR", "./uploads/avatars"),
		AvatarMaxBytes:  getEnvInt64("AVATAR_MAX_BYTES", 3*1024*1024),
	}

	cfg.ModelProviders = loadProviderConfigs()
	if len(cfg.ModelProviders) == 0 {
		return Config{}, fmt.Errorf("at least one provider API key is required")
	}
	if _, ok := cfg.ModelProviders[cfg.DefaultModelKey]; !ok {
		cfg.DefaultModelKey = firstAvailableModel(cfg.ModelProviders)
	}
	if cfg.MySQLDSN == "" {
		return Config{}, fmt.Errorf("MYSQL_DSN is required")
	}
	if cfg.JWTSecret == "" {
		return Config{}, fmt.Errorf("JWT_SECRET is required")
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

func loadProviderConfigs() map[string]ProviderConfig {
	providers := map[string]ProviderConfig{}
	register := func(key, envPrefix, defaultBaseURL, defaultModel string) {
		apiKey := strings.TrimSpace(getEnv(envPrefix+"_API_KEY", ""))
		if apiKey == "" {
			return
		}
		providers[key] = ProviderConfig{
			BaseURL: strings.TrimSpace(getEnv(envPrefix+"_BASE_URL", defaultBaseURL)),
			Path:    strings.TrimSpace(getEnv(envPrefix+"_API_PATH", "/v1/chat/completions")),
			APIKey:  apiKey,
			Model:   strings.TrimSpace(getEnv(envPrefix+"_MODEL", defaultModel)),
		}
	}

	register("deepseek", "DEEPSEEK", "https://api.deepseek.com", "deepseek-chat")
	register("doubao", "DOUBAO", "https://ark.cn-beijing.volces.com/api/v3", "")
	register("kimi", "KIMI", "https://api.moonshot.cn", "moonshot-v1-8k")
	register("qwen", "QWEN", "https://dashscope.aliyuncs.com/compatible-mode", "qwen-plus")

	legacyAPIKey := strings.TrimSpace(getEnv("UPSTREAM_API_KEY", ""))
	if legacyAPIKey != "" && len(providers) == 0 {
		providers["kimi"] = ProviderConfig{
			BaseURL: strings.TrimSpace(getEnv("UPSTREAM_BASE_URL", "https://api.deepseek.com")),
			Path:    strings.TrimSpace(getEnv("UPSTREAM_PATH", "/v1/chat/completions")),
			APIKey:  legacyAPIKey,
			Model:   strings.TrimSpace(getEnv("UPSTREAM_MODEL", "deepseek-chat")),
		}
	}
	return providers
}

func firstAvailableModel(items map[string]ProviderConfig) string {
	priority := []string{"kimi", "deepseek", "qwen", "doubao"}
	for _, key := range priority {
		if _, ok := items[key]; ok {
			return key
		}
	}
	for key := range items {
		return key
	}
	return "kimi"
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

func getEnvInt64(key string, fallback int64) int64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return fallback
	}
	return n
}
