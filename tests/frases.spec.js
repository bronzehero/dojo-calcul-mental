// Frases en anglès (papà, 17/11): frases curtíssimes, només del que ha estudiat. Primer escolta i escriu;
// quan li surt bé a la primera, del català a l'anglès. Com a molt 6 al dia, després de les paraules.
const { test, expect, URL_APP, simularSupabase } = require('./ayudas');

const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-21' }]);
const EXTRES_FETES = [{ id: 102, fecha: '2026-10-16' }, { id: 103, fecha: '2026-10-17' }];

async function preparar(page, dia, opciones = { frases: true }, estat = {}) {
    const { envios } = await simularSupabase(page, opciones);
    await page.clock.setFixedTime(new Date(`${dia}T17:00:00`));
    await page.addInitScript(([p, e]) => {
        if (sessionStorage.getItem('plan-preparado')) return;
        sessionStorage.setItem('plan-preparado', '1');
        localStorage.setItem('dojo_plan', JSON.stringify(p));
        Object.entries(e).forEach(([k, v]) => localStorage.setItem('dojo_' + k, JSON.stringify(v)));
    }, [{ hechas: PLAN_ACABAT, extras: EXTRES_FETES }, estat]);
    await page.goto(URL_APP);
    return envios;
}
const pasos = page => page.locator('#mision-pasos li').allTextContents();

async function escriu(page, text) {
    for (const c of text) await page.click(`#teclat-lletres button[data-tecla="${c === "'" ? "\\'" : c}"]`);
}

test.describe('Frases en anglès', () => {
    test('el 17/11 encara no hi són; el 18/11 sí, amb les 6 frases del físic, totes d\'escoltar', async ({ page }) => {
        await preparar(page, '2026-11-17');
        expect((await pasos(page)).join(' | ')).not.toContain('Frases');
        await preparar(page, '2026-11-18');
        expect((await pasos(page)).join(' | ')).toContain('Frases en anglès');
        const items = await page.evaluate(() => window.__itemsFrases());
        expect(items.map(x => x.id).sort()).toEqual(['f-curly', 'f-green', 'f-grey', 'f-long', 'f-short', 'f-straight']);
        expect(items.every(x => x.mode === 'escolta')).toBe(true);
    });

    test('totes curtes (com a molt 5 paraules), amb la frase en català i sense repetir-ne cap', async ({ page }) => {
        await preparar(page, '2026-11-18');
        const totes = await page.evaluate(() => window.__frasesEn());
        expect(new Set(totes.map(f => f.id)).size).toBe(totes.length);
        for (const f of totes) {
            expect(f.en.split(' ').length).toBeLessThanOrEqual(5);
            expect(f.ca.length).toBeGreaterThan(5);
        }
    });

    test('valen igual majúscules, punts i formes curtes o llargues', async ({ page }) => {
        await preparar(page, '2026-11-18');
        const iguals = (a, b) => page.evaluate(([x, y]) => window.__frasesIguals(x, y), [a, b]);
        expect(await iguals("i've got long hair", "I've got long hair.")).toBe(true);
        expect(await iguals('i have got long hair', "I've got long hair.")).toBe(true);
        expect(await iguals('she has got short hair', "She's got short hair.")).toBe(true);
        expect(await iguals('there is a mirror', "There's a mirror.")).toBe(true);
        expect(await iguals('there are not any curtains', "There aren't any curtains.")).toBe(true);
        expect(await iguals('i am tall', "I'm tall.")).toBe(true);
        expect(await iguals("i've got long hare", "I've got long hair.")).toBe(false);
        expect(await iguals("i've got hair", "I've got long hair.")).toBe(false);
        const marcades = async (r, b) => (await page.evaluate(([x, y]) => window.__fraseMarcada(x, y), [r, b])).split('frase-mal').length - 1;
        for (const [r, b] of [["he's got grey hare", "He's got grey hair."], ["she's got short hare", "She's got short hair."],
            ["there's a miror", "There's a mirror."], ["i've got green ais", "I've got green eyes."], ["there aren't any curtins", "There aren't any curtains."]])
            expect(await marcades(r, b), r).toBe(1);
    });

    test('el dia següent, les que va escriure bé passen a traduir, i les noves del dia, a escoltar (com a molt 6)', async ({ page }) => {
        await preparar(page, '2026-11-19', { frases: true }, { frases: { s: {
            'f-long': { escolta: 1, tradueix: [], ultima: '2026-11-18' },
            'f-short': { escolta: 1, tradueix: [], ultima: '2026-11-18' },
            'f-curly': { escolta: 0, tradueix: [], ultima: '2026-11-18' } } } });
        const items = await page.evaluate(() => window.__itemsFrases());
        expect(items.length).toBe(6);
        expect(items.filter(x => x.mode === 'tradueix').map(x => x.id).sort()).toEqual(['f-long', 'f-short']);
        expect(items.filter(x => x.mode === 'escolta').length).toBe(4);
    });

    test('escolta i escriu: bé a la primera → passa a traduir; si falla, la bona amb la seva paraula marcada i la torna a escriure', async ({ page }) => {
        const envios = await preparar(page, '2026-11-18');
        await page.evaluate(() => { window.__dites = []; window.speechSynthesis.speak = u => window.__dites.push(u.text); });
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Frases en anglès');
        await page.click('#btn-intro-vamos');
        const frases = await page.evaluate(() => window.__frasesEn());
        const bona = id => frases.find(f => f.id === id).en.toLowerCase().replace(/[.?]/g, '');
        // la primera, bé
        await expect.poll(() => page.evaluate(() => window.__fraseActual())).not.toBe(null);
        let id = await page.evaluate(() => window.__fraseActual());
        await escriu(page, bona(id));
        await page.click('#btn-dictat-fet');
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'frases').length).toBe(1);
        expect(envios.find(e => e.datos.modulo === 'frases').datos.correcta).toBe(true);
        let st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_frases')));
        expect(st.s[id].escolta).toBe(1);
        // la segona, amb una paraula mal escrita
        await expect.poll(() => page.evaluate(() => window.__fraseActual())).not.toBe(id);
        id = await page.evaluate(() => window.__fraseActual());
        const mal = bona(id).replace('hair', 'hare').replace('eyes', 'ais');
        await escriu(page, mal);
        await page.click('#btn-dictat-fet');
        await expect(page.locator('.frase-mal')).toHaveCount(1);
        await expect(page.locator('.frase-bona')).toBeVisible();
        await page.click('#btn-frase-reescriu');
        await expect(page.locator('#dictat-panel')).toBeVisible();
        await escriu(page, bona(id));
        await page.click('#btn-dictat-fet');
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'frases').length).toBe(3);
        const dades = envios.filter(e => e.datos.modulo === 'frases').map(e => e.datos);
        expect(dades[1].correcta).toBe(false);
        expect(dades[2].correcta).toBe(true);
        expect(dades[2].detalle.intent).toBe(2);
        st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_frases')));
        expect(st.s[id].escolta || 0).toBe(0);
    });

    test('des del 20/11, a escolta veu la frase amb un forat a la peça clau i escriu només aquesta (I\'ve, There\'s, are…)', async ({ page }) => {
        const envios = await preparar(page, '2026-11-20');
        await page.evaluate(() => { window.__dites = []; window.speechSynthesis.speak = u => window.__dites.push(u.text); });
        const totes = await page.evaluate(() => window.__frasesEn());
        for (const f of totes) expect(f.en, f.id).toContain(f.forat);
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Frases en anglès');
        await page.click('#btn-intro-vamos');
        await expect.poll(() => page.evaluate(() => window.__fraseActual())).not.toBe(null);
        let f;
        const actual = async () => { const id = await page.evaluate(() => window.__fraseActual()); return totes.find(x => x.id === id); };
        // bé: només la peça (en minúscules, també val)
        f = await actual();
        await expect(page.locator('.frase-forat .forat')).toBeVisible();
        await expect(page.locator('.frase-forat')).toContainText(f.en.replace(f.forat, '').trim().split(' ').pop());
        await escriu(page, f.forat.toLowerCase());
        await page.click('#btn-dictat-fet');
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'frases').length).toBe(1);
        expect(envios.find(e => e.datos.modulo === 'frases').datos.correcta).toBe(true);
        // malament: surt la frase bona amb la peça marcada en verd i el que ha escrit
        await expect.poll(() => page.evaluate(() => window.__fraseActual())).not.toBe(f.id);
        f = await actual();
        await escriu(page, 'xx');
        await page.click('#btn-dictat-fet');
        await expect(page.locator('.forat-bo')).toHaveText(f.forat);
        await expect(page.locator('.frase-mal')).toHaveText('xx');
        await page.click('#btn-frase-reescriu');
        await escriu(page, f.forat.toLowerCase());
        await page.click('#btn-dictat-fet');
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'frases').length).toBe(3);
        expect(envios.filter(e => e.datos.modulo === 'frases')[2].datos.correcta).toBe(true);
    });

    test('tradueix: surt la frase en català i la diu la veu en català', async ({ page }) => {
        await preparar(page, '2026-11-19', { frases: true }, { frases: { s: { 'f-long': { escolta: 1, tradueix: [], ultima: '2026-11-18' } } } });
        await page.evaluate(() => { window.__dites = []; window.speechSynthesis.speak = u => window.__dites.push(u.text); });
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        for (let i = 0; i < 6; i++) {
            const id = await page.evaluate(() => window.__fraseActual());
            if (id === 'f-long') {
                await expect(page.locator('.frase-ca')).toHaveText('Tinc els cabells llargs.');
                return;
            }
            await page.click('#btn-no-ho-se');
            await page.click('#btn-correction-continue');
        }
        throw new Error('no ha sortit la de traduir');
    });
});

