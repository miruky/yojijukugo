import { describe, expect, it } from 'vitest';
import { parseQuizKey } from './keys';

describe('parseQuizKey', () => {
  it('解答前は数字キーが選択になる', () => {
    expect(parseQuizKey('1', 4, false)).toEqual({ type: 'select', index: 0 });
    expect(parseQuizKey('4', 4, false)).toEqual({ type: 'select', index: 3 });
  });

  it('選択肢の数を超える数字は無視する', () => {
    expect(parseQuizKey('5', 4, false)).toBeNull();
    expect(parseQuizKey('0', 4, false)).toBeNull();
  });

  it('解答前の Enter や文字キーは何も起こさない', () => {
    expect(parseQuizKey('Enter', 4, false)).toBeNull();
    expect(parseQuizKey('a', 4, false)).toBeNull();
  });

  it('解答後は Enter・Space・n で次へ進む', () => {
    expect(parseQuizKey('Enter', 4, true)).toEqual({ type: 'next' });
    expect(parseQuizKey(' ', 4, true)).toEqual({ type: 'next' });
    expect(parseQuizKey('n', 4, true)).toEqual({ type: 'next' });
  });

  it('解答後の数字キーは選択し直さない', () => {
    expect(parseQuizKey('1', 4, true)).toBeNull();
  });
});
