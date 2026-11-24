// Junta las salidas del compilador REAL en C (generadas en WSL con `kynova -t -a -s -c`) en un solo JSON.
// Uso: node scripts/make-golden.mjs _raw > src/compiler/golden.json
import fs from "node:fs";
import path from "node:path";

const raw = process.argv[2];
const leer = (p) => fs.readFileSync(p, "utf8").replace(/\r/g, "");
const casos = [];
const dirs = [
  ["tests/valid", "válido"],
  ["tests/invalid", "inválido"],
  ["extra", "extra"],
];
for (const [dir, grupo] of dirs) {
  for (const f of fs.readdirSync(path.join(raw, dir)).sort()) {
    if (!f.endsWith(".kyn")) continue;
    const nombre = f.replace(/\.kyn$/, "");
    const g = path.join(raw, "golden", nombre);
    casos.push({
      nombre,
      grupo,
      archivo: `${dir}/${f}`,
      source: leer(path.join(raw, dir, f)),
      stdout: leer(g + ".out"),
      stderr: leer(g + ".err"),
      codigo: Number(leer(g + ".code").trim()),
      chapin: fs.existsSync(g + ".gt") ? leer(g + ".gt") : null,
    });
  }
}
process.stdout.write(JSON.stringify(casos, null, 1));
