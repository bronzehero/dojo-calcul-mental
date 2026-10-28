// Tema 1 de mates (examen de tot el tema): des del 22/10, cada dia dins de l'entrenament i del repàs, abans de les paraules.
// Romans (llegir-los i escriure'ls), binari i la teoria (additiu, posicional). Si falla, la solució explicada.
const { test, expect, URL_APP, simularSupabase, teclear } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-20' }]);
const EXTRES_FETES = [{ id: 102, fecha: '2026-10-16' }, { id: 103, fecha: '2026-10-17' }];

async function preparar(page, dia, plan = {}, { paraules = false } = {}) {
    const { envios } = await simularSupabase(page, { tema1: true, paraules });
    await page.clock.setFixedTime(new Date(`${dia}T17:00:00`));
    await page.addInitScript(p => {
        if (sessionStorage.getItem('plan-preparado')) return;
        sessionStorage.setItem('plan-preparado', '1');
        localStorage.setItem('dojo_plan', JSON.stringify(p));
    }, { hechas: PLAN_ACABAT, extras: EXTRES_FETES, ...plan });
    await page.goto(URL_APP);
    return envios;
}

// Un lector de romans fet aquí, a part del de l'app: si el de l'app s'equivoqués, la prova ho veuria
function romaANumero(s) {
    const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let n = 0;
    for (let i = 0; i < s.length; i++) n += v[s[i]] < (v[s[i + 1]] || 0) ? -v[s[i]] : v[s[i]];
    return n;
}

const actual = page => page.evaluate(() => window.__tema1Actual());
async function seguent(page, anterior) {
    await expect.poll(async () => JSON.stringify(await actual(page))).not.toBe(anterior);
    return actual(page);
}

