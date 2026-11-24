import type { Vista } from "../compiler/explain.ts";
import { Stage } from "../scene/Stage.tsx";
import { useKyn, useVista } from "../state.ts";
import { Codigo } from "./Codigo.tsx";
import { Guia } from "./Guia.tsx";
import { Narracion } from "./Narracion.tsx";

const VISTAS: [Vista, string][] = [["pipeline", "Recorrido"], ["tokens", "Tokens · Flex"], ["ast", "Árbol · Bison"], ["genebank", "Gene Bank"], ["chapin", "Chapín"]];

export function App() {
  const vista = useVista();
  const setVista = useKyn((s) => s.setVista);
  const hover = useKyn((s) => s.hover);
  return (
    <div className="app">
      <header>
        <div className="marca"><b>KYNOVA</b><span>en 3D · cómo funciona un compilador</span></div>
        <nav className="seg" aria-label="Vistas">
          {VISTAS.map(([k, l]) => <button key={k} className={vista === k ? "on" : ""} onClick={() => setVista(k)}>{l}</button>)}
        </nav>
      </header>
      <main>
        <Codigo />
        <section className="escena">
          <div className="canvas"><Stage /></div>
          <div className={"hover" + (hover ? " on" : "")}>{hover ?? "Pasa el mouse sobre un token, un nodo o una variable"}</div>
          <Narracion />
        </section>
      </main>
      <Guia />
    </div>
  );
}
