'use strict';

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
