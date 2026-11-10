// Fase 1: entrenamiento diario («Passar pel 10» + «La de la setmana») y misión de repaso los domingos
const {
    test, expect, URL_APP, simularSupabase, empezarEnMision, respuestaCorrecta, teclear
} = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+/i;
const hoy = () => new Date().toLocaleDateString('sv-SE');

/** Deja el estado de la fase 1 en el iPad antes de cargar la página. */
async function prepararFase1(page, estado) {
    // Por defecto, estados ya con el método de contar hacia delante (1/11); la migración tiene su prueba
    if (estado.pas10 && !('metode' in estado.pas10)) estado = { ...estado, pas10: { ...estado.pas10, metode: 'endavant' } };
    else if (estado.pas10 && estado.pas10.metode === null) { estado = { ...estado, pas10: { ...estado.pas10 } }; delete estado.pas10.metode; }
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
        // Les difícils (des del 9/11): l'avís i «ja l'he dit»; no compten com a vistes (en porta la llista a part)
        if (await page.isVisible('#dificil-avis')) { await page.click('#btn-dificil-avis'); continue; }
        if (await page.isVisible('#dificil-dir')) { await page.click('#btn-dificil-dit'); continue; }
        const texto = await page.textContent('#op-factors');
        if (await page.evaluate(() => !!window.__dificilActual())) {
            if (opciones.dificils) opciones.dificils.push(texto);
            await teclear(page, respuestaCorrecta(texto));
            await page.waitForTimeout(850);
            continue;
        }
        const pregunta = (await page.isVisible('#pas10-panel')) ? (await page.textContent('#pas10-pregunta')) : '';
        let m;
        if ((m = pregunta.match(/^De (\d+) a 10\?$/))) { await teclear(page, 10 - parseInt(m[1], 10)); continue; }
        if ((m = pregunta.match(/^De 10 a (\d+)\?$/))) { await teclear(page, parseInt(m[1], 10) - 10); continue; }
        vistos.push(texto);
        if (opciones.nouAmbDits && (await page.isVisible('#btn-pista'))) {
            await page.click('#btn-no-ho-se');
            await expect(page.locator('#pas10-dits')).toBeVisible();
        }
        if (opciones.signes) opciones.signes.push(await page.$eval('#op-factors', el => {
            const sg = el.querySelector('.signe');
            return sg ? { signe: sg.textContent, clase: sg.className } : null;
        }));
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
        await page.clock.setFixedTime(new Date('2026-10-20T17:00:00'));   // fuera de la prueba de paréntesis (31/10-2/11)
        await simularSupabase(page);
        await empezarEnMision(page, 7);
        await page.goto(URL_APP);
        await expect(page.locator('#mision-titulo')).toHaveText('Entrenament');
        await expect(page.locator('#mision-pasos li')).toHaveText(['🔟 Passar pel 10', '⭐ La de la setmana: 6 × 8']);
        expect(await page.locator('#screen-home').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
    });

    test('la primera resta nueva sale con la recta para contar hacia delante (un salto por número, sin números)', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 7);
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Passar pel 10');
        // Contar con los dedos y en voz baja está permitido (con eso no falla: papá, 17/10)
        await expect(page.locator('#intro-texto')).toContainText('Pots comptar amb els dits i dir-ho fluixet');
        // Contar hacia delante desde el pequeño, con el puño cerrado (papá, 1/11); nada de los dos saltos
        await expect(page.locator('#intro-texto')).toContainText('comença pel número petit, amb el puny tancat');
        await expect(page.locator('#intro-texto')).not.toContainText('dos salts');
        await expect(page.locator('#intro-ejemplo')).toHaveText('13 − 9 ➜ 9 amb el puny tancat · 10, 11, 12, 13 · 4 dits: 4');
        await page.click('#btn-intro-vamos');

        while (!(await page.isVisible('#pas10-panel'))) {
            await teclear(page, respuestaCorrecta(await page.textContent('#op-factors')));
            await page.waitForTimeout(850);
        }
        const texto = await page.textContent('#op-factors');
        const [a, b] = texto.split('−').map(x => parseInt(x, 10));
        expect(b).toBe(9);
        // La resta entera a la vista, sin preguntas de saltos
        await expect(page.locator('#op-igual')).toHaveText('=');
        await expect(page.locator('#pas10-pregunta')).toHaveText('');
        // Todos los números del 9 al grande, el puño en el 9 y un arco por número
        const nums = []; for (let k = b; k <= a; k++) nums.push(String(k));
        expect((await page.locator('#pas10-recta text').allTextContents()).filter(t => t !== '✊')).toEqual(nums);
        await expect(page.locator('#pas10-recta text', { hasText: '✊' })).toHaveCount(1);
        await expect(page.locator('#pas10-recta path')).toHaveCount(a - b);
        expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
        await teclear(page, a - b);
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'pas10' && e.datos.detalle.clase === 'nou').length).toBe(1);
        const e = envios.find(x => x.datos.modulo === 'pas10' && x.datos.detalle.clase === 'nou');
        expect(e.datos.correcta).toBe(true);
        expect(e.datos.detalle).toMatchObject({ ayuda: 'recta', metode: 'endavant', nivel: 1 });
        await page.waitForTimeout(850);

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
            expect(e.datos.detalle).toMatchObject({ nivel: 1, ayuda: 'recta', metode: 'endavant' });
            expect(e.datos.detalle.pasos).toBeUndefined();
        }
        const multis = envios.filter(e => e.tabla === 'registros' && !e.datos.detalle.dificil);
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

    test('2 días seguidos sin dudar: pasa a la siguiente multiplicación (7 × 8)', async ({ page }) => {
        await simularSupabase(page);
        // Un día entre semana: en domingo, después del entrenamiento tocaría el repaso
        await page.clock.setFixedTime(new Date('2026-10-14T17:00:00'));
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 0, dias: ['2026-10-02'], dominadas: [] }, pas10: { nivel: 1, buenos: [] } });
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
        expect(f.setmana.mezcla).toBeNull(); // la nueva empieza sola, sin contraste
        await page.click('#btn-summary-home');
        await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('dojo_plan')); p.permitirOtra = new Date().toLocaleDateString('sv-SE'); localStorage.setItem('dojo_plan', JSON.stringify(p)); });
        await page.reload();
        await expect(page.locator('#mision-pasos li').nth(1)).toHaveText('⭐ La de la setmana: 7 × 8');
    });

    test('7 × 8 desde el 2.º día: sale entre 6 × 8 y 6 × 9, y se apunta como contraste', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await page.clock.setFixedTime(new Date('2026-10-19T17:00:00'));
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 1, dias: ['2026-10-17'], dominadas: [{ fet: '6x8', fecha: '2026-10-15' }] }, pas10: { nivel: 1, buenos: [] } });
        await page.goto(URL_APP);
        await empezar(page);
        await contestarEntrenamiento(page);
        await expect(page.locator('#intro-texto')).toContainText('També sortiran 6 × 8 i 6 × 9');
        await page.click('#btn-intro-vamos');
        const vistos = await contestarEntrenamiento(page);
        expect(vistos).toHaveLength(12);
        const es = (v, x, y) => v === `${x} × ${y}` || v === `${y} × ${x}`;
        expect(vistos.filter(v => es(v, 7, 8))).toHaveLength(4);
        expect(vistos.filter(v => es(v, 6, 8))).toHaveLength(1);
        expect(vistos.filter(v => es(v, 6, 9))).toHaveLength(2);
        // Cada contraste, justo después de un 7 × 8
        [2, 5, 8].forEach(i => { expect(es(vistos[i - 1], 7, 8)).toBe(true); expect(es(vistos[i], 7, 8)).toBe(false); });
        const multis = envios.filter(e => e.tabla === 'registros');
        expect(multis.filter(e => e.datos.detalle.contraste === true)).toHaveLength(3);
        expect(multis.filter(e => e.datos.detalle.objetivo === true)).toHaveLength(4);
        // 2.º día seguido sin dudar: dominada, y la siguiente es 3 × 7
        const f = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_fase1')));
        expect(f.setmana.dominadas.map(d => d.fet)).toContain('7x8');
        expect(f.setmana.idx).toBe(2);
    });

    test('9/11: 7 × 8 se da por dominada (papá) y la de la semana pasa a 3 × 7', async ({ page }) => {
        await simularSupabase(page);
        await page.clock.setFixedTime(new Date('2026-11-09T17:00:00'));
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 1, dias: [], dominadas: [{ fet: '6x8', fecha: '2026-10-15' }], mezcla: 1 }, pas10: { nivel: 4, buenos: [], metode: 'endavant' } });
        await page.goto(URL_APP);
        await expect(page.locator('#mision-pasos li').nth(1)).toHaveText('⭐ La de la setmana: 3 × 7');
    });

    test('7 × 8 el primer día: sola, sin contraste', async ({ page }) => {
        await simularSupabase(page);
        await page.clock.setFixedTime(new Date('2026-10-19T17:00:00'));
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 1, dias: [], dominadas: [] }, pas10: { nivel: 1, buenos: [] } });
        await page.goto(URL_APP);
        await empezar(page);
        await contestarEntrenamiento(page);
        await expect(page.locator('#intro-texto')).not.toContainText('També sortiran');
        await page.click('#btn-intro-vamos');
        const vistos = await contestarEntrenamiento(page);
        expect(vistos.filter(v => /^(6 × 9|9 × 6|6 × 8|8 × 6)$/.test(v))).toHaveLength(0);
        const f = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_fase1')));
        expect(f.setmana.mezcla).toBe(1);
    });

    test('7 × 8: un día que no cuenta (una duda) no quita la mezcla', async ({ page }) => {
        await simularSupabase(page);
        await page.clock.setFixedTime(new Date('2026-10-20T17:00:00'));
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 1, dias: [], dominadas: [{ fet: '6x8', fecha: '2026-10-15' }], mezcla: 1 }, pas10: { nivel: 1, buenos: [] } });
        await page.goto(URL_APP);
        await empezar(page);
        await contestarEntrenamiento(page);
        await expect(page.locator('#intro-texto')).toContainText('També sortiran 6 × 8 i 6 × 9');
        await page.click('#btn-intro-vamos');
        const vistos = await contestarEntrenamiento(page);
        expect(vistos.filter(v => /^(6 × 9|9 × 6|6 × 8|8 × 6)$/.test(v))).toHaveLength(3);
    });

    test('estado de antes de la mezcla, con la de la semana ya empezada: sale con contraste', async ({ page }) => {
        await simularSupabase(page);
        await page.clock.setFixedTime(new Date('2026-10-20T17:00:00'));
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 1, dias: [], dominadas: [{ fet: '6x8', fecha: '2026-10-15' }] }, pas10: { nivel: 3, buenos: ['2026-10-19'] } });
        await page.goto(URL_APP);
        await empezar(page);
        await contestarEntrenamiento(page);
        await expect(page.locator('#intro-texto')).toContainText('També sortiran 6 × 8 i 6 × 9');
    });

    test('una de contraste mal: la corrección enseña su truco', async ({ page }) => {
        await simularSupabase(page);
        await page.clock.setFixedTime(new Date('2026-10-19T17:00:00'));
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 1, dias: ['2026-10-17'], dominadas: [] }, pas10: { nivel: 1, buenos: [] } });
        await page.goto(URL_APP);
        await empezar(page);
        await contestarEntrenamiento(page);
        await page.click('#btn-intro-vamos');
        let texto = await page.textContent('#op-factors');
        while (texto !== '6 × 9' && texto !== '9 × 6') {
            await teclear(page, respuestaCorrecta(texto));
            await page.waitForTimeout(850);
            texto = await page.textContent('#op-factors');
        }
        await teclear(page, 36);
        await expect(page.locator('#correction-pista')).toContainText('Taula del 9');
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
        await prepararFase1(page, { setmana: { idx: 0, dias: [], dominadas: [] }, pas10: { nivel: 4, buenos: [] } });
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
        await expect(page.locator('#pas10-recta path')).toHaveCount(a - b);
        await expect(page.locator('#pas10-recta')).toContainText(String(b));
        await expect(page.locator('#pas10-recta')).toContainText(String(a));
        await teclear(page, a - b);
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'pas10' && e.datos.detalle.pista === true).length).toBe(1);
        const e = envios.find(x => x.datos.detalle && x.datos.detalle.pista === true);
        expect(e.datos.detalle.nivel).toBe(4);
        expect(e.datos.detalle.pasos).toBeUndefined();
    });

    test('restas nuevas: se recuerda contar con los dedos y, al primer «No ho sé», se vuelve a probar así', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 0, dias: [], dominadas: [] }, pas10: { nivel: 5, buenos: [] } });
        await page.goto(URL_APP);
        await empezar(page);
        let texto = await page.textContent('#op-factors');
        while (!(await page.isVisible('#btn-pista'))) {
            await expect(page.locator('#tema1-preg')).toBeHidden();
            await teclear(page, respuestaCorrecta(texto));
            await page.waitForTimeout(850);
            texto = await page.textContent('#op-factors');
        }
        await expect(page.locator('#tema1-preg')).toHaveText(/amb els dits, en veu baixa/);
        await page.click('#btn-no-ho-se');
        await expect(page.locator('#pas10-dits')).toContainText('Prova-ho amb els dits');
        await expect(page.locator('#gentle-correction-box')).toBeHidden();
        await expect(page.locator('#op-factors')).toHaveText(texto);
        await teclear(page, respuestaCorrecta(texto));
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'pas10' && e.datos.detalle.clase === 'nou').length).toBe(2);
        const [primer, segon] = envios.filter(e => e.datos.modulo === 'pas10' && e.datos.detalle.clase === 'nou');
        expect(primer.datos.detalle).toMatchObject({ no_lo_se: true, intent: 1 });
        expect(segon.datos.correcta).toBe(true);
        expect(segon.datos.detalle).toMatchObject({ intent: 2, dits: true });
        expect(await page.evaluate(() => window.__textosVeu())).toEqual(expect.arrayContaining([
            'Compta endavant amb els dits, en veu baixa.', 'Prova-ho amb els dits: el petit amb el puny tancat, i compta fins al gran. Al teu ritme.']));
    });

    test('restas nuevas: si tampoco sale con los dedos, la respuesta; bien al segundo intento no cuenta para subir', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 0, dias: [], dominadas: [] }, pas10: { nivel: 5, buenos: ['2026-10-02'] } });
        await page.goto(URL_APP);
        await empezar(page);
        let texto = await page.textContent('#op-factors');
        while (!(await page.isVisible('#btn-pista'))) {
            await teclear(page, respuestaCorrecta(texto));
            await page.waitForTimeout(850);
            texto = await page.textContent('#op-factors');
        }
        await page.click('#btn-no-ho-se');
        await expect(page.locator('#pas10-dits')).toBeVisible();
        await page.click('#btn-no-ho-se');
        await expect(page.locator('#gentle-correction-box')).toBeVisible();
        await expect(page.locator('#correction-math-text')).toHaveText(`${texto} = ${respuestaCorrecta(texto)}`);
        await page.click('#btn-correction-continue');
        // Las otras tres nuevas, bien con los dedos al segundo intento
        await contestarEntrenamiento(page, { nouAmbDits: true });
        await page.click('#btn-intro-vamos');
        await contestarEntrenamiento(page);
        const f = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_fase1')));
        expect(f.pas10.nivel).toBe(5);
        expect(f.pas10.buenos).toEqual([]);
    });

    test('método nuevo (1/11): un estado de antes vuelve a la recta (nivel 2 como mucho) y empieza de cero los días buenos', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 0, dias: [], dominadas: [] }, pas10: { nivel: 5, buenos: ['2026-10-30'], metode: null } });
        await page.goto(URL_APP);
        await page.click('#btn-open-papa');
        await expect(page.locator('#papa-pas10')).toHaveText('nivel 2 de 6');
        await page.click('#btn-close-papa').catch(() => {});
        await page.goto(URL_APP);
        await empezar(page);
        while (!(await page.isVisible('#pas10-panel'))) {
            await expect(page.locator('#btn-pista')).toBeHidden();
            await teclear(page, respuestaCorrecta(await page.textContent('#op-factors')));
            await page.waitForTimeout(850);
        }
        const [, b] = (await page.textContent('#op-factors')).split('−').map(x => parseInt(x, 10));
        expect([8, 9]).toContain(b);
        await contestarEntrenamiento(page);
        await page.click('#btn-intro-vamos');
        await contestarEntrenamiento(page);
        const f = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_fase1')));
        expect(f.pas10).toMatchObject({ nivel: 2, metode: 'endavant' });
        expect(f.pas10.buenos).toEqual([hoy()]);
    });

    test('un estado con nivel 1 de antes se queda en el 1', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 0, dias: [], dominadas: [] }, pas10: { nivel: 1, buenos: [], metode: null } });
        await page.goto(URL_APP);
        await page.click('#btn-open-papa');
        await expect(page.locator('#papa-pas10')).toHaveText('nivel 1 de 6');
    });

    test('si falla una resta nueva, la corrección explica cómo contar hacia delante', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 7);
        await prepararFase1(page, { setmana: { idx: 0, dias: [], dominadas: [] }, pas10: { nivel: 6, buenos: [] } });
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
        const nums = []; for (let k = b + 1; k <= a; k++) nums.push(k);
        const n = a - b;
        await expect(page.locator('#correction-pista')).toHaveText(`${b} amb el puny tancat (no compta). Compta: ${nums.join(', ')}. ${n} ${n === 1 ? 'dit' : 'dits'}: ${n}.`);
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
        expect(p.extras.map(x => x.id).filter(id => ![102, 103].includes(id))).toEqual([11]);
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
        await expect(page.locator('#papa-pas10')).toHaveText('nivel 1 de 6');
        await page.click('#btn-f1-siguiente');
        await expect(page.locator('#papa-setmana')).toHaveText('7 × 8');
        await page.click('#btn-f1-subir');
        await expect(page.locator('#papa-pas10')).toHaveText('nivel 2 de 6');
        await page.click('#btn-f1-bajar');
        await page.click('#btn-f1-bajar');
        await expect(page.locator('#papa-pas10')).toHaveText('nivel 1 de 6');
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

