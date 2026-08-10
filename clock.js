// World clock: updates every second, timezone switchable via the dropdown.
const TIMEZONES = [
  { label: "Pacific Time", zone: "America/Los_Angeles" },
  { label: "Mountain Time", zone: "America/Denver" },
  { label: "Central Time", zone: "America/Chicago" },
  { label: "Eastern Time", zone: "America/New_York" },
  { label: "UTC", zone: "UTC" },
  { label: "London", zone: "Europe/London" },
  { label: "Paris / Berlin", zone: "Europe/Paris" },
  { label: "Tokyo", zone: "Asia/Tokyo" },
  { label: "Shanghai / Beijing", zone: "Asia/Shanghai" },
  { label: "Sydney", zone: "Australia/Sydney" },
  { label: "Mumbai / Delhi", zone: "Asia/Kolkata" },
];

const DEFAULT_ZONE = "America/Los_Angeles";

function populateTimezoneSelect() {
  const select = document.getElementById("tz-select");
  TIMEZONES.forEach(({ label, zone }) => {
    const opt = document.createElement("option");
    opt.value = zone;
    opt.textContent = label;
    if (zone === DEFAULT_ZONE) opt.selected = true;
    select.appendChild(opt);
  });
}

// ISO 8601 week date: which ISO week-year/week-number/weekday a given
// (year, month, day) civil date falls on. Computed manually since there's
// no reliable built-in for it.
function getISOWeekParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const isoDay = (date.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  date.setUTCDate(date.getUTCDate() - isoDay + 3); // nearest Thursday
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstIsoDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstIsoDay + 3);
  const week = 1 + Math.round((date - firstThursday) / (7 * 86400000));
  return { isoYear, week, isoDay: isoDay + 1 }; // weekday as Mon=1 .. Sun=7
}

function updateClock() {
  const zone = document.getElementById("tz-select").value;
  const now = new Date();

  document.getElementById("clock-time").textContent = now.toLocaleTimeString("en-US", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  document.getElementById("clock-date").textContent = now.toLocaleDateString("en-US", {
    timeZone: zone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // en-CA formats as YYYY-MM-DD, giving us the civil date in `zone`
  // without any local-machine timezone interference.
  const [y, m, d] = now
    .toLocaleDateString("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" })
    .split("-")
    .map(Number);
  const { isoYear, week, isoDay } = getISOWeekParts(y, m, d);
  document.getElementById("clock-iso").textContent =
    `${isoYear}.${String(week).padStart(2, "0")}.${isoDay}`;
}

document.addEventListener("DOMContentLoaded", () => {
  populateTimezoneSelect();
  updateClock();
  setInterval(updateClock, 1000);
  document.getElementById("tz-select").addEventListener("change", updateClock);
});
