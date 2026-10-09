# 作業メモ（AI向け）

このリポジトリは公開されている。書くものはすべて公開される前提で扱う。

## 入力を受けたとき

1. 本人の話を `scripts/add_entry.py` で `data/entries.json` に1件ずつ追加する。確度タグは⚠️から始める。
2. 数字、出典、自分の役割が言えない部分は、`--missing` に書く。作らない。
3. テーマ（`themes.json`）と、使うスライド（`deck.json` の id）を割り当てる。
4. `python scripts/validate.py` が通ってから commit、push する。push で自動公開される。
5. 資料（PPTX）を直したら、`data/deck.json` の該当スライド、`changelog.json` も同じ変更で更新する。

## フィードバックを読むとき

`data/feedback.json` の `target`（S03、Q04、E-0002 など）ごとに、最新の `verdict`（ok／revise／hold）と `comment` を読む。
revise は直す、hold は触らない、ok は確定扱い。Q番号の回答は、`questions.json` の該当問いの答えとして扱う。

## 公開してはいけないもの

個人名、取引先名、金額、社内の非公開の情報、未発表の取引関係は載せない。迷ったら載せずに、本人へ聞く。
`scripts/denylist.local.txt` は git 管理外で、ローカルで `validate.py` を通すときだけ効く。
