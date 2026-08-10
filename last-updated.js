// Shows when the site was last pushed, pulled straight from GitHub's
// commit history — no manual date to remember to update.
const REPO = "Evanouou2020/evan-li-web";
const CACHE_KEY = "evli_last_updated_v1";
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadLastUpdated() {
  const el = document.getElementById("last-updated");
  if (!el) return;

  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    const { ts, text } = JSON.parse(cached);
    if (Date.now() - ts < CACHE_TTL_MS) {
      el.textContent = text;
      return;
    }
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits?per_page=1`);
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
    const data = await res.json();
    const date = new Date(data[0].commit.committer.date);
    const text = `Last updated: ${date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    })}`;
    el.textContent = text;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), text }));
  } catch (err) {
    el.textContent = "";
  }
}

document.addEventListener("DOMContentLoaded", loadLastUpdated);
