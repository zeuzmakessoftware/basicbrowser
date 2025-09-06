const tabsEl = document.getElementById("tabs");
const urlEl = document.getElementById("url");
const backEl = document.getElementById("back");
const forwardEl = document.getElementById("forward");
const reloadEl = document.getElementById("reload");
const newTabEl = document.getElementById("newTab");
const viewsEl = document.getElementById("views");

// Dropdown elements
const menuToggleEl = document.getElementById("menuToggle");
const dropdownMenuEl = document.getElementById("dropdownMenu");
const incognitoToggleEl = document.getElementById("incognitoToggle");
const incognitoTextEl = document.getElementById("incognitoText");
const historyBtnEl = document.getElementById("historyBtn");

// History modal elements
const historyModalEl = document.getElementById("historyModal");
const historyListEl = document.getElementById("historyList");
const emptyHistoryEl = document.getElementById("emptyHistory");
const closeHistoryBtnEl = document.getElementById("closeHistoryBtn");
const clearHistoryBtnEl = document.getElementById("clearHistoryBtn");

let tabs = [];
let activeId = null;
let isIncognitoMode = false;
let history = [];
let incognitoSessionCounter = 0;

// Load history from localStorage on startup
function loadHistory() {
  try {
    const savedHistory = localStorage.getItem('browserHistory');
    if (savedHistory) {
      history = JSON.parse(savedHistory);
    }
  } catch (error) {
    console.warn('Failed to load history from localStorage:', error);
    history = [];
  }
}

// Save history to localStorage
function saveHistory() {
  try {
    localStorage.setItem('browserHistory', JSON.stringify(history));
  } catch (error) {
    console.warn('Failed to save history to localStorage:', error);
  }
}

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

function createTab(startUrl, forceIncognito = null) {
  const id = crypto.randomUUID();
  const tabIsIncognito = forceIncognito !== null ? forceIncognito : isIncognitoMode;

  // Webview fills parent using absolute + inset-0
  const view = document.createElement("webview");
  view.setAttribute("allowpopups", "");
  view.setAttribute("autoresize", "on");
  
  // Set partition based on incognito mode
  if (tabIsIncognito) {
    // Each incognito tab gets its own unique session (like Safari)
    incognitoSessionCounter++;
    view.setAttribute("partition", `incognito:session-${incognitoSessionCounter}`);
  } else {
    view.setAttribute("partition", "persist:default");
  }
  
  view.className = "absolute inset-0 w-full h-full hidden";
  viewsEl.appendChild(view);

  // Tab chip with incognito styling
  const tabEl = document.createElement("button");
  tabEl.type = "button";
  const baseClasses = "tab group flex items-center gap-2 max-w-60 px-3 py-1.5 rounded-xl text-sm";
  const incognitoClasses = tabIsIncognito 
    ? "bg-purple-900/70 hover:bg-purple-800/70 border border-purple-500/30" 
    : "bg-neutral-800 hover:bg-neutral-700";
  tabEl.className = `${baseClasses} ${incognitoClasses}`;
  tabEl.dataset.id = id;

  // Add incognito indicator
  if (tabIsIncognito) {
    const incognitoIcon = document.createElement("span");
    incognitoIcon.className = "text-purple-300 text-xs";
    incognitoIcon.textContent = "🕶️";
    tabEl.appendChild(incognitoIcon);
  }

  const titleEl = document.createElement("div");
  titleEl.className = "title truncate";
  titleEl.textContent = tabIsIncognito ? "Private Tab" : "New Tab";

  const closeEl = document.createElement("span");
  closeEl.className = "close text-neutral-400 group-hover:text-neutral-200 cursor-pointer";
  closeEl.textContent = "×";

  tabEl.appendChild(titleEl);
  tabEl.appendChild(closeEl);
  tabsEl.appendChild(tabEl);

  const t = { id, view, tabEl, titleEl, closeEl, isIncognito: tabIsIncognito };
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
    titleEl.textContent = e.title || (tabIsIncognito ? "Private Tab" : "Tab");
    if (id === activeId) document.title = e.title || "Mini Browser";
  });

  const updateUrlBar = (u) => { if (id === activeId) urlEl.value = u; };
  
  view.addEventListener("did-navigate", (e) => {
    updateUrlBar(e.url);
    // Add to history only for non-incognito tabs
    if (!tabIsIncognito && e.url && !e.url.startsWith('about:')) {
      addToHistory(e.url, titleEl.textContent || e.url);
    }
  });
  
  view.addEventListener("did-navigate-in-page", (e) => {
    updateUrlBar(e.url);
    // Add to history only for non-incognito tabs
    if (!tabIsIncognito && e.url && !e.url.startsWith('about:')) {
      addToHistory(e.url, titleEl.textContent || e.url);
    }
  });
  
  view.addEventListener("did-fail-load", () => { 
    if (id === activeId && !urlEl.value) urlEl.value = "about:blank"; 
  });

  setActive(id);
  navigateTo(id, startUrl || "https://duckduckgo.com");
}

