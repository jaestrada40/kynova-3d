import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import type { CameraControls as CC } from "@react-three/drei";
import type { Vista } from "../compiler/explain.ts";
import { useKyn, usePaso, useVista } from "../state.ts";
import { Ast, Chapin, GeneBank, Pipeline, Tokens } from "./Escenas.tsx";
import { cajaDe, layoutAst, layoutGeneBank, layoutTokens, type Caja } from "./layouts.ts";

const ELEV: Record<Vista, number> = { pipeline: 26, tokens: 58, ast: 6, genebank: 24, chapin: 0 };
const TAN = Math.tan((40 / 2) * (Math.PI / 180));

/** Si la escena es muy ancha, la cámara sigue lo que se está explicando. */
function cajaFoco(vista: Vista, r: ReturnType<typeof useKyn.getState>["r"], paso: ReturnType<typeof usePaso>, g: Caja): Caja {
  if (g.w <= 26 && !(vista === "tokens" && g.h > 14) && vista !== "chapin") return g;
  if (vista === "chapin") {
    const ys = [...paso.lineas.map((l) => -(l - 1) * 1.05), ...(paso.chapinResaltar ?? []).map((i) => -i * 1.05)];
    if (!ys.length || g.h < 12) return g;
    const a = Math.min(...ys), b = Math.max(...ys);
    return { cx: 0, cy: (a + b) / 2, cz: 0, w: 49, h: Math.max(b - a + 8, 11) };
  }
  const pts: { x: number; y: number; z: number }[] = [];
  if (vista === "tokens") { const L = layoutTokens(r); const s = new Set(paso.tokens); L.cajas.filter((c) => s.has(c.t.index)).forEach((c) => pts.push({ x: c.x, y: 0, z: c.z })); }
  else if (vista === "ast") { const L = layoutAst(r.sintaxis.ast); const s = new Set(paso.nodos); L.nodos.filter((n) => s.has(n.n.id)).forEach((n) => pts.push({ x: n.x, y: n.y, z: 0 })); }
  else if (vista === "genebank") { const L = layoutGeneBank(r); paso.simbolos.forEach((i) => { const p = L.pos.get(i); if (p) pts.push(p); }); }
  if (!pts.length) return g;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), zs = pts.map((p) => p.z);
  const w = Math.max(Math.max(...xs) - Math.min(...xs) + 10, vista === "tokens" ? 22 : 20);
  return { cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2, cz: (Math.max(...zs) + Math.min(...zs)) / 2, w, h: Math.min(g.h, Math.max(w * 0.6, 12)) };
}

function Rig() {
  const ref = useRef<CC>(null);
  const vista = useVista();
  const r = useKyn((s) => s.r);
  const paso = usePaso();
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const plegada = useKyn((s) => s.plegada);
  const g = useMemo(() => cajaDe(vista, r), [vista, r]);
  useEffect(() => {
    const c = cajaFoco(vista, r, paso, g);
    // La narración ocupa la parte baja: la escena se ajusta al espacio libre de arriba.
    const libre = plegada ? 0.82 : 0.56;
    const dist = Math.max(c.h / (2 * TAN * libre), c.w / (2 * TAN * aspect)) * 1.08 + 2;
    const e = (ELEV[vista] * Math.PI) / 180;
    // La narración tapa la parte baja: se desplaza el objetivo para que la escena quede en la parte alta.
    const off = (1 - libre) * dist * TAN;
    const ty = c.cy - off * Math.cos(e), tz = c.cz + off * Math.sin(e);
    ref.current?.setLookAt(c.cx, ty + dist * Math.sin(e), tz + dist * Math.cos(e), c.cx, ty, tz, true);
  }, [vista, r, paso, g, aspect, plegada]);
  return <CameraControls ref={ref} makeDefault minDistance={4} maxDistance={140} smoothTime={0.45} />;
}

function Contenido() {
  const v = useVista();
  return v === "pipeline" ? <Pipeline /> : v === "tokens" ? <Tokens /> : v === "ast" ? <Ast /> : v === "genebank" ? <GeneBank /> : <Chapin />;
}

export function Stage() {
  return (
    <Canvas shadows="percentage" dpr={[1, 2]} camera={{ position: [0, 24, 30], fov: 40, near: 0.3, far: 400 }}>
      <color attach="background" args={["#0a1628"]} />
      <fog attach="fog" args={["#0a1628", 90, 220]} />
      <hemisphereLight args={["#cfe0ff", "#14243e", 1.0]} />
      <directionalLight position={[16, 30, 20]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} shadow-camera-far={140} shadow-bias={-0.0004} />
      <Contenido />
      <Rig />
    </Canvas>
  );
}
