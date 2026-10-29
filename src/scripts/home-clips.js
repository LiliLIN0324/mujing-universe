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
    // 桌面章节白卡与移动端首屏各有一套进度条，按视频归属分流。
    const desktop = video.id === 'scroll-video';
    const fill = document.getElementById(desktop ? 'fs-prog-fill' : 'm-prog-fill');
    const time = document.getElementById(desktop ? 'fs-prog-time' : 'm-prog-time');
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
    // 图标按钮：播放/暂停两个 SVG 由 CSS 按 aria-pressed 切换，只刷语义属性。
    pin.setAttribute('aria-label', on ? '暂停预览' : '播放预览');
    pin.setAttribute('title', on ? '暂停预览' : '播放预览');
  }
  // 介绍卡淡出改为 JS 逐帧驱动：不依赖 CSS transition，透明度 2.5s 内匀速 100%→0，
  // 每帧直接写 inline opacity，任何浏览器行为一致（此前 CSS 过渡在部分环境静默失效）。
  const FADE_MS = 2500;
  const fades = new WeakMap();
  function hidePlate(host) {
    const plate = host.querySelector('.fs-plate');
    if (!plate) return;
    if (fades.has(host)) cancelAnimationFrame(fades.get(host));
    const cur = parseFloat(getComputedStyle(plate).opacity || '1');
    const t0 = performance.now();
    plate.style.transition = 'none';
    plate.style.visibility = '';
    plate.style.pointerEvents = '';
    plate.classList.remove('is-closed');
    const step = (now) => {
      const k = Math.min(1, (now - t0) / FADE_MS);
      plate.style.opacity = (cur * (1 - k)).toFixed(3);
      if (k < 1) fades.set(host, requestAnimationFrame(step));
      else { fades.delete(host); plate.classList.add('is-closed'); }
    };
    fades.set(host, requestAnimationFrame(step));
  }
  function showPlate(host) {
    const plate = host.querySelector('.fs-plate');
    if (!plate) return;
    if (fades.has(host)) { cancelAnimationFrame(fades.get(host)); fades.delete(host); }
    plate.classList.remove('is-closed');
    plate.style.visibility = '';
    plate.style.pointerEvents = '';
    const cur = parseFloat(plate.style.opacity || '1');
    if (cur >= 1) { plate.style.opacity = ''; return; }
    // 从当前透明度快速淡回 1（0.25s），结束后清掉内联样式回归 CSS 管理。
    plate.style.transition = 'opacity 0.25s ease';
    requestAnimationFrame(() => { plate.style.opacity = '1'; });
    setTimeout(() => {
      if (fades.has(host)) return;
      plate.style.transition = '';
      plate.style.opacity = '';
    }, 300);
  }
  function mark(host, on) {
    host.classList.toggle('is-on', on);
    paintPin(host, on);
    // 只要在播（含悬停自动播放）介绍卡就匀速淡出，暂停即弹回。
    if (host.classList.contains('fs-slide')) {
      if (on) hidePlate(host); else showPlate(host);
    }
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
    // 默认出声播放（用户明确要求所有项目默认有声）：
    // 点击/点按有手势，出声必然成功；悬停会被自动播放策略拦下，退回静音重试保证预览不中断。
    if (video.dataset.hearing !== '1') {
      video.muted = false;
      video.defaultMuted = false;
      video.removeAttribute('muted');
    }
    const attempt = video.play();
    if (attempt) attempt.then(() => {
      if (!video.muted && video.dataset.hearing !== '1') {
        video.dataset.hearing = '1';
        setHearingButtons(video, true);
        if (!raf) raf = requestAnimationFrame(tick);
      }
    }).catch((err) => {
      if (err && err.name === 'AbortError') return;
      if (!video.muted) {
        video.dataset.hearing = '';
        video.muted = true;
        video.defaultMuted = true;
        video.setAttribute('muted', '');
        setHearingButtons(video, false);
        const retry = video.play();
        if (retry) retry.catch(() => mark(host, false));
        return;
      }
      mark(host, false);
    });
  }
  function wanted(host) {
    const video = videoOf(host);
    if (!host || !video) return false;
    if (held === host) return false;
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
  // Exit from iOS native video fullscreen pauses the element. Remember that we
  // entered while playing (or just started it) and resume once, so the card
  // keeps the same clip instead of snapping back to a still.
  const resumeAfterFs = new WeakSet();
  function iosFullscreen(video) {
    if (typeof video.webkitEnterFullscreen !== 'function') return false;
    try { video.webkitEnterFullscreen(); return true; } catch (_) { return false; }
  }
  function enterFullscreen(video) {
    const req = video.requestFullscreen || video.webkitRequestFullscreen;
    const arm = () => resumeAfterFs.add(video);
    if (req) {
      try {
        const pending = req.call(video);
        if (pending && typeof pending.then === 'function') {
          pending.then(arm).catch(() => { if (iosFullscreen(video)) arm(); });
          return;
        }
        arm();
        return;
      } catch (_) {}
    }
    if (iosFullscreen(video)) arm();
  }
  function openCoverFullscreen(host) {
    const video = videoOf(host);
    if (!video) return;
    if (host.classList.contains('m-card') && host.getAttribute('aria-hidden') === 'true') return;
    if (!video.getAttribute('src') && video.dataset.src) video.src = video.dataset.src;
    if (video.paused) {
      held = null;
      pinned = host;
      start(host);
    }
    enterFullscreen(video);
    if (video.readyState < 1) {
      video.addEventListener('loadedmetadata', () => {
        const active = document.fullscreenElement || document.webkitFullscreenElement || video.webkitDisplayingFullscreen;
        if (!active) enterFullscreen(video);
      }, { once: true });
    }
  }
  function resumeAfterFullscreen(video) {
    if (!video || !resumeAfterFs.has(video)) return;
    resumeAfterFs.delete(video);
    if (!video.paused) return;
    const attempt = video.play();
    if (attempt) attempt.catch(() => {});
  }
  function togglePin(host) {
    const video = videoOf(host);
    if (!video) return;
    if (host.classList.contains('m-card') && host.getAttribute('aria-hidden') === 'true') return;
    // Portrait auto-starts the front card without pinning. A tap on that playing
    // card pauses, same as tapping a pinned clip. Desktop slides keep click-to-pin.
    if (host.classList.contains('m-card') && !video.paused) {
      pinned = null;
      held = host;
      if (video.dataset.hearing === '1') hear(video, false);
      halt(host);
      return;
    }
    if (pinned === host) {
      pinned = null;
      held = host;
      // 取消固定 = 停止预览。默认出声后每条预览都会带上 hearing 状态，
      // 这里必须先静音再暂停，否则播放按钮就再也停不下来了。
      if (video.dataset.hearing === '1') hear(video, false);
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
    // 暂停只刷新 pin 按钮；画面保留暂停帧（is-on 不动），但介绍卡要弹回来。
    video.addEventListener('pause', () => {
      paintPin(host, false);
      showPlate(host);
    });
    video.addEventListener('error', () => {
      if (!video.getAttribute('src')) return;
      if (pinned === host) pinned = null;
      showPlate(host);
      if (video.dataset.hearing === '1') {
        video.dataset.hearing = '';
        setHearingButtons(video, false);
        buttons(video).forEach((button) => { button.disabled = true; });
      }
      video.remove();
      const ctrls = host.querySelector('.m-ctrls');
      if (ctrls) ctrls.remove();
      else pin?.remove();
      host.classList.remove('is-on');
      host.removeAttribute('data-clip');
    });
    pin?.addEventListener('pointerdown', (e) => e.stopPropagation());
    pin?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePin(host);
    });
    const full = host.querySelector('.m-full');
    if (full) {
      full.addEventListener('pointerdown', (e) => e.stopPropagation());
      full.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openCoverFullscreen(host);
      });
      video.addEventListener('webkitendfullscreen', () => resumeAfterFullscreen(video));
    }
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
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) return;
    hosts().forEach((host) => resumeAfterFullscreen(videoOf(host)));
  });

  const cardStage = document.getElementById('m-stage');
  if (cardStage) {
    // Ignore the first layout pass (no user gesture). After that, becoming the
    // front card plays the cover the way a hovered desktop chapter does on switch:
    // start(), then .is-on fades the video over the still. Touch has no hover.
    let arm = false;
    new MutationObserver(() => {
      hosts().forEach((host) => {
        if (!host.classList.contains('m-card')) return;
        const video = videoOf(host);
        if (!video) return;
        const front = host.getAttribute('aria-hidden') !== 'true';
        if (!front) {
          if (pinned === host) pinned = null;
          if (!video.paused || host.classList.contains('is-on')) halt(host);
          // Peek cards show the still. The clip fades back in when this card is front again.
          host.classList.remove('is-on');
          if (over === host) over = null;
          return;
        }
        if (!arm || reduce.matches) return;
        if (!video.paused) return;
        held = null;
        start(host);
      });
    }).observe(cardStage, { subtree: true, attributes: true, attributeFilter: ['aria-hidden'] });
    requestAnimationFrame(() => { arm = true; });
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