function setActive(id) {
  activeId = id;
  tabs.forEach((t) => {
    // webview shows when active
    t.view.classList.toggle("hidden", t.id !== id);
    // tab styling - handle incognito tabs differently
    if (t.isIncognito) {
      t.tabEl.classList.toggle("bg-purple-800/70", t.id === id);
      t.tabEl.classList.toggle("bg-purple-900/70", t.id !== id);
    } else {
      t.tabEl.classList.toggle("bg-neutral-700", t.id === id);
      t.tabEl.classList.toggle("bg-neutral-800", t.id !== id);
    }
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

// History management functions
function addToHistory(url, title) {
  const timestamp = Date.now();
  const historyEntry = { url, title, timestamp };
  
  // Remove duplicate entries for the same URL
  history = history.filter(entry => entry.url !== url);
  
  // Add new entry at the beginning
  history.unshift(historyEntry);
  
  // Keep only last 1000 entries
  if (history.length > 1000) {
    history = history.slice(0, 1000);
  }
  
  // Save to localStorage
  saveHistory();
}

function getHistory() {
  return history;
}

function clearHistory() {
  history = [];
  saveHistory(); // Save empty history to localStorage
  if (historyModalEl && !historyModalEl.classList.contains('hidden')) {
    renderHistoryModal();
  }
}

// History modal functions
function showHistoryModal() {
  renderHistoryModal();
  historyModalEl.classList.remove('hidden');
}

function hideHistoryModal() {
  historyModalEl.classList.add('hidden');
}

function renderHistoryModal() {
  historyListEl.innerHTML = '';
  
  if (history.length === 0) {
    emptyHistoryEl.classList.remove('hidden');
    return;
  }
  
  emptyHistoryEl.classList.add('hidden');
  
  history.forEach((entry, index) => {
    const entryEl = document.createElement('div');
    entryEl.className = 'flex items-center gap-3 p-3 bg-neutral-800/50 hover:bg-neutral-700/50 rounded-lg cursor-pointer border border-white/5 hover:border-white/10 transition-all';
    
    const timeEl = document.createElement('div');
    timeEl.className = 'text-xs text-neutral-400 min-w-[60px]';
    timeEl.textContent = formatTime(entry.timestamp);
    
    const contentEl = document.createElement('div');
    contentEl.className = 'flex-1 min-w-0';
    
    const titleEl = document.createElement('div');
    titleEl.className = 'text-sm text-white truncate';
    titleEl.textContent = entry.title || 'Untitled';
    
    const urlEl = document.createElement('div');
    urlEl.className = 'text-xs text-neutral-400 truncate';
    urlEl.textContent = entry.url;
    
    contentEl.appendChild(titleEl);
    contentEl.appendChild(urlEl);
    
    entryEl.appendChild(timeEl);
    entryEl.appendChild(contentEl);
    
    // Click to navigate
    entryEl.addEventListener('click', () => {
      const activeTab = tabs.find(t => t.id === activeId);
      if (activeTab) {
        navigateTo(activeTab.id, entry.url);
        hideHistoryModal();
      }
    });
    
    historyListEl.appendChild(entryEl);
  });
}

function formatTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) { // Less than 1 minute
    return 'now';
  } else if (diff < 3600000) { // Less than 1 hour
    return `${Math.floor(diff / 60000)}m`;
  } else if (diff < 86400000) { // Less than 1 day
    return `${Math.floor(diff / 3600000)}h`;
  } else {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  }
}

// Incognito mode toggle
function toggleIncognitoMode() {
  isIncognitoMode = !isIncognitoMode;
  updateIncognitoButton();
}

function updateIncognitoButton() {
  if (isIncognitoMode) {
    incognitoToggleEl.classList.add("bg-purple-700/30", "text-purple-200");
    incognitoToggleEl.classList.remove("hover:bg-neutral-800/70");
    incognitoToggleEl.classList.add("hover:bg-purple-600/30");
    incognitoTextEl.textContent = "Incognito Mode: ON";
    menuToggleEl.style.background = "rgba(147, 51, 234, 0.3)"; // Purple tint for menu button
  } else {
    incognitoToggleEl.classList.remove("bg-purple-700/30", "text-purple-200", "hover:bg-purple-600/30");
    incognitoToggleEl.classList.add("hover:bg-neutral-800/70");
    incognitoTextEl.textContent = "Toggle Incognito Mode";
    menuToggleEl.style.background = ""; // Reset menu button background
  }
}

// Dropdown functions
function toggleDropdown() {
  dropdownMenuEl.classList.toggle('hidden');
}

function hideDropdown() {
  dropdownMenuEl.classList.add('hidden');
}

// Event listeners
menuToggleEl.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleDropdown();
});

incognitoToggleEl.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleIncognitoMode();
  hideDropdown();
});

historyBtnEl.addEventListener("click", (e) => {
  e.stopPropagation();
  showHistoryModal();
  hideDropdown();
});

closeHistoryBtnEl.addEventListener("click", hideHistoryModal);

// Clear history from dropdown
document.querySelector('#dropdownMenu #clearHistoryBtn').addEventListener("click", (e) => {
  e.stopPropagation();
  if (confirm("Are you sure you want to clear all browsing history?")) {
    clearHistory();
  }
  hideDropdown();
});

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  if (!dropdownMenuEl.contains(e.target) && !menuToggleEl.contains(e.target)) {
    hideDropdown();
  }
});

// Close modal when clicking outside
historyModalEl.addEventListener("click", (e) => {
  if (e.target === historyModalEl) {
    hideHistoryModal();
  }
});

// Close modal with Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!historyModalEl.classList.contains('hidden')) {
      hideHistoryModal();
    } else if (!dropdownMenuEl.classList.contains('hidden')) {
      hideDropdown();
    }
  }
});

newTabEl.addEventListener("click", () => createTab("https://duckduckgo.com"));

// Initialize browser
loadHistory(); // Load saved history on startup
createTab("https://duckduckgo.com");
