// Las cinco vistas 3D: pipeline, tokens (Flex), AST (Bison), Gene Bank (tabla de símbolos) y Chapín.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Line } from "@react-three/drei";
import * as THREE from "three";
import { descripcion } from "../compiler/ast.ts";
import { significado } from "../compiler/explain.ts";
import type { Categoria } from "../compiler/lexer.ts";
import { typeName } from "../compiler/ast.ts";
import { usePaso, useKyn } from "../state.ts";
import { COLOR, COLOR_TIPO, Label } from "./common.tsx";
import { LH, etiquetaNodo, layoutAst, layoutGeneBank, layoutTokens } from "./layouts.ts";

const COLOR_CAT: Record<Categoria, string> = {
  reservada: "#d4af37", tipo: "#e08fd0", id: "#5fb8d6", numero: "#8fd694", cadena: "#c9a0ff",
  operador: "#ff9f68", relacional: "#ff7d9a", delimitador: "#8b9bb4", error: "#ff4d5e",
};

const Suelo = ({ x, z, w, d, y = -0.25 }: { x: number; z: number; w: number; d: number; y?: number }) => (
  <mesh position={[x, y, z]} receiveShadow>
    <boxGeometry args={[w, 0.3, d]} />
    <meshStandardMaterial color="#10233f" roughness={0.9} />
  </mesh>
);

function useHover() {
  const set = useKyn((s) => s.setHover);
  return (texto: string) => ({
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); set(texto); document.body.style.cursor = "help"; },
    onPointerOut: () => { set(null); document.body.style.cursor = ""; },
  });
}

// ───────── Pipeline ─────────
type Estado = "ok" | "error" | "omitido";
export function Pipeline() {
  const r = useKyn((s) => s.r);
  const paso = usePaso();
  const setVista = useKyn((s) => s.setVista);
  const lineas = r.source.length ? r.source.split("\n").length : 0;
  const nodos = (() => { let c = 0; const rec = (n: { items: unknown[]; child: unknown[] }): void => { c++; (n.items as typeof n[]).forEach(rec); (n.child as (typeof n | null)[]).forEach((x) => x && rec(x)); }; if (r.sintaxis.ast) rec(r.sintaxis.ast as never); return c; })();
  const frontales = r.lexDiags.length + r.sintaxis.diags.length > 0;
  const est: { id: string; nombre: string; sub: string; estado: Estado; fase: string; vista: "tokens" | "ast" | "genebank" | "chapin" }[] = [
    { id: "src", nombre: "Código .kyn", sub: `${lineas} líneas`, estado: "ok", fase: "intro", vista: "tokens" },
    { id: "flex", nombre: "Flex", sub: `${r.tokens.length - 1} tokens`, estado: r.lexDiags.length ? "error" : "ok", fase: "lex", vista: "tokens" },
    { id: "bison", nombre: "Bison", sub: `${nodos} nodos AST`, estado: r.sintaxis.diags.length ? "error" : "ok", fase: "sin", vista: "ast" },
    { id: "gene", nombre: "Gene Bank", sub: r.sem ? `${r.sem.symbols.length} variables` : "no se ejecuta", estado: !r.sem ? "omitido" : r.sem.errores ? "error" : "ok", fase: "sem", vista: "genebank" },
    { id: "chapin", nombre: "Chapín", sub: r.chapin !== null ? `${r.chapin.split("\n").length - 1} líneas` : "no se ejecuta", estado: r.chapin === null ? "omitido" : "ok", fase: "chapin", vista: "chapin" },
  ];
  void frontales;
  return (
    <group>
      <Suelo x={0} z={0} w={44} d={9} />
      {est.map((e, i) => {
        const x = (i - 2) * 9.5;
        const activo = paso.fase === e.fase || paso.fase === "fin";
        const color = e.estado === "error" ? COLOR.error : e.estado === "omitido" ? "#44546b" : COLOR.oro;
        return (
          <group key={e.id} position={[x, 0, 0]}>
            <mesh position={[0, 1.4, 0]} castShadow
              onClick={(ev) => { ev.stopPropagation(); if (ev.delta < 6) setVista(e.vista); }}
              onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
              {i === 0 ? <boxGeometry args={[4.2, 2.8, 3]} /> : i === 1 ? <cylinderGeometry args={[1.9, 2.1, 2.8, 6]} /> : i === 2 ? <coneGeometry args={[2.3, 3.2, 4]} /> : i === 3 ? <cylinderGeometry args={[1.8, 1.8, 2.8, 24]} /> : <boxGeometry args={[4.2, 2.8, 1.2]} />}
              <meshStandardMaterial color={e.estado === "omitido" ? "#26364d" : "#1c3353"} roughness={0.5} metalness={0.3} emissive={color} emissiveIntensity={activo && e.estado !== "omitido" ? 0.65 : 0.12} />
            </mesh>
            <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
              <ringGeometry args={[2.6, 2.85, 40]} />
              <meshBasicMaterial color={color} transparent opacity={activo ? 1 : 0.5} />
            </mesh>
            <Billboard position={[0, 4, 0]}><Label size={0.62} color={color}>{e.nombre}</Label></Billboard>
            <Billboard position={[0, 0.5, 3.4]}><Label size={0.4} color={e.estado === "error" ? COLOR.error : COLOR.crema}>{`${e.estado === "ok" ? "✓ " : e.estado === "error" ? "✗ " : "— "}${e.sub}`}</Label></Billboard>
          </group>
        );
      })}
      {est.slice(0, -1).map((e, i) => {
        const omit = est[i + 1].estado === "omitido";
        return <Banda key={e.id} x0={(i - 2) * 9.5 + 2.9} x1={(i - 1) * 9.5 - 2.9} omitida={omit} />;
      })}
    </group>
  );
}

