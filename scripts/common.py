"""Shared helpers for the Field Evidence Log data files (stdlib only)."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

AREAS = ["field", "data", "research", "tools", "team", "reflection"]
EVIDENCE = ["observed", "recorded", "public-source", "my-view", "to-confirm"]
STATUSES = ["draft", "needs-check", "confirmed", "planned"]
USES = ["admin-meeting", "final-presentation", "gakuchika", "interview"]
FACT_TAGS = ["✅", "⚠️", "💭", "⏸"]
VERDICTS = ["ok", "revise", "hold"]
DATE_RE = re.compile(r"^\d{4}-\d{2}(-\d{2})?$")
ID_ENTRY_RE = re.compile(r"^E-\d{4}$")

TEXT_FIELDS = ["situation", "action", "result", "learning", "note"]
MAX_TEXT = 2000
MAX_TITLE = 120


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def save(name, obj):
    text = json.dumps(obj, ensure_ascii=False, indent=2) + "\n"
    (DATA / name).write_text(text, encoding="utf-8", newline="\n")


def next_id(items, prefix, width=4):
    nums = []
    for it in items:
        m = re.match(rf"^{re.escape(prefix)}(\d+)$", str(it.get("id", "")))
        if m:
            nums.append(int(m.group(1)))
    return f"{prefix}{(max(nums) if nums else 0) + 1:0{width}d}"


def clean_text(s, limit=MAX_TEXT):
    s = "" if s is None else str(s)
    s = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", s).replace("\r\n", "\n").strip()
    if s == "_No response_":
        s = ""
    return s[:limit]


def is_http_url(u):
    return bool(re.match(r"^https?://[^\s]+$", str(u)))


def load_denylist():
    p = ROOT / "scripts" / "denylist.local.txt"
    if not p.exists():
        return []
    return [l.strip() for l in p.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]


GENERIC_PATTERNS = [
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "メールアドレス"),
    (re.compile(r"(?<!\d)(?:\+?\d{1,3}[ -]?)?\(?\d{2,4}\)?[ -]\d{2,4}[ -]\d{3,4}(?!\d)"), "電話番号らしい並び"),
]


def privacy_hits(text):
    """Return a list of reasons a text should not be published. Local denylist is optional."""
    hits = []
    for term in load_denylist():
        if term.lower() in text.lower():
            hits.append("非公開の語を含む（scripts/denylist.local.txt）")
            break
    for rx, label in GENERIC_PATTERNS:
        if rx.search(text):
            hits.append(label)
    return hits
