// Live panel for the DIY ESP32 + LSM6DS3 seismometer. Polls a small JSON
// endpoint embedded directly in the sensor's own receiving script
// (diy_seismometer/live_waveform.py), tunneled publicly via Cloudflare —
// same pattern as the PB.B054 panel above it, just a different data source.
// Unlike PB.B054, this one only exists while Evan's own computer is on and
// that script is running, so "offline" here just means the setup is off
// right now, not a bug.

const ESP32_URL = "https://esp32.myearthquake.dpdns.org/recent";
const ESP32_POLL_MS = 3000;
const ESP32_STALE_AFTER_S = 15; // if the newest sample is older than this, call it stale

const esp32Canvas = document.getElementById("esp32-canvas");
const esp32Ctx = esp32Canvas ? esp32Canvas.getContext("2d") : null;
const esp32Status = document.getElementById("esp32-status");
const esp32Range = document.getElementById("esp32-range");
const esp32StaltaEl = document.getElementById("esp32-stalta");
const esp32MmiEl = document.getElementById("esp32-mmi");
const esp32PgaEl = document.getElementById("esp32-pga");

let esp32DisplayW = 0, esp32DisplayH = 160;

function esp32ResizeCanvas() {
  if (!esp32Canvas) return;
  const rect = esp32Canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  esp32DisplayW = rect.width;
  esp32Canvas.width = esp32DisplayW * dpr;
  esp32Canvas.height = esp32DisplayH * dpr;
  esp32Canvas.style.width = esp32DisplayW + "px";
  esp32Canvas.style.height = esp32DisplayH + "px";
  esp32Ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function esp32DrawWaveform(times, dx, dy, dz) {
  if (!esp32Ctx) return;
  const W = esp32DisplayW, H = esp32DisplayH;
  esp32Ctx.clearRect(0, 0, W, H);
  esp32Ctx.fillStyle = "#020405";
  esp32Ctx.fillRect(0, 0, W, H);

  esp32Ctx.strokeStyle = "#0d1520";
  esp32Ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) { const y = (H / 6) * i; esp32Ctx.beginPath(); esp32Ctx.moveTo(0, y); esp32Ctx.lineTo(W, y); esp32Ctx.stroke(); }
  for (let i = 1; i < 12; i++) { const x = (W / 12) * i; esp32Ctx.beginPath(); esp32Ctx.moveTo(x, 0); esp32Ctx.lineTo(x, H); esp32Ctx.stroke(); }
  esp32Ctx.strokeStyle = "#1a3040";
  esp32Ctx.beginPath(); esp32Ctx.moveTo(0, H / 2); esp32Ctx.lineTo(W, H / 2); esp32Ctx.stroke();

  if (!times || times.length < 2) {
    esp32Ctx.fillStyle = "#4a6070"; esp32Ctx.textAlign = "center";
    esp32Ctx.font = "12px 'Share Tech Mono', monospace";
    esp32Ctx.fillText("Waiting for live data…", W / 2, H / 2);
    return;
  }

  const allVals = dx.concat(dy, dz);
  let lo = Math.min(...allVals), hi = Math.max(...allVals);
  const margin = (hi - lo) * 0.15 || 0.01;
  const center = (hi + lo) / 2;
  const halfRange = Math.max((hi - lo) / 2 + margin, 0.005);
  const pad = H * 0.08, mid = H / 2, amp = (H / 2) - pad;
  const tMax = times[times.length - 1] || 1;

  const series = [
    { vals: dx, color: "#ff5c5c" },
    { vals: dy, color: "#5cff8f" },
    { vals: dz, color: "#5c9fff" },
  ];
  for (const { vals, color } of series) {
    esp32Ctx.strokeStyle = color;
    esp32Ctx.lineWidth = 1;
    esp32Ctx.beginPath();
    for (let i = 0; i < vals.length; i++) {
      const x = (times[i] / tMax) * W;
      const norm = Math.max(-1, Math.min(1, (vals[i] - center) / halfRange));
      const y = mid - norm * amp;
      i === 0 ? esp32Ctx.moveTo(x, y) : esp32Ctx.lineTo(x, y);
    }
    esp32Ctx.stroke();
  }

  const ySteps = 4;
  esp32Ctx.font = "8px 'Share Tech Mono', monospace"; esp32Ctx.textAlign = "right";
  for (let i = 0; i <= ySteps; i++) {
    const frac = i / ySteps;
    const y = pad + frac * (H - pad * 2);
    const val = ((1 - frac * 2) * halfRange).toFixed(3);
    esp32Ctx.fillStyle = "#1e3a4a"; esp32Ctx.fillText(val, W - 4, y + 3);
    esp32Ctx.strokeStyle = "#0e1e28"; esp32Ctx.lineWidth = 0.5;
    esp32Ctx.beginPath(); esp32Ctx.moveTo(0, y); esp32Ctx.lineTo(W - 48, y); esp32Ctx.stroke();
  }
  esp32Ctx.fillStyle = "#1e3a4a";
  esp32Ctx.fillText("m/s²", W - 4, H - 6);
}

async function fetchEsp32() {
  if (!esp32Canvas) return;
  try {
    const res = await fetch(ESP32_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.available) {
      esp32Status.textContent = "no data yet";
      esp32Status.className = "seis-status";
      esp32DrawWaveform(null, [], [], []);
      return;
    }

    const ageSec = (Date.now() - new Date(data.latest_sample_utc).getTime()) / 1000;
    if (ageSec > ESP32_STALE_AFTER_S) {
      esp32Status.textContent = `offline (last sample ${ageSec.toFixed(0)}s ago)`;
      esp32Status.className = "seis-status err";
    } else if (data.calibrating) {
      esp32Status.textContent = "calibrating…";
      esp32Status.className = "seis-status";
    } else {
      esp32Status.textContent = "LIVE";
      esp32Status.className = "seis-status ok";
    }

    esp32DrawWaveform(data.times_rel_s, data.dx, data.dy, data.dz);

    const last = data.times_rel_s[data.times_rel_s.length - 1] || 0;
    esp32Range.textContent = `${last.toFixed(0)}s window &middot; ${data.sample_rate_hz} Hz`.replace("&middot;", "·");

    const ratio = data.ratio[data.ratio.length - 1];
    esp32StaltaEl.textContent = data.calibrating
      ? "STA/LTA: calibrating"
      : `STA/LTA: ${ratio != null ? ratio.toFixed(2) : "—"}${data.triggered ? " ⚠" : ""}`;
    esp32MmiEl.textContent = `MMI: ${data.mmi_roman} (${data.mmi.toFixed(1)})`;
    esp32PgaEl.textContent = `PGA: ${data.pga_ms2.toFixed(4)} m/s²`;
  } catch (err) {
    esp32Status.textContent = "offline";
    esp32Status.className = "seis-status err";
    esp32DrawWaveform(null, [], [], []);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!esp32Canvas) return;
  esp32ResizeCanvas();
  window.addEventListener("resize", esp32ResizeCanvas);
  fetchEsp32();
  setInterval(fetchEsp32, ESP32_POLL_MS);
});
