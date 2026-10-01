// Configuración de las pruebas del Dojo
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: '.',
    testMatch: '*.spec.js',
    timeout: 90000,
    // Si algo se rompe de verdad, parar pronto en vez de esperar a que fallen todas
    maxFailures: 4,
    fullyParallel: true,
    workers: 4,
    reporter: [['list']],
    use: {
        // Tamaño de un iPad en horizontal
        viewport: { width: 1180, height: 820 },
        hasTouch: true,
        screenshot: 'only-on-failure'
    }
});
