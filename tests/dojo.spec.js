// Pruebas del Dojo: todo lo que la alumna puede hacer en la app, y lo que se guarda.
const {
    test, expect, URL_APP, simularSupabase, empezarEnMision, respuestaCorrecta,
    teclear, contestarBloqueNumerico, leerCola, irAlUltimoBloque
} = require('./ayudas');

// Palabras que delatarían un cronómetro o un contador de fallos (bloquean a la alumna)
const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+/i;

test.describe('Inicio', () => {
    test('muestra solo la misión de hoy, en catalán', async ({ page }) => {
        await simularSupabase(page);
        await page.goto(URL_APP);
        await expect(page.locator('#mision-titulo')).toHaveText('Números i taules');
        await expect(page.locator('#mision-pasos li')).toHaveText(['⌨️ Escriure 20 números', '✖️ 10 multiplicacions']);
        await expect(page.locator('#btn-start-game')).toContainText('Començar');
        await expect(page.locator('#mision-hecha')).toBeHidden();
        expect(await page.locator('#screen-home').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
    });
});

test.describe('Presentación de cada bloque', () => {
    test('enseña un ejemplo y no muestra "=" al copiar números', async ({ page }) => {
        await simularSupabase(page);
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Escriure números');
        await expect(page.locator('#intro-ejemplo')).toHaveText('Veus 47 ➜ escrius 47');
        await page.click('#btn-intro-vamos');
        await expect(page.locator('#op-igual')).toBeHidden();
        await expect(page.locator('#keypad')).toBeVisible();
        expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
    });
});

test.describe('Misión 1 completa', () => {
    test('20 números + 10 multiplicaciones, se guarda todo y queda hecha por hoy', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        expect(await contestarBloqueNumerico(page)).toBe(20);

        await expect(page.locator('#intro-titulo')).toHaveText('Multiplicacions');
        await expect(page.locator('#intro-ejemplo')).toHaveText('7 × 2 ➜ escrius 14');
        await page.click('#btn-intro-vamos');
        await expect(page.locator('#op-igual')).toBeVisible();
        expect(await contestarBloqueNumerico(page, [2])).toBe(10);

        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');
        await page.click('#btn-summary-home');
        await expect(page.locator('#mision-hecha')).toBeVisible();
        await expect(page.locator('#btn-start-game')).toBeHidden();

        await expect.poll(() => envios.length).toBe(31);
        const teclear = envios.filter(e => e.datos.modulo === 'teclear');
        const multis = envios.filter(e => e.tabla === 'registros');
        const mision = envios.filter(e => e.datos.modulo === 'mision');
        expect(teclear).toHaveLength(20);
        expect(multis).toHaveLength(10);
        expect(mision).toHaveLength(1);
        expect(mision[0].datos.item).toBe('1');
        expect(multis.filter(m => !m.datos.correcta)).toHaveLength(1);
        for (const m of multis) {
            expect(m.datos.esperado).toBe(m.datos.factor_a * m.datos.factor_b);
            expect(m.datos.detalle.mision).toBe(1);
            expect(Array.isArray(m.datos.detalle.teclas)).toBe(true);
            expect(m.datos.detalle.primera_tecla_ms).toBeGreaterThanOrEqual(0);
        }
        for (const t of teclear) {
            expect(t.datos.correcta).toBe(true);
            expect(t.datos.tiempo_ms).toBeGreaterThan(0);
        }
        expect(await leerCola(page)).toHaveLength(0);
    });
});

