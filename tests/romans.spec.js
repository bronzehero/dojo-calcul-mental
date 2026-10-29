// Romans pas a pas (des del 29/10): una escala que comença molt fàcil. Primer l'exemple explicat (amb veu i imatge),
// després el MATEIX exemple, després dues que canvien un pèl. Si les tres surten a la primera, puja un graó
// (i aquell dia prova també el següent); si un graó no surt en 3 dies, queda «encallat».
const { test, expect, URL_APP, simularSupabase, teclear } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-20' }]);
const EXTRES_FETES = [{ id: 102, fecha: '2026-10-16' }, { id: 103, fecha: '2026-10-17' }];

async function preparar(page, dia, romans = null) {
    const { envios } = await simularSupabase(page, { tema1: true });
    await page.clock.setFixedTime(new Date(`${dia}T17:00:00`));
    await page.addInitScript(([p, st]) => {
        if (sessionStorage.getItem('plan-preparado')) return;
        sessionStorage.setItem('plan-preparado', '1');
        localStorage.setItem('dojo_plan', JSON.stringify(p));
        if (st) localStorage.setItem('dojo_romans', JSON.stringify(st));
    }, [{ hechas: PLAN_ACABAT, extras: EXTRES_FETES, enCurso: { id: 10, bloque: 2, fecha: dia } }, romans]);
    await page.goto(URL_APP);
    await page.click('#btn-start-game');
    await expect(page.locator('#intro-titulo')).toHaveText('Tema 1 de mates');
    await page.click('#btn-intro-vamos');
    return envios;
}

const actual = page => page.evaluate(() => window.__tema1Actual());
async function seguent(page, anterior) {
    await expect.poll(async () => JSON.stringify(await actual(page))).not.toBe(anterior);
    return actual(page);
}
const estat = page => page.evaluate(() => JSON.parse(localStorage.getItem('dojo_romans')));

/** Contesta les preguntes de romans que vinguin; fallar: textos que s'han de contestar malament. Torna el que ha sortit. */
async function contestarRomans(page, fallar = [], anterior = 'null') {
    const vistes = [];
    for (;;) {
        const t = await seguent(page, anterior);
        if (!t.modo.startsWith('roma')) return { vistes, seguent: t };
        vistes.push([t.modo, t.texto]);
        if (fallar.includes(`${t.modo}:${t.texto}`)) {
            await teclear(page, Number(t.esperado) + 1);
            await expect(page.locator('#gentle-correction-box')).toBeVisible();
            await expect(page.locator('#correction-pista')).toBeVisible();
            expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
            await page.click('#btn-correction-continue');
        } else await teclear(page, t.esperado);
        anterior = JSON.stringify(t);
    }
}

