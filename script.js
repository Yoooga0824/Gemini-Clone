const messageForm = document.querySelector(".prompt__form");
const chatHistoryContainer = document.querySelector(".chats");

const themeToggleButton = document.getElementById("themeToggler");
const voiceInputButton = document.getElementById("voiceButton");
const attachButton = document.getElementById("attachButton");
const attachMenu = document.getElementById("attachMenu");
const fileInput = document.getElementById("fileInput");
const attachmentList = document.getElementById("attachmentList");

// State variables
let currentUserMessage = null;
let isGeneratingResponse = false;
let pendingAttachments = [];

const MAX_ATTACHMENT_COUNT = 6;
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const MAX_ATTACHMENT_TEXT_CHARS = 12000;
const IMAGE_ACCEPT = "image/*";
const FILE_ACCEPT =
  ".txt,.md,.json,.csv,.js,.ts,.tsx,.go,.py,.java,.c,.cpp,.html,.css,.xml,.yaml,.yml,.pdf";

import config from "./config.js";

// Initialize highlight.js with common languages
hljs.configure({
    languages: ['javascript', 'python', 'bash', 'typescript', 'json', 'html', 'css']
});

// Initialize highlight.js
hljs.highlightAll();

const API_REQUEST_URL = config.BACKEND_API_URL;
const promptInput = messageForm.querySelector(".prompt__form-input");
const themeRoot = document.documentElement;
const headerTypingTitle = document.querySelector(".header__typing-title");
const headerTypingText = document.querySelector(".header__typing-text");
const headerCursor = document.querySelector(".header__cursor");
const PROMPT_INPUT_MIN_HEIGHT = 64;
const PROMPT_INPUT_MAX_HEIGHT = 180;
const SCROLL_FOLLOW_THRESHOLD = 80;
let shouldAutoScroll = true;
const pageScrollRoot = document.scrollingElement || document.documentElement;
const THINK_TAG_PATTERN = /<think>\s*([\s\S]*?)\s*<\/think>/gi;
const ENABLE_REASONING_OUTPUT = true;

const formatBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const escapeHtml = (text = "") =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderPendingAttachments = () => {
  if (!attachmentList) return;
  if (pendingAttachments.length === 0) {
    attachmentList.innerHTML = "";
    return;
  }

  attachmentList.innerHTML = pendingAttachments
    .map(
      (file, index) => `
        <div class="prompt__attachment">
          <span class="prompt__attachment-name" title="${escapeHtml(file.name)}">
            ${escapeHtml(file.name)} · ${formatBytes(file.size)}
          </span>
          <button
            type="button"
            class="prompt__attachment-remove"
            data-attachment-index="${index}"
            aria-label="移除附件"
            title="移除"
          >
            ×
          </button>
        </div>
      `
    )
    .join("");
};

const isProbablyTextFile = (file) => {
  const type = (file?.type || "").toLowerCase();
  if (type.startsWith("text/")) return true;
  if (
    [
      "application/json",
      "application/javascript",
      "application/xml",
      "application/x-yaml",
    ].includes(type)
  ) {
    return true;
  }
  const name = (file?.name || "").toLowerCase();
  return /\.(txt|md|json|csv|js|ts|tsx|go|py|java|c|cpp|html|css|xml|ya?ml)$/i.test(
    name
  );
};

const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error(`读取文件失败: ${file.name}`));
    reader.readAsText(file);
  });

const buildMessageWithAttachments = async (messageText, attachments) => {
  const baseText = (messageText || "").trim();
  if (!attachments || attachments.length === 0) return baseText;

  const attachmentSections = [];
  for (const file of attachments) {
    if (file.type?.startsWith("image/")) {
      attachmentSections.push(`- 图片: ${file.name} (${formatBytes(file.size)})`);
      continue;
    }

    if (isProbablyTextFile(file)) {
      try {
        const fullText = await readFileAsText(file);
        const clippedText = fullText.slice(0, MAX_ATTACHMENT_TEXT_CHARS);
        const clippedSuffix = fullText.length > MAX_ATTACHMENT_TEXT_CHARS ? "\n...[内容已截断]" : "";
        attachmentSections.push(
          `- 文件: ${file.name} (${formatBytes(file.size)})\n\`\`\`\n${clippedText}${clippedSuffix}\n\`\`\``
        );
      } catch {
        attachmentSections.push(`- 文件: ${file.name} (${formatBytes(file.size)}) [读取失败]`);
      }
      continue;
    }

    attachmentSections.push(
      `- 文件: ${file.name} (${formatBytes(file.size)}) [二进制文件，未内联内容]`
    );
  }

  const prefix = baseText || "请结合以下附件信息进行回答：";
  return `${prefix}\n\n[附件]\n${attachmentSections.join("\n")}`.trim();
};