test.describe('Parar a medias', () => {
    test('si para después del primer bloque, la próxima vez sigue por el segundo', async ({ page }) => {
        await simularSupabase(page);
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await contestarBloqueNumerico(page);
        await expect(page.locator('#intro-titulo')).toHaveText('Multiplicacions');
        await page.click('#btn-intro-parar');
        await expect(page.locator('#summary-titulo')).toHaveText('Molt bona feina!');

        await page.reload();
        await expect(page.locator('#mision-pasos li').first()).toHaveClass('hecho');
        await expect(page.locator('#btn-start-game')).toBeVisible();
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Multiplicacions');
    });

    test('si para en mitad de un bloque, ese bloque se repite entero', async ({ page }) => {
        await simularSupabase(page);
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await teclear(page, respuestaCorrecta(await page.textContent('#op-factors')));
        await page.waitForTimeout(850);
        await page.click('#btn-exit-game');
        await page.click('#btn-summary-home');
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Escriure números');
    });
});

test.describe('Respuestas', () => {
    test('un fallo muestra la corrección amable, sin contar fallos', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 1, { enCurso: { id: 1, bloque: 1 } });
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        const texto = await page.textContent('#op-factors');
        const bien = respuestaCorrecta(texto);
        await teclear(page, bien + 1);
        await expect(page.locator('#correction-math-text')).toHaveText(`${texto} = ${bien}`);
        await expect(page.locator('#correction-user-response')).toHaveText(`Tu has posat: ${bien + 1}`);
        expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
    });

    test('no deja escribir más de 2 cifras', async ({ page }) => {
        await simularSupabase(page);
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        for (const c of '549') await page.click(`#keypad [data-key="${c}"]`);
        await expect(page.locator('#op-answer')).toHaveText('54');
        await page.click('#keypad [data-key="back"]');
        await expect(page.locator('#op-answer')).toHaveText('5');
    });
});

test.describe('Guardado sin conexión o con la base de datos incompleta', () => {
    test('si la tabla eventos no existe, se guarda en el iPad y se sube después', async ({ page }) => {
        const sb = await simularSupabase(page, { eventos: 'no-existe' });
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        for (let i = 0; i < 3; i++) {
            await teclear(page, respuestaCorrecta(await page.textContent('#op-factors')));
            await page.waitForTimeout(850);
        }
        await expect.poll(async () => (await leerCola(page)).length).toBe(3);
        expect(sb.envios).toHaveLength(0);

        sb.estado.eventos = 'ok';
        await page.reload();
        await expect.poll(async () => (await leerCola(page)).length).toBe(0);
        expect(sb.envios.filter(e => e.datos.modulo === 'teclear')).toHaveLength(3);
    });

    test('si registros no tiene la columna detalle, guarda la multiplicación sin ella', async ({ page }) => {
        const { envios } = await simularSupabase(page, { registros: 'sin-detalle' });
        await empezarEnMision(page, 1, { enCurso: { id: 1, bloque: 1 } });
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await teclear(page, respuestaCorrecta(await page.textContent('#op-factors')));
        await expect.poll(() => envios.filter(e => e.tabla === 'registros').length).toBe(1);
        expect(envios[0].datos.detalle).toBeUndefined();
        expect(await leerCola(page)).toHaveLength(0);
    });
});

test.describe('Sumas y restas', () => {
    for (const [mision, tipo, clave, signo] of [[2, 'suma', 'dojo_deck_suma', '+'], [4, 'resta', 'dojo_deck_resta', '−']]) {
        test(`${tipo}: resultados correctos y las 64 combinaciones sin repetir en una vuelta`, async ({ page }) => {
            const { envios } = await simularSupabase(page);
            await empezarEnMision(page, mision);
            await page.goto(URL_APP);
            await page.click('#btn-start-game');
            await page.click('#btn-intro-vamos');
            expect(await page.textContent('#op-factors')).toContain(signo);
            expect(await contestarBloqueNumerico(page)).toBe(32);

            await expect.poll(() => envios.filter(e => e.datos.modulo === tipo).length).toBe(32);
            const hechas = envios.filter(e => e.datos.modulo === tipo);
            for (const e of hechas) {
                const [a, b] = e.datos.item.split(/[+-]/).map(Number);
                const esperado = tipo === 'suma' ? a + b : a - b;
                expect(e.datos.esperado).toBe(String(esperado));
                expect(esperado).toBeGreaterThanOrEqual(2);
                expect(esperado).toBeLessThanOrEqual(tipo === 'suma' ? 18 : 9);
            }
            // Lo que falta del mazo + lo hecho = las 64 combinaciones, sin repetir
            const quedan = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).mazo, clave);
            const aClave = c => tipo === 'suma' ? `${c.a}+${c.b}` : `${c.a + c.b}-${c.b}`;
            const todas = new Set([...hechas.map(e => e.datos.item), ...quedan.map(aClave)]);
            expect(quedan).toHaveLength(32);
            expect(todas.size).toBe(64);
        });
    }
});

