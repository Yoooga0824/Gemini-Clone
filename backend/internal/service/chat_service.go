package service

import (
	"context"
	"fmt"
	"strings"

	"gemini-clone/backend/internal/model"
)

// Generator is an interface so service does not depend on a concrete provider.
// This is a classic "dependency inversion" pattern.
type Generator interface {
	GenerateReply(ctx context.Context, userMessage string) (model.AssistantReply, error)
}

// ChatService contains business logic (validation, orchestration).
type ChatService struct {
	generator Generator
}

func NewChatService(generator Generator) *ChatService {
	return &ChatService{generator: generator}
}

// Reply validates input, then asks provider client for the answer.
func (s *ChatService) Reply(ctx context.Context, userMessage string) (model.AssistantReply, error) {
	trimmed := strings.TrimSpace(userMessage)
	if trimmed == "" {
		return model.AssistantReply{}, fmt.Errorf("message cannot be empty")
	}

	return s.generator.GenerateReply(ctx, trimmed)
}
