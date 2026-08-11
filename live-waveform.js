// Native live waveform panel for PB.B054 — no iframe.
//
// Two data paths, same as myearthquake.dpdns.org itself:
//   1. A local WebSocket (ws://localhost:8765) to a monitor script — true
//      real-time, zero added lag. This only ever succeeds when the visitor
//      IS the machine running that monitor, so for almost everyone it will
//      fail fast — that's expected, not an error.
//   2. Falls back to IRIS's public real-time archive, polled frequently,
//      requesting the freshest window IRIS will actually serve.

const canvas = document.getElementById("seis-canvas");
const ctx = canvas ? canvas.getContext("2d") : null;
const seisStatus = document.getElementById("seis-status");
const seisRange = document.getElementById("seis-range");
const seisStaltaEl = document.getElementById("seis-stalta");
const seisStaltaMaxEl = document.getElementById("seis-stalta-max");
const seisStaltaMaxTimeEl = document.getElementById("seis-stalta-max-time");

const WS_URL = "ws://localhost:8765";
const WS_CONNECT_TIMEOUT_MS = 4000;
const BUF_MAX_SAMPLES = 6 * 60 * 60 * 100; // 6 hours at 100 sps, generous ceiling

let bufTimes = [];
let bufVals = [];
let bufSps = 100;
let seisMinutes = 5;
let displayW = 0, displayH = 160;
let wsUsing = false;
let irisPollStarted = false;

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

function bufAppend(tEnd, sr, values) {
  const n = values.length;
  for (let i = 0; i < n; i++) {
    bufTimes.push(tEnd - (n - 1 - i) / sr);
    bufVals.push(values[i]);
  }
  if (bufTimes.length > BUF_MAX_SAMPLES) {
    const drop = bufTimes.length - BUF_MAX_SAMPLES;
    bufTimes.splice(0, drop);
    bufVals.splice(0, drop);
  }
}

function bufReplace(tEnd, sr, values) {
  bufTimes = values.map((_, i) => tEnd - (values.length - 1 - i) / sr);
  bufVals = values;
  bufSps = sr;
}

function bufWindow(windowSec) {
  if (bufTimes.length < 2) return { times: [], vals: [], startIdx: 0 };
  const tEnd = bufTimes[bufTimes.length - 1];
  const tStart = tEnd - windowSec;
  let startIdx = bufTimes.findIndex((t) => t >= tStart);
  if (startIdx < 0) startIdx = 0;
  return { times: bufTimes.slice(startIdx), vals: bufVals.slice(startIdx), startIdx };
}

// Classic STA/LTA trigger ratio, computed client-side from the raw signal:
// short-term average of |amplitude| over the last few seconds, divided by
// the long-term average over the last ~30 seconds. Computed as a full
// series (one ratio per sample, via prefix sums so it's O(n) even over a
// 60-minute buffer) so both "current" and "max over the visible window"
// are cheap to read off.
function computeStaLtaSeries(vals, sps) {
  const staSec = 3, ltaSec = 30;
  const staN = Math.max(1, Math.round(staSec * sps));
  const ltaN = Math.max(1, Math.round(ltaSec * sps));
  const n = vals.length;
  const series = new Array(n).fill(null);
  if (n < ltaN + 1) return series;

  let sum = 0;
  for (let i = 0; i < n; i++) sum += vals[i];
  const mean = sum / n;

  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + Math.abs(vals[i] - mean);

  for (let i = ltaN; i <= n; i++) {
    const lta = (prefix[i] - prefix[i - ltaN]) / ltaN;
    if (lta === 0) continue;
    const staStart = Math.max(0, i - staN);
    const sta = (prefix[i] - prefix[staStart]) / (i - staStart);
    series[i - 1] = sta / lta;
  }
  return series;
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
    seisStaltaEl.textContent = "STA/LTA: —";
    if (seisStaltaMaxEl) seisStaltaMaxEl.textContent = "Max: —";
    if (seisStaltaMaxTimeEl) seisStaltaMaxTimeEl.textContent = "";
    return;
  }
  const tStartMs = win.times[0] * 1000;
  const tEndMs = win.times[win.times.length - 1] * 1000;
  drawWaveform(win.vals, tStartMs, tEndMs);
  seisRange.textContent = pdtStr(new Date(tStartMs)) + " → " + pdtStr(new Date(tEndMs));

  const series = computeStaLtaSeries(bufVals, bufSps);
  const current = series[series.length - 1];
  seisStaltaEl.textContent = current != null ? `STA/LTA: ${current.toFixed(2)}` : "STA/LTA: —";

  if (seisStaltaMaxEl) {
    let maxVal = null, maxAbsIdx = -1;
    for (let i = win.startIdx; i < series.length; i++) {
      const v = series[i];
      if (v != null && (maxVal == null || v > maxVal)) { maxVal = v; maxAbsIdx = i; }
    }
    if (maxVal != null) {
      seisStaltaMaxEl.textContent = `Max: ${maxVal.toFixed(2)}`;
      if (seisStaltaMaxTimeEl) {
        seisStaltaMaxTimeEl.textContent = "at " + pdtStr(new Date(bufTimes[maxAbsIdx] * 1000));
      }
    } else {
      seisStaltaMaxEl.textContent = "Max: —";
      if (seisStaltaMaxTimeEl) seisStaltaMaxTimeEl.textContent = "";
    }
  }
}

function setSeisWindow(min) {
  seisMinutes = min;
  document.querySelectorAll(".seis-win-btn").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.min) === min);
  });
  redraw();
}

