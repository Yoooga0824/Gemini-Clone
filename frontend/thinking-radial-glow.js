/**
 * Upper-half chat atmosphere during 深度思考 — radial gradient transitions
 * inspired by Remotion Bits GradientTransition (frame-driven interpolation).
 */

const FADE_IN_MS = 1900;
const FADE_OUT_MS = 2400;
const GRADIENT_CYCLE_MS = 14000;

const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const GRADIENT_KEYFRAMES_DARK = [
  "radial-gradient(circle at 18% 22%, rgba(59, 130, 246, 0.42) 0%, rgba(139, 92, 246, 0.16) 38%, transparent 68%)",
  "radial-gradient(circle at 78% 16%, rgba(168, 85, 247, 0.38) 0%, rgba(236, 72, 153, 0.15) 36%, transparent 66%)",
  "radial-gradient(circle at 52% 8%, rgba(96, 165, 250, 0.34) 0%, rgba(59, 130, 246, 0.12) 44%, transparent 64%)",
  "radial-gradient(circle at 28% 28%, rgba(124, 58, 237, 0.36) 0%, rgba(59, 130, 246, 0.14) 40%, transparent 70%)",
  "radial-gradient(circle at 18% 22%, rgba(59, 130, 246, 0.42) 0%, rgba(139, 92, 246, 0.16) 38%, transparent 68%)",
];

const GRADIENT_KEYFRAMES_LIGHT = [
  "radial-gradient(circle at 18% 22%, rgba(59, 130, 246, 0.22) 0%, rgba(139, 92, 246, 0.09) 38%, transparent 68%)",
  "radial-gradient(circle at 78% 16%, rgba(168, 85, 247, 0.2) 0%, rgba(236, 72, 153, 0.08) 36%, transparent 66%)",
  "radial-gradient(circle at 52% 8%, rgba(96, 165, 250, 0.18) 0%, rgba(59, 130, 246, 0.07) 44%, transparent 64%)",
  "radial-gradient(circle at 28% 28%, rgba(124, 58, 237, 0.19) 0%, rgba(59, 130, 246, 0.08) 40%, transparent 70%)",
  "radial-gradient(circle at 18% 22%, rgba(59, 130, 246, 0.22) 0%, rgba(139, 92, 246, 0.09) 38%, transparent 68%)",
];

// --- Minimal gradient parser / interpolator (Remotion Bits–style, RGB lerp) ---

function splitGradientParts(content) {
  const parts = [];
  let current = "";
  let depth = 0;
  for (const char of content) {
    if (char === "(") {
      depth += 1;
      current += char;
    } else if (char === ")") {
      depth -= 1;
      current += char;
    } else if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseColorStop(stopString) {
  const trimmed = stopString.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.+?)\s+([\d.]+%|[\d.]+px)$/);
  if (match) {
    return { color: match[1].trim(), position: parseFloat(match[2]) };
  }
  return { color: trimmed };
}

function isColorStop(str) {
  const trimmed = str.trim().toLowerCase();
  if (trimmed.includes(" at ") || /\b(circle|ellipse)\b/.test(trimmed)) return false;
  if (trimmed.startsWith("#")) return true;
  if (trimmed.startsWith("rgb")) return true;
  if (trimmed === "transparent") return true;
  return false;
}

function parseRadialGradient(content) {
  const gradient = { type: "radial", shape: "ellipse", position: "center", stops: [] };
  const parts = splitGradientParts(content);
  let startIndex = 0;
  const firstPart = parts[0]?.trim();
  if (firstPart && !isColorStop(firstPart)) {
    const shapeMatch = firstPart.match(/\b(circle|ellipse)\b/);
    if (shapeMatch) gradient.shape = shapeMatch[1];
    const atIndex = firstPart.indexOf(" at ");
    if (atIndex !== -1) gradient.position = firstPart.substring(atIndex + 4).trim();
    startIndex = 1;
  }
  for (let i = startIndex; i < parts.length; i += 1) {
    const stop = parseColorStop(parts[i]);
    if (stop) gradient.stops.push(stop);
  }
  return gradient;
}

function parseGradient(gradientString) {
  const trimmed = gradientString.trim();
  if (!trimmed.startsWith("radial-gradient(")) return null;
  const contentStart = "radial-gradient(".length;
  const lastParen = trimmed.lastIndexOf(")");
  if (lastParen === -1) return null;
  return parseRadialGradient(trimmed.substring(contentStart, lastParen).trim());
}

