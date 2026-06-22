import config from "./config.js";

const AUTH_TOKEN_STORAGE_KEY = "authToken";
const USER_PROFILE_STORAGE_KEY = "cachedUserProfile";

const adminNav = document.getElementById("adminNav");
const tabTitle = document.getElementById("tabTitle");
const refreshBtn = document.getElementById("refreshBtn");
const adminIdentity = document.getElementById("adminIdentity");
const adminStatus = document.getElementById("adminStatus");
const usersList = document.getElementById("usersList");
const userDetail = document.getElementById("userDetail");
const visitCards = document.getElementById("visitCards");
const visitTrendTable = document.getElementById("visitTrendTable");
const tokenCards = document.getElementById("tokenCards");
const tokenDailyTable = document.getElementById("tokenDailyTable");
const tokenUsersTable = document.getElementById("tokenUsersTable");
const backToChatBtn = document.getElementById("backToChatBtn");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

let authToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "";
let currentUser = null;
let usersCache = [];
let activeUserID = 0;
let currentTab = "users";

const formatNumber = (value = 0) => Number(value || 0).toLocaleString("zh-CN");

const setStatus = (text = "", isError = false) => {
  if (!adminStatus) return;
  adminStatus.textContent = text;
  adminStatus.style.color = isError ? "#ff91a8" : "";
};

const authFetch = async (url, options = {}) => {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return fetch(url, { ...options, headers });
};

const parseErrorMessage = async (response, fallback = "请求失败") => {
  try {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return data?.error?.message || fallback;
    }
    return (await response.text()) || fallback;
  } catch {
    return fallback;
  }
};

const goChatPage = () => {
  window.location.href = "index.html";
};

const ensureAdmin = async () => {
  if (!authToken) {
    goChatPage();
    return false;
  }
  const response = await authFetch(config.ME_URL, { method: "GET" });
  if (!response.ok) {
    goChatPage();
    return false;
  }
  currentUser = await response.json();
  if (!currentUser?.is_admin) {
    goChatPage();
    return false;
  }
  if (adminIdentity) {
    adminIdentity.textContent = `${currentUser.display_name || "管理员"} · ${currentUser.email || ""}`;
  }
  return true;
};

const setTab = (tab) => {
  currentTab = tab;
  const titleMap = {
    users: "用户管理",
    visits: "访问统计",
    tokens: "Token使用总量",
  };
  tabTitle.textContent = titleMap[tab] || "后台管理";
  document.querySelectorAll(".admin-nav__item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tab);
  });
  document.querySelectorAll(".admin-tab").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.tabContent === tab);
  });
};

const renderUsers = () => {
  if (!usersList) return;
  if (!usersCache.length) {
    usersList.innerHTML = `<div class="detail-placeholder">暂无用户数据</div>`;
    return;
  }
  usersList.innerHTML = usersCache
    .map(
      (user) => `
      <button type="button" class="user-item ${Number(user.id) === Number(activeUserID) ? "is-active" : ""}" data-user-id="${user.id}">
        <div class="user-item__top">
          <span class="user-item__name">${user.display_name || "用户"}${user.is_admin ? "（管理员）" : ""}</span>
          <span>${user.email || "-"}</span>
        </div>
        <div class="user-item__meta">
          今日 ${formatNumber(user.today_tokens)} token · 历史 ${formatNumber(user.total_tokens)} token
        </div>
      </button>
    `
    )
    .join("");
};

const renderUserChats = (sessions = []) => {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return `<div class="detail-placeholder">暂无对话记录</div>`;
  }
  return sessions
    .map(
      (session) => `
      <div class="chat-session">
        <div class="chat-session__title">${session.title || "新聊天"} · ${session.updated_at || "-"}</div>
        ${(session.messages || [])
          .map(
            (message) => `
            <div class="chat-message">
              <div class="role">${message.role || "-"}${message.model ? ` · ${message.model}` : ""} · ${message.created_at || "-"}</div>
              <div>${(message.content || "").replaceAll("<", "&lt;")}</div>
            </div>
          `
          )
          .join("")}
      </div>
    `
    )
    .join("");
};

