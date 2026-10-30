// Els parèntesis: del 31/10 al 2/11 va AFEGIDA al final de la missió (com les xifres), un cop al dia.
// La mateixa potència de tres maneres, obre o tanca, toca la parella, què es fa primer i a trossos.
// Sense correcció ni res d'encerts a la pantalla: es guarda què contesta, en quin format i si diu «No ho sé».
const { test, expect, URL_APP, simularSupabase, teclear, respuestaCorrecta } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-12' }]);
const EXTRES_FETS = [{ id: 102, fecha: '2026-10-16' }, { id: 103, fecha: '2026-10-17' }];

async function preparar(page, dia, extras = EXTRES_FETS) {
    const { envios } = await simularSupabase(page);
    await page.clock.setFixedTime(new Date(`${dia}T17:00:00`));
    await page.addInitScript(p => {
        if (sessionStorage.getItem('plan-preparado')) return;
        sessionStorage.setItem('plan-preparado', '1');
        localStorage.setItem('dojo_plan', JSON.stringify(p));
        // Només l'entrenament: el tema 1, els accents i les paraules, en pausa (tenen les seves proves)
        ['dojo_tema1', 'dojo_accent'].forEach(k => localStorage.setItem(k, JSON.stringify({ pausa: true })));
        localStorage.setItem('dojo_paraules', JSON.stringify({ pausa: true, w: {} }));
    }, { hechas: PLAN_ACABAT, extras });
    await page.goto(URL_APP);
    return envios;
}

/** Fa l'entrenament (bé) fins que arriba als parèntesis */
async function ferEntrenament(page) {
    for (;;) {
        if (await page.isVisible('#screen-intro')) {
            if ((await page.textContent('#intro-titulo')) === 'Els parèntesis') return;
            await page.click('#btn-intro-vamos');
            continue;
        }
        if (await page.isVisible('#gentle-correction-box')) { await page.click('#btn-correction-continue'); continue; }
        if (!(await page.isVisible('#screen-game'))) { await page.waitForTimeout(100); continue; }
        const pregunta = (await page.isVisible('#pas10-panel')) ? (await page.textContent('#pas10-pregunta')) : '';
        let m;
        if ((m = pregunta.match(/^De (\d+) a 10\?$/))) { await teclear(page, 10 - parseInt(m[1], 10)); continue; }
        if ((m = pregunta.match(/^De 10 a (\d+)\?$/))) { await teclear(page, parseInt(m[1], 10) - 10); continue; }
        await teclear(page, respuestaCorrecta(await page.textContent('#op-factors')));
        await page.waitForTimeout(850);
    }
}

test.describe('Els parèntesis', () => {
    test('el 31/10: després de l\'entrenament, 17 preguntes sense correcció; es guarda tot; aquell dia ja no torna a sortir', async ({ page }) => {
        const envios = await preparar(page, '2026-10-31');
        await expect(page.locator('#mision-pasos li')).toHaveText(['🔟 Passar pel 10', /^⭐ La de la setmana/, '🧩 Els parèntesis']);
        await page.click('#btn-start-game');
        await ferEntrenament(page);
        await expect(page.locator('#intro-texto')).toContainText('No hi ha correcció');
        expect(await page.locator('#screen-intro').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
        await page.click('#btn-intro-vamos');

        const vistos = [];
        for (let i = 0; i < 17; i++) {
            await expect.poll(() => page.evaluate(() => window.__parensActual() && window.__parensActual().n)).toBe(i);
            const x = await page.evaluate(() => window.__parensActual());
            vistos.push(x);
            await expect(page.locator('#gentle-correction-box')).toBeHidden();
            await expect(page.locator('#btn-no-ho-se')).toBeVisible();
            if (i === 0) expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
            const antes = envios.filter(e => e.datos.modulo === 'parens').length;
            if (i === 1) await page.click('#btn-no-ho-se');
            else if (x.modo === 'parella') {
                await expect(page.locator('#op-factors .par-marca')).toHaveCount(1);
                await page.click(`#op-factors .par-btn[data-par="${x.esperado}"]`);
            } else if (x.opcions) await page.click(`#tema1-opcions [data-opcio="${x.esperado}"]`);
            else await teclear(page, x.esperado);
            await expect.poll(() => envios.filter(e => e.datos.modulo === 'parens').length).toBe(antes + 1);
        }
        expect(vistos.map(v => v.modo)).toEqual([...Array(6).fill('pot'), ...Array(4).fill('obre'), ...Array(3).fill('parella'), 'primer', 'primer', 'passos', 'passos']);
        // Dues de cada format, i la de colors amb les parelles pintades
        expect(vistos.slice(0, 6).map(v => v.format).sort()).toEqual(['colors', 'colors', 'espai', 'espai', 'normal', 'normal']);
        expect(vistos.filter(v => v.modo === 'obre').map(v => v.opcions)).toEqual(Array(4).fill(['Obre', 'Tanca']));

        const guardats = envios.filter(e => e.datos.modulo === 'parens').map(e => e.datos);
        expect(guardats).toHaveLength(17);
        expect(guardats[1].detalle.no_lo_se).toBe(true);
        expect(guardats.filter((g, i) => i !== 1).every(g => g.correcta)).toBe(true);
        expect(guardats.slice(0, 6).every(g => ['normal', 'espai', 'colors'].includes(g.detalle.format))).toBe(true);
        expect(guardats.filter(g => g.detalle.modo === 'passos').map(g => g.detalle.pas)).toEqual([1, 2]);

        // Acaba amb la seva photocard, i aquell dia ja no torna a sortir
        await expect(page.locator('#screen-summary')).toBeVisible();
        const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_plan')));
        expect(plan.extras).toContainEqual({ id: 104, fecha: '2026-10-31' });
    });

    test('la potència amb colors: cada parella i el seu exponent del mateix color', async ({ page }) => {
        await preparar(page, '2026-10-31');
        const html = await page.evaluate(() => window.__htmlPotParens([2, 3, 2, 4], 'colors'));
        expect(html).toContain('<span class="par-a">(</span><span class="par-b">(</span>2<sup>3</sup><span class="par-b">)<sup>2</sup></span><span class="par-a">)<sup>4</sup></span>');
    });

    test('el 30/10 i el 3/11 no hi és; el 2/11, sí', async ({ page }) => {
        for (const [dia, hiEs] of [['2026-10-30', false], ['2026-11-02', true], ['2026-11-03', false]]) {
            await page.evaluate(() => sessionStorage.clear()).catch(() => {});
            await preparar(page, dia);
            const pasos = await page.locator('#mision-pasos li').allTextContents();
            expect(pasos.includes('🧩 Els parèntesis'), dia).toBe(hiEs);
        }
    });

    test('si ja l\'ha feta avui, no surt', async ({ page }) => {
        await preparar(page, '2026-11-01', [...EXTRES_FETS, { id: 104, fecha: '2026-11-01' }]);
        await expect(page.locator('#mision-pasos li')).not.toContainText(['🧩 Els parèntesis']);
    });
});