const getActiveScrollElement = () => {
  const canScrollInChats =
    chatHistoryContainer.scrollHeight > chatHistoryContainer.clientHeight + 1;
  return canScrollInChats ? chatHistoryContainer : pageScrollRoot;
};

const isActiveScrollNearBottom = () => {
  const scrollElement = getActiveScrollElement();
  const distanceToBottom =
    scrollElement.scrollHeight -
    scrollElement.scrollTop -
    scrollElement.clientHeight;
  return distanceToBottom <= SCROLL_FOLLOW_THRESHOLD;
};

const scrollChatsToBottom = (behavior = "smooth", force = false) => {
  if (!force && !shouldAutoScroll) return;
  const scrollElement = getActiveScrollElement();
  const targetTop = scrollElement.scrollHeight;

  if (scrollElement === pageScrollRoot) {
    window.scrollTo({ top: targetTop, behavior });
    return;
  }

  scrollElement.scrollTo({ top: targetTop, behavior });
};

const adjustPromptInputHeight = () => {
  if (!promptInput) return;
  promptInput.style.height = "auto";
  const nextHeight = Math.min(
    Math.max(promptInput.scrollHeight, PROMPT_INPUT_MIN_HEIGHT),
    PROMPT_INPUT_MAX_HEIGHT
  );
  const isExpanded = nextHeight > PROMPT_INPUT_MIN_HEIGHT + 2;
  promptInput.style.height = `${nextHeight}px`;
  promptInput.style.overflowY =
    promptInput.scrollHeight > PROMPT_INPUT_MAX_HEIGHT ? "auto" : "hidden";
  promptInput.classList.toggle("prompt__form-input--expanded", isExpanded);
  const shouldLiftHeader = !document.body.classList.contains("hide-header");
  const headerLiftOffset = shouldLiftHeader
    ? Math.max(0, Math.round((nextHeight - PROMPT_INPUT_MIN_HEIGHT) * 0.9))
    : 0;
  themeRoot.style.setProperty("--prompt-expand-shift", `${headerLiftOffset}px`);
};

const extractReasoningAndContentFromMessage = (responseMessage = {}) => {
  const rawContent = typeof responseMessage?.content === "string"
    ? responseMessage.content
    : "";

  const reasoningCandidates = [
    responseMessage?.reasoning_content,
    responseMessage?.reasoning,
    responseMessage?.reasoningContent,
  ];

  const reasoningParts = [];
  for (const candidate of reasoningCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      reasoningParts.push(candidate.trim());
      break;
    }
  }

  let cleanedContent = rawContent;
  const firstThinkTagIndex = rawContent.indexOf("<think>");
  const lastThinkEndTagIndex = rawContent.lastIndexOf("</think>");

  if (firstThinkTagIndex !== -1 && lastThinkEndTagIndex > firstThinkTagIndex) {
    const thinkBlockStart = firstThinkTagIndex + "<think>".length;
    const thinkBlock = rawContent
      .slice(thinkBlockStart, lastThinkEndTagIndex)
      .replace(/^\s*<think>\s*/i, "")
      .replace(/\s*<\/think>\s*$/i, "")
      .trim();

    if (thinkBlock) {
      reasoningParts.push(thinkBlock);
    }

    cleanedContent = (
      rawContent.slice(0, firstThinkTagIndex) +
      rawContent.slice(lastThinkEndTagIndex + "</think>".length)
    ).trim();
  } else {
    const tagMatches = Array.from(rawContent.matchAll(THINK_TAG_PATTERN));
    for (const match of tagMatches) {
      const chunk = (match?.[1] || "").trim();
      if (chunk) {
        reasoningParts.push(chunk);
      }
    }
    cleanedContent = rawContent.replace(THINK_TAG_PATTERN, "").trim();
  }

  cleanedContent = cleanedContent.replace(/<\/?think>/gi, "").trim();
  const dedupedReasoning = [...new Set(reasoningParts)].join("\n\n").trim();

  return {
    content: cleanedContent,
    reasoning: dedupedReasoning,
  };
};

