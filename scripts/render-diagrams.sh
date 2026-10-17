#!/usr/bin/env bash
# Render every diagrams/NN-*.puml to light and dark SVG under public/diagrams/.
# Needs Java 11+. The SVGs are committed, so the Cloudflare build never needs Java.
set -euo pipefail
cd "$(dirname "$0")/.."

VER=1.2025.4
JAR=".cache/plantuml-$VER.jar"
if [ ! -f "$JAR" ]; then
  mkdir -p .cache
  curl -fsSL -o "$JAR" "https://github.com/plantuml/plantuml/releases/download/v$VER/plantuml-$VER.jar"
fi

OUT="$PWD/public/diagrams"
rm -rf "$OUT"
mkdir -p "$OUT/light" "$OUT/dark" "$OUT/src"

java -jar "$JAR" -tsvg -nometadata -failfast2 -o "$OUT/light" diagrams/[0-9]*.puml
java -jar "$JAR" -tsvg -nometadata -DDARK=1 -o "$OUT/dark" diagrams/[0-9]*.puml
cp diagrams/*.puml diagrams/*.iuml "$OUT/src/"

echo "Rendered $(ls "$OUT/light" | wc -l) diagrams (light + dark)."
