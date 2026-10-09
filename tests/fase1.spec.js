// Fase 1: entrenamiento diario («Passar pel 10» + «La de la setmana») y misión de repaso los domingos
const {
    test, expect, URL_APP, simularSupabase, empezarEnMision, respuestaCorrecta, teclear
} = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+/i;
const hoy = () => new Date().toLocaleDateString('sv-SE');

/** Deja el estado de la fase 1 en el iPad antes de cargar la página. */
async function prepararFase1(page, estado) {
    await page.addInitScript(e => {
        if (sessionStorage.getItem('fase1-preparada')) return;
        sessionStorage.setItem('fase1-preparada', '1');
        localStorage.setItem('dojo_fase1', JSON.stringify(e));
    }, estado);
}

/** Contesta lo que haya en pantalla hasta salir del juego. En la recta guiada contesta cada salto.
 *  opciones.objetivo(texto, n): devuelve la respuesta para la multiplicación de la semana (n = vez que sale). */
async function contestarEntrenamiento(page, opciones = {}) {
    const vistos = [];
    let nObjetivo = 0;
    while (await page.isVisible('#screen-game')) {
        if (await page.isVisible('#gentle-correction-box')) {
            await page.click('#btn-correction-continue');
            continue;
        }
        const texto = await page.textContent('#op-factors');
        const pregunta = (await page.isVisible('#pas10-panel')) ? (await page.textContent('#pas10-pregunta')) : '';
        let m;
        if ((m = pregunta.match(/^De (\d+) a 10\?$/))) { await teclear(page, 10 - parseInt(m[1], 10)); continue; }
        if ((m = pregunta.match(/^De 10 a (\d+)\?$/))) { await teclear(page, parseInt(m[1], 10) - 10); continue; }
        vistos.push(texto);
        const esObjetivo = opciones.objetivo && /×/.test(texto) && opciones.esObjetivo(texto);
        const respuesta = esObjetivo ? opciones.objetivo(texto, nObjetivo++) : respuestaCorrecta(texto);
        await teclear(page, respuesta);
        if (respuesta === respuestaCorrecta(texto)) await page.waitForTimeout(850);
    }
    return vistos;
}

async function empezar(page) {
    await page.click('#btn-start-game');
    await page.click('#btn-intro-vamos');
}

test.describe('Fase 1 · Entrenament', () => {
    test('después del plan, la misión es el entrenamiento con sus dos partes', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 7);
        await page.goto(URL_APP);
        await expect(page.locator('#mision-titulo')).toHaveText('Entrenament');
        await expect(page.locator('#mision-pasos li')).toHaveText(['🔟 Passar pel 10', '⭐ La de la setmana: 6 × 8']);
        expect(await page.locator('#screen-home').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
    });

    test('la primera resta nueva sale con la recta y los saltos en blanco', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 7);
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Passar pel 10');
        await page.click('#btn-intro-vamos');

        // Primera resta nueva: la recta con los saltos en blanco y la primera pregunta
        let texto = await page.textContent('#op-factors');
        while (!/−/.test(texto) || !(await page.isVisible('#pas10-panel'))) {
            await teclear(page, respuestaCorrecta(texto));
            await page.waitForTimeout(850);
            texto = await page.textContent('#op-factors');
        }
        await expect(page.locator('#pas10-pregunta')).toHaveText(/^De 9 a 10\?$/);
        await expect(page.locator('#pas10-recta text')).toContainText(['10', '?']);
        expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);

        const vistosA = await contestarEntrenamiento(page);
        expect(vistosA.length).toBeGreaterThanOrEqual(8);
        await expect(page.locator('#intro-titulo')).toHaveText('La de la setmana');
    });
});

