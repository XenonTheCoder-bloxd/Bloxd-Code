
import { db, collection, addDoc, getDocs, query, orderBy, onSnapshot, serverTimestamp } from "./firebase-config.js";
import { currentUser, userProfile } from "./auth.js";
import { showToast } from "./app.js";

const STARTER_POSTS = [];

let posts = [];
let currentCategory = "all";

 
export function initForum() {
  loadPosts();
  setupForumEvents();
}

 
export async function loadPosts() {
  const localSaved = localStorage.getItem("bloxd_forum_posts");
  posts = localSaved ? JSON.parse(localSaved) : [...STARTER_POSTS];

  if (db) {
    try {
      const q = query(collection(db, "forum_posts"), orderBy("timestamp", "desc"));
      onSnapshot(q, (snapshot) => {
        const fetched = [];
        snapshot.forEach(doc => {
          fetched.push({ id: doc.id, ...doc.data() });
        });
        if (fetched.length > 0) {
          posts = fetched;
          localStorage.setItem("bloxd_forum_posts", JSON.stringify(posts));
        }
        renderForumFeed();
      });
    } catch (e) {
      console.warn("Firestore forum offline fallback:", e);
      renderForumFeed();
    }
  } else {
    renderForumFeed();
  }
}

 
export function parseAndHighlightContent(rawContent) {
  if (!rawContent) return "";

  
  const markdownBlockRegex = /```(javascript|js|html|css|json)?\n([\s\S]*?)```/gi;
  let parsed = rawContent.replace(markdownBlockRegex, (match, lang, code) => {
    const determinedLang = lang || detectLanguage(code);
    return createCodeBoxHtml(code.trim(), determinedLang);
  });

  
  const rawCodePattern = /(?:(?:import\s+.*?from\s+.*|function\s+\w+\s*\(.*?\)|<[a-z][\s\S]*?>|(?:\.[\w-]+\s*\{[\s\S]*?\}))\s*[\s\S]+?)(?=\n\n|\n[A-Z]|$)/g;
  
  
  if (!parsed.includes("code-box-container")) {
    parsed = parsed.replace(rawCodePattern, (codeMatch) => {
      if (codeMatch.trim().length > 25 && (codeMatch.includes("{") || codeMatch.includes("import") || codeMatch.includes("<"))) {
        const lang = detectLanguage(codeMatch);
        return createCodeBoxHtml(codeMatch.trim(), lang);
      }
      return codeMatch;
    });
  }

  
  return parsed.replace(/\n(?!(?:<\/pre>|<\/div>|<div))/g, "<br>");
}

 
function detectLanguage(code) {
  if (/<(!DOCTYPE|html|div|span|p|a|style|script|link|h[1-6]|button)/i.test(code)) {
    return "html";
  }
  if (/(\.[\w-]+\s*\{|#[\w-]+\s*\{|@keyframes|margin:|padding:|background:)/i.test(code)) {
    return "css";
  }
  return "javascript";
}

 
function createCodeBoxHtml(code, language) {
  const codeId = "code_" + Math.random().toString(36).substring(2, 9);
  
  
  let highlighted = escapeHtml(code);
  if (window.hljs) {
    try {
      highlighted = window.hljs.highlight(code, { language: language || "javascript" }).value;
    } catch (e) {
      highlighted = escapeHtml(code);
    }
  }

  return `
    <div class="code-box-container">
      <div class="code-box-header">
        <span class="code-box-lang"><i class="fa-solid fa-code"></i> ${language}</span>
        <button class="copy-code-btn" onclick="copyForumCode('${codeId}')">
          <i class="fa-regular fa-copy"></i> Copy Code
        </button>
      </div>
      <pre class="code-box-pre"><code id="${codeId}" class="language-${language}">${highlighted}</code></pre>
    </div>
  `;
}

function escapeHtml(string) {
  return String(string)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.copyForumCode = function(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    navigator.clipboard.writeText(el.innerText).then(() => {
      showToast("Code copied to clipboard!", "success");
    });
  }
};

 
export function renderForumFeed() {
  const feed = document.getElementById("forum-posts-feed");
  if (!feed) return;

  const filtered = currentCategory === "all" 
    ? posts 
    : posts.filter(p => p.category === currentCategory);

  if (filtered.length === 0) {
    feed.innerHTML = `
      <div class="glass-card" style="text-align: center; padding: 40px;">
        <i class="fa-regular fa-comments" style="font-size: 32px; color: var(--text-dim); margin-bottom: 12px;"></i>
        <h3>No discussions in this category yet</h3>
        <p style="color: var(--text-muted); font-size: 14px;">Be the first Bloxd coder to ask a question or share a library!</p>
      </div>
    `;
    return;
  }

  feed.innerHTML = filtered.map(post => {
    const formattedDate = new Date(post.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const contentHtml = parseAndHighlightContent(post.content);

    return `
      <div class="post-card glass-card" id="post-${post.id}">
        <div class="post-header">
          <div class="post-author">
            <img src="${post.authorAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.author}`}" class="post-avatar" alt="${post.author}">
            <div>
              <strong style="font-size: 14px;">${post.author}</strong>
              <div style="font-size: 11px; color: var(--text-dim);">${formattedDate}</div>
            </div>
          </div>
          <span class="lib-tag">${post.category.toUpperCase()}</span>
        </div>
        
        <h3 class="post-title">${escapeHtml(post.title)}</h3>
        <div class="post-content">${contentHtml}</div>

        ${post.mediaUrl ? `<img src="${post.mediaUrl}" class="post-media-attachment" alt="attachment">` : ""}

        <div class="post-footer">
          <button class="post-action" onclick="upvotePost('${post.id}')">
            <i class="fa-regular fa-heart"></i> <span>${post.upvotes || 0}</span> Upvotes
          </button>
          <button class="post-action" onclick="toggleComments('${post.id}')">
            <i class="fa-regular fa-comment"></i> <span>${(post.comments && post.comments.length) || 0}</span> Comments
          </button>
        </div>

        <div id="comments-section-${post.id}" style="display: none; margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px;">
          <div class="comments-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
            ${(post.comments || []).map(c => `
              <div style="background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 6px; font-size: 13px;">
                <strong style="color: var(--accent-primary);">${escapeHtml(c.author)}:</strong> ${escapeHtml(c.content)}
              </div>
            `).join("")}
          </div>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="comment-input-${post.id}" class="form-input" placeholder="Write a reply..." style="padding: 6px 10px; font-size: 12px;">
            <button class="btn btn-primary" onclick="addComment('${post.id}')" style="padding: 6px 14px; font-size: 12px;">Reply</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

window.upvotePost = function(postId) {
  const post = posts.find(p => p.id === postId);
  if (post) {
    post.upvotes = (post.upvotes || 0) + 1;
    localStorage.setItem("bloxd_forum_posts", JSON.stringify(posts));
    renderForumFeed();
    showToast("Upvoted post!", "success");
  }
};

window.toggleComments = function(postId) {
  const section = document.getElementById(`comments-section-${postId}`);
  if (section) {
    section.style.display = section.style.display === "none" ? "block" : "none";
  }
};

window.addComment = function(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input || !input.value.trim()) return;

  const post = posts.find(p => p.id === postId);
  if (post) {
    if (!post.comments) post.comments = [];
    post.comments.push({
      author: userProfile?.username || "Guest Coder",
      content: input.value.trim(),
      timestamp: Date.now()
    });
    input.value = "";
    localStorage.setItem("bloxd_forum_posts", JSON.stringify(posts));
    renderForumFeed();
    showToast("Comment posted!", "success");
  }
};

 
function setupForumEvents() {
  
  const tabs = document.querySelectorAll(".category-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentCategory = tab.getAttribute("data-category") || "all";
      renderForumFeed();
    });
  });

  
  const searchInput = document.getElementById("forum-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      const feed = document.getElementById("forum-posts-feed");
      if (!feed) return;

      const filtered = posts.filter(p => 
        p.title.toLowerCase().includes(q) || 
        p.content.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q)
      );

      if (filtered.length === 0) {
        feed.innerHTML = `<div class="glass-card" style="text-align: center; padding: 30px;">No matching discussions found.</div>`;
      } else {
        feed.innerHTML = filtered.map(p => parseAndHighlightContent(p.content));
        renderForumFeed();
      }
    });
  }

  
  const submitPostBtn = document.getElementById("submit-new-post-btn");
  if (submitPostBtn) {
    submitPostBtn.onclick = async () => {
      const title = document.getElementById("new-post-title")?.value?.trim();
      const category = document.getElementById("new-post-category")?.value || "questions";
      const content = document.getElementById("new-post-content")?.value?.trim();
      const mediaInput = document.getElementById("new-post-media-file");

      if (!title || !content) {
        showToast("Please provide both a title and content.", "error");
        return;
      }

      let mediaUrl = "";
      if (mediaInput && mediaInput.files && mediaInput.files[0]) {
        const file = mediaInput.files[0];
        mediaUrl = await readFileAsDataUrl(file);
      }

      const newPost = {
        id: "post_" + Date.now(),
        author: userProfile?.username || "Guest Coder",
        authorAvatar: userProfile?.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=bloxd",
        title,
        category,
        content,
        timestamp: Date.now(),
        upvotes: 1,
        comments: [],
        mediaUrl
      };

      if (db) {
        try {
          await addDoc(collection(db, "forum_posts"), newPost);
        } catch (e) {
          console.warn("Could not save post to Firestore:", e);
        }
      }

      posts.unshift(newPost);
      localStorage.setItem("bloxd_forum_posts", JSON.stringify(posts));

      
      document.getElementById("new-post-title").value = "";
      document.getElementById("new-post-content").value = "";
      if (mediaInput) mediaInput.value = "";
      
      document.getElementById("new-post-modal")?.classList.remove("active");
      renderForumFeed();
      showToast("Discussion posted to forum!", "success");
    };
  }

  
  const mediaInput = document.getElementById("new-post-media-file");
  if (mediaInput) {
    mediaInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        showToast(`File selected: ${e.target.files[0].name}`, "info");
      }
    });
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}
