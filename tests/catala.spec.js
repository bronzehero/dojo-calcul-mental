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
    await expect.poll(async () => JSON.stringify(await actual(page))).not.toBe(anterior);
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

    // Amb el full d'apunts al costat: si no surt (o «No ho sé»), on mirar-ho al full i un segon intent;
    // si tampoc, la bona (i amb «No ho sé» un altre cop, que cridi el papa)
    test("si no surt, on buscar-ho al full i un altre intent; després la bona o cridar el papa", async ({ page }) => {
        const envios = await preparar(page, '2026-10-25', { extras: [...EXTRES_FETES, { id: 11, fecha: '2026-10-18' }],
            enCurso: { id: 11, bloque: 3, fecha: '2026-10-25' } });
        await expect.poll(async () => (await pasos(page)).at(-1)).toContain('Català: apòstrof');
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Català: apòstrof i contraccions');
        await expect(page.locator('#intro-texto')).toContainText("full d'apunts");
        await page.click('#btn-intro-vamos');
        const modes = [];
        let anterior = 'null', ambApostrof = 0;
        const provats = new Set();
        const malament = t => `#tema1-opcions button:not([data-opcio="${t.esperado}"]) >> nth=0`;
        for (let i = 0; i < 12; i++) {
            const t = await seguent(page, anterior);
            modes.push(t.modo);
            await expect(page.locator('#tema1-preg')).toBeVisible();
            await expect(page.locator('#tema1-preg')).toContainText('mira el full');
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
            if (!provats.has(t.modo)) {
                provats.add(t.modo);
                // 1r intent: malament (al DE, «No ho sé») → on mirar-ho al full; la frase i els botons hi segueixen
                if (t.modo === 'de') await page.click('#btn-no-ho-se');
                else await page.click(malament(t));
                await expect(page.locator('#catala-full')).toBeVisible();
                await expect(page.locator('#catala-full')).toContainText('Busca-ho al full:');
                // On mirar, sense la resposta
                expect((await page.locator('#catala-full').textContent()).split('Busca-ho al full:')[1]).not.toMatch(/[:→]/);
                await expect(page.locator('#gentle-correction-box')).toBeHidden();
                await expect(page.locator('#tema1-opcions')).toBeVisible();
                await expect(page.locator('#btn-no-ho-se')).toBeVisible();
                expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
                expect(JSON.parse(JSON.stringify(await actual(page)))).toEqual(t);
                // 2n intent
                if (t.modo === 'contraccio') {
                    await page.click(`#tema1-opcions button[data-opcio="${t.esperado}"]`);
                } else {
                    if (t.modo === 'article') await page.click(malament(t));
                    else await page.click('#btn-no-ho-se');
                    await expect(page.locator('#gentle-correction-box')).toBeVisible();
                    await expect(page.locator('#catala-full')).toHaveCount(0);
                    // La frase bona sencera, amb l'apòstrof enganxat a la paraula
                    const bona = await page.locator('#correction-math-text').textContent();
                    expect(bona).not.toContain('___');
                    expect(bona).not.toMatch(/' /);
                    await expect(page.locator('#correction-pista')).toBeVisible();
                    if (t.modo === 'de') await expect(page.locator('#gentle-correction-box')).toContainText('Crida el papa');
                    else await expect(page.locator('#gentle-correction-box')).not.toContainText('papa');
                    expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
                    await page.click('#btn-correction-continue');
                }
            } else {
                await page.click(`#tema1-opcions button[data-opcio="${t.esperado}"]`);
            }
            anterior = JSON.stringify(t);
        }
        expect(modes).toEqual(['article', 'article', 'article', 'article', 'article', 'de', 'de', 'de', 'contraccio', 'contraccio', 'contraccio', 'contraccio']);
        expect(ambApostrof).toBeGreaterThanOrEqual(2);
        const dades = envios.filter(e => e.datos.modulo === 'catala').map(e => e.datos);
        expect(dades).toHaveLength(15);
        const no = dades.filter(d => !d.correcta).map(d => `${d.detalle.modo} ${d.detalle.intent}${d.detalle.no_lo_se ? ' no ho sé' : ''}`).sort();
        expect(no).toEqual(['article 1', 'article 2', 'contraccio 1', 'de 1 no ho sé', 'de 2 no ho sé']);
        expect(dades.find(d => d.correcta && d.detalle.modo === 'contraccio' && d.detalle.intent === 2)).toBeTruthy();
    });
});
