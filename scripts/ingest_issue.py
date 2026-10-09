"""Turn a GitHub Issue (from the issue forms) into a record in data/*.json.

Event mode (workflow `issues` event): reads ISSUE_NUMBER, ISSUE_TITLE, ISSUE_BODY, ISSUE_LABELS, ISSUE_AUTHOR.
Sweep mode (`--sweep`): processes every open issue labelled entry/feedback via `gh issue list`.
Only issues written by the repository owner (OWNER env) are processed.
DRY_RUN=1 skips every `gh` call (local tests).

Exit code is 0 even when an issue is rejected; the rejection is reported on the issue itself.
"""
import datetime
import json
import os
import re
import subprocess
import sys

import common as c
import validate

OWNER = os.environ.get("OWNER", "")
DRY = os.environ.get("DRY_RUN") == "1"

ENTRY_MAP = {
    "日付": "date", "タイトル": "title", "分野": "area", "状況・課題": "situation", "自分がしたこと": "action",
    "分かったこと・成果": "result", "学び・次にすること": "learning", "根拠の種類": "evidence_level",
    "出典": "source", "使う場面": "uses", "公開してよい内容の確認": "confirm",
}
FB_MAP = {"対象": "target", "判断": "verdict", "コメント": "comment", "公開してよい内容の確認": "confirm"}
VERDICT_JA = {"OK": "ok", "直す": "revise", "保留": "hold"}
USE_JA = {"Admin Meeting": "admin-meeting", "最終成果発表": "final-presentation",
          "ガクチカ・ES": "gakuchika", "面接": "interview"}


def parse_form(body):
    out = {}
    for m in re.finditer(r"^### (.+?)[ \t]*\n+(.*?)(?=^### |\Z)", body or "", re.S | re.M):
        out[m.group(1).strip()] = m.group(2).strip()
    return out


def pick(form, mapping):
    res = {}
    for label, text in form.items():
        for prefix, key in mapping.items():
            if label.startswith(prefix):
                res[key] = text
                break
    return res


def code_in_parens(s, allowed):
    m = re.search(r"\(([a-z-]+)\)\s*$", s.strip())
    if m and m.group(1) in allowed:
        return m.group(1)
    return s.strip() if s.strip() in allowed else None


def checked(text):
    return [re.sub(r"^- \[[xX]\]\s*", "", l).strip() for l in text.splitlines() if re.match(r"^- \[[xX]\]", l)]


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def ingest_entry(form, number):
    f = pick(form, ENTRY_MAP)
    errs = []
    if not checked(f.get("confirm", "")):
        errs.append("「公開してよい内容の確認」にチェックがありません。公開ページに載るため、必須です。")
    date = c.clean_text(f.get("date"), 20)
    if not c.DATE_RE.match(date):
        errs.append("日付は YYYY-MM か YYYY-MM-DD で書いてください。")
    title = c.clean_text(f.get("title"), c.MAX_TITLE)
    if not title:
        errs.append("タイトルが空です。")
    area = code_in_parens(f.get("area", ""), c.AREAS)
    if not area:
        errs.append("分野を選んでください。")
    ev = code_in_parens(f.get("evidence_level", ""), c.EVIDENCE) or "to-confirm"
    uses = [USE_JA[u] for u in checked(f.get("uses", "")) if u in USE_JA]
    if errs:
        return None, errs
    source = c.clean_text(f.get("source"), 400)
    sources = []
    if source:
        if c.is_http_url(source):
            sources.append({"label": source[:80], "url": source})
        else:
            sources.append({"label": source})
    entries = c.load("entries.json")
    if any(e.get("source_issue") == number for e in entries):
        return None, ["この Issue は取り込み済みです。"]
    rec = {
        "id": c.next_id(entries, "E-"),
        "date": date,
        "title": title,
        "title_en": "",
        "area": area,
        "themes": [],
        "situation": c.clean_text(f.get("situation")),
        "action": c.clean_text(f.get("action")),
        "result": c.clean_text(f.get("result")),
        "learning": c.clean_text(f.get("learning")),
        "evidence_level": ev,
        "sources": sources,
        "deck_slides": [],
        "uses": uses,
        "status": "draft",
        "fact_tag": "⚠️",
        "missing": ["テーマと、使うスライドの割り当て（Claudeが整理）", "数字と自分の役割の確認"],
        "note": "",
        "source_issue": number,
        "added": now(),
    }
    entries.append(rec)
    c.save("entries.json", entries)
    return rec["id"], []


