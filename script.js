const messageForm = document.querySelector(".prompt__form");
const chatHistoryContainer = document.querySelector(".chats");

const themeToggleButton = document.getElementById("themeToggler");
const voiceInputButton = document.getElementById("voiceButton");

// State variables
let currentUserMessage = null;
let isGeneratingResponse = false;

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
const SCROLL_FOLLOW_THRESHOLD = 80;
let shouldAutoScroll = true;
const pageScrollRoot = document.scrollingElement || document.documentElement;
const THINK_TAG_PATTERN = /<think>\s*([\s\S]*?)\s*<\/think>/gi;

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
  const toggleButton = incomingMessageElement.querySelector(".message__reasoning-toggle");
  if (!reasoningPanel || !toggleButton || toggleButton.dataset.bound === "true") return;

  toggleButton.dataset.bound = "true";
  toggleButton.addEventListener("click", () => {
    const collapsed = reasoningPanel.classList.toggle("message__reasoning--collapsed");
    toggleButton.textContent = collapsed ? "展开" : "收起";
    scrollChatsToBottom("smooth");
  });
};

const renderReasoningPanel = (incomingMessageElement, reasoningText = "") => {
  const reasoningPanel = incomingMessageElement.querySelector(".message__reasoning");
  const reasoningTextElement = incomingMessageElement.querySelector(
    ".message__reasoning-text"
  );
  const toggleButton = incomingMessageElement.querySelector(".message__reasoning-toggle");
  if (!reasoningPanel || !reasoningTextElement || !toggleButton) return;

  initReasoningPanelToggle(incomingMessageElement);

  const trimmedReasoning = reasoningText.trim();
  if (!trimmedReasoning) {
    reasoningPanel.classList.remove("hide");
    reasoningPanel.classList.add("message__reasoning--collapsed");
    toggleButton.textContent = "展开";
    reasoningTextElement.innerHTML = `<p>本轮没有可展示的思考内容。</p>`;
    toggleButton.disabled = true;
    reasoningPanel.classList.add("message__reasoning--empty");
    return;
  }

  toggleButton.disabled = false;
  reasoningPanel.classList.remove("message__reasoning--empty");
  reasoningPanel.classList.remove("hide");
  if (!reasoningPanel.classList.contains("message__reasoning--collapsed")) {
    reasoningPanel.classList.add("message__reasoning--collapsed");
    toggleButton.textContent = "展开";
  }
  reasoningTextElement.innerHTML = marked.parse(trimmedReasoning);
};

