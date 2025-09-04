import { describe, expect, it } from 'vitest';
import { idioms, originLabels } from './data/idioms';

describe('収録データの整合性', () => {
  it('語はすべて漢字4文字で重複がない', () => {
    for (const i of idioms) {
      expect([...i.word]).toHaveLength(4);
      expect(i.word).toMatch(/^[一-鿿]{4}$/u);
    }
    expect(new Set(idioms.map((i) => i.word)).size).toBe(idioms.length);
  });

  it('読みはひらがなだけで書かれている', () => {
    for (const i of idioms) {
      expect(i.reading).toMatch(/^[ぁ-ゖー]+$/u);
    }
  });

  it('意味と出典解説が全語に書かれている', () => {
    for (const i of idioms) {
      expect(i.meaning.length).toBeGreaterThanOrEqual(10);
      expect(i.originNote.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('由来はすべて規定の4分類のいずれかで、表示ラベルがある', () => {
    const labelled = new Set(Object.keys(originLabels));
    for (const i of idioms) {
      expect(labelled.has(i.origin)).toBe(true);
    }
    // どの分類にも最低限の語数があり、出題や絞り込みが成立する
    for (const key of labelled) {
      const count = idioms.filter((i) => i.origin === key).length;
      expect(count).toBeGreaterThanOrEqual(4);
    }
  });

  it('100語以上を収録している', () => {
    expect(idioms.length).toBeGreaterThanOrEqual(100);
  });
});
