// Motor de explicación automática: convierte lo que REALMENTE hizo el compilador con tu programa
// (tokens, reducciones de Bison, eventos de la tabla de símbolos, traducción) en una narración paso a paso.
import { hijos, recorrer, typeName, type AstNode } from "./ast.ts";
import { chapinExpr, chapinInstruccion } from "./chapin.ts";
import type { Resultado } from "./compile.ts";
import { T, type Token } from "./lexer.ts";
import { REGLAS } from "./parser.ts";
import type { EventoSem } from "./semantic.ts";

export type Vista = "pipeline" | "tokens" | "ast" | "genebank" | "chapin";
export type Fase = "intro" | "lex" | "sin" | "sem" | "chapin" | "fin";

export interface Paso {
  id: string;
  fase: Fase;
  titulo: string;
  texto: string;
  detalle: string[];
  vista: Vista;
  tono: "info" | "error" | "aviso" | "ok";
  /** Líneas del código (1-based) y tokens que se resaltan. */
  lineas: number[];
  tokens: number[];
  /** Vista de tokens: se muestran los tokens con índice ≤ tokensHasta. */
  tokensHasta?: number;
  /** Vista del AST: nodos resaltados y cuántos nodos (por orden de creación) existen ya. */
  nodos: number[];
  nodosHasta?: number;
  /** Vista del Gene Bank: símbolos resaltados y cuántos existen ya. */
  simbolos: number[];
  simbolosHasta?: number;
  /** Vista de Chapín: líneas traducidas hasta ahora y líneas resaltadas. */
  chapinHasta?: number;
  chapinResaltar?: number[];
}

// ───────── Vocabulario ─────────
const MEANING: Record<number, string> = {
  [T.SPLICE]: "palabra reservada: declara una variable",
  [T.ADAM]: "tipo entero (int en C)", [T.EVE]: "tipo real con decimales (double en C)", [T.PLASMID]: "tipo texto (cadena)",
  [T.RADIO]: "palabra reservada: lee un valor del teclado", [T.DIARY]: "palabra reservada: escribe un valor en pantalla",
  [T.ATLAS]: "palabra reservada: abre un condicional (if)", [T.RYAN]: "palabra reservada: rama alternativa (else), obligatoria",
  [T.VITA]: "palabra reservada: abre un ciclo (while)",
  [T.ID]: "identificador (nombre de variable)", [T.INT_LIT]: "número entero", [T.REAL_LIT]: "número real", [T.STR_LIT]: "cadena de texto",
  [T.LE]: "comparación «menor o igual»", [T.GE]: "comparación «mayor o igual»", [T.EQ]: "comparación «igual»", [T.NE]: "comparación «diferente»",
  60: "comparación «menor que»", 62: "comparación «mayor que»", 61: "asignación: guarda el valor de la derecha",
  43: "operador de suma", 45: "operador de resta", 42: "operador de multiplicación", 47: "operador de división",
  40: "abre paréntesis", 41: "cierra paréntesis", 123: "abre un bloque (y un alcance nuevo)", 125: "cierra el bloque", 59: "punto y coma: termina la instrucción",
};
export const significado = (t: Token) => MEANING[t.code] ?? "símbolo";
const q = (s: string) => `«${s}»`;

const cuenta = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

const resumenNodo = (n: AstNode): string => {
  switch (n.kind) {
    case "decl": return `splice ${typeName(n.type)} ${n.text}${n.child[0] ? ` = ${chapinExpr(n.child[0])}` : ""}`;
    case "assign": return `${n.text} = ${chapinExpr(n.child[0]!)}`;
    case "read": return `radio(${n.text})`;
    case "write": return `diary(${chapinExpr(n.child[0]!)})`;
    case "if": return `atlas (${chapinExpr(n.child[0]!)}) … ryan …`;
    case "while": return `vita (${chapinExpr(n.child[0]!)}) …`;
    default: return n.kind;
  }
};

