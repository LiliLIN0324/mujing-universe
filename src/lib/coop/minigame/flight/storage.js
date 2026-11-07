/*!
 * flight/storage.js — 本地存档（最高分 / 连续通关 streak / 每日一局记录）
 *
 * 纪律（research/minigame-opensource.md §1.3）：沿用引擎那条「读不到就不写、
 * 绝不抛异常」的路子 —— 隐私模式 / localStorage 被禁 / JSON 坏了，
 * 一律静默退化，绝不因为存档把游戏搞崩。
 *
 * 失败只消耗**这一次尝试**：退出（Esc）不碰 streak，已经收进账本的收集品不丢。
 */

import { prevDayKey } from './data.js';

const MAX_DAILY = 14;   // 只留最近 14 天的每日记录，别把 localStorage 撑爆

function blank() {
  return {
    v: 1,
    best: 0,           // 历史最高分
    bestDistance: 0,   // 历史最远飞行距离
    streak: 0,         // 连续通关天数
    lastDay: '',       // 最近一次通关的日期（YYYY-MM-DD）
    plays: 0,          // 玩过几局
    daily: {},         // 'YYYY-MM-DD' → { best, cleared }
  };
}

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/**
 * 读存档。读不到 / 坏了 / 没有 → 返回一份干净的空档，**绝不抛异常**。
 * @param {string} key
 */
export function loadRecord(key) {
  const empty = blank();
  let raw = null;
  try { raw = window.localStorage.getItem(key); } catch { return empty; }
  if (!raw) return empty;
  let o = null;
  try { o = JSON.parse(raw); } catch { return empty; }
  if (!o || typeof o !== 'object') return empty;
  const rec = empty;
  rec.best = Math.max(0, num(o.best, 0));
  rec.bestDistance = Math.max(0, num(o.bestDistance, 0));
  rec.streak = Math.max(0, num(o.streak, 0) | 0);
  rec.lastDay = typeof o.lastDay === 'string' ? o.lastDay : '';
  rec.plays = Math.max(0, num(o.plays, 0) | 0);
  if (o.daily && typeof o.daily === 'object') {
    for (const k of Object.keys(o.daily)) {
      const d = o.daily[k];
      if (!d || typeof d !== 'object') continue;
      rec.daily[k] = { best: Math.max(0, num(d.best, 0)), cleared: !!d.cleared };
    }
  }
  return rec;
}

/**
 * 写存档。写不进去（隐私模式）就当没写，**绝不抛异常**。
 * @returns {boolean} 写成功与否
 */
export function saveRecord(key, rec) {
  try {
    window.localStorage.setItem(key, JSON.stringify(rec));
    return true;
  } catch { return false; }
}

/**
 * 结算一局，算出新的存档。
 * @param {object} rec 当前存档
 * @param {{score:number, distance:number, dodged:number, cleared:boolean, dayKey:string, quit:boolean}} result
 * @returns {object} 新存档
 */
export function applyResult(rec, result) {
  const out = Object.assign({}, rec);
  out.daily = Object.assign({}, rec.daily);
  const day = result.dayKey || '';

  out.best = Math.max(out.best | 0, Math.round(result.score || 0));
  out.bestDistance = Math.max(out.bestDistance | 0, Math.round(result.distance || 0));
  out.plays = (out.plays | 0) + 1;

  if (day) {
    const prev = out.daily[day] || { best: 0, cleared: false };
    out.daily[day] = {
      best: Math.max(prev.best | 0, Math.round(result.score || 0)),
      cleared: prev.cleared || !!result.cleared,
    };
  }

  if (result.quit) {
    /* 退出不惩罚：streak 一个字都不动，已收进账本的收集品也不丢 */
    return out;
  }

  if (result.cleared) {
    /* 通关：连续天数 +1（昨天刚通关过就接上，否则重新从 1 数） */
    const y = prevDayKey(day);
    out.streak = (out.lastDay && out.lastDay === y) ? (out.streak | 0) + 1 : 1;
    out.lastDay = day;
  } else if (out.lastDay === day) {
    /* 今天已经通关过了，之后再摔不扣已经拿到的连续天数 */
  } else {
    /* 今天失败 → 连续断了 */
    out.streak = 0;
  }

  /* 只留最近 14 天 */
  const keys = Object.keys(out.daily).sort();
  while (keys.length > MAX_DAILY) { delete out.daily[keys.shift()]; }
  return out;
}
