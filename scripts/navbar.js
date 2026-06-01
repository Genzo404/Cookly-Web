// Shared hamburger menu toggle — included on all inner pages
document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menuToggle");
  const navLinks   = document.getElementById("navLinks");

  menuToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    navLinks?.classList.toggle("active");
  });

  document.addEventListener("click", (e) => {
    if (!navLinks?.contains(e.target) && e.target !== menuToggle) {
      navLinks?.classList.remove("active");
    }
  });
});
