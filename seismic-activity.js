// "Combined Seismic Activity" card: finds the largest earthquake worldwide
// in the selected period and classifies it into an activity band.
const ACTIVITY_USGS_BASE = "https://earthquake.usgs.gov/fdsnws/event/1/query";

const ACTIVITY_LEVELS = [
  { name: "Low", max: 5.8, color: "#5a8a5a", bg: "#eef6ee" },
  { name: "Normal", max: 6.4, color: "#3a6fd8", bg: "#eaf1fc" },
  { name: "Moderate", max: 7.0, color: "#b8860b", bg: "#fbf3e0" },
  { name: "High", max: 7.6, color: "#d9720e", bg: "#fdf0e3" },
  { name: "Very High", max: 8.0, color: "#c0392b", bg: "#fbe8e6" },
  { name: "Extreme", max: Infinity, color: "#8b1a1a", bg: "#f7e0df" },
];

function classifyMagnitude(mag) {
  return ACTIVITY_LEVELS.find((level) => mag < level.max) || ACTIVITY_LEVELS[ACTIVITY_LEVELS.length - 1];
}

function periodStart(period) {
  const now = new Date();
  if (period === "today") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  if (period === "week") {
    return new Date(now.getTime() - 7 * 86400000);
  }
  return new Date(now.getTime() - 30 * 86400000); // month
}

const PERIOD_LABELS = { today: "Today (UTC)", week: "This Week (UTC)", month: "This Month (UTC)" };

async function loadSeismicActivity(period) {
  const magEl = document.getElementById("activity-mag");
  const levelPill = document.getElementById("activity-level");
  const levelName = document.getElementById("activity-level-name");
  const periodLabel = document.getElementById("activity-period-label");
  if (!magEl) return;

  periodLabel.textContent = PERIOD_LABELS[period] || "Today (UTC)";
  magEl.textContent = "—";
  levelName.textContent = "Loading…";

  const start = periodStart(period).toISOString().slice(0, 19);
  const url = `${ACTIVITY_USGS_BASE}?format=geojson&starttime=${start}&orderby=magnitude&limit=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`USGS returned ${res.status}`);
    const data = await res.json();
    const top = data.features[0];
    if (!top) {
      magEl.textContent = "—";
      levelName.textContent = "No data";
      return;
    }
    const mag = top.properties.mag;
    const level = classifyMagnitude(mag);
    magEl.textContent = mag.toFixed(2);
    levelName.textContent = level.name;
    levelPill.style.color = level.color;
    levelPill.style.background = level.bg;
    levelPill.style.borderColor = level.color;
  } catch (err) {
    magEl.textContent = "—";
    levelName.textContent = "Couldn't load";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const select = document.getElementById("activity-period");
  if (!select) return;
  loadSeismicActivity(select.value);
  select.addEventListener("change", () => loadSeismicActivity(select.value));
});
