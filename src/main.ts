import './style.css';
import {
  accuracy,
  buildQuestion,
  createRng,
  emptyProgress,
  idioms,
  originLabels,
  rebuildFromId,
  record,
  restoreProgress,
  weakIds,
} from './lib';
import type { Origin, Progress, Question, QuestionKind } from './lib';
import { applyTheme, loadTheme, nextTheme, THEME_LABEL } from './theme';
import type { ThemeMode } from './theme';
import { arrowRight, check, cross, github, logo, search } from './icons';
import { countTo, initMotion, revealFeedback, revealQuestion } from './motion';
import { formatHash, parseHash } from './url';
import { parseQuizKey } from './keys';

const STORE_KEY = 'yojijukugo:progress';
const MASK = '〇';

type Tab = QuestionKind | 'review' | 'dict';

const TABS: { key: Tab; label: string }[] = [
  { key: 'meaning', label: '意味' },
  { key: 'reading', label: '読み' },
  { key: 'fill', label: '虫食い' },
  { key: 'review', label: '復習' },
  { key: 'dict', label: '辞典' },
];

const Q_LABEL: Record<QuestionKind, string> = {
  meaning: '次の意味にあたる四字熟語は',
  reading: 'この四字熟語の読みは',
  fill: '升目に入る漢字は',
};

const THEME_GLYPH: Record<ThemeMode, string> = { auto: '自', light: '明', dark: '暗' };
const ORIGINS: Origin[] = ['kanseki', 'bukkyo', 'nihon', 'general'];

function mustFind<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`${selector} が見つからない`);
  return el;
}

applyTheme(loadTheme());
initMotion();

const app = mustFind<HTMLDivElement>('#app');

app.innerHTML = `
  <header class="site-header">
    <div class="brand">
      ${logo}
      <div>
        <div class="brand-name">四字熟語</div>
        <div class="brand-romaji">yojijukugo</div>
      </div>
    </div>
    <div class="header-tools">
      <button type="button" class="icon-btn theme-toggle" id="theme-toggle">
        <span class="theme-label" aria-hidden="true"></span>
      </button>
      <a class="icon-btn" href="https://github.com/miruky/yojijukugo" rel="noopener"
        aria-label="GitHubのソースコード">${github}</a>
    </div>
  </header>
  <div class="sr-only" id="sr-status" role="status" aria-live="polite"></div>
  <nav class="tabs-bar" id="tabs" role="tablist" aria-label="出題モード"></nav>
  <main class="stage" id="stage" tabindex="-1">
    <section class="quiz" id="quiz" role="tabpanel" aria-label="出題">
      <div class="scoreline" id="scoreline" aria-label="成績"></div>
      <div class="question" id="question"></div>
      <p class="kbd-hint" aria-hidden="true">1〜4キーで解答、Enterで次の問題へ</p>
    </section>
    <section class="dict" id="dict" role="tabpanel" hidden aria-label="辞典">
      <div class="dict-toolbar">
        <div class="dict-search">
          ${search}
          <input id="dict-search" type="search" aria-label="辞典を検索"
            placeholder="語・読み・意味・由来で探す" />
        </div>
        <span class="dict-count" id="dict-count"></span>
      </div>
      <div class="dict-filters" id="dict-filters" role="group" aria-label="由来でしぼり込む"></div>
      <ul class="dict-list" id="dict-list"></ul>
    </section>
  </main>
  <footer class="site-footer">
    <div class="data-actions">
      <button type="button" class="link-btn" id="export-btn">成績を書き出す</button>
      <button type="button" class="link-btn" id="import-btn">読み込む</button>
      <button type="button" class="link-btn" id="reset-btn">消す</button>
      <input type="file" id="import-file" accept="application/json,.json" hidden />
    </div>
    <span class="foot-note">成績はこの端末にだけ保存 / ${idioms.length}語収録 / MIT License</span>
  </footer>
`;

