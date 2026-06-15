package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

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

	if wantsStreamResponse(r) {
		h.postChatStream(w, r, req)
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

func (h *ChatHandler) postChatStream(w http.ResponseWriter, r *http.Request, req model.ChatRequest) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeJSON(w, http.StatusInternalServerError, model.ErrorEnvelope{
			Error: model.ErrorBody{Message: "streaming not supported by server"},
		})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	sendEvent := func(payload map[string]string) error {
		data, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	reply, err := h.chatService.StreamReply(r.Context(), req.Message, func(delta model.AssistantReplyDelta) error {
		return sendEvent(map[string]string{
			"type":              "delta",
			"content":           delta.Content,
			"reasoning_content": delta.ReasoningContent,
		})
	})
	if err != nil {
		_ = sendEvent(map[string]string{
			"type":  "error",
			"error": err.Error(),
		})
		return
	}

	_ = sendEvent(map[string]string{
		"type":              "done",
		"content":           reply.Content,
		"reasoning_content": reply.ReasoningContent,
	})
}

func wantsStreamResponse(r *http.Request) bool {
	accept := strings.ToLower(r.Header.Get("Accept"))
	return strings.Contains(accept, "text/event-stream")
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
