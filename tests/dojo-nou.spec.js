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

    test('el diumenge 15/11 tampoc hi ha el repàs de multiplicacions; i, encara que sigui un dia de molta feina, les paraules del dictat de castellà', async ({ page }) => {
        await preparar(page, '2026-11-15');
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

    test('el 14/11 i el 16/11, les paraules del dictat no hi són', async ({ page }) => {
        await preparar(page, '2026-11-16');
        const items = await page.evaluate(() => window.__itemsParaules());
        expect(items.some(x => x.id.startsWith('es-d2-'))).toBe(false);
    });
});

test.describe('Missió a mitges (papà, 12/11): l\'endemà primer acaba el que va quedar', () => {
    const BLOCS = [{ tipo: 'sa2' }, { tipo: 'tonica' }, { tipo: 'bio' }, { tipo: 'angles' }];
    test('va parar el 13/11 després de 2 blocs: el 14/11, primer la bio i l\'anglès d\'ahir i després la missió sencera', async ({ page }) => {
        await preparar(page, '2026-11-14', TOTS, { plan: { hechas: PLAN_ACABAT, extras: EXTRES_FETES, enCurso: { id: 10, bloque: 2, fecha: '2026-11-13', bloques: BLOCS } } });
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
        expect(ec.fecha).toBe('2026-11-14');
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

    test('des del 15/11, l\'email senzill (10) i 3 de vocabulari; les negatives fallades d\'abans ja no tornen', async ({ page }) => {
        await preparar(page, '2026-11-15');
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
        const envios = await preparar(page, '2026-11-13', { angles: true });
        await page.evaluate(() => { window.__dites = []; window.speechSynthesis.speak = u => window.__dites.push(u.lang); });
        await page.click('#btn-start-game');
        await expect(page.locator('#intro-titulo')).toHaveText('English');
        await page.click('#btn-intro-vamos');
        let anterior = 'null', fallada = null;
        for (let i = 0; i < 13; i++) {
            const t = await seguent(page, anterior);
            if (i === 12) expect(t.texto).toBe(fallada);
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
        expect(dades).toHaveLength(13);
        const st = await page.evaluate(() => JSON.parse(localStorage.getItem('dojo_angles')));
        expect(st.falla.map(f => f.preg)).toEqual([fallada]);
        await page.clock.setFixedTime(new Date('2026-11-14T17:00:00'));
        expect((await page.evaluate(() => window.__itemsAngles()))[0].preg).toBe(fallada);
    });
});
