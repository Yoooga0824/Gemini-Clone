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
	generator    Generator
	usageService *UsageService
	llmModel     string
}

func NewChatService(generator Generator, usageService *UsageService, llmModel string) *ChatService {
	return &ChatService{
		generator:    generator,
		usageService: usageService,
		llmModel:     llmModel,
	}
}

func (s *ChatService) Reply(ctx context.Context, userID int64, userMessage string) (model.AssistantReply, error) {
	trimmed := strings.TrimSpace(userMessage)
	if trimmed == "" {
		return model.AssistantReply{}, fmt.Errorf("message cannot be empty")
	}

	reply, err := s.generator.GenerateReply(ctx, trimmed)
	if err != nil {
		return model.AssistantReply{}, err
	}
	if s.usageService != nil {
		_ = s.usageService.RecordChatUsage(ctx, userID, reply.Usage, s.llmModel)
	}
	return reply, nil
}

func (s *ChatService) StreamReply(
	ctx context.Context,
	userID int64,
	userMessage string,
	onDelta func(model.AssistantReplyDelta) error,
) (model.AssistantReply, error) {
	trimmed := strings.TrimSpace(userMessage)
	if trimmed == "" {
		return model.AssistantReply{}, fmt.Errorf("message cannot be empty")
	}

	reply, err := s.generator.StreamReply(ctx, trimmed, onDelta)
	if err != nil {
		return model.AssistantReply{}, err
	}
	if s.usageService != nil {
		_ = s.usageService.RecordChatUsage(ctx, userID, reply.Usage, s.llmModel)
	}
	return reply, nil
}
