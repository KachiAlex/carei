#!/usr/bin/env python3
"""Convert postgres-style {a,b} literals in jsonb columns to JSON arrays.

The Neon-era export wrote text[] arrays as '{a,b}' literals. In the VPS schema
some of those columns are jsonb, so the literals fail to parse. This rewrites
them as '["a","b"]' — only at jsonb column positions, leaving text[] untouched.
"""
import re, sys, json

JSONB_COLS = {
    "clients": {"conditions", "medications", "pbs_framework", "care_cues"},
    "scheduled_visits": {"tasks", "flags"},
    "tenants": {"settings"},
    "audit_logs": {"details"},
}

INS_RE = re.compile(r'^INSERT INTO "(\w+)" \(([^)]*)\) VALUES (.*);\s*$')

def split_vals(s):
    parts, i, start, in_q = [], 0, 0, False
    while i < len(s):
        c = s[i]
        if in_q:
            if c == "'":
                if i + 1 < len(s) and s[i + 1] == "'":
                    i += 1
                else:
                    in_q = False
        elif c == "'":
            in_q = True
        elif c == "," and not in_q:
            parts.append(s[start:i]); start = i + 1
        i += 1
    parts.append(s[start:])
    return [p.strip() for p in parts]

def to_json_arr(lit):
    """'{a,b}' -> '[\"a\",\"b\"]'  ; '{}' -> '[]'"""
    body = lit[2:-2]  # inside the braces
    if body == "":
        return "'[]'"
    items = body.split(",")
    arr = json.dumps(items)          # produces ["a","b"]
    return "'" + arr.replace("'", "''") + "'"

def process_line(line):
    m = INS_RE.match(line.rstrip("\n"))
    if not m:
        return line
    table, cols_s, vals_s = m.groups()
    if table not in JSONB_COLS:
        return line
    cols = [c.strip().strip('"') for c in cols_s.split(",")]
    json_idx = {i for i, c in enumerate(cols) if c in JSONB_COLS[table]}
    if not json_idx:
        return line
    # split row tuples: (...),(...),(...)
    rows = re.findall(r'\((?:[^()]|\([^()]*\))*\)', vals_s)
    if not rows:
        return line
    new_rows = []
    for row in rows:
        vals = split_vals(row[1:-1])
        if len(vals) != len(cols):
            return line
        for i in json_idx:
            v = vals[i]
            if len(v) >= 2 and v[0] == "'" and v[-1] == "'":
                inner = v[1:-1]
                if inner.startswith("{") and inner.endswith("}") and not inner.startswith('{"'):
                    vals[i] = to_json_arr(v)
        new_rows.append("(" + ",".join(vals) + ")")
    return f'INSERT INTO "{table}" ({cols_s}) VALUES ' + ",".join(new_rows) + ";\n"

src = sys.argv[1]
out = []
changed = 0
for line in open(src, encoding="utf-8"):
    new = process_line(line)
    if new != line:
        changed += 1
    out.append(new)
open(src, "w", encoding="utf-8").writelines(out)
print(f"rewrote {changed} INSERT line(s)")