const tabsBar = mustFind<HTMLElement>('#tabs');
const quizSection = mustFind<HTMLElement>('#quiz');
const dictSection = mustFind<HTMLElement>('#dict');
const scoreline = mustFind<HTMLDivElement>('#scoreline');
const questionBox = mustFind<HTMLDivElement>('#question');
const dictSearch = mustFind<HTMLInputElement>('#dict-search');
const dictList = mustFind<HTMLUListElement>('#dict-list');
const dictCount = mustFind<HTMLSpanElement>('#dict-count');
const dictFilters = mustFind<HTMLDivElement>('#dict-filters');
const themeToggle = mustFind<HTMLButtonElement>('#theme-toggle');
const importFile = mustFind<HTMLInputElement>('#import-file');
const srStatus = mustFind<HTMLElement>('#sr-status');

// スクリーンリーダーに簡潔な状況を伝える。同じ文でも読み上げ直すため一度空にする。
function announce(message: string): void {
  srStatus.textContent = '';
  requestAnimationFrame(() => {
    srStatus.textContent = message;
  });
}

let theme: ThemeMode = loadTheme();
let tab: Tab = 'meaning';
let dictOrigin: Origin | 'all' = 'all';
let progress: Progress;
try {
  progress = restoreProgress(localStorage.getItem(STORE_KEY));
} catch {
  progress = restoreProgress(null);
}
const rng = createRng(Date.now() >>> 0);
let current: Question | null = null;
let answered = false;

function persist(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(progress));
  } catch {
    // 保存できなくても出題は続ける
  }
}

function renderThemeButton(): void {
  const glyph = themeToggle.querySelector('.theme-label');
  if (glyph) glyph.textContent = THEME_GLYPH[theme];
  themeToggle.setAttribute('aria-label', `表示テーマ: ${THEME_LABEL[theme]}。押すと切り替え`);
}

themeToggle.addEventListener('click', () => {
  theme = nextTheme(theme);
  applyTheme(theme);
  renderThemeButton();
});

function selectTab(key: Tab): void {
  if (tab === key) return;
  tab = key;
  renderTabs();
  renderStage();
  syncHash();
}

function renderTabs(): void {
  tabsBar.textContent = '';
  for (const t of TABS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab';
    btn.role = 'tab';
    btn.tabIndex = tab === t.key ? 0 : -1;
    btn.setAttribute('aria-selected', String(tab === t.key));
    btn.setAttribute('aria-controls', t.key === 'dict' ? 'dict' : 'quiz');
    const label = document.createElement('span');
    label.textContent = t.label;
    btn.append(label);
    if (t.key === 'review') {
      const count = document.createElement('span');
      count.className = 'tab-count';
      count.textContent = String(weakIds(progress).length);
      count.setAttribute('aria-label', `苦手 ${weakIds(progress).length}件`);
      btn.append(count);
    }
    btn.addEventListener('click', () => selectTab(t.key));
    tabsBar.append(btn);
  }
}

// タブリストは左右・Home・Endキーで移動し、移動先をそのまま選ぶ。
tabsBar.addEventListener('keydown', (e) => {
  const moves: Record<string, number | 'home' | 'end'> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    Home: 'home',
    End: 'end',
  };
  const move = moves[e.key];
  if (move === undefined) return;
  e.preventDefault();
  const cur = TABS.findIndex((t) => t.key === tab);
  let next: number;
  if (move === 'home') next = 0;
  else if (move === 'end') next = TABS.length - 1;
  else next = (cur + move + TABS.length) % TABS.length;
  selectTab(TABS[next]!.key);
  tabsBar.querySelectorAll<HTMLElement>('.tab')[next]?.focus();
});

const SCORE_DEFS: { key: string; get: (p: Progress) => number; unit?: string }[] = [
  { key: '解答', get: (p) => p.total },
  { key: '正答率', get: (p) => accuracy(p), unit: '%' },
  { key: '連続', get: (p) => p.streak },
  { key: '自己最高', get: (p) => p.bestStreak },
];
const scoreNums: HTMLElement[] = [];

