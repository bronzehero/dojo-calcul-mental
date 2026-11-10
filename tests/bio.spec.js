// Bio per a l'examen del dimarts 17/11 (tema 1, l'activitat científica): de l'11 al 16/11, després de la tònica.
// Triar entre 3; si falla, la bona i per què, torna al final del bloc i l'endemà surt primer.
// Si el mateix dia fa una segona missió, només surten les que va fallar a la primera.
const { test, expect, URL_APP, simularSupabase } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-21' }]);
const EXTRES_FETES = [{ id: 102, fecha: '2026-10-16' }, { id: 103, fecha: '2026-10-17' }];

async function preparar(page, dia, opciones = {}, bio = null) {
    const { envios } = await simularSupabase(page, { bio: true, ...opciones });
    await page.clock.setFixedTime(new Date(`${dia}T17:00:00`));
    await page.addInitScript(([p, s]) => {
        if (sessionStorage.getItem('plan-preparado')) return;
        sessionStorage.setItem('plan-preparado', '1');
        localStorage.setItem('dojo_plan', JSON.stringify(p));
        if (s) localStorage.setItem('dojo_bio', JSON.stringify(s));
    }, [{ hechas: PLAN_ACABAT, extras: EXTRES_FETES }, bio]);
    await page.goto(URL_APP);
    return envios;
}
const actual = page => page.evaluate(() => window.__tema1Actual());
async function seguent(page, anterior) {
    await expect.poll(async () => JSON.stringify(await actual(page))).not.toBe(anterior);
    return actual(page);
}
const pasos = page => page.locator('#mision-pasos li').allTextContents();
const BIO = "🔬 Bio per a l'examen";

test.describe("Bio per a l'examen", () => {
    for (const [dia, hi] of [['2026-11-10', false], ['2026-11-11', true], ['2026-11-16', true], ['2026-11-17', false]]) {
        test(`el ${dia}, ${hi ? 'hi és, després de la tònica i abans dels accents' : 'no hi és'}`, async ({ page }) => {
            await preparar(page, dia, { accent: true, tonica: true });
            await expect.poll(async () => (await pasos(page)).length).toBeGreaterThan(1);
            const p = await pasos(page);
            if (hi) {
                const i = p.indexOf(BIO);
                expect(i).toBeGreaterThan(0);
                expect(p[i - 1]).toContain('On pica la força');
                expect(p[i + 1]).toContain('Accents');
            } else expect(p.join(' ')).not.toContain('Bio');
        });
    }

    for (const [dia, blocs] of [['2026-11-11', { bloc1: 8 }], ['2026-11-12', { bloc1: 3, bloc2: 6 }], ['2026-11-13', { bloc1: 2, bloc2: 3, bloc3: 5 }],
        ['2026-11-14', { bloc1: 2, bloc2: 2, bloc3: 2, bloc4: 5 }], ['2026-11-16', { bloc1: 3, bloc2: 3, bloc3: 3, bloc4: 3 }]]) {
        test(`el ${dia}, els blocs que toquen: ${JSON.stringify(blocs)}`, async ({ page }) => {
            await preparar(page, dia);
            const items = await page.evaluate(() => window.__itemsBio());
            const compte = {};
            items.forEach(x => { compte[`bloc${x.bloc}`] = (compte[`bloc${x.bloc}`] || 0) + 1; });
            expect(compte).toEqual(blocs);
            expect(new Set(items.map(x => x.preg)).size).toBe(items.length);
        });
    }

    test("la segona missió del mateix dia: només les que va fallar a la primera; si no en va fallar cap, no hi ha bio", async ({ page }) => {
        const falla = ["Què és la variable dependent?", "Què és una rèplica?"];
        await preparar(page, '2026-11-11', {}, { falla, fet: '2026-11-11', repetir: falla });
        const items = await page.evaluate(() => window.__itemsBio());
        expect(items.map(x => x.preg).sort()).toEqual([...falla].sort());
        await page.evaluate(() => localStorage.setItem('dojo_bio', JSON.stringify({ falla: [], fet: '2026-11-11', repetir: [] })));
        expect(await page.evaluate(() => window.__itemsBio())).toHaveLength(0);
    });

    test("si falla, la bona i per què; torna al final del bloc; es guarda; l'endemà torna a sortir primer", async ({ page }) => {
        const envios = await preparar(page, '2026-11-11');
        await expect.poll(async () => (await pasos(page)).join('|')).toContain('Bio');
        const p = await pasos(page);
        await page.evaluate(i => {
            const plan = JSON.parse(localStorage.getItem('dojo_plan'));
            localStorage.setItem('dojo_plan', JSON.stringify({ ...plan, enCurso: { id: window.__idMisio(), bloque: i, fecha: '2026-11-11' } }));
        }, p.indexOf(BIO));
        await page.reload();
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText("Bio per a l'examen");
        await page.click('#btn-intro-vamos');
        let anterior = 'null', fallada = null;
        for (let i = 0; i < 9; i++) {
            const t = await seguent(page, anterior);
            if (i === 8) expect(t.texto).toBe(fallada);
            expect(t.opcions).toHaveLength(3);
            expect(new Set(t.opcions).size).toBe(3);
            expect(t.opcions).toContain(t.esperado);
            await expect(page.locator('#op-factors')).toHaveText(t.texto);
            if (i === 0) {
                fallada = t.texto;
                await page.click(`#tema1-opcions button:not([data-opcio="${t.esperado}"]) >> nth=0`);
                await expect(page.locator('#gentle-correction-box')).toBeVisible();
                await expect(page.locator('#correction-math-text')).toHaveText(t.esperado);
                await expect(page.locator('#correction-pista')).toBeVisible();
                expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
                await page.click('#btn-correction-continue');
            } else await page.click(`#tema1-opcions button[data-opcio="${t.esperado}"]`);
            anterior = JSON.stringify(t);
        }
        const dades = envios.filter(e => e.datos.modulo === 'bio').map(e => e.datos);
        expect(dades).toHaveLength(9);
        expect(dades.filter(d => !d.correcta)).toHaveLength(1);
        expect(dades[0].detalle.modo).toBe('bloc1');
        expect(dades[8].detalle.torna).toBe(true);
        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_bio')));
        expect(st.falla).toEqual([fallada]);
        await page.clock.setFixedTime(new Date('2026-11-12T17:00:00'));
        const dema = await page.evaluate(() => window.__itemsBio());
        expect(dema[0].preg).toBe(fallada);
        expect(dema).toHaveLength(9);
    });

    test("totes les preguntes: 3 opcions diferents, curtes, i cap text prohibit", async ({ page }) => {
        await preparar(page, '2026-11-16');
        const totes = await page.evaluate(() => window.__bioPreguntes());
        expect(totes.length).toBeGreaterThan(60);
        for (const [bloc, preg, bona, altres, explica] of totes) {
            expect([1, 2, 3, 4]).toContain(bloc);
            expect(new Set([bona, ...altres]).size).toBe(3);
            [preg, bona, ...altres, explica].forEach(x => expect(x).not.toMatch(PROHIBIDO_EN_PANTALLA));
            [bona, ...altres].forEach(x => expect(x.length).toBeLessThanOrEqual(75));
        }
        expect(new Set(totes.map(p => p[1])).size).toBe(totes.length);
    });
});
