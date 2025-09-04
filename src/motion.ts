import { gsap } from 'gsap';

// 動きは演出であって機能ではない。reduced-motion のときは初期化せず、
// すべての要素は最初から見えた状態のまま(GSAPに触らせない)。
export function prefersReduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let enabled = false;

export function initMotion(): void {
  if (prefersReduced()) return;
  document.documentElement.classList.add('motion');
  enabled = true;
}

/** 出題の入場。問い・升目(または意味文)・選択肢を順に立ち上げる。 */
export function revealQuestion(box: HTMLElement): void {
  if (!enabled) return;
  const label = box.querySelector('.q-label');
  const subject = box.querySelector('.kanji-frame, .prompt-text');
  const choices = box.querySelectorAll('.choice');
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  if (label) tl.from(label, { opacity: 0, y: 8, duration: 0.4 }, 0);
  if (subject) tl.from(subject, { opacity: 0, y: 12, duration: 0.55 }, 0.06);
  if (choices.length) tl.from(choices, { opacity: 0, y: 10, duration: 0.45, stagger: 0.055 }, 0.16);
}

/** 採点後の解説を静かに開く。 */
export function revealFeedback(el: HTMLElement): void {
  if (!enabled) return;
  gsap.from(el, { opacity: 0, y: 12, duration: 0.5, ease: 'power3.out' });
}

/** 成績の数値を現在値から目標値へ短く回す。tabular-numsで桁が揺れない。 */
export function countTo(el: HTMLElement, to: number): void {
  if (!enabled) {
    el.textContent = String(to);
    return;
  }
  const from = Number(el.dataset.value ?? el.textContent ?? '0') || 0;
  if (from === to) {
    el.textContent = String(to);
    return;
  }
  const state = { v: from };
  gsap.to(state, {
    v: to,
    duration: 0.5,
    ease: 'power2.out',
    onUpdate() {
      el.textContent = String(Math.round(state.v));
    },
    onComplete() {
      el.textContent = String(to);
      el.dataset.value = String(to);
    },
  });
}
