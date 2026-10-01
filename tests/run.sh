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
# Antes de nada: el JavaScript de la app tiene que poder cargarse. Si no carga,
# cada prueba se queda esperando hasta su límite y la batería tarda muchísimo.
node -e '
const html = require("fs").readFileSync("../index.html", "utf8");
const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
try { new Function(js); } catch (e) { console.error("ERROR: el JavaScript de index.html no se puede cargar: " + e.message); process.exit(1); }
'
npx playwright test "$@"
