// Català: apòstrof i contraccions (examen el dilluns 26/10): només el diumenge 25, al repàs, després del castellà.
// Una frase amb un forat i tres botons. Si falla, la frase bona i la regla.
const { test, expect, URL_APP, simularSupabase } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-21' }]);
const EXTRES_FETES = [{ id: 102, fecha: '2026-10-16' }, { id: 103, fecha: '2026-10-17' }];

async function preparar(page, dia, plan = {}) {
    const { envios } = await simularSupabase(page, { tema1: true, castella: true, catala: true });
    await page.clock.setFixedTime(new Date(`${dia}T17:00:00`));
    await page.addInitScript(p => {
        if (sessionStorage.getItem('plan-preparado')) return;
        sessionStorage.setItem('plan-preparado', '1');
        localStorage.setItem('dojo_plan', JSON.stringify(p));
    }, { hechas: PLAN_ACABAT, extras: EXTRES_FETES, ...plan });
    await page.goto(URL_APP);
    return envios;
}
const actual = page => page.evaluate(() => window.__tema1Actual());
async function seguent(page, anterior) {
    // Amb 12 seguides, de vegades surt la celebració llarga: més marge que els 5 s per defecte
    await expect.poll(async () => JSON.stringify(await actual(page)), { timeout: 15000 }).not.toBe(anterior);
    return actual(page);
}
const pasos = page => page.locator('#mision-pasos li').allTextContents();

test.describe('Català: apòstrof i contraccions', () => {
    for (const [dia, hi] of [['2026-10-24', false], ['2026-10-25', true], ['2026-10-26', false]]) {
        test(`el ${dia}, ${hi ? 'hi és, després del castellà' : 'no hi és'}`, async ({ page }) => {
            await preparar(page, dia);
            await expect.poll(async () => (await pasos(page)).at(-1)).toContain(hi ? 'Català: apòstrof' : 'Castellà');
            const p = await pasos(page);
            if (hi) {
                await expect(page.locator('#mision-titulo')).toHaveText('Missió de repàs');
                expect(p.at(-2)).toBe("💬 Castellà per a l'examen");
            } else expect(p.join(' ')).not.toContain('apòstrof');
        });
    }

    test("article, DE i contraccions: si falla, la frase bona i la regla; es guarda cada resposta", async ({ page }) => {
        const envios = await preparar(page, '2026-10-25', { extras: [...EXTRES_FETES, { id: 11, fecha: '2026-10-18' }],
            enCurso: { id: 11, bloque: 3, fecha: '2026-10-25' } });
        await expect.poll(async () => (await pasos(page)).at(-1)).toContain('Català: apòstrof');
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Català: apòstrof i contraccions');
        await page.click('#btn-intro-vamos');
        const modes = [];
        let anterior = 'null', ambApostrof = 0;
        const fallades = new Set();
        for (let i = 0; i < 12; i++) {
            const t = await seguent(page, anterior);
            modes.push(t.modo);
            await expect(page.locator('#tema1-preg')).toBeVisible();
            await expect(page.locator('#keypad')).toBeHidden();
            await expect(page.locator('#op-factors')).toHaveText(t.texto);
            expect(t.texto).toContain('___');
            if (t.modo === 'article') expect([...t.opcions]).toEqual(['el', 'la', "l'"]);
            if (t.modo === 'de') expect([...t.opcions]).toEqual(['de', "d'"]);
            if (t.modo === 'contraccio') {
                expect(t.texto).toMatch(/\(.+ \+ .+\)$/);
                expect(t.opcions).toHaveLength(3);
                if (t.esperado.includes("'")) ambApostrof++;
            }
            expect(t.opcions).toContain(t.esperado);
            if (!fallades.has(t.modo)) {
                fallades.add(t.modo);
                await page.click(`#tema1-opcions button:not([data-opcio="${t.esperado}"]) >> nth=0`);
                await expect(page.locator('#gentle-correction-box')).toBeVisible();
                // La frase bona sencera, amb l'apòstrof enganxat a la paraula
                const bona = await page.locator('#correction-math-text').textContent();
                expect(bona).not.toContain('___');
                expect(bona).not.toMatch(/' /);
                await expect(page.locator('#correction-pista')).toBeVisible();
                expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
                await page.click('#btn-correction-continue');
            } else {
                await page.click(`#tema1-opcions button[data-opcio="${t.esperado}"]`);
            }
            anterior = JSON.stringify(t);
        }
        expect(modes).toEqual(['article', 'article', 'article', 'article', 'article', 'de', 'de', 'de', 'contraccio', 'contraccio', 'contraccio', 'contraccio']);
        expect(ambApostrof).toBeGreaterThanOrEqual(2);
        const dades = envios.filter(e => e.datos.modulo === 'catala').map(e => e.datos);
        expect(dades).toHaveLength(12);
        expect(dades.filter(d => !d.correcta).map(d => d.detalle.modo).sort()).toEqual(['article', 'contraccio', 'de']);
    });
});