function Banda({ x0, x1, omitida }: { x0: number; x1: number; omitida: boolean }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, k) => { if (m) m.position.x = x0 + ((((clock.elapsedTime * 0.6 + k / 4) % 1) + 1) % 1) * (x1 - x0); });
  });
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, 0.15, 0]}>
        <boxGeometry args={[x1 - x0, 0.2, 0.9]} />
        <meshStandardMaterial color={omitida ? "#26364d" : "#2a4a78"} />
      </mesh>
      {!omitida && [0, 1, 2, 3].map((k) => (
        <mesh key={k} ref={(m) => { refs.current[k] = m; }} position={[x0, 0.6, 0]}>
          <sphereGeometry args={[0.22, 12, 10]} />
          <meshBasicMaterial color={COLOR.oro} />
        </mesh>
      ))}
    </group>
  );
}

// ───────── Tokens (Flex) ─────────
export function Tokens() {
  const r = useKyn((s) => s.r);
  const paso = usePaso();
  const L = useMemo(() => layoutTokens(r), [r]);
  const hover = useHover();
  const res = new Set(paso.tokens);
  const hay = res.size > 0;
  const hasta = paso.tokensHasta ?? Infinity;
  return (
    <group>
      <Suelo x={L.ancho / 2} z={((L.lineas - 1) * LH) / 2} w={L.ancho + 5} d={L.lineas * LH + 2} />
      {Array.from({ length: L.lineas }, (_, i) => (
        <group key={i} position={[-1.1, 0.02, i * LH]} rotation-x={-Math.PI / 2}>
          <Label size={0.42} color={paso.lineas.includes(i + 1) ? COLOR.oro : "#5c708f"}>{String(i + 1)}</Label>
        </group>
      ))}
      {L.cajas.map(({ t, x, z, w, cat }) => {
        if (t.index > hasta) return null;
        const on = res.has(t.index);
        const c = COLOR_CAT[cat];
        return (
          <group key={t.index} position={[x, 0, z]}>
            <mesh position={[0, on ? 0.5 : 0.28, 0]} castShadow {...hover(`${t.text}  →  ${t.name}: ${significado(t)}${t.bad ? "  (con error léxico)" : ""}`)}>
              <boxGeometry args={[w - 0.06, on ? 0.9 : 0.5, 0.95]} />
              <meshStandardMaterial color={c} roughness={0.45} emissive={c} emissiveIntensity={on ? 0.7 : hay ? 0.04 : 0.16} transparent opacity={hay && !on ? 0.5 : 1} />
            </mesh>
            <group position={[0, on ? 1.0 : 0.6, 0]} rotation-x={-Math.PI / 2}>
              <Label size={0.36} color="#0a1628" maxWidth={w}>{t.text.length > 14 ? t.text.slice(0, 13) + "…" : t.text}</Label>
            </group>
          </group>
        );
      })}
    </group>
  );
}

