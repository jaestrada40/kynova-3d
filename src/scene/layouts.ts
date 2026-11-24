// Disposición 3D de cada vista (qué va dónde). Puro cálculo, sin React.
import { hijos, typeName, type AstNode } from "../compiler/ast.ts";
import type { Resultado } from "../compiler/compile.ts";
import type { Simbolo } from "../compiler/semantic.ts";
import type { Vista } from "../compiler/explain.ts";
import { categoria, type Categoria, type Token } from "../compiler/lexer.ts";

export interface Caja { cx: number; cy: number; cz: number; w: number; h: number }

// ───────── Tokens ─────────
export const CW = 0.5; // ancho de un carácter
export const LH = 1.35; // alto de línea
export interface TokBox { t: Token; x: number; z: number; w: number; cat: Categoria }
export function layoutTokens(r: Resultado) {
  const cajas: TokBox[] = r.tokens.filter((t) => t.code !== 0).map((t) => {
    const len = [...t.text].length;
    const w = Math.max(len * CW, 0.45);
    return { t, w, x: (t.col - 1) * CW + w / 2, z: (t.line - 1) * LH, cat: categoria(t.code, t.bad) };
  });
  const lineas = Math.max(1, ...cajas.map((c) => c.t.line));
  const ancho = Math.max(6, ...cajas.map((c) => c.x + c.w / 2));
  return { cajas, lineas, ancho, caja: { cx: ancho / 2, cy: 0, cz: ((lineas - 1) * LH) / 2, w: ancho + 4, h: lineas * LH * 0.8 + 3 } as Caja };
}

// ───────── AST ─────────
export const SP = 2.5;
export const DY = 2.4;
export interface NodoL { n: AstNode; x: number; y: number; profundidad: number }
export interface AristaL { de: NodoL; a: NodoL; etiqueta: string }
export function layoutAst(raiz: AstNode | null) {
  const nodos: NodoL[] = [];
  const aristas: AristaL[] = [];
  if (!raiz) return { nodos, aristas, caja: { cx: 0, cy: 0, cz: 0, w: 8, h: 6 } as Caja };
  let hoja = 0;
  const poner = (n: AstNode, d: number): NodoL => {
    const hs = hijos(n);
    const hl = hs.map((h) => ({ h, l: poner(h.node, d + 1) }));
    const x = hl.length ? (hl[0].l.x + hl[hl.length - 1].l.x) / 2 : hoja++ * SP;
    const l: NodoL = { n, x, y: -d * DY, profundidad: d };
    nodos.push(l);
    for (const { h, l: c } of hl) aristas.push({ de: l, a: c, etiqueta: h.label.replace(": ", "") });
    return l;
  };
  poner(raiz, 0);
  const xs = nodos.map((k) => k.x), ys = nodos.map((k) => k.y);
  const w = Math.max(...xs) - Math.min(...xs) + 4, h = Math.max(...ys.map(Math.abs)) + 3;
  return { nodos, aristas, caja: { cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: -h / 2 + 1, cz: 0, w, h } as Caja };
}

export function etiquetaNodo(n: AstNode): string {
  const tipo = n.type !== "unknown" && ["binop", "int", "real", "str", "id"].includes(n.kind) ? `\n: ${typeName(n.type)}` : "";
  const corto = (s: string) => (s.length > 10 ? s.slice(0, 9) + "…" : s);
  switch (n.kind) {
    case "program": return "Programa";
    case "block": return "Bloque";
    case "decl": return `splice ${typeName(n.type)}\n${corto(n.text!)}`;
    case "assign": return `${corto(n.text!)} =`;
    case "read": return `radio\n(${corto(n.text!)})`;
    case "write": return "diary";
    case "if": return "atlas\nryan";
    case "while": return "vita";
    case "relop": return `${n.op}`;
    case "binop": return `${n.op}${tipo}`;
    default: return `${corto(n.text!)}${tipo}`;
  }
}

// ───────── Gene Bank ─────────
export interface SalaL { scopeId: number; nivel: number; x: number; y: number; w: number; padre: number | null; simbolos: Simbolo[] }
export function layoutGeneBank(r: Resultado) {
  const syms = r.sem?.symbols ?? [];
  const ids = [...new Set([0, ...syms.map((s) => s.scopeId)])].sort((a, b) => a - b);
  const nivelDe = new Map<number, number>([[0, 0]]);
  const padreDe = new Map<number, number | null>([[0, null]]);
  const pila = [0];
  for (const e of r.sem?.events ?? []) {
    if (e.k === "entrar") { nivelDe.set(e.scopeId, e.nivel); padreDe.set(e.scopeId, pila[pila.length - 1]); pila.push(e.scopeId); }
    else if (e.k === "salir") pila.pop();
  }
  // Los alcances sin variables propias no tienen sala: el padre visible es el ancestro más cercano con sala.
  const conSala = new Set(ids);
  const ancestro = (id: number | null): number | null => { while (id !== null && !conSala.has(id)) id = padreDe.get(id) ?? null; return id; };
  let cursor = 0;
  const salas: SalaL[] = ids.map((id) => {
    const ss = syms.filter((s) => s.scopeId === id);
    const w = Math.max(3.2, ss.length * 2.2 + 1);
    const sala: SalaL = { scopeId: id, nivel: nivelDe.get(id) ?? 0, x: cursor + w / 2, y: (nivelDe.get(id) ?? 0) * 3.4, w, padre: id === 0 ? null : ancestro(padreDe.get(id) ?? null), simbolos: ss };
    cursor += w + 1.2;
    return sala;
  });
  const pos = new Map<number, { x: number; y: number; z: number }>();
  for (const s of salas) s.simbolos.forEach((sy, k) => pos.set(sy.index, { x: s.x - s.w / 2 + 1.5 + k * 2.2, y: s.y, z: 0 }));
  const maxY = Math.max(0, ...salas.map((s) => s.y));
  return { salas, pos, caja: { cx: cursor / 2, cy: maxY / 2 + 1.2, cz: 0, w: Math.max(cursor, 8), h: maxY + 6 } as Caja };
}

export function cajaDe(vista: Vista, r: Resultado): Caja {
  switch (vista) {
    case "tokens": return layoutTokens(r).caja;
    case "ast": return layoutAst(r.sintaxis.ast).caja;
    case "genebank": return layoutGeneBank(r).caja;
    case "chapin": { const alto = Math.max(4, r.source.split("\n").length, (r.chapin ?? "").split("\n").length - 1); return { cx: 0, cy: -((alto - 1) * 1.05) / 2, cz: 0, w: 49, h: alto * 1.05 + 4 }; }
    default: return { cx: 0, cy: 0, cz: 0, w: 46, h: 10 };
  }
}
