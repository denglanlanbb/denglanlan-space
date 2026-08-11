/*
 * 邓兰兰工作台 · API 客户端层（替代 localStorage 版 storage.js）
 *
 * 变更：
 * - 数据持久化从 localStorage 改为云端 PostgreSQL（通过 API 调用）
 * - 密码验证从本机 SHA-256 改为服务端 JWT 登录
 * - 每次数据保存自动触发服务端加密备份
 * - 新增：备份下载、数据导入功能
 *
 * 接口设计：保持与旧版 storage.js 兼容的方法名，减少 app.js 改动量
 */
(function () {
  "use strict";

  const TOKEN_KEY = "mb_jwt_token";

  // ---------- Token 管理 ----------
  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }
  function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
  }

  // ---------- HTTP 封装 ----------
  async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    const resp = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    if (resp.status === 401) {
      clearToken();
      throw new Error("登录已过期");
    }
    if (!resp.ok) {
      let msg = "请求失败";
      try { const j = await resp.json(); msg = j.error || msg; } catch {}
      throw new Error(msg);
    }
    return resp;
  }

  async function apiGet(url) {
    const resp = await apiFetch(url);
    return resp.json();
  }

  async function apiPost(url, body) {
    const resp = await apiFetch(url, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return resp.json();
  }

  async function apiDelete(url) {
    const resp = await apiFetch(url, { method: "DELETE" });
    return resp.json();
  }

  // ---------- 登录状态 ----------
  function hasPassword() {
    return !!getToken();
  }

  async function login(username, password) {
    const result = await apiPost("/api/auth/login", { username, password });
    setToken(result.token);
    return result;
  }

  // ---------- 数据读写 ----------
  function defaultData() {
    return {
      createdAt: new Date().toISOString(),
      lastVisit: null,
      daily: {},
      exerciseLog: {},
      wrongBook: {},
      paperLog: {},
      notes: {},
      favorites: {}
    };
  }

  async function loadData() {
    try {
      const data = await apiGet("/api/data");
      return Object.assign(defaultData(), data);
    } catch (e) {
      console.error("[API] 加载数据失败:", e.message);
      throw e;
    }
  }

  // 防抖保存：800ms 内多次调用合并为一次 API 请求
  let saveTimer = null;
  let savePromise = null;

  function saveData(d) {
    d.lastVisit = new Date().toISOString();
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await apiPost("/api/data", d);
        console.debug("[API] 数据已保存到云端");
      } catch (e) {
        console.warn("[API] 保存失败:", e.message);
      }
    }, 800);
  }

  // 即时保存（不等防抖，用于关键操作）
  async function saveDataNow(d) {
    d.lastVisit = new Date().toISOString();
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try {
      return await apiPost("/api/data", d);
    } catch (e) {
      console.warn("[API] 即时保存失败:", e.message);
      throw e;
    }
  }

  async function resetAll() {
    return await apiDelete("/api/data");
  }

  // ---------- 修改密码 ----------
  async function changePassword(currentPassword, newPassword) {
    return await apiPost("/api/auth/change-password", { currentPassword, newPassword });
  }

  // ---------- 备份下载 ----------
  async function downloadBackup() {
    const token = getToken();
    const resp = await fetch("/api/backup/latest", {
      headers: { "Authorization": "Bearer " + token },
    });
    if (resp.status === 401) { clearToken(); throw new Error("登录已过期"); }
    if (!resp.ok) {
      let msg = "下载失败";
      try { const j = await resp.json(); msg = j.error || msg; } catch {}
      throw new Error(msg);
    }
    const blob = await resp.blob();
    const disposition = resp.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : "backup.json.enc";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function listBackups() {
    return await apiGet("/api/backup/list");
  }

  // ---------- 数据导入 ----------
  async function importData(jsonObj) {
    return await apiPost("/api/data/import", jsonObj);
  }

  // ---------- 云端同步（兼容旧接口，现为空操作） ----------
  function isCloudEnabled() { return true; }
  function setCloudEnabled() {}
  async function syncToCloud() { return true; }
  async function pullFromCloud() { return null; }

  // ---------- 导出 ----------
  window.MB_STORE = {
    // Token
    getToken, setToken, clearToken,
    // 登录
    hasPassword, login,
    // 数据
    defaultData, loadData, saveData, saveDataNow, resetAll, importData,
    // 密码
    changePassword,
    // 备份
    downloadBackup, listBackups,
    // 兼容
    isCloudEnabled, setCloudEnabled, syncToCloud, pullFromCloud,
  };
})();
