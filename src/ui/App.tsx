import { useEffect, useState } from 'react';
import { APP_NAME } from '../shared/brand';
import { sendMessage } from '../shared/messages';
import { isRuleComplete } from '../shared/rules';
import { getGroupOwners } from '../shared/storage';
import { BulkEditor } from './BulkEditor';
import { CollapseIcon, EditIcon, ExpandIcon, GearIcon, SortIcon, WarningIcon } from './icons';
import { Onboarding } from './Onboarding';
import { RuleList } from './RuleList';
import { SettingsPanel, useSettings } from './SettingsPanel';
import { useRules } from './useRules';

export type Surface = 'popup' | 'options';

const anyOwnedGroupCollapsed = async () => {
  const owners = await getGroupOwners();
  const groups = await chrome.tabGroups.query({});
  return groups.some((g) => owners[g.id] !== undefined && g.collapsed);
};

/** Tracks whether our groups are collapsed, including changes made from the tab strip. */
const useCollapsed = () => {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (!chrome.tabGroups) return;
    const refresh = () => void anyOwnedGroupCollapsed().then(setCollapsed);
    refresh();
    chrome.tabGroups.onUpdated.addListener(refresh);
    return () => chrome.tabGroups.onUpdated.removeListener(refresh);
  }, []);
  return collapsed;
};

/** Shortcuts the user actually has, which differ per platform and can be remapped. */
const useShortcuts = () => {
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({});
  useEffect(() => {
    void chrome.commands.getAll().then((commands) => {
      setShortcuts(
        Object.fromEntries(commands.flatMap((c) => (c.name && c.shortcut ? [[c.name, c.shortcut]] : [])))
      );
    });
  }, []);
  return shortcuts;
};

const UpgradeNotice = () => (
  <div className="notice">
    <WarningIcon width={32} height={32} />
    <p>このブラウザはタブグループに対応していないため、{APP_NAME} を使えません。</p>
    <p>新しいバージョンの Chrome か Edge を使ってください。</p>
  </div>
);

export const App = ({ surface }: { surface: Surface }) => {
  const { rules, loading, hasConfirmed, saveError, update, addRule, replaceAll, confirm } = useRules();
  const [bulk, setBulk] = useState(false);
  const collapsed = useCollapsed();
  const shortcuts = useShortcuts();
  const [settings] = useSettings();
  const collapseKey = shortcuts['toggle-collapse'];
  const groupNowKey = shortcuts['group-now'];

  if (!chrome.tabGroups) return <UpgradeNotice />;
  if (loading) return null;

  const header = (
    <header className="header">
      <img src="/icon-32.png" alt="" width={24} height={24} />
      <h1>{APP_NAME}</h1>
      {hasConfirmed && !bulk && (
        <nav className="header-actions">
          {settings.manualMode && (
            <button
              type="button"
              className="button button--ghost"
              title={groupNowKey ? `ショートカット：${groupNowKey}` : undefined}
              onClick={() => void sendMessage({ type: 'groupNow' })}
            >
              <SortIcon /> 今すぐ振り分ける
              {groupNowKey && <kbd>{groupNowKey}</kbd>}
            </button>
          )}
          <button
            type="button"
            className="button button--ghost"
            title={collapseKey ? `ショートカット：${collapseKey}` : undefined}
            onClick={() => void sendMessage({ type: 'setCollapsed', collapsed: !collapsed })}
          >
            {collapsed ? <ExpandIcon /> : <CollapseIcon />}
            {collapsed ? '展開' : '折りたたむ'}
            {collapseKey && <kbd>{collapseKey}</kbd>}
          </button>
          <button type="button" className="button button--ghost" onClick={() => setBulk(true)}>
            <EditIcon /> まとめて編集
          </button>
          {surface === 'popup' && (
            <button
              type="button"
              className="icon-button"
              title="設定"
              aria-label="設定"
              onClick={() => void chrome.runtime.openOptionsPage()}
            >
              <GearIcon />
            </button>
          )}
        </nav>
      )}
    </header>
  );

  let body;
  if (!hasConfirmed) {
    body = <Onboarding onConfirm={(withExamples) => void confirm(withExamples)} />;
  } else if (bulk) {
    body = (
      <BulkEditor
        rules={rules.filter(isRuleComplete)}
        onCancel={() => setBulk(false)}
        onApply={(next) => {
          replaceAll(next);
          setBulk(false);
        }}
      />
    );
  } else {
    body = <RuleList rules={rules} onChange={update} onAdd={addRule} />;
  }

  return (
    <div className="app">
      {header}
      {saveError && (
        <div className="error-banner" role="alert">
          ルールを保存できませんでした：{saveError}
        </div>
      )}
      <main className="content">
        {surface === 'options' ? (
          <>
            <section className="panel">
              <h2>ルール</h2>
              {body}
            </section>
            {hasConfirmed && <SettingsPanel />}
            <footer className="about">
              {APP_NAME} {chrome.runtime.getManifest().version} ·{' '}
              <a href="https://github.com/rerorets/polite-tabs" target="_blank" rel="noreferrer">
                GitHub
              </a>
            </footer>
          </>
        ) : (
          body
        )}
      </main>
    </div>
  );
};
