import { describe, expect, it } from 'vitest';
import { rulesToText, textToRules } from './bulk';
import type { GroupRule } from './rules';

const existing: GroupRule[] = [
  { id: 10, key: 0, name: '📧 mail', pattern: 'mail.google.com outlook.com', color: 'grey' },
  { id: 20, key: 1, name: 'specs', pattern: '', titlePattern: '仕様書', color: 'blue' },
  {
    id: 30,
    key: 2,
    name: 'repos',
    pattern: '^https://github\\.com/(a|b)/\n^https://x\\.com/\\d{1,3}',
    syntax: 'regex',
    color: 'green',
  },
];

describe('rulesToText / textToRules', () => {
  it('writes one block per rule', () => {
    expect(rulesToText(existing)).toBe(
      [
        '📧 mail',
        '  color: grey',
        '  url: mail.google.com outlook.com',
        '',
        'specs',
        '  color: blue',
        '  title: 仕様書',
        '',
        'repos',
        '  color: green',
        '  syntax: regex',
        '  url: ^https://github\\.com/(a|b)/',
        '  url: ^https://x\\.com/\\d{1,3}',
      ].join('\n')
    );
  });

  it('round-trips, including regexes that contain commas', () => {
    const { rules, errors } = textToRules(rulesToText(existing), existing);
    expect(errors).toEqual([]);
    expect(rules).toEqual(existing.map((r) => ({ titlePattern: undefined, syntax: undefined, ...r })));
  });

  it('keeps ids by name so open groups stay attached after reordering', () => {
    const { rules } = textToRules('specs\n  title: 仕様書\n📧 mail\n  url: gmail.com', existing);
    expect(rules.map((r) => [r.id, r.key])).toEqual([
      [20, 0],
      [10, 1],
    ]);
  });

  it('still reads the one-line format of earlier versions', () => {
    const { rules, errors } = textToRules('mail, mail.google.com outlook.com, Grey\nnews, news.*\n', []);
    expect(errors).toEqual([]);
    expect(rules.map((r) => [r.name, r.pattern, r.color])).toEqual([
      ['mail', 'mail.google.com outlook.com', 'grey'],
      ['news', 'news.*', expect.any(String)],
    ]);
  });

  it('reports bad lines with their line numbers', () => {
    const text = [
      '  url: orphan.com', // 1: no rule above
      'a',
      '  colour: red', // 3: unknown key
      '  url: a.com',
      'b',
      '  color: chartreuse', // 6: unknown color
      '  url: b.com',
      'c', // 8: no conditions
      'd',
      '  syntax: regex',
      '  url: (unclosed', // reported on the rule's line, 9
      'x, y, z, w', // 12: too many fields
    ].join('\n');
    const { errors } = textToRules(text, []);
    expect(errors.map((e) => e.line)).toEqual([1, 3, 6, 8, 9, 12]);
  });
});
