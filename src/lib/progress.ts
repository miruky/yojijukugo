/** 成績と苦手リスト。localStorageに保存できる素のオブジェクトとして扱う */
export interface Progress {
  version: 1;
  total: number;
  correct: number;
  streak: number;
  bestStreak: number;
  /** 問題id -> 残り正解必要回数。正解すると減り、0で苦手から外れる */
  weak: Record<string, number>;
}

export function emptyProgress(): Progress {
  return { version: 1, total: 0, correct: 0, streak: 0, bestStreak: 0, weak: {} };
}

export function record(p: Progress, questionId: string, isCorrect: boolean): Progress {
  const weak = { ...p.weak };
  if (isCorrect) {
    const left = weak[questionId];
    if (left !== undefined) {
      if (left <= 1) delete weak[questionId];
      else weak[questionId] = left - 1;
    }
  } else {
    weak[questionId] = 1;
  }
  const streak = isCorrect ? p.streak + 1 : 0;
  return {
    version: 1,
    total: p.total + 1,
    correct: p.correct + (isCorrect ? 1 : 0),
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    weak,
  };
}

export function weakIds(p: Progress): string[] {
  return Object.keys(p.weak);
}

export function accuracy(p: Progress): number {
  return p.total === 0 ? 0 : Math.round((p.correct / p.total) * 100);
}

/** localStorageから復元する。壊れた値や旧版は捨てて空から始める */
export function restoreProgress(raw: string | null): Progress {
  if (raw === null) return emptyProgress();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { version?: unknown }).version === 1 &&
      typeof (parsed as { total?: unknown }).total === 'number'
    ) {
      return parsed as Progress;
    }
  } catch {
    // 解釈できない保存値は捨てる
  }
  return emptyProgress();
}