function buildScoreline(): void {
  scoreline.textContent = '';
  scoreNums.length = 0;
  for (const def of SCORE_DEFS) {
    const score = document.createElement('div');
    score.className = 'score';
    const key = document.createElement('span');
    key.className = 'score-key kicker';
    key.textContent = def.key;
    const val = document.createElement('span');
    val.className = 'score-val';
    const num = document.createElement('span');
    num.textContent = '0';
    num.dataset.value = '0';
    val.append(num);
    if (def.unit) {
      const unit = document.createElement('span');
      unit.className = 'unit';
      unit.textContent = def.unit;
      val.append(unit);
    }
    score.append(key, val);
    scoreline.append(score);
    scoreNums.push(num);
  }
}

function updateScore(): void {
  SCORE_DEFS.forEach((def, i) => {
    const el = scoreNums[i];
    if (el) countTo(el, def.get(progress));
  });
}

function nextQuestion(focusFirst = false): void {
  answered = false;
  if (tab === 'review') {
    const ids = weakIds(progress);
    const id = ids[Math.floor(rng() * ids.length)];
    current = id !== undefined ? (rebuildFromId(id, idioms, rng) ?? null) : null;
  } else if (tab !== 'dict') {
    current = buildQuestion(tab, idioms, rng);
  }
  renderQuestion();
  if (focusFirst) questionBox.querySelector<HTMLElement>('.choice')?.focus();
}

function renderKanjiFrame(word: string, maskChar?: string): HTMLDivElement {
  const frame = document.createElement('div');
  frame.className = 'kanji-frame';
  frame.setAttribute('aria-hidden', 'true');
  for (const ch of [...word]) {
    const cell = document.createElement('div');
    cell.className = 'kanji-cell';
    if (ch === maskChar) {
      cell.classList.add('masked');
      cell.textContent = '？';
    } else {
      cell.textContent = ch;
    }
    frame.append(cell);
  }
  return frame;
}

function renderQuestion(): void {
  questionBox.textContent = '';
  updateScore();

  if (tab === 'review' && current === null) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent =
      weakIds(progress).length === 0
        ? '苦手はまだない。まちがえた問題がここに積まれ、正解するまで再び出題される。'
        : '問題を組み立てられなかった。別のモードを試す。';
    questionBox.append(empty);
    announce(empty.textContent);
    return;
  }
  if (!current) return;
  const q = current;

  const label = document.createElement('p');
  label.className = 'q-label kicker';
  label.textContent = Q_LABEL[q.kind];
  questionBox.append(label);

  if (q.kind === 'meaning') {
    const prompt = document.createElement('p');
    prompt.className = 'prompt-text';
    prompt.lang = 'ja';
    prompt.textContent = q.prompt;
    questionBox.append(prompt);
  } else {
    questionBox.append(renderKanjiFrame(q.prompt, q.kind === 'fill' ? MASK : undefined));
    // 升目は装飾としてaria-hiddenなので、読み上げ用に問いの語を別に置く
    const srPrompt = document.createElement('p');
    srPrompt.className = 'sr-only';
    srPrompt.lang = 'ja';
    srPrompt.textContent = q.prompt;
    questionBox.append(srPrompt);
  }

  const isKanji = q.kind === 'fill';
  const isWord = q.kind === 'meaning';
  const choices = document.createElement('div');
  choices.className = `choices ${isKanji ? 'kanji' : 'list'}`;
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', '選択肢');
  q.choices.forEach((c, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `choice${isWord ? ' is-word' : ''}`;
    const index = document.createElement('span');
    index.className = 'choice-index';
    index.textContent = String(idx + 1);
    const body = document.createElement('span');
    body.className = 'choice-body';
    body.textContent = c;
    if (isKanji || isWord) body.lang = 'ja';
    btn.append(index, body);
    btn.addEventListener('click', () => answer(idx, btn));
    choices.append(btn);
  });
  questionBox.append(choices);
  announce(`${Q_LABEL[q.kind]}。${q.prompt}`);
  revealQuestion(questionBox);
}

