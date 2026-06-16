package model

type User struct {
	ID           int64
	Email        string
	PasswordHash string
	DisplayName  string
	FullName     string
	Bio          string
	AvatarPath   string
	CreatedAt    string
	UpdatedAt    string
}

type UserInfo struct {
	ID          int64  `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	FullName    string `json:"full_name"`
	Bio         string `json:"bio"`
	AvatarURL   string `json:"avatar_url"`
}

type UpdateProfileRequest struct {
	DisplayName string `json:"display_name"`
	FullName    string `json:"full_name"`
	Bio         string `json:"bio"`
}
