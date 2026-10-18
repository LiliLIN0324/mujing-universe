import { getCollection } from 'astro:content';
export const LINES = ['音画', 'AIGC 产品', '游戏', '空间与研究'] as const;
export const LINE_EN: Record<string,string> = { '音画':'Audio-Visual', 'AIGC 产品':'AIGC Products', '游戏':'Games', '空间与研究':'Space & Research' };
export async function allWorks() {
  const ws = (await getCollection('works')).map(w => w.data);
  ws.sort((a,b) => LINES.indexOf(a.line) - LINES.indexOf(b.line) || b.yearNum - a.yearNum);
  return ws.map((w,i) => ({ ...w, no: String(i+1).padStart(2,'0') }));
}
export const FEATURED = ['xihu-panorama','scendance','anyreal','riffle-ai-game-generation-tool','72-hour-game-jam','neurotopia'];
