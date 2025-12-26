# 🧠 Dojo de Cálculo Mental

Una Aplicación Web Progresiva (PWA) diseñada para el entrenamiento de operaciones matemáticas básicas.

El objetivo principal es ayudar a niños con dificultades de aprendizaje (como dislexia) a ganar fluidez y confianza con las matemáticas. El diseño prioriza un entorno **amigable, adaptativo y libre de estrés**, evitando la saturación cognitiva mediante sesiones cortas y refuerzo positivo.

---

## 🎯 Filosofía del Proyecto

1.  **Cero Estrés:** Aunque medimos el tiempo internamente para las estadísticas, **nunca** mostramos una cuenta atrás al niño. La ansiedad bloquea el aprendizaje.
2.  **Diseño "Kawaii" y Accesible:**
    *   Uso de la tipografía `Baloo 2` para alta legibilidad.
    *   Colores pastel (rosa, azul, verde, lila) para diferenciar operaciones sin saturar la vista.
    *   Interfaz limpia: botones grandes y claros.
3.  **Persistencia en la Nube:** Los datos no se pierden al cerrar el navegador. Todo se sincroniza con Google Sheets.
4.  **Adaptabilidad:** El sistema detecta fallos y propone mecanismos de repaso específicos.

---

## 🛠️ Arquitectura Técnica

Es vital entender esto para mantener el proyecto:

*   **Frontend:** HTML5, CSS3, JavaScript (Vanilla). Todo en un único fichero `index.html` para facilitar el despliegue en GitHub Pages.
*   **Backend (Serverless):** Google Apps Script (`Code.gs`) conectado a una hoja de cálculo de Google Sheets.
*   **Base de Datos:** Google Sheets. Pestañas principales:
    *   `Estadisticas`: Historial de sesiones completadas.
    *   `Errores`: Registro acumulativo de fallos específicos (ej: "7x8").
*   **Comunicación Cliente-Servidor (JSONP):**
    *   Debido a las restricciones de CORS y las redirecciones de Google Apps Script, **NO usamos `fetch` estándar para leer datos**.
    *   Usamos una implementación personalizada de **JSONP** (`fetchJSONP` en el código) para las peticiones `GET` (cargar usuarios, cargar historial, cargar errores).
    *   Las peticiones `POST` (guardar datos) se hacen mediante `fetch` con `mode: 'no-cors'` (estrategia "fire and forget"), ya que no necesitamos leer la respuesta, solo asegurar que llegue.

---

## 🎮 Lógica de las Operaciones

### 1. ➕ Sumas (Progresión Escalonada)
El sistema guía al estudiante por niveles de dificultad basados en el número máximo a sumar.
*   **Niveles:**
    *   Nivel 1: Números hasta 4.
    *   ... progresando hasta ...
    *   Nivel 7: Números hasta 10.
*   **Subida de Nivel:** Se requiere una racha de **3 aciertos consecutivos** sin fallos para subir automáticamente de nivel en la misma sesión.
*   **Mecánica de Fallo:** Si se falla, se reinicia la racha de aciertos consecutivos.

### 2. ➖ Restas (Sin Negativos)
El objetivo es practicar la sustracción básica garantizando que el niño nunca se enfrente a números negativos.
*   **Regla de Oro:** `Minuendo >= Sustraendo`. El resultado siempre es $\ge 0$.
*   **Rango:** Se trabaja con números de **1 dígito (0 al 9)** y el 10.
*   **Niveles (Combinaciones):**
    *   Al igual que las sumas, se escala por el número máximo disponible.
    *   Nivel 1 (Max 4): 15 combinaciones posibles.
    *   ...
    *   Nivel 7 (Max 10): 66 combinaciones posibles.
*   **Sesión:** Aunque el "pool" de preguntas sea de 66, la sesión no obliga a responderlas todas para evitar fatiga.

### 3. ✖️ Multiplicaciones (Sesión Híbrida Inteligente)
Este modo está rediseñado para evitar la fatiga de hacer las 64 combinaciones (tablas del 2 al 9) de una vez.
*   **Límite Estricto:** La sesión dura **máximo 30 preguntas**.
*   **Flujo Continuo:** Siempre se avanza a la siguiente pregunta, se acierte o se falle. No hay "pregunta puente" en este modo para mantener el ritmo.
*   **Algoritmo de Selección de Preguntas (Híbrido):**
    1.  **Las primeras 15:** El sistema consulta la hoja de `Errores`. Selecciona las multiplicaciones que más ha fallado el usuario históricamente. Si tiene menos de 15 fallos registrados, rellena con aleatorias.
    2.  **Las siguientes 15:** Selección totalmente aleatoria de las tablas del 2 al 9 para asegurar repaso general.

### 4. ➗ Divisiones
Práctica de divisiones exactas básicas derivadas de las tablas de multiplicar.

---

## 🚀 Funcionalidades de "Entrenador Personal"

### El "Libro de Fallos" (`Errores` en Sheets)
El sistema registra cada operación específica que se falla.
*   *Ejemplo:* Si falla "7 x 8", se guarda esa operación concreta y se incrementa un contador.
*   Esto permite al sistema saber *qué* números específicos le cuestan más al niño, no solo qué operación general.

### Visualización de Retos
*   **Botón "Mis 10 Retos":** Muestra un gráfico de barras horizontales con las 10 operaciones más falladas.
*   **Objetivo:** Gamificar la dificultad. Ver gráficamente cuáles son los "enemigos" a batir ayuda al niño a focalizarse.

### Modo de Repaso Inteligente
Un botón dedicado que genera una sesión personalizada.
*   **Composición:**
    *   **70%** de las preguntas son operaciones extraídas de su lista de fallos frecuentes (ponderadas: a más fallos, más probabilidad de salir).
    *   **30%** son operaciones muy fáciles (refuerzo positivo) para mantener la moral alta y dar "descansos mentales".

---

## 📋 Lista de Tareas Pendientes (Roadmap)

- [x] Implementar JSONP para solucionar errores CORS en lectura.
- [x] Implementar `no-cors` para escritura robusta en Sheets.
- [x] Crear sistema de registro de errores granulares.
- [x] Crear gráfico de "Mis 10 Retos".
- [ ] **Ajustar lógica de Restas:** Implementar los niveles progresivos (1 al 7) para que coincidan con la dificultad de las sumas y evitar el pool inicial de 66 preguntas.
- [ ] **Ajustar lógica de Multiplicaciones:** Implementar el límite de 30 preguntas y el algoritmo híbrido (15 fallos + 15 random).

---
*Documentación actualizada a Diciembre 2025.*
