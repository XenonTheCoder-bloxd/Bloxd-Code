(function() {
  'use strict';

  

 
  let currentUser = null;
  let userProfile = null;
  let isAdminUser = false;

  // Cloudflare backend helper: every API call goes through here so cookies
  // (the session) are always sent and JSON parsing/errors are handled once.
  async function apiFetch(path, options = {}) {
    const res = await fetch(path, {
      credentials: "include",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      ...options
    });
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      throw new Error((data && data.error) || "Something went wrong. Please try again.");
    }
    return data;
  }

  // Turns a D1 users-table row (snake_case, flat) into the shape the rest of
  // this file expects (camelCase, socials/stats nested) - same shape whether
  // it's your own profile or someone else's.
  function normalizeProfile(row) {
    return {
      uid: row.id,
      username: row.username,
      bio: row.bio || "Bloxd.io Developer",
      avatar: row.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${row.username}`,
      avatarZoom: row.avatar_zoom || 1,
      avatarPosX: row.avatar_pos_x ?? 50,
      avatarPosY: row.avatar_pos_y ?? 50,
      lastUsernameChange: row.last_username_change || 0,
      debugMode: !!row.debug_mode,
      portfolioBg: row.portfolio_bg || DEFAULT_BG,
      portfolioAudio: row.portfolio_audio || "",
      audioTitle: row.audio_title || "",
      customCode: row.custom_code || "",
      portfolioEffect: row.portfolio_effect || "none",
      cardX: row.card_x ?? 50,
      cardY: row.card_y ?? 50,
      socials: { discord: row.discord || "", github: row.github || "" },
      stats: { xp: row.xp || 0, lessons: row.lessons || 0 },
      profileViews: row.profile_views || 0,
      role: row.role || "user"
    };
  }

  function applySessionUser(row) {
    currentUser = { uid: row.id, username: row.username };
    userProfile = normalizeProfile(row);
    isAdminUser = userProfile.role === "admin";
  }

  

 
  const BANNED_WORDS = [
    "fuck", "shit", "bitch", "asshole", "cunt", "nigger", "nigga", "faggot", "dick",
    "pussy", "whore", "slut", "cock", "bastard", "nazi", "hitler", "kill", "suicide",
    "porn", "hentai", "sex", "dildo", "pedophile", "rape", "retard", "fag"
  ];

  const RESERVED_USERNAMES = [
    "admin", "administrator", "root", "system", "bloxd", "bloxdcode", "api", "auth",
    "support", "official", "mod", "moderator", "staff", "dev", "developer", "help"
  ];

  function normalizeLeet(text) {
    return text.toLowerCase()
      .replace(/[@4]/g, "a")
      .replace(/[3]/g, "e")
      .replace(/[1!|]/g, "i")
      .replace(/[0]/g, "o")
      .replace(/[$5]/g, "s")
      .replace(/[7]/g, "t")
      .replace(/[\-_.*+~#^]/g, "");
  }

  function containsProfanity(text) {
    if (!text) return false;
    const norm = normalizeLeet(text);
    for (const w of BANNED_WORDS) {
      if (norm.includes(w)) return true;
    }
    return false;
  }

  function validateUsername(username) {
    if (!username) return { valid: false, error: "Username cannot be empty." };
    const clean = username.trim().toLowerCase();
    if (clean.length < 3) return { valid: false, error: "Username must be at least 3 characters." };
    if (clean.length > 20) return { valid: false, error: "Username cannot exceed 20 characters." };
    if (!/^[a-z0-9_\-]+$/.test(clean)) return { valid: false, error: "Only letters, numbers, hyphens, and underscores allowed." };
    if (clean.startsWith("-") || clean.endsWith("-") || clean.startsWith("_") || clean.endsWith("_")) {
      return { valid: false, error: "Username cannot start or end with a hyphen or underscore." };
    }
    if (RESERVED_USERNAMES.includes(clean)) {
      return { valid: false, error: "This username is reserved." };
    }
    if (containsProfanity(clean)) return { valid: false, error: "Username contains inappropriate language." };
    return { valid: true, username: clean };
  }

  

 
  const USERNAME_COOLDOWN_MS = 60 * 60 * 1000;

  async function checkAuthGate() {
    const authGate = document.getElementById("auth-gate-screen");
    try {
      const data = await apiFetch("/api/auth/me");
      if (data && data.user) {
        applySessionUser(data.user);
        if (authGate) authGate.classList.add("hidden");
        if (publicViewUser && userProfile && publicViewUser === (userProfile.username || "").toLowerCase()) {
          publicViewUser = "";
          publicViewProfile = null;
        }
        updatePortfolioUI();
      } else {
        currentUser = null;
        userProfile = null;
        isAdminUser = false;
        if (authGate && !publicViewUser) authGate.classList.remove("hidden");
      }
    } catch (e) {
      if (authGate && !publicViewUser) authGate.classList.remove("hidden");
    }
    updateUserUI();
    renderDashboard();
  }

  function saveUserProfileData(data) {
    userProfile = { ...userProfile, ...data };
    updateUserUI();
    updatePortfolioUI();
    renderDashboard();

    if (!currentUser) return;

    const payload = {};
    if (data.avatar !== undefined) payload.avatar = data.avatar;
    if (data.bio !== undefined) payload.bio = data.bio;
    if (data.portfolioBg !== undefined) payload.portfolioBg = data.portfolioBg;
    if (data.portfolioAudio !== undefined) payload.portfolioAudio = data.portfolioAudio;
    if (data.audioTitle !== undefined) payload.audioTitle = data.audioTitle;
    if (data.customCode !== undefined) payload.customCode = data.customCode;
    if (data.portfolioEffect !== undefined) payload.portfolioEffect = data.portfolioEffect;
    if (data.cardX !== undefined) payload.cardX = data.cardX;
    if (data.cardY !== undefined) payload.cardY = data.cardY;
    if (data.avatarZoom !== undefined) payload.avatarZoom = data.avatarZoom;
    if (data.avatarPosX !== undefined) payload.avatarPosX = data.avatarPosX;
    if (data.avatarPosY !== undefined) payload.avatarPosY = data.avatarPosY;
    if (data.debugMode !== undefined) payload.debugMode = data.debugMode;
    if (data.socials !== undefined) {
      if (data.socials.discord !== undefined) payload.discord = data.socials.discord;
      if (data.socials.github !== undefined) payload.github = data.socials.github;
    }
    if (data.stats !== undefined) {
      if (data.stats.xp !== undefined) payload.xp = data.stats.xp;
      if (data.stats.lessons !== undefined) payload.lessons = data.stats.lessons;
    }
    if (Object.keys(payload).length === 0) return;

    apiFetch("/api/profile/update", { method: "POST", body: JSON.stringify(payload) }).catch(() => {
      showToast("Saved locally, but couldn't sync to the server - check your connection.", "error");
    });
  }

  async function updateUsernameWithCooldown(newUsername) {
    const valid = validateUsername(newUsername);
    if (!valid.valid) throw new Error(valid.error);
    const clean = valid.username;

    if (clean === userProfile.username) return;

    const data = await apiFetch("/api/profile/username", {
      method: "POST",
      body: JSON.stringify({ username: clean })
    });
    if (data && data.username) {
      userProfile.username = data.username;
      userProfile.lastUsernameChange = Date.now();
      currentUser.username = data.username;
    }
    await checkAuthGate();
  }

   
  function isVideoSource(url) {
    if (!url) return false;
    return url.startsWith("data:video/") || url.endsWith(".mp4") || url.endsWith(".webm") || url.endsWith(".mov");
  }

  

 
  const OLD_WALLPAPER = "https://iili.io/ndHmMve.webp";
  const DEFAULT_BG = "radial-gradient(circle at 50% 25%, #262626, #0b0b0b 75%)";

  const BG_PRESETS = [
    { name: "Midnight", value: "radial-gradient(circle at 50% 25%, #262626, #0b0b0b 75%)" },
    { name: "Ember", value: "linear-gradient(135deg, #3a0d0d, #0f0f0f 70%)" },
    { name: "Abyss", value: "linear-gradient(135deg, #0a2540, #050508 70%)" },
    { name: "Venom", value: "linear-gradient(135deg, #0b3d1e, #060606 70%)" },
    { name: "Royal", value: "linear-gradient(135deg, #2b0a4a, #080808 70%)" },
    { name: "Sunset Strip", value: "linear-gradient(135deg, #4a1503, #1a0a2e 60%, #050505 100%)" },
    { name: "Mono Fade", value: "linear-gradient(180deg, #2e2e2e, #0d0d0d)" },
    { name: "Cherry", value: "radial-gradient(circle at 80% 10%, #5c1030, #0a0a0a 65%)" },
    { name: "Ocean", value: "radial-gradient(circle at 20% 90%, #083344, #020202 65%)" },
    { name: "Cyber Grid", value: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1200&q=80" },
    { name: "Synth Sunset", value: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80" },
    { name: "Hacker Matrix", value: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80" },
    { name: "Deep Space", value: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80" },
    { name: "Peaks", value: "https://picsum.photos/seed/bloxdpeaks/1200/800" },
    { name: "City Night", value: "https://picsum.photos/seed/bloxdcity/1200/800" },
    { name: "Fog", value: "https://picsum.photos/seed/bloxdfog/1200/800" }
  ];

  function normalizeBg(src) {
    if (!src || src === OLD_WALLPAPER) return DEFAULT_BG;
    return src;
  }

  function isGradientBg(src) {
    return /gradient\(/.test(src || "");
  }

  function paintBg(layer, src) {
    if (!layer) return;
    const val = normalizeBg(src);
    if (isVideoSource(val)) {
      layer.style.backgroundImage = "none";
      layer.innerHTML = `<video src="${escapeHtml(val)}" autoplay loop muted playsinline class="portfolio-bg-video"></video>`;
    } else if (isGradientBg(val)) {
      layer.innerHTML = "";
      layer.style.backgroundImage = val;
    } else {
      layer.innerHTML = "";
      layer.style.backgroundImage = `url('${val}')`;
    }
  }

  function thumbFaceStyle(value) {
    const val = normalizeBg(value);
    if (isVideoSource(val) || isGradientBg(val)) return `background-image:${val};`;
    return `background-image:url('${val}');`;
  }

  let fxRAF = 0;
  let fxParts = [];
  let currentFxKind = "none";

  function stopStageFx() {
    if (fxRAF) cancelAnimationFrame(fxRAF);
    fxRAF = 0;
    fxParts = [];
    currentFxKind = "none";
    const c = document.getElementById("stage-fx");
    if (c) {
      try {
        c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
      } catch (e) {}
    }
  }

  function startStageFx(kind) {
    stopStageFx();
    currentFxKind = kind || "none";
    if (!currentFxKind || currentFxKind === "none") return;
    const stage = document.getElementById("studio-stage");
    if (!stage) return;
    let canvas = document.getElementById("stage-fx");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "stage-fx";
      stage.appendChild(canvas);
    }
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = rect.width;
    const H = rect.height;
    const R = Math.random;
    const dot = (x, y, r) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.283);
      ctx.fill();
    };
    if (currentFxKind === "rain") {
      for (let i = 0; i < 130; i++) fxParts.push({ x: R() * (W + 40) - 20, y: R() * H, len: 10 + R() * 14, sp: 9 + R() * 8, dr: -2 - R() * 2 });
    } else if (currentFxKind === "snow") {
      for (let i = 0; i < 110; i++) fxParts.push({ x: R() * W, y: R() * H, r: 1 + R() * 2.6, sp: 0.4 + R() * 1.1, ph: R() * 6.28, sw: 0.3 + R() * 0.7 });
    } else if (currentFxKind === "stars") {
      for (let i = 0; i < 150; i++) fxParts.push({ x: R() * W, y: R() * H, r: 0.4 + R() * 1.2, ph: R() * 6.28, sp: 0.5 + R() * 1.5 });
    } else if (currentFxKind === "fireflies") {
      for (let i = 0; i < 45; i++) fxParts.push({ x: R() * W, y: R() * H, vx: (R() - 0.5) * 0.4, vy: (R() - 0.5) * 0.4, ph: R() * 6.28, r: 1 + R() * 2 });
    } else {
      currentFxKind = "none";
      return;
    }
    const t0 = performance.now();
    const step = (now) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      if (currentFxKind === "rain") {
        ctx.strokeStyle = "rgba(170,190,220,0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const q of fxParts) {
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(q.x + q.dr * 0.6, q.y + q.len);
          q.y += q.sp;
          q.x += q.dr;
          if (q.y > H + 20) {
            q.y = -20;
            q.x = R() * (W + 40) - 20;
          }
        }
        ctx.stroke();
      } else if (currentFxKind === "snow") {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (const q of fxParts) {
          q.y += q.sp;
          q.x += Math.sin(t * 1.2 + q.ph) * q.sw * 0.5;
          if (q.y > H + 6) {
            q.y = -6;
            q.x = R() * W;
          }
          dot(q.x, q.y, q.r);
        }
      } else if (currentFxKind === "stars") {
        for (const q of fxParts) {
          ctx.fillStyle = `rgba(255,255,255,${(0.25 + 0.65 * Math.abs(Math.sin(t * q.sp + q.ph))).toFixed(3)})`;
          dot(q.x, q.y, q.r);
        }
      } else if (currentFxKind === "fireflies") {
        for (const q of fxParts) {
          q.x += q.vx + Math.sin(t + q.ph) * 0.15;
          q.y += q.vy + Math.cos(t * 0.8 + q.ph) * 0.15;
          if (q.x < -10) q.x = W + 10;
          if (q.x > W + 10) q.x = -10;
          if (q.y < -10) q.y = H + 10;
          if (q.y > H + 10) q.y = -10;
          const glow = 0.1 + 0.08 * Math.sin(t * 2 + q.ph);
          ctx.fillStyle = `rgba(255,220,130,${glow.toFixed(3)})`;
          dot(q.x, q.y, q.r * 4);
          ctx.fillStyle = "rgba(255,230,150,0.9)";
          dot(q.x, q.y, q.r);
        }
      }
      fxRAF = requestAnimationFrame(step);
    };
    fxRAF = requestAnimationFrame(step);
    if (!window.__fxResizeBound) {
      window.__fxResizeBound = 1;
      window.addEventListener("resize", () => {
        if (currentFxKind && currentFxKind !== "none") startStageFx(currentFxKind);
      });
    }
  }

  function syncFxRow(fx) {
    document.querySelectorAll("#studio-fx-row button").forEach(x => {
      x.classList.toggle("selected", x.getAttribute("data-fx") === fx);
    });
  }

  let audioPlayer = null;
  let isPlayingAudio = false;

  let avatarZoom = 1;
  let avatarPosX = 50;
  let avatarPosY = 50;

  function initPortfolio() {
    renderBgPresets();
    setupAudioControls();
    setupPortfolioForm();
    setupAvatarEditor();
    if (userProfile) {
      avatarZoom = userProfile.avatarZoom || 1;
      avatarPosX = userProfile.avatarPosX ?? 50;
      avatarPosY = userProfile.avatarPosY ?? 50;
    }
    updatePortfolioUI();
  }

  function avatarImgStyle() {
    return `width:100%;height:100%;object-fit:cover;object-position:${avatarPosX}% ${avatarPosY}%;transform:scale(${avatarZoom});pointer-events:none;`;
  }

  let pendingAvatarSrc = null;

  function renderCropPreview() {
    const circle = document.getElementById("avatar-crop-circle");
    if (!circle || !pendingAvatarSrc) return;
    if (isVideoSource(pendingAvatarSrc)) {
      circle.innerHTML = `<video src="${escapeHtml(pendingAvatarSrc)}" autoplay loop muted playsinline style="${avatarImgStyle()}"></video>`;
    } else {
      circle.innerHTML = `<img src="${escapeHtml(pendingAvatarSrc)}" draggable="false" style="${avatarImgStyle()}">`;
    }
  }

  function applyCropTransform() {
    const circle = document.getElementById("avatar-crop-circle");
    const media = circle ? circle.querySelector("img, video") : null;
    if (media) {
      media.style.objectPosition = `${avatarPosX}% ${avatarPosY}%`;
      media.style.transform = `scale(${avatarZoom})`;
    }
  }

  function openAvatarCropper(src) {
    const modal = document.getElementById("avatar-crop-modal");
    const circle = document.getElementById("avatar-crop-circle");
    const zoomInput = document.getElementById("avatar-crop-zoom");
    if (!modal || !circle) return;

    const useSrc = src || pendingAvatarSrc || userProfile?.avatar || "";
    if (!useSrc) {
      showToast("Upload or paste a picture first.", "error");
      return;
    }
    pendingAvatarSrc = useSrc;

    if (userProfile && useSrc === userProfile.avatar) {
      avatarZoom = userProfile.avatarZoom || 1;
      avatarPosX = userProfile.avatarPosX ?? 50;
      avatarPosY = userProfile.avatarPosY ?? 50;
    } else {
      avatarZoom = 1;
      avatarPosX = 50;
      avatarPosY = 50;
    }
    if (zoomInput) zoomInput.value = String(avatarZoom);
    renderCropPreview();
    modal.classList.add("active");
  }

  function closeAvatarCropper(restore) {
    const modal = document.getElementById("avatar-crop-modal");
    if (modal) modal.classList.remove("active");
    if (restore && userProfile) {
      avatarZoom = userProfile.avatarZoom || 1;
      avatarPosX = userProfile.avatarPosX ?? 50;
      avatarPosY = userProfile.avatarPosY ?? 50;
    }
    pendingAvatarSrc = null;
  }

  function setupAvatarEditor() {
    const zoomInput = document.getElementById("avatar-crop-zoom");
    if (zoomInput) {
      zoomInput.oninput = () => {
        avatarZoom = parseFloat(zoomInput.value) || 1;
        applyCropTransform();
      };
    }

    const resetBtn = document.getElementById("avatar-crop-reset");
    if (resetBtn) {
      resetBtn.onclick = () => {
        avatarZoom = 1;
        avatarPosX = 50;
        avatarPosY = 50;
        if (zoomInput) zoomInput.value = "1";
        applyCropTransform();
      };
    }

    const applyBtn = document.getElementById("avatar-crop-apply");
    if (applyBtn) {
      applyBtn.onclick = () => {
        if (!pendingAvatarSrc) return;
        const aInput = document.getElementById("studio-avatar-input");
        if (aInput) aInput.value = pendingAvatarSrc;
        saveUserProfileData({
          avatar: pendingAvatarSrc,
          avatarZoom,
          avatarPosX,
          avatarPosY
        });
        closeAvatarCropper(false);
        showToast("Profile picture updated!", "success");
      };
    }

    const closeBtn = document.getElementById("avatar-crop-close");
    if (closeBtn) {
      closeBtn.onclick = () => closeAvatarCropper(true);
    }

    const modal = document.getElementById("avatar-crop-modal");
    if (modal && !modal.dataset.cropBound) {
      modal.dataset.cropBound = "1";
      modal.addEventListener("mousedown", (e) => {
        if (e.target === modal) closeAvatarCropper(true);
      });
    }

    const adjustBtn = document.getElementById("studio-avatar-adjust");
    if (adjustBtn) {
      adjustBtn.onclick = () => {
        const val = document.getElementById("studio-avatar-input")?.value?.trim();
        openAvatarCropper(val || undefined);
      };
    }

    const circle = document.getElementById("avatar-crop-circle");
    if (circle && !circle.dataset.dragBound) {
      circle.dataset.dragBound = "1";
      let dragging = false;
      let lastX = 0;
      let lastY = 0;

      const startDrag = (x, y) => {
        dragging = true;
        lastX = x;
        lastY = y;
      };
      const moveDrag = (x, y) => {
        if (!dragging) return;
        const rect = circle.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dx = x - lastX;
        const dy = y - lastY;
        lastX = x;
        lastY = y;
        avatarPosX = Math.min(100, Math.max(0, avatarPosX - (dx / rect.width) * 100));
        avatarPosY = Math.min(100, Math.max(0, avatarPosY - (dy / rect.height) * 100));
        applyCropTransform();
      };
      const endDrag = () => { dragging = false; };

      circle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        startDrag(e.clientX, e.clientY);
      });
      window.addEventListener("mousemove", (e) => moveDrag(e.clientX, e.clientY));
      window.addEventListener("mouseup", endDrag);
      circle.addEventListener("touchstart", (e) => {
        const t = e.touches[0];
        startDrag(t.clientX, t.clientY);
      }, { passive: true });
      circle.addEventListener("touchmove", (e) => {
        const t = e.touches[0];
        moveDrag(t.clientX, t.clientY);
      }, { passive: true });
      circle.addEventListener("touchend", endDrag);
      circle.addEventListener("wheel", (e) => {
        e.preventDefault();
        avatarZoom = Math.min(3, Math.max(1, avatarZoom - Math.sign(e.deltaY) * 0.1));
        if (zoomInput) zoomInput.value = String(avatarZoom);
        applyCropTransform();
      }, { passive: false });
    }
  }

  function renderBgPresets() {
    const container = document.getElementById("bg-presets-container");
    if (!container) return;
    const current = normalizeBg(userProfile?.portfolioBg);
    container.innerHTML = "";
    BG_PRESETS.forEach((b, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bg-thumb" + (normalizeBg(b.value) === current ? " selected" : "");
      btn.title = b.name;
      const face = document.createElement("div");
      face.className = "bg-thumb-face";
      face.style.cssText = thumbFaceStyle(b.value) + "background-size:cover;background-position:center;";
      const label = document.createElement("small");
      label.textContent = b.name;
      btn.appendChild(face);
      btn.appendChild(label);
      btn.onclick = () => window.setDevBg(b.value);
      container.appendChild(btn);
    });
  }

  window.setDevBg = function(value) {
    const val = normalizeBg(value);
    const input = document.getElementById("studio-bg-input");
    if (input) input.value = val;
    paintBg(document.getElementById("stage-bg-layer"), val);
    if (userProfile) {
      saveUserProfileData({ portfolioBg: val });
      renderBgPresets();
      showToast("Background updated!", "success");
    }
  };

  function setupAudioControls() {
    const playBtn = document.getElementById("stage-play-btn");
    if (playBtn) {
      playBtn.onclick = () => {
        const audioSrc = (publicViewProfile || userProfile)?.portfolioAudio;
        if (!audioSrc) return;

        if (!audioPlayer || audioPlayer.src !== audioSrc) {
          if (audioPlayer) audioPlayer.pause();
          audioPlayer = new Audio(audioSrc);
          audioPlayer.loop = true;
        }

        if (isPlayingAudio) {
          audioPlayer.pause();
          isPlayingAudio = false;
          playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
        } else {
          audioPlayer.play().then(() => {
            isPlayingAudio = true;
            playBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
          }).catch(() => {
            showToast("Click play again to start audio", "info");
          });
        }
      };
    }
  }

  function updatePortfolioUI() {
    const pubMode = !!publicViewUser;
    const p = pubMode ? publicViewProfile : userProfile;
    document.body.classList.toggle("public-mode", pubMode);
    const toolbar = document.querySelector(".studio-toolbar");
    if (toolbar) toolbar.style.display = pubMode ? "none" : "";
    const banner = document.getElementById("public-view-banner");
    if (banner) {
      banner.style.display = (pubMode && !bannerDismissed) ? "flex" : "none";
      if (pubMode) {
        const bn = document.getElementById("public-view-name");
        if (bn) bn.textContent = (p && p.username) || publicViewUser;
        const signBtn = document.getElementById("public-view-signin");
        if (signBtn) signBtn.textContent = userProfile ? "Back to editor" : "Sign in";
      }
    }
    if (!p) {
      if (!pubMode) return;
      paintBg(document.getElementById("stage-bg-layer"), null);
      const nfCard = document.getElementById("studio-card");
      if (nfCard) {
        nfCard.style.left = "50%";
        nfCard.style.top = "50%";
      }
      avatarZoom = 1;
      avatarPosX = 50;
      avatarPosY = 50;
      const avatarContainer = document.getElementById("stage-avatar-container");
      if (avatarContainer) {
        avatarContainer.innerHTML = `<img src="https://api.dicebear.com/7.x/bottts/svg?seed=${escapeHtml(publicViewUser)}" class="portfolio-clean-avatar" alt="Avatar" draggable="false" style="${avatarImgStyle()}">`;
      }
      const nameEl = document.getElementById("stage-name");
      if (nameEl) nameEl.textContent = publicViewUser;
      const handleEl = document.getElementById("stage-handle");
      if (handleEl) handleEl.textContent = `${publicViewUser}.bloxdcode.com`;
      const bioEl = document.getElementById("stage-bio");
      if (bioEl) bioEl.textContent = "Couldn't load this portfolio. Whoever shared it may need to open it once with their ad-blocker paused so it can sync.";
      const socialsEl = document.getElementById("stage-socials");
      if (socialsEl) socialsEl.innerHTML = "";
      const viewsEl = document.getElementById("stage-views");
      if (viewsEl) viewsEl.innerHTML = `<i class="fa-regular fa-eye"></i> 0 views`;
      const audioWidget = document.getElementById("portfolio-audio-widget");
      if (audioWidget) audioWidget.classList.remove("has-audio");
      renderCustomSandbox("");
      stopStageFx();
      return;
    }

    const sub = document.getElementById("studio-subdomain-display");
    if (sub) sub.textContent = `${p.username}.bloxdcode.com`;

    const uInput = document.getElementById("studio-username-input");
    if (uInput) uInput.value = p.username;

    const aInput = document.getElementById("studio-avatar-input");
    if (aInput && document.activeElement !== aInput) aInput.value = p.avatar || "";

    const bgInput = document.getElementById("studio-bg-input");
    if (bgInput && document.activeElement !== bgInput) bgInput.value = normalizeBg(p.portfolioBg);

    const dInput = document.getElementById("studio-discord-input");
    if (dInput) dInput.value = p.socials?.discord || "";

    const gInput = document.getElementById("studio-github-input");
    if (gInput) gInput.value = p.socials?.github || "";

    const cInput = document.getElementById("studio-custom-code-input");
    if (cInput) cInput.value = p.customCode || "";

    const debugToggle = document.getElementById("studio-debug-toggle");
    if (debugToggle) {
      debugToggle.checked = !!userProfile?.debugMode;
      debugToggle.onchange = () => {
        saveUserProfileData({ debugMode: debugToggle.checked });
        if (typeof window.__refreshDebugButton === "function") window.__refreshDebugButton();
      };
    }

    paintBg(document.getElementById("stage-bg-layer"), p.portfolioBg);

    const card = document.getElementById("studio-card");
    if (card) {
      card.style.left = `${p.cardX ?? 50}%`;
      card.style.top = `${p.cardY ?? 50}%`;
    }

    avatarZoom = p.avatarZoom || 1;
    avatarPosX = p.avatarPosX ?? 50;
    avatarPosY = p.avatarPosY ?? 50;

    const avatarContainer = document.getElementById("stage-avatar-container");
    if (avatarContainer) {
      const avatarSrc = p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.username}`;
      if (isVideoSource(avatarSrc)) {
        avatarContainer.innerHTML = `<video src="${escapeHtml(avatarSrc)}" autoplay loop muted playsinline class="portfolio-clean-avatar" style="${avatarImgStyle()}"></video>`;
      } else {
        avatarContainer.innerHTML = `<img src="${escapeHtml(avatarSrc)}" class="portfolio-clean-avatar" alt="Avatar" draggable="false" style="${avatarImgStyle()}">`;
      }
    }

    const nameEl = document.getElementById("stage-name");
    if (nameEl && !nameEl.classList.contains("editing")) nameEl.textContent = p.username;

    const handleEl = document.getElementById("stage-handle");
    if (handleEl) handleEl.textContent = `${p.username}.bloxdcode.com`;

    const bioEl = document.getElementById("stage-bio");
    if (bioEl && !bioEl.classList.contains("editing")) bioEl.textContent = p.bio || "Bloxd.io Developer";

    const socialsEl = document.getElementById("stage-socials");
    if (socialsEl) {
      const parts = [];
      if (p.socials?.discord) parts.push(`<span class="nav-badge" style="font-size:10.5px;"><i class="fa-brands fa-discord"></i> ${escapeHtml(p.socials.discord)}</span>`);
      if (p.socials?.github) parts.push(`<span class="nav-badge" style="font-size:10.5px;"><i class="fa-brands fa-github"></i> ${escapeHtml(p.socials.github)}</span>`);
      socialsEl.innerHTML = parts.join("");
    }

    const viewsEl = document.getElementById("stage-views");
    if (viewsEl) {
      const n = p.profileViews ?? 0;
      viewsEl.innerHTML = `<i class="fa-regular fa-eye"></i> ${n} view${n === 1 ? "" : "s"}`;
    }

    const audioWidget = document.getElementById("portfolio-audio-widget");
    const audioLabel = document.getElementById("stage-music-title");
    if (audioWidget) {
      if (p.portfolioAudio) {
        audioWidget.classList.add("has-audio");
        if (audioLabel) audioLabel.textContent = p.audioTitle || "Uploaded Audio Track";
      } else {
        audioWidget.classList.remove("has-audio");
      }
    }

    const musicCurrent = document.getElementById("studio-music-current");
    if (musicCurrent) musicCurrent.textContent = p.portfolioAudio ? (p.audioTitle || "Uploaded track") : "No track added";

    renderCustomSandbox(p.customCode || "");
    startStageFx(p.portfolioEffect || "none");
    syncFxRow(p.portfolioEffect || "none");
  }

  function renderCustomSandbox(code) {
    const frame = document.getElementById("stage-sandbox-frame");
    if (!frame) return;

    const hasContent = String(code || "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").trim();
    if (!hasContent) {
      frame.srcdoc = "<!DOCTYPE html><html><body></body></html>";
      return;
    }

    // The iframe carries sandbox="allow-scripts" (no allow-same-origin) in index.html, so
    // this document is always opaque-origin: it cannot reach window.parent, cookies,
    // localStorage, or IndexedDB on the real site no matter what the code does. No
    // string-blocklist needed - the browser enforces this, not a regex.
    frame.srcdoc = `
      <!DOCTYPE html>
      <html>
        <head><style>body{margin:0;overflow:hidden;background:transparent;color:#fff;font-family:sans-serif;}</style></head>
        <body>${code}</body>
      </html>
    `;
  }

  let cardSuppressClick = false;

  function hideCardMenu() {
    const menu = document.getElementById("studio-card-menu");
    if (menu) {
      menu.classList.remove("show");
      menu.style.display = "none";
    }
    document.getElementById("studio-card")?.classList.remove("menu-open");
  }

  function showCardMenu() {
    const menu = document.getElementById("studio-card-menu");
    const card = document.getElementById("studio-card");
    const stage = document.getElementById("studio-stage");
    if (!menu || !card || !stage) return;
    const sr = stage.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    if (!sr.width || !sr.height) return;
    menu.style.left = ((cr.left + cr.width / 2 - sr.left) / sr.width * 100) + "%";
    menu.style.top = ((cr.top - sr.top) / sr.height * 100) + "%";
    menu.classList.toggle("below", (cr.top - sr.top) < 70);
    menu.style.display = "flex";
    menu.classList.remove("show");
    void menu.offsetWidth;
    menu.classList.add("show");
    card.classList.add("menu-open");
  }

  function startInlineEdit(el) {
    if (!el || !userProfile || studioReadOnly() || el.classList.contains("editing")) return;
    hideCardMenu();
    el.contentEditable = "true";
    el.classList.add("editing");
    el.focus();
    try { document.execCommand("selectAll", false, null); } catch (err) {}
  }

  function setupPortfolioForm() {
    const togglePop = (id) => {
      hideCardMenu();
      ["studio-bg-pop", "studio-music-pop", "studio-settings-pop"].forEach(pid => {
        const el = document.getElementById(pid);
        if (!el) return;
        el.style.display = (pid === id && el.style.display === "none") ? "block" : "none";
      });
    };
    const bindToggle = (btnId, popId) => {
      const btn = document.getElementById(btnId);
      if (btn) btn.onclick = (e) => { e.stopPropagation(); togglePop(popId); };
    };
    bindToggle("studio-bg-btn", "studio-bg-pop");
    bindToggle("studio-music-btn", "studio-music-pop");
    bindToggle("studio-settings-btn", "studio-settings-pop");

    document.querySelectorAll("[data-close-pop]").forEach(btn => {
      btn.onclick = () => {
        const el = document.getElementById(btn.getAttribute("data-close-pop"));
        if (el) el.style.display = "none";
      };
    });

    
    const codeModal = document.getElementById("studio-code-modal");
    const codeBtn = document.getElementById("studio-code-btn");
    if (codeBtn) codeBtn.onclick = () => codeModal?.classList.add("active");
    const codeClose = document.getElementById("studio-code-close");
    if (codeClose) codeClose.onclick = () => codeModal?.classList.remove("active");
    if (codeModal && !codeModal.dataset.bound) {
      codeModal.dataset.bound = "1";
      codeModal.addEventListener("mousedown", (e) => {
        if (e.target === codeModal) codeModal.classList.remove("active");
      });
    }
    const codeSave = document.getElementById("studio-code-save");
    if (codeSave) {
      codeSave.onclick = () => {
        const val = document.getElementById("studio-custom-code-input")?.value || "";
        saveUserProfileData({ customCode: val });
        codeModal?.classList.remove("active");
        showToast("Code applied to your portfolio!", "success");
      };
    }

    const copyBtn = document.getElementById("copy-subdomain-btn");
    if (copyBtn) {
      copyBtn.onclick = () => {
        const name = userProfile?.username || "dev";
        const base = window.location.href.split(/[?#]/)[0];
        const link = base + "?u=" + encodeURIComponent(name);
        navigator.clipboard.writeText(link).then(() => {
          showToast("Profile link copied!", "success");
        });
      };
    }

    const pubSign = document.getElementById("public-view-signin");
    if (pubSign) {
      pubSign.onclick = () => {
        const wasLogged = !!userProfile;
        publicViewUser = "";
        publicViewProfile = null;
        publicViewNotFound = false;
        bannerDismissed = false;
        hideCardMenu();
        updatePortfolioUI();
        if (!wasLogged) document.getElementById("auth-gate-screen")?.classList.remove("hidden");
      };
    }

    const pubHide = document.getElementById("public-view-hide");
    if (pubHide) {
      pubHide.onclick = () => {
        bannerDismissed = true;
        const banner = document.getElementById("public-view-banner");
        if (banner) banner.style.display = "none";
      };
    }

    const previewBtn = document.getElementById("studio-preview-btn");
    if (previewBtn) {
      previewBtn.onclick = () => {
        if (!userProfile) return;
        bannerDismissed = false;
        publicViewUser = (userProfile.username || "").toLowerCase();
        publicViewProfile = userProfile;
        publicViewNotFound = false;
        hideCardMenu();
        ["studio-bg-pop", "studio-music-pop", "studio-settings-pop"].forEach(pid => {
          const el = document.getElementById(pid);
          if (el) el.style.display = "none";
        });
        navigateTo("portfolio");
        updatePortfolioUI();
        showToast("This is what visitors see.", "info");
      };
    }

    document.querySelectorAll("#studio-fx-row button").forEach(b => {
      b.onclick = () => {
        const fx = b.getAttribute("data-fx") || "none";
        saveUserProfileData({ portfolioEffect: fx });
        startStageFx(fx);
        syncFxRow(fx);
        showToast(fx === "none" ? "Effect off." : `Effect on: ${fx}`, "success");
      };
    });

    
    const avatarFile = document.getElementById("studio-avatar-file-upload");
    const avatarFileName = document.getElementById("studio-avatar-filename");
    if (avatarFile) {
      avatarFile.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          if (avatarFileName) avatarFileName.textContent = file.name;
          const r = new FileReader();
          r.onload = (ev) => {
            openAvatarCropper(ev.target.result);
          };
          r.readAsDataURL(file);
        }
        avatarFile.value = "";
      };
    }

    
    const bgFile = document.getElementById("studio-bg-file-upload");
    const bgFileName = document.getElementById("studio-bg-filename");
    if (bgFile) {
      bgFile.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          if (bgFileName) bgFileName.textContent = file.name;
          const r = new FileReader();
          r.onload = (ev) => {
            const dataUrl = ev.target.result;
            const input = document.getElementById("studio-bg-input");
            if (input) input.value = "";
            paintBg(document.getElementById("stage-bg-layer"), dataUrl);
            saveUserProfileData({ portfolioBg: dataUrl });
            renderBgPresets();
            showToast("Background updated!", "success");
          };
          r.readAsDataURL(file);
        }
        bgFile.value = "";
      };
    }

    
    const bgApplyUrl = document.getElementById("studio-bg-apply-url");
    if (bgApplyUrl) {
      bgApplyUrl.onclick = () => {
        const val = document.getElementById("studio-bg-input")?.value?.trim();
        if (!val) {
          showToast("Paste a background URL first.", "error");
          return;
        }
        paintBg(document.getElementById("stage-bg-layer"), val);
        saveUserProfileData({ portfolioBg: normalizeBg(val) });
        renderBgPresets();
        showToast("Background updated!", "success");
      };
    }

    
    const audioFile = document.getElementById("studio-audio-file-upload");
    const audioFileName = document.getElementById("studio-audio-filename");
    if (audioFile) {
      audioFile.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          if (audioFileName) audioFileName.textContent = file.name;
          const r = new FileReader();
          r.onload = (ev) => {
            saveUserProfileData({ portfolioAudio: ev.target.result, audioTitle: file.name });
            showToast(`Now playing on your card: ${file.name}`, "success");
          };
          r.readAsDataURL(file);
        }
        audioFile.value = "";
      };
    }

    
    const musicRemove = document.getElementById("studio-music-remove");
    if (musicRemove) {
      musicRemove.onclick = () => {
        if (audioPlayer) {
          try { audioPlayer.pause(); } catch (e) {}
          audioPlayer = null;
        }
        isPlayingAudio = false;
        const playBtn = document.getElementById("stage-play-btn");
        if (playBtn) playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
        saveUserProfileData({ portfolioAudio: "", audioTitle: "" });
        showToast("Track removed.", "info");
      };
    }

    
    const avatarInput = document.getElementById("studio-avatar-input");
    if (avatarInput) {
      avatarInput.oninput = () => {
        const val = avatarInput.value.trim();
        const container = document.getElementById("stage-avatar-container");
        if (container && val) {
          if (isVideoSource(val)) {
            container.innerHTML = `<video src="${escapeHtml(val)}" autoplay loop muted playsinline class="portfolio-clean-avatar" style="${avatarImgStyle()}"></video>`;
          } else {
            container.innerHTML = `<img src="${escapeHtml(val)}" class="portfolio-clean-avatar" alt="Avatar" draggable="false" style="${avatarImgStyle()}">`;
          }
        }
      };
    }

    
    const settingsSave = document.getElementById("studio-settings-save");
    if (settingsSave) {
      settingsSave.onclick = async () => {
        if (settingsSave.disabled) return;
        settingsSave.disabled = true;
        settingsSave.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

        try {
          const newUsername = document.getElementById("studio-username-input")?.value?.trim();
          const avatar = document.getElementById("studio-avatar-input")?.value?.trim();
          const discord = document.getElementById("studio-discord-input")?.value;
          const github = document.getElementById("studio-github-input")?.value;
          if (newUsername && newUsername.toLowerCase() !== userProfile.username.toLowerCase()) {
            await updateUsernameWithCooldown(newUsername);
          }

          saveUserProfileData({
            avatar: avatar || userProfile.avatar,
            socials: { discord, github }
          });

          document.getElementById("studio-settings-pop").style.display = "none";
          showToast("Settings saved!", "success");
        } catch (err) {
          showToast(err.message || "Error saving settings", "error");
        } finally {
          settingsSave.disabled = false;
          settingsSave.innerHTML = `<i class="fa-solid fa-check"></i> Save settings`;
        }
      };
    }

    
    const cardReset = document.getElementById("studio-card-reset");
    if (cardReset) {
      cardReset.onclick = () => {
        saveUserProfileData({ cardX: 50, cardY: 50 });
        showToast("Card moved back to center.", "info");
      };
    }

    
    const card = document.getElementById("studio-card");
    const stage = document.getElementById("studio-stage");
    if (card && stage && !card.dataset.dragBound) {
      card.dataset.dragBound = "1";
      let held = false;
      let dragActive = false;
      let startX = 0;
      let startY = 0;
      let downEl = null;
      let holdTimer = null;

      const cancelHold = () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
        card.classList.remove("arming");
      };

      card.addEventListener("pointerdown", (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        if (!userProfile || studioReadOnly()) return;
        if (e.target.closest("button") || e.target.closest('[contenteditable="true"]')) return;
        held = true;
        downEl = e.target;
        startX = e.clientX;
        startY = e.clientY;
        card.classList.add("arming");
        try { card.setPointerCapture(e.pointerId); } catch (err) {}
        holdTimer = setTimeout(() => {
          if (!held || !userProfile) return;
          holdTimer = null;
          dragActive = true;
          cardSuppressClick = true;
          card.classList.remove("arming");
          card.classList.add("dragging");
          hideCardMenu();
        }, 350);
      });

      card.addEventListener("pointermove", (e) => {
        if (!held) return;
        if (!dragActive) {
          if (Math.hypot(e.clientX - startX, e.clientY - startY) > 8) {
            cancelHold();
            held = false;
          }
          return;
        }
        const rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = Math.min(92, Math.max(8, ((e.clientX - rect.left) / rect.width) * 100));
        const y = Math.min(88, Math.max(12, ((e.clientY - rect.top) / rect.height) * 100));
        card.style.left = x + "%";
        card.style.top = y + "%";
        card.dataset.px = x;
        card.dataset.py = y;
      });

      const endPress = (e) => {
        if (!held && !dragActive) return;
        cancelHold();
        const wasDrag = dragActive;
        held = false;
        dragActive = false;
        card.classList.remove("dragging");
        if (wasDrag) {
          setTimeout(() => { cardSuppressClick = false; }, 150);
          if (card.dataset.px !== undefined) {
            saveUserProfileData({
              cardX: parseFloat(card.dataset.px),
              cardY: parseFloat(card.dataset.py)
            });
          }
          return;
        }
        const t = downEl;
        downEl = null;
        if (t && t.closest) {
          if (t.closest("#stage-avatar-container")) {
            if (!studioReadOnly()) avatarFile?.click();
            return;
          }
          if (t.closest("button") || t.closest('[contenteditable="true"]')) return;
        }
        const menu = document.getElementById("studio-card-menu");
        if (menu && menu.classList.contains("show")) hideCardMenu();
        else showCardMenu();
      };
      card.addEventListener("pointerup", endPress);
      card.addEventListener("pointercancel", () => {
        cancelHold();
        held = false;
        dragActive = false;
        downEl = null;
        card.classList.remove("dragging");
        setTimeout(() => { cardSuppressClick = false; }, 50);
      });
    }

    
    if (stage && !stage.dataset.menuBound) {
      stage.dataset.menuBound = "1";
      stage.addEventListener("pointerdown", (e) => {
        if (!e.target.closest("#studio-card") && !e.target.closest("#studio-card-menu") && !e.target.closest(".studio-pop")) {
          hideCardMenu();
        }
      });
    }

    
    const cardMenu = document.getElementById("studio-card-menu");
    if (cardMenu && !cardMenu.dataset.bound) {
      cardMenu.dataset.bound = "1";
      cardMenu.querySelectorAll("button").forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const act = btn.getAttribute("data-act");
          hideCardMenu();
          if (act === "name") startInlineEdit(document.getElementById("stage-name"));
          else if (act === "bio") startInlineEdit(document.getElementById("stage-bio"));
          else if (act === "pic") document.getElementById("studio-avatar-file-upload")?.click();
          else if (act === "center") saveUserProfileData({ cardX: 50, cardY: 50 });
        };
      });
    }

    
    if (!document.body.dataset.studioEscBound) {
      document.body.dataset.studioEscBound = "1";
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (document.querySelector("#studio-card .editing")) return;
        const portfolioActive = document.getElementById("view-portfolio")?.classList.contains("active");
        const cropModal = document.getElementById("avatar-crop-modal");
        const cropOpen = cropModal && cropModal.classList.contains("active");
        if (!portfolioActive && !cropOpen) return;
        if (cropOpen) {
          closeAvatarCropper(true);
          return;
        }
        const codeModal = document.getElementById("studio-code-modal");
        if (codeModal && codeModal.classList.contains("active")) {
          codeModal.classList.remove("active");
          return;
        }
        if (!userProfile || publicViewProfile) return;
        hideCardMenu();
        ["studio-bg-pop", "studio-music-pop", "studio-settings-pop"].forEach(pid => {
          const el = document.getElementById(pid);
          if (el) el.style.display = "none";
        });
        saveUserProfileData({ cardX: 50, cardY: 50 });
        showToast("Card moved back to center.", "info");
      });
    }

    
    const bindInlineEdit = (id, opts) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.editBound) return;
      el.dataset.editBound = "1";

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        startInlineEdit(el);
      });

      el.addEventListener("keydown", (e) => {
        if (opts.singleLine && e.key === "Enter") {
          e.preventDefault();
          el.blur();
        }
        if (e.key === "Escape") {
          el.textContent = opts.get();
          el.blur();
        }
      });

      el.addEventListener("blur", async () => {
        if (!el.classList.contains("editing")) return;
        el.contentEditable = "false";
        el.classList.remove("editing");
        if (!userProfile) {
          el.textContent = opts.get();
          return;
        }
        const val = el.textContent.trim();
        if (!val) {
          el.textContent = opts.get();
          return;
        }
        try {
          await opts.set(val);
        } catch (err) {
          el.textContent = opts.get();
          showToast(err.message || "Couldn't save that", "error");
        }
      });
    };

    bindInlineEdit("stage-name", {
      singleLine: true,
      get: () => userProfile?.username || "",
      set: async (val) => {
        if (val.toLowerCase() === (userProfile.username || "").toLowerCase()) {
          updatePortfolioUI();
          return;
        }
        await updateUsernameWithCooldown(val);
        showToast("Username updated!", "success");
      }
    });

    bindInlineEdit("stage-bio", {
      singleLine: false,
      get: () => userProfile?.bio || "",
      set: async (val) => {
        saveUserProfileData({ bio: val });
        showToast("Bio updated!", "success");
      }
    });
  }

  

 
  const KNOWN_SEED_IDS = ["post_1", "post_2", "post_3"];

  let forumPosts = JSON.parse(localStorage.getItem("bloxd_real_forum_posts") || "null");
  if (!Array.isArray(forumPosts)) forumPosts = [];
  const cleaned = forumPosts.filter(p => !KNOWN_SEED_IDS.includes(p.id));
  if (cleaned.length !== forumPosts.length) {
    forumPosts = cleaned;
    localStorage.setItem("bloxd_real_forum_posts", JSON.stringify(forumPosts));
  }

  let forumCategory = "all";
  let dashboardCategory = "all";

  let communityCodes = JSON.parse(localStorage.getItem("bloxd_community_codes") || "[]");
  if (!Array.isArray(communityCodes)) communityCodes = [];

  let usersDirectory = [];
  async function refreshUsersDirectory() {
    try {
      const data = await apiFetch("/api/users/directory");
      if (data && Array.isArray(data.users)) {
        usersDirectory = data.users;
        renderDashboard();
      }
    } catch (e) {
      console.warn("Failed to load user directory:", e);
    }
  }

  function initForum() {
    renderForumFeed();
    subscribeForumPosts();
    setupForum();
  }

  function parseCodeInPost(content) {
    if (!content) return "";
    let codeCounter = 0;
    const codeBlocks = [];

    // Claude Security Patch: pull code fences out into placeholders first, so the
    // surrounding prose can be safely escaped without double-escaping the code HTML.
    let withPlaceholders = content.replace(/```(?:([a-zA-Z0-9_-]+)\n)?([\s\S]*?)```/g, (match, lang, code) => {
      lang = lang ? lang.toLowerCase() : "javascript";
      codeCounter++;
      const codeId = "code_block_" + codeCounter + "_" + Date.now();
      let highlighted = escapeHtml(code.trim());

      if (window.hljs) {
        try {
          highlighted = window.hljs.highlight(code.trim(), { language: lang }).value;
        } catch (e) {
          highlighted = escapeHtml(code.trim());
        }
      }

      const html = `
        <div class="code-box-container">
          <div class="code-box-header">
            <span>${escapeHtml(lang.toUpperCase())}</span>
            <button class="btn btn-secondary" style="font-size:11px;padding:2px 6px;" onclick="window.copyCodeSnippet('${codeId}')">
              <i class="fa-regular fa-copy"></i> Copy
            </button>
          </div>
          <pre class="code-box-pre"><code id="${codeId}" class="language-${lang}">${highlighted}</code></pre>
        </div>
      `;
      const placeholder = "\u0000CODEBLOCK" + (codeBlocks.length) + "\u0000";
      codeBlocks.push(html);
      return placeholder;
    });

    // Claude Security Patch: escape whatever text remains (previously inserted raw into innerHTML)
    let escaped = escapeHtml(withPlaceholders).replace(/\n(?!(?:<\/pre>|<\/div>|<div))/g, "<br>");

    codeBlocks.forEach((html, i) => {
      escaped = escaped.replace("\u0000CODEBLOCK" + i + "\u0000", html);
    });

    return escaped;
  }

  window.copyCodeSnippet = function(id) {
    const el = document.getElementById(id);
    if (el) {
      navigator.clipboard.writeText(el.innerText).then(() => {
        showToast("Code copied to clipboard!", "success");
      });
    }
  };

  function renderForumFeed() {
    const feed = document.getElementById("forum-posts-feed");
    if (!feed) return;

    const filtered = forumCategory === "all" ? forumPosts : forumPosts.filter(p => p.category === forumCategory);

    if (filtered.length === 0) {
      feed.innerHTML = `
        <div class="clean-box" style="text-align:center;padding:40px;color:var(--text-muted);">
          <i class="fa-regular fa-comments" style="font-size:28px;margin-bottom:12px;color:var(--text-dim);"></i>
          <h3 style="font-size:16px;color:#fff;margin-bottom:4px;">Nothing here yet</h3>
          <p style="font-size:13px;">Posts from the community will show up here.</p>
        </div>
      `;
      return;
    }

    feed.innerHTML = filtered.map(p => {
      const canDelete = (currentUser && p.uid && p.uid === currentUser.uid) || isAdminUser;
      return `
      <div class="forum-post-card" data-post-id="${escapeHtml(p.id)}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${p.author}" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border-color);">
            <div>
              <strong style="font-size:13.5px;color:#fff;">${escapeHtml(p.author)}</strong>
              <span style="font-size:11px;color:var(--text-dim);margin-left:6px;">${new Date(p.timestamp).toLocaleDateString()}</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="nav-badge">${(p.category || "GENERAL").toUpperCase()}</span>
            ${canDelete ? `<button type="button" data-delete-post title="Delete" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:13px;padding:2px 4px;"><i class="fa-solid fa-trash"></i></button>` : ""}
          </div>
        </div>
        <h3 style="font-size:15.5px;color:#fff;margin-bottom:8px;">${escapeHtml(p.title)}</h3>
        <div style="font-size:13.5px;color:var(--text-muted);line-height:1.6;">${parseCodeInPost(p.content)}</div>
        ${p.mediaUrl ? `<img src="${escapeHtml(p.mediaUrl)}" style="max-width:100%;max-height:300px;border-radius:6px;margin-top:12px;border:1px solid var(--border-color);">` : ""}
      </div>
    `;
    }).join("");
  }

  // Shared upload helper: sends a file to R2 via the backend, used by both
  // forum post media and community code screenshots.
  async function uploadFile(file, folder) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);
    const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: formData });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || "Upload failed.");
    return data;
  }

  function deleteForumPost(postId) {
    const post = forumPosts.find((p) => p.id === postId);
    if (!post) return;
    if (!confirm("Delete this discussion? This can't be undone.")) return;

    forumPosts = forumPosts.filter((p) => p.id !== postId);
    localStorage.setItem("bloxd_real_forum_posts", JSON.stringify(forumPosts));
    renderForumFeed();
    renderDashboard();

    apiFetch("/api/forum/delete", { method: "POST", body: JSON.stringify({ postId }) }).catch((err) => {
      console.warn("Failed to delete post from server:", err);
      showToast("Deleted locally, but couldn't remove it from the server.", "error");
    });
  }

  function setupForum() {
    const forumFeedEl = document.getElementById("forum-posts-feed");
    if (forumFeedEl && !forumFeedEl.dataset.deleteWired) {
      forumFeedEl.dataset.deleteWired = "1";
      forumFeedEl.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-delete-post]");
        if (!btn) return;
        const card = btn.closest("[data-post-id]");
        if (card) deleteForumPost(card.getAttribute("data-post-id"));
      });
    }

    document.querySelectorAll(".category-tab").forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll(".category-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        forumCategory = tab.getAttribute("data-category") || "all";
        renderForumFeed();
      };
    });

    const fileInput = document.getElementById("new-post-media-file");
    const fileNamePreview = document.getElementById("new-post-media-filename");
    if (fileInput && fileNamePreview) {
      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
          fileNamePreview.textContent = e.target.files[0].name;
        } else {
          fileNamePreview.textContent = "No image attached";
        }
      };
    }

    const submitBtn = document.getElementById("submit-new-post-btn");
    if (submitBtn) {
      submitBtn.onclick = () => {
        if (submitBtn.disabled) return;
        
        const title = document.getElementById("new-post-title")?.value?.trim();
        const category = document.getElementById("new-post-category")?.value || "questions";
        const content = document.getElementById("new-post-content")?.value?.trim();

        if (!title || !content) {
          showToast("Please provide both a title and content.", "error");
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Publishing...`;

        (async () => {
          try {
            let mediaKey = null;
            let mediaUrl = "";
            if (fileInput && fileInput.files && fileInput.files[0]) {
              const uploaded = await uploadFile(fileInput.files[0], "forum");
              mediaKey = uploaded.key;
              mediaUrl = uploaded.url;
            }

            const created = await apiFetch("/api/forum/posts", {
              method: "POST",
              body: JSON.stringify({ title, category, content, mediaKey })
            });

            finalizePost({
              id: String(created.id),
              uid: currentUser?.uid || "",
              author: userProfile?.username || "Anonymous",
              title,
              category,
              content,
              timestamp: Date.now(),
              mediaUrl
            }, submitBtn);
          } catch (err) {
            showToast(err.message || "Couldn't publish - check your connection.", "error");
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Publish Discussion`;
          }
        })();
      };
    }
  }

  function finalizePost(newPost, btn) {
    forumPosts.unshift(newPost);
    localStorage.setItem("bloxd_real_forum_posts", JSON.stringify(forumPosts));

    document.getElementById("new-post-title").value = "";
    document.getElementById("new-post-content").value = "";
    if (document.getElementById("new-post-media-file")) document.getElementById("new-post-media-file").value = "";
    if (document.getElementById("new-post-media-filename")) document.getElementById("new-post-media-filename").textContent = "No image attached";
    document.getElementById("new-post-modal")?.classList.remove("active");
    
    renderForumFeed();
    renderDashboard();

    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Publish Discussion`;
    showToast("Discussion published!", "success");
  }

  let forumUnsub = null;
  async function loadForumPostsFromServer() {
    try {
      const data = await apiFetch("/api/forum/posts");
      if (data && Array.isArray(data.posts)) {
        forumPosts = data.posts.map(p => ({
          id: String(p.id),
          uid: p.author_id,
          author: p.author,
          authorAvatar: p.author_avatar,
          title: p.title,
          category: p.category,
          content: p.content,
          timestamp: p.created_at,
          mediaUrl: p.media_url || "",
          upvotes: p.upvotes || 0
        }));
        localStorage.setItem("bloxd_real_forum_posts", JSON.stringify(forumPosts));
        renderForumFeed();
        renderDashboard();
      }
    } catch (e) {
      console.warn("Forum sync error:", e);
    }
  }

  // Polls every 10s instead of a live Firestore listener - simplest reliable
  // way to keep the feed in sync without adding a websocket/Durable Object layer.
  function subscribeForumPosts() {
    if (forumUnsub) return;
    loadForumPostsFromServer();
    forumUnsub = setInterval(loadForumPostsFromServer, 10000);
  }

  

 
  function initDashboard() {
    document.querySelectorAll("#dashboard-category-bar .category-chip").forEach(chip => {
      chip.onclick = () => {
        document.querySelectorAll("#dashboard-category-bar .category-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        dashboardCategory = chip.getAttribute("data-dash-category") || "all";
        renderDashboardFeed();
        renderDashboardCodesStream();
      };
    });

    renderDashboard();
  }

  function renderDashboard() {
    
    const codes = communityCodes;

    const codesCountEl = document.getElementById("stat-codes-count");
    if (codesCountEl) codesCountEl.textContent = codes.length;

    const devsCountEl = document.getElementById("stat-devs-count");
    if (devsCountEl) devsCountEl.textContent = usersDirectory.length;

    const xpCountEl = document.getElementById("stat-xp-count");
    if (xpCountEl) xpCountEl.textContent = (userProfile?.stats?.xp || 0) + " XP";

    const forumCountEl = document.getElementById("stat-forum-count");
    if (forumCountEl) forumCountEl.textContent = forumPosts.length;

    renderDashboardCodesStream();
    renderDashboardFeed();
    renderDashboardCreators();
    renderDashboardAcademyProgress();
    renderDashboardLibs();
  }

  function renderDashboardCodesStream() {
    const container = document.getElementById("dashboard-codes-stream");
    if (!container) return;

    const allCodes = communityCodes;
    const filtered = dashboardCategory === "all"
      ? allCodes
      : allCodes.filter(c => c.category === dashboardCategory);
    const recent = filtered.slice(0, 4);

    if (recent.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:28px 0;color:var(--text-muted);">
          <i class="fa-solid fa-code" style="font-size:24px;margin-bottom:10px;color:var(--text-dim);display:block;"></i>
          <p style="font-size:13px;margin:0;">No codes here yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = recent.map(c => `
      <div class="code-item-card" style="margin-bottom:14px;">
        ${c.image ? `<div class="code-item-banner"><img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.title)}" style="width:100%;height:100%;object-fit:cover;"></div>` : ""}
        <div class="code-item-content">
          <div class="code-item-meta">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${escapeHtml(c.author)}" style="width:20px;height:20px;border-radius:50%;border:1px solid var(--border-color);">
            <span class="code-item-author">@${escapeHtml(c.author)}</span>
            <span class="nav-badge" style="font-size:10px;">${escapeHtml(c.category || "general").toUpperCase()}</span>
          </div>
          <div class="code-item-title">${escapeHtml(c.title)}</div>
          <div class="code-item-desc">${escapeHtml((c.description || "").substring(0, 90))}${(c.description || "").length > 90 ? "..." : ""}</div>
          <div class="code-item-actions">
            <button class="btn btn-secondary" style="font-size:11px;padding:3px 8px;" onclick="window.viewCodeEntry('${c.id}')">
              <i class="fa-regular fa-eye"></i> View Code
            </button>
          </div>
        </div>
      </div>
    `).join("");
  }

  function renderDashboardFeed() {
    const feed = document.getElementById("dashboard-discussions-feed");
    if (!feed) return;

    const filtered = dashboardCategory === "all" ? forumPosts : forumPosts.filter(p => p.category === dashboardCategory);

    if (filtered.length === 0) {
      feed.innerHTML = `
        <div style="text-align:center;padding:30px;color:var(--text-muted);">
          <p style="font-size:13px;">Nothing here yet.</p>
        </div>
      `;
      return;
    }

    feed.innerHTML = filtered.slice(0, 5).map(p => `
      <div class="forum-post-card" style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${p.author}" style="width:24px;height:24px;border-radius:50%;border:1px solid var(--border-color);">
            <strong style="font-size:13px;color:#fff;">@${escapeHtml(p.author)}</strong>
            <span style="font-size:11px;color:var(--text-dim);">${new Date(p.timestamp).toLocaleDateString()}</span>
          </div>
          <span class="nav-badge" style="font-size:10px;">${(p.category || "GENERAL").toUpperCase()}</span>
        </div>
        <h4 style="font-size:14.5px;color:#fff;margin-bottom:6px;font-weight:600;">${escapeHtml(p.title)}</h4>
        <div style="font-size:12.5px;color:var(--text-muted);line-height:1.5;">${parseCodeInPost(p.content)}</div>
        ${p.mediaUrl ? `<img src="${escapeHtml(p.mediaUrl)}" style="max-width:100%;max-height:220px;border-radius:6px;margin-top:10px;border:1px solid var(--border-color);">` : ""}
      </div>
    `).join("");
  }

  function renderDashboardCreators() {
    const container = document.getElementById("dashboard-creators-list");
    if (!container) return;

    let list = usersDirectory.map(u => ({
      username: u.username,
      xp: u.xp || 0,
      profileViews: u.profile_views || 0,
      bio: u.bio || "Bloxd.io Developer",
      avatar: u.avatar || "",
      avatarZoom: u.avatar_zoom || 1,
      avatarPosX: u.avatar_pos_x ?? 50,
      avatarPosY: u.avatar_pos_y ?? 50
    }));

    list.sort((a, b) => (b.profileViews - a.profileViews) || (b.xp - a.xp));

    if (list.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:20px;color:var(--text-muted);">
          <i class="fa-solid fa-user-slash" style="font-size:22px;margin-bottom:8px;color:var(--text-dim);display:block;"></i>
          <p style="font-size:12.5px;margin:0;">Just you here for now.</p>
        </div>
      `;
      return;
    }

    const ownName = (userProfile?.username || "").toLowerCase();
    const admin = isAdminUser;

    container.innerHTML = list.slice(0, 5).map(c => `
      <div class="dev-creator-mini-card" onclick="window.openDevProfile('${c.username}')" style="cursor:pointer;" title="View ${escapeHtml(c.username)}'s portfolio">
        <div class="creator-avatar-thumb" style="overflow:hidden;display:flex;align-items:center;justify-content:center;background:#111;">
          ${isVideoSource(c.avatar) ?
            `<video src="${escapeHtml(c.avatar)}" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;object-position:${c.avatarPosX}% ${c.avatarPosY}%;transform:scale(${c.avatarZoom});"></video>` :
            `<img src="${escapeHtml(c.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${c.username}`)}" style="width:100%;height:100%;object-fit:cover;object-position:${c.avatarPosX}% ${c.avatarPosY}%;transform:scale(${c.avatarZoom});">`
          }
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
            <strong style="font-size:13px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c.username)}</strong>
            <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
              <span class="nav-badge" style="font-size:10.5px;padding:2px 6px;"><i class="fa-regular fa-eye"></i> ${c.profileViews}</span>
              ${admin && c.username.toLowerCase() !== ownName ? `<button type="button" class="mini-del-btn" onclick="event.stopPropagation();window.deleteDevProfile('${c.username}')" title="Delete ${escapeHtml(c.username)}"><i class="fa-solid fa-trash"></i></button>` : ""}
            </div>
          </div>
          <div style="font-size:11px;color:var(--text-dim);font-family:var(--font-mono);">${c.username}.bloxdcode.com</div>
        </div>
      </div>
    `).join("");
  }

  let publicViewUser = "";
  let publicViewProfile = null;
  let publicViewNotFound = false;
  let bannerDismissed = false;

  function studioReadOnly() {
    return !!publicViewUser;
  }

  async function resolveDevProfile(username) {
    const key = String(username || "").toLowerCase().replace(/[^a-z0-9_\-]/g, "");
    if (!key) return null;
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(key)}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data.user) return null;
      // Server already counted this view (see the [username].js endpoint),
      // so no separate client-side view-counting call is needed here.
      return normalizeProfile(data.user);
    } catch (e) {
      return null;
    }
  }

  window.openDevProfile = async function(username) {
    const dev = await resolveDevProfile(username);
    if (!dev) {
      showToast("Couldn't find that developer.", "error");
      return;
    }

    const key = String(dev.username || "").toLowerCase();
    const ownName = (userProfile?.username || "").toLowerCase();

    const modal = document.getElementById("view-profile-modal");
    if (!modal) return;

    paintBg(document.getElementById("view-profile-bg"), dev.portfolioBg);

    const avatarEl = document.getElementById("view-profile-avatar");
    if (avatarEl) {
      const z = dev.avatarZoom || 1;
      const px = dev.avatarPosX ?? 50;
      const py = dev.avatarPosY ?? 50;
      const st = `width:100%;height:100%;object-fit:cover;object-position:${px}% ${py}%;transform:scale(${z});`;
      const src = dev.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${dev.username}`;
      avatarEl.innerHTML = isVideoSource(src)
        ? `<video src="${escapeHtml(src)}" autoplay loop muted playsinline style="${st}"></video>`
        : `<img src="${escapeHtml(src)}" style="${st}" alt="">`;
    }

    const nameEl = document.getElementById("view-profile-name");
    if (nameEl) nameEl.textContent = dev.username;
    const handleEl = document.getElementById("view-profile-handle");
    if (handleEl) handleEl.textContent = `${dev.username}.bloxdcode.com`;
    const bioEl = document.getElementById("view-profile-bio");
    if (bioEl) bioEl.textContent = dev.bio || "Bloxd.io Developer";

    const socialsEl = document.getElementById("view-profile-socials");
    if (socialsEl) {
      const parts = [];
      if (dev.socials?.discord) parts.push(`<span class="nav-badge"><i class="fa-brands fa-discord"></i> ${escapeHtml(dev.socials.discord)}</span>`);
      if (dev.socials?.github) parts.push(`<span class="nav-badge"><i class="fa-brands fa-github"></i> ${escapeHtml(dev.socials.github)}</span>`);
      socialsEl.innerHTML = parts.join("");
      socialsEl.style.display = parts.length ? "flex" : "none";
    }

    const viewsEl = document.getElementById("view-profile-views");
    if (viewsEl) {
      const n = dev.profileViews || 0;
      viewsEl.innerHTML = `<i class="fa-regular fa-eye"></i> ${n} view${n === 1 ? "" : "s"}`;
    }

    const delBtn = document.getElementById("view-profile-delete");
    if (delBtn) {
      const showDel = isAdminUser && key !== ownName;
      delBtn.style.display = showDel ? "block" : "none";
      delBtn.onclick = () => {
        modal.classList.remove("active");
        window.deleteDevProfile(dev.username);
      };
    }

    modal.classList.add("active");
    renderDashboardCreators();
  };

  window.deleteDevProfile = async function(username) {
    if (!isAdminUser) return;
    const key = String(username || "").toLowerCase().replace(/[^a-z0-9_\-]/g, "");
    if (!key) return;
    if (key === (userProfile?.username || "").toLowerCase()) {
      showToast("You can't delete your own profile.", "error");
      return;
    }
    if (!confirm(`Delete ${key}'s profile and all their posts and codes?`)) return;

    communityCodes = communityCodes.filter(c => String(c.author || "").toLowerCase() !== key);
    localStorage.setItem("bloxd_community_codes", JSON.stringify(communityCodes));

    forumPosts = forumPosts.filter(p => String(p.author || "").toLowerCase() !== key);
    localStorage.setItem("bloxd_real_forum_posts", JSON.stringify(forumPosts));

    usersDirectory = usersDirectory.filter(u => String(u.username || "").toLowerCase() !== key);

    try {
      await apiFetch("/api/admin/delete-user", { method: "POST", body: JSON.stringify({ username: key }) });
    } catch (e) {
      console.warn("Failed to delete user on server:", e);
    }

    renderDashboard();
    renderForumFeed();
    renderCodesGrid(activeCodesCategory);
    showToast(`Deleted ${key}.`, "success");
  };

  function renderDashboardAcademyProgress() {
    const container = document.getElementById("dashboard-academy-progress");
    if (!container) return;

    const totalLessons = ACADEMY_UNITS.reduce((sum, u) => sum + u.lessons.length, 0);
    const completedCount = completedLessons.length;
    const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
    const userXp = userProfile?.stats?.xp || 0;

    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:12.5px;color:var(--text-muted);font-weight:600;">Overall Mastery</span>
        <span style="font-size:12.5px;color:#fff;font-weight:700;">${pct}% (${completedCount}/${totalLessons})</span>
      </div>
      <div style="width:100%;height:6px;background:var(--border-color);border-radius:3px;overflow:hidden;margin-bottom:14px;">
        <div style="width:${pct}%;height:100%;background:#ffffff;border-radius:3px;transition:width 0.3s ease;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="nav-badge" style="background:#ffffff;color:#0f0f0f;font-weight:700;">${userXp} XP</span>
        <button type="button" class="btn btn-primary" onclick="window.navigateTo('academy')" style="font-size:12px;padding:5px 12px;">
          <i class="fa-solid fa-play"></i> Continue Learning
        </button>
      </div>
    `;
  }

  function renderDashboardLibs() {
    const container = document.getElementById("dashboard-libs-list");
    if (!container) return;

    container.innerHTML = DEFAULT_LIBS.slice(0, 3).map(l => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-color);">
        <div>
          <strong style="font-size:12.5px;font-family:var(--font-mono);color:#fff;">${l.name}</strong>
          <div style="font-size:11px;color:var(--text-dim);">${l.desc.substring(0, 45)}...</div>
        </div>
        <button class="btn btn-secondary" style="font-size:11px;padding:3px 8px;" onclick="window.previewLibFile('${l.name}', '${l.url}')">
          <i class="fa-regular fa-eye"></i>
        </button>
      </div>
    `).join("");
  }

  

 
  const ACADEMY_UNITS = [
    {
      title: "Unit 1: JavaScript & 3D Coordinates",
      subtitle: "Vector Mathematics, Arrays, and Player Tags",
      lessons: [
        {
          id: "u1_l1",
          title: "1. 3D Coordinates in Bloxd",
          icon: "fa-cube",
          xp: 25,
          theory: `
            <h3>Coordinates in Bloxd.io</h3>
            <p>Bloxd worlds operate in a 3D coordinate space represented as an array of 3 numbers: <code>[X, Y, Z]</code>.</p>
            <ul>
              <li><strong>X</strong>: East / West position</li>
              <li><strong>Y</strong>: Height (Up / Down)</li>
              <li><strong>Z</strong>: North / South position</li>
            </ul>
            <p><strong>Your Task:</strong> Create a variable named <code>spawnLocation</code> assigned to the coordinate array <code>[10, 64, -20]</code>.</p>
          `,
          initialCode: "// Create spawnLocation below:\n",
          hint: "let spawnLocation = [10, 64, -20];",
          runTest: (code) => {
            if (!code.includes("spawnLocation")) return { pass: false, error: "Variable 'spawnLocation' was not found in code." };
            try {
              const res = new Function(code + "\nreturn spawnLocation;")();
              if (Array.isArray(res) && res[0] === 10 && res[1] === 64 && res[2] === -20) {
                return { pass: true };
              }
              return { pass: false, error: `Expected [10, 64, -20], but got ${JSON.stringify(res)}` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        },
        {
          id: "u1_l2",
          title: "2. Vector Distance Calculation",
          icon: "fa-ruler-combined",
          xp: 35,
          theory: `
            <h3>3D Euclidean Distance</h3>
            <p>To detect proximity between a player and an objective, we calculate the Euclidean distance across 3D coordinates:</p>
            <pre><code>Math.hypot(p2[0]-p1[0], p2[1]-p1[1], p2[2]-p1[2])</code></pre>
            <p><strong>Your Task:</strong> Write a function <code>getDistance(posA, posB)</code> that takes two coordinate arrays and returns the Euclidean distance between them.</p>
          `,
          initialCode: "function getDistance(posA, posB) {\n  // return distance\n}\n",
          hint: "return Math.hypot(posB[0] - posA[0], posB[1] - posA[1], posB[2] - posA[2]);",
          runTest: (code) => {
            try {
              const fn = new Function(code + "\nreturn getDistance([0, 0, 0], [3, 0, 4]);")();
              if (fn === 5) return { pass: true };
              return { pass: false, error: `Expected distance 5 for [0,0,0] to [3,0,4], got ${fn}` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        },
        {
          id: "u1_l3",
          title: "3. Player Rank Tag Formatting",
          icon: "fa-tag",
          xp: 30,
          theory: `
            <h3>Player Display Formatting</h3>
            <p>Bloxd allows formatting chat usernames with prefix ranks.</p>
            <p><strong>Your Task:</strong> Write a function <code>formatRank(name, rank)</code> that returns <code>'[' + rank.toUpperCase() + '] ' + name</code>.</p>
          `,
          initialCode: "function formatRank(name, rank) {\n  // return formatted tag\n}\n",
          hint: "return '[' + rank.toUpperCase() + '] ' + name;",
          runTest: (code) => {
            try {
              const fn = new Function(code + "\nreturn formatRank('Axel', 'vip');")();
              if (fn === "[VIP] Axel") return { pass: true };
              return { pass: false, error: `Expected '[VIP] Axel', got '${fn}'` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        }
      ]
    },
    {
      title: "Unit 2: ES Module Imports & Library Architecture",
      subtitle: "Loading Official Modules Without File Extensions",
      lessons: [
        {
          id: "u2_l1",
          title: "1. Importing MathLib",
          icon: "fa-file-import",
          xp: 40,
          theory: `
            <h3>Importing Bloxd Libraries</h3>
            <p>Bloxd scripts use standard ES Module imports <strong>without the .js file extension</strong>.</p>
            <pre><code>import { MathLib } from "./MathLib"</code></pre>
            <p><em>Important: Never use setTimeout or setInterval in Bloxd scripts!</em></p>
            <p><strong>Your Task:</strong> Write an import statement to import <code>MathLib</code> from <code>./MathLib</code>.</p>
          `,
          initialCode: "// Write your import statement below:\n",
          hint: 'import { MathLib } from "./MathLib"',
          runTest: (code) => {
            const clean = code.replace(/\s+/g, " ").trim();
            if (clean.includes(".js")) return { pass: false, error: "Do NOT include '.js' in Bloxd import paths!" };
            if (/import\s*\{\s*MathLib\s*\}\s*from\s*["']\.\/MathLib["']/i.test(clean) ||
                /import\s+MathLib\s+from\s*["']\.\/MathLib["']/i.test(clean)) {
              return { pass: true };
            }
            return { pass: false, error: 'Expected: import { MathLib } from "./MathLib"' };
          }
        },
        {
          id: "u2_l2",
          title: "2. Multi-Module Destructuring",
          icon: "fa-cubes",
          xp: 45,
          theory: `
            <h3>Destructured Module Imports</h3>
            <p>You can destructure multiple utilities from a shared module bundle:</p>
            <pre><code>import { KVStore, Pathfinder } from "./BloxdLibs"</code></pre>
            <p><strong>Your Task:</strong> Write an import statement to import both <code>KVStore</code> and <code>Pathfinder</code> from <code>./BloxdLibs</code>.</p>
          `,
          initialCode: "// Import KVStore and Pathfinder below:\n",
          hint: 'import { KVStore, Pathfinder } from "./BloxdLibs"',
          runTest: (code) => {
            const clean = code.replace(/\s+/g, " ").trim();
            if (clean.includes(".js")) return { pass: false, error: "Do NOT include '.js' in import path!" };
            if (/import\s*\{[^}]*KVStore[^}]*Pathfinder[^}]*\}\s*from\s*["']\.\/BloxdLibs["']/i.test(clean) ||
                /import\s*\{[^}]*Pathfinder[^}]*KVStore[^}]*\}\s*from\s*["']\.\/BloxdLibs["']/i.test(clean)) {
              return { pass: true };
            }
            return { pass: false, error: 'Expected: import { KVStore, Pathfinder } from "./BloxdLibs"' };
          }
        }
      ]
    },
    {
      title: "Unit 3: Bloxd Core Scripting API",
      subtitle: "In-Game Messages, Position Querying & Block Placement",
      lessons: [
        {
          id: "u3_l1",
          title: "1. Broadcasting Messages",
          icon: "fa-bullhorn",
          xp: 40,
          theory: `
            <h3>The Global api Object</h3>
            <p>Bloxd exposes the global <code>api</code> object for world interactions. To send a server announcement, call <code>api.broadcastMessage(message, color)</code>.</p>
            <p><strong>Your Task:</strong> Write a function <code>announceWinner(playerName)</code> that calls <code>api.broadcastMessage(playerName + ' won the match!', '#ffffff')</code>.</p>
          `,
          initialCode: "function announceWinner(playerName) {\n  // Broadcast winner announcement\n}\n",
          hint: "api.broadcastMessage(playerName + ' won the match!', '#ffffff');",
          runTest: (code) => {
            let calledWith = null;
            const mockApi = {
              broadcastMessage: (msg, col) => { calledWith = { msg, col }; }
            };
            try {
              new Function("api", code + "\nannounceWinner('Axel');")(mockApi);
              if (calledWith && calledWith.msg === "Axel won the match!" && calledWith.col === "#ffffff") {
                return { pass: true };
              }
              return { pass: false, error: `Expected api.broadcastMessage('Axel won the match!', '#ffffff')` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        },
        {
          id: "u3_l2",
          title: "2. Setting Voxel Blocks",
          icon: "fa-cubes-stacked",
          xp: 45,
          theory: `
            <h3>api.setBlock(x, y, z, blockType)</h3>
            <p>You can modify blocks in the world with <code>api.setBlock</code>.</p>
            <p><strong>Your Task:</strong> Write a function <code>spawnPlatform(x, y, z, blockType)</code> that places a 3x3 platform centered at <code>(x, y, z)</code> by calling <code>api.setBlock(px, y, pz, blockType)</code> for <code>px</code> from <code>x-1</code> to <code>x+1</code> and <code>pz</code> from <code>z-1</code> to <code>z+1</code>.</p>
          `,
          initialCode: "function spawnPlatform(x, y, z, blockType) {\n  // Place 3x3 platform\n}\n",
          hint: "for (let dx = -1; dx <= 1; dx++) { for (let dz = -1; dz <= 1; dz++) { api.setBlock(x + dx, y, z + dz, blockType); } }",
          runTest: (code) => {
            const blocks = [];
            const mockApi = {
              setBlock: (bx, by, bz, type) => { blocks.push({ bx, by, bz, type }); }
            };
            try {
              new Function("api", code + "\nspawnPlatform(0, 64, 0, 'Stone');")(mockApi);
              if (blocks.length === 9) return { pass: true };
              return { pass: false, error: `Expected 9 blocks placed for 3x3 platform, placed ${blocks.length}` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        }
      ]
    },
    {
      title: "Unit 4: The tick() Game Loop & Physics",
      subtitle: "Real-Time Game Cycles (Strictly No Timers)",
      lessons: [
        {
          id: "u4_l1",
          title: "1. Global tick() Game Loop",
          icon: "fa-rotate",
          xp: 50,
          theory: `
            <h3>The Global tick() Loop</h3>
            <p>Because Bloxd <strong>strictly forbids setTimeout and setInterval</strong>, all timed game logic executes inside the global <code>tick()</code> function, which runs every server tick.</p>
            <p><strong>Your Task:</strong> Declare a variable <code>currentTick = 0</code> and a function <code>tick()</code> that adds 1 to <code>currentTick</code> each tick.</p>
          `,
          initialCode: "let currentTick = 0;\n\nfunction tick() {\n  // increment currentTick\n}\n",
          hint: "function tick() { currentTick++; }",
          runTest: (code) => {
            if (code.includes("setTimeout") || code.includes("setInterval")) {
              return { pass: false, error: "Bloxd forbids setTimeout and setInterval! Use tick()." };
            }
            try {
              const res = new Function(code + "\ntick(); tick(); tick(); return currentTick;")();
              if (res === 3) return { pass: true };
              return { pass: false, error: `Expected currentTick = 3 after 3 ticks, got ${res}` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        },
        {
          id: "u4_l2",
          title: "2. Velocity & Gravity Simulation",
          icon: "fa-arrow-down-long",
          xp: 55,
          theory: `
            <h3>Simulating Physics inside tick()</h3>
            <p>Each tick, gravity decreases vertical velocity: <code>velocityY -= gravity</code>, and the height updates: <code>posY += velocityY</code>.</p>
            <p><strong>Your Task:</strong> Create a function <code>simulateFall(startY, startVelocity, gravity, ticks)</code> that simulates falling across the specified number of ticks and returns the final <code>posY</code>.</p>
          `,
          initialCode: "function simulateFall(startY, startVelocity, gravity, ticks) {\n  let y = startY;\n  let vy = startVelocity;\n  // Simulate loop\n  return y;\n}\n",
          hint: "for (let i = 0; i < ticks; i++) { vy -= gravity; y += vy; } return y;",
          runTest: (code) => {
            try {
              const res = new Function(code + "\nreturn simulateFall(100, 0, 9.8, 2);")();
              
              
              if (Math.abs(res - 70.6) < 0.001) return { pass: true };
              return { pass: false, error: `Expected 70.6, got ${res}` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        }
      ]
    },
    {
      title: "Unit 5: Data Persistence with KVStore",
      subtitle: "Saving & Loading Stats Across Player Sessions",
      lessons: [
        {
          id: "u5_l1",
          title: "1. Storing Player Stats",
          icon: "fa-database",
          xp: 50,
          theory: `
            <h3>KVStore Data Persistence</h3>
            <p>The <code>KVStore</code> library provides persistent key-value storage for player coins, levels, and inventory.</p>
            <pre><code>KVStore.set(playerId, key, value)</code></pre>
            <p><strong>Your Task:</strong> Write a function <code>giveCoins(playerId, amount)</code> that retrieves the player's current coins using <code>KVStore.get(playerId, "coins", 0)</code>, adds <code>amount</code>, and saves it with <code>KVStore.set(playerId, "coins", newAmount)</code>.</p>
          `,
          initialCode: "function giveCoins(playerId, amount) {\n  // Load, add, and save\n}\n",
          hint: "const current = KVStore.get(playerId, 'coins', 0); KVStore.set(playerId, 'coins', current + amount);",
          runTest: (code) => {
            const memory = {};
            const mockKV = {
              get: (id, k, def) => (memory[id] && memory[id][k] !== undefined ? memory[id][k] : def),
              set: (id, k, val) => {
                if (!memory[id]) memory[id] = {};
                memory[id][k] = val;
              }
            };
            try {
              new Function("KVStore", code + "\ngiveCoins('p1', 50); giveCoins('p1', 25);")(mockKV);
              if (mockKV.get('p1', 'coins', 0) === 75) return { pass: true };
              return { pass: false, error: `Expected 75 coins stored, got ${mockKV.get('p1', 'coins', 0)}` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        }
      ]
    },
    {
      title: "Unit 6: Procedural WorldGen & RoomGen",
      subtitle: "Voxel Heightmaps and Structure Placement",
      lessons: [
        {
          id: "u6_l1",
          title: "1. 2D Heightmap Generation",
          icon: "fa-mountain-sun",
          xp: 60,
          theory: `
            <h3>Generating Terrain with Math</h3>
            <p>Procedural terrain determines surface height using mathematical trigonometric waves.</p>
            <p><strong>Your Task:</strong> Write a function <code>getTerrainHeight(x, z, baseHeight, amplitude)</code> that returns <code>Math.floor(baseHeight + Math.sin(x * 0.1) * amplitude + Math.cos(z * 0.1) * amplitude)</code>.</p>
          `,
          initialCode: "function getTerrainHeight(x, z, baseHeight, amplitude) {\n  // return calculated height\n}\n",
          hint: "return Math.floor(baseHeight + Math.sin(x * 0.1) * amplitude + Math.cos(z * 0.1) * amplitude);",
          runTest: (code) => {
            try {
              const res = new Function(code + "\nreturn getTerrainHeight(0, 0, 64, 10);")();
              
              if (res === 74) return { pass: true };
              return { pass: false, error: `Expected height 74, got ${res}` };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        }
      ]
    },
    {
      title: "Unit 7: Mob AI & Pathfinder Integration",
      subtitle: "A* Pathfinding and Autonomous Entity Navigation",
      lessons: [
        {
          id: "u7_l1",
          title: "1. Mob Path Following in tick()",
          icon: "fa-route",
          xp: 65,
          theory: `
            <h3>Autonomous Mob AI</h3>
            <p>Mobs follow a list of waypoints step-by-step each tick cycle.</p>
            <p><strong>Your Task:</strong> Write a class <code>MobNavigator</code> with a constructor that takes <code>waypoints</code> array, and a method <code>nextStep()</code> that removes and returns the first waypoint (using <code>shift()</code>) or returns <code>null</code> if waypoints is empty.</p>
          `,
          initialCode: "class MobNavigator {\n  constructor(waypoints) {\n    this.waypoints = [...waypoints];\n  }\n  nextStep() {\n    // return next waypoint or null\n  }\n}\n",
          hint: "return this.waypoints.length > 0 ? this.waypoints.shift() : null;",
          runTest: (code) => {
            try {
              const runner = new Function(code + "\nconst m = new MobNavigator([[0,0,0], [1,0,0]]); const s1 = m.nextStep(); const s2 = m.nextStep(); const s3 = m.nextStep(); return { s1, s2, s3 };")();
              if (runner.s1 && runner.s1[0] === 0 && runner.s2 && runner.s2[0] === 1 && runner.s3 === null) {
                return { pass: true };
              }
              return { pass: false, error: "nextStep() did not return sequential waypoints and null when done." };
            } catch (err) {
              return { pass: false, error: err.message };
            }
          }
        }
      ]
    }
  ];

  let completedLessons = JSON.parse(localStorage.getItem("bloxd_completed_lessons") || "[]");
  let currentActiveLesson = null;

  function initAcademy() {
    renderAcademyRoadmap();
    setupCoddyWorkspace();
  }

  function renderAcademyRoadmap() {
    const container = document.getElementById("academy-path");
    if (!container) return;

    container.innerHTML = ACADEMY_UNITS.map(unit => {
      const lessonNodes = unit.lessons.map((lesson, idx) => {
        const isDone = completedLessons.includes(lesson.id);
        const isUnlocked = isDone || idx === 0 || completedLessons.includes(unit.lessons[idx - 1]?.id);
        const nodeClass = isDone ? "completed" : (isUnlocked ? "active" : "locked");

        return `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div class="coddy-node ${nodeClass}" onclick="window.openCoddyLesson('${lesson.id}')">
              <i class="fa-solid ${lesson.icon}"></i>
              ${isDone ? '<span class="node-done-tick"><i class="fa-solid fa-check"></i></span>' : ''}
            </div>
            <span style="font-size:12px;font-weight:600;color:var(--text-main);margin-top:6px;">${escapeHtml(lesson.title)}</span>
          </div>
        `;
      }).join("");

      return `
        <div class="roadmap-unit">
          <div class="unit-header-bar">
            <div>
              <div class="unit-title-text">${escapeHtml(unit.title)}</div>
              <div style="font-size:12px;color:var(--text-muted);">${escapeHtml(unit.subtitle)}</div>
            </div>
            <i class="fa-solid fa-graduation-cap" style="color:var(--text-dim);font-size:18px;"></i>
          </div>
          <div class="unit-lessons-grid">
            ${lessonNodes}
          </div>
        </div>
      `;
    }).join("");

    const xp = document.getElementById("academy-xp-count");
    if (xp) xp.textContent = `${(userProfile?.stats?.xp || 0)} XP`;
  }

  window.openCoddyLesson = function(id) {
    let target = null;
    for (const u of ACADEMY_UNITS) {
      for (const l of u.lessons) {
        if (l.id === id) { target = l; break; }
      }
    }
    if (!target) return;
    currentActiveLesson = target;

    const modal = document.getElementById("coddy-challenge-modal");
    const theory = document.getElementById("coddy-theory-content");
    const editor = document.getElementById("coddy-code-editor");
    const consoleOut = document.getElementById("coddy-console-output");

    if (theory) theory.innerHTML = target.theory;
    if (editor) editor.value = target.initialCode;
    if (consoleOut) consoleOut.innerHTML = `<span style="color:var(--text-dim);">// Console and test output will appear here</span>`;

    modal?.classList.add("active");
  };

  function setupCoddyWorkspace() {
    const runBtn = document.getElementById("coddy-run-btn");
    const hintBtn = document.getElementById("coddy-hint-btn");
    const consoleOut = document.getElementById("coddy-console-output");

    if (runBtn) {
      runBtn.onclick = () => {
        if (!currentActiveLesson) return;
        const code = document.getElementById("coddy-code-editor")?.value || "";

        consoleOut.innerHTML = `<span style="color:#ffffff;">Running tests...</span>\n`;

        const result = currentActiveLesson.runTest(code);

        if (result.pass) {
          consoleOut.innerHTML += `<span style="color:#ffffff;font-weight:bold;">Passed.</span> +${currentActiveLesson.xp} XP.\n`;
          
          if (!completedLessons.includes(currentActiveLesson.id)) {
            completedLessons.push(currentActiveLesson.id);
            localStorage.setItem("bloxd_completed_lessons", JSON.stringify(completedLessons));
            const newXp = (userProfile?.stats?.xp || 0) + currentActiveLesson.xp;
            saveUserProfileData({ stats: { ...userProfile?.stats, xp: newXp } });
          }

          renderAcademyRoadmap();
          renderDashboard();
          showToast(`Lesson Completed! +${currentActiveLesson.xp} XP`, "success");
        } else {
          consoleOut.innerHTML += `<span style="color:#ff4444;font-weight:bold;">Failed:</span> ${escapeHtml(result.error)}\n`;
        }
      };
    }

    if (hintBtn) {
      hintBtn.onclick = () => {
        if (currentActiveLesson && currentActiveLesson.hint) {
          showToast(`Hint: ${currentActiveLesson.hint}`, "info");
        }
      };
    }
  }

  

 
  const DEFAULT_LIBS = [
    { name: "KVStore.js", desc: "Key-Value Store data persistence for player stats, inventory and world variables.", url: "https://raw.githubusercontent.com/imrenori/Bloxd-Libs/main/KVStore.js" },
    { name: "MathLibGeometry.js", desc: "3D Geometric calculations, distance checking, bounding boxes and raycasting.", url: "https://raw.githubusercontent.com/imrenori/Bloxd-Libs/main/MathLibGeometry.js" },
    { name: "MathLibLinear.js", desc: "Vector interpolation, dot products, normalization and lerping algorithms.", url: "https://raw.githubusercontent.com/imrenori/Bloxd-Libs/main/MathLibLinear.js" },
    { name: "WorldGen.js", desc: "Procedural voxel terrain generation with perlin noise, caves, and ores.", url: "https://raw.githubusercontent.com/imrenori/Bloxd-Libs/main/WorldGen.js" },
    { name: "Pathfinder.js", desc: "A* Pathfinding for mobs, NPCs and custom entities across voxel blocks.", url: "https://raw.githubusercontent.com/imrenori/Bloxd-Libs/main/Pathfinder.js" },
    { name: "Scheduler.js", desc: "Delayed, repeating and conditional task management tied to tick().", url: "https://raw.githubusercontent.com/imrenori/Bloxd-Libs/main/Scheduler.js" },
    { name: "RoomGen.js", desc: "Procedural room, dungeon, and structure placement generator.", url: "https://raw.githubusercontent.com/imrenori/Bloxd-Libs/main/RoomGen.js" }
  ];

  function initLibs() {
    const grid = document.getElementById("libs-grid-container");
    if (!grid) return;

    grid.innerHTML = DEFAULT_LIBS.map(l => `
      <div class="clean-box" style="margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between;">
        <div class="clean-box-body" style="padding:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <strong style="color:#ffffff;font-family:var(--font-mono);">${escapeHtml(l.name)}</strong>
            <span class="nav-badge">ES MODULE</span>
          </div>
          <p style="font-size:12.5px;color:var(--text-muted);line-height:1.5;">${escapeHtml(l.desc)}</p>
        </div>
        <div style="padding:10px 16px;background:var(--bg-surface);border-top:1px solid var(--border-color);display:flex;gap:8px;">
          <button class="btn btn-secondary" style="flex:1;font-size:12px;" onclick="window.previewLibFile('${l.name}', '${l.url}')">
            <i class="fa-regular fa-eye"></i> Preview
          </button>
          <button class="btn btn-primary" style="flex:1;font-size:12px;" onclick="window.open('${l.url}', '_blank')">
            <i class="fa-solid fa-download"></i> Download
          </button>
        </div>
      </div>
    `).join("");

    fetch("https://api.github.com/repos/imrenori/Bloxd-Libs/contents")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const js = data.filter(d => d.name && d.name.endsWith(".js"));
          if (js.length > 0) {
            grid.innerHTML = js.map(f => {
              const match = DEFAULT_LIBS.find(b => b.name === f.name);
              const desc = match ? match.desc : `Bloxd.io library module (${f.name})`;
              const dl = f.download_url || `https://raw.githubusercontent.com/imrenori/Bloxd-Libs/main/${f.name}`;
              return `
                <div class="clean-box" style="margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between;">
                  <div class="clean-box-body" style="padding:16px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                      <strong style="color:#ffffff;font-family:var(--font-mono);">${escapeHtml(f.name)}</strong>
                      <span class="nav-badge">ES MODULE</span>
                    </div>
                    <p style="font-size:12.5px;color:var(--text-muted);line-height:1.5;">${escapeHtml(desc)}</p>
                  </div>
                  <div style="padding:10px 16px;background:var(--bg-surface);border-top:1px solid var(--border-color);display:flex;gap:8px;">
                    <button class="btn btn-secondary" style="flex:1;font-size:12px;" onclick="window.previewLibFile('${f.name}', '${dl}')">
                      <i class="fa-regular fa-eye"></i> Preview
                    </button>
                    <button class="btn btn-primary" style="flex:1;font-size:12px;" onclick="window.open('${dl}', '_blank')">
                      <i class="fa-solid fa-download"></i> Download
                    </button>
                  </div>
                </div>
              `;
            }).join("");
          }
        }
      }).catch(() => {});
  }

  window.previewLibFile = function(name, url) {
    const modal = document.getElementById("preview-code-modal");
    const title = document.getElementById("preview-code-title");
    const body = document.getElementById("preview-code-body");
    if (!modal || !title || !body) return;

    title.textContent = name;
    body.textContent = "Loading file content...";
    modal.classList.add("active");

    fetch(url)
      .then(r => r.text())
      .then(code => {
        let highlighted = escapeHtml(code);
        if (window.hljs) {
          try { highlighted = window.hljs.highlight(code, { language: "javascript" }).value; } catch(e) {}
        }
        body.innerHTML = highlighted;
      })
      .catch(() => {
        body.textContent = "Error loading code preview.";
      });
  };

  

 
  let activeCodesCategory = "all";

  function initCodes() {
    subscribeCommunityCodes();
    document.querySelectorAll("#codes-category-bar .category-chip").forEach(chip => {
      chip.onclick = () => {
        document.querySelectorAll("#codes-category-bar .category-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        activeCodesCategory = chip.getAttribute("data-codes-category") || "all";
        renderCodesGrid(activeCodesCategory);
      };
    });

    setupUploadCodeModal();
    renderCodesGrid("all");
  }

  function renderCodesGrid(category) {
    const container = document.getElementById("codes-grid-container");
    if (!container) return;

    const allCodes = communityCodes;
    const filtered = category === "all" ? allCodes : allCodes.filter(c => c.category === category);

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);">
          <i class="fa-solid fa-code" style="font-size:36px;margin-bottom:16px;color:var(--text-dim);display:block;"></i>
          <h3 style="font-size:16px;color:#fff;margin-bottom:6px;">No codes in this category yet</h3>
          <p style="font-size:13px;margin-bottom:16px;">Upload your Bloxd script to be the first!</p>
          <button class="btn btn-primary" onclick="document.getElementById('upload-code-modal').classList.add('active')">
            <i class="fa-solid fa-cloud-arrow-up"></i> Upload Code
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(c => {
      const canDelete = (currentUser && c.uid && c.uid === currentUser.uid) || isAdminUser;
      return `
      <div class="code-item-card">
        ${c.image ? `<div class="code-item-banner"><img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.title)}" style="width:100%;height:100%;object-fit:cover;border-radius:6px 6px 0 0;"></div>` : ""}
        <div class="code-item-content">
          <div class="code-item-meta">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${escapeHtml(c.author)}" style="width:22px;height:22px;border-radius:50%;border:1px solid var(--border-color);">
            <span class="code-item-author">@${escapeHtml(c.author)}</span>
            <span class="nav-badge" style="font-size:10px;margin-left:auto;">${escapeHtml((c.category || "general").toUpperCase())}</span>
          </div>
          <div class="code-item-title">${escapeHtml(c.title)}</div>
          <div class="code-item-desc">${escapeHtml((c.description || "").substring(0, 110))}${(c.description || "").length > 110 ? "..." : ""}</div>
          <div class="code-item-actions">
            <button class="btn btn-secondary" style="font-size:12px;padding:4px 10px;" onclick="window.viewCodeEntry('${c.id}')">
              <i class="fa-regular fa-eye"></i> View Code
            </button>
            <button class="btn btn-primary" style="font-size:12px;padding:4px 10px;" onclick="window.copyCodeEntry('${c.id}')">
              <i class="fa-regular fa-copy"></i> Copy
            </button>
            ${canDelete ? `<button class="btn btn-secondary" style="font-size:12px;padding:4px 10px;color:#ff8888;" onclick="window.deleteCodeEntry('${c.id}')"><i class="fa-solid fa-trash"></i></button>` : ""}
          </div>
        </div>
      </div>
    `;
    }).join("");
  }

  window.deleteCodeEntry = function(id) {
    const entry = communityCodes.find((c) => c.id === id);
    if (!entry) return;
    if (!confirm("Delete this code? This can't be undone.")) return;

    communityCodes = communityCodes.filter((c) => c.id !== id);
    localStorage.setItem("bloxd_community_codes", JSON.stringify(communityCodes));
    renderCodesGrid(activeCodesCategory);
    renderDashboard();

    apiFetch("/api/codes/delete", { method: "POST", body: JSON.stringify({ codeId: id }) }).catch((err) => {
      console.warn("Failed to delete code from server:", err);
      showToast("Deleted locally, but couldn't remove it from the server.", "error");
    });
  };

  let codesUnsub = null;
  async function loadCommunityCodesFromServer() {
    try {
      const data = await apiFetch("/api/codes/list");
      if (data && Array.isArray(data.codes)) {
        communityCodes = data.codes.map(c => ({
          id: String(c.id),
          uid: c.author_id,
          author: c.author,
          title: c.title,
          description: c.description,
          category: c.category,
          code: c.code,
          image: c.image_url || "",
          timestamp: c.created_at
        }));
        localStorage.setItem("bloxd_community_codes", JSON.stringify(communityCodes));
        renderCodesGrid(activeCodesCategory);
        renderDashboard();
      }
    } catch (e) {
      console.warn("Codes sync error:", e);
    }
  }

  function subscribeCommunityCodes() {
    if (codesUnsub) return;
    loadCommunityCodesFromServer();
    codesUnsub = setInterval(loadCommunityCodesFromServer, 10000);
  }

  function setupUploadCodeModal() {
    const modal = document.getElementById("upload-code-modal");
    const closeBtn = document.getElementById("upload-code-modal-close");
    const submitBtn = document.getElementById("submit-upload-code-btn");
    const imageFile = document.getElementById("upload-code-image-file");
    const imageFilename = document.getElementById("upload-code-image-filename");

    if (closeBtn) {
      closeBtn.onclick = () => modal?.classList.remove("active");
    }

    if (imageFile && imageFilename) {
      imageFile.onchange = (e) => {
        const file = e.target.files[0];
        if (file) imageFilename.textContent = file.name;
        else imageFilename.textContent = "No image selected";
      };
    }

    if (submitBtn) {
      submitBtn.onclick = () => {
        if (submitBtn.disabled) return;

        const title = document.getElementById("upload-code-title")?.value?.trim();
        const description = document.getElementById("upload-code-description")?.value?.trim();
        const category = document.getElementById("upload-code-category")?.value || "general";
        const code = document.getElementById("upload-code-textarea")?.value?.trim();

        if (!title) { showToast("Please enter a title.", "error"); return; }
        if (!description) { showToast("Please enter a description.", "error"); return; }
        if (!code) { showToast("Please paste your code.", "error"); return; }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;

        const imgInput = document.getElementById("upload-code-image-file");

        (async () => {
          try {
            let imageKey = null;
            let imageUrl = "";
            if (imgInput && imgInput.files && imgInput.files[0]) {
              const uploaded = await uploadFile(imgInput.files[0], "codes");
              imageKey = uploaded.key;
              imageUrl = uploaded.url;
            }

            const created = await apiFetch("/api/codes/list", {
              method: "POST",
              body: JSON.stringify({ title, description, category, code, imageKey })
            });

            finalizeCodeUpload({
              id: String(created.id),
              uid: currentUser?.uid || "",
              author: userProfile?.username || "Anonymous",
              title,
              description,
              category,
              code,
              image: imageUrl,
              timestamp: Date.now()
            }, submitBtn, modal);
          } catch (err) {
            showToast(err.message || "Couldn't upload - check your connection.", "error");
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Upload Code`;
          }
        })();
      };
    }
  }

  function finalizeCodeUpload(entry, btn, modal) {
    const allCodes = communityCodes;
    allCodes.unshift(entry);
    localStorage.setItem("bloxd_community_codes", JSON.stringify(allCodes));

    
    ["upload-code-title","upload-code-description","upload-code-textarea"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    const imgInput = document.getElementById("upload-code-image-file");
    if (imgInput) imgInput.value = "";
    const imgFilename = document.getElementById("upload-code-image-filename");
    if (imgFilename) imgFilename.textContent = "No image selected";

    modal?.classList.remove("active");
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Upload Code`;

    renderCodesGrid(activeCodesCategory);
    renderDashboard();
    showToast(`"${entry.title}" uploaded!`, "success");
  }

  window.viewCodeEntry = function(id) {
    const allCodes = communityCodes;
    const entry = allCodes.find(c => c.id === id);
    if (!entry) return;

    const modal = document.getElementById("preview-code-modal");
    const title = document.getElementById("preview-code-title");
    const body = document.getElementById("preview-code-body");
    if (!modal || !title || !body) return;

    title.textContent = entry.title + " - @" + entry.author;
    let highlighted = escapeHtml(entry.code);
    if (window.hljs) {
      try { highlighted = window.hljs.highlight(entry.code, { language: "javascript" }).value; } catch(e) {}
    }
    body.innerHTML = highlighted;
    modal.classList.add("active");
  };

  window.copyCodeEntry = function(id) {
    const allCodes = communityCodes;
    const entry = allCodes.find(c => c.id === id);
    if (!entry) return;
    navigator.clipboard.writeText(entry.code).then(() => {
      showToast("Code copied to clipboard!", "success");
    });
  };

  

 
  function navigateTo(view) {
    document.querySelectorAll(".nav-item").forEach(item => {
      if (item.getAttribute("data-view") === view) item.classList.add("active");
      else item.classList.remove("active");
    });

    document.querySelectorAll(".view-panel").forEach(panel => {
      if (panel.id === `view-${view}`) panel.classList.add("active");
      else panel.classList.remove("active");
    });

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

        try {
          await apiFetch("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password: pass })
          });
          await checkAuthGate();
          document.getElementById("auth-gate-screen")?.classList.add("hidden");
          showToast(`Welcome back, ${username}!`, "success");
        } catch (err) {
          showToast(err.message || "Incorrect username or password.", "error");
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

        try {
          await apiFetch("/api/auth/signup", {
            method: "POST",
            body: JSON.stringify({ username: val.username, password: pass })
          });
          await checkAuthGate();
          document.getElementById("auth-gate-screen")?.classList.add("hidden");
          showToast(`Account created for @${val.username}!`, "success");
        } catch (err) {
          showToast(err.message || "Couldn't create account.", "error");
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

    // Edge-swipe to open, swipe-away to close - works on every view since it's
    // bound at the document level, not per-page.
    (function setupSidebarSwipe() {
      const EDGE_ZONE = 24;
      const OPEN_THRESHOLD = 60;
      const CLOSE_THRESHOLD = 60;
      let startX = 0, startY = 0, tracking = false, mode = null;

      document.addEventListener("touchstart", (e) => {
        if (window.innerWidth > 900) return;
        const sidebar = document.querySelector(".sidebar");
        const isOpen = sidebar && sidebar.classList.contains("open");
        const t = e.touches[0];
        startX = t.clientX;
        startY = t.clientY;
        if (!isOpen && startX <= EDGE_ZONE) {
          tracking = true;
          mode = "open";
        } else if (isOpen) {
          tracking = true;
          mode = "close";
        } else {
          tracking = false;
          mode = null;
        }
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
        if (mode === "open" && dx > OPEN_THRESHOLD) {
          document.querySelector(".sidebar")?.classList.add("open");
          document.getElementById("sidebar-backdrop")?.classList.add("open");
          tracking = false;
        } else if (mode === "close" && dx < -CLOSE_THRESHOLD) {
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

    // Off by default for everyone, including you - only shows once the
    // user checks "Enable debug capture tool" in their own profile settings
    // (Settings > tucked below Reset card position), and that preference is
    // saved to their Firestore profile, so it follows them across reloads
    // and devices instead of resetting per-browser.
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

})();
