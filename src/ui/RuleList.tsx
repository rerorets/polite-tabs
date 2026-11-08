import { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  convertPatterns,
  findMatchingRule,
  isRuleComplete,
  patternErrors,
  syntaxOf,
  type PatternSyntax,
} from '../shared/rules';
import { ColorPicker } from './ColorPicker';
import { EmojiPicker } from './EmojiPicker';
import { ArrowDownIcon, ArrowUpIcon, ListIcon, PlusIcon, SmileIcon, TrashIcon } from './icons';
import { useOpenTabs } from './useOpenTabs';
import type { EditableRule } from './useRules';

interface Props {
  rules: EditableRule[];
  onChange: (rules: EditableRule[], immediate?: boolean) => void;
  onAdd: () => EditableRule;
}

const PLACEHOLDERS: Record<PatternSyntax, { url: string; title: string }> = {
  wildcard: { url: 'github.com  *.example.com/docs', title: '仕様書  議事録' },
  regex: { url: '^https://github\\.com/(org-a|org-b)/', title: '^\\[PR\\] .+' },
};

/** Animates list reordering where the browser supports view transitions. */
const withTransition = (change: () => void) => {
  if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    change();
    return;
  }
  document.startViewTransition(() => flushSync(change));
};

export const RuleList = ({ rules, onChange, onAdd }: Props) => {
  const [emojiFor, setEmojiFor] = useState<number>();
  const [focusId, setFocusId] = useState<number>();
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const [titleOpen, setTitleOpen] = useState<Set<number>>(new Set());
  const openTabs = useOpenTabs();

  // Counts tabs by the rule that would actually take them (the first match), so a
  // rule shadowed by one above it shows 0.
  const matchCounts = useMemo(() => {
    const complete = rules.filter(isRuleComplete);
    const counts = new Map<number, number>();
    for (const tab of openTabs) {
      const rule = findMatchingRule(tab, complete);
      if (rule) counts.set(rule.id, (counts.get(rule.id) ?? 0) + 1);
    }
    return counts;
  }, [rules, openTabs]);

  const patch = (id: number, change: Partial<EditableRule>, immediate = false) =>
    onChange(
      rules.map((r) => (r.id === id ? { ...r, ...change } : r)),
      immediate
    );

  const move = (index: number, delta: -1 | 1) =>
    withTransition(() => {
      const next = [...rules];
      const [moved] = next.splice(index, 1);
      next.splice(index + delta, 0, moved!);
      onChange(
        next.map((r, key) => ({ ...r, key })),
        true
      );
    });

  const remove = (id: number) =>
    withTransition(() =>
      onChange(
        rules.filter((r) => r.id !== id),
        true
      )
    );

  const touch = (id: number) => setTouched((t) => (t.has(id) ? t : new Set(t).add(id)));

  /** Problems worth showing once the user has left the rule; an untouched empty rule is fine. */
  const problemsOf = (rule: EditableRule): string[] => {
    const problems = patternErrors(rule);
    const started = (rule.name + rule.pattern + (rule.titlePattern ?? '')).trim() !== '';
    if (touched.has(rule.id) && started) {
      if (!rule.name.trim()) problems.unshift('グループ名を入れてください。');
      else if (!isRuleComplete(rule)) problems.unshift('URL かタイトルの条件を入れてください。');
    }
    return problems;
  };

  return (
    <>
      {rules.length === 0 ? (
        <div className="empty">
          <ListIcon width={32} height={32} />
          <p>ルールはまだありません。ルールを追加すると、タブのグループ分けが始まります。</p>
        </div>
      ) : (
        <div className="rules" role="list">
          {rules.map((rule, i) => {
            const syntax = syntaxOf(rule);
            const problems = problemsOf(rule);
            const count = matchCounts.get(rule.id) ?? 0;
            const showTitle = titleOpen.has(rule.id) || Boolean(rule.titlePattern);
            return (
              <div
                className={`rule-card ${problems.length > 0 ? 'rule-card--error' : ''}`}
                role="listitem"
                key={rule.id}
                style={{ viewTransitionName: `rule-${rule.id}` }}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) touch(rule.id);
                }}
              >
                <div className="rule-head">
                  <ColorPicker value={rule.color} onChange={(color) => patch(rule.id, { color }, true)} />
                  <div className="field field--name">
                    <input
                      value={rule.name}
                      placeholder="グループ名"
                      aria-label="グループ名"
                      autoFocus={rule.id === focusId}
                      onChange={(e) => patch(rule.id, { name: e.target.value })}
                    />
                    <button
                      type="button"
                      className="icon-button icon-button--inset"
                      title="絵文字を足す"
                      aria-label="グループ名に絵文字を足す"
                      onClick={() => setEmojiFor(rule.id)}
                    >
                      <SmileIcon width={16} height={16} />
                    </button>
                  </div>
                  <div className="segmented" role="radiogroup" aria-label="パターンの書き方">
                    {(['wildcard', 'regex'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={syntax === s}
                        className={syntax === s ? 'segmented-on' : ''}
                        title={
                          s === 'wildcard'
                            ? 'スペース区切り。* は何にでも当たります'
                            : '1 行に 1 つの正規表現'
                        }
                        onClick={() =>
                          s !== syntax &&
                          patch(
                            rule.id,
                            {
                              syntax: s === 'regex' ? 'regex' : undefined,
                              pattern: convertPatterns(rule.pattern, syntax, s) ?? '',
                              titlePattern: convertPatterns(rule.titlePattern, syntax, s),
                            },
                            true
                          )
                        }
                      >
                        {s === 'wildcard' ? 'ワイルドカード' : '正規表現'}
                      </button>
                    ))}
                  </div>
                  <span
                    className={`match-count ${count === 0 ? 'match-count--zero' : ''}`}
                    title="今開いているタブのうち、このルールに当たる数"
                  >
                    {count} タブ
                  </span>
                  <div className="rule-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="上へ"
                      title="上へ"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUpIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="下へ"
                      title="下へ"
                      disabled={i === rules.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDownIcon />
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      aria-label="ルールを削除"
                      title="ルールを削除"
                      onClick={() => remove(rule.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                <label className="condition">
                  <span className="condition-label">URL</span>
                  <span className="field">
                    <textarea
                      rows={1}
                      value={rule.pattern}
                      placeholder={PLACEHOLDERS[syntax].url}
                      spellCheck={false}
                      onChange={(e) => patch(rule.id, { pattern: e.target.value })}
                    />
                  </span>
                </label>

                {showTitle ? (
                  <label className="condition">
                    <span className="condition-label">タイトル</span>
                    <span className="field">
                      <textarea
                        rows={1}
                        value={rule.titlePattern ?? ''}
                        placeholder={PLACEHOLDERS[syntax].title}
                        spellCheck={false}
                        autoFocus={titleOpen.has(rule.id) && !rule.titlePattern}
                        onChange={(e) => patch(rule.id, { titlePattern: e.target.value || undefined })}
                      />
                    </span>
                  </label>
                ) : (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setTitleOpen((s) => new Set(s).add(rule.id))}
                  >
                    + ページのタイトルでも照合する
                  </button>
                )}

                {problems.length > 0 && (
                  <ul className="rule-problems">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="list-footer">
        <button type="button" className="button button--primary" onClick={() => setFocusId(onAdd().id)}>
          <PlusIcon /> ルールを追加
        </button>
        <p className="hint">
          URL
          かタイトルのどちらかに当たれば、そのグループに入ります。上にあるルールほど優先され、グループもこの順に並びます。
        </p>
      </div>

      {emojiFor !== undefined && (
        <EmojiPicker
          onClose={() => setEmojiFor(undefined)}
          onSelect={(emoji) => {
            const rule = rules.find((r) => r.id === emojiFor);
            if (rule) patch(rule.id, { name: `${emoji} ${rule.name}`.trimEnd() }, true);
            setEmojiFor(undefined);
          }}
        />
      )}
    </>
  );
};
