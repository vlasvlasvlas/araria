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
  let webDroneGain, webDroneOuterGain, webDroneFilter;
  let noiseBuffer, clipper;

  // Params
  let insectVol = 80;
  let droneVol = 0;
  let ambienteLevel = 25;
  let spiderTexture = 75;
  let webPresence = 0;

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

    // ═══ Web Drone (warm, calm pad) ═══
    webDroneGain = audioCtx.createGain();
    webDroneGain.gain.value = 0.12;
    webDroneOuterGain = audioCtx.createGain();
    webDroneOuterGain.gain.value = 0;
    webDroneFilter = audioCtx.createBiquadFilter();
    webDroneFilter.type = "lowpass";
    webDroneFilter.frequency.value = 950;
    webDroneGain.connect(webDroneFilter);
    webDroneFilter.connect(webDroneOuterGain);
    webDroneOuterGain.connect(dryGain);
    webDroneOuterGain.connect(convolver);

    const webOsc1 = audioCtx.createOscillator();
    webOsc1.type = "triangle";
    webOsc1.frequency.value = 196; // G3
    webOsc1.connect(webDroneGain);
    webOsc1.start();

    const webOsc2 = audioCtx.createOscillator();
    webOsc2.type = "sine";
    webOsc2.frequency.value = 246.94; // B3
    webOsc2.connect(webDroneGain);
    webOsc2.start();

    const webOsc3 = audioCtx.createOscillator();
    webOsc3.type = "sine";
    webOsc3.frequency.value = 293.66; // D4
    webOsc3.connect(webDroneGain);
    webOsc3.start();

    const webOsc4 = audioCtx.createOscillator();
    webOsc4.type = "sine";
    webOsc4.frequency.value = 392; // G4
    webOsc4.connect(webDroneGain);
    webOsc4.start();

    const webLfo1 = audioCtx.createOscillator();
    webLfo1.type = "sine";
    webLfo1.frequency.value = 0.08;
    const webLfo1Gain = audioCtx.createGain();
    webLfo1Gain.gain.value = 0.035;
    webLfo1.connect(webLfo1Gain);
    webLfo1Gain.connect(webDroneGain.gain);
    webLfo1.start();

    const webLfo2 = audioCtx.createOscillator();
    webLfo2.type = "sine";
    webLfo2.frequency.value = 0.11;
    const webLfo2Gain = audioCtx.createGain();
    webLfo2Gain.gain.value = 260;
    webLfo2.connect(webLfo2Gain);
    webLfo2Gain.connect(webDroneFilter.frequency);
    webLfo2.start();

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

  // ═══ LEG CLICK (Life Mode) — texture driven by life stage ═══
  function legClickLife(screenX, screenY, pitch, stageTexture, sizeMul) {
    if (!started) return;
    const vol = insectVol / 100;
    if (vol < 0.01) return;
    const now = audioCtx.currentTime;
    const tex = stageTexture; // 0-1, driven by life stage

    const thud = audioCtx.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(100 + pitch * 10, now);
    thud.frequency.exponentialRampToValueAtTime(30, now + 0.04);

    const thudEnv = audioCtx.createGain();
    thudEnv.gain.setValueAtTime(0, now);
    thudEnv.gain.linearRampToValueAtTime(vol * (0.4 * (1 - tex)) * sizeMul, now + 0.002);
    thudEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    const yFactor = 1 - (screenY / innerHeight);
    const pOffset = yFactor * 1000;

    const bp = audioCtx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = (800 + pitch * 200 + pOffset) * (1 - tex) + (2200 + pitch * 400 + pOffset) * tex;
    bp.Q.value = 10 * (1 - tex) + 2 * tex;

    const pk = audioCtx.createBiquadFilter();
    pk.type = "peaking";
    pk.frequency.value = 4000 + pOffset;
    pk.gain.value = -20 * (1 - tex) + 15 * tex;
    pk.Q.value = 1.5;

    const env = audioCtx.createGain();
    const decay = (0.02 * (1 - tex)) + (0.006 * tex) + Math.random() * 0.01;
    env.gain.setValueAtTime(0, now);
    const attack = 0.005 * (1 - tex) + 0.001 * tex;
    env.gain.linearRampToValueAtTime(vol * 0.3 * sizeMul, now + attack);
    env.gain.exponentialRampToValueAtTime(0.001, now + attack + decay);

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

  // ═══ Egg placement (warm, low, powerful pulse) ═══
  function playEggPlace(x, y) {
    if (!started) return;
    const now = audioCtx.currentTime;

    // Main tone — lower and warmer
    const osc1 = audioCtx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(200, now);
    osc1.frequency.exponentialRampToValueAtTime(450, now + 0.15);
    osc1.frequency.exponentialRampToValueAtTime(300, now + 0.5);

    // Warm harmonic
    const osc2 = audioCtx.createOscillator();
    osc2.type = "triangle"; // softer harmonic
    osc2.frequency.setValueAtTime(100, now);
    osc2.frequency.exponentialRampToValueAtTime(220, now + 0.2);

    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.4, now + 0.05); // more powerful start
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600;

    const pan = audioCtx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, (x / innerWidth) * 2 - 1));

    osc1.connect(env);
    osc2.connect(env);
    env.connect(filter);
    filter.connect(pan);
    pan.connect(clipper);
    pan.connect(convolver);

    osc1.start(now);
    osc1.stop(now + 0.85);
    osc2.start(now);
    osc2.stop(now + 0.85);
  }

  // ═══ Egg pulse (heartbeat) ═══
  function playEggPulse(x, y) {
    if (!started) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.08, now + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    const pan = audioCtx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, (x / innerWidth) * 2 - 1));

    osc.connect(env);
    env.connect(pan);
    pan.connect(clipper);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // ═══ Hatch sound (simple plop) ═══
  function playHatch(x, y) {
    if (!started) return;
    const now = audioCtx.currentTime;
    const pan = audioCtx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, (x / innerWidth) * 2 - 1));

    const popOsc = audioCtx.createOscillator();
    popOsc.type = "sine";
    popOsc.frequency.setValueAtTime(165, now);
    popOsc.frequency.exponentialRampToValueAtTime(88, now + 0.05);

    const popEnv = audioCtx.createGain();
    popEnv.gain.setValueAtTime(0, now);
    popEnv.gain.linearRampToValueAtTime(0.18, now + 0.002);
    popEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    popOsc.connect(popEnv);
    popEnv.connect(pan);

    pan.connect(clipper);

    popOsc.start(now);
    popOsc.stop(now + 0.065);
  }

  // ═══ Ambiente control ═══
  function applyAmbiente() {
    if (!started) return;
    const now = audioCtx.currentTime;
    const a = ambienteLevel / 100;
    reverbGain.gain.linearRampToValueAtTime(a * 0.8, now + 0.2);
    feedbackGain.gain.linearRampToValueAtTime(a * 0.75, now + 0.2);
    delayWet.gain.linearRampToValueAtTime(a * 0.6, now + 0.2);
    delayNode.delayTime.linearRampToValueAtTime(0.2 + a * 0.3, now + 0.3);
    if (webDroneFilter) {
      webDroneFilter.frequency.linearRampToValueAtTime(760 + a * 900 + webPresence * 260, now + 0.3);
    }
  }

  // ═══ Frame tick — update drone ═══
  function tick() {
    if (!started) return;
    const now = audioCtx.currentTime;
    droneOuterGain.gain.linearRampToValueAtTime(droneVol / 100, now + 0.3);
    if (webDroneOuterGain) {
      const webLevel = (droneVol / 100) * webPresence * 0.85;
      webDroneOuterGain.gain.linearRampToValueAtTime(webLevel, now + 0.45);
      webDroneGain.gain.linearRampToValueAtTime(0.08 + webPresence * 0.08, now + 0.45);
    }
  }

  // ═══ Death sound (low fade crack) ═══
  function playDeath(x, y) {
    if (!started) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);

    const env = audioCtx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.15, now + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 400;
    lp.Q.value = 5;

    const pan = audioCtx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, (x / innerWidth) * 2 - 1));

    osc.connect(lp);
    lp.connect(env);
    env.connect(pan);
    pan.connect(clipper);
    pan.connect(convolver);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  // ── Controls ──
  function setInsectVol(v) { insectVol = v; }
  function setDroneVol(v) { droneVol = v; }
  function setAmbiente(v) { ambienteLevel = v; applyAmbiente(); }
  function setSpiderTexture(v) { spiderTexture = v; }
  function setWebPresence(v) {
    webPresence = Math.max(0, Math.min(1, v));
    applyAmbiente();
  }

  async function toggle() {
    if (!audioCtx) {
      init();
      if (audioCtx.state !== "running") {
        await audioCtx.resume();
      }
      return true;
    }

    if (audioCtx.state !== "running") {
      await audioCtx.resume();
      return true;
    }

    await audioCtx.suspend();
    return false;
  }

  function isPlaying() {
    return audioCtx && audioCtx.state === "running";
  }

  return {
    toggle, isPlaying, tick,
    legClick, legClickLife,
    playEggPlace, playEggPulse, playHatch, playDeath,
    setInsectVol, setDroneVol, setAmbiente, setSpiderTexture, setWebPresence
  };
})();
