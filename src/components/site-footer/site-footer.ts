const yearElement = document.getElementById("year");

if (yearElement) {
  yearElement.textContent = String(Math.max(2026, new Date().getFullYear()));
}
