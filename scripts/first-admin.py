#!/usr/bin/env python3
"""Generate bootstrap SQL locally; never connects to Cloudflare."""
import getpass
import json
import os
from pathlib import Path
import subprocess
import sys

if len(sys.argv) != 2:
    raise SystemExit('Uso: python3 scripts/first-admin.py /ruta/primer-admin.bootstrap.sql')
username = input('Usuario personal del primer administrador: ').strip().lower()
name = input('Nombre visible: ').strip()
password = getpass.getpass('Contraseña temporal (12 caracteres, máximo 72 bytes): ')
if password != getpass.getpass('Repite la contraseña: '):
    raise SystemExit('Las contraseñas no coinciden.')
result = subprocess.run(['node', 'scripts/bootstrap.mjs'], input=json.dumps(dict(username=username, name=name, password=password)), text=True, capture_output=True, check=True)
path = Path(sys.argv[1])
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as output:
    output.write(result.stdout)
print(f'SQL preparado en {path}. Revisa la base seleccionada antes de aplicarlo. No se modificó ningún recurso remoto.')
