// Client-side router — swap this in for whatever tab-switching logic app.js
// currently uses. Give internal links a data-route attribute and href, e.g.:
//   <a href="/community" data-route>Community</a>
// Map each path to the init function that already renders that view.

const routes = {
  "/": initDashboard,
  "/community": initForum,
  "/profile": initPortfolio,
};

function render(path) {
  const view = routes[path] || routes["/"];
  view();
}

function navigate(path) {
  history.pushState({}, "", path);
  render(path);
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-route]");
  if (!link) return;
  e.preventDefault();
  navigate(link.getAttribute("href"));
});

window.addEventListener("popstate", () => render(location.pathname));

// Run once on page load so a reload/direct link lands on the right view.
render(location.pathname);
