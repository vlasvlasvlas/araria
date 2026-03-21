// ── Araria — Game Orchestrator ──
// Manages mode selection and the shared animation loop

(() => {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const modeSelect = document.getElementById("mode-select");
  const controlsBar = document.getElementById("controls-bar");

  let currentMode = null; // "ambient" | "life"
  let w, h;

  // ── Shared audio controls ──
  function wireAudioControls() {
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

  // ── Mode selection ──
  document.getElementById("btn-ambient").addEventListener("click", () => {
    startMode("ambient");
  });

  document.getElementById("btn-life").addEventListener("click", () => {
    startMode("life");
  });

  function startMode(mode) {
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

    // Start animation loop
    requestAnimationFrame(function anim(t) {
      if (w !== innerWidth) w = canvas.width = innerWidth;
      if (h !== innerHeight) h = canvas.height = innerHeight;

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
