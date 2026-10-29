// Accents en castellà (del 29/10 al 5/11): dictat sense veure la paraula abans. 8 acabades en -ón (sempre información,
// asociación i cohesión) barrejades amb 4 sense accent. El primer intent és el que mesura; si no surt, la llegeix fluixet
// tal com l'ha escrita i l'arregla; si tampoc, la bona i la regla.
const { test, expect, URL_APP, simularSupabase } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-20' }]);
const EXTRES_FETES = [{ id: 102, fecha: '2026-10-16' }, { id: 103, fecha: '2026-10-17' }];

async function preparar(page, dia, plan = {}) {
    const { envios } = await simularSupabase(page, { tema1: true, paraules: true, accent: true });
    await page.clock.setFixedTime(new Date(`${dia}T17:00:00`));
    await page.addInitScript(p => {
        if (sessionStorage.getItem('plan-preparado')) return;
        sessionStorage.setItem('plan-preparado', '1');
        localStorage.setItem('dojo_plan', JSON.stringify(p));
    }, { hechas: PLAN_ACABAT, extras: EXTRES_FETES, ...plan });
    await page.goto(URL_APP);
    return envios;
}

async function escriure(page, text) {
    for (const c of text) await page.click(`#teclat-lletres [data-tecla="${c}"]`);
}
const actual = page => page.evaluate(() => window.__accentActual());
async function seguent(page, anterior) {
    await expect.poll(async () => JSON.stringify(await actual(page))).not.toBe(anterior);
    return actual(page);
}

test.describe('Accents en castellà', () => {
    for (const [dia, hi] of [['2026-10-28', false], ['2026-10-29', true], ['2026-11-05', true], ['2026-11-06', false]]) {
        test(`el ${dia}, ${hi ? 'hi és, després del tema 1' : 'no hi és'}`, async ({ page }) => {
            await preparar(page, dia);
            await expect(page.locator('#mision-titulo')).toHaveText('Entrenament');
            const pasos = await page.locator('#mision-pasos li').allTextContents();
            if (hi) expect(pasos[pasos.indexOf('🏛️ Tema 1 de mates') + 1]).toBe('🎧 Accents en castellà');
            else expect(pasos.join(' ')).not.toContain('Accents');
        });
    }

    test("cada dia 12: les 3 de sempre, 5 més en -ón i 4 sense accent, barrejades", async ({ page }) => {
        await preparar(page, '2026-10-29');
        for (let i = 0; i < 3; i++) {
            const items = await page.evaluate(() => window.__itemsAccent());
            const p = items.map(x => x.paraula);
            expect(p).toHaveLength(12);
            expect(new Set(p).size).toBe(12);
            expect(p).toEqual(expect.arrayContaining(['información', 'asociación', 'cohesión']));
            expect(p.filter(x => x.endsWith('ón'))).toHaveLength(8);
            expect(p.filter(x => !/[áéíóú]/.test(x))).toHaveLength(4);
            for (const x of items) expect(x.frase).toContain(x.paraula);
        }
    });

    test("bé a la primera; si no, la llegeix tal com l'ha escrita i l'arregla; si tampoc, la bona i la regla", async ({ page }) => {
        const envios = await preparar(page, '2026-10-29', { enCurso: { id: 10, bloque: 3, fecha: '2026-10-29' } });
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Accents en castellà');
        await page.click('#btn-intro-vamos');

        // 1a: bé a la primera
        let a = await seguent(page, 'null');
        await expect(page.locator('#dictat-panel')).toBeVisible();
        await escriure(page, a.paraula);
        await page.click('#btn-dictat-fet');

        // 2a: malament (sense accent o amb un de més); surt el «llegeix-la» amb el que ha escrit, i l'arregla
        a = await seguent(page, JSON.stringify(a));
        const dolenta = a.ambAccent ? a.paraula.replace('ón', 'on') : a.paraula.replace(/en$/, 'én').replace(/ones$/, 'ónes');
        await escriure(page, dolenta);
        await page.click('#btn-dictat-fet');
        await expect(page.locator('#accent-llegeix')).toContainText('tal com l\'has escrita');
        await expect(page.locator('#accent-llegeix')).toContainText("Si acaba en -on, l'accent va a sobre de la o: -ón.");
        await expect(page.locator('#dictat-escrit')).toHaveText(dolenta);
        expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
        for (let i = 0; i < dolenta.length; i++) await page.click('#teclat-lletres [data-tecla="back"]');
        await escriure(page, a.paraula);
        await page.click('#btn-dictat-fet');

        // 3a: malament dues vegades: la bona i la regla
        a = await seguent(page, JSON.stringify({ ...a, intent: 2 }));
        const dolenta3 = a.ambAccent ? a.paraula.replace('ón', 'on') : a.paraula.replace(/en$/, 'én').replace(/ones$/, 'ónes');
        await escriure(page, dolenta3);
        await page.click('#btn-dictat-fet');
        await expect(page.locator('#accent-llegeix')).toBeVisible();
        await page.click('#btn-dictat-fet');
        await expect(page.locator('#gentle-correction-box')).toBeVisible();
        await expect(page.locator('#correction-math-text')).toHaveText(a.paraula);
        await expect(page.locator('#correction-pista')).toContainText(a.ambAccent ? 'Acaba en -ón: porta accent' : 'sense accent');
        expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);

        const dades = envios.filter(e => e.datos.modulo === 'accent').map(e => e.datos);
        expect(dades.map(d => [d.detalle.intent, d.correcta, d.detalle.accent_ok])).toEqual([
            [1, true, true], [1, false, false], [2, true, true], [1, false, false], [2, false, false]
        ]);
        expect(dades.every(d => typeof d.detalle.amb_accent === 'boolean')).toBe(true);
    });

    test("si l'accent és a la i (-íon), la regla diu que va a la o", async ({ page }) => {
        await preparar(page, '2026-10-29', { enCurso: { id: 10, bloque: 3, fecha: '2026-10-29' } });
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        let a = await seguent(page, 'null');
        while (!a.ambAccent) {
            await escriure(page, a.paraula);
            await page.click('#btn-dictat-fet');
            a = await seguent(page, JSON.stringify(a));
        }
        const dolenta = a.paraula.replace(/ión$/, 'íon').replace(/([^i])ón$/, '$1on');
        for (let i = 0; i < 2; i++) {
            await escriure(page, dolenta);
            await page.click('#btn-dictat-fet');
            if (i === 0) {
                await expect(page.locator('#accent-llegeix')).toBeVisible();
                for (let j = 0; j < dolenta.length; j++) await page.click('#teclat-lletres [data-tecla="back"]');
            }
        }
        await expect(page.locator('#gentle-correction-box')).toBeVisible();
        await expect(page.locator('#correction-pista')).toHaveText(dolenta.includes('í') ? "Acaba en -ón: l'accent va a sobre de la o, no de la i: -ón." : /Acaba en -ón: porta accent/);
    });
});
