# プライバシーポリシー

最終更新：2026 年 11 月 9 日

Polite Tabs（以下「この拡張」）が扱うデータと、その扱い方を説明します。

## 要点

- この拡張はデータを外部のサーバーへ送りません。開発者がデータを受け取ることもありません。
- 広告や分析のためのツールは入っていません。
- データを売ったり、第三者に渡したりしません。

## 扱うデータ

| データ                          | 使い道                                             | 置き場所                                                               |
| ------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| 開いているタブの URL とタイトル | ルールに当たるかを調べ、タブをグループに入れるため | 照合のときにその場で読みます。ディスクには保存しません（下の注を参照） |
| 利用者が作ったルールと設定      | 振り分けのため                                     | `chrome.storage.sync`                                                  |
| タブグループとルールの対応      | どのグループをこの拡張が作ったかを覚えておくため   | `chrome.storage.session`                                               |

> 注：この拡張がグループに入れたタブは、その URL を `chrome.storage.session` に一時的に残します。利用者が手でグループから外したタブを見分けるためです。`chrome.storage.session` はメモリの中だけにあり、ブラウザを閉じると消えます。

### `chrome.storage.sync` について

ルールと設定は `chrome.storage.sync` に保存します。Chrome の同期をオンにしている場合、Chrome がこれを利用者の Google アカウントに同期し、ほかのパソコンでも同じルールが使えるようにします。同期は Chrome の機能で、この拡張の開発者はその中身を見られません。

## 権限の使い道

| 権限            | 使い道                                                          |
| --------------- | --------------------------------------------------------------- |
| `tabs`          | タブの URL とタイトルを読み、グループに入れたり外したりするため |
| `tabGroups`     | グループを作り、名前・色・並び・折りたたみを変えるため          |
| `webNavigation` | ページの移動に気づき、移動先の URL ですぐ振り分け直すため       |
| `storage`       | ルールと設定を保存するため                                      |

## 変更

このポリシーを変えるときは、このページを更新し、上の日付を改めます。

## 問い合わせ

GitHub の Issue でお知らせください。
https://github.com/rerorets/polite-tabs/issues

---

# Privacy Policy (English)

Last updated: November 9, 2026

- Polite Tabs does not send any data to external servers. The developer receives no data.
- It contains no advertising or analytics code, and never sells or transfers user data.
- Tab URLs and titles are read only to match them against the user's rules and group the tabs. They are not written to disk. The URLs of tabs the extension has grouped are kept in `chrome.storage.session` (memory only, cleared when the browser closes) so it can tell when the user removes a tab from a group by hand.
- Rules and settings are stored in `chrome.storage.sync`, which Chrome may sync to the user's Google account when Chrome sync is on.
- Which tab group belongs to which rule is kept in `chrome.storage.session` and cleared when the browser closes.

Questions: https://github.com/rerorets/polite-tabs/issues