const initReasoningPanelToggle = (incomingMessageElement) => {
  const reasoningPanel = incomingMessageElement.querySelector(".message__reasoning");
  if (!reasoningPanel || reasoningPanel.dataset.bound === "true") return;

  reasoningPanel.dataset.bound = "true";
  reasoningPanel.addEventListener("click", () => {
    if (reasoningPanel.dataset.collapsible !== "true") return;
    const selection = window.getSelection();
    const hasSelectedReasoningText =
      !!selection &&
      !selection.isCollapsed &&
      reasoningPanel.contains(selection.anchorNode) &&
      reasoningPanel.contains(selection.focusNode) &&
      !!selection.toString().trim();
    if (hasSelectedReasoningText) return;
    const collapsed = reasoningPanel.classList.toggle("message__reasoning--collapsed");
    reasoningPanel.dataset.expanded = collapsed ? "false" : "true";
    scrollChatsToBottom("smooth");
  });
};

const renderReasoningPanel = (
  incomingMessageElement,
  reasoningText = "",
  options = {}
) => {
  const { collapseByDefault = true } = options;
  const reasoningPanel = incomingMessageElement.querySelector(".message__reasoning");
  const reasoningTextElement = incomingMessageElement.querySelector(
    ".message__reasoning-text"
  );
  if (!reasoningPanel || !reasoningTextElement) return;
  if (!ENABLE_REASONING_OUTPUT) {
    reasoningPanel.classList.add("hide");
    reasoningTextElement.innerHTML = "";
    reasoningPanel.dataset.collapsible = "false";
    reasoningPanel.dataset.expanded = "false";
    return;
  }

  initReasoningPanelToggle(incomingMessageElement);

  const trimmedReasoning = reasoningText.trim();
  if (!trimmedReasoning) {
    reasoningPanel.classList.remove("hide");
    reasoningPanel.classList.add("message__reasoning--collapsed");
    reasoningTextElement.innerHTML = `<p>本轮没有可展示的思考内容。</p>`;
    reasoningPanel.dataset.collapsible = "false";
    reasoningPanel.dataset.expanded = "false";
    reasoningPanel.classList.add("message__reasoning--empty");
    return;
  }

  reasoningPanel.dataset.collapsible = "true";
  reasoningPanel.classList.remove("message__reasoning--empty");
  reasoningPanel.classList.remove("hide");
  if (collapseByDefault && !reasoningPanel.classList.contains("message__reasoning--collapsed")) {
    reasoningPanel.classList.add("message__reasoning--collapsed");
    reasoningPanel.dataset.expanded = "false";
  } else if (!collapseByDefault) {
    reasoningPanel.classList.remove("message__reasoning--collapsed");
    reasoningPanel.dataset.expanded = "true";
  }
  reasoningTextElement.innerHTML = marked.parse(trimmedReasoning);
};

const showReasoningLoading = (incomingMessageElement) => {
  const reasoningPanel = incomingMessageElement.querySelector(".message__reasoning");
  if (!reasoningPanel) return;
  if (!ENABLE_REASONING_OUTPUT) {
    reasoningPanel.classList.add("hide");
    return;
  }
  reasoningPanel.dataset.collapsible = "false";
  reasoningPanel.dataset.expanded = "false";
  reasoningPanel.classList.add("hide");
};

// Play opening title typing animation on each refresh
const playHeaderTypingAnimation = () => {
  if (!headerTypingTitle || !headerTypingText) return;

  const fullText =
    headerTypingTitle.dataset.fullText || headerTypingText.textContent || "";
  const characters = Array.from(fullText);
  const totalDuration = 750;
  const typingDelay = Math.max(totalDuration / Math.max(characters.length, 1), 1);

  headerTypingText.textContent = "";

  characters.forEach((char, index) => {
    window.setTimeout(() => {
      headerTypingText.textContent += char;
    }, typingDelay * (index + 1));
  });
};

// Pause header cursor while prompt input is focused
const setHeaderCursorPaused = (paused) => {
  if (!headerCursor) return;
  headerCursor.classList.toggle("header__cursor--paused", paused);
};

// Load saved data from local storage
const loadSavedChatHistory = () => {
  localStorage.removeItem("saved-api-chats");
  const isLightTheme = localStorage.getItem("themeColor") === "light_mode";

  themeRoot.classList.toggle("light_mode", isLightTheme);
  themeToggleButton.innerHTML = isLightTheme
    ? '<i class="bx bx-moon"></i>'
    : '<i class="bx bx-sun"></i>';

  chatHistoryContainer.innerHTML = "";
  document.body.classList.remove("hide-header");
};


// create a new chat message element
const createChatMessageElement = (htmlContent, ...cssClasses) => {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", ...cssClasses);
  messageElement.innerHTML = htmlContent;
  return messageElement;
};

