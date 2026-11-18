// Synthesised sound: every effect is made with WebAudio oscillators and filtered noise,
// so the game needs no audio files at all. Nothing is created until the player's first
// gesture, which is when browsers allow audio to start.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let sirenHigh = false;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);

      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      sirenOsc = context.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      context = null;
      return false;
    }
    return true;
  }

  function blip(freq, duration, type, volume, when = 0) {
    if (!context || muted) return;
    const t = context.currentTime + when;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!context || muted) return;
    const t = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t);
  }

  return {
    /** Call from any user gesture; also starts the engine and siren loops. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    /** Engine hum follows the player's car speed; silent on foot. */
    updateEngine(speed, inCar, dt) {
      if (!context) return;
      const target = inCar ? 0.05 + Math.min(0.11, Math.abs(speed) / 560 * 0.11) : 0;
      engineGain.gain.value += (target - engineGain.gain.value) * Math.min(1, dt * 6);
      engineOsc.frequency.value = 52 + Math.abs(speed) * 0.16;
    },
    /** Two-tone police siren while any wanted stars are up. */
    updateSiren(wanted, dt) {
      if (!context) return;
      const target = wanted > 0 && !muted ? 0.045 : 0;
      sirenGain.gain.value += (target - sirenGain.gain.value) * Math.min(1, dt * 4);
      sirenTimer += dt;
      if (sirenTimer > 0.42) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.value = sirenHigh ? 920 : 660;
      }
    },
    shoot() {
      noiseBurst(0.16, 0.5, 2600);
      blip(180, 0.08, 'square', 0.18);
    },
    punch() {
      noiseBurst(0.1, 0.35, 500);
    },
    crash() {
      noiseBurst(0.25, 0.5, 900);
    },
    coin() {
      blip(880, 0.09, 'sine', 0.25);
      blip(1318, 0.16, 'sine', 0.25, 0.08);
    },
    pickup() {
      blip(660, 0.08, 'sine', 0.22);
      blip(990, 0.12, 'sine', 0.22, 0.07);
    },
    missionComplete() {
      [523, 659, 784, 1046].forEach((freq, i) => blip(freq, 0.22, 'triangle', 0.28, i * 0.11));
    },
    busted() {
      [392, 330, 262, 196].forEach((freq, i) => blip(freq, 0.3, 'sawtooth', 0.2, i * 0.16));
    },
    carDoor() {
      noiseBurst(0.07, 0.25, 1400);
    },
  };
}
