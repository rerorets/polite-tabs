export type Message = { type: 'setCollapsed'; collapsed: boolean } | { type: 'groupNow' };

export const sendMessage = (message: Message) => chrome.runtime.sendMessage(message);
