/**
 * A small in-memory stand-in for the parts of the chrome.* API the background uses.
 * It mirrors Chrome's habit of deleting a group once its last tab leaves.
 */
export interface FakeTab {
  id: number;
  windowId: number;
  index: number;
  groupId: number;
  pinned: boolean;
  url: string;
  title?: string;
}

export interface FakeGroup {
  id: number;
  windowId: number;
  title: string;
  color: string;
  collapsed: boolean;
}

const storageArea = () => {
  let data: Record<string, unknown> = {};
  return {
    get: async (key: string | null) => (key === null ? { ...data } : { [key]: data[key] }),
    set: async (items: Record<string, unknown>) => {
      data = { ...data, ...structuredClone(items) };
    },
    remove: async (keys: string[]) => keys.forEach((k) => delete data[k]),
    clear: () => {
      data = {};
    },
  };
};

export const createFakeChrome = () => {
  const tabs: FakeTab[] = [];
  const groups: FakeGroup[] = [];
  let nextGroupId = 100;

  const reindex = (windowId: number) =>
    tabs
      .filter((t) => t.windowId === windowId)
      .sort((a, b) => a.index - b.index)
      .forEach((t, i) => (t.index = i));

  const dropEmptyGroups = () => {
    for (let i = groups.length - 1; i >= 0; i--) {
      if (!tabs.some((t) => t.groupId === groups[i]!.id)) groups.splice(i, 1);
    }
  };

  const findTab = (id: number) => {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) throw new Error(`No tab with id: ${id}.`);
    return tab;
  };

  const findGroup = (id: number) => {
    const group = groups.find((g) => g.id === id);
    if (!group) throw new Error(`No group with id: ${id}.`);
    return group;
  };

  const chrome = {
    tabs: {
      get: async (id: number) => ({ ...findTab(id) }),
      query: async (q: { windowId?: number; groupId?: number }) =>
        tabs
          .filter(
            (t) =>
              (q.windowId === undefined || t.windowId === q.windowId) &&
              (q.groupId === undefined || t.groupId === q.groupId)
          )
          .sort((a, b) => a.windowId - b.windowId || a.index - b.index)
          .map((t) => ({ ...t })),
      group: async (opts: {
        tabIds: number | number[];
        groupId?: number;
        createProperties?: { windowId: number };
      }) => {
        const ids = Array.isArray(opts.tabIds) ? opts.tabIds : [opts.tabIds];
        let groupId = opts.groupId;
        if (groupId === undefined) {
          groupId = nextGroupId++;
          const windowId = opts.createProperties?.windowId ?? findTab(ids[0]!).windowId;
          groups.push({ id: groupId, windowId, title: '', color: 'grey', collapsed: false });
        } else {
          findGroup(groupId);
        }
        for (const id of ids) findTab(id).groupId = groupId;
        dropEmptyGroups();
        return groupId;
      },
      ungroup: async (tabIds: number | number[]) => {
        for (const id of Array.isArray(tabIds) ? tabIds : [tabIds]) findTab(id).groupId = -1;
        dropEmptyGroups();
      },
    },
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      get: async (id: number) => ({ ...findGroup(id) }),
      query: async (q: { windowId?: number }) =>
        groups.filter((g) => q.windowId === undefined || g.windowId === q.windowId).map((g) => ({ ...g })),
      update: async (id: number, props: Partial<FakeGroup>) => Object.assign(findGroup(id), props),
      move: async (id: number, { index }: { index: number }) => {
        const group = findGroup(id);
        const members = tabs.filter((t) => t.groupId === id).sort((a, b) => a.index - b.index);
        members.forEach((t, i) => (t.index = index - 0.5 + i / (members.length + 1)));
        reindex(group.windowId);
      },
    },
    storage: { sync: storageArea(), local: storageArea(), session: storageArea() },
  };

  return {
    chrome,
    tabs,
    groups,
    addTab: (tab: Partial<FakeTab> & { id: number; url: string }) => {
      const windowId = tab.windowId ?? 1;
      tabs.push({
        windowId,
        index: tabs.filter((t) => t.windowId === windowId).length,
        groupId: -1,
        pinned: false,
        ...tab,
      });
    },
    /** A group created outside Polite Tabs, e.g. by hand or by Claude in Chrome. */
    addForeignGroup: (title: string, tabIds: number[]) => {
      const id = nextGroupId++;
      groups.push({ id, windowId: findTab(tabIds[0]!).windowId, title, color: 'orange', collapsed: false });
      for (const tabId of tabIds) findTab(tabId).groupId = id;
      return id;
    },
    groupOf: (tabId: number) => groups.find((g) => g.id === findTab(tabId).groupId),
  };
};
