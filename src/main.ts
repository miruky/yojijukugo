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

const STORE_KEY = 'yojijukugo:progress';

const LOGO_SVG = `<svg viewBox="0 0 64 64" role="img" aria-label="yojijukugoのロゴ" class="logo">
  <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="8" y="8" width="22" height="22" rx="4"/>
    <rect x="34" y="8" width="22" height="22" rx="4"/>
    <rect x="8" y="34" width="22" height="22" rx="4"/>
  </g>
  <g fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="34" y="34" width="22" height="22" rx="4"/>
    <path d="M40 45h10"/><path d="M45 40v10"/>
  </g>
</svg>`;

type Tab = QuestionKind | 'review' | 'dict';

const TABS: { key: Tab; label: string }[] = [
  { key: 'meaning', label: '意味から' },
  { key: 'reading', label: '読み' },
  { key: 'fill', label: '虫食い' },
  { key: 'review', label: '苦手復習' },
  { key: 'dict', label: '辞典' },
];

function mustFind<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`${selector} が見つからない`);
  return el;
}

const app = mustFind<HTMLDivElement>('#app');

app.innerHTML = `
  <header class="site-header">
    <div class="brand">
      ${LOGO_SVG}
      <div>
        <h1>yojijukugo</h1>
        <p class="tagline">出典の解説つきで四字熟語を覚えるクイズ。${idioms.length}語収録</p>
      </div>
    </div>
    <a class="repo-link" href="https://github.com/miruky/yojijukugo" rel="noopener">GitHub</a>
  </header>
  <nav class="tabs-bar" aria-label="モード" id="tabs"></nav>
  <main class="stage">
    <section class="pane quiz-pane" id="quiz-pane" aria-label="出題">
      <div class="scorebar" id="scorebar" aria-live="polite"></div>
      <div class="question" id="question"></div>
    </section>
    <section class="pane dict-pane" id="dict-pane" aria-label="辞典" hidden>
      <div class="toolbar">
        <input id="dict-search" type="search" aria-label="辞典を検索"
          placeholder="語・読み・意味で探す" />
        <span class="spacer"></span>
        <span class="dict-count" id="dict-count"></span>
      </div>
      <ul class="dict-list" id="dict-list"></ul>
    </section>
  </main>
  <footer class="site-footer">
    <p>成績はこのブラウザのlocalStorageにだけ保存される。MIT License</p>
  </footer>
`;

const tabsBar = mustFind<HTMLElement>('#tabs');
const quizPane = mustFind<HTMLElement>('#quiz-pane');
const dictPane = mustFind<HTMLElement>('#dict-pane');
const scorebar = mustFind<HTMLDivElement>('#scorebar');
const questionBox = mustFind<HTMLDivElement>('#question');
const dictSearch = mustFind<HTMLInputElement>('#dict-search');
const dictList = mustFind<HTMLUListElement>('#dict-list');
const dictCount = mustFind<HTMLSpanElement>('#dict-count');

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

function renderTabs(): void {
  tabsBar.textContent = '';
  for (const t of TABS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tab${tab === t.key ? ' active' : ''}`;
    btn.setAttribute('aria-pressed', String(tab === t.key));
    const count = t.key === 'review' ? ` ${weakIds(progress).length}` : '';
    btn.textContent = `${t.label}${count}`;
    btn.addEventListener('click', () => {
      tab = t.key;
      renderTabs();
      renderStage();
    });
    tabsBar.append(btn);
  }
}

function renderScore(): void {
  scorebar.innerHTML = [
    `<span>解答 ${progress.total}</span>`,
    `<span>正答率 ${accuracy(progress)}%</span>`,
    `<span>連続 ${progress.streak}</span>`,
    `<span>自己最高 ${progress.bestStreak}</span>`,
  ].join('');
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

function promptHtmlFor(q: Question): { label: string; cls: string } {
  if (q.kind === 'meaning') return { label: '次の意味の四字熟語は?', cls: 'prompt-text' };
  if (q.kind === 'reading') return { label: 'この四字熟語の読みは?', cls: 'prompt-word' };
  return { label: '〇に入る漢字は?', cls: 'prompt-word' };
}

function renderQuestion(): void {
  questionBox.textContent = '';
  renderScore();

  if (tab === 'review' && current === null) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent =
      weakIds(progress).length === 0
        ? '苦手はない。間違えた問題がここに溜まり、正解するまで再出題される。'
        : '問題を組み立てられなかった。別のモードを試す。';
    questionBox.append(empty);
    return;
  }
  if (!current) return;
  const q = current;

  const meta = promptHtmlFor(q);
  const label = document.createElement('p');
  label.className = 'q-label';
  label.textContent = meta.label;

  const prompt = document.createElement('p');
  prompt.className = meta.cls;
  prompt.textContent = q.prompt;
  prompt.lang = 'ja';

  const choices = document.createElement('div');
  choices.className = 'choices';
  q.choices.forEach((c, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `choice${q.kind === 'fill' ? ' choice-kanji' : ''}`;
    btn.style.setProperty('--d', `${idx * 50}ms`);
    btn.textContent = c;
    btn.addEventListener('click', () => answer(idx, btn));
    choices.append(btn);
  });

  questionBox.append(label, prompt, choices);
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
    if (i === q.answerIndex) b.classList.add('correct');
  });
  if (!isCorrect) btn.classList.add('wrong');

  const feedback = document.createElement('div');
  feedback.className = `feedback ${isCorrect ? 'ok' : 'ng'}`;
  const verdict = document.createElement('p');
  verdict.className = 'verdict';
  verdict.textContent = isCorrect ? '正解' : '不正解';
  const expl = document.createElement('p');
  expl.className = 'expl';
  expl.textContent = q.explanation;
  const origin = document.createElement('p');
  origin.className = 'origin';
  origin.textContent = `${originLabels[q.idiom.origin]} - ${q.idiom.originNote}`;
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'primary next-btn';
  next.textContent = '次の問題';
  next.addEventListener('click', nextQuestion);
  feedback.append(verdict, expl, origin, next);
  questionBox.append(feedback);
  next.focus();
}

function renderDict(): void {
  const q = dictSearch.value.trim();
  const hits = idioms.filter(
    (i) =>
      q === '' ||
      i.word.includes(q) ||
      i.reading.includes(q) ||
      i.meaning.includes(q) ||
      i.originNote.includes(q),
  );
  dictList.textContent = '';
  hits.forEach((i, idx) => {
    const li = document.createElement('li');
    li.className = 'dict-entry';
    li.style.setProperty('--d', `${Math.min(idx, 10) * 30}ms`);
    const head = document.createElement('div');
    head.className = 'entry-head';
    const word = document.createElement('span');
    word.className = 'entry-word';
    word.textContent = i.word;
    const reading = document.createElement('span');
    reading.className = 'entry-reading';
    reading.textContent = i.reading;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = originLabels[i.origin];
    head.append(word, reading, badge);
    const meaning = document.createElement('p');
    meaning.className = 'entry-meaning';
    meaning.textContent = i.meaning;
    const note = document.createElement('p');
    note.className = 'entry-note';
    note.textContent = i.originNote;
    li.append(head, meaning, note);
    dictList.append(li);
  });
  dictCount.textContent = `${hits.length}語`;
}

function renderStage(): void {
  const isDict = tab === 'dict';
  quizPane.hidden = isDict;
  dictPane.hidden = !isDict;
  if (isDict) {
    renderDict();
  } else {
    nextQuestion();
  }
}

dictSearch.addEventListener('input', renderDict);

renderTabs();
renderStage();
