// Prueba diferencial: la versión en TypeScript debe producir EXACTAMENTE lo mismo que el compilador real en C
// (tokens, AST, tabla de símbolos, errores léxicos/sintácticos/semánticos, advertencias y traducción a Chapín).
// golden.json se genera con scripts/make-golden.mjs a partir de la salida de `kynova -t -a -s -c` (ver README).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compilar, salidaCompleta } from "./compile.ts";

interface Caso { nombre: string; grupo: string; archivo: string; source: string; stdout: string; stderr: string; codigo: number; chapin: string | null }
const casos: Caso[] = JSON.parse(readFileSync(new URL("./golden.json", import.meta.url), "utf8"));

let ok = 0;
const fallos: string[] = [];
for (const c of casos) {
  try {
    const r = compilar(c.source);
    const { stdout, stderr } = salidaCompleta(r, c.archivo);
    assert.equal(stdout.replace("<chapin>", `golden/${c.nombre}.gt`), c.stdout, "stdout");
    assert.equal(stderr, c.stderr, "stderr");
    assert.equal(r.codigo, c.codigo, "código de salida");
    assert.equal(r.chapin, c.chapin, "traducción a Chapín");
    ok++;
  } catch (e) {
    fallos.push(`✗ ${c.nombre}: ${(e as Error).message.split("\n").slice(0, 14).join("\n")}`);
  }
}
if (fallos.length) {
  console.error(fallos.join("\n\n"));
  console.error(`\n${ok} de ${casos.length} coinciden con el compilador en C.`);
  process.exit(1);
}
console.log(`OK: ${ok} de ${casos.length} programas producen exactamente la misma salida que el compilador en C.`);
