# Guía para quien maneja el computador

Nov 22, 2026 · @Tomas

Tomás habla y tú navegas la página normal, `https://caudales.dev`, con clics. No se usa `?demo=1` ni atajos de teclado: todo lo que se muestra se alcanza igual que lo haría cualquier persona. Así, si el jurado pide ver otro predio, ya sabes llegar.

Recorrido probado con clics en producción el 22-11. El texto completo del guion está en [../pitch-demo.md](../pitch-demo.md) y la tarjeta de Tomás en [tarjeta.md](tarjeta.md).

## Cómo está armada la página

```text
Portada (mapa de Chile)
 └─ Zona: Petorca o Aconcagua bajo        mapa 3D + panel a la derecha
     ├─ pestaña Predios   resumen, 5 primeros, lista completa
     │    └─ Ficha del predio
     │         └─ Expediente PDF
     ├─ pestaña Casos     los multados por la DGA
     │    └─ Ficha del caso  →  "Ver predio"
     └─ pestaña Ruta      las 5 paradas
```

Para volver hay dos tipos de botón:

| Botón | Dónde está | Qué hace |
| --- | --- | --- |
| "← Ranking", "← Casos", "← Ficha…" | Arriba del panel | Vuelve un nivel dentro del panel |
| "← Ver toda la zona" | Arriba a la izquierda, sobre el mapa | Aleja la cámara; el panel no cambia |
| "← Volver a Chile" | El mismo lugar, con la zona completa a la vista | Sale a la portada |

En el mapa: pasar el mouse sobre un predio muestra su número, banda, comuna y hectáreas; un clic abre su ficha; arrastrar mueve la cámara y la rueda hace zoom. Rojo es alerta alta y naranjo es media.

## Preparación, 10 minutos antes

Una ventana del navegador con tres pestañas, en este orden:

1. **El deck**, en la slide 1.
2. **El producto:** `https://caudales.dev`.
3. **El PDF de respaldo:** `https://caudales.dev/data/respaldo/expedientes/5301984.pdf`. Solo se usa si falla el expediente.

Pasos:

- [ ] Abre el producto con la pestaña al frente y espera a que termine la intro (unos 8 segundos), o usa "Saltar intro". En segundo plano la intro no avanza.
- [ ] Haz el recorrido completo una vez, con el expediente incluido. Así queda todo cargado y la página funciona aunque se caiga la red.
- [ ] Vuelve a la portada con "← Volver a Chile". Tienen que verse las dos zonas: Petorca y Aconcagua bajo.
- [ ] Pon la ventana en pantalla completa: Ctrl+Cmd+F en Mac, F11 en Windows. No uses la tecla F del deck: esa pantalla completa se sale al cambiar de pestaña.
- [ ] Prueba Ctrl+Tab para pasar del deck al producto y Ctrl+Shift+Tab para volver.
- [ ] Deja el deck al frente, en la slide 1. Silencia las notificaciones y conecta el cargador.

## El recorrido

| Tiempo | Tomás dice | Tú haces | Tiene que verse |
| --- | --- | --- | --- |
| 0:00 | "Hola, soy Tomás, y esto es **Caudales**." | → en el deck | Slide 2: "50 litros al día" |
| 0:05 | "…solo si un vecino **denuncia**." | → | Slide 3: "7.911 predios" |
| 0:31 | "…en el resto de **Chile**." | Ctrl+Tab. Clic en **Aconcagua bajo** en el mapa | El mapa vuela al valle. Panel: "De 3.639 predios, 425 tienen señal alta…" |
| 0:52 | "Aquí son **425**." | Pestaña **Casos**. Clic en la tercera fila: **FO-95 · Hijuelas · 23-11-2021** | Ficha del caso FO-0504-95: multa de 1.983,9 UTM y "al menos 2,0 años antes" |
| 1:09 | "…lo mismo que consumen **1.500 personas**." | Pestaña **Predios**. Baja tres filas y clic en **5301984 · 105–280** | Ficha "Predio 5301984", palto, 18,9 ha, Hijuelas |
| 1:42 | "Por eso, **con un clic**…" | Clic en **Preparar expediente** | El PDF dentro del panel, en menos de 2 segundos |
| | "…formato oficial de **denuncias**." | Pestaña **Ruta** | "5 predios · 4 horas · 71 km" |
| 2:22 | "¿Y funciona?" | Nada | Sigue la ruta |
| 2:39 | "…que nadie ha **visitado**." | Ctrl+Shift+Tab y → | Slide 4: "2 años", "2,6×", "501" |

El paso del candidato es el único con truco, y hay que ensayarlo. Después de ver el caso, la pestaña Predios abre sola la lista completa y queda parada en la fila del caso, marcada con borde celeste y la etiqueta "CASO FO-95", al fondo del panel. El candidato es la tercera fila hacia abajo: bajas un poco con la rueda y haces clic en 5301984, que tiene el rango 105–280. Solo funciona si vienes de la ficha del caso; si llegas a Predios por otro camino, la lista parte desde arriba.

