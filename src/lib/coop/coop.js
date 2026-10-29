/*!
 * coop.js v0.1.0 — 一行 script 给任何网站养一群鸡
 * 光标小鸡 · 点空白下蛋 · 图鉴收集（软保底/概率公示）· 跨页账本 · 触发点微光 · 品种音高
 * 零依赖、零追踪、localStorage 本地账。MIT。
 * 引擎与行为规范：web-pet-layer skill；默认美术包 © 林丽丽（授权条款确认前请勿公开分发本包）。
 * 公开事件 API（window CustomEvent）：farm:state / farm:say / farm:cmd / farm:toggle / farm:open
 */
const CSS = `/* v2：全站隐形舞台。#farm 本体透明、不挡点击（pointer-events:none），只有鸡/蛋/HUD/浮层可交互。 */
  .farm {
    --ink: #1a1a1c;
    --paper: #f6f5f3;
    --card: #fffdf4;
    --orange: #ff690a;
    color: var(--ink);
    font-family: "Alibaba PuHuiTi 3.0", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif;
    line-height: 1.4;
    position: fixed;
    inset: 0;
    z-index: 90;
    pointer-events: none;
    overflow: hidden;
    background: transparent;
    user-select: none;
    -webkit-user-select: none;
  }
  .farm.is-flash { animation: farm-flash 0.7s ease-out; } /* 传说出壳：全屏橙光一瞬 */
  @keyframes farm-flash {
    0% { box-shadow: inset 0 0 0 9999px rgba(255, 105, 10, 0); }
    22% { box-shadow: inset 0 0 0 9999px rgba(255, 105, 10, 0.2); }
    100% { box-shadow: inset 0 0 0 9999px rgba(255, 105, 10, 0); }
  }
  @media (prefers-reduced-motion: reduce) { .farm.is-flash { animation: none; } }

  /* 鸡琴（手铃制）：视口底部琴条，一键一鸡，鸡啄=琴响 */
  .farm-piano {
    position: fixed;
    left: 50%;
    bottom: -96px;
    transform: translateX(-50%);
    z-index: 88;
    display: flex;
    width: min(640px, 92vw);
    height: 84px;
    border: 1px solid var(--ink);
    background: #fffdf4;
    transition: bottom 0.5s cubic-bezier(0.22, 1.2, 0.36, 1);
  }
  .farm-piano.is-up { bottom: 14px; }
  .farm-key {
    flex: 1;
    position: relative;
    border-right: 1px solid rgba(26, 26, 28, 0.25);
    background: #fff;
    transition: transform 0.09s ease, background 0.09s ease;
    transform-origin: 50% 0;
  }
  .farm-key:last-child { border-right: 0; }
  .farm-key.is-down { transform: scaleY(0.965); background: #ffe3c8; }
  .farm-key em {
    position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%);
    font-style: normal; font-size: 11px; color: #9a9a9a; letter-spacing: 0.08em;
  }
  /* 黑键：窄、短、骑在白键接缝上（真实钢琴布局） */
  .farm-key.is-black {
    position: absolute;
    width: 58%;
    height: 62%;
    top: 0;
    background: #1a1a1c;
    border: 1px solid #1a1a1c;
    border-top: 0;
    z-index: 3;
    box-shadow: inset 0 -3px 0 rgba(255, 255, 255, 0.08);
  }
  .farm-key.is-black.is-down { background: #442c08; transform: scaleY(0.9); }
  .farm-key.is-black em { color: #cfcfcf; bottom: 4px; }
  @media (prefers-reduced-motion: reduce) { .farm-piano { transition: none; } }

  /* 地琴：场上家具，不是底边 HUD。白键乳白、黑键近黑，琴架浅木色。 */
  .farm-floor {
    position: absolute; left: 0; top: 0;
    display: flex; flex-direction: column; width: 420px;
    box-sizing: border-box; background: #f7f1e4; border: 1px solid #1a1a1c;
    pointer-events: auto; touch-action: none; user-select: none;
  }
  .farm-floor.is-drag { cursor: grabbing; }
  .farm-floor[hidden] { display: none !important; }
  .farm-grip { height: 8px; flex: none; background: #2a241c; cursor: grab; }
  .farm-keys { display: flex; height: 78px; position: relative; }
  .farm-fkey { flex: 1; position: relative; height: 100%; }
  .farm-fkey .w {
    height: 100%; margin: 0 1px; background: #fffef8;
    border-radius: 0 0 4px 4px; box-shadow: inset 0 -6px 0 #f3ead8;
    display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px;
  }
  .farm-fkey .w em { font-style: normal; font-size: 10px; color: #8d8778; pointer-events: none; }
  .farm-fkey .b {
    position: absolute; left: 100%; top: 0; width: 50%; height: 70%;
    transform: translateX(-50%); z-index: 1; pointer-events: auto;
    background: #141416; border-radius: 0 0 3px 3px;
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.45);
  }
  .farm-fkey .w.active { background: #ffe7c2; transform: translateY(2px); }
  .farm-fkey .b.active { background: #3a2410; height: 68%; }
  /* 货架：Factorish/Dewdrop 式小图标槽，默认可收起，少挡画面 */
  .farm-shelf {
    position: fixed; left: 14px; bottom: 50px; z-index: 1100;
    display: flex; align-items: center; gap: 4px;
    pointer-events: auto; background: transparent; border: 0; padding: 0;
  }
  .farm-shelf-toggle {
    font: inherit; font-size: 11px; font-weight: 700; line-height: 1;
    height: 28px; padding: 0 8px; white-space: nowrap;
    border: 1px solid #1a1a1c; background: rgba(255,253,244,0.92); color: #1a1a1c; cursor: pointer;
  }
  .farm-shelf-toggle[aria-expanded="true"] { background: #1a1a1c; color: #fffef8; }
  .farm-shelf-toggle.is-armed { box-shadow: 0 0 0 2px #00ffff; }
  .farm-shelf-slots {
    display: flex; align-items: center; gap: 3px;
  }
  .farm-shelf.is-stowed .farm-shelf-slots { display: none; }
  .farm-prop {
    font: inherit; font-size: 0; line-height: 0;
    width: 32px; height: 32px; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid #1a1a1c; background: rgba(255,253,244,0.92); color: #1a1a1c; cursor: pointer;
  }
  .farm-prop em { display: none; }
  .farm-prop.is-armed { box-shadow: 0 0 0 2px #00ffff; background: #fffdf4; }
  .farm-prop:focus-visible { outline: 2px solid #00ffff; outline-offset: 2px; }
  .farm-ico { display: block; pointer-events: none; }
  .farm-ico.rice { position: relative; width: 18px; height: 14px; }
  .farm-ico.rice i {
    position: absolute; width: 5px; height: 5px; border-radius: 50%; background: #e2b23a;
    box-shadow: 0 0 0 1px rgba(26, 26, 28, 0.25);
  }
  .farm-ico.rice i:nth-child(1) { left: 1px; top: 6px; }
  .farm-ico.rice i:nth-child(2) { left: 6px; top: 1px; }
  .farm-ico.rice i:nth-child(3) { left: 12px; top: 7px; }
  .farm-ico.piano {
    width: 20px; height: 12px; background: #fffef8; border: 1px solid #1a1a1c; position: relative;
  }
  .farm-ico.piano::before {
    content: ""; position: absolute; left: 0; right: 0; top: 0; height: 7px;
    background:
      linear-gradient(#141416, #141416) 16% 0 / 12% 100% no-repeat,
      linear-gradient(#141416, #141416) 34% 0 / 12% 100% no-repeat,
      linear-gradient(#141416, #141416) 62% 0 / 12% 100% no-repeat,
      linear-gradient(#141416, #141416) 80% 0 / 12% 100% no-repeat;
  }
  .farm-shelf-tip { display: none; }
  .farm-ghost {
    position: fixed; left: 0; top: 0; width: 28px; height: 18px;
    margin: -9px 0 0 -14px; opacity: 0.5; pointer-events: none; z-index: 1002;
  }
  .farm-ghost[hidden] { display: none !important; }
  .farm-ghost i {
    position: absolute; width: 5px; height: 5px; border-radius: 50%; background: #e2b23a;
  }
  .farm-ghost.is-piano {
    width: 168px; height: 36px; margin: -18px 0 0 -84px;
    background: #fffef8; border: 1px solid #1a1a1c; opacity: 0.55;
  }
  .farm-ghost.is-piano::before {
    content: ""; position: absolute; left: 0; right: 0; top: 0; height: 6px; background: #2a241c;
  }

  /* 气氛层：默认全关。网页不按本地时钟铺夜幕。以后一次性事件（烟花等）可短暂使用，用完卸下。 */
  .farm-night {
    position: absolute; inset: 0; pointer-events: none; z-index: 5;
    background: #0b1030; opacity: 0; transition: opacity 1.2s ease;
  }
  .farm-night .farm-star { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #fff; opacity: 0.7; }
  /* 谷粒 */
  .farm-grain { position: absolute; width: 4px; height: 4px; border-radius: 50%;
    background: #d9a441; box-shadow: 0 0 0 1px rgba(26,26,28,0.15); pointer-events: none; }
  /* 睡觉 Z 气泡 */
  .farm-zzz { position: absolute; font-size: 12px; color: #9fb8d9; pointer-events: none;
    animation: farm-zzz 1.6s ease-out forwards; }
  @keyframes farm-zzz { from { opacity: 0.9; transform: translateY(0); } to { opacity: 0; transform: translateY(-26px); } }
  @media (prefers-reduced-motion: reduce) { .farm-zzz { animation: none; opacity: 0.7; } }
  .farm * { box-sizing: border-box; margin: 0; padding: 0; }
  .farm .farm-fkey .w { padding-bottom: 5px; }
  #coop-reopen { position: fixed; left: 14px; bottom: 14px; z-index: 165;
    display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px;
    border: 1px solid #1a1a1c; background: #fffdf4; color: #1a1a1c;
    font: 600 13px "Alibaba PuHuiTi 3.0","PingFang SC",system-ui,sans-serif; cursor: pointer; }
  #coop-reopen:hover { background: #ff690a; border-color: #ff690a; color: #fff; }
  #coop-reopen[hidden] { display: none !important; } /* display:inline-flex 会压过 hidden 属性，必须显式压制（否则药丸与 HUD 同屏） */
  .farm [hidden] { display: none !important; }

  .farm-stage {
    position: absolute;
    inset: 0;
    background: transparent;
    pointer-events: none;
  }
  .farm-layer { position: absolute; inset: 0; pointer-events: none; z-index: 1; }

  /* 光标即小鸡：开着时全站藏系统光标（reduced-motion 例外，见文末） */
  body.farm-on, body.farm-on * { cursor: none !important; }
  /* 对话框、面板、表单内恢复真光标：那里没有小鸡，不能让指针失明 */
  body.farm-on :is(.mimi-panel, .farm-card, input, textarea, select),
  body.farm-on :is(.mimi-panel, .farm-card, input, textarea, select) * { cursor: auto !important; }
  /* 触发点微光：精确落点的橙色光点（小鸡是身体，光点是喙）+ 可点元素橙色描边 */
  .farm-dot {
    position: fixed; left: 0; top: 0; width: 7px; height: 7px;
    margin: -3px 0 0 -3px; background: #ff690a;
    box-shadow: 0 0 6px 2px rgba(255, 105, 10, 0.55);
    z-index: 1001; pointer-events: none; will-change: transform;
    opacity: 0; transition: opacity 0.15s ease;
  }
  .farm-dot.is-live { opacity: 1; }
  .farm-dot.is-hidden { opacity: 0; }
  .farm-glow { outline: 2px solid #ff690a; outline-offset: 1px; }
  @media (hover: none), (pointer: coarse) { .farm-dot { display: none; } }

  /* HUD：左下角小药丸 */
  .farm-hud {
    position: fixed; left: 14px; bottom: 14px;
    display: flex; align-items: center; gap: 2px; flex-wrap: nowrap;
    pointer-events: auto; z-index: 1100;
    background: var(--card); border: 1px solid var(--ink);
    padding: 3px 4px 3px 6px;
    max-width: calc(100vw - 28px); overflow-x: auto; scrollbar-width: none;
  }
  .farm-hud::-webkit-scrollbar { display: none; }
  .farm-stats { display: flex; align-items: center; gap: 2px; flex-wrap: nowrap; }
  .farm-stat {
    display: inline-flex; align-items: center; gap: 3px;
    background: transparent; border: 0;
    padding: 2px 4px; font-size: 12px; font-weight: 600; white-space: nowrap;
  }
  .farm-stat b { font-size: 12px; font-variant-numeric: tabular-nums; }
  .farm-brand { background: var(--ink); color: var(--paper); padding: 3px 7px; }
  .farm-btns { display: flex; gap: 2px; flex-wrap: nowrap; pointer-events: auto; }
  .farm-btn {
    font: inherit; font-size: 12px; font-weight: 600;
    background: transparent; border: 1px solid transparent;
    padding: 3px 7px; cursor: pointer; color: var(--ink); white-space: nowrap;
  }
  .farm-btn:hover { background: var(--orange); color: #fff; }
  .farm-btn:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
  .farm-btn[aria-pressed="true"] { background: var(--orange); color: #fff; }

  .farm-hint {
    position: fixed; left: 14px; bottom: 52px;
    background: var(--card); border: 1px solid var(--ink);
    padding: 3px 8px; font-size: 12px; font-weight: 600; white-space: nowrap;
    z-index: 1050; pointer-events: none; transition: opacity 0.4s ease;
  }
  .farm-hint.is-off { opacity: 0; }

  /* 跟随光标的小鸡：悬停 UI 面板/输入聚焦时淡出（updateCursorVisibility 控制 opacity） */
  .farm-cursor { position: absolute; left: 0; top: 0; width: 56px; height: 67px; z-index: 1000; pointer-events: none; will-change: transform; transition: opacity 0.2s ease; }
  .farm-cursor-in { width: 100%; height: 100%; transform-origin: 50% 88%; }
  .farm-cursor svg { width: 100%; height: 100%; display: block; }
  .farm-cursor-in.is-squat { animation: farm-squat 0.34s ease both; }
  @keyframes farm-squat { 0% { transform: translateY(0) scaleY(1); } 45% { transform: translateY(5px) scaleY(0.72); } 100% { transform: translateY(0) scaleY(1); } }

  /* 游走的小鸡 */
  .farm-chick { position: absolute; left: 0; top: 0; width: 40px; height: 48px; pointer-events: auto; will-change: transform; }
  .farm-chick-wob, .farm-chick-in { width: 100%; height: 100%; transform-origin: 50% 90%; }
  .farm-chick svg { width: 100%; height: 100%; display: block; }
  .farm-chick.is-fade { opacity: 0; transition: opacity 0.8s linear; }
  .farm-chick-in.is-pop { animation: farm-pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1) both; }
  @keyframes farm-pop { 0% { transform: scale(0.1) translateY(8px); } 70% { transform: scale(1.14) translateY(-5px); } 100% { transform: scale(1) translateY(0); } }
  .farm-chick-in.is-hop { animation: farm-hop 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) both; }
  @keyframes farm-hop { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-16px); } }
  .farm-chick-in.is-peck { animation: farm-peck 0.9s ease-in-out both; }
  @keyframes farm-peck { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(24deg); } 45% { transform: rotate(2deg); } 65% { transform: rotate(21deg); } }

  /* 蛋与蛋壳（蛋可点，作为世界的一部分） */
  .farm-egg { position: absolute; left: 0; top: 0; width: 34px; height: 41px; margin-left: -17px; margin-top: -41px; pointer-events: auto; }
  .farm-egg svg { width: 100%; height: 100%; display: block; transform-origin: 50% 100%; }
  .farm-egg.is-drop svg { animation: farm-drop 0.5s cubic-bezier(0.3, 0.7, 0.4, 1) both; }
  @keyframes farm-drop { 0% { transform: translateY(-64px); } 55% { transform: translateY(0); } 72% { transform: translateY(-12px); } 86% { transform: translateY(0); } 100% { transform: translateY(0); } }
  .farm-egg.is-wob svg { animation: farm-wob 1.15s ease-in-out both; }
  @keyframes farm-wob { 0% { transform: rotate(0); } 15% { transform: rotate(-9deg); } 35% { transform: rotate(8deg); } 55% { transform: rotate(-7deg); } 75% { transform: rotate(5deg); } 90% { transform: rotate(-3deg); } 100% { transform: rotate(0); } }
  .farm-egg.is-crack { --cfcrack: 1; }
  .farm-shells { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; }
  .farm-shl { position: absolute; display: block; }
  .farm-shl-b { width: 30px; height: 20px; left: -15px; top: -19px; animation: farm-shlb 0.75s ease both; }
  .farm-shl-t { width: 30px; height: 22px; left: -15px; top: -43px; animation: farm-shlt 0.75s cubic-bezier(0.2, 0.7, 0.4, 1) both; }
  @keyframes farm-shlb { 0% { transform: translateY(0); opacity: 1; } 35% { transform: translateY(-7px); opacity: 1; } 100% { transform: translateY(1px); opacity: 0; } }
  @keyframes farm-shlt { 0% { transform: translate(0, 0) rotate(0); opacity: 1; } 100% { transform: translate(-34px, -42px) rotate(-130deg); opacity: 0; } }

  /* 视觉音符：品种音发声处浮起一枚 ♪（品种色、12-18px、上浮 40px 渐隐 1.6s） */
  .farm-note {
    position: absolute; z-index: 950; pointer-events: none;
    font-weight: 700; line-height: 1;
    transform: translate(-50%, -100%);
    text-shadow: 0 1px 0 rgba(255, 253, 244, 0.85);
    will-change: transform, opacity;
    animation: farm-noteup 1.6s ease-out both;
  }
  @keyframes farm-noteup {
    0% { opacity: 0; transform: translate(-50%, -100%); }
    15% { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%, calc(-100% - 40px)); }
  }

  /* 气泡 */
  .farm-bubble {
    position: absolute; transform: translate(-50%, -100%);
    background: var(--card); border: 1px solid var(--ink);
    padding: 4px 9px; font-size: 12px; font-weight: 600; white-space: nowrap;
    z-index: 900; pointer-events: none;
    animation: farm-bubin 0.16s ease both, farm-bubout 0.3s ease 1.55s both;
  }
  .farm-bubble::after {
    content: ""; position: absolute; left: 50%; bottom: -4.5px; width: 7px; height: 7px;
    background: var(--card); border-right: 1px solid var(--ink); border-bottom: 1px solid var(--ink);
    transform: translateX(-50%) rotate(45deg);
  }
  @keyframes farm-bubin { 0% { transform: translate(-50%, -30%) scale(0.6); opacity: 0; } 100% { transform: translate(-50%, -100%) scale(1); opacity: 1; } }
  @keyframes farm-bubout { to { opacity: 0; } }

  /* 手册与地图浮层（全屏遮罩 + 居中卡片） */
  .farm-wrap { position: absolute; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center; pointer-events: none; padding: 12px; }
  .farm-scrim { position: absolute; inset: 0; background: rgba(26, 26, 28, 0.3); pointer-events: auto; cursor: pointer; }
  .farm-card {
    position: relative; pointer-events: auto; cursor: auto;
    background: var(--card); border: 1px solid var(--ink);
    width: min(560px, 100%); max-height: 100%; overflow: auto; padding: 14px;
  }
  .farm-cardhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .farm-cardhead b { font-size: 15px; }
  .farm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 8px; }
  .farm-cell { border: 1px solid var(--ink); background: var(--paper); padding: 8px 6px; display: flex; flex-direction: column; align-items: center; gap: 3px; text-align: center; }
  .farm-cellimg { position: relative; width: 46px; height: 46px; }
  .farm-cellimg svg { width: 46px; height: 46px; }
  .farm-sil { filter: brightness(0); opacity: 0.45; }
  .farm-q { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 800; }
  .farm-cellname { font-size: 12px; font-weight: 700; }
  .farm-cellct { font-size: 11px; opacity: 0.75; }
  .farm-rar { font-size: 10px; border: 1px solid var(--ink); padding: 0 4px; background: var(--card); }
  .farm-rar-l { background: var(--orange); color: #fff; }
  .farm-cardfoot { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
  .farm-tip { font-size: 11px; color: rgba(26, 26, 28, 0.6); }
  .farm-maprows { display: flex; flex-direction: column; border: 1px solid var(--ink); }
  .farm-maprow { display: flex; justify-content: space-between; gap: 8px; padding: 7px 12px; font-size: 13px; border-top: 1px solid rgba(26, 26, 28, 0.08); }
  .farm-maprow:first-child { border-top: 0; }
  .farm-maprow b { font-variant-numeric: tabular-nums; }
  .farm-maprow.is-here span::after { content: "（本页）"; color: var(--orange); font-size: 11px; }
  a.farm-maprow { color: inherit; text-decoration: none; cursor: pointer; }
  a.farm-maprow:hover { background: var(--orange); color: #fff; }

  @media (max-width: 768px) {
    .farm-hud { left: 10px; bottom: calc(10px + env(safe-area-inset-bottom, 0px)); max-width: calc(100vw - 20px); }
    .farm-hint { left: 10px; bottom: calc(50px + env(safe-area-inset-bottom, 0px)); }
    .farm-shelf { left: 10px; bottom: calc(46px + env(safe-area-inset-bottom, 0px)); }
    .farm-chick, .farm-cursor { width: 36px; height: 43px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .farm *, .farm *::before, .farm *::after { animation: none !important; transition: none !important; }
    /* reduced-motion 不藏光标：光标小鸡本身也隐藏 */
    body.farm-on, body.farm-on * { cursor: auto !important; }
    .farm-cursor { display: none; }
  }`;

