// Orquesta las fases igual que main.c: Flex → Bison → tabla de símbolos → (Chapín).
import { astPrint, reiniciarIds, type AstNode } from "./ast.ts";
import { chapinEmitir } from "./chapin.ts";
import { lex, type Diag, type Token } from "./lexer.ts";
import { parse, type ResultadoSintactico } from "./parser.ts";
import { analizar, tablaTexto, type ResultadoSemantico } from "./semantic.ts";

export interface Resultado {
  source: string;
  tokens: Token[];
  lexDiags: Diag[];
  sintaxis: ResultadoSintactico;
  sem: ResultadoSemantico | null;
  chapin: string | null;
  valido: boolean;
  /** Código de salida del compilador: 0 válido, 1 con errores. */
  codigo: 0 | 1;
  /** Todos los diagnósticos en el orden en que los imprime el compilador. */
  diags: Diag[];
}

export function compilar(source: string): Resultado {
  reiniciarIds();
  const { tokens, diags: lexDiags } = lex(source);
  const sintaxis = parse(tokens);
  const hayFrontales = lexDiags.length > 0 || sintaxis.diags.length > 0;
  let sem: ResultadoSemantico | null = null;
  if (!hayFrontales && sintaxis.ast) sem = analizar(sintaxis.ast);
  const chapin = sem && sem.errores === 0 && sintaxis.ast ? chapinEmitir(sintaxis.ast) : null;
  const valido = !hayFrontales && !!sem && sem.errores === 0;
  return {
    source, tokens, lexDiags, sintaxis, sem, chapin, valido, codigo: valido ? 0 : 1,
    diags: [...lexDiags, ...sintaxis.diags, ...(sem?.diags ?? [])],
  };
}

// ───────── Salida de texto (idéntica a la de `kynova -t -a -s`) ─────────
export function tokensTexto(tokens: Token[]): string {
  let o = "=== Tokens (Flex) ===\nLín:Col   Token          Lexema\n";
  let n = 0;
  for (const t of tokens) {
    if (t.code === 0) continue;
    o += `${`${t.line}:${t.col}`.padEnd(9)} ${t.name.padEnd(14)} ${t.text}\n`;
    n++;
  }
  return o + `Total: ${n} tokens\n\n`;
}

export const diagLinea = (archivo: string, d: Diag) =>
  `${archivo}:${d.line}:${d.col}: ${d.nivel === "advertencia" ? "advertencia" : `error ${d.fase}`}: ${d.msg}\n` + d.notas.map((n) => `  nota: ${n}\n`).join("");

/** Reproduce stdout y stderr del compilador en C para `-t -a -s -c`. */
export function salidaCompleta(r: Resultado, archivo: string): { stdout: string; stderr: string } {
  let stdout = tokensTexto(r.tokens);
  let stderr = "";
  for (const d of r.lexDiags) stderr += diagLinea(archivo, d);
  for (const d of r.sintaxis.diags) stderr += diagLinea(archivo, d);
  if (r.lexDiags.length || r.sintaxis.diags.length) {
    stderr += `\nResultado: programa INVÁLIDO (${r.lexDiags.length} error(es) léxico(s), ${r.sintaxis.diags.length} sintáctico(s))\n`;
    return { stdout, stderr };
  }
  const sem = r.sem!;
  for (const d of sem.diags) stderr += diagLinea(archivo, d);
  stdout += `=== AST (Bison, anotado con tipos) ===\n${astPrint(r.sintaxis.ast as AstNode)}\n`;
  stdout += `=== Tabla de símbolos (Gene Bank) ===\n${tablaTexto(sem.symbols)}\n`;
  if (!sem.errores) stdout += "Chapín generado en <chapin>\n";
  if (sem.errores) stderr += `Resultado: programa INVÁLIDO (${sem.errores} error(es) semántico(s))\n`;
  else stdout += "Resultado: programa VÁLIDO\n";
  return { stdout, stderr };
}
