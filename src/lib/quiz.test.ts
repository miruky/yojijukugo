import { describe, expect, it } from 'vitest';
import { idioms } from './data/idioms';
import {
  buildFillQuestion,
  buildMeaningQuestion,
  buildQuestion,
  buildReadingQuestion,
  createRng,
  rebuildFromId,
  scopePool,
} from './quiz';
import type { Origin } from './data/idioms';

describe('createRng', () => {
  it('同じシードからは同じ列を生む', () => {
    const a = createRng(7);
    const b = createRng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('0以上1未満の値を返す', () => {
    const rng = createRng(123);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('出題の不変条件', () => {
  it('50シードを通して4択・一意・正解の包含が崩れない', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = createRng(seed);
      for (const kind of ['meaning', 'reading', 'fill'] as const) {
        const q = buildQuestion(kind, idioms, rng);
        expect(q.choices).toHaveLength(4);
        expect(new Set(q.choices).size).toBe(4);
        expect(q.choices[q.answerIndex]).toBeDefined();
        expect(q.explanation).toContain(q.idiom.word);
      }
    }
  });

  it('意味クイズは意味文を問いにし、正解の語を選択肢に含む', () => {
    const q = buildMeaningQuestion(idioms, createRng(1), '温故知新');
    expect(q.prompt).toBe('昔の事柄や学説を学び直して、新しい知識や見方を得ること');
    expect(q.choices[q.answerIndex]).toBe('温故知新');
  });

  it('読みクイズは語を問いにし、正しい読みを選択肢に含む', () => {
    const q = buildReadingQuestion(idioms, createRng(2), '画竜点睛');
    expect(q.prompt).toBe('画竜点睛');
    expect(q.choices[q.answerIndex]).toBe('がりょうてんせい');
  });
});

describe('虫食いクイズ', () => {
  it('1文字だけ伏せ、正解で元の語に戻る', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const q = buildFillQuestion(idioms, createRng(seed));
      const maskCount = [...q.prompt].filter((c) => c === '〇').length;
      expect(maskCount).toBe(1);
      const answer = q.choices[q.answerIndex] ?? '';
      expect(q.prompt.replace('〇', answer)).toBe(q.idiom.word);
    }
  });

  it('誤答を当てはめても収録語にならない(別解の混入なし)', () => {
    const words = new Set(idioms.map((i) => i.word));
    for (let seed = 1; seed <= 100; seed++) {
      const q = buildFillQuestion(idioms, createRng(seed));
      q.choices.forEach((c, idx) => {
        if (idx === q.answerIndex) return;
        expect(words.has(q.prompt.replace('〇', c))).toBe(false);
      });
    }
  });

  it('「七転八〇」のような同型の語があっても正解は1つになる', () => {
    // 七転八起を固定出題し、全選択肢のうち語が成立するのは正解だけであることを確かめる
    const words = new Set(idioms.map((i) => i.word));
    for (let seed = 1; seed <= 50; seed++) {
      const q = buildFillQuestion(idioms, createRng(seed), '七転八起');
      const valid = q.choices.filter((c) => words.has(q.prompt.replace('〇', c)));
      expect(valid).toHaveLength(1);
    }
  });
});

describe('rebuildFromId', () => {
  it('復習idから同じ語・同じ形式の問題を作り直せる', () => {
    const q = rebuildFromId('reading:四面楚歌', idioms, createRng(9));
    expect(q?.kind).toBe('reading');
    expect(q?.idiom.word).toBe('四面楚歌');
  });

  it('壊れたidや収録外の語はundefined', () => {
    expect(rebuildFromId('reading', idioms, createRng(1))).toBeUndefined();
    expect(rebuildFromId('meaning:存在しない語', idioms, createRng(1))).toBeUndefined();
    expect(rebuildFromId('walk:温故知新', idioms, createRng(1))).toBeUndefined();
  });
});

describe('scopePool', () => {
  const origins: Origin[] = ['kanseki', 'bukkyo', 'nihon', 'general'];

  it('allは全語をそのまま返す', () => {
    expect(scopePool(idioms, 'all')).toBe(idioms);
  });

  it('指定の由来だけに絞る', () => {
    for (const o of origins) {
      const scoped = scopePool(idioms, o);
      expect(scoped.length).toBeGreaterThan(0);
      expect(scoped.every((i) => i.origin === o)).toBe(true);
    }
  });

  it('絞ったプールでも4択・別解非混入が崩れない', () => {
    for (const o of origins) {
      const pool = scopePool(idioms, o);
      const words = new Set(pool.map((i) => i.word));
      for (let seed = 1; seed <= 30; seed++) {
        const rng = createRng(seed);
        for (const kind of ['meaning', 'reading', 'fill'] as const) {
          const q = buildQuestion(kind, pool, rng);
          expect(q.choices).toHaveLength(4);
          expect(new Set(q.choices).size).toBe(4);
          expect(q.choices[q.answerIndex]).toBeDefined();
        }
        const fill = buildFillQuestion(pool, createRng(seed));
        fill.choices.forEach((c, idx) => {
          if (idx === fill.answerIndex) return;
          expect(words.has(fill.prompt.replace('〇', c))).toBe(false);
        });
      }
    }
  });

  it('4語に満たない分類は全語へ落とす', () => {
    const tiny = idioms.slice(0, 2);
    // tinyの中にkanseki以外しかない状況を作り、不足時に全語へ落ちることを見る
    expect(scopePool(tiny, 'bukkyo')).toBe(tiny);
  });
});
