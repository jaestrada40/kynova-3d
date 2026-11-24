// Traductor Kynova → Chapín (port de src/chapin.c).
//   splice adam/eve → va pisto/quetzal | atlas/ryan → cabal/sino | vita → brega | radio → clavar | diary → shute
import type { AstNode } from "./ast.ts";

const sangria = (n: number) => " ".repeat(n * 4);
const prec = (e: AstNode) => (e.kind === "relop" ? 0 : e.kind !== "binop" ? 3 : e.op === "*" || e.op === "/" ? 2 : 1);

function expr(e: AstNode): string {
  switch (e.kind) {
    case "int": case "real": case "str": case "id": return e.text!;
    case "binop": case "relop": {
      // El AST no guarda paréntesis: se reponen según precedencia y asociatividad izquierda.
      const p = prec(e);
      const pl = prec(e.child[0]!) < p, pr = prec(e.child[1]!) <= p;
      return `${pl ? "(" : ""}${expr(e.child[0]!)}${pl ? ")" : ""} ${e.op} ${pr ? "(" : ""}${expr(e.child[1]!)}${pr ? ")" : ""}`;
    }
    default: return "";
  }
}

function bloque(b: AstNode, nivel: number): string {
  let o = "{\n";
  for (const s of b.items) o += instruccion(s, nivel + 1);
  return o + sangria(nivel) + "}";
}

function instruccion(s: AstNode, nivel: number): string {
  let o = sangria(nivel);
  switch (s.kind) {
    case "decl": o += `va ${s.type === "adam" ? "pisto " : s.type === "eve" ? "quetzal " : ""}${s.text}`; if (s.child[0]) o += ` = ${expr(s.child[0])}`; o += ";\n"; break;
    case "assign": o += `${s.text} = ${expr(s.child[0]!)};\n`; break;
    case "read": o += `clavar(${s.text});\n`; break;
    case "write": o += `shute(${expr(s.child[0]!)});\n`; break;
    case "if": o += `cabal (${expr(s.child[0]!)}) ${bloque(s.child[1]!, nivel)} sino ${bloque(s.child[2]!, nivel)}\n`; break;
    case "while": o += `brega (${expr(s.child[0]!)}) ${bloque(s.child[1]!, nivel)}\n`; break;
    default: break;
  }
  return o;
}

export const chapinInstruccion = (s: AstNode) => instruccion(s, 0);
export const chapinExpr = expr;
export function chapinEmitir(programa: AstNode): string {
  return programa.items.map((s) => instruccion(s, 0)).join("");
}
