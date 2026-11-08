import { useMemo, useState } from 'react';
import { COLOR_NAMES } from '../shared/colors';
import { rulesToText, textToRules } from '../shared/bulk';
import type { GroupRule } from '../shared/rules';

interface Props {
  rules: GroupRule[];
  onApply: (rules: GroupRule[]) => void;
  onCancel: () => void;
}

export const BulkEditor = ({ rules, onApply, onCancel }: Props) => {
  const [text, setText] = useState(() => rulesToText(rules));
  const parsed = useMemo(() => textToRules(text, rules), [text, rules]);
  const valid = parsed.errors.length === 0;

  return (
    <div className="bulk">
      <label className="bulk-label" htmlFor="bulk-text">
        名前の行のあとに、字下げして <code>color:</code> <code>url:</code> <code>title:</code>{' '}
        <code>syntax: regex</code> を書きます。色は {COLOR_NAMES.join(', ')} のどれかです。旧版の{' '}
        <code>名前, パターン, 色</code> の 1 行の形式もそのまま貼れます。
      </label>
      <textarea
        id="bulk-text"
        className={`bulk-text ${valid ? '' : 'bulk-text--error'}`}
        value={text}
        spellCheck={false}
        autoFocus
        onChange={(e) => setText(e.target.value)}
      />
      {!valid && (
        <ul className="bulk-errors">
          {parsed.errors.map((e) => (
            <li key={e.line}>
              {e.line} 行目：{e.message}
            </li>
          ))}
        </ul>
      )}
      <div className="bulk-actions">
        <button type="button" className="button" onClick={onCancel}>
          キャンセル
        </button>
        <button
          type="button"
          className="button button--primary"
          disabled={!valid}
          onClick={() => onApply(parsed.rules)}
        >
          {parsed.rules.length} 件のルールを反映
        </button>
      </div>
    </div>
  );
};
