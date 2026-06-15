package service

import (
	"context"
	"fmt"
	"strings"

	"gemini-clone/backend/internal/model"
)

type Generator interface {
	GenerateReply(ctx context.Context, userMessage string) (model.AssistantReply, error)
	StreamReply(
		ctx context.Context,
		userMessage string,
		onDelta func(model.AssistantReplyDelta) error,
	) (model.AssistantReply, error)
}

type ChatService struct {
	generator Generator
}

func NewChatService(generator Generator) *ChatService {
	return &ChatService{generator: generator}
}

func (s *ChatService) Reply(ctx context.Context, userMessage string) (model.AssistantReply, error) {
	trimmed := strings.TrimSpace(userMessage)
	if trimmed == "" {
		return model.AssistantReply{}, fmt.Errorf("message cannot be empty")
	}

	return s.generator.GenerateReply(ctx, trimmed)
}

func (s *ChatService) StreamReply(
	ctx context.Context,
	userMessage string,
	onDelta func(model.AssistantReplyDelta) error,
) (model.AssistantReply, error) {
	trimmed := strings.TrimSpace(userMessage)
	if trimmed == "" {
		return model.AssistantReply{}, fmt.Errorf("message cannot be empty")
	}

	return s.generator.StreamReply(ctx, trimmed, onDelta)
}