const MARKUP = (brand, page) => `<div class="farm" id="farm" data-page="${page}" hidden>
  <div class="farm-stage" id="farm-stage">
    <div class="farm-layer" id="farm-layer"></div>
    <div class="farm-night" id="farm-night" aria-hidden="true"></div>

    <div class="farm-hud farm-ui">
      <div class="farm-stats">
        <span class="farm-stat farm-brand">${brand}</span>
        <span class="farm-stat">蛋 <b id="farm-n-eggs">0</b></span>
        <span class="farm-stat">鸡 <b id="farm-n-chicks">0</b></span>
        <span class="farm-stat">图鉴 <b id="farm-n-dex">0/7</b></span>
      </div>
      <div class="farm-btns">
        <button type="button" class="farm-btn" id="farm-btn-butler">管家</button>
        <button type="button" class="farm-btn" id="farm-btn-book">手册</button>
        <button type="button" class="farm-btn" id="farm-btn-map">地图</button>
        <button type="button" class="farm-btn" id="farm-btn-close">收起×</button>
      </div>
    </div>

    <div class="farm-shelf farm-ui is-stowed" id="farm-shelf" role="toolbar" aria-label="道具">
      <button type="button" class="farm-shelf-toggle" id="farm-shelf-toggle" aria-expanded="false" aria-controls="farm-shelf-slots" title="道具">道具</button>
      <div class="farm-shelf-slots" id="farm-shelf-slots">
        <button type="button" class="farm-prop" data-prop="rice" aria-label="米" title="米" aria-pressed="false"><span class="farm-ico rice" aria-hidden="true"><i></i><i></i><i></i></span><em>米</em></button>
        <button type="button" class="farm-prop" data-prop="piano" aria-label="地琴" title="地琴" aria-pressed="false"><span class="farm-ico piano" aria-hidden="true"></span><em>地琴</em></button>
      </div>
    </div>

    <p class="farm-hint" id="farm-hint">点空白处下蛋 · 点小鸡听它说话</p>

    <div class="farm-wrap farm-ui" id="farm-book" hidden>
      <div class="farm-scrim" id="farm-book-scrim"></div>
      <div class="farm-card" role="dialog" aria-label="鸡场手册">
        <div class="farm-cardhead"><b>鸡场手册 · 图鉴</b><button type="button" class="farm-btn" id="farm-book-x" aria-label="关闭">×</button></div>
        <div class="farm-grid" id="farm-bookgrid"></div>
        <div class="farm-cardfoot">
          <span class="farm-tip">点击页面空白处下蛋，孵出的小鸡自动入册；概率写在方案里，不玩暗改那套。</span>
          <button type="button" class="farm-btn" id="farm-btn-card">成就卡</button>
          <button type="button" class="farm-btn" id="farm-btn-reset">重开鸡场</button>
        </div>
      </div>
    </div>

    <div class="farm-wrap farm-ui" id="farm-map" hidden>
      <div class="farm-scrim" id="farm-map-scrim"></div>
      <div class="farm-card" role="dialog" aria-label="鸡场地图">
        <div class="farm-cardhead"><b>鸡场地图 · 一页一圈舍</b><button type="button" class="farm-btn" id="farm-map-x" aria-label="关闭">×</button></div>
        <div class="farm-maprows" id="farm-maprows"></div>
        <p class="farm-tip">鸡在哪，账就在哪。管家说「放几只去别的页面」，账就记到那一页。</p>
      </div>
    </div>
  </div>
</div>`;