// Show typing effect
const showTypingEffect = (
  rawText,
  htmlText,
  messageElement,
  incomingMessageElement,
  skipEffect = false,
  reasoningText = ""
) => {
  const actionsElement = incomingMessageElement.querySelector(".message__actions");
  actionsElement?.classList.add("hide");
  renderReasoningPanel(incomingMessageElement, reasoningText, {
    collapseByDefault: true,
  });

  if (skipEffect) {
    // Display content directly without typing
    messageElement.innerHTML = htmlText;
    hljs.highlightAll();
    addCopyButtonToCodeBlocks();
    actionsElement?.classList.remove("hide");
    isGeneratingResponse = false;
    scrollChatsToBottom("auto");
    return;
  }

  const tokens = Array.from(rawText || "");
  if (tokens.length === 0) {
    messageElement.innerHTML = htmlText;
    hljs.highlightAll();
    addCopyButtonToCodeBlocks();
    actionsElement?.classList.remove("hide");
    isGeneratingResponse = false;
    scrollChatsToBottom("auto");
    return;
  }

  let tokenIndex = 0;
  let streamedText = "";

  const typingInterval = setInterval(() => {
    streamedText += tokens[tokenIndex++];
    messageElement.innerHTML = marked.parse(streamedText);
    scrollChatsToBottom("auto");
    if (tokenIndex === tokens.length) {
      clearInterval(typingInterval);
      isGeneratingResponse = false;
      messageElement.innerHTML = htmlText;
      hljs.highlightAll();
      addCopyButtonToCodeBlocks();
      actionsElement?.classList.remove("hide");
      scrollChatsToBottom("auto");
    }
  }, 25);
};

