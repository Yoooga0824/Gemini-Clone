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
      <div class="thinking-radial-glow__aurora" aria-hidden="true"></div>
      <div class="thinking-radial-glow__flow" aria-hidden="true"></div>
      <div class="thinking-radial-glow__orb thinking-radial-glow__orb--blue"></div>
      <div class="thinking-radial-glow__orb thinking-radial-glow__orb--violet"></div>
      <div class="thinking-radial-glow__orb thinking-radial-glow__orb--pink"></div>
      <div class="thinking-radial-glow__orb thinking-radial-glow__orb--cyan"></div>
      <div class="thinking-radial-glow__orb thinking-radial-glow__orb--amber"></div>
      <div class="thinking-radial-glow__orb thinking-radial-glow__orb--emerald"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const orbs = [
    { el: overlay.querySelector(".thinking-radial-glow__orb--blue"), ax: 22, ay: 16, sx: 0, sy: 0, speed: 0.00042, phase: 0.0 },
    { el: overlay.querySelector(".thinking-radial-glow__orb--violet"), ax: 20, ay: 18, sx: 4, sy: -2, speed: 0.00036, phase: 1.4 },
    { el: overlay.querySelector(".thinking-radial-glow__orb--pink"), ax: 24, ay: 14, sx: -3, sy: 3, speed: 0.00048, phase: 2.6 },
    { el: overlay.querySelector(".thinking-radial-glow__orb--cyan"), ax: 18, ay: 20, sx: 2, sy: 5, speed: 0.00033, phase: 0.8 },
    { el: overlay.querySelector(".thinking-radial-glow__orb--amber"), ax: 16, ay: 15, sx: -2, sy: -4, speed: 0.00039, phase: 3.2 },
    { el: overlay.querySelector(".thinking-radial-glow__orb--emerald"), ax: 21, ay: 17, sx: 3, sy: 2, speed: 0.00044, phase: 4.1 },
  ];

  let flowRafId = 0;

  const isFlowVisible = () =>
    overlay.classList.contains("is-active") ||
    overlay.classList.contains("is-fading-in") ||
    overlay.classList.contains("is-fading-out");

  const applyOrbMotion = (now) => {
    for (const orb of orbs) {
      if (!orb.el) continue;
      const t = now * orb.speed + orb.phase;
      const x = orb.sx + Math.sin(t) * orb.ax + Math.sin(t * 0.73 + 0.6) * (orb.ax * 0.45);
      const y = orb.sy + Math.cos(t * 0.88) * orb.ay + Math.cos(t * 1.12 + 1.1) * (orb.ay * 0.4);
      const scale = 1 + Math.sin(t * 1.25) * 0.1;
      orb.el.style.transform = `translate3d(${x}%, ${y}%, 0) scale(${scale})`;
    }
  };

  const stopFlowLoop = () => {
    if (!flowRafId) return;
    cancelAnimationFrame(flowRafId);
    flowRafId = 0;
  };

  const flowLoop = (now) => {
    if (!isFlowVisible()) {
      stopFlowLoop();
      return;
    }
    applyOrbMotion(now);
    flowRafId = requestAnimationFrame(flowLoop);
  };

  const syncFlowMotion = () => {
    if (isFlowVisible()) {
      if (!flowRafId) flowRafId = requestAnimationFrame(flowLoop);
    } else {
      stopFlowLoop();
    }
  };

  let targetActive = false;
  let observer = null;

  const clearFadeClasses = () => {
    overlay.classList.remove("is-fading-in", "is-fading-out");
  };

  const showInstant = () => {
    clearFadeClasses();
    overlay.classList.add("is-active");
    syncFlowMotion();
  };

  const hideInstant = () => {
    clearFadeClasses();
    overlay.classList.remove("is-active");
    syncFlowMotion();
  };

  const beginFadeIn = () => {
    clearFadeClasses();
    overlay.classList.remove("is-active");
    void overlay.offsetWidth;
    overlay.classList.add("is-fading-in");
    syncFlowMotion();
  };

  const beginFadeOut = () => {
    clearFadeClasses();
    overlay.classList.remove("is-fading-in");
    overlay.classList.add("is-active");
    void overlay.offsetWidth;
    overlay.classList.add("is-fading-out");
    syncFlowMotion();
  };

  overlay.addEventListener("animationend", (event) => {
    if (event.target !== overlay) return;
    if (overlay.classList.contains("is-fading-in")) {
      clearFadeClasses();
      if (targetActive) {
        overlay.classList.add("is-active");
        syncFlowMotion();
      } else {
        hideInstant();
      }
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
      stopFlowLoop();
      overlay.remove();
    },
  };
}
