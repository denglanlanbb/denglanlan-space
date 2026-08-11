/*
 * 邓兰兰工作台 · 2027 中级会计学习 · 主逻辑
 */
(function () {
  "use strict";

  const D = window.MB_DATA;
  const S = window.MB_STORE;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const el = (tag, attrs = {}, html) => {
    const e = document.createElement(tag);
    for (const k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "dataset") Object.assign(e.dataset, attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if (html != null) e.innerHTML = html;
    return e;
  };
  const esc = s => (s == null ? "" : String(s)).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- 日期/轮换 ----------
  function dayDiff(a, b) {
    const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((db - da) / 86400000);
  }
  function todayStr() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }
  function getDayIndex() {
    const anchor = new Date(2026, 0, 1);
    const idx = ((dayDiff(anchor, new Date()) % D.plan.cycleDays) + D.plan.cycleDays) % D.plan.cycleDays;
    return idx;
  }

  // ---------- 全局状态 ----------
  let data = null;
  let view = { tab: "today", subject: null, ch: null };
  let sideNav = null;
  let subjExpand = {}; // 科目id -> 是否在侧边栏展开

  function go(tab, opts = {}) {
    view = Object.assign({ tab, subject: null, ch: null }, opts);
    render();
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  // ============ 登录门 ============
  function renderGate() {
    const app = $("#app");
    app.innerHTML = "";
    app.classList.remove("app-shell");
    const wrap = el("div", { class: "gate" });
    wrap.innerHTML = `
      <div class="gate-card">
        <h1>📚 邓兰兰工作台</h1>
        <p class="gate-sub">云端版 · 请登录</p>
        <input id="loginUser" type="text" placeholder="用户名" autocomplete="username"/>
        <input id="loginPwd" type="password" placeholder="密码" autocomplete="current-password"/>
        <div class="gate-err" id="gateErr"></div>
        <button class="btn-primary" id="loginBtn">登录</button>
        <p class="gate-tip">数据存储于云端数据库，关闭电脑后仍可通过公网网址访问。<br>忘记密码请联系管理员通过环境变量重置。</p>
      </div>`;
    app.appendChild(wrap);
    const tryLogin = async () => {
      const u = $("#loginUser").value.trim();
      const p = $("#loginPwd").value;
      const err = $("#gateErr");
      if (!u || !p) { err.textContent = "请输入用户名和密码"; return; }
      err.textContent = "";
      try {
        await S.login(u, p);
        enterApp();
      } catch (e) {
        err.textContent = e.message || "登录失败";
      }
    };
    $("#loginBtn").onclick = tryLogin;
    $("#loginPwd").addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });
  }

  async function enterApp() {
    try {
      data = await S.loadData();
    } catch (e) {
      S.clearToken();
      renderGate();
      return;
    }
    renderShell();
    render();
  }

  // ============ 外壳 / 左侧菜单栏 ============
  function buildSidebar() {
    const side = el("aside", { class: "sidebar" });
    const nav = el("nav", { class: "side-nav" });
    nav.innerHTML = `
      <button class="tab" data-tab="today">📅 今日学习</button>
      <button class="tab" data-tab="analysis">📊 三科考情</button>
      <button class="tab" data-tab="exercise">📝 专题练习</button>
      <button class="tab" data-tab="paper">📜 历年真题</button>
      <div class="side-label">📚 考试科目（点击展开知识点）</div>`;

    D.subjects.forEach(sub => {
      const head = el("div", { class: "subj-head" });
      const caret = el("span", { class: "subj-caret" + (subjExpand[sub.id] ? " open" : "") }, "▸");
      const name = el("button", { class: "subj-name", dataset: { subject: sub.id } }, sub.name);
      head.append(caret, name);
      const unitsWrap = el("div", { class: "subj-units" + (subjExpand[sub.id] ? " open" : "") });
      sub.units.forEach(u => {
        const li = el("button", { class: "subj-unit", dataset: { subject: sub.id, ch: u.ch } }, u.ch);
        unitsWrap.appendChild(li);
      });
      caret.onclick = (e) => {
        e.stopPropagation();
        subjExpand[sub.id] = !subjExpand[sub.id];
        caret.classList.toggle("open", subjExpand[sub.id]);
        unitsWrap.classList.toggle("open", subjExpand[sub.id]);
      };
      name.onclick = () => go("subject", { subject: sub.id });
      unitsWrap.querySelectorAll(".subj-unit").forEach(li => li.onclick = () => go("kp", { subject: li.dataset.subject, ch: li.dataset.ch }));
      nav.append(head, unitsWrap);
    });

    const tail = el("div");
    tail.innerHTML = `
      <button class="tab" data-tab="wrongbook">📕 收藏错题</button>
      <button class="tab" data-tab="progress">📈 我的进度</button>
      <button class="tab" data-tab="settings">⚙️ 设置</button>`;
    nav.appendChild(tail);
    side.appendChild(nav);
    side.appendChild(el("div", { class: "side-foot" }, "本机保存 · 云端可选"));
    return { side, nav };
  }

  function setActiveNav(nav) {
    nav.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === view.tab));
    nav.querySelectorAll(".subj-name").forEach(b => b.classList.toggle("active-subj", view.subject === b.dataset.subject));
  }

  function renderShell() {
    const app = $("#app");
    app.innerHTML = "";
    app.classList.add("app-shell");
    const layout = el("div", { class: "layout" });
    const { side, nav } = buildSidebar();
    sideNav = nav;
    nav.addEventListener("click", e => { const t = e.target.closest("[data-tab]"); if (t) go(t.dataset.tab); });
    const content = el("div", { class: "content" });
    content.innerHTML = `
      <header class="topbar">
        <div class="top-meta" id="topMeta"></div>
        <button class="btn-ghost" id="logout">锁定</button>
      </header>
      <main id="main"></main>`;
    // 详情页面包屑 / 知识点链接跳转（事件委托，main 持久）
    content.querySelector("#main").addEventListener("click", e => {
      const t = e.target.closest("[data-go]");
      if (t) { const o = {}; if (t.dataset.subject) o.subject = t.dataset.subject; if (t.dataset.ch) o.ch = t.dataset.ch; go(t.dataset.go, o); }
    });
    layout.append(side, content);
    app.appendChild(layout);
    $("#logout").onclick = async () => { await S.saveDataNow(data); S.clearToken(); renderGate(); };
    updateTopMeta();
  }

  function updateTopMeta() {
    const done = Object.keys(data.daily).length;
    const wrong = Object.keys(data.wrongBook).length;
    $("#topMeta").innerHTML = `<span>📅 ${todayStr()}</span><span>✅ 已学 ${done} 天</span><span>📕 收藏错题 ${wrong}</span>`;
  }

  // ============ 主渲染分发 ============
  function render() {
    if (sideNav) setActiveNav(sideNav);
    const main = $("#main");
    main.innerHTML = "";
    switch (view.tab) {
      case "today": main.appendChild(renderToday()); break;
      case "analysis": main.appendChild(renderAnalysis()); break;
      case "exercise": main.appendChild(renderExercise()); break;
      case "paper": main.appendChild(renderPaper()); break;
      case "subject": main.appendChild(renderSubject(view.subject)); break;
      case "kp": main.appendChild(renderKp(view.subject, view.ch)); break;
      case "wrongbook": main.appendChild(renderWrongBook()); break;
      case "progress": main.appendChild(renderProgress()); break;
      case "settings": main.appendChild(renderSettings()); break;
      default: main.appendChild(renderToday());
    }
    updateTopMeta();
  }

  // ============ 今日学习 ============
  function renderToday() {
    const idx = getDayIndex();
    const isMock = idx % D.plan.mockEvery === D.plan.mockEvery - 1;
    const wrap = el("div", { class: "page" });
    wrap.appendChild(el("h2", {}, `今日学习 · 第 ${idx + 1} 天 ${isMock ? "（真题模考日）" : ""}`));
    wrap.appendChild(el("p", { class: "muted" }, isMock
      ? "今天安排为真题模考，集中刷近五年真题，检验阶段成果。"
      : "按学习计划轮换推送三科内容，完成学习单元与专题练习后打勾记录。点击知识点可进入详情页。"));

    const grid = el("div", { class: "unit-grid" });
    D.subjects.forEach(sub => {
      const u = sub.units[idx % sub.units.length];
      const rec = (data.daily[todayStr()] && data.daily[todayStr()].units || []).find(x => x.subject === sub.id && x.ch === u.ch);
      const card = el("div", { class: "unit-card", style: `--c:${sub.color}` });
      card.innerHTML = `
        <div class="unit-head"><span class="dot" style="background:${sub.color}"></span><b>${esc(sub.name)}</b></div>
        <div class="unit-ch">📖 ${esc(u.ch)}</div>
        <div class="unit-focus"><b>学习重点：</b>${esc(u.focus)}</div>
        <div class="unit-must"><b>必会：</b>${esc(u.must)}</div>
        <a class="link" data-go="kp" data-subject="${sub.id}" data-ch="${esc(u.ch)}">查看知识点详情 →</a>
        <label class="chk"><input type="checkbox" data-unit="${sub.id}" data-ch="${esc(u.ch)}" ${rec ? "checked" : ""}/> 标记完成</label>`;
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    // 今日必考详解
    const mustWrap = el("div", { class: "section" });
    mustWrap.appendChild(el("h3", {}, "📌 今日必考详解（每日重点推送）"));
    const mlist = el("div", { class: "must-list" });
    D.subjects.forEach(sub => {
      const u = sub.units[idx % sub.units.length];
      const detail = (D.mustDetails && D.mustDetails[sub.id + "|" + u.ch]) || u.must;
      const m = el("div", { class: "must-card", style: `--c:${sub.color}` });
      m.innerHTML = `<div class="must-head"><span class="dot" style="background:${sub.color}"></span><b>${esc(sub.name)}</b><span class="must-ch">${esc(u.ch)}</span></div><div class="must-detail">${esc(detail)}</div><a class="link" data-go="kp" data-subject="${sub.id}" data-ch="${esc(u.ch)}">进入详情页 →</a>`;
      mlist.appendChild(m);
    });
    mustWrap.appendChild(mlist);
    wrap.appendChild(mustWrap);

    // 今日专题练习
    const exWrap = el("div", { class: "section" });
    exWrap.appendChild(el("h3", {}, "📝 今日专题练习"));
    D.subjects.forEach(sub => {
      const list = D.exercises.filter(e => e.subject === sub.id);
      const pick = [];
      for (let k = 0; k < 2 && list.length; k++) pick.push(list[(idx + k) % list.length]);
      if (!pick.length) return;
      const box = el("div", { class: "ex-sub" });
      box.appendChild(el("div", { class: "ex-sub-title", style: `color:${sub.color}` }, sub.name));
      pick.forEach(ex => box.appendChild(buildExercise(ex, "today")));
      exWrap.appendChild(box);
    });
    wrap.appendChild(exWrap);

    if (isMock) {
      const btn = el("button", { class: "btn-primary", style: "margin-top:14px" }, "前往近五年真题模考 →");
      btn.onclick = () => go("paper");
      wrap.appendChild(btn);
    }

    $$('input[data-unit]', wrap).forEach(cb => cb.onchange = () => {
      const ds = todayStr();
      data.daily[ds] = data.daily[ds] || { units: [], exercisesDone: [], note: "" };
      const arr = data.daily[ds].units;
      const i = arr.findIndex(x => x.subject === cb.dataset.unit && x.ch === cb.dataset.ch);
      if (cb.checked && i < 0) arr.push({ subject: cb.dataset.unit, ch: cb.dataset.ch, done: true });
      if (!cb.checked && i >= 0) arr.splice(i, 1);
      S.saveData(data); S.syncToCloud(data); updateTopMeta();
    });
    return wrap;
  }

  // ============ 三科考情 ============
  function renderAnalysis() {
    const wrap = el("div", { class: "page" });
    wrap.appendChild(el("h2", {}, "三科考情与重点（全国大纲 · 广东考区）"));

    const gd = el("div", { class: "gd-box" });
    gd.appendChild(el("h3", {}, "📍 " + D.guangdong.title));
    const ul = el("ul", { class: "gd-list" });
    D.guangdong.notes.forEach(n => ul.appendChild(el("li", {}, esc(n))));
    gd.appendChild(ul);
    wrap.appendChild(gd);

    D.subjects.forEach(sub => {
      const card = el("div", { class: "analysis-card", style: `--c:${sub.color}` });
      card.appendChild(el("h3", { style: `color:${sub.color}` }, sub.name + " <a class='link' data-go='subject' data-subject='" + sub.id + "'>查看科目详情 →</a>"));
      card.appendChild(el("p", { class: "muted" }, esc(sub.examInfo.desc)));
      card.appendChild(el("p", {}, "<b>备考建议：</b>" + esc(sub.examInfo.pass)));
      const chapterLine = el("p", { class: "muted small" }, "📚 章节（" + sub.examInfo.chapters.length + "）：" + esc(sub.examInfo.chapters.join("、")));
      card.appendChild(chapterLine);
      const tbl = el("table", { class: "kp-table" });
      tbl.innerHTML = `<thead><tr><th>高频考点</th><th>权重</th><th>考频</th><th>掌握要点</th></tr></thead>`;
      const tb = el("tbody");
      sub.examInfo.keyPoints.forEach(kp => {
        let kpUnit = sub.units.find(u => u.ch === kp.chapter);
        if (!kpUnit) {
          const cands = sub.units.filter(u => u.ch.startsWith(kp.chapter) || kp.chapter.startsWith(u.ch));
          if (cands.length === 1) kpUnit = cands[0];
        }
        const chHtml = kpUnit
          ? `<a class="link" data-go="kp" data-subject="${sub.id}" data-ch="${esc(kpUnit.ch)}">${esc(kp.chapter)}</a>`
          : esc(kp.chapter);
        const tr = el("tr");
        tr.innerHTML = `<td>${chHtml}</td>
          <td><span class="badge w-${kp.weight}">${kp.weight}</span></td>
          <td class="muted">${esc(kp.freq)}</td>
          <td class="small">${esc(kp.tip)}</td>`;
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      card.appendChild(tbl);
      wrap.appendChild(card);
    });
    return wrap;
  }

  // ============ 科目总览（笔记 + 本科收藏错题 + 知识点列表） ============
  function renderSubject(sid) {
    const sub = D.subjects.find(s => s.id === sid);
    if (!sub) return renderToday();
    const wrap = el("div", { class: "page" });
    wrap.appendChild(el("div", { class: "subj-hero", style: `--c:${sub.color}` },
      `<span class="dot" style="background:${sub.color}"></span><h2 style="margin:0">${esc(sub.name)}</h2>`));
    wrap.appendChild(el("p", { class: "muted" }, esc(sub.examInfo.desc)));
    wrap.appendChild(el("p", {}, "<b>备考建议：</b>" + esc(sub.examInfo.pass)));

    // 本科笔记
    wrap.appendChild(buildNotes(sid, "本科笔记（通用记录）"));

    // 本科收藏的错题
    const wrongs = Object.keys(data.wrongBook).map(id => D.exercises.find(e => e.id === id)).filter(e => e && e.subject === sid);
    const wbSec = el("div", { class: "section" });
    wbSec.appendChild(el("h3", {}, `📕 本科收藏的错题（${wrongs.length}）`));
    if (!wrongs.length) wbSec.appendChild(el("p", { class: "muted" }, "暂无收藏的错题。做题答错会自动收藏，也可手动收藏。"));
    else wrongs.forEach(ex => wbSec.appendChild(buildExercise(ex, "wrong", true)));
    wrap.appendChild(wbSec);

    // 知识点列表
    const kpSec = el("div", { class: "section" });
    kpSec.appendChild(el("h3", {}, "📖 知识点（点击进入详情）"));
    const grid = el("div", { class: "kp-grid" });
    sub.units.forEach(u => {
      const card = el("div", { class: "kp-mini", style: `--c:${sub.color}` });
      card.innerHTML = `<div class="kp-mini-ch">${esc(u.ch)}</div><div class="kp-mini-focus small">${esc(u.focus)}</div>`;
      card.onclick = () => go("kp", { subject: sid, ch: u.ch });
      grid.appendChild(card);
    });
    kpSec.appendChild(grid);
    wrap.appendChild(kpSec);
    return wrap;
  }

  // ============ 知识点详情页 ============
  function renderKp(sid, ch) {
    const sub = D.subjects.find(s => s.id === sid);
    const u = sub && sub.units.find(x => x.ch === ch);
    if (!sub || !u) return renderSubject(sid);
    const wrap = el("div", { class: "page" });
    wrap.appendChild(el("div", { class: "crumb" },
      `<a class="link" data-go="subject" data-subject="${sid}">${esc(sub.name)}</a> › <b>${esc(ch)}</b>`));
    wrap.appendChild(el("h2", { style: `color:${sub.color}` }, esc(ch) + " · 知识点详情"));

    const c1 = el("div", { class: "kp-detail-card", style: `--c:${sub.color}` });
    let inner = `<h3>📌 学习重点</h3><div class="kp-text">${esc(u.focus)}</div><h3>✅ 必会</h3><div class="kp-text">${esc(u.must)}</div>`;
    const detail = (D.mustDetails && D.mustDetails[sid + "|" + ch]) || "";
    if (detail) inner += `<h3>📚 必考详解</h3><div class="kp-text">${esc(detail)}</div>`;
    c1.innerHTML = inner;
    wrap.appendChild(c1);

    // 本知识点笔记
    wrap.appendChild(buildNotes(sid + "|" + ch, "本知识点笔记"));

    // 相关专题练习
    const rel = D.exercises.filter(e => e.subject === sid && e.chapter === ch);
    const exSec = el("div", { class: "section" });
    exSec.appendChild(el("h3", {}, `📝 相关专题练习（${rel.length}）`));
    if (!rel.length) exSec.appendChild(el("p", { class: "muted" }, "该知识点暂无专门练习，可在『专题练习』中练习。"));
    else rel.forEach(ex => exSec.appendChild(buildExercise(ex, "kp")));
    wrap.appendChild(exSec);
    return wrap;
  }

  // ============ 笔记编辑组件 ============
  function buildNotes(key, label) {
    const wrap = el("div", { class: "notes-box" });
    wrap.appendChild(el("h3", {}, "📝 " + label));
    const ta = el("textarea", { class: "notes-input", placeholder: "在这里记录你的笔记、易错点、口诀与心得…", rows: "5" });
    ta.value = data.notes[key] || "";
    const tip = el("div", { class: "notes-tip muted small" }, ta.value ? "已保存" : "");
    const save = () => {
      data.notes[key] = ta.value;
      S.saveData(data); S.syncToCloud(data);
      tip.textContent = "已保存 " + new Date().toLocaleTimeString();
    };
    ta.addEventListener("input", debounce(save, 600));
    const saveBtn = el("button", { class: "btn-sm" }, "保存笔记");
    saveBtn.onclick = save;
    wrap.append(ta, el("div", {}, ""), saveBtn, tip);
    return wrap;
  }

  // ============ 专题练习 ============
  let exFilter = "all";
  function renderExercise() {
    const wrap = el("div", { class: "page" });
    wrap.appendChild(el("h2", {}, "专题练习"));
    const bar = el("div", { class: "filter-bar" });
    const opts = [{ id: "all", name: "全部" }].concat(D.subjects.map(s => ({ id: s.id, name: s.name })));
    opts.forEach(o => {
      const b = el("button", { class: "chip" + (exFilter === o.id ? " active" : "") }, o.name);
      b.onclick = () => { exFilter = o.id; render(); };
      bar.appendChild(b);
    });
    wrap.appendChild(bar);

    const list = D.exercises.filter(e => exFilter === "all" || e.subject === exFilter);
    list.forEach(ex => wrap.appendChild(buildExercise(ex, "bank")));
    if (!list.length) wrap.appendChild(el("p", { class: "muted" }, "该科目暂无练习。"));
    return wrap;
  }

  // 单题渲染
  function buildExercise(ex, ctx, showRemove) {
    const sub = D.subjects.find(s => s.id === ex.subject);
    const log = data.exerciseLog[ex.id];
    const box = el("div", { class: "ex-card", dataset: { id: ex.id } });
    const typeName = { single: "单选", multi: "多选", judge: "判断", calc: "计算", case: "简答" }[ex.type] || ex.type;
    box.innerHTML = `
      <div class="ex-meta">
        <span class="ex-tag" style="background:${sub.color}">${esc(sub.short)}</span>
        <span class="ex-type">${typeName}</span>
        <span class="ex-ch">${esc(ex.chapter)}</span>
        ${log ? `<span class="ex-log">${log.correct ? "✅已对" : "❌已错"} ×${log.times}</span>` : ""}
        ${data.wrongBook[ex.id] ? `<span class="ex-fav">📕已收藏</span>` : ""}
      </div>
      <div class="ex-q">${esc(ex.q)}</div>`;
    const body = el("div", { class: "ex-body" });
    const graded = ["single", "multi", "judge"].includes(ex.type);
    if (graded && ex.options && ex.options.length) {
      const letters = ex.options.map((_, i) => String.fromCharCode(65 + i));
      const multi = ex.type === "multi";
      const form = el("div", { class: "ex-opts" });
      ex.options.forEach((opt, i) => {
        const lab = el("label", { class: "opt" });
        lab.innerHTML = `<input type="${multi ? "checkbox" : "radio"}" name="opt_${ex.id}" value="${letters[i]}"/> <b>${letters[i]}</b>. ${esc(opt)}`;
        form.appendChild(lab);
      });
      body.appendChild(form);
      const submit = el("button", { class: "btn-sm" }, "提交答案");
      submit.onclick = () => {
        const vals = $$(`input[name="opt_${ex.id}"]:checked`, form).map(x => x.value).sort().join("");
        if (!vals) { alert("请选择答案"); return; }
        const correct = vals === ex.answer;
        showResult(box, ex, correct, log);
        recordExercise(ex, correct);
      };
      body.appendChild(submit);
    } else {
      const btn = el("button", { class: "btn-sm" }, "查看解析 / 答案");
      btn.onclick = () => showResult(box, ex, null, log);
      body.appendChild(btn);
    }
    box.appendChild(body);

    if (showRemove && data.wrongBook[ex.id]) {
      const del = el("button", { class: "btn-sm warn", style: "margin-left:8px" }, "取消收藏");
      del.onclick = () => { delete data.wrongBook[ex.id]; S.saveData(data); S.syncToCloud(data); updateTopMeta(); render(); };
      box.appendChild(del);
    }
    return box;
  }

  function showResult(box, ex, correct, log) {
    let r = $(".ex-result", box);
    if (!r) { r = el("div", { class: "ex-result" }); box.appendChild(r); }
    let html = "";
    if (correct === null) {
      html += `<div class="ans"><b>参考答案：</b>${esc(ex.answer)}</div>`;
    } else if (correct) {
      html += `<div class="ans ok">✅ 回答正确！</div>`;
    } else {
      html += `<div class="ans bad">❌ 回答错误，正确答案：<b>${esc(ex.answer)}</b></div>`;
      if (!data.wrongBook[ex.id]) {
        const add = el("button", { class: "btn-sm warn" }, "收藏到错题本");
        add.onclick = () => {
          data.wrongBook[ex.id] = { addedAt: new Date().toISOString() };
          S.saveData(data); S.syncToCloud(data); updateTopMeta();
          add.remove(); r.appendChild(el("span", { class: "ok small" }, " ✅ 已收藏"));
        };
        r.appendChild(add);
      }
    }
    html += `<div class="ex-exp"><b>解析：</b>${esc(ex.explain)}</div>`;
    r.innerHTML = html;
  }

  function recordExercise(ex, correct) {
    const log = data.exerciseLog[ex.id] || { correct: false, times: 0, lastAt: null };
    log.times += 1; log.lastAt = new Date().toISOString();
    log.correct = correct;
    data.exerciseLog[ex.id] = log;
    if (!correct) data.wrongBook[ex.id] = data.wrongBook[ex.id] || { addedAt: new Date().toISOString() };
    S.saveData(data); S.syncToCloud(data); updateTopMeta();
  }

  // ============ 历年真题 ============
  let paperSel = { year: 2026, subject: "all" };
  function renderPaper() {
    const wrap = el("div", { class: "page" });
    wrap.appendChild(el("h2", {}, "近五年真题练习（2022-2026 仿真）"));
    wrap.appendChild(el("p", { class: "muted" }, "以下为按历年命题规律编制的仿真练习，用于巩固高频考点。每题附解析。"));
    const bar = el("div", { class: "filter-bar" });
    const years = [2026, 2025, 2024, 2023, 2022];
    years.forEach(y => { const b = el("button", { class: "chip" + (paperSel.year === y ? " active" : "") }, y + "年"); b.onclick = () => { paperSel.year = y; render(); }; bar.appendChild(b); });
    wrap.appendChild(bar);
    const subBar = el("div", { class: "filter-bar" });
    [{ id: "all", n: "全部科目" }].concat(D.subjects.map(s => ({ id: s.id, n: s.name }))).forEach(o => {
      const b = el("button", { class: "chip" + (paperSel.subject === o.id ? " active" : "") }, o.n); b.onclick = () => { paperSel.subject = o.id; render(); }; subBar.appendChild(b);
    });
    wrap.appendChild(subBar);

    const items = D.pastPapers.filter(p => p.year === paperSel.year && (paperSel.subject === "all" || p.subject === paperSel.subject));
    if (!items.length) wrap.appendChild(el("p", { class: "muted" }, "暂无该年数据。"));
    items.forEach(p => {
      const sub = D.subjects.find(s => s.id === p.subject);
      const sec = el("div", { class: "paper-sec" });
      sec.appendChild(el("h3", { style: `color:${sub.color}` }, `${p.year} 年 · ${sub.name}`));
      p.items.forEach(it => sec.appendChild(buildPaperItem(it, p.year, p.subject)));
      wrap.appendChild(sec);
    });
    return wrap;
  }

  function buildPaperItem(it, year, subject) {
    const typeName = { single: "单选", multi: "多选", judge: "判断", calc: "计算", case: "简答" }[it.type] || it.type;
    const box = el("div", { class: "ex-card paper" });
    box.innerHTML = `<div class="ex-meta"><span class="ex-type">${typeName}</span></div><div class="ex-q">${esc(it.q)}</div>`;
    const body = el("div", { class: "ex-body" });
    if (it.options && it.options.length) {
      const letters = it.options.map((_, i) => String.fromCharCode(65 + i));
      const form = el("div", { class: "ex-opts" });
      it.options.forEach((opt, i) => { const lab = el("label", { class: "opt" }); lab.innerHTML = `<input type="radio" name="p_${year}_${subject}_${it.q.length}_${i}" value="${letters[i]}"/> <b>${letters[i]}</b>. ${esc(opt)}`; form.appendChild(lab); });
      body.appendChild(form);
      const btn = el("button", { class: "btn-sm" }, "提交");
      btn.onclick = () => {
        const v = $$("input:checked", form).map(x => x.value).join("");
        if (!v) { alert("请选择"); return; }
        const ok = v === it.answer;
        let r = $(".ex-result", box); if (!r) { r = el("div", { class: "ex-result" }); box.appendChild(r); }
        r.innerHTML = (ok ? `<div class="ans ok">✅ 正确</div>` : `<div class="ans bad">❌ 错误，正确答案：<b>${esc(it.answer)}</b></div>`) + `<div class="ex-exp"><b>解析：</b>${esc(it.explain)}</div>`;
      };
      body.appendChild(btn);
    } else {
      const btn = el("button", { class: "btn-sm" }, "查看解析 / 答案");
      btn.onclick = () => { let r = $(".ex-result", box); if (!r) { r = el("div", { class: "ex-result" }); box.appendChild(r); } r.innerHTML = `<div class="ans"><b>参考答案：</b>${esc(it.answer)}</div><div class="ex-exp"><b>解析：</b>${esc(it.explain)}</div>`; };
      body.appendChild(btn);
    }
    box.appendChild(body);
    return box;
  }

  // ============ 收藏错题（按科目分组） ============
  function renderWrongBook() {
    const wrap = el("div", { class: "page" });
    wrap.appendChild(el("h2", {}, "📕 收藏的错题"));
    wrap.appendChild(el("p", { class: "muted" }, "这里汇总所有收藏的错题（答错自动收藏或手动收藏）。按科目分组，可取消收藏。点击左侧科目名也可查看本科收藏的错题。"));
    const ids = Object.keys(data.wrongBook);
    if (!ids.length) { wrap.appendChild(el("p", { class: "muted" }, "暂无收藏的错题，去做题吧。")); return wrap; }
    D.subjects.forEach(sub => {
      const list = ids.map(id => D.exercises.find(e => e.id === id)).filter(e => e && e.subject === sub.id);
      if (!list.length) return;
      const sec = el("div", { class: "section" });
      sec.appendChild(el("h3", { style: `color:${sub.color}` }, `${sub.name}（${list.length}）`));
      list.forEach(ex => sec.appendChild(buildExercise(ex, "wrong", true)));
      wrap.appendChild(sec);
    });
    return wrap;
  }

  // ============ 我的进度 ============
  function renderProgress() {
    const wrap = el("div", { class: "page" });
    wrap.appendChild(el("h2", {}, "我的进度与历史"));

    const totalUnits = D.subjects.reduce((a, s) => a + s.units.length, 0);
    let doneUnits = 0;
    Object.values(data.daily).forEach(d => d.units && (doneUnits += d.units.length));
    const exTotal = D.exercises.length;
    const exDone = Object.keys(data.exerciseLog).length;
    const correctCnt = Object.values(data.exerciseLog).filter(l => l.correct).length;
    const wrongCnt = Object.keys(data.wrongBook).length;

    const stats = el("div", { class: "stat-grid" });
    [["学习天数", Object.keys(data.daily).length], ["完成学习单元", doneUnits], ["做题总数", exDone + "/" + exTotal], ["正确题数", correctCnt], ["收藏错题", wrongCnt], ["最近访问", data.lastVisit ? data.lastVisit.slice(0, 10) : "—"]]
      .forEach(([k, v]) => { const c = el("div", { class: "stat" }); c.innerHTML = `<div class="stat-v">${v}</div><div class="stat-k">${k}</div>`; stats.appendChild(c); });
    wrap.appendChild(stats);

    wrap.appendChild(el("h3", {}, "📕 收藏的错题"));
    const wb = Object.keys(data.wrongBook);
    if (!wb.length) wrap.appendChild(el("p", { class: "muted" }, "暂无收藏的错题，继续加油！"));
    else wb.forEach(id => {
      const ex = D.exercises.find(e => e.id === id);
      if (ex) wrap.appendChild(buildExercise(ex, "bank", true));
    });

    wrap.appendChild(el("h3", {}, "📅 学习历史（按日）"));
    const hist = el("div", { class: "hist" });
    const days = Object.keys(data.daily).sort().reverse();
    if (!days.length) hist.appendChild(el("p", { class: "muted" }, "还没有学习记录，去『今日学习』开始吧。"));
    days.slice(0, 30).forEach(d => {
      const rec = data.daily[d];
      const chips = (rec.units || []).map(u => { const s = D.subjects.find(x => x.id === u.subject); return `<span class="h-chip" style="background:${s.color}">${esc(s.short)}·${esc(u.ch)}</span>`; }).join("");
      const row = el("div", { class: "hist-row" });
      row.innerHTML = `<span class="hist-date">${d}</span><span class="hist-chips">${chips || "（仅浏览）"}</span>`;
      hist.appendChild(row);
    });
    wrap.appendChild(hist);
    return wrap;
  }

  // ============ 设置 ============
  function renderSettings() {
    const wrap = el("div", { class: "page" });
    wrap.appendChild(el("h2", {}, "设置"));

    const pwdCard = el("div", { class: "set-card" });
    pwdCard.innerHTML = `<h3>🔐 修改登录密码</h3><p class="muted">修改云端账号登录密码，修改后需使用新密码登录。</p>`;
    const old = el("input", { type: "password", placeholder: "当前密码" });
    const nv = el("input", { type: "password", placeholder: "新密码（至少6位）" });
    const nv2 = el("input", { type: "password", placeholder: "确认新密码" });
    const err = el("div", { class: "gate-err" });
    const btn = el("button", { class: "btn-primary" }, "修改密码");
    btn.onclick = async () => {
      if (nv.value.length < 6) { err.textContent = "新密码至少6位"; return; }
      if (nv.value !== nv2.value) { err.textContent = "两次不一致"; return; }
      try {
        await S.changePassword(old.value, nv.value);
        err.textContent = ""; alert("密码已修改");
        old.value = nv.value = nv2.value = "";
      } catch (e) { err.textContent = e.message || "修改失败"; }
    };
    pwdCard.append(old, nv, nv2, err, btn);
    wrap.appendChild(pwdCard);

    // 加密备份管理
    const backupCard = el("div", { class: "set-card" });
    backupCard.innerHTML = `<h3>💾 加密备份</h3>
      <p class="muted">每次数据变更自动生成加密备份（AES-256-GCM）。点击下方按钮下载最新备份至本机。</p>
      <p class="muted small">备份为加密格式（.json.enc），建议定期下载保存至本机指定业务文件夹。</p>`;
    const dlBtn = el("button", { class: "btn-sm" }, "⬇ 下载最新加密备份");
    dlBtn.onclick = async () => {
      try { await S.downloadBackup(); }
      catch (e) { alert(e.message || "下载失败"); }
    };
    backupCard.appendChild(dlBtn);
    const listDiv = el("div", { class: "backup-list" });
    backupCard.appendChild(listDiv);
    S.listBackups().then(list => {
      if (!list || !list.length) { listDiv.innerHTML = '<p class="muted small" style="margin-top:8px">暂无备份记录。</p>'; return; }
      let html = '<div class="muted small" style="margin:8px 0 4px">最近备份：</div>';
      list.slice(0, 5).forEach(b => {
        const d = new Date(b.date).toLocaleString("zh-CN");
        const sz = b.size > 1024 ? (b.size / 1024).toFixed(1) + "KB" : b.size + "B";
        html += `<div class="backup-item"><span>${d}</span><span class="muted">${sz}</span></div>`;
      });
      listDiv.innerHTML = html;
    }).catch(() => { listDiv.innerHTML = '<p class="muted small">备份列表加载失败。</p>'; });
    wrap.appendChild(backupCard);

    // 数据管理
    const dataCard = el("div", { class: "set-card" });
    dataCard.innerHTML = `<h3>🗑️ 数据管理</h3><p class="muted">导出/导入/清空学习数据。清空操作不可恢复。</p>`;
    const exp = el("button", { class: "btn-sm" }, "导出数据（明文JSON）");
    exp.onclick = () => { const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const a = el("a", { href: URL.createObjectURL(blob), download: "mb_study_data.json" }); a.click(); };
    const impBtn = el("button", { class: "btn-sm", style: "margin-left:8px" }, "导入数据");
    impBtn.onclick = () => {
      const input = el("input", { type: "file", accept: ".json" });
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const json = JSON.parse(text);
          await S.importData(json);
          alert("导入成功，正在刷新...");
          location.reload();
        } catch (e) { alert("导入失败: " + e.message); }
      };
      input.click();
    };
    const clr = el("button", { class: "btn-sm warn", style: "margin-left:8px" }, "清空全部数据");
    clr.onclick = async () => {
      if (confirm("确定清空云端全部学习数据？此操作不可恢复！")) {
        try { await S.resetAll(); alert("数据已清空"); location.reload(); }
        catch (e) { alert(e.message || "清空失败"); }
      }
    };
    dataCard.append(exp, impBtn, clr);
    wrap.appendChild(dataCard);

    wrap.appendChild(el("p", { class: "muted small" }, "数据存储于云端 PostgreSQL 数据库，每次变更自动加密备份。关闭电脑后公网网址仍可访问。"));
    return wrap;
  }

  // ============ 启动 ============
  async function boot() {
    const app = document.getElementById("app");
    if (!app) return;
    if (S.hasPassword()) {
      try {
        data = await S.loadData();
        renderShell();
        render();
        return;
      } catch (e) {
        S.clearToken();
      }
    }
    renderGate();
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
