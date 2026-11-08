import { useEffect, useState } from 'react';
import type { TabInfo } from '../shared/rules';

const readTabs = async (): Promise<TabInfo[]> => {
  const tabs = await chrome.tabs.query({});
  return tabs.flatMap((t) => {
    const url = t.url ?? t.pendingUrl;
    return url && !t.pinned ? [{ url, title: t.title }] : [];
  });
};

/** URLs and titles of the open tabs, kept fresh so rules can show how many tabs they match. */
export const useOpenTabs = () => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void readTabs().then(setTabs), 150);
    };
    void readTabs().then(setTabs);
    chrome.tabs.onUpdated.addListener(refresh);
    chrome.tabs.onCreated.addListener(refresh);
    chrome.tabs.onRemoved.addListener(refresh);
    return () => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(refresh);
      chrome.tabs.onCreated.removeListener(refresh);
      chrome.tabs.onRemoved.removeListener(refresh);
    };
  }, []);
  return tabs;
};
