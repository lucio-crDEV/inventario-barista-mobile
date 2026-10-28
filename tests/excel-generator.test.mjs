import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { excelTemplate } from '../data/inventario/export-template.js';
import { generateExcel } from '../worker/excel-generator.js';
import { readZip, inflateEntry, crc32 } from '../worker/excel-zip.js';

const templateBytes = new Uint8Array(await readFile(new URL('../' + excelTemplate.path, import.meta.url)));
const destinations = Object.entries(excelTemplate.sheets).flatMap(([sheet, refs]) => refs.map(cell => ({ sheet, cell })));
const fullPlan = value => destinations.map(destination => ({ ...destination, value }));
const mixedPlan = destinations.map((destination, index) => ({ ...destination, value: [null, '0', '12.345'][index % 3] }));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const root = new URL('../', import.meta.url);
const python = (code, args = []) => {
  const result = spawnSync('python3', ['-c', code, ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
};

test('complete plan generates a preservation-verified copy, with zero, blanks and three decimals', async () => {
  const originalHash = hash(templateBytes);
  const result = await generateExcel({ templateBytes, cells: mixedPlan });
  assert.ok(result.bytes instanceof Uint8Array);
  assert.equal(result.sha256, hash(result.bytes));
  assert.equal(result.templateSha256, excelTemplate.sha256);
  assert.equal(hash(templateBytes), originalHash);
  assert.equal(result.recalculateOnOpen, false);
  const dir = await mkdtemp(join(tmpdir(), 'excel-generator-'));
  try {
    const candidate = join(dir, 'copy.xlsx'), plan = join(dir, 'plan.json');
    await writeFile(candidate, result.bytes);
    await writeFile(plan, JSON.stringify(mixedPlan));
    const verification = spawnSync('python3', ['scripts/verify-excel-template.py', '--candidate', candidate], { cwd: root, encoding: 'utf8' });
    assert.equal(verification.status, 0, verification.stderr);
    assert.equal(JSON.parse(verification.stdout).changedStockCells, result.changedStockCells);
    python(`import json,sys,zipfile,xml.etree.ElementTree as E
from pathlib import Path
sys.path.insert(0, str(Path('scripts').resolve()))
import importlib.util
spec=importlib.util.spec_from_file_location('guard','scripts/verify-excel-template.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
ns='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
plan=json.load(open(sys.argv[2])); original='${excelTemplate.path}'
with zipfile.ZipFile(original) as a,zipfile.ZipFile(sys.argv[1]) as b:
 assert b.testzip() is None
 paths=g.member_paths(a); expected={paths[p['sheet']] for p in plan}
 assert a.namelist()==b.namelist()
 for old,new in zip(a.infolist(),b.infolist()):
  assert old.filename==new.filename
  for attr in ('date_time','compress_type','flag_bits','extra','comment','internal_attr','external_attr','create_system','create_version','extract_version'):
   assert getattr(old,attr)==getattr(new,attr),(old.filename,attr)
  if old.filename not in expected: assert a.read(old)==b.read(new),old.filename
 before_cells={s:g.cells(a.read(path)) for s,path in paths.items() if s in {p['sheet'] for p in plan}}
 after_cells={s:g.cells(b.read(path)) for s,path in paths.items() if s in before_cells}
 for p in plan:
  before=before_cells[p['sheet']][p['cell']];after=after_cells[p['sheet']][p['cell']]
  assert before.attrib==after.attrib,p
  assert after.find(ns+'f') is None,p
  value=after.find(ns+'v')
  assert (None if value is None else value.text)==p['value'],p
 old=g.cells(a.read(paths['cocina']))['C74'];new=g.cells(b.read(paths['cocina']))['C74']
 assert old.find(ns+'f').text=='15.228+2.986' and old.attrib['s']==new.attrib['s']=='24'
 assert a.read('xl/calcChain.xml')==b.read('xl/calcChain.xml')
`, [candidate, plan]);
    // The immutable source retains the one approved formula, making reversal possible.
    assert.equal(hash(await readFile(new URL('../' + excelTemplate.path, import.meta.url))), originalHash);
    const oldZip = readZip(templateBytes), newZip = readZip(result.bytes);
    const changedParts = new Set(['sheet3.xml', 'sheet4.xml', 'sheet5.xml', 'sheet7.xml', 'sheet8.xml'].map(name => 'xl/worksheets/' + name));
    for (let i = 0; i < oldZip.entries.length; i++) {
      if (!changedParts.has(oldZip.entries[i].name)) {
        assert.deepEqual(newZip.entries[i].local, oldZip.entries[i].local);
        assert.deepEqual(newZip.entries[i].compressed, oldZip.entries[i].compressed);
      }
    }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('every destination is replaced when the complete plan is blank', async () => {
  const result = await generateExcel({ templateBytes, cells: fullPlan(null) });
  const sheets = new Map([['principal', 3], ['cocina', 4], ['servicio', 5], ['panaderia', 7], ['pasteleria', 8]]);
  const zip = readZip(result.bytes);
  for (const [sheet, number] of sheets) {
    const xml = new TextDecoder().decode(await inflateEntry(zip.entries.find(entry => entry.name === `xl/worksheets/sheet${number}.xml`)));
    for (const ref of excelTemplate.sheets[sheet]) {
      const tag = new RegExp(`<c\\b[^>]*r="${ref}"[^>]*>`).exec(xml)[0];
      assert.ok(tag.endsWith('/>'), `${sheet}!${ref}`);
    }
  }
});

test('recalculation changes only the two permitted workbook flags', async () => {
  const result = await generateExcel({ templateBytes, cells: fullPlan('0'), recalculate: true });
  assert.equal(result.recalculateOnOpen, true);
  const before = readZip(templateBytes), after = readZip(result.bytes);
  for (let index = 0; index < before.entries.length; index++) {
    const old = before.entries[index], next = after.entries[index];
    if (old.name === 'xl/workbook.xml') {
      const original = new TextDecoder().decode(await inflateEntry(old));
      const candidate = new TextDecoder().decode(await inflateEntry(next));
      assert.equal(candidate, original.replace('<calcPr calcId="191029"/>', '<calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/>'));
    } else if (!/^xl\/worksheets\/sheet(?:3|4|5|7|8)\.xml$/.test(old.name)) {
      assert.deepEqual(next.compressed, old.compressed);
    }
  }
});

test('hash validation rejects changed input before ZIP parsing', async () => {
  const modified = templateBytes.slice(); modified[0] ^= 1;
  await assert.rejects(generateExcel({ templateBytes: modified, cells: mixedPlan }), /TEMPLATE_CHANGED/);
  await assert.rejects(generateExcel({ templateBytes: new Uint8Array([1]), cells: [] }), /TEMPLATE_CHANGED/);
  await assert.rejects(generateExcel({ templateBytes: 'not-bytes', cells: [] }), /INVALID_TEMPLATE_BYTES/);
});

test('incomplete, repeated, extra and invalid destinations cannot leave old stock', async () => {
  await assert.rejects(generateExcel({ templateBytes, cells: mixedPlan.slice(1) }), /INVALID_STOCK_PLAN/);
  await assert.rejects(generateExcel({ templateBytes, cells: [...mixedPlan, mixedPlan[0]] }), /INVALID_STOCK_PLAN/);
  for (const change of [{ sheet: 'TOTAL' }, { cell: 'D74' }, { cell: 'C99999' }, { sheet: '__proto__' }, { sheet: { toString: () => 'cocina' } }, { cell: 74 }]) {
    const cells = mixedPlan.map(item => ({ ...item })); Object.assign(cells[0], change);
    await assert.rejects(generateExcel({ templateBytes, cells }), /INVALID_STOCK_DESTINATION/);
  }
  const duplicate = mixedPlan.slice(); duplicate[1] = duplicate[0];
  await assert.rejects(generateExcel({ templateBytes, cells: duplicate }), /DUPLICATE_STOCK_DESTINATION/);
});

test('stock accepts finite nonnegative decimal strings with at most three decimal places', async () => {
  for (const value of [undefined, 0, NaN, Infinity, -Infinity, '-1', '1e3', 'NaN', 'Infinity', '', ' 1', '+1', '.1', '1.', '1.0000', '9'.repeat(129), {}, true]) {
    const cells = mixedPlan.slice(); cells[0] = { ...cells[0], value };
    await assert.rejects(generateExcel({ templateBytes, cells }), /INVALID_STOCK_VALUE/, String(value));
  }
  await assert.rejects(generateExcel({ templateBytes, cells: mixedPlan, recalculate: 1 }), /INVALID_RECALCULATE_OPTION/);
});

test('ZIP reader validates structure, method, flags, ZIP64 and CRC without trusting headers', async () => {
  const zip = readZip(templateBytes), first = zip.entries[0];
  assert.equal(crc32(await inflateEntry(first)), first.crc);
  await assert.rejects(inflateEntry({ ...first, crc: first.crc ^ 1 }), /INVALID_TEMPLATE_ZIP/);
  await assert.rejects(inflateEntry({ ...first, size: first.size + 1 }), /INVALID_TEMPLATE_ZIP/);
  const centralAt = new DataView(templateBytes.buffer).getUint32(templateBytes.length - 6, true);
  for (const [offset, value, width] of [[centralAt + 8, 7, 2], [centralAt + 10, 0, 2], [centralAt + 24, 0xffffffff, 4], [centralAt + 42, 1, 4], [0, 0, 4]]) {
    const changed = templateBytes.slice(), data = new DataView(changed.buffer);
    width === 2 ? data.setUint16(offset, value, true) : data.setUint32(offset, value, true);
    assert.throws(() => readZip(changed), /INVALID_TEMPLATE_ZIP/);
  }
});
