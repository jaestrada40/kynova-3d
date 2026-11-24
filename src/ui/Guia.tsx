import { useKyn } from "../state.ts";

const PALABRAS: [string, string, string, string][] = [
  ["splice", "Declara una variable (en BioShock, «empalmar» ADN)", "splice adam edad;", "va"],
  ["adam", "Tipo entero → int en C", "splice adam vidas = 3;", "pisto"],
  ["eve", "Tipo real con decimales → double en C", "splice eve puntos = 0.5;", "quetzal"],
  ["plasmid", "Tipo texto → cadena entre comillas", "splice plasmid nombre = \"Jack\";", "(sin tipo)"],
  ["radio", "Lee un valor del teclado", "radio(edad);", "clavar"],
  ["diary", "Escribe un valor en pantalla", "diary(edad + 1);", "shute"],
  ["atlas", "Condicional (if) — siempre lleva su ryan", "atlas (edad >= 18) { … } ryan { … }", "cabal"],
  ["ryan", "Rama alternativa (else), obligatoria. «ryan atlas (…)» encadena condiciones", "ryan atlas (edad > 5) { … }", "sino"],
  ["vita", "Ciclo (while)", "vita (i < 10) { i = i + 1; }", "brega"],
];

export function Guia() {
  const { guia, setGuia } = useKyn();
  if (!guia) return null;
  return (
    <div className="modal" onClick={() => setGuia(false)} role="dialog" aria-modal="true" aria-label="Guía del lenguaje Kynova">
      <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={() => setGuia(false)} aria-label="Cerrar">×</button>
        <h2>El lenguaje Kynova 1.0 «Rapture Edition»</h2>
        <p>Un lenguaje educativo imperativo del curso de Compiladores. Sus palabras vienen de BioShock. Todo programa es una lista de instrucciones terminadas en <code>;</code>.</p>
        <table>
          <thead><tr><th>Palabra</th><th>Qué hace</th><th>Ejemplo</th><th>En Chapín</th></tr></thead>
          <tbody>{PALABRAS.map(([p, d, e, c]) => <tr key={p}><td><code>{p}</code></td><td>{d}</td><td><code>{e}</code></td><td><code>{c}</code></td></tr>)}</tbody>
        </table>
        <h3>Reglas que verás en acción</h3>
        <ul>
          <li><b>Identificadores</b>: letras, dígitos y «_», sin empezar con dígito (<code>2age</code> es un error léxico). Distinguen mayúsculas: <code>Atlas</code> no es la palabra reservada.</li>
          <li><b>Números</b>: enteros (<code>42</code>) y reales con punto (<code>3.14</code>). <code>3,14</code> y <code>3.</code> son errores léxicos.</li>
          <li><b>Operadores</b>: <code>+ - * /</code> (la multiplicación liga más fuerte) y comparaciones <code>&lt; &gt; &lt;= &gt;= == !=</code>, que solo aparecen dentro de una condición y no se encadenan.</li>
          <li><b>Comentarios</b>: <code>// de línea</code> y <code>/* de varias líneas */</code>.</li>
          <li><b>Tipos</b>: se puede asignar adam a eve, pero no eve a adam. El texto solo vive en <code>plasmid</code> y no se puede sumar ni comparar.</li>
          <li><b>Alcances</b>: cada bloque <code>{`{ }`}</code> abre un alcance; no se puede declarar dos veces el mismo nombre en el mismo alcance.</li>
        </ul>
        <h3>Cómo usar esta página</h3>
        <ul>
          <li>Pulsa <b>▶ Explicar todo</b>: la narración recorre las 4 fases con TU programa y mueve la cámara sola.</li>
          <li>Elige otro ejemplo o pulsa <b>✎ Editar</b> para escribir el tuyo: la explicación se rehace al instante.</li>
          <li>Pasa el mouse sobre un token, un nodo del árbol o una variable para ver qué es. Con las pestañas puedes mirar cualquier fase por tu cuenta.</li>
        </ul>
        <p className="muted">Esta página ejecuta una réplica en TypeScript del compilador real (Flex + Bison + C). Se comprobó contra el binario en C con 33 programas de prueba y 1,500 programas deformados al azar: misma salida, carácter por carácter.</p>
      </div>
    </div>
  );
}