const consumeAssistantEventStream = async (
  response,
  messageElement,
  incomingMessageElement
) => {
  if (!response.body) {
    throw new Error("stream body unavailable");
  }

  const actionsElement = incomingMessageElement.querySelector(".message__actions");
  actionsElement?.classList.add("hide");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffered = "";
  let visibleContent = "";
  let visibleReasoning = "";
  let renderedContent = "";
  let provisionalReasoningFromContent = "";
  let thinkMode = false;
  let pendingTagPrefix = "";
  let streamStarted = false;
  let streamCompleted = false;
  let contentTypewriterTimer = null;
  const CONTENT_TYPEWRITER_DELAY_MS = 16;

  const stripReasoningOverlap = (contentText, reasoningText) => {
    const content = contentText || "";
    const reasoning = (reasoningText || "").trim();
    if (!reasoning) return content;

    if (content.startsWith(reasoning)) {
      return content.slice(reasoning.length).replace(/^\s+/, "");
    }

    const normalizedReasoning = reasoning.replace(/\s+/g, " ").trim();
    if (!normalizedReasoning) return content;
    const normalizedContentPrefix = content.slice(0, reasoning.length + 32).replace(/\s+/g, " ").trim();
    if (
      normalizedContentPrefix &&
      (normalizedContentPrefix === normalizedReasoning ||
        normalizedContentPrefix.startsWith(normalizedReasoning))
    ) {
      return content.slice(Math.min(content.length, reasoning.length)).replace(/^\s+/, "");
    }

    return content;
  };

  const shouldTreatDeltaContentAsReasoning = (deltaContent, deltaReasoning) => {
    const contentNorm = (deltaContent || "").replace(/\s+/g, " ").trim();
    const reasoningNorm = (deltaReasoning || "").replace(/\s+/g, " ").trim();
    if (!contentNorm || !reasoningNorm) return false;
    return (
      contentNorm === reasoningNorm ||
      contentNorm.startsWith(reasoningNorm) ||
      reasoningNorm.startsWith(contentNorm)
    );
  };

  const getContentTargetForCurrentPhase = () => {
    const contentForDisplay = stripReasoningOverlap(visibleContent, visibleReasoning);
    // Hard gate: never render content before stream completion.
    // This prevents any transient reasoning text from flashing in content area.
    if (!streamCompleted) return "";

    const hasReasoning = ENABLE_REASONING_OUTPUT && (visibleReasoning || "").trim().length > 0;
    if (!hasReasoning) return contentForDisplay || "";

    // Two-phase streaming: reasoning first, then content.
    // Content starts only after reasoning stream is complete.
    return contentForDisplay || "";
  };

  const renderCurrentFrame = () => {
    messageElement.innerHTML = marked.parse(renderedContent || "");
    renderReasoningPanel(incomingMessageElement, visibleReasoning, {
      collapseByDefault: false,
    });
    scrollChatsToBottom("auto");
  };

  const syncContentTypewriter = () => {
    const targetContent = getContentTargetForCurrentPhase();

    if (
      renderedContent.length > targetContent.length ||
      !targetContent.startsWith(renderedContent)
    ) {
      renderedContent = targetContent;
      renderCurrentFrame();
      return;
    }

    if (renderedContent === targetContent) return;
    if (contentTypewriterTimer) return;

    contentTypewriterTimer = setInterval(() => {
      const latestTarget = getContentTargetForCurrentPhase();
      if (
        renderedContent.length > latestTarget.length ||
        !latestTarget.startsWith(renderedContent)
      ) {
        renderedContent = latestTarget;
        clearInterval(contentTypewriterTimer);
        contentTypewriterTimer = null;
        renderCurrentFrame();
        return;
      }

      if (renderedContent.length < latestTarget.length) {
        renderedContent += latestTarget.charAt(renderedContent.length);
        renderCurrentFrame();
      }

      if (renderedContent.length >= latestTarget.length) {
        clearInterval(contentTypewriterTimer);
        contentTypewriterTimer = null;
      }
    }, CONTENT_TYPEWRITER_DELAY_MS);
  };

  const applyRender = () => {
    renderCurrentFrame();
    syncContentTypewriter();
  };

  const splitIncompleteTagSuffix = (segment, tag) => {
    const lowered = segment.toLowerCase();
    const loweredTag = tag.toLowerCase();
    const maxPrefix = Math.min(lowered.length, loweredTag.length - 1);
    for (let i = maxPrefix; i >= 1; i--) {
      if (lowered.endsWith(loweredTag.slice(0, i))) {
        return {
          stablePart: segment.slice(0, -i),
          carryPart: segment.slice(-i),
        };
      }
    }
    return { stablePart: segment, carryPart: "" };
  };

  const routeMixedDelta = (deltaText) => {
    if (!deltaText) return;
    let working = pendingTagPrefix + deltaText;
    pendingTagPrefix = "";

    while (working) {
      if (thinkMode) {
        const closeIndex = working.toLowerCase().indexOf("</think>");
        if (closeIndex === -1) {
          const { stablePart, carryPart } = splitIncompleteTagSuffix(
            working,
            "</think>"
          );
          visibleReasoning += stablePart;
          pendingTagPrefix = carryPart;
          break;
        }
        visibleReasoning += working.slice(0, closeIndex);
        working = working.slice(closeIndex + "</think>".length);
        thinkMode = false;
      } else {
        const openIndex = working.toLowerCase().indexOf("<think>");
        if (openIndex === -1) {
          const { stablePart, carryPart } = splitIncompleteTagSuffix(
            working,
            "<think>"
          );
          visibleContent += stablePart;
          pendingTagPrefix = carryPart;
          break;
        }
        visibleContent += working.slice(0, openIndex);
        working = working.slice(openIndex + "<think>".length);
        thinkMode = true;
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffered += decoder.decode(value, { stream: true });

    let boundaryIndex = buffered.indexOf("\n\n");
    while (boundaryIndex !== -1) {
      const rawEvent = buffered.slice(0, boundaryIndex);
      buffered = buffered.slice(boundaryIndex + 2);

      const dataPayload = rawEvent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");

      if (!dataPayload) {
        boundaryIndex = buffered.indexOf("\n\n");
        continue;
      }

      let eventData;
      try {
        eventData = JSON.parse(dataPayload);
      } catch {
        boundaryIndex = buffered.indexOf("\n\n");
        continue;
      }

      if (eventData.type === "error") {
        throw new Error(eventData.error || "stream failed");
      }

      if (eventData.type === "delta" || eventData.type === "done") {
        if (eventData.type === "done") {
          streamCompleted = true;
          const finalParsed = extractReasoningAndContentFromMessage({
            content:
              typeof eventData.content === "string" ? eventData.content : visibleContent,
            reasoning_content:
              typeof eventData.reasoning_content === "string"
                ? eventData.reasoning_content
                : visibleReasoning,
          });
          visibleContent = finalParsed.content || "";
          visibleReasoning = ENABLE_REASONING_OUTPUT ? finalParsed.reasoning || "" : "";
          thinkMode = false;
          pendingTagPrefix = "";
        } else {
          const hasExplicitReasoningDelta =
            ENABLE_REASONING_OUTPUT &&
            typeof eventData.reasoning_content === "string" &&
            !!eventData.reasoning_content;

          if (
            hasExplicitReasoningDelta
          ) {
            visibleReasoning += eventData.reasoning_content;
          }

          if (typeof eventData.content === "string" && eventData.content) {
            const contentChunk = eventData.content;
            const loweredChunk = contentChunk.toLowerCase();
            const chunkIncludesThinkTag =
              loweredChunk.includes("<think") || loweredChunk.includes("</think");
            const shouldUseProvisionalReasoning =
              ENABLE_REASONING_OUTPUT &&
              !hasExplicitReasoningDelta &&
              !thinkMode &&
              !pendingTagPrefix &&
              !chunkIncludesThinkTag;
            let handledAsProvisionalReasoning = false;

            if (shouldUseProvisionalReasoning) {
              provisionalReasoningFromContent += contentChunk;
              visibleReasoning = provisionalReasoningFromContent;
              handledAsProvisionalReasoning = true;
            }

            if (!handledAsProvisionalReasoning) {
              const overlappedWithReasoning = shouldTreatDeltaContentAsReasoning(
                contentChunk,
                typeof eventData.reasoning_content === "string"
                  ? eventData.reasoning_content
                  : ""
              );
              if (!overlappedWithReasoning) {
                routeMixedDelta(contentChunk);
              }
            }
          }
        }

        if (!streamStarted) {
          incomingMessageElement.classList.remove("message--loading");
          streamStarted = true;
        }
        applyRender();
      }

      boundaryIndex = buffered.indexOf("\n\n");
    }
  }

  incomingMessageElement.classList.remove("message--loading");
  if (contentTypewriterTimer) {
    clearInterval(contentTypewriterTimer);
    contentTypewriterTimer = null;
  }
  applyRender();
  hljs.highlightAll();
  addCopyButtonToCodeBlocks();
  actionsElement?.classList.remove("hide");
  isGeneratingResponse = false;
  scrollChatsToBottom("auto");
};

// Fetch API response based on user input
const requestApiResponse = async (incomingMessageElement) => {
  const messageTextElement =
    incomingMessageElement.querySelector(".message__text");

  try {
    const response = await fetch(API_REQUEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream, application/json",
      },
      body: JSON.stringify({
        message: currentUserMessage,
      }),
    });

    const responseContentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      let errorMessage = "请求失败";
      try {
        if (responseContentType.includes("application/json")) {
          const errorData = await response.json();
          errorMessage = errorData?.error?.message || errorMessage;
        } else {
          errorMessage = (await response.text()) || errorMessage;
        }
      } catch {
        // keep default
      }
      throw new Error(errorMessage);
    }

    if (responseContentType.includes("text/event-stream")) {
      await consumeAssistantEventStream(
        response,
        messageTextElement,
        incomingMessageElement
      );
      return;
    }

    const responseData = await response.json();

    const responseMessage = responseData?.choices?.[0]?.message;
    const { content: responseText, reasoning: reasoningText } =
      extractReasoningAndContentFromMessage(responseMessage);
    if (!responseText && !reasoningText) throw new Error("Invalid API response.");

    const parsedApiResponse = marked.parse(responseText);
    const rawApiResponse = responseText;
    incomingMessageElement.classList.remove("message--loading");

    showTypingEffect(
      rawApiResponse,
      parsedApiResponse,
      messageTextElement,
      incomingMessageElement,
      false,
      reasoningText
    );

    // Chat history persistence is intentionally disabled.
  } catch (error) {
    isGeneratingResponse = false;
    incomingMessageElement.classList.remove("message--loading");
    messageTextElement.innerText = error.message;
    messageTextElement.closest(".message").classList.add("message--error");
  }
};

