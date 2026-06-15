package provider

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"gemini-clone/backend/internal/model"
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
	Stream      bool          `json:"stream,omitempty"`
}

type chatMessage struct {
	Role             string `json:"role"`
	Content          string `json:"content"`
	ReasoningContent string `json:"reasoning_content,omitempty"`
}

type chatResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type chatStreamChunk struct {
	Choices []struct {
		Delta struct {
			Content          string `json:"content"`
			ReasoningContent string `json:"reasoning_content"`
			Reasoning        string `json:"reasoning"`
		} `json:"delta"`
		Message chatMessage `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

var thinkTagPattern = regexp.MustCompile(`(?s)<think>\s*(.*?)\s*</think>`)

// GenerateReply sends user message to upstream LLM and returns separated answer/reasoning text.
func (c *OpenAICompatibleClient) GenerateReply(ctx context.Context, userMessage string) (model.AssistantReply, error) {
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
		return model.AssistantReply{}, fmt.Errorf("marshal upstream request: %w", err)
	}

	url := c.baseURL + c.path
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return model.AssistantReply{}, fmt.Errorf("create upstream request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return model.AssistantReply{}, fmt.Errorf("call upstream: %w", err)
	}
	defer resp.Body.Close()

	rawRespBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return model.AssistantReply{}, fmt.Errorf("read upstream response: %w", err)
	}

	var decoded chatResponse
	if err := json.Unmarshal(rawRespBody, &decoded); err != nil {
		return model.AssistantReply{}, fmt.Errorf("decode upstream response: %w", err)
	}

	if resp.StatusCode >= 400 {
		msg := "upstream request failed"
		if decoded.Error != nil && decoded.Error.Message != "" {
			msg = decoded.Error.Message
		}
		return model.AssistantReply{}, fmt.Errorf("%s (status %d)", msg, resp.StatusCode)
	}

	if len(decoded.Choices) == 0 {
		return model.AssistantReply{}, fmt.Errorf("upstream returned no choices")
	}

	content, reasoning := splitReasoningAndContent(
		decoded.Choices[0].Message.Content,
		decoded.Choices[0].Message.ReasoningContent,
	)
	if content == "" && reasoning == "" {
		return model.AssistantReply{}, fmt.Errorf("upstream returned empty reply")
	}

	return model.AssistantReply{
		Content:          content,
		ReasoningContent: reasoning,
	}, nil
}

// StreamReply streams chunks from upstream and returns final normalized assistant reply.
func (c *OpenAICompatibleClient) StreamReply(
	ctx context.Context,
	userMessage string,
	onDelta func(model.AssistantReplyDelta) error,
) (model.AssistantReply, error) {
	payload := chatRequest{
		Model: c.model,
		Messages: []chatMessage{
			{Role: "user", Content: userMessage},
		},
		MaxTokens:   c.maxTokens,
		Temperature: c.temperature,
		Stream:      true,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return model.AssistantReply{}, fmt.Errorf("marshal upstream stream request: %w", err)
	}

	url := c.baseURL + c.path
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return model.AssistantReply{}, fmt.Errorf("create upstream stream request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return model.AssistantReply{}, fmt.Errorf("call upstream stream: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		rawBody, readErr := io.ReadAll(resp.Body)
		if readErr != nil {
			return model.AssistantReply{}, fmt.Errorf("read upstream stream error response: %w", readErr)
		}
		var decoded chatResponse
		_ = json.Unmarshal(rawBody, &decoded)
		msg := "upstream stream request failed"
		if decoded.Error != nil && decoded.Error.Message != "" {
			msg = decoded.Error.Message
		}
		return model.AssistantReply{}, fmt.Errorf("%s (status %d)", msg, resp.StatusCode)
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 2*1024*1024)

	var fullContent strings.Builder
	var fullReasoning strings.Builder

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || !strings.HasPrefix(line, "data:") {
			continue
		}

		payloadLine := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if payloadLine == "" || payloadLine == "[DONE]" {
			continue
		}

		var chunk chatStreamChunk
		if err := json.Unmarshal([]byte(payloadLine), &chunk); err != nil {
			continue
		}
		if chunk.Error != nil && chunk.Error.Message != "" {
			return model.AssistantReply{}, fmt.Errorf("%s", chunk.Error.Message)
		}
		if len(chunk.Choices) == 0 {
			continue
		}

		deltaContent := chunk.Choices[0].Delta.Content
		deltaReasoning := chunk.Choices[0].Delta.ReasoningContent
		if deltaReasoning == "" {
			deltaReasoning = chunk.Choices[0].Delta.Reasoning
		}

		// Some providers send final data in message, not delta.
		if deltaContent == "" && chunk.Choices[0].Message.Content != "" {
			deltaContent = chunk.Choices[0].Message.Content
		}
		if deltaReasoning == "" && chunk.Choices[0].Message.ReasoningContent != "" {
			deltaReasoning = chunk.Choices[0].Message.ReasoningContent
		}

		if deltaContent != "" {
			fullContent.WriteString(deltaContent)
		}
		if deltaReasoning != "" {
			fullReasoning.WriteString(deltaReasoning)
		}

		if onDelta != nil && (deltaContent != "" || deltaReasoning != "") {
			if err := onDelta(model.AssistantReplyDelta{
				Content:          deltaContent,
				ReasoningContent: deltaReasoning,
			}); err != nil {
				return model.AssistantReply{}, err
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return model.AssistantReply{}, fmt.Errorf("read upstream stream: %w", err)
	}

	content, reasoning := splitReasoningAndContent(fullContent.String(), fullReasoning.String())
	if content == "" && reasoning == "" {
		return model.AssistantReply{}, fmt.Errorf("upstream stream returned empty reply")
	}

	return model.AssistantReply{
		Content:          content,
		ReasoningContent: reasoning,
	}, nil
}

func splitReasoningAndContent(content, reasoning string) (string, string) {
	cleanContent := strings.TrimSpace(content)
	cleanReasoning := strings.TrimSpace(reasoning)
	parts := make([]string, 0, 4)
	if cleanReasoning != "" {
		parts = append(parts, cleanReasoning)
	}

	firstThinkTagIndex := strings.Index(cleanContent, "<think>")
	lastThinkEndTagIndex := strings.LastIndex(cleanContent, "</think>")

	if firstThinkTagIndex != -1 && lastThinkEndTagIndex > firstThinkTagIndex {
		thinkBlockStart := firstThinkTagIndex + len("<think>")
		thinkBlock := cleanContent[thinkBlockStart:lastThinkEndTagIndex]
		thinkBlock = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(thinkBlock), "<think>"))
		thinkBlock = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(thinkBlock), "</think>"))
		if thinkBlock != "" {
			parts = append(parts, thinkBlock)
		}
		cleanContent = strings.TrimSpace(
			cleanContent[:firstThinkTagIndex] + cleanContent[lastThinkEndTagIndex+len("</think>"):],
		)
	} else {
		matches := thinkTagPattern.FindAllStringSubmatch(cleanContent, -1)
		if len(matches) > 0 {
			for _, match := range matches {
				if len(match) < 2 {
					continue
				}
				segment := strings.TrimSpace(match[1])
				if segment != "" {
					parts = append(parts, segment)
				}
			}
			cleanContent = strings.TrimSpace(thinkTagPattern.ReplaceAllString(cleanContent, ""))
		}
	}

	cleanContent = strings.TrimSpace(
		strings.NewReplacer("<think>", "", "</think>", "").Replace(cleanContent),
	)

	if cleanReasoning == "" && len(parts) > 0 {
		deduped := make([]string, 0, len(parts))
		seen := make(map[string]struct{}, len(parts))
		for _, p := range parts {
			p = strings.TrimSpace(p)
			if p == "" {
				continue
			}
			if _, ok := seen[p]; ok {
				continue
			}
			seen[p] = struct{}{}
			deduped = append(deduped, p)
		}
		cleanReasoning = strings.Join(deduped, "\n\n")
	}

	return cleanContent, cleanReasoning
}
