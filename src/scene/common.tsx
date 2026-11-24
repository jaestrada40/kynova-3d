import { Text } from "@react-three/drei";
import font from "@fontsource/inter/files/inter-latin-600-normal.woff?url";

export const COLOR = {
  oro: "#d4af37", crema: "#f3e9d2", navy: "#0b1a2e", navy2: "#1c3353", azul: "#3a6ea5",
  adam: "#4aa8ff", eve: "#ff6fb1", plasmid: "#5fd6a0", error: "#ff4d5e", aviso: "#f2b84b", ok: "#5fd6a0",
};
export const COLOR_TIPO = { adam: COLOR.adam, eve: COLOR.eve, plasmid: COLOR.plasmid, unknown: "#8b9bb4" } as const;

/** Texto 3D con fuente local (no necesita internet). */
export function Label(p: { children: string; size?: number; color?: string; position?: [number, number, number]; maxWidth?: number; anchor?: "center" | "left" }) {
  return (
    <Text
      font={font}
      fontSize={p.size ?? 0.5}
      color={p.color ?? COLOR.crema}
      position={p.position}
      maxWidth={p.maxWidth}
      textAlign={p.anchor === "left" ? "left" : "center"}
      anchorX={p.anchor === "left" ? "left" : "center"}
      anchorY="middle"
      lineHeight={1.1}
      outlineWidth={0.025}
      outlineColor="#0a1628"
    >
      {p.children}
    </Text>
  );
}
