// Les difícils (des del 9/11): dins de «La de la setmana», màxim 3, amb un avís abans i el fons canviat.
// Abans de contestar, l'ha de dir en veu alta de les dues maneres: fins que no prem el botó, no surt el teclat.
const { test, expect, URL_APP, simularSupabase, empezarEnMision, respuestaCorrecta, teclear } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+/i;
const SETMANA_3x7 = { setmana: { idx: 2, dias: [], dominadas: [{ fet: '6x8', fecha: '2026-10-15' }, { fet: '7x8', fecha: '2026-11-09' }], mezcla: 2 },
    pas10: { nivel: 4, buenos: [], metode: 'endavant' } };

async function preparar(page, dia, fase1 = SETMANA_3x7) {
    const { envios } = await simularSupabase(page);
    await page.clock.setFixedTime(new Date(`${dia}T17:00:00`));
    await empezarEnMision(page, 7);
    await page.addInitScript(e => {
        if (sessionStorage.getItem('fase1-preparada')) return;
        sessionStorage.setItem('fase1-preparada', '1');
        localStorage.setItem('dojo_fase1', JSON.stringify(e));
    }, fase1);
    await page.goto(URL_APP);
    return envios;
}
const clau = c => [c.a, c.b].sort().join('x');

test.describe('Les difícils', () => {
    test('abans del 9/11 no n\'hi ha: el bloc té les 12 de sempre', async ({ page }) => {
        await preparar(page, '2026-11-08');
        const items = await page.evaluate(() => window.__itemsSetmana());
        expect(items).toHaveLength(12);
        expect(items.some(x => x.dificil)).toBe(false);
    });

    test('des del 9/11: 3 difícils afegides (15), mai just abans de la de la setmana; amb 3 × 7, sense 3 × 8 (el 24)', async ({ page }) => {
        await preparar(page, '2026-11-09');
        for (let k = 0; k < 5; k++) {
            const items = await page.evaluate(() => window.__itemsSetmana());
            expect(items).toHaveLength(15);
            const d = items.filter(x => x.dificil);
            expect(d.map(clau).sort()).toEqual(['3x6', '4x7', '7x9']);
            expect(items.filter(x => x.objetivo)).toHaveLength(4);
            items.forEach((x, i) => { if (x.dificil && i + 1 < items.length) expect(items[i + 1].objetivo).toBe(false); });
            // De relleno no sale ninguna de las difíciles ni de las atascadas
            const relleno = items.filter(x => !x.dificil && !x.objetivo).map(clau);
            for (const c of ['3x8', '4x7', '7x9', '3x6', '3x7']) expect(relleno).not.toContain(c);
        }
    });

    test('quan passa a 9 × 9, entra 3 × 8 i surt 3 × 6 (el 18 li fa d\'imant); 3 × 7, a la cua', async ({ page }) => {
        await preparar(page, '2026-11-12', { ...SETMANA_3x7, setmana: { ...SETMANA_3x7.setmana, idx: 3, mezcla: 3 } });
        const items = await page.evaluate(() => window.__itemsSetmana());
        expect(items.filter(x => x.dificil).map(clau).sort()).toEqual(['3x8', '4x7', '7x9']);
    });

    test('l\'avís, el fons canviat; la diu en veu alta (botó) i llavors surt el teclat; es guarda com a difícil', async ({ page }) => {
        const envios = await preparar(page, '2026-11-09');
        await expect.poll(async () => (await page.locator('#mision-pasos li').allTextContents()).join('|')).toContain('La de la setmana');
        const pasos = await page.locator('#mision-pasos li').allTextContents();
        await page.evaluate(i => {
            const plan = JSON.parse(localStorage.getItem('dojo_plan'));
            localStorage.setItem('dojo_plan', JSON.stringify({ ...plan, enCurso: { id: window.__idMisio(), bloque: i, fecha: '2026-11-09' } }));
        }, pasos.findIndex(t => t.includes('La de la setmana')));
        await page.reload();
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('La de la setmana');
        await page.click('#btn-intro-vamos');
        let vistes = 0, normals = 0;
        while (await page.isVisible('#screen-game')) {
            if (await page.isVisible('#gentle-correction-box')) { await page.click('#btn-correction-continue'); continue; }
            const d = await page.evaluate(() => window.__dificilActual());
            if (!d) {
                await expect(page.locator('body')).not.toHaveClass(/mode-dificil/);
                await expect(page.locator('#game-badge-ciclo')).toHaveText('La de la setmana');
                await teclear(page, respuestaCorrecta(await page.textContent('#op-factors')));
                await page.waitForTimeout(850);
                normals++;
                continue;
            }
            vistes++;
            // 1) L'avís, sense la multiplicació ni el teclat
            expect(d.fase).toBe('avis');
            await expect(page.locator('body')).toHaveClass(/mode-dificil/);
            await expect(page.locator('#dificil-avis')).toBeVisible();
            await expect(page.locator('#dificil-avis')).toContainText('DIFÍCIL');
            await expect(page.locator('#game-badge-ciclo')).toHaveText('⚠️ DIFÍCIL');
            await expect(page.locator('#op-factors')).toBeHidden();
            await expect(page.locator('#keypad')).toBeHidden();
            expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
            await page.click('#btn-dificil-avis');
            // 2) La multiplicació, les dues maneres per dir-la, i encara sense teclat (ni el físic)
            await expect(page.locator('#op-factors')).toHaveText(d.texto);
            await expect(page.locator('#dificil-dir')).toBeVisible();
            await expect(page.locator('#dificil-op-1')).toHaveText(d.texto);
            await expect(page.locator('#dificil-op-2')).toHaveText(d.altra);
            await expect(page.locator('#keypad')).toBeHidden();
            await expect(page.locator('#btn-no-ho-se')).toBeHidden();
            await page.keyboard.type('1');
            await expect(page.locator('#op-answer')).toHaveText('?');
            await page.click('#btn-dificil-dit');
            // 3) El teclat; la primera, malament: la bona i el truc
            await expect(page.locator('#dificil-dir')).toBeHidden();
            await expect(page.locator('#keypad')).toBeVisible();
            await expect(page.locator('#btn-no-ho-se')).toBeVisible();
            const bona = respuestaCorrecta(d.texto);
            if (vistes === 1) {
                await teclear(page, bona + 1);
                await expect(page.locator('#gentle-correction-box')).toBeVisible();
                await expect(page.locator('#correction-math-text')).toHaveText(`${d.texto} = ${bona}`);
                await expect(page.locator('#correction-pista')).toContainText('Truc:');
            } else {
                await teclear(page, bona);
                await page.waitForTimeout(850);
            }
        }
        expect(vistes).toBe(3);
        expect(normals).toBe(12);
        await expect(page.locator('body')).not.toHaveClass(/mode-dificil/);
        const multis = envios.filter(e => e.tabla === 'registros').map(e => e.datos);
        expect(multis).toHaveLength(15);
        const dif = multis.filter(m => m.detalle.dificil);
        expect(dif).toHaveLength(3);
        expect(dif.filter(m => !m.correcta)).toHaveLength(1);
        for (const m of dif) {
            expect(m.detalle.objetivo).toBe(false);
            expect(m.detalle.ms_avis).toEqual(expect.any(Number));
            expect(m.detalle.ms_dir).toEqual(expect.any(Number));
            expect(m.detalle.primer).toBe(m.operacion.replace(' x ', ' × '));
        }
        // Las difíciles no cuentan para la de la semana: solo las 4 de 3 × 7
        // (aquí la misión acaba con la de la setmana: día bueno, aunque una difícil haya salido mal)
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');
        const f = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_fase1')));
        expect(f.setmana.dias).toEqual(['2026-11-09']);
        expect(f.setmana.idx).toBe(2);
    });
});
