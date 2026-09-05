(function() {
  'use strict';

  

 
  const firebaseConfig = {
    apiKey: "AIzaSyCDl2nf8u7vq7JwhcZcIUSK6fa_SjSACP0",
    authDomain: "bloxdcode.firebaseapp.com",
    projectId: "bloxdcode",
    storageBucket: "bloxdcode.firebasestorage.app",
    messagingSenderId: "888731101557",
    appId: "1:888731101557:web:a76440941389ed1885cb3c",
    measurementId: "G-QJ6691YJRQ"
  };

  let auth = null;
  let db = null;
  let firestoreOnline = false;
  let currentUser = null;
  let userProfile = null;

  // Claude Security Patch: admin status now comes from a Firebase custom claim on the user's
  // real ID token (set server-side via the Admin SDK), not a hardcoded UID list. Nothing in this
  // file identifies who the admin is anymore - that lives entirely in Firebase Auth.
  let isAdminUser = false;

  async function refreshAdminStatus() {
    isAdminUser = false;
    if (currentUser && typeof currentUser.getIdTokenResult === "function") {
      try {
        const token = await currentUser.getIdTokenResult(true);
        isAdminUser = !!(token.claims && token.claims.admin === true);
      } catch (e) {}
    }
  }

  function dedupeRegistry() {
    const registry = JSON.parse(localStorage.getItem("bloxd_users_db") || "{}");
    const byUid = {};
    Object.keys(registry).forEach(k => {
      const u = registry[k];
      if (!u) return;
      const uid = u.uid || ("name:" + k);
      if (!byUid[uid]) byUid[uid] = [];
      byUid[uid].push(k);
    });
    const ownName = (userProfile?.username || "").toLowerCase();
    let changed = false;
    Object.values(byUid).forEach(keys => {
      if (keys.length < 2) return;
      let keep = keys[0];
      if (ownName && keys.includes(ownName)) {
        keep = ownName;
      } else {
        keep = keys.slice().sort((a, b) => ((registry[b]?.profileViews || 0) - (registry[a]?.profileViews || 0)))[0];
      }
      keys.forEach(k => {
        if (k !== keep) {
          delete registry[k];
          changed = true;
        }
      });
    });
    if (changed) localStorage.setItem("bloxd_users_db", JSON.stringify(registry));
  }

  try {
    if (window.firebase) {
      firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
      db = firebase.firestore();


      if (db.settings) {
        db.settings({
          merge: true,
          experimentalAutoDetectLongPolling: true,
          ignoreUndefinedProperties: true
        });
      }

      try {
        db.disableNetwork().catch(() => {});
      } catch (err) {}

      new Promise((resolve) => {
        let done = false;
        const finish = (online) => {
          if (done) return;
          done = true;
          firestoreOnline = online;
          if (online && db) {
            try {
              db.enableNetwork().catch(() => {});
            } catch (err) {}
          } else if (!online) {
            showToast("Running in local mode, changes stay on this device.", "info");
          }
          resolve(online);
        };
        try {
          if (typeof fetch !== "function") {
            finish(true);
            return;
          }
          let timer = null;
          let signal;
          if (typeof AbortController !== "undefined") {
            const controller = new AbortController();
            signal = controller.signal;
            timer = setTimeout(() => {
              try { controller.abort(); } catch (e) {}
              finish(false);
            }, 4000);
          } else {
            timer = setTimeout(() => finish(false), 4000);
          }
          fetch("https://firestore.googleapis.com/", { mode: "no-cors", signal: signal })
            .then(() => {
              if (timer) clearTimeout(timer);
              finish(true);
            })
            .catch(() => {
              if (timer) clearTimeout(timer);
              finish(false);
            });
        } catch (err) {
          finish(false);
        }
      });
    }
  } catch (err) {
    console.warn("Firebase initialized with local fallback:", err);
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

  function usernameToEmail(username) {
    return `${username.toLowerCase()}@bloxdcode.internal`;
  }

  

 
  const USERNAME_COOLDOWN_MS = 60 * 60 * 1000;

  function checkAuthGate() {
    const authGate = document.getElementById("auth-gate-screen");
    const localUser = localStorage.getItem("bloxd_auth_session");

    if (localUser) {
      try {
        userProfile = JSON.parse(localUser);
        currentUser = { uid: userProfile.uid, email: userProfile.email || usernameToEmail(userProfile.username) };
        if (authGate) authGate.classList.add("hidden");
        updateUserUI();
        updatePortfolioUI();
        renderDashboard();
      } catch (e) {}
    }

    // Claude Security Patch: this listener used to be skipped entirely when a local cache
    // existed, so currentUser was never a real Firebase User object after a reload and
    // isAdmin() (which needs a real ID token) could never resolve true. Always attach it now.
    if (auth) {
      auth.onAuthStateChanged(async (user) => {
        if (user) {
          currentUser = user;
          await loadUserProfile(user.uid);
          await refreshAdminStatus();
          if (authGate) authGate.classList.add("hidden");
          if (publicViewUser && userProfile && publicViewUser === (userProfile.username || "").toLowerCase()) {
            publicViewUser = "";
            publicViewProfile = null;
          }
          updatePortfolioUI();
        } else if (!localUser) {
          currentUser = null;
          userProfile = null;
          isAdminUser = false;
          if (authGate && !publicViewUser) authGate.classList.remove("hidden");
        }
        updateUserUI();
        renderDashboard();
      }, () => {
        if (!localUser && authGate && !publicViewUser) authGate.classList.remove("hidden");
      });
    } else if (!localUser) {
      if (authGate && !publicViewUser) authGate.classList.remove("hidden");
    }
  }

  async function loadUserProfile(uid) {
    if (db && firestoreOnline) {
      try {
        const snap = await db.collection("users").doc(uid).get();
        if (snap.exists) {
          userProfile = snap.data();
          localStorage.setItem("bloxd_auth_session", JSON.stringify(userProfile));
          updateUserUI();
          updatePortfolioUI();
          renderDashboard();
          return;
        }
      } catch (e) {
        
      }
    }

    const defaultName = (currentUser.displayName || (currentUser.email ? currentUser.email.split("@")[0] : "coder")).toLowerCase().replace(/[^a-z0-9]/g, "");
    userProfile = {
      uid: currentUser.uid,
      username: defaultName || "coder_" + Math.floor(Math.random() * 1000),
      bio: "Bloxd.io Developer",
      avatar: currentUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.uid}`,
      lastUsernameChange: 0,
      portfolioBg: DEFAULT_BG,
      portfolioAudio: "",
      audioTitle: "",
      customCode: "",
      socials: { discord: "", github: "" },
      stats: { xp: 0, lessons: 0 }
    };

    saveUserProfileData(userProfile);
  }

  function claimSubdomain(name, uid) {
    if (!db || !firestoreOnline || !name || !uid) return;
    try {
      const claimed = JSON.parse(localStorage.getItem("bloxd_claimed_subs") || "{}");
      if (claimed[name.toLowerCase()]) return;
      db.collection("subdomains").doc(name.toLowerCase()).set({
        uid: uid,
        username: name.toLowerCase(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        try {
          const c2 = JSON.parse(localStorage.getItem("bloxd_claimed_subs") || "{}");
          c2[name.toLowerCase()] = 1;
          localStorage.setItem("bloxd_claimed_subs", JSON.stringify(c2));
        } catch (e) {}
      }).catch(() => {});
    } catch (e) {}
  }

  function saveUserProfileData(data) {
    userProfile = { ...userProfile, ...data };
    localStorage.setItem("bloxd_auth_session", JSON.stringify(userProfile));

    
    const registry = JSON.parse(localStorage.getItem("bloxd_users_db") || "{}");
    if (userProfile.username) {
      const me = userProfile.username.toLowerCase();
      Object.keys(registry).forEach(k => {
        if (k !== me && registry[k] && registry[k].uid === userProfile.uid) {
          delete registry[k];
        }
      });
      const existing = registry[me] || {};
      if (userProfile.profileViews == null && existing.profileViews != null) {
        userProfile.profileViews = existing.profileViews;
      }
      registry[me] = userProfile;
      localStorage.setItem("bloxd_users_db", JSON.stringify(registry));
    }

    if (db && firestoreOnline && currentUser) {
      try {
        db.collection("users").doc(currentUser.uid).set(userProfile, { merge: true }).catch(() => {});
      } catch (e) {}
      claimSubdomain(userProfile.username, userProfile.uid || currentUser.uid);
    }

    updateUserUI();
    updatePortfolioUI();
    renderDashboard();
  }

  async function updateUsernameWithCooldown(newUsername) {
    const valid = validateUsername(newUsername);
    if (!valid.valid) throw new Error(valid.error);
    const clean = valid.username;

    if (clean === userProfile.username) return;

    const now = Date.now();
    const lastChange = userProfile.lastUsernameChange || 0;
    const elapsed = now - lastChange;

    if (elapsed < USERNAME_COOLDOWN_MS) {
      const minutesLeft = Math.ceil((USERNAME_COOLDOWN_MS - elapsed) / 60000);
      throw new Error(`Username cooldown active. You can change your username again in ${minutesLeft} minute(s).`);
    }

    
    const registry = JSON.parse(localStorage.getItem("bloxd_users_db") || "{}");
    if (registry[clean] && registry[clean].uid !== userProfile.uid) {
      throw new Error(`The username '${clean}' is already taken.`);
    }

    if (db && firestoreOnline) {
      try {
        const snap = await db.collection("subdomains").doc(clean).get();
        if (snap.exists && snap.data().uid !== userProfile.uid) {
          throw new Error(`The username '${clean}' is already taken.`);
        }
        await db.collection("subdomains").doc(clean).set({
          uid: userProfile.uid,
          username: clean,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      } catch (err) {
        if (err.message && err.message.includes("already taken")) throw err;
      }
    }

    const oldName = (userProfile.username || "").toLowerCase();
    userProfile.username = clean;
    userProfile.lastUsernameChange = now;
    if (db && firestoreOnline && oldName && oldName !== clean) {
      try {
        db.collection("subdomains").doc(oldName).delete().catch(() => {});
      } catch (e) {}
      try {
        const claimed = JSON.parse(localStorage.getItem("bloxd_claimed_subs") || "{}");
        delete claimed[oldName];
        localStorage.setItem("bloxd_claimed_subs", JSON.stringify(claimed));
      } catch (e) {}
    }
    saveUserProfileData(userProfile);
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
      const registry = JSON.parse(localStorage.getItem("bloxd_users_db") || "{}");
      const fresh = registry[(p.username || "").toLowerCase()]?.profileViews;
      const n = fresh ?? p.profileViews ?? 0;
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

  function initForum() {
    renderForumFeed();
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

    feed.innerHTML = filtered.map(p => `
      <div class="forum-post-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${p.author}" style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border-color);">
            <div>
              <strong style="font-size:13.5px;color:#fff;">${escapeHtml(p.author)}</strong>
              <span style="font-size:11px;color:var(--text-dim);margin-left:6px;">${new Date(p.timestamp).toLocaleDateString()}</span>
            </div>
          </div>
          <span class="nav-badge">${(p.category || "GENERAL").toUpperCase()}</span>
        </div>
        <h3 style="font-size:15.5px;color:#fff;margin-bottom:8px;">${escapeHtml(p.title)}</h3>
        <div style="font-size:13.5px;color:var(--text-muted);line-height:1.6;">${parseCodeInPost(p.content)}</div>
        ${p.mediaUrl ? `<img src="${escapeHtml(p.mediaUrl)}" style="max-width:100%;max-height:300px;border-radius:6px;margin-top:12px;border:1px solid var(--border-color);">` : ""}
      </div>
    `).join("");
  }

  function setupForum() {
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

        const newPost = {
          id: "post_" + Date.now(),
          author: userProfile?.username || "Anonymous",
          title,
          category,
          content,
          timestamp: Date.now(),
          mediaUrl: ""
        };

        if (fileInput && fileInput.files && fileInput.files[0]) {
          const r = new FileReader();
          r.onload = (ev) => {
            newPost.mediaUrl = ev.target.result;
            finalizePost(newPost, submitBtn);
          };
          r.readAsDataURL(fileInput.files[0]);
        } else {
          finalizePost(newPost, submitBtn);
        }
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
    
    const codes = JSON.parse(localStorage.getItem("bloxd_community_codes") || "[]");
    const registry = JSON.parse(localStorage.getItem("bloxd_users_db") || "{}");

    const codesCountEl = document.getElementById("stat-codes-count");
    if (codesCountEl) codesCountEl.textContent = codes.length;

    const devsCountEl = document.getElementById("stat-devs-count");
    if (devsCountEl) devsCountEl.textContent = Object.keys(registry).length;

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

    const allCodes = JSON.parse(localStorage.getItem("bloxd_community_codes") || "[]");
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

    const registry = JSON.parse(localStorage.getItem("bloxd_users_db") || "{}");
    let list = Object.values(registry)
      .filter(u => u && u.username)
      .map(u => ({
        username: u.username,
        xp: u.stats?.xp || 0,
        profileViews: u.profileViews || 0,
        bio: u.bio || "Bloxd.io Developer",
        avatar: u.avatar || "",
        avatarZoom: u.avatarZoom || 1,
        avatarPosX: u.avatarPosX ?? 50,
        avatarPosY: u.avatarPosY ?? 50
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
    const registry = JSON.parse(localStorage.getItem("bloxd_users_db") || "{}");
    if (registry[key]) return registry[key];
    if (db && firestoreOnline) {
      try {
        const sub = await db.collection("subdomains").doc(key).get();
        if (sub.exists && sub.data() && sub.data().uid) {
          const usnap = await db.collection("users").doc(sub.data().uid).get();
          if (usnap.exists) {
            registry[key] = usnap.data();
            localStorage.setItem("bloxd_users_db", JSON.stringify(registry));
            return registry[key];
          }
        }
      } catch (e) {}
      try {
        const q = await db.collection("users").where("username", "==", key).limit(1).get();
        if (!q.empty) {
          registry[key] = q.docs[0].data();
          localStorage.setItem("bloxd_users_db", JSON.stringify(registry));
          return registry[key];
        }
      } catch (e) {}
    }
    return null;
  }

  function countProfileView(dev) {
    const key = String(dev.username || "").toLowerCase();
    const ownName = (userProfile?.username || "").toLowerCase();
    if (!key || key === ownName) return;
    dev.profileViews = (dev.profileViews || 0) + 1;
    const registry = JSON.parse(localStorage.getItem("bloxd_users_db") || "{}");
    registry[key] = dev;
    localStorage.setItem("bloxd_users_db", JSON.stringify(registry));
    if (db && firestoreOnline && dev.uid) {
      try {
        db.collection("users").doc(dev.uid).set({ profileViews: dev.profileViews }, { merge: true }).catch(() => {});
      } catch (e) {}
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
    countProfileView(dev);

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

    const registry = JSON.parse(localStorage.getItem("bloxd_users_db") || "{}");
    const target = registry[key];
    delete registry[key];
    localStorage.setItem("bloxd_users_db", JSON.stringify(registry));

    const codes = JSON.parse(localStorage.getItem("bloxd_community_codes") || "[]")
      .filter(c => String(c.author || "").toLowerCase() !== key);
    localStorage.setItem("bloxd_community_codes", JSON.stringify(codes));

    forumPosts = forumPosts.filter(p => String(p.author || "").toLowerCase() !== key);
    localStorage.setItem("bloxd_real_forum_posts", JSON.stringify(forumPosts));

    if (db && firestoreOnline) {
      try {
        const q = await db.collection("users").where("username", "==", key).get();
        q.forEach(d => {
          try { d.ref.delete().catch(() => {}); } catch (e) {}
        });
        db.collection("subdomains").doc(key).delete().catch(() => {});
        if (target && target.uid) {
          db.collection("users").doc(target.uid).delete().catch(() => {});
        }
      } catch (e) {}
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

    const allCodes = JSON.parse(localStorage.getItem("bloxd_community_codes") || "[]");
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

    container.innerHTML = filtered.map(c => `
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
          </div>
        </div>
      </div>
    `).join("");
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

        const entry = {
          id: "code_" + Date.now(),
          author: userProfile?.username || "Anonymous",
          title,
          description,
          category,
          code,
          image: "",
          timestamp: Date.now()
        };

        const imgInput = document.getElementById("upload-code-image-file");
        if (imgInput && imgInput.files && imgInput.files[0]) {
          const r = new FileReader();
          r.onload = (ev) => {
            entry.image = ev.target.result;
            finalizeCodeUpload(entry, submitBtn, modal);
          };
          r.readAsDataURL(imgInput.files[0]);
        } else {
          finalizeCodeUpload(entry, submitBtn, modal);
        }
      };
    }
  }

  function finalizeCodeUpload(entry, btn, modal) {
    const allCodes = JSON.parse(localStorage.getItem("bloxd_community_codes") || "[]");
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
    const allCodes = JSON.parse(localStorage.getItem("bloxd_community_codes") || "[]");
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
    const allCodes = JSON.parse(localStorage.getItem("bloxd_community_codes") || "[]");
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
      gateGoogleBtn.onclick = async () => {
        try {
          if (auth && window.location.protocol.startsWith("http")) {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            currentUser = result.user;
            await loadUserProfile(currentUser.uid);
          } else {
            
            const guestName = "google_user_" + Math.floor(Math.random() * 1000);
            currentUser = { uid: "g_" + Date.now(), email: `${guestName}@gmail.com` };
            await loadUserProfile(currentUser.uid);
          }
          document.getElementById("auth-gate-screen")?.classList.add("hidden");
          showToast("Signed in with Google!", "success");
        } catch (err) {
          // Claude Security Patch: previously this fabricated a fake "signed in" session on ANY
          // failure (closed popup, blocked popup, etc.) - that let anyone bypass Google auth entirely.
          showToast("Google sign-in was cancelled or failed. Please try again.", "error");
        }
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

        const syntheticEmail = usernameToEmail(username);

        try {
          if (auth && window.location.protocol.startsWith("http")) {
            const userCred = await auth.signInWithEmailAndPassword(syntheticEmail, pass);
            currentUser = userCred.user;
            await loadUserProfile(currentUser.uid);
          } else {
            currentUser = { uid: "u_" + btoa(username), email: syntheticEmail };
            userProfile = {
              uid: currentUser.uid,
              username: username,
              bio: "Bloxd.io Developer",
              avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
              lastUsernameChange: 0,
              portfolioBg: DEFAULT_BG,
              portfolioAudio: "",
              audioTitle: "",
              customCode: "",
              socials: { discord: "", github: "" },
              stats: { xp: 0, lessons: 0 }
            };
            saveUserProfileData(userProfile);
          }
          document.getElementById("auth-gate-screen")?.classList.add("hidden");
          showToast(`Welcome back, ${username}!`, "success");
        } catch (err) {
          // Claude Security Patch: a rejected password used to fall through to this same fallback
          // and log the user in anyway. Only genuine connectivity errors get the offline fallback now;
          // a bad password/username is rejected instead of granting access.
          const credentialErrorCodes = [
            "auth/wrong-password",
            "auth/user-not-found",
            "auth/invalid-credential",
            "auth/invalid-email",
            "auth/user-disabled",
            "auth/too-many-requests"
          ];
          if (err && credentialErrorCodes.includes(err.code)) {
            showToast("Incorrect username or password.", "error");
            return;
          }
          currentUser = { uid: "u_" + btoa(username), email: syntheticEmail };
          await loadUserProfile(currentUser.uid);
          document.getElementById("auth-gate-screen")?.classList.add("hidden");
          showToast(`Welcome back, ${username}!`, "success");
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

        if (!pass || pass.length < 4) {
          showToast("Password must be at least 4 characters.", "error");
          return;
        }

        const syntheticEmail = usernameToEmail(val.username);

        try {
          if (auth && window.location.protocol.startsWith("http")) {
            const userCred = await auth.createUserWithEmailAndPassword(syntheticEmail, pass);
            currentUser = userCred.user;
          } else {
            currentUser = { uid: "u_" + btoa(val.username), email: syntheticEmail };
          }
        } catch (err) {
          // Claude Security Patch: an "email-already-in-use" error means this username is genuinely
          // taken - previously it silently created a colliding local-only account instead of blocking.
          if (err && err.code === "auth/email-already-in-use") {
            showToast(`The username '${val.username}' is already taken.`, "error");
            return;
          }
          currentUser = { uid: "u_" + btoa(val.username), email: syntheticEmail };
        }

        userProfile = {
          uid: currentUser.uid,
          username: val.username,
          bio: "Bloxd.io Developer",
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${val.username}`,
          lastUsernameChange: 0,
          portfolioBg: DEFAULT_BG,
          portfolioAudio: "",
          audioTitle: "",
          customCode: "",
          socials: { discord: "", github: "" },
          stats: { xp: 0, lessons: 0 }
        };
        saveUserProfileData(userProfile);

        document.getElementById("auth-gate-screen")?.classList.add("hidden");
        showToast(`Account created for @${val.username}!`, "success");
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
    if (!requested) {
      const parts = window.location.hostname.split(".");
      if (parts.length >= 3 && parts[0] && !["www", "app"].includes(parts[0].toLowerCase())) {
        requested = parts[0];
      }
    }
    requested = requested.toLowerCase().replace(/[^a-z0-9_\-]/g, "");
    if (!requested) return;
    if (userProfile && requested === (userProfile.username || "").toLowerCase()) return;
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
    countProfileView(dev);
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
    dedupeRegistry();

    initDashboard();
    initPortfolio();
    initForum();
    initLibs();
    initAcademy();
    initCodes();
    handleProfileDeepLink();

    document.querySelectorAll(".nav-item[data-view]").forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        navigateTo(btn.getAttribute("data-view"));
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
      logoutBtn.onclick = () => {
        if (auth) {
          try { auth.signOut(); } catch(e) {}
        }
        localStorage.removeItem("bloxd_auth_session");
        currentUser = null;
        userProfile = null;
        document.getElementById("auth-gate-screen")?.classList.remove("hidden");
        showToast("Signed out", "info");
      };
    }
  });

})();