test.describe('Orden de las operaciones', () => {
    // Parecidas = mismo resultado o mismos números (3+8 y 8+3; 9−4 y 9−5; 3×8 y 8×3)
    // En las restas, "los mismos números" son 11−6 y 11−5 (las dos de la misma suma 5+6)
    const numeros = t => t.split(/[×+−]/).map(x => parseInt(x, 10));
    const resultado = t => respuestaCorrecta(t);
    const par = t => t.includes('−') ? [resultado(t), numeros(t)[1]] : numeros(t);
    const parecidas = (t1, t2) => {
        const [a1, b1] = par(t1), [a2, b2] = par(t2);
        return (a1 === a2 && b1 === b2) || (a1 === b2 && b1 === a2) || resultado(t1) === resultado(t2);
    };

    for (const [mision, tipo, clave] of [[2, 'suma', 'dojo_deck_suma'], [4, 'resta', 'dojo_deck_resta']]) {
        test(`${tipo}: nunca salen seguidas dos con el mismo resultado o los mismos números, tampoco al cambiar de mazo`, async ({ page }) => {
            await simularSupabase(page);
            await empezarEnMision(page, mision);
            // Mazo casi acabado: a mitad de bloque empieza uno nuevo
            await page.addInitScript(([k]) => {
                if (sessionStorage.getItem('mazo-preparado')) return;
                sessionStorage.setItem('mazo-preparado', '1');
                localStorage.setItem(k, JSON.stringify({ ciclo: 1, totalCartas: 64, mazo: [{ a: 2, b: 9 }, { a: 5, b: 6 }, { a: 3, b: 4 }, { a: 6, b: 5 }, { a: 2, b: 2 }] }));
            }, [clave]);
            await page.goto(URL_APP);
            await page.click('#btn-start-game');
            await page.click('#btn-intro-vamos');
            const vistos = [];
            expect(await contestarBloqueNumerico(page, [], vistos)).toBe(32);
            for (let i = 1; i < vistos.length; i++) {
                expect(parecidas(vistos[i - 1], vistos[i]), `${vistos[i - 1]} y luego ${vistos[i]}`).toBe(false);
            }
            const ciclo = await page.evaluate(k => JSON.parse(localStorage.getItem(k)).ciclo, clave);
            expect(ciclo).toBe(2);
        });
    }

    test('si la siguiente se parece a la anterior, se salta a otra del mazo', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 2);
        await page.addInitScript(() => {
            localStorage.setItem('dojo_deck_suma', JSON.stringify({ ciclo: 1, totalCartas: 64, anterior: { a: 5, b: 6 }, mazo: [{ a: 2, b: 9 }, { a: 6, b: 5 }, { a: 3, b: 4 }] }));
        });
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await expect(page.locator('#op-factors')).toHaveText('3 + 4');
    });

    test('multiplicaciones: tampoco salen seguidas 3×8 y 8×3, ni dos que den lo mismo', async ({ page }) => {
        await simularSupabase(page);
        await page.addInitScript(() => {
            if (sessionStorage.getItem('mazo-multi')) return;
            sessionStorage.setItem('mazo-multi', '1');
            localStorage.setItem('dojo_deck', JSON.stringify({ ciclo: 1, totalCartas: 64, mazo: [{ a: 3, b: 8 }, { a: 8, b: 3 }, { a: 4, b: 6 }, { a: 2, b: 2 }, { a: 5, b: 5 }, { a: 7, b: 7 }] }));
        });
        await page.goto(URL_APP);
        await irAlUltimoBloque(page, 1); // las 10 multiplicaciones de la misión 1
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        const vistos = [];
        expect(await contestarBloqueNumerico(page, [], vistos)).toBe(10);
        expect(vistos.slice(0, 2)).toEqual(['3 × 8', '2 × 2']);
        for (let i = 1; i < vistos.length; i++) {
            expect(parecidas(vistos[i - 1], vistos[i]), `${vistos[i - 1]} y luego ${vistos[i]}`).toBe(false);
        }
    });

    test('después de la misión 6 empieza la fase 1: sale el entrenamiento', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 7);
        await page.goto(URL_APP);
        await expect(page.locator('#mision-titulo')).toHaveText('Entrenament');
    });

    test('en la misión 6 las multiplicaciones van primero', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 6);
        await page.goto(URL_APP);
        await expect(page.locator('#mision-titulo')).toHaveText('Taules i sumes');
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Multiplicacions');
        await page.click('#btn-intro-vamos');
        expect(await contestarBloqueNumerico(page)).toBe(10);
        await expect(page.locator('#intro-titulo')).toHaveText('Sumes');
    });

    // El 4/10 se quejó: «diu números petits però per a mi no ho són» (18 − 9 tiene dos cifras)
    test('las restas no prometen que sean fáciles y animan a decir «No ho sé»', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 4);
        await page.goto(URL_APP);
        await expect(page.locator('#mision-titulo')).toHaveText('Restes');
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Restes');
        const texto = await page.locator('#intro-texto').innerText();
        expect(texto).not.toMatch(/petit|fàcil(?!s i)/i);
        expect(texto).toContain('No ho sé');
    });
});