test.describe('Fase 1 · misión entera', () => {
    test('se guarda cada paso, la de la setmana y el estado; cuenta como día bueno', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 7);
        await page.goto(URL_APP);
        await empezar(page);
        await contestarEntrenamiento(page);
        await expect(page.locator('#intro-titulo')).toHaveText('La de la setmana');
        await expect(page.locator('#intro-texto')).toContainText('5 vuits són 40');
        await page.click('#btn-intro-vamos');
        const vistos = await contestarEntrenamiento(page);
        expect(vistos).toHaveLength(12);
        expect(vistos.filter(v => v === '6 × 8' || v === '8 × 6')).toHaveLength(4);
        // Nunca de relleno las que le hacen de imán al 6 × 8 (24, 42, 54, 64) ni otras atascadas
        for (const v of vistos.filter(v => v !== '6 × 8' && v !== '8 × 6')) {
            expect([24, 42, 54, 64, 48]).not.toContain(respuestaCorrecta(v));
        }
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');

        await expect.poll(() => envios.filter(e => e.datos.modulo === 'fase1').length).toBe(1);
        const pas10 = envios.filter(e => e.datos.modulo === 'pas10');
        expect(pas10).toHaveLength(10);
        const nuevas = pas10.filter(e => e.datos.detalle.clase === 'nou');
        expect(nuevas).toHaveLength(4);
        for (const e of nuevas) {
            expect(e.datos.item).toMatch(/^1\d-9$/);
            expect(e.datos.detalle.pasos).toHaveLength(2);
            expect(e.datos.detalle.pasos.every(x => x.ok)).toBe(true);
            expect(e.datos.detalle.nivel).toBe(1);
        }
        const multis = envios.filter(e => e.tabla === 'registros');
        expect(multis).toHaveLength(12);
        expect(multis.filter(e => e.datos.detalle.objetivo)).toHaveLength(4);
        expect(multis.every(e => e.datos.detalle.setmana === '6x8')).toBe(true);
        expect(envios.find(e => e.datos.modulo === 'mision').datos.item).toBe('10');

        const f = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_fase1')));
        expect(f.setmana.dias).toEqual([hoy()]);
        expect(f.setmana.idx).toBe(0);
        expect(f.pas10.buenos).toEqual([hoy()]);
        expect(f.pas10.nivel).toBe(1);
    });

    test('cifras giradas: aviso propio, el truco y queda apuntado', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 7);
        await page.goto(URL_APP);
        await empezar(page);
        await contestarEntrenamiento(page);
        await page.click('#btn-intro-vamos');
        // La primera vez que sale el 6 × 8, contesta 84
        let texto = await page.textContent('#op-factors');
        while (texto !== '6 × 8' && texto !== '8 × 6') {
            await teclear(page, respuestaCorrecta(texto));
            await page.waitForTimeout(850);
            texto = await page.textContent('#op-factors');
        }
        await teclear(page, 84);
        await expect(page.locator('#correction-title')).toHaveText('🔄 Les xifres són bones, però girades!');
        await expect(page.locator('#correction-pista')).toContainText('5 vuits són 40');
        await expect.poll(() => envios.filter(e => e.tabla === 'registros' && e.datos.respuesta_dada === 84).length).toBe(1);
        const r = envios.find(e => e.tabla === 'registros' && e.datos.respuesta_dada === 84);
        expect(r.datos.detalle.girada).toBe(true);
        expect(r.datos.detalle.objetivo).toBe(true);

        // Un fallo de la de la setmana: ese día no cuenta y se vuelve a empezar la cuenta
        await page.click('#btn-correction-continue');
        await contestarEntrenamiento(page);
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');
        const f = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_fase1')));
        expect(f.setmana.dias).toEqual([]);
    });

    test('un fallo normal no se marca como girado', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 7);
        await page.goto(URL_APP);
        await empezar(page);
        await contestarEntrenamiento(page);
        await page.click('#btn-intro-vamos');
        let texto = await page.textContent('#op-factors');
        while (texto !== '6 × 8' && texto !== '8 × 6') {
            await teclear(page, respuestaCorrecta(texto));
            await page.waitForTimeout(850);
            texto = await page.textContent('#op-factors');
        }
        await teclear(page, 42);
        await expect(page.locator('#correction-title')).toHaveText("🌸 Gairebé! Fixa-t'hi bé:");
        await expect.poll(() => envios.filter(e => e.tabla === 'registros' && e.datos.respuesta_dada === 42).length).toBe(1);
        expect(envios.find(e => e.datos.respuesta_dada === 42).datos.detalle.girada).toBeUndefined();
    });

    test('3 días seguidos sin dudar: pasa a la siguiente multiplicación (7 × 8)', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 0, dias: ['2026-10-01', '2026-10-02'], dominadas: [] }, pas10: { nivel: 1, buenos: [] } });
        await page.goto(URL_APP);
        await empezar(page);
        await contestarEntrenamiento(page);
        await page.click('#btn-intro-vamos');
        await contestarEntrenamiento(page);
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');
        const f = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_fase1')));
        expect(f.setmana.idx).toBe(1);
        expect(f.setmana.dias).toEqual([]);
        expect(f.setmana.dominadas.map(d => d.fet)).toEqual(['6x8']);
        await page.click('#btn-summary-home');
        await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('dojo_plan')); p.permitirOtra = new Date().toLocaleDateString('sv-SE'); localStorage.setItem('dojo_plan', JSON.stringify(p)); });
        await page.reload();
        await expect(page.locator('#mision-pasos li').nth(1)).toHaveText('⭐ La de la setmana: 7 × 8');
    });

    test('2 días buenos en «Passar pel 10»: sube de nivel (de 9 a 9 y 8)', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 0, dias: [], dominadas: [] }, pas10: { nivel: 1, buenos: ['2026-10-02'] } });
        await page.goto(URL_APP);
        await empezar(page);
        await contestarEntrenamiento(page);
        await page.click('#btn-intro-vamos');
        await contestarEntrenamiento(page);
        const f = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_fase1')));
        expect(f.pas10.nivel).toBe(2);
        expect(f.pas10.buenos).toEqual([]);
    });

    test('nivel con pista: sin recta hasta que pulsa «Pista», y se apunta', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 0, dias: [], dominadas: [] }, pas10: { nivel: 3, buenos: [] } });
        await page.goto(URL_APP);
        await empezar(page);
        let texto = await page.textContent('#op-factors');
        while (!(await page.isVisible('#btn-pista'))) {
            await expect(page.locator('#pas10-panel')).toBeHidden();
            await teclear(page, respuestaCorrecta(texto));
            await page.waitForTimeout(850);
            texto = await page.textContent('#op-factors');
        }
        await expect(page.locator('#pas10-panel')).toBeHidden();
        await page.click('#btn-pista');
        await expect(page.locator('#pas10-panel')).toBeVisible();
        await expect(page.locator('#btn-pista')).toBeHidden();
        const [a, b] = texto.split('−').map(x => parseInt(x, 10));
        await expect(page.locator('#pas10-recta')).toContainText(String(10 - b));
        await expect(page.locator('#pas10-recta')).toContainText(String(a - 10));
        await teclear(page, a - b);
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'pas10' && e.datos.detalle.pista === true).length).toBe(1);
        const e = envios.find(x => x.datos.detalle && x.datos.detalle.pista === true);
        expect(e.datos.detalle.nivel).toBe(3);
        expect(e.datos.detalle.pasos).toBeUndefined();
    });

    test('si falla una resta nueva, la corrección explica los dos saltos', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 0, dias: [], dominadas: [] }, pas10: { nivel: 5, buenos: [] } });
        await page.goto(URL_APP);
        await empezar(page);
        let texto = await page.textContent('#op-factors');
        while (!/−/.test(texto) || /^10 −/.test(texto)) {
            await teclear(page, respuestaCorrecta(texto));
            await page.waitForTimeout(850);
            texto = await page.textContent('#op-factors');
        }
        const [a, b] = texto.split('−').map(x => parseInt(x, 10));
        await teclear(page, a - b + 1);
        await expect(page.locator('#correction-pista')).toHaveText(`De ${b} a 10, ${10 - b}. De 10 a ${a}, ${a - 10}. En total, ${a - b}.`);
    });

    test('en modo prueba no cambia nada del entrenamiento', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 7);
        await page.goto(URL_APP + '?prova');
        await empezar(page);
        await contestarEntrenamiento(page);
        await page.click('#btn-intro-vamos');
        await contestarEntrenamiento(page);
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');
        expect(await page.evaluate(() => localStorage.getItem('dojo_fase1'))).toBeNull();
    });
});

