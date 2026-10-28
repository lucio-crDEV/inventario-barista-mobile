"""Read-only guard for the approved template and the scope of an XLSX copy.

This verifies preservation, not stock correctness or Excel recalculation.
"""
import argparse
from decimal import Decimal, InvalidOperation
import hashlib
import json
import os
from pathlib import Path
import posixpath
import re
import subprocess
import xml.etree.ElementTree as ET
from zipfile import ZipFile, BadZipFile

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
CELL = re.compile(rb'<c\b[^>]*>')
REF = re.compile(rb'\br=["\x27]([A-Z]+[1-9][0-9]*)["\x27]')
VALUE = '{'+NS['s']+'}v'
FORMULA = '{'+NS['s']+'}f'

def registry():
    code = "import {excelTemplate} from './data/inventario/export-template.js';process.stdout.write(JSON.stringify(excelTemplate));"
    return json.loads(subprocess.check_output(
        [os.environ.get('NODE', 'node'), '--input-type=module', '-e', code],
        cwd=ROOT, text=True))

def fail(code):
    raise ValueError(code)

def member_paths(z):
    book = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    targets = {r.attrib['Id']: r.attrib['Target'] for r in rels}
    return {s.attrib['name']: (targets[s.attrib['{'+NS['r']+'}id']].lstrip('/')
            if targets[s.attrib['{'+NS['r']+'}id']].startswith('/')
            else posixpath.normpath('xl/'+targets[s.attrib['{'+NS['r']+'}id']]))
            for s in book.findall('s:sheets/s:sheet', NS)}

def cells(xml):
    root = ET.fromstring(xml)
    result = {}
    for cell in root.findall('s:sheetData/s:row/s:c', NS):
        ref = cell.attrib['r']
        if ref in result:
            fail('DUPLICATE_CELL')
        result[ref] = cell
    return result

def check_original(original, contract):
    if original.stat().st_size > 16 * 1024 * 1024:
        fail('TEMPLATE_SIZE')
    if hashlib.sha256(original.read_bytes()).hexdigest() != contract['sha256']:
        fail('TEMPLATE_CHANGED')
    with ZipFile(original) as z:
        paths = member_paths(z)
        for sheet, allowed in contract['sheets'].items():
            data = cells(z.read(paths[sheet]))
            for ref in allowed:
                if ref not in data:
                    fail('INVALID_STOCK_DESTINATION')
                expected_formula = ref in contract.get('stockFormulaCells', {}).get(sheet, [])
                if (data[ref].find(FORMULA) is not None) != expected_formula:
                    fail('STOCK_FORMULA_CHANGED')
    return paths

def mask_stock(xml, allowed):
    # Scan cell opening tags once. Avoid a whole-sheet wildcard regex, whose
    # backtracking can become quadratic on long runs of empty styled cells.
    pieces, seen, cursor = [], set(), 0
    for opening in CELL.finditer(xml):
        ref_match = REF.search(opening.group())
        ref = ref_match.group(1).decode() if ref_match else ''
        if ref not in allowed:
            continue
        if ref in seen:
            fail('DUPLICATE_CELL')
        seen.add(ref)
        end = opening.end()
        if not opening.group().endswith(b'/>'):
            end = xml.find(b'</c>', end)
            if end < 0:
                fail('INVALID_CELL_XML')
            end += len(b'</c>')
        pieces.extend((xml[cursor:opening.start()],
                       b'<authorized-stock ref="'+ref.encode()+b'"/>'))
        cursor = end
    if seen != allowed:
        fail('MISSING_STOCK_CELL')
    pieces.append(xml[cursor:])
    return b''.join(pieces)

