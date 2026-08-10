// Native live waveform panel for PB.B054 — no iframe, no backend of mine
// required. Pulls directly from IRIS's public real-time archive (the same
// proven approach already running on myearthquake.dpdns.org, which is why
// this specific station is reliably available here — the SeisComP-backed
// dashboard doesn't currently track B054 at all).
//
// A raw localhost WebSocket to a locally-running monitor (as used on the
// main site) is deliberately NOT attempted here: that only ever works when
// the visitor IS the machine running the monitor script, which is never
// true for a random website visitor — so it would just be a dead code path
// that adds a connection-timeout delay before falling back anyway. This
// goes straight to the fallback that actually works for everyone: IRIS's
// public REST API, refreshed every 30s.

const canvas = document.getElementById("seis-canvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const seisStatus = document.getElementById("seis-status");
const seisRange = document.getElementById("seis-range");
const seisStaltaEl = document.getElementById("seis-stalta");

let bufTimes = [];
let bufVals = [];
let bufSps = 100;
let seisMinutes = 5;
let displayW = 0, displayH = 160;

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  displayW = rect.width;
  canvas.width = displayW * dpr;
  canvas.height = displayH * dpr;
  canvas.style.width = displayW + "px";
  canvas.style.height = displayH + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function pdtStr(d) {
  return d.toLocaleTimeString("en-US", {
    timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }) + " PDT";
}

// Slice the buffer down to the most recent `windowSec` seconds.
function bufWindow(windowSec) {
  if (bufTimes.length < 2) return { times: [], vals: [] };
  const tEnd = bufTimes[bufTimes.length - 1];
  const tStart = tEnd - windowSec;
  let startIdx = bufTimes.findIndex((t) => t >= tStart);
  if (startIdx < 0) startIdx = 0;
  return { times: bufTimes.slice(startIdx), vals: bufVals.slice(startIdx) };
}

// Classic STA/LTA trigger ratio, computed client-side from the raw signal:
// short-term average of |amplitude| over the last few seconds, divided by
// the long-term average over the last minute or so.
function computeStaLta(vals, sps) {
  const staSec = 3, ltaSec = 30;
  const staN = Math.round(staSec * sps);
  const ltaN = Math.round(ltaSec * sps);
  if (vals.length < ltaN) return null;
  const recent = vals.slice(-ltaN);
  const demeaned = recent.map((v) => Math.abs(v - recent.reduce((a, b) => a + b, 0) / recent.length));
  const lta = demeaned.reduce((a, b) => a + b, 0) / demeaned.length;
  const staSlice = demeaned.slice(-staN);
  const sta = staSlice.reduce((a, b) => a + b, 0) / staSlice.length;
  if (lta === 0) return null;
  return sta / lta;
}

function drawWaveform(vals, tStartMs, tEndMs) {
  if (!ctx) return;
  const W = displayW, H = displayH;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#020405";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#0d1520";
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) { const y = (H / 6) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (let i = 1; i < 12; i++) { const x = (W / 12) * i; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  ctx.strokeStyle = "#1a3040";
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

  if (!vals || vals.length < 2) {
    ctx.fillStyle = "#4a6070"; ctx.textAlign = "center";
    ctx.font = "12px 'Share Tech Mono', monospace";
    ctx.fillText("Waiting for live data…", W / 2, H / 2);
    return;
  }

  let lo = Infinity, hi = -Infinity;
  for (const v of vals) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const margin = (hi - lo) * 0.15 || 1;
  const center = (hi + lo) / 2;
  const halfRange = Math.max((hi - lo) / 2 + margin, 1);
  const pad = H * 0.08, mid = H / 2, amp = (H / 2) - pad;

  ctx.strokeStyle = "#00d472"; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < vals.length; i++) {
    const x = (i / (vals.length - 1)) * W;
    const norm = Math.max(-1, Math.min(1, (vals[i] - center) / halfRange));
    const y = mid - norm * amp;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();

  if (tStartMs && tEndMs) {
    const totalMs = tEndMs - tStartMs;
    const intMin = totalMs <= 6 * 60000 ? 1 : totalMs <= 12 * 60000 ? 2 : totalMs <= 35 * 60000 ? 5 : 10;
    const intMs = intMin * 60000;
    const firstMark = Math.ceil(tStartMs / intMs) * intMs;
    ctx.font = "9px 'Share Tech Mono', monospace";
    for (let t = firstMark; t < tEndMs; t += intMs) {
      const x = ((t - tStartMs) / totalMs) * W;
      ctx.strokeStyle = "#1e3a50"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - 18); ctx.stroke();
      const lbl = new Date(t).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", hour12: false });
      ctx.fillStyle = "#2a5060"; ctx.textAlign = "center";
      ctx.fillText(lbl, x, H - 6);
    }
  }

  const ySteps = 4;
  ctx.font = "8px 'Share Tech Mono', monospace"; ctx.textAlign = "right";
  for (let i = 0; i <= ySteps; i++) {
    const frac = i / ySteps;
    const y = pad + frac * (H - pad * 2);
    const val = ((1 - frac * 2) * halfRange).toFixed(0);
    ctx.fillStyle = "#1e3a4a"; ctx.fillText(val, W - 4, y + 3);
    ctx.strokeStyle = "#0e1e28"; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W - 48, y); ctx.stroke();
  }
  ctx.fillStyle = "#1e3a4a";
  ctx.fillText("cts", W - 4, H - 6);
}

