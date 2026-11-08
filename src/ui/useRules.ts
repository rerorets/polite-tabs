import { useCallback, useEffect, useRef, useState } from 'react';
import type { GroupColor } from '../shared/colors';
import {
  colorForRule,
  isRuleComplete,
  newRuleId,
  pickLeastUsedColor,
  SEED_RULES,
  sortRules,
  type GroupRule,
} from '../shared/rules';
import { getHasConfirmed, getRules, saveRules, setHasConfirmed } from '../shared/storage';

export type EditableRule = GroupRule & { color: GroupColor };

const SAVE_DELAY = 400;

/**
 * Holds the rule list being edited. Every rule stays in the editor, but only complete
 * ones (name and pattern filled in) are saved, so one half-typed rule no longer blocks
 * saving the others.
 */
export const useRules = () => {
  const [rules, setRules] = useState<EditableRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasConfirmed, setConfirmed] = useState(true);
  const [saveError, setSaveError] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<EditableRule[] | undefined>(undefined);

  useEffect(() => {
    void Promise.all([getRules(), getHasConfirmed()]).then(([stored, confirmed]) => {
      const sorted = sortRules(stored);
      setRules(sorted.map((r) => ({ ...r, color: colorForRule(r, sorted) })));
      setConfirmed(confirmed || sorted.length > 0);
      setLoading(false);
    });
  }, []);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const next = pending.current;
    pending.current = undefined;
    if (!next) return;
    try {
      await saveRules(next.filter(isRuleComplete).map((r, key) => ({ ...r, key })));
      setSaveError(undefined);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  // The popup can close at any moment; write out whatever is still waiting.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [flush]);

  const update = useCallback(
    (next: EditableRule[], immediate = false) => {
      setRules(next);
      pending.current = next;
      clearTimeout(timer.current);
      if (immediate) void flush();
      else timer.current = setTimeout(() => void flush(), SAVE_DELAY);
    },
    [flush]
  );

  const addRule = useCallback((): EditableRule => {
    const rule: EditableRule = {
      id: newRuleId(rules),
      key: rules.length,
      name: '',
      pattern: '',
      color: pickLeastUsedColor(rules),
    };
    update([...rules, rule]);
    return rule;
  }, [rules, update]);

  const replaceAll = useCallback(
    (next: GroupRule[]) =>
      update(
        next.map((r) => ({ ...r, color: colorForRule(r, next) })),
        true
      ),
    [update]
  );

  const confirm = useCallback(
    async (withExamples: boolean) => {
      if (withExamples) {
        const seeded: GroupRule[] = [];
        for (const rule of SEED_RULES) seeded.push({ ...rule, id: newRuleId(seeded) });
        replaceAll(seeded);
      }
      await setHasConfirmed();
      setConfirmed(true);
    },
    [replaceAll]
  );

  return { rules, loading, hasConfirmed, saveError, update, addRule, replaceAll, confirm };
};
