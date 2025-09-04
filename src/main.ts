import './style.css';
import {
  accuracy,
  buildQuestion,
  createRng,
  idioms,
  originLabels,
  rebuildFromId,
  record,
  restoreProgress,
  weakIds,
} from './lib';
import type { Progress, Question, QuestionKind } from './lib';
import { applyTheme, loadTheme, nextTheme, THEME_LABEL } from './theme';
import type { ThemeMode } from './theme';
import { arrowRight, check, cross, github, logo, search } from './icons';

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

function mustFind<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`${selector} が見つからない`);
  return el;
}

applyTheme(loadTheme());

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
  <nav class="tabs-bar" id="tabs" role="tablist" aria-label="出題モード"></nav>
  <main class="stage" id="stage" tabindex="-1">
    <section class="quiz" id="quiz" aria-label="出題">
      <div class="scoreline" id="scoreline" aria-label="成績"></div>
      <div class="question" id="question" aria-live="polite"></div>
    </section>
    <section class="dict" id="dict" hidden aria-label="辞典">
      <div class="dict-toolbar">
        <div class="dict-search">
          ${search}
          <input id="dict-search" type="search" aria-label="辞典を検索"
            placeholder="語・読み・意味・由来で探す" />
        </div>
        <span class="dict-count" id="dict-count"></span>
      </div>
      <ul class="dict-list" id="dict-list"></ul>
    </section>
  </main>
  <footer class="site-footer">
    <span>成績はこのブラウザのlocalStorageにだけ保存される</span>
    <span>${idioms.length}語収録 / MIT License</span>
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
const themeToggle = mustFind<HTMLButtonElement>('#theme-toggle');

let theme: ThemeMode = loadTheme();
let tab: Tab = 'meaning';
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

function renderTabs(): void {
  tabsBar.textContent = '';
  for (const t of TABS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab';
    btn.role = 'tab';
    btn.setAttribute('aria-selected', String(tab === t.key));
    const label = document.createElement('span');
    label.textContent = t.label;
    btn.append(label);
    if (t.key === 'review') {
      const count = document.createElement('span');
      count.className = 'tab-count';
      count.textContent = String(weakIds(progress).length);
      btn.append(count);
    }
    btn.addEventListener('click', () => {
      tab = t.key;
      renderTabs();
      renderStage();
    });
    tabsBar.append(btn);
  }
}

function renderScore(): void {
  const items: { key: string; val: string; unit?: string }[] = [
    { key: '解答', val: String(progress.total) },
    { key: '正答率', val: String(accuracy(progress)), unit: '%' },
    { key: '連続', val: String(progress.streak) },
    { key: '自己最高', val: String(progress.bestStreak) },
  ];
  scoreline.textContent = '';
  for (const it of items) {
    const score = document.createElement('div');
    score.className = 'score';
    const key = document.createElement('span');
    key.className = 'score-key kicker';
    key.textContent = it.key;
    const val = document.createElement('span');
    val.className = 'score-val';
    val.textContent = it.val;
    if (it.unit) {
      const unit = document.createElement('span');
      unit.className = 'unit';
      unit.textContent = it.unit;
      val.append(unit);
    }
    score.append(key, val);
    scoreline.append(score);
  }
}

function nextQuestion(): void {
  answered = false;
  if (tab === 'review') {
    const ids = weakIds(progress);
    const id = ids[Math.floor(rng() * ids.length)];
    current = id !== undefined ? (rebuildFromId(id, idioms, rng) ?? null) : null;
  } else if (tab !== 'dict') {
    current = buildQuestion(tab, idioms, rng);
  }
  renderQuestion();
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
  renderScore();

  if (tab === 'review' && current === null) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent =
      weakIds(progress).length === 0
        ? '苦手はまだない。まちがえた問題がここに積まれ、正解するまで再び出題される。'
        : '問題を組み立てられなかった。別のモードを試す。';
    questionBox.append(empty);
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
    btn.style.setProperty('--d', `${idx * 55}ms`);
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
  renderScore();
  renderTabs();

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
  next.addEventListener('click', nextQuestion);
  nextRow.append(next);

  feedback.append(verdictRow, meaning, origin, nextRow);
  questionBox.append(feedback);
  next.focus();
}

function renderDict(): void {
  const term = dictSearch.value.trim();
  const hits = idioms.filter(
    (i) =>
      term === '' ||
      i.word.includes(term) ||
      i.reading.includes(term) ||
      i.meaning.includes(term) ||
      i.originNote.includes(term),
  );
  dictList.textContent = '';
  hits.forEach((i, idx) => {
    const li = document.createElement('li');
    li.className = 'dict-entry';
    li.style.setProperty('--d', `${Math.min(idx, 12) * 28}ms`);

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
  });
  dictCount.textContent = `${hits.length}語`;
}

function renderStage(): void {
  const isDict = tab === 'dict';
  quizSection.hidden = isDict;
  dictSection.hidden = !isDict;
  if (isDict) {
    renderDict();
    dictSearch.focus();
  } else {
    nextQuestion();
  }
}

dictSearch.addEventListener('input', renderDict);

renderThemeButton();
renderTabs();
renderStage();
