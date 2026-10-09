"""Add one entry from the command line (used by Claude when the owner reports something in chat).

Example:
  python scripts/add_entry.py --date 2026-10-20 --title "..." --area field \
      --situation "..." --action "..." --result "..." --learning "..." \
      --evidence observed --uses admin-meeting interview --themes verify-on-ground \
      --slides S04 --missing "数字" "役割" --fact-tag ⚠️

Validates before writing. Never writes a record that fails scripts/validate.py.
"""
import argparse
import sys

import common as c
import validate


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--date", required=True)
    p.add_argument("--title", required=True)
    p.add_argument("--title-en", default="")
    p.add_argument("--area", required=True, choices=c.AREAS)
    p.add_argument("--situation", default="")
    p.add_argument("--action", default="")
    p.add_argument("--result", default="")
    p.add_argument("--learning", default="")
    p.add_argument("--evidence", default="to-confirm", choices=c.EVIDENCE)
    p.add_argument("--uses", nargs="*", default=[])
    p.add_argument("--themes", nargs="*", default=[])
    p.add_argument("--slides", nargs="*", default=[])
    p.add_argument("--source", nargs="*", default=[], help="label or label|url")
    p.add_argument("--missing", nargs="*", default=[])
    p.add_argument("--status", default="draft", choices=c.STATUSES)
    p.add_argument("--fact-tag", default="⚠️", choices=c.FACT_TAGS)
    p.add_argument("--note", default="")
    a = p.parse_args()

    entries = c.load("entries.json")
    sources = []
    for s in a.source:
        label, _, url = s.partition("|")
        sources.append({"label": label, **({"url": url} if url else {})})
    rec = {
        "id": c.next_id(entries, "E-"), "date": a.date, "title": a.title, "title_en": a.title_en, "area": a.area,
        "themes": a.themes, "situation": a.situation, "action": a.action, "result": a.result, "learning": a.learning,
        "evidence_level": a.evidence, "sources": sources, "deck_slides": a.slides, "uses": a.uses,
        "status": a.status, "fact_tag": a.fact_tag, "missing": a.missing, "note": a.note,
    }
    entries.append(rec)
    c.save("entries.json", entries)
    problems = validate.validate_all()
    if problems:
        entries.pop()
        c.save("entries.json", entries)
        print("NG: 追加を取り消しました")
        for x in problems:
            print(" -", x)
        sys.exit(1)
    print("added", rec["id"])


if __name__ == "__main__":
    main()