const showReasoningLoading = (incomingMessageElement) => {
  const reasoningPanel = incomingMessageElement.querySelector(".message__reasoning");
  if (!reasoningPanel) return;
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
  // We no longer persist chat history across refreshes.
  // Clear old data once so the UI always starts from the welcome screen.
  localStorage.removeItem("saved-api-chats");
  const savedConversations = [];
  const isLightTheme = localStorage.getItem("themeColor") === "light_mode";

  themeRoot.classList.toggle("light_mode", isLightTheme);
  themeToggleButton.innerHTML = isLightTheme
    ? '<i class="bx bx-moon"></i>'
    : '<i class="bx bx-sun"></i>';

  chatHistoryContainer.innerHTML = "";

  // Iterate through saved chat history and display messages
  savedConversations.forEach((conversation) => {
    // Display the user's message
    const userMessageHtml = `

            <div class="message__content">
                <img class="message__avatar" src="assets/profile.png" alt="User avatar">
               <p class="message__text">${conversation.userMessage}</p>
            </div>

        `;

    const outgoingMessageElement = createChatMessageElement(
      userMessageHtml,
      "message--outgoing"
    );
    chatHistoryContainer.appendChild(outgoingMessageElement);

    // Display the API response
    const responseMessage =
      conversation.apiResponse?.choices?.[0]?.message;
    const { content: responseText, reasoning: reasoningText } =
      extractReasoningAndContentFromMessage(responseMessage);
    const fallbackText =
      conversation.apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
    const finalResponseText = responseText || fallbackText || "";
    const parsedApiResponse = marked.parse(finalResponseText); // Convert to HTML
    const rawApiResponse = finalResponseText; // Plain text version

    const responseHtml = `

           <div class="message__content">
                <img class="message__avatar" src="assets/YoooFind.png" alt="Gemini avatar">
                <div class="message__body">
                    <div class="message__reasoning">
                        <div class="message__reasoning-header">
                            <div class="message__reasoning-title">深度思考</div>
                            <button type="button" class="message__reasoning-toggle">展开</button>
                        </div>
                        <div class="message__reasoning-text"></div>
                    </div>
                    <p class="message__text"></p>
                    <div class="message__loading-indicator hide">
                        <div class="message__loading-bar"></div>
                        <div class="message__loading-bar"></div>
                        <div class="message__loading-bar"></div>
                    </div>
                </div>
            </div>
            <span onClick="copyMessageToClipboard(this)" class="message__icon hide"><i class='bx bx-copy-alt'></i></span>

        `;

    const incomingMessageElement = createChatMessageElement(
      responseHtml,
      "message--incoming"
    );
    chatHistoryContainer.appendChild(incomingMessageElement);

    const messageTextElement =
      incomingMessageElement.querySelector(".message__text");

    // Display saved chat without typing effect
    showTypingEffect(
      rawApiResponse,
      parsedApiResponse,
      messageTextElement,
      incomingMessageElement,
      true,
      reasoningText
    ); // 'true' skips typing
  });

  document.body.classList.toggle("hide-header", savedConversations.length > 0);
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
  const copyIconElement =
    incomingMessageElement.querySelector(".message__icon");
  copyIconElement.classList.add("hide"); // Initially hide copy button
  renderReasoningPanel(incomingMessageElement, reasoningText);

  if (skipEffect) {
    // Display content directly without typing
    messageElement.innerHTML = htmlText;
    hljs.highlightAll();
    addCopyButtonToCodeBlocks();
    copyIconElement.classList.remove("hide"); // Show copy button
    isGeneratingResponse = false;
    scrollChatsToBottom("auto");
    return;
  }

  const tokens = Array.from(rawText || "");
  if (tokens.length === 0) {
    messageElement.innerHTML = htmlText;
    hljs.highlightAll();
    addCopyButtonToCodeBlocks();
    copyIconElement.classList.remove("hide");
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
      copyIconElement.classList.remove("hide");
      scrollChatsToBottom("auto");
    }
  }, 25);
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
      },
      body: JSON.stringify({
        message: currentUserMessage,
      }),
    });

    const responseData = await response.json();
    if (!response.ok) throw new Error(responseData?.error?.message || "请求失败");

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
                        <button type="button" class="message__reasoning-toggle">收起</button>
                    </div>
                    <div class="message__reasoning-text"></div>
                </div>
                <p class="message__text"></p>
                <div class="message__loading-indicator">
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                </div>
            </div>
        </div>
        <span onClick="copyMessageToClipboard(this)" class="message__icon hide"><i class='bx bx-copy-alt'></i></span>

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
  const messageContent =
    copyButton.parentElement.querySelector(".message__text").innerText;

  navigator.clipboard.writeText(messageContent);
  copyButton.innerHTML = `<i class='bx bx-check'></i>`; // Confirmation icon
  setTimeout(
    () => (copyButton.innerHTML = `<i class='bx bx-copy-alt'></i>`),
    1000
  ); // Revert icon after 1 second
};

// Handle sending chat messages
const handleOutgoingMessage = () => {
  currentUserMessage =
    messageForm.querySelector(".prompt__form-input").value.trim() ||
    currentUserMessage;
  if (!currentUserMessage || isGeneratingResponse) return; // Exit if no message or already generating response

  isGeneratingResponse = true;
  shouldAutoScroll = true;

  const outgoingMessageHtml = `

        <div class="message__content">
            <img class="message__avatar" src="assets/profile.png" alt="User avatar">
            <p class="message__text"></p>
        </div>

    `;

  const outgoingMessageElement = createChatMessageElement(
    outgoingMessageHtml,
    "message--outgoing"
  );
  outgoingMessageElement.querySelector(".message__text").innerText =
    currentUserMessage;
  chatHistoryContainer.appendChild(outgoingMessageElement);
  scrollChatsToBottom("smooth");

  messageForm.reset(); // Clear input field
  document.body.classList.add("hide-header");
  setTimeout(displayLoadingAnimation, 500); // Show loading animation after delay
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

promptInput.addEventListener("focus", () => setHeaderCursorPaused(true));
promptInput.addEventListener("blur", () => setHeaderCursorPaused(false));
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

// Prevent default from submission and handle outgoing message
messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleOutgoingMessage();
});

// Load saved chat history on page load
playHeaderTypingAnimation();
loadSavedChatHistory();
