const nav = document.getElementById("navigation");
if (nav) {
  for (const link of nav.getElementsByTagName("a")) {
    if (link.pathname === window.location.pathname.replace(/\/$/, "")) {
      link.setAttribute("aria-current", "page");
    }
  }
}
