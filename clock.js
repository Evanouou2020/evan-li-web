// World clock: updates every second, timezone switchable via the dropdown.
const DEFAULT_ZONE = "America/Los_Angeles";

// Fallback list for browsers without Intl.supportedValuesOf (rare in 2026).
const FALLBACK_ZONES = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "UTC", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Asia/Shanghai",
  "Australia/Sydney", "Asia/Kolkata",
];

// Offset (in minutes, e.g. -420 for UTC-7) of `zone` at instant `date`.
// Works by asking Intl what the wall-clock reads in that zone, then
// comparing that to the actual UTC instant.
function getOffsetMinutes(zone, date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  // Round to the nearest whole minute — real-world zone offsets are always
  // minute-granular, but the millisecond component of `date` (dropped when
  // Intl formats it to whole seconds) otherwise leaks in as float noise.
  return Math.round((asUTC - date.getTime()) / 60000);
}

function formatOffset(offsetMinutes) {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${sign}${h}` : `${sign}${h}:${String(m).padStart(2, "0")}`;
}

function buildTimezoneList(now) {
  const zones = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : FALLBACK_ZONES;

  const list = zones.map((zone) => {
    let longName = zone;
    try {
      const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "long" })
        .formatToParts(now)
        .find((p) => p.type === "timeZoneName");
      if (part) longName = part.value;
    } catch (e) {
      // some obscure zones may not resolve a long name — fall back to the id
    }
    const offsetMinutes = getOffsetMinutes(zone, now);
    return { zone, offsetMinutes, label: `${longName} (UTC${formatOffset(offsetMinutes)})` };
  });

  list.sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.label.localeCompare(b.label));

  // Many IANA zone ids share an identical label (e.g. every US Central
  // city shows "Central Daylight Time (UTC-5)") — keep just one per label.
  // If DEFAULT_ZONE is in a group, make sure it's specifically the one kept.
  const indexByLabel = new Map();
  const deduped = [];
  list.forEach((entry) => {
    if (!indexByLabel.has(entry.label)) {
      indexByLabel.set(entry.label, deduped.length);
      deduped.push(entry);
    } else if (entry.zone === DEFAULT_ZONE) {
      deduped[indexByLabel.get(entry.label)] = entry;
    }
  });
  return deduped;
}

function populateTimezoneSelect() {
  const select = document.getElementById("tz-select");
  const list = buildTimezoneList(new Date());
  list.forEach(({ zone, label }) => {
    const opt = document.createElement("option");
    opt.value = zone;
    opt.textContent = label;
    select.appendChild(opt);
  });
  select.value = DEFAULT_ZONE;
}

// ISO 8601 week number for a given (year, month, day) civil date.
function getISOWeek(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const isoDay = (date.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  date.setUTCDate(date.getUTCDate() - isoDay + 3); // nearest Thursday
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstIsoDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstIsoDay + 3);
  return 1 + Math.round((date - firstThursday) / (7 * 86400000));
}

// UTC instant of "Jan 1, 00:00:00" wall-clock time in `zone`, for `year`.
function getZonedYearStartMs(year, zone) {
  const guess = Date.UTC(year, 0, 1, 0, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(guess)).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  const zonedAsUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  return guess + (guess - zonedAsUTC);
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

  const week = getISOWeek(y, m, d);
  const yearStartMs = getZonedYearStartMs(y, zone);
  const elapsedMs = now.getTime() - yearStartMs;
  const daysElapsed = Math.floor(elapsedMs / 86400000);
  const hoursElapsed = Math.floor(elapsedMs / 3600000);
  const minutesElapsed = Math.floor(elapsedMs / 60000);
  const secondsElapsed = Math.floor(elapsedMs / 1000);

  document.getElementById("clock-iso").textContent =
    `${y}.${m}.${week}.${daysElapsed}.${hoursElapsed}.${minutesElapsed}.${secondsElapsed}`;
}

document.addEventListener("DOMContentLoaded", () => {
  populateTimezoneSelect();
  updateClock();
  setInterval(updateClock, 1000);
  document.getElementById("tz-select").addEventListener("change", updateClock);
});
