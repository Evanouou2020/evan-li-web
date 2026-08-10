// Click-to-toggle dropdown for nav items with sub-pages (e.g. "Earthquake").
// Click-based rather than hover-only so it works on touch devices too.
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-dropdown").forEach((dropdown) => {
    const toggle = dropdown.querySelector(".nav-dropdown-toggle");
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains("open");
      document.querySelectorAll(".nav-dropdown.open").forEach((d) => d.classList.remove("open"));
      if (!isOpen) dropdown.classList.add("open");
    });
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".nav-dropdown.open").forEach((d) => d.classList.remove("open"));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".nav-dropdown.open").forEach((d) => d.classList.remove("open"));
    }
  });
});
