# 初回の公開手順

リポジトリ作成、Pagesの有効化、ラベル作成を1回だけ行う。以後は push するたびに自動で更新される。

```
gh repo create tanja-corp/field-evidence-log --public --source . --remote origin --push
gh api -X POST repos/tanja-corp/field-evidence-log/pages -f build_type=workflow
gh label create entry --color 2E5A45 --description "経験の記録" -R tanja-corp/field-evidence-log
gh label create feedback --color B86D4B --description "構成へのフィードバック" -R tanja-corp/field-evidence-log
gh workflow run site -R tanja-corp/field-evidence-log
```

公開後の確認:

1. Actions の `site` が成功している。
2. https://tanja-corp.github.io/field-evidence-log/ が開く。
3. 「入力する」から、テストの記録かフィードバックを1件送る。1〜2分で画面に出て、Issueが自動で閉じる。
4. テストの記録は、`data/entries.json` か `data/feedback.json` から消して push する。

公開をやめるとき:

```
gh repo edit tanja-corp/field-evidence-log --visibility private --accept-visibility-change-consequences
```

無料プランでは、非公開にするとPagesは止まる。
