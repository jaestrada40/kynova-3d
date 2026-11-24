// Ejemplos: los mismos programas con los que se verificó la versión TypeScript contra el compilador en C.
import golden from "./compiler/golden.json";

export interface Ejemplo { nombre: string; titulo: string; grupo: "Válidos" | "Con errores" | "Más casos"; source: string; fase?: string }

const TITULOS: Record<string, [string, string?]> = {
  "01_demostrativo": ["Demostrativo"], "02_precedencia": ["Precedencia y asociatividad"], "03_anidado": ["Bloques anidados y alcances"],
  "04_cadenas": ["Texto con plasmid"], "05_ryan_atlas_plasmid": ["ryan atlas (else-if)"],
  "01_falta_punto_y_coma": ["Falta un «;»", "sintáctico"], "02_variable_no_declarada": ["Variable no declarada", "semántico"],
  "03_identificador_con_digito": ["Identificador que empieza con dígito", "léxico"], "04_falta_ryan": ["atlas sin ryan", "sintáctico"],
  "05_condicion_sin_parentesis": ["Condición sin paréntesis", "sintáctico"], "06_real_con_coma": ["Real con coma", "léxico"],
  "07_declaracion_duplicada": ["Declaración duplicada", "semántico"], "08_tipos_incompatibles": ["Tipos incompatibles", "semántico"],
  "09_comentario_sin_cerrar": ["Comentario sin cerrar", "léxico"], "10_relacionales_encadenados": ["Relacionales encadenados", "sintáctico"],
  "11_fuera_de_alcance": ["Variable fuera de alcance", "semántico"], "12_cadena_en_operacion": ["Cadena en una operación", "semántico"],
  "13_cadena_sin_cerrar": ["Cadena sin cerrar", "léxico"], "14_cadena_en_eve": ["Cadena en una variable eve", "semántico"],
  "15_numero_en_plasmid": ["Número en una variable plasmid", "semántico"], "16_plasmid_en_operacion": ["plasmid en una operación", "semántico"],
  "17_radio_plasmid": ["radio sobre plasmid", "semántico"], "18_cadena_en_adam": ["Cadena en una variable adam", "semántico"],
  e01_advertencias: ["Advertencias: variable sin usar y división entre cero"], e02_plasmid: ["Variables de texto"], e03_cadena_atlas: ["Cadena de ryan atlas"],
  e04_varios_errores_sintaxis: ["Varios errores de sintaxis (recuperación)", "sintáctico"], e05_parentesis: ["Paréntesis y precedencia"],
  e06_vacio: ["Programa vacío"], e07_solo_comentarios: ["Solo comentarios"], e08_errores_lexicos: ["Varios errores léxicos", "léxico"],
  e09_alcance: ["Alcances: sombra y bloques"], e10_tipos: ["Varios errores de tipos", "semántico"],
};

export const EJEMPLOS: Ejemplo[] = (golden as { nombre: string; grupo: string; source: string }[]).map((c) => {
  const [titulo, fase] = TITULOS[c.nombre] ?? [c.nombre];
  const grupo = c.grupo === "válido" ? "Válidos" : c.grupo === "inválido" ? "Con errores" : "Más casos";
  return { nombre: c.nombre, titulo, grupo, source: c.source, fase };
});
