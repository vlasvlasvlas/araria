// ── Araria — Game Orchestrator ──
// Manages mode selection and the shared animation loop

(() => {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const modeSelect = document.getElementById("mode-select");
  const controlsBar = document.getElementById("controls-bar");
  const controlsWrapper = document.getElementById("controls-wrapper");
  const homeLogo = document.getElementById("homeLogo");
  const modeToast = document.getElementById("mode-toast");

  let currentMode = null; // "ambient" | "life"
  let w, h;
  let dpr = 1;
  let controlsWired = false;
  let loopStarted = false;
  let modeSelectHideTimer = null;
  let modeToastTimer = null;

  function clearBrowserSelection() {
    const selection = window.getSelection?.();
    if (selection && selection.rangeCount > 0) {
      selection.removeAllRanges();
    }
  }

  function shouldSuppressBrowserHold(target) {
    if (!currentMode) return false;
    return !(target instanceof HTMLInputElement);
  }

  function suppressBrowserHold(e) {
    if (!shouldSuppressBrowserHold(e.target)) return;
    e.preventDefault();
    clearBrowserSelection();
  }

  function showModeToast(message) {
    if (!modeToast) return;
    modeToast.textContent = message;
    modeToast.classList.add("visible");
    if (modeToastTimer) {
      clearTimeout(modeToastTimer);
    }
    modeToastTimer = setTimeout(() => {
      modeToast.classList.remove("visible");
      modeToastTimer = null;
    }, 3200);
  }

  function hideModeToast() {
    if (!modeToast) return;
    if (modeToastTimer) {
      clearTimeout(modeToastTimer);
      modeToastTimer = null;
    }
    modeToast.classList.remove("visible");
  }

  // ── Shared audio controls ──
  function wireAudioControls() {
    if (controlsWired) return;
    controlsWired = true;

    document.getElementById("insectVol").addEventListener("input", (e) => {
      AudioEngine.setInsectVol(parseInt(e.target.value, 10));
    });
    document.getElementById("droneVol").addEventListener("input", (e) => {
      AudioEngine.setDroneVol(parseInt(e.target.value, 10));
    });
    document.getElementById("ambiente").addEventListener("input", (e) => {
      AudioEngine.setAmbiente(parseInt(e.target.value, 10));
    });
    document.getElementById("spiderTexture").addEventListener("input", (e) => {
      AudioEngine.setSpiderTexture(parseInt(e.target.value, 10));
    });
    document.getElementById("audioToggle").addEventListener("click", async () => {
      const btn = document.getElementById("audioToggle");
      const playing = await AudioEngine.toggle();
      btn.textContent = playing ? "🔊" : "🔇";
      btn.classList.toggle("active", playing);
    });

    // Menu toggle (mobile)
    const menuToggle = document.getElementById("menuToggle");
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      controlsWrapper.classList.toggle("visible");
    });
    window.addEventListener("click", () => {
      controlsWrapper.classList.remove("visible");
    });
    controlsWrapper.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  function resizeCanvas() {
    const nextW = innerWidth;
    const nextH = innerHeight;
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === nextW && h === nextH && dpr === nextDpr) return;

    w = nextW;
    h = nextH;
    dpr = nextDpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── Mode selection ──
  document.getElementById("btn-ambient").addEventListener("click", () => {
    startMode("ambient");
  });

  document.getElementById("btn-life").addEventListener("click", () => {
    startMode("life");
  });

  homeLogo.addEventListener("click", returnToMenu);
  homeLogo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      returnToMenu();
    }
  });

  document.addEventListener("contextmenu", suppressBrowserHold);
  document.addEventListener("selectstart", suppressBrowserHold);
  document.addEventListener("dragstart", suppressBrowserHold);
  document.addEventListener("touchend", clearBrowserSelection, { passive: true });
  window.addEventListener("blur", clearBrowserSelection);

  function stopCurrentMode() {
    if (currentMode === "ambient") {
      AmbientMode.stop();
    } else if (currentMode === "life") {
      LifeMode.stop();
    }
  }

  function returnToMenu() {
    if (!currentMode) return;

    stopCurrentMode();
    currentMode = null;
    hideModeToast();
    controlsWrapper.classList.remove("visible");
    controlsBar.classList.add("hidden");
    if (modeSelectHideTimer) {
      clearTimeout(modeSelectHideTimer);
      modeSelectHideTimer = null;
    }
    modeSelect.style.display = "flex";
    modeSelect.classList.remove("fade-out");
  }

  function startMode(mode) {
    if (currentMode) return;
    currentMode = mode;

    // Fade out selection screen
    modeSelect.classList.add("fade-out");
    if (modeSelectHideTimer) {
      clearTimeout(modeSelectHideTimer);
    }
    modeSelectHideTimer = setTimeout(() => {
      modeSelect.style.display = "none";
      modeSelectHideTimer = null;
    }, 600);

    // Show controls
    controlsBar.classList.remove("hidden");
    controlsWrapper.classList.remove("visible");

    wireAudioControls();

    if (mode === "ambient") {
      AmbientMode.start();
      showModeToast("Mueve o toca para guiarlas");
    } else {
      LifeMode.start();
      showModeToast("Sostene 1 segundo para crear huevos");
    }

    if (loopStarted) return;
    loopStarted = true;

    // Start animation loop
    requestAnimationFrame(function anim(t) {
      resizeCanvas();

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      t /= 1000;

      if (currentMode === "ambient") {
        AmbientMode.tick(t, ctx);
      } else if (currentMode === "life") {
        LifeMode.tick(t, ctx);
      }

      AudioEngine.tick();

      requestAnimationFrame(anim);
    });
  }
})();
