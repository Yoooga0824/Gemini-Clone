package service

import (
	"context"
	"database/sql"
	"fmt"
	"math"
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

type ChatStore interface {
	CreateSession(ctx context.Context, userID int64, title string) (model.ChatSessionSummary, error)
	GetSession(ctx context.Context, userID, sessionID int64) (model.ChatSessionSummary, error)
	DeleteSession(ctx context.Context, userID, sessionID int64) error
	ListSessions(ctx context.Context, userID int64, limit int) ([]model.ChatSessionSummary, error)
	ListSessionMessages(ctx context.Context, userID, sessionID int64) ([]model.ChatMessageItem, error)
	ListRecentTurns(ctx context.Context, userID, sessionID int64, limit int) ([]model.ChatTurn, error)
	SaveTurn(ctx context.Context, userID, sessionID int64, userMessage, assistantContent, assistantReasoning string) error
	UpdateSessionTitle(ctx context.Context, userID, sessionID int64, title string) error
}

type ChatService struct {
	generator    Generator
	store        ChatStore
	usageService *UsageService
	llmModel     string
}

func NewChatService(generator Generator, store ChatStore, usageService *UsageService, llmModel string) *ChatService {
	return &ChatService{
		generator:    generator,
		store:        store,
		usageService: usageService,
		llmModel:     llmModel,
	}
}

func (s *ChatService) Reply(
	ctx context.Context,
	userID int64,
	sessionID int64,
	userMessage string,
) (model.AssistantReply, model.ChatSessionSummary, error) {
	trimmed := strings.TrimSpace(userMessage)
	if trimmed == "" {
		return model.AssistantReply{}, model.ChatSessionSummary{}, fmt.Errorf("message cannot be empty")
	}
	if userID <= 0 {
		return model.AssistantReply{}, model.ChatSessionSummary{}, fmt.Errorf("user not authenticated")
	}

	session, err := s.ensureSession(ctx, userID, sessionID, trimmed)
	if err != nil {
		return model.AssistantReply{}, model.ChatSessionSummary{}, err
	}
	contextMessage, err := s.buildMessageWithRecentTurns(ctx, userID, session.ID, trimmed)
	if err != nil {
		return model.AssistantReply{}, model.ChatSessionSummary{}, err
	}

	reply, err := s.generator.GenerateReply(ctx, contextMessage)
	if err != nil {
		return model.AssistantReply{}, model.ChatSessionSummary{}, err
	}
	if err := s.store.SaveTurn(ctx, userID, session.ID, trimmed, reply.Content, reply.ReasoningContent); err != nil {
		return model.AssistantReply{}, model.ChatSessionSummary{}, err
	}
	if err := s.syncSessionTitle(ctx, userID, session, trimmed); err != nil {
		return model.AssistantReply{}, model.ChatSessionSummary{}, err
	}
	session, err = s.store.GetSession(ctx, userID, session.ID)
	if err != nil {
		return model.AssistantReply{}, model.ChatSessionSummary{}, err
	}
	if s.usageService != nil {
		usage := ensureTokenUsage(reply.Usage, contextMessage, reply)
		_ = s.usageService.RecordChatUsage(ctx, userID, usage, s.llmModel)
	}
	return reply, session, nil
}

func (s *ChatService) StreamReply(
	ctx context.Context,
	userID int64,
	sessionID int64,
	userMessage string,
	onDelta func(model.AssistantReplyDelta) error,
) (model.AssistantReply, model.ChatSessionSummary, error) {
	trimmed := strings.TrimSpace(userMessage)
	if trimmed == "" {
		return model.AssistantReply{}, model.ChatSessionSummary{}, fmt.Errorf("message cannot be empty")
	}
	if userID <= 0 {
		return model.AssistantReply{}, model.ChatSessionSummary{}, fmt.Errorf("user not authenticated")
	}

	session, err := s.ensureSession(ctx, userID, sessionID, trimmed)
	if err != nil {
		return model.AssistantReply{}, model.ChatSessionSummary{}, err
	}
	contextMessage, err := s.buildMessageWithRecentTurns(ctx, userID, session.ID, trimmed)
	if err != nil {
		return model.AssistantReply{}, model.ChatSessionSummary{}, err
	}

	reply, err := s.generator.StreamReply(ctx, contextMessage, onDelta)
	if err != nil {
		return model.AssistantReply{}, model.ChatSessionSummary{}, err
	}
	if err := s.store.SaveTurn(ctx, userID, session.ID, trimmed, reply.Content, reply.ReasoningContent); err != nil {
		return model.AssistantReply{}, model.ChatSessionSummary{}, err
	}
	if err := s.syncSessionTitle(ctx, userID, session, trimmed); err != nil {
		return model.AssistantReply{}, model.ChatSessionSummary{}, err
	}
	session, err = s.store.GetSession(ctx, userID, session.ID)
	if err != nil {
		return model.AssistantReply{}, model.ChatSessionSummary{}, err
	}
	if s.usageService != nil {
		usage := ensureTokenUsage(reply.Usage, contextMessage, reply)
		_ = s.usageService.RecordChatUsage(ctx, userID, usage, s.llmModel)
	}
	return reply, session, nil
}

func (s *ChatService) ListSessions(ctx context.Context, userID int64) ([]model.ChatSessionSummary, error) {
	if userID <= 0 {
		return nil, fmt.Errorf("user not authenticated")
	}
	return s.store.ListSessions(ctx, userID, 30)
}

func (s *ChatService) GetSessionDetail(
	ctx context.Context,
	userID int64,
	sessionID int64,
) (model.ChatSessionSummary, []model.ChatMessageItem, error) {
	if userID <= 0 {
		return model.ChatSessionSummary{}, nil, fmt.Errorf("user not authenticated")
	}
	session, err := s.store.GetSession(ctx, userID, sessionID)
	if err != nil {
		if err == sql.ErrNoRows {
			return model.ChatSessionSummary{}, nil, fmt.Errorf("session not found")
		}
		return model.ChatSessionSummary{}, nil, err
	}
	messages, err := s.store.ListSessionMessages(ctx, userID, sessionID)
	if err != nil {
		return model.ChatSessionSummary{}, nil, err
	}
	return session, messages, nil
}

func (s *ChatService) DeleteSession(ctx context.Context, userID, sessionID int64) error {
	if userID <= 0 {
		return fmt.Errorf("user not authenticated")
	}
	if sessionID <= 0 {
		return fmt.Errorf("invalid session id")
	}
	if err := s.store.DeleteSession(ctx, userID, sessionID); err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("session not found")
		}
		return err
	}
	return nil
}

