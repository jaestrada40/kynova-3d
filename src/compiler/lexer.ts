// Analizador léxico de Kynova (port de src/kynova.l). Longest-match con la prioridad de reglas de Flex.

export const T = {
  EOF: 0, SPLICE: 258, ADAM: 259, EVE: 260, PLASMID: 261, RADIO: 262, DIARY: 263, ATLAS: 264, RYAN: 265, VITA: 266,
  LE: 267, GE: 268, EQ: 269, NE: 270, ID: 271, INT_LIT: 272, REAL_LIT: 273, STR_LIT: 274,
} as const;

/** Nombre del token como lo imprime `kynova --tokens`. */
export function tokenName(code: number): string {
  const n: Record<number, string> = {
    [T.SPLICE]: "SPLICE", [T.ADAM]: "ADAM", [T.EVE]: "EVE", [T.PLASMID]: "PLASMID", [T.RADIO]: "RADIO", [T.DIARY]: "DIARY",
    [T.ATLAS]: "ATLAS", [T.RYAN]: "RYAN", [T.VITA]: "VITA", [T.ID]: "ID", [T.INT_LIT]: "ENTERO", [T.REAL_LIT]: "REAL", [T.STR_LIT]: "CADENA",
    [T.LE]: "MENOR_IGUAL", [T.GE]: "MAYOR_IGUAL", [T.EQ]: "IGUAL", [T.NE]: "DIFERENTE",
    60: "MENOR", 62: "MAYOR", 43: "MAS", 45: "MENOS", 42: "POR", 47: "ENTRE", 61: "ASIGNACION",
    40: "PAR_IZQ", 41: "PAR_DER", 123: "LLAVE_IZQ", 125: "LLAVE_DER", 59: "PUNTO_COMA",
  };
  return n[code] ?? "DESCONOCIDO";
}

export type Categoria = "reservada" | "tipo" | "id" | "numero" | "cadena" | "operador" | "relacional" | "delimitador" | "error";
export function categoria(code: number, error = false): Categoria {
  if (error) return "error";
  if (code === T.ADAM || code === T.EVE || code === T.PLASMID) return "tipo";
  if (code >= T.SPLICE && code <= T.VITA) return "reservada";
  if (code === T.ID) return "id";
  if (code === T.INT_LIT || code === T.REAL_LIT) return "numero";
  if (code === T.STR_LIT) return "cadena";
  if (code >= T.LE && code <= T.NE) return "relacional";
  if (code === 60 || code === 62) return "relacional";
  if ("+-*/=".includes(String.fromCharCode(code))) return "operador";
  return "delimitador";
}

export interface Token {
  index: number;
  code: number;
  name: string;
  /** Texto exacto del código fuente (yytext). */
  text: string;
  /** Valor semántico (yylval.str): igual al texto, salvo en el real con coma (se corrige a punto). */
  value: string;
  line: number;
  col: number;
  lastLine: number;
  lastCol: number;
  /** Posición en el texto fuente (índices UTF-16). */
  start: number;
  end: number;
  /** El lexer reportó un error en este token (sigue devolviendo un token razonable). */
  bad: boolean;
}

export interface Diag {
  fase: "léxico" | "sintáctico" | "semántico";
  nivel: "error" | "advertencia";
  line: number;
  col: number;
  msg: string;
  /** Líneas de ayuda adicionales («nota: …»). */
  notas: string[];
  /** Rango en el código fuente al que apunta (para resaltarlo). */
  start?: number;
  end?: number;
  /** Token (índice) y nodo del AST (id) asociados, si los hay. */
  token?: number;
  nodo?: number;
}

const PALABRAS: Record<string, number> = {
  splice: T.SPLICE, adam: T.ADAM, eve: T.EVE, plasmid: T.PLASMID, radio: T.RADIO, diary: T.DIARY, atlas: T.ATLAS, ryan: T.RYAN, vita: T.VITA,
};

