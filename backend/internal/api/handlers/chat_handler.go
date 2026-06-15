package handlers

import (
	"encoding/json"
	"net/http"

	"gemini-clone/backend/internal/model"
	"gemini-clone/backend/internal/service"
)

// ChatHandler handles /api/chat endpoint.
type ChatHandler struct {
	chatService *service.ChatService
}

func NewChatHandler(chatService *service.ChatService) *ChatHandler {
	return &ChatHandler{chatService: chatService}
}

// PostChat accepts frontend message and returns OpenAI-compatible JSON.
func (h *ChatHandler) PostChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, model.ErrorEnvelope{
			Error: model.ErrorBody{Message: "method not allowed"},
		})
		return
	}

	var req model.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorEnvelope{
			Error: model.ErrorBody{Message: "invalid JSON body"},
		})
		return
	}

	reply, err := h.chatService.Reply(r.Context(), req.Message)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, model.ErrorEnvelope{
			Error: model.ErrorBody{Message: err.Error()},
		})
		return
	}

	resp := model.OpenAICompatibleResponse{
		Choices: []model.Choice{
			{
				Message: model.Message{
					Role:             "assistant",
					Content:          reply.Content,
					ReasoningContent: reply.ReasoningContent,
				},
			},
		},
	}

	writeJSON(w, http.StatusOK, resp)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
