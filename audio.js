// ── Araria — Audio Engine v4 ──
// Velocity-based leg clicking + ambient drone + combined reverb/delay

const AudioEngine = (() => {
  let audioCtx = null;
  let started = false;

  // Nodes
  let masterGain, dryGain;
  let delayNode, feedbackGain, delayWet, delayFilter;
  let convolver, reverbGain;
  let droneOsc1, droneOsc2, droneSub, droneGain, droneOuterGain;
  let noiseBuffer, clipper;

  // Params
  let insectVol = 80;
  let droneVol = 0;
  let ambienteLevel = 40;

  function init() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // ── Noise buffer (1s) ──
    const len = audioCtx.sampleRate;
    noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // ── Synthetic cave IR (3s) ──
    const irLen = Math.floor(audioCtx.sampleRate * 3);
    const irBuf = audioCtx.createBuffer(2, irLen, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const ir = irBuf.getChannelData(ch);
      let p = 0;
      for (let i = 0; i < irLen; i++) {
        const t = i / audioCtx.sampleRate;
        const raw = (Math.random() * 2 - 1) * Math.exp(-t * 1.5) * (1 - t / 3.5);
        ir[i] = p = p * 0.75 + raw * 0.25;
      }
    }

    // ═══ Master Processing (Soft-Clipper for Loudness) ═══
    function makeDistortionCurve(amount) {
      const k = typeof amount === 'number' ? amount : 50;
      const n_samples = 44100;
      const curve = new Float32Array(n_samples);
      const deg = Math.PI / 180;
      for (let i = 0 ; i < n_samples; ++i ) {
        const x = i * 2 / n_samples - 1;
        curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
      }
      return curve;
    }

    clipper = audioCtx.createWaveShaper();
    clipper.curve = makeDistortionCurve(40);
    clipper.oversample = '4x';

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 4.0; // PUSH IT LOUD
    
    clipper.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    dryGain = audioCtx.createGain();
    dryGain.gain.value = 1.0;
    dryGain.connect(clipper);

    // ═══ Delay ═══
    delayNode = audioCtx.createDelay(3.0);
    delayNode.delayTime.value = 0.3;
    delayFilter = audioCtx.createBiquadFilter();
    delayFilter.type = "lowpass";
    delayFilter.frequency.value = 2500;
    feedbackGain = audioCtx.createGain();
    feedbackGain.gain.value = 0.15;
    delayWet = audioCtx.createGain();
    delayWet.gain.value = 0.2;

    delayNode.connect(delayFilter);
    delayFilter.connect(feedbackGain);
    feedbackGain.connect(delayNode);
    feedbackGain.connect(delayWet);
    delayWet.connect(clipper);

    // ═══ Reverb ═══
    convolver = audioCtx.createConvolver();
    convolver.buffer = irBuf;
    reverbGain = audioCtx.createGain();
    reverbGain.gain.value = 0.25;
    convolver.connect(reverbGain);
    reverbGain.connect(clipper);

    // ═══ Drone ═══
    // Inner gain (modulated by cave texture) → Outer gain (user volume control)
    droneGain = audioCtx.createGain();
    droneGain.gain.value = 0.1;
    droneOuterGain = audioCtx.createGain();
    droneOuterGain.gain.value = 0; // OFF by default
    droneGain.connect(droneOuterGain);
    droneOuterGain.connect(dryGain);
    droneOuterGain.connect(convolver);

    droneOsc1 = audioCtx.createOscillator();
    droneOsc1.type = "sine";
    droneOsc1.frequency.value = 58;
    droneOsc1.connect(droneGain);
    droneOsc1.start();

    droneOsc2 = audioCtx.createOscillator();
    droneOsc2.type = "sine";
    droneOsc2.frequency.value = 63;
    droneOsc2.connect(droneGain);
    droneOsc2.start();

    // Water drip / cave texture oscillator
    const caveOsc = audioCtx.createOscillator();
    caveOsc.type = "triangle";
    caveOsc.frequency.value = 180;
    const caveMod = audioCtx.createOscillator();
    caveMod.type = "sine";
    caveMod.frequency.value = 0.3; // very slow modulation
    const caveModGain = audioCtx.createGain();
    caveModGain.gain.value = 0.03;
    caveMod.connect(caveModGain);
    caveModGain.connect(droneGain.gain); // subtle amplitude mod
    caveOsc.connect(droneGain);
    caveOsc.start();
    caveMod.start();

    droneSub = audioCtx.createOscillator();
    droneSub.type = "sine";
    droneSub.frequency.value = 29;
    const sg = audioCtx.createGain();
    sg.gain.value = 0.25;
    droneSub.connect(sg);
    sg.connect(droneGain);
    droneSub.start();

    started = true;
    applyAmbiente();
  }

  // ═══ LEG CLICK — called per spider per frame based on velocity ═══
  function legClick(screenX, screenY, pitch) {
    if (!started) return;
    const vol = insectVol / 100;
    if (vol < 0.01) return;
    const now = audioCtx.currentTime;
    const tex = spiderTexture / 100; // 0-1

    // 1. IMPACT (Subtle Thud) — More present when tex is low
    const thud = audioCtx.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(100 + pitch * 10, now);
    thud.frequency.exponentialRampToValueAtTime(30, now + 0.04);

    const thudEnv = audioCtx.createGain();
    thudEnv.gain.setValueAtTime(0, now);
    // Impact gain: higher at tex=0
    thudEnv.gain.linearRampToValueAtTime(vol * (0.4 * (1 - tex)), now + 0.002);
    thudEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    // 2. STICKY SNAP (Intermediate)
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;

    const yFactor = 1 - (screenY / innerHeight);
    const pOffset = yFactor * 1000;

    // Filter Interpolation:
    // Low tex -> Low Freq, High Q (Sopapa)
    // High tex -> High Freq, Low Q (Latoso)
    const bp = audioCtx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = (800 + pitch * 200 + pOffset) * (1 - tex) + (2200 + pitch * 400 + pOffset) * tex;
    bp.Q.value = 10 * (1 - tex) + 2 * tex;

    const pk = audioCtx.createBiquadFilter();
    pk.type = "peaking";
    pk.frequency.value = 4000 + pOffset;
    // Peaking gain: negative at tex=0 (disgusting), positive at tex=1 (latoso)
    pk.gain.value = -20 * (1 - tex) + 15 * tex;
    pk.Q.value = 1.5;

    const env = audioCtx.createGain();
    // Decay: longer at tex=0
    const decay = (0.02 * (1 - tex)) + (0.006 * tex) + Math.random() * 0.01;
    env.gain.setValueAtTime(0, now);
    // Attack: slower at tex=0
    const attack = 0.005 * (1 - tex) + 0.001 * tex;
    env.gain.linearRampToValueAtTime(vol * 0.3, now + attack);
    env.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

    // Pan
    const pan = audioCtx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, (screenX / innerWidth) * 2 - 1));

    thud.connect(thudEnv);
    thudEnv.connect(pan);
    src.connect(bp);
    bp.connect(pk);
    pk.connect(env);
    env.connect(pan);

    pan.connect(clipper);
    pan.connect(delayNode);
    pan.connect(convolver);

    const total = 0.08;
    thud.start(now);
    thud.stop(now + total);
    src.start(now, Math.random() * 0.8, total);
    src.stop(now + total);
  }

  // ═══ Ambiente control ═══
  function applyAmbiente() {
    if (!started) return;
    const now = audioCtx.currentTime;
    const a = ambienteLevel / 100; // 0-1

    // Reverb: up to 0.8 wet
    reverbGain.gain.linearRampToValueAtTime(a * 0.8, now + 0.2);

    // Delay feedback: up to 0.75 (very repetitive at max)
    feedbackGain.gain.linearRampToValueAtTime(a * 0.75, now + 0.2);

    // Delay wet: up to 0.6
    delayWet.gain.linearRampToValueAtTime(a * 0.6, now + 0.2);

    // Delay time: longer at higher ambiente (0.2s → 0.5s)
    delayNode.delayTime.linearRampToValueAtTime(0.2 + a * 0.3, now + 0.3);
  }

  // ═══ Frame tick — update drone ═══
  function tick() {
    if (!started) return;
    const now = audioCtx.currentTime;
    // Outer gain: fully zero when slider is 0, scales up to 1.0
    droneOuterGain.gain.linearRampToValueAtTime(droneVol / 100, now + 0.3);
  }

  // ── Controls ──
  function setInsectVol(v) { insectVol = v; }
  function setDroneVol(v) { droneVol = v; }
  function setAmbiente(v) { ambienteLevel = v; applyAmbiente(); }
  function setSpiderTexture(v) { spiderTexture = v; }

  async function toggle() {
    if (!audioCtx) init();
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
      return true;
    } else {
      await audioCtx.suspend();
      return false;
    }
  }

  function isPlaying() {
    return audioCtx && audioCtx.state === "running";
  }

  return { toggle, isPlaying, tick, legClick, setInsectVol, setDroneVol, setAmbiente, setSpiderTexture };
})();
