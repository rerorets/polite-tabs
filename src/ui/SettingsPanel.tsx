import { useEffect, useState } from 'react';
import { APP_NAME } from '../shared/brand';
import { DEFAULT_SETTINGS, getSettings, saveSettings, type Settings } from '../shared/storage';

/** Settings, kept in step with changes made from another page (popup vs. settings page). */
export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useEffect(() => {
    void getSettings().then(setSettings);
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'sync' && changes.settings) void getSettings().then(setSettings);
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);
  const change = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    void saveSettings(next);
  };
  return [settings, change] as const;
};

interface ToggleSpec {
  key: keyof Settings;
  label: string;
  description: string;
}

const SECTIONS: { title: string; toggles: ToggleSpec[] }[] = [
  {
    title: '振り分け',
    toggles: [
      {
        key: 'manualMode',
        label: '手動モード',
        description:
          'タブを開いたり移動したりしても振り分けません。ショートカットかポップアップの「今すぐ振り分ける」を押したときだけ振り分けます。',
      },
      {
        key: 'restoreRemovedTabs',
        label: 'グループから外したタブを戻す',
        description:
          'オフにすると、手でグループから外したタブはそのまま残します。別のページへ移ると、また振り分けます。',
      },
      {
        key: 'ungroupNonMatching',
        label: '当たらなくなったタブをグループから外す',
        description: 'オフにすると、どのルールにも当たらないページへ移っても、今のグループに残します。',
      },
      {
        key: 'skipSingleTabGroups',
        label: '1 枚だけならグループにしない',
        description:
          '同じルールに当たるタブが 2 枚になってから、グループを作ります。1 枚に減ったグループは解きます。',
      },
    ],
  },
  {
    title: '見た目',
    toggles: [
      {
        key: 'alignGroups',
        label: 'グループをルールの順に並べる',
        description: `${APP_NAME} のグループを、ルールの順にタブバーの左側へ並べます。`,
      },
      {
        key: 'showTabCount',
        label: '折りたたんだグループにタブの数を出す',
        description: '「mail (3)」のように、グループ名のあとにタブの数を付けます。',
      },
      {
        key: 'autoCollapseOthers',
        label: 'ほかのグループを自動で折りたたむ',
        description: 'タブを切り替えると、そのタブのグループだけを開き、ほかのグループを折りたたみます。',
      },
    ],
  },
];

export const SettingsPanel = () => {
  const [settings, change] = useSettings();

  return (
    <section className="panel">
      <h2>設定</h2>
      {SECTIONS.map((section) => (
        <fieldset className="settings-section" key={section.title}>
          <legend>{section.title}</legend>
          {section.toggles.map((t) => (
            <label className="toggle" key={t.key}>
              <input
                type="checkbox"
                checked={settings[t.key]}
                onChange={(e) => change({ [t.key]: e.target.checked })}
              />
              <span>
                <strong>{t.label}</strong>
                <small>{t.description}</small>
              </span>
            </label>
          ))}
        </fieldset>
      ))}
      <p className="note">
        {APP_NAME}{' '}
        が作っていないグループ（手で作ったものや、ほかの拡張が作ったもの）には、どの設定でも触りません。
      </p>
      <p className="note">
        ショートカットは{' '}
        <a
          href="chrome://extensions/shortcuts"
          onClick={(e) => {
            e.preventDefault();
            void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
          }}
        >
          chrome://extensions/shortcuts
        </a>{' '}
        で変えられます。
      </p>
    </section>
  );
};
