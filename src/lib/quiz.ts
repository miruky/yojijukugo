import type { Idiom, Origin } from './data/idioms';

export type QuestionKind = 'meaning' | 'reading' | 'fill';

export const QUESTION_KINDS: readonly QuestionKind[] = ['meaning', 'reading', 'fill'];

/** おまかせモード用に、3種の出題形式から一つを選ぶ。 */
export function randomKind(rng: () => number): QuestionKind {
  const i = Math.floor(rng() * QUESTION_KINDS.length) % QUESTION_KINDS.length;
  return QUESTION_KINDS[i]!;
}

/** 出題範囲。由来の一分類に絞るか、全語から出すか。 */
export type OriginScope = Origin | 'all';

/**
 * 出題プールを由来で絞る。4択を組めないほど小さい分類になることはないが、
 * 万一の不足時は全語へ落とし、選択肢が欠けた問題を作らない。
 */
export function scopePool(idioms: readonly Idiom[], scope: OriginScope): readonly Idiom[] {
  if (scope === 'all') return idioms;
  const scoped = idioms.filter((i) => i.origin === scope);
  return scoped.length >= 4 ? scoped : idioms;
}

export interface Question {
  kind: QuestionKind;
  /** 問題の主役の語 */
  idiom: Idiom;
  /** 画面に出す問い(意味文・四字熟語・虫食り表示) */
  prompt: string;
  choices: string[];
  answerIndex: number;
  /** 正誤表示のあとに添える解説 */
  explanation: string;
  /** 復習リスト用のid */
  id: string;
}

/** mulberry32。シードが同じなら同じ出題列を再現できる */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickIndex(rng: () => number, length: number): number {
  return Math.floor(rng() * length) % length;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = arr[i];
    const b = arr[j];
    if (a !== undefined && b !== undefined) {
      arr[i] = b;
      arr[j] = a;
    }
  }
  return arr;
}

/** 他の語から重複しない値をn個サンプリングする */
function sampleOthers<T>(
  pool: readonly Idiom[],
  exclude: Idiom,
  pick: (i: Idiom) => T,
  n: number,
  rng: () => number,
  taken: ReadonlySet<T>,
): T[] {
  const candidates = shuffle(pool.filter((i) => i !== exclude).map(pick), rng);
  const out: T[] = [];
  const seen = new Set<T>(taken);
  for (const c of candidates) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
    if (out.length === n) break;
  }
  return out;
}

function explanationOf(idiom: Idiom): string {
  return `${idiom.word}(${idiom.reading}): ${idiom.meaning}`;
}

/** 意味文から四字熟語を選ぶ */
export function buildMeaningQuestion(
  idioms: readonly Idiom[],
  rng: () => number,
  fixedWord?: string,
): Question {
  const idiom = idioms.find((i) => i.word === fixedWord) ?? idioms[pickIndex(rng, idioms.length)];
  if (!idiom) throw new Error('出題データが空');
  const wrong = sampleOthers(idioms, idiom, (i) => i.word, 3, rng, new Set([idiom.word]));
  const choices = shuffle([idiom.word, ...wrong], rng);
  return {
    kind: 'meaning',
    idiom,
    prompt: idiom.meaning,
    choices,
    answerIndex: choices.indexOf(idiom.word),
    explanation: explanationOf(idiom),
    id: `meaning:${idiom.word}`,
  };
}

/** 四字熟語の読みを選ぶ */
export function buildReadingQuestion(
  idioms: readonly Idiom[],
  rng: () => number,
  fixedWord?: string,
): Question {
  const idiom = idioms.find((i) => i.word === fixedWord) ?? idioms[pickIndex(rng, idioms.length)];
  if (!idiom) throw new Error('出題データが空');
  const wrong = sampleOthers(idioms, idiom, (i) => i.reading, 3, rng, new Set([idiom.reading]));
  const choices = shuffle([idiom.reading, ...wrong], rng);
  return {
    kind: 'reading',
    idiom,
    prompt: idiom.word,
    choices,
    answerIndex: choices.indexOf(idiom.reading),
    explanation: explanationOf(idiom),
    id: `reading:${idiom.word}`,
  };
}

const MASK = '〇';

/**
 * 虫食い。1文字を伏せ、入る漢字を選ぶ。
 * 「七転八起」と「七転八倒」のように、別の語が成立してしまう漢字は
 * 誤答に使わない。正解が2つある問題を作らないための選別
 */
export function buildFillQuestion(
  idioms: readonly Idiom[],
  rng: () => number,
  fixedWord?: string,
): Question {
  const idiom = idioms.find((i) => i.word === fixedWord) ?? idioms[pickIndex(rng, idioms.length)];
  if (!idiom) throw new Error('出題データが空');
  const chars = [...idiom.word];
  const maskedIndex = pickIndex(rng, chars.length);
  const answer = chars[maskedIndex] ?? '';
  const masked = chars.map((c, i) => (i === maskedIndex ? MASK : c)).join('');

  const words = new Set(idioms.map((i) => i.word));
  const formsValidWord = (kanji: string): boolean => {
    const candidate = chars.map((c, i) => (i === maskedIndex ? kanji : c)).join('');
    return words.has(candidate);
  };

  const allKanji = shuffle(
    [...new Set(idioms.filter((i) => i !== idiom).flatMap((i) => [...i.word]))],
    rng,
  );
  const wrong: string[] = [];
  for (const k of allKanji) {
    if (k === answer || idiom.word.includes(k) || formsValidWord(k)) continue;
    wrong.push(k);
    if (wrong.length === 3) break;
  }

  const choices = shuffle([answer, ...wrong], rng);
  return {
    kind: 'fill',
    idiom,
    prompt: masked,
    choices,
    answerIndex: choices.indexOf(answer),
    explanation: explanationOf(idiom),
    id: `fill:${idiom.word}`,
  };
}

export function buildQuestion(
  kind: QuestionKind,
  idioms: readonly Idiom[],
  rng: () => number,
  fixedWord?: string,
): Question {
  if (kind === 'meaning') return buildMeaningQuestion(idioms, rng, fixedWord);
  if (kind === 'reading') return buildReadingQuestion(idioms, rng, fixedWord);
  return buildFillQuestion(idioms, rng, fixedWord);
}

/** 復習id(kind:word)から同じ問題を組み立て直す */
export function rebuildFromId(
  id: string,
  idioms: readonly Idiom[],
  rng: () => number,
): Question | undefined {
  const sep = id.indexOf(':');
  if (sep === -1) return undefined;
  const kind = id.slice(0, sep);
  const word = id.slice(sep + 1);
  if (kind !== 'meaning' && kind !== 'reading' && kind !== 'fill') return undefined;
  if (!idioms.some((i) => i.word === word)) return undefined;
  return buildQuestion(kind, idioms, rng, word);
}

/** 苦手リスト(問題id)を由来ごとに数える。復習タブで内訳を示すのに使う。 */
export function weakByOrigin(
  ids: readonly string[],
  idioms: readonly Idiom[],
): Record<Origin, number> {
  const originOf = new Map(idioms.map((i) => [i.word, i.origin] as const));
  const counts: Record<Origin, number> = { kanseki: 0, bukkyo: 0, nihon: 0, general: 0 };
  for (const id of ids) {
    const origin = originOf.get(id.slice(id.indexOf(':') + 1));
    if (origin) counts[origin] += 1;
  }
  return counts;
}
