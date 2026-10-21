#!/usr/bin/env python3
"""Generate bootstrap SQL locally; never connects to Cloudflare."""
import getpass
import json
import os
from pathlib import Path
import re
import subprocess
import sys

if len(sys.argv) != 2:
    raise SystemExit('Uso: python3 scripts/first-admin.py /ruta/primer-admin.bootstrap.sql')
path = Path(sys.argv[1]).expanduser()
if path.exists():
    raise SystemExit(f'El archivo {path} ya existe. Usa otra ruta para conservarlo.')
username = input('Usuario personal del primer administrador: ').strip().lower()
name = input('Nombre visible: ').strip()
if not re.fullmatch(r'[a-z0-9._-]{3,40}', username):
    raise SystemExit('Usuario inválido: usa entre 3 y 40 letras minúsculas, números, puntos, guiones o guiones bajos.')
if not name or len(name) > 80:
    raise SystemExit('Nombre visible inválido: usa entre 1 y 80 caracteres.')
password = getpass.getpass('Contraseña temporal (mínimo 12 caracteres, máximo 72 bytes): ')
if len(password) < 12:
    raise SystemExit('No se creó ningún archivo: la contraseña debe tener al menos 12 caracteres. Vuelve a ejecutar el script.')
if len(password.encode('utf-8')) > 72:
    raise SystemExit('No se creó ningún archivo: la contraseña supera 72 bytes UTF-8. Vuelve a ejecutar el script con una contraseña más corta.')
if password != getpass.getpass('Repite la contraseña: '):
    raise SystemExit('No se creó ningún archivo: las contraseñas no coinciden. Vuelve a ejecutar el script.')
root = Path(__file__).resolve().parent.parent
try:
    result = subprocess.run(['node', str(root / 'scripts/bootstrap.mjs')], input=json.dumps(dict(username=username, name=name, password=password)), text=True, capture_output=True, cwd=root)
except FileNotFoundError:
    raise SystemExit('No se encontró Node.js. Instala Node 24 y ejecuta npm ci desde el repositorio.')
if result.returncode:
    raise SystemExit('No se pudo generar el SQL. Comprueba que usas Node 24 (node --version) y ejecuta npm ci. No se creó el administrador ni se modificó D1.')
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as output:
    output.write(result.stdout)
print(f'SQL preparado en {path}. Aplícalo únicamente a la base D1 elegida. No se modificó ningún recurso remoto.')
