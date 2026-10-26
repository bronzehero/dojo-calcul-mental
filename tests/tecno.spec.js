// Tecno per a l'examen del dijous 29/10: del 25 al 28/10, al final de la missió.
// Què vull fer → com es fa, a triar entre 3; i dos dibuixos de diapositiva (les dues columnes no són una taula).
const { test, expect, URL_APP, simularSupabase } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-21' }]);
const EXTRES_FETES = [{ id: 102, fecha: '2026-10-16' }, { id: 103, fecha: '2026-10-17' }];

async function preparar(page, dia, plan = {}) {
    const { envios } = await simularSupabase(page, { tema1: true, castella: true, catala: true, tecno: true });
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

test.describe("Tecno per a l'examen", () => {
    for (const [dia, hi, abans] of [['2026-10-24', false], ['2026-10-25', true, 'Català: apòstrof'], ['2026-10-26', true, 'Tema 1'],
        ['2026-10-28', true, 'Tema 1'], ['2026-10-29', false]]) {
        test(`el ${dia}, ${hi ? `hi és, al final (després de: ${abans})` : 'no hi és'}`, async ({ page }) => {
            await preparar(page, dia);
            await expect.poll(async () => (await pasos(page)).length).toBeGreaterThan(1);
            const p = await pasos(page);
            if (hi) {
                expect(p.at(-1)).toBe("💻 Tecno per a l'examen");
                expect(p.at(-2)).toContain(abans);
            } else expect(p.join(' ')).not.toContain('Tecno');
        });
    }

    test('dibuixos i preguntes: si falla, la bona i per què; es guarda cada resposta', async ({ page }) => {
        const envios = await preparar(page, '2026-10-25', { extras: [...EXTRES_FETES, { id: 11, fecha: '2026-10-18' }],
            enCurso: { id: 11, bloque: 4, fecha: '2026-10-25' } });
        await expect.poll(async () => (await pasos(page)).at(-1)).toContain('Tecno');
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText("Tecno per a l'examen");
        await page.click('#btn-intro-vamos');
        const modes = [], bones = [];
        let anterior = 'null';
        for (let i = 0; i < 7; i++) {
            const t = await seguent(page, anterior);
            modes.push(t.modo);
            bones.push(t.esperado);
            await expect(page.locator('#tema1-preg')).toBeVisible();
            await expect(page.locator('#keypad')).toBeHidden();
            expect(t.opcions).toHaveLength(3);
            expect(new Set(t.opcions).size).toBe(3);
            expect(t.opcions).toContain(t.esperado);
            if (t.modo === 'dibuix') await expect(page.locator('#op-factors svg')).toBeVisible();
            else await expect(page.locator('#op-factors')).toHaveText(t.texto);
            if (i < 2) {
                // Els dos dibuixos, fallant: surt la bona i l'explicació
                await page.click(`#tema1-opcions button:not([data-opcio="${t.esperado}"]) >> nth=0`);
                await expect(page.locator('#gentle-correction-box')).toBeVisible();
                await expect(page.locator('#correction-math-text')).toHaveText(t.esperado);
                await expect(page.locator('#correction-pista')).toBeVisible();
                expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
                await page.click('#btn-correction-continue');
            } else {
                await page.click(`#tema1-opcions button[data-opcio="${t.esperado}"]`);
            }
            anterior = JSON.stringify(t);
        }
        expect(modes.slice(0, 5)).toEqual(['dibuix', 'dibuix', 'disseny', 'lletra', 'nom']);
        expect(bones.slice(0, 2).sort()).toEqual(['Títol i dues columnes', 'Una taula']);
        const dades = envios.filter(e => e.datos.modulo === 'tecno').map(e => e.datos);
        expect(dades).toHaveLength(7);
        expect(dades.filter(d => !d.correcta).map(d => d.detalle.modo)).toEqual(['dibuix', 'dibuix']);
    });
});
