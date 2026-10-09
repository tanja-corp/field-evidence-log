"""Print entries in the line format of the private job-hunting ledger (profile/facts.md).

The ledger is the single source of truth for what may be said in ES and interviews.
This script only prints candidate lines. Paste them there after the owner has confirmed numbers and role.
Tags: ✅ confirmed / ⚠️ needs checking / 💭 idea or in progress / ⏸ stopped. Only ✅ may be used in final answers.

Run: python scripts/export_facts.py [--min-tag all]
"""
import common as c

cfg = c.load("config.json")
entries = c.load("entries.json")

print("# 候補（就活台帳 profile/facts.md に貼る前に、数字と役割を確認する）")
print(f"# 確度タグ: {cfg['fact_tag_note']}")
print()
for e in entries:
    result = e["result"].replace("\n", " ")
    line = f"- {e['fact_tag']} **{e['title']}**（{e['date']}）: {e['action'].replace(chr(10), ' ')} → {result}"
    print(line)
    for m in e.get("missing", []):
        print(f"  - 未確認: {m}")
    for s in e.get("sources", []):
        print(f"  - 証拠: {s['label']}" + (f" {s['url']}" if s.get("url") else ""))
