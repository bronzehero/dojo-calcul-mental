// Des del 13/11 (papà, 12/11): com a molt 20 minuts. La base, mates del tema (SA2: múltiples i divisors, amb les taules);
// la resta, només el que té examen a prop (tònica, bio fins al 16/11, anglès). Fora el pas10, la de la setmana i els accents;
// el laboratori i les paraules, només els dies amb menys de 3 blocs d'examen.
const { test, expect, URL_APP, simularSupabase } = require('./ayudas');

const PROHIBIDO_EN_PANTALLA = /segons|cronòmetre|errades|errors|fallades|fallos|\d+\s*\/\s*\d+|malament|incorrect/i;
const PLAN_ACABAT = [1, 2, 3, 4, 5, 6].map(id => ({ id, fecha: '2026-01-01' })).concat([{ id: 10, fecha: '2026-10-21' }]);
const EXTRES_FETES = [{ id: 102, fecha: '2026-10-16' }, { id: 103, fecha: '2026-10-17' }];
const TOTS = { sa2: true, angles: true, bio: true, tonica: true, accent: true, lab: true, paraules: true };

async function preparar(page, dia, opciones = TOTS, estat = {}) {
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
const actual = page => page.evaluate(() => window.__tema1Actual());
async function seguent(page, anterior) {
    await expect.poll(async () => JSON.stringify(await actual(page))).not.toBe(anterior);
    return actual(page);
}

test.describe('El Dojo des del 13/11', () => {
    test('el 12/11 encara és la missió d\'abans (amb pas10 i accents)', async ({ page }) => {
        await preparar(page, '2026-11-12');
        await expect.poll(async () => (await pasos(page)).length).toBeGreaterThan(2);
        const p = (await pasos(page)).join(' | ');
        expect(p).toContain('Accents');
        expect(p).not.toContain('Múltiples i divisors');
        expect(p).not.toContain('English');
    });

    test('el 13/11: múltiples i divisors, tònica, bio i anglès; sense pas10, la de la setmana, accents, laboratori ni paraules', async ({ page }) => {
        await preparar(page, '2026-11-13');
        await expect.poll(async () => (await pasos(page)).length).toBe(4);
        const p = await pasos(page);
        expect(p[0]).toContain('Múltiples i divisors');
        expect(p[1]).toContain('On pica la força');
        expect(p[2]).toContain('Bio');
        expect(p[3]).toContain('English');
    });

    test('el 17/11, sense bio ni tònica: hi tornen el laboratori i les paraules (poca feina)', async ({ page }) => {
        await preparar(page, '2026-11-17');
        await expect.poll(async () => (await pasos(page)).length).toBeGreaterThan(1);
        const p = (await pasos(page)).join(' | ');
        expect(p).toContain('Múltiples i divisors');
        expect(p).toContain('English');
        expect(p).not.toContain('Bio');
        expect(p).not.toContain('Accents');
    });

    test('el dissabte 14/11, encara que sigui un dia de molta feina, les paraules del dictat de castellà (les 8, noves)', async ({ page }) => {
        await preparar(page, '2026-11-14');
        await expect.poll(async () => (await pasos(page)).length).toBe(5);
        const p = await pasos(page);
        expect(p[0]).toContain('Múltiples i divisors');
        expect(p[4]).toContain('Paraules');
        const items = await page.evaluate(() => window.__itemsParaules());
        const noves = items.filter(x => x.fase === 'nova').map(x => x.id);
        expect(noves).toHaveLength(8);
        noves.forEach(id => expect(id.startsWith('es-d2-')).toBe(true));
        expect(items.every(x => x.id.startsWith('es-d2-'))).toBe(true);
    });

    test('el diumenge 15/11 (Port Aventura): només la tònica i les paraules del dictat que encara no domina; res del dissabte a mitges', async ({ page }) => {
        const BLOCS = [{ tipo: 'sa2' }, { tipo: 'tonica' }, { tipo: 'bio' }, { tipo: 'angles' }, { tipo: 'paraules' }];
        const D2 = ['inteligencia', 'conocimiento', 'verdadero', 'signo', 'imaginacion', 'haciendo', 'vez', 'exito'];
        const w = Object.fromEntries(D2.map(x => [`es-d2-${x}`, { intro: '2026-11-14', ultima: '2026-11-14', dominada: !['inteligencia', 'vez'].includes(x) }]));
        await preparar(page, '2026-11-15', TOTS, {
            plan: { hechas: PLAN_ACABAT, extras: EXTRES_FETES, enCurso: { id: 10, bloque: 2, fecha: '2026-11-14', bloques: BLOCS } },
            paraules: { w } });
        await expect.poll(async () => (await pasos(page)).length).toBeGreaterThan(0);
        const p = await pasos(page);
        expect(p.join(' | ')).not.toMatch(/Múltiples|Bio|English|Laboratori/);
        expect(p.some(x => x.includes('On pica la força'))).toBe(true);
        expect(p.some(x => x.includes('Paraules'))).toBe(true);
        const items = await page.evaluate(() => window.__itemsParaules());
        // De memòria: les que no domina i les que va fallar en paper el 14/11 encara que el Dojo les doni per dominades
        expect(items.filter(x => x.fase === 'recorda').map(x => x.id).sort())
            .toEqual(['es-d2-conocimiento', 'es-d2-haciendo', 'es-d2-inteligencia', 'es-d2-signo', 'es-d2-vez']);
        // Noves: les que va fallar en paper el 14/11 i no eren al Dojo
        expect(items.filter(x => x.fase === 'nova').map(x => x.id).sort())
            .toEqual(['es-d2-he-aqui', 'es-d2-mas', 'es-d2-practica', 'es-d2-prueba']);
        expect(items.some(x => ['es-d2-verdadero', 'es-d2-exito', 'es-d2-imaginacion'].includes(x.id))).toBe(false);
    });

    test('les noves del diumenge (prueba, más, práctica, he aquí) no surten el dissabte 14/11', async ({ page }) => {
        await preparar(page, '2026-11-14');
        const items = await page.evaluate(() => window.__itemsParaules());
        expect(items.some(x => ['es-d2-prueba', 'es-d2-mas', 'es-d2-practica', 'es-d2-he-aqui'].includes(x.id))).toBe(false);
    });

    test('el dilluns 16/11 (redacció d\'anglès el 17/11): sense tònica; bio, anglès i les paraules de l\'email (noves, en anglès)', async ({ page }) => {
        await preparar(page, '2026-11-16');
        await expect.poll(async () => (await pasos(page)).length).toBeGreaterThan(2);
        const p = (await pasos(page)).join(' | ');
        expect(p).toContain('Múltiples i divisors');
        expect(p).toContain('Bio');
        expect(p).toContain('English');
        expect(p).toContain('Paraules');
        expect(p).not.toContain('On pica');
        const items = await page.evaluate(() => window.__itemsParaules());
        expect(items.filter(x => x.fase === 'nova').map(x => x.id).sort())
            .toEqual(['en-and', 'en-brown', 'en-eyes', 'en-hair', 'en-in', 'en-like', 'en-music']);
        expect(items.every(x => x.id.startsWith('en-'))).toBe(true);
        await preparar(page, '2026-11-17');
        const repas = await page.evaluate(() => window.__itemsParaules());
        expect(repas.length).toBeGreaterThan(0);
        expect(repas.every(x => x.id.startsWith('en-'))).toBe(true);
        await preparar(page, '2026-11-28');
        expect((await page.evaluate(() => window.__itemsParaules())).some(x => x.id.startsWith('en-'))).toBe(false);
    });

    test('des del 18/11 (papà: anglès cada dia, examen de la Unit 1 ~26/11): cada dia entren les paraules d\'anglès del dia, i només d\'anglès', async ({ page }) => {
        // 19/11 (papà): primer la base (there, are, some, any, has, my, your, her, his); els sustantius, darrere
        // 19/11 nit: her i his, amb el diàleg 2 (he/she), el 22/11
        const DIES = { '2026-11-18': ['short', 'long', 'curly', 'straight', 'grey', 'green'], '2026-11-19': ['there', 'are', 'some', 'any', 'has', 'my'],
            '2026-11-20': ['your', 'glasses', 'freckles', 'tall'], '2026-11-21': ['wall', 'floor', 'mirror', 'window', 'family', 'small'],
            '2026-11-22': ['her', 'his', 'shelves', 'wardrobe', 'curtains', 'posters'], '2026-11-23': ['blonde', 'braces', 'height', 'dark', 'blue', 'people'] };
        await preparar(page, '2026-11-18');
        expect((await pasos(page)).join(' | ')).toContain('Paraules');
        for (const [dia, paraules] of Object.entries(DIES)) {
            expect(paraules.length).toBeLessThanOrEqual(6);
            await preparar(page, dia);
            // les 7 de l'email ja les va fer el 16/11 i el 17/11, i ja les domina
            await page.evaluate(() => {
                const w = {};
                ['in', 'and', 'brown', 'eyes', 'hair', 'like', 'music'].forEach(p => { w[`en-${p}`] = { intro: '2026-11-16', ultima: '2026-11-17', dies: ['2026-11-16', '2026-11-17'], racha: 3, dominada: true }; });
                localStorage.setItem('dojo_paraules', JSON.stringify({ w }));
            });
            const items = await page.evaluate(() => window.__itemsParaules());
            expect(items.every(x => x.id.startsWith('en-'))).toBe(true);
            const ids = items.filter(x => x.fase === 'nova').map(x => x.id);
            // sense historial, també hi surten les dels dies d'abans; les del dia, segur
            if (dia === '2026-11-18') paraules.forEach(p => expect(ids).toContain(`en-${p}`));
        }
        await preparar(page, '2026-11-17');
        const ids17 = (await page.evaluate(() => window.__itemsParaules())).map(x => x.id);
        Object.values(DIES).flat().forEach(p => expect(ids17).not.toContain(`en-${p}`));
        const totes = await page.evaluate(() => window.__paraules ? window.__paraules() : null);
        if (totes) expect(totes.filter(w => w.id.startsWith('en-') && w.desDe).length).toBe(Object.values(DIES).flat().length);
    });

    test('el 13/11 i el 16/11, les paraules del dictat no hi són', async ({ page }) => {
        await preparar(page, '2026-11-13');
        expect((await page.evaluate(() => window.__itemsParaules())).some(x => x.id.startsWith('es-d2-'))).toBe(false);
        await preparar(page, '2026-11-16');
        const items = await page.evaluate(() => window.__itemsParaules());
        expect(items.some(x => x.id.startsWith('es-d2-'))).toBe(false);
    });
});

test.describe('Des del 18/11, més anglès en lloc del laboratori (papà i ella, 17/11)', () => {
    test('el 18/11 no hi ha laboratori, ni tan sols el que va quedar a mitges del 17/11', async ({ page }) => {
        await preparar(page, '2026-11-18', TOTS, { plan: { hechas: PLAN_ACABAT, extras: EXTRES_FETES,
            enCurso: { id: 10, bloque: 3, fecha: '2026-11-17', bloques: [{ tipo: 'sa2' }, { tipo: 'angles' }, { tipo: 'paraules' }, { tipo: 'lab' }] } } });
        await expect.poll(async () => (await pasos(page)).length).toBeGreaterThan(1);
        const p = (await pasos(page)).join(' | ');
        expect(p).not.toContain('Laboratori');
        expect(p).toContain('English');
    });
});

test.describe('Missió a mitges (papà, 12/11): l\'endemà primer acaba el que va quedar', () => {
    const BLOCS = [{ tipo: 'sa2' }, { tipo: 'tonica' }, { tipo: 'bio' }, { tipo: 'angles' }];
    test('va parar després de 2 blocs: l\'endemà (16/11), primer la bio i l\'anglès que van quedar i després la missió sencera', async ({ page }) => {
        await preparar(page, '2026-11-16', TOTS, { plan: { hechas: PLAN_ACABAT, extras: EXTRES_FETES, enCurso: { id: 10, bloque: 2, fecha: '2026-11-13', bloques: BLOCS } } });
        await expect.poll(async () => (await pasos(page)).length).toBe(6);
        const p = await pasos(page);
        expect(p[0]).toContain('Bio');
        expect(p[0]).toContain("(d'ahir)");
        expect(p[1]).toContain('English');
        expect(p[1]).toContain("(d'ahir)");
        expect(p[2]).toContain('Múltiples i divisors');
        expect(p[2]).not.toContain("(d'ahir)");
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText("Bio per a l'examen");
        // Si torna a parar avui, la mateixa llista (amb el d'ahir) continua guardada
        const ec = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_plan')).enCurso);
        expect(ec.fecha).toBe('2026-11-16');
        expect(ec.bloques).toHaveLength(6);
        await page.reload();
        await expect.poll(async () => (await pasos(page)).length).toBe(6);
    });

    test('la veu de l\'explicació d\'un bloc, el primer dia i un cop per setmana', async ({ page }) => {
        await preparar(page, '2026-11-14', { sa2: true }, { intro_veu: { sa2: '2026-11-13' } });
        await page.evaluate(() => { window.__dites = 0; window.speechSynthesis.speak = () => { window.__dites++; }; });
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Múltiples i divisors');
        await expect(page.locator('#intro-texto')).toContainText('múltiples i divisors');
        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_intro_veu')));
        expect(st.sa2).toBe('2026-11-13');
    });
});

test.describe('Múltiples i divisors (SA2)', () => {
    test('10 preguntes, totes amb la resposta bona correcta i les altres, falses', async ({ page }) => {
        await preparar(page, '2026-11-13');
        for (let r = 0; r < 5; r++) {
            const items = await page.evaluate(() => window.__itemsSa2());
            expect(items.length).toBe(10);
            expect(new Set(items.map(x => x.preg)).size).toBe(10);
            for (const x of items) {
                let m;
                if ((m = x.preg.match(/^Quin és múltiple de (\d+)\?$/))) {
                    expect(Number(x.bona) % Number(m[1])).toBe(0);
                    x.altres.forEach(a => expect(Number(a) % Number(m[1])).not.toBe(0));
                } else if ((m = x.preg.match(/^Quin és divisor de (\d+)\?$/))) {
                    expect(Number(m[1]) % Number(x.bona)).toBe(0);
                    x.altres.forEach(a => expect(Number(m[1]) % Number(a)).not.toBe(0));
                } else if ((m = x.preg.match(/^(\d+) × (\d+) = (\d+)\. Què és cert\?$/))) {
                    expect(Number(m[1]) * Number(m[2])).toBe(Number(m[3]));
                    expect([`${m[3]} és múltiple de ${m[1]}`, `${m[1]} és divisor de ${m[3]}`]).toContain(x.bona);
                } else {
                    expect(['Cert', 'Fals']).toContain(x.bona);
                }
            }
        }
    });

    test('la que falla torna al final del bloc i l\'endemà surt primer', async ({ page }) => {
        const envios = await preparar(page, '2026-11-13', { sa2: true });
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Múltiples i divisors');
        await page.click('#btn-intro-vamos');
        let anterior = 'null', fallada = null;
        for (let i = 0; i < 11; i++) {
            const t = await seguent(page, anterior);
            if (i === 10) expect(t.texto).toBe(fallada);
            expect(t.opcions).toContain(t.esperado);
            if (i === 0) {
                fallada = t.texto;
                await page.click(`#tema1-opcions button:not([data-opcio="${t.esperado}"]) >> nth=0`);
                await expect(page.locator('#correction-math-text')).toHaveText(t.esperado);
                await expect(page.locator('#correction-pista')).toBeVisible();
                expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
                await page.click('#btn-correction-continue');
            } else await page.click(`#tema1-opcions button[data-opcio="${t.esperado}"]`);
            anterior = JSON.stringify(t);
        }
        const dades = envios.filter(e => e.datos.modulo === 'sa2').map(e => e.datos);
        expect(dades).toHaveLength(11);
        expect(dades.filter(d => !d.correcta)).toHaveLength(1);
        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_sa2')));
        expect(st.falla.map(f => f.preg)).toEqual([fallada]);
        await page.clock.setFixedTime(new Date('2026-11-14T17:00:00'));
        const dema = await page.evaluate(() => window.__itemsSa2());
        expect(dema[0].preg).toBe(fallada);
        expect(dema).toHaveLength(10);
    });
});

test.describe('Anglès', () => {
    test('12 preguntes: 3 de be, 3 de have got, 4 de vocabulari i 2 de l\'email; cap repetida', async ({ page }) => {
        await preparar(page, '2026-11-13');
        const items = await page.evaluate(() => window.__itemsAngles());
        const compte = {};
        items.forEach(x => { compte[x.bloc] = (compte[x.bloc] || 0) + 1; });
        expect(compte).toEqual({ 1: 3, 2: 3, 3: 4, 4: 2 });
        expect(new Set(items.map(x => x.preg)).size).toBe(12);
        items.forEach(x => expect(x.veu.startsWith('[en] ')).toBe(true));
    });

    test('des del 14/11, l\'email senzill (10) i 3 de vocabulari; les negatives fallades d\'abans ja no tornen', async ({ page }) => {
        await preparar(page, '2026-11-14');
        await page.evaluate(() => localStorage.setItem('dojo_angles', JSON.stringify({ falla: [
            { bloc: 1, preg: 'it is not = ?', bona: 'it isn\'t', altres: ['it amn\'t', 'it not is'], explica: 'x', veu: '[en] It isn\'t.' },
            { bloc: 5, preg: 'nom', bona: 'name', altres: ['neim', 'nam'], explica: 'x', veu: '[en] My name is Alice.' }] })));
        const items = await page.evaluate(() => window.__itemsAngles());
        expect(items.some(x => x.preg === 'it is not = ?')).toBe(false);
        expect(items[0].preg).toBe('nom');
        const compte = {};
        items.forEach(x => { compte[x.bloc] = (compte[x.bloc] || 0) + 1; });
        expect(compte).toEqual({ 3: 3, 5: 10 });
        expect(new Set(items.map(x => x.preg)).size).toBe(items.length);
    });

    test('des del 17/11 (redacció feta, examen de la Unit 1): 3 de be, 3 de have got, 4 de vocabulari i 2 de l\'email', async ({ page }) => {
        await preparar(page, '2026-11-17');
        const items = await page.evaluate(() => window.__itemsAngles());
        const compte = {};
        items.forEach(x => { compte[x.bloc] = (compte[x.bloc] || 0) + 1; });
        expect(compte).toEqual({ 1: 3, 2: 3, 3: 4, 5: 2 });
    });

    test('des del 18/11 (papà, més anglès): 6 de there is / there are, 3 de be, 4 de have got, 3 de vocabulari i 1 de l\'email', async ({ page }) => {
        await preparar(page, '2026-11-18');
        const items = await page.evaluate(() => window.__itemsAngles());
        const compte = {};
        items.forEach(x => { compte[x.bloc] = (compte[x.bloc] || 0) + 1; });
        expect(compte).toEqual({ 1: 3, 2: 4, 3: 3, 5: 1, 7: 6 });
    });

    test('des del 19/11 (papà: primer la base, després els sustantius): be 5, have got 5, email 2, there is/are 6, de qui és 3; cap de vocabulari', async ({ page }) => {
        // Fins al 22/11; des del 23/11, el repartiment nou (més avall)
        for (const dia of ['2026-11-19', '2026-11-22']) {
            await preparar(page, dia);
            const items = await page.evaluate(() => window.__itemsAngles());
            const compte = {};
            items.forEach(x => { compte[x.bloc] = (compte[x.bloc] || 0) + 1; });
            expect(compte).toEqual({ 1: 5, 2: 5, 5: 2, 7: 6, 8: 3 });
            expect(new Set(items.map(x => x.preg)).size).toBe(21);
        }
    });

    test('el 20 i el 21/11 (diàleg 1, jo i tu): només I / you i there is / are, a les preguntes, a les frases i a les fallades d\'abans; el 22/11 tornen he/she', async ({ page }) => {
        const altra = t => /\b(he|she|they|we|his|her|their|our|it)\b/i.test(t);
        for (const dia of ['2026-11-20', '2026-11-21']) {
            await preparar(page, dia, TOTS, { angles: { falla: [{ bloc: 1, preg: 'They ___ Portuguese. They\'re Italian.', bona: 'aren\'t', altres: ['isn\'t', '\'m not'], explica: 'x', veu: "[en] They aren't Portuguese. They're Italian." }], fet: '2026-11-19' } });
            const items = await page.evaluate(() => window.__itemsAngles());
            expect(items.length).toBeGreaterThanOrEqual(18);
            expect(items.filter(x => altra(x.veu)).map(x => x.veu)).toEqual([]);
            const frases = await page.evaluate(() => { const f = window.__frasesEn(); return window.__itemsFrases().map(x => f.find(y => y.id === x.id).en); });
            expect(frases.filter(altra)).toEqual([]);
        }
        await preparar(page, '2026-11-22');
        expect((await page.evaluate(() => window.__itemsAngles())).some(x => altra(x.veu))).toBe(true);
    });

    test('música, del 20 al 26/11: primer les 8 que es van creuar als tests de paper (test 2: l\'ordre, Méliès, funcions, PRE) i els 4 anys; i la música té opcions diferents', async ({ page }) => {
        const PAPER = ['La primera pel·lícula sonora (la primera que PARLA):', 'La primera pel·lícula de Disney (la primera que DIBUIXA):', 'Qui va fer la primera sessió de cinema?',
            'Qui va inventar els trucatges i va fer «Viatge a la Lluna»?', 'Quines són les dues funcions de la música en el cinema?',
            'La música ens porta a una època o a un país. Quina funció és?', 'Blockbuster:', 'Prequel·la:'];
        for (const dia of ['2026-11-21', '2026-11-26']) {
            await preparar(page, dia);
            const mus = (await page.evaluate(() => window.__itemsMusica())).map(x => x.preg);
            expect(mus.length).toBe(12);
            PAPER.forEach(p => expect(mus).toContain(p));
            expect(mus.filter(p => p.startsWith('En quin any'))).toHaveLength(4);
        }
        const totes = (await page.evaluate(() => window.__preguntesTria())).musica;
        for (const [, , bona, altres, explica] of totes) {
            expect(new Set([bona, ...altres]).size).toBe(altres.length + 1);
            expect(explica.length).toBeGreaterThan(10);
        }
    });

    test('els anys de música (papà 21/11): primer molt lluny, i s\'acosten amb 2 dies bé; si falla, baixa', async ({ page }) => {
        await preparar(page, '2026-11-22');
        const anys = async () => (await page.evaluate(() => window.__itemsMusica())).filter(x => x.preg.startsWith('En quin any'));
        const sonora = 'En quin any és la primera pel·lícula sonora, «El cantor de jazz»? Pista: el cinema és de cap al 1900.';
        const de = async preg => (await anys()).find(x => x.preg === preg);
        // Nivell 1: cap altre any del segle de la bona (ni dels 1800, que és el del 1895)
        for (const x of await anys()) {
            expect(x.any).toBe(1);
            x.altres.forEach(a => { expect(Math.floor(a / 100)).not.toBe(Math.floor(x.bona / 100)); expect(Math.floor(a / 100)).not.toBe(18); });
        }
        const contesta = (dia, ok) => page.evaluate(([preg, ok]) => {
            const x = window.__itemsMusica().find(y => y.preg === preg);
            window.__anotarTria('musica', { fix: x }, ok);
        }, [sonora, ok]).then(() => dia);
        await contesta('22', true);
        await contesta('22', true);
        expect((await de(sonora)).any).toBe(1);
        await page.clock.setFixedTime(new Date('2026-11-23T17:00:00'));
        await contesta('23', true);
        const n2 = await de(sonora);
        expect(n2.any).toBe(2);
        n2.altres.forEach(a => { expect(Math.abs(+a - 1927)).toBeGreaterThan(30); expect(Math.abs(+a - 1927)).toBeLessThan(100); });
        await page.clock.setFixedTime(new Date('2026-11-24T17:00:00'));
        await contesta('24', true);
        await page.clock.setFixedTime(new Date('2026-11-25T17:00:00'));
        await contesta('25', true);
        const n3 = await de(sonora);
        expect(n3.any).toBe(3);
        expect([...n3.altres].sort()).toEqual(['1895', '1902', '1937']);
        await contesta('25', false);
        expect((await de(sonora)).any).toBe(2);
        await page.clock.setFixedTime(new Date('2026-11-27T17:00:00'));
        expect((await anys()).filter(x => x.any)).toHaveLength(0);
    });

    test('de qui és (bloc 8): my, your, his, her, our, their, i cada una amb la seva trampa', async ({ page }) => {
        await preparar(page, '2026-11-19');
        const b8 = (await page.evaluate(() => window.__anglesPreguntes())).filter(p => p[0] === 8);
        expect(b8.length).toBeGreaterThanOrEqual(8);
        const bones = b8.map(p => p[2].toLowerCase().split(' ')[0]);
        ['my', 'your', 'his', 'her', 'our', 'their'].forEach(w => expect(bones).toContain(w));
    });

    test('totes les preguntes tenen 3 opcions diferents i la bona hi és una sola vegada', async ({ page }) => {
        await preparar(page, '2026-11-13');
        const totes = await page.evaluate(() => window.__anglesPreguntes());
        for (const [, preg, bona, altres, explica, frase] of totes) {
            expect(new Set([bona, ...altres]).size).toBe(3);
            expect(explica.length).toBeGreaterThan(5);
            expect(frase.length).toBeGreaterThan(2);
            if (preg.includes('___')) expect(frase.toLowerCase().replace(/[.?!,]/g, '')).toContain(bona.toLowerCase().replace(/^'/, ''));
        }
    });

    test('si falla: la bona explicada, la frase en anglès i torna al final; queda guardada per a l\'endemà', async ({ page }) => {
        // El 14/11 (13 preguntes) i l'endemà de feina, el 16/11: tots dos amb l'email senzill
        const envios = await preparar(page, '2026-11-14', { angles: true });
        const n = (await page.evaluate(() => window.__itemsAngles())).length;
        await page.evaluate(() => { window.__dites = []; window.speechSynthesis.speak = u => window.__dites.push(u.lang); });
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('English');
        await page.click('#btn-intro-vamos');
        let anterior = 'null', fallada = null;
        for (let i = 0; i <= n; i++) {
            const t = await seguent(page, anterior);
            if (i === n) expect(t.texto).toBe(fallada);
            if (i === 0) {
                fallada = t.texto;
                await page.click(`#tema1-opcions button:not([data-opcio="${t.esperado.replace(/"/g, '\\"')}"]) >> nth=0`);
                await expect(page.locator('#correction-pista')).toBeVisible();
                expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
                await page.click('#btn-correction-continue');
            } else await page.click(`#tema1-opcions button[data-opcio="${t.esperado.replace(/"/g, '\\"')}"]`);
            anterior = JSON.stringify(t);
        }
        const dades = envios.filter(e => e.datos.modulo === 'angles').map(e => e.datos);
        expect(dades).toHaveLength(n + 1);
        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_angles')));
        expect(st.falla.map(f => f.preg)).toEqual([fallada]);
        await page.clock.setFixedTime(new Date('2026-11-15T17:00:00'));
        expect((await page.evaluate(() => window.__itemsAngles()))[0].preg).toBe(fallada);
    });
});

test.describe('Des del 18/11: música (examen 27/11); el castellà de la U2, fora (papà 18/11: no hi ha control)', () => {
    const AMB = { ...TOTS, musica: true, castu2: true };
    test('el 18/11 la missió porta múltiples, anglès i música, en aquest ordre, i cap castellà', async ({ page }) => {
        await preparar(page, '2026-11-18', AMB);
        await expect.poll(async () => (await pasos(page)).length).toBeGreaterThan(2);
        const p = (await pasos(page)).join(' | ');
        expect(p).not.toContain('Castellà: la unitat 2');
        const ordre = ['Múltiples', 'English', 'Música per a l\'examen'].map(x => p.indexOf(x));
        ordre.forEach(i => expect(i).toBeGreaterThanOrEqual(0));
        expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    });
    test('el 17/11 encara no; la música s\'acaba el 26/11; el castellà, cap dia', async ({ page }) => {
        for (const [dia, cast, mus] of [['2026-11-17', false, false], ['2026-11-18', false, true], ['2026-11-22', false, true], ['2026-11-23', false, true], ['2026-11-27', false, false]]) {
            await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }).catch(() => {});
            await preparar(page, dia, AMB);
            await expect.poll(async () => (await pasos(page)).length).toBeGreaterThan(0);
            const p = (await pasos(page)).join(' | ');
            expect(p.includes('Castellà: la unitat 2'), dia).toBe(cast);
            expect(p.includes('Música per a l\'examen'), dia).toBe(mus);
        }
    });
    test('10 de música i 6 de castellà al dia, de tots els blocs, sense repetir; preguntes amb 2 o 3 opcions diferents', async ({ page }) => {
        await preparar(page, '2026-11-18', AMB);
        const mus = await page.evaluate(() => window.__itemsMusica());
        expect(mus.length).toBe(10);
        expect(new Set(mus.map(x => x.preg)).size).toBe(10);
        expect(new Set(mus.map(x => x.bloc))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
        const cas = await page.evaluate(() => window.__itemsCastu2());
        expect(cas.length).toBe(6);
        expect(new Set(cas.map(x => x.bloc))).toEqual(new Set([1, 2, 3]));
        const totes = await page.evaluate(() => window.__preguntesTria());
        for (const p of [...totes.musica, ...totes.castu2, ...totes.angles]) {
            expect(new Set([p[2], ...p[3]]).size, p[1]).toBe(1 + p[3].length);
            expect(p[3].length).toBeGreaterThanOrEqual(1);
        }
    });
    test('la missió d\'avui que va parar al castellà continua pel bloc següent, sense castellà', async ({ page }) => {
        const BLOCS = [{ tipo: 'sa2' }, { tipo: 'castu2' }, { tipo: 'angles' }, { tipo: 'musica' }];
        await preparar(page, '2026-11-18', AMB, { plan: { hechas: PLAN_ACABAT, extras: EXTRES_FETES, enCurso: { id: 10, bloque: 1, fecha: '2026-11-18', bloques: BLOCS } } });
        await expect.poll(async () => (await pasos(page)).length).toBe(3);
        expect((await pasos(page)).join(' | ')).not.toContain('Castellà: la unitat 2');
        const ec = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_plan')).enCurso);
        expect(ec.bloques.map(b => b.tipo)).toEqual(['sa2', 'angles', 'musica']);
        expect(ec.bloque).toBe(1);
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toContainText('English');
    });
    test('si el castellà ja estava fet, el número de bloc es corregeix', async ({ page }) => {
        const BLOCS = [{ tipo: 'sa2' }, { tipo: 'castu2' }, { tipo: 'angles' }, { tipo: 'musica' }];
        await preparar(page, '2026-11-18', AMB, { plan: { hechas: PLAN_ACABAT, extras: EXTRES_FETES, enCurso: { id: 10, bloque: 3, fecha: '2026-11-18', bloques: BLOCS } } });
        await expect.poll(async () => (await pasos(page)).length).toBe(3);
        const ec = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_plan')).enCurso);
        expect(ec.bloque).toBe(2);
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toContainText('Música');
    });
    test('una de música que falla torna al final i l\'endemà surt primer', async ({ page }) => {
        await preparar(page, '2026-11-18', { musica: true });
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toContainText('Música');
        await page.click('#btn-intro-vamos');
        const primera = await seguent(page, 'null');
        await page.click('#btn-no-ho-se');
        await page.click('#btn-correction-continue');
        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_musica')));
        expect(st.falla.map(f => f.preg)).toContain(primera.texto);
    });
});

// 20/11 (papà, d'acord): a SA2 triava el número que s'assembla (divisor de 18 → 8); a l'anglès repetia l'error dos minuts després.
test.describe('Des del 21/11: SA2 construït amb la taula i, a l\'anglès, la frase bona escrita després de fallar', () => {
    test('SA2: múltiples i divisors sense opcions, amb el número que falta; el 20/11 encara de triar', async ({ page }) => {
        await preparar(page, '2026-11-20');
        expect((await page.evaluate(() => window.__itemsSa2())).some(x => x.num)).toBe(false);
        await page.clock.setFixedTime(new Date('2026-11-21T17:00:00'));
        for (let r = 0; r < 5; r++) {
            const items = await page.evaluate(() => window.__itemsSa2());
            expect(items).toHaveLength(10);
            expect(new Set(items.map(x => x.preg)).size).toBe(10);
            expect(items.filter(x => x.num && x.bloc === 1)).toHaveLength(4);
            expect(items.filter(x => x.num && x.bloc === 2)).toHaveLength(4);
            for (const x of items.filter(x => x.num)) {
                let m;
                if ((m = x.op.match(/^(\d+) × (\d+)$/))) {
                    expect(Number(m[1]) * Number(m[2])).toBe(Number(x.bona));
                    expect(x.titol).toBe(`Un múltiple de ${m[1]}:`);
                } else {
                    m = x.op.match(/^(\d+) = (\d+) ×$/);
                    expect(m).not.toBeNull();
                    expect(Number(m[2]) * Number(x.bona)).toBe(Number(m[1]));
                    expect(x.titol).toBe(`Un divisor de ${m[1]}:`);
                }
            }
        }
    });

    test('SA2: les fallades de triar un número ja no tornen; les de vocabulari, sí', async ({ page }) => {
        await preparar(page, '2026-11-21', TOTS, { sa2: { falla: [
            { bloc: 2, preg: 'Quin és divisor de 18?', bona: '6', altres: ['8', '5'], explica: 'x' },
            { bloc: 3, preg: '7 × 8 = 56. Què és cert?', bona: '56 és múltiple de 7', altres: ['a', 'b'], explica: 'x' }] } });
        const items = await page.evaluate(() => window.__itemsSa2());
        expect(items.map(x => x.preg)).not.toContain('Quin és divisor de 18?');
        expect(items[0].preg).toBe('7 × 8 = 56. Què és cert?');
    });

    test('SA2: s\'escriu amb el teclat; bé → la frase; malament → explicada i torna al final', async ({ page }) => {
        const envios = await preparar(page, '2026-11-21', { sa2: true });
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('Múltiples i divisors');
        await expect(page.locator('#intro-texto')).toContainText('taula de multiplicar');
        await page.click('#btn-intro-vamos');
        let anterior = 'null', fallada = null, frases = 0;
        for (let i = 0; i < 11; i++) {
            const t = await seguent(page, anterior);
            if (i === 10) expect(t.texto).toBe(fallada);
            if (!t.opcions) {
                await expect(page.locator('#keypad')).toBeVisible();
                if (fallada === null) {
                    fallada = t.texto;
                    await page.keyboard.type(String(Number(t.esperado) + 1).slice(-2));
                    await page.keyboard.press('Enter');
                    await expect(page.locator('#correction-math-text')).toContainText(`${t.esperado}`);
                    await expect(page.locator('#correction-pista')).toBeVisible();
                    expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
                    await page.click('#btn-correction-continue');
                } else {
                    await page.keyboard.type(t.esperado);
                    await page.keyboard.press('Enter');
                    await expect(page.locator('.celebrate-text')).toContainText(/és múltiple de|són divisors de/);
                    frases++;
                }
            } else await page.click(`#tema1-opcions button[data-opcio="${t.esperado}"]`);
            // L'element actual canvia (anotarTria) abans que passi la celebració (0,8 s; 1,8 s amb la frase): esperar-la, o la tecla va a l'anterior
            await page.waitForTimeout(t.opcions ? 1000 : 2000);
            anterior = JSON.stringify(t);
        }
        expect(frases).toBeGreaterThan(5);
        const dades = envios.filter(e => e.datos.modulo === 'sa2').map(e => e.datos);
        expect(dades).toHaveLength(11);
        expect(dades.filter(d => !d.correcta)).toHaveLength(1);
        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_sa2')));
        expect(st.falla).toHaveLength(1);
        expect(st.falla[0].num).toBe(true);
    });

    test('anglès: si falla, la frase bona; la torna a escriure tapada i el segon intent es guarda a part', async ({ page }) => {
        const envios = await preparar(page, '2026-11-21', { angles: true });
        const n = (await page.evaluate(() => window.__itemsAngles())).length;
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('English');
        await page.click('#btn-intro-vamos');
        const esc = s => s.replace(/"/g, '\\"');
        // La primera: malament, i la reescriu bé
        let t = await seguent(page, 'null');
        await page.click(`#tema1-opcions button:not([data-opcio="${esc(t.esperado)}"]) >> nth=0`);
        await expect(page.locator('#btn-angles-copia')).toBeVisible();
        await expect(page.locator('.frase-bona')).toBeVisible();
        await expect(page.locator('#btn-correction-continue')).toBeHidden();
        expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
        const copia = (await page.locator('.frase-bona').innerText()).trim();
        await page.click('#btn-angles-copia');
        await expect(page.locator('.frase-bona')).toHaveCount(0);
        await expect(page.locator('#dictat-panel')).toBeVisible();
        await page.keyboard.type(copia.toLowerCase());
        await page.keyboard.press('Enter');
        await expect(page.locator('.celebrate-text')).toBeVisible();
        // La segona: malament, i la reescriu malament → la correcció de sempre
        let anterior = JSON.stringify(t);
        t = await seguent(page, anterior);
        await page.click(`#tema1-opcions button:not([data-opcio="${esc(t.esperado)}"]) >> nth=0`);
        await page.click('#btn-angles-copia');
        await page.keyboard.type('my name alice');
        await page.keyboard.press('Enter');
        await expect(page.locator('#btn-correction-continue')).toBeVisible();
        await expect(page.locator('#correction-pista')).toBeVisible();
        await page.click('#btn-correction-continue');
        anterior = JSON.stringify(t);
        // La resta, bé (i les dues que ha fallat tornen al final)
        for (let i = 2; i < n + 2; i++) {
            t = await seguent(page, anterior);
            await page.click(`#tema1-opcions button[data-opcio="${esc(t.esperado)}"]`);
            anterior = JSON.stringify(t);
        }
        const dades = envios.filter(e => e.datos.modulo === 'angles').map(e => e.datos);
        const segons = dades.filter(d => d.detalle && d.detalle.intent === 2);
        expect(segons.map(d => d.correcta)).toEqual([true, false]);
        expect(dades).toHaveLength(n + 2 + 2);
        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_angles')));
        expect(st.falla).toHaveLength(2);
    });

    test('anglès: la frase per escriure, sense xifres (al teclat no n\'hi ha)', async ({ page }) => {
        await preparar(page, '2026-11-21');
        const totes = await page.evaluate(() => window.__anglesPreguntes());
        const copies = await page.evaluate(() => window.__anglesCopies());
        expect(copies).toHaveLength(totes.length);
        copies.forEach(c => { expect(c).not.toMatch(/\d/); expect(c.length).toBeLessThanOrEqual(60); });
        expect(copies).toContain('I am twelve years old.');
    });
});

// 22/11 (ella, per boca del papà): escriure frases llargues en anglès és massa. Des del 23/11, frases per triar dient-les
// fluixet, i escriure només una paraula. Entren ell/ella (diàleg 2) i les frases de Frases per triar.
test.describe('Des del 23/11: anglès sense escriure frases senceres', () => {
    test('5 d\'ell/ella i 3 frases per triar; les opcions de les frases només canvien la peça, i el 22/11 encara no hi són', async ({ page }) => {
        await preparar(page, '2026-11-23', { angles: true });
        const items = await page.evaluate(() => window.__itemsAngles());
        expect(items.filter(x => x.bloc === 9)).toHaveLength(5);
        const fr = items.filter(x => x.bloc === 10);
        expect(fr).toHaveLength(3);
        expect(items.length).toBe(21);
        const compte = {};
        items.forEach(x => { compte[x.bloc] = (compte[x.bloc] || 0) + 1; });
        expect(compte).toEqual({ 1: 3, 2: 3, 5: 1, 7: 4, 8: 2, 9: 5, 10: 3 });
        const totes = await page.evaluate(() => window.__frasesEn());
        for (const x of fr) {
            const f = totes.find(t => t.en === x.bona);
            expect(f, x.bona).toBeTruthy();
            expect(x.preg).toContain(f.ca);
        }
    });

    test('des del 24/11 (email informal a l\'examen): 3 de formal o informal, i la bona sempre és la informal', async ({ page }) => {
        await preparar(page, '2026-11-24', { angles: true });
        const items = await page.evaluate(() => window.__itemsAngles());
        const compte = {};
        items.forEach(x => { compte[x.bloc] = (compte[x.bloc] || 0) + 1; });
        expect(compte).toEqual({ 1: 3, 2: 3, 5: 1, 7: 3, 8: 2, 9: 4, 10: 3, 11: 3 });
        const formals = ['Dear Martin,', 'With regards,'];
        for (const x of items.filter(i => i.bloc === 11)) {
            expect(formals).not.toContain(x.bona);
            expect(x.preg).toContain('amiga');
        }
        await preparar(page, '2026-11-23', { angles: true });
        expect((await page.evaluate(() => window.__itemsAngles())).filter(x => x.bloc === 11)).toHaveLength(0);
    });

    test('el 22/11, sense blocs 9 ni 10', async ({ page }) => {
        await preparar(page, '2026-11-22', { angles: true });
        const items = await page.evaluate(() => window.__itemsAngles());
        expect(items.filter(x => x.bloc >= 9)).toHaveLength(0);
    });

    test('si falla una peça, escriu només la paraula al forat; si falla una frase, la llegeix i segueix sense escriure', async ({ page }) => {
        const envios = await preparar(page, '2026-11-23', { angles: true });
        const n = (await page.evaluate(() => window.__itemsAngles())).length;
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('English');
        await page.click('#btn-intro-vamos');
        const esc = s => s.replace(/"/g, '\\"');
        let anterior = 'null', peca = false, frase = false;
        for (let i = 0; i < n + 2; i++) {
            const t = await seguent(page, anterior);
            anterior = JSON.stringify(t);
            const curta = t.esperado.trim().split(/\s+/).length <= 2;
            if ((curta && !peca) || (!curta && !frase)) {
                await page.click(`#tema1-opcions button:not([data-opcio="${esc(t.esperado)}"]) >> nth=0`);
                if (curta) {
                    peca = true;
                    await expect(page.locator('#btn-angles-copia')).toHaveText('Escric la paraula ✍️');
                    await page.click('#btn-angles-copia');
                    await expect(page.locator('#tema1-preg .forat')).toBeVisible();
                    await page.keyboard.type(t.esperado.toLowerCase());
                    await page.keyboard.press('Enter');
                    await expect(page.locator('.celebrate-text')).toBeVisible();
                } else {
                    frase = true;
                    await expect(page.locator('#btn-angles-copia')).toHaveCount(0);
                    await expect(page.locator('#btn-correction-continue')).toBeVisible();
                    expect(await page.locator('#screen-game').innerText()).not.toMatch(PROHIBIDO_EN_PANTALLA);
                    await page.click('#btn-correction-continue');
                }
            } else await page.click(`#tema1-opcions button[data-opcio="${esc(t.esperado)}"]`);
            await page.waitForTimeout(t.opcions ? 1000 : 2000);
        }
        expect(peca && frase).toBe(true);
        const segons = envios.filter(e => e.datos.modulo === 'angles' && e.datos.detalle && e.datos.detalle.intent === 2).map(e => e.datos);
        expect(segons).toHaveLength(1);
        expect(segons[0].detalle.paraula).toBe(true);
        expect(segons[0].correcta).toBe(true);
    });

    test('la peça amb apòstrof val curta o llarga (\'ve = have)', async ({ page }) => {
        await preparar(page, '2026-11-23', { angles: true });
        expect(await page.evaluate(() => window.__frasesIguals('I have got brown hair.', "I've got brown hair."))).toBe(true);
    });
});
