/**
 * 深度思考上半屏光晕 — CSS 光球 + 椭圆径向 reveal（无每帧 JS 渐变，避免卡顿与断条）
 */

export function createThinkingRadialGlow({ chatContainer } = {}) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const overlay = document.createElement("div");
  overlay.className = "thinking-radial-glow";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.pointerEvents = "none";
  overlay.innerHTML = `
    <div class="thinking-radial-glow__vignette">
      <div class="thinking-radial-glow__orb thinking-radial-glow__orb--blue"></div>
      <div class="thinking-radial-glow__orb thinking-radial-glow__orb--violet"></div>
      <div class="thinking-radial-glow__orb thinking-radial-glow__orb--pink"></div>
      <div class="thinking-radial-glow__orb thinking-radial-glow__orb--cyan"></div>
      <div class="thinking-radial-glow__orb thinking-radial-glow__orb--amber"></div>
      <div class="thinking-radial-glow__orb thinking-radial-glow__orb--emerald"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  let targetActive = false;
  let observer = null;

  const clearFadeClasses = () => {
    overlay.classList.remove("is-fading-in", "is-fading-out");
  };

  const showInstant = () => {
    clearFadeClasses();
    overlay.classList.add("is-active");
  };

  const hideInstant = () => {
    clearFadeClasses();
    overlay.classList.remove("is-active");
  };

  const beginFadeIn = () => {
    clearFadeClasses();
    overlay.classList.remove("is-active");
    void overlay.offsetWidth;
    overlay.classList.add("is-fading-in");
  };

  const beginFadeOut = () => {
    clearFadeClasses();
    overlay.classList.remove("is-fading-in");
    overlay.classList.add("is-active");
    void overlay.offsetWidth;
    overlay.classList.add("is-fading-out");
  };

  overlay.addEventListener("animationend", (event) => {
    if (event.target !== overlay) return;
    if (overlay.classList.contains("is-fading-in")) {
      clearFadeClasses();
      if (targetActive) overlay.classList.add("is-active");
      else hideInstant();
      return;
    }
    if (overlay.classList.contains("is-fading-out")) {
      clearFadeClasses();
      if (targetActive) beginFadeIn();
      else hideInstant();
    }
  });

  const setActive = (active) => {
    targetActive = Boolean(active);
    if (targetActive) {
      if (reducedMotion) {
        showInstant();
        return;
      }
      if (overlay.classList.contains("is-active") && !overlay.classList.contains("is-fading-out")) {
        return;
      }
      beginFadeIn();
      return;
    }
    if (reducedMotion) {
      hideInstant();
      return;
    }
    if (!overlay.classList.contains("is-active") && !overlay.classList.contains("is-fading-in")) {
      return;
    }
    beginFadeOut();
  };

  const syncFromDom = () => {
    if (!chatContainer) return;
    setActive(Boolean(chatContainer.querySelector(".message--thinking")));
  };

  if (chatContainer) {
    observer = new MutationObserver(syncFromDom);
    observer.observe(chatContainer, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    syncFromDom();
  }

  return {
    setActive,
    syncFromDom,
    destroy() {
      observer?.disconnect();
      overlay.remove();
    },
  };
}
