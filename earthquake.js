// Live earthquake lists pulled straight from the USGS FDSN event API —
// no backend, no API key required.
const USGS_BASE = "https://earthquake.usgs.gov/fdsnws/event/1/query";

// California bounding box (covers the whole state with a little margin).
const CA_BOUNDS = { minlat: 32.4, maxlat: 42.1, minlon: -124.6, maxlon: -114.0 };
const CA_WINDOW_DAYS = 30;
const MAJOR_WINDOW_YEARS = 5;

function formatTime(ms) {
  return new Date(ms).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function magClass(mag) {
  if (mag == null) return "mag-minor";
  if (mag >= 7) return "mag-major";
  if (mag >= 5) return "mag-strong";
  if (mag >= 3) return "mag-moderate";
  return "mag-minor";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderQuakeList(el, features, emptyMessage) {
  if (!features.length) {
    el.innerHTML = `<li class="state-msg">${emptyMessage}</li>`;
    return;
  }
  el.innerHTML = features
    .map((f) => {
      const p = f.properties;
      const depth = f.geometry.coordinates[2];
      return `
        <li class="quake-item">
          <span class="quake-mag ${magClass(p.mag)}">M${p.mag != null ? p.mag.toFixed(1) : "?"}</span>
          <div class="quake-info">
            <div class="quake-place">${escapeHtml(p.place || "Unknown location")}</div>
            <div class="quake-meta">${formatTime(p.time)}${depth != null ? ` · ${depth.toFixed(1)} km deep` : ""}</div>
          </div>
          <a class="quake-link" href="${p.url}" target="_blank" rel="noopener">Details →</a>
        </li>`;
    })
    .join("");
}

async function fetchQuakes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USGS returned ${res.status}`);
  const data = await res.json();
  return data.features;
}

async function loadCaliforniaQuakes() {
  const el = document.getElementById("ca-quake-list");
  if (!el) return;
  const start = new Date(Date.now() - CA_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const url =
    `${USGS_BASE}?format=geojson&starttime=${start}` +
    `&minlatitude=${CA_BOUNDS.minlat}&maxlatitude=${CA_BOUNDS.maxlat}` +
    `&minlongitude=${CA_BOUNDS.minlon}&maxlongitude=${CA_BOUNDS.maxlon}` +
    `&orderby=time&limit=150`;
  try {
    const features = await fetchQuakes(url);
    renderQuakeList(el, features, `No earthquakes recorded in California in the past ${CA_WINDOW_DAYS} days.`);
  } catch (err) {
    el.innerHTML = `<li class="state-msg error">Couldn't load California earthquakes (${escapeHtml(err.message)}).</li>`;
  }
}

async function loadMajorQuakes(minMag) {
  const el = document.getElementById("major-quake-list");
  if (!el) return;
  el.innerHTML = `<li class="state-msg">Loading…</li>`;
  const start = new Date();
  start.setFullYear(start.getFullYear() - MAJOR_WINDOW_YEARS);
  const url = `${USGS_BASE}?format=geojson&starttime=${start.toISOString().slice(0, 10)}&minmagnitude=${minMag}&orderby=time&limit=100`;
  try {
    const features = await fetchQuakes(url);
    renderQuakeList(el, features, `No M${minMag}+ earthquakes recorded in the past ${MAJOR_WINDOW_YEARS} years.`);
  } catch (err) {
    el.innerHTML = `<li class="state-msg error">Couldn't load major earthquakes (${escapeHtml(err.message)}).</li>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadCaliforniaQuakes();
  loadMajorQuakes(7);

  document.querySelectorAll(".mag-filter button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mag-filter button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadMajorQuakes(Number(btn.dataset.mag));
    });
  });
});
