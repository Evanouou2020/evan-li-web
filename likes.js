// Per-post like counter — a real shared count via the same hit-counting
// API view-counter.js already uses. Guarded by localStorage so one browser
// can only add one like per post (this is a one-way like, not a toggle —
// the counter API has no "undo").
const LIKES_NAMESPACE = "evanli-net";

async function getLikes(key) {
  const res = await fetch(`https://abacus.jasoncameron.dev/get/${LIKES_NAMESPACE}/${key}`);
  if (!res.ok) return 0;
  const data = await res.json();
  return data.value || 0;
}

async function hitLikes(key) {
  const res = await fetch(`https://abacus.jasoncameron.dev/hit/${LIKES_NAMESPACE}/${key}`);
  if (!res.ok) throw new Error(`Counter API returned ${res.status}`);
  const data = await res.json();
  return data.value;
}

function initLikeButtons() {
  document.querySelectorAll("[data-like-post]").forEach(async (root) => {
    const slug       = root.getAttribute("data-like-post");
    const key         = `likes-${slug}`;
    const storageKey  = `liked_${slug}`;
    const btn         = root.querySelector(".like-btn");
    const countEl     = root.querySelector(".like-count");
    if (!btn || !countEl) return;

    if (localStorage.getItem(storageKey) === "1") {
      btn.classList.add("liked");
      btn.disabled = true;
      btn.setAttribute("aria-pressed", "true");
    }

    try {
      countEl.textContent = await getLikes(key);
    } catch (err) {
      countEl.textContent = "0";
    }

    btn.addEventListener("click", async () => {
      if (localStorage.getItem(storageKey) === "1") return;
      btn.disabled = true;
      try {
        const value = await hitLikes(key);
        countEl.textContent = value;
        localStorage.setItem(storageKey, "1");
        btn.classList.add("liked");
        btn.setAttribute("aria-pressed", "true");
      } catch (err) {
        btn.disabled = false;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", initLikeButtons);
