/*!
 * instruments.js — coop.js 乐器合成器（纯 Web Audio 现场合成，零采样文件、零 setTimeout）
 *
 * 用途：给鸡场引擎（coop.js 的 cluck() 之外）补一套可预排度的乐器音色，供音乐会、
 *       事件音升级等场景调用。createVoices(actx, master) 接收引擎已有的 AudioContext
 *       与 master GainNode（见 coop.js ensureAudio()：首手势建 ctx、master 0.5 →
 *       lowpass 2400 → destination），返回一组音色函数，全部直连 master。
 *       本模块不建 AudioContext、不碰 DOM、不跑 setTimeout / setInterval / rAF。
 *
 * 调度契约（A Tale of Two Clocks）：每个音色函数的第一个参数 t 都是 AudioContext 的
 * 绝对时间（秒，即 actx.currentTime 域）——提前量、节拍对齐由调用方负责；本模块只把
 * 节点一次性预排在硬件时钟上，排完即返回。t 传过去（早于当前时间）则立即起音。
 * 每个音色函数全程 try/catch，任何异常静默退化（不发声、不抛错）——隐私模式、
 * ctx 被回收等一律不炸鸡场。
 *
 * 各乐器合成思路（全部振荡器/白噪声现场合成，无采样）：
 * - piano：基频 sine + 两个 detune ±4 cents 的 triangle 泛音（×2、×3 倍频，增益
 *   1.0→0.35→0.16 递减）叠出钢琴谐波堆；共用包络 5ms 攻击 + 按 durSec 指数衰减；
 *   lowpass 自 3200Hz 随衰减轻扫向下（亮度先亮后暗）；音头另叠 10ms 高通噪声瞬态
 *   模拟琴槌击弦。
 * - drum：kick = 120Hz sine 频率下扫（120→45Hz/0.12s）+ 20ms 噪声 click；
 *   snare = 1800Hz 带通噪声（沙腔）+ 220Hz triangle（鼓皮）；hat = 6000Hz 高通
 *   噪声，40ms 速衰。未知 kind 静默忽略。
 * - bell：FM 合成——载波 f，调制器 f×3.5，调制深度（index≈2.2）随时间指数衰减
 *   （金属泛音由亮转纯），1.2s 指数长衰减。
 * - shaker：5000Hz 带通白噪声，6ms 攻击 + 60ms 指数衰减——沙锤的「沙」。
 * - pluck：真·Karplus-Strong——「短噪声激发 + 延迟反馈弦振」按 midi 逐采样烧进
 *   AudioBuffer（0.4s，环路平均低滤 + 每样点衰减，末端 20ms 渐隐防咔），按 midi
 *   缓存。不走 DelayNode 反馈环：该环被 128 采样渲染量子钳制，周期短于一个量子的
 *   音（约 340Hz 以上）音准会塌到量化格点上。
 */