function markIcon(kind: 'ok' | 'ng'): SVGElement {
  const tpl = document.createElement('template');
  tpl.innerHTML = (kind === 'ok' ? check : cross).trim();
  const svg = tpl.content.firstElementChild as SVGElement;
  svg.classList.add('choice-mark');
  return svg;
}

function answer(idx: number, btn: HTMLButtonElement): void {
  if (answered || !current) return;
  answered = true;
  const q = current;
  const isCorrect = idx === q.answerIndex;
  progress = record(progress, q.id, isCorrect);
  persist();
  updateScore();
  renderTabs();
  announce(`${isCorrect ? '正解' : '不正解'}。${q.idiom.word}、${q.idiom.reading}。${q.idiom.meaning}`);

  const buttons = questionBox.querySelectorAll<HTMLButtonElement>('.choice');
  buttons.forEach((b, i) => {
    b.disabled = true;
    if (i === q.answerIndex) {
      b.classList.add('correct');
      b.append(markIcon('ok'));
    }
  });
  if (!isCorrect) {
    btn.classList.add('wrong');
    btn.append(markIcon('ng'));
  }

  const feedback = document.createElement('div');
  feedback.className = `feedback ${isCorrect ? 'ok' : 'ng'}`;

  const verdictRow = document.createElement('div');
  verdictRow.className = 'verdict-row';
  const verdict = document.createElement('span');
  verdict.className = 'verdict';
  verdict.textContent = isCorrect ? '正解' : '不正解';
  const word = document.createElement('span');
  word.className = 'answer-word';
  word.lang = 'ja';
  word.textContent = q.idiom.word;
  const reading = document.createElement('span');
  reading.className = 'answer-reading';
  reading.textContent = q.idiom.reading;
  verdictRow.append(verdict, word, reading);

  const meaning = document.createElement('p');
  meaning.className = 'entry-meaning';
  meaning.textContent = q.idiom.meaning;

  const origin = document.createElement('div');
  origin.className = 'origin';
  const originLabel = document.createElement('span');
  originLabel.className = 'origin-label kicker';
  originLabel.textContent = originLabels[q.idiom.origin];
  const originNote = document.createElement('p');
  originNote.className = 'origin-note';
  originNote.textContent = q.idiom.originNote;
  origin.append(originLabel, originNote);

  const nextRow = document.createElement('div');
  nextRow.className = 'next-row';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'next-btn';
  next.innerHTML = `<span>次の問題</span>${arrowRight}`;
  next.addEventListener('click', () => nextQuestion(true));
  nextRow.append(next);

  feedback.append(verdictRow, meaning, origin, nextRow);
  questionBox.append(feedback);
  revealFeedback(feedback);
  next.focus();
}

function renderDictFilters(): void {
  dictFilters.textContent = '';
  const addChip = (key: Origin | 'all', label: string): void => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip kicker';
    chip.setAttribute('aria-pressed', String(dictOrigin === key));
    chip.textContent = label;
    chip.addEventListener('click', () => {
      dictOrigin = key;
      renderDictFilters();
      renderDict();
    });
    dictFilters.append(chip);
  };
  addChip('all', 'すべて');
  for (const o of ORIGINS) addChip(o, originLabels[o]);
}

