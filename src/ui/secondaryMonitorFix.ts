/**
 * On macOS, a popup opened on a secondary monitor may never repaint. Keeping a
 * never-ending, invisible animation running forces Chrome to redraw it.
 * @see https://bugs.chromium.org/p/chromium/issues/detail?id=971701
 */
export const applySecondaryMonitorFix = async () => {
  const offPrimaryScreen =
    window.screenLeft < 0 ||
    window.screenTop < 0 ||
    window.screenLeft > window.screen.width ||
    window.screenTop > window.screen.height;
  if (!offPrimaryScreen) return;

  const { os } = await chrome.runtime.getPlatformInfo();
  if (os !== 'mac') return;

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
    @keyframes polite-redraw { from { opacity: 1; } to { opacity: 0.99; } }
    html { animation: polite-redraw 1s linear infinite; }
  `);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
};
