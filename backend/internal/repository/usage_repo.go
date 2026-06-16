package repository

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"gemini-clone/backend/internal/model"
)

type UsageRepository struct {
	db *sql.DB
}

func NewUsageRepository(db *sql.DB) *UsageRepository {
	return &UsageRepository{db: db}
}

func (r *UsageRepository) Insert(ctx context.Context, userID int64, usage model.TokenUsage, llmModel string) error {
	query := `
		INSERT INTO token_usage (user_id, prompt_tokens, completion_tokens, total_tokens, model)
		VALUES (?, ?, ?, ?, ?)
	`
	_, err := r.db.ExecContext(
		ctx,
		query,
		userID,
		usage.PromptTokens,
		usage.CompletionTokens,
		usage.TotalTokens,
		llmModel,
	)
	if err != nil {
		return fmt.Errorf("insert token usage: %w", err)
	}
	return nil
}

func (r *UsageRepository) GetSummary(ctx context.Context, userID int64, days int) (model.UsageSummary, error) {
	if days <= 0 {
		days = 30
	}
	fromDate := time.Now().AddDate(0, 0, -days+1).Format("2006-01-02")

	totalQuery := `
		SELECT COALESCE(SUM(prompt_tokens), 0), COALESCE(SUM(completion_tokens), 0), COALESCE(SUM(total_tokens), 0)
		FROM token_usage
		WHERE user_id = ? AND DATE(created_at) >= ?
	`
	var summary model.UsageSummary
	if err := r.db.QueryRowContext(ctx, totalQuery, userID, fromDate).Scan(
		&summary.Total.PromptTokens,
		&summary.Total.CompletionTokens,
		&summary.Total.TotalTokens,
	); err != nil {
		return model.UsageSummary{}, fmt.Errorf("query token usage total: %w", err)
	}

	byDayQuery := `
		SELECT DATE(created_at) AS d,
		       COALESCE(SUM(prompt_tokens), 0),
		       COALESCE(SUM(completion_tokens), 0),
		       COALESCE(SUM(total_tokens), 0)
		FROM token_usage
		WHERE user_id = ? AND DATE(created_at) >= ?
		GROUP BY DATE(created_at)
		ORDER BY d ASC
	`
	rows, err := r.db.QueryContext(ctx, byDayQuery, userID, fromDate)
	if err != nil {
		return model.UsageSummary{}, fmt.Errorf("query token usage by day: %w", err)
	}
	defer rows.Close()

	points := make([]model.UsagePoint, 0, days)
	for rows.Next() {
		var point model.UsagePoint
		if err := rows.Scan(
			&point.Date,
			&point.PromptTokens,
			&point.CompletionTokens,
			&point.TotalTokens,
		); err != nil {
			return model.UsageSummary{}, fmt.Errorf("scan token usage by day: %w", err)
		}
		points = append(points, point)
	}
	if err := rows.Err(); err != nil {
		return model.UsageSummary{}, fmt.Errorf("iterate token usage by day: %w", err)
	}

	summary.ByDay = points
	return summary, nil
}