// Add copy button to code blocks
const addCopyButtonToCodeBlocks = () => {
  const codeBlocks = document.querySelectorAll("pre");
  codeBlocks.forEach((block) => {
    const codeElement = block.querySelector("code");
    let language =
      [...codeElement.classList]
        .find((cls) => cls.startsWith("language-"))
        ?.replace("language-", "") || "Text";

    const languageLabel = document.createElement("div");
    languageLabel.innerText =
      language.charAt(0).toUpperCase() + language.slice(1);
    languageLabel.classList.add("code__language-label");
    block.appendChild(languageLabel);

    const copyButton = document.createElement("button");
    copyButton.innerHTML = `<i class='bx bx-copy'></i>`;
    copyButton.classList.add("code__copy-btn");
    block.appendChild(copyButton);

    copyButton.addEventListener("click", () => {
      navigator.clipboard
        .writeText(codeElement.innerText)
        .then(() => {
          copyButton.innerHTML = `<i class='bx bx-check'></i>`;
          setTimeout(
            () => (copyButton.innerHTML = `<i class='bx bx-copy'></i>`),
            2000
          );
        })
        .catch((err) => {
          console.error("Copy failed:", err);
          alert("Unable to copy text!");
        });
    });
  });
};

// Show loading animation during API request
const displayLoadingAnimation = () => {
  const loadingHtml = `

        <div class="message__content">
            <img class="message__avatar" src="assets/YoooFind.png" alt="Gemini avatar">
            <div class="message__body">
                <div class="message__reasoning hide">
                    <div class="message__reasoning-header">
                        <div class="message__reasoning-title">深度思考</div>
                    </div>
                    <div class="message__reasoning-text"></div>
                </div>
                <div class="message__text"></div>
                <div class="message__thinking-status">深度思考中...</div>
                <div class="message__loading-indicator">
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                </div>
            </div>
        </div>
        <div class="message__actions hide">
            <button type="button" class="message__action-btn" data-action="copy" title="复制"><i class='bx bx-copy-alt'></i></button>
            <button type="button" class="message__action-btn" data-action="like" title="点赞"><i class='bx bx-like'></i></button>
            <button type="button" class="message__action-btn" data-action="dislike" title="点踩"><i class='bx bx-dislike'></i></button>
            <button type="button" class="message__action-btn" data-action="retry" title="重试"><i class='bx bx-refresh'></i></button>
        </div>

    `;

  const loadingMessageElement = createChatMessageElement(
    loadingHtml,
    "message--incoming",
    "message--loading"
  );
  chatHistoryContainer.appendChild(loadingMessageElement);
  showReasoningLoading(loadingMessageElement);
  scrollChatsToBottom("smooth");

  requestApiResponse(loadingMessageElement);
};

