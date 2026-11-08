import type { GroupRule } from './rules';

export interface Settings {
  /** Only group when told to (shortcut or popup button), never on its own. */
  manualMode: boolean;
  /** Put a tab back into its group after the user takes it out. */
  restoreRemovedTabs: boolean;
  /** Take a tab out of its group once no rule matches it any more. */
  ungroupNonMatching: boolean;
  /** Wait until two tabs match a rule before making a group for them. */
  skipSingleTabGroups: boolean;
  /** Keep our groups packed at the left of the tab strip, in rule order. */
  alignGroups: boolean;
  /** Show "name (3)" on collapsed groups. */
  showTabCount: boolean;
  /** Collapse our other groups in the window when a tab becomes active. */
  autoCollapseOthers: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  manualMode: false,
  restoreRemovedTabs: true,
  ungroupNonMatching: true,
  skipSingleTabGroups: false,
  alignGroups: true,
  showTabCount: true,
  autoCollapseOthers: false,
};

/** Maps a tab group id to the id of the rule that owns it. */
export type GroupOwners = Record<string, number>;

export const getRules = async (): Promise<GroupRule[]> => {
  const { groupRules } = await chrome.storage.sync.get('groupRules');
  return Array.isArray(groupRules) ? (groupRules as GroupRule[]) : [];
};

export const saveRules = (rules: GroupRule[]) => chrome.storage.sync.set({ groupRules: rules });

export const getHasConfirmed = async (): Promise<boolean> => {
  const { hasConfirmed } = await chrome.storage.sync.get('hasConfirmed');
  return hasConfirmed === true;
};

export const setHasConfirmed = () => chrome.storage.sync.set({ hasConfirmed: true });

export const getSettings = async (): Promise<Settings> => {
  const { settings } = await chrome.storage.sync.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
};

export const saveSettings = (settings: Settings) => chrome.storage.sync.set({ settings });

// Group ownership lives in session storage: group ids are only valid for one browser
// session, and session storage is wiped on restart, so stale ids can never point at
// someone else's group.
export const getGroupOwners = async (): Promise<GroupOwners> => {
  const { groupOwners } = await chrome.storage.session.get('groupOwners');
  return (groupOwners as GroupOwners | undefined) ?? {};
};

export const saveGroupOwners = (groupOwners: GroupOwners) => chrome.storage.session.set({ groupOwners });

/**
 * Tabs we grouped, with the URL they had at the time. A tab that is ungrouped but
 * still on that URL was taken out by the user, which `restoreRemovedTabs` respects.
 */
export type PlacedTabs = Record<string, string>;

export const getPlacedTabs = async (): Promise<PlacedTabs> => {
  const { placedTabs } = await chrome.storage.session.get('placedTabs');
  return (placedTabs as PlacedTabs | undefined) ?? {};
};

export const savePlacedTabs = (placedTabs: PlacedTabs) => chrome.storage.session.set({ placedTabs });

/** Removes the per-window keys that versions up to 6.x kept in local and sync storage. */
export const removeLegacyKeys = async () => {
  for (const area of [chrome.storage.local, chrome.storage.sync]) {
    const keys = Object.keys(await area.get(null)).filter((k) => k.startsWith('window:'));
    if (keys.length > 0) await area.remove(keys);
  }
};