const fetchUserDetail = async (userID) => {
  setStatus("加载用户详情中...");
  const response = await authFetch(`${config.ADMIN_USERS_URL}/${userID}`, { method: "GET" });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "加载用户详情失败"));
  }
  const detail = await response.json();
  const user = detail?.user || {};
  userDetail.innerHTML = `
    <div class="detail-grid">
      <div><strong>昵称：</strong>${user.display_name || "-"}</div>
      <div><strong>邮箱：</strong>${user.email || "-"}</div>
      <div><strong>姓名：</strong>${user.full_name || "-"}</div>
      <div><strong>今日Token：</strong>${formatNumber(detail?.token_summary?.today_tokens || 0)}</div>
      <div><strong>历史Token：</strong>${formatNumber(detail?.token_summary?.total_tokens || 0)}</div>
      <div><strong>每日上限：</strong>${formatNumber(user.daily_token_limit || 0)}</div>
    </div>
    <div class="detail-block">
      <div class="detail-grid">
        <div class="detail-row">
          <label>修改每日Token上限</label>
          <input id="tokenLimitInput" type="number" min="1" value="${Number(user.daily_token_limit || 1000000)}" />
        </div>
        <div class="detail-row" style="display:flex;align-items:flex-end;">
          <button class="primary-btn" id="saveTokenLimitBtn">保存上限</button>
        </div>
        <div class="detail-row">
          <label>重置密码（至少6位）</label>
          <input id="resetPasswordInput" type="password" minlength="6" placeholder="输入新密码" />
        </div>
        <div class="detail-row" style="display:flex;align-items:flex-end;">
          <button class="primary-btn" id="savePasswordBtn">修改密码</button>
        </div>
      </div>
    </div>
    <div class="detail-block">
      <strong>对话记录</strong>
      ${renderUserChats(detail?.recent_chats || [])}
    </div>
  `;
  bindUserDetailActions(userID);
  setStatus("");
};

const bindUserDetailActions = (userID) => {
  const saveLimitBtn = document.getElementById("saveTokenLimitBtn");
  const tokenLimitInput = document.getElementById("tokenLimitInput");
  const savePasswordBtn = document.getElementById("savePasswordBtn");
  const resetPasswordInput = document.getElementById("resetPasswordInput");

  saveLimitBtn?.addEventListener("click", async () => {
    const nextValue = Number(tokenLimitInput?.value || 0);
    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      setStatus("请输入大于 0 的每日Token上限", true);
      return;
    }
    setStatus("正在保存Token上限...");
    const response = await authFetch(`${config.ADMIN_USERS_URL}/${userID}/token-limit`, {
      method: "PATCH",
      body: JSON.stringify({ daily_token_limit: Math.floor(nextValue) }),
    });
    if (!response.ok) {
      setStatus(await parseErrorMessage(response, "保存失败"), true);
      return;
    }
    setStatus("每日Token上限已更新");
    await loadUsers();
  });

  savePasswordBtn?.addEventListener("click", async () => {
    const password = String(resetPasswordInput?.value || "").trim();
    if (password.length < 6) {
      setStatus("新密码至少 6 位", true);
      return;
    }
    setStatus("正在更新密码...");
    const response = await authFetch(`${config.ADMIN_USERS_URL}/${userID}/password`, {
      method: "PATCH",
      body: JSON.stringify({ new_password: password }),
    });
    if (!response.ok) {
      setStatus(await parseErrorMessage(response, "更新密码失败"), true);
      return;
    }
    resetPasswordInput.value = "";
    setStatus("密码已更新");
  });
};

const loadUsers = async () => {
  const response = await authFetch(config.ADMIN_USERS_URL, { method: "GET" });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "加载用户列表失败"));
  }
  const data = await response.json();
  usersCache = Array.isArray(data?.users) ? data.users : [];
  if (!activeUserID && usersCache.length) {
    activeUserID = Number(usersCache[0].id);
  }
  renderUsers();
  if (activeUserID) {
    await fetchUserDetail(activeUserID);
  }
};