test.describe('Romans pas a pas', () => {
    test("el primer dia: l'exemple explicat, el mateix, dues variacions; tot bé → el graó següent el mateix dia", async ({ page }) => {
        const envios = await preparar(page, '2026-10-29');
        // L'exemple: l'explicació a dalt, la imatge (la mà, el dit) sobre cada lletra, i el + entre lletres
        const t = await seguent(page, 'null');
        expect(t).toMatchObject({ modo: 'roma-exemple', texto: 'VI', esperado: '6' });
        await expect(page.locator('#tema1-preg')).toContainText('La V és una mà oberta ✋');
        await expect(page.locator('#tema1-preg')).toContainText('5 + 1 = 6');
        await expect(page.locator('#op-factors .ima')).toHaveText(['✋', '☝️']);
        await expect(page.locator('#op-factors .mes')).toHaveCount(1);
        await teclear(page, 6);
        // El mateix, sense l'explicació (amb la imatge); les variacions, sense imatge
        const t2 = await seguent(page, JSON.stringify(t));
        expect(t2).toMatchObject({ modo: 'roma', texto: 'VI' });
        await expect(page.locator('#tema1-preg')).toHaveText('Quin número és? Suma el que val cada lletra.');
        await expect(page.locator('#op-factors .ima')).toHaveCount(2);
        await teclear(page, 6);
        const t3 = await seguent(page, JSON.stringify(t2));
        expect(t3.texto).toBe('VII');
        await expect(page.locator('#op-factors .ima')).toHaveCount(0);
        await expect(page.locator('#op-factors .mes')).toHaveCount(2);
        await teclear(page, 7);
        const { vistes, seguent: despres } = await contestarRomans(page, [], JSON.stringify(t3));
        expect(vistes).toEqual([['roma', 'III'], ['roma-exemple', 'XI'], ['roma', 'XI'], ['roma', 'XII'], ['roma', 'XV']]);
        expect(despres.modo).toBe('binari');
        expect(await estat(page)).toMatchObject({ nivell: 2, encallat: null });
        expect((await estat(page)).dies).toEqual([{ dia: '2026-10-29', nivell: 0, be: true }, { dia: '2026-10-29', nivell: 1, be: true }]);
        const dades = envios.filter(e => e.datos.modulo === 'tema1' && e.datos.detalle.modo.startsWith('roma')).map(e => e.datos.detalle);
        expect(dades).toHaveLength(8);
        expect(dades.every(d => d.nivell !== undefined && d.pas)).toBe(true);
        expect(envios.some(e => e.datos.modulo === 'romans' && e.datos.item === 'estado')).toBe(true);
    });

    test("si una del graó no surt, el següent no apareix i l'endemà torna al mateix graó", async ({ page }) => {
        await preparar(page, '2026-10-29');
        const { vistes, seguent: despres } = await contestarRomans(page, ['roma:VII']);
        expect(vistes.map(v => v[1])).toEqual(['VI', 'VI', 'VII', 'III']);
        expect(despres.modo).toBe('binari');
        expect(await estat(page)).toMatchObject({ nivell: 0, dies: [{ dia: '2026-10-29', nivell: 0, be: false }] });
        const items = await page.evaluate(() => window.__itemsRomans());
        expect(items[0]).toMatchObject({ modo: 'roma-exemple', r: 'VI' });
    });

    test('3 dies sense sortir el mateix graó → encallat', async ({ page }) => {
        const dies = [{ dia: '2026-10-29', nivell: 3, be: false }, { dia: '2026-10-30', nivell: 3, be: false }];
        await preparar(page, '2026-10-31', { nivell: 3, dies });
        const { vistes } = await contestarRomans(page, ['roma:IX']);
        expect(vistes.map(v => v[1])).toEqual(['IV', 'IV', 'IX', 'XIV']);
        expect(await estat(page)).toMatchObject({ nivell: 3, encallat: 3 });
    });

    test('totes les respostes de la escala són bones i cada graó té el seu exemple i dues variacions', async ({ page }) => {
        await preparar(page, '2026-10-29');
        const escala = await page.evaluate(() => {
            const out = [];
            for (let n = 0; n < 12; n++) {
                localStorage.setItem('dojo_romans', JSON.stringify({ nivell: n, dies: [] }));
                out.push(window.__itemsRomans());
            }
            return out;
        });
        const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
        const num = s => [...s].reduce((n, c, i) => n + (v[c] < (v[s[i + 1]] || 0) ? -v[c] : v[c]), 0);
        for (const items of escala.slice(0, 9)) {
            expect(items).toHaveLength(8);
            expect(items[0].modo).toBe('roma-exemple');
            expect(items[1]).toMatchObject({ modo: 'roma', r: items[0].r, pas: 'igual' });
            for (const x of items) expect(num(x.r)).toBeGreaterThan(0);
        }
        expect(escala[9]).toHaveLength(4);
        // Acabada l'escala, el repàs de sempre (3 per llegir)
        expect(escala[10].map(x => x.modo)).toEqual(['llegir', 'llegir', 'llegir']);
    });
});

test.describe('Arrels (des del 30/10)', () => {
    test("el 30/10, dues: la primera amb el quadrat i el costat marcat, la segona sense; es guarden", async ({ page }) => {
        const envios = await preparar(page, '2026-10-30');
        expect((await page.evaluate(() => window.__itemsTema1())).map(x => x.modo)).toEqual(expect.arrayContaining(['arrel', 'arrel']));
        let { seguent: t } = await contestarRomans(page);
        const vistes = [];
        while (t && t.modo !== 'potencia') {
            if (t.modo === 'arrel') {
                const n = Number(t.esperado), q = Number(t.texto.slice(1));
                expect(n * n).toBe(q);
                const primera = vistes.length === 0;
                await expect(page.locator('#op-factors .quadrat i')).toHaveCount(primera ? q : 0);
                if (primera) await expect(page.locator('#op-factors .quadrat i.costat')).toHaveCount(n);
                await expect(page.locator('#tema1-preg')).toContainText(`dona ${q}`);
                vistes.push(n);
                if (vistes.length === 1) await teclear(page, n);
                else {
                    await teclear(page, n + 1);
                    await expect(page.locator('#correction-pista')).toContainText(`${n} · ${n} = ${q}`);
                    expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
                    await page.click('#btn-correction-continue');
                }
            } else if (t.opcions) await page.click(`#tema1-opcions [data-opcio="${t.esperado}"]`);
            else await teclear(page, t.esperado);
            t = await seguent(page, JSON.stringify(t));
        }
        expect(vistes).toHaveLength(2);
        expect(vistes[0]).not.toBe(vistes[1]);
        const dades = envios.filter(e => e.datos.modulo === 'tema1' && e.datos.detalle.modo === 'arrel').map(e => [e.datos.correcta, e.datos.detalle.quadrat]);
        expect(dades).toEqual([[true, true], [false, false]]);
    });

    test("el 29/10, encara no", async ({ page }) => {
        await preparar(page, '2026-10-29');
        expect((await page.evaluate(() => window.__itemsTema1())).map(x => x.modo)).not.toContain('arrel');
    });
});
