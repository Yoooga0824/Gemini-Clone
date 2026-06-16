package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"gemini-clone/backend/internal/model"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, email, passwordHash string) (int64, error) {
	query := `
		INSERT INTO users (email, password_hash, display_name)
		VALUES (?, ?, '用户')
	`
	res, err := r.db.ExecContext(ctx, query, strings.ToLower(strings.TrimSpace(email)), passwordHash)
	if err != nil {
		return 0, fmt.Errorf("create user: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("get user id: %w", err)
	}
	return id, nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (model.User, error) {
	query := `
		SELECT id, email, password_hash, display_name, full_name, bio, avatar_path
		FROM users
		WHERE email = ?
		LIMIT 1
	`
	var user model.User
	err := r.db.QueryRowContext(ctx, query, strings.ToLower(strings.TrimSpace(email))).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.DisplayName,
		&user.FullName,
		&user.Bio,
		&user.AvatarPath,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return model.User{}, sql.ErrNoRows
		}
		return model.User{}, fmt.Errorf("get user by email: %w", err)
	}
	return user, nil
}

func (r *UserRepository) GetByID(ctx context.Context, userID int64) (model.User, error) {
	query := `
		SELECT id, email, password_hash, display_name, full_name, bio, avatar_path
		FROM users
		WHERE id = ?
		LIMIT 1
	`
	var user model.User
	err := r.db.QueryRowContext(ctx, query, userID).Scan(
		&user.ID,
		&user.Email,
		&user.PasswordHash,
		&user.DisplayName,
		&user.FullName,
		&user.Bio,
		&user.AvatarPath,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return model.User{}, sql.ErrNoRows
		}
		return model.User{}, fmt.Errorf("get user by id: %w", err)
	}
	return user, nil
}

func (r *UserRepository) UpdateProfile(ctx context.Context, userID int64, req model.UpdateProfileRequest) error {
	query := `
		UPDATE users
		SET display_name = ?, full_name = ?, bio = ?
		WHERE id = ?
	`
	_, err := r.db.ExecContext(
		ctx,
		query,
		strings.TrimSpace(req.DisplayName),
		strings.TrimSpace(req.FullName),
		strings.TrimSpace(req.Bio),
		userID,
	)
	if err != nil {
		return fmt.Errorf("update profile: %w", err)
	}
	return nil
}

func (r *UserRepository) UpdateAvatarPath(ctx context.Context, userID int64, avatarPath string) error {
	query := `UPDATE users SET avatar_path = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, avatarPath, userID)
	if err != nil {
		return fmt.Errorf("update avatar: %w", err)
	}
	return nil
}
