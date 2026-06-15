package model

// ChatRequest is what frontend sends to backend.
// Keep it minimal and easy for beginners.
type ChatRequest struct {
	Message string `json:"message"`
}

// ErrorEnvelope provides a consistent error shape to frontend.
type ErrorEnvelope struct {
	Error ErrorBody `json:"error"`
}

type ErrorBody struct {
	Message string `json:"message"`
}

// OpenAICompatibleResponse is intentionally shaped like:
// /v1/chat/completions basic response, so frontend can parse choices[0].message.content
type OpenAICompatibleResponse struct {
	Choices []Choice `json:"choices"`
}

type Choice struct {
	Message Message `json:"message"`
}

type Message struct {
	Role             string `json:"role"`
	Content          string `json:"content"`
	ReasoningContent string `json:"reasoning_content,omitempty"`
}

// AssistantReply is an internal normalized shape from provider to service.
// Content and reasoning are separated so frontend can render them in different panels.
type AssistantReply struct {
	Content          string
	ReasoningContent string
}

// AssistantReplyDelta is one streamed incremental chunk from upstream.
type AssistantReplyDelta struct {
	Content          string
	ReasoningContent string
}