// ───────── AST (Bison) ─────────
const FORMA_COLOR = (k: string) => (k === "program" || k === "block" ? COLOR.azul : ["decl", "assign", "read", "write", "if", "while"].includes(k) ? COLOR.oro : k === "relop" ? "#ff9f68" : k === "binop" ? COLOR.crema : k === "id" ? "#5fb8d6" : "#8fd694");
export function Ast() {
  const r = useKyn((s) => s.r);
  const paso = usePaso();
  const L = useMemo(() => layoutAst(r.sintaxis.ast), [r]);
  const hover = useHover();
  const res = new Set(paso.nodos);
  const hay = res.size > 0;
  const hasta = paso.nodosHasta ?? Infinity;
  const vis = (id: number) => id < hasta;
  if (!r.sintaxis.ast) return <Billboard position={[0, 0, 0]}><Label size={0.6} color={COLOR.error}>Sin árbol: Bison no pudo recuperarse de los errores</Label></Billboard>;
  return (
    <group>
      {L.aristas.filter((a) => vis(a.a.n.id) && vis(a.de.n.id)).map((a) => (
        <group key={a.a.n.id}>
          <Line points={[[a.de.x, a.de.y - 0.4, 0], [a.a.x, a.a.y + 0.4, 0]]} color={res.has(a.a.n.id) ? COLOR.oro : "#4f6a93"} lineWidth={res.has(a.a.n.id) ? 2.8 : 1.4} />
          {a.etiqueta && <Billboard position={[(a.de.x + a.a.x) / 2, (a.de.y + a.a.y) / 2, 0.2]}><Label size={0.3} color="#9db3d6">{a.etiqueta}</Label></Billboard>}
        </group>
      ))}
      {L.nodos.filter((k) => vis(k.n.id)).map(({ n, x, y }) => {
        const on = res.has(n.id);
        const c = FORMA_COLOR(n.kind);
        const sentencia = ["decl", "assign", "read", "write", "if", "while"].includes(n.kind);
        const bloque = n.kind === "program" || n.kind === "block";
        return (
          <group key={n.id} position={[x, y, 0]} scale={on ? 1.22 : 1}>
            <mesh castShadow {...hover(descripcion(n))}>
              {sentencia ? <boxGeometry args={[2.1, 0.95, 0.7]} /> : bloque ? <boxGeometry args={[2, 0.55, 0.6]} /> : n.kind === "relop" ? <octahedronGeometry args={[0.65]} /> : <sphereGeometry args={[n.kind === "binop" ? 0.55 : 0.45, 18, 14]} />}
              <meshStandardMaterial color={c} roughness={0.45} emissive={c} emissiveIntensity={on ? 0.8 : hay ? 0.03 : 0.14} transparent opacity={hay && !on ? 0.55 : 1} />
            </mesh>
            <Billboard position={[0, -0.95, 0.5]}><Label size={0.34} color={on ? COLOR.oro : COLOR.crema}>{etiquetaNodo(n)}</Label></Billboard>
          </group>
        );
      })}
    </group>
  );
}

