# Prompt del deck, versión 2

Nov 22, 2026 · @Tomas

Prompt para la herramienta que diseña las slides. Parte del prompt original de Gabi y agrega lo decidido el 22-11: el nombre Caudales, la frase de la portada, la apertura de 52 segundos, con el tramo de solución que sugiere la organización, y las slides de reserva como cifras. Los textos y las cifras son los mismos de [index.html](index.html), que sirve de referencia visual (se abre en el navegador). El guion hablado está en [../pitch-demo.md](../pitch-demo.md).

Pegar desde aquí:

```text
Diseña un deck de presentación para "Caudales" (Platanus Hack 26, final, track Physical World).
El deck acompaña una presentación hablada de 3 minutos. La presentación es el discurso; las
slides solo lo apoyan. Minimalista al extremo: son 4 slides y 4 de reserva.

No es un pitch de venta. No se vende un producto: se presenta la idea del proyecto y por qué
le importa a quien mira. Nada de mercado, modelo de negocio, clientes ni pedidos.

## Formato del evento
- 3:00 con corte duro, 2:00 de preguntas del jurado, 1:30 de deliberación y cambio de equipo.
- Habla una persona (Tomás); otra maneja el computador.
- El deck solo cubre la apertura (0:00–0:52) y el cierre (2:39–2:52). Entre medio se muestra
  el producto en vivo, sin slides. La última slide de apertura y la de cierre tienen que verse
  de la misma familia que el producto, para que el cambio de pantalla no se note.

## Restricciones de la sala (críticas)
1. Pantallas que saturan los blancos: TODO oscuro. Fondo casi negro, sin superficies claras,
   sin imágenes con zonas blancas grandes. Nada de blanco puro (#fff), ni siquiera en el texto.
2. El texto principal tampoco puede ser blanco brillante. Usa un gris azulado apagado
   (~#c9d3d8) para el texto principal y #8b9ba4 para el secundario. El acento cian se usa
   poco: no más de 1 elemento por slide.
3. Desde la 4ª fila hacia atrás solo se ve el TERCIO SUPERIOR de la pantalla.
   → El mensaje de cada slide (número grande o frase) va entero en el 33 % superior.
   → Los dos tercios de abajo quedan para apoyo que se puede perder sin problema
     (fuente, nota, logo, imagen atmosférica que se desvanece hacia el fondo).
   → Igual tiene que verse armónico para el jurado, que está adelante: que no parezca
     "todo pegado arriba". Usa una composición con peso arriba y respiración abajo
     (por ejemplo, un horizonte o mapa que se apaga hacia abajo y deja aire).

## Reglas de la presentación
- Una idea por slide. Menos de 7 palabras en letra grande (la portada es la excepción: dos
  frases cortas). Los títulos dan un mensaje: nunca "Problema" ni "Solución".
- Letra legible hasta la última fila y sin faltas de ortografía (guía de la organización).
- Sin jerga, siglas ni métodos (no Sentinel-2, NDVI, FAO-56), tampoco en chips ni etiquetas.
- Los números van solos, enormes y con su unidad o su base ("6 de 19", no "32 %").
  Sin exagerar: si es un mínimo, dice "al menos".
- Sin bullets, sin párrafos, sin gráficos complejos.
- Sin comparaciones de volumen con objetos (latas, edificios). La única equivalencia que se
  usa es en personas.
- Letra enorme. Si se lee en un notebook a 1 metro, está muy chica.

## Sistema visual (igual al frontend de Caudales)
Colores:
  --void   #05080b   fondo
  --deck   #0a1015   superficie
  --deep   #0b1820   gradiente radial de fondo (centro), funde a --void
  --rule   #1b2731   líneas finas
  --rule-2 #2a3a46   bordes
  --ink    #e4ebee   (en el frontend; en el deck bájalo a ~#c9d3d8 por brillo)
  --dim    #8b9ba4   texto secundario, etiquetas
  --water  #45d6ee   acento: agua / el predio / Caudales
  --loss   #ffa940   pérdida, agua sin derecho
  --crit   #ff5b3d   alerta crítica (muy poco, puntos de 6 px)
Tipografía (Google Fonts):
  Display: Archivo, peso 700–800, font-stretch 110–125 %, tracking amplio en el
           wordmark (letter-spacing .2em, MAYÚSCULAS "CAUDALES").
  Cuerpo:  IBM Plex Sans 400/500.
  Etiquetas/datos: IBM Plex Mono 400/500, MAYÚSCULAS, letter-spacing .08–.14em,
           tamaño chico, color --dim. Números con tabular-nums.
Lenguaje gráfico:
  - Esquinas rectas (border-radius 0), bordes de 1 px en --rule-2.
  - "Chips" mono en mayúsculas con borde fino, como etiquetas de instrumento
    (ej. "PETORCA · ACONCAGUA BAJO").
  - Bloque de dato: barra vertical de 2 px a la izquierda, etiqueta mono arriba,
    número grande en Archivo, una línea mono de contexto abajo.
  - Atmósfera: degradado radial --deep→--void, grano sutil (opacity ~.3, overlay),
    scrim oscuro arriba y abajo. Estética HUD satelital / cartografía nocturna.
  - Un logo SVG de gota en órbita en cian con glow suave
    (drop-shadow 0 0 8px rgba(69,214,238,.45)).

## Slides (texto exacto; la parte grande va en el tercio superior)
1. PORTADA (0:00–0:05). El orador dice: "Soy Tomás, y esto es Caudales."
   Grande: CAUDALES (wordmark) + "El agua está repartida. No todos respetan su parte."
   Abajo, tenue: silueta de Chile en líneas finas cian, que se funde al negro, con un punto
   en Petorca. Chips: PETORCA · ACONCAGUA BAJO y PLATANUS HACK 26 · PHYSICAL WORLD

2. EL PROBLEMA (0:05–0:31)
   Grande: "50 litros al día" · secundario: "40 mil personas en Petorca. El agua llega en camión."
   Tercio inferior, tenue: bloque de dato "$5.700 millones", etiqueta "EN CAMIONES ALJIBE · 2023 Y 2024"
   Fuente en mono chica: "RADIO JGM, U. DE CHILE (2020) · CONSEJO PARA LA TRANSPARENCIA (2026)"

3. LA SOLUCIÓN (0:31–0:52). Es el tramo que pide la organización: qué es, qué tan ambicioso y
   cuánto se avanzó.
   Grande: "7.911 predios" · secundario: "mirados desde el satélite y cruzados con sus derechos de agua."
   Tercio inferior, tenue: tres bloques de dato chicos en una fila.
     "160 mil"     · etiqueta: MEDICIONES DE SATÉLITE · contexto: MÁS EL CLIMA Y EL REGISTRO PÚBLICO
     "7 veranos"   · etiqueta: IMÁGENES DESDE 2019 · contexto: PARA VER QUIÉN YA REGABA ANTES
     "14 regiones" · etiqueta: DATOS BASE YA DESCARGADOS · contexto: PARA PROBARLO EN EL RESTO DE CHILE
   (Después de esta slide se cambia al producto en vivo.)

4. CIERRE (2:39–2:52). Se queda en pantalla durante las preguntas.
   Tercio superior: tres bloques de dato en una fila, con el número enorme.
     "2 años"  · etiqueta: ANTES QUE LA INSPECCIÓN, AL MENOS · contexto: CASO REAL EN HIJUELAS
     "2,6×"    · etiqueta: MÁS INFRACCIONES QUE SIN LA LISTA · contexto: 19 CASOS DE LA DGA
     "501"     · etiqueta: PREDIOS EN ALERTA, SIN FISCALIZAR · contexto: PETORCA Y ACONCAGUA BAJO
   Las barras de los bloques van en --rule-2; el único elemento cian de la slide es el logo.
   Abajo: wordmark CAUDALES, la URL "caudales.dev" en letra grande y un QR a
   https://caudales.dev con módulos oscuros (#05080b) sobre un recuadro gris azulado (#8b9ba4).
   No invertir el QR (módulos claros sobre fondo oscuro): falla en algunos teléfonos. Nunca blanco.
   Equipo en mono chico: NICOLÁS · FELIPE · GABRIELA · TOMÁS

## Slides de reserva para las preguntas (después del cierre, mismo sistema)
Cada una es una cifra con su base en el tercio superior, una frase de contexto abajo y la
fuente en mono chica. No son afirmaciones: muestran un dato.
   R1 Grande: "6 de 19" · secundario: "infractores ya multados estaban en alerta alta. Eligiendo predios al azar habrían sido 2."
      Abajo: "Prioriza, no acusa: la infracción la constata un inspector."
      Mono: "2,6 VECES LO ESPERADO · INTERVALO DE 1,3 A 4,4 · CASOS RESUELTOS POR LA DGA"
   R2 Grande: "8 casos" · secundario: "estaban en alerta antes de que llegara el inspector."
      Abajo: "Entre 0,8 y más de 4,3 años antes. En esos predios, 2,4 a 2,7 millones de m³ sobre el derecho."
      Mono: "8 DE LOS 19 INFRACTORES CONOCIDOS · LA SERIE PARTE EN 2019, ASÍ QUE ES UN MÍNIMO"
   R3 Grande: "158" · secundario: "predios en alerta sin un canal a 300 metros."
      Abajo: "El agua de canal no está en el registro de derechos. La ficha lo avisa, y el cálculo conservador cuenta solo estos."
      Mono: "158 DE 467 PREDIOS EN ALERTA DE HASTA 100 HECTÁREAS"
   R4 Grande: "1.008 de 1.210" · secundario: "huertos conocidos donde detecta riego: el 83 %."
      Abajo: "Mide riego, no infracción. La infracción se valida con los casos de la DGA."
      Mono: "HUERTOS DEL CATASTRO FRUTÍCOLA · TEMPORADA 2025-26"

## Entregable
16:9, 1920×1080. Que todas las slides compartan la misma grilla (el mismo margen superior y
la misma línea base del mensaje) para que cambiar de slide no "salte" a la vista.
Sin transiciones vistosas; si hay alguna, un fade de 300 ms.
Contraste: el texto debe cumplir WCAG AA sobre #05080b sin usar blanco puro.
```

