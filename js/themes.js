
import { showToast } from "./app.js";

export const THEMES = [
  { id: "dark", name: "Bloxd Dark", primary: "#6366f1", bg: "#0a0a0f", desc: "Classic sleek dark mode with violet neon glow" },
  { id: "cyberpunk", name: "Cyberpunk 2077", primary: "#ff007f", bg: "#07070b", desc: "Neon magenta & cyan high-voltage vibe" },
  { id: "synthwave", name: "Synthwave Sunset", primary: "#ff71ce", bg: "#12072b", desc: "80s retro sunset violet & neon pink" },
  { id: "matrix", name: "Emerald Hacker", primary: "#00ff66", bg: "#020b05", desc: "Terminal green phosphor aesthetic" },
  { id: "void", name: "Void Abyss", primary: "#ffffff", bg: "#000000", desc: "Pure minimalist monochrome deep black" },
  { id: "amethyst", name: "Royal Amethyst", primary: "#c084fc", bg: "#0f0718", desc: "Lush purple and hot fuchsia tones" },
  { id: "crimson", name: "Crimson Dawn", primary: "#f43f5e", bg: "#0f0505", desc: "Bold red and fiery orange gradient" }
];

let activeTheme = localStorage.getItem("bloxd_theme") || "dark";

 
export function initThemes() {
  applyTheme(activeTheme);
  renderThemesGrid();
}

 
export function applyTheme(themeId) {
  const found = THEMES.find(t => t.id === themeId) || THEMES[0];
  activeTheme = found.id;
  localStorage.setItem("bloxd_theme", activeTheme);
  
  if (found.id === "dark") {
    document.body.removeAttribute("data-theme");
  } else {
    document.body.setAttribute("data-theme", found.id);
  }

  renderThemesGrid();
}

 
export function renderThemesGrid() {
  const container = document.getElementById("themes-picker-grid");
  if (!container) return;

  container.innerHTML = THEMES.map(theme => `
    <div class="glass-card" onclick="selectTheme('${theme.id}')" style="cursor: pointer; border: 2px solid ${activeTheme === theme.id ? theme.primary : 'var(--border-color)'};">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <strong style="font-size: 15px; color: ${activeTheme === theme.id ? theme.primary : '#fff'};">${theme.name}</strong>
        <div style="width: 16px; height: 16px; border-radius: 50%; background: ${theme.primary}; box-shadow: 0 0 10px ${theme.primary};"></div>
      </div>
      <p style="font-size: 12px; color: var(--text-muted); margin: 0;">${theme.desc}</p>
    </div>
  `).join("");
}

window.selectTheme = function(themeId) {
  applyTheme(themeId);
  showToast(`Theme switched to ${themeId}!`, "success");
};
