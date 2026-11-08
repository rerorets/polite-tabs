# Polite Tabs

<img src="assets/icon.svg" alt="" width="96" height="96" align="right">

URL やページのタイトルで、Chrome のタブを自動でグループにまとめる拡張です。

自分が作っていないタブグループには触りません。手で作ったグループや、Claude in Chrome などのほかの拡張が作ったグループからも、タブを動かしません。

## できること

- 「mail」「dev」のようなルールに URL かタイトルの条件を書いておくと、当たるタブがそのグループに入ります。
- 条件の書き方はワイルドカード（`github.com` や `*.example.com/docs`）と正規表現の 2 つから選べます。大文字と小文字は区別しません。
- グループはルールの順にタブバーの左側へ並びます。
- グループをまとめて折りたたんだり開いたりできます（`Alt+Shift+C`）。
- Polite Tabs が作っていないグループには、どの設定でも触りません。

設定ページでは次の動きを切り替えられます。

| 設定                                   | 初期値 |
| -------------------------------------- | ------ |
| 手動モード（`Alt+Shift+G` で振り分け） | オフ   |
| グループから外したタブを戻す           | オン   |
| 当たらなくなったタブをグループから外す | オン   |
| 1 枚だけならグループにしない           | オフ   |
| グループをルールの順に並べる           | オン   |
| 折りたたんだグループにタブの数を出す   | オン   |
| ほかのグループを自動で折りたたむ       | オフ   |

> 画面は日本語だけです。

## インストール

Chrome ウェブストアへの掲載を準備しています。それまでは、次の手順でソースから入れられます。

1. 下の「開発」の手順でビルドします。
2. `chrome://extensions` を開き、右上の「デベロッパー モード」をオンにします。
3. 「パッケージ化されていない拡張機能を読み込む」から、`build/` フォルダを選びます。

Chrome 120 以降で動きます。

## プライバシー

タブの URL とタイトルはルールに当たるかを調べるためだけに読みます。どこにも送らず、拡張の外へは出しません。

詳しくは [プライバシーポリシー](PRIVACY.md) に書いています。

## 開発

Node 24 が要ります（`.nvmrc` を参照）。

```sh
npm install
npm run build   # 型チェックをして build/ にビルド
npm run dev     # 変更のたびにビルドし直す
npm test
npm run lint
npm run icons   # assets/icon.svg から PNG を書き出す（macOS の Chrome を使います）
```

ビルドし直したら、`chrome://extensions` で拡張の更新ボタン（↻）を押します。

| 場所                | 中身                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| `src/background`    | service worker。実際のタブグループを作り、名前・色・並びを整えます    |
| `src/ui`            | ポップアップと設定ページ（React）。どちらも同じ画面を出します         |
| `src/shared`        | ルールの照合、一括編集の形式、保存。両方から使います                  |
| `assets`            | アイコンの元データ（SVG）                                             |
| `src/manifest.json` | manifest のひな形。バージョンと説明は `package.json` から埋め込みます |

ルールは `chrome.storage.sync` に保存します。どのグループがどのルールのものかは `chrome.storage.session` に持ちます。グループの ID はブラウザを起動し直すと変わるためです。

## クレジット

[Acid Tabs](https://github.com/jdhayford/acid-tabs-extension)（作者：[jdhayford](https://github.com/jdhayford)）の fork から始まりました。Acid Tabs は [lxieyang](https://github.com/lxieyang) さんの [chrome-extension-boilerplate-react](https://github.com/lxieyang/chrome-extension-boilerplate-react) をもとに作られています。

## ライセンス

[MIT](LICENSE)
