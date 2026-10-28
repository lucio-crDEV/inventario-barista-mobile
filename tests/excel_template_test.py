"""Regression tests for the golden workbook boundary, using disposable copies."""
from pathlib import Path
import importlib.util
import re
import tempfile
import unittest
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('excel_guard', ROOT/'scripts/verify-excel-template.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)

class ExcelBoundary(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = guard.registry()
        cls.original = ROOT/cls.contract['path']
        with ZipFile(cls.original) as z:
            cls.parts = [(info, z.read(info.filename)) for info in z.infolist()]
            cls.paths = guard.member_paths(z)

    def candidate(self, directory, changes):
        target = Path(directory)/'candidate.xlsx'
        with ZipFile(target, 'w') as z:
            for info, content in self.parts:
                z.writestr(info, changes.get(info.filename, lambda v:v)(content))
        return target

    def stock(self, sheet, ref, content):
        name = self.paths[sheet]
        def change(xml):
            pattern = rb'(<c\b[^>]*\br="'+ref.encode()+rb'"[^>]*>).*?(</c>)'
            updated, n = re.subn(pattern, lambda m:m[1]+content+m[2], xml, count=1, flags=re.S)
            self.assertEqual(n, 1)
            return updated
        return {name:change}

    def test_original_identity_and_destinations(self):
        self.assertEqual(len(guard.check_original(self.original,self.contract)),10)
        self.assertEqual(sum(map(len,self.contract['sheets'].values())),1151)
        with tempfile.TemporaryDirectory() as directory:
            changed = Path(directory)/'changed-original.xlsx'
            changed.write_bytes(self.original.read_bytes()+b' ')
            with self.assertRaisesRegex(ValueError,'TEMPLATE_CHANGED'):
                guard.check_original(changed,self.contract)

    def test_stock_number_zero_blank_and_unchanged_original(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(guard.verify_copy(self.original,self.original,self.contract),0)
            for content in (b'<v>7.125</v>', b'<v>0</v>', b''):
                candidate=self.candidate(directory,self.stock('servicio','C3',content))
                self.assertEqual(guard.verify_copy(self.original,candidate,self.contract),1)

    def test_approved_c74_formula_exception_is_reversible(self):
        with tempfile.TemporaryDirectory() as directory:
            for content in (b'<v>12.25</v>',b''):
                candidate=self.candidate(directory,self.stock('cocina','C74',content))
                self.assertEqual(guard.verify_copy(self.original,candidate,self.contract),1)
                protected={**self.contract,'replaceableStockFormulaCells':{}}
                with self.assertRaisesRegex(ValueError,'PROTECTED_STOCK_FORMULA'):
                    guard.verify_copy(self.original,candidate,protected)

    def test_untouched_parts_and_unapproved_cells_must_be_identical(self):
        with tempfile.TemporaryDirectory() as directory:
            candidate=self.candidate(directory,{'xl/styles.xml':lambda v:v+b' '})
            with self.assertRaisesRegex(ValueError,'UNAUTHORIZED_PART_CHANGED'):
                guard.verify_copy(self.original,candidate,self.contract)
            name=self.paths['servicio']
            candidate=self.candidate(directory,{name:lambda v:v.replace(b'r="B3"',b'r="B9999"',1)})
            with self.assertRaisesRegex(ValueError,'UNAUTHORIZED_SHEET_CHANGE'):
                guard.verify_copy(self.original,candidate,self.contract)

    def test_stock_style_and_formula_injection_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            name=self.paths['servicio']
            # The source may use a different style: force the specific cell's s.
            with ZipFile(self.original) as z:
                fragment=re.search(rb'<c\b[^>]*\br="C3"[^>]*>',z.read(name)).group()
            tampered=re.sub(rb's="[0-9]+"',b's="999"',fragment)
            self.assertNotEqual(fragment,tampered)
            candidate=self.candidate(directory,{name:lambda v:v.replace(fragment,tampered,1)})
            with self.assertRaisesRegex(ValueError,'STOCK_FORMAT_CHANGED'):
                guard.verify_copy(self.original,candidate,self.contract)
            for value in (b'<f>1+1</f><v>2</v>',b'<v>NaN</v>',b'<v>-1</v>',b'<v>1_000</v>',b'formula text'):
                candidate=self.candidate(directory,self.stock('servicio','C3',value))
                with self.assertRaisesRegex(ValueError,'INVALID_STOCK_VALUE'):
                    guard.verify_copy(self.original,candidate,self.contract)

    def test_package_member_order_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            candidate=Path(directory)/'reordered.xlsx'
            with ZipFile(candidate,'w') as z:
                for info,content in reversed(self.parts):
                    z.writestr(info,content)
            with self.assertRaisesRegex(ValueError,'PACKAGE_CHANGED'):
                guard.verify_copy(self.original,candidate,self.contract)

if __name__=='__main__':
    unittest.main()
