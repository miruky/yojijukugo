import { describe, expect, it } from 'vitest';
import { idioms } from './data/idioms';

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

  it('60語以上を収録している', () => {
    expect(idioms.length).toBeGreaterThanOrEqual(60);
  });
});
