/** Same auto-hide behaviour as the homepage nav (hover near the top or scroll up shows it).
 *  ≤768px global.css keeps the bar always visible, so this only matters on desktop. */
export function mountAutohideNav(nav) {
  if (!nav) return;
  let hoverTop = false;
  let scrollShown = false;
  let lastY = window.scrollY;
  const sync = () => nav.classList.toggle('is-shown', hoverTop || scrollShown);
  window.addEventListener('mousemove', (e) => {
    const near = e.clientY <= (nav.classList.contains('is-shown') ? 96 : 72);
    if (near !== hoverTop) { hoverTop = near; sync(); }
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { hoverTop = false; sync(); });
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const dy = y - lastY;
    if (y <= 4) scrollShown = false;
    else if (dy < -4) scrollShown = true;
    else if (dy > 4) scrollShown = false;
    if (Math.abs(dy) > 4 || y <= 4) lastY = y;
    sync();
  }, { passive: true });
}