// Copy message to clipboard
const copyMessageToClipboard = (copyButton) => {
  const messageRoot = copyButton.closest(".message");
  const messageContent = messageRoot?.querySelector(".message__text")?.innerText || "";
  if (!messageContent) return;

  navigator.clipboard.writeText(messageContent);
  copyButton.innerHTML = `<i class='bx bx-check'></i>`; // Confirmation icon
  setTimeout(
    () => (copyButton.innerHTML = `<i class='bx bx-copy-alt'></i>`),
    1000
  ); // Revert icon after 1 second
};

// Handle sending chat messages
const handleOutgoingMessage = async () => {
  const inputText = messageForm.querySelector(".prompt__form-input").value.trim();
  if ((inputText === "" && pendingAttachments.length === 0) || isGeneratingResponse) return;

  isGeneratingResponse = true;
  shouldAutoScroll = true;

  const activeAttachments = [...pendingAttachments];
  const outgoingText =
    inputText ||
    `已添加附件：${activeAttachments.map((file) => file.name).join("，")}`;
  currentUserMessage = await buildMessageWithAttachments(inputText, activeAttachments);

  const outgoingMessageHtml = `

        <div class="message__content">
            <img class="message__avatar" src="assets/profile.png" alt="User avatar">
            <div class="message__text"></div>
        </div>

    `;

  const outgoingMessageElement = createChatMessageElement(
    outgoingMessageHtml,
    "message--outgoing"
  );
  outgoingMessageElement.querySelector(".message__text").innerText =
    outgoingText;
  chatHistoryContainer.appendChild(outgoingMessageElement);
  scrollChatsToBottom("smooth");

  messageForm.reset(); // Clear input field
  pendingAttachments = [];
  renderPendingAttachments();
  if (fileInput) fileInput.value = "";
  adjustPromptInputHeight();
  themeRoot.style.setProperty("--prompt-expand-shift", "0px");
  document.body.classList.add("hide-header");
  displayLoadingAnimation();
};

const handleFeedbackAction = (buttonElement, actionType) => {
  const messageElement = buttonElement.closest(".message");
  if (!messageElement) return;

  const likeButton = messageElement.querySelector('[data-action="like"]');
  const dislikeButton = messageElement.querySelector('[data-action="dislike"]');
  if (!likeButton || !dislikeButton) return;

  const isLike = actionType === "like";
  const activeButton = isLike ? likeButton : dislikeButton;
  const inactiveButton = isLike ? dislikeButton : likeButton;
  const isActivating = !activeButton.classList.contains("is-active");

  likeButton.classList.remove("is-active");
  dislikeButton.classList.remove("is-active");
  if (isActivating) {
    activeButton.classList.add("is-active");
  }
  inactiveButton.classList.remove("is-active");
};

const retryIncomingMessage = (buttonElement) => {
  if (isGeneratingResponse) return;

  const incomingMessage = buttonElement.closest(".message--incoming");
  if (!incomingMessage) return;

  let previousMessage = incomingMessage.previousElementSibling;
  while (previousMessage && !previousMessage.classList.contains("message--outgoing")) {
    previousMessage = previousMessage.previousElementSibling;
  }

  const previousUserText = previousMessage
    ?.querySelector(".message__text")
    ?.innerText?.trim();
  if (!previousUserText) return;

  promptInput.value = previousUserText;
  promptInput.dispatchEvent(new Event("input", { bubbles: true }));
  currentUserMessage = previousUserText;
  void handleOutgoingMessage();
};