test.describe('repetir el entrenamiento el 12/10 (la primera vez falló la app)', () => {
    const plan = (veces, dia) => ({ hechas: [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' }))
        .concat(Array.from({ length: veces }, () => ({ id: 10, fecha: dia }))),
        extras: [{ id: 102, fecha: '2026-01-01' }, { id: 103, fecha: '2026-01-01' }] });
    for (const [dia, veces, puede] of [['2026-10-12', 1, true], ['2026-10-12', 2, false], ['2026-10-13', 0, true],
        ['2026-11-11', 1, true], ['2026-11-11', 2, false], ['2026-11-12', 1, false]]) {
        test(`${dia} con ${veces} hecho(s): ${puede ? 'puede empezar' : 'misión complerta'}`, async ({ page }) => {
            await simularSupabase(page);
            await page.clock.setFixedTime(new Date(`${dia}T17:00:00`));
            await page.addInitScript(p => localStorage.setItem('dojo_plan', JSON.stringify(p)), plan(veces, dia));
            await page.goto(URL_APP);
            await expect(page.locator('#btn-start-game')).toBeVisible({ visible: puede });
            await expect(page.locator('#mision-hecha')).toBeVisible({ visible: !puede });
        });
    }
    // 8/11 (domingo): el repaso por la mañana y, por la tarde, el entrenamiento; una tercera, no
    const domingo = (extras, hechas = []) => ({ hechas: [1, 2, 3, 4, 5, 6, 10].map(id => ({ id, fecha: '2026-01-01' })).concat(hechas), extras });
    for (const [nom, p, puede] of [
        ['8/11 con el repaso hecho: puede hacer otra', domingo([{ id: 11, fecha: '2026-11-08' }]), true],
        ['8/11 con el repaso y el entrenamiento: misión complerta', domingo([{ id: 11, fecha: '2026-11-08' }], [{ id: 10, fecha: '2026-11-08' }]), false],
        ['15/11 con el repaso hecho: misión complerta', domingo([{ id: 11, fecha: '2026-11-15' }]), false]
    ]) {
        test(nom, async ({ page }) => {
            await simularSupabase(page);
            await page.clock.setFixedTime(new Date(`${p.extras[0].fecha}T17:00:00`));
            await page.addInitScript(p => localStorage.setItem('dojo_plan', JSON.stringify(p)), p);
            await page.goto(URL_APP);
            await expect(page.locator('#btn-start-game')).toBeVisible({ visible: puede });
            await expect(page.locator('#mision-hecha')).toBeVisible({ visible: !puede });
        });
    }
    test('otro día, con uno hecho ese día: misión complerta', async ({ page }) => {
        await simularSupabase(page);
        await page.clock.setFixedTime(new Date('2026-10-13T17:00:00'));
        await page.addInitScript(() => localStorage.setItem('dojo_plan', JSON.stringify({
            hechas: [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-13' }]) })));
        await page.goto(URL_APP);
        await expect(page.locator('#mision-hecha')).toBeVisible();
    });
});

test('la de la semana «sin dudar» se mide hasta la primera cifra (puede decirla en voz alta antes de escribir)', async ({ page }) => {
    await simularSupabase(page);
    await page.goto(URL_APP);
    const casos = await page.evaluate(() => [
        { ok: true, ms: 4130, pt: 3011, rectifica: false },   // la dice cantando y luego la escribe: vale
        { ok: true, ms: 5000, pt: 4500, rectifica: false },   // tarda en empezar: no vale
        { ok: true, ms: 2000, pt: 1000, rectifica: true },    // borra: no vale
        { ok: false, ms: 2000, pt: 1000, rectifica: false },  // mal: no vale
        { ok: true, ms: 3500, rectifica: false }              // datos antiguos sin pt: el tiempo total
    ].map(window.__sinDudar));
    expect(casos).toEqual([true, false, false, false, true]);
});

test('Passar pel 10: el signo va de color y late cuando cambia; la voz avisa de que hay sumas y restas', async ({ page }) => {
    await simularSupabase(page);
    await empezarEnMision(page, 7);
    await page.goto(URL_APP);
    await page.click('#btn-start-game');
    await expect(page.locator('#intro-texto')).toContainText('Mira bé el signe');
    await page.click('#btn-intro-vamos');
    const signes = [];
    await contestarEntrenamiento(page, { signes });
    const pas10 = signes.slice(0, 10);
    expect(pas10.every(x => x && /signe-(mes|menys)/.test(x.clase))).toBe(true);
    expect(pas10.every(x => x.clase.includes(x.signe === '+' ? 'signe-mes' : 'signe-menys'))).toBe(true);
    // Late solo al cambiar de signo (la primera no tiene anterior)
    pas10.forEach((x, i) => expect(x.clase.includes('signe-canvi')).toBe(i > 0 && x.signe !== pas10[i - 1].signe));
    expect(pas10.some(x => x.clase.includes('signe-canvi'))).toBe(true);
    // En la de la semana (todo multiplicaciones) no late nunca
    const setmana = signes.slice(10);
    expect(setmana.every(x => x && x.clase.includes('signe-per') && !x.clase.includes('signe-canvi'))).toBe(true);
});
