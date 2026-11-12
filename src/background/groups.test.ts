import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroupRule } from '../shared/rules';
import { createFakeChrome } from './fakeChrome';
import { DEFAULT_SETTINGS, type Settings } from '../shared/storage';
import { alignWindow, collapseOthers, handleTab, pruneSmallGroups, reconcileGroups } from './groups';

let fake: ReturnType<typeof createFakeChrome>;

const rules: GroupRule[] = [
  { id: 1, key: 0, name: 'dev', pattern: 'github.com', color: 'blue' },
  { id: 2, key: 1, name: 'mail', pattern: 'mail.google.com', color: 'red' },
];

beforeEach(async () => {
  fake = createFakeChrome();
  vi.stubGlobal('chrome', fake.chrome);
  await fake.chrome.storage.sync.set({ groupRules: rules });
});

describe('handleTab', () => {
  it('groups matching tabs under one group per rule', async () => {
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    fake.addTab({ id: 2, url: 'https://github.com/b' });
    await handleTab(1);
    await handleTab(2);

    expect(fake.groupOf(1)).toMatchObject({ title: 'dev', color: 'blue' });
    expect(fake.groupOf(2)?.id).toBe(fake.groupOf(1)?.id);
  });

  it('leaves tabs in a group made by someone else alone', async () => {
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    const claude = fake.addForeignGroup('claude', [1]);

    await handleTab(1);
    await handleTab(1, { url: 'https://github.com/other' });

    expect(fake.groupOf(1)?.id).toBe(claude);
    expect(fake.groups).toHaveLength(1);
  });

  it('takes back its own groups after a restart, recognised by title', async () => {
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    fake.addTab({ id: 2, url: 'https://github.com/b' });
    const restored = fake.addForeignGroup('dev', [1]);

    await handleTab(1);
    await handleTab(2);

    expect(fake.groupOf(2)?.id).toBe(restored);
    expect(fake.groups).toHaveLength(1);
  });

  it('takes back its own group when a tab outside it is handled first after a restart', async () => {
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    fake.addTab({ id: 2, url: 'https://github.com/b' });
    const restored = fake.addForeignGroup('dev (14)', [1]);

    await handleTab(2);
    await handleTab(1);

    expect(fake.groupOf(2)?.id).toBe(restored);
    expect(fake.groupOf(1)?.id).toBe(restored);
    expect(fake.groups).toHaveLength(1);
  });

  it('does not start a second group when the last tab of its own group is dragged out', async () => {
    // A duplicate left by an older version: our one-tab group next to a restored one.
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    fake.addTab({ id: 2, url: 'https://github.com/b' });
    await handleTab(2);
    const restored = fake.addForeignGroup('dev (14)', [1]);

    // Mid-drag the tab sits outside any group, and Chrome has removed the emptied group.
    userUngroups(2);
    await handleTab(2);

    expect(fake.groupOf(2)?.id).toBe(restored);
    expect(fake.groups).toHaveLength(1);
  });

  it('takes back its own group instead of waiting for a second tab when skipSingleTabGroups is on', async () => {
    await useSettings({ skipSingleTabGroups: true });
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    fake.addTab({ id: 2, url: 'https://github.com/b' });
    const restored = fake.addForeignGroup('dev', [1]);

    await handleTab(2);

    expect(fake.groupOf(2)?.id).toBe(restored);
  });

  it('does not take back a same-named group when the rule already has one in the window', async () => {
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    fake.addTab({ id: 2, url: 'https://github.com/b' });
    await handleTab(1);
    const lookalike = fake.addForeignGroup('dev', [2]);

    await handleTab(2);

    expect(fake.groupOf(2)?.id).toBe(lookalike);
  });

  it('moves a tab to another of its own groups when the URL changes, and ungroups when nothing matches', async () => {
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    await handleTab(1);
    await handleTab(1, { url: 'https://mail.google.com/' });
    expect(fake.groupOf(1)?.title).toBe('mail');

    await handleTab(1, { url: 'https://example.com/' });
    expect(fake.groupOf(1)).toBeUndefined();
  });

  it('never groups pinned tabs', async () => {
    fake.addTab({ id: 1, url: 'https://mail.google.com/', pinned: true });
    await handleTab(1);
    expect(fake.groupOf(1)).toBeUndefined();
  });

  it('keeps groups in separate windows apart', async () => {
    fake.addTab({ id: 1, url: 'https://github.com/a', windowId: 1 });
    fake.addTab({ id: 2, url: 'https://github.com/b', windowId: 2 });
    await handleTab(1);
    await handleTab(2);
    expect(fake.groupOf(1)?.windowId).toBe(1);
    expect(fake.groupOf(2)?.windowId).toBe(2);
  });

  it('shows the tab count in the title of a collapsed group', async () => {
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    fake.addTab({ id: 2, url: 'https://github.com/b' });
    await handleTab(1);
    fake.groupOf(1)!.collapsed = true;
    await handleTab(2);
    expect(fake.groupOf(1)?.title).toBe('dev (2)');
  });
});

describe('reconcileGroups', () => {
  it('ungroups tabs of deleted rules and applies renames', async () => {
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    fake.addTab({ id: 2, url: 'https://mail.google.com/' });
    await handleTab(1);
    await handleTab(2);

    await fake.chrome.storage.sync.set({ groupRules: [{ ...rules[0]!, name: 'code', color: 'green' }] });
    await reconcileGroups();

    expect(fake.groupOf(1)).toMatchObject({ title: 'code', color: 'green' });
    expect(fake.groupOf(2)).toBeUndefined();
  });

  it('leaves foreign groups untouched', async () => {
    fake.addTab({ id: 1, url: 'https://example.com/' });
    const claude = fake.addForeignGroup('claude', [1]);
    await reconcileGroups();
    expect(fake.groupOf(1)?.id).toBe(claude);
  });
});

