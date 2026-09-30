// Privacidad y acceso a los datos: el código público no revela nada de la alumna
// y los datos solo se leen con la clau de papà.
const fs = require('fs');
const path = require('path');
const {
    test, expect, URL_APP, CLAVE_BUENA, simularSupabase, empezarEnMision, contestarBloqueNumerico
} = require('./ayudas');

const RAIZ = path.resolve(__dirname, '..');
const DATOS_PERSONALES = /abril|dislèxi|dislexi|discalc|disgraf|disortograf/i;

test.describe('Nada personal en lo que se publica', () => {
    test('README, index.html y pruebas no contienen nombre ni diagnósticos', async () => {
        const archivos = ['README.md', 'index.html', ...fs.readdirSync(__dirname)
            .filter(f => /\.(js|json|sh)$/.test(f) && f !== 'package-lock.json' && f !== 'privacidad.spec.js')
            .map(f => path.join('tests', f))];
        for (const f of archivos) {
            let texto = fs.readFileSync(path.join(RAIZ, f), 'utf8');
            if (f === 'index.html') {
                // Única excepción: las claves antiguas del iPad, necesarias para migrar su progreso
                texto = texto.replace(/'dojo_abril_[a-z_]+'/g, '');
            }
            expect(texto, `datos personales en ${f}`).not.toMatch(DATOS_PERSONALES);
        }
    });

    test('sin nombre configurado, saluda sin nombre', async ({ page }) => {
        await simularSupabase(page);
        await page.goto(URL_APP);
        await expect(page.locator('#saludo')).toHaveText('Hola!');
        expect(await page.title()).toBe('Dojo');
    });

    test('la app nunca intenta leer las tablas directamente', async ({ page }) => {
        const { lecturas } = await simularSupabase(page);
        await page.goto(URL_APP);
        await page.click('#btn-open-papa');
        await page.waitForTimeout(500);
        const directas = lecturas.filter(l => l.url && /\/rest\/v1\/(registros|eventos)/.test(l.url));
        // Solo se permite leer qué misiones están hechas (para recuperar el plan)
        for (const l of directas) expect(l.url).toContain('modulo=eq.mision');
    });
});

test.describe('Nombre configurable desde la Zona Papá', () => {
    test('se guarda en el iPad y aparece en el saludo y al acabar', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 1, { enCurso: { id: 1, bloque: 1 } });
        await page.goto(URL_APP);
        await page.click('#btn-open-papa');
        await page.fill('#inp-nombre', 'Maria');
        await page.click('#btn-guardar-nombre');
        await page.click('#btn-close-papa');
        await expect(page.locator('#saludo')).toHaveText('Hola, Maria!');

        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await contestarBloqueNumerico(page);
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta, Maria!');

        await page.reload();
        await expect(page.locator('#saludo')).toHaveText('Hola, Maria!');
    });
});

test.describe('Clau de papà', () => {
    const DATOS = {
        registros: [{ creado_el: '2026-09-30T18:41:42Z', operacion: '6 x 8', factor_a: 6, factor_b: 8, esperado: 48, respuesta_dada: 54, correcta: false, tiempo_segundos: 3.75, distraccion: false, ciclo: 3 }],
        eventos: [
            { modulo: 'teclear', correcta: true, tiempo_ms: 2000, detalle: {} },
            { modulo: 'teclear', correcta: true, tiempo_ms: 3000, detalle: {} },
            { modulo: 'mision', item: '1', correcta: null, tiempo_ms: null, detalle: {} }
        ]
    };

    test('sin clave no se ven los datos; con clave incorrecta avisa', async ({ page }) => {
        await simularSupabase(page, { datos: DATOS });
        await page.goto(URL_APP);
        await page.click('#btn-open-papa');
        await expect(page.locator('#papa-acceso')).toBeVisible();
        await expect(page.locator('#plan-resultados')).toContainText('clau de papà');
        await expect(page.locator('#stat-total-records')).toHaveText('0');

        await page.fill('#inp-clave', 'una-que-no-es');
        await page.click('#btn-guardar-clave');
        await expect(page.locator('#clave-msg')).toHaveText('Clau incorrecta.');
        expect(await page.evaluate(() => localStorage.getItem('dojo_clave_papa'))).toBeNull();
    });

    test('con la clave buena se ven los datos y se recuerda en el iPad', async ({ page }) => {
        await simularSupabase(page, { datos: DATOS });
        await page.goto(URL_APP);
        await page.click('#btn-open-papa');
        await page.fill('#inp-clave', CLAVE_BUENA);
        await page.click('#btn-guardar-clave');
        await expect(page.locator('#papa-acceso')).toBeHidden();
        await expect(page.locator('#stat-total-records')).toHaveText('1');
        await expect(page.locator('#plan-resultados')).toContainText('Escriure números');
        await expect(page.locator('#plan-resultados')).toContainText('2/2');

        await page.click('#btn-close-papa');
        await page.reload();
        await page.click('#btn-open-papa');
        await expect(page.locator('#papa-acceso')).toBeHidden();
        await expect(page.locator('#stat-total-records')).toHaveText('1');
    });

    test('si la clave guardada deja de valer, se borra y se vuelve a pedir', async ({ page }) => {
        await simularSupabase(page, { datos: DATOS });
        await page.addInitScript(() => localStorage.setItem('dojo_clave_papa', 'clau-antiga'));
        await page.goto(URL_APP);
        await page.click('#btn-open-papa');
        await expect(page.locator('#papa-acceso')).toBeVisible();
        await expect(page.locator('#clave-msg')).toHaveText('La clau ha canviat o no és correcta.');
    });
});

test.describe('Paso de las claves antiguas del iPad', () => {
    test('el progreso guardado con las claves viejas se conserva', async ({ page }) => {
        await simularSupabase(page);
        await page.addInitScript(() => {
            if (sessionStorage.getItem('hecho')) return;
            sessionStorage.setItem('hecho', '1');
            localStorage.setItem('dojo_abril_plan', JSON.stringify({ hechas: [{ id: 1, fecha: '2026-09-30' }] }));
            localStorage.setItem('dojo_abril_deck', JSON.stringify({ ciclo: 3, mazo: [{ a: 7, b: 8 }], totalCartas: 64 }));
            localStorage.setItem('dojo_abril_pendientes', JSON.stringify([{ tabla: 'eventos', datos: { modulo: 'teclear' } }]));
        });
        const { envios } = await simularSupabase(page);
        await page.goto(URL_APP);
        await expect(page.locator('#mision-titulo')).toHaveText('Sumes');
        const claves = await page.evaluate(() => Object.keys(localStorage));
        expect(claves.some(k => k.startsWith('dojo_abril_'))).toBe(false);
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_deck')).ciclo)).toBe(3);
        // Lo que estaba pendiente de subir se sube
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'teclear').length).toBe(1);
    });
});