function renderDict(): void {
  const term = dictSearch.value.trim();
  const hits = idioms.filter((i) => {
    if (dictOrigin !== 'all' && i.origin !== dictOrigin) return false;
    if (term === '') return true;
    return (
      i.word.includes(term) ||
      i.reading.includes(term) ||
      i.meaning.includes(term) ||
      i.originNote.includes(term)
    );
  });
  dictList.textContent = '';
  for (const i of hits) {
    const li = document.createElement('li');
    li.className = 'dict-entry';

    const head = document.createElement('div');
    head.className = 'entry-head';
    const word = document.createElement('span');
    word.className = 'entry-word';
    word.lang = 'ja';
    word.textContent = i.word;
    const reading = document.createElement('span');
    reading.className = 'entry-reading';
    reading.textContent = i.reading;
    const badge = document.createElement('span');
    badge.className = 'entry-badge kicker';
    badge.textContent = originLabels[i.origin];
    head.append(word, reading, badge);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'entry-body';
    const meaning = document.createElement('p');
    meaning.className = 'entry-meaning';
    meaning.textContent = i.meaning;
    const note = document.createElement('p');
    note.className = 'entry-note';
    note.textContent = i.originNote;
    bodyEl.append(meaning, note);

    li.append(head, bodyEl);
    dictList.append(li);
  }
  if (hits.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = '当てはまる語がない。検索語や絞り込みを変える。';
    dictList.append(empty);
  }
  dictCount.textContent = `${hits.length}語`;
}

function renderStage(): void {
  const isDict = tab === 'dict';
  quizSection.hidden = isDict;
  dictSection.hidden = !isDict;
  if (isDict) {
    renderDictFilters();
    renderDict();
    dictSearch.focus();
  } else {
    nextQuestion();
  }
}

// ── URLハッシュとの同期 ──

function syncHash(): void {
  const target = formatHash(tab, tab === 'dict' ? dictSearch.value : '');
  if (location.hash !== target) history.replaceState(null, '', target);
}

function applyRouteFromHash(): void {
  const route = parseHash(location.hash);
  if (!route) return;
  const sameTab = route.tab === tab;
  const sameQuery = route.tab !== 'dict' || route.query === dictSearch.value;
  if (sameTab && sameQuery) return;
  tab = route.tab;
  if (route.tab === 'dict') dictSearch.value = route.query;
  renderTabs();
  renderStage();
}

// ── キーボード操作 ──

document.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement | null;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (tab === 'dict' || !current) return;
  const action = parseQuizKey(e.key, current.choices.length, answered);
  if (!action) return;
  e.preventDefault();
  if (action.type === 'select') {
    const btns = questionBox.querySelectorAll<HTMLButtonElement>('.choice');
    const b = btns[action.index];
    if (b) answer(action.index, b);
  } else {
    nextQuestion(true);
  }
});

// ── 成績の書き出し・読み込み・消去 ──

function exportProgress(): void {
  const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'yojijukugo-progress.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importProgress(file: File): void {
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    progress = restoreProgress(typeof reader.result === 'string' ? reader.result : null);
    persist();
    updateScore();
    renderTabs();
  });
  reader.readAsText(file);
}

function resetProgress(): void {
  if (!window.confirm('保存した成績と苦手リストを消す。よろしいか。')) return;
  progress = emptyProgress();
  persist();
  updateScore();
  renderTabs();
}

mustFind<HTMLButtonElement>('#export-btn').addEventListener('click', exportProgress);
mustFind<HTMLButtonElement>('#import-btn').addEventListener('click', () => importFile.click());
mustFind<HTMLButtonElement>('#reset-btn').addEventListener('click', resetProgress);
importFile.addEventListener('change', () => {
  const file = importFile.files?.[0];
  if (file) importProgress(file);
  importFile.value = '';
});

dictSearch.addEventListener('input', () => {
  renderDict();
  syncHash();
});

window.addEventListener('hashchange', applyRouteFromHash);

// ── 起動 ──

const initialRoute = parseHash(location.hash);
if (initialRoute) {
  tab = initialRoute.tab;
  if (initialRoute.tab === 'dict') dictSearch.value = initialRoute.query;
}

renderThemeButton();
buildScoreline();
renderTabs();
renderStage();
syncHash();
