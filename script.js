// ── Araria — Spider Cursor Animation ──

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const { sin, cos, PI, hypot, min, max, floor, random } = Math;

// ── State ──
let w, h;
let followSpeed = 50;
let spiderCount = 2;
let spiders = [];
let mouseX = innerWidth / 2;
let mouseY = innerHeight / 2;

// ── Visual Controls ──
const countSlider = document.getElementById("spiderCount");
const countVal = document.getElementById("spiderCountVal");
const speedSlider = document.getElementById("followSpeed");
const speedVal = document.getElementById("followSpeedVal");

countSlider.addEventListener("input", (e) => {
  const n = parseInt(e.target.value, 10);
  countVal.textContent = n;
  setSpiderCount(n);
});

speedSlider.addEventListener("input", (e) => {
  followSpeed = parseInt(e.target.value, 10);
  speedVal.textContent = followSpeed;
});

// ── Audio Controls (no value badges — just emoji + slider) ──
document.getElementById("insectVol").addEventListener("input", (e) => {
  AudioEngine.setInsectVol(parseInt(e.target.value, 10));
});
document.getElementById("droneVol").addEventListener("input", (e) => {
  AudioEngine.setDroneVol(parseInt(e.target.value, 10));
});
document.getElementById("ambiente").addEventListener("input", (e) => {
  AudioEngine.setAmbiente(parseInt(e.target.value, 10));
});

document.getElementById("audioToggle").addEventListener("click", async () => {
  const btn = document.getElementById("audioToggle");
  const playing = await AudioEngine.toggle();
  btn.textContent = playing ? "🔊" : "🔇";
  btn.classList.toggle("active", playing);
});

// ── Spider management ──
function setSpiderCount(n) {
  spiderCount = n;
  while (spiders.length < n) {
    const s = spawn();
    s.follow(mouseX, mouseY);
    spiders.push(s);
  }
  while (spiders.length > n) {
    spiders.pop();
  }
}

// ── Spider factory ──
function spawn() {
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
  let tx = rnd(innerWidth);
  let ty = rnd(innerHeight);
  let x = rnd(innerWidth);
  let y = rnd(innerHeight);
  let kx = rnd(0.5, 0.5);
  let ky = rnd(0.5, 0.5);
  let walkRadius = pt(rnd(150, 100), rnd(150, 100));
  let r = innerWidth / rnd(100, 150);

  function paintPt(p) {
    pts2.forEach((pt2) => {
      if (!p.len) return;
      drawLine(
        lerp(x + pt2.x * r, p.x, p.len * p.len),
        lerp(y + pt2.y * r, p.y, p.len * p.len),
        x + pt2.x * r,
        y + pt2.y * r
      );
    });
    drawCircle(p.x, p.y, p.r);
  }

  return {
    get x() { return x; },
    get y() { return y; },

    follow(fx, fy) {
      tx = fx;
      ty = fy;
    },

    tick(t) {
      const selfMoveX = cos(t * kx + seed) * walkRadius.x;
      const selfMoveY = sin(t * ky + seed) * walkRadius.y;
      let fx = tx + selfMoveX;
      let fy = ty + selfMoveY;

      x += (fx - x) / followSpeed;
      y += (fy - y) / followSpeed;

      let i = 0;
      pts.forEach((p, idx) => {
        const dx = p.x - x;
        const dy = p.y - y;
        const len = hypot(dx, dy);
        let cr = min(2, innerWidth / len / 5);
        const increasing = len < innerWidth / 10 && i++ < 8;
        let dir = increasing ? 0.1 : -0.1;
        if (increasing) cr *= 1.5;
        p.r = cr;
        p.len = max(0, min(p.len + dir, 1));

        // ── Sound = leg stepping down ──
        if (increasing && !p._wasActive) {
          AudioEngine.legClick(p.x, p.y, idx % 9);
        }
        p._wasActive = increasing;

        paintPt(p);
      });
    },
  };
}

// ── Init ──
setSpiderCount(spiderCount);

// ── Pointer tracking ──
addEventListener("pointermove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  spiders.forEach((spider) => spider.follow(e.clientX, e.clientY));
});

// ── Animation loop ──
requestAnimationFrame(function anim(t) {
  if (w !== innerWidth) w = canvas.width = innerWidth;
  if (h !== innerHeight) h = canvas.height = innerHeight;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = ctx.strokeStyle = "#fff";
  t /= 1000;
  spiders.forEach((spider) => spider.tick(t));

  AudioEngine.tick();

  requestAnimationFrame(anim);
});

// ── Utilities ──

function rnd(x = 1, dx = 0) {
  return Math.random() * x + dx;
}

function drawCircle(x, y, r) {
  ctx.beginPath();
  ctx.ellipse(x, y, r, r, 0, 0, PI * 2);
  ctx.fill();
}

function drawLine(x0, y0, x1, y1) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  many(100, (i) => {
    i = (i + 1) / 100;
    let x = lerp(x0, x1, i);
    let y = lerp(y0, y1, i);
    let k = noise(x / 5 + x0, y / 5 + y0) * 2;
    ctx.lineTo(x + k, y + k);
  });
  ctx.stroke();
}

function many(n, f) {
  return [...Array(n)].map((_, i) => f(i));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function noise(x, y, t = 101) {
  let w0 = sin(0.3 * x + 1.4 * t + 2.0 + 2.5 * sin(0.4 * y + -1.3 * t + 1.0));
  let w1 = sin(0.2 * y + 1.5 * t + 2.8 + 2.3 * sin(0.5 * x + -1.2 * t + 0.5));
  return w0 + w1;
}

function pt(x, y) {
  return { x, y };
}