function normalizeColorStops(stops) {
  if (stops.length === 0) return [];
  if (stops.length === 1) return [{ ...stops[0], position: 50 }];
  const normalized = [{ ...stops[0], position: stops[0].position ?? 0 }];
  const lastStop = stops[stops.length - 1];
  const lastPosition = lastStop.position ?? 100;
  for (let i = 1; i < stops.length - 1; i += 1) {
    if (stops[i].position !== undefined) {
      normalized.push(stops[i]);
    } else {
      let nextWithPosition = stops.length - 1;
      for (let j = i + 1; j < stops.length; j += 1) {
        if (stops[j].position !== undefined) {
          nextWithPosition = j;
          break;
        }
      }
      const prevPosition = normalized[normalized.length - 1].position;
      const nextPosition = stops[nextWithPosition].position ?? lastPosition;
      const step = (nextPosition - prevPosition) / (nextWithPosition - i + 1);
      normalized.push({ ...stops[i], position: prevPosition + step });
    }
  }
  normalized.push({ ...lastStop, position: lastPosition });
  return normalized;
}

function parseGradientPosition(position) {
  const parts = position.trim().split(/\s+/);
  let x = null;
  let y = null;
  for (const part of parts) {
    switch (part) {
      case "left":
        x = 0;
        break;
      case "right":
        x = 100;
        break;
      case "top":
        y = 0;
        break;
      case "bottom":
        y = 100;
        break;
      case "center":
        if (x === null) x = 50;
        else if (y === null) y = 50;
        break;
      default: {
        const val = parseFloat(part);
        if (!Number.isNaN(val)) {
          if (x === null) x = val;
          else y = val;
        }
      }
    }
  }
  return { x: x ?? 50, y: y ?? 50 };
}

function interpolatePositions(from, to, progress) {
  const fromPos = parseGradientPosition(from);
  const toPos = parseGradientPosition(to);
  const x = fromPos.x + (toPos.x - fromPos.x) * progress;
  const y = fromPos.y + (toPos.y - fromPos.y) * progress;
  return `${x}% ${y}%`;
}

function parseColor(color) {
  const trimmed = color.trim().toLowerCase();
  if (trimmed === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const rgbaMatch = trimmed.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
      a: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    };
  }
  const hex = trimmed.replace("#", "");
  if (hex.length === 3) {
    return {
      r: parseInt(hex[0] + hex[0], 16),
      g: parseInt(hex[1] + hex[1], 16),
      b: parseInt(hex[2] + hex[2], 16),
      a: 1,
    };
  }
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }
  return { r: 128, g: 128, b: 128, a: 1 };
}

function formatRgba({ r, g, b, a }) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

function lerpColor(fromColor, toColor, progress) {
  const from = parseColor(fromColor);
  const to = parseColor(toColor);
  return formatRgba({
    r: from.r + (to.r - from.r) * progress,
    g: from.g + (to.g - from.g) * progress,
    b: from.b + (to.b - from.b) * progress,
    a: from.a + (to.a - from.a) * progress,
  });
}

function matchColorStopCount(stops, targetCount) {
  if (stops.length === targetCount) return stops;
  if (stops.length < targetCount) {
    const padded = [...stops];
    while (padded.length < targetCount) padded.push({ ...stops[stops.length - 1] });
    return padded;
  }
  const resampled = [];
  for (let i = 0; i < targetCount; i += 1) {
    const position = (i / (targetCount - 1)) * 100;
    resampled.push({ color: stops[Math.round((position / 100) * (stops.length - 1))].color, position });
  }
  return resampled;
}

function interpolateGradients(from, to, progress) {
  const shape = progress < 0.5 ? from.shape : to.shape;
  const position =
    from.position && to.position
      ? interpolatePositions(from.position, to.position, progress)
      : progress < 0.5
        ? from.position
        : to.position;
  const fromStops = normalizeColorStops(from.stops);
  const toStops = normalizeColorStops(to.stops);
  const maxStops = Math.max(fromStops.length, toStops.length);
  const fromMatched = matchColorStopCount(fromStops, maxStops);
  const toMatched = matchColorStopCount(toStops, maxStops);
  const stops = fromMatched.map((fromStop, i) => {
    const toStop = toMatched[i];
    return {
      color: lerpColor(fromStop.color, toStop.color, progress),
      position: fromStop.position + (toStop.position - fromStop.position) * progress,
    };
  });
  return { type: "radial", shape, position, stops };
}

function gradientToCSS(gradient) {
  const stops = gradient.stops
    .map((stop) => (stop.position !== undefined ? `${stop.color} ${stop.position}%` : stop.color))
    .join(", ");
  const shape = gradient.shape ?? "ellipse";
  const position = gradient.position ?? "center";
  return `radial-gradient(${shape} at ${position}, ${stops})`;
}

