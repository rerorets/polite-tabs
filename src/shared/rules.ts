import { COLOR_NAMES, type GroupColor } from './colors';

/**
 * - `wildcard`: patterns are separated by whitespace; `*` matches anything and the
 *   rest is matched literally as a substring.
 * - `regex`: one regular expression per line.
 */
export type PatternSyntax = 'wildcard' | 'regex';

export interface GroupRule {
  id: number;
  /** Position in the list; also decides the order of groups in the tab strip. */
  key: number;
  name: string;
  /** URL patterns. */
  pattern: string;
  /** Page title patterns. A tab matches when its URL or its title matches. */
  titlePattern?: string;
  syntax?: PatternSyntax;
  color?: GroupColor;
}

export interface TabInfo {
  url: string;
  title?: string;
}

export const SEED_RULES: Omit<GroupRule, 'id'>[] = [
  { key: 0, name: 'mail', pattern: 'mail.google.com outlook.com https://mail.*', color: 'grey' },
  { key: 1, name: 'google', pattern: 'google.com', color: 'blue' },
  { key: 2, name: 'social', pattern: 'twitter.com instagram.com linkedin.com', color: 'yellow' },
  { key: 3, name: 'entertainment', pattern: 'reddit.com youtube.com pinterest.com', color: 'purple' },
  { key: 4, name: 'news', pattern: 'news.*', color: 'green' },
];

const escapeRegExp = (text: string) => text.replace(/[.*+?^=!:${}()|[\]/\\]/g, '\\$&');

export const syntaxOf = (rule: Pick<GroupRule, 'syntax'>): PatternSyntax => rule.syntax ?? 'wildcard';

/** Splits a pattern field into individual patterns according to the rule's syntax. */
export const splitPatterns = (field: string | undefined, syntax: PatternSyntax = 'wildcard'): string[] =>
  (field ?? '')
    .split(syntax === 'regex' ? /\n/ : /\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

const compiled = new Map<string, RegExp | null>();

/** Compiles one pattern, or returns null when it is not a valid regular expression. */
export const compilePattern = (pattern: string, syntax: PatternSyntax): RegExp | null => {
  const cacheKey = `${syntax}:${pattern}`;
  if (compiled.has(cacheKey)) return compiled.get(cacheKey)!;
  let re: RegExp | null;
  try {
    const source = syntax === 'regex' ? pattern : pattern.split('*').map(escapeRegExp).join('.*');
    re = new RegExp(source, 'i');
  } catch {
    re = null;
  }
  compiled.set(cacheKey, re);
  return re;
};

/** Returns a message for each pattern that is not a valid regular expression. */
export const patternErrors = (rule: Pick<GroupRule, 'pattern' | 'titlePattern' | 'syntax'>): string[] => {
  const syntax = syntaxOf(rule);
  if (syntax !== 'regex') return [];
  return [...splitPatterns(rule.pattern, syntax), ...splitPatterns(rule.titlePattern, syntax)]
    .filter((p) => compilePattern(p, syntax) === null)
    .map((p) => `正規表現として読めません：${p}`);
};

export const sortRules = (rules: readonly GroupRule[]): GroupRule[] =>
  [...rules].sort((a, b) => a.key - b.key);

export const isRuleComplete = (
  rule: Pick<GroupRule, 'name' | 'pattern' | 'titlePattern' | 'syntax'>
): boolean =>
  rule.name.trim().length > 0 &&
  splitPatterns(rule.pattern, syntaxOf(rule)).length +
    splitPatterns(rule.titlePattern, syntaxOf(rule)).length >
    0;

const anyMatches = (field: string | undefined, syntax: PatternSyntax, text: string | undefined) =>
  text !== undefined &&
  text.length > 0 &&
  splitPatterns(field, syntax).some((p) => compilePattern(p, syntax)?.test(text) ?? false);

export const ruleMatches = (rule: GroupRule, tab: TabInfo): boolean => {
  const syntax = syntaxOf(rule);
  return anyMatches(rule.pattern, syntax, tab.url) || anyMatches(rule.titlePattern, syntax, tab.title);
};

/** Returns the first rule (in list order) that matches the tab's URL or title. */
export const findMatchingRule = (tab: TabInfo, rules: readonly GroupRule[]): GroupRule | undefined =>
  sortRules(rules).find((rule) => isRuleComplete(rule) && ruleMatches(rule, tab));

/** Picks the color used by the fewest rules, so new rules stand apart from existing ones. */
export const pickLeastUsedColor = (rules: readonly Pick<GroupRule, 'color'>[]): GroupColor => {
  const counts = new Map<GroupColor, number>(COLOR_NAMES.map((c) => [c, 0]));
  for (const rule of rules) {
    if (rule.color) counts.set(rule.color, (counts.get(rule.color) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => a[1] - b[1])[0]![0];
};

/** Rules saved before colors were mandatory have none; fall back to a stable color by position. */
export const colorForRule = (rule: GroupRule, rules: readonly GroupRule[]): GroupColor => {
  if (rule.color) return rule.color;
  const index = sortRules(rules).findIndex((r) => r.id === rule.id);
  return COLOR_NAMES[Math.max(index, 0) % COLOR_NAMES.length]!;
};

export const groupTitle = (name: string, showCount: boolean, tabCount: number): string =>
  showCount && tabCount > 0 ? `${name} (${tabCount})` : name;

/** Reverses `groupTitle`, so a group can be recognised by its title alone. */
export const baseGroupTitle = (title: string): string => title.replace(/ \(\d+\)$/, '');

export const newRuleId = (existing: readonly Pick<GroupRule, 'id'>[]): number => {
  const used = new Set(existing.map((r) => r.id));
  let id: number;
  do {
    id = Math.floor(Math.random() * 2 ** 31);
  } while (used.has(id) || id === 0);
  return id;
};

/**
 * Rewrites a pattern field when a rule switches syntax, so its meaning survives:
 * wildcards become escaped expressions on separate lines. Going back, expressions
 * are kept as written (there is no general way to turn them into wildcards).
 */
export const convertPatterns = (field: string | undefined, from: PatternSyntax, to: PatternSyntax) => {
  if (!field || from === to) return field;
  const patterns = splitPatterns(field, from);
  if (to === 'regex') return patterns.map((p) => p.split('*').map(escapeRegExp).join('.*')).join('\n');
  return patterns.join('\n');
};
