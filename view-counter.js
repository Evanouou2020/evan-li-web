// Site-wide page view counters via a free public hit-counting API.
// The API only does simple monotonic counters (no built-in time windows),
// so "today"/"this month"/"this year" are implemented as separate keys
// that naturally start fresh each period — e.g. "views-2026-08-10" only
// ever gets hit on August 10, so it's inherently a same-day-only count.
// All period boundaries are anchored to Pacific time (not each visitor's
// own timezone) so "today" means the same thing for every visitor.
const COUNTER_NAMESPACE = "evanli-net";
const REFERENCE_ZONE = "America/Los_Angeles";

function getPacificDateParts() {
  const [year, month, day] = new Date()
    .toLocaleDateString("en-CA", { timeZone: REFERENCE_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
    .split("-");
  return { year, month, day };
}

async function hit(key) {
  const res = await fetch(`https://abacus.jasoncameron.dev/hit/${COUNTER_NAMESPACE}/${key}`);
  if (!res.ok) throw new Error(`Counter API returned ${res.status}`);
  const data = await res.json();
  return data.value;
}

async function loadViewCounts() {
  const el = document.getElementById("view-counts");
  if (!el) return;

  const { year, month, day } = getPacificDateParts();
  try {
    const [today, thisMonth, thisYear, total] = await Promise.all([
      hit(`views-${year}-${month}-${day}`),
      hit(`views-${year}-${month}`),
      hit(`views-${year}`),
      hit("total-views"),
    ]);
    el.textContent =
      `Today: ${today.toLocaleString()} · This month: ${thisMonth.toLocaleString()} · ` +
      `This year: ${thisYear.toLocaleString()} · Total views: ${total.toLocaleString()}`;
  } catch (err) {
    el.textContent = "";
  }
}

document.addEventListener("DOMContentLoaded", loadViewCounts);
