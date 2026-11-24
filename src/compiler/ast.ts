// AST de Kynova (port de src/ast.h y src/ast.c del compilador en C).

export type DataType = "unknown" | "adam" | "eve" | "plasmid";
export type NodeKind = "program" | "block" | "decl" | "assign" | "read" | "write" | "if" | "while" | "binop" | "relop" | "int" | "real" | "str" | "id";
export type OpKind = "+" | "-" | "*" | "/" | "<" | ">" | "<=" | ">=" | "==" | "!=";

export interface AstNode {
  /** Orden de creación (el parser crea los nodos al reducir, de abajo hacia arriba). */
  id: number;
  kind: NodeKind;
  line: number;
  col: number;
  /** DECL: tipo declarado. Expresiones: tipo inferido por el análisis semántico. */
  type: DataType;
  op?: OpKind;
  /** Nombre de la variable o lexema del literal. */
  text?: string;
  dval: number;
  /** IF: cond, entonces, ryan | WHILE: cond, cuerpo | BINOP/RELOP: izq, der | DECL: valor inicial | ASSIGN/WRITE: expresión */
  child: (AstNode | null)[];
  /** PROGRAM y BLOCK: lista de instrucciones. */
  items: AstNode[];
}

let contador = 0;
export const reiniciarIds = () => { contador = 0; };
export const nodosCreados = () => contador;

const nuevo = (kind: NodeKind, line: number, col: number): AstNode => ({ id: contador++, kind, line, col, type: "unknown", dval: 0, child: [null, null, null], items: [] });

export const astBlock = (line: number, col: number) => nuevo("block", line, col);
export const astBlockAppend = (b: AstNode, s: AstNode) => { b.items.push(s); };
export const astProgram = (b: AstNode) => { b.kind = "program"; return b; };
export function astDecl(type: DataType, name: string, init: AstNode | null, line: number, col: number) {
  const n = nuevo("decl", line, col); n.type = type; n.text = name; n.child[0] = init; return n;
}
export function astAssign(name: string, expr: AstNode, line: number, col: number) {
  const n = nuevo("assign", line, col); n.text = name; n.child[0] = expr; return n;
}
export function astRead(name: string, line: number, col: number) { const n = nuevo("read", line, col); n.text = name; return n; }
export function astWrite(expr: AstNode, line: number, col: number) { const n = nuevo("write", line, col); n.child[0] = expr; return n; }
export function astIf(cond: AstNode | null, t: AstNode, e: AstNode, line: number, col: number) {
  const n = nuevo("if", line, col); n.child = [cond, t, e]; return n;
}
export function astWhile(cond: AstNode | null, body: AstNode, line: number, col: number) {
  const n = nuevo("while", line, col); n.child[0] = cond; n.child[1] = body; return n;
}
export function astBinop(op: OpKind, l: AstNode, r: AstNode, line: number, col: number) {
  const n = nuevo("binop", line, col); n.op = op; n.child[0] = l; n.child[1] = r; return n;
}
export function astRelop(op: OpKind, l: AstNode, r: AstNode, line: number, col: number) {
  const n = astBinop(op, l, r, line, col); n.kind = "relop"; return n;
}
export function astInt(lexeme: string, line: number, col: number) {
  const n = nuevo("int", line, col); n.text = lexeme; n.dval = Number(BigInt.asIntN(64, BigInt(lexeme))); return n;
}
export function astReal(lexeme: string, line: number, col: number) {
  const n = nuevo("real", line, col); n.text = lexeme; n.dval = parseFloat(lexeme); return n;
}
export function astStr(lexeme: string, line: number, col: number) { const n = nuevo("str", line, col); n.text = lexeme; return n; }
export function astId(name: string, line: number, col: number) { const n = nuevo("id", line, col); n.text = name; return n; }

export const typeName = (t: DataType) => (t === "unknown" ? "?" : t);
export const typeC11 = (t: DataType) => (t === "adam" ? "int" : t === "eve" ? "double" : t === "plasmid" ? "const char *" : "?");

/** Hijos con su etiqueta, en el orden en que los imprime el compilador en C. */
export function hijos(n: AstNode): { node: AstNode; label: string }[] {
  switch (n.kind) {
    case "program": case "block": return n.items.map((node) => ({ node, label: "" }));
    case "if": return [["cond: ", n.child[0]], ["atlas: ", n.child[1]], ["ryan: ", n.child[2]]].filter((x) => x[1]).map((x) => ({ node: x[1] as AstNode, label: x[0] as string }));
    case "while": return [["cond: ", n.child[0]], ["cuerpo: ", n.child[1]]].filter((x) => x[1]).map((x) => ({ node: x[1] as AstNode, label: x[0] as string }));
    case "decl": return n.child[0] ? [{ node: n.child[0], label: "valor inicial: " }] : [];
    case "assign": case "write": return n.child[0] ? [{ node: n.child[0], label: "" }] : [];
    case "binop": case "relop": return [n.child[0], n.child[1]].filter(Boolean).map((node) => ({ node: node as AstNode, label: "" }));
    default: return [];
  }
}

const tipoSufijo = (n: AstNode) => (n.type !== "unknown" ? ` : ${typeName(n.type)}` : "");
const plural = (k: number) => (k === 1 ? "instrucción" : "instrucciones");

/** Descripción de un nodo (idéntica a print_description de ast.c). */
export function descripcion(n: AstNode): string {
  switch (n.kind) {
    case "program": return `Programa (${n.items.length} ${plural(n.items.length)})`;
    case "block": return `Bloque (${n.items.length} ${plural(n.items.length)})`;
    case "decl": return `Declaración splice ${typeName(n.type)} ${n.text}  [línea ${n.line}]`;
    case "assign": return `Asignación ${n.text} =  [línea ${n.line}]`;
    case "read": return `Entrada radio(${n.text})  [línea ${n.line}]`;
    case "write": return `Salida diary  [línea ${n.line}]`;
    case "if": return `Condicional atlas/ryan  [línea ${n.line}]`;
    case "while": return `Ciclo vita  [línea ${n.line}]`;
    case "binop": return `Operación '${n.op}'${tipoSufijo(n)}`;
    case "relop": return `Comparación '${n.op}'`;
    case "int": return `Entero ${n.text}${tipoSufijo(n)}`;
    case "str": return `Cadena ${n.text}${tipoSufijo(n)}`;
    case "real": return `Real ${n.text}${tipoSufijo(n)}`;
    case "id": return `Identificador ${n.text}${tipoSufijo(n)}`;
  }
}

export function astPrint(root: AstNode): string {
  let out = "";
  const rec = (n: AstNode, prefix: string, ultimo: boolean, raiz: boolean, label: string) => {
    out += `${prefix}${raiz ? "" : ultimo ? "└── " : "├── "}${label}${descripcion(n)}\n`;
    const cp = prefix + (raiz ? "" : ultimo ? "    " : "│   ");
    const hs = hijos(n);
    hs.forEach((h, i) => rec(h.node, cp, i === hs.length - 1, false, h.label));
  };
  rec(root, "", true, true, "");
  return out;
}

/** Recorre el árbol en preorden. */
export function recorrer(n: AstNode, f: (n: AstNode, padre: AstNode | null) => void, padre: AstNode | null = null) {
  f(n, padre);
  for (const h of hijos(n)) recorrer(h.node, f, n);
}
