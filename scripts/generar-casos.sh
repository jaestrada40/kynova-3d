#!/bin/bash
# Genera programas extra y corre el compilador REAL en C sobre las pruebas + extras (guarda stdout/stderr/código/.gt en golden/).
# Uso (Linux/WSL): copiar src/, tests/, Makefile del repo kynova a /tmp/kyn, compilar con make, y correr este script.
cd /tmp/kyn
mkdir -p extra golden
cat > extra/e01_advertencias.kyn <<'K'
// variable sin usar y division entre cero
splice adam a;
splice adam b = 10;
splice eve c = 2.5;
diary(b / 0);
diary(c / 0.0);
K
cat > extra/e02_plasmid.kyn <<'K'
splice plasmid nombre = "Booker";
splice plasmid saludo;
saludo = "Hola, Rapture";
diary(nombre);
diary(saludo);
K
cat > extra/e03_cadena_atlas.kyn <<'K'
splice adam vida = 40;
atlas (vida > 80) {
    diary(1);
} ryan atlas (vida > 20) {
    diary(2);
} ryan atlas (vida > 0) {
    diary(3);
} ryan {
    diary(0);
}
K
cat > extra/e04_varios_errores_sintaxis.kyn <<'K'
splice adam a
a = 5;
splice eve = 2.0;
diary(a;
atlas (a > 1) { diary(a); }
diary(a);
K
cat > extra/e05_parentesis.kyn <<'K'
splice adam a = 1;
splice adam b = 2;
splice adam c = 3;
splice adam d = 4;
splice adam e = 5;
splice adam r;
r = (a + b) * c - (d - e) - a;
r = a - (b - c);
r = a - b - c;
r = a * (b + c) / d;
r = a / (b * c);
r = ((a));
diary(r);
vita (r < 10) { r = r + 1; }
K
printf '' > extra/e06_vacio.kyn
printf '/* solo un comentario */\n// otro\n' > extra/e07_solo_comentarios.kyn
cat > extra/e08_errores_lexicos.kyn <<'K'
splice adam x = 3.;
splice eve y = 2,5;
splice adam 9z;
x = @ + 1;
splice plasmid t = "sin cerrar;
K
cat > extra/e09_alcance.kyn <<'K'
splice adam x = 1;
atlas (x == 1) {
    splice adam y = 2;
    splice adam x = 5;
    diary(x + y);
} ryan {
    splice eve y = 1.5;
    diary(y);
}
diary(y);
vita (x < 3) {
    splice adam z = x;
    x = x + 1;
}
K
cat > extra/e10_tipos.kyn <<'K'
splice adam n = 1;
splice eve r = 2.0;
splice plasmid s = "a";
n = r;
r = n;
s = n;
n = s;
s = r + 1;
atlas (s < 1) { diary(1); } ryan { diary(2); }
radio(s);
radio(zzz);
K
for f in tests/valid/*.kyn tests/invalid/*.kyn extra/*.kyn; do
  b=$(basename "$f" .kyn)
  ./kynova -t -a -s -c golden/$b.gt "$f" > golden/$b.out 2> golden/$b.err
  echo $? > golden/$b.code
done
ls golden | wc -l
