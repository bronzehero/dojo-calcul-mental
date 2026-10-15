// Les xifres: surt sola a partir del 17/10 (després del dictat) fins que la fa.
// Part 1: sent una xifra i en veu dues (una en mirall o una altra xifra que s'hi assembla); toca la ben escrita.
// Part 2: sent un número de dues xifres i en veu quatre que s'hi assemblen; toca el que ha sentit.
// Sense correcció ni res d'encerts a la pantalla: es guarda què toca, on era la bona i si ho torna a escoltar.
const { test, expect, URL_APP, simularSupabase } = require('./ayudas');

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
    test('el 16/10 encara surt el dictat; el 17/10, si no ha fet el dictat, primer el dictat', async ({ page }) => {
        await preparar(page, '2026-10-16', []);
        await expect(page.locator('#mision-titulo')).toHaveText('Dictat');
        await page.clock.setFixedTime(new Date('2026-10-17T17:00:00'));
        await page.reload();
        await expect(page.locator('#mision-titulo')).toHaveText('Dictat');
    });

    test('el 17/10: 12 xifres i 12 números, sense correcció; es guarda tot; l\'endemà ja no surt', async ({ page }) => {
        const envios = await preparar(page, '2026-10-17');
        await expect(page.locator('#mision-titulo')).toHaveText('Les xifres');
        await expect(page.locator('#mision-pasos li')).toHaveText(['🔍 Quin està ben escrit?', '👂 Quin número és?']);
        await page.click('#btn-start-game');

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
            await expect(page.locator('#op-factors')).toHaveText(`🔍 ${i + 1}`);
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
            await expect(page.locator('#op-factors')).toHaveText(`👂 ${i + 1}`);
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

        const p = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_plan')));
        expect(p.extras.map(x => x.id)).toEqual([102, 103]);
        await page.click('#btn-summary-home');
        await page.clock.setFixedTime(new Date('2026-10-19T17:00:00'));
        await page.reload();
        await expect(page.locator('#mision-titulo')).toHaveText('Entrenament');
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
