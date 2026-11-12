import {
  baseGroupTitle,
  colorForRule,
  findMatchingRule,
  groupTitle,
  sortRules,
  type GroupRule,
  type TabInfo,
} from '../shared/rules';
import {
  getGroupOwners,
  getPlacedTabs,
  getRules,
  getSettings,
  saveGroupOwners,
  savePlacedTabs,
  type GroupOwners,
  type PlacedTabs,
  type Settings,
} from '../shared/storage';

const NO_GROUP = -1;

const getGroup = async (groupId: number) => {
  try {
    return await chrome.tabGroups.get(groupId);
  } catch {
    return undefined;
  }
};

const getTab = async (tabId: number) => {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return undefined;
  }
};

const tabInfo = (tab: chrome.tabs.Tab, urlHint?: string): TabInfo | undefined => {
  const url = urlHint ?? tab.url ?? tab.pendingUrl;
  return url ? { url, title: tab.title } : undefined;
};

/**
 * Ungroups tabs on our own initiative. They are also dropped from the placed list,
 * so they are not mistaken for tabs the user took out by hand.
 */
const ungroupTabs = async (tabs: chrome.tabs.Tab[]) => {
  const ids = tabs.flatMap((t) => (t.id === undefined ? [] : [t.id]));
  const [first, ...rest] = ids;
  if (first === undefined) return;
  await chrome.tabs.ungroup([first, ...rest]);
  const placed = await getPlacedTabs();
  ids.forEach((id) => delete placed[id]);
  await savePlacedTabs(placed);
};

const findRuleGroup = async (windowId: number, ruleId: number, owners: GroupOwners) => {
  const groups = await chrome.tabGroups.query({ windowId });
  return groups.find((g) => owners[g.id] === ruleId);
};

/** True when the user took this tab out of our group and it is still on the same page. */
const removedByUser = (tab: chrome.tabs.Tab, url: string, placed: PlacedTabs, settings: Settings) =>
  !settings.restoreRemovedTabs && tab.groupId === NO_GROUP && placed[tab.id!] === url;

/**
 * Our record of which groups we own is wiped on a browser restart and on an extension
 * reload or update, so our own groups come back looking like anyone else's. A group
 * titled with one of our rule names is therefore treated as ours: the first such group
 * is taken back when the rule has none in the window, and the tabs of any others are
 * moved into the rule's group, so a duplicate left by an earlier mix-up disappears.
 * Groups with other titles are left to whoever made them (the user, or another
 * extension such as Claude in Chrome).
 *
 * Returns true when it moved tabs, as their group ids are then out of date.
 */
const adoptLookalikes = async (windowId: number, rules: GroupRule[], owners: GroupOwners) => {
  const groups = await chrome.tabGroups.query({ windowId });
  const lookalikes = groups.filter((g) => owners[g.id] === undefined && g.title);
  if (lookalikes.length === 0) return false;

  const tabs = await chrome.tabs.query({ windowId });
  const tabsOf = (groupId: number) => tabs.filter((t) => t.groupId === groupId && t.id !== undefined);
  let moved = false;
  for (const rule of rules) {
    // Re-checks ownership: an earlier rule with the same name may have just taken one.
    const same = lookalikes.filter(
      (g) => owners[g.id] === undefined && baseGroupTitle(g.title!) === rule.name
    );
    if (same.length === 0) continue;

    let target = groups.find((g) => owners[g.id] === rule.id);
    if (!target) {
      // Keep the biggest one so the fewest tabs move.
      target = same.reduce((a, b) => (tabsOf(b.id).length > tabsOf(a.id).length ? b : a));
      owners[target.id] = rule.id;
      await saveGroupOwners(owners);
    }
    for (const group of same) {
      if (group.id === target.id) continue;
      const [first, ...rest] = tabsOf(group.id).map((t) => t.id!);
      if (first === undefined) continue;
      await chrome.tabs.group({ groupId: target.id, tabIds: [first, ...rest] });
      moved = true;
    }
    await refreshGroupAppearance(target.id, rule, rules);
  }
  return moved;
};

