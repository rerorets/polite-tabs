import type { Message } from '../shared/messages';
import { removeLegacyKeys } from '../shared/storage';
import {
  alignWindow,
  collapseOthers,
  forgetGroup,
  forgetTab,
  getOwnedGroups,
  handleTab,
  pruneSmallGroups,
  reconcileGroups,
  refreshGroupAppearance,
  ruleForGroup,
  setCollapsed,
  type HandleOptions,
} from './groups';
import { debounceByKey, enqueue } from './queue';

const scheduleAlign = debounceByKey<number>(300, (windowId) => void enqueue(() => alignWindow(windowId)));

const queueTab = (tabId: number, options?: HandleOptions) =>
  enqueue(async () => {
    const windowId = await handleTab(tabId, options);
    if (windowId === undefined) return;
    await pruneSmallGroups(windowId);
    scheduleAlign(windowId);
  });

const assignAllTabs = async (force = false) => {
  // Discarded (unloaded) tabs still report their URL, so they are included on purpose.
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id !== undefined) void queueTab(tab.id, { force });
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void enqueue(async () => {
    await removeLegacyKeys();
    await assignAllTabs();
  });
});

chrome.runtime.onStartup.addListener(() => void assignAllTabs());

chrome.webNavigation.onCommitted.addListener(({ tabId, url, frameId }) => {
  // Subframes commit too; grouping by an iframe's URL would misfile the tab.
  if (frameId === 0) void queueTab(tabId, { url });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // groupId -1: the tab was taken out of a group. Whether it goes back is up to handleTab.
  if (
    changeInfo.url ||
    changeInfo.title ||
    changeInfo.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE ||
    changeInfo.pinned === false
  ) {
    void queueTab(tabId);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void queueTab(tabId);
  void enqueue(() => collapseOthers(tabId));
});

chrome.tabs.onAttached.addListener((tabId) => void queueTab(tabId));

chrome.tabs.onDetached.addListener(
  (_tabId, { oldWindowId }) => void enqueue(() => pruneSmallGroups(oldWindowId))
);

chrome.tabs.onRemoved.addListener((tabId, { windowId, isWindowClosing }) => {
  void enqueue(async () => {
    await forgetTab(tabId);
    if (!isWindowClosing) await pruneSmallGroups(windowId);
  });
});

chrome.tabGroups.onUpdated.addListener((group) => {
  void enqueue(async () => {
    const owned = await ruleForGroup(group.id);
    if (!owned) return;
    // Collapsing or expanding changes the "(n)" suffix of the title.
    await refreshGroupAppearance(group.id, owned.rule, owned.rules);
    scheduleAlign(group.windowId);
  });
});

chrome.tabGroups.onRemoved.addListener((group) => void enqueue(() => forgetGroup(group.id)));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes.groupRules || changes.settings) {
    void enqueue(async () => {
      await reconcileGroups();
      await assignAllTabs();
    });
    void chrome.windows.getAll().then((windows) => windows.forEach((w) => w.id && scheduleAlign(w.id)));
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-collapse') {
    void enqueue(async () => {
      const groups = await getOwnedGroups();
      await setCollapsed(!groups.some((g) => g.collapsed));
    });
  } else if (command === 'group-now') {
    void assignAllTabs(true);
  }
});

chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === 'setCollapsed') void enqueue(() => setCollapsed(message.collapsed));
  else if (message.type === 'groupNow') void assignAllTabs(true);
});
