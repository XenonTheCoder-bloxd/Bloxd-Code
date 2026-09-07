'use strict';

  const ROUTES = ["home", "codes", "academy", "libs", "forum", "portfolio"];

  function pathToView(path) {
    const seg = path.replace(/^\/+|\/+$/g, "");
    return ROUTES.includes(seg) ? seg : "home";
  }

  function navigateTo(view, pushHistory = true) {
    document.querySelectorAll(".nav-item").forEach(item => {
      if (item.getAttribute("data-view") === view) item.classList.add("active");
      else item.classList.remove("active");
    });

    document.querySelectorAll(".view-panel").forEach(panel => {
      if (panel.id === `view-${view}`) panel.classList.add("active");
      else panel.classList.remove("active");
    });

    if (pushHistory) {
      const path = view === "home" ? "/" : `/${view}`;
      if (location.pathname !== path) history.pushState({}, "", path);
    }

    if (view === "home") renderDashboard();
    if (view === "codes") renderCodesGrid(activeCodesCategory);
    if (view === "portfolio") startStageFx((publicViewProfile || userProfile)?.portfolioEffect || "none");
    else stopStageFx();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  window.navigateTo = navigateTo;

  function updateUserUI() {
    const nameEl = document.getElementById("sidebar-user-name");
    const subEl = document.getElementById("sidebar-user-sub");
    const avatarEl = document.getElementById("sidebar-user-avatar");

    if (userProfile) {
      if (nameEl) nameEl.textContent = userProfile.username;
      if (subEl) subEl.textContent = `${userProfile.stats?.xp || 0} XP`;
      if (avatarEl) {
        const z = userProfile.avatarZoom || 1;
        const px = userProfile.avatarPosX ?? 50;
        const py = userProfile.avatarPosY ?? 50;
        const st = `width:100%;height:100%;object-fit:cover;border-radius:50%;object-position:${px}% ${py}%;transform:scale(${z});`;
        if (isVideoSource(userProfile.avatar)) {
          avatarEl.innerHTML = `<video src="${escapeHtml(userProfile.avatar)}" autoplay loop muted playsinline style="${st}"></video>`;
        } else {
          avatarEl.innerHTML = `<img src="${escapeHtml(userProfile.avatar)}" style="${st}">`;
        }
      }
    }
  }

  function showToast(msg, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }
  window.showToast = showToast;

  // Claude Security Patch: added quote-escaping - previously " and ' passed through untouched,
  // meaning every existing escapeHtml() call site inside an HTML attribute was still exploitable.
  function escapeHtml(t) {
    return String(t || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const TURNSTILE_SITE_KEY = "0x4AAAAAAEqdfavuP2fQFiEO";
  let turnstileLoginToken = null;
  let turnstileSignupToken = null;
  let turnstileLoginWidgetId = null;
  let turnstileSignupWidgetId = null;

  window.onTurnstileReady = function () {
    if (!window.turnstile) return;
    turnstileLoginWidgetId = turnstile.render("#turnstile-login", {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => { turnstileLoginToken = token; },
      "expired-callback": () => { turnstileLoginToken = null; },
      "error-callback": () => { turnstileLoginToken = null; }
    });
    turnstileSignupWidgetId = turnstile.render("#turnstile-signup", {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token) => { turnstileSignupToken = token; },
      "expired-callback": () => { turnstileSignupToken = null; },
      "error-callback": () => { turnstileSignupToken = null; }
    });
  };

  function setupAuthGateActions() {
    const gateLoginBtn = document.getElementById("gate-login-btn");
    const gateSignupBtn = document.getElementById("gate-signup-btn");
    const gateGoogleBtn = document.getElementById("gate-google-btn");

    if (gateGoogleBtn) {
      gateGoogleBtn.onclick = () => {
        window.location.href = "/api/auth/google";
      };
    }

    if (gateLoginBtn) {
      gateLoginBtn.onclick = async (e) => {
        e.preventDefault();
        const username = document.getElementById("gate-login-username")?.value?.trim();
        const pass = document.getElementById("gate-login-password")?.value;

        if (!username || !pass) {
          showToast("Please enter username and password.", "error");
          return;
        }
        if (!turnstileLoginToken) {
          showToast("Please complete the verification.", "error");
          return;
        }

        try {
          await apiFetch("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password: pass, turnstileToken: turnstileLoginToken })
          });
          await checkAuthGate();
          document.getElementById("auth-gate-screen")?.classList.add("hidden");
          showToast(`Welcome back, ${username}!`, "success");
        } catch (err) {
          showToast(err.message || "Incorrect username or password.", "error");
        } finally {
          if (turnstileLoginWidgetId !== null) turnstile.reset(turnstileLoginWidgetId);
          turnstileLoginToken = null;
        }
      };
    }

    if (gateSignupBtn) {
      gateSignupBtn.onclick = async (e) => {
        e.preventDefault();
        const username = document.getElementById("gate-signup-username")?.value?.trim();
        const pass = document.getElementById("gate-signup-password")?.value;

        const val = validateUsername(username);
        if (!val.valid) {
          showToast(val.error, "error");
          return;
        }

        if (!pass || pass.length < 8) {
          showToast("Password must be at least 8 characters.", "error");
          return;
        }
        if (!turnstileSignupToken) {
          showToast("Please complete the verification.", "error");
          return;
        }

        try {
          await apiFetch("/api/auth/signup", {
            method: "POST",
            body: JSON.stringify({ username: val.username, password: pass, turnstileToken: turnstileSignupToken })
          });
          await checkAuthGate();
          document.getElementById("auth-gate-screen")?.classList.add("hidden");
          showToast(`Account created for @${val.username}!`, "success");
        } catch (err) {
          showToast(err.message || "Couldn't create account.", "error");
        } finally {
          if (turnstileSignupWidgetId !== null) turnstile.reset(turnstileSignupWidgetId);
          turnstileSignupToken = null;
        }
      };
    }

    const tabLogin = document.getElementById("gate-tab-login");
    const tabSignup = document.getElementById("gate-tab-signup");
    const formLogin = document.getElementById("gate-form-login");
    const formSignup = document.getElementById("gate-form-signup");

    if (tabLogin && tabSignup) {
      tabLogin.onclick = () => {
        tabLogin.classList.add("active");
        tabSignup.classList.remove("active");
        tabLogin.style.color = "#fff";
        tabSignup.style.color = "var(--text-muted)";
        if (formLogin) formLogin.style.display = "block";
        if (formSignup) formSignup.style.display = "none";
      };
      tabSignup.onclick = () => {
        tabSignup.classList.add("active");
        tabLogin.classList.remove("active");
        tabSignup.style.color = "#fff";
        tabLogin.style.color = "var(--text-muted)";
        if (formSignup) formSignup.style.display = "block";
        if (formLogin) formLogin.style.display = "none";
      };
    }
  }

  async function handleProfileDeepLink() {
    let requested = "";
    try {
      requested = new URLSearchParams(window.location.search).get("u") || "";
    } catch (e) {}
    if (!requested && !window.location.hostname.endsWith(".pages.dev")) {
      const parts = window.location.hostname.split(".");
      if (parts.length >= 3 && parts[0] && !["www", "app"].includes(parts[0].toLowerCase())) {
        requested = parts[0];
      }
    }
    requested = requested.toLowerCase().replace(/[^a-z0-9_\-]/g, "");
    if (!requested) return;
    if (userProfile && requested === (userProfile.username || "").toLowerCase()) {
      // It's your own subdomain while logged in as yourself - show your editable
      // portfolio directly instead of doing nothing (previously just returned here).
      hideCardMenu();
      document.getElementById("auth-gate-screen")?.classList.add("hidden");
      navigateTo("portfolio");
      updatePortfolioUI();
      return;
    }
    publicViewUser = requested;
    publicViewNotFound = false;
    bannerDismissed = false;
    hideCardMenu();
    document.getElementById("auth-gate-screen")?.classList.add("hidden");
    navigateTo("portfolio");
    updatePortfolioUI();
    const dev = await resolveDevProfile(requested);
    if (!dev) {
      publicViewNotFound = true;
      updatePortfolioUI();
      showToast("Couldn't load that portfolio. An ad-blocker may be blocking portfolio data.", "error");
      return;
    }
    publicViewNotFound = false;
    publicViewProfile = dev;
    updatePortfolioUI();
    renderDashboardCreators();
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      const loader = document.getElementById("loading-screen");
      if (loader) {
        loader.classList.add("fade-out");
        setTimeout(() => loader.remove(), 350);
      }
    }, 600);

    setupAuthGateActions();
    checkAuthGate();

    navigateTo(pathToView(location.pathname), false);
    window.addEventListener("popstate", () => navigateTo(pathToView(location.pathname), false));
    refreshUsersDirectory();
    setInterval(refreshUsersDirectory, 30000);

    initDashboard();
    initPortfolio();
    initForum();
    initLibs();
    initAcademy();
    initCodes();
    handleProfileDeepLink();

    function closeSidebarDrawer() {
      document.querySelector(".sidebar")?.classList.remove("open");
      document.getElementById("sidebar-backdrop")?.classList.remove("open");
    }

    const mobileMenuBtn = document.getElementById("mobile-menu-btn");
    if (mobileMenuBtn) {
      mobileMenuBtn.onclick = () => {
        document.querySelector(".sidebar")?.classList.toggle("open");
        document.getElementById("sidebar-backdrop")?.classList.toggle("open");
      };
    }
    document.getElementById("sidebar-backdrop")?.addEventListener("click", closeSidebarDrawer);

    // Swipe-away to close only - deliberately no edge-swipe-to-open gesture.
    // An edge-swipe-open competes for the exact same touch as iOS/Android's
    // own "swipe from the edge to go back" gesture, and a page-level listener
    // can never reliably win that fight (this one was even passive, so it
    // could never call preventDefault at all). That conflict was the actual
    // cause of the drawer opening halfway into a back-navigation, a stuck
    // scroll view, and a colored sliver at the edge that looked like an
    // unusable scrollbar but was really the OS's own back-gesture page-peek.
    // Opening the drawer is the hamburger button's job - zero gesture
    // conflict there. Closing by swiping still works since that gesture
    // starts inside the open drawer's content, not at the screen edge, so it
    // never overlaps with the OS's back gesture.
    (function setupSidebarSwipe() {
      const CLOSE_THRESHOLD = 60;
      let startX = 0, startY = 0, tracking = false;

      document.addEventListener("touchstart", (e) => {
        if (window.innerWidth > 900) return;
        const sidebar = document.querySelector(".sidebar");
        const isOpen = sidebar && sidebar.classList.contains("open");
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        tracking = !!isOpen;
      }, { passive: true });

      document.addEventListener("touchmove", (e) => {
        if (!tracking) return;
        const t = e.touches[0];
        const dx = t.clientX - startX;
        const dy = t.clientY - startY;
        if (Math.abs(dy) > Math.abs(dx)) {
          tracking = false;
          return;
        }
        if (dx < -CLOSE_THRESHOLD) {
          closeSidebarDrawer();
          tracking = false;
        }
      }, { passive: true });

      document.addEventListener("touchend", () => {
        tracking = false;
        mode = null;
      });
    })();

    document.querySelectorAll(".nav-item[data-view]").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        navigateTo(btn.getAttribute("data-view"));
        closeSidebarDrawer();
      };
    });

    document.getElementById("open-new-post-modal-btn")?.addEventListener("click", () => {
      document.getElementById("new-post-modal")?.classList.add("active");
    });
    document.getElementById("new-post-modal-close")?.addEventListener("click", () => {
      document.getElementById("new-post-modal")?.classList.remove("active");
    });

    document.querySelectorAll(".modal-overlay").forEach(overlay => {
      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.classList.remove("active");
      };
    });

    const logoutBtn = document.getElementById("header-auth-btn");
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        try { await apiFetch("/api/auth/logout", { method: "POST" }); } catch (e) {}
        currentUser = null;
        userProfile = null;
        isAdminUser = false;
        if (typeof window.__refreshDebugButton === "function") window.__refreshDebugButton();
        document.getElementById("auth-gate-screen")?.classList.remove("hidden");
        showToast("Signed out", "info");
        renderDashboard();
        renderForumFeed();
        renderCodesGrid(activeCodesCategory);
      };
    }
  });


  // ---------------------------------------------------------------------
  // Debug capture panel. Off by default for everyone - only shows once a
  // user checks "Enable debug capture tool" in their own Settings, and that
  // preference is saved to their profile so it follows them across reloads
  // and devices. Captures console output, uncaught errors, unhandled
  // promise rejections, and layout overflow, all timestamped and tagged
  // with the active view. Exists so a bug can be captured on-device (phone
  // included) and handed over as one file instead of live-narrating
  // DevTools output back and forth.
  (function setupDebugCapture() {
    const buffer = [];
    let capturing = false;
    let overflowTimer = null;
    const MAX_ENTRIES = 3000;

    function activeViewId() {
      return document.querySelector(".view-panel.active")?.id || "";
    }

    function push(type, parts) {
      if (!capturing) return;
      if (buffer.length >= MAX_ENTRIES) buffer.shift();
      const msg = parts.map(p => {
        if (typeof p === "string") return p;
        try { return JSON.stringify(p); } catch (e) { return String(p); }
      }).join(" ");
      buffer.push({ t: new Date().toISOString(), type, view: activeViewId(), msg });
    }

    ["log", "warn", "error", "info"].forEach((level) => {
      const orig = console[level] ? console[level].bind(console) : () => {};
      console[level] = function (...args) {
        push(level, args);
        orig(...args);
      };
    });

    window.addEventListener("error", (e) => {
      push("error", [`${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`]);
    });
    window.addEventListener("unhandledrejection", (e) => {
      push("error", [`Unhandled promise rejection: ${e.reason}`]);
    });

    function checkOverflow() {
      const offenders = [...document.querySelectorAll("*")].filter(
        (el) => el.scrollWidth > el.clientWidth + 1
      );
      if (offenders.length) {
        push(
          "overflow",
          [offenders.map((el) => `${el.tagName}.${el.className || ""} ${el.scrollWidth}>${el.clientWidth}`).join(" | ")]
        );
      }
    }

    function exportLog() {
      return buffer
        .map((e) => `[${e.t}] (${e.view}) ${e.type.toUpperCase()}: ${e.msg}`)
        .join("\n");
    }

    function buildPanel() {
      if (document.getElementById("xenon-debug-btn")) return;
      window.__debugPanelBuilt = true;

      const btn = document.createElement("button");
      btn.id = "xenon-debug-btn";
      btn.innerHTML = '<i class="fa-solid fa-bug"></i>';
      btn.style.cssText =
        "position:fixed;bottom:16px;right:16px;width:40px;height:40px;border-radius:50%;" +
        "background:#ff4444;color:#fff;border:none;z-index:999999;cursor:pointer;" +
        "font-size:16px;box-shadow:0 4px 12px rgba(0,0,0,0.5);";
      document.body.appendChild(btn);

      const panel = document.createElement("div");
      panel.id = "xenon-debug-panel";
      panel.style.cssText =
        "display:none;position:fixed;bottom:64px;right:16px;width:min(380px,92vw);" +
        "max-height:65vh;background:#111;border:1px solid #333;border-radius:8px;" +
        "z-index:999999;padding:12px;color:#fff;font-family:var(--font-mono, monospace);" +
        "font-size:11px;box-shadow:0 8px 24px rgba(0,0,0,0.6);";
      panel.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
        '<strong>Debug Capture</strong>' +
        '<span id="xenon-debug-count" style="color:#888;">0 entries</span>' +
        '</div>' +
        '<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">' +
        '<button id="xenon-debug-toggle" style="flex:1;min-width:110px;padding:6px;background:#fff;color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:600;">Start Capture</button>' +
        '<button id="xenon-debug-copy" style="padding:6px 10px;background:#222;color:#fff;border:1px solid #444;border-radius:4px;cursor:pointer;">Copy</button>' +
        '<button id="xenon-debug-download" style="padding:6px 10px;background:#222;color:#fff;border:1px solid #444;border-radius:4px;cursor:pointer;">Download</button>' +
        '<button id="xenon-debug-clear" style="padding:6px 10px;background:#222;color:#fff;border:1px solid #444;border-radius:4px;cursor:pointer;">Clear</button>' +
        '</div>' +
        '<div id="xenon-debug-log" style="max-height:40vh;overflow-y:auto;white-space:pre-wrap;word-break:break-all;background:#000;border-radius:4px;padding:6px;"></div>';
      document.body.appendChild(panel);

      btn.onclick = () => {
        panel.style.display = panel.style.display === "none" ? "block" : "none";
      };

      const toggleBtn = document.getElementById("xenon-debug-toggle");
      toggleBtn.onclick = () => {
        if (!capturing) {
          capturing = true;
          buffer.length = 0;
          push("info", ["--- capture started ---"]);
          overflowTimer = setInterval(checkOverflow, 300);
          toggleBtn.textContent = "Stop Capture";
          toggleBtn.style.background = "#ff4444";
          toggleBtn.style.color = "#fff";
        } else {
          push("info", ["--- capture stopped ---"]);
          capturing = false;
          clearInterval(overflowTimer);
          toggleBtn.textContent = "Start Capture";
          toggleBtn.style.background = "#fff";
          toggleBtn.style.color = "#000";
        }
      };

      document.getElementById("xenon-debug-copy").onclick = () => {
        navigator.clipboard?.writeText(exportLog()).then(() => {
          if (typeof showToast === "function") showToast("Log copied to clipboard", "success");
        });
      };

      document.getElementById("xenon-debug-download").onclick = () => {
        const blob = new Blob([exportLog()], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bloxdcode-debug-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      };

      document.getElementById("xenon-debug-clear").onclick = () => {
        buffer.length = 0;
        renderLog();
      };

      function renderLog() {
        const el = document.getElementById("xenon-debug-log");
        const countEl = document.getElementById("xenon-debug-count");
        if (!el || !countEl) return;
        countEl.textContent = `${buffer.length} entries`;
        el.textContent = exportLog();
        el.scrollTop = el.scrollHeight;
      }

      setInterval(renderLog, 500);
    }

    function removePanel() {
      document.getElementById("xenon-debug-btn")?.remove();
      document.getElementById("xenon-debug-panel")?.remove();
      window.__debugPanelBuilt = false;
    }

    window.__refreshDebugButton = function () {
      if (userProfile?.debugMode) {
        if (!window.__debugPanelBuilt) buildPanel();
      } else {
        removePanel();
      }
    };

    const profileWatch = setInterval(() => {
      if (userProfile) {
        window.__refreshDebugButton();
        clearInterval(profileWatch);
      }
    }, 1000);
  })();
