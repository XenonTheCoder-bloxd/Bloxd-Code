
import { showToast } from "./app.js";

const GITHUB_REPO_API = "https://api.github.com/repos/imrenori/Bloxd-Libs/contents";
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/imrenori/Bloxd-Libs/main";

const FALLBACK_LIBS = [
  { name: "KVStore.js", path: "KVStore.js", download_url: `${GITHUB_RAW_BASE}/KVStore.js`, desc: "Key-Value Store data persistence for player stats, inventory and world variables." },
  { name: "MathLibGeometry.js", path: "MathLibGeometry.js", download_url: `${GITHUB_RAW_BASE}/MathLibGeometry.js`, desc: "3D Geometric calculations, distance checking, bounding boxes and raycasting." },
  { name: "MathLibLinear.js", path: "MathLibLinear.js", download_url: `${GITHUB_RAW_BASE}/MathLibLinear.js`, desc: "Vector interpolation, dot products, normalization and lerping algorithms." },
  { name: "WorldGen.js", path: "WorldGen.js", download_url: `${GITHUB_RAW_BASE}/WorldGen.js`, desc: "Procedural voxel terrain generation with perlin noise, caves, and ores." },
  { name: "Pathfinder.js", path: "Pathfinder.js", download_url: `${GITHUB_RAW_BASE}/Pathfinder.js`, desc: "A* Pathfinding for mobs, NPCs and custom entities across voxel blocks." },
  { name: "Scheduler.js", path: "Scheduler.js", download_url: `${GITHUB_RAW_BASE}/Scheduler.js`, desc: "Delayed, repeating and conditional task management tied to tick()." },
  { name: "RoomGen.js", path: "RoomGen.js", download_url: `${GITHUB_RAW_BASE}/RoomGen.js`, desc: "Procedural room, dungeon, and structure placement generator." }
];

let fetchedLibraries = [];

 
export async function initLibs() {
  const container = document.getElementById("libs-grid-container");
  if (!container) return;

  container.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: var(--accent-primary);"></i>
      <p style="margin-top: 12px; color: var(--text-muted);">Fetching official Bloxd-Libs from GitHub...</p>
    </div>
  `;

  try {
    const response = await fetch(GITHUB_REPO_API);
    if (!response.ok) throw new Error("GitHub API rate limit or error");

    const data = await response.json();
    
    const jsFiles = data.filter(item => item.name && item.name.endsWith(".js"));

    if (jsFiles.length > 0) {
      fetchedLibraries = jsFiles.map(file => ({
        name: file.name,
        path: file.path,
        download_url: file.download_url || `${GITHUB_RAW_BASE}/${file.name}`,
        desc: getLibDescription(file.name)
      }));
    } else {
      fetchedLibraries = FALLBACK_LIBS;
    }
  } catch (err) {
    console.warn("Using fallback Bloxd-Libs list:", err);
    fetchedLibraries = FALLBACK_LIBS;
  }

  renderLibsGrid(fetchedLibraries);
}

function getLibDescription(fileName) {
  const match = FALLBACK_LIBS.find(l => l.name.toLowerCase() === fileName.toLowerCase());
  return match ? match.desc : `Bloxd.io JavaScript library module (${fileName}).`;
}

 
export function renderLibsGrid(libs) {
  const container = document.getElementById("libs-grid-container");
  if (!container) return;

  container.innerHTML = libs.map((lib, idx) => `
    <div class="glass-card lib-card" style="animation: fadeInView 0.3s ease forwards ${idx * 0.08}s;">
      <div>
        <div class="lib-header">
          <span class="lib-title">${escapeHtml(lib.name)}</span>
          <span class="lib-tag">ES MODULE</span>
        </div>
        <p class="lib-desc">${escapeHtml(lib.desc)}</p>
      </div>

      <div class="lib-actions">
        <button class="btn btn-secondary" onclick="previewLib('${escapeHtml(lib.name)}', '${escapeHtml(lib.download_url)}')">
          <i class="fa-regular fa-eye"></i> Preview
        </button>
        <button class="btn btn-primary" onclick="downloadLib('${escapeHtml(lib.name)}', '${escapeHtml(lib.download_url)}')">
          <i class="fa-solid fa-download"></i> Download
        </button>
      </div>
    </div>
  `).join("");
}

 
window.previewLib = async function(name, url) {
  const modal = document.getElementById("preview-code-modal");
  const title = document.getElementById("preview-code-title");
  const codeContainer = document.getElementById("preview-code-body");
  
  if (!modal || !title || !codeContainer) return;

  title.textContent = name;
  codeContainer.innerHTML = `<code class="language-javascript">Fetching code from GitHub...</code>`;
  modal.classList.add("active");

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not fetch file contents");
    const code = await res.text();

    let highlighted = escapeHtml(code);
    if (window.hljs) {
      try {
        highlighted = window.hljs.highlight(code, { language: "javascript" }).value;
      } catch(e) {}
    }

    codeContainer.innerHTML = `<code class="language-javascript">${highlighted}</code>`;
    window.currentPreviewCode = code;
  } catch (e) {
    codeContainer.innerHTML = `<code style="color: #ef4444;">Error loading file from GitHub. Please try downloading directly.</code>`;
  }
};

window.copyPreviewCode = function() {
  if (window.currentPreviewCode) {
    navigator.clipboard.writeText(window.currentPreviewCode).then(() => {
      showToast("Library code copied to clipboard!", "success");
    });
  }
};

window.downloadLib = async function(name, url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    showToast(`Downloading ${name}`, "success");
  } catch (e) {
    window.open(url, "_blank");
  }
};

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
