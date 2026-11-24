import { useMemo } from "react";
import { categoria } from "../compiler/lexer.ts";
import { EJEMPLOS } from "../examples.ts";
import { useKyn, usePaso } from "../state.ts";

/** Código fuente con colores por tipo de token y resaltado de lo que se está explicando. */
function Resaltado() {
  const r = useKyn((s) => s.r);
  const paso = usePaso();
  const lineas = useMemo(() => {
    const src = r.source;
    const cls: string[] = new Array(src.length).fill("");
    for (const t of r.tokens) for (let i = t.start; i < t.end; i++) cls[i] = "t-" + categoria(t.code, t.bad);
    // comentarios: el resto que empiece con // o /*
    const re = /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/g;
    for (let m; (m = re.exec(src)); ) for (let i = m.index; i < m.index + m[0].length; i++) if (!cls[i]) cls[i] = "t-comentario";
    for (const d of [...r.lexDiags, ...r.sintaxis.diags]) if (d.start !== undefined) for (let i = d.start; i < (d.end ?? d.start + 1); i++) cls[i] += " err";
    const res = new Set(paso.tokens);
    for (const t of r.tokens) if (res.has(t.index)) for (let i = t.start; i < t.end; i++) cls[i] += " hl";
    const out: { n: number; segs: { txt: string; c: string }[] }[] = [];
    let ini = 0;
    src.split("\n").forEach((txt, k) => {
      const segs: { txt: string; c: string }[] = [];
      for (let i = 0; i < txt.length; i++) {
        const c = cls[ini + i];
        if (segs.length && segs[segs.length - 1].c === c) segs[segs.length - 1].txt += txt[i]; else segs.push({ txt: txt[i], c });
      }
      out.push({ n: k + 1, segs });
      ini += txt.length + 1;
    });
    return out;
  }, [r, paso.tokens]);
  const act = new Set(paso.lineas);
  return (
    <pre className="codigo">
      {lineas.map((l) => (
        <div key={l.n} className={"ln" + (act.has(l.n) ? " on" : "")}>
          <span className="num">{l.n}</span>
          <span className="txt">{l.segs.length ? l.segs.map((s, i) => <span key={i} className={s.c}>{s.txt}</span>) : " "}</span>
        </div>
      ))}
    </pre>
  );
}

export function Codigo() {
  const { src, ejemplo, r, editando, setEditando, setSrc, cargar, setGuia, pasos, ir } = useKyn();
  const grupos = ["Válidos", "Con errores", "Más casos"] as const;
  const nErr = r.lexDiags.length + r.sintaxis.diags.length + (r.sem?.errores ?? 0);
  const nAdv = (r.sem?.diags.length ?? 0) - (r.sem?.errores ?? 0);
  const irA = (linea: number, col: number) => {
    const k = pasos.findIndex((p) => p.tono !== "info" && p.titulo.includes(`${linea}:${col}`));
    if (k >= 0) ir(k);
  };
  return (
    <section className="panel-codigo">
      <div className="barra">
        <select value={ejemplo ?? ""} onChange={(e) => cargar(e.target.value)} aria-label="Elegir un ejemplo">
          {ejemplo === null && <option value="">Programa propio</option>}
          {grupos.map((g) => (
            <optgroup key={g} label={g}>
              {EJEMPLOS.filter((e) => e.grupo === g).map((e) => <option key={e.nombre} value={e.nombre}>{e.titulo}{e.fase ? ` — ${e.fase}` : ""}</option>)}
            </optgroup>
          ))}
        </select>
        <button className={editando ? "on" : ""} onClick={() => setEditando(!editando)}>{editando ? "✓ Listo" : "✎ Editar"}</button>
        <button onClick={() => setGuia(true)}>? Lenguaje</button>
      </div>
      {editando ? (
        <textarea className="editor" value={src} spellCheck={false} onChange={(e) => setSrc(e.target.value, null)} aria-label="Código Kynova" />
      ) : <div className="scroll-codigo"><Resaltado /></div>}
      <div className={"resultado " + (r.valido ? "ok" : "mal")}>
        <b>{r.valido ? "✓ Programa VÁLIDO" : "✗ Programa INVÁLIDO"}</b>
        <span>{r.valido ? `código de salida 0${nAdv ? ` · ${nAdv} advertencia(s)` : ""}` : `código de salida 1 · ${nErr} error(es)`}</span>
      </div>
      {r.diags.length > 0 && (
        <ul className="diags">
          {r.diags.slice(0, 12).map((d, i) => (
            <li key={i} className={d.nivel} onClick={() => irA(d.line, d.col)} title="Ver la explicación">
              <b>{d.line}:{d.col}</b> <i>{d.nivel === "advertencia" ? "advertencia" : d.fase}</i> {d.msg}
            </li>
          ))}
          {r.diags.length > 12 && <li className="mas">… y {r.diags.length - 12} más</li>}
        </ul>
      )}
    </section>
  );
}
