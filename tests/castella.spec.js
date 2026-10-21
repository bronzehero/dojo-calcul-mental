// Castellà per a l'examen (recuperació del control de la unitat 1, 28/10): del 23 al 27/10, a la missió després del tema 1.
// Com al control: un text curt o una vinyeta nous, i triar què és. Si falla, la solució explicada.
const { test, expect, URL_APP, simularSupabase } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-21' }]);
const EXTRES_FETES = [{ id: 102, fecha: '2026-10-16' }, { id: 103, fecha: '2026-10-17' }];

async function preparar(page, dia, plan = {}) {
    const { envios } = await simularSupabase(page, { tema1: true, castella: true });
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

test.describe("Castellà per a l'examen", () => {
    // Només del 23 al 27/10 (la vigília de l'examen és l'últim dia), després del tema 1 de mates
    for (const [dia, hi] of [['2026-10-22', false], ['2026-10-23', true], ['2026-10-27', true], ['2026-10-28', false]]) {
        test(`el ${dia}, ${hi ? 'hi és, després del tema 1' : 'no hi és'}`, async ({ page }) => {
            await preparar(page, dia);
            await expect(page.locator('#mision-titulo')).toHaveText('Entrenament');
            await expect.poll(async () => (await pasos(page)).at(-1)).toBe(hi ? "💬 Castellà per a l'examen" : '🏛️ Tema 1 de mates');
            const p = await pasos(page);
            if (hi) expect(p.at(-2)).toBe('🏛️ Tema 1 de mates');
            else expect(p.join(' ')).not.toContain('Castellà');
        });
    }

    test('propietats, tipus de text, plans, angle i còmic: si falla, la solució explicada; es guarda cada resposta', async ({ page }) => {
        const envios = await preparar(page, '2026-10-23', { enCurso: { id: 10, bloque: 3, fecha: '2026-10-23' } });
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText("Castellà per a l'examen");
        await page.click('#btn-intro-vamos');
        const modes = [];
        let anterior = 'null';
        const fallades = new Set();
        for (let i = 0; i < 8; i++) {
            const t = await seguent(page, anterior);
            modes.push(t.modo);
            await expect(page.locator('#tema1-preg')).toBeVisible();
            await expect(page.locator('#keypad')).toBeHidden();
            if (['plano', 'angulo', 'elemento'].includes(t.modo)) await expect(page.locator('#op-factors svg')).toBeVisible();
            else await expect(page.locator('#op-factors')).toHaveText(t.texto);
            if (t.modo === 'angulo') expect([...t.opcions].sort()).toEqual(['Contrapicado', 'Frontal', 'Picado']);
            if (t.modo === 'propiedad') expect([...t.opcions].sort()).toEqual(['Adecuación', 'Coherencia', 'Cohesión']);
            if (t.modo === 'plano') expect(t.opcions.every(o => o.startsWith('Plano') || o.startsWith('Primer') || o.startsWith('Gran'))).toBe(true);
            expect(t.opcions).toContain(t.esperado);
            if (['propiedad', 'plano'].includes(t.modo) && !fallades.has(t.modo)) {
                fallades.add(t.modo);
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
        expect(modes).toEqual(['propiedad', 'propiedad', 'tipo', 'tipo', 'plano', 'plano', 'angulo', 'elemento']);
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');
        const dades = envios.filter(e => e.datos.modulo === 'castella').map(e => e.datos);
        expect(dades).toHaveLength(8);
        expect(dades.filter(d => !d.correcta).map(d => d.detalle.modo).sort()).toEqual(['plano', 'propiedad']);
    });
});