function interpolateGradientKeyframes(gradients, progress) {
  if (gradients.length === 0) return "";
  if (gradients.length === 1) return gradients[0];
  const clamped = Math.min(Math.max(progress, 0), 1);
  const segments = gradients.length - 1;
  const segmentProgress = clamped * segments;
  const segmentIndex = Math.min(Math.floor(segmentProgress), segments - 1);
  const localProgress = segmentProgress - segmentIndex;
  const fromGradient = parseGradient(gradients[segmentIndex]);
  const toGradient = parseGradient(gradients[segmentIndex + 1]);
  if (!fromGradient) return gradients[segmentIndex];
  if (!toGradient) return gradients[segmentIndex + 1];
  return gradientToCSS(interpolateGradients(fromGradient, toGradient, localProgress));
}

// --- Glow controller ---

export function createThinkingRadialGlow({ chatContainer } = {}) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const overlay = document.createElement("div");
  overlay.className = "thinking-radial-glow";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="thinking-radial-glow__layer thinking-radial-glow__layer--primary"></div>
    <div class="thinking-radial-glow__layer thinking-radial-glow__layer--secondary"></div>
  `;
  document.body.appendChild(overlay);

  const primaryLayer = overlay.querySelector(".thinking-radial-glow__layer--primary");
  const secondaryLayer = overlay.querySelector(".thinking-radial-glow__layer--secondary");

  let targetActive = false;
  let displayActive = false;
  let opacity = 0;
  let fadeStart = 0;
  let fadeFrom = 0;
  let fadeTo = 0;
  let fadeDuration = FADE_IN_MS;
  let rafId = 0;
  let cycleStart = performance.now();
  let observer = null;

  const getKeyframes = () =>
    root.classList.contains("light_mode") ? GRADIENT_KEYFRAMES_LIGHT : GRADIENT_KEYFRAMES_DARK;

  const applyGradientFrame = (elapsedMs) => {
    const keyframes = getKeyframes();
    const primaryProgress = (elapsedMs % GRADIENT_CYCLE_MS) / GRADIENT_CYCLE_MS;
    const secondaryProgress = ((elapsedMs + GRADIENT_CYCLE_MS * 0.38) % GRADIENT_CYCLE_MS) / GRADIENT_CYCLE_MS;
    primaryLayer.style.background = interpolateGradientKeyframes(keyframes, primaryProgress);
    secondaryLayer.style.background = interpolateGradientKeyframes(keyframes, secondaryProgress);
  };

  const tick = (now) => {
    if (fadeStart) {
      const fadeElapsed = now - fadeStart;
      const raw = Math.min(fadeElapsed / fadeDuration, 1);
      const eased = easeInOutCubic(raw);
      opacity = fadeFrom + (fadeTo - fadeFrom) * eased;
      if (raw >= 1) {
        fadeStart = 0;
        opacity = fadeTo;
        displayActive = targetActive;
        if (!displayActive) {
          overlay.classList.remove("is-active");
          cancelAnimationFrame(rafId);
          rafId = 0;
          return;
        }
      }
    }

    overlay.style.opacity = String(opacity);
    if (displayActive || fadeStart) {
      applyGradientFrame(now - cycleStart);
    }

    rafId = requestAnimationFrame(tick);
  };

  const ensureLoop = () => {
    if (rafId) return;
    cycleStart = performance.now();
    rafId = requestAnimationFrame(tick);
  };

  const beginFade = (toValue) => {
    fadeFrom = opacity;
    fadeTo = toValue;
    fadeDuration = toValue > fadeFrom ? FADE_IN_MS : FADE_OUT_MS;
    fadeStart = performance.now();
    ensureLoop();
  };

  const setActive = (active) => {
    targetActive = Boolean(active);
    if (targetActive) {
      overlay.classList.add("is-active");
      if (reducedMotion) {
        displayActive = true;
        opacity = 0.55;
        overlay.style.opacity = "0.55";
        applyGradientFrame(0);
        return;
      }
      if (opacity <= 0.001 && !fadeStart) displayActive = true;
      beginFade(1);
      return;
    }
    if (reducedMotion) {
      displayActive = false;
      opacity = 0;
      overlay.classList.remove("is-active");
      overlay.style.opacity = "0";
      return;
    }
    beginFade(0);
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

  const themeObserver = new MutationObserver(() => {
    if (displayActive || fadeStart) applyGradientFrame(performance.now() - cycleStart);
  });
  themeObserver.observe(root, { attributes: true, attributeFilter: ["class"] });

  return {
    setActive,
    syncFromDom,
    destroy() {
      observer?.disconnect();
      themeObserver.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      overlay.remove();
    },
  };
}