/* 幕景默认包（与 packs/mujing/pack.json 同源）。breeds.f 为斯克里亚宾色-音映射的频率（Hz）。 */
const DEFAULT_PACK = {
  "breeds": [
    {
      "id": "butter",
      "name": "黄·油鸡",
      "svg": "youji",
      "color": "#f3cd4a",
      "rarity": "common",
      "f": 293.66
    },
    {
      "id": "mist",
      "name": "蓝·雾鸡",
      "svg": "wuji",
      "color": "#8296af",
      "rarity": "common",
      "f": 329.63
    },
    {
      "id": "persimmon",
      "name": "橙·柿鸡",
      "svg": "shiji",
      "color": "#fb9032",
      "rarity": "common",
      "f": 196.0
    },
    {
      "id": "bean",
      "name": "绿·豆鸡",
      "svg": "douji",
      "color": "#5db25f",
      "rarity": "common",
      "f": 220.0
    },
    {
      "id": "peach",
      "name": "粉·桃鸡",
      "svg": "taoji",
      "color": "#eaa98d",
      "rarity": "common",
      "f": 233.08
    },
    {
      "id": "noble",
      "name": "灰·贵族",
      "svg": "guizu",
      "color": "#9c9c93",
      "rarity": "rare",
      "f": 155.56
    },
    {
      "id": "ingot",
      "name": "金·元宝",
      "svg": "yuanbao",
      "color": "#d9ac55",
      "rarity": "legendary",
      "f": 261.63
    }
  ],
  "weights": {
    "common": 16,
    "rare": 18,
    "legendary": 2
  },
  "lines": [
    "咯咯～",
    "是我孵的哦。",
    "别摸头，会掉毛的。",
    "咦，那边有颗蛋。",
    "今天适合下蛋。",
    "嗨，你来啦。",
    "今日蛋 {E} 枚。"
  ],
  "rareLines": {
    "noble": "咳，贵族气质。",
    "ingot": "金光护体，大吉大利。"
  },
  "songs": {
    "twinkle": { "title": "小星星", "bpm": 104, "abc": "C C G G A A G2 F F E E D D C2 G G F F E E D2 G G F F E E D2 C C G G A A G2 F F E E D D C2" },
    "ode": { "title": "欢乐颂", "bpm": 116, "abc": "E E F G G F E D C C D E E2 D2 E E F G G F E D C C D E D2 C2" },
    "birthday": { "title": "生日快乐", "bpm": 108, "abc": "G4 G A G C2 B4 G G A G D2 C4 G G G E C C B A4 F F E C D2 C4" },
    "greensleeves": { "title": "绿袖子", "bpm": 92, "abc": "E | G2 A B2 C2 B A F#2 E2 D#2 E F# G E2 E | D#2 E F# B2 B A G2 F# E2" }
  }
};
export default function init(cfg = {}) {
  if (window.__coopInit) return window.__coop; // 幂等：重复 init 直接返回句柄
  window.__coopInit = true;
  const pack = cfg.pack || DEFAULT_PACK;
  const pages = cfg.pages && cfg.pages.length ? cfg.pages : [{ id: 'home', label: '首页', href: '/' }];
  const brand = cfg.brand || '鸡场';
  const page = cfg.page || document.body.dataset.page || 'home';
  const VER = window.__coopVer || 'v0200'; // 版本参数：缓存失效统一走这里（chat 动态导入在引擎块外也要用它）

  /* 样式与精灵图注入（可自托管：sprite 传字符串，spriteUrl 传地址） */
  if (!document.getElementById('coop-style')) {
    const st = document.createElement('style');
    st.id = 'coop-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const mountSprite = (txt) => {
    if (document.getElementById('coop-sprite') || !txt) return;
    const d = document.createElement('div');
    d.id = 'coop-sprite';
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    d.innerHTML = txt;
    document.body.appendChild(d);
  };
  if (cfg.sprite) mountSprite(cfg.sprite);
  else if (cfg.spriteUrl) fetch(cfg.spriteUrl).then((r) => r.text()).then(mountSprite).catch(() => { /* 无精灵图则退化：账照记，画面空 */ });

  if (!document.getElementById('farm')) {
    const t = document.createElement('div');
    t.innerHTML = MARKUP(brand, page);
    document.body.appendChild(t.firstElementChild);
  }
  /* 收起药丸：关掉后左下角唯一可见的重开入口（解决「关了不知道哪里开」） */
  if (!document.getElementById('coop-reopen')) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.id = 'coop-reopen';
    pill.hidden = true;
    pill.setAttribute('aria-label', '重新打开鸡场');
    pill.innerHTML = '<span aria-hidden="true">🐔</span> 鸡场已收起 · 重开';
    pill.addEventListener('click', () => window.dispatchEvent(new Event('farm:open')));
    document.body.appendChild(pill);
  }