export const refreshGroupAppearance = async (groupId: number, rule: GroupRule, rules: GroupRule[]) => {
  const group = await getGroup(groupId);
  if (!group) return;
  const { showTabCount } = await getSettings();
  const tabs = await chrome.tabs.query({ groupId });
  const title = groupTitle(rule.name, showTabCount && group.collapsed, tabs.length);
  const color = colorForRule(rule, rules);
  // Only write on change: every update fires tabGroups.onUpdated, which calls back here.
  if (group.title !== title || group.color !== color) {
    await chrome.tabGroups.update(groupId, { title, color });
  }
};

export interface HandleOptions {
  /** URL from the navigation event, which can be newer than `tab.url`. */
  url?: string;
  /** Run even in manual mode, and put back tabs the user took out. */
  force?: boolean;
}

export const handleTab = async (tabId: number, options: HandleOptions = {}): Promise<number | undefined> => {
  const settings = await getSettings();
  if (settings.manualMode && !options.force) return undefined;
  let tab = await getTab(tabId);
  if (!tab || tab.pinned) return undefined;
  const info = tabInfo(tab, options.url);
  if (!info) return undefined;

  const rules = await getRules();
  const owners = await getGroupOwners();
  const placed = await getPlacedTabs();

  if (await adoptLookalikes(tab.windowId, rules, owners)) {
    tab = await getTab(tabId);
    if (!tab) return undefined;
  }

  const currentRuleId = tab.groupId === NO_GROUP ? undefined : owners[tab.groupId];
  // Someone else's group: never pull tabs out of it.
  if (tab.groupId !== NO_GROUP && currentRuleId === undefined) return undefined;

  if (!options.force && removedByUser(tab, info.url, placed, settings)) return undefined;

  const rule = findMatchingRule(info, rules);
  if (!rule) {
    if (currentRuleId !== undefined && settings.ungroupNonMatching) await ungroupTabs([tab]);
    return tab.windowId;
  }

  let groupId: number;
  let groupedIds = [tabId];
  if (currentRuleId === rule.id) {
    groupId = tab.groupId;
  } else {
    const target = await findRuleGroup(tab.windowId, rule.id, owners);
    if (target) {
      groupId = await chrome.tabs.group({ groupId: target.id, tabIds: tabId });
    } else {
      if (settings.skipSingleTabGroups) {
        // Gather every tab in the window that would join this group; one alone is not enough.
        const windowTabs = await chrome.tabs.query({ windowId: tab.windowId });
        groupedIds = windowTabs
          .filter((t) => t.id !== undefined && !t.pinned)
          .filter((t) => t.groupId === NO_GROUP || owners[t.groupId] !== undefined)
          .filter((t) => {
            const other = t.id === tabId ? info : tabInfo(t);
            return (
              other !== undefined &&
              findMatchingRule(other, rules)?.id === rule.id &&
              (options.force || !removedByUser(t, other.url, placed, settings))
            );
          })
          .map((t) => t.id!);
        if (groupedIds.length < 2) {
          if (currentRuleId !== undefined) await ungroupTabs([tab]);
          return tab.windowId;
        }
      }
      const [first, ...rest] = groupedIds as [number, ...number[]];
      groupId = await chrome.tabs.group({
        tabIds: [first, ...rest],
        createProperties: { windowId: tab.windowId },
      });
      owners[groupId] = rule.id;
      await saveGroupOwners(owners);
    }
  }

  for (const id of groupedIds) {
    const url = id === tabId ? info.url : (await getTab(id))?.url;
    if (url) placed[id] = url;
  }
  await savePlacedTabs(placed);
  await refreshGroupAppearance(groupId, rule, rules);
  return tab.windowId;
};

/** With `skipSingleTabGroups`, a group that is down to one tab is dissolved. */
export const pruneSmallGroups = async (windowId: number) => {
  const settings = await getSettings();
  if (!settings.skipSingleTabGroups) return;
  const owners = await getGroupOwners();
  const groups = await chrome.tabGroups.query({ windowId });
  for (const group of groups) {
    if (owners[group.id] === undefined) continue;
    const tabs = await chrome.tabs.query({ groupId: group.id });
    if (tabs.length === 1) await ungroupTabs(tabs);
  }
};

