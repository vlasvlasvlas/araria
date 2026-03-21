// ── Araria — Life Mode ──
// Egg → Baby → Young → Adult → Old → Dead

const LifeMode = (() => {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const { sin, cos, PI, hypot, min, max } = Math;

  let active = false;
  let entities = []; // eggs + spiders
  let mouseX = innerWidth / 2;
  let mouseY = innerHeight / 2;
  let followSpeed = 50;

  // ── Life stage config ──
  const STAGES = {
    egg:   { duration: 5,   size: 0.15, speed: 0,   texture: 0.80 },
    baby:  { duration: 45,  size: 0.3,  speed: 0.3, texture: 0.80 },
    young: { duration: 50,  size: 0.6,  speed: 0.7, texture: 0.65 },
    adult: { duration: 60,  size: 1.0,  speed: 1.0, texture: 0.50 },
    old:   { duration: 40,  size: 0.8,  speed: 0.4, texture: 0.20 },
  };
  const STAGE_ORDER = ["egg", "baby", "young", "adult", "old", "dead"];
  const FEED_RADIUS = 80;
  const FEED_RATE = 0.15; // nutrition per second when near cursor

  // ── Egg ──
  function createEgg(x, y) {
    return {
      type: "egg",
      x, y,
      age: 0,
      birthTime: 0, // set when tick starts
      hatchDuration: STAGES.egg.duration + rnd(2, -1),
      pulsing: 0,
    };
  }

  // ── Spider (Life) ──
  function createSpider(x, y) {
    // Genetics
    const genes = {
      maxSize: 0.8 + rnd(0.4),
      speedMul: 0.7 + rnd(0.6),
      voracidad: 0.8 + rnd(0.4),
      lifetime: 150 + rnd(150),
    };

    const pts = many(333, () => ({
      x: x + rnd(10, -5),
      y: y + rnd(10, -5),
      len: 0,
      r: 0,
      _wasActive: false,
    }));

    const pts2 = many(9, (i) => ({
      x: cos((i / 9) * PI * 2),
      y: sin((i / 9) * PI * 2),
    }));

    let seed = rnd(100);
    let sx = x, sy = y;
    let tx = x, ty = y;
    let kx = rnd(0.5, 0.5);
    let ky = rnd(0.5, 0.5);
    let walkRadius = pt(rnd(80, 40), rnd(80, 40));

    return {
      type: "spider",
      genes,
      age: 0,          // seconds alive
      nutrition: 0,     // accumulated food
      stage: "baby",
      stageTime: 0,     // time in current stage
      opacity: 1,
      deathTimer: 0,
      get x() { return sx; },
      get y() { return sy; },

      getStageConfig() {
        return STAGES[this.stage] || STAGES.baby;
      },

      getTexture() {
        // Interpolate between current and next stage texture
        const cfg = this.getStageConfig();
        return cfg.texture;
      },

      getSizeMul() {
        const cfg = this.getStageConfig();
        return cfg.size * this.genes.maxSize;
      },

      tick(t, dt) {
        if (this.stage === "dead") return;

        this.age += dt;
        this.stageTime += dt;

        // Check if near cursor → feed
        const distToCursor = hypot(sx - mouseX, sy - mouseY);
        if (distToCursor < FEED_RADIUS && this.stage !== "egg") {
          this.nutrition += FEED_RATE * this.genes.voracidad * dt;
        }

        // Stage progression
        const cfg = this.getStageConfig();
        const stageDur = cfg.duration * (1 - min(this.nutrition * 0.1, 0.3)); // food speeds up growth slightly
        if (this.stageTime >= stageDur) {
          this.advanceStage();
        }

        // Movement
        const speedFactor = cfg.speed * this.genes.speedMul;
        if (speedFactor > 0) {
          const selfMoveX = cos(t * kx + seed) * walkRadius.x * cfg.size;
          const selfMoveY = sin(t * ky + seed) * walkRadius.y * cfg.size;
          let fx = tx + selfMoveX;
          let fy = ty + selfMoveY;

          const moveSpeed = followSpeed / speedFactor;
          sx += (fx - sx) / max(moveSpeed, 5);
          sy += (fy - sy) / max(moveSpeed, 5);
        }

        // Render
        const sizeMul = this.getSizeMul();
        const r = (innerWidth / rnd(100, 150)) * sizeMul;

        let i = 0;
        const legLimit = this.stage === "baby" ? 4 : this.stage === "young" ? 6 : 8;

        pts.forEach((p, idx) => {
          const dx = p.x - sx;
          const dy = p.y - sy;
          const len = hypot(dx, dy);
          let cr = min(2, innerWidth / len / 5) * sizeMul;
          const increasing = len < (innerWidth / 10) * sizeMul && i++ < legLimit;
          let dir = increasing ? 0.1 : -0.1;
          if (increasing) cr *= 1.5;
          p.r = cr;
          p.len = max(0, min(p.len + dir, 1));

          // Sound
          if (increasing && !p._wasActive) {
            const tex = this.getTexture();
            AudioEngine.legClickLife(p.x, p.y, idx % 9, tex, sizeMul);
          }
          p._wasActive = increasing;

          // Paint
          if (this.opacity < 1) ctx.globalAlpha = max(0, this.opacity);

          pts2.forEach((pt2) => {
            if (!p.len) return;
            drawLine(ctx,
              lerp(sx + pt2.x * r, p.x, p.len * p.len),
              lerp(sy + pt2.y * r, p.y, p.len * p.len),
              sx + pt2.x * r,
              sy + pt2.y * r
            );
          });
          drawCircle(ctx, p.x, p.y, p.r);

          if (this.opacity < 1) ctx.globalAlpha = 1;
        });
      },

      advanceStage() {
        const idx = STAGE_ORDER.indexOf(this.stage);
        if (idx < STAGE_ORDER.length - 1) {
          this.stage = STAGE_ORDER[idx + 1];
          this.stageTime = 0;
          if (this.stage === "dead") {
            AudioEngine.playDeath(sx, sy);
          }
        }
      },

      follow(fx, fy) {
        tx = fx;
        ty = fy;
      },
    };
  }

  // ── Egg rendering ──
  function renderEgg(egg, t) {
    const pulse = 0.8 + sin(t * 4) * 0.2; // Gentle pulsing
    const r = 6 * pulse;
    const progress = egg.age / egg.hatchDuration;

    // Glow
    ctx.save();
    ctx.globalAlpha = 0.3 + progress * 0.4;
    ctx.fillStyle = `hsl(${280 + progress * 40}, 60%, ${50 + pulse * 20}%)`;
    drawCircle(ctx, egg.x, egg.y, r * 2);
    ctx.restore();

    // Core
    ctx.fillStyle = "#fff";
    drawCircle(ctx, egg.x, egg.y, r);

    // Pulse sound
    if (AudioEngine.isPlaying() && Math.random() < 0.005) {
      AudioEngine.playEggPulse(egg.x, egg.y);
    }
  }

  // ── Click to place egg ──
  function onClick(e) {
    if (!active) return;
    const egg = createEgg(e.clientX, e.clientY);
    entities.push(egg);
    AudioEngine.playEggPlace(e.clientX, e.clientY);
  }

  function onMove(e) {
    if (!active) return;
    mouseX = e.clientX;
    mouseY = e.clientY;
    entities.forEach(ent => {
      if (ent.type === "spider" && ent.follow) {
        ent.follow(e.clientX, e.clientY);
      }
    });
  }

  // ── Main tick ──
  let lastT = 0;
  function tick(t, canvasCtx) {
    if (!active) return;
    const dt = lastT ? t - lastT : 0.016;
    lastT = t;

    canvasCtx.fillStyle = canvasCtx.strokeStyle = "#fff";

    // Process entities
    for (let i = entities.length - 1; i >= 0; i--) {
      const ent = entities[i];

      if (ent.type === "egg") {
        ent.age += dt;
        renderEgg(ent, t);

        // Hatch!
        if (ent.age >= ent.hatchDuration) {
          const spider = createSpider(ent.x, ent.y);
          spider.follow(mouseX, mouseY);
          entities[i] = spider;
          AudioEngine.playHatch(ent.x, ent.y);
        }
      } else if (ent.type === "spider") {
        if (ent.stage === "dead") {
          ent.deathTimer += dt;
          ent.opacity = max(0, 1 - ent.deathTimer / 2);
          if (ent.deathTimer > 2) {
            entities.splice(i, 1);
            continue;
          }
        }
        ent.tick(t, dt);
      }
    }
  }

  function start() {
    active = true;
    entities = [];
    lastT = 0;

    // Hide ambient-only controls
    document.querySelectorAll(".ambient-only").forEach(el => el.style.display = "none");

    // Wire speed slider
    document.getElementById("followSpeed").addEventListener("input", (e) => {
      followSpeed = parseInt(e.target.value, 10);
      document.getElementById("followSpeedVal").textContent = followSpeed;
    });

    addEventListener("pointerdown", onClick);
    addEventListener("pointermove", onMove);
  }

  function stop() {
    active = false;
    entities = [];
    removeEventListener("pointerdown", onClick);
    removeEventListener("pointermove", onMove);
  }

  return { start, stop, tick, get active() { return active; } };
})();
