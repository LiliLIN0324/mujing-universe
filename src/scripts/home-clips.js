/**
 * Homepage preview clips. Same rules as the works library:
 * only a verified mp4 (data-src) plays; hover is a muted loop;
 * leaving pauses on the current frame so a re-hover resumes;
 * a click pins it; touch uses the click.
 * One clip at a time. Nothing is fetched until that interaction.
 * 聆听图景 on 西湖 only unmutes this same picture — it does not pause it.
 */
const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export function mountHomeClips() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const hosts = () => Array.from(document.querySelectorAll('[data-clip]'));
  const videoOf = (host) => host && host.querySelector('video');
  let pinned = null;
  let over = null;
  let held = null;
  let raf = 0;

  function buttons(video) {
    if (!video || !video.id) return [];
    return Array.from(document.querySelectorAll(`[aria-controls="${video.id}"]`));
  }
  function paint(video) {
    const fill = document.getElementById('m-prog-fill');
    const time = document.getElementById('m-prog-time');
    const dur = Number.isFinite(video.duration) ? video.duration : 0;
    const p = dur > 0 ? Math.min(1, video.currentTime / dur) : 0;
    if (fill) fill.style.setProperty('--prog', p.toFixed(4));
    if (time) time.textContent = `${mmss(video.currentTime)} / ${mmss(dur)}`;
  }
  function tick() {
    const video = hosts().map(videoOf).find((v) => v && v.dataset.hearing === '1' && !v.paused);
    if (!video) { raf = 0; return; }
    paint(video);
    raf = requestAnimationFrame(tick);
  }
  function setHearingButtons(video, on) {
    for (const button of buttons(video)) {
      button.setAttribute('aria-pressed', String(on));
      const label = button.querySelector('.lb');
      if (label) label.textContent = on ? '静音' : '聆听图景';
    }
    if (on && !raf) raf = requestAnimationFrame(tick);
  }
  function paintPin(host, on) {
    const pin = host.querySelector('.fs-pin');
    if (!pin) return;
    pin.setAttribute('aria-pressed', on ? 'true' : 'false');
    pin.textContent = on ? '暂停' : '预览';
    pin.setAttribute('aria-label', on ? '暂停预览' : '播放预览');
  }
  function mark(host, on) {
    host.classList.toggle('is-on', on);
    paintPin(host, on);
  }
  function halt(host) {
    const video = videoOf(host);
    if (!video) return;
    // 只暂停、不卸 src：回来都从上次位置续播；画面停在暂停帧，不再切回静图。
    // pin 按钮由 pause 事件刷成「预览」。
    video.pause();
  }
  function start(host) {
    const video = videoOf(host);
    if (!host || !video || !host.hasAttribute('data-clip')) return;
    if (host.classList.contains('m-card') && host.getAttribute('aria-hidden') === 'true') return;
    hosts().forEach((other) => {
      if (other === host) return;
      if (pinned === other) pinned = null;
      halt(other);
    });
    if (!video.getAttribute('src') && video.dataset.src) video.src = video.dataset.src;
    video.playsInline = true;
    video.loop = true;
    if (video.dataset.hearing !== '1') {
      video.muted = true;
      video.defaultMuted = true;
    }
    const attempt = video.play();
    if (attempt) attempt.catch((err) => { if (!err || err.name !== 'AbortError') mark(host, false); });
  }
  function wanted(host) {
    const video = videoOf(host);
    if (!host || !video) return false;
    return pinned === host || video.dataset.hearing === '1' || (over === host && fine.matches && !reduce.matches);
  }
  function syncFront(front) {
    const stage = document.getElementById('fs-stage');
    if (stage && stage.matches(':hover') && fine.matches && !reduce.matches) {
      over = stage.querySelector(`.fs-slide[data-i="${front}"][data-clip]`);
    }
    hosts().forEach((host) => {
      if (!host.classList.contains('fs-slide')) return;
      const mine = Number(host.dataset.i) === front;
      const video = videoOf(host);
      if (!video) return;
      if (!mine) {
        if (!video.paused || host.classList.contains('is-on')) halt(host);
        return;
      }
      if (wanted(host)) start(host);
    });
  }
  function togglePin(host) {
    const video = videoOf(host);
    if (!video) return;
    if (host.classList.contains('m-card') && host.getAttribute('aria-hidden') === 'true') return;
    if (pinned === host) {
      pinned = null;
      held = host;
      if (video.dataset.hearing === '1') return;
      halt(host);
      return;
    }
    held = null;
    pinned = host;
    start(host);
  }
  function hear(video, on) {
    if (!video) return;
    const host = video.closest('[data-clip]');
    if (on) {
      video.dataset.hearing = '1';
      video.muted = false;
      video.defaultMuted = false;
      video.removeAttribute('muted');
      try { video.volume = 1; } catch (_) {}
      setHearingButtons(video, true);
      if (host) start(host);
      return;
    }
    video.dataset.hearing = '';
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    setHearingButtons(video, false);
    if (!host) return;
    if (pinned === host || (over === host && fine.matches && !reduce.matches)) return;
    halt(host);
  }

  hosts().forEach((host) => {
    const video = videoOf(host);
    const pin = host.querySelector('.fs-pin');
    if (!video) return;
    video.addEventListener('playing', () => mark(host, true));
    // 暂停只刷新 pin 按钮；画面保留暂停帧（is-on 不动）。
    video.addEventListener('pause', () => paintPin(host, false));
    video.addEventListener('error', () => {
      if (!video.getAttribute('src')) return;
      if (pinned === host) pinned = null;
      if (video.dataset.hearing === '1') {
        video.dataset.hearing = '';
        setHearingButtons(video, false);
        buttons(video).forEach((button) => { button.disabled = true; });
      }
      video.remove();
      pin?.remove();
      host.classList.remove('is-on');
      host.removeAttribute('data-clip');
    });
    pin?.addEventListener('pointerdown', (e) => e.stopPropagation());
    pin?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePin(host);
    });
    host.addEventListener('pointerdown', () => {
      if (!host.classList.contains('m-card')) return;
      host.dataset.wasFront = host.getAttribute('aria-hidden') === 'true' ? '0' : '1';
    });
    host.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      if (host.classList.contains('m-card') && host.dataset.wasFront === '0') return;
      togglePin(host);
    });
    host.addEventListener('pointerenter', (e) => {
      if (reduce.matches || (e.pointerType !== 'mouse' && e.pointerType !== 'pen')) return;
      if (!fine.matches) return;
      if (held === host) return;
      if (host.classList.contains('m-card') && host.getAttribute('aria-hidden') === 'true') return;
      if (host.classList.contains('fs-slide') && host.style.pointerEvents === 'none') return;
      over = host;
      start(host);
    });
    host.addEventListener('pointerleave', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      if (over === host) over = null;
      if (held === host) held = null;
      const stage = document.getElementById('fs-stage');
      const stillOnChapter = host.classList.contains('fs-slide')
        && stage && e.relatedTarget instanceof Node && stage.contains(e.relatedTarget);
      if (stillOnChapter) return;
      if (pinned === host || video.dataset.hearing === '1') return;
      halt(host);
    });
  });

  document.querySelectorAll('.listen').forEach((button) => {
    const video = document.getElementById(button.getAttribute('aria-controls') || '');
    if (!video) return;
    button.addEventListener('click', () => {
      if (button.disabled) return;
      hear(video, video.dataset.hearing !== '1');
    });
  });

  document.addEventListener('home-front', (e) => syncFront(e.detail));

  const cardStage = document.getElementById('m-stage');
  if (cardStage) {
    new MutationObserver(() => {
      hosts().forEach((host) => {
        if (!host.classList.contains('m-card')) return;
        const video = videoOf(host);
        if (!video) return;
        const front = host.getAttribute('aria-hidden') !== 'true';
        if (!front) {
          if (!video.paused || host.classList.contains('is-on')) halt(host);
          if (over === host) over = null;
          return;
        }
        if (wanted(host)) start(host);
      });
    }).observe(cardStage, { subtree: true, attributes: true, attributeFilter: ['aria-hidden'] });
  }

  const stage = document.getElementById('fs-stage');
  if (stage) {
    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) return;
      hosts().forEach((host) => {
        if (!host.classList.contains('fs-slide')) return;
        const video = videoOf(host);
        if (video && !video.paused) halt(host);
      });
    }, { threshold: 0.25 }).observe(stage);
  }
  const hero = document.getElementById('scroll-hero-m');
  if (hero) {
    new IntersectionObserver((entries) => {
      const host = hero.hasAttribute('data-clip') ? hero : null;
      if (!host) return;
      if (entries[0].isIntersecting) {
        if (wanted(host)) start(host);
        return;
      }
      const video = videoOf(host);
      if (video && !video.paused) halt(host);
    }, { threshold: 0.35 }).observe(hero);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hosts().forEach((host) => {
        const video = videoOf(host);
        if (video && !video.paused) video.pause();
      });
      return;
    }
    hosts().forEach((host) => { if (wanted(host)) start(host); });
  });
}
