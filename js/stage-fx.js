'use strict';

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