// ───────── Gene Bank (tabla de símbolos) ─────────
export function GeneBank() {
  const r = useKyn((s) => s.r);
  const paso = usePaso();
  const L = useMemo(() => layoutGeneBank(r), [r]);
  const hover = useHover();
  const res = new Set(paso.simbolos);
  const hasta = paso.simbolosHasta ?? Infinity;
  const syms = r.sem?.symbols ?? [];
  if (!r.sem) return <Billboard position={[0, 1, 0]}><Label size={0.6} color={COLOR.aviso}>{"El Gene Bank no se llenó:\nhay errores léxicos o sintácticos"}</Label></Billboard>;
  return (
    <group>
      {L.salas.map((s) => (
        <group key={s.scopeId}>
          <mesh position={[s.x, s.y - 0.2, 0]} receiveShadow>
            <boxGeometry args={[s.w, 0.4, 3.6]} />
            <meshStandardMaterial color="#1c3353" roughness={0.7} />
          </mesh>
          <group position={[s.x, s.y + 0.02, 1.4]} rotation-x={-Math.PI / 2}>
            <Label size={0.38} color="#9db3d6">{s.nivel === 0 ? "alcance global" : `bloque #${s.scopeId} · nivel ${s.nivel}`}</Label>
          </group>
          {s.padre !== null && (() => { const p = L.salas.find((x) => x.scopeId === s.padre); return p ? <Line points={[[p.x, p.y + 0.1, -1.4], [s.x, s.y + 0.1, -1.4]]} color="#4f6a93" lineWidth={1.2} dashed dashSize={0.3} gapSize={0.2} /> : null; })()}
        </group>
      ))}
      {syms.map((sy) => {
        if (sy.index >= hasta) return null;
        const p = L.pos.get(sy.index)!;
        const on = res.has(sy.index);
        const c = COLOR_TIPO[sy.type];
        const h = 1 + sy.uses * 0.35;
        return (
          <group key={sy.index} position={[p.x, p.y, p.z]} scale={on ? 1.15 : 1}>
            <mesh position={[0, h / 2, 0]} castShadow {...hover(`${sy.name}: ${typeName(sy.type)} · declarada en la línea ${sy.line} · ${sy.uses} uso(s)`)}>
              <cylinderGeometry args={[0.7, 0.7, h, 24]} />
              <meshStandardMaterial color={c} roughness={0.25} transparent opacity={0.85} emissive={c} emissiveIntensity={on ? 0.85 : 0.2} />
            </mesh>
            <Billboard position={[0, h + 0.75, 0]}><Label size={0.46} color={on ? COLOR.oro : COLOR.crema}>{sy.name}</Label></Billboard>
            <group position={[0, 0.03, 1.15]} rotation-x={-Math.PI / 2}><Label size={0.3} color={c}>{`${typeName(sy.type)} · l.${sy.line} · ${sy.uses}×`}</Label></group>
          </group>
        );
      })}
      {!syms.length && <Billboard position={[0, 1, 0]}><Label size={0.55} color="#9db3d6">(sin variables declaradas)</Label></Billboard>}
    </group>
  );
}

// ───────── Chapín ─────────
export function Chapin() {
  const r = useKyn((s) => s.r);
  const paso = usePaso();
  const kyn = r.source.split("\n");
  const gt = (r.chapin ?? "").split("\n").slice(0, -1);
  const hasta = paso.chapinHasta ?? gt.length;
  const resK = new Set(paso.lineas);
  const resG = new Set(paso.chapinResaltar ?? []);
  const alto = Math.max(kyn.length, gt.length);
  const dy = 1.05;
  return (
    <group>
      {[[-12.6, "Kynova (entrada)", COLOR.oro], [12.6, "Chapín (salida)", COLOR.ok]].map(([x, nombre, c]) => (
        <group key={String(nombre)} position={[x as number, 0, 0]}>
          <mesh position={[0, -((alto - 1) * dy) / 2, -0.3]}><boxGeometry args={[23, alto * dy + 2.4, 0.2]} /><meshStandardMaterial color="#10233f" /></mesh>
          <Label size={0.8} color={c as string} position={[0, 1.2, 0]}>{nombre as string}</Label>
        </group>
      ))}
      {kyn.map((l, i) => (
        <group key={"k" + i} position={[-23.6, -i * dy, 0]}>
          {resK.has(i + 1) && <mesh position={[11.5, 0, -0.15]}><planeGeometry args={[22, dy * 0.92]} /><meshBasicMaterial color={COLOR.oro} transparent opacity={0.28} /></mesh>}
          <Label size={0.42} anchor="left" color="#5c708f" position={[0.2, 0, 0]}>{String(i + 1)}</Label>
          <Label size={0.5} anchor="left" position={[1.7, 0, 0]} maxWidth={20}>{l || " "}</Label>
        </group>
      ))}
      {r.chapin === null ? (
        <Label size={0.5} color={COLOR.aviso} position={[12.6, -2, 0]}>{"Sin traducción:\nel programa tiene errores"}</Label>
      ) : gt.slice(0, hasta).map((l, i) => (
        <group key={"g" + i} position={[1.4, -i * dy, 0]}>
          {resG.has(i) && <mesh position={[11.5, 0, -0.15]}><planeGeometry args={[22, dy * 0.92]} /><meshBasicMaterial color={COLOR.ok} transparent opacity={0.25} /></mesh>}
          <Label size={0.5} anchor="left" position={[0.4, 0, 0]} maxWidth={20.5}>{l || " "}</Label>
        </group>
      ))}
    </group>
  );
}
