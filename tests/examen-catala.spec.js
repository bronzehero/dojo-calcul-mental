// Simulacre de l'examen de català «Consonantisme»: misión extra que papá pone desde la Zona Papá.
// Mismas frases que el examen; se evalúa sin decir si está bien durante el bloque y, al acabar cada
// bloque, se le enseñan las palabras bien escritas.
const { test, expect, URL_APP, simularSupabase, empezarEnMision } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;

// Las respuestas del examen, en orden (también comprueba que los datos de la app están bien)
const RESPUESTAS = [
    ['V', 'B', 'G', 'P', 'P', 'D', 'B', 'B', 'P', 'D', 'P', 'B'],
    ['Z', 'S', 'SS', 'SS', 'Z', 'SS', 'SC', 'S', 'Ç', 'C'],
    ['TJ', 'IG', 'TG', 'TG', 'TX', 'IX', 'X', 'X', 'X', 'X'],
    ['M', 'N', 'M', 'H', 'L·L', 'R', 'L·L', 'L·L']
];
const PALABRAS_BLOC_1 = ['Marxava', 'abdomen', 'magdalenes', 'òptic', 'capficat', 'advocat', 'cabdal', 'cabdell', 'capgròs', 'adverbis', 'capfiquis', 'obstacles'];

/** Pone el simulacro como misión de hoy desde la Zona Papá (ya ha hecho la del día). */
async function ponerSimulacro(page) {
    await page.click('#btn-open-papa');
    await page.selectOption('#sel-mision', 'x101');
    await page.click('#btn-set-mision');
    await expect(page.locator('#plan-lista')).toContainText('Puesta para hoy');
    await expect(page.locator('#plan-lista')).toContainText('Después del extra');
    await expect(page.locator('#plan-lista')).not.toContainText('Toca ahora');
    await page.click('#btn-close-papa');
}

/** Contesta el bloque que hay en pantalla. fallar: índices donde elige otra letra. */
async function contestarBloque(page, iBloc, fallar = []) {
    await expect(page.locator('#grafia-panel')).toBeVisible();
    const res = RESPUESTAS[iBloc];
    for (let i = 0; i < res.length; i++) {
        await expect(page.locator('.forat.actual')).toHaveCount(1);
        let lletra = res[i];
        if (fallar.includes(i)) lletra = (await page.$$eval('#grafia-botones button', bs => bs.map(b => b.dataset.lletra))).find(l => l !== res[i]);
        await page.click(`#grafia-botones [data-lletra="${lletra}"]`);
        // Nunca se dice si está bien o mal durante el bloque
        await expect(page.locator('#gentle-correction-box')).toBeHidden();
        await page.waitForTimeout(500);
    }
}

