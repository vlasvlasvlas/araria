// ── Araria — Game Orchestrator ──
// Manages mode selection and the shared animation loop

(() => {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const modeSelect = document.getElementById("mode-select");
  const controlsBar = document.getElementById("controls-bar");

  let currentMode = null; // "ambient" | "life"
  let w, h;
  let dpr = 1;
  let controlsWired = false;
  let loopStarted = false;

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
    const controlsWrapper = document.getElementById("controls-wrapper");
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

  function startMode(mode) {
    if (currentMode) return;
    currentMode = mode;

    // Fade out selection screen
    modeSelect.classList.add("fade-out");
    setTimeout(() => {
      modeSelect.style.display = "none";
    }, 600);

    // Show controls
    controlsBar.classList.remove("hidden");

    wireAudioControls();

    if (mode === "ambient") {
      AmbientMode.start();
    } else {
      LifeMode.start();
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
      } else {
        LifeMode.tick(t, ctx);
      }

      AudioEngine.tick();

      requestAnimationFrame(anim);
    });
  }
})();
