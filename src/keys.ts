// 出題画面のキーボード操作を、入力に依存しない純粋な対応づけにする。
// 数字キーで選択、解答後は Enter / Space / n で次へ。
export type QuizAction = { type: 'select'; index: number } | { type: 'next' } | null;

export function parseQuizKey(key: string, choiceCount: number, answered: boolean): QuizAction {
  if (answered) {
    if (key === 'Enter' || key === ' ' || key === 'n' || key === 'N') return { type: 'next' };
    return null;
  }
  if (/^[1-9]$/.test(key)) {
    const index = Number(key) - 1;
    if (index < choiceCount) return { type: 'select', index };
  }
  return null;
}
