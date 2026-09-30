# Dojo de càlcul mental

Aplicación web (PWA) para practicar cálculo mental con calma: tablas de multiplicar, sumas y restas de una cifra. Pensada para funcionar bien en iPad.

## Principios

- **Sin estrés:** no hay cronómetros visibles ni contadores de fallos. Cada bloque tiene una longitud fija y termina igual lo hagas bien o mal.
- **Una misión al día:** la pantalla de inicio solo muestra la misión que toca. Si se para a medias, la próxima vez sigue por donde lo dejó.
- **Instrucciones claras:** cada bloque se presenta con un ejemplo visual y se lee en voz alta (voz del sistema, en catalán).
- **Corrección amable:** si una respuesta está mal, se muestra la operación correcta, sin penalizaciones.
- **Mazos equilibrados:** cada combinación del 2 al 9 sale una vez por vuelta.

## Tipos de bloque

| Bloque | Qué hace |
|---|---|
| Escriure números | Copiar un número (mide la velocidad de tecleo, para descontarla del resto) |
| Multiplicacions | Tablas del 2 al 9 |
| Sumes / Restes | Operaciones de una cifra |
| Està bé o no? | Decir si una multiplicación ya resuelta es correcta |
| Amb el papa | Respuesta oral; un adulto marca el resultado y la estrategia usada |

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

Nunca tocan la base de datos real (todas las llamadas a Supabase se interceptan). Un hook `pre-push` impide publicar si alguna falla.
