import { COLOR_NAMES, isGroupColor, type GroupColor } from './colors';
import {
  isRuleComplete,
  newRuleId,
  patternErrors,
  pickLeastUsedColor,
  sortRules,
  splitPatterns,
  syntaxOf,
  type GroupRule,
  type PatternSyntax,
} from './rules';

/*
 * Bulk edit format. A rule starts with its name on an unindented line, followed by
 * indented "key: value" lines:
 *
 *   📧 mail
 *     color: grey
 *     url: mail.google.com outlook.com
 *     title: Inbox
 *
 * With "syntax: regex", each url/title line holds one regular expression, so a
 * rule can repeat those keys. Lines in the old one-line format
 * ("name, patterns, color") are still accepted, so rules copied from earlier
 * versions can be pasted as they are.
 */

const KEYS = ['color', 'syntax', 'url', 'title'] as const;
type Key = (typeof KEYS)[number];

export const rulesToText = (rules: readonly GroupRule[]): string =>
  sortRules(rules)
    .map((rule) => {
      const syntax = syntaxOf(rule);
      const lines = [rule.name];
      if (rule.color) lines.push(`  color: ${rule.color}`);
      if (syntax === 'regex') lines.push('  syntax: regex');
      const field = (key: 'url' | 'title', value: string | undefined) => {
        const patterns = splitPatterns(value, syntax);
        if (patterns.length === 0) return;
        if (syntax === 'regex') patterns.forEach((p) => lines.push(`  ${key}: ${p}`));
        else lines.push(`  ${key}: ${patterns.join(' ')}`);
      };
      field('url', rule.pattern);
      field('title', rule.titlePattern);
      return lines.join('\n');
    })
    .join('\n\n');

export interface BulkParseError {
  line: number;
  message: string;
}

export interface BulkParseResult {
  rules: GroupRule[];
  errors: BulkParseError[];
}

interface Draft {
  line: number;
  name: string;
  color?: GroupColor;
  syntax: PatternSyntax;
  url: string[];
  title: string[];
}

/**
 * Parses bulk text back into rules. Rules keep their id when a rule with the same
 * name already exists, so their open tab groups stay attached to them.
 */
export const textToRules = (text: string, existing: readonly GroupRule[]): BulkParseResult => {
  const errors: BulkParseError[] = [];
  const drafts: Draft[] = [];
  const lines = text.split('\n');
  let current: Draft | undefined;

  lines.forEach((raw, index) => {
    const line = index + 1;
    if (raw.trim() === '' || raw.trim().startsWith('#')) return;
    const indented = /^\s/.test(raw);

    if (!indented) {
      const nextIndented = /^\s+\S/.test(lines[index + 1] ?? '');
      if (raw.includes(',') && !nextIndented) {
        current = undefined;
        const legacy = parseLegacyLine(raw, line, errors);
        if (legacy) drafts.push(legacy);
        return;
      }
      current = { line, name: raw.trim(), syntax: 'wildcard', url: [], title: [] };
      drafts.push(current);
      return;
    }

    if (!current) {
      errors.push({ line, message: '字下げした行の前に、ルールの名前の行が要ります。' });
      return;
    }
    const match = /^\s*([a-z]+)\s*:\s*(.*)$/i.exec(raw);
    const key = match?.[1]?.toLowerCase() as Key | undefined;
    if (!match || !key || !KEYS.includes(key)) {
      errors.push({ line, message: `「${KEYS.join(':」「')}:」のどれかで書いてください。` });
      return;
    }
    const value = match[2]!.trim();
    if (key === 'color') {
      const color = value.toLowerCase();
      if (!isGroupColor(color)) {
        errors.push({
          line,
          message: `「${value}」という色はありません。${COLOR_NAMES.join(', ')} のどれかを書いてください。`,
        });
        return;
      }
      current.color = color;
    } else if (key === 'syntax') {
      if (value !== 'regex' && value !== 'wildcard') {
        errors.push({ line, message: 'syntax は regex か wildcard です。' });
        return;
      }
      current.syntax = value;
    } else if (value) {
      current[key].push(value);
    }
  });

  const rules: GroupRule[] = [];
  const unclaimed = [...existing];
  for (const draft of drafts) {
    const rule: Omit<GroupRule, 'id'> = {
      key: rules.length,
      name: draft.name,
      pattern: draft.url.join('\n'),
      titlePattern: draft.title.length > 0 ? draft.title.join('\n') : undefined,
      syntax: draft.syntax === 'regex' ? 'regex' : undefined,
      color: draft.color ?? pickLeastUsedColor(rules),
    };
    if (!isRuleComplete(rule)) {
      errors.push({ line: draft.line, message: `「${draft.name}」に url: か title: の条件がありません。` });
      continue;
    }
    for (const message of patternErrors(rule)) errors.push({ line: draft.line, message });

    const matchIndex = unclaimed.findIndex((r) => r.name === draft.name);
    const id = matchIndex >= 0 ? unclaimed.splice(matchIndex, 1)[0]!.id : newRuleId([...existing, ...rules]);
    rules.push({ ...rule, id });
  }

  errors.sort((a, b) => a.line - b.line);
  return { rules, errors };
};

/** The one-line "name, patterns[, color]" format used up to version 6. */
const parseLegacyLine = (raw: string, line: number, errors: BulkParseError[]): Draft | undefined => {
  const fields = raw.split(',').map((f) => f.trim());
  if (fields.length < 2 || fields.length > 3) {
    errors.push({ line, message: '1 行で書くときは「名前, パターン, 色」の形にしてください。' });
    return undefined;
  }
  const [name = '', pattern = '', rawColor] = fields;
  if (!name) {
    errors.push({ line, message: '名前が空です。' });
    return undefined;
  }
  let color: GroupColor | undefined;
  if (rawColor) {
    const normalized = rawColor.toLowerCase();
    if (!isGroupColor(normalized)) {
      errors.push({
        line,
        message: `「${rawColor}」という色はありません。${COLOR_NAMES.join(', ')} のどれかを書いてください。`,
      });
      return undefined;
    }
    color = normalized;
  }
  return { line, name, color, syntax: 'wildcard', url: [pattern], title: [] };
};
