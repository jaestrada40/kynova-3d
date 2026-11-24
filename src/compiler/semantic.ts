// Tabla de símbolos y análisis semántico de Kynova (port de src/symtab.c y src/semantic.c).
import { hijos, typeC11, typeName, type AstNode, type DataType } from "./ast.ts";
import type { Diag } from "./lexer.ts";

export interface Simbolo {
  index: number;
  name: string;
  type: DataType;
  scopeId: number;
  scopeLevel: number;
  line: number;
  col: number;
  uses: number;
  active: boolean;
  /** Nodo de la declaración. */
  nodo: number;
}

export type EventoSem =
  | { k: "inst"; nodo: number }
  | { k: "entrar"; scopeId: number; nivel: number; nodo: number }
  | { k: "salir"; scopeId: number; nodo: number }
  | { k: "declarar"; simbolo: number; nodo: number }
  | { k: "buscar"; nombre: string; encontrado: boolean; simbolo?: number; nodo: number }
  | { k: "tipo"; nodo: number; tipo: DataType }
  | { k: "diag"; diag: Diag; nodo: number };

export interface ResultadoSemantico { symbols: Simbolo[]; diags: Diag[]; events: EventoSem[]; errores: number }

class TablaSimbolos {
  syms: Simbolo[] = [];
  scopes: number[] = [];
  nextScope = 0;
  constructor() { this.entrar(); }
  entrar() { this.scopes.push(this.nextScope++); }
  salir() { const sc = this.scopes[this.scopes.length - 1]; for (const s of this.syms) if (s.scopeId === sc) s.active = false; this.scopes.pop(); }
  get actual() { return this.scopes[this.scopes.length - 1]; }
  buscar(name: string) { for (let i = this.syms.length - 1; i >= 0; i--) if (this.syms[i].active && this.syms[i].name === name) return this.syms[i]; return null; }
  buscarActual(name: string) { for (let i = this.syms.length - 1; i >= 0; i--) if (this.syms[i].scopeId === this.actual && this.syms[i].name === name) return this.syms[i]; return null; }
  insertar(name: string, type: DataType, line: number, col: number, nodo: number) {
    const s: Simbolo = { index: this.syms.length, name, type, scopeId: this.actual, scopeLevel: this.scopes.length - 1, line, col, uses: 0, active: true, nodo };
    this.syms.push(s);
    return s;
  }
}

