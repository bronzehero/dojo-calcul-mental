# Dojo de càlcul mental

Aplicación web (PWA) para practicar cálculo mental con calma: tablas de multiplicar, sumas y restas de una cifra. Pensada para funcionar bien en iPad.

## Principios

- **Sin estrés:** no hay cronómetros visibles ni contadores de fallos. Cada bloque tiene una longitud fija y termina igual lo hagas bien o mal.
- **Una misión al día:** la pantalla de inicio solo muestra la misión que toca. Si se para a medias, la próxima vez sigue por donde lo dejó.
- **Instrucciones claras:** cada bloque se presenta con un ejemplo visual y se lee en voz alta (voz del sistema, en catalán).
- **Corrección amable:** si una respuesta está mal, se muestra la operación correcta, sin penalizaciones.
- **Mazos equilibrados:** cada combinación del 2 al 9 sale una vez por vuelta, y nunca salen seguidas dos operaciones con el mismo resultado o los mismos números (para no arrastrar la respuesta anterior).
- **"No ho sé" en vez de adivinar:** en multiplicaciones, sumas, restas y "Està bé o no?" se puede pulsar «No ho sé». Se enseña la respuesta sin sonido de error y se guarda aparte de los fallos (una respuesta inventada y errónea se queda grabada en la memoria).
- **Photocards:** al acabar cada misión sale una carta para la colección. Es por haber acabado, nunca por los aciertos. Las cartas son las fotos que un adulto añade en la Zona Papá; se guardan solo en el dispositivo (IndexedDB) y no se suben a ningún sitio. En cuanto hay alguna foto, solo salen fotos. Mientras no hay ninguna, salen 36 idols en pixel art dibujadas por la propia app (6 idols × 6 caras, todas contentas). Las cartas tienen la proporción de una photocard de verdad (55 × 85 mm), y arriba de la app pone KATSEYE.
- **Simulacre d'examen de català (ortografía de consonantes):** misión extra que el adulto pone para un día concreto desde la Zona Papá, sin mover el plan. Frases con una letra que falta y botones con las letras del bloque; los 4 bloques llevan los colores de un full-resum de consonants en papel. Durante el bloque no se dice si está bien (es para evaluar); al acabarlo se enseñan las palabras bien escritas. Se guardan la letra elegida, la palabra, «No ho sé» y las veces que se ha escuchado la frase.
- **Paraules (ortografía palabra a palabra):** desde el 18/10 van dentro de la misión del día (al final del entrenamiento o del repaso del domingo), y la misión no está acabada hasta terminarlas. Las nuevas se miran con la letra difícil de color y su truco, se tapan y se escriben de memoria; si no sale, se vuelven a mirar y a escribir (hasta 3 veces). Las ya vistas se escriben de memoria directamente: el primer intento del día es la medida. Dominada con 3 días seguidos bien al primer intento; después, repaso cada 7 días. Las palabras en castellano van con voz castellana.
- **Passar pel 10 i la de la setmana (18/10):** la ayuda de las restas se retira poco a poco: recta guiada → los mismos pasos sin la recta → botón «Pista» → sin ayuda; con pasos, una resta solo cuenta como bien si los saltos también lo están. La multiplicación de la semana que tiene parejas que se le cruzan (7 × 8 con 6 × 8 y 6 × 9) sale sola el primer día y, desde el segundo, cada vez seguida de una de ellas. Una vez empezada, la mezcla sigue aunque un día no cuente por una duda suelta (19/10). Desde el 30/10, en cada resta nueva se le recuerda (en pantalla y en voz) que la cuente con los dedos y en voz baja; si dice «No ho sé», en vez de la respuesta se le pide que lo pruebe así. Si le sale al segundo intento está bien, pero no cuenta para subir de nivel.
- **Els parèntesis (del 31/10 al 2/11):** prueba añadida al final de la misión, una vez al día, como les xifres. La misma potencia de potencia en tres formatos (como siempre, con más espacio, con cada pareja de paréntesis y su exponente del mismo color), «obre o tanca?», tocar el paréntesis que hace pareja con el marcado, «què fas primer?» y una potencia a trozos. Sin corrección: se guarda la respuesta, el formato y «No ho sé».
- **Modo prueba para el adulto:** desde la Zona Papá («Probarla yo sin guardar nada») o abriendo la dirección con `?prova`, cualquier misión se ve exactamente igual, pero no se guarda ni se envía nada.

## Tipos de bloque

| Bloque | Qué hace |
|---|---|
| Escriure números | Copiar un número (mide la velocidad de tecleo, para descontarla del resto) |
| Multiplicacions | Tablas del 2 al 9 |
| Sumes / Restes | Operaciones de una cifra |
| Està bé o no? | Decir si una multiplicación ya resuelta es correcta |
| Amb el papa | Respuesta oral; un adulto marca el resultado, la estrategia usada y si ha dicho las cifras al revés |

## Técnica

- Un único `index.html` (HTML, CSS y JavaScript sin dependencias), publicado con GitHub Pages.
- Datos en Supabase por su API REST. La app **solo puede guardar**; para leer los datos hace falta una clave privada que se comprueba en el servidor.
- Guardado local primero: si no hay conexión, las respuestas esperan en el dispositivo y se suben después.
- Se registra el tiempo de cada respuesta y cada tecla pulsada (para ver dudas y autocorrecciones), sin mostrarlo nunca en pantalla.

## Pruebas

Batería de pruebas con Playwright en `tests/`. Se ejecutan con:

```
tests/run.sh
```

Nunca tocan la base de datos real (todas las llamadas a Supabase se interceptan). Antes de las pruebas se comprueba que el JavaScript de la app se puede cargar. Un hook `pre-push` impide publicar si alguna falla.