func (s *ChatService) ensureSession(
	ctx context.Context,
	userID int64,
	sessionID int64,
	userMessage string,
) (model.ChatSessionSummary, error) {
	if sessionID > 0 {
		session, err := s.store.GetSession(ctx, userID, sessionID)
		if err != nil {
			if err == sql.ErrNoRows {
				return model.ChatSessionSummary{}, fmt.Errorf("session not found")
			}
			return model.ChatSessionSummary{}, err
		}
		return session, nil
	}
	return s.store.CreateSession(ctx, userID, buildSessionTitle(userMessage))
}

func (s *ChatService) buildMessageWithRecentTurns(
	ctx context.Context,
	userID int64,
	sessionID int64,
	currentMessage string,
) (string, error) {
	turns, err := s.store.ListRecentTurns(ctx, userID, sessionID, 5)
	if err != nil {
		return "", err
	}
	if len(turns) == 0 {
		return currentMessage, nil
	}

	var builder strings.Builder
	builder.WriteString("你会收到当前对话的最近历史，请仅将其作为上下文，不要机械复述。\n\n")
	builder.WriteString("[最近历史]\n")
	for _, turn := range turns {
		if turn.UserMessage != "" {
			builder.WriteString("用户: ")
			builder.WriteString(turn.UserMessage)
			builder.WriteString("\n")
		}
		if turn.AssistantContent != "" {
			builder.WriteString("助手: ")
			builder.WriteString(turn.AssistantContent)
			builder.WriteString("\n")
		}
	}
	builder.WriteString("\n[当前问题]\n")
	builder.WriteString(currentMessage)
	return builder.String(), nil
}

func (s *ChatService) syncSessionTitle(
	ctx context.Context,
	userID int64,
	session model.ChatSessionSummary,
	userMessage string,
) error {
	if strings.TrimSpace(session.Title) != "新聊天" {
		return nil
	}
	return s.store.UpdateSessionTitle(ctx, userID, session.ID, buildSessionTitle(userMessage))
}

func buildSessionTitle(text string) string {
	normalized := strings.Join(strings.Fields(strings.TrimSpace(text)), " ")
	if normalized == "" {
		return "新聊天"
	}
	runes := []rune(normalized)
	if len(runes) > 18 {
		return string(runes[:18]) + "..."
	}
	return normalized
}

func ensureTokenUsage(
	raw *model.TokenUsage,
	prompt string,
	reply model.AssistantReply,
) *model.TokenUsage {
	if raw != nil && raw.TotalTokens > 0 {
		return raw
	}

	promptTokens := estimateTokenCount(prompt)
	completionText := strings.TrimSpace(strings.Join([]string{
		reply.Content,
		reply.ReasoningContent,
	}, "\n"))
	completionTokens := estimateTokenCount(completionText)

	if promptTokens == 0 && completionTokens == 0 {
		return nil
	}

	return &model.TokenUsage{
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TotalTokens:      promptTokens + completionTokens,
	}
}

func estimateTokenCount(text string) int {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return 0
	}
	runes := len([]rune(trimmed))
	approx := int(math.Ceil(float64(runes) / 4.0))
	if approx < 1 {
		return 1
	}
	return approx
}
