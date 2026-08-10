// Site-wide page view counters via a free public hit-counting API.
// "Today" is a separate key that naturally starts fresh each day — e.g.
// "views-2026-08-10" only ever gets hit on August 10 — anchored to
// Pacific time (not each visitor's own timezone) so "today" means the
// same thing for every visitor.
const COUNTER_NAMESPACE = "evanli-net";
const REFERENCE_ZONE = "America/Los_Angeles";

function getPacificDateKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: REFERENCE_ZONE });
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

  try {
    const [today, total] = await Promise.all([
      hit(`views-${getPacificDateKey()}`),
      hit("total-views"),
    ]);
    el.textContent = `Today: ${today.toLocaleString()} · Total views: ${total.toLocaleString()}`;
  } catch (err) {
    el.textContent = "";
  }
}

document.addEventListener("DOMContentLoaded", loadViewCounts);