type Regla = { re: RegExp; accion: (lex: string) => { code: number; value?: string; error?: string } | null };
const y = (s: string) => new RegExp(s, "uy");
const REGLAS: Regla[] = [
  { re: y("[ \\t\\r\\n]+"), accion: () => null },
  { re: y("//[^\\n]*"), accion: () => null },
  ...Object.entries(PALABRAS).map(([p, code]): Regla => ({ re: y(p), accion: () => ({ code }) })),
  { re: y("<="), accion: () => ({ code: T.LE }) },
  { re: y(">="), accion: () => ({ code: T.GE }) },
  { re: y("=="), accion: () => ({ code: T.EQ }) },
  { re: y("!="), accion: () => ({ code: T.NE }) },
  { re: y("[-+*/<>=(){};]"), accion: (l) => ({ code: l.charCodeAt(0) }) },
  { re: y("[0-9]+\\.[0-9]+"), accion: (l) => ({ code: T.REAL_LIT, value: l }) },
  { re: y("[0-9]+,[0-9]+"), accion: (l) => ({ code: T.REAL_LIT, value: l.replace(",", "."), error: `número real mal formado '${l}': los reales usan punto decimal, no coma` }) },
  { re: y("[0-9]+\\."), accion: (l) => ({ code: T.REAL_LIT, value: l, error: `número real mal formado '${l}': falta la parte fraccionaria` }) },
  { re: y('"[^"\\n]*"'), accion: (l) => ({ code: T.STR_LIT, value: l }) },
  { re: y('"[^"\\n]*'), accion: (l) => ({ code: T.STR_LIT, value: l, error: "cadena sin cerrar (falta '\"')" }) },
  { re: y("[0-9]+[a-zA-Z_][a-zA-Z_0-9]*"), accion: (l) => ({ code: T.ID, value: l, error: `identificador inválido '${l}': no puede iniciar con un dígito` }) },
  { re: y("[0-9]+"), accion: (l) => ({ code: T.INT_LIT, value: l }) },
  { re: y("[a-zA-Z_][a-zA-Z_0-9]*"), accion: (l) => ({ code: T.ID, value: l }) },
  { re: y("[^\\n]"), accion: (l) => ({ code: -1, error: `carácter no reconocido '${l}'` }) },
];

export interface ResultadoLexico { tokens: Token[]; diags: Diag[] }

export function lex(src: string): ResultadoLexico {
  const tokens: Token[] = [];
  const diags: Diag[] = [];
  let pos = 0, line = 1, col = 1;

  const avanzar = (lex: string) => {
    for (const ch of lex) { if (ch === "\n") { line++; col = 1; } else col++; }
  };
  const emitir = (code: number, text: string, value: string, l0: number, c0: number, bad: boolean, start: number, end: number, lastLine: number, lastCol: number) => {
    tokens.push({ index: tokens.length, code, name: tokenName(code), text, value, line: l0, col: c0, lastLine, lastCol, start, end, bad });
  };

  while (pos < src.length) {
    let mejor: { len: number; r: Regla; lex: string } | null = null;
    for (const r of REGLAS) {
      r.re.lastIndex = pos;
      const m = r.re.exec(src);
      if (m && (!mejor || m[0].length > mejor.len)) mejor = { len: m[0].length, r, lex: m[0] };
    }
    // ¿Comentario multilínea?
    if (src.startsWith("/*", pos) && (!mejor || mejor.len < 2 || mejor.lex === "/")) {
      const fin = src.indexOf("*/", pos + 2);
      const l0 = line, c0 = col;
      if (fin < 0) {
        avanzar(src.slice(pos));
        diags.push({ fase: "léxico", nivel: "error", line: l0, col: c0, msg: "comentario multilínea sin cerrar (falta '*/')", notas: [], start: pos, end: src.length });
        pos = src.length;
        break;
      }
      avanzar(src.slice(pos, fin + 2));
      pos = fin + 2;
      continue;
    }
    if (!mejor) { pos++; continue; }
    const { lex: texto, r } = mejor;
    const l0 = line, c0 = col, p0 = pos;
    avanzar(texto);
    pos += texto.length;
    const lastLine = line, lastCol = col > 1 ? col - 1 : 1;
    const a = r.accion(texto);
    if (!a) continue;
    if (a.error) diags.push({ fase: "léxico", nivel: "error", line: l0, col: c0, msg: a.error, notas: [], start: p0, end: pos, token: a.code >= 0 ? tokens.length : undefined });
    if (a.code < 0) continue; // carácter no reconocido: no devuelve token
    emitir(a.code, texto, a.value ?? texto, l0, c0, !!a.error, p0, pos, lastLine, lastCol);
  }
  // Fin de archivo
  tokens.push({ index: tokens.length, code: T.EOF, name: "EOF", text: "", value: "", line, col, lastLine: line, lastCol: col, start: src.length, end: src.length, bad: false });
  return { tokens, diags };
}
