# Caudales — Pitch y demo de 3 minutos

Nov 21, 2026 · @Tomas

Este documento define qué decimos y qué mostramos en los 3 minutos de la final. Lo que hay que construir para mostrarlo está en [spec-demo.md](spec-demo.md). Las cifras salen de [impacto.md](impacto.md) y [validacion.md](validacion.md); si se regeneran, hay que actualizar el guion.

## Reglas del formato

| Regla | Valor | Fuente |
| --- | --- | --- |
| Duración | 3 minutos | Organización |
| Demo mínima | 1 minuto 30 segundos | Organización |
| Corte duro a los 3:01 y 2 minutos de preguntas; 1:30 de evaluación | Guía de la organización | Organización |
| 4 jueces: aspecto técnico 25 %, ambición 20 %, ejecución 20 %, impacto 20 %, originalidad 15 % | Guía de la organización | Organización |
| Dos rondas: general de 9:30 a 11:30 y final de 12:30 a 3:30. La presentación se graba y se publica | Guía de la organización | Organización |
| El reloj parte con la primera palabra | Confirmado | Equipo |
| El jurado lee el repo y castiga las demos simuladas | Confirmado | Equipo |


Consecuencias para nosotros:

- El guion tiene 400 palabras (unas 150 por minuto) y termina a los 2:55.
- Todo lo que se muestra corre en producción con datos reales. Nada de botones simulados.
- Una persona habla y otra maneja el computador.

## Estándar del pitch

