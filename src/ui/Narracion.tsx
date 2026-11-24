import { useEffect } from "react";
import type { Fase } from "../compiler/explain.ts";
import { useKyn, usePaso } from "../state.ts";

const FASES: [Fase, string][] = [["intro", "Intro"], ["lex", "1 · Flex"], ["sin", "2 · Bison"], ["sem", "3 · Gene Bank"], ["chapin", "4 · Chapín"], ["fin", "Fin"]];
const VELOCIDADES = [0.6, 1, 1.5, 2.5];

const limpiar = (s: string) => s.replace(/[«»]/g, "").replace(/→/g, "").replace(/\s+/g, " ");

export function Narracion() {
  const { pasos, i, playing, vel, voz, toggle, sig, ant, ir, setVel, setVoz } = useKyn();
  const paso = usePaso();
  const plegada = useKyn((s) => s.plegada);
  const setPlegada = useKyn((s) => s.setPlegada);
  const hablaDisponible = typeof window !== "undefined" && "speechSynthesis" in window;

  // Avance automático: con voz espera a que termine de hablar; sin voz, según el largo del texto.
  useEffect(() => {
    if (!playing) { if (hablaDisponible) window.speechSynthesis.cancel(); return; }
    const hablado = limpiar([paso.titulo, paso.texto, ...(paso.tono !== "info" ? paso.detalle.slice(0, 2) : [])].join(". "));
    if (voz && hablaDisponible) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(hablado);
      u.lang = "es-MX";
      const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith("es"));
      if (v) u.voice = v;
      u.rate = 0.95 * Math.min(vel, 1.8);
      let vivo = true;
      u.onend = () => { if (vivo) useKyn.getState().sig(); };
      u.onerror = () => { if (vivo) useKyn.getState().sig(); };
      window.speechSynthesis.speak(u);
      return () => { vivo = false; window.speechSynthesis.cancel(); };
    }
    const ms = Math.max(3200, (paso.texto.length + paso.detalle.join(" ").length * 0.6) * 55) / vel;
    const t = setTimeout(() => useKyn.getState().sig(), ms);
    return () => clearTimeout(t);
  }, [playing, i, voz, vel, paso, hablaDisponible]);

  const primero = (f: Fase) => pasos.findIndex((p) => p.fase === f);
  const hay = (f: Fase) => primero(f) >= 0;
  return (
    <section className={"narracion " + paso.tono} aria-live="polite">
      <div className="fases">
        {FASES.filter(([f]) => hay(f)).map(([f, n]) => (
          <button key={f} className={paso.fase === f ? "on" : ""} onClick={() => ir(primero(f))}>{n}</button>
        ))}
        <span className="cuenta">Paso {i + 1} de {pasos.length}</span>
        <button className="plegar" onClick={() => setPlegada(!plegada)} aria-label={plegada ? "Mostrar el texto" : "Ocultar el texto"} title={plegada ? "Mostrar el texto" : "Ocultar el texto"}>{plegada ? "▴" : "▾"}</button>
      </div>
      <div className="progreso"><i style={{ width: ((i + 1) / pasos.length) * 100 + "%" }} /></div>
      {!plegada && <>
      <h3>{paso.tono === "error" ? "✗ " : paso.tono === "aviso" ? "⚠ " : paso.tono === "ok" ? "✓ " : ""}{paso.titulo}</h3>
      <p>{paso.texto}</p>
      {paso.detalle.length > 0 && <ul>{paso.detalle.map((d, k) => <li key={k}>{d}</li>)}</ul>}
      </>}
      <div className="controles">
        <button onClick={() => ir(0)} title="Al principio" aria-label="Al principio">⏮</button>
        <button onClick={ant} disabled={i === 0} aria-label="Paso anterior">◀</button>
        <button className="play" onClick={toggle}>{playing ? "⏸ Pausar" : i >= pasos.length - 1 ? "↻ Repetir explicación" : "▶ Explicar todo"}</button>
        <button onClick={sig} disabled={i >= pasos.length - 1} aria-label="Paso siguiente">▶</button>
        <button onClick={() => ir(pasos.length - 1)} title="Al final" aria-label="Al final">⏭</button>
        <span className="sep" />
        <label className="vel">Velocidad
          <select value={vel} onChange={(e) => setVel(Number(e.target.value))}>{VELOCIDADES.map((v) => <option key={v} value={v}>{v}×</option>)}</select>
        </label>
        {hablaDisponible && <button className={voz ? "on" : ""} onClick={() => setVoz(!voz)} title="Narrar en voz alta">🔊 Voz {voz ? "sí" : "no"}</button>}
      </div>
    </section>
  );
}
