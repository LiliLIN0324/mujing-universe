/**
 * Numbered dots for the studio "我们做什么" section.
 * Gray until the block scrolls up; then they light one by one.
 * Scroll only — no timer. Reduced motion keeps the same states
 * with no color transition.
 */

export function mountErdos(root = document) {
  const block = root.querySelector("[data-erdos]");
  if (!block) return;
  const dots = [...block.querySelectorAll("[data-dot]")];
  if (!dots.length) return;

  const paint = () => {
    const rect = block.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const start = vh * 0.9;
    const end = vh * 0.42;
    const span = start - end || 1;
    const p = Math.min(1, Math.max(0, (start - rect.top) / span));
    const lit = Math.round(p * dots.length);
    for (let i = 0; i < dots.length; i++) {
      dots[i].classList.toggle("is-lit", i < lit);
    }
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      paint();
    });
  };

  paint();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
}
