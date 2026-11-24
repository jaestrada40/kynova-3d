// Extrae las tablas LALR que genera Bison (build/kynova.tab.c del compilador real) y las escribe como TypeScript.
// Uso: node scripts/gen-tables.mjs ruta/a/kynova.tab.c > src/compiler/tables.ts
import fs from "node:fs";

const src = fs.readFileSync(process.argv[2], "utf8");

const arr = (name) => {
  const m = src.match(new RegExp(`static const \\w+ ${name}\\[\\] =\\s*\\{([^}]*)\\};`));
  if (!m) throw new Error("no se encontró " + name);
  return m[1].split(",").map((s) => s.trim()).filter(Boolean).map(Number);
};
const def = (name) => Number(src.match(new RegExp(`#define ${name}\\s+\\(?(-?\\d+)\\)?`))[1]);

let out = "// GENERADO por scripts/gen-tables.mjs a partir de kynova.tab.c (Bison 3.8.2). No editar a mano.\n";
for (const n of ["yytranslate", "yypact", "yydefact", "yypgoto", "yydefgoto", "yytable", "yycheck", "yyr1", "yyr2"]) {
  out += `export const ${n}: number[] = ${JSON.stringify(arr(n))};\n`;
}
for (const n of ["YYPACT_NINF", "YYLAST", "YYFINAL", "YYNTOKENS", "YYMAXUTOK"]) out += `export const ${n} = ${def(n)};\n`;
process.stdout.write(out);
