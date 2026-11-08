# Polite Tabs

Automatically groups Chrome tabs by URL pattern.

Polite Tabs started as a fork of Acid Tabs, [jdhayford/acid-tabs-extension](https://github.com/jdhayford/acid-tabs-extension) (original store listing: https://chrome.google.com/webstore/detail/acid-tabs/hgceopemmcmigbmhphbcgkeffommpjfc ).

## How it works

- Each rule has a name, a color, URL patterns and optionally page-title patterns. A tab joins the group when its URL or its title matches.
- Patterns are either wildcards (separated by spaces; `*` matches anything, the rest is a literal substring) or regular expressions (one per line). Matching ignores case.
- The first matching rule (top to bottom) decides the group, and groups are kept in rule order at the left of the tab strip.
- Groups that Polite Tabs did not create — made by hand or by another extension such as Claude in Chrome — are never touched.
- The settings page can turn on manual mode (group only on demand, `Alt+Shift+G`), keep tabs the user took out of a group, keep tabs that stop matching, skip one-tab groups, auto-collapse other groups, and hide the tab count on collapsed groups.

## Layout

| Path                | What it is                                                                  |
| ------------------- | --------------------------------------------------------------------------- |
| `src/background`    | Service worker. Groups, names, colors and orders the actual tab groups.     |
| `src/ui`            | Popup and settings page (React). Both render the same app.                  |
| `src/shared`        | Rule matching, bulk-edit format and storage, used by both sides.            |
| `assets`            | Icon sources (SVG). `npm run icons` renders them into `src/public`.         |
| `src/manifest.json` | Manifest template; version and description are filled in from package.json. |

Rules live in `chrome.storage.sync`. Which tab group belongs to which rule lives in `chrome.storage.session`, because group ids are only valid for one browser session.

## Local dev

Requires Node 24 (see `.nvmrc`).

```sh
npm install
npm run build   # type-check and build into build/
npm run dev     # rebuild on change
npm test
npm run lint
```

Load `build/` from `chrome://extensions` with Developer mode on ("Load unpacked"). After a rebuild, press the reload button on the extension card.

## Credits

Originally created by [@jdhayford](https://github.com/jdhayford), on top of [@lxieyang](https://github.com/lxieyang)'s [chrome-extension-boilerplate-react](https://github.com/lxieyang/chrome-extension-boilerplate-react).
