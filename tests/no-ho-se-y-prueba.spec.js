// "No ho sé" (mejor que adivinar) y modo prueba de papá (ve la misión igual que ella, sin guardar nada).
const {
    test, expect, URL_APP, simularSupabase, empezarEnMision, respuestaCorrecta, teclear, contestarBloqueNumerico
} = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+/i;

test.describe('No ho sé', () => {
    test('en las multiplicaciones: enseña la respuesta sin sonido de error y se guarda como "no lo sé"', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 1, { enCurso: { id: 1, bloque: 1 } });
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-texto')).toContainText('Si no ho saps, prem «No ho sé»');
        await page.click('#btn-intro-vamos');
        await expect(page.locator('#btn-no-ho-se')).toBeVisible();
        const texto = await page.textContent('#op-factors');
        await page.click('#btn-no-ho-se');
        await expect(page.locator('#correction-title')).toHaveText('Cap problema! 🌸 Fixa-t\'hi:');
        await expect(page.locator('#correction-math-text')).toHaveText(`${texto} = ${respuestaCorrecta(texto)}`);
        await expect(page.locator('#btn-no-ho-se')).toBeHidden();
        expect(await page.textContent('#screen-game')).not.toMatch(PROHIBIDO_EN_PANTALLA);
        await page.click('#btn-correction-continue');
        await expect(page.locator('#btn-no-ho-se')).toBeVisible();

        await expect.poll(() => envios.filter(e => e.tabla === 'registros').length).toBe(1);
        const r = envios.find(e => e.tabla === 'registros').datos;
        expect(r.respuesta_dada).toBeNull();
        expect(r.correcta).toBe(false);
        expect(r.detalle.no_lo_se).toBe(true);
        expect(r.esperado).toBe(respuestaCorrecta(texto));

        // El resto del bloque sigue normal y la misión se acaba
        expect(await contestarBloqueNumerico(page)).toBe(9);
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');
    });

    test('al copiar números no aparece; en sumas sí', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 1);
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await expect(page.locator('#btn-no-ho-se')).toBeHidden();

        await page.evaluate(() => localStorage.setItem('dojo_plan', JSON.stringify({ hechas: [{ id: 1, fecha: '2026-01-01' }] })));
        await page.reload();
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await page.click('#btn-no-ho-se');
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'suma').length).toBe(1);
        const ev = envios.find(e => e.datos.modulo === 'suma').datos;
        expect(ev.respuesta).toBeNull();
        expect(ev.correcta).toBe(false);
        expect(ev.detalle.no_lo_se).toBe(true);
    });

    test('en "Està bé o no?" también, y enseña la multiplicación correcta', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 3);
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await expect(page.locator('#btn-no-ho-se')).toBeVisible();
        const [izq] = (await page.textContent('#op-factors')).split('=');
        const [a, b] = izq.split('×').map(Number);
        await page.click('#btn-no-ho-se');
        await expect(page.locator('#correction-math-text')).toHaveText(`${a} × ${b} = ${a * b}`);
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'vf').length).toBe(1);
        expect(envios.find(e => e.datos.modulo === 'vf').datos.detalle.no_lo_se).toBe(true);
    });

    test('en la Zona Papá se cuentan los "no lo sé"', async ({ page }) => {
        await simularSupabase(page, {
            datos: {
                registros: [],
                eventos: [
                    { modulo: 'suma', correcta: true, tiempo_ms: 3000, detalle: {} },
                    { modulo: 'suma', correcta: false, respuesta: null, tiempo_ms: 5000, detalle: { no_lo_se: true } }
                ]
            }
        });
        await page.addInitScript(() => localStorage.setItem('dojo_clave_papa', 'clau-de-prova-123'));
        await page.goto(URL_APP);
        await page.click('#btn-open-papa');
        await expect(page.locator('#plan-resultados')).toContainText('«no lo sé»: 1');
    });
});

test.describe('Modo prueba de papá', () => {
    /** Foto de todo lo que la app guarda en el iPad. */
    const estadoIpad = page => page.evaluate(() => {
        const o = {};
        for (const k of Object.keys(localStorage)) if (k.startsWith('dojo_')) o[k] = localStorage.getItem(k);
        return o;
    });

    test('desde la Zona Papá: la misión entera como la verá ella, sin guardar ni enviar nada', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 2);
        await page.goto(URL_APP);
        await page.evaluate(() => localStorage.setItem('dojo_deck', JSON.stringify({ ciclo: 3, totalCartas: 64, mazo: [{ a: 7, b: 8 }] })));
        const antes = await estadoIpad(page);

        await page.click('#btn-open-papa');
        await page.selectOption('#sel-mision', '1'); // 2. Sumes
        await page.click('#btn-probar');
        await expect(page.locator('#banner-prueba')).toBeVisible();
        await expect(page.locator('#intro-titulo')).toHaveText('Sumes');
        await page.click('#btn-intro-vamos');
        await page.click('#btn-no-ho-se');
        await page.click('#btn-correction-continue');
        expect(await contestarBloqueNumerico(page, [0])).toBe(31);
        await expect(page.locator('#intro-titulo')).toHaveText('Multiplicacions');
        await expect(page.locator('#banner-prueba')).toBeVisible();
        await page.click('#btn-intro-vamos');
        expect(await contestarBloqueNumerico(page)).toBe(10);
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');
        await expect(page.locator('#photocard-etiqueta')).toHaveText('Photocard (prova) ✦');
        await expect(page.locator('#banner-prueba')).toBeVisible();

        await page.click('#btn-summary-home');
        await expect(page.locator('#banner-prueba')).toBeHidden();
        await expect(page.locator('#mision-titulo')).toHaveText('Sumes');
        await expect(page.locator('#btn-start-game')).toBeVisible();

        await page.waitForTimeout(500);
        expect(envios).toEqual([]);
        expect(await estadoIpad(page)).toEqual(antes);
    });

    test('se puede parar a medias y la misión de ella no cambia', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 2, { enCurso: { id: 2, bloque: 1 } });
        await page.goto(URL_APP);
        await page.click('#btn-open-papa');
        const antes = await estadoIpad(page);
        await page.click('#btn-probar');
        await page.click('#btn-intro-vamos');
        await teclear(page, 1);
        await page.click('#btn-exit-game');
        await page.click('#btn-summary-home');
        await expect(page.locator('#banner-prueba')).toBeHidden();
        await page.waitForTimeout(300);
        expect(envios).toEqual([]);
        expect(await estadoIpad(page)).toEqual(antes);
    });

    test('con ?prova en la dirección (móvil de papá) todo va en prueba', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await page.goto(URL_APP + '?prova');
        await expect(page.locator('#banner-prueba')).toBeVisible();
        await expect(page.locator('#mision-titulo')).toHaveText('Números i taules');
        const antes = await estadoIpad(page);
        await page.click('#btn-start-game');
        await expect(page.locator('#banner-prueba')).toBeVisible();
        await page.click('#btn-intro-vamos');
        expect(await contestarBloqueNumerico(page)).toBe(20);
        await page.click('#btn-intro-vamos');
        expect(await contestarBloqueNumerico(page)).toBe(10);
        await expect(page.locator('#photocard-etiqueta')).toHaveText('Photocard (prova) ✦');
        await page.click('#btn-summary-home');
        // Sigue en prueba y se puede repetir
        await expect(page.locator('#banner-prueba')).toBeVisible();
        await expect(page.locator('#btn-start-game')).toBeVisible();
        await page.waitForTimeout(300);
        expect(envios).toEqual([]);
        expect(await estadoIpad(page)).toEqual(antes);
    });
});
