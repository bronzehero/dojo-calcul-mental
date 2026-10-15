// Dictat de partida (ortografia en català): surt sol a partir del 16/10 fins que el fa.
// Com un dictat de veritat: no es diu si està bé; al final de cada bloc veu les paraules ben escrites.
const { test, expect, URL_APP, simularSupabase } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-12' }]);

async function preparar(page, dia, extras = []) {
    const { envios } = await simularSupabase(page);
    await page.clock.setFixedTime(new Date(`${dia}T17:00:00`));
    await page.addInitScript(p => {
        if (sessionStorage.getItem('plan-preparado')) return;
        sessionStorage.setItem('plan-preparado', '1');
        localStorage.setItem('dojo_plan', JSON.stringify(p));
    }, { hechas: PLAN_ACABAT, extras });
    await page.goto(URL_APP);
    return envios;
}

/** Escriu amb el teclat de lletres de la pantalla */
async function escriure(page, text) {
    for (const c of text) await page.click(`#teclat-lletres [data-tecla="${c}"]`);
}

test.describe('Dictat de partida', () => {
    test('abans del 16/10 surt l\'entrenament', async ({ page }) => {
        await preparar(page, '2026-10-15');
        await expect(page.locator('#mision-titulo')).toHaveText('Entrenament');
    });

    test('el 16/10: 2 parts de 12 paraules, sense correcció, repàs al final de cada part; l\'endemà, entrenament', async ({ page }) => {
        const envios = await preparar(page, '2026-10-16');
        await expect(page.locator('#mision-titulo')).toHaveText('Dictat');
        await expect(page.locator('#mision-pasos li')).toHaveText(['✍️ Dictat, part 1', '✍️ Dictat, part 2']);
        await page.click('#btn-start-game');

        const escrites = [];
        for (let part = 0; part < 2; part++) {
            await expect(page.locator('#intro-titulo')).toHaveText(`Dictat · part ${part + 1} de 2`);
            await expect(page.locator('#intro-texto')).toContainText('Escriu només la paraula');
            await page.click('#btn-intro-vamos');
            for (let i = 0; i < 12; i++) {
                await expect(page.locator('#dictat-panel')).toBeVisible();
                await expect(page.locator('#keypad')).toBeHidden();
                await expect(page.locator('#op-factors')).toHaveText(`🎧 ${i + 1}`);
                await expect(page.locator('#btn-dictat-fet')).toBeDisabled();
                // La primera de cada part, escrita "com sona" (malament); la resta, bé
                const paraula = await page.evaluate(() => window.__dictatActual());
                const text = i === 0 ? 'xxx' : paraula;
                await escriure(page, text);
                await expect(page.locator('#dictat-escrit')).toHaveText(text);
                await page.click('#btn-dictat-fet');
                await expect(page.locator('#gentle-correction-box')).toBeHidden();
                escrites.push([paraula, text]);
            }
            await expect(page.locator('#screen-repas')).toBeVisible();
            await expect(page.locator('#repas-llista li')).toHaveCount(12);
            await expect(page.locator('#repas-llista')).toContainText(escrites[part * 12 + 1][0]);
            await expect(page.locator('#repas-llista')).not.toContainText('xxx');
            expect(await page.locator('#screen-repas').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
            await page.click('#btn-repas-seguim');
        }
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');

        await expect.poll(() => envios.filter(e => e.datos.modulo === 'dictat').length).toBe(24);
        const dades = envios.filter(e => e.datos.modulo === 'dictat').map(e => e.datos);
        expect(dades.map(d => d.esperado)).toEqual(escrites.map(e => e[0]));
        expect(dades.map(d => d.respuesta)).toEqual(escrites.map(e => e[1]));
        expect(dades.filter(d => !d.correcta).map(d => d.respuesta)).toEqual(['xxx', 'xxx']);
        expect(dades.every(d => d.detalle.mision === 102 && typeof d.detalle.escoltat === 'number' && d.detalle.teclas.length > 0)).toBe(true);
        expect(dades[0].detalle.bloc).toBe(0);
        expect(dades[23].detalle.bloc).toBe(1);
        // Les paraules amb apòstrof i amb dues paraules també s'escriuen
        expect(dades.map(d => d.esperado)).toEqual(expect.arrayContaining(["l'hora", 'el que', 'hem après', 'cançons', 'història']));

        const p = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_plan')));
        expect(p.extras.map(x => x.id)).toEqual([102]);
        expect(p.hechas).toHaveLength(PLAN_ACABAT.length);
        await page.click('#btn-summary-home');
        await expect(page.locator('#mision-hecha')).toBeVisible();
        await page.clock.setFixedTime(new Date('2026-10-17T17:00:00'));
        await page.reload();
        await expect(page.locator('#mision-titulo')).toHaveText('Les xifres');
    });

    test('teclat: esborrar, espai, accents, apòstrof; tornar-ho a escoltar es compta', async ({ page }) => {
        const envios = await preparar(page, '2026-10-16');
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await escriure(page, "l'ho");
        await page.click('#teclat-lletres [data-tecla="back"]');
        await page.click('#teclat-lletres [data-tecla="back"]');
        await escriure(page, 'à ç·');
        await expect(page.locator('#dictat-escrit')).toHaveText("l'à ç·");
        await page.click('#btn-escoltar-dictat');
        await page.click('#btn-escoltar-dictat');
        // Teclat físic (per si hi ha un teclat connectat)
        await page.keyboard.press('Backspace');
        await page.keyboard.press('a');
        await expect(page.locator('#dictat-escrit')).toHaveText("l'à ça");
        await page.keyboard.press('Enter');
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'dictat').length).toBe(1);
        const d = envios.find(e => e.datos.modulo === 'dictat').datos;
        expect(d.respuesta).toBe("l'à ça");
        expect(d.detalle.escoltat).toBe(2);
        expect(d.correcta).toBe(false);
    });

    test('a la pantalla no hi ha res de temps ni d\'errors', async ({ page }) => {
        await preparar(page, '2026-10-16');
        await page.click('#btn-start-game');
        expect(await page.locator('#screen-intro').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
        await page.click('#btn-intro-vamos');
        expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
    });
});
