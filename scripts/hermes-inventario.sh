#!/bin/sh
# Ejecuta Hermes en este proyecto sin alterar su modelo ni configuración global.
set -eu
INVENTARIO_ROOT=$(CDPATH= cd -P "$(dirname "$0")/.." && pwd)
cd "$INVENTARIO_ROOT"
exec hermes --reasoning medium "$@"
