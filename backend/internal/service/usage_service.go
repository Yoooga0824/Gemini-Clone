package service

import (
	"context"

	"gemini-clone/backend/internal/model"
	"gemini-clone/backend/internal/repository"
)

type UsageService struct {
	usageRepo *repository.UsageRepository
}

func NewUsageService(usageRepo *repository.UsageRepository) *UsageService {
	return &UsageService{usageRepo: usageRepo}
}

func (s *UsageService) RecordChatUsage(ctx context.Context, userID int64, usage *model.TokenUsage, llmModel string) error {
	if usage == nil || userID <= 0 {
		return nil
	}
	return s.usageRepo.Insert(ctx, userID, *usage, llmModel)
}

func (s *UsageService) GetSummary(ctx context.Context, userID int64, days int) (model.UsageSummary, error) {
	return s.usageRepo.GetSummary(ctx, userID, days)
}
