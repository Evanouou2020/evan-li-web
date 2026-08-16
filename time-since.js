// Live "time since this post" counter. Any element with
// data-time-since="ISO timestamp" gets a ticking "Xd Xh Xm Xs ago" label
// underneath, updated once a second.
function formatElapsed(ms) {
  let s = Math.max(0, Math.floor(ms / 1000));
  const days    = Math.floor(s / 86400); s -= days * 86400;
  const hours   = Math.floor(s / 3600);  s -= hours * 3600;
  const minutes = Math.floor(s / 60);    s -= minutes * 60;
  const seconds = s;

  const parts = [];
  if (days)    parts.push(`${days}d`);
  if (hours || days)   parts.push(`${hours}h`);
  if (minutes || hours || days) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return `${parts.join(" ")} since this post`;
}

function initTimeSince() {
  const els = document.querySelectorAll("[data-time-since]");
  if (!els.length) return;

  function tick() {
    const now = Date.now();
    els.forEach((el) => {
      const then = new Date(el.getAttribute("data-time-since")).getTime();
      el.textContent = formatElapsed(now - then);
    });
  }

  tick();
  setInterval(tick, 1000);
}

document.addEventListener("DOMContentLoaded", initTimeSince);
