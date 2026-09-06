'use strict';

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
