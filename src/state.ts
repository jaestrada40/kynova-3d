import { create } from "zustand";
import { compilar, type Resultado } from "./compiler/compile.ts";
import { explicar, type Paso, type Vista } from "./compiler/explain.ts";
import { EJEMPLOS } from "./examples.ts";

interface K {
  src: string;
  ejemplo: string | null;
  r: Resultado;
  pasos: Paso[];
  i: number;
  playing: boolean;
  vel: number;
  voz: boolean;
  vistaManual: Vista | null;
  editando: boolean;
  guia: boolean;
  hover: string | null;
  plegada: boolean;
  setPlegada: (v: boolean) => void;
  setHover: (t: string | null) => void;
  setSrc: (src: string, ejemplo?: string | null) => void;
  cargar: (nombre: string) => void;
  ir: (i: number) => void;
  sig: () => void;
  ant: () => void;
  toggle: () => void;
  setVel: (v: number) => void;
  setVoz: (v: boolean) => void;
  setVista: (v: Vista | null) => void;
  setEditando: (v: boolean) => void;
  setGuia: (v: boolean) => void;
}

const inicial = EJEMPLOS.find((e) => e.nombre === "01_demostrativo") ?? EJEMPLOS[0];
const calcular = (src: string) => { const r = compilar(src); return { r, pasos: explicar(r) }; };

export const useKyn = create<K>((set, get) => ({
  src: inicial.source,
  ejemplo: inicial.nombre,
  ...calcular(inicial.source),
  i: 0,
  playing: false,
  vel: 1,
  voz: false,
  vistaManual: null,
  editando: false,
  guia: false,
  hover: null,
  plegada: false,
  setPlegada: (plegada) => set({ plegada }),
  setHover: (hover) => set({ hover }),
  setSrc: (src, ejemplo = null) => set({ src, ejemplo, ...calcular(src), i: 0, playing: false, vistaManual: null }),
  cargar: (nombre) => {
    const e = EJEMPLOS.find((x) => x.nombre === nombre);
    if (e) set({ src: e.source, ejemplo: e.nombre, ...calcular(e.source), i: 0, playing: false, vistaManual: null, editando: false });
  },
  ir: (i) => set((s) => ({ i: Math.min(Math.max(i, 0), s.pasos.length - 1), vistaManual: null })),
  sig: () => { const s = get(); if (s.i < s.pasos.length - 1) set({ i: s.i + 1, vistaManual: null }); else set({ playing: false }); },
  ant: () => set((s) => ({ i: Math.max(0, s.i - 1), vistaManual: null })),
  toggle: () => set((s) => (s.playing ? { playing: false } : { playing: true, i: s.i >= s.pasos.length - 1 ? 0 : s.i, vistaManual: null })),
  setVel: (vel) => set({ vel }),
  setVoz: (voz) => set({ voz }),
  setVista: (vistaManual) => set({ vistaManual }),
  setEditando: (editando) => set({ editando, playing: false }),
  setGuia: (guia) => set({ guia }),
}));

export const useVista = (): Vista => useKyn((s) => s.vistaManual ?? s.pasos[s.i]?.vista ?? "pipeline");
export const usePaso = (): Paso => useKyn((s) => s.pasos[s.i]);
