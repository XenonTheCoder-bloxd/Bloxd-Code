'use strict';

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

