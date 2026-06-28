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
	AdminEmail    string

	ModelProviders                map[string]ProviderConfig
	ModelOrder                    []string
	MaxTokens                     int
	Temperature                   float64
	UpstreamRequestTimeoutSeconds int

	MySQLDSN        string
	JWTSecret       string
	JWTExpiryHours  int
	AvatarUploadDir string
	AvatarMaxBytes  int64

	WebSearchProvider   string
	WebSearchMaxResults int
	TavilyBaseURL       string
	TavilyAPIKey        string
}

type ProviderConfig struct {
	BaseURL string
	Path    string
	APIKey  string
	Model   string
}

type ProviderBlueprint struct {
	Key            string
	EnvPrefix      string
	DefaultBaseURL string
	DefaultPath    string
	DefaultModel   string
}

var providerCatalog = []ProviderBlueprint{
	{
		Key:            "deepseek",
		EnvPrefix:      "DEEPSEEK",
		DefaultBaseURL: "https://api.deepseek.com",
		DefaultPath:    "/v1/chat/completions",
		DefaultModel:   "deepseek-chat",
	},
	{
		Key:            "doubao",
		EnvPrefix:      "DOUBAO",
		DefaultBaseURL: "https://ark.cn-beijing.volces.com/api/v3",
		DefaultPath:    "/chat/completions",
		DefaultModel:   "",
	},
	{
		Key:            "kimi",
		EnvPrefix:      "KIMI",
		DefaultBaseURL: "https://api.moonshot.cn",
		DefaultPath:    "/v1/chat/completions",
		DefaultModel:   "moonshot-v1-8k",
	},
	{
		Key:            "qwen",
		EnvPrefix:      "QWEN",
		DefaultBaseURL: "https://dashscope.aliyuncs.com/compatible-mode",
		DefaultPath:    "/v1/chat/completions",
		DefaultModel:   "qwen-plus",
	},
	{
		Key:            "glm",
		EnvPrefix:      "GLM",
		DefaultBaseURL: "https://open.bigmodel.cn/api/paas",
		DefaultPath:    "/v4/chat/completions",
		DefaultModel:   "glm-4-flash",
	},
}

func Load() (Config, error) {
	cfg := Config{
		ServerPort:                    getEnv("SERVER_PORT", "8080"),
		AllowedOrigin:                 getEnv("ALLOWED_ORIGIN", "http://localhost:3000"),
		AdminEmail:                    strings.ToLower(strings.TrimSpace(getEnv("ADMIN_EMAIL", "17582495726@163.com"))),
		MaxTokens:                     getEnvInt("UPSTREAM_MAX_TOKENS", 2048),
		Temperature:                   getEnvFloat("UPSTREAM_TEMPERATURE", 0.7),
		UpstreamRequestTimeoutSeconds: getEnvInt("UPSTREAM_REQUEST_TIMEOUT_SECONDS", 120),
		MySQLDSN:                      strings.TrimSpace(getEnv("MYSQL_DSN", "")),
		JWTSecret:                     strings.TrimSpace(getEnv("JWT_SECRET", "")),
		JWTExpiryHours:                getEnvInt("JWT_EXPIRY_HOURS", 168),
		AvatarUploadDir:               getEnv("AVATAR_UPLOAD_DIR", "./uploads/avatars"),
		AvatarMaxBytes:                getEnvInt64("AVATAR_MAX_BYTES", 3*1024*1024),
		WebSearchProvider: strings.ToLower(strings.TrimSpace(
			getEnv("WEB_SEARCH_PROVIDER", "tavily"),
		)),
		WebSearchMaxResults: getEnvInt("WEB_SEARCH_MAX_RESULTS", 5),
		TavilyBaseURL:       strings.TrimSpace(getEnv("TAVILY_BASE_URL", "https://api.tavily.com")),
		TavilyAPIKey:        strings.TrimSpace(getEnv("TAVILY_API_KEY", "")),
	}

	cfg.ModelProviders, cfg.ModelOrder = loadProviderConfigs()
	if len(cfg.ModelProviders) == 0 {
		return Config{}, fmt.Errorf("at least one provider API key is required")
	}
	if cfg.MySQLDSN == "" {
		return Config{}, fmt.Errorf("MYSQL_DSN is required")
	}
	if cfg.JWTSecret == "" {
		return Config{}, fmt.Errorf("JWT_SECRET is required")
	}
	if cfg.AdminEmail == "" {
		return Config{}, fmt.Errorf("ADMIN_EMAIL is required")
	}
	if cfg.UpstreamRequestTimeoutSeconds <= 0 {
		cfg.UpstreamRequestTimeoutSeconds = 120
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

func loadProviderConfigs() (map[string]ProviderConfig, []string) {
	providers := map[string]ProviderConfig{}
	order := make([]string, 0, len(providerCatalog))
	register := func(spec ProviderBlueprint) {
		apiKey := strings.TrimSpace(getEnv(spec.EnvPrefix+"_API_KEY", ""))
		if apiKey == "" {
			return
		}
		key := strings.ToLower(strings.TrimSpace(spec.Key))
		providers[key] = ProviderConfig{
			BaseURL: strings.TrimSpace(getEnv(spec.EnvPrefix+"_BASE_URL", spec.DefaultBaseURL)),
			Path:    strings.TrimSpace(getEnv(spec.EnvPrefix+"_API_PATH", spec.DefaultPath)),
			APIKey:  apiKey,
			Model:   strings.TrimSpace(getEnv(spec.EnvPrefix+"_MODEL", spec.DefaultModel)),
		}
		order = append(order, key)
	}

	for _, item := range providerCatalog {
		register(item)
	}
	return providers, order
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
