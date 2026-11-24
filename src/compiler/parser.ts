// Analizador sintáctico de Kynova. Es el bucle de análisis LALR(1) del esqueleto yacc.c de Bison 3.8,
// manejado por las MISMAS tablas que genera Bison para src/kynova.y (ver tables.ts). Así la recuperación de
// errores y los mensajes «se esperaba…» salen idénticos a los del compilador en C.
import * as tb from "./tables.ts";
import {
  nodosCreados, astAssign, astBinop, astBlock, astBlockAppend, astDecl, astId, astIf, astInt, astProgram, astRead, astReal, astRelop, astStr, astWhile, astWrite,
  type AstNode, type DataType, type OpKind,
} from "./ast.ts";
import { T, type Diag, type Token } from "./lexer.ts";

const EMPTY = -2;
const NOMBRES = [
  "end of file", "error", "invalid token", "splice", "adam", "eve", "plasmid", "radio", "diary", "atlas", "ryan", "vita", "<=", ">=", "==", "!=",
  "ID", "INT_LIT", "REAL_LIT", "STR_LIT", "';'", "'='", "'('", "')'", "'{'", "'}'", "'<'", "'>'", "'+'", "'-'", "'*'", "'/'",
];
const MOSTRAR: Record<number, string> = {
  0: "fin de archivo", 16: "identificador", 17: "número entero", 18: "número real", 19: "cadena",
  3: "'splice'", 4: "'adam'", 5: "'eve'", 6: "'plasmid'", 7: "'radio'", 8: "'diary'", 9: "'atlas'", 10: "'ryan'", 11: "'vita'",
  12: "'<='", 13: "'>='", 14: "'=='", 15: "'!='",
};
export const simboloMostrar = (s: number) => MOSTRAR[s] ?? NOMBRES[s];

/** Reglas de la gramática (numeradas como en Bison; la 1 es la regla aumentada). */
export const REGLAS: Record<number, string> = {
  2: "programa → lista_instrucciones", 3: "lista_instrucciones → ε", 4: "lista_instrucciones → lista_instrucciones instruccion",
  5: "instruccion → declaracion", 6: "instruccion → asignacion", 7: "instruccion → entrada", 8: "instruccion → salida", 9: "instruccion → condicional", 10: "instruccion → ciclo",
  11: "instruccion → error ';'", 12: "instruccion → error bloque",
  13: "declaracion → 'splice' tipo ID ';'", 14: "declaracion → 'splice' tipo ID '=' expresion ';'", 15: "asignacion → ID '=' expresion ';'",
  16: "entrada → 'radio' '(' ID ')' ';'", 17: "salida → 'diary' '(' expresion ')' ';'",
  18: "condicional → 'atlas' '(' condicion ')' bloque 'ryan' rama_ryan", 19: "rama_ryan → bloque", 20: "rama_ryan → condicional",
  21: "ciclo → 'vita' '(' condicion ')' bloque", 22: "bloque → '{' lista_instrucciones '}'",
  23: "tipo → 'adam'", 24: "tipo → 'eve'", 25: "tipo → 'plasmid'", 26: "condicion → expresion relop expresion", 27: "condicion → error",
  28: "relop → '<'", 29: "relop → '>'", 30: "relop → '<='", 31: "relop → '>='", 32: "relop → '=='", 33: "relop → '!='",
  34: "expresion → termino", 35: "expresion → expresion '+' termino", 36: "expresion → expresion '-' termino",
  37: "termino → factor", 38: "termino → termino '*' factor", 39: "termino → termino '/' factor",
  40: "factor → INT_LIT", 41: "factor → REAL_LIT", 42: "factor → STR_LIT", 43: "factor → ID", 44: "factor → '(' expresion ')'",
};

interface Loc { fl: number; fc: number; ll: number; lc: number }
interface Val { str?: string; node?: AstNode | null; type?: DataType; op?: OpKind }

export type Evento =
  | { kind: "shift"; token: number }
  | { kind: "reduce"; regla: number; nodo?: number; tokens: [number, number] | null }
  | { kind: "error"; diag: Diag }
  | { kind: "descartar"; token: number }
  | { kind: "recuperar" };

export interface ResultadoSintactico { ast: AstNode | null; diags: Diag[]; trace: Evento[]; abortado: boolean }