const renderVisitCards = (stats = {}) => {
  visitCards.innerHTML = `
    <div class="stat-card"><div class="stat-card__label">累计访问人数</div><div class="stat-card__value">${formatNumber(stats.total_unique_visitors)}</div></div>
    <div class="stat-card"><div class="stat-card__label">今日访问人数</div><div class="stat-card__value">${formatNumber(stats.today_unique_visitors)}</div></div>
    <div class="stat-card"><div class="stat-card__label">登录访问人数</div><div class="stat-card__value">${formatNumber(stats.logged_in_visitors)}</div></div>
    <div class="stat-card"><div class="stat-card__label">匿名访问人数</div><div class="stat-card__value">${formatNumber(stats.anonymous_visitors)}</div></div>
  `;
};

const loadVisitStats = async () => {
  const response = await authFetch(config.ADMIN_VISIT_STATS_URL, { method: "GET" });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "加载访问统计失败"));
  }
  const stats = await response.json();
  renderVisitCards(stats);
  const trend = Array.isArray(stats?.daily_trend) ? stats.daily_trend : [];
  visitTrendTable.innerHTML = trend
    .map((item) => `<tr><td>${item.date || "-"}</td><td>${formatNumber(item.count || 0)}</td></tr>`)
    .join("");
};

const renderTokenCards = (overview = {}) => {
  tokenCards.innerHTML = `
    <div class="stat-card"><div class="stat-card__label">今日总Token</div><div class="stat-card__value">${formatNumber(overview.today_total_tokens)}</div></div>
    <div class="stat-card"><div class="stat-card__label">历史总Token</div><div class="stat-card__value">${formatNumber(overview.history_total_tokens)}</div></div>
  `;
};

const loadTokenStats = async () => {
  const response = await authFetch(config.ADMIN_TOKEN_STATS_URL, { method: "GET" });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, "加载Token统计失败"));
  }
  const overview = await response.json();
  renderTokenCards(overview);
  tokenDailyTable.innerHTML = (overview?.daily_total || [])
    .map(
      (item) =>
        `<tr><td>${item.date || "-"}</td><td>${formatNumber(item.prompt_tokens || 0)}</td><td>${formatNumber(item.completion_tokens || 0)}</td><td>${formatNumber(item.total_tokens || 0)}</td></tr>`
    )
    .join("");
  tokenUsersTable.innerHTML = (overview?.users || [])
    .map(
      (item) =>
        `<tr><td>${item.display_name || "用户"}<br/><span style="color:#9aa7c0;font-size:12px;">${item.email || ""}</span></td><td>${formatNumber(item.today_tokens || 0)}</td><td>${formatNumber(item.total_tokens || 0)}</td></tr>`
    )
    .join("");
};

const refreshCurrentTab = async () => {
  setStatus("正在刷新...");
  try {
    if (currentTab === "users") {
      await loadUsers();
    } else if (currentTab === "visits") {
      await loadVisitStats();
    } else {
      await loadTokenStats();
    }
    setStatus("刷新完成");
  } catch (error) {
    setStatus(error.message || "刷新失败", true);
  }
};

const bindEvents = () => {
  adminNav?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    const tab = button.dataset.tab;
    if (!tab || tab === currentTab) return;
    setTab(tab);
    void refreshCurrentTab();
  });

  usersList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-user-id]");
    if (!button) return;
    const userID = Number(button.dataset.userId);
    if (!userID) return;
    activeUserID = userID;
    renderUsers();
    void fetchUserDetail(activeUserID);
  });

  refreshBtn?.addEventListener("click", () => {
    void refreshCurrentTab();
  });

  backToChatBtn?.addEventListener("click", () => {
    goChatPage();
  });

  adminLogoutBtn?.addEventListener("click", () => {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
    goChatPage();
  });
};

const init = async () => {
  bindEvents();
  const ok = await ensureAdmin();
  if (!ok) return;
  setTab("users");
  try {
    await Promise.all([loadUsers(), loadVisitStats(), loadTokenStats()]);
    setStatus("数据已加载");
  } catch (error) {
    setStatus(error.message || "初始化失败", true);
  }
};

void init();
