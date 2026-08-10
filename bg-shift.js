// Slowly rotates the page background through the color spectrum — one
// full 360° trip every 24 hours. Sampled every second (smooth 1s CSS
// transition between each step) so it's always visibly, gradually
// drifting without ever jumping. Saturation/lightness are fixed to a
// soft pastel so black text stays readable no matter the hue.
const CYCLE_MS = 24 * 60 * 60 * 1000;
const UPDATE_EVERY_MS = 1000;
const SATURATION = 55;
const LIGHTNESS = 94;

// Returns unrounded [r, g, b] floats — kept precise on purpose so the
// decimal readout visibly ticks every second even when the rounded
// integer RGB value hasn't changed yet.
function hslToRgbFloat(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [255 * f(0), 255 * f(8), 255 * f(4)];
}

function updateBackground() {
  const hue = ((Date.now() % CYCLE_MS) / CYCLE_MS) * 360;
  const [rf, gf, bf] = hslToRgbFloat(hue, SATURATION, LIGHTNESS);
  const r = Math.round(rf);
  const g = Math.round(gf);
  const b = Math.round(bf);
  document.body.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

  const rgbEl = document.getElementById("bg-rgb");
  if (rgbEl) rgbEl.textContent = `RGB(${r}, ${g}, ${b})`;

  const decimalEl = document.getElementById("bg-rgb-decimal");
  if (decimalEl) decimalEl.textContent = `${rf.toFixed(4)}, ${gf.toFixed(4)}, ${bf.toFixed(4)}`;
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.style.transition = `background-color ${UPDATE_EVERY_MS / 1000}s linear`;
  updateBackground();
  setInterval(updateBackground, UPDATE_EVERY_MS);
});
