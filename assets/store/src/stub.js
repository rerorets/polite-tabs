// Fake chrome.* APIs with sample rules, so the built popup and settings page can be
// rendered outside the extension for store screenshots.
(() => {
  const ev = () => ({ addListener() {}, removeListener() {} });
  const data = {
    hasConfirmed: true,
    settings: { autoCollapseOthers: true },
    groupRules: [
      { id: 1, key: 0, name: '📧 mail', pattern: 'mail.google.com outlook.com', color: 'grey' },
      {
        id: 2,
        key: 1,
        name: 'dev',
        syntax: 'regex',
        pattern: '^https://github\\.com/my-team/\n^http://localhost:\\d+',
        titlePattern: '^\\[PR\\]',
        color: 'blue',
      },
      {
        id: 3,
        key: 2,
        name: '📝 docs',
        pattern: 'docs.google.com notion.so',
        titlePattern: '議事録',
        color: 'green',
      },
      { id: 4, key: 3, name: 'news', pattern: 'news.*', color: 'yellow' },
    ],
  };
  const tabs = [
    'https://mail.google.com/mail/u/0',
    'https://outlook.com/inbox',
    'https://github.com/my-team/app/pull/12',
    'https://github.com/my-team/app/issues',
    'http://localhost:5173/',
    'https://docs.google.com/document/d/1',
    'https://www.notion.so/team',
    'https://news.example.com/',
  ].map((url) => ({ url, title: '' }));
  const area = {
    get: async (k) => (typeof k === 'string' ? { [k]: data[k] } : data),
    set: async () => {},
    remove: async () => {},
  };
  window.chrome = {
    storage: { sync: area, local: area, session: { ...area, get: async () => ({}) }, onChanged: ev() },
    tabs: { query: async () => tabs, onUpdated: ev(), onCreated: ev(), onRemoved: ev(), create() {} },
    tabGroups: { query: async () => [], onUpdated: ev() },
    commands: {
      getAll: async () => [
        { name: 'toggle-collapse', shortcut: '⌥⇧C' },
        { name: 'group-now', shortcut: '⌥⇧G' },
      ],
    },
    runtime: {
      sendMessage: async () => {},
      getPlatformInfo: async () => ({ os: 'mac' }),
      getManifest: () => ({ version: '1.0.0' }),
      onMessage: ev(),
    },
  };
})();

// `#settings` scrolls the settings page to its settings section once it has rendered.
if (location.hash === '#settings') {
  const scroll = () => {
    const heading = [...document.querySelectorAll('h2')].find((h) => h.textContent === '設定');
    if (heading) heading.scrollIntoView();
    else setTimeout(scroll, 50);
  };
  addEventListener('load', scroll);
}
