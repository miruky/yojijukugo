// モダンSVGアイコン集。viewBox指定・currentColor追従。装飾はaria-hidden、
// 意味のあるロゴにはtitleを持たせる。絵文字は使わない。

/** ロゴ。四字(田の字)の升目に、答えの一升と落款の朱点。 */
export const logo = `<svg class="logo" viewBox="0 0 48 48" role="img" aria-labelledby="logo-title">
  <title id="logo-title">yojijukugoのロゴ。四字を表す升目</title>
  <rect x="5.5" y="5.5" width="37" height="37" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/>
  <path d="M24 6.5V41.5M6.5 24H41.5" stroke="currentColor" stroke-width="1.2" opacity="0.5"/>
  <rect x="25.5" y="25.5" width="15.5" height="15.5" rx="2" fill="var(--accent)" opacity="0.16"/>
  <circle cx="33.2" cy="33.2" r="3.4" fill="var(--seal)"/>
</svg>`;

const ICON = (body: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${body}</svg>`;

export const search = ICON(
  `<circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.6"/>
   <path d="M15.5 15.5L20 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>`,
);

export const github = ICON(
  `<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 0 1 2.5-.34c.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.26 10.26 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"/>`,
);

export const arrowRight = ICON(
  `<path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
);

export const check = ICON(
  `<path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
);

export const cross = ICON(
  `<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`,
);