// Toggle between light and dark themes
themeToggleButton.addEventListener("click", () => {
  const isLightTheme = themeRoot.classList.toggle("light_mode");
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");

  // Update icon based on theme
  const newIconClass = isLightTheme ? "bx bx-moon" : "bx bx-sun";
  themeToggleButton.querySelector("i").className = newIconClass;
});

// Voice input (Web Speech API)
voiceInputButton.addEventListener("click", () => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("当前浏览器不支持语音输入，请使用最新版 Chrome 或 Edge。");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const icon = voiceInputButton.querySelector("i");
  icon.className = "bx bx-loader-alt bx-spin";

  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript?.trim();
    if (!transcript) return;
    promptInput.value = transcript;
    promptInput.dispatchEvent(new Event("input", { bubbles: true }));
    promptInput.focus();
  };

  recognition.onerror = () => {
    alert("语音识别失败，请再试一次。");
  };

  recognition.onend = () => {
    icon.className = "bx bx-microphone";
  };

  recognition.start();
});

attachButton?.addEventListener("click", () => {
  if (isGeneratingResponse) return;
  attachMenu?.classList.toggle("hide");
});

attachMenu?.addEventListener("click", (event) => {
  const option = event.target.closest("[data-attach-mode]");
  if (!option || !fileInput) return;
  const mode = option.dataset.attachMode;
  fileInput.accept = mode === "image" ? IMAGE_ACCEPT : FILE_ACCEPT;
  attachMenu.classList.add("hide");
  fileInput.click();
});

fileInput?.addEventListener("change", (event) => {
  const files = Array.from(event.target?.files || []);
  if (files.length === 0) return;

  const nextAttachments = [...pendingAttachments];
  for (const file of files) {
    if (nextAttachments.length >= MAX_ATTACHMENT_COUNT) {
      alert(`最多可上传 ${MAX_ATTACHMENT_COUNT} 个附件`);
      break;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      alert(`"${file.name}" 超过 ${formatBytes(MAX_ATTACHMENT_SIZE)}，已跳过`);
      continue;
    }
    const duplicated = nextAttachments.some(
      (item) =>
        item.name === file.name &&
        item.size === file.size &&
        item.lastModified === file.lastModified
    );
    if (duplicated) continue;
    nextAttachments.push(file);
  }

  pendingAttachments = nextAttachments;
  renderPendingAttachments();
  fileInput.value = "";
});

document.addEventListener("click", (event) => {
  if (!attachMenu || !attachButton) return;
  const clickedInsideMenu = attachMenu.contains(event.target);
  const clickedAttachButton = attachButton.contains(event.target);
  if (!clickedInsideMenu && !clickedAttachButton) {
    attachMenu.classList.add("hide");
  }
});

attachmentList?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-attachment-index]");
  if (!removeButton) return;
  const index = Number(removeButton.dataset.attachmentIndex);
  if (Number.isNaN(index) || index < 0 || index >= pendingAttachments.length) return;
  pendingAttachments.splice(index, 1);
  renderPendingAttachments();
});

promptInput.addEventListener("focus", () => setHeaderCursorPaused(true));
promptInput.addEventListener("blur", () => setHeaderCursorPaused(false));
promptInput.addEventListener("input", adjustPromptInputHeight);
promptInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (e.shiftKey) return;
  e.preventDefault();
  void handleOutgoingMessage();
});
chatHistoryContainer.addEventListener(
  "scroll",
  () => {
    shouldAutoScroll = isActiveScrollNearBottom();
  },
  { passive: true }
);
window.addEventListener(
  "scroll",
  () => {
    shouldAutoScroll = isActiveScrollNearBottom();
  },
  { passive: true }
);
chatHistoryContainer.addEventListener("click", (event) => {
  const actionButton = event.target.closest(".message__action-btn");
  if (!actionButton) return;

  const actionType = actionButton.dataset.action;
  if (actionType === "copy") {
    copyMessageToClipboard(actionButton);
    return;
  }
  if (actionType === "like" || actionType === "dislike") {
    handleFeedbackAction(actionButton, actionType);
    return;
  }
  if (actionType === "retry") {
    retryIncomingMessage(actionButton);
  }
});

// Prevent default from submission and handle outgoing message
messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  void handleOutgoingMessage();
});

// Load saved chat history on page load
playHeaderTypingAnimation();
loadSavedChatHistory();
adjustPromptInputHeight();
