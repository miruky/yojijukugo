import { describe, expect, it } from 'vitest';
import { accuracy, emptyProgress, record, restoreProgress, weakIds } from './progress';

describe('record', () => {
  it('正解で正答数と連続正解が伸びる', () => {
    let p = emptyProgress();
    p = record(p, 'meaning:温故知新', true);
    p = record(p, 'meaning:四面楚歌', true);
    expect(p.total).toBe(2);
    expect(p.correct).toBe(2);
    expect(p.streak).toBe(2);
    expect(p.bestStreak).toBe(2);
  });

  it('不正解は苦手に積まれ、連続正解が切れる', () => {
    let p = emptyProgress();
    p = record(p, 'fill:臥薪嘗胆', true);
    p = record(p, 'fill:臥薪嘗胆', false);
    expect(p.streak).toBe(0);
    expect(p.bestStreak).toBe(1);
    expect(weakIds(p)).toEqual(['fill:臥薪嘗胆']);
  });

  it('苦手は正解すると消える', () => {
    let p = emptyProgress();
    p = record(p, 'reading:呉越同舟', false);
    p = record(p, 'reading:呉越同舟', true);
    expect(weakIds(p)).toEqual([]);
  });

  it('元のオブジェクトは変更しない', () => {
    const before = emptyProgress();
    record(before, 'meaning:温故知新', false);
    expect(before.total).toBe(0);
    expect(weakIds(before)).toEqual([]);
  });
});

describe('accuracy', () => {
  it('正答率を百分率の整数で返す', () => {
    let p = emptyProgress();
    expect(accuracy(p)).toBe(0);
    p = record(p, 'a', true);
    p = record(p, 'b', false);
    p = record(p, 'c', true);
    expect(accuracy(p)).toBe(67);
  });
});

describe('restoreProgress', () => {
  it('保存した値を往復できる', () => {
    let p = emptyProgress();
    p = record(p, 'meaning:温故知新', false);
    const restored = restoreProgress(JSON.stringify(p));
    expect(restored).toEqual(p);
  });

  it('null・壊れたJSON・版違いは空の成績に落ちる', () => {
    expect(restoreProgress(null)).toEqual(emptyProgress());
    expect(restoreProgress('{broken')).toEqual(emptyProgress());
    expect(restoreProgress('{"version":0}')).toEqual(emptyProgress());
  });
});
