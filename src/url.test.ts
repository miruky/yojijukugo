import { describe, expect, it } from 'vitest';
import { formatHash, isRouteTab, parseHash } from './url';

describe('parseHash', () => {
  it('モードだけのハッシュを読む', () => {
    expect(parseHash('#reading')).toEqual({ tab: 'reading', query: '' });
    expect(parseHash('fill')).toEqual({ tab: 'fill', query: '' });
  });

  it('辞典は検索語つきで読める', () => {
    expect(parseHash('#dict/' + encodeURIComponent('温故知新'))).toEqual({
      tab: 'dict',
      query: '温故知新',
    });
  });

  it('辞典以外のモードに付いた語は捨てる', () => {
    expect(parseHash('#meaning/温故知新')).toEqual({ tab: 'meaning', query: '' });
  });

  it('空・未知のモード・壊れたエスケープは null', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#')).toBeNull();
    expect(parseHash('#walk')).toBeNull();
    expect(parseHash('#dict/%E0%A4%A')).toEqual({ tab: 'dict', query: '' });
  });
});

describe('formatHash', () => {
  it('モードをハッシュにする', () => {
    expect(formatHash('meaning')).toBe('#meaning');
    expect(formatHash('dict')).toBe('#dict');
  });

  it('辞典の検索語はエスケープして載せ、空白は載せない', () => {
    expect(formatHash('dict', '故事')).toBe('#dict/' + encodeURIComponent('故事'));
    expect(formatHash('dict', '   ')).toBe('#dict');
  });

  it('parseHashと往復できる', () => {
    for (const h of ['#meaning', '#review', '#dict', '#dict/' + encodeURIComponent('一期一会')]) {
      const route = parseHash(h);
      expect(route).not.toBeNull();
      expect(formatHash(route!.tab, route!.query)).toBe(h);
    }
  });
});

describe('isRouteTab', () => {
  it('規定のモードだけを受け入れる', () => {
    expect(isRouteTab('dict')).toBe(true);
    expect(isRouteTab('meaning')).toBe(true);
    expect(isRouteTab('nope')).toBe(false);
  });
});
