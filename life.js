// ── Araria — Life Mode ──
// Egg → Baby → Young → Adult → Old → Dead

const LifeMode = (() => {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const { sin, cos, PI, hypot, min, max } = Math;

  let active = false;
  let entities = [];
  let mouseX = innerWidth / 2;
  let mouseY = innerHeight / 2;
  let followSpeed = 50;

  let holdStartTime = 0;
  let isHolding = false;
  let holdPointerId = null;
  let holdX = 0;
  let holdY = 0;
  let lastHoldPulseAt = 0;
  const HOLD_DURATION = 1;
  const HOLD_MOVE_TOLERANCE = 18;
  const HOLD_EGG_RADIUS = 12;
  const YOUNG_GROWTH = 0.26;
  const ADULT_GROWTH = 0.72;
  const OLD_AGE_RATIO = 0.72;
  const STARVING_TO_OLD = 10;
  const STARVING_TO_DEAD = 18;

  // ── Life stage config ──
  const STAGES = {
    egg:   { duration: 4, size: 0.15, speed: 0,    texture: 0.80, legs: 0 },
    baby:  { size: 0.16, speed: 0.55, texture: 0.82, legs: 4 },
    young: { size: 0.5,  speed: 0.85, texture: 0.66, legs: 6 },
    adult: { size: 1.0,  speed: 1.1,  texture: 0.50, legs: 8 },
    old:   { size: 0.78, speed: 0.55, texture: 0.22, legs: 8 },
  };
  const FEED_RADIUS = 100;
  const FEED_RATE = 0.34;

  // ── Egg ──
  function createEgg(x, y) {
    return {
      type: "egg",
      x,
      y,
      age: 0,
      hatchDuration: STAGES.egg.duration + rnd(2, -1),
    };
  }

  function updateFollowers(x, y) {
    mouseX = x;
    mouseY = y;
    entities.forEach((ent) => {
      if (ent.type === "spider" && ent.follow) {
        ent.follow(x, y);
      }
    });
  }

  function cancelHold(pointerId = holdPointerId) {
    if (holdPointerId !== null && pointerId !== holdPointerId) return;
    isHolding = false;
    holdPointerId = null;
    lastHoldPulseAt = 0;
  }

  function placeEgg(x, y) {
    entities.push(createEgg(x, y));
    AudioEngine.playEggPlace(x, y);
  }

  // ── Spider (Life) ──
  function createSpider(x, y) {
    const genes = {
      maxSize: 0.8 + rnd(0.4),
      speedMul: 0.7 + rnd(0.6),
      voracidad: 0.8 + rnd(0.4),
      lifetime: 280 + rnd(220),
    };

    const pts = many(333, () => ({
      x: rnd(innerWidth),
      y: rnd(innerHeight),
      len: 0,
      r: 0,
      _wasActive: false,
    }));

    const pts2 = many(9, (i) => ({
      x: cos((i / 9) * PI * 2),
      y: sin((i / 9) * PI * 2),
    }));

    let seed = rnd(100);
    let sx = x;
    let sy = y;
    let tx = x;
    let ty = y;
    let kx = rnd(0.5, 0.5);
    let ky = rnd(0.5, 0.5);
    let walkRadius = pt(rnd(150, 100), rnd(150, 100));
    const bodyRadius = innerWidth / rnd(100, 150);

    return {
      type: "spider",
      genes,
      age: 0,
      nutrition: 0.5,
      growth: 0,
      starvingTime: 0,
      isFeeding: false,
      distToCursor: Infinity,
      stage: "baby",
      hatchAge: 0,
      hatchDuration: 0.9,
      opacity: 1,
      deathTimer: 0,
      get x() { return sx; },
      get y() { return sy; },

      getStageConfig() {
        return STAGES[this.stage] || STAGES.baby;
      },

      getTexture() {
        return this.getStageConfig().texture;
      },

      getSizeMul() {
        return this.getStageConfig().size * this.genes.maxSize;
      },

      getHatchProgress() {
        return min(this.hatchAge / this.hatchDuration, 1);
      },

      refreshStage() {
        const prevStage = this.stage;
        const oldAge = this.genes.lifetime * OLD_AGE_RATIO;

        if (this.age >= this.genes.lifetime || this.starvingTime >= STARVING_TO_DEAD) {
          this.stage = "dead";
        } else if (this.age >= oldAge || this.starvingTime >= STARVING_TO_OLD) {
          this.stage = "old";
        } else if (this.growth >= ADULT_GROWTH) {
          this.stage = "adult";
        } else if (this.growth >= YOUNG_GROWTH) {
          this.stage = "young";
        } else {
          this.stage = "baby";
        }

        if (this.stage === "dead" && prevStage !== "dead") {
          AudioEngine.playDeath(sx, sy);
        }
      },

      tick(t, dt) {
        if (this.stage === "dead") return;

        this.hatchAge += dt;
        const distToCursor = hypot(sx - mouseX, sy - mouseY);
        this.distToCursor = distToCursor;
        this.isFeeding = distToCursor < FEED_RADIUS;

        if (this.isFeeding) {
          this.nutrition = min(this.nutrition + FEED_RATE * this.genes.voracidad * dt, 1);
          this.growth = min(this.growth + (0.16 + this.nutrition * 0.34) * this.genes.voracidad * dt, 1);
          this.starvingTime = max(0, this.starvingTime - dt * 1.1);
        } else {
          this.nutrition = max(0, this.nutrition - 0.12 * dt);
          this.starvingTime += (0.18 + (1 - this.nutrition) * 0.95) * dt;
        }

        this.age += dt * (0.16 + (1 - this.nutrition) * 0.48 + (this.isFeeding ? 0.03 : 0.2));
        this.refreshStage();

        if (this.stage === "dead") return;

        const cfg = this.getStageConfig();
        const speedFactor = cfg.speed * this.genes.speedMul;
        if (speedFactor > 0) {
          const gaitMul = 0.35 + speedFactor * 0.85;
          const selfMoveX = cos(t * kx + seed) * walkRadius.x * gaitMul;
          const selfMoveY = sin(t * ky + seed) * walkRadius.y * gaitMul;
          const fx = tx + selfMoveX;
          const fy = ty + selfMoveY;

          sx += (fx - sx) / followSpeed;
          sy += (fy - sy) / followSpeed;
        }

        const hatchProgress = this.getHatchProgress();
        const hatchEase = 1 - (1 - hatchProgress) ** 3;
        const lifeGrowth = min(this.growth / ADULT_GROWTH, 1);
        const visualMaturity = min(hatchEase * (0.2 + lifeGrowth * 0.8), 1);
        const sizeMul = this.getSizeMul() * lerp(0.08, 1, hatchEase);
        const r = bodyRadius * sizeMul;
        let i = 0;
        const baseLegLimit = cfg.legs;
        const legLimit = min(baseLegLimit, max(2, Math.floor(2 + (baseLegLimit - 2) * visualMaturity)));
        const searchRadius = lerp(innerWidth / 34, innerWidth / 10, visualMaturity);
        const dotScale = max(0.16, sizeMul);

        pts.forEach((p, idx) => {
          const dx = p.x - sx;
          const dy = p.y - sy;
          const len = hypot(dx, dy) || 1;
          let cr = min(2, innerWidth / len / 5) * dotScale;
          const increasing = len < searchRadius && i++ < legLimit;

          if (increasing) cr *= 1.5;
          p.r = cr;
          p.len = max(0, min(p.len + (increasing ? 0.1 : -0.1), 1));

          if (increasing && !p._wasActive) {
            AudioEngine.legClickLife(p.x, p.y, idx % 9, this.getTexture(), sizeMul);
          }
          p._wasActive = increasing;

          if (this.opacity < 1) ctx.globalAlpha = max(0, this.opacity);
          pts2.forEach((pt2) => {
            if (!p.len) return;
            drawLine(
              ctx,
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

      follow(fx, fy) {
        tx = fx;
        ty = fy;
      },
    };
  }

  // ── Egg rendering ──
  function renderEgg(egg, t) {
    const pulse = 0.9 + sin(t * 4) * 0.1;
    const progress = min(egg.age / egg.hatchDuration, 1);
    const r = HOLD_EGG_RADIUS * pulse;

    ctx.save();
    ctx.globalAlpha = 0.2 + progress * 0.35;
    ctx.fillStyle = `hsl(${280 + progress * 20}, 55%, ${50 + progress * 10}%)`;
    drawCircle(ctx, egg.x, egg.y, r * 1.7);
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 0.88;
    drawCircle(ctx, egg.x, egg.y, r);
    ctx.restore();

    if (AudioEngine.isPlaying() && Math.random() < 0.004) {
      AudioEngine.playEggPulse(egg.x, egg.y);
    }
  }

  // ── Main tick ──
  let lastT = 0;
  function tick(t, canvasCtx) {
    if (!active) return;
    const dt = lastT ? t - lastT : 0.016;
    lastT = t;

    canvasCtx.fillStyle = canvasCtx.strokeStyle = "#fff";

    if (isHolding) {
      const heldTime = t - holdStartTime;
      const progress = min(heldTime / HOLD_DURATION, 1);
      const r = lerp(2, HOLD_EGG_RADIUS, progress);

      ctx.save();
      ctx.globalAlpha = 0.15 + progress * 0.35;
      ctx.fillStyle = `hsl(${280 - progress * 30}, 55%, ${42 + progress * 18}%)`;
      drawCircle(ctx, holdX, holdY, r * 2);
      ctx.fillStyle = "#fff";
      ctx.globalAlpha = 0.55 + progress * 0.35;
      drawCircle(ctx, holdX, holdY, r);
      ctx.lineWidth = 2;
      ctx.strokeStyle = `hsla(${280 - progress * 30}, 85%, 70%, ${0.25 + progress * 0.55})`;
      ctx.beginPath();
      ctx.arc(holdX, holdY, HOLD_EGG_RADIUS + 6, -PI / 2, -PI / 2 + PI * 2 * progress);
      ctx.stroke();
      ctx.restore();

      if (AudioEngine.isPlaying() && t - lastHoldPulseAt >= 1.2) {
        AudioEngine.playEggPulse(holdX, holdY);
        lastHoldPulseAt = t;
      }

      if (progress >= 1) {
        placeEgg(holdX, holdY);
        cancelHold();
      }
    }

    for (let i = entities.length - 1; i >= 0; i--) {
      const ent = entities[i];

      if (ent.type === "egg") {
        const hatchBoost = hypot(ent.x - mouseX, ent.y - mouseY) < FEED_RADIUS ? 2.4 : 1;
        ent.age += dt * hatchBoost;
        renderEgg(ent, t);

        if (ent.age >= ent.hatchDuration) {
          const spider = createSpider(ent.x, ent.y);
          spider.follow(mouseX, mouseY);
          entities[i] = spider;
          AudioEngine.playHatch(ent.x, ent.y);
        }
        continue;
      }

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

  function onPointerDown(e) {
    if (!active || !e.isPrimary || isUiEventTarget(e.target)) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.cancelable) e.preventDefault();

    updateFollowers(e.clientX, e.clientY);
    isHolding = true;
    holdPointerId = e.pointerId;
    holdStartTime = performance.now() / 1000;
    holdX = e.clientX;
    holdY = e.clientY;
    lastHoldPulseAt = holdStartTime;
  }

  function onPointerMove(e) {
    if (!active || !e.isPrimary) return;
    if (isHolding && e.pointerId === holdPointerId) {
      const dist = hypot(e.clientX - holdX, e.clientY - holdY);
      if (dist > HOLD_MOVE_TOLERANCE) {
        cancelHold(e.pointerId);
      }
    }

    if (isUiEventTarget(e.target)) return;
    if (e.cancelable) e.preventDefault();

    updateFollowers(e.clientX, e.clientY);
  }

  function onPointerUp(e) {
    cancelHold(e.pointerId);
  }

  function onPointerCancel(e) {
    cancelHold(e.pointerId);
  }

  function onWindowBlur() {
    cancelHold();
  }

  function onSpeedInput(e) {
    followSpeed = parseInt(e.target.value, 10);
    document.getElementById("followSpeedVal").textContent = followSpeed;
  }

  function start() {
    active = true;
    entities = [];
    lastT = 0;
    followSpeed = parseInt(document.getElementById("followSpeed").value, 10);
    mouseX = innerWidth / 2;
    mouseY = innerHeight / 2;
    cancelHold();
    document.querySelectorAll(".ambient-only").forEach(el => el.style.display = "none");

    document.getElementById("followSpeedVal").textContent = followSpeed;
    document.getElementById("followSpeed").addEventListener("input", onSpeedInput);

    addEventListener("pointerdown", onPointerDown);
    addEventListener("pointermove", onPointerMove);
    addEventListener("pointerup", onPointerUp);
    addEventListener("pointercancel", onPointerCancel);
    addEventListener("blur", onWindowBlur);
  }

  function stop() {
    active = false;
    entities = [];
    document.getElementById("followSpeed").removeEventListener("input", onSpeedInput);
    removeEventListener("pointerdown", onPointerDown);
    removeEventListener("pointermove", onPointerMove);
    removeEventListener("pointerup", onPointerUp);
    removeEventListener("pointercancel", onPointerCancel);
    removeEventListener("blur", onWindowBlur);
    cancelHold();
  }

  return { start, stop, tick, get active() { return active; } };
})();
