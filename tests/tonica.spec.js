// Català, on pica la força (6/11: no identifica la síl·laba tònica). Del 7 al 13/11, després dels socials i abans dels accents.
// Sent la paraula, toca el tros fort; si falla, la bona en majúscules, el truc de cridar-la i la torna a sentir. Les fallades tornen primer.
const { test, expect, URL_APP, simularSupabase } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-21' }]);
const EXTRES_FETES = [{ id: 102, fecha: '2026-10-16' }, { id: 103, fecha: '2026-10-17' }];

async function preparar(page, dia, opciones = {}) {
    const { envios } = await simularSupabase(page, { tonica: true, ...opciones });
    await page.clock.setFixedTime(new Date(`${dia}T17:00:00`));
    await page.addInitScript(p => {
        if (sessionStorage.getItem('plan-preparado')) return;
        sessionStorage.setItem('plan-preparado', '1');
        localStorage.setItem('dojo_plan', JSON.stringify(p));
    }, { hechas: PLAN_ACABAT, extras: EXTRES_FETES });
    await page.goto(URL_APP);
    return envios;
}
const actual = page => page.evaluate(() => window.__tema1Actual());
async function seguent(page, anterior) {
    await expect.poll(async () => JSON.stringify(await actual(page))).not.toBe(anterior);
    return actual(page);
}
const pasos = page => page.locator('#mision-pasos li').allTextContents();
const TONICA = '🥁 On pica la força?';

test.describe('On pica la força?', () => {
    for (const [dia, hi, abans] of [['2026-11-06', false], ['2026-11-07', true, 'Socials'], ['2026-11-10', true, null], ['2026-11-13', true, null], ['2026-11-14', false]]) {
        test(`el ${dia}, ${hi ? 'hi és, abans dels accents' : 'no hi és'}`, async ({ page }) => {
            await preparar(page, dia, { accent: true, socials: true });
            await expect.poll(async () => (await pasos(page)).length).toBeGreaterThan(1);
            const p = await pasos(page);
            if (hi) {
                const i = p.indexOf(TONICA);
                expect(i).toBeGreaterThan(0);
                expect(p[i + 1]).toContain('Accents');
                if (abans) expect(p[i - 1]).toContain(abans);
                else expect(p.join(' ')).not.toContain('Socials');
            } else expect(p.join(' ')).not.toContain('On pica');
        });
    }

    test("12 paraules; trossos sense accent i en ordre; si falla, la bona i el truc, torna al final del bloc i l'endemà primer", async ({ page }) => {
        const envios = await preparar(page, '2026-11-10');
        await expect.poll(async () => (await pasos(page)).join('|')).toContain('On pica');
        const p = await pasos(page);
        await page.evaluate(i => {
            const plan = JSON.parse(localStorage.getItem('dojo_plan'));
            localStorage.setItem('dojo_plan', JSON.stringify({ ...plan, enCurso: { id: window.__idMisio(), bloque: i, fecha: '2026-11-10' } }));
        }, p.indexOf(TONICA));
        await page.reload();
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('On pica la força?');
        await page.click('#btn-intro-vamos');
        let anterior = 'null', fallada = null;
        for (let i = 0; i < 13; i++) {
            const t = await seguent(page, anterior);
            // La fallada torna a sortir al final (una sola vegada)
            if (i === 12) expect(JSON.stringify([t.opcions, t.esperado])).toBe(JSON.stringify([fallada.opcions, fallada.esperado]));
            expect(t.opcions.length).toBeGreaterThanOrEqual(2);
            expect(t.opcions.join('')).not.toMatch(/[àèéíòóú]/);
            expect(t.opcions).toContain(t.esperado);
            await expect(page.locator('#btn-escoltar-tonica')).toBeVisible();
            const botons = await page.locator('#tema1-opcions button').allTextContents();
            expect(botons).toEqual(t.opcions);
            if (i === 0) {
                fallada = t;
                await page.click(`#tema1-opcions button:not([data-opcio="${t.esperado}"]) >> nth=0`);
                await expect(page.locator('#gentle-correction-box')).toBeVisible();
                await expect(page.locator('#correction-pista')).toContainText('Crida-la');
                expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
                await page.click('#btn-correction-continue');
            } else await page.click(`#tema1-opcions button[data-opcio="${t.esperado}"]`);
            anterior = JSON.stringify(t);
        }
        const dades = envios.filter(e => e.datos.modulo === 'tonica').map(e => e.datos);
        expect(dades).toHaveLength(13);
        expect(dades.filter(d => !d.correcta)).toHaveLength(1);
        expect(dades[12].detalle.torna).toBe(true);
        // Bé just després de sentir-la: demà torna a sortir igualment
        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_tonica')));
        expect(st.falla).toHaveLength(1);
        const dema = await page.evaluate(() => window.__itemsTonica());
        expect(dema[0]).toBe(st.falla[0]);
        expect(dema).toHaveLength(12);
    });

    test('dissabte 7/11: socials amb les fallades de divendres, però les 5 del bloc 2 hi són totes', async ({ page }) => {
        await simularSupabase(page, { socials: true });
        await page.clock.setFixedTime(new Date('2026-11-07T17:00:00'));
        await page.addInitScript(() => localStorage.setItem('dojo_socials', JSON.stringify({ falla: ['Com es deia el continent únic que hi havia abans?', 'On es nota més un terratrèmol?', 'Per on puja el magma, en un volcà?'] })));
        await page.goto(URL_APP);
        const items = await page.evaluate(() => window.__itemsSocials());
        expect(items.slice(0, 3).every(x => x.bloc === 1)).toBe(true);
        expect(items.filter(x => x.bloc === 2)).toHaveLength(5);
        expect(items).toHaveLength(8);
    });
});
