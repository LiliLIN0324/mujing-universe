/* ------------------------------------------------------------------
 * 本文件由 coop.js 引擎自动同步生成 —— 请勿手改。
 * 权威源：C:\coop-js\src\coop.js
 * 同步命令：cd C:\coop-js && npm run sync:site
 * 校验命令：cd C:\coop-js && npm run check:site
 * ------------------------------------------------------------------ */
/*!
 * coop.js v0.1.0 — 一行 script 给任何网站养一群鸡
 * 光标小鸡 · 点空白下蛋 · 图鉴收集（软保底/概率公示）· 跨页账本 · 触发点微光 · 品种音高
 * 零依赖、零追踪、localStorage 本地账。MIT。
 * 引擎与行为规范：web-pet-layer skill；默认美术包 © 林丽丽（CC BY-NC 4.0，允许署名转载、禁止商用）。
 * 公开事件 API（window CustomEvent）：farm:state / farm:say / farm:cmd / farm:toggle / farm:open
 */
/* 纸张颗粒：一小块噪声贴图（内联 data URI，不引外部图片），给纸面做旧用 */
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23g)' opacity='0.08'/%3E%3C/svg%3E\")";

const CSS = `/* v3：全站隐形舞台 + SIMPY LIFE 画风（扁平色块 / 白色描边 / 纸张颗粒 / 手写标注）。
   #farm 本体透明、不挡点击（pointer-events:none），只有鸡/蛋/HUD/浮层可交互。 */
  /* 画风令牌：墨 / 米白 / 盘面白 / 橙 / 绿 / 黄 / 深红 / 蓝 / 粉 / 灰 / 白。
     粉与灰是 2026-11-04 补的（画风唯一出处 research/art-style.md §2）：
     色音映射里 粉=Bb3、灰=Eb3 是既定的一档，之前没有这两个 token，
     粉·桃鸡的音符只能降级成橙、灰·贵族降级成墨 —— 音符是「这只鸡是谁」的标识，
     撞色就白做了。色值来自丽丽自己的素材（粉 #eaa98d / 灰 #9c9c93）。 */
  .farm, .farm-piano, #coop-reopen, .farm-ghost {
    --ink: #2B2118;
    --paper: #F3EBDD;
    --card: #FFFDF6;
    --orange: #E4743A;
    --green: #6E9A55;
    --yellow: #E8B93C;
    --red: #9C3A31;
    --blue: #4A6E96;
    --pink: #EAA98D;
    --gray: #9C9C93;
    --white: #FFFFFF;
    --grain: ${GRAIN};
  }
  .farm {
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
    0% { box-shadow: inset 0 0 0 9999px transparent; }
    22% { box-shadow: inset 0 0 0 9999px color-mix(in srgb, var(--orange) 20%, transparent); }
    100% { box-shadow: inset 0 0 0 9999px transparent; }
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
    border: 2px solid var(--ink);
    background: var(--card);
    transition: bottom 0.5s cubic-bezier(0.22, 1.2, 0.36, 1);
  }
  .farm-piano.is-up { bottom: 14px; }
  .farm-key {
    flex: 1;
    position: relative;
    border-right: 1px solid color-mix(in srgb, var(--ink) 25%, transparent);
    background: var(--white);
    transition: transform 0.09s ease, background 0.09s ease;
    transform-origin: 50% 0;
  }
  .farm-key:last-child { border-right: 0; }
  .farm-key.is-down { transform: scaleY(0.965); background: color-mix(in srgb, var(--yellow) 35%, var(--white)); }
  .farm-key em {
    position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%);
    font-style: normal; font-size: 11px; color: color-mix(in srgb, var(--ink) 60%, transparent); letter-spacing: 0.08em;
  }
  /* 黑键：窄、短、骑在白键接缝上（真实钢琴布局） */
  .farm-key.is-black {
    position: absolute;
    width: 58%;
    height: 62%;
    top: 0;
    background: var(--ink);
    border: 2px solid var(--ink);
    border-top: 0;
    z-index: 3;
    box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--white) 10%, transparent);
  }
  .farm-key.is-black.is-down { background: var(--ink); box-shadow: inset 0 -3px 0 var(--orange); transform: scaleY(0.9); }
  .farm-key.is-black em { color: var(--card); bottom: 4px; }
  @media (prefers-reduced-motion: reduce) { .farm-piano { transition: none; } }

  /* 地琴：场上家具，不是底边 HUD。白键乳白、黑键近黑，琴架浅木色。 */
  .farm-floor {
    position: absolute; left: 0; top: 0;
    display: flex; flex-direction: column; width: 420px;
    box-sizing: border-box; background: var(--paper); border: 2px solid var(--ink);
    pointer-events: auto; touch-action: none; user-select: none;
  }
  .farm-floor.is-drag { cursor: grabbing; }
  .farm-floor[hidden] { display: none !important; }
  .farm-grip { height: 8px; flex: none; background: var(--ink); cursor: grab; }
  .farm-keys { display: flex; height: 78px; position: relative; }
  .farm-fkey { flex: 1; position: relative; height: 100%; }
  .farm-fkey .w {
    height: 100%; margin: 0 1px; background: var(--white);
    border-radius: 0 0 4px 4px; box-shadow: inset 0 -6px 0 var(--paper);
    display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px;
  }
  .farm-fkey .w em { font-style: normal; font-size: 10px; color: color-mix(in srgb, var(--ink) 55%, transparent); pointer-events: none; }
  .farm-fkey .b {
    position: absolute; left: 100%; top: 0; width: 50%; height: 70%;
    transform: translateX(-50%); z-index: 1; pointer-events: auto;
    background: var(--ink); border-radius: 0 0 3px 3px;
    box-shadow: 0 2px 3px color-mix(in srgb, var(--ink) 45%, transparent);
  }
  .farm-fkey .w.active { background: color-mix(in srgb, var(--yellow) 35%, var(--white)); transform: translateY(2px); }
  .farm-fkey .b.active { background: var(--ink); box-shadow: inset 0 -3px 0 var(--orange); height: 68%; }
  /* 货架：Factorish/Dewdrop 式小图标槽，默认可收起，少挡画面 */
  .farm-shelf {
    position: fixed; left: 14px; bottom: 50px; z-index: 1100;
    display: flex; align-items: center; gap: 4px;
    pointer-events: auto; background: transparent; border: 0; padding: 0;
  }
  .farm-shelf-toggle {
    font: inherit; font-size: 11px; font-weight: 700; line-height: 1;
    height: 28px; padding: 0 10px; white-space: nowrap;
    border: 2px solid var(--ink); border-radius: 6px;
    background: var(--card); color: var(--ink); cursor: pointer;
    box-shadow: inset 0 0 0 2px var(--white);
  }
  .farm-shelf-toggle:hover { background: var(--orange); color: var(--white); border-color: var(--ink); }
  .farm-shelf-toggle[aria-expanded="true"] { background: var(--orange); color: var(--white); }
  .farm-shelf-toggle.is-armed { background: var(--red); color: var(--white); }
  .farm-shelf-slots {
    display: flex; align-items: center; gap: 3px;
  }
  .farm-shelf.is-stowed .farm-shelf-slots { display: none; }
  .farm-prop {
    font: inherit; font-size: 0; line-height: 0;
    width: 32px; height: 32px; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border: 2px solid var(--ink); border-radius: 6px;
    background: var(--card); color: var(--ink); cursor: pointer;
    box-shadow: inset 0 0 0 2px var(--white);
  }
  .farm-prop em { display: none; }
  .farm-prop:hover { background: var(--orange); border-color: var(--ink); }
  .farm-prop.is-armed { background: var(--red); color: var(--white); }
  .farm-prop:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
  .farm-ico { display: block; pointer-events: none; }
  .farm-ico.rice { position: relative; width: 18px; height: 14px; }
  .farm-ico.rice i {
    position: absolute; width: 5px; height: 5px; border-radius: 50%; background: var(--yellow);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ink) 30%, transparent);
  }
  .farm-ico.rice i:nth-child(1) { left: 1px; top: 6px; }
  .farm-ico.rice i:nth-child(2) { left: 6px; top: 1px; }
  .farm-ico.rice i:nth-child(3) { left: 12px; top: 7px; }
  .farm-ico.piano {
    width: 20px; height: 12px; background: var(--white); border: 1px solid var(--ink); position: relative;
  }
  .farm-ico.piano::before {
    content: ""; position: absolute; left: 0; right: 0; top: 0; height: 7px;
    background:
      linear-gradient(var(--ink), var(--ink)) 16% 0 / 12% 100% no-repeat,
      linear-gradient(var(--ink), var(--ink)) 34% 0 / 12% 100% no-repeat,
      linear-gradient(var(--ink), var(--ink)) 62% 0 / 12% 100% no-repeat,
      linear-gradient(var(--ink), var(--ink)) 80% 0 / 12% 100% no-repeat;
  }
  .farm-shelf-tip { display: none; }
  /* 布景道具（瓷盘/竹篮/水缸）：引擎摆壳、定位、拖动；外观走 pack.json 登记的素材。
     位置按舞台比例存账（刷新还在），可拖动；小鸡 z-index 更高，走在道具前面。
     有登记就画真图；没登记才退回中性示意框（占位，不是最终长相）。 */
  .farm-deco {
    position: absolute; pointer-events: auto; z-index: 0; touch-action: none; cursor: grab;
    box-sizing: border-box;
    color: var(--ink); font: inherit; font-size: 12px; line-height: 1;
  }
  .farm-deco:active { cursor: grabbing; }
  /* 真图：素材在 pack.json 的 decos 里登记，整块当画布用 */
  .farm-deco[data-art="1"] .farm-deco-img {
    position: absolute; left: 0; right: 0; top: 0; height: 100%;
    width: 100%; object-fit: contain; pointer-events: none; -webkit-user-drag: none;
  }
  /* 场景里不挂常驻文字标签（2026-11-03 终树定）：
     成熟游戏里物件不飘名字——星露谷靠悬停提示和背包栏，动森/Cozy Grove 是交互时弹一个临时气泡。
     器物名字由图说，用途说明在货架按钮的悬停提示里（见 PROPS 里的 tip）。
     所以这里没有 ::after 文字层，物件整块就是图。 */
  /* 没有素材时的中性占位：让人看得见"这儿有个能摆的东西"，不画画风 */
  .farm-deco:not([data-art="1"])::before {
    content: ""; position: absolute; left: 0; right: 0; top: 0; height: 100%;
    border: 2px dashed var(--ink); border-radius: 10px;
    background: color-mix(in srgb, var(--paper) 65%, transparent);
  }
  .farm-deco:not([data-art="1"])[data-deco="plate"]::before { border-radius: 50%; }
  /* 存量角标：盘里的米、篮里的蛋，用数字标出来（看得见的存量，不是装饰） */
  .farm-deco .farm-deco-num {
    position: absolute; right: 3px; top: 3px;
    min-width: 17px; height: 17px; padding: 0 4px;
    border-radius: 9px; background: var(--ink); color: var(--paper);
    font-size: 10px; line-height: 17px; text-align: center; font-weight: 700;
  }
  .farm-deco[data-deco="basket"] .farm-deco-num { right: 50%; top: -7px; transform: translateX(50%); }
  .farm-deco[data-deco="incubator"] .farm-deco-num { right: 50%; top: -7px; transform: translateX(50%); }
  /* 孵化窝里的蛋：按存量画（数量是信息，不能画死在图里） */
  .farm-deco .farm-deco-egg {
    position: absolute; width: 7px; height: 9px;
    border-radius: 50% 50% 46% 46% / 62% 62% 38% 38%;
    background: var(--paper); border: 1.5px solid var(--ink);
  }
  /* 孵化进度条：信息（不是装饰）——最老那颗蛋孵到哪儿了 */
  .farm-deco .farm-deco-bar {
    position: absolute; left: 22%; right: 22%; bottom: 3px; height: 3px;
    border-radius: 2px; overflow: hidden;
    background: color-mix(in srgb, var(--ink) 16%, transparent);
  }
  .farm-deco .farm-deco-bar i { display: block; height: 100%; background: var(--orange); }
  /* 蛋篓的品种选择：点篮子才出现的一格格小鸡脸。
     不挂常驻文字（器物下面不飘名字，是这轮定的规矩）——品种靠脸认，名字给 title。 */
  .farm-picker {
    position: absolute; z-index: 1150; pointer-events: auto;
    display: grid; grid-template-columns: repeat(3, 38px); gap: 4px;
    padding: 6px; border-radius: 12px;
    background: var(--paper); border: 2px solid var(--ink);
    box-shadow: inset 0 0 0 2px var(--white);
  }
  .farm-pick {
    width: 38px; height: 38px; padding: 0; border: 2px solid var(--ink); border-radius: 9px;
    background: var(--card); cursor: pointer; overflow: hidden; position: relative;
  }
  .farm-pick:hover { background: var(--orange); }
  .farm-pick:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
  /* 小鸡脸：从品种表情表切第 0 格（平静脸）。分母是 cols-1，这里固定 3×3 直接给百分比。 */
  .farm-pick-art {
    display: block; width: 100%; height: 100%;
    background-repeat: no-repeat; background-size: 300% 300%; background-position: 0 0;
  }
  .farm-pick-art.is-dot { background-size: auto; background-position: center; }
  /* 盘里的米：真米粒（复用谷粒样式 .farm-grain），落在盘心那块米白方里 */
  .farm-deco .farm-grain { width: 5px; height: 5px; }
  /* 心情差 = 蔫：降饱和、微微下垂 */
  .farm-chick.is-glum { filter: saturate(.5) brightness(.95); }
  /* 脏了 = 清洁低（状态多维）：去饱和一点 + 轻微抖一下。
     跟 is-glum 的区别：蔫是「心情不好」（降饱和 + 暗），
     脏是「没洗澡」（降饱和 + 抖）—— 两者的画面信号不能一样，
     不然玩家分不清该去陪它还是该去添水。 */
  .farm-chick.is-dirty { filter: saturate(.72); }
  .farm-chick.is-dirty .farm-chick-in { animation: farm-shiver 0.5s ease-in-out infinite; }
  @keyframes farm-shiver {
    0%, 100% { transform: translateX(0) rotate(0); }
    25% { transform: translateX(-1px) rotate(-1.2deg); }
    75% { transform: translateX(1px) rotate(1.2deg); }
  }
  @media (prefers-reduced-motion: reduce) { .farm-chick.is-dirty .farm-chick-in { animation: none; } }
  /* 打盹：站着微微点头 */
  .farm-chick.is-sleep .farm-chick-in { animation: farm-nap 2.6s ease-in-out infinite; }
  @keyframes farm-nap { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(1px) rotate(-3deg); } }
  /* 道具未解锁：灰掉 + 不可点 */
  .farm-prop[data-locked="1"] { opacity: .42; cursor: not-allowed; }
  .farm-ico.plate {
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--paper); border: 2px solid var(--orange);
    box-shadow: inset 0 0 0 2px var(--white);
  }
  .farm-ico.basket {
    width: 20px; height: 15px; border-radius: 3px 3px 8px 8px;
    background: var(--yellow); border: 2px solid var(--ink);
    box-shadow: inset 0 0 0 2px var(--white);
  }
  .farm-ico.water {
    width: 18px; height: 16px; border-radius: 3px 3px 8px 8px;
    background: var(--blue); border: 2px solid var(--ink);
    box-shadow: inset 0 0 0 2px var(--white);
  }
  .farm-ico.incubator {
    width: 22px; height: 16px; border-radius: 12px 12px 4px 4px;
    background: var(--yellow); border: 2px solid var(--ink);
    box-shadow: inset 0 0 0 2px var(--white);
  }
  /* 「收」工具的图标：开口的箱子 + 一个向上的箭头（收 = 从场上拿回来）。
     纯 CSS 简形，不引外部图（和上面几个道具图标同一套画法）。 */
  .farm-ico.pickup { position: relative; width: 20px; height: 18px; }
  .farm-ico.pickup::before {
    content: ""; position: absolute; left: 2px; bottom: 0; width: 16px; height: 8px;
    background: var(--paper); border: 2px solid var(--ink); border-top: 0;
    border-radius: 0 0 3px 3px;
  }
  .farm-ico.pickup::after {
    content: ""; position: absolute; left: 7px; top: 1px; width: 0; height: 0;
    border-left: 4px solid transparent; border-right: 4px solid transparent;
    border-bottom: 7px solid var(--orange);
  }
  /* 货架图标：能取到真图就用真图（和摆出来的道具长得一样），取不到才用上面那几行简形 */
  .farm-ico.is-art {
    width: 24px; height: 24px; border: 0; border-radius: 0; box-shadow: none; background: none;
    background-repeat: no-repeat; background-position: center; background-size: contain;
  }
  .farm-ghost {
    position: fixed; left: 0; top: 0; width: 28px; height: 18px;
    margin: -9px 0 0 -14px; opacity: 0.5; pointer-events: none; z-index: 1002;
  }
  .farm-ghost[hidden] { display: none !important; }
  .farm-ghost i {
    position: absolute; width: 5px; height: 5px; border-radius: 50%; background: var(--yellow);
  }
  .farm-ghost.is-piano {
    width: 168px; height: 36px; margin: -18px 0 0 -84px;
    background: var(--card); border: 1px solid var(--ink); opacity: 0.55;
  }
  .farm-ghost.is-piano::before {
    content: ""; position: absolute; left: 0; right: 0; top: 0; height: 6px; background: var(--ink);
  }
  /* 「收」工具的光标：虚线框（跟摆东西的五个点不一样，一看就知道是「拿回来」） */
  .farm-ghost.is-pick {
    width: 30px; height: 22px; margin: -11px -15px;
    border: 2px dashed var(--ink); border-radius: 4px; background: none; opacity: .6;
  }

  /* 气氛层：默认全关。网页不按本地时钟铺夜幕。以后一次性事件（烟花等）可短暂使用，用完卸下。 */
  .farm-night {
    position: absolute; inset: 0; pointer-events: none; z-index: 5;
    background: var(--blue); opacity: 0; transition: opacity 1.2s ease;
  }
  .farm-night .farm-star { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: var(--white); opacity: 0.7; }
  /* 谷粒 */
  .farm-grain { position: absolute; width: 4px; height: 4px; border-radius: 50%;
    background: var(--yellow); box-shadow: 0 0 0 1px color-mix(in srgb, var(--ink) 15%, transparent); pointer-events: none; }
  /* 睡觉 Z 气泡 */
  .farm-zzz { position: absolute; font-size: 12px; color: var(--blue); pointer-events: none;
    animation: farm-zzz 1.6s ease-out forwards; }
  @keyframes farm-zzz { from { opacity: 0.9; transform: translateY(0); } to { opacity: 0; transform: translateY(-26px); } }
  @media (prefers-reduced-motion: reduce) { .farm-zzz { animation: none; opacity: 0.7; } }
  .farm * { box-sizing: border-box; margin: 0; padding: 0; }
  .farm .farm-fkey .w { padding-bottom: 5px; }
  #coop-reopen { position: fixed; left: 14px; bottom: 14px; z-index: 165;
    display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px;
    border: 2px solid var(--ink); border-radius: 8px; background: var(--card); color: var(--ink);
    box-shadow: inset 0 0 0 2px var(--white);
    font: 600 13px "Alibaba PuHuiTi 3.0","PingFang SC",system-ui,sans-serif; cursor: pointer; }
  #coop-reopen:hover { background: var(--orange); border-color: var(--ink); color: var(--white); }
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
  body.farm-on :is(.mimi-panel, .farm-card, .farm-bcast-link, input, textarea, select),
  body.farm-on :is(.mimi-panel, .farm-card, .farm-bcast-link, input, textarea, select) * { cursor: auto !important; }
  /* 触发点微光：精确落点的橙色光点（小鸡是身体，光点是喙）+ 可点元素橙色描边 */
  .farm-dot {
    position: fixed; left: 0; top: 0; width: 7px; height: 7px;
    margin: -3px 0 0 -3px; background: var(--orange);
    box-shadow: 0 0 6px 2px color-mix(in srgb, var(--orange) 55%, transparent);
    z-index: 1001; pointer-events: none; will-change: transform;
    opacity: 0; transition: opacity 0.15s ease;
  }
  .farm-dot.is-live { opacity: 1; }
  .farm-dot.is-hidden { opacity: 0; }
  .farm-glow { outline: 2px solid var(--orange); outline-offset: 1px; }
  @media (hover: none), (pointer: coarse) { .farm-dot { display: none; } }

  /* HUD：左下角小药丸 */
  .farm-hud {
    position: fixed; left: 14px; bottom: 14px;
    display: flex; align-items: center; gap: 3px; flex-wrap: nowrap;
    pointer-events: auto; z-index: 1100;
    background: var(--card); border: 2px solid var(--ink); border-radius: 8px;
    padding: 4px 5px;
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
  .farm-brand { background: var(--ink); color: var(--paper); padding: 3px 7px; border-radius: 4px; }
  .farm-btns { display: flex; gap: 4px; flex-wrap: nowrap; pointer-events: auto; }
  /* 按钮 = 扁平色块：墨色 2px 描边 + 白色描边分隔；hover 只加深色块，不加发光投影 */
  .farm-btn {
    font: inherit; font-size: 12px; font-weight: 700; line-height: 1.2;
    background: var(--yellow); color: var(--ink);
    border: 2px solid var(--ink); border-radius: 6px;
    box-shadow: inset 0 0 0 2px var(--white);
    padding: 3px 9px; cursor: pointer; white-space: nowrap;
  }
  .farm-btn:hover { background: var(--orange); color: var(--white); border-color: var(--ink); }
  .farm-btn:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
  .farm-btn[aria-pressed="true"] { background: var(--orange); color: var(--white); border-color: var(--ink); }

  .farm-hint {
    position: fixed; left: 14px; bottom: 54px;
    background: var(--card); border: 2px solid var(--ink); border-radius: 6px;
    padding: 3px 9px; font-size: 12px; font-weight: 600; white-space: nowrap;
    z-index: 1050; pointer-events: none; transition: opacity 0.4s ease;
  }
  .farm-hint.is-off { opacity: 0; }

  /* 跟随光标的小鸡：悬停 UI 面板/输入聚焦时淡出（updateCursorVisibility 控制 opacity） */
  .farm-cursor { position: absolute; left: 0; top: 0; width: 56px; height: 67px; z-index: 1000; pointer-events: none; will-change: transform; transition: opacity 0.2s ease; }
  .farm-cursor-in { width: 100%; height: 100%; transform-origin: 50% 88%; }
  .farm-cursor svg { width: 100%; height: 100%; display: block; }
  /* 光标小鸡用角色真图（丽丽品种全家福）：等比缩到盒高，脚落在盒底 */
  .farm-cursor-in img.farm-cursor-art { width: auto; height: 100%; max-width: 100%; display: block; margin: 0 auto; }
  .farm-cursor-in.is-squat { animation: farm-squat 0.34s ease both; }
  @keyframes farm-squat { 0% { transform: translateY(0) scaleY(1); } 45% { transform: translateY(5px) scaleY(0.72); } 100% { transform: translateY(0) scaleY(1); } }

  /* 游走的小鸡 */
  .farm-chick { position: absolute; left: 0; top: 0; width: 40px; height: 48px; pointer-events: auto; will-change: transform; }
  /* 这只鸡在干嘛：跨页差事的可见标记（Codex Pets 那一课 —— 宠物是状态指示器，不是装饰）
     办事中 = 头顶一颗跳动的橙点。
     这不是装饰：它承载的是「这只鸡被派去办事了」这个信息。
     （礼物不标：redeemGifts 当场结算，礼物是瞬时事件不是状态。） */
  .farm-chick.is-busy::after {
    content: ''; position: absolute; left: 50%; top: -7px;
    width: 8px; height: 8px; margin-left: -4px;
    border: 2px solid var(--ink); border-radius: 50%; background: var(--orange);
    animation: farm-mark-pulse 0.9s ease-in-out infinite;
  }
  @keyframes farm-mark-pulse { 0%, 100% { transform: translateY(0); opacity: 1; } 50% { transform: translateY(-3px); opacity: .55; } }
  @media (prefers-reduced-motion: reduce) { .farm-chick.is-busy::after { animation: none; } }
  .farm-chick-wob, .farm-chick-in { width: 100%; height: 100%; transform-origin: 50% 90%; }
  /* 闲置呼吸：叠在 wob 层，避免与 .farm-chick-in 的 hop/peck 抢同一 transform；曲线借自小鸡宇宙动画样片 scale(.978,1.032) @ 1.9s */
  /* 呼吸改由 draw() 写进 wob.transform（JS 每帧会覆盖 CSS animation） */
  .farm-chick svg { width: 100%; height: 100%; display: block; }
  .farm-chick.is-fade { opacity: 0; transition: opacity 0.8s linear; }
  .farm-chick-in.is-pop { animation: farm-pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1) both; }
  @keyframes farm-pop { 0% { transform: scale(0.1) translateY(8px); } 70% { transform: scale(1.14) translateY(-5px); } 100% { transform: scale(1) translateY(0); } }
  .farm-chick-in.is-hop { animation: farm-hop 0.5s cubic-bezier(0.3, 1.6, 0.5, 1) both; }
  @keyframes farm-hop { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-16px); } }
  /* peck/tilt/crow 曲线抄自小鸡宇宙-作品页/stage-cut.html（ACT_MS），整鸡 .farm-chick-in ≈ 她的 .walk-y；勿嵌 stage */
  .farm-chick-in.is-peck { animation: farm-peck 1.05s ease-in-out both; }
  @keyframes farm-peck {
    0%, 100% { transform: rotate(0); }
    14% { transform: rotate(23deg); } 30% { transform: rotate(3deg); }
    44% { transform: rotate(20deg); } 60% { transform: rotate(2deg); }
    76% { transform: rotate(17deg); } 90% { transform: rotate(0); }
  }
  .farm-chick-in.is-tilt { animation: farm-tilt 1.60s ease-in-out both; }
  @keyframes farm-tilt {
    0%, 100% { transform: rotate(0); }
    22% { transform: rotate(-13deg); } 62% { transform: rotate(-11deg); } 80% { transform: rotate(3deg); }
  }
  .farm-chick-in.is-crow { animation: farm-crow 1.35s ease-in-out both; }
  @keyframes farm-crow {
    0%, 100% { transform: rotate(0); }
    25% { transform: rotate(-15deg); } 70% { transform: rotate(-13deg); } 88% { transform: rotate(2deg); }
  }
  /* 分层换皮：动画样片 01-造型九式-01。画板按素材等比缩放（aspect-ratio 锁比例），
     脚线 footY 落盒底；倾角支点在脚底（transform-origin 50% 100%），不悬空。 */
  .farm-chick-rig { position: relative; width: 100%; height: 100%; overflow: visible; transform-origin: 50% 100%; transform: rotate(var(--rig-rot, 0deg)); }
  .farm-chick-art { position: absolute; left: 50%; bottom: 0; height: 100%; width: auto; aspect-ratio: var(--rig-ar, 244 / 340); transform: translateX(-50%) var(--pose, ); transform-origin: 50% 100%; }
  .farm-chick-rig .farm-part {
    position: absolute; display: block; pointer-events: none;
    transform-origin: 50% 100%;
  }
  /* 表情表：九格精灵表，切帧只改 background-position（不换图 → 不闪）。
     格子比例写在 --rig-ar 里（格子宽/高），脚底仍对齐盒底。 */
  .farm-chick-art.is-expr { background-repeat: no-repeat; background-position: 0 0; }
  /* 素材没上线的退路（2026-11-05）：鸡场美术不入公开仓（授权条款待定），
     线上 /packs 会 404 —— 这时用 sprite.svg 的内联矢量小鸡顶上，**不留破图方块**。
     摆法照抄 .farm-chick-art：脚底对齐盒底，水平居中。 */
  .farm-chick-rig.is-fallback .farm-chick-fallback {
    position: absolute; left: 50%; bottom: 0; height: 100%; width: auto;
    transform: translateX(-50%); transform-origin: 50% 100%;
  }
  /* 姿态表情：rig 模式（丽丽的角色真图）没有表情帧，情绪改用**姿态**表达 ——
     --pose 叠在 art 层（支点在脚底，不悬空），跟 .farm-chick-in 上的动作动画
     （is-peck / is-hop）不抢同一个 transform。
     等丽丽按全家福造型补了 9 表情九宫格，切回 expr 模式，这些姿态就退成兜底。 */
  .farm-chick.is-cheer { --pose: translateY(-2px) scale(1.03); }
  .farm-chick.is-hungry { --pose: rotate(8deg) translateY(3px); }
  .farm-chick.is-doubt { --pose: rotate(-9deg); }
  .farm-chick.is-shock { --pose: scale(1.07) translateY(-3px); }
  .farm-chick.is-blink { --pose: scaleY(.93); }
  /* 进化演出：跨阶时弹一下（数码蛋那套「进化要有仪式感」的最小实现）。
     放在 .farm-chick-in 上 —— 跟 is-peck / is-hop 同层，但选择器特异性更高，进化的 0.9 秒里
     啄食动作会让位（那一下本来就该是「主角时刻」）。 */
  .farm-chick.is-evolve .farm-chick-in { animation: farm-evolve 0.9s cubic-bezier(0.2, 1.4, 0.4, 1) both; }
  @keyframes farm-evolve {
    0% { transform: scale(1) translateY(0); }
    32% { transform: scale(1.16) translateY(-10px); }
    66% { transform: scale(0.95) translateY(0); }
    100% { transform: scale(1) translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) { .farm-chick.is-evolve .farm-chick-in { animation: none; } }


  /* 蛋与蛋壳（蛋可点，作为世界的一部分） */
  .farm-egg { position: absolute; left: 0; top: 0; width: 34px; height: 41px; margin-left: -17px; margin-top: -41px; pointer-events: auto; }
  .farm-egg svg { width: 100%; height: 100%; display: block; transform-origin: 50% 100%; }
  .farm-egg.is-drop svg { animation: farm-drop 0.5s cubic-bezier(0.3, 0.7, 0.4, 1) both; }
  @keyframes farm-drop { 0% { transform: translateY(-64px); } 55% { transform: translateY(0); } 72% { transform: translateY(-12px); } 86% { transform: translateY(0); } 100% { transform: translateY(0); } }
  .farm-egg.is-wob svg { animation: farm-wob 1.15s ease-in-out both; }
  @keyframes farm-wob { 0% { transform: rotate(0); } 15% { transform: rotate(-9deg); } 35% { transform: rotate(8deg); } 55% { transform: rotate(-7deg); } 75% { transform: rotate(5deg); } 90% { transform: rotate(-3deg); } 100% { transform: rotate(0); } }
  .farm-egg.is-crack { --cfcrack: 1; }
  /* 破壳图（丽丽 成长阶梯-05 改色）：蛋壳裂开、雏头探出来。
     演出图，不是阶段 —— 碎壳之后就是「雏鸡」这一阶。
     图没加载到（线上 /packs 会 404）就退回 SVG 蛋的裂纹，不留破图。 */
  .farm-egg img.farm-egg-hatch {
    position: absolute; left: 50%; bottom: 0; height: 100%; width: auto;
    transform: translateX(-50%); transform-origin: 50% 100%; display: block;
  }
  .farm-egg.is-hatch { transform-origin: 50% 100%; animation: farm-hatch 0.3s ease-in-out 3; }
  @keyframes farm-hatch { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-4deg) scale(1.03); } }
  @media (prefers-reduced-motion: reduce) { .farm-egg.is-hatch { animation: none; } }
  /* 蛋壳默认黄（JS 会按品种改成 shellColor 的派生色）——别让 color 漏了变成墨色 */
  .farm-egg, .farm-shells { color: var(--yellow); }
  .farm-shells { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; }
  .farm-shl { position: absolute; display: block; }
  .farm-shl-b { width: 30px; height: 20px; left: -15px; top: -19px; animation: farm-shlb 0.75s ease both; }
  .farm-shl-t { width: 30px; height: 22px; left: -15px; top: -43px; animation: farm-shlt 0.75s cubic-bezier(0.2, 0.7, 0.4, 1) both; }
  @keyframes farm-shlb { 0% { transform: translateY(0); opacity: 1; } 35% { transform: translateY(-7px); opacity: 1; } 100% { transform: translateY(1px); opacity: 0; } }
  @keyframes farm-shlt { 0% { transform: translate(0, 0) rotate(0); opacity: 1; } 100% { transform: translate(-34px, -42px) rotate(-130deg); opacity: 0; } }

  /* 点鸡弹出的菜单（VPet ToolBar 式，2026-11-04）
     画风照 §2：扁平色块 + 墨色 2px 描边 + 白色描边分隔，无渐变、无阴影投影。
     菜单是临时气泡，不是常驻面板 —— 成熟游戏都不长期飘着名字。 */
  .farm-cmenu {
    position: absolute; z-index: 1160; pointer-events: auto;
    width: 132px; padding: 6px;
    background: var(--card); border: 2px solid var(--ink); border-radius: 10px;
    box-shadow: inset 0 0 0 2px var(--white);
    font-size: 12px; font-weight: 600; color: var(--ink);
    user-select: none; -webkit-user-select: none;
  }
  .farm-cmenu-head {
    font-weight: 700; font-size: 12px; line-height: 1.2;
    padding: 1px 4px 3px; margin-bottom: 3px;
    border-bottom: 2px solid var(--ink);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  /* 三轴现状：谁低谁就显出来（玩家一眼看出该做什么） */
  .farm-cmenu-vitals {
    display: flex; gap: 3px; padding: 0 2px 4px; font-size: 11px;
  }
  .farm-cmenu-vitals span {
    flex: 1; text-align: center; padding: 1px 0;
    background: var(--paper); border: 1.5px solid var(--ink); border-radius: 4px;
    font-variant-numeric: tabular-nums;
  }
  .farm-cmenu-btn {
    display: block; width: 100%; margin-top: 3px;
    font: inherit; font-size: 12px; font-weight: 700; line-height: 1.2;
    background: var(--yellow); color: var(--ink);
    border: 2px solid var(--ink); border-radius: 6px;
    box-shadow: inset 0 0 0 2px var(--white);
    padding: 4px 6px; cursor: pointer; text-align: left;
  }
  .farm-cmenu-btn:hover { background: var(--orange); color: var(--white); }
  .farm-cmenu-btn:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
  .farm-cmenu-btn + .farm-cmenu-btn { margin-top: 3px; }
  /* 条件没满足的项：灰掉 + 不可点（但**仍可见** —— 玩家要看得见「还有这条路」） */
  .farm-cmenu-btn.is-off,
  .farm-cmenu-btn[disabled] {
    background: var(--paper); color: color-mix(in srgb, var(--ink) 55%, transparent);
    cursor: not-allowed; box-shadow: none;
  }
  .farm-cmenu-btn.is-off:hover, .farm-cmenu-btn[disabled]:hover { background: var(--paper); color: color-mix(in srgb, var(--ink) 55%, transparent); }

  /* 视觉音符：品种音发声处浮起一枚 ♪（品种色、12-18px、上浮 40px 渐隐 1.6s） */
  .farm-note {
    position: absolute; z-index: 950; pointer-events: none;
    font-weight: 700; line-height: 1;
    transform: translate(-50%, -100%);
    text-shadow: 0 1px 0 color-mix(in srgb, var(--card) 85%, transparent);
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
    background: var(--card); border: 2px solid var(--ink); border-radius: 8px;
    padding: 4px 9px; font-size: 12px; font-weight: 600;
    white-space: pre-line;          /* 第二行要能单独成行（成长进度） */
    text-align: center; max-width: 220px;
    /* z-index 要高过光标小鸡（1000）：点鸡时鼠标就在鸡身上，
       光标小鸡会正好压住气泡 —— 气泡是正在读的东西，得在最上面。 */
    z-index: 1100; pointer-events: none;
    animation: farm-bubin 0.16s ease both, farm-bubout 0.3s ease var(--bubout, 1.55s) both;
  }
  .farm-bubble::after {
    content: ""; position: absolute; left: 50%; bottom: -5px; width: 7px; height: 7px;
    background: var(--card); border-right: 2px solid var(--ink); border-bottom: 2px solid var(--ink);
    transform: translateX(-50%) rotate(45deg);
  }
  /* 站内快讯：鸡冒泡报的官网消息。气泡比普通台词宽，左对齐，末尾挂一个「去看看」链接。
     规矩：这是**临时气泡**，不是常驻控件（官网每页内容都满，不能再挂常驻东西）。 */
  .farm-bubble.is-bcast { max-width: 300px; text-align: left; padding: 6px 10px 7px; font-weight: 500; }
  .farm-bcast-tag {
    display: inline-block; vertical-align: 1px; margin-right: 5px;
    background: var(--orange); color: var(--white);
    font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
    border-radius: 3px; padding: 1px 5px;
  }
  .farm-bcast-title { font-weight: 700; }
  .farm-bcast-body { display: block; margin-top: 2px; font-size: 11px; opacity: 0.72; }
  .farm-bcast-link {
    display: inline-block; margin-top: 4px; font-size: 11px; font-weight: 700;
    color: var(--blue); text-decoration: underline; text-underline-offset: 2px;
    pointer-events: auto;   /* 气泡本体不挡点击，只有这个链接可点 */
  }
  .farm-bcast-link:hover { color: var(--orange); }
  @keyframes farm-bubin { 0% { transform: translate(-50%, -30%) scale(0.6); opacity: 0; } 100% { transform: translate(-50%, -100%) scale(1); opacity: 1; } }
  @keyframes farm-bubout { to { opacity: 0; } }

  /* 手册与地图浮层（全屏遮罩 + 居中卡片） */
  .farm-wrap { position: absolute; inset: 0; z-index: 1200; display: flex; align-items: center; justify-content: center; pointer-events: none; padding: 12px; }
  .farm-scrim { position: absolute; inset: 0; background: color-mix(in srgb, var(--ink) 32%, transparent); pointer-events: auto; cursor: pointer; }
  /* 手册卡 = 大盘：米白盘面 + 墨色 2px 描边 + 白色描边分隔 + 纸张颗粒做旧 */
  .farm-card {
    position: relative; pointer-events: auto; cursor: auto;
    background: var(--card); background-image: var(--grain);
    border: 2px solid var(--ink); border-radius: 10px;
    box-shadow: inset 0 0 0 2px var(--white);
    width: min(560px, 100%); max-height: 100%; overflow: auto; padding: 14px;
  }
  .farm-cardhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .farm-cardhead b { font-size: 15px; }
  /* 标题 = 一条略微旋转的纸胶带 */
  .farm-tape {
    display: inline-block; padding: 3px 12px;
    background: color-mix(in srgb, var(--yellow) 55%, transparent);
    color: var(--ink); font-size: 15px; font-weight: 700;
    transform: rotate(-1.6deg);
    clip-path: polygon(2% 0, 98% 4%, 100% 52%, 97% 100%, 3% 96%, 0 48%);
  }
  /* 图鉴网格：手写圈画在这一层（pointer-events:none，不挡格子点击） */
  .farm-grid { position: relative; display: grid; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 10px; }
  .farm-annot { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; z-index: 3; color: var(--ink); }
  /* 品种格 = 小盘：米白纸底 + 橙色圆边 + 白色描边分隔 + 轻颗粒做旧 */
  .farm-cell {
    position: relative; border: 2px solid var(--orange); border-radius: 12px;
    background: var(--paper); background-image: var(--grain);
    box-shadow: inset 0 0 0 2px var(--white);
    padding: 9px 6px 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;
  }
  .farm-cellimg { position: relative; width: 46px; height: 46px; }
  .farm-cellimg svg { width: 46px; height: 46px; }
  .farm-cellimg .farm-chick-rig { width: 46px; height: 55px; }
  /* 盘上那一笔手绘色块（在鸡底下，是底不是罩子） */
  .farm-cellimg::before {
    content: ""; position: absolute; left: -9px; top: -8px; width: 64px; height: 60px;
    background: var(--tone, var(--yellow)); opacity: 0.18;
    border-radius: 48% 52% 46% 54% / 52% 46% 54% 48%;
    transform: rotate(-7deg);
    z-index: 0;
  }
  /* 小鸡压在色块上面 */
  .farm-cellimg > svg, .farm-cellimg > .farm-chick-rig { position: relative; z-index: 1; }
  /* 未发现的剪影 = 橙色单色（陶瓷盘中心那枚）。单色化在 SVG 里用 feColorMatrix 做，见 chickSilhouette */
  .farm-sil { opacity: 1; }
  /* 格子里的名字也贴一条小胶带 */
  .farm-cellname {
    font-size: 12px; font-weight: 700; color: var(--ink);
    background: color-mix(in srgb, var(--yellow) 45%, transparent);
    padding: 1px 8px; transform: rotate(-1.5deg);
    clip-path: polygon(3% 0, 97% 6%, 100% 55%, 96% 100%, 2% 94%, 0 45%);
  }
  .farm-cellct { font-size: 11px; color: color-mix(in srgb, var(--ink) 70%, transparent); }
  .farm-rar { font-size: 10px; border: 1px solid var(--ink); border-radius: 6px; padding: 0 5px; background: var(--card); }
  .farm-rar-l { background: var(--orange); color: var(--white); border-color: var(--orange); }
  .farm-cardfoot { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
  .farm-tip { font-size: 11px; color: color-mix(in srgb, var(--ink) 62%, transparent); }
  .farm-maprows { display: flex; flex-direction: column; border: 2px solid var(--ink); border-radius: 8px; overflow: hidden; }
  .farm-maprow { display: flex; justify-content: space-between; gap: 8px; padding: 7px 12px; font-size: 13px; border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent); }
  .farm-maprow:first-child { border-top: 0; }
  .farm-maprow b { font-variant-numeric: tabular-nums; }
  .farm-maprow.is-here span::after { content: "（本页）"; color: var(--orange); font-size: 11px; }
  a.farm-maprow { color: inherit; text-decoration: none; cursor: pointer; }
  a.farm-maprow:hover { background: var(--orange); color: var(--white); }
  /* 鸡场地图（真的那张）：一块地 = 一个地方 = 一个站页面。
     画法照 art-style.md：扁平色块、墨色轮廓、色块间白色描边、禁渐变禁阴影。 */
  .farm-mapart { display: flex; flex-direction: column; align-items: center; gap: 8px; margin: 0 0 12px; }
  /* 视口：地图装在里面，可以放大平移（手机端看得清）
     touch-action: none —— 让双指捏合归我们管（浏览器别把捏合当成整页缩放） */
  .farm-mapart .mp-view { position: relative; width: 100%; max-width: 400px; overflow: hidden; border-radius: 6px; touch-action: none; cursor: grab; }
  .farm-mapart .mp-view.is-drag { cursor: grabbing; }
  .farm-mapart svg { width: 100%; max-width: 400px; height: auto; display: block; font-family: inherit; transform-origin: 0 0; }
  .farm-mapart .mp-name { font-size: 12px; font-weight: 700; fill: var(--ink); text-anchor: middle; }
  .farm-mapart .mp-num { font-size: 10px; font-weight: 700; fill: var(--ink); text-anchor: middle; }
  .farm-mapart .mp-n { font-size: 9px; font-weight: 700; fill: var(--ink); text-anchor: middle; }
  .farm-mapart .mp-ch { font-size: 7px; font-weight: 700; fill: var(--ink); text-anchor: middle; }
  .farm-mapart a.mp-plot { cursor: pointer; }
  .farm-mapart g.mp-plot.is-off { cursor: not-allowed; }
  /* 悬停地块：草地描边变橙、手绘虚线圈变实线（没通路的灰地不响应） */
  .farm-mapart .mp-ground { transition: stroke .12s ease, stroke-width .12s ease; }
  .farm-mapart a.mp-plot:hover .mp-ground,
  .farm-mapart a.mp-plot:focus-visible .mp-ground { stroke: var(--orange); stroke-width: 3; }
  .farm-mapart a.mp-plot:hover .mp-ring,
  .farm-mapart a.mp-plot:focus-visible .mp-ring { stroke: var(--orange); stroke-width: 2.6; stroke-dasharray: none; }
  .farm-mapart a.mp-plot:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
  .farm-mapart a.mp-cover { cursor: pointer; }
  .farm-mapart a.mp-cover:hover rect,
  .farm-mapart a.mp-cover:focus-visible rect { stroke: var(--orange); stroke-width: 2; }
  /* 一行小提示：缩放全靠手势，不摆按钮 */
  .farm-mapart .mp-hint { margin: 0; font-size: 11px; color: var(--gray); text-align: center; }
  /* 整理台的动作行（散场 / 召回）：按钮要抹平浏览器默认样式。
     底色跟统计行区分开 —— 不然玩家以为那也是一行数字，不会去点。 */
  button.farm-maprow {
    font: inherit; text-align: left; width: 100%; cursor: pointer;
    background: color-mix(in srgb, var(--yellow) 26%, var(--card)); color: var(--ink);
    border: 0; font-weight: 700;
    border-top: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  }
  button.farm-maprow:hover { background: var(--orange); color: var(--white); }
  button.farm-maprow:focus-visible { outline: 2px solid var(--blue); outline-offset: -2px; }

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
        <span class="farm-stat farm-vitals" title="心情 · 饱腹 · 清洁：陪它说话 / 摆食盆 / 添水">
          心情 <b id="farm-n-mood">0</b> · 饱 <b id="farm-n-full">0</b> · 洁 <b id="farm-n-clean">0</b>
        </span>
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
        <button type="button" class="farm-prop" data-prop="plate" aria-label="瓷盘" title="瓷盘" aria-pressed="false"><span class="farm-ico plate" aria-hidden="true"></span><em>瓷盘</em></button>
        <button type="button" class="farm-prop" data-prop="basket" aria-label="竹篮" title="竹篮" aria-pressed="false"><span class="farm-ico basket" aria-hidden="true"></span><em>竹篮</em></button>
        <button type="button" class="farm-prop" data-prop="incubator" aria-label="孵化窝" title="孵化窝（逛站解锁）" aria-pressed="false" data-locked="1"><span class="farm-ico incubator" aria-hidden="true"></span><em>孵化窝</em></button>
        <button type="button" class="farm-prop" data-prop="water" aria-label="水缸" title="水缸（逛站解锁）" aria-pressed="false" data-locked="1"><span class="farm-ico water" aria-hidden="true"></span><em>水缸</em></button>
        <button type="button" class="farm-prop farm-prop-tool" data-prop="pickup" aria-label="收走" title="收走：点一下场上的器物，把它收回货架（篮子里的蛋、盘子里的米都留着）" aria-pressed="false"><span class="farm-ico pickup" aria-hidden="true"></span><em>收</em></button>
      </div>
    </div>

    <p class="farm-hint" id="farm-hint">点空白处下蛋 · 点小鸡听它说话</p>

    <div class="farm-wrap farm-ui" id="farm-book" hidden>
      <div class="farm-scrim" id="farm-book-scrim"></div>
      <div class="farm-card" role="dialog" aria-label="鸡场手册">
        <div class="farm-cardhead"><b class="farm-tape">鸡场手册 · 图鉴</b><button type="button" class="farm-btn" id="farm-book-x" aria-label="关闭">×</button></div>
        <div class="farm-grid" id="farm-bookgrid"></div>
        <div class="farm-cardfoot">
          <span class="farm-tip">点击页面空白处下蛋，孵出的小鸡自动入册；概率写在方案里，不玩暗改那套。</span>
          <button type="button" class="farm-btn" id="farm-btn-dexcard" hidden>图鉴卡</button>
          <button type="button" class="farm-btn" id="farm-btn-card">成就卡</button>
          <button type="button" class="farm-btn" id="farm-btn-reset">重开鸡场</button>
        </div>
      </div>
    </div>

    <div class="farm-wrap farm-ui" id="farm-map" hidden>
      <div class="farm-scrim" id="farm-map-scrim"></div>
      <div class="farm-card" role="dialog" aria-label="鸡场地图">
        <div class="farm-cardhead"><b class="farm-tape" id="farm-map-title">鸡场地图 · 一页一圈舍</b><button type="button" class="farm-btn" id="farm-map-x" aria-label="关闭">×</button></div>
        <div class="farm-mapart" id="farm-mapart"></div>
        <div class="farm-maprows" id="farm-maprows"></div>
        <p class="farm-tip" id="farm-map-tip">鸡在哪，账就在哪。放去别的页的鸡，逛完自己回来，还带礼物。</p>
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
  if (window.__coopInit) return window.__coop; // 幂等：引擎已经起好了，直接给句柄
  const pack = cfg.pack || DEFAULT_PACK;
  /* ===== 事件：鸡会跑来报信（2026-11-04）=====
     机制在引擎，**内容由站侧推来**（window 的 farm:content 事件，detail.items）。
     为什么不让引擎自己抄官网内容：官网的作品/动态是活的，抄一份就会过期。
     所以引擎只管「什么时候报、报什么样式、给什么奖励、去重」，
     官网只管「有什么内容可报」——两边都不存第二份。
     pack.events 段放机制参数 + 一批「鸡场日常」事件（不依赖官网内容，当保底）。 */
  const EVENT_CFG = (pack.events && typeof pack.events === 'object') ? pack.events : {};

  /* ===== 出门逛（2026-11-05）=====
     鸡**自己**决定去别的页面逛一圈 —— 不是玩家手动放，也不是管家派。
     走的是跟「放去别的页」同一条路（领差事 → 办完带礼物回来 → 自己回来），
     差别只在于「谁决定的」。
     参数在 pack.json 的 `wander` 段（唯一出处，引擎不存第二份）。 */
  const WANDER_CFG = (pack.wander && typeof pack.wander === 'object') ? pack.wander : {};

  /* ===== 鸡场地图（2026-11-05）=====
     地图的形状、地名、地标、路、河、桥全在 pack.json 的 `map` 段（唯一出处）——
     引擎只画不编，改图只改 pack.json 再跑 scripts/make-map-pack.mjs。
     站侧只给路由 id（pages），地图按 id 认地方；认不到的地方照样画出来，
     但灰掉、点不动（规矩：条件不满足的入口灰掉但仍可见）。
     老包没有 map 段 → 地图面板自动退回原来的列表视图，不炸。 */
  const MAP_CFG = (pack.map && typeof pack.map === 'object') ? pack.map : null;

  /* ===== 成长阶段（2026-11-04，方案见 research/growth-mechanics.md）=====
     阶段链写在 pack.json 的 `stages` 段：**改成长节奏 / 改体型不用改引擎代码**
     （和「行为表数据化」一个思路 —— 数据是唯一出处）。
     规矩：阶段只前进不后退（数码蛋的铁律）；离线也在长；**不惩罚不上线的人**
     （不回退、不生病、不死）；互动能加速（VPet 的「经验来自主动互动」）。 */
  const STAGE_LIST = (pack.stages && pack.stages.list) || {};
  const STAGE_ORDER = (pack.stages && Array.isArray(pack.stages.order) && pack.stages.order.length)
    ? pack.stages.order.filter((k) => STAGE_LIST[k]) : [];
  const STAGE_BOOST = (pack.stages && pack.stages.boost) || {};
  const STAGE_LAST = STAGE_ORDER.length ? STAGE_ORDER[STAGE_ORDER.length - 1] : '';
  /* 舞台上鸡的缩放：手机上跟原来的 43/48 一起缩，别让大鸡把手机屏幕挤满 */
  const stageScale = () => (window.innerWidth <= 768 ? 43 / 48 : 1);
  const pages = cfg.pages && cfg.pages.length ? cfg.pages : [{ id: 'home', label: '首页', href: '/' }];
  const brand = cfg.brand || '鸡场';
  const page = cfg.page || document.body.dataset.page || 'home';
  const VER = window.__coopVer || 'v0200'; // 版本参数：缓存失效统一走这里（chat 动态导入在引擎块外也要用它）

  /* 句柄先给出去：里面全是转发到 window.__coopSnapshot 之类，
     引擎块跑起来后才有真值 —— 这样「DOM 还没就绪」时也能安全返回一个能用的句柄。 */
  window.__coop = {
    open: () => window.dispatchEvent(new Event('farm:open')),
    toggle: () => window.dispatchEvent(new Event('farm:toggle')),
    pages,   // 站点页面表（管家 goto 选项与 system 注入用）
    pack,    // 资产包（dialogue 可在包里覆盖默认剧本树）
    snapshot: () => (window.__coopSnapshot ? window.__coopSnapshot() : null), // 实时账本快照
    behaviors: () => (window.__coopBehaviors ? window.__coopBehaviors() : null), // 行为表 + 分布（验收/调试用）
    events: () => (window.__coopEvents ? window.__coopEvents() : null),         // 快讯台账（验收/调试用）
    fireEvent: (opts) => (window.__coopFireEvent ? window.__coopFireEvent(opts) : null), // 手动报一条快讯
  };

  /* DOM 还没就绪 → **不占幂等名额**，等 DOMContentLoaded 自己再来一次。
     以前是先置 window.__coopInit 再往下走：DOM 没就绪时整块引擎被跳过，
     之后谁再调 init() 都只拿得到一个空壳（没 snapshot / 没 behaviors），
     鸡场就永远起不来 —— 而且控制台一句错都不报，最难查的那种。 */
  const retryWhenReady = () => {
    if (document.readyState !== 'loading') return;
    document.addEventListener('DOMContentLoaded', () => {
      try { init(cfg); } catch (e) { /* 还是起不来就算了 */ }
    }, { once: true });
  };
  if (!document.body) {
    retryWhenReady();
    return window.__coop;
  }

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
  if (!root || !stage) {
    /* 容器没成 → 也不占名额，等 DOM 好了再来一次 */
    retryWhenReady();
    return window.__coop;
  }
  /* 上一次引擎块中途抛异常就死了：flag 留下来了、引擎其实没起来。
     这种「假活着」最坑 —— 下一次 init() 看到 flag 就在、跳过引擎块，
     然后把 window.__coopInit 置成 true，于是「引擎死了」被固化成「引擎好了」。
     判据用 __coopSnapshot（引擎块跑到最后才落的根）：它不在 = 引擎没起来。
     注意这里**不**去清 flag 让它重跑：上一次跑了一半的引擎可能还留着定时器，
     重跑会起两个引擎（双份心跳）。这种情况刷新页面就好 —— flag 挂在 DOM 上，刷新即重来。 */
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
    /* 品种符号颜色统一收进画风变量（♪ 音符用），别在行内 style 里写死 hex。
       粉与灰是 2026-11-04 补的 token（art-style.md §2）——
       之前粉·桃鸡降级成橙、灰·贵族降级成墨，音符撞了色。 */
    const BREED_TONE = {
      universe01: 'var(--yellow)', butter: 'var(--yellow)', ingot: 'var(--yellow)',
      mist: 'var(--blue)', bean: 'var(--green)', persimmon: 'var(--orange)',
      peach: 'var(--pink)', noble: 'var(--gray)', fu: 'var(--red)',
    };
    const toneOf = (b) => (b && BREED_TONE[b.id]) || 'var(--orange)';
    /* 蛋壳色 = 品种色派生（2026-11-04）
       蛋一落地就定了品种，所以蛋壳可以带这个品种的颜色 ——
       「蛋 = 还没孵出来的那个品种」，图鉴的闭环从下蛋那一刻就开始了。
       品种真色的唯一出处是 pack.json 的 breed.color（丽丽的 manifest 色值）；
       这里只把它推平成「蛋壳色」：一块纯色（不叠色、不渐变），拿掉大部分饱和度，
       亮度收到 70% 上下 —— 蛋壳不该是饱和的红或绿的。
       推平规则写在 research/art-style.md，别在别处再推一遍。 */
    function hexToHsl(hex) {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
      if (!m) return [45, 90, 60];
      const n = parseInt(m[1], 16);
      const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      let h = 0;
      if (d) {
        if (mx === r) h = 60 * (((g - b) / d) % 6);
        else if (mx === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
        if (h < 0) h += 360;
      }
      const l = (mx + mn) / 2;
      const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
      return [h, s * 100, l * 100];
    }
    function shellColor(breed) {
      const [h, s, l] = hexToHsl(breed && breed.color);
      const ss = Math.round(s * 0.55);
      const ll = Math.round((78 - (78 - l) * 0.45) * 10) / 10;
      return `hsl(${Math.round(h)}, ${ss}%, ${ll}%)`;
    }
    const WEIGHTS = pack.weights || { common: 16, rare: 18, legendary: 2 };
    const PAGES = pages.map((p) => p.id); // 地图即索引：一页一圈舍，圈舍行是普通链接
    const PAGE_NAMES = Object.fromEntries(pages.map((p) => [p.id, p.label]));
    const PAGE_HREF = Object.fromEntries(pages.map((p) => [p.id, p.href]));

    /* ===== 状态多维（2026-11-04，抄 VPet 的多维状态）=====
       我们原来只有一个 mood，四件器物共用这一个数 → 「摆出来的东西有什么用」
       在数值上是模糊的，只能靠 PROPS[].tip 的一句话撑着。
       拆成三轴之后，每件器物的作用**在数值上直接可读**：
         心情 mood   ← 跟它说话（poke）
         饱腹 full   ← 吃米（食盆 / 地上的谷子）
         清洁 clean  ← 喝水（水缸）
       三条纪律（抄 VPet 但不抄它的坏处）：
         ① 不惩罚不上线的人：三轴掉到 0 也不会死、不会跑，蔫着而已；
         ② 老档平迁：老账本没有新字段 → 补到「中等值」，不补成 0（不突然蔫）；
         ③ 只掉不涨的只有时间，互动立刻回 —— 数值实时可见（规矩 3）。
       键名沿用 mood/moodAt，另加 full/fullAt、clean/cleanAt。
       ⚠ 这三个常量**必须声明在存储段之前** —— 下面的老档迁移要用它们，
         而 const 有暂时性死区：放在后面会抛
         "Cannot access 'FULL_START' before initialization"，
         **老档用户的鸡场会整个起不来**（2026-11-04 真的踩到过）。 */
    const FULL_MAX = 100;
    const FULL_START = 70;     // 老档平迁的落点：中等偏上
    const FULL_DECAY_H = 16;   // 饿得快 → 逼玩家去摆食盆
    const FULL_EAT = 26;       // 吃一口米回多少（比心情多：这是吃饭的主要收益）
    const CLEAN_MAX = 100;
    const CLEAN_START = 75;
    const CLEAN_DECAY_H = 9;   // 脏得慢 → 别让人天天来擦
    const CLEAN_WATER = 30;    // 喝一次水（点水缸）回多少
    const CLEAN_LOW = 25;      // 低于这个算"脏"（看得见）

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

    let state = {
      v: 1, seq: 0, eggs: 0, hatched: 0, pity: 0, dex: {}, chickens: [], decos: [],
      visits: { total: 0, work: 0, news: 0 }, // 逛站计数（看作品/看动态）
      pending: [],                          // 鸡场没开时攒下的奖励，开场兑现
      unlocked: ['rice', 'piano', 'plate', 'basket'], // 已解锁道具（水缸要逛站解锁）
    };
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
    /* 布景道具（decos）：老档没有这字段，补上空数组，不迁版本号 */
    if (!Array.isArray(state.decos)) state.decos = [];
    /* 收进货架的器物（stash）：收走时存这儿，再摆出来时存量（篮子里的蛋）跟着回来 */
    if (!Array.isArray(state.stash)) state.stash = [];
    /* 出门逛的记账：上次是哪只鸡自己跑出去的（老档没有这字段，补默认值） */
    if (!state.wander || typeof state.wander !== 'object') state.wander = { lastAt: 0 };
    /* 逛站计数 / 待兑现奖励 / 解锁表：老档没有，补默认值，不迁版本号 */
    if (!state.visits || typeof state.visits !== 'object') state.visits = { total: 0, work: 0, news: 0 };
    for (const k of ['total', 'work', 'news']) if (typeof state.visits[k] !== 'number') state.visits[k] = 0;
    if (!Array.isArray(state.pending)) state.pending = [];
    /* 鸡场快讯记账（2026-11-04）：每条消息最近一次播报的时间 + 今天已报几条。
       老档没有这字段，补默认值，不迁版本号。 */
    if (!state.events || typeof state.events !== 'object') state.events = { fired: {}, count: 0, day: '', dayCount: 0, last: '' };
    if (!state.events.fired || typeof state.events.fired !== 'object') state.events.fired = {};
    if (typeof state.events.count !== 'number') state.events.count = 0;
    if (typeof state.events.dayCount !== 'number') state.events.dayCount = 0;
    if (typeof state.events.day !== 'string') state.events.day = '';
    if (!Array.isArray(state.unlocked) || !state.unlocked.length) state.unlocked = ['rice', 'piano', 'plate', 'basket'];
    if (!state.dex || typeof state.dex !== 'object') state.dex = {};
    /* 成长阶段迁移（2026-11-04）：老档的鸡没有 stage 字段 → 当成成鸡。
       理由：老账本里没有可信的「出生时间」（lastSeen 是「最后一次被看到」），硬折算会让
       老用户的鸡**突然变大** —— 那是没必要的惊吓。**新孵的蛋**才走完整成长线。
       这里把字段补上，账本才自洽（不然每次 load 都要现推一遍）。 */
    if (!Array.isArray(state.chickens)) state.chickens = [];
    if (STAGE_ORDER.length) {
      for (const r of state.chickens) {
        if (!r || typeof r !== 'object') continue;
        if (STAGE_ORDER.indexOf(r.stage) < 0) { r.stage = STAGE_LAST; r.stageAt = Date.now(); r.growth = 0; }
        else if (typeof r.stageAt !== 'number') r.stageAt = Date.now();
        if (typeof r.growth !== 'number') r.growth = 0;
      }
    }
    /* 状态多维迁移（2026-11-04）：老档的鸡没有饱腹/清洁 → 补成「中等值」，**不补成 0**。
       理由跟成长阶段一样：老账本里没有可信的「上次喂食/喝水」时间，
       补成 0 等于说「你的鸡一直饿着一直脏着」—— 那是没必要的惊吓。
       时间戳补成 now：老鸡**不会**因为这次升级突然掉一大截。 */
    for (const r of state.chickens) {
      if (!r || typeof r !== 'object') continue;
      if (typeof r.full !== 'number') { r.full = FULL_START; r.fullAt = Date.now(); }
      else if (typeof r.fullAt !== 'number') r.fullAt = Date.now();
      if (typeof r.clean !== 'number') { r.clean = CLEAN_START; r.cleanAt = Date.now(); }
      else if (typeof r.cleanAt !== 'number') r.cleanAt = Date.now();
    }

    /* ===== 跨标签页同步（2026-11-03） =====
       一个账本被两个标签页同时打开时，最怕「后写的把先写的盖掉」。
       这里不引 CRDT 库，用三件事解决：
       1) 会累加的数字记成「每个标签页各自一份小计」（state.tally）。
          合并时按来源取大数（同一来源的小计只增不减），总数 = 各来源之和。
          两个标签页同时下蛋，谁也吃不掉谁的蛋。
       2) 每次落盘广播一句「账变了」，别的标签页收到后重读、合并、重渲染。
       3) 落盘先打标记、250ms 合并写；页面藏起来或关掉时强制落盘。 */
    const ORIGIN = 't' + Array.from({ length: 8 }, () => 'abcdefghijkmnpqrstuvwxyz'[(Math.random() * 24) | 0]).join('');
    const CHANNEL = 'coop-farm';

    /* 小计：每个标签页只加自己那一份，合并时按来源取大数 */
    function tallySum(map) {
      let s = 0;
      if (map) for (const k in map) s += (map[k] | 0);
      return s;
    }
    function tallyAdd(map, n) {
      map[ORIGIN] = (map[ORIGIN] | 0) + n;
      return tallySum(map);
    }
    function tallyMerge(dst, src) {
      if (!src) return dst;
      for (const k in src) dst[k] = Math.max(dst[k] | 0, src[k] | 0);
      return dst;
    }
    function emptyTally() {
      return { eggs: {}, hatched: {}, seq: {}, visits: { total: {}, work: {}, news: {} }, dex: {} };
    }
    /* 空白账（重开鸡场用） */
    function blankState() {
      return {
        v: 1, seq: 0, eggs: 0, hatched: 0, pity: 0, dex: {}, chickens: [], decos: [], stash: [],
        names: {},   // 鸡名（id → 名）：重开鸡场要连它一起清掉（seq 归零后 id 会复用）
        visits: { total: 0, work: 0, news: 0 }, pending: [], unlocked: ['rice', 'piano', 'plate', 'basket'],
        events: { fired: {}, count: 0, day: '', dayCount: 0, last: '' },
        tally: emptyTally(),
      };
    }
    /* 老档没有小计表：把现有数字记成 legacy 一份，迁移后总数不变 */
    function migrateTally() {
      const t = (state.tally && typeof state.tally === 'object') ? state.tally : emptyTally();
      for (const k of ['eggs', 'hatched', 'seq']) if (!t[k] || typeof t[k] !== 'object') t[k] = {};
      if (!t.visits || typeof t.visits !== 'object') t.visits = {};
      for (const k of ['total', 'work', 'news']) if (!t.visits[k] || typeof t.visits[k] !== 'object') t.visits[k] = {};
      if (!t.dex || typeof t.dex !== 'object') t.dex = {};
      state.tally = t;
      if (!tallySum(t.eggs) && state.eggs) t.eggs.legacy = state.eggs | 0;
      if (!tallySum(t.hatched) && state.hatched) t.hatched.legacy = state.hatched | 0;
      if (!tallySum(t.seq) && state.seq) t.seq.legacy = state.seq | 0;
      for (const k of ['total', 'work', 'news']) if (!tallySum(t.visits[k]) && state.visits[k]) t.visits[k].legacy = state.visits[k] | 0;
      for (const b in state.dex) {
        if (!t.dex[b] || typeof t.dex[b] !== 'object') t.dex[b] = {};
        if (!tallySum(t.dex[b]) && state.dex[b]) t.dex[b].legacy = state.dex[b] | 0;
      }
      syncDerived();
    }
    /* 小计 → 账面绝对值：别的代码读 state.eggs / state.dex 时不会看到半截数 */
    function syncDerived() {
      state.eggs = tallySum(state.tally.eggs);
      state.hatched = tallySum(state.tally.hatched);
      state.seq = tallySum(state.tally.seq);
      for (const k of ['total', 'work', 'news']) state.visits[k] = tallySum(state.tally.visits[k]);
      for (const b in state.tally.dex) state.dex[b] = tallySum(state.tally.dex[b]);
    }
    /* 记录的时间戳：谁更新得晚听谁的（心情写在 moodAt 里，比 lastSeen 还细）
       注意：Date.now() 是 13 位，**不能 | 0**（会截成 32 位变负数，顺序就乱了）
       stageAt 也要算进去 —— 成长阶段写在它里面，跨标签页合并时别被旧记录盖回去。
       fullAt / cleanAt 同理：状态多维的饱腹/清洁也写在各自的时间戳里。
       stowedAt 同理：散场/召回写在它里面，跨标签页合并时别被旧记录盖回去。 */
    function recTs(r) {
      return Math.max(
        Number(r.lastSeen) || 0, Number(r.moodAt) || 0, Number(r.at) || 0,
        Number(r.stageAt) || 0, Number(r.fullAt) || 0, Number(r.cleanAt) || 0,
        Number(r.stowedAt) || 0
      );
    }
    function cmpId(x, y) {
      const a = String(x), b = String(y);
      const na = /(\d+)(?!.*\d)/.exec(a), nb = /(\d+)(?!.*\d)/.exec(b);
      if (na && nb) { const d = (+na[1]) - (+nb[1]); if (d) return d; }
      return a < b ? -1 : a > b ? 1 : 0;
    }
    /* 按 id 取并集：同一只就地覆盖（保住 flock 里 c.rec 的引用），结果按 id 排好 → 合并方向不影响结果 */
    function mergeById(a, b) {
      if (!Array.isArray(a) || !Array.isArray(b)) return;
      const map = new Map();
      for (const it of a) if (it && it.id != null) map.set(it.id, it);
      for (const it of b) {
        if (!it || it.id == null) continue;
        const cur = map.get(it.id);
        if (!cur) { map.set(it.id, it); continue; }
        const t1 = recTs(cur), t2 = recTs(it);
        if (t2 > t1 || (t2 === t1 && JSON.stringify(it) > JSON.stringify(cur))) {
          for (const k in it) cur[k] = it[k];
        }
      }
      const out = [...map.values()].sort((x, y) => cmpId(x.id, y.id));
      a.length = 0;
      for (const it of out) a.push(it);
    }
    function unionKey(it) {
      return (it && typeof it === 'object') ? JSON.stringify(it, Object.keys(it).sort()) : String(it);
    }
    function unionArr(a, b) {
      const out = [], seen = new Set();
      for (const it of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
        const k = unionKey(it);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(it);
      }
      return out.sort((x, y) => (unionKey(x) < unionKey(y) ? -1 : unionKey(x) > unionKey(y) ? 1 : 0));
    }
    /* 稳定的 JSON（键排序）：比较两份账是否一样，键序不同也算一样 */
    function stableStr(v) {
      if (v === undefined) return 'undefined';
      if (v === null || typeof v !== 'object') return JSON.stringify(v);
      if (Array.isArray(v)) return '[' + v.map(stableStr).join(',') + ']';
      return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableStr(v[k])).join(',') + '}';
    }
    /* 两份账合并：可交换 + 可幂等 → 广播不会来回弹 */
    function mergeState(a, b) {
      if (!b || typeof b !== 'object') return a;
      /* 「重开鸡场」是全局动作：谁重开得晚谁说了算，旧账整份作废（不然会把清掉的蛋合回来） */
      const ra = Number(a.resetAt) || 0, rb = Number(b.resetAt) || 0;
      if (rb > ra) return adoptState(a, b);
      if (ra > rb) return a;
      syncDerived();
      const T = (a.tally && typeof a.tally === 'object') ? a.tally : (a.tally = emptyTally());
      const BT = (b.tally && typeof b.tally === 'object') ? b.tally : {};
      for (const k of ['eggs', 'hatched', 'seq']) tallyMerge(T[k], BT[k]);
      if (!T.visits || typeof T.visits !== 'object') T.visits = {};
      const BV = BT.visits || {};
      for (const k of ['total', 'work', 'news']) {
        if (!T.visits[k] || typeof T.visits[k] !== 'object') T.visits[k] = {};
        tallyMerge(T.visits[k], BV[k]);
      }
      if (!T.dex || typeof T.dex !== 'object') T.dex = {};
      const BD = BT.dex || {};
      for (const bk in BD) {
        if (!T.dex[bk] || typeof T.dex[bk] !== 'object') T.dex[bk] = {};
        tallyMerge(T.dex[bk], BD[bk]);
      }
      /* 保底计数：破壳多的那份说了算（传说出壳会把保底清零） */
      const ha = a.hatched | 0, hb = b.hatched | 0;
      a.pity = ha > hb ? (a.pity | 0) : hb > ha ? (b.pity | 0) : Math.max(a.pity | 0, b.pity | 0);
      /* 「重开鸡场」的时间戳：谁新听谁的 */
      a.resetAt = Math.max(Number(a.resetAt) || 0, Number(b.resetAt) || 0);
      /* 名单类按 id 取并集 */
      mergeById(a.chickens, b.chickens);
      mergeById(a.decos, b.decos);
      /* 收走的器物：同一件不能在「场上」和「货架」两处同时存在 —— 以更新时间新的那边为准 */
      if (!Array.isArray(a.stash)) a.stash = [];
      mergeById(a.stash, b.stash);
      if (Array.isArray(a.decos) && Array.isArray(a.stash)) {
        for (const s of a.stash) {
          const i = a.decos.findIndex((v) => v.id === s.id);
          if (i >= 0 && recTs(s) >= recTs(a.decos[i])) a.decos.splice(i, 1);
        }
        for (const d of a.decos) {
          const j = a.stash.findIndex((v) => v.id === d.id);
          if (j >= 0 && recTs(d) > recTs(a.stash[j])) a.stash.splice(j, 1);
        }
      }
      a.unlocked = unionArr(a.unlocked, b.unlocked);
      a.pending = unionArr(a.pending, b.pending);
      /* 名字：别的标签页起的名也要认；**同名时谁新听谁的**（名字带时间戳）。
         以前是「本地优先」—— 两个标签页各改各的会来回顶：玩家刚起的名
         被另一个标签页的一次心跳冲掉，刷新就变回旧名（真丢数据）。 */
      const BN = (b.names && typeof b.names === 'object') ? b.names : {};
      if (!a.names || typeof a.names !== 'object') a.names = {};
      for (const k in BN) {
        if (!(k in a.names)) { a.names[k] = BN[k]; continue; }      // 本地没有 → 直接收下
        if (nameTs(BN[k]) > nameTs(a.names[k])) a.names[k] = BN[k];   // 对方更新 → 听对方的
      }
      /* 快讯记账：同一条消息取「最近一次播报时间」（谁晚听谁的），累计条数取大数 */
      if (!a.events || typeof a.events !== 'object') a.events = { fired: {}, count: 0 };
      const BE = (b.events && typeof b.events === 'object') ? b.events : null;
      if (BE) {
        const AF = a.events.fired || (a.events.fired = {});
        const BF = BE.fired || {};
        for (const k in BF) AF[k] = Math.max(Number(AF[k]) || 0, Number(BF[k]) || 0);
        a.events.count = Math.max(Number(a.events.count) || 0, Number(BE.count) || 0);
      }
      syncDerived();
      return a;
    }
    /* 整份接过来（就地覆盖，尽量保住已有对象引用） */
    function adoptState(a, b) {
      a.eggs = b.eggs | 0;
      a.hatched = b.hatched | 0;
      a.pity = b.pity | 0;
      a.seq = b.seq | 0;
      a.dex = { ...(b.dex || {}) };
      a.visits = { ...(b.visits || {}) };
      a.tally = JSON.parse(JSON.stringify(b.tally || emptyTally()));
      if (!Array.isArray(a.chickens)) a.chickens = [];
      if (!Array.isArray(a.decos)) a.decos = [];
      if (!Array.isArray(a.stash)) a.stash = [];
      a.chickens.length = 0;
      for (const it of (b.chickens || [])) a.chickens.push(it);
      a.decos.length = 0;
      for (const it of (b.decos || [])) a.decos.push(it);
      a.stash.length = 0;
      for (const it of (b.stash || [])) a.stash.push(it);
      a.unlocked = [...(b.unlocked || [])];
      a.pending = [...(b.pending || [])];
      /* 名字也跟着整份接过来：重开鸡场后 seq 归零，新鸡会复用旧 id ——
         不把 names 一起清掉，新鸡一出生就顶着上一只的名字（以前漏了这一项）。 */
      a.names = { ...(b.names || {}) };
      a.events = JSON.parse(JSON.stringify(b.events || { fired: {}, count: 0, day: '', dayCount: 0, last: '' }));
      a.resetAt = Number(b.resetAt) || 0;
      syncDerived();
      return a;
    }
    migrateTally();

    /* 落盘：合并写（250ms 内多次改动只写一次）；页面藏起来/关掉时强制写 */
    let saveTimer = 0, dirty = false, lastWritten = '';
    function readDisk() {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '');
        if (raw && typeof raw === 'object' && raw.v === 1) return raw;
      } catch { /* 空档 / 隐私模式 */ }
      return null;
    }
    function writeNow(notify, force) {
      if (saveTimer) { window.clearTimeout(saveTimer); saveTimer = 0; }
      if (!dirty) return;
      dirty = false;
      try {
        const disk = force ? null : readDisk();
        if (disk) mergeState(state, disk); // 先把别的标签页写进磁盘的合进来，别拿旧内存盖新账
        const str = JSON.stringify(state);
        if (!disk || stableStr(disk) !== stableStr(state)) {
          localStorage.setItem(KEY, str);
          lastWritten = str;
        }
      } catch { /* 隐私模式退化为内存态 */ }
      if (notify) broadcast();
    }
    function save() {
      dirty = true;
      if (saveTimer) return;
      saveTimer = window.setTimeout(() => writeNow(true), 250);
    }
    function flushSave(force) { dirty = true; writeNow(true, force); }

    let chan = null;
    try { chan = new BroadcastChannel(CHANNEL); } catch { chan = null; }
    function broadcast() {
      if (!chan) return;
      try { chan.postMessage({ type: 'state', origin: ORIGIN, state }); } catch { /* 忽略 */ }
    }
    /* 别的标签页说「账变了」：合进来，重渲染 */
    function applyRemote(remote) {
      if (!remote || typeof remote !== 'object') return;
      const before = stableStr(state);
      const wasAt = Number(state.resetAt) || 0;
      mergeState(state, remote);
      if ((Number(state.resetAt) || 0) > wasAt) {
        /* 别的标签页重开了鸡场：本地这窝鸡也一起收掉（不然还在孵的蛋会又冒出来一只） */
        for (const c of flock) kill(c);
        flock = [];
        eggTimers.forEach(window.clearTimeout);
        eggTimers = [];
        layer.replaceChildren();
      }
      dirty = true;
      writeNow(false);                              // 合并结果立刻落盘，但不再广播（避免来回弹）
      if (stableStr(state) !== before) broadcast(); // 我们这边还有对方没有的 → 也告诉对方
      refreshHUD();
      emitState();
    }
    if (chan) {
      chan.onmessage = (ev) => {
        const m = ev.data;
        if (!m || m.type !== 'state' || !m.origin || m.origin === ORIGIN) return;
        applyRemote(m.state);
      };
    } else {
      /* 老浏览器没有 BroadcastChannel：退回 storage 事件（同源其他标签页写账时会通知） */
      window.addEventListener('storage', (e) => {
        if (e.key !== KEY || !e.newValue || e.newValue === lastWritten) return;
        try { applyRemote(JSON.parse(e.newValue)); } catch { /* 空档 */ }
      });
    }

    /* 总线快照：给对话层做「报告鸡场」插值，也随 /api/chat payload 上送（见 chat.ts.farm-patch.md） */
    function snapshot() {
      const breeds = {};
      const pagesMap = {};
      let here = 0, stowed = 0;
      for (const c of state.chickens) {
        breeds[c.breed] = (breeds[c.breed] || 0) + 1;
        if (c.stowed) { stowed += 1; continue; }   // 窝里的（散场收起来的）不算在任何一页
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
        elsewhere: state.chickens.length - here - stowed,
        stowed,                   // 窝里待命的只数
        dex_left: BREEDS.length - found,
        events: {                // 鸡场快讯：报过几条、今天几条、最后一条是什么
          count: state.events.count | 0,
          dayCount: state.events.dayCount | 0,
          last: state.events.last || '',
        },
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
      else if (type === 'stow') stowAll();          // 散场：鸡回窝里（记录全留）
      else if (type === 'unstow') unstowAll();      // 召回：窝里的放回场上
      else if (type === 'event') fireEvent({ force: true }); // 快讯：立刻报一条（管家 / 调试）
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
    /* 未发现剪影：传品种本身（不是 color 串），否则 breed.svg 取不到 → 空格子。
       symbol 是多色填充（body / 喙 / 描边各一色），currentColor 管不着；这里给剪影自带一只
       feColorMatrix：RGB 钉死成橙 #E4743A、alpha 沿用原形状 → 渲染出来就是一整块橙色剪影（不灰、不空）。
       滤镜跟着剪影一起走，不引全局 filter：万一 id 对不上，最坏也只是没滤镜，不会整只不渲染。 */
    function chickSilhouette(breed) {
      const s = chickSVG(breed);
      s.setAttribute('class', 'farm-sil');
      const fid = 'farm-sil-orange-' + (breed.svg || 'chick');
      s.innerHTML = '<defs><filter id="' + fid + '" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">'
        + '<feColorMatrix type="matrix" values="0 0 0 0 0.894  0 0 0 0 0.455  0 0 0 0 0.227  0 0 0 1 0"/>'
        + '</filter></defs>'
        + '<g filter="url(#' + fid + ')"><use href="#farm-sym-' + breed.svg + '"/></g>';
      return s;
    }
    /* 退路：内联矢量小鸡（sprite.svg 的符号，随 bundle 内联 → 永远拿得到）。
       素材图没上线时用它顶上 —— 跟 showHatch / 光标小鸡同一个原则：
       **线上 /packs 会 404，不能给用户看破图方块**。
       品种没有 svg 就没有退路（那就别换，宁可空着也不画错品种）。 */
    function chickFallbackNode(breed) {
      if (!breed || !breed.svg) return null;
      const s = chickSVG(breed);
      s.setAttribute('class', 'farm-chick-fallback');
      return s;
    }
    /* 按 id 认回品种：图鉴格子是 innerHTML 注入的，只能靠 data 属性认。 */
    function breedById(id) {
      if (!id) return null;
      for (const b of (pack.breeds || [])) if (b.id === id) return b;
      return null;
    }
    /* 图坏了 → 原地换成矢量小鸡。
       换法：删掉 .farm-chick-art（连坏图一起），塞进矢量小鸡。
       **不 replaceWith 整个盒子**：图可能还没进 DOM 就报错，那时 replaceWith 会白干一场。 */
    function rigFallback(box, breed) {
      if (!box || box.dataset.fallback) return;
      const fb = chickFallbackNode(breed);
      if (!fb) return;
      box.dataset.fallback = '1';
      box.classList.add('is-fallback');
      const art = box.querySelector('.farm-chick-art');
      if (art) art.remove();
      box.appendChild(fb);
    }
    /* 给 rig 盒子里的图接上退路。
       ⚠ 标志用**属性**（_wf）不用 dataset：图鉴格子的图是 outerHTML 序列化出来的，
       dataset 会被一起序列化 → 注入后的新盒子带着「已接线」的假标志 → 图鉴里还是破图。
       属性不序列化 → 注入后必然重新接一遍。 */
    function wireRigFallback(box) {
      if (!box || box._wf) return;
      box._wf = true;
      const breed = breedById(box.dataset.breed);
      for (const img of box.querySelectorAll('img')) {
        img.onerror = () => rigFallback(box, breed);
        /* 接线晚了一步（加载已经失败）：当场补上 */
        if (img.complete && img.naturalWidth === 0) rigFallback(box, breed);
      }
    }
    /* 精灵表是 CSS background：坏了**不报错**，鸡会整个消失（比破图更糟）。
       用一个同 URL 的 Image 探一下（走同一份缓存，不多花流量），坏了就换矢量小鸡。 */
    function wireExprProbe(box) {
      if (!box || box._we) return;
      const url = box.dataset.exprSheet;
      if (!url) return;
      box._we = true;
      const breed = breedById(box.dataset.breed);
      const probe = new Image();
      probe.onerror = () => rigFallback(box, breed);
      probe.src = url;
    }
    /* 一只换皮（rig）：丽丽的**角色真图**分层 PNG，按画板百分比摆位。
       画板等比：.farm-chick-art 用 aspect-ratio 锁住 w/footY 比例，各层按画板百分比摆位，
       横向纵向同一把尺（旧的 100/w 与 100/footY 两套比例不等 → 鸡被横向撑胖 16%）。
       脚线 footY 对齐画板底 = 盒底；idleRotate 支点在脚底（transform-origin 50% 100%）。
       图加载失败 → 原地换成矢量小鸡（见 rigFallback）。 */
    function rigVisual(rig, rot, breed) {
      const W = rig.w || 244, H = rig.h || 366, footY = rig.footY || H;
      const box = document.createElement('div');
      box.className = 'farm-chick-rig';
      box.setAttribute('aria-hidden', 'true');
      box.dataset.breed = (breed && breed.id) || '';
      const art = document.createElement('div');
      art.className = 'farm-chick-art';
      art.style.aspectRatio = W + ' / ' + footY;
      const layers = Array.isArray(rig.layers) ? rig.layers : [];
      for (const L of layers) {
        const img = document.createElement('img');
        img.className = 'farm-part';
        img.dataset.role = L.role || '';
        img.alt = '';
        img.draggable = false;
        img.src = rig.base + L.file + (window.__coopVer ? ('?' + window.__coopVer) : '');
        img.style.left = (L.left / W * 100) + '%';
        img.style.top = (L.top / footY * 100) + '%';
        img.style.width = (L.w / W * 100) + '%';
        img.style.height = (L.h / footY * 100) + '%';
        art.appendChild(img);
      }
      box.appendChild(art);
      wireRigFallback(box);
      /* pack idleRotate：闲置造型倾角（造型九式 lean）；不立正 */
      if (rot) box.style.setProperty('--rig-rot', rot + 'deg');
      return box;
    }
    /* rig 优先（2026-11-04）：以前 expr 优先 → 屏幕上跑的是「表情九宫格」那只正面 study chick，
       跟丽丽的正式形象（品种全家福）完全对不上，9 个品种全是同一只圆鸡只差颜色。
       现在先走角色真图（全家福），表情表留作 fallback。
       stageKey 给了就用成长阶段的图（雏 → 小 → 中 → 大 → 成），没给就是成鸡。
       lux 给了就用「豪华成鸡」那张（成鸡之后的可选形态，见 luxRig）。 */
    function chickVisual(breed, stageKey, lux) {
      const lr = lux ? luxRig(breed) : null;
      if (lr) return rigVisual(lr, 0, breed);   /* ⚠ 必须渲染成 DOM —— 返回 rig 对象会变成 "[object Object]" 文字 */
      const rig = stageKey ? stageRig(stageKey, breed) : null;
      if (rig) return rigVisual(rig, 0, breed);
      if (breed && breed.rig && breed.rig.base) return rigVisual(breed.rig, Number(breed.idleRotate != null ? breed.idleRotate : (breed.rig.idleRotate != null ? breed.rig.idleRotate : 0)), breed);
      if (breed && breed.expr) return exprVisual(breed);
      return chickSVG(breed);
    }

    /* ===== 豪华成鸡（2026-11-04）=====
       素材 = 丽丽「部件库/03-成年大鸡六只」那套造型（铅笔线稿 + 花冠 + 长尾羽），
       按品种色改色出 9 张（scripts/make-lux-sprites.mjs）。
       ⚠ 它**不是成长线的第 6 阶**：那一套是另一套画风（淡彩肌理 + 长尾羽），
         硬接进 stages.order 就是「换装感」—— 从扁平色块的成鸡突然变成线稿。
         所以它是**成鸡之后的一个可选形态**：照顾得好（三轴都达标）就能「加冕」，
         画风不同反而成了「豪华版」的卖点。
       解锁条件写在 pack.json 的 lux.unlock（引擎只读，不硬编码）。 */
    function luxRig(breed) {
      const L = pack.lux;
      if (!L || !L.base || !breed || !breed.id) return null;
      const tmpl = L.file || '<breed>.png';
      const file = tmpl.replace('<breed>', breed.id);
      const art = (L.breeds && L.breeds[breed.id]) || L.art;
      if (!art) return null;
      return {
        base: L.base, w: art.w, h: art.h, footY: art.h,
        layers: [{ file, role: 'body', left: 0, top: 0, w: art.w, h: art.h }],
      };
    }
    /* 能不能加冕：成鸡 + 三轴都达标（条件在 pack.json 的 lux.unlock 里） */
    function luxUnlocked(c) {
      const L = pack.lux;
      if (!L || !L.unlock) return false;
      if (stageOf(c && c.rec) !== STAGE_LAST) return false;
      const u = L.unlock;
      return chickMood(c) >= (u.mood || 0)
        && chickFull(c) >= (u.full || 0)
        && chickClean(c) >= (u.clean || 0);
    }
    /* 换装成豪华成鸡（或者还原） */
    function applyLux(c, on) {
      if (!c || !c.inn) return;
      const old = c.inn.firstElementChild;
      const v = chickVisual(c.breed, c.stage, on);
      if (old && v) old.replaceWith(v);
      else if (v) c.inn.appendChild(v);
      c.art = c.inn.querySelector('.farm-chick-art');
      c.lux = !!on;
      if (c.rec) {
        c.rec.lux = on ? 1 : 0;
        c.rec.luxAt = Date.now();   // 跨标签页合并用（见 recTs）
      }
      /* 豪华版画得更大（renderH 在 pack.json 的 lux 段） */
      if (c.el) {
        const L = pack.lux;
        if (on && L && L.renderH) {
          const b = luxBox(c.breed);
          if (b) { c.el.style.width = b[0] + 'px'; c.el.style.height = b[1] + 'px'; }
        } else {
          const box = stageBox(c.stage, c.breed);
          if (box) { c.el.style.width = box[0] + 'px'; c.el.style.height = box[1] + 'px'; }
        }
        c.el.dataset.lux = on ? '1' : '0';
      }
    }

    /* ===== 成长阶段：状态、推进、换装 =====
       阶段状态记在账本记录上（rec.stage / rec.stageAt / rec.growth），
       离线也在长（时间是真的走），互动能加速（成长值）。
       阶段只前进不后退；老档没有 stage 字段 → 当成成鸡（不突然变大）。 */
    function stageOf(rec) {
      if (!STAGE_ORDER.length) return '';
      if (!rec) return STAGE_LAST;
      const i = STAGE_ORDER.indexOf(rec.stage);
      return i < 0 ? STAGE_LAST : STAGE_ORDER[i];
    }
    function stageMs(key) {
      const s = STAGE_LIST[key];
      return s && typeof s.ms === 'number' && s.ms > 0 ? s.ms : 0;
    }
    function stageProgress(rec) {
      if (!rec) return 0;
      const at = typeof rec.stageAt === 'number' ? rec.stageAt : Date.now();
      const g = typeof rec.growth === 'number' ? rec.growth : 0;
      return Math.max(0, Date.now() - at) + Math.max(0, g);
    }
    /* 推进一阶。返回新阶段名，没得推就返回 null（终态 / 还没到时间）。 */
    function advanceStage(rec) {
      if (!rec || !STAGE_ORDER.length) return null;
      const key = stageOf(rec);
      const ms = stageMs(key);
      if (!ms) return null;                       // 最后一阶：终态
      if (stageProgress(rec) < ms) return null;   // 还没待够
      const next = STAGE_ORDER[STAGE_ORDER.indexOf(key) + 1];
      if (!next) return null;
      const over = stageProgress(rec) - ms;       // 多出来的算进下一阶
      rec.stage = next;
      rec.stageAt = Date.now();
      rec.growth = over > 0 ? over : 0;
      return next;
    }
    /* 互动加速：折算成毫秒成长值（VPet 的「经验来自主动互动」） */
    function addGrowth(c, ms) {
      if (!c || !c.rec || !ms) return;
      c.rec.growth = (typeof c.rec.growth === 'number' ? c.rec.growth : 0) + ms;
    }
    /* 成长阶段的图：单层 rig（每品种一张改色图）；成鸡没有 art → 走品种自己的全家福 */
    function stageRig(key, breed) {
      const st = STAGE_LIST[key];
      if (!st || !st.art || !breed || !breed.id) return null;
      if (!pack.stages || !pack.stages.base) return null;
      const tmpl = pack.stages.file || '<stage>/<breed>.png';
      const file = tmpl.replace('<stage>', key).replace('<breed>', breed.id);
      return {
        base: pack.stages.base, w: st.art.w, h: st.art.h, footY: st.art.h,
        layers: [{ file, role: 'body', left: 0, top: 0, w: st.art.w, h: st.art.h }],
      };
    }
    /* 这一阶该画多大：高度 = renderH（成长必须看得见），宽度按素材长宽比推 */
    function stageBox(key, breed) {
      const st = STAGE_LIST[key];
      if (!st || !st.renderH) return null;
      const k = stageScale();
      const h = Math.max(1, Math.round(st.renderH * k));
      let ar = 1;
      if (st.art && st.art.h) ar = st.art.w / st.art.h;
      else if (breed && breed.rig && breed.rig.h) ar = breed.rig.w / breed.rig.h;
      return [Math.max(1, Math.round(h * ar)), h];
    }
    /* 豪华成鸡的盒子（画得比普通成鸡大一点 —— 豪华版要有分量） */
    function luxBox(breed) {
      const L = pack.lux;
      if (!L || !L.renderH) return null;
      const art = (L.breeds && breed && L.breeds[breed.id]) || L.art;
      if (!art) return null;
      const h = Math.max(1, Math.round(L.renderH * stageScale()));
      const ar = art.h ? art.w / art.h : 0.65;
      return [Math.max(1, Math.round(h * ar)), h];
    }
    /* 这只鸡现在的盒子：豪华版优先 */
    function chickBox(c) {
      if (c && c.lux) {
        const b = luxBox(c.breed);
        if (b) return b;
      }
      return stageBox(c ? c.stage : '', c ? c.breed : null);
    }
    /* 换装：把鸡换成某一阶的样子（换图 + 换盒子大小） */
    function applyStage(c, key) {
      if (!c || !c.inn) return;
      const k = (key && STAGE_ORDER.indexOf(key) >= 0) ? key : STAGE_LAST;
      const old = c.inn.firstElementChild;
      /* 豪华版要保住 —— 成长换阶时不能把加冕状态洗掉 */
      const v = chickVisual(c.breed, k, c.lux);
      if (old && v) old.replaceWith(v);
      else if (v) c.inn.appendChild(v);
      c.art = c.inn.querySelector('.farm-chick-art');
      c.stage = k;
      if (c.el) {
        c.el.dataset.stage = k;
        const box = chickBox(c);
        if (box) { c.el.style.width = box[0] + 'px'; c.el.style.height = box[1] + 'px'; }
      }
    }
    /* 进化演出：弹一下 + 品种音上行 + 一句话（数码蛋那套「进化要有仪式感」） */
    function evolveShow(c) {
      if (!c || !c.el) return;
      const el = c.el;
      el.classList.remove('is-evolve');
      void el.offsetWidth;
      el.classList.add('is-evolve');
      window.setTimeout(() => el.classList.remove('is-evolve'), 1000);
      const f = (c.breed && c.breed.f) ? c.breed.f : 660;
      play((t) => {
        [0, 0.09, 0.18].forEach((d, i) => cluck(t + d, f * (1 + i * 0.26), 0.12));
        noteFloat(c.x, c.y - 46, 'var(--yellow)', c);
      });
      emitSay('小鸡长大了一点！');
    }
    /* 扫一遍所有鸡，把到点的推一阶。
       场上这只 → 换装 + 演出；不在本页的 → 静默补账（回来只报喜，不连播动画）。 */
    function checkGrowth(show) {
      if (!STAGE_ORDER.length) return 0;
      let grew = 0;
      for (const c of flock) {
        if (!c || c.dead || !c.rec) continue;
        /* ⚠ 别写成 `while ((next = advanceStage(rec)) && …)`：
           循环最后一次 next = null，会把「涨到哪一阶」抹掉 →
           账上进了新阶段，画面却还是旧图（鸡长得不换脸）。 */
        let got = null, guard = 0;
        while (guard++ < 60) {
          const n = advanceStage(c.rec);
          if (!n) break;
          got = n;
        }
        if (got) {
          applyStage(c, got);
          if (show) evolveShow(c);
          grew++;
        }
      }
      for (const r of state.chickens) {
        if (!r || flock.some((c) => c.rec === r)) continue;
        let guard = 0;
        while (advanceStage(r) && guard++ < 60) grew++;
      }
      return grew;
    }

    /* 表情表：一只鸡 = 一张九宫精灵表，切帧只改 background-position。
       素材是丽丽「部件库/02-表情九宫格」的九只 —— 九只是**整只重画**的
       （身体比例、脸在身上的位置都不同，相对 body 盒的脸坐标 y 从 0.24 到 0.50 都有），
       所以只能整只切帧，不能只换脸。拼表与对齐见 scripts/make-expr-sheet.mjs。 */
    function exprVisual(breed) {
      const ex = breed.expr;
      const box = document.createElement('div');
      box.className = 'farm-chick-rig';
      box.setAttribute('aria-hidden', 'true');
      const art = document.createElement('div');
      art.className = 'farm-chick-art is-expr';
      art.style.setProperty('--rig-ar', `${ex.cellW} / ${ex.cellH}`);
      const sheetUrl = `${ex.sheet}${window.__coopVer ? '?v=' + window.__coopVer : ''}`;
      art.style.backgroundImage = `url("${sheetUrl}")`;
      art.style.backgroundSize = `${ex.cols * 100}% ${ex.rows * 100}%`;
      art.dataset.expr = '1';
      box.appendChild(art);
      /* 精灵表是 CSS background：坏了**不报错**，鸡会整个消失（比破图更糟）。
         探一下（见 wireExprProbe），坏了就换成矢量小鸡。
         data 属性写全：图鉴格子是 innerHTML 注入的，注入后要靠它重新接。 */
      box.dataset.breed = (breed && breed.id) || '';
      box.dataset.exprSheet = ex.sheet ? sheetUrl : '';
      wireExprProbe(box);
      const rot = Number(breed.idleRotate != null ? breed.idleRotate : 0);
      if (rot) box.style.transform = `rotate(${rot}deg)`;
      return box;
    }
    /* 切表情：只改 background-position */
    function setExpr(c, id) {
      if (!c || !c.breed) return;
      /* rig 模式（角色真图）：没有表情帧可切 → 情绪改用姿态表达（见 applyMoodPose） */
      if (c.rigged) { applyMoodPose(c, id); return; }
      if (!c.breed.expr) return;
      if (c.expr === id) return;
      c.expr = id;
      const art = c.art;
      if (!art) return;
      const ex = c.breed.expr;
      let cell = 0;
      for (const f of (ex.frames || [])) if (f.id === id) { cell = f.cell; break; }
      const col = cell % ex.cols, row = Math.floor(cell / ex.cols);
      /* background-size 是 cols×100%，所以百分比定位的分母是 (cols-1)：
         3×3 表 → 0% / 50% / 100% 各对准一格。用 cols 当分母会切在格子边界上（只剩一条竖缝）。 */
      const px = ex.cols > 1 ? (col / (ex.cols - 1)) * 100 : 0;
      const py = ex.rows > 1 ? (row / (ex.rows - 1)) * 100 : 0;
      art.style.backgroundPosition = `${px}% ${py}%`;
      art.dataset.exprId = id;
    }
    /* 表情由状态决定 —— 每一档都得有理由，不然就是装饰：
       蔫 = 心情低于 MOOD_LOW；饿 = 心情偏低想要吃的；
       开心 = 心情不错 / 刚吃过米；兴奋 = 正在啄（专注）或心情爆表；
       惊喜 = 刚收到礼物或传说出壳；困 = 深夜；疑惑 = 发呆太久没事干；
       眨眼 = 随机眨一下；其余 = 平静。
       状态多维（2026-11-04）后，「饿」跟「脏」有了各自的依据：
         饿 = **饱腹低**（吃米能回）；脏 = **清洁低**（添水能回）；
       心情低仍然是蔫 —— 三档各对应一件器物，玩家一眼能看出该做什么。 */
    /* 姿态表情：rig 模式没有表情帧（丽丽还没按「品种全家福」这套造型画 9 表情九宫格），
       情绪改用**姿态**表达 —— 每一种都对应画面上真看得见的变化，不是装饰：
       蔫 = 降饱和（is-glum，由心情直接判定，见 stepChick）/ 脏 = 去饱和 + 抖（is-dirty）/
       困 = 点头（is-sleep）/
       开心·兴奋 = 轻弹（is-cheer）/ 饿 = 低头（is-hungry）/ 疑惑 = 歪头（is-doubt）/
       惊喜 = 一缩（is-shock）/ 眨眼 = 一挤（is-blink）。
       等九宫格按全家福造型补齐，把 pack.json 的 expr 打开、切回 expr 模式，
       这些姿态就退成兜底 —— 表情 id 的语义两边是一致的，不用重写。 */
    const POSE_CLASS = {
      calm: [], blink: ['is-blink'], happy: ['is-cheer'], excited: ['is-cheer'],
      hungry: ['is-hungry'], shock: ['is-shock'], doubt: ['is-doubt'],
      glum: [], sleepy: ['is-sleep'], dirty: [],
    };
    function applyMoodPose(c, id) {
      if (!c || !c.el) return;
      const want = POSE_CLASS[id] || [];
      for (const list of Object.values(POSE_CLASS)) {
        for (const k of list) if (want.indexOf(k) < 0) c.el.classList.remove(k);
      }
      for (const k of want) c.el.classList.add(k);
    }
    function refreshExpr() {
      const now = Date.now();
      const hour = new Date().getHours();
      const night = hour >= 23 || hour < 5;
      for (const c of flock) {
        if (!c || c.dead || !c.breed) continue;
        if (!c.breed.expr && !c.rigged) continue;   // rig 模式也走这里（姿态表情）
        let e = 'calm';
        const mood = chickMood(c);
        const full = chickFull(c);      // 饱腹：吃米能回
        const clean = chickClean(c);    // 清洁：添水能回
        /* 附近有没有吃的：没有就「疑惑」一阵子 */
        const hasFood = !!(nearestGrain(c) || nearestPlateFood(c));
        if (hasFood) c.noFoodSince = 0;
        else if (!c.noFoodSince) c.noFoodSince = now;
        if (c.shockUntil && now < c.shockUntil) e = 'shock';
        else if (c.eatCool > 0) e = 'happy';
        else if (c.inn && c.inn.classList.contains('is-peck')) e = 'excited';
        else if (mood < MOOD_LOW) e = 'glum';           // 心情低 → 蔫（该去陪它）
        else if (full < 25) e = 'hungry';               // 饱腹低 → 饿（该摆食盆）
        else if (clean < CLEAN_LOW) e = 'dirty';        // 清洁低 → 脏（该添水）
        else if (mood < 45) e = 'hungry';
        else if (mood >= 88) e = 'excited';
        else if (mood >= 70) e = 'happy';
        else if (night) e = 'sleepy';
        else if (c.noFoodSince && now - c.noFoodSince > 15000) e = 'doubt';
        c.exprBase = e;
        if (c.expr !== 'blink') setExpr(c, e);
      }
    }
    /* 眨眼：随机 2.4~6.6 秒眨一下，130ms 后回到原表情 */
    function scheduleBlink(c) {
      if (!c || c.dead || !c.breed) return;
      if (!c.breed.expr && !c.rigged) return;
      c.timers.push(window.setTimeout(() => {
        if (!c || c.dead) return;
        setExpr(c, 'blink');
        c.timers.push(window.setTimeout(() => {
          if (c && !c.dead) setExpr(c, c.exprBase || 'calm');
        }, 130));
        scheduleBlink(c);
      }, 2400 + Math.random() * 4200));
    }

    function bubble(x, y, text, ms) {
      const b = document.createElement('div');
      b.className = 'farm-bubble';
      b.textContent = text;
      b.style.left = `${clamp(x, 70, Math.max(72, stage.clientWidth - 70))}px`;
      b.style.top = `${clamp(y - 46, 30, Math.max(32, stage.clientHeight))}px`;
      /* 两行（加成长进度）时多留一会儿，别还没看清就淡出 */
      const dur = ms && ms > 1900 ? ms : 1900;
      if (dur > 1900) b.style.setProperty('--bubout', ((dur - 350) / 1000).toFixed(2) + 's');
      layer.appendChild(b);
      window.setTimeout(() => b.remove(), dur);
    }

    /* 成长进度：让玩家看得见「还要多久才长大」。
       规矩 3「数值要实时可见」—— 成长值不能只存在于账里。 */
    function growthText(c) {
      if (!c || !c.rec || !STAGE_ORDER.length) return '';
      const key = stageOf(c.rec);
      const ms = stageMs(key);
      if (!ms) return '我已经长成大鸡啦！';
      const left = ms - stageProgress(c.rec);
      if (left <= 0) return '我马上要长大了！';
      const m = Math.ceil(left / 60000);
      return m >= 60 ? `再过 ${Math.round(m / 60)} 小时我就长大了` : `再过 ${m} 分钟我就长大了`;
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
      state.eggs = tallyAdd(state.tally.eggs, 1);
      state.pity = (state.pity | 0) + 1; // 软保底计数
      const breed = pickBreed(); // 蛋一落地品种就定了，图鉴概率不趁机变动
      save(); refreshHUD();
      /* 品种事件音：下蛋 = 品种音短音，发声处浮起视觉音符 */
      play((t) => {
        cluck(t, breed.f * rand(0.98, 1.02), 0.14);
        noteFloat(x, y - 46, toneOf(breed));
      });
      /* 附近有篮子 → 蛋进篮子（篮子成了蛋篓）；品种随蛋一起存着，取出来时还是它 */
      if (giveEggToBasket(x, y, breed)) return;
      spawnEgg(x, y, breed);
    }

    /* 破壳图：蛋壳裂开、雏头探出来（丽丽 成长阶梯-05 改色）。
       演出图，不是阶段 —— 碎壳之后就是「雏鸡」这一阶。
       **加载失败就退回 SVG 蛋的裂纹**（线上 /packs 会 404，不能留破图）。 */
    function showHatch(egg, breed) {
      const show = (pack.stages && pack.stages.show) || {};
      const def = show.hatch;
      if (!def || !def.art || !breed || !breed.id) return false;
      const svg = egg.querySelector('svg');
      const img = document.createElement('img');
      img.className = 'farm-egg-hatch';
      img.alt = '';
      img.decoding = 'async';
      const tmpl = pack.stages.file || '<stage>/<breed>.png';
      const file = tmpl.replace('<stage>', 'hatch').replace('<breed>', breed.id);
      img.src = pack.stages.base + file + (window.__coopVer ? ('?' + window.__coopVer) : '');
      img.onerror = () => {
        img.remove();
        if (svg) svg.style.display = '';
        egg.classList.add('is-crack');   // 退回原来的裂纹蛋
      };
      if (svg) svg.style.display = 'none';
      egg.appendChild(img);
      if (!reduce) egg.classList.add('is-hatch');
      return true;
    }

    /* 蛋的落地动画与破壳：落地蛋、从篮子里取出的蛋共用这一段
       时序：drop(0) → wob(540) → 破壳(1500，雏头探出) → 碎壳出雏鸡(2300) */
    function spawnEgg(x, y, breed) {
      const egg = document.createElement('div');
      egg.className = reduce ? 'farm-egg' : 'farm-egg is-drop';
      egg.style.left = `${x}px`;
      egg.style.top = `${y}px`;
      egg.style.zIndex = String(Math.round(y));
      /* 蛋壳带这个品种的颜色（见 shellColor）：蛋一落地就知道会孵出什么 */
      egg.style.color = shellColor(breed);
      egg.innerHTML = '<svg viewBox="0 0 100 120" aria-hidden="true"><use href="#farm-sym-egg"/><g style="opacity:var(--cfcrack,0)"><use href="#farm-sym-egg-cracked"/></g></svg>';
      layer.appendChild(egg);

      if (reduce) {
        eggTimers.push(window.setTimeout(() => { egg.remove(); hatch(x, y, breed); }, 500));
        return;
      }
      eggTimers.push(window.setTimeout(() => { egg.classList.remove('is-drop'); egg.classList.add('is-wob'); }, 540));
      eggTimers.push(window.setTimeout(() => {
        /* 破壳图没有就退回 SVG 裂纹（老包 / 图没加载） */
        if (!showHatch(egg, breed)) egg.classList.add('is-crack');
      }, 1500));
      eggTimers.push(window.setTimeout(() => { egg.remove(); hatch(x, y, breed); }, 2300));
    }

    function hatch(x, y, breed) {
      /* 出壳 = 一声品种音（金·元宝保留 C 大三琶音，palette.md），发声处浮起视觉音符 */
      play((t) => {
        if (breed.rarity === 'legendary') {
          [261.63, 329.63, 392.0, 523.25].forEach((f, i) => cluck(t + i * 0.09, f, 0.16));
        } else {
          cluck(t, breed.f, 0.14);
        }
        noteFloat(x, y - 46, toneOf(breed));
      });
      state.hatched = tallyAdd(state.tally.hatched, 1);
      if (!state.tally.dex[breed.id]) state.tally.dex[breed.id] = {};
      state.dex[breed.id] = tallyAdd(state.tally.dex[breed.id], 1);
      let bornRec = null;
      if (state.chickens.length < MAX_FLOCK) {
        state.seq = tallyAdd(state.tally.seq, 1);
        bornRec = {
          id: `c-${state.seq}-${ORIGIN}`,
          breed: breed.id,
          page: HERE,
          pos: [+(x / stage.clientWidth).toFixed(3), +(y / stage.clientHeight).toFixed(3)],
          lastSeen: Date.now(),
          mood: MOOD_START,
          moodAt: Date.now(),
          /* 状态多维（2026-11-04）：心情 / 饱腹 / 清洁三轴。
             饱腹靠吃米回、清洁靠喝水回 —— 每件器物的收益在数值上分得开。 */
          full: FULL_START,
          fullAt: Date.now(),
          clean: CLEAN_START,
          cleanAt: Date.now(),
          /* 成长：出壳就是雏鸡，从这里开始往成鸡长（阶段只前进不后退） */
          stage: STAGE_ORDER[0] || STAGE_LAST,
          stageAt: Date.now(),
          growth: 0,
        };
        state.chickens.push(bornRec);
      }
      save(); refreshHUD();

      if (!reduce) shells(x, y, breed);
      /* 阶段显式给：账本满了没进册时，新鸡也该是雏鸡（别去拿上一只的阶段） */
      const born = addChick(x, y, breed, true, bornRec ? bornRec.stage : (STAGE_ORDER[0] || STAGE_LAST), bornRec);
      if (born && breed.rarity === 'legendary') born.shockUntil = Date.now() + 2400; // 传说出壳：惊一下
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

    function shells(x, y, breed) {
      const s = document.createElement('div');
      s.className = 'farm-shells';
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.zIndex = String(Math.round(y) + 1);
      s.style.color = shellColor(breed); // 碎壳跟蛋同色
      s.innerHTML = '<svg class="farm-shl farm-shl-b" viewBox="0 0 100 120" aria-hidden="true"><use href="#farm-sym-shell-half"/></svg>' +
        '<svg class="farm-shl farm-shl-t" viewBox="0 0 100 120" aria-hidden="true"><use href="#farm-sym-shelltop"/></svg>';
      layer.appendChild(s);
      window.setTimeout(() => s.remove(), 800);
    }

    function addChick(x, y, breed, fresh, stageKey, rec) {
      /* 阶段：给了就用给的；没给就按账本里那条记录（刚孵出来的那只有 stage='chick'）；
         都没有 → 成鸡（老档没有 stage 字段，当成待够久的老鸡，不突然变大）。 */
      let st = stageKey || '';
      if (!st && rec) st = stageOf(rec);
      if (!st && fresh) {
        const last = state.chickens[state.chickens.length - 1];
        if (last) st = stageOf(last);
      }
      if (!st) st = STAGE_LAST;
      const el = document.createElement('div');
      el.className = 'farm-chick';
      el.dataset.breed = breed && breed.id ? breed.id : '';   // 验收脚本靠它认品种
      el.dataset.stage = st;                                  // 验收脚本靠它认阶段
      /* 豪华成鸡：账本记着 rec.lux → 刷新回来仍是豪华版（别让玩家以为加冕白给了） */
      const isLux = !!(rec && rec.lux && pack.lux && pack.lux.base);
      if (isLux) el.dataset.lux = '1';
      const wob = document.createElement('div');
      wob.className = 'farm-chick-wob';
      const inn = document.createElement('div');
      inn.className = `farm-chick-in${fresh && !reduce ? ' is-pop' : ''}`;
      inn.appendChild(chickVisual(breed, st, isLux));
      wob.appendChild(inn);
      el.appendChild(wob);
      layer.appendChild(el);

      const c = {
        el, wob, inn, breed,
        rigged: !!(breed && breed.rig && breed.rig.base),   // 角色真图（品种全家福）还是表情九宫格
        stage: st,          // 当前成长阶段
        lux: isLux,         // 豪华成鸡（成鸡之后的可选形态）
        id: rec ? rec.id : (fresh ? state.chickens[state.chickens.length - 1]?.id || '' : ''),
        x, y, tx: x, ty: y,
        flip: Math.random() < 0.5 ? -1 : 1,
        speed: rand(36, 68),
        mode: 'wait', // fsm：wait | walk | peck(转瞬) | leave
        wait: rand(0.4, 1.2),
        phase: rand(0, 6.28),
        notes: 0, // 同时漂浮的视觉音符数（每鸡上限 3）
        dead: false,
        timers: [],
        expr: '',        // 当前表情 id（表情表品种才有）
        exprBase: 'calm', // 底表情；眨眼之后回到这里
        act: '',         // 当前行为（idle/peck/walk…，从行为表抽的）
        noFoodSince: 0,  // 附近没吃的开始时间（久了 → 疑惑）
      };
      /* 盒子大小按阶段来（雏鸡小、成鸡大 —— 成长必须看得见）；豪华版另有尺寸 */
      const box0 = isLux ? (luxBox(breed) || stageBox(st, breed)) : stageBox(st, breed);
      if (box0) { el.style.width = box0[0] + 'px'; el.style.height = box0[1] + 'px'; }

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
      c.rec = rec || state.chickens.find((r) => r.id === c.id) || null; // 对上账本记录（心情/成长等状态记在上面）
      /* 表情表品种：记住画布 + 开始随机眨眼 */
      c.art = c.inn.querySelector('.farm-chick-art');
      if (c.breed && c.breed.expr) { setExpr(c, 'calm'); scheduleBlink(c); }
      return c;
    }

    function newTarget(c) {
      c.tx = rand(44, Math.max(46, stage.clientWidth - 44));
      c.ty = rand(36, Math.max(38, stage.clientHeight - 56));
    }

    /* ===== 行为表（学 Shimeji 的 actions/behaviors 两层分离，2026-11-04）=====
       「能做什么」= 这张表（在 pack.json 里）；「什么时候做」= 加权 + 触发条件。
       频率、时长、开关、品种覆盖全在 pack.json —— **改行为不用改引擎代码**。
       frequency 是相对频率（不要求和为 1），frequency:0 或 enabled:false = 关掉这个行为
       （Shimeji 的 frequency=0 等价物）。
       表里没有的行为一律不做；表整个缺失 → 退回「只走路」，
       **不退回硬编码的默认频率** —— 那会让 pack.json 不再是唯一出处。 */
    const BEHAVIOR_ACTIONS = ['idle', 'peck', 'walk', 'seekFood', 'eatPlate', 'stand', 'chaseMouse'];
    const BEHAVIOR_COUNTS = { idle: 0, peck: 0, walk: 0 }; // 累计次数（验收看分布用）
    const BEHAVIOR_BY_BREED = {}; // 品种 → { idle, peck, walk }：哪只鸡最爱啄
    function normalizeBehaviors(raw) {
      const out = {};
      if (!raw || typeof raw !== 'object') return out;
      for (const id of Object.keys(raw)) {
        if (id.charAt(0) === '_') continue;                    // _doc 之类的说明键
        const b = raw[id];
        if (!b || typeof b !== 'object') continue;
        const action = typeof b.action === 'string' ? b.action : id;
        if (BEHAVIOR_ACTIONS.indexOf(action) < 0) continue;     // 引擎不认的动作不做
        const trigger = typeof b.trigger === 'string' ? b.trigger : null;
        const freq = (typeof b.frequency === 'number' && isFinite(b.frequency)) ? b.frequency : 0;
        /* 条件触发看 enabled；加权行为看 frequency（0 = 关） */
        const enabled = b.enabled !== false && (trigger ? true : freq > 0);
        if (!enabled) continue;                                // 关掉的根本不进表
        let dur = null;
        if (Array.isArray(b.duration) && b.duration.length === 2) {
          const a = Number(b.duration[0]), z = Number(b.duration[1]);
          if (isFinite(a) && isFinite(z)) dur = [Math.min(a, z), Math.max(a, z)];
        }
        /* 触发器行为可以带自己的参数（chaseMouse 的 radius / cooldown 等）——
           原样带出来，让「参数也归 pack.json 管」成立（改半径不用改引擎代码）。
           只带纯数字的键，避免把 note 之类的说明文字塞进行为对象。 */
        const params = {};
        for (const k of Object.keys(b)) {
          if (k === 'id' || k === 'action' || k === 'trigger' || k === 'frequency'
            || k === 'duration' || k === 'enabled' || k === 'note' || k === 'weight') continue;
          const v = b[k];
          if (typeof v === 'number' && isFinite(v)) params[k] = v;
        }
        out[id] = { id, action, frequency: trigger ? 0 : freq, duration: dur, trigger, params };
      }
      return out;
    }
    const BASE_BEHAVIORS = normalizeBehaviors(pack.behaviors);
    /* 品种覆盖（Shimeji 的 per-image-set conf）：breeds[].behaviors 只写要改的键 */
    const BEHAVIOR_CACHE = new Map();
    function behaviorsFor(c) {
      const id = (c && c.breed && c.breed.id) || '';
      if (BEHAVIOR_CACHE.has(id)) return BEHAVIOR_CACHE.get(id);
      let t = BASE_BEHAVIORS;
      const ov = c && c.breed && c.breed.behaviors;
      if (ov && typeof ov === 'object') {
        const merged = {};
        for (const k of Object.keys(pack.behaviors || {})) merged[k] = pack.behaviors[k];
        for (const k of Object.keys(ov)) {
          if (!ov[k] || typeof ov[k] !== 'object') continue;
          merged[k] = Object.assign({}, merged[k] || {}, ov[k]);
        }
        t = normalizeBehaviors(merged);
      }
      BEHAVIOR_CACHE.set(id, t);
      return t;
    }
    /* 加权抽一个行为（频率是相对权重，不要求和为 1） */
    function pickBehavior(B) {
      let total = 0;
      for (const id of Object.keys(B)) {
        const b = B[id];
        if (b.trigger) continue;                    // 条件触发的行为不走加权
        total += b.frequency;
      }
      if (total <= 0) return null;
      let r = Math.random() * total;
      for (const id of Object.keys(B)) {
        const b = B[id];
        if (b.trigger) continue;
        r -= b.frequency;
        if (r <= 0) return b;
      }
      return null;
    }
    /* 开始追鼠标（ChaseMouse）：命中就设好目标点，返回 true 表示「这次决策是追鼠标」。
       目标点要**钉住**（c.chaseX/chaseY），不能每帧追着鼠标的最新位置走 ——
       那样鸡会一直冲过头再折返（实测：逼近到 55px 后又跑回 88px）。
       钉住 + 到了 26px 内就停，才像「走过去看一眼」。 */
    function startChase(c, cfg, radOverride) {
      if (!c || !cfg) return false;
      const P = cfg.params || {};
      const now = performance.now();
      /* 冷却：追过一次要歇一会儿，不然鸡会一直黏着指针（很吵） */
      if (c.chaseUntil && now < c.chaseUntil) return false;
      if (!mouseStage.on) return false;
      const rad = radOverride || P.radius || 160;
      const d = Math.hypot(mouseStage.x - c.x, mouseStage.y - c.y);
      /* 太近了不用追（已经在旁边）；太远了不追（不许满屏乱跑） */
      if (d <= 26 || d >= rad) return false;
      c.mode = 'walk';
      c.tx = mouseStage.x; c.ty = mouseStage.y;
      c.chaseX = mouseStage.x; c.chaseY = mouseStage.y;
      c.chaseTarget = true;
      c.chaseAimAt = now;
      c.chaseUntil = now + (P.cooldown || 12) * 1000;
      c.act = 'chaseMouse';
      c.el.dataset.act = 'chaseMouse';
      BEHAVIOR_COUNTS.chaseMouse = (BEHAVIOR_COUNTS.chaseMouse || 0) + 1;
      const bk = (c.breed && c.breed.id) || '';
      if (bk) {
        const per = (BEHAVIOR_BY_BREED[bk] = BEHAVIOR_BY_BREED[bk] || {});
        per.chaseMouse = (per.chaseMouse || 0) + 1;
      }
      return true;
    }
    function decide(c) {
      const B = behaviorsFor(c);
      /* 音乐会受控鸡：站桩等指令（行为表里关掉 stand → 音乐会散场，鸡自由活动） */
      if (c.concert && B.stand) { c.mode = 'wait'; c.wait = 0.3; return; }
      /* ChaseMouse（Shimeji 的必备行为，2026-11-04）**优先于**加权抽签：
         我们原来只有「光标小鸡」跟着指针走 —— 那是装饰性跟随，不是「鸡自己追鼠标」。
         现在鼠标靠近，小鸡自己走过去看一眼。
         为什么放在 decide() 而不是 stepChick 的 wait 分支：
         放那儿的话，只有鸡恰好在发呆（wait）的那一瞬间才可能触发 ——
         而鸡大部分时间在走，触发窗口太窄，实测几乎追不上（鸡径直走开了）。
         decide() 是每次「做完一件事、下一步干什么」的决策点，在这里判定才是对的。
         半径/冷却都从行为表读（pack.json 的 behaviors.chaseMouse），
         关掉它就完全不追（enabled:false）。 */
      if (B.chaseMouse && startChase(c, B.chaseMouse)) return;
      const b = pickBehavior(B);
      /* 表里没有能做的（表缺失，或加权行为全被关掉）→ 至少走走。
         别让鸡僵在原地 —— 那比「退化」更难看。 */
      const act = b ? b.action : 'walk';
      const d = b && b.duration;
      const w = d ? rand(d[0], d[1]) : 1.0;
      c.act = act;
      c.el.dataset.act = act;                 // 此刻在干嘛（看得见，将来 HUD 也要用）
      BEHAVIOR_COUNTS[act] = (BEHAVIOR_COUNTS[act] || 0) + 1;
      const bk = (c.breed && c.breed.id) || '';
      if (bk) {
        const per = (BEHAVIOR_BY_BREED[bk] = BEHAVIOR_BY_BREED[bk] || {});
        per[act] = (per[act] || 0) + 1;
      }
      if (act === 'peck') { peck(c); c.mode = 'wait'; c.wait = w; }
      else if (act === 'walk') { c.mode = 'walk'; newTarget(c); }
      else { c.mode = 'wait'; c.wait = w; }   // idle：发呆
    }

    function stepChick(c, dt, t) {
      if (c.mode === 'leave') {
        /* 装篮淡出中：站着别走，等计时器把它收掉（走出屏要十几秒，
           那段时间台上比上限多几只，面板上的数跟画面对不上） */
        if (c.fadeOut) { draw(c, t, true); return; }
        const d = c.tx - c.x;
        const sp = c.speed * 1.5 * dt;
        if (Math.abs(d) <= sp) { kill(c); return; }
        c.x += d > 0 ? sp : -sp;
        draw(c, t, true);   // free = 离场不夹在舞台里（见 draw 的说明）
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
      /* 心情低 → 蔫（看得见）；蔫的鸡吃不下东西，得先哄。
         清洁低 → 脏（另一套画面信号：去饱和 + 抖，见 CSS 的 is-dirty）。 */
      c.el.classList.toggle('is-glum', chickMood(c) < MOOD_LOW);
      c.el.classList.toggle('is-dirty', chickMood(c) >= MOOD_LOW && chickClean(c) < CLEAN_LOW);
      c.eatCool = (c.eatCool || 0) - dt; // 吃一口歇一会儿，别把盘吃穿
      /* 找吃的：地上的谷子优先；没有就去看盘子里有没有米
         （seekFood / eatPlate 也能在行为表里关掉 —— 「摆出来的东西必须有用」反过来：
          不想要这个行为就别开） */
      if (c.mode === 'wait') {
        const B = behaviorsFor(c);
        const g = B.seekFood ? nearestGrain(c) : null;
        if (g) { c.mode = 'walk'; c.tx = g.x; c.ty = g.y + 6; c.grainTarget = g; }
        else if (B.eatPlate && chickMood(c) >= MOOD_LOW && !(c.eatCool > 0)) {
          const pf = nearestPlateFood(c);
          if (pf) { c.mode = 'walk'; c.tx = pf.p.x; c.ty = pf.p.y + 8; c.plateTarget = pf.d; }
        }
      }
      if (c.mode === 'wait') {
        c.wait -= dt;
        if (c.wait <= 0) decide(c);
        return;
      }
      /* 追鼠标的**中断**判定（2026-11-04 补）：鸡正在走的时候，鼠标凑近也要能立刻掉头去追。
         为什么 decide() 里判还不够：decide() 只发生在「走到位」或「发呆结束」——
         鸡大部分时间在走，等它下一次 decide，早走出半径了，追鼠标变成看运气
         （实测：鼠标放在 90px 外，8 秒里一次都没触发，鸡径直走开 250px）。
         中断半径比 decide 的半径小：真的凑到跟前才值得掉头（半径写在 pack.json 里）。 */
      if (!c.chaseTarget && mouseStage.on) {
        const cm = behaviorsFor(c).chaseMouse;
        if (cm) {
          const P = cm.params || {};
          const ir = P.interruptRadius || 110;
          const d = Math.hypot(mouseStage.x - c.x, mouseStage.y - c.y);
          if (d > 26 && d < ir) startChase(c, cm, ir);
        }
      }
      /* 追鼠标：走到「够近」就停（26px 内），别顶到鼠标上挡着指针。
         目标点**定期重新瞄准光标**（限速 0.5s 一次）：
         原来完全钉死在起追那一刻的坐标 —— 鼠标一直在动的话，鸡会跑去一个
         早就过时的点（实测：鸡停在光标经过的中间某个位置，看着像没追上）。
         ⚠ 这一段必须排在算位移**之前**：重瞄之后 tx/ty 变了，
         后面算 dx/dy 要用新目标，否则鸡永远在追旧点。 */
      if (c.chaseTarget) {
        const live = mouseStage.on ? mouseStage : null;
        const cd = Math.hypot((c.chaseX || c.tx) - c.x, (c.chaseY || c.ty) - c.y);
        /* 停的判据看**当前光标**（不是钉住的目标）：钉住的目标可能早过时了 */
        const ld = live ? Math.hypot(live.x - c.x, live.y - c.y) : Infinity;
        if ((live && ld < 26) || (!live && cd < 26)) {
          /* 追到了：站住看一会儿（2.5~4 秒）再散。
             停太短的话，普通行为会立刻接管（decide → 随机 walk 目标），
             鸡转头就走 —— 那不叫「走过去看一眼」，像没追上。 */
          c.chaseTarget = false;
          c.mode = 'wait'; c.wait = rand(2.5, 4.0);
          return;
        }
        /* 重新瞄准：每 0.5s 挪一次目标，追着光标的方向走，但不追着抖 */
        const now = performance.now();
        if (live && now - (c.chaseAimAt || 0) > 500) {
          c.chaseAimAt = now;
          const cm = behaviorsFor(c).chaseMouse;
          const rad = (cm && cm.params && cm.params.radius) || 160;
          if (ld < rad) { c.chaseX = live.x; c.chaseY = live.y; c.tx = live.x; c.ty = live.y; }
        }
      }
      const dx = c.tx - c.x;
      const dy = c.ty - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 5) {
        /* 快讯播报：这只鸡是专门走到场中央来报消息的，到了就冒泡（先于其他到达判定） */
        if (c.bcast) {
          const b = c.bcast; c.bcast = null;
          showBcast(c, b.item, b.manual);
          c.mode = 'wait'; c.wait = rand(1.2, 2.2);
          return;
        }
        if (c.grainTarget && !c.grainTarget.taken) { eatGrain(c, c.grainTarget); c.grainTarget = null; c.mode = 'wait'; c.wait = rand(0.4, 0.9); return; }
        if (c.chaseTarget) {
          /* 只是走到了钉住的目标点，但光标已经挪走了 → 立刻重新瞄准，继续追。
             （光标还在附近才继续；光标跑远了就到此为止） */
          const live = mouseStage.on ? mouseStage : null;
          const ld = live ? Math.hypot(live.x - c.x, live.y - c.y) : 0;
          if (ld >= 26) { c.chaseAimAt = 0; return; }
          /* 追到了：站在那儿看一眼，别顶着鼠标不动（挡着指针） */
          c.chaseTarget = false;
          c.mode = 'wait'; c.wait = rand(0.5, 1.4);
          return;
        }
        if (c.plateTarget) {
          const pd = c.plateTarget;
          c.plateTarget = null;
          if ((pd.rice | 0) > 0) {
            pd.rice -= 1;
            pd.at = Date.now();
            addMood(c, MOOD_EAT);
            addFull(c, FULL_EAT);     // 吃米涨饱腹（状态多维：米 = 饱腹）
            addGrowth(c, STAGE_BOOST.eat);   // 喂食也能催大它（VPet：经验来自主动互动）
            c.eatCool = 1.6;
            noteFloat(c.x, c.y - 40, 'var(--yellow)', c);
            save(); renderDecos();
          }
          c.mode = 'wait'; c.wait = rand(0.4, 0.9); return;
        }
        decide(c);
        return;
      }
      const sp = c.speed * dt;
      c.x += (dx / dist) * sp;
      c.y += (dy / dist) * sp;
      if (Math.abs(dx) > 2) c.flip = dx < 0 ? -1 : 1;
      draw(c, t);
    }

    function draw(c, t, free) {
      const wobA = reduce ? 0 : Math.sin(t * 11 + c.phase) * 6;
      /* 离场中的鸡（mode='leave'）**不夹在舞台里**。
         原来这里一律把 x 夹在 [20, w-20]，于是要走出去的鸡走到边缘就被夹住 ——
         它永远到不了终点，也就永远不会被 kill（2026-11-05 实测：
         派去别的页的鸡一直站在屏幕边上不走，像卡住了）。 */
      if (!free) c.x = clamp(c.x, 20, Math.max(24, stage.clientWidth - 20));
      c.y = clamp(c.y, 30, Math.max(34, stage.clientHeight - 20));
      c.el.style.transform = `translate3d(${c.x - 23}px, ${c.y - 42}px, 0)`;
      const br = reduce ? 0 : 0.5 + 0.5 * Math.sin(t * ((Math.PI * 2) / 1.9) + c.phase);
      const sx = 1 + (0.978 - 1) * br;
      const sy = 1 + (1.032 - 1) * br;
      c.wob.style.transform = `rotate(${wobA.toFixed(2)}deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)}) scaleX(${c.flip})`;
      c.el.style.zIndex = String(Math.round(c.y) + 2);
      /* 这只鸡在干嘛：正在办跨页差事 → 头顶一个跳动的小点（Codex Pets 那一课：
         宠物是状态指示器，不是装饰。以前「被派去办事了」只写在账本里，画面上看不见。
         注：礼物不是状态 —— redeemGifts 会当场结算掉，所以只标「办事中」。） */
      c.el.classList.toggle('is-busy', !!(c.rec && c.rec.task));
    }

    function peck(c) {
      c.inn.classList.remove('is-peck');
      void c.inn.offsetWidth;
      c.inn.classList.add('is-peck');
      c.timers.push(window.setTimeout(() => c.inn.classList.remove('is-peck'), 1050));
    }
    function poseFlash(c, kind) {
      if (!c || !c.inn || reduce) return;
      const cls = kind === 'crow' ? 'is-crow' : 'is-tilt';
      const ms = kind === 'crow' ? 1350 : 1600; // stage-cut ACT_MS
      c.inn.classList.remove('is-tilt', 'is-crow');
      void c.inn.offsetWidth;
      c.inn.classList.add(cls);
      c.timers.push(window.setTimeout(() => c.inn.classList.remove(cls), ms));
    }
    function nearestChick(x, y, maxD) {
      let best = null, bd = maxD;
      for (const c of flock) {
        if (!c || c.dead || c.mode === 'leave') continue;
        const d = Math.hypot(c.x - x, c.y - y);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    }

    function kill(c) {
      c.dead = true;
      while (c.timers.length) window.clearTimeout(c.timers.pop());
      c.el.remove();
    }

    function trimFlock() {
      /* 台上最多 MAX_PAGE 只：超了就让最老的几只「装篮」（淡出退场，账还在）。
         以前一次只让一只走 —— 一次召回十几只时台上会挤爆（超过同屏上限），
         而且「装篮」那一行的数会跟着算错。改成循环到不超为止。
         淡出而不是慢慢走出屏：走一屏要十几秒（散场那栏是同一个道理），
         那段时间台上比上限多几只，面板上的「装篮」数跟画面对不上。 */
      const active = flock.filter((c) => c.mode !== 'leave' && !c.dead);
      for (let i = 0; i < active.length - MAX_PAGE; i += 1) {
        const old = active[i];
        old.mode = 'leave';
        old.fadeOut = true;
        old.el.classList.add('is-fade');
        old.timers.push(window.setTimeout(() => kill(old), 750));
      }
    }

    /* 点小鸡：冒气泡 + 品种音 */
    const LINES = pack.lines;
    const RARE_LINES = pack.rareLines || {};

    /* ===== 鸡名：值有两种形态 ——
       老档是纯字符串（'花花'），新的是 { n: '花花', at: 时间戳 }。
       为什么加时间戳：两个标签页同时给同一只鸡改名时，
       「本地优先」会让两边各写各的、落盘来回顶 ——
       玩家刚起的名会被另一个标签页的一次心跳冲掉，刷新就变回旧名（真丢数据）。
       带时间戳之后：同名时谁新听谁的，两边最终收敛到同一个名字。 */
    function nameVal(v) { return (v && typeof v === 'object') ? (v.n || '') : (v || ''); }
    function nameTs(v) { return (v && typeof v === 'object') ? (Number(v.at) || 0) : 0; }
    function nameOf(id) { return nameVal(state.names && state.names[id]); }
    function setName(id, n) {
      state.names = state.names || {};
      state.names[id] = { n, at: Date.now() };
    }

    function nameChick(c) {
      const inp = document.createElement('input');
      inp.className = 'farm-rename';
      inp.maxLength = 8;
      inp.placeholder = '给它起个名字';
      inp.value = nameOf(c.id);
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
            setName(c.id, v);
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
    /* ===== 点鸡弹小菜单（2026-11-04，抄 VPet 的 ToolBar / Shimeji 的右键菜单）=====
       原来点鸡 = 它说一句话，一句话就结束了，**没有第二次交互的入口**。
       现在点一下：先照旧说一句话（不破坏「点小鸡听它说话」这个老习惯），
       同时在旁边弹一个小菜单 —— 一次点击给出多个可能。
       菜单项跟着**状态多维**走：心情/饱腹/清洁各有一项能立刻改善它，
       不用去猜「摆食盆还是添水」（规矩：装饰要么承载信息，要么不做）。
       菜单是**临时气泡**，不是常驻面板 —— 成熟游戏都不长期飘着名字。 */
    let chickMenu = null;
    function closeChickMenu() {
      if (!chickMenu) return;
      const m = chickMenu; chickMenu = null;
      if (m.el) m.el.remove();
      window.removeEventListener('pointerdown', m.onAway, true);
      window.removeEventListener('keydown', m.onKey, true);
    }
    function openChickMenu(c) {
      closeChickMenu();
      const el = document.createElement('div');
      el.className = 'farm-cmenu';
      el.setAttribute('role', 'menu');
      el.setAttribute('aria-label', (c.breed && c.breed.name ? c.breed.name : '小鸡') + ' 的菜单');
      /* 三轴现状写在菜单顶上：玩家点进来就能看见「它现在缺什么」 */
      const m = Math.round(chickMood(c)), f = Math.round(chickFull(c)), k = Math.round(chickClean(c));
      const name = nameOf(c.id) || (c.breed && c.breed.name) || '小鸡';
      let html = '<div class="farm-cmenu-head">' + name + '</div>';
      html += '<div class="farm-cmenu-vitals">'
        + '<span title="心情">心 ' + m + '</span>'
        + '<span title="饱腹（吃米回）">饱 ' + f + '</span>'
        + '<span title="清洁（添水回）">洁 ' + k + '</span>'
        + '</div>';
      /* 菜单项：每项都对应一个**立刻见效**的动作 */
      const items = [
        { id: 'talk', label: '摸摸头', act: () => poke(c) },
        { id: 'feed', label: '喂一口', act: () => feedChick(c) },
        { id: 'wash', label: '添点水', act: () => washChick(c) },
        { id: 'info', label: '查状态', act: () => showChickInfo(c) },
      ];
      /* 鸡场快讯：玩家可以主动打听（冷却中就灰掉，但仍然看得见这条路） */
      if (evCfg().hasAny) {
        const ns = newsMenuState();
        items.push({ id: 'news', label: ns.label, disabled: ns.disabled, act: () => askNews(c) });
      }
      /* 豪华成鸡：成鸡 + 三轴都达标才能「加冕」（条件在 pack.json 的 lux.unlock）。
         没条件时这一项显示为「还没到时候」（灰掉但仍可见 → 玩家知道有这条路）。 */
      if (pack.lux && pack.lux.base) {
        if (c.lux) {
          items.push({ id: 'unlux', label: '还原', act: () => {
            applyLux(c, false);
            bubble(c.x, c.y, '还是原来那只～');
            save(); refreshHUD();
          } });
        } else {
          const ready = luxUnlocked(c);
          items.push({ id: 'lux', label: ready ? '加冕' : '还没到时候', disabled: !ready, act: () => {
            if (!luxUnlocked(c)) { bubble(c.x, c.y, '再把我照顾好一点（心·饱·洁都满格）'); return; }
            applyLux(c, true);
            bubble(c.x, c.y, '加冕！我成豪华版了～');
            save(); refreshHUD();
          } });
        }
      }
      for (const it of items) {
        html += '<button type="button" class="farm-cmenu-btn' + (it.disabled ? ' is-off' : '') + '" role="menuitem" data-act="' + it.id + '"'
          + (it.disabled ? ' disabled aria-disabled="true"' : '') + '>' + it.label + '</button>';
      }
      el.innerHTML = html;
      /* 定位：贴着鸡的**下方偏右**。
         为什么放下面：点鸡时鸡头上方会冒一个气泡（品种台词 + 成长进度），
         菜单放右上会压住气泡的右半边（看着像字被挡了）。
         气泡在上、菜单在下，互不重叠；菜单也不挡鸡本身。
         超出屏幕就翻边（高度按实际渲染量，别拿估值糊弄）。 */
      const bw = 132;
      layer.appendChild(el);
      const bh = Math.max(120, el.offsetHeight || 132);
      let left = c.x + 30, top = c.y + 4;
      if (left + bw > stage.clientWidth - 6) left = Math.max(6, c.x - 30 - bw);
      if (top + bh > stage.clientHeight - 6) top = Math.max(6, c.y - 4 - bh);
      if (top < 6) top = 6;
      el.style.left = Math.round(left) + 'px';
      el.style.top = Math.round(top) + 'px';
      el.addEventListener('pointerdown', (e) => e.stopPropagation());  // 点菜单别下蛋
      el.addEventListener('click', (e) => {
        const b = e.target.closest ? e.target.closest('.farm-cmenu-btn') : null;
        if (!b) return;
        e.stopPropagation();
        const it = items.find((x) => x.id === b.dataset.act);
        closeChickMenu();
        if (it) it.act();
      });
      const onAway = (e) => {
        if (el.contains(e.target)) return;
        closeChickMenu();
      };
      const onKey = (e) => { if (e.key === 'Escape') closeChickMenu(); };
      window.setTimeout(() => {
        window.addEventListener('pointerdown', onAway, true);
        window.addEventListener('keydown', onKey, true);
      }, 0);
      chickMenu = { el, onAway, onKey };
    }
    /* 菜单动作：喂一口（饱腹）、添点水（清洁）—— 都只作用于这一只鸡 */
    function feedChick(c) {
      addFull(c, FULL_EAT);
      addMood(c, Math.round(MOOD_EAT / 2));
      addGrowth(c, STAGE_BOOST.eat);
      c.eatCool = 1.2;
      c.lastSeen = Date.now();
      bubble(c.x, c.y, '好好吃～');
      play((t) => cluck(t, c.breed.f * rand(0.97, 1.03), 0.13));
      save(); refreshHUD();
    }
    function washChick(c) {
      addClean(c, CLEAN_WATER);
      addMood(c, Math.round(MOOD_WATER / 2));
      addGrowth(c, STAGE_BOOST.water);
      c.lastSeen = Date.now();
      bubble(c.x, c.y, '洗得香喷喷～');
      play((t) => cluck(t, c.breed.f * rand(1.02, 1.06), 0.11));
      save(); refreshHUD();
    }
    /* 查状态：把三轴 + 成长进度讲清楚（数值要看得见，规矩 3） */
    function showChickInfo(c) {
      const m = Math.round(chickMood(c)), f = Math.round(chickFull(c)), k = Math.round(chickClean(c));
      const g = growthText(c);
      let tip = '心 ' + m + ' · 饱 ' + f + ' · 洁 ' + k;
      if (f < 25) tip += '\n我饿了，摆个食盆吧';
      else if (k < CLEAN_LOW) tip += '\n我脏了，添点水吧';
      else if (m < MOOD_LOW) tip += '\n我有点蔫，陪我说说话';
      if (g) tip += '\n' + g;
      bubble(c.x, c.y, tip, 3200);
    }
    function poke(c) {
      if (!reduce) {
        c.inn.classList.remove('is-hop');
        void c.inn.offsetWidth;
        c.inn.classList.add('is-hop');
        c.timers.push(window.setTimeout(() => c.inn.classList.remove('is-hop'), 520));
      }
      const line = RARE_LINES[c.breed.id] && Math.random() < 0.7 ? RARE_LINES[c.breed.id] : LINES[Math.floor(Math.random() * LINES.length)];
      /* 第二行报成长进度（没长大才有话说；成鸡了就说长大了） */
      const g = growthText(c);
      bubble(c.x, c.y, g ? `${line.replace('{E}', String(state.eggs))}\n${g}` : line.replace('{E}', String(state.eggs)), g ? 2600 : 0);
      addMood(c, MOOD_TALK); // 跟它说句话，它就高兴一点
      addGrowth(c, STAGE_BOOST.talk); // 说话也算照顾，能催大一点
      c.lastSeen = Date.now();
      /* poke = 品种音，发声处浮起视觉音符 */
      play((t) => {
        cluck(t, c.breed.f * rand(0.97, 1.03), 0.15);
        noteFloat(c.x, c.y - 50, toneOf(c.breed), c);
      });
    }

    /* ===== 模块四·二：总线命令的落点（gift / goto / map） ===== */
    let lastPoint = null;
    /* 鼠标在**舞台坐标系**里的位置（ChaseMouse 用）。
       lastPoint 记的是 client 坐标，跟鸡的坐标（舞台相对）不是一个坐标系 —— 别混用。
       stage 是 inset:0 的整页层，所以这里换算基本等于 client 坐标，
       但仍然按 getBoundingClientRect 算，将来舞台不铺满整页也不会错。 */
    let mouseStage = { x: -1, y: -1, on: false };
    function trackMouseStage(e) {
      const sr = stage.getBoundingClientRect();
      mouseStage.x = e.clientX - sr.left;
      mouseStage.y = e.clientY - sr.top;
      mouseStage.on = mouseStage.x >= 0 && mouseStage.y >= 0
        && mouseStage.x <= stage.clientWidth && mouseStage.y <= stage.clientHeight;
    }

    function giftEgg() {
      /* 管家送蛋：走完整孵化流程，品种概率不动（稀缺性守恒，方案 §三.2） */
      const x = lastPoint ? clamp(lastPoint.x, 30, stage.clientWidth - 30) : stage.clientWidth / 2;
      const y = lastPoint ? clamp(lastPoint.y, 40, stage.clientHeight - 50) : stage.clientHeight * 0.55;
      layEgg(Math.round(x), Math.round(y));
    }

    function sendAway(target) {
      if (!PAGES.includes(target) || target === HERE) return;
      const gone = state.chickens.filter((r) => r.page === HERE && !r.stowed).slice(0, 3); // 「放几只」：一次至多 3 只
      if (!gone.length) { emitSay('眼下本页一只可放的都没有。先下几颗蛋吧。'); return; }
      for (const r of gone) sendOneAway(r, target, TASK_MS);
      save(); refreshHUD(); emitState();
      bubble(stage.clientWidth / 2, stage.clientHeight * 0.3, `去 ${PAGE_NAMES[target]} 的，走好。`);
    }
    /* 把一只鸡派去别的页：领差事 → 办完带礼物回来 → 自己回来。
       玩家手动放（sendAway）和鸡自己出门逛（checkWander）共用这一条路 ——
       差别只在「谁决定的」，机制不重复造。 */
    function sendOneAway(r, target, ms) {
      r.page = target;
      r.pos = [rand(0.3, 0.7), rand(0.4, 0.8)];
      r.lastSeen = Date.now();
      r.task = { due: Date.now() + (ms || TASK_MS), from: HERE };   // from = 它从哪来，回哪去
      const dom = flock.find((c) => c.id === r.id && !c.dead && c.mode !== 'leave');
      if (dom) { // 账面先转移，画面上走出屏（目标页下次载入时恢复）
        dom.mode = 'leave';
        dom.tx = dom.x < stage.clientWidth / 2 ? -80 : stage.clientWidth + 80;
      }
      return dom || null;
    }
    /* ===== 鸡自己决定出门逛（2026-11-05）=====
       原来跨页串门只有两个入口：玩家手动放、管家派 —— 都是「外面叫它走」。
       现在多一个：**鸡自己想出去看看**。它自己走、办完自己回来还带礼物，
       页面因此有了「活着」的感觉（不必盯着，鸡场也会自己有点事发生）。
       参数全在 pack.json 的 wander 段：enabled / intervalMin / maxOut / awayMin / awayMax。 */
    function wanderCfg() {
      const W = WANDER_CFG || {};
      const iv = Array.isArray(W.intervalMin) ? W.intervalMin : [8, 20];
      return {
        enabled: W.enabled !== false && Object.keys(W).length > 0,
        min: Math.max(1, Number(iv[0]) || 8) * 60000,
        max: Math.max(2, Number(iv[1]) || Number(iv[0]) || 20) * 60000,
        maxOut: W.maxOut == null ? 2 : Math.max(0, Number(W.maxOut) || 0),
        awayMin: Math.max(1, Number(W.awayMin) || 3) * 60000,
        awayMax: Math.max(2, Number(W.awayMax) || Number(W.awayMin) || 8) * 60000,
      };
    }
    function checkWander() {
      const W = wanderCfg();
      if (!W.enabled) return;
      const now = Date.now();
      const last = Number(state.wander.lastAt) || 0;
      /* 第一次：只记下起点，别一开鸡场就立刻走一只（像出了故障） */
      if (!last) { state.wander.lastAt = now; save(); return; }
      if (now - last < W.min) return;
      /* 在外面的（去别的页办事的）别太多 */
      const out = state.chickens.filter((r) => r.page !== HERE && !r.stowed && r.task).length;
      if (out >= W.maxOut) return;
      const mine = state.chickens.filter((r) => r.page === HERE && !r.stowed);
      if (!mine.length) return;
      const targets = PAGES.filter((p) => p !== HERE);
      if (!targets.length) return;
      const r = mine[(Math.random() * mine.length) | 0];
      const target = targets[(Math.random() * targets.length) | 0];
      state.wander.lastAt = now;
      const dom = sendOneAway(r, target, rand(W.awayMin, W.awayMax));
      /* 走得要有交代：玩家得看见「它自己出去了」，不然像是鸡凭空消失 */
      if (dom) bubble(dom.x, dom.y, `我自己去${PAGE_NAMES[target]}看看～`);
      save(); refreshHUD(); emitState();
    }

    /* ===== 整理台：散场（鸡回窝）/ 召回（窝里的放回场上）=====
       终树要的是「一键清屏」：场上一次清空，但**图鉴和成长记录全留**。
       所以鸡不是被删，是被「收回窝里」（r.stowed = 1）：
         - 记录、成长阶段、三轴状态全在账本上 → 一样保留、一样继续走时间；
         - 图鉴（dex）不动；
         - 窝里的鸡不上任何页面；召回时再放回场上 —— 可能已经长大了
           （散场期间它们在长，这是「散场」的正反馈，不是惩罚）。
       地上的蛋不动：蛋是玩家的资产，清掉是惩罚（见 farm-features 的三轴纪律）。
       不可逆的只有「重开鸡场」（手册里那个，两步确认）。 */
    function stowAll() {
      const mine = state.chickens.filter((r) => r.page === HERE && !r.stowed);
      if (!mine.length) { emitSay('本页没有鸡可收。'); return; }
      const now = Date.now();
      for (const r of mine) { r.stowed = 1; r.stowedAt = now; }
      /* 画面上让它们退场：**淡出 + 移除**，不是慢慢走出屏 ——
         「清屏」要的是立刻干净，走一屏要十几秒，那不叫清屏。 */
      for (const c of flock) {
        if (!c || c.dead) continue;
        c.mode = 'wait'; c.wait = 0.8;    // 别再乱走，站着淡出
        c.el.classList.add('is-fade');
        c.timers.push(window.setTimeout(() => kill(c), 750));
      }
      save(); refreshHUD(); emitState();
      bubble(stage.clientWidth / 2, stage.clientHeight * 0.3,
        `${mine.length} 只回窝了 —— 它们还在长大，随时放回来。`);
    }
    function unstowAll() {
      const list = state.chickens.filter((r) => r.stowed);
      if (!list.length) { emitSay('窝里没有鸡。'); return; }
      const now = Date.now();
      for (const r of list) {
        r.stowed = 0; r.stowedAt = now; r.page = HERE;
        r.pos = [rand(0.2, 0.8), rand(0.45, 0.85)];
        placeOne(r);
      }
      trimFlock();   // 超上限的自动装篮（账还在，和以前一样）
      save(); refreshHUD(); emitState();
      bubble(stage.clientWidth / 2, stage.clientHeight * 0.3,
        `${list.length} 只回场了 —— 窝里空了。`);
    }

    /* ===== 鸡场地图：一张真的地图 =====
       画法：纸底 + 手绘虚线边框 → 河 → 路 → 桥 → 树 → 地块 → 圈 → 地标 → 地名 → 数量角标。
       地点认路由：PAGE_HREF[id] 有 → 可点；没有 → 灰掉、点不动（但仍然看得见）。
       数量角标 = 这一页几只鸡（数值实时可见，规矩同 HUD）。 */
    const SVGNS = 'http://www.w3.org/2000/svg';
    function add(p, tag, attrs) {
      const e = document.createElementNS(SVGNS, tag);
      if (attrs) for (const k in attrs) e.setAttribute(k, String(attrs[k]));
      p.appendChild(e);
      return e;
    }
    /* 地标剪影：一地一套扁平图形，墨色 2px 轮廓 + 色块之间留白（art-style.md §3.4） */
    const MAP_GLYPHS = {
      /* 鸡舍：纸身 + 橙顶 + 小门 */
      coop(g) {
        add(g, 'rect', { x: -9, y: -1, width: 18, height: 12, fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linejoin': 'round' });
        add(g, 'polygon', { points: '-11,-1 0,-12 11,-1', fill: 'var(--orange)', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linejoin': 'round' });
        add(g, 'rect', { x: -3, y: 5, width: 6, height: 6, fill: 'var(--ink)' });
      },
      /* 谷仓：橙身 + 纸顶 + 大门 */
      barn(g) {
        add(g, 'rect', { x: -11, y: -2, width: 22, height: 14, fill: 'var(--orange)', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linejoin': 'round' });
        add(g, 'polygon', { points: '-14,-2 0,-13 14,-2', fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linejoin': 'round' });
        add(g, 'rect', { x: -5, y: 2, width: 10, height: 10, fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 2 });
      },
      /* 磨坊：石磨盘 + 四根辐条 + 推杆（小尺寸也得一眼认出来，别画风车叶子那种碎图形） */
      mill(g) {
        add(g, 'circle', { cx: 0, cy: 0, r: 10, fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 2 });
        add(g, 'line', { x1: -7, y1: 0, x2: 7, y2: 0, stroke: 'var(--ink)', 'stroke-width': 1.6 });
        add(g, 'line', { x1: 0, y1: -7, x2: 0, y2: 7, stroke: 'var(--ink)', 'stroke-width': 1.6 });
        add(g, 'circle', { cx: 0, cy: 0, r: 2.4, fill: 'var(--orange)', stroke: 'var(--ink)', 'stroke-width': 1.4 });
        add(g, 'line', { x1: 7, y1: -1, x2: 13, y2: -9, stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linecap': 'round' });
      },
      /* 晒谷场：一束麦穗（别在方框里点黄点 —— 那会被看成一盒鸡蛋；
   麦穗跟场上四件道具、跟别的地标都不撞脸） */
      yard(g) {
        [[-7, -6, -25], [0, -9, 0], [7, -6, 25]].forEach(([x, y, rot]) => {
          add(g, 'line', { x1: 0, y1: 10, x2: x, y2: y, stroke: 'var(--ink)', 'stroke-width': 1.6, 'stroke-linecap': 'round' });
          const cx = x * 1.08;
          const cy = y - 3.4;
          add(g, 'ellipse', { cx, cy, rx: 1.9, ry: 4.4, fill: 'var(--yellow)', stroke: 'var(--ink)', 'stroke-width': 1.3, transform: `rotate(${rot} ${cx} ${cy})` });
        });
        add(g, 'rect', { x: -3.4, y: 6.4, width: 6.8, height: 2.6, rx: 1, fill: 'var(--orange)', stroke: 'var(--ink)', 'stroke-width': 1.3 });
      },
      /* 村口：两根橙柱 + 横梁 + 小木牌 */
      gate(g) {
        add(g, 'rect', { x: -9, y: -7, width: 3.5, height: 19, fill: 'var(--orange)', stroke: 'var(--ink)', 'stroke-width': 1.8 });
        add(g, 'rect', { x: 5.5, y: -7, width: 3.5, height: 19, fill: 'var(--orange)', stroke: 'var(--ink)', 'stroke-width': 1.8 });
        add(g, 'rect', { x: -12, y: -10, width: 24, height: 4, fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-linejoin': 'round' });
        add(g, 'rect', { x: -4, y: -3, width: 8, height: 7, fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 1.6 });
      },
    };

    /* ===== 地图的四件配套（2026-11-05 夜）=====
       ① 鸡在地图上动：每块地按该页鸡数画小鸡，在院里走来走去（地图是活的，不是摆件）
       ② 悬停地块高亮：草地描边变橙、手绘虚线圈变实线（纯 CSS，不改引擎逻辑）
       ③ 手机端可放大：视口 + 放大/缩小/复位按钮 + 拖动 + 双指捏合
       ④ 作品上图：站侧推来的作品摆在谷仓边的架子上，点一下直接进那个作品 */
    let mapBirds = [];                     // 地图上走动的小鸡
    let mapView = { k: 1, x: 0, y: 0 };    // 缩放 / 平移（px）
    let mapMoved = false;                  // 刚拖过 → 别把这一下点击当成跳转
    let mapViewEl = null;                  // 当前地图视口（每次开地图换一个新元素）

    /* 地图上的小鸡：头朝右的一只黄小鸡（线比场上细，地图比场上小） */
    function mapBirdShape(g) {
      add(g, 'ellipse', { cx: -1.4, cy: 0, rx: 3.4, ry: 2.6, fill: 'var(--yellow)', stroke: 'var(--ink)', 'stroke-width': 1 });
      add(g, 'circle', { cx: 0.9, cy: -1.8, r: 2, fill: 'var(--yellow)', stroke: 'var(--ink)', 'stroke-width': 1 });
      add(g, 'path', { d: 'M2.8,-1.9 L4.9,-1.2 L2.8,-0.7 Z', fill: 'var(--orange)', stroke: 'var(--ink)', 'stroke-width': 0.8, 'stroke-linejoin': 'round' });
      add(g, 'ellipse', { cx: 0.3, cy: -3.7, rx: 1.2, ry: 0.8, fill: 'var(--orange)', stroke: 'var(--ink)', 'stroke-width': 0.8 });
      add(g, 'circle', { cx: 1.8, cy: -2.3, r: 0.45, fill: 'var(--ink)' });
    }

    /* ④ 作品架：works 这类地方的旁边摆一个架子，架子上是站侧推来的作品缩略图。
       内容在站侧（作品天天在变），引擎只管怎么摆、怎么点。 */
    function drawMapShelves(svg, cfg) {
      const works = contentItems.filter((it) => it && it.kind === 'work');
      if (!works.length) return;
      Object.keys(cfg.places || {}).forEach((id) => {
        const p = cfg.places[id];
        const sh = p && p.shelf;
        if (!sh) return;
        const mine = works.filter((w) => (w.place || id) === id);
        if (!mine.length) return;
        const n = Math.min(mine.length, sh.n || 4);
        const cw = sh.w || 12, ch = sh.h || 9, gap = sh.gap || 3;
        const total = n * cw + (n - 1) * gap;
        const at = sh.at || [p.at[0], p.at[1] + 26];
        const x0 = at[0] - total / 2;
        const y0 = at[1];
        const g = add(svg, 'g', { class: 'mp-shelf' });
        /* 架子：一条木板 + 两条腿 */
        add(g, 'rect', { x: x0 - 2.6, y: y0 + ch + 1.2, width: total + 5.2, height: 2.4, rx: 1, fill: 'var(--orange)', stroke: 'var(--ink)', 'stroke-width': 1.4 });
        add(g, 'rect', { x: x0 - 0.6, y: y0 + ch + 3.4, width: 1.6, height: 3.4, fill: 'var(--ink)' });
        add(g, 'rect', { x: x0 + total - 1, y: y0 + ch + 3.4, width: 1.6, height: 3.4, fill: 'var(--ink)' });
        mine.slice(0, n).forEach((w, i) => {
          const x = x0 + i * (cw + gap);
          const a = add(g, 'a', { href: w.href || '#', class: 'mp-cover' });
          const ttl = add(a, 'title', {});
          ttl.textContent = w.title || '';
          add(a, 'rect', { x, y: y0, width: cw, height: ch, fill: 'var(--white)', stroke: 'var(--ink)', 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
          if (w.cover) {
            add(a, 'image', { href: w.cover, x: x + 1.2, y: y0 + 1.2, width: cw - 2.4, height: ch - 2.4, preserveAspectRatio: 'xMidYMid slice' });
          } else {
            add(a, 'rect', { x: x + 1.2, y: y0 + 1.2, width: cw - 2.4, height: ch - 2.4, fill: 'var(--paper)' });
            const t = add(a, 'text', { x: x + cw / 2, y: y0 + ch / 2 + 2.4, class: 'mp-ch' });
            t.textContent = (w.title || '?').slice(0, 1);
          }
        });
      });
    }

    /* ① 地图上的小鸡：在院子里绕着走（跟着主循环跑，面板关着就不动） */
    function mapTick(t) {
      if (!mapBirds.length) return;
      const panel = $('farm-map');
      if (!panel || panel.hidden) return;
      for (const b of mapBirds) {
        const a = b.phase + t * b.speed;
        const x = b.cx + Math.cos(a) * b.rx;
        const y = b.cy + Math.sin(a * 1.6) * b.ry;
        const dir = Math.cos(a) < 0 ? -1 : 1;
        const bob = Math.sin(t * 7 + b.phase * 3) * 0.35;
        b.el.setAttribute('transform', `translate(${x.toFixed(2)} ${(y + bob).toFixed(2)}) scale(${dir} 1)`);
      }
    }

    /* ③ 缩放 / 平移：CSS transform 作用在 svg 上，视口负责裁切 */
    function mapApply() {
      const host = $('farm-mapart');
      const svg = host && host.querySelector('svg');
      if (!svg) return;
      svg.style.transform = `translate(${mapView.x.toFixed(1)}px, ${mapView.y.toFixed(1)}px) scale(${mapView.k.toFixed(3)})`;
    }
    function mapClamp() {
      const host = $('farm-mapart');
      const view = host && host.querySelector('.mp-view');
      if (!view) return;
      const w = view.clientWidth || 1;
      const h = view.clientHeight || 1;
      const k = mapView.k;
      if (k <= 1.001) { mapView.x = 0; mapView.y = 0; return; }
      mapView.x = Math.min(6, Math.max(w * (1 - k) - 6, mapView.x));
      mapView.y = Math.min(6, Math.max(h * (1 - k) - 6, mapView.y));
    }
    function mapZoomAt(factor, px, py) {
      const host = $('farm-mapart');
      const view = host && host.querySelector('.mp-view');
      if (!view) return;
      const k0 = mapView.k;
      const k1 = Math.min(4, Math.max(1, k0 * factor));
      if (Math.abs(k1 - k0) < 0.001) return;
      const r = view.getBoundingClientRect();
      const cx = px == null ? r.width / 2 : px;
      const cy = py == null ? r.height / 2 : py;
      mapView.x = cx - (cx - mapView.x) * (k1 / k0);
      mapView.y = cy - (cy - mapView.y) * (k1 / k0);
      mapView.k = k1;
      mapClamp();
      mapApply();
    }
    function mapReset() {
      mapView.k = 1; mapView.x = 0; mapView.y = 0;
      mapApply();
    }

    /* ③ 手势：滚轮缩放 + 拖动平移 + 双指捏合 + 双击放大。
       **不摆按钮** —— 地图上缩放全靠手势，UI 干干净净。
       坑：pointerdown 就 setPointerCapture 的话，click 的目标会变成视口 div，
       里面的 <a> 就不跳了 —— 所以**不抢指针**，改成拖动开始才接管，
       并且 pointermove/pointerup 挂在 window 上（拖出地图外也跟得住）。 */
    const mapPts = new Map();
    let mapDrag = null;
    let mapPinch = null;
    function mapPointerMove(e) {
      const view = mapViewEl;
      if (!view || !mapPts.has(e.pointerId)) return;
      mapPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mapPts.size >= 2 && mapPinch) {
        const [a, b] = [...mapPts.values()];
        const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
        const r = view.getBoundingClientRect();
        const k1 = Math.min(4, Math.max(1, mapPinch.k * (d / mapPinch.d)));
        const cx = (a.x + b.x) / 2 - r.left;
        const cy = (a.y + b.y) / 2 - r.top;
        mapView.x = cx - (cx - mapView.x) * (k1 / mapPinch.k);
        mapView.y = cy - (cy - mapView.y) * (k1 / mapPinch.k);
        mapView.k = k1;
        mapClamp(); mapApply(); mapMoved = true;
        return;
      }
      if (!mapDrag) return;
      const dx = e.clientX - mapDrag.x;
      const dy = e.clientY - mapDrag.y;
      if (!mapDrag.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) mapDrag.moved = true;
      if (!mapDrag.moved) return;
      mapView.x = mapDrag.vx + dx;
      mapView.y = mapDrag.vy + dy;
      mapClamp(); mapApply(); mapMoved = true;
    }
    function mapPointerEnd(e) {
      mapPts.delete(e.pointerId);
      if (mapPts.size < 2) mapPinch = null;
      if (mapPts.size === 0) mapDrag = null;
    }
    function mapWinInit() {
      if (window.__farmMapWinBound) return;
      window.__farmMapWinBound = true;
      window.addEventListener('pointermove', mapPointerMove);
      window.addEventListener('pointerup', mapPointerEnd);
      window.addEventListener('pointercancel', mapPointerEnd);
    }
    function mapBindView() {
      const host = $('farm-mapart');
      const view = host && host.querySelector('.mp-view');
      mapViewEl = view;
      mapWinInit();
      if (!view) return;
      view.addEventListener('pointerdown', (e) => {
        mapPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        mapMoved = false;
        if (mapPts.size >= 2) {
          const [a, b] = [...mapPts.values()];
          mapPinch = { d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), k: mapView.k };
          mapDrag = null;
        } else {
          mapDrag = { x: e.clientX, y: e.clientY, vx: mapView.x, vy: mapView.y, moved: false };
        }
      });
      /* 拖过之后别把这一下点击当成「点地方跳转」；
         双击 / 双指双击 = 放大（已经放大了就复位）—— 没有按钮，手势就是全部入口 */
      view.addEventListener('click', (e) => {
        if (mapMoved) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (e.detail >= 2) {
          e.preventDefault();
          e.stopPropagation();
          const r = view.getBoundingClientRect();
          if (mapView.k > 1.4) mapReset();
          else mapZoomAt(1.9, e.clientX - r.left, e.clientY - r.top);
        }
      }, true);
      /* 滚轮缩放：地图是浮层，滚过去就是在缩地图，不是滚页面 */
      view.addEventListener('wheel', (e) => {
        e.preventDefault();
        const r = view.getBoundingClientRect();
        mapZoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });
    }

    function renderMapArt(snap) {
      const host = $('farm-mapart');
      if (!host) return false;
      const cfg = MAP_CFG;
      if (!cfg || !cfg.places || !Object.keys(cfg.places).length) {
        host.innerHTML = '';
        host.hidden = true;
        mapBirds = [];
        return false;
      }
      host.hidden = false;
      host.innerHTML = '';
      mapBirds = [];
      /* 视口：地图装在里面，能放大平移（手机端看得清）；工具条放在地图下面 */
      const view = document.createElement('div');
      view.className = 'mp-view';
      view.id = 'farm-mapview';
      host.appendChild(view);
      const W = cfg.width || 360;
      const H = cfg.height || 250;
      const svg = add(view, 'svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.title || '鸡场地图' });
      /* 纸底 + 手绘虚线边框（像一张摊在桌上的地图） */
      add(svg, 'rect', { x: 3, y: 3, width: W - 6, height: H - 6, rx: 6, fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-dasharray': '7 5' });
      /* 河：白边垫底 + 蓝带（色块之间白色描边） */
      if (cfg.river) {
        const rw = cfg.riverW || 11;
        add(svg, 'path', { d: cfg.river, fill: 'none', stroke: 'var(--white)', 'stroke-width': rw + 5, 'stroke-linecap': 'round' });
        add(svg, 'path', { d: cfg.river, fill: 'none', stroke: 'var(--blue)', 'stroke-width': rw, 'stroke-linecap': 'round' });
      }
      /* 路：铅笔灰虚线（地形归地形，地标才是内容） */
      (cfg.roads || []).forEach((rd) => {
        const A = cfg.places[rd.a];
        const B = cfg.places[rd.b];
        if (!A || !B) return;
        const pts = [A.at].concat(rd.via || [], [B.at]).map((p) => p.join(',')).join(' ');
        add(svg, 'polyline', { points: pts, fill: 'none', stroke: 'var(--gray)', 'stroke-width': 1.6, 'stroke-dasharray': '5 4', 'stroke-linecap': 'round' });
      });
      /* 桥：压在河上的板 */
      (cfg.bridges || []).forEach((b) => {
        add(svg, 'rect', { x: b[0] - 10, y: b[1] - 2.6, width: 20, height: 5.2, rx: 1.2, fill: 'var(--orange)', stroke: 'var(--ink)', 'stroke-width': 1.6 });
      });
      /* 树 */
      (cfg.trees || []).forEach((t) => {
        add(svg, 'line', { x1: t[0], y1: t[1] + 2, x2: t[0], y2: t[1] + 7, stroke: 'var(--ink)', 'stroke-width': 1.8, 'stroke-linecap': 'round' });
        add(svg, 'circle', { cx: t[0], cy: t[1], r: 5, fill: 'var(--green)', stroke: 'var(--ink)', 'stroke-width': 1.6 });
      });
      /* 地块 */
      Object.keys(cfg.places).forEach((id) => {
        const p = cfg.places[id];
        const x = p.at[0];
        const y = p.at[1];
        const live = !!PAGE_HREF[id];
        const n = live ? (snap.pagesMap[id] | 0) : 0;
        const here = live && id === HERE;
        const g = add(svg, live ? 'a' : 'g', live
          ? { href: PAGE_HREF[id], class: 'mp-plot' }
          : { class: 'mp-plot is-off' });
        /* 悬停提示：地名 + 页面名 + 几只鸡 */
        const ttl = add(g, 'title', {});
        ttl.textContent = live
          ? `${p.name || PAGE_NAMES[id]}（${PAGE_NAMES[id]}）· ${n} 只 · 点过去看看`
          : `${p.name || id} · 还没通路`;
        /* 草地 */
        add(g, 'polygon', { class: 'mp-ground', points: (p.ground || []).map((q) => q.join(',')).join(' '), fill: live ? 'var(--green)' : 'var(--gray)', stroke: 'var(--ink)', 'stroke-width': 1.6, 'stroke-linejoin': 'round' });
        /* 手绘圈（虚线椭圆，art-style §3.4） */
        add(g, 'circle', {
          class: 'mp-ring',
          cx: x, cy: y - 4, r: 17, fill: 'none',
          stroke: here ? 'var(--orange)' : (live ? 'var(--ink)' : 'var(--gray)'),
          'stroke-width': here ? 2.6 : 2,
          'stroke-dasharray': here ? 'none' : '4 3',
        });
        /* 地标 */
        const gg = add(g, 'g', { transform: `translate(${x} ${y - 4})` });
        const gl = MAP_GLYPHS[p.glyph];
        if (gl) gl(gg);
        /* ① 这块地上有几只鸡，就画几只小鸡在院里走来走去（地图是活的，不是摆件） */
        const birds = live ? Math.min(n, 8) : 0;
        if (birds > 0) {
          const fg = add(g, 'g', { class: 'mp-flock' });
          for (let i = 0; i < birds; i += 1) {
            const b = add(fg, 'g', { class: 'mp-bird' });
            mapBirdShape(b);
            mapBirds.push({
              el: b,
              cx: x,
              cy: y + 4,
              /* 在院子前头绕着走（多在地标脚下，不压在地标身上），还在手绘圈里 */
              rx: 12.5 + (i % 3) * 1.6,
              ry: 4.5 + (i % 2) * 2,
              phase: i * 2.399 + (x % 9) * 0.37,
              speed: 0.22 + (i % 4) * 0.06,
            });
          }
        }
        /* 地名 */
        const nm = add(g, 'text', { x: x, y: y + 24, class: 'mp-name' });
        nm.textContent = p.name || PAGE_NAMES[id] || id;
        /* 数量角标：这页几只鸡 */
        if (live) {
          add(g, 'circle', { cx: x + 25, cy: y - 19, r: 8.5, fill: 'var(--card)', stroke: n > 0 ? 'var(--orange)' : 'var(--gray)', 'stroke-width': 2 });
          const bt = add(g, 'text', { x: x + 25, y: y - 15.6, class: 'mp-num' });
          bt.textContent = String(n);
        }
        /* 「你在这儿」的小旗 */
        if (here) {
          add(g, 'line', { x1: x - 15, y1: y - 21, x2: x - 15, y2: y - 32, stroke: 'var(--ink)', 'stroke-width': 1.8, 'stroke-linecap': 'round' });
          add(g, 'polygon', { class: 'mp-flag', points: `${x - 15},${y - 32} ${x - 5},${y - 28.5} ${x - 15},${y - 25}`, fill: 'var(--orange)', stroke: 'var(--ink)', 'stroke-width': 1.6, 'stroke-linejoin': 'round' });
        }
      });
      /* ④ 作品架：站侧推来的作品摆在谷仓边的架子上，点一下直接进那个作品 */
      drawMapShelves(svg, cfg);
      /* 罗盘：告诉人哪边是北 */
      const ccx = W - 34;
      const ccy = 26;
      add(svg, 'circle', { cx: ccx, cy: ccy, r: 11, fill: 'var(--card)', stroke: 'var(--ink)', 'stroke-width': 1.6 });
      add(svg, 'polygon', { points: `${ccx},${ccy - 8} ${ccx + 4},${ccy + 3} ${ccx},${ccy} ${ccx - 4},${ccy + 3}`, fill: 'var(--orange)', stroke: 'var(--ink)', 'stroke-width': 1.4, 'stroke-linejoin': 'round' });
      const nt = add(svg, 'text', { x: ccx, y: ccy - 14, class: 'mp-n' });
      nt.textContent = 'N';
      /* ③ 不摆按钮：缩放靠手势（滚轮 / 双指捏合 / 双击），地图干干净净 */
      const hint = document.createElement('p');
      hint.className = 'mp-hint';
      hint.textContent = '滚轮 · 双指可缩放，能拖着走';
      host.appendChild(hint);
      mapBindView();
      return true;
    }

    function openMap() {
      const snap = snapshot();
      /* 每次开地图都从头看（上次放大到哪儿跟这次无关） */
      mapView.k = 1; mapView.x = 0; mapView.y = 0;
      /* 地图（真的那张）。没有 map 段的老包 → 退回列表视图 */
      const useMap = renderMapArt(snap);
      const titleEl = $('farm-map-title');
      if (titleEl) titleEl.textContent = useMap
        ? (MAP_CFG.title || '鸡场地图')
        : '鸡场地图 · 一页一圈舍';
      const tipEl = $('farm-map-tip');
      if (tipEl) tipEl.textContent = useMap
        ? '橙圈是你现在这页。鸡在哪，账就在哪 —— 放去别的页的鸡，逛完自己回来，还带礼物。'
        : '鸡在哪，账就在哪。放去别的页的鸡，逛完自己回来，还带礼物。';
      /* 没有地图的时候才列页面行（地图上每个地方都有数了）。
         地图有了、但某个站页面还没画到地图上（站侧加了新页）→ 那个页面照样列一行，
         不能让它在地图上静默消失（规矩 12：看得见「还有这条路」）。 */
      const rowFor = (p) => {
        const n = snap.pagesMap[p] | 0;
        return `<a class="farm-maprow${p === HERE ? ' is-here' : ''}" href="${PAGE_HREF[p] || '/'}" aria-label="去${PAGE_NAMES[p]}看鸡"><span>${PAGE_NAMES[p]}</span><b>${n} 只</b></a>`;
      };
      const rows = useMap
        ? PAGES.filter((id) => !(MAP_CFG.places || {})[id]).map(rowFor).join('')
        : PAGES.map(rowFor).join('');
      /* 装篮 = 账上有、场上没有（超出本页上限被收起来的那些） */
      const onStage = flock.filter((c) => c && !c.dead && c.mode !== 'leave').length;
      const hereRec = state.chickens.filter((r) => r.page === HERE && !r.stowed).length;
      const basket = Math.max(0, hereRec - onStage);
      /* 操作行：散场 / 召回 / 倒蛋（有才显示，不占地方也不误导） */
      let acts = '';
      if ((snap.pagesMap[HERE] | 0) > 0) {
        acts += `<button type="button" class="farm-maprow is-act" data-farm-act="stow">`
          + `<span>散场 · 鸡全回窝里</span><b>${snap.pagesMap[HERE] | 0} 只</b></button>`;
      }
      if (snap.stowed > 0) {
        acts += `<button type="button" class="farm-maprow is-act" data-farm-act="unstow">`
          + `<span>窝里的放回场上</span><b>${snap.stowed} 只</b></button>`;
      }
      /* 倒蛋：篮子里攒的蛋能一次倒掉（篮子满了就不接新蛋，先倒掉腾地方） */
      const bk = (state.decos || []).find((v) => v.id === 'basket');
      const bkN = bk ? eggCount(bk) : 0;
      if (bkN > 0) {
        acts += `<button type="button" class="farm-maprow is-act" data-farm-act="dump">`
          + `<span>倒蛋 · 篮子里的全倒掉</span><b>${bkN} 颗</b></button>`;
      }
      $('farm-maprows').innerHTML = rows + acts +
        `<div class="farm-maprow"><span>装篮（只记数）</span><b>${basket} 只</b></div>` +
        (snap.stowed > 0 ? `<div class="farm-maprow"><span>窝里待命（只记数）</span><b>${snap.stowed} 只</b></div>` : '') +
        `<div class="farm-maprow"><span>累计出鸡</span><b>${snap.chickens} 只</b></div>`;
      $('farm-map').hidden = false;
    }

    /* 地图点击 = 普通跳转；先记「开」偏好，落地页 prefOn() 命中自动开鸡场 */
    $('farm-maprows').addEventListener('click', (e) => {
      if (!e.target || !e.target.closest) return;
      /* 整理台的两个动作：散场 / 召回（不走跳转） */
      const act = e.target.closest('button[data-farm-act]');
      if (act) {
        e.preventDefault();
        const kind = act.dataset.farmAct;
        if (kind === 'stow') stowAll();
        else if (kind === 'unstow') unstowAll();
        else if (kind === 'dump') dumpBasketEggs();
        openMap();          // 面板留在原地 → 当场看得到「窝里 N 只」变了
        return;
      }
      if (!e.target.closest('a.farm-maprow')) return;
      try { localStorage.setItem(ON_KEY, '1'); } catch { /* 隐私模式 */ }
    });

    /* 地图上点地方 = 跳到那一页（跟列表行同一套：先记「开」偏好，落地页自动开鸡场）
       作品架上的封面同理：点一下直接进那个作品 */
    $('farm-mapart').addEventListener('click', (e) => {
      if (!e.target || !e.target.closest) return;
      if (!e.target.closest('a.mp-plot, a.mp-cover')) return;
      try { localStorage.setItem(ON_KEY, '1'); } catch { /* 隐私模式 */ }
    });

    /* ===== 模块五：交互（指针、HUD、手册、音符开关） ===== */
    const elEggs = $('farm-n-eggs');
    const elChicks = $('farm-n-chicks');
    const elDex = $('farm-n-dex');
    const elMood = $('farm-n-mood');
    const elFull = $('farm-n-full');
    const elClean = $('farm-n-clean');
    const hint = $('farm-hint');

    function refreshHUD() {
      elEggs.textContent = String(state.eggs);
      elChicks.textContent = String(state.hatched);
      let found = 0;
      for (const b of BREEDS) if ((state.dex[b.id] | 0) > 0) found += 1;
      elDex.textContent = `${found}/${BREEDS.length}`;
      if (elMood) elMood.textContent = String(avgAxis(chickMood));
      if (elFull) elFull.textContent = String(avgAxis(chickFull));
      if (elClean) elClean.textContent = String(avgAxis(chickClean));
      const dexBtn = $('farm-btn-dexcard');
      if (dexBtn) dexBtn.hidden = found < BREEDS.length; // 集齐了才给图鉴卡
      renderBook();
      if (state.eggs >= 1) {
        hint.classList.add('is-off');
        try { localStorage.setItem('mujing-farm-hint-off', '1'); } catch (_) {}
      }
      try { if (localStorage.getItem('mujing-farm-hint-off') === '1') hint.classList.add('is-off'); } catch (_) {}
    }

    /* 图鉴选中：点格子选中一只（再点同一只取消）。没手动选过时，默认圈第一只已发现的。 */
    let pickedBreed = null;
    function currentPick() {
      if (pickedBreed && BREEDS.some((b) => b.id === pickedBreed)) return pickedBreed;
      const first = BREEDS.find((b) => (state.dex[b.id] | 0) > 0);
      return first ? first.id : '';
    }

    /* 手写圈 + 虚线引线：圈住当前这只，虚线引到卡片标题的胶带标签。
       画在 .farm-grid 这一层（pointer-events:none，不挡格子点击），纯内联 SVG，不引外部图片。 */
    function updateAnnot() {
      const grid = $('farm-bookgrid');
      if (!grid) return;
      const svg = grid.querySelector('.farm-annot');
      if (!svg) return;
      const id = currentPick();
      /* 不用 id 拼选择器（包里的 id 未必适合做选择器），直接遍历格子找 */
      let cell = null;
      for (const c of grid.querySelectorAll('.farm-cell')) {
        if (c.dataset.breed === id) { cell = c; break; }
      }
      const img = cell ? cell.querySelector('.farm-cellimg') : null;
      const tape = document.querySelector('#farm-book .farm-tape');
      if (!img || !tape) { svg.innerHTML = ''; return; }
      const gr = grid.getBoundingClientRect();
      if (!gr.width || !gr.height) return; // 手册没打开：等打开时再画
      const ir = img.getBoundingClientRect();
      const tr = tape.getBoundingClientRect();
      const cx = ir.left + ir.width / 2 - gr.left;
      const cy = ir.top + ir.height / 2 - gr.top;
      const rx = ir.width / 2 + 7;
      const ry = ir.height / 2 + 7;
      const tx = tr.right - gr.left;   // 引线终点：胶带标签右下角（在网格上方，ty 为负）
      const ty = tr.bottom - gr.top;
      const n = (v) => v.toFixed(1);
      svg.setAttribute('viewBox', '0 0 ' + n(gr.width) + ' ' + n(gr.height));
      svg.innerHTML =
        /* 手绘圈：椭圆 + 虚线 + 墨色描边，略歪一点像手画的 */
        '<ellipse cx="' + n(cx) + '" cy="' + n(cy) + '" rx="' + n(rx) + '" ry="' + n(ry) + '"'
        + ' fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="9 7" stroke-linecap="round"'
        + ' transform="rotate(-5 ' + n(cx) + ' ' + n(cy) + ')"/>'
        /* 虚线引线：从圈拉到胶带标签 */
        + '<path d="M ' + n(cx + rx * 0.72) + ' ' + n(cy - ry * 0.72)
        + ' C ' + n(cx + rx + 26) + ' ' + n(cy - ry - 26) + ', ' + n(tx - 36) + ' ' + n(ty + 20)
        + ', ' + n(tx - 2) + ' ' + n(ty + 3) + '" fill="none" stroke="currentColor"'
        + ' stroke-width="1.6" stroke-dasharray="5 5" stroke-linecap="round"/>';
    }

    function renderBook() {
      let html = '';
      for (const b of BREEDS) {
        const n = state.dex[b.id] | 0;
        const tag = b.rarity === 'rare' ? '<span class="farm-rar">稀有</span>' : b.rarity === 'legendary' ? '<span class="farm-rar farm-rar-l">传说</span>' : '';
        /* 盘上那一笔手绘色块：按稀有度取色（common 绿 / rare 蓝 / legendary 深红） */
        const tone = b.rarity === 'legendary' ? 'var(--red)' : b.rarity === 'rare' ? 'var(--blue)' : 'var(--green)';
        if (n > 0) {
          html += `<div class="farm-cell" data-breed="${b.id}" style="--tone:${tone}" role="button" tabindex="0" aria-label="${b.name}，已养 ${n} 只">`
            + `<div class="farm-cellimg">${chickVisual(b).outerHTML}</div>`
            + `<div class="farm-cellname">${b.name}</div>${tag}<div class="farm-cellct">已养 ×${n}</div></div>`;
        } else {
          html += `<div class="farm-cell" data-breed="${b.id}" style="--tone:${tone}" role="button" tabindex="0" aria-label="未发现的品种">`
            + `<div class="farm-cellimg">${chickSilhouette(b).outerHTML}</div>`
            + `<div class="farm-cellname">？？？</div>${tag}<div class="farm-cellct">未发现</div></div>`;
        }
      }
      html += '<svg class="farm-annot" aria-hidden="true" focusable="false"></svg>';
      const gridEl = $('farm-bookgrid');
      gridEl.innerHTML = html;
      /* innerHTML 注入会丢掉事件处理函数（格子的图是 outerHTML 序列化来的，
         onerror 是**属性**不是 attribute → 序列化时没了）→ 重新接一遍退路，
         不然图鉴里又是一地破图。 */
      for (const box of gridEl.querySelectorAll('.farm-cellimg .farm-chick-rig')) {
        wireRigFallback(box);
        wireExprProbe(box);
      }
      updateAnnot();
    }

    /* 点格子 = 选中（手写圈跟着走）。格子在 .farm-card 里，点它不会触发下蛋。 */
    const bookGrid = $('farm-bookgrid');
    if (bookGrid) {
      const pickCell = (e) => {
        const cell = e.target && e.target.closest ? e.target.closest('.farm-cell') : null;
        if (!cell || !cell.dataset.breed) return;
        pickedBreed = pickedBreed === cell.dataset.breed ? null : cell.dataset.breed;
        renderBook();
      };
      bookGrid.addEventListener('click', pickCell);
      bookGrid.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        pickCell(e);
        e.preventDefault();
      });
    }
    window.addEventListener('resize', updateAnnot);

    /* 指针：光标小鸡全站跟随（window pointermove）；点空白处下蛋（document 捕获）；
       链接、按钮、表单、对话框等交互元素正常用，不下蛋。 */
    const curEl = document.createElement('div');
    curEl.className = 'farm-cursor';
    curEl.setAttribute('aria-hidden', 'true');
    curEl.innerHTML = '<div class="farm-cursor-in"></div>';
    if (!reduce) stage.appendChild(curEl);
    const curIn = curEl.firstChild;
    /* 光标小鸡的长相（2026-11-04）：以前用的是 sprite.svg 里的扁平符号鸡 ——
       跟舞台上的鸡两套形象，全站最显眼的一只鸡反而最弱智。
       现在跟舞台一致，用丽丽的角色真图（品种全家福）。
       线上还没公开美术（/packs 会 404）→ 图加载失败就退回旧 SVG 符号，不留破图。 */
    {
      const breeds = pack.breeds || [];
      const cb = breeds.find((b) => b.id === 'universe01') || breeds[0];
      const layers = (cb && cb.rig && cb.rig.layers) || [];
      const one = cb && cb.rig && cb.rig.base && layers.length === 1 ? cb.rig.base + layers[0].file : '';
      const svgFallback = () => {
        curIn.innerHTML = '<svg viewBox="0 0 100 120" aria-hidden="true"><use href="#farm-sym-' + ((cb && cb.svg) || 'youji') + '"/></svg>';
      };
      if (!one) {
        svgFallback();
      } else {
        const img = document.createElement('img');
        img.className = 'farm-cursor-art';
        img.alt = '';
        img.decoding = 'async';
        img.onerror = svgFallback;
        img.src = one + (window.__coopVer ? '?v=' + window.__coopVer : '');
        curIn.appendChild(img);
      }
    }
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
      trackMouseStage(e);
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
    const EGG_SKIP = 'a,button,input,textarea,select,label,[role="button"],[contenteditable],.coopchat,.mimi-launch,.mimi-panel,.butter-box,.farm-ui,.farm-card,.farm-picker,[role="dialog"],[role="button"]'; /* .coopchat：Mimi 挂件根（launch+面板）；点她聊天不该下蛋 */
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
      rice: { id: 'rice', name: '米', kind: 'pile', tip: '米：撒谷粒，附近有瓷盘就落进盘里，鸡会走过来吃' },
      piano: { id: 'piano', name: '地琴', kind: 'piano', tip: '地琴：踩上去会响，鸡会跟过来' },
      plate: { id: 'plate', name: '瓷盘', kind: 'deco', tip: '瓷盘 · 食盆：撒的米会落进盘里，鸡会走过来吃' },
      basket: { id: 'basket', name: '竹篮', kind: 'deco', tip: '竹篮 · 蛋篓：下的蛋落进篮子攒着，点篮子能挑品种孵出来' },
      incubator: { id: 'incubator', name: '孵化窝', kind: 'deco', tip: '孵化窝 · 孵化器：下的蛋优先落进窝里，自己会孵（90 秒出壳），底下那条是进度' },
      water: { id: 'water', name: '水缸', kind: 'deco', tip: '水缸 · 水盆：点一下给鸡喝水，回一点心情' },
      /* 「收」不是摆件，是工具：点场上的器物，把它收回货架（存量跟着走）。 */
      pickup: { id: 'pickup', name: '收走', kind: 'tool', tip: '收走 · 收纳：点一下场上的器物，把它收回货架。篮子里的蛋、盘子里的米都留着，随时能再摆出来' },
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
        const prop = PROPS[b.dataset.prop];
        /* 图标用真图（和摆出来的道具同一张），取不到就退回 CSS 简形 */
        const ico = b.querySelector('.farm-ico');
        if (ico) {
          const art = decoArt(b.dataset.prop);
          ico.classList.toggle('is-art', !!art);
          ico.style.backgroundImage = art
            ? 'url("' + art.img + (window.__coopVer ? ('?' + window.__coopVer) : '') + '")'
            : '';
        }
        const locked = prop.kind !== 'tool' && !state.unlocked.includes(b.dataset.prop);
        b.dataset.locked = locked ? '1' : '0';
        b.title = locked ? (prop.name + '（还没解锁：多逛逛站就会开）') : (prop.tip || prop.name);
        if (locked) { b.classList.remove('is-armed'); b.setAttribute('aria-pressed', 'false'); return; }
        const on = b.dataset.prop === armedPropId;
        b.classList.toggle('is-armed', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      const tog = $('farm-shelf-toggle');
      if (tog) {
        tog.classList.toggle('is-armed', !!armedPropId);
        const label = (armedPropId && PROPS[armedPropId]) ? PROPS[armedPropId].name : '道具';
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
      ghostEl.classList.remove('is-pick');
      const prop = PROPS[armedPropId];
      if (!prop) { ghostEl.hidden = true; return; }
      ghostEl.hidden = false;
      if (lastPoint) ghostEl.style.transform = `translate(${lastPoint.x}px, ${lastPoint.y}px)`;
      /* 「收」工具：画一个虚线框（提示「点这里能收」） */
      if (prop.kind === 'tool') { ghostEl.classList.add('is-pick'); return; }
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
      /* 「收」工具：点场上的器物 → 收回货架（不是往地上摆） */
      if (prop.kind === 'tool') { pickUpAt(clientX, clientY); return; }
      if (prop.kind === 'pile') { scatterGrain(clientX, clientY); return; }
      if (prop.kind === 'piano') {
        placePiano(clientX, clientY);
        if (floorEl && !floorEl.hidden) selectTool('piano');
        return;
      }
      if (prop.kind === 'deco') {
        placeDeco(prop.id, clientX, clientY);
        selectTool(prop.id); // 摆完收起（和地琴一致）；再摆回货架点一次
      }
    }

    /* ===== 布景道具（瓷盘 / 竹篮）=====
       摆出来的东西：位置按舞台比例记在 state.decos（刷新还在），可直接拖动。
       引擎只负责摆壳与定位；外观归站侧（.farm-deco[data-deco=...]），
       引擎不画 SIMPY LIFE 画风——那是美术的事，不是玩法的事。 */
    /* 显示尺寸 = 素材的一半（素材都是 2x）。
       plate 是 3/4 视角的圆瓷盘（300×114 → 150×57）；basket / water 本来就是 2.5D，
       三者同相机同一层高度感。 */
    const DECO_SIZE = { plate: [150, 57], basket: [128, 80], incubator: [120, 75], water: [120, 96] };
    /* 篮子容量上限：攒蛋是"换品种"的额度，不是仓库。满了就不再接蛋，蛋落地自己孵。 */
    const BASKET_MAX = 12;
    /* 用途说明：场景里不挂常驻文字（成熟游戏的做法：物件不飘名字），
       名字交给图，这句人话给鼠标悬停 —— 货架按钮和摆出来的物件都挂着它。
       唯一出处是 PROPS[].tip（别在两处各写一份）。 */
    const DECO_TIP = {
      plate: PROPS.plate.tip,
      basket: PROPS.basket.tip,
      incubator: PROPS.incubator.tip,
      water: PROPS.water.tip,
    };
    let decoDrag = null;
    function decoSize(id) { return DECO_SIZE[id] || [120, 120]; }
    /* 盒子就是图本身（没有文字标签层了），摆放/拖动按这个算。 */
    function decoBox(id) { return decoSize(id); }
    /* 外观素材在 pack.decos 里登记（pack.json 是素材清单）；没登记就退回中性虚线框。 */
    function decoArt(id) {
      const m = pack && pack.decos ? pack.decos[id] : null;
      return (m && m.img) ? m : null;
    }
    function renderDecos() {
      if (!layer) return;
      layer.querySelectorAll('.farm-deco').forEach((el) => el.remove());
      for (const d of (state.decos || [])) {
        const el = document.createElement('div');
        el.className = 'farm-deco';
        el.dataset.deco = d.id;
        el.setAttribute('aria-hidden', 'true');
        const [w, h] = decoSize(d.id);
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        if (DECO_TIP[d.id]) el.title = DECO_TIP[d.id];
        /* 有登记的画真图，没登记的退回中性虚线框（占位，不是最终长相） */
        const art = decoArt(d.id);
        if (art) {
          el.dataset.art = '1';
          const img = document.createElement('img');
          img.className = 'farm-deco-img';
          img.alt = '';
          img.draggable = false;
          /* 器物图没上线（部署漏了 / CDN 抽风）→ 退回中性虚线框（同「没登记」的样子），
             不给用户看破图图标。 */
          img.onerror = () => {
            img.remove();
            delete el.dataset.art;
          };
          img.src = art.img + (window.__coopVer ? ('?' + window.__coopVer) : '');
          el.appendChild(img);
        }
        /* 存量角标：盘里的米、篮/窝里的蛋（看得见的存量，不是装饰） */
        const stock = (d.id === 'basket' || d.id === 'incubator')
          ? eggCount(d)
          : (d.rice | 0);
        if (stock > 0) {
          const num = document.createElement('span');
          num.className = 'farm-deco-num';
          num.textContent = String(stock);
          el.appendChild(num);
        }
        /* 盘里的米：真米粒，落在盘心那块米白方里 */
        if (d.id === 'plate' && stock > 0) renderPlateRice(el, stock, w, h);
        /* 孵化窝：窝里画蛋（数量是活的）+ 底下那条孵化进度 */
        if (d.id === 'incubator') {
          renderNestEggs(el, d);
          renderNestBar(el, d);
        }
        layer.appendChild(el);
        layoutDeco(el, d);
      }
    }
    /* 蛋的存量：篮子里是 {b:品种, at:进篮时间}（老档是纯品种 id 字符串），
       孵化窝里是 {b:品种, at:进窝时间}（at 用来算孵化进度）。 */
    function eggList(d) {
      if (!Array.isArray(d.stock)) d.stock = [];
      return d.stock.map((e) => (typeof e === 'string' ? { b: e, at: d.at || Date.now() } : e));
    }
    function eggCount(d) { return eggList(d).length; }
    /* 孵化窝里的蛋：按存量画在拱口的草窝里（最多画 5 颗，多了也只画 5） */
    function renderNestEggs(el, d) {
      const list = eggList(d);
      if (!list.length) return;
      const well = (pack && pack.decos && pack.decos.incubator && pack.decos.incubator.well)
        || { cx: 60, cy: 44, rx: 9, ry: 7 };
      const n = Math.min(5, list.length);
      const step = Math.min(8, (well.rx * 2) / Math.max(1, n));
      for (let i = 0; i < n; i++) {
        const e = document.createElement('span');
        e.className = 'farm-deco-egg';
        const x = well.cx - ((n - 1) * step) / 2 + i * step;
        e.style.left = (x - 3.5) + 'px';
        e.style.top = (well.cy - 4.5) + 'px';
        el.appendChild(e);
      }
    }
    /* 孵化进度条：最老那颗蛋孵到哪儿了（信息，不是装饰） */
    function renderNestBar(el, d) {
      const list = eggList(d);
      if (!list.length) return;
      const now = Date.now();
      let oldest = Infinity;
      for (const e of list) oldest = Math.min(oldest, e.at || now);
      const p = Math.max(0, Math.min(1, (now - oldest) / INCUBATE_MS));
      const bar = document.createElement('span');
      bar.className = 'farm-deco-bar';
      const fill = document.createElement('i');
      fill.style.width = (p * 100).toFixed(1) + '%';
      bar.appendChild(fill);
      el.appendChild(bar);
    }
    /* 盘里的米：真米粒（复用 .farm-grain 的谷粒样式），散在 3/4 瓷盘的盘心里。
       盘心椭圆由素材脚本写进 pack.json 的 decos.plate.well（显示坐标，唯一出处），
       位置用固定角度算，不随机 —— 刷新后米还在原位，不会一跳一跳。 */
    function renderPlateRice(el, n, w, h) {
      const count = Math.min(11, n);
      const well = (pack && pack.decos && pack.decos.plate && pack.decos.plate.well)
        || { cx: w / 2, cy: h * 0.375, rx: w * 0.25, ry: h * 0.12 };
      const cx = well.cx, cy = well.cy, rx = well.rx, ry = well.ry;
      for (let i = 0; i < count; i++) {
        const g = document.createElement('span');
        g.className = 'farm-grain';
        const a = i * 2.399963;
        const r = Math.sqrt((i + 0.6) / count);
        g.style.left = (cx + Math.cos(a) * r * rx - 2.5) + 'px';
        g.style.top = (cy + Math.sin(a) * r * ry - 2.5) + 'px';
        el.appendChild(g);
      }
    }
    /* 窗口尺寸变了，按比例重排（位置记的是比例，不是像素） */
    function relayoutDecos() {
      if (!layer) return;
      layer.querySelectorAll('.farm-deco').forEach((el) => {
        const d = (state.decos || []).find((v) => v.id === el.dataset.deco);
        if (d) layoutDeco(el, d);
      });
    }
    function layoutDeco(el, d) {
      const [w, h] = decoBox(d.id);
      const sw = stage.clientWidth || 1;
      const sh = stage.clientHeight || 1;
      el.style.left = clamp(d.x * sw - w / 2, 0, Math.max(0, sw - w)) + 'px';
      el.style.top = clamp(d.y * sh - h / 2, 0, Math.max(0, sh - h)) + 'px';
      /* 夹心层级（VPet FoodAnimation 那一课）：器物按**底边**参与前后排序，
         鸡是脚的位置 +2。于是鸡走到器物后面时会被器物挡住，踩上去时压住它。
         （以前器物的 z-index 写死 0，鸡永远在最前，夹心做不出来。） */
      el.style.zIndex = String(Math.round(d.y * sh + h / 2));
    }
    function placeDeco(id, clientX, clientY) {
      const sr = stage.getBoundingClientRect();
      const x = (clientX - sr.left) / (sr.width || 1);
      const y = (clientY - sr.top) / (sr.height || 1);
      if (!Array.isArray(state.decos)) state.decos = [];
      const exist = state.decos.find((v) => v.id === id);
      if (exist) { exist.x = x; exist.y = y; exist.at = Date.now(); }
      else {
        /* 从「收走」里拿回来的：把存量一起带回来（篮子里的蛋、盘里的米不能丢） */
        const si = (state.stash || []).findIndex((v) => v.id === id);
        if (si >= 0) {
          const d = state.stash.splice(si, 1)[0];
          d.x = x; d.y = y; d.at = Date.now();
          state.decos.push(d);
        } else state.decos.push({ id, x, y, at: Date.now() });
      }
      renderDecos();
      save();
    }
    /* ===== 收走器物（2026-11-05）=====
       终树：「单个收走器物（摆上去就下不来）」——
       原来器物只能摆、只能拖，摆上去就下不来。现在能拿回来了：
         - 货架上多一个「收」工具，武装后点场上的器物 → 收回货架；
         - 收走**不丢存量**：篮子里的蛋、盘子里的米跟着进「货架」，
           什么时候再摆出来，存量还在（state.stash）；
         - 鸡、蛋、图鉴、成长都不受影响 —— 收的只是器物本身。 */
    /* 命中测试：屏幕坐标 → 场上哪个器物 */
    function decoAt(clientX, clientY) {
      const sr = stage.getBoundingClientRect();
      const x = clientX - sr.left, y = clientY - sr.top;
      const sw = stage.clientWidth || 1, sh = stage.clientHeight || 1;
      for (const d of (state.decos || [])) {
        const [w, h] = decoBox(d.id);
        const left = clamp(d.x * sw - w / 2, 0, Math.max(0, sw - w));
        const top = clamp(d.y * sh - h / 2, 0, Math.max(0, sh - h));
        if (x >= left && x <= left + w && y >= top && y <= top + h) return d;
      }
      return null;
    }
    function pickUpAt(clientX, clientY) {
      const d = decoAt(clientX, clientY);
      if (!d) {
        bubble(stage.clientWidth / 2, stage.clientHeight * 0.42, '这儿没有器物可收');
        return false;
      }
      pickUpDeco(d);
      return true;
    }
    function pickUpDeco(d) {
      const i = state.decos.indexOf(d);
      if (i < 0) return false;
      const name = (PROPS[d.id] && PROPS[d.id].name) || '器物';
      state.decos.splice(i, 1);
      if (!Array.isArray(state.stash)) state.stash = [];
      const si = state.stash.findIndex((v) => v.id === d.id);
      if (si >= 0) Object.assign(state.stash[si], d); else state.stash.push(d);
      renderDecos();
      save();
      bubble(stage.clientWidth / 2, stage.clientHeight * 0.3,
        name + '收回货架了 —— 随时能再摆出来');
      return true;
    }
    function beginDecoDrag(e) {
      const el = e.target && e.target.closest ? e.target.closest('.farm-deco') : null;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      decoDrag = { el, x: e.clientX, y: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, moved: false, last: null };
      window.addEventListener('pointermove', onDecoMove);
      window.addEventListener('pointerup', onDecoUp);
      return true;
    }
    function onDecoMove(e) {
      if (!decoDrag) return;
      if (Math.hypot(e.clientX - decoDrag.x, e.clientY - decoDrag.y) > 4) decoDrag.moved = true;
      const sr = stage.getBoundingClientRect();
      const [w, h] = decoBox(decoDrag.el.dataset.deco);
      const sw = stage.clientWidth || 1;
      const sh = stage.clientHeight || 1;
      const left = clamp(e.clientX - sr.left - decoDrag.ox, 0, Math.max(0, sw - w));
      const top = clamp(e.clientY - sr.top - decoDrag.oy, 0, Math.max(0, sh - h));
      decoDrag.el.style.left = left + 'px';
      decoDrag.el.style.top = top + 'px';
      decoDrag.last = { left, top, w, h };
    }
    function onDecoUp() {
      window.removeEventListener('pointermove', onDecoMove);
      window.removeEventListener('pointerup', onDecoUp);
      if (decoDrag) {
        const el = decoDrag.el;
        const id = el.dataset.deco;
        if (!decoDrag.moved) {
          /* 没拖动 = 点了一下：篮子开品种选择、水缸添水、孵化窝看进度 */
          if (id === 'basket') {
            const bk = (state.decos || []).find((v) => v.id === 'basket');
            if (bk) openBreedPicker(bk); else emitSay('还没摆篮子呢。');
          }
          else if (id === 'incubator') pokeIncubator();
          else if (id === 'water') drinkWater();
        } else if (decoDrag.last) {
          const d = (state.decos || []).find((v) => v.id === id);
          if (d) {
            const sw = stage.clientWidth || 1;
            const sh = stage.clientHeight || 1;
            d.x = (decoDrag.last.left + decoDrag.last.w / 2) / sw;
            d.y = (decoDrag.last.top + decoDrag.last.h / 2) / sh;
            d.at = Date.now(); // 跨标签页合并时谁更新得晚听谁的
            save();
          }
        }
      }
      decoDrag = null;
    }
    window.addEventListener('resize', relayoutDecos);

    /* ===== 功能层（2026-11-03）：让"摆个盘子"真的有用途 =====
       D 盘子=食盆：撒的米先落进盘子，鸡会自己走过去吃
       D 篮子=蛋篓：下的蛋先落进篮子，点篮子批量孵化
       D 水缸=水盆：点一下给全场鸡回一点心情（逛站看够 3 次作品才解锁）
       B 心情：每只鸡有心情，随时间掉；喂食/说话/喝水能回血；
               心情太差 → 鸡场不再自动产蛋（得先哄）
       A 逛站：站侧派 farm:visit（看作品给米、看动态给蛋），看够 3 次作品解锁水缸
       E 跨页：派去别的页的鸡会领差事，办完带礼物回来
       C 图鉴卡：集齐全部品种可出一张收藏卡（PNG）
    */
    const MOOD_MAX = 100;
    const MOOD_START = 72;
    /* 孵化窝：窝里的蛋自己会孵，孵多久（90 秒）；看够 5 次作品解锁 */
    const INCUBATE_MS = 90 * 1000;
    const VISIT_UNLOCK_INCUBATOR = 5;
    const MOOD_DECAY_H = 12;   // 每小时掉多少
    const MOOD_EAT = 14;       // 吃一口米回多少
    const MOOD_TALK = 3;       // 跟它说句话回多少
    const MOOD_WATER = 10;     // 喝一次水回多少
    const MOOD_LOW = 30;       // 低于这个算"蔫"（看得见）
    const MOOD_PRODUCE = 55;   // 自动产蛋要全场平均心情到这个数
    const VISIT_UNLOCK_WORK = 3;
    const TASK_MS = 90 * 1000;
    const RARITY_CN = { common: '常见', rare: '稀有', legendary: '传说' };

    /* 图鉴卡上的小鸡字形：按品种色画一只极简鸡（收藏卡不引外部图片） */
    function dexGlyph(ctx, cx, cy, r, color, ink) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.25, r * 0.62, r * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + r * 0.42, cy - r * 0.42, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.18, cy + r * 0.95); ctx.lineTo(cx - r * 0.18, cy + r * 1.28);
      ctx.moveTo(cx + r * 0.18, cy + r * 0.95); ctx.lineTo(cx + r * 0.18, cy + r * 1.28);
      ctx.stroke();
    }

    /* ---- 心情：记在账本记录上，刷新还在；离线期间按真实时间补掉 ---- */
    function recMood(r) {
      if (!r) return MOOD_START;
      if (typeof r.mood !== 'number') r.mood = MOOD_START;
      if (typeof r.moodAt !== 'number') r.moodAt = Date.now();
      const h = (Date.now() - r.moodAt) / 3600000;
      if (h > 0.002) { r.mood = Math.max(0, r.mood - h * MOOD_DECAY_H); r.moodAt = Date.now(); }
      return r.mood;
    }
    function chickMood(c) { return c && c.rec ? recMood(c.rec) : MOOD_START; }
    /* HUD 三轴（心情 / 饱腹 / 清洁）单独刷（不重建图鉴），每秒一次。
       三轴分得开之后，玩家一眼能看出「该做什么」：
       心情低 → 去陪它说话；饱腹低 → 摆食盆；清洁低 → 添水。 */
    function refreshMood() {
      if (elMood) elMood.textContent = String(avgAxis(chickMood));
      if (elFull) elFull.textContent = String(avgAxis(chickFull));
      if (elClean) elClean.textContent = String(avgAxis(chickClean));
    }
    function avgMood() {
      const live = flock.filter((c) => !c.dead && c.mode !== 'leave' && c.rec);
      if (!live.length) return MOOD_START;
      return Math.round(live.reduce((s, c) => s + chickMood(c), 0) / live.length);
    }
    function addMood(c, d) {
      if (!c || !c.rec) return;
      recMood(c.rec);
      c.rec.mood = Math.max(0, Math.min(MOOD_MAX, c.rec.mood + d));
    }

    /* ---- 状态多维：饱腹 / 清洁（心情在上面）----
       记法跟心情一模一样：值 + 时间戳（xxAt），离线期间按真实时间补掉。
       老档没有这两个字段 → recFull/recClean 补成「中等值」，不补成 0
       （老用户回来看到的是「七分饱」，不是「饿瘪了」）。 */
    function recFull(r) {
      if (!r) return FULL_START;
      if (typeof r.full !== 'number') r.full = FULL_START;
      if (typeof r.fullAt !== 'number') r.fullAt = Date.now();
      const h = (Date.now() - r.fullAt) / 3600000;
      if (h > 0.002) { r.full = Math.max(0, r.full - h * FULL_DECAY_H); r.fullAt = Date.now(); }
      return r.full;
    }
    function recClean(r) {
      if (!r) return CLEAN_START;
      if (typeof r.clean !== 'number') r.clean = CLEAN_START;
      if (typeof r.cleanAt !== 'number') r.cleanAt = Date.now();
      const h = (Date.now() - r.cleanAt) / 3600000;
      if (h > 0.002) { r.clean = Math.max(0, r.clean - h * CLEAN_DECAY_H); r.cleanAt = Date.now(); }
      return r.clean;
    }
    function chickFull(c) { return c && c.rec ? recFull(c.rec) : FULL_START; }
    function chickClean(c) { return c && c.rec ? recClean(c.rec) : CLEAN_START; }
    function addFull(c, d) {
      if (!c || !c.rec) return;
      recFull(c.rec);
      c.rec.full = Math.max(0, Math.min(FULL_MAX, c.rec.full + d));
    }
    function addClean(c, d) {
      if (!c || !c.rec) return;
      recClean(c.rec);
      c.rec.clean = Math.max(0, Math.min(CLEAN_MAX, c.rec.clean + d));
    }
    /* 全场平均（HUD 用） */
    function avgAxis(fn) {
      const live = flock.filter((c) => !c.dead && c.mode !== 'leave' && c.rec);
      if (!live.length) return fn === chickFull ? FULL_START : (fn === chickClean ? CLEAN_START : MOOD_START);
      return Math.round(live.reduce((s, c) => s + fn(c), 0) / live.length);
    }
    /* 三轴里最低的那一档 → 决定这只鸡现在的表情（心情低=蔫，饱腹低=饿，清洁低=脏） */
    function chickState(c) {
      const m = chickMood(c);
      const f = chickFull(c);
      const k = chickClean(c);
      if (m < MOOD_LOW) return 'glum';
      if (f < 25) return 'hungry';
      if (k < CLEAN_LOW) return 'dirty';
      return 'ok';
    }

    /* ---- 布景道具：位置与存量 ---- */
    function decoCenter(d) {
      const sw = stage.clientWidth || 1, sh = stage.clientHeight || 1;
      const [w, h] = decoBox(d.id);
      const left = clamp(d.x * sw - w / 2, 0, Math.max(0, sw - w));
      const top = clamp(d.y * sh - h / 2, 0, Math.max(0, sh - h));
      return { x: left + w / 2, y: top + h / 2 };
    }
    function nearestDeco(id, x, y, maxDist) {
      let best = null, bd = maxDist;
      for (const d of (state.decos || [])) {
        if (d.id !== id) continue;
        const c = decoCenter(d);
        const dist = Math.hypot(c.x - x, c.y - y);
        if (dist < bd) { bd = dist; best = d; }
      }
      return best;
    }
    /* 米进盘子（盘子是食盆）。x/y 给了就找最近的盘子，没给就找第一个盘子 */
    function giveRice(n, x, y) {
      const plate = (x !== undefined && y !== undefined)
        ? nearestDeco('plate', x, y, 95)
        : (state.decos || []).find((v) => v.id === 'plate');
      if (!plate) return false;
      plate.rice = (plate.rice | 0) + n;
      plate.at = Date.now();
      save(); renderDecos();
      /* 附近的鸡立刻奔过来吃（撒米进盘，鸡就来） */
      const p = decoCenter(plate);
      for (const c of flock) {
        if (c.dead || c.mode === 'leave' || c.mode === 'held') continue;
        if (chickMood(c) < MOOD_LOW) continue;
        if (Math.hypot(c.x - p.x, c.y - p.y) > 460) continue;
        c.mode = 'walk'; c.grainTarget = null;
        c.tx = p.x; c.ty = p.y + 8; c.plateTarget = plate;
      }
      return true;
    }
    /* 蛋进器物：谁近谁接（篮子、孵化窝都算）。
       原来"窝优先"会让篮子永远空着 —— 摆了个篮子也是摆设，2026-11-03 终树说的"蛋篓没什么用"。
       现在按距离：两个器物摆在不同角落就各接各的，同距离窝优先（窝是自动的）。 */
    function giveEggToBasket(x, y, breed) {
      const cands = [];
      const inc = nearestDeco('incubator', x, y, 95);
      const bk = nearestDeco('basket', x, y, 95);
      if (inc) {
        const c = decoCenter(inc);
        cands.push({ d: inc, kind: 'incubator', dist: Math.hypot(c.x - x, c.y - y) });
      }
      if (bk) {
        const c = decoCenter(bk);
        cands.push({ d: bk, kind: 'basket', dist: Math.hypot(c.x - x, c.y - y) });
      }
      cands.sort((a, b) => a.dist - b.dist);
      for (const c of cands) {
        /* 篮子满了不收（去别处或落地） */
        if (c.kind === 'basket' && eggCount(c.d) >= BASKET_MAX) continue;
        if (!Array.isArray(c.d.stock)) c.d.stock = [];
        c.d.stock.push(c.kind === 'incubator'
          ? { b: breed.id, at: Date.now() }
          : breed.id);   // 篮子里的蛋只是"额度"，不锁品种（品种由点篮子时挑）
        c.d.at = Date.now();
        const p = decoCenter(c.d);
        noteFloat(p.x, p.y - 26, 'var(--yellow)');
        save(); renderDecos();
        return true;
      }
      return false;
    }
    /* 点孵化窝：看看窝里在孵什么、还要多久（不催熟 —— 催熟的是篮子） */
    function pokeIncubator() {
      const inc = (state.decos || []).find((v) => v.id === 'incubator');
      if (!inc) return;
      const list = eggList(inc);
      if (!list.length) { emitSay('窝里还是空的。'); return; }
      const now = Date.now();
      let oldest = Infinity;
      for (const e of list) oldest = Math.min(oldest, e.at || now);
      const left = Math.max(0, Math.ceil((INCUBATE_MS - (now - oldest)) / 1000));
      emitSay(`窝里 ${list.length} 颗蛋在孵，最老的那颗还要 ${left} 秒。`);
    }
    /* 点篮子：打开品种选择（一格格小鸡脸），选一只就消耗篮里一颗蛋孵出来。
       篮子不做"点一下秒孵随机蛋"了 —— 那是孵化窝的活；篮子只管"攒蛋 + 指定品种"，
       这样两个器物职责不重叠（2026-11-03 终树："蛋篓没什么用"）。 */
    let pickerEl = null;
    function closePicker() {
      if (pickerEl) { pickerEl.remove(); pickerEl = null; }
      document.removeEventListener('pointerdown', onPickerAway, true);
    }
    function onPickerAway(e) {
      if (pickerEl && !pickerEl.contains(e.target)) closePicker();
    }
    function openBreedPicker(bk) {
      closePicker();
      if (!eggList(bk).length) { emitSay('篮子是空的。等鸡下几个蛋，再点我来挑品种。'); return; }
      const p = decoCenter(bk);
      const box = document.createElement('div');
      box.className = 'farm-picker';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', '挑一个品种');
      for (const b of BREEDS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'farm-pick';
        btn.title = b.name;
        btn.setAttribute('aria-label', b.name);
        const art = document.createElement('span');
        art.className = 'farm-pick-art';
        const sheet = b.expr && b.expr.sheet;
        if (sheet) {
          art.style.backgroundImage = `url(${sheet}${window.__coopVer ? ('?' + window.__coopVer) : ''})`;
        } else {
          art.classList.add('is-dot');
          art.style.background = b.color || 'var(--yellow)';
        }
        btn.appendChild(art);
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          closePicker();
          hatchFromBasket(b.id);
        });
        box.appendChild(btn);
      }
      layer.appendChild(box);
      const bw = box.offsetWidth || 126, bh = box.offsetHeight || 126;
      /* 摆在篮子正上方：篮子画得比盒子高，按中心点算会压住篮子 */
      const [dw, dh] = decoBox('basket');
      box.style.left = clamp(p.x - bw / 2, 6, Math.max(6, stage.clientWidth - bw - 6)) + 'px';
      box.style.top = clamp(p.y - dh / 2 - bh - 10, 6, Math.max(6, stage.clientHeight - bh - 6)) + 'px';
      pickerEl = box;
      /* 点外面就收起来 */
      window.setTimeout(() => document.addEventListener('pointerdown', onPickerAway, true), 0);
    }
    /* 点篮子孵蛋：消耗篮里一颗蛋，孵出指定的品种 */
    function hatchFromBasket(breedId) {
      const bk = (state.decos || []).find((v) => v.id === 'basket' && v.stock && v.stock.length);
      if (!bk) { emitSay('篮子是空的。'); return; }
      bk.stock.shift();
      bk.at = Date.now();
      const breed = BREEDS.find((b) => b.id === breedId) || BREEDS[0];
      const p = decoCenter(bk);
      save(); renderDecos();
      spawnEgg(clamp(p.x, 30, stage.clientWidth - 30), clamp(p.y + 6, 60, stage.clientHeight - 30), breed);
    }
    /* 点水缸：给全场鸡添水 —— 涨**清洁**（状态多维：水缸 = 清洁），顺带回一点心情 */
    function drinkWater() {
      const live = flock.filter((c) => !c.dead && c.mode !== 'leave');
      if (!live.length) { emitSay('场上还没有鸡。'); return; }
      for (const c of live) {
        addClean(c, CLEAN_WATER);   // 主收益：清洁
        addMood(c, MOOD_WATER);     // 附赠：心情
        addGrowth(c, STAGE_BOOST.water);
      }
      const w = (state.decos || []).find((v) => v.id === 'water');
      const p = w ? decoCenter(w) : { x: stage.clientWidth / 2, y: stage.clientHeight / 2 };
      bubble(p.x, p.y - 26, '添了点水，大家都干净了');
      save(); refreshHUD();
    }

    /* ===== A 逛站联动：站侧派 farm:visit 过来 =====
       detail: { kind: 'work' | 'news', title }
       看作品 → 给米；看动态 → 给蛋；看够 3 次作品 → 解锁水缸。
       鸡场没开时奖励先存着（pending），下次开场兑现。 */
    window.addEventListener('farm:visit', (e) => {
      const d = e.detail || {};
      const kind = d.kind === 'news' ? 'news' : 'work';
      state.visits.total = tallyAdd(state.tally.visits.total, 1);
      state.visits[kind] = tallyAdd(state.tally.visits[kind], 1);
      state.pending.push({ kind: kind === 'news' ? 'egg' : 'rice', n: kind === 'news' ? 1 : 4 });
      if (kind === 'work' && state.visits.work >= VISIT_UNLOCK_WORK && !state.unlocked.includes('water')) {
        state.unlocked.push('water');
        state.pending.push({ kind: 'unlock', id: 'water' });
      }
      if (kind === 'work' && state.visits.work >= VISIT_UNLOCK_INCUBATOR && !state.unlocked.includes('incubator')) {
        state.unlocked.push('incubator');
        state.pending.push({ kind: 'unlock', id: 'incubator' });
      }
      save();
      if (!root.hidden) redeemPending();
      else emitSay('你逛站的时候，鸡场都记着呢。');
    });

    /* ===== 鸡场快讯：官网的消息，鸡跑来报（2026-11-04）=====
       **机制在引擎，内容由站侧推。**
       官网内容是活的（天天有新作品、新动态、新的演讲和奖项）——
       引擎要是抄一份，抄完就过期了。所以分工是：
         - 引擎只管：什么时候报、报哪条、怎么显示、给什么奖励、别重复报；
         - 站侧通过 window 的 farm:content 事件把内容条目推过来
           （detail.items = [{ id, kind, label, title, text, href }]）。
       跟已有的 farm:visit 是同一套边界：站侧接线，引擎出玩法。
       机制参数 + 一批「鸡场日常」保底事件在 pack.json 的 events 段（唯一出处）。 */
    const EVENT_KINDS = {
      work: { label: '新作品', weight: 3 },
      news: { label: '新动态', weight: 3 },
      bio:  { label: '履历',   weight: 2 },
      farm: { label: '鸡场日常', weight: 1 },
    };
    let contentItems = [];   // 站侧推来的内容条目（内存态：内容以站侧为准，不落盘）
    const EV = { nextAt: 0, pending: null };

    function evCfg() {
      const C = EVENT_CFG || {};
      const iv = Array.isArray(C.intervalSec) ? C.intervalSec : [150, 320];
      return {
        enabled: C.enabled !== false,
        min: Math.max(20, Number(iv[0]) || 150) * 1000,
        max: Math.max(30, Number(iv[1]) || Number(iv[0]) || 320) * 1000,
        dailyLimit: C.dailyLimit == null ? 4 : Math.max(0, Number(C.dailyLimit) || 0),
        cooldown: (C.cooldownMin == null ? 240 : Number(C.cooldownMin) || 240) * 60000,
        manualCool: (C.manualCooldownSec == null ? 15 : Number(C.manualCooldownSec) || 15) * 1000,
        bubbleMs: Number(C.bubbleMs) || 9000,
        reward: (C.reward && typeof C.reward === 'object') ? C.reward : { egg: 1, mood: 6 },
        pool: Array.isArray(C.pool) ? C.pool : [],
        hasAny: Object.keys(C).length > 0,   // pack 里没配 events 段 → 整个功能不出现
      };
    }
    function evDayKey() {
      const d = new Date();
      return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    }
    /* 站侧内容条目进来：按 id 覆盖（站点内容变了就更新），没 id / 没标题的丢掉 */
    function ingestContent(items) {
      if (!Array.isArray(items)) return 0;
      let n = 0;
      for (const raw of items) {
        if (!raw || typeof raw !== 'object') continue;
        const id = String(raw.id || '').trim();
        const title = String(raw.title || '').trim();
        if (!id || !title) continue;
        const kind = EVENT_KINDS[raw.kind] ? raw.kind : 'farm';
        const it = {
          id,
          kind,
          label: String(raw.label || '').trim() || EVENT_KINDS[kind].label,
          title,
          text: String(raw.text || '').trim(),
          href: String(raw.href || '').trim(),
          cover: String(raw.cover || '').trim(),   // 地图上的作品架用（站侧给封面）
          place: String(raw.place || '').trim(),   // 摆到哪块地上（站侧给）
          src: 'site',
        };
        const i = contentItems.findIndex((x) => x.id === id);
        if (i >= 0) contentItems[i] = it; else contentItems.push(it);
        n += 1;
      }
      return n;
    }
    /* 站侧推内容：window 的 farm:content 事件（detail.items）。
       这里**不吭声**：推内容是数据接入，不是消息本身 ——
       真正要报的是那条快讯（showBcast 会冒泡 + 给奖励）。 */
    window.addEventListener('farm:content', (e) => {
      const d = e.detail || {};
      ingestContent(d.items);
    });
    /* 兜底：站侧脚本先跑、引擎后起（动态 import）→ 从 window.__coopContent 读一份 */
    try {
      if (window.__coopContent && Array.isArray(window.__coopContent.items)) ingestContent(window.__coopContent.items);
    } catch { /* 忽略 */ }

    /* 候选池 = 站侧内容 + pack.json 里的鸡场日常 */
    function evItems() {
      const C = evCfg();
      const out = contentItems.slice();
      for (const it of C.pool) {
        if (!it || !it.id || !it.title) continue;
        const kind = EVENT_KINDS[it.kind] ? it.kind : 'farm';
        out.push({
          id: String(it.id), kind,
          label: String(it.label || '') || EVENT_KINDS[kind].label,
          title: String(it.title || ''),
          text: String(it.text || ''),
          href: String(it.href || ''),
          src: 'pack',
          reward: (it.reward && typeof it.reward === 'object') ? it.reward : null,
        });
      }
      return out;
    }
    /* 抽一条：没报过的优先；报过的要过了冷却才能再报。
       站侧内容权重更高（官网消息是新鲜事），鸡场日常垫底。 */
    function pickEvent() {
      const C = evCfg();
      const now = Date.now();
      const fresh = [], old = [];
      for (const it of evItems()) {
        const last = Number(state.events.fired[it.id]) || 0;
        if (!last) fresh.push(it);
        else if (now - last >= C.cooldown) old.push(it);
      }
      const pool = fresh.length ? fresh : old;
      if (!pool.length) return null;
      const bag = [];
      for (const it of pool) {
        const w = it.src === 'site' ? (EVENT_KINDS[it.kind] ? EVENT_KINDS[it.kind].weight : 2) : 1;
        for (let i = 0; i < w; i += 1) bag.push(it);
      }
      return bag[(Math.random() * bag.length) | 0];
    }
    /* 让这只鸡走到场中央去报（到了才冒泡，见 stepChick 的 bcast 分支） */
    function startBcast(c, item, manual) {
      state.events.fired[item.id] = Date.now();
      state.events.count = (state.events.count | 0) + 1;
      /* 一天几条只管**自动**播报 —— 玩家主动问的不占这个额度 */
      if (!manual) state.events.dayCount = (state.events.dayCount | 0) + 1;
      state.events.last = item.title;
      state.events.lastId = item.id;
      if (manual) state.events.lastManual = Date.now();
      c.bcast = { item, manual: !!manual, fired: false, at: Date.now() };
      c.chaseTarget = false; c.grainTarget = null; c.plateTarget = null;
      c.mode = 'walk';
      c.tx = Math.round(stage.clientWidth / 2);
      c.ty = Math.round(stage.clientHeight * 0.62);
      c.act = 'bcast';
      c.el.dataset.act = 'bcast';
      save();
    }
    /* 报一条：找一只鸡走到场中央去播报；场上没鸡就先排队，等鸡回来再报 */
    function fireEvent(opts) {
      const o = opts || {};
      const C = evCfg();
      if (!C.enabled && !o.force) return null;
      if (root.hidden) return null;            // 鸡场关着不报（回来再说）
      const day = evDayKey();
      if (state.events.day !== day) { state.events.day = day; state.events.dayCount = 0; }
      if (!o.force) {
        if (o.manual) {
          /* 玩家主动问：不受「一天报几条」的限制（那条限制是给自动播报防刷的），
             只受自己的冷却限制 —— 玩家点了就该有回应。 */
          const left = C.manualCool - (Date.now() - (Number(state.events.lastManual) || 0));
          if (left > 0) return null;
        } else if (C.dailyLimit && state.events.dayCount >= C.dailyLimit) {
          return null;
        }
      }
      const item = o.item || pickEvent();
      if (!item) return null;
      const c = flock.find((x) => x && !x.dead && x.mode !== 'leave' && x.mode !== 'held');
      if (!c) { EV.pending = item; return item; }   // 排队等鸡上场
      EV.pending = null;
      startBcast(c, item, !!o.manual);
      return item;
    }
    /* 冒泡：分类标签 + 标题 + 一行正文 + 「去看看」链接（回到官网对应页面） */
    function showBcast(c, item, manual) {
      const C = evCfg();
      const b = document.createElement('div');
      b.className = 'farm-bubble is-bcast';
      const tag = document.createElement('span');
      tag.className = 'farm-bcast-tag';
      tag.textContent = item.label || (EVENT_KINDS[item.kind] ? EVENT_KINDS[item.kind].label : '快讯');
      const ti = document.createElement('span');
      ti.className = 'farm-bcast-title';
      ti.textContent = item.title || '';
      b.appendChild(tag);
      b.appendChild(ti);
      if (item.text) {
        const bd = document.createElement('span');
        bd.className = 'farm-bcast-body';
        bd.textContent = item.text;
        b.appendChild(bd);
      }
      if (item.href) {
        const a = document.createElement('a');
        a.className = 'farm-bcast-link';
        a.href = item.href;
        a.textContent = '去看看 →';
        b.appendChild(a);
      }
      /* 气泡宽（最多 300px）→ 贴边时别让它跑出屏 */
      b.style.left = clamp(c.x, 152, Math.max(154, stage.clientWidth - 152)) + 'px';
      b.style.top = clamp(c.y - 46, 30, Math.max(32, stage.clientHeight)) + 'px';
      const dur = C.bubbleMs;
      b.style.setProperty('--bubout', ((dur - 350) / 1000).toFixed(2) + 's');
      layer.appendChild(b);
      window.setTimeout(() => b.remove(), dur);
      giveEventReward(c, item, manual);
      play((t) => cluck(t, c.breed.f * 1.06, 0.13));
      emitSay('站内快讯：' + (item.title || ''));
      save(); refreshHUD();
    }
    /* 奖励：数值当场变（规矩 3「数值要实时可见」）
       主动打听只给心情，不给蛋/米：蛋和米是「逛站」的奖励，
       这里要是也给，点几下就能把蛋刷出来（一天的条数拦不住玩家主动问）。 */
    function giveEventReward(c, item, manual) {
      const C = evCfg();
      const r = (item.reward && typeof item.reward === 'object') ? item.reward : (C.reward || {});
      const n = (k) => Number(r[k]) || 0;
      if (n('mood')) addMood(c, n('mood'));
      if (manual) return;
      if (n('egg')) state.eggs = tallyAdd(state.tally.eggs, n('egg'));
      if (n('full')) addFull(c, n('full'));
      if (n('clean')) addClean(c, n('clean'));
      if (n('rice')) {
        /* 没食盆就撒地上 —— 奖励不能因为「没摆盆子」就丢了 */
        if (!giveRice(n('rice'))) {
          for (let i = 0; i < Math.ceil(n('rice') / 2); i += 1) {
            scatterGrain(rand(60, Math.max(70, stage.clientWidth - 60)), rand(90, Math.max(100, stage.clientHeight - 60)));
          }
        }
      }
    }
    /* 时钟：到点报一条（鸡场开着才走） */
    function checkEventClock() {
      const C = evCfg();
      if (!C.enabled) return;
      const now = Date.now();
      if (!EV.nextAt) { EV.nextAt = now + rand(C.min, C.max); return; }
      if (now < EV.nextAt) return;
      EV.nextAt = now + rand(C.min, C.max);
      /* 兜底：鸡走过来太慢（被别的行为打断）→ 12 秒后直接在原地报 */
      for (const c of flock) {
        if (c.bcast && !c.bcast.fired && now - c.bcast.at > 12000) {
          const b = c.bcast; c.bcast = null;
          showBcast(c, b.item, b.manual);
        }
      }
      /* 上次排队等着报的（当时场上没鸡）→ 现在有鸡了就报出来 */
      if (EV.pending) {
        const it = EV.pending; EV.pending = null;
        fireEvent({ item: it, force: true });
        return;
      }
      fireEvent({});
    }
    /* 玩家主动打听（点鸡菜单里的一项）：条件不满足时也回一句话，别装死 */
    function askNews(c) {
      const C = evCfg();
      const left = C.manualCool - (Date.now() - (Number(state.events.lastManual) || 0));
      if (left > 0) {
        bubble(c.x, c.y, '消息还没新鲜，' + Math.ceil(left / 1000) + ' 秒后再问');
        return false;
      }
      const item = fireEvent({ manual: true });
      if (!item) { bubble(c.x, c.y, '暂时没什么新消息。'); return false; }
      return true;
    }
    /* 菜单项的现状：冷却中就灰掉，并把还差几秒写出来（条件要看得见） */
    function newsMenuState() {
      const C = evCfg();
      const left = C.manualCool - (Date.now() - (Number(state.events.lastManual) || 0));
      if (left > 0) return { label: '打听消息（' + Math.ceil(left / 1000) + 's）', disabled: true };
      return { label: '打听消息', disabled: false };
    }

    function redeemPending() {
      if (!state.pending.length) return;
      const list = state.pending.slice();
      state.pending = [];
      let rice = 0, eggs = 0;
      for (const p of list) {
        if (p.kind === 'rice') rice += (p.n || 1);
        else if (p.kind === 'egg') eggs += (p.n || 1);
        else if (p.kind === 'unlock') {
          const names = { water: '水缸', piano: '地琴', incubator: '孵化窝' };
          bubble(stage.clientWidth / 2, stage.clientHeight * 0.35, '解锁了新道具：' + (names[p.id] || p.id));
        }
      }
      if (rice) {
        if (!giveRice(rice)) {
          for (let i = 0; i < Math.ceil(rice / 2); i += 1) {
            scatterGrain(rand(60, Math.max(70, stage.clientWidth - 60)), rand(90, Math.max(100, stage.clientHeight - 60)));
          }
        }
        bubble(stage.clientWidth / 2, stage.clientHeight * 0.28, '带回来一些米');
      }
      if (eggs) {
        state.eggs = tallyAdd(state.tally.eggs, eggs);
        bubble(stage.clientWidth / 2, stage.clientHeight * 0.24, '带回来 ' + eggs + ' 颗蛋');
      }
      save(); refreshHUD(); paintArm();
    }

    /* ===== 倒蛋：篮子（蛋篓）里攒的蛋一次倒掉（2026-11-05）=====
       终树：「蛋能倒掉」—— 蛋落进篮子就下不来（只能一只一只孵），
       现在能一次倒掉，腾出篮子。
       蛋是玩家的资产，所以**只玩家点了才倒**，绝不自动清；
       而且倒的是「篮子里的蛋」，不是累计下蛋数（那是成就卡上的记录，不能抹）。 */
    function dumpBasketEggs() {
      const bk = (state.decos || []).find((v) => v.id === 'basket');
      if (!bk) { emitSay('还没摆篮子呢。'); return; }
      const n = eggCount(bk);
      if (!n) { emitSay('篮子是空的。'); return; }
      bk.stock = [];
      bk.at = Date.now();
      save(); renderDecos();
      bubble(stage.clientWidth / 2, stage.clientHeight * 0.3, `倒掉 ${n} 颗蛋 —— 篮子空了`);
    }

    /* ===== E 跨页差事：派去的鸡会办事，办完带礼物回来 ===== */
    function checkTasks() {
      const now = Date.now();
      for (const r of state.chickens) {
        if (!r.task || now < r.task.due) continue;
        r.gift = Math.random() < 0.5 ? 'rice' : 'egg';
        const from = r.task.from || '';
        r.task = null;
        r.lastSeen = now;
        /* 差事办完 → **它自己回原来那一页**（串门结束）。
           原来只记礼物、不送鸡回来 —— 派出去的鸡一去不回，
           而气泡写着「它回来了」、文档也写着要回来（代码漏了这一步）。
           鸡不在本页 → 走出屏；鸡要回本页 → 直接放上台。 */
        if (from) {
          r.page = from;
          const c = flock.find((x) => x.id === r.id && !x.dead);
          if (from === HERE) {
            if (!c) placeOne(r, true);   // 它回家了 → 弹一下出场
          } else if (c) {
            bubble(c.x, c.y - 40, '差事办完了，回家去～');
            c.shockUntil = Date.now() + 2200;
            c.mode = 'leave';
            c.tx = c.x < stage.clientWidth / 2 ? -80 : stage.clientWidth + 80;
          }
        }
      }
      redeemGifts();   // 回到本页的鸡，礼物当场兑现（别让玩家干等下次开鸡场）
      save();
    }
    function redeemGifts() {
      for (const r of state.chickens) {
        if (!r.gift) continue;
        /* 只兑现「已经回到本页」的鸡带的礼物：别的页的礼物等它回来那天兑现
           （不然你人在 A 页，却收到 B 页那只鸡的米 —— 账对不上） */
        if (r.page !== HERE) continue;
        const g = r.gift; r.gift = null;
        if (g === 'rice') {
          /* 没盘子就撒地上，别把礼物丢了 */
          if (!giveRice(3)) {
            for (let i = 0; i < 2; i += 1) {
              scatterGrain(rand(60, Math.max(70, stage.clientWidth - 60)), rand(90, Math.max(100, stage.clientHeight - 60)));
            }
          }
        } else state.eggs = tallyAdd(state.tally.eggs, 1);
        const c = flock.find((x) => x.id === r.id && !x.dead);
        if (c) bubble(c.x, c.y - 40, g === 'rice' ? '它回来了，带了三把米' : '它回来了，带了一颗蛋');
      }
      save();
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
          // 武装中点 pill = 卸武装（Factorish 再点卸下）；顺手把货架展开，换道具不用再点一次
          if (armedPropId) {
            selectTool(armedPropId);
            if (shelf.classList.contains('is-stowed')) {
              shelf.classList.remove('is-stowed');
              togBtn.setAttribute('aria-expanded', 'true');
            }
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
        const prop = PROPS[btn.dataset.prop];
        /* 工具（收走）永远可用 —— 它不占解锁位，也不摆东西 */
        if (prop.kind !== 'tool' && !state.unlocked.includes(btn.dataset.prop)) {
          const nm = prop.name;
          emitSay(nm + '还没解锁——多逛逛站就会开。');
          bubble(stage.clientWidth / 2, stage.clientHeight * 0.42, nm + '还没解锁');
          return;
        }
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
      if (t.closest('.farm-deco')) { if (beginDecoDrag(e)) return; }
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
    $('farm-btn-book').addEventListener('click', () => { ensureAudio(); $('farm-book').hidden = !$('farm-book').hidden; updateAnnot(); });
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
    /* canvas 不认 var()：从 CSS 变量里读实际色值，成就卡与界面同一套色 */
    function cssVar(name) {
      try { return getComputedStyle(root).getPropertyValue(name).trim(); } catch { return ''; }
    }
    function drawCard(kind) {
      const cv = document.createElement('canvas');
      cv.width = 720; cv.height = 480;
      const ctx = cv.getContext('2d');
      const cCard = cssVar('--card') || cssVar('--paper');
      const cInk = cssVar('--ink');
      const cOrange = cssVar('--orange');
      ctx.fillStyle = cCard; ctx.fillRect(0, 0, 720, 480);
      ctx.strokeStyle = cInk; ctx.lineWidth = 2; ctx.strokeRect(14, 14, 692, 452);
      ctx.fillStyle = cInk;
      const date = new Date().toISOString().slice(0, 10);
      ctx.font = '600 30px "Alibaba PuHuiTi 3.0", system-ui, sans-serif';
      ctx.textAlign = 'center';
      if (kind === 'legend') {
        ctx.fillText('传说出壳', 360, 120);
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillText(`第 ${state.eggs | 0} 次点击 · 金·元宝 · ${date}`, 360, 190);
        ctx.fillStyle = cOrange; ctx.font = '600 20px system-ui, sans-serif';
        ctx.fillText('★ 传说瞬间卡 ★', 360, 260);
        ctx.fillStyle = cInk; ctx.font = '14px system-ui, sans-serif';
        ctx.fillText('幕景鸡场 认证 · 编号 MJ-' + (1000 + (state.eggs | 0)), 360, 320);
      } else if (kind === 'cert') {
        ctx.fillText('集齐荣誉证书', 360, 120);
        ctx.font = '16px system-ui, sans-serif';
        const names = Object.entries(state.dex || {}).map(([id, c]) => `${id}×${c}`).join('  ');
        ctx.fillText(`7 个品种 · ${date}`, 360, 180);
        ctx.fillStyle = cOrange; ctx.font = '600 20px system-ui, sans-serif';
        ctx.fillText('幕景鸡场 荣誉鸡舍', 360, 260);
        ctx.fillStyle = cInk; ctx.font = '14px system-ui, sans-serif';
        ctx.fillText('证书编号 MJ-CERT-' + (1000 + (state.seq | 0)), 360, 320);
      } else if (kind === 'dex') {
        ctx.fillText('鸡场图鉴 · 全收集', 360, 78);
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillStyle = cInk;
        ctx.fillText(`${BREEDS.length} 个品种 · ${date}`, 360, 100);
        const cols = 3, cw = 200, ch = 106, x0 = 66, y0 = 120;
        BREEDS.forEach((b, i) => {
          const cx = x0 + (i % cols) * cw + 34;
          const cy = y0 + Math.floor(i / cols) * ch + 26;
          /* 每个品种一个小盘：橙边 + 米白盘面（跟图鉴格子同一个视觉） */
          ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2);
          ctx.fillStyle = cCard; ctx.fill();
          ctx.lineWidth = 2.5; ctx.strokeStyle = cOrange; ctx.stroke();
          dexGlyph(ctx, cx, cy, 17, b.color || cOrange, cInk);
          ctx.textAlign = 'left';
          ctx.fillStyle = cInk; ctx.font = '600 13px system-ui, sans-serif';
          ctx.fillText(b.name, cx + 34, cy - 2);
          ctx.font = '11px system-ui, sans-serif';
          ctx.fillText(RARITY_CN[b.rarity] || b.rarity, cx + 34, cy + 16);
          ctx.textAlign = 'center';
        });
        ctx.fillStyle = cOrange; ctx.font = '600 16px system-ui, sans-serif';
        ctx.fillText('集齐全部品种 · 幕景宇宙', 360, 424);
      } else {
        ctx.fillText('满屏鸡群合影', 360, 120);
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillText(`累计出鸡 ${state.hatched | 0} 只 · 蛋 ${state.eggs | 0} 颗 · ${date}`, 360, 180);
        ctx.fillStyle = cOrange;
        for (let i = 0; i < 12; i += 1) {
          const x = 90 + (i % 6) * 96 + (i > 5 ? 48 : 0);
          const y = 240 + Math.floor(i / 6) * 90;
          ctx.beginPath(); ctx.ellipse(x, y, 30, 38, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = cInk;
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
    /* 图鉴卡：集齐全部品种才有的收藏卡（独立于成就卡） */
    const dexCardBtn = $('farm-btn-dexcard');
    if (dexCardBtn) dexCardBtn.addEventListener('click', () => {
      let found = 0;
      for (const b of BREEDS) if ((state.dex[b.id] | 0) > 0) found += 1;
      if (found < BREEDS.length) { emitSay('还没集齐。'); return; }
      drawCard('dex');
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
      state = blankState();
      state.resetAt = Date.now(); // 别的标签页看到更新的 resetAt 就一起清账
      flushSave(true); // 强制盖掉磁盘（不跟旧账合并），并告诉别的标签页「账清了」
      refreshHUD(); emitState();
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
            noteFloat(kr.x + kr.width / 2, kr.y - 8, seat.chick ? toneOf(seat.chick.breed) : 'var(--orange)', seat.chick);
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
        if (!behaviorsFor(c).stand) continue;   // 行为表关掉了 stand → 音乐会散场，鸡自由活动
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
        const an = nameOf(a.id) || a.breed.name;
        const bn = nameOf(b.id) || b.breed.name;
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
    let lowMoodAt = 0;
    window.setInterval(() => {
      if (root.hidden || document.hidden) return;
      const onStage = flock.filter((c) => !c.dead && c.mode !== 'leave' && c.mode !== 'held');
      if (!onStage.length || state.eggs - state.hatched > 6) return;
      /* 心情太差 → 鸡场不自动产蛋：得先喂食、说话、添水把它们哄好 */
      if (avgMood() < MOOD_PRODUCE) {
        const now = Date.now();
        if (now - (lowMoodAt || 0) > 300000) {
          lowMoodAt = now;
          bubble(stage.clientWidth / 2, stage.clientHeight * 0.42, '鸡们没什么精神，先喂点东西');
        }
        return;
      }
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
    /* ===== 孵化窝：窝里的蛋到点自己出壳 =====
       计时看的是**蛋进窝的时间戳**，不是计时器，所以关页面/关标签页也在孵，
       回来时打开鸡场就补孵（离线也在孵，和心情的离线结算一个道理）。 */
    window.setInterval(() => {
      if (root.hidden || document.hidden) return;
      const inc = (state.decos || []).find((d) => d.id === 'incubator');
      if (!inc || !Array.isArray(inc.stock) || !inc.stock.length) return;
      const now = Date.now();
      let changed = false;
      for (let i = inc.stock.length - 1; i >= 0; i--) {
        const e = inc.stock[i];
        const at = typeof e === 'string' ? (inc.at || now) : (e.at || now);
        if (now - at < INCUBATE_MS) continue;
        inc.stock.splice(i, 1);
        changed = true;
        const breedId = typeof e === 'string' ? e : e.b;
        const breed = BREEDS.find((b) => b.id === breedId) || BREEDS[0];
        const p = decoCenter(inc);
        spawnEgg(clamp(p.x, 30, stage.clientWidth - 30), clamp(p.y + 6, 60, stage.clientHeight - 30), breed);
      }
      if (!changed) return;
      inc.at = now;
      save(); renderDecos();
      emitSay('孵化窝里出壳了一只小鸡！');
    }, 2000);
    /* 双击撒谷子的判定已合并进 document 级下蛋处理器（stage 是 pointer-events:none，收不到事件） */
        $('farm-btn-butler').addEventListener('click', () => emitCmd('butler'));

    /* ===== 模块七：主循环（单 rAF；页签隐藏即暂停并落盘） ===== */
    let raf = 0;
    let lastT = -1;
    let taskClock = 0;
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
      mapTick(t);                            // 地图打开时，院里的小鸡在走动
      if (flock.some((c) => c.dead)) flock = flock.filter((c) => !c.dead);
      if (taskClock++ % 60 === 0) {
        checkTasks(); refreshMood(); refreshExpr();
        const grew = checkGrowth(true);   // 成长推进（每秒一次；离线期间的阶段在开场时补）
        if (grew) save();
        checkEventClock();                // 鸡场快讯：到点报一条
        checkWander();                    // 鸡自己出门逛：到点走一只
      }
      raf = requestAnimationFrame(tick);
    }
    function startLoop() { if (!raf) { lastT = -1; raf = requestAnimationFrame(tick); } }
    function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { stopLoop(); flushSave(); } // 藏起来先把账记了（lastSeen 粒度够用）
      else if (!root.hidden) startLoop(); // 鸡场收起中不空转
    });
    /* 关页面/切走前强制落盘：合并写有 250ms 延迟，不冲一下会丢掉最后一下 */
    window.addEventListener('pagehide', () => flushSave());
    window.addEventListener('beforeunload', () => flushSave());

    /* 把一条账本记录放上台（还原 / 召回 / 差事办完自己回家 共用一条路）
       pop = 刚回来时弹一下（还原/召回不弹 —— 那是「摆上去」，不是「回来了」） */
    function placeOne(r, pop) {
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const breed = BREEDS.find((b) => b.id === r.breed) || BREEDS[0];
      const x = clamp((r.pos[0] || 0.5) * w, 40, Math.max(42, w - 40));
      const y = clamp((r.pos[1] || 0.6) * h, 40, Math.max(42, h - 60));
      const c = addChick(x, y, breed, !!pop, stageOf(r), r);
      c.id = r.id;   // 对上账本，goto 时好点名
      c.rec = r;    // 心情等状态记在账本上，刷新还在
      return c;
    }

    /* ===== 恢复：换页时把 page===HERE 的鸡放回本页（详见 farm-state.md 第三节） ===== */
    function restore() {
      /* 窝里的（散场收回来的）不上台 —— 它在账本上，但不在这页 */
      const mine = state.chickens.filter((r) => r.page === HERE && !r.stowed).slice(0, MAX_PAGE);
      for (const r of mine) {
        placeOne(r);
      }
      trimFlock();
      renderDecos(); // 布景道具跟着鸡场一起回来（位置按比例，刷新还在）
      checkTasks();  // 跨页差事到期结算
      redeemGifts(); // 办完差事带回来的礼物
      redeemPending(); // 鸡场关着时逛站攒下的奖励，在这里兑现
      /* 排队的快讯：刚才场上没鸡可报，现在鸡回来了 → 报出来 */
      if (EV.pending) {
        const it = EV.pending; EV.pending = null;
        fireEvent({ item: it, force: true });
      }
    }

    /* ===== 见面礼：第一次来的人，不该对着一个空舞台 =====
       2026-11-04 实测：新访客打开鸡场是「0 只鸡、0 件器物」——
       他不知道要点空白处下蛋、也不知道器物能摆，首屏零反馈，像坏了。
       这里给第一次来的人两样东西：
         1) 自动落一颗蛋 —— 走完整的落地 → 破壳 → 出壳演出（2 秒后出第一只鸡），
            顺手把「蛋会变成鸡」演给他看。这比任何说明文字都直接。
         2) 一个空瓷盘 —— 让人看见「场上有东西、可以摆」，也让人有地方喂食。
       只给一次（state.eggs > 0 就不是新访客了）；
       「重开鸡场」清完账后，下次打开会再给一次 —— 重来一遍也该有个开始。
       蛋的品种照常随机：见面礼不暗改概率，图鉴该缺还是缺。 */
    function firstVisit() {
      /* 真的是「第一次来」：没下过蛋、没孵过鸡、没摆过器物、没逛过站。
         只看 eggs 会误判 —— 摆过东西的人（器物在场上）不是新访客，
         逛过站的人（拿过奖励）也不是。 */
      const fresh = state.eggs === 0 && state.hatched === 0
        && !state.chickens.length && !state.decos.length
        && !(state.visits && state.visits.total > 0);
      if (!fresh) return;
      /* 一个空瓷盘：先让人看见「场上有东西」 */
      if (!Array.isArray(state.decos)) state.decos = [];
      if (!state.decos.length) {
        state.decos.push({ id: 'plate', x: 0.24, y: 0.66, at: Date.now() });
        renderDecos();
      }
      /* 一颗蛋：让它自己掉下来。晚一点落，好让人先看清这是个空场 */
      window.setTimeout(() => {
        const x = Math.round((stage.clientWidth || 1) * 0.46);
        const y = Math.round((stage.clientHeight || 1) * 0.62);
        layEgg(x, y);
        bubble(x, y, '第一颗蛋。等会儿就出壳。');
      }, 1100);
    }

    refreshHUD();
    paintArm();   // 货架图标用真图（和摆出来的道具同一张），锁没锁也画
    emitState();

    /* 网页默认全天明亮：不按小时改 #farm-night。
       以后一次性气氛（例如烟花）从这里短暂点亮再卸下，不要改回按时段常驻夜幕。 */
    const nightEl = $('farm-night');
    nightEl.style.opacity = '0';
    let grains = [];
    function scatterGrain(x, y) {
      /* 有盘子就近进盘：盘子是食盆，鸡会自己走过去吃，比撒地上省事 */
      if (giveRice(6, x, y)) {
        const near = flock.filter((c) => !c.dead && c.mode !== 'leave').slice(0, 3);
        for (const c of near) { c.mode = 'walk'; c.tx = clamp(x + rand(-40, 40), 30, stage.clientWidth - 30); c.ty = clamp(y + rand(-20, 20), 60, stage.clientHeight - 30); }
        return;
      }
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
      addMood(c, MOOD_EAT);
      addFull(c, FULL_EAT);        // 吃米涨饱腹（状态多维）
      addGrowth(c, STAGE_BOOST.eat);   // 吃米也催大
      c.eatCool = 1.6;   // 刚吃过 → 开心脸
      noteFloat(g.x, g.y - 10, 'var(--yellow)', null);
    }
    /* 鸡找吃的：盘子里还有米就去盘边站着 */
    function nearestPlateFood(c) {
      let best = null, bd = 1e9;
      for (const d of (state.decos || [])) {
        if (d.id !== 'plate' || !(d.rice > 0)) continue;
        const p = decoCenter(d);
        const dist = Math.hypot(p.x - c.x, p.y - c.y);
        if (dist < bd) { bd = dist; best = { d, p }; }
      }
      return best;
    }
    /* 拎鸡扔鸡：按住鸡拖动>10px 即拎起，松手按速度抛出（重力+地板反弹+摩擦） */
    let held = null;
    function moveHeld(e) { if (held) moveHeldInner(e); }
    function endHeld(e) { if (held) endHeldInner(e); }
    function grabChick(c, e) {
      held = { c, vx: 0, vy: 0, lastX: e.clientX, lastY: e.clientY, lt: performance.now(), moved: 0, x0: e.clientX, y0: e.clientY };
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
      /* 拖了多远（从按下那点算）：没超过 10px 就算「点一下」，不是「拎起来」 */
      held.moved = Math.max(held.moved, Math.hypot(e.clientX - held.x0, e.clientY - held.y0));
      held.lastX = e.clientX; held.lastY = e.clientY; held.lt = now;
      draw(held.c, now / 1000);
    }
    function endHeldInner() {
      if (!held) return;
      const c = held.c;
      const moved = held.moved;
      const dur = performance.now() - held.lt;
      held = null;
      if (moved < 10) {
        /* 没拖动 = 只是「点它一下」，不是把它拎起来抛。
           短按 → 它叫一声（poke）+ 弹小菜单（VPet ToolBar 式，2026-11-04）；
           长按 → 交给起名那套（onUp 里按 550ms 判）。
           （原来不管拖没拖都抛，跟这行注释写的「拖动>10px 即拎起」对不上。） */
        c.mode = 'wait'; c.wait = rand(0.3, 0.9);
        if (dur < 500) { poke(c); openChickMenu(c); }
        return;
      }
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
      if (el) {
        el.classList.add('active');
        window.setTimeout(() => { if (el.dataset.hold !== '1') el.classList.remove('active'); }, 140);
      }
      // 地琴反馈：近旁鸡歪头/打鸣（借小鸡宇宙离散 pose，短触发）
      try {
        const sr = stage.getBoundingClientRect();
        const keyEl = el || floorEl.querySelector(`[data-midi="${hit.midi}"]`);
        let kx = stage.clientWidth / 2, ky = stage.clientHeight - 40;
        if (keyEl) {
          const kr = keyEl.getBoundingClientRect();
          kx = kr.left + kr.width / 2 - sr.left;
          ky = kr.top - sr.top;
        }
        const near = nearestChick(kx, ky, 120);
        if (near) poseFlash(near, Math.random() < 0.45 ? 'crow' : 'tilt');
      } catch (_) { /* 跳过 */ }
    }
    function footPiano(c) {
      if (!floorEl || floorEl.hidden || c.concert || c.mode === 'held' || c.mode === 'leave') {
        c.floorMidi = 0;
        return;
      }
      const sr = stage.getBoundingClientRect();
      const hit = keyAt(sr.left + c.x, sr.top + c.y);
      const id = hit ? hit.midi : 0;
      if (id && id !== c.floorMidi) strikeFloorKey(hit); // pose 已在 strikeFloorKey 里对近旁鸡触发
      c.floorMidi = id;
    }
    buildFloorPiano();

    /* ===== 开合与默认：所有页面默认开（含手机），只有显式收起才记 '0'；?farm=1 强制开。
       'farm:toggle'=切换（Mimi 面板「进鸡场」与合作页「鸡场」chip 派发），'farm:open'=强制开。
       开着时 body 挂 .farm-on（全站 cursor:none、光标小鸡接管）；收起移除，页面零痕迹。 */
    const ON_KEY = 'coop-farm-on';
    const LEGACY_ON_KEYS = ['mujing-farm-on']; // 站侧旧键：只读，兼容老用户的选择
    function prefOn() {
      try {
        /* 开合参数统一：?farm=1 / ?coop=1 强制开，?farm=0 / ?coop=0 强制关 */
        const q = new URLSearchParams(location.search);
        const flag = q.get('farm') ?? q.get('coop');
        if (flag === '1') return true;
        if (flag === '0') return false;
        if (localStorage.getItem(ON_KEY) === '0') return false;
        for (const k of LEGACY_ON_KEYS) {
          if (localStorage.getItem(k) === '0') return false;
        }
        return true;
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
      if (!opened) {
        opened = true;
        /* 成长补账：离线期间长到的阶段在这里补上（静默 —— 不连播动画，回来只报一句喜） */
        const grew = checkGrowth(false);
        restore(); firstVisit();
        /* 姿态立刻刷一次：refreshExpr 平时每 60 帧才跑一次，
           刚放回来的鸡会先以「正常脸」出现一两秒 —— 饿的/脏的看不出来，
           玩家会以为刚才的白粥白喂了。这里开场就刷，姿态立刻对。 */
        refreshExpr(); refreshMood();
        if (grew) window.setTimeout(() => emitSay(`有 ${grew} 只小鸡长大了`), 900);
      } // 布局尺寸就绪后再把本页的鸡放回来；第一次来的人给个见面礼
      startLoop();
    }
    function closeFarm(persist) {
      if (glowEl) { glowEl.classList.remove('farm-glow'); glowEl = null; }
      closePicker(); // 品种选择面板别留在收起的场里
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
    window.addEventListener('farm:close', () => { closeFarm(true); }); // 强制关并记偏好
    $('farm-btn-close').addEventListener('click', () => { closeFarm(true); });
    if (prefOn()) openFarm(false);
    window.__coopSnapshot = snapshot; // 引擎块内落存根：挂件晚挂时补首读快照
    window.__coopFireEvent = (opts) => fireEvent(opts || { force: true }); // 手动报一条快讯（验收 / 管家）
    window.__coopEvents = () => ({
      cfg: evCfg(),
      content: contentItems.slice(),          // 站侧推来的条目
      pool: evCfg().pool,                     // pack.json 里的鸡场日常
      fired: Object.assign({}, state.events.fired), // 每条最近一次播报时间
      count: state.events.count | 0,
      dayCount: state.events.dayCount | 0,
      last: state.events.last || '',
      pending: EV.pending ? EV.pending.id : '',
    }); // 快讯台账（验收脚本靠它看「报了什么、报了几次」）
    window.__coopBehaviors = () => ({
      table: BASE_BEHAVIORS, // 当前生效的行为表（品种覆盖后的）
      counts: Object.assign({}, BEHAVIOR_COUNTS), // 累计次数：idle/peck/walk
      byBreed: JSON.parse(JSON.stringify(BEHAVIOR_BY_BREED)), // 品种 → 次数（品种覆盖看得见）
      acts: flock.filter((c) => c && !c.dead).map((c) => ({ breed: (c.breed && c.breed.id) || '', act: c.act || '' })),
    }); // 行为表 + 分布：验收脚本靠它看「行为有没有变」
  }
  /* 引擎真的起来了才占幂等名额（引擎块外面那个 window.__coop 句柄已经先给好了）。
     判据用 __coopSnapshot：它是引擎块跑到最后才落的根 ——
     引擎块中途抛异常 → 它不在 → 不占名额，下次 init() 还能重来
     （以前是在函数开头就置 flag：DOM 没就绪时整块引擎被跳过，
       之后谁再调 init() 都只拿得到空壳句柄 → 鸡场永远起不来，还一句错都不报）。 */
  window.__coopInit = !!window.__coopSnapshot;
  /* 管家挂件：cfg.chat 传入即挂（离线剧本树全功能；api 配置后为真智能体） */
  if (cfg.chat) {
    import('./chat.js?' + VER)
      .then((m) => { m.attach(cfg.chat, window.__coop); })
      .catch(() => { /* chat.js 缺失时引擎照常工作 */ });
  }
  return window.__coop;
}
export { init };