test.describe('Simulacre: examen de català', () => {
    test('papá lo pone para hoy aunque ya haya hecho la misión; 4 bloques con repaso; el plan sigue igual', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        const hoy = new Date().toLocaleDateString('sv-SE');
        await empezarEnMision(page, 4, { hechas: [{ id: 1, fecha: '2026-01-01' }, { id: 2, fecha: '2026-01-02' }, { id: 3, fecha: hoy }] });
        await page.goto(URL_APP);
        await expect(page.locator('#mision-hecha')).toBeVisible();

        await ponerSimulacro(page);
        await expect(page.locator('#mision-titulo')).toHaveText('Simulacre: examen de català');
        await expect(page.locator('#mision-pasos li')).toHaveCount(4);
        await page.click('#btn-start-game');

        for (let iBloc = 0; iBloc < 4; iBloc++) {
            await expect(page.locator('#intro-texto')).toContainText('full de les consonants');
            await expect(page.locator('#intro-texto')).toContainText('No ho sé');
            await expect(page.locator('#intro-texto')).toContainText('Posa la grafia corresponent');
            await expect(page.locator('#intro-titulo')).toHaveText(new RegExp(`^${iBloc + 1}\\. Grafies `));
            expect(await page.innerText('#screen-intro')).not.toMatch(/rosa|lila|blau|verd/i);
            await page.click('#btn-intro-vamos');
            const opciones = await page.$$eval('#grafia-botones button', bs => bs.map(b => b.textContent));
            for (const r of RESPUESTAS[iBloc]) expect(opciones).toContain(r);
            await contestarBloque(page, iBloc, iBloc === 0 ? [1] : []);
            // Repaso: las frases bien escritas, sin marcar las suyas ni contar nada
            await expect(page.locator('#screen-repas')).toBeVisible();
            const lineas = await page.$$eval('#repas-llista li', ls => ls.map(l => l.textContent));
            expect(lineas.join(' ')).not.toMatch(/[{}]/);
            expect(await page.innerText('#screen-repas')).not.toMatch(PROHIBIDO_EN_PANTALLA);
            if (iBloc === 0) {
                expect(lineas[0]).toBe("Marxava a casa perquè li feia mal l'abdomen de menjar magdalenes.");
                expect(await page.$$eval('#repas-llista b', bs => bs.map(b => b.textContent).join(''))).toBe('vbgppdbbpdpb');
            }
            await page.click('#btn-repas-seguim');
        }
        await expect(page.locator('#summary-titulo')).toHaveText(/^Missió complerta/);
        await expect(page.locator('#photocard-zona')).toBeVisible();

        // Datos: una fila por letra, con la palabra entera y el bloque
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'grafia').length).toBe(40);
        const filas = envios.filter(e => e.datos.modulo === 'grafia').map(e => e.datos);
        expect(filas.map(f => f.esperado)).toEqual(RESPUESTAS.flat());
        expect(filas.slice(0, 12).map(f => f.item)).toEqual(PALABRAS_BLOC_1);
        expect(filas.filter(f => !f.correcta).map(f => f.item)).toEqual(['abdomen']);
        expect(filas[1].respuesta).not.toBe('B');
        expect(filas[0].detalle.bloc).toBe('rosa');
        expect(filas[39].detalle.bloc).toBe('verd');
        expect(filas.every(f => f.detalle.mision === 101 && f.detalle.escoltat === 0)).toBe(true);
        expect(envios.find(e => e.datos.modulo === 'mision').datos.item).toBe('101');

        // El plan no se mueve: mañana toca la misión 4; hoy ya está hecha
        const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_plan')));
        expect(plan.hechas).toHaveLength(3);
        expect(plan.extras).toEqual([{ id: 101, fecha: hoy }]);
        expect(plan.extra).toBeUndefined();
        await page.click('#btn-summary-home');
        await expect(page.locator('#mision-hecha')).toBeVisible();
        await page.click('#btn-open-papa');
        await expect(page.locator('#plan-lista')).toContainText(`✅ ${hoy}`);
        await page.click('#btn-close-papa');
        await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('dojo_plan')); p.extras[0].fecha = '2026-01-03'; p.hechas[2].fecha = '2026-01-03'; localStorage.setItem('dojo_plan', JSON.stringify(p)); });
        await page.reload();
        await expect(page.locator('#mision-titulo')).toHaveText('Restes');
    });

    test('la frase enseña lo que ya ha puesto ella (sin corregir) y el hueco actual; «No ho sé» y «Escoltar» se guardan', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await page.addInitScript(() => {
            window.__dicho = [];
            window.speechSynthesis.speak = u => window.__dicho.push(u.text);
        });
        await empezarEnMision(page, 4, { extra: 101 });
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await expect(page.locator('#op-factors')).toContainText('Marxa');
        await expect(page.locator('#op-igual')).toBeHidden();
        // La paraula que toca va sencera i junta, amb el forat a dins
        await expect(page.locator('.paraula.actual')).toHaveText('Marxa?a');
        expect(await page.$eval('.paraula.actual', e => getComputedStyle(e).whiteSpace)).toBe('nowrap');
        await expect(page.locator('.paraula')).toHaveCount(3);
        await expect(page.locator('#game-badge-ciclo')).toHaveText('Exercici 1');
        expect(await page.innerText('#screen-game')).not.toMatch(PROHIBIDO_EN_PANTALLA);
        await page.click('#btn-escoltar-frase');
        expect(await page.evaluate(() => window.__dicho)).toContain("Marxava a casa perquè li feia mal l'abdomen de menjar magdalenes.");
        await page.click('#grafia-botones [data-lletra="B"]'); // marxa_a: se equivoca
        await page.waitForTimeout(500);
        // Su respuesta se queda en la frase tal cual (en minúscula), sin decir nada
        await expect(page.locator('.forat.posat')).toHaveText('b');
        await expect(page.locator('#gentle-correction-box')).toBeHidden();
        await page.click('#btn-no-ho-se'); // l'a_domen
        await page.waitForTimeout(300);
        await expect(page.locator('.forat.posat')).toHaveText(['b', '?']);
        await expect(page.locator('.paraula.actual')).toHaveText('ma?dalenes');
        await expect(page.locator('.paraula').first()).toHaveText('Marxaba');
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'grafia').length).toBe(2);
        const [f1, f2] = envios.filter(e => e.datos.modulo === 'grafia').map(e => e.datos);
        expect(f1).toMatchObject({ item: 'Marxava', esperado: 'V', respuesta: 'B', correcta: false });
        expect(f1.detalle.escoltat).toBe(1);
        expect(f2).toMatchObject({ item: 'abdomen', esperado: 'B', respuesta: null, correcta: false });
        expect(f2.detalle.no_lo_se).toBe(true);
    });

    test('se puede parar entre bloques y sigue por donde iba', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 4, { extra: 101 });
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await contestarBloque(page, 0);
        await page.click('#btn-repas-seguim');
        await page.click('#btn-intro-parar');
        await page.click('#btn-summary-home');
        await expect(page.locator('#mision-pasos li.hecho')).toHaveCount(1);
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('2. Grafies S, SS, C, Ç, Z, SC');
    });

    test('papá lo puede probar sin guardar nada', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 4);
        await page.goto(URL_APP);
        const antes = await page.evaluate(() => localStorage.getItem('dojo_plan'));
        await page.click('#btn-open-papa');
        await page.selectOption('#sel-mision', 'x101');
        await page.click('#btn-probar');
        await expect(page.locator('#banner-prueba')).toBeVisible();
        await expect(page.locator('#intro-titulo')).toHaveText('1. Grafies P, T, C, B, D, G, V');
        await page.click('#btn-intro-vamos');
        await contestarBloque(page, 0);
        await page.click('#btn-repas-seguim');
        await expect(page.locator('#intro-titulo')).toHaveText('2. Grafies S, SS, C, Ç, Z, SC');
        await page.click('#btn-intro-parar');
        await page.waitForTimeout(300);
        expect(envios).toEqual([]);
        expect(await page.evaluate(() => localStorage.getItem('dojo_plan'))).toBe(antes);
    });

    for (const [nombre, tam] of [['horizontal', { width: 1180, height: 820 }], ['vertical', { width: 820, height: 1180 }], ['móvil', { width: 375, height: 740 }]]) {
        test(`la frase y las letras caben en la pantalla (${nombre})`, async ({ page }) => {
            await page.setViewportSize(tam);
            await simularSupabase(page);
            await empezarEnMision(page, 4, { extra: 101 });
            await page.goto(URL_APP);
            await page.click('#btn-start-game');
            await page.click('#btn-intro-vamos');
            await expect(page.locator('#op-factors')).toBeInViewport();
            const botones = page.locator('#grafia-botones button');
            for (let i = 0; i < await botones.count(); i++) await expect(botones.nth(i)).toBeInViewport();
            await expect(page.locator('#btn-no-ho-se')).toBeInViewport();
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        });
    }
});