export function createVoices(actx, master) {
  const noop = () => {};
  if (!actx || !master) {
    /* 没有引擎音频链路：返回全套空函数，调用方零判断 */
    return { piano: noop, drum: noop, bell: noop, shaker: noop, pluck: noop };
  }

  const hz = (m) => 440 * Math.pow(2, ((Number(m) || 0) - 69) / 12);
  const clampG = (g) => Math.min(1, Math.max(0.001, Number(g) || 0));

  /* 共享白噪声缓冲（0.2s 平坦白噪声），包络一律由 GainNode 现场捏 */
  let noiseBuf = null;
  function noise() {
    if (!noiseBuf) {
      const len = Math.max(256, Math.floor(actx.sampleRate * 0.2));
      noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  /* 噪声瞬态：滤波白噪声 + 指数衰减包络（可选 6ms 级攻击），琴槌/军鼓/踩镲/沙锤共用 */
  function noiseVoice(t, dur, g, type, freq, q, atk) {
    try {
      if (!(g > 0)) return;
      const src = actx.createBufferSource();
      src.buffer = noise();
      const f = actx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      if (q) f.Q.value = q;
      const gn = actx.createGain();
      if (atk > 0) {
        gn.gain.setValueAtTime(0.0001, t);
        gn.gain.exponentialRampToValueAtTime(g, t + atk);
      } else {
        gn.gain.setValueAtTime(g, t);
      }
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(gn); gn.connect(master);
      src.start(t); src.stop(t + dur + 0.02);
    } catch { /* 静默退化 */ }
  }

  /* piano(t, midi, durSec, gain)：钢琴感——sine 基频 + detune triangle 泛音堆 + 琴槌噪声 */
  function piano(t, midi, durSec, gain) {
    try {
      const f = hz(midi);
      if (!(f > 0)) return;
      const g = clampG(gain);
      const d = Math.min(4, Math.max(0.08, Number(durSec) || 0.5));
      /* 谐波堆：基频 + ×2/×3 泛音（detune ±4 cents，增益递减），共用一条包络 */
      const parts = [
        { mul: 1, type: 'sine', det: 0, g: 1.0 },
        { mul: 2, type: 'triangle', det: 4, g: 0.35 },
        { mul: 3, type: 'triangle', det: -4, g: 0.16 },
      ];
      const env = actx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(g, t + 0.005);  /* attack 5ms */
      env.gain.exponentialRampToValueAtTime(0.0001, t + d); /* decay 按 durSec */
      const lp = actx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(3200, t);
      lp.frequency.exponentialRampToValueAtTime(1200, t + d); /* 亮度轻扫变暗 */
      env.connect(lp); lp.connect(master);
      for (const p of parts) {
        const o = actx.createOscillator();
        o.type = p.type;
        o.frequency.value = f * p.mul;
        o.detune.value = p.det;
        const og = actx.createGain();
        og.gain.value = p.g;
        o.connect(og); og.connect(env);
        o.start(t); o.stop(t + d + 0.05);
      }
      noiseVoice(t, 0.01, g * 0.3, 'highpass', 2000); /* 琴槌击弦瞬态 */
    } catch { /* 静默退化 */ }
  }

  /* drum(t, kind, gain)：kick/snare/hat 三件套，未知 kind 静默忽略 */
  function drum(t, kind, gain) {
    try {
      const g = clampG(gain);
      if (kind === 'kick') {
        const o = actx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.12); /* 下扫 */
        const gn = actx.createGain();
        gn.gain.setValueAtTime(g, t);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        o.connect(gn); gn.connect(master);
        o.start(t); o.stop(t + 0.3);
        noiseVoice(t, 0.02, g * 0.35, 'highpass', 900); /* 击鼓 click */
      } else if (kind === 'snare') {
        noiseVoice(t, 0.15, g * 0.8, 'bandpass', 1800, 0.8); /* 沙腔 */
        const o = actx.createOscillator();                    /* 鼓皮 */
        o.type = 'triangle';
        o.frequency.setValueAtTime(220, t);
        const gn = actx.createGain();
        gn.gain.setValueAtTime(g * 0.5, t);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        o.connect(gn); gn.connect(master);
        o.start(t); o.stop(t + 0.1);
      } else if (kind === 'hat') {
        noiseVoice(t, 0.04, g * 0.6, 'highpass', 6000);
      }
    } catch { /* 静默退化 */ }
  }

  /* bell(t, midi, gain)：FM——载波 f、调制器 f×3.5，index 随时间衰减，1.2s 长衰减 */
  function bell(t, midi, gain) {
    try {
      const f = hz(midi);
      if (!(f > 0)) return;
      const car = actx.createOscillator();
      car.type = 'sine';
      car.frequency.value = f;
      const mod = actx.createOscillator();
      mod.type = 'sine';
      mod.frequency.value = f * 3.5;
      const depth = actx.createGain(); /* 调制深度 = index × 载波频率 */
      depth.gain.setValueAtTime(f * 2.2, t);                      /* index≈2.2 起音 */
      depth.gain.exponentialRampToValueAtTime(f * 0.02, t + 0.7); /* index 随时间衰减 */
      mod.connect(depth); depth.connect(car.frequency);
      const gn = actx.createGain();
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.exponentialRampToValueAtTime(clampG(gain), t + 0.004);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.2); /* 指数长衰减 */
      car.connect(gn); gn.connect(master);
      car.start(t); mod.start(t);
      car.stop(t + 1.25); mod.stop(t + 1.25);
    } catch { /* 静默退化 */ }
  }

  /* shaker(t, gain)：5000Hz 带通白噪声，6ms 攻击 + 60ms 指数衰减 */
  function shaker(t, gain) {
    try {
      noiseVoice(t, 0.06, clampG(gain), 'bandpass', 5000, 2, 0.006);
    } catch { /* 静默退化 */ }
  }

  /* pluck(t, midi, gain)：Karplus-Strong——噪声激发 + 延迟反馈弦振，逐采样烧进 buffer */
  const ksCache = new Map();
  function ksBuffer(midi) {
    const key = Math.round(Number(midi) || 0);
    let buf = ksCache.get(key);
    if (buf) return buf;
    const f = hz(key);
    if (!(f > 0)) return null;
    const sr = actx.sampleRate;
    const N = Math.max(2, Math.round(sr / f)); /* 弦长 = 延迟线样点数 */
    const len = Math.floor(sr * 0.4);
    buf = actx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const line = new Float32Array(N); /* 延迟线：短噪声激发 */
    for (let i = 0; i < N; i++) line[i] = Math.random() * 2 - 1;
    const decay = 0.9996; /* 环路每样点衰减 → 约 0.4s 自然消音 */
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const cur = line[idx];
      out[i] = cur;
      const nxt = line[(idx + 1) % N];
      line[idx] = decay * 0.5 * (cur + nxt); /* 反馈：环路平均低滤（弦振阻尼）+ 衰减 */
      idx = (idx + 1) % N;
    }
    const fade = Math.min(len, Math.floor(sr * 0.02)); /* 末端 20ms 渐隐防咔 */
    for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
    ksCache.set(key, buf);
    return buf;
  }

  function pluck(t, midi, gain) {
    try {
      if (!(Number(gain) > 0)) return;
      const buf = ksBuffer(midi);
      if (!buf) return;
      const src = actx.createBufferSource();
      src.buffer = buf;
      const gn = actx.createGain();
      gn.gain.value = clampG(gain);
      src.connect(gn); gn.connect(master);
      src.start(t); src.stop(t + 0.42);
    } catch { /* 静默退化 */ }
  }

  return { piano, drum, bell, shaker, pluck };
}