describe('alignWindow', () => {
  it('moves our groups to the left in rule order, after pinned tabs', async () => {
    fake.addTab({ id: 1, url: 'https://pinned.example/', pinned: true });
    fake.addTab({ id: 2, url: 'https://example.com/' });
    fake.addTab({ id: 3, url: 'https://mail.google.com/' });
    fake.addTab({ id: 4, url: 'https://github.com/' });
    await handleTab(3);
    await handleTab(4);

    await alignWindow(1);

    const order = (await fake.chrome.tabs.query({ windowId: 1 })).map((t) => t.id);
    expect(order).toEqual([1, 4, 3, 2]);
  });

  it('does nothing when alignment is turned off', async () => {
    await fake.chrome.storage.sync.set({ settings: { alignGroups: false } });
    fake.addTab({ id: 1, url: 'https://example.com/' });
    fake.addTab({ id: 2, url: 'https://github.com/' });
    await handleTab(2);

    await alignWindow(1);

    const order = (await fake.chrome.tabs.query({ windowId: 1 })).map((t) => t.id);
    expect(order).toEqual([1, 2]);
  });
});

const useSettings = (settings: Partial<Settings>) =>
  fake.chrome.storage.sync.set({ settings: { ...DEFAULT_SETTINGS, ...settings } });

/** What Chrome does when the user drags a tab out of its group. */
const userUngroups = (tabId: number) => {
  fake.tabs.find((t) => t.id === tabId)!.groupId = -1;
  fake.groups.splice(
    0,
    fake.groups.length,
    ...fake.groups.filter((g) => fake.tabs.some((t) => t.groupId === g.id))
  );
};

describe('settings', () => {
  it('puts a tab the user took out back by default', async () => {
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    await handleTab(1);
    userUngroups(1);
    await handleTab(1);
    expect(fake.groupOf(1)?.title).toBe('dev');
  });

  it('respects a tab the user took out when restoreRemovedTabs is off, until it navigates', async () => {
    await useSettings({ restoreRemovedTabs: false });
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    await handleTab(1);
    userUngroups(1);

    await handleTab(1);
    expect(fake.groupOf(1)).toBeUndefined();

    fake.tabs[0]!.url = 'https://github.com/b';
    await handleTab(1);
    expect(fake.groupOf(1)?.title).toBe('dev');
  });

  it('keeps non-matching tabs in the group when ungroupNonMatching is off', async () => {
    await useSettings({ ungroupNonMatching: false });
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    await handleTab(1);
    await handleTab(1, { url: 'https://example.com/' });
    expect(fake.groupOf(1)?.title).toBe('dev');

    // A tab that now matches a different rule still moves.
    await handleTab(1, { url: 'https://mail.google.com/' });
    expect(fake.groupOf(1)?.title).toBe('mail');
  });

  it('omits the tab count when showTabCount is off', async () => {
    await useSettings({ showTabCount: false });
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    await handleTab(1);
    fake.groupOf(1)!.collapsed = true;
    await handleTab(1);
    expect(fake.groupOf(1)?.title).toBe('dev');
  });

  it('waits for a second tab when skipSingleTabGroups is on, and dissolves groups down to one tab', async () => {
    await useSettings({ skipSingleTabGroups: true });
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    await handleTab(1);
    expect(fake.groupOf(1)).toBeUndefined();

    fake.addTab({ id: 2, url: 'https://github.com/b' });
    await handleTab(2);
    expect(fake.groupOf(1)?.title).toBe('dev');
    expect(fake.groupOf(2)?.id).toBe(fake.groupOf(1)?.id);

    fake.tabs.splice(1, 1); // tab 2 closed
    await pruneSmallGroups(1);
    expect(fake.groupOf(1)).toBeUndefined();
  });

  it('collapses the other groups in the window when autoCollapseOthers is on', async () => {
    await useSettings({ autoCollapseOthers: true });
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    fake.addTab({ id: 2, url: 'https://mail.google.com/' });
    const claude = fake.addForeignGroup('claude', [2]);
    fake.addTab({ id: 3, url: 'https://mail.google.com/' });
    await handleTab(1);
    await handleTab(3);

    await collapseOthers(1);

    expect(fake.groupOf(1)?.collapsed).toBe(false);
    expect(fake.groupOf(3)).toMatchObject({ collapsed: true, title: 'mail (1)' });
    expect(fake.groups.find((g) => g.id === claude)?.collapsed).toBe(false);
  });

  it('only groups on demand in manual mode', async () => {
    await useSettings({ manualMode: true });
    fake.addTab({ id: 1, url: 'https://github.com/a' });
    await handleTab(1);
    expect(fake.groupOf(1)).toBeUndefined();

    await handleTab(1, { force: true });
    expect(fake.groupOf(1)?.title).toBe('dev');
  });
});

describe('title rules', () => {
  it('groups by page title', async () => {
    await fake.chrome.storage.sync.set({
      groupRules: [{ id: 3, key: 0, name: 'specs', pattern: '', titlePattern: '仕様書', color: 'cyan' }],
    });
    fake.addTab({ id: 1, url: 'https://docs.google.com/d/1', title: '決済の仕様書' });
    await handleTab(1);
    expect(fake.groupOf(1)?.title).toBe('specs');
  });
});
