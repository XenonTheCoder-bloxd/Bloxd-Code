'use strict';

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

