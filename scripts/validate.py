"""Validate data/*.json. Exit 1 on any error so a bad record never reaches the site.

Run: python scripts/validate.py
"""
import json
import sys

import common as c


def collect_strings(obj, path=""):
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, list):
        for i, x in enumerate(obj):
            key = x.get("id") if isinstance(x, dict) and x.get("id") else i
            yield from collect_strings(x, f"{path}[{key}]")
    elif isinstance(obj, dict):
        for k, x in obj.items():
            yield from collect_strings(x, f"{path}.{k}" if path else k)


def validate_all():
    errs = []
    files = {}
    for name in ["config.json", "deck.json", "entries.json", "themes.json", "interview.json",
                 "questions.json", "feedback.json", "changelog.json"]:
        try:
            files[name] = c.load(name)
        except Exception as e:  # noqa: BLE001
            errs.append(f"{name}: 読み込めない ({e})")
    if errs:
        return errs

    deck, entries, themes = files["deck.json"], files["entries.json"], files["themes.json"]
    iv, qs, fb = files["interview.json"], files["questions.json"], files["feedback.json"]

    slide_ids = [s["id"] for s in deck["slides"]]
    if len(set(slide_ids)) != len(slide_ids):
        errs.append("deck.json: slide id が重複")
    for s in deck["slides"]:
        if s["group"] not in deck["groups"]:
            errs.append(f"deck {s['id']}: group が不明 {s['group']}")
        for t in s.get("tags", []):
            if t not in deck["tag_labels"]:
                errs.append(f"deck {s['id']}: tag が不明 {t}")
        if not isinstance(s.get("seconds"), int):
            errs.append(f"deck {s['id']}: seconds が整数でない")

    theme_ids = [t["id"] for t in themes]
    if len(set(theme_ids)) != len(theme_ids):
        errs.append("themes.json: id が重複")

    seen = set()
    for e in entries:
        i = e.get("id", "?")
        if not c.ID_ENTRY_RE.match(i):
            errs.append(f"{i}: id の形式が不正")
        if i in seen:
            errs.append(f"{i}: id が重複")
        seen.add(i)
        if not c.DATE_RE.match(e.get("date", "")):
            errs.append(f"{i}: date は YYYY-MM か YYYY-MM-DD")
        if not e.get("title") or len(e["title"]) > c.MAX_TITLE:
            errs.append(f"{i}: title が空、または{c.MAX_TITLE}字超")
        if e.get("area") not in c.AREAS:
            errs.append(f"{i}: area が不正 {e.get('area')}")
        if e.get("evidence_level") not in c.EVIDENCE:
            errs.append(f"{i}: evidence_level が不正")
        if e.get("status") not in c.STATUSES:
            errs.append(f"{i}: status が不正")
        if e.get("fact_tag") not in c.FACT_TAGS:
            errs.append(f"{i}: fact_tag が不正")
        for u in e.get("uses", []):
            if u not in c.USES:
                errs.append(f"{i}: uses が不正 {u}")
        for t in e.get("themes", []):
            if t not in theme_ids:
                errs.append(f"{i}: theme が不明 {t}")
        for sid in e.get("deck_slides", []):
            if sid not in slide_ids:
                errs.append(f"{i}: deck_slides が不明 {sid}")
        for src in e.get("sources", []):
            if not src.get("label"):
                errs.append(f"{i}: sources の label が空")
            if src.get("url") and not c.is_http_url(src["url"]):
                errs.append(f"{i}: sources の url が http(s) でない")
        for f in c.TEXT_FIELDS:
            if len(e.get(f, "")) > c.MAX_TEXT:
                errs.append(f"{i}: {f} が{c.MAX_TEXT}字超")

    for st in iv["stories"]:
        for eid in st.get("entries", []):
            if eid not in seen:
                errs.append(f"interview {st['id']}: entry が不明 {eid}")
        for t in st.get("themes", []):
            if t not in theme_ids:
                errs.append(f"interview {st['id']}: theme が不明 {t}")
        if st.get("fact_tag") not in c.FACT_TAGS:
            errs.append(f"interview {st['id']}: fact_tag が不正")

    qids = [q["id"] for q in qs]
    if len(set(qids)) != len(qids):
        errs.append("questions.json: id が重複")
    valid_targets = set(slide_ids) | seen | set(qids) | {s["id"] for s in iv["stories"]} | set(theme_ids)
    for q in qs:
        for a in q.get("affects", []):
            if a not in valid_targets:
                errs.append(f"question {q['id']}: affects が不明 {a}")

    fb_ids = set()
    for f in fb:
        if f.get("id") in fb_ids:
            errs.append(f"feedback {f.get('id')}: id が重複")
        fb_ids.add(f.get("id"))
        if f.get("verdict") not in c.VERDICTS:
            errs.append(f"feedback {f.get('id')}: verdict が不正")

    # privacy lint over everything that will be published
    for name, obj in files.items():
        for path, s in collect_strings(obj):
            for h in c.privacy_hits(s):
                # never echo the text itself: CI logs and issue comments are public
                errs.append(f"{name} {path}: 公開できない内容の疑い（{h}）。該当の文は表示しません")
    return errs


if __name__ == "__main__":
    problems = validate_all()
    if problems:
        print("NG", len(problems), "件")
        for p in problems:
            print(" -", p)
        sys.exit(1)
    print("OK: data/*.json は正しい形式です")
