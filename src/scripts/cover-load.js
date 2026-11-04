/**
 * 首页封面按需加载：模糊底图先上屏，真图在快要看到时再换。
 * data-src / data-srcset 由 index.astro 写入；没有这两个属性的图不处理。
 */
export function loadCover(img) {
  if (!img || img.dataset.coverLoaded === '1') return;
  const src = img.dataset.src;
  const srcset = img.dataset.srcset;
  if (!src && !srcset) return;
  img.dataset.coverLoaded = '1';
  if (srcset) img.setAttribute('srcset', srcset);
  if (src) img.setAttribute('src', src);
  img.classList.remove('is-lqip');
}