const root = document.getElementById('farm');
  const stage = document.getElementById('farm-stage');
  if (root && stage && !stage.dataset.farmInit) {
    stage.dataset.farmInit = '1';

    /* ===== 模块〇：常量与工具 ===== */
    const $ = (id) => document.getElementById(id);
    const layer = $('farm-layer');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* 物理 + 乐器：CDN 懒加载，失败全降级（物理→运动学、乐器→鸡叫合成），鸡场不残废 */
    let phy = null, voices = null, voicesFactory = null;
    (async () => {
      try {
        const [p, v] = await Promise.all([
          import('./physics.js').then((m) => m.createPhysics({ url: 'https://cdn.jsdelivr.net/npm/matter-js@0.20.0/+esm' })).catch(() => null),
          import('./instruments.js').then((m) => m.createVoices),
        ]);
        phy = p;
        voicesFactory = v;
      } catch { /* 全降级 */ }
    })();
    const HERE = root.dataset.page || document.body.dataset.page || 'home';
    const MAX_PAGE = window.innerWidth <= 768 ? 8 : 14; // 同屏上限（方案 §二.4）
    const MAX_FLOCK = 40; // 在册记录上限，超出「装篮」只进计数（方案 §五·五.7）

    /* 色音映射（斯克里亚宾调性-色彩圈，palette.md）：黄=D4 橙=G3 绿=A3 蓝白=E4 粉=Bb3 灰=Eb3 金=C 大三琶音 */
    const BREEDS = pack.breeds;
    const WEIGHTS = pack.weights || { common: 16, rare: 18, legendary: 2 };
    const PAGES = pages.map((p) => p.id); // 地图即索引：一页一圈舍，圈舍行是普通链接
    const PAGE_NAMES = Object.fromEntries(pages.map((p) => [p.id, p.label]));
    const PAGE_HREF = Object.fromEntries(pages.map((p) => [p.id, p.href]));

    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

    /* 软保底（方案 §五·五.1）：前 30 次纯运气；第 31 次起传说权重翻倍递增，约 40 次内必出。
       概率在鸡场手册里写明——「不玩暗改那套」本身就是态度。 */
    const PITY_START = 30;
    function pickBreed() {
      /* 节日限定：品种带 season（MM-DD 区间），窗口外自然缺席 */
      const md = (() => { const d = new Date(); return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
      const inSeason = (b) => !b.season || (b.season.from <= md && md <= b.season.to);
      const POOL = BREEDS.filter(inSeason);
      const pity = Math.max(0, (state.pity | 0) - PITY_START);
      const weightOf = (r) => {
        if (r !== 'legendary' || pity <= 0) return WEIGHTS[r];
        return WEIGHTS[r] * Math.pow(2, Math.min(5, pity)); // 2%→4%→8%→16%→32%→64%
      };
      let total = 0;
      for (const b of POOL) total += weightOf(b.rarity);
      let r = Math.random() * total;
      for (const b of POOL) { r -= weightOf(b.rarity); if (r <= 0) return b; }
      return POOL[0];
    }

    /* ===== 模块一：存储 store（schema 与迁移见 farm-state.md） ===== */
    const KEY = 'coop-farm-v1';
    const LEGACY_KEYS = ['mujing-farm-v1', 'mujing-chicken-farm-v0']; // 官网 0.1.9 内嵌版与原型 v0 的账，读到即迁移

    let state = { v: 1, seq: 0, eggs: 0, hatched: 0, pity: 0, dex: {}, chickens: [] };
    (function load() {
      try {
        let old = null;
        for (const k of LEGACY_KEYS) {
          try { const o = JSON.parse(localStorage.getItem(k) || ''); if (o && typeof o === 'object') { old = o; break; } } catch { /* 空档 */ }
        }
        if (old) {
          state.eggs = old.eggs | 0;
          state.hatched = old.hatched | 0;
          state.pity = old.pity | 0;
          if (old.dex && typeof old.dex === 'object') state.dex = old.dex;
        }
      } catch { /* 没有旧档或隐私模式 */ }
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '');
        if (raw && typeof raw === 'object' && raw.v === 1) state = raw;
      } catch { /* 首次进入或隐私模式 */ }
    })();

    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 隐私模式退化为内存态 */ }
    }

    /* 总线快照：给对话层做「报告鸡场」插值，也随 /api/chat payload 上送（见 chat.ts.farm-patch.md） */
    function snapshot() {
      const breeds = {};
      const pagesMap = {};
      let here = 0;
      for (const c of state.chickens) {
        breeds[c.breed] = (breeds[c.breed] || 0) + 1;
        pagesMap[c.page] = (pagesMap[c.page] || 0) + 1;
        if (c.page === HERE) here += 1;
      }
      let found = 0;
      for (const b of BREEDS) if ((state.dex[b.id] | 0) > 0) found += 1;
      return {
        eggs: state.eggs,
        chickens: state.hatched, // 含装篮，报数口径
        breeds,
        pagesMap,
        here,
        elsewhere: state.chickens.length - here,
        dex_left: BREEDS.length - found,
      };
    }

    /* ===== 模块二：总线 bus（对话层由此驱动鸡场，契约见 README 第三节） ===== */
    const emitState = () => window.dispatchEvent(new CustomEvent('farm:state', { detail: snapshot() }));
    const emitSay = (text) => window.dispatchEvent(new CustomEvent('farm:say', { detail: { text } }));
    const emitCmd = (type) => window.dispatchEvent(new CustomEvent('farm:cmd', { detail: { type } }));

    window.addEventListener('farm:cmd', (e) => {
      const type = String(e.detail?.type || '');
      if (type === 'gift:egg') giftEgg();
      else if (type.startsWith('goto:')) sendAway(type.slice(5));
      else if (type === 'map') openMap();
      else if (type === 'concert:stop') concertStop();
      else if (type.startsWith('concert:')) concertStart(type.slice(8));
      /* 'butler' 由对话框自己消费；未知命令一律忽略（白名单边界） */
    });

    /* ===== 模块三：渲染原语（从原型平移；装饰与星星省略，见原型 130-137/549-562 行） ===== */
    function chickSVG(breed) {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('viewBox', '0 0 100 120');
      s.setAttribute('aria-hidden', 'true');
      s.innerHTML = `<use href="#farm-sym-${breed.svg}"/>`;
      return s;
    }

    function bubble(x, y, text) {
      const b = document.createElement('div');
      b.className = 'farm-bubble';
      b.textContent = text;
      b.style.left = `${clamp(x, 70, Math.max(72, stage.clientWidth - 70))}px`;
      b.style.top = `${clamp(y - 46, 30, Math.max(32, stage.clientHeight))}px`;
      layer.appendChild(b);
      window.setTimeout(() => b.remove(), 1900);
    }

    /* ===== 模块四：状态机 =====
       蛋：'drop' →（540ms）→ 'wob' →（1100ms）→ 'crack' →（340ms）→ hatch 出鸡
           reduced-motion：drop 直接 500ms 后 hatch。
       鸡：'wait' ⇄ 'walk'，到点随机转 'peck'（CSS 动画自理，完事回 'wait'）；
           'leave' 是终态（被派去别的页面或装篮），走出屏销毁。
       收集：hatch 时写 dex 与 chickens 记录，即「收集」。 */
    let flock = []; // 在场 DOM 鸡（本页投影），与 state.chickens（全场账本）分离
    let eggTimers = [];

    function layEgg(x, y) {
      state.eggs += 1;
      state.pity = (state.pity | 0) + 1; // 软保底计数
      const breed = pickBreed(); // 蛋一落地品种就定了，图鉴概率不趁机变动
      save(); refreshHUD();
      /* 品种事件音：下蛋 = 品种音短音，发声处浮起视觉音符 */
      play((t) => {
        cluck(t, breed.f * rand(0.98, 1.02), 0.14);
        noteFloat(x, y - 46, breed.color);
      });

      const egg = document.createElement('div');
      egg.className = reduce ? 'farm-egg' : 'farm-egg is-drop';
      egg.style.left = `${x}px`;
      egg.style.top = `${y}px`;
      egg.style.zIndex = String(Math.round(y));
      egg.innerHTML = '<svg viewBox="0 0 100 120" aria-hidden="true"><use href="#farm-sym-egg"/><g style="opacity:var(--cfcrack,0)"><use href="#farm-sym-egg-cracked"/></g></svg>';
      layer.appendChild(egg);

      if (reduce) {
        eggTimers.push(window.setTimeout(() => { egg.remove(); hatch(x, y, breed); }, 500));
        return;
      }
      eggTimers.push(window.setTimeout(() => { egg.classList.remove('is-drop'); egg.classList.add('is-wob'); }, 540));
      eggTimers.push(window.setTimeout(() => egg.classList.add('is-crack'), 1640));
      eggTimers.push(window.setTimeout(() => { egg.remove(); hatch(x, y, breed); }, 1980));
    }

    function hatch(x, y, breed) {
      /* 出壳 = 一声品种音（金·元宝保留 C 大三琶音，palette.md），发声处浮起视觉音符 */
      play((t) => {
        if (breed.rarity === 'legendary') {
          [261.63, 329.63, 392.0, 523.25].forEach((f, i) => cluck(t + i * 0.09, f, 0.16));
        } else {
          cluck(t, breed.f, 0.14);
        }
        noteFloat(x, y - 46, breed.color);
      });
      state.hatched += 1;
      state.dex[breed.id] = (state.dex[breed.id] | 0) + 1;
      if (state.chickens.length < MAX_FLOCK) {
        state.seq += 1;
        state.chickens.push({
          id: `c-${state.seq}`,
          breed: breed.id,
          page: HERE,
          pos: [+(x / stage.clientWidth).toFixed(3), +(y / stage.clientHeight).toFixed(3)],
          lastSeen: Date.now(),
        });
      }
      save(); refreshHUD();

      if (!reduce) shells(x, y);
      addChick(x, y, breed, true);
      trimFlock();
      emitState();
      if (breed.rarity === 'legendary') {
        state.pity = 0; // 传说出壳，保底清零
        /* 唯一一次主动开口留给传说出壳（方案 §五·五.4），由对话层决定怎么播 */
        root.classList.add('is-flash'); // 传说出壳：全屏橙光一瞬（reduced-motion 由 CSS 关）
        window.setTimeout(() => root.classList.remove('is-flash'), 720);
        emitSay(`金·元宝出壳了。第 ${state.eggs} 次点击，传说～`);
      }
    }

    function shells(x, y) {
      const s = document.createElement('div');
      s.className = 'farm-shells';
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.zIndex = String(Math.round(y) + 1);
      s.innerHTML = '<svg class="farm-shl farm-shl-b" viewBox="0 0 100 120" aria-hidden="true"><use href="#farm-sym-shell-half"/></svg>' +
        '<svg class="farm-shl farm-shl-t" viewBox="0 0 100 120" aria-hidden="true"><use href="#farm-sym-shelltop"/></svg>';
      layer.appendChild(s);
      window.setTimeout(() => s.remove(), 800);
    }

    function addChick(x, y, breed, fresh) {
      const el = document.createElement('div');
      el.className = 'farm-chick';
      const wob = document.createElement('div');
      wob.className = 'farm-chick-wob';
      const inn = document.createElement('div');
      inn.className = `farm-chick-in${fresh && !reduce ? ' is-pop' : ''}`;
      inn.appendChild(chickSVG(breed));
      wob.appendChild(inn);
      el.appendChild(wob);
      layer.appendChild(el);

      const c = {
        el, wob, inn, breed,
        id: fresh ? state.chickens[state.chickens.length - 1]?.id || '' : '',
        x, y, tx: x, ty: y,
        flip: Math.random() < 0.5 ? -1 : 1,
        speed: rand(36, 68),
        mode: 'wait', // fsm：wait | walk | peck(转瞬) | leave
        wait: rand(0.4, 1.2),
        phase: rand(0, 6.28),
        notes: 0, // 同时漂浮的视觉音符数（每鸡上限 3）
        dead: false,
        timers: [],
      };
      let pressT = 0, pressMoved = false; // 长按起名：按下时刻与是否挪动（up 时判 >550ms 且未拖拽才起名）
      const onMove = (ev) => {
        if (held && Math.hypot(ev.clientX - held.lastX, ev.clientY - held.lastY) > 3) pressMoved = true;
        moveHeld(ev);
      };
      const onUp = (ev) => {
        endHeld(ev);
        if (!pressMoved && pressT && performance.now() - pressT > 550 && !c.named) nameChick(c); // 长按 600ms：起名
        pressT = 0;
        window.removeEventListener('pointermove', onMove); // 每次按压成对清理，不向 window 叠监听
        window.removeEventListener('pointerup', onUp);
      };
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        pressT = performance.now();
        pressMoved = false;
        grabChick(c, e);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
      if (!reduce) { c.mode = 'walk'; newTarget(c); }
      draw(c, 0);
      flock.push(c);
      return c;
    }

    function newTarget(c) {
      c.tx = rand(44, Math.max(46, stage.clientWidth - 44));
      c.ty = rand(36, Math.max(38, stage.clientHeight - 56));
    }

    function decide(c) {
      if (c.concert) { c.mode = 'wait'; c.wait = 0.3; return; } // 音乐会受控鸡：站桩等指令
      const r = Math.random();
      if (r < 0.32) { c.mode = 'wait'; c.wait = rand(0.7, 1.8); }
      else if (r < 0.6) { peck(c); c.mode = 'wait'; c.wait = 1.0; }
      else { c.mode = 'walk'; newTarget(c); }
    }

    function stepChick(c, dt, t) {
      if (c.mode === 'leave') {
        const d = c.tx - c.x;
        const sp = c.speed * 1.5 * dt;
        if (Math.abs(d) <= sp) { kill(c); return; }
        c.x += d > 0 ? sp : -sp;
        draw(c, t);
        return;
      }
      if (c.mode === 'held') { draw(c, t); return; }
      if (c.mode === 'thrown') {
        c.vy = (c.vy || 0) + 900 * dt; // 重力
        c.x += (c.vx || 0) * dt;
        c.y += (c.vy || 0) * dt;
        if (Math.abs(c.vx) > 2) c.flip = c.vx < 0 ? -1 : 1;
        const floor = stage.clientHeight - 18;
        if (c.y >= floor) {
          c.y = floor;
          c.vy = -(c.vy) * 0.38;
          c.vx = c.vx * 0.7;
          if (Math.abs(c.vy) < 60) { c.vy = 0; c.vx = 0; c.mode = 'wait'; c.wait = rand(0.6, 1.4); }
        }
        c.x = clamp(c.x, 20, Math.max(24, stage.clientWidth - 20));
        draw(c, t);
        return;
      }
      /* 谷子：走到 60px 内就啄食最近的 */
      if (c.mode === 'wait') {
        const g = nearestGrain(c);
        if (g) { c.mode = 'walk'; c.tx = g.x; c.ty = g.y + 6; c.grainTarget = g; }
      }
      if (c.mode === 'wait') {
        c.wait -= dt;
        if (c.wait <= 0) decide(c);
        return;
      }
      const dx = c.tx - c.x;
      const dy = c.ty - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 5) {
        if (c.grainTarget && !c.grainTarget.taken) { eatGrain(c, c.grainTarget); c.grainTarget = null; c.mode = 'wait'; c.wait = rand(0.4, 0.9); return; }
        decide(c);
        return;
      }
      const sp = c.speed * dt;
      c.x += (dx / dist) * sp;
      c.y += (dy / dist) * sp;
      if (Math.abs(dx) > 2) c.flip = dx < 0 ? -1 : 1;
      draw(c, t);
    }

    function draw(c, t) {
      const wobA = reduce ? 0 : Math.sin(t * 11 + c.phase) * 6;
      c.x = clamp(c.x, 20, Math.max(24, stage.clientWidth - 20));
      c.y = clamp(c.y, 30, Math.max(34, stage.clientHeight - 20));
      c.el.style.transform = `translate3d(${c.x - 23}px, ${c.y - 42}px, 0)`;
      c.wob.style.transform = `rotate(${wobA.toFixed(2)}deg) scaleX(${c.flip})`;
      c.el.style.zIndex = String(Math.round(c.y) + 2);
    }

    function peck(c) {
      c.inn.classList.remove('is-peck');
      void c.inn.offsetWidth;
      c.inn.classList.add('is-peck');
      c.timers.push(window.setTimeout(() => c.inn.classList.remove('is-peck'), 950));
    }

    function kill(c) {
      c.dead = true;
      while (c.timers.length) window.clearTimeout(c.timers.pop());
      c.el.remove();
    }

    function trimFlock() {
      const active = flock.filter((c) => c.mode !== 'leave' && !c.dead);
      if (active.length <= MAX_PAGE) return;
      const old = active[0];
      old.mode = 'leave';
      old.tx = old.x < stage.clientWidth / 2 ? -80 : stage.clientWidth + 80; // 装篮：走出屏，账还在
      if (reduce) {
        old.el.classList.add('is-fade');
        old.timers.push(window.setTimeout(() => { old.dead = true; old.el.remove(); }, 900));
      } else {
        old.timers.push(window.setTimeout(() => old.el.classList.add('is-fade'), 500));
      }
    }

    /* 点小鸡：冒气泡 + 品种音 */
    const LINES = pack.lines;
    const RARE_LINES = pack.rareLines || {};

    function nameChick(c) {
      const inp = document.createElement('input');
      inp.className = 'farm-rename';
      inp.maxLength = 8;
      inp.placeholder = '给它起个名字';
      inp.value = (state.names && state.names[c.id]) || '';
      inp.style.left = clamp(c.x - 60, 8, stage.clientWidth - 130) + 'px';
      inp.style.top = clamp(c.y - 74, 40, stage.clientHeight - 34) + 'px';
      layer.appendChild(inp);
      inp.focus();
      inp.select();
      let closed = false; // 一次性守卫：Enter 提交会同步触发 blur，防双重提交/双重 remove 抛错
      const finish = (doSave) => {
        if (closed) return;
        closed = true;
        if (doSave) {
          const v = inp.value.trim();
          if (v) {
            state.names = state.names || {};
            state.names[c.id] = v;
            c.named = v;
            save();
            bubble(c.x, c.y, `记住了，我叫「${v}」～`);
          }
        }
        inp.remove();
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
      inp.addEventListener('blur', () => finish(true));
    }
    function poke(c) {
      if (!reduce) {
        c.inn.classList.remove('is-hop');
        void c.inn.offsetWidth;
        c.inn.classList.add('is-hop');
        c.timers.push(window.setTimeout(() => c.inn.classList.remove('is-hop'), 520));
      }
      const line = RARE_LINES[c.breed.id] && Math.random() < 0.7 ? RARE_LINES[c.breed.id] : LINES[Math.floor(Math.random() * LINES.length)];
      bubble(c.x, c.y, line.replace('{E}', String(state.eggs)));
      c.lastSeen = Date.now();
      /* poke = 品种音，发声处浮起视觉音符 */
      play((t) => {
        cluck(t, c.breed.f * rand(0.97, 1.03), 0.15);
        noteFloat(c.x, c.y - 50, c.breed.color, c);
      });
    }

    /* ===== 模块四·二：总线命令的落点（gift / goto / map） ===== */
    let lastPoint = null;

    function giftEgg() {
      /* 管家送蛋：走完整孵化流程，品种概率不动（稀缺性守恒，方案 §三.2） */
      const x = lastPoint ? clamp(lastPoint.x, 30, stage.clientWidth - 30) : stage.clientWidth / 2;
      const y = lastPoint ? clamp(lastPoint.y, 40, stage.clientHeight - 50) : stage.clientHeight * 0.55;
      layEgg(Math.round(x), Math.round(y));
    }

    function sendAway(target) {
      if (!PAGES.includes(target) || target === HERE) return;
      const gone = state.chickens.filter((r) => r.page === HERE).slice(0, 3); // 「放几只」：一次至多 3 只
      if (!gone.length) { emitSay('眼下本页一只可放的都没有。先下几颗蛋吧。'); return; }
      for (const r of gone) {
        r.page = target;
        r.pos = [rand(0.3, 0.7), rand(0.4, 0.8)];
        r.lastSeen = Date.now();
        const dom = flock.find((c) => c.id === r.id && !c.dead && c.mode !== 'leave');
        if (dom) { // 账面先转移，画面上走出屏（目标页下次载入时恢复）
          dom.mode = 'leave';
          dom.tx = dom.x < stage.clientWidth / 2 ? -80 : stage.clientWidth + 80;
        }
      }
      save(); refreshHUD(); emitState();
      bubble(stage.clientWidth / 2, stage.clientHeight * 0.3, `去 ${PAGE_NAMES[target]} 的，走好。`);
    }

    function openMap() {
      const snap = snapshot();
      const rows = PAGES.map((p) => {
        const n = snap.pagesMap[p] | 0;
        return `<a class="farm-maprow${p === HERE ? ' is-here' : ''}" href="${PAGE_HREF[p] || '/'}" aria-label="去${PAGE_NAMES[p]}看鸡"><span>${PAGE_NAMES[p]}</span><b>${n} 只</b></a>`;
      }).join('');
      const basket = snap.chickens - state.chickens.length; // 装篮的只进计数
      $('farm-maprows').innerHTML = rows +
        `<div class="farm-maprow"><span>装篮（只记数）</span><b>${basket} 只</b></div>` +
        `<div class="farm-maprow"><span>累计出鸡</span><b>${snap.chickens} 只</b></div>`;
      $('farm-map').hidden = false;
    }

    /* 地图点击 = 普通跳转；先记「开」偏好，落地页 prefOn() 命中自动开鸡场 */
    $('farm-maprows').addEventListener('click', (e) => {
      if (!e.target || !e.target.closest || !e.target.closest('a.farm-maprow')) return;
      try { localStorage.setItem('mujing-farm-on', '1'); } catch { /* 隐私模式 */ }
    });

    /* ===== 模块五：交互（指针、HUD、手册、音符开关） ===== */
    const elEggs = $('farm-n-eggs');
    const elChicks = $('farm-n-chicks');
    const elDex = $('farm-n-dex');
    const hint = $('farm-hint');

    function refreshHUD() {
      elEggs.textContent = String(state.eggs);
      elChicks.textContent = String(state.hatched);
      let found = 0;
      for (const b of BREEDS) if ((state.dex[b.id] | 0) > 0) found += 1;
      elDex.textContent = `${found}/${BREEDS.length}`;
      renderBook();
      if (state.eggs >= 1) {
        hint.classList.add('is-off');
        try { localStorage.setItem('mujing-farm-hint-off', '1'); } catch (_) {}
      }
      try { if (localStorage.getItem('mujing-farm-hint-off') === '1') hint.classList.add('is-off'); } catch (_) {}
    }

    function renderBook() {
      let html = '';
      for (const b of BREEDS) {
        const n = state.dex[b.id] | 0;
        const tag = b.rarity === 'rare' ? '<span class="farm-rar">稀有</span>' : b.rarity === 'legendary' ? '<span class="farm-rar farm-rar-l">传说</span>' : '';
        if (n > 0) {
          html += `<div class="farm-cell"><div class="farm-cellimg">${chickSVG(b).outerHTML}</div><div class="farm-cellname">${b.name}</div>${tag}<div class="farm-cellct">已养 ×${n}</div></div>`;
        } else {
          html += `<div class="farm-cell"><div class="farm-cellimg">${chickSVG(b.color).outerHTML.replace('<svg ', '<svg class="farm-sil" ')}</div><div class="farm-cellname">？？？</div>${tag}<div class="farm-cellct">未发现</div></div>`;
        }
      }
      $('farm-bookgrid').innerHTML = html;
    }

    /* 指针：光标小鸡全站跟随（window pointermove）；点空白处下蛋（document 捕获）；
       链接、按钮、表单、对话框等交互元素正常用，不下蛋。 */
    const curEl = document.createElement('div');
    curEl.className = 'farm-cursor';
    curEl.setAttribute('aria-hidden', 'true');
    curEl.innerHTML = '<div class="farm-cursor-in"><svg viewBox="0 0 100 120" aria-hidden="true"><use href="#farm-sym-youji"/></svg></div>';
    if (!reduce) stage.appendChild(curEl);
    const curIn = curEl.firstChild;
    const cur = { x: 0, y: 0, tx: 0, ty: 0, flip: 1, spd: 0 };
    cur.x = cur.tx = window.innerWidth / 2;
    cur.y = cur.ty = window.innerHeight * 0.55;
    /* 触发点微光：落点光点 + 可点元素描边（指针精确位置可视，解决「点不到按钮」） */
    const dotEl = document.createElement('div');
    dotEl.className = 'farm-dot';
    dotEl.setAttribute('aria-hidden', 'true');
    stage.appendChild(dotEl);
    const FARM_HIT = 'a,button,input,textarea,select,label,[role="button"],summary';
    let glowEl = null;
    let ghostEl = null;

    window.addEventListener('pointermove', (e) => {
      lastPoint = { x: e.clientX, y: e.clientY };
      cur.tx = clamp(e.clientX, 26, Math.max(28, window.innerWidth - 26));
      cur.ty = clamp(e.clientY, 30, Math.max(32, window.innerHeight - 40));
      cursorOnUI = !!(e.target && e.target.closest && e.target.closest(CURSOR_HIDE));
      updateCursorVisibility();
      dotEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      dotEl.classList.toggle('is-hidden', cursorOnUI);
      if (ghostEl && !ghostEl.hidden) ghostEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      if (!cursorOnUI) {
        dotEl.classList.add('is-live');
        const hitEl = document.elementFromPoint(e.clientX, e.clientY);
        const hit = hitEl && hitEl.closest ? hitEl.closest(FARM_HIT) : null;
        if (hit !== glowEl) {
          if (glowEl) glowEl.classList.remove('farm-glow');
          if (hit) hit.classList.add('farm-glow');
          glowEl = hit;
        }
      } else if (glowEl) {
        glowEl.classList.remove('farm-glow');
        glowEl = null;
      }
    });



    /* 不下蛋的元素：页面自身的一切交互件 + 鸡场自有 UI + 鸡/蛋（它们有自己的交互）+ 对话框/浮层面板 */
    const EGG_SKIP = 'a,button,input,textarea,select,label,[role="button"],[contenteditable],.coopchat,.mimi-launch,.mimi-panel,.butter-box,.farm-ui,.farm-card,[role="dialog"],[role="button"]'; /* .coopchat：Mimi 挂件根（launch+面板）；点她聊天不该下蛋 */
    /* 下蛋处理器纯旁观：永不 preventDefault / stopPropagation，原生点击行为一律不受影响。
       双击空白（320ms 内两击）= 撒谷子，单击仍是下蛋——判定合并在此处：
       早期版本把双击监听挂 stage，但 stage 是 pointer-events:none 根本收不到事件（原生死功能）。 */
    let lastTap = 0, lastTapXY = [0, 0];
    /* 货架两槽：米、地琴。盆墩不进货架。地琴武装后点地放置，放完可整组拖。 */
    const PROPS_HIDDEN = {
      bowl: { id: 'bowl', name: '食盆', kind: 'furniture' },
      stool: { id: 'stool', name: '木墩', kind: 'furniture' },
    };
    const PROPS = {
      rice: { id: 'rice', name: '米', kind: 'pile' },
      piano: { id: 'piano', name: '地琴', kind: 'piano' },
    };
    void PROPS_HIDDEN;
    let armedPropId = null;
    ghostEl = document.createElement('div');
    ghostEl.className = 'farm-ghost';
    ghostEl.hidden = true;
    ghostEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ghostEl);
    function paintArm() {
      const bar = $('farm-shelf');
      if (!bar) return;
      bar.querySelectorAll('.farm-prop').forEach((b) => {
        if (!PROPS[b.dataset.prop]) return;
        const on = b.dataset.prop === armedPropId;
        b.classList.toggle('is-armed', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      const tog = $('farm-shelf-toggle');
      if (tog) {
        tog.classList.toggle('is-armed', !!armedPropId);
        const label = armedPropId === 'rice' ? '米' : (armedPropId === 'piano' ? '地琴' : '道具');
        tog.textContent = armedPropId ? ('· ' + label) : '道具';
        tog.title = armedPropId ? ('已武装：' + label + '（再点卸下或点地放置）') : '道具';
      }
      // A：武装后自动收起，场上只留 ghost + pill 指示
      if (armedPropId) {
        bar.classList.add('is-stowed');
        if (tog) tog.setAttribute('aria-expanded', 'false');
      }
    }
    /* 同槽再点卸下；武装时才画出半透明落点。未武装点地仍是下蛋。 */
    function updateCursorGhost() {
      ghostEl.replaceChildren();
      ghostEl.classList.remove('is-piano');
      const prop = PROPS[armedPropId];
      if (!prop) { ghostEl.hidden = true; return; }
      ghostEl.hidden = false;
      if (lastPoint) ghostEl.style.transform = `translate(${lastPoint.x}px, ${lastPoint.y}px)`;
      if (prop.kind === 'piano') { ghostEl.classList.add('is-piano'); return; }
      for (let i = 0; i < 5; i += 1) {
        const dot = document.createElement('i');
        dot.style.left = `${4 + (i % 3) * 8}px`;
        dot.style.top = `${2 + (i > 2 ? 8 : 0)}px`;
        ghostEl.appendChild(dot);
      }
    }
    function selectTool(id) {
      armedPropId = armedPropId === id ? null : id;
      paintArm();
      updateCursorGhost();
    }
    function placeArmed(clientX, clientY) {
      const prop = PROPS[armedPropId];
      if (!prop) return;
      if (prop.kind === 'pile') { scatterGrain(clientX, clientY); return; }
      if (prop.kind === 'piano') {
        placePiano(clientX, clientY);
        if (floorEl && !floorEl.hidden) selectTool('piano');
      }
    }

    function flashShelfTipOnce() {
      try {
        if (localStorage.getItem('mujing-shelf-tip-seen') === '1') return;
        localStorage.setItem('mujing-shelf-tip-seen', '1');
      } catch (_) {}
      const hint = $('farm-hint');
      if (!hint) return;
      const prev = hint.textContent;
      hint.textContent = '选道具 → 点地放置';
      hint.classList.remove('is-off');
      clearTimeout(flashShelfTipOnce._t);
      flashShelfTipOnce._t = setTimeout(() => {
        hint.textContent = prev || '点空白处下蛋 · 点小鸡听它说话';
        if ((state && state.eggs >= 2) || localStorage.getItem('mujing-farm-hint-off') === '1') {
          hint.classList.add('is-off');
        }
      }, 2200);
    }

    const shelf = $('farm-shelf');
    if (shelf) {
      shelf.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        const togBtn = e.target && e.target.closest ? e.target.closest('.farm-shelf-toggle') : null;
        if (togBtn) {
          // 武装中点 pill = 卸武装（Factorish 再点卸下）
          if (armedPropId) {
            selectTool(armedPropId);
            return;
          }
          const open = shelf.classList.contains('is-stowed');
          shelf.classList.toggle('is-stowed', !open);
          togBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
          if (open) flashShelfTipOnce();
          return;
        }
        const btn = e.target && e.target.closest ? e.target.closest('.farm-prop') : null;
        if (!btn || !PROPS[btn.dataset.prop]) return;
        selectTool(btn.dataset.prop);
      });
    }
    document.addEventListener('pointerdown', (e) => {
      if (!opened) return; // 鸡场收起中：整层退场，不添蛋
      ensureAudio();
      if (e.button !== undefined && e.button !== 0) return;
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest(EGG_SKIP)) return;
      if (t.closest('.farm-chick,.farm-egg,.farm-shells')) return; // 鸡与蛋自持交互（点鸡=说话）
      const x = clamp(e.clientX, 16, Math.max(18, window.innerWidth - 16));
      const y = clamp(e.clientY, 16, Math.max(18, window.innerHeight - 16));
      cur.tx = x; cur.ty = y;
      lastPoint = { x, y };
      if (armedPropId) { placeArmed(e.clientX, e.clientY); return; }
      if (t.closest('.farm-floor')) { beginFloorGesture(e); return; }
      const now = performance.now();
      const d = Math.hypot(e.clientX - lastTapXY[0], e.clientY - lastTapXY[1]);
      if (now - lastTap < 320 && d < 46) {
        scatterGrain(e.clientX, e.clientY); // 双击也可落在琴键上，和踩键不抢同一条命中
        lastTap = 0;
        return;
      }
      lastTap = now; lastTapXY = [e.clientX, e.clientY];
      const key = keyAt(e.clientX, e.clientY);
      if (key) { strikeFloorKey(key); return; }
      if (t.closest('.farm-furn,.farm-floor')) return;
      layEgg(Math.round(x), Math.round(y));
    }, true);

    /* 光标小鸡让位：悬停对话框/面板上、或输入框聚焦期间淡出（opacity 0, 0.2s），离开/失焦恢复 */
    const CURSOR_HIDE = '.coopchat,.mimi-panel,.butter-box,.farm-card,[role="dialog"]'; /* .coopchat：Mimi 挂件新版类名（launch 钮+面板都在 root 内）；旧名保留兼容自定义剧本 */
    let cursorOnUI = false;
    function updateCursorVisibility() {
      const a = document.activeElement;
      const typing = !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
      curEl.style.opacity = cursorOnUI || typing ? '0' : '';
      dotEl.classList.toggle('is-hidden', cursorOnUI || typing);
    }
    document.addEventListener('focusin', updateCursorVisibility);
    /* focusout 时 activeElement 尚未切换，推一拍再判定，失焦后光标小鸡才回得来 */
    document.addEventListener('focusout', () => window.setTimeout(updateCursorVisibility, 0));

    /* 手册开合与两步确认重开 */
    $('farm-btn-book').addEventListener('click', () => { ensureAudio(); $('farm-book').hidden = !$('farm-book').hidden; });
    $('farm-book-x').addEventListener('click', () => { $('farm-book').hidden = true; });
    $('farm-book-scrim').addEventListener('click', () => { $('farm-book').hidden = true; });
    $('farm-btn-map').addEventListener('click', openMap);
    $('farm-map-x').addEventListener('click', () => { $('farm-map').hidden = true; });
    $('farm-map-scrim').addEventListener('click', () => { $('farm-map').hidden = true; });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      $('farm-book').hidden = true;
      $('farm-map').hidden = true;
      if (armedPropId) selectTool(armedPropId);
    });

    let resetArmed = false;
    let resetTimer = 0;
    /* ===== 成就印刷卡：canvas 绘制 → PNG 下载 ===== */
    function drawCard(kind) {
      const cv = document.createElement('canvas');
      cv.width = 720; cv.height = 480;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#f6f5f3'; ctx.fillRect(0, 0, 720, 480);
      ctx.strokeStyle = '#1a1a1c'; ctx.lineWidth = 2; ctx.strokeRect(14, 14, 692, 452);
      ctx.fillStyle = '#1a1a1c';
      const date = new Date().toISOString().slice(0, 10);
      ctx.font = '600 30px "Alibaba PuHuiTi 3.0", system-ui, sans-serif';
      ctx.textAlign = 'center';
      if (kind === 'legend') {
        ctx.fillText('传说出壳', 360, 120);
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillText(`第 ${state.eggs | 0} 次点击 · 金·元宝 · ${date}`, 360, 190);
        ctx.fillStyle = '#ff690a'; ctx.font = '600 20px system-ui, sans-serif';
        ctx.fillText('★ 传说瞬间卡 ★', 360, 260);
        ctx.fillStyle = '#1a1a1c'; ctx.font = '14px system-ui, sans-serif';
        ctx.fillText('幕景鸡场 认证 · 编号 MJ-' + (1000 + (state.eggs | 0)), 360, 320);
      } else if (kind === 'cert') {
        ctx.fillText('集齐荣誉证书', 360, 120);
        ctx.font = '16px system-ui, sans-serif';
        const names = Object.entries(state.dex || {}).map(([id, c]) => `${id}×${c}`).join('  ');
        ctx.fillText(`7 个品种 · ${date}`, 360, 180);
        ctx.fillStyle = '#ff690a'; ctx.font = '600 20px system-ui, sans-serif';
        ctx.fillText('幕景鸡场 荣誉鸡舍', 360, 260);
        ctx.fillStyle = '#1a1a1c'; ctx.font = '14px system-ui, sans-serif';
        ctx.fillText('证书编号 MJ-CERT-' + (1000 + (state.seq | 0)), 360, 320);
      } else {
        ctx.fillText('满屏鸡群合影', 360, 120);
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillText(`累计出鸡 ${state.hatched | 0} 只 · 蛋 ${state.eggs | 0} 颗 · ${date}`, 360, 180);
        ctx.fillStyle = '#ff690a';
        for (let i = 0; i < 12; i += 1) {
          const x = 90 + (i % 6) * 96 + (i > 5 ? 48 : 0);
          const y = 240 + Math.floor(i / 6) * 90;
          ctx.beginPath(); ctx.ellipse(x, y, 30, 38, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#1a1a1c';
        ctx.fillText('鸡在哪，账就在哪。', 360, 430);
      }
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('幕景鸡场 · coop.js · ' + date, 360, 452);
      const a = document.createElement('a');
      a.download = `coop-${kind}-${date}.png`;
      a.href = cv.toDataURL('image/png');
      a.click();
    }
    $('farm-btn-card').addEventListener('click', () => {
      const done = Object.keys(state.dex || {}).length;
      drawCard(done >= 7 ? 'cert' : (state.dex && state.dex.ingot) ? 'legend' : 'crowd');
    });
    $('farm-btn-reset').addEventListener('click', () => {
      ensureAudio();
      if (!resetArmed) {
        resetArmed = true;
        $('farm-btn-reset').textContent = '确认重开？再点一次';
        window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(disarmReset, 4000);
        return;
      }
      disarmReset();
      for (const c of flock) kill(c);
      flock = [];
      eggTimers.forEach(window.clearTimeout);
      eggTimers = [];
      layer.replaceChildren();
      state = { v: 1, seq: 0, eggs: 0, hatched: 0, dex: {}, chickens: [] };
      save(); refreshHUD(); emitState();
      hint.classList.remove('is-off');
    });
    function disarmReset() {
      resetArmed = false;
      $('farm-btn-reset').textContent = '重开鸡场';
    }

    /* ===== 模块六：音效（纯 WebAudio 现场合成，零素材；音高映射见 palette.md） =====
       无背景音乐：只有事件音（出壳/点鸡/下蛋各一声品种音），play() 不设总开关。 */
    let actx = null;
    let master = null;
    let noiseBuf = null;

    function ensureAudio() {
      if (actx) { if (actx.state === 'suspended') { try { actx.resume(); } catch { /* 忽略 */ } } return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        actx = new AC();
        /* 总链：master(0.5) → [干声 + 反馈延迟湿声(0.29s, fb 0.22, wet 0.18)] → lowpass(2400) → destination */
        master = actx.createGain();
        master.gain.value = 0.5;
        const lp = actx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2400;
        const delay = actx.createDelay(1);
        delay.delayTime.value = 0.29;
        const fb = actx.createGain();
        fb.gain.value = 0.22;
        const wet = actx.createGain();
        wet.gain.value = 0.18;
        master.connect(lp);
        master.connect(delay);
        delay.connect(fb); fb.connect(delay);
        delay.connect(wet); wet.connect(lp);
        lp.connect(actx.destination);
      } catch { actx = null; }
    }

    /* 音色：triangle + 短噪声瞬态，柔而不吵 */
    function noiseHit(t, g) {
      if (!actx || g <= 0) return;
      if (!noiseBuf) {
        noiseBuf = actx.createBuffer(1, Math.max(256, Math.floor(actx.sampleRate * 0.04)), actx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      }
      const src = actx.createBufferSource();
      src.buffer = noiseBuf;
      const gn = actx.createGain();
      gn.gain.value = g;
      const hp = actx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1500;
      src.connect(hp); hp.connect(gn); gn.connect(master);
      src.start(t); src.stop(t + 0.05);
    }

    function cluck(t, f, g) {
      if (!actx) return;
      const o = actx.createOscillator();
      const gn = actx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(60, f * 0.5), t + 0.08);
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(g, t + 0.015);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(gn); gn.connect(master);
      o.start(t); o.stop(t + 0.15);
      noiseHit(t, Math.min(g, 0.14) * 0.5);
    }

    function play(fn) {
      if (!actx) return;
      if (actx.state === 'suspended') { try { actx.resume(); } catch { /* 忽略 */ } }
      try { fn(actx.currentTime); } catch { /* 忽略 */ }
    }

    /* 视觉音符：品种音发声处浮起一枚 ♪（品种色、12-18px、上浮 40px 渐隐 1.6s、每鸡同时最多 3 枚；
       reduced-motion 不浮）。owner 传鸡对象即按鸡计上限。 */
    function noteFloat(x, y, color, owner) {
      if (reduce || root.hidden) return;
      if (owner) {
        owner.notes = owner.notes || 0;
        if (owner.notes >= 3) return;
        owner.notes += 1;
      }
      const n = document.createElement('span');
      n.className = 'farm-note';
      n.textContent = '♪';
      n.style.left = `${clamp(x, 12, Math.max(14, stage.clientWidth - 12))}px`;
      n.style.top = `${Math.max(18, y)}px`;
      n.style.color = color;
      n.style.fontSize = `${(12 + Math.random() * 6).toFixed(0)}px`;
      layer.appendChild(n);
      window.setTimeout(() => { n.remove(); if (owner) owner.notes -= 1; }, 1650);
    }

    /* pad 和声进行与闲逛轻唱已按需求整体撤下：没有背景音乐，只有事件音（出壳/点鸡/下蛋）。 */
    /* ===== 音乐会：只弹场上那一架地琴（手铃制——一键一鸡）=====
       不再另起底部 do-re-mi 琴条。曲谱仍是 pack.songs 的 ABC 文本。
       调度遵循 A Tale of Two Clocks：音符预排在 AudioContext 上，啄键用墙钟对齐。
       以后若做多轨编辑，可参考 oddeNova 的分层思路；那份是 AGPL，不把代码引进来。 */
    const SONGS = pack.songs || {};
    function parseABC(abc) {
      const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
      const notes = [];
      for (const tk of String(abc).split(/\s+/)) {
        if (!tk) continue;
        /* 音名支持升降号：F# / Bb（黑键路径依赖它） */
        const m = /^([A-Ga-g])(#|b)?(\d?)$/.exec(tk);
        if (!m) continue;
        const up = m[1].toUpperCase();
        const oct = m[1] === up ? 4 : 5;
        let semi = SEMI[up];
        if (m[2] === '#') semi += 1;
        if (m[2] === 'b') semi -= 1;
        const acc = m[2] === '#' ? '#' : m[2] === 'b' ? 'b' : '';
        notes.push({ midi: 12 * (oct + 1) + semi, dur: m[3] ? Number(m[3]) : 1, name: up + acc });
      }
      return notes;
    }
    const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    let concert = null;
    function concertStop() {
      if (!concert) return;
      for (const t of concert.timers) window.clearTimeout(t);
      for (const seat of concert.seats) {
        if (seat.key) seat.key.classList.remove('active');
        const c = seat.chick;
        if (!c || c.dead) continue;
        c.concert = false;
        c.assigned = false;
        if (c.guest) { c.mode = 'leave'; c.tx = c.x < stage.clientWidth / 2 ? -80 : stage.clientWidth + 80; }
        else { c.mode = 'walk'; newTarget(c); }
      }
      concert = null;
    }
    function ensureFloorPiano() {
      if (floorEl && !floorEl.hidden) return;
      const sr = stage.getBoundingClientRect();
      placePiano(sr.left + (stage.clientWidth || sr.width) / 2, sr.top + (stage.clientHeight || sr.height) * 0.55);
    }
    function concertStart(songId) {
      concertStop();
      const song = SONGS[songId];
      if (!song) return;
      const notes = parseABC(song.abc);
      if (!notes.length) return;
      ensureFloorPiano();
      const fold = (midi) => 60 + (((midi % 12) + 12) % 12);
      const uniq = [];
      const seen = new Set();
      for (const n of notes) {
        if (seen.has(n.name)) continue;
        seen.add(n.name);
        uniq.push(n);
      }
      uniq.sort((a, b) => a.midi - b.midi);
      const free = flock.filter((c) => !c.dead && c.mode !== 'leave');
      const seats = uniq.map((n) => ({
        name: n.name,
        midi: fold(n.midi),
        chick: free.find((c) => !c.assigned) || null,
        key: floorEl.querySelector(`[data-midi="${fold(n.midi)}"]`),
      }));
      for (const seat of seats) if (seat.chick) seat.chick.assigned = true;
      const timers = [];
      for (const seat of seats) {
        if (!seat.chick && seat.key) {
          const kr = seat.key.getBoundingClientRect();
          const bi = Math.max(0, uniq.findIndex((n) => n.name === seat.name));
          const g = addChick(kr.x + kr.width / 2, kr.y - 40, BREEDS[bi % BREEDS.length], false);
          g.guest = true; // 客串鸡：不进账本，曲终离场
          seat.chick = g;
        }
        if (!seat.chick) continue;
        seat.chick.concert = true;
        seat.chick.mode = 'walk';
      }
      concert = { song, seats, timers };
      const beat = 60 / (song.bpm || 100);
      const lead = reduce ? 0.8 : 2.2;
      ensureAudio(); // 命令路径（Mimi 菜单）没有过舞台点击，这里补建 AudioContext
      play((t0) => {
        let pos = 0;
        for (const n of notes) {
          const at = t0 + lead + pos * beat;
          pos += n.dur;
          const seat = seats.find((s) => s.name === n.name);
          const key = seat && seat.key;
          const midi = seat ? seat.midi : fold(n.midi);
          if (voicesFactory && actx) { voicesFactory(actx, master).piano(at, midi, Math.max(0.3, n.dur * beat), 0.24); }
          else cluck(at, midiHz(midi), 0.2);
          const wall = Math.max(0, (at - actx.currentTime) * 1000);
          timers.push(window.setTimeout(() => {
            if (!concert || !key) return;
            if (seat.chick && !seat.chick.dead) peck(seat.chick);
            key.classList.add('active');
            timers.push(window.setTimeout(() => key.classList.remove('active'), 170));
            const kr = key.getBoundingClientRect();
            noteFloat(kr.x + kr.width / 2, kr.y - 8, seat.chick ? seat.chick.breed.color : '#ff690a', seat.chick);
          }, wall));
        }
        timers.push(window.setTimeout(concertStop, (lead + pos * beat) * 1000 + 700));
      });
      emitSay(`${song.title}，开演～`);
    }
    /* 领位循环：受控鸡未到键心就续走（60ms 低频，避开 rAF 节流盲区） */
    window.setInterval(() => {
      if (!concert) return;
      for (const seat of concert.seats) {
        const c = seat.chick;
        if (!c || c.dead || c.mode === 'leave' || !seat.key) continue;
        const kr = seat.key.getBoundingClientRect();
        const kx = kr.x + kr.width / 2;
        const ky = kr.y + kr.height * 0.35;
        if (Math.hypot(kx - c.x, ky - c.y) > 8) { c.mode = 'walk'; c.tx = kx; c.ty = ky; }
        else { c.mode = 'wait'; c.wait = 9; }
      }
    }, 60);


    /* ===== 乌托邦小事件：斗嘴 / 虫子围观（低频定时，世界自转）===== */
    window.setInterval(() => {
      if (root.hidden || document.hidden || reduce) return;
      const onStage = flock.filter((c) => !c.dead && c.mode !== 'leave' && c.mode !== 'held');
      if (onStage.length < 2 || Math.random() > 0.18) return;
      if (Math.random() < 0.5) {
        const a = onStage[Math.floor(Math.random() * onStage.length)];
        const b = onStage.filter((c) => c !== a).sort((x, y) => Math.hypot(x.x - a.x, x.y - a.y) - Math.hypot(y.x - a.x, y.y - a.y))[0];
        if (!b) return;
        const an = (state.names && state.names[a.id]) || a.breed.name;
        const bn = (state.names && state.names[b.id]) || b.breed.name;
        bubble(a.x, a.y - 20, `${an}：咯咯，站远点，这是我的位置。`);
        window.setTimeout(() => { if (!b.dead) bubble(b.x, b.y - 20, `${bn}：呵，整个场都是我的。`); }, 1300);
      } else {
        const c = onStage[Math.floor(Math.random() * onStage.length)];
        c.mode = 'walk'; c.tx = clamp(c.x + rand(-50, 50), 30, stage.clientWidth - 30); c.ty = clamp(c.y, 60, stage.clientHeight - 30);
        window.setTimeout(() => { if (!c.dead) { peck(c); peck(c); } }, 1400);
        for (const other of onStage) if (other !== c) { other.mode = 'walk'; other.tx = c.x + rand(-40, 40); other.ty = c.y + rand(-20, 20); }
      }
    }, 47000);
    /* ===== 自动下蛋 + 每日彩蛋（低频放置玩法）===== */
    window.setInterval(() => {
      if (root.hidden || document.hidden) return;
      const onStage = flock.filter((c) => !c.dead && c.mode !== 'leave' && c.mode !== 'held');
      if (!onStage.length || state.eggs - state.hatched > 6) return;
      const c = onStage[Math.floor(Math.random() * onStage.length)];
      const day = new Date().toISOString().slice(0, 10);
      let daily = false;
      try { daily = localStorage.getItem('coop-daily-egg') !== day; } catch { /* 忽略 */ }
      layEgg(clamp(c.x + rand(-30, 30), 30, stage.clientWidth - 30), clamp(c.y + 10, 60, stage.clientHeight - 30));
      if (daily) {
        try { localStorage.setItem('coop-daily-egg', day); } catch { /* 忽略 */ }
        emitSay('今日第一颗彩蛋落地了，带日期纹样的那种～');
      }
    }, 62000);
    /* 双击撒谷子的判定已合并进 document 级下蛋处理器（stage 是 pointer-events:none，收不到事件） */
        $('farm-btn-butler').addEventListener('click', () => emitCmd('butler'));

    /* ===== 模块七：主循环（单 rAF；页签隐藏即暂停并落盘） ===== */
    let raf = 0;
    let lastT = -1;
    function tick(now) {
      const t = now / 1000;
      const dt = lastT < 0 ? 0.016 : Math.min(0.05, t - lastT);
      lastT = t;
      /* 光标小鸡缓动：0.28/帧贴紧指针 */
      const k = reduce ? 1 : 0.28;
      const nx = cur.x + (cur.tx - cur.x) * k;
      const ny = cur.y + (cur.ty - cur.y) * k;
      const mvx = nx - cur.x;
      const mvy = ny - cur.y;
      cur.x = nx; cur.y = ny;
      const sp = Math.hypot(mvx, mvy) / Math.max(dt, 0.001);
      cur.spd += (sp - cur.spd) * Math.min(1, dt * 12);
      if (Math.abs(mvx) > 0.5) cur.flip = mvx < 0 ? -1 : 1;
      if (!reduce) {
        curEl.style.transform = `translate3d(${cur.x - 32}px, ${cur.y - 58}px, 0)`;
        curIn.style.transform = `rotate(${(Math.sin(t * 11) * Math.min(8, cur.spd * 0.1)).toFixed(2)}deg) scaleX(${cur.flip})`;
      }
      for (const c of flock) if (!c.dead) stepChick(c, dt, t);
      for (const c of flock) if (!c.dead) footPiano(c);
      if (flock.some((c) => c.dead)) flock = flock.filter((c) => !c.dead);
      raf = requestAnimationFrame(tick);
    }
    function startLoop() { if (!raf) { lastT = -1; raf = requestAnimationFrame(tick); } }
    function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { stopLoop(); save(); } // 藏起来先把账记了（lastSeen 粒度够用）
      else if (!root.hidden) startLoop(); // 鸡场收起中不空转
    });

    /* ===== 恢复：换页时把 page===HERE 的鸡放回本页（详见 farm-state.md 第三节） ===== */
    function restore() {
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const mine = state.chickens.filter((r) => r.page === HERE).slice(0, MAX_PAGE);
      for (const r of mine) {
        const breed = BREEDS.find((b) => b.id === r.breed) || BREEDS[0];
        const x = clamp((r.pos[0] || 0.5) * w, 40, Math.max(42, w - 40));
        const y = clamp((r.pos[1] || 0.6) * h, 40, Math.max(42, h - 60));
        const c = addChick(x, y, breed, false);
        c.id = r.id; // 对上账本，goto 时好点名
      }
      trimFlock();
    }

    refreshHUD();
    emitState();

    /* 网页默认全天明亮：不按小时改 #farm-night。
       以后一次性气氛（例如烟花）从这里短暂点亮再卸下，不要改回按时段常驻夜幕。 */
    const nightEl = $('farm-night');
    nightEl.style.opacity = '0';
    let grains = [];
    function scatterGrain(x, y) {
      for (let i = 0; i < 6; i += 1) {
        const g = document.createElement('span');
        g.className = 'farm-grain';
        const gx = clamp(x + rand(-60, 60), 20, Math.max(24, stage.clientWidth - 20));
        const gy = clamp(y + rand(-24, 24), 40, Math.max(42, stage.clientHeight - 16));
        g.style.left = gx + 'px';
        g.style.top = gy + 'px';
        /* 比同高度的键面高 1，比鸡脚低 1：米画在键上，鸡仍盖在米上。 */
        g.style.zIndex = String(Math.round(gy) + 1);
        layer.appendChild(g);
        grains.push({ el: g, x: gx, y: gy, taken: false });
      }
      const near = flock.filter((c) => !c.dead && c.mode !== 'leave').slice(0, 3);
      for (const c of near) { c.mode = 'walk'; c.tx = clamp(x + rand(-40, 40), 30, stage.clientWidth - 30); c.ty = clamp(y + rand(-20, 20), 60, stage.clientHeight - 30); }
    }
    function nearestGrain(c) {
      let best = null, bd = 1e9;
      for (const g of grains) {
        if (g.taken) continue;
        const d = Math.hypot(g.x - c.x, g.y - c.y);
        if (d < bd) { bd = d; best = g; }
      }
      return best && bd < 60 ? best : null;
    }
    function eatGrain(c, g) {
      g.taken = true; g.el.remove();
      peck(c);
      noteFloat(g.x, g.y - 10, '#d9a441', null);
    }
    /* 拎鸡扔鸡：按住鸡拖动>10px 即拎起，松手按速度抛出（重力+地板反弹+摩擦） */
    let held = null;
    function moveHeld(e) { if (held) moveHeldInner(e); }
    function endHeld(e) { if (held) endHeldInner(e); }
    function grabChick(c, e) {
      held = { c, vx: 0, vy: 0, lastX: e.clientX, lastY: e.clientY, lt: performance.now() };
      c.mode = 'held';
      if (!reduce) { c.inn.classList.add('is-hop'); }
    }
    function moveHeldInner(e) {
      if (!held) return;
      const now = performance.now();
      const dt = Math.max(16, now - held.lt) / 1000;
      const sr = stage.getBoundingClientRect();
      held.c.x = clamp(e.clientX - sr.x, 24, stage.clientWidth - 24);
      held.c.y = clamp(e.clientY - sr.y, 40, stage.clientHeight - 24);
      held.vx = (e.clientX - held.lastX) / dt;
      held.vy = (e.clientY - held.lastY) / dt;
      held.lastX = e.clientX; held.lastY = e.clientY; held.lt = now;
      draw(held.c, now / 1000);
    }
    function endHeldInner() {
      if (!held) return;
      const c = held.c;
      held = null;
      c.mode = 'thrown';
      c.vx = Math.max(-560, Math.min(560, c.vx * 60)) || rand(-120, 120);
      c.vy = -rand(220, 420);
    }

    /* 地琴：C4–B4。keyAt 先黑后白。整组拖用按下点相对琴盒的偏移，不改音高。 */
    let floorEl = null;
    let floorDrag = null;
    const FLOOR_WHITES = [60, 62, 64, 65, 67, 69, 71];
    const FLOOR_BLACKS = [
      { midi: 61, seam: 1 },
      { midi: 63, seam: 2 },
      { midi: 66, seam: 4 },
      { midi: 68, seam: 5 },
      { midi: 70, seam: 6 },
    ];
    const BLACK_VIS_W = 0.5;
    const BLACK_H = 0.7;
    const BLACK_HIT_PAD = 6;
    function buildFloorPiano() {
      const old = document.getElementById('farm-floor');
      if (old) { floorEl = old; return; }
      const el = document.createElement('div');
      el.id = 'farm-floor';
      el.className = 'farm-floor';
      el.hidden = true;
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', '地琴，C4 到 B4');
      const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      const blackAt = { 0: 61, 1: 63, 3: 66, 4: 68, 5: 70 };
      const grip = document.createElement('div');
      grip.className = 'farm-grip';
      grip.setAttribute('aria-hidden', 'true');
      el.appendChild(grip);
      const keys = document.createElement('div');
      keys.className = 'farm-keys';
      FLOOR_WHITES.forEach((midi, i) => {
        const col = document.createElement('div');
        col.className = 'farm-fkey';
        const w = document.createElement('div');
        w.className = 'w';
        w.dataset.midi = String(midi);
        w.innerHTML = `<em>${names[i]}</em>`;
        col.appendChild(w);
        if (blackAt[i]) {
          const b = document.createElement('div');
          b.className = 'b';
          b.dataset.midi = String(blackAt[i]);
          col.appendChild(b);
        }
        keys.appendChild(col);
      });
      el.appendChild(keys);
      layer.appendChild(el);
      floorEl = el;
    }
    function keyBox() {
      return (floorEl && floorEl.querySelector('.farm-keys')) || floorEl;
    }
    function syncFloorZ() {
      if (!floorEl || floorEl.hidden) return;
      const top = parseFloat(floorEl.style.top) || 0;
      const grip = floorEl.querySelector('.farm-grip');
      const anchor = top + (grip ? grip.offsetHeight : 0);
      floorEl.style.zIndex = String(Math.round(anchor));
    }
    function placePiano(clientX, clientY) {
      if (!floorEl) return;
      const sr = stage.getBoundingClientRect();
      const w = floorEl.offsetWidth || 420;
      const h = floorEl.offsetHeight || 86;
      const left = clamp(clientX - sr.left - w / 2, 0, Math.max(0, stage.clientWidth - w));
      const top = clamp(clientY - sr.top - h / 2, 0, Math.max(0, stage.clientHeight - h));
      floorEl.style.left = left + 'px';
      floorEl.style.top = top + 'px';
      floorEl.hidden = false;
      syncFloorZ();
    }
    function holdKey(hit) {
      if (!hit || !floorEl) return;
      floorEl.querySelectorAll('[data-hold="1"]').forEach((el) => {
        if (Number(el.dataset.midi) !== hit.midi) {
          el.classList.remove('active');
          delete el.dataset.hold;
        }
      });
      const el = floorEl.querySelector(`[data-midi="${hit.midi}"]`);
      if (el) { el.dataset.hold = '1'; el.classList.add('active'); }
      if (!floorDrag || floorDrag.midi !== hit.midi) strikeFloorKey(hit);
      if (floorDrag) floorDrag.midi = hit.midi;
    }
    function clearHold() {
      if (!floorEl) return;
      floorEl.querySelectorAll('[data-hold="1"]').forEach((el) => {
        el.classList.remove('active');
        delete el.dataset.hold;
      });
    }
    function beginFloorGesture(e) {
      if (!floorEl || floorEl.hidden) return;
      const r = floorEl.getBoundingClientRect();
      const grip = e.target && e.target.closest && e.target.closest('.farm-grip');
      floorDrag = {
        mode: grip ? 'move' : 'play',
        x: e.clientX, y: e.clientY,
        ox: e.clientX - r.left, oy: e.clientY - r.top,
        midi: 0,
      };
      if (!grip) holdKey(keyAt(e.clientX, e.clientY));
      window.addEventListener('pointermove', onFloorMove);
      window.addEventListener('pointerup', onFloorUp);
    }
    function onFloorMove(e) {
      if (!floorDrag || !floorEl) return;
      if (floorDrag.mode === 'play') {
        const hit = keyAt(e.clientX, e.clientY);
        if (!hit) clearHold();
        else holdKey(hit);
        return;
      }
      if (Math.hypot(e.clientX - floorDrag.x, e.clientY - floorDrag.y) > 4) floorEl.classList.add('is-drag');
      const sr = stage.getBoundingClientRect();
      const w = floorEl.offsetWidth || 420;
      const h = floorEl.offsetHeight || 86;
      const left = clamp(e.clientX - sr.left - floorDrag.ox, 0, Math.max(0, stage.clientWidth - w));
      const top = clamp(e.clientY - sr.top - floorDrag.oy, 0, Math.max(0, stage.clientHeight - h));
      floorEl.style.left = left + 'px';
      floorEl.style.top = top + 'px';
      syncFloorZ();
    }
    function onFloorUp() {
      window.removeEventListener('pointermove', onFloorMove);
      window.removeEventListener('pointerup', onFloorUp);
      if (floorEl) floorEl.classList.remove('is-drag');
      clearHold();
      floorDrag = null;
    }
    function keyAt(x, y) {
      if (!floorEl || floorEl.hidden) return null;
      const box = keyBox();
      const r = box.getBoundingClientRect();
      const innerW = box.clientWidth;
      const innerH = box.clientHeight;
      if (innerW < 1 || innerH < 1) return null;
      const left = r.left + box.clientLeft;
      const top = r.top + box.clientTop;
      if (x < left || x > left + innerW || y < top || y > top + innerH) return null;
      const wW = innerW / FLOOR_WHITES.length;
      const lx = x - left;
      const ly = y - top;
      const bW = wW * BLACK_VIS_W + BLACK_HIT_PAD;
      const bH = innerH * BLACK_H;
      for (const b of FLOOR_BLACKS) {
        const cx = b.seam * wW;
        if (ly <= bH && lx >= cx - bW / 2 && lx <= cx + bW / 2) return { midi: b.midi, black: true };
      }
      const wi = Math.min(FLOOR_WHITES.length - 1, Math.max(0, Math.floor(lx / wW)));
      return { midi: FLOOR_WHITES[wi], black: false };
    }
    function strikeFloorKey(hit) {
      if (!hit) return;
      ensureAudio();
      const hz = 440 * Math.pow(2, (hit.midi - 69) / 12);
      play((t0) => {
        if (voicesFactory && actx) voicesFactory(actx, master).piano(t0, hit.midi, 0.42, 0.22);
        else cluck(t0, hz, 0.18);
      });
      const el = floorEl.querySelector(`[data-midi="${hit.midi}"]`);
      if (!el) return;
      el.classList.add('active');
      window.setTimeout(() => { if (el.dataset.hold !== '1') el.classList.remove('active'); }, 140);
    }
    function footPiano(c) {
      if (!floorEl || floorEl.hidden || c.concert || c.mode === 'held' || c.mode === 'leave') {
        c.floorMidi = 0;
        return;
      }
      const sr = stage.getBoundingClientRect();
      const hit = keyAt(sr.left + c.x, sr.top + c.y);
      const id = hit ? hit.midi : 0;
      if (id && id !== c.floorMidi) strikeFloorKey(hit);
      c.floorMidi = id;
    }
    buildFloorPiano();

    /* ===== 开合与默认：所有页面默认开（含手机），只有显式收起才记 '0'；?farm=1 强制开。
       'farm:toggle'=切换（Mimi 面板「进鸡场」与合作页「鸡场」chip 派发），'farm:open'=强制开。
       开着时 body 挂 .farm-on（全站 cursor:none、光标小鸡接管）；收起移除，页面零痕迹。 */
    const ON_KEY = 'coop-farm-on';
    function prefOn() {
      try {
        if (new URLSearchParams(location.search).get('coop') === '1') return true;
        return localStorage.getItem(ON_KEY) !== '0';
      } catch { return true; }
    }
    let opened = false; // restore 只在首次打开时跑一次
    let isOpen = false; // 当前开合状态（farm:toggle 依据）
    function openFarm(persist) {
      root.hidden = false;
      if (armedPropId) updateCursorGhost();
      const pill = document.getElementById('coop-reopen');
      if (pill) pill.hidden = true;
      isOpen = true;
      document.body.classList.add('farm-on');
      if (persist) { try { localStorage.setItem(ON_KEY, '1'); } catch { /* 隐私模式 */ } }
      if (!opened) { opened = true; restore(); } // 布局尺寸就绪后再把本页的鸡放回来
      startLoop();
    }
    function closeFarm(persist) {
      if (glowEl) { glowEl.classList.remove('farm-glow'); glowEl = null; }
      concertStop(); // 琴条挂在 body 上不在 #farm 里，收起必须显式停演——否则音乐会照播、琴条残留
      if (ghostEl) ghostEl.hidden = true;
      root.hidden = true;
      const pill = document.getElementById('coop-reopen');
      if (pill) pill.hidden = false;
      isOpen = false;
      document.body.classList.remove('farm-on');
      $('farm-book').hidden = true;
      $('farm-map').hidden = true;
      if (persist) { try { localStorage.setItem(ON_KEY, '0'); } catch { /* 隐私模式 */ } }
      stopLoop();
    }
    window.addEventListener('farm:toggle', () => { isOpen ? closeFarm(true) : openFarm(true); });
    window.addEventListener('farm:open', () => { openFarm(false); }); // 强制开，不改偏好
    $('farm-btn-close').addEventListener('click', () => { closeFarm(true); });
    if (prefOn()) openFarm(false);
    window.__coopSnapshot = snapshot; // 引擎块内落存根：挂件晚挂时补首读快照
  }
  window.__coop = {
    open: () => window.dispatchEvent(new Event('farm:open')),
    toggle: () => window.dispatchEvent(new Event('farm:toggle')),
    pages,   // 站点页面表（管家 goto 选项与 system 注入用）
    pack,    // 资产包（dialogue 可在包里覆盖默认剧本树）
    snapshot: () => (window.__coopSnapshot ? window.__coopSnapshot() : null), // 实时账本快照
  };
  /* 管家挂件：cfg.chat 传入即挂（离线剧本树全功能；api 配置后为真智能体） */
  if (cfg.chat) {
    import('./chat.js?' + VER)
      .then((m) => { m.attach(cfg.chat, window.__coop); })
      .catch(() => { /* chat.js 缺失时引擎照常工作 */ });
  }
  return window.__coop;
}
export { init };
