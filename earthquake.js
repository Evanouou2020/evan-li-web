// Live earthquake lists pulled straight from the USGS FDSN event API —
// no backend, no API key required.
const USGS_BASE = "https://earthquake.usgs.gov/fdsnws/event/1/query";

// California bounding box (covers the whole state with a little margin).
const CA_BOUNDS = { minlat: 32.4, maxlat: 42.1, minlon: -124.6, maxlon: -114.0 };
const CA_WINDOW_DAYS = 30;
const MAJOR_WINDOW_YEARS = 5;
const PAGE_SIZE = 5;

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

function quakeItemHtml(f) {
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
}

// Manages one "list + Show more button" pair: shows PAGE_SIZE items at a
// time, revealing more on each click, independent of the other section.
function createQuakeSection(listId, buttonId) {
  const listEl = document.getElementById(listId);
  const buttonEl = document.getElementById(buttonId);
  let features = [];
  let shown = 0;

  function renderMore() {
    const next = features.slice(shown, shown + PAGE_SIZE);
    listEl.insertAdjacentHTML("beforeend", next.map(quakeItemHtml).join(""));
    shown += next.length;
    const remaining = features.length - shown;
    if (remaining > 0) {
      buttonEl.hidden = false;
      buttonEl.textContent = `Show more (${remaining} left)`;
    } else {
      buttonEl.hidden = true;
    }
  }

  buttonEl.addEventListener("click", renderMore);

  return {
    setFeatures(newFeatures, emptyMessage) {
      features = newFeatures;
      shown = 0;
      buttonEl.hidden = true;
      if (!features.length) {
        listEl.innerHTML = `<li class="state-msg">${emptyMessage}</li>`;
        return;
      }
      listEl.innerHTML = "";
      renderMore();
    },
    setLoading() {
      buttonEl.hidden = true;
      listEl.innerHTML = `<li class="state-msg">Loading…</li>`;
    },
    setError(message) {
      buttonEl.hidden = true;
      listEl.innerHTML = `<li class="state-msg error">${escapeHtml(message)}</li>`;
    },
  };
}

async function fetchQuakes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USGS returned ${res.status}`);
  const data = await res.json();
  return data.features;
}

async function loadCaliforniaQuakes(section) {
  const start = new Date(Date.now() - CA_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const url =
    `${USGS_BASE}?format=geojson&starttime=${start}` +
    `&minlatitude=${CA_BOUNDS.minlat}&maxlatitude=${CA_BOUNDS.maxlat}` +
    `&minlongitude=${CA_BOUNDS.minlon}&maxlongitude=${CA_BOUNDS.maxlon}` +
    `&orderby=time&limit=150`;
  try {
    const features = await fetchQuakes(url);
    section.setFeatures(features, `No earthquakes recorded in California in the past ${CA_WINDOW_DAYS} days.`);
  } catch (err) {
    section.setError(`Couldn't load California earthquakes (${err.message}).`);
  }
}

async function loadMajorQuakes(section, minMag) {
  section.setLoading();
  const start = new Date();
  start.setFullYear(start.getFullYear() - MAJOR_WINDOW_YEARS);
  const url = `${USGS_BASE}?format=geojson&starttime=${start.toISOString().slice(0, 10)}&minmagnitude=${minMag}&orderby=time&limit=100`;
  try {
    const features = await fetchQuakes(url);
    section.setFeatures(features, `No M${minMag}+ earthquakes recorded in the past ${MAJOR_WINDOW_YEARS} years.`);
  } catch (err) {
    section.setError(`Couldn't load major earthquakes (${err.message}).`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const caSection = createQuakeSection("ca-quake-list", "ca-show-more");
  const majorSection = createQuakeSection("major-quake-list", "major-show-more");

  loadCaliforniaQuakes(caSection);
  loadMajorQuakes(majorSection, 7);

  document.querySelectorAll(".mag-filter button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mag-filter button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadMajorQuakes(majorSection, Number(btn.dataset.mag));
    });
  });
});