export function parse(tokens: Token[]): ResultadoSintactico {
  const diags: Diag[] = [];
  const trace: Evento[] = [];
  let resultado: AstNode | null = null;
  let abortado = false;

  let ti = 0; // siguiente token a leer
  let ultimo = -1; // índice del último token entregado al parser (yylloc / prev_tok)
  const leer = () => { const t = tokens[Math.min(ti, tokens.length - 1)]; if (ti < tokens.length - 1) ti++; ultimo = t.index; return t; };
  const locTok = (t: Token): Loc => ({ fl: t.line, fc: t.col, ll: t.lastLine, lc: t.lastCol });

  const ss: number[] = [0];
  const vs: Val[] = [{}];
  const ls: Loc[] = [{ fl: 1, fc: 1, ll: 1, lc: 1 }];
  let yychar = EMPTY;
  let look: Token | null = null;
  let yytoken = EMPTY;
  let errstatus = 0;
  let state = 0;
  let yyn = 0;
  let pc: "backup" | "default" | "reduce" | "errlab" | "errlab1" | "newstate" = "backup";
  const traducir = (c: number) => (c >= 0 && c <= tb.YYMAXUTOK ? tb.yytranslate[c] : 2);

  const reportar = () => {
    const t = tokens[ultimo] ?? tokens[0];
    const top = ss[ss.length - 1];
    // yypcontext_expected_tokens
    const esperados: number[] = [];
    const pact = tb.yypact[top];
    if (pact !== tb.YYPACT_NINF) {
      const x0 = pact < 0 ? -pact : 0;
      const lim = tb.YYLAST - pact + 1;
      const x1 = lim < tb.YYNTOKENS ? lim : tb.YYNTOKENS;
      for (let x = x0; x < x1; x++) if (tb.yycheck[x + pact] === x && x !== 1) esperados.push(x);
    }
    let msg = "";
    if (yytoken !== EMPTY) msg += `${simboloMostrar(yytoken)} inesperado`;
    if (esperados.length > 0 && esperados.length <= 6) {
      msg += (msg ? ", " : "") + "se esperaba ";
      esperados.forEach((e, i) => { if (i > 0) msg += i === esperados.length - 1 ? " o " : ", "; msg += simboloMostrar(e); });
    }
    const notas: string[] = [];
    const prev = ultimo > 0 ? tokens[ultimo - 1] : null;
    const prevLast = prev ? prev.lastLine : 0;
    if (esperados.includes(10)) notas.push("en Kynova 1.0 todo 'atlas' debe llevar su bloque 'ryan'.");
    else if (esperados.some((e) => NOMBRES[e] === "';'") && prevLast > 0) notas.push(`¿falta ';' al final de la instrucción de la línea ${prevLast}?`);
    else if (esperados.some((e) => NOMBRES[e] === "'('") && prev && (prev.code === T.ATLAS || prev.code === T.VITA)) notas.push(`la condición de '${prev.code === T.ATLAS ? "atlas" : "vita"}' debe ir entre paréntesis.`);
    const d: Diag = { fase: "sintáctico", nivel: "error", line: t.line, col: t.col, msg, notas, start: t.start, end: t.end, token: t.index };
    diags.push(d);
    trace.push({ kind: "error", diag: d });
  };

  for (let guard = 0; guard < 1_000_000; guard++) {
    if (pc === "newstate") { ss.push(state); pc = "backup"; if (state === tb.YYFINAL) break; }

    if (pc === "backup") {
      yyn = tb.yypact[state];
      if (yyn === tb.YYPACT_NINF) { pc = "default"; continue; }
      if (yychar === EMPTY) { look = leer(); yychar = look.code; }
      if (yychar <= 0) { yychar = 0; yytoken = 0; } else yytoken = traducir(yychar);
      yyn += yytoken;
      if (yyn < 0 || tb.YYLAST < yyn || tb.yycheck[yyn] !== yytoken) { pc = "default"; continue; }
      yyn = tb.yytable[yyn];
      if (yyn <= 0) { yyn = -yyn; pc = "reduce"; continue; }
      // desplazar (shift)
      if (errstatus) errstatus--;
      const t = look!;
      trace.push({ kind: "shift", token: t.index });
      vs.push({ str: t.value });
      ls.push(locTok(t));
      state = yyn;
      yychar = EMPTY;
      pc = "newstate";
      continue;
    }

    if (pc === "default") {
      yyn = tb.yydefact[state];
      pc = yyn === 0 ? "errlab" : "reduce";
      continue;
    }

    if (pc === "reduce") {
      const len = tb.yyr2[yyn];
      const base = vs.length - len;
      const V = (k: number) => vs[base + k - 1];
      const L = (k: number) => ls[base + k - 1];
      const yyloc: Loc = len > 0
        ? { fl: ls[base].fl, fc: ls[base].fc, ll: ls[base + len - 1].ll, lc: ls[base + len - 1].lc }
        : { fl: ls[ls.length - 1].ll, fc: ls[ls.length - 1].lc, ll: ls[ls.length - 1].ll, lc: ls[ls.length - 1].lc };
      let val: Val = len > 0 ? { ...V(1) } : {};
      const antes = nodosCreados();
      switch (yyn) {
        case 2: resultado = astProgram(V(1).node!); break;
        case 3: val = { node: astBlock(yyloc.fl, yyloc.fc) }; break;
        case 4: val = { node: V(1).node }; if (V(2).node) astBlockAppend(val.node!, V(2).node!); break;
        case 11: val = { node: null }; errstatus = 0; break;
        case 12: val = { node: null }; errstatus = 0; break;
        case 13: val = { node: astDecl(V(2).type!, V(3).str!, null, L(3).fl, L(3).fc) }; break;
        case 14: val = { node: astDecl(V(2).type!, V(3).str!, V(5).node!, L(3).fl, L(3).fc) }; break;
        case 15: val = { node: astAssign(V(1).str!, V(3).node!, L(1).fl, L(1).fc) }; break;
        case 16: val = { node: astRead(V(3).str!, L(3).fl, L(3).fc) }; break;
        case 17: val = { node: astWrite(V(3).node!, L(1).fl, L(1).fc) }; break;
        case 18: val = { node: astIf(V(3).node ?? null, V(5).node!, V(7).node!, L(1).fl, L(1).fc) }; break;
        case 20: { const b = astBlock(L(1).fl, L(1).fc); astBlockAppend(b, V(1).node!); val = { node: b }; break; }
        case 21: val = { node: astWhile(V(3).node ?? null, V(5).node!, L(1).fl, L(1).fc) }; break;
        case 22: { const b = V(2).node!; b.line = L(1).fl; b.col = L(1).fc; val = { node: b }; break; }
        case 23: val = { type: "adam" }; break;
        case 24: val = { type: "eve" }; break;
        case 25: val = { type: "plasmid" }; break;
        case 26: val = { node: astRelop(V(2).op!, V(1).node!, V(3).node!, L(2).fl, L(2).fc) }; break;
        case 27: val = { node: null }; break;
        case 28: val = { op: "<" }; break; case 29: val = { op: ">" }; break; case 30: val = { op: "<=" }; break;
        case 31: val = { op: ">=" }; break; case 32: val = { op: "==" }; break; case 33: val = { op: "!=" }; break;
        case 35: val = { node: astBinop("+", V(1).node!, V(3).node!, L(2).fl, L(2).fc) }; break;
        case 36: val = { node: astBinop("-", V(1).node!, V(3).node!, L(2).fl, L(2).fc) }; break;
        case 38: val = { node: astBinop("*", V(1).node!, V(3).node!, L(2).fl, L(2).fc) }; break;
        case 39: val = { node: astBinop("/", V(1).node!, V(3).node!, L(2).fl, L(2).fc) }; break;
        case 40: val = { node: astInt(V(1).str!, L(1).fl, L(1).fc) }; break;
        case 41: val = { node: astReal(V(1).str!, L(1).fl, L(1).fc) }; break;
        case 42: val = { node: astStr(V(1).str!, L(1).fl, L(1).fc) }; break;
        case 43: val = { node: astId(V(1).str!, L(1).fl, L(1).fc) }; break;
        case 44: val = { node: V(2).node }; break;
        default: break; // $$ = $1
      }
      const nuevos = nodosCreados() - antes;
      // Rango de tokens que cubre esta reducción (para resaltar el código fuente).
      const rango = len > 0 ? rangoTokens(ls, base, len, tokens) : null;
      trace.push({ kind: "reduce", regla: yyn, nodo: nuevos > 0 && val.node ? val.node.id : undefined, tokens: rango });
      vs.length = base; ss.length -= len; ls.length = base;
      vs.push(val); ls.push(yyloc);
      const lhs = tb.yyr1[yyn] - tb.YYNTOKENS;
      const top = ss[ss.length - 1];
      const yyi = tb.yypgoto[lhs] + top;
      state = 0 <= yyi && yyi <= tb.YYLAST && tb.yycheck[yyi] === top ? tb.yytable[yyi] : tb.yydefgoto[lhs];
      pc = "newstate";
      continue;
    }

    if (pc === "errlab") {
      yytoken = yychar === EMPTY ? EMPTY : traducir(yychar);
      if (!errstatus) reportar();
      if (errstatus === 3) {
        if (yychar <= 0) { if (yychar === 0) { abortado = true; break; } }
        else { trace.push({ kind: "descartar", token: ultimo }); yychar = EMPTY; }
      }
      pc = "errlab1";
      continue;
    }

    if (pc === "errlab1") {
      errstatus = 3;
      for (;;) {
        yyn = tb.yypact[state];
        if (yyn !== tb.YYPACT_NINF) {
          yyn += 1; // YYSYMBOL_YYerror
          if (0 <= yyn && yyn <= tb.YYLAST && tb.yycheck[yyn] === 1) { yyn = tb.yytable[yyn]; if (0 < yyn) break; }
        }
        if (ss.length === 1) { abortado = true; break; }
        vs.pop(); ls.pop(); ss.pop();
        state = ss[ss.length - 1];
      }
      if (abortado) break;
      trace.push({ kind: "recuperar" });
      vs.push({});
      ls.push(locTok(tokens[ultimo] ?? tokens[0]));
      state = yyn;
      pc = "newstate";
      continue;
    }
  }
  return { ast: abortado ? null : resultado, diags, trace, abortado };
}

function rangoTokens(ls: Loc[], base: number, len: number, tokens: Token[]): [number, number] | null {
  const a = ls[base], b = ls[base + len - 1];
  let i0 = -1, i1 = -1;
  for (const t of tokens) {
    if (t.code === 0) continue;
    if (i0 < 0 && (t.line > a.fl || (t.line === a.fl && t.col >= a.fc))) i0 = t.index;
    if (t.line < b.ll || (t.line === b.ll && t.col <= b.lc)) i1 = t.index;
  }
  return i0 >= 0 && i1 >= i0 ? [i0, i1] : null;
}