def ingest_feedback(form, number):
    f = pick(form, FB_MAP)
    errs = []
    if not checked(f.get("confirm", "")):
        errs.append("「公開してよい内容の確認」にチェックがありません。")
    target = c.clean_text(f.get("target"), 40)
    if not target:
        errs.append("対象（スライド番号やQ番号）が空です。")
    verdict = VERDICT_JA.get(f.get("verdict", "").strip())
    if not verdict:
        errs.append("判断（OK／直す／保留）を選んでください。")
    if errs:
        return None, errs
    fb = c.load("feedback.json")
    if any(x.get("source_issue") == number for x in fb):
        return None, ["この Issue は取り込み済みです。"]
    rec = {
        "id": c.next_id(fb, "FB-"),
        "target": target,
        "verdict": verdict,
        "comment": c.clean_text(f.get("comment")),
        "created": now(),
        "source_issue": number,
    }
    fb.append(rec)
    c.save("feedback.json", fb)
    return rec["id"], []


def gh(*args):
    if DRY:
        print("DRY gh", " ".join(args))
        return ""
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def process(number, title, body, labels, author):
    if OWNER and author != OWNER:
        print(f"#{number}: skipped (author {author} is not the owner)")
        return None
    kind = "entry" if "entry" in labels or title.startswith("[Entry]") else \
           "feedback" if "feedback" in labels or title.startswith("[Feedback]") else None
    if not kind:
        print(f"#{number}: skipped (no entry/feedback label)")
        return None
    form = parse_form(body)
    snapshot = {n: (p.read_bytes() if (p := c.DATA / n).exists() else b"") for n in ["entries.json", "feedback.json"]}
    rid, errs = (ingest_entry if kind == "entry" else ingest_feedback)(form, number)
    if not errs:
        problems = validate.validate_all()
        if problems:  # roll back: never publish data that fails validation
            for n, b in snapshot.items():
                (c.DATA / n).write_bytes(b)
            errs = ["公開できない内容、または形式の問題が見つかりました: " + "; ".join(problems[:3])]
            rid = None
    if errs:
        msg = "取り込めませんでした。\n\n" + "\n".join(f"- {e}" for e in errs) + \
              "\n\nIssue の本文を直すと、もう一度取り込みます。" + \
              "\nこの Issue は公開されています。公開できない内容を書いてしまった場合は、本文を編集して消すか、Issue を削除してください。"
        gh("issue", "comment", str(number), "--body", msg)
        print(f"#{number}: rejected: {errs}")
        return {"number": number, "ok": False}
    msg = f"記録しました: **{rid}**。ダッシュボードには1〜2分で反映されます。"
    gh("issue", "comment", str(number), "--body", msg)
    gh("issue", "close", str(number), "--reason", "completed")
    print(f"#{number}: recorded as {rid}")
    return {"number": number, "ok": True, "id": rid}


def main():
    results = []
    if "--sweep" in sys.argv:
        raw = gh("issue", "list", "--state", "open", "--limit", "50", "--json", "number,title,body,labels,author")
        for it in json.loads(raw or "[]"):
            labels = [l["name"] for l in it["labels"]]
            r = process(it["number"], it["title"], it["body"], labels, it["author"]["login"])
            if r:
                results.append(r)
    else:
        number = int(os.environ["ISSUE_NUMBER"])
        labels = json.loads(os.environ.get("ISSUE_LABELS") or "[]")
        r = process(number, os.environ.get("ISSUE_TITLE", ""), os.environ.get("ISSUE_BODY", ""), labels,
                    os.environ.get("ISSUE_AUTHOR", ""))
        if r:
            results.append(r)
    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
