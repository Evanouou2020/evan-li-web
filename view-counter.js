// Site-wide page view counter via a free public hit-counting API.
// Every page load increments the same shared counter — this is a raw
// "page views" count (not unique visitors), same as it says on the tin.
const COUNTER_NAMESPACE = "evanli-net";
const COUNTER_KEY = "total-views";

async function loadViewCount() {
  const el = document.getElementById("view-count");
  if (!el) return;
  try {
    const res = await fetch(`https://abacus.jasoncameron.dev/hit/${COUNTER_NAMESPACE}/${COUNTER_KEY}`);
    if (!res.ok) throw new Error(`Counter API returned ${res.status}`);
    const data = await res.json();
    el.textContent = `${data.value.toLocaleString()} views`;
  } catch (err) {
    el.textContent = "";
  }
}

document.addEventListener("DOMContentLoaded", loadViewCount);
