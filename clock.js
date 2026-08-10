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

function updateClock() {
  const zone = document.getElementById("tz-select").value;
  const timeStr = new Date().toLocaleTimeString("en-US", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  document.getElementById("clock-time").textContent = timeStr;
}

document.addEventListener("DOMContentLoaded", () => {
  populateTimezoneSelect();
  updateClock();
  setInterval(updateClock, 1000);
  document.getElementById("tz-select").addEventListener("change", updateClock);
});
