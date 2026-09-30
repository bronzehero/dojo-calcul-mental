// Configuración de las pruebas del Dojo
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: '.',
    testMatch: '*.spec.js',
    timeout: 180000,
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