def verify_copy(original, candidate, contract, recalculate=False):
    paths = check_original(original, contract)
    if candidate.stat().st_size > 16 * 1024 * 1024:
        fail('COPY_SIZE')
    with ZipFile(original) as a, ZipFile(candidate) as b:
        if a.namelist() != b.namelist() or len(set(b.namelist())) != len(b.namelist()):
            fail('PACKAGE_CHANGED')
        if sum(i.file_size for i in b.infolist()) > sum(i.file_size for i in a.infolist()) + 1024*1024:
            fail('COPY_SIZE')
        allowed_paths = {paths[sheet]: set(refs) for sheet, refs in contract['sheets'].items()}
        changed = 0
        for name in a.namelist():
            before, after = a.read(name), b.read(name)
            if recalculate and name == 'xl/workbook.xml':
                tags = list(re.finditer(rb'<calcPr\b[^>]*/>', before))
                if len(tags) != 1 or re.search(rb'\b(?:fullCalcOnLoad|forceFullCalc)=', tags[0].group()):
                    fail('INVALID_TEMPLATE_CALCULATION')
                tag = tags[0]
                expected = before[:tag.start()] + tag.group()[:-2] + b' fullCalcOnLoad="1" forceFullCalc="1"/>' + before[tag.end():]
                if after != expected:
                    fail('UNAUTHORIZED_CALCULATION_CHANGE')
                continue
            if name not in allowed_paths:
                if before != after:
                    fail('UNAUTHORIZED_PART_CHANGED')
                continue
            allowed = allowed_paths[name]
            if mask_stock(before, allowed) != mask_stock(after, allowed):
                fail('UNAUTHORIZED_SHEET_CHANGE')
            source, output = cells(before), cells(after)
            for ref in allowed:
                old, new = source[ref], output[ref]
                if {k:v for k,v in old.attrib.items() if k!='t'} != {k:v for k,v in new.attrib.items() if k!='t'}:
                    fail('STOCK_FORMAT_CHANGED')
                if ET.tostring(old) == ET.tostring(new):
                    continue
                if old.find(FORMULA) is not None:
                    sheet = next(sheet for sheet, path in paths.items() if path == name)
                    if ref not in contract.get('replaceableStockFormulaCells', {}).get(sheet, []):
                        fail('PROTECTED_STOCK_FORMULA')
                if new.attrib.get('t') not in (None, 'n') or any(c.tag != VALUE for c in new) or len(new)>1:
                    fail('INVALID_STOCK_VALUE')
                if (new.text or '').strip() or any((c.tail or '').strip() for c in new):
                    fail('INVALID_STOCK_VALUE')
                value = new.find(VALUE)
                if value is not None and (len(value) or value.attrib):
                    fail('INVALID_STOCK_VALUE')
                if value is not None and value.text is not None:
                    if len(value.text) > 128 or not re.fullmatch(
                            r'\s*[+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?\s*',
                            value.text):
                        fail('INVALID_STOCK_VALUE')
                    try:
                        number = Decimal(value.text)
                    except InvalidOperation:
                        fail('INVALID_STOCK_VALUE')
                    if not number.is_finite() or number < 0:
                        fail('INVALID_STOCK_VALUE')
                if ET.tostring(old) != ET.tostring(new):
                    changed += 1
        return changed

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--original', type=Path)
    parser.add_argument('--candidate', type=Path)
    parser.add_argument('--recalculate-on-open', action='store_true')
    args = parser.parse_args()
    contract = registry()
    original = args.original or ROOT/contract['path']
    paths = check_original(original, contract)
    changed = verify_copy(original, args.candidate, contract, args.recalculate_on_open) if args.candidate else None
    print(json.dumps({'template':contract['id'],'sha256':contract['sha256'],
        'sheets':len(paths),'authorizedStockCells':sum(map(len,contract['sheets'].values())),
        'changedStockCells':changed,'recalculateOnOpen':args.recalculate_on_open,'readOnly':True}))
if __name__ == '__main__':
    try:
        main()
    except (ValueError, BadZipFile, ET.ParseError, KeyError) as error:
        raise SystemExit(str(error))
