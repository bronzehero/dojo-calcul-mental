# 🧠 Dojo de Cálculo Mental

¡Bienvenido al Dojo! Esta es una aplicación web progresiva (PWA) diseñada para practicar operaciones matemáticas básicas (suma, resta, multiplicación y división).

El objetivo principal es ayudar a los niños a ganar fluidez y confianza con las matemáticas mediante un enfoque **amigable, adaptativo y libre de estrés**. Especialmente diseñado pensando en la dislexia y en evitar la saturación cognitiva.

## ✨ Características Principales

*   **Diseño "Kawaii" y Amigable:** Una interfaz visualmente agradable con colores pastel y tipografías claras (`Baloo 2`) para reducir la ansiedad visual.
*   **Sin Temporizador Visible:** Se registra el tiempo para estadísticas internas, pero no se muestra una cuenta atrás para no estresar al estudiante.
*   **Refuerzo Positivo:** Mensajes de ánimo y barras de progreso visuales.
*   **Multi-usuario:** Permite guardar el progreso de diferentes perfiles en la misma aplicación.
*   **Persistencia de Datos en la Nube:** Todos los resultados y el historial se guardan en una hoja de cálculo de Google Sheets, permitiendo a los padres monitorear el progreso y detectar dificultades específicas.

## 🎮 Modos de Juego y Estrategias de Aprendizaje

### 1. ➕ Sumas (Progresión por Niveles)
El sistema guía al estudiante a través de niveles de dificultad incremental.
*   **Mecánica:** Para avanzar de nivel, se requieren **3 aciertos consecutivos**.
*   **Niveles:** Desde sumas básicas (hasta 4) hasta sumas más complejas.

### 2. ➖ Restas (Sin Negativos)
Práctica de sustracción asegurando que el resultado nunca sea menor que cero.
*   **Lógica:** Se generan combinaciones basadas en el nivel actual (ej. 0-10, 10-20).
*   **Sesiones Cortas:** Aunque existen muchas combinaciones posibles, la sesión se limita para no cansar al estudiante.

### 3. ✖️ Multiplicaciones (Sesión Inteligente & Anti-Estrés)
Olvídate de hacer 64 multiplicaciones seguidas. Este modo está optimizado para aprender sin saturar.
*   **Límite de Preguntas:** Cada sesión consta de un **máximo de 30 preguntas**.
*   **Flujo Continuo:** Siempre se avanza a la siguiente pregunta, se acierte o se falle, para mantener el ritmo y evitar bloqueos.
*   **Algoritmo de Selección Híbrido:**
    *   **Primeras 15 preguntas:** Se seleccionan priorizando los **últimos errores cometidos**. El sistema "recuerda" lo que cuesta más y lo presenta primero para reforzar.
    *   **Siguientes 15 preguntas:** Se seleccionan de forma **totalmente aleatoria** del total de las tablas (2 al 9) para repasar conocimientos generales.

### 4. ➗ Divisiones
Práctica básica de divisiones exactas.

## 🚀 Funcionalidades Especiales

### 📉 Registro y Visualización de "Retos"
El sistema cuenta con un "Libro de Fallos" interno.
*   Cada vez que se falla una operación específica (ej. "7 x 8"), se registra.
*   **Botón "Ver mis 10 Retos":** Muestra un gráfico visual con las 10 operaciones que más le cuestan al niño en este momento. Esto ayuda a visualizar el "enemigo" y convertirlo en un objetivo concreto a batir.

### 🔄 Modo de Repaso Inteligente
Un botón específico que genera una sesión personalizada basada puramente en los fallos históricos registrados, mezclando operaciones difíciles con otras fáciles para mantener la motivación alta.

## 🛠️ Tecnologías

*   **Frontend:** HTML5, CSS3, JavaScript (Vanilla).
*   **Gráficos:** Chart.js para la visualización de estadísticas.
*   **Backend / Base de Datos:** Google Apps Script + Google Sheets (actúa como API y base de datos).
*   **Conexión:** Fetch API / JSONP para superar restricciones de CORS en entornos estáticos.

## 📦 Instalación

No requiere instalación. Al ser una página web, se puede acceder desde cualquier navegador. Se recomienda "Añadir a la pantalla de inicio" en tabletas o móviles para usarla como una App nativa a pantalla completa.

---
*Hecho con ❤️ para aprender mates sonriendo.*
