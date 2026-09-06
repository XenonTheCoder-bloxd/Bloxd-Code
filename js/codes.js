'use strict';

  function initCodes() {
    subscribeCommunityCodes();
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

    const allCodes = communityCodes;
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

    container.innerHTML = filtered.map(c => {
      const canDelete = (currentUser && c.uid && c.uid === currentUser.uid) || isAdminUser;
      return `
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
            ${canDelete ? `<button class="btn btn-secondary" style="font-size:12px;padding:4px 10px;color:#ff8888;" onclick="window.deleteCodeEntry('${c.id}')"><i class="fa-solid fa-trash"></i></button>` : ""}
          </div>
        </div>
      </div>
    `;
    }).join("");
  }

  window.deleteCodeEntry = function(id) {
    const entry = communityCodes.find((c) => c.id === id);
    if (!entry) return;
    if (!confirm("Delete this code? This can't be undone.")) return;

    communityCodes = communityCodes.filter((c) => c.id !== id);
    localStorage.setItem("bloxd_community_codes", JSON.stringify(communityCodes));
    renderCodesGrid(activeCodesCategory);
    renderDashboard();

    apiFetch("/api/codes/delete", { method: "POST", body: JSON.stringify({ codeId: id }) }).catch((err) => {
      console.warn("Failed to delete code from server:", err);
      showToast("Deleted locally, but couldn't remove it from the server.", "error");
    });
  };

  let codesUnsub = null;
  async function loadCommunityCodesFromServer() {
    try {
      const data = await apiFetch("/api/codes/list");
      if (data && Array.isArray(data.codes)) {
        communityCodes = data.codes.map(c => ({
          id: String(c.id),
          uid: c.author_id,
          author: c.author,
          title: c.title,
          description: c.description,
          category: c.category,
          code: c.code,
          image: c.image_url || "",
          timestamp: c.created_at
        }));
        localStorage.setItem("bloxd_community_codes", JSON.stringify(communityCodes));
        renderCodesGrid(activeCodesCategory);
        renderDashboard();
      }
    } catch (e) {
      console.warn("Codes sync error:", e);
    }
  }

  function subscribeCommunityCodes() {
    if (codesUnsub) return;
    loadCommunityCodesFromServer();
    codesUnsub = setInterval(loadCommunityCodesFromServer, 10000);
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

        const imgInput = document.getElementById("upload-code-image-file");

        (async () => {
          try {
            let imageKey = null;
            let imageUrl = "";
            if (imgInput && imgInput.files && imgInput.files[0]) {
              const uploaded = await uploadFile(imgInput.files[0], "codes");
              imageKey = uploaded.key;
              imageUrl = uploaded.url;
            }

            const created = await apiFetch("/api/codes/list", {
              method: "POST",
              body: JSON.stringify({ title, description, category, code, imageKey })
            });

            finalizeCodeUpload({
              id: String(created.id),
              uid: currentUser?.uid || "",
              author: userProfile?.username || "Anonymous",
              title,
              description,
              category,
              code,
              image: imageUrl,
              timestamp: Date.now()
            }, submitBtn, modal);
          } catch (err) {
            showToast(err.message || "Couldn't upload - check your connection.", "error");
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Upload Code`;
          }
        })();
      };
    }
  }

  function finalizeCodeUpload(entry, btn, modal) {
    const allCodes = communityCodes;
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
    const allCodes = communityCodes;
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
    const allCodes = communityCodes;
    const entry = allCodes.find(c => c.id === id);
    if (!entry) return;
    navigator.clipboard.writeText(entry.code).then(() => {
      showToast("Code copied to clipboard!", "success");
    });
  };

  

 
