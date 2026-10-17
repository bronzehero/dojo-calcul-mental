// Les xifres: a partir del 17/10 va AFEGIDA: quan acaba l'entrenament (o el repàs del diumenge), que es guarda com sempre,
// comença la de les xifres, fins que la fa un cop. No substitueix res. El papa la pot posar sola un altre dia.
// Part 1: sent una xifra i en veu dues (una en mirall o una altra xifra que s'hi assembla); toca la ben escrita.
// Part 2: sent un número de dues xifres i en veu quatre que s'hi assemblen; toca el que ha sentit.
// Sense correcció ni res d'encerts a la pantalla: es guarda què toca, on era la bona i si ho torna a escoltar.
const { test, expect, URL_APP, simularSupabase, teclear, respuestaCorrecta } = require('./ayudas');

/** Fa l'entrenament (bé) fins que arriba a la part de les xifres */
async function ferEntrenament(page) {
    const titols = [];
    for (;;) {
        if (await page.isVisible('#screen-intro')) {
            const t = await page.textContent('#intro-titulo');
            if (t === 'Quin està ben escrit?') return titols;
            titols.push(t);
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

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-12' }]);
const DICTAT_FET = [{ id: 102, fecha: '2026-10-16' }];

async function preparar(page, dia, extras = DICTAT_FET) {
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

test.describe('Les xifres', () => {
    test('el 16/10, el dictat tal qual; el 17/10, si no ha fet el dictat, el dictat (sense xifres)', async ({ page }) => {
        await preparar(page, '2026-10-16', []);
        await expect(page.locator('#mision-titulo')).toHaveText('Dictat');
        await expect(page.locator('#mision-pasos li')).toHaveCount(2);
        await page.clock.setFixedTime(new Date('2026-10-17T17:00:00'));
        await page.reload();
        await expect(page.locator('#mision-titulo')).toHaveText('Dictat');
        await expect(page.locator('#mision-pasos li')).toHaveText(['✍️ Dictat, part 1', '✍️ Dictat, part 2']);
    });

    test('el 17/10: entrenament sencer i, afegides al final, 12 xifres i 12 números, sense correcció; es guarda tot; l\'endemà ja no surt', async ({ page }) => {
        const envios = await preparar(page, '2026-10-17');
        await expect(page.locator('#mision-titulo')).toHaveText('Entrenament');
        await expect(page.locator('#mision-pasos li')).toHaveText(['🔟 Passar pel 10', '⭐ La de la setmana: 6 × 8', '🔍 Quin està ben escrit?', '👂 Quin número és?']);
        await page.click('#btn-start-game');
        // Primer l'entrenament sencer, com cada dia
        expect(await ferEntrenament(page)).toEqual(['Passar pel 10', 'La de la setmana']);

        // Part 1: la primera, l'altra (en mirall o una altra xifra); la resta, la bona
        await expect(page.locator('#intro-titulo')).toHaveText('Quin està ben escrit?');
        await expect(page.locator('#intro-texto')).toContainText('Toca el que està ben escrit');
        expect(await page.locator('#screen-intro').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
        await page.click('#btn-intro-vamos');
        const triades = [];
        for (let i = 0; i < 12; i++) {
            await expect(page.locator('#xifres-panel')).toBeVisible();
            await expect(page.locator('#keypad')).toBeHidden();
            await expect(page.locator('#btn-no-ho-se')).toBeHidden();
            await expect(page.locator('#op-factors')).toHaveText('🔍');
            await expect.poll(() => page.evaluate(() => window.__xifraActual().n)).toBe(i + 1);
            await expect(page.locator('#xifres-opcions .xifra-btn')).toHaveCount(2);
            const x = await page.evaluate(() => window.__xifraActual());
            expect(x.opcions).toContain(x.esperado);
            const tria = i === 0 ? x.opcions.find(o => o !== x.esperado) : x.esperado;
            if (i === 1) await page.click('#btn-escoltar-xifra');
            if (i === 0) expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
            await page.click(`#xifres-opcions [data-xifra="${tria}"]`);
            await expect(page.locator('#gentle-correction-box')).toBeHidden();
            triades.push([x.esperado, tria]);
        }

        // Part 2: quatre opcions; totes s'assemblen (mateixes xifres, al revés o amb un 2/5 o 6/9 girat)
        await expect(page.locator('#intro-titulo')).toHaveText('Quin número és?');
        await page.click('#btn-intro-vamos');
        const numeros = [];
        for (let i = 0; i < 12; i++) {
            await expect(page.locator('#op-factors')).toHaveText('👂');
            await expect.poll(() => page.evaluate(() => window.__xifraActual().n)).toBe(i + 1);
            await expect(page.locator('#xifres-opcions .xifra-btn')).toHaveCount(4);
            const x = await page.evaluate(() => window.__xifraActual());
            expect(new Set(x.opcions).size).toBe(4);
            expect(x.opcions).toContain(x.esperado);
            const tria = i === 0 ? x.opcions.find(o => o === x.esperado[1] + x.esperado[0]) : x.esperado;
            await page.click(`#xifres-opcions [data-xifra="${tria}"]`);
            numeros.push([x.esperado, tria]);
        }
        await expect(page.locator('#summary-titulo')).toBeVisible();
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');

        await expect.poll(() => envios.filter(e => ['xifra', 'sentir'].includes(e.datos.modulo)).length).toBe(24);
        const a = envios.filter(e => e.datos.modulo === 'xifra').map(e => e.datos);
        const b = envios.filter(e => e.datos.modulo === 'sentir').map(e => e.datos);
        expect(a.map(d => [d.esperado, d.respuesta])).toEqual(triades);
        expect(b.map(d => [d.esperado, d.respuesta])).toEqual(numeros);
        expect(a[0].correcta).toBe(false);
        expect(a.slice(1).every(d => d.correcta)).toBe(true);
        expect(a[1].detalle.escoltat).toBe(1);
        expect(a.every(d => d.detalle.mision === 103 && d.detalle.opcions.length === 2 && typeof d.tiempo_ms === 'number')).toBe(true);
        // Totes les xifres en mirall i els parells 6/9 i 2/5, en els dos sentits
        expect(a.map(d => d.item).sort()).toEqual(['1|mirall', '2|5', '2|mirall', '3|mirall', '4|mirall', '5|2', '5|mirall',
            '6|9', '6|mirall', '7|mirall', '9|6', '9|mirall']);
        expect(b.map(d => Number(d.esperado)).sort((p, q) => p - q)).toEqual([24, 25, 26, 42, 45, 52, 54, 59, 62, 69, 95, 96]);
        expect(b[0].correcta).toBe(false);
        // El 24 s'ofereix amb el 42, el 54 i el 45
        const d24 = b.find(d => d.esperado === '24');
        expect([...d24.detalle.opcions].sort()).toEqual(['24', '42', '45', '54']);

        // L'entrenament compta com cada dia (i l'estat de la fase 1 s'actualitza); les xifres, a part
        const p = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_plan')));
        expect(p.extras.map(x => x.id)).toEqual([102, 103]);
        expect(p.hechas[p.hechas.length - 1]).toEqual({ id: 10, fecha: '2026-10-17' });
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'fase1').length).toBe(1);
        expect(envios.filter(e => e.datos.modulo === 'mision').map(e => e.datos.item)).toEqual(['10', '103']);
        await expect(page.locator('#photocard-zona')).toBeVisible();
        await page.click('#btn-summary-home');
        await expect(page.locator('#mision-hecha')).toBeVisible();
        // Dilluns: l'entrenament de sempre, sense les xifres
        await page.clock.setFixedTime(new Date('2026-10-19T17:00:00'));
        await page.reload();
        await expect(page.locator('#mision-titulo')).toHaveText('Entrenament');
        await expect(page.locator('#mision-pasos li')).toHaveCount(2);
    });

    test('si para a mitad de les xifres: l\'entrenament ja compta, té la seva photocard, i l\'endemà les xifres continuen després de l\'entrenament', async ({ page }) => {
        const envios = await preparar(page, '2026-10-17');
        await page.click('#btn-start-game');
        await ferEntrenament(page);
        await page.click('#btn-intro-vamos');
        await page.click('#xifres-opcions .xifra-btn >> nth=0');
        await expect.poll(() => page.evaluate(() => window.__xifraActual().n)).toBe(2);
        await page.click('#btn-exit-game');
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');
        await expect(page.locator('#photocard-zona')).toBeVisible();
        let p = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_plan')));
        expect(p.hechas[p.hechas.length - 1]).toEqual({ id: 10, fecha: '2026-10-17' });
        expect(p.extras.map(x => x.id)).toEqual([102]);
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'fase1').length).toBe(1);
        await page.click('#btn-summary-home');
        await expect(page.locator('#mision-hecha')).toBeVisible();
        // Diumenge: el repàs i, després, les xifres
        await page.clock.setFixedTime(new Date('2026-10-18T17:00:00'));
        await page.reload();
        await expect(page.locator('#mision-titulo')).toHaveText('Missió de repàs');
        await expect(page.locator('#mision-pasos li')).toHaveText(['🧭 Restes, sumes i multiplicacions', '🔍 Quin està ben escrit?', '👂 Quin número és?']);
        await page.click('#btn-start-game');
        expect(await ferEntrenament(page)).toEqual(['Missió de repàs']);
        await page.click('#btn-intro-vamos');
        for (let i = 0; i < 12; i++) {
            const x = await page.evaluate(() => window.__xifraActual());
            await page.click(`#xifres-opcions [data-xifra="${x.esperado}"]`);
            if (i < 11) await expect.poll(() => page.evaluate(() => window.__xifraActual().n)).toBe(i + 2);
        }
        await expect(page.locator('#intro-titulo')).toHaveText('Quin número és?');
        await page.click('#btn-intro-vamos');
        for (let i = 0; i < 12; i++) {
            const x = await page.evaluate(() => window.__xifraActual());
            await page.click(`#xifres-opcions [data-xifra="${x.esperado}"]`);
            if (i < 11) await expect.poll(() => page.evaluate(() => window.__xifraActual().n)).toBe(i + 2);
        }
        await expect(page.locator('#summary-titulo')).toBeVisible();
        p = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_plan')));
        expect(p.extras.map(x => x.id)).toEqual([102, 11, 103]);
    });

    test('la bona no surt sempre al mateix costat ni la mateixa xifra dues vegades seguides', async ({ page }) => {
        await preparar(page, '2026-10-17');
        const items = await page.evaluate(() => {
            const out = [];
            for (let k = 0; k < 20; k++) out.push(...window.__itemsXifresProva());
            return out;
        });
        const esquerra = items.filter(x => x.buenaIzq).length;
        expect(esquerra).toBeGreaterThan(items.length * 0.3);
        expect(esquerra).toBeLessThan(items.length * 0.7);
        for (let k = 0; k < 20; k++) {
            const l = items.slice(k * 12, k * 12 + 12);
            expect(l.every((c, i) => i === 0 || c.x !== l[i - 1].x)).toBe(true);
        }
    });

    test('la Zona Papa la pot tornar a posar un altre dia', async ({ page }) => {
        await preparar(page, '2026-10-20', [...DICTAT_FET, { id: 103, fecha: '2026-10-17' }]);
        await expect(page.locator('#mision-titulo')).toHaveText('Entrenament');
        await page.click('#btn-open-papa');
        await page.selectOption('#sel-mision', 'x103');
        await page.click('#btn-set-mision');
        await expect(page.locator('#plan-lista')).toContainText('Puesta para hoy');
        await page.click('#btn-close-papa');
        await expect(page.locator('#mision-titulo')).toHaveText('Les xifres');
    });
});