function redraw() {
  const win = bufWindow(seisMinutes * 60);
  if (win.times.length < 2) {
    drawWaveform(null, 0, 0);
    return;
  }
  const tStartMs = win.times[0] * 1000;
  const tEndMs = win.times[win.times.length - 1] * 1000;
  drawWaveform(win.vals, tStartMs, tEndMs);
  seisRange.textContent = pdtStr(new Date(tStartMs)) + " → " + pdtStr(new Date(tEndMs));

  const staLta = computeStaLta(bufVals, bufSps);
  seisStaltaEl.textContent = staLta != null ? `STA/LTA: ${staLta.toFixed(2)}` : "STA/LTA: —";
}

function setSeisWindow(min) {
  seisMinutes = min;
  document.querySelectorAll(".seis-win-btn").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.min) === min);
  });
  redraw();
}

async function fetchSeismogramIRIS() {
  if (!canvas) return;
  const fmt = (d) => d.toISOString().slice(0, 19);
  const WIN_MIN = 60;
  for (const delayMin of [2, 5, 10, 20]) {
    const endTime = new Date(Date.now() - delayMin * 60 * 1000);
    const startTime = new Date(endTime.getTime() - WIN_MIN * 60 * 1000);
    const url = `https://service.iris.edu/irisws/timeseries/1/query` +
      `?net=PB&sta=B054&loc=--&cha=EHZ` +
      `&starttime=${fmt(startTime)}&endtime=${fmt(endTime)}&output=ascii1&demean=true`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      if (!text || !text.includes("TIMESERIES")) continue;
      const lines = text.trim().split("\n");
      const sps = parseFloat((lines[0].match(/([\d.]+)\s+sps/i) || [])[1]) || 100;
      const vals = [];
      for (let i = 1; i < lines.length; i++) {
        const v = parseFloat(lines[i]);
        if (!isNaN(v)) vals.push(v);
      }
      if (vals.length < 2) continue;

      const tEnd = endTime.getTime() / 1000;
      bufTimes = vals.map((_, i) => tEnd - (vals.length - 1 - i) / sps);
      bufVals = vals;
      bufSps = sps;

      seisStatus.textContent = `PB.B054 — IRIS (−${delayMin}m lag)`;
      seisStatus.className = "seis-status ok";
      redraw();
      return;
    } catch (e) {
      // try the next delay tier
    }
  }
  seisStatus.textContent = "PB.B054 — unavailable";
  seisStatus.className = "seis-status err";
  drawWaveform(null, 0, 0);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!canvas) return;
  resizeCanvas();
  window.addEventListener("resize", () => { resizeCanvas(); redraw(); });

  document.querySelectorAll(".seis-win-btn").forEach((btn) => {
    btn.addEventListener("click", () => setSeisWindow(Number(btn.dataset.min)));
  });

  fetchSeismogramIRIS();
  setInterval(fetchSeismogramIRIS, 30000);
});
