#!/usr/bin/env bash
# Empaqueta el tema en un .zip listo para subir a Shopify (Tienda online → Temas → Subir archivo zip)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
rm -f dist/maison-archive-theme.zip
(cd theme && zip -rq ../dist/maison-archive-theme.zip . -x '.*')
echo "Creado dist/maison-archive-theme.zip"