test.describe('Està bé o no?', () => {
    test('25 frases; tras una falsa siempre se enseña la correcta', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 3);
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-ejemplo')).toHaveText('2 × 3 = 6 ➜ ✔ Està bé');
        await page.click('#btn-intro-vamos');
        await expect(page.locator('#keypad')).toBeHidden();
        let falsas = 0;
        for (let i = 0; i < 25; i++) {
            const [izq, der] = (await page.textContent('#op-factors')).split('=');
            const [a, b] = izq.split('×').map(Number);
            const verdad = a * b === Number(der);
            await page.click(`#vf-botones [data-vf="${verdad ? 'V' : 'F'}"]`);
            if (!verdad) {
                falsas++;
                await expect(page.locator('#correction-math-text')).toHaveText(`${a} × ${b} = ${a * b}`);
                await page.click('#btn-correction-continue');
            } else {
                await page.waitForTimeout(850);
            }
        }
        expect(falsas).toBe(12);
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'vf').length).toBe(25);
        expect(envios.filter(e => e.datos.modulo === 'vf').every(e => e.datos.correcta)).toBe(true);
    });
});

test.describe('Oral con papá', () => {
    test('guarda si está bien, lo que dijo y cómo lo supo', async ({ page }) => {
        const { envios } = await simularSupabase(page);
        await empezarEnMision(page, 5);
        await page.goto(URL_APP);
        await page.click('#btn-start-game');
        await page.click('#btn-intro-vamos');
        await expect(page.locator('#oral-panel')).toBeVisible();
        for (let i = 0; i < 20; i++) {
            const bien = i % 5 !== 0;
            // En la 10, papá se equivoca de botón: pulsa Bien, vuelve atrás y pulsa Mal
            if (i === 10) {
                await page.click('#oral-panel [data-oral="bien"]');
                await page.click('#oral-volver');
                await expect(page.locator('#oral-paso-1')).toBeVisible();
            }
            await page.click(`#oral-panel [data-oral="${bien ? 'bien' : 'mal'}"]`);
            // Si ha fallado no se pregunta cómo lo ha sabido: solo el número y «Seguir»
            await expect(page.locator('#oral-como')).toBeVisible({ visible: bien });
            await expect(page.locator('#oral-seguir')).toBeVisible({ visible: !bien });
            await expect(page.locator('#oral-dijo')).toBeVisible({ visible: !bien });
            // Cifras dichas al revés: se marca en las ítems 1 y 5; en la 3 se marca y se desmarca
            await expect(page.locator('#oral-reves')).toHaveAttribute('aria-pressed', 'false');
            if (i === 1 || i === 5) await page.click('#oral-reves');
            if (i === 3) { await page.click('#oral-reves'); await page.click('#oral-reves'); }
            if (bien) {
                await page.click('#oral-panel [data-estrategia="memoria"]');
                await page.waitForTimeout(850);
            } else {
                if (i === 10) await page.press('#oral-dijo', 'Enter'); // sin número: no sabe qué ha dicho
                else { await page.fill('#oral-dijo', '24'); await page.click('#oral-seguir'); }
                await expect(page.locator('#correction-math-text')).toBeVisible();
                await page.click('#btn-correction-continue');
            }
        }
        await expect(page.locator('#summary-titulo')).toHaveText('Missió complerta!');
        await expect.poll(() => envios.filter(e => e.datos.modulo === 'oral').length).toBe(20);
        const orales = envios.filter(e => e.datos.modulo === 'oral');
        const malas = orales.filter(e => !e.datos.correcta);
        expect(malas).toHaveLength(4);
        expect(malas.map(e => e.datos.respuesta).sort()).toEqual(['24', '24', '24', null].sort());
        expect(malas.every(e => !('estrategia' in e.datos.detalle))).toBe(true);
        expect(orales.filter(e => e.datos.correcta).every(e => e.datos.detalle.estrategia === 'memoria')).toBe(true);
        expect(new Set(orales.map(e => e.datos.item.split('x').sort().join('x'))).size).toBe(20);
        const alReves = orales.filter(e => e.datos.detalle.reves === true);
        expect(alReves).toHaveLength(2);
        expect(orales.filter(e => 'reves' in e.datos.detalle)).toHaveLength(2);
    });
});