/** ¿Hay una multiplicación/división dentro de una suma/resta? Devuelve un ejemplo para explicar la precedencia. */
function ejemploPrecedencia(e: AstNode | null): { padre: AstNode; hijo: AstNode } | null {
  if (!e) return null;
  let res: { padre: AstNode; hijo: AstNode } | null = null;
  recorrer(e, (n) => {
    if (res || n.kind !== "binop" || (n.op !== "+" && n.op !== "-")) return;
    for (const h of n.child) if (h && h.kind === "binop" && (h.op === "*" || h.op === "/")) { res = { padre: n, hijo: h }; return; }
  });
  return res;
}

export function explicar(r: Resultado): Paso[] {
  const pasos: Paso[] = [];
  const base = { detalle: [] as string[], tono: "info" as Paso["tono"], lineas: [] as number[], tokens: [] as number[], nodos: [] as number[], simbolos: [] as number[] };
  const add = (p: Partial<Paso> & Pick<Paso, "fase" | "titulo" | "texto" | "vista">) => {
    pasos.push({ ...base, detalle: [], lineas: [], tokens: [], nodos: [], simbolos: [], ...p, id: String(pasos.length) });
  };
  const toks = r.tokens.filter((t) => t.code !== T.EOF);
  const lineasSrc = r.source.split("\n");
  const nLineas = r.source.length === 0 ? 0 : lineasSrc.length;
  const lineasDe = (a: number, b: number) => {
    const s = new Set<number>();
    for (let i = a; i <= b; i++) if (r.tokens[i]) s.add(r.tokens[i].line);
    return [...s];
  };
  const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

  // Rango de tokens de cada nodo, según las reducciones de Bison.
  const nodoTokens = new Map<number, [number, number]>();
  for (const e of r.sintaxis.trace) if (e.kind === "reduce" && e.nodo !== undefined && e.tokens) nodoTokens.set(e.nodo, e.tokens);
  const tokensDe = (n: AstNode) => nodoTokens.get(n.id) ?? null;

  const ast = r.sintaxis.ast;
  const sinErrFrontales = r.lexDiags.length === 0 && r.sintaxis.diags.length === 0;

  // ───────── Introducción ─────────
  add({
    fase: "intro", vista: "pipeline", titulo: "Bienvenido a Kynova",
    texto: "Kynova es un lenguaje educativo con sabor a Rapture. Un compilador lo traduce en fases: primero lee el texto, luego entiende su estructura, después comprueba que tenga sentido y por último lo traduce. Voy a recorrer esas fases con TU programa.",
    detalle: ["Archivo .kyn → Flex (tokens) → Bison (AST) → Gene Bank (tabla de símbolos) → traducción a Chapín"],
  });
  add({
    fase: "intro", vista: "pipeline", titulo: "Tu programa",
    texto: nLineas === 0
      ? "El programa está vacío. Un programa vacío es válido en Kynova: no hay nada que reconocer ni que comprobar. Escribe algo en el editor o elige un ejemplo para ver más."
      : `Tu programa tiene ${cuenta(nLineas, "línea", "líneas")} y ${cuenta(r.source.length, "carácter", "caracteres")}. Las palabras de Kynova vienen de BioShock: splice declara, adam/eve/plasmid son tipos, atlas/ryan es el condicional, vita el ciclo, radio lee y diary escribe.`,
    lineas: nLineas ? rango(1, nLineas) : [],
  });

  // ───────── Fase 1: Flex ─────────
  const cats = new Map<string, number>();
  for (const t of toks) cats.set(t.name, (cats.get(t.name) ?? 0) + 1);
  add({
    fase: "lex", vista: "tokens", titulo: "Fase 1 · Flex: análisis léxico",
    texto: `Flex recorre el texto carácter por carácter y lo agrupa en piezas llamadas tokens: palabras reservadas, identificadores, números, operadores. Descarta los espacios y los comentarios, y NO entiende el significado: solo reconoce piezas. De tu programa salen ${cuenta(toks.length, "token", "tokens")}.`,
    detalle: [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, c]) => `${n}: ${c}`),
    tokensHasta: -1,
  });
  const porLinea = new Map<number, Token[]>();
  for (const t of toks) porLinea.set(t.line, [...(porLinea.get(t.line) ?? []), t]);
  const errTok = new Set(r.lexDiags.map((d) => d.token).filter((x) => x !== undefined));
  for (const [linea, ts] of porLinea) {
    const muestra = ts.slice(0, 7);
    add({
      fase: "lex", vista: "tokens", titulo: `Línea ${linea}`,
      texto: `Flex separa esta línea en ${cuenta(ts.length, "token", "tokens")}.`,
      detalle: [...muestra.map((t) => `${q(t.text)} → ${t.name}: ${significado(t)}`), ...(ts.length > muestra.length ? [`… y ${ts.length - muestra.length} más`] : [])],
      lineas: [linea], tokens: ts.map((t) => t.index), tokensHasta: ts[ts.length - 1].index,
      tono: ts.some((t) => errTok.has(t.index)) ? "error" : "info",
    });
  }
  for (const d of r.lexDiags) {
    add({
      fase: "lex", vista: "tokens", tono: "error", titulo: `Error léxico en ${d.line}:${d.col}`,
      texto: `${d.msg}. Flex no encontró ninguna regla que describa ese trozo de texto, así que lo reporta. ${d.token !== undefined ? "Aun así devuelve un token razonable para que el parser no genere errores en cascada." : "Lo descarta y sigue leyendo."}`,
      lineas: [d.line], tokens: d.token !== undefined ? [d.token] : [], tokensHasta: d.token ?? undefined,
    });
  }
  if (toks.length === 0 && nLineas > 0) add({ fase: "lex", vista: "tokens", titulo: "Sin tokens", texto: "Solo había espacios o comentarios: Flex los descarta, así que no hay ningún token.", tokensHasta: -1 });

  // ───────── Fase 2: Bison ─────────
  add({
    fase: "sin", vista: "ast", titulo: "Fase 2 · Bison: análisis sintáctico",
    texto: "Bison toma los tokens y comprueba que respeten la gramática de Kynova (reglas como declaracion → 'splice' tipo ID ';'). Si encajan, va armando el AST, un árbol que representa la estructura del programa. Construye de abajo hacia arriba: primero las hojas y luego lo que las contiene.",
    detalle: ["La precedencia está en la propia gramática: expresion → termino → factor", "Los relacionales solo aparecen en condicion: no se encadenan", "Todo atlas debe llevar su ryan"],
    nodosHasta: 1,
  });

  if (r.sintaxis.diags.length === 0 && ast) {
    const alto = (n: AstNode): number => Math.max(n.id, ...hijos(n).map((h) => alto(h.node)));
    const narrar = (n: AstNode) => {
      const rg = tokensDe(n);
      const base2 = { fase: "sin" as const, vista: "ast" as const, lineas: rg ? lineasDe(rg[0], rg[1]) : [n.line], tokens: rg ? rango(rg[0], rg[1]) : [] };
      switch (n.kind) {
        case "decl":
          add({ ...base2, titulo: `Línea ${n.line}: declaración de ${n.text}`, texto: `Con la regla ${q(n.child[0] ? REGLAS[14] : REGLAS[13])} Bison crea un nodo Declaración: variable ${q(n.text!)} de tipo ${typeName(n.type)}${n.child[0] ? `, con valor inicial ${q(chapinExpr(n.child[0]))}` : ", sin valor inicial"}.`,
            detalle: (() => { const ej = ejemploPrecedencia(n.child[0]); return ej ? [`Precedencia: ${q(chapinExpr(ej.hijo))} se agrupa antes que el ${q(ej.padre.op!)}: «termino» está más abajo que «expresion».`] : []; })(),
            nodos: [n.id], nodosHasta: alto(n) + 1 });
          break;
        case "assign":
          add({ ...base2, titulo: `Línea ${n.line}: asignación a ${n.text}`, texto: `Regla ${q(REGLAS[15])}: nodo Asignación de ${q(n.text!)} con la expresión ${q(chapinExpr(n.child[0]!))} como hijo.`,
            detalle: (() => { const ej = ejemploPrecedencia(n.child[0]); return ej ? [`Precedencia: ${q(chapinExpr(ej.hijo))} se agrupa antes que el ${q(ej.padre.op!)}: «termino» está más abajo que «expresion».`] : []; })(),
            nodos: [n.id], nodosHasta: alto(n) + 1 });
          break;
        case "read":
          add({ ...base2, titulo: `Línea ${n.line}: lectura de ${n.text}`, texto: `Regla ${q(REGLAS[16])}: nodo Entrada. Solo acepta un identificador, no una expresión.`, nodos: [n.id], nodosHasta: alto(n) + 1 });
          break;
        case "write":
          add({ ...base2, titulo: `Línea ${n.line}: salida con diary`, texto: `Regla ${q(REGLAS[17])}: nodo Salida con la expresión ${q(chapinExpr(n.child[0]!))}.`,
            detalle: (() => { const ej = ejemploPrecedencia(n.child[0]); return ej ? [`Precedencia: ${q(chapinExpr(ej.hijo))} se agrupa antes que el ${q(ej.padre.op!)}.`] : []; })(),
            nodos: [n.id], nodosHasta: alto(n) + 1 });
          break;
        case "if": {
          const c = n.child[0]!;
          add({ ...base2, titulo: `Línea ${n.line}: condición de atlas`, texto: `La condición ${q(chapinExpr(c))} es una comparación: la regla ${q(REGLAS[26])} crea un nodo Comparación. Los relacionales solo pueden aparecer aquí, por eso a < b < c es un error.`, lineas: [n.line], tokens: [], nodos: [c.id], nodosHasta: alto(c) + 1 });
          n.child[1]!.items.forEach(narrar);
          n.child[2]!.items.forEach(narrar);
          add({ ...base2, titulo: `Línea ${n.line}: se arma el condicional`, texto: `Regla ${q(REGLAS[18])}: Bison junta la condición, el bloque de atlas y el de ryan en un nodo Condicional. ${n.child[2]!.items.length === 1 && n.child[2]!.items[0].kind === "if" ? "Un «ryan atlas (…)» se guarda como un atlas anidado dentro de ryan." : "El bloque ryan es obligatorio."}`, nodos: [n.id], nodosHasta: alto(n) + 1 });
          break;
        }
        case "while": {
          const c = n.child[0]!;
          add({ ...base2, titulo: `Línea ${n.line}: condición de vita`, texto: `La condición ${q(chapinExpr(c))} se convierte en un nodo Comparación.`, lineas: [n.line], tokens: [], nodos: [c.id], nodosHasta: alto(c) + 1 });
          n.child[1]!.items.forEach(narrar);
          add({ ...base2, titulo: `Línea ${n.line}: se arma el ciclo`, texto: `Regla ${q(REGLAS[21])}: nodo Ciclo con su condición y su cuerpo.`, nodos: [n.id], nodosHasta: alto(n) + 1 });
          break;
        }
        default: break;
      }
    };
    ast.items.forEach(narrar);
    add({
      fase: "sin", vista: "ast", tono: r.lexDiags.length ? "aviso" : "ok", titulo: "El AST está completo",
      texto: `Bison terminó: el programa tiene ${cuenta(ast.items.length, "instrucción", "instrucciones")} en el nivel principal${r.lexDiags.length ? ", pero hubo errores léxicos, así que el compilador se detendrá antes de la semántica" : ". Ahora hay que comprobar que tenga sentido"}.`,
      nodosHasta: 1_000_000, nodos: [ast.id],
    });
  } else if (r.sintaxis.diags.length > 0) {
    const ev = r.sintaxis.trace;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.kind !== "error") continue;
      const d = e.diag;
      const desc: number[] = [];
      for (let j = i + 1; j < ev.length; j++) {
        const x = ev[j];
        if (x.kind === "descartar") desc.push(x.token);
        else if (x.kind === "error" || (x.kind === "reduce" && (x.regla === 11 || x.regla === 12 || x.regla === 27))) break;
      }
      add({
        fase: "sin", vista: "ast", tono: "error", titulo: `Error sintáctico en ${d.line}:${d.col}`,
        texto: `Bison encontró ${d.msg}. Con los tokens que ya leyó, ese token no puede ocurrir en este punto de la gramática.`,
        detalle: [...d.notas, `Para seguir revisando, entra en recuperación de errores${desc.length ? `: descarta ${cuenta(desc.length, "token", "tokens")}` : ""} hasta poder cerrar la instrucción (regla ${q(REGLAS[11])}), y así puede encontrar más errores en la misma pasada.`],
        lineas: [d.line], tokens: [...(d.token !== undefined ? [d.token] : []), ...desc], nodosHasta: 1_000_000,
      });
    }
  }

  // Si hay errores en las fases iniciales, el compilador se detiene (igual que main.c).
  if (!sinErrFrontales) {
    add({
      fase: "fin", vista: "pipeline", tono: "error", titulo: "El compilador se detiene",
      texto: `Hay ${cuenta(r.lexDiags.length, "error léxico", "errores léxicos")} y ${cuenta(r.sintaxis.diags.length, "error sintáctico", "errores sintácticos")}. Con errores en estas fases no se puede confiar en el árbol, así que Kynova NO sigue con la semántica ni con la traducción. Resultado: programa INVÁLIDO (código de salida 1). Corrige el primer error y vuelve a intentar.`,
      detalle: ["El primer error suele causar los siguientes: corrige de arriba hacia abajo"],
    });
    return pasos;
  }

  // ───────── Fase 3: semántica ─────────
  const sem = r.sem!;
  add({
    fase: "sem", vista: "genebank", titulo: "Fase 3 · Semántica y Gene Bank",
    texto: "Que el programa esté bien escrito no basta: tiene que tener sentido. Esta fase recorre el AST y mantiene el Gene Bank, la tabla de símbolos: cada variable con su tipo, su alcance, su línea y cuántas veces se usa. Comprueba que lo que usas esté declarado y que los tipos sean compatibles.",
    detalle: ["adam → int, eve → double, plasmid → texto", "Cada bloque { } abre un alcance nuevo; al cerrarse, sus variables dejan de existir", "Se pueden asignar adam a eve, pero no al revés (se perdería la parte decimal)"],
    simbolosHasta: 0,
  });
  const simbolos = sem.symbols;
  const nodoPorId = new Map<number, AstNode>();
  if (ast) recorrer(ast, (n) => nodoPorId.set(n.id, n));
  type Seg = { marca: EventoSem; evs: EventoSem[] };
  const segs: Seg[] = [];
  for (const e of sem.events) {
    if (e.k === "inst" || e.k === "entrar" || e.k === "salir") segs.push({ marca: e, evs: [] });
    else if (segs.length) segs[segs.length - 1].evs.push(e);
  }
  let visibles = 0;
  const alcanceTxt = (s: { scopeLevel: number; scopeId: number }) => (s.scopeLevel === 0 ? "global" : `bloque #${s.scopeId} (nivel ${s.scopeLevel})`);
  for (const seg of segs) {
    const m = seg.marca;
    if (m.k === "entrar") {
      add({ fase: "sem", vista: "genebank", titulo: `Se abre el alcance bloque #${m.scopeId}`, texto: `Entramos a un bloque { }: nivel ${m.nivel}. Lo que se declare aquí solo existirá hasta que el bloque se cierre. Las variables de afuera siguen visibles.`, simbolosHasta: visibles, lineas: nodoPorId.get(m.nodo) ? [nodoPorId.get(m.nodo)!.line] : [] });
      continue;
    }
    if (m.k === "salir") {
      const mueren = simbolos.filter((s) => s.scopeId === m.scopeId);
      add({ fase: "sem", vista: "genebank", titulo: `Se cierra el bloque #${m.scopeId}`, texto: mueren.length ? `Al cerrar el bloque, ${cuenta(mueren.length, "variable deja", "variables dejan")} de existir: ${mueren.map((s) => q(s.name)).join(", ")}. Quedan en la tabla para el reporte, pero ya no se pueden usar.` : "El bloque se cierra; no declaró variables propias.", simbolos: mueren.map((s) => s.index), simbolosHasta: visibles });
      continue;
    }
    const n = nodoPorId.get(m.nodo)!;
    const detalle: string[] = [];
    let titulo = `Línea ${n.line}: ${resumenNodo(n)}`;
    const resaltar: number[] = [];
    let lastTipo: string | null = null;
    for (const e of seg.evs) {
      if (e.k === "buscar") {
        const s = e.simbolo !== undefined ? simbolos[e.simbolo] : null;
        if (s) { detalle.push(`Busca ${q(e.nombre)} en la tabla: la encuentra (${typeName(s.type)}, declarada en la línea ${s.line}).`); resaltar.push(s.index); }
        else detalle.push(`Busca ${q(e.nombre)} en la tabla: NO la encuentra.`);
      } else if (e.k === "tipo" && e.tipo !== "unknown") lastTipo = typeName(e.tipo);
      else if (e.k === "declarar") {
        const s = simbolos[e.simbolo];
        visibles = Math.max(visibles, s.index + 1);
        detalle.push(`Registra ${q(s.name)} como ${typeName(s.type)} en el alcance ${alcanceTxt(s)}.`);
        resaltar.push(s.index);
      }
    }
    if (n.kind === "decl") {
      if (n.child[0] && lastTipo) detalle.unshift(`El valor inicial es de tipo ${lastTipo}.`);
      if (n.child[0]) detalle.push("El valor inicial se evalúa ANTES de registrar la variable: por eso «splice adam x = x + 1;» falla (x aún no existe).");
    } else if ((n.kind === "assign" || n.kind === "write") && lastTipo) detalle.push(`La expresión resulta de tipo ${lastTipo}.`);
    else if (n.kind === "if" || n.kind === "while") titulo = `Línea ${n.line}: condición de ${n.kind === "if" ? "atlas" : "vita"}`;
    const d = seg.evs.find((x) => x.k === "diag");
    if (n.kind === "read" && !detalle.length) detalle.push("radio solo puede leer en variables adam o eve.");
    add({
      fase: "sem", vista: "genebank", titulo,
      texto: n.kind === "decl" ? "Declarar una variable la añade al Gene Bank." : n.kind === "assign" ? "Asignar exige que la variable exista y que los tipos sean compatibles." : n.kind === "read" ? "Leer exige que la variable exista." : n.kind === "write" ? "Escribir evalúa la expresión y comprueba sus variables y tipos." : "La condición compara dos expresiones; se comprueban sus variables y que no sean texto.",
      detalle, lineas: [n.line], nodos: [n.id], nodosHasta: 1_000_000, simbolos: resaltar, simbolosHasta: visibles,
      tono: d ? "info" : "info",
    });
    for (const e of seg.evs) {
      if (e.k !== "diag") continue;
      const dd = e.diag;
      add({
        fase: "sem", vista: "genebank", tono: dd.nivel === "error" ? "error" : "aviso",
        titulo: `${dd.nivel === "error" ? "Error semántico" : "Advertencia"} en ${dd.line}:${dd.col}`,
        texto: `${dd.msg}.${dd.nivel === "error" ? " El programa será INVÁLIDO, pero el análisis sigue para encontrar más errores." : " Las advertencias no invalidan el programa."}`,
        lineas: [dd.line], nodos: dd.nodo !== undefined ? [dd.nodo] : [], nodosHasta: 1_000_000, simbolosHasta: visibles,
      });
    }
  }
  // Advertencias finales (variables sin usar)
  const finales = sem.diags.filter((d) => d.nivel === "advertencia" && /nunca se usa/.test(d.msg));
  for (const dd of finales) {
    add({ fase: "sem", vista: "genebank", tono: "aviso", titulo: `Advertencia en ${dd.line}:${dd.col}`, texto: `${dd.msg}. Al final del análisis, Kynova revisa el Gene Bank: una variable con 0 usos probablemente sobra. No invalida el programa.`, lineas: [dd.line], simbolos: simbolos.filter((s) => s.line === dd.line && s.col === dd.col).map((s) => s.index), simbolosHasta: simbolos.length });
  }
  add({
    fase: "sem", vista: "genebank", tono: sem.errores ? "error" : "ok", titulo: "Gene Bank completo",
    texto: simbolos.length ? `La tabla registró ${cuenta(simbolos.length, "variable", "variables")}. La columna «Usos» cuenta cuántas veces se lee o escribe cada una.` : "El programa no declara variables, así que el Gene Bank queda vacío.",
    simbolosHasta: simbolos.length, simbolos: [],
  });

  if (sem.errores > 0) {
    add({
      fase: "fin", vista: "pipeline", tono: "error", titulo: "El compilador se detiene",
      texto: `Hubo ${cuenta(sem.errores, "error semántico", "errores semánticos")}. El programa está bien escrito pero no tiene sentido, así que NO se traduce a Chapín. Resultado: programa INVÁLIDO (código de salida 1).`,
    });
    return pasos;
  }

  // ───────── Fase 4: Chapín ─────────
  if (ast && r.chapin !== null) {
    add({
      fase: "chapin", vista: "chapin", titulo: "Fase 4 · Traducción a Chapín",
      texto: "Con el AST validado, el traductor lo recorre y escribe el mismo programa en Chapín, el dialecto guatemalteco del grupo. Como el AST no guarda paréntesis, los vuelve a poner donde la precedencia lo exige.",
      detalle: ["splice adam/eve → va pisto/quetzal", "atlas/ryan → cabal/sino", "vita → brega", "radio → clavar, diary → shute"],
      chapinHasta: 0,
    });
    let acum = 0;
    for (const s of ast.items) {
      const out = chapinInstruccion(s);
      const nl = out.split("\n").length - 1;
      const rg = tokensDe(s);
      add({
        fase: "chapin", vista: "chapin", titulo: `Línea ${s.line}: ${resumenNodo(s)}`,
        texto: `Se traduce a: ${q(out.split("\n")[0].trim())}${nl > 1 ? " …" : ""}`,
        lineas: rg ? lineasDe(rg[0], rg[1]) : [s.line], tokens: rg ? rango(rg[0], rg[1]) : [],
        chapinHasta: acum + nl, chapinResaltar: rango(acum, acum + nl - 1),
      });
      acum += nl;
    }
  }

  add({
    fase: "fin", vista: "pipeline", tono: "ok", titulo: "Programa VÁLIDO",
    texto: `Todas las fases pasaron: ${cuenta(toks.length, "token", "tokens")}, ${cuenta(ast?.items.length ?? 0, "instrucción", "instrucciones")}, ${cuenta(sem.symbols.length, "variable", "variables")} en el Gene Bank${sem.diags.length ? ` y ${cuenta(sem.diags.length, "advertencia", "advertencias")}` : ""}. Código de salida 0. Prueba a romperlo: quita un «;» o declara dos veces la misma variable y mira qué fase lo detecta.`,
  });
  return pasos;
}