## De dónde sale cada cifra

| Cifra | Fuente |
| --- | --- |
| 50 litros al día, 40 mil personas | Radio JGM, U. de Chile, 2020 (tabla de respaldo de [pitch-demo.md](../pitch-demo.md)) |
| $5.700 millones | Consejo para la Transparencia: contratos de la Delegación Presidencial Provincial de Petorca, 2023 y 2024 |
| 2 años, al menos | Caso FO-0504-95: alerta alta desde 2019-20, inspección el 23-11-2021 (`docs/impacto.md`) |
| 7.911 predios, 160 mil mediciones | `puntaje.parquet`; 167.266 imágenes despejadas de verano por predio (`docs/ablacion-ventana.md`) |
| 7 veranos | Series de 2019-20 a 2025-26 en los predios de la validación (`data/README.md`); el ranking usa 2025-26 |
| 14 regiones | Datos base de la corrida nacional (`docs/spec-chile.md`); las series satelitales solo están para Valparaíso |
| 2,6× y 6 de 19 | `docs/validacion.md`, con los umbrales fijados antes de calibrar |
| 501 y 158 de 467 | `data/processed/impacto.json` (`candidatos`, escenario conservador) |
| 8 casos, 0,8 a más de 4,3 años | `docs/impacto.md`, "Adelanto en casos conocidos" |
| 1.008 de 1.210 | `docs/ablacion-ventana.md` |