test.describe('Zona Papá', () => {
    test('puede cambiar la misión actual y dejar hacer otra el mismo día', async ({ page }) => {
        await simularSupabase(page);
        await empezarEnMision(page, 2, { hechas: [{ id: 1, fecha: new Date().toLocaleDateString('sv-SE') }] });
        await page.goto(URL_APP);
        await expect(page.locator('#mision-hecha')).toBeVisible();

        await page.click('#btn-open-papa');
        await page.click('#btn-permitir-otra');
        await page.click('#btn-close-papa');
        await expect(page.locator('#mision-titulo')).toHaveText('Sumes');

        await page.click('#btn-open-papa');
        await page.selectOption('#sel-mision', '4');
        await page.click('#btn-set-mision');
        await page.click('#btn-close-papa');
        await expect(page.locator('#mision-titulo')).toHaveText('Amb el papa');
    });
});

test.describe('Diseño en el iPad', () => {
    for (const [nombre, tam] of [['horizontal', { width: 1180, height: 820 }], ['vertical', { width: 820, height: 1180 }]]) {
        test(`nada se sale de la pantalla (${nombre})`, async ({ page }) => {
            await page.setViewportSize(tam);
            await simularSupabase(page);
            await page.goto(URL_APP);
            const cabe = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
            expect(await cabe()).toBe(true);
            await page.click('#btn-start-game');
            expect(await cabe()).toBe(true);
            await page.click('#btn-intro-vamos');
            expect(await cabe()).toBe(true);
            await expect(page.locator('#keypad [data-key="5"]')).toBeInViewport();
            await expect(page.locator('#btn-submit-answer')).toBeInViewport();
        });
    }
});