export function analizar(programa: AstNode): ResultadoSemantico {
  const tabla = new TablaSimbolos();
  const diags: Diag[] = [];
  const events: EventoSem[] = [];
  let errores = 0;

  const emitir = (n: { line: number; col: number; id: number }, nivel: "error" | "advertencia", msg: string) => {
    const d: Diag = { fase: "semántico", nivel, line: n.line, col: n.col, msg, notas: [], nodo: n.id };
    diags.push(d);
    events.push({ k: "diag", diag: d, nodo: n.id });
    if (nivel === "error") errores++;
  };
  const err = (n: { line: number; col: number; id: number }, msg: string) => emitir(n, "error", msg);
  const adv = (n: { line: number; col: number; id: number }, msg: string) => emitir(n, "advertencia", msg);

  const resolver = (n: AstNode) => {
    const s = tabla.buscar(n.text!);
    events.push({ k: "buscar", nombre: n.text!, encontrado: !!s, simbolo: s?.index, nodo: n.id });
    if (!s) err(n, `la variable '${n.text}' no ha sido declarada (o está fuera de su alcance)`);
    return s;
  };

  const tipoDe = (e: AstNode): DataType => {
    switch (e.kind) {
      case "int": e.type = "adam"; break;
      case "real": e.type = "eve"; break;
      case "str": e.type = "plasmid"; break;
      case "id": { const s = resolver(e); if (s) { s.uses++; e.type = s.type; } break; }
      case "binop": {
        const l = tipoDe(e.child[0]!), r = tipoDe(e.child[1]!);
        const rhs = e.child[1]!;
        if (e.op === "/" && (rhs.kind === "int" || rhs.kind === "real") && rhs.dval === 0) adv(e, "división entre cero");
        if (l === "plasmid" || r === "plasmid") { err(e, `no se puede operar con una cadena usando '${e.op}'`); e.type = "unknown"; }
        else if (l === "unknown" || r === "unknown") e.type = "unknown";
        else e.type = l === "eve" || r === "eve" ? "eve" : "adam";
        break;
      }
      default: break;
    }
    events.push({ k: "tipo", nodo: e.id, tipo: e.type });
    return e.type;
  };

  const condicion = (c: AstNode) => {
    const l = tipoDe(c.child[0]!), r = tipoDe(c.child[1]!);
    if (l === "plasmid" || r === "plasmid") err(c, `no se puede comparar una cadena con '${c.op}'`);
    events.push({ k: "tipo", nodo: c.id, tipo: c.type });
  };

  const asignable = (at: AstNode, name: string, destino: DataType, valor: DataType) => {
    if (valor === "plasmid" && (destino === "adam" || destino === "eve")) err(at, `tipos incompatibles: no se puede asignar una cadena a '${name}' (${typeName(destino)}); use plasmid`);
    if (destino === "plasmid" && (valor === "adam" || valor === "eve")) err(at, `tipos incompatibles: no se puede asignar un número a '${name}' (plasmid)`);
    if (destino === "adam" && valor === "eve") err(at, `tipos incompatibles: no se puede asignar un valor eve a '${name}' (adam) sin perder la parte decimal`);
  };

  const bloque = (b: AstNode) => {
    tabla.entrar();
    events.push({ k: "entrar", scopeId: tabla.actual, nivel: tabla.scopes.length - 1, nodo: b.id });
    for (const s of b.items) instruccion(s);
    events.push({ k: "salir", scopeId: tabla.actual, nodo: b.id });
    tabla.salir();
  };

  const instruccion = (s: AstNode) => {
    events.push({ k: "inst", nodo: s.id });
    switch (s.kind) {
      case "decl": {
        const valor = s.child[0] ? tipoDe(s.child[0]) : "unknown";
        const prev = tabla.buscarActual(s.text!);
        if (prev) err(s, `la variable '${s.text}' ya fue declarada en este alcance (línea ${prev.line})`);
        else { const sym = tabla.insertar(s.text!, s.type, s.line, s.col, s.id); events.push({ k: "declarar", simbolo: sym.index, nodo: s.id }); }
        if (s.child[0]) asignable(s, s.text!, s.type, valor);
        break;
      }
      case "assign": {
        const sym = resolver(s);
        const valor = tipoDe(s.child[0]!);
        if (sym) asignable(s, s.text!, sym.type, valor);
        break;
      }
      case "read": {
        const sym = resolver(s);
        if (sym) { sym.uses++; if (sym.type === "plasmid") err(s, `no se puede leer con radio() en '${s.text}' (plasmid)`); }
        break;
      }
      case "write": tipoDe(s.child[0]!); break;
      case "if": condicion(s.child[0]!); bloque(s.child[1]!); bloque(s.child[2]!); break;
      case "while": condicion(s.child[0]!); bloque(s.child[1]!); break;
      default: break;
    }
  };

  for (const s of programa.items) instruccion(s);
  if (errores === 0) {
    for (const s of tabla.syms) if (s.uses === 0) adv({ line: s.line, col: s.col, id: s.nodo }, `la variable '${s.name}' se declaró pero nunca se usa`);
  }
  return { symbols: tabla.syms, diags, events, errores };
}

export function tablaTexto(syms: Simbolo[]): string {
  if (!syms.length) return "(sin variables declaradas)\n";
  let out = "#    Nombre           Tipo  C11     Alcance              Línea   Usos\n";
  out += "---  ---------------- ----- ------- -------------------- ------- ----\n";
  syms.forEach((s, i) => {
    const alcance = s.scopeLevel === 0 ? "global" : `bloque #${s.scopeId} (nivel ${s.scopeLevel})`;
    out += `${String(i + 1).padEnd(3)}  ${s.name.padEnd(16)} ${typeName(s.type).padEnd(5)} ${typeC11(s.type).padEnd(7)} ${alcance.padEnd(20)} ${String(s.line).padEnd(7)} ${s.uses}\n`;
  });
  return out;
}

export { hijos };
