// URLのハッシュにモードと辞典の検索語を載せ、共有・ブックマークできるようにする。
// 例: #reading 、 #dict 、 #dict/温故知新
export type RouteTab = 'meaning' | 'reading' | 'fill' | 'mixed' | 'review' | 'dict';

const ROUTE_TABS: readonly RouteTab[] = ['meaning', 'reading', 'fill', 'mixed', 'review', 'dict'];

export function isRouteTab(value: string): value is RouteTab {
  return (ROUTE_TABS as readonly string[]).includes(value);
}

export interface Route {
  tab: RouteTab;
  query: string;
}

/** location.hash を解釈する。未知のモードは null。 */
export function parseHash(hash: string): Route | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;
  const slash = raw.indexOf('/');
  const tabPart = slash === -1 ? raw : raw.slice(0, slash);
  let tab: string;
  try {
    tab = decodeURIComponent(tabPart);
  } catch {
    return null;
  }
  if (!isRouteTab(tab)) return null;
  let query = '';
  if (tab === 'dict' && slash !== -1) {
    try {
      query = decodeURIComponent(raw.slice(slash + 1));
    } catch {
      query = '';
    }
  }
  return { tab, query };
}

/** 現在のモードと検索語をハッシュ文字列にする。 */
export function formatHash(tab: RouteTab, query = ''): string {
  if (tab === 'dict' && query.trim() !== '') {
    return `#dict/${encodeURIComponent(query.trim())}`;
  }
  return `#${tab}`;
}
