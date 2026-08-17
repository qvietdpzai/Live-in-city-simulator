/* ============================================================
 * audio.js — tiny WebAudio sound effects
 * ============================================================ */

const AudioFX = {
  ctx: null,
  enabled: true,

  ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { /* no audio */ }
  },

  blip(freq, dur, type, vol, slide) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
    gain.gain.setValueAtTime(vol || 0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  place() { this.blip(520, 0.06, 'square', 0.03, 340); },
  demolish() { this.blip(160, 0.12, 'sawtooth', 0.04, 60); },
  build() { this.blip(660, 0.08, 'triangle', 0.05, 880); this.blip(990, 0.1, 'triangle', 0.04, 1320); },
  error() { this.blip(140, 0.15, 'square', 0.04, 90); },
  click() { this.blip(440, 0.04, 'square', 0.02, 400); },
  toggle() { this.enabled = !this.enabled; if (this.enabled) this.click(); },
};
