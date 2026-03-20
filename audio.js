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
  let noiseBuffer;

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

    // ═══ Master Processing ═══
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-12, audioCtx.currentTime); // Higher threshold
    compressor.knee.setValueAtTime(30, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(4, audioCtx.currentTime); // Lower ratio for less squash
    compressor.attack.setValueAtTime(0.003, audioCtx.currentTime); 
    compressor.release.setValueAtTime(0.1, audioCtx.currentTime);

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1.2; // Boosted master gain
    
    compressor.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    dryGain = audioCtx.createGain();
    dryGain.gain.value = 1.0;
    dryGain.connect(compressor);

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
    delayWet.connect(compressor);

    // ═══ Reverb ═══
    convolver = audioCtx.createConvolver();
    convolver.buffer = irBuf;
    reverbGain = audioCtx.createGain();
    reverbGain.gain.value = 0.25;
    convolver.connect(reverbGain);
    reverbGain.connect(compressor);

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

    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;

    // Vertical pitch modulation (Top = higher, Bottom = lower)
    const yFactor = 1 - (screenY / innerHeight); // 0 at bottom, 1 at top
    const pitchOffset = yFactor * 1500; // Adds up to 1500Hz at the top

    // Bandpass for crispy click character
    const bp = audioCtx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1600 + pitch * 300 + pitchOffset + Math.random() * 500;
    bp.Q.value = 4 + Math.random() * 6;

    // Resonant peak — "chitin on stone"
    const pk = audioCtx.createBiquadFilter();
    pk.type = "peaking";
    pk.frequency.value = 3000 + Math.random() * 2000;
    pk.gain.value = 10;
    pk.Q.value = 2.5;

    // Ultra-short envelope
    const env = audioCtx.createGain();
    const decay = 0.006 + Math.random() * 0.014;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(vol * 0.2, now + 0.0015); // Peak 0.2 instead of 0.8
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.002 + decay);

    // Pan
    const pan = audioCtx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, (screenX / innerWidth) * 2 - 1));

    src.connect(bp);
    bp.connect(pk);
    pk.connect(env);
    env.connect(pan);
    pan.connect(dryGain);
    pan.connect(delayNode);
    pan.connect(convolver);

    const total = decay + 0.025;
    src.start(now, Math.random() * 0.8, total);
    src.stop(now + total + 0.005);
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

  return { toggle, isPlaying, tick, legClick, setInsectVol, setDroneVol, setAmbiente };
})();
