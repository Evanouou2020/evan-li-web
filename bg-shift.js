// Slowly rotates the page background through the color spectrum — one
// full cycle every 24 hours, sampled every second with a smooth 1s CSS
// transition so it's always visibly, gradually drifting.
//
// R, G, and B are each their own sine wave, 120° out of phase with each
// other — unlike standard HSL hue rotation (which pins a channel flat at
// its min/max for a full third of the cycle), sine waves have no flat
// plateaus, so all three channels are always in motion simultaneously.
// Amplitude is kept small and centered high (close to white) to stay a
// soft pastel that black text stays readable against.
const CYCLE_MS = 24 * 60 * 60 * 1000;
const UPDATE_EVERY_MS = 1000;
const BASE = 242; // center point of the oscillation, out of 255
const AMPLITUDE = 13; // how far each channel swings from BASE

function getRgbFloat(now) {
  const theta = ((now % CYCLE_MS) / CYCLE_MS) * 2 * Math.PI;
  const r = BASE + AMPLITUDE * Math.sin(theta);
  const g = BASE + AMPLITUDE * Math.sin(theta + (2 * Math.PI) / 3);
  const b = BASE + AMPLITUDE * Math.sin(theta + (4 * Math.PI) / 3);
  return [r, g, b];
}

function updateBackground() {
  const [rf, gf, bf] = getRgbFloat(Date.now());
  const r = Math.round(rf);
  const g = Math.round(gf);
  const b = Math.round(bf);
  document.body.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

  const rgbEl = document.getElementById("bg-rgb");
  if (rgbEl) {
    rgbEl.textContent = `R: ${rf.toFixed(4)}  G: ${gf.toFixed(4)}  B: ${bf.toFixed(4)}`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.style.transition = `background-color ${UPDATE_EVERY_MS / 1000}s linear`;
  updateBackground();
  setInterval(updateBackground, UPDATE_EVERY_MS);
});
