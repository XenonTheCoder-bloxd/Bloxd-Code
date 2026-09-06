'use strict';

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

  

 
