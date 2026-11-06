// Socials per a l'examen de dimarts 10/11 (U2, el relleu): del 6 al 9/11, abans dels accents.
// Triar entre 3; si falla, la bona i per què, i l'endemà torna a sortir primer.
const { test, expect, URL_APP, simularSupabase } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-21' }]);
const EXTRES_FETES = [{ id: 102, fecha: '2026-10-16' }, { id: 103, fecha: '2026-10-17' }];

async function preparar(page, dia, opciones = {}, socials = null) {
    const { envios } = await simularSupabase(page, { socials: true, ...opciones });
    await page.clock.setFixedTime(new Date(`${dia}T17:00:00`));
    await page.addInitScript(([p, s]) => {
        if (sessionStorage.getItem('plan-preparado')) return;
        sessionStorage.setItem('plan-preparado', '1');
        localStorage.setItem('dojo_plan', JSON.stringify(p));
        if (s) localStorage.setItem('dojo_socials', JSON.stringify(s));
    }, [{ hechas: PLAN_ACABAT, extras: EXTRES_FETES }, socials]);
    await page.goto(URL_APP);
    return envios;
}
const actual = page => page.evaluate(() => window.__tema1Actual());
async function seguent(page, anterior) {
    await expect.poll(async () => JSON.stringify(await actual(page))).not.toBe(anterior);
    return actual(page);
}
const pasos = page => page.locator('#mision-pasos li').allTextContents();
const SOCIALS = "🌋 Socials per a l'examen";

test.describe("Socials per a l'examen", () => {
    for (const [dia, hi] of [['2026-11-05', false], ['2026-11-06', true], ['2026-11-09', true], ['2026-11-10', false]]) {
        test(`el ${dia}, ${hi ? 'hi és, just abans dels accents' : 'no hi és'}`, async ({ page }) => {
            await preparar(page, dia, { accent: true });
            await expect.poll(async () => (await pasos(page)).length).toBeGreaterThan(1);
            const p = await pasos(page);
            if (hi) {
                const i = p.indexOf(SOCIALS);
                expect(i).toBeGreaterThan(0);
                expect(p[i + 1]).toContain('Accents');
            } else expect(p.join(' ')).not.toContain('Socials');
        });
    }

    for (const [dia, blocs] of [['2026-11-06', { bloc1: 8 }], ['2026-11-07', { bloc1: 3, bloc2: 5 }], ['2026-11-08', { bloc1: 2, bloc2: 2, bloc3: 5 }]]) {
        test(`el ${dia}, els blocs que toquen: ${JSON.stringify(blocs)}`, async ({ page }) => {
            await preparar(page, dia);
            const items = await page.evaluate(() => window.__itemsSocials());
            const compte = {};
            items.forEach(x => { compte[`bloc${x.bloc}`] = (compte[`bloc${x.bloc}`] || 0) + 1; });
            expect(compte).toEqual(blocs);
            expect(new Set(items.map(x => x.preg)).size).toBe(items.length);
        });
    }

    test("si falla, la bona i per què; es guarda; l'endemà torna a sortir primer", async ({ page }) => {
        const envios = await preparar(page, '2026-11-06');
        await expect.poll(async () => (await pasos(page)).join('|')).toContain('Socials');
        const p = await pasos(page);
        await page.evaluate(i => {
            const plan = JSON.parse(localStorage.getItem('dojo_plan'));
            localStorage.setItem('dojo_plan', JSON.stringify({ ...plan, enCurso: { id: window.__idMisio(), bloque: i, fecha: '2026-11-06' } }));
        }, p.indexOf(SOCIALS));
        await page.reload();
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText("Socials per a l'examen");
        await page.click('#btn-intro-vamos');
        let anterior = 'null', fallada = null;
        for (let i = 0; i < 8; i++) {
            const t = await seguent(page, anterior);
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
        const dades = envios.filter(e => e.datos.modulo === 'socials').map(e => e.datos);
        expect(dades).toHaveLength(8);
        expect(dades.filter(d => !d.correcta)).toHaveLength(1);
        expect(dades[0].detalle.modo).toBe('bloc1');
        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_socials')));
        expect(st.falla).toEqual([fallada]);
        // L'endemà, la fallada surt la primera
        await page.clock.setFixedTime(new Date('2026-11-07T17:00:00'));
        const dema = await page.evaluate(() => window.__itemsSocials());
        expect(dema[0].preg).toBe(fallada);
        expect(dema).toHaveLength(8);
    });
});
