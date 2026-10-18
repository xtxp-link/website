// Progressive enhancement: if the current page's link is outside the visible
// part of the sidebar (for example after following a link from elsewhere),
// scroll the sidebar, and only the sidebar, so it shows. Runs after Starlight
// restores its own saved scroll position, and does nothing when the link is
// already visible. Without JavaScript the sidebar simply keeps its default.
(() => {
  try {
    const pane = document.querySelector('.sidebar-pane');
    const link = pane && pane.querySelector('nav[aria-label="Main"] a[aria-current="page"]');
    if (!pane || !link || pane.scrollHeight <= pane.clientHeight) return;
    const p = pane.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    const margin = 24;
    if (l.top >= p.top + margin && l.bottom <= p.bottom - margin) return;
    pane.scrollTop += l.top - p.top - pane.clientHeight / 3;
  } catch {}
})();