// ── Path 1: local real-time monitor (works only for the machine running it) ──
function wsConnect() {
  let socket;
  try {
    socket = new WebSocket(WS_URL);
  } catch (e) {
    startIrisPolling();
    return;
  }

  const timeout = setTimeout(() => {
    if (!wsUsing) { try { socket.close(); } catch (e) {} }
  }, WS_CONNECT_TIMEOUT_MS);

  socket.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch (err) { return; }
    if (!msg.key || !msg.v || !msg.sr || !msg.t_end) return;
    const sta = msg.key.split(".")[1] || "";
    if (sta !== "B054") return;

    wsUsing = true;
    clearTimeout(timeout);
    seisStatus.textContent = "LIVE";
    seisStatus.className = "seis-status ok";
    bufSps = msg.sr;
    bufAppend(msg.t_end, msg.sr, msg.v);
    redraw();
  };

  socket.onerror = () => {};

  socket.onclose = () => {
    clearTimeout(timeout);
    if (wsUsing) {
      seisStatus.textContent = "reconnecting…";
      seisStatus.className = "seis-status";
      wsUsing = false;
      setTimeout(wsConnect, 4000);
    } else {
      startIrisPolling();
    }
  };
}

// ── Path 2: IRIS public archive ──────────────────────────────────────────────
// Fetched RAW (no per-request demeaning) so consecutive chunks share one
// consistent baseline — demeaning each request independently was creating a
// visible seam/jump every time a new chunk joined the buffer. Centering for
// display and for the STA/LTA calculation is handled once, locally, in
// drawWaveform()/computeStaLtaSeries() instead.
//
// After the first backfill, every later poll only asks for the *new* slice
// since the last sample we already have and appends it — never wipes and
// re-fetches the whole window — so the buffer only ever grows forward. That
// was the actual cause of the display "jumping around": each poll used to
// replace the entire 60-minute buffer with a fresh request that could land
// on a different (sometimes fresher, sometimes staler) IRIS delay tier than
// the previous poll, making the visible right edge jump backward and
// forward at random each cycle.
let lastFetchedEndSec = null;

async function irisFetchRange(startTime, endTime) {
  const fmt = (d) => d.toISOString().slice(0, 19);
  const url = `https://service.iris.edu/irisws/timeseries/1/query` +
    `?net=PB&sta=B054&loc=--&cha=EHZ` +
    `&starttime=${fmt(startTime)}&endtime=${fmt(endTime)}&output=ascii1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || !text.includes("TIMESERIES")) return null;
  const lines = text.trim().split("\n");
  const sps = parseFloat((lines[0].match(/([\d.]+)\s+sps/i) || [])[1]) || 100;
  const vals = [];
  for (let i = 1; i < lines.length; i++) {
    const v = parseFloat(lines[i]);
    if (!isNaN(v)) vals.push(v);
  }
  if (vals.length < 2) return null;
  return { sps, vals };
}

async function fetchInitialBackfill() {
  const WIN_MIN = 60;
  for (const delayMin of [1, 2, 5, 10, 20]) {
    const endTime = new Date(Date.now() - delayMin * 60 * 1000);
    const startTime = new Date(endTime.getTime() - WIN_MIN * 60 * 1000);
    const result = await irisFetchRange(startTime, endTime);
    if (!result) continue;
    bufReplace(endTime.getTime() / 1000, result.sps, result.vals);
    lastFetchedEndSec = endTime.getTime() / 1000;
    seisStatus.textContent = "PB.B054";
    seisStatus.className = "seis-status ok";
    redraw();
    return true;
  }
  return false;
}

async function fetchSeismogramIRIS() {
  if (!canvas || wsUsing) return;

  if (lastFetchedEndSec == null) {
    await fetchInitialBackfill();
    return;
  }

  // Ask for whatever's new since the last sample we already have, trying
  // progressively larger delays only if the freshest data isn't published
  // yet. Never re-requests data we already hold.
  for (const delaySec of [45, 90, 180, 360]) {
    const endTime = new Date(Date.now() - delaySec * 1000);
    const startTime = new Date(lastFetchedEndSec * 1000);
    if (endTime.getTime() <= startTime.getTime() + 1000) continue; // nothing new at this tier yet
    const result = await irisFetchRange(startTime, endTime);
    if (!result) continue;
    bufAppend(endTime.getTime() / 1000, result.sps, result.vals);
    bufSps = result.sps;
    lastFetchedEndSec = endTime.getTime() / 1000;
    seisStatus.textContent = "PB.B054";
    seisStatus.className = "seis-status ok";
    redraw();
    return;
  }
  // Nothing new published yet this cycle — leave the existing buffer as is
  // rather than touching it, so the display stays stable instead of jumping.
}

function startIrisPolling() {
  if (irisPollStarted) return;
  irisPollStarted = true;
  fetchSeismogramIRIS();
  setInterval(fetchSeismogramIRIS, 5000);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!canvas) return;
  resizeCanvas();
  window.addEventListener("resize", () => { resizeCanvas(); redraw(); });

  document.querySelectorAll(".seis-win-btn").forEach((btn) => {
    btn.addEventListener("click", () => setSeisWindow(Number(btn.dataset.min)));
  });

  wsConnect();

  // Redraw on a fast, fixed cadence regardless of how often new data
  // actually arrives — keeps the display feeling live even between fetch
  // cycles, without hammering IRIS with requests it can't usefully answer
  // any faster.
  setInterval(redraw, 3000);
});
