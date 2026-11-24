// Fuzzing diferencial: compara la versión TypeScript con el compilador real en C sobre programas deformados al azar.
//   node scripts/fuzz.mjs gen  _raw/fuzz 400     → crea _raw/fuzz/f000.kyn …
//   (correr el binario en C sobre cada archivo: ver scripts/fuzz-run.sh)
//   node scripts/fuzz.mjs cmp  _raw/fuzz          → compara contra las salidas del binario en C
import fs from "node:fs";
import path from "node:path";
import { compilar, salidaCompleta } from "../src/compiler/compile.ts";

const [modo, dir, cuantos] = process.argv.slice(2);
const casos = JSON.parse(fs.readFileSync(new URL("../src/compiler/golden.json", import.meta.url), "utf8"));

let semilla = 12345;
const rnd = () => { semilla = (semilla * 1664525 + 1013904223) >>> 0; return semilla / 2 ** 32; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const INSERTAR = [";", "(", ")", "{", "}", "=", "+", "-", "*", "/", "<", ">", '"', ",", ".", "@", "0", "a", "Z", " ", "\n", "==", "!=", "<=", "/*", "*/", "//", "é", "9x"];
const PALABRAS = ["splice", "adam", "eve", "plasmid", "radio", "diary", "atlas", "ryan", "vita", "x", "42", "3.14", '"hola"'];

function mutar(s) {
  const n = 1 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const k = Math.floor(rnd() * 7);
    const p = Math.floor(rnd() * (s.length + 1));
    if (k === 0 && s.length) s = s.slice(0, p) + s.slice(p + 1);
    else if (k === 1) s = s.slice(0, p) + pick(INSERTAR) + s.slice(p);
    else if (k === 2) { const l = s.split("\n"); l.splice(Math.floor(rnd() * l.length), 1); s = l.join("\n"); }
    else if (k === 3) { const l = s.split("\n"); const j = Math.floor(rnd() * l.length); l.splice(j, 0, l[j] ?? ""); s = l.join("\n"); }
    else if (k === 4) { const l = s.split("\n"); if (l.length > 1) { const j = Math.floor(rnd() * (l.length - 1)); [l[j], l[j + 1]] = [l[j + 1], l[j]]; s = l.join("\n"); } }
    else if (k === 5) { const m = [...s.matchAll(/[A-Za-z_0-9]+/g)]; if (m.length) { const w = pick(m); s = s.slice(0, w.index) + pick(PALABRAS) + s.slice(w.index + w[0].length); } }
    else s = s.slice(0, p);
  }
  return s;
}

if (modo === "gen") {
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < Number(cuantos); i++) {
    fs.writeFileSync(path.join(dir, `f${String(i).padStart(3, "0")}.kyn`), mutar(pick(casos).source));
  }
  console.log(`${cuantos} programas en ${dir}`);
} else if (modo === "cmp") {
  let ok = 0, mal = 0;
  const archivos = fs.readdirSync(dir).filter((f) => f.endsWith(".kyn")).sort();
  for (const f of archivos) {
    const b = f.replace(".kyn", "");
    const lee = (e) => fs.readFileSync(path.join(dir, b + e), "utf8").replace(/\r/g, "");
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    const code = Number(lee(".code").trim());
    const r = compilar(src);
    const { stdout, stderr } = salidaCompleta(r, `fuzz/${f}`);
    const esperadoOut = lee(".out"), esperadoErr = lee(".err");
    const iguales = stdout.replace("<chapin>", `fuzz/${b}.gt`) === esperadoOut && stderr === esperadoErr && r.codigo === code;
    if (iguales) ok++;
    else {
      mal++;
      if (mal <= 5) {
        console.log(`✗ ${f} (código C=${code}, TS=${r.codigo})`);
        console.log("--- C stderr:\n" + esperadoErr.split("\n").slice(0, 8).join("\n"));
        console.log("--- TS stderr:\n" + stderr.split("\n").slice(0, 8).join("\n"));
        if (code === 124 || code >= 128) console.log("(el binario en C no terminó normalmente)");
      }
    }
  }
  console.log(`\nFuzzing: ${ok} iguales, ${mal} distintos, de ${archivos.length}.`);
  process.exit(mal ? 1 : 0);
}