/** With `autoCollapseOthers`, keeps only the active tab's group open in the window. */
export const collapseOthers = async (tabId: number) => {
  const settings = await getSettings();
  if (!settings.autoCollapseOthers) return;
  const tab = await getTab(tabId);
  if (!tab) return;
  const owners = await getGroupOwners();
  const rules = await getRules();
  const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
  for (const group of groups) {
    const rule = rules.find((r) => r.id === owners[group.id]);
    if (!rule) continue;
    const collapsed = group.id !== tab.groupId;
    if (group.collapsed !== collapsed) {
      await chrome.tabGroups.update(group.id, { collapsed });
      await refreshGroupAppearance(group.id, rule, rules);
    }
  }
};

/** Packs our groups at the left of the tab strip (after pinned tabs), in rule order. */
export const alignWindow = async (windowId: number) => {
  const settings = await getSettings();
  if (!settings.alignGroups) return;
  const rules = sortRules(await getRules());
  const owners = await getGroupOwners();
  const groups = await chrome.tabGroups.query({ windowId });

  let tabs = await chrome.tabs.query({ windowId });
  let offset = tabs.filter((t) => t.pinned).length;
  for (const rule of rules) {
    const group = groups.find((g) => owners[g.id] === rule.id);
    if (!group) continue;
    const groupTabs = tabs.filter((t) => t.groupId === group.id);
    if (groupTabs.length === 0) continue;
    if (groupTabs[0]!.index !== offset) {
      await chrome.tabGroups.move(group.id, { index: offset });
      tabs = await chrome.tabs.query({ windowId });
    }
    offset += groupTabs.length;
  }
};

/**
 * Brings existing groups in line with the current rules: drops groups whose rule was
 * deleted, renames/recolors the rest, and ungroups tabs that no longer match.
 */
export const reconcileGroups = async () => {
  const settings = await getSettings();
  const rules = await getRules();
  const owners = await getGroupOwners();
  for (const [key, ruleId] of Object.entries(owners)) {
    const groupId = Number(key);
    const group = await getGroup(groupId);
    if (!group) {
      delete owners[key];
      continue;
    }
    const tabs = await chrome.tabs.query({ groupId });
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) {
      delete owners[key];
      await ungroupTabs(tabs);
      continue;
    }
    if (settings.ungroupNonMatching) {
      const stray = tabs.filter((t) => {
        const info = tabInfo(t);
        return !info || findMatchingRule(info, rules)?.id !== rule.id;
      });
      await ungroupTabs(stray);
    }
    await refreshGroupAppearance(groupId, rule, rules);
  }
  await saveGroupOwners(owners);
};

export const forgetGroup = async (groupId: number) => {
  const owners = await getGroupOwners();
  if (owners[groupId] === undefined) return;
  delete owners[groupId];
  await saveGroupOwners(owners);
};

export const forgetTab = async (tabId: number) => {
  const placed = await getPlacedTabs();
  if (placed[tabId] === undefined) return;
  delete placed[tabId];
  await savePlacedTabs(placed);
};

export const getOwnedGroups = async () => {
  const owners = await getGroupOwners();
  const groups = await chrome.tabGroups.query({});
  return groups.filter((g) => owners[g.id] !== undefined);
};

export const setCollapsed = async (collapsed: boolean) => {
  const rules = await getRules();
  const owners = await getGroupOwners();
  for (const group of await getOwnedGroups()) {
    await chrome.tabGroups.update(group.id, { collapsed });
    const rule = rules.find((r) => r.id === owners[group.id]);
    if (rule) await refreshGroupAppearance(group.id, rule, rules);
  }
};

export const ruleForGroup = async (groupId: number) => {
  const owners = await getGroupOwners();
  const ruleId = owners[groupId];
  if (ruleId === undefined) return undefined;
  const rules = await getRules();
  const rule = rules.find((r) => r.id === ruleId);
  return rule && { rule, rules };
};