Cuatro cuidados:

- **Después de "al menos dos años antes" Tomás hace una pausa de 2 segundos.** Es a propósito. No toques nada hasta "1.500 personas".
- **Mueve el puntero antes de la señal.** Mientras Tomás habla, deja el mouse sobre lo que vas a apretar después; el clic va justo en la palabra.
- **No arrastres el mapa ni hagas zoom durante el pitch.** La cámara no vuelve sola. Si pasó, "← Ver toda la zona".
- **En la página normal el caso multado muestra su rol** ("rol 61-6"). Es un dato público de la DGA y es la regla acordada: solo los predios con multa lo muestran. El candidato nunca muestra rol ni dueño.

## Si algo falla

| Qué pasa | Qué haces |
| --- | --- |
| La lista de Predios aparece desde arriba | Clic en "Ver los 827 predios priorizados" y baja hasta la fila con la etiqueta "CASO FO-95" (unas cuatro pantallas). El candidato está tres filas después |
| No encuentras el candidato en 5 segundos | Al final de la dirección agrega `#candidato` y Enter. También existen `#caso` y `#ruta` |
| La página se recargó y aparece la intro | "Saltar intro" y sigue desde el paso en que iban |
| El expediente no aparece en 3 segundos | No esperes y no aprietes "Reintentar". Muestra la pestaña 3, que tiene el PDF de respaldo, y vuelve al producto para la pestaña Ruta |
| Tomás se salta la ruta y dice "¿Y funciona?" | Pestaña Ruta igual: esa frase se dice con la ruta en pantalla |
| Hiciste clic en otro predio | El botón de volver de arriba del panel, y repite el clic |
| Se cae la red | Sigue igual. La página ya quedó cargada en la preparación |

Si te pierdes, mira a Tomás: él dice en voz alta lo que debería estar en pantalla.

## En las preguntas: cómo llegar a cualquier predio

La página no tiene buscador. Se llega por la lista, por el mapa, por los casos o por la ruta.

| Piden ver… | Camino |
| --- | --- |
| Otro predio en alerta | Pestaña Predios, "← Ranking" si hay una ficha abierta, y uno de los 5 de "Inspeccionar primero" |
| Uno que elijan ellos en el mapa | "← Ver toda la zona". Pasa el mouse sobre el predio para confirmar el número y haz clic |
| La lista completa | Pestaña Predios, "Ver los 827 predios priorizados". Va en orden de prioridad: alta (425), media (402) y otros. Cada fila muestra el número y el consumo estimado en mil m³ |
| Uno sin alerta | Al final de esa lista, "Otros predios". Su ficha abre, pero el botón "Preparar expediente" queda apagado: solo se prepara para predios en alerta |
| Otro caso multado | Pestaña Casos. Desde la ficha del caso, "Ver predio" abre la ficha del predio |
| Un predio de la ruta | Pestaña Ruta y clic en la parada. "▶ Recorrer ruta" la anima en el mapa |
| Petorca | "← Volver a Chile" y clic en Petorca. Tiene 7 casos y su propia ruta |
| Un expediente generándose | Abre uno de "Inspeccionar primero" y "Preparar expediente". Tarda unos 5 segundos y la pantalla muestra los pasos |
| De dónde sale una cifra | En la ficha, el bloque "Por qué está en alerta" trae la fuente de cada motivo y el enlace "ver método" |

Dos cosas que conviene saber antes de que pregunten:

- **En la lista de casos, la etiqueta de color es la banda de la última temporada**, no la de antes de la inspección. Dos casos de Aconcagua bajo aparecen hoy "sin ind.". La historia de cada uno está en su ficha, en "Banda de Caudales por temporada".
- **El expediente del candidato ya estaba generado.** La pantalla lo dice: "Generado el…, el servidor lo reutiliza". Uno nuevo se genera en vivo.

Las slides de reserva siguen en el deck. Con el deck al frente, aprieta su número:

| Tecla | Slide | Para la pregunta |
| --- | --- | --- |
| 5 | "6 de 19" | ¿Cuánto acierta? ¿Cuántos falsos positivos? |
| 6 | "8 casos" | ¿Es un caso aislado? |
| 7 | "158" | ¿Cómo saben que no es agua de un canal? |
| 8 | "1.008 de 1.210" | ¿Qué tan bien detecta riego? |
| 4 | Cierre | Volver cuando termine la respuesta |

## Ensayo

Dos pasadas completas con Tomás a las 7:40, con el computador de la demo y el cronómetro a la vista. La meta es terminar antes de 2:55. Repite cinco veces seguidas el paso del candidato hasta que salga sin mirar.
