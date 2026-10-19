// Configuración de las pruebas del Dojo
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: '.',
    testMatch: '*.spec.js',
    timeout: 90000,
    // Si algo se rompe de verdad, parar pronto en vez de esperar a que fallen todas
    maxFailures: 4,
    fullyParallel: true,
    // Todos los hilos del PC a la vez: casi todo el tiempo es esperar las pausas de la app, no CPU
    workers: '100%',
    // Con todos los hilos, alguna prueba de tiempos falla de vez en cuando por carga (cada vez otra, y sola pasa).
    // Se repite una vez: un fallo de verdad falla las dos y no se publica.
    retries: 1,
    reporter: [['list']],
    use: {
        // Tamaño de un iPad en horizontal
        viewport: { width: 1180, height: 820 },
        hasTouch: true,
        screenshot: 'only-on-failure'
    }
});
