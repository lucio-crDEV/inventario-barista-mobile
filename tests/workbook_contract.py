"""Comprueba los campos de referencia del catálogo contra el Excel final.

Usa solo la biblioteca estándar de Python y Node.js; no modifica el libro.
"""

import json
import os
import posixpath
import re
import subprocess
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
WORKBOOK = ROOT / "inventarios_og/11_10-INVENTARIO-totalizado.xlsx"
NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "p": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def catalog_rows():
    code = (
        'import { excelRows } from "./data/inventario/items/catalogo-excel.js";'
        "process.stdout.write(JSON.stringify(excelRows));"
    )
    result = subprocess.run(
        [os.environ.get("NODE", "node"), "--input-type=module", "-e", code],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def sheet_paths(archive):
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    targets = {
        relation.attrib["Id"]: relation.attrib["Target"]
        for relation in relationships.findall("p:Relationship", NS)
    }
    result = {}
    for sheet in workbook.findall("m:sheets/m:sheet", NS):
        target = targets[sheet.attrib[f"{{{NS['r']}}}id"]]
        result[sheet.attrib["name"]] = (
            target.lstrip("/") if target.startswith("/")
            else posixpath.normpath(posixpath.join("xl", target))
        )
    return result


def shared_strings(archive):
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return ["".join(node.text or "" for node in item.iter(f"{{{NS['m']}}}t"))
            for item in root.findall("m:si", NS)]


def cell_text(cell, strings):
    if cell.attrib.get("t") == "inlineStr":
        return "".join(node.text or "" for node in cell.iter(f"{{{NS['m']}}}t"))
    value = cell.find("m:v", NS)
    if value is None or value.text is None:
        return None
    return strings[int(value.text)] if cell.attrib.get("t") == "s" else value.text


def main():
    catalog = catalog_rows()
    mismatches = []
    checked = 0
    with ZipFile(WORKBOOK) as archive:
        paths = sheet_paths(archive)
        strings = shared_strings(archive)
        for sheet_name, rows in catalog.items():
            expected = {row[0]: row[1:] for row in rows}
            found = set()
            root = ET.fromstring(archive.read(paths[sheet_name]))
            for row in root.findall("m:sheetData/m:row", NS):
                number = int(row.attrib["r"])
                if number not in expected:
                    continue
                values = {}
                for cell in row.findall("m:c", NS):
                    column = re.match(r"[A-Z]+", cell.attrib["r"]).group()
                    if column in {"A", "B", "E", "F"}:
                        values[column] = cell_text(cell, strings)
                actual = [values.get(column) for column in ("A", "B", "E", "F")]
                if actual != expected[number]:
                    mismatches.append((sheet_name, number, expected[number], actual))
                found.add(number)
                checked += 1
            for number in expected.keys() - found:
                mismatches.append((sheet_name, number, expected[number], "fila ausente"))

    if mismatches:
        for mismatch in mismatches[:20]:
            print(mismatch, file=sys.stderr)
        print(f"ERROR: {len(mismatches)} diferencias", file=sys.stderr)
        return 1
    print(f"OK: {checked} filas coinciden en ID, nombre, unidad y categoría")
    verify_vitrina(catalog)
    return 0


def verify_vitrina(catalog):
    result = subprocess.run(
        [os.environ.get("NODE", "node"), "--input-type=module", "-e",
         'import {vitrinaReferences} from "./data/inventario/items/service-layout.js";process.stdout.write(JSON.stringify(vitrinaReferences));'],
        cwd=ROOT, check=True, capture_output=True, text=True,
    )
    references = dict(json.loads(result.stdout))
    def normalize(value):
        return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in unicodedata.normalize("NFD", str(value)) if unicodedata.category(c) != "Mn").lower()).strip()
    with ZipFile(ROOT / "inventarios_og/INVENTARIOS_2026-2027_jefa-turno.xlsx") as archive:
        strings = shared_strings(archive)
        sheet = ET.fromstring(archive.read("xl/worksheets/sheet9.xml"))
        found = {}
        for row in sheet.findall("m:sheetData/m:row", NS):
            values = {re.match(r"[A-Z]+", c.attrib["r"]).group(): cell_text(c, strings) for c in row.findall("m:c", NS)}
            if str(values.get("D", "")).strip().upper() == "VITRINA":
                number = int(row.attrib["r"])
                assert number in references, f"Vitrina sin referencia: {number}"
                output = next(r for r in catalog["servicio"] if r[0] == references[number])
                assert normalize(values["B"]) == normalize(output[2]), f"Producto distinto en Vitrina: {number}"
                assert values["E"].strip().upper() == output[3].strip().upper(), f"Unidad distinta en Vitrina: {number}"
                found[number] = output[0]
        assert found == references and len(found) == 41
    print("OK: 41 referencias de Vitrina coinciden en producto y unidad con el libro de reparto")


if __name__ == "__main__":
    sys.exit(main())
