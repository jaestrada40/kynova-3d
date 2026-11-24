# Kynova en 3D · cómo funciona un compilador

Visualización 3D interactiva del front-end del compilador de **Kynova 1.0 «Rapture Edition»**, el lenguaje educativo del curso de Compiladores (repositorio original en C con Flex y Bison: `ElChaviSPG/kynova`). Escribes o eliges un programa `.kyn` y la página te lo **explica sola**, fase por fase, con animación 3D y narración.

```
Archivo .kyn → Flex (tokens) → Bison (AST) → Gene Bank (tabla de símbolos) → traducción a Chapín
```

## Cómo correrlo

Requiere Node.js 22 o superior (solo para el comando de pruebas hace falta Node con soporte nativo de TypeScript, como Node 22.18+ o 24+).

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # compara esta versión contra el compilador real en C
npm run build    # revisa tipos y compila a dist/
```

## Qué hace

- **▶ Explicar todo:** narración automática paso a paso (unos 26 pasos en un programa típico). La cámara se mueve sola, resalta en el código y en la escena lo que se está explicando, y puedes pausar, retroceder, cambiar la velocidad o activar la **voz** (síntesis de voz del navegador).
- **Se explica TU programa**, no un ejemplo fijo: cada paso sale de lo que realmente hizo el compilador (los tokens que reconoció Flex, las reducciones de Bison, las operaciones del Gene Bank, la traducción). Si cambias el código, la explicación se rehace al instante.
- **Cinco vistas 3D:** el recorrido completo (con estado ✓/✗ de cada fase), los **tokens** como bloques de colores, el **árbol AST** que se va construyendo, el **Gene Bank** (variables como frascos, alcances como niveles) y la traducción a **Chapín** lado a lado.
- **Errores explicados:** cada error léxico, sintáctico o semántico indica en qué fase se detecta, por qué, y qué hace Bison para recuperarse y seguir buscando más.
- **33 ejemplos** (válidos, con un error de cada tipo, y casos extra como advertencias, alcances o recuperación de errores) y un editor propio.
- Pasa el mouse sobre un token, un nodo o una variable para ver qué es. El botón «? Lenguaje» resume las palabras y reglas de Kynova.

## Por qué la explicación es fiable

La página **no inventa** el comportamiento del compilador. Es una réplica en TypeScript del compilador real:

- El analizador sintáctico es el **mismo autómata LALR(1) que genera Bison**: las tablas (`src/compiler/tables.ts`) se extraen de `kynova.tab.c` con `scripts/gen-tables.mjs` y el bucle de análisis es el del esqueleto `yacc.c`. Por eso la **recuperación de errores y los mensajes «se esperaba…»** salen idénticos.
- El lexer reproduce las reglas de `kynova.l` (mayor coincidencia, prioridad de reglas, columnas).
- La semántica, la tabla de símbolos y el traductor a Chapín son ports directos de `semantic.c`, `symtab.c` y `chapin.c`.

**Verificación contra el binario en C** (en WSL, Bison 3.8.2):

| Prueba | Resultado |
|---|---|
| `npm test`: las 23 pruebas del repo original + 10 casos extra | 33 de 33 idénticos (tokens, AST, tabla de símbolos, errores, advertencias, Chapín y código de salida) |
| Fuzzing diferencial: 1,500 programas deformados al azar | 1,500 de 1,500 idénticos (267 con errores léxicos, 751 sintácticos, 287 semánticos, 278 con notas) |

Para repetirlo necesitas Linux/WSL con `gcc`, `flex`, `bison` y `make`: compila el repo original, corre `scripts/generar-casos.sh` y `scripts/fuzz-run.sh`, y compara con `scripts/make-golden.mjs` y `scripts/fuzz.mjs cmp`. Los archivos intermedios van en `_raw/` (no se versiona).

## Deploy en Coolify (VPS de Hostinger)

Es una página estática: sin base de datos ni variables de entorno. El `Dockerfile` compila con Node y sirve con nginx por el puerto 80.

1. Crea un registro **A** de un subdominio (por ejemplo `kynova.tudominio.com`) hacia la IP del VPS.
2. En Coolify: **New Resource → Repository** (si es privado, conecta tu cuenta de GitHub), este repo, rama `main`.
3. **Build Pack: Dockerfile**. Puerto: **80**.
4. En **Domains** escribe `https://kynova.tudominio.com`. Coolify emite el certificado HTTPS.
5. **Deploy**. Para actualizar: sube cambios a `main` y *Redeploy*.

Probar la imagen en local: `docker build -t kynova-3d . && docker run --rm -p 8080:80 kynova-3d`.

## Límites

- Cubre el **front-end** de Kynova (lexer, parser, semántica, Chapín). No incluye generación de código C11 ni ejecución del programa, que el repo original lista como fases futuras.
- La voz usa la síntesis del navegador: depende del sistema y del idioma instalado. No se probó el audio.
- No se probó en celulares ni en Safari/Firefox; solo en Chrome de escritorio.
- Los textos de la narración son redacción propia; los hechos salen del código fuente del compilador.
- **Declaración de uso de IA:** esta aplicación se generó con ayuda de IA (Claude Code). Si se entrega en un curso con estándar de declaración, debe declararse.

## Stack y estructura

Vite · React 19 · TypeScript · Three.js · `@react-three/fiber` · `@react-three/drei` · zustand.

```
src/compiler/   lexer, parser (tablas de Bison), AST, semántica, Chapín, explain (narración), pruebas
src/scene/      las cinco vistas 3D y su disposición
src/ui/         código, narración y guía del lenguaje
scripts/        generación de tablas, casos y fuzzing contra el compilador en C
```
