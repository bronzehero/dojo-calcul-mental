#!/bin/bash
# Ejecuta todas las pruebas del Dojo. Uso: tests/run.sh
set -e
cd "$(dirname "$0")"
if [ ! -d node_modules/@playwright/test ]; then
    npm install --silent
fi
# En WSL sin sudo, Chromium necesita estas librerías descargadas a mano
LIBS=~/.local/share/dojo-tools/test/libs/usr/lib/x86_64-linux-gnu
if [ -d "$LIBS" ]; then
    export LD_LIBRARY_PATH="$LIBS:$LD_LIBRARY_PATH"
fi
npx playwright test "$@"
