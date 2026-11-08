// Socials per a l'examen de dimarts 10/11 (U2, el relleu): del 6 al 9/11, abans dels accents.
// Triar entre 3; si falla, la bona i per què, torna al final del bloc i l'endemà surt primer.
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

    for (const [dia, blocs] of [['2026-11-06', { bloc1: 8 }], ['2026-11-07', { bloc1: 3, bloc2: 5 }], ['2026-11-08', { bloc1: 3, bloc2: 6 }]]) {
        test(`el ${dia}, els blocs que toquen: ${JSON.stringify(blocs)}`, async ({ page }) => {
            await preparar(page, dia);
            const items = await page.evaluate(() => window.__itemsSocials());
            const compte = {};
            items.forEach(x => { compte[`bloc${x.bloc}`] = (compte[`bloc${x.bloc}`] || 0) + 1; });
            expect(compte).toEqual(blocs);
            expect(new Set(items.map(x => x.preg)).size).toBe(items.length);
        });
    }

    test("el 2026-11-09: primer l'explicació de tot el que falla i després les mateixes preguntes", async ({ page }) => {
        await preparar(page, '2026-11-09', {}, { falla: ['Quants continents hi ha?', 'Com es deia el continent únic que hi havia abans?', 'Un grup d\'illes és…'] });
        const items = await page.evaluate(() => window.__itemsSocials());
        const previa = items.filter(x => x.previa), preg = items.filter(x => !x.previa);
        expect(items.slice(0, previa.length).every(x => x.previa)).toBe(true);
        expect(previa.length).toBe(15); // 13 de l'examen 2 + 2 fallades del Dojo (la del bloc 3 ja no entra)
        expect(preg.map(x => x.preg).sort()).toEqual(previa.map(x => x.preg).sort());
        expect(preg.map(x => x.preg)).toContain('Què és la conca d\'un riu?');
        expect(preg.map(x => x.preg)).not.toContain('Un grup d\'illes és…');
    });

    test("la fitxa d'explicació: la bona i per què, sense opcions; no es guarda com a resposta", async ({ page }) => {
        const envios = await preparar(page, '2026-11-09');
        await expect.poll(async () => (await pasos(page)).join('|')).toContain('Socials');
        const p = await pasos(page);
        await page.evaluate(i => {
            const plan = JSON.parse(localStorage.getItem('dojo_plan'));
            localStorage.setItem('dojo_plan', JSON.stringify({ ...plan, enCurso: { id: window.__idMisio(), bloque: i, fecha: '2026-11-09' } }));
        }, p.indexOf(SOCIALS));
        await page.reload();
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        const t = await seguent(page, 'null');
        expect(t.modo).toBe('previa');
        await expect(page.locator('#gentle-correction-box')).toBeVisible();
        await expect(page.locator('#correction-math-text')).toHaveText(t.esperado);
        await expect(page.locator('#correction-pista')).toBeVisible();
        await expect(page.locator('#tema1-panel')).toBeHidden();
        expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
        await page.click('#btn-correction-continue');
        const t2 = await seguent(page, JSON.stringify(t));
        expect(t2.modo).toBe('previa');
        expect(envios.filter(e => e.datos.modulo === 'socials')).toHaveLength(0);
    });

    test("si falla, la bona i per què; torna al final del bloc; es guarda; l'endemà torna a sortir primer", async ({ page }) => {
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
        for (let i = 0; i < 9; i++) {
            const t = await seguent(page, anterior);
            // La fallada torna a sortir al final (una sola vegada)
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
        const dades = envios.filter(e => e.datos.modulo === 'socials').map(e => e.datos);
        expect(dades).toHaveLength(9);
        expect(dades.filter(d => !d.correcta)).toHaveLength(1);
        expect(dades[0].detalle.modo).toBe('bloc1');
        expect(dades[8].detalle.torna).toBe(true);
        // Bé just després de veure-la: demà torna a sortir igualment
        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_socials')));
        expect(st.falla).toEqual([fallada]);
        // L'endemà, la fallada surt la primera
        await page.clock.setFixedTime(new Date('2026-11-07T17:00:00'));
        const dema = await page.evaluate(() => window.__itemsSocials());
        expect(dema[0].preg).toBe(fallada);
        expect(dema).toHaveLength(8);
    });
});