Seguimos las dos guías de Y Combinator para presentar una empresa: [How to Pitch Your Company](https://www.ycombinator.com/blog/how-to-pitch-your-company/) (Michael Seibel) y [A Guide to Demo Day Presentations](https://www.ycombinator.com/blog/guide-to-demo-day-pitches/) (Geoff Ralston).

| Regla de YC | Cómo la aplicamos |
| --- | --- |
| La primera frase dice qué haces, en palabras simples. Demorarlo "siempre es un error" | El guion parte con "Soy Tomás, y esto es Caudales" y la slide dice "El agua está repartida. No todos respetan su parte.". Qué hacemos cierra el problema, a los 25 segundos |
| Sin jerga, siglas ni lenguaje de marketing. Que suene "más tonto de lo que crees que debería" | No se nombran satélites, índices ni métodos. "DGA" se dice completo la primera vez |
| El oyente retiene 3 o 4 ideas. Decirlas y repetirlas al final | Cuatro ideas (abajo); el cierre las repite |
| El problema, corto | 21 segundos, con dos cifras |
| Si hay resultados, no esconderlos. Sin exagerar: exagerar es un error fatal | El caso real y el 2,6 van con su fuente. Usamos 2,6 y no 3,7. No decimos "en vivo" de algo que ya estaba generado |
| Tamaño del problema desde abajo, con números concretos | 425 en la zona que se muestra y 501 entre las dos |
| Terminar con lo que quieres, sin rodeos | No la usamos: no le pedimos nada al jurado. El cierre repite las ideas y nombra al equipo |
| Una idea por pantalla; menos de 7 palabras en letra grande | En cada tramo del guion hay una sola cosa que mirar. Quien maneja no abre nada más |
| Habla una persona, más lento de lo natural, con pausas | 400 palabras para 2:55. Las pausas van en los clics de la demo |

## Mensaje

Las dos frases que todo el equipo dice igual:

> **Caudales mira desde el satélite qué predios riegan sin tener derechos de agua, y le dice a la Dirección General de Aguas a cuáles ir primero.** Entrega la ruta del inspector y el expediente de denuncia listo.

Cuatro ideas que el jurado debe recordar:

1. **Qué es y para quién.** Le dice al fiscalizador de aguas a dónde ir mañana.
2. **Funciona con un caso real.** Caudales tenía en alerta, dos años antes de la inspección, un predio que la DGA multó.
3. **Está medido y no exagera.** Partiendo por los predios que marca Caudales, un inspector encuentra más del doble de infracciones. Todo va en rango.
4. **El problema es grande y hoy nadie lo mira.** 501 predios en alerta sin fiscalizar; revisarlos uno por uno tomaría 14 años.

## Guion

Toda la demo ocurre en una sola zona (Aconcagua bajo, comuna de Hijuelas) para no gastar tiempo en vuelos entre zonas. El producto está en pantalla desde el 0:50 hasta el 2:34 (1:44); el recorrido de las cuatro pantallas dura 1:29. La apertura y el cierre van con el deck ([deck/index.html](deck/index.html), 4 slides y 4 de reserva): se abre en el navegador, con las flechas se avanza y con F se pone en pantalla completa.

| Tiempo | Segundos | Tramo | Qué se ve |
| --- | --- | --- | --- |
| 0:00–0:05 | 5 | Intro | Slide 1: CAUDALES y "El agua está repartida. No todos respetan su parte." |
| 0:05–0:29 | 24 | El problema | Slide 2: "50 litros al día" |
| 0:29–0:50 | 21 | La solución | Slide 3: "7.911 predios", 160 mil mediciones, 7 veranos, 14 regiones. Al terminar se cambia al producto |
| 0:50–1:05 | 15 | Demo: la zona | Vuelo a Aconcagua bajo; panel "De 3.639 predios, 425 tienen señal alta…" |
| 1:05–1:38 | 33 | Demo: el caso real | Ficha del caso FO-0504-95: multa, "al menos 2,0 años antes" y el agua estimada |
| 1:38–2:07 | 29 | Demo: un candidato de hoy | Ficha del candidato; se abre el expediente PDF |
| 2:07–2:18 | 11 | Demo: la ruta de mañana | Pestaña Ruta: "5 predios · 4 horas · 71 km" |
| 2:18–2:34 | 16 | Qué tan bien funciona | Sigue la pestaña Ruta: no se cambia de pantalla |
| 2:34–2:47 | 13 | Cierre | Slide 4: 2 años, 2,6× y 501; caudales.dev y equipo. Se queda durante las preguntas |

Termina a los 2:47: quedan 14 segundos antes del corte, que es a los 3:01. El reparto sale de la revisión del 22-11 con tres espectadores simulados (alguien cansado en la quinta fila, un jurado técnico y un coach de demo day) y de los tiempos medidos en producción: la zona carga en 2,6 segundos, el caso y el candidato abren al instante y el expediente en menos de 2. No hay esperas que cubrir hablando.

### Estructura de la organización

La guía de la organización ("cómo hacer un buen demo", revisada el 22-11) sugiere: saludo con una descripción muy breve; problema en unos 20 segundos (cuál es, a quién afecta, por qué no está resuelto); solución, impacto y ambición en 20 a 30 segundos (qué es lo nuevo, qué tan ambiciosa es); y demo en vivo de 125 a 140 segundos (cómo funciona, qué usaron, cuánto avanzaron). El guion sigue ese orden. Los 4 jueces evalúan: aspecto técnico 25 %, ambición 20 %, ejecución 20 %, impacto 20 % y originalidad 15 %. Por eso "La solución" nombra lo que hay debajo (satélite, clima, registro de derechos), el tamaño (casi 8 mil predios, 160 mil mediciones) y hasta dónde llegamos (los datos del resto de Chile ya descargados). No se dice "en 36 horas": todos los equipos tuvieron lo mismo.

### Texto

El tono es hablado. No se nombran satélites, índices ni métodos (Sentinel-2, NDVI, FAO-56): van en el material de apoyo y en las respuestas. Como máximo dos cifras por tramo.

**0:00 Intro.**
"Hola, soy Tomás, y esto es Caudales."

**0:05 El problema.**
"Con la sequía, en Petorca los pozos de los pueblos se agotaron. Hay gente que vive con agua de camión: llegaron a ser 50 litros al día. En dos años, el Estado gastó 5.700 millones en llevarla. Y ahí mismo hay paltos verdes en pleno verano, con más agua de la que les toca. Hoy eso se pilla solo si un vecino denuncia."

**0:29 La solución.**
"Caudales lo ve desde el satélite. Revisa casi 8 mil predios, con más de 160 mil mediciones. Las cruza con el clima y con el registro público de derechos de agua. Y le dice al inspector a dónde ir primero. Ya tenemos los datos para probarlo en el resto de Chile."

**0:50 Demo: la zona.**
"Este es el valle del Aconcagua, vecino de Petorca. En verano el cerro está seco: lo que sigue verde, alguien lo riega. Si usa más agua de la que tiene por derecho, queda en alerta. Aquí son 425."

**1:05 Demo: el caso real.**
"Miren este predio de paltos, en Hijuelas. La Dirección General de Aguas lo fiscalizó y lo multó con más de 140 millones de pesos, por sacar agua sin derechos. Caudales ya lo tenía en alerta al menos dos años antes de que llegara un inspector. En ese tiempo, según nuestra estimación, se llevó 100 mil metros cúbicos de más: lo mismo que consumen 1.500 personas."

**1:38 Demo: un candidato de hoy.**
"Ahora vamos a la temporada pasada, en la misma comuna. Diecinueve hectáreas de paltos, verdes todo el verano. Sin derechos de agua inscritos, sin un canal cerca, y nadie lo ha fiscalizado. El mismo patrón, hoy. Ojo: Caudales no acusa, prioriza; la infracción la confirma un inspector en terreno. Por eso, con un clic, sale con el expediente ya escrito, en el formato oficial de denuncias."

**2:07 Demo: la ruta de mañana.**
"Esto es lo que importa: a dónde ir primero. Cinco predios en una mañana, 71 kilómetros, y en cada uno, dónde mirar."

**2:18 Qué tan bien funciona.**
"Y funciona. Lo probamos con los casos que la DGA ya multó: con esta lista se encuentran más del doble de infracciones que sin ella. Hoy, entre las dos zonas, hay 501 predios en alerta que nadie ha visitado."

**2:34 Cierre.**
"El agua que falta no se ve. El verde en pleno verano, sí. Todo esto con datos públicos, que estaban ahí, dispersos: faltaba cruzarlos. Somos Nicolás, Felipe, Gabriela y Tomás. Gracias."

El texto tiene 382 palabras (Intro: 7 · El problema: 63 · La solución: 51 · la zona: 38 · el caso real: 65 · un candidato de hoy: 66 · la ruta de mañana: 22 · Qué tan bien funciona: 39 · Cierre: 31). A 150 palabras por minuto son 2:33 hablando; el resto son los clics, los vuelos y las pausas.

Cuidados al decirlo:

- **El momento que tiene que quedar es "al menos dos años antes".** Después de esa frase van 2 segundos de silencio, con la ficha del caso en pantalla. Hay que decir "al menos": la serie parte en 2019, así que es el tope de los datos y no el día en que empezó el riego.
- **El agua del caso real** es la que Caudales estima sobre el derecho entre la primera alerta y la inspección: 106 a 138 mil m³ (lo dice la ficha). Se dice "100 mil metros cúbicos de más" y "según nuestra estimación". Las 1.500 personas son las que consumen ese volumen en los mismos dos años.
- **Las cifras cambian de escala y hay que decirlo.** La pantalla de la zona dice 3.639 predios y 425 en alerta; el 501 es de las dos zonas juntas y sin fiscalizar. Por eso el guion dice "en esta zona" y "entre las dos zonas".
- **El expediente del candidato ya está generado.** La pantalla dice "Generado el…, el servidor lo reutiliza". Por eso el guion no dice "se está generando ahora". Si el jurado pide verlo generarse, se pide el de otro predio: tarda unos 5 segundos y la pantalla muestra los pasos.
- **La multa en pantalla dice 1.983,9 UTM, unos $144 millones** al valor de la UTM de `impacto.json`. La DGA informó "más de 127 millones" en su momento. El guion dice "más de 140" para calzar con la pantalla.
- **"Con la sequía, los pozos se agotaron" no dice quién los agotó.** La sequía se nombra y no se explica: la sala ya la conoce. El guion deja que el público una esa frase con los paltos verdes. Si el jurado pregunta por la causa, son las dos cosas, sequía y extracción: la napa de Petorca y La Ligua bajó sobre todo por causas humanas (expansión del palto, riego y derechos otorgados de más), no por el clima, según un estudio revisado por pares. No decir "los paltos secaron los pozos".
- **Los 5.700 millones son contratos adjudicados**, según el Consejo para la Transparencia. El guion dice "gastó"; la slide solo dice "en camiones aljibe · 2023 y 2024". Si el jurado pregunta, la respuesta exacta es "contratados".
- **Desde la quinta fila solo se ve el tercio superior.** Cada cifra se dice en voz alta; ninguna se deja a la pantalla.
- **Si falta tiempo**, se salta "y en cada uno, dónde mirar" y, si hace falta, la ruta entera.
- **Escrito para el oído.** Reglas que se aplicaron al texto (guía de oradores de TEDx y Toastmasters): una idea por oración; ninguna oración de más de 22 palabras; la misma palabra no aparece en dos oraciones seguidas, salvo las que son el tema (agua, alerta, derechos); una sola palabra para cada cosa (siempre "inspector", nunca "fiscalizador"); afirmaciones en vez de preguntas; no se describe lo que ya se ve en pantalla. Dos repeticiones son a propósito: "a dónde ir primero" aparece en la solución y vuelve en la ruta, y "verde en pleno verano" abre el problema y cierra la presentación.

## Cifras del guion y su respaldo

| Frase | Valor y cálculo | Fuente | Advertencia |
| --- | --- | --- | --- |
| 40 mil personas con 50 litros al día | 40.000 personas en la provincia de Petorca | [Radio JGM, U. de Chile, 04-05-2020](https://radiojgm.uchile.cl/de-50-a-100-litros-de-agua-el-suministro-que-el-minsal-no-pudo-cumplir/) | Los 50 litros son de 2020 y en 2021 la Corte Suprema subió la dotación a 100: por eso va en pasado ("llegaron a ser"). Lo que va en presente es el camión, que sigue: 41.201 m³ contratados entre enero y marzo de 2026 (Mercado Público) |
| Con la sequía, los pozos de los pueblos se agotaron | Megasequía de Chile central desde 2010 (Garreaud et al., 2020, *Int. J. Climatol.*). La baja de las napas cortó el agua para necesidades básicas en las cuencas de Petorca y La Ligua; el agotamiento se debe sobre todo a causas humanas | [Alvarez-Garreton et al. (2024), HESS 28, 1605](https://hess.copernicus.org/articles/28/1605/2024/); [Duran-Llacer et al. (2020), Water 12(9), 2446](https://doi.org/10.3390/w12092446) (tabla de [spec-agua-potable.md](spec-agua-potable.md)) | No se agotaron todos: es un hecho general de la provincia, sin cifra. No atribuirlo a un predio |
| 5.700 millones en camiones aljibe | $5.710 millones en contratos de la Delegación Presidencial Provincial de Petorca, 2023 y 2024 sumados | [Consejo para la Transparencia, 05-10-2026](https://www.consejotransparencia.cl/fiscalizacion-cplt-municipios-y-delegaciones-contrataron-mas-de-30-mil-millones-en-camiones-aljibe-en-2023-y-2024-pero-a-cuantas-familias-llego-el-agua-potable/) | El guion dice "gastó" porque es lo natural al hablar (decisión del 22-11). El dato exacto son montos contratados e informados por la delegación, no pagos: si preguntan, decirlo así. Leímos el comunicado; el informe completo no abrió |
| Multa de más de 140 millones | 1.983,9 UTM × $72.450 = $143,7 millones | Planilla de la DGA; UTM de `impacto.json` (`supuestos.utm_clp`) | Es lo que muestra la ficha del caso. La nota de prensa de la DGA dijo "más de 127 millones", con la UTM de entonces |
| Lo fiscalizó y lo multó; en alerta al menos dos años antes | Temporada 2019-20; inspección el 23-11-2021 (1,98 años); resolución de multa el 29-11-2023 | `impacto.md`, `/api/casos/FO-0504-95` | La serie parte en 2019-20: es una cota inferior. La multa se resolvió en 2023: decir "fiscalizó en 2021 y lo multó", no "multó en 2021" |
| Diecinueve hectáreas, sin derechos inscritos, sin un canal cerca, nunca fiscalizado | 18,8 ha, 89 % palto, sin derechos a 500 m, canal a 1,2 km, sin fiscalización a 500 m desde 2018 | `puntaje.parquet`, predio `5301984` | No mostrar rol ni dueño |
| Cinco predios, cuatro horas, 71 km | Ruta de Z2 (5 paradas, 08:30 a 12:28, 71,3 km) | `ruta_z2.json` | Cambia si se regenera la ruta. Con tope de 5 paradas desde el 21-11; antes eran 12 predios, 8 horas y 91 km |
| Más del doble de infracciones | 2,6 veces (IC 95 %: 1,3–4,4). De 19 infractores confirmados, 6 estaban en alerta alta (32 %); la alerta alta reúne el 12 % de los predios | `validacion.md` | "Más del doble" y no "casi el triple". Si preguntan, la cifra es 2,6. No usar 3,7: se midió con los mismos casos que calibraron los umbrales |
| Más de 100 mil m³ en esos dos años; el agua de 1.500 personas durante dos años | 105.929 m³ (mínimo) a 137.673 m³ (central) sobre el derecho en 2019-20 y 2020-21. 105.929 ÷ 36,5 m³ por persona al año ÷ 2 años = 1.451 personas | `/api/casos/FO-0504-95` (`m3_antes_inspeccion`); dotación de 100 litros al día ([Corte Suprema, 2021](https://www.24horas.cl/regiones/valparaiso/corte-suprema-determina-100-litros-de-agua-por-habitantes-de-petorca-4708851)) | Es una estimación: decir "según nuestra estimación". La infracción sí está sancionada por la DGA |
| En esta zona son 425 | Predios en alerta alta en Aconcagua bajo, de 3.639 | `puntaje.parquet` | Es lo que dice la pantalla de la zona |
| 501 predios en alerta, entre las dos zonas, que nadie ha ido a mirar | Banda alta sin fiscalización a 500 m desde 2018 | `impacto.md` | — |

Datos de reserva para las preguntas:

- Acierto de la DGA: 33 % (107 fiscalizaciones por extracción, 2022–2025). Caudales en alerta alta: 7 de 15.
- Casos esperados entre los 501 candidatos: 39 a 153.
- Capacidad: la DGA hace unas 33 fiscalizaciones por extracción al año en las dos zonas; revisar los 467 candidatos de hasta 100 ha tomaría 14 años.
- No es un caso aislado: 8 de los 19 infractores conocidos estaban en alerta alta antes de su inspección, entre 0,8 y más de 4,3 años antes. En esos 8 predios, 2,4 a 2,7 millones de m³ sobre el derecho entre la primera alerta y la inspección.
- Un predio como el candidato: su exceso mínimo estimado, 105.000 m³ al año, es el consumo de casi 3.000 personas. No se dice en el guion: suena a acusación sobre un predio no sancionado.
- Caso de Hijuelas: unos 140.000 m³ sin derecho en los dos años previos a la inspección, el agua de unas 1.900 personas durante esos dos años.
- Agua potable rural: en las cinco comunas de Petorca hay 60 sistemas de APR, con unas 43 mil personas (13.978 arranques; la DOH estima 3,1 personas por arranque). En las diez comunas de las dos zonas son 90 sistemas, y 59 tienen un predio en alerta alta a 1 km o menos (`apr.parquet`, dato de la DOH al 30-06-2026). Cercanía no es causa: no decir que ese predio le quita el agua a ese APR.
- Camiones aljibe en Petorca, enero a marzo de 2026: $176,4 millones por 41.201 m³ (Mercado Público).
- En todo el país, 2023 y 2024: 370 contratos por más de $30.192 millones; la Región de Valparaíso concentra el 47 % del monto (mismo comunicado del Consejo para la Transparencia).
- Escuela de Petorca con jornada reducida a la mitad por cortes de agua ([BBC Mundo, 16-12-2021](https://www.elmostrador.cl/dia/2021/12/16/petorca-en-la-bbc-mundo-el-pueblo-de-chile-que-esta-cerrando-escuelas-por-culpa-de-la-sequia/)).

## Decisiones

| Decisión | Elegido | Alternativa | Por qué |
| --- | --- | --- | --- |
| Cierre | Una imagen ("el agua que falta no se ve; el verde en pleno verano, sí") y la idea de fondo: datos públicos que faltaba cruzar. Los tres números quedan en la slide | Repetir los tres números en voz alta | Se acaban de decir 15 segundos antes; repetirlos es ruido. "Para cualquier valle de Chile" se quitó: el método necesita verano seco |
| Pedido del cierre | Sin pedido: el cierre repite las ideas y nombra al equipo | "Queremos probarlo con la DGA este verano" | No comprometemos al equipo ni a la DGA desde el escenario |
| Zona de la demo | Z2, Hijuelas | Z1, Cabildo: caso FD-0501-181 y candidato `5344181` (31 ha de palto) | El caso FO-0504-95 es el más sólido (la DGA dijo que lo detectó con satélite y el verdor baja después de la multa). El candidato está en la misma comuna, así que la demo no cambia de zona |
| Candidato en vivo (D19) | Predio `5301984` | `5344181` (Cabildo), `5345478` (Cabildo, 7 ha de nogal) | Señal en el 100 % de las fechas, sin derechos a 500 m, sin canal a 1 km, sin fiscalización a 500 m, 89 % de la superficie con frutales |
| Cifra de validación | 2,6 veces | 3,7 veces | Es la cifra sin sesgo de calibración; aguanta una pregunta del jurado |
| Comparación con la DGA | Una sola mención, como capacidad: "14 años". El 33 % queda para las preguntas | Abrir con "la DGA acierta 1 de cada 3" | No tenemos datos para decir que acertamos más (7 de 15, intervalo ancho) y la DGA es el cliente. La capacidad muestra que falta una herramienta; no nos presenta como una mejora de algo que ya existe |
| Equivalencias de volumen | Solo personas, con la dotación de 100 litros al día, y pegada al caso real | Latas de Monster y Torres Costanera | Las comparaciones con latas y edificios le restan seriedad a un problema de gente sin agua. Decidido el 22-11 tras la revisión con espectadores |
| Apertura | "Soy Tomás, y esto es Caudales" y el problema en 20 segundos | Un tramo aparte para decir qué hacemos | Los tres espectadores pidieron ver el producto antes. Qué hacemos queda en la última frase del problema: "Nosotros lo miramos desde el satélite" |
| Tramo "La solución" | 21 segundos antes de la demo: qué hace, con qué datos, de qué tamaño y que ya están los datos del resto de Chile | Pasar del problema directo al producto | Es el orden que sugiere la organización, y la rúbrica pesa lo técnico (25 %) y la ambición (20 %). "Más de 160 mil mediciones" son las 167.266 imágenes despejadas de verano por predio (`docs/ablacion-ventana.md`) |
| Frase de la portada | "El agua está repartida. No todos respetan su parte." | "Quién riega sin derechos de agua"; "Si alguien saca agua de más, a otro le falta" | La primera sonaba a acusación. La idea es de reparto: el agua de un valle está repartida en derechos, y cuando alguien saca más de lo que le toca, es injusto para el resto |
| Cómo se muestra el candidato | Por ID interno, sin rol ni dueño, con la palabra "candidato" | No mostrar ningún predio no multado | El expediente y la ruta necesitan un predio concreto. El equipo debe confirmar esta decisión (ver abajo) |

**Por confirmar con el equipo:** la convención era mostrar a los candidatos solo agregados. La demo en vivo necesita un predio concreto que no ha sido multado, y la ruta ya muestra ubicaciones. La propuesta es mostrarlo sin rol ni dueño y decir en voz alta que Caudales prioriza y no acusa. Si el equipo no está de acuerdo, el expediente en vivo se genera para el caso FO-0504-95 y el paso "candidato de hoy" muestra solo el ranking agregado.

## Preguntas probables del jurado

| Pregunta | Respuesta corta |
| --- | --- |
| ¿Cuántos falsos positivos tiene? | Entre los fiscalizados en alerta alta, 7 de 15 tuvieron infracción (47 %; la DGA tiene 33 %). Son pocos casos y lo decimos. Por eso Caudales prioriza y entrega rangos; la infracción la constata el inspector |
| ¿Cómo saben que es agua ilegal y no de un canal? | No lo sabemos con certeza. El agua de canal no está en el registro de derechos. Por eso el escenario conservador excluye a todo predio con un canal a 300 m, y la ficha lo avisa |
| ¿Qué es en vivo y qué es precalculado? | Las series satelitales, el puntaje y la ruta se precalculan (7.911 predios, en GCP y en los scripts del repo). En vivo: el expediente PDF y las consultas de la API. Detalle en [en-vivo-y-precalculado.md](en-vivo-y-precalculado.md) |
| ¿Por qué solo en verano? ¿Importa la lluvia? | Lo medimos. El modelo exige diez días sin lluvia, pero en verano casi todas las imágenes ya cumplen esa condición, y quitarla deja el ranking igual (99,4 % de los predios en la misma banda). Lo que importa es la época: cuando el cerro reverdece, en primavera, el contraste se pierde. Por eso usamos diciembre a marzo. Detalle en [ablacion-ventana.md](ablacion-ventana.md) |
| ¿Qué tan bien detecta riego? | Marca riego en el 83 % de los huertos del catastro frutícola (1.008 de 1.210), que son riego seguro. Eso mide riego, no infracción: la infracción se valida con los casos de la DGA |
| ¿La DGA no hace esto ya? | En el caso de Hijuelas dijo que usó imágenes, pero su fiscalización parte casi siempre de una denuncia. Caudales lo hace para todos los predios y todas las temporadas |
| ¿El satélite es "mundo físico"? | La entrada son mediciones físicas (reflectancia, lluvia, evapotranspiración) y la salida es una inspección en terreno con ruta y puntos a revisar |
| ¿Por qué el AUC entre fiscalizados es bajo (0,62)? | La DGA ya fiscaliza predios regados, así que entre ellos el verdor no separa. La pregunta útil es otra: frente a todos los predios, Caudales concentra 2,6 veces más infractores |
| ¿Escala a otros valles? | Los datos son públicos y cubren todo Chile; ya bajamos los de las 14 regiones. El método necesita verano seco: está probado en Valparaíso, y más al sur hay que medirlo antes de confiar en él |
| ¿Modelo de negocio? | El cliente es la DGA y las juntas de vigilancia, que deben decidir a dónde mandar un inspector. También sirve a APR y comunidades que hoy denuncian sin pruebas |
| ¿Por qué no se había hecho? | Los datos son públicos, pero están repartidos en varias instituciones y nadie los había cruzado predio por predio. Y el verdor solo no basta: hay que compararlo con el cerro seco y con la lluvia |

## Riesgos de la presentación

| Riesgo | Mitigación |
| --- | --- |
| Se cae la red o el servicio | La página funciona sin red desde la segunda visita (service worker). El PDF de la demo queda también como archivo estático |
| El expediente tarda en generarse | El del candidato se genera al construir la imagen de la API y abre en menos de 2 segundos. La pantalla muestra su fecha |
| Nos pasamos de los 3:00 | Si a los 2:00 no partió la ruta, se salta y se va directo a "Lo comprobamos…" |
| Arranque en frío de Cloud Run | `min-instances=1` en ambos servicios desde el sábado en la noche |
| Vuelos del mapa lentos en el computador de la demo | Abrir la página 5 minutos antes y esperar `data-warm=done`; probar en el computador real |

## Antes de presentar

- [x] Llenar `platanus-hack-project.jsonc` con el nombre, la descripción y la URL de producción.
- [ ] Prueba del correo (Seibel): mandar las dos frases del mensaje a alguien de fuera del equipo y pedirle que las repita con sus palabras. Si pregunta algo, se reescriben.
- [ ] Correr el recorrido completo en producción, en el computador de la demo.
- [x] Revisar que las cifras del guion coincidan con `impacto.md`, `validacion.md` y lo que muestra la pantalla (ruta, multa, fecha del expediente). Revisado el 22-11 contra la API de producción: ruta de 5 predios, 4 horas y 71 km; multa de 1.983,9 UTM, unos $143,7 millones; expediente del candidato reutilizado, con su fecha.
