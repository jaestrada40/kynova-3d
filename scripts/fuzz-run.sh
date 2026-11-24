#!/bin/bash
# Corre el compilador REAL en C sobre cada programa de _raw/fuzz y guarda stdout, stderr y el código de salida.
# Uso (en Linux/WSL, con el binario ./kynova ya compilado en $KYN): bash scripts/fuzz-run.sh /ruta/a/_raw/fuzz /ruta/a/kynova
dir="$1"; bin="$2"
cd "$(dirname "$dir")" || exit 1
base="$(basename "$dir")"
for f in "$base"/*.kyn; do
  b="${f%.kyn}"
  timeout 5 "$bin" -t -a -s -c "$b.gt" "$f" > "$b.out" 2> "$b.err"
  echo $? > "$b.code"
done
echo "listo: $(ls "$base"/*.code | wc -l) programas"