test.describe('Fase 1 · domingo', () => {
    test('el primer domingo (sin entrenar antes) también toca entrenamiento', async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-10-11T10:00:00'));
        await simularSupabase(page);
        await empezarEnMision(page, 7);
        await page.goto(URL_APP);
        await expect(page.locator('#mision-titulo')).toHaveText('Entrenament');
    });

    test('domingo con entrenamientos hechos: misión de repaso, siempre las mismas, sin ayudas', async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-10-18T10:00:00'));
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 7, { hechas: [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-10-01' })).concat([{ id: 10, fecha: '2026-10-17' }]) });
        await page.goto(URL_APP);
        await expect(page.locator('#mision-titulo')).toHaveText('Missió de repàs');
        await empezar(page);
        const vistos = await contestarEntrenamiento(page);
        expect(vistos).toHaveLength(28);
        expect(vistos).toContain('6 × 8');
        expect(vistos).toContain('13 − 8');
        expect(vistos).toContain('9 + 7');
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'mision').length).toBe(1);
        const respuestas = envios.filter(e => e.datos.modulo !== 'mision');
        expect(respuestas).toHaveLength(28);
        expect(respuestas.every(e => e.datos.detalle.control === true)).toBe(true);
        const p = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_plan')));
        expect(p.extras.map(x => x.id)).toEqual([11]);
        await page.click('#btn-summary-home');
        await expect(page.locator('#mision-hecha')).toBeVisible();
    });
});

