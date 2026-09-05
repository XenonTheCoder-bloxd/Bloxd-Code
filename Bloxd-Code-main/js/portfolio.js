
import { currentUser, userProfile, saveUserProfile, changeUsername } from "./auth.js";
import { showToast } from "./app.js";

export const BG_PRESETS = [
  { id: "bloxd-default", name: "Bloxd Wallpaper", url: "radial-gradient(circle at 50% 25%, #262626, #0b0b0b 75%)" },
  { id: "cyber-grid", name: "Cyber Neon Grid", url: "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1200&q=80" },
  { id: "synth-sunset", name: "Synthwave Sunset", url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80" },
  { id: "matrix-dark", name: "Matrix Hacker", url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80" },
  { id: "galaxy-deep", name: "Deep Galaxy", url: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80" },
  { id: "voxel-sky", name: "Neon Voxels", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80" }
];

export const MUSIC_PRESETS = [
  { title: "Cyber Synth - Coding Chill", url: "https://cdn.freesound.org/previews/563/563581_5674468-lq.mp3" },
  { title: "Midnight Lo-Fi Beat", url: "https://cdn.freesound.org/previews/530/530415_11707019-lq.mp3" },
  { title: "Retro 8-Bit Arcade Groove", url: "https://cdn.freesound.org/previews/458/458586_9961300-lq.mp3" }
];

let globalAudio = null;
let isAudioPlaying = false;

 
export function initPortfolioStudio() {
  renderPresetOptions();
  setupAudioPlayer();
  setupEventListeners();
  updateStudioFromProfile();
}

 
export function updateStudioFromProfile() {
  const profile = userProfile || {
    username: "guest",
    bio: "",
    avatar: "",
    portfolioBg: "radial-gradient(circle at 50% 25%, #262626, #0b0b0b 75%)",
    portfolioMusic: MUSIC_PRESETS[0].url,
    musicTitle: MUSIC_PRESETS[0].title,
    badges: [],
    socials: { discord: "", github: "", youtube: "" },
    customCode: "<style>\n  /* Custom CSS */\n  .guns-name { text-shadow: 0 0 10px #6366f1; }\n</style>\n<script>\n  // Safe sandboxed script\n  console.log('Portfolio loaded');\n</script>",
    lastUsernameChange: 0
  };

  
  const subDomainEl = document.getElementById("studio-subdomain-display");
  if (subDomainEl) {
    subDomainEl.textContent = `${profile.username}.bloxdcode.com`;
  }

  
  const usernameInput = document.getElementById("studio-username-input");
  if (usernameInput) usernameInput.value = profile.username;

  const bioInput = document.getElementById("studio-bio-input");
  if (bioInput) bioInput.value = profile.bio || "";

  const avatarInput = document.getElementById("studio-avatar-input");
  if (avatarInput) avatarInput.value = profile.avatar || "";

  const musicUrlInput = document.getElementById("studio-music-input");
  if (musicUrlInput) musicUrlInput.value = profile.portfolioMusic || "";

  const musicTitleInput = document.getElementById("studio-music-title-input");
  if (musicTitleInput) musicTitleInput.value = profile.musicTitle || "";

  const bgUrlInput = document.getElementById("studio-bg-input");
  if (bgUrlInput) bgUrlInput.value = profile.portfolioBg || "";

  const discordInput = document.getElementById("studio-discord-input");
  if (discordInput) discordInput.value = (profile.socials && profile.socials.discord) || "";

  const githubInput = document.getElementById("studio-github-input");
  if (githubInput) githubInput.value = (profile.socials && profile.socials.github) || "";

  const customCodeInput = document.getElementById("studio-custom-code-input");
  if (customCodeInput) customCodeInput.value = profile.customCode || "";

  
  renderStagePreview(profile);
}

 
export function renderStagePreview(profile) {
  
  const bgLayer = document.getElementById("stage-bg-layer");
  if (bgLayer) {
    bgLayer.style.backgroundImage = `url('${profile.portfolioBg || "radial-gradient(circle at 50% 25%, #262626, #0b0b0b 75%)"}')`;
  }

  
  const avatarEl = document.getElementById("stage-avatar");
  if (avatarEl) avatarEl.src = profile.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username}`;

  const nameEl = document.getElementById("stage-name");
  if (nameEl) nameEl.textContent = profile.username;

  const handleEl = document.getElementById("stage-handle");
  if (handleEl) handleEl.textContent = `@${profile.username}.bloxdcode.com`;

  const bioEl = document.getElementById("stage-bio");
  if (bioEl) bioEl.textContent = profile.bio || "No bio yet.";

  
  const badgesContainer = document.getElementById("stage-badges");
  if (badgesContainer) {
    badgesContainer.innerHTML = "";
    const badges = profile.badges || ["Bloxd Coder"];
    badges.forEach(b => {
      const badge = document.createElement("span");
      badge.className = "guns-badge";
      badge.textContent = b;
      badgesContainer.appendChild(badge);
    });
  }

  
  const discordLink = document.getElementById("stage-social-discord");
  const githubLink = document.getElementById("stage-social-github");
  if (discordLink && profile.socials) {
    discordLink.style.display = profile.socials.discord ? "flex" : "none";
    discordLink.href = profile.socials.discord.startsWith("http") ? profile.socials.discord : `https://discord.com/users/${profile.socials.discord}`;
  }
  if (githubLink && profile.socials) {
    githubLink.style.display = profile.socials.github ? "flex" : "none";
    githubLink.href = profile.socials.github.startsWith("http") ? profile.socials.github : `https://github.com/${profile.socials.github}`;
  }

  
  const musicTitleEl = document.getElementById("stage-music-title");
  if (musicTitleEl) {
    musicTitleEl.textContent = profile.musicTitle || "Audio Track";
  }

  
  renderSafeSandbox(profile.customCode || "");
}

 
function renderSafeSandbox(code) {
  const sandboxFrame = document.getElementById("stage-sandbox-frame");
  if (!sandboxFrame) return;

  
  const safeCode = code
    .replace(/window\.parent/gi, "null")
    .replace(/window\.top/gi, "null")
    .replace(/document\.cookie/gi, "''")
    .replace(/localStorage/gi, "null");

  const docContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            margin: 0;
            overflow: hidden;
            background: transparent;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #fff;
          }
        </style>
      </head>
      <body>
        <div id="custom-root"></div>
        ${safeCode}
      </body>
    </html>
  `;

  sandboxFrame.srcdoc = docContent;
}

 
function renderPresetOptions() {
  const bgPresetContainer = document.getElementById("bg-presets-container");
  if (bgPresetContainer) {
    bgPresetContainer.innerHTML = "";
    BG_PRESETS.forEach(preset => {
      const chip = document.createElement("div");
      chip.className = "preset-chip";
      chip.textContent = preset.name;
      chip.onclick = () => {
        const bgInput = document.getElementById("studio-bg-input");
        if (bgInput) bgInput.value = preset.url;
        const bgLayer = document.getElementById("stage-bg-layer");
        if (bgLayer) bgLayer.style.backgroundImage = `url('${preset.url}')`;
      };
      bgPresetContainer.appendChild(chip);
    });
  }

  const musicPresetContainer = document.getElementById("music-presets-container");
  if (musicPresetContainer) {
    musicPresetContainer.innerHTML = "";
    MUSIC_PRESETS.forEach(preset => {
      const chip = document.createElement("div");
      chip.className = "preset-chip";
      chip.textContent = preset.title;
      chip.onclick = () => {
        const musicInput = document.getElementById("studio-music-input");
        const titleInput = document.getElementById("studio-music-title-input");
        if (musicInput) musicInput.value = preset.url;
        if (titleInput) titleInput.value = preset.title;
        const stageMusicTitle = document.getElementById("stage-music-title");
        if (stageMusicTitle) stageMusicTitle.textContent = preset.title;
      };
      musicPresetContainer.appendChild(chip);
    });
  }
}

 
function setupAudioPlayer() {
  const playBtn = document.getElementById("stage-play-btn");
  const visualizer = document.getElementById("stage-visualizer");

  if (playBtn) {
    playBtn.onclick = () => {
      const musicUrl = (userProfile && userProfile.portfolioMusic) || (document.getElementById("studio-music-input")?.value) || MUSIC_PRESETS[0].url;
      
      if (!globalAudio || globalAudio.src !== musicUrl) {
        if (globalAudio) globalAudio.pause();
        globalAudio = new Audio(musicUrl);
        globalAudio.loop = true;
      }

      if (isAudioPlaying) {
        globalAudio.pause();
        isAudioPlaying = false;
        playBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
        visualizer?.classList.remove("playing");
      } else {
        globalAudio.play().then(() => {
          isAudioPlaying = true;
          playBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
          visualizer?.classList.add("playing");
        }).catch(err => {
          showToast("Audio playback blocked by browser. Click again to play.", "info");
        });
      }
    };
  }
}

 
function setupEventListeners() {
  
  const bioInput = document.getElementById("studio-bio-input");
  if (bioInput) {
    bioInput.addEventListener("input", (e) => {
      const bioEl = document.getElementById("stage-bio");
      if (bioEl) bioEl.textContent = e.target.value || "No bio yet.";
    });
  }

  const customCodeInput = document.getElementById("studio-custom-code-input");
  if (customCodeInput) {
    customCodeInput.addEventListener("input", (e) => {
      renderSafeSandbox(e.target.value);
    });
  }

  
  const saveBtn = document.getElementById("save-portfolio-btn");
  if (saveBtn) {
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

      try {
        const newUsername = document.getElementById("studio-username-input")?.value?.trim();
        const bio = document.getElementById("studio-bio-input")?.value;
        const avatar = document.getElementById("studio-avatar-input")?.value;
        const portfolioBg = document.getElementById("studio-bg-input")?.value;
        const portfolioMusic = document.getElementById("studio-music-input")?.value;
        const musicTitle = document.getElementById("studio-music-title-input")?.value;
        const discord = document.getElementById("studio-discord-input")?.value;
        const github = document.getElementById("studio-github-input")?.value;
        const customCode = document.getElementById("studio-custom-code-input")?.value;

        
        if (userProfile && newUsername && newUsername.toLowerCase() !== userProfile.username.toLowerCase()) {
          await changeUsername(newUsername);
        }

        const updatedData = {
          bio,
          avatar: avatar || (userProfile?.avatar),
          portfolioBg: portfolioBg || "radial-gradient(circle at 50% 25%, #262626, #0b0b0b 75%)",
          portfolioMusic: portfolioMusic || MUSIC_PRESETS[0].url,
          musicTitle: musicTitle || "Custom Track",
          customCode: customCode || "",
          socials: { discord, github, youtube: "" }
        };

        await saveUserProfile(updatedData);
        updateStudioFromProfile();
        showToast("Portfolio and subdomain updated successfully!", "success");
      } catch (err) {
        showToast(err.message || "Error saving portfolio", "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Save & Publish`;
      }
    };
  }

  
  const copySubdomainBtn = document.getElementById("copy-subdomain-btn");
  if (copySubdomainBtn) {
    copySubdomainBtn.onclick = () => {
      const username = userProfile?.username || "guest";
      const fullUrl = `https://${username}.bloxdcode.com`;
      navigator.clipboard.writeText(fullUrl).then(() => {
        showToast(`Copied ${fullUrl} to clipboard!`, "success");
      }).catch(() => {
        showToast(`Shareable: ${fullUrl}`, "info");
      });
    };
  }

  
  const bgUploadInput = document.getElementById("studio-bg-file-upload");
  if (bgUploadInput) {
    bgUploadInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const bgInput = document.getElementById("studio-bg-input");
          if (bgInput) bgInput.value = event.target.result;
          const bgLayer = document.getElementById("stage-bg-layer");
          if (bgLayer) bgLayer.style.backgroundImage = `url('${event.target.result}')`;
          showToast("Custom background loaded!", "info");
        };
        reader.readAsDataURL(file);
      }
    });
  }

  
  const audioUploadInput = document.getElementById("studio-audio-file-upload");
  if (audioUploadInput) {
    audioUploadInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const musicInput = document.getElementById("studio-music-input");
          const titleInput = document.getElementById("studio-music-title-input");
          if (musicInput) musicInput.value = event.target.result;
          if (titleInput) titleInput.value = file.name.replace(/\.[^/.]+$/, "");
          const stageMusicTitle = document.getElementById("stage-music-title");
          if (stageMusicTitle) stageMusicTitle.textContent = file.name;
          showToast("Custom audio track loaded!", "info");
        };
        reader.readAsDataURL(file);
      }
    });
  }
}
