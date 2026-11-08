import { describe, expect, it } from 'vitest';
import {
  baseGroupTitle,
  colorForRule,
  findMatchingRule,
  groupTitle,
  isRuleComplete,
  patternErrors,
  pickLeastUsedColor,
  type GroupRule,
} from './rules';

const rule = (id: number, name: string, pattern: string, extra: Partial<GroupRule> = {}): GroupRule => ({
  id,
  key: id,
  name,
  pattern,
  ...extra,
});

const at = (url: string, title?: string) => ({ url, title });

describe('findMatchingRule with wildcards', () => {
  const rules = [rule(1, 'mail', 'mail.google.com https://mail.*'), rule(2, 'google', 'google.com')];

  it('matches substrings and wildcards', () => {
    expect(findMatchingRule(at('https://mail.google.com/u/0'), rules)?.name).toBe('mail');
    expect(findMatchingRule(at('https://mail.example.org/'), rules)?.name).toBe('mail');
    expect(findMatchingRule(at('https://www.google.com/search'), rules)?.name).toBe('google');
    expect(findMatchingRule(at('https://github.com/'), rules)).toBeUndefined();
  });

  it('treats regex characters literally', () => {
    expect(findMatchingRule(at('https://googleXcom/'), rules)).toBeUndefined();
  });

  it('ignores case', () => {
    expect(findMatchingRule(at('https://WWW.GOOGLE.COM/'), rules)?.name).toBe('google');
  });

  it('prefers the rule that comes first in list order, not array order', () => {
    const reordered = [
      rule(1, 'mail', 'google.com', { key: 1 }),
      rule(2, 'google', 'google.com', { key: 0 }),
    ];
    expect(findMatchingRule(at('https://google.com'), reordered)?.name).toBe('google');
  });

  it('accepts newlines and repeated spaces between patterns', () => {
    expect(findMatchingRule(at('https://b.com'), [rule(1, 'x', 'a.com\n\n  b.com')])?.name).toBe('x');
  });

  it('ignores incomplete rules', () => {
    expect(findMatchingRule(at('https://a.com'), [rule(1, '', 'a.com')])).toBeUndefined();
    expect(isRuleComplete({ name: 'x', pattern: '   ' })).toBe(false);
  });
});

describe('findMatchingRule with titles', () => {
  it('matches on the page title when the URL does not', () => {
    const rules = [rule(1, 'specs', '', { titlePattern: '仕様書 design*doc' })];
    expect(isRuleComplete(rules[0]!)).toBe(true);
    expect(
      findMatchingRule(at('https://docs.google.com/d/1', '決済の仕様書 - Google ドキュメント'), rules)?.name
    ).toBe('specs');
    expect(findMatchingRule(at('https://docs.google.com/d/2', 'Design Doc: tabs'), rules)?.name).toBe(
      'specs'
    );
    expect(findMatchingRule(at('https://docs.google.com/d/3', '議事録'), rules)).toBeUndefined();
    expect(findMatchingRule(at('https://docs.google.com/d/4'), rules)).toBeUndefined();
  });
});

describe('findMatchingRule with regular expressions', () => {
  const rules = [
    rule(1, 'repos', '^https://github\\.com/(rerorets|torihada)/\n^https://gitlab\\.com/', {
      syntax: 'regex',
    }),
  ];

  it('takes one expression per line, so spaces are part of the expression', () => {
    expect(findMatchingRule(at('https://github.com/rerorets/polite-tabs'), rules)?.name).toBe('repos');
    expect(findMatchingRule(at('https://gitlab.com/x'), rules)?.name).toBe('repos');
    expect(findMatchingRule(at('https://github.com/someone/else'), rules)).toBeUndefined();
    const spaced = [rule(2, 'x', '', { syntax: 'regex', titlePattern: 'Pull request #\\d+ by' })];
    expect(findMatchingRule(at('https://a', 'Pull request #12 by me'), spaced)?.name).toBe('x');
  });

  it('reports invalid expressions and skips them when matching', () => {
    const broken = rule(3, 'broken', 'a.com\n(unclosed', { syntax: 'regex' });
    expect(patternErrors(broken)).toEqual(['正規表現として読めません：(unclosed']);
    expect(findMatchingRule(at('https://a.com'), [broken])?.name).toBe('broken');
    expect(patternErrors(rule(4, 'w', '(unclosed'))).toEqual([]);
  });
});

describe('group titles', () => {
  it('adds the tab count only when asked, and can be reversed', () => {
    expect(groupTitle('mail', false, 3)).toBe('mail');
    expect(groupTitle('mail', true, 3)).toBe('mail (3)');
    expect(baseGroupTitle('mail (3)')).toBe('mail');
    expect(baseGroupTitle('📧 mail')).toBe('📧 mail');
  });
});

describe('colors', () => {
  it('picks the least used color', () => {
    expect(pickLeastUsedColor([{ color: 'grey' }, { color: 'blue' }])).toBe('red');
  });

  it('falls back to a color by position for rules saved without one', () => {
    const rules = [rule(1, 'a', 'a', { color: 'red' }), rule(2, 'b', 'b')];
    expect(colorForRule(rules[1]!, rules)).toBe('blue');
  });
});

describe('convertPatterns', () => {
  it('turns wildcards into equivalent expressions, one per line', async () => {
    const { convertPatterns } = await import('./rules');
    expect(convertPatterns('a.com  *.b.com/x', 'wildcard', 'regex')).toBe('a\\.com\n.*\\.b\\.com\\/x');
    expect(convertPatterns('^a\n^b', 'regex', 'wildcard')).toBe('^a\n^b');
    expect(convertPatterns(undefined, 'wildcard', 'regex')).toBeUndefined();
  });

  it('keeps matching the same URLs after converting', () => {
    const before = rule(1, 'x', 'mail.google.com  *.example.com/docs');
    const after = rule(1, 'x', '', { syntax: 'regex' });
    return import('./rules').then(({ convertPatterns }) => {
      after.pattern = convertPatterns(before.pattern, 'wildcard', 'regex')!;
      for (const url of [
        'https://mail.google.com/',
        'https://a.example.com/docs/1',
        'https://example.org/',
      ]) {
        expect(findMatchingRule(at(url), [after])?.id).toBe(findMatchingRule(at(url), [before])?.id);
      }
    });
  });
});