test.describe('Tema 1 de mates', () => {
    // Fins al 21/10 no hi és; des del 22/10 va a la missió, abans de les paraules (cada data, una pàgina nova: sense recarregar)
    for (const [dia, hi] of [['2026-10-21', false], ['2026-10-22', true]]) {
        test(`el ${dia}, ${hi ? 'hi és, abans de les paraules' : 'no hi és'}`, async ({ page }) => {
            await preparar(page, dia, {}, { paraules: true });
            await expect(page.locator('#mision-titulo')).toHaveText('Entrenament');
            await expect.poll(async () => (await page.locator('#mision-pasos li').allTextContents()).at(-1)).toBe('🔤 Paraules');
            const pasos = await page.locator('#mision-pasos li').allTextContents();
            if (hi) expect(pasos.at(-2)).toBe('🏛️ Tema 1 de mates');
            else expect(pasos.join(' ')).not.toContain('Tema 1');
        });
    }

    test('romans, binari i teoria: si falla, la solució explicada; es guarda cada resposta', async ({ page }) => {
        const envios = await preparar(page, '2026-10-22', { enCurso: { id: 10, bloque: 2, fecha: '2026-10-22' } });
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Tema 1 de mates');
        await page.click('#btn-intro-vamos');

        const modes = [];
        let anterior = 'null', falladaLlegir = false, falladaEscriure = false;
        for (let i = 0; i < 12; i++) {
            const t = await seguent(page, anterior);
            modes.push(t.modo);
            await expect(page.locator('#tema1-preg')).toBeVisible();
            if (['potencia', 'suma'].includes(t.modo)) {
                // Potències: els exponents, a dalt de debò (sup)
                await expect(page.locator('#op-factors sup').first()).toBeVisible();
                if (t.modo === 'suma') expect([...t.opcions]).toEqual(['Vertader', 'Fals']);
                if (t.modo === 'suma') expect(t.esperado).toBe(t.texto.includes('+') ? 'Fals' : 'Vertader');
                else expect(Number(t.esperado)).toBeGreaterThan(0);
            } else if (t.modo === 'binari') {
                // Cada xifra, amb el valor del seu lloc a sobre (des de la dreta: 1, 2, 4, 8)
                expect(t.esperado).toBe(String(parseInt(t.texto, 2)));
                const bits = page.locator('#op-factors .bit');
                await expect(bits).toHaveCount(t.texto.length);
                const llocs = [...t.texto].map((_, j) => String(2 ** (t.texto.length - 1 - j)));
                await expect(bits.locator('small')).toHaveText(llocs);
                for (let j = 0; j < t.texto.length; j++) expect((await bits.nth(j).textContent()).slice(llocs[j].length)).toBe(t.texto[j]);
                // Sobre un 0, el valor tachado: no se suma
                for (let j = 0; j < t.texto.length; j++) await expect(bits.nth(j).locator('small')).toHaveClass(t.texto[j] === '0' ? /zero/ : /^$/);
            } else if (t.modo === 'llegir') {
                // Lo que vale cada letra, encima; las dos que se restan, en una caja con la resta («500 − 100»)
                const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }, trossos = [];
                for (let j = 0; j < t.texto.length; j++) {
                    if (v[t.texto[j + 1]] > v[t.texto[j]]) { trossos.push([`${v[t.texto[j + 1]]} − ${v[t.texto[j]]}`, t.texto.slice(j, j + 2)]); j++; }
                    else trossos.push([String(v[t.texto[j]]), t.texto[j]]);
                }
                const caixes = page.locator('#op-factors .binari > span:not(.mes)');
                await expect(caixes.locator('small')).toHaveText(trossos.map(([e]) => e));
                // Entre cada lletra (o parella), un «+»: en romà els valors se sumen
                await expect(page.locator('#op-factors .binari > .mes')).toHaveCount(trossos.length - 1);
                if (trossos.length > 1) await expect(page.locator('#op-factors .binari > .mes').first()).toHaveText('+');
                for (let j = 0; j < trossos.length; j++) expect((await caixes.nth(j).textContent()).slice(trossos[j][0].length)).toBe(trossos[j][1]);
            } else {
                await expect(page.locator('#op-factors')).toHaveText(t.texto);
            }
            if (t.modo === 'llegir') expect(t.esperado).toBe(String(romaANumero(t.texto)));
            if (t.modo === 'escriure') {
                expect(romaANumero(t.esperado)).toBe(Number(t.texto));
                expect(t.opcions).toHaveLength(3);
                expect(new Set(t.opcions).size).toBe(3);
            }

            if (t.opcions) {
                await expect(page.locator('#keypad')).toBeHidden();
                await expect(page.locator('#tema1-opcions button')).toHaveCount(t.opcions.length);
                if (t.modo === 'escriure' && !falladaEscriure) {
                    falladaEscriure = true;
                    await page.click(`#tema1-opcions button:not([data-opcio="${t.esperado}"]) >> nth=0`);
                    await expect(page.locator('#gentle-correction-box')).toBeVisible();
                    await expect(page.locator('#correction-math-text')).toHaveText(`${t.texto} = ${t.esperado}`);
                    await expect(page.locator('#correction-pista')).toContainText(' = ');
                    await expect(page.locator('#tema1-panel')).toBeHidden();
                    expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
                    await page.click('#btn-correction-continue');
                } else {
                    await page.click(`#tema1-opcions button[data-opcio="${t.esperado}"]`);
                }
            } else if (t.modo === 'llegir' && !falladaLlegir) {
                falladaLlegir = true;
                await teclear(page, Number(t.esperado) + 1);
                await expect(page.locator('#gentle-correction-box')).toBeVisible();
                await expect(page.locator('#correction-math-text')).toHaveText(`${t.texto} = ${t.esperado}`);
                await expect(page.locator('#correction-pista')).toBeVisible();
                // La solució diu que se sumen, amb la suma dels llocs (XIV: 10 + 4 = 14)
                const n = Number(t.esperado), llocs = [1000, 100, 10, 1].map(q => Math.floor(n / q) % 10 * q).filter(Boolean);
                if (llocs.length > 1) await expect(page.locator('#correction-pista')).toContainText(`En romà els valors se sumen: ${llocs.join(' + ')} = ${n}.`);
                expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
                await page.click('#btn-correction-continue');
            } else {
                await teclear(page, t.esperado);
            }
            anterior = JSON.stringify(t);
        }
        expect(modes).toEqual(['llegir', 'llegir', 'llegir', 'escriure', 'escriure', 'escriure', 'binari', 'binari', 'concepte', 'concepte', 'potencia', 'suma']);
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');

        const dades = envios.filter(e => e.datos.modulo === 'tema1').map(e => e.datos);
        expect(dades).toHaveLength(12);
        expect(dades.filter(d => !d.correcta).map(d => d.detalle.modo).sort()).toEqual(['escriure', 'llegir']);
        expect(dades.every(d => d.detalle.modo && d.item.startsWith(`${d.detalle.modo}:`))).toBe(true);
    });

    test('«No ho sé» ensenya la solució explicada, sense so d\'error', async ({ page }) => {
        const envios = await preparar(page, '2026-10-22', { enCurso: { id: 10, bloque: 2, fecha: '2026-10-22' } });
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        const t = await seguent(page, 'null');
        await page.click('#btn-no-ho-se');
        await expect(page.locator('#gentle-correction-box')).toBeVisible();
        await expect(page.locator('#correction-math-text')).toHaveText(`${t.texto} = ${t.esperado}`);
        await expect(page.locator('#correction-pista')).toBeVisible();
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'tema1').length).toBe(1);
        expect(envios.find(e => e.datos.modulo === 'tema1').datos.detalle).toMatchObject({ no_lo_se: true, modo: 'llegir' });
    });
});
