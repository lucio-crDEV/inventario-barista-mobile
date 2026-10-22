"""Order a private D1 dump without executing SQL or changing its data.

Rebuilt SQLite tables may appear after their children in D1 exports. All tables
must exist before inserting data; triggers must be installed only afterwards.
sqlite3.complete_statement handles strings/comments and trigger bodies safely.
"""
import os
from pathlib import Path
import re
import sqlite3
import sys


def ordered_dump(source):
    statements, buffer = [], ""
    for char in source:
        buffer += char
        if char == ";" and sqlite3.complete_statement(buffer):
            statements.append(buffer)
            buffer = ""
    stripped = lambda value: re.sub(r"\A\s*(?:(?:--[^\n]*(?:\n|$)|/\*.*?\*/)\s*)*", "", value, flags=re.S).strip()
    if stripped(buffer):
        raise ValueError("SQL incompleto; no se preparó la restauración")
    groups = {"pragma": [], "table": [], "data": [], "metadata": []}
    for statement in statements:
        sql = stripped(statement)
        if re.match(r"PRAGMA\s+defer_foreign_keys\s*=\s*(?:TRUE|ON|1)\s*;\s*$", sql, re.I):
            groups["pragma"].append(statement)
        elif re.match(r"CREATE\s+TABLE\s", sql, re.I):
            groups["table"].append(statement)
        elif re.match(r"(?:INSERT\s+INTO|DELETE\s+FROM)\s", sql, re.I):
            groups["data"].append(statement)
        elif re.match(r"CREATE\s+(?:(?:UNIQUE\s+)?INDEX|VIEW|TRIGGER)\s", sql, re.I):
            groups["metadata"].append(statement)
        else:
            raise ValueError("Sentencia no admitida en el respaldo; no se ejecutó SQL")
    if not groups["table"]:
        raise ValueError("Respaldo sin tablas")
    return "PRAGMA defer_foreign_keys=ON;\n" + "\n".join(statement for group in ["table", "data", "metadata"] for statement in groups[group]) + "\n"


if __name__ == "__main__":
    result = ordered_dump(Path(sys.argv[1]).read_text(encoding="utf-8"))
    fd = os.open(sys.argv[2], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as output:
        output.write(result)
