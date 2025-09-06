const tabsEl = document.getElementById("tabs");
const urlEl = document.getElementById("url");
const backEl = document.getElementById("back");
const forwardEl = document.getElementById("forward");
const reloadEl = document.getElementById("reload");
const newTabEl = document.getElementById("newTab");
const viewsEl = document.getElementById("views");

let tabs = [];
let activeId = null;

// ---- window controls (CSP-safe: not inline) ----
function wireWindowControls() {
    const $ = (s) => document.querySelector(s);
    const closeBtn = $("#win-close");
    const minBtn   = $("#win-min");
    const maxBtn   = $("#win-max");
    if (!closeBtn || !minBtn || !maxBtn || !window.appWindow) return;
  
    // Ensure buttons are not in a draggable region for clicks:
    [closeBtn, minBtn, maxBtn].forEach(el => {
      el.classList.add("no-drag");
      el.style.pointerEvents = "auto";
    });
  
    closeBtn.addEventListener("click", () => window.appWindow.close());
    minBtn.addEventListener("click", () => window.appWindow.minimize());
    maxBtn.addEventListener("click", () => window.appWindow.maximizeToggle());
  
    // mac-like double-click on titlebar to zoom/unzoom
    const titlebar = document.getElementById("titlebar");
    if (titlebar) titlebar.addEventListener("dblclick", () => window.appWindow.maximizeToggle());
  
    // optional: style update on state changes
    window.appWindow.onWindowState?.((s) => {
      maxBtn.title = s.maximized ? "Restore" : "Maximize";
    });
  }
  
  // Call this once DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireWindowControls);
  } else {
    wireWindowControls();
  }
  

function normalizeInput(x) {
  try {
    const u = new URL(x);
    return u.toString();
  } catch (_) {
    if (/^[a-z]+:\/\//i.test(x)) return x;
    if (/^\w+\.\w+/.test(x)) return "https://" + x;
    const q = encodeURIComponent(x);
    return "https://duckduckgo.com/?q=" + q;
  }
}

function createTab(startUrl) {
  const id = crypto.randomUUID();

  // Webview fills parent using absolute + inset-0
  const view = document.createElement("webview");
  view.setAttribute("allowpopups", "");
  view.setAttribute("autoresize", "on");
  view.setAttribute("partition", "persist:default");
  view.className = "absolute inset-0 w-full h-full hidden";
  viewsEl.appendChild(view);

  // Tab chip
  const tabEl = document.createElement("button");
  tabEl.type = "button";
  tabEl.className =
    "tab group flex items-center gap-2 max-w-60 px-3 py-1.5 rounded-xl " +
    "bg-neutral-800 hover:bg-neutral-700 text-sm";
  tabEl.dataset.id = id;

  const titleEl = document.createElement("div");
  titleEl.className = "title truncate";
  titleEl.textContent = "New Tab";

  const closeEl = document.createElement("span");
  closeEl.className = "close text-neutral-400 group-hover:text-neutral-200 cursor-pointer";
  closeEl.textContent = "×";

  tabEl.appendChild(titleEl);
  tabEl.appendChild(closeEl);
  tabsEl.appendChild(tabEl);

  const t = { id, view, tabEl, titleEl, closeEl };
  tabs.push(t);

  tabEl.addEventListener("click", (e) => {
    if (e.target === closeEl) return;
    setActive(id);
  });

  closeEl.addEventListener("click", (e) => {
    e.stopPropagation();
    closeTab(id);
  });

  view.addEventListener("page-title-updated", (e) => {
    titleEl.textContent = e.title || "Tab";
    if (id === activeId) document.title = e.title || "Mini Browser";
  });

  const updateUrlBar = (u) => { if (id === activeId) urlEl.value = u; };
  view.addEventListener("did-navigate", (e) => updateUrlBar(e.url));
  view.addEventListener("did-navigate-in-page", (e) => updateUrlBar(e.url));
  view.addEventListener("did-fail-load", () => { if (id === activeId && !urlEl.value) urlEl.value = "about:blank"; });

  setActive(id);
  navigateTo(id, startUrl || "https://duckduckgo.com");
}

function setActive(id) {
  activeId = id;
  tabs.forEach((t) => {
    // webview shows when active
    t.view.classList.toggle("hidden", t.id !== id);
    // tab styling
    t.tabEl.classList.toggle("bg-neutral-700", t.id === id);
    t.tabEl.classList.toggle("bg-neutral-800", t.id !== id);
  });
  const t = tabs.find((x) => x.id === id);
  if (t) urlEl.value = t.view.getURL() || "";
}

function closeTab(id) {
  const i = tabs.findIndex((t) => t.id === id);
  if (i === -1) return;
  const t = tabs[i];
  t.view.remove();
  t.tabEl.remove();
  tabs.splice(i, 1);
  if (activeId === id) {
    const next = tabs[i] || tabs[i - 1] || tabs[0];
    if (next) setActive(next.id); else urlEl.value = "";
  }
}

function activeTab() {
  return tabs.find((t) => t.id === activeId) || null;
}

function navigateTo(id, raw) {
  const t = tabs.find((x) => x.id === id);
  if (!t) return;
  const u = normalizeInput(raw.trim());
  t.view.src = u;
  if (id === activeId) urlEl.value = u;
}

urlEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const t = activeTab();
    if (t) navigateTo(t.id, urlEl.value);
  }
});

backEl.addEventListener("click", () => {
  const t = activeTab();
  if (t && t.view.canGoBack()) t.view.goBack();
});

forwardEl.addEventListener("click", () => {
  const t = activeTab();
  if (t && t.view.canGoForward()) t.view.goForward();
});

reloadEl.addEventListener("click", () => {
  const t = activeTab();
  if (t) t.view.reload();
});

newTabEl.addEventListener("click", () => createTab("https://duckduckgo.com"));

createTab("https://duckduckgo.com");
