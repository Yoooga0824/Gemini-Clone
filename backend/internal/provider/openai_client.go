package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// OpenAICompatibleClient calls any provider that supports
// OpenAI-style chat completions endpoint.
//
// Example providers:
// - DeepSeek official
// - Some OpenAI-compatible gateways
type OpenAICompatibleClient struct {
	baseURL     string
	path        string
	apiKey      string
	model       string
	maxTokens   int
	temperature float64
	httpClient  *http.Client
}

// NewOpenAICompatibleClient creates a reusable API client.
func NewOpenAICompatibleClient(
	baseURL, path, apiKey, model string,
	maxTokens int,
	temperature float64,
) *OpenAICompatibleClient {
	return &OpenAICompatibleClient{
		baseURL:     strings.TrimRight(baseURL, "/"),
		path:        path,
		apiKey:      apiKey,
		model:       model,
		maxTokens:   maxTokens,
		temperature: temperature,
		httpClient: &http.Client{
			Timeout: 45 * time.Second,
		},
	}
}

type chatRequest struct {
	Model       string        `json:"model"`
	Messages    []chatMessage `json:"messages"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
	Temperature float64       `json:"temperature,omitempty"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// GenerateReply sends user message to upstream LLM and returns plain assistant text.
func (c *OpenAICompatibleClient) GenerateReply(ctx context.Context, userMessage string) (string, error) {
	payload := chatRequest{
		Model: c.model,
		Messages: []chatMessage{
			{Role: "user", Content: userMessage},
		},
		MaxTokens:   c.maxTokens,
		Temperature: c.temperature,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal upstream request: %w", err)
	}

	url := c.baseURL + c.path
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("create upstream request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("call upstream: %w", err)
	}
	defer resp.Body.Close()

	rawRespBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read upstream response: %w", err)
	}

	var decoded chatResponse
	if err := json.Unmarshal(rawRespBody, &decoded); err != nil {
		return "", fmt.Errorf("decode upstream response: %w", err)
	}

	if resp.StatusCode >= 400 {
		msg := "upstream request failed"
		if decoded.Error != nil && decoded.Error.Message != "" {
			msg = decoded.Error.Message
		}
		return "", fmt.Errorf("%s (status %d)", msg, resp.StatusCode)
	}

	if len(decoded.Choices) == 0 {
		return "", fmt.Errorf("upstream returned no choices")
	}

	reply := strings.TrimSpace(decoded.Choices[0].Message.Content)
	if reply == "" {
		return "", fmt.Errorf("upstream returned empty reply")
	}

	return reply, nil
}