test.describe('Fase 1 · Zona Papá', () => {
    test('enseña el estado y puede cambiar la multiplicación y el nivel', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 7);
        await page.goto(URL_APP);
        await page.click('#btn-open-papa');
        await expect(page.locator('#papa-setmana')).toHaveText('6 × 8');
        await expect(page.locator('#papa-pas10')).toHaveText('nivel 1 de 5');
        await page.click('#btn-f1-siguiente');
        await expect(page.locator('#papa-setmana')).toHaveText('7 × 8');
        await page.click('#btn-f1-subir');
        await expect(page.locator('#papa-pas10')).toHaveText('nivel 2 de 5');
        await page.click('#btn-f1-bajar');
        await page.click('#btn-f1-bajar');
        await expect(page.locator('#papa-pas10')).toHaveText('nivel 1 de 5');
        await page.click('#btn-close-papa');
        await expect(page.locator('#mision-pasos li').nth(1)).toHaveText('⭐ La de la setmana: 7 × 8');
    });
});

test.describe('Fase 1 · diseño en el iPad', () => {
    for (const [nombre, tam] of [['horizontal', { width: 1180, height: 820 }], ['vertical', { width: 820, height: 1180 }]]) {
        test(`la recta y el teclado caben en la pantalla (${nombre})`, async ({ page }) => {
            await page.setViewportSize(tam);
            await simularSupabase(page);
            await empezarEnMision(page, 7);
            await page.goto(URL_APP);
            await empezar(page);
            let texto = await page.textContent('#op-factors');
            while (!(await page.isVisible('#pas10-panel'))) {
                await teclear(page, respuestaCorrecta(texto));
                await page.waitForTimeout(850);
                texto = await page.textContent('#op-factors');
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            await expect(page.locator('#pas10-pregunta')).toBeInViewport();
            await expect(page.locator('#keypad [data-key="5"]')).toBeInViewport();
            await expect(page.locator('#btn-submit-answer')).toBeInViewport();
        });
    }
});