test.describe('Des del 23/11: a Frases només la peça', () => {
    test('les que abans passaven a traduir, ara també són d\'escoltar (escriu una paraula)', async ({ page }) => {
        await preparar(page, '2026-11-23', { frases: true }, { frases: { s: {
            'f-long': { escolta: 1, tradueix: [], ultima: '2026-11-18' },
            'f-short': { escolta: 2, tradueix: ['2026-11-20'], ultima: '2026-11-20' } } } });
        const items = await page.evaluate(() => window.__itemsFrases());
        expect(items.length).toBeGreaterThan(0);
        expect(items.every(x => x.mode === 'escolta')).toBe(true);
    });

    test('si al forat escriu la frase sencera, no compta: li recorda que només va la paraula i la torna a escriure', async ({ page }) => {
        const envios = await preparar(page, '2026-11-23');
        await page.evaluate(() => { window.speechSynthesis.speak = () => {}; });
        const totes = await page.evaluate(() => window.__frasesEn());
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await expect.poll(() => page.evaluate(() => window.__fraseActual())).not.toBe(null);
        const id = await page.evaluate(() => window.__fraseActual());
        const f = totes.find(x => x.id === id);
        await escriu(page, 'his got long her');
        await page.click('#btn-dictat-fet');
        await expect(page.locator('#op-feedback')).toContainText('Només la paraula que falta');
        expect(envios.filter(e => e.datos.modulo === 'frases')).toHaveLength(0);
        await escriu(page, f.forat.toLowerCase());
        await page.click('#btn-dictat-fet');
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'frases').length).toBe(1);
        expect(envios.find(e => e.datos.modulo === 'frases').datos.correcta).toBe(true);
    });
});
