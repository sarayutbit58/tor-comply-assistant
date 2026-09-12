#!/usr/bin/env python3
"""TOR PDF/DOCX/TXT → Requirement[] by section headings. No LLM."""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path

HEADING = re.compile(r"^\s*(\d+(?:\.\d+)*)\.?\s+(\S.*)$")
SKIP = re.compile(r"^(หน้า\s*\d|ข้อกำหนดรายละเอียด|เช่าใช้บริการอินเทอร์เน็ต|……|\(+นาย|\(+นาง|นักวิชา|เจ้าพนักงาน)")

def parse_text(text: str) -> list[dict]:
    reqs, current = [], None
    for i, raw in enumerate(text.splitlines()):
        line = raw.rstrip()
        if not line.strip() or SKIP.search(line.strip()):
            continue
        m = HEADING.match(line)
        if m:
            sid, title = m.group(1), m.group(2).strip()
            parts = sid.split(".")
            if len(parts) == 1 and (int(parts[0]) > 20 or not re.match(r"[\u0E00-\u0E7Fa-zA-Z(]", title)):
                if current:
                    current["textSnapshot"] += "\n" + line.strip()
                continue
            if current:
                reqs.append(current)
            current = {"id": sid, "title": title[:120], "textSnapshot": title, "sourceLine": i + 1}
            continue
        if current:
            current["textSnapshot"] += "\n" + line.strip()
    if current:
        reqs.append(current)
    for r in reqs:
        r["textSnapshot"] = re.sub(r"\n{3,}", "\n\n", r["textSnapshot"]).strip()
    return reqs

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("-o", "--out", default="-")
    args = ap.parse_args()
    text = Path(args.path).read_text(encoding="utf-8")
    reqs = parse_text(text)
    payload = {"parser": "heading-regex-v0-no-llm", "count": len(reqs), "requirements": reqs}
    out = json.dumps(payload, ensure_ascii=False, indent=2)
    if args.out == "-":
        print(out)
    else:
        Path(args.out).write_text(out, encoding="utf-8")

if __name__ == "__main__":
    main()